/**
 * The account-wide cap on deep pulls (docs/reading-engine/67 §5.2, 2026-11-09). The worker Lambda runs WITHOUT reserved
 * concurrency (the account's Lambda limit is 10 and Lambda keeps 10 unreserved), so each run takes a slot from the same
 * pool as the API, the chart worker and the sweep. At most DASHA_DEEP_GLOBAL_MAX (default 1) pulls are live at once.
 *
 * The cap lives in the database, on the per-kundli marker rows (`kundli_data` dasha.deep@marker), with no new AWS:
 *   - live = a marker with status `dispatched` (the API invoked the worker) or `fetching` (the worker is pulling) whose
 *     `fetch_started_at` is less than 15 min old;
 *   - `acquire` counts the live markers of the OTHER kundlis and, at the cap, writes `queued` on this kundli's marker
 *     (the next sweep picks queued kundlis first, oldest focus first); under the cap it writes `dispatched` (role
 *     'dispatch': the focus trigger and the sweep, before they invoke) or `fetching` (role 'run': the worker on start).
 *   - Race-safe: the count and the write run in one transaction behind `pg_advisory_xact_lock(DEEP_SLOT_LOCK_KEY)`, so
 *     two starters are serialised; the second one's statements see the first one's committed write (read committed
 *     takes a fresh snapshot per statement, after the lock is granted). Every write of `dispatched` / `fetching` on a
 *     marker goes through here; `complete` (ready / failed) only ever frees a slot.
 * Nothing here computes astrology.
 */
import type { PrismaClient } from '@prisma/client';
import { getDashaDeepGlobalMax, getDashaDeepMaxLevel } from '../config/env.js';
import { queueLog } from '../lib/queueLogger.js';
import { DASHA_DEEP_TYPE } from '../reading/chartData/catalog.js';
import type { StoredRow } from '../reading/chartData/store.js';
import { DASHA_DEEP_AYANAMSA, DEEP_LEASE_MS, MARKER_VARIANT, deepFreshness } from './dashaDeep.js';

/** A `dispatched` or `fetching` marker counts against the cap for this long after `fetch_started_at` */
export const DEEP_SLOT_LIVE_MS = 15 * 60_000;
/** The advisory lock every starter takes (any constant bigint; "67 2026 11 09" truncated to int4 range) */
export const DEEP_SLOT_LOCK_KEY = 671_109_067;

export type SlotRole = 'dispatch' | 'run';
/** granted: go ahead (the marker now says dispatched / fetching); queued: at the cap, marker says queued; busy: this
 * kundli already has a live pull; fresh: (dispatch only) the stored window still serves as_of, nothing to do */
export type SlotOutcome = 'granted' | 'queued' | 'busy' | 'fresh';
export type SlotStatus = 'dispatched' | 'fetching' | 'queued';

/** The marker as the slot logic sees it (StoredRow, with the two extra statuses this module writes). */
export type SlotRow = Omit<StoredRow, 'status'> & { status: StoredRow['status'] | SlotStatus };

export interface SlotTx {
  /** live markers (dispatched / fetching, started after `since`) of every kundli but `exceptKundliId` */
  countLive(exceptKundliId: string, since: Date): Promise<number>;
  readOwn(kundliId: string): Promise<SlotRow | undefined>;
  /** set the marker's status (insert the row when missing); `startedAt` non-null also sets fetch_started_at */
  write(kundliId: string, status: SlotStatus, startedAt: Date | null): Promise<void>;
}

export interface SlotBackend {
  /** run `fn` while holding the one global lock (production: a transaction behind pg_advisory_xact_lock) */
  withLock<T>(fn: (tx: SlotTx) => Promise<T>): Promise<T>;
}

export interface AcquireOpts {
  now: number;
  /** dispatch only: skip (`fresh`) when the stored window still serves as_of */
  asOf?: string;
  cap?: number;
  maxLevel?: number;
}

export interface DeepSlots {
  acquire(kundliId: string, role: SlotRole, opts: AcquireOpts): Promise<SlotOutcome>;
  /** after a failed invoke: give the slot back as `queued`, so the next sweep retries it first */
  requeue(kundliId: string): Promise<void>;
}

const started = (r: SlotRow | undefined): number => r?.fetchStartedAt?.getTime() ?? -Infinity;

