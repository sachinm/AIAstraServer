/**
 * Astrological tables for the chart-facts dossier. Ported from pyjhora `const.py` / `house.py` so the Node
 * dossier agrees with the calc engine; where pyjhora is known to deviate from Parashara (Rahu dignity row)
 * the classical value is used and noted.
 */

export const PLANET_CODES = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'] as const;
export type PlanetCode = (typeof PLANET_CODES)[number];
export const LAGNA_CODE = 'La';
export const PLANET_NAMES: Record<PlanetCode, string> = {
  Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu',
};
export const PLANET_INDEX: Record<PlanetCode, number> = { Su: 0, Mo: 1, Ma: 2, Me: 3, Ju: 4, Ve: 5, Sa: 6, Ra: 7, Ke: 8 };

export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
export const SIGN_SHORT = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'] as const;
/** Classical sign lords Aries..Pisces */
export const SIGN_LORDS: PlanetCode[] = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];
/** Jaimini co-lords: Scorpio → Ketu, Aquarius → Rahu */
export const CO_LORDS: Partial<Record<number, PlanetCode>> = { 7: 'Ke', 10: 'Ra' };
export const MOVABLE_SIGNS = [0, 3, 6, 9];
export const FIXED_SIGNS = [1, 4, 7, 10];
export const DUAL_SIGNS = [2, 5, 8, 11];

export const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
] as const;
const NAK_LORD_CYCLE: PlanetCode[] = ['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me'];
export const NAKSHATRA_LORDS: PlanetCode[] = Array.from({ length: 27 }, (_, i) => NAK_LORD_CYCLE[i % 9]!);
export const NAKSHATRA_DEITIES = [
  'Ashwini Kumaras', 'Yama', 'Agni', 'Brahma', 'Soma', 'Rudra', 'Aditi', 'Brihaspati', 'Sarpas',
  'Pitris', 'Bhaga', 'Aryaman', 'Savitar', 'Tvashtar', 'Vayu', 'Indra-Agni', 'Mitra', 'Indra',
  'Nirriti', 'Apas', 'Vishvadevas', 'Vishnu', 'Vasus', 'Varuna', 'Aja Ekapada', 'Ahir Budhnya', 'Pushan',
] as const;
export const NAKSHATRA_GANA = [
  'Deva', 'Manushya', 'Rakshasa', 'Manushya', 'Deva', 'Manushya', 'Deva', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya', 'Deva',
] as const;
export const NAKSHATRA_SYMBOLS = [
  "Horse's head", 'Yoni', 'Razor / flame', 'Cart / chariot', "Deer's head", 'Teardrop / gem', 'Bow and quiver',
  "Cow's udder / lotus", 'Coiled serpent', 'Royal throne', 'Front legs of a bed', 'Back legs of a bed',
  'Hand / fist', 'Pearl / jewel', 'Young plant swaying in wind', "Triumphal arch / potter's wheel",
  'Lotus / umbrella', 'Earring / umbrella', "Bunch of roots / lion's tail", 'Elephant tusk / fan', 'Elephant tusk / small bed',
  'Ear / three footprints', 'Drum / flute', 'Empty circle / 1000 flowers', 'Sword / two front legs of funeral cot',
  'Twins / back legs of funeral cot', 'Fish / drum',
] as const;
export const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Vadha', 'Mitra', 'Ati-mitra'] as const;
export const FAVOURABLE_TARAS = new Set(['Sampat', 'Kshema', 'Sadhaka', 'Mitra', 'Ati-mitra']);
/** Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati (0-based) */
export const GANDA_MOOLA_NAKS = new Set([0, 8, 9, 17, 18, 26]);

export const KARAKA_CODES = ['AK', 'AmK', 'BK', 'MK', 'PiK', 'PK', 'GK', 'DK'] as const;

export const TITHI_NAMES = [
  'Pratipat', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami',
  'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima',
] as const;
export const YOGA_NAMES = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula',
  'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
] as const;
export const KARANA_CYCLE = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti'] as const;
export const KARANA_FIXED: Record<number, string> = { 1: 'Kimstughna', 58: 'Shakuni', 59: 'Chatushpada', 60: 'Naga' };
export const VARA_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const VARA_LORDS: PlanetCode[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];

export const KENDRAS = [1, 4, 7, 10];
export const TRIKONAS = [1, 5, 9];
export const UPACHAYAS = [3, 6, 10, 11];
export const DUSTHANAS = [6, 8, 12];
export const MARAKA_HOUSES = [2, 7];
export const PANAPARA = [2, 5, 8, 11];
export const APOKLIMA = [3, 6, 9, 12];

