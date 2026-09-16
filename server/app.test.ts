import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from './app.ts';
import { createSession, developmentUsers } from './auth.ts';
import type { InterviewProvider } from './interview-provider.ts';
import { Store } from './store.ts';

let directory:string;
let app:ReturnType<typeof createApp>;
let admin:ReturnType<typeof request.agent>;

const provider:InterviewProvider={
  async create(input){
    return {providerInterviewId:`provider-${input.requestId}`,interviewUrl:`https://interview.example.test/${input.requestId}`,expiresAt:input.expiresAt,status:'PENDING'};
  },
  async regenerate(providerInterviewId,input){
    return {providerInterviewId:`${providerInterviewId}-new`,interviewUrl:`https://interview.example.test/${providerInterviewId}-new`,expiresAt:input.expiresAt,status:'PENDING'};
  },
  async cancel(){},
  async getResult(providerInterviewId){
    return {
      providerInterviewId,
      status:'COMPLETED',
      connectionStatus:'offline',
      qaRecords:[{id:'qa-1',question:'请自我介绍',candidateAnswer:'真实转录',recordingUrl:'https://recording.test/qa-1'}],
      recordingUrl:'https://recording.test/qa-1',
    };
  },
};

before(async()=>{
  process.env.SESSION_SECRET='test-session-secret';
  directory=await mkdtemp(path.join(os.tmpdir(),'zhimian-ats-'));
  const store=new Store(path.join(directory,'db.json'));
  await store.reset();
  app=createApp(store,{
    interviewProvider:provider,
    createLarkMeeting:async()=>({reserveId:'reserve-1',meetingNo:'123456',meetingUrl:'https://vc.feishu.cn/j/123456',appLink:undefined,password:undefined,expiresAt:'123',calendarEventId:'event-1'}),
    getLarkMeetingResult:async()=>({meetingId:'meeting-1',meeting:{status:2,note_id:'minute-1'},relatedArtifacts:{},recording:{url:'https://recording.test/file'}}),
    testLarkConnection:async()=>({connected:true,userName:'测试用户',checkedAt:new Date().toISOString()}),
  });
  admin=request.agent(app);
  await admin.post('/api/auth/login').send({username:'admin',password:'Zhimian@2026'}).expect(200);
});

after(async()=>{
  delete process.env.SESSION_SECRET;
  await rm(directory,{recursive:true,force:true});
});

