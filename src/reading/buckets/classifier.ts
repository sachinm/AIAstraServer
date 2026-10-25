/**
 * Bucket classifier — stage 1 (rules, no model, target < 5 ms) of the bucket-first intake (brief item 1, file 13 §1).
 *
 *   classifyRules(question, asOf) → bucket, sub-bucket, confidence, slots found, slots missing, template, guidance flags
 *
 * Design rules (performance and safety):
 *  - The question is normalised once and split into tokens with one linear split; cues are Set lookups and
 *    space-padded phrase `includes`, never nested-quantifier regexes, so adversarial input stays linear (tests cover it).
 *  - Input is capped at MAX_CHARS before any work.
 *  - English only for now (Sachin, 2026-10-25); meta-negation ("not about my job") removes a cue's weight.
 *  - Stage 2 (one small model call with a closed schema) lives in `classifyQuestion` and runs only when the rules are
 *    unsure; stage 3 is the `unknown` bucket, which the coaching module answers.
 */
import { callGemini } from '../llm/gemini.js';
import { modelFor } from '../llm/models.js';
import { horizonRange, type Horizon } from '../packs/frames.js';
import type { Usage } from '../types.js';
import { BUCKETS, BUCKET_IDS, isBucketId, policyFor, type BucketId, type PolicyFlag, type SlotId, type TemplateId } from './taxonomy.js';

export const MAX_CHARS = 2000;

export type QuestionKind = 'timing' | 'yes_no' | 'compare' | 'why_meaning' | 'describe' | 'explain_term';
export type PersonRel = 'me' | 'partner' | 'spouse' | 'child' | 'son' | 'daughter' | 'mother' | 'father' | 'parent' | 'brother' | 'sister' | 'sibling' | 'friend' | 'other';

export interface Slots {
  horizon?: { value: Horizon; text: string };
  subject_person?: { value: PersonRel; text: string };
  sub_bucket?: { value: string; text: string };
  background?: { value: 'employed' | 'between_jobs' | 'studying' | 'self_employed'; text: string };
  other_person?: { value: PersonRel; text: string };
  specific_event?: { value: string; text: string };
}

export type UnanswerableReason = 'death_timing' | 'lottery_numbers' | 'exact_amount' | 'exact_clock_time' | 'diagnosis' | 'weather' | 'no_subject';

export interface ClassifierResult {
  bucket: BucketId;
  subBucket: string | null;
  /** Other life areas the question also names (score >= 0.6), strongest first */
  alsoBuckets: BucketId[];
  confidence: number;
  /** Raw cue scores per bucket (after negation), for tests and the trace */
  scores: Partial<Record<BucketId, number>>;
  slots: Slots;
  /** Required slots of the bucket that the question did not fill */
  missing: SlotId[];
  questionKind: QuestionKind;
  template: TemplateId;
  policy: PolicyFlag[];
  unanswerable: UnanswerableReason | null;
  /** Planet codes named in the question */
  planets: string[];
  source: 'rules' | 'model' | 'unknown';
  ms: number;
}

// ---- normalisation ---------------------------------------------------------------------------------------

/** Lower case, NFKC, apostrophes dropped ("don't" -> "dont", "wife's" -> "wifes"), everything else non-alphanumeric -> space. */
export function normalize(q: string): string {
  return q
    .slice(0, MAX_CHARS)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}?]+/gu, ' ')
    .replace(/\?/g, ' ? ')
    .trim();
}

export function tokenize(norm: string): string[] {
  return norm.split(' ').filter(Boolean);
}

// ---- cues ------------------------------------------------------------------------------------------------

