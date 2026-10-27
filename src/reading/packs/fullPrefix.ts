/**
 * The `full` explicit-cache layout (READING_EXPLICIT_CACHE=1 + READING_CACHE_LAYOUT=full; docs/reading-engine/24).
 *
 * One cached prefix per (user, model, day):
 *   system      persona + method (unchanged, same bytes for everyone)
 *   contents    ROLE LIBRARY (every reader's instructions, the shared output rules, the writer, the answer templates and
 *               formats) + EVIDENCE AS OF <date> + the user's whole evidence: base, every house, every divisional chart,
 *               arudhas and special lagnas, every antardasha of the life, the periods and transits of the 36 months from
 *               that date (a full-scope pack, packs/selector.ts `fullScope`).
 * Each call then sends only a short suffix: `ROLE: <id>`, the subject FRAME, the question and EXTRA EVIDENCE, which is
 * the part of the call's own pack that the cached evidence does not already hold (a transit at an asked date, the
 * prashna chart, the year chart, periods outside the cached 36 months, rows clipped to a shorter horizon).
 *
 * Byte stability: nothing here reads the clock, the question or the subject; the prefix depends only on the dossier, the
 * day's transit chart, the date, the prompt files and the findings-contract switch. The date is in the text, so the
 * cache key rolls over each day and the transit block stays correct.
 *
 * Grounding: the evidence a reader sees is (cached evidence) overlaid with (its own pack). `withFullEvidence` builds the
 * same overlay for the grounding gate, so every id a reader can see resolves, and every id of the old subject pack
 * still resolves at the same path.
 *
 * Pure: no I/O and no astrology. Cache creation lives in llm/promptCache.ts (`ensurePromptCache`).
 */
import { readingCacheLayout, readingFindingsV2 } from '../config.js';
import { explicitCacheEnabled } from '../llm/promptCache.js';
import { PROMPTS } from '../prompts/generated.js';
import type { Dossier } from '../facts/types.js';
import type { TransitChart } from '../transits/types.js';
import type { Intent } from '../types.js';
import { FRAMES, type SubjectId } from './frames.js';
import { ANALYST_SECTIONS, buildEvidencePack, hashText, type Analyst, type EvidencePack, type PackSection } from './selector.js';

/** True when calls should use the full layout: the explicit cache is on and READING_CACHE_LAYOUT=full. */
export function fullCacheLayoutActive(): boolean {
  return explicitCacheEnabled() && readingCacheLayout() === 'full';
}

/** Roles a call can name. Readers are the specialist analysts; `writer` writes from findings; `single` answers in one call. */
export type CacheRole = Exclude<Analyst, 'single'> | 'writer' | 'single';
export const READER_ROLES = ['promise', 'dasha', 'transit', 'nakshatra', 'annual', 'prashna'] as const;

/**
 * The window of the cached evidence: periods and transits of the 36 months from the evidence date, the longest closed
 * horizon (3y, and `life` timing). A shorter question adds only the rows its horizon clips (EXTRA EVIDENCE).
 */
export const FULL_HORIZON = '3y' as const;
/** Sections held in the cached evidence. `frame` is per question; `transit_at`, `annual`, `prashna` are per-question data. */
export const CACHED_SECTIONS: PackSection[] = ['base', 'detail', 'varga', 'arudha', 'dasha', 'transits'];

/** Same estimate the pack uses (characters / 3.6). */
export const approxTokens = (s: string): number => Math.ceil(s.length / 3.6);

export interface FullContext {
  asOf: string;
  /** the system instruction stored in the cache (persona + method) */
  system: string;
  /** the cached user part: role library + evidence */
  prefix: string;
  /** the cached evidence, by section (for EXTRA EVIDENCE and grounding) */
  evidence: Partial<Record<PackSection, unknown>>;
  /** sha-256 prefix of system + prefix (logs only) */
  hash: string;
  approxTokens: number;
}

// ---------------------------------------------------------------- role library (in the cached prefix)

