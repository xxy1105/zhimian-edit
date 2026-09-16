import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { HttpInterviewProvider, type CreateInterviewInput } from './interview-provider.ts';

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init: RequestInit }> = [];

const input: CreateInterviewInput = {
  requestId: 'ZM-IV-TEST-1',
  candidate: {
    id: 'candidate-1',
    name: '测试选手',
    email: 'candidate@example.test',
    resumeText: '三年后端开发经验',
  },
  project: '测试项目',
  job: '后端工程师',
  jdText: '负责后端服务设计与开发',
  focusAreas: ['后端开发', '数据库'],
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
};

before(() => {
  process.env.INTERVIEW_PROVIDER_BASE_URL = 'https://engine.example.test';
  process.env.INTERVIEW_PROVIDER_API_KEY = 'test-key';
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (init.method === 'DELETE') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (init.method === 'POST') {
      return new Response(JSON.stringify({
        item: { id: 'link-1', token: 'candidate-token', status: 'pending' },
        interviewUrl: '/interview/candidate-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      link: { id: 'link-1', status: 'completed', connection_status: 'offline' },
      qaRecords: [{
        id: 'qa-1',
        question: '请自我介绍',
        candidate_answer: '这是转录文本',
        recording_url: 'https://media.example.test/qa-1.webm',
        recording_status: 'ready',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  delete process.env.INTERVIEW_PROVIDER_BASE_URL;
  delete process.env.INTERVIEW_PROVIDER_API_KEY;
});

describe('interview execution engine adapter', () => {
  it('maps ATS data to the admin create-link contract', async () => {
    const provider = new HttpInterviewProvider();
    const created = await provider.create(input);
    assert.equal(created.providerInterviewId, 'link-1');
    assert.equal(created.interviewUrl, 'https://engine.example.test/interview/candidate-token');

    const request = calls.at(-1);
    assert.equal(request?.url, 'https://engine.example.test/api/admin/interview-links');
    assert.equal(new Headers(request?.init.headers).get('X-API-Key'), 'test-key');
    const body = JSON.parse(String(request?.init.body));
    assert.equal(body.candidate_name, '测试选手');
    assert.equal(body.resume_text, '三年后端开发经验');
    assert.equal(body.jd_title, '后端工程师');
    assert.equal(body.jd_text, '负责后端服务设计与开发');
    assert.deepEqual(body.focus_areas, ['后端开发', '数据库']);
  });

  it('maps per-question transcripts and recordings from detail', async () => {
    const provider = new HttpInterviewProvider();
    const result = await provider.getResult('link-1');
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.connectionStatus, 'offline');
    assert.deepEqual(result.qaRecords[0], {
      id: 'qa-1',
      question: '请自我介绍',
      candidateAnswer: '这是转录文本',
      recordingUrl: 'https://media.example.test/qa-1.webm',
      recordingStatus: 'ready',
    });
  });

  it('creates the replacement before deleting the old link', async () => {
    calls.length = 0;
    const provider = new HttpInterviewProvider();
    await provider.regenerate('old-link', input);
    assert.equal(calls[0]?.init.method, 'POST');
    assert.equal(calls[1]?.init.method, 'DELETE');
    assert.equal(calls[1]?.url, 'https://engine.example.test/api/admin/interview-links/old-link');
  });
});
