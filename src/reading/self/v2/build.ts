/**
 * The Self v2 build (docs/reading-engine/66 §4.8 "Order of a build", steps 0–8):
 *
 *   0–1  sub-techniques over one build context (the sub-techniques lane; injected as `subs`)
 *   2    area briefs
 *   3    every agent's slice from the context (no DB); the family and Oracle prefixes warmed in parallel
 *   4    family readers ×5, in parallel, read through `reading_findings_cache`
 *   5    Oracle: three parallel calls over the warm prefix; failed areas re-asked once (one repair call)
 *   6    validator (doc 65) → every finding to `reading_validation_failures`; `technique_outputs` `self.v2.oracle` (ok, or
 *        partial with at least 8 areas ok or repaired)
 *   7    Personalizer over the Oracle document + the profile pack (its prefix warmed first: it is the Oracle document,
 *        which exists only after step 6 on a cold build)
 *   8    validator (§4.1) → its drops to `reading_validation_failures`; the Oracle's failed areas take the last good
 *        reading's card (stale) or are withheld; `technique_outputs` `self.v2.personalizer` only when the build serves the
 *        page (the hero and 8 of 11 areas ok or repaired; failures.ts `servesPage`), else `partial`, nothing stored
 *   7–8 run beside the v3 step (SELF_V3_BUILD=1) once the portrait is built; both share the build's one spend cap
 *
 * Returns timings and tokens per agent. A stored Oracle that still covers today skips steps 4–6 (no model call); a
 * stored card document for the same Oracle key and profile hash skips step 7. Charging stays with the existing build
 * event (one per board per day). Never throws.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getReadingBoardSpendCapUsd, getReadingSpendCapUsd, getSelfPersonalizerMaxOutputTokens, getSelfPersonalizerRetryMaxOutputTokens, isSelfV2Retired, isSelfV3BuildEnabled } from '../../../config/env.js';
import { usageCostUsd } from '../../llm/models.js';
import { runSelfV3Cards, type SelfV3StepResult } from '../v3/build.js';
import { withTechniqueOutput } from '../../../techniques/outputStore.js';
import { canonicalJson } from '../../../techniques/pieces.js';
import { informIndividualCacheUsed } from '../../llm/cacheSweep.js';
import { callGemini as realCallGemini, type GeminiCallOptions, type GeminiResult } from '../../llm/gemini.js';
import type { ensurePromptCache } from '../../llm/promptCache.js';
import type {
  AreaBrief,
  PreparedAgentSlice,
  SelfBuildContext,
  SelfV2AgentTiming,
  SelfV2CardsResult,
  SelfV2Frame,
  SelfV2OracleResult,
  SelfV2Quality,
  WarmedRegion,
} from '../v2types.js';
import { issuesFromGaps, logValidation, qualityOf, recordValidationIssues, SERVE_MIN_AREAS, servesPage, type RecordMeta } from './failures.js';
import { withCacheLease } from '../../llm/cacheLease.js';
import { warmPrefixes } from './cache.js';
import { runOracleV2 } from './oracle.js';
import { runPersonalizer } from './personalizer.js';
import { buildPersonPortrait, loadPortraitSources, type PortraitSources } from './portrait.js';
import {
  buildFamilySlices,
  buildOracleSlice,
  buildPersonalizerSlice,
  FAMILY_IDS,
  promptHash,
  SELF_V2_ORACLE_PROMPT,
  SELF_V2_PERSONALIZER_PROMPT,
  shortHash,
} from './slices.js';
import { stageOfStep } from './progress.js';
import { runFamilyReaders } from '../../families/run.js';
import { buildNatalContext } from '../../slices/natalPrefix.js';
import { CARD_READING_TECHNIQUE } from '../../cards/types.js';
import { storeLayerOutputs } from '../layerStore.js';
import { readLastGoodAreas, SELF_V2_ORACLE_TECHNIQUE, SELF_V2_PERSONALIZER_TECHNIQUE, writeSelfV2Marker, type StoredSelfV2Cards, type StoredSelfV2Oracle } from './store.js';
import { buildAreaBriefs } from '../areas/index.js';
import { runSelfSubTechniques, type SelfV2Deps } from '../sub/index.js';

/** the sub-techniques and area briefs (doc 66 §4.8 Layers 1–2); injectable so tests run on fixtures */
export interface SelfV2Subs {
  runSelfSubTechniques: typeof runSelfSubTechniques;
  buildAreaBriefs: typeof buildAreaBriefs;
}
const REAL_SUBS: SelfV2Subs = { runSelfSubTechniques, buildAreaBriefs };

