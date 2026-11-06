/**
 * The readers of the oracle flow (docs/reading-engine/33 §2, 39 §4.1): one data category, one curriculum, one budget each.
 * Which readers run is a rule on the question, never a model's choice. Natal readers are not sent the question, so a person's
 * findings can be reused across questions.
 */
import { readingRemedyReader } from '../config.js';
import type { Intent } from '../types.js';
import { FRAMES, horizonRange, type SubjectId } from '../packs/frames.js';
import type { SpecialistAnalyst } from '../nodes/specialists.js';
import { CORE_TYPES } from './chartBundle.js';
import { aspectLists, annualTable, clipPeriods, frameHouses, presentOnly, sectionName, tidy } from './slices.js';
import type { PlanBRoute } from './planB.js';

export type ReaderId = 'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06' | 'R07' | 'R08' | 'R09' | 'R10' | 'R11' | 'R12' | 'R13' | 'R14' | 'P1' | 'P2' | 'P3';
export type Tier = 1 | 2 | 3 | 4 | 5;

export interface PersonFrame {
  person: 'mother' | 'father' | 'spouse' | 'child' | 'sibling';
  houses: number[];
  varga: string;
}

export interface SliceContext {
  /** stored tables of this question, by type id */
  tables: Record<string, unknown>;
  houses: number[];
  /** divisional chart type ids for the subject, first is primary */
  vargas: string[];
  from: string;
  to: string;
  /** the transit rows of this question, from the evidence pack */
  transits?: unknown;
  transitAt?: unknown;
  prashna?: unknown;
  person?: PersonFrame | null;
}

export interface ReaderDef {
  id: ReaderId;
  promptKey: string;
  label: string;
  /** reads only birth data and is not sent the question: its findings hold across questions */
  natal: boolean;
  /** the output limit is the time limit: the readers' speed makes a token budget into seconds (§5) */
  maxOutputTokens: number;
  timeoutMs: number;
  /** which convergence layer of reconcile this reader feeds; the others go to the brief directly */
  layer?: SpecialistAnalyst;
  /** stored types beyond the shared core */
  types: (c: Pick<SliceContext, 'vargas' | 'person'>) => string[];
  slice: (c: SliceContext) => Record<string, unknown>;
}

const LIGHT = { maxOutputTokens: 800, timeoutMs: 4_000 };
const NORMAL = { maxOutputTokens: 1_100, timeoutMs: 5_000 };
const HEAVY = { maxOutputTokens: 1_400, timeoutMs: 6_000 };

const table = (c: SliceContext, type: string, f: (p: unknown) => unknown = tidy): Record<string, unknown> => (c.tables[type] === undefined ? {} : { [sectionName(type)]: f(c.tables[type]) });
const clipped = (c: SliceContext, type: string): Record<string, unknown> => table(c, type, (p) => clipPeriods(p, c.from, c.to));
const transitRows = (c: SliceContext): Record<string, unknown> => ({ ...(c.transits !== undefined ? { transits: c.transits } : {}), ...(c.transitAt ? { transit_at: c.transitAt } : {}) });

const ANNUAL = ['annual.tithi_pravesha', 'annual.varsha', 'annual.sahams', 'annual.mudda', 'annual.patyayini'];
const OTHER_DASHAS = ['dasha.applicable', 'dasha.yogini', 'dasha.narayana', 'dasha.tithi_ashtottari', 'dasha.dwisatpathi'];

