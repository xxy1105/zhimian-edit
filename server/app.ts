import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Store } from './store.ts';
import { collectionNames, type CollectionName, type Entity } from './types.ts';

const readOnlyRoles = new Set(['数据观察员', '外部客户']);
const collections = new Set<string>(collectionNames);

function routeParam(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function requestRole(request: Request) {
  const value = String(request.header('x-role') || '超级管理员');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  const role = requestRole(request);
  if (readOnlyRoles.has(role)) {
    response.status(403).json({ message: `${role}仅有查看权限` });
    return;
  }
  next();
}

function contains(record: Entity, keyword: string) {
  return JSON.stringify(record).toLowerCase().includes(keyword.toLowerCase());
}

function filterByRole(records: Entity[], role: string, database: Awaited<ReturnType<Store['read']>>) {
  if (role !== '外部客户') return records;
  const allowedProject = String(database.projects[0]?.name || '');
  return records.filter((record) => {
    const project = String(record.project || record.name || '');
    return !('project' in record) || project === allowedProject || record.key === database.projects[0]?.key;
  });
}

function csvValue(value: unknown) {
  const text = Array.isArray(value) ? value.join('、') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function makeCode(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${date}-${String(Date.now()).slice(-4)}`;
}

export function createApp(store = new Store()) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_request, response) => {
    const database = await store.read();
    response.json({
      status: 'ok',
      service: 'zhimian-ats-api',
      databaseVersion: database.metadata.version,
      updatedAt: database.metadata.updatedAt,
    });
  });

  app.get('/api/bootstrap', async (request, response) => {
    const database = await store.read();
    const role = requestRole(request);
    const result = Object.fromEntries(
      collectionNames.map((name) => [name, filterByRole(database[name], role, database)]),
    );
    response.json({ data: { ...result, settings: database.settings, metadata: database.metadata } });
  });

  app.get('/api/dashboard', async (request, response) => {
    const database = await store.read();
    const role = requestRole(request);
    const scopedInterviews = filterByRole(database.interviews, role, database);
    const scopedProjects = filterByRole(database.projects, role, database);
    const scopedJobs = filterByRole(database.jobs, role, database);
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
    response.json({
      data: {
        projects: database.projects.filter((item) => contains(item, keyword)).slice(0, 5),
        jobs: database.jobs.filter((item) => contains(item, keyword)).slice(0, 5),
        candidates: database.candidates.filter((item) => contains(item, keyword)).slice(0, 5),
        interviews: database.interviews.filter((item) => contains(item, keyword)).slice(0, 5),
      },
    });
  });

  app.get('/api/settings', async (_request, response) => {
    response.json({ data: (await store.read()).settings });
  });

  app.patch('/api/settings', requireWritable, async (request, response) => {
    const database = await store.update((current) => {
      current.settings = { ...current.settings, ...request.body };
    });
    response.json({ data: database.settings });
  });

  app.post('/api/integrations/feishu/test', requireWritable, async (_request, response) => {
    const settings = (await store.read()).settings;
    response.json({
      data: {
        connected: Boolean(settings.feishuEnabled && settings.feishuAppId),
        latency: 86,
        checkedAt: new Date().toISOString(),
      },
    });
  });

  app.get('/api/exports/:resource', async (request, response) => {
    const collection = collectionFromRequest(request);
    const records = await store.list(collection);
    const fields = [...new Set(records.flatMap((record) => Object.keys(record)))];
    const csv = [
      fields.map(csvValue).join(','),
      ...records.map((record) => fields.map((field) => csvValue(record[field])).join(',')),
    ].join('\n');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${collection}.csv"`);
    response.send(`\uFEFF${csv}`);
  });

  app.post('/api/admin/reset', requireWritable, async (_request, response) => {
    response.json({ data: await store.reset() });
  });

  app.get('/api/:resource', async (request, response) => {
    const collection = collectionFromRequest(request);
    const database = await store.read();
    const role = requestRole(request);
    const keyword = String(request.query.q || '').trim();
    let records = filterByRole(database[collection], role, database);
    if (keyword) records = records.filter((record) => contains(record, keyword));
    for (const [field, value] of Object.entries(request.query)) {
      if (field === 'q' || value === undefined || value === '') continue;
      records = records.filter((record) => String(record[field] ?? '').includes(String(value)));
    }
    response.json({ data: records, total: records.length });
  });

  app.get('/api/:resource/:key', async (request, response) => {
    const record = await store.get(collectionFromRequest(request), routeParam(request, 'key'));
    if (!record) {
      response.status(404).json({ message: '记录不存在' });
      return;
    }
    response.json({ data: record });
  });

  app.post('/api/interviews/invite', requireWritable, async (request, response) => {
    const { candidateKeys, project, job, owner = '许昭', expiresInHours = 48 } = request.body as {
      candidateKeys?: string[];
      project?: string;
      job?: string;
      owner?: string;
      expiresInHours?: number;
    };
    if (!candidateKeys?.length || !project || !job) {
      response.status(400).json({ message: '候选人、项目和岗位不能为空' });
      return;
    }
    const database = await store.read();
    const selected = database.candidates.filter((item) => candidateKeys.includes(item.key));
    const created = await Promise.all(selected.map((candidate) => store.create('interviews', {
      code: makeCode('ZM-IV'),
      candidate: candidate.name,
      candidateKey: candidate.key,
      project,
      job,
      round: '首轮 AI 面试',
      owner,
      linkStatus: '已发送',
      status: '待面试',
      online: '离线',
      remaining: `${expiresInHours}:00`,
      score: 0,
    })));
    response.status(201).json({ data: created });
  });

  app.post('/api/interviews/:key/reissue', requireWritable, async (request, response) => {
    const updated = await store.patch('interviews', routeParam(request, 'key'), {
      code: makeCode('ZM-IV'),
      linkStatus: '已发送',
      status: '待面试',
      remaining: '48:00',
      risk: '',
    });
    if (!updated) {
      response.status(404).json({ message: '面试记录不存在' });
      return;
    }
    response.json({ data: updated });
  });

  app.post('/api/interviews/:key/review', requireWritable, async (request, response) => {
    const { decision, comment = '' } = request.body as { decision?: string; comment?: string };
    const status = decision === 'reject' ? '已驳回' : decision === 'direct-pass' ? '通过' : '下一轮';
    const updated = await store.patch('interviews', routeParam(request, 'key'), { status, reviewComment: comment });
    if (!updated) {
      response.status(404).json({ message: '面试记录不存在' });
      return;
    }
    response.json({ data: updated });
  });

  app.post('/api/interviews/:key/complete', requireWritable, async (request, response) => {
    const updated = await store.patch('interviews', routeParam(request, 'key'), {
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
    const stamp = String(Date.now()).slice(-8);
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
      meetingId: `oc_${stamp}`,
      meetingUrl: `https://vc.feishu.cn/j/${stamp}`,
      scheduledAt,
      interviewers,
      provider: '飞书视频会议',
      syncStatus: '等待面试',
    });
    response.status(201).json({ data: record });
  });

  app.post('/api/meetings/:key/sync', requireWritable, async (request, response) => {
    const current = await store.get('interviews', routeParam(request, 'key'));
    if (!current) {
      response.status(404).json({ message: '会议记录不存在' });
      return;
    }
    const meetingId = String(current.meetingId);
    const updated = await store.patch('interviews', routeParam(request, 'key'), {
      status: '待审核',
      linkStatus: '已完成',
      syncStatus: '已同步',
      recordingUrl: `https://vc.feishu.cn/recording/${meetingId}`,
      transcriptUrl: `https://minutes.feishu.cn/minutes/${meetingId}`,
      resultSummary: '飞书会议已结束，录制文件、妙记转写及面试官评价已同步。',
    });
    response.json({ data: updated });
  });

  app.post('/api/:resource', requireWritable, async (request, response) => {
    const collection = collectionFromRequest(request);
    const prefixes:Partial<Record<CollectionName,string>>={
      projects:'ZM-PJ',jobs:'ZM-JD',interviews:'ZM-IV',candidates:'ZM-CA',
      questions:'ZM-QS',approvals:'ZM-AP',notifications:'ZM-NT',downloads:'ZM-EX',
    };
    const created = await store.create(collection, {
      ...(prefixes[collection]&&!request.body.code?{code:makeCode(prefixes[collection]!)}:{}),
      ...request.body,
    });
    if(collection!=='auditLogs'){
      await store.create('auditLogs',{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),user:'周谨言',role:requestRole(request),module:collection,action:'创建',object:String(created.name||created.code||created.key),summary:'通过 ATS API 创建记录',ip:request.ip,result:'成功'});
    }
    response.status(201).json({ data: created });
  });

  app.patch('/api/:resource/:key', requireWritable, async (request, response) => {
    const collection=collectionFromRequest(request);
    const updated = await store.patch(collection, routeParam(request, 'key'), request.body);
    if (!updated) {
      response.status(404).json({ message: '记录不存在' });
      return;
    }
    if(collection!=='auditLogs'){
      await store.create('auditLogs',{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),user:'周谨言',role:requestRole(request),module:collection,action:'更新',object:String(updated.name||updated.code||updated.key),summary:'通过 ATS API 更新记录',ip:request.ip,result:'成功'});
    }
    response.json({ data: updated });
  });

  app.delete('/api/:resource/:key', requireWritable, async (request, response) => {
    const collection=collectionFromRequest(request);
    const key=routeParam(request,'key');
    const current=await store.get(collection,key);
    const removed = await store.remove(collection,key);
    if (!removed) {
      response.status(404).json({ message: '记录不存在' });
      return;
    }
    if(collection!=='auditLogs'){
      await store.create('auditLogs',{time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),user:'周谨言',role:requestRole(request),module:collection,action:'删除',object:String(current?.name||current?.code||key),summary:'通过 ATS API 删除记录',ip:request.ip,result:'成功'});
    }
    response.status(204).send();
  });

  app.use((error: Error & { status?: number }, _request: Request, response: Response, _next: NextFunction) => {
    console.error(error);
    response.status(error.status || 500).json({ message: error.message || '服务器内部错误' });
  });

  return app;
}