type Cue = [string, number];
/** Token cues (single words) and phrase cues (space separated, matched on token boundaries). */
const CUES: Record<Exclude<BucketId, 'unknown' | 'explain_term'>, Cue[]> = {
  love_relationships: [
    ['love', 1], ['romance', 1], ['romantic', 1], ['dating', 1], ['girlfriend', 1.1], ['boyfriend', 1.1], ['crush', 1], ['relationship', 0.9],
    ['relationships', 0.9], ['breakup', 1.1], ['break up', 1.1], ['lover', 1], ['soulmate', 1], ['love life', 1.2], ['ex', 0.6],
    ['someone special', 1], ['meet someone', 1],
    ['partner', 0.5], ['single', 0.5],
  ],
  marriage: [
    ['marry', 1.3], ['married', 1.3], ['marriage', 1.3], ['marriages', 1.3], ['wedding', 1.2], ['spouse', 1.1], ['wife', 0.9], ['husband', 0.9],
    ['divorce', 1.2], ['separation', 0.9], ['inlaws', 1], ['in laws', 1],
    ['arranged', 0.6], ['married life', 1.3],
  ],
  career_job: [
    ['job', 1.2], ['jobs', 1.2], ['career', 1.2], ['work', 0.7], ['promotion', 1.3], ['promoted', 1.3], ['boss', 1], ['manager', 0.7], ['office', 0.8],
    ['employer', 1], ['resign', 1], ['quit', 0.6], ['interview', 1], ['interviews', 1], ['layoff', 1.1], ['layoffs', 1.1], ['raise', 0.9], ['pay raise', 1.2], ['laid off', 1.1], ['fired', 1], ['profession', 1.1],
    ['appraisal', 1.1], ['colleague', 1], ['colleagues', 1], ['workplace', 1.1], ['hike', 0.6],
    ['salary', 0.5], ['offer letter', 1.2], ['job offer', 1.2], ['company', 0.4], ['team', 0.3],
  ],
  money_wealth: [
    ['money', 1.2], ['income', 1.2], ['wealth', 1.2], ['wealthy', 1.2], ['rich', 1], ['savings', 1.1], ['save', 0.6], ['finance', 1], ['finances', 1.1],
    ['financial', 1.1], ['financially', 1.1], ['earn', 0.9], ['earning', 0.9], ['earnings', 1], ['debt', 1.3], ['debts', 1.3], ['loan', 1.1], ['loans', 1.1],
    ['losses', 1], ['loss', 0.6], ['expenses', 1],     ['investment', 0.8], ['investments', 0.8], ['invest', 0.8], ['salary', 0.7], ['lottery', 1.4], ['jackpot', 1.4], ['gamble', 1.2], ['gambling', 1.2],
    ['windfall', 1.3], ['stocks', 1], ['stock market', 1.1], ['shares', 0.8], ['crypto', 1.1], ['trading', 0.9],   ],
  business: [
    ['business', 1.4], ['startup', 1.4], ['start up', 1.2], ['venture', 1.1], ['entrepreneur', 1.3], ['entrepreneurship', 1.3], ['shop', 0.9],
    ['clients', 0.9], ['customers', 0.8],     ['my company', 0.9], ['own company', 1.2], ['partnership', 0.7], ['franchise', 1.1],
  ],
  property_vehicles: [
    ['house', 1.2], ['home', 0.7], ['flat', 1], ['apartment', 1.1], ['property', 1.3], ['land', 1.1], ['plot', 1], ['real estate', 1.3], ['mortgage', 1.2],
    ['car', 1.1], ['vehicle', 1.2], ['bike', 1],     ['buy a house', 1.5], ['own house', 1.4], ['new house', 1.3],
  ],
  education: [
    ['study', 1], ['studies', 1.1], ['exam', 1.3], ['exams', 1.3], ['education', 1.2], ['degree', 1], ['college', 1], ['university', 1.1], ['school', 0.8],
    ['admission', 1.2], ['admissions', 1.2], ['masters', 1.1], ['mba', 1.2], ['phd', 1.2], ['neet', 1.3], ['jee', 1.3], ['upsc', 1.3], ['gre', 1.1],
    ['gmat', 1.1], ['higher studies', 1.4], ['entrance', 1.1], ['stream', 0.6],
  ],
  health_windows: [
    ['health', 1.3], ['healthy', 1.1], ['illness', 1.2], ['ill', 0.8], ['disease', 1.2], ['surgery', 1.2], ['sick', 1.1], ['sickness', 1.1], ['recovery', 1],
    ['recover', 1], ['hospital', 1.1], ['injury', 1.1], ['accident', 0.8],     ['die', 1], ['death', 1], ['longevity', 1.2], ['lifespan', 1.2], ['cancer', 1], ['diagnosis', 0.8],
  ],
  family_children: [
    ['child', 1.2], ['children', 1.2], ['baby', 1.2], ['kids', 1.1], ['son', 0.9], ['daughter', 0.9], ['pregnant', 1.3], ['pregnancy', 1.3], ['conceive', 1.3],
    ['conception', 1.3], ['mother', 0.9], ['father', 0.9],
    ['mom', 0.8], ['dad', 0.8], ['parents', 1], ['brother', 0.9], ['sister', 0.9], ['sibling', 1], ['siblings', 1], ['family', 0.7],       ],
  foreign_legal: [
    ['abroad', 1.4], ['foreign', 1.3], ['visa', 1.4], ['migrate', 1.3], ['migration', 1.3], ['relocate', 1.2], ['relocation', 1.2], ['overseas', 1.3],
    ['emigrate', 1.3], ['green card', 1.4], ['usa', 0.8], ['canada', 0.8], ['uk', 0.6], ['australia', 0.8], ['dubai', 0.8], ['germany', 0.8],
    ['court', 1.4], ['case', 0.5], ['lawsuit', 1.4], ['legal', 1.2], ['litigation', 1.4], ['government', 0.8], ['police', 1],
    ['dispute', 1], ['move to', 0.7], ['settle', 0.5],
  ],
  spirituality_direction: [
    ['spiritual', 1.3], ['spirituality', 1.3], ['moksha', 1.3], ['meditation', 1.1], ['meditate', 1.1], ['purpose', 1.2], ['life purpose', 1.4],
    ['destiny', 1], ['dharma', 1.1], ['karma', 0.6], ['nakshatra', 1.3], ['nakshatras', 1.3], ['personality', 1.1], ['life direction', 1.4],
    ['soul', 0.9], ['nature', 0.4], ['my chart', 0.4], ['strengths', 0.5],
  ],
  time_window_outlook: [
    ['this month', 1], ['next month', 1], ['this week', 1], ['next week', 1], ['year ahead', 1.1], ['coming year', 0.9], ['month ahead', 1.1],
    ['overall', 0.6], ['these days', 0.8], ['horoscope', 0.7], ['transit', 0.6], ['transits', 0.6], ['sade sati', 0.9], ['sadesati', 0.9],
    ['going through', 0.9], ['bad phase', 1.1], ['rough patch', 1.1], ['bad time', 1], ['so hard', 0.9], ['everything', 0.4],     ['how is my time', 1.1], ['time ahead', 1], ['upcoming months', 0.9], ['struggling', 0.8], ['difficult', 0.5],
  ],
  compatibility: [
    ['compatible', 1.8], ['compatibility', 1.8], ['kundli milan', 2.2], ['gun milan', 2.2], ['guna milan', 2.2], ['ashtakoota', 2.2], ['match', 0.9],
    ['matching', 1.1], ['horoscope matching', 2], ['synastry', 2], ['our charts', 1.6], ['kundli match', 2],
    ['charts match', 1.8], ['wifes chart', 1.8], ['husbands chart', 1.8], ['partners chart', 1.8], ['chart fit', 1.4], ['charts fit', 1.6], ['charts compatible', 1.8], ['his chart', 1.2], ['her chart', 1.2], ['their chart', 1], ['both charts', 1.6],
  ],
};

const EXPLAIN_HEAD = ['what is', 'whats', 'what are', 'define', 'meaning of', 'explain', 'what does'];
const TERMS = ['sade sati', 'sadesati', 'dasha', 'dashas', 'dasa', 'nakshatras', 'yogas', 'doshas', 'vargas', 'mahadasha', 'antardasha', 'pratyantar', 'nakshatra', 'varga', 'navamsa', 'yoga', 'dosha',
  'manglik', 'mangal dosha', 'gochara', 'ashtakavarga', 'arudha', 'karaka', 'lagna', 'ascendant', 'rahu', 'ketu', 'kaal sarp', 'kalsarp', 'retrograde',
  'combust', 'exalted', 'debilitated', 'dasamsa', 'hora', 'upapada', 'atmakaraka', 'tithi', 'panchang'];

