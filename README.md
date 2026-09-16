# 智面 ATS 管理控制台

面向招聘项目、岗位、候选人和面试流程的全栈系统。前端使用 React、TypeScript、Vite 和 Ant Design，后端使用 Express。开发环境可使用本地 JSON，生产环境强制使用 PostgreSQL。

## 启动

要求 Node.js 22 或更高版本。

```bash
npm install
cp .env.example .env
npm run db:reset
npm run dev
```

- Web：http://localhost:5173
- API：http://127.0.0.1:3001/api
- 健康检查：http://127.0.0.1:3001/api/health

`npm run dev` 会同时启动前端和 API。首次登录账号默认是 `admin`，密码必须通过 `.env` 中的 `ADMIN_PASSWORD` 配置。

生产环境必须配置 `SESSION_SECRET`、`DATABASE_URL`，以及 `AUTH_USERS_JSON` 或强密码 `ADMIN_PASSWORD`，否则服务拒绝启动。PostgreSQL 默认校验 TLS 证书；只有明确受控的开发环境才可将 `DATABASE_SSL_REJECT_UNAUTHORIZED` 设为 `false`。

## 常用命令

```bash
npm run dev          # 同时启动前端与 API
npm run dev:web      # 只启动前端
npm run dev:api      # 只启动 API
npm run db:reset     # 重置测试数据库
npm test             # 运行 API 集成测试
npm run build        # 前后端类型检查并构建前端
```

## 已实现能力

- 项目、岗位、候选人、题库、评分模板和用户等通用 CRUD。
- 批量选择、删除、归档、复制、Excel 导入与 CSV 导出。
- 基于 HttpOnly 签名会话的登录、服务端 RBAC 和项目/岗位数据范围。
- AI 面试 Provider 创建链接、保留历史的链接重发、控制、主动结果同步及 Webhook。
- 飞书官方 SDK 创建视频会议预约、查询会议详情和录制结果。
- 人工面试日历新增、改期与参会人维护。
- PostgreSQL 共享存储；本地 JSON 仅用于开发。
- 密钥仅从服务端环境变量读取，不返回浏览器。
- 可配置的通知 Provider 和简历解析 Provider。
- 通知模板、系统配置、飞书连接检查和审计记录。
- 文件持久化种子数据与 API 集成测试。

## API

通用资源：

```text
GET    /api/:resource
GET    /api/:resource/:key
POST   /api/:resource
PATCH  /api/:resource/:key
DELETE /api/:resource/:key
```

业务接口：

```text
GET   /api/bootstrap
POST  /api/auth/login
POST  /api/auth/logout
GET   /api/dashboard
GET   /api/search?q=keyword
GET   /api/exports/:resource
POST  /api/interviews/invite
POST  /api/interviews/:key/reissue
POST  /api/interviews/:key/control
POST  /api/interviews/:key/sync-result
POST  /api/interviews/:key/review
POST  /api/interviews/:key/complete
POST  /api/meetings
POST  /api/meetings/:key/sync
PATCH /api/settings
POST  /api/integrations/feishu/test
POST  /api/resumes/parse
POST  /api/webhooks/interview-provider
```

业务接口使用 HttpOnly Cookie 登录会话。客户端不能指定或切换角色。

AI 面试平台的详细字段和签名规范见 [Provider 接口契约](docs/interview-provider-contract.md)。

## 数据说明

`server/seed.ts` 提供可重复生成的测试数据，包括：

- 8 个招聘项目
- 8 个岗位
- 36 名候选人
- 10 条基础面试记录
- 24 道面试题
- 审批、通知、下载、版本、日历、模板和审计数据

本地 JSON 仅用于单机开发，不适合跨电脑协作。部署共享环境时使用 PostgreSQL，并将所有密钥配置到服务器或部署平台 Secret 中，禁止提交 `.env`。
