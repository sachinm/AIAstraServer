/**
 * Card groups on one cached pack (docs/reading-engine/71 §4.2, §4.3, §12). With CARDS_GROUP_PACK=1 the cards are not
 * read one call each: one pack per kundli and day holds everything every card needs, each row written once, and is
 * cached once; each call then sends only a short request naming a few cards, and writes for each card the Oracle object
 * and then the Personalizer face. The board's cards go first in small groups (CARDS_GROUP_SIZE_BOARD, default 3: fast);
 * the cards not on the board follow in larger groups (CARDS_GROUP_SIZE_REST, default 6: fewer reads of the pack).
 *
 * Every card is checked exactly as on the one-card path: `precheckCard`, `checkOracleCard` and `checkAgainstLedger` on
 * the Oracle object, `checkPersonalCard` on the face. The cards that fail are asked again once, together, with their
 * reasons. Never throws.
 *
 *   system  the reader system prompt, then the role library (CARD ORACLE, PERSONALIZER, CARD GROUP)
 *   pack    the shared prefix (natal core, sky, year, frame), the year frame, the person, every card brief, each card's
 *           ledger cells, the matter rows (each row once, under the first matter that has it), the person's answers
 *   request TODAY, the board's titles, the cards of this call with their matters and sections (uncached)
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import type { AgreedLedger, LedgerCell } from '../clocks/types.js';
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { timingOf } from '../self/v2/oracle.js';
import { portraitLines } from '../self/v2/portrait.js';
import { roleWordsFor, type TextCheckContext } from '../self/v2/personalizerValidate.js';
import { seniorStageWordsFor } from '../self/v2/profileFit.js';
import { claimKey, normaliseEvidenceKey, profileLines, promptText, shortHash } from '../self/v2/slices.js';
import type { PersonPortrait, SelfBuildContext, SelfV2AgentTiming, ValidationIssue } from '../self/v2types.js';
import { cardDef } from '../self/v3/cards.js';
import { checkOracleCard, oracleV3Schema, parseJson } from '../self/v3/oracle.js';
import { checkPersonalCard, personalizerV3Schema, SELF_V3_PERSONALIZER_PROMPT, v3DateFrame } from '../self/v3/personalizer.js';
import type { OracleCardV3, PersonalCardV3, SelfCardId, SelfSectionId, YearFrameV3 } from '../self/v3/types.js';
import { cmp } from '../slices/render.js';
import { cardMatterRows, frameRange } from '../slices/trim.js';
import type { RenderedSlice } from '../slices/types.js';
import { cardCells, checkAgainstLedger, precheckCard, renderCardLedger } from './oracle.js';
import { CARD_ORACLE_AGENT, CARD_ORACLE_PROMPT, CARD_READING_TECHNIQUE, cardBriefPrompt } from './types.js';

export const CARD_GROUP_PROMPT = 'cards/group';
export const CARD_GROUP_TIMEOUT_MS = 90_000;
/** a card writes about 1,000 to 1,500 tokens (Phase 0: 4,700 to 5,400 for five or six); room for six and a repair */
export const CARD_GROUP_MAX_OUTPUT_TOKENS = 16_000;
const DEFAULT_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm'];

export interface CardPackInput {
  ctx: SelfBuildContext;
  /** every card the pack serves (the board and the rest), in reading order */
  cards: readonly SelfCardId[];
  frame: YearFrameV3;
  frameText: string;
  frameKeys: readonly string[];
  prefix: { text: string; keys: readonly string[] };
  ledger: AgreedLedger | null;
  slices: readonly RenderedSlice[];
  portrait: PersonPortrait | null;
  answers: string;
}

export interface CardPack {
  system: string;
  text: string;
  hash: string;
  /** per card: the ledger cells it reads and the keys it may cite (as on the one-card path) */
  cells: Partial<Record<SelfCardId, LedgerCell[]>>;
  allowed: Partial<Record<SelfCardId, Set<string>>>;
}