const NEGATORS = new Set(['not', 'no', 'dont', 'never', 'without', 'except', 'neither', 'nor', 'isnt', 'arent', 'doesnt', 'nothing']);

const PLANETS: Array<[string, string[]]> = [
  ['Su', ['sun', 'surya', 'ravi']], ['Mo', ['moon', 'chandra']], ['Ma', ['mars', 'mangal', 'kuja']], ['Me', ['mercury', 'budh', 'budha']],
  ['Ju', ['jupiter', 'brihaspati', 'guru']], ['Ve', ['venus', 'shukra']], ['Sa', ['saturn', 'shani']], ['Ra', ['rahu']], ['Ke', ['ketu']],
];

export interface Text {
  norm: string;
  padded: string;
  tokens: string[];
  /** token -> positions, built once per question so every cue lookup is O(1) */
  index: Map<string, number[]>;
}

export function textOf(q: string): Text {
  const norm = normalize(q);
  const tokens = tokenize(norm);
  const index = new Map<string, number[]>();
  tokens.forEach((tok, i) => {
    const list = index.get(tok);
    if (list) list.push(i);
    else index.set(tok, [i]);
  });
  return { norm, padded: ` ${norm} `, tokens, index };
}

const has = (t: Text, phrase: string): boolean => t.padded.includes(` ${phrase} `);

/** Cue words split once at module load. */
const CUE_WORDS: Array<[BucketId, string[], number]> = (Object.entries(CUES) as Array<[BucketId, Cue[]]>).flatMap(([b, cues]) => cues.map(([c, w]) => [b, c.split(' '), w] as [BucketId, string[], number]));

/** Token index of every occurrence of a cue (single word or phrase). */
function positions(t: Text, words: string[]): number[] {
  const starts = t.index.get(words[0]!);
  if (!starts) return [];
  if (words.length === 1) return starts;
  return starts.filter((i) => words.every((w, j) => t.tokens[i + j] === w));
}

const TOPIC_WORDS = new Set(['about', 'asking', 'regarding', 'interested', 'care', 'worried', 'related', 'concerned', 'question', 'questions']);

/**
 * A cue is negated only by meta-negation ("not about my job", "except money", "other than marriage",
 * "apart from money"), never by an ordinary negative ("why am I not getting a job" is a career question).
 */
function negated(t: Text, at: number, len: number): boolean {
  const before = t.tokens.slice(Math.max(0, at - 4), at);
  if (before.includes('except') || before.includes('besides')) return true;
  const b = ` ${before.join(' ')} `;
  if (b.includes(' other than ') || b.includes(' apart from ') || b.includes(' forget about ') || b.includes(' nothing to do with ') || b.includes(' leave aside ')) return true;
  if (before.some((w) => NEGATORS.has(w)) && before.some((w) => TOPIC_WORDS.has(w))) return true;
  void len;
  return false;
}

export function scoreBuckets(t: Text): Partial<Record<BucketId, number>> {
  const acc = new Map<BucketId, number>();
  for (const [bucket, words, w] of CUE_WORDS) {
    for (const p of positions(t, words)) acc.set(bucket, (acc.get(bucket) ?? 0) + (negated(t, p, words.length) ? -w : w));
  }
  const scores: Partial<Record<BucketId, number>> = {};
  for (const [b, s] of acc) if (s > 0) scores[b] = Math.round(s * 100) / 100;
  return scores;
}

// ---- question kind and explain-term ------------------------------------------------------------------------

function isExplain(t: Text): boolean {
  const head = EXPLAIN_HEAD.some((h) => has(t, h));
  if (!head) return false;
  const term = TERMS.some((x) => has(t, x));
  if (!term) return false;
  // "what does Ketu over my Jupiter mean for me" is about the person's chart, not a definition
  const personal = ['my', 'me', 'mine'].some((w) => t.tokens.includes(w)) && (has(t, 'over my') || has(t, 'for me') || has(t, 'in my') || has(t, 'on my') || has(t, 'mean for me'));
  return !personal;
}

export function questionKindOf(t: Text): QuestionKind {
  if (isExplain(t)) return 'explain_term';
  const first = t.tokens[0] ?? '';
  if (has(t, 'what does') && (has(t, 'mean') || has(t, 'matlab'))) return 'why_meaning';
  if (first === 'why' || has(t, 'why is') || has(t, 'why am') || has(t, 'why do') || has(t, 'why does') || has(t, 'what is happening')) return 'why_meaning';
  if (t.tokens.includes('when') || has(t, 'how long') || has(t, 'what month') || has(t, 'which month') || has(t, 'which year') || has(t, 'what year') || has(t, 'what time') || has(t, 'which period')) return 'timing';
  if (has(t, 'should i') || has(t, 'or should') || has(t, 'better to') || has(t, 'or not')) {
    return t.tokens.includes('or') || has(t, 'change') || has(t, 'switch') ? 'compare' : 'yes_no';
  }
  if (['will', 'is', 'am', 'can', 'do', 'does', 'are', 'would', 'could'].includes(first) || has(t, 'will i') || has(t, 'is it')) return 'yes_no';
  return 'describe';
}

// ---- slot extraction ---------------------------------------------------------------------------------------

const MONTHS: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, few: 3 };

const iso = (y: number, m: number, d: number): string => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

function num(tok: string | undefined): number | null {
  if (!tok) return null;
  if (/^\d{1,3}$/.test(tok)) return Number(tok);
  return NUMBER_WORDS[tok] ?? null;
}

