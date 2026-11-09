/**
 * Page Response Times & Section Streaming Telemetry (docs/admin/08).
 *
 * 1. Normalizes raw page paths (`X-Astra-Page` header, client beacon paths, or server route + operation names)
 *    to canonical application page routes so the Admin Module can aggregate and drill down per page.
 * 2. Express middleware (`pageTimingMiddleware`) that captures per-request server execution latency
 *    (`duration_ms`, `ttfb_ms`, `server_ms`, `body_bytes`, `status_code`, `source`, `operation`, `user_id`)
 *    and persists to `page_execution_logs` via Prisma (zero raw SQL, zero personal/PII fields).
 * 3. `POST /api/telemetry/page-timings` for client-side route navigation, render, and draw timings (`client_render`).
 * 4. `GET /api/dashboard/sections-stream` for progressive NDJSON lazy section streaming (`section_stream`),
 *    delivering `profile`, `chart_status`, `biodata`, `content`, and `timeline` as each section resolves
 *    and recording per-section execution times.
 */

import { randomUUID } from 'node:crypto';
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPageSlowThresholdMs, getPageTimingRetentionDays, isPageTimingEnabled } from '../config/env.js';
import { graphqlLogFields } from '../lib/logRedact.js';
import { getChartStatus } from '../services/chartStatusService.js';
import { readChartColumns } from '../reading/chartData/chartsPageReader.js';
import { prismaChartDataRepo } from '../reading/chartData/store.js';
import { listLedger, resolveKundli } from '../reading/timeline/ledgerStore.js';
import { ownProfileFields } from '../services/profileService.js';
import { canonicalRole } from '../auth/roles.js';

export type PageTimingSource =
  | 'server_request'
  | 'graphql'
  | 'sse_stream'
  | 'client_render'
  | 'section_stream';

export const CANONICAL_PAGE_ROUTES = [
  '/',
  '/signin',
  '/signup',
  '/signup/details',
  '/dashboard/chat',
  '/dashboard/charts',
  '/dashboard/mantras',
  '/dashboard/remedies',
  '/dashboard/you',
  '/dashboard/love',
  '/dashboard/work',
  '/dashboard/today',
  '/dashboard/lucky',
  '/profile',
  '/profile/plan',
  '/profile/settings',
  '/profile/timeline',
  '/pricing',
  '/terms',
  '/privacy',
  '/refunds',
] as const;

export type CanonicalPageRoute = (typeof CANONICAL_PAGE_ROUTES)[number] | string;

const CANONICAL_SET = new Set<string>(CANONICAL_PAGE_ROUTES);

const OPERATION_TO_PAGE: Record<string, string> = {
  // Auth & onboarding
  requestMagicLink: '/signin',
  loginWithMagicLink: '/signin',
  startSignup: '/signup',
  verifySignupCode: '/signup',
  signup: '/signup',
  completeProfile: '/signup/details',
  // Chat
  ask: '/dashboard/chat',
  askStream: '/dashboard/chat',
  askingGuide: '/dashboard/chat',
  myChats: '/dashboard/chat',
  chatMessages: '/dashboard/chat',
  createChat: '/dashboard/chat',
  renameChat: '/dashboard/chat',
  deleteChat: '/dashboard/chat',
  // Charts & Biodata
  myCharts: '/dashboard/charts',
  myBiodata: '/dashboard/charts',
  chartStatus: '/dashboard/charts',
  // Mantras & Remedies
  myContent: '/dashboard/mantras',
  // Profile & Settings
  me: '/profile',
  meDetails: '/dashboard/charts',
  updateProfile: '/profile/settings',
  myReferralStats: '/profile',
  // Timeline
  myLifeTimeline: '/profile/timeline',
};

/**
 * Extracts the top-level GraphQL field or operation name without reading arguments or variables.
 */
