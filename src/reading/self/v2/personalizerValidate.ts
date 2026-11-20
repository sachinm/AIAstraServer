/**
 * The Personalizer validator (docs/reading-engine/66 §4.1, §4.7). The Personalizer never sees the chart; this makes
 * sure it did not add any: every headline and body sentence cites a source (an Oracle paragraph id `<area>.p<n>` or an
 * evidence key) present in the Oracle document, and every card date window and pattern span is one the Oracle named.
 * No word filters (docs/reading-engine/82): words, tone, the person's situation and caps are the prompt's job. Engine
 * names and internal keys are redacted in place. A card with no sourced body is withheld and the Oracle headline stands in.
 *
 * Words and patterns only; nothing astrological is computed.
 */
import type { AreaDate } from '../areaDoc.js';
import { getSelfV2OracleEchoFlag } from '../../../config/env.js';
import { MATTER_PLAIN, mattersOfClaim } from '../v2words.js';
import { wordCount } from '../words.js';
import type {
  CardStatus,
  HeroDoc,
  LadderSteps,
  Matter,
  OracleV2Output,
  PersonalCard,
  PersonalCardDoc,
  PersonalizerInput,
  PersonalizerMetrics,
  PersonalPattern,
  SelfV2AreaId,
  StatedGender,
  Tone,
  WindowRef,
} from '../v2types.js';
import { SELF_V2_AREAS } from '../v2types.js';
import { claimKeysOf } from './oracle.js';
import { oracleEcho } from './profileFit.js';
import { paragraphId } from './slices.js';
import { oracleParagraphIds, validateIllustration } from './storyteller.js';

export const HEADLINE_MAX_WORDS = 14;
/**
 * The plain line a withheld card shows when no safe stand-in headline exists (doc 66 replay run 2, failure 3): never a
 * redacted Oracle headline with gaps in it.
 */
export const WITHHELD_LINE = 'Not enough in your chart to say this with confidence.';
/** a withheld card's Oracle stand-in may run a little longer than a written headline, never past this */
export const STAND_IN_MAX_WORDS = 22;
/** the fewest ladder steps a card keeps after failing steps are dropped (run 2 failure 5) */
export const LADDER_MIN_STEPS = 2;
export const BODY_MAX_WORDS = 120;
export const BODY_PARAGRAPHS_MAX = 3;
export const PATTERNS_MAX = 3;
export const TONES: readonly Tone[] = ['demanding', 'heavy', 'mixed', 'easing', 'steady', 'open'];
/** the areas whose certainty decides whether the hero is shown (a split or merely possible verdict is withheld) */
export const LIVE_AREAS: readonly SelfV2AreaId[] = ['diagnosis', 'stuck', 'chapter'];

import { daysIn, frameOf, redactEngineDeep, redactEngineText, type DateFrame } from '../textChecks.js';

// moved out unchanged (plan "retire the v2 Self reading", server step 1); re-exported so every import keeps working
export { daysIn, ENGINE_NAMES, frameOf, INTERNAL_ID, redactChartTerms, redactEngineDeep, redactEngineText, type DateFrame, type TextCheckContext } from '../textChecks.js';

const escapeRe = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
/** a whole-word, case-insensitive matcher over a reviewed words table; null for an empty table */
export const wordsMatcher = (words: readonly string[]): RegExp | null =>
  words.length ? new RegExp(`\\b(${words.map(escapeRe).join('|')})\\b`, 'i') : null;

/**
 * The plain words that show a sentence speaks to a stated focus (`self.focus` values). A reviewed words table, used to
 * flag a hero that does not lead with the person's focus; it never drops text.
 */
export const FOCUS_WORDS: Readonly<Record<string, readonly string[]>> = {
  career: ['work', 'career', 'job', 'business', 'craft'],
  money: ['money', 'income', 'savings', 'spending', 'finances', 'financial', 'wealth', 'earn'],
  love: ['love', 'partner', 'heart', 'relationship', 'together'],
  family: ['family', 'home', 'children', 'parents', 'household'],
  health: ['health', 'body', 'energy', 'rest', 'sleep', 'strength', 'vitality', 'pace'],
  spirituality: ['meaning', 'faith', 'inner', 'spirit', 'spiritual', 'prayer', 'quiet', 'reflection', 'purpose', 'peace'],
  home: ['home', 'house', 'household', 'family'],
  learning: ['study', 'learning', 'learn', 'course', 'skill'],
  travel: ['travel', 'journey', 'trip', 'abroad', 'move'],
  creativity: ['creative', 'creativity', 'ideas', 'making', 'craft', 'art'],
};

