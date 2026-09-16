import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Drawer, Empty, Form, Input,
  List, message, Modal, Progress, Radio, Result, Row, Select, Space, Steps, Table,
  Tabs, Tag, Upload,
} from 'antd';
import {
  CheckCircleFilled, ClockCircleOutlined, InboxOutlined, LinkOutlined, PauseCircleOutlined,
  SendOutlined, VideoCameraOutlined, WarningOutlined,
} from '@ant-design/icons';
import { BusinessList, statusCol, textCol, type RecordType } from '../components/BusinessList';
import { PageHeader, StatusTag } from '../components/Common';
import { useData } from '../context/DataContext';

type InterviewRecord = RecordType & {
  code:string; candidate:string; project:string; job:string; round:string; owner:string;
  linkStatus:string; status:string; online:string; remaining:string; score:number;
  risk?:string; updated:string; meetingId?:string; meetingUrl?:string; scheduledAt?:string;
  interviewers?:string[]; syncStatus?:string; resultSummary?:string;
  interviewUrl?:string; providerInterviewId?:string; expiresAt?:string;
  transcriptUrl?:string; recordingUrl?:string; providerStatus?:string;
  dimensions?:Array<{name:string;score:number;comment?:string}>;
};

type InterviewFilterValue = {
  keyword?:string; project?:string; job?:string; owner?:string; round?:string; status?:string;
};

function InterviewFilterBar({ value, onChange, statusOptions, projects, jobs }: {
  value:InterviewFilterValue;
  onChange:(value:InterviewFilterValue)=>void;
  statusOptions:string[];
  projects:RecordType[];
  jobs:RecordType[];
}) {
  const setValue = (key:keyof InterviewFilterValue, next?:string) => onChange({...value,[key]:next});
  const availableJobs = value.project ? jobs.filter(item=>item.project===value.project) : jobs;
  return <Card className="filter-panel interview-filter"><div className="filter-grid">
    <Input.Search allowClear placeholder="候选人 / 面试编号" value={value.keyword} onChange={event=>setValue('keyword',event.target.value)} />
    <Select allowClear showSearch placeholder="项目" value={value.project} onChange={next=>onChange({...value,project:next,job:undefined})} options={projects.map(item=>({value:String(item.name),label:String(item.name)}))} />
    <Select allowClear showSearch placeholder="岗位" value={value.job} onChange={next=>setValue('job',next)} options={availableJobs.map(item=>({value:String(item.name),label:String(item.name)}))} />
    <Select allowClear placeholder="负责人" value={value.owner} onChange={next=>setValue('owner',next)} options={['许昭','唐宁','苏晚','温言'].map(name=>({value:name,label:name}))} />
    <Select allowClear placeholder="当前轮次" value={value.round} onChange={next=>setValue('round',next)} options={['首轮 AI 面试','二轮人工面试','终试','客户面'].map(name=>({value:name,label:name}))} />
    <Select allowClear placeholder="状态" value={value.status} onChange={next=>setValue('status',next)} options={statusOptions.map(name=>({value:name,label:name}))} />
    <DatePicker.RangePicker placeholder={['开始日期','结束日期']} />
    <Button onClick={()=>onChange({})}>重置</Button>
  </div></Card>;
}

function applyInterviewFilters(items:InterviewRecord[], filters:InterviewFilterValue) {
  return items.filter(item=>
    (!filters.keyword || `${item.candidate}${item.code}`.toLowerCase().includes(filters.keyword.toLowerCase())) &&
    (!filters.project || item.project===filters.project) &&
    (!filters.job || item.job===filters.job) &&
    (!filters.owner || item.owner===filters.owner) &&
    (!filters.round || item.round===filters.round) &&
    (!filters.status || `${item.status}${item.linkStatus}${item.risk || ''}`.includes(filters.status))
  );
}

