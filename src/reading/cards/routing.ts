/**
 * Card routing (docs/techniques/08, plan docs/techniques/09 §4 "Chart routing", doc 07 §4.2): for each of the 90
 * readable cards (21 Self, 36 Love, 33 Work), the lens it is read through, its subject houses, the charts that hold its
 * promise, the sign dasha that confirms its timing, the year charts read in the Tithi Pravesha year, and the points
 * (arudhas, karakas) it is read from. Plus the lens recipe text the lens lineman and the card Oracle read.
 *
 * Selection only: a data table copied from doc 08. Nothing here computes anything astrological (no house count, no
 * lookup of a lord); the engine supplies every placement and the model reads them.
 *
 * Chart strings are "D1", "D9", "D10", ... . `promiseCharts` always starts with "D1", "D9"; any chart after them is the
 * card's own divisional chart(s). `yearCharts` starts with the year D1 (read first, doc 07 decision 2), then the year
 * chart of the card's own subject.
 *
 * `signDasha` names the sign dasha by the chart it is cast on: "Narayana D1", "Narayana D9", "Narayana D10", with
 * " + Sudasa" on the money cards. A divisional-chart Narayana starts from the sign that the D1 lord of that chart's
 * controlling house occupies in the divisional chart (`NARAYANA_CONTROLLING_HOUSE`; Rath, *Narayana Dasa* Table 29 and
 * pp.114-115). The engine does not cast it yet (doc 07 E5): until it does, the reading uses Narayana D1 and says so.
 *
 * Corrections applied (doc 09 §4, 2026-11-19): romance is read from the 5th, Venus, the D9 and the A7, never the D7 (the
 * D7 is for children only); friends are read from the 11th from the lagna and from the AL, never "A5 from AL" (the A5 is
 * the mantra pada) and never the D11; the D30 appears only on the Self body cards, for strain words only.
 */
import { PROMPTS } from '../prompts/generated.js';

export type LensId =
  | 'self.temperament'
  | 'self.mind'
  | 'self.purpose'
  | 'self.body'
  | 'self.chapter'
  | 'love.dating'
  | 'love.marriage'
  | 'love.friends'
  | 'love.allies'
  | 'work.career_start'
  | 'work.primary_job'
  | 'work.hobby'
  | 'work.business';

export const LENS_IDS: readonly LensId[] = [
  'self.temperament',
  'self.mind',
  'self.purpose',
  'self.body',
  'self.chapter',
  'love.dating',
  'love.marriage',
  'love.friends',
  'love.allies',
  'work.career_start',
  'work.primary_job',
  'work.hobby',
  'work.business',
];

export interface CardRoute {
  card: string;
  board: 'self' | 'love' | 'work';
  lens: LensId;
  houses: number[];
  promiseCharts: string[];
  signDasha: string;
  yearCharts: string[];
  points: string[];
}

/**
 * The house of the D1 whose lord seeds a divisional chart's Narayana dasha (Rath, *Narayana Dasa* Table 29, p.119;
 * docs/deep-research/sanjay-rath/04 §2, 06 §4). The seed sign is the sign that lord occupies in the divisional chart.
 */
export const NARAYANA_CONTROLLING_HOUSE: Readonly<Record<string, number>> = {
  D2: 2,
  D3: 3,
  D4: 4,
  D7: 7,
  D9: 9,
  D10: 10,
  D12: 12,
  D16: 4,
  D20: 8,
  D24: 4,
  D30: 6,
};

type LensDefaults = Omit<CardRoute, 'card' | 'houses' | 'lens' | 'board'>;

const NATAL = ['D1', 'D9'];

