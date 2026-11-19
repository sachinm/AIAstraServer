/**
 * Per-kundli cache leases (docs/reading-engine/86 §4, Sachin 2026-11-18): the explicit Gemini caches a dashboard build
 * made are deleted as soon as the build ends, never under another operation still using them.
 *
 * - An operation that reads a person's caches (a build, a card-chat answer) runs under a lease on the kundli:
 *   `withCacheLease({ userId, kundliId }, 'build', fn)`.
 * - A recording lease (a build) records every prompt-cache key looked up or warmed for that kundli inside its own async
 *   call tree (AsyncLocalStorage; the key-used hook in promptCache.ts). Another operation's keys (an Ask answer running
 *   meanwhile) are not recorded. A card-chat answer's lease records nothing: it only keeps a build's deletes waiting.
 * - At the last release the recorded keys are deleted (`deleteCachesByKey`: an in-flight create is awaited, a failed
 *   delete is queued for the next `llm-cache-sweep`). A lease taken while the delete runs starts a new record.
 * - With READING_CACHE_DELETE_AFTER_BUILD=0 nothing is recorded or deleted here; the 45-minute recycle does it.
 *
 * The count is per Lambda instance. Another instance's call on a cache deleted here is refused by Gemini (403/404) and
 * is retried uncached (`isCacheRejection` in gemini.ts): it costs input tokens, it never fails the call.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { isCacheDeleteAfterBuildEnabled } from '../../config/env.js';
import { deleteCachesByKey, setCacheKeyUsedHook, type CacheOwner } from './promptCache.js';

export interface CacheLease {
  readonly kundliId: string | null;
  /** Ends this lease; at the kundli's last release its recorded caches are deleted. Idempotent. Never throws. */
  release(): Promise<LeaseCleanup | null>;
}

export interface LeaseCleanup {
  kundliId: string;
  keys: number;
  deleted: number;
  failed: number;
  ms: number;
}

interface Held {
  count: number;
  keys: Set<string>;
  labels: Map<string, number>;
}

const held = new Map<string, Held>();
const scope = new AsyncLocalStorage<{ kundliId: string; record: boolean }>();
let deleter: (keys: string[]) => Promise<{ deleted: number; failed: number }> = (keys) => deleteCachesByKey(keys);
let lastCleanup: LeaseCleanup | null = null;

function noteKey(owner: CacheOwner, key: string): void {
  const k = owner.kundliId?.trim();
  const s = scope.getStore();
  if (!k || !s?.record || s.kundliId !== k) return;
  const h = held.get(k);
  if (h && h.count > 0) h.keys.add(key);
}
setCacheKeyUsedHook(noteKey);

/**
 * Takes a lease on the person's caches. A lease without a kundli id is a no-op. Keys are recorded only inside
 * `withCacheLease(…, { record: true })`; a bare lease holds the count only.
 */
export function acquireCacheLease(owner: CacheOwner, label = 'op'): CacheLease {
  const k = owner.kundliId?.trim() || null;
  if (!k || !isCacheDeleteAfterBuildEnabled()) return { kundliId: k, release: async () => null };
  let h = held.get(k);
  if (!h) {
    h = { count: 0, keys: new Set(), labels: new Map() };
    held.set(k, h);
  }
  h.count += 1;
  h.labels.set(label, (h.labels.get(label) ?? 0) + 1);
  let done = false;
  const mine = h;
  return {
    kundliId: k,
    async release() {
      if (done) return null;
      done = true;
      mine.count -= 1;
      mine.labels.set(label, (mine.labels.get(label) ?? 1) - 1);
      if (mine.count > 0) return null;
      // the last holder: take the record and delete it; a lease taken from here on starts a new record
      if (held.get(k) === mine) held.delete(k);
      const keys = [...mine.keys];
      if (!keys.length) return null;
      const t0 = Date.now();
      let r = { deleted: 0, failed: keys.length };
      try {
        r = await deleter(keys);
      } catch (e) {
        console.warn(JSON.stringify({ msg: 'cache lease cleanup failed; the sweeper deletes them', kundliId: k, error: String((e as Error)?.message ?? e).slice(0, 200) }));
      }
      lastCleanup = { kundliId: k, keys: keys.length, deleted: r.deleted, failed: r.failed, ms: Date.now() - t0 };
      console.log(JSON.stringify({ msg: 'llm caches deleted at lease release', ...lastCleanup }));
      return lastCleanup;
    },
  };
}

/**
 * Runs `fn` under a lease and releases it after `fn` settles (the release's deletes are awaited). `record` (default
 * true): the keys `fn`'s calls use for this kundli are recorded and deleted at the kundli's last release.
 */
export async function withCacheLease<T>(owner: CacheOwner, label: string, fn: () => Promise<T>, opts: { record?: boolean } = {}): Promise<T> {
  const lease = acquireCacheLease(owner, label);
  try {
    return lease.kundliId ? await scope.run({ kundliId: lease.kundliId, record: opts.record !== false }, fn) : await fn();
  } finally {
    await lease.release();
  }
}

/** True while an operation holds a lease on this kundli (the 45-minute recycle waits). */
export function isCacheLeased(kundliId: string | null | undefined): boolean {
  const k = kundliId?.trim();
  return Boolean(k && (held.get(k)?.count ?? 0) > 0);
}

/** Diagnostics and tests: the holders and recorded keys of one kundli. */
export function leaseState(kundliId: string): { count: number; keys: string[]; labels: Record<string, number> } | null {
  const h = held.get(kundliId);
  return h ? { count: h.count, keys: [...h.keys], labels: Object.fromEntries(h.labels) } : null;
}

export function lastLeaseCleanup(): LeaseCleanup | null {
  return lastCleanup;
}

/** Test seams. */
export function setLeaseDeleter(fn: ((keys: string[]) => Promise<{ deleted: number; failed: number }>) | null): void {
  deleter = fn ?? ((keys) => deleteCachesByKey(keys));
}
export function clearCacheLeases(): void {
  held.clear();
  lastCleanup = null;
  setCacheKeyUsedHook(noteKey);
}
