/**
 * The only word tables of the You reading (docs/reading-engine/58 §4.1). They map engine values (a house number, a
 * planet code, the engine's dignity and ripeness labels, a fruition class) to plain words. Nothing here derives an
 * astrological value; every key is something the engine already returned. Reviewed by Sachin before copy changes.
 */

/** What a house means for the person, in full. */
export const HOUSE_SELF: Record<number, string> = {
  1: 'your body, your presence and your sense of self',
  2: 'your family, your speech and what you hold',
  3: 'your own effort, courage and skills',
  4: 'your home, your mother and your peace of mind',
  5: 'your ideas, learning, creativity and children',
  6: 'service, daily work, rivals and debts',
  7: 'partners, clients and the people you deal with',
  8: 'sudden change, shared money and what is hidden',
  9: 'belief, teachers, your father and fortune',
  10: 'your work, your standing and what you are known for',
  11: 'gains, friends, networks and elder siblings',
  12: 'rest, letting go, expenses and faraway places',
};

/** The same, short, for lists. */
export const HOUSE_SHORT: Record<number, string> = {
  1: 'yourself',
  2: 'family and money',
  3: 'your own effort',
  4: 'home and peace of mind',
  5: 'ideas and learning',
  6: 'service and struggle',
  7: 'partnership',
  8: 'change and the hidden',
  9: 'belief and fortune',
  10: 'work and standing',
  11: 'gains and networks',
  12: 'letting go and faraway places',
};

/** What a planet carries in a person (karakatva), as a faculty. */
export const PLANET_FACULTY: Record<string, string> = {
  Su: 'your sense of purpose and authority',
  Mo: 'your feelings and your mind',
  Ma: 'your drive and courage',
  Me: 'your thinking and speech',
  Ju: 'your judgement, wisdom and faith',
  Ve: 'your pleasures, art and closeness',
  Sa: 'your discipline, duty and endurance',
  Ra: 'your hunger for the new and the unconventional',
  Ke: 'your detachment and inner search',
};

/** Shown only in Chart details. */
export const PLANET_NAME: Record<string, string> = {
  Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu',
};

/** The engine's dignity labels, in plain words. */
export function dignityWords(d: string | null | undefined): string | null {
  const v = (d ?? '').toLowerCase();
  if (!v) return null;
  if (v.includes('exalt')) return 'at its strongest';
  if (v.includes('debil')) return 'at its weakest';
  if (v.includes('moola') || v === 'own' || v.includes('own')) return 'at home';
  if (v.includes('great') && v.includes('friend')) return 'well placed';
  if (v.includes('friend')) return 'comfortable';
  if (v.includes('great') && v.includes('enem')) return 'hard pressed';
  if (v.includes('enem')) return 'uneasy';
  if (v.includes('neutral')) return 'neither helped nor hindered';
  return null;
}

/** The engine's avastha ripeness labels (avasthas.dasha delivery), in plain words. */
export const RIPENESS_WORDS: Record<string, string> = {
  fully_ripe_sweet: 'gives its results fully',
  half_ripe: 'gives about half of what it promises',
  unripe_sour: 'gives its results early and raw',
  over_ripe_delayed: 'gives its results late',
  dried_seed_externalized: 'spends itself mostly on the people around you',
};

/** The engine's antardasha-from-mahadasha fruition classes (dasha_charter), in plain words. */
export const FRUITION_WORDS: Record<string, string> = {
  trikona_manifestation: 'what you started comes to fruit',
  kendra_structural: 'something lasting gets built',
  dhana_labha_gain: 'it brings gains',
  upachaya_effort: 'steady effort is rewarded',
  dusthana_reversal_crisis: 'things reverse and test you',
};

/** Yoga classes as the digest labels them, in plain words. */
export function yogaClassWords(cls: string): { kind: 'gift' | 'knot'; words: string } {
  const c = cls.toLowerCase();
  if (c.includes('raja') || c.includes('mahapurusha')) return { kind: 'gift', words: 'a combination for rank and influence' };
  if (c.includes('dhana')) return { kind: 'gift', words: 'a combination for wealth' };
  if (c.includes('viparita')) return { kind: 'gift', words: 'a reversal that turns setbacks into gains' };
  if (c.includes('cancel')) return { kind: 'gift', words: 'a cancellation that lifts a weakness over time' };
  if (c.includes('dosha') || c.includes('afflict')) return { kind: 'knot', words: 'a knot that asks for patience' };
  return { kind: 'gift', words: 'a named combination' };
}

/** Catalogue dasha ids to the names people use (shown on the clock line). */
export const CLOCK_LABEL: Record<string, string> = {
  vimsottari: 'Vimshottari',
  dwisatpathi: 'Dwisaptati Sama',
  ashtottari: 'Ashtottari',
  chathuraaseethi_sama: 'Chaturaseeti Sama',
  dwadasottari: 'Dwadashottari',
  panchottari: 'Panchottari',
  sataatbika: 'Shatabdika',
  shastihayani: 'Shashtihayani',
  shodasottari: 'Shodashottari',
  shattrimsa_sama: 'Shattrimsha Sama',
  narayana: 'Narayana',
  chara: 'Chara',
  sudasa: 'Sudasa',
  yogini: 'Yogini',
  karaka: 'Chara Karaka',
  kaala: 'Kaala',
  tithi_ashtottari: 'Tithi Ashtottari',
};

export function clockLabel(system: string): string {
  return CLOCK_LABEL[system] ?? system.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/** "a, b and c" */
export function joinWords(parts: readonly string[]): string {
  const p = parts.filter(Boolean);
  if (p.length <= 1) return p[0] ?? '';
  return `${p.slice(0, -1).join(', ')} and ${p.at(-1)}`;
}

export function faculties(planets: readonly string[]): string {
  return joinWords(planets.map((p) => PLANET_FACULTY[p]).filter((x): x is string => !!x));
}

export function housesShort(houses: readonly number[]): string {
  return joinWords([...new Set(houses)].sort((a, b) => a - b).map((h) => HOUSE_SHORT[h]).filter((x): x is string => !!x));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 2019-02-16 → "16 Feb 2019" */
export function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** The one-tap confirm questions, by house the running sub-chapter activates, in the order they are tried (doc 48 §4.1). */
export const CONFIRM_BY_HOUSE: Array<{ houses: number[]; text: string }> = [
  { houses: [10], text: 'Did something change at work recently?' },
  { houses: [4, 12], text: 'Have you moved recently, or been thinking about moving?' },
  { houses: [7], text: 'Has something shifted with a partner or a close collaborator?' },
  { houses: [2, 11], text: 'Did money shift lately, coming in or going out?' },
  { houses: [6, 8], text: 'Has your health or your daily routine needed more attention lately?' },
  { houses: [5], text: 'Have you started something new to learn or to create?' },
  { houses: [3], text: 'Have you been pushing hard on something by your own effort?' },
  { houses: [9], text: 'Has a teacher, a belief or your father been on your mind lately?' },
  { houses: [1], text: 'Does it feel like a new chapter of your life has started?' },
];