/** Maps an "N months/years" span onto the closed horizon set, or a date range when it does not fit. */
function spanHorizon(n: number, unit: 'month' | 'year' | 'week', asOf: string): Horizon {
  if (unit === 'week') return 'now';
  const months = unit === 'year' ? n * 12 : n;
  if (months <= 1) return 'now';
  if (months <= 3) return '3m';
  if (months <= 6) return '6m';
  if (months <= 12) return '1y';
  if (months <= 36) return '3y';
  const y = Number(asOf.slice(0, 4));
  return { from: asOf, to: iso(y + Math.ceil(months / 12), Number(asOf.slice(5, 7)), Number(asOf.slice(8, 10))) };
}

export function extractHorizon(t: Text, asOf: string): { value: Horizon; text: string } | null {
  const y0 = Number(asOf.slice(0, 4));
  const m0 = Number(asOf.slice(5, 7));
  const toks = t.tokens;
  // explicit spans: "next 6 months", "within 2 years", "in the next three months"
  for (let i = 0; i < toks.length; i++) {
    const unitTok = toks[i]!;
    const unit = /^months?$/.test(unitTok) ? 'month' : /^years?$/.test(unitTok) ? 'year' : /^weeks?$/.test(unitTok) ? 'week' : null;
    if (!unit) continue;
    const n = num(toks[i - 1]);
    const lead = toks.slice(Math.max(0, i - 4), i - (n === null ? 0 : 1)).join(' ');
    if (n !== null && /\b(next|coming|within|in|upcoming|over|for)\b/.test(` ${lead} `)) return { value: spanHorizon(n, unit, asOf), text: `${lead.split(' ').pop()} ${toks[i - 1]} ${unitTok}` };
    if (n === null && (toks[i - 1] === 'next' || toks[i - 1] === 'coming')) {
      if (unit === 'year') return { value: { from: iso(y0 + 1, 1, 1), to: iso(y0 + 1, 12, 31) }, text: `${toks[i - 1]} ${unitTok}` };
      if (unit === 'month') {
        const m = m0 === 12 ? 1 : m0 + 1;
        const y = m0 === 12 ? y0 + 1 : y0;
        return { value: { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) }, text: `${toks[i - 1]} ${unitTok}` };
      }
      return { value: 'now', text: `${toks[i - 1]} ${unitTok}` };
    }
    if (n === null && toks[i - 1] === 'this') {
      if (unit === 'year') return { value: { from: asOf, to: iso(y0, 12, 31) }, text: `${toks[i - 1]} ${unitTok}` };
      return { value: 'now', text: `${toks[i - 1]} ${unitTok}` };
    }
  }
  // "between Nov 2026 and Apr 2027", "from March to June 2027"
  for (let i = 0; i < toks.length; i++) {
    const a = MONTHS[toks[i]!];
    if (!a) continue;
    const ya = /^\d{4}$/.test(toks[i + 1] ?? '') ? Number(toks[i + 1]) : null;
    const j = i + (ya ? 2 : 1);
    if ((toks[j] === 'and' || toks[j] === 'to' || toks[j] === 'till' || toks[j] === 'until') && MONTHS[toks[j + 1] ?? '']) {
      const b = MONTHS[toks[j + 1]!]!;
      const yb = /^\d{4}$/.test(toks[j + 2] ?? '') ? Number(toks[j + 2]) : ya ?? (b >= m0 ? y0 : y0 + 1);
      const yaa = ya ?? (a <= b ? yb : yb - 1);
      return { value: { from: iso(yaa, a, 1), to: iso(yb, b, lastDay(yb, b)) }, text: toks.slice(i, j + (/^\d{4}$/.test(toks[j + 2] ?? '') ? 3 : 2)).join(' ') };
    }
  }
  // "by March", "before June 2027", "until December"
  for (let i = 0; i < toks.length - 1; i++) {
    if (!['by', 'before', 'until', 'till'].includes(toks[i]!)) continue;
    const m = MONTHS[toks[i + 1]!];
    if (m) {
      const y = /^\d{4}$/.test(toks[i + 2] ?? '') ? Number(toks[i + 2]) : m >= m0 ? y0 : y0 + 1;
      return { value: { from: asOf, to: iso(y, m, lastDay(y, m)) }, text: toks.slice(i, i + (/^\d{4}$/.test(toks[i + 2] ?? '') ? 3 : 2)).join(' ') };
    }
    if (/^\d{4}$/.test(toks[i + 1]!)) {
      const y = Number(toks[i + 1]);
      if (y >= y0 && y <= y0 + 20) return { value: { from: asOf, to: iso(y, 12, 31) }, text: `${toks[i]} ${y}` };
    }
  }
  // "in 2027"
  for (let i = 0; i < toks.length; i++) {
    if (!/^\d{4}$/.test(toks[i]!)) continue;
    const y = Number(toks[i]);
    if (y < y0 || y > y0 + 20) continue;
    if (toks[i - 1] === 'in' || toks[i - 1] === 'during') {
      return { value: { from: y === y0 ? asOf : iso(y, 1, 1), to: iso(y, 12, 31) }, text: `${toks[i - 1] === 'in' || toks[i - 1] === 'during' ? `${toks[i - 1]} ` : ''}${y}` };
    }
  }
  if (has(t, 'right now') || has(t, 'currently') || has(t, 'today') || has(t, 'these days') || has(t, 'at the moment') || t.tokens.includes('now')) return { value: 'now', text: 'now' };
  if (has(t, 'end of the year') || has(t, 'end of this year') || has(t, 'year end') || has(t, 'before the year ends')) return { value: { from: asOf, to: iso(y0, 12, 31) }, text: 'by the end of the year' };
  if (has(t, 'soon') || has(t, 'shortly')) return { value: '3m', text: 'soon' };
  if (has(t, 'lifetime') || has(t, 'whole life') || has(t, 'entire life') || has(t, 'in life') || has(t, 'in my life')) return { value: 'life', text: 'life' };
  if (has(t, 'next few years') || has(t, 'coming years') || has(t, 'few years')) return { value: '3y', text: 'next few years' };
  if (has(t, 'next few months') || has(t, 'coming months') || has(t, 'upcoming months') || has(t, 'few months')) return { value: '6m', text: 'next few months' };
  if (has(t, 'year ahead') || has(t, 'coming year')) return { value: '1y', text: 'the year ahead' };
  if (has(t, 'month ahead')) return { value: 'now', text: 'the month ahead' };
  return null;
}