/** The role library: one system instruction for every call on the pack (a cache holds one). */
export function cardPackSystem(): string {
  return [
    promptText(READER_SYSTEM_PROMPT),
    '# ROLE LIBRARY. Each request names the role to take. Follow only that role.',
    `## ROLE: CARD ORACLE\n${promptText(CARD_ORACLE_PROMPT)}`,
    `## ROLE: PERSONALIZER\n${promptText(SELF_V3_PERSONALIZER_PROMPT)}`,
    `## ROLE: CARD GROUP\n${promptText(CARD_GROUP_PROMPT)}`,
  ].join('\n\n');
}

/** Pure. Same input, same bytes: the cache key is the hash of system and text. */
export function buildCardPack(i: CardPackInput): CardPack {
  const range = frameRange(i.frame);
  const ids = [...new Set(i.cards)].filter((id) => cardDef(id));
  const p = i.ctx.sub.profile!;
  const L: string[] = [i.prefix.text, i.frameText];
  L.push(
    '# THE PERSON',
    ...profileLines(p),
    `declined (never mention): ${p.declined.length ? p.declined.join(', ') : 'none'}`,
    `last answers: ${p.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`,
    ...(i.portrait ? portraitLines(i.portrait) : ['## PORTRAIT: not built; write from THE PERSON only']),
    '# SPAN DATES',
    ...i.frame.spans.map((s) => `- ${s.id}: ${s.from} to ${s.to}`),
  );
  L.push('# CARD BRIEFS');
  for (const id of ids) L.push(`## CARD BRIEF ${id}\n${promptText(cardBriefPrompt(id))}`);
  const cells: CardPack['cells'] = {};
  const allowed: CardPack['allowed'] = {};
  L.push('# CARD CELLS (each card\'s agreed ledger cells; the status is counted in code and final)');
  for (const id of ids) {
    const c = cardCells(i.ledger, cardDef(id)!.matters);
    cells[id] = c;
    L.push(`## CARD CELLS ${id}\n${renderCardLedger(c).text}`);
  }
  // matter rows: each matter once, each row once (a row written under an earlier matter is named by key only)
  const matters = [...new Set(ids.flatMap((id) => cardDef(id)!.matters as readonly string[]))].sort(cmp);
  const written = new Set<string>(i.prefix.keys);
  const keysOfMatter = new Map<string, string[]>();
  L.push(`# MATTER ROWS (the rows overlapping ${range.from}..${range.to}; each row once)`);
  for (const m of matters) {
    const s = i.slices.filter((x) => x.id === `matter.${m}`);
    if (!s.length) {
      L.push(`## MATTER ${m}\n(none stored)`);
      keysOfMatter.set(m, []);
      continue;
    }
    const rows = cardMatterRows(s, range, written);
    // the keys a card on this matter may cite: as on the one-card path, every row of the matter in the frame
    keysOfMatter.set(m, cardMatterRows(s, range, new Set(i.prefix.keys)).keys);
    for (const k of rows.keys) written.add(k);
    L.push(`## MATTER ${m}\n${rows.text || '(no rows in the frame)'}`);
  }
  L.push(`# PERSON'S ANSWERS: ${i.answers || 'none'}`);
  for (const id of ids) {
    const led = renderCardLedger(cells[id] ?? []);
    const ks = [...i.prefix.keys, ...i.frameKeys, ...led.keys, ...cardDef(id)!.matters.flatMap((m) => keysOfMatter.get(m) ?? [])];
    allowed[id] = new Set(ks.map(normaliseEvidenceKey));
  }
  const system = cardPackSystem();
  const text = L.join('\n\n');
  return { system, text, hash: shortHash(`${system}\n${text}`), cells, allowed };
}

/** The uncached request: the cards of this call, their matters and sections, the board's titles. */
export function groupRequest(asOf: string, cards: readonly SelfCardId[], boardTitles: readonly string[], sections: Partial<Record<SelfCardId, readonly string[]>>, repair = ''): string {
  return [
    ...(repair ? [repair] : []),
    'ROLE: CARD GROUP.',
    `TODAY: ${asOf}`,
    `THE BOARD (the cards this person chose; each card leaves the others' subjects to them): ${boardTitles.join('; ') || 'none chosen'}`,
    'WRITE THESE CARDS, in this order:',
    ...cards.map((id) => `- ${id}: matters ${cardDef(id)!.matters.join(', ')}; sections ${(sections[id] ?? DEFAULT_SECTIONS).join(', ')}`),
    'Return the JSON document only.',
  ].join('\n');
}

