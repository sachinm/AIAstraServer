/**
 * Self board v2 agent slices (docs/reading-engine/66 §4.8 Layer 3; AGENTS.md "Board and technique machinery" rule 4).
 *
 * Every agent's input is built here from the build context and the rows the sub-techniques already loaded, never from
 * the database: a stable prefix (cached, ≥ 1,024 tokens where the data allows) and a variable suffix.
 *
 * - family.rasi … family.sky: `buildSelfFamilyPacks` as today; family.sky is padded past 1,024 tokens with the window
 *   rows it may legitimately read (doc 65 §9b).
 * - self.oracle: prefix = the natal slice (the family.rasi and family.varga packs: D1/D9 houses, planets, points,
 *   yogas) + the S4 promise ledger, stable per digest version; suffix = clock, periods, windows summary, risk top 12,
 *   promise top 8, mind/body/presence/year facts, area briefs, family findings, confirms.
 * - self.personalizer: prefix = the Oracle document (stable per Oracle key); suffix = the profile pack (without age in
 *   years and hash) and the windows summary.
 *
 * Selection and formatting only: every value is an engine row carried through by id.
 */
import { createHash } from 'node:crypto';
import { getSelfPersonalizerModel } from '../../../config/env.js';
import { modelFor } from '../../llm/models.js';
import { PROMPTS } from '../../prompts/generated.js';
import { buildSelfFamilyPacks, FAMILY_SYSTEM_PROMPTS, type SelfFamilyAgentId, type SelfFamilyPack } from '../oracle.js';
import type { SelfClock } from '../types.js';
import { clockLabel } from '../words.js';
import type {
  AreaBrief,
  ClockResolution,
  OracleInput,
  OracleV2Output,
  PersonalizerInput,
  PreparedAgentSlice,
  PromiseEntry,
  PromiseLedger,
  RiskRow,
  SelfBuildContext,
  SelfV2FamilyAgentId,
  WindowRef,
  WindowSet,
} from '../v2types.js';
import type { SelfV2Loaded } from '../sub/index.js';

export const SELF_V2_ORACLE_PROMPT = 'oracle/self-areas-v2';
export const SELF_V2_PERSONALIZER_PROMPT = 'personalizer/self';
/** Gemini's minimum prefix for an explicit cache; below it a region is refused */
export const MIN_CACHE_TOKENS = 1024;
export const ORACLE_RISK_TOP = 12;
export const ORACLE_PROMISE_TOP = 8;

export const FAMILY_IDS: readonly SelfV2FamilyAgentId[] = ['family.rasi', 'family.varga', 'family.dasha', 'family.year', 'family.sky'];

/** chars / 4: the estimate the Lab shows before a call */
export const estTokens = (s: string): number => Math.ceil(s.length / 4);
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
    this.keys.add(key);
    return `{${key}}`;
  }
  ks(keys: readonly (string | null | undefined)[]): string {
    return keys.map((x) => this.k(x)).filter(Boolean).join(' ');
  }
}

/** a brief claim id as the Oracle cites it: `claim:<id>` (doc 65 Phase A: the prefix is part of the id) */
export const claimKey = (id: string): string => (id.startsWith('claim:') ? id : `claim:${id}`);

/** The S1 resolution in the shape the family packs read. */
export function toSelfClock(c: ClockResolution): SelfClock {
  return {
    system: c.primary,
    label: clockLabel(c.primary),
    reason: c.reason === 'conditional_applies' ? 'applicable' : c.reason,
    confirming: c.confirming.map((system) => ({ system, label: clockLabel(system) })),
    choices: c.applicable.map((system) => ({ system, label: clockLabel(system) })),
  };
}

function prepared(
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
    estTokens: { prefix: estTokens(prefix), suffix: estTokens(suffix) },
    keys: [...new Set(keys)],
  };
}

const windowLine = (book: KeyBook, w: WindowRef): string =>
  `${book.k(`window:${w.rowId}`)} matters=[${w.matters.join(',')}] polarity=${w.polarity} strength=${w.strength} ${w.from}..${w.to}`;

