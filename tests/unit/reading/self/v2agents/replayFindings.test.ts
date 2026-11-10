/**
 * The defects of the first live Self v2 replay (docs/reading-engine/66-replay-2026-11-09-self-v2.md), each checked on
 * the replay's saved raw output (docs/reading-engine/replays/66-2026-11-09/). No model is called: the Personalizer and
 * the Oracle are mocked, and the validators run over the JSON the provider returned on 2026-11-09.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getSelfPersonalizerMaxOutputTokens, getSelfPersonalizerRetryMaxOutputTokens } from '../../../../../src/config/env.js';
import { thinkingConfigFor, type GeminiCallOptions, type GeminiResult } from '../../../../../src/reading/llm/gemini.js';
import { validateAreaDoc } from '../../../../../src/reading/self/areaDoc.js';
import type { BoardPanelId } from '../../../../../src/reading/self/types.js';
import { digestView } from '../../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../../src/reading/digest/activation.js';
import { runSelfSubTechniques } from '../../../../../src/reading/self/sub/index.js';
import { normaliseCallKeys, validatePatterns, ORACLE_V2_AREAS } from '../../../../../src/reading/self/v2/oracle.js';
import { runPersonalizer, PERSONALIZER_THINKING } from '../../../../../src/reading/self/v2/personalizer.js';
import { alignSources, CHART_TERMS, sentencesOf, validatePersonalDoc } from '../../../../../src/reading/self/v2/personalizerValidate.js';
import {
  buildOracleSlice,
  buildPersonalizerSlice,
  estProviderTokens,
  normaliseEvidenceKey,
  personalizerSuffix,
  PROVIDER_CHARS_PER_TOKEN,
} from '../../../../../src/reading/self/v2/slices.js';
import { normaliseStoredOracle } from '../../../../../src/reading/self/v2/store.js';
import type { OracleV2Output, PersonalizerInput, SelfBuildContext } from '../../../../../src/reading/self/v2types.js';
import { buildSelfFamilyPacks } from '../../../../../src/reading/self/oracle.js';
import { toSelfClock } from '../../../../../src/reading/self/v2/slices.js';
import { ASOF, makeBriefs, makeCtx, makeProfile, makeView, ACTIVATION, geminiResult } from './fixtures.js';

const REPLAY = path.resolve(__dirname, '../../../../../docs/reading-engine/replays/66-2026-11-09');
const load = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(REPLAY, f), 'utf8')) as T;

type RawCard = { areaId: string; headline: string; body: string[]; sources: string[]; dates: Array<{ from: string; to: string; label: string }>; ladder: Record<string, string>; patterns: unknown[] };
type ProfileRun = { pack: PersonalizerInput['profile'] & { hash?: string }; raw: { hero: Record<string, unknown>; cards: RawCard[] } | null; finishReason: string };
type OracleRun = { oracle: { output: OracleV2Output; calls: Array<{ promptTokens: number; cachedTokens: number }> }; slices: Array<{ agent: string; prefixTokens: number; suffixTokens: number }> };

const oracleRun = load<OracleRun>('c584c0a3-oracle.json');
const profileC = load<ProfileRun>('c584c0a3-personalizer-c.json');
const REPLAY_ASOF = '2026-11-09';
const oracleOut = oracleRun.oracle.output;

const inputFor = (p: ProfileRun): PersonalizerInput => ({
  oracle: oracleOut,
  profile: { ...p.pack },
  windows: { asOf: REPLAY_ASOF, heaviestNow: null, easesAt: '2026-12-12', nextSupportFrom: null },
});

/** every word the validated document shows on a card face */
function faceText(doc: ReturnType<typeof validatePersonalDoc>['doc']): string[] {
  const out = [doc.hero.sentence, doc.hero.sub];
  for (const c of Object.values(doc.cards)) {
    if (!c || !c.body.length) continue; // a withheld card shows the Oracle headline, redacted
    out.push(c.headline, ...c.body, ...c.patterns.map((p) => p.text), ...c.dates.map((d) => d.label));
    if (c.ladder) out.push(...Object.values(c.ladder));
  }
  return out.filter(Boolean);
}