/** Each lens's charts, sign dasha, year charts and points; a card row overrides any of them. */
const LENS: Record<LensId, LensDefaults> = {
  'self.temperament': { promiseCharts: [...NATAL], signDasha: 'Narayana D1', yearCharts: ['D1', 'D9'], points: ['AL', 'AK', 'Sun'] },
  'self.mind': { promiseCharts: [...NATAL, 'D24'], signDasha: 'Narayana D1', yearCharts: ['D1', 'D24'], points: ['Moon', 'Lagna lord star lord', 'Mercury'] },
  'self.purpose': { promiseCharts: [...NATAL, 'D20'], signDasha: 'Narayana D1', yearCharts: ['D1', 'D20'], points: ['AK', 'Karakamsa', 'AL'] },
  'self.body': { promiseCharts: [...NATAL, 'D30'], signDasha: 'Narayana D1', yearCharts: ['D1'], points: ['Lagna lord', 'Paka lagna', 'Sun'] },
  'self.chapter': { promiseCharts: [...NATAL], signDasha: 'Narayana D1', yearCharts: ['D1', 'D9'], points: ['Lagna lord', 'AL'] },
  'love.dating': { promiseCharts: [...NATAL], signDasha: 'Narayana D1', yearCharts: ['D1', 'D9'], points: ['Venus', 'A7', 'UL'] },
  'love.marriage': { promiseCharts: [...NATAL], signDasha: 'Narayana D9', yearCharts: ['D1', 'D9'], points: ['UL', 'A7', 'DK', 'Venus'] },
  'love.friends': { promiseCharts: [...NATAL], signDasha: 'Narayana D1', yearCharts: ['D1'], points: ['AL'] },
  'love.allies': { promiseCharts: [...NATAL, 'D10'], signDasha: 'Narayana D10', yearCharts: ['D1', 'D10'], points: ['A10', 'A7'] },
  'work.career_start': { promiseCharts: [...NATAL, 'D10'], signDasha: 'Narayana D10', yearCharts: ['D1', 'D10'], points: ['A10', 'AL', 'AmK'] },
  'work.primary_job': { promiseCharts: [...NATAL, 'D10'], signDasha: 'Narayana D10', yearCharts: ['D1', 'D10'], points: ['AL', 'A10', 'AmK'] },
  'work.hobby': { promiseCharts: [...NATAL, 'D24'], signDasha: 'Narayana D1', yearCharts: ['D1'], points: ['Mercury', 'Venus'] },
  'work.business': { promiseCharts: [...NATAL, 'D10'], signDasha: 'Narayana D10', yearCharts: ['D1', 'D10'], points: ['A7', 'A10', 'AL'] },
};

type Row = [card: string, lens: LensId, houses: number[], override?: Partial<LensDefaults>];

const SUDASA = ' + Sudasa';
const HAPPINESS: Partial<LensDefaults> = { promiseCharts: [...NATAL, 'D16'], yearCharts: ['D1', 'D16'], points: ['Moon', 'Lagna lord star lord'] };

