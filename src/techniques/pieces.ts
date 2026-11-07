/**
 * Technique pieces (docs/reading-engine/56): a technique is built from standard, reusable parts, and this module names
 * them from the catalogue so they can be counted, drawn and cached. Nothing here reads a chart; it reads the catalogue.
 *
 * - A **reader** piece is a digest section read in a named table layout (`house` as `house_card`). The filter a technique
 *   applies (which houses, which vargas, which years) is a parameter of the piece, not a new piece.
 * - A **prompt** piece is a system prompt file (code techniques have none).
 * - An **output** piece is the schema or type a technique returns (findings.v2, area_board.v1 …).
 * - An **agent** piece is an agent_registry row that runs it.
 *
 * Techniques with the same pieces (readers, prompt, output, agents) form a **family**: one tested recipe run over
 * different filters or scenarios.
 *
 * Each technique also has a **freshness**: how long its output stays true for one kundli, from the most changeable
 * section it reads (the natal digest never changes for a digest version; dasha rows hold until the running period ends;
 * the year chart until the year turns; panchang until the day ends; transit per short window), and a **scope**: 'kundli'
 * when the output is the same for every question, 'question' when it depends on the question text. `validityWindow`
 * turns the freshness into a date range and `techniqueCacheKey` into a key that is stable over that range, so a stored
 * output can be read back and the agent skipped until the range ends.
 */
import { createHash } from 'node:crypto';
import {
  getTechniqueAnnualFallbackDays,
  getTechniqueCacheVersion,
  getTechniqueDashaFallbackDays,
  getTechniqueTransitWindowHours,
} from '../config/env.js';
import type { TechniqueBoard, TechniqueDef } from './catalog.js';
import { TECHNIQUES } from './catalog.js';
import type { TechniqueCategory } from './categories.js';
import type { ContractSection } from './contracts.js';

export type PieceKind = 'reader' | 'prompt' | 'output' | 'agent';
export const PIECE_KINDS: readonly PieceKind[] = ['reader', 'prompt', 'output', 'agent'];
export type PieceId = string;

/** Longest-lived first. */
export type Freshness = 'natal' | 'annual' | 'dasha' | 'daily' | 'transit' | 'question';
export const FRESHNESS_ORDER: readonly Freshness[] = ['natal', 'annual', 'dasha', 'daily', 'transit', 'question'];

export type ReuseScope = 'kundli' | 'question';

/**
 * How long a section's rows stay true for one kundli. `findings` is resolved from the techniques that feed the
 * synthesizer (`findingsFreshness`); `text` is the user turn and makes the scope 'question' without shortening the
 * data freshness.
 */
export const SECTION_FRESHNESS: Record<Exclude<ContractSection, 'findings' | 'text'>, Freshness> = {
  house: 'natal',
  planet: 'natal',
  yoga: 'natal',
  point: 'natal',
  star: 'natal',
  annual: 'annual',
  activation: 'dasha',
  panchang: 'daily',
  transit: 'transit',
  prashna: 'question',
};

/** User-turn fields that carry the question or its thread: an output that reads one is per question. */
export const QUESTION_FIELDS: readonly string[] = ['QUESTION', 'REAL_WANT', 'HISTORY', 'CLARIFY_TURNS', 'ANSWER', 'SLOTS', 'BUCKET', 'TEMPLATE'];

export interface PieceUse {
  techniqueId: string;
  /** reader pieces: the filter this technique applies */
  filter?: string;
}

export interface Piece {
  /** `<kind>:<name>`, e.g. reader:house/house_card, prompt:src/reading/prompts/v2/dasha.md, output:findings.v2, agent:area.self_board */
  id: string;
  kind: PieceKind;
  /** the section, prompt path, schema or agent id */
  name: string;
  /** reader pieces only */
  section?: ContractSection;
  layout?: string;
  freshness?: Freshness;
  /** technique ids, catalogue order, once each */
  usedBy: string[];
  categories: TechniqueCategory[];
  boards: TechniqueBoard[];
  /** reader pieces: the distinct filters applied, each with the techniques that apply it */
  variants?: Array<{ filter: string; usedBy: string[] }>;
}

