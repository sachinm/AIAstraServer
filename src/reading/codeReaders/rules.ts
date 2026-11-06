/**
 * The reading rules of the deterministic readers (docs/reading-engine/53 §4.4, step 5; 54 §5). Each rule compares an
 * engine field (a dignity label, a yoga class, an SAV count, a shadbala ratio, a house class, an argala list) with a
 * stated threshold or label and gives the claim its side and weight. Nothing here derives a sign, a lord, an aspect, a
 * dignity or a yoga: the engine wrote every value the rules read, and the digest only selected it.
 *
 * Sources: BPHS (Parashara, R. Santhanam tr.) and P.V.R. Narasimha Rao, *Vedic Astrology: An Integrated Approach* (PVR),
 * as doc 33 §2.4–§2.7 and §2.14 (readers R3–R6, R13) apply them.
 */

export type Polarity = 'supports' | 'obstructs' | 'neutral';
export type Weight = 1 | 2 | 3;

export interface ReadingRule {
  id: string;
  /** what the rule reads, in words */
  when: string;
  polarity: Polarity;
  weight: Weight;
  source: string;
}

/** Every rule a deterministic reader applies. The ids are written on nothing user-facing; they label the claims for review. */
export const CODE_READER_RULES = {
  dignity_strong: { id: 'dignity_strong', when: 'the engine labels the planet exalted, moolatrikona or in its own sign', polarity: 'supports', weight: 2, source: 'BPHS ch. 3 (exaltation, moolatrikona, own sign); doc 33 R3, R5' },
  dignity_weak: { id: 'dignity_weak', when: 'the engine labels the planet debilitated', polarity: 'obstructs', weight: 2, source: 'BPHS ch. 3 (debilitation); doc 33 R3, R5' },
  yoga_present: { id: 'yoga_present', when: 'a yoga the engine lists as present joins a frame house or a frame lord or karaka', polarity: 'supports', weight: 2, source: 'BPHS ch. 34-41 (yogas); doc 33 R6: a yoga not in the engine list is not claimed' },
  dosha_present: { id: 'dosha_present', when: 'the engine lists the row with class dosha and it joins a frame house or planet', polarity: 'obstructs', weight: 2, source: 'BPHS ch. 34-41; PVR ch. 11 (doshas); doc 33 R6' },
  sav_high: { id: 'sav_high', when: 'the SAV of a frame house is 28 or more', polarity: 'supports', weight: 1, source: 'BPHS ch. 66-72 (ashtakavarga: 28 bindus is the average of a sign); doc 33 R5' },
  sav_low: { id: 'sav_low', when: 'the SAV of a frame house is 22 or less', polarity: 'obstructs', weight: 1, source: 'BPHS ch. 66-72; doc 33 R5 (SAV of 22 or less)' },
  shadbala_enough: { id: 'shadbala_enough', when: "a frame lord's shadbala ratio (rupas over the required rupas, as the engine gives it) is 1 or more", polarity: 'supports', weight: 1, source: 'BPHS ch. 27 (the required strength of each planet); doc 33 R5' },
  shadbala_short: { id: 'shadbala_short', when: "a frame lord's shadbala ratio is below 1", polarity: 'obstructs', weight: 1, source: 'BPHS ch. 27; doc 33 R5' },
  varga_agree_strong: { id: 'varga_agree_strong', when: "a frame house lord is strong (rule dignity_strong) in D1 and in the frame's varga", polarity: 'supports', weight: 2, source: 'BPHS ch. 6-7 (vargas confirm D1); PVR ch. 9; doc 33 R3' },
  varga_agree_weak: { id: 'varga_agree_weak', when: "a frame house lord is debilitated in D1 and in the frame's varga", polarity: 'obstructs', weight: 2, source: 'BPHS ch. 6-7; PVR ch. 9; doc 33 R3' },
  varga_disagree: { id: 'varga_disagree', when: 'a frame house lord is strong in one of D1 and the varga and debilitated in the other', polarity: 'neutral', weight: 1, source: 'doc 33 R3 (form and promise disagree)' },
  varga_occupant_repeats: { id: 'varga_occupant_repeats', when: 'a planet occupies the frame house in D1 and the same house in the varga', polarity: 'neutral', weight: 1, source: 'doc 33 R3 (the bond is in every layer)' },
  house_class_good: { id: 'house_class_good', when: 'a karaka or arudha of the frame sits in a house the engine classes kendra or trikona', polarity: 'supports', weight: 1, source: 'BPHS ch. 34 (kendra and trikona); PVR ch. 22 (arudhas)' },
  house_class_hard: { id: 'house_class_hard', when: 'a karaka or arudha of the frame sits in a house the engine classes dusthana', polarity: 'obstructs', weight: 1, source: 'BPHS ch. 34 (dusthanas 6, 8, 12); PVR ch. 22' },
  argala_holds: { id: 'argala_holds', when: 'a frame house has more planets in primary argala than obstructing them (engine argala lists)', polarity: 'supports', weight: 1, source: 'Jaimini Upadesa Sutras 1.1.5-9; PVR ch. 21 (argala)' },
  argala_blocked: { id: 'argala_blocked', when: 'a frame house has primary argala and at least as many planets obstructing it', polarity: 'neutral', weight: 1, source: 'Jaimini Upadesa Sutras 1.1.8; PVR ch. 21' },
  rasi_period_active: { id: 'rasi_period_active', when: 'a Narayana or Chara rasi dasha period inside the horizon activates a frame house or its lord', polarity: 'supports', weight: 1, source: 'Jaimini Upadesa Sutras 2.1; PVR ch. 19 (Narayana and Chara rasi dashas); doc 33 R4' },
} as const satisfies Record<string, ReadingRule>;