const READS: Record<Exclude<CacheRole, 'writer'>, string> = {
  promise: 'base, detail, varga, arudha',
  dasha: 'base, detail, varga, dasha',
  transit: 'base, arudha, dasha, transits, and transit_at when the call gives it',
  nakshatra: 'base, detail, dasha, transits',
  annual: 'base and the annual section the call gives',
  prashna: 'base and the prashna section the call gives',
  single: 'every EVIDENCE section and any EXTRA EVIDENCE',
};

function readerRules(v2: boolean): string {
  if (v2) {
    return [
      'READER OUTPUT RULES (every reader role)',
      '- Claims: promise, dasha, transit and nakshatra give 6 to 10; annual and prashna give 3 to 6. Each claim is one sentence of at most 200 characters about this chart, begins with the planet or house it is about, and lists 1-4 evidence ids copied exactly as dot paths (for example detail.houses.10.lord, base.bodies.Sa.star_lord, dasha.periods.Sa-Ke-Ve_2026-08-22.from, frame.running.md).',
      '- At most 12 windows; every window has fruit (one sentence of at most 140 characters).',
      '- weight is 1, 2 or 3 (3 = decides the verdict on its own). polarity is supports, obstructs or neutral. tradition is prashna for the prashna role; otherwise parashara, jaimini, nakshatra or kp_starlord.',
      '- layerScore is one integer from -3 (clearly denied or obstructed) to +3 (clearly promised or supported); 0 when balanced.',
      '- Dates only as they appear in the evidence (YYYY-MM-DD). Never compute a house, lord, aspect, dignity, date or strength; read the field. If a field you need is absent, add a caveat naming it and go on.',
      '- culprits and contributors are planet codes (Su Mo Ma Me Ju Ve Sa Ra Ke) that appear in the evidence, at most 4 each, strongest first. A planet appears in only one list. form is one sentence (promise role only; others leave it empty).',
      '- Keep the JSON complete: shorter claims are better than a cut-off answer.',
    ].join('\n');
  }
  return [
    'READER OUTPUT RULES (every reader role)',
    '- Return at most 8 claims (annual and prashna: at most 6) and at most 12 windows. Each claim is one sentence of at most 200 characters about this chart and lists 1-4 evidence ids copied exactly as dot paths (for example detail.houses.10.lord). Each claim weight is 1, 2 or 3. Dates must come from the evidence. Keep the JSON complete: shorter claims are better than a cut-off answer.',
    '- Tag every claim with the tradition whose rule you applied (parashara, jaimini, nakshatra, kp_starlord; prashna for the prashna role). Give layerScore: your layer as one signed strength from -3 (clearly denied or obstructed) to +3 (clearly promised or supported), 0 when balanced.',
  ].join('\n');
}

const templateOrder = (k: string): number => Number(k.replace(/^templates\/T/, ''));

/** Every role's instructions and every answer shape, in a fixed order. Same bytes for every user. */
export function roleLibrary(v2: boolean = readingFindingsV2()): string {
  const prompt = (id: string): string => (v2 ? PROMPTS[`v2/${id}`] : undefined) ?? PROMPTS[id] ?? '';
  const out: string[] = [
    'ROLE LIBRARY',
    'Every request begins with `ROLE: <id>`. Follow the block for that role only, together with the method in the system instruction.',
    'The request also gives the FRAME (subject, frame houses, lords, karakas, horizon, running period) and the QUESTION, and may give EXTRA EVIDENCE: data for this question only, keyed like EVIDENCE. Where EXTRA EVIDENCE has a path that EVIDENCE also has, EXTRA EVIDENCE is the value to use.',
    'EVIDENCE below holds the whole chart: every house, every divisional chart, every antardasha of the life, and the periods and transits of the 36 months from EVIDENCE AS OF. Read only the sections your role lists, and inside them only what concerns the FRAME: its houses, its lords and karakas, the planets the question names, and the horizon. Ignore periods and transit rows outside the horizon.',
    'Evidence ids are dot paths into EVIDENCE, EXTRA EVIDENCE or FRAME (FRAME paths begin with frame.), copied exactly.',
  ];
  for (const role of READER_ROLES) {
    out.push(`=== ROLE: ${role} ===`, `Reads: ${READS[role]}; and the FRAME.`, prompt(role));
  }
  out.push(readerRules(v2));
  out.push('=== ROLE: writer ===', 'Reads: the SPECIALIST FINDINGS and the calendar in the request; EVIDENCE only to check a fact a finding names. Write in the ANSWER SHAPE the request names.', prompt('synth'));
  out.push('=== ROLE: single ===', `Reads: ${READS.single}, for the FRAME of each subject. Answer the question directly from the evidence in the ANSWER SHAPE the request names.`);
  out.push('=== ANSWER SHAPES ===', PROMPTS['templates/_rules'] ?? '');
  const templates = Object.keys(PROMPTS).filter((k) => /^templates\/T\d+$/.test(k)).sort((a, b) => templateOrder(a) - templateOrder(b));
  for (const k of templates) out.push(PROMPTS[k]!);
  for (const k of Object.keys(PROMPTS).filter((x) => x.startsWith('formats/')).sort()) out.push(PROMPTS[k]!);
  return out.join('\n\n');
}

