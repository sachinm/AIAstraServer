/**
 * One reader call. The prompt starts with the bytes every reader of this person shares (reader rules, CHART CORE), so the
 * explicit cache serves them at the cached rate; then this reader's tables, then its curriculum and the question.
 * The output limit comes from the cost guard. Every attempt settles its bill, including a failed one.
 */
import { z } from 'zod';
import { callGemini, GeminiHttpError } from '../llm/gemini.js';
import type { CacheOwner } from '../llm/promptCache.js';
import { claimZ, failureReason, parseFindingText, TRUNCATED_CAVEAT, windowZ, type Finding, type SpecialistFailureReason } from '../nodes/specialists.js';
import { FRAMES, type SubjectId } from '../packs/frames.js';
import { hashText, type EvidencePack } from '../packs/selector.js';
import { PROMPTS, PROMPT_VERSION } from '../prompts/generated.js';
import type { Intent, Usage } from '../types.js';
import { CostRefusedError, type CostGuard } from './costGuard.js';
import { READERS, readerTimeoutMs, type ReaderDef, type ReaderId, type SliceContext } from './readers.js';
import { approxTokens, renderCore } from './slices.js';
import { CORE_TYPES } from './chartBundle.js';

const keepValid = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((xs) =>
      xs.flatMap((x) => {
        const r = item.safeParse(x);
        return r.success ? [r.data as z.infer<T>] : [];
      })
    );
const short = (n: number) => z.string().catch('').transform((t) => t.slice(0, n));
const strings = z.array(z.unknown()).catch([]).transform((xs) => xs.filter((x): x is string => typeof x === 'string'));

const readerClaimZ = claimZ.extend({
  about: z.enum(['self', 'mother', 'father', 'spouse', 'child', 'sibling', 'other']).catch('self'),
  topic: short(40),
  kind: z.enum(['bond', 'holds', 'blocks', 'gives', 'window', 'form', 'grace']).catch('gives'),
});
const readerWindowZ = windowZ.extend({
  action: z.enum(['hold', 'listen', 'act', 'do_not_pry', '']).catch(''),
  date_source: z.enum(['stored', 'interpolated', 'external']).catch('stored'),
});

export const readerFindingZ = z.object({
  verdict: z.enum(['strong', 'moderate', 'weak', 'denied', 'mixed']).catch('mixed'),
  layerScore: z.number().int().min(-3).max(3).catch(0),
  digest: short(400),
  claims: keepValid(readerClaimZ),
  windows: keepValid(readerWindowZ),
  quotes: keepValid(z.object({ id: z.string(), value: z.unknown() })),
  gaps: keepValid(z.object({ need: z.string(), why: z.string().catch('') })),
  disagree: short(300),
  actors: keepValid(z.object({ planet: z.string().catch(''), person: z.string().catch(''), can_do: strings, needs: strings, windows: strings })),
  graces: keepValid(z.object({ text: z.string(), evidence: strings })),
  pointers: keepValid(z.object({ text: z.string(), fit: z.number().int().min(1).max(3).catch(1), evidence: strings, alt: strings })),
  sensitive: short(200),
  form: short(200),
  culprits: strings,
  contributors: strings,
  caveats: strings,
});
export type ReaderOutput = z.infer<typeof readerFindingZ>;