/** true when the text names one of the stated focus areas in plain words (an unknown focus key counts as named) */
export function focusNamed(text: string, focus: readonly string[]): boolean {
  return focus.some((f) => {
    const words = FOCUS_WORDS[f.toLowerCase()];
    return !words || Boolean(wordsMatcher(words)?.test(text));
  });
}

/** the area's display title: the neutral label for a date whose own label could not stand */
export const areaTitle = (id: string): string => SELF_V2_AREAS.find((a) => a.id === id)?.title ?? 'This stretch';


/**
 * Every date the Oracle document carries: area dates and actions, patterns, validUntil days. `pairs` holds only the
 * Oracle's dated windows (area `dates` and pattern spans), never an action's span: a card date is a window the Oracle
 * named, copied exactly (doc 66 replay failure 8: "2026-11-09 → 2026-12-12: Current composure period" was an action).
 */
export function oracleDates(out: OracleV2Output): DateFrame {
  const days: string[] = [];
  const pairs: Array<[string, string]> = [];
  for (const a of Object.values(out.doc.areas)) {
    if (!a) continue;
    for (const d of a.dates) {
      days.push(d.from, d.to);
      pairs.push([d.from, d.to]);
    }
    for (const d of a.actions) days.push(d.from, d.to);
    if (a.validUntil !== 'always') days.push(a.validUntil);
  }
  for (const p of out.patterns) {
    for (const d of [p.since, p.until]) if (d) days.push(d);
    if (p.since && p.until) pairs.push([p.since, p.until]);
  }
  if (out.doc.validUntil !== 'always') days.push(out.doc.validUntil);
  return frameOf(days, pairs);
}

/** The sources a sentence may cite: every paragraph id and every evidence key of the Oracle document. */
export function oracleSources(out: OracleV2Output): Set<string> {
  const s = new Set<string>();
  for (const [id, a] of Object.entries(out.doc.areas)) {
    if (!a) continue;
    a.paragraphs.forEach((_, i) => s.add(paragraphId(id, i)));
    for (const k of a.evidence) s.add(k);
  }
  for (const p of out.patterns) for (const k of p.evidence) s.add(k);
  return s;
}

/** The headline a withheld card shows: the Oracle's own headline (engine names redacted), else WITHHELD_LINE. */
export function standInHeadline(oracleHeadline: string): string {
  const text = redactEngineText(oracleHeadline.replace(/…/g, '').trim());
  return text || WITHHELD_LINE;
}

/**
 * A headline in place of one that cannot stand (doc 66 replay run 2, failure 4): the first body sentence that passes
 * every check and is at most HEADLINE_MAX_WORDS words, or null. The body keeps that sentence only when it would
 * otherwise be left empty.
 */
export function headlineFromBody(body: readonly string[]): string | null {
  for (const p of body) for (const s of sentencesOf(p)) if (wordCount(s) <= HEADLINE_MAX_WORDS) return s;
  return null;
}

export const sentencesOf = (paragraph: string): string[] =>
  paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export interface AlignedSources {
  /** how the card's `sources` were read against its sentences */
  mode: 'per_sentence' | 'body_only' | 'per_paragraph' | 'headline_and_paragraphs' | 'card';
  headline: string | null;
  /** [paragraph][sentence] */
  body: Array<Array<string | null>>;
}

/**
 * Lines the card's `sources` up with its sentences (doc 66 replay failure 3: 21 sentences dropped because the model gave
 * one source per body sentence without the headline, or one per paragraph, and the strict one-per-sentence reading
 * shifted every source by one). In order:
 * - one per sentence (headline first): read in order; a source not in the Oracle drops its sentence;
 * - one per body sentence: the headline takes the card's first valid source;
 * - one per paragraph, or the headline then one per paragraph: every sentence of a paragraph takes its paragraph's;
 * - any other count: every sentence takes the card's first valid source. A card none of whose sources is in the
 *   Oracle document stays unsourced and is dropped (the truly unsourced case).
 */
