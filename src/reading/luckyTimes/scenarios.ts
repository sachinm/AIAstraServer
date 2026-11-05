/**
 * The v1 scenarios of Lucky times (docs/reading-engine/49 §3): only those whose every rule reads a field the engine's
 * `muhurta` day row already holds. This is rule configuration with its source, not a computation: each set below lists
 * engine-returned numbers and names (tithi number 1–30, star number 1–27, weekday name, hora lord) that a classical
 * muhurta text favours or avoids for the act. Doc 47 §3.4a has the full table; clauses that need choghadiya, Mercury's
 * motion or disha shool wait for the engine pass and are not used here.
 *
 * Sources: Muhurta Chintamani (tithi groups Nanda/Bhadra/Jaya/Rikta/Purna; star groups fixed, moving, quick, soft,
 * fierce, sharp, mixed); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial (hora lords and their acts).
 * TODO(engine pass): the tithi and star group of a day should come from the engine; filed in docs/TODOS.md.
 */

export type Area = 'work' | 'love' | 'money' | 'travel' | 'study' | 'home';
export type TithiGroup = 'nanda' | 'bhadra' | 'jaya' | 'rikta' | 'purna' | 'amavasya';
export type StarGroup = 'fixed' | 'moving' | 'quick' | 'soft' | 'fierce' | 'sharp' | 'mixed';
export type Lord = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn';
export type Weekday = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

/** Muhurta Chintamani's tithi groups, by the engine's tithi number (1–15 waxing, 16–30 waning; 30 = new Moon). */
export const TITHI_GROUPS: Record<TithiGroup, number[]> = {
  nanda: [1, 6, 11, 16, 21, 26],
  bhadra: [2, 7, 12, 17, 22, 27],
  jaya: [3, 8, 13, 18, 23, 28],
  rikta: [4, 9, 14, 19, 24, 29],
  purna: [5, 10, 15, 20, 25],
  amavasya: [30],
};

/** Muhurta Chintamani's star groups, by the engine's star number (1 Ashwini … 27 Revati). */
export const STAR_GROUPS: Record<StarGroup, number[]> = {
  fixed: [4, 12, 21, 26], // Rohini, Uttara Phalguni, Uttara Ashadha, Uttara Bhadrapada
  moving: [7, 15, 22, 23, 24], // Punarvasu, Swati, Shravana, Dhanishta, Shatabhisha
  quick: [1, 8, 13], // Ashwini, Pushya, Hasta
  soft: [5, 14, 17, 27], // Mrigashira, Chitra, Anuradha, Revati
  fierce: [2, 10, 11, 20, 25], // Bharani, Magha, Purva Phalguni, Purva Ashadha, Purva Bhadrapada
  sharp: [6, 9, 18, 19], // Ardra, Ashlesha, Jyeshtha, Moola
  mixed: [3, 16], // Krittika, Vishakha
};

export interface ScenarioRule {
  id: string;
  area: Area;
  label: string;
  /** the one-tap question asked before the first layer (doc 45 rule 13), if the act depends on the situation */
  ask?: 'who' | 'job' | 'relationship';
  tithiFavour: TithiGroup[];
  tithiAvoid: TithiGroup[];
  starFavour: StarGroup[];
  starAvoid: StarGroup[];
  dayFavour: Weekday[];
  dayAvoid: Weekday[];
  horaFavour: Lord[];
  horaAvoid: Lord[];
  /** local hours the act is done in: [from, to) in hours from midnight; 'sunrise' starts at that day's sunrise */
  hours: ['sunrise' | number, number];
  /** brahma muhurta counts as a good window for a first step */
  useBrahma?: boolean;
  /** a piece must score at least this to be shown */
  floor: number;
  source: string;
  /** plain words used in the Why sheet when a rule is dropped in v1 */
  v1Note?: string;
}

const CLASSIC = 'Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial';