export function InvitePage() {
  const navigate=useNavigate();
  const {candidates,projects,jobs,settings,inviteCandidates,createRecord,parseResume}=useData();
  const [current,setCurrent]=useState(0);
  const [selected,setSelected]=useState<React.Key[]>(candidates.slice(0,2).map(item=>item.key));
  const [project,setProject]=useState(String(projects[0]?.name||''));
  const [job,setJob]=useState(String(jobs.find(item=>item.project===project)?.name||jobs[0]?.name||''));
  const [submitting,setSubmitting]=useState(false);
  const [created,setCreated]=useState<RecordType[]>([]);
  const availableJobs=jobs.filter(item=>!project||item.project===project);
  const selectedCandidates=candidates.filter(item=>selected.includes(item.key));

  const next=async()=>{
    if(current===0&&(!selected.length||!project||!job)){
      message.warning('请选择候选人、项目和岗位');
      return;
    }
    if(current!==2){
      setCurrent(value=>Math.min(3,value+1));
      return;
    }
    setSubmitting(true);
    try{
      const records=await inviteCandidates({candidateKeys:selected.map(String),project,job,owner:'许昭',expiresInHours:48});
      setCreated(records);
      setCurrent(3);
      message.success(`已成功发起 ${records.length} 个面试邀约`);
    }finally{setSubmitting(false);}
  };

  return <div>
    <PageHeader title="发起邀约" description="为候选人配置首轮 AI 面试并发送唯一链接" />
    <Card className="steps-shell"><Steps current={current} items={['选择候选人与岗位','配置面试','确认通知','发起结果'].map(title=>({title}))} /></Card>
    <Card className="invite-card">
      {current===0&&<div><div className="section-title"><h2>选择候选人与岗位</h2><span>已选择 {selected.length} 人</span></div>
        <div className="resume-upload"><Upload.Dragger disabled={!settings.resumeParserConfigured} multiple accept=".pdf,.doc,.docx" beforeUpload={async file=>{
          const parsed=await parseResume(file);
          await createRecord('candidates',{
            name:parsed.name||file.name.replace(/\.[^.]+$/,''),contact:parsed.mobile||parsed.phone||'待补充',
            email:parsed.email||'待补充',project,job,pool:'待补充',status:'可邀约',owner:'待分配',
            resumeData:parsed,
          });
          message.success(`${file.name} 已解析并创建候选人`);
          return false;
        }} showUploadList={false}><Space size={10} className="resume-upload-content"><InboxOutlined /><b>{settings.resumeParserConfigured?'上传简历并解析':'简历解析服务未配置'}</b><span>{settings.resumeParserConfigured?'支持 PDF、DOC、DOCX':'配置 RESUME_PARSER_* 后启用'}</span><Tag>{settings.resumeParserConfigured?'可用':'不可用'}</Tag></Space></Upload.Dragger></div>
        <div className="filter-grid"><Input.Search placeholder="姓名 / 手机号 / 邮箱" /><Select value={project} placeholder="选择项目" onChange={value=>{setProject(value);setJob('');}} options={projects.map(item=>({value:String(item.name),label:String(item.name)}))} /><Select value={job||undefined} placeholder="选择岗位" onChange={setJob} options={availableJobs.map(item=>({value:String(item.name),label:String(item.name)}))} /></div>
        <Table rowSelection={{selectedRowKeys:selected,onChange:setSelected}} pagination={{pageSize:6}} dataSource={candidates} columns={[
          {title:'候选人',dataIndex:'name'},{title:'手机号',dataIndex:'contact'},{title:'邮箱',dataIndex:'email'},
          {title:'目标岗位',dataIndex:'job'},{title:'状态',dataIndex:'status',render:(value)=><StatusTag status={String(value)} />},
        ]} /></div>}
      {current===1&&<Form layout="vertical" className="form-grid">
        <Form.Item label="面试题库" required><Select defaultValue="云产品支持工程师题库 V3.2" options={[{value:'云产品支持工程师题库 V3.2',label:'云产品支持工程师题库 V3.2'}]} /></Form.Item>
        <Form.Item label="评分模板" required><Select defaultValue="技术支持综合能力 V2.1" options={[{value:'技术支持综合能力 V2.1',label:'技术支持综合能力 V2.1'}]} /></Form.Item>
        <Form.Item label="链接有效期"><Input value="48 小时（固定）" disabled /></Form.Item>
        <Form.Item label="身份认证"><Checkbox defaultChecked>候选人访问时进行手机号认证</Checkbox></Form.Item>
        <Form.Item label="短信模板"><Select defaultValue="AI 面试邀约通知" options={[{value:'AI 面试邀约通知',label:'AI 面试邀约通知'}]} /></Form.Item>
        <Form.Item label="邮件模板"><Select defaultValue="标准面试邀请邮件" options={[{value:'标准面试邀请邮件',label:'标准面试邀请邮件'}]} /></Form.Item>
        <Form.Item label="发送时间"><Radio.Group defaultValue="now"><Radio value="now">立即发送</Radio><Radio value="later">定时发送</Radio></Radio.Group></Form.Item>
      </Form>}
      {current===2&&<Row gutter={20}><Col span={15}><Card size="small" title="接收人清单"><List dataSource={selectedCandidates} renderItem={item=><List.Item><Space><CheckCircleFilled className="success-icon" /><b>{String(item.name)}</b><span>{String(item.contact)}</span><Tag>{job}</Tag></Space></List.Item>} /></Card></Col><Col span={9}><Card size="small" title="本次邀约摘要"><Descriptions column={1} size="small"><Descriptions.Item label="候选人数">{selected.length} 人</Descriptions.Item><Descriptions.Item label="短信">{selected.length} 条</Descriptions.Item><Descriptions.Item label="邮件">{selected.length} 封</Descriptions.Item><Descriptions.Item label="链接有效期">48 小时</Descriptions.Item><Descriptions.Item label="目标岗位">{job}</Descriptions.Item></Descriptions></Card></Col></Row>}
      {current===3&&<Result status="success" title="面试链接已生成" subTitle={`成功 ${created.length} 人。通知发送需要另行配置短信或邮件 Provider。`} extra={[<Button type="primary" key="process" onClick={()=>navigate('/interviews/process')}>查看进程</Button>,<Button key="again" onClick={()=>{setCurrent(0);setCreated([]);}}>继续发起</Button>]}>{created.map(item=><p key={item.key}><Tag>{String(item.code)}</Tag><a href={String(item.interviewUrl)} target="_blank" rel="noreferrer">{String(item.interviewUrl)}</a></p>)}</Result>}
      {current<3&&<div className="step-actions"><Button disabled={current===0} onClick={()=>setCurrent(value=>value-1)}>上一步</Button><Button loading={submitting} type="primary" icon={current===2?<SendOutlined />:undefined} onClick={()=>void next()}>{current===2?'确认并发起':'下一步'}</Button></div>}
    </Card>
  </div>;
}