const S = { type: 'STRING' };
const SA = { type: 'ARRAY', items: S };
/** Gemini response schema (uppercase types). Most fields stay optional so a short answer is still valid. */
export const READER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { ...S, enum: ['strong', 'moderate', 'weak', 'denied', 'mixed'] },
    layerScore: { type: 'INTEGER', minimum: -3, maximum: 3 },
    digest: S,
    claims: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: S,
          evidence: SA,
          polarity: { ...S, enum: ['supports', 'obstructs', 'neutral'] },
          weight: { type: 'INTEGER', minimum: 1, maximum: 3 },
          tradition: { ...S, enum: ['parashara', 'jaimini', 'nakshatra', 'tajaka', 'kuta', 'kp_starlord', 'prashna'] },
          about: { ...S, enum: ['self', 'mother', 'father', 'spouse', 'child', 'sibling', 'other'] },
          topic: S,
          kind: { ...S, enum: ['bond', 'holds', 'blocks', 'gives', 'window', 'form', 'grace'] },
        },
        required: ['text', 'evidence', 'polarity', 'weight', 'tradition', 'about', 'topic', 'kind'],
      },
    },
    windows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { from: S, to: S, label: S, polarity: { ...S, enum: ['favourable', 'testing', 'mixed'] }, evidence: SA, lord: S, cls: { ...S, enum: ['deliverer', 'supporter', 'neutral', 'obstructor'] }, fruit: S, action: { ...S, enum: ['hold', 'listen', 'act', 'do_not_pry', ''] }, date_source: { ...S, enum: ['stored', 'interpolated', 'external'] } },
        required: ['from', 'to', 'label', 'polarity', 'evidence', 'fruit'],
      },
    },
    quotes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: S, value: S }, required: ['id', 'value'] } },
    gaps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { need: S, why: S }, required: ['need'] } },
    disagree: S,
    actors: { type: 'ARRAY', items: { type: 'OBJECT', properties: { planet: S, person: S, can_do: SA, needs: SA, windows: SA } } },
    graces: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: S, evidence: SA }, required: ['text'] } },
    pointers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: S, fit: { type: 'INTEGER' }, evidence: SA, alt: SA }, required: ['text'] } },
    sensitive: S,
    form: S,
    culprits: SA,
    contributors: SA,
  },
  required: ['verdict', 'layerScore', 'digest', 'claims'],
};

export interface ReaderRequest {
  id: ReaderId;
  def: ReaderDef;
  subject: SubjectId;
  system: string;
  coreText: string;
  tablesText: string;
  /** curriculum and tail: what `prompt_sent` records. Never the chart tables. */
  promptSent: string;
  dataKeys: string[];
  /** the hash of everything this reader saw */
  dataHash: string;
  /** same key = same answer: core, tables, curriculum, model, and the question and date for readers that are sent them */
  cacheKey: string;
  sections: Record<string, unknown>;
  promptTokens: number;
  frameLine: string;
}

export interface ReaderResult {
  id: ReaderId;
  subject: SubjectId;
  finding: ReaderOutput;
  usage: Usage;
  repaired: boolean;
}

/** Everything before the model call. Pure, so prewarm and the reading agree on what a reader saw. */
export function buildReaderRequest(a: {
  id: ReaderId;
  subject: SubjectId;
  slice: SliceContext;
  intent: Intent;
  question: string;
  asOf: string;
  model: string;
  keyFrame?: Pick<EvidencePack['keyFrame'], 'lords'>;
  focus?: string;
  /** the Oracle's findings text, for the remedy reader only */
  findingsText?: string;
}): ReaderRequest {
  const def = READERS[a.id];
  const frame = FRAMES[a.subject];
  const system = PROMPTS['readers/_shared'] ?? '';
  const core = renderCore(a.slice.tables, CORE_TYPES);
  const tables = def.slice(a.slice);
  const tablesText = `TABLES: ${JSON.stringify(tables)}`;
  const person = a.slice.person ? `Person named: ${a.slice.person.person}, read through house ${a.slice.person.houses.join(' or ')} of the owner's chart.` : '';
  const frameLine = `Subject: ${frame?.label ?? a.subject}. Frame houses: ${a.slice.houses.join(', ')}. Frame lords: ${a.keyFrame?.lords.join(', ') || 'read them from benefic_malefic.house_lords'}. Karakas: ${frame?.karakas.join(', ') ?? ''}. Chara karakas: ${frame?.charaKarakas.join(', ') ?? ''}. Arudhas: ${frame?.arudhas.join(', ') ?? ''}. ${person}`.trim();
  const clarified = a.intent.clarified;
  const tailParts = [
    PROMPTS[def.promptKey] ?? '',
    frameLine,
    ...(def.natal ? [] : [`TODAY: ${a.asOf}`, `HORIZON: ${a.slice.from} to ${a.slice.to}`]),
    ...(def.natal ? [] : clarified?.realWant ? [`WHAT THEY REALLY WANT TO KNOW: ${clarified.realWant.line}`] : []),
    ...(a.focus ? [`FOCUS ONLY ON THIS PART, WHICH THE ANSWER MISSED: ${a.focus}`] : []),
    ...(a.findingsText ? [a.findingsText] : []),
    ...(def.natal ? [] : [`QUESTION: ${a.question}`]),
  ];
  const promptSent = tailParts.join('\n');
  const dataHash = hashText(`${core.text}\n${tablesText}`);
  return {
    id: a.id,
    def,
    subject: a.subject,
    system,
    coreText: core.text,
    tablesText,
    promptSent,
    dataKeys: [...Object.keys(core.sections), ...Object.keys(tables)],
    dataHash,
    cacheKey: hashText([a.model, PROMPT_VERSION, a.id, dataHash, promptSent].join('|')),
    sections: { ...core.sections, ...tables },
    promptTokens: approxTokens(system) + approxTokens(core.text) + approxTokens(tablesText) + approxTokens(promptSent),
    frameLine,
  };
}

