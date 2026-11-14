/**
 * Dual-plane error telemetry (`app_error_events`, M52):
 * Collects PII-redacted error records from Server (auth 503, OTP lockouts, RBAC denials, GraphQL masking/armor,
 * unhandled REST 5xx) and Web (`POST /api/telemetry/client-errors`, `POST /api/telemetry/csp-report`), correlated via
 * `request_id` / `session_id` for `aiadastra_admin` (`/errors` and `/security`).
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import {
  getClientErrorBatchMax,
  getErrorTelemetryRetentionDays,
  isDevOrLocal,
} from '../config/env.js';
import {
  computeStackFingerprint,
  maskIpAddress,
  redactErrorText,
  redactStackPreview,
} from '../lib/logRedact.js';
import { normalizePagePath } from './pageTiming.js';

export type AppErrorSource =
  | 'web_js'
  | 'web_react'
  | 'web_network'
  | 'web_csp'
  | 'graphql'
  | 'server_rest'
  | 'server_auth'
  | 'rbac';

export type AppErrorSeverity = 'warn' | 'error' | 'critical';

export interface RecordAppErrorInput {
  source: AppErrorSource;
  severity?: AppErrorSeverity;
  category: string;
  errorCode?: string | null;
  statusCode?: number | null;
  page?: string | null;
  operation?: string | null;
  message: unknown;
  stack?: unknown;
  requestId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
}

const VALID_CLIENT_SOURCES = new Set<AppErrorSource>(['web_js', 'web_react', 'web_network', 'web_csp']);
const VALID_SEVERITIES = new Set<AppErrorSeverity>(['warn', 'error', 'critical']);
const SENSITIVE_META_KEY = /^(password|token|secret|authorization|cookie|email|dob|birth|lat|lon|variables|prompt|digest|payload|apikey|key)$/i;

export function sanitizeErrorMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (count >= 16) break;
    if (SENSITIVE_META_KEY.test(k)) {
      out[k] = '[redacted]';
      count++;
      continue;
    }
    if (typeof v === 'string') {
      out[k] = redactErrorText(v, 200);
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 10).map((x) => (typeof x === 'string' ? redactErrorText(x, 100) : typeof x === 'number' || typeof x === 'boolean' ? x : '[object]'));
    } else if (v && typeof v === 'object') {
      out[k] = redactErrorText(JSON.stringify(v), 200);
    }
    count++;
  }
  return out;
}

export function extractRequestIp(req: express.Request | { headers?: Record<string, string | string[] | undefined>; ip?: string }): string | null {
  const xff = req.headers?.['x-forwarded-for'];
  const rawXff = Array.isArray(xff) ? xff[0] : xff;
  if (typeof rawXff === 'string' && rawXff.trim()) {
    return rawXff.split(',')[0]!.trim();
  }
  return typeof req.ip === 'string' && req.ip ? req.ip : null;
}

export function extractRequestIdFromReq(req: { headers?: Record<string, string | string[] | undefined>; requestId?: string }): string | null {
  if (typeof req.requestId === 'string' && req.requestId) return req.requestId;
  const raw = req.headers?.['x-request-id'];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return typeof val === 'string' && val.trim() ? val.trim().slice(0, 64) : null;
}

/** Attach/propagate a consistent `X-Request-Id` across Express, PageExecutionLog, GraphQL, and Admin AppErrorEvents. */
export function requestIdMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const rawHeader = req.headers['x-request-id'];
  const candidate = typeof rawHeader === 'string' ? rawHeader.trim() : '';
  const id = /^[A-Za-z0-9._-]{8,64}$/.test(candidate) ? candidate : randomUUID();
  (req as express.Request & { requestId?: string }).requestId = id;
  req.headers['x-request-id'] = id;
  if (!res.headersSent) {
    res.setHeader('X-Request-Id', id);
  }
  next();
}

export function sanitizeUriForCsp(uri: unknown): string {
  if (typeof uri !== 'string' || !uri.trim()) return 'unknown';
  const trimmed = uri.trim();
  if (/^(inline|eval|data|blob|wasm-unsafe-eval|self)$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 200);
  } catch {
    return redactErrorText(trimmed.split('?')[0], 200) || 'unknown';
  }
}

