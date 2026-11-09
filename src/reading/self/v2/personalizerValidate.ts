/**
 * The Personalizer validator (docs/reading-engine/66 §4.1, §4.7). The Personalizer never sees the chart; this makes
 * sure it did not add any: every headline and body sentence cites a source (an Oracle paragraph id `<area>.p<n>` or an
 * evidence key) present in the Oracle document; every date is one the Oracle document (or, for the hero, the engine's
 * windows) carries; no chart term, engine name, internal id or medical word; no gendered word when the person stated no
 * gender; caps on words. A failing sentence is dropped; a card left with no headline or no body is withheld and the
 * Oracle headline, with chart terms redacted, stands in.
 *
 * Words and patterns only; nothing astrological is computed.
 */
import type { AreaDate } from '../areaDoc.js';
import { wordCount } from '../words.js';
import type {
  CardStatus,
  HeroDoc,
  LadderSteps,
  OracleV2Output,
  PersonalCard,
  PersonalCardDoc,
  PersonalizerInput,
  PersonalPattern,
  SelfV2AreaId,
  StatedGender,
  Tone,
  WindowRef,
} from '../v2types.js';
import { claimKeysOf } from './oracle.js';
import { paragraphId } from './slices.js';

export const HEADLINE_MAX_WORDS = 14;
export const BODY_MAX_WORDS = 120;
export const BODY_PARAGRAPHS_MAX = 3;
export const PATTERNS_MAX = 3;
export const TONES: readonly Tone[] = ['demanding', 'heavy', 'mixed', 'easing', 'steady', 'open'];
/** the areas whose certainty decides whether the hero is shown (a split or merely possible verdict is withheld) */
export const LIVE_AREAS: readonly SelfV2AreaId[] = ['diagnosis', 'stuck', 'chapter'];

/**
 * Words that may never stand on a card face (doc 66 §4.7): planet and sign names, house talk, dasha words, degrees,
 * system names, chart objects. They may appear under Chart details, which is the Oracle's text, not the card.
 */
export const CHART_TERMS: readonly RegExp[] = [
  /\b(sun|moon|mercury|venus|mars|jupiter|saturn|rahu|ketu|surya|chandra|budha|shukra|mangal|guru|shani)\b/i,
  /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|mesha|vrishabha|mithuna|karka|simha|kanya|tula|vrischika|dhanu|makara|kumbha|meena)\b/i,
  /\b(\d{1,2}(st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+(house|lord|bhava)\b/i,
  /\b(house|bhava)\s+\d{1,2}\b/i,
  /\bH\d{1,2}\b/,
  /\bD\d{1,2}\b/,
  /\b(lagna|ascendant|dashas?|mahadasha|antardasha|pratyantardasha|bhukti|nakshatras?|rasi|rashi|navamsa|navamsha|dasamsa|trimsamsa|vargas?|yogas?|doshas?|transits?|retrograde|combust(ion)?|exalted|exaltation|debilitat\w*|neecha|uccha)\b/i,
  /\b(vimshottari|vimsottari|narayana|chara|yogini|ashtottari|kalachakra|tithi|pravesha|varshaphal|varsha|mudda|patyayini|gochara|sade\s*sati|ashtakavarga|bindus?|shadbala|avasthas?|argala|arudha|upapada|karakamsa|atmakaraka|amatyakaraka|karakas?|kendra|trikona|dusthana|kala\s*sarpa|kemadruma|panchang)\b/i,
  /\b(planet|planets|zodiac|horoscope|astrolog\w*|divided)\b/i,
  /\d+\s*°|\b\d+\s+degrees?\b/i,
  /\b\d+\s+(of\s+\d+\s+)?(clocks|systems)\b/i,
];

/** the calculation engine's names (SOUL.md §1) */
export const ENGINE_NAMES = /\b(aiastra_radha|pyjhora|jhora|radha)\b/i;

/** internal ids: evidence keys, claim ids, braces */
export const INTERNAL_ID = /\{|\}|\b(claim|planet|house|point|yoga|activation|annual|window|risk|promise|star):[\w.@/-]+/i;

/** medical words (doc 61 §3): the body card speaks of energy and wear, never a diagnosis */
export const MEDICAL_WORDS = /\b(diagnos\w*|disease|illness|disorder|syndrome|tumou?r|cancerous|diabet\w*|surgery|surgical|infection|chronic|medication|prescription|symptoms?|clinical|patholog\w*|psychiatric)\b/i;

/** gendered words: only when the person stated a gender */
export const GENDERED_WORDS = /\b(he|she|him|her|hers|his|himself|herself|man|woman|men|women|male|female|lady|ladies|gentleman|girl|boy|guy|masculine|feminine|manhood|womanhood|husband|wife|boyfriend|girlfriend)\b/i;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** the days named in a text: ISO days and "16 Feb 2028" style */
export function daysIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of text.matchAll(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi)) {
    const mon = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1;
    out.push(`${m[3]}-${String(mon).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`);
  }
  return out;
}