/** every window row the context carries, deduplicated by row id, strip first */
function allWindowRows(ctx: SelfBuildContext): WindowRef[] {
  const w = ctx.sub.windows;
  const out = new Map<string, WindowRef>();
  const add = (r: WindowRef | null | undefined) => {
    if (r && !out.has(r.rowId)) out.set(r.rowId, r);
  };
  if (w) {
    for (const r of w.strip) add(r);
    add(w.heaviestNow);
    for (const r of w.startedLast12m) add(r);
    for (const r of w.endingNext6m) add(r);
    for (const rows of Object.values(w.byMatter)) for (const r of rows ?? []) add(r);
  }
  for (const r of ctx.sub.body?.liveTransits ?? []) add(r);
  return [...out.values()];
}

export interface FamilySlices {
  slices: Record<SelfV2FamilyAgentId, PreparedAgentSlice>;
  packs: Record<SelfFamilyAgentId, SelfFamilyPack>;
}

/** The five family readers' slices; family.sky padded past 1,024 tokens with the window rows it may read. */
export function buildFamilySlices(ctx: SelfBuildContext, loaded: SelfV2Loaded): FamilySlices {
  if (!ctx.sub.clock) throw new Error('self v2 slices: the clock (S1) is missing from the build context');
  const packs = buildSelfFamilyPacks(loaded.view, loaded.activation, toSelfClock(ctx.sub.clock), ctx.asOf, loaded.sky);
  const sky = packs['family.sky'];
  if (estTokens(sky.prefix) < MIN_CACHE_TOKENS) {
    const book = new KeyBook();
    const lines = [`## WINDOW ROWS family.sky may read (engine windows around ${ctx.asOf.slice(0, 7)}, padding to the cache minimum)`];
    let prefix = `${sky.prefix}\n${lines[0]}`;
    for (const r of allWindowRows(ctx)) {
      if (estTokens(prefix) >= MIN_CACHE_TOKENS) break;
      prefix += `\n${windowLine(book, r)}`;
    }
    const keys = [...sky.keys, ...book.keys];
    packs['family.sky'] = { ...sky, prefix, keys, packHash: shortHash(`${loaded.view.version}|sky|${sky.horizonKey}|${prefix}`) };
  }
  const model = modelFor('reader');
  const slices = Object.fromEntries(
    FAMILY_IDS.map((id) => {
      const p = packs[id];
      return [id, prepared(id, ctx, p.prefix, p.dynamic, model, FAMILY_SYSTEM_PROMPTS[id], p.keys)];
    }),
  ) as Record<SelfV2FamilyAgentId, PreparedAgentSlice>;
  return { slices, packs };
}

