/**
 * The technique catalogue (docs/admin/03 §4.1; docs/reading-engine/53 §4.3): one entry per board function or reading
 * technique, with the charts it reads, its algorithm in plain steps (written from the code path it names), its source,
 * the agents that run it and where its accuracy evidence comes from. Since doc 53 every row is also a contract: its
 * `selectors` say when the clarify context and the companion memory pick it, its `contract` what it reads (digest
 * sections in a named layout, src/techniques/layouts.ts), under which prompt, and what it returns. The catalogue is code;
 * at boot it is upserted into `technique_registry`, which the admin panel reads. Runs are tagged with a technique id when
 * they are written (src/agents/registry.ts withAgentRun, src/reading/metrics/trace.ts).
 *
 * Nothing here computes anything astrological: it labels. Steps describe what the named code does with the engine's
 * stored values.
 */
import type { PrismaClient } from '@prisma/client';
import { FAMILIES, FAMILIES_NOT_BUILT } from '../reading/area/career.js';
import { SCENARIOS, YOGA_AVOID_DEFAULT, YOGA_FAVOUR_DEFAULT, type ScenarioRule } from '../reading/luckyTimes/scenarios.js';
import { HORIZONS, SUBJECT_IDS, type SubjectId } from '../reading/packs/frames.js';
import { SYSTEM_LABELS } from '../reading/timeline/types.js';
import { categoryOfLuckyArea, type TechniqueCategory } from './categories.js';
import type { ContractInput, ContractSection, TechniqueContract, TechniqueSelectors } from './contracts.js';
import type { LayoutId } from './layouts.js';

export type TechniqueBoard = 'you' | 'love' | 'work' | 'lucky' | 'chat' | 'timeline';
export type TechniqueStatus = 'built' | 'partial' | 'planned';
export type ChartSource = 'natal' | 'divisional' | 'dasha' | 'transit' | 'annual' | 'panchang' | 'nakshatra' | 'jaimini' | 'ashtakavarga';
export const CHART_SOURCES: readonly ChartSource[] = ['natal', 'divisional', 'dasha', 'transit', 'annual', 'panchang', 'nakshatra', 'jaimini', 'ashtakavarga'];

export interface TechniqueChart {
  source: ChartSource;
  id: string;
}

export interface TechniqueDef {
  /** <category or board>.<name> */
  id: string;
  title: string;
  category: TechniqueCategory;
  board: TechniqueBoard;
  status: TechniqueStatus;
  /** what it reads, declared */
  charts: TechniqueChart[];
  /** plain steps */
  algorithm: string[];
  special?: string;
  source: string;
  /** file and function, or "not built" */
  code: string;
  /** agent_registry ids that run it (src/agents/registry.ts) */
  agents: string[];
  /** area_checks:<area> | staff | none */
  accuracy: string;
  /** when the clarify context picks it (doc 53 §4.3); an empty object matches everything */
  selectors: TechniqueSelectors;
  /** what it reads, under which prompt, and what it returns (doc 53 §4.3) */
  contract: TechniqueContract;
}

const c = (source: ChartSource, id: string): TechniqueChart => ({ source, id });
const inp = (section: ContractSection, filter: string, layout: LayoutId): ContractInput => ({ section, filter, layout });
/** A code technique: no prompt, no user turn, an output type instead of a schema (doc 53 §4.3). */
const codeContract = (inputs: ContractInput[], output: string, synthesizer?: string): TechniqueContract => ({ inputs, system: 'none', user: [], output, ...(synthesizer ? { synthesizer } : {}) });

/**
 * Standardized typed filter vocabulary for `house/house_card` reader inputs (`docs/admin/07` §11, `TODOS.md:953`).
 */
export const HOUSE_FILTER_VOCABULARY = {
  workPrimary: 'D1,D10 houses 10,6,1,2,11',
  workSecurity: 'D1 houses 10,9,5,6,8,12 and their lords',
  workSubareas: 'D1 houses 2,11 (money), 4 (residence), 7 (business) and their lords',
  workD10: 'D10 houses 10,6,1,2,11',
  frameHouses: "D1 and the frame's vargas, the frame's houses",
  frameCuspStars: "D1, the frame's houses (cusp_star column)",
  frameSav: "D1, the frame's houses (sav column)",
  frameArgala: "D1, the frame's houses and the houses the points sit in (argala, class columns)",
  personHouses: "D1 and the person's varga (D12, D9, D7, D3), the person's house",
  lifeAreaHouses: 'D1 houses of the area; D9 and the owning varga, primary house',
  researchAll10Vargas: 'D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 houses 1..12',
  selfCharacterArc: 'D1,D9,D10 houses 1,4,5,9,10',
  selfPersonalityJoy: 'D1,D9,D24 houses 1,3,4,5,11,12',
} as const;
export type HouseFilterKey = keyof typeof HOUSE_FILTER_VOCABULARY;

/** The user-turn fields every General Reading analyst is sent (doc 53 §4.3, §4.4: FACTS carries the matched person_facts). */
export const ANALYST_USER_FIELDS = ['TODAY', 'SUBJECT', 'FRAME', 'HORIZON', 'REAL_WANT', 'QUESTION', 'FACTS'];
const ALL_SUBJECTS: SubjectId[] = [...SUBJECT_IDS];
const ALL_HORIZONS: string[] = [...HORIZONS, 'custom'];
const ALL_BOARDS: TechniqueBoard[] = ['chat', 'you', 'love', 'work', 'lucky', 'timeline'];

// ---------------------------------------------------------------- Work board (src/reading/area/career.ts)

const familyLine = FAMILIES.map((f) => `${f.label} = ${f.systems.map((s) => `${SYSTEM_LABELS[s]} (${s})`).join(' + ')}${f.mode === 'agree' ? ', votes only when both agree' : ''}`).join('; ');

/** What every built career function reads: the engine's stored dashas, house table and dossier, and its transit contacts. */
const CAREER_CHARTS: TechniqueChart[] = [
  c('dasha', 'vimshottari'),
  c('dasha', 'yogini'),
  c('dasha', 'tithi_ashtottari'),
  c('dasha', 'narayana'),
  c('transit', 'transit_contacts'),
  c('transit', 'double_transit'),
  c('jaimini', 'modifier'),
  c('natal', 'house_counts'),
  c('natal', 'facts'),
];
const CAREER_AGENTS = ['area.career_inputs', 'area.career_map'];
const GRID_STEP = 'Read the timeline grid for the career marker, built from the stored dashas, house table and transit contacts over 24 months back to 24 months ahead (timeline/pipeline.ts buildTimelineSpan)';

/** The Work board's selectors: the board itself and the career subject; the companion memory's work.status gates sub-areas inside the service, not whole techniques (careerService.ts fitsStatus). */
const WORK_SELECTORS: TechniqueSelectors = { boards: ['work'], subjects: ['career_work'], houses: [10, 6, 1, 2, 11], vargas: ['D1', 'D10'] };
const WORK_HOUSE_INPUT = inp('house', 'D1,D10 houses 10,6,1,2,11', 'house_card');
const WORK_ACTIVATION_INPUT = inp('activation', 'families S1, S4, S2+S3, S6/S6D, S7 ±24 months', 'activation_row');
const WORK_TRANSIT_INPUT = inp('transit', 'contacts and double transit on houses 10,6,1 and their lords ±24 months', 'transit_row');
const WORK_CONTRACT = codeContract([WORK_HOUSE_INPUT, WORK_ACTIVATION_INPUT, WORK_TRANSIT_INPUT], 'career_map.v1');

const WORK_BUILT: TechniqueDef[] = [
  {
    id: 'work.present_tone',
    title: 'Present tone',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: CAREER_CHARTS,
    algorithm: [
      GRID_STEP,
      'Take this month with the month before and the month after',
      `Group the systems into five voting families: ${familyLine}`,
      'Per system, sum support and test over the three months: support when support exceeds test by 0.5 or more, test when test exceeds support by 0.5 or more, otherwise neutral; a family votes a side only when its active systems do not disagree',
      "Grade this month's job security (work.security_grade)",
      'Demanding when security is risk or high risk, or the month tests at moderate band or above with 2+ test families, or tests at any band with 2+ test families and fewer than 2 support families',
      'Easing when demanding and the test run ends within one month and the next two months do not test at moderate or above',
      'Open when the month supports at moderate or above with 2+ support families and is not demanding; closing when open, this is the last support month and one of the next two months tests at moderate or above',
      'Pick the tone in the order easing, demanding, closing, open, steady',
      'Confidence: confirmed when the agreeing families reach max(3, 60 % of the available families) and the main clock agrees; likely when 2+ agree and outnumber the other side; otherwise split. For steady: split when both sides have 2+ families, likely when one side has, confirmed otherwise',
      'Dates: ease_date (first month after the test run), window_end (last day of the support run), next_window_start (first month of the next support run)',
    ],
    special: `Short clocks vote only when Yogini and Tithi Ashtottari agree. The ${FAMILIES_NOT_BUILT.join(', ')} families are not built, so the thresholds scale to the families available`,
    source: 'docs/reading-engine/43 §8.1',
    code: 'src/reading/area/career.ts presentState',
    agents: CAREER_AGENTS,
    accuracy: 'area_checks:career',
    selectors: WORK_SELECTORS,
    contract: WORK_CONTRACT,
  },
  {
    id: 'work.security_grade',
    title: 'Job security by month',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: CAREER_CHARTS,
    algorithm: [
      GRID_STEP,
      "End lords: the lords of houses 9 and 5 (the 12th and 8th from the 10th) and of 6, 8 and 12 from the lagna, read from the engine's house cards",
      'A month that is not testing: clear_protected when its band is moderate or above, else clear',
      'A testing month has a gate when a driver planet (the strongest planet named by Vimshottari, Narayana, transit contacts, double transit, Yogini or Tithi Ashtottari) is an end lord, Rahu, Ketu or Saturn',
      'Gate and high band: high_risk; gate and moderate band or above: risk; otherwise watch',
      'Grade this month and the 12 after',
    ],
    special: 'A test without a gate planet is only "watch"',
    source: 'docs/reading-engine/43 §6–§7',
    code: 'src/reading/area/career.ts securityGrade',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('house', 'D1 houses 10,9,5,6,8,12 and their lords', 'house_card'), WORK_ACTIVATION_INPUT, WORK_TRANSIT_INPUT], 'career_map.v1'),
  },
  {
    id: 'work.subarea_windows',
    title: 'Windows ahead by sub-area',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: CAREER_CHARTS,
    algorithm: [
      GRID_STEP,
      'Take every window of the grid that ends after the start of this month',
      'A testing career window becomes job_security, graded at its peak month (work.security_grade)',
      "A support career window becomes promotion when a driver is the 10th lord, the Sun, the 11th lord or the Ghati Lagna's lord; job_change when Narayana is active in it or a driver is Rahu or the lord of 12, 3 or 9; and always get_job",
      'Support windows of the business marker become business; of the money marker, pay, when they overlap a career support window; of the residence marker, abroad, when a driver is Rahu or the 12th or 9th lord',
      'Each window keeps its dates, peak month, band, score (to one decimal), the families active and the driver planets',
      'Sort by start date, then get_job, job_change, promotion, job_security, abroad, pay, business',
      "The service hides sub-areas that do not fit the person's stated work status (careerService.ts fitsStatus): get_job only for between_jobs or studying; promotion and job_security not for between_jobs, studying or own_business; business for own_business or when the status is unknown",
    ],
    source: 'docs/reading-engine/43 §2, §8.3',
    code: 'src/reading/area/career.ts careerMap (ahead), careerSubareas',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([WORK_HOUSE_INPUT, inp('house', 'D1 houses 2,11 (money), 4 (residence), 7 (business) and their lords', 'house_card'), WORK_ACTIVATION_INPUT, WORK_TRANSIT_INPUT], 'career_map.v1'),
  },
  {
    id: 'work.horizons',
    title: 'Horizons (1, 3, 6, 12 months)',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: CAREER_CHARTS,
    algorithm: [
      'From the windows ahead (work.subarea_windows), for 1, 3, 6 and 12 months from the start of this month take the windows that start inside',
      'Rank by band order x 100 + score; keep the best support window and the hardest test window',
      'The 6- and 12-month rungs show only windows at moderate band or above; the 1- and 3-month rungs at possible or above',
      'A rung is quiet when neither clears its bar',
    ],
    source: 'docs/reading-engine/45 §10',
    code: 'src/reading/area/career.ts careerMap (horizons)',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([WORK_HOUSE_INPUT, inp('activation', 'families S1, S4, S2+S3, S6/S6D, S7 this month to +12 months', 'activation_row'), WORK_TRANSIT_INPUT], 'career_map.v1'),
  },
  {
    id: 'work.looking_back',
    title: 'Looking back',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: CAREER_CHARTS,
    algorithm: [
      GRID_STEP,
      'Walk the 12 months before this month',
      'A month is an edge when its band is moderate or above and either its side (test or support) differs from the month before or the month before was below moderate',
      'Keep the last two test edges and the last two support edges, rank by band then by recency, keep three, show them in month order',
      'The person answers yes, partly, no or skip to each moment; the answers are stored in area_checks (area career)',
    ],
    source: 'docs/reading-engine/45 §9',
    code: 'src/reading/area/career.ts careerMap (back); src/reading/area/careerService.ts recordCheck',
    agents: CAREER_AGENTS,
    accuracy: 'area_checks:career',
    selectors: WORK_SELECTORS,
    contract: codeContract([WORK_HOUSE_INPUT, inp('activation', 'families S1, S4, S2+S3, S6/S6D, S7 −12 months to this month', 'activation_row'), WORK_TRANSIT_INPUT], 'career_map.v1'),
  },
];

const WORK_EXTRA_BUILT: TechniqueDef[] = [
  {
    id: 'work.annual_family',
    title: "This year's chart (annual family)",
    category: 'work',
    board: 'work',
    status: 'built',
    charts: [c('annual', 'tithi_pravesha'), c('annual', 'tithi_pravesha_dasha'), c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'sahams'), c('divisional', 'D10')],
    algorithm: [
      'Read the Tithi Pravesha or Varsha chart covering the current month from the digest annual set',
      "Grade the year chart's houses 10, 6 and 1 (lord in the house or kendra/trikona without debility supports; in a dusthana or debilitated tests)",
      'Read the houses of the rajya and karma sahams (kendra supports, dusthana tests) and any running year dasha lord covering the month',
      'Cast one vote (support, test or neutral) as the annual family of the present tone',
    ],
    source: 'docs/reading-engine/43 §8.1 (family 5); 46 §B.6; 53 §4.5',
    code: 'src/reading/area/career.ts workAnnualVote, presentState; careerService.ts getCareer',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('annual', 'TP current year, D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; year dasha running this month', 'annual_row')], 'family_vote.v1', 'work.present_tone'),
  },
  {
    id: 'work.conditional_family',
    title: 'Conditional clock',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: [c('dasha', 'applicable'), c('dasha', 'conditional')],
    algorithm: [
      'Read the conditional dasha rows covering this month from the activation calendar (family conditional, levels 1–2)',
      'Grade each running lord by its career polarity and D1/D10 agreement (workD10Check); level 1 weighs 1, level 2 weighs 0.5',
      'Cast support at ≥ 0.5, test at ≤ −0.5, else neutral; no vote when no conditional system applies',
    ],
    source: 'docs/reading-engine/43 §8.1 (family 2); 46 §B.4; 53 §4.5',
    code: 'src/reading/area/career.ts workConditionalVote, presentState; careerService.ts getCareer',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('activation', 'conditional systems named by dasha.applicable, levels 1–3, periods covering this month ±1, houses 10,6,1', 'activation_row')], 'family_vote.v1', 'work.present_tone'),
  },
  {
    id: 'work.karaka_family',
    title: 'Karaka clock',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: [c('dasha', 'karaka'), c('jaimini', 'chara_karakas'), c('divisional', 'D10')],
    algorithm: [
      'Read the karaka dasha rows covering this month from the activation calendar (family karaka)',
      'AmK or the D1 10th lord running gives support unless debilitated in D10; a planet debilitated in D10 or lording a dusthana without owning 10, 1 or 6 gives test',
      'Apply workD10Check so a split D1/D10 vote is not counted',
    ],
    source: 'docs/reading-engine/43 §8.1 (family 4); 46 §B.4; 53 §4.5',
    code: 'src/reading/area/career.ts workKarakaVote, presentState; careerService.ts getCareer',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('activation', 'karaka dasha level 3, periods covering this month ±1', 'activation_row'), inp('point', 'AmK and the 10th lord in D1 and D10', 'point_row'), inp('planet', 'D10 card of the running karaka lord', 'planet_card')], 'family_vote.v1', 'work.present_tone'),
  },
  {
    id: 'work.d10_check',
    title: 'D1 and D10 agreement on each dasha vote',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: [c('divisional', 'D1'), c('divisional', 'D10'), c('divisional', 'D9'), c('divisional', 'D60')],
    algorithm: [
      'For the running lord of the main, conditional and karaka clocks, read its place and dignity in D1, D10, D9 and D60',
      'A dasha vote counts only when D1 and D10 agree on its side; D9 breaks a tie',
      'D60 confirms only when the birth time is recorded to the minute, and never decides alone',
      "When D1 and D10 disagree, the family's vote is split and not counted",
    ],
    source: 'docs/reading-engine/43 §8.1; 46 §B.7; 53 §4.5',
    code: 'src/reading/area/career.ts workD10Check, presentState; careerService.ts getCareer',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('activation', 'running lords of the main, conditional and karaka clocks this month', 'activation_row'), inp('planet', 'D1, D10, D9, D60 cards of those lords', 'planet_card'), inp('house', 'D10 houses 10,6,1,2,11', 'house_card')], 'vote_check.v1', 'work.present_tone'),
  },
];

// ---------------------------------------------------------------- Lucky times (src/reading/luckyTimes)

const LUCKY_CHARTS: TechniqueChart[] = [c('panchang', 'tithi'), c('panchang', 'nakshatra'), c('panchang', 'weekday'), c('panchang', 'hora'), c('panchang', 'muhurta'), c('panchang', 'kalams'), c('panchang', 'yoga'), c('panchang', 'karana')];
const list = (xs: readonly string[]): string => (xs.length ? xs.join(', ') : 'none');
const LUCKY_SELECTORS: TechniqueSelectors = { boards: ['lucky'] };
const PANCHANG_INPUT = inp('panchang', "the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)", 'panchang_day');
const OVERLAY_INPUT = inp('panchang', "the person's overlay for the same days (tara, chandra bala, grade)", 'panchang_day');

/**
 * One scenario's algorithm, from its rule row (scenarios.ts) and the scoring in windows.ts scenarioDay. Every step is
 * marked General (the same for everyone at the place, from the shared day table) or Personal (from the person's chart),
 * as doc 53 §4.6 asks; the Why sheet groups them the same way.
 */