describe('replay 66 · Personalizer validator on profile c (retired, 60+, focus health and spirituality)', () => {
  const v = validatePersonalDoc(profileC.raw!, inputFor(profileC));

  it('3 · sourced sentences survive: no "no source" drop (21 on the replay); a truly unsourced card is still dropped', () => {
    expect(v.gaps.filter((g) => /no source in the Oracle document/.test(g))).toEqual([]);
    // the replay's two shapes: one source per body sentence (no headline), and one per paragraph
    const known = new Set(['stuck.p1', 'stuck.p2']);
    expect(alignSources(['stuck.p1', 'stuck.p1', 'stuck.p2', 'stuck.p2'], [2, 2], known)).toMatchObject({ mode: 'body_only', headline: 'stuck.p1' });
    expect(alignSources(['stuck.p1', 'stuck.p2'], [2, 2], known)).toMatchObject({ mode: 'per_paragraph', body: [['stuck.p1', 'stuck.p1'], ['stuck.p2', 'stuck.p2']] });
    const none = alignSources(['made.p9'], [2, 2], known);
    expect(none.headline).toBeNull();
    const raw = structuredClone(profileC.raw!);
    raw.cards[1]!.sources = ['nowhere.p1', 'nowhere.p2'];
    const u = validatePersonalDoc(raw, inputFor(profileC));
    expect(u.cardStatus.stuck).toBe('withheld');
  });

  it('2 · a date whose label carries a chart term keeps the date; the label becomes the area title', () => {
    expect(v.gaps.filter((g) => /date .* dropped \(chart term/.test(g))).toEqual([]);
    expect(v.doc.cards.chapter!.dates).toEqual([{ from: '2026-05-05', to: '2026-12-12', label: 'This chapter' }]);
    expect(v.doc.cards.mind!.dates).toEqual([{ from: '2026-11-05', to: '2026-12-12', label: 'How you think' }]);
    // dates stay a subset of the Oracle's windows
    const pairs = new Set(Object.values(oracleOut.doc.areas).flatMap((a) => (a ? a.dates.map((d) => `${d.from}|${d.to}`) : [])));
    for (const c of Object.values(v.doc.cards)) for (const d of c?.dates ?? []) expect(pairs.has(`${d.from}|${d.to}`)).toBe(true);
    const kept = Object.values(v.doc.cards).filter((c) => c?.dates.length).length;
    // every shown card whose date is an Oracle window keeps it (2 of 11 kept a date on the replay, both action spans);
    // since run 2 a card is no longer withheld for its headline alone, so more cards (and their dates) stand
    expect(kept).toBeGreaterThanOrEqual(5);
  });

  it('6 · a card date that is an action span or a joined pair is dropped (lagna 2026-11-09..2034-10-22, presence 2026-11-09..2026-12-12)', () => {
    expect(v.doc.cards.lagna!.dates).toEqual([]);
    expect(v.doc.cards.presence!.dates).toEqual([]);
    expect(v.gaps).toEqual(expect.arrayContaining(['lagna: date 2026-11-09..2034-10-22 is not a window of the Oracle document; dropped']));
  });

  it('4 · role words against "retired" are dropped; the hero not naming the focus is flagged', () => {
    const text = faceText(v.doc).join(' ');
    for (const w of [/executive/i, /\bpitch(es)?\b/i, /workplace/i, /professional reputation/i, /professional leadership/i, /professional timelines/i]) expect(text).not.toMatch(w);
    expect(v.gaps.some((g) => /role word against the stated work status/.test(g))).toBe(true);
    expect(v.gaps).toEqual(expect.arrayContaining(['hero: names none of the stated focus (health, spirituality)']));
    // a past role may still be named
    const raw = structuredClone(profileC.raw!);
    raw.cards[3]!.body = ['In your former work you carried executive responsibility. That steadiness stays with you.'];
    raw.cards[3]!.sources = ['chapters.p1', 'chapters.p2', 'chapters.p2'];
    const past = validatePersonalDoc(raw, inputFor(profileC));
    expect(past.doc.cards.chapters!.body.join(' ')).toMatch(/former work/);
  });

  it('5 · the new chart terms and the body card\'s diet and medicine words never reach a card face', () => {
    const text = faceText(v.doc);
    for (const t of text) expect(CHART_TERMS.find((re) => re.test(t)), t).toBeUndefined();
    const all = text.join(' ');
    for (const w of [/nodal/i, /karmic/i, /combinations/i, /sub-period/i, /annual (cycle|framework)/i, /spicy/i, /inflammatory/i, /digestive/i]) expect(all).not.toMatch(w);
    for (const t of ['A rigorous sub-period concludes.', 'A challenging nodal axis.', 'Karmic friction.', 'Potent wealth combinations.', 'Your sub period ends.', 'The annual cycle asks for patience.'])
      expect(CHART_TERMS.some((re) => re.test(t)), t).toBe(true);
    // the diet words are dropped on the body card only
    expect(v.gaps.some((g) => /^body: .*diet or medicine advice/.test(g))).toBe(true);
  });

  it('the validated document has no gendered word; only cards whose headline breaks a rule are withheld', () => {
    // diagnosis: 16-word headline; stuck "Karmic friction", yogas "combinations … nodal axis", year "annual cycle"
    const withheld = Object.entries(v.cardStatus).filter(([, s]) => s === 'withheld').map(([id]) => id).sort();
    // since run 2 a failing headline falls back to a body sentence: only yogas, whose body did not survive, is withheld
    expect(withheld).toEqual(['yogas']);
    expect(faceText(v.doc).join(' ')).not.toMatch(/\b(he|she|his|her|him)\b/i);
  });
});

describe('replay 66 · Personalizer prompt carries the person', () => {
  it('4 · THE PERSON states age band, work status, love, children and focus, and forbids job words for a retired person', () => {
    const s = personalizerSuffix(inputFor(profileC), REPLAY_ASOF);
    for (const line of ['age band: 60 and over', 'work status: retired (no current job)', 'love status: not stated', 'children: not stated', 'focus: health, spirituality']) expect(s).toContain(line);
    expect(s).toMatch(/Never write of a workplace, colleagues, a team, a boss, clients, pitches, meetings, labor, promotion, executive duties/);
    expect(s).toMatch(/Focus first: health and spirituality leads the hero, and is the lens of the Now group cards/);
    const b = load<ProfileRun>('c584c0a3-personalizer-b.json');
    const sb = personalizerSuffix(inputFor(b), REPLAY_ASOF);
    expect(sb).toContain('work level: senior_leader');
    expect(sb).not.toMatch(/no current job/);
  });
});

describe('replay 66 · Personalizer truncation (failure 1)', () => {
  const ctx = makeCtx();
  const { slice, input } = buildPersonalizerSlice(ctx, oracleOut);
  const full = JSON.stringify(profileC.raw);
  const cut = full.slice(0, 9992); // profile a's length at MAX_TOKENS
  const result = (text: string, finishReason: string): GeminiResult => ({ ...geminiResult(text, { outputTokens: 4000, thoughtTokens: 100 }), finishReason });
  const deps = (answers: GeminiResult[], log: GeminiCallOptions[]) => ({
    prisma: {} as PrismaClient,
    callGemini: async (o: GeminiCallOptions) => {
      log.push(o);
      return answers.shift()!;
    },
    maxSpendUsd: 1,
  });

  it('thinks at low since the portrait (Sachin 2026-11-09), under a cap that fits profile c and thought with headroom', async () => {
    // run 1 asked for minimal; the Personalizer now reasons about the person, so it thinks at low
    expect(PERSONALIZER_THINKING).toBe('low');
    expect(getSelfPersonalizerMaxOutputTokens()).toBeGreaterThanOrEqual(10_000);
    expect(thinkingConfigFor('gemini-3.1-flash-lite', 'minimal')).toEqual({ thinkingLevel: 'minimal', includeThoughts: false });
    expect(thinkingConfigFor('gemini-3-pro', 'minimal')).toEqual({ thinkingLevel: 'low', includeThoughts: false });
    expect(thinkingConfigFor('gemini-2.5-flash', 'minimal', true)).toEqual({ thinkingBudget: 0, includeThoughts: false });
    // profile c: 4,023 output tokens complete; the most thought seen at low was 2,297
    expect(getSelfPersonalizerMaxOutputTokens()).toBeGreaterThanOrEqual(4023 + 2297);
    const log: GeminiCallOptions[] = [];
    const r = await runPersonalizer(deps([result(full, 'STOP')], log), ctx, slice, input, []);
    expect(r.status).toBe('ok');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ thinking: 'low', maxOutputTokens: getSelfPersonalizerMaxOutputTokens() });
  });

  it('on MAX_TOKENS it retries once at the higher cap, and counts both calls', async () => {
    const log: GeminiCallOptions[] = [];
    const r = await runPersonalizer(deps([result(cut, 'MAX_TOKENS'), result(full, 'STOP')], log), ctx, slice, input, []);
    expect(log.map((o) => o.maxOutputTokens)).toEqual([getSelfPersonalizerMaxOutputTokens(), getSelfPersonalizerRetryMaxOutputTokens()]);
    expect(log.every((o) => o.thinking === 'low')).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.call?.outputTokens).toBe(8000);
  });

  it('never keeps a truncated document, even one whose partial JSON would parse', async () => {
    const log: GeminiCallOptions[] = [];
    const parseable = JSON.stringify({ hero: profileC.raw!.hero, cards: profileC.raw!.cards.slice(0, 2) });
    const r = await runPersonalizer(deps([result(parseable, 'MAX_TOKENS'), result(parseable, 'MAX_TOKENS')], log), ctx, slice, input, []);
    expect(log).toHaveLength(2);
    expect(r.status).toBe('failed');
    expect(r.doc).toBeNull();
    expect(r.gaps.join(' ')).toMatch(/finish MAX_TOKENS/);
  });
});