/**
 * Dignity strength per planet (row) and sign (col): 5 own, 4 exalted, 3 friend, 2 neutral, 1 enemy, 0 debilitated.
 * pyjhora `house_strengths_of_planets` for Su..Sa and Ketu; Rahu row is Ketu's shifted by six signs so that Rahu is
 * exalted in Taurus and debilitated in Scorpio (classical), which pyjhora gets backwards.
 */
const KETU_ROW = [1, 0, 3, 1, 1, 3, 3, 4, 3, 3, 1, 3];
export const DIGNITY_TABLE: Record<PlanetCode, number[]> = {
  Su: [4, 1, 2, 2, 5, 2, 0, 3, 3, 1, 1, 3],
  Mo: [2, 4, 3, 5, 3, 3, 2, 0, 2, 2, 2, 2],
  Ma: [5, 2, 1, 0, 3, 1, 2, 5, 3, 4, 2, 3],
  Me: [2, 3, 5, 1, 3, 5, 3, 2, 2, 2, 2, 0],
  Ju: [3, 1, 1, 4, 3, 3, 1, 3, 5, 0, 2, 5],
  Ve: [2, 5, 3, 1, 1, 0, 5, 2, 3, 3, 3, 4],
  Sa: [0, 3, 3, 1, 1, 3, 4, 1, 2, 5, 5, 2],
  Ra: Array.from({ length: 12 }, (_, s) => KETU_ROW[(s + 6) % 12]!),
  Ke: KETU_ROW,
};
export const DIGNITY_NAMES: Record<number, string> = { 5: 'own', 4: 'exalted', 3: 'friend', 2: 'neutral', 1: 'enemy', 0: 'debilitated' };
/** Moolatrikona sign per planet Su..Sa */
export const MOOLATRIKONA: Partial<Record<PlanetCode, number>> = { Su: 4, Mo: 1, Ma: 0, Me: 5, Ju: 8, Ve: 6, Sa: 10 };

/** Parashari graha drishti: houses (counted from the planet) that receive a full aspect. */
export const GRAHA_DRISHTI: Record<PlanetCode, number[]> = {
  Su: [7], Mo: [7], Ma: [4, 7, 8], Me: [7], Ju: [5, 7, 9], Ve: [7], Sa: [3, 7, 10], Ra: [7], Ke: [7],
};

/** Jaimini rasi drishti: signs aspected by a sign. */
export function rasiDrishtiOf(sign: number): number[] {
  if (MOVABLE_SIGNS.includes(sign)) return FIXED_SIGNS.filter((f) => f !== sign + 1 && f !== sign - 1);
  if (FIXED_SIGNS.includes(sign)) return MOVABLE_SIGNS.filter((m) => m !== sign + 1 && m !== sign - 1);
  return DUAL_SIGNS.filter((d) => d !== sign);
}

/** Argala from a house: planets in 2nd, 4th, 11th (primary) and 5th (secondary); obstruction from 12th, 10th, 3rd, 9th. */
export const ARGALA_PRIMARY = [2, 4, 11];
export const ARGALA_SECONDARY = [5];
export const VIRODHARGALA = [12, 10, 3, 9];

/** Elongation-from-Sun windows in which Ma, Me, Ju, Ve, Sa are retrograde (pyjhora chart-based rule). */
export const RETRO_LIMITS_FROM_SUN: Partial<Record<PlanetCode, [number, number]>> = {
  Ma: [164, 196], Me: [144, 216], Ju: [130, 230], Ve: [163, 197], Sa: [115, 245],
};
/** Combustion orb from the Sun (deg) for Mo, Ma, Me, Ju, Ve, Sa; second row while retrograde. */
export const COMBUSTION_ORB: Partial<Record<PlanetCode, [number, number]>> = {
  Mo: [12, 12], Ma: [17, 8], Me: [14, 12], Ju: [10, 11], Ve: [11, 8], Sa: [15, 16],
};

/** Vimshottari */
export const VIMSHOTTARI_ORDER: PlanetCode[] = ['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me'];
export const VIMSHOTTARI_YEARS: Record<PlanetCode, number> = { Ke: 7, Ve: 20, Su: 6, Mo: 10, Ma: 7, Ra: 18, Ju: 16, Sa: 19, Me: 17 };
export const SIDEREAL_YEAR_DAYS = 365.256364;

/**
 * Ashtakavarga bindu rules (pyjhora `ashtaka_varga_dict`): for each planet (Su..Sa, 7 = Lagna table), the list of
 * houses (counted from each contributor Su, Mo, Ma, Me, Ju, Ve, Sa, Lagna) that receive a bindu.
 */