function promiseLine(book: KeyBook, e: PromiseEntry): string {
  const src = [e.source.yogaId ? `yoga=${e.source.yogaId}` : '', e.source.planet ? `planet=${e.source.planet}` : '', e.source.house != null ? `house=${e.source.house}` : '']
    .filter(Boolean)
    .join(' ');
  return `${book.k(`promise:${e.id}`)} ${e.kind} matter=${e.matter} ${src} who=[${e.who.join(',')}] strength=${e.strength}${e.cancels ? ` cancels=${book.k(`promise:${e.cancels}`)}` : ''} evidence ${book.ks(e.evidence)}`;
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

const windowsSummary = (w: WindowSet | undefined): OracleInput['windows'] => ({
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

/** The stable natal prefix of the Oracle: the rasi and varga packs, then the whole promise ledger. No date in it. */
export function oraclePrefix(packs: Record<SelfFamilyAgentId, SelfFamilyPack>, ledger: PromiseLedger | undefined): { text: string; keys: string[] } {
  const book = new KeyBook();
  const text = [
    '# NATAL SLICE (stable per digest version: D1 and divisional houses, planets, points, yogas)',
    packs['family.rasi'].prefix,
    packs['family.varga'].prefix,
    renderPromiseLedger(book, ledger),
  ].join('\n\n');
  return { text, keys: [...packs['family.rasi'].keys, ...packs['family.varga'].keys, ...book.keys] };
}

/** The Oracle's variable suffix (doc 66 §4.8): everything dated, the briefs and the family findings. */
export function oracleSuffix(input: OracleInput, asOf: string): { text: string; keys: string[] } {
  const b = new KeyBook();
  const L: string[] = [`TODAY: ${asOf}`];
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
    const from = [r.from.planet ? `planet=${r.from.planet}` : '', r.from.house != null ? `house=${r.from.house}` : '', r.from.yogaId ? `yoga=${r.from.yogaId}` : '', r.from.windowId ? `window=${b.k(`window:${r.from.windowId}`)}` : '']
      .filter(Boolean)
      .join(' ');
    L.push(
      `${b.k(`risk:${r.id}`)} matter=${r.matter} what=${r.what} from: ${from || 'n/a'} who=[${r.who.join(',')}] since=${r.since ?? 'n/a'} until=${r.until ?? 'n/a'} polarity=${r.polarity} strength=${r.strength} holds=[${r.holds.map((h) => b.k(`promise:${h}`)).join(' ')}] evidence ${b.ks(r.evidence)}`,
    );
  }
  L.push(`## PROMISE (S4, the ${input.promise.length} strongest entries; the whole ledger is in the natal slice)`);
  for (const e of input.promise) L.push(`- ${b.k(`promise:${e.id}`)} ${e.kind} ${e.matter} strength=${e.strength}`);
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
      ? 'no annual row covers today: the live year line is withheld'
      : `year ${y.from}..${y.to} year lagna ${b.k(y.yearLagna)} year lord ${b.k(y.yearLord)} short clock ${y.shortClock ? `${y.shortClock.lord} ${y.shortClock.from}..${y.shortClock.to} ${b.k(y.shortClock.evidence)}` : 'none'}`,
  );
  L.push('## AREA BRIEFS (Layer 2: the claims each area may stand on)');
  for (const a of input.areaBriefs) {
    L.push(`### ${a.areaId} (horizon ${a.horizon})`);
    for (const cl of a.claims) {
      const range = cl.range === 'always' ? 'always' : `${cl.range.from}..${cl.range.to}`;
      L.push(`- ${b.k(claimKey(cl.id))} ${cl.fact} (${range}) ${b.ks(cl.evidence)}`);
    }
    for (const d of a.dates) L.push(`- date ${d.from}..${d.to} ${d.label}`);
    if (a.ledgerRows.length) L.push(`- risk rows: ${a.ledgerRows.map((id) => b.k(`risk:${id}`)).join(' ')}`);
    if (a.promiseEntries.length) L.push(`- promise entries: ${a.promiseEntries.map((id) => b.k(`promise:${id}`)).join(' ')}`);
  }
  L.push('## FAMILY FINDINGS (the five family readers)');
  for (const f of input.familyFindings) L.push(`### ${f.family}`, f.text || '(none)');
  if (!input.familyFindings.length) L.push('(none this build)');
  L.push('## CONFIRMS (the person\'s last answers; a No lowers that claim\'s certainty)');
  for (const cf of input.confirms) L.push(`- ${b.k(claimKey(cf.claimId))} ${cf.answer}${cf.at ? ` (${cf.at.slice(0, 10)})` : ''}`);
  if (!input.confirms.length) L.push('(none)');
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
  const pre = oraclePrefix(packs, ctx.sub.promise);
  const suf = oracleSuffix(input, ctx.asOf);
  // the family findings were written over the family packs' keys; the Oracle may cite those too
  const familyKeys = (['family.dasha', 'family.year', 'family.sky'] as const).flatMap((id) => packs[id].keys);
  const slice = prepared('self.oracle', ctx, pre.text, suf.text, modelFor('oracle'), promptText(SELF_V2_ORACLE_PROMPT), [...pre.keys, ...suf.keys, ...familyKeys]);
  return { slice, input };
}

/** paragraph ids as the Personalizer cites them: `<area>.p<n>`, 1-based */
export const paragraphId = (area: string, i: number): string => `${area}.p${i + 1}`;

/** The Oracle document as the Personalizer's prefix: one section per area, every paragraph with its id. */
export function renderOracleDoc(out: OracleV2Output): { text: string; keys: string[] } {
  const keys = new Set<string>();
  const L: string[] = ['# ORACLE DOCUMENT (the chart reading in its own register; you translate it, you never add to it)'];
  for (const [id, a] of Object.entries(out.doc.areas)) {
    if (!a) continue;
    L.push(`## AREA ${id}`, `headline: ${a.headline}`);
    a.paragraphs.forEach((p, i) => {
      keys.add(paragraphId(id, i));
      L.push(`[${paragraphId(id, i)}] ${p}`);
    });
    for (const d of a.dates) L.push(`date: ${d.from}..${d.to} ${d.label}`);
    for (const x of a.actions) L.push(`action: ${x.from}..${x.to} ${x.text}`);
    L.push(`certainty: ${a.certainty} · valid until: ${a.validUntil}`);
    L.push(`evidence: ${a.evidence.join(' ')}`);
    for (const k of a.evidence) keys.add(k);
  }
  if (out.patterns.length) {
    L.push('## PATTERNS');
    for (const p of out.patterns) {
      L.push(`- (${p.areaId}) behaviour: ${p.behaviour} · mechanism: ${p.mechanism} · since ${p.since ?? 'n/a'} until ${p.until ?? 'n/a'} · evidence: ${p.evidence.join(' ')}`);
      for (const k of p.evidence) keys.add(k);
    }
  }
  L.push(`overall valid until: ${out.doc.validUntil}`);
  return { text: L.join('\n'), keys: [...keys] };
}

/** The Personalizer's input: the Oracle document, the profile pack without age in years and hash, the windows summary. */
export function buildPersonalizerInput(ctx: SelfBuildContext, oracle: OracleV2Output): PersonalizerInput {
  const p = ctx.sub.profile;
  if (!p) throw new Error('self v2 Personalizer input: the profile pack (S10) is missing from the build context');
  const { ageYears: _age, hash: _hash, ...profile } = p;
  const w = ctx.sub.windows;
  return {
    oracle,
    profile,
    windows: { asOf: w?.asOf ?? ctx.asOf, heaviestNow: w?.heaviestNow ?? null, easesAt: w?.easesAt ?? null, nextSupportFrom: w?.nextSupportFrom ?? null },
  };
}

/** The Personalizer's suffix: the person (never the chart) and the windows summary. */
export function personalizerSuffix(input: PersonalizerInput, asOf: string): string {
  const p = input.profile;
  const w = input.windows;
  const areas = Object.keys(input.oracle.doc.areas);
  return [
    `TODAY: ${asOf}`,
    '## THE PERSON',
    `age band: ${p.ageBand ?? 'not known'}`,
    `gender: ${p.gender ?? 'not stated (use no gendered words at all)'}`,
    `reader: ${p.role}`,
    `facts: ${JSON.stringify(p.facts)}`,
    `declined (never mention): ${p.declined.length ? p.declined.join(', ') : 'none'}`,
    `last answers: ${p.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`,
    `mood today: ${p.mood ?? 'not given'}`,
    '## WINDOWS (engine dates around today)',
    `heaviest now: ${w.heaviestNow ? `${w.heaviestNow.matters.join(', ')} ${w.heaviestNow.from}..${w.heaviestNow.to} (${w.heaviestNow.polarity})` : 'none'}`,
    `eases at: ${w.easesAt ?? 'not stored'} · next support from: ${w.nextSupportFrom ?? 'not stored'}`,
    `## WRITE: the hero and one card for each of these areas: ${areas.join(', ')}`,
  ].join('\n');
}

/** The Personalizer's slice: the Oracle document is the stable prefix (the same for every profile on one Oracle key). */
export function buildPersonalizerSlice(ctx: SelfBuildContext, oracle: OracleV2Output): { slice: PreparedAgentSlice; input: PersonalizerInput } {
  const input = buildPersonalizerInput(ctx, oracle);
  const doc = renderOracleDoc(oracle);
  const slice = prepared('self.personalizer', ctx, doc.text, personalizerSuffix(input, ctx.asOf), getSelfPersonalizerModel(), promptText(SELF_V2_PERSONALIZER_PROMPT), doc.keys);
  return { slice, input };
}

export interface SelfV2Slices {
  families: Record<SelfV2FamilyAgentId, PreparedAgentSlice>;
  packs: Record<SelfFamilyAgentId, SelfFamilyPack>;
  oracle: PreparedAgentSlice;
  oracleInput: OracleInput;
}

/** Step 3 of a build (doc 66 §4.8): every slice that can be built before any agent runs. */
export function buildSelfV2Slices(ctx: SelfBuildContext, loaded: SelfV2Loaded, briefs: readonly AreaBrief[]): SelfV2Slices {
  const fam = buildFamilySlices(ctx, loaded);
  const o = buildOracleSlice(ctx, fam.packs, briefs);
  return { families: fam.slices, packs: fam.packs, oracle: o.slice, oracleInput: o.input };
}
