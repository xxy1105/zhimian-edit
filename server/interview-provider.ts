export type CreateInterviewInput = {
  requestId: string;
  candidate: {
    id: string;
    name: string;
    email?: string;
    resumeText?: string;
  };
  project: string;
  job: string;
  jdText: string;
  focusAreas?: string[];
  defaultDifficulty?: string;
  firstQuestion?: string;
  firstQuestionKeywords?: string;
  lastQuestion?: string;
  lastQuestionKeywords?: string;
  expiresAt: string;
};

export type ProviderInterview = {
  providerInterviewId: string;
  interviewUrl: string;
  accessToken?: string;
  expiresAt: string;
  status: string;
};

export type ProviderQaRecord = {
  id?: string;
  question?: string;
  candidateAnswer?: string;
  recordingUrl?: string;
  recordingStatus?: string;
};

export type ProviderResult = {
  providerInterviewId: string;
  status: string;
  connectionStatus?: string;
  qaRecords: ProviderQaRecord[];
  recordingUrl?: string;
};

export interface InterviewProvider {
  create(input: CreateInterviewInput): Promise<ProviderInterview>;
  regenerate(providerInterviewId: string, input: CreateInterviewInput): Promise<ProviderInterview>;
  cancel(providerInterviewId: string): Promise<void>;
  getResult(providerInterviewId: string): Promise<ProviderResult>;
}

export class ProviderNotConfiguredError extends Error {
  status = 503;

  constructor() {
    super('AI 面试服务尚未配置，请设置 Provider Base URL 和 API Key');
  }
}

function providerConfig() {
  return {
    baseUrl: process.env.INTERVIEW_PROVIDER_BASE_URL?.replace(/\/$/, ''),
    apiKey: process.env.INTERVIEW_PROVIDER_API_KEY,
    adminPath: process.env.INTERVIEW_PROVIDER_ADMIN_PATH || '/api/admin/interview-links',
    timeout: Number(process.env.INTERVIEW_PROVIDER_TIMEOUT_MS || 15000),
  };
}