export function ProcessPage() {
  const {interviews,controlInterview,syncInterviewResult}=useData();
  const records=interviews as InterviewRecord[];
  const [monitor,setMonitor]=useState<InterviewRecord>();
  const control=async(action:string,value?:number)=>{
    if(!monitor)return;
    const updated=await controlInterview(monitor.key,action,value);
    setMonitor(updated as InterviewRecord);
    message.success('面试平台已接受操作');
  };
  const columns=[
    {...textCol('面试编号','code',190),fixed:'left' as const},
    {title:'候选人',dataIndex:'candidate',width:110},textCol('项目 / 岗位','job',190),
    textCol('当前轮次','round',120),textCol('负责人','owner',90),statusCol('链接状态','linkStatus',100),
    statusCol('面试状态','status',100),{title:'在线状态',dataIndex:'online',width:90,render:(value:string)=><Tag color={value==='在线'?'green':'default'}>{value}</Tag>},
    {title:'剩余时间',dataIndex:'remaining',width:90},{title:'评分进度',dataIndex:'score',width:130,render:(value:number)=><Progress percent={value} size="small" />},
    {title:'异常',dataIndex:'risk',width:130,render:(value:string)=><span className="danger-text">{value&&<><WarningOutlined /> {value}</>}</span>},
  ];
  return <><BusinessList collection="interviews" title="进程管理" description="实时跟踪面试、链接、评分和异常状态" stats={[
    {label:'已发送',value:records.filter(item=>item.linkStatus==='已发送').length},{label:'待面试',value:records.filter(item=>item.status==='待面试').length},
    {label:'面试中',value:records.filter(item=>item.status==='面试中').length,tone:'green'},{label:'待审核',value:records.filter(item=>item.status==='待审核').length,tone:'orange'},
    {label:'异常',value:records.filter(item=>item.risk).length,tone:'red'},
  ]} data={records} columns={columns} primaryAction="新建面试" filterNames={['候选人 / 面试编号','项目','岗位','招聘专员','当前轮次','面试状态','链接状态']} headerExtra={<Button icon={<VideoCameraOutlined />} onClick={()=>setMonitor(records.find(item=>item.status==='面试中')||records[0])}>实时监控</Button>} />
    <Drawer open={!!monitor} onClose={()=>setMonitor(undefined)} width={720} title={`实时监控 · ${monitor?.candidate}`} extra={<StatusTag status={monitor?.status||'待面试'} />}>
      <div className="monitor-stage"><VideoCameraOutlined /><b>实时画面由面试 Provider 提供</b><span>{monitor?.providerInterviewId||'当前记录未绑定 Provider'}</span></div>
      <Row gutter={12} className="monitor-stats"><Col span={8}><Card size="small"><span>Provider 状态</span><b>{String(monitor?.providerStatus||'未知')}</b></Card></Col><Col span={8}><Card size="small"><span>过期时间</span><b>{monitor?.expiresAt||'--'}</b></Card></Col><Col span={8}><Card size="small"><span>AI 分析</span><b>{monitor?.status}</b></Card></Col></Row>
      {monitor?.interviewUrl&&<Card size="small" title="候选人面试链接"><a href={monitor.interviewUrl} target="_blank" rel="noreferrer">{monitor.interviewUrl}</a></Card>}
      {monitor?.risk&&<Alert type="warning" showIcon message={monitor.risk} />}
      <Divider titlePlacement="start">Provider 操作</Divider><Space><Button icon={<PauseCircleOutlined />} onClick={()=>void control('pause')}>暂停面试</Button><Button icon={<ClockCircleOutlined />} onClick={()=>void control('extend',10)}>延长 10 分钟</Button><Button danger onClick={()=>void control('finish')}>结束面试</Button><Button onClick={async()=>{if(!monitor)return;setMonitor(await syncInterviewResult(monitor.key) as InterviewRecord);}}>同步结果</Button></Space>
    </Drawer>
  </>;
}