export function scenarioAlgorithm(s: ScenarioRule): string[] {
  const from = s.hours[0] === 'sunrise' ? 'sunrise' : `${String(s.hours[0]).padStart(2, '0')}:00`;
  const steps = [
    "General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)",
    s.dayAvoid.length ? `General: whole day avoided on: ${list(s.dayAvoid)}` : 'General: no weekday is avoided',
    `General: candidates are each hora between ${from} and ${String(s.hours[1]).padStart(2, '0')}:00 local, cut to those hours, 20 minutes or more${s.useBrahma ? '; plus brahma muhurta (+2)' : ''}`,
    'General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes',
    `General: weekday favoured (+1): ${list(s.dayFavour)}`,
    `General: tithi group, inside its own span: favoured (+1) ${list(s.tithiFavour)}; avoided (piece dropped) ${list(s.tithiAvoid)}`,
    `General: star group, inside its own span: favoured (+1) ${list(s.starFavour)}; avoided (−2) ${list(s.starAvoid)}`,
    `General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) ${list(s.yogaAvoid)}; favoured (+1) ${list(s.yogaFavour)}`,
    `General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) ${list(s.karanaAvoid)}; favoured (named, no score) ${list(s.karanaFavour)}`,
    `General: hora lord: favoured (+2) ${list(s.horaFavour)}; avoided (−3) ${list(s.horaAvoid)}`,
    'General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)',
    "Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)",
    "Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece",
    `General: keep pieces scoring ${s.floor} or more; show the best two in time order`,
  ];
  return steps;
}

const LUCKY_SCENARIO_ROWS: TechniqueDef[] = SCENARIOS.map((s) => ({
  id: `lucky.${s.id}`,
  title: s.label,
  category: categoryOfLuckyArea(s.area),
  board: 'lucky' as const,
  status: 'built' as const,
  charts: LUCKY_CHARTS,
  algorithm: scenarioAlgorithm(s),
  ...(s.v1Note || s.ask ? { special: [s.v1Note, s.ask ? `Asks one question first (${s.ask})` : null].filter(Boolean).join(' ') } : {}),
  source: s.source,
  code: `src/reading/luckyTimes/scenarios.ts SCENARIOS['${s.id}']; windows.ts scenarioDay`,
  agents: ['lucky.scenario_windows'],
  accuracy: 'staff',
  selectors: LUCKY_SELECTORS,
  contract: codeContract([PANCHANG_INPUT, OVERLAY_INPUT], 'windows.v1'),
}));

// The three shared Lucky times rows serve every area. 'general' is kept for the chat's own techniques, so these are
// filed under 'self' (the person's own day), as the plan asks.
const LUCKY_SHARED: TechniqueDef[] = [
  {
    id: 'lucky.avoid_bands',
    title: 'Avoid bands and good spans of the day',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'kalams'), c('panchang', 'muhurta')],
    algorithm: [
      "General: read the place's stored day row (engine muhurta)",
      'General: avoid bands: rahu kalam, yamagandam, gulikai, every durmuhurtam and varjyam span, in time order; an end before its start is read as past midnight',
      'General: good spans: brahma muhurta, abhijit and every amrita gadiya',
      'General: what is running now: an avoid band first, then a good span, else the next good span',
    ],
    source: 'docs/reading-engine/49 §4.1; 47 §3',
    code: 'src/reading/luckyTimes/windows.ts avoidBands, nowState; service.ts getRange',
    agents: ['lucky.scenario_windows'],
    accuracy: 'staff',
    selectors: LUCKY_SELECTORS,
    contract: codeContract([PANCHANG_INPUT], 'day_bands.v1'),
  },
  {
    id: 'lucky.personal_overlay',
    title: 'Personal overlay (tara, chandra bala and the chart marks)',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'muhurta'), c('nakshatra', 'tara'), c('panchang', 'chandra_bala')],
    algorithm: [
      "Personal: once per month and place, call the engine's muhurta with the person's natal fields",
      "Personal: store each day's tara (the day's star counted from the Moon star: janma, sampat, vipat, kshema, pratyak, sadhaka, vadha, mitra, parama mitra), chandra bala (the Moon's house from the natal Moon) and grade (kundli_day_overlays)",
      "Personal: use the engine's own good/bad verdicts: +1 / −1 each on every window of that day",
      "Personal: the hora lord's nature for this chart, functional benefic or malefic from the digest planet cards of D1, moves a window by ±1 (read through functionalNatureOf; no mark while the digest is not ready)",
      "Personal: whether the day's tithi lord or star lord is a running dasha lord in the activation calendar (+1 on the window, read through runningDashaLordsOf)",
    ],
    source: 'docs/reading-engine/49 §4.1; 53 §4.6',
    code: 'src/reading/luckyTimes/service.ts personalDays, LuckyDeps.functionalNatureOf, LuckyDeps.runningDashaLordsOf; wiring.ts; windows.ts personalScore, scenarioDay',
    agents: ['lucky.day_overlay'],
    accuracy: 'staff',
    selectors: LUCKY_SELECTORS,
    contract: codeContract([OVERLAY_INPUT, inp('planet', 'D1 cards of the seven hora lords (nature column)', 'planet_card'), inp('activation', 'periods running on each day, every system', 'activation_row')], 'day_overlay.v1'),
  },
  {
    id: 'lucky.day_tables',
    title: 'Shared day tables per place',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'muhurta')],
    algorithm: [
      'General: find the days in the universal 2–4 week horizon (LUCKY_HORIZON_DAYS, default 28 days ahead) or today −7 … today +14 that the reference timezone place (us-east, us-central, us-mountain, us-west, in-ist) has no stored row for',
      "General: call the engine's muhurta deterministically (no model) for missing months at the place",
      'General: store one row per day (day_tables) with its calc version and a hash of the payload; one sky for every user in that reference timezone',
    ],
    source: 'docs/reading-engine/47 §3; 49 §4.1; 53 §4.6',
    code: 'src/reading/luckyTimes/service.ts pullDayTables, prepullUniversalDayTables; places.ts DAY_TABLE_PLACES, resolvePlacePreset',
    agents: ['lucky.day_tables'],
    accuracy: 'none',
    selectors: LUCKY_SELECTORS,
    contract: codeContract([PANCHANG_INPUT], 'day_tables.v1'),
  },
  {
    id: 'lucky.panchang_limbs',
    title: 'The five limbs of the day (vara, tithi, nakshatra, yoga, karana)',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'weekday'), c('panchang', 'tithi'), c('panchang', 'nakshatra'), c('panchang', 'yoga'), c('panchang', 'karana')],
    algorithm: [
      "General: read the day's five limbs from the place's stored day row, each with its end time (and full-day yogas/karanas when served)",
      "General: vara: the weekday and its lord, favoured or avoided per the act's scenario row; Amrita Siddhi weekday + star combination adds +1 (amrita_siddhi)",
      "General: tithi: its group (nanda, bhadra, jaya, rikta, purna; amavasya) per the scenario's tithi lists",
      "General: nakshatra: the Moon's star and its group per the scenario's star lists",
      `General: yoga (27 yogas, configurable via LUCKY_YOGA_AVOID / LUCKY_YOGA_FAVOUR): avoided — ${list(YOGA_AVOID_DEFAULT)}; favoured (+1, including Siddha #21) — ${list(YOGA_FAVOUR_DEFAULT)}`,
      'General: karana (11 karanas, configurable via LUCKY_KARANA_AVOID / LUCKY_FIXED_KARANA_AVOID / LUCKY_KARANA_FAVOUR / LUCKY_FIXED_KARANA_FAVOUR): avoided — Vishti (Bhadra) and the fixed karanas Shakuni, Chatushpada, Naga; favoured — Bava, Balava, Kaulava, Taitila, Gara, Vanija and Kimstughna (+1 on auspicious beginnings)',
      'General: the general limbs decide the day gate: an avoided yoga or karana span is cut out of every candidate like an avoid band, so a day it fills is gated out for the act (day reason yoga_avoid / karana_avoid); a favoured yoga adds +1 to a piece inside its span',
      "General: the day's yoga and karana (name and end hour) ride on each day of the range for the Why sheet",
      "Personal: the person's marks (lucky.personal_overlay) then move a window by ±1; they never open a gated day",
    ],
    source: 'docs/reading-engine/53 §4.6, 54 §6; Muhurta Chintamani; B.V. Raman, Muhurta',
    code: 'src/reading/luckyTimes/scenarios.ts yogaAvoid/yogaFavour/karanaAvoid/karanaFavour, yogaName, karanaName, isAmritaSiddhi; windows.ts dayLimbs, scenarioDay; service.ts getRange',
    agents: ['lucky.scenario_windows'],
    accuracy: 'staff',
    selectors: LUCKY_SELECTORS,
    contract: codeContract([inp('panchang', "the place's day rows today −7 … today +14: vara, tithi, nakshatra, yoga, karana with end times", 'panchang_day')], 'limbs.v1', 'lucky.avoid_bands'),
  },
];

// ---------------------------------------------------------------- Love and Self (planned: house-state engine, doc 46 Part B; digest readers, doc 53 §4.5)

interface LayerTarget {
  prefix: 'love' | 'self';
  board: 'love' | 'you';
  houses: string;
  houseNumbers: number[];
  vargas: string[];
  karakas: string;
  subjects: SubjectId[];
  /** the digest planet cards the layers read (doc 53 §4.5) */
  planets: string;
  /** the digest point rows the layers read */
  points: string;
  /** the layers built from the digest (src/reading/area/houseLayers.ts); the rest stay planned */
  built: { agent: string; config: string; layers: Partial<Record<string, string[]>> };
}

/** What the built layers do, written from src/reading/area/houseLayers.ts (doc 54 §3). */
const BUILT_LAYER_STEPS = (t: { houses: string; houseNumbers: number[]; vargas: string[] }): Record<string, string[]> => ({
  promise: [
    `For each of ${t.houses}: read the D1 house card from the digest`,
    "The lord in the house itself or in a house the engine labels kendra or trikona: +2; the lord's dignity exalted, own or moolatrikona: +2",
    'Each occupant and each graha drishti whose functional nature the engine labels benefic: +1 (malefic: −1, kept for the score only)',
    'SAV of the house ≥ 28: +1; a yoga in the register whose houses or planets include the house or its lord: +1 to +2 by class',
    "The lord's avastha scales the supports: x0.5 when mrita or sushupta, x1.25 when jagrat or deepta",
    "The area's planets: dignified in D1 +1; shadbala ratio ≥ 1.2 +1",
    'Each support becomes one plain line; the digest keys go in its evidence',
  ],
  affliction: [
    'The lord in a house the engine labels dusthana: 2; debilitated without a cancellation in the yoga register: 2; combust: 1 (no release); in planetary war: 1',
    "Saturn or a node (Love: also Mars) occupying the house: 1.5, aspecting it: 1; the same conjunct or aspecting the area's planets",
    'The named yogas of the area (Kemadruma for Self; Kalathra and Manglik for Love) and doshas on the houses, unless the register lists their cancellation; the Moon in gandanta for Self',
    "Each pressure's until-date: the end of the afflicting planet's period running today in the activation calendar (the main clock first, else any family); none when it is not running",
  ],
  protection: [
    "Jupiter aspecting or occupying the houses, aspecting or joining the area's planets, or aspecting the house of its points: +2",
    "Benefic argala on the houses (primary argala, not obstructed, functional benefic): +1; the house lord's dispositor dignified: +1",
    "A cancellation in the yoga register (neecha bhanga and the like) naming a house lord or one of the area's planets: +2",
    'The owning varga check: the varga house lord dignified (Love: D9 h7; Self: D9 h1): +2',
  ],
  activation: [
    `Read every activation row from 13 months back to 30 years ahead that activates houses ${t.houseNumbers.join(',')}, to level 2`,
    `Grade the period lord: functional benefic +1 / malefic −1; dignity in D1 ±1 and in ${t.vargas.find((v) => v !== 'D1') ?? 'D9'} ±1; it owns one of the houses +1, else owns a dusthana −1. A sign period is graded by the lord of that sign's D1 house card (+1 when that house is one of the area's)`,
    'Families vote like the Work board: main clock, conditional clock, sign clock, karaka clock, and the short clocks only when Yogini and Tithi Ashtottari agree; a system votes support at ≥ 0.5 and test at ≤ −0.5 of its level-weighted sum',
    'Windows ahead: level-2 periods inside 36 months land in a sub-area when their lord is one of its distinguishing planets (a sign period when it activates one of its houses); overlaps merge; a main-clock change inside 30 years is a turning point',
  ],
  transit: [
    "Read the kundli's stored sky overlay covering today (never fetched here); omitted with a note when none is stored",
    "Jupiter in one of the houses (the engine's house_from_lagna): a support until it moves on; Saturn: a pressure until it moves on; Rahu or Ketu: a pressure",
    'Self: a running sade sati span is a pressure until its end',
    'The layer is one vote in the tone',
  ],
  annual: [
    'Pick the year chart whose year dashas cover today (the tithi pravesha before the varsha chart)',
    "Each house's year lord in the house itself or a kendra/trikona of the year chart without debility: confirms; in a dusthana: contradicts",
    "The area's sahams in a kendra of the year chart: confirms (Love: santapa and paradara there contradict)",
    'The sum is one vote in the tone and one plain line under This year',
  ],
  varga: [
    `Read the owning divisional charts (${t.vargas.filter((v) => v !== 'D1').join(', ')}) from the digest for houses ${t.houseNumbers.slice(0, 3).join(', ')}`,
    'For each primary house: the natal D1 lord dignified in the owning varga supports (+1.5), debilitated tests (1.5); the varga house lord dignified or in a kendra/trikona supports (+1), in a dusthana or debilitated tests (1)',
    'A planet occupying the same house in D1 and in the owning varga (vargottama placement) supports (+1)',
    'The net side (agrees, disagrees or neutral) joins the board supports and pressures',
  ],
  nakshatra: [
    `Read the cusp stars of houses ${t.houseNumbers.slice(0, 3).join(', ')} and the star profile (Moon star, tara table) from the digest`,
    "When a primary house's cusp star lord is dignified or a functional benefic in D1: +1 support; when debilitated in D1: 1 pressure",
    "When a running period lord's star lord is the house's lord or one of the area's karakas, the period delivers through the star (+1.5 support)",
  ],
});