export function alignSources(srcs: readonly string[], sentencesPerParagraph: readonly number[], known: ReadonlySet<string>): AlignedSources {
  const n = sentencesPerParagraph.reduce((a, b) => a + b, 0);
  const paras = sentencesPerParagraph.length;
  const firstValid = srcs.find((s) => known.has(s)) ?? null;
  const byParagraph = (offset: number) => sentencesPerParagraph.map((k, i) => Array.from({ length: k }, () => srcs[offset + i] ?? null));
  const positional = (offset: number) => {
    let i = offset;
    return sentencesPerParagraph.map((k) => Array.from({ length: k }, () => srcs[i++] ?? null));
  };
  if (srcs.length === n + 1) return { mode: 'per_sentence', headline: srcs[0] ?? null, body: positional(1) };
  if (srcs.length === n && n > 0) return { mode: 'body_only', headline: firstValid, body: positional(0) };
  if (srcs.length === paras && paras > 0) return { mode: 'per_paragraph', headline: firstValid, body: byParagraph(0) };
  if (srcs.length === paras + 1 && paras > 0) return { mode: 'headline_and_paragraphs', headline: srcs[0] ?? null, body: byParagraph(1) };
  return { mode: 'card', headline: firstValid, body: sentencesPerParagraph.map((k) => Array.from({ length: k }, () => firstValid)) };
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strOrNull = (v: unknown): string | null => str(v) || null;

export interface PersonalizerValidation {
  doc: PersonalCardDoc;
  cardStatus: Partial<Record<SelfV2AreaId, CardStatus>>;
  gaps: string[];
  metrics: PersonalizerMetrics;
}

/** an Oracle area's own text (headline and paragraphs), the measure an Oracle echo is taken against */
const oracleAreaText = (a: { headline: string; paragraphs: readonly string[] }): string => [a.headline, ...a.paragraphs].join(' ');

/**
 * The Oracle-echo metric (run 2 failure 1): per delivered card, the share of its headline and body trigrams that copy
 * its Oracle area. Logged per build; a card over SELF_V2_ORACLE_ECHO_FLAG is flagged in the gaps, never dropped.
 */
export function personalizerMetrics(doc: PersonalCardDoc, oracle: OracleV2Output, ok: readonly SelfV2AreaId[]): PersonalizerMetrics {
  const oracleEchoBy: PersonalizerMetrics['oracleEcho'] = {};
  for (const id of ok) {
    const c = doc.cards[id];
    const a = oracle.doc.areas[id as keyof typeof oracle.doc.areas];
    if (!c || !a) continue;
    oracleEchoBy[id] = Math.round(oracleEcho([c.headline, ...c.body].join(' '), oracleAreaText(a)) * 1000) / 1000;
  }
  const vals = Object.entries(oracleEchoBy) as Array<[SelfV2AreaId, number]>;
  const flag = getSelfV2OracleEchoFlag();
  const max = vals.reduce<[SelfV2AreaId | null, number]>((m, [id, v]) => (v > m[1] ? [id, v] : m), [null, 0]);
  return {
    oracleEcho: oracleEchoBy,
    echoMean: vals.length ? Math.round((vals.reduce((n, [, v]) => n + v, 0) / vals.length) * 1000) / 1000 : 0,
    echoMax: max[1],
    echoMaxArea: max[0],
    flagged: vals.filter(([, v]) => v > flag).map(([id]) => id),
  };
}

/** Parses the Personalizer's JSON; null when it is not the document's shape. */
export function parsePersonalDoc(text: string): { hero: Obj; cards: unknown[] } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      raw = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  const o = obj(raw);
  if (!Array.isArray(o.cards)) return null;
  return { hero: obj(o.hero), cards: o.cards };
}