export const ASHTAKAVARGA_RULES: number[][][] = [
  [[1, 2, 4, 7, 8, 9, 10, 11], [3, 6, 10, 11], [1, 2, 4, 7, 8, 9, 10, 11], [3, 5, 6, 9, 10, 11, 12], [5, 6, 9, 11], [6, 7, 12], [1, 2, 4, 7, 8, 9, 10, 11], [3, 4, 6, 10, 11, 12]],
  [[3, 6, 7, 8, 10, 11], [1, 3, 6, 7, 9, 10, 11], [2, 3, 5, 6, 10, 11], [1, 3, 4, 5, 7, 8, 10, 11], [1, 2, 4, 7, 8, 10, 11], [3, 4, 5, 7, 9, 10, 11], [3, 5, 6, 11], [3, 6, 10, 11]],
  [[3, 5, 6, 10, 11], [3, 6, 11], [1, 2, 4, 7, 8, 10, 11], [3, 5, 6, 11], [6, 10, 11, 12], [6, 8, 11, 12], [1, 4, 7, 8, 9, 10, 11], [1, 3, 6, 10, 11]],
  [[5, 6, 9, 11, 12], [2, 4, 6, 8, 10, 11], [1, 2, 4, 7, 8, 9, 10, 11], [1, 3, 5, 6, 9, 10, 11, 12], [6, 8, 11, 12], [1, 2, 3, 4, 5, 8, 9, 11], [1, 2, 4, 7, 8, 9, 10, 11], [1, 2, 4, 6, 8, 10, 11]],
  [[1, 2, 3, 4, 7, 8, 9, 10, 11], [2, 5, 7, 9, 11], [1, 2, 4, 7, 8, 10, 11], [1, 2, 4, 5, 6, 9, 10, 11], [1, 2, 3, 4, 7, 8, 10, 11], [2, 5, 6, 9, 10, 11], [3, 5, 6, 12], [1, 2, 4, 5, 6, 7, 9, 10, 11]],
  [[8, 11, 12], [1, 2, 3, 4, 5, 8, 9, 11, 12], [3, 4, 6, 9, 11, 12], [3, 5, 6, 9, 11], [5, 8, 9, 10, 11], [1, 2, 3, 4, 5, 8, 9, 10, 11], [3, 4, 5, 8, 9, 10, 11], [1, 2, 3, 4, 5, 8, 9, 11]],
  [[1, 2, 4, 7, 8, 10, 11], [3, 6, 11], [3, 5, 6, 10, 11, 12], [6, 8, 9, 10, 11, 12], [5, 6, 11, 12], [6, 11, 12], [3, 5, 6, 11], [1, 3, 4, 6, 10, 11]],
  [[3, 4, 6, 10, 11, 12], [3, 6, 10, 11, 12], [1, 3, 6, 10, 11], [1, 2, 4, 6, 8, 10, 11], [1, 2, 4, 5, 6, 7, 9, 10, 11], [1, 2, 3, 4, 5, 8, 9], [1, 3, 4, 6, 10, 11], [3, 6, 10, 11]],
];

/** Pushkara navamsa start degree per sign (two 3°20′ bands each) and pushkara bhaga degree per sign (pyjhora). */
export const PUSHKARA_NAVAMSA_START = [20, 6 + 40 / 60, 16 + 40 / 60, 0, 20, 6 + 40 / 60, 16 + 40 / 60, 0, 20, 6 + 40 / 60, 16 + 40 / 60, 0];
export const PUSHKARA_BHAGA = [21, 14, 24, 7, 21, 14, 24, 7, 21, 14, 24, 7];

export const NATURAL_KARAKAS: Record<PlanetCode, string[]> = {
  Su: ['father', 'authority', 'soul', 'vitality'],
  Mo: ['mother', 'mind', 'public', 'comfort'],
  Ma: ['siblings', 'land', 'courage', 'energy'],
  Me: ['intellect', 'trade', 'speech', 'learning'],
  Ju: ['wealth', 'children', 'dharma', 'counsel', 'husband'],
  Ve: ['spouse', 'comforts', 'vehicles', 'arts'],
  Sa: ['work', 'longevity', 'discipline', 'delay'],
  Ra: ['foreign', 'obsession', 'speculation'],
  Ke: ['moksha', 'detachment', 'research'],
};

export const VARGA_KEYS = ['D1', 'D2', 'D4', 'D7', 'D9', 'D10'] as const;
export type VargaKey = (typeof VARGA_KEYS)[number];
export const VARGA_NAMES: Record<VargaKey, string> = {
  D1: 'Rasi', D2: 'Hora', D4: 'Chaturthamsa', D7: 'Saptamsa', D9: 'Navamsa', D10: 'Dasamsa',
};