function houseStateLayers(t: LayerTarget): TechniqueDef[] {
  const vargaCharts = t.vargas.map((v) => c('divisional', v));
  const houseFilter = `D1,${t.vargas.filter((v) => v !== 'D1').join(',')} houses ${t.houseNumbers.join(',')}`;
  const selectors: TechniqueSelectors = { boards: [t.board], subjects: t.subjects, houses: t.houseNumbers, vargas: t.vargas };
  const houseIn = inp('house', houseFilter, 'house_card');
  const planetIn = inp('planet', `D1 and ${t.vargas[0] === 'D1' ? t.vargas[1] : t.vargas[0]} cards of ${t.planets}`, 'planet_card');
  const pointIn = inp('point', t.points, 'point_row');
  const yogaIn = inp('yoga', `yogas and doshas joining houses ${t.houseNumbers.join(',')} or their lords or ${t.planets}`, 'yoga_row');
  const steps = BUILT_LAYER_STEPS(t);
  const row = (name: string, title: string, section: string, charts: TechniqueChart[], algorithm: string[], inputs: ContractInput[], special?: string): TechniqueDef => {
    const fns = t.built.layers[name];
    return {
      id: `${t.prefix}.${name}`,
      title,
      category: t.prefix,
      board: t.board,
      status: fns ? 'built' : 'planned',
      charts,
      algorithm: fns ? steps[name]! : algorithm,
      ...(special ? { special } : {}),
      source: `docs/reading-engine/46 §${section}; 53 §4.5${fns ? '; 54 §3' : ''}`,
      code: fns ? `src/reading/area/houseLayers.ts ${fns.join(', ')}; ${t.built.config}; boardService.ts getAreaBoard` : 'not built (house-state engine, doc 46, read from the digest, doc 53 step 6)',
      agents: fns ? [t.built.agent] : [],
      accuracy: fns ? `area_checks:${t.prefix}` : 'none',
      selectors,
      contract: codeContract(inputs, fns ? 'area_board.v1' : 'house_state.v1'),
    };
  };
  const layers = [
    row('promise', `Natal promise of ${t.houses}`, 'B.2', [c('natal', 'facts'), c('natal', 'house_counts'), c('natal', 'dignities'), c('natal', 'aspects'), c('jaimini', 'argala'), c('ashtakavarga', 'sav'), c('natal', 'strength.bhava'), c('natal', 'yogas'), c('natal', 'doshas'), c('jaimini', 'arudhas'), c('natal', 'avasthas')], [
      `For ${t.houses}: lord in a kendra, trikona or the house itself +2; in 6, 8 or 12 −2`,
      "Lord's dignity +2 / −2 (neecha bhanga checked); functional benefic / malefic occupants and graha drishti ±1; rasi drishti ±0.5",
      'Argala net ±1; SAV of the sign ≥ 28 / ≤ 22 ±1; bhava bala rank top 4 / bottom 4 ±1',
      'Yogas that include the house or its lord +1 to +3; doshas touching it −1 to −2',
      `Natural karaka strong / weak ±1 (${t.karakas}); arudha of the house with benefics / malefics ±1; its special lagna +1`,
      "Lord's avastha: x1.25 awake, x0.5 dead; cap the sum to −8..+8; below −3 the house is not promised",
      'Each support is one row, "D1.h1 aspected_by Ju", with its digest key',
    ], [houseIn, planetIn, pointIn, yogaIn]),
    row('affliction', `Afflictions on ${t.houses}`, 'B.3', [c('natal', 'facts'), c('natal', 'dignities'), c('natal', 'aspects'), c('natal', 'doshas'), c('natal', 'avasthas'), c('natal', 'house_counts')], [
      'Lord in a dusthana; combust, in war or debilitated lord; malefic conjunction or drishti on the house or its lord',
      'Papakartari, nodes on the axis, dosha membership, lord in a dead avastha',
      'Each affliction names its release (its own period, a neecha bhanga pair, a benefic period with D1 and the varga agreeing) or none: the release date is the end of the afflicting planet\'s running period in the activation calendar',
      'Afflictions set the baseline and name the blocker; they never flip a verdict alone',
    ], [houseIn, planetIn, yogaIn, inp('activation', `running and next periods of the afflicting planets, houses ${t.houseNumbers.join(',')}`, 'activation_row')]),
    row('protection', `What protects ${t.houses}`, 'B.3', [c('natal', 'aspects'), c('natal', 'dignities'), c('jaimini', 'argala'), c('natal', 'yogas'), c('natal', 'avasthas'), ...vargaCharts], t.prefix === 'self' ? [
      "Jupiter's drishti on the lagna or the Moon (digest house card aspected_graha)",
      'Neecha Bhanga and the other cancellations in the yoga register',
      'Benefic argala on houses 1, 4 and 5',
      "The dispositor of the lagna lord being strong (the digest planet card's dispositor chain and dignity)",
      'Each protection is one row with its digest key; protections raise the floor of the verdict and never add a promise',
    ] : [
      'Jupiter on house 7, on Venus or on UL (digest house and point cards aspected_graha)',
      "The D9 7th lord dignified (digest house card D9.h7 lord_dignity)",
      'Benefic argala on UL and on house 7',
      'Each protection is one row with its digest key; protections raise the floor of the verdict and never add a promise',
    ], [houseIn, planetIn, pointIn, yogaIn]),
    row('activation', `Activation of ${t.houses} by every dasha system`, 'B.4', [c('dasha', 'vimshottari'), c('dasha', 'conditional'), c('dasha', 'narayana'), c('dasha', 'chara'), c('dasha', 'karaka'), c('annual', 'tithi_pravesha_dasha'), c('dasha', 'yogini'), c('dasha', 'tithi_ashtottari'), ...vargaCharts], [
      'Seven families: main graha clock, conditional clock, rasi clock, karaka clock, annual clock, transit clock, short confirmers (Yogini and Tithi Ashtottari voting only when they agree)',
      'Polarity of each running planet to the house: supports when it lords, occupies, signifies, or lords the 5th, 9th or 11th from it; tests when it lords 6, 8 or 12 or sits 6, 8 or 12 from it',
      `A dasha vote counts only when D1 and the owning varga (${t.vargas[0]}) agree; D9 breaks a tie; D60 only with a birth time to the minute`,
      'One planet, one vote across the graha clocks',
      "Periods thirty years ahead from the activation calendar, graded benefic or malefic by the period lord's nature and dignity in D1 and D9",
    ], [inp('activation', `every served system, periods from today to +30 years activating houses ${t.houseNumbers.join(',')}`, 'activation_row'), planetIn]),
    row('transit', `Transits over ${t.houses}`, 'B.5', [c('transit', 'transit_contacts'), c('transit', 'double_transit'), c('transit', 'sade_sati'), c('transit', 'eclipses'), c('ashtakavarga', 'transit_ashtakavarga')], [
      'Slow planets in the house: Jupiter supports, Saturn tests unless 3, 6, 10 or 11 from the Moon with a bindu, Rahu amplifies, Ketu detaches',
      'Slow planets on the lord, karaka or arudha (contacts with stations); double transit on the house',
      'Sade sati and dhaiya phases; eclipses on the axis or the lord, with dates',
      'Transit ashtakavarga bindus in the planet’s own BAV support or test',
    ], [inp('transit', `shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses ${t.houseNumbers.join(',')}, their lords and arudhas, ±24 months`, 'transit_row'), houseIn]),
    row('annual', `This year's chart for ${t.houses}`, 'B.6', [c('annual', 'tithi_pravesha'), c('annual', 'sahams'), c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'tithi_pravesha_dasha')], [
      "The year chart's lord of the house and its place: kendra/trikona with dignity confirms, 6/8/12 contradicts",
      'Occupants, aspects and argala in the year chart at half weight; where the natal lord falls this year',
      "The house's sahams in a kendra of the year chart with a strong lord",
      'The running Mudda, Patyayini or year tithi ashtottari lord gives the month',
      'Returns confirms, amplifies, contradicts or silent; changes confidence by one step and never makes a verdict alone',
    ], [inp('annual', `TP and VP of the current, previous and next year, houses ${t.houseNumbers.join(',')}, their sahams and year dashas`, 'annual_row')], 'Muntha, the year lord and Tajaka yogas are engine gaps'),
    row('varga', `Owning divisional chart of ${t.houses}`, 'B.7', vargaCharts, [
      `Owning varga first: ${t.vargas.join(', ')}`,
      "The natal lord of the house in the varga (sign, house, dignity); the varga's own house and lord; vargottama",
      "The running period lord's place in the varga; the arudha of the house in the varga",
      'Returns agrees when its net side matches the activation side; a dasha vote counts only then',
    ], [houseIn, planetIn, inp('point', `arudhas of houses ${t.houseNumbers.join(',')} in ${t.vargas.join(', ')}`, 'point_row')]),
    row('nakshatra', `Nakshatra charter of ${t.houses}`, 'B.8', [c('nakshatra', 'cusp_nak'), c('nakshatra', 'star_lord'), c('nakshatra', 'occupant_stars')], [
      "Cusp star of the house: its mission; the lord's star: through whom it delivers; occupants' stars: their flavour",
      'One charter line per star and house from the reviewed charter table (config, with its source)',
      "When the running PD lord's star lord is the house's lord or karaka, the vote is delivered through the star: confidence one step up",
    ], [inp('star', 'Moon star, lagna star and the tara table', 'star_profile'), inp('house', `${houseFilter} (cusp_star column)`, 'house_card'), planetIn]),
  ];
  return layers;
}

const LOVE_PLANNED = houseStateLayers({
  prefix: 'love', board: 'love', houses: 'house 7', houseNumbers: [7, 5, 11, 2, 4, 8, 12], vargas: ['D9', 'D7', 'D30'], karakas: 'Venus for the 7th',
  subjects: ['marriage_relationship'], planets: 'Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord', points: 'UL, A7, DK, AL',
  built: { agent: 'area.love_board', config: 'love.ts LOVE', layers: { promise: ['promiseLayer'], affliction: ['afflictionLayer', 'releaseOf'], protection: ['protectionLayer'], activation: ['gradeRow', 'familyVotes', 'aheadWindows'], transit: ['transitLayer'], annual: ['currentYear', 'annualLayer'], varga: ['vargaLayer'], nakshatra: ['nakshatraLayer'] } },
});
const SELF_PLANNED = houseStateLayers({
  prefix: 'self', board: 'you', houses: 'houses 1, 4 and 5 with the Moon', houseNumbers: [1, 4, 5, 9, 12], vargas: ['D1', 'D9', 'D20', 'D24', 'D12', 'D4', 'D7', 'D60'], karakas: 'Sun for the 1st, Moon and Mercury for the 4th, Jupiter for the 5th',
  subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha'], planets: 'the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK', points: 'AK, SL, AL',
  built: { agent: 'area.self_board', config: 'self.ts SELF', layers: { promise: ['promiseLayer'], affliction: ['afflictionLayer', 'releaseOf'], protection: ['protectionLayer'], activation: ['gradeRow', 'familyVotes', 'aheadWindows'], transit: ['transitLayer'], annual: ['currentYear', 'annualLayer'], varga: ['vargaLayer'], nakshatra: ['nakshatraLayer'] } },
});

const SELF_EXTRA_BUILT: TechniqueDef[] = [
  {
    id: 'self.character_arc',
    title: 'Character evolution across 3 decades (Last 10 Years -> Who You Are Now -> Next 10 Years)',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: [
      c('natal', 'facts'),
      c('natal', 'dignities'),
      c('divisional', 'D1'),
      c('divisional', 'D9'),
      c('divisional', 'D10'),
      c('jaimini', 'charakaraka'),
      c('dasha', 'vimshottari'),
      c('dasha', 'narayana'),
    ],
    algorithm: [
      'Compute three 10-year life windows relative to today (asOf) and the person age (Last 10 Years e.g. their 20s if 30, Who You Are Now, and Next 10 Years)',
      'Anchor the core temperament from D1 Lagna, Lagna lord (Paka Lagna), D9 Navamsa maturation of L1 and Moon, Sun, and Atmakaraka (AK)',
      'Select the dominant Vimshottari Mahadasha/Antardasha and Narayana Rasi Dasha lords covering each 10-year window from kundli_activation',
      'Translate the ruling planet nature, D1/D9 dignity, and activated house themes into plain-language traits, growth lessons, and practical shifts with zero chart jargon on the surface',
    ],
    source: 'BPHS Ch. 46-51 (Vimshottari Dasha Phala); Sanjay Rath Crux of Vedic Astrology (Lagna, Paka Lagna & D9 Maturation)',
    code: 'src/reading/area/selfCharacterAndJoy.ts buildSelfCharacterArc; houseLayers.ts buildBoard',
    agents: ['area.self_board'],
    accuracy: 'area_checks:self',
    selectors: {
      boards: ['you'],
      subjects: ['general_life_direction', 'education_learning', 'spirituality_moksha'],
      houses: [1, 4, 5, 9, 10],
      vargas: ['D1', 'D9', 'D10'],
    },
    contract: codeContract(
      [
        inp('house', 'D1,D9,D10 houses 1,4,5,9,10', 'house_card'),
        inp('planet', 'D1,D9,D10 cards of L1, Su, Mo, AK and running MD/AD lords', 'planet_card'),
        inp('point', 'AK, AmK, AL', 'point_row'),
        inp('activation', 'vimshottari and rasi periods from -10 years to +10 years', 'activation_row'),
      ],
      'self_character_arc.v1',
    ),
  },
  {
    id: 'self.personality_joy',
    title: 'Vedic Moon & Mercury personality and what brings joy & fulfillment',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: [
      c('natal', 'facts'),
      c('natal', 'dignities'),
      c('natal', 'aspects'),
      c('divisional', 'D1'),
      c('divisional', 'D9'),
      c('divisional', 'D24'),
      c('nakshatra', 'janma'),
    ],
    algorithm: [
      'Read the Moon (Chandra: Manas) in D1 and D9: sign, house, dignity, Janma Nakshatra (StarProfile.moonStar), benefic/malefic drishti, and the 4th house (Sukha Bhava) to map emotional rhythm and what restores inner peace',
      'Read Mercury (Budha: Buddhi, play, wit & curiosity) in D1, D9, and D24: sign, house, dignity, and aspects alongside the 5th house (creative joy) and 3rd house (hands-on craft) to map conversational style and intellectual flow',
      'Synthesize four plain-language joy & fulfillment pillars: Everyday Joy & Flow (Moon + 4H), Mind, Curiosity & Play (Mercury + 5H), Social & Creative Recharge (3H + 11H + Moon/Mercury), and Restorative Sanctuary (D9 Moon + 4H/12H)',
      'Keep all astrological identifiers inside structured evidence[] while rendering 100% digested plain English on the board',
    ],
    source: 'BPHS Ch. 3, 15-16 (Chandra & Budha Karakatvas, 4H Sukha & 5H Buddhi); Taittiriya Brahmana (Janma Nakshatra)',
    code: 'src/reading/area/selfCharacterAndJoy.ts buildSelfPersonalityAndJoy; houseLayers.ts buildBoard',
    agents: ['area.self_board'],
    accuracy: 'area_checks:self',
    selectors: {
      boards: ['you'],
      subjects: ['general_life_direction', 'education_learning', 'health_body'],
      houses: [1, 3, 4, 5, 11, 12],
      vargas: ['D1', 'D9', 'D24'],
    },
    contract: codeContract(
      [
        inp('house', 'D1,D9,D24 houses 1,3,4,5,11,12', 'house_card'),
        inp('planet', 'D1,D9,D24 cards of Mo, Me, L4, L5, L3, Ju, Ve', 'planet_card'),
        inp('star', 'Moon star, lagna star and tara table', 'star_profile'),
      ],
      'self_personality_joy.v1',
    ),
  },
];

/** The Love sub-areas the companion memory's love.status selects (doc 53 §4.5; doc 46 §B.12): planned rows over the same layers. */
const LOVE_SUBAREAS: TechniqueDef[] = (
  [
    { name: 'meet', title: 'Meeting someone', statuses: ['single', 'dating'], steps: ['Promise and activation of house 7 and UL for a new bond; Venus and the 7th lord running or transited', 'Windows from the activation calendar where house 7, 5 or 11 is activated with D9 agreeing'] },
    { name: 'health', title: 'How the relationship is', statuses: ['dating', 'committed', 'married'], steps: ['Present state of house 7 and D9 h7: support and strain this month from the activation, transit and annual layers', 'The tone from the votes of the layers (doc 45 §7)'] },
    { name: 'reconcile', title: 'Strain and reconciling', statuses: ['separated', 'complicated'], steps: ['Afflictions on house 7, its lord, Venus and UL and their release dates (love.affliction)', 'Periods ahead where the afflicting planet stops running and a supporter of 7 or 5 starts (love.activation)', 'Protections that hold the bond (love.protection)'] },
  ] as const
).map((s) => ({
  id: `love.${s.name}`,
  title: s.title,
  category: 'love' as const,
  board: 'love' as const,
  status: 'built' as const,
  charts: [c('natal', 'facts'), c('divisional', 'D9'), c('dasha', 'vimshottari'), c('transit', 'transit_contacts')],
  algorithm: [...s.steps, `Leads the Love board when the companion memory says love.status is ${s.statuses.join(' or ')} (love.ts LOVE_LEAD); its windows show only when love.status fits it (LOVE_FIT)`],
  source: 'docs/reading-engine/53 §4.5; 46 §B.12; 54 §3',
  code: 'src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard',
  agents: ['area.love_board'],
  accuracy: 'area_checks:love',
  selectors: { boards: ['love' as const], subjects: ['marriage_relationship' as const], houses: [7, 5, 11], vargas: ['D9'], facts: { 'love.status': [...s.statuses] } },
  contract: codeContract([inp('findings', 'the eight Love layers of this kundli (love.promise … love.nakshatra)', 'findings_in')], 'board_subarea.v1'),
}));

// ---------------------------------------------------------------- General Reading (chat): graph analysts and oracle readers

/** The frame vargas across all 17 subjects (packs/frames.ts): the primary first per subject. */
const FRAME_VARGAS = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10'].map((v) => c('divisional', v));
const ANALYST_STEPS = (sections: string): string[] => [
  'Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other',
  `It is sent the evidence pack sections ${sections}, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier`,
  'The model returns structured findings whose claims cite evidence ids in the pack',
  'Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it',
];
/** Every subject on the chat board (doc 53 §4.4 "always"). */
const GENERAL_SELECTORS: TechniqueSelectors = { subjects: ALL_SUBJECTS, boards: ['chat'] };
const analystContract = (inputs: ContractInput[], system: string, output: string): TechniqueContract => ({ inputs, system, user: ANALYST_USER_FIELDS, output, synthesizer: 'general.oracle' });
/** A deterministic reader of the General Reading (doc 53 step 5): code over the digest, findings.v2 to the Oracle. */
const codeReaderContract = (inputs: ContractInput[]): TechniqueContract => ({ inputs, system: 'none', user: [], output: 'findings.v2', synthesizer: 'general.oracle' });
const CODE_READER_STEPS = (analyst: string, reads: string): string[] => [
  `Runs only when the kundli's digest is ready, on every subject the selectors pick, in the graph and the oracle flows (src/techniques/use.ts); code, no model`,
  `Reads the digest section of the subject's evidence pack (packs/digestSource.ts digestSection): ${reads}`,
  'Each claim takes its side and weight from the rule table (src/reading/codeReaders/rules.ts CODE_READER_RULES, with sources) and cites the digest rows it read as evidence ids (digest.<section>.<digest key>.<field>); at most 8 claims, heaviest first',
  `Layer score: the signed weights summed, a third of it rounded, clamped to -3..+3; the finding joins reconcile and the oracle brief like an analyst's (analyst ${analyst})`,
];
const FRAME_HOUSES = inp('house', "D1 and the frame's vargas, the frame's houses", 'house_card');
const FRAME_LORDS = inp('planet', "D1 cards of the frame's house lords and karakas", 'planet_card');
const DOC33 = 'docs/reading-engine/33';
const TEXT_QUESTION = inp('text', 'the question, the history of the thread, the clarify turns', 'text_in');

