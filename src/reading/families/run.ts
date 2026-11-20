/**
 * The family readers (docs/reading-engine/66 §4.8 step 4; docs/techniques/09 §3.1 "Sub-agents"): seven sub-agents, one
 * per family pack, run in parallel, each read through `reading_findings_cache` first. Their keyed findings are the
 * findings layer every later agent cites (the lens linemen, the card Oracle).
 *
 * Moved here unchanged from `self/v2/slices.ts` (the slices) and `self/v2/build.ts` (the runner) for the retired v2
 * build (plan "retire the v2 Self reading", server step 1); the old paths re-export. The findings cache key
 * (`self:<kundli>:<family>:<pack hash>:<prompt version>`) is unchanged. The one new input is the technique a run is
 * tagged with (default `self.v2.oracle`, as before).
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { getSelfFamilyMaxOutputTokens } from '../../config/env.js';
import { callWithContinuation } from '../llm/continue.js';
import type { informIndividualCacheUsed } from '../llm/cacheSweep.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { modelFor } from '../llm/models.js';
import { loadDbReaderCache, saveDbReaderCache, type HeldReader } from '../oracle/prewarm.js';
import { PROMPT_VERSION } from '../prompts/generated.js';
import { buildSelfFamilyPacks, FAMILY_SYSTEM_PROMPTS, redactEngineTerms, type SelfFamilyAgentId, type SelfFamilyPack } from '../self/oracle.js';
import { timingOf } from '../self/agentTiming.js';
import type { SelfV2Loaded } from '../self/sub/index.js';
import type { SelfClock } from '../self/types.js';
import type { ClockResolution, PreparedAgentSlice, SelfBuildContext, SelfV2AgentTiming, SelfV2FamilyAgentId, WindowRef } from '../self/v2types.js';
import { clockLabel, completeSentencesOf, CUT_FINDING_NOTE } from '../self/words.js';
import { markAgentUsed } from '../slices/warm.js';
import { estTokens, KeyBook, MIN_CACHE_TOKENS, preparedSlice, shortHash, windowLine } from '../slices/natalPrefix.js';

export const FAMILY_IDS: readonly SelfV2FamilyAgentId[] = ['family.rasi', 'family.moon', 'family.varga', 'family.star', 'family.dasha', 'family.year', 'family.sky'];

/** The S1 resolution in the shape the family packs read. */
export function toSelfClock(c: ClockResolution): SelfClock {
  return {
    system: c.primary,
    label: clockLabel(c.primary),
    reason: c.reason === 'conditional_applies' ? 'applicable' : c.reason,
    confirming: c.confirming.map((system) => ({ system, label: clockLabel(system) })),
    choices: c.applicable.map((system) => ({ system, label: clockLabel(system) })),
  };
}

/** every window row the context carries, deduplicated by row id, strip first */
function allWindowRows(ctx: SelfBuildContext): WindowRef[] {
  const w = ctx.sub.windows;
  const out = new Map<string, WindowRef>();
  const add = (r: WindowRef | null | undefined) => {
    if (r && !out.has(r.rowId)) out.set(r.rowId, r);
  };
  if (w) {
    for (const r of w.strip) add(r);
    add(w.heaviestNow);
    for (const r of w.startedLast12m) add(r);
    for (const r of w.endingNext6m) add(r);
    for (const rows of Object.values(w.byMatter)) for (const r of rows ?? []) add(r);
  }
  for (const r of ctx.sub.body?.liveTransits ?? []) add(r);
  return [...out.values()];
}

export interface FamilySlices {
  slices: Record<SelfV2FamilyAgentId, PreparedAgentSlice>;
  packs: Record<SelfFamilyAgentId, SelfFamilyPack>;
}

/** The five family readers' slices; family.sky padded past 1,024 tokens with the window rows it may read. */
export function buildFamilySlices(ctx: SelfBuildContext, loaded: SelfV2Loaded): FamilySlices {
  if (!ctx.sub.clock) throw new Error('self v2 slices: the clock (S1) is missing from the build context');
  const packs = buildSelfFamilyPacks(loaded.view, loaded.activation, toSelfClock(ctx.sub.clock), ctx.asOf, loaded.sky);
  const sky = packs['family.sky'];
  if (estTokens(sky.prefix) < MIN_CACHE_TOKENS) {
    const book = new KeyBook();
    const lines = [`## WINDOW ROWS family.sky may read (engine windows around ${ctx.asOf.slice(0, 7)}, padding to the cache minimum)`];
    let prefix = `${sky.prefix}\n${lines[0]}`;
    for (const r of allWindowRows(ctx)) {
      if (estTokens(prefix) >= MIN_CACHE_TOKENS) break;
      prefix += `\n${windowLine(book, r)}`;
    }
    const keys = [...sky.keys, ...book.keys];
    packs['family.sky'] = { ...sky, prefix, keys, packHash: shortHash(`${loaded.view.version}|sky|${sky.horizonKey}|${prefix}`) };
  }
  const model = modelFor('reader');
  const slices = Object.fromEntries(
    FAMILY_IDS.map((id) => {
      const p = packs[id];
      return [id, preparedSlice(id, ctx, p.prefix, p.dynamic, model, FAMILY_SYSTEM_PROMPTS[id], p.keys)];
    }),
  ) as Record<SelfV2FamilyAgentId, PreparedAgentSlice>;
  return { slices, packs };
}

