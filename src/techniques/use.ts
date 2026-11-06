/**
 * Techniques in use (docs/reading-engine/53 §4.3–§4.4; 54 §5): the catalogue's selectors decide which analysts of the
 * graph flow and which readers of the oracle flow run for a question, and which deterministic readers run on the digest.
 * Labels only: the matcher compares the confirmed intent, the clarify slots and the companion memory (person_facts) with
 * each technique's selectors. Nothing here reads a chart.
 *
 * Floors that keep the reading whole whatever the catalogue says: the graph always runs promise and dasha; the oracle
 * always keeps the tier's required readers (R02, R08, and R10 when the horizon is 36 months or less). The deterministic
 * techniques run only when the kundli's digest is ready.
 */
import type { Intent } from '../reading/types.js';
import { horizonRange, type SubjectId } from '../reading/packs/frames.js';
import { analystsFor, annualApplies, prashnaApplies, type SpecialistAnalyst } from '../reading/nodes/specialists.js';
import { readersForTier, type ReaderId, type Tier } from '../reading/oracle/readers.js';
import { CODE_ANALYST_TECHNIQUE, CODE_ANALYSTS, type CodeAnalyst } from '../reading/codeReaders/readers.js';
import { TECHNIQUES, type TechniqueDef } from './catalog.js';
import { selectTechniques } from './contracts.js';

export type ReadingFlowKind = 'single' | 'graph' | 'oracle';

/** The graph analyst each technique runs (doc 53 §4.4; the ids stay so tagged runs keep joining). */
export const TECHNIQUE_ANALYST: Record<string, SpecialistAnalyst> = {
  'general.promise': 'promise',
  'general.dasha': 'dasha',
  'general.transit': 'transit',
  'general.nakshatra': 'nakshatra',
  'general.annual': 'annual',
  'general.prashna': 'prashna',
};

/**
 * The technique each oracle reader belongs to (oracle/readers.ts READERS, doc 33 §2): a reader runs only when its
 * technique is selected. Readers with no layer analyst of their own belong to the reader row (`general.reader`).
 */
export const READER_TECHNIQUE: Record<ReaderId, string> = {
  R01: 'general.reader',
  R02: 'general.promise',
  R03: 'general.reader',
  R04: 'general.reader',
  R05: 'general.reader',
  R06: 'general.reader',
  R07: 'general.nakshatra',
  R08: 'general.dasha',
  R09: 'general.dasha',
  R10: 'general.transit',
  R11: 'general.annual',
  R12: 'general.prashna',
  R13: 'general.reader',
  R14: 'general.reader',
  P1: 'general.reader',
  P2: 'general.reader',
  P3: 'general.reader',
};

const ALL_READERS = Object.keys(READER_TECHNIQUE) as ReaderId[];
/** The graph never runs fewer than these (doc 54 §5). */
export const ALWAYS_ANALYSTS: SpecialistAnalyst[] = ['promise', 'dasha'];
/** The deterministic techniques (code, no model), by analyst. */
export const DETERMINISTIC_TECHNIQUES: readonly string[] = CODE_ANALYSTS.map((a) => CODE_ANALYST_TECHNIQUE[a]);
const CODE_OF = new Map<string, CodeAnalyst>(CODE_ANALYSTS.map((a) => [CODE_ANALYST_TECHNIQUE[a], a]));
/** Techniques that are neither an analyst, a reader nor a deterministic reader: they run on every flow (intake, clarify, the writer). */
const FLOW_TECHNIQUES: Record<string, ReadingFlowKind[]> = {
  'general.reader': ['oracle'],
  'general.validator': ['oracle'],
};

/** The clarify slots a question has: the classifier's slots, `prashna` for an eligible confirmed question, `other_person` when it names a person. */
export function slotsOf(intent: Pick<Intent, 'classification' | 'prashna'>, extra: { otherPerson?: boolean } = {}): string[] {
  const slots = Object.keys(intent.classification?.slots ?? {});
  if (intent.prashna?.eligible) slots.push('prashna');
  if (extra.otherPerson) slots.push('other_person');
  return [...new Set(slots)];
}

export interface TechniqueUseOptions {
  flow: ReadingFlowKind;
  /** oracle flow: the tier, when it is known (readers are then the tier's set intersected with the selection) */
  tier?: number;
  digestReady: boolean;
  /** clarify slots present (slotsOf) */
  slots?: string[];
  /** the date of the question: the graph's optional layers (annual) are then checked against it */
  asOf?: string;
  /** the question text: the prashna layer is then checked against it */
  question?: string;
  /** oracle flow: the readers the plan actually runs (oracle/readers.ts planReaders), once known; they decide the ids */
  readers?: ReaderId[];
}

export interface SubjectUse {
  ids: string[];
  analysts: SpecialistAnalyst[];
  deterministic: CodeAnalyst[];
}

export interface TechniqueUse {
  /** the technique ids of this question, for the trace (`reading_traces.techniques`) */
  ids: string[];
  /** graph analysts over every subject (never fewer than promise and dasha) */
  analysts: SpecialistAnalyst[];
  /** oracle readers allowed by the selection (the tier's set when `tier` is given) */
  readers: ReaderId[];
  /** deterministic readers over every subject (empty unless the digest is ready) */
  deterministic: CodeAnalyst[];
  bySubject: Partial<Record<SubjectId, SubjectUse>>;
}