const REL_WORDS: Record<string, PersonRel> = {
  wife: 'spouse', husband: 'spouse', spouse: 'spouse', partner: 'partner', girlfriend: 'partner', boyfriend: 'partner', fiance: 'partner', fiancee: 'partner',
  son: 'son', daughter: 'daughter', child: 'child', kid: 'child', baby: 'child', mother: 'mother', mom: 'mother',
  mummy: 'mother', father: 'father', dad: 'father', papa: 'father', parents: 'parent', brother: 'brother',
  sister: 'sister', sibling: 'sibling', friend: 'friend',
};
const ABOUT_VERBS = new Set(['get', 'be', 'clear', 'pass', 'find', 'have', 'recover', 'marry', 'go', 'do', 'become', 'travel', 'move', 'buy', 'succeed', 'improve', 'settle', 'start']);
const ABOUT_NOUNS = new Set(['career', 'job', 'health', 'marriage', 'exam', 'exams', 'future', 'education', 'studies', 'business', 'life', 'chart', 'kundli', 'wedding', 'visa', 'recovery']);

export function extractPerson(t: Text): { value: PersonRel; text: string } | null {
  const toks = t.tokens;
  for (let i = 0; i < toks.length; i++) {
    const raw = toks[i]!;
    const base = raw.endsWith('s') && REL_WORDS[raw.slice(0, -1)] ? raw.slice(0, -1) : raw;
    const rel = REL_WORDS[base];
    if (!rel) continue;
    const possessive = raw !== base; // "wifes" from "wife's"
    const prev = toks[i - 1];
    const next = toks[i + 1];
    // "my son's career", "will my daughter clear", "for my mother", "my father ka health"
    if ((possessive && next && ABOUT_NOUNS.has(next)) || (prev === 'my' && next && ABOUT_VERBS.has(next)) || (toks[i - 2] === 'will' && prev === 'my') || (toks[i - 2] === 'for' && prev === 'my')) {
      return { value: rel, text: `my ${base}` };
    }
  }
  if (['i', 'me', 'my', 'mine', 'myself', 'we', 'our', 'us'].some((w) => toks.includes(w))) return { value: 'me', text: 'me' };
  return null;
}

export function extractOtherPerson(t: Text): { value: PersonRel; text: string } | null {
  for (const tok of t.tokens) {
    const base = tok.endsWith('s') && REL_WORDS[tok.slice(0, -1)] ? tok.slice(0, -1) : tok;
    const rel = REL_WORDS[base];
    if (rel) return { value: rel, text: base };
  }
  if (has(t, 'a boy') || has(t, 'a girl') || has(t, 'this boy') || has(t, 'this girl') || has(t, 'the boy') || has(t, 'the girl') || has(t, 'prospective') || has(t, 'my match')) return { value: 'partner', text: 'prospective match' };
  return null;
}

const SUB_CUES: Partial<Record<BucketId, Array<[string, string[]]>>> = {
  career_job: [
    ['job_change', ['change', 'changing', 'switch', 'switching', 'leave', 'leaving', 'quit', 'resign', 'new job', 'another job', 'move company', 'job change', 'naukri chhod']],
    ['promotion', ['promotion', 'promoted', 'raise', 'hike', 'recognition', 'appraisal', 'growth at work', 'senior']],
    ['job_search', ['find a job', 'get a job', 'finding a job', 'looking for', 'unemployed', 'interview', 'interviews', 'job offer', 'offer letter', 'jobless', 'placement']],
    ['workplace_trouble', ['boss', 'manager', 'colleague', 'colleagues', 'team', 'conflict', 'politics', 'toxic', 'harass', 'fired', 'layoff', 'laid off']],
    ['career_direction', ['suit', 'suits', 'suited', 'field', 'kind of work', 'which career', 'career direction', 'profession', 'what should i do', 'right career']],
  ],
  money_wealth: [
    ['windfall', ['lottery', 'jackpot', 'gamble', 'gambling', 'windfall', 'stocks', 'stock market', 'crypto', 'trading', 'speculation', 'shares']],
    ['debt_loss', ['debt', 'debts', 'loan', 'loans', 'losses', 'loss', 'expenses', 'kharcha']],
    ['income_growth', ['income', 'salary', 'savings', 'save', 'earn', 'earning', 'earnings', 'wealth', 'rich', 'money', 'paisa']],
  ],
  love_relationships: [
    ['breakup_friction', ['breakup', 'break up', 'ex', 'fight', 'fights', 'friction', 'keep ending', 'cheating', 'jealous']],
    ['new_relationship', ['meet', 'find', 'someone', 'single', 'new relationship', 'meet someone']],
    ['current_relationship', ['my relationship', 'current', 'girlfriend', 'boyfriend', 'partner', 'last', 'future together']],
  ],
  marriage: [
    ['marriage_health', ['improve', 'problems', 'problem', 'separation', 'divorce', 'fight', 'fights', 'inlaws', 'in laws', 'married life', 'unhappy']],
    ['marriage_timing', ['when', 'get married', 'marry', 'timing', 'delay']],
  ],
  property_vehicles: [
    ['vehicle', ['car', 'vehicle', 'bike', 'गाड़ी']],
    ['buy_home', ['house', 'home', 'flat', 'apartment', 'property', 'land', 'plot', 'zameen']],
  ],
  education: [
    ['field_fit', ['field', 'subject', 'stream', 'suits', 'suit', 'which course', 'what should i study']],
    ['higher_studies', ['masters', 'mba', 'phd', 'higher studies', 'abroad', 'postgraduate']],
    ['exams', ['exam', 'exams', 'pass', 'clear', 'admission', 'entrance', 'neet', 'jee', 'upsc', 'gre', 'gmat', 'pariksha']],
  ],
  health_windows: [
    ['recovery', ['recover', 'recovery', 'improve', 'surgery', 'heal', 'better']],
    ['vigilance', ['careful', 'care', 'vigilant', 'risk', 'health']],
  ],
  family_children: [
    ['children', ['child', 'children', 'baby', 'pregnant', 'pregnancy', 'conceive', 'conception', 'kids']],
    ['parents_siblings', ['mother', 'father', 'parents', 'brother', 'sister', 'sibling', 'siblings', 'mom', 'dad']],
  ],
  foreign_legal: [
    ['legal', ['court', 'case', 'lawsuit', 'legal', 'litigation', 'police', 'government', 'dispute', 'mukadma']],
    ['abroad', ['abroad', 'foreign', 'visa', 'migrate', 'relocate', 'overseas', 'settle', 'move to', 'green card']],
  ],
  spirituality_direction: [
    ['nakshatra_portrait', ['nakshatra', 'nakshatras']],
    ['spiritual_phase', ['spiritual', 'spirituality', 'moksha', 'meditation', 'guru', 'sadhana']],
    ['purpose', ['purpose', 'destiny', 'direction', 'personality', 'dharma', 'meant to']],
  ],
  time_window_outlook: [
    ['transit_meaning', ['over my', 'on my', 'sade sati', 'sadesati', 'transit', 'transiting']],
    ['current_difficulty', ['hard', 'difficult', 'struggling', 'bad phase', 'rough patch', 'bad time', 'going through', 'why is everything']],
    ['month_ahead', ['this month', 'next month', 'this week', 'next week', 'month ahead', 'these days']],
    ['year_ahead', ['year ahead', 'this year', 'next year', 'coming year']],
  ],
  compatibility: [
    ['family_link', ['mother', 'father', 'son', 'daughter', 'brother', 'sister', 'parents']],
    ['partner_match', ['partner', 'wife', 'husband', 'match', 'girlfriend', 'boyfriend', 'fiance', 'marriage']],
  ],
};

