/**
 * Specialist analysts (promise, dasha, transit, nakshatra): each reads only its slice of the evidence pack and returns
 * structured findings whose claims cite evidence ids (dot paths into the pack). Run in parallel by the graph.
 * Prompt layout keeps the cacheable prefix first: system (persona + method, identical for everyone), the user's base chart,
 * then the analyst-specific slice, then the analyst instructions and the question.
 */
import { z } from 'zod';
import { readingSpecialistMaxTokens, readingSpecialistTimeoutMs } from '../config.js';
import { callGemini } from '../llm/gemini.js';
import type { CacheOwner } from '../llm/promptCache.js';
import { modelFor } from '../llm/models.js';
import { renderBase, renderSubject, type Analyst, type EvidencePack } from '../packs/selector.js';
import type { SubjectId } from '../packs/frames.js';
import { PROMPTS } from '../prompts/generated.js';
import type { Intent, Usage } from '../types.js';

/** The model answered but its JSON was rejected. Carries the usage, because those tokens were billed all the same. */
export class SpecialistOutputError extends Error {
  constructor(
    message: string,
    readonly usage: Usage
  ) {
    super(message);
    this.name = 'SpecialistOutputError';
  }
}

export type SpecialistAnalyst = Exclude<Analyst, 'single'>;
export const SPECIALIST_ANALYSTS: SpecialistAnalyst[] = ['promise', 'dasha', 'transit', 'nakshatra'];

// Tolerant by design (doc 25): a cheap model's one bad field must not cost the whole layer. Out-of-range or unknown
// values fall back to a safe default with `.catch`, and a malformed claim or window is dropped on its own (`keepValid`).
export const claimZ = z.object({
  text: z.string().min(3),
  evidence: z.array(z.string()).catch([]),
  polarity: z.enum(['supports', 'obstructs', 'neutral']).catch('neutral'),
  // was the only min(1) in the schema: one claim with weight 0 failed the transit layer on staging
  weight: z.number().int().min(1).max(3).catch(2),
  /** which school's rule the claim applies (docs/reading-engine/10 §4) */
  tradition: z.enum(['parashara', 'jaimini', 'nakshatra', 'tajaka', 'kuta', 'kp_starlord']).catch('parashara'),
});
export const windowZ = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().catch(''),
  polarity: z.enum(['favourable', 'testing', 'mixed']).catch('mixed'),
  evidence: z.array(z.string()).catch([]),
});
/** An array whose bad items are dropped one by one instead of failing the whole array. */
const keepValid = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) => items.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success ? [r.data as z.infer<T>] : [];
    }));
export const findingZ = z.object({
  verdict: z.enum(['strong', 'moderate', 'weak', 'denied', 'mixed']).catch('mixed'),
  /** this analyst's layer as a signed strength −3…+3 (file 11 §1) */
  layerScore: z.number().int().min(-3).max(3).catch(0),
  claims: keepValid(claimZ),
  windows: keepValid(windowZ),
  caveats: z.array(z.string()).catch([]),
  keyFacts: z.array(z.string()).catch([]),
});

export interface Finding {
  analyst: SpecialistAnalyst;
  subject: SubjectId;
  verdict: z.infer<typeof findingZ>['verdict'];
  /** −3…+3; undefined for findings from before layer scoring */
  layerScore?: number;
  /** ok | skipped (optional agent timed out) | failed (required agent failed after its retry) | cached */
  status?: 'ok' | 'skipped' | 'failed' | 'cached';
  claims: Array<z.infer<typeof claimZ>>;
  windows: Array<z.infer<typeof windowZ>>;
  caveats: string[];
  keyFacts: string[];
}

