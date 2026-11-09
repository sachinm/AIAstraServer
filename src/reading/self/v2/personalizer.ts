/**
 * The Self v2 Personalizer (docs/reading-engine/66 §4.1, §4.7 step 7–8): one call over the Oracle document (the cached
 * prefix) and the person (the suffix), forced to a `PersonalCardDoc` by a `responseSchema`, then validated
 * (personalizerValidate.ts). It never sees the chart, so it cannot add astrology; the validator checks it did not.
 * Model and output cap from env (`SELF_PERSONALIZER_MODEL`, `SELF_PERSONALIZER_MAX_OUTPUT_TOKENS`).
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../../agents/registry.js';
import { getSelfPersonalizerMaxOutputTokens } from '../../../config/env.js';
import type { GeminiCallOptions, GeminiResult } from '../../llm/gemini.js';
import type { PersonalizerInput, PreparedAgentSlice, SelfBuildContext, SelfV2CardsResult, WindowRef } from '../v2types.js';
import { markAgentUsed } from './cache.js';
import { timingOf } from './oracle.js';
import { parsePersonalDoc, TONES, validatePersonalDoc } from './personalizerValidate.js';
import { promptHash, SELF_V2_PERSONALIZER_PROMPT } from './slices.js';

export const PERSONALIZER_TIMEOUT_MS = 60_000;

/** The responseSchema: the hero's words and one card per area of the Oracle document. Code fills strip and dates. */
export function personalizerSchema(areaIds: readonly string[]): Record<string, unknown> {
  const S = (description?: string) => ({ type: 'STRING', ...(description ? { description } : {}) });
  return {
    type: 'OBJECT',
    properties: {
      hero: {
        type: 'OBJECT',
        properties: {
          tone: { type: 'STRING', enum: [...TONES] },
          sentence: S('one sentence: the life area and the date it changes'),
          sub: S('one short supporting line, or empty'),
          questionClaimId: S('the claim: id of the strongest dated claim the question checks, or empty'),
          questionText: S('one plain yes/no question for this person, or empty'),
          withheld: { type: 'BOOLEAN', description: 'true when the live areas disagree or are only possible' },
        },
        required: ['tone', 'sentence', 'sub', 'questionClaimId', 'questionText', 'withheld'],
      },
      cards: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            areaId: { type: 'STRING', enum: [...areaIds] },
            headline: S('at most 14 words, second person'),
            body: { type: 'ARRAY', items: S(), description: '2 or 3 short paragraphs, at most 120 words in all' },
            patterns: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: { text: S(), kind: { type: 'STRING', enum: ['risk', 'watch', 'strength'] }, since: S('YYYY-MM-DD or empty'), until: S('YYYY-MM-DD or empty'), source: S('paragraph id or evidence key') },
                required: ['text', 'kind', 'since', 'until', 'source'],
              },
            },
            ladder: {
              type: 'OBJECT',
              properties: { best: S(), practical: S(), drift: S(), floor: S() },
              required: ['best', 'practical', 'drift', 'floor'],
            },
            dates: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { from: S('YYYY-MM-DD'), to: S('YYYY-MM-DD'), label: S() }, required: ['from', 'to', 'label'] },
            },
            sources: { type: 'ARRAY', items: S(), description: 'one per sentence of headline then body, in order: an Oracle paragraph id or evidence key' },
          },
          required: ['areaId', 'headline', 'body', 'patterns', 'dates', 'sources'],
        },
      },
    },
    required: ['hero', 'cards'],
  };
}

export interface PersonalizerDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  spentUsd?: number;
  maxSpendUsd: number;
}

/** One Personalizer call, then the validator. Never throws; only an `ok` result is stored by the build. */
export async function runPersonalizer(
  deps: PersonalizerDeps,
  ctx: SelfBuildContext,
  slice: PreparedAgentSlice,
  input: PersonalizerInput,
  strip: readonly WindowRef[],
): Promise<Omit<SelfV2CardsResult, 'cached'>> {
  const pHash = promptHash(SELF_V2_PERSONALIZER_PROMPT);
  const model = slice.model;
  const areaIds = Object.keys(input.oracle.doc.areas);
  const t0 = performance.now();
  try {
    const res = await withAgentRun(
      deps.prisma,
      'self.personalizer',
      {
        userId: ctx.userId,
        kundliId: ctx.kundliId,
        technique: 'self.v2.personalizer',
        task: `self.v2.personalizer ${ctx.asOf}`,
        input: { areas: areaIds.length, prefixTokens: slice.estTokens.prefix, suffixTokens: slice.estTokens.suffix },
        charts: [{ type: 'technique_output', variant: 'self.v2.oracle' }],
      },
      async () => {
        const g = await deps.callGemini({
          model,
          node: 'self.personalizer',
          system: slice.system,
          parts: [slice.prefix, slice.suffix],
          thinking: 'low',
          maxOutputTokens: getSelfPersonalizerMaxOutputTokens(),
          timeoutMs: PERSONALIZER_TIMEOUT_MS,
          cachePrefix: true,
          cacheOwner: slice.cacheOwner,
          responseSchema: personalizerSchema(areaIds),
        });
        return {
          value: g,
          usage: { model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
          output: { chars: g.text.length, cachedTokens: g.usage?.cachedTokens ?? 0 },
        };
      },
    );
    markAgentUsed(slice, deps.informUsed);
    const parsed = parsePersonalDoc(res.text);
    const call = timingOf('self.personalizer', 'self.personalizer', model, res, performance.now() - t0, parsed ? 'ok' : 'failed');
    const base = { promptHash: pHash, model, call };
    if ((deps.spentUsd ?? 0) + call.costUsd > deps.maxSpendUsd) return { ...base, status: 'budget_exceeded', doc: null, cardStatus: {}, gaps: ['personalizer: spend over the cap'] };
    if (!parsed) return { ...base, status: 'failed', doc: null, cardStatus: {}, gaps: [`personalizer: no card document (finish ${res.finishReason ?? 'unknown'}, ${res.text.length} chars)`] };
    const v = validatePersonalDoc(parsed, input, strip);
    return { ...base, status: 'ok', doc: v.doc, cardStatus: v.cardStatus, gaps: v.gaps };
  } catch (e) {
    return {
      promptHash: pHash,
      model,
      call: timingOf('self.personalizer', 'self.personalizer', model, null, performance.now() - t0, 'failed'),
      status: 'failed',
      doc: null,
      cardStatus: {},
      gaps: [`personalizer: ${String((e as Error).message ?? e).slice(0, 200)}`],
    };
  }
}