/** The built chat techniques the input selects; `general.person` also answers the other_person slot (doc 53 §4.4, an any-of rule). */
function selected(intent: Intent, facts: Record<string, string>, slots: string[], techniques: readonly TechniqueDef[]): TechniqueDef[] {
  const built = techniques.filter((t) => t.board === 'chat' && t.status !== 'planned' && !t.id.startsWith('digest.'));
  const out = selectTechniques({ intent, facts, board: 'chat', slots }, built);
  const person = built.find((t) => t.id === 'general.person');
  if (person && slots.includes('other_person') && !out.includes(person)) out.push(person);
  return out;
}

/** The graph analysts a subject runs: today's rule (analystsFor and the optional layers) narrowed to the selected techniques. */
function analystsOf(intent: Intent, chosen: Set<string>, o: TechniqueUseOptions): SpecialistAnalyst[] {
  const allowed = new Set<SpecialistAnalyst>([...ALWAYS_ANALYSTS, ...[...chosen].map((id) => TECHNIQUE_ANALYST[id]).filter((a): a is SpecialistAnalyst => !!a)]);
  const base = analystsFor(intent).filter((a) => allowed.has(a));
  const optional: SpecialistAnalyst[] = [];
  if (allowed.has('annual') && (!o.asOf || annualApplies(intent, o.asOf))) optional.push('annual');
  if (allowed.has('prashna') && (o.question === undefined || prashnaApplies(intent, o.question))) optional.push('prashna');
  return [...new Set<SpecialistAnalyst>([...ALWAYS_ANALYSTS, ...base, ...optional])];
}

/** The oracle readers the selection allows: the tier's set (or every reader) less the readers of unselected techniques, never less than the required ones. */
function readersOf(intent: Intent, chosen: Set<string>, o: TechniqueUseOptions): ReaderId[] {
  const pool = o.tier ? readersForTier(o.tier as Tier) : ALL_READERS;
  const keep = new Set<ReaderId>(['R02', 'R08']);
  if (o.asOf && horizonRange(intent.horizon, o.asOf).months <= 36) keep.add('R10');
  return pool.filter((id) => keep.has(id) || chosen.has(READER_TECHNIQUE[id]));
}

/**
 * Which techniques a question uses (doc 54 §5): ids for the trace, the graph analysts, the oracle readers and the
 * deterministic readers, overall and per subject.
 */
export function techniquesForQuestion(intent: Intent, facts: Record<string, string>, o: TechniqueUseOptions, techniques: readonly TechniqueDef[] = TECHNIQUES): TechniqueUse {
  const slots = o.slots ?? slotsOf(intent);
  const bySubject: TechniqueUse['bySubject'] = {};
  const runs = (id: string, analysts: SpecialistAnalyst[], readers: ReaderId[]): boolean => {
    const flows = FLOW_TECHNIQUES[id];
    if (flows) return flows.includes(o.flow);
    if (CODE_OF.has(id)) return o.digestReady && o.flow !== 'single';
    const analyst = TECHNIQUE_ANALYST[id];
    if (analyst) return o.flow === 'graph' ? analysts.includes(analyst) : o.flow === 'oracle' ? readers.some((r) => READER_TECHNIQUE[r] === id) : false;
    return true;
  };
  const allIds: string[] = [];
  const allAnalysts = new Set<SpecialistAnalyst>(ALWAYS_ANALYSTS);
  const allCode = new Set<CodeAnalyst>();
  const allChosen = new Set<string>();
  const subjects = intent.subjects.length ? intent.subjects : [];
  for (const s of subjects) {
    const one: Intent = { ...intent, subjects: [s] };
    const chosen = new Set(selected(one, facts, slots, techniques).map((t) => t.id));
    for (const id of chosen) allChosen.add(id);
    // today's rule reads the whole question (a nakshatra pass for any life-direction subject), so it gets the whole intent
    const analysts = analystsOf(intent, chosen, o);
    const readers = o.readers ?? readersOf(one, chosen, o);
    const deterministic = o.digestReady && o.flow !== 'single' ? CODE_ANALYSTS.filter((a) => chosen.has(CODE_ANALYST_TECHNIQUE[a])) : [];
    const ids = [...chosen].filter((id) => runs(id, analysts, readers));
    bySubject[s.id] = { ids, analysts, deterministic };
    for (const a of analysts) allAnalysts.add(a);
    for (const a of deterministic) allCode.add(a);
  }
  const analysts = [...allAnalysts];
  const readers = o.readers ?? readersOf(intent, allChosen, o);
  // catalogue order for the ids, so the trace label is stable
  for (const t of techniques) if (allChosen.has(t.id) && runs(t.id, analysts, readers) && (!CODE_OF.has(t.id) || allCode.has(CODE_OF.get(t.id)!))) allIds.push(t.id);
  return { ids: allIds, analysts, readers, deterministic: [...allCode], bySubject };
}