export interface ReaderUse {
  piece: string;
  section: ContractSection;
  layout: string;
  filter: string;
}

export interface TechniqueRecipe {
  id: string;
  title: string;
  category: TechniqueCategory;
  board: TechniqueBoard;
  status: TechniqueDef['status'];
  readers: ReaderUse[];
  /** prompt piece id, or null for a code technique */
  prompt: string | null;
  output: string;
  agents: string[];
  synthesizer: string | null;
  /** techniques whose synthesizer is this one */
  feeds: string[];
  freshness: Freshness;
  scope: ReuseScope;
  /** the family signature (same readers, prompt, output, agents) */
  family: string;
}

export interface RecipeFamily {
  signature: string;
  /** a short label: the shared id prefix, or the first member */
  label: string;
  members: string[];
  readers: string[];
  prompt: string | null;
  output: string;
  agents: string[];
  categories: TechniqueCategory[];
  freshness: Freshness;
}

const uniq = <T>(xs: Iterable<T>): T[] => [...new Set(xs)];

export const readerPieceId = (section: string, layout: string): string => `reader:${section}/${layout}`;
export const promptPieceId = (system: string): string | null => (system && system !== 'none' ? `prompt:${system}` : null);
export const outputPieceId = (output: string): string => `output:${output}`;
export const agentPieceId = (agent: string): string => `agent:${agent}`;

/** The shorter-lived of two freshness values. */
export function shorter(a: Freshness, b: Freshness): Freshness {
  return FRESHNESS_ORDER.indexOf(a) >= FRESHNESS_ORDER.indexOf(b) ? a : b;
}

function byId(techniques: readonly TechniqueDef[]): Map<string, TechniqueDef> {
  return new Map(techniques.map((t) => [t.id, t]));
}

/**
 * The data freshness of a technique: the shortest-lived section it reads. A `findings` input takes the shortest of the
 * techniques that name this one as synthesizer ('question' when none do). Cycles resolve to 'question'.
 */
export function techniqueFreshness(t: TechniqueDef, techniques: readonly TechniqueDef[] = TECHNIQUES, seen: Set<string> = new Set()): Freshness {
  if (seen.has(t.id)) return 'question';
  const visiting = new Set(seen).add(t.id);
  let f: Freshness = 'natal';
  for (const inp of t.contract.inputs) {
    if (inp.section === 'text') continue;
    if (inp.section === 'findings') {
      const upstream = techniques.filter((x) => x.contract.synthesizer === t.id);
      if (upstream.length === 0) f = shorter(f, 'question');
      for (const u of upstream) f = shorter(f, techniqueFreshness(u, techniques, visiting));
      continue;
    }
    f = shorter(f, SECTION_FRESHNESS[inp.section] ?? 'question');
  }
  return f;
}

/** 'question' when the output depends on the question (a question field in the user turn, a text or prashna input). */
export function techniqueScope(t: TechniqueDef): ReuseScope {
  if (t.contract.user.some((u) => QUESTION_FIELDS.includes(u))) return 'question';
  if (t.contract.inputs.some((i) => i.section === 'text' || i.section === 'prashna')) return 'question';
  return 'kundli';
}

/** The family signature: readers (without their filters), prompt, output and agents, each sorted. */
export function familySignature(t: TechniqueDef): string {
  const readers = uniq(t.contract.inputs.map((i) => readerPieceId(i.section, i.layout))).sort();
  const agents = [...t.agents].sort();
  return JSON.stringify([readers, promptPieceId(t.contract.system), t.contract.output, agents]);
}

