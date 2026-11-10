/**
 * The storyteller's illustration (Sachin 2026-11-09: "the Personalizer needs to be entertainer, the story-teller, and
 * explain certain points from the Oracle with a real-life example, an analogy or a reference to something modern/recent
 * that would make the reader understand very quickly").
 *
 * One illustration per card at most (the hero may carry one too): `{ text, kind, illustrates }`. It is not held to the
 * per-sentence source rule (it is an everyday picture, not a claim), but it must point at one Oracle paragraph that is
 * in the document, and it may carry nothing the card face may not: no chart term, engine name, internal id, medical
 * word, diet or medicine advice (body card), role or career-stage word the profile rules out, gendered word when no
 * gender is stated; and, stricter than a card sentence, no date, year or month name at all (it may not date anything)
 * and at most ILLUSTRATION_MAX_WORDS words. A failing illustration is dropped alone, never the card.
 *
 * Words and patterns only; nothing astrological is computed.
 */
import { wordCount } from '../words.js';
import type { CardIllustration, OracleV2Output } from '../v2types.js';
import { paragraphId } from './slices.js';

export const ILLUSTRATION_MAX_WORDS = 40;
export const ILLUSTRATION_KINDS: readonly CardIllustration['kind'][] = ['example', 'analogy', 'modern'];

/** the Oracle paragraph ids of the document: the only things an illustration may illustrate */
export function oracleParagraphIds(out: OracleV2Output): Set<string> {
  const s = new Set<string>();
  for (const [id, a] of Object.entries(out.doc.areas)) if (a) a.paragraphs.forEach((_, i) => s.add(paragraphId(id, i)));
  return s;
}

/**
 * Month names, case-sensitive so the verb "may" and the word "march" in "march on" pass; "May" capitalised mid-sentence
 * is the month. Abbreviations need their capital too.
 */
const MONTH_NAMES = /\b(January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b|(?<![.!?]\s|^)\bMay\b/;
/** a year (1900–2099), an ISO day, or a numeric day like 12/03 */
const YEARS_AND_DAYS = /\b(19|20)\d{2}s?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|'\d{2}\b/;

/** Why an illustration's words may not stand (date rules first), given the card's own text check; null when they may. */
export function illustrationTextProblem(text: string, cardTextProblem: (t: string) => string | null): string | null {
  const year = text.match(YEARS_AND_DAYS)?.[0];
  if (year) return `a date or year (${year})`;
  const month = text.match(MONTH_NAMES)?.[0];
  if (month) return `a month name (${month})`;
  return cardTextProblem(text);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * The illustration as it may stand, or null (with the reason pushed to `gaps` as `<where>: illustration dropped (…)`).
 * An empty or absent illustration is no illustration and no gap.
 */
export function validateIllustration(
  raw: unknown,
  where: string,
  paragraphIds: ReadonlySet<string>,
  cardTextProblem: (t: string) => string | null,
  gaps: string[],
): CardIllustration | null {
  const o = obj(raw);
  const text = str(o.text);
  if (!text) return null;
  const kind = str(o.kind) as CardIllustration['kind'];
  const illustrates = str(o.illustrates);
  const problem = !ILLUSTRATION_KINDS.includes(kind)
    ? `unknown kind ${kind || 'none'}`
    : !paragraphIds.has(illustrates)
      ? `illustrates ${illustrates || 'nothing'}, not an Oracle paragraph id`
      : wordCount(text) > ILLUSTRATION_MAX_WORDS
        ? `over ${ILLUSTRATION_MAX_WORDS} words`
        : illustrationTextProblem(text, cardTextProblem);
  if (problem) {
    gaps.push(`${where}: illustration dropped (${problem})`);
    return null;
  }
  return { text, kind, illustrates };
}

/** The responseSchema of an illustration (optional on the card and the hero). */
export const ILLUSTRATION_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  description: `optional: one short real-life example, analogy or modern reference (at most ${ILLUSTRATION_MAX_WORDS} words) that makes one Oracle point land`,
  properties: {
    text: { type: 'STRING', description: `at most ${ILLUSTRATION_MAX_WORDS} words, everyday words, no date, no year, no month name` },
    kind: { type: 'STRING', enum: [...ILLUSTRATION_KINDS] },
    illustrates: { type: 'STRING', description: 'the Oracle paragraph id it illustrates, e.g. stuck.p2' },
  },
  required: ['text', 'kind', 'illustrates'],
};
