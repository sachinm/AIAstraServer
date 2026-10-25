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
 */
import { createHash } from 'node:crypto';
import { getGeminiModelsBaseUrl } from '../../config/env.js';

interface Entry {
  uses: number;
  name?: string;
  expiresAt?: number;
  creating?: Promise<void>;
  disabledUntil?: number;
}

const entries = new Map<string, Entry>();
const MAX_ENTRIES = 2000;

export function explicitCacheEnabled(): boolean {
  return process.env.READING_EXPLICIT_CACHE?.trim() === '1';
}
function minUses(): number {
  const n = Number(process.env.READING_EXPLICIT_CACHE_MIN_USES);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}
function ttlSeconds(): number {
  const n = Number(process.env.READING_EXPLICIT_CACHE_TTL_SECONDS);
  return Number.isFinite(n) && n >= 60 ? Math.floor(n) : 3600;
}

export function prefixKey(model: string, system: string | undefined, base: string): string {
  return createHash('sha256').update(`${model}\n${system ?? ''}\n${base}`).digest('hex').slice(0, 24);
}

export function cachedContentsUrl(): string {
  return `${getGeminiModelsBaseUrl().replace(/\/models\/?$/, '')}/cachedContents`;
}

export const cacheStats = { created: 0, hits: 0, misses: 0, errors: 0 };

export function clearPromptCache(): void {
  entries.clear();
  cacheStats.created = cacheStats.hits = cacheStats.misses = cacheStats.errors = 0;
}

async function create(key: string, e: Entry, model: string, system: string | undefined, base: string, apiKey: string): Promise<void> {
  try {
    const body = {
      model: `models/${model}`,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: base }] }],
      ttl: `${ttlSeconds()}s`,
    };
    const res = await fetch(`${cachedContentsUrl()}?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    const json = (await res.json()) as { name?: string; expireTime?: string; error?: { message?: string } };
    if (!res.ok || !json.name) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    e.name = json.name;
    e.expiresAt = json.expireTime ? Date.parse(json.expireTime) : Date.now() + ttlSeconds() * 1000;
    cacheStats.created += 1;
  } catch (err) {
    e.disabledUntil = Date.now() + 10 * 60_000;
    cacheStats.errors += 1;
    console.warn(JSON.stringify({ msg: 'reading prompt cache create failed; continuing uncached', key, error: (err as Error).message.slice(0, 200) }));
  } finally {
    e.creating = undefined;
  }
}

/**
 * The cachedContent name to use for this prefix, or null (call uncached). Never waits for creation.
 * `base` is the first user part; `system` the system instruction.
 */
export function cacheNameFor(model: string, system: string | undefined, base: string, apiKey: string): string | null {
  if (!explicitCacheEnabled() || !base) return null;
  const key = prefixKey(model, system, base);
  let e = entries.get(key);
  if (!e) {
    if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
    e = { uses: 0 };
    entries.set(key, e);
  }
  const now = Date.now();
  if (e.name && e.expiresAt && e.expiresAt - 60_000 > now) {
    cacheStats.hits += 1;
    return e.name;
  }
  cacheStats.misses += 1;
  e.uses += 1;
  if (e.name) e.name = undefined; // expired
  if (!e.creating && (!e.disabledUntil || e.disabledUntil < now) && e.uses >= minUses()) e.creating = create(key, e, model, system, base, apiKey);
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

/** Test seam: wait for any background creation. */
export async function settlePromptCache(): Promise<void> {
  await Promise.all([...entries.values()].map((e) => e.creating).filter(Boolean));
}
