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
};

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request<T>(path: string, role: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-role': encodeURIComponent(role),
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
  bootstrap: (role: string) => request<ApiData>('/bootstrap', role),
  list: (collection: CollectionName, role: string) =>
    request<ApiEntity[]>(`/${collection}`, role),
  create: (collection: CollectionName, values: Record<string, unknown>, role: string) =>
    request<ApiEntity>(`/${collection}`, role, { method: 'POST', body: JSON.stringify(values) }),
  update: (collection: CollectionName, key: string, values: Record<string, unknown>, role: string) =>
    request<ApiEntity>(`/${collection}/${key}`, role, { method: 'PATCH', body: JSON.stringify(values) }),
  remove: (collection: CollectionName, key: string, role: string) =>
    request<void>(`/${collection}/${key}`, role, { method: 'DELETE' }),
  invite: (values: Record<string, unknown>, role: string) =>
    request<ApiEntity[]>('/interviews/invite', role, { method: 'POST', body: JSON.stringify(values) }),
  reissue: (key: string, role: string) =>
    request<ApiEntity>(`/interviews/${key}/reissue`, role, { method: 'POST' }),
  review: (key: string, values: Record<string, unknown>, role: string) =>
    request<ApiEntity>(`/interviews/${key}/review`, role, { method: 'POST', body: JSON.stringify(values) }),
  complete: (key: string, values: Record<string, unknown>, role: string) =>
    request<ApiEntity>(`/interviews/${key}/complete`, role, { method: 'POST', body: JSON.stringify(values) }),
  createMeeting: (values: Record<string, unknown>, role: string) =>
    request<ApiEntity>('/meetings', role, { method: 'POST', body: JSON.stringify(values) }),
  syncMeeting: (key: string, role: string) =>
    request<ApiEntity>(`/meetings/${key}/sync`, role, { method: 'POST' }),
  search: (keyword: string, role: string) =>
    request<Record<'projects' | 'jobs' | 'candidates' | 'interviews', ApiEntity[]>>(
      `/search?q=${encodeURIComponent(keyword)}`,
      role,
    ),
  updateSettings: (values: Record<string, unknown>, role: string) =>
    request<Record<string, unknown>>('/settings', role, { method: 'PATCH', body: JSON.stringify(values) }),
  testFeishu: (role: string) =>
    request<{connected:boolean;latency:number;checkedAt:string}>('/integrations/feishu/test', role, { method: 'POST' }),
  async download(collection: CollectionName, role: string) {
    const response = await fetch(`${API_BASE}/exports/${collection}`, {
      headers: { 'x-role': encodeURIComponent(role) },
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