export type CodeReaderRuleId = keyof typeof CODE_READER_RULES;

/** Engine dignity labels, matched case-insensitively by their stem (the engine writes e.g. `exalted`, `own`, `moolatrikona`). */
export const DIGNITY_STEMS = { strong: ['exalt', 'moola', 'own'], weak: ['debil'] } as const;

/** Engine house class labels the house-class rules read. */
export const HOUSE_CLASSES = { good: ['kendra', 'trikona'], hard: ['dusthana'] } as const;

/** SAV thresholds (rules sav_high, sav_low). */
export const SAV_HIGH = 28;
export const SAV_LOW = 22;

/** At most this many claims per deterministic reader (doc 54 §5). */
export const MAX_CODE_CLAIMS = 8;

/**
 * The person of a person subject or of the other_person slot, read through the owner's chart only (doc 33 §2.14): the
 * house, the varga of the relationship and the natural karaka. A label table, as packs/frames.ts and oracle/readers.ts
 * personIn hold the same houses; it computes nothing.
 */
export const PERSON_SIGNIFIERS: Record<'mother' | 'father' | 'spouse' | 'child' | 'sibling', { houses: number[]; varga: string; karaka: string }> = {
  mother: { houses: [4], varga: 'D12', karaka: 'Mo' },
  father: { houses: [9], varga: 'D12', karaka: 'Su' },
  spouse: { houses: [7], varga: 'D9', karaka: 'Ve' },
  child: { houses: [5], varga: 'D7', karaka: 'Ju' },
  sibling: { houses: [3, 11], varga: 'D3', karaka: 'Ma' },
};

/** The person a person subject is about, when the question names nobody (doc 53 §4.4 general.person). */
export const PERSON_OF_SUBJECT: Partial<Record<string, keyof typeof PERSON_SIGNIFIERS>> = {
  marriage_relationship: 'spouse',
  children: 'child',
  siblings: 'sibling',
};

/** Layer score and verdict from the claims: the signed weights summed, a third of it rounded, clamped to −3…+3. */
export function scoreOf(claims: Array<{ polarity: Polarity; weight: number }>): number {
  const sum = claims.reduce((n, c) => n + (c.polarity === 'supports' ? c.weight : c.polarity === 'obstructs' ? -c.weight : 0), 0);
  return Math.max(-3, Math.min(3, Math.round(sum / 3)));
}

export function verdictOf(score: number, claims: number): 'strong' | 'moderate' | 'weak' | 'mixed' {
  if (claims === 0) return 'mixed';
  if (score >= 2) return 'strong';
  if (score === 1) return 'moderate';
  if (score <= -1) return 'weak';
  return 'mixed';
}

const stemOf = (label: string | null | undefined, stems: readonly string[]): boolean => {
  const l = (label ?? '').toLowerCase();
  return l !== '' && stems.some((s) => l.includes(s));
};

/** strong | weak | other, from the engine's dignity label. */
export function dignityClass(label: string | null | undefined): 'strong' | 'weak' | 'other' {
  if (stemOf(label, DIGNITY_STEMS.weak)) return 'weak';
  if (stemOf(label, DIGNITY_STEMS.strong)) return 'strong';
  return 'other';
}

/** good | hard | other, from the engine's house class labels. */
export function houseClassOf(classes: readonly string[] | null | undefined): 'good' | 'hard' | 'other' {
  const cs = (classes ?? []).map((c) => c.toLowerCase());
  if (cs.some((c) => HOUSE_CLASSES.hard.some((h) => c.includes(h)))) return 'hard';
  if (cs.some((c) => HOUSE_CLASSES.good.some((g) => c.includes(g)))) return 'good';
  return 'other';
}
