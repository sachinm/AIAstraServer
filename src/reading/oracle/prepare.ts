/**
 * Everything before the first model call of the oracle flow, shared by the reading and by prewarm during clarify so both see
 * the same bytes and reach the same cache key: the plan of readers, one load of the stored tables, and one request per reader.
 */
import { explicitCacheEnabled, ensurePromptCache, type CacheOwner } from '../llm/promptCache.js';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import { FRAMES, horizonRange, type SubjectId } from '../packs/frames.js';
import type { EvidencePack } from '../packs/selector.js';
import type { Intent } from '../types.js';
import { CORE_TYPES, loadChartBundle, type ChartRowSource } from './chartBundle.js';
import type { CostGuard } from './costGuard.js';
import { buildTablesFromDigest } from './digestSlices.js';
import { planBRoute, type PlanBRoute } from './planB.js';
import { fetchPlan, personIn, planReaders, subjectVargas, type ReaderId, type ReaderPlan, type SliceContext } from './readers.js';
import { buildReaderRequest, type ReaderRequest } from './runReader.js';
import { renderCore } from './slices.js';

/** A life-long horizon would send a lifetime of dasha rows: readers see up to ten years ahead. */
const MAX_READER_YEARS = 10;

export function readerRange(intent: Intent, asOf: string): { from: string; to: string } {
  const hz = horizonRange(intent.horizon, asOf);
  const limit = `${Number(asOf.slice(0, 4)) + MAX_READER_YEARS}${asOf.slice(4)}`;
  return { from: hz.from, to: hz.to > limit ? limit : hz.to };
}

export type ChartData = Record<string, unknown>;

export interface PreparedReaders {
  subject: SubjectId;
  plan: ReaderPlan;
  route: PlanBRoute | null;
  requests: Map<ReaderId, ReaderRequest>;
  missingTypes: string[];
  slice: SliceContext;
  bundleMs: number;
  coreText: string;
  system: string;
}

export async function prepareReaders(a: {
  rows: ChartRowSource;
  kundliId: string;
  intent: Intent;
  question: string;
  asOf: string;
  pack: EvidencePack;
  model: string;
  transitAt?: unknown;
  prashna?: unknown;
  /** the readers the selected techniques allow (src/techniques/use.ts); absent = every reader of the tier */
  allowedReaders?: readonly ReaderId[] | null;
  /** confirmed person_facts (doc 53 §4.4, 48): passed to each reader as FACTS */
  facts?: Record<string, string> | null;
  /** Ready kundli digest (`DigestView`): slices reader tables directly from the digest when present. */
  digest?: DigestView | null;
  /** Activation calendar rows (`kundli_activation`) overlapping the reading horizon. */
  activation?: readonly ActivationRow[] | null;
}): Promise<PreparedReaders> {
  const subject = a.pack.subject;
  const route = planBRoute(a.question);
  const realWant = a.intent.clarified?.realWant?.id ?? null;
  const slotPerson =
    a.intent.classification?.slots?.subject_person?.value ??
    a.intent.classification?.slots?.other_person?.value ??
    null;
  const plan = planReaders({ intent: a.intent, question: a.question, asOf: a.asOf, realWant, route, prashna: Boolean(a.prashna), allowed: a.allowedReaders ?? null, slotPerson });
  const person = personIn(a.question, slotPerson);
  const vargas = subjectVargas(subject);
  const types = fetchPlan(plan.ids, { vargas, person });
  let tables: Record<string, unknown>;
  let missingTypes: string[];
  let bundleMs = 0;
  if (a.digest && a.digest.status === 'ready') {
    const t0 = Date.now();
    const sliced = buildTablesFromDigest(a.digest, types, { asOf: a.asOf, activation: a.activation ?? null, person });
    tables = { ...sliced.tables };
    if (sliced.missing.length > 0) {
      const fallback = await loadChartBundle(a.rows, a.kundliId, sliced.missing, a.asOf);
      Object.assign(tables, fallback.tables);
      missingTypes = fallback.missing;
      bundleMs = Date.now() - t0;
    } else {
      missingTypes = [];
      bundleMs = Date.now() - t0;
    }
  } else {
    const bundle = await loadChartBundle(a.rows, a.kundliId, types, a.asOf);
    tables = bundle.tables;
    missingTypes = bundle.missing;
    bundleMs = bundle.ms;
  }
  const { from, to } = readerRange(a.intent, a.asOf);
  const slice: SliceContext = {
    tables,
    houses: [...new Set([...(FRAMES[subject]?.houses ?? []), ...(person?.houses ?? [])])],
    vargas,
    from,
    to,
    transits: a.pack.sections.transits,
    transitAt: a.transitAt,
    prashna: a.prashna,
    person,
  };
  const requests = new Map<ReaderId, ReaderRequest>();
  for (const id of plan.ids) {
    // the remedy reader reads findings, so its request is built once they exist
    if (id === 'R14') continue;
    requests.set(id, buildReaderRequest({ id, subject, slice, intent: a.intent, question: a.question, asOf: a.asOf, model: a.model, keyFrame: a.pack.keyFrame, ...(a.facts ? { facts: a.facts } : {}) }));
  }
  const coreText = renderCore(tables, CORE_TYPES).text;
  const system = [...requests.values()][0]?.system ?? '';
  return { subject, plan, route, requests, missingTypes, slice, bundleMs, coreText, system };
}

/** USD per 1M tokens per hour of explicit cache storage (ai.google.dev pricing, read 2026-11-01). */
const CACHE_STORAGE_PER_HOUR: Record<string, number> = { 'gemini-3.1-flash-lite': 1, 'gemini-3.5-flash-lite': 1, 'gemini-2.5-flash': 1, 'gemini-3.8-flash': 0.5 };
const CACHE_HOURS = 0.5;

const startedCaches = new Set<string>();

/** Test seam. */
export function clearStartedCaches(): void {
  startedCaches.clear();
}

/**
 * Starts the readers' shared cache and books its storage once per prefix per instance, so the cap counts it. Storage is billed
 * by the hour and is not in any usage report, so this is an estimate. Returns the promise for callers that want to wait.
 */
export function startReaderCache(p: Pick<PreparedReaders, 'system' | 'coreText'>, model: string, owner: CacheOwner, guard: CostGuard): Promise<unknown> {
  if (!explicitCacheEnabled() || !p.coreText) return Promise.resolve(null);
  const key = `${model}|${p.coreText.length}|${owner.kundliId ?? ''}`;
  if (!startedCaches.has(key)) {
    startedCaches.add(key);
    const tokens = Math.ceil((p.system.length + p.coreText.length) / 3.6);
    guard.record({ node: 'cache_storage', stage: 'fanout', model, usd: (tokens * (CACHE_STORAGE_PER_HOUR[model] ?? 1) * CACHE_HOURS) / 1_000_000, estimate: true });
  }
  return ensurePromptCache(model, p.system, p.coreText, owner).catch(() => null);
}
