export type Project = {
  key: string; code: string; name: string; client: string; manager: string;
  jobs: number; target: number; passed: number; progress: number; period: string;
  status: string; risk: string; updated: string;
};

export type Interview = {
  key: string; code: string; candidate: string; project: string; job: string;
  round: string; owner: string; linkStatus: string; status: string; online: string;
  remaining: string; score: number; risk?: string; updated: string;
};

export const projects: Project[] = [
  { key:'1', code:'ZM-PJ-2026-001', name:'西北区域客户服务招聘项目', client:'西北客户运营中心', manager:'周谨言', jobs:4, target:42, passed:29, progress:69, period:'08/01 - 10/31', status:'进行中', risk:'正常', updated:'09-03 16:42' },
  { key:'2', code:'ZM-PJ-2026-002', name:'2026 秋季技术支持专项', client:'云产品事业部', manager:'沈知行', jobs:6, target:65, passed:31, progress:48, period:'07/15 - 11/15', status:'进行中', risk:'进度偏慢', updated:'09-03 15:18' },
  { key:'3', code:'ZM-PJ-2026-003', name:'华东交付人才储备项目', client:'华东交付中心', manager:'林嘉树', jobs:3, target:30, passed:25, progress:83, period:'06/20 - 09/20', status:'进行中', risk:'临近到期', updated:'09-03 12:06' },
  { key:'4', code:'ZM-PJ-2026-004', name:'重点客户解决方案扩编', client:'行业解决方案部', manager:'顾清禾', jobs:5, target:38, passed:18, progress:47, period:'08/10 - 12/15', status:'审批中', risk:'待审批', updated:'09-02 18:30' },
  { key:'5', code:'ZM-PJ-2026-005', name:'智能服务质检专项', client:'服务体验部', manager:'周谨言', jobs:2, target:18, passed:16, progress:89, period:'05/01 - 09/10', status:'暂停', risk:'资源不足', updated:'09-02 14:28' },
  { key:'6', code:'ZM-PJ-2026-006', name:'渠道售后能力建设项目', client:'渠道运营中心', manager:'沈知行', jobs:4, target:35, passed:35, progress:100, period:'03/01 - 08/31', status:'已结束', risk:'正常', updated:'09-01 17:09' },
  { key:'7', code:'ZM-PJ-2026-007', name:'海外中文客服储备计划', client:'国际业务部', manager:'韩若川', jobs:3, target:24, passed:5, progress:21, period:'09/01 - 12/31', status:'草稿', risk:'待发布', updated:'09-01 10:21' },
  { key:'8', code:'ZM-PJ-2026-008', name:'企业服务交付升级计划', client:'企业服务事业群', manager:'林嘉树', jobs:5, target:50, passed:44, progress:88, period:'01/15 - 07/31', status:'已归档', risk:'正常', updated:'08-28 09:45' },
];

export const jobs = [
  { key:'1', code:'ZM-JD-2026-018', name:'云产品技术支持工程师', project:projects[1].name, owner:'顾清禾、陈砚', recruiter:'许昭', hc:18, passed:9, gap:9, city:'北京', priority:'紧急', status:'招聘中', version:'V3.2', updated:'09-03 16:10' },
  { key:'2', code:'ZM-JD-2026-019', name:'客户服务组长', project:projects[0].name, owner:'周谨言', recruiter:'唐宁、苏晚', hc:8, passed:6, gap:2, city:'西安', priority:'高', status:'招聘中', version:'V2.1', updated:'09-03 15:44' },
  { key:'3', code:'ZM-JD-2026-020', name:'售后服务专员', project:projects[0].name, owner:'周谨言、梁序', recruiter:'苏晚', hc:24, passed:17, gap:7, city:'兰州', priority:'高', status:'招聘中', version:'V1.8', updated:'09-03 14:20' },
  { key:'4', code:'ZM-JD-2026-021', name:'解决方案支持顾问', project:projects[3].name, owner:'顾清禾', recruiter:'许昭', hc:10, passed:3, gap:7, city:'上海', priority:'普通', status:'审批中', version:'V1.0', updated:'09-03 11:02' },
  { key:'5', code:'ZM-JD-2026-022', name:'交付项目协调专员', project:projects[2].name, owner:'林嘉树', recruiter:'温言', hc:12, passed:10, gap:2, city:'杭州', priority:'普通', status:'招聘中', version:'V2.0', updated:'09-02 17:31' },
  { key:'6', code:'ZM-JD-2026-023', name:'客户成功运营经理', project:projects[2].name, owner:'林嘉树、陈砚', recruiter:'温言', hc:6, passed:5, gap:1, city:'南京', priority:'高', status:'暂停招聘', version:'V2.3', updated:'09-02 13:11' },
  { key:'7', code:'ZM-JD-2026-024', name:'服务质量分析师', project:projects[4].name, owner:'梁序', recruiter:'唐宁', hc:8, passed:7, gap:1, city:'成都', priority:'普通', status:'已关闭', version:'V1.6', updated:'09-01 16:08' },
  { key:'8', code:'ZM-JD-2026-025', name:'海外中文服务顾问', project:projects[6].name, owner:'韩若川', recruiter:'叶舟', hc:14, passed:2, gap:12, city:'深圳', priority:'普通', status:'草稿', version:'V0.3', updated:'09-01 09:22' },
];

