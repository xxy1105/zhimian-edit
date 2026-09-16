import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import {
  authenticate, clearSessionCookie, developmentUsers, setSessionCookie, validateAuthConfiguration,
  verifyPassword, type AuthUser,
} from './auth.ts';
import { HttpInterviewProvider, verifyProviderWebhook, type InterviewProvider } from './interview-provider.ts';
import { createLarkMeeting, getLarkMeetingResult, testLarkConnection } from './lark-service.ts';
import { parseResume, sendInterviewNotification, testNotificationProvider } from './external-services.ts';
import { Store } from './store.ts';
import { collectionNames, type CollectionName, type Entity } from './types.ts';

const readOnlyRoles = new Set(['数据观察员', '外部客户', '面试官']);
const collections = new Set<string>(collectionNames);

function routeParam(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function collectionFromRequest(request: Request): CollectionName {
  const collection = routeParam(request, 'resource');
  if (!collections.has(collection)) {
    const error = new Error(`未知资源：${collection}`) as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  return collection as CollectionName;
}

function requireWritable(request: Request, response: Response, next: NextFunction) {
  const role = request.user!.role;
  if (readOnlyRoles.has(role)) {
    response.status(403).json({ message: `${role}仅有查看权限` });
    return;
  }
  next();
}

function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (request.user!.role !== '超级管理员') {
    response.status(403).json({ message: '仅超级管理员可执行此操作' });
    return;
  }
  next();
}

function contains(record: Entity, keyword: string) {
  return JSON.stringify(record).toLowerCase().includes(keyword.toLowerCase());
}

function filterByUser(records: Entity[], user: AuthUser, database: Awaited<ReturnType<Store['read']>>) {
  if (user.role === '超级管理员') return records;
  const allowedProjects = new Set(database.projects.filter((item) => user.projectKeys.includes(item.key)).map((item) => String(item.name)));
  const allowedJobs = new Set(database.jobs.filter((item) => user.jobKeys.includes(item.key) || allowedProjects.has(String(item.project))).map((item) => String(item.name)));
  return records.filter((record) => {
    if (record.key && user.projectKeys.includes(record.key)) return true;
    if (record.key && user.jobKeys.includes(record.key)) return true;
    if ('project' in record && allowedProjects.has(String(record.project))) return true;
    if ('job' in record && allowedJobs.has(String(record.job))) return true;
    return !('project' in record) && !('job' in record) && !['项目经理', '岗位负责人', '招聘专员', '面试官', '外部客户'].includes(user.role);
  });
}

function publicSettings(settings: Record<string, unknown>) {
  const { feishuSecret: _secret, ...safe } = settings;
  return {
    ...safe,
    feishuConfigured: Boolean(process.env.LARK_APP_ID && process.env.LARK_APP_SECRET && process.env.LARK_OWNER_OPEN_ID),
    interviewProviderConfigured: Boolean(process.env.INTERVIEW_PROVIDER_BASE_URL && process.env.INTERVIEW_PROVIDER_API_KEY),
    notificationProviderConfigured: Boolean(process.env.NOTIFICATION_PROVIDER_BASE_URL && process.env.NOTIFICATION_PROVIDER_API_KEY),
    resumeParserConfigured: Boolean(process.env.RESUME_PARSER_BASE_URL && process.env.RESUME_PARSER_API_KEY),
    databaseMode: process.env.DATABASE_URL ? 'postgres' : 'local-json',
  };
}

async function scopedRecord(store:Store,request:Request,collection:CollectionName,key:string){
  const database=await store.read();
  return filterByUser(database[collection],request.user!,database).find(item=>item.key===key);
}

function canUseScope(
  database: Awaited<ReturnType<Store['read']>>,
  user: AuthUser,
  project?: unknown,
  job?: unknown,
) {
  const projectName = project ? String(project) : undefined;
  const jobName = job ? String(job) : undefined;
  const projectRecord = projectName
    ? database.projects.find((item) => item.name === projectName)
    : undefined;
  const jobRecord = jobName
    ? database.jobs.find((item) => item.name === jobName)
    : undefined;
  if ((projectName && !projectRecord) || (jobName && !jobRecord)) return false;
  if (projectName && jobRecord && jobRecord.project !== projectName) return false;
  if (user.role === '超级管理员') return true;
  if (projectRecord && !filterByUser(database.projects, user, database).some((item) => item.key === projectRecord.key)) return false;
  if (jobRecord && !filterByUser(database.jobs, user, database).some((item) => item.key === jobRecord.key)) return false;
  return true;
}

function csvValue(value: unknown) {
  const text = Array.isArray(value) ? value.join('、') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function makeCode(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${date}-${String(Date.now()).slice(-4)}`;
}

export function createApp(store = new Store(), services?:{
  interviewProvider?:InterviewProvider;
  createLarkMeeting?:typeof createLarkMeeting;
  getLarkMeetingResult?:typeof getLarkMeetingResult;
  testLarkConnection?:typeof testLarkConnection;
}) {
  validateAuthConfiguration();
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  const interviewProvider = services?.interviewProvider || new HttpInterviewProvider();
  const larkCreateMeeting = services?.createLarkMeeting || createLarkMeeting;
  const larkGetMeetingResult = services?.getLarkMeetingResult || getLarkMeetingResult;
  const larkTestConnection = services?.testLarkConnection || testLarkConnection;
  const allowedOrigins=(process.env.CORS_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value=>value.trim());
  app.use(cors({
    credentials:true,
    origin(origin,callback){
      if(!origin||allowedOrigins.includes(origin))callback(null,true);
      else callback(new Error('不允许的跨域来源'));
    },
  }));
  app.use(cookieParser());
  app.use(express.json({
    limit: '2mb',
    verify: (request, _response, buffer) => {
      (request as Request & { rawBody?: Buffer }).rawBody = buffer;
    },
  }));

  app.get('/api/health', async (_request, response) => {
    const database = await store.read();
    response.json({
      status: 'ok',
      service: 'zhimian-ats-api',
      databaseVersion: database.metadata.version,
      updatedAt: database.metadata.updatedAt,
    });
  });

  app.post('/api/auth/login', async (request, response) => {
    const username = String(request.body.username || '');
    const password = String(request.body.password || '');
    const account = developmentUsers().find((item) => item.username === username);
    if (!account || !verifyPassword(password, account.passwordHash)) {
      response.status(401).json({ message: '账号或密码错误' });
      return;
    }
    const { passwordHash: _passwordHash, username: _username, ...user } = account;
    setSessionCookie(response, user);
    response.json({ data: user });
  });

  app.post('/api/auth/logout', (_request, response) => {
    clearSessionCookie(response);
    response.status(204).send();
  });

  app.post('/api/webhooks/interview-provider', async (request, response) => {
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(request.body));
    if (!verifyProviderWebhook(rawBody, request.header('x-provider-signature'), request.header('x-provider-timestamp'))) {
      response.status(401).json({ message: 'Webhook 签名无效' });
      return;
    }
    const eventId = String(request.body.eventId || request.body.event_id || '');
    const providerInterviewId = String(request.body.providerInterviewId || request.body.interviewId || request.body.data?.providerInterviewId || '');
    if (!eventId || !providerInterviewId) {
      response.status(400).json({ message: 'Webhook 缺少 eventId 或 providerInterviewId' });
      return;
    }
    const database = await store.read();
    if (database.metadata.processedEventIds?.includes(eventId)) {
      response.json({ data: { accepted: true, duplicate: true } });
      return;
    }
    const interview = database.interviews.find((item) => item.providerInterviewId === providerInterviewId);
    if (!interview) {
      response.status(404).json({ message: '未找到对应面试记录' });
      return;
    }
    const result = request.body.data || request.body;
    await store.update((current) => {
      const target = current.interviews.find((item) => item.key === interview.key);
      if (target) {
        Object.assign(target, {
          providerStatus: result.status,
          status: result.status === 'COMPLETED' ? '待审核' : target.status,
          score: result.score ?? target.score,
          resultSummary: result.summary ?? target.resultSummary,
          transcriptUrl: result.transcriptUrl ?? target.transcriptUrl,
          recordingUrl: result.recordingUrl ?? target.recordingUrl,
          dimensions: result.dimensions ?? target.dimensions,
          updated: new Date().toISOString(),
        });
      }
      current.metadata.processedEventIds = [...(current.metadata.processedEventIds || []).slice(-999), eventId];
    });
    response.json({ data: { accepted: true } });
  });

  app.use('/api', authenticate);

  app.get('/api/auth/me', (request, response) => {
    response.json({ data: request.user });
  });

  app.post('/api/resumes/parse', requireWritable, upload.single('file'), async (request, response) => {
    if (!request.file) {
      response.status(400).json({ message: '请上传简历文件' });
      return;
    }
    const result = await parseResume(request.file);
    response.json({ data: result.data || result.result || result });
  });

  app.get('/api/bootstrap', async (request, response) => {
    const database = await store.read();
    const result = Object.fromEntries(
      collectionNames.map((name) => [name, filterByUser(database[name], request.user!, database)]),
    );
    response.json({ data: { ...result, settings: publicSettings(database.settings), metadata: database.metadata, user: request.user } });
  });

  app.get('/api/dashboard', async (request, response) => {
    const database = await store.read();
    const scopedInterviews = filterByUser(database.interviews, request.user!, database);
    const scopedProjects = filterByUser(database.projects, request.user!, database);
    const scopedJobs = filterByUser(database.jobs, request.user!, database);
    response.json({
      data: {
        metrics: {
          interviews: scopedInterviews.length,
          activeProjects: scopedProjects.filter((item) => item.status === '进行中').length,
          activeJobs: scopedJobs.filter((item) => item.status === '招聘中').length,
          completedInterviews: scopedInterviews.filter((item) => ['待审核', '通过', '下一轮'].includes(String(item.status))).length,
          exceptions: scopedInterviews.filter((item) => item.risk).length,
        },
        projects: scopedProjects,
        jobs: scopedJobs,
        interviews: scopedInterviews,
      },
    });
  });

  app.get('/api/search', async (request, response) => {
    const keyword = String(request.query.q || '').trim();
    if (!keyword) {
      response.json({ data: { projects: [], jobs: [], candidates: [], interviews: [] } });
      return;
    }
    const database = await store.read();
    const scoped = (name: CollectionName) => filterByUser(database[name], request.user!, database);
    response.json({
      data: {
        projects: scoped('projects').filter((item) => contains(item, keyword)).slice(0, 5),
        jobs: scoped('jobs').filter((item) => contains(item, keyword)).slice(0, 5),
        candidates: scoped('candidates').filter((item) => contains(item, keyword)).slice(0, 5),
        interviews: scoped('interviews').filter((item) => contains(item, keyword)).slice(0, 5),
      },
    });
  });

  app.get('/api/settings', async (_request, response) => {
    response.json({ data: publicSettings((await store.read()).settings) });
  });

  app.patch('/api/settings', requireAdmin, async (request, response) => {
    const { feishuSecret: _secret, ...safeInput } = request.body;
    const database = await store.update((current) => {
      const { feishuSecret: _existingSecret, ...safeCurrent } = current.settings;
      current.settings = { ...safeCurrent, ...safeInput };
    });
    response.json({ data: publicSettings(database.settings) });
  });

  app.post('/api/integrations/feishu/test', requireAdmin, async (_request, response) => {
    response.json({ data: await larkTestConnection() });
  });

  app.post('/api/integrations/notifications/test', requireAdmin, async (_request, response) => {
    response.json({data:await testNotificationProvider()});
  });

  app.get('/api/exports/:resource', async (request, response) => {
    const collection = collectionFromRequest(request);
    const database = await store.read();
    const records = filterByUser(database[collection], request.user!, database);
    const fields = [...new Set(records.flatMap((record) => Object.keys(record)))];
    const csv = [
      fields.map(csvValue).join(','),
      ...records.map((record) => fields.map((field) => csvValue(record[field])).join(',')),
    ].join('\n');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${collection}.csv"`);
    response.send(`\uFEFF${csv}`);
  });

  app.post('/api/admin/reset', requireAdmin, async (_request, response) => {
    response.json({ data: await store.reset() });
  });

  app.get('/api/:resource', async (request, response) => {
    const collection = collectionFromRequest(request);
    const database = await store.read();
    const keyword = String(request.query.q || '').trim();
    let records = filterByUser(database[collection], request.user!, database);
    if (keyword) records = records.filter((record) => contains(record, keyword));
    for (const [field, value] of Object.entries(request.query)) {
      if (field === 'q' || value === undefined || value === '') continue;
      records = records.filter((record) => String(record[field] ?? '').includes(String(value)));
    }
    response.json({ data: records, total: records.length });
  });

  app.get('/api/:resource/:key', async (request, response) => {
    const collection = collectionFromRequest(request);
    const database = await store.read();
    const record = filterByUser(database[collection], request.user!, database).find((item) => item.key === routeParam(request, 'key'));
    if (!record) {
      response.status(404).json({ message: '记录不存在' });
      return;
    }
    response.json({ data: record });
  });

  app.post('/api/interviews/invite', requireWritable, async (request, response) => {
    const {
      candidateKeys, project, job, expiresInHours = 48, questionBankId, scoreTemplateId,
    } = request.body as {
      candidateKeys?: string[];
      project?: string;
      job?: string;
      expiresInHours?: number;
      questionBankId?: string;
      scoreTemplateId?: string;
    };
    if (!candidateKeys?.length || !project || !job) {
      response.status(400).json({ message: '候选人、项目和岗位不能为空' });
      return;
    }
    const database = await store.read();
    const selected = filterByUser(database.candidates, request.user!, database)
      .filter((item) => candidateKeys.includes(item.key));
    if (selected.length !== candidateKeys.length || !canUseScope(database, request.user!, project, job)) {
      response.status(403).json({ message: '候选人、项目或岗位不在当前账号的数据范围内' });
      return;
    }
    const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();
    const callbackUrl = `${process.env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'}/api/webhooks/interview-provider`;
    const created = [];
    for (const candidate of selected) {
      const code = makeCode('ZM-IV');
      const provider = await interviewProvider.create({
        requestId: code,
        candidate: {
          id: candidate.key,
          name: String(candidate.name),
          mobile: candidate.contact ? String(candidate.contact) : undefined,
          email: candidate.email ? String(candidate.email) : undefined,
        },
        project,
        job,
        questionBankId,
        scoreTemplateId,
        expiresAt,
        callbackUrl,
        metadata: { atsInterviewCode: code, operatorId: request.user!.id },
      });
      const record = await store.create('interviews', {
        code,
        candidate: candidate.name,
        candidateKey: candidate.key,
        project,
        job,
        round: '首轮 AI 面试',
        owner: request.user!.name,
        providerInterviewId: provider.providerInterviewId,
        interviewUrl: provider.interviewUrl,
        providerStatus: provider.status,
        expiresAt: provider.expiresAt || expiresAt,
        linkStatus: '已生成',
        status: '待面试',
        online: '离线',
        remaining: `${expiresInHours}:00`,
        score: 0,
        notificationStatus: 'NOT_CONFIGURED',
      });
      if (process.env.NOTIFICATION_PROVIDER_BASE_URL && process.env.NOTIFICATION_PROVIDER_API_KEY) {
        try {
          await sendInterviewNotification({
            candidate: {
              name: String(candidate.name),
              mobile: candidate.contact ? String(candidate.contact) : undefined,
              email: candidate.email ? String(candidate.email) : undefined,
            },
            interviewUrl: provider.interviewUrl,
            expiresAt: provider.expiresAt || expiresAt,
            job,
            channels: Array.isArray(request.body.channels) ? request.body.channels : ['sms', 'email'],
          });
          Object.assign(record, { notificationStatus: 'SENT' });
          await store.patch('interviews', record.key, record);
        } catch {
          Object.assign(record, { notificationStatus: 'FAILED' });
          await store.patch('interviews', record.key, record);
        }
      }
      created.push(record);
    }
    response.status(201).json({ data: created });
  });

  app.post('/api/interviews/:key/reissue', requireWritable, async (request, response) => {
    const current = await scopedRecord(store, request, 'interviews', routeParam(request, 'key'));
    if (!current?.providerInterviewId) {
      response.status(404).json({ message: '面试记录不存在' });
      return;
    }
    const expiresAt = new Date(Date.now() + Number(request.body.expiresInHours || 48) * 3600000).toISOString();
    const provider = await interviewProvider.regenerate(String(current.providerInterviewId), expiresAt);
    await store.patch('interviews', current.key, { linkStatus: '已失效', status: '已废弃' });
    const created = await store.create('interviews', {
      ...current,
      key: undefined,
      code: makeCode('ZM-IV'),
      previousInterviewKey: current.key,
      providerInterviewId: provider.providerInterviewId,
      interviewUrl: provider.interviewUrl,
      expiresAt: provider.expiresAt || expiresAt,
      providerStatus: provider.status,
      linkStatus: '已生成',
      status: '待面试',
      risk: '',
    });
    response.status(201).json({ data: created });
  });

  app.post('/api/interviews/:key/control', requireWritable, async (request, response) => {
    const current = await scopedRecord(store, request, 'interviews', routeParam(request, 'key'));
    if (!current?.providerInterviewId) {
      response.status(404).json({ message: '面试记录或 Provider ID 不存在' });
      return;
    }
    const action = String(request.body.action || '');
    if (!['pause', 'resume', 'extend', 'finish', 'cancel'].includes(action)) {
      response.status(400).json({ message: '不支持的面试控制动作' });
      return;
    }
    await interviewProvider.control(String(current.providerInterviewId), action, request.body.value);
    const updated = await store.patch('interviews', current.key, {
      providerStatus: action.toUpperCase(),
      status: action === 'finish' ? '待审核' : action === 'cancel' ? '已废弃' : current.status,
    });
    response.json({ data: updated });
  });

  app.post('/api/interviews/:key/sync-result', requireWritable, async (request, response) => {
    const current = await scopedRecord(store, request, 'interviews', routeParam(request, 'key'));
    if (!current?.providerInterviewId) {
      response.status(404).json({ message: '面试记录或 Provider ID 不存在' });
      return;
    }
    const result = await interviewProvider.getResult(String(current.providerInterviewId));
    const updated = await store.patch('interviews', current.key, {
      providerStatus: result.status,
      status: result.status === 'COMPLETED' ? '待审核' : current.status,
      score: result.score ?? current.score,
      resultSummary: result.summary,
      transcriptUrl: result.transcriptUrl,
      recordingUrl: result.recordingUrl,
      dimensions: result.dimensions,
    });
    response.json({ data: updated });
  });

  app.post('/api/interviews/:key/review', requireWritable, async (request, response) => {
    const { decision, comment = '' } = request.body as { decision?: string; comment?: string };
    const status = decision === 'reject' ? '已驳回' : decision === 'direct-pass' ? '通过' : '下一轮';
    const current=await scopedRecord(store,request,'interviews',routeParam(request,'key'));
    const updated = current&&await store.patch('interviews', current.key, { status, reviewComment: comment });
    if (!updated) {
      response.status(404).json({ message: '面试记录不存在' });
      return;
    }
    response.json({ data: updated });
  });

  app.post('/api/interviews/:key/complete', requireWritable, async (request, response) => {
    const current=await scopedRecord(store,request,'interviews',routeParam(request,'key'));
    const updated = current&&await store.patch('interviews', current.key, {
      status: String(request.body.finalResult || '最终通过'),
      finalComment: String(request.body.comment || ''),
      linkStatus: '已完成',
    });
    if (!updated) {
      response.status(404).json({ message: '面试记录不存在' });
      return;
    }
    response.json({ data: updated });
  });

  app.post('/api/meetings', requireWritable, async (request, response) => {
    const { candidate, project, job, scheduledAt, interviewers, duration = 60 } = request.body as {
      candidate?: string;
      project?: string;
      job?: string;
      scheduledAt?: string;
      interviewers?: string[];
      duration?: number;
    };
    if (!candidate || !project || !job || !scheduledAt || !interviewers?.length) {
      response.status(400).json({ message: '会议参数不完整' });
      return;
    }
    const database=await store.read();
    const candidateAllowed=filterByUser(database.candidates,request.user!,database).some(item=>item.name===candidate);
    if(!candidateAllowed||!canUseScope(database,request.user!,project,job)){
      response.status(403).json({message:'候选人、项目或岗位不在当前账号的数据范围内'});
      return;
    }
    const hostMap = JSON.parse(process.env.LARK_HOST_MAP_JSON || '{}') as Record<string, string>;
    const meeting = await larkCreateMeeting({
      topic: `${candidate} · ${job} · 二轮人工面试`,
      startTime:new Date(scheduledAt).toISOString(),
      endTime: new Date(new Date(scheduledAt).getTime() + duration * 60000).toISOString(),
      autoRecord: true,
      hostOpenIds: interviewers.map((name) => hostMap[name]).filter(Boolean),
    });
    const record = await store.create('interviews', {
      code: makeCode('ZM-IV'),
      candidate,
      project,
      job,
      round: '二轮人工面试',
      owner: interviewers.join('、'),
      linkStatus: '已发送',
      status: '待面试',
      online: '离线',
      remaining: `${duration}:00`,
      score: 0,
      reserveId: meeting.reserveId,
      meetingNo: meeting.meetingNo,
      meetingUrl: meeting.meetingUrl,
      meetingPassword: meeting.password,
      calendarEventId:meeting.calendarEventId,
      scheduledAt,
      interviewers,
      provider: '飞书视频会议',
      syncStatus: '等待面试',
    });
    response.status(201).json({ data: record });
  });

  app.post('/api/meetings/:key/sync', requireWritable, async (request, response) => {
    const current = await scopedRecord(store, request, 'interviews', routeParam(request, 'key'));
    if (!current) {
      response.status(404).json({ message: '会议记录不存在' });
      return;
    }
    const result = await larkGetMeetingResult({
      meetingId: current.meetingId ? String(current.meetingId) : undefined,
      meetingNo: current.meetingNo ? String(current.meetingNo) : undefined,
    });
    const updated = await store.patch('interviews', routeParam(request, 'key'), {
      meetingId: result.meetingId,
      status: result.meeting?.status === 2 ? '待审核' : current.status,
      linkStatus: result.meeting?.status === 2 ? '已完成' : current.linkStatus,
      syncStatus: '已同步',
      recordingUrl: result.recording?.url,
      transcriptUrl: result.meeting?.note_id ? `https://minutes.feishu.cn/minutes/${result.meeting.note_id}` : undefined,
      resultSummary: result.meeting?.status === 2 ? '飞书会议已结束，会议详情和录制信息已同步。' : '飞书会议详情已同步。',
    });
    response.json({ data: updated });
  });

  app.post('/api/:resource', requireWritable, async (request, response) => {
    const collection = collectionFromRequest(request);
    if (['projects', 'users', 'auditLogs'].includes(collection) && request.user!.role !== '超级管理员') {
      response.status(403).json({ message: '当前角色无权修改该资源' });
      return;
    }
    if(request.user!.role!=='超级管理员'){
      const database=await store.read();
      if(!canUseScope(database,request.user!,request.body.project,request.body.job)){
        response.status(403).json({message:'新记录不在当前账号的数据范围内'});
        return;
      }
    }
    const prefixes:Partial<Record<CollectionName,string>>={
      projects:'ZM-PJ',jobs:'ZM-JD',interviews:'ZM-IV',candidates:'ZM-CA',
      questions:'ZM-QS',approvals:'ZM-AP',notifications:'ZM-NT',downloads:'ZM-EX',
    };
    const created = await store.create(collection, {
      ...(prefixes[collection]&&!request.body.code?{code:makeCode(prefixes[collection]!)}:{}),
      ...request.body,
    });
    if(collection!=='auditLogs'){
      await store.create('auditLogs',{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),user:request.user!.name,role:request.user!.role,module:collection,action:'创建',object:String(created.name||created.code||created.key),summary:'通过 ATS API 创建记录',ip:request.ip,result:'成功'});
    }
    response.status(201).json({ data: created });
  });

  app.patch('/api/:resource/:key', requireWritable, async (request, response) => {
    const collection=collectionFromRequest(request);
    const database = await store.read();
    const allowed = filterByUser(database[collection], request.user!, database)
      .some((item) => item.key === routeParam(request, 'key'));
    const current = database[collection].find((item) => item.key === routeParam(request, 'key'));
    const target = { ...current, ...request.body };
    if (
      !allowed
      || (['users', 'auditLogs'].includes(collection) && request.user!.role !== '超级管理员')
      || !canUseScope(database, request.user!, target.project, target.job)
    ) {
      response.status(403).json({ message: '记录不在当前账号的数据范围内' });
      return;
    }
    const updated = await store.patch(collection, routeParam(request, 'key'), request.body);
    if (!updated) {
      response.status(404).json({ message: '记录不存在' });
      return;
    }
    if(collection!=='auditLogs'){
      await store.create('auditLogs',{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),user:request.user!.name,role:request.user!.role,module:collection,action:'更新',object:String(updated.name||updated.code||updated.key),summary:'通过 ATS API 更新记录',ip:request.ip,result:'成功'});
    }
    response.json({ data: updated });
  });

  app.delete('/api/:resource/:key', requireWritable, async (request, response) => {
    const collection=collectionFromRequest(request);
    const key=routeParam(request,'key');
    const database=await store.read();
    const current=filterByUser(database[collection],request.user!,database).find(item=>item.key===key);
    if(!current || (['users','auditLogs'].includes(collection)&&request.user!.role!=='超级管理员')){
      response.status(403).json({message:'记录不在当前账号的数据范围内'});
      return;
    }
    const removed = await store.remove(collection,key);
    if (!removed) {
      response.status(404).json({ message: '记录不存在' });
      return;
    }
    if(collection!=='auditLogs'){
      await store.create('auditLogs',{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),user:request.user!.name,role:request.user!.role,module:collection,action:'删除',object:String(current?.name||current?.code||key),summary:'通过 ATS API 删除记录',ip:request.ip,result:'成功'});
    }
    response.status(204).send();
  });

  app.use((error: Error & { status?: number }, _request: Request, response: Response, _next: NextFunction) => {
    console.error(error);
    response.status(error.status || 500).json({ message: error.message || '服务器内部错误' });
  });

  return app;
}
