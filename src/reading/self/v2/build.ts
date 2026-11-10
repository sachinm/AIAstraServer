/**
 * The Self v2 build (docs/reading-engine/66 §4.8 "Order of a build", steps 0–8):
 *
 *   0–1  sub-techniques over one build context (the sub-techniques lane; injected as `subs`)
 *   2    area briefs
 *   3    every agent's slice from the context (no DB); the family and Oracle prefixes warmed in parallel
 *   4    family readers ×5, in parallel, read through `reading_findings_cache`
 *   5    Oracle: three parallel calls over the warm prefix
 *   6    validator (doc 65) → `technique_outputs` `self.v2.oracle` (only an ok result)
 *   7    Personalizer over the Oracle document + the profile pack (its prefix warmed first: it is the Oracle document,
 *        which exists only after step 6 on a cold build)
 *   8    validator (§4.1) → `technique_outputs` `self.v2.personalizer` (`self.v2.cards|…` key: hero and cards)
 *
 * Returns timings and tokens per agent. A stored Oracle that still covers today skips steps 4–6 (no model call); a
 * stored card document for the same Oracle key and profile hash skips step 7. Charging stays with the existing build
 * event (one per board per day). Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../../agents/registry.js';
import { getSelfFamilyMaxOutputTokens, getSelfReadingMaxSpendUsd } from '../../../config/env.js';
import { withTechniqueOutput } from '../../../techniques/outputStore.js';
import { canonicalJson } from '../../../techniques/pieces.js';
import { informIndividualCacheUsed } from '../../llm/cacheSweep.js';
import { callGemini as realCallGemini, type GeminiCallOptions, type GeminiResult } from '../../llm/gemini.js';
import type { ensurePromptCache } from '../../llm/promptCache.js';
import { loadDbReaderCache, saveDbReaderCache, type HeldReader } from '../../oracle/prewarm.js';
import { PROMPT_VERSION } from '../../prompts/generated.js';
import { redactEngineTerms } from '../oracle.js';
import { completeSentencesOf, CUT_FINDING_NOTE } from '../words.js';
import { SELF_V2_REFRESH } from '../v2types.js';
import type {
  AreaBrief,
  PreparedAgentSlice,
  RefreshTrigger,
  SelfBuildContext,
  SelfV2AgentTiming,
  SelfV2CardsResult,
  SelfV2FamilyAgentId,
  SelfV2Frame,
  SelfV2OracleResult,
  WarmedRegion,
} from '../v2types.js';
import { markAgentUsed, warmPrefixes } from './cache.js';
import { runOracleV2, timingOf } from './oracle.js';
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
  type FamilySlices,
} from './slices.js';
import { SELF_V2_ORACLE_TECHNIQUE, SELF_V2_PERSONALIZER_TECHNIQUE, writeSelfV2Marker, type StoredSelfV2Cards, type StoredSelfV2Oracle } from './store.js';
import { buildAreaBriefs } from '../areas/index.js';
import { runSelfSubTechniques, subTechniqueId, type SelfV2Deps } from '../sub/index.js';

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
}

export interface SelfV2BuildArgs {
  userId: string;
  kundliId: string;
  asOf: string;
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
}

const since = (t0: number) => Math.round((performance.now() - t0) * 100) / 100;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The Oracle's store key: the digest version, the clock and every boundary stamp, the input and the prompt. */
export function oracleStoreKey(ctx: SelfBuildContext, oracleSlice: PreparedAgentSlice, inputHash: string): string {
  const s = ctx.stamps;
  return [
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

/** the sub-technique slots of the build context and their catalogue ids (self.sub.mind_facts …) */
const SUB_SLOTS: ReadonlyArray<[keyof SelfBuildContext['sub'], string]> = [
  ['clock', 'clock'],
  ['periods', 'periods'],
  ['windows', 'windows'],
  ['promise', 'promise'],
  ['risk', 'risk'],
  ['mind', 'mindFacts'],
  ['body', 'bodyFacts'],
  ['presence', 'presenceFacts'],
  ['year', 'year'],
  ['profile', 'profile'],
];

/**
 * What can make each sub-technique's output stale (doc 66 §4.8 Layer 1); the digest version and the clock are in every
 * key. The areas use SELF_V2_REFRESH.
 */
export const SUB_REFRESH: Readonly<Record<string, readonly RefreshTrigger[]>> = {
  clock: ['digest'],
  periods: ['main_period', 'sub_period', 'sub_sub_period'],
  windows: ['sub_sub_period', 'sky_week'],
  promise: ['digest'],
  risk: ['sub_sub_period', 'sky_week'],
  mindFacts: ['digest'],
  bodyFacts: ['sub_sub_period', 'sky_week'],
  presenceFacts: ['main_period', 'sub_period'],
  year: ['year'],
  profile: ['profile', 'confirm'],
};

const ALL_TRIGGERS: readonly RefreshTrigger[] = ['main_period', 'sub_period', 'sub_sub_period', 'sky_week', 'year', 'profile', 'confirm'];

/**
 * The key of a Layer 1 or Layer 2 output: its id, the digest version, the clock and the stamps of the triggers that can
 * change it (default: every stamp). Unchanged stamps give the same key, so a rebuild writes nothing.
 */
export function layerStoreKey(id: string, ctx: SelfBuildContext, triggers: readonly RefreshTrigger[] = ALL_TRIGGERS): string {
  const s = ctx.stamps;
  const t = new Set(triggers);
  const parts = [id, s.digestVersion, `clock=${s.clock}`];
  if (t.has('main_period')) parts.push(`main=${s.mainPeriod ?? '-'}`);
  if (t.has('sub_period')) parts.push(`sub=${s.subPeriod ?? '-'}`);
  if (t.has('sub_sub_period')) parts.push(`subsub=${s.subSubPeriod ?? '-'}`);
  if (t.has('sky_week')) parts.push(`sky=${s.skyWeek ?? '-'}`);
  if (t.has('year')) parts.push(`year=${s.year ?? '-'}`);
  if (t.has('profile')) parts.push(`profile=${s.profileHash ?? '-'}`);
  if (t.has('confirm')) parts.push(`confirm=${s.confirmHash ?? '-'}`);
  return parts.join('|');
}

/**
 * Step 2's stores (doc 66 §4.8; AGENTS.md machinery rule 1): each sub-technique output under `self.sub.<name>` and each
 * area brief under `self.v2.<area>`, keyed by the stamps. An unchanged key is a hit and writes nothing. Never throws.
 */
export async function storeLayerOutputs(
  prisma: PrismaClient,
  ctx: SelfBuildContext,
  briefs: readonly AreaBrief[],
  now: Date,
  runningPeriod: { from: Date; to: Date } | null,
): Promise<{ stored: string[]; cached: string[]; unkeyed: string[]; failed: string[] }> {
  const items: Array<{ id: string; agent: string; value: unknown; triggers: readonly RefreshTrigger[] }> = [
    ...SUB_SLOTS.filter(([slot]) => ctx.sub[slot] !== undefined).map(([slot, name]) => ({ id: subTechniqueId(name), agent: 'self.sub', value: ctx.sub[slot], triggers: SUB_REFRESH[name] ?? ALL_TRIGGERS })),
    ...briefs.map((b) => ({ id: `self.v2.${b.areaId}`, agent: 'self.reading_panel', value: b, triggers: SELF_V2_REFRESH[b.areaId] ?? ALL_TRIGGERS })),
  ];
  const stored: string[] = [];
  const cached: string[] = [];
  const unkeyed: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    items.map(async (it) => {
      try {
        const res = await withTechniqueOutput(
          prisma,
          { technique: it.id, kundliId: ctx.kundliId, digestVersion: layerStoreKey(it.id, ctx, it.triggers), context: { now, runningPeriod }, agentId: it.agent, userId: ctx.userId, logCachedRun: false },
          async () => it.value,
        );
        // a technique whose freshness is per question (a `findings` input with no synthesizer upstream) gets no key
        (!res.cacheKey ? unkeyed : res.cached ? cached : stored).push(it.id);
      } catch {
        failed.push(it.id);
      }
    }),
  );
  return { stored, cached, unkeyed, failed };
}

/** Step 4: the five family readers, in parallel, each read through `reading_findings_cache` first. */
async function runFamilyReaders(
  deps: SelfV2BuildDeps & { callGemini: NonNullable<SelfV2BuildDeps['callGemini']> },
  ctx: SelfBuildContext,
  fam: FamilySlices,
): Promise<{ findings: Array<{ family: string; text: string }>; timings: SelfV2AgentTiming[]; gaps: string[] }> {
  const gaps: string[] = [];
  const owner = { userId: ctx.userId, kundliId: ctx.kundliId };
  const outs = await Promise.all(
    FAMILY_IDS.map(async (id: SelfV2FamilyAgentId) => {
      const slice = fam.slices[id];
      const pack = fam.packs[id];
      const cacheKey = `self:${ctx.kundliId}:${id}:${pack.packHash}:${PROMPT_VERSION}`;
      const t0 = performance.now();
      const held = !deps.force ? await loadDbReaderCache(deps.prisma, cacheKey, owner).catch(() => undefined) : undefined;
      const cachedText = (held?.finding as unknown as { rawText?: string } | undefined)?.rawText;
      if (cachedText) return { family: id, text: cachedText, timing: timingOf(id, id, slice.model, null, since(t0), 'cached') };
      try {
        const res = await withAgentRun(
          deps.prisma,
          id,
          {
            userId: ctx.userId,
            kundliId: ctx.kundliId,
            technique: SELF_V2_ORACLE_TECHNIQUE,
            task: `${id} v2 ${ctx.asOf}`,
            input: { family: id, keys: slice.keys.length, natal: pack.natal ? 1 : 0, prefixTokens: slice.estTokens.prefix },
            charts: pack.charts,
          },
          async () => {
            const g = await deps.callGemini({
              model: slice.model,
              node: id,
              system: slice.system,
              parts: [slice.prefix, slice.suffix],
              thinking: 'medium',
              // doc 66 replay run 2: 2,000 cut family.dasha (654 out + 1,342 thought); env SELF_FAMILY_MAX_OUTPUT_TOKENS
              maxOutputTokens: getSelfFamilyMaxOutputTokens(),
              cachePrefix: true,
              cacheOwner: slice.cacheOwner,
            });
            return {
              value: g,
              usage: { model: slice.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
              output: { chars: g.text.length, cachedTokens: g.usage?.cachedTokens ?? 0, finish: g.finishReason ?? null, thoughtsReported: g.usage?.thoughtTokensReported ?? null },
            };
          },
        );
        markAgentUsed(slice, deps.informUsed);
        // a finding cut at the output cap (MAX_TOKENS) never reaches the Oracle as it is: only its complete sentences,
        // with a note, or nothing; it is never cached (doc 66 replay run 2, failure 7)
        const cut = res.finishReason === 'MAX_TOKENS';
        const kept = cut ? completeSentencesOf(res.text) : res.text;
        if (cut) gaps.push(`${id}: cut at the output cap (MAX_TOKENS); ${kept ? `${kept.length} of ${res.text.length} chars kept, complete sentences only` : 'no complete sentence; not passed to the Oracle'}`);
        const text = kept ? redactEngineTerms(cut ? [kept, CUT_FINDING_NOTE].join('\n') : kept) : '';
        const timing = timingOf(id, id, slice.model, res, since(t0), 'ok');
        if (cut) return { family: id, text, timing };
        const stored: HeldReader = {
          finding: { reader: id, rawText: text } as unknown as HeldReader['finding'],
          usage: { node: id, model: slice.model, promptTokens: timing.promptTokens, cachedTokens: timing.cachedTokens, outputTokens: timing.outputTokens, thoughtTokens: timing.thoughtTokens, ms: timing.ms },
        };
        await saveDbReaderCache(deps.prisma, {
          cacheKey,
          kundliId: ctx.kundliId,
          userId: ctx.userId,
          readerId: id,
          packHash: pack.packHash,
          horizonKey: pack.horizonKey,
          promptVersion: PROMPT_VERSION,
          natal: pack.natal,
          ...(pack.expiresAt ? { expiresAt: pack.expiresAt } : {}),
          held: stored,
          used: true,
        }).catch(() => undefined);
        return { family: id, text, timing };
      } catch (e) {
        return { family: id, text: '', timing: timingOf(id, id, slice.model, null, since(t0), 'failed'), error: String((e as Error).message ?? e).slice(0, 160) };
      }
    }),
  );
  return { findings: outs.filter((o) => o.text).map((o) => ({ family: o.family, text: o.text })), timings: outs.map((o) => o.timing), gaps };
}

/** Runs one Self v2 build to the end (doc 66 §4.8). Never throws. */
export async function runSelfV2Build(deps: SelfV2BuildDeps, args: SelfV2BuildArgs): Promise<SelfV2BuildResult> {
  const tAll = performance.now();
  const now = (deps.now ?? (() => new Date()))();
  const step = (s: string) => deps.onStep?.(s);
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
  };
  const call = deps.callGemini ?? realCallGemini;
  const d = { ...deps, callGemini: call };
  const maxSpendUsd = getSelfReadingMaxSpendUsd();
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
    const first = buildOracleSlice(ctx, fam.packs, briefs);
    ms.slices = since(t);
    step('warm');
    t = performance.now();
    // step 2's stores (self.sub.* and self.v2.<area>) run beside the warm-up; neither waits on the other
    const [warmed, storedLayers] = await Promise.all([
      warmPrefixes([...FAMILY_IDS.map((id) => fam.slices[id]), first.slice], { ensureCache: deps.ensureCache }),
      storeLayerOutputs(deps.prisma, ctx, briefs, now, runningPeriodOf(ctx)),
    ]);
    out.warmed.push(...warmed);
    ms.warm = since(t);
    if (storedLayers.failed.length) gaps.push(`layer outputs not stored: ${storedLayers.failed.join(', ')}`);
    if (storedLayers.unkeyed.length) gaps.push(`layer outputs with no store key (catalogue freshness is per question): ${storedLayers.unkeyed.join(', ')}`);
    out.layers = storedLayers;

    const inputHash = shortHash(canonicalJson({ ...first.input, familyFindings: [] }));
    const oracleKey = oracleStoreKey(ctx, first.slice, inputHash);
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
        if (familySpend > maxSpendUsd) {
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
        agents.push(...r.calls);
        const result: SelfV2OracleResult = { ...r, familyFindings, cached: false };
        step('oracle.validated');
        return {
          value: { key: oracleKey, result, briefs },
          skipStore: r.status !== 'ok',
          summary: { status: r.status, areas: r.output ? Object.keys(r.output.doc.areas).length : 0, withheld: r.withheld.length, patterns: r.output?.patterns.length ?? 0 },
        };
      },
    );
    ms.oracleStep = since(t);
    const oracle: SelfV2OracleResult = storedOracle.cached ? { ...storedOracle.value.result, cached: true } : storedOracle.value.result;
    out.oracle = oracle;
    out.stored.oracle = !storedOracle.cached && oracle.status === 'ok';
    if (storedOracle.cached) step('oracle.cached');
    gaps.push(...oracle.gaps);
    if (oracle.status !== 'ok' || !oracle.output) {
      out.status = oracle.status === 'budget_exceeded' ? 'budget_exceeded' : oracle.status === 'partial' ? 'partial' : 'failed';
      out.slices = sliceTable([...FAMILY_IDS.map((id) => fam.slices[id]), oracleSlice]);
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
    t = performance.now();
    const storedCards = await withTechniqueOutput<StoredSelfV2Cards>(
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
        const spent = round6(agents.reduce((n, x) => n + x.costUsd, 0));
        const r = await runPersonalizer({ prisma: deps.prisma, callGemini: call, informUsed: deps.informUsed, spentUsd: spent, maxSpendUsd }, ctx, p.slice, p.input, ctx.sub.windows?.strip ?? []);
        if (r.call) agents.push(r.call);
        step('personalizer.validated');
        if (r.metrics) logPersonalizerMetrics(ctx, r.metrics);
        const result: SelfV2CardsResult = { ...r, cached: false };
        const frame: SelfV2Frame = { asOf: ctx.asOf, stamps: ctx.stamps, periods: ctx.sub.periods ?? null, year: ctx.sub.year ?? null };
        return {
          value: { key: cardsKey, oracleKey, result, frame },
          skipStore: r.status !== 'ok',
          summary: { status: r.status, cards: r.doc ? Object.keys(r.doc.cards).length : 0, withheld: Object.values(r.cardStatus).filter((s) => s === 'withheld').length },
        };
      },
    );
    ms.personalizerStep = since(t);
    const cards: SelfV2CardsResult = storedCards.cached ? { ...storedCards.value.result, cached: true } : storedCards.value.result;
    out.cards = cards;
    out.stored.cards = !storedCards.cached && cards.status === 'ok';
    gaps.push(...cards.gaps);
    out.status = cards.status === 'ok' ? 'ok' : cards.status === 'budget_exceeded' ? 'budget_exceeded' : 'failed';
    await writeSelfV2Marker(deps.prisma, ctx.userId, ctx.kundliId, now, out.status === 'ok' ? 'ready' : 'failed', out.status === 'ok' ? undefined : `personalizer ${cards.status}`);
    return out;
  } catch (e) {
    gaps.push(`build: ${String((e as Error).message ?? e).slice(0, 300)}`);
    out.status = 'failed';
    await writeSelfV2Marker(deps.prisma, args.userId, args.kundliId, now, 'failed', String((e as Error).message ?? e).slice(0, 300));
    return out;
  } finally {
    ms.total = since(tAll);
  }
}

/** The per-build Oracle-echo metric (doc 66 replay run 2, failure 1): one log line, never a reject. */
function logPersonalizerMetrics(ctx: SelfBuildContext, m: NonNullable<SelfV2CardsResult['metrics']>): void {
  console.log(JSON.stringify({ msg: 'self.v2 personalizer metrics', kundliId: ctx.kundliId, profile: ctx.sub.profile?.hash ?? null, echoMean: m.echoMean, echoMax: m.echoMax, echoMaxArea: m.echoMaxArea, flagged: m.flagged }));
}

function sliceTable(slices: readonly PreparedAgentSlice[]): SelfV2BuildResult['slices'] {
  return slices.map((s) => ({ agent: s.agent, prefixTokens: s.estTokens.prefix, suffixTokens: s.estTokens.suffix }));
}
