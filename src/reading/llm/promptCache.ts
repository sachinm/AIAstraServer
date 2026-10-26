/**
 * Explicit Gemini prompt cache for the reading engine (docs/reading-engine/05 §4). Off by default:
 * READING_EXPLICIT_CACHE=1 turns it on once Gemini billing is paid (the free tier has no cachedContents storage).
 *
 * What is cached: the system instruction (persona + method, identical for everyone) plus the first user part, which
 * the engine keeps as the user's base chart (byte-identical across that user's questions). Later calls send
 * `cachedContent` and only the question-specific parts, so those ~3k prefix tokens are billed at the cached rate.
 *
 * Policy: lazy. A prefix is cached on its READING_EXPLICIT_CACHE_MIN_USES-th use (default 2) inside the TTL, in the
 * background; the call that triggers creation runs uncached and never waits. Any cache error disables caching for that
 * prefix for 10 minutes and the call proceeds without it (the caller retries once uncached if the server rejects it).
 *
 * Lifecycle (docs/reading-engine/20 §8, 21 §1 Q4; R-7): TTL 30 min (READING_EXPLICIT_CACHE_TTL_SECONDS overrides),
 * sliding: a hit with less than half the TTL left extends it in the background. Every cache is named
 * `aiastra:<prefixHash>` and recorded in the registry (cacheRegistry.ts); before creating, an instance adopts a live
 * registry row for the same prefix, so Lambda instances share one cache. `deleteUserCaches` runs on logout and
 * `sweepLlmCaches` every 45 minutes. Registry failures are logged once and the cache keeps working in memory only.
 */
import { createHash } from 'node:crypto';
import { getGeminiModelsBaseUrl } from '../../config/env.js';
import type { CacheRegistry, CacheRow } from './cacheRegistry.js';

export interface CacheOwner {
  userId?: string | null;
  kundliId?: string | null;
}

interface Entry {
  uses: number;
  name?: string;
  expiresAt?: number;
  creating?: Promise<void>;
  extending?: Promise<void>;
  disabledUntil?: number;
  /** registry already asked once for a cache made by another instance */
  looked?: boolean;
  touchedAt?: number;
  owner: CacheOwner;
}

const entries = new Map<string, Entry>();
const MAX_ENTRIES = 2000;
const DISPLAY_PREFIX = 'aiastra:';
const PROVIDER = 'gemini';
const TOUCH_EVERY_MS = 60_000;
const REGISTRY_RETRY_MS = 5 * 60_000;

export function explicitCacheEnabled(): boolean {
  return process.env.READING_EXPLICIT_CACHE?.trim() === '1';
}
function minUses(): number {
  const n = Number(process.env.READING_EXPLICIT_CACHE_MIN_USES);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}
function ttlSeconds(): number {
  const n = Number(process.env.READING_EXPLICIT_CACHE_TTL_SECONDS);
  return Number.isFinite(n) && n >= 60 ? Math.floor(n) : 1800;
}

export function prefixKey(model: string, system: string | undefined, base: string): string {
  return createHash('sha256').update(`${model}\n${system ?? ''}\n${base}`).digest('hex').slice(0, 24);
}

function apiRoot(): string {
  return getGeminiModelsBaseUrl().replace(/\/models\/?$/, '');
}
export function cachedContentsUrl(): string {
  return `${apiRoot()}/cachedContents`;
}
function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export const cacheStats = { created: 0, adopted: 0, hits: 0, misses: 0, extended: 0, errors: 0 };

export function clearPromptCache(): void {
  entries.clear();
  for (const k of Object.keys(cacheStats) as Array<keyof typeof cacheStats>) cacheStats[k] = 0;
}

// ---------------------------------------------------------------- registry (best effort)

let registryOverride: CacheRegistry | null | undefined;
let defaultRegistry: Promise<CacheRegistry> | undefined;
let registryDownUntil = 0;
let registryWarned = false;

