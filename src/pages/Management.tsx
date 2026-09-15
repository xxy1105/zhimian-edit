import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Progress, Tag } from 'antd';
import { BusinessList, progressCol, statusCol, textCol } from '../components/BusinessList';
import { pageMeta } from '../config/navigation';
import { useData } from '../context/DataContext';
import type { CollectionName } from '../services/api';

const projectColumns = [
  {...textCol('项目编号','code',160),fixed:'left' as const},
  {title:'项目名称',dataIndex:'name',width:230,fixed:'left' as const,render:(v:string)=><Button type="link">{v}</Button>},
  textCol('客户 / 业务线','client',160), textCol('项目经理','manager',100),
  {title:'岗位数',dataIndex:'jobs',width:80}, {title:'目标人数',dataIndex:'target',width:90},
  {title:'已通过',dataIndex:'passed',width:80}, progressCol(), textCol('项目周期','period',150),
  statusCol(), textCol('更新时间','updated',120),
];

const jobColumns = [
  {...textCol('岗位编号','code',160),fixed:'left' as const},
  {title:'岗位名称',dataIndex:'name',width:210,fixed:'left' as const,render:(v:string)=><Button type="link">{v}</Button>},
  textCol('所属项目','project',220), textCol('岗位负责人','owner',140), textCol('招聘专员','recruiter',110),
  {title:'HC',dataIndex:'hc',width:65},{title:'已通过',dataIndex:'passed',width:75},{title:'缺口',dataIndex:'gap',width:65,render:(v:number)=><b className={v>8?'danger-text':''}>{v}</b>},
  textCol('工作地点','city',90), {title:'优先级',dataIndex:'priority',width:80,render:(v:string)=><Tag color={v==='紧急'?'red':v==='高'?'orange':'default'}>{v}</Tag>},
  statusCol(),textCol('版本','version',70),textCol('更新时间','updated',110),
];

export function ProjectPage() {
  const {projects}=useData();
  return <BusinessList collection="projects" title="项目管理" description="管理招聘项目、目标进度和审批状态" stats={[{label:'全部项目',value:projects.length},{label:'进行中',value:projects.filter(x=>x.status==='进行中').length},{label:'即将到期',value:projects.filter(x=>String(x.risk).includes('到期')).length,tone:'orange'},{label:'暂停',value:projects.filter(x=>x.status==='暂停').length},{label:'已归档',value:projects.filter(x=>x.status==='已归档').length}]} data={projects} columns={projectColumns} primaryAction="新建项目" filterNames={['项目名称 / 编号','客户 / 业务线','项目经理','状态','日期范围']} />;
}

export function JobPage() {
  const {jobs}=useData();
  return <BusinessList collection="jobs" title="岗位管理" description="配置岗位、成员权限与面试流程" stats={[{label:'招聘中岗位',value:jobs.filter(x=>x.status==='招聘中').length},{label:'待审批',value:jobs.filter(x=>x.status==='审批中').length,tone:'orange'},{label:'即将关闭',value:jobs.filter(x=>x.status==='暂停招聘').length},{label:'HC 缺口',value:jobs.reduce((sum,x)=>sum+Number(x.gap||0),0),tone:'red'},{label:'已归档',value:jobs.filter(x=>x.status==='已归档').length}]} data={jobs} columns={jobColumns} primaryAction="新建岗位" filterNames={['关键词','项目','岗位负责人','招聘专员','状态']} />;
}

export function GenericPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const data=useData();
  const meta = pageMeta[pathname] || {title:'业务管理',description:'管理业务数据与操作记录'};
  const isQuestion = pathname==='/questions';
  const isScore = pathname==='/score-templates';
  const isTalent = pathname.startsWith('/talent/');
  const isUsers = pathname==='/users';
  const isRecord = pathname==='/records';
  const pathCollections:Record<string,CollectionName>={
    '/approvals':'approvals','/notifications':'notifications','/downloads':'downloads','/updates':'updates',
  };
  const collection:CollectionName=isQuestion?'questions':isScore?'scoreTemplates':isTalent?'candidates':isUsers?'users':isRecord?'interviews':pathCollections[pathname]||'notifications';
  let source=data[collection];
  const poolByPath:Record<string,string>={'/talent/public':'公海池','/talent/private':'私海池','/talent/incomplete':'待补充','/talent/blacklist':'黑名单','/talent/onboarded':'已入职'};
  if(isTalent){
    const pool=poolByPath[pathname];
    const scoped=source.filter(item=>item.pool===pool||item.status===pool||item.result===pool);
    source=scoped.length?scoped:source;
  }
  const columns = isQuestion ? [textCol('题目编号','code',160),textCol('题目摘要','name',240),textCol('项目 / 岗位','job',200),textCol('题型','type'),textCol('难度','difficulty'),textCol('建议时长','duration'),textCol('使用次数','count'),statusCol(),textCol('版本','version'),textCol('更新时间','updated')] :
    isScore ? [textCol('模板名称','name',230),textCol('项目 / 岗位','job',210),textCol('总分','total'),textCol('通过线','line'),textCol('维度数','dimensions'),textCol('单项否决','veto'),textCol('当前版本','version'),statusCol(),textCol('更新时间','updated')] :
    isTalent ? [{title:'候选人',dataIndex:'name',width:120,render:(v:string)=><Button type="link">{v}</Button>},textCol('联系方式','contact'),textCol('最近项目 / 岗位','job',220),textCol('人才池','pool'),textCol('最近结果','result'),{title:'AI 得分',dataIndex:'score'},textCol('负责人','owner'),textCol('更新时间','updated')] :
    isUsers ? [{title:'用户',dataIndex:'name',render:(v:string)=><Button type="link">{v}</Button>},textCol('账号 / 邮箱','account',190),textCol('部门','department'),textCol('角色','role'),textCol('项目 / 岗位数据范围','scope',180),textCol('账号来源','source'),statusCol(),textCol('最后登录','login')] :
    isRecord ? [textCol('面试编号','code',190),textCol('候选人','candidate'),textCol('项目 / 岗位','job',220),textCol('轮次','round'),textCol('会议方式','provider',130),textCol('负责人 / 面试官','owner'),{title:'AI 总分',dataIndex:'score'},statusCol('面试状态','status'),statusCol('结果同步','syncStatus'),textCol('异常','risk'),textCol('更新时间','updated')] :
    [textCol('编号','code'),textCol('名称 / 摘要','name',240),textCol('所属模块','module'),textCol('负责人','owner'),statusCol(),textCol('更新时间','updated')];
  return <BusinessList collection={collection} title={meta.title} description={meta.description} stats={[{label:'全部',value:source.length},{label:'启用 / 进行中',value:source.filter(x=>/启用|进行中|招聘中/.test(String(x.status))).length},{label:'待处理',value:source.filter(x=>/待|审批/.test(String(x.status))).length,tone:'orange'},{label:'异常',value:source.filter(x=>/异常|失败/.test(String(x.status))).length,tone:'red'},{label:'本月新增',value:Math.min(source.length,24),tone:'green'}]} data={source} columns={columns} primaryAction={isTalent?'录入候选人':`新建${meta.title.replace('管理','')}`} allowBoard={isTalent||pathname==='/approvals'} headerExtra={pathname==='/updates'?<Button onClick={()=>navigate('/jobs')}>查看当前配置</Button>:undefined} />;
}
