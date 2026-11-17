/**
 * Authoritative E2E Test Contracts & Helpers for Enterprise Remediation Roadmap
 * Derived strictly from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type express from 'express';

// ==========================================
// 1. LIVE AWS & CLOUDFRONT CONFIGURATIONS
// ==========================================
export const LIVE_KMS_CMK_ALIAS = 'alias/aiastra-pii';
export const LIVE_KMS_CMK_ARN = 'arn:aws:kms:us-east-1:442728149528:key/24477c16-92ec-49b4-9895-6e0c29dce441';
export const LIVE_CUSTOM_DOMAIN = 'https://api.vedic-astrology.app';
export const CLOUDFRONT_ORIGIN = 'https://dzsm2dbswvuqy.cloudfront.net';

// ==========================================
// 2. FEATURE 1: FAIL-CLOSED AUTH & DB LOCKOUT
// ==========================================
export const AUTH_UNAVAILABLE_CODE = 'AUTH_UNAVAILABLE';
export const AUTH_UNAVAILABLE_MESSAGE = 'Authentication service temporarily unavailable.';
export const ACCOUNT_LOCKED_CODE = 'ACCOUNT_LOCKED';
export const ACCOUNT_LOCKED_MESSAGE = 'This account is locked.';
export const MAX_OTP_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface SimulatedOtpRecord {
  email: string;
  codeHash: string;
  attempts: number;
  lockedUntil: number | null;
  createdAt: number;
}

export class OtpLockoutManager {
  private records = new Map<string, SimulatedOtpRecord>();

  recordAttempt(email: string, isCorrect: boolean, now = Date.now()): { success: boolean; locked: boolean; attempts: number } {
    const key = email.toLowerCase().trim();
    let record = this.records.get(key);
    if (!record) {
      record = { email: key, codeHash: 'correct_code', attempts: 0, lockedUntil: null, createdAt: now };
      this.records.set(key, record);
    }

    if (record.lockedUntil && now < record.lockedUntil) {
      return { success: false, locked: true, attempts: record.attempts };
    }

    if (record.lockedUntil && now >= record.lockedUntil) {
      // Lockout expired: reset attempts
      record.attempts = 0;
      record.lockedUntil = null;
    }

    if (isCorrect) {
      record.attempts = 0;
      record.lockedUntil = null;
      return { success: true, locked: false, attempts: 0 };
    }

    record.attempts += 1;
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      return { success: false, locked: true, attempts: record.attempts };
    }

    return { success: false, locked: false, attempts: record.attempts };
  }

  isLocked(email: string, now = Date.now()): boolean {
    const record = this.records.get(email.toLowerCase().trim());
    if (!record || !record.lockedUntil) return false;
    return now < record.lockedUntil;
  }
}

// ==========================================
// 3. FEATURE 2: GRAPHQL ARMOR & ERROR MASKING
// ==========================================
export const GRAPHQL_MAX_DEPTH_DEFAULT = 7;
export const GRAPHQL_MAX_ALIASES_DEFAULT = 15;
export const GRAPHQL_MAX_SELECTIONS_DEFAULT = 100;

export interface GraphqlArmorCheckResult {
  ok: boolean;
  code?: 'DEPTH_LIMIT_EXCEEDED' | 'ALIAS_LIMIT_EXCEEDED' | 'SELECTION_LIMIT_EXCEEDED' | 'INTROSPECTION_DISABLED';
  message?: string;
  depth: number;
  aliases: number;
  selections: number;
}

export function evaluateGraphqlQueryArmor(
  query: string,
  limits: {
    maxDepth?: number;
    maxAliases?: number;
    maxSelections?: number;
    introspectionEnabled?: boolean;
  } = {}
): GraphqlArmorCheckResult {
  const maxDepth = limits.maxDepth ?? GRAPHQL_MAX_DEPTH_DEFAULT;
  const maxAliases = limits.maxAliases ?? GRAPHQL_MAX_ALIASES_DEFAULT;
  const maxSelections = limits.maxSelections ?? GRAPHQL_MAX_SELECTIONS_DEFAULT;
  const introspectionEnabled = limits.introspectionEnabled ?? false;

  // Introspection check
  if (!introspectionEnabled && (query.includes('__schema') || query.includes('__type'))) {
    return {
      ok: false,
      code: 'INTROSPECTION_DISABLED',
      message: 'GraphQL introspection is disabled on this environment.',
      depth: 1,
      aliases: 0,
      selections: 1,
    };
  }

  // 1. Strip comments, block strings and string literals to prevent naive brace counting flaws
  const sanitizedStrings = query
    .replace(/#[^\r\n]*/g, '')
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');

  // Count braces depth accurately on sanitized query
  let currentDepth = 0;
  let maxObservedDepth = 0;
  for (const char of sanitizedStrings) {
    if (char === '{') {
      currentDepth++;
      if (currentDepth > maxObservedDepth) maxObservedDepth = currentDepth;
    } else if (char === '}') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  // 2. Strip parentheses arguments (e.g. `(status: ACTIVE, sort: DESC)`) to eliminate enum argument false aliases
  const sanitizedArgs = sanitizedStrings.replace(/\([^)]*\)/g, '');

  // Count field aliases: pattern `alias: field` inside selection sets
  const aliasMatches = sanitizedArgs.match(/\b[a-zA-Z0-9_]+\s*:\s*[a-zA-Z0-9_]+\b/g) || [];
  const aliasCount = aliasMatches.length;

  // Count selection fields
  const selections = (sanitizedArgs.match(/[a-zA-Z0-9_]+/g) || []).length;

  if (maxObservedDepth > maxDepth) {
    return {
      ok: false,
      code: 'DEPTH_LIMIT_EXCEEDED',
      message: `Query depth ${maxObservedDepth} exceeds maximum allowed depth of ${maxDepth}.`,
      depth: maxObservedDepth,
      aliases: aliasCount,
      selections,
    };
  }

  if (aliasCount > maxAliases) {
    return {
      ok: false,
      code: 'ALIAS_LIMIT_EXCEEDED',
      message: `Field aliases count ${aliasCount} exceeds maximum allowed aliases of ${maxAliases}.`,
      depth: maxObservedDepth,
      aliases: aliasCount,
      selections,
    };
  }

  if (selections > maxSelections) {
    return {
      ok: false,
      code: 'SELECTION_LIMIT_EXCEEDED',
      message: `Field selections count ${selections} exceeds maximum allowed selections of ${maxSelections}.`,
      depth: maxObservedDepth,
      aliases: aliasCount,
      selections,
    };
  }

  return {
    ok: true,
    depth: maxObservedDepth,
    aliases: aliasCount,
    selections,
  };
}

