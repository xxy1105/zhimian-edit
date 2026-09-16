export type ApiEntity = Record<string, unknown> & { key: string };

export const collectionNames = [
  'projects',
  'jobs',
  'interviews',
  'candidates',
  'questions',
  'scoreTemplates',
  'approvals',
  'notifications',
  'downloads',
  'updates',
  'users',
  'calendarEvents',
  'templates',
  'auditLogs',
] as const;

export type CollectionName = (typeof collectionNames)[number];
export type ApiData = Record<CollectionName, ApiEntity[]> & {
  settings: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  user?: Record<string, unknown>;
};

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(payload.message || '接口请求失败');
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  return payload.data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<ApiEntity>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  bootstrap: () => request<ApiData>('/bootstrap'),
  list: (collection: CollectionName) => request<ApiEntity[]>(`/${collection}`),
  create: (collection: CollectionName, values: Record<string, unknown>) =>
    request<ApiEntity>(`/${collection}`, { method: 'POST', body: JSON.stringify(values) }),
  update: (collection: CollectionName, key: string, values: Record<string, unknown>) =>
    request<ApiEntity>(`/${collection}/${key}`, { method: 'PATCH', body: JSON.stringify(values) }),
  remove: (collection: CollectionName, key: string) =>
    request<void>(`/${collection}/${key}`, { method: 'DELETE' }),
  invite: (values: Record<string, unknown>) =>
    request<ApiEntity[]>('/interviews/invite', { method: 'POST', body: JSON.stringify(values) }),
  reissue: (key: string) =>
    request<ApiEntity>(`/interviews/${key}/reissue`, { method: 'POST' }),
  controlInterview: (key: string, action: string, value?: number) =>
    request<ApiEntity>(`/interviews/${key}/control`, { method: 'POST', body: JSON.stringify({ action, value }) }),
  syncInterviewResult: (key: string) =>
    request<ApiEntity>(`/interviews/${key}/sync-result`, { method: 'POST' }),
  review: (key: string, values: Record<string, unknown>) =>
    request<ApiEntity>(`/interviews/${key}/review`, { method: 'POST', body: JSON.stringify(values) }),
  complete: (key: string, values: Record<string, unknown>) =>
    request<ApiEntity>(`/interviews/${key}/complete`, { method: 'POST', body: JSON.stringify(values) }),
  createMeeting: (values: Record<string, unknown>) =>
    request<ApiEntity>('/meetings', { method: 'POST', body: JSON.stringify(values) }),
  syncMeeting: (key: string) =>
    request<ApiEntity>(`/meetings/${key}/sync`, { method: 'POST' }),
  search: (keyword: string) =>
    request<Record<'projects' | 'jobs' | 'candidates' | 'interviews', ApiEntity[]>>(
      `/search?q=${encodeURIComponent(keyword)}`,
    ),
  updateSettings: (values: Record<string, unknown>) =>
    request<Record<string, unknown>>('/settings', { method: 'PATCH', body: JSON.stringify(values) }),
  testFeishu: () =>
    request<{connected:boolean;userName?:string;checkedAt:string}>('/integrations/feishu/test', { method: 'POST' }),
  testNotifications: () =>
    request<Record<string,unknown>>('/integrations/notifications/test', { method: 'POST' }),
  async parseResume(file:File){
    const form=new FormData();form.append('file',file);
    const response=await fetch(`${API_BASE}/resumes/parse`,{method:'POST',credentials:'include',body:form});
    const payload=await response.json().catch(()=>({message:response.statusText}));
    if(!response.ok)throw new Error(payload.message||'简历解析失败');
    return payload.data as Record<string,unknown>;
  },
  async download(collection: CollectionName) {
    const response = await fetch(`${API_BASE}/exports/${collection}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('导出失败');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${collection}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