/** the stored spans the replay's Oracle dates sit on (Kaala L1/L2/L3, the presence best window, the year chart, mudda) */
const REPLAY_SPANS: Array<[string, string]> = [
  ['2015-01-05', '2023-10-23'],
  ['2023-10-23', '2034-10-22'],
  ['2034-10-22', '2048-01-02'],
  ['2026-05-05', '2026-12-12'],
  ['2026-11-05', '2026-12-12'],
  ['2024-06-14', '2024-09-16'],
  ['2026-09-09', '2027-09-09'],
  ['2026-10-28', '2026-12-24'],
];

describe('replay 66 · Oracle date spans (failure 8) and evidence keys (failure 10)', () => {
  const rawAreas = Object.values(oracleOut.doc.areas).filter(Boolean) as unknown as Array<Record<string, unknown>>;
  const parsed = normaliseCallKeys({ areas: rawAreas, validUntil: oracleOut.doc.validUntil, patterns: oracleOut.patterns as unknown[] });
  const allowed = new Set([...rawAreas.flatMap((a) => a.evidence as string[]), ...oracleOut.patterns.flatMap((p) => p.evidence)].map(normaliseEvidenceKey));
  const windows = REPLAY_SPANS.map(([from, to]) => ({ from, to }));
  const boundaries = new Set(REPLAY_SPANS.flat());
  const base = { panelIds: ORACLE_V2_AREAS as unknown as BoardPanelId[], allowedKeys: allowed, boundaries, windows, asOf: REPLAY_ASOF };

  it('the old rule let the made-up spans through; the span rule drops exactly them', () => {
    const old = validateAreaDoc(parsed, base);
    const days = (d: typeof old) => Object.values(d.doc.areas).flatMap((a) => [...(a?.dates ?? []), ...(a?.actions ?? [])].map((x) => `${x.from}..${x.to}`));
    expect(days(old)).toEqual(expect.arrayContaining(['2026-12-12..2026-12-13', '2026-12-13..2026-12-15', '2026-12-13..2026-12-19']));
    const strict = validateAreaDoc(parsed, { ...base, spans: new Set(REPLAY_SPANS.map(([a, b]) => `${a}|${b}`)), endpoints: boundaries });
    const after = days(strict);
    for (const made of ['2026-12-12..2026-12-13', '2026-12-13..2026-12-15', '2026-12-13..2026-12-19']) expect(after).not.toContain(made);
    expect(strict.gaps.filter((g) => /not a stored span|does not start today or on a stored edge/.test(g))).toHaveLength(3);
    // every other date and action of the replay stands
    expect(after.length).toBe(days(old).length - 3);
    expect(Object.keys(strict.doc.areas)).toHaveLength(11);
  });

  it('a pattern dated across two spans loses its dates; one on a stored span keeps them', () => {
    const frame = { boundaries, windows, spans: new Set(REPLAY_SPANS.map(([a, b]) => `${a}|${b}`)) };
    const ok = validatePatterns([{ areaId: 'stuck', behaviour: 'x', mechanism: 'y', since: '2026-11-05', until: '2026-12-12', evidence: ['planet:D1.Sa'] }], allowed, frame);
    expect(ok.patterns[0]).toMatchObject({ since: '2026-11-05', until: '2026-12-12' });
    const joined = validatePatterns([{ areaId: 'stuck', behaviour: 'x', mechanism: 'y', since: '2026-11-05', until: '2034-10-22', evidence: ['planet:D1.Sa'] }], allowed, frame);
    expect(joined.patterns[0]).toMatchObject({ since: null, until: null });
  });

  it('10 · no doubled prefix after normalising, on the model output and on a stored document', () => {
    expect(normaliseEvidenceKey('risk:risk:activation:kaala/3/Ke@2026-11-05')).toBe('risk:activation:kaala/3/Ke@2026-11-05');
    expect(normaliseEvidenceKey('promise:promise:facts_dhana_yoga_lords_of_2_and_5')).toBe('promise:facts_dhana_yoga_lords_of_2_and_5');
    expect(normaliseEvidenceKey('planet:D1.Sa')).toBe('planet:D1.Sa');
    const stored = JSON.stringify(normaliseStoredOracle(oracleOut));
    expect(JSON.stringify(oracleOut)).toMatch(/risk:risk:|promise:promise:/);
    expect(stored).not.toMatch(/risk:risk:|promise:promise:/);
    expect(JSON.stringify(parsed)).not.toMatch(/risk:risk:|promise:promise:/);
  });

  it('10 · the slice writes one prefix when the S4/S5 ids already carry it', () => {
    const ctx = makeCtx();
    const sub = ctx.sub;
    const prefixed: SelfBuildContext = {
      ...ctx,
      sub: {
        ...sub,
        risk: { rows: sub.risk!.rows.map((r) => ({ ...r, id: `risk:${r.id}`, holds: r.holds.map((h) => `promise:${h}`) })), top3: sub.risk!.top3.map((x) => `risk:${x}`) },
        promise: { entries: sub.promise!.entries.map((e) => ({ ...e, id: `promise:${e.id}`, ...(e.cancels ? { cancels: `promise:${e.cancels}` } : {}) })) },
      },
    };
    const packs = buildSelfFamilyPacks(makeView(), ACTIVATION, toSelfClock(prefixed.sub.clock!), ASOF, null);
    const { slice } = buildOracleSlice(prefixed, packs, makeBriefs());
    const text = slice.prefix + slice.suffix;
    expect(text).not.toMatch(/risk:risk:|promise:promise:/);
    expect(slice.keys).toEqual(expect.arrayContaining(['risk:r1', 'promise:p1']));
    expect(slice.keys.some((k) => /^(risk:risk:|promise:promise:)/.test(k))).toBe(false);
  });
});

