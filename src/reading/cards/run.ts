/**
 * The card queue (docs/reading-engine/70 §4.1 "Trigger and queue", layers 4 and 5). Runs inside the v3 build step,
 * as soon as the clock layer has counted the sheets: the ledger it reads has every cell's status, tone, agree/of and
 * evidence (all decided in code); the concordance's words follow when written, and a card read before them is the same
 * card (the store key holds the grounding, not the words):
 *
 *   1  the cards asked for alone (POST, `queued` in today's state doc), then the board's cards in the person's order,
 *      CARDS_BOARD_PARALLEL at a time;
 *   2  with CARDS_READ_REST=1, every other offered card, CARDS_REST_PARALLEL at a time;
 *   3  cards queued while this ran (a card added meanwhile) are taken next, until none is left.
 *
 * Per card: state `reading`, one Oracle call (repaired once alone), one Personalizer call chained to it (repaired once),
 * stored in `technique_outputs`, state `done`; a failure marks that card `failed` and nothing else. Before each card
 * the day's spend (state doc + this run) is checked against CARDS_SPEND_CAP_USD; at the cap the queue stops and the
 * rest stay "not read yet". A stored reading with the same key is served without a call. Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { getCardsBoardParallel, getCardsGroupSizeBoard, getCardsGroupSizeRest, getCardsRestParallel, getCardsSpendCapUsd, isCardsGroupPackEnabled, isCardsReadRestEnabled } from '../../config/env.js';
import { ensurePromptCache } from '../llm/promptCache.js';
import { buildCardPack, CARD_GROUP_PROMPT, readCardGroup, splitGroups, type CardPack, type GroupCardResult } from './group.js';
import { canonicalJson } from '../../techniques/pieces.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import type { AgreedLedger } from '../clocks/types.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { clockLabel } from '../self/words.js';
import type { markAgentUsed } from '../self/v2/cache.js';
import { promptHash, promptText, shortHash } from '../self/v2/slices.js';
import type { PersonPortrait, SelfBuildContext, SelfV2AgentTiming, ValidationIssue } from '../self/v2types.js';
import { cardDef, isCardOffered, READABLE_CARDS } from '../self/v3/cards.js';
import { personalizerV3Call, personalizerVoiceToken, runPersonalizerV3, SELF_V3_PERSONALIZER_PROMPT, type PersonalizerV3Input } from '../self/v3/personalizer.js';
import { cardContent } from '../self/v3/store.js';
import type { SelfCardId, SelfV3CardContent, YearFrameV3 } from '../self/v3/types.js';
import { renderYearFrame } from '../self/v3/yearFrame.js';
import type { RenderedSlice } from '../slices/types.js';
import { readCardOracle } from './oracle.js';
import { readCardsState, updateCardsState } from './state.js';
import { cardStoreKey } from './store.js';
import { CARD_ORACLE_PROMPT, CARD_PERSONALIZER_AGENT, CARD_READING_TECHNIQUE, cardBriefPrompt, type CardRunResult, type StoredCardReading } from './types.js';
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';

export interface CardsRunDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  now: Date;
  force?: boolean;
  /** overrides: the spend cap (USD per day), the rest flag, the parallel limits */
  capUsd?: number;
  readRest?: boolean;
  boardParallel?: number;
  restParallel?: number;
  /** overrides: read in groups on one cached pack (doc 71), and the group sizes */
  groupPack?: boolean;
  groupSizeBoard?: number;
  groupSizeRest?: number;
  ensureCache?: typeof ensurePromptCache;
}

export interface CardsRunInput {
  ctx: SelfBuildContext;
  frame: YearFrameV3;
  ledger: AgreedLedger | null;
  /** the shared prefix the clock layer warmed (natal.core, sky.window, year.tp, frame) */
  prefix: { text: string; keys: readonly string[]; hash: string };
  /** every slice the build holds; the card reads its `matter.<key>` slices */
  slices: readonly RenderedSlice[];
  /** the person's board, in their order */
  board: readonly SelfCardId[];
  portrait: PersonPortrait | null;
  sections: Partial<Record<SelfCardId, readonly string[]>>;
  dates: ReadonlySet<string>;
  answers: string;
  model: string;
  /** USD spent by this build before the cards (the clock layer); counted against the day's cap */
  spentBeforeUsd: number;
}

