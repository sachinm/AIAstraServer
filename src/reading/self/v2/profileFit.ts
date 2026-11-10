/**
 * Profile fit of the Self v2 cards (doc 66 replay run 2, failures 1 and 2): the career-stage words table gated by the
 * person's work level and age band, and the two word-overlap measures used to see whether the Personalizer moved the
 * Oracle's reading to this person (a runtime metric per build, never a reject; a test assertion on the golden fixtures).
 *
 * Words and the person's own answers only; nothing astrological is computed.
 */
import {
  getSelfV2JuniorBands,
  getSelfV2SeniorStageBands,
  getSelfV2SeniorStageLevels,
  getSelfV2SeniorStageWords,
} from '../../../config/env.js';
import type { PersonalizerInput } from '../v2types.js';

const escapeRe = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/**
 * The career-stage words this person may not be given ("seasoned", "mentorship", "advisory leadership"), or null when
 * their band or level allows them: a junior band never allows them; a senior band always does; otherwise a senior
 * `work.level` does. Env tables in src/config/env.ts (`SELF_V2_SENIOR_STAGE_*`, `SELF_V2_JUNIOR_BANDS`).
 */
export function seniorStageWordsFor(profile: Pick<PersonalizerInput['profile'], 'ageBand' | 'facts'> | undefined): RegExp | null {
  const band = profile?.ageBand ?? null;
  const level = profile?.facts?.work?.level?.trim().toLowerCase() ?? null;
  const junior = band !== null && getSelfV2JuniorBands().includes(band);
  const seniorBand = band !== null && getSelfV2SeniorStageBands().includes(band);
  const seniorLevel = level !== null && getSelfV2SeniorStageLevels().map((x) => x.toLowerCase()).includes(level);
  if (!junior && (seniorBand || seniorLevel)) return null;
  const words = getSelfV2SeniorStageWords();
  return words.length ? new RegExp(`\\b(${words.map(escapeRe).join('|')})\\b`, 'i') : null;
}

/** function words left out of the overlap measures */
const STOP = new Set(
  'the a an and or but of to in on at for with by from as is are was were be been being it its this that these those you your yours yourself we our they their them he she his her not no so if than then into over under about more most less very can will would should could may might must do does did has have had what when where which who whom how all any each every some such own same other through until while also just only'.split(
    ' ',
  ),
);

/** the content words of a text, lower case */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}

/** token Jaccard of two texts' content-word sets (0 = nothing shared, 1 = the same words) */
export function tokenJaccard(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

const trigrams = (text: string): string[] => {
  const w = (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []);
  const out: string[] = [];
  for (let i = 0; i + 2 < w.length; i++) out.push(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
};

/**
 * The share of a card's word trigrams that also stand in its Oracle area's text (0–1): how much of the card copies the
 * Oracle's word sequences instead of saying them for this person. 0 for an empty card.
 */
export function oracleEcho(card: string, oracle: string): number {
  const c = trigrams(card);
  if (!c.length) return 0;
  const o = new Set(trigrams(oracle));
  return c.filter((t) => o.has(t)).length / c.length;
}

/** Pairwise token Jaccard of several people's texts for the same area: the largest pair and every pair. */
export function pairwiseJaccard(texts: Readonly<Record<string, string>>): { max: number; pairs: Record<string, number> } {
  const ids = Object.keys(texts);
  const pairs: Record<string, number> = {};
  let max = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const v = Math.round(tokenJaccard(texts[ids[i]!]!, texts[ids[j]!]!) * 1000) / 1000;
      pairs[`${ids[i]}|${ids[j]}`] = v;
      max = Math.max(max, v);
    }
  }
  return { max, pairs };
}