describe('ATS API security and integrations',()=>{
  it('rejects development default accounts in production',()=>{
    const previousNodeEnv=process.env.NODE_ENV;
    const previousUsers=process.env.AUTH_USERS_JSON;
    const previousPassword=process.env.ADMIN_PASSWORD;
    process.env.NODE_ENV='production';
    delete process.env.AUTH_USERS_JSON;
    delete process.env.ADMIN_PASSWORD;
    try {
      assert.throws(()=>developmentUsers(),/必须配置 AUTH_USERS_JSON 或 ADMIN_PASSWORD/);
    } finally {
      if(previousNodeEnv===undefined)delete process.env.NODE_ENV;
      else process.env.NODE_ENV=previousNodeEnv;
      if(previousUsers===undefined)delete process.env.AUTH_USERS_JSON;
      else process.env.AUTH_USERS_JSON=previousUsers;
      if(previousPassword===undefined)delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD=previousPassword;
    }
  });

  it('requires authentication and returns seeded bootstrap after login',async()=>{
    await request(app).get('/api/bootstrap').expect(401);
    const bootstrap=await admin.get('/api/bootstrap').expect(200);
    assert.equal(bootstrap.body.data.projects.length,8);
    assert.equal(bootstrap.body.data.user.role,'超级管理员');
    assert.equal('feishuSecret' in bootstrap.body.data.settings,false);
    await admin.patch('/api/settings').send({feishuSecret:'must-not-persist',timezone:'Asia/Shanghai'}).expect(200);
    const refreshed=await admin.get('/api/bootstrap').expect(200);
    assert.equal('feishuSecret' in refreshed.body.data.settings,false);
  });

  it('supports scoped CRUD with a server session',async()=>{
    const created=await admin.post('/api/projects').send({name:'接口测试项目',status:'草稿'}).expect(201);
    await admin.patch(`/api/projects/${created.body.data.key}`).send({status:'进行中'}).expect(200);
    await admin.delete(`/api/projects/${created.body.data.key}`).expect(204);
  });

  it('prevents a restricted user from reading unrelated detail and writing',async()=>{
    const token=createSession({id:'external-1',name:'外部客户',role:'外部客户',projectKeys:['1'],jobKeys:[]});
    const client=request.agent(app);
    const cookie=`zhimian_session=${token}`;
    await client.get('/api/projects/2').set('Cookie',cookie).expect(404);
    await client.post('/api/projects').set('Cookie',cookie).send({name:'越权项目'}).expect(403);
  });

  it('prevents scoped writers from moving records into another project',async()=>{
    const token=createSession({id:'recruiter-1',name:'招聘专员',role:'招聘专员',projectKeys:['1'],jobKeys:[]});
    const cookie=`zhimian_session=${token}`;
    const scoped=await request(app).get('/api/bootstrap').set('Cookie',cookie).expect(200);
    const adminData=await admin.get('/api/bootstrap').expect(200);
    const candidate=scoped.body.data.candidates[0];
    const foreignProject=adminData.body.data.projects.find((item:{key:string})=>item.key!=='1');
    const foreignJob=adminData.body.data.jobs.find((item:{project:string})=>item.project===foreignProject.name);
    assert.ok(candidate);
    assert.ok(foreignJob);
    await request(app).post('/api/interviews/invite').set('Cookie',cookie).send({
      candidateKeys:[candidate.key],project:foreignProject.name,job:foreignJob.name,
    }).expect(403);
    await request(app).patch(`/api/candidates/${candidate.key}`).set('Cookie',cookie).send({
      project:foreignProject.name,job:foreignJob.name,
    }).expect(403);
  });

  it('rejects interview creation when the selected job has no JD text',async()=>{
    const job=await admin.post('/api/jobs').send({
      name:'缺少 JD 的岗位',project:'2026 秋季技术支持专项',status:'招聘中',
    }).expect(201);
    const candidate=await admin.post('/api/candidates').send({
      name:'待测试候选人',project:'2026 秋季技术支持专项',job:job.body.data.name,status:'可邀约',
    }).expect(201);
    await admin.post('/api/interviews/invite').send({
      candidateKeys:[candidate.body.data.key],project:'2026 秋季技术支持专项',job:job.body.data.name,
    }).expect(400);
  });

  it('creates a real provider link, preserves the old link on regenerate, and syncs results',async()=>{
    const invitation=await admin.post('/api/interviews/invite').send({
      candidateKeys:['1'],project:'2026 秋季技术支持专项',job:'云产品技术支持工程师',
    }).expect(201);
    assert.match(invitation.body.data[0].interviewUrl,/interview\.example\.test/);
    const regenerated=await admin.post(`/api/interviews/${invitation.body.data[0].key}/reissue`).send({expiresInHours:24}).expect(201);
    assert.notEqual(regenerated.body.data.key,invitation.body.data[0].key);
    const result=await admin.post(`/api/interviews/${regenerated.body.data.key}/sync-result`).expect(200);
    assert.equal(result.body.data.qaRecords[0].candidateAnswer,'真实转录');
    assert.equal(result.body.data.recordingUrl,'https://recording.test/qa-1');
    const cancelled=await admin.post(`/api/interviews/${regenerated.body.data.key}/control`).send({action:'cancel'}).expect(200);
    assert.equal(cancelled.body.data.linkStatus,'已失效');
  });

  it('creates and synchronizes a Lark meeting through injected official-service adapters',async()=>{
    const meeting=await admin.post('/api/meetings').send({
      candidate:'江予安',project:'2026 秋季技术支持专项',job:'云产品技术支持工程师',scheduledAt:'2026-09-18 14:00',interviewers:['陈砚'],duration:60,
    }).expect(201);
    assert.equal(meeting.body.data.reserveId,'reserve-1');
    const synced=await admin.post(`/api/meetings/${meeting.body.data.key}/sync`).expect(200);
    assert.equal(synced.body.data.meetingId,'meeting-1');
    assert.equal(synced.body.data.recordingUrl,'https://recording.test/file');
  });
});
