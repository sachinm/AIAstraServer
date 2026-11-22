/**
 * The natal context (plan "retire the v2 Self reading", server step 1; docs/techniques/09 §3): the stable chart text every
 * reading agent reads as its cached first part. Moved here unchanged from `self/v2/slices.ts` (the v2 Oracle's prefix
 * builder), so the prefix is byte-identical and no card store key (`pre=`) or card Oracle reuse key moves; the old path
 * re-exports everything (tests/unit/reading/slices/natalPrefixPin.test.ts pins the bytes).
 *
 * - prefix: the rasi and varga packs (D1 and divisional houses, planets, points, yogas), the whole S4 promise ledger and
 *   the READING FRAME (clock, periods, windows summary, risk top 12, promise top 8, mind/body/presence/year facts, area
 *   briefs): all fixed by the sub-techniques and the briefs before any agent runs; no date stamp, no finding, no confirm.
 * - suffix (the v2 Oracle's): TODAY, the family findings and the confirms.
 *
 * Selection and formatting only: every value is an engine row carried through by id. Imports nothing from `self/v2`,
 * `families` or `slices/prepare` (no import cycle).
 */
import { createHash } from 'node:crypto';
import { modelFor } from '../llm/models.js';
import { PROMPTS } from '../prompts/generated.js';
import type { SelfFamilyAgentId, SelfFamilyPack } from '../self/oracle.js';
import { clockLabel } from '../self/words.js';
import type { AreaBrief, OracleInput, PreparedAgentSlice, PromiseEntry, PromiseLedger, RiskRow, SelfBuildContext, WindowRef, WindowSet } from '../self/v2types.js';

/**
 * The system prompt the natal slice is warmed under (the v2 Oracle's). Its text is part of `prefixHash`, the legacy v3
 * key's `pre=`; the card keys read only the prefix text (`natal.core`).
 */
export const SELF_V2_ORACLE_PROMPT = 'oracle/self-areas-v2';
/** Gemini's minimum prefix for an explicit cache; below it a region is refused */
export const MIN_CACHE_TOKENS = 1024;
export const ORACLE_RISK_TOP = 12;
export const ORACLE_PROMISE_TOP = 8;

/**
 * chars / 4: a lower bound on the provider's count, used only to pad a prefix past the cache minimum (it never pads
 * too little). Not the Lab's estimate: on these slices the provider counts about twice as many tokens.
 */
export const estTokens = (s: string): number => Math.ceil(s.length / 4);
/**
 * Characters per provider token on the slices (keys, ids, numbers and short tags), measured on the doc 66 replay of
 * 2026-11-09: the Oracle's ≈ 74.6 k chars (chars/4 = 18.7 k) were 34.6 k provider tokens with the system prompt, about
 * 2.2 chars per token. Gemini's countTokens is not wired in the client (docs/TODOS.md).
 */
export const PROVIDER_CHARS_PER_TOKEN = 2.2;
/** the Lab's estimate of the provider's token count before a call */
export const estProviderTokens = (s: string): number => Math.ceil(s.length / PROVIDER_CHARS_PER_TOKEN);
export const shortHash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 24);

/** The system prompt of an agent, by bundle name (empty when the bundle has not been regenerated). */
export const promptText = (name: string): string => PROMPTS[name] ?? '';
/** The hash of one prompt's text: a change to that prompt, and only that one, changes the store key. */
export const promptHash = (name: string): string => shortHash(promptText(name));

/** Records each key it formats, so a slice knows exactly which keys it carries. */
export class KeyBook {
  readonly keys = new Set<string>();
  k(key: string | null | undefined): string {
    if (!key) return '';
    const k = normaliseEvidenceKey(key);
    this.keys.add(k);
    return `{${k}}`;
  }
  ks(keys: readonly (string | null | undefined)[]): string {
    return keys.map((x) => this.k(x)).filter(Boolean).join(' ');
  }
}

