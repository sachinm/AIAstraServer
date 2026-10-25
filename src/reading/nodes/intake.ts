/**
 * Intake node: understand the question — subject(s), horizon, question type, format, named planets — and nothing else
 * (no clarify step in Phase 1). Two implementations behind one function:
 *
 *  - rules (no LLM, ~0 ms): keyword and phrase tables. Used when confident, which is most questions, so the user
 *    sees "I understood X" immediately and no model call is spent on classification.
 *  - llm (small structured-output call): used when the rules are unsure (no subject matched, more than two subjects,
 *    conflicting cues) or when `READING_INTAKE_MODE=llm`.
 *
 * `READING_INTAKE_MODE=auto|rules|llm` (default auto). Classification only: no astrology is computed here.
 */
import { z } from 'zod';
import { callGemini } from '../llm/gemini.js';
import { modelFor } from '../llm/models.js';
import { FORMATS, FRAMES, QUESTION_TYPES, SUBJECT_IDS, horizonRange, isSubjectId, type FormatId, type Horizon, type QuestionType, type SubjectId } from '../packs/frames.js';
import { PROMPTS } from '../prompts/generated.js';
import type { Intent, IntentClassification, SafetyFlag, Usage } from '../types.js';
import { classifyRules, type ClassifierResult } from '../buckets/classifier.js';
import { BUCKETS } from '../buckets/taxonomy.js';

const PLANET_WORDS: Array<[string, RegExp]> = [
  ['Su', /\b(sun|surya|ravi)\b/i],
  ['Mo', /\b(moon|chandra)\b/i],
  ['Ma', /\b(mars|mangal|kuja)\b/i],
  ['Me', /\b(mercury|budh|budha)\b/i],
  ['Ju', /\b(jupiter|guru|brihaspati)\b/i],
  ['Ve', /\b(venus|shukra)\b/i],
  ['Sa', /\b(saturn|shani)\b/i],
  ['Ra', /\brahu\b/i],
  ['Ke', /\bketu\b/i],
];

const SUBJECT_CUES: Array<[SubjectId, RegExp, number]> = [
  ['career_work', /\b(job|jobs|work|career|promotion|boss|profession|employer|office|resign|quit|workplace|colleague|d-?10|dasamsa)\b/i, 1],
  ['income_wealth', /\b(money|income|salary|wealth|rich|earn|earning|financ\w*|million|billion|dollars?|savings?|profit|raise|hora|d-?2|prosper\w*)\b/i, 1],
  ['debt_loss_expense', /\b(debt|debts|loan|loans|expenses?|losses|loss)\b/i, 1],
  ['property_home', /\b(house|home|property|flat|land|apartment|real estate|mortgage|d-?4)\b/i, 1],
  ['vehicles', /\b(car|vehicle|bike|motorcycle)\b/i, 1],
  ['marriage_relationship', /\b(marry|married|marriage|spouse|wife|husband|partner|relationship|divorce|love life|romance|girlfriend|boyfriend|d-?9|navamsa)\b/i, 1],
  ['children', /\b(child|children|baby|son|daughter|pregnan\w*|kids|progeny|d-?7)\b/i, 1],
  ['health_body', /\b(health|illness|disease|surgery|sick|recover\w*|injury)\b/i, 1],
  ['education_learning', /\b(study|studies|exam|exams|education|degree|college|school|university|learn\w*)\b/i, 1],
  ['spirituality_moksha', /\b(spiritual\w*|moksha|meditat\w*|guru|pilgrimage|enlighten\w*)\b/i, 1],
  ['foreign_relocation', /\b(abroad|foreign|visa|migrate|migration|relocat\w*|emigrate|overseas|move to)\b/i, 1],
  ['litigation_government', /\b(court|lawsuit|legal|litigation|government|tax|taxes|dispute)\b/i, 1],
  ['speculation_lottery', /\b(lottery|gambl\w*|jackpot|sweepstake|windfall|trading|stocks?|crypto)\b/i, 2],
  ['general_life_direction', /\b(nakshatras?|my chart|year ahead|life direction|purpose|personality|all the different ways|overall)\b/i, 1],
];

