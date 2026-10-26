/**
 * Subject frame table — docs/reading-engine/02-reading-method.md Step 0. The contract between intake and the
 * evidence-pack selector: adding a subject means adding a row here, nothing else.
 */
import type { PlanetCode, VargaKey } from '../facts/constants.js';

export const SUBJECT_IDS = [
  'career_work',
  'income_wealth',
  'debt_loss_expense',
  'property_home',
  'vehicles',
  'marriage_relationship',
  'children',
  'health_body',
  'education_learning',
  'spirituality_moksha',
  'foreign_relocation',
  'travel_journeys',
  'siblings',
  'litigation_government',
  'speculation_lottery',
  'general_life_direction',
  'explain_term',
] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];

export type KarakaCode = 'AK' | 'AmK' | 'BK' | 'MK' | 'PiK' | 'PK' | 'GK' | 'DK';

export interface SubjectFrame {
  id: SubjectId;
  label: string;
  definition: string;
  /** Houses from Lagna, primary first */
  houses: number[];
  /** Also judge the primary house from these reference points */
  alsoFrom: Array<'Mo' | 'AL' | 'Ve' | 'Su' | 'Ju'>;
  /** Natural karakas (planet codes) */
  karakas: PlanetCode[];
  charaKarakas: KarakaCode[];
  /** Divisional charts that refine the judgement (first is primary; may be absent in the dossier) */
  vargas: VargaKey[];
  /** Arudha padas (A1..A12, AL, UL) and special lagnas (HL, GL, IL, SL, BL…) */
  arudhas: string[];
  specialLagnas: string[];
  /** Fixed caveat the synthesizer must include, if any */
  caveat?: string;
}

const F = (f: SubjectFrame): SubjectFrame => f;