// ---------------------------------------------------------------- the cached prefix

export interface FullContextInput {
  dossier: Dossier;
  transits: TransitChart | null;
  asOf: string;
  system: string;
}

const memo = new Map<string, FullContext>();
const MEMO_MAX = 200;

/** Test seam. */
export function clearFullContexts(): void {
  memo.clear();
}

/**
 * The full prefix for one user and day. `memoKey` (dossier hash, transit snapshot …) lets a warm instance reuse the text
 * instead of rebuilding it per question; the text itself never depends on the key.
 */
export function buildFullContext(input: FullContextInput, memoKey?: string | null): FullContext {
  const v2 = readingFindingsV2();
  const key = memoKey ? `${memoKey}|${input.asOf}|${v2 ? 2 : 1}|${hashText(input.system)}|${process.env.READING_FULL_BASE ?? ''}` : null;
  const hit = key ? memo.get(key) : undefined;
  if (hit) return hit;
  const pack = buildEvidencePack({
    dossier: input.dossier,
    transits: input.transits,
    subject: 'general_life_direction',
    asOf: input.asOf,
    intent: { horizon: FULL_HORIZON, mentionsPlanets: [], focusPoints: [] },
    fullScope: true,
  });
  const evidence: Partial<Record<PackSection, unknown>> = {};
  for (const sec of CACHED_SECTIONS) if (pack.sections[sec] !== undefined) evidence[sec] = pack.sections[sec];
  const prefix = [roleLibrary(v2), `EVIDENCE AS OF: ${input.asOf}`, `EVIDENCE:\n${JSON.stringify(evidence)}`].join('\n\n');
  const ctx: FullContext = {
    asOf: input.asOf,
    system: input.system,
    prefix,
    evidence,
    hash: hashText(`${input.system}\n${prefix}`),
    approxTokens: approxTokens(input.system) + approxTokens(prefix),
  };
  if (key) {
    if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
    memo.set(key, ctx);
  }
  return ctx;
}

/** The day's full context for loaded reading data (memoised on the dossier hash and transit snapshot). */
export function fullContextFor(data: { dossier: Dossier; transits: TransitChart | null; dossierHash?: string | null; transitSnapshotId?: string | null }, asOf: string, system: string): FullContext {
  return buildFullContext({ dossier: data.dossier, transits: data.transits, asOf, system }, data.dossierHash ? `${data.dossierHash}|${data.transitSnapshotId ?? ''}` : null);
}

// ---------------------------------------------------------------- what a call adds (EXTRA EVIDENCE) and grounding

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The part of `sub` that `full` does not already hold: objects compared key by key, arrays covered when every item
 * appears in the cached array, leaves compared by value. Undefined when nothing is missing.
 */
export function deltaOf(full: unknown, sub: unknown): unknown {
  if (sub === undefined) return undefined;
  if (isObj(sub) && isObj(full)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sub)) {
      const d = deltaOf(full[k], v);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (Array.isArray(sub) && Array.isArray(full)) {
    const have = new Set(full.map((x) => JSON.stringify(x)));
    return sub.every((x) => have.has(JSON.stringify(x))) ? undefined : sub;
  }
  return JSON.stringify(sub) === JSON.stringify(full) ? undefined : sub;
}