export function extractSubBucket(t: Text, bucket: BucketId): { value: string; text: string } | null {
  const rows = SUB_CUES[bucket];
  if (!rows) return null;
  for (const [id, cues] of rows) {
    for (const c of cues) if (has(t, c)) return { value: id, text: c };
  }
  return null;
}

export function extractBackground(t: Text): Slots['background'] | null {
  if (has(t, 'lost my job') || has(t, 'between jobs') || has(t, 'unemployed') || has(t, 'no job') || has(t, 'laid off') || has(t, 'jobless')) return { value: 'between_jobs', text: 'between jobs' };
  if (has(t, 'my business') || has(t, 'self employed') || has(t, 'freelance') || has(t, 'freelancer') || has(t, 'own company')) return { value: 'self_employed', text: 'self-employed' };
  if (has(t, 'student') || has(t, 'studying') || has(t, 'in college') || has(t, 'final year')) return { value: 'studying', text: 'studying' };
  if (has(t, 'my job') || has(t, 'current job') || has(t, 'my boss') || has(t, 'at work') || has(t, 'my company') || has(t, 'my office') || has(t, 'my manager')) return { value: 'employed', text: 'employed now' };
  return null;
}

export function extractSpecificEvent(t: Text): Slots['specific_event'] | null {
  const toks = t.tokens;
  for (let i = 0; i < toks.length - 2; i++) {
    if ((toks[i] === 'moving' || toks[i] === 'move' || toks[i] === 'relocate' || toks[i] === 'relocating' || toks[i] === 'shift') && toks[i + 1] === 'to' && toks[i + 2] && !['a', 'an', 'the', 'new', 'another'].includes(toks[i + 2]!)) {
      const place = toks[i + 2]!;
      return { value: `moving to ${place}`, text: `moving to ${place}` };
    }
    if (['promotion', 'interview', 'wedding', 'exam', 'surgery', 'launch', 'appraisal', 'hearing'].includes(toks[i]!) && toks[i + 1] === 'in' && MONTHS[toks[i + 2]!]) {
      return { value: `${toks[i]} in ${toks[i + 2]}`, text: `${toks[i]} in ${toks[i + 2]}` };
    }
  }
  return null;
}

// ---- unanswerable questions (coaching redirects them) -----------------------------------------------------

export function unanswerableOf(t: Text, bucketScore: number): UnanswerableReason | null {
  const deathWord = t.tokens.includes('die') || t.tokens.includes('dies') || has(t, 'pass away') || t.tokens.includes('death');
  if (has(t, 'when will i die') || has(t, 'date of death') || has(t, 'how long will i live') || (has(t, 'when will my') && deathWord) || (t.tokens.includes('when') && deathWord) || has(t, 'my death') || has(t, 'lifespan') || has(t, 'how many years will i live')) return 'death_timing';
  if ((t.tokens.includes('lottery') || t.tokens.includes('jackpot') || t.tokens.includes('powerball') || t.tokens.includes('lotto')) && (t.tokens.includes('number') || t.tokens.includes('numbers') || has(t, 'which ticket') || has(t, 'winning numbers'))) return 'lottery_numbers';
  if (has(t, 'how much money') || has(t, 'exact amount') || has(t, 'how many lakhs') || has(t, 'how many crores') || has(t, 'how many dollars') || has(t, 'how much will i earn') || has(t, 'what salary will i')) return 'exact_amount';
  for (let i = 0; i < t.tokens.length - 1; i++) {
    const a = t.tokens[i]!;
    const b = t.tokens[i + 1]!;
    if (/^\d{1,2}$/.test(a) && (b === 'am' || b === 'pm' || b === 'oclock')) return 'exact_clock_time';
    if (/^\d{1,2}$/.test(a) && /^\d{2}$/.test(b) && (t.tokens[i + 2] === 'am' || t.tokens[i + 2] === 'pm')) return 'exact_clock_time';
  }
  if (has(t, 'do i have') && ['cancer', 'diabetes', 'disease', 'tumor', 'tumour', 'covid', 'infection'].some((w) => t.tokens.includes(w))) return 'diagnosis';
  if (has(t, 'which disease') || has(t, 'what disease will')) return 'diagnosis';
  if (t.tokens.includes('rain') || t.tokens.includes('weather')) return 'weather';
  if (bucketScore === 0 && (has(t, 'will it happen') || has(t, 'yes or no') || has(t, 'will this happen') || has(t, 'will it work') || t.tokens.length <= 3)) return 'no_subject';
  return null;
}