const EXPLAIN_TERM = /\b(what is|what's|what are|define|meaning of|explain)\b[^?]*\b(sade ?sati|dasha|dasa|mahadasha|antardasha|rahu|ketu|nakshatra|varga|yoga|dosha|manglik|gochara|transit|ashtakavarga|arudha|karaka|lagna|ascendant)\b/i;
const WHY_MEANING = /\b(what does (that|this|it)[^?]* mean|what does [^?]* mean for me|why (is|am|do|does)|what is happening|mean for me)\b/i;
const SELF_HARM = /\b(suicide|suicidal|kill myself|end my life|want to die|self[- ]harm|hurt myself)\b/i;

export const SELF_HARM_RESPONSE =
  "I'm really sorry you're going through this. I can't answer this one from a chart. If you might act on these thoughts or are in immediate danger, please contact your local emergency number now. In the US you can call or text 988, and in India you can call Tele-MANAS at 14416 or 1-800-891-4416. If you can, tell someone you trust how you feel right now. When you feel ready, I'm glad to talk through your chart with you.";

function lastDayOfYear(asOf: string): string {
  return `${asOf.slice(0, 4)}-12-31`;
}

export interface IntakeResult {
  intent: Intent;
  usage: Usage | null;
  source: 'rules' | 'llm' | 'rules_fallback';
  ms: number;
}

function parseHorizon(q: string, asOf: string, subjects: SubjectId[], type: QuestionType): { horizon: Horizon; explicit: boolean } {
  const l = q.toLowerCase();
  if (/\b(this month|right now|currently|today|this week)\b/.test(l)) return { horizon: 'now', explicit: true };
  if (/\b(3|three) or (6|six) months?\b/.test(l)) return { horizon: '6m', explicit: true };
  if (/\b(next|coming|in the next)\s+(3|three)\s+months?\b|\b(3|three) months?\b/.test(l)) return { horizon: '3m', explicit: true };
  if (/\b(next|coming|in the next)\s+(6|six)\s+months?\b|\b(6|six) months?\b|\bnext few months\b|\bcouple of months\b/.test(l)) return { horizon: '6m', explicit: true };
  if (/\b(next|coming)\s+(12|twelve)\s+months?\b|\bnext year\b|\bin the next year\b|\bnext 1 year\b/.test(l)) return { horizon: '1y', explicit: true };
  if (/\b(next|coming)\s+(2|two|3|three|5|five)\s+years?\b/.test(l)) return { horizon: '3y', explicit: true };
  if (/\b(this year|by (the )?end of (this )?year|before (the )?year ends?)\b/.test(l)) return { horizon: { from: asOf, to: lastDayOfYear(asOf) }, explicit: true };
  if (/\b(soon|shortly)\b/.test(l)) return { horizon: '3m', explicit: true };
  if (/\b(lifetime|whole life|entire life|throughout my life|in life)\b/.test(l)) return { horizon: 'life', explicit: true };
  if (type === 'describe' || type === 'explain_term') return { horizon: type === 'explain_term' ? 'now' : 'life', explicit: false };
  if (subjects.some((s) => s === 'property_home' || s === 'marriage_relationship' || s === 'vehicles' || s === 'children')) return { horizon: '3y', explicit: false };
  if (subjects.includes('general_life_direction') && /nakshatra/i.test(q)) return { horizon: 'life', explicit: false };
  return { horizon: '1y', explicit: false };
}

function defaultFormat(type: QuestionType, subjects: SubjectId[], horizon: Horizon): FormatId {
  if (subjects.includes('speculation_lottery')) return 'direct';
  switch (type) {
    case 'timing':
      return 'timeline';
    case 'yes_no':
    case 'explain_term':
      return 'direct';
    case 'why_meaning':
      return 'narrative';
    case 'compare':
    case 'describe':
      return subjects.includes('general_life_direction') ? 'narrative' : 'factor_table';
  }
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-31" -> "31 Dec 2026" */
export function humanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : iso;
}

export function labelForHorizon(h: Horizon, asOf: string): string {
  if (typeof h === 'object') return h.from === asOf ? `now until ${humanDate(h.to)}` : `${humanDate(h.from)} to ${humanDate(h.to)}`;
  const names: Record<string, string> = { now: 'this month', '3m': 'the next 3 months', '6m': 'the next 6 months', '1y': 'the next year', '3y': 'the next 3 years', life: 'your life as a whole' };
  void asOf;
  return names[h] ?? h;
}

export function clarifyTextFor(subjects: SubjectId[], horizon: Horizon, asOf: string): string {
  const labels = subjects.map((s) => FRAMES[s].label);
  const what = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}` : labels[0] ?? 'your chart';
  const houses = [...new Set(subjects.flatMap((s) => FRAMES[s].houses))].slice(0, 5).join(', ');
  const vargas = [...new Set(subjects.flatMap((s) => FRAMES[s].vargas))].map((v) => v.replace('D', 'D-')).join(', ');
  return `You are asking about ${what} over ${labelForHorizon(horizon, asOf)}; I will read houses ${houses}${vargas ? `, ${vargas}` : ''}, your running dasha and the transits.`;
}

export function ruleIntake(question: string, asOf: string): { intent: Intent; confident: boolean } {
  const q = question.trim();
  const scores = new Map<SubjectId, number>();
  for (const [id, re, w] of SUBJECT_CUES) {
    const hits = q.match(new RegExp(re.source, 'gi'))?.length ?? 0;
    if (hits) scores.set(id, (scores.get(id) ?? 0) + hits * w);
  }
  const mentions = PLANET_WORDS.filter(([, re]) => re.test(q)).map(([c]) => c);

  let type: QuestionType = 'describe';
  const lower = q.toLowerCase();
  if (EXPLAIN_TERM.test(q) && !/\b(my|me|i)\b[^?]*\b(transit|over|in my)\b/i.test(q.replace(EXPLAIN_TERM, ''))) type = 'explain_term';
  else if (WHY_MEANING.test(q)) type = 'why_meaning';
  else if (/\bwhen\b|\bhow long\b|\bwhat (month|year|time|period)\b|\bwhich (month|year|dasha)\b/.test(lower)) type = 'timing';
  else if (/\b(should i|will i|am i going to|is it (good|a good|wise)|can i|do i)\b/.test(lower)) type = /\bor\b|\bchange\b|\bswitch\b/.test(lower) ? 'compare' : 'yes_no';
  else if (/\b(what does|tell me|describe|what kind|suited|look at|walk me)\b/.test(lower)) type = 'describe';
  else if (/\bor\b/.test(lower) && /\b(should|better)\b/.test(lower)) type = 'compare';
  else if (/\?/.test(q) === false && scores.size === 0) type = 'describe';

  let subjects: Array<{ id: SubjectId; score: number }> = [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  // speculation words imply gains: keep income out unless the person also named money explicitly
  if (type === 'explain_term') subjects = [{ id: 'explain_term', score: 1 }];
  if (subjects.length === 0) {
    subjects = [{ id: type === 'explain_term' ? 'explain_term' : 'general_life_direction', score: 0.5 }];
  }
  // lottery questions are about speculative gains only; "win" is not a money cue on its own
  if (subjects.some((s) => s.id === 'speculation_lottery')) subjects = subjects.filter((s) => s.id === 'speculation_lottery' || s.id !== 'income_wealth' || /\b(money|income|salary|wealth|savings?)\b/i.test(q));
  subjects = subjects.slice(0, 3);
  const total = subjects.reduce((n, s) => n + s.score, 0) || 1;
  const ids = subjects.map((s) => s.id);

  const { horizon, explicit } = parseHorizon(q, asOf, ids, type);
  let format = defaultFormat(type, ids, horizon);
  if (type === 'timing' && (horizon === 'now' || horizon === '3m') && /\b(watch|week|checkpoint|dates?)\b/.test(lower)) format = 'watchlist';
  if (type === 'yes_no' && horizon === 'now' && /\b(this month|good time|today)\b/.test(lower)) format = 'watchlist';
  if (/\b(is this month|this month a good time|good time to)\b/.test(lower)) {
    type = 'yes_no';
    format = 'watchlist';
  }

  let confidence = 0.9;
  if (scores.size === 0) confidence = 0.55;
  else if (ids.length > 2) confidence = 0.6;
  else if (ids.length === 2 && subjects[1]!.score === subjects[0]!.score && !explicit) confidence = 0.72;
  if (type === 'explain_term' || mentions.length >= 1) confidence = Math.max(confidence, 0.85);

  const safety: SafetyFlag = SELF_HARM.test(q) ? 'self_harm' : 'ok';
  const focusPoints: string[] = [];
  const transitCue = /\b(transit\w*|over my|on my|in my)\b/i.test(q);
  if (mentions.length >= 2 && transitCue) {
    const names = mentions.map((c) => PLANET_WORDS.find(([k]) => k === c)![1].source.match(/\(([a-z]+)/i)?.[1] ?? c);
    focusPoints.push(`${names[0]} transit relative to natal ${names.slice(1).join(', ')}`);
  }

  const intent: Intent = {
    subjects: subjects.map((s) => ({ id: s.id, weight: Math.round((s.score / total) * 100) / 100 })),
    horizon,
    questionType: type,
    format,
    focusPoints,
    mentionsPlanets: mentions,
    confidence,
    clarifyText: clarifyTextFor(ids, horizon, asOf),
    followUps: [],
    safety,
  };
  return { intent, confident: confidence >= 0.75 };
}

// ---- LLM intake -----------------------------------------------------------------------------------------

const intentZ = z.object({
  subjects: z.array(z.object({ id: z.string(), weight: z.number() })).min(1).max(3),
  horizon: z.union([z.string(), z.object({ from: z.string(), to: z.string() })]),
  questionType: z.string(),
  format: z.string(),
  focusPoints: z.array(z.string()).default([]),
  mentionsPlanets: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.7),
  clarifyText: z.string().default(''),
  followUps: z.array(z.string()).default([]),
  safety: z.string().default('ok'),
});

export const INTAKE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    subjects: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING', enum: [...SUBJECT_IDS] }, weight: { type: 'NUMBER' } }, required: ['id', 'weight'] } },
    horizon: { type: 'STRING' },
    questionType: { type: 'STRING', enum: [...QUESTION_TYPES] },
    format: { type: 'STRING', enum: [...FORMATS] },
    focusPoints: { type: 'ARRAY', items: { type: 'STRING' } },
    mentionsPlanets: { type: 'ARRAY', items: { type: 'STRING', enum: ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'] } },
    confidence: { type: 'NUMBER' },
    clarifyText: { type: 'STRING' },
    followUps: { type: 'ARRAY', items: { type: 'STRING' } },
    safety: { type: 'STRING', enum: ['ok', 'medical', 'legal', 'self_harm', 'minor'] },
  },
  required: ['subjects', 'horizon', 'questionType', 'format', 'confidence', 'clarifyText'],
};

function normalizeHorizon(h: unknown, asOf: string): Horizon {
  if (h && typeof h === 'object' && 'from' in h && 'to' in h) return h as { from: string; to: string };
  const s = String(h ?? '').trim();
  if (['now', '3m', '6m', '1y', '3y', 'life'].includes(s)) return s as Horizon;
  const range = /(\d{4}-\d{2}-\d{2})\D+(\d{4}-\d{2}-\d{2})/.exec(s);
  if (range) return { from: range[1]!, to: range[2]! };
  void asOf;
  return '1y';
}

export function sanitizeIntent(raw: z.infer<typeof intentZ>, asOf: string): Intent {
  const subjects = raw.subjects.filter((s) => isSubjectId(s.id)).slice(0, 3).map((s) => ({ id: s.id as SubjectId, weight: s.weight }));
  const final = subjects.length ? subjects : [{ id: 'general_life_direction' as SubjectId, weight: 1 }];
  const sum = final.reduce((n, s) => n + s.weight, 0) || 1;
  const horizon = normalizeHorizon(raw.horizon, asOf);
  const type = (QUESTION_TYPES as readonly string[]).includes(raw.questionType) ? (raw.questionType as QuestionType) : 'describe';
  const format = (FORMATS as readonly string[]).includes(raw.format) ? (raw.format as FormatId) : defaultFormat(type, final.map((s) => s.id), horizon);
  const mentions = raw.mentionsPlanets.filter((c) => ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'].includes(c));
  const safety = (['ok', 'medical', 'legal', 'self_harm', 'minor'] as const).includes(raw.safety as SafetyFlag) ? (raw.safety as SafetyFlag) : 'ok';
  const ids = final.map((s) => s.id);
  return {
    subjects: final.map((s) => ({ id: s.id, weight: Math.round((s.weight / sum) * 100) / 100 })),
    horizon,
    questionType: type,
    format,
    focusPoints: raw.focusPoints,
    mentionsPlanets: mentions,
    confidence: raw.confidence,
    clarifyText: raw.clarifyText || clarifyTextFor(ids, horizon, asOf),
    followUps: raw.followUps,
    safety,
  };
}

export async function llmIntake(question: string, asOf: string, history?: string | null): Promise<{ intent: Intent; usage: Usage }> {
  const model = modelFor('intake');
  const ctx = `Today is ${asOf}. Reference horizons: 3m ends ${horizonRange('3m', asOf).to}, 6m ends ${horizonRange('6m', asOf).to}, 1y ends ${horizonRange('1y', asOf).to}, end of this year is ${lastDayOfYear(asOf)}.`;
  const r = await callGemini({
    model,
    node: 'intake',
    system: PROMPTS['intake'],
    parts: [`${ctx}${history ? `\nPrevious turn: ${history}` : ''}\n\nQuestion: ${question}`],
    responseSchema: INTAKE_RESPONSE_SCHEMA,
    thinking: 'off',
    maxOutputTokens: 600,
    temperature: 0,
    timeoutMs: 8000,
  });
  const parsed = intentZ.parse(JSON.parse(r.text));
  return { intent: sanitizeIntent(parsed, asOf), usage: r.usage };
}

export type IntakeMode = 'auto' | 'rules' | 'llm';
export function intakeMode(): IntakeMode {
  const v = process.env.READING_INTAKE_MODE?.trim().toLowerCase();
  return v === 'rules' || v === 'llm' ? v : 'auto';
}

export async function runIntake(question: string, asOf: string, opts: { history?: string | null; mode?: IntakeMode } = {}): Promise<IntakeResult> {
  const t0 = Date.now();
  const mode = opts.mode ?? intakeMode();
  const rules = ruleIntake(question, asOf);
  const cls = classifyRules(question, asOf);
  const withCls = (intent: Intent): Intent => attachClassification(intent, cls, asOf);
  if (rules.intent.safety === 'self_harm') return { intent: withCls(rules.intent), usage: null, source: 'rules', ms: Date.now() - t0 };
  if (mode === 'rules' || (mode === 'auto' && rules.confident)) return { intent: withCls(rules.intent), usage: null, source: 'rules', ms: Date.now() - t0 };
  try {
    const { intent, usage } = await llmIntake(question, asOf, opts.history);
    // the rules are better at spotting a named planet than a small model is; union them
    const mentions = [...new Set([...intent.mentionsPlanets, ...rules.intent.mentionsPlanets])];
    return { intent: withCls({ ...intent, mentionsPlanets: mentions }), usage, source: 'llm', ms: Date.now() - t0 };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'reading intake llm failed; using rules', error: (err as Error).message }));
    return { intent: withCls(rules.intent), usage: null, source: 'rules_fallback', ms: Date.now() - t0 };
  }
}

/**
 * Attaches the bucket classification to an intent. When intake found no subject (it fell back to life direction) but
 * the classifier found a bucket, the bucket's primary frame becomes the subject.
 */
export function attachClassification(intent: Intent, c: ClassifierResult, asOf: string): Intent {
  const classification: IntentClassification = {
    bucket: c.bucket, subBucket: c.subBucket, alsoBuckets: c.alsoBuckets, confidence: c.confidence, slots: c.slots, missing: c.missing,
    template: c.template, policy: c.policy, unanswerable: c.unanswerable, questionKind: c.questionKind, source: c.source, ms: c.ms,
  };
  const fellBack = intent.subjects.length === 1 && intent.subjects[0]!.id === 'general_life_direction' && intent.confidence < 0.75;
  if (fellBack && c.bucket !== 'unknown' && c.bucket !== 'explain_term' && c.confidence >= 0.7) {
    const sub = c.subBucket ? BUCKETS[c.bucket].subBuckets.find((x) => x.id === c.subBucket) : undefined;
    const frame = sub?.frame ?? BUCKETS[c.bucket].frames[0]!;
    return { ...intent, subjects: [{ id: frame, weight: 1 }], clarifyText: clarifyTextFor([frame], intent.horizon, asOf), classification };
  }
  return { ...intent, classification };
}