export async function recordAppError(
  prisma: PrismaClient | null | undefined,
  input: RecordAppErrorInput
): Promise<boolean> {
  const model = (
    prisma as unknown as {
      appErrorEvent?: { create?: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    } | null
  )?.appErrorEvent;
  if (!model?.create) return false;

  const messageRedacted = redactErrorText(input.message || input.errorCode || input.category, 600) || 'Unknown error';
  const stackPreview = redactStackPreview(input.stack, 8);
  const errorCode = String(input.errorCode || input.category || 'UNKNOWN_ERROR')
    .trim()
    .slice(0, 80);
  const category = String(input.category || 'general').trim().slice(0, 64);
  const severity: AppErrorSeverity = VALID_SEVERITIES.has(input.severity ?? 'error') ? (input.severity ?? 'error') : 'error';
  const stackFingerprint = computeStackFingerprint({
    source: input.source,
    category,
    errorCode,
    topFrame: stackPreview,
    message: messageRedacted,
  });

  const normalizedPage = input.page
    ? normalizePagePath(input.page, null, input.operation ?? null).pagePath.slice(0, 120)
    : null;

  try {
    await model.create({
      data: {
        source: input.source.slice(0, 32),
        severity,
        category,
        error_code: errorCode,
        status_code: typeof input.statusCode === 'number' && Number.isFinite(input.statusCode) ? Math.round(input.statusCode) : null,
        page: normalizedPage,
        operation: input.operation ? String(input.operation).trim().slice(0, 160) : null,
        message_redacted: messageRedacted,
        stack_fingerprint: stackFingerprint,
        stack_preview: stackPreview,
        request_id: input.requestId ? String(input.requestId).trim().slice(0, 64) : null,
        session_id: input.sessionId ? String(input.sessionId).trim().slice(0, 64) : null,
        user_id: input.userId ? String(input.userId).trim() : null,
        ip_masked: maskIpAddress(input.ip),
        user_agent: input.userAgent ? String(input.userAgent).trim().slice(0, 300) : null,
        meta: sanitizeErrorMeta(input.meta),
      },
    });
    return true;
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'app_error_events write failed', error: redactErrorText(err, 120) }));
    return false;
  }
}

const DAY_MS = 24 * 3_600_000;

export async function sweepAppErrorEvents(
  prisma: PrismaClient | null | undefined,
  opts: { retentionDays?: number; now?: Date } = {}
): Promise<number> {
  const model = (
    prisma as unknown as {
      appErrorEvent?: { deleteMany?: (args: { where: { created_at: { lt: Date } } }) => Promise<{ count: number }> };
    } | null
  )?.appErrorEvent;
  if (!model?.deleteMany) return 0;
  const now = opts.now ?? new Date();
  const days = opts.retentionDays ?? getErrorTelemetryRetentionDays();
  const cutoff = new Date(now.getTime() - Math.max(1, days) * DAY_MS);
  try {
    const res = await model.deleteMany({ where: { created_at: { lt: cutoff } } });
    return res.count;
  } catch {
    return 0;
  }
}

export interface AppErrorRoutesDeps {
  prisma: PrismaClient;
  optionalUser: (req: express.Request) => Promise<string | null>;
}

