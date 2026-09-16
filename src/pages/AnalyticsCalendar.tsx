import { useState } from 'react';
import { Area, Bar, Column, Funnel, Pie } from '@ant-design/charts';
import {
  Alert, Button, Calendar, Card, Col, DatePicker, Drawer, Form, Input,
  List, message, Modal, Progress, Radio, Row, Select, Space, Switch, Table, Tag,
} from 'antd';
import {
  CloudDownloadOutlined, ExpandOutlined, LeftOutlined, ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, StatCard, StatusTag } from '../components/Common';
import { useData } from '../context/DataContext';
import type { RecordType } from '../components/BusinessList';

type ProjectRecord=RecordType&{name:string;target:number;passed:number;progress:number;risk:string;status:string};
type JobRecord=RecordType&{name:string;project:string;hc:number;passed:number;gap:number;status:string};
type InterviewRecord=RecordType&{code:string;candidate:string;project:string;job:string;round:string;status:string;risk?:string;owner:string;updated:string};
type CalendarRecord=RecordType&{title:string;status:string;scheduledAt:string;candidate:string;interviewers:string[];provider:string};

function useDomainData(){
  const data=useData();
  return {
    ...data,
    projects:data.projects as ProjectRecord[],
    jobs:data.jobs as JobRecord[],
    interviews:data.interviews as InterviewRecord[],
    calendarEvents:data.calendarEvents as CalendarRecord[],
  };
}