/** Test seam / no-DB mode: use this registry (null = none, memory only); undefined restores the Prisma registry. */
export function setCacheRegistry(r: CacheRegistry | null | undefined): void {
  registryOverride = r;
  registryDownUntil = 0;
  registryWarned = false;
}

async function registry(): Promise<CacheRegistry | null> {
  if (registryOverride !== undefined) return registryOverride;
  defaultRegistry ??= Promise.all([import('../../lib/prisma.js'), import('./cacheRegistry.js')]).then(([p, r]) => r.prismaCacheRegistry(p.prisma));
  return defaultRegistry;
}

/** Runs a registry call; on failure logs once, pauses the registry for 5 minutes and returns `fallback`. */
async function reg<T>(op: string, fallback: T, fn: (r: CacheRegistry) => Promise<T>): Promise<T> {
  if (Date.now() < registryDownUntil) return fallback;
  try {
    const r = await registry();
    return r ? await fn(r) : fallback;
  } catch (err) {
    registryDownUntil = Date.now() + REGISTRY_RETRY_MS;
    if (!registryWarned) {
      registryWarned = true;
      console.warn(JSON.stringify({ msg: 'llm cache registry unavailable; continuing in memory only', op, error: (err as Error).message.slice(0, 200) }));
    }
    return fallback;
  }
}

/** True when the registry answers (used by the sweeper: no orphan reconcile without it). */
async function registryUp(): Promise<boolean> {
  return reg('ping', false, async (r) => {
    await r.liveNames();
    return true;
  });
}

// ---------------------------------------------------------------- Gemini cachedContents calls

async function geminiDelete(name: string, apiKey: string): Promise<void> {
  const res = await fetch(`${apiRoot()}/${name}?key=${encodeURIComponent(apiKey)}`, { method: 'DELETE', signal: AbortSignal.timeout(10_000) });
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
}

async function geminiExtend(name: string, apiKey: string): Promise<string | undefined> {
  const res = await fetch(`${apiRoot()}/${name}?updateMask=ttl&key=${encodeURIComponent(apiKey)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ttl: `${ttlSeconds()}s` }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { expireTime?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json.expireTime;
}

interface ListedCache {
  name: string;
  displayName?: string;
  createTime?: string;
}
async function geminiList(apiKey: string): Promise<ListedCache[]> {
  const out: ListedCache[] = [];
  let pageToken = '';
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`${cachedContentsUrl()}?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10_000) });
    const json = (await res.json().catch(() => ({}))) as { cachedContents?: ListedCache[]; nextPageToken?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    out.push(...(json.cachedContents ?? []));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return out;
}

// ---------------------------------------------------------------- create / adopt / extend