export const READERS: Record<ReaderId, ReaderDef> = {
  R01: { id: 'R01', promptKey: 'readers/R01-backbone', label: 'Chart backbone', natal: true, ...NORMAL, types: () => ['yogas', 'doshas', 'dasha.vimsottari'], slice: (c) => ({ ...table(c, 'yogas', (p) => presentOnly(p, 'yogas')), ...table(c, 'doshas', (p) => presentOnly(p, 'doshas')), ...table(c, 'dasha.vimsottari', (p) => clipPeriods(p, c.from, c.from)) }) },
  R02: { id: 'R02', promptKey: 'readers/R02-house-lord', label: 'Houses and lords', natal: true, ...NORMAL, layer: 'promise', types: () => ['aspects', 'argala.d1', 'bhava'], slice: (c) => ({ ...table(c, 'aspects', aspectLists), ...table(c, 'argala.d1', (p) => frameHouses(p, c.houses)), ...table(c, 'bhava', (p) => frameHouses(p, c.houses)) }) },
  R03: { id: 'R03', promptKey: 'readers/R03-varga', label: 'Divisional charts', natal: true, ...NORMAL, types: (c) => [...new Set([...c.vargas.slice(0, 1), 'varga.d9', 'varga.d30'])].flatMap((v) => (v === c.vargas[0] ? [v, v.replace('varga.', 'arudhas.')] : [v])), slice: (c) => Object.assign({}, ...[...new Set([...c.vargas.slice(0, 1), 'varga.d9', 'varga.d30'])].map((v) => table(c, v)), c.vargas[0] ? table(c, c.vargas[0].replace('varga.', 'arudhas.')) : {}) },
  R04: { id: 'R04', promptKey: 'readers/R04-jaimini', label: 'Jaimini', natal: false, ...NORMAL, types: () => ['argala.d1', 'dasha.narayana', 'dasha.chara'], slice: (c) => ({ ...table(c, 'argala.d1', (p) => frameHouses(p, c.houses)), ...clipped(c, 'dasha.narayana'), ...clipped(c, 'dasha.chara') }) },
  R05: { id: 'R05', promptKey: 'readers/R05-strength', label: 'Strength', natal: true, ...LIGHT, types: () => ['strength.bhava', 'strength.vimsopaka', 'strength.harsha'], slice: (c) => ({ ...table(c, 'strength.bhava'), ...table(c, 'strength.vimsopaka'), ...table(c, 'strength.harsha') }) },
  R06: { id: 'R06', promptKey: 'readers/R06-yoga-dosha', label: 'Yogas and doshas', natal: true, ...LIGHT, types: () => ['yogas', 'doshas'], slice: (c) => ({ ...table(c, 'yogas', (p) => presentOnly(p, 'yogas')), ...table(c, 'doshas', (p) => presentOnly(p, 'doshas')) }) },
  R07: { id: 'R07', promptKey: 'readers/R07-nakshatra', label: 'Nakshatras', natal: false, ...NORMAL, layer: 'nakshatra', types: () => [], slice: (c) => transitRows(c) },
  R08: { id: 'R08', promptKey: 'readers/R08-vimshottari', label: 'Vimshottari periods', natal: false, ...NORMAL, layer: 'dasha', types: () => ['dasha.vimsottari'], slice: (c) => clipped(c, 'dasha.vimsottari') },
  R09: { id: 'R09', promptKey: 'readers/R09-other-dashas', label: 'Other dasha systems', natal: false, ...HEAVY, types: () => OTHER_DASHAS, slice: (c) => Object.assign({}, table(c, 'dasha.applicable'), ...OTHER_DASHAS.slice(1).map((t) => clipped(c, t))) },
  R10: { id: 'R10', promptKey: 'readers/R10-transit', label: 'Transits', natal: false, ...NORMAL, layer: 'transit', types: () => [], slice: (c) => transitRows(c) },
  R11: { id: 'R11', promptKey: 'readers/R11-annual', label: 'Year chart', natal: false, ...NORMAL, layer: 'annual', types: () => ANNUAL, slice: (c) => Object.assign({}, ...ANNUAL.map((t) => table(c, t, (p) => annualTable(p, c.from, c.to)))) },
  R12: { id: 'R12', promptKey: 'readers/R12-prashna', label: 'Question chart', natal: false, ...LIGHT, layer: 'prashna', types: () => [], slice: (c) => (c.prashna ? { prashna: c.prashna } : {}) },
  R13: { id: 'R13', promptKey: 'readers/R13-person', label: 'The person in your chart', natal: false, ...HEAVY, types: (c) => ['aspects', 'dasha.vimsottari', ...(c.person ? [c.person.varga] : [])], slice: (c) => ({ ...table(c, 'aspects', aspectLists), ...clipped(c, 'dasha.vimsottari'), ...(c.person ? table(c, c.person.varga) : {}), ...transitRows(c) }) },
  R14: { id: 'R14', promptKey: 'readers/R14-remedy', label: 'What to do', natal: false, ...LIGHT, types: () => [], slice: () => ({}) },
  P1: { id: 'P1', promptKey: 'readers/P1-pressure', label: 'What is pressing', natal: false, ...NORMAL, types: () => ['aspects', 'bhava', 'dasha.vimsottari'], slice: (c) => ({ ...table(c, 'aspects', aspectLists), ...table(c, 'bhava'), ...clipped(c, 'dasha.vimsottari'), ...transitRows(c) }) },
  P2: { id: 'P2', promptKey: 'readers/P2-mood', label: 'The tone of today', natal: false, ...LIGHT, types: () => ['dasha.vimsottari'], slice: (c) => ({ ...clipped(c, 'dasha.vimsottari'), ...transitRows(c) }) },
  P3: { id: 'P3', promptKey: 'readers/P3-luck', label: 'Luck at this moment', natal: false, ...LIGHT, types: () => ['sphutas', 'dasha.vimsottari'], slice: (c) => ({ ...table(c, 'sphutas'), ...clipped(c, 'dasha.vimsottari'), ...transitRows(c) }) },
};

