/**
 * Layer 4 of doc 70 §4.1: one Oracle call per card. Every card call shares one cached prefix with the clock readers
 * (the common system prompt plus natal.core, sky.window, year.tp and frame); its uncached part is small: the card role,
 * the card brief, the titles of the cards on the board ("you write only this one"), the year frame with its held tones,
 * the agreed ledger cells and the dated rows of the card's matters, and the person's answers.
 *
 * The validator is the v3 Oracle's (`checkOracleCard`: every span once with the frame's tone, heavy never build, keys
 * and dates from the input, a knot and a gift) plus the ledger: a span that has ledger cells for this card cites one of
 * them; `build` needs a confirmed or leaning light or mixed cell of the card in that span, or a held light span. A failed
 * card is re-asked once, alone. Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import type { AgreedLedger, LedgerCell } from '../clocks/types.js';
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { timingOf } from '../self/v2/oracle.js';
import { normaliseEvidenceKey, promptText } from '../self/v2/slices.js';
import type { SelfBuildContext, SelfV2AgentTiming, ValidationIssue } from '../self/v2types.js';
import { checkOracleCard, oracleV3Schema, parseJson } from '../self/v3/oracle.js';
import type { CardMatter, OracleCardV3, SelfCardId, YearFrameV3 } from '../self/v3/types.js';
import { cmp } from '../slices/render.js';
import { cardMatterRows, frameRange } from '../slices/trim.js';
import type { RenderedSlice } from '../slices/types.js';
import { CARD_ORACLE_AGENT, CARD_ORACLE_PROMPT, CARD_READING_TECHNIQUE, cardBriefPrompt } from './types.js';

export const CARD_ORACLE_TIMEOUT_MS = 45_000;
/**
 * One card's document: the replay's 23 card calls wrote 979 to 1,466 tokens, 0 thought tokens reported at `low`.
 * 4,096 bounds output and thought together (they share the cap on Gemini 3.x); the three-card v3 Oracle keeps its 8,000.
 */
export const CARD_ORACLE_MAX_OUTPUT_TOKENS = 4_096;

/** the agreed ledger cells of the card's matters, in span then matter order */
export function cardCells(ledger: AgreedLedger | null, matters: readonly CardMatter[]): LedgerCell[] {
  if (!ledger) return [];
  const want = new Set<string>(matters);
  return ledger.cells.filter((c) => want.has(c.matter));
}

/** The ledger block a card reads: one line per cell with its status as counted, the words, and its keys. */
export function renderCardLedger(cells: readonly LedgerCell[]): { text: string; keys: string[] } {
  const keys = new Set<string>();
  const L = ['AGREED LEDGER (this card\'s matters; the status is counted in code and final)'];
  for (const c of cells) {
    keys.add(c.id);
    for (const k of c.evidence) keys.add(k);
    const words = c.sentence ? ` "${c.sentence}"` : c.sides?.length ? ` split: ${c.sides.map((s) => `${s.tone} (${s.clocks.join(', ')}): ${s.restsOn}`).join(' | ')}` : '';
    L.push(`{${c.id}} status=${c.status} tone=${c.tone ?? 'none'} agree=${c.agree}/${c.of}${words} evidence ${c.evidence.map((k) => `{${k}}`).join(' ')}`);
  }
  if (!cells.length) L.push('(no cells for this card\'s matters)');
  return { text: L.join('\n'), keys: [...keys].sort(cmp) };
}

export interface CardOracleInput {
  ctx: SelfBuildContext;
  card: SelfCardId;
  matters: readonly CardMatter[];
  /** titles of the cards on the person's board, in their order */
  board: readonly string[];
  frame: YearFrameV3;
  /** the frame as the Oracle suffix renders it (tones, held, clocks, YEARS) */
  frameText: string;
  frameKeys: readonly string[];
  /** the shared prefix (natal.core, sky.window, year.tp, frame) and its keys */
  prefix: { text: string; keys: readonly string[] };
  ledger: AgreedLedger | null;
  /** the `matter.<key>` slices of the card's matters */
  matterSlices: readonly RenderedSlice[];
  dates: ReadonlySet<string>;
  answers: string;
  model: string;
  cacheOwner: { userId: string; kundliId: string };
}

