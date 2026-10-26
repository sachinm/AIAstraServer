/**
 * Ledger interview (docs/reading-engine/27 §B.4 stage 0): the person's free text ("tell me what happened in 2014")
 * becomes PROPOSED ledger rows they confirm one by one. Nothing is stored here.
 *
 * - The declined-topics gate runs on the text before the model sees it, and again on every proposal after the call
 *   (its category label, place and attribute values); a proposal that trips it is dropped.
 * - One schema-constrained call (categories are an enum), temperature 0.1, the intake model.
 * - Every proposal passes the same checks as the form (ledgerCategories.ts). Attribute values with judgement words or
 *   amounts are dropped from the proposal rather than rewritten.
 * - English only.
 */
import { callGemini, type GeminiCallOptions, type GeminiResult } from '../llm/gemini.js';
import { modelFor } from '../llm/models.js';
import type { Usage } from '../types.js';
import type { DatePrecision } from './ledger.js';
import { ALL_LEDGER_CATEGORIES, DIRECTIONS, LEDGER_ATTRIBUTES, LEDGER_CATEGORIES, categoryLabel, checkAttributes, checkLedgerInput, cleanText, hasAmount, hasJudgement, MAX_PLACE_CHARS, type LedgerInput } from './ledgerCategories.js';
import { MARKER_IDS } from './markers.js';

export const INTERVIEW_PROMPT_VERSION = 'ledger-interview-v1';
export const MAX_INTERVIEW_CHARS = 2000;
export const MAX_PROPOSALS = 20;

export interface LedgerProposal extends LedgerInput {
  proposalId: string;
}

export type InterviewResult =
  | { status: 'ok'; proposals: LedgerProposal[]; dropped: number; usage: Usage | null }
  | { status: 'declined'; reply: string }
  | { status: 'invalid'; error: string }
  | { status: 'unavailable' };

export interface InterviewDeps {
  /** The declined-topics gate for this user (src/reading/policy/declined.ts `declinedFor`); null = allowed */
  gate: (text: string) => Promise<{ reply: string } | null>;
  /** The model call (default: callGemini); tests pass a fake */
  call?: (o: GeminiCallOptions) => Promise<GeminiResult>;
  today?: Date;
}

const ATTRIBUTE_KEYS = LEDGER_ATTRIBUTES.map((a) => a.key);

export const INTERVIEW_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    events: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: ALL_LEDGER_CATEGORIES },
          date: { type: 'STRING', description: 'YYYY-MM-DD, YYYY-MM or YYYY, as precise as the text says and no more' },
          date_precision: { type: 'STRING', enum: ['day', 'month', 'year'] },
          place: { type: 'STRING', description: 'place as written, or empty' },
          attributes: {
            type: 'OBJECT',
            properties: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, k === 'direction' ? { type: 'STRING', enum: ['', ...DIRECTIONS] } : { type: 'STRING' }])),
          },
        },
        required: ['category', 'date', 'date_precision'],
      },
    },
  },
  required: ['events'],
};

function categoryList(): string {
  return MARKER_IDS.map((m) => LEDGER_CATEGORIES[m].map((c) => `${c.code} (${c.label})`).join('; ')).join('\n');
}

export const INTERVIEW_SYSTEM = [
  'You turn a person\'s own account of their past into a list of dated life events for their record. You only extract; you never comment.',
  'Rules:',
  '1. Facts only: what happened, when, where, and the plain attributes listed below. Copy nothing that evaluates, judges or interprets (no good, bad, lucky, difficult, successful, failed, happy, sad). A business that closed is business.end with outcome "closed", nothing more.',
  '2. One event per thing that happened. Use only the categories given. If nothing in the text fits a category, leave it out. Never invent an event, a date or a detail that the text does not state.',
  '3. Dates: as precise as the text says. A year alone is precision "year" (date "YYYY"); a month and year is "month" ("YYYY-MM"); a full date is "day". If the text gives no year and the person said which year they are describing, use that year.',
  '4. Attributes (empty string when not stated): colour, make (vehicle make), direction (one of N, NE, E, SE, S, SW, W, NW), floor, field (of study or work), country, outcome (a plain word such as started, closed, sold, completed), with_whom (a relation such as father or partner, never a full name).',
  '5. Never record amounts of money, medical details beyond the plain category, diagnoses, legal opinions, remedies or advice. Health events are recorded as the category and date only.',
  '6. English only.',
  'Categories:',
  categoryList(),
].join('\n');

function interviewParts(text: string, year: number | null): string[] {
  return [`${year ? `The person is describing the year ${year}.\n` : ''}Their account:\n"""\n${text}\n"""\nReturn the events as JSON.`];
}

function parseEvents(raw: string): unknown[] {
  try {
    const j = JSON.parse(raw) as { events?: unknown };
    return Array.isArray(j?.events) ? j.events : [];
  } catch {
    return [];
  }
}

/** Keep only the attributes that pass the form's checks one by one */
function cleanAttributes(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const c = checkAttributes({ [k]: v });
    if (c.ok) Object.assign(out, c.value);
  }
  return out;
}

function proposalText(p: LedgerInput): string {
  return [categoryLabel(p.category), p.place ?? '', ...Object.values(p.attributes)].join('. ');
}

export async function extractLedgerProposals(rawText: unknown, opts: { year?: unknown }, deps: InterviewDeps): Promise<InterviewResult> {
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) return { status: 'invalid', error: 'text_required' };
  if (text.length > MAX_INTERVIEW_CHARS) return { status: 'invalid', error: 'text_too_long' };
  const today = deps.today ?? new Date();
  const y = Number(opts.year);
  const year = Number.isInteger(y) && y >= 1900 && y <= today.getUTCFullYear() ? y : null;

  // before: the model never sees declined text
  const before = await deps.gate(text);
  if (before) return { status: 'declined', reply: before.reply };

  let result: GeminiResult;
  try {
    result = await (deps.call ?? callGemini)({
      model: modelFor('intake'),
      node: 'timeline_interview',
      system: INTERVIEW_SYSTEM,
      parts: interviewParts(text, year),
      responseSchema: INTERVIEW_SCHEMA,
      temperature: 0.1,
      thinking: 'off',
      maxOutputTokens: 2048,
      timeoutMs: 30_000,
    });
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'ledger interview call failed', error: String((err as Error)?.message ?? err).slice(0, 200) }));
    return { status: 'unavailable' };
  }

  const proposals: LedgerProposal[] = [];
  let dropped = 0;
  for (const e of parseEvents(result.text)) {
    if (proposals.length >= MAX_PROPOSALS) {
      dropped++;
      continue;
    }
    const r = (e ?? {}) as Record<string, unknown>;
    const placeRaw = cleanText(r.place, MAX_PLACE_CHARS);
    const place = placeRaw && !hasJudgement(placeRaw) && !hasAmount(placeRaw) ? placeRaw : null;
    const precision = r.date_precision as DatePrecision;
    const checked = checkLedgerInput({ category: r.category, date: r.date, date_precision: precision, place, attributes: cleanAttributes(r.attributes) }, today);
    if (!checked.ok) {
      dropped++;
      continue;
    }
    // after: what the model wrote passes the same gate
    if (await deps.gate(proposalText(checked.value))) {
      dropped++;
      continue;
    }
    proposals.push({ proposalId: `p${proposals.length + 1}`, ...checked.value });
  }
  return { status: 'ok', proposals, dropped, usage: result.usage ?? null };
}