describe('replay 66 · Oracle cache split (failure 12)', () => {
  const ctx = makeCtx();
  const packs = buildSelfFamilyPacks(makeView(), ACTIVATION, toSelfClock(ctx.sub.clock!), ASOF, null);

  it('the prefix carries the reading frame; the suffix only TODAY, the family findings and the confirms; the prefix is the same before and after the findings', () => {
    const warm = buildOracleSlice(ctx, packs, makeBriefs()).slice;
    const live = buildOracleSlice(ctx, packs, makeBriefs(), [{ family: 'family.rasi', text: 'a finding {planet:D1.Sa}' } as never]).slice;
    expect(live.prefix).toBe(warm.prefix);
    expect(live.prefixHash).toBe(warm.prefixHash);
    for (const part of ['# NATAL SLICE', '## PROMISE LEDGER', '## CLOCK (S1)', '## PERIODS', '## WINDOWS', '## RISK LEDGER', '## AREA BRIEFS', '## YEAR (S9)']) expect(live.prefix).toContain(part);
    for (const part of ['TODAY:', '## FAMILY FINDINGS', '## CONFIRMS']) expect(live.prefix).not.toContain(part);
    expect(live.suffix.startsWith(`TODAY: ${ASOF}`)).toBe(true);
    for (const part of ['## RISK LEDGER', '## AREA BRIEFS', '## PERIODS']) expect(live.suffix).not.toContain(part);
    expect(live.estTokens.prefix / (live.estTokens.prefix + live.estTokens.suffix)).toBeGreaterThan(0.7);
  });

  it('on the replay record the split projects ≥ 70 % cached (target) and the 2.2 chars/token estimate lands within 10 % of the provider', () => {
    const est = (agent: string) => oracleRun.slices.find((s) => s.agent === agent)!;
    const prefixChars = est('self.oracle').prefixTokens * 4; // the replay's estimates were chars / 4
    const suffixNoFindingsChars = est('self.oracle').suffixTokens * 4;
    const suffixChars = est('self.oracle (with findings)').suffixTokens * 4;
    const call = oracleRun.oracle.calls[0]!;
    const providerSuffix = call.promptTokens - call.cachedTokens; // 21.3 k: everything after the cached prefix
    const suffixCharsPerToken = suffixChars / providerSuffix;
    // the frame (the suffix without the findings, less the TODAY line and the empty confirms) moves into the prefix
    const moved = (suffixNoFindingsChars - 60) / suffixCharsPerToken;
    const cachedShare = (call.cachedTokens + moved) / call.promptTokens;
    expect(cachedShare).toBeGreaterThanOrEqual(0.7);
    expect(cachedShare).toBeLessThan(0.95);
    const estimate = estProviderTokens('x'.repeat(prefixChars + suffixChars));
    expect(Math.abs(estimate - call.promptTokens) / call.promptTokens).toBeLessThan(0.1);
    expect(PROVIDER_CHARS_PER_TOKEN).toBe(2.2);
  });
});

