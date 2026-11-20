/**
 * The v3 build step (docs/reading-engine/68 Phase B). Runs after a v2 build that served the page, over the same build
 * context, the same natal prefix and the same portrait, when SELF_V3_BUILD=1:
 *
 *   1  the year frame from the pressure inventories of the reading clock set (doc 70 §4.1: the reading clock's, loaded
 *      by v2; the others stored at sync, pulled here only when missing)
 *   1b with READING_CLOCK_LAYER=1 (doc 70 §4.1 layers 1–3): the slices (stored ones read, changed ones written back),
 *      then the clock layer: one reader per clock, the code count and the agreed ledger
 *   1c with the per-card reading on (doc 70 §4.1 layers 4–5; SELF_V3_BUILD=1 and READING_CLOCK_LAYER=1): nothing is
 *      read until the board holds CARDS_READ_MIN cards or a card was asked for alone; then one Oracle and one
 *      Personalizer call per card (`readCards`) on the ledger, and steps 2–4 below (the three-call Oracle) are not run
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
import { getBoardsV3, getCardsReadMin, getReadingClocksMin, isCardsGroupPackEnabled, isCardsReadEnabled, isCardsStoryContractEnabled, isLensLinemenEnabled, isReadingClockLayerEnabled } from '../../../config/env.js';
import type { ActivationRow } from '../../digest/activation.js';
import { anyCardDef } from '../../cards/registry.js';
import { lensOf } from '../../cards/ownCharts.js';
import { type CardsStoryRunInput, type LensThreadRef } from '../../cards/storyInputs.js';
import { countedNames, renderShownPeriods, shownLabels, shownSystems } from '../../clocks/systems.js';
import type { ClockSheet } from '../../clocks/types.js';
import { runLensLineman } from '../../lens/lineman.js';
import { parseApplicability, type ApplicabilityRow } from '../clock.js';
import { withCacheLease } from '../../llm/cacheLease.js';
import { boardFactsOf, boardV3CardDef, defaultLens, isBoardLens, type AreaV3Board } from '../../boards/v3Cards.js';
import { isReadable } from '../../cards/registry.js';
import { answersLine } from '../../person/profile.js';
import { readCards, type CardsRunResult } from '../../cards/run.js';
import { loadBoardTechniques, techniqueBoardsOf, type BoardTechniqueSection, type TechniqueBoard } from '../../cards/techniques.js';
import { frameRange } from '../../slices/trim.js';
import { readCardsState, updateCardsState } from '../../cards/state.js';
import { sharedPrefix } from '../../clocks/reader.js';
import { pickClockLayerSlices, runClockLayer, type ClockLayerResult, type ClockLayerWords } from '../../clocks/run.js';
import type { AgreedLedger } from '../../clocks/types.js';
import { natalCoreFromPrefix, prepareSlices, type SliceSetReport } from '../../slices/prepare.js';
import { renderSliceSet, type SliceInventory } from '../../slices/render.js';
import type { RenderedSlice } from '../../slices/types.js';
import type { ReadingClockSet } from '../clock.js';
import { loadPressureInventory, loadReadingClockSet, type PressureInventoryDetail } from '../sub/pressure.js';
import { readBoardLayout, readLayout } from './layout.js';
import { ORACLE_V3_CALLS, runOracleV3, SELF_V3_ORACLE_PROMPT } from './oracle.js';
import { personalizerV3Call, personalizerV3Calls, personalizerVoiceToken, runPersonalizerV3, SELF_V3_PERSONALIZER_PROMPT } from './personalizer.js';
import { cardContent, SELF_V3_TECHNIQUE, type StoredSelfV3 } from './store.js';
import type { CardId, SelfCardId, SelfSectionId, SelfV3CardContent, YearFrameV3 } from './types.js';
import { buildYearFrameV3, frameDates, FRAME_MAX_OTHER_CLOCKS, loadStoredInventory, otherClocks, renderYearFrame } from './yearFrame.js';

export interface SelfV3StepDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  ensureCache?: typeof ensurePromptCache;
  informUsed?: Parameters<typeof runOracleV3>[0]['informUsed'];
  maxSpendUsd: number;
  now: Date;
  force?: boolean;
  /** test seam: the other clocks' inventories (default `loadClockInventory`: pulled when not stored, else the stored row) */
  loadInventory?: (prisma: PrismaClient, kundliId: string, system: string) => Promise<PressureInventoryDetail | null>;
  /** test seam: the reading clock set (default `loadReadingClockSet` over the stored rows, the build's clock as spine) */
  loadClockSet?: (prisma: PrismaClient, kundliId: string, spine: string) => Promise<ReadingClockSet | null>;
  /** test seam: the person's sections per card */
  loadSections?: (prisma: PrismaClient, kundliId: string) => Promise<Partial<Record<SelfCardId, SelfSectionId[]>>>;
  /** overrides READING_CLOCK_LAYER (doc 70 §4.1 layers 1–3) */
  clockLayer?: boolean;
  /** test seams: the slice store and the clock layer */
  prepareSlices?: typeof prepareSlices;
  runClockLayer?: typeof runClockLayer;
  /** overrides `isCardsReadEnabled` (doc 70 Phase 3) */
  cardsRead?: boolean;
  /** test seams: the board (default `readLayout`) and the card runner */
  loadBoard?: (prisma: PrismaClient, kundliId: string) => Promise<{ cards: SelfCardId[]; sections: Partial<Record<SelfCardId, SelfSectionId[]>> }>;
  readCards?: typeof readCards;
  /**
   * docs/dashboards/10 §4.1 step 4: the Love and Work active lens decks of the enabled boards (default: their v3
   * layouts, the lens stored or the person's default). They join the one card pack; they are read only when queued.
   */
  loadAreaDecks?: (prisma: PrismaClient, kundliId: string) => Promise<{ cards: CardId[]; sections: Partial<Record<CardId, SelfSectionId[]>> }>;
  /** test seam: the Love and Work boards' technique sections (docs/dashboards/14; default `loadBoardTechniques`) */
  loadTechniques?: (q: Parameters<typeof loadBoardTechniques>[1]) => Promise<Partial<Record<TechniqueBoard, BoardTechniqueSection>>>;
  /** overrides for the card runner (its spend cap, default this step's `maxSpendUsd`; the rest flag) */
  cardsCapUsd?: number;
  cardsReadRest?: boolean;
  /** docs/techniques/09: overrides CARDS_STORY_CONTRACT and LENS_LINEMEN; test seams for the engine's verdict on the conditional dashas and the lens lineman */
  storyContract?: boolean;
  lensLinemen?: boolean;
  loadApplicability?: (prisma: PrismaClient, kundliId: string) => Promise<ApplicabilityRow[] | null>;
  runLensLineman?: typeof runLensLineman;
}

