# 智面 ATS 管理控制台

面向招聘项目、岗位、候选人和面试流程的全栈演示系统。前端使用 React、TypeScript、Vite 和 Ant Design，后端使用 Express，并通过 JSON 文件持久化测试数据。

## 启动

要求 Node.js 22 或更高版本。

```bash
npm install
npm run db:reset
npm run dev
```

- Web：http://localhost:5173
- API：http://127.0.0.1:3001/api
- 健康检查：http://127.0.0.1:3001/api/health

`npm run dev` 会同时启动前端和 API。测试数据库位于 `server/data/db.json`，该文件由种子脚本生成且不会提交到 Git。

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
- 候选人邀约、异常链接重发、面试审核和最终结果提交。
- 二轮飞书会议创建、会议结果同步和面试台账写入。
- 人工面试日历新增、改期与参会人维护。
- 角色只读权限、外部客户数据范围过滤和路由访问控制。
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
GET   /api/dashboard
GET   /api/search?q=keyword
GET   /api/exports/:resource
POST  /api/interviews/invite
POST  /api/interviews/:key/reissue
POST  /api/interviews/:key/review
POST  /api/interviews/:key/complete
POST  /api/meetings
POST  /api/meetings/:key/sync
PATCH /api/settings
POST  /api/integrations/feishu/test
```

角色通过 URL 编码后的 `x-role` 请求头传递。`数据观察员`和`外部客户`不能执行写操作。

## 数据说明

`server/seed.ts` 提供可重复生成的测试数据，包括：

- 8 个招聘项目
- 8 个岗位
- 36 名候选人
- 10 条基础面试记录
- 24 道面试题
- 审批、通知、下载、版本、日历、模板和审计数据

本地文件存储用于零配置演示。生产环境应将 `Store` 替换为数据库仓储，并在服务端接入真实身份认证、对象存储和飞书开放平台凭证。