/** The hero is withheld when the live areas are missing, all merely possible, or split between strong and possible. */
export function heroSplit(out: OracleV2Output): boolean {
  const live = LIVE_AREAS.map((id) => out.doc.areas[id as keyof typeof out.doc.areas]).filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (!live.length) return true;
  const cs = new Set(live.map((a) => a.certainty));
  if (cs.size === 1 && cs.has('possible')) return true;
  return cs.has('strong') && cs.has('possible');
}

/**
 * Makes the Personalizer's document safe to show (doc 66 §4.1). `strip` is the engine's six-month window strip (code
 * fills the hero's strip and dates; the model writes only words).
 */
export function validatePersonalDoc(
  parsed: { hero: Obj; cards: unknown[] },
  input: PersonalizerInput,
  strip: readonly WindowRef[] = [],
): PersonalizerValidation {
  const oracle = input.oracle;
  const gaps: string[] = [];
  const sources = oracleSources(oracle);
  const paragraphIds = oracleParagraphIds(oracle);
  const oDates = oracleDates(oracle);
  const gender = input.profile.gender;
  const cards: PersonalCardDoc['cards'] = {};
  const cardStatus: PersonalizerValidation['cardStatus'] = {};
  const seen = new Set<string>();

  for (const raw of parsed.cards) {
    const c = obj(raw);
    const areaId = str(c.areaId) as SelfV2AreaId;
    const oArea = oracle.doc.areas[areaId as keyof typeof oracle.doc.areas];
    if (!oArea) {
      if (areaId) gaps.push(`${areaId}: not an area of the Oracle document; dropped`);
      continue;
    }
    if (seen.has(areaId)) {
      gaps.push(`${areaId}: returned twice; the second dropped`);
      continue;
    }
    seen.add(areaId);
    const rawParagraphs = arr(c.body).slice(0, BODY_PARAGRAPHS_MAX + 2).map((p) => sentencesOf(str(p)));
    const aligned = alignSources(arr(c.sources).map(str), rawParagraphs.map((p) => p.length), sources);
    const valid = (s: string | null): string | null => (s && sources.has(s) ? s : null);
    const kept: string[] = [];
    const bodySentenceSources: Array<[string, string]> = [];
    // headline: sentence 0
    let headline = str(c.headline);
    const hSrc = valid(aligned.headline);
    const hProblem = !headline ? 'empty' : !hSrc ? 'no source in the Oracle document' : null;
    if (hProblem) {
      gaps.push(`${areaId}: headline dropped (${hProblem})`);
      headline = '';
    }
    // body: each sentence with the source the alignment gave it
    const body: string[] = [];
    for (const [pi, sentences] of rawParagraphs.entries()) {
      const keptSentences: string[] = [];
      for (const [si, s] of sentences.entries()) {
        const src = valid(aligned.body[pi]?.[si] ?? null);
        if (!src) {
          gaps.push(`${areaId}: a body sentence dropped (no source in the Oracle document)`);
          continue;
        }
        keptSentences.push(s);
        bodySentenceSources.push([s, src!]);
      }
      if (keptSentences.length && body.length < BODY_PARAGRAPHS_MAX) body.push(keptSentences.join(' '));
    }

    // a headline that cannot stand never withholds a card whose body passes (run 2 failure 4): the first passing body
    // sentence of at most 14 words takes its place, and leaves the body when the body keeps other sentences
    if (!headline && body.length) {
      const fromBody = headlineFromBody(body);
      if (fromBody) {
        headline = fromBody;
        const rest = body.map((p) => sentencesOf(p).filter((x) => x !== fromBody).join(' ')).filter(Boolean);
        if (rest.length) {
          body.splice(0, body.length, ...rest);
          // the moved sentence's source leads the card's sources
          const i = bodySentenceSources.findIndex(([x]) => x === fromBody);
          if (i >= 0) {
            kept.push(bodySentenceSources[i]![1]);
            bodySentenceSources.splice(i, 1);
          }
        }
        gaps.push(`${areaId}: headline replaced by the first body sentence that passes (${wordCount(fromBody)} words)`);
      } else {
        headline = areaTitle(areaId);
        gaps.push(`${areaId}: headline replaced by the area title (no body sentence of at most ${HEADLINE_MAX_WORDS} words)`);
      }
    } else if (headline) kept.push(hSrc!);
    kept.push(...bodySentenceSources.map(([, src]) => src));

    if (!body.length) {
      const standIn = standInHeadline(oArea.headline);
      gaps.push(`${areaId}: withheld (no sourced body sentence); ${standIn === WITHHELD_LINE ? 'the plain withheld line stands in' : 'the Oracle headline stands in'}`);
      cards[areaId] = {
        areaId,
        headline: standIn,
        body: [],
        patterns: [],
        ladder: null,
        dates: [],
        certainty: oArea.certainty,
        sources: [],
      };
      cardStatus[areaId] = 'withheld';
      continue;
    }

    const patterns: PersonalPattern[] = [];
    for (const rawPat of arr(c.patterns)) {
      const p = obj(rawPat);
      const text = str(p.text);
      const kind = str(p.kind) as PersonalPattern['kind'];
      const source = str(p.source);
      const since = strOrNull(p.since);
      const until = strOrNull(p.until);
      const problem = !text
        ? 'empty'
        : !['risk', 'watch', 'strength'].includes(kind)
          ? 'unknown kind'
          : !sources.has(source)
            ? 'no source in the Oracle document'
            : [since, until].some((d) => d && !oDates.days.has(d))
              ? 'a date not in the Oracle document'
              : since && until && !oDates.pairs.has(`${since}|${until}`)
                ? `the span ${since}..${until} is not a window of the Oracle document`
                : null;
      if (problem) {
        gaps.push(`${areaId}: a pattern dropped (${problem})`);
        continue;
      }
      patterns.push({ text, kind, since, until, source });
      if (patterns.length === PATTERNS_MAX) break;
    }

    let ladder: LadderSteps | null = null;
    const l = obj(c.ladder);
    if (Object.keys(l).length) {
      // the ladder stands while at least LADDER_MIN_STEPS steps are written (an empty step stays empty)
      const steps: LadderSteps = { best: str(l.best), practical: str(l.practical), drift: str(l.drift), floor: str(l.floor) };
      const standing = Object.values(steps).filter(Boolean).length;
      if (standing >= LADDER_MIN_STEPS) ladder = steps;
      else gaps.push(`${areaId}: ladder dropped (${standing} of 4 steps passed; at least ${LADDER_MIN_STEPS} needed)`);
    }

    const dates: AreaDate[] = [];
    for (const rawD of arr(c.dates)) {
      const d = obj(rawD);
      const from = str(d.from);
      const to = str(d.to) || from;
      let label = str(d.label);
      if (!oDates.pairs.has(`${from}|${to}`)) {
        gaps.push(`${areaId}: date ${from}..${to} is not a window of the Oracle document; dropped`);
        continue;
      }
      // the date stands on the Oracle; a missing label becomes the area's title
      if (!label) label = areaTitle(areaId);
      dates.push({ from, to, label });
    }

    // storyteller (2026-11-09): its own rule set; a failing illustration is dropped alone, never the card
    const illustration = validateIllustration(c.illustration, areaId, paragraphIds, () => null, gaps);
    cards[areaId] = { areaId, headline, body, patterns, ladder, dates, certainty: oArea.certainty, sources: kept, ...(illustration ? { illustration } : {}) };
    cardStatus[areaId] = 'ok';
  }

  for (const id of Object.keys(oracle.doc.areas) as SelfV2AreaId[]) {
    if (!cards[id]) {
      const a = oracle.doc.areas[id as keyof typeof oracle.doc.areas]!;
      gaps.push(`${id}: no card returned; withheld, the Oracle headline stands in`);
      cards[id] = { areaId: id, headline: standInHeadline(a.headline), body: [], patterns: [], ladder: null, dates: [], certainty: a.certainty, sources: [] };
      cardStatus[id] = 'withheld';
    }
  }

  // the one step on text (doc 82): engine names and internal keys redacted in place
  const doc: PersonalCardDoc = redactEngineDeep({ hero: validateHero(parsed.hero, input, strip, gaps), cards });
  const metrics = personalizerMetrics(doc, oracle, (Object.entries(cardStatus) as Array<[SelfV2AreaId, CardStatus]>).filter(([, st]) => st === 'ok').map(([id]) => id));
  for (const id of metrics.flagged) gaps.push(`${id}: flag: the card repeats ${Math.round((metrics.oracleEcho[id] ?? 0) * 100)} % of the Oracle's word sequences (not dropped)`);
  return { doc, cardStatus, gaps, metrics };
}

