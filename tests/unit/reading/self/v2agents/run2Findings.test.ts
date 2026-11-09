/**
 * The defects of the second live Self v2 replay (docs/reading-engine/66-replay-2026-11-09-self-v2-run2.md), each checked
 * on the replay's saved raw output (docs/reading-engine/replays/66-2026-11-09-run2/) and on hand-written golden
 * Personalizer documents (run2Golden.ts). No model is called.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../../src/reading/llm/gemini.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { nowArea } from '../../../../../src/reading/self/areas/now.js';
import { runSelfV2Build } from '../../../../../src/reading/self/v2/build.js';
import { reportedThoughtTokens, timingOf } from '../../../../../src/reading/self/v2/oracle.js';
import { oracleEcho, pairwiseJaccard, seniorStageWordsFor, tokenJaccard } from '../../../../../src/reading/self/v2/profileFit.js';
import {
  CHART_TERMS,
  headlineFromBody,
  questionMatterProblem,
  redactChartTerms,
  standInHeadline,
  textProblem,
  validatePersonalDoc,
  WITHHELD_LINE,
  type TextCheckContext,
} from '../../../../../src/reading/self/v2/personalizerValidate.js';
import { buildPersonalizerInput, buildPersonalizerSlice, heroClaimFrame, personalizerSuffix } from '../../../../../src/reading/self/v2/slices.js';
import { areaRange } from '../../../../../src/reading/self/v2api/response.js';
import type { OracleV2Output, PersonalizerInput, SelfBuildContext } from '../../../../../src/reading/self/v2types.js';
import { completeSentencesOf, CUT_FINDING_NOTE } from '../../../../../src/reading/self/words.js';
import { mattersOfClaim } from '../../../../../src/reading/self/v2words.js';
import { runOf } from '../../../../../src/routes/adminLoads.js';
import { geminiResult, makeCtx, makeGemini, makePrisma, makeProfile, makeSubs } from './fixtures.js';
import { GOLDEN, type GoldenDoc } from './run2Golden.js';

const REPLAY = path.resolve(__dirname, '../../../../../docs/reading-engine/replays/66-2026-11-09-run2');
const load = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(REPLAY, f), 'utf8')) as T;

type RawCard = { areaId: string; headline: string; body: string[]; sources: string[]; dates: unknown[]; ladder: Record<string, string>; patterns: unknown[] };
type ProfileRun = { id: string; pack: PersonalizerInput['profile'] & { hash?: string }; raw: { hero: Record<string, unknown>; cards: RawCard[] } };
type OracleRun = { oracle: { output: OracleV2Output }; familyFindings: Array<{ family: string; text: string }> };

const oracleRun = load<OracleRun>('c584c0a3-oracle.json');
const summary = load<{ calls: Array<{ agent: string; thoughtTokens: number; finishReason: string; outputTokens: number }> }>('summary.json');
const runs = { a: load<ProfileRun>('c584c0a3-personalizer-a.json'), b: load<ProfileRun>('c584c0a3-personalizer-b.json'), c: load<ProfileRun>('c584c0a3-personalizer-c.json') };
const oracleOut = oracleRun.oracle.output;
const HEAVY = 'claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network';

/** the run 2 sky: the heaviest window is the Ketu sub-sub period over the 5th/11th/9th matters (S3 row, S5 row) */
function run2Ctx(profile: PersonalizerInput['profile']): SelfBuildContext {
  const ctx = makeCtx({ profile: { ...profile, ageYears: null, hash: 'h' } });
  const w = { rowId: 'kaala/3/Ke@2026-11-05', matters: ['ideas_and_children', 'luck_and_belief', 'gains_and_network'] as const, polarity: 'presses' as const, strength: 2 as const, from: '2026-11-05', to: '2026-12-12' };
  ctx.sub.windows = { ...ctx.sub.windows!, heaviestNow: { ...w, matters: [...w.matters] }, easesAt: '2026-12-12', nextSupportFrom: '2026-12-13' };
  ctx.sub.risk = {
    rows: [
      {
        id: `risk:${w.rowId}`,
        matter: 'ideas_and_children',
        what: 'detachment',
        from: { planet: 'Ke', house: 11, windowId: w.rowId },
        who: ['children', 'friends_and_elder_siblings'],
        since: '2026-11-05',
        until: '2026-12-12',
        polarity: 'presses',
        strength: 2,
        holds: [],
        evidence: ['activation:kaala/3/Ke@2026-11-05'],
      },
    ],
    top3: [`risk:${w.rowId}`],
  };
  return ctx;
}