function percent(value:number,total:number){return total?`${(value/total*100).toFixed(1)}%`:'0.0%';}
function buildFunnel(interviews:InterviewRecord[]){
  return [
    {stage:'已邀约',value:interviews.length},
    {stage:'已访问',value:interviews.filter(item=>!['已发送','待发送'].includes(String(item.linkStatus))).length},
    {stage:'已完成',value:interviews.filter(item=>/完成|审核|通过|下一轮/.test(item.status)).length},
    {stage:'审核通过',value:interviews.filter(item=>/通过|下一轮/.test(item.status)).length},
  ];
}
function buildRisk(interviews:InterviewRecord[]){
  const counts=new Map<string,number>();
  interviews.filter(item=>item.risk).forEach(item=>counts.set(String(item.risk),1+(counts.get(String(item.risk))||0)));
  return [...counts].map(([type,value])=>({type,value}));
}
function buildTrend(interviews:InterviewRecord[]){
  const counts=new Map<string,{date:string;邀约量:number;完成量:number}>();
  interviews.forEach(item=>{
    const date=String(item.updated||'未知').slice(0,5);
    const current=counts.get(date)||{date,邀约量:0,完成量:0};
    current.邀约量++;
    if(/完成|审核|通过|下一轮/.test(item.status))current.完成量++;
    counts.set(date,current);
  });
  return [...counts.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

export function AnalyticsPage() {
  const { pathname }=useLocation();
  const navigate=useNavigate();
  const {projects,jobs,downloadRecords}=useDomainData();
  const type=pathname.includes('projects')?'projects':pathname.includes('jobs')?'jobs':pathname.includes('interviews')?'interviews':'overview';
  const title={overview:'招聘总览',projects:'项目分析',jobs:'岗位分析',interviews:'面试分析'}[type];
  const drill=(metric:string)=>navigate(`/analytics/detail?source=${encodeURIComponent(title)}&metric=${encodeURIComponent(metric)}&date=2026-08-01_2026-09-03`);
  return <div><PageHeader title={title} description="按授权数据范围查看招聘效率、转化和质量指标" extra={<><Button icon={<CloudDownloadOutlined />} onClick={async()=>{await downloadRecords('interviews');message.success('分析明细已导出');}}>导出 CSV</Button><Button icon={<ExpandOutlined />} onClick={()=>document.documentElement.requestFullscreen?.()}>全屏</Button></>} />
    <Card className="analytics-filter"><Space wrap><DatePicker.RangePicker defaultValue={[dayjs('2026-08-01'),dayjs('2026-09-03')]} /><Select placeholder="全部项目" style={{width:220}} options={projects.slice(0,4).map(x=>({value:x.key,label:x.name}))}/><Select placeholder="全部岗位" style={{width:180}} options={jobs.slice(0,4).map(x=>({value:x.key,label:x.name}))}/><Select placeholder="招聘专员" style={{width:140}} options={[{value:'许昭',label:'许昭'}]}/><Button type="primary">应用筛选</Button><Button>重置</Button></Space><Space><span><SyncOutlined /> 更新于 16:50</span><Switch size="small" defaultChecked /> 自动刷新</Space></Card>
    <Alert className="scope-alert" type="info" showIcon message="所有指标均由当前账号授权范围内的 API 数据实时计算；无历史事件的数据不展示趋势。" />
    {type==='overview'&&<OverviewAnalytics drill={drill} />}
    {type==='projects'&&<ProjectAnalytics drill={drill} />}
    {type==='jobs'&&<JobAnalytics drill={drill} />}
    {type==='interviews'&&<InterviewAnalytics drill={drill} />}
  </div>;
}

type Drill = (metric:string)=>void;

function MetricRow({ items, drill }:{items:[string,string,string][],drill:Drill}) {
  return <Row gutter={12} className="stats-row">{items.map((item,index)=><Col flex="1" key={item[0]}><StatCard label={item[0]} value={item[1]} trend={item[2]} tone={index===items.length-1?'orange':'blue'} onClick={()=>drill(item[0])} /></Col>)}</Row>;
}

function OverviewAnalytics({drill}:{drill:Drill}) {
  const {projects,interviews,candidates}=useDomainData();
  const completed=interviews.filter(item=>/完成|审核|通过|下一轮/.test(item.status)).length;
  const passed=interviews.filter(item=>/通过|下一轮/.test(item.status)).length;
  const trend=buildTrend(interviews);
  const sourceMap=new Map<string,number>();
  candidates.forEach(item=>sourceMap.set(String(item.source||'未标注'),1+(sourceMap.get(String(item.source||'未标注'))||0)));
  const sourceData=[...sourceMap].map(([type,value])=>({type,value}));
  return <><MetricRow drill={drill} items={[['项目目标完成率',percent(projects.reduce((sum,item)=>sum+Number(item.passed||0),0),projects.reduce((sum,item)=>sum+Number(item.target||0),0)),''],['面试完成率',percent(completed,interviews.length),''],['面试通过率',percent(passed,completed),''],['异常率',percent(interviews.filter(item=>item.risk).length,interviews.length),'']]} />
    <Row gutter={16}><Col span={14}><Card title="招聘转化漏斗" className="chart-card"><Funnel data={buildFunnel(interviews)} xField="stage" yField="value" colorField="stage" onReady={c=>c.on('element:click',()=>drill('招聘转化漏斗'))}/></Card></Col><Col span={10}><Card title="候选人来源分布" className="chart-card"><Pie data={sourceData} angleField="value" colorField="type" innerRadius={0.62} label={{text:'type',position:'outside'}} onReady={c=>c.on('element:click',()=>drill('候选人来源'))}/></Card></Col></Row>
    <Row gutter={16}><Col span={16}><Card title="邀约 / 完成趋势" className="chart-card"><Area data={trend.flatMap(x=>[{date:x.date,type:'邀约量',value:x.邀约量},{date:x.date,type:'完成量',value:x.完成量}])} xField="date" yField="value" colorField="type" shapeField="smooth" style={{fillOpacity:.12}} /></Card></Col><Col span={8}><Card title="异常类型分布" className="chart-card"><Bar data={buildRisk(interviews)} xField="value" yField="type" colorField="type" legend={false} onReady={c=>c.on('element:click',()=>drill('异常类型'))}/></Card></Col></Row>
    <Card title="项目目标完成率排行" className="chart-card"><Column data={projects.slice(0,6).map(x=>({name:x.name.replace('招聘项目',''),value:x.progress}))} xField="name" yField="value" colorField="name" legend={false} label={{text:(d:{value:number})=>`${d.value}%`}} onReady={c=>c.on('element:click',()=>drill('项目完成率'))}/></Card></>;
}

function ProjectAnalytics({drill}:{drill:Drill}) {
  const {projects,jobs,interviews}=useDomainData();
  const targetData=projects.slice(0,5).flatMap(item=>[{name:item.name.slice(0,8),type:'目标人数',value:item.target},{name:item.name.slice(0,8),type:'已通过',value:item.passed}]);
  const contribution=jobs.slice(0,6).map(item=>({name:item.name,value:item.passed}));
  const ownerMap=new Map<string,number>();interviews.forEach(item=>ownerMap.set(item.owner,1+(ownerMap.get(item.owner)||0)));
  const workload=[...ownerMap].map(([name,value])=>({name,value}));
  return <><MetricRow drill={drill} items={[['项目总数',String(projects.length),''],['整体目标完成率',percent(projects.reduce((sum,item)=>sum+item.passed,0),projects.reduce((sum,item)=>sum+item.target,0)),''],['进度正常项目',String(projects.filter(item=>item.risk==='正常').length),''],['风险项目',String(projects.filter(item=>item.risk&&item.risk!=='正常').length),'']]} />
    <Row gutter={16}><Col span={16}><Card title="项目目标与实际对比" className="chart-card"><Column data={targetData} xField="name" yField="value" colorField="type" group onReady={c=>c.on('element:click',()=>drill('项目目标与实际'))}/></Card></Col><Col span={8}><Card title="项目进度风险" className="chart-card"><List dataSource={projects.slice(0,5)} renderItem={item=><List.Item onClick={()=>drill(item.name)} className="rank-item"><div className="rank-main"><b>{item.name}</b><Progress percent={item.progress} size="small" /></div><Tag color={item.risk==='正常'?'green':'orange'}>{item.risk}</Tag></List.Item>} /></Card></Col></Row>
    <Row gutter={16}><Col span={12}><Card title="岗位通过贡献" className="chart-card"><Pie data={contribution} angleField="value" colorField="name" innerRadius={0.55} onReady={c=>c.on('element:click',()=>drill('岗位贡献'))}/></Card></Col><Col span={12}><Card title="招聘专员项目工作量" className="chart-card"><Bar data={workload} xField="value" yField="name" colorField="name" legend={false} label={{text:'value'}} onReady={c=>c.on('element:click',()=>drill('招聘专员工作量'))}/></Card></Col></Row></>;
}

function JobAnalytics({drill}:{drill:Drill}) {
  const {jobs,interviews}=useDomainData();
  const hcData=jobs.slice(0,6).flatMap(item=>[{name:item.name.slice(0,7),type:'HC',value:item.hc},{name:item.name.slice(0,7),type:'已通过',value:item.passed}]);
  const scoreRanges=[{range:'60 以下',min:0,max:59},{range:'60-69',min:60,max:69},{range:'70-79',min:70,max:79},{range:'80-89',min:80,max:89},{range:'90 以上',min:90,max:100}];
  const score=scoreRanges.map(item=>({range:item.range,value:interviews.filter(record=>Number(record.score)>=item.min&&Number(record.score)<=item.max).length}));
  return <><MetricRow drill={drill} items={[['招聘中岗位',String(jobs.filter(item=>item.status==='招聘中').length),''],['HC 总量',String(jobs.reduce((sum,item)=>sum+item.hc,0)),''],['HC 完成率',percent(jobs.reduce((sum,item)=>sum+item.passed,0),jobs.reduce((sum,item)=>sum+item.hc,0)),''],['高缺口岗位',String(jobs.filter(item=>item.gap>=8).length),'']]} />
    <Row gutter={16}><Col span={15}><Card title="岗位 HC 完成情况" className="chart-card"><Column data={hcData} xField="name" yField="value" colorField="type" group onReady={c=>c.on('element:click',()=>drill('岗位 HC 完成'))}/></Card></Col><Col span={9}><Card title="候选人推进漏斗" className="chart-card"><Funnel data={buildFunnel(interviews)} xField="stage" yField="value" colorField="stage" onReady={c=>c.on('element:click',()=>drill('岗位候选人漏斗'))}/></Card></Col></Row>
    <Card title="AI 评分区间分布" className="chart-card"><Column data={score} xField="range" yField="value" colorField="range" legend={false} onReady={c=>c.on('element:click',()=>drill('评分区间'))}/></Card></>;
}

function InterviewAnalytics({drill}:{drill:Drill}) {
  const {interviews}=useDomainData();
  const completion=buildTrend(interviews).flatMap(item=>[{date:item.date,type:'AI 面试量',value:item.邀约量},{date:item.date,type:'完成量',value:item.完成量}]);
  const scoreRanges=[{range:'60 以下',min:0,max:59},{range:'60-69',min:60,max:69},{range:'70-79',min:70,max:79},{range:'80-89',min:80,max:89},{range:'90 以上',min:90,max:100}];
  const score=scoreRanges.map(item=>({range:item.range,value:interviews.filter(record=>Number(record.score)>=item.min&&Number(record.score)<=item.max).length}));
  const ownerMap=new Map<string,number>();interviews.forEach(item=>ownerMap.set(item.owner,1+(ownerMap.get(item.owner)||0)));const load=[...ownerMap].map(([name,value])=>({name,value}));
  const completed=interviews.filter(item=>/完成|审核|通过|下一轮/.test(item.status)).length;
  return <><MetricRow drill={drill} items={[['AI 面试量',String(interviews.length),''],['完成率',percent(completed,interviews.length),''],['通过率',percent(interviews.filter(item=>/通过|下一轮/.test(item.status)).length,completed),''],['异常率',percent(interviews.filter(item=>item.risk).length,interviews.length),'']]} />
    <Row gutter={16}><Col span={16}><Card title="AI 面试量与完成趋势" className="chart-card"><Area data={completion} xField="date" yField="value" colorField="type" shapeField="smooth" style={{fillOpacity:.12}} onReady={c=>c.on('element:click',()=>drill('AI 面试趋势'))}/></Card></Col><Col span={8}><Card title="AI 风险分布" className="chart-card"><Pie data={[{type:'正常',value:82},{type:'身份风险',value:6},{type:'回答风险',value:8},{type:'环境风险',value:4}]} angleField="value" colorField="type" innerRadius={0.62} onReady={c=>c.on('element:click',()=>drill('AI 风险'))}/></Card></Col></Row>
    <Row gutter={16}><Col span={12}><Card title="评分区间分布" className="chart-card"><Column data={score} xField="range" yField="value" colorField="range" legend={false} onReady={c=>c.on('element:click',()=>drill('面试评分区间'))}/></Card></Col><Col span={12}><Card title="人工面试官负载" className="chart-card"><Bar data={load} xField="value" yField="name" colorField="name" legend={false} label={{text:'value'}} onReady={c=>c.on('element:click',()=>drill('面试官负载'))}/></Card></Col></Row>
    <Card title="异常趋势与待处理记录" className="table-panel"><Table dataSource={interviews.filter(item=>item.risk)} pagination={false} columns={[{title:'面试编号',dataIndex:'code'},{title:'候选人',dataIndex:'candidate'},{title:'岗位',dataIndex:'job'},{title:'异常',dataIndex:'risk',render:value=><Tag color="red">{value}</Tag>},{title:'负责人',dataIndex:'owner'},{title:'更新时间',dataIndex:'updated'},{title:'操作',render:()=> <Button type="link" onClick={()=>drill('异常面试')}>查看明细</Button>}]} /></Card></>;
}

export function AnalyticsDetail() {
  const {interviews,projects,jobs}=useDomainData();
  const navigate=useNavigate(); const params=new URLSearchParams(useLocation().search);
  const metric=params.get('metric')||'招聘转化';
  return <div><PageHeader title={`${metric}明细`} description="由数据看板下钻，已自动带入来源筛选条件" extra={<Button icon={<LeftOutlined />} onClick={()=>navigate(-1)}>返回来源看板</Button>} /><Alert type="info" showIcon message={`筛选摘要：来源 ${params.get('source')||'招聘总览'} · 当前授权数据范围`} /><Row gutter={12} className="stats-row"><Col span={6}><StatCard label="明细记录" value={interviews.length} /></Col><Col span={6}><StatCard label="涉及项目" value={projects.length} /></Col><Col span={6}><StatCard label="涉及岗位" value={jobs.length} /></Col><Col span={6}><StatCard label="数据状态" value="实时" /></Col></Row><Card><Table dataSource={interviews} columns={[{title:'面试编号',dataIndex:'code'},{title:'候选人',dataIndex:'candidate'},{title:'项目',dataIndex:'project'},{title:'岗位',dataIndex:'job'},{title:'轮次',dataIndex:'round'},{title:'状态',dataIndex:'status',render:(v)=><StatusTag status={v}/>},{title:'更新时间',dataIndex:'updated'}]} /></Card></div>;
}

export function CalendarPage() {
  const {projects,interviews,calendarEvents,createRecord,updateRecord,createMeeting}=useDomainData();
  const [selected,setSelected]=useState<Dayjs>(dayjs());
  const [current,setCurrent]=useState<CalendarRecord>();
  const [create,setCreate]=useState(false);
  const [saving,setSaving]=useState(false);
  const [createForm]=Form.useForm();
  const [editForm]=Form.useForm();
  const eventsByDate=calendarEvents.reduce<Record<string,CalendarRecord[]>>((result,event)=>{
    const date=event.scheduledAt.slice(0,10);
    (result[date] ||= []).push(event);
    return result;
  },{});
  const openEvent=(event:CalendarRecord)=>{
    setCurrent(event);
    editForm.setFieldsValue({...event,scheduledAt:dayjs(event.scheduledAt)});
  };
  const saveEvent=async()=>{
    if(!current)return;
    const values=await editForm.validateFields();
    setSaving(true);
    try{
      await updateRecord('calendarEvents',current.key,{...values,scheduledAt:values.scheduledAt.format('YYYY-MM-DD HH:mm')});
      setCurrent(undefined);
      message.success('ATS 面试安排已更新，外部日历未自动改期');
    }finally{setSaving(false);}
  };
  const createEvent=async()=>{
    const values=await createForm.validateFields();
    const interview=interviews.find(item=>item.key===values.interviewKey);
    setSaving(true);
    try{
      const meeting=values.provider==='飞书会议'?await createMeeting({
        candidate:interview?.candidate,project:interview?.project,job:interview?.job,
        scheduledAt:values.scheduledAt.format('YYYY-MM-DD HH:mm'),
        interviewers:values.interviewers,duration:values.duration,
      }):undefined;
      await createRecord('calendarEvents',{
        title:`${interview?.job} · 人工面试`,candidate:interview?.candidate,
        project:interview?.project,job:interview?.job,status:'待确认',
        scheduledAt:values.scheduledAt.format('YYYY-MM-DD HH:mm'),duration:values.duration,
        interviewers:values.interviewers,provider:values.provider,
        meetingKey:meeting?.key,meetingUrl:meeting?.meetingUrl,
      });
      setCreate(false);
      createForm.resetFields();
      message.success(values.provider==='飞书会议'?'人工面试安排和飞书会议已创建':'人工面试安排已创建');
    }finally{setSaving(false);}
  };
  return <div><PageHeader title="面试日历" description="仅展示二轮及后续人工面试、客户面和排班环节" extra={<Button type="primary" onClick={()=>setCreate(true)}>新建人工面试</Button>} />
    <Card className="calendar-toolbar"><Space><Button onClick={()=>setSelected(dayjs())}>今天</Button><Radio.Group defaultValue="month" optionType="button" options={[{label:'月',value:'month'},{label:'周',value:'week'},{label:'日',value:'day'}]} /><Select placeholder="全部项目" style={{width:200}} options={projects.slice(0,3).map(x=>({value:x.key,label:x.name}))}/><Select placeholder="面试官" style={{width:130}} options={[{value:'陈砚',label:'陈砚'},{value:'梁序',label:'梁序'}]}/></Space><span>时区：Asia/Shanghai (UTC+8)</span></Card>
    <Card className="calendar-card"><Calendar value={selected} onSelect={setSelected} cellRender={date=><div className="event-list">{(eventsByDate[date.format('YYYY-MM-DD')]||[]).map(event=><div key={event.key} className={`calendar-event ${event.status==='冲突'?'conflict':''}`} onClick={click=>{click.stopPropagation();openEvent(event);}}><b>{event.scheduledAt.slice(11)} {event.candidate}</b><span>{event.title}</span></div>)}</div>} /></Card>
    <Drawer open={!!current} onClose={()=>setCurrent(undefined)} title="人工面试安排" width={520}><Form form={editForm} layout="vertical"><Form.Item name="candidate" label="候选人"><Input readOnly/></Form.Item><Form.Item name="scheduledAt" label="时间" rules={[{required:true}]}><DatePicker showTime style={{width:'100%'}}/></Form.Item><Form.Item name="interviewers" label="面试官" rules={[{required:true}]}><Select mode="multiple" options={['陈砚','梁序','顾清禾','林嘉树'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="provider" label="会议方式"><Select options={['飞书会议','腾讯会议','现场'].map(value=>({value,label:value}))}/></Form.Item><Alert type="info" showIcon message="此处只更新 ATS 安排，不会修改已创建的外部会议。" /><Button loading={saving} type="primary" block onClick={()=>void saveEvent()}>保存安排</Button></Form></Drawer>
    <Modal open={create} onCancel={()=>setCreate(false)} title="新建人工面试" okText="创建安排" confirmLoading={saving} onOk={()=>void createEvent()}><Form form={createForm} layout="vertical" initialValues={{scheduledAt:dayjs().add(1,'day').hour(10).minute(0),duration:60,provider:'飞书会议'}}><Form.Item name="interviewKey" label="候选人" rules={[{required:true}]}><Select options={interviews.slice(0,10).map(item=>({value:item.key,label:`${item.candidate} · ${item.job}`}))}/></Form.Item><Form.Item name="scheduledAt" label="面试时间" rules={[{required:true}]}><DatePicker showTime style={{width:'100%'}}/></Form.Item><Form.Item name="duration" label="时长"><Select options={[30,45,60,90].map(value=>({value,label:`${value} 分钟`}))}/></Form.Item><Form.Item name="interviewers" label="面试官" rules={[{required:true}]}><Select mode="multiple" options={['陈砚','梁序','顾清禾','林嘉树'].map(value=>({value,label:`${value} · 空闲`}))}/></Form.Item><Form.Item name="provider" label="会议方式"><Select options={['飞书会议','腾讯会议','现场'].map(value=>({value,label:value}))}/></Form.Item></Form></Modal>
  </div>;
}