export interface SelfV2BuildDeps {
  prisma: PrismaClient;
  /** test seam: the Gemini call (every test mocks it; no paid call) */
  callGemini?: (o: GeminiCallOptions) => Promise<GeminiResult>;
  /** test seam: the explicit-cache helper */
  ensureCache?: typeof ensurePromptCache;
  /** test seam: the 45-minute recycler hook */
  informUsed?: typeof informIndividualCacheUsed;
  now?: () => Date;
  /** run every agent even when a stored output covers today */
  force?: boolean;
  /** the sub-techniques' own loaders (digest, activation, systems present, transit); default: the stored rows */
  sub?: Omit<SelfV2Deps, 'prisma'>;
  /** test seam: each step's name, in order */
  onStep?: (step: string) => void;
  /** test seam: this build run's spend cap (default READING_SPEND_CAP_USD, which cannot go below 0.05) */
  maxSpendUsd?: number;
  /** overrides SELF_V2_RETIRED (with the per-card reading on): the build without the v2 Oracle and Personalizer */
  retired?: boolean;
}

export interface SelfV2BuildArgs {
  userId: string;
  kundliId: string;
  asOf: string;
  /**
   * A fresh reading the person asked for (docs/billing/03): its day goes into the Oracle key (and so the cards key), so the
   * new reading is stored as a new row and served as the newest; absent, keys are unchanged.
   */
  refreshDay?: string;
  /**
   * A second fresh reading the same day after the first one failed (its question was given back): a short tag added to
   * the fresh key (`|fresh=<day>.<tag>`), so the retry is a new row with a new `created_at`. Ignored without `refreshDay`.
   */
  refreshRetry?: string;
  /** the sub-techniques and area briefs (doc 66 §4.8 Layers 1–2); default: src/reading/self/sub and areas */
  subs?: SelfV2Subs;
}

export interface SelfV2BuildResult {
  status: 'ok' | 'preparing' | 'failed' | 'partial' | 'budget_exceeded';
  oracle: SelfV2OracleResult | null;
  cards: SelfV2CardsResult | null;
  briefs: AreaBrief[];
  warmed: WarmedRegion[];
  agents: SelfV2AgentTiming[];
  slices: Array<{ agent: string; prefixTokens: number; suffixTokens: number }>;
  ms: Record<string, number>;
  gaps: string[];
  stored: { oracle: boolean; cards: boolean };
  keys: { oracle: string | null; cards: string | null };
  /** step 2's stores: keyed and written now, already stored under the same key (nothing written), without a key, failed */
  layers: { stored: string[]; cached: string[]; unkeyed: string[]; failed: string[] };
  /** this build's id: the `build_id` of its `reading_validation_failures` rows */
  buildId: string;
  /** the Oracle's areas ok, repaired by the one repair pass, or failed (null before the Oracle step) */
  quality: SelfV2Quality | null;
  /** the v3 step (doc 68 Phase B), when SELF_V3_BUILD=1 and this build served the page */
  v3?: Pick<SelfV3StepResult, 'status' | 'cached' | 'stored' | 'key' | 'ms'> & { cards: number; spans: number; issues: number };
}

const since = (t0: number) => Math.round((performance.now() - t0) * 100) / 100;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The Oracle's store key: the digest version, the clock and every boundary stamp, the input and the prompt. */
export function oracleStoreKey(ctx: SelfBuildContext, oracleSlice: PreparedAgentSlice, inputHash: string, refreshDay?: string, refreshRetry?: string): string {
  const s = ctx.stamps;
  const key = [
    'self.v2.oracle',
    s.digestVersion,
    `clock=${s.clock}`,
    `main=${s.mainPeriod ?? '-'}`,
    `sub=${s.subPeriod ?? '-'}`,
    `subsub=${s.subSubPeriod ?? '-'}`,
    `sky=${s.skyWeek ?? '-'}`,
    `year=${s.year ?? '-'}`,
    `confirm=${s.confirmHash ?? '-'}`,
    `in=${inputHash}`,
    `pre=${oracleSlice.prefixHash}`,
    `p=${promptHash(SELF_V2_ORACLE_PROMPT)}`,
  ].join('|');
  if (!refreshDay || !/^\d{4}-\d{2}-\d{2}$/.test(refreshDay)) return key;
  return refreshRetry && /^[a-z0-9]{1,16}$/.test(refreshRetry) ? `${key}|fresh=${refreshDay}.${refreshRetry}` : `${key}|fresh=${refreshDay}`;
}

/** The cards' store key: the clock (so a read can ask for one clock), the Oracle key, the profile hash and the prompt. */
export function cardsStoreKey(ctx: SelfBuildContext, oracleKey: string, portraitHash?: string | null): string {
  return [
    'self.v2.cards',
    `clock=${ctx.stamps.clock}`,
    `o=${shortHash(oracleKey)}`,
    `profile=${ctx.sub.profile?.hash ?? ctx.stamps.profileHash ?? '-'}`,
    // the portrait (biography, the past month, mood trend, life now) changes the cards too
    ...(portraitHash ? [`portrait=${portraitHash}`] : []),
    `p=${promptHash(SELF_V2_PERSONALIZER_PROMPT)}`,
  ].join('|');
}

