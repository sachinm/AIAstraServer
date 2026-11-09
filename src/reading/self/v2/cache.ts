/**
 * Warm-up and cache ledger of the Self v2 build (docs/reading-engine/66 §4.8 step 3; AGENTS.md "Board and technique
 * machinery" rules 4 and 5).
 *
 * `warmPrefixes` creates or adopts the Gemini explicit cache for every agent prefix in parallel, before any agent call,
 * through the helper the current Oracle already uses (`ensurePromptCache`, promptCache.ts). That helper writes the
 * ledger row itself: on create it records one `llm_cache_entries` row (`name`, `provider`, `user_id`, `kundli_id`,
 * `prefix_hash`, `model`, `created_at`, `last_used_at`, `expires_at`) through the cache registry, and adopting a live
 * region touches its row. So this module adds no second writer; it only fans the slices out and times them.
 *
 * Behind READING_EXPLICIT_CACHE=1; otherwise a no-op (no network, no row). After each agent call the build calls
 * `markAgentUsed`, which informs the 45-minute per-individual recycler (`informIndividualCacheUsed`), so
 * `recycleIndividualCaches` deletes the person's regions and rows after READING_CACHE_RECYCLE_MINUTES of inactivity.
 */
import { informIndividualCacheUsed } from '../../llm/cacheSweep.js';
import { ensurePromptCache, explicitCacheEnabled } from '../../llm/promptCache.js';
import type { AgentSlice, PreparedAgentSlice, WarmedRegion } from '../v2types.js';

export interface WarmDeps {
  /** test seam: defaults to `ensurePromptCache` */
  ensureCache?: typeof ensurePromptCache;
}

/**
 * Creates or refreshes the explicit cache for every slice's prefix, all in parallel. Resolves when every region is
 * ready (or failed: a failure never blocks the build; that agent's call goes uncached). Never throws.
 */
export async function warmPrefixes(slices: readonly PreparedAgentSlice[], deps: WarmDeps = {}): Promise<WarmedRegion[]> {
  if (!explicitCacheEnabled()) return slices.map((s) => ({ agent: s.agent, prefixHash: s.prefixHash, model: s.model, name: null, ms: 0 }));
  const ensure = deps.ensureCache ?? ensurePromptCache;
  // the same prefix on the same model and system is one region; warm it once
  const seen = new Map<string, Promise<string | null>>();
  return Promise.all(
    slices.map(async (s): Promise<WarmedRegion> => {
      const t0 = performance.now();
      const id = `${s.model}\n${s.system}\n${s.prefixHash}`;
      let p = seen.get(id);
      if (!p) {
        p = ensure(s.model, s.system || undefined, s.prefix, s.cacheOwner).catch(() => null);
        seen.set(id, p);
      }
      const name = await p;
      return { agent: s.agent, prefixHash: s.prefixHash, model: s.model, name, ms: Math.round((performance.now() - t0) * 100) / 100 };
    }),
  );
}

/** After each agent call: the person's caches were used; the recycler deletes them 45 minutes after the last use. */
export function markAgentUsed(slice: Pick<AgentSlice, 'cacheOwner'>, inform: typeof informIndividualCacheUsed = informIndividualCacheUsed): void {
  try {
    inform({ userId: slice.cacheOwner.userId, kundliId: slice.cacheOwner.kundliId });
  } catch {
    // never break a build over the recycler
  }
}