export class ReaderFailure extends Error {
  constructor(
    message: string,
    readonly reason: SpecialistFailureReason | 'budget',
    readonly usage: Usage | null
  ) {
    super(message);
    this.name = 'ReaderFailure';
  }
}

/** Calls the model once. Throws ReaderFailure with the reason, and the bill when there is one. */
export async function runReader(req: ReaderRequest, a: { model: string; guard: CostGuard; cacheOwner?: CacheOwner; signal?: AbortSignal; timeoutMs?: number; maxOutputTokens?: number }): Promise<ReaderResult> {
  const def = req.def;
  let reservation;
  try {
    reservation = a.guard.reserve({ stage: 'fanout', node: req.id, model: a.model, promptTokens: req.promptTokens, maxOutputTokens: a.maxOutputTokens ?? def.maxOutputTokens });
  } catch (err) {
    if (err instanceof CostRefusedError) throw new ReaderFailure(err.message, 'budget', null);
    throw err;
  }
  const t0 = Date.now();
  let r;
  try {
    r = await callGemini({
      model: a.model,
      node: req.id,
      system: req.system,
      parts: [req.coreText, req.tablesText, req.promptSent],
      responseSchema: READER_RESPONSE_SCHEMA,
      cachePrefix: true,
      cacheOwner: a.cacheOwner,
      thinking: 'off',
      maxOutputTokens: reservation.maxOutputTokens,
      temperature: 0.2,
      timeoutMs: a.timeoutMs ?? readerTimeoutMs(def, a.model),
      signal: a.signal,
    });
  } catch (err) {
    // an HTTP error was not billed; a time-out may have been, so the guard keeps what it reserved
    if (err instanceof GeminiHttpError) a.guard.settle(reservation, null);
    else a.guard.settleUnknown(reservation);
    throw new ReaderFailure((err as Error).message.slice(0, 200), failureReason(err), null);
  }
  a.guard.settle(reservation, r.usage);
  const fail = (reason: SpecialistFailureReason, why: string): never => {
    throw new ReaderFailure(`${req.id}: ${why} (${r.finishReason ?? 'no finish reason'})`, reason, r.usage);
  };
  if (!r.text.trim()) fail('model_error', 'no text');
  const loose = parseFindingText(r.text);
  if (!loose) return fail('parse', 'unparsable JSON');
  const parsed = readerFindingZ.safeParse(loose.value);
  if (!parsed.success) return fail('schema', 'wrong shape');
  const finding = parsed.data;
  if (loose.repaired && finding.claims.length === 0) fail('parse', 'cut off with no whole claim');
  if (loose.repaired) finding.caveats = [...finding.caveats, TRUNCATED_CAVEAT];
  void (Date.now() - t0);
  return { id: req.id, subject: req.subject, finding, usage: r.usage, repaired: loose.repaired };
}

/** The same finding in the shape reconcile reads, for the readers that feed a convergence layer. */
export function toLayerFinding(r: Pick<ReaderResult, 'id' | 'subject' | 'finding'>): Finding | null {
  const analyst = READERS[r.id].layer;
  if (!analyst) return null;
  const f = r.finding;
  return { analyst, subject: r.subject, verdict: f.verdict, layerScore: f.layerScore, status: 'ok', claims: f.claims, windows: f.windows, caveats: f.caveats, keyFacts: [], form: f.form, culprits: f.culprits, contributors: f.contributors };
}