/** The 90 rows of doc 08, in registry order. */
const ROWS: readonly Row[] = [
  // Self (21): src/reading/self/v3/cards.ts READABLE_CARDS
  ['body', 'self.body', [1, 6, 8]],
  ['fitness', 'self.body', [3, 1, 6], { points: ['Lagna lord', 'Paka lagna', 'Mars'] }],
  ['sleep', 'self.body', [12, 4, 1], { points: ['Lagna lord', 'Paka lagna', 'Moon'] }],
  ['blood', 'self.body', [1, 6, 8, 3], { points: ['Lagna lord', 'Paka lagna', 'Sun', 'Mars'] }],
  ['mind', 'self.mind', [4, 5, 1]],
  ['sharpness', 'self.mind', [5, 3, 10], { points: ['Mercury', 'Moon', 'Lagna lord star lord'] }],
  ['mood', 'self.mind', [4, 12, 1], HAPPINESS],
  ['stuck', 'self.mind', [6, 8, 12], { promiseCharts: [...NATAL], yearCharts: ['D1', 'D9'], points: ['Moon', 'AL'] }],
  ['restores', 'self.mind', [4, 12, 9], HAPPINESS],
  ['play', 'self.mind', [5, 11, 3, 4], { ...HAPPINESS, points: ['Moon', 'Venus'] }],
  ['diagnosis', 'self.chapter', [1, 10, 6]],
  ['lagna', 'self.temperament', [1, 7, 10], { points: ['AL', 'Sree Lagna', 'AK', 'Sun'] }],
  ['drive', 'self.purpose', [10, 3, 11, 9, 12], { promiseCharts: [...NATAL, 'D10'], yearCharts: ['D1', 'D10'], points: ['AK', 'Karakamsa', 'AmK'] }],
  ['presence', 'self.temperament', [1, 7, 2, 4], { points: ['AL', 'Moon'] }],
  ['yogas', 'self.temperament', [9, 10, 2], { promiseCharts: [...NATAL, 'D5', 'D10'], points: ['AL', 'A7', 'AK', 'HL', 'GL'] }],
  ['purpose', 'self.purpose', [9, 5, 12]],
  ['learning', 'self.mind', [4, 5, 9, 3], { points: ['Mercury', 'Jupiter', 'Karakamsa'] }],
  ['layers', 'self.body', [1, 4, 9, 12], { promiseCharts: [...NATAL], yearCharts: ['D1', 'D9'], points: ['Lagna lord', 'Sun', 'Moon', 'Mercury', 'Jupiter'] }],
  ['chapter', 'self.chapter', [10, 1, 4]],
  ['chapters', 'self.chapter', [10, 9, 1]],
  ['year', 'self.chapter', [1, 10, 11]],

  // Love · Dating (10)
  ['dating_pulse', 'love.dating', [5, 11, 12]],
  ['dating_meeting_timing', 'love.dating', [5, 7, 11], { points: ['Venus', 'A7', 'UL', 'DK'] }],
  ['dating_delays_blocks', 'love.dating', [5, 7, 8]],
  ['dating_attraction_pattern', 'love.dating', [5, 7], { points: ['Venus', 'A7', 'UL', 'DK'] }],
  ['dating_mixed_signals', 'love.dating', [5, 12, 3, 7], { points: ['Venus', 'A7', 'AL'] }],
  ['dating_exes_closure', 'love.dating', [8, 12, 5, 7]],
  ['dating_karmic_compatibility', 'love.dating', [5, 8, 4, 7]],
  ['dating_intimacy_safety', 'love.dating', [4, 8, 12], { points: ['Venus', 'Moon', 'A7'] }],
  ['dating_breaking_patterns', 'love.dating', [5, 6, 8, 12]],
  ['dating_transition_commitment', 'love.dating', [7, 5], { points: ['Venus', 'A7', 'UL', 'DK'] }],

  // Love · Marriage (11; marriage_children_family is not offered)
  ['marriage_pulse', 'love.marriage', [7, 4]],
  ['marriage_timing_readiness', 'love.marriage', [7, 9]],
  ['marriage_daily_harmony', 'love.marriage', [4, 7]],
  ['marriage_conflict_cycles', 'love.marriage', [7, 6, 8, 12]],
  ['marriage_communication', 'love.marriage', [2, 3, 7]],
  ['marriage_trust_transparency', 'love.marriage', [8, 12, 7]],
  ['marriage_reconciliation', 'love.marriage', [7, 8, 9]],
  ['marriage_inlaws_family', 'love.marriage', [4, 2, 8], { promiseCharts: [...NATAL, 'D4'], yearCharts: ['D1', 'D9', 'D4'], points: ['UL', 'A4', 'Venus'] }],
  ['marriage_finances_chores', 'love.marriage', [2, 8, 11, 6], { promiseCharts: [...NATAL, 'D2'], signDasha: `Narayana D9${SUDASA}`, points: ['UL', 'A2', 'A7', 'HL'] }],
  ['marriage_longterm_longevity', 'love.marriage', [7, 8]],
  ['marriage_personal_growth', 'love.marriage', [1, 7], { points: ['UL', 'AL', 'AK', 'DK', 'Karakamsa'] }],

  // Love · Friends (7): 11th from the lagna and from the AL; no A5, no D11
  ['friends_social_energy', 'love.friends', [11, 12, 3], { points: ['AL', 'Moon'] }],
  ['friends_core_allies', 'love.friends', [11, 9], { points: ['AL', 'Jupiter'] }],
  ['friends_outgrowing_circles', 'love.friends', [11, 6, 8]],
  ['friends_finding_tribe', 'love.friends', [11, 9, 3], { points: ['AL', 'Jupiter'] }],
  ['friends_boundaries_drains', 'love.friends', [12, 6, 11], { points: ['AL', 'Moon'] }],
  ['friends_mentors_guides', 'love.friends', [9, 11], { points: ['AL', 'Jupiter', 'BK'] }],
  ['friends_reputation_belonging', 'love.friends', [11, 10, 1]],

  // Love · Allies at work (8)
  ['allies_pulse', 'love.allies', [10, 6, 7, 11], { points: ['A10', 'AL', 'AmK'] }],
  ['allies_bosses_authority', 'love.allies', [10, 9], { points: ['A10', 'Sun'] }],
  ['allies_team_politics', 'love.allies', [6, 3, 8], { points: ['A6', 'AL'] }],
  ['allies_cofounder_fit', 'love.allies', [7, 11], { points: ['A7', 'DK'] }],
  ['allies_clients_deals', 'love.allies', [7, 10, 11], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}`, points: ['A7', 'A10'] }],
  ['allies_managing_people', 'love.allies', [10, 6, 5], { points: ['A10', 'A5 (D10)'] }],
  ['allies_networking_allies', 'love.allies', [11, 10, 3], { points: ['A10', 'AL'] }],
  ['allies_contracts_disputes', 'love.allies', [6, 8, 7], { points: ['A6', 'AL'] }],

  // Work · Starting out (6; start_degree_to_career is not offered)
  ['start_launch_window', 'work.career_start', [10, 6, 5, 9], { promiseCharts: [...NATAL, 'D10', 'D24'] }],
  ['start_first_role_timing', 'work.career_start', [6, 10, 11]],
  ['start_offer_decision', 'work.career_start', [10, 2, 3, 6], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}` }],
  ['start_imposter_syndrome', 'work.career_start', [1, 4, 5], { points: ['Moon', 'Sun', 'Mercury', 'AL'] }],
  ['start_relocation_abroad', 'work.career_start', [12, 9, 4, 3], { promiseCharts: [...NATAL, 'D10', 'D4'] }],
  ['start_three_year_foundation', 'work.career_start', [10, 3, 6, 11], { points: ['A10', 'AK', 'AmK'] }],

  // Work · Your job (11)
  ['job_pulse', 'work.primary_job', [10, 6, 11]],
  ['job_security_layoff', 'work.primary_job', [10, 8, 12, 6]],
  ['job_stay_or_leave', 'work.primary_job', [10, 3, 8, 11], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}` }],
  ['job_promotion_recognition', 'work.primary_job', [10, 11, 9], { points: ['AL', 'A10', 'Sun', 'GL'] }],
  ['job_salary_bonuses', 'work.primary_job', [11, 2, 12], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}`, yearCharts: ['D1', 'D10', 'D2'], points: ['AL', 'A2', 'HL'] }],
  ['job_burnout_load', 'work.primary_job', [6, 8, 12, 1], { points: ['Lagna lord', 'Moon', 'Sun'] }],
  ['job_boss_politics', 'work.primary_job', [10, 9, 6], { points: ['A10', 'A6', 'Sun'] }],
  ['job_leading_teams', 'work.primary_job', [10, 5, 6], { points: ['A10', 'A5 (D10)', 'Sun'] }],
  ['job_industry_switch', 'work.primary_job', [10, 8, 9, 12]],
  ['job_remote_abroad', 'work.primary_job', [12, 9, 4, 10]],
  ['job_skill_building', 'work.primary_job', [3, 5, 9, 10], { promiseCharts: [...NATAL, 'D10', 'D24'], yearCharts: ['D1', 'D10', 'D24'], points: ['Mercury', 'Jupiter', 'AmK'] }],

  // Work · Craft & hobby (6): adjacent rules only; no D7, no D16
  ['craft_creative_flow', 'work.hobby', [5, 3, 11], { points: ['Mercury', 'Venus', 'Moon'] }],
  ['craft_energizing_medium', 'work.hobby', [3, 5]],
  ['craft_creative_blocks', 'work.hobby', [5, 12]],
  ['craft_monetize_hobby', 'work.hobby', [5, 11, 2, 7], { promiseCharts: [...NATAL, 'D24', 'D10', 'D2'], signDasha: `Narayana D1${SUDASA}`, yearCharts: ['D1', 'D10'], points: ['Mercury', 'Venus', 'A7'] }],
  ['craft_shipping_projects', 'work.hobby', [3, 10, 11], { promiseCharts: [...NATAL, 'D24', 'D10'], points: ['Mars', 'Mercury', 'A10'] }],
  ['craft_audience_community', 'work.hobby', [11, 5], { promiseCharts: [...NATAL, 'D24', 'D10'], points: ['Moon', 'Venus', 'AL'] }],

  // Work · Business (10; biz_legal_safeguards is not offered)
  ['biz_readiness', 'work.business', [7, 3, 11, 6], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}` }],
  ['biz_ideal_industry', 'work.business', [10, 7, 2], { points: ['AmK', 'A10', 'A7'] }],
  ['biz_launch_timing', 'work.business', [10, 7, 11], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}`, yearCharts: ['D1', 'D10', 'D2'] }],
  ['biz_cashflow_margins', 'work.business', [2, 11, 12], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}`, yearCharts: ['D1', 'D10', 'D2'], points: ['AL', 'A2', 'HL'] }],
  ['biz_clients_sales', 'work.business', [7, 10, 3]],
  ['biz_partnerships_fit', 'work.business', [7, 11, 8], { points: ['A7', 'DK'] }],
  ['biz_hiring_team', 'work.business', [6, 5, 10], { promiseCharts: [...NATAL, 'D10', 'D2'], signDasha: `Narayana D10${SUDASA}`, points: ['A10', 'A6', 'A5 (D10)'] }],
  ['biz_capital_assets', 'work.business', [4, 2, 8, 6], { promiseCharts: [...NATAL, 'D10', 'D2', 'D4'], signDasha: `Narayana D10${SUDASA}`, yearCharts: ['D1', 'D10', 'D4'], points: ['A4', 'A2', 'HL'] }],
  ['biz_scaling_risk', 'work.business', [3, 11, 10], { points: ['A10', 'AL'] }],
  ['biz_founder_burnout', 'work.business', [1, 6, 12, 8], { points: ['Lagna lord', 'Moon', 'Sun'] }],
];

function boardOf(lens: LensId): CardRoute['board'] {
  return lens.slice(0, lens.indexOf('.')) as CardRoute['board'];
}

const ROUTES: ReadonlyMap<string, CardRoute> = new Map(
  ROWS.map(([card, lens, houses, o]) => {
    const d = LENS[lens];
    const route: CardRoute = {
      card,
      board: boardOf(lens),
      lens,
      houses: [...houses],
      promiseCharts: [...(o?.promiseCharts ?? d.promiseCharts)],
      signDasha: o?.signDasha ?? d.signDasha,
      yearCharts: [...(o?.yearCharts ?? d.yearCharts)],
      points: [...(o?.points ?? d.points)],
    };
    return [card, route];
  }),
);

/** Every routed card id, in doc 08 order. */
export const ROUTED_CARDS: readonly string[] = ROWS.map((r) => r[0]);

/** The card's route (a fresh copy), or null for a card with no route (not readable yet). */
export function routeFor(cardId: string): CardRoute | null {
  const r = ROUTES.get(cardId);
  if (!r) return null;
  return { ...r, houses: [...r.houses], promiseCharts: [...r.promiseCharts], yearCharts: [...r.yearCharts], points: [...r.points] };
}

/** The lens recipe (`src/reading/prompts/cards/threads/<lens>.md`, embedded in the prompt bundle), or null. */
export function recipeText(lens: LensId): string | null {
  return PROMPTS[`cards/threads/${lens}`] ?? null;
}