export interface SelfV3StepInput {
  ctx: SelfBuildContext;
  /** the reading clock's inventory, as the v2 sub-techniques loaded it */
  pressure: PressureInventoryDetail | null;
  /** the v2 Oracle slice: its natal prefix and keys are reused */
  oracleSlice: PreparedAgentSlice;
  portrait: PersonPortrait | null;
  buildId: string;
  /** docs/techniques/09 §3: the seven family findings of this build (stored in reading_findings_cache) and the stored periods */
  findings?: ReadonlyArray<{ family: string; text: string }>;
  activation?: readonly ActivationRow[];
}

export interface SelfV3StepResult {
  status: 'ok' | 'partial' | 'failed' | 'skipped' | 'budget_exceeded';
  cards: Partial<Record<CardId, SelfV3CardContent>>;
  frame: YearFrameV3 | null;
  agents: SelfV2AgentTiming[];
  issues: ValidationIssue[];
  gaps: string[];
  cached: boolean;
  stored: boolean;
  key: string | null;
  ms: Record<string, number>;
  /** doc 70 layers 1–3, when READING_CLOCK_LAYER=1: which slices were read as stored and which were written */
  slices?: SliceSetReport & { count: number };
  clockLayer?: Pick<ClockLayerResult, 'status' | 'prefixHash' | 'spentUsd'> & { sheets: Array<{ system: string; status: string; cells: number }>; byStatus: AgreedLedger['byStatus'] | null };
  ledger?: AgreedLedger | null;
  /** the slices the clock layer read (the cards read the same prefix and their matter slices) */
  sliceSet?: RenderedSlice[];
  /** docs/techniques/09 §3.1: the lens threads read for this run (lens, links written, cached) */
  lensThreads?: Array<{ lens: string; ok: boolean; cached: boolean }>;
  /** doc 70 Phase 3: the per-card run, when it ran */
  cardsRun?: Pick<CardsRunResult, 'order' | 'spentUsd' | 'capReached'> & { results: Array<{ card: CardId; status: string }> };
}