export function registerAppErrorRoutes(app: express.Express, deps: AppErrorRoutesDeps): void {
  const telemetryRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: isDevOrLocal() ? 240 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    handler: (_req, res) => {
      res.status(429).json({ error: 'rate_limited' });
    },
  });

  app.post('/api/telemetry/client-errors', telemetryRateLimit, async (req, res) => {
    const body = req.body as { events?: unknown; sessionId?: unknown } | undefined;
    const rawEvents = Array.isArray(body?.events) ? body.events : null;
    if (!rawEvents) {
      return res.status(400).json({ error: 'events array is required' });
    }

    let userId: string | null = null;
    try {
      userId = await deps.optionalUser(req);
    } catch {
      userId = null;
    }

    const headerSession = typeof req.headers['x-astra-session'] === 'string' ? req.headers['x-astra-session'].trim() : null;
    const bodySession = typeof body?.sessionId === 'string' ? body.sessionId.trim() : null;
    const headerPage = typeof req.headers['x-astra-page'] === 'string' ? req.headers['x-astra-page'].trim() : null;
    const reqId = extractRequestIdFromReq(req as express.Request & { requestId?: string });
    const ip = extractRequestIp(req);
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const batch = rawEvents.slice(0, getClientErrorBatchMax());
    let accepted = 0;

    for (const raw of batch) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const rawSource = typeof item.source === 'string' ? (item.source as AppErrorSource) : 'web_js';
      const source: AppErrorSource = VALID_CLIENT_SOURCES.has(rawSource) ? rawSource : 'web_js';
      const category = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'js_runtime';
      const rawSeverity = typeof item.severity === 'string' ? (item.severity as AppErrorSeverity) : 'error';
      const severity: AppErrorSeverity = VALID_SEVERITIES.has(rawSeverity) ? rawSeverity : 'error';
      const message = typeof item.message === 'string' ? item.message : '';
      if (!message.trim()) continue;

      const wrote = await recordAppError(deps.prisma, {
        source,
        severity,
        category,
        errorCode: typeof item.errorCode === 'string' ? item.errorCode : null,
        statusCode: typeof item.statusCode === 'number' ? item.statusCode : null,
        page: typeof item.page === 'string' && item.page.trim() ? item.page : headerPage ?? '/',
        operation: typeof item.operation === 'string' ? item.operation : null,
        message,
        stack: typeof item.stack === 'string' ? item.stack : null,
        requestId: typeof item.requestId === 'string' && item.requestId.trim() ? item.requestId : reqId,
        sessionId: typeof item.sessionId === 'string' && item.sessionId.trim() ? item.sessionId : headerSession ?? bodySession,
        userId,
        ip,
        userAgent: ua,
        meta: item.meta && typeof item.meta === 'object' && !Array.isArray(item.meta) ? (item.meta as Record<string, unknown>) : null,
      });
      if (wrote) accepted++;
    }

    return res.status(202).json({ accepted });
  });

  app.post(
    '/api/telemetry/csp-report',
    telemetryRateLimit,
    express.json({ type: ['application/json', 'application/csp-report', 'application/reports+json'], limit: '32kb' }),
    async (req, res) => {
      let userId: string | null = null;
      try {
        userId = await deps.optionalUser(req);
      } catch {
        userId = null;
      }

      const ip = extractRequestIp(req);
      const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
      const reqId = extractRequestIdFromReq(req as express.Request & { requestId?: string });
      const rawBody = req.body as unknown;

      const reports: Array<Record<string, unknown>> = [];
      if (Array.isArray(rawBody)) {
        for (const entry of rawBody.slice(0, 10)) {
          if (entry && typeof entry === 'object' && (entry as { body?: unknown }).body && typeof (entry as { body: unknown }).body === 'object') {
            reports.push((entry as { body: Record<string, unknown> }).body);
          }
        }
      } else if (rawBody && typeof rawBody === 'object') {
        const legacy = (rawBody as { 'csp-report'?: unknown })['csp-report'];
        reports.push(legacy && typeof legacy === 'object' ? (legacy as Record<string, unknown>) : (rawBody as Record<string, unknown>));
      }

      for (const r of reports) {
        const violated = String(r['effective-directive'] ?? r['effectiveDirective'] ?? r['violated-directive'] ?? r['violatedDirective'] ?? 'unknown').slice(0, 120);
        const blocked = sanitizeUriForCsp(r['blocked-uri'] ?? r['blockedURL']);
        const docUri = sanitizeUriForCsp(r['document-uri'] ?? r['documentURL']);
        let pagePath = '/';
        try {
          pagePath = new URL(docUri).pathname || '/';
        } catch {
          pagePath = '/';
        }
        await recordAppError(deps.prisma, {
          source: 'web_csp',
          severity: 'warn',
          category: 'csp_violation',
          errorCode: 'CSP_VIOLATION',
          page: pagePath,
          operation: violated,
          message: `CSP blocked ${blocked} under ${violated}`,
          requestId: reqId,
          sessionId: typeof req.headers['x-astra-session'] === 'string' ? req.headers['x-astra-session'] : null,
          userId,
          ip,
          userAgent: ua,
          meta: {
            violatedDirective: violated,
            blockedUri: blocked,
            sourceFile: r['source-file'] ? sanitizeUriForCsp(r['source-file']) : undefined,
            lineNumber: typeof r['line-number'] === 'number' ? r['line-number'] : undefined,
          },
        });
      }

      return res.status(204).end();
    }
  );
}