const withoutCard = (item: Record<string, unknown>): Record<string, unknown> => {
  const props = { ...(item.properties as Record<string, unknown>) };
  delete props.card;
  return { ...item, properties: props, required: ((item.required as string[]) ?? []).filter((r) => r !== 'card') };
};

export function groupSchema(cards: readonly SelfCardId[], spanIds: readonly string[]): Record<string, unknown> {
  const o = (oracleV3Schema(cards, spanIds) as { properties: { cards: { items: Record<string, unknown> } } }).properties.cards.items;
  const f = (personalizerV3Schema(cards) as { properties: { cards: { items: Record<string, unknown> } } }).properties.cards.items;
  return {
    type: 'OBJECT',
    properties: {
      cards: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { card: { type: 'STRING', enum: [...cards] }, oracle: withoutCard(o), face: withoutCard(f) },
          required: ['card', 'oracle', 'face'],
        },
      },
    },
    required: ['cards'],
  };
}

export interface GroupCardResult {
  oracle: OracleCardV3 | null;
  personal: PersonalCardV3 | null;
  problems: string[];
}

export interface CardGroupDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  timeoutMs?: number;
}

export interface CardGroupInput {
  ctx: SelfBuildContext;
  pack: CardPack;
  /** the cache the pack went up as (logged on the run), or null when the call goes uncached */
  cacheName: string | null;
  cards: readonly SelfCardId[];
  boardTitles: readonly string[];
  sections: Partial<Record<SelfCardId, readonly string[]>>;
  frame: YearFrameV3;
  dates: ReadonlySet<string>;
  model: string;
  call: string;
}

export interface CardGroupResult {
  cards: Partial<Record<SelfCardId, GroupCardResult>>;
  timings: SelfV2AgentTiming[];
  issues: ValidationIssue[];
}

