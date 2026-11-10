/**
 * The v3 build step (docs/reading-engine/68 Phase B). Runs after a v2 build that served the page, over the same build
 * context, the same natal prefix and the same portrait, when SELF_V3_BUILD=1:
 *
 *   1  the year frame from the stored pressure inventories (the reading clock's, loaded by v2; the others stored only)
 *   2  the Oracle ×3 in parallel over the v2 natal prefix, the frame as the suffix; failed cards re-asked once
 *   3  the Personalizer ×(1–3) in parallel, one per Oracle call that kept a card
 *   4  every validator finding to `reading_validation_failures`; the cards with the frame to `technique_outputs`
 *
 * A failure here never fails the build: the v2 cards stay on the board. Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { canonicalJson } from '../../../techniques/pieces.js';
import { withTechniqueOutput } from '../../../techniques/outputStore.js';
import type { GeminiCallOptions, GeminiResult } from '../../llm/gemini.js';
import type { ensurePromptCache } from '../../llm/promptCache.js';
import { clockLabel } from '../words.js';
import { warmPrefixes } from '../v2/cache.js';
import { logValidation, recordValidationIssues, type RecordMeta } from '../v2/failures.js';
import { storedWindowsOf } from '../v2/oracle.js';
import { promptHash, promptText, shortHash } from '../v2/slices.js';
import type { PersonPortrait, PreparedAgentSlice, SelfBuildContext, SelfV2AgentTiming, ValidationIssue } from '../v2types.js';
import type { PressureInventoryDetail } from '../sub/pressure.js';
import { readLayout } from './layout.js';
import { ORACLE_V3_CALLS, runOracleV3, SELF_V3_ORACLE_PROMPT } from './oracle.js';
import { personalizerV3Calls, runPersonalizerV3, SELF_V3_PERSONALIZER_PROMPT } from './personalizer.js';
import { cardContent, SELF_V3_TECHNIQUE, type StoredSelfV3 } from './store.js';
import type { SelfCardId, SelfSectionId, SelfV3CardContent, YearFrameV3 } from './types.js';
import { buildYearFrameV3, frameDates, FRAME_MAX_OTHER_CLOCKS, loadStoredInventory, otherClocks, renderYearFrame } from './yearFrame.js';

export interface SelfV3StepDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  ensureCache?: typeof ensurePromptCache;
  informUsed?: Parameters<typeof runOracleV3>[0]['informUsed'];
  maxSpendUsd: number;
  now: Date;
  force?: boolean;
  /** test seam: the other clocks' stored inventories */
  loadInventory?: (prisma: PrismaClient, kundliId: string, system: string) => Promise<PressureInventoryDetail | null>;
  /** test seam: the person's sections per card */
  loadSections?: (prisma: PrismaClient, kundliId: string) => Promise<Partial<Record<SelfCardId, SelfSectionId[]>>>;
}

export interface SelfV3StepInput {
  ctx: SelfBuildContext;
  /** the reading clock's inventory, as the v2 sub-techniques loaded it */
  pressure: PressureInventoryDetail | null;
  /** the v2 Oracle slice: its natal prefix and keys are reused */
  oracleSlice: PreparedAgentSlice;
  portrait: PersonPortrait | null;
  buildId: string;
}

export interface SelfV3StepResult {
  status: 'ok' | 'partial' | 'failed' | 'skipped' | 'budget_exceeded';
  cards: Partial<Record<SelfCardId, SelfV3CardContent>>;
  frame: YearFrameV3 | null;
  agents: SelfV2AgentTiming[];
  issues: ValidationIssue[];
  gaps: string[];
  cached: boolean;
  stored: boolean;
  key: string | null;
  ms: Record<string, number>;
}

const since = (t0: number) => Math.round((performance.now() - t0) * 100) / 100;

