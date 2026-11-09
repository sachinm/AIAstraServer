/**
 * HTTP surface of the You reading (docs/reading-engine/58 §4.2, 64 §4). Mounted with the boards (AREA_ENABLED=1).
 *
 *   GET  /api/self/reading            → 200 { status:'ok', built_at, cached, reading }
 *                                     | 202 { status:'preparing', stage:'chart' }    the digest is not ready yet
 *                                     | 202 { status:'preparing', stage:'reading' }  the Oracle's synthesis is being built in
 *                                                                                   the background (never inside this request)
 *                                     | 404 no_kundli
 *   POST /api/self/reading/confirm    { claimId, answer: yes|partly|no|skip } → 204 | 400 bad_answer
 *   PUT  /api/self/clock              { system: string | null } → 200 { clock } | 400 unknown_system | 404 no_kundli
 *
 * A page open never waits on a model: the reading is read with `oracleMode: 'cached_only'`; a pending Oracle queues one
 * background build (`buildEvent.ts`) and answers 202, and the page polls. A build that failed in the last half hour is
 * served as the code panels without Oracle lines (`oracle.status = 'failed'`), never as an error page.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { writeFacts, SELF_CONFIRM_PREFIX } from '../profile/facts.js';
import { getSelfReading, setPreferredClock, type SelfDeps } from '../reading/self/service.js';
import { queueSelfReadingBuild, type QueueDeps } from '../reading/self/buildEvent.js';
import { isAreaEnabled } from './areaRoutes.js';

export interface SelfReadingRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  enabled?: boolean;
  self?: Omit<SelfDeps, 'prisma'>;
  /** the code panels' budget inside one request; past it the page is told to ask again (202), never 503 */
  timeoutMs?: number;
  /** the background build's self-invoke and build (tests replace them) */
  queue?: Pick<QueueDeps, 'build' | 'invoke' | 'now'>;
}

const SLOW = Symbol('slow');

export function registerSelfReadingRoutes(app: express.Express, deps: SelfReadingRouteDeps): boolean {
  if (!(deps.enabled ?? isAreaEnabled())) return false;
  const selfDeps: SelfDeps = { prisma: deps.prisma, ...(deps.self ?? {}) };
  const queueDeps: QueueDeps = { prisma: deps.prisma, self: deps.self, ...(deps.queue ?? {}) };
  const timeout = deps.timeoutMs ?? 10_000;

  app.get('/api/self/reading', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      let timer: NodeJS.Timeout | undefined;
      const r = await Promise.race([
        getSelfReading(selfDeps, userId, { oracleMode: 'cached_only' }),
        new Promise<typeof SLOW>((resolve) => { timer = setTimeout(() => resolve(SLOW), timeout); }),
      ]);
      if (timer) clearTimeout(timer);
      // even the stored read outran the budget (a slow database): the page asks again in a few seconds
      if (r === SLOW) return res.status(202).json({ status: 'preparing', stage: 'reading' });
      if (r.status === 'no_kundli') return res.status(404).json({ status: 'no_kundli', error: 'no_kundli' });
      if (r.status === 'preparing') return res.status(202).json({ status: 'preparing', stage: 'chart' });
      if (r.reading.oracle?.status === 'pending') {
        const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
        const outcome = kundli ? await queueSelfReadingBuild(queueDeps, userId, kundli.id, 'self') : 'skipped';
        if (outcome === 'failed_recently' || outcome === 'skipped') {
          // the synthesis cannot be had right now: the code panels are served, the Oracle marked failed, nothing hidden
          return res.json({ ...r, reading: { ...r.reading, oracle: { ...r.reading.oracle, status: 'failed' } } });
        }
        return res.status(202).json({ status: 'preparing', stage: 'reading', build: outcome });
      }
      return res.json(r);
    } catch (e) {
      console.error('[self:reading]', (e as Error).message);
      return res.status(500).json({ error: 'self_reading_failed' });
    }
  });

  app.post('/api/self/reading/confirm', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = (req.body ?? {}) as { claimId?: unknown; answer?: unknown };
    if (typeof b.claimId !== 'string') return res.status(400).json({ error: 'bad_answer' });
    const r = await writeFacts(deps.prisma, userId, { [`${SELF_CONFIRM_PREFIX}${b.claimId}`]: b.answer }).catch(() => ({ ok: false as const, error: 'write_failed' }));
    return r.ok ? res.status(204).end() : res.status(400).json({ error: 'bad_answer' });
  });

  app.put('/api/self/clock', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const system = (req.body as { system?: unknown } | undefined)?.system;
    if (system !== null && typeof system !== 'string') return res.status(400).json({ error: 'unknown_system' });
    try {
      const r = await setPreferredClock(selfDeps, userId, system);
      if (!r.ok) return res.status(r.error === 'no_kundli' ? 404 : 400).json({ error: r.error });
      return res.json({ clock: r.clock });
    } catch (e) {
      console.error('[self:clock]', (e as Error).message);
      return res.status(500).json({ error: 'self_clock_failed' });
    }
  });
  return true;
}