export interface CardOracleDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  timeoutMs?: number;
}

export interface CardOracleResult {
  card: OracleCardV3 | null;
  status: 'ok' | 'repaired' | 'failed';
  issues: ValidationIssue[];
  calls: SelfV2AgentTiming[];
}

/** The ledger checks on top of `checkOracleCard`. Pure. */
export function checkAgainstLedger(card: OracleCardV3, frame: YearFrameV3, cells: readonly LedgerCell[]): string[] {
  const problems: string[] = [];
  for (const s of card.spans) {
    const mine = cells.filter((c) => c.span === s.span);
    if (mine.length && !s.evidence.some((k) => mine.some((c) => c.id === k))) problems.push(`span ${s.span}: cites none of this card's ledger cells (${mine.map((c) => c.id).slice(0, 4).join(', ')})`);
    if (s.mode === 'build') {
      const fs = frame.spans.find((x) => x.id === s.span);
      const ground = mine.some((c) => (c.status === 'confirmed' || c.status === 'leaning') && (c.tone === 'light' || c.tone === 'mixed'));
      if (!ground && !(fs?.held !== false && fs?.tone === 'light')) problems.push(`span ${s.span}: build needs a confirmed or leaning light or mixed cell of this card`);
    }
  }
  return problems;
}

/**
 * The card's call, uncached part. The matter rows are cut to the frame and each row is listed once; rows and promise
 * entries already in the shared prefix are named by key only (`cardMatterRows`). The replay's cards read 13.6 k to
 * 24 k uncached tokens each, mostly the three matter slices in full (doc 70 Phase 3 replay fixes).
 */
export function cardInstruction(i: CardOracleInput, cells: readonly LedgerCell[]): { text: string; keys: string[] } {
  const ledger = renderCardLedger(cells);
  const range = frameRange(i.frame);
  const rows = cardMatterRows(i.matterSlices, range, new Set(i.prefix.keys));
  const matter = i.matterSlices.length ? rows.text : '';
  const text = [
    promptText(CARD_ORACLE_PROMPT),
    `CARD BRIEF\n${promptText(cardBriefPrompt(i.card))}`,
    `THE BOARD (the cards this person chose; you write only \`${i.card}\` and leave the others' subjects to them): ${i.board.join('; ') || 'this card only'}`,
    i.frameText,
    ledger.text,
    `MATTER ROWS (${i.matters.join(', ')}; the rows overlapping ${range.from}..${range.to}, each once)\n${matter || '(none stored)'}`,
    `PERSON'S ANSWERS: ${i.answers || 'none'}`,
    `THIS CALL: write only the card \`${i.card}\`. Return the JSON document only.`,
  ].join('\n\n');
  return { text, keys: [...new Set([...ledger.keys, ...(i.matterSlices.length ? rows.keys : []), ...i.frameKeys])] };
}

const keyOf = (k: string): string => normaliseEvidenceKey(k.trim().replace(/^\{|\}$/g, ''));

/**
 * Fixes in code, before any repair call, the two faults behind the replay's repairs (doc 70 Phase 3 replay fixes):
 * - an evidence key the card was never given (the replay's `chapter` cited a row from before the frame): dropped from a
 *   span when the span keeps at least one key it was given, and from the card's and the pattern's lists;
 * - a span that cites none of this card's ledger cells for it while it cites a row one of those cells rests on (the
 *   replay's `mind`, three spans): that cell is added, preferring confirmed, then leaning. The cell's status and tone
 *   are the count's; the span's tone is still checked against the frame, and `build` still needs its ground.
 * Anything else is left to the validator and the repair call. Pure; returns a copy and what it changed.
 */