// ---- template choice ----------------------------------------------------------------------------------------

export function templateFor(bucket: BucketId, sub: string | null, kind: QuestionKind, horizon: Horizon | null, planets: string[], t: Text): TemplateId {
  if (kind === 'explain_term' || bucket === 'explain_term') return 'T10';
  if (bucket === 'compatibility') return 'T8';
  const subT = sub ? BUCKETS[bucket].subBuckets.find((s) => s.id === sub)?.template : undefined;
  if (sub === 'nakshatra_portrait' || has(t, 'nakshatra') || has(t, 'nakshatras')) return 'T7';
  if (kind === 'why_meaning') return planets.length >= 1 || sub === 'transit_meaning' ? 'T4' : 'T3';
  if (subT === 'T3' || subT === 'T4') return subT;
  if (kind === 'compare') return 'T5';
  if (kind === 'yes_no') return horizon === 'now' && bucket === 'time_window_outlook' ? 'T9' : 'T1';
  if (kind === 'timing') return 'T2';
  if (subT) return subT;
  if (bucket === 'time_window_outlook') return horizon === 'now' || horizon === '3m' ? 'T9' : 'T2';
  return BUCKETS[bucket].defaultTemplate;
}

function planetsOf(t: Text): string[] {
  const out: string[] = [];
  for (const [code, words] of PLANETS) {
    // "guru" is also a teacher; count it as Jupiter only next to a transit cue
    const hit = words.some((w) => t.tokens.includes(w) && (w !== 'guru' || has(t, 'guru transit')));
    if (hit) out.push(code);
  }
  return out;
}

// ---- stage 1 --------------------------------------------------------------------------------------------------

/** Rules-only classification. Pure, synchronous, no I/O. */
export function classifyRules(question: string, asOf: string): ClassifierResult {
  const t0 = performance.now();
  const t = textOf(question);
  const kind = questionKindOf(t);
  const scores = scoreBuckets(t);
  const planets = planetsOf(t);

  let ranked = (Object.entries(scores) as Array<[BucketId, number]>).sort((a, b) => b[1] - a[1]);
  // tie-breaks that the weights alone do not settle
  const top = ranked[0]?.[0];
  if (top === 'love_relationships' && (scores.marriage ?? 0) >= 1.1) ranked = [['marriage', scores.marriage!], ...ranked.filter(([b]) => b !== 'marriage')];
  if ((scores.compatibility ?? 0) >= 1.6) ranked = [['compatibility', scores.compatibility!], ...ranked.filter(([b]) => b !== 'compatibility')];
  if (ranked[0]?.[0] === 'money_wealth' && (scores.business ?? 0) >= 1.2) ranked = [['business', scores.business!], ...ranked.filter(([b]) => b !== 'business')];
  if (ranked[0]?.[0] === 'time_window_outlook' && ranked[1] && ranked[1][1] >= 1) ranked = [ranked[1], ranked[0], ...ranked.slice(2)];
  // "my relationship with my father" is about family, not romance
  if (ranked[0]?.[0] === 'love_relationships' && (scores.family_children ?? 0) >= (scores.love_relationships ?? 0)) ranked = [['family_children', scores.family_children!], ...ranked.filter(([b]) => b !== 'family_children')];

  let bucket: BucketId;
  let confidence: number;
  const s1 = ranked[0]?.[1] ?? 0;
  const s2 = ranked[1]?.[1] ?? 0;
  if (kind === 'explain_term') {
    bucket = 'explain_term';
    confidence = 0.95;
  } else if (s1 <= 0) {
    // a named planet and a transit cue with no life area is still answerable as a time-window reading
    if (planets.length && (has(t, 'transit') || has(t, 'over my') || has(t, 'on my') || has(t, 'mean for me') || kind === 'why_meaning')) {
      bucket = 'time_window_outlook';
      confidence = 0.8;
    } else {
      bucket = 'unknown';
      confidence = 0.2;
    }
  } else {
    bucket = ranked[0]![0];
    const margin = (s1 - s2) / s1;
    confidence = Math.min(0.99, 0.3 + 0.35 * Math.min(1, s1 / 1.5) + 0.35 * margin);
    // one weak cue ("my chart", "work") is a guess, not a classification
    if (s1 < 0.8) confidence = Math.min(confidence, 0.6);
  }
  // three or more life areas in one question: read the strongest, list the others, and let the clarifier ask
  const alsoBuckets = bucket === 'explain_term' || bucket === 'unknown' ? [] : ranked.slice(1).filter(([, v]) => v >= 0.6).map(([b]) => b);
  if (alsoBuckets.length >= 2) confidence = Math.min(confidence, 0.55);

  const horizon = extractHorizon(t, asOf);
  const sub = bucket === 'unknown' || bucket === 'explain_term' ? null : extractSubBucket(t, bucket);
  const slots: Slots = {};
  if (horizon) slots.horizon = horizon;
  const person = extractPerson(t);
  if (person) slots.subject_person = person;
  if (sub) slots.sub_bucket = sub;
  const bg = bucket === 'career_job' || bucket === 'business' ? extractBackground(t) : null;
  if (bg) slots.background = bg;
  if (bucket === 'compatibility') {
    const other = extractOtherPerson(t);
    if (other) slots.other_person = other;
  }
  const ev = extractSpecificEvent(t);
  if (ev) slots.specific_event = ev;

  const required = BUCKETS[bucket].requiredSlots;
  const missing = required.filter((s) => !slots[s]);
  const unanswerable = unanswerableOf(t, s1);
  const template = templateFor(bucket, sub?.value ?? null, kind, horizon?.value ?? null, planets, t);
  const policy = [...policyFor(bucket)];
  if (unanswerable === 'death_timing' && !policy.includes('no_death_prediction')) policy.push('no_death_prediction');
  if (unanswerable === 'lottery_numbers') policy.push('no_lottery_numbers');
  if (unanswerable === 'exact_amount' && !policy.includes('no_amounts')) policy.push('no_amounts');

  return {
    bucket,
    subBucket: sub?.value ?? null,
    alsoBuckets,
    confidence: Math.round(confidence * 100) / 100,
    scores,
    slots,
    missing,
    questionKind: kind,
    template: unanswerable && unanswerable !== 'no_subject' ? 'T10' : template,
    policy,
    unanswerable,
    planets,
    source: bucket === 'unknown' ? 'unknown' : 'rules',
    ms: Math.round((performance.now() - t0) * 1000) / 1000,
  };
}