/** Readers the validator may send a missing part back to: the ones that read this question rather than birth data alone. */
export const LOOP_READERS: ReaderId[] = ['R02', 'R03', 'R08', 'R09', 'R10', 'R11', 'R13'];

/** Output speed per model (doc 39 §5). Reader budgets stretch for a slower model, so a model swap cannot cause time-outs. */
export const MODEL_SPEEDS: Record<string, { ttftMs: number; tokPerSec: number }> = {
  'gemini-3.1-flash-lite': { ttftMs: 1_600, tokPerSec: 500 },
  'gemini-3.8-flash': { ttftMs: 3_300, tokPerSec: 140 },
};
const UNKNOWN_SPEED = { ttftMs: 3_300, tokPerSec: 140 };

/** Time for one attempt: the reader's budget, or what this model needs for its output limit, whichever is longer. */
export function readerTimeoutMs(def: Pick<ReaderDef, 'timeoutMs' | 'maxOutputTokens'>, model: string): number {
  const s = MODEL_SPEEDS[model] ?? UNKNOWN_SPEED;
  return Math.max(def.timeoutMs, Math.ceil((s.ttftMs + (def.maxOutputTokens / s.tokPerSec) * 1000) * 1.25));
}

const PEOPLE: Array<{ re: RegExp; frame: PersonFrame }> = [
  { re: /\b(mother|mom|mum|amma|maa)\b/i, frame: { person: 'mother', houses: [4], varga: 'varga.d12' } },
  { re: /\b(father|dad|papa|pita)\b/i, frame: { person: 'father', houses: [9], varga: 'varga.d12' } },
  { re: /\b(wife|husband|spouse|partner|girlfriend|boyfriend)\b/i, frame: { person: 'spouse', houses: [7], varga: 'varga.d9' } },
  { re: /\b(son|daughter|child|children|kids?)\b/i, frame: { person: 'child', houses: [5], varga: 'varga.d7' } },
  { re: /\b(brother|sister|sibling)\b/i, frame: { person: 'sibling', houses: [3, 11], varga: 'varga.d3' } },
];

/** The first person the question names. Read from the owner's chart only (doc 33 §2.14). */
export function personIn(question: string): PersonFrame | null {
  return PEOPLE.find((p) => p.re.test(question))?.frame ?? null;
}