export function ExceptionPage() {
  const {interviews,projects,jobs,reissueInterview}=useData();
  const records=interviews as InterviewRecord[];
  const [tab,setTab]=useState('全部异常');
  const [filters,setFilters]=useState<InterviewFilterValue>({});
  const [detail,setDetail]=useState<InterviewRecord>();
  const data=useMemo(()=>{
    const risky=applyInterviewFilters(records.filter(item=>item.risk),filters);
    return tab==='全部异常'?risky:risky.filter(item=>`${item.linkStatus}${item.risk}`.includes(tab));
  },[filters,records,tab]);
  return <div><PageHeader title="废弃与异常" description="处理链接失效、发送失败和 AI 结果异常" />
    <InterviewFilterBar value={filters} onChange={setFilters} projects={projects} jobs={jobs} statusOptions={['已过期','发送失败','面试中断','结果回传失败','评分异常']} />
    <Card><Tabs activeKey={tab} onChange={setTab} items={['全部异常','已过期','发送失败','面试中断','结果回传失败','评分异常'].map(label=>({key:label,label}))} />
      <Table dataSource={data} columns={[textCol('面试编号','code',190),textCol('候选人','candidate'),textCol('项目 / 岗位','job',220),statusCol('链接状态','linkStatus'),textCol('异常原因','risk',180),textCol('操作人','owner'),{title:'操作',render:(_,record:InterviewRecord)=><Space><Button type="link" onClick={()=>setDetail(record)}>查看详情</Button><Button type="primary" size="small" icon={<LinkOutlined />} onClick={()=>Modal.confirm({title:'重新发起面试链接？',content:'将生成全新链接并保留原记录。',okText:'确认重新发起',onOk:async()=>{await reissueInterview(record.key);message.success('新链接已生成');}})}>重新发起</Button></Space>}]} /></Card>
    <Drawer open={!!detail} onClose={()=>setDetail(undefined)} title={`异常详情 · ${detail?.candidate}`}><Descriptions bordered column={1}>{Object.entries(detail||{}).filter(([key])=>key!=='key').map(([key,value])=><Descriptions.Item key={key} label={key}>{String(value)}</Descriptions.Item>)}</Descriptions></Drawer>
  </div>;
}