/** the shortest running period: the stored output's window */
function runningPeriodOf(ctx: SelfBuildContext): { from: Date; to: Date } | null {
  const p = ctx.sub.periods;
  const x = p?.runningSubSub ?? p?.runningSub ?? p?.running ?? null;
  return x ? { from: new Date(`${x.from}T00:00:00Z`), to: new Date(`${x.to}T00:00:00Z`) } : null;
}

// the Layer 1 and Layer 2 stores moved unchanged to src/reading/self/layerStore.ts (plan "retire the v2 Self reading", step 1)
export { ALL_TRIGGERS, layerStoreKey, storeLayerOutputs, SUB_REFRESH, SUB_SLOTS } from '../layerStore.js';

// step 4, the family readers, moved unchanged to src/reading/families/run.ts (plan "retire the v2 Self reading", step 1)

/** Runs one Self v2 build to the end (doc 66 §4.8). Never throws. */
/**
 * The dashboard build under a recording cache lease (doc 86, Sachin 2026-11-18): every explicit cache its own calls use
 * for this kundli (the five family prefixes, the Oracle and Personalizer prefixes, the clock prefix, the card pack; all
 * built from this person's data) is deleted when the build ends, unless another operation on the kundli still holds a
 * lease (a card chat, a second build). Failed deletes go to the sweeper.
 */
export async function runSelfV2Build(deps: SelfV2BuildDeps, args: SelfV2BuildArgs): Promise<SelfV2BuildResult> {
  return withCacheLease({ userId: args.userId, kundliId: args.kundliId }, 'build.v2', () => runSelfV2BuildUnleased(deps, args));
}