async function providerRequest(path: string, init: RequestInit = {}) {
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
        'X-API-Key': config.apiKey,
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const error = new Error(String(payload.error || payload.message || `面试引擎返回 ${response.status}`)) as Error & { status?: number };
      error.status = response.status === 401 ? 502 : response.status >= 500 ? 502 : response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function optionalString(value: unknown) {
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

function normalizeStatus(value: unknown) {
  const status = String(value || 'UNKNOWN');
  if (['completed', 'complete', 'finished', 'done', '已完成'].includes(status.toLowerCase())) return 'COMPLETED';
  return status.toUpperCase();
}

function resolveInterviewUrl(value: unknown) {
  const url = String(value || '');
  if (!url) return '';
  try {
    const resolved = new URL(url, `${providerConfig().baseUrl}/`);
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      throw new Error('unsupported protocol');
    }
    return resolved.toString();
  } catch {
    throw Object.assign(new Error('面试引擎返回了无效的 URL'), { status: 502 });
  }
}

function normalizeInterview(payload: Record<string, unknown>, fallbackExpiresAt: string): ProviderInterview {
  const item = (payload.item || payload.data || payload.result || payload) as Record<string, unknown>;
  const providerInterviewId = String(item.id || item.interview_link_id || item.interviewLinkId || '');
  const interviewUrl = resolveInterviewUrl(payload.interviewUrl || payload.interview_url || item.interviewUrl || item.interview_url || item.url);
  if (!providerInterviewId || !interviewUrl) {
    throw Object.assign(new Error('面试引擎响应缺少 item.id 或 interviewUrl'), { status: 502 });
  }
  return {
    providerInterviewId,
    interviewUrl,
    accessToken: optionalString(item.token),
    expiresAt: String(item.expires_at || item.expiresAt || fallbackExpiresAt),
    status: normalizeStatus(item.status || item.connection_status || 'PENDING'),
  };
}

function createPayload(input: CreateInterviewInput) {
  const expiresInDays = Math.max(1, Math.ceil((new Date(input.expiresAt).getTime() - Date.now()) / 86400000));
  return {
    candidate_name: input.candidate.name,
    candidate_email: input.candidate.email,
    resume_text: input.candidate.resumeText,
    jd_title: input.job,
    jd_text: input.jdText,
    focus_areas: input.focusAreas,
    default_difficulty: input.defaultDifficulty || process.env.INTERVIEW_PROVIDER_DEFAULT_DIFFICULTY || 'medium',
    first_question: input.firstQuestion || process.env.INTERVIEW_PROVIDER_FIRST_QUESTION,
    first_question_keywords: input.firstQuestionKeywords || process.env.INTERVIEW_PROVIDER_FIRST_QUESTION_KEYWORDS,
    last_question: input.lastQuestion || process.env.INTERVIEW_PROVIDER_LAST_QUESTION,
    last_question_keywords: input.lastQuestionKeywords || process.env.INTERVIEW_PROVIDER_LAST_QUESTION_KEYWORDS,
    auto_next: process.env.INTERVIEW_PROVIDER_AUTO_NEXT !== 'false',
    next_break_seconds: Number(process.env.INTERVIEW_PROVIDER_NEXT_BREAK_SECONDS || 30),
    tts_voice: process.env.INTERVIEW_PROVIDER_TTS_VOICE || 'zh_female_xiaohe_uranus_bigtts',
    expires_in_days: expiresInDays,
    max_interview_duration: Number(process.env.INTERVIEW_PROVIDER_MAX_DURATION_SECONDS || 1800),
    interview_timeout: Number(process.env.INTERVIEW_PROVIDER_TIMEOUT_SECONDS || 60),
    interviewer_name: process.env.INTERVIEW_PROVIDER_INTERVIEWER_NAME || 'AI·嘉欣',
  };
}

export class HttpInterviewProvider implements InterviewProvider {
  async create(input: CreateInterviewInput) {
    const config = providerConfig();
    return normalizeInterview(await providerRequest(config.adminPath, {
      method: 'POST',
      headers: { 'Idempotency-Key': input.requestId },
      body: JSON.stringify(createPayload(input)),
    }), input.expiresAt);
  }

  async regenerate(providerInterviewId: string, input: CreateInterviewInput) {
    const replacement = await this.create(input);
    try {
      await this.cancel(providerInterviewId);
      return replacement;
    } catch (error) {
      await this.cancel(replacement.providerInterviewId).catch(() => undefined);
      throw error;
    }
  }

  async cancel(providerInterviewId: string) {
    const config = providerConfig();
    await providerRequest(`${config.adminPath}/${encodeURIComponent(providerInterviewId)}`, { method: 'DELETE' });
  }

  async getResult(providerInterviewId: string): Promise<ProviderResult> {
    const config = providerConfig();
    const payload = await providerRequest(`${config.adminPath}/${encodeURIComponent(providerInterviewId)}`);
    const link = (payload.link || {}) as Record<string, unknown>;
    const qaRecords = (Array.isArray(payload.qaRecords) ? payload.qaRecords : [])
      .map((record) => record as Record<string, unknown>)
      .map((record) => ({
        id: optionalString(record.id || record.qa_id),
        question: optionalString(record.question || record.question_text),
        candidateAnswer: optionalString(record.candidate_answer || record.candidateAnswer),
        recordingUrl: record.recording_url || record.recordingUrl
          ? resolveInterviewUrl(record.recording_url || record.recordingUrl)
          : undefined,
        recordingStatus: optionalString(record.recording_status || record.recordingStatus),
      }));
    const completed = link.is_completed === true
      || Boolean(link.completed_at || link.completedAt || link.finished_at || link.finishedAt);
    const statusValue = link.status || link.interview_status || (completed ? 'COMPLETED' : link.connection_status);
    return {
      providerInterviewId,
      status: normalizeStatus(statusValue),
      connectionStatus: optionalString(link.connection_status),
      qaRecords,
      recordingUrl: qaRecords.find((record) => record.recordingUrl)?.recordingUrl,
    };
  }
}