export const SCENARIOS: ScenarioRule[] = [
  {
    id: 'work.sign_contract', area: 'work', label: 'Sign a contract',
    tithiFavour: ['bhadra', 'purna'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['fixed'], starAvoid: ['fierce', 'sharp'],
    dayFavour: ['Thursday', 'Wednesday'], dayAvoid: ['Saturday', 'Tuesday'],
    horaFavour: ['Jupiter', 'Mercury'], horaAvoid: ['Saturn', 'Mars'],
    hours: ['sunrise', 19], floor: 3, source: CLASSIC,
    v1Note: "Mercury's motion is not yet checked; avoid signing while it moves backward.",
  },
  {
    id: 'work.send_resume', area: 'work', label: 'Send a resume or application', ask: 'job',
    tithiFavour: ['bhadra', 'nanda'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['quick', 'moving'], starAvoid: ['sharp'],
    dayFavour: ['Wednesday', 'Thursday', 'Sunday'], dayAvoid: [],
    horaFavour: ['Mercury', 'Sun', 'Jupiter'], horaAvoid: ['Saturn'],
    hours: ['sunrise', 20], floor: 3, source: CLASSIC,
  },
  {
    id: 'work.interview', area: 'work', label: 'Interview or pitch', ask: 'job',
    tithiFavour: ['jaya', 'bhadra'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['quick', 'soft'], starAvoid: ['fierce'],
    dayFavour: ['Thursday', 'Sunday', 'Wednesday'], dayAvoid: [],
    horaFavour: ['Sun', 'Jupiter'], horaAvoid: ['Saturn', 'Mars'],
    hours: ['sunrise', 18], floor: 3, source: CLASSIC,
  },
  {
    id: 'work.ask_raise', area: 'work', label: 'Ask for a raise', ask: 'job',
    tithiFavour: ['purna', 'jaya'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['fixed', 'quick'], starAvoid: ['sharp', 'fierce'],
    dayFavour: ['Thursday'], dayAvoid: ['Saturday'],
    horaFavour: ['Jupiter', 'Sun'], horaAvoid: ['Saturn'],
    hours: ['sunrise', 18], floor: 3, source: CLASSIC,
  },
  {
    id: 'work.start_project', area: 'work', label: 'Start a project',
    tithiFavour: ['bhadra', 'nanda'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['quick', 'fixed'], starAvoid: ['sharp'],
    dayFavour: ['Monday', 'Wednesday', 'Thursday'], dayAvoid: [],
    horaFavour: ['Jupiter', 'Mercury', 'Moon'], horaAvoid: ['Saturn'],
    hours: ['sunrise', 20], useBrahma: true, floor: 3, source: CLASSIC,
  },
  {
    id: 'work.hard_talk_boss', area: 'work', label: 'A hard talk with the boss', ask: 'who',
    tithiFavour: ['nanda'], tithiAvoid: ['jaya', 'amavasya'],
    starFavour: ['soft', 'fixed'], starAvoid: ['fierce', 'sharp'],
    dayFavour: ['Monday', 'Thursday'], dayAvoid: ['Tuesday'],
    horaFavour: ['Moon', 'Jupiter', 'Venus'], horaAvoid: ['Mars', 'Saturn'],
    hours: ['sunrise', 18], floor: 3, source: CLASSIC,
  },
  {
    id: 'love.ask_out', area: 'love', label: 'Ask someone out', ask: 'relationship',
    tithiFavour: ['nanda', 'bhadra'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['soft'], starAvoid: ['fierce', 'sharp'],
    dayFavour: ['Friday', 'Wednesday'], dayAvoid: ['Tuesday', 'Saturday'],
    horaFavour: ['Venus', 'Mercury', 'Moon'], horaAvoid: ['Mars', 'Saturn'],
    hours: [9, 22], floor: 3, source: CLASSIC,
  },
  {
    id: 'love.first_date', area: 'love', label: 'A first date', ask: 'relationship',
    tithiFavour: ['nanda'], tithiAvoid: ['amavasya'],
    starFavour: ['soft'], starAvoid: ['sharp'],
    dayFavour: ['Friday'], dayAvoid: [],
    horaFavour: ['Venus', 'Moon'], horaAvoid: ['Mars', 'Saturn'],
    hours: [11, 22], floor: 3, source: CLASSIC,
  },
  {
    id: 'love.clear_air', area: 'love', label: 'Clear the air', ask: 'relationship',
    tithiFavour: ['nanda'], tithiAvoid: ['jaya'],
    starFavour: ['soft', 'fixed'], starAvoid: ['fierce'],
    dayFavour: ['Monday', 'Friday'], dayAvoid: ['Tuesday'],
    horaFavour: ['Moon', 'Venus'], horaAvoid: ['Mars'],
    hours: [9, 22], floor: 3, source: CLASSIC,
  },
  {
    id: 'money.invest_buy', area: 'money', label: 'Invest or buy',
    tithiFavour: ['bhadra', 'purna'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['fixed'], starAvoid: ['sharp', 'fierce'],
    dayFavour: ['Thursday', 'Wednesday'], dayAvoid: [],
    horaFavour: ['Jupiter', 'Mercury'], horaAvoid: ['Saturn'],
    hours: ['sunrise', 19], floor: 3, source: CLASSIC,
    v1Note: "Mercury's motion is not yet checked.",
  },
  {
    id: 'travel.set_out', area: 'travel', label: 'Set out on a journey',
    tithiFavour: ['bhadra', 'nanda'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['moving', 'quick'], starAvoid: ['sharp'],
    dayFavour: [], dayAvoid: [],
    horaFavour: ['Moon', 'Venus', 'Mercury'], horaAvoid: ['Saturn'],
    hours: ['sunrise', 21], floor: 3, source: CLASSIC,
    v1Note: 'The direction rule for each weekday is not yet applied.',
  },
  {
    id: 'study.exam_submit', area: 'study', label: 'Exam or submit',
    tithiFavour: ['jaya', 'purna'], tithiAvoid: ['rikta'],
    starFavour: ['quick'], starAvoid: ['sharp'],
    dayFavour: ['Wednesday', 'Thursday'], dayAvoid: [],
    horaFavour: ['Mercury', 'Jupiter'], horaAvoid: [],
    hours: ['sunrise', 20], floor: 3, source: CLASSIC,
  },
  {
    id: 'home.start_routine', area: 'home', label: 'Start a routine',
    tithiFavour: ['bhadra'], tithiAvoid: ['rikta', 'amavasya'],
    starFavour: ['fixed', 'quick'], starAvoid: [],
    dayFavour: ['Monday', 'Thursday'], dayAvoid: [],
    horaFavour: ['Sun', 'Moon', 'Jupiter'], horaAvoid: [],
    hours: ['sunrise', 12], useBrahma: true, floor: 3, source: CLASSIC,
  },
];

export const AREA_LABELS: Record<Area, string> = { work: 'Work', love: 'Love', money: 'Money', travel: 'Travel', study: 'Study', home: 'Home' };

export function scenarioById(id: string): ScenarioRule | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function tithiGroupOf(n: number): TithiGroup | null {
  for (const [g, list] of Object.entries(TITHI_GROUPS)) if (list.includes(n)) return g as TithiGroup;
  return null;
}

export function starGroupOf(n: number): StarGroup | null {
  for (const [g, list] of Object.entries(STAR_GROUPS)) if (list.includes(n)) return g as StarGroup;
  return null;
}

/** The catalog shown in the Add drop-down, grouped by area. */
export function scenarioCatalog() {
  return (Object.keys(AREA_LABELS) as Area[]).map((area) => ({
    area,
    label: AREA_LABELS[area],
    scenarios: SCENARIOS.filter((s) => s.area === area).map((s) => ({ id: s.id, label: s.label, ask: s.ask ?? null })),
  }));
}