export function maskGraphqlError(
  err: Error | { message?: string; code?: string; stack?: string },
  requestId: string,
  isDev = false
): { message: string; extensions: { code: string; requestId: string } } {
  const allowlistedCodes = new Set([
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'ACCOUNT_LOCKED',
    'AUTH_UNAVAILABLE',
    'DEPTH_LIMIT_EXCEEDED',
    'ALIAS_LIMIT_EXCEEDED',
    'SELECTION_LIMIT_EXCEEDED',
    'INTROSPECTION_DISABLED',
    'BAD_USER_INPUT',
  ]);

  const rawCode = (err as { code?: string }).code || '';
  if (allowlistedCodes.has(rawCode)) {
    return {
      message: err.message || 'Validation Error',
      extensions: { code: rawCode, requestId },
    };
  }

  if (isDev) {
    return {
      message: err.message || 'Internal Error',
      extensions: { code: 'INTERNAL_SERVER_ERROR', requestId },
    };
  }

  return {
    message: 'Something went wrong while processing your request.',
    extensions: { code: 'INTERNAL_SERVER_ERROR', requestId },
  };
}

// ==========================================
// 4. FEATURE 3: M52 APP ERROR TELEMETRY
// ==========================================
export const SENSITIVE_KEY_SUBSTRINGS = [
  'password', 'token', 'secret', 'authorization', 'auth', 'cookie',
  'email', 'phone', 'dob', 'birth', 'lat', 'lon', 'prompt', 'digest',
  'payload', 'apikey', 'key', 'credential', 'cert', 'private', 'dek', 'ssn', 'jwt',
  'hash', 'salt', 'pin',
];

