import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type AuthUser = {
  id: string;
  name: string;
  role: string;
  projectKeys: string[];
  jobKeys: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SESSION_COOKIE = 'zhimian_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 SESSION_SECRET');
  }
  return value || 'development-only-change-me';
}

export function validateAuthConfiguration() {
  sessionSecret();
  developmentUsers();
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSession(user: AuthUser) {
  const payload = encode({
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token?: string): AuthUser | undefined {
  if (!token) return undefined;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return undefined;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthUser & { exp: number };
    if (parsed.exp < Math.floor(Date.now() / 1000)) return undefined;
    return {
      id: parsed.id,
      name: parsed.name,
      role: parsed.role,
      projectKeys: parsed.projectKeys || [],
      jobKeys: parsed.jobKeys || [],
    };
  } catch {
    return undefined;
  }
}

export function authenticate(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  request.user = verifySession(token);
  if (!request.user) {
    response.status(401).json({ message: '登录已失效，请重新登录' });
    return;
  }
  next();
}

export function setSessionCookie(response: Response, user: AuthUser) {
  response.cookie(SESSION_COOKIE, createSession(user), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function verifyPassword(password: string, encoded: string) {
  const [salt, expectedHex] = encoded.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function developmentUsers(): Array<AuthUser & { username: string; passwordHash: string }> {
  if (process.env.AUTH_USERS_JSON) {
    return JSON.parse(process.env.AUTH_USERS_JSON) as Array<AuthUser & { username: string; passwordHash: string }>;
  }
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('生产环境必须配置 AUTH_USERS_JSON 或 ADMIN_PASSWORD，禁止使用开发默认账号');
  }
  const password = process.env.ADMIN_PASSWORD || 'Zhimian@2026';
  const salt = 'zhimian-local';
  return [{
    id: 'user-admin',
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: `${salt}:${scryptSync(password, salt, 32).toString('hex')}`,
    name: '系统管理员',
    role: '超级管理员',
    projectKeys: [],
    jobKeys: [],
  }];
}