export function precheckCard(raw: unknown, c: { allowed: ReadonlySet<string>; aliases?: Readonly<Record<string, string>>; cells: readonly LedgerCell[] }): { raw: unknown; notes: string[] } {
  if (!raw || typeof raw !== 'object') return { raw, notes: [] };
  const o = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const notes: string[] = [];
  const known = (k: string) => {
    const n = keyOf(k);
    return c.allowed.has(c.aliases?.[n] ?? c.aliases?.[k] ?? n);
  };
  const strip = (list: unknown, where: string, keepOne: boolean): unknown => {
    if (!Array.isArray(list)) return list;
    const ks = list.filter((x): x is string => typeof x === 'string');
    const bad = ks.filter((k) => !known(k));
    if (!bad.length) return list;
    const good = ks.filter((k) => known(k));
    if (keepOne && !good.length) return list;
    notes.push(`${where}: dropped key(s) not given to this card: ${bad.slice(0, 3).join(', ')}`);
    return good;
  };
  const rank = (x: LedgerCell) => (x.status === 'confirmed' ? 0 : x.status === 'leaning' ? 1 : 2);
  if (Array.isArray(o.spans)) {
    for (const sp of o.spans as Array<Record<string, unknown>>) {
      if (!sp || typeof sp !== 'object') continue;
      const span = typeof sp.span === 'string' ? sp.span.trim() : '';
      sp.evidence = strip(sp.evidence, `span ${span || '?'}`, true);
      const mine = c.cells.filter((x) => x.span === span);
      if (!Array.isArray(sp.evidence) || !mine.length) continue;
      const cited = new Set((sp.evidence as unknown[]).filter((x): x is string => typeof x === 'string').map(keyOf));
      if (mine.some((x) => cited.has(x.id))) continue;
      // a dated row in common, never a planet or house key alone
      const ground = mine.filter((x) => x.evidence.some((k) => k.startsWith('pressure:') && cited.has(k))).sort((a, b) => rank(a) - rank(b) || cmp(a.id, b.id))[0];
      if (!ground) continue;
      (sp.evidence as unknown[]).push(ground.id);
      notes.push(`span ${span}: cited ${ground.id} (it rests on a row the span cites)`);
    }
  }
  o.evidence = strip(o.evidence, 'card', false);
  if (o.pattern && typeof o.pattern === 'object') {
    const pt = o.pattern as Record<string, unknown>;
    pt.evidence = strip(pt.evidence, 'pattern', true);
  }
  return { raw: o, notes };
}