/** The hero: tone from the six words, one sentence and a sub line, one question on a dated claim, withheld when split. */
export function validateHero(raw: Obj, input: PersonalizerInput, strip: readonly WindowRef[], gaps: string[]): HeroDoc {
  const oracle = input.oracle;
  const w = input.windows;
  const toneRaw = str(raw.tone) as Tone;
  const tone: Tone = TONES.includes(toneRaw) ? toneRaw : 'mixed';
  if (!TONES.includes(toneRaw)) gaps.push(`hero: tone ${toneRaw || 'missing'} is not one of the six; mixed used`);
  const sentence = str(raw.sentence);
  if (!sentence) gaps.push('hero: no sentence returned');
  const sub = str(raw.sub);
  const claims = new Set([...claimKeysOf(oracle), ...(input.now?.claims ?? []).map((x) => x.id)]);
  const q = obj(raw.question);
  const qClaimRaw = str(q.claimId) || str(raw.questionClaimId);
  const qClaim = qClaimRaw && !qClaimRaw.startsWith('claim:') ? `claim:${qClaimRaw}` : qClaimRaw;
  const qText = str(q.text) || str(raw.questionText);
  let question: HeroDoc['question'] = null;
  if (qClaim && qText) {
    // the question is kept when its claim is in the Oracle document; its words are the prompt's job (doc 82)
    if (!claims.has(qClaim)) gaps.push(`hero: question dropped (claim ${qClaim} is not in the Oracle document)`);
    else question = { claimId: qClaim, text: qText };
  }
  const split = heroSplit(oracle);
  // storyteller: the hero may carry one illustration under the same rules as a card's
  const illustration = sentence ? validateIllustration(raw.illustration, 'hero', oracleParagraphIds(oracle), () => null, gaps) : null;
  // only real days: an area's 'always' is never a date to check on (run 1 failure 14)
  const nextCheck = [w.easesAt, w.nextSupportFrom].filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > w.asOf).sort()[0] ?? null;
  return {
    tone,
    sentence,
    sub,
    strip: [...strip],
    easesAt: w.easesAt,
    nextCheck,
    question,
    withheld: split || !sentence || raw.withheld === true,
    ...(illustration ? { illustration } : {}),
  };
}

