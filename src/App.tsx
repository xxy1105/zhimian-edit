import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Table, Tabs, message } from 'antd';
import { AppLayout } from './components/AppLayout';
import { PageHeader, StatCard, StatusTag } from './components/Common';
import { Dashboard } from './pages/Dashboard';
import { ExceptionPage, InvitePage, PassedPage, ProcessPage, ReviewPage } from './pages/Interviews';
import { GenericPage, JobPage, ProjectPage } from './pages/Management';
import { AnalyticsDetail, AnalyticsPage, CalendarPage } from './pages/AnalyticsCalendar';
import { AuditLogPage, NotificationTemplatesPage, OrganizationPage, RolesRosterPage, SystemConfigPage } from './pages/SystemPages';
import { useData } from './context/DataContext';

type ProjectRecord={key:string;name:string;code?:string;client?:string;manager?:string;period?:string;updated?:string;status:string;progress:number;target:number;passed:number;jobs:number};

const genericPaths = [
  '/approvals','/questions','/score-templates','/records',
  '/talent/public','/talent/private','/talent/incomplete','/talent/blacklist','/talent/onboarded',
  '/notifications','/downloads','/updates','/users',
];

function ProjectDetail() {
  const { projects: projectRecords,jobs,candidates,interviews,auditLogs,createRecord } = useData();
  const projects = projectRecords as unknown as ProjectRecord[];
  const { id }=useParams(); const project=projects.find(x=>x.key===id)||projects[0];
  if (!project) return null;
  const projectJobs=jobs.filter(item=>item.project===project.name);
  const projectCandidates=candidates.filter(item=>item.project===project.name);
  const projectInterviews=interviews.filter(item=>item.project===project.name);
  const logs=auditLogs.filter(item=>String(item.object||'').includes(project.name)||item.module==='projects');
  const submitApproval=async()=>{await createRecord('approvals',{name:`项目变更审批：${project.name}`,module:'项目管理',owner:project.manager,status:'待审批',project:project.name});message.success('审批申请已提交');};
  return <div><PageHeader title={project.name} description={`${project.code} · ${project.client}`} extra={<Button onClick={()=>void submitApproval()}>提交审批</Button>} /><Card className="detail-hero"><div><StatusTag status={project.status} /><h2>{project.manager} 负责</h2><p>{project.period} · 最后更新 {project.updated}</p></div><Progress type="circle" percent={project.progress} size={90}/></Card><Tabs items={[
    {key:'overview',label:'概览',children:<Row gutter={12} className="stats-row"><Col span={6}><StatCard label="目标人数" value={project.target}/></Col><Col span={6}><StatCard label="已通过" value={project.passed}/></Col><Col span={6}><StatCard label="招聘岗位" value={projectJobs.length}/></Col><Col span={6}><StatCard label="候选人数" value={projectCandidates.length}/></Col></Row>},
    {key:'jobs',label:'岗位',children:<Table dataSource={projectJobs} columns={[{title:'岗位',dataIndex:'name'},{title:'负责人',dataIndex:'owner'},{title:'HC',dataIndex:'hc'},{title:'状态',dataIndex:'status'}]}/>},
    {key:'candidates',label:'候选人',children:<Table dataSource={projectCandidates} columns={[{title:'候选人',dataIndex:'name'},{title:'岗位',dataIndex:'job'},{title:'负责人',dataIndex:'owner'},{title:'状态',dataIndex:'status'}]}/>},
    {key:'interviews',label:'面试进度',children:<Table dataSource={projectInterviews} columns={[{title:'候选人',dataIndex:'candidate'},{title:'岗位',dataIndex:'job'},{title:'轮次',dataIndex:'round'},{title:'状态',dataIndex:'status'}]}/>},
    {key:'logs',label:'操作日志',children:<Table dataSource={logs} columns={[{title:'时间',dataIndex:'time'},{title:'操作人',dataIndex:'user'},{title:'动作',dataIndex:'action'},{title:'摘要',dataIndex:'summary'}]}/>},
  ]}/></div>;
}

export default function App() {
  return <Routes><Route element={<AppLayout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/interviews/invite" element={<InvitePage />} />
    <Route path="/interviews/process" element={<ProcessPage />} />
    <Route path="/interviews/exceptions" element={<ExceptionPage />} />
    <Route path="/interviews/review" element={<ReviewPage />} />
    <Route path="/interviews/passed" element={<PassedPage />} />
    <Route path="/projects" element={<ProjectPage />} />
    <Route path="/projects/:id" element={<ProjectDetail />} />
    <Route path="/jobs" element={<JobPage />} />
    <Route path="/calendar" element={<CalendarPage />} />
    <Route path="/analytics/detail" element={<AnalyticsDetail />} />
    <Route path="/analytics/:type" element={<AnalyticsPage />} />
    <Route path="/organization" element={<OrganizationPage />} />
    <Route path="/roles" element={<RolesRosterPage />} />
    <Route path="/settings/templates" element={<NotificationTemplatesPage />} />
    <Route path="/settings/audit" element={<AuditLogPage />} />
    <Route path="/settings/system" element={<SystemConfigPage />} />
    {genericPaths.map(path=><Route key={path} path={path} element={<GenericPage />} />)}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route></Routes>;
}
