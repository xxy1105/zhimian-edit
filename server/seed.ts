import { candidates as candidateNames, interviews, jobs, projects } from '../src/services/fixtures.ts';
import type { Database, Entity } from './types.ts';

const now = '2026-09-14T09:00:00.000Z';
const owners = ['许昭', '唐宁', '苏晚', '温言', '周谨言', '顾清禾'];

const candidateRecords: Entity[] = Array.from({ length: 36 }, (_, index) => {
  const source = interviews[index % interviews.length];
  const suffix = String(2468 + index * 113).slice(-4);
  return {
    key: String(index + 1),
    code: `ZM-CA-2026-${String(index + 1).padStart(4, '0')}`,
    name: index < candidateNames.length ? candidateNames[index] : `测试候选人${String(index + 1).padStart(2, '0')}`,
    contact: `138****${suffix}`,
    email: `candidate${index + 1}@example.com`,
    project: source.project,
    job: source.job,
    pool: index % 5 === 0 ? '公海池' : index % 7 === 0 ? '待补充' : '私海池',
    result: source.score > 80 ? '通过' : source.status,
    score: source.score || '--',
    tags: ['客户沟通', index % 2 ? '技术支持' : '交付运营'],
    owner: owners[index % owners.length],
    status: index % 11 === 0 ? '资料不完整' : '可邀约',
    updated: `09-${String(14 - (index % 8)).padStart(2, '0')} ${String(9 + (index % 9)).padStart(2, '0')}:20`,
  };
});

const questions: Entity[] = Array.from({ length: 24 }, (_, index) => ({
  key: String(index + 1),
  code: `ZM-QS-2026-${String(128 + index).padStart(4, '0')}`,
  name: [
    '如何定位云主机网络间歇性超时？',
    '客户情绪激动时如何推进问题解决？',
    '请设计一次重大故障的客户沟通方案',
    '如何评估一项交付计划的资源风险？',
  ][index % 4],
  project: jobs[index % jobs.length].project,
  job: jobs[index % jobs.length].name,
  type: ['情景', '简答', '判断', '实操'][index % 4],
  difficulty: ['中等', '困难', '简单'][index % 3],
  duration: `${5 + (index % 4)} 分钟`,
  count: 32 + index * 7,
  status: index % 7 === 0 ? '待审批' : '启用',
  version: `V${1 + (index % 3)}.${index % 10}`,
  updated: `09-${String(14 - (index % 6)).padStart(2, '0')} 14:${String(20 + index).slice(-2)}`,
}));

const scoreTemplates: Entity[] = jobs.map((job, index) => ({
  key: String(index + 1),
  name: `${job.name}综合评分模板`,
  project: job.project,
  job: job.name,
  total: 100,
  line: 70 + (index % 3) * 5,
  dimensions: 5 + (index % 3),
  veto: index % 2 ? '有' : '无',
  status: index === 2 ? '草稿' : '已发布',
  version: `V${2 + (index % 2)}.${index}`,
  updated: `09-${String(14 - (index % 4)).padStart(2, '0')} 15:${10 + index}`,
}));

const users = ['周谨言', '沈知行', '顾清禾', '林嘉树', '许昭', '唐宁', '苏晚', '温言'].map((name, index) => ({
  key: String(index + 1),
  name,
  account: `user${index + 1}@zhimian.cn`,
  department: ['招聘运营部', '云产品事业部', '客户服务部'][index % 3],
  role: ['超级管理员', '项目经理', '岗位负责人', '招聘专员', '审核人员'][index % 5],
  scope: index === 0 ? '全部组织数据' : `${1 + (index % 4)} 个项目 / ${2 + index} 个岗位`,
  source: index % 3 === 0 ? '统一登录同步' : '管理员创建',
  status: index === 6 ? '停用' : '启用',
  login: `09-${String(14 - (index % 3)).padStart(2, '0')} ${10 + index}:20`,
}));

const approvals: Entity[] = Array.from({ length: 10 }, (_, index) => ({
  key: String(index + 1),
  code: `ZM-AP-2026-${String(index + 1).padStart(4, '0')}`,
  name: index % 2 ? `岗位配置变更：${jobs[index % jobs.length].name}` : `项目立项：${projects[index % projects.length].name}`,
  module: index % 2 ? '岗位管理' : '项目管理',
  owner: owners[index % owners.length],
  status: ['待审批', '已通过', '已驳回'][index % 3],
  updated: `09-${String(14 - (index % 5)).padStart(2, '0')} ${10 + index}:20`,
}));

