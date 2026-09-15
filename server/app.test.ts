import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from './app.ts';
import { Store } from './store.ts';

let directory: string;
let app: ReturnType<typeof createApp>;

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'zhimian-ats-'));
  const store = new Store(path.join(directory, 'db.json'));
  await store.reset();
  app = createApp(store);
});

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('ATS API', () => {
  it('returns health and seeded bootstrap data', async () => {
    const health = await request(app).get('/api/health').expect(200);
    assert.equal(health.body.status, 'ok');

    const bootstrap = await request(app).get('/api/bootstrap').expect(200);
    assert.equal(bootstrap.body.data.projects.length, 8);
    assert.equal(bootstrap.body.data.candidates.length, 36);
  });

  it('supports CRUD and persists changes', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({ name: '接口测试项目', status: '草稿', manager: '周谨言' })
      .expect(201);

    const key = created.body.data.key;
    await request(app).patch(`/api/projects/${key}`).send({ status: '进行中' }).expect(200);
    const found = await request(app).get(`/api/projects/${key}`).expect(200);
    assert.equal(found.body.data.status, '进行中');

    await request(app).delete(`/api/projects/${key}`).expect(204);
    await request(app).get(`/api/projects/${key}`).expect(404);
  });

  it('creates invitations and completes meeting sync', async () => {
    const invitation = await request(app)
      .post('/api/interviews/invite')
      .send({
        candidateKeys: ['1', '2'],
        project: '2026 秋季技术支持专项',
        job: '云产品技术支持工程师',
      })
      .expect(201);
    assert.equal(invitation.body.data.length, 2);

    const meeting = await request(app)
      .post('/api/meetings')
      .send({
        candidate: '江予安',
        project: '2026 秋季技术支持专项',
        job: '云产品技术支持工程师',
        scheduledAt: '2026-09-15 14:00',
        interviewers: ['陈砚'],
        duration: 60,
      })
      .expect(201);

    const synced = await request(app).post(`/api/meetings/${meeting.body.data.key}/sync`).expect(200);
    assert.equal(synced.body.data.syncStatus, '已同步');
    assert.match(synced.body.data.recordingUrl, /feishu\.cn/);
  });

  it('enforces read-only roles', async () => {
    await request(app)
      .post('/api/projects')
      .set('x-role', encodeURIComponent('数据观察员'))
      .send({ name: '不应创建' })
      .expect(403);
  });

  it('exports UTF-8 CSV data', async () => {
    const response = await request(app).get('/api/exports/projects').expect(200);
    assert.match(response.headers['content-type'], /text\/csv/);
    assert.match(response.text, /西北区域客户服务招聘项目/);
  });
});