export function ReviewPage() {
  const {interviews,projects,jobs,reviewInterview}=useData();
  const records=interviews as InterviewRecord[];
  const [detail,setDetail]=useState<InterviewRecord>();
  const [filters,setFilters]=useState<InterviewFilterValue>({});
  const [comment,setComment]=useState('');
  const items=useMemo(()=>applyInterviewFilters(records.filter(item=>item.status==='待审核'),filters),[filters,records]);
  const review=async(decision:string)=>{
    if(!detail)return;
    await reviewInterview(detail.key,{decision,comment});
    message.success(decision==='reject'?'已驳回并释放公海':'审核结果已提交');
    setDetail(undefined);
    setComment('');
  };
  return <div><PageHeader title="待审核" description="审核 AI 面试结果并推进候选人流程" />
    <InterviewFilterBar value={filters} onChange={setFilters} projects={projects} jobs={jobs} statusOptions={['待审核','存在风险']} />
    {items.length?<Row gutter={[14,14]}>{items.map(item=><Col span={8} key={item.key}><Card className="candidate-card" hoverable onClick={()=>setDetail(item)}><div className="candidate-top"><div className="candidate-avatar">{item.candidate.slice(-1)}</div><div><h3>{item.candidate}</h3><p>{item.job}</p></div><b className="score">{item.score}</b></div><Divider /><Space wrap><StatusTag status={item.providerStatus||item.status} />{item.risk&&<Tag color="red">{item.risk}</Tag>}<Tag>{item.round}</Tag></Space><div className="candidate-meta"><span>完成于 {item.updated}</span><span>待审核</span></div></Card></Col>)}</Row>:<Result status="success" title="当前没有待审核记录" />}
    <Drawer open={!!detail} onClose={()=>setDetail(undefined)} width="88%" title={`候选人审核 · ${detail?.candidate}`}><Row gutter={24}><Col span={15}><Tabs items={[
      {key:'summary',label:'AI 摘要',children:<Card>{detail?.resultSummary?<Alert type="info" showIcon message="面试平台结果摘要" description={detail.resultSummary}/>:<Result status="info" title="面试平台尚未回传摘要"/>}</Card>},
      {key:'transcript',label:'面试转写',children:<Card>{detail?.transcriptUrl?<a href={detail.transcriptUrl} target="_blank" rel="noreferrer">打开转写结果</a>:<Empty description="暂无转写结果"/>}</Card>},
      {key:'recording',label:'录音录像',children:<Card>{detail?.recordingUrl?<a href={detail.recordingUrl} target="_blank" rel="noreferrer">打开录音录像</a>:<Empty description="暂无录音录像"/>}</Card>},
    ]} /></Col><Col span={9}><Card title="分项评分"><List locale={{emptyText:'面试平台尚未回传分项评分'}} dataSource={Array.isArray(detail?.dimensions)?detail.dimensions:[]} renderItem={(item:{name:string;score:number})=><List.Item><span>{item.name}</span><Progress percent={Number(item.score)} style={{width:160}} /></List.Item>} /><Divider /><Input.TextArea value={comment} onChange={event=>setComment(event.target.value)} rows={4} placeholder="填写审核意见" /><Space direction="vertical" style={{width:'100%',marginTop:14}}><Button block type="primary" onClick={()=>void review('next')}>通过并进入下一轮</Button><Button block onClick={()=>void review('direct-pass')}>直接通过</Button><Button block danger onClick={()=>void review('reject')}>驳回并释放公海</Button></Space></Card></Col></Row></Drawer>
  </div>;
}

