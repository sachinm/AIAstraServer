/**
 * Self board v2 agent slices (docs/reading-engine/66 §4.8 Layer 3; AGENTS.md "Board and technique machinery" rule 4).
 *
 * Every agent's input is built here from the build context and the rows the sub-techniques already loaded, never from
 * the database: a stable prefix (cached, ≥ 1,024 tokens where the data allows) and a variable suffix.
 *
 * - family.rasi … family.sky: `buildSelfFamilyPacks` as today; family.sky is padded past 1,024 tokens with the window
 *   rows it may legitimately read (doc 65 §9b).
 * - self.oracle: prefix = the natal slice (the family.rasi and family.varga packs: D1/D9 houses, planets, points,
 *   yogas) + the S4 promise ledger + the reading frame (clock, periods, windows summary, risk top 12, promise top 8,
 *   mind/body/presence/year facts, area briefs), all known before any agent runs and the same for the three Oracle
 *   calls; suffix = TODAY, the family findings and the confirms. The doc 66 replay (2026-11-09) cached 38.6 % with the
 *   frame in the suffix (13.4 k of 34.6 k provider tokens); with it in the prefix the cached share is about 80 %.
 * - self.personalizer: prefix = the Oracle document (stable per Oracle key); suffix = the profile pack (without age in
 *   years and hash) and the windows summary.
 *
 * Selection and formatting only: every value is an engine row carried through by id.
 */
import { getSelfPersonalizerModel } from '../../../config/env.js';
import { MATTER_PLAIN, mattersOfClaim, PEOPLE_PLAIN } from '../v2words.js';
import { portraitLines } from './portrait.js';
import { profileLines } from '../../person/profileLines.js';
import { claimKey, preparedSlice, promptText } from '../../slices/natalPrefix.js';
import type {
  AreaBrief,
  HeroClaimFrame,
  NowBriefView,
  OracleInput,
  OracleV2Output,
  PeopleLabel,
  PersonalizerInput,
  PersonPortrait,
  PreparedAgentSlice,
  SelfBuildContext,
  SelfV2FamilyAgentId,
} from '../v2types.js';
import type { SelfFamilyAgentId, SelfFamilyPack } from '../oracle.js';
import type { SelfV2Loaded } from '../sub/index.js';
import { buildFamilySlices } from '../../families/run.js';
import { buildOracleSlice } from '../../slices/natalPrefix.js';

// moved out unchanged (plan "retire the v2 Self reading", server step 1): the natal prefix to slices/natalPrefix.ts, the
// family slices to families/run.ts, the profile lines to person/profileLines.ts; re-exported so every import keeps working
export {
  buildNatalContext,
  buildOracleInput,
  buildOracleSlice,
  claimKey,
  estProviderTokens,
  estTokens,
  KeyBook,
  MIN_CACHE_TOKENS,
  normaliseEvidenceKey,
  ORACLE_PROMISE_TOP,
  ORACLE_RISK_TOP,
  oracleFrame,
  oraclePrefix,
  oracleSuffix,
  promiseKey,
  promptHash,
  promptText,
  PROVIDER_CHARS_PER_TOKEN,
  renderPromiseLedger,
  riskKey,
  SELF_V2_ORACLE_PROMPT,
  shortHash,
  topPromise,
  topRisk,
  type NatalContext,
} from '../../slices/natalPrefix.js';
export { buildFamilySlices, FAMILY_IDS, toSelfClock, type FamilySlices } from '../../families/run.js';
export { BAND_REGISTER, profileLines, WORK_EXAMPLES } from '../../person/profileLines.js';