export function extractGraphqlOperation(body: unknown): string {
  const meta = graphqlLogFields(body);
  if (meta.operationName && meta.operationName !== 'anonymous') {
    return meta.operationName.slice(0, 80);
  }
  if (body && typeof body === 'object' && typeof (body as { query?: unknown }).query === 'string') {
    const q = (body as { query: string }).query
      .replace(/#[^\n]*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const namedMatch = /^(?:query|mutation|subscription)\s+([A-Za-z0-9_]+)/i.exec(q);
    if (namedMatch?.[1]) return namedMatch[1].slice(0, 80);
    const firstBrace = q.indexOf('{');
    if (firstBrace >= 0) {
      const inner = q.slice(firstBrace + 1).trim();
      const fieldMatch = /^(?:[A-Za-z0-9_]+\s*:\s*)?([A-Za-z0-9_]+)/.exec(inner);
      if (fieldMatch?.[1] && fieldMatch[1] !== '__typename') {
        return fieldMatch[1].slice(0, 80);
      }
    }
  }
  return 'graphql';
}

/**
 * Maps a raw client page path, server route path, and operation name to a canonical page path.
 */
export function normalizePagePath(
  rawPage?: string | null,
  routePath?: string | null,
  operation?: string | null
): { pagePath: string; routePattern: string } {
  const cleanRaw = typeof rawPage === 'string' ? rawPage.split('?')[0]!.split('#')[0]!.trim() : '';
  if (cleanRaw.startsWith('/')) {
    const trimmed = cleanRaw.length > 1 ? cleanRaw.replace(/\/+$/, '') : '/';
    if (CANONICAL_SET.has(trimmed)) {
      return { pagePath: trimmed, routePattern: trimmed };
    }
    if (trimmed === '/dashboard') {
      return { pagePath: '/dashboard/chat', routePattern: '/dashboard/chat' };
    }
    if (trimmed.startsWith('/dashboard/')) {
      const seg = trimmed.split('/').slice(0, 3).join('/');
      return { pagePath: seg, routePattern: seg };
    }
    if (trimmed.startsWith('/profile/')) {
      const seg = trimmed.split('/').slice(0, 3).join('/');
      return { pagePath: seg, routePattern: seg };
    }
    return { pagePath: trimmed.slice(0, 120), routePattern: trimmed.slice(0, 120) };
  }

  if (operation && OPERATION_TO_PAGE[operation]) {
    const mapped = OPERATION_TO_PAGE[operation]!;
    return { pagePath: mapped, routePattern: mapped };
  }

  const cleanRoute = typeof routePath === 'string' ? routePath.split('?')[0]!.trim() : '';
  if (cleanRoute.startsWith('/api/chat')) {
    return { pagePath: '/dashboard/chat', routePattern: '/dashboard/chat' };
  }
  if (cleanRoute.startsWith('/api/clarify')) {
    return { pagePath: '/dashboard/chat', routePattern: '/dashboard/chat' };
  }
  if (cleanRoute.startsWith('/api/timeline')) {
    return { pagePath: '/profile/timeline', routePattern: '/profile/timeline' };
  }
  if (cleanRoute.startsWith('/api/billing')) {
    return { pagePath: '/profile/plan', routePattern: '/profile/plan' };
  }
  if (cleanRoute.startsWith('/api/profile')) {
    return { pagePath: '/profile', routePattern: '/profile' };
  }
  // the boards (docs/reading-engine/66 §4.6): a call without X-Astra-Page is credited to its own board, not to Charts
  if (cleanRoute.startsWith('/api/self') || cleanRoute.startsWith('/api/area/self')) {
    return { pagePath: '/dashboard/you', routePattern: '/dashboard/you' };
  }
  if (cleanRoute.startsWith('/api/area/love')) {
    return { pagePath: '/dashboard/love', routePattern: '/dashboard/love' };
  }
  if (cleanRoute.startsWith('/api/area/career') || cleanRoute.startsWith('/api/area/work')) {
    return { pagePath: '/dashboard/work', routePattern: '/dashboard/work' };
  }
  if (cleanRoute.startsWith('/api/lucky')) {
    return { pagePath: '/dashboard/lucky', routePattern: '/dashboard/lucky' };
  }
  if (cleanRoute.startsWith('/api/area') || cleanRoute.startsWith('/api/life-reading')) {
    return { pagePath: '/dashboard/charts', routePattern: '/dashboard/charts' };
  }
  if (cleanRoute.startsWith('/api/assistant')) {
    return { pagePath: '/', routePattern: '/' };
  }
  if (cleanRoute.startsWith('/api/dashboard/sections-stream')) {
    return { pagePath: '/dashboard/charts', routePattern: '/dashboard/charts' };
  }
  if (cleanRoute === '/query') {
    return { pagePath: '/dashboard/chat', routePattern: '/dashboard/chat' };
  }
  if (cleanRoute === '/graphql') {
    return { pagePath: '/dashboard/chat', routePattern: '/graphql' };
  }

  const fallback = cleanRoute.startsWith('/') ? cleanRoute.slice(0, 120) : '/';
  return { pagePath: fallback, routePattern: fallback };
}

export interface PageTimingLogInput {
  requestId: string;
  sessionId?: string | null;
  userId?: string | null;
  pagePath: string;
  routePattern: string;
  source: PageTimingSource;
  method: string;
  operation?: string | null;
  sectionKey?: string | null;
  statusCode: number;
  durationMs: number;
  ttfbMs?: number | null;
  serverMs?: number | null;
  renderMs?: number | null;
  drawMs?: number | null;
  queryCount?: number;
  slowCount?: number;
  cacheHit?: boolean;
  bodyBytes?: number | null;
  errorCode?: string | null;
}

export async function recordPageExecution(
  prisma: PrismaClient,
  entry: PageTimingLogInput
): Promise<void> {
  if (!isPageTimingEnabled()) return;
  const slowThreshold = getPageSlowThresholdMs();
  const durationMs = Math.max(0, Math.min(600_000, Math.round(entry.durationMs)));
  const slowCount =
    entry.slowCount !== undefined
      ? Math.max(0, Math.round(entry.slowCount))
      : durationMs >= slowThreshold
        ? 1
        : 0;
  try {
    await prisma.pageExecutionLog.create({
      data: {
        request_id: entry.requestId.slice(0, 64),
        session_id: entry.sessionId ? entry.sessionId.slice(0, 64) : null,
        user_id: entry.userId ?? null,
        page: entry.pagePath.slice(0, 120),
        source: entry.source,
        method: entry.method.slice(0, 16),
        operation: (entry.operation ? entry.operation : entry.method).slice(0, 160),
        status_code: Math.max(100, Math.min(599, Math.round(entry.statusCode || 200))),
        duration_ms: durationMs,
        ttfb_ms: entry.ttfbMs != null ? Math.max(0, Math.round(entry.ttfbMs)) : null,
        server_ms: entry.serverMs != null ? Math.max(0, Math.round(entry.serverMs)) : null,
        db_ms: null,
        render_ms: entry.renderMs != null ? Math.max(0, Math.round(entry.renderMs)) : null,
        draw_ms: entry.drawMs != null ? Math.max(0, Math.round(entry.drawMs)) : null,
        cache_status: entry.cacheHit ? 'hit' : null,
        body_bytes: entry.bodyBytes != null ? Math.max(0, Math.round(entry.bodyBytes)) : null,
        error_code: entry.errorCode ? entry.errorCode.slice(0, 80) : null,
        meta: {
          routePattern: entry.routePattern.slice(0, 120),
          ...(entry.sectionKey ? { sectionKey: entry.sectionKey.slice(0, 64) } : {}),
          slowCount,
          queryCount: Math.max(0, Math.round(entry.queryCount ?? 0)),
        },
      },
    });
  } catch (err) {
    console.warn('[pageTiming] failed to persist log:', (err as Error)?.message?.slice(0, 160));
  }
}

const SKIP_PATHS = new Set(['/health', '/events', '/api/telemetry/page-timings']);

/**
 * Express middleware that instruments every GraphQL, SSE, and REST request with page execution timing.
 */
export function pageTimingMiddleware(
  prisma: PrismaClient,
  optionalUserFn?: (req: express.Request) => Promise<string | null>
): express.RequestHandler {
  return (req, res, next) => {
    if (req.method === 'OPTIONS' || SKIP_PATHS.has(req.path)) {
      return next();
    }
    const startHr = process.hrtime.bigint();
    const requestIdHeader = req.headers['x-request-id'] ?? req.headers['x-amzn-trace-id'];
    const requestId =
      (typeof requestIdHeader === 'string' && requestIdHeader.trim()
        ? requestIdHeader.trim()
        : randomUUID()
      ).slice(0, 64);

    const sessionHeader = req.headers['x-astra-session'];
    const sessionId = typeof sessionHeader === 'string' && sessionHeader.trim() ? sessionHeader.trim().slice(0, 64) : null;

    const rawPageHeader = req.headers['x-astra-page'];
    const rawPage = typeof rawPageHeader === 'string' && rawPageHeader.trim() ? rawPageHeader.trim() : null;

    let ttfbMs: number | null = null;
    let bodyBytes = 0;

    const markFirstByte = () => {
      if (ttfbMs === null) {
        ttfbMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;
      }
    };

    const origWrite = res.write.bind(res);
    res.write = function (chunk: unknown, ...rest: unknown[]): boolean {
      markFirstByte();
      if (typeof chunk === 'string') {
        bodyBytes += Buffer.byteLength(chunk);
      } else if (Buffer.isBuffer(chunk)) {
        bodyBytes += chunk.length;
      } else if (chunk instanceof Uint8Array) {
        bodyBytes += chunk.byteLength;
      }
      return (origWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
    };

    const origEnd = res.end.bind(res);
    res.end = function (chunk?: unknown, ...rest: unknown[]): express.Response {
      markFirstByte();
      if (typeof chunk === 'string') {
        bodyBytes += Buffer.byteLength(chunk);
      } else if (Buffer.isBuffer(chunk)) {
        bodyBytes += chunk.length;
      } else if (chunk instanceof Uint8Array) {
        bodyBytes += chunk.byteLength;
      }
      const elapsedMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - startHr) / 1_000_000));
      if (!res.headersSent) {
        res.setHeader('Server-Timing', `app;dur=${elapsedMs}`);
      }
      return (origEnd as (...args: unknown[]) => express.Response)(chunk, ...rest);
    };

    res.on('finish', () => {
      if (!isPageTimingEnabled()) return;
      const durationMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - startHr) / 1_000_000));
      const isGraphql = req.path === '/graphql';
      const isSse = req.path === '/api/chat/ask-stream';
      const isSectionStream = req.path === '/api/dashboard/sections-stream';

      const source: PageTimingSource = isGraphql
        ? 'graphql'
        : isSse
          ? 'sse_stream'
          : isSectionStream
            ? 'section_stream'
            : 'server_request';

      const operation = isGraphql
        ? extractGraphqlOperation(req.body)
        : isSse
          ? 'askStream'
          : isSectionStream
            ? 'dashboardSectionsStream'
            : `${req.method} ${req.path}`.slice(0, 80);

      const { pagePath, routePattern } = normalizePagePath(rawPage, req.path, operation);
      const statusCode = res.statusCode || 200;
      const errorCode = statusCode >= 400 ? `HTTP_${statusCode}` : null;

      void (async () => {
        let userId: string | null = null;
        if (optionalUserFn) {
          try {
            userId = await optionalUserFn(req);
          } catch {
            userId = null;
          }
        }
        await recordPageExecution(prisma, {
          requestId,
          sessionId,
          userId,
          pagePath,
          routePattern,
          source,
          method: req.method,
          operation,
          statusCode,
          durationMs,
          ttfbMs: ttfbMs ?? durationMs,
          serverMs: durationMs,
          bodyBytes,
          errorCode,
        });
      })();
    });

    next();
  };
}