/** the months named without a day ("May 2027") and the bare years ("in 2027") */
function monthsAndYearsIn(text: string): { months: string[]; years: string[] } {
  const noDays = text.replace(/\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}\b/gi, ' ').replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  const months: string[] = [];
  for (const m of noDays.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi)) {
    months.push(`${m[2]}-${String(MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}`);
  }
  const noMonths = noDays.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}\b/gi, ' ');
  const years = [...noMonths.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]);
  return { months, years };
}

export interface DateFrame {
  days: Set<string>;
  months: Set<string>;
  years: Set<string>;
  pairs: Set<string>;
}

function frameOf(dates: Iterable<string>, pairs: Iterable<[string, string]> = []): DateFrame {
  const f: DateFrame = { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() };
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    f.days.add(d);
    f.months.add(d.slice(0, 7));
    f.years.add(d.slice(0, 4));
  }
  for (const [a, b] of pairs) f.pairs.add(`${a}|${b}`);
  return f;
}

/** Every date the Oracle document carries: area dates and actions, patterns, validUntil days. */
export function oracleDates(out: OracleV2Output): DateFrame {
  const days: string[] = [];
  const pairs: Array<[string, string]> = [];
  for (const a of Object.values(out.doc.areas)) {
    if (!a) continue;
    for (const d of [...a.dates, ...a.actions]) {
      days.push(d.from, d.to);
      pairs.push([d.from, d.to]);
    }
    if (a.validUntil !== 'always') days.push(a.validUntil);
  }
  for (const p of out.patterns) for (const d of [p.since, p.until]) if (d) days.push(d);
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

export interface TextCheckContext {
  gender: StatedGender | null;
  dates: DateFrame;
}

/** Why a piece of card text may not stand, or null when it may. */
export function textProblem(text: string, c: TextCheckContext): string | null {
  if (ENGINE_NAMES.test(text)) return 'engine name';
  if (INTERNAL_ID.test(text)) return 'internal id';
  const term = CHART_TERMS.find((re) => re.test(text));
  if (term) return `chart term (${text.match(term)?.[0] ?? ''})`;
  if (MEDICAL_WORDS.test(text)) return `medical word (${text.match(MEDICAL_WORDS)?.[0] ?? ''})`;
  if (c.gender === null && GENDERED_WORDS.test(text)) return `gendered word with no stated gender (${text.match(GENDERED_WORDS)?.[0] ?? ''})`;
  const bad = daysIn(text).find((d) => !c.dates.days.has(d));
  if (bad) return `date ${bad} is not in the Oracle document`;
  const my = monthsAndYearsIn(text);
  const badMonth = my.months.find((m) => !c.dates.months.has(m));
  if (badMonth) return `month ${badMonth} is not in the Oracle document`;
  const badYear = my.years.find((y) => !c.dates.years.has(y));
  if (badYear) return `year ${badYear} is not in the Oracle document`;
  return null;
}

/** Chart terms and engine names replaced, for an Oracle headline standing in for a withheld card. */
export function redactChartTerms(text: string): string {
  let t = text.replace(new RegExp(ENGINE_NAMES.source, 'gi'), 'the calculations');
  for (const re of CHART_TERMS) t = t.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`), '…');
  return t.replace(/(…\s*){2,}/g, '… ').replace(/\s{2,}/g, ' ').trim();
}

export const sentencesOf = (paragraph: string): string[] =>
  paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strOrNull = (v: unknown): string | null => str(v) || null;

export interface PersonalizerValidation {
  doc: PersonalCardDoc;
  cardStatus: Partial<Record<SelfV2AreaId, CardStatus>>;
  gaps: string[];
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
  const oDates = oracleDates(oracle);
  const gender = input.profile.gender;
  const cardCtx: TextCheckContext = { gender, dates: oDates };
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
    const srcs = arr(c.sources).map(str);
    let si = 0;
    const takeSource = (): string | null => {
      const s = srcs[si++] ?? '';
      return sources.has(s) ? s : null;
    };
    const kept: string[] = [];
    // headline: sentence 0
    let headline = str(c.headline);
    const hSrc = takeSource();
    const hProblem = !headline ? 'empty' : !hSrc ? 'no source in the Oracle document' : wordCount(headline) > HEADLINE_MAX_WORDS ? `over ${HEADLINE_MAX_WORDS} words` : textProblem(headline, cardCtx);
    if (hProblem) {
      gaps.push(`${areaId}: headline dropped (${hProblem})`);
      headline = '';
    } else kept.push(hSrc!);
    // body: each sentence in order, sources[1..]
    const body: string[] = [];
    let words = 0;
    for (const rawP of arr(c.body).slice(0, BODY_PARAGRAPHS_MAX + 2)) {
      const keptSentences: string[] = [];
      for (const s of sentencesOf(str(rawP))) {
        const src = takeSource();
        const problem = !src ? 'no source in the Oracle document' : textProblem(s, cardCtx);
        if (problem) {
          gaps.push(`${areaId}: a body sentence dropped (${problem})`);
          continue;
        }
        if (words + wordCount(s) > BODY_MAX_WORDS) {
          gaps.push(`${areaId}: body over ${BODY_MAX_WORDS} words; the rest dropped`);
          break;
        }
        words += wordCount(s);
        keptSentences.push(s);
        kept.push(src!);
      }
      if (keptSentences.length && body.length < BODY_PARAGRAPHS_MAX) body.push(keptSentences.join(' '));
    }

    if (!headline || !body.length) {
      gaps.push(`${areaId}: withheld (${!headline ? 'no headline' : 'no body'} survived); the Oracle headline stands in`);
      cards[areaId] = {
        areaId,
        headline: redactChartTerms(oArea.headline),
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
              : textProblem(text, cardCtx);
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
      const steps: LadderSteps = { best: str(l.best), practical: str(l.practical), drift: str(l.drift), floor: str(l.floor) };
      const bad = (Object.entries(steps) as Array<[keyof LadderSteps, string]>).find(([, t]) => !t || textProblem(t, cardCtx));
      if (bad) gaps.push(`${areaId}: ladder dropped (${bad[0]}: ${bad[1] ? textProblem(bad[1], cardCtx) : 'empty'})`);
      else ladder = steps;
    }

    const dates: AreaDate[] = [];
    for (const rawD of arr(c.dates)) {
      const d = obj(rawD);
      const from = str(d.from);
      const to = str(d.to) || from;
      const label = str(d.label);
      if (!oDates.pairs.has(`${from}|${to}`)) {
        gaps.push(`${areaId}: date ${from}..${to} is not in the Oracle document; dropped`);
        continue;
      }
      const problem = !label ? 'no label' : textProblem(label, cardCtx);
      if (problem) {
        gaps.push(`${areaId}: date ${from}..${to} dropped (${problem})`);
        continue;
      }
      dates.push({ from, to, label });
    }

    cards[areaId] = { areaId, headline, body, patterns, ladder, dates, certainty: oArea.certainty, sources: kept };
    cardStatus[areaId] = 'ok';
  }

  for (const id of Object.keys(oracle.doc.areas) as SelfV2AreaId[]) {
    if (!cards[id]) {
      const a = oracle.doc.areas[id as keyof typeof oracle.doc.areas]!;
      gaps.push(`${id}: no card returned; withheld, the Oracle headline stands in`);
      cards[id] = { areaId: id, headline: redactChartTerms(a.headline), body: [], patterns: [], ladder: null, dates: [], certainty: a.certainty, sources: [] };
      cardStatus[id] = 'withheld';
    }
  }

  return { doc: { hero: validateHero(parsed.hero, input, strip, gaps), cards }, cardStatus, gaps };
}

/** The hero: tone from the six words, one sentence and a sub line, one question on a dated claim, withheld when split. */
export function validateHero(raw: Obj, input: PersonalizerInput, strip: readonly WindowRef[], gaps: string[]): HeroDoc {
  const oracle = input.oracle;
  const w = input.windows;
  const windowDays = [w.easesAt, w.nextSupportFrom, w.heaviestNow?.from, w.heaviestNow?.to].filter((d): d is string => Boolean(d));
  const o = oracleDates(oracle);
  const heroDates = frameOf([...o.days, ...windowDays]);
  const c: TextCheckContext = { gender: input.profile.gender, dates: heroDates };
  const toneRaw = str(raw.tone) as Tone;
  const tone: Tone = TONES.includes(toneRaw) ? toneRaw : 'mixed';
  if (!TONES.includes(toneRaw)) gaps.push(`hero: tone ${toneRaw || 'missing'} is not one of the six; mixed used`);
  let sentence = str(raw.sentence);
  const sp = !sentence ? 'empty' : sentencesOf(sentence).length > 1 ? 'more than one sentence' : textProblem(sentence, c);
  if (sp) {
    gaps.push(`hero: sentence dropped (${sp})`);
    sentence = '';
  }
  let sub = str(raw.sub);
  const subP = sub ? textProblem(sub, c) : null;
  if (subP) {
    gaps.push(`hero: sub line dropped (${subP})`);
    sub = '';
  }
  const claims = new Set(claimKeysOf(oracle));
  const q = obj(raw.question);
  const qClaimRaw = str(q.claimId) || str(raw.questionClaimId);
  const qClaim = qClaimRaw && !qClaimRaw.startsWith('claim:') ? `claim:${qClaimRaw}` : qClaimRaw;
  const qText = str(q.text) || str(raw.questionText);
  let question: HeroDoc['question'] = null;
  if (qClaim && qText) {
    const qp = !claims.has(qClaim) ? `claim ${qClaim} is not in the Oracle document` : textProblem(qText, c);
    if (qp) gaps.push(`hero: question dropped (${qp})`);
    else question = { claimId: qClaim, text: qText };
  }
  const split = heroSplit(oracle);
  const nextCheck = [w.easesAt, w.nextSupportFrom].filter((d): d is string => Boolean(d) && d! > w.asOf).sort()[0] ?? null;
  return {
    tone,
    sentence,
    sub,
    strip: [...strip],
    easesAt: w.easesAt,
    nextCheck,
    question,
    withheld: split || !sentence || raw.withheld === true,
  };
}