/** One card: call, validate (v3 checks + ledger), repair once alone. Never throws. */
export async function readCardOracle(deps: CardOracleDeps, i: CardOracleInput): Promise<CardOracleResult> {
  const cells = cardCells(i.ledger, i.matters);
  const instr = cardInstruction(i, cells);
  const allowed = new Set([...i.prefix.keys, ...instr.keys].map(normaliseEvidenceKey));
  const spanIds = i.frame.spans.map((s) => s.id);
  const calls: SelfV2AgentTiming[] = [];
  const issues: ValidationIssue[] = [];
  const limit = deps.timeoutMs ?? CARD_ORACLE_TIMEOUT_MS;
  const ask = async (call: string, extra = ''): Promise<unknown | null> => {
    const t0 = performance.now();
    try {
      const res = await withAgentRun(
        deps.prisma,
        CARD_ORACLE_AGENT,
        {
          userId: i.ctx.userId,
          kundliId: i.ctx.kundliId,
          technique: CARD_READING_TECHNIQUE,
          task: `self.card.oracle ${i.card} ${i.ctx.asOf}`,
          input: { card: i.card, spans: spanIds.length, cells: cells.length, keys: allowed.size },
          charts: [{ type: 'kundli_digest', variant: i.ctx.stamps.digestVersion }, { type: 'pressure_inventory', variant: `system=${i.frame.clock}` }],
        },
        async () => {
          const g = await deps.callGemini({
            model: i.model,
            node: `self.card.oracle.${i.card}${call.endsWith('repair') ? '.repair' : ''}`,
            system: promptText(READER_SYSTEM_PROMPT),
            parts: [i.prefix.text, extra ? `${instr.text}\n\n${extra}` : instr.text],
            thinking: 'low',
            maxOutputTokens: CARD_ORACLE_MAX_OUTPUT_TOKENS,
            timeoutMs: limit,
            cachePrefix: true,
            cacheOwner: i.cacheOwner,
            responseSchema: oracleV3Schema([i.card], spanIds),
          });
          return { value: g, usage: { model: i.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 }, output: { chars: g.text.length } };
        },
      );
      markAgentUsed({ cacheOwner: i.cacheOwner }, deps.informUsed);
      const cut = res.finishReason === 'MAX_TOKENS';
      const parsed = cut ? null : (parseJson(res.text) as { cards?: unknown } | null);
      const list = parsed && Array.isArray(parsed.cards) ? (parsed.cards as unknown[]) : null;
      calls.push(timingOf('self.oracle', call, i.model, res, performance.now() - t0, list ? 'ok' : 'failed'));
      if (!list) issues.push({ stage: 'oracle', area: i.card, check: cut ? 'truncated' : 'json_schema', message: `${i.card}: ${call}: no card document`, callId: call });
      return list?.find((x) => (x as { card?: unknown } | null)?.card === i.card) ?? (list ? null : null);
    } catch (e) {
      calls.push(timingOf('self.oracle', call, i.model, null, performance.now() - t0, 'failed'));
      issues.push({ stage: 'oracle', area: i.card, check: 'call_failed', message: `${i.card}: ${call}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: call });
      return null;
    }
  };
  const check = (got: unknown | null): { card: OracleCardV3 | null; problems: string[] } => {
    if (!got) return { card: null, problems: ['not returned'] };
    const pre = precheckCard(got, { allowed, aliases: i.frame.aliases ?? {}, cells });
    for (const n of pre.notes) issues.push({ stage: 'oracle', area: i.card, check: 'other', message: `${i.card}: precheck: ${n}`.slice(0, 300), callId: null });
    const raw = pre.raw;
    const r = checkOracleCard(raw, { frame: i.frame, allowedKeys: allowed, dates: i.dates, expected: [i.card], aliases: i.frame.aliases ?? {} });
    for (const n of r.notes) issues.push({ stage: 'oracle', area: i.card, check: 'other', message: `${i.card}: ${n}`.slice(0, 300), callId: null });
    if (!r.card) return { card: null, problems: r.problems };
    const lp = checkAgainstLedger(r.card, i.frame, cells);
    return lp.length ? { card: null, problems: lp } : { card: r.card, problems: [] };
  };
  const note = (call: string, problems: string[]) => {
    for (const p of problems) issues.push({ stage: 'oracle', area: i.card, check: p.includes('evidence') || p.includes('ledger') ? 'unknown_evidence_key' : p.includes('date') ? 'date_not_stored' : p === 'not returned' ? 'missing_area' : 'other', message: `${i.card}: ${p}`.slice(0, 300), callId: call });
  };
  const call = `card.${i.card}`;
  const first = check(await ask(call));
  if (first.card) return { card: first.card, status: 'ok', issues, calls };
  note(call, first.problems);
  const repairCall = `${call}.repair`;
  const second = check(await ask(repairCall, `REPAIR: this card failed the checks. Write it again and fix exactly this:\n- ${first.problems.slice(0, 6).join('\n- ')}`));
  if (second.card) return { card: second.card, status: 'repaired', issues, calls };
  note(repairCall, second.problems);
  return { card: null, status: 'failed', issues, calls };
}