export const SELF_V2_PERSONALIZER_PROMPT = 'personalizer/self';

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
export function buildPersonalizerInput(ctx: SelfBuildContext, oracle: OracleV2Output, briefs: readonly AreaBrief[] = [], portrait: PersonPortrait | null = null): PersonalizerInput {
  const p = ctx.sub.profile;
  if (!p) throw new Error('self v2 Personalizer input: the profile pack (S10) is missing from the build context');
  const { ageYears: _age, hash: _hash, ...profile } = p;
  const w = ctx.sub.windows;
  const nowBrief = briefs.find((b) => b.areaId === 'now') ?? null;
  const now = nowBrief ? nowBriefView(ctx, nowBrief) : null;
  return {
    oracle,
    profile,
    windows: { asOf: w?.asOf ?? ctx.asOf, heaviestNow: w?.heaviestNow ?? null, easesAt: w?.easesAt ?? null, nextSupportFrom: w?.nextSupportFrom ?? null },
    ...(now ? { now } : {}),
    heroClaim: heroClaimFrame(ctx, oracle, nowBrief),
    ...(portrait ? { portrait } : {}),
  };
}

/** The `now` brief as the Personalizer reads it: claims, dates and its S5 rows as words keys (run 1 failure 14). */
export function nowBriefView(ctx: SelfBuildContext, b: AreaBrief): NowBriefView {
  const rows = new Set(b.ledgerRows);
  return {
    claims: b.claims.map((c) => ({ id: claimKey(c.id), fact: c.fact, range: c.range })),
    dates: b.dates.map((d) => ({ ...d })),
    ledger: (ctx.sub.risk?.rows ?? [])
      .filter((r) => rows.has(r.id))
      .map((r) => ({ id: r.id, matter: r.matter, what: r.what, who: [...r.who], since: r.since, until: r.until, polarity: r.polarity })),
  };
}