/** a brief claim id as the Oracle cites it: `claim:<id>` (doc 65 Phase A: the prefix is part of the id) */
export const claimKey = (id: string): string => (id.startsWith('claim:') ? id : `claim:${id}`);
/** a risk row id as an evidence key: the S5 ids already carry `risk:` (doc 66 replay failure 10: `risk:risk:`) */
export const riskKey = (id: string): string => (id.startsWith('risk:') ? id : `risk:${id}`);
/** a promise entry id as an evidence key: the S4 ids already carry `promise:` */
export const promiseKey = (id: string): string => (id.startsWith('promise:') ? id : `promise:${id}`);
/**
 * One prefix per evidence key: `risk:risk:x` → `risk:x`, `promise:promise:x` → `promise:x` (and the same for claim and
 * window). Applied when a key is written and when a stored document is read, so builds stored before the fix match.
 */
export const normaliseEvidenceKey = (key: string): string => key.replace(/^(risk|promise|claim|window):(?:\1:)+/, '$1:');

export function preparedSlice(
  agent: PreparedAgentSlice['agent'],
  ctx: Pick<SelfBuildContext, 'userId' | 'kundliId'>,
  prefix: string,
  suffix: string,
  model: string,
  system: string,
  keys: Iterable<string>,
): PreparedAgentSlice {
  return {
    agent,
    prefix,
    suffix,
    prefixHash: shortHash(`${agent}|${model}|${system}|${prefix}`),
    cacheOwner: { userId: ctx.userId, kundliId: ctx.kundliId },
    model,
    system,
    estTokens: { prefix: estProviderTokens(prefix), suffix: estProviderTokens(suffix) },
    keys: [...new Set(keys)],
  };
}

export const windowLine = (book: KeyBook, w: WindowRef): string =>
  `${book.k(`window:${w.rowId}`)} matters=[${w.matters.join(',')}] polarity=${w.polarity} strength=${w.strength} ${w.from}..${w.to}`;

export function promiseLine(book: KeyBook, e: PromiseEntry): string {
  const src = [e.source.yogaId ? `yoga=${e.source.yogaId}` : '', e.source.planet ? `planet=${e.source.planet}` : '', e.source.house != null ? `house=${e.source.house}` : '']
    .filter(Boolean)
    .join(' ');
  return `${book.k(promiseKey(e.id))} ${e.kind} matter=${e.matter} ${src} who=[${e.who.join(',')}] strength=${e.strength}${e.cancels ? ` cancels=${book.k(promiseKey(e.cancels))}` : ''} evidence ${book.ks(e.evidence)}`;
}

/** The S4 ledger in the Oracle's prefix: every entry, stable per digest version. */
export function renderPromiseLedger(book: KeyBook, ledger: PromiseLedger | undefined): string {
  const lines = ['## PROMISE LEDGER (S4: what the chart promises; gift, knot, grace, each with its source row)'];
  for (const e of ledger?.entries ?? []) lines.push(promiseLine(book, e));
  if (!ledger?.entries.length) lines.push('(no entries stored)');
  return lines.join('\n');
}

/** the twelve heaviest risk rows: the ledger's top 3 first, then the engine's strength, then the soonest until */
export function topRisk(rows: readonly RiskRow[], top3: readonly string[], n = ORACLE_RISK_TOP): RiskRow[] {
  const rank = (r: RiskRow) => (top3.includes(r.id) ? top3.indexOf(r.id) : 99);
  return [...rows]
    .sort((a, b) => rank(a) - rank(b) || b.strength - a.strength || (a.until ?? '9999').localeCompare(b.until ?? '9999') || a.id.localeCompare(b.id))
    .slice(0, n);
}

/** the eight strongest promise entries, stable by id */
export function topPromise(entries: readonly PromiseEntry[], n = ORACLE_PROMISE_TOP): PromiseEntry[] {
  return [...entries].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id)).slice(0, n);
}

export const windowsSummary = (w: WindowSet | undefined): OracleInput['windows'] => ({
  asOf: w?.asOf ?? '',
  heaviestNow: w?.heaviestNow ?? null,
  easesAt: w?.easesAt ?? null,
  nextSupportFrom: w?.nextSupportFrom ?? null,
  startedLast12m: w?.startedLast12m ?? [],
  endingNext6m: w?.endingNext6m ?? [],
});

