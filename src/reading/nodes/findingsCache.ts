/**
 * Findings cache (token saving, docs/reading-engine/05 and 13 §1). A specialist's finding depends only on the chart, the
 * analyst, the subject, the period and the prompts, so the same inputs reuse the same finding instead of a new model
 * call. The promise and nakshatra layers do not depend on the period (natal), so their key ignores it: a second
 * question in the same area, or a horizon changed during clarification, re-runs only dasha and transit.
 *
 * In process, bounded (LRU), with a TTL. A new dossier (new hash) or new prompts (new version) never hit old entries.
 */
import { readingFindingsV2 } from '../config.js';
import { horizonRange, type Horizon } from '../packs/frames.js';
import { PROMPT_VERSION } from '../prompts/generated.js';
import type { Finding, SpecialistAnalyst } from './specialists.js';

const MAX = 500;
const TTL_MS = (() => {
  const n = Number(process.env.READING_FINDINGS_CACHE_TTL_MS);
  return Number.isFinite(n) && n >= 0 ? n : 6 * 60 * 60_000;
})();

class Lru<V> {
  private m = new Map<string, { at: number; v: V }>();
  hits = 0;
  misses = 0;
  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e || Date.now() - e.at > TTL_MS) {
      if (e) this.m.delete(k);
      this.misses += 1;
      return undefined;
    }
    this.m.delete(k);
    this.m.set(k, e);
    this.hits += 1;
    return e.v;
  }
  set(k: string, v: V): void {
    this.m.delete(k);
    this.m.set(k, { at: Date.now(), v });
    while (this.m.size > MAX) this.m.delete(this.m.keys().next().value as string);
  }
  clear(): void {
    this.m.clear();
    this.hits = 0;
    this.misses = 0;
  }
  get size(): number {
    return this.m.size;
  }
}

export const findingsCache = new Lru<Finding>();

/** Natal layers (promise, nakshatra) ignore the period; timing layers key on the exact period. */
export function findingCacheKey(a: { dossierHash: string; analyst: SpecialistAnalyst; subject: string; horizon: Horizon; asOf: string }): string {
  const natal = a.analyst === 'promise' || a.analyst === 'nakshatra';
  const hz = horizonRange(a.horizon, a.asOf);
  return [a.dossierHash, a.analyst, a.subject, natal ? 'natal' : `${hz.from}..${hz.to}`, PROMPT_VERSION, readingFindingsV2() ? 'v2' : 'v1'].join('|');
}
