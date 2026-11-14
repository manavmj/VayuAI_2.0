import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, UserRole } from '../src/types/vayu.ts';

const VALID_ROLES = new Set<UserRole>(['ward_officer', 'housing_society', 'school']);
const SESSION_COOKIE_NAME = 'vayu_session';
const STANDARD_SESSION_TTL_SEC = 8 * 60 * 60; // 8 hours
const DEMO_SESSION_TTL_SEC = 2 * 60 * 60; // 2 hours
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const DATA_DIR = path.resolve(process.cwd(), '.vayu-data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');

interface StoredAccount extends AuthUser {
  passwordHash: string;
}

interface SessionPayload {
  sub: string;
  name: string;
  organization: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isDemo?: boolean;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    return true;
  } catch {
    return false;
  }
}

function resolveSigningSecret(): Buffer {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return createHmac('sha256', 'vayu-session-key')
      .update(process.env.SESSION_SECRET)
      .digest();
  }

  if (ensureDataDir()) {
    try {
      if (fs.existsSync(SECRET_FILE)) {
        const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
        if (existing.length >= 32) {
          return Buffer.from(existing, 'hex');
        }
      }
      const generated = randomBytes(32).toString('hex');
      fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
      return Buffer.from(generated, 'hex');
    } catch {
      // Fallback below if filesystem is read-only
    }
  }

  return randomBytes(32);
}

const SIGNING_KEY = resolveSigningSecret();

// In-memory store synced with .vayu-data/accounts.json when writable
let memoryAccountsCache: StoredAccount[] | null = null;

function readAccounts(): StoredAccount[] {
  if (memoryAccountsCache !== null) {
    return memoryAccountsCache;
  }
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryAccountsCache = parsed as StoredAccount[];
        return memoryAccountsCache;
      }
    }
  } catch {
    // Ignore parse/read error and initialize empty
  }
  memoryAccountsCache = [];
  return memoryAccountsCache;
}