export const SENSITIVE_META_KEYS = new Set([
  ...SENSITIVE_KEY_SUBSTRINGS,
  'variables',
]);

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEY_SUBSTRINGS.some((sub) => normalized.includes(sub)) || SENSITIVE_META_KEYS.has(key.toLowerCase());
}

export function scrubTelemetryValue(val: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated-depth]';
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    let s = val;
    // Redact email addresses
    s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]');
    // Redact JWT patterns
    s = s.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[redacted-jwt]');
    // Redact Bearer tokens
    s = s.replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [redacted-token]');
    return s;
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => scrubTelemetryValue(item, depth + 1));
  }

  if (typeof val === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        scrubbed[k] = '[redacted]';
      } else {
        scrubbed[k] = scrubTelemetryValue(v, depth + 1);
      }
    }
    return scrubbed;
  }

  return String(val);
}

export function scrubTelemetryMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  return scrubTelemetryValue(meta) as Record<string, unknown>;
}

export const redactTelemetryPayload = scrubTelemetryMeta;
export { OtpLockoutManager as OtpLockoutStateMachine };

export interface AppErrorEventRecord {
  id: string;
  source: 'web_js' | 'web_react' | 'web_network' | 'web_csp' | 'graphql' | 'server_rest' | 'server_auth' | 'rbac';
  severity: 'warn' | 'error' | 'critical';
  category: string;
  errorCode: string | null;
  statusCode: number | null;
  page: string | null;
  message: string;
  requestId: string | null;
  sessionId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  retentionExpiresAt: string;
}

export function createAppErrorRecord(
  input: Omit<AppErrorEventRecord, 'id' | 'createdAt' | 'retentionExpiresAt' | 'meta'> & { meta?: Record<string, unknown> },
  now = Date.now()
): AppErrorEventRecord {
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  return {
    id: randomUUID(),
    source: input.source,
    severity: input.severity,
    category: input.category,
    errorCode: input.errorCode ?? null,
    statusCode: input.statusCode ?? null,
    page: input.page ?? null,
    message: input.message.slice(0, 500),
    requestId: input.requestId ?? null,
    sessionId: input.sessionId ?? null,
    meta: scrubTelemetryMeta(input.meta),
    createdAt: new Date(now).toISOString(),
    retentionExpiresAt: new Date(now + RETENTION_MS).toISOString(),
  };
}

// ==========================================
// 5. FEATURE 16 & 17: KMS KEY PROVIDER & MOCK
// ==========================================
export interface PiiKeyProviderContract {
  readonly kind: 'local' | 'kms';
  dataKey(keyRef: string): Promise<Buffer>;
  createKey(): Promise<string>;
  mac(value: string): Promise<Buffer>;
  destroyKey(keyRef: string): Promise<void>;
}

export class MockKmsKeyProvider implements PiiKeyProviderContract {
  readonly kind = 'kms' as const;
  private masterKey: Buffer;
  private keyStore = new Map<string, { wrappedDek: Buffer; tag: Buffer; iv: Buffer }>();
  private destroyed = new Set<string>();

  constructor(masterKey?: Buffer) {
    this.masterKey = masterKey ?? Buffer.from('mock-master-kms-key-32-bytes!!12');
    if (this.masterKey.length !== 32) {
      throw new Error('Master key must be exactly 32 bytes');
    }
  }

  async createKey(): Promise<string> {
    const keyRef = randomUUID();
    const rawDek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    cipher.setAAD(Buffer.from(keyRef, 'utf8'));
    const wrapped = Buffer.concat([cipher.update(rawDek), cipher.final()]);
    const tag = cipher.getAuthTag();

    this.keyStore.set(keyRef, { wrappedDek: wrapped, tag, iv });
    return keyRef;
  }