export const FRAMES: Record<SubjectId, SubjectFrame> = {
  career_work: F({
    id: 'career_work',
    label: 'career and work',
    definition: 'job, profession, promotion, business, employer, reputation at work',
    houses: [10, 6, 1],
    alsoFrom: ['Mo', 'AL'],
    karakas: ['Su', 'Sa', 'Me', 'Ju'],
    charaKarakas: ['AmK'],
    vargas: ['D10'],
    arudhas: ['A10', 'AL'],
    specialLagnas: ['GL', 'HL'],
  }),
  income_wealth: F({
    id: 'income_wealth',
    label: 'income and wealth',
    definition: 'earnings, savings, gains, fortune, financial growth',
    houses: [2, 11, 9, 5],
    alsoFrom: ['Mo', 'AL'],
    karakas: ['Ju', 'Ve', 'Me'],
    charaKarakas: ['AmK', 'DK'],
    vargas: ['D2'],
    arudhas: ['A2', 'A11', 'AL'],
    specialLagnas: ['IL', 'SL'],
  }),
  debt_loss_expense: F({
    id: 'debt_loss_expense',
    label: 'debt, loss and expenses',
    definition: 'loans, losses, outflow, obstacles from debt',
    houses: [6, 8, 12],
    alsoFrom: [],
    karakas: ['Sa', 'Ra', 'Ke'],
    charaKarakas: [],
    vargas: ['D2'],
    arudhas: ['A6', 'A8'],
    specialLagnas: [],
  }),
  property_home: F({
    id: 'property_home',
    label: 'property and home',
    definition: 'buying or building a house, land, home comforts, real estate deals',
    houses: [4, 2, 11],
    alsoFrom: ['Mo'],
    karakas: ['Ma', 'Ve', 'Mo'],
    charaKarakas: ['MK'],
    vargas: ['D4'],
    arudhas: ['A4'],
    specialLagnas: [],
  }),
  vehicles: F({
    id: 'vehicles',
    label: 'vehicles',
    definition: 'buying a car or vehicle',
    houses: [4],
    alsoFrom: [],
    karakas: ['Ve'],
    charaKarakas: [],
    vargas: ['D4'],
    arudhas: ['A4'],
    specialLagnas: [],
  }),
  marriage_relationship: F({
    id: 'marriage_relationship',
    label: 'marriage and relationships',
    definition: 'marriage timing, spouse, partnership, romance, divorce',
    houses: [7, 2, 11, 12],
    alsoFrom: ['Ve', 'Mo'],
    karakas: ['Ve', 'Ju'],
    charaKarakas: ['DK'],
    vargas: ['D9'],
    arudhas: ['UL', 'A7'],
    specialLagnas: [],
  }),
  children: F({
    id: 'children',
    label: 'children',
    definition: 'conception, children, progeny',
    houses: [5, 9],
    alsoFrom: ['Ju'],
    karakas: ['Ju'],
    charaKarakas: ['PK'],
    vargas: ['D7'],
    arudhas: ['A5'],
    specialLagnas: [],
  }),
  health_body: F({
    id: 'health_body',
    label: 'health and body',
    definition: 'illness, vitality, recovery, surgery, chronic conditions',
    houses: [1, 6, 8],
    alsoFrom: ['Mo', 'Su'],
    karakas: ['Su', 'Mo'],
    charaKarakas: ['AK', 'GK'],
    vargas: ['D1'],
    arudhas: ['A6', 'A8'],
    specialLagnas: [],
    caveat: 'D-30 is not in the chart data, so the health layer is read from D-1 only; this is an astrological indication, not medical advice.',
  }),
  education_learning: F({
    id: 'education_learning',
    label: 'education and learning',
    definition: 'studies, exams, degrees, skills, intellect',
    houses: [4, 5, 2, 9],
    alsoFrom: [],
    karakas: ['Me', 'Ju'],
    charaKarakas: [],
    vargas: ['D1'],
    arudhas: ['A4', 'A5'],
    specialLagnas: [],
    caveat: 'D-24 is not in the chart data, so education is read from D-1 only.',
  }),
  spirituality_moksha: F({
    id: 'spirituality_moksha',
    label: 'spirituality and moksha',
    definition: 'spiritual path, meditation, renunciation, guru, pilgrimage',
    houses: [9, 12, 8, 5],
    alsoFrom: ['Ju'],
    karakas: ['Ke', 'Ju', 'Sa'],
    charaKarakas: ['AK'],
    vargas: ['D9'],
    arudhas: ['A9', 'A12'],
    specialLagnas: [],
  }),
  foreign_relocation: F({
    id: 'foreign_relocation',
    label: 'foreign travel and relocation',
    definition: 'moving abroad, visas, long-distance relocation, settling overseas',
    houses: [12, 9, 7, 4],
    alsoFrom: [],
    karakas: ['Ra', 'Mo', 'Sa'],
    charaKarakas: [],
    vargas: ['D4', 'D10'],
    arudhas: ['A12', 'A4'],
    specialLagnas: [],
  }),
  travel_journeys: F({
    id: 'travel_journeys',
    label: 'travel and journeys',
    definition: 'trips, short and long journeys, pilgrimages, visits abroad that are not a move',
    houses: [3, 9, 12, 7],
    alsoFrom: ['Mo'],
    karakas: ['Mo', 'Ra', 'Me'],
    charaKarakas: [],
    vargas: ['D1'],
    arudhas: ['A3', 'A9', 'A12'],
    specialLagnas: [],
    caveat: 'Chart timing shows when journeys are supported; exact trip dates need the day-level transit calendar.',
  }),
  siblings: F({
    id: 'siblings',
    label: 'siblings and courage',
    definition: 'brothers and sisters, their wellbeing and your bond with them, courage, short efforts',
    houses: [3, 11, 1],
    alsoFrom: [],
    karakas: ['Ma', 'Me'],
    charaKarakas: ['BK'],
    vargas: ['D3'],
    arudhas: ['A3', 'A11'],
    specialLagnas: [],
    caveat: 'The 3rd house shows younger siblings and the 11th elder ones; say which sibling you mean for a sharper answer.',
  }),
  litigation_government: F({
    id: 'litigation_government',
    label: 'litigation and government',
    definition: 'court cases, disputes, government dealings, authority, taxes',
    houses: [6, 10, 8],
    alsoFrom: [],
    karakas: ['Ma', 'Sa', 'Su'],
    charaKarakas: [],
    vargas: ['D10'],
    arudhas: ['A6'],
    specialLagnas: [],
  }),
  speculation_lottery: F({
    id: 'speculation_lottery',
    label: 'speculation and sudden gains',
    definition: 'lottery, gambling, trading windfalls, speculative gains',
    houses: [5, 11, 2],
    alsoFrom: [],
    karakas: ['Ra', 'Ju', 'Ve'],
    charaKarakas: [],
    vargas: ['D2'],
    arudhas: ['A5', 'A11'],
    specialLagnas: [],
    caveat: 'Astrology shows windows when gains from the 5th, 11th and 2nd houses are supported; it cannot predict a lottery win, and no outcome is promised.',
  }),
  general_life_direction: F({
    id: 'general_life_direction',
    label: 'life direction',
    definition: 'overall direction, purpose, personality, the year ahead, nakshatra deep dives',
    houses: [1, 9, 10],
    alsoFrom: ['Mo'],
    karakas: ['Ju'],
    charaKarakas: ['AK', 'AmK'],
    vargas: ['D9', 'D10'],
    arudhas: ['AL'],
    specialLagnas: [],
  }),
  explain_term: F({
    id: 'explain_term',
    label: 'astrology term',
    definition: 'what a term means (Sade Sati, Rahu, dasha, varga…), using the chart only as an example',
    houses: [1],
    alsoFrom: ['Mo'],
    karakas: [],
    charaKarakas: [],
    vargas: ['D1'],
    arudhas: [],
    specialLagnas: [],
  }),
};

export const HORIZONS = ['now', '3m', '6m', '1y', '3y', 'life'] as const;
export type HorizonCode = (typeof HORIZONS)[number];
export type Horizon = HorizonCode | { from: string; to: string };

export const QUESTION_TYPES = ['timing', 'yes_no', 'why_meaning', 'compare', 'describe', 'explain_term'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const FORMATS = ['direct', 'timeline', 'factor_table', 'narrative', 'watchlist'] as const;
export type FormatId = (typeof FORMATS)[number];

/** Resolve a horizon to an ISO date range starting today (as_of). */
export function horizonRange(h: Horizon, asOf: string): { from: string; to: string; months: number } {
  const start = new Date(asOf + 'T00:00:00Z');
  const addMonths = (n: number) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };
  if (typeof h === 'object') {
    const months = Math.max(1, Math.round((Date.parse(h.to) - Date.parse(h.from)) / (30.44 * 86400000)));
    return { from: h.from, to: h.to, months };
  }
  switch (h) {
    case 'now':
      return { from: asOf, to: addMonths(1), months: 1 };
    case '3m':
      return { from: asOf, to: addMonths(3), months: 3 };
    case '6m':
      return { from: asOf, to: addMonths(6), months: 6 };
    case '1y':
      return { from: asOf, to: addMonths(12), months: 12 };
    case '3y':
      return { from: asOf, to: addMonths(36), months: 36 };
    case 'life':
    default:
      return { from: asOf, to: addMonths(36), months: 36 }; // life: static promise + 3y of timing
  }
}

export function isSubjectId(x: string): x is SubjectId {
  return (SUBJECT_IDS as readonly string[]).includes(x);
}