/**
 * The hero question must test its own claim (doc 66 replay run 2, failure 6): the text names at least one of the claim's
 * life matters in plain words (`MATTER_PLAIN`), read from the claim id or, for the code-built hero claim, from its S5
 * row. Null when it does; else why the question is dropped (the API then asks the first missing fact).
 */
export function questionMatterProblem(claimId: string, text: string, input: Pick<PersonalizerInput, 'heroClaim' | 'profile'>): string | null {
  const matters: Matter[] = [...new Set([...(input.heroClaim?.claimId === claimId ? input.heroClaim.matters : []), ...mattersOfClaim(claimId)])];
  if (!matters.length) return `claim ${claimId} names no life matter; the question cannot be checked`;
  const hasChildren = Boolean(input.profile.facts?.children && input.profile.facts.children !== 'none');
  const words = matters.flatMap((m) => [...MATTER_PLAIN[m].words, ...(hasChildren ? (MATTER_PLAIN[m].childWords ?? []) : [])]);
  if (!wordsMatcher(words)?.test(text)) return `the question names none of its claim's matters (${matters.join(', ')})`;
  // one thing at a time: a word that belongs only to another life matter (the person's focus or job, say) is not asked
  const own = new Set(words.map((w) => w.toLowerCase()));
  const others = (Object.keys(MATTER_PLAIN) as Matter[])
    .filter((m) => !matters.includes(m))
    .flatMap((m) => [...MATTER_PLAIN[m].words, ...(MATTER_PLAIN[m].childWords ?? [])])
    .filter((w) => !own.has(w.toLowerCase()));
  const other = wordsMatcher(others)?.exec(text)?.[0];
  return other ? `the question also asks about another life matter (${other})` : null;
}
