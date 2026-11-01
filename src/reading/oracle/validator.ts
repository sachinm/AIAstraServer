/**
 * Checks, after the answer has gone out, that the question was answered (docs/reading-engine/39 §4.1). Rules first, under 5 ms
 * and with no model; then a cheap model call with a 2 s budget. On any model failure the rules' result stands, so a validator
 * failure never holds or changes the answer. It reports; the flow decides whether the loop can run.
 */
import { z } from 'zod';
import { callGemini } from '../llm/gemini.js';
import { PROMPTS } from '../prompts/generated.js';
import type { Intent, Usage } from '../types.js';
import { CostRefusedError, type CostGuard } from './costGuard.js';
import { LOOP_READERS, type ReaderId } from './readers.js';

export const VALIDATOR_TIMEOUT_MS = 2_000;
const VALIDATOR_MAX_TOKENS = 400;

export interface MissingPart {
  part: string;
  missing: string;
  readers: ReaderId[];
}

export interface Validation {
  answered: boolean;
  source: 'rules' | 'model';
  missing: MissingPart[];
  /** problems the loop cannot fix, for the logs */
  flags: string[];
  usage?: Usage;
  ms: number;
}

const DATE = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const ENGINE = /\b(?:AIAstra_Radha|pyjhora|jhora)\b/i;
const STOP = new Set(['about', 'after', 'again', 'because', 'before', 'could', 'going', 'happen', 'there', 'their', 'these', 'thing', 'think', 'through', 'where', 'which', 'while', 'would', 'should', 'please', 'really', 'chart', 'reading', 'whats']);

/** The other questions in the text: at least two question marks, each with a content word to look for in the answer. */
function questionParts(question: string): Array<{ text: string; words: string[] }> {
  const pieces = question.split('?').map((s) => s.trim()).filter(Boolean);
  if (pieces.length < 2) return [];
  return pieces.map((text) => ({ text, words: (text.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !STOP.has(w)) })).filter((p) => p.words.length > 0);
}

/** Checks that need no model. */
export function validateByRules(a: { answer: string; question: string; intent: Pick<Intent, 'questionType'>; finishReason: string | null; stoppedForLoop: boolean; failedRequired: string[] }): Omit<Validation, 'ms'> {
  const missing: MissingPart[] = [];
  const flags: string[] = [];
  const text = a.answer.trim();
  if (text.length < 40) flags.push('empty');
  if (a.finishReason === 'MAX_TOKENS') flags.push('cut_off');
  if (a.stoppedForLoop) flags.push('loop_stopped');
  if (a.finishReason?.startsWith('BLOCKED') || a.finishReason === 'SAFETY' || a.finishReason === 'RECITATION') flags.push('blocked');
  if (ENGINE.test(text) || (/\bRadha\b/.test(text) && !/\bRadha\b/.test(a.question))) flags.push('engine_name');
  if (a.failedRequired.length) flags.push(`layers_missing:${a.failedRequired.join(',')}`);
  if (a.intent.questionType === 'timing' && text.length >= 40 && !DATE.test(text)) {
    missing.push({ part: 'when', missing: 'the dates asked for', readers: ['R08', 'R10'] });
  }
  const lower = text.toLowerCase();
  for (const p of questionParts(a.question)) {
    if (!p.words.some((w) => lower.includes(w))) missing.push({ part: p.text.slice(0, 80), missing: 'this part of the question', readers: [] });
  }
  return { answered: missing.length === 0 && !flags.some((f) => f === 'empty' || f === 'cut_off' || f === 'blocked'), source: 'rules', missing, flags };
}

const verdictZ = z.object({
  answered: z.boolean().catch(true),
  parts: z
    .array(z.object({ part: z.string().catch(''), status: z.enum(['answered', 'partial', 'missing']).catch('answered'), missing: z.string().catch(''), readers: z.array(z.string()).catch([]) }))
    .catch([]),
});

const VALIDATOR_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answered: { type: 'BOOLEAN' },
    parts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { part: { type: 'STRING' }, status: { type: 'STRING', enum: ['answered', 'partial', 'missing'] }, missing: { type: 'STRING' }, readers: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['part', 'status'],
      },
    },
  },
  required: ['answered', 'parts'],
};

const known = (ids: string[]): ReaderId[] => ids.filter((x): x is ReaderId => (LOOP_READERS as string[]).includes(x)).slice(0, 2);

/** Rules, then the model when one is configured and affordable. */
export async function validateAnswer(a: {
  answer: string;
  question: string;
  intent: Intent;
  finishReason: string | null;
  stoppedForLoop: boolean;
  failedRequired: string[];
  model: string;
  useModel: boolean;
  guard: CostGuard;
}): Promise<Validation> {
  const t0 = Date.now();
  const rules = validateByRules(a);
  const done = (v: Omit<Validation, 'ms'>): Validation => ({ ...v, ms: Date.now() - t0 });
  // an empty or cut-off answer has nothing a check can read
  if (!a.useModel || rules.flags.includes('empty')) return done(rules);
  const clarified = a.intent.clarified?.turns.filter((t) => t.answer).map((t) => `${t.criterion}: ${t.answer}`).join('; ');
  const parts = [`QUESTION: ${a.question}`, ...(clarified ? [`THEY ALSO TOLD THE CLARIFIER: ${clarified}`] : []), `ANSWER: ${a.answer}`];
  let reservation;
  try {
    reservation = a.guard.reserve({ stage: 'support', node: 'validator', model: a.model, promptTokens: Math.ceil(((PROMPTS['oracle/validator'] ?? '').length + parts.join('\n').length) / 3.6), maxOutputTokens: VALIDATOR_MAX_TOKENS, minOutputTokens: 100 });
  } catch (err) {
    if (err instanceof CostRefusedError) return done({ ...rules, flags: [...rules.flags, 'validator_budget'] });
    throw err;
  }
  try {
    const r = await callGemini({ model: a.model, node: 'validator', system: PROMPTS['oracle/validator'], parts, responseSchema: VALIDATOR_SCHEMA, thinking: 'off', maxOutputTokens: reservation.maxOutputTokens, temperature: 0, timeoutMs: VALIDATOR_TIMEOUT_MS });
    a.guard.settle(reservation, r.usage);
    const parsed = verdictZ.safeParse(JSON.parse(r.text));
    if (!parsed.success) return done(rules);
    const fromModel = parsed.data.parts.filter((p) => p.status !== 'answered').map((p) => ({ part: p.part.slice(0, 120), missing: p.missing.slice(0, 160), readers: known(p.readers) }));
    // a part the rules found keeps its readers unless the model named others for it
    const merged = fromModel.length ? fromModel : rules.missing;
    return done({ answered: parsed.data.answered && merged.length === 0 && rules.answered, source: 'model', missing: merged, flags: rules.flags, usage: r.usage });
  } catch {
    a.guard.settleUnknown(reservation);
    return done({ ...rules, flags: [...rules.flags, 'validator_failed'] });
  }
}
