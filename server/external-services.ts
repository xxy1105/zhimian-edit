export class ExternalServiceNotConfiguredError extends Error {
  status = 503;

  constructor(service:string) {
    super(`${service}尚未配置`);
  }
}

async function callExternal(
  service:string,
  baseUrl:string|undefined,
  apiKey:string|undefined,
  path:string,
  init:RequestInit,
) {
  if(!baseUrl||!apiKey)throw new ExternalServiceNotConfiguredError(service);
  const response=await fetch(`${baseUrl.replace(/\/$/,'')}${path}`,{
    ...init,
    headers:{Authorization:`Bearer ${apiKey}`,...init.headers},
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(String(payload.message||`${service}返回 ${response.status}`)),{status:502});
  return payload;
}

export async function sendInterviewNotification(input:{
  candidate:{name:string;mobile?:string;email?:string};
  interviewUrl:string;
  expiresAt:string;
  job:string;
  channels:string[];
}){
  return callExternal(
    '通知 Provider',
    process.env.NOTIFICATION_PROVIDER_BASE_URL,
    process.env.NOTIFICATION_PROVIDER_API_KEY,
    process.env.NOTIFICATION_PROVIDER_SEND_PATH||'/notifications/send',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)},
  );
}

export async function testNotificationProvider(){
  return callExternal(
    '通知 Provider',
    process.env.NOTIFICATION_PROVIDER_BASE_URL,
    process.env.NOTIFICATION_PROVIDER_API_KEY,
    process.env.NOTIFICATION_PROVIDER_HEALTH_PATH||'/health',
    {method:'GET'},
  );
}

export async function parseResume(file:{buffer:Buffer;originalname:string;mimetype:string}){
  if(!process.env.RESUME_PARSER_BASE_URL||!process.env.RESUME_PARSER_API_KEY){
    throw new ExternalServiceNotConfiguredError('简历解析 Provider');
  }
  const form=new FormData();
  form.append('file',new Blob([new Uint8Array(file.buffer)],{type:file.mimetype}),file.originalname);
  return callExternal(
    '简历解析 Provider',
    process.env.RESUME_PARSER_BASE_URL,
    process.env.RESUME_PARSER_API_KEY,
    process.env.RESUME_PARSER_PATH||'/resumes/parse',
    {method:'POST',body:form},
  );
}
