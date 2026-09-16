import type { ReactNode } from 'react';
import {
  AppstoreOutlined, AuditOutlined, BankOutlined, BarChartOutlined,
  BellOutlined, CalendarOutlined, CloudDownloadOutlined, ControlOutlined,
  DatabaseOutlined, FileSearchOutlined, FolderOpenOutlined, FormOutlined,
  IdcardOutlined, VideoCameraOutlined, ProjectOutlined, SafetyCertificateOutlined,
  SettingOutlined, SolutionOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';

export type NavItem = {
  key: string; label: string; icon?: ReactNode; children?: NavItem[];
};

const child = (key: string, label: string): NavItem => ({ key, label });

export const navigation: NavItem[] = [
  { key:'/dashboard', label:'首页工作台', icon:<AppstoreOutlined /> },
  { key:'interview-console', label:'面试控制台', icon:<VideoCameraOutlined />, children:[
    child('/interviews/invite','发起邀约'), child('/interviews/process','进程管理'),
    child('/interviews/exceptions','废弃与异常'), child('/interviews/review','待审核'),
    child('/interviews/passed','面试通过'),
  ]},
  { key:'projects-jobs', label:'项目与岗位', icon:<ProjectOutlined />, children:[
    child('/projects','项目管理'), child('/jobs','岗位管理'), child('/approvals','审批中心'),
  ]},
  { key:'questions-score', label:'题库与评分', icon:<FormOutlined />, children:[
    child('/questions','题库管理'), child('/score-templates','评分模板'),
  ]},
  { key:'ledger', label:'面试台账', icon:<FileSearchOutlined />, children:[
    child('/records','面试记录'), child('/calendar','面试日历'),
  ]},
  { key:'analytics', label:'数据看板', icon:<BarChartOutlined />, children:[
    child('/analytics/overview','招聘总览'), child('/analytics/projects','项目分析'),
    child('/analytics/jobs','岗位分析'), child('/analytics/interviews','面试分析'),
  ]},
  { key:'talent', label:'人才库', icon:<SolutionOutlined />, children:[
    child('/talent/public','公海池'), child('/talent/private','私海池'), child('/talent/incomplete','待补充'),
    child('/talent/blacklist','黑名单'), child('/talent/onboarded','已入职'),
  ]},
  { key:'notice-download', label:'通知与下载', icon:<BellOutlined />, children:[
    child('/notifications','消息通知'), child('/downloads','下载中心'), child('/updates','版本更新'),
  ]},
  { key:'system', label:'系统设置', icon:<SettingOutlined />, children:[
    child('/users','用户管理'), child('/organization','组织架构'), child('/roles','角色与权限'),
    child('/settings/templates','通知模板'), child('/settings/audit','审计日志'),
    child('/settings/system','系统配置'),
  ]},
];

export const pageMeta: Record<string, { title:string; description:string; icon?:ReactNode }> = {
  '/dashboard': { title:'首页工作台', description:'招聘运营核心指标与今日任务概览' },
  '/interviews/invite': { title:'发起邀约', description:'选择候选人并配置首轮 AI 面试' },
  '/interviews/process': { title:'进程管理', description:'跟踪面试状态、在线心跳、转录与录像结果' },
  '/interviews/exceptions': { title:'废弃与异常', description:'处理过期链接、面试中断、转录与录像异常' },
  '/interviews/review': { title:'待审核', description:'审核逐题转录与录像并推进候选人流程' },
  '/interviews/passed': { title:'面试通过', description:'安排后续轮次、客户面与 Offer 审批' },
  '/projects': { title:'项目管理', description:'管理招聘项目、目标进度和审批状态' },
  '/jobs': { title:'岗位管理', description:'配置岗位、成员权限与面试流程' },
  '/approvals': { title:'审批中心', description:'处理项目、岗位和关键配置变更审批' },
  '/questions': { title:'题库管理', description:'管理岗位专属题目与 AI 面试组卷' },
  '/score-templates': { title:'评分模板', description:'配置评分维度、权重和通过标准' },
  '/records': { title:'面试记录', description:'按面试事件查看完整台账和结果' },
  '/calendar': { title:'面试日历', description:'安排二轮及后续人工面试' },
  '/analytics/overview': { title:'招聘总览', description:'招聘效率、转化和质量的全局分析' },
  '/analytics/projects': { title:'项目分析', description:'项目目标、进度风险和岗位贡献' },
  '/analytics/jobs': { title:'岗位分析', description:'岗位 HC、来源质量与评分分布' },
  '/analytics/interviews': { title:'面试分析', description:'AI 面试质量、异常与面试官负载' },
  '/talent/public': { title:'公海池', description:'可领取并重新激活的候选人资源' },
  '/talent/private': { title:'私海池', description:'本人及授权管理者负责的候选人' },
  '/talent/incomplete': { title:'待补充', description:'跟踪候选人资料完整度与提醒' },
  '/talent/blacklist': { title:'黑名单', description:'管理受限候选人与有效期' },
  '/talent/onboarded': { title:'已入职', description:'查看入职归属与招聘来源' },
  '/notifications': { title:'消息通知', description:'系统、导入导出和版本消息' },
  '/downloads': { title:'下载中心', description:'查看后台导出任务和文件有效期' },
  '/updates': { title:'版本更新', description:'智面产品版本和能力更新记录' },
  '/users': { title:'用户管理', description:'管理账号、角色与数据范围' },
  '/organization': { title:'组织架构', description:'维护部门树和成员归属' },
  '/roles': { title:'角色与权限', description:'配置操作权限矩阵和数据范围' },
  '/settings/templates': { title:'通知模板', description:'配置版本、功能通知和说明书内容' },
  '/settings/audit': { title:'审计日志', description:'追踪敏感操作和权限变更' },
  '/settings/system': { title:'系统配置', description:'配置通道、登录、日历和数据保留' },
};

export const iconLibrary = {
  UserOutlined, TeamOutlined, CalendarOutlined, CloudDownloadOutlined,
  AuditOutlined, SafetyCertificateOutlined, DatabaseOutlined, ControlOutlined,
  BankOutlined, FolderOpenOutlined, IdcardOutlined,
};
