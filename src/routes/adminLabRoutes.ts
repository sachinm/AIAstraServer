/**
 * The server surface of the admin Techniques Lab (docs/admin/10): run one board technique, or the whole board, for a
 * person with a kundli (QA: Sachin, 2026-11-07, no research flag needed) through the same build the person's board uses, with trigger 'manual', and read the stored
 * dossiers. Mounted only when ADMIN_LAB=1; authenticated via HMAC-SHA256 staff-attributed headers signed with `ADMIN_LAB_TOKEN`
 * (checked in constant time within `ADMIN_HMAC_SKEW_SECONDS`). Birth fields are stripped from dossier/run responses.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { getAdminHmacSkewSeconds } from '../config/env.js';
import { getBoardReading, type SelfDeps } from '../reading/self/service.js';
import { stripBirthFields } from '../reading/self/dossier.js';
import { chartDataHandler } from './adminChartData.js';
import { loadsHandler } from './adminLoads.js';
import { recordAppError } from '../telemetry/appErrors.js';
import {
  SELF_PANEL_IDS,
  LOVE_PANEL_IDS,
  WORK_PANEL_IDS,
  type BoardPanelId,
  type ReadingBoardId,
} from '../reading/self/types.js';

export interface AdminLabDeps {
  prisma: PrismaClient;
  enabled?: boolean;
  token?: string;
  self?: Omit<SelfDeps, 'prisma'>;
  now?: () => number;
}

export interface VerifiedAdminActor {
  actorId: string;
  actorRole: 'admin' | 'superadmin';
}

export function isAdminLabEnabled(): boolean {
  return process.env.ADMIN_LAB?.trim() === '1';
}

function sha256Hex(raw: Buffer | string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function constantTimeEqualHex(given: string, expected: string): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(expected, 'utf8'));
}

/** Sign an outbound/test request to `/api/admin-lab/*` using the shared HMAC-SHA256 service contract. */
export function signAdminServiceHeaders(opts: {
  secret: string;
  method: string;
  pathAndQuery: string;
  body?: string;
  actorId: string;
  actorRole: 'admin' | 'superadmin' | string;
  timestampSec?: number;
}): Record<string, string> {
  const timestamp = String(opts.timestampSec ?? Math.floor(Date.now() / 1000));
  const bodyHash = sha256Hex(opts.body ?? '');
  const canonical = `${timestamp}\n${opts.method.toUpperCase()}\n${opts.pathAndQuery}\n${bodyHash}\n${opts.actorId}\n${opts.actorRole}`;
  const sig = createHmac('sha256', opts.secret).update(canonical).digest('hex');
  return {
    'X-Admin-Service-Timestamp': timestamp,
    'X-Admin-Service-Signature': `v1=${sig}`,
    'X-Admin-Actor-Id': opts.actorId,
    'X-Admin-Actor-Role': opts.actorRole,
    'X-Amz-Content-Sha256': bodyHash,
  };
}

export function verifyAdminServiceRequest(
  req: express.Request,
  secret: string | undefined,
  nowMs: number = Date.now()
): { ok: true; actor: VerifiedAdminActor } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const tsRaw = req.header('x-admin-service-timestamp')?.trim() ?? '';
  const sigHeader = req.header('x-admin-service-signature')?.trim() ?? '';
  const actorId = req.header('x-admin-actor-id')?.trim() ?? '';
  const actorRole = req.header('x-admin-actor-role')?.trim() ?? '';
  const bodyHashHeader = req.header('x-amz-content-sha256')?.trim() ?? '';

  if (!tsRaw || !sigHeader || !actorId || !actorRole) {
    return { ok: false, reason: 'missing_hmac_headers' };
  }
  if (actorRole !== 'admin' && actorRole !== 'superadmin') {
    return { ok: false, reason: 'invalid_actor_role' };
  }

  const tsSec = Number(tsRaw);
  if (!Number.isInteger(tsSec) || tsSec <= 0) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  const skew = Math.abs(Math.floor(nowMs / 1000) - tsSec);
  if (skew > getAdminHmacSkewSeconds()) {
    return { ok: false, reason: 'timestamp_expired' };
  }

  const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
  const fallbackBody =
    req.method === 'GET' || req.method === 'HEAD' || req.body === undefined || req.body === null
      ? ''
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
  const actualBodyHash = sha256Hex(rawBody ?? fallbackBody);
  if (bodyHashHeader && !constantTimeEqualHex(bodyHashHeader.toLowerCase(), actualBodyHash)) {
    return { ok: false, reason: 'body_hash_mismatch' };
  }

  const sigMatch = /^v1=([0-9a-f]{64})$/i.exec(sigHeader);
  if (!sigMatch) {
    return { ok: false, reason: 'malformed_signature' };
  }

  const pathAndQuery = req.originalUrl || req.url;
  const canonical = `${tsRaw}\n${req.method.toUpperCase()}\n${pathAndQuery}\n${actualBodyHash}\n${actorId}\n${actorRole}`;
  const expectedSig = createHmac('sha256', secret).update(canonical).digest('hex');
  if (!constantTimeEqualHex(sigMatch[1]!.toLowerCase(), expectedSig)) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  return { ok: true, actor: { actorId, actorRole } };
}