async function runSelfV2BuildUnleased(deps: SelfV2BuildDeps, args: SelfV2BuildArgs): Promise<SelfV2BuildResult> {
  const tAll = performance.now();
  const now = (deps.now ?? (() => new Date()))();
  // each stage a person sees is written to today's marker in order (docs/loading-overlay/05); a failed write never stops
  // the build, and the last stage write lands before the build's own ready/failed write
  const startedAt = now.toISOString();
  let stageWrites: Promise<void> = Promise.resolve();
  const step = (s: string) => {
    deps.onStep?.(s);
    const stage = stageOfStep(s);
    if (!stage) return;
    const at = new Date().toISOString();
    stageWrites = stageWrites.then(() => writeSelfV2Marker(deps.prisma, args.userId, args.kundliId, now, 'building', undefined, { started_at: startedAt, stage, stage_at: at })).catch(() => undefined);
  };
  const ms: Record<string, number> = {};
  const gaps: string[] = [];
  const agents: SelfV2AgentTiming[] = [];
  const out: SelfV2BuildResult = {
    status: 'failed',
    oracle: null,
    cards: null,
    briefs: [],
    warmed: [],
    agents,
    slices: [],
    ms,
    gaps,
    stored: { oracle: false, cards: false },
    keys: { oracle: null, cards: null },
    layers: { stored: [], cached: [], unkeyed: [], failed: [] },
    buildId: randomUUID(),
    quality: null,
  };
  const call = deps.callGemini ?? realCallGemini;
  const d = { ...deps, callGemini: call };
  // one build run is one operation with one budget (docs/billing/README.md "Spend cap per operation"): the family
  // readers, the Oracle, the Personalizer and the v3 step (clock layer and cards) share READING_SPEND_CAP_USD
  // docs/techniques/09 §3.5: a board build spends up to READING_BOARD_SPEND_CAP_USD (chat answers keep READING_SPEND_CAP_USD)
  const maxSpendUsd = deps.maxSpendUsd ?? getReadingBoardSpendCapUsd();
  // plan "retire the v2 Self reading" step 3: SELF_V2_RETIRED=1 with the per-card reading on
  const retired = deps.retired ?? isSelfV2Retired();
  try {
    // 0–1: sub-techniques
    step('subs');
    let t = performance.now();
    const subs = args.subs ?? REAL_SUBS;
    const sub = await subs.runSelfSubTechniques({ ...(deps.sub ?? {}), prisma: deps.prisma }, { userId: args.userId, kundliId: args.kundliId, asOf: args.asOf });
    ms.subs = since(t);
    if ('status' in sub) {
      out.status = 'preparing';
      return out;
    }
    gaps.push(...sub.gaps);
    for (const [k, v] of Object.entries(sub.ms)) ms[`sub.${k}`] = v;
    const ctx = sub.ctx;

    // 2: area briefs
    step('briefs');
    t = performance.now();
    const briefs = subs.buildAreaBriefs(ctx);
    out.briefs = briefs;
    ms.briefs = since(t);

    // 3: slices, then the warm-up of every prefix that exists before any agent runs
    step('slices');
    t = performance.now();
    const fam = buildFamilySlices(ctx, sub.loaded);
    // the natal context (slices/natalPrefix.ts): byte for byte the v2 Oracle slice, so no card key moves
    const natal = buildNatalContext(ctx, fam.packs, briefs);
    const first = { slice: natal.slice, input: natal.input };
    ms.slices = since(t);
    step('warm');
    t = performance.now();
    // step 2's stores (self.sub.* and self.v2.<area>) run beside the warm-up; neither waits on the other. With the v2
    // reading retired the v2 Oracle's system prompt is not warmed (its cache would never be read): the clock layer warms
    // the natal prefix the cards read under their own system prompt
    const [warmed, storedLayers] = await Promise.all([
      warmPrefixes([...FAMILY_IDS.map((id) => fam.slices[id]), ...(retired ? [] : [first.slice])], { ensureCache: deps.ensureCache }),
      storeLayerOutputs(deps.prisma, ctx, briefs, now, runningPeriodOf(ctx)),
    ]);
    out.warmed.push(...warmed);
    ms.warm = since(t);
    if (storedLayers.failed.length) gaps.push(`layer outputs not stored: ${storedLayers.failed.join(', ')}`);
    if (storedLayers.unkeyed.length) gaps.push(`layer outputs with no store key (catalogue freshness is per question): ${storedLayers.unkeyed.join(', ')}`);
    out.layers = storedLayers;

    if (retired) {
      // plan "retire the v2 Self reading" step 3: natal context → family readers → clock layer → lens linemen → card
      // Oracle → card Personalizer. No v2 Oracle, no v2 Personalizer, no `self.v2.*` row; the portrait without the Oracle
      const tp = performance.now();
      const portraitSrcP: Promise<PortraitSources> = loadPortraitSources(deps.prisma, ctx.userId, ctx.kundliId, ctx.asOf)
        .catch((e: Error): PortraitSources => ({ facts: null, lifeEvents: null, areaChecks: null, chatCategories: null, birth: null, currentLocation: null, gaps: [`portrait sources: ${e.message?.slice(0, 80)}`] }))
        .finally(() => {
          ms.portraitLoad = since(tp);
        });
      step('families');
      const tf = performance.now();
      // the findings layer: the same readers and cache key as before; their runs are tagged with the card reading
      const fr = await runFamilyReaders(d, ctx, fam, { technique: CARD_READING_TECHNIQUE });
      ms.families = since(tf);
      agents.push(...fr.timings);
      gaps.push(...fr.gaps);
      out.slices = sliceTable(FAMILY_IDS.map((id) => fam.slices[id]));
      const familySpend = round6(fr.timings.reduce((n, x) => n + x.costUsd, 0));
      if (familySpend >= maxSpendUsd) {
        out.status = 'budget_exceeded';
        gaps.push(`family readers spent ${familySpend} over the cap ${maxSpendUsd}; no card read`);
        await stageWrites;
        await writeSelfV2Marker(deps.prisma, ctx.userId, ctx.kundliId, now, 'failed', 'families budget_exceeded');
        return out;
      }
      const portrait = buildPersonPortrait(ctx, null, await portraitSrcP);
      for (const g of portrait.gaps) gaps.push(`portrait: ${g}`);
      // the card step's progress on the stage names the page knows: the clock and lens layers as `oracle`, the cards as
      // `personalizer` (the web's BUILD_STAGE_WORDS is a record over exactly these names)
      const v3 = await runSelfV3Cards(
        {
          prisma: deps.prisma,
          callGemini: call,
          ensureCache: deps.ensureCache,
          informUsed: deps.informUsed,
          now,
          force: deps.force,
          maxSpendUsd: Math.max(0, round6(maxSpendUsd - familySpend)),
          onStage: (s) => step(s === 'clocks' ? 'oracle' : 'personalizer'),
        },
        { ctx, pressure: sub.loaded.pressure ?? null, natal, portrait, buildId: out.buildId, findings: fr.findings, activation: sub.loaded.activation ?? [] },
      ).catch((e: Error): SelfV3StepResult => ({ status: 'failed', cards: {}, frame: null, agents: [], issues: [], gaps: [`v3: ${String(e?.message ?? e).slice(0, 300)}`], cached: false, stored: false, key: null, ms: {} }));
      agents.push(...v3.agents);
      gaps.push(...v3.gaps);
      ms.v3 = v3.ms.total ?? 0;
      out.v3 = { status: v3.status, cached: v3.cached, stored: v3.stored, key: v3.key, ms: v3.ms, cards: Object.keys(v3.cards).length, spans: v3.frame?.spans.length ?? 0, issues: v3.issues.length };
      out.status = retiredStatus(v3, Boolean(args.refreshDay));
      const readNow = (v3.cardsRun?.results ?? []).some((r) => r.status === 'ok');
      await stageWrites;
      // `ready` for a board served or still being prepared (fewer than CARDS_READ_MIN cards, no ledger yet): never
      // `failed`, which would hold the next build back 30 minutes. `read_at`: a card was read now (the board's builtAt)
      const doneAt = new Date().toISOString();
      const ready = out.status === 'ok' || out.status === 'preparing';
      await writeSelfV2Marker(deps.prisma, ctx.userId, ctx.kundliId, now, ready ? 'ready' : 'failed', ready ? undefined : `cards ${v3.status}`, { started_at: startedAt, stage: 'personalizer', stage_at: doneAt, ...(readNow ? { read_at: doneAt } : {}) });
      return out;
    }

    const inputHash = shortHash(canonicalJson({ ...first.input, familyFindings: [] }));
    const oracleKey = oracleStoreKey(ctx, first.slice, inputHash, args.refreshDay, args.refreshRetry);
    out.keys.oracle = oracleKey;
    const runningPeriod = runningPeriodOf(ctx);

    // the portrait's sources (Sachin 2026-11-09) are read beside the Oracle step; the Personalizer waits for them
    const tp = performance.now();
    const portraitSrcP: Promise<PortraitSources> = loadPortraitSources(deps.prisma, ctx.userId, ctx.kundliId, ctx.asOf)
      .catch((e: Error): PortraitSources => ({ facts: null, lifeEvents: null, areaChecks: null, chatCategories: null, birth: null, currentLocation: null, gaps: [`portrait sources: ${e.message?.slice(0, 80)}`] }))
      .finally(() => {
        ms.portraitLoad = since(tp);
      });

    // 4–6: family readers, the Oracle ×3 and its validator, through the store (a hit runs nothing)
    let oracleSlice = first.slice;
    let familyFindings: Array<{ family: string; text: string }> = [];
    t = performance.now();
    const storedOracle = await withTechniqueOutput<StoredSelfV2Oracle>(
      deps.prisma,
      {
        technique: SELF_V2_ORACLE_TECHNIQUE,
        kundliId: ctx.kundliId,
        digestVersion: oracleKey,
        context: { now, runningPeriod },
        agentId: 'self.oracle.v2',
        userId: ctx.userId,
        charts: [{ type: 'kundli_digest', variant: ctx.stamps.digestVersion }],
        forceRefresh: Boolean(deps.force),
      },
      async () => {
        step('families');
        const tf = performance.now();
        const fr = await runFamilyReaders(d, ctx, fam);
        ms.families = since(tf);
        agents.push(...fr.timings);
        gaps.push(...fr.gaps);
        familyFindings = fr.findings;
        const familySpend = round6(fr.timings.reduce((n, x) => n + x.costUsd, 0));
        const built = buildOracleSlice(ctx, fam.packs, briefs, familyFindings);
        oracleSlice = built.slice;
        if (familySpend >= maxSpendUsd) {
          const result: SelfV2OracleResult = {
            status: 'budget_exceeded',
            output: null,
            gaps: [`family readers spent ${familySpend} over the cap ${maxSpendUsd}`],
            withheld: [],
            promptName: SELF_V2_ORACLE_PROMPT,
            promptHash: promptHash(SELF_V2_ORACLE_PROMPT),
            model: oracleSlice.model,
            calls: [],
            familyFindings,
            spentUsd: familySpend,
            cached: false,
          };
          return { value: { key: oracleKey, result, briefs }, skipStore: true, summary: { status: 'budget_exceeded' } };
        }
        step('oracle');
        const to = performance.now();
        const r = await runOracleV2({ prisma: deps.prisma, callGemini: call, informUsed: deps.informUsed, spentUsd: familySpend, maxSpendUsd }, ctx, oracleSlice, briefs);
        ms.oracle = since(to);
        const repairCall = r.calls.find((c) => c.call === 'oracle.repair');
        if (repairCall) ms.oracleRepair = repairCall.ms;
        agents.push(...r.calls);
        const result: SelfV2OracleResult = { ...r, familyFindings, cached: false };
        step('oracle.validated');
        // every finding is stored and logged, whatever the outcome (Sachin 2026-11-09)
        const meta: RecordMeta = { userId: ctx.userId, kundliId: ctx.kundliId, board: 'self', buildId: out.buildId, model: r.model, promptHash: r.promptHash };
        logValidation(meta, 'oracle', r.issues ?? [], qualityOf(r.areaStatus));
        await recordValidationIssues(deps.prisma, meta, r.issues ?? []);
        return {
          value: { key: oracleKey, result, briefs },
          // an ok document is stored; a partial one only when its good areas can serve the page
          skipStore: !oracleServes(r),
          summary: { status: r.status, areas: r.output ? Object.keys(r.output.doc.areas).length : 0, withheld: r.withheld.length, patterns: r.output?.patterns.length ?? 0 },
        };
      },
    );
    ms.oracleStep = since(t);
    const oracle: SelfV2OracleResult = storedOracle.cached ? { ...storedOracle.value.result, cached: true } : storedOracle.value.result;
    out.oracle = oracle;
    out.stored.oracle = !storedOracle.cached && oracleServes(oracle);
    if (storedOracle.cached) step('oracle.cached');
    gaps.push(...oracle.gaps);
    out.quality = oracleQuality(oracle);
    if (!oracle.output || !oracleServes(oracle)) {
      out.status = oracle.status === 'budget_exceeded' ? 'budget_exceeded' : oracle.status === 'partial' ? 'partial' : 'failed';
      out.slices = sliceTable([...FAMILY_IDS.map((id) => fam.slices[id]), oracleSlice]);
      await stageWrites;
      await writeSelfV2Marker(deps.prisma, ctx.userId, ctx.kundliId, now, 'failed', `oracle ${oracle.status}`);
      return out;
    }

    // 7–8: the Personalizer over the Oracle document; its prefix warmed first
    // the hero rests on the `now` brief (its S3/S5 rows and dates); no Oracle call writes it (run 1 failure 14)
    const portrait = buildPersonPortrait(ctx, oracle.output, await portraitSrcP);
    for (const g of portrait.gaps) gaps.push(`portrait: ${g}`);
    const p = buildPersonalizerSlice(ctx, oracle.output, briefs, portrait);
    out.slices = sliceTable([...FAMILY_IDS.map((id) => fam.slices[id]), oracleSlice, p.slice]);
    const cardsKey = cardsStoreKey(ctx, oracleKey, shortHash(canonicalJson(portrait)));
    out.keys.cards = cardsKey;
    // the v2 Personalizer and the v3 step run side by side (2026-11-19: the v3 step needs the portrait and the Oracle
    // slice, not the Personalizer's cards; one after the other cost a first open about 48 s). One operation, one budget
    // (docs/billing/README.md "Spend cap per operation"): both start from the spend before the fork; while the
    // Personalizer is in flight it holds its upper-bound cost, and the v3 step may spend only what the cap leaves after
    // that hold (its `maxSpendUsd` is read live), so the two together never pass READING_SPEND_CAP_USD
    const spentBefore = round6(agents.reduce((n, x) => n + x.costUsd, 0));
    const v3On = isSelfV3BuildEnabled();
    let personalizerHold = v3On && spentBefore < maxSpendUsd ? personalizerHoldUsd(p.slice) : 0;
    let personalizerSpent = 0;
    const tc = performance.now();
    const v2Cards = withTechniqueOutput<StoredSelfV2Cards>(
      deps.prisma,
      {
        technique: SELF_V2_PERSONALIZER_TECHNIQUE,
        kundliId: ctx.kundliId,
        digestVersion: cardsKey,
        context: { now, runningPeriod },
        agentId: 'self.personalizer',
        userId: ctx.userId,
        charts: [{ type: 'technique_output', variant: SELF_V2_ORACLE_TECHNIQUE }],
        forceRefresh: Boolean(deps.force),
      },
      async () => {
        step('warm.personalizer');
        out.warmed.push(...(await warmPrefixes([p.slice], { ensureCache: deps.ensureCache })));
        step('personalizer');
        const r = await runPersonalizer({ prisma: deps.prisma, callGemini: call, informUsed: deps.informUsed, spentUsd: spentBefore, maxSpendUsd }, ctx, p.slice, p.input, ctx.sub.windows?.strip ?? []);
        // the hold becomes what the call cost: the v3 step's later checks see the rest of the cap
        personalizerSpent = r.call?.costUsd ?? 0;
        personalizerHold = personalizerSpent;
        if (r.call) agents.push(r.call);
        step('personalizer.validated');
        if (r.metrics) logPersonalizerMetrics(ctx, r.metrics);
        // the Personalizer's drops are stored too (no repair pass for them)
        const issues = issuesFromGaps('personalizer', r.gaps, 'self.personalizer');
        const meta: RecordMeta = { userId: ctx.userId, kundliId: ctx.kundliId, board: 'self', buildId: out.buildId, model: r.model, promptHash: r.promptHash };
        logValidation(meta, 'personalizer', issues);
        await recordValidationIssues(deps.prisma, meta, issues);
        const quality = out.quality ?? oracleQuality(oracle);
        const result: SelfV2CardsResult = { ...r, cached: false, issues, quality };
        // the Oracle's failed areas show the last good reading's card, marked stale; with none stored they are withheld
        if (r.doc && quality.failed.length) {
          const stale = await readLastGoodAreas(deps.prisma, ctx.kundliId, ctx.stamps.clock, quality.failed);
          if (Object.keys(stale).length) {
            result.stale = stale;
            result.cardStatus = { ...result.cardStatus };
            for (const id of Object.keys(stale) as Array<keyof typeof stale>) result.cardStatus[id] = 'stale';
          }
          const none = quality.failed.filter((id) => !stale[id]);
          if (none.length) result.gaps = [...result.gaps, `oracle failed areas with no earlier reading (withheld): ${none.join(', ')}`];
        }
        const served = r.status === 'ok' && servesPage(quality);
        if (r.status === 'ok' && !served) {
          const n = quality.okAreas.length + quality.repaired.length;
          result.gaps = [...result.gaps, `build does not serve the page (${n} of 11 areas ok or repaired, ${SERVE_MIN_AREAS} needed): not stored, the question is given back`];
        }
        if (served && !r.doc?.hero.sentence) result.gaps = [...result.gaps, 'hero withheld (no sentence stood): the cards are served without it'];
        const frame: SelfV2Frame = { asOf: ctx.asOf, stamps: ctx.stamps, periods: ctx.sub.periods ?? null, year: ctx.sub.year ?? null };
        return {
          value: { key: cardsKey, oracleKey, result, frame },
          skipStore: !served,
          summary: { status: r.status, cards: r.doc ? Object.keys(r.doc.cards).length : 0, withheld: Object.values(r.cardStatus).filter((s) => s === 'withheld').length },
        };
      },
    ).finally(() => {
      // a stored hit, a throw or a call that never started holds nothing past this point
      personalizerHold = personalizerSpent;
      ms.personalizerStep = since(tc);
    });
    // the v3 cards (doc 68 Phase B / doc 70 per-card) over the same context and prefix. They run whenever the Oracle
    // served, whatever the v2 Personalizer did (doc 83 step 1, 2026-11-18: the you board shows v3 cards; one v2 failure
    // must not leave it blank). A v3 failure never fails the build.
    let v3Cards: Promise<SelfV3StepResult | null> = Promise.resolve(null);
    if (v3On) {
      step('v3');
      const v3Deps: Parameters<typeof runSelfV3Cards>[0] = {
        prisma: deps.prisma,
        callGemini: call,
        ensureCache: deps.ensureCache,
        informUsed: deps.informUsed,
        now,
        force: deps.force,
        // read at each budget check inside the v3 step (clock layer, cards): the cap less the spend before the fork and
        // the Personalizer's hold (its upper bound while in flight, its cost once done)
        get maxSpendUsd() {
          return Math.max(0, round6(maxSpendUsd - spentBefore - personalizerHold));
        },
      };
      v3Cards = runSelfV3Cards(v3Deps, { ctx, pressure: sub.loaded.pressure ?? null, oracleSlice, portrait, buildId: out.buildId, findings: oracle.familyFindings ?? [], activation: sub.loaded.activation ?? [] });
    }
    // both settle before either outcome is used; a v2 throw is re-thrown as before, once the v3 step has ended
    const [v2Settled, v3Settled] = await Promise.allSettled([v2Cards, v3Cards]);
    if (v2Settled.status === 'rejected') throw v2Settled.reason;
    const storedCards = v2Settled.value;
    const cards: SelfV2CardsResult = storedCards.cached ? { ...storedCards.value.result, cached: true } : storedCards.value.result;
    out.cards = cards;
    const served = cards.status === 'ok' && servesPage(cards.quality ?? out.quality ?? { okAreas: [], repaired: [], failed: [] });
    out.stored.cards = !storedCards.cached && served;
    gaps.push(...cards.gaps);
    out.status = served ? 'ok' : cards.status === 'budget_exceeded' ? 'budget_exceeded' : cards.status === 'ok' ? 'partial' : 'failed';
    if (v3Settled.status === 'rejected') gaps.push(`v3: ${String((v3Settled.reason as Error)?.message ?? v3Settled.reason).slice(0, 300)}`);
    const v3 = v3Settled.status === 'fulfilled' ? v3Settled.value : null;
    if (v3) {
      agents.push(...v3.agents);
      gaps.push(...v3.gaps);
      ms.v3 = v3.ms.total ?? 0;
      out.v3 = { status: v3.status, cached: v3.cached, stored: v3.stored, key: v3.key, ms: v3.ms, cards: Object.keys(v3.cards).length, spans: v3.frame?.spans.length ?? 0, issues: v3.issues.length };
      // the board is served by its v3 cards: a build that read them is made, even when the v2 cards did not serve
      if (!served && Object.keys(v3.cards).length && (v3.status === 'ok' || v3.status === 'partial')) {
        out.status = 'ok';
        gaps.push(`v2 cards did not serve (${cards.status}); the board is served by ${Object.keys(v3.cards).length} v3 cards`);
      }
    }
    await stageWrites;
    await writeSelfV2Marker(deps.prisma, ctx.userId, ctx.kundliId, now, out.status === 'ok' ? 'ready' : 'failed', out.status === 'ok' ? undefined : out.status === 'partial' ? 'build does not serve the page' : `personalizer ${cards.status}`);
    return out;
  } catch (e) {
    gaps.push(`build: ${String((e as Error).message ?? e).slice(0, 300)}`);
    out.status = 'failed';
    await stageWrites;
    await writeSelfV2Marker(deps.prisma, args.userId, args.kundliId, now, 'failed', String((e as Error).message ?? e).slice(0, 300));
    return out;
  } finally {
    ms.total = since(tAll);
  }
}