const GENERAL: TechniqueDef[] = [
  {
    id: 'general.promise',
    title: 'House promise analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), ...FRAME_VARGAS, c('jaimini', 'arudhas'), c('jaimini', 'special_lagnas')],
    algorithm: [...ANALYST_STEPS('base, frame, detail, varga, arudha'), 'The D1 house that owns the subject leads (doc 46 §B.11); the frame names its vargas, lords, karakas and arudhas'],
    special: 'Becomes general.house_promise in D3 (doc 53 §4.4); the id stays so tagged runs keep joining. Reads the digest when it is ready: base, detail, varga and arudha from its house, planet and point rows',
    source: 'docs/reading-engine/03 §3; 53 §4.4',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.promise; packs/digestSource.ts overlayDigest',
    agents: ['reading.analyst.promise'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: analystContract([FRAME_HOUSES, FRAME_LORDS, inp('point', "arudhas and special lagnas of the frame", 'point_row'), inp('yoga', "yogas touching the frame's houses or their lords", 'yoga_row')], 'src/reading/prompts/v2/promise.md', 'findings.v2'),
  },
  {
    id: 'general.varga_dynamics',
    title: 'Varga dynamics analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: ['D2', 'D4', 'D7', 'D9', 'D10', 'D12', 'D24', 'D30', 'D60', 'D16', 'D20', 'D27', 'D40', 'D45', 'D81', 'D108', 'D144'].map((v) => c('divisional', v)),
    algorithm: [
      ...CODE_READER_STEPS('varga_dynamics', "the house and planet cards of D1 and of each frame varga the digest holds (D9 for marriage, D10 for career, D2, D4, D7, D24, D12, D30, D60 by frame); the deeper set (D16, D20, D27, D40, D45, D81, D108, D144) joins when the question type is why_meaning or the horizon is life"),
      "For each frame house and varga: the D1 lord strong (exalted, moolatrikona, own) in D1 and in the varga supports (weight 2); debilitated in both obstructs (weight 2); strong in one and debilitated in the other is neutral (weight 1, promise and form disagree)",
      'A planet occupying the frame house in D1 and the same house in the varga is neutral (weight 1, the bond repeats)',
    ],
    special: 'Code-path reader first (doc 53 step 5); a model reader on the same contract (R03 curriculum) waits for the spend yes',
    source: 'docs/reading-engine/53 §4.4; 33 R3; BPHS ch. 6-7; PVR ch. 9',
    code: 'src/reading/codeReaders/readers.ts vargaDynamics; rules.ts',
    agents: ['reading.code.varga_dynamics'],
    accuracy: 'staff',
    selectors: { ...GENERAL_SELECTORS, vargas: ['D2', 'D4', 'D7', 'D9', 'D10', 'D12', 'D24', 'D30', 'D60', 'D16', 'D20', 'D27', 'D40', 'D45', 'D81', 'D108', 'D144'] },
    contract: codeReaderContract([inp('house', "D1 and each frame varga, the frame's houses (lord, lord_dignity, occupants)", 'house_card'), inp('planet', "D1 and each frame varga, the frame's house lords (dignity)", 'planet_card')]),
  },
  {
    id: 'general.dasha',
    title: 'Dasha analyst (all systems)',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), ...FRAME_VARGAS, c('dasha', 'vimshottari'), c('dasha', 'narayana'), c('dasha', 'conditional'), c('dasha', 'chara'), c('dasha', 'karaka'), c('dasha', 'yogini'), c('dasha', 'tithi_ashtottari')],
    algorithm: [...ANALYST_STEPS('base, frame, detail, varga, dasha'), "The dasha section holds the Vimshottari periods inside the horizon, each period lord's place in the frame vargas, the running Narayana sign, and (when the digest and activation calendar are ready) every served system overlapping the horizon in dasha.activation"],
    special: 'Becomes general.dasha_all_systems in D3 (doc 53 §4.4): every served system from the activation calendar, grouped into the seven families of doc 46 §B.4; the id stays so tagged runs keep joining. Reads the digest when it is ready for base, detail, varga and dasha.activation',
    source: 'docs/reading-engine/03 §3; 53 §4.4',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.dasha; packs/digestSource.ts overlayDigest',
    agents: ['reading.analyst.dasha'],
    accuracy: 'staff',
    selectors: { ...GENERAL_SELECTORS, horizons: ALL_HORIZONS },
    contract: analystContract([inp('activation', "periods inside the horizon activating the frame's houses, every served system, grouped by family; Vimshottari MD/AD/PD at level 3; dasha.applicable", 'activation_row'), FRAME_LORDS, FRAME_HOUSES], 'src/reading/prompts/v2/dasha.md', 'findings.v2'),
  },
  {
    id: 'general.annual',
    title: 'Annual set analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('annual', 'tithi_pravesha'), c('annual', 'tithi_pravesha_dasha'), c('annual', 'varsha'), c('annual', 'sahams'), c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'tajaka')],
    algorithm: [...ANALYST_STEPS('base, frame, annual'), 'Runs when the graph or the digest has the Tithi Pravesha / Varsha year charts (current, previous and next year in D1, D9, D10), their year dashas, sahams, muntha, year lord and Tajaka yogas for the question'],
    special: 'Becomes general.annual_set in D3 (doc 53 §4.4): the current, previous and next year (TP and VP, D1, D9, D10) with their year dashas, sahams, muntha, year lord and Tajaka yogas when served; the id stays so tagged runs keep joining. Selected for horizons within 24 months (so the oracle reader R11 runs only then too). Reads the digest when it is ready for base and the multi-year annual set',
    source: 'docs/reading-engine/28 §5; 53 §4.4',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.annual; packs/digestSource.ts overlayDigest',
    agents: ['reading.analyst.annual'],
    accuracy: 'staff',
    selectors: { ...GENERAL_SELECTORS, horizons: ['now', '3m', '6m', '1y', 'custom'] },
    contract: analystContract([inp('annual', "TP and VP of the current, previous and next year, D1, D9, D10, the frame's houses; year dashas; sahams in the frame's houses; muntha and year lord when served", 'annual_row')], 'src/reading/prompts/annual.md', 'findings.v2'),
  },
  {
    id: 'general.transit',
    title: 'Transit analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('jaimini', 'arudhas'), c('dasha', 'vimshottari'), c('dasha', 'narayana'), c('transit', 'transit_overlay'), c('transit', 'transit_contacts'), c('transit', 'transit_at')],
    algorithm: [...ANALYST_STEPS('base, frame, arudha, dasha, transits and transit_at'), "The transits section holds the selected transit rows for the frame's houses and natal points, with the natal-degree contacts clipped to the horizon; transit_at is the sky at an asked date"],
    special: 'Revised in D3 (doc 53 §4.4): contacts to the lords and karakas, double transit, sade sati, eclipses and transit ashtakavarga scores from the shared sky and the overlay',
    source: 'docs/reading-engine/03 §3; 28 §5; 53 §4.4',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.transit',
    agents: ['reading.analyst.transit'],
    accuracy: 'staff',
    selectors: { ...GENERAL_SELECTORS, horizons: ALL_HORIZONS },
    contract: analystContract([inp('transit', "shared sky with the overlay for the frame's houses, lords and karakas inside the horizon; double transit; sade sati; eclipses; transit ashtakavarga", 'transit_row'), FRAME_LORDS], 'src/reading/prompts/v2/transit.md', 'findings.v2'),
  },
  {
    id: 'general.nakshatra',
    title: 'Nakshatra analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('nakshatra', 'janma'), c('dasha', 'vimshottari'), c('transit', 'transit_overlay')],
    algorithm: [...ANALYST_STEPS('base, frame, detail, dasha, transits'), "Revised in D3 (doc 53 §4.4): the star profile, the cusp stars of the frame's houses and the star lords' places from the planet cards"],
    source: 'docs/reading-engine/03 §3; 53 §4.4',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.nakshatra',
    agents: ['reading.analyst.nakshatra'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: analystContract([inp('star', 'Moon star, lagna star, the tara table, gandanta flags', 'star_profile'), inp('house', "D1, the frame's houses (cusp_star column)", 'house_card'), inp('planet', "D1 cards of the star lords of the frame's cusps and the Moon", 'planet_card')], 'src/reading/prompts/v2/nakshatra.md', 'findings.v2'),
  },
  {
    id: 'general.strength_yoga',
    title: 'Strength and yoga analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'yogas'), c('natal', 'doshas'), c('natal', 'strength'), c('ashtakavarga', 'sav'), c('natal', 'avasthas')],
    algorithm: [
      ...CODE_READER_STEPS('strength_yoga', "the D1 yoga register rows that join a frame house or a frame lord or karaka, the SAV of the frame houses and the shadbala of the frame lords"),
      'A yoga the engine lists as present supports (weight 2) and goes to graces; a row of class dosha obstructs (weight 2)',
      'SAV of a frame house: 28 or more supports, 22 or less obstructs (weight 1)',
      "Shadbala ratio of a frame lord (the engine's rupas over the required): 1 or more supports, below 1 obstructs (weight 1); the rank is quoted",
    ],
    special: 'Code-path reader first (doc 53 step 5); a model reader on the same contract (R05, R06 curricula) waits for the spend yes',
    source: 'docs/reading-engine/53 §4.4; 33 R5, R6; BPHS ch. 27, 34-41, 66-72',
    code: 'src/reading/codeReaders/readers.ts strengthYoga; rules.ts',
    agents: ['reading.code.strength_yoga'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: codeReaderContract([inp('yoga', "D1 yogas, doshas and cancellations joining the frame's planets or houses", 'yoga_row'), inp('planet', "D1 cards of the frame's lords and karakas (shadbala_rank, shadbala ratio)", 'planet_card'), inp('house', "D1, the frame's houses (sav column)", 'house_card')]),
  },
  {
    id: 'general.jaimini',
    title: 'Jaimini analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('jaimini', 'charakaraka'), c('jaimini', 'arudhas'), c('jaimini', 'argala'), c('dasha', 'narayana'), c('dasha', 'chara')],
    algorithm: [
      ...CODE_READER_STEPS('jaimini', "the D1 point rows AK, AmK, DK, UL, AL and the frame's chara karakas and A-houses, the class of the house each sits in, and the argala lists of the frame houses"),
      'A point in a house the engine classes kendra or trikona supports, in a dusthana obstructs (weight 1)',
      'Argala on a frame house: more planets in primary argala than obstructing them supports (weight 1); as many or more obstructing is neutral (weight 1)',
      'The Narayana and Chara rasi periods inside the horizon that activate a frame house or its lord support (weight 1, cited from digest.rasi)',
    ],
    special: 'Code-path reader first (doc 53 step 5); a model reader on the same contract (R04 curriculum) waits for the spend yes',
    source: 'docs/reading-engine/53 §4.4; 33 R4; Jaimini Upadesa Sutras 1.1.5-9; PVR ch. 21-22',
    code: 'src/reading/codeReaders/readers.ts jaimini; rules.ts',
    agents: ['reading.code.jaimini'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: codeReaderContract([inp('point', 'AK, AmK, DK, UL, AL and the chara karakas and A-houses of the frame', 'point_row'), inp('house', "D1, the frame's houses and the houses the points sit in (argala, class columns)", 'house_card')]),
  },
  {
    id: 'general.prashna',
    title: 'Question chart analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('natal', 'prashna')],
    algorithm: [...ANALYST_STEPS('base, frame, prashna'), 'Runs only when the graph has the chart of the question moment'],
    source: 'docs/reading-engine/28 §5; 53 §4.4',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.prashna',
    agents: ['reading.analyst.prashna'],
    accuracy: 'staff',
    selectors: { ...GENERAL_SELECTORS, slots: ['prashna'] },
    contract: analystContract([inp('prashna', 'the cast of the question moment', 'prashna_card'), FRAME_HOUSES], 'src/reading/prompts/prashna.md', 'findings.v2'),
  },
  {
    id: 'general.person',
    title: 'The person in your chart',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('natal', 'aspects'), c('divisional', 'D12'), c('divisional', 'D9'), c('divisional', 'D7'), c('divisional', 'D3'), c('dasha', 'vimshottari')],
    algorithm: [
      "The person named in the question (mother, father, spouse, child, sibling; oracle/readers.ts personIn), else the person subject's (spouse for marriage, child for children, sibling for siblings), maps to a house, a varga and a natural karaka of the owner's chart (codeReaders/rules.ts PERSON_SIGNIFIERS); the reading never uses another person's birth data",
      ...CODE_READER_STEPS('person', "the person's house cards in D1 and the relationship varga and the karaka's planet cards"),
      "The lord of the person's house, its occupants and the karaka: strong (exalted, moolatrikona, own) supports, debilitated obstructs (weight 2); the house's SAV by the 28 / 22 rule (weight 1); every claim is about the person",
    ],
    special: 'Selected for the person subjects and, by an any-of rule in src/techniques/use.ts, for the clarify slot other_person on any subject; the oracle flow keeps its model reader R13 beside it',
    source: 'docs/reading-engine/53 §4.4; 33 R13; BPHS ch. 3, 32 (karakas)',
    code: 'src/reading/codeReaders/readers.ts personReader; rules.ts',
    agents: ['reading.code.person'],
    accuracy: 'staff',
    selectors: { boards: ['chat'], subjects: ['children', 'siblings', 'marriage_relationship'] },
    contract: codeReaderContract([inp('house', "D1 and the person's varga (D12, D9, D7, D3), the person's house", 'house_card'), inp('planet', "D1 and the person's varga, the person's karaka", 'planet_card')]),
  },
  {
    id: 'general.reader',
    title: 'Oracle readers (R01–R14, P1–P3)',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [
      c('natal', 'yogas'), c('natal', 'doshas'), c('natal', 'aspects'), c('jaimini', 'argala'), c('natal', 'bhava'), c('divisional', 'D9'), c('divisional', 'D30'), ...FRAME_VARGAS.filter((v) => v.id !== 'D9'),
      c('dasha', 'vimshottari'), c('dasha', 'narayana'), c('dasha', 'chara'), c('dasha', 'yogini'), c('dasha', 'tithi_ashtottari'), c('dasha', 'dwisatpathi'), c('dasha', 'applicable'),
      c('natal', 'strength'), c('transit', 'transit_overlay'), c('annual', 'tithi_pravesha'), c('annual', 'varsha'), c('annual', 'sahams'), c('annual', 'mudda'), c('annual', 'patyayini'), c('natal', 'prashna'), c('natal', 'sphutas'),
    ],
    algorithm: [
      'A rule on the question picks which readers run (never a model); the tier sets how many',
      'Each reader gets one slice of the stored tables (its types) clipped to the horizon and the frame houses, and its own curriculum and budget',
      'Natal readers are not sent the question, so their findings are reused across questions',
      'Every call holds a reservation from the cost guard; a reader past the join deadline is dropped',
    ],
    special: 'In D3 the CHART CORE becomes the digest house and planet cards of D1 plus the frame vargas (doc 53 §4.2)',
    source: 'docs/reading-engine/33 §2; 39 §4.1; 53 §4.2',
    code: 'src/reading/oracle/readers.ts READERS; runReader.ts',
    agents: ['reading.reader'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: {
      inputs: [
        inp('house', 'CHART CORE (nine stored types) and D1 plus the frame vargas, the frame houses', 'house_card'),
        inp('planet', 'CHART CORE: every planet in D1', 'planet_card'),
        inp('yoga', 'present yogas and doshas (R01, R06)', 'yoga_row'),
        inp('point', 'arudhas and argala of the frame (R03, R04)', 'point_row'),
        inp('activation', 'Vimshottari and the other dasha systems inside the horizon (R08, R09, R04)', 'activation_row'),
        inp('transit', "the question's transit rows (R07, R10, R13, P1–P3)", 'transit_row'),
        inp('annual', 'TP, VP, sahams, Mudda and Patyayini of the years in the horizon (R11)', 'annual_row'),
        inp('prashna', 'the cast when the question is prashna-eligible (R12)', 'prashna_card'),
      ],
      system: 'src/reading/prompts/readers/_shared.md',
      user: ANALYST_USER_FIELDS,
      output: 'findings.v2',
      synthesizer: 'general.oracle',
    },
  },
  {
    id: 'general.oracle',
    title: 'Oracle and synthesizer',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [],
    algorithm: [
      'Join the readers (or the graph analysts) into a brief',
      'Write the answer from the findings, streaming it',
      'An addendum may follow when the validator finds a missing part',
      'In D3 it also receives the digest rows the findings cite (by key) and the confirmed person_facts (doc 53 §4.2, §4.4)',
    ],
    source: 'docs/reading-engine/39 §4.1; 41; 53 §4.4',
    code: 'src/reading/oracle/flow.ts; src/reading/run.ts (synthesize)',
    agents: ['reading.oracle', 'reading.synth'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: { inputs: [inp('findings', 'every finding of the readers or analysts of this query, with the digest rows they cite', 'findings_in'), TEXT_QUESTION], system: 'src/reading/prompts/oracle/system.md', user: ['TODAY', 'SUBJECT', 'FRAME', 'HORIZON', 'REAL_WANT', 'QUESTION', 'FACTS', 'TEMPLATE'], output: 'answer.markdown', synthesizer: 'general.validator' },
  },
  {
    id: 'general.validator',
    title: 'Validator',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [],
    algorithm: [
      'After the answer has gone out, rules check it answered the question (under 5 ms, no model)',
      'Then a cheap model call with a 2 s budget; on any failure the rules stand',
      'It reports; the flow decides whether one loop back through at most two readers runs',
    ],
    source: 'docs/reading-engine/39 §4.1',
    code: 'src/reading/oracle/validator.ts',
    agents: ['reading.validator'],
    accuracy: 'staff',
    selectors: GENERAL_SELECTORS,
    contract: { inputs: [inp('text', 'the question, the clarify turns and the answer', 'text_in')], system: 'src/reading/prompts/oracle/validator.md', user: ['QUESTION', 'CLARIFY_TURNS', 'ANSWER'], output: 'validator.v1' },
  },
  {
    id: 'general.intake',
    title: 'Intake',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [],
    algorithm: ['Read the question into an intent: subjects, horizon, question type, format and named planets, and nothing else'],
    source: 'docs/reading-engine/41',
    code: 'src/reading/nodes/intake.ts',
    agents: ['reading.intake'],
    accuracy: 'staff',
    selectors: { boards: ['chat'] },
    contract: { inputs: [TEXT_QUESTION], system: 'src/reading/prompts/intake.md', user: ['TODAY', 'QUESTION', 'HISTORY'], output: 'intent.v1' },
  },
  {
    id: 'general.clarify',
    title: 'Clarify',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [],
    algorithm: [
      'Classify the question into a bucket by rules first',
      'Phrase, resolve or ask the question-chart detail with a small model (900 ms budget), while the chart loads in the background',
      'Declined topics are decided here and their text is never kept',
      'Its confirmed intent (subject, horizon, question type, slots) and the companion memory select the techniques of the query (doc 53 §4.3 selectTechniques)',
    ],
    source: 'docs/reading-engine/13; 48; 53 §4.3',
    code: 'src/reading/clarify/planner.ts; service.ts; monitor.ts',
    agents: ['reading.clarify', 'reading.clarify_monitor'],
    accuracy: 'staff',
    selectors: { boards: ['chat'] },
    contract: { inputs: [TEXT_QUESTION, inp('text', "the intake's intent: bucket, subjects, horizon, the slots filled and missing", 'text_in')], system: 'db:clarify.system', user: ['TODAY', 'QUESTION', 'BUCKET', 'SLOTS', 'HISTORY'], output: 'intent.v1' },
  },
];

// ---------------------------------------------------------------- The digest (doc 53 §4.1): code techniques, once per kundli

/** The digest precedes every board and reading (doc 53 §4.7 gate), so its rows select on every board. */
const DIGEST_SELECTORS: TechniqueSelectors = { boards: ALL_BOARDS };

const DIGEST: TechniqueDef[] = [
  {
    id: 'digest.build',
    title: 'Kundli digest (the first-time breakdown)',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'dignities'), c('natal', 'aspects'), c('jaimini', 'argala'), c('jaimini', 'arudhas'), c('natal', 'house_counts'), c('ashtakavarga', 'sav'), c('natal', 'facts'), c('natal', 'avasthas'), c('natal', 'strength.shadbala'), c('natal', 'benefic_malefic'), c('natal', 'yogas'), c('natal', 'doshas'), c('jaimini', 'charakaraka'), c('natal', 'sphutas'), c('annual', 'tithi_pravesha'), c('annual', 'varsha'), c('nakshatra', 'janma'), c('natal', 'panchanga')],
    algorithm: [
      'Deterministic, no model: read every stored ready kundli_data row of the kundli and its dossier (with fetch set, ensureChartData first pulls the natal inputs that are missing) and build kundli_digest rows in six sections, each with its sources (type, variant, calc_version and JSON path)',
      "house D<n>.h<1..12> for D1 and every varga with dignities.dN: sign, lord, lord's house, sign and dignity, co-lord (the dossier's, else the sign's natural lord when the engine names another lord), occupants with their dignity and the chart's benefic or malefic nature (argala table), aspected_by graha and rasi (aspects.dN), argala primary / secondary / obstructed (the dossier's for D1, else the argala.dN table: planets at the 2nd, 4th and 11th, at the 5th, and in the virodha places), SAV and class (D1: ashtakavarga, house_counts), cusp star (D1: facts.houses), the arudha of the house (arudhas.dN)",
      "planet D<n>.<planet>: sign, house, degree, star, pada and star lord, dignity, retro, combust, war, dispositor and its house (dignities.dN); dispositor chain and starChain (avasthas lunar_astro), avasthas and avasthaMultipliers (avasthas.dN for D1, D9, D10, D16, D24), sunProximity (D1: avasthas.proximity_audit), dashaCharter 5-vector charter & 9x9 Antardasha fruition map (D1: avasthas.dasha_charter), shadbala ratio and rank, natural and functional nature and houses owned (D1: facts.bodies, benefic_malefic; elsewhere the houses whose engine lord is the planet), aspects_to and aspected_by (aspects.dN), conjunctions (same sign). Vargas served only as placement rows (varga.dN without dignities.dN) get planet cards with sign, degree, star, pada, and any stored avasthas.dN, and no house cards: the engine states no house table for them",
      'yoga D<n>.<id>: the present yogas and doshas (yogas, yogas.dN, doshas) and the dossier yogas, one row per name, class from the dossier where it names one',
      "point <varga>.<id>: chara karakas placed by their planet's card in each varga; A1..A12 with AL and UL, surya_arudhas (S1..S12), chandra_arudhas (C1..C12), and the special points (SL, HL, GK, MD) of arudhas.dN; badhaka (D1: benefic_malefic.badhaka); Lunar Astro sensitive points K64M, K64L, KD22, BB (D1: avasthas.lunar_astro); the dossier's special lagnas and the sphutas (D1); each with the lord of its sign and the lord's house from that chart's house table",
      'annual TP<year>.D<n> and VP<year>.D<n> for every stored year chart: lagna and house cards (as above, from the year chart tables); for D1 the year dashas (Tithi Pravesha: tithi_pravesha_dasha per stored system; Varsha: Mudda, Patyayini) and, for Varsha, the sahams in houses plus muntha, yearLord, and tajakaYogas when annual.tajaka@year=Y is stored',
      'star profile: Moon star and its lord, lagna star, the tara of every star from the Moon star, gandanta flags (facts.nakshatra_profile; the D1 Moon card when there is no dossier), and pendingKarmaHouses (avasthas.lunar_astro.pending_karma)',
      'Writes the rows and the activation calendar in one transaction (old rows deleted, batches of 500), invalidates cached technique_outputs and area_builds for the kundli, and stamps kundlis.digest_status ready with digest_version and digest_built_at, only while the status is still building; failed with the error type on an error, leaving the old rows',
      'It selects, counts, joins and dates; it never derives a sign, a lord, an aspect, a dignity, a yoga or a house (doc 46 §C.3; tests/unit/reading/digest/noAstrologyInNode.test.ts)',
    ],
    special: 'About 400 stored rows read and 700–900 digest rows written per research kundli. Run by the kundli-digest event and the kundli-digest-sweep (pending, stale, failed, another version, or stuck building); a registration pull that stores new rows marks a ready digest stale',
    source: 'docs/reading-engine/53 §4.1; 54 §2; 46 §C.3',
    code: 'src/reading/digest/build.ts buildDigestRows, buildDigest; load.ts loadDigest; event.ts',
    agents: ['digest.build'],
    accuracy: 'staff',
    selectors: DIGEST_SELECTORS,
    contract: codeContract([
      inp('house', 'dignities.dN, aspects.dN, argala.dN, arudhas.dN, house_counts.dN; D1 also ashtakavarga, benefic_malefic.badhaka, facts.houses; D1 and the vargas with dignities.dN', 'house_card'),
      inp('planet', 'dignities.dN, aspects.dN, avasthas.dN (avasthas, avasthaMultipliers, dispositor chains, D1 sunProximity & dashaCharter); D1 also strength.shadbala, benefic_malefic, facts.bodies; varga.dN placement rows for the other vargas', 'planet_card'),
      inp('yoga', 'yogas, yogas.dN, doshas, facts.yogas', 'yoga_row'),
      inp('point', 'karaka.chara, arudhas(.dN) (bhava/surya/chandra arudhas & special points), benefic_malefic.badhaka, avasthas.lunar_astro (K64M, K64L, KD22, BB), facts.special_lagnas, sphutas', 'point_row'),
      inp('annual', 'annual.{tithi_pravesha,varsha}@year=Y (D1, D2, D7, D9, D10), annual.{tithi_pravesha_dasha,mudda,patyayini,sahams,tajaka}@year=Y, every stored year', 'annual_row'),
      inp('star', 'facts.nakshatra_profile, avasthas.lunar_astro.pending_karma', 'star_profile'),
    ], 'kundli_digest.v1'),
  },
  {
    id: 'digest.annual_set',
    title: 'Annual set, ten years back and ahead',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('annual', 'tithi_pravesha'), c('annual', 'varsha'), c('annual', 'tithi_pravesha_dasha'), c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'sahams'), c('divisional', 'D9'), c('divisional', 'D10')],
    algorithm: [
      'For each year from ten back to ten ahead (nearest first), the keys of the set: Tithi Pravesha and Varsha in D1, D9 and D10, the Tithi Pravesha year dasha (default system), Mudda, Patyayini and the sahams: 210 per kundli',
      'Read which are stored (no engine call), then pull at most DIGEST_ANNUAL_MAX_CALLS (default 40) of the missing ones through ensureChartData, one at a time, stored as kundli_data year rows',
      'Run before each kundli-digest build and with the time a sweep has left; when a top-up stored new rows the ready digest is marked stale and the next sweep rebuilds its annual section',
    ],
    source: 'docs/reading-engine/53 §4.1, step 2',
    code: 'src/reading/digest/annualSet.ts ensureAnnualSet; event.ts runTopUp',
    agents: ['digest.annual_set'],
    accuracy: 'none',
    selectors: DIGEST_SELECTORS,
    contract: codeContract([inp('annual', 'annual.* for Y in −10…+10, D1, D9, D10', 'annual_row')], 'kundli_digest.v1', 'digest.build'),
  },
  {
    id: 'digest.activation',
    title: 'Activation calendar, thirty years ahead',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('dasha', 'all_systems'), c('dasha', 'applicable'), c('natal', 'facts')],
    algorithm: [
      'Every period of every stored dasha tree (the .l3 tree to level 3 where stored, else the tree as stored, to level 2), from the stored birth date to thirty years after today',
      "Each period carries the D1 houses it activates as the engine states them: a graha period the lord's house, the houses it owns and the houses its graha drishti falls on (its D1 planet card); a rasi period the sign's house (house_counts) and its lord's house (the D1 house card of the sign)",
      'Families per doc 46 §B.4: vimshottari, conditional (the systems dasha.applicable lists), yogini, tithi_ashtottari, rasi, karaka (karaka, kaala, naisargika), other',
      'One row per period in kundli_activation, written in the digest build; activationFor answers "which periods activate house 7 between 2027 and 2030 under any system" with one indexed query (range index, GIN on houses)',
    ],
    source: 'docs/reading-engine/53 §4.1, step 3; 46 §B.4',
    code: 'src/reading/digest/activation.ts buildActivationRows, activationFor',
    agents: ['digest.activation'],
    accuracy: 'none',
    selectors: DIGEST_SELECTORS,
    contract: codeContract([inp('activation', 'every stored system, levels 1–3, birth to +30 years', 'activation_row'), inp('planet', 'D1 cards (house, owns, aspects_to) of the nine planets; D1 house cards and house_counts for rasi periods', 'planet_card')], 'kundli_activation.v1', 'digest.build'),
  },
];