export interface ClientTimingBeaconItem {
  pagePath?: unknown;
  page?: unknown;
  routePattern?: unknown;
  source?: unknown;
  operation?: unknown;
  sectionKey?: unknown;
  statusCode?: unknown;
  durationMs?: unknown;
  ttfbMs?: unknown;
  serverMs?: unknown;
  renderMs?: unknown;
  drawMs?: unknown;
  bodyBytes?: unknown;
  sessionId?: unknown;
  cacheHit?: unknown;
  cacheStatus?: unknown;
  slowCount?: unknown;
  errorCode?: unknown;
}

export type DashboardSectionKey = 'profile' | 'chart_status' | 'biodata' | 'content' | 'timeline';

const VALID_SECTIONS: readonly DashboardSectionKey[] = [
  'profile',
  'chart_status',
  'biodata',
  'content',
  'timeline',
];

async function resolveDashboardSection(
  prisma: PrismaClient,
  userId: string,
  section: DashboardSectionKey
): Promise<unknown> {
  switch (section) {
    case 'profile': {
      const user = await prisma.auth.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          name: true,
          profile_complete: true,
          email_verified_at: true,
          gender: true,
          date_of_birth: true,
          time_of_birth: true,
          country_code: true,
          city: true,
          language: true,
          locked_at: true,
        },
      });
      if (!user) return null;
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: canonicalRole(user.role),
        locked: Boolean(user.locked_at),
        name: user.name ?? null,
        profile_complete: user.profile_complete !== false,
        email_verified: Boolean(user.email_verified_at),
        ...ownProfileFields(user),
        language: user.language ?? 'en',
      };
    }
    case 'chart_status': {
      return await getChartStatus(prisma, userId);
    }
    case 'biodata': {
      const kundli = await prisma.kundli.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        select: { id: true, biodata: true },
      });
      if (!kundli) return null;
      const { biodata } = await readChartColumns(
        prismaChartDataRepo(prisma),
        kundli.id,
        ['biodata'],
        { biodata: kundli.biodata }
      );
      return biodata ?? null;
    }
    case 'content': {
      const row = await prisma.userGeneratedContent.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      });
      if (!row) return null;
      return {
        remedies: row.remedies,
        mantras: row.mantras,
        routines: row.routines,
        created_at: row.created_at,
        kundli_id: row.kundli_id,
      };
    }
    case 'timeline': {
      const kundliId = await resolveKundli(prisma, userId);
      if (!kundliId) return { kundli_id: null, events: [] };
      const ledgerRes = await listLedger(prisma, userId, kundliId);
      return { kundli_id: kundliId, events: ledgerRes.status === 'ok' ? ledgerRes.value : [] };
    }
  }
}