/** Adopt a live cache another instance made for this prefix; else create one when `allowCreate`. */
async function adoptOrCreate(key: string, e: Entry, model: string, system: string | undefined, base: string, apiKey: string, allowCreate: boolean): Promise<void> {
  try {
    const now = Date.now();
    const row = await reg('findLive', null, (r) => r.findLive(key, new Date(now + 60_000)));
    if (row) {
      e.name = row.name;
      e.expiresAt = row.expiresAt.getTime();
      e.touchedAt = now;
      cacheStats.adopted += 1;
      void reg('touch', undefined, (r) => r.touch(row.name, new Date(now)));
      return;
    }
    if (!allowCreate) return;
    const body = {
      model: `models/${model}`,
      displayName: `${DISPLAY_PREFIX}${key}`,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: base }] }],
      ttl: `${ttlSeconds()}s`,
    };
    const res = await fetch(`${cachedContentsUrl()}?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    const json = (await res.json()) as { name?: string; expireTime?: string; error?: { message?: string } };
    if (!res.ok || !json.name) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    const created = Date.now();
    e.name = json.name;
    e.expiresAt = json.expireTime ? Date.parse(json.expireTime) : created + ttlSeconds() * 1000;
    e.touchedAt = created;
    cacheStats.created += 1;
    const entry: CacheRow = {
      name: json.name,
      provider: PROVIDER,
      userId: e.owner.userId ?? null,
      kundliId: e.owner.kundliId ?? null,
      prefixHash: key,
      model,
      createdAt: new Date(created),
      lastUsedAt: new Date(created),
      expiresAt: new Date(e.expiresAt),
      deletedAt: null,
      deleteError: null,
    };
    await reg('record', undefined, (r) => r.record(entry));
  } catch (err) {
    e.disabledUntil = Date.now() + 10 * 60_000;
    cacheStats.errors += 1;
    console.warn(JSON.stringify({ msg: 'reading prompt cache create failed; continuing uncached', key, error: (err as Error).message.slice(0, 200) }));
  } finally {
    e.creating = undefined;
  }
}

async function extend(e: Entry, name: string, apiKey: string): Promise<void> {
  try {
    const expireTime = await geminiExtend(name, apiKey);
    const at = expireTime ? Date.parse(expireTime) : Date.now() + ttlSeconds() * 1000;
    if (e.name === name) e.expiresAt = at;
    cacheStats.extended += 1;
    await reg('touch', undefined, (r) => r.touch(name, new Date(), new Date(at)));
  } catch (err) {
    cacheStats.errors += 1;
    console.warn(JSON.stringify({ msg: 'reading prompt cache ttl extend failed', name, error: (err as Error).message.slice(0, 200) }));
  } finally {
    e.extending = undefined;
  }
}

/**
 * The cachedContent name to use for this prefix, or null (call uncached). Never waits for creation, adoption or extension.
 * `base` is the first user part; `system` the system instruction; `owner` who the cache belongs to (logout deletes it).
 */
export function cacheNameFor(model: string, system: string | undefined, base: string, apiKey: string, owner: CacheOwner = {}): string | null {
  if (!explicitCacheEnabled() || !base) return null;
  const key = prefixKey(model, system, base);
  let e = entries.get(key);
  if (!e) {
    if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
    e = { uses: 0, owner: {} };
    entries.set(key, e);
  }
  if (owner.userId) e.owner.userId = owner.userId;
  if (owner.kundliId) e.owner.kundliId = owner.kundliId;
  const now = Date.now();
  if (e.name && e.expiresAt && e.expiresAt - 60_000 > now) {
    cacheStats.hits += 1;
    const name = e.name;
    if (!e.extending && e.expiresAt - now < (ttlSeconds() * 1000) / 2) {
      e.touchedAt = now;
      e.extending = extend(e, name, apiKey);
    } else if (!e.touchedAt || now - e.touchedAt > TOUCH_EVERY_MS) {
      e.touchedAt = now;
      void reg('touch', undefined, (r) => r.touch(name, new Date(now)));
    }
    return name;
  }
  cacheStats.misses += 1;
  e.uses += 1;
  if (e.name) e.name = undefined; // expired
  if (!e.creating && (!e.disabledUntil || e.disabledUntil < now)) {
    const allowCreate = e.uses >= minUses();
    // first sighting on this instance: ask the registry whether another instance already cached this prefix
    if (allowCreate || !e.looked) {
      e.looked = true;
      e.creating = adoptOrCreate(key, e, model, system, base, apiKey, allowCreate);
    }
  }
  return null;
}

/** The server rejected a cache name (expired, deleted): forget it so the next call recreates or goes uncached. */
export function invalidateCache(model: string, system: string | undefined, base: string): void {
  const e = entries.get(prefixKey(model, system, base));
  if (e) {
    e.name = undefined;
    e.expiresAt = undefined;
  }
}

function forgetName(name: string): void {
  for (const e of entries.values()) {
    if (e.name === name) {
      e.name = undefined;
      e.expiresAt = undefined;
    }
  }
}

/** Test seam: wait for any background creation or extension. */
export async function settlePromptCache(): Promise<void> {
  await Promise.all([...entries.values()].flatMap((e) => [e.creating, e.extending]).filter(Boolean));
}

// ---------------------------------------------------------------- logout + sweeper

/** Delete one cache at Gemini (404 counts as deleted) and mark its row. Returns false when the delete failed. */
async function deleteOne(name: string, apiKey: string): Promise<boolean> {
  forgetName(name);
  try {
    await geminiDelete(name, apiKey);
    await reg('markDeleted', undefined, (r) => r.markDeleted(name, new Date()));
    return true;
  } catch (err) {
    const msg = (err as Error).message.slice(0, 200);
    await reg('markDeleteError', undefined, (r) => r.markDeleteError(name, msg));
    console.warn(JSON.stringify({ msg: 'llm cache delete failed; the sweeper retries', name, error: msg }));
    return false;
  }
}

/** Logout: delete every live cache of this user (registry rows plus this instance's memory). Never throws. */
export async function deleteUserCaches(userId: string): Promise<{ deleted: number; failed: number }> {
  const apiKey = geminiKey();
  if (!apiKey || !userId) return { deleted: 0, failed: 0 };
  const names = new Set((await reg('listByUser', [] as CacheRow[], (r) => r.listByUser(userId))).map((r) => r.name));
  for (const e of entries.values()) if (e.owner.userId === userId && e.name) names.add(e.name);
  let deleted = 0;
  let failed = 0;
  for (const name of names) (await deleteOne(name, apiKey)) ? (deleted += 1) : (failed += 1);
  if (names.size) console.log(JSON.stringify({ msg: 'llm caches deleted on logout', userId, deleted, failed }));
  return { deleted, failed };
}

export interface SweepResult {
  idleDeleted: number;
  expiredMarked: number;
  orphansDeleted: number;
  failed: number;
  reconciled: boolean;
}

/**
 * Delete caches idle longer than `idleMs` (default 30 min) and mark expired rows; then reconcile against Gemini's list:
 * a cache named `aiastra:*` with no live registry row is an orphan and is deleted. Caches made in the last 5 minutes are
 * left alone (their row may still be on its way); without a working registry nothing is reconciled.
 */
export async function sweepLlmCaches(opts: { idleMs?: number; now?: Date } = {}): Promise<SweepResult> {
  const out: SweepResult = { idleDeleted: 0, expiredMarked: 0, orphansDeleted: 0, failed: 0, reconciled: false };
  const apiKey = geminiKey();
  if (!apiKey) return out;
  const now = opts.now ?? new Date();
  const idleBefore = new Date(now.getTime() - (opts.idleMs ?? 30 * 60_000));
  for (const row of await reg('listStale', [] as CacheRow[], (r) => r.listStale(idleBefore, now))) {
    if (row.expiresAt <= now) {
      forgetName(row.name);
      await reg('markDeleted', undefined, (r) => r.markDeleted(row.name, now));
      out.expiredMarked += 1;
    } else if (await deleteOne(row.name, apiKey)) out.idleDeleted += 1;
    else out.failed += 1;
  }
  if (!(await registryUp())) return out;
  const live = await reg('liveNames', null as Set<string> | null, (r) => r.liveNames());
  if (!live) return out;
  try {
    const youngest = now.getTime() - 5 * 60_000;
    for (const c of await geminiList(apiKey)) {
      if (!c.displayName?.startsWith(DISPLAY_PREFIX) || live.has(c.name)) continue;
      if (c.createTime && Date.parse(c.createTime) > youngest) continue;
      if (await deleteOne(c.name, apiKey)) out.orphansDeleted += 1;
      else out.failed += 1;
    }
    out.reconciled = true;
  } catch (err) {
    out.failed += 1;
    console.warn(JSON.stringify({ msg: 'llm cache reconcile failed', error: (err as Error).message.slice(0, 200) }));
  }
  console.log(JSON.stringify({ msg: 'llm cache sweep', ...out }));
  return out;
}