export function v3StoreKey(ctx: SelfBuildContext, frame: YearFrameV3, oraclePrefixHash: string, portraitHash: string, sections: unknown): string {
  return [
    'self.v3.cards',
    `clock=${ctx.stamps.clock}`,
    `frame=${shortHash(canonicalJson(frame.spans.map((s) => [s.from, s.to, s.tone, s.clocks.map((c) => [c.system, c.tone])])))}`,
    `pre=${oraclePrefixHash}`,
    `confirm=${ctx.stamps.confirmHash ?? '-'}`,
    `profile=${ctx.sub.profile?.hash ?? '-'}`,
    `portrait=${portraitHash}`,
    `sections=${shortHash(canonicalJson(sections))}`,
    `p=${promptHash(SELF_V3_ORACLE_PROMPT)}.${promptHash(SELF_V3_PERSONALIZER_PROMPT)}`,
  ].join('|') + '|';
}

export async function runSelfV3Cards(deps: SelfV3StepDeps, i: SelfV3StepInput): Promise<SelfV3StepResult> {
  const t0 = performance.now();
  const ms: Record<string, number> = {};
  const out: SelfV3StepResult = { status: 'failed', cards: {}, frame: null, agents: [], issues: [], gaps: [], cached: false, stored: false, key: null, ms };
  const { ctx } = i;
  try {
    const clock = ctx.sub.clock;
    const profile = ctx.sub.profile;
    if (!clock || !profile) {
      out.status = 'skipped';
      out.gaps.push('v3: clock or profile missing');
      return out;
    }
    // 1: the year frame
    let t = performance.now();
    const others = otherClocks(clock).slice(0, FRAME_MAX_OTHER_CLOCKS);
    const load = deps.loadInventory ?? loadStoredInventory;
    const inventories = await Promise.all(others.map(async (system) => ({ system, inventory: await load(deps.prisma, ctx.kundliId, system).catch(() => null) })));
    const frame = buildYearFrameV3({ asOf: ctx.asOf, clock, primary: i.pressure, others: inventories, year: ctx.sub.year ?? null });
    out.frame = frame;
    ms.frame = since(t);
    if (!frame.spans.length) {
      out.status = 'skipped';
      out.gaps.push(`v3: no year frame (${frame.clocksSkipped.map((c) => c.reason).join('; ')})`);
      return out;
    }
    if (frame.degraded) out.gaps.push(`v3: frame degraded (clocks read: ${frame.clocksRead.join(', ')})`);

    const sections = await (deps.loadSections ?? (async (p, k) => (await readLayout(p, k)).sections))(deps.prisma, ctx.kundliId).catch(() => ({}));
    const portraitHash = shortHash(canonicalJson(i.portrait ?? null));
    const key = v3StoreKey(ctx, frame, i.oracleSlice.prefixHash, portraitHash, sections);
    out.key = key;
    const first = frame.spans[0]!;
    const last = frame.spans[frame.spans.length - 1]!;
    const nowSpan = frame.spans.find((s) => s.place === 'now') ?? first;

    t = performance.now();
    const stored = await withTechniqueOutput<StoredSelfV3>(
      deps.prisma,
      {
        technique: SELF_V3_TECHNIQUE,
        kundliId: ctx.kundliId,
        digestVersion: key,
        context: { now: deps.now, runningPeriod: { from: new Date(`${nowSpan.from}T00:00:00Z`), to: new Date(`${nowSpan.to}T00:00:00Z`) } },
        agentId: 'self.oracle.v3',
        userId: ctx.userId,
        charts: [{ type: 'pressure_inventory', variant: `system=${frame.clock}` }],
        forceRefresh: Boolean(deps.force),
      },
      async () => {
        // 2: the Oracle over the v2 natal prefix, the frame as the suffix
        const rendered = renderYearFrame(frame, clockLabel(frame.clock));
        const system = promptText(SELF_V3_ORACLE_PROMPT);
        const slice: PreparedAgentSlice = {
          ...i.oracleSlice,
          system,
          suffix: rendered.text,
          prefixHash: shortHash(`self.oracle|${i.oracleSlice.model}|${system}|${i.oracleSlice.prefix}`),
          keys: [...new Set([...i.oracleSlice.keys, ...rendered.keys])],
          estTokens: { prefix: i.oracleSlice.estTokens.prefix, suffix: Math.ceil(rendered.text.length / 2.2) },
        };
        const tw = performance.now();
        await warmPrefixes([slice], { ensureCache: deps.ensureCache });
        ms.warm = since(tw);
        const dates = new Set([...frameDates(frame), ...storedWindowsOf(ctx).endpoints]);
        const answers = profile.lastConfirms.filter((c) => c.answer !== 'skip').map((c) => `${c.claimId}=${c.answer}`).join('; ');
        const to = performance.now();
        const oracle = await runOracleV3({ prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed, maxSpendUsd: deps.maxSpendUsd }, ctx, slice, frame, dates, answers);
        ms.oracle = since(to);
        out.agents.push(...oracle.calls);
        out.issues.push(...oracle.issues);
        const meta: RecordMeta = { userId: ctx.userId, kundliId: ctx.kundliId, board: 'self', buildId: i.buildId, model: oracle.model, promptHash: oracle.promptHash };
        logValidation(meta, 'oracle', oracle.issues);
        await recordValidationIssues(deps.prisma, meta, oracle.issues);
        if (!oracle.output) {
          out.status = oracle.status === 'budget_exceeded' ? 'budget_exceeded' : 'failed';
          return { value: { key, frame, oracle: { cards: {} }, cards: {}, cardStatus: {} }, skipStore: true, summary: { status: oracle.status } };
        }

        // 3: the Personalizer, one call per Oracle call that kept a card
        const spanDates = new Map(frame.spans.map((s) => [s.id, { from: s.from, to: s.to }]));
        const pInput = { profile: { ...profile }, portrait: i.portrait, sections };
        const pcalls = personalizerV3Calls(ctx, ORACLE_V3_CALLS, oracle.output, spanDates, pInput, promptText(SELF_V3_PERSONALIZER_PROMPT), i.oracleSlice.model);
        const tp = performance.now();
        const personal = await runPersonalizerV3({ prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed }, ctx, pcalls, pInput, dates);
        ms.personalizer = since(tp);
        out.agents.push(...personal.calls);
        out.issues.push(...personal.issues);
        const pmeta: RecordMeta = { ...meta, model: personal.model, promptHash: personal.promptHash };
        logValidation(pmeta, 'personalizer', personal.issues);
        await recordValidationIssues(deps.prisma, pmeta, personal.issues);

        const cards: Partial<Record<SelfCardId, SelfV3CardContent>> = {};
        const cardStatus: StoredSelfV3['cardStatus'] = { ...oracle.cardStatus };
        for (const id of Object.keys(oracle.output.cards) as SelfCardId[]) {
          const c = cardContent(oracle.output.cards[id], personal.cards[id], frame);
          if (c) cards[id] = c;
          else cardStatus[id] = 'withheld';
        }
        const n = Object.keys(cards).length;
        out.status = !n ? 'failed' : n < ORACLE_V3_CALLS.flatMap((x) => x.cards).length ? 'partial' : 'ok';
        return { value: { key, frame, oracle: oracle.output, cards, cardStatus }, skipStore: n === 0, summary: { status: out.status, cards: n, spans: frame.spans.length, to: last.to } };
      },
    );
    ms.step = since(t);
    out.cached = stored.cached;
    out.cards = stored.value.cards;
    out.stored = !stored.cached && Object.keys(out.cards).length > 0;
    if (stored.cached) out.status = Object.keys(out.cards).length ? 'ok' : 'failed';
    return out;
  } catch (e) {
    out.status = 'failed';
    out.gaps.push(`v3: ${String((e as Error).message ?? e).slice(0, 300)}`);
    return out;
  } finally {
    ms.total = since(t0);
  }
}