export const interviews: Interview[] = [
  { key:'1', code:'ZM-IV-20260903-0086', candidate:'江予安', project:projects[1].name, job:jobs[0].name, round:'首轮 AI 面试', owner:'许昭', linkStatus:'进行中', status:'面试中', online:'在线', remaining:'08:42', score:72, risk:'网络波动', updated:'16:48' },
  { key:'2', code:'ZM-IV-20260903-0085', candidate:'孟书瑶', project:projects[0].name, job:jobs[1].name, round:'首轮 AI 面试', owner:'唐宁', linkStatus:'已访问', status:'待面试', online:'离线', remaining:'48:00', score:0, updated:'16:36' },
  { key:'3', code:'ZM-IV-20260903-0084', candidate:'程砚秋', project:projects[2].name, job:jobs[4].name, round:'二轮人工复试', owner:'温言', linkStatus:'已完成', status:'待审核', online:'离线', remaining:'--', score:88, updated:'16:20' },
  { key:'4', code:'ZM-IV-20260903-0083', candidate:'陆闻舟', project:projects[1].name, job:jobs[0].name, round:'首轮 AI 面试', owner:'许昭', linkStatus:'已发送', status:'待面试', online:'离线', remaining:'48:00', score:0, risk:'24 小时内过期', updated:'15:58' },
  { key:'5', code:'ZM-IV-20260903-0082', candidate:'宋知夏', project:projects[0].name, job:jobs[2].name, round:'首轮 AI 面试', owner:'苏晚', linkStatus:'已完成', status:'待评分', online:'离线', remaining:'--', score:45, risk:'回传延迟', updated:'15:41' },
  { key:'6', code:'ZM-IV-20260903-0081', candidate:'林望舒', project:projects[3].name, job:jobs[3].name, round:'客户面', owner:'许昭', linkStatus:'已完成', status:'下一轮', online:'离线', remaining:'--', score:91, updated:'15:08' },
  { key:'7', code:'ZM-IV-20260903-0080', candidate:'谢承宇', project:projects[2].name, job:jobs[5].name, round:'首轮 AI 面试', owner:'温言', linkStatus:'发送失败', status:'异常', online:'离线', remaining:'--', score:0, risk:'短信通道异常', updated:'14:54' },
  { key:'8', code:'ZM-IV-20260903-0079', candidate:'许清欢', project:projects[0].name, job:jobs[2].name, round:'首轮 AI 面试', owner:'苏晚', linkStatus:'已过期', status:'异常', online:'离线', remaining:'--', score:0, risk:'链接已过期', updated:'14:22' },
  { key:'9', code:'ZM-IV-20260903-0078', candidate:'周景澄', project:projects[1].name, job:jobs[0].name, round:'首轮 AI 面试', owner:'许昭', linkStatus:'已完成', status:'待审核', online:'离线', remaining:'--', score:83, updated:'13:47' },
  { key:'10', code:'ZM-IV-20260903-0077', candidate:'苏映雪', project:projects[2].name, job:jobs[4].name, round:'终试', owner:'温言', linkStatus:'已完成', status:'通过', online:'离线', remaining:'--', score:93, updated:'12:50' },
];

export const candidates = ['江予安','孟书瑶','程砚秋','陆闻舟','宋知夏','林望舒','谢承宇','许清欢','周景澄','苏映雪'];

export const trendData = Array.from({ length: 14 }, (_, i) => ({
  date: `08-${21 + i}`,
  邀约量: [32,38,35,44,41,28,36,49,52,47,56,61,58,67][i],
  完成量: [18,22,24,29,31,20,25,35,38,36,42,45,47,50][i],
}));

export const funnelData = [
  { stage:'已邀约', value:1268 }, { stage:'已访问', value:1084 },
  { stage:'已完成', value:879 }, { stage:'审核通过', value:532 },
  { stage:'进入下一轮', value:386 }, { stage:'最终通过', value:214 },
];

export const delay = <T,>(data: T, ms = 350) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(data), ms));

export const mockService = {
  getProjects: () => delay(projects),
  getJobs: () => delay(jobs),
  getInterviews: () => delay(interviews),
  search: (keyword: string) => delay({
    projects: projects.filter(x => `${x.name}${x.code}`.includes(keyword)).slice(0, 3),
    jobs: jobs.filter(x => `${x.name}${x.code}`.includes(keyword)).slice(0, 3),
    candidates: candidates.filter(x => x.includes(keyword)).slice(0, 3),
  }, 180),
};
