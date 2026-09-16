# 面试执行引擎对接契约

智面 ATS 作为管理端，通过 API Key 调用独立面试执行引擎。引擎只负责面试流程、TTS、录像上传和 ASR 转录，不承载项目、岗位、候选人等 ATS 业务数据。

## ATS 环境变量

```text
INTERVIEW_PROVIDER_BASE_URL=https://interview.example.com
INTERVIEW_PROVIDER_API_KEY=<ADMIN_API_KEY>
INTERVIEW_PROVIDER_ADMIN_PATH=/api/admin/interview-links
INTERVIEW_PROVIDER_TIMEOUT_MS=15000
INTERVIEW_PROVIDER_DEFAULT_DIFFICULTY=medium
INTERVIEW_PROVIDER_AUTO_NEXT=true
INTERVIEW_PROVIDER_NEXT_BREAK_SECONDS=30
INTERVIEW_PROVIDER_TTS_VOICE=zh_female_xiaohe_uranus_bigtts
INTERVIEW_PROVIDER_MAX_DURATION_SECONDS=1800
INTERVIEW_PROVIDER_TIMEOUT_SECONDS=60
INTERVIEW_PROVIDER_INTERVIEWER_NAME=AI·嘉欣
```

API Key 仅保存在 ATS 服务端。请求使用：

```http
X-API-Key: <ADMIN_API_KEY>
```

## 创建面试链接

```http
POST {BASE_URL}/api/admin/interview-links
Content-Type: application/json
X-API-Key: <ADMIN_API_KEY>
```

ATS 会从候选人和岗位记录映射为：

```json
{
  "candidate_name": "张三",
  "candidate_email": "zhangsan@example.com",
  "resume_text": "3年后端开发经验",
  "jd_title": "后端工程师",
  "jd_text": "负责后端服务设计与开发",
  "focus_areas": ["后端开发", "数据库"],
  "default_difficulty": "medium",
  "auto_next": true,
  "next_break_seconds": 30,
  "tts_voice": "zh_female_xiaohe_uranus_bigtts",
  "expires_in_days": 7,
  "max_interview_duration": 1800,
  "interview_timeout": 60,
  "interviewer_name": "AI·嘉欣"
}
```

`jd_text` 必填。岗位没有 `jdText` 时，ATS 返回 `400`，不会创建空内容面试。

响应：

```json
{
  "item": {
    "id": "link-id",
    "token": "candidate-token",
    "status": "pending"
  },
  "interviewUrl": "/interview/candidate-token"
}
```

相对 `interviewUrl` 会自动转换为基于 `INTERVIEW_PROVIDER_BASE_URL` 的绝对地址。

## 同步面试结果

```http
GET {BASE_URL}/api/admin/interview-links/{id}
X-API-Key: <ADMIN_API_KEY>
```

响应：

```json
{
  "link": {
    "id": "link-id",
    "status": "completed",
    "connection_status": "offline"
  },
  "qaRecords": [
    {
      "id": "qa-id",
      "question": "请自我介绍",
      "candidate_answer": "转录文字",
      "recording_url": "https://media.example.com/qa.webm",
      "recording_status": "ready"
    }
  ]
}
```

ATS 只保存标准化后的执行状态、连接状态、逐题转录和录像地址，不保存引擎原始响应。

## 重发和作废

执行引擎没有独立的“重新生成”接口。ATS 重发时：

1. `POST /api/admin/interview-links` 使用当前候选人、简历和 JD 创建新链接。
2. 新链接创建成功后，`DELETE /api/admin/interview-links/{oldId}` 作废旧链接。
3. ATS 保留旧台账记录并标记为已废弃。

如果旧链接删除失败，ATS 会尝试删除刚创建的新链接并返回错误，避免静默产生两个有效入口。

执行引擎不提供暂停、延长或管理端远程结束能力，ATS 仅开放“同步结果”和“作废链接”操作。