export function registerAdminLabRoutes(app: express.Express, deps: AdminLabDeps): boolean {
  if (!(deps.enabled ?? isAdminLabEnabled())) return false;
  const token = deps.token ?? process.env.ADMIN_LAB_TOKEN?.trim();
  const guard: express.RequestHandler = (req, res, next) => {
    const check = verifyAdminServiceRequest(req, token, (deps.now ?? Date.now)());
    if (!check.ok) {
      void recordAppError(deps.prisma, {
        source: 'rbac',
        severity: 'warn',
        category: 'admin_lab_auth_denied',
        errorCode: 'FORBIDDEN',
        statusCode: 403,
        operation: `${req.method} ${req.path}`,
        message: `Admin lab request rejected (${check.reason})`,
        meta: { reason: check.reason },
      });
      return void res.status(403).json({ error: 'forbidden' });
    }
    (req as express.Request & { adminActor?: VerifiedAdminActor }).adminActor = check.actor;
    next();
  };
  const selfDeps: SelfDeps = { prisma: deps.prisma, ...(deps.self ?? {}) };

  app.get('/api/admin-lab/people', guard, async (_req, res) => {
    // QA (Sachin, 2026-11-07): every unlocked account with a kundli; the research flag no longer gates the lab.
    // Birth details and name are decrypted via the Prisma PII extension and returned behind the lab token for QA.
    const rows = await deps.prisma.auth
      .findMany({
        where: { locked_at: null, kundlis: { some: {} } },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          date_of_birth: true,
          time_of_birth: true,
          place_of_birth: true,
          city: true,
          country_code: true,
          kundlis: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { id: true, digest_status: true, preferred_dasha: true, place_resolved: true },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
      })
      .catch(() => []);
    const items = await Promise.all(
      rows.map(async (r) => {
        const k =
          r.kundlis?.[0] ??
          (await deps.prisma.kundli
            ?.findFirst?.({
              where: { user_id: r.id },
              orderBy: { created_at: 'desc' },
              select: { id: true, digest_status: true, preferred_dasha: true, place_resolved: true },
            })
            .catch(() => null));
        const resolvedName = r.name?.trim() || r.username?.trim() || null;
        const resolvedPlace = r.place_of_birth?.trim() || k?.place_resolved?.trim() || null;
        return {
          userId: r.id,
          label: resolvedName ? `${resolvedName} (${r.email ?? r.id.slice(0, 8)})` : `Person ${r.id.slice(0, 8)}`,
          email: r.email ?? null,
          name: resolvedName,
          dateOfBirth: r.date_of_birth ?? null,
          timeOfBirth: r.time_of_birth ?? null,
          placeOfBirth: resolvedPlace,
          city: r.city ?? null,
          countryCode: r.country_code ?? null,
          kundliId: k?.id ?? null,
          digestStatus: k?.digest_status ?? null,
          preferredClock: k?.preferred_dasha ?? null,
        };
      }),
    );
    res.json({ items });
  });

  // QA (Sachin, 2026-11-07): staff testing a reading must see whose chart it is. Opened by the PII extension; served
  // only behind the lab token, never into a dossier (stripBirthFields still applies there).
  app.get('/api/admin-lab/people/:userId', guard, async (req, res) => {
    try {
      const a = await deps.prisma.auth.findUnique({
        where: { id: String(req.params.userId) },
        select: { id: true, email: true, name: true, username: true, date_of_birth: true, time_of_birth: true, place_of_birth: true, city: true, country_code: true, locked_at: true },
      });
      if (!a) return res.status(404).json({ error: 'no_person' });
      const k = await deps.prisma.kundli.findFirst({ where: { user_id: a.id }, orderBy: { created_at: 'desc' }, select: { id: true, digest_status: true, preferred_dasha: true, place_resolved: true } });
      return res.json({
        userId: a.id,
        email: a.email ?? null,
        name: a.name?.trim() || a.username?.trim() || null,
        dateOfBirth: a.date_of_birth ?? null,
        timeOfBirth: a.time_of_birth ?? null,
        placeOfBirth: a.place_of_birth?.trim() || k?.place_resolved?.trim() || null,
        city: a.city ?? null,
        countryCode: a.country_code ?? null,
        locked: a.locked_at != null,
        kundliId: k?.id ?? null,
        digestStatus: k?.digest_status ?? null,
        preferredClock: k?.preferred_dasha ?? null,
      });
    } catch (e) {
      console.error('[admin-lab] person', (e as Error).message);
      return res.status(503).json({ error: 'person_unavailable' });
    }
  });

  // Chart Data Review (QA, Sachin 2026-11-08): the stored engine rows of one person, opened, as stored
  app.get('/api/admin-lab/chart-data/:userId', guard, chartDataHandler({ prisma: deps.prisma }));
  // Dashboard loads (docs/admin/12): the latest builds of a person's board with every agent run and answer under them
  app.get('/api/admin-lab/loads/:userId', guard, loadsHandler({ prisma: deps.prisma }));

  app.post('/api/admin-lab/run', guard, async (req, res) => {
    const b = (req.body ?? {}) as { userId?: unknown; board?: unknown; technique?: unknown; force?: unknown; asOf?: unknown };
    if (typeof b.userId !== 'string') return res.status(400).json({ error: 'bad_request' });
    const rawBoard = b.board ?? 'self';
    if (rawBoard !== 'self' && rawBoard !== 'love' && rawBoard !== 'work') {
      return res.status(400).json({ error: 'bad_request' });
    }
    const board: ReadingBoardId = rawBoard;
    if (b.asOf !== undefined && (typeof b.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.asOf) || Number.isNaN(Date.parse(b.asOf)))) return res.status(400).json({ error: 'bad_as_of' });
    const tech = typeof b.technique === 'string' ? b.technique.replace(/^(self|love|work)\.reading\./, '') : 'all';
    const stageIds = ['all', 'oracle', 'clock', 'purview', 'audit'] as const;
    const isStage = (stageIds as readonly string[]).includes(tech);
    const allowedPanels: readonly string[] =
      board === 'love' ? LOVE_PANEL_IDS : board === 'work' ? WORK_PANEL_IDS : SELF_PANEL_IDS;
    if (!isStage && !allowedPanels.includes(tech)) return res.status(400).json({ error: 'unknown_technique' });
    const person = await deps.prisma.auth.findUnique({ where: { id: b.userId }, select: { locked_at: true } }).catch(() => null);
    if (!person) return res.status(404).json({ error: 'no_person' });
    if (person.locked_at) return res.status(403).json({ error: 'locked' });
    try {
      const t0 = Date.now();
      const r = await getBoardReading(selfDeps, b.userId, board, {
        trigger: 'manual',
        force: b.force === true,
        ...(typeof b.asOf === 'string' ? { asOf: b.asOf } : {}),
        ...(isStage ? {} : { only: tech as BoardPanelId }),
      });
      const actor = (req as express.Request & { adminActor?: VerifiedAdminActor }).adminActor;
      await deps.prisma.adminAction
        ?.create?.({
          data: {
            action: 'lab.run',
            actor_kind: 'admin',
            actor_admin_id: actor && actor.actorId !== 'system' ? actor.actorId : null,
            target_user_id: b.userId,
            after: { board, technique: tech, force: b.force === true, asOf: typeof b.asOf === 'string' ? b.asOf : null } as object,
          },
        })
        .catch(() => undefined);
      if (r.status !== 'ok') return res.status(r.status === 'no_kundli' ? 404 : 202).json({ status: r.status });
      const dossier = r.reading.dossierId ? await deps.prisma.readingDossier.findUnique({ where: { id: r.reading.dossierId } }) : null;
      return res.json(stripBirthFields({ runId: r.reading.dossierId, ms: Date.now() - t0, technique: tech, reading: r.reading, dossier }));
    } catch (e) {
      console.error('[admin-lab]', (e as Error).message);
      return res.status(500).json({ error: 'lab_run_failed' });
    }
  });

  app.get('/api/admin-lab/runs/:id', guard, async (req, res) => {
    const d = await deps.prisma.readingDossier.findUnique({ where: { id: String(req.params.id) } }).catch(() => null);
    if (!d) return res.status(404).json({ error: 'not_found' });
    return res.json(stripBirthFields(d));
  });

  app.get('/api/admin-lab/dossiers', guard, async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const board = typeof req.query.board === 'string' ? req.query.board : 'self';
    const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } }).catch(() => null);
    if (!kundli) return res.status(404).json({ error: 'no_kundli' });
    const rows = await deps.prisma.readingDossier.findMany({
      where: { kundli_id: kundli.id, board },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, created_at: true, trigger: true, clock: true, as_of: true, valid_to: true, digest_version: true, audit: true, cost_usd: true },
    });
    return res.json(stripBirthFields({ items: rows.map((r) => { const a = (r.audit ?? {}) as { verdict?: string; scope?: string }; return { ...r, verdict: a.verdict ?? null, technique: a.scope ?? 'all', audit: undefined }; }) }));
  });
  return true;
}