  async dataKey(keyRef: string): Promise<Buffer> {
    if (this.destroyed.has(keyRef)) {
      throw new Error('PII_UNAVAILABLE: key has been destroyed');
    }
    const item = this.keyStore.get(keyRef);
    if (!item) {
      // Deterministic generation if not explicitly created
      const iv = randomBytes(12);
      const rawDek = createHmac('sha256', this.masterKey).update(`dek:${keyRef}`).digest();
      const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
      cipher.setAAD(Buffer.from(keyRef, 'utf8'));
      const wrapped = Buffer.concat([cipher.update(rawDek), cipher.final()]);
      const tag = cipher.getAuthTag();
      this.keyStore.set(keyRef, { wrappedDek: wrapped, tag, iv });
      return rawDek;
    }

    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, item.iv);
    decipher.setAAD(Buffer.from(keyRef, 'utf8'));
    decipher.setAuthTag(item.tag);
    return Buffer.concat([decipher.update(item.wrappedDek), decipher.final()]);
  }

  async mac(value: string): Promise<Buffer> {
    return createHmac('sha256', this.masterKey).update(value).digest();
  }

  async destroyKey(keyRef: string): Promise<void> {
    this.destroyed.add(keyRef);
    this.keyStore.delete(keyRef);
  }
}

// Sealed Models field encryption using AES-256-GCM
export async function sealPiiField(plainText: string, dek: Buffer): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: "pii2:v1:<iv-base64>:<tag-base64>:<ciphertext-base64>"
  return `pii2:v1:${iv.toString('base64')}:${tag.toString('base64')}:${cipherText.toString('base64')}`;
}

export async function unsealPiiField(sealed: string, dek: Buffer): Promise<string> {
  const parts = sealed.split(':');
  if (parts.length !== 5 || parts[0] !== 'pii2' || parts[1] !== 'v1') {
    throw new Error('PII_UNAVAILABLE: malformed sealed format');
  }
  const iv = Buffer.from(parts[2]!, 'base64');
  const tag = Buffer.from(parts[3]!, 'base64');
  const cipherText = Buffer.from(parts[4]!, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
}

// ==========================================
// 6. FEATURE 18 & 19: COOKIE AUTH & CSRF
// ==========================================
export interface CookieAuthHeaders {
  cookieHeader: string;
  csrfTokenHeader?: string;
  authorizationHeader?: string;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [rawName, ...rawVal] = part.trim().split('=');
    if (rawName) {
      cookies[rawName.trim()] = rawVal.join('=').trim();
    }
  }
  return cookies;
}

export function formatAuthCookies(jwtToken: string, csrfToken: string, domain?: string): { jwtCookie: string; csrfCookie: string } {
  const domainPart = domain ? `; Domain=${domain}` : '';
  const jwtCookie = `aastra_jwt=${jwtToken}; HttpOnly; Secure; SameSite=Lax; Path=/${domainPart}; Max-Age=2592000`;
  const csrfCookie = `aastra_csrf=${csrfToken}; Secure; SameSite=Lax; Path=/${domainPart}; Max-Age=2592000`;
  return { jwtCookie, csrfCookie };
}

export function validateCsrfForRequest(
  method: string,
  cookies: Record<string, string>,
  headers: Record<string, string | string[] | undefined>
): { valid: boolean; status: number; reason?: string } {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(method.toUpperCase())) {
    return { valid: true, status: 200 };
  }

  // Mobile / programmatic Bearer fallback bypasses CSRF
  const authHeader = headers['authorization'] || headers['x-astra-authorization'];
  const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (authStr?.startsWith('Bearer ')) {
    return { valid: true, status: 200, reason: 'bearer_bypass' };
  }

  const cookieCsrf = cookies['aastra_csrf'];
  const headerCsrfRaw = headers['x-csrf-token'];
  const headerCsrf = Array.isArray(headerCsrfRaw) ? headerCsrfRaw[0] : headerCsrfRaw;

  if (!cookieCsrf) {
    return { valid: false, status: 403, reason: 'missing_csrf_cookie' };
  }
  if (!headerCsrf) {
    return { valid: false, status: 403, reason: 'missing_csrf_header' };
  }
  if (cookieCsrf !== headerCsrf) {
    return { valid: false, status: 403, reason: 'csrf_mismatch' };
  }

  return { valid: true, status: 200 };
}