/**
 * The status of a build with the v2 reading retired (plan "retire the v2 Self reading" step 3), from its card step:
 *
 *   ok               the board is served by its cards: at least one card stored or served; on a fresh reading the person
 *                    asked for (`refresh`), at least one card read by this run (its question is committed)
 *   preparing        nothing read and nothing wrong: the board holds fewer than CARDS_READ_MIN cards and none was asked
 *                    for, no agreed ledger yet, no year frame, or the clock or profile missing (`skipped`). Never failed:
 *                    a failed marker would hold the next build back 30 minutes and give a question back for nothing
 *   budget_exceeded  the spend cap stopped every card (they are queued for the next round, never read shorter)
 *   failed           the card step failed (or, on a fresh reading, read no card: its question is given back)
 */
export function retiredStatus(v3: Pick<SelfV3StepResult, 'status' | 'cards' | 'cardsRun'>, refresh: boolean): SelfV2BuildResult['status'] {
  const readNow = (v3.cardsRun?.results ?? []).some((r) => r.status === 'ok');
  const served = Object.keys(v3.cards).length > 0 && (v3.status === 'ok' || v3.status === 'partial');
  if (refresh) return readNow ? 'ok' : v3.status === 'budget_exceeded' ? 'budget_exceeded' : 'failed';
  if (served) return 'ok';
  if (v3.status === 'skipped') return 'preparing';
  return v3.status === 'budget_exceeded' ? 'budget_exceeded' : 'failed';
}