/** The typed Oracle input (doc 66 §4.8), from the build context and the briefs only. */
export function buildOracleInput(ctx: SelfBuildContext, briefs: readonly AreaBrief[], familyFindings: OracleInput['familyFindings'] = []): OracleInput {
  const s = ctx.sub;
  if (!s.clock || !s.periods || !s.mind || !s.body || !s.presence || !s.year) {
    const missing = (['clock', 'periods', 'mind', 'body', 'presence', 'year'] as const).filter((k) => !s[k]);
    throw new Error(`self v2 Oracle input: sub-technique outputs missing (${missing.join(', ')})`);
  }
  return {
    clock: s.clock,
    periods: s.periods,
    windows: windowsSummary(s.windows),
    risk: topRisk(s.risk?.rows ?? [], s.risk?.top3 ?? []),
    promise: topPromise(s.promise?.entries ?? []),
    mind: s.mind,
    body: s.body,
    presence: s.presence,
    year: s.year,
    areaBriefs: [...briefs],
    familyFindings,
    confirms: s.profile?.lastConfirms ?? [],
  };
}

/**
 * The Oracle's cached prefix: the rasi and varga packs and the whole promise ledger (stable per digest version), then,
 * when the input is given, the reading frame (`oracleFrame`): everything the sub-techniques and the briefs fix before
 * any agent runs. No TODAY stamp, no family finding and no confirm in it, so the warm-up (before the family readers)
 * and the three Oracle calls (after them) send it byte for byte.
 */
export function oraclePrefix(
  packs: Record<SelfFamilyAgentId, SelfFamilyPack>,
  ledger: PromiseLedger | undefined,
  input?: OracleInput,
): { text: string; keys: string[] } {
  const book = new KeyBook();
  const frame = input ? oracleFrame(input) : null;
  const text = [
    '# NATAL SLICE (stable per digest version: D1 and divisional houses, planets, points, yogas)',
    packs['family.rasi'].prefix,
    packs['family.varga'].prefix,
    renderPromiseLedger(book, ledger),
    ...(frame ? ['# READING FRAME (the clock, periods, windows, ledgers, facts and briefs of this build)', frame.text] : []),
  ].join('\n\n');
  return { text, keys: [...packs['family.rasi'].keys, ...packs['family.varga'].keys, ...book.keys, ...(frame?.keys ?? [])] };
}

/** The Oracle's variable suffix: the per-build stamp (TODAY), the family findings and the person's confirms. */
export function oracleSuffix(input: OracleInput, asOf: string): { text: string; keys: string[] } {
  const b = new KeyBook();
  const L: string[] = [`TODAY: ${asOf}`];
  L.push('## FAMILY FINDINGS (the five family readers)');
  for (const f of input.familyFindings) L.push(`### ${f.family}`, f.text || '(none)');
  if (!input.familyFindings.length) L.push('(none this build)');
  L.push('## CONFIRMS (the person\'s last answers; a No lowers that claim\'s certainty)');
  for (const cf of input.confirms) L.push(`- ${b.k(claimKey(cf.claimId))} ${cf.answer}${cf.at ? ` (${cf.at.slice(0, 10)})` : ''}`);
  if (!input.confirms.length) L.push('(none)');
  return { text: L.join('\n'), keys: [...b.keys] };
}

/**
 * The reading frame (doc 66 §4.8): the clock, periods, windows summary, risk and promise tops, the mind, body, presence
 * and year facts, and the area briefs. Fixed by the sub-techniques before any agent runs; part of the cached prefix.
 */
