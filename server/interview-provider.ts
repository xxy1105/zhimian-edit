import { createHmac, timingSafeEqual } from 'node:crypto';

export type CreateInterviewInput = {
  requestId: string;
  candidate: {
    id: string;
    name: string;
    mobile?: string;
    email?: string;
  };
  project: string;
  job: string;
  questionBankId?: string;
  scoreTemplateId?: string;
  expiresAt: string;
  callbackUrl: string;
  metadata: Record<string, string>;
};

export type ProviderInterview = {
  providerInterviewId: string;
  interviewUrl: string;
  accessToken?: string;
  expiresAt: string;
  status: string;
  raw?: unknown;
};

export type ProviderResult = {
  providerInterviewId: string;
  status: string;
  score?: number;
  summary?: string;
  transcriptUrl?: string;
  recordingUrl?: string;
  dimensions?: Array<{ name: string; score: number; comment?: string }>;
  raw?: unknown;
};

export interface InterviewProvider {
  create(input: CreateInterviewInput): Promise<ProviderInterview>;
  regenerate(providerInterviewId: string, expiresAt: string): Promise<ProviderInterview>;
  control(providerInterviewId: string, action: string, value?: number): Promise<void>;
  getResult(providerInterviewId: string): Promise<ProviderResult>;
}

export class ProviderNotConfiguredError extends Error {
  status = 503;

  constructor() {
    super('AI 面试服务尚未配置，请提供 Provider Base URL、鉴权和字段映射');
  }
}

function providerConfig() {
  return {
    baseUrl: process.env.INTERVIEW_PROVIDER_BASE_URL?.replace(/\/$/, ''),
    apiKey: process.env.INTERVIEW_PROVIDER_API_KEY,
    createPath: process.env.INTERVIEW_PROVIDER_CREATE_PATH || '/interviews',
    timeout: Number(process.env.INTERVIEW_PROVIDER_TIMEOUT_MS || 15000),
  };
}

async function providerRequest(path: string, init: RequestInit) {
  const config = providerConfig();
  if (!config.baseUrl || !config.apiKey) throw new ProviderNotConfiguredError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(String(payload.message || payload.msg || `面试平台返回 ${response.status}`)) as Error & { status?: number };
      error.status = 502;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeInterview(payload: Record<string, unknown>): ProviderInterview {
  const data = (payload.data || payload.result || payload) as Record<string, unknown>;
  const providerInterviewId = String(data.providerInterviewId || data.interviewId || data.id || '');
  const interviewUrl = String(data.interviewUrl || data.url || data.link || '');
  const expiresAt = String(data.expiresAt || data.expireTime || data.expiredAt || '');
  if (!providerInterviewId || !interviewUrl) {
    throw Object.assign(new Error('面试平台响应缺少 providerInterviewId 或 interviewUrl'), { status: 502 });
  }
  return {
    providerInterviewId,
    interviewUrl,
    accessToken: data.accessToken ? String(data.accessToken) : undefined,
    expiresAt,
    status: String(data.status || 'PENDING'),
    raw: payload,
  };
}

export class HttpInterviewProvider implements InterviewProvider {
  async create(input: CreateInterviewInput) {
    const config = providerConfig();
    return normalizeInterview(await providerRequest(config.createPath, {
      method: 'POST',
      headers: { 'Idempotency-Key': input.requestId },
      body: JSON.stringify(input),
    }));
  }

  async regenerate(providerInterviewId: string, expiresAt: string) {
    return normalizeInterview(await providerRequest(`/interviews/${encodeURIComponent(providerInterviewId)}/link/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ expiresAt }),
    }));
  }

  async control(providerInterviewId: string, action: string, value?: number) {
    await providerRequest(`/interviews/${encodeURIComponent(providerInterviewId)}/${encodeURIComponent(action)}`, {
      method: 'POST',
      body: JSON.stringify(value === undefined ? {} : { value }),
    });
  }

  async getResult(providerInterviewId: string): Promise<ProviderResult> {
    const payload = await providerRequest(`/interviews/${encodeURIComponent(providerInterviewId)}/result`, { method: 'GET' });
    const data = (payload.data || payload.result || payload) as Record<string, unknown>;
    return {
      providerInterviewId,
      status: String(data.status || 'UNKNOWN'),
      score: data.score === undefined ? undefined : Number(data.score),
      summary: data.summary ? String(data.summary) : undefined,
      transcriptUrl: data.transcriptUrl ? String(data.transcriptUrl) : undefined,
      recordingUrl: data.recordingUrl ? String(data.recordingUrl) : undefined,
      dimensions: Array.isArray(data.dimensions) ? data.dimensions as ProviderResult['dimensions'] : undefined,
      raw: payload,
    };
  }
}

export function verifyProviderWebhook(rawBody: Buffer, signature?: string, timestamp?: string) {
  const secret = process.env.INTERVIEW_PROVIDER_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60 * 1000) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex'));
  const actual = Buffer.from(signature.replace(/^sha256=/, ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