/**
 * The Oracle's quality: its per-area status after the repair pass; a result stored before 2026-11-09 (no `areaStatus`)
 * counts every area it holds as ok.
 */
export function oracleQuality(r: Pick<SelfV2OracleResult, 'areaStatus' | 'output'>): SelfV2Quality {
  if (r.areaStatus) return qualityOf(r.areaStatus);
  return { okAreas: Object.keys(r.output?.doc.areas ?? {}) as SelfV2Quality['okAreas'], repaired: [], failed: [] };
}

/** An Oracle result whose good areas can serve the page: ok, or partial with at least SERVE_MIN_AREAS ok or repaired. */
export function oracleServes(r: Pick<SelfV2OracleResult, 'status' | 'areaStatus' | 'output'>): boolean {
  if (!r.output) return false;
  if (r.status === 'ok') return true;
  if (r.status !== 'partial') return false;
  const q = oracleQuality(r);
  return q.okAreas.length + q.repaired.length >= SERVE_MIN_AREAS;
}

/**
 * The most the v2 Personalizer can cost: its hold on the build's budget while it runs beside the v3 step. Every prompt
 * token of the first call and its one retry uncached, plus both calls' output caps (thinking counts against the cap).
 */
export function personalizerHoldUsd(slice: Pick<PreparedAgentSlice, 'model' | 'estTokens'>): number {
  const prompt = slice.estTokens.prefix + slice.estTokens.suffix;
  const outputTokens = getSelfPersonalizerMaxOutputTokens() + getSelfPersonalizerRetryMaxOutputTokens();
  return round6(usageCostUsd({ model: slice.model, promptTokens: 2 * prompt, cachedTokens: 0, outputTokens, thoughtTokens: 0 }));
}

/** The per-build Oracle-echo metric (doc 66 replay run 2, failure 1): one log line, never a reject. */
function logPersonalizerMetrics(ctx: SelfBuildContext, m: NonNullable<SelfV2CardsResult['metrics']>): void {
  console.log(JSON.stringify({ msg: 'self.v2 personalizer metrics', kundliId: ctx.kundliId, profile: ctx.sub.profile?.hash ?? null, echoMean: m.echoMean, echoMax: m.echoMax, echoMaxArea: m.echoMaxArea, flagged: m.flagged }));
}

function sliceTable(slices: readonly PreparedAgentSlice[]): SelfV2BuildResult['slices'] {
  return slices.map((s) => ({ agent: s.agent, prefixTokens: s.estTokens.prefix, suffixTokens: s.estTokens.suffix }));
}