export function oracleFrame(input: OracleInput): { text: string; keys: string[] } {
  const b = new KeyBook();
  const L: string[] = [];
  const c = input.clock;
  L.push(
    '## CLOCK (S1)',
    `primary=${c.primary} (${clockLabel(c.primary)}) reason=${c.reason} confirming=[${c.confirming.join(', ')}] applicable=[${c.applicable.join(', ')}] notApplicable=[${c.notApplicable.map((x) => `${x.system}: ${x.reason}`).join('; ')}]`,
  );
  const p = input.periods;
  const span = (label: string, x: typeof p.running | null) => (x ? `${label}: L${x.level} lord=${x.lord} ${x.from}..${x.to} ${b.k(x.evidence)}` : `${label}: none stored`);
  L.push(
    '## PERIODS (S2, the reading clock)',
    span('previous', p.previous),
    span('running', p.running),
    span('next', p.next),
    span('running sub', p.runningSub),
    span('running sub-sub', p.runningSubSub),
    `sub relation to main (engine charter): ${p.subRelation ?? 'not stored'}`,
    `boundaries: ${p.boundaries.map((x) => `${x.date}(L${x.level})`).join(', ') || 'none'}`,
  );
  const w = input.windows;
  L.push(
    '## WINDOWS (S3 summary)',
    `heaviest now: ${w.heaviestNow ? windowLine(b, w.heaviestNow) : 'none'}`,
    `eases at: ${w.easesAt ?? 'not stored'} · next support from: ${w.nextSupportFrom ?? 'not stored'}`,
    'started in the last 12 months:',
    ...w.startedLast12m.map((r) => `- ${windowLine(b, r)}`),
    'ending in the next 6 months:',
    ...w.endingNext6m.map((r) => `- ${windowLine(b, r)}`),
  );
  L.push(`## RISK LEDGER (S5, the ${input.risk.length} heaviest rows: confirm or reject each with evidence; never recompute its dates)`);
  for (const r of input.risk) {
    const from = [r.from.planet ? `planet=${r.from.planet}` : '', r.from.house != null ? `house=${r.from.house}` : '', r.from.yogaId ? `yoga=${r.from.yogaId}` : '', r.from.windowId ? `window=${b.k(`window:${r.from.windowId}`)}` : '', r.from.chart === 'year' ? 'from=the year chart' : '']
      .filter(Boolean)
      .join(' ');
    L.push(
      `${b.k(riskKey(r.id))} matter=${r.matter} what=${r.what} from: ${from || 'n/a'} who=[${r.who.join(',')}] since=${r.since ?? 'n/a'} until=${r.until ?? 'n/a'} polarity=${r.polarity} strength=${r.strength} holds=[${r.holds.map((h) => b.k(promiseKey(h))).join(' ')}] evidence ${b.ks(r.evidence)}`,
    );
  }
  L.push(`## PROMISE (S4, the ${input.promise.length} strongest entries; the whole ledger is in the natal slice)`);
  for (const e of input.promise) L.push(`- ${b.k(promiseKey(e.id))} ${e.kind} ${e.matter} strength=${e.strength}`);
  const m = input.mind;
  L.push(
    '## MIND FACTS (S6: facts only; you name the pattern)',
    `feeling: ${b.ks(m.feeling)}`,
    `thinking: ${b.ks(m.thinking)}`,
    `peace: ${b.ks(m.peace)}`,
    `judgement: ${b.ks(m.judgement)}`,
    ...m.candidatePatterns.map((x) => `candidate pattern: ${x.placement} ${b.ks(x.evidence)}`),
  );
  const bd = input.body;
  L.push(
    '## BODY FACTS (S7)',
    `footing: ${b.ks(bd.footing)}`,
    `wear: ${b.ks(bd.wear)}`,
    `shape: ${b.ks(bd.shape)}`,
    ...bd.liveLords.map((x) => `live lord ${x.lord} on houses [${x.houses.join(',')}] until ${x.until} ${b.k(x.evidence)}`),
    ...bd.liveTransits.map((x) => `live transit ${windowLine(b, x)}`),
    `sensitive passage (engine flag): ${bd.sensitive ? 'yes' : 'no'}`,
  );
  const pr = input.presence;
  L.push(
    '## PRESENCE FACTS (S8, How you come across)',
    `bearing: ${b.ks(pr.bearing)}`,
    `style: ${b.ks(pr.style)}`,
    `adornment: ${b.ks(pr.adornment)}`,
    `face and voice: ${b.ks(pr.face)}`,
    `public polish vs private ease: ${b.ks(pr.publicVsPrivate)}`,
    `best window: ${pr.bestWindow ? `${pr.bestWindow.from}..${pr.bestWindow.to} ${b.k(pr.bestWindow.evidence)}` : 'none stored'}`,
    `live care: ${pr.liveCare ? `${pr.liveCare.lord} until ${pr.liveCare.until} ${b.k(pr.liveCare.evidence)}` : 'none'}`,
  );
  const y = input.year;
  L.push(
    '## YEAR (S9)',
    y.noCoverage
      ? 'no Tithi Pravesha year covers today: the live year line is withheld'
      : `Tithi Pravesha year ${y.from}..${y.to}${y.tpStart ? ` (return ${y.tpStart}${y.tpEnd ? ` to ${y.tpEnd}` : ''})` : ''} year lagna ${b.k(y.yearLagna)} year lord ${b.k(y.yearLord)} short clock ${y.shortClock ? `${y.shortClock.lord} ${y.shortClock.from}..${y.shortClock.to} ${b.k(y.shortClock.evidence)}` : 'none (TP year dasha not bounded to the year)'}`,
    `confirming clock (Varshaphala Mudda, confirms only): ${y.confirmClock ? `${y.confirmClock.lord} ${y.confirmClock.from}..${y.confirmClock.to} ${b.k(y.confirmClock.evidence)}` : 'none'}`,
  );
  L.push('## AREA BRIEFS (Layer 2: the claims each area may stand on)');
  for (const a of input.areaBriefs) {
    L.push(`### ${a.areaId} (horizon ${a.horizon})`);
    for (const cl of a.claims) {
      const range = cl.range === 'always' ? 'always' : `${cl.range.from}..${cl.range.to}`;
      L.push(`- ${b.k(claimKey(cl.id))} ${cl.fact} (${range}) ${b.ks(cl.evidence)}`);
    }
    for (const d of a.dates) L.push(`- date ${d.from}..${d.to} ${d.label}`);
    if (a.ledgerRows.length) L.push(`- risk rows: ${a.ledgerRows.map((id) => b.k(riskKey(id))).join(' ')}`);
    if (a.promiseEntries.length) L.push(`- promise entries: ${a.promiseEntries.map((id) => b.k(promiseKey(id))).join(' ')}`);
  }
  return { text: L.join('\n'), keys: [...b.keys] };
}