export interface CardsRunResult {
  results: CardRunResult[];
  cards: Partial<Record<SelfCardId, SelfV3CardContent>>;
  timings: SelfV2AgentTiming[];
  issues: ValidationIssue[];
  spentUsd: number;
  capReached: boolean;
  order: SelfCardId[];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The order cards are read in: asked-for first, then the board, then (with the rest on) the other readable offered cards. */
export function cardOrder(board: readonly SelfCardId[], asked: readonly SelfCardId[], rest: boolean): { first: SelfCardId[]; rest: SelfCardId[] } {
  const ok = (id: SelfCardId) => READABLE_CARDS.includes(id) && Boolean(cardDef(id) && isCardOffered(cardDef(id)!, true));
  const first = [...new Set([...asked, ...board])].filter(ok);
  const others = rest ? READABLE_CARDS.filter((id) => ok(id) && !first.includes(id)) : [];
  return { first, rest: others };
}

async function pool<T>(items: readonly T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const x = items[next++]!;
      await fn(x);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

interface GroupShare {
  result: GroupCardResult;
  timings: SelfV2AgentTiming[];
  issues: ValidationIssue[];
}

/** Longest a phase waits for its slowest store lookup before its groups go out anyway. */
export const GROUP_GATHER_MS = 3_000;

/**
 * Collects the cards of one phase whose stored reading missed and reads them in groups of `size` (doc 71 §4.3). A card
 * asks with `read(id)`; a card served from the store (or stopped by the cap) reports `settle(id)`. The groups go out as
 * soon as every card of the phase has done one or the other (or after GROUP_GATHER_MS), in reading order. A group's cost
 * is shared evenly by its cards. (The 2026-11-11 replay: a 25 ms timer sent every card alone, since each store lookup
 * is a database round trip.)
 */
function groupBatcher(run: (cards: SelfCardId[], call: string) => Promise<{ cards: Partial<Record<SelfCardId, GroupCardResult>>; timings: SelfV2AgentTiming[]; issues: ValidationIssue[] }>, order: readonly SelfCardId[], phase: readonly SelfCardId[], size: number, label: string) {
  const expected = new Set(phase);
  const waiting = new Map<SelfCardId, (s: GroupShare) => void>();
  const asked = new Set<SelfCardId>();
  const settled = new Set<SelfCardId>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let n = 0;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const ids = [...waiting.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const resolvers = new Map(waiting);
    waiting.clear();
    for (const g of splitGroups(ids, size)) {
      const call = `${label}.${n++}`;
      void run(g, call).then(
        (r) => {
          const share = (t: SelfV2AgentTiming): SelfV2AgentTiming => ({ ...t, costUsd: round6(t.costUsd / g.length) });
          for (const id of g)
            resolvers.get(id)!({ result: r.cards[id] ?? { oracle: null, personal: null, problems: ['not returned'] }, timings: r.timings.map(share), issues: r.issues.filter((x) => x.area === id || x.area === null) });
        },
        (e) => {
          for (const id of g) resolvers.get(id)!({ result: { oracle: null, personal: null, problems: [String((e as Error)?.message ?? e)] }, timings: [], issues: [] });
        },
      );
    }
  };
  const maybeFlush = () => {
    if (!waiting.size) return;
    if ([...expected].every((id) => asked.has(id) || settled.has(id))) flush();
    else if (!timer) timer = setTimeout(flush, GROUP_GATHER_MS);
  };
  return {
    read(id: SelfCardId): Promise<GroupShare> {
      return new Promise((resolve) => {
        asked.add(id);
        waiting.set(id, resolve);
        maybeFlush();
      });
    },
    settle(id: SelfCardId): void {
      if (asked.has(id)) return;
      settled.add(id);
      maybeFlush();
    },
  };
}

export async function readCards(deps: CardsRunDeps, i: CardsRunInput): Promise<CardsRunResult> {
  const { ctx } = i;
  const out: CardsRunResult = { results: [], cards: {}, timings: [], issues: [], spentUsd: 0, capReached: false, order: [] };
  const cap = deps.capUsd ?? getCardsSpendCapUsd();
  const now = deps.now;
  const state0 = await readCardsState(deps.prisma, ctx.kundliId, now);
  const spentToday = state0.spentUsd + i.spentBeforeUsd;
  const asked = (Object.entries(state0.cards) as Array<[SelfCardId, { state: string }]>).filter(([, e]) => e.state === 'queued').map(([id]) => id);
  const order = cardOrder(i.board, asked, deps.readRest ?? isCardsReadRestEnabled());
  out.order = [...order.first, ...order.rest];
  const done = new Set<SelfCardId>();
  const spent = () => round6(spentToday + out.spentUsd);

  const frameRender = renderYearFrame(i.frame, clockLabel(i.frame.clock));
  // the grounding only (status, tone, count, evidence): a card read on the counted ledger before the concordance wrote
  // its words is the same card on the worded ledger, so a warm open serves it instead of reading it again
  const ledgerHash = i.ledger ? shortHash(canonicalJson(i.ledger.cells.map((c) => [c.id, c.status, c.tone, c.agree, c.of, c.evidence]))) : '-';
  const frameHash = shortHash(canonicalJson(i.frame.spans.map((s) => [s.from, s.to, s.tone, s.held, s.clocks.map((c) => [c.system, c.tone])])));
  const portraitHash = shortHash(canonicalJson(i.portrait ?? null));
  const nowSpan = i.frame.spans.find((s) => s.place === 'now') ?? i.frame.spans[0]!;
  const spanDates = new Map(i.frame.spans.map((s) => [s.id, { from: s.from, to: s.to }]));
  const pHash = [...[READER_SYSTEM_PROMPT, CARD_ORACLE_PROMPT, SELF_V3_PERSONALIZER_PROMPT].map(promptHash), personalizerVoiceToken(ctx.sub.profile?.gender)].join('.');
  const titles = i.board.map((id) => cardDef(id)?.title ?? id);
  const owner = { userId: ctx.userId, kundliId: ctx.kundliId };

  // doc 71: one pack for every card this run may read, cached once; the board's cards in small groups, the rest after
  const grouped = deps.groupPack ?? isCardsGroupPackEnabled();
  let pack: CardPack | null = null;
  let packCache: Promise<string | null> = Promise.resolve(null);
  let batch: ReturnType<typeof groupBatcher> | null = null;
  const sectionsAll = i.sections as Partial<Record<SelfCardId, readonly string[]>>;
  if (grouped) {
    pack = buildCardPack({ ctx, cards: out.order, frame: i.frame, frameText: frameRender.text, frameKeys: frameRender.keys, prefix: i.prefix, ledger: i.ledger, slices: i.slices, portrait: i.portrait, answers: i.answers });
    packCache = (deps.ensureCache ?? ensurePromptCache)(i.model, pack.system, pack.text, owner).catch(() => null);
  }
  const runGroup = async (cards: SelfCardId[], call: string) => {
    const cacheName = await packCache;
    return readCardGroup(
      { prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed },
      { ctx, pack: pack!, cacheName, cards, boardTitles: titles, sections: sectionsAll, frame: i.frame, dates: i.dates, model: i.model, call },
    );
  };

  const one = async (id: SelfCardId): Promise<void> => {
    if (done.has(id)) return;
    done.add(id);
    const def = cardDef(id)!;
    if (spent() >= cap) {
      out.capReached = true;
      out.results.push({ card: id, status: 'skipped_cap', content: null, timings: [], issues: [], costUsd: 0 });
      await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, now, (d) => {
        if (d.cards[id]?.state === 'queued') delete d.cards[id];
        d.capReached = true;
      });
      return;
    }
    await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, now, (d) => {
      d.cards[id] = { state: 'reading', at: new Date().toISOString() };
    });
    const sections = (i.sections[id] ?? ['line', 'year', 'stretch', 'confirm']) as PersonalizerV3Input['sections'][SelfCardId];
    const key = cardStoreKey({
      card: id,
      clock: i.frame.clock,
      frameHash,
      ledgerHash,
      prefixHash: i.prefix.hash,
      profileHash: ctx.sub.profile?.hash ?? '-',
      portraitHash,
      sectionsHash: shortHash(canonicalJson(sections ?? null)),
      confirmHash: ctx.stamps.confirmHash ?? '-',
      promptHash: `${pHash}.${promptHash(cardBriefPrompt(id))}${grouped ? `.g${promptHash(CARD_GROUP_PROMPT)}` : ''}`,
    });
    const timings: SelfV2AgentTiming[] = [];
    const issues: ValidationIssue[] = [];
    let status: CardRunResult['status'] = 'failed';
    let content: SelfV3CardContent | null = null;
    let oracleCard: StoredCardReading['oracle'] | null = null;
    try {
      const stored = await withTechniqueOutput<StoredCardReading | null>(
        deps.prisma,
        {
          technique: CARD_READING_TECHNIQUE,
          kundliId: ctx.kundliId,
          digestVersion: key,
          context: { now, runningPeriod: { from: new Date(`${nowSpan.from}T00:00:00Z`), to: new Date(`${nowSpan.to}T00:00:00Z`) } },
          agentId: 'self.card.oracle',
          userId: ctx.userId,
          charts: [{ type: 'pressure_inventory', variant: `system=${i.frame.clock}` }],
          forceRefresh: Boolean(deps.force),
        },
        async () => {
          if (batch) {
            const g = await batch.read(id);
            timings.push(...g.timings);
            issues.push(...g.issues);
            const gc = g.result.oracle && g.result.personal ? withClocks(cardContent(g.result.oracle, g.result.personal, i.frame), i.frame) : null;
            if (!gc || !g.result.oracle || !g.result.personal) return { value: null, skipStore: true, summary: { card: id, status: g.result.oracle ? 'personalizer_failed' : 'oracle_failed' } };
            return { value: { key, card: id, content: gc, oracle: g.result.oracle, personal: g.result.personal, ledgerHash, frameHash }, skipStore: false, summary: { card: id, status: 'grouped', spans: gc.spans.length } };
          }
          const matterSlices = i.slices.filter((s) => def.matters.some((m) => s.id === `matter.${m}`));
          const oracle = await readCardOracle(
            { prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed },
            { ctx, card: id, matters: def.matters, board: titles, frame: i.frame, frameText: frameRender.text, frameKeys: frameRender.keys, prefix: i.prefix, ledger: i.ledger, matterSlices, dates: i.dates, answers: i.answers, model: i.model, cacheOwner: owner },
          );
          timings.push(...oracle.calls);
          issues.push(...oracle.issues);
          if (!oracle.card) return { value: null, skipStore: true, summary: { card: id, status: 'oracle_failed' } };
          const pInput: PersonalizerV3Input = { profile: { ...ctx.sub.profile! }, portrait: i.portrait, sections: { [id]: sections } as PersonalizerV3Input['sections'] };
          const system = promptText(SELF_V3_PERSONALIZER_PROMPT);
          const pcall = personalizerV3Call(ctx, `card.${id}.personalizer`, [oracle.card], spanDates, pInput, system, i.model);
          const repair = (cards: Parameters<typeof personalizerV3Call>[2], note: string) => personalizerV3Call(ctx, `card.${id}.personalizer.repair`, cards, spanDates, pInput, system, i.model, note);
          const personal = await runPersonalizerV3({ prisma: deps.prisma, callGemini: deps.callGemini, informUsed: deps.informUsed, agentId: CARD_PERSONALIZER_AGENT, technique: CARD_READING_TECHNIQUE }, ctx, [pcall], pInput, i.dates, repair);
          timings.push(...personal.calls);
          issues.push(...personal.issues);
          const pc = personal.cards[id];
          const c = pc ? withClocks(cardContent(oracle.card, pc, i.frame), i.frame) : null;
          if (!c || !pc) return { value: null, skipStore: true, summary: { card: id, status: 'personalizer_failed' } };
          return { value: { key, card: id, content: c, oracle: oracle.card, personal: pc, ledgerHash, frameHash }, skipStore: false, summary: { card: id, status: oracle.status, spans: c.spans.length } };
        },
      );
      if (stored.value) {
        content = stored.value.content;
        oracleCard = stored.value.oracle;
        status = stored.cached ? 'cached' : 'ok';
      }
    } catch (e) {
      issues.push({ stage: 'oracle', area: id, check: 'call_failed', message: `${id}: ${String((e as Error).message ?? e).slice(0, 200)}`, callId: null });
    }
    const costUsd = round6(timings.reduce((n, x) => n + x.costUsd, 0));
    out.spentUsd = round6(out.spentUsd + costUsd);
    out.timings.push(...timings);
    out.issues.push(...issues);
    if (content) out.cards[id] = content;
    out.results.push({ card: id, status, content, oracle: oracleCard, timings, issues, costUsd });
    await updateCardsState(deps.prisma, ctx.userId, ctx.kundliId, now, (d) => {
      d.cards[id] = content ? { state: 'done', at: new Date().toISOString() } : { state: 'failed', at: new Date().toISOString(), error: issues.slice(0, 2).map((x) => x.message).join('; ').slice(0, 300) || 'not read' };
      d.spentUsd = round6(d.spentUsd + costUsd);
    });
  };