// ---------------------------------------------------------------- The life reading, Part 1 (doc 34; doc 54 §4): Profile → Timeline

const LIFE_AREA_LINE = 'self 1,9,10; money 2,11,9,5 (D2); work 10,6,1 (D10); home 4,2,11 (D4); marriage 7,2,11,12 (D9); children 5,9 (D7); parents 4,9 (D12); siblings 3,11,1 (D3); legal 6,10,8 (D30, else D10); health 1,6,8 (D30); travel 12,9,3,7 (D4); learning 4,5,2,9 (D24); dharma 9,12,8,5 (D20)';
/** The Timeline card only: no chat or board flow selects these. */
const LIFE_SELECTORS: TechniqueSelectors = { boards: ['timeline'], houses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], vargas: ['D1', 'D9', 'D2', 'D3', 'D4', 'D7', 'D10', 'D12', 'D20', 'D24', 'D30'] };
const LIFE_CHARTS: TechniqueChart[] = [
  c('natal', 'digest.house'),
  c('natal', 'digest.planet'),
  c('natal', 'digest.yoga'),
  c('divisional', 'D9'),
  c('divisional', 'owning varga'),
  c('dasha', 'kundli_activation'),
  c('annual', 'digest.annual'),
  c('transit', 'transit_snapshot.double_transit'),
];
const LIFE_AGENTS = ['life.dashboard'];
const LIFE_PROMISE_INPUTS: ContractInput[] = [
  inp('house', 'D1 houses of the area; D9 and the owning varga, primary house', 'house_card'),
  inp('planet', 'D1 karakas of the area; the primary house lord in D9 and the owning varga', 'planet_card'),
  inp('yoga', 'D1 yogas on the area houses or their lords', 'yoga_row'),
];
const LIFE_TIMING_INPUTS: ContractInput[] = [
  inp('activation', 'every family, levels 1-2, today to +15 years, the area houses', 'activation_row'),
  inp('annual', 'TP and VP of each year a window touches, D1 card of the primary house', 'annual_row'),
  inp('transit', 'stored natal-overlay double_transit windows and Saturn/Rahu/Ketu rows (read only; none fetched)', 'transit_row'),
];

const LIFE: TechniqueDef[] = [
  {
    id: 'life.promise_scale',
    title: 'Life areas: the weighed promise scale',
    category: 'general',
    board: 'timeline',
    status: 'built',
    charts: LIFE_CHARTS,
    algorithm: [
      `Thirteen areas, each with D1 houses (primary first), karakas and an owning varga from the subject frames: ${LIFE_AREA_LINE}`,
      "D1 (35): per area house (primary weighted 2, others 1) the lord's dignity, the class of the house the lord sits in (dusthana tests, kendra or trikona supports), each occupant's dignity or else its natural nature, SAV (28+ supports, 24 or less tests), argala open against obstructed; each karaka's functional nature, else dignity, else combustion; yogas on the area houses or their lords (raja, dhana, mahapurusha, cancellation support; doshas test)",
      "Vargas (20): D9 for every area and the owning varga beside it when the digest holds it (10 + 10, else D9 alone): the primary house lord and occupants in that varga, and the D1 primary lord's dignity there",
      "Dashas (25): the period running today in each family (Vimshottari 8, rasi 6, conditional 4, Yogini 3, Tithi Ashtottari 2, others 2), silent unless it activates an area house; otherwise its lord's functional nature, else dignity, decides the side; a rasi period reads the lord of its sign from the D1 house cards",
      "Annual (10): this year's TP (6) and VP (4) D1 card of the primary house: lord dignity and occupants averaged",
      'Transit (10): from the stored natal-overlay chart only: Saturn, Rahu or Ketu on an area house tests, a Jupiter-Saturn double transit on one supports',
      'Each layer earns its weight times (support + half of neutral) over its lines; the score is the sum over the layers that are there, scaled to 100',
      'Verdict from D1 and vargas only: 60 % or more promised, 40-59 % partial, under 40 % not written; withholding planets are the test lines\' planets, heaviest first',
    ],
    special: "The antardasha lord's 6/8/12 place from the mahadasha lord is read from the D1 planet card's dashaCharter.fruition map (avasthas.dasha_charter.antardasha_fruition_matrix)",
    source: 'docs/reading-engine/34 §2, §3; 54 §4; 55 §4.1',
    code: 'src/reading/life/promise.ts promiseScale',
    agents: LIFE_AGENTS,
    accuracy: 'none',
    selectors: LIFE_SELECTORS,
    contract: codeContract([...LIFE_PROMISE_INPUTS, inp('activation', 'periods running today, levels 1-2', 'activation_row')], 'life_promise.v1', 'life.dashboard'),
  },
  {
    id: 'life.timing_agreement',
    title: 'Life areas: when it improves, by agreement across systems',
    category: 'general',
    board: 'timeline',
    status: 'built',
    charts: LIFE_CHARTS,
    algorithm: [
      'Candidates: each Vimshottari sub-period (level 2, else level 1) in the next 15 years that activates an area house and whose lord does not test the area',
      'Another family agrees when one of its periods overlapping the window activates an area house without testing it; it contradicts when every such period tests it',
      'Dated only when Vimshottari and at least one of conditional, rasi, Yogini or Tithi Ashtottari agree; otherwise the window is a possibility, written as one, with its year only',
      "Score: 55 times the area's promise ratio + Vimshottari 8 + the agreeing families' weights - the contradicting families' weights + TP 6 and VP 4 when a year the window touches supports the primary house + 10 when a stored double transit falls on an area house inside the window",
      'Grade: 70+ strong, 50-69 moderate, under 50 weak; the basis names how many systems agree, whether the year chart confirms, whether the sky confirms or could not be checked, and how many disagree',
      'The best three dated windows by score, shown in date order',
    ],
    special: 'The stored transit chart covers about two years; windows past it carry "the sky check is not available" and do not earn the transit points',
    source: 'docs/reading-engine/34 §2, §3; 54 §4',
    code: 'src/reading/life/timing.ts areaTiming',
    agents: LIFE_AGENTS,
    accuracy: 'none',
    selectors: LIFE_SELECTORS,
    contract: codeContract(LIFE_TIMING_INPUTS, 'life_windows.v1', 'life.dashboard'),
  },
  {
    id: 'life.mahadasha_charter',
    title: 'Remaining largest Mahadasha (10-18+ yrs) and Antardasha life charter',
    category: 'general',
    board: 'timeline',
    status: 'built',
    charts: LIFE_CHARTS,
    algorithm: [
      'Selects the running Vimshottari Mahadasha when it has at least LIFE_CHARTER_MIN_REMAINING_YEARS (default 10) years remaining; otherwise selects the first upcoming Mahadasha in LIFE_CHARTER_HORIZON_YEARS (default 20) with >= minYears starting within minYears of today (or the next Mahadasha if longer than the running remaining span) and carries all pre-primary Mahadashas as a chronological transition bridge',
      'Builds the Mahadasha touch map from the D1 planet card, dashaCharter, StarProfile.pendingKarmaHouses, and D1 Lunar Astro points K64M/K64L/KD22/BB (houses owned, house occupied, star-lord house, dispositor house, co-owned houses, graha/rasi drishti, pending-karma houses, and active yogas)',
      'Synthesizes per-area life charters (anchor, growth, guarded) combining natal D1 and divisional (D9 + owning varga) promise with the Mahadasha touch weights and the area peak/watch Antardasha windows',
      'Enumerates every chronological Vimshottari Antardasha (level 2) in the Mahadasha and scores the 13 life areas per sub-period across 5 pillars: D1 + varga promise, 9x9 Antardasha-from-Mahadasha fruition (trikona, kendra, dhana, upachaya, dusthana 6/8/12, star-lord/dispositor/co-lord links) plus avasthaMultipliers delivery scaling, multi-dasha family agreement, annual TP/VP year charts, and stored transit gates (including Bhrigu Bindu and Khara transit tags)',
      'Emits plain-language chapter headline, charter summary, per-area charters, and chronological Antardasha cards with chart terms isolated inside structured evidence',
    ],
    source: 'docs/reading-engine/34 §3-§5; 55 §4',
    code: 'src/reading/life/charter.ts buildMahadashaCharter',
    agents: LIFE_AGENTS,
    accuracy: 'none',
    selectors: LIFE_SELECTORS,
    contract: codeContract([...LIFE_PROMISE_INPUTS, ...LIFE_TIMING_INPUTS], 'life_charter.v1', 'life.dashboard'),
  },
  {
    id: 'life.dashboard',
    title: 'Your life at a glance and long-term Mahadasha charter',
    category: 'general',
    board: 'timeline',
    status: 'built',
    charts: LIFE_CHARTS,
    algorithm: [
      'Needs the digest: when it is not ready the answer is preparing and the kundli is queued (digest_status pending unless building)',
      'Per area run the promise scale (life.promise_scale), the timing (life.timing_agreement), and the long-term Mahadasha & Antardasha charter (life.mahadasha_charter)',
      'Shown only when the area has a pressure now (a test line in the running periods or the sky) or a dated window',
      "Issue: the heaviest current test line as a plain sentence with its end date, then one confirming question worded from the person's stored facts (work.status, love.status, family.children)",
      'Cause: the planets of the current test lines and the withholding planets, the running periods that touch the area, and one plain sentence',
      "Solution: two practical steps per area, the date to hold until, the best window to act in, and traditional support from the chart's strongest functional benefic (a weekday and a gesture)",
      'Rule now: the running Vimshottari sub-period; its lord testing gives hold-and-prepare with what happens if broken, otherwise act on what is ready',
      'Charter: the remaining largest Mahadasha (10-18+ yrs) broken down by per-area life charter and chronological Antardasha sub-periods',
      'Stored per kundli per day in area_builds (area life); template sentences only, no model',
    ],
    source: 'docs/reading-engine/34 §1, §5 Part 1; 54 §4; 55 §4',
    code: 'src/reading/life/compose.ts composeDashboard; service.ts getLifeReading',
    agents: LIFE_AGENTS,
    accuracy: 'none',
    selectors: LIFE_SELECTORS,
    contract: codeContract([...LIFE_PROMISE_INPUTS, ...LIFE_TIMING_INPUTS], 'life_reading.v2'),
  },
];

// ---------------------------------------------------------------- Research Lab & Independent Technical Verification (docs/admin/09)

const RESEARCH_SELF_CHARTS: TechniqueChart[] = [
  c('natal', 'facts'),
  c('natal', 'dignities'),
  c('natal', 'aspects'),
  c('natal', 'avasthas'),
  c('natal', 'yogas'),
  c('natal', 'doshas'),
  c('natal', 'strength.shadbala'),
  c('ashtakavarga', 'sav'),
  c('jaimini', 'charakaraka'),
  c('jaimini', 'arudhas'),
  c('jaimini', 'argala'),
  c('nakshatra', 'janma'),
  c('nakshatra', 'cusp_nak'),
  c('divisional', 'D1'),
  c('divisional', 'D9'),
  c('divisional', 'D10'),
  c('divisional', 'D20'),
  c('divisional', 'D24'),
  c('divisional', 'D12'),
  c('divisional', 'D2'),
  c('divisional', 'D4'),
  c('divisional', 'D7'),
  c('divisional', 'D60'),
  c('dasha', 'vimshottari'),
  c('dasha', 'yogini'),
  c('dasha', 'tithi_ashtottari'),
  c('dasha', 'narayana'),
  c('dasha', 'chara'),
  c('dasha', 'karaka'),
  c('annual', 'tithi_pravesha'),
  c('annual', 'varsha'),
  c('annual', 'tithi_pravesha_dasha'),
  c('transit', 'transit_contacts'),
  c('transit', 'sade_sati'),
  c('panchang', 'muhurta'),
];

const RESEARCH_SELF_INPUTS: ContractInput[] = [
  inp('house', 'D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 houses 1..12', 'house_card'),
  inp('planet', 'D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 every planet', 'planet_card'),
  inp('yoga', 'all yogas, doshas and cancellations', 'yoga_row'),
  inp('point', 'AK, AmK, DK, AL, UL, SL, HL, GL, K64M, K64L, KD22, BB', 'point_row'),
  inp('star', 'Moon star, lagna star, tara table, gandanta and pending karma', 'star_profile'),
  inp('activation', 'every served system covering Nov-Jan and ±30 years (levels 1..4)', 'activation_row'),
  inp('annual', 'TP and VP of the current and next year with year dashas and sahams', 'annual_row'),
  inp('transit', 'Sa, Ju, Ra, Ke slow transits, sade sati, and daily tara/chandra bala overlay', 'transit_row'),
];