/** The Oracle's slice. The prefix does not depend on the family findings, so the warm-up can use it before they exist. */
export function buildOracleSlice(
  ctx: SelfBuildContext,
  packs: Record<SelfFamilyAgentId, SelfFamilyPack>,
  briefs: readonly AreaBrief[],
  familyFindings: OracleInput['familyFindings'] = [],
): { slice: PreparedAgentSlice; input: OracleInput } {
  const input = buildOracleInput(ctx, briefs, familyFindings);
  const pre = oraclePrefix(packs, ctx.sub.promise, input);
  const suf = oracleSuffix(input, ctx.asOf);
  // the family findings were written over the family packs' keys; the Oracle may cite those too
  const familyKeys = (['family.dasha', 'family.year', 'family.sky'] as const).flatMap((id) => packs[id].keys);
  const slice = preparedSlice('self.oracle', ctx, pre.text, suf.text, modelFor('oracle'), promptText(SELF_V2_ORACLE_PROMPT), [...pre.keys, ...suf.keys, ...familyKeys]);
  return { slice, input };
}

/** The natal context of one build: the cached natal prefix every agent below it reads first. */
export interface NatalContext {
  /** the prefix text (byte-identical to the v2 Oracle slice's prefix) */
  prefix: string;
  /** the model it is warmed for (the Oracle model) */
  model: string;
  /** the slice's prefix hash (agent, model, system and prefix): the legacy v3 key's `pre=` */
  hash: string;
  /** every evidence key the slice carries (prefix, suffix and the family packs' keys the findings cite) */
  keys: string[];
  estTokens: { prefix: number; suffix: number };
  /** the whole slice (system, cache owner, suffix), for the warm-up and the legacy three-call v3 path */
  slice: PreparedAgentSlice;
  input: OracleInput;
}

/**
 * The natal context from the build context, the family packs and the area briefs (no finding: the prefix does not
 * depend on them, tests/unit/reading/self/v2agents/replayFindings.test.ts). Throws as `buildOracleInput` does when a
 * sub-technique output (S1, S2, S6–S9) is missing.
 */
export function buildNatalContext(ctx: SelfBuildContext, packs: Record<SelfFamilyAgentId, SelfFamilyPack>, briefs: readonly AreaBrief[]): NatalContext {
  const { slice, input } = buildOracleSlice(ctx, packs, briefs);
  return { prefix: slice.prefix, model: slice.model, hash: slice.prefixHash, keys: slice.keys, estTokens: slice.estTokens, slice, input };
}