function writeAccounts(accounts: StoredAccount[]): void {
  memoryAccountsCache = accounts;
  if (!ensureDataDir()) return;
  try {
    const tmpPath = `${ACCOUNTS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, ACCOUNTS_FILE);
  } catch {
    // Keep in-memory cache working even on read-only hosting
  }
}

export function sanitizeTextInput(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function isValidEmail(email: string): boolean {
  return email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.has(role as UserRole);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password must include at least one number or special character.';
  }
  return null;
}

export function hashPasswordScrypt(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const actualBuf = scryptSync(password, salt, 64);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signSessionToken(user: AuthUser): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = user.isDemo ? DEMO_SESSION_TTL_SEC : STANDARD_SESSION_TTL_SEC;
  const payload: SessionPayload = {
    sub: user.id,
    name: user.name,
    organization: user.organization,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    isDemo: Boolean(user.isDemo),
    iat: nowSec,
    exp: nowSec + ttl,
    jti: randomBytes(12).toString('hex'),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    createHmac('sha256', SIGNING_KEY).update(encodedPayload).digest()
  );
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  try {
    const expectedSig = toBase64Url(
      createHmac('sha256', SIGNING_KEY).update(encodedPayload).digest()
    );
    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SessionPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
      return null;
    }
    if (!isValidRole(payload.role) || !payload.sub || !payload.email) {
      return null;
    }

    return {
      id: payload.sub,
      name: payload.name,
      organization: payload.organization,
      email: payload.email,
      role: payload.role,
      createdAt: payload.createdAt,
      isDemo: Boolean(payload.isDemo),
    };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function isRequestHttps(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

export function setSessionCookie(req: Request, res: Response, token: string, isDemo = false): void {
  const maxAge = isDemo ? DEMO_SESSION_TTL_SEC : STANDARD_SESSION_TTL_SEC;
  const https = isRequestHttps(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const https = isRequestHttps(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function extractAuthUser(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const verified = verifySessionToken(bearerToken);
    if (verified) return verified;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return verifySessionToken(cookieToken);
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = extractAuthUser(req);
  if (!user) {
    res.status(401).json({
      error: 'Authentication required. Please sign in or register to use Vayu AI analysis endpoints.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  req.authUser = user;
  next();
}

// Security Headers Middleware (iframe-compatible for AI Studio preview)
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (isRequestHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// Sliding-window Rate Limiter
interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  const buckets = new Map<string, RateBucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip) || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      if (buckets.size > 5000) {
        for (const [k, v] of buckets.entries()) {
          if (v.resetAt <= now) buckets.delete(k);
        }
      }
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retrySec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({
        error: `Too many requests. Please wait ${retrySec}s before trying again.`,
      });
      return;
    }

    existing.count += 1;
    next();
  };
}

// Brute-force Failed Login Tracker
interface FailedAttemptRecord {
  failures: number;
  lockedUntil: number;
  lastFailedAt: number;
}

const failedLoginMap = new Map<string, FailedAttemptRecord>();

function getLockKey(req: Request, email: string, role: UserRole): string {
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip) || 'unknown';
  return `${ip}:${email.toLowerCase()}:${role}`;
}

export function checkLoginLockout(
  req: Request,
  email: string,
  role: UserRole
): { locked: boolean; retryAfterSec: number } {
  const key = getLockKey(req, email, role);
  const record = failedLoginMap.get(key);
  if (!record) return { locked: false, retryAfterSec: 0 };
  const now = Date.now();
  if (record.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
    };
  }
  if (now - record.lastFailedAt > LOCKOUT_WINDOW_MS) {
    failedLoginMap.delete(key);
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordFailedLogin(
  req: Request,
  email: string,
  role: UserRole
): { remainingAttempts: number; lockedOut: boolean; retryAfterSec: number } {
  const key = getLockKey(req, email, role);
  const now = Date.now();
  const existing = failedLoginMap.get(key);
  const withinWindow = existing && now - existing.lastFailedAt <= LOCKOUT_WINDOW_MS;
  const nextFailures = withinWindow ? existing.failures + 1 : 1;

  if (nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_WINDOW_MS;
    failedLoginMap.set(key, { failures: nextFailures, lockedUntil, lastFailedAt: now });
    return {
      remainingAttempts: 0,
      lockedOut: true,
      retryAfterSec: Math.ceil(LOCKOUT_WINDOW_MS / 1000),
    };
  }

  failedLoginMap.set(key, {
    failures: nextFailures,
    lockedUntil: 0,
    lastFailedAt: now,
  });

  return {
    remainingAttempts: MAX_FAILED_LOGIN_ATTEMPTS - nextFailures,
    lockedOut: false,
    retryAfterSec: 0,
  };
}

export function clearFailedLogin(req: Request, email: string, role: UserRole): void {
  failedLoginMap.delete(getLockKey(req, email, role));
}

export function registerAccount(params: {
  name: string;
  organization: string;
  email: string;
  role: UserRole;
  password: string;
}): { ok: true; user: AuthUser } | { ok: false; status: number; error: string } {
  const accounts = readAccounts();
  const normalizedEmail = params.email.toLowerCase();
  const duplicate = accounts.some(
    (acc) => acc.email === normalizedEmail && acc.role === params.role
  );
  if (duplicate) {
    return {
      ok: false,
      status: 409,
      error: 'An account with this email and civic role already exists. Please sign in instead.',
    };
  }

  const newAccount: StoredAccount = {
    id: `usr-${randomBytes(8).toString('hex')}`,
    name: params.name,
    organization: params.organization,
    email: normalizedEmail,
    role: params.role,
    createdAt: new Date().toISOString(),
    passwordHash: hashPasswordScrypt(params.password),
  };

  writeAccounts([newAccount, ...accounts]);
  const { passwordHash: _omit, ...publicUser } = newAccount;
  return { ok: true, user: publicUser };
}

export function authenticateAccount(params: {
  email: string;
  role: UserRole;
  password: string;
}): AuthUser | null {
  const accounts = readAccounts();
  const normalizedEmail = params.email.toLowerCase();
  const matched = accounts.find(
    (acc) => acc.email === normalizedEmail && acc.role === params.role
  );
  if (!matched) {
    // Perform a dummy scrypt verification so missing-user timing matches wrong-password timing
    verifyPasswordScrypt(
      params.password,
      'scrypt:00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    );
    return null;
  }
  if (!verifyPasswordScrypt(params.password, matched.passwordHash)) {
    return null;
  }
  const { passwordHash: _omit, ...publicUser } = matched;
  return publicUser;
}