/** One group: one call, then one repair call for the cards that failed. Never throws. */
export async function readCardGroup(deps: CardGroupDeps, i: CardGroupInput): Promise<CardGroupResult> {
  const out: CardGroupResult = { cards: {}, timings: [], issues: [] };
  const spanIds = i.frame.spans.map((s) => s.id);
  const p = i.ctx.sub.profile!;
  const textCheck: TextCheckContext = { gender: p.gender, dates: v3DateFrame(i.dates), roleWords: roleWordsFor(p.facts), stageWords: seniorStageWordsFor(p) };
  const owner = { userId: i.ctx.userId, kundliId: i.ctx.kundliId };

  const ask = async (call: string, cards: readonly SelfCardId[], repair: string): Promise<unknown[] | null> => {
    const t0 = performance.now();
    const request = groupRequest(i.ctx.asOf, cards, i.boardTitles, i.sections, repair);
    try {
      const res = await withAgentRun(
        deps.prisma,
        CARD_ORACLE_AGENT,
        {
          userId: i.ctx.userId,
          kundliId: i.ctx.kundliId,
          technique: CARD_READING_TECHNIQUE,
          task: `self.card.group ${cards.join(',')} ${i.ctx.asOf}`,
          input: { cards, packHash: i.pack.hash, cache: i.cacheName, repair: Boolean(repair) },
          charts: [{ type: 'kundli_digest', variant: i.ctx.stamps.digestVersion }, { type: 'pressure_inventory', variant: `system=${i.frame.clock}` }],
        },
        async () => {
          const g = await deps.callGemini({
            model: i.model,
            node: `self.card.group.${call}`,
            system: i.pack.system,
            parts: [i.pack.text, request],
            fullCache: { system: i.pack.system, prefix: i.pack.text, suffix: [request] },
            cacheOwner: owner,
            thinking: 'low',
            maxOutputTokens: CARD_GROUP_MAX_OUTPUT_TOKENS,
            timeoutMs: deps.timeoutMs ?? CARD_GROUP_TIMEOUT_MS,
            responseSchema: groupSchema(cards, spanIds),
          });
          return { value: g, usage: { model: i.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 }, output: { chars: g.text.length } };
        },
      );
      markAgentUsed({ cacheOwner: owner }, deps.informUsed);
      const cut = res.finishReason === 'MAX_TOKENS';
      const parsed = cut ? null : (parseJson(res.text) as { cards?: unknown } | null);
      const list = parsed && Array.isArray(parsed.cards) ? (parsed.cards as unknown[]) : null;
      out.timings.push(timingOf('self.oracle', call, i.model, res, performance.now() - t0, list ? 'ok' : 'failed'));
      if (!list) out.issues.push({ stage: 'oracle', area: null, check: cut ? 'truncated' : 'json_schema', message: `${call}: no card document`, callId: call });
      return list;
    } catch (e) {
      out.timings.push(timingOf('self.oracle', call, i.model, null, performance.now() - t0, 'failed'));
      out.issues.push({ stage: 'oracle', area: null, check: 'call_failed', message: `${call}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: call });
      return null;
    }
  };

  const check = (id: SelfCardId, entry: Record<string, unknown> | undefined, call: string): GroupCardResult => {
    if (!entry) return { oracle: null, personal: null, problems: ['not returned'] };
    const cells = i.pack.cells[id] ?? [];
    const allowed = i.pack.allowed[id] ?? new Set<string>();
    const pre = precheckCard({ ...((entry.oracle as object) ?? {}), card: id }, { allowed, aliases: i.frame.aliases ?? {}, cells });
    for (const n of pre.notes) out.issues.push({ stage: 'oracle', area: id, check: 'other', message: `${id}: precheck: ${n}`.slice(0, 300), callId: call });
    const r = checkOracleCard(pre.raw, { frame: i.frame, allowedKeys: allowed, dates: i.dates, expected: [id], aliases: i.frame.aliases ?? {} });
    if (!r.card) return { oracle: null, personal: null, problems: r.problems.map((x) => `oracle: ${x}`) };
    const lp = checkAgainstLedger(r.card, i.frame, cells);
    if (lp.length) return { oracle: null, personal: null, problems: lp.map((x) => `oracle: ${x}`) };
    const f = checkPersonalCard({ ...((entry.face as object) ?? {}), card: id }, r.card, textCheck, (i.sections[id] ?? DEFAULT_SECTIONS) as readonly SelfSectionId[]);
    for (const n of f.notes) out.issues.push({ stage: 'personalizer', area: id, check: 'other', message: `${id}: ${n}`.slice(0, 300), callId: call });
    if (!f.card) return { oracle: r.card, personal: null, problems: f.problems.map((x) => `face: ${x}`) };
    return { oracle: r.card, personal: f.card, problems: [] };
  };

  const take = (list: unknown[] | null, cards: readonly SelfCardId[], call: string) => {
    for (const id of cards) {
      const entry = (list ?? []).find((x) => (x as { card?: unknown } | null)?.card === id) as Record<string, unknown> | undefined;
      const r = check(id, entry, call);
      out.cards[id] = r;
      for (const pr of r.problems) out.issues.push({ stage: pr.startsWith('face') ? 'personalizer' : 'oracle', area: id, check: pr === 'not returned' ? 'missing_area' : 'other', message: `${id}: ${pr}`.slice(0, 300), callId: call });
    }
  };

  take(await ask(i.call, i.cards, ''), i.cards, i.call);
  const failed = i.cards.filter((id) => !out.cards[id]?.personal);
  if (failed.length) {
    const note = ['REPAIR: these cards failed the checks. Write them again and fix exactly this; keep everything else the same:', ...failed.map((id) => `- ${id}: ${(out.cards[id]?.problems ?? []).slice(0, 4).join('; ')}`)].join('\n');
    const call = `${i.call}.repair`;
    take(await ask(call, failed, note), failed, call);
  }
  return out;
}

/** Splits the cards into groups of `size`, in order. */
export function splitGroups<T>(xs: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let k = 0; k < xs.length; k += n) out.push(xs.slice(k, k + n));
  return out;
}