/** the technique the family readers' runs were tagged with before the move (the v2 Oracle's; registered) */
export const FAMILY_READERS_DEFAULT_TECHNIQUE = 'self.v2.oracle';

export interface FamilyReadersDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: typeof informIndividualCacheUsed;
  /** run every reader even when its findings are stored */
  force?: boolean;
}

const since = (t0: number) => Math.round((performance.now() - t0) * 100) / 100;

/** Step 4: the family readers, in parallel, each read through `reading_findings_cache` first. */
export async function runFamilyReaders(
  deps: FamilyReadersDeps,
  ctx: SelfBuildContext,
  fam: FamilySlices,
  opts: { technique?: string } = {},
): Promise<{ findings: Array<{ family: string; text: string }>; timings: SelfV2AgentTiming[]; gaps: string[] }> {
  const gaps: string[] = [];
  const owner = { userId: ctx.userId, kundliId: ctx.kundliId };
  const outs = await Promise.all(
    FAMILY_IDS.map(async (id: SelfV2FamilyAgentId) => {
      const slice = fam.slices[id];
      const pack = fam.packs[id];
      const cacheKey = `self:${ctx.kundliId}:${id}:${pack.packHash}:${PROMPT_VERSION}`;
      const t0 = performance.now();
      const held = !deps.force ? await loadDbReaderCache(deps.prisma, cacheKey, owner).catch(() => undefined) : undefined;
      const cachedText = (held?.finding as unknown as { rawText?: string } | undefined)?.rawText;
      if (cachedText) return { family: id, text: cachedText, timing: timingOf(id, id, slice.model, null, since(t0), 'cached') };
      try {
        const res = await withAgentRun(
          deps.prisma,
          id,
          {
            userId: ctx.userId,
            kundliId: ctx.kundliId,
            technique: opts.technique ?? FAMILY_READERS_DEFAULT_TECHNIQUE,
            task: `${id} v2 ${ctx.asOf}`,
            input: { family: id, keys: slice.keys.length, natal: pack.natal ? 1 : 0, prefixTokens: slice.estTokens.prefix },
            charts: pack.charts,
          },
          async () => {
            // doc 66 replay run 2: 2,000 cut family.dasha (654 out + 1,342 thought); env SELF_FAMILY_MAX_OUTPUT_TOKENS
            // (6,000, docs/techniques/09 §3.1); a finding that reaches it is continued, never thrown away (§3.5)
            const g = await callWithContinuation(deps.callGemini, {
              model: slice.model,
              node: id,
              system: slice.system,
              parts: [slice.prefix, slice.suffix],
              thinking: 'medium',
              maxOutputTokens: getSelfFamilyMaxOutputTokens(),
              timeoutMs: 60_000,
              cachePrefix: true,
              cacheOwner: slice.cacheOwner,
            });
            return {
              value: g,
              usage: { model: slice.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
              output: { chars: g.text.length, cachedTokens: g.usage?.cachedTokens ?? 0, finish: g.finishReason ?? null, thoughtsReported: g.usage?.thoughtTokensReported ?? null },
            };
          },
        );
        markAgentUsed(slice, deps.informUsed);
        // a finding is continued at its ceiling (llm/continue.ts); one still cut after the continuations keeps its complete
        // sentences with a note and is not cached (doc 66 replay run 2, failure 7)
        const cut = res.finishReason === 'MAX_TOKENS';
        if (res.continued) gaps.push(`${id}: continued ${res.continued} time(s) at the output ceiling${cut ? '; still cut' : ''}`);
        const kept = cut ? completeSentencesOf(res.text) : res.text;
        if (cut) gaps.push(`${id}: cut at the output cap (MAX_TOKENS); ${kept ? `${kept.length} of ${res.text.length} chars kept, complete sentences only` : 'no complete sentence; not passed to the Oracle'}`);
        const text = kept ? redactEngineTerms(cut ? [kept, CUT_FINDING_NOTE].join('\n') : kept) : '';
        const timing = timingOf(id, id, slice.model, res, since(t0), 'ok');
        if (cut) return { family: id, text, timing };
        const stored: HeldReader = {
          finding: { reader: id, rawText: text } as unknown as HeldReader['finding'],
          usage: { node: id, model: slice.model, promptTokens: timing.promptTokens, cachedTokens: timing.cachedTokens, outputTokens: timing.outputTokens, thoughtTokens: timing.thoughtTokens, ms: timing.ms },
        };
        await saveDbReaderCache(deps.prisma, {
          cacheKey,
          kundliId: ctx.kundliId,
          userId: ctx.userId,
          readerId: id,
          packHash: pack.packHash,
          horizonKey: pack.horizonKey,
          promptVersion: PROMPT_VERSION,
          natal: pack.natal,
          ...(pack.expiresAt ? { expiresAt: pack.expiresAt } : {}),
          held: stored,
          used: true,
        }).catch(() => undefined);
        return { family: id, text, timing };
      } catch (e) {
        return { family: id, text: '', timing: timingOf(id, id, slice.model, null, since(t0), 'failed'), error: String((e as Error).message ?? e).slice(0, 160) };
      }
    }),
  );
  return { findings: outs.filter((o) => o.text).map((o) => ({ family: o.family, text: o.text })), timings: outs.map((o) => o.timing), gaps };
}