const inputFor = (p: ProfileRun['pack']): PersonalizerInput => {
  const { hash: _h, ...profile } = p;
  return { ...buildPersonalizerInput(run2Ctx(profile), oracleOut), windows: { asOf: '2026-11-09', heaviestNow: null, easesAt: '2026-12-12', nextSupportFrom: '2026-12-13' } };
};
const ctxOf = (inp: PersonalizerInput, areaId: string): TextCheckContext => ({
  gender: inp.profile.gender,
  dates: { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() },
  roleWords: null,
  stageWords: seniorStageWordsFor(inp.profile),
  cardWords: null,
  ...(areaId ? {} : {}),
});

describe('run 2 · 1 · a withheld card never shows an unchecked Oracle headline, never "…"', () => {
  it('the stand-in passes the same checks; the lagna headline for the retired profile c falls to the plain line', () => {
    const inp = inputFor(runs.c.pack);
    const raw = structuredClone(runs.c.raw);
    for (const c of raw.cards) if (['lagna', 'year', 'yogas'].includes(c.areaId)) c.body = [];
    const v = validatePersonalDoc(raw, inp);
    for (const id of ['lagna', 'year', 'yogas'] as const) expect(v.cardStatus[id]).toBe('withheld');
    // "the world recognizes you for executive leadership and professional gravitas" to a retired person: never
    expect(v.doc.cards.lagna!.headline).toBe(WITHHELD_LINE);
    // "A disciplined annual cycle …" and "Fortunate cancellations and wealth yogas …": a chart term, never redacted to "…"
    expect(v.doc.cards.year!.headline).toBe(WITHHELD_LINE);
    expect(v.doc.cards.yogas!.headline).toBe(WITHHELD_LINE);
    for (const c of Object.values(v.doc.cards)) expect(c!.headline).not.toContain('…');
  });

  it('a clean Oracle headline still stands in; redaction drops the sentence instead of cutting it', () => {
    const ctx: TextCheckContext = { gender: null, dates: { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() } };
    expect(standInHeadline('A temporary wave of mental withdrawal and social coolness demands quiet patience until mid-December.', ctx)).toMatch(/^A temporary wave/);
    expect(redactChartTerms('A disciplined annual cycle calls for structural adjustments.')).toBe('');
    expect(redactChartTerms('Your work steadies. Saturn presses it.')).toBe('Your work steadies.');
    expect(redactChartTerms('Fortunate cancellations and wealth yogas resolve earlier knots.')).not.toContain('…');
  });

  it('the stand-in carries no body word on the body card and no career-stage word for a 25–35 founder', () => {
    const a = inputFor(runs.a.pack);
    expect(standInHeadline('You project the aura of a seasoned professional.', ctxOf(a, 'lagna'))).toBe(WITHHELD_LINE);
    const bodyCtx: TextCheckContext = { ...ctxOf(a, 'body'), cardWords: /\b(meals|digestive)\b/i };
    expect(standInHeadline('Physical stamina rests on disciplined habits, though digestive rhythms require pacing.', bodyCtx)).toBe(WITHHELD_LINE);
  });
});

