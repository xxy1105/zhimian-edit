import { createApp } from './app.ts';

const port = Number(process.env.API_PORT || 3001);
const host = process.env.API_HOST || '127.0.0.1';

createApp().listen(port, host, () => {
  console.log(`智面 ATS API 已启动：http://${host}:${port}/api/health`);
});