const notifications: Entity[] = Array.from({ length: 12 }, (_, index) => ({
  key: String(index + 1),
  code: `ZM-NT-${String(index + 1).padStart(4, '0')}`,
  name: ['面试即将开始', '候选人完成面试', '审批任务提醒', '导出任务完成'][index % 4],
  module: ['面试提醒', '结果通知', '审批中心', '下载中心'][index % 4],
  owner: owners[index % owners.length],
  status: index < 3 ? '未读' : '已读',
  updated: `09-${String(14 - (index % 5)).padStart(2, '0')} ${9 + (index % 9)}:20`,
}));

const downloads: Entity[] = Array.from({ length: 8 }, (_, index) => ({
  key: String(index + 1),
  code: `ZM-EX-${String(index + 1).padStart(4, '0')}`,
  name: ['面试台账导出', '候选人清单', '项目进度报表', '审计日志'][index % 4],
  module: '导出任务',
  owner: owners[index % owners.length],
  status: index === 0 ? '生成中' : '已完成',
  progress: index === 0 ? 68 : 100,
  updated: `09-${String(14 - (index % 5)).padStart(2, '0')} ${11 + (index % 7)}:20`,
}));

const updates: Entity[] = Array.from({ length: 6 }, (_, index) => ({
  key: String(index + 1),
  code: `V2.${9 - index}.0`,
  name: ['飞书二轮面试闭环', '面试审核工作台升级', '数据看板下钻', '批量导入增强', '权限范围优化', '异常中心上线'][index],
  module: '版本更新',
  owner: '智面产品团队',
  status: index === 0 ? '灰度发布' : '已发布',
  updated: `09-${String(14 - index).padStart(2, '0')} 10:00`,
}));

const calendarEvents: Entity[] = [
  { key: '1', title: '云产品技术支持工程师 · 二轮复试', status: '已确认', scheduledAt: '2026-09-14 10:00', duration: 60, candidate: '程砚秋', interviewers: ['陈砚'], project: projects[1].name, job: jobs[0].name, provider: '飞书会议' },
  { key: '2', title: '客户服务组长 · 客户面', status: '冲突', scheduledAt: '2026-09-14 14:30', duration: 60, candidate: '林望舒', interviewers: ['陈砚', '梁序'], project: projects[0].name, job: jobs[1].name, provider: '飞书会议' },
  { key: '3', title: '解决方案支持顾问 · 终试', status: '待确认', scheduledAt: '2026-09-15 16:00', duration: 45, candidate: '周景澄', interviewers: ['顾清禾'], project: projects[3].name, job: jobs[3].name, provider: '现场' },
  { key: '4', title: '售后服务专员 · 人工复试', status: '已确认', scheduledAt: '2026-09-16 15:00', duration: 60, candidate: '江予安', interviewers: ['梁序'], project: projects[0].name, job: jobs[2].name, provider: '腾讯会议' },
];

const templates: Entity[] = [
  { key: '1', name: '智面 V2.9.0 版本发布通知', type: '版本通知', channel: '站内信、邮件', audience: ['全部用户'], status: '启用', updated: '09-14 10:30', summary: '发布新增能力、影响模块和升级时间' },
  { key: '2', name: '飞书二轮面试功能上线', type: '功能通知', channel: '站内信', audience: ['项目经理', '招聘专员'], status: '启用', updated: '09-13 09:20', summary: '介绍飞书建会、结果回传和台账查看方式' },
  { key: '3', name: '招聘专员操作说明书更新', type: '说明书', channel: '邮件', audience: ['招聘专员'], status: '启用', updated: '09-12 17:40', summary: '候选人导入、邀约与异常处理操作指南' },
];

const auditLogs: Entity[] = [
  { key: '1', time: '09-14 09:42:18', user: '周谨言', role: '超级管理员', module: '项目管理', action: '更新项目', object: projects[0].name, summary: '调整项目目标人数', ip: '127.0.0.1', result: '成功' },
  { key: '2', time: '09-14 09:26:09', user: '许昭', role: '招聘专员', module: '面试通过', action: '创建飞书会议', object: '程砚秋 · 二轮面试', summary: '创建飞书会议并发送通知', ip: '127.0.0.1', result: '成功' },
];

export function createSeedDatabase(): Database {
  return {
    projects: structuredClone(projects) as Entity[],
    jobs: structuredClone(jobs) as Entity[],
    interviews: structuredClone(interviews) as Entity[],
    candidates: candidateRecords,
    questions,
    scoreTemplates,
    approvals,
    notifications,
    downloads,
    updates,
    users,
    calendarEvents,
    templates,
    auditLogs,
    settings: {
      callbackUrl: 'http://127.0.0.1:3001/api/webhooks/interview-provider',
      ssoEnabled: true,
      sessionHours: 8,
      dataRetentionDays: 365,
      timezone: 'Asia/Shanghai',
    },
    metadata: { version: 1, createdAt: now, updatedAt: now },
  };
}