/** Whether this kundli's own pull is live (pure). A worker ('run') may take over its own `dispatched` marker. */
export function ownLive(own: SlotRow | undefined, role: SlotRole, now: number): boolean {
  if (!own) return false;
  if (own.status === 'fetching') return now - started(own) < DEEP_LEASE_MS;
  if (own.status === 'dispatched') return role === 'dispatch' && now - started(own) < DEEP_SLOT_LIVE_MS;
  return false;
}

/** The slot decision (pure): the outcome and the status to write (null = write nothing). */
export function decideSlot(own: SlotRow | undefined, othersLive: number, role: SlotRole, now: number, cap: number): { outcome: Exclude<SlotOutcome, 'fresh'>; write: SlotStatus | null } {
  if (ownLive(own, role, now)) return { outcome: 'busy', write: null };
  if (othersLive >= cap) return { outcome: 'queued', write: 'queued' };
  return { outcome: 'granted', write: role === 'dispatch' ? 'dispatched' : 'fetching' };
}

/** The cap over any backend (Prisma in production, an in-memory mutex in tests). */
export function createDeepSlots(backend: SlotBackend): DeepSlots {
  return {
    async acquire(kundliId, role, opts) {
      const cap = opts.cap ?? getDashaDeepGlobalMax();
      const result = await backend.withLock(async (tx) => {
        const own = await tx.readOwn(kundliId);
        if (role === 'dispatch' && opts.asOf && own?.status !== 'dispatched' && own?.status !== 'queued') {
          if (deepFreshness(own as StoredRow | undefined, opts.asOf, opts.now, opts.maxLevel ?? getDashaDeepMaxLevel()).fresh) return { outcome: 'fresh' as const, live: -1 };
        }
        const live = await tx.countLive(kundliId, new Date(opts.now - DEEP_SLOT_LIVE_MS));
        const d = decideSlot(own, live, role, opts.now, cap);
        if (d.write) await tx.write(kundliId, d.write, d.write === 'queued' ? null : new Date(opts.now));
        return { outcome: d.outcome, live };
      });
      if (result.outcome === 'queued') queueLog({ event: 'dasha_deep_queued', kundli_id: kundliId, role, live: result.live, cap });
      return result.outcome;
    },
    async requeue(kundliId) {
      await backend.withLock((tx) => tx.write(kundliId, 'queued', null));
    },
  };
}

const markerKey = (kundliId: string) => ({ kundli_data_key: { kundli_id: kundliId, data_type: DASHA_DEEP_TYPE, variant: MARKER_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA } });

/** Production backend: one interactive transaction, the advisory lock first, then the count and the conditional write. */
export function prismaSlotBackend(prisma: PrismaClient): SlotBackend {
  return {
    withLock: (fn) =>
      prisma.$transaction(async (tx) => {
        // held until this transaction ends; every starter takes the same key, so count + write are serialised
        await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(${DEEP_SLOT_LOCK_KEY}::bigint)`;
        const t: SlotTx = {
          countLive: (exceptKundliId, since) =>
            tx.kundliData.count({
              where: { data_type: DASHA_DEEP_TYPE, variant: MARKER_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA, status: { in: ['dispatched', 'fetching'] }, fetch_started_at: { gt: since }, kundli_id: { not: exceptKundliId } },
            }),
          readOwn: async (kundliId) => {
            const r = await tx.kundliData.findUnique({ where: markerKey(kundliId) });
            if (!r) return undefined;
            return { dataType: r.data_type, variant: r.variant, params: (r.params ?? {}) as Record<string, unknown>, calcVersion: r.calc_version, payload: r.payload, status: r.status as SlotRow['status'], error: r.error, fetchStartedAt: r.fetch_started_at, fetchedAt: r.fetched_at, validTo: r.valid_to };
          },
          write: async (kundliId, status, startedAt) => {
            const data = { status, ...(startedAt ? { fetch_started_at: startedAt, error: null } : {}) };
            await tx.kundliData.upsert({ where: markerKey(kundliId), create: { kundli_id: kundliId, data_type: DASHA_DEEP_TYPE, variant: MARKER_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA, ...data }, update: data });
          },
        };
        return fn(t);
      }),
  };
}

export function prismaDeepSlots(prisma: PrismaClient): DeepSlots {
  return createDeepSlots(prismaSlotBackend(prisma));
}