  try {
    if (grouped) {
      // the board first, all at once in small groups; then the rest in larger groups (doc 71 §12)
      const phase = async (ids: SelfCardId[], size: number, label: string) => {
        const b = groupBatcher(runGroup, out.order, ids, size, label);
        batch = b;
        await pool(ids, ids.length, async (id) => {
          await one(id);
          b.settle(id);
        });
      };
      await phase(order.first, deps.groupSizeBoard ?? getCardsGroupSizeBoard(), 'board');
      await phase(order.rest, deps.groupSizeRest ?? getCardsGroupSizeRest(), 'rest');
    } else {
      await pool(order.first, deps.boardParallel ?? getCardsBoardParallel(), one);
      await pool(order.rest, deps.restParallel ?? getCardsRestParallel(), one);
    }
    // cards queued while this ran (added to the board, or Try again) go next
    for (let round = 0; round < 3; round++) {
      const later = await readCardsState(deps.prisma, ctx.kundliId, now);
      const more = (Object.entries(later.cards) as Array<[SelfCardId, { state: string }]>).filter(([id, e]) => e.state === 'queued' && !done.has(id)).map(([id]) => id);
      if (!more.length) break;
      // a card added after the pack was built is not in it: those go the one-card way
      const b = grouped && more.every((id) => pack!.allowed[id]) ? groupBatcher(runGroup, [...out.order, ...more], more, deps.groupSizeBoard ?? getCardsGroupSizeBoard(), 'later') : null;
      batch = b;
      await pool(more, b ? more.length : (deps.restParallel ?? getCardsRestParallel()), async (id) => {
        await one(id);
        b?.settle(id);
      });
    }
  } catch (e) {
    out.issues.push({ stage: 'oracle', area: null, check: 'call_failed', message: `cards: ${String((e as Error).message ?? e).slice(0, 200)}`, callId: null });
  }
  return out;
}

/** The card's spans with "n of m clocks agree" and the clocks for Chart details (copied from the frame). */
export function withClocks(c: SelfV3CardContent | null, frame: YearFrameV3): SelfV3CardContent | null {
  if (!c) return null;
  return {
    ...c,
    spans: c.spans.map((s) => {
      const fs = frame.spans.find((x) => x.id === s.span);
      if (!fs) return s;
      return {
        ...s,
        held: fs.held !== false,
        agreement: { agree: fs.agree, of: fs.of },
        clocks: fs.clocks.map((k) => ({ system: k.system, label: clockLabel(k.system), tone: k.tone, agrees: fs.held !== false && k.tone === fs.tone })),
      };
    }),
  };
}
