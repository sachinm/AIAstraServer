/**
 * The server surface of the admin Techniques Lab (docs/admin/10): run one board technique, or the whole board, for a
 * person with a kundli (QA: Sachin, 2026-11-07, no research flag needed) through the same build the person's board uses, with trigger 'manual', and read the stored
 * dossiers. Mounted only when ADMIN_LAB=1; every call needs the header `x-admin-lab-token` equal to ADMIN_LAB_TOKEN
 * (compared in constant time). Birth fields are stripped from every response. Every run writes `agent_runs` (through
 * the build) and an `admin_actions` row (`lab.run`, ids only, never output).
 *
 *   GET  /api/admin-lab/people                                  → people with a kundli, masked
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

export function registerAdminLabRoutes(app: express.Express, deps: AdminLabDeps): boolean {
  if (!(deps.enabled ?? isAdminLabEnabled())) return false;
  const token = deps.token ?? process.env.ADMIN_LAB_TOKEN?.trim();
  const guard: express.RequestHandler = (req, res, next) => {
    if (!tokenOk(req.header('x-admin-lab-token'), token)) return void res.status(403).json({ error: 'forbidden' });
    next();
  };
  const selfDeps: SelfDeps = { prisma: deps.prisma, ...(deps.self ?? {}) };

  app.get('/api/admin-lab/people', guard, async (_req, res) => {
    // QA (Sachin, 2026-11-07): every unlocked account with a kundli; the research flag no longer gates the lab
    const rows = await deps.prisma.auth.findMany({ where: { locked_at: null, kundlis: { some: {} } }, select: { id: true }, orderBy: { created_at: 'desc' }, take: 200 }).catch(() => []);
    res.json({ items: rows.map((r) => ({ userId: r.id, label: `Person ${r.id.slice(0, 8)}` })) });
  });

  app.post('/api/admin-lab/run', guard, async (req, res) => {
    const b = (req.body ?? {}) as { userId?: unknown; board?: unknown; technique?: unknown; force?: unknown; asOf?: unknown };
    if (typeof b.userId !== 'string') return res.status(400).json({ error: 'bad_request' });
    const board = b.board ?? 'self';
    if (board === 'love' || board === 'work') return res.status(400).json({ error: 'board_not_built', board });
    if (board !== 'self') return res.status(400).json({ error: 'bad_request' });
    if (b.asOf !== undefined && (typeof b.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.asOf) || Number.isNaN(Date.parse(b.asOf)))) return res.status(400).json({ error: 'bad_as_of' });
    const tech = typeof b.technique === 'string' ? b.technique.replace(/^self\.reading\./, '') : 'all';
    if (tech !== 'all' && !(SELF_PANEL_IDS as readonly string[]).includes(tech)) return res.status(400).json({ error: 'unknown_technique' });
    const person = await deps.prisma.auth.findUnique({ where: { id: b.userId }, select: { locked_at: true } }).catch(() => null);
    if (!person) return res.status(404).json({ error: 'no_person' });
    if (person.locked_at) return res.status(403).json({ error: 'locked' });
    try {
      const t0 = Date.now();
      const r = await getSelfReading(selfDeps, b.userId, { trigger: 'manual', force: b.force === true, ...(typeof b.asOf === 'string' ? { asOf: b.asOf } : {}), ...(tech === 'all' ? {} : { only: tech as SelfPanelId }) });
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
