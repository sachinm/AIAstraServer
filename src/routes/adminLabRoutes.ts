/**
 * The server surface of the admin Techniques Lab (docs/admin/10): run one board technique, or the whole board, for a
 * person with a kundli (QA: Sachin, 2026-11-07, no research flag needed) through the same build the person's board uses, with trigger 'manual', and read the stored
 * dossiers. Mounted only when ADMIN_LAB=1; every call needs the header `x-admin-lab-token` equal to ADMIN_LAB_TOKEN
 * (compared in constant time). Birth fields are stripped from every response. Every run writes `agent_runs` (through
 * the build) and an `admin_actions` row (`lab.run`, ids only, never output).
 *
 *   GET  /api/admin-lab/people                                  → people with a kundli, masked
 *   GET  /api/admin-lab/people/:userId                          → that person's name and birth date, time and place (QA, Sachin 2026-11-07)
 *   POST /api/admin-lab/run { userId, board:'self', technique?: '<panel id>'|'all', force?, asOf?: 'YYYY-MM-DD' } → 200 LabRun |
 *        400 bad_request | bad_as_of | unknown_technique | board_not_built (love, work) | 403 | 404
 *   GET  /api/admin-lab/runs/:id                                → the stored dossier
 *   GET  /api/admin-lab/dossiers?userId=&board=                 → the person's dossiers, newest first
 */
import { timingSafeEqual } from 'node:crypto';
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { getSelfReading, type SelfDeps } from '../reading/self/service.js';
import { stripBirthFields } from '../reading/self/dossier.js';
import { SELF_PANEL_IDS, type SelfPanelId } from '../reading/self/types.js';

export interface AdminLabDeps {
  prisma: PrismaClient;
  enabled?: boolean;
  token?: string;
  self?: Omit<SelfDeps, 'prisma'>;
}

export function isAdminLabEnabled(): boolean {
  return process.env.ADMIN_LAB?.trim() === '1';
}

function tokenOk(given: unknown, want: string | undefined): boolean {
  if (!want || typeof given !== 'string' || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function extractLabToken(req: express.Request): string | undefined {
  const direct = req.header('x-admin-lab-token')?.trim();
  if (direct) return direct;
  const astra = req.header('x-astra-authorization')?.trim();
  if (astra && /^LabToken\s+/i.test(astra)) {
    return astra.replace(/^LabToken\s+/i, '').trim();
  }
  return undefined;
}

export function registerAdminLabRoutes(app: express.Express, deps: AdminLabDeps): boolean {
  if (!(deps.enabled ?? isAdminLabEnabled())) return false;
  const token = deps.token ?? process.env.ADMIN_LAB_TOKEN?.trim();
  const guard: express.RequestHandler = (req, res, next) => {
    if (!tokenOk(extractLabToken(req), token)) return void res.status(403).json({ error: 'forbidden' });
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

  app.post('/api/admin-lab/run', guard, async (req, res) => {
    const b = (req.body ?? {}) as { userId?: unknown; board?: unknown; technique?: unknown; force?: unknown; asOf?: unknown };
    if (typeof b.userId !== 'string') return res.status(400).json({ error: 'bad_request' });
    const board = b.board ?? 'self';
    if (board === 'love' || board === 'work') return res.status(400).json({ error: 'board_not_built', board });
    if (board !== 'self') return res.status(400).json({ error: 'bad_request' });
    if (b.asOf !== undefined && (typeof b.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.asOf) || Number.isNaN(Date.parse(b.asOf)))) return res.status(400).json({ error: 'bad_as_of' });
    const tech = typeof b.technique === 'string' ? b.technique.replace(/^self\.reading\./, '') : 'all';
    const stageIds = ['all', 'oracle', 'clock', 'purview', 'audit'] as const;
    const isStage = (stageIds as readonly string[]).includes(tech);
    if (!isStage && !(SELF_PANEL_IDS as readonly string[]).includes(tech)) return res.status(400).json({ error: 'unknown_technique' });
    const person = await deps.prisma.auth.findUnique({ where: { id: b.userId }, select: { locked_at: true } }).catch(() => null);
    if (!person) return res.status(404).json({ error: 'no_person' });
    if (person.locked_at) return res.status(403).json({ error: 'locked' });
    try {
      const t0 = Date.now();
      const r = await getSelfReading(selfDeps, b.userId, { trigger: 'manual', force: b.force === true, ...(typeof b.asOf === 'string' ? { asOf: b.asOf } : {}), ...(isStage ? {} : { only: tech as SelfPanelId }) });
      await deps.prisma.adminAction
        ?.create?.({ data: { action: 'lab.run', actor_kind: 'admin', target_user_id: b.userId, after: { board: 'self', technique: tech, force: b.force === true, asOf: typeof b.asOf === 'string' ? b.asOf : null } as object } })
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