/**
 * One clock's inventory for the frame: the stored row when fresh, else a pull (15 s limit, see `loadPressureInventory`);
 * a failed pull falls back to whatever row is stored; null when neither. Never throws. The seams are for tests.
 */
export async function loadClockInventory(
  prisma: PrismaClient,
  kundliId: string,
  system: string,
  asOf: string,
  seams: { pull?: typeof loadPressureInventory; stored?: typeof loadStoredInventory } = {},
): Promise<PressureInventoryDetail | null> {
  const pulled = await (seams.pull ?? loadPressureInventory)(prisma, kundliId, system, asOf).catch(() => null);
  if (pulled?.inventory) return pulled.inventory;
  return (seams.stored ?? loadStoredInventory)(prisma, kundliId, system).catch(() => null);
}

const since = (t0: number) => Math.round((performance.now() - t0) * 100) / 100;

/**
 * docs/dashboards/10 §4.1 step 4: the active lens deck of each enabled Love/Work board, and their sections. The lens is
 * the one stored on the layout, else the person's default (facts and age only). Nothing when BOARDS_V3 is unset.
 */
export async function loadAreaDecks(
  prisma: PrismaClient,
  kundliId: string,
  profile: { facts: { work?: { status?: string; level?: string }; love?: string; focus?: string[] }; declined?: string[]; ageYears?: number | null } | null,
  boards: readonly AreaV3Board[] = getBoardsV3(),
): Promise<{ cards: CardId[]; sections: Partial<Record<CardId, SelfSectionId[]>> }> {
  const out: { cards: CardId[]; sections: Partial<Record<CardId, SelfSectionId[]>> } = { cards: [], sections: {} };
  if (!boards.length) return out;
  const facts = boardFactsOf(profile);
  const age = profile?.ageYears ?? null;
  const layouts = await Promise.all(boards.map(async (b) => ({ b, layout: await readBoardLayout(prisma, kundliId, b).catch(() => null) })));
  for (const { b, layout } of layouts) {
    if (!layout) continue;
    const lens = isBoardLens(b, layout.boardOptions.lens) ? layout.boardOptions.lens : defaultLens(b, facts, age);
    for (const id of layout.cards) {
      if (boardV3CardDef(id)?.lens !== lens) continue;
      out.cards.push(id);
      const s = layout.sections[id];
      if (s) out.sections[id] = s;
    }
  }
  return out;
}

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
    `voice=${personalizerVoiceToken(ctx.sub.profile?.gender)}`,
  ].join('|') + '|';
}

/**
 * The v3 step under a recording cache lease (doc 86): the caches its calls use for this kundli (the clock prefix, the
 * card pack) are deleted when it ends, unless another operation on the kundli still holds a lease.
 */
export async function runSelfV3Cards(deps: SelfV3StepDeps, i: SelfV3StepInput): Promise<SelfV3StepResult> {
  return withCacheLease({ userId: i.ctx.userId, kundliId: i.ctx.kundliId }, 'build.v3', () => runSelfV3CardsUnleased(deps, i));
}