export function recipeOf(t: TechniqueDef, techniques: readonly TechniqueDef[] = TECHNIQUES): TechniqueRecipe {
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    board: t.board,
    status: t.status,
    readers: t.contract.inputs.map((i) => ({ piece: readerPieceId(i.section, i.layout), section: i.section, layout: i.layout, filter: i.filter })),
    prompt: promptPieceId(t.contract.system),
    output: outputPieceId(t.contract.output),
    agents: t.agents.map(agentPieceId),
    synthesizer: t.contract.synthesizer ?? null,
    feeds: techniques.filter((x) => x.contract.synthesizer === t.id).map((x) => x.id),
    freshness: techniqueFreshness(t, techniques),
    scope: techniqueScope(t),
    family: familySignature(t),
  };
}

export function recipes(techniques: readonly TechniqueDef[] = TECHNIQUES): TechniqueRecipe[] {
  return techniques.map((t) => recipeOf(t, techniques));
}

/** Every piece the catalogue uses, with the techniques that use it. Order: readers, prompts, outputs, agents; most used first. */
export function pieces(techniques: readonly TechniqueDef[] = TECHNIQUES): Piece[] {
  const map = new Map<string, Piece>();
  const touch = (id: string, kind: PieceKind, name: string, t: TechniqueDef, extra: Partial<Piece> = {}): Piece => {
    let p = map.get(id);
    if (!p) {
      p = { id, kind, name, usedBy: [], categories: [], boards: [], ...extra };
      map.set(id, p);
    }
    if (!p.usedBy.includes(t.id)) p.usedBy.push(t.id);
    if (!p.categories.includes(t.category)) p.categories.push(t.category);
    if (!p.boards.includes(t.board)) p.boards.push(t.board);
    return p;
  };
  for (const t of techniques) {
    for (const i of t.contract.inputs) {
      const freshness = i.section === 'text' || i.section === 'findings' ? 'question' : SECTION_FRESHNESS[i.section];
      const p = touch(readerPieceId(i.section, i.layout), 'reader', `${i.section}/${i.layout}`, t, { section: i.section, layout: i.layout, freshness, variants: [] });
      const v = p.variants!.find((x) => x.filter === i.filter);
      if (v) {
        if (!v.usedBy.includes(t.id)) v.usedBy.push(t.id);
      } else p.variants!.push({ filter: i.filter, usedBy: [t.id] });
    }
    const prompt = promptPieceId(t.contract.system);
    if (prompt) touch(prompt, 'prompt', t.contract.system, t);
    touch(outputPieceId(t.contract.output), 'output', t.contract.output, t);
    for (const a of t.agents) touch(agentPieceId(a), 'agent', a, t);
  }
  return [...map.values()].sort((a, b) => PIECE_KINDS.indexOf(a.kind) - PIECE_KINDS.indexOf(b.kind) || b.usedBy.length - a.usedBy.length || a.id.localeCompare(b.id));
}

function commonPrefix(ids: string[]): string {
  if (ids.length === 0) return '';
  const parts = ids.map((id) => id.split('.'));
  const out: string[] = [];
  for (let i = 0; i < parts[0].length; i++) {
    const seg = parts[0][i];
    if (parts.every((p) => p[i] === seg)) out.push(seg);
    else break;
  }
  return out.join('.');
}

