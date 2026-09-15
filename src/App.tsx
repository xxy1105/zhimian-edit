import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Button, Card, Col, Descriptions, Progress, Row, Tabs, Timeline } from 'antd';
import { AppLayout } from './components/AppLayout';
import { PageHeader, StatCard, StatusTag } from './components/Common';
import { Dashboard } from './pages/Dashboard';
import { ExceptionPage, InvitePage, PassedPage, ProcessPage, ReviewPage } from './pages/Interviews';
import { GenericPage, JobPage, ProjectPage } from './pages/Management';
import { AnalyticsDetail, AnalyticsPage, CalendarPage } from './pages/AnalyticsCalendar';
import { AuditLogPage, NotificationTemplatesPage, OrganizationPage, RolesRosterPage, SystemConfigPage } from './pages/SystemPages';
import { useData } from './context/DataContext';
import type { Project } from './services/mock';

const genericPaths = [
  '/approvals','/questions','/score-templates','/records',
  '/talent/public','/talent/private','/talent/incomplete','/talent/blacklist','/talent/onboarded',
  '/notifications','/downloads','/updates','/users',
];

function ProjectDetail() {
  const { projects: projectRecords } = useData();
  const projects = projectRecords as unknown as Project[];
  const { id }=useParams(); const project=projects.find(x=>x.key===id)||projects[0];
  if (!project) return null;
  return <div><PageHeader title={project.name} description={`${project.code} · ${project.client}`} extra={<><Button>提交审批</Button><Button type="primary">编辑项目</Button></>} /><Card className="detail-hero"><div><StatusTag status={project.status} /><h2>{project.manager} 负责</h2><p>{project.period} · 最后更新 {project.updated}</p></div><Progress type="circle" percent={project.progress} size={90}/></Card><Tabs items={[
    {key:'overview',label:'概览',children:<><Row gutter={12} className="stats-row"><Col span={6}><StatCard label="目标人数" value={project.target}/></Col><Col span={6}><StatCard label="已通过" value={project.passed}/></Col><Col span={6}><StatCard label="招聘岗位" value={project.jobs}/></Col><Col span={6}><StatCard label="剩余天数" value="58"/></Col></Row><Card title="近期动态"><Timeline items={[{color:'green',children:'今天 16:42 通过 2 名候选人审核'},{color:'blue',children:'今天 14:18 云产品技术支持工程师岗位发布 V3.2'},{color:'orange',children:'昨天 18:30 检测到 1 条评分异常'}]}/></Card></>},
    ...['岗位','候选人','面试进度','数据分析','成员权限','操作日志'].map((label,i)=>({key:String(i),label,children:<Card><Descriptions bordered><Descriptions.Item label="模块状态">数据已按项目范围过滤</Descriptions.Item><Descriptions.Item label="记录数量">{12+i*7}</Descriptions.Item><Descriptions.Item label="权限">可查看、编辑、导出</Descriptions.Item></Descriptions></Card>})),
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