describe('run 2 · 3 · a headline that cannot stand is shortened from the body, never the whole card', () => {
  it('profile a: stuck and chapter (over 14 words), yogas and year (chart terms) now deliver; c lagna (18 words) too', () => {
    const a = validatePersonalDoc(runs.a.raw, inputFor(runs.a.pack));
    for (const id of ['stuck', 'chapter', 'yogas', 'year'] as const) {
      expect(a.cardStatus[id], id).toBe('ok');
      const c = a.doc.cards[id]!;
      expect(c.headline.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(CHART_TERMS.some((re) => re.test(c.headline))).toBe(false);
    }
    expect(a.gaps.filter((g) => /headline replaced/.test(g)).length).toBeGreaterThanOrEqual(4);
    expect(Object.values(a.cardStatus).filter((s) => s === 'withheld')).toEqual([]);
    const c = validatePersonalDoc(runs.c.raw, inputFor(runs.c.pack));
    expect(c.cardStatus.lagna).toBe('ok');
    expect(c.doc.cards.lagna!.headline).not.toMatch(/executive/i);
  });

  it('the moved sentence leaves the body when other sentences remain; no body sentence under 15 words gives the area title', () => {
    expect(headlineFromBody(['One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen. Short one here.'])).toBe('Short one here.');
    expect(headlineFromBody(['One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen.'])).toBeNull();
  });
});

describe('run 2 · 6 · the body ladder keeps its passing steps', () => {
  it('a: "meals" (best) and "nervous system" (floor) drop two steps; practical and drift stand', () => {
    const v = validatePersonalDoc(runs.a.raw, inputFor(runs.a.pack));
    const l = v.doc.cards.body!.ladder;
    expect(l).not.toBeNull();
    expect(l!.best).toBe('');
    expect(l!.floor).toBe('');
    expect(l!.practical).not.toBe('');
    expect(v.gaps).toEqual(expect.arrayContaining([expect.stringMatching(/^body: ladder step best dropped \(diet or medicine advice \(meals\)\)/)]));
    for (const r of [runs.b, runs.c]) expect(validatePersonalDoc(r.raw, inputFor(r.pack)).doc.cards.body!.ladder, r.id).not.toBeNull();
  });

  it('"nervous depletion" and "nervous exhaustion" no longer pass the body card', () => {
    const v = validatePersonalDoc(runs.a.raw, inputFor(runs.a.pack));
    const face = [...v.doc.cards.body!.body, ...v.doc.cards.body!.patterns.map((p) => p.text)].join(' ');
    expect(face).not.toMatch(/nervous (depletion|exhaustion)/i);
  });
});

describe('run 2 · 4 · the hero question tests its own claim', () => {
  it('the three run 2 questions ("your business", "career and family life", "health and spiritual practice") are dropped', () => {
    for (const r of Object.values(runs)) {
      const v = validatePersonalDoc(r.raw, inputFor(r.pack));
      expect(v.doc.hero.question, r.id).toBeNull();
      expect(v.gaps.some((g) => /hero: question dropped \(the question (names none of its claim's matters|also asks about another life matter)/.test(g)), r.id).toBe(true);
    }
  });

  it('code builds the question from the S5 row: one matter, the since date, in plain words; it passes its own check', () => {
    const inp = inputFor(runs.a.pack);
    expect(inp.heroClaim).toMatchObject({ claimId: HEAVY, matters: ['ideas_and_children', 'luck_and_belief', 'gains_and_network'], since: '2026-11-05' });
    // no children stated, so the people drop "children"
    expect(inp.heroClaim!.who).toEqual(['friends_and_elder_siblings']);
    expect(inp.heroClaim!.draft).toBe('Since 5 Nov 2026, has there been more strain around your creative projects and new ideas?');
    expect(questionMatterProblem(HEAVY, inp.heroClaim!.draft, inp)).toBeNull();
    expect(mattersOfClaim('claim:stuck.work_load')).toEqual(['work_load_and_health']);
    // c's run 2 question names the belief matter but also health: two things at once, dropped
    expect(questionMatterProblem(HEAVY, 'Has your focus on health and spiritual practice felt heavier since 5 Nov 2026?', inp)).toMatch(/another life matter \(health\)/);
    const suffix = personalizerSuffix(inp, '2026-11-09');
    expect(suffix).toContain(`claim: ${HEAVY}`);
    expect(suffix).toContain('draft: Since 5 Nov 2026');
  });
});

describe('run 2 · 10 · the hero rests on the `now` brief; `always` is never a date', () => {
  it('the now brief (S3 heaviest window, S5 rows, dates) reaches the Personalizer, and its claim may carry the question', () => {
    const { hash: _h, ...profile } = runs.c.pack;
    const ctx = run2Ctx(profile);
    const now = nowArea(ctx);
    expect(now.ledgerRows).toContain('risk:kaala/3/Ke@2026-11-05');
    const { slice, input } = buildPersonalizerSlice(ctx, oracleOut, [now]);
    expect(input.now!.ledger).toEqual([expect.objectContaining({ matter: 'ideas_and_children', what: 'detachment', since: '2026-11-05', until: '2026-12-12' })]);
    expect(JSON.stringify(input.now!.ledger)).not.toMatch(/"Ke"|planet|house/);
    expect(input.heroClaim!.claimId).toBe('claim:now.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network');
    expect(slice.suffix).toContain('## RIGHT NOW');
    expect(slice.suffix).toContain('- row risk:kaala/3/Ke@2026-11-05: ideas_and_children · detachment');
    const raw = structuredClone(runs.c.raw);
    raw.hero = { ...raw.hero, questionClaimId: input.heroClaim!.claimId, questionText: 'Since 5 Nov 2026, has your faith or your circle of friends felt further away?' };
    const v = validatePersonalDoc(raw, input);
    expect(v.doc.hero.question).toEqual({ claimId: input.heroClaim!.claimId, text: expect.stringMatching(/faith/) });
  });

  it('lagna (valid until always) reads "Always"; the hero next check is never "always"', () => {
    expect(areaRange('lagna', 'always', null)).toEqual({ range: 'always', rangeLabel: 'Always' });
    expect(oracleOut.doc.areas.lagna!.validUntil).toBe('always');
    const inp = inputFor(runs.c.pack);
    const v = validatePersonalDoc(runs.c.raw, { ...inp, windows: { ...inp.windows, easesAt: 'always' as never, nextSupportFrom: '2026-12-13' } });
    expect(v.doc.hero.nextCheck).toBe('2026-12-13');
  });
});

describe('run 2 · 2 · the profile shapes the card: golden documents and the distinctness metric', () => {
  const AREAS = ['stuck', 'chapter', 'drive', 'chapters', 'body', 'lagna'] as const;
  const bodies = (doc: { cards: Partial<Record<string, { headline: string; body: string[] }>> }, id: string) => {
    const c = doc.cards[id];
    return c ? [c.headline, ...c.body].join(' ') : '';
  };
  const golden = Object.fromEntries(Object.entries(GOLDEN).map(([id, g]) => [id, validatePersonalDoc(structuredClone(g as GoldenDoc), inputFor(runs[id as 'a' | 'b' | 'c'].pack))]));
  const replay = Object.fromEntries(Object.entries(runs).map(([id, r]) => [id, validatePersonalDoc(r.raw, inputFor(r.pack))]));

  it('the golden documents pass the validator whole: every card ok, every question kept, nothing dropped', () => {
    for (const [id, v] of Object.entries(golden)) {
      expect(v.gaps.filter((g) => !/no card returned/.test(g)), id).toEqual([]);
      for (const a of AREAS) expect(v.cardStatus[a], `${id} ${a}`).toBe('ok');
      expect(v.doc.hero.question, id).not.toBeNull();
    }
  });

  it('distinctness: for every area the three people\'s cards share at most 25 % of their words (token Jaccard); run 2 shared far more', () => {
    const MAX_JACCARD = 0.25;
    const rows: string[] = [];
    let replayMax = 0;
    let goldenMax = 0;
    for (const a of AREAS) {
      const g = pairwiseJaccard({ a: bodies(golden.a!.doc, a), b: bodies(golden.b!.doc, a), c: bodies(golden.c!.doc, a) });
      const r = pairwiseJaccard({ a: bodies(replay.a!.doc, a), b: bodies(replay.b!.doc, a), c: bodies(replay.c!.doc, a) });
      rows.push(`${a}: golden max ${g.max} ${JSON.stringify(g.pairs)} · run 2 max ${r.max} ${JSON.stringify(r.pairs)}`);
      expect(g.max, a).toBeLessThanOrEqual(MAX_JACCARD);
      goldenMax = Math.max(goldenMax, g.max);
      replayMax = Math.max(replayMax, r.max);
    }
    console.log(`[distinctness] ${rows.join('\n')}\n[distinctness] golden max ${goldenMax} · run 2 max ${replayMax}`);
    expect(goldenMax).toBeLessThan(replayMax);
    expect(tokenJaccard('the same words here', 'the same words here')).toBe(1);
  });

  it('the runtime metric: the Oracle echo per card is logged in the result and flags a copy, never drops it', () => {
    const v = replay.a!;
    expect(v.metrics.echoMax).toBeGreaterThan(0);
    for (const g of Object.values(golden)) expect(g.metrics.echoMax).toBeLessThan(0.6);
    console.log(`[oracle echo] run 2 a mean ${v.metrics.echoMean} max ${v.metrics.echoMax} (${v.metrics.echoMaxArea}); golden a mean ${golden.a!.metrics.echoMean} max ${golden.a!.metrics.echoMax}`);
    const copy = (oracleOut.doc.areas as Record<string, { paragraphs: string[] }>).drive!.paragraphs[0]!;
    expect(oracleEcho(copy, copy)).toBe(1);
    const raw = structuredClone(runs.b.raw);
    const drive = raw.cards.find((c) => c.areaId === 'drive')!;
    drive.body = ['This endows you with unyielding ambition, courage, and an instinct for wealth accumulation through specialized knowledge and strategic enterprise.', 'Your drive draws lasting endurance from your standing at work.'];
    drive.sources = ['drive.p1', 'drive.p1', 'drive.p2'];
    const flagged = validatePersonalDoc(raw, inputFor(runs.b.pack));
    expect(flagged.cardStatus.drive).toBe('ok');
    expect(flagged.metrics.flagged).toContain('drive');
    expect(flagged.gaps).toEqual(expect.arrayContaining([expect.stringMatching(/^drive: flag: the card repeats \d+ % of the Oracle's word sequences \(not dropped\)$/)]));
  });

  it('career-stage words: dropped for the 25–35 founder, allowed for the 46–60 senior leader', () => {
    const a = inputFor(runs.a.pack);
    const b = inputFor(runs.b.pack);
    const ctx = (inp: PersonalizerInput): TextCheckContext => ({ gender: inp.profile.gender, dates: { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() }, stageWords: seniorStageWordsFor(inp.profile) });
    for (const t of ['You project the aura of an experienced guide or seasoned professional.', 'Anchor your primary ambitions around mentorship and advisory leadership.'])
      expect(textProblem(t, ctx(a)), t).toMatch(/career-stage word/);
    expect(textProblem('It is a fair time to plan succession and mentor the people who will take over.', ctx(b))).toBeNull();
    const v = validatePersonalDoc(runs.a.raw, a);
    const face = Object.values(v.doc.cards).flatMap((c) => [c!.headline, ...c!.body, ...(c!.ladder ? Object.values(c!.ladder) : []), ...c!.patterns.map((p) => p.text)]).join(' ');
    expect(face).not.toMatch(/seasoned|experienced guide|mentorship|advisory/i);
  });

  it('the retired profile: "meetings", "labor" and "professional" are role words now', () => {
    const c = validatePersonalDoc(runs.c.raw, inputFor(runs.c.pack));
    const face = Object.values(c.doc.cards).flatMap((x) => [x!.headline, ...x!.body, ...(x!.ladder ? Object.values(x!.ladder) : [])]).join(' ');
    expect(face).not.toMatch(/\b(meetings|labor|professional)\b/i);
  });

  it('the prompt states the band register, the work examples, the stage rule and the Now-group focus lens', () => {
    const a = personalizerSuffix(inputFor(runs.a.pack), '2026-11-09');
    expect(a).toContain('- Age band 25 to 35: this person usually arrives with a decision');
    expect(a).toContain('- Work examples may be about: a business they run with staff');
    expect(a).toMatch(/- Career stage: .*"seasoned"/);
    expect(a).toContain('lens of the Now group cards (Where you get stuck, This chapter)');
    expect(a).toContain('Love status is "single"');
    const b = personalizerSuffix(inputFor(runs.b.pack), '2026-11-09');
    expect(b).not.toContain('- Career stage:');
    const c = personalizerSuffix(inputFor(runs.c.pack), '2026-11-09');
    expect(c).toContain('- Age band 60 and over: this person usually arrives with rest, meaning');
  });
});

describe('run 2 · 5 · a family finding cut at MAX_TOKENS never reaches the Oracle as it is', () => {
  const dasha = oracleRun.familyFindings.find((f) => f.family === 'family.dasha')!.text;

  it('the run 2 family.dasha finding keeps only its complete sentences', () => {
    expect(dasha.trimEnd().endsWith('The convergence of the Kaala PD (')).toBe(true);
    const kept = completeSentencesOf(dasha);
    expect(kept).not.toContain('The convergence of the Kaala PD (');
    expect(kept.endsWith('`{activation:yogini/2/Su@2026-09-17}`.')).toBe(true);
    expect(kept).not.toContain('…');
    expect(completeSentencesOf('*   **Systemic Synthesis:** The convergence of the Kaala PD (')).toBe('');
    // the readers' cap was 2,000 and the cut call used 654 + 1,342 of it
    const call = summary.calls.find((c) => c.agent === 'family.dasha')!;
    expect(call.finishReason).toBe('MAX_TOKENS');
  });

  describe('in a build', () => {
    const ENV = { READING_EXPLICIT_CACHE: '1', READING_MODEL_READER: 'gemini-3.1-flash-lite', READING_MODEL_ORACLE: 'gemini-3.8-flash', SELF_PERSONALIZER_MODEL: 'gemini-3.1-flash-lite', SELF_READING_MAX_SPEND_USD: '1' } as const;
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      for (const [k, v] of Object.entries(ENV)) {
        saved[k] = process.env[k];
        process.env[k] = v;
      }
      clearReaderMemo();
      clearPendingIndividualRecycles();
    });
    afterEach(() => {
      for (const k of Object.keys(ENV)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      clearReaderMemo();
      clearPendingIndividualRecycles();
    });

    it('raises the readers\' cap to 4,000; the cut finding passes complete sentences with a note, a gap, and is never cached', async () => {
      const log: string[] = [];
      const base = makeGemini(log);
      const sent: GeminiCallOptions[] = [];
      const call = async (o: GeminiCallOptions): Promise<GeminiResult> => {
        sent.push(o);
        if (o.node === 'family.dasha') return { ...geminiResult(dasha), finishReason: 'MAX_TOKENS' };
        if (o.node === 'family.year') return { ...geminiResult('*   **Outlook:** The year opens with'), finishReason: 'MAX_TOKENS' };
        return base(o);
      };
      const db = makePrisma();
      const r = await runSelfV2Build(
        { prisma: db.prisma, callGemini: call, ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: () => new Date('2026-11-09T12:00:00Z') },
        { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() },
      );
      expect(r.status).toBe('ok');
      for (const o of sent.filter((x) => x.node.startsWith('family.'))) expect(o.maxOutputTokens).toBe(4000);
      const oracleParts = sent.filter((x) => x.node.startsWith('self.oracle.v2.')).flatMap((x) => x.parts).join('\n');
      expect(oracleParts).not.toContain('The convergence of the Kaala PD (');
      expect(oracleParts).toContain(CUT_FINDING_NOTE);
      expect(oracleParts).not.toContain('The year opens with');
      expect(r.gaps).toEqual(expect.arrayContaining([expect.stringMatching(/^family\.dasha: cut at the output cap \(MAX_TOKENS\); \d+ of \d+ chars kept/), 'family.year: cut at the output cap (MAX_TOKENS); no complete sentence; not passed to the Oracle']));
      expect(r.oracle!.familyFindings.map((f) => f.family)).not.toContain('family.year');
      // the personalizer metric is part of the result
      expect(r.cards!.metrics).toEqual(expect.objectContaining({ echoMean: expect.any(Number), flagged: expect.any(Array) }));
    });
  });
});

describe('run 2 · 9 · the Oracle thought count: "not reported", never a measured 0', () => {
  it('the run 2 record holds only the mapped 0 for the Oracle (the raw usageMetadata was not kept), so it cannot tell', () => {
    const oracle = summary.calls.filter((c) => c.agent === 'self.oracle');
    expect(oracle.map((c) => c.thoughtTokens)).toEqual([0, 0, 0]);
    // the flash-lite readers at `medium` do report a count, so the field exists on that model
    expect(summary.calls.filter((c) => c.agent.startsWith('family.')).every((c) => c.thoughtTokens > 0)).toBe(true);
  });

  it('a usage without thoughtsTokenCount is recorded as not reported: null in the timing view and in the Lab', () => {
    const res = { ...geminiResult('{}'), usage: { ...geminiResult('{}').usage!, thoughtTokens: 0, thoughtTokensReported: false } };
    const t = timingOf('self.oracle', 'oracle.a', 'gemini-3.8-flash', res, 10, 'ok');
    expect(t.thoughtTokensReported).toBe(false);
    expect(t.thoughtTokens).toBe(0); // the cost arithmetic still adds nothing
    expect(reportedThoughtTokens(t)).toBeNull();
    const reported = timingOf('self.oracle', 'oracle.a', 'gemini-3.8-flash', { ...res, usage: { ...res.usage!, thoughtTokens: 12, thoughtTokensReported: true } }, 10, 'ok');
    expect(reportedThoughtTokens(reported)).toBe(12);
    expect(runOf({ id: 'r', agent_id: 'self.oracle', thought_tokens: 0, output_summary: { thoughtsReported: false } }).thoughtTokens).toBeNull();
    expect(runOf({ id: 'r', agent_id: 'self.oracle', thought_tokens: 0, output_summary: { thoughtsReported: true } }).thoughtTokens).toBe(0);
  });
});

describe('run 2 · the profile fixtures', () => {
  it('makeProfile still builds a 36–45 profile with no stage-word ban when the level is senior', () => {
    expect(seniorStageWordsFor(makeProfile({ ageBand: '36_45', facts: { work: { status: 'yes', level: 'senior_leader' } } }))).toBeNull();
    expect(seniorStageWordsFor(makeProfile({ ageBand: '36_45', facts: { work: { status: 'yes', level: 'employee' } } }))).not.toBeNull();
    expect(heroClaimFrame(makeCtx(), { doc: { areas: {}, validUntil: 'always' }, patterns: [] } as unknown as OracleV2Output)).toBeNull();
  });
});

describe('run 2 · every matter phrase passes its own question check', () => {
  it('a draft built on any single matter names that matter and no other', async () => {
    const { MATTER_PLAIN } = await import('../../../../../src/reading/self/v2words.js');
    for (const m of Object.keys(MATTER_PLAIN) as Array<keyof typeof MATTER_PLAIN>) {
      const text = `Since 5 Nov 2026, has there been more strain around ${MATTER_PLAIN[m].phrase}?`;
      expect(questionMatterProblem(`claim:now.risk:${m}:x`, text, { heroClaim: null, profile: makeProfile() }), m).toBeNull();
    }
  });
});

describe('run 2 · 8 · the sub-technique load is timed per read; the profile read is in Layer 0', () => {
  it('ms carries load.digest, kundli, systems, sky, profile, applicability, activation, pressure; profile overlaps the digest', async () => {
    const { runSelfSubTechniques } = await import('../../../../../src/reading/self/sub/index.js');
    const { digestView } = await import('../../../../../src/reading/digest/load.js');
    const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/research-calibration.json'), 'utf8')) as {
      digest: unknown[];
      activation: Array<{ system: string }>;
      systems: Array<{ system: string; family: string }>;
    };
    const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
    const RTT = 120;
    const rt = <T>(v: T, trips = 1) => new Promise<T>((r) => setTimeout(() => r(v), RTT * trips));
    const order: string[] = [];
    const prisma = {
      kundli: { findUnique: () => rt({ preferred_dasha: 'dwisatpathi' }) },
      auth: { findUnique: () => (order.push('profile'), rt({ date_of_birth: '1950-05-01', gender: null, role: 'novice' })) },
      personFact: { findMany: () => rt([]) },
      agentRun: { create: () => rt({}) },
    } as unknown as import('@prisma/client').PrismaClient;
    const t0 = performance.now();
    const out = await runSelfSubTechniques(
      {
        prisma,
        loadDigest: () => (order.push('digest'), rt(view, 2)),
        systemsPresent: () => rt(FIX.systems),
        activationFor: (_p, _k, q) => (order.push('activation'), rt(FIX.activation.filter((r) => !q.systems || q.systems.includes(r.system)) as never)),
        loadTransit: () => rt(null),
        loadPressure: () => rt({ inventory: null, source: 'none' as const, gaps: [] }),
      },
      { userId: 'u1', kundliId: 'k1', asOf: '2026-11-07' },
    );
    const ms = performance.now() - t0;
    if ('status' in out) throw new Error('preparing');
    for (const k of ['digest', 'kundli', 'systems', 'sky', 'profile', 'applicability', 'activation', 'pressure']) expect(out.ms[`load.${k}`], k).toBeTypeOf('number');
    expect(out.ms['load.activationRows']).toBeGreaterThan(0);
    // the profile read starts before the activation read (Layer 0), not after it
    expect(order.indexOf('profile')).toBeLessThan(order.indexOf('activation'));
    // critical path: digest (2) → activation (1) → logs (1); the profile (≤ 2) runs beside the digest
    expect(ms).toBeLessThan(RTT * 6);
  });
});