/** Techniques grouped by identical recipe, largest family first. */
export function families(techniques: readonly TechniqueDef[] = TECHNIQUES): RecipeFamily[] {
  const groups = new Map<string, TechniqueDef[]>();
  for (const t of techniques) {
    const sig = familySignature(t);
    groups.set(sig, [...(groups.get(sig) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([signature, members]) => {
      const first = members[0];
      const ids = members.map((m) => m.id);
      const prefix = commonPrefix(ids);
      const label = members.length === 1 ? first.id : `${prefix || first.id.split('.')[0]}.* (${members.length})`;
      return {
        signature,
        label,
        members: ids,
        readers: uniq(first.contract.inputs.map((i) => readerPieceId(i.section, i.layout))).sort(),
        prompt: promptPieceId(first.contract.system),
        output: outputPieceId(first.contract.output),
        agents: [...first.agents].sort().map(agentPieceId),
        categories: uniq(members.map((m) => m.category)),
        freshness: members.map((m) => techniqueFreshness(m, techniques)).reduce(shorter, 'natal' as Freshness),
      };
    })
    .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label));
}

export interface ReuseReport {
  techniques: number;
  pieces: number;
  byKind: Record<PieceKind, { total: number; shared: number }>;
  /** pieces used by two or more techniques */
  shared: number;
  /** pieces used by exactly one technique: candidates to merge into a shared piece */
  singleUse: string[];
  families: number;
  /** techniques that share their recipe with at least one other technique */
  inFamilies: number;
  /** reader pieces with many distinct filters: candidates for a standard filter vocabulary */
  filterSprawl: Array<{ piece: string; variants: number }>;
  freshness: Record<Freshness, number>;
  scope: Record<ReuseScope, number>;
}

export function reuseReport(techniques: readonly TechniqueDef[] = TECHNIQUES): ReuseReport {
  const ps = pieces(techniques);
  const fams = families(techniques);
  const byKind = Object.fromEntries(PIECE_KINDS.map((k) => [k, { total: 0, shared: 0 }])) as ReuseReport['byKind'];
  for (const p of ps) {
    byKind[p.kind].total++;
    if (p.usedBy.length > 1) byKind[p.kind].shared++;
  }
  const freshness = Object.fromEntries(FRESHNESS_ORDER.map((f) => [f, 0])) as Record<Freshness, number>;
  const scope: Record<ReuseScope, number> = { kundli: 0, question: 0 };
  for (const t of techniques) {
    freshness[techniqueFreshness(t, techniques)]++;
    scope[techniqueScope(t)]++;
  }
  return {
    techniques: techniques.length,
    pieces: ps.length,
    byKind,
    shared: ps.filter((p) => p.usedBy.length > 1).length,
    singleUse: ps.filter((p) => p.usedBy.length === 1).map((p) => p.id),
    families: fams.length,
    inFamilies: fams.filter((f) => f.members.length > 1).reduce((n, f) => n + f.members.length, 0),
    filterSprawl: ps
      .filter((p) => p.kind === 'reader' && (p.variants?.length ?? 0) > 1)
      .map((p) => ({ piece: p.id, variants: p.variants!.length }))
      .sort((a, b) => b.variants - a.variants || a.piece.localeCompare(b.piece)),
    freshness,
    scope,
  };
}

// ---------------------------------------------------------------- validity windows and cache keys

/** A stored date range, [from, to). */
export interface DateSpan {
  from: Date;
  to: Date;
}

export interface ValidityContext {
  now: Date;
  /** Optional kundli identifier when passed alongside validity context. */
  kundliId?: string;
  /** Optional digest version when passed alongside validity context. */
  digestVersion?: string | number;
  /** the shortest running dasha period the technique reads (kundli_activation from_date/to_date); fallback when absent */
  runningPeriod?: DateSpan | null;
  /** the running year chart (Tithi Pravesha to the next); fallback when absent */
  year?: DateSpan | null;
  /** the local day at the place the panchang is read for; the UTC day when absent */
  day?: DateSpan | null;
}

export interface ValidityConfig {
  transitWindowHours: number;
  dashaFallbackDays: number;
  annualFallbackDays: number;
}

export function validityConfig(): ValidityConfig {
  return {
    transitWindowHours: getTechniqueTransitWindowHours(),
    dashaFallbackDays: getTechniqueDashaFallbackDays(),
    annualFallbackDays: getTechniqueAnnualFallbackDays(),
  };
}

export interface ValidityWindow {
  freshness: Freshness;
  scope: ReuseScope;
  /** start of the window the output belongs to */
  from: Date;
  /** end (exclusive); null = until the digest version or the contract changes; equal to `from` = not reusable */
  to: Date | null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The epoch-aligned bucket of `size` ms that holds `now`: stable for every caller inside it. */
export function bucket(now: Date, size: number): { from: Date; to: Date } {
  const start = Math.floor(now.getTime() / size) * size;
  return { from: new Date(start), to: new Date(start + size) };
}

/** The context span when it is valid and holds `now` (so the key is the same for its whole length), else the fallback bucket. */
function spanOr(now: Date, span: DateSpan | null | undefined, fallbackMs: number): { from: Date; to: Date } {
  if (span && !Number.isNaN(span.from.getTime()) && !Number.isNaN(span.to.getTime()) && span.from.getTime() <= now.getTime() && now.getTime() < span.to.getTime()) {
    return { from: span.from, to: span.to };
  }
  return bucket(now, fallbackMs);
}

/**
 * The date range over which a technique's output for one kundli is unchanged. Natal: open-ended (the digest version and
 * the contract are in the key). Annual and dasha: until the running year chart or period ends, or an epoch-aligned
 * fallback window. Daily: until the day ends. Transit: the epoch-aligned transit window. Question: not reusable.
 */
export function validityWindow(t: TechniqueDef, ctx: ValidityContext, cfg: ValidityConfig = validityConfig(), techniques: readonly TechniqueDef[] = TECHNIQUES): ValidityWindow {
  const freshness = techniqueFreshness(t, techniques);
  const scope = techniqueScope(t);
  const now = ctx.now;
  switch (freshness) {
    case 'natal':
      return { freshness, scope, from: new Date(0), to: null };
    case 'annual':
      return { freshness, scope, ...spanOr(now, ctx.year, cfg.annualFallbackDays * DAY) };
    case 'dasha':
      return { freshness, scope, ...spanOr(now, ctx.runningPeriod, cfg.dashaFallbackDays * DAY) };
    case 'daily':
      return { freshness, scope, ...spanOr(now, ctx.day, DAY) };
    case 'transit':
      return { freshness, scope, ...bucket(now, cfg.transitWindowHours * HOUR) };
    case 'question':
    default:
      return { freshness: 'question', scope, from: now, to: now };
  }
}

/** True when a stored output's window still covers `now`. */
export function windowCovers(w: Pick<ValidityWindow, 'from' | 'to'>, now: Date): boolean {
  if (w.to === null) return now.getTime() >= w.from.getTime();
  if (w.to.getTime() <= w.from.getTime()) return false;
  return now.getTime() >= w.from.getTime() && now.getTime() < w.to.getTime();
}

/** JSON with sorted object keys, so equal values hash equally. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

/** A hash of what the technique is: its contract and its algorithm steps. Changes when either changes. */
export function contractHash(t: TechniqueDef): string {
  return sha(canonicalJson({ id: t.id, contract: t.contract, algorithm: t.algorithm })).slice(0, 16);
}

export interface CacheKeyInput {
  technique: TechniqueDef;
  kundliId: string;
  digestVersion: string;
  window: ValidityWindow;
  /** required when the window's scope is 'question': a hash of the question, never the text */
  questionHash?: string;
  /** defaults to TECHNIQUE_CACHE_VERSION */
  cacheVersion?: string;
}

/**
 * The key under which a technique's output for one kundli and one window is stored. Null when the output is not
 * reusable (freshness 'question', an empty window, or a question-scoped technique without a question hash).
 */
export function techniqueCacheKey(input: CacheKeyInput): string | null {
  const { technique, kundliId, digestVersion, window } = input;
  if (!kundliId || !digestVersion) return null;
  if (window.freshness === 'question') return null;
  if (window.to !== null && window.to.getTime() <= window.from.getTime()) return null;
  if (window.scope === 'question' && !input.questionHash) return null;
  const parts = [
    'technique-output',
    input.cacheVersion ?? getTechniqueCacheVersion(),
    technique.id,
    contractHash(technique),
    kundliId,
    digestVersion,
    window.freshness,
    window.from.toISOString(),
    window.to ? window.to.toISOString() : 'open',
    window.scope === 'question' ? input.questionHash! : '',
  ];
  return sha(parts.join('|'));
}