/** `over` laid on `base`: objects merged key by key, anything else from `over`. */
export function overlay(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (isObj(base) && isObj(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = overlay(base[k], v);
    return out;
  }
  return over;
}

/** EXTRA EVIDENCE for one role: the role's sections (not base or frame) minus what the cache holds. */
export function extraEvidence(full: FullContext, pack: EvidencePack, role: Exclude<CacheRole, 'writer'>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sec of ANALYST_SECTIONS[role]) {
    if (sec === 'base' || sec === 'frame') continue;
    const d = deltaOf(full.evidence[sec], pack.sections[sec]);
    if (d !== undefined) out[sec] = d;
  }
  return out;
}

/** The pack the grounding gate checks a reader's ids against: cached evidence overlaid with the reader's own pack. */
export function withFullEvidence(pack: EvidencePack, full: FullContext | undefined): EvidencePack {
  if (!full) return pack;
  return { ...pack, sections: overlay(full.evidence, pack.sections) as EvidencePack['sections'] };
}

// ---------------------------------------------------------------- suffixes (what each call sends)

const horizonText = (h: Intent['horizon']): string => (typeof h === 'string' ? h : `${h.from} to ${h.to}`);

/** A reader's whole uncached input. */
export function readerSuffix(a: { role: (typeof READER_ROLES)[number]; subject: SubjectId; pack: EvidencePack; intent: Intent; question: string; asOf: string; full: FullContext }): string {
  const kf = a.pack.keyFrame;
  const extra = extraEvidence(a.full, a.pack, a.role);
  return [
    `ROLE: ${a.role}`,
    `TODAY: ${a.asOf}`,
    `Subject: ${a.subject} (${FRAMES[a.subject]?.label ?? a.subject}). Frame houses: ${kf.houses.join(', ')}. Frame lords: ${kf.lords.join(', ')}. Karakas: ${kf.karakas.join(', ')}. Horizon: ${horizonText(a.intent.horizon)}. Focus: ${a.intent.focusPoints.join('; ') || 'none'}.`,
    `FRAME: ${JSON.stringify({ frame: a.pack.sections.frame })}`,
    ...(Object.keys(extra).length ? [`EXTRA EVIDENCE: ${JSON.stringify(extra)}`] : []),
    `QUESTION: ${a.question}`,
  ].join('\n');
}

/** The single-call writer's uncached input: each subject's frame and extra evidence, the calendar, then the tail. */
export function singleSuffix(a: { packs: EvidencePack[]; full: FullContext; calendar: string; tail: string }): string {
  const frames: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  for (const p of a.packs) {
    frames[p.subject] = p.sections.frame;
    const x = extraEvidence(a.full, p, 'single');
    if (Object.keys(x).length) extra[p.subject] = x;
  }
  return [
    'ROLE: single',
    `FRAME (by subject): ${JSON.stringify(frames)}`,
    ...(Object.keys(extra).length ? [`EXTRA EVIDENCE (by subject): ${JSON.stringify(extra)}`] : []),
    ...(a.calendar ? [a.calendar] : []),
    a.tail,
  ].join('\n\n');
}

/** The graph writer's uncached input. */
export function writerSuffix(a: { findings: string; calendar: string; tail: string }): string {
  return ['ROLE: writer', a.findings, ...(a.calendar ? [a.calendar] : []), a.tail].join('\n\n');
}

/** The answer shape named by reference (its text is in the cached ANSWER SHAPES). */
export function answerShapeRef(intent: Intent): string {
  const template = intent.classification?.template;
  if (template && PROMPTS[`templates/${template}`]) return `ANSWER SHAPE: ${PROMPTS[`templates/${template}`]!.split('\n')[0]} Follow that block in ANSWER SHAPES and the rules for every template.`;
  return `ANSWER SHAPE: Format \`${intent.format}\`, as given in ANSWER SHAPES.`;
}