export const FINDING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['strong', 'moderate', 'weak', 'denied', 'mixed'] },
    layerScore: { type: 'INTEGER' },
    claims: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          evidence: { type: 'ARRAY', items: { type: 'STRING' } },
          polarity: { type: 'STRING', enum: ['supports', 'obstructs', 'neutral'] },
          weight: { type: 'INTEGER' },
          tradition: { type: 'STRING', enum: ['parashara', 'jaimini', 'nakshatra', 'tajaka', 'kuta', 'kp_starlord'] },
        },
        required: ['text', 'evidence', 'polarity', 'weight', 'tradition'],
      },
    },
    windows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          from: { type: 'STRING' },
          to: { type: 'STRING' },
          label: { type: 'STRING' },
          polarity: { type: 'STRING', enum: ['favourable', 'testing', 'mixed'] },
          evidence: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['from', 'to', 'label', 'polarity', 'evidence'],
      },
    },
    caveats: { type: 'ARRAY', items: { type: 'STRING' } },
    keyFacts: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['verdict', 'layerScore', 'claims', 'windows', 'caveats', 'keyFacts'],
};

export function analystsFor(intent: Intent): SpecialistAnalyst[] {
  const out: SpecialistAnalyst[] = ['promise', 'dasha', 'transit'];
  const deepNak = intent.subjects.some((s) => s.id === 'general_life_direction') || /nakshatra/i.test(intent.focusPoints.join(' ')) || intent.questionType === 'why_meaning';
  if (deepNak || intent.mentionsPlanets.length > 0) out.push('nakshatra');
  return out;
}

/** Fast lane: one subject, short horizon, simple question type → skip the specialists, go straight to the answer. */
export function isFastLane(intent: Intent): boolean {
  if (process.env.READING_FAST_LANE?.trim() === '0') return false;
  const short = intent.horizon === 'now' || intent.horizon === '3m' || intent.horizon === '6m';
  return intent.subjects.length === 1 && short && (intent.questionType === 'yes_no' || intent.questionType === 'explain_term');
}

export async function runSpecialist(args: {
  analyst: SpecialistAnalyst;
  subject: SubjectId;
  pack: EvidencePack;
  intent: Intent;
  question: string;
  system: string;
  asOf: string;
  /** owner of the explicit prompt cache (promptCache.ts) */
  cacheOwner?: CacheOwner;
}): Promise<{ finding: Finding; usage: Usage }> {
  const { analyst, pack, intent } = args;
  const model = modelFor('specialist');
  const tail = [
    `TODAY: ${args.asOf}`,
    `ANALYST: ${analyst}`,
    PROMPTS[analyst],
    `Subject: ${args.subject}. Horizon: ${typeof intent.horizon === 'string' ? intent.horizon : `${intent.horizon.from} to ${intent.horizon.to}`}. Focus: ${intent.focusPoints.join('; ') || 'none'}.`,
    'Return at most 8 claims and at most 12 windows. Each claim is one sentence of at most 200 characters about this chart and lists 1-4 evidence ids copied exactly from the pack as dot paths (for example detail.houses.10.lord). Each claim weight is 1, 2 or 3. Dates must come from the pack. Keep the JSON complete: shorter claims are better than a cut-off answer.',
    'Tag every claim with the tradition whose rule you applied (parashara, jaimini, nakshatra, kp_starlord). Give layerScore: your layer as one signed strength from -3 (clearly denied or obstructed) to +3 (clearly promised or supported), 0 when balanced.',
    `QUESTION: ${args.question}`,
  ].join('\n');
  const r = await callGemini({
    model,
    node: `specialist:${analyst}`,
    system: args.system,
    parts: [renderBase(pack), renderSubject(pack, analyst), tail],
    responseSchema: FINDING_RESPONSE_SCHEMA,
    cachePrefix: true,
    cacheOwner: args.cacheOwner,
    thinking: 'off',
    maxOutputTokens: readingSpecialistMaxTokens(),
    temperature: 0.2,
    timeoutMs: readingSpecialistTimeoutMs(),
  });
  let parsed: z.infer<typeof findingZ>;
  try {
    parsed = findingZ.parse(JSON.parse(r.text));
  } catch (err) {
    throw new SpecialistOutputError(
      `specialist ${analyst} returned unparsable JSON (${r.finishReason ?? 'no finish reason'}): ${(err as Error).message.slice(0, 120)}`,
      r.usage
    );
  }
  return {
    finding: { analyst, subject: args.subject, verdict: parsed.verdict, layerScore: parsed.layerScore, status: 'ok', claims: parsed.claims.slice(0, 8), windows: parsed.windows, caveats: parsed.caveats, keyFacts: parsed.keyFacts.slice(0, 6) },
    usage: r.usage,
  };
}