export function PassedPage() {
  const navigate=useNavigate();
  const {interviews,createMeeting,syncMeeting,completeInterview}=useData();
  const records=interviews as InterviewRecord[];
  const [target,setTarget]=useState<InterviewRecord>();
  const [decision,setDecision]=useState<'complete'|'second'>('second');
  const [submitting,setSubmitting]=useState(false);
  const [meeting,setMeeting]=useState<InterviewRecord>();
  const [form]=Form.useForm();
  const close=()=>{setTarget(undefined);setMeeting(undefined);setDecision('second');form.resetFields();};
  const submit=async()=>{
    if(!target)return;
    setSubmitting(true);
    try{
      if(decision==='complete'){
        const values=await form.validateFields(['finalResult','comment']);
        await completeInterview(target.key,values);
        message.success(`${target.candidate}的最终结果已写入台账`);
        close();
        return;
      }
      const values=await form.validateFields(['scheduledAt','interviewers','duration']);
      const created=await createMeeting({candidate:target.candidate,project:target.project,job:target.job,scheduledAt:values.scheduledAt.format('YYYY-MM-DD HH:mm'),interviewers:values.interviewers,duration:values.duration});
      setMeeting(created as InterviewRecord);
      message.success('飞书会议已创建，二轮面试已写入台账');
    }finally{setSubmitting(false);}
  };
  const syncResult=async()=>{
    if(!meeting)return;
    setSubmitting(true);
    try{
      setMeeting(await syncMeeting(meeting.key) as InterviewRecord);
      message.success('飞书会议详情及可用的录制、妙记信息已同步');
    }finally{setSubmitting(false);}
  };
  const passed=records.filter(item=>item.score>80).map(item=>({...item,status:item.round==='客户面'?'待评估':'待决定'}));
  return <><BusinessList collection="interviews" title="面试通过" description="评估是否结束流程，或创建飞书视频会议发起二轮人工面试" stats={[{label:'待评估',value:passed.length},{label:'待二轮面试',value:records.filter(item=>item.round==='二轮人工面试'&&item.status==='待面试').length},{label:'等待飞书回传',value:records.filter(item=>item.syncStatus==='等待面试').length},{label:'面试完成',value:records.filter(item=>/通过|完成/.test(item.status)).length,tone:'green'}]} data={passed} columns={[textCol('候选人','candidate'),textCol('项目 / 岗位','job',220),textCol('当前轮次','round'),{title:'AI 总分',dataIndex:'score',width:100},statusCol(),textCol('负责人','owner'),textCol('更新时间','updated')]} primaryAction="新建面试" filterNames={['候选人 / 面试编号','项目','岗位','负责人','当前轮次','通过状态']} rowActions={record=><Button type="link" size="small" icon={<VideoCameraOutlined />} onClick={()=>{setTarget(record as InterviewRecord);setDecision(Number(record.score)>=90?'complete':'second');}}>评估去向</Button>} />
    <Modal open={!!target} onCancel={close} width={760} title={`面试去向评估 · ${target?.candidate}`} footer={meeting?[
      <Button key="records" onClick={()=>{close();navigate('/records');}}>查看面试台账</Button>,
      meeting.syncStatus!=='已同步'&&<Button key="sync" loading={submitting} onClick={()=>void syncResult()}>从飞书同步会议结果</Button>,
      <Button key="done" type="primary" onClick={close}>完成</Button>,
    ]:[<Button key="cancel" onClick={close}>取消</Button>,<Button key="submit" type="primary" loading={submitting} onClick={()=>void submit()}>{decision==='second'?'创建飞书会议并发起二轮':'确认完成面试'}</Button>]}>
      {meeting?<Result status="success" title="二轮飞书会议已创建" subTitle={`${meeting.scheduledAt} · ${(meeting.interviewers||[]).join('、')}`} extra={<Space><Button type="primary" href={meeting.meetingUrl} target="_blank" icon={<LinkOutlined />}>打开飞书会议</Button><StatusTag status={meeting.syncStatus||'等待面试'} /></Space>}><Descriptions bordered size="small" column={1}><Descriptions.Item label="预约 ID">{String(meeting.reserveId||'--')}</Descriptions.Item><Descriptions.Item label="会议号">{String(meeting.meetingNo||'--')}</Descriptions.Item><Descriptions.Item label="会议链接">{meeting.meetingUrl}</Descriptions.Item><Descriptions.Item label="台账编号">{meeting.code}</Descriptions.Item>{meeting.resultSummary&&<Descriptions.Item label="回传结果">{meeting.resultSummary}</Descriptions.Item>}</Descriptions></Result>:<><Alert type="info" showIcon message="请选择后续流程" description={`面试平台总分 ${target?.score ?? '--'}，最终决定由审核人确认。`} />
        <Radio.Group className="decision-cards" value={decision} onChange={event=>setDecision(event.target.value)}><Radio.Button value="complete">完成面试</Radio.Button><Radio.Button value="second">发起二轮人工面试</Radio.Button></Radio.Group>
        <Form form={form} layout="vertical" initialValues={{scheduledAt:dayjs().add(1,'day').hour(14).minute(0),interviewers:['陈砚'],duration:60,finalResult:'最终通过'}}>
          {decision==='complete'?<><Form.Item name="finalResult" label="最终结果" rules={[{required:true}]}><Select options={['最终通过','进入 Offer 审批','人才储备'].map(value=>({value,label:value}))} /></Form.Item><Form.Item name="comment" label="结论说明" rules={[{required:true,message:'请填写面试结论'}]}><Input.TextArea rows={3} /></Form.Item></>:<><Row gutter={16}><Col span={12}><Form.Item name="scheduledAt" label="二轮面试时间" rules={[{required:true}]}><DatePicker showTime style={{width:'100%'}} /></Form.Item></Col><Col span={12}><Form.Item name="duration" label="会议时长" rules={[{required:true}]}><Select options={[30,45,60,90].map(value=>({value,label:`${value} 分钟`}))} /></Form.Item></Col></Row><Form.Item name="interviewers" label="二轮面试官" rules={[{required:true}]}><Select mode="multiple" options={['陈砚','梁序','顾清禾','林嘉树'].map(value=>({value,label:`${value} · 空闲`}))} /></Form.Item></>}
        </Form></>}
    </Modal>
  </>;
}
