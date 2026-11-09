/**
 * A technique is a contract (docs/reading-engine/53 §4.3): `selectors` say when the clarify context and the companion
 * memory pick it, `contract` says what it reads (digest sections in a named layout), under which system prompt, with
 * which user-turn fields, and what it returns. The matcher here only compares labels: it computes nothing astrological.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Intent } from '../reading/types.js';
import type { SubjectId } from '../reading/packs/frames.js';
import type { TechniqueBoard, TechniqueDef } from './catalog.js';
import { TECHNIQUES } from './catalog.js';
import { layoutById } from './layouts.js';

export type TechniqueBoardId = TechniqueBoard;

/** When a technique is selected. A missing or empty field matches everything. `houses` and `vargas` describe; they are not matched. */
export interface TechniqueSelectors {
  /** frames.ts ids: career_work, marriage_relationship … */
  subjects?: SubjectId[];
  boards?: TechniqueBoard[];
  /** the D1 houses it is about */
  houses?: number[];
  /** D1, D9, D10 … */
  vargas?: string[];
  /** intent.questionType: timing, yes_no, explain, … */
  questionTypes?: string[];
  /** intent.horizon codes (now, 3m, 6m, 1y, 3y, life) or 'custom' for a {from, to} range */
  horizons?: string[];
  /** person_facts keys and the values that switch it on (work.status = between_jobs) */
  facts?: Record<string, string[]>;
  /** clarify slots that must be present (other_person, specific_event, prashna) */
  slots?: string[];
}

/**
 * The digest sections (doc 53 §4.1) plus what a synthesizer or a text agent reads. `person` is the person's own typed
 * facts (age band, stated gender, role, person_facts): not per question, since a store key that reads it carries the
 * profile hash (docs/reading-engine/66 §4.2).
 */
export type ContractSection = 'house' | 'planet' | 'yoga' | 'point' | 'annual' | 'star' | 'activation' | 'transit' | 'panchang' | 'prashna' | 'person' | 'findings' | 'text';

export interface ContractInput {
  section: ContractSection;
  /** e.g. "D1,D10 houses 10,6,1" or "activation houses [10,6] years ±3" */
  filter: string;
  /** a named table layout in src/techniques/layouts.ts */
  layout: string;
}

export interface TechniqueContract {
  inputs: ContractInput[];
  /** prompt file under src/reading/prompts/ (v2/dasha.md, readers/R08.md …), `db:<name>` for a prompt kept in system_prompts, or 'none' for a code path */
  system: string;
  /** user-turn fields: TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS */
  user: string[];
  /** schema name: findings.v2, findings.v3, career_map.v1, windows.v1 */
  output: string;
  /** the technique that consumes this output */
  synthesizer?: string;
}

export interface SelectInput {
  intent?: Pick<Intent, 'subjects' | 'horizon' | 'questionType' | 'classification'> | null;
  /** person_facts key → value (the companion memory) */
  facts?: Record<string, string>;
  board: TechniqueBoard;
  /** clarify slots present on the question */
  slots?: string[];
}

const has = (xs: readonly unknown[] | undefined): xs is readonly unknown[] => Array.isArray(xs) && xs.length > 0;

/** The horizon code a selector compares against: the intent's code, or 'custom' for a {from, to} range. */
export function horizonCode(h: Intent['horizon'] | undefined | null): string | null {
  if (!h) return null;
  return typeof h === 'string' ? h : 'custom';
}

/** True when every selector the technique declares is satisfied by the input. */
export function selectorsMatch(s: TechniqueSelectors | undefined, input: SelectInput): boolean {
  if (!s) return true;
  if (has(s.boards) && !s.boards.includes(input.board)) return false;
  const intentSubjects = new Set((input.intent?.subjects ?? []).map((x) => x.id));
  if (has(s.subjects) && !s.subjects.some((id) => intentSubjects.has(id))) return false;
  if (has(s.questionTypes) && !(input.intent?.questionType && s.questionTypes.includes(input.intent.questionType))) return false;
  if (has(s.horizons)) {
    const code = horizonCode(input.intent?.horizon);
    if (!code || !s.horizons.includes(code)) return false;
  }
  if (s.facts) {
    for (const [key, values] of Object.entries(s.facts)) {
      if (!has(values)) continue;
      const v = input.facts?.[key];
      if (v === undefined || !values.includes(v)) return false;
    }
  }
  if (has(s.slots)) {
    const present = new Set(input.slots ?? []);
    if (!s.slots.every((slot) => present.has(slot))) return false;
  }
  return true;
}

/** The techniques whose selectors all match (doc 53 §4.3); catalogue order is kept. */
export function selectTechniques(input: SelectInput, techniques: readonly TechniqueDef[] = TECHNIQUES): TechniqueDef[] {
  return techniques.filter((t) => selectorsMatch(t.selectors, input));
}

export function techniqueIdsFor(input: SelectInput, techniques: readonly TechniqueDef[] = TECHNIQUES): string[] {
  return selectTechniques(input, techniques).map((t) => t.id);
}

const PROMPTS_PREFIX = 'src/reading/prompts/';
const ROOTS = [resolve(fileURLToPath(new URL('../../', import.meta.url))), process.cwd()];

/** A prompt path under src/reading/prompts/ that exists on disk (checked from the repo root; the prompts are bundled in production). */
export function promptFileExists(path: string): boolean {
  if (!path.startsWith(PROMPTS_PREFIX) || path.includes('..')) return false;
  return ROOTS.some((root) => existsSync(resolve(root, path)));
}

/**
 * What is wrong with a technique's contract, in words; empty when it is sound. Checked by the catalogue test: inputs for
 * every built row, a system prompt that exists (or 'none' / `db:<name>`), a named layout per input, an output schema and
 * a synthesizer that is in the catalogue.
 */
export function contractProblems(t: TechniqueDef, techniques: readonly TechniqueDef[] = TECHNIQUES): string[] {
  const out: string[] = [];
  const c = t.contract;
  if (!c) return [`${t.id}: no contract`];
  if (!Array.isArray(c.inputs)) out.push(`${t.id}: inputs is not a list`);
  else {
    if (t.status !== 'planned' && c.inputs.length === 0) out.push(`${t.id}: a built row needs at least one input`);
    for (const [i, inp] of c.inputs.entries()) {
      if (!inp.section) out.push(`${t.id}: input ${i} has no section`);
      if (!inp.filter) out.push(`${t.id}: input ${i} has no filter`);
      if (!layoutById(inp.layout)) out.push(`${t.id}: input ${i} names an unknown layout ${inp.layout}`);
    }
  }
  if (!c.system) out.push(`${t.id}: no system prompt`);
  else if (c.system !== 'none' && !c.system.startsWith('db:') && !promptFileExists(c.system)) out.push(`${t.id}: system prompt ${c.system} is not a file under ${PROMPTS_PREFIX}`);
  if (!Array.isArray(c.user)) out.push(`${t.id}: user fields is not a list`);
  if (!c.output) out.push(`${t.id}: no output schema`);
  if (c.synthesizer !== undefined) {
    if (!techniques.some((x) => x.id === c.synthesizer)) out.push(`${t.id}: synthesizer ${c.synthesizer} is not in the catalogue`);
    if (c.synthesizer === t.id) out.push(`${t.id}: is its own synthesizer`);
  }
  return out;
}