describe('replay 66 · sub-technique round trips (9.1 s measured; target under 1.5 s)', () => {
  const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/research-calibration.json'), 'utf8')) as {
    digest: Array<{ section: string; key: string; row: unknown }>;
    activation: ActivationRow[];
    systems: Array<{ system: string; family: string }>;
  };
  const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
  /** one simulated database round trip (the replay machine's distance to the database is unknown offline) */
  const RTT = 150;
  const rt = <T>(v: T, trips = 1) => new Promise<T>((r) => setTimeout(() => r(v), RTT * trips));

  it('reads in two parallel rounds plus the profile, and writes every span log in one parallel round at the end', async () => {
    const writes: number[] = [];
    const prisma = {
      kundli: { findUnique: () => rt({ preferred_dasha: 'dwisatpathi' }) },
      auth: { findUnique: () => rt({ date_of_birth: '1950-05-01', gender: null, role: 'novice' }) },
      personFact: { findMany: () => rt([{ key: 'work.status', value: 'retired', confirmed_at: null }]) },
      agentRun: { create: () => rt({}).then(() => writes.push(Date.now())) },
    } as unknown as PrismaClient;
    const t0 = performance.now();
    const out = await runSelfSubTechniques(
      {
        prisma,
        loadDigest: () => rt(view, 2), // kundli row, then the digest rows
        systemsPresent: () => rt(FIX.systems),
        activationFor: (_p, _k, q) => rt(FIX.activation.filter((r) => !q.systems || q.systems.includes(r.system))),
        loadTransit: () => rt(null),
        loadPressure: () => rt({ inventory: null, source: 'none' as const, gaps: [] }),
      },
      { userId: 'u1', kundliId: 'k1', asOf: '2026-11-07' },
    );
    const ms = performance.now() - t0;
    if ('status' in out) throw new Error('preparing');
    // every span logged once (the ten sub-technique spans), all after the steps, not one per step on the critical path
    expect(writes.length).toBe(10);
    // critical path: digest (2) → activation (1) → profile (≤ 2) → logs (1) = 6 round trips; it was ≈ 10 before
    expect(ms).toBeLessThan(RTT * 7);
    expect(ms).toBeLessThan(1500);
    expect(out.ms.runLogs).toBeLessThan(RTT * 2);
  });
});

describe('replay 66 · the profile pack test fixture', () => {
  it('a retired profile through makeProfile carries the work status into the suffix', () => {
    const p = makeProfile({ facts: { work: { status: 'retired' }, focus: ['health'] } });
    const { slice } = buildPersonalizerSlice(makeCtx({ profile: p }), oracleOut);
    expect(slice.suffix).toContain('work status: retired (no current job)');
    expect(sentencesOf('One. Two.')).toEqual(['One.', 'Two.']);
  });
});