async function runSelfV3CardsUnleased(deps: SelfV3StepDeps, i: SelfV3StepInput): Promise<SelfV3StepResult> {
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
    // doc 70 §4.1: the reading clock set (the spine is this build's clock); unreadable → the v2 confirming clocks
    const set = await (deps.loadClockSet ?? ((p: PrismaClient, k: string, spine: string) => loadReadingClockSet(p, k, spine)))(deps.prisma, ctx.kundliId, clock.primary).catch(() => null);
    if (!set) out.gaps.push('v3: clock set not read; the confirming clocks are read instead');
    const others = otherClocks(clock, set).slice(0, FRAME_MAX_OTHER_CLOCKS);
    // every clock of the set is normally stored by the sync worker (`ensurePressureInventories`); one that is not is
    // pulled here, in parallel, 15 s each; a failed pull falls back to the stored row; a clock with neither is skipped
    const load = deps.loadInventory ?? ((p: PrismaClient, k: string, system: string) => loadClockInventory(p, k, system, ctx.asOf));
    const inventories = await Promise.all(others.map(async (system) => ({ system, inventory: await load(deps.prisma, ctx.kundliId, system).catch(() => null) })));
    const frame = buildYearFrameV3({ asOf: ctx.asOf, clock, primary: i.pressure, others: inventories, year: ctx.sub.year ?? null });
    out.frame = frame;
    ms.frame = since(t);
    if (!frame.spans.length) {
      out.status = 'skipped';
      out.gaps.push(`v3: no year frame (${frame.clocksSkipped.map((c) => c.reason).join('; ')})`);
      return out;
    }
    // 1c (gate): with the per-card reading on, nothing is read before the person chose a board or asked for a card
    const cardsOn = deps.cardsRead ?? isCardsReadEnabled();
    const storyOn = deps.storyContract ?? isCardsStoryContractEnabled();
    let board: { cards: SelfCardId[]; sections: Partial<Record<SelfCardId, SelfSectionId[]>> } = { cards: [], sections: {} };
    if (cardsOn) {
      board = await (deps.loadBoard ?? (async (p: PrismaClient, k: string) => readLayout(p, k)))(deps.prisma, ctx.kundliId).catch(() => ({ cards: [], sections: {} }));
      const doc = await readCardsState(deps.prisma, ctx.kundliId, deps.now);
      // a queued card opens the gate only while it is readable (a Love/Work card whose board left BOARDS_V3 does not)
      const asked = Object.entries(doc.cards).some(([id, e]) => e?.state === 'queued' && isReadable(id));
      if (board.cards.length < getCardsReadMin() && !asked) {
        out.status = 'skipped';
        out.gaps.push(`cards: the board holds ${board.cards.length} cards (${getCardsReadMin()} start the reading) and none was asked for; nothing read`);
        return out;
      }
      await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, deps.now, (d) => {
        d.stage = 'clocks';
        d.preparing = false;
      });
    }
    // 1b: the slices and the clock layer (doc 70 §4.1 layers 1–3), behind READING_CLOCK_LAYER
    let layerModel: string | null = null;
    let layerSheets: ClockSheet[] = [];
    let layerWords: Promise<ClockLayerWords> | null = null;
    // the concordance's words, once written: the worded ledger, its call and its spend (on the result and the day's doc)
    const foldWords = async () => {
      if (!layerWords) return;
      const w = await layerWords;
      layerWords = null;
      ms.concordance = w.ms;
      if (w.timing) out.agents.push(w.timing as unknown as SelfV2AgentTiming);
      out.ledger = w.ledger;
      if (out.clockLayer) {
        out.clockLayer.spentUsd = Math.round((out.clockLayer.spentUsd + w.spentUsd) * 1e6) / 1e6;
        out.clockLayer.byStatus = w.ledger.byStatus;
        if (w.status !== 'ok' && out.clockLayer.status === 'ok') out.clockLayer.status = w.status;
      }
      if (w.issues.length) out.gaps.push(`v3: concordance ${w.status} (${w.issues.slice(0, 3).map((x) => x.message).join('; ')})`);
      if (cardsOn && w.spentUsd > 0) {
        await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, deps.now, (d) => {
          d.spentUsd = Math.round((d.spentUsd + w.spentUsd) * 1e6) / 1e6;
        });
      }
    };
    if (cardsOn || (deps.clockLayer ?? isReadingClockLayerEnabled())) {
      const tl = performance.now();
      const invs: SliceInventory[] = [{ system: frame.clock, inventory: i.pressure }, ...inventories].filter((x): x is SliceInventory => Boolean(x.inventory));
      const fresh = [natalCoreFromPrefix(i.oracleSlice.prefix, ctx.stamps.digestVersion), ...renderSliceSet({ frame, inventories: invs, year: ctx.sub.year ?? null })];
      const prepared = await (deps.prepareSlices ?? prepareSlices)(deps.prisma, ctx.kundliId, fresh);
      out.slices = { ...prepared.report, count: prepared.slices.length };
      out.sliceSet = prepared.slices;
      ms.slices = since(tl);
      const tc = performance.now();
      // with the per-card reading on, the cards start on the counted ledger and the concordance writes its words
      // meanwhile (doc 70 Phase 3 replay fixes); they are folded in after the cards (`foldWords`)
      const layer = await (deps.runClockLayer ?? runClockLayer)(
        // one value decides the card path (doc 09 decision 7): with the story contract the cards go one per call over this
        // prefix, so it is warmed on a hit too; only the grouped path (contract off) reads its own pack instead
        { prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed, maxSpendUsd: deps.maxSpendUsd, now: deps.now, force: deps.force, ensureCache: deps.ensureCache, enabled: true, words: cardsOn ? 'background' : 'await', warmOnHit: !(cardsOn && !storyOn && isCardsGroupPackEnabled()) },
        { ctx: { userId: ctx.userId, kundliId: ctx.kundliId, asOf: ctx.asOf }, frame, slices: prepared.slices },
      );
      ms.clockLayer = since(tc);
      layerWords = layer.words ?? null;
      layerModel = layer.model;
      layerSheets = layer.sheets;
      out.agents.push(...(layer.timings as unknown as SelfV2AgentTiming[]));
      out.ledger = layer.ledger;
      out.clockLayer = {
        status: layer.status,
        prefixHash: layer.prefixHash,
        spentUsd: layer.spentUsd,
        sheets: layer.sheets.map((x) => ({ system: x.system, status: x.status, cells: x.cells.length })),
        byStatus: layer.ledger?.byStatus ?? null,
      };
      if (layer.status !== 'ok') out.gaps.push(`v3: clock layer ${layer.status}${layer.issues.length ? ` (${layer.issues.slice(0, 3).map((x) => x.message).join('; ')})` : ''}`);
    }
    const minClocks = getReadingClocksMin();
    // 1c: a reading per card on the ledger (doc 70 §4.1 layers 4–5); the three-call Oracle is not run
    if (cardsOn) {
      const clocksView = [
        ...(out.clockLayer?.sheets ?? []).map((x) => ({ system: x.system, label: clockLabel(x.system), state: x.status === 'ok' || x.status === 'partial' ? ('read' as const) : ('failed' as const) })),
        ...frame.clocksSkipped.filter((c) => c.reason === 'no stored tone').map((c) => ({ system: c.system, label: clockLabel(c.system), state: 'missing' as const })),
      ];
      const layerSpent = out.clockLayer?.spentUsd ?? 0;
      const picked = out.sliceSet ? pickClockLayerSlices(out.sliceSet).picked : null;
      if (!out.ledger || !picked) {
        await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, deps.now, (d) => {
          d.stage = 'idle';
          d.preparing = frame.clocksRead.length < minClocks || out.clockLayer?.status === 'too_few_clocks' || out.clockLayer?.status === 'missing_slices';
          d.clocks = clocksView;
          d.spentUsd = Math.round((d.spentUsd + layerSpent) * 1e6) / 1e6;
          // the queued cards wait for the next build (the board says the chart is still being prepared)
        });
        await foldWords();
        out.status = 'skipped';
        out.gaps.push(`cards: no agreed ledger (${out.clockLayer?.status ?? 'no clock layer'}); no card read`);
        return out;
      }
      await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, deps.now, (d) => {
        d.stage = 'cards';
        d.preparing = false;
        d.clocks = clocksView;
        d.spentUsd = Math.round((d.spentUsd + layerSpent) * 1e6) / 1e6;
      });
      const prefix = sharedPrefix(picked.shared, ctx.asOf);
      const years = (frame.years ?? []).flatMap((y) => [y.from, y.to]);
      const dates = new Set([...frameDates(frame), ...years, ...storedWindowsOf(ctx).endpoints]);
      const answers = answersLine(profile);
      const area = await (deps.loadAreaDecks ?? ((p: PrismaClient, k: string) => loadAreaDecks(p, k, profile)))(deps.prisma, ctx.kundliId).catch(() => ({ cards: [] as CardId[], sections: {} }));
      // docs/dashboards/14: the Love and Work boards' own techniques, loaded only when a card of theirs is in the run
      // (the decks in the pack, or a queued card); read-only; a Self-only run loads nothing and its pack is unchanged
      const queuedNow = Object.entries((await readCardsState(deps.prisma, ctx.kundliId, deps.now).catch(() => null))?.cards ?? {}).filter(([id, e]) => e?.state === 'queued' && isReadable(id)).map(([id]) => id);
      const techBoards = techniqueBoardsOf([...area.cards, ...queuedNow]);
      const techniques: Partial<Record<TechniqueBoard, BoardTechniqueSection>> = techBoards.length
        ? await (deps.loadTechniques ?? ((q: Parameters<typeof loadBoardTechniques>[1]) => loadBoardTechniques({ prisma: deps.prisma }, q)))({ kundliId: ctx.kundliId, asOf: ctx.asOf, boards: techBoards, ageYears: profile.ageYears ?? null, range: frameRange(frame), systems: frame.clocksRead }).catch(() => ({}))
        : {};
      // docs/techniques/09 §3: the story inputs (verified systems, stored periods, findings, sheets) and the lens threads
      let story: CardsStoryRunInput | undefined;
      let linemenSpent = 0;
      if (storyOn) {
        const tl = performance.now();
        const applicability = await (deps.loadApplicability ?? loadApplicability)(deps.prisma, ctx.kundliId).catch(() => null);
        const activation = i.activation ?? [];
        const shown = shownSystems([...new Set(activation.map((r) => r.system))], applicability);
        story = { findings: i.findings ?? [], sheets: layerSheets, shown, periodRows: activation, threads: {} };
        const lensCards = new Map<string, string[]>();
        for (const id of [...new Set([...board.cards, ...area.cards, ...queuedNow])]) {
          const lens = lensOf(id);
          if (lens && isReadable(id)) lensCards.set(lens, [...(lensCards.get(lens) ?? []), id]);
        }
        if (deps.lensLinemen ?? isLensLinemenEnabled()) {
          const verified = countedNames(shown);
          const periods = renderShownPeriods(activation, shown, { from: frame.spans[0]!.from, to: frame.spans[frame.spans.length - 1]!.to });
          const threads = await Promise.all(
            [...lensCards.entries()].map(async ([lens, ids]) => {
              const matters = [...new Set(ids.flatMap((id) => anyCardDef(id)?.matters ?? []))];
              const r = await (deps.runLensLineman ?? runLensLineman)(
                { prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed, now: deps.now, force: deps.force },
                {
                  ctx: { userId: ctx.userId, kundliId: ctx.kundliId, asOf: ctx.asOf, digestVersion: ctx.stamps.digestVersion },
                  lens,
                  matters,
                  cards: ids.map((id) => anyCardDef(id)?.title ?? id),
                  prefix: { text: prefix.text, dated: prefix.dated, keys: prefix.keys, hash: prefix.hash },
                  findings: story!.findings,
                  sheets: layerSheets,
                  ledger: out.ledger ?? null,
                  frame,
                  systemsText: periods.text,
                  systemsKeys: periods.keys,
                  verified,
                  verifiedLine: shownLabels(shown),
                  model: layerModel ?? i.oracleSlice.model,
                },
              );
              return { lens, r };
            }),
          );
          const threadMap: Partial<Record<string, LensThreadRef>> = {};
          for (const { lens, r } of threads) {
            if (r.thread) threadMap[lens] = r.thread;
            out.agents.push(...r.timings);
            out.issues.push(...r.issues);
            linemenSpent += r.timings.reduce((n, x) => n + x.costUsd, 0);
          }
          story.threads = threadMap;
          out.lensThreads = threads.map(({ lens, r }) => ({ lens, ok: Boolean(r.thread), cached: r.cached }));
        }
        ms.lensLinemen = since(tl);
      }
      const tcards = performance.now();
      const run = await (deps.readCards ?? readCards)(
        // one build run is one operation (docs/billing/README.md "Spend cap per operation"): the cards get what the run
        // has left after the v2 build (`maxSpendUsd`) less the clock layer's spend; the day's stored spend is not counted
        { prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed, now: deps.now, force: deps.force, capUsd: deps.cardsCapUsd ?? deps.maxSpendUsd, readRest: deps.cardsReadRest },
        {
          ctx,
          frame,
          ledger: out.ledger,
          prefix: { text: prefix.text, dated: prefix.dated, keys: prefix.keys, hash: prefix.hash },
          slices: out.sliceSet!,
          board: board.cards,
          ...(area.cards.length ? { packCards: area.cards } : {}),
          portrait: i.portrait,
          sections: { ...area.sections, ...board.sections },
          dates,
          answers,
          model: layerModel ?? i.oracleSlice.model,
          ...(Object.keys(techniques).length ? { techniques } : {}),
          spentBeforeUsd: Math.round((layerSpent + linemenSpent) * 1e6) / 1e6,
          ...(story ? { story } : {}),
        },
      );
      ms.cards = since(tcards);
      await foldWords();
      await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, deps.now, (d) => {
        d.stage = 'done';
        d.capReached = run.capReached;
      });
      out.agents.push(...run.timings);
      out.issues.push(...run.issues);
      out.cards = run.cards;
      out.cardsRun = { order: run.order, spentUsd: run.spentUsd, capReached: run.capReached, results: run.results.map((r) => ({ card: r.card, status: r.status })) };
      const wanted = run.results.filter((r) => r.status !== 'skipped_cap').length;
      const n = Object.keys(run.cards).length;
      out.status = run.capReached && !n ? 'budget_exceeded' : !n ? 'failed' : n < wanted ? 'partial' : 'ok';
      out.stored = run.results.some((r) => r.status === 'ok');
      out.cached = n > 0 && run.results.every((r) => r.status === 'cached' || r.status === 'skipped_cap');
      return out;
    }
    if (frame.clocksRead.length < minClocks) out.gaps.push(`v3: only ${frame.clocksRead.length} clock(s) read (${frame.clocksRead.join(', ')}); ${minClocks} wanted`);
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
        const answers = answersLine(profile);
        const to = performance.now();
        const oracle = await runOracleV3({ prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed, spentUsd: out.clockLayer?.spentUsd ?? 0, maxSpendUsd: deps.maxSpendUsd }, ctx, slice, frame, dates, answers);
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
        const repair = (cards: Parameters<typeof personalizerV3Call>[2], note: string) =>
          personalizerV3Call(ctx, 'v3.personalizer.repair', cards, spanDates, pInput, promptText(SELF_V3_PERSONALIZER_PROMPT), i.oracleSlice.model, note);
        const personal = await runPersonalizerV3({ prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed }, ctx, pcalls, pInput, dates, repair);
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

/** The engine's `dasha.applicable` verdicts for the kundli (null when none stored). Read only. */
export async function loadApplicability(prisma: PrismaClient, kundliId: string): Promise<ApplicabilityRow[] | null> {
  const row = await (prisma as unknown as { kundliData?: { findFirst?: (q: unknown) => Promise<{ payload: unknown } | null> } }).kundliData?.findFirst?.({
    where: { kundli_id: kundliId, data_type: 'dasha.applicable' },
    select: { payload: true },
  });
  return row?.payload != null ? parseApplicability(row.payload) : null;
}