const WHY_OR_DECIDE = new Set(['why_meaning', 'compare']);
const SHORT_HORIZON = new Set(['now', '3m']);

/** The tier from the question, by rule (doc 26 Part B, doc 33 §3.1). Fast-lane questions never reach here: they go to one call. */
export function tierFor(intent: Intent, question: string, realWant?: string | null): Tier {
  if (intent.horizon === 'life' || /\b(life reading|whole life|entire life|my life overall)\b/i.test(question)) return 1;
  if (WHY_OR_DECIDE.has(intent.questionType) || personIn(question) || (realWant && /^why_|what_can_i_do|is_it_serious/.test(realWant))) return 2;
  if (typeof intent.horizon === 'string' && SHORT_HORIZON.has(intent.horizon)) return 5;
  if (intent.questionType === 'timing') return 4;
  return 3;
}

const BY_TIER: Record<Tier, ReaderId[]> = {
  5: ['R08', 'R10'],
  4: ['R02', 'R08', 'R10'],
  3: ['R01', 'R02', 'R03', 'R08', 'R10'],
  2: ['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08', 'R10'],
  1: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11'],
};

/** Join deadline: past it the Oracle starts with what it has. */
export function joinDeadlineMs(tier: Tier, ids: ReaderId[], model: string): number {
  const base = tier === 1 ? 8_000 : 6_000;
  return Math.max(base, ...ids.map((id) => readerTimeoutMs(READERS[id], model) + 500));
}

export interface ReaderPlan {
  tier: Tier;
  ids: ReaderId[];
  required: Set<ReaderId>;
}

/** The readers of a tier (doc 33 §3.1), before the question's own additions. */
export function readersForTier(tier: Tier): ReaderId[] {
  return [...(BY_TIER[tier] ?? [])];
}

/**
 * Which readers run for this question, and which of them hold the join. `allowed` (src/techniques/use.ts) is the set
 * the selected techniques allow: the tier's readers are intersected with it, and R02, R08 (and R10 for a horizon of
 * 36 months or less) are kept whatever it says.
 */
export function planReaders(a: { intent: Intent; question: string; asOf: string; realWant?: string | null; route?: PlanBRoute | null; prashna?: boolean; allowed?: readonly ReaderId[] | null }): ReaderPlan {
  const tier = a.route?.tier ?? tierFor(a.intent, a.question, a.realWant);
  const hz = horizonRange(a.intent.horizon, a.asOf);
  const floor = new Set<ReaderId>(['R02', 'R08', ...(hz.months <= 36 ? (['R10'] as ReaderId[]) : [])]);
  const allowed = a.allowed ? new Set(a.allowed) : null;
  const ok = (id: ReaderId): boolean => !allowed || allowed.has(id) || floor.has(id);
  const ids = new Set<ReaderId>((a.route?.readers ?? BY_TIER[tier]).filter(ok));
  const person = personIn(a.question);
  if (person && !a.route && ok('R13')) ids.add('R13');
  if (a.prashna && ok('R12')) ids.add('R12');
  if (readingRemedyReader() && (a.realWant === 'what_can_i_do' || a.route?.route === 'pressure') && ok('R14')) ids.add('R14');
  const required = new Set<ReaderId>();
  for (const id of ['R02', 'R08', 'R13', 'P1', 'P2', 'P3'] as ReaderId[]) if (ids.has(id)) required.add(id);
  if (ids.has('R10') && hz.months <= 36) required.add('R10');
  return { tier, ids: [...ids], required };
}

/** The frame fields a reader is told about, from the subject table. */
export function subjectVargas(subject: SubjectId): string[] {
  return (FRAMES[subject]?.vargas ?? []).map((v) => `varga.${v.toLowerCase()}`);
}

/** Every stored type a plan needs: what one query loads. */
export function fetchPlan(ids: ReaderId[], c: Pick<SliceContext, 'vargas' | 'person'>): string[] {
  return [...new Set([...CORE_TYPES, ...ids.flatMap((id) => READERS[id].types(c))])];
}
