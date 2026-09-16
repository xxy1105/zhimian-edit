# AI 面试 Provider 接口契约

智面 ATS 通过服务端调用外部 AI 面试平台。所有时间使用 ISO 8601，所有接口使用 HTTPS。

## 环境变量

```text
INTERVIEW_PROVIDER_BASE_URL
INTERVIEW_PROVIDER_API_KEY
INTERVIEW_PROVIDER_CREATE_PATH=/interviews
INTERVIEW_PROVIDER_WEBHOOK_SECRET
PUBLIC_API_BASE_URL
```

## 创建面试

```http
POST {BASE_URL}/interviews
Authorization: Bearer {API_KEY}
Idempotency-Key: ZM-IV-...
Content-Type: application/json
```

请求：

```json
{
  "requestId": "ZM-IV-20260916-0001",
  "candidate": {
    "id": "candidate-id",
    "name": "候选人",
    "mobile": "13800000000",
    "email": "candidate@example.com"
  },
  "project": "项目名称",
  "job": "岗位名称",
  "questionBankId": "question-bank-id",
  "scoreTemplateId": "score-template-id",
  "expiresAt": "2026-09-18T10:00:00+08:00",
  "callbackUrl": "https://ats.example.com/api/webhooks/interview-provider",
  "metadata": {
    "atsInterviewCode": "ZM-IV-20260916-0001",
    "operatorId": "user-id"
  }
}
```

响应至少包含：

```json
{
  "data": {
    "providerInterviewId": "provider-id",
    "interviewUrl": "https://interview.example.com/xxx",
    "accessToken": "optional-token",
    "expiresAt": "2026-09-18T10:00:00+08:00",
    "status": "PENDING"
  }
}
```

兼容字段：`interviewId/id`、`url/link`、`expireTime/expiredAt`。

## 重新生成链接

```http
POST {BASE_URL}/interviews/{providerInterviewId}/link/regenerate
```

```json
{
  "expiresAt": "2026-09-19T10:00:00+08:00"
}
```

响应格式与创建面试相同。ATS 会保留旧记录并将其标记为已失效。

## 面试控制

```http
POST {BASE_URL}/interviews/{providerInterviewId}/{action}
```

`action` 支持：

- `pause`
- `resume`
- `extend`，请求体 `{ "value": 10 }`
- `finish`
- `cancel`

## 主动获取结果

```http
GET {BASE_URL}/interviews/{providerInterviewId}/result
```

```json
{
  "data": {
    "status": "COMPLETED",
    "score": 88,
    "summary": "综合评价",
    "transcriptUrl": "https://...",
    "recordingUrl": "https://...",
    "dimensions": [
      {
        "name": "沟通能力",
        "score": 90,
        "comment": "表达清晰"
      }
    ]
  }
}
```

## 结果 Webhook

Provider 回调：

```http
POST https://ats.example.com/api/webhooks/interview-provider
x-provider-timestamp: 1789524000
x-provider-signature: sha256=<hex>
Content-Type: application/json
```

签名算法：

```text
HMAC-SHA256(
  INTERVIEW_PROVIDER_WEBHOOK_SECRET,
  timestamp + "." + rawRequestBody
)
```

请求体：

```json
{
  "eventId": "unique-event-id",
  "eventType": "INTERVIEW_COMPLETED",
  "providerInterviewId": "provider-id",
  "occurredAt": "2026-09-16T18:00:00+08:00",
  "data": {
    "status": "COMPLETED",
    "score": 88,
    "summary": "综合评价",
    "transcriptUrl": "https://...",
    "recordingUrl": "https://...",
    "dimensions": []
  }
}
```

要求：

- `eventId` 全局唯一，用于幂等。
- 时间戳与服务器时间偏差不能超过 5 分钟。
- Provider 对非 2xx 响应应指数退避重试。
- URL 应为有权限控制或短期签名的 HTTPS 地址。