export function registerPageTimingRoutes(
  app: express.Express,
  deps: {
    prisma: PrismaClient;
    optionalUser: (req: express.Request) => Promise<string | null>;
    requireUser: (req: express.Request, res: express.Response) => Promise<string | null>;
  }
): void {
  const { prisma, optionalUser, requireUser } = deps;

  /**
   * Client-side page render, draw, and lazy-section timing beacon ingestion.
   * Accepts batches of up to 25 timing records per request.
   */
  app.post('/api/telemetry/page-timings', async (req, res) => {
    if (!isPageTimingEnabled()) {
      return res.status(200).json({ ok: true, recorded: 0 });
    }
    const bodyObj = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      entries?: unknown;
      timings?: unknown;
      sessionId?: unknown;
    };
    const rawEntries = Array.isArray(bodyObj.entries)
      ? bodyObj.entries
      : Array.isArray(bodyObj.timings)
        ? bodyObj.timings
        : null;
    if (!rawEntries || rawEntries.length === 0) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    let userId: string | null = null;
    try {
      userId = await optionalUser(req);
    } catch {
      userId = null;
    }

    const sessionHeader = req.headers['x-astra-session'];
    const bodySession =
      typeof bodyObj.sessionId === 'string' && bodyObj.sessionId.trim()
        ? bodyObj.sessionId.trim().slice(0, 64)
        : null;
    const fallbackSession =
      typeof sessionHeader === 'string' && sessionHeader.trim()
        ? sessionHeader.trim().slice(0, 64)
        : bodySession;
    const slowThreshold = getPageSlowThresholdMs();

    const batch = rawEntries.slice(0, 25) as ClientTimingBeaconItem[];
    const rows = [];

    for (const item of batch) {
      if (!item || typeof item !== 'object') continue;
      const rawDuration = Number(item.durationMs);
      if (!Number.isFinite(rawDuration) || rawDuration < 0) continue;

      const durationMs = Math.min(600_000, Math.round(rawDuration));
      const rawSource = typeof item.source === 'string' ? item.source : 'client_render';
      const source: PageTimingSource =
        rawSource === 'section_stream' || rawSource === 'client_render' ? rawSource : 'client_render';

      const operation =
        typeof item.operation === 'string' && item.operation.trim()
          ? item.operation.trim().slice(0, 80)
          : source === 'section_stream'
            ? 'sectionStream'
            : 'pageRender';

      const rawPageVal =
        typeof item.pagePath === 'string' && item.pagePath.trim()
          ? item.pagePath
          : typeof item.page === 'string' && item.page.trim()
            ? item.page
            : '/';
      const { pagePath, routePattern } = normalizePagePath(
        rawPageVal,
        typeof item.routePattern === 'string' ? item.routePattern : null,
        operation
      );

      const renderMs =
        item.renderMs != null && Number.isFinite(Number(item.renderMs))
          ? Math.max(0, Math.min(600_000, Math.round(Number(item.renderMs))))
          : null;
      const drawMs =
        item.drawMs != null && Number.isFinite(Number(item.drawMs))
          ? Math.max(0, Math.min(600_000, Math.round(Number(item.drawMs))))
          : null;
      const ttfbMs =
        item.ttfbMs != null && Number.isFinite(Number(item.ttfbMs))
          ? Math.max(0, Math.min(600_000, Math.round(Number(item.ttfbMs))))
          : null;
      const serverMs =
        item.serverMs != null && Number.isFinite(Number(item.serverMs))
          ? Math.max(0, Math.min(600_000, Math.round(Number(item.serverMs))))
          : null;
      const bodyBytes =
        item.bodyBytes != null && Number.isFinite(Number(item.bodyBytes))
          ? Math.max(0, Math.round(Number(item.bodyBytes)))
          : null;
      const statusCode =
        item.statusCode != null && Number.isFinite(Number(item.statusCode))
          ? Math.max(100, Math.min(599, Math.round(Number(item.statusCode))))
          : 200;

      const sessionId =
        typeof item.sessionId === 'string' && item.sessionId.trim()
          ? item.sessionId.trim().slice(0, 64)
          : fallbackSession;

      const sectionKey =
        typeof item.sectionKey === 'string' && item.sectionKey.trim()
          ? item.sectionKey.trim().slice(0, 64)
          : null;

      const errorCode =
        typeof item.errorCode === 'string' && item.errorCode.trim()
          ? item.errorCode.trim().slice(0, 64)
          : null;

      const cacheStatus =
        typeof item.cacheStatus === 'string' && ['hit', 'miss', 'partial', 'bypass'].includes(item.cacheStatus)
          ? item.cacheStatus
          : item.cacheHit
            ? 'hit'
            : null;

      const slowCount = durationMs >= slowThreshold ? 1 : 0;
      rows.push({
        request_id: randomUUID(),
        session_id: sessionId,
        user_id: userId,
        page: pagePath,
        source,
        method: 'CLIENT',
        operation,
        status_code: statusCode,
        duration_ms: durationMs,
        ttfb_ms: ttfbMs,
        server_ms: serverMs,
        db_ms: null,
        render_ms: renderMs,
        draw_ms: drawMs,
        cache_status: cacheStatus,
        body_bytes: bodyBytes,
        error_code: errorCode,
        meta: {
          routePattern,
          ...(sectionKey ? { sectionKey } : {}),
          slowCount,
          queryCount: 0,
        },
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'no valid timing entries' });
    }

    try {
      await prisma.pageExecutionLog.createMany({ data: rows });
    } catch (err) {
      console.warn('[pageTiming] createMany failed:', (err as Error)?.message?.slice(0, 160));
    }

    return res.status(200).json({ ok: true, recorded: rows.length });
  });

  /**
   * Progressive NDJSON section streaming for dashboard pages (`GET /api/dashboard/sections-stream`).
   * Streams requested sections (`?sections=profile,chart_status,biodata,content,timeline`) in parallel
   * as each resolves, so fast sections draw immediately while heavier sections finish asynchronously.
   */
  app.get('/api/dashboard/sections-stream', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const rawSections = typeof req.query.sections === 'string' ? req.query.sections : '';
    const requested = rawSections
      .split(',')
      .map((s) => s.trim() as DashboardSectionKey)
      .filter((s): s is DashboardSectionKey => VALID_SECTIONS.includes(s));
    const sections: readonly DashboardSectionKey[] = requested.length > 0 ? requested : VALID_SECTIONS;

    const rawPageHeader = req.headers['x-astra-page'];
    const { pagePath, routePattern } = normalizePagePath(
      typeof rawPageHeader === 'string' ? rawPageHeader : '/dashboard/charts',
      '/api/dashboard/sections-stream',
      'dashboardSectionsStream'
    );
    const sessionHeader = req.headers['x-astra-session'];
    const sessionId =
      typeof sessionHeader === 'string' && sessionHeader.trim() ? sessionHeader.trim().slice(0, 64) : null;

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    type ResWithFlush = express.Response & { flush?: () => void };
    const flush = () => (res as ResWithFlush).flush?.();

    await Promise.all(
      sections.map(async (section) => {
        const secStart = process.hrtime.bigint();
        let ok = true;
        let data: unknown = null;
        let errorCode: string | null = null;
        try {
          data = await resolveDashboardSection(prisma, userId, section);
        } catch {
          ok = false;
          errorCode = 'SECTION_ERROR';
          data = { error: 'Section temporarily unavailable' };
        }
        const durationMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - secStart) / 1_000_000));
        const line = JSON.stringify({ section, ok, durationMs, ms: durationMs, data }) + '\n';
        const lineBytes = Buffer.byteLength(line);
        try {
          res.write(line);
          flush();
        } catch {
          /* client closed stream */
        }
        await recordPageExecution(prisma, {
          requestId: randomUUID(),
          sessionId,
          userId,
          pagePath,
          routePattern,
          source: 'section_stream',
          method: 'GET',
          operation: `section:${section}`,
          sectionKey: section,
          statusCode: ok ? 200 : 500,
          durationMs,
          ttfbMs: durationMs,
          serverMs: durationMs,
          bodyBytes: lineBytes,
          errorCode,
        });
      })
    );

    res.end();
  });
}

const DAY_MS = 24 * 3_600_000;

/**
 * Sweeps `page_execution_logs` rows older than `retentionDays` (default `getPageTimingRetentionDays()`, 30 days)
 * so telemetry storage remains bounded without manual intervention.
 */
export async function sweepPageExecutionLogs(
  prisma: PrismaClient | null | undefined,
  opts: { retentionDays?: number; now?: Date } = {}
): Promise<number> {
  const model = (
    prisma as unknown as {
      pageExecutionLog?: {
        deleteMany?: (args: { where: { created_at: { lt: Date } } }) => Promise<{ count: number }>;
      };
    } | null
  )?.pageExecutionLog;
  if (!model?.deleteMany) return 0;
  const now = opts.now ?? new Date();
  const days = opts.retentionDays ?? getPageTimingRetentionDays();
  const cutoff = new Date(now.getTime() - Math.max(1, days) * DAY_MS);
  try {
    const res = await model.deleteMany({ where: { created_at: { lt: cutoff } } });
    return res.count;
  } catch {
    return 0;
  }
}