const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-11-05' → '5 Nov 2026' (calendar words only) */
export const dayWords = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH_WORDS[Number(m[2]) - 1]} ${m[1]}` : iso;
};
const LIVE_AREA_IDS = ['diagnosis', 'stuck', 'chapter'];

/**
 * The hero question's claim, chosen by code (doc 66 replay run 2, failure 6): the `now` brief's heaviest window, else the
 * live areas' heaviest window in the Oracle document, else a `now` ledger claim, else any live claim that names a
 * matter. Its matters and people come from the S5 row of that window (`risk:<rowId>`), else from the claim id's words;
 * the draft asks about the first matter only (one thing at a time), in the person's words. Null when no claim names a
 * matter. Selection and wording only.
 */
export function heroClaimFrame(ctx: SelfBuildContext, oracle: OracleV2Output, nowBrief: AreaBrief | null = null): HeroClaimFrame | null {
  const oracleClaims = [...new Set(Object.values(oracle.doc.areas).flatMap((a) => (a ? a.evidence.filter((k) => k.startsWith('claim:')) : [])))];
  const live = oracleClaims.filter((k) => LIVE_AREA_IDS.some((a) => k.startsWith(`claim:${a}.`)));
  const nowClaims = (nowBrief?.claims ?? []).map((c) => ({ id: claimKey(c.id), range: c.range }));
  const heavy = (k: string) => k.includes('.heaviest_now:');
  const ordered = [
    ...nowClaims.filter((c) => heavy(c.id)).map((c) => c.id),
    ...live.filter(heavy),
    ...nowClaims.filter((c) => c.id.includes('.risk:')).map((c) => c.id),
    ...live,
  ];
  const claimId = ordered.find((k) => mattersOfClaim(k).length) ?? null;
  if (!claimId) return null;
  const w = ctx.sub.windows?.heaviestNow ?? null;
  const rows = ctx.sub.risk?.rows ?? [];
  let matters = mattersOfClaim(claimId);
  let who: PeopleLabel[] = [];
  let since: string | null = null;
  let until: string | null = null;
  if (heavy(claimId) && w) {
    const row = rows.find((r) => r.id === `risk:${w.rowId}` || r.from.windowId === w.rowId);
    if (row) {
      matters = [row.matter, ...matters.filter((m) => m !== row.matter)];
      who = [...row.who];
    }
    since = w.from;
    until = w.to;
  } else {
    const row = rows.find((r) => matters.includes(r.matter));
    if (row) {
      who = [...row.who];
      since = row.since;
      until = row.until;
    }
    const range = nowClaims.find((c) => c.id === claimId)?.range;
    if (!since && range && range !== 'always') {
      since = range.from;
      until = range.to;
    }
  }
  const facts = ctx.sub.profile?.facts ?? {};
  const hasChildren = Boolean(facts.children && facts.children !== 'none');
  const hasPartner = Boolean(facts.love && facts.love !== 'single');
  who = who.filter((x) => (x !== 'children' || hasChildren) && (x !== 'partners_and_clients' || hasPartner || facts.work?.status === 'own_business'));
  const first = MATTER_PLAIN[matters[0]!];
  const phrase = matters[0] === 'ideas_and_children' && hasChildren ? 'your creative projects and your children' : first.phrase;
  const draft =
    since && since <= ctx.asOf ? `Since ${dayWords(since)}, has there been more strain around ${phrase}?` : `Lately, has there been more strain around ${phrase}?`;
  return { claimId, matters, who, since, until, draft };
}


/** The Personalizer's suffix: the person (never the chart), the windows summary, the `now` brief and the hero claim. */
export function personalizerSuffix(input: PersonalizerInput, asOf: string): string {
  const p = input.profile;
  const w = input.windows;
  const areas = Object.keys(input.oracle.doc.areas);
  const now = input.now;
  const hc = input.heroClaim;
  const span = (a: string | null, b: string | null) => `${a ?? 'n/a'}..${b ?? 'n/a'}`;
  return [
    `TODAY: ${asOf}`,
    '## THE PERSON',
    ...profileLines(p),
    `declined (never mention): ${p.declined.length ? p.declined.join(', ') : 'none'}`,
    `last answers: ${p.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`,
    `mood today: ${p.mood ?? 'not given'}`,
    ...(input.portrait ? portraitLines(input.portrait) : ['## PORTRAIT: not built for this call; write from THE PERSON only']),
    '## WINDOWS (engine dates around today)',
    `heaviest now: ${w.heaviestNow ? `${w.heaviestNow.matters.join(', ')} ${w.heaviestNow.from}..${w.heaviestNow.to} (${w.heaviestNow.polarity})` : 'none'}`,
    `eases at: ${w.easesAt ?? 'not stored'} · next support from: ${w.nextSupportFrom ?? 'not stored'}`,
    ...(now
      ? [
          '## RIGHT NOW (the hero rests on these rows and dates: its sentence names one of these matters and one of these dates)',
          ...now.ledger.map((r) => `- row ${r.id}: ${r.matter} · ${r.what} · people ${r.who.join(', ') || 'none'} · ${span(r.since, r.until)} (${r.polarity})`),
          ...now.dates.map((d) => `- date: ${d.from}..${d.to} ${d.label}`),
        ]
      : []),
    ...(hc
      ? [
          '## HERO QUESTION (built by code from the claim; rephrase it in plain words only, keep its matter, ask one thing)',
          `claim: ${hc.claimId}`,
          `matter: ${hc.matters.map((m) => MATTER_PLAIN[m].phrase).join('; ')}${hc.who.length ? ` · people: ${hc.who.map((x) => PEOPLE_PLAIN[x]).filter(Boolean).join(', ')}` : ''} · ${span(hc.since, hc.until)}`,
          `draft: ${hc.draft}`,
        ]
      : ['## HERO QUESTION: no dated claim names a life matter; leave questionClaimId and questionText empty']),
    `## WRITE: the hero and one card for each of these areas: ${areas.join(', ')}`,
  ].join('\n');
}

/** The Personalizer's slice: the Oracle document is the stable prefix (the same for every profile on one Oracle key). */
export function buildPersonalizerSlice(
  ctx: SelfBuildContext,
  oracle: OracleV2Output,
  briefs: readonly AreaBrief[] = [],
  portrait: PersonPortrait | null = null,
): { slice: PreparedAgentSlice; input: PersonalizerInput } {
  const input = buildPersonalizerInput(ctx, oracle, briefs, portrait);
  const doc = renderOracleDoc(oracle);
  const slice = preparedSlice('self.personalizer', ctx, doc.text, personalizerSuffix(input, ctx.asOf), getSelfPersonalizerModel(), promptText(SELF_V2_PERSONALIZER_PROMPT), doc.keys);
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