const RESEARCH: TechniqueDef[] = [
  {
    id: 'research.self_dashboard_qa',
    title: 'Research Self Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: RESEARCH_SELF_CHARTS,
    algorithm: [
      'Hydrate synthetic age-bracket (ages 18, 20, 24, 28, 30, 32, 36, 40, 48, 56) or profession/life-stage persona kundlis into isolated research_* staging tables (research_kundlis, research_chart_data, research_digests, research_activations) without touching customer auth or kundlis',
      'Run the production Self board (buildBoard SELF, resolveAreaShades, buildCalmPlaybook) and build the complete 12-house D1 + 10-varga (D1, D9, D10, D20, D24, D12, D2, D4, D7, D60) deep-dive matrix for Self, Love, and Work charter alignment',
      'Map the charter & vocation mission (Teacher, Business, Real Estate, Electrician/Trade, Finance, Software Engineer, College Student, Expectant/New Parent, Divorce Recovery, Unemployed/Health Recovery) from D1 1H/4H/5H/9H/10H, D9, D10, D24, AK/AmK, SAV, and cusp nakshatras',
      'Zoom in temporally from the Tithi Pravesha / Varsha annual chart through Vimshottari MD -> AD -> PD -> Sookshma, Yogini, Tithi Ashtottari, Narayana, slow transits, and daily Tara/Chandra Bala across November, Thanksgiving Week (Nov 23-29), December, and New Year (Dec 28-Jan 5) by week (9 weeks) and by day (14-day strip)',
      'Record the 10-step technical trace (exact digest keys pulled, what was excluded and why, Parashara/Jaimini/Sanjay Rath/Lunar Astro/Tajaka rules applied, combination weights, and plain-English Oracle reading prose)',
    ],
    source: 'docs/admin/09 §4.1; docs/reading-engine/46 §B; 54 §3; 55 §2',
    code: 'src/reading/research/selfDashboardQa.ts hydrateResearchSubject, buildSelfResearchDashboard',
    agents: ['research.self_dashboard_builder'],
    accuracy: 'staff',
    selectors: { boards: ['you'], subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha', 'career_work'], houses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], vargas: ['D1', 'D9', 'D10', 'D20', 'D24', 'D12', 'D2', 'D4', 'D7', 'D60'] },
    contract: codeContract(RESEARCH_SELF_INPUTS, 'research_self_dashboard.v1', 'research.technical_verifier'),
  },
  {
    id: 'research.love_dashboard_qa',
    title: 'Research Love Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year relationship zoom-in',
    category: 'love',
    board: 'love',
    status: 'built',
    charts: RESEARCH_SELF_CHARTS,
    algorithm: [
      'Hydrate synthetic age-bracket or persona kundlis into isolated research_* staging tables and run the production Love board (buildBoard LOVE, resolveAreaShades, buildCalmPlaybook)',
      'Evaluate 7H/5H/11H/2H/4H/8H/12H across D1, D9 (Navamsa), and D7 (Saptamsa) with Venus, Moon, L7, Darakaraka (DK), Upapada Lagna (UL), and Vivaha/Preethi/Mitra Sahams',
      'Zoom in temporally across November Lead, Thanksgiving Week (Nov 23-29), December Core, and New Year Transition (Dec 28-Jan 5) for relationship harmony, family boundaries, and reconnection windows',
      'Record the 10-step technical trace and audit via the 8-gate Independent Technical Verifier Agent',
    ],
    source: 'docs/admin/09 §4.1; docs/reading-engine/45 §8.2; 46 §B.12; 54 §3',
    code: 'src/reading/research/loveDashboardQa.ts buildLoveResearchDashboard; selfDashboardQa.ts hydrateResearchSubject',
    agents: ['research.love_dashboard_builder'],
    accuracy: 'staff',
    selectors: { boards: ['love'], subjects: ['marriage_relationship', 'children'], houses: [2, 4, 5, 7, 8, 11, 12], vargas: ['D1', 'D9', 'D7', 'D30'] },
    contract: codeContract(RESEARCH_SELF_INPUTS, 'research_love_dashboard.v1', 'research.technical_verifier'),
  },
  {
    id: 'research.work_dashboard_qa',
    title: 'Research Work Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year career zoom-in',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: RESEARCH_SELF_CHARTS,
    algorithm: [
      'Hydrate synthetic age-bracket or persona kundlis into isolated research_* staging tables and run the Work/Career research board (buildBoard WORK_RESEARCH_CONFIG, resolveAreaShades, buildCalmPlaybook)',
      'Evaluate 10H/6H/11H/2H/1H/9H/3H across D1, D10 (Dasamsa), D9 (Navamsa), D2 (Hora), and D24 (Siddhamsa) with L10, Sun, Saturn, Mercury, Jupiter, Amatyakaraka (AmK), Arudha Lagna (AL), and Karma/Samartha/Artha Sahams',
      'Zoom in temporally across November Lead, Thanksgiving Week (Nov 23-29), December Core, and New Year Transition (Dec 28-Jan 5) for Q4 deliverable closure, workload pacing, and Q1 career launch',
      'Record the 10-step technical trace and audit via the 8-gate Independent Technical Verifier Agent',
    ],
    source: 'docs/admin/09 §4.1; docs/reading-engine/42 §B.4; 43 §2-§8; 55 §2',
    code: 'src/reading/research/workDashboardQa.ts buildWorkResearchDashboard; selfDashboardQa.ts hydrateResearchSubject',
    agents: ['research.work_dashboard_builder'],
    accuracy: 'staff',
    selectors: { boards: ['work'], subjects: ['career_work', 'income_wealth'], houses: [1, 2, 3, 6, 9, 10, 11], vargas: ['D1', 'D10', 'D9', 'D2', 'D24'] },
    contract: codeContract(RESEARCH_SELF_INPUTS, 'research_work_dashboard.v1', 'research.technical_verifier'),
  },
  {
    id: 'research.technical_verifier',
    title: 'Independent Technical Verifier Agent (8-gate classical & governance audit)',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: RESEARCH_SELF_CHARTS,
    algorithm: [
      'Independently read the staged research_digests, research_activations, and generated Self Dashboard run (board_data, house_varga_matrix, temporal_data, trace_data, reading_prose)',
      'Verify Gate 1 (D1 House & Lordship Integrity) and Gate 2 (Divisional Varga Agreement across D9, D10, D20, D24, D12, D2, D4, D7, D60)',
      'Verify Gate 3 (Multi-Clock Dasha Convergence across 7 families and MD/AD/PD/Sookshma dates) and Gate 4 (Ashtakavarga SAV >= 28 / <= 22 & Shadbala ratio >= 1.0 bounds)',
      'Verify Gate 5 (Yoga, Avastha & Neecha Bhanga / Jupiter Protection floor) and Gate 6 (Nakshatra Janma/Cusp Star & daily Tara/Chandra Bala consistency)',
      'Verify Gate 7 (November, Thanksgiving Week, December, and New Year chronological continuity) and Gate 8 (SOUL.md Rule 0, 4-Tier Sattvic/Rajasic/Mediocre/Baseline Playbook, and zero banned engine names)',
      'Compute the 0-100% accuracy score, pass/warn/fail verdict (pass >= RESEARCH_VERIFIER_PASS_SCORE, default 95%), passed check receipts, and any missed astrological factors',
    ],
    source: 'docs/admin/09 §4.1.4; SOUL.md; BPHS ch. 6-7, 27, 34-41, 46-51, 66-72; Jaimini Upadesa Sutras',
    code: 'src/reading/research/selfDashboardQa.ts verifySelfDashboardRun',
    agents: ['research.technical_verifier'],
    accuracy: 'staff',
    selectors: { boards: ['you'], subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha'], houses: [1, 4, 5, 9, 10, 12], vargas: ['D1', 'D9', 'D10', 'D20', 'D24'] },
    contract: codeContract([...RESEARCH_SELF_INPUTS, inp('findings', 'the 10-step technical trace and Self dashboard claims under audit', 'findings_in')], 'research_verifier_audit.v1'),
  },
];


/**
 * The You reading (docs/reading-engine/58): one technique per panel, each over the shared slicers of
 * src/reading/self/slices.ts, stored in technique_outputs for its freshness window and timed per run.
 */
const SELF_READING_SOURCE = 'docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)';
const selfReadingRow = (
  id: string,
  title: string,
  charts: TechniqueChart[],
  algorithm: string[],
  inputs: ContractInput[],
  code: string,
  houses: number[],
  vargas: string[],
  output = 'self_panel.v1',
  synthesizer?: string,
): TechniqueDef => ({
  id,
  title,
  category: 'self',
  board: 'you',
  status: 'built',
  charts,
  algorithm,
  source: SELF_READING_SOURCE,
  code,
  agents: ['self.reading_panel'],
  accuracy: 'area_checks:self',
  selectors: { boards: ['you'], subjects: ['general_life_direction'], houses, vargas },
  contract: codeContract(inputs, output, synthesizer),
});

const SELF_READING: TechniqueDef[] = [
  selfReadingRow(
    'self.reading.diagnosis',
    'You reading: Who you are, in short (three sentences built from the other panels, shown first)',
    [c('natal', 'panel claims')],
    [
      'Built last from the claims of self.reading.lagna, struggle, yogas and chapters; adds no fact',
      'Sentence 1, direction and footing: the lagna panel lead and the lagna lord state',
      'Sentence 2, the central tension: a struggle the reading clock is running now (it has a release date), else the first knot, else the first struggle',
      'Sentence 3, where you stand now: the running chapter and sub-chapter with their dates',
      'Every sentence cites its source claims as claim:<id>; a "no" to it withholds them too; the confirm question asks about sentence 2',
    ],
    [inp('findings', 'claims of self.reading.lagna, struggle, yogas, chapters', 'findings_in')],
    'src/reading/self/panels/diagnosis.ts diagnosisPanel, tensionSource (board.diagnosis, Self instance)',
    [1],
    ['D1'],
    'board_diagnosis.v1',
  ),
  selfReadingRow(
    'self.reading.clock',
    'You reading: the reading clock (preferred, applicable or default dasha system, and the confirming clocks)',
    [c('dasha', 'dasha.applicable'), c('dasha', 'all served systems')],
    [
      'Read kundlis.preferred_dasha and the distinct systems with their family in kundli_activation',
      'Use the preferred system when it has periods; else the first system of SELF_CLOCK_CONDITIONAL_ORDER that the engine marked applicable (family conditional); else vimsottari',
      'Confirming clocks: SELF_CONFIRM_SYSTEMS minus the reading clock, kept only when periods exist',
    ],
    [inp('activation', 'systems present and their family (conditional = engine says applies)', 'activation_row')],
    'src/reading/self/clock.ts resolveClock; service.ts getSelfReading',
    [1],
    ['D1'],
    'self_clock.v1',
  ),
  selfReadingRow(
    'self.reading.lagna',
    'You reading: Who you are (1st house, lagna lord, arudha lagna, rising star, Moon lagna, D9 lagna)',
    [c('divisional', 'D1'), c('divisional', 'D9'), c('natal', 'dignities'), c('natal', 'aspects'), c('natal', 'avasthas'), c('jaimini', 'arudhas'), c('nakshatra', 'cusp star')],
    [
      'houseFrame D1 h1: sign, lord, occupants, graha and rasi drishti, SAV, cusp star',
      'planetChain of the lagna lord: D1 house (where the self is lived), dignity and avastha ripeness (how it is held), conjunctions; D9 card',
      'Claims: lord_house, lord_state, lord_company, on_self (occupants; graha drishti split into helped / pressed by the engine functional nature), star (cusp star lord), seen (AL house), seen_fit (lagna-to-AL from the engine label of the AL house), moon_lagna (the D1 house the Moon occupies, read as a frame), inner (D9 h1 lord house)',
      'A missing field drops its claim and records a gap; no default value is ever printed',
    ],
    [inp('house', 'D1 h1, the D1 house the Moon occupies, D9 h1', 'house_card'), inp('planet', 'D1 and D9 cards of the lagna lord; D1 cards of planets aspecting h1 and of the Moon', 'planet_card'), inp('point', 'D1 AL', 'point_row')],
    'src/reading/self/panels/lagna.ts lagnaPanel; slices.ts planetChain, houseFrame, pointOf',
    [1],
    ['D1', 'D9'],
    'self_panel.v1',
    'self.reading.diagnosis',
  ),
  selfReadingRow(
    'self.reading.mind',
    'You reading: Your mind (Moon, Mercury, 3rd, 4th and 5th houses)',
    [c('divisional', 'D1'), c('divisional', 'D9'), c('natal', 'dignities'), c('natal', 'yogas'), c('nakshatra', 'Moon star'), c('ashtakavarga', 'sav')],
    [
      'planetChain Mo: house, dignity (with a cancellation row lifting debility), conjunctions and aspects, star lord',
      'planetChain Me (thinking): house and dignity',
      'houseFrame D1 h3 (courage and effort), h4 (what peace depends on, SAV against the chart mean), h5 (intelligence): where each lord sits, occupants',
      'Moon yogas (BG-07): the engine rows for Sunapha, Anapha, Durudhara and Kemadruma when present; Durudhara is worded over Sunapha and Anapha',
      'pointOf D1 A4 (home and peace as seen) and A5 (ideas as seen): the house the engine counts from the lagna',
    ],
    [inp('planet', 'D1 and D9 cards of Mo, Me', 'planet_card'), inp('house', 'D1 h3, h4, h5 and every D1 house (sav column)', 'house_card'), inp('yoga', 'cancellation rows naming Mo; the Moon yoga rows', 'yoga_row'), inp('point', 'D1 A4, A5', 'point_row')],
    'src/reading/self/panels/mind.ts mindPanel',
    [3, 4, 5],
    ['D1', 'D9'],
  ),
  selfReadingRow(
    'self.reading.atma',
    'You reading: Your soul aim (atmakaraka, karakamsa, Sun, Jupiter, 9th and 12th houses)',
    [c('jaimini', 'charakaraka'), c('divisional', 'D1'), c('divisional', 'D9'), c('natal', 'avasthas')],
    [
      'pointOf D1 AK: the karaka planet (PointRow.planet); planetChain of that planet: house, dignity, ripeness, shadbala rank',
      'pointOf D9 AK: its sign is the karakamsa and its house is counted from the D9 lagna by the engine; D9 planets in that sign',
      'The Sun when it is not the AK; planetChain Ju (judgement and faith); houseFrame D1 h9 (purpose) and h12 (letting go)',
      'Withheld with a gap when the AK planet is not stored (digest built before 2026-11-07)',
    ],
    [inp('point', 'D1 and D9 AK', 'point_row'), inp('planet', 'D1 cards of the AK planet, Su and Ju; D9 cards in the karakamsa sign', 'planet_card'), inp('house', 'D1 h9, h12', 'house_card')],
    'src/reading/self/panels/atma.ts atmaPanel',
    [1, 9, 12],
    ['D1', 'D9'],
  ),
  selfReadingRow(
    'self.reading.yogas',
    'You reading: Gifts and knots (yogas and doshas on the self)',
    [c('natal', 'yogas'), c('natal', 'doshas')],
    [
      'yogasTouching: present D1 yoga and dosha rows naming the lagna lord, Mo, Su or the AK planet, or houses 1, 4, 5, 9; one row per name',
      'Gift or knot from the engine class (raja, dhana, viparita, cancellation are gifts; dosha and affliction are knots); gifts first; a manglik row only when it touches house 1',
      'Ranking (BG-09): within gifts and within knots, by the mean of the stored avasthaMultipliers.effective, raised by half when a planet is the running main or sub period lord of the reading clock',
    ],
    [inp('yoga', 'D1 rows naming L1, Mo, Su, AK or houses 1,4,5,9', 'yoga_row')],
    'src/reading/self/panels/yogas.ts yogasPanel; slices.ts yogasTouching',
    [1, 4, 5, 9],
    ['D1'],
    'self_panel.v1',
    'self.reading.diagnosis',
  ),
  selfReadingRow(
    'self.reading.struggle',
    'You reading: What you struggle with (afflictions on the self with release dates from the reading clock)',
    [c('divisional', 'D1'), c('natal', 'dignities'), c('natal', 'avasthas'), c('natal', 'benefic_malefic'), c('natal', 'house_counts'), c('dasha', 'reading clock L1-L3')],
    [
      'Lagna lord in a house the engine classes dusthana',
      'Lagna lord, Mo, Su or AK debilitated (a cancellation row noted) or with avastha ripeness unripe or dried seed',
      'A natural and functional malefic on or aspecting h1, with or aspecting the Moon, or in h5; the h4 lord in a dusthana',
      'Release: when the named planet is a running lord of the reading clock, the end date of that stored period; those come first; at most 6 claims',
    ],
    [inp('planet', 'D1 cards of L1, Mo, Su, AK and the malefics named', 'planet_card'), inp('house', 'D1 h1, h4, h5 (class column)', 'house_card'), inp('activation', 'reading clock levels 1-3 covering today', 'activation_row')],
    'src/reading/self/panels/struggle.ts strugglePanel; slices.ts runningChain',
    [1, 4, 5],
    ['D1'],
    'self_panel.v1',
    'self.reading.diagnosis',
  ),
  selfReadingRow(
    'self.reading.chapters',
    'You reading: Your chapters (previous, running and next main period of the reading clock, the running sub-period, confirmed by other clocks)',
    [c('dasha', 'reading clock L1-L2'), c('dasha', 'vimshottari'), c('dasha', 'narayana'), c('dasha', 'chara'), c('dasha', 'yogini'), c('dasha', 'karaka'), c('dasha', 'tithi_ashtottari'), c('natal', 'avasthas dasha_charter')],
    [
      'mdSpine of the reading clock: previous, running, next level-1 periods; the running and next level-2 periods',
      'Words from the houses kundli_activation says each period activates, and the lord D1 card (faculty, house)',
      'Sub-chapter flavour: the engine fruition class of the sub lord from the main lord (dasha_charter), with its 2/12 and 6/8 flags',
      'Confirmation: a confirming clock agrees when one of its level-1 periods starts within SELF_CHAPTER_BOUNDARY_MONTHS of the chapter start; confirmed at SELF_CHAPTER_CONFIRM_MIN, likely at 1, split at 0 (sentence withheld, dates kept)',
    ],
    [inp('activation', 'reading clock levels 1-2 and confirming clocks level 1, life span', 'activation_row'), inp('planet', 'D1 cards of the chapter lords', 'planet_card')],
    'src/reading/self/panels/chapters.ts chaptersPanel, confirmShift; slices.ts mdSpine, mainStarts',
    [1],
    ['D1'],
    'self_panel.v1',
    'self.reading.diagnosis',
  ),
  selfReadingRow(
    'self.reading.body',
    'You reading: Your body (what the chart and the sky put on the body; facts only)',
    [c('divisional', 'D1'), c('divisional', 'D30'), c('natal', 'dignities'), c('natal', 'benefic_malefic'), c('dasha', 'reading clock L1-L2'), c('transit', 'sky overlay when stored')],
    [
      'Footing: the lagna lord dignity and the Sun dignity (D1 cards)',
      'Now: the reading clock running sub-period or main-period lord sitting in or activating houses 6 or 8, with its end date',
      'Pressed: natural and functional malefics on or aspecting the 1st; wear: where the 6th lord sits',
      'Shape: the planet on the D30 1st (occupant, else lord) to one of four shapes from BODY_WORDS (heat, dryness, heaviness, fluids), undated',
      'Never an illness, organ, symptom, treatment or doctor; a sensitive passage keeps only the rest line; the stored sky is read when present, else a gap',
    ],
    [inp('house', 'D1 h1, h6, h8; D30 h1', 'house_card'), inp('planet', 'D1 cards of L1, Su and malefics on h1', 'planet_card'), inp('activation', 'reading clock L1-L2 running', 'activation_row')],
    'src/reading/self/panels/body.ts bodyPanel',
    [1, 6, 8],
    ['D1', 'D30'],
  ),
  selfReadingRow(
    'self.reading.purview',
    'You reading: the whole-chart purview check (board.purview, Self instance)',
    [c('divisional', 'D1'), c('divisional', 'D9'), c('natal', 'yogas'), c('dasha', 'reading clock'), c('nakshatra', 'gandanta')],
    [
      'Runs over the full digest and the reading clock after the panels: lagna lord standing, cancellations, combustion and retrograde, functional nature by lagna, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, the stored sky, the sensitive core',
      'Each rule returns override, veto or annotate with its source and rows; a vetoed claim leaves the card and stays under Chart details',
    ],
    [inp('findings', 'claims of every Self panel', 'findings_in'), inp('planet', 'D1 and D9 cards of L1, Mo, Su, AK', 'planet_card'), inp('yoga', 'cancellation rows', 'yoga_row'), inp('activation', 'reading clock running', 'activation_row')],
    'src/reading/self/purview.ts runPurview, applyPurview',
    [1],
    ['D1', 'D9'],
    'purview.v1',
  ),
  selfReadingRow(
    'self.reading.audit',
    'You reading: the code auditor over the cards (board.auditor, code half)',
    [c('natal', 'dossier rows')],
    [
      'Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows',
      'Every date in a line equals a stored period boundary of the activation calendar or the year chart; no banned chart, body, lifetime or doom word',
      'A failing line leaves the card; the verdict is fail when any line failed; the result is stored in the dossier',
    ],
    [inp('findings', 'the cards and claims of the build', 'findings_in')],
    'src/reading/self/audit.ts auditCards',
    [1],
    ['D1'],
    'code_audit.v1',
  ),
  selfReadingRow(
    'self.reading.year',
    'You reading: This year (Tithi Pravesha and Varsha charts on the self)',
    [c('annual', 'tithi_pravesha'), c('annual', 'varsha'), c('annual', 'mudda')],
    [
      'The VP D1 row whose Mudda periods cover today picks the year',
      'TP D1 row of that year: the house holding the natal lagna lord and its dignity there, its company; the year h1 lord house',
      'The running Mudda lord as the short clock of the year; withheld when no year row covers today',
    ],
    [inp('annual', 'TP and VP D1 of the running year', 'annual_row')],
    'src/reading/self/panels/year.ts yearPanel, runningMudda',
    [1],
    ['D1'],
  ),
  {
    id: 'self.reading.oracle',
    title: 'You reading: AI family sub-agents, Self Lineman, and Self Oracle synthesis',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: [
      c('natal', 'panel claims'),
      c('divisional', 'D1'),
      c('divisional', 'D9'),
      c('divisional', 'D10'),
      c('divisional', 'D30'),
      c('dasha', 'reading clock'),
      c('annual', 'tithi_pravesha'),
      c('transit', 'sky overlay'),
    ],
    algorithm: [
      'Slices the stored kundli_digest, kundli_activation, and stored sky overlay into five structured chart family packs (family.rasi D1, family.varga D2-D60, family.dasha reading clock & 9x9 fruition charter, family.year Tithi Pravesha/Varsha, and family.sky slow transits)',
      'Runs the five family AI sub-agents with Gemini cachedContents prefix caching (immutable chart pack in parts[0], dynamic horizon suffix in parts[1]) and cross-Lambda reading_findings_cache persistence to extract afflictions, malefics, graces, varga agreements, and what helps, delays, or delivers the running Mahadasha promise and when',
      'Compiles the family sub-agent findings, the nine deterministic Self panel claims, the whole-chart purview rules, and the confirmed self.confirm.* facts through the Self Lineman AI agent (lineman.self) into a unified brief',
      'Synthesizes the personalized You reading through the Self Oracle prompt (oracle/self.md), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard',
    ],
    source: `${SELF_READING_SOURCE}; docs/reading-engine/63 §4.1`,
    code: 'src/reading/self/oracle.ts runSelfOracle, runFamilySubAgents, runSelfLineman',
    agents: [
      'self.reading_oracle',
      'family.rasi',
      'family.varga',
      'family.dasha',
      'family.year',
      'family.sky',
      'lineman.self',
    ],
    accuracy: 'area_checks:self',
    selectors: { boards: ['you'], subjects: ['general_life_direction'] },
    contract: {
      inputs: [
        inp('house', 'D1 and divisional house cards 1..12', 'house_card'),
        inp('planet', 'D1 and divisional planet cards with avasthas and dasha_charter', 'planet_card'),
        inp('yoga', 'D1 yogas, doshas, and cancellations', 'yoga_row'),
        inp('point', 'D1/D9 chara karakas, arudha padas, and Lunar Astro points', 'point_row'),
        inp('star', 'Moon star, lagna star, gandanta, and pending karma houses', 'star_profile'),
        inp('annual', 'running Tithi Pravesha and Varsha annual charts', 'annual_row'),
        inp('activation', 'reading clock L1-L3 and confirming clocks L1', 'activation_row'),
      ],
      system: 'src/reading/prompts/oracle/self.md',
      user: ['FACTS', 'TODAY'],
      output: 'self_reading.v1',
    },
  },
];


/**
 * Love and Work reading panels (docs/reading-engine/59 §3, §4): registered as planned with their contracts, built on the
 * same slicers and the shared board.chapters / board.struggle / board.year / board.diagnosis code after the Self board.
 */
const BOARD_READING_SOURCE = 'docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46';
const builtBoardReading = (
  id: string,
  title: string,
  board: 'love' | 'work',
  charts: TechniqueChart[],
  algorithm: string[],
  inputs: ContractInput[],
  code: string,
  houses: number[],
  vargas: string[],
  output: string,
): TechniqueDef => ({
  id,
  title,
  category: board,
  board,
  status: 'built',
  charts,
  algorithm,
  source: BOARD_READING_SOURCE,
  code,
  agents: [board === 'love' ? 'love.reading_panel' : 'work.reading_panel'],
  accuracy: `area_checks:${board}`,
  selectors: { boards: [board], houses, vargas },
  contract: codeContract(inputs, output),
});

const LOVE_HOUSES = [7, 5, 11, 2, 8, 4, 12];
const WORK_HOUSES = [10, 6, 11, 2, 9, 3, 5, 7];

const BOARD_READING_BUILT: TechniqueDef[] = [
  builtBoardReading('love.reading.clock', 'Love reading: the reading clock and confirming clocks (Love instance)', 'love', [c('dasha', 'kundli_activation')],
    ['kundli.preferred_dasha when present in kundli_activation; else the first conditional dasha present; else vimshottari', 'Confirming clocks in configured order from what is stored'],
    [inp('activation', 'distinct (system, family) at level 1', 'activation_row')], 'src/reading/self/clock.ts resolveClock', [7], ['D1'], 'self_clock.v1'),
  builtBoardReading('love.reading.diagnosis', 'Love reading: your love life, in short (three sentences from the Love panels and chapters)', 'love', [c('natal', 'panel claims')],
    ['Built last from the claims of the Love fact panels that fit love.status and of love.reading.chapters', 'How the person loves and what they draw; the central tension (strongest knot on 7, Ve, UL or DK, or the heaviest running affliction with its release); where love stands now, dated'],
    [inp('findings', 'claims of love.reading.heart, partner, bond, circle, chapters', 'findings_in')], 'src/reading/self/panels/love.ts loveDiagnosisPanel', [7], ['D1', 'D9'], 'board_diagnosis.v1'),
  builtBoardReading('love.reading.chapters', 'Love reading: your chapters for love (board.chapters filtered to the love houses)', 'love', [c('dasha', 'reading clock L1-L2'), c('dasha', 'confirming clocks L1')],
    ['board.chapters with houses 7,5,11,2,8,4,12 and planets L7, Ve, DK, Ju, Mo', 'Per chapter: the love houses the lord activates; UL or A7 held by the chapter sign on a sign clock'],
    [inp('activation', 'reading clock L1-L2 and confirming clocks L1, houses 7,5,11,2,8,4,12', 'activation_row'), inp('planet', 'D1 cards of the chapter lords', 'planet_card')], 'src/reading/self/panels/love.ts loveChaptersPanel', LOVE_HOUSES, ['D1', 'D9'], 'board_chapters.v1'),
  builtBoardReading('love.reading.heart', 'Love reading: how you love (Venus, Moon, 5th lord, D9 7th)', 'love', [c('divisional', 'D1'), c('divisional', 'D9')],
    ['planetChain Ve, Mo, L5 (D1 and D9)', 'houseFrame D1 h5, h7; D9 h7 and D9 Ve', 'Facts only: how the person loves, what they feel, romance and play, the inner shape of partnership'],
    [inp('planet', 'D1 and D9 cards of Ve, Mo, L5', 'planet_card'), inp('house', 'D1 h5, h7; D9 h7', 'house_card')], 'src/reading/self/panels/love.ts heartPanel', [5, 7], ['D1', 'D9'], 'board_panel.v1'),
  builtBoardReading('love.reading.partner', 'Love reading: the partner you draw (7th, its lord, DK, UL, A7, D9 7th)', 'love', [c('divisional', 'D1'), c('divisional', 'D9'), c('jaimini', 'charakaraka'), c('jaimini', 'arudhas')],
    ['houseFrame D1 h7; planetChain L7 and the DK planet; D9 h7 and its lord; chains of h7 occupants and aspecting planets', 'Shown for single, dating, complicated; never a yes or no on marriage'],
    [inp('house', 'D1 h7; D9 h7', 'house_card'), inp('planet', 'D1 and D9 cards of L7, the DK planet, h7 occupants', 'planet_card'), inp('point', 'DK, UL, A7, D9 lagna', 'point_row')], 'src/reading/self/panels/love.ts partnerPanel', [7], ['D1', 'D9'], 'board_panel.v1'),
  builtBoardReading('love.reading.bond', 'Love reading: the bond itself (7th, 2nd, 4th, 8th, UL and its 2nd, D9, D7)', 'love', [c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D7'), c('jaimini', 'arudhas')],
    ['houseFrame D1 h7, h2, h4, h8; D9 h7, h1; D7 h1', 'planetChain L7, L2, L8, Ju; UL and its 2nd, A7, DK', 'Shown for dating, committed, married, separated; separation never a verdict'],
    [inp('house', 'D1 h7,2,4,8; D9 h7,1; D7 h1', 'house_card'), inp('planet', 'D1 cards of L7, L2, L8, Ju', 'planet_card'), inp('point', 'UL, A7, DK', 'point_row')], 'src/reading/self/panels/love.ts bondPanel', [7, 2, 4, 8], ['D1', 'D9', 'D7'], 'board_panel.v1'),
  builtBoardReading('love.reading.circle', 'Love reading: who else is in it (family, in-laws, friends, children as facts)', 'love', [c('divisional', 'D1'), c('divisional', 'D7'), c('jaimini', 'charakaraka')],
    ['houseFrame D1 h2, h4, h11, h5; D7 h5', 'planetChain L2, L4, L11, Mo, Ju; MK, PK, A11', 'Shown for committed, married, separated, complicated; nothing about a child under 18'],
    [inp('house', 'D1 h2,4,11,5; D7 h5', 'house_card'), inp('planet', 'D1 cards of L2, L4, L11, Mo, Ju', 'planet_card'), inp('point', 'MK, PK, A11', 'point_row')], 'src/reading/self/panels/love.ts circlePanel', [2, 4, 11, 5], ['D1', 'D7'], 'board_panel.v1'),
  builtBoardReading('love.reading.struggle', 'Love reading: what tests it (board.struggle filtered to love)', 'love', [c('divisional', 'D1'), c('natal', 'doshas'), c('dasha', 'reading clock L1-L3')],
    ['board.struggle with planets L7, Ve, DK, Mo, the UL lord and houses 7,5,8,12', 'Sa, Ma, Ra, Ke on or aspecting 7, Ve or UL; Kalathra and Manglik rows; L7 in 6/8/12; Ve debilitated without a cancellation; release from the reading clock'],
    [inp('planet', 'D1 cards of L7, Ve, DK, Mo', 'planet_card'), inp('house', 'D1 h7,5,8,12', 'house_card'), inp('yoga', 'Kalathra, Manglik rows', 'yoga_row'), inp('activation', 'reading clock L1-L3 running', 'activation_row')], 'src/reading/self/panels/love.ts loveStrugglePanel', [7, 5, 8, 12], ['D1'], 'board_struggle.v1'),
  builtBoardReading('love.reading.year', 'Love reading: this year (board.year filtered to love)', 'love', [c('annual', 'tithi_pravesha'), c('annual', 'varsha')],
    ['board.year on house 7, Venus, the natal L7 and the UL sign; Vivaha and Preethi sahams when stored'],
    [inp('annual', 'TP and VP D1 of the running year', 'annual_row')], 'src/reading/self/panels/love.ts loveYearPanel', [7], ['D1'], 'board_year.v1'),
  builtBoardReading('love.reading.purview', 'Love reading: the whole-chart purview check (board.purview, Love instance)', 'love', [c('divisional', 'D1'), c('divisional', 'D9'), c('natal', 'yogas'), c('dasha', 'reading clock')],
    ['Runs over the full digest and the reading clock after the Love panels: 7th lord standing, cancellations, combustion and retrograde, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, Upapada/Darapada, and the stored sky'],
    [inp('findings', 'claims of every Love panel', 'findings_in'), inp('planet', 'D1 and D9 cards of L7, L5, Ve, Mo, DK', 'planet_card'), inp('yoga', 'cancellation rows', 'yoga_row'), inp('activation', 'reading clock running', 'activation_row')], 'src/reading/self/purview.ts runPurview, applyPurview', [7, 5], ['D1', 'D9'], 'purview.v1'),
  builtBoardReading('love.reading.audit', 'Love reading: the code auditor over the cards (board.auditor, Love instance)', 'love', [c('natal', 'dossier rows')],
    ['Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows'],
    [inp('findings', 'the cards and claims of the build', 'findings_in')], 'src/reading/self/audit.ts auditCards', [7], ['D1'], 'code_audit.v1'),
  {
    id: 'love.reading.oracle',
    title: 'Love reading: AI family sub-agents, Love Lineman, and Love Oracle synthesis',
    category: 'love',
    board: 'love',
    status: 'built',
    charts: [
      c('natal', 'panel claims'),
      c('divisional', 'D1'),
      c('divisional', 'D9'),
      c('divisional', 'D7'),
      c('dasha', 'reading clock'),
      c('annual', 'tithi_pravesha'),
      c('transit', 'sky overlay'),
    ],
    algorithm: [
      'Reuses the five shared chart family sub-agent findings (family.rasi, family.varga, family.dasha, family.year, family.sky) from reading_findings_cache across Self, Love, and Work',
      'Compiles the family sub-agent findings, the eight deterministic Love panel claims, and the whole-chart purview rules through the Love Lineman AI agent (lineman.love) into a unified Love brief',
      'Synthesizes the personalized Love reading through the Love Oracle synthesizer (love.reading_oracle), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard',
    ],
    source: `${BOARD_READING_SOURCE}; docs/reading-engine/63 §4.1`,
    code: 'src/reading/self/oracle.ts runSelfOracle',
    agents: [
      'love.reading_oracle',
      'family.rasi',
      'family.varga',
      'family.dasha',
      'family.year',
      'family.sky',
      'lineman.love',
    ],
    accuracy: 'area_checks:love',
    selectors: { boards: ['love'], houses: LOVE_HOUSES, vargas: ['D1', 'D9', 'D7'] },
    contract: {
      inputs: [
        inp('house', 'D1 and divisional house cards 1..12', 'house_card'),
        inp('planet', 'D1 and divisional planet cards with avasthas and dasha_charter', 'planet_card'),
        inp('yoga', 'D1 yogas, doshas, and cancellations', 'yoga_row'),
        inp('point', 'D1/D9 chara karakas, arudha padas, and Lunar Astro points', 'point_row'),
        inp('star', 'Moon star, lagna star, gandanta, and pending karma houses', 'star_profile'),
        inp('annual', 'running Tithi Pravesha and Varsha annual charts', 'annual_row'),
        inp('activation', 'reading clock L1-L3 and confirming clocks L1', 'activation_row'),
      ],
      system: 'src/reading/prompts/oracle/self.md',
      user: ['FACTS', 'TODAY'],
      output: 'self_reading.v1',
    },
  },
  builtBoardReading('work.reading.clock', 'Work reading: the reading clock and confirming clocks (Work instance)', 'work', [c('dasha', 'kundli_activation')],
    ['kundli.preferred_dasha when present in kundli_activation; else the first conditional dasha present; else vimshottari', 'Confirming clocks in configured order from what is stored'],
    [inp('activation', 'distinct (system, family) at level 1', 'activation_row')], 'src/reading/self/clock.ts resolveClock', [10], ['D1'], 'self_clock.v1'),
  builtBoardReading('work.reading.diagnosis', 'Work reading: your work life, in short (three sentences from the Work panels and chapters)', 'work', [c('natal', 'panel claims')],
    ['Built last from the claims of the Work fact panels and work.reading.chapters', 'What the person is built to do and how they stand; the central tension (strongest knot on 10, L10, Sa or AmK, or the heaviest running affliction); where work stands now, dated'],
    [inp('findings', 'claims of work.reading.vocation, standing, ground, gain, chapters', 'findings_in')], 'src/reading/self/panels/work.ts workDiagnosisPanel', [10], ['D1', 'D10'], 'board_diagnosis.v1'),
  builtBoardReading('work.reading.chapters', 'Work reading: your chapters for work (board.chapters filtered to the work houses)', 'work', [c('dasha', 'reading clock L1-L2'), c('dasha', 'confirming clocks L1')],
    ['board.chapters with houses 10,6,11,2,9,3,5,7 and planets L10, Sa, Me, Su, Ju, AmK', 'Per chapter: the work houses the lord activates; A10 held by the chapter sign on a sign clock; the faculty, never a job event'],
    [inp('activation', 'reading clock L1-L2 and confirming clocks L1, houses 10,6,11,2,9,3,5,7', 'activation_row'), inp('planet', 'D1 cards of the chapter lords', 'planet_card')], 'src/reading/self/panels/work.ts workChaptersPanel', WORK_HOUSES, ['D1', 'D10'], 'board_chapters.v1'),
  builtBoardReading('work.reading.vocation', 'Work reading: what you are built to do (10th, its lord, D10, AmK, the four karakas, karakamsa)', 'work', [c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D10'), c('jaimini', 'charakaraka')],
    ['houseFrame D1 h10, h3, h5; D10 h1, h10; planetChain L10 (D1, D9, D10), the AmK, Sa, Me, Su, Ju and planets in D1 h10 and D10 h10', 'Karakamsa and its 10th for the Jaimini vocation rule; ranked, never a single profession as a verdict'],
    [inp('house', 'D1 h10,3,5; D10 h1,10', 'house_card'), inp('planet', 'D1, D9, D10 cards of L10, AmK, Sa, Me, Su, Ju', 'planet_card'), inp('point', 'AmK, A10, D9 AK', 'point_row')], 'src/reading/self/panels/work.ts vocationPanel', [10, 3, 5], ['D1', 'D9', 'D10'], 'board_panel.v1'),
  builtBoardReading('work.reading.standing', 'Work reading: how you are seen (AL, A10, Sun, 10th lord, D10 lagna)', 'work', [c('divisional', 'D1'), c('divisional', 'D10'), c('jaimini', 'arudhas')],
    ['houseFrame D1 h10, h1 and the AL house; D10 frame of the AL house; planetChain Su, L10', 'Recognition as a fact here, as a window only in the career map'],
    [inp('house', 'D1 h10,1, AL house; D10 AL house', 'house_card'), inp('planet', 'D1 cards of Su, L10', 'planet_card'), inp('point', 'AL, A10, D10 lagna', 'point_row')], 'src/reading/self/panels/work.ts standingPanel', [10, 1], ['D1', 'D10'], 'board_panel.v1'),
  builtBoardReading('work.reading.ground', 'Work reading: where the work is now (6th, 3rd, 7th, 12th, D10 6th and 3rd)', 'work', [c('divisional', 'D1'), c('divisional', 'D10')],
    ['houseFrame D1 h6, h3, h7, h12; D10 h6, h3; planetChain L6, L3; A6, A3', 'Never a job-end prediction (career map windows only)'],
    [inp('house', 'D1 h6,3,7,12; D10 h6,3', 'house_card'), inp('planet', 'D1 cards of L6, L3', 'planet_card'), inp('point', 'A6, A3', 'point_row')], 'src/reading/self/panels/work.ts groundPanel', [6, 3, 7, 12], ['D1', 'D10'], 'board_panel.v1'),
  builtBoardReading('work.reading.gain', 'Work reading: what it pays (11th, 2nd, D2, D10 11th, dhana yogas of the work lords)', 'work', [c('divisional', 'D1'), c('divisional', 'D2'), c('divisional', 'D10'), c('natal', 'yogas')],
    ['houseFrame D1 h11, h2; D2 h1 when stored; D10 h11; planetChain L11, L2; A11, A2; dhana yogas touching L10, L11, L2', 'No amounts'],
    [inp('house', 'D1 h11,2; D2 h1; D10 h11', 'house_card'), inp('planet', 'D1 cards of L11, L2', 'planet_card'), inp('point', 'A11, A2', 'point_row'), inp('yoga', 'dhana rows touching L10, L11, L2', 'yoga_row')], 'src/reading/self/panels/work.ts gainPanel', [11, 2], ['D1', 'D2', 'D10'], 'board_panel.v1'),
  builtBoardReading('work.reading.struggle', 'Work reading: what tests it (board.struggle filtered to work)', 'work', [c('divisional', 'D1'), c('natal', 'avasthas'), c('dasha', 'reading clock L1-L3')],
    ['board.struggle with planets L10, L6, Sa, AmK, Su and houses 10,6,11,2', 'L10 in 6/8/12; Sa debilitated or mrita; Ra or Ke on 10 or the AL; never the layoff, firing or resignation signatures'],
    [inp('planet', 'D1 cards of L10, L6, Sa, AmK, Su', 'planet_card'), inp('house', 'D1 h10,6,11,2', 'house_card'), inp('activation', 'reading clock L1-L3 running', 'activation_row')], 'src/reading/self/panels/work.ts workStrugglePanel', [10, 6, 11, 2], ['D1'], 'board_struggle.v1'),
  builtBoardReading('work.reading.year', 'Work reading: this year (board.year filtered to work)', 'work', [c('annual', 'tithi_pravesha'), c('annual', 'varsha')],
    ['board.year on house 10, the natal L10, Saturn and A10; Karma and Labha sahams when stored'],
    [inp('annual', 'TP and VP D1 of the running year', 'annual_row')], 'src/reading/self/panels/work.ts workYearPanel', [10], ['D1'], 'board_year.v1'),
  builtBoardReading('work.reading.purview', 'Work reading: the whole-chart purview check (board.purview, Work instance)', 'work', [c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D10'), c('natal', 'yogas'), c('dasha', 'reading clock')],
    ['Runs over the full digest and the reading clock after the Work panels: 10th lord standing, cancellations, combustion and retrograde, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, Arudha/Rajyapada/Ghatika, and the stored sky'],
    [inp('findings', 'claims of every Work panel', 'findings_in'), inp('planet', 'D1 and D9 cards of L10, L6, L11, AmK, Sa, Su, Me, Ju', 'planet_card'), inp('yoga', 'cancellation rows', 'yoga_row'), inp('activation', 'reading clock running', 'activation_row')], 'src/reading/self/purview.ts runPurview, applyPurview', [10, 6, 11], ['D1', 'D9', 'D10'], 'purview.v1'),
  builtBoardReading('work.reading.audit', 'Work reading: the code auditor over the cards (board.auditor, Work instance)', 'work', [c('natal', 'dossier rows')],
    ['Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows'],
    [inp('findings', 'the cards and claims of the build', 'findings_in')], 'src/reading/self/audit.ts auditCards', [10], ['D1'], 'code_audit.v1'),
  {
    id: 'work.reading.oracle',
    title: 'Work reading: AI family sub-agents, Work Lineman, and Work Oracle synthesis',
    category: 'work',
    board: 'work',
    status: 'built',
    charts: [
      c('natal', 'panel claims'),
      c('divisional', 'D1'),
      c('divisional', 'D9'),
      c('divisional', 'D10'),
      c('divisional', 'D2'),
      c('dasha', 'reading clock'),
      c('annual', 'tithi_pravesha'),
      c('transit', 'sky overlay'),
    ],
    algorithm: [
      'Reuses the five shared chart family sub-agent findings (family.rasi, family.varga, family.dasha, family.year, family.sky) from reading_findings_cache across Self, Love, and Work',
      'Compiles the family sub-agent findings, the eight deterministic Work panel claims, and the whole-chart purview rules through the Work Lineman AI agent (lineman.work) into a unified Work brief',
      'Synthesizes the personalized Work reading through the Work Oracle synthesizer (work.reading_oracle), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard',
    ],
    source: `${BOARD_READING_SOURCE}; docs/reading-engine/63 §4.1`,
    code: 'src/reading/self/oracle.ts runSelfOracle',
    agents: [
      'work.reading_oracle',
      'family.rasi',
      'family.varga',
      'family.dasha',
      'family.year',
      'family.sky',
      'lineman.work',
    ],
    accuracy: 'area_checks:work',
    selectors: { boards: ['work'], houses: WORK_HOUSES, vargas: ['D1', 'D9', 'D10', 'D2'] },
    contract: {
      inputs: [
        inp('house', 'D1 and divisional house cards 1..12', 'house_card'),
        inp('planet', 'D1 and divisional planet cards with avasthas and dasha_charter', 'planet_card'),
        inp('yoga', 'D1 yogas, doshas, and cancellations', 'yoga_row'),
        inp('point', 'D1/D9 chara karakas, arudha padas, and Lunar Astro points', 'point_row'),
        inp('star', 'Moon star, lagna star, gandanta, and pending karma houses', 'star_profile'),
        inp('annual', 'running Tithi Pravesha and Varsha annual charts', 'annual_row'),
        inp('activation', 'reading clock L1-L3 and confirming clocks L1', 'activation_row'),
      ],
      system: 'src/reading/prompts/oracle/self.md',
      user: ['FACTS', 'TODAY'],
      output: 'self_reading.v1',
    },
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Self v2 agents (doc 66 §4.8)
// Layer 3 of the You board v2: the Oracle (three calls over one cached natal prefix), the Personalizer and the hero it
// writes. The sub-techniques and areas (Layers 1–2) are another block, appended by their own lane.
// ---------------------------------------------------------------------------------------------------------------------
const SELF_V2_SOURCE = 'docs/reading-engine/66 §4.1, §4.8; BPHS (lordship, dignity, avasthas, dasha-lord rules); Jaimini (karakas, arudhas); SOUL.md four tiers';
const SELF_V2_NATAL_INPUTS: ContractInput[] = [
  inp('house', 'D1 and divisional house cards 1..12 (the family.rasi and family.varga packs)', 'house_card'),
  inp('planet', 'D1 and divisional planet cards with avasthas and dasha_charter', 'planet_card'),
  inp('yoga', 'D1 yogas, doshas and cancellations behind the promise ledger', 'yoga_row'),
  inp('point', 'D1/D9 chara karakas, arudha padas and special lagnas', 'point_row'),
  inp('star', 'Moon star, lagna star, gandanta', 'star_profile'),
  inp('annual', 'the running year chart and its short clock (S9)', 'annual_row'),
  inp('activation', 'the reading clock L1-L3, its boundaries and the windows around today (S2, S3)', 'activation_row'),
];
const SELF_V2_AGENTS: TechniqueDef[] = [
  {
    id: 'self.v2.oracle',
    title: 'You board v2: Oracle over the ledgers and the area briefs',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: [c('natal', 'D1'), c('divisional', 'D9'), c('divisional', 'D10'), c('divisional', 'D30'), c('dasha', 'reading clock'), c('annual', 'year chart'), c('transit', 'sky overlay')],
    algorithm: [
      'Builds every agent slice from the build context and the rows the sub-techniques loaded (no database read): the five family packs (family.sky padded past 1,024 tokens with its window rows) and the Oracle prefix (the family.rasi and family.varga natal packs plus the whole promise ledger), stable per digest version',
      'Warms every prefix in parallel in the explicit cache before the first agent call; each region has its llm_cache_entries row and the 45-minute recycler is informed after each call',
      'Runs the five family readers in parallel, read through reading_findings_cache',
      'Runs the Oracle as three parallel calls of three or four areas each over the same cached prefix, the suffix carrying the clock, periods, windows summary, the twelve heaviest risk-ledger rows, the eight strongest promise entries, the mind, body, presence and year facts, the eleven area briefs, the family findings and the confirms',
      'Merges the three JSON documents and validates them with the area validator: every evidence key from the input (claim ids keep their claim: prefix), every date inside a period, window or year span the input carries, caps; up to three patterns for mind and stuck',
      'Stores only a complete, validated document in technique_outputs, keyed by digest version, clock, boundary stamps, input hash and prompt hash',
    ],
    source: SELF_V2_SOURCE,
    code: 'src/reading/self/v2/build.ts runSelfV2Build; src/reading/self/v2/oracle.ts runOracleV2; src/reading/self/v2/slices.ts buildSelfV2Slices',
    agents: ['self.oracle.v2', 'family.rasi', 'family.varga', 'family.dasha', 'family.year', 'family.sky'],
    accuracy: 'area_checks:self',
    selectors: { boards: ['you'], subjects: ['general_life_direction'] },
    contract: { inputs: SELF_V2_NATAL_INPUTS, system: 'src/reading/prompts/oracle/self-areas-v2.md', user: ['TODAY', 'FACTS'], output: 'self_v2_oracle.v1' },
  },
  {
    id: 'self.v2.personalizer',
    title: 'You board v2: Personalizer cards for this person',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: [c('dasha', 'reading clock'), c('transit', 'windows around today')],
    algorithm: [
      'Takes the validated Oracle document as the cached prefix (stable per Oracle key) and the profile pack (age band, stated gender or none, role, facts, declined topics, last confirms, mood) with the windows summary as the suffix',
      'Writes one card per area (headline, two or three short paragraphs, patterns, the four-step ladder best, practical, drift, floor, dates copied from the Oracle) in plain second person, JSON by schema',
      'Validates every headline and body sentence against a source (an Oracle paragraph id or evidence key), every date against the Oracle document, and rejects chart terms, engine names, internal ids, medical words and, when no gender is stated, gendered words; a card with no body is withheld and the Oracle headline, redacted, stands in',
      'Stores the hero and cards in technique_outputs under the Oracle key, the profile hash and the prompt hash, so a profile change re-runs only this step',
    ],
    source: SELF_V2_SOURCE,
    code: 'src/reading/self/v2/personalizer.ts runPersonalizer; src/reading/self/v2/personalizerValidate.ts validatePersonalDoc',
    agents: ['self.personalizer'],
    accuracy: 'area_checks:self',
    selectors: { boards: ['you'], subjects: ['general_life_direction'] },
    contract: {
      inputs: [inp('activation', 'the windows summary around today (S3): heaviest now, eases at, next support from', 'activation_row')],
      system: 'src/reading/prompts/personalizer/self.md',
      user: ['TODAY', 'FACTS'],
      output: 'self_v2_cards.v1',
    },
  },
  {
    id: 'self.v2.hero',
    title: 'You board v2: the hero (tone, one dated sentence, one question)',
    category: 'self',
    board: 'you',
    status: 'built',
    charts: [c('dasha', 'reading clock'), c('transit', 'windows around today')],
    algorithm: [
      'The Personalizer writes the tone (demanding, heavy, mixed, easing, steady or open), one sentence naming the life area and the date it changes, and one yes-or-no question on the strongest dated claim of the live areas',
      'Code fills the six-month window strip, the easing date and the next check from the stored windows',
      'The question is kept only when its claim id is in the Oracle document; the hero is withheld when the live areas are missing, all only possible, or split between strong and possible',
    ],
    source: SELF_V2_SOURCE,
    code: 'src/reading/self/v2/personalizerValidate.ts validateHero, heroSplit',
    agents: ['self.personalizer'],
    accuracy: 'area_checks:self',
    selectors: { boards: ['you'], subjects: ['general_life_direction'] },
    contract: {
      inputs: [inp('activation', 'the six-month window strip and the easing date (S3)', 'activation_row')],
      system: 'src/reading/prompts/personalizer/self.md',
      user: ['TODAY', 'FACTS'],
      output: 'self_v2_hero.v1',
    },
  },
];

export const TECHNIQUES: TechniqueDef[] = [...WORK_BUILT, ...WORK_EXTRA_BUILT, ...LUCKY_SCENARIO_ROWS, ...LUCKY_SHARED, ...LOVE_PLANNED, ...LOVE_SUBAREAS, ...SELF_PLANNED, ...SELF_EXTRA_BUILT, ...SELF_READING, ...BOARD_READING_BUILT, ...GENERAL, ...DIGEST, ...LIFE, ...RESEARCH, ...SELF_V2_AGENTS];

const BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

export function techniqueById(id: string | null | undefined): TechniqueDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** The `technique_registry` row for a definition. */
export function techniqueRow(t: TechniqueDef) {
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    board: t.board,
    status: t.status,
    charts: t.charts as unknown as object,
    algorithm: t.algorithm as unknown as object,
    special: t.special ?? null,
    source: t.source,
    code_ref: t.code,
    agents: t.agents as unknown as object,
    accuracy: t.accuracy,
    selectors: t.selectors as unknown as object,
    contract: t.contract as unknown as object,
  };
}

let seedWarned = false;

/** One statement for the whole catalogue (one round trip), so it finishes inside a Lambda cold start. */
export const TECHNIQUE_SEED_SQL = `INSERT INTO technique_registry (id, title, category, board, status, charts, algorithm, special, source, code_ref, agents, accuracy, selectors, contract, updated_at)
  SELECT x.id, x.title, x.category, x.board, x.status, coalesce(x.charts, '[]'), coalesce(x.algorithm, '[]'), x.special, x.source, x.code_ref,
         coalesce(x.agents, '[]'), x.accuracy, coalesce(x.selectors, '{}'), coalesce(x.contract, '{}'), now()
    FROM jsonb_to_recordset($1::jsonb) AS x(id text, title text, category text, board text, status text, charts jsonb, algorithm jsonb,
         special text, source text, code_ref text, agents jsonb, accuracy text, selectors jsonb, contract jsonb)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, board = EXCLUDED.board, status = EXCLUDED.status,
    charts = EXCLUDED.charts, algorithm = EXCLUDED.algorithm, special = EXCLUDED.special, source = EXCLUDED.source,
    code_ref = EXCLUDED.code_ref, agents = EXCLUDED.agents, accuracy = EXCLUDED.accuracy, selectors = EXCLUDED.selectors,
    contract = EXCLUDED.contract, updated_at = now()`;

/**
 * Upserts every technique into `technique_registry`. Idempotent; awaited at boot (server.ts, before listen). With a real
 * client it is one statement; a client without raw SQL (the test fakes) falls back to one upsert per row. Logs once and
 * never throws.
 */
export async function seedTechniqueRegistry(prisma: Pick<PrismaClient, 'techniqueRegistry'>): Promise<number> {
  const raw = (prisma as unknown as { $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number> }).$executeRawUnsafe;
  if (typeof raw === 'function') {
    try {
      await raw.call(prisma, TECHNIQUE_SEED_SQL, JSON.stringify(TECHNIQUES.map(techniqueRow)));
      return TECHNIQUES.length;
    } catch (e) {
      if (!seedWarned) console.warn(`[techniques] registry seed failed: ${(e as Error).message}`);
      seedWarned = true;
      return 0;
    }
  }
  let n = 0;
  for (const t of TECHNIQUES) {
    const row = techniqueRow(t);
    try {
      await prisma.techniqueRegistry.upsert({ where: { id: row.id }, create: row, update: { ...row, updated_at: new Date() } });
      n += 1;
    } catch (e) {
      if (!seedWarned) console.warn(`[techniques] registry seed failed: ${(e as Error).message}`);
      seedWarned = true;
      return n;
    }
  }
  return n;
}

/** tests */
export function resetTechniqueSeedState(): void {
  seedWarned = false;
}
