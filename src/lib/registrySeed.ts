/**
 * Registry seeds (`agent_registry`, `technique_registry`) off the request path (TODOS 72-hour sweep, 2026-11-19: the seed
 * upserts timed out on cold starts and waited on row locks for up to 11 minutes while a request waited behind them).
 *
 * Two parts:
 *   - `changedSeedRows`: one read compares the definitions with the table (`jsonb_to_recordset` LEFT JOIN, `IS DISTINCT
 *     FROM` over the seeded columns only) and returns the ids that are new or differ. Unchanged: no write at all, so
 *     concurrent cold containers take no row lock. Changed: only those rows are written, under a short lock_timeout.
 *     (No stored hash: the registries are listed in the admin panel and `system_prompts` versions every write, so there
 *     is no clean row to keep one in; the diff read also catches a hand edit a hash would miss.)
 *   - `runSeedInBackground`: once per process, after a short delay, up to three tries with backoff; resolves with the row
 *     count, never rejects, logs success or failure once.
 */
import { createHash } from 'node:crypto';

export type RawSeedClient = {
  $queryRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<Array<{ id: string }>>;
  $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
  $transaction?: (ops: unknown[]) => Promise<unknown[]>;
};

/** sha1 of the payload: an in-process memo, so a container that seeded once never reads again for the same definitions */
export function seedHash(payload: string): string {
  return createHash('sha1').update(payload).digest('hex');
}

/** The ids the table lacks or holds differently, or null when the client cannot read raw SQL (test fakes). */
export async function changedSeedRows(client: RawSeedClient, diffSql: string, payload: string): Promise<Set<string> | null> {
  if (typeof client.$queryRawUnsafe !== 'function') return null;
  const rows = await client.$queryRawUnsafe(diffSql, payload);
  return new Set(rows.map((r) => r.id));
}

/** How long a seed write waits on a row lock before giving up (it is retried by the background runner). */
export const SEED_LOCK_TIMEOUT = '5s';

/** Runs the seed statement, inside a transaction with a short lock_timeout when the client has one. */
export async function writeSeed(client: RawSeedClient, sql: string, payload: string): Promise<void> {
  const exec = client.$executeRawUnsafe!;
  if (typeof client.$transaction === 'function') {
    await client.$transaction([exec.call(client, `SET LOCAL lock_timeout = '${SEED_LOCK_TIMEOUT}'`), exec.call(client, sql, payload)]);
    return;
  }
  await exec.call(client, sql, payload);
}

export interface BackgroundSeedOptions {
  /** wait before the first try, so the request that triggered it finishes first (default REGISTRY_SEED_DELAY_MS or 2000) */
  delayMs?: number;
  /** waits between tries (default 2 s, then 8 s: three tries) */
  backoffMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  log?: Pick<Console, 'log' | 'warn'>;
}

/** after a background seed failed every try, the next caller may start a new one this much later */
export const SEED_RETRY_AFTER_MS = 10 * 60_000;

/** runs `fn` after `ms` on a timer that never holds the process open */
export function releaseAfter(ms: number, fn: () => void): void {
  const t = setTimeout(fn, ms);
  (t as { unref?: () => void }).unref?.();
}

export function seedDelayMs(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.REGISTRY_SEED_DELAY_MS);
  return Number.isFinite(n) && n >= 0 ? n : 2_000;
}

const unrefSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    (t as { unref?: () => void }).unref?.();
  });

/**
 * One background seed: waits `delayMs`, then tries `seed` (a count > 0 is success) up to 1 + backoff.length times.
 * Resolves with the last count (0 = every try failed). Never rejects; logs once.
 */
export async function runSeedInBackground(label: string, seed: () => Promise<number>, opts: BackgroundSeedOptions = {}): Promise<number> {
  const sleep = opts.sleep ?? unrefSleep;
  const log = opts.log ?? console;
  const backoff = opts.backoffMs ?? [2_000, 8_000];
  const t0 = Date.now();
  let lastError = '';
  let n = 0;
  await sleep(opts.delayMs ?? seedDelayMs());
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    try {
      n = await seed();
    } catch (e) {
      n = 0;
      lastError = (e as Error)?.message ?? String(e);
    }
    if (n > 0) {
      log.log(JSON.stringify({ msg: `[seed] ${label} registry seeded`, rows: n, tries: attempt + 1, ms: Date.now() - t0 }));
      return n;
    }
    if (attempt < backoff.length) await sleep(backoff[attempt]!);
  }
  log.warn(JSON.stringify({ msg: `[seed] ${label} registry seed failed`, tries: backoff.length + 1, ms: Date.now() - t0, ...(lastError ? { error: lastError.slice(0, 200) } : {}) }));
  return 0;
}