// ---- stage 2 (model, only when unsure) ---------------------------------------------------------------------

export function classifierThreshold(): number {
  const n = Number(process.env.READING_CLASSIFIER_THRESHOLD);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0.7;
}

export type ClassifierMode = 'auto' | 'rules' | 'llm';
export function classifierMode(): ClassifierMode {
  const v = process.env.READING_CLASSIFIER_MODE?.trim().toLowerCase();
  return v === 'rules' || v === 'llm' ? v : 'auto';
}

export const CLASSIFIER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bucket: { type: 'STRING', enum: [...BUCKET_IDS] },
    subBucket: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    horizon: { type: 'STRING', enum: ['none', 'now', '3m', '6m', '1y', '3y', 'life'] },
    subjectPerson: { type: 'STRING', enum: ['none', 'me', 'partner', 'spouse', 'child', 'son', 'daughter', 'mother', 'father', 'parent', 'brother', 'sister', 'sibling', 'friend', 'other'] },
  },
  required: ['bucket', 'confidence', 'horizon', 'subjectPerson'],
};

const CLASSIFIER_SYSTEM = [
  'Classify a person\'s astrology question into exactly one bucket. Reply with JSON only.',
  'Buckets: ' + BUCKET_IDS.filter((b) => b !== 'unknown').map((b) => `${b} (${BUCKETS[b].blurb})`).join('; ') + '; unknown (no life area can be identified).',
  'horizon: the period the person named, or "none" if they did not name one. subjectPerson: whose chart the question is about, or "none".',
  'Do not answer the question.',
].join('\n');

/** Stage 2: one small structured call. Used only when stage 1 is unsure. */
export async function classifyWithModel(question: string, rules: ClassifierResult): Promise<{ result: ClassifierResult; usage: Usage }> {
  const r = await callGemini({
    model: modelFor('intake'),
    node: 'classify',
    system: CLASSIFIER_SYSTEM,
    parts: [`Question: ${question.slice(0, MAX_CHARS)}`],
    responseSchema: CLASSIFIER_RESPONSE_SCHEMA,
    thinking: 'off',
    maxOutputTokens: 150,
    temperature: 0,
    timeoutMs: 4000,
  });
  const j = JSON.parse(r.text) as { bucket?: string; subBucket?: string; confidence?: number; horizon?: string; subjectPerson?: string };
  const bucket: BucketId = isBucketId(j.bucket) ? j.bucket : 'unknown';
  const slots: Slots = { ...rules.slots };
  if (!slots.horizon && j.horizon && j.horizon !== 'none') slots.horizon = { value: j.horizon as Horizon, text: j.horizon };
  if (!slots.subject_person && j.subjectPerson && j.subjectPerson !== 'none') slots.subject_person = { value: j.subjectPerson as PersonRel, text: j.subjectPerson };
  const validSub = j.subBucket && BUCKETS[bucket].subBuckets.some((s) => s.id === j.subBucket) ? j.subBucket : null;
  if (!slots.sub_bucket && validSub) slots.sub_bucket = { value: validSub, text: validSub };
  const sub = slots.sub_bucket?.value ?? null;
  const result: ClassifierResult = {
    ...rules,
    bucket,
    subBucket: sub,
    confidence: Math.max(0, Math.min(1, Number(j.confidence ?? 0.6))),
    slots,
    missing: BUCKETS[bucket].requiredSlots.filter((s) => !slots[s]),
    template: rules.unanswerable && rules.unanswerable !== 'no_subject' ? 'T10' : templateFor(bucket, sub, rules.questionKind, slots.horizon?.value ?? null, rules.planets, textOf(question)),
    policy: [...new Set([...policyFor(bucket), ...rules.policy])],
    source: bucket === 'unknown' ? 'unknown' : 'model',
  };
  return { result, usage: r.usage };
}

/** Full classifier: rules first; one model call only when unsure (auto mode); unknown otherwise. Never throws. */
export async function classifyQuestion(question: string, asOf: string, opts: { mode?: ClassifierMode } = {}): Promise<{ result: ClassifierResult; usage: Usage | null }> {
  const t0 = performance.now();
  const rules = classifyRules(question, asOf);
  const mode = opts.mode ?? classifierMode();
  const unsure = rules.confidence < classifierThreshold() || rules.bucket === 'unknown';
  if (mode === 'rules' || (mode === 'auto' && !unsure) || rules.unanswerable === 'death_timing') return { result: rules, usage: null };
  try {
    const { result, usage } = await classifyWithModel(question, rules);
    // keep the rules answer when the model is less sure than the rules were
    const pick = result.bucket === 'unknown' && rules.bucket !== 'unknown' ? rules : result.confidence >= rules.confidence || rules.bucket === 'unknown' ? result : rules;
    return { result: { ...pick, ms: Math.round((performance.now() - t0) * 1000) / 1000 }, usage };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'bucket classifier model failed; using rules', error: (err as Error).message.slice(0, 200) }));
    return { result: rules, usage: null };
  }
}

export { horizonRange };
