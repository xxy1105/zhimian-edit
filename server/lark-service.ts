import * as lark from '@larksuiteoapi/node-sdk';

export class LarkNotConfiguredError extends Error {
  status = 503;

  constructor() {
    super('飞书开放平台尚未配置，请设置 LARK_APP_ID、LARK_APP_SECRET 和 LARK_OWNER_OPEN_ID');
  }
}

function config() {
  return {
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    ownerOpenId: process.env.LARK_OWNER_OPEN_ID,
  };
}

function client() {
  const { appId, appSecret } = config();
  if (!appId || !appSecret) throw new LarkNotConfiguredError();
  return new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });
}

function assertSuccess(response: { code?: number; msg?: string }) {
  if (response.code) {
    throw Object.assign(new Error(`飞书接口失败：${response.msg || response.code}`), { status: 502 });
  }
}

export async function testLarkConnection() {
  const { ownerOpenId } = config();
  if (!ownerOpenId) throw new LarkNotConfiguredError();
  const response = await client().contact.user.get({
    params: { user_id_type: 'open_id' },
    path: { user_id: ownerOpenId },
  });
  assertSuccess(response);
  return {
    connected: true,
    userName: response.data?.user?.name || '',
    checkedAt: new Date().toISOString(),
  };
}

export async function createLarkMeeting(input: {
  topic: string;
  startTime: string;
  endTime: string;
  autoRecord?: boolean;
  hostOpenIds?: string[];
}) {
  const { ownerOpenId } = config();
  if (!ownerOpenId) throw new LarkNotConfiguredError();
  const sdk=client();
  const response = await sdk.vc.v1.reserve.apply({
    params: { user_id_type: 'open_id' },
    data: {
      owner_id: ownerOpenId,
      end_time: String(Math.floor(new Date(input.endTime).getTime() / 1000)),
      meeting_settings: {
        topic: input.topic,
        auto_record: input.autoRecord ?? true,
        assign_host_list: (input.hostOpenIds || []).map((id) => ({ user_type: 1, id })),
      },
    },
  });
  assertSuccess(response);
  const reserve = response.data?.reserve;
  if (!reserve?.id || !reserve.url) {
    throw Object.assign(new Error('飞书建会响应缺少预约 ID 或会议链接'), { status: 502 });
  }
  let calendarEventId:string|undefined;
  if(process.env.LARK_CALENDAR_ID&&reserve.meeting_no){
    const calendar=await sdk.calendar.v4.calendarEvent.create({
      path:{calendar_id:process.env.LARK_CALENDAR_ID},
      params:{user_id_type:'open_id',idempotency_key:`zhimian-${reserve.id}`},
      data:{
        summary:input.topic,
        need_notification:true,
        start_time:{timestamp:String(Math.floor(new Date(input.startTime).getTime()/1000)),timezone:'Asia/Shanghai'},
        end_time:{timestamp:String(Math.floor(new Date(input.endTime).getTime()/1000)),timezone:'Asia/Shanghai'},
        vchat:{vc_type:'vc',vc_info:{unique_id:reserve.id,meeting_no:reserve.meeting_no}},
        reminders:[{minutes:15}],
      },
    });
    assertSuccess(calendar);
    calendarEventId=calendar.data?.event?.event_id;
  }
  return {
    reserveId: reserve.id,
    meetingNo: reserve.meeting_no,
    meetingUrl: reserve.url,
    appLink: reserve.app_link,
    password: reserve.password,
    expiresAt: reserve.end_time,
    calendarEventId,
  };
}

export async function getLarkMeetingResult(input: {
  meetingId?: string;
  meetingNo?: string;
  startTime?: string;
  endTime?: string;
}) {
  const sdk = client();
  let meetingId = input.meetingId;
  if (!meetingId && input.meetingNo) {
    const response = await sdk.vc.v1.meeting.listByNo({
      params: {
        meeting_no: input.meetingNo,
        start_time: input.startTime || String(Math.floor((Date.now() - 90 * 86400000) / 1000)),
        end_time: input.endTime || String(Math.floor(Date.now() / 1000)),
        page_size: 20,
      },
    });
    assertSuccess(response);
    meetingId = response.data?.meeting_briefs?.at(-1)?.id;
  }
  if (!meetingId) {
    throw Object.assign(new Error('会议尚未产生可查询的 meetingId'), { status: 409 });
  }
  const response = await sdk.vc.v1.meeting.get({
    params: { with_participants: true, with_meeting_ability: true, user_id_type: 'open_id' },
    path: { meeting_id: meetingId },
  });
  assertSuccess(response);
  const recording = await sdk.vc.v1.meetingRecording.get({
    path: { meeting_id: meetingId },
  }).catch(() => undefined);
  if (recording) assertSuccess(recording);
  return {
    meetingId,
    meeting: response.data?.meeting,
    relatedArtifacts: response.data?.related_artifacts,
    recording: recording?.data?.recording,
  };
}