// ==========================================
// 7. FEATURE 20: RESUMABLE CHAT TURN STATE MACHINE
// ==========================================
export interface ChatTurnEvent {
  seq: number;
  type: 'turn_init' | 'token' | 'done' | 'error';
  delta?: string;
  turnId: string;
  chatId?: string;
  answer?: string;
  error?: string;
}

export class ChatTurnStateMachine {
  private events: ChatTurnEvent[] = [];
  public state: 'pending' | 'streaming' | 'finished' | 'failed' = 'pending';
  public readonly turnId: string;
  public readonly question: string;

  constructor(turnId: string, question: string) {
    this.turnId = turnId;
    this.question = question;
  }

  startStream(chatId: string): ChatTurnEvent {
    this.state = 'streaming';
    const initEvent: ChatTurnEvent = {
      seq: 0,
      type: 'turn_init',
      turnId: this.turnId,
      chatId,
    };
    this.events.push(initEvent);
    return initEvent;
  }

  appendToken(delta: string): ChatTurnEvent {
    const nextSeq = this.events.length;
    const tokenEvent: ChatTurnEvent = {
      seq: nextSeq,
      type: 'token',
      turnId: this.turnId,
      delta,
    };
    this.events.push(tokenEvent);
    return tokenEvent;
  }

  finish(answer: string, chatId?: string): ChatTurnEvent {
    const nextSeq = this.events.length;
    const doneEvent: ChatTurnEvent = {
      seq: nextSeq,
      type: 'done',
      turnId: this.turnId,
      chatId,
      answer,
    };
    this.events.push(doneEvent);
    this.state = 'finished';
    return doneEvent;
  }

  fail(errorMessage: string): ChatTurnEvent {
    const nextSeq = this.events.length;
    const errorEvent: ChatTurnEvent = {
      seq: nextSeq,
      type: 'error',
      turnId: this.turnId,
      error: errorMessage,
    };
    this.events.push(errorEvent);
    this.state = 'failed';
    return errorEvent;
  }

  resumeFrom(lastSeq: number): ChatTurnEvent[] {
    return this.events.filter((e) => e.seq > lastSeq);
  }

  getLatestSeq(): number {
    return this.events.length > 0 ? this.events[this.events.length - 1]!.seq : -1;
  }
}

// ==========================================
// 8. FEATURE 13 & 14: RADHA BATCH CONTRACT
// ==========================================
export interface RadhaBatchRequest {
  dob: string;
  tob: string;
  place: string;
  lat: number;
  lon: number;
  tz: number;
  ayanamsa: string;
  fields: string[];
}

export interface RadhaBatchResponse {
  status: 'ok' | 'error';
  calc_versions: Record<string, string>;
  charts: {
    biodata?: Record<string, unknown>;
    d1?: Record<string, unknown>;
    d9?: Record<string, unknown>;
    d10?: Record<string, unknown>;
    charakaraka?: Record<string, unknown>;
    vimsottari_dasa?: Record<string, unknown>;
    narayana_dasa?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: string;
}

export function validateRadhaBatchRequest(req: unknown): { valid: boolean; error?: string } {
  if (!req || typeof req !== 'object') return { valid: false, error: 'Request body must be an object' };
  const r = req as Record<string, unknown>;
  if (!r.dob || typeof r.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.dob)) {
    return { valid: false, error: 'Invalid or missing dob (YYYY-MM-DD)' };
  }
  if (!r.tob || typeof r.tob !== 'string') {
    return { valid: false, error: 'Invalid or missing tob' };
  }
  if (typeof r.lat !== 'number' || r.lat < -90 || r.lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }
  if (typeof r.lon !== 'number' || r.lon < -180 || r.lon > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }
  if (!Array.isArray(r.fields)) {
    return { valid: false, error: 'Fields must be an array' };
  }
  return { valid: true };
}
