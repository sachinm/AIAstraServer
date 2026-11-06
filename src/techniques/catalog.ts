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

const WORK_PLANNED: TechniqueDef[] = [
  {
    id: 'work.annual_family',
    title: "This year's chart (annual family)",
    category: 'work',
    board: 'work',
    status: 'planned',
    charts: [c('annual', 'tithi_pravesha'), c('annual', 'tithi_pravesha_dasha'), c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'sahams'), c('divisional', 'D10')],
    algorithm: [
      'Read the Tithi Pravesha chart of the current year and its D10',
      "Find the running Mudda or Patyayini lord and its place in the year chart's D10",
      "Read the houses of the rajya and karma sahams",
      'Cast one vote (support, test or neutral) as the sixth family of the present tone',
    ],
    source: 'docs/reading-engine/43 §8.1 (family 5); 46 §B.6; 53 §4.5',
    code: 'not built (career.ts FAMILIES_NOT_BUILT; reads the digest annual set, doc 53 step 3)',
    agents: [],
    accuracy: 'none',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('annual', 'TP current year, D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; year dasha running this month', 'annual_row')], 'family_vote.v1', 'work.present_tone'),
  },
  {
    id: 'work.conditional_family',
    title: 'Conditional clock',
    category: 'work',
    board: 'work',
    status: 'planned',
    charts: [c('dasha', 'applicable'), c('dasha', 'conditional')],
    algorithm: [
      'Read which conditional dashas the engine says apply to the chart (dasha.applicable)',
      "Take the running lords at three levels and cast the main clock's career polarity rule on them",
      'No vote when none applies',
    ],
    source: 'docs/reading-engine/43 §8.1 (family 2); 46 §B.4; 53 §4.5',
    code: 'not built (career.ts FAMILIES_NOT_BUILT; reads the activation calendar, doc 53 step 3)',
    agents: [],
    accuracy: 'none',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('activation', 'conditional systems named by dasha.applicable, levels 1–3, periods covering this month ±1, houses 10,6,1', 'activation_row')], 'family_vote.v1', 'work.present_tone'),
  },
  {
    id: 'work.karaka_family',
    title: 'Karaka clock',
    category: 'work',
    board: 'work',
    status: 'planned',
    charts: [c('dasha', 'karaka'), c('jaimini', 'chara_karakas'), c('divisional', 'D10')],
    algorithm: [
      'Read the running karaka dasha lord (dasha.karaka.l3)',
      'AmK or the 10th lord running gives support unless it is afflicted in D10',
      'One planet, one vote across the main, conditional and karaka clocks',
    ],
    source: 'docs/reading-engine/43 §8.1 (family 4); 46 §B.4; 53 §4.5',
    code: 'not built (career.ts FAMILIES_NOT_BUILT; reads the activation calendar, doc 53 step 3)',
    agents: [],
    accuracy: 'none',
    selectors: WORK_SELECTORS,
    contract: codeContract([inp('activation', 'karaka dasha level 3, periods covering this month ±1', 'activation_row'), inp('point', 'AmK and the 10th lord in D1 and D10', 'point_row'), inp('planet', 'D10 card of the running karaka lord', 'planet_card')], 'family_vote.v1', 'work.present_tone'),
  },
  {
    id: 'work.d10_check',
    title: 'D1 and D10 agreement on each dasha vote',
    category: 'work',
    board: 'work',
    status: 'planned',
    charts: [c('divisional', 'D1'), c('divisional', 'D10'), c('divisional', 'D9'), c('divisional', 'D60')],
    algorithm: [
      'For the running lord of the main, conditional and karaka clocks, read its place and dignity in D1, D10, D9 and D60',
      'A dasha vote counts only when D1 and D10 agree on its side; D9 breaks a tie',
      'D60 confirms only when the birth time is recorded to the minute, and never decides alone',
      "When D1 and D10 disagree, the family's vote is split and not counted",
    ],
    special: 'Waits for the house-state engine (doc 46)',
    source: 'docs/reading-engine/43 §8.1; 46 §B.7; 53 §4.5',
    code: 'not built (career.ts header: waits for doc 46; reads the D10 house cards of the digest, doc 53 step 3)',
    agents: [],
    accuracy: 'none',
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
      "Personal: the hora lord's nature for this chart, functional benefic or malefic from the digest planet cards of D1, moves a window by ±1 (read through functionalNatureOf; no mark while the digest is not wired or not ready)",
      "Personal (planned, doc 53 §4.6): whether the day's tithi lord or star lord is a running dasha lord in the activation calendar, marked on the window",
    ],
    special: 'The hora-lord mark is built and reads the digest through functionalNatureOf, wired to null until the digest reader lands (doc 54 S1); the dasha-lord mark is planned',
    source: 'docs/reading-engine/49 §4.1; 53 §4.6',
    code: 'src/reading/luckyTimes/service.ts personalDays, LuckyDeps.functionalNatureOf; windows.ts personalScore, scenarioDay (hora nature)',
    agents: ['lucky.day_overlay'],
    accuracy: 'staff',
    selectors: LUCKY_SELECTORS,
    contract: codeContract([OVERLAY_INPUT, inp('planet', 'D1 cards of the seven hora lords (nature column)', 'planet_card'), inp('activation', 'periods running on each day, every system; planned', 'activation_row')], 'day_overlay.v1'),
  },
  {
    id: 'lucky.day_tables',
    title: 'Shared day tables per place',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'muhurta')],
    algorithm: [
      'General: find the days in today −7 … today +14 that the place has no stored row for',
      "General: call the engine's muhurta for at most two missing months at the place",
      'General: store one row per day (day_tables) with its calc version and a hash of the payload; one sky for every user at that place',
    ],
    source: 'docs/reading-engine/47 §3; 49 §4.1',
    code: 'src/reading/luckyTimes/service.ts pullDayTables',
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
      "General: read the day's five limbs from the place's stored day row, each with its end time",
      "General: vara: the weekday and its lord, favoured or avoided per the act's scenario row",
      "General: tithi: its group (nanda, bhadra, jaya, rikta, purna; amavasya) per the scenario's tithi lists",
      "General: nakshatra: the Moon's star and its group per the scenario's star lists",
      `General: yoga (the engine's name at noon with its span; 27 yogas, spelling matched to the classical names): avoided — ${list(YOGA_AVOID_DEFAULT)}; favoured (+1) — ${list(YOGA_FAVOUR_DEFAULT)}`,
      "General: karana (the engine's name at noon with its span; 11 karanas): avoided — Vishti (Bhadra); favoured for most acts — Bava, Balava, Kaulava, Taitila, Gara, Vanija (named on the window, no score); the four fixed karanas (Shakuni, Chatushpada, Naga, Kimstughna) carry no default until the act-by-act rule is reviewed",
      'General: the general limbs decide the day gate: an avoided yoga or karana span is cut out of every candidate like an avoid band, so a day it fills is gated out for the act (day reason yoga_avoid / karana_avoid); a favoured yoga adds +1 to a piece inside its span',
      "General: the day's yoga and karana (name and end hour) ride on each day of the range for the Why sheet",
      "Personal: the person's marks (lucky.personal_overlay) then move a window by ±1; they never open a gated day",
    ],
    special: 'Only the noon yoga and karana are in the stored row; outside their spans no yoga or karana rule applies until the engine gives the next limb',
    source: 'docs/reading-engine/53 §4.6, 54 §6; Muhurta Chintamani; B.V. Raman, Muhurta',
    code: 'src/reading/luckyTimes/scenarios.ts yogaAvoid/yogaFavour/karanaAvoid/karanaFavour, yogaName, karanaName; windows.ts dayLimbs, scenarioDay; service.ts getRange',
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
  built: { agent: 'area.love_board', config: 'love.ts LOVE', layers: { promise: ['promiseLayer'], affliction: ['afflictionLayer', 'releaseOf'], protection: ['protectionLayer'], activation: ['gradeRow', 'familyVotes', 'aheadWindows'], transit: ['transitLayer'], annual: ['currentYear', 'annualLayer'] } },
});
const SELF_PLANNED = houseStateLayers({
  prefix: 'self', board: 'you', houses: 'houses 1, 4 and 5 with the Moon', houseNumbers: [1, 4, 5, 9, 12], vargas: ['D1', 'D9', 'D20', 'D24', 'D12', 'D4', 'D7', 'D60'], karakas: 'Sun for the 1st, Moon and Mercury for the 4th, Jupiter for the 5th',
  subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha'], planets: 'the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK', points: 'AK, SL, AL',
  built: { agent: 'area.self_board', config: 'self.ts SELF', layers: { promise: ['promiseLayer'], affliction: ['afflictionLayer', 'releaseOf'], protection: ['protectionLayer'], activation: ['gradeRow', 'familyVotes', 'aheadWindows'], transit: ['transitLayer'], annual: ['currentYear', 'annualLayer'] } },
});

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
    charts: [c('natal', 'facts'), ...FRAME_VARGAS, c('dasha', 'vimshottari'), c('dasha', 'narayana')],
    algorithm: [...ANALYST_STEPS('base, frame, detail, varga, dasha'), "The dasha section holds the Vimshottari periods inside the horizon, each period lord's place in the frame vargas and the running Narayana sign"],
    special: 'Becomes general.dasha_all_systems in D3 (doc 53 §4.4): every served system from the activation calendar, grouped into the seven families of doc 46 §B.4; the id stays so tagged runs keep joining. Reads the digest when it is ready for base, detail and varga; the dasha section stays the dossier periods until the activation calendar is read',
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
    charts: [c('natal', 'facts'), c('annual', 'tithi_pravesha'), c('annual', 'tithi_pravesha_dasha')],
    algorithm: [...ANALYST_STEPS('base, frame, annual'), 'Runs only when the graph has the Tithi Pravesha year chart and its dasha for the question'],
    special: 'Becomes general.annual_set in D3 (doc 53 §4.4): the current, previous and next year (TP and VP, D1, D9, D10) with their year dashas, sahams, muntha and year lord when served; the id stays so tagged runs keep joining. Selected for horizons within 24 months (so the oracle reader R11 runs only then too); a timing question on a longer horizon is a planned any-of rule. Reads the digest when it is ready for base; the annual section stays the year chart fetched for the question until the digest annual rows are read',
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
      'The Narayana and Chara periods inside the horizon join when the activation calendar is read (not yet)',
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
    code: 'src/reading/clarify/planner.ts; service.ts',
    agents: ['reading.clarify'],
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
      "planet D<n>.<planet>: sign, house, degree, star, pada and star lord, dignity, retro, combust, war, dispositor and its house (dignities.dN); dispositor chain (avasthas), avasthas (avasthas.dN for D1, D9, D10, D16, D24), shadbala ratio and rank, natural and functional nature and houses owned (D1: facts.bodies, benefic_malefic; elsewhere the houses whose engine lord is the planet), aspects_to and aspected_by (aspects.dN), conjunctions (same sign). Vargas served only as placement rows (varga.dN without dignities.dN) get planet cards with sign, degree, star and pada, and no house cards: the engine states no house table for them",
      'yoga D1.<id>: the present yogas and doshas and the dossier yogas, one row per name, class from the dossier where it names one',
      "point <varga>.<id>: chara karakas placed by their planet's card in each varga; A1..A12 with AL and UL and the special points (SL, HL, GK, MD) of arudhas.dN; the dossier's special lagnas and the sphutas (D1); each with the lord of its sign and the lord's house from that chart's house table",
      'annual TP<year>.D<n> and VP<year>.D<n> for every stored year chart: lagna and house cards (as above, from the year chart tables); for D1 the year dashas (Tithi Pravesha: tithi_pravesha_dasha per stored system; Varsha: Mudda, Patyayini) and, for Varsha, the sahams in houses',
      'star profile: Moon star and its lord, lagna star, the tara of every star from the Moon star, gandanta flags (facts.nakshatra_profile; the D1 Moon card when there is no dossier)',
      'Writes the rows and the activation calendar in one transaction (old rows deleted, batches of 500) and stamps kundlis.digest_status ready with digest_version and digest_built_at, only while the status is still building; failed with the error type on an error, leaving the old rows',
      'It selects, counts, joins and dates; it never derives a sign, a lord, an aspect, a dignity, a yoga or a house (doc 46 §C.3; tests/unit/reading/digest/noAstrologyInNode.test.ts)',
    ],
    special: 'About 400 stored rows read and 1,500–2,500 digest rows written per research kundli. Run by the kundli-digest event and the kundli-digest-sweep (pending, stale, failed, another version, or stuck building); a registration pull that stores new rows marks a ready digest stale',
    source: 'docs/reading-engine/53 §4.1; 54 §2; 46 §C.3',
    code: 'src/reading/digest/build.ts buildDigestRows, buildDigest; load.ts loadDigest; event.ts',
    agents: ['digest.build'],
    accuracy: 'staff',
    selectors: DIGEST_SELECTORS,
    contract: codeContract([
      inp('house', 'dignities.dN, aspects.dN, argala.dN, arudhas.dN; D1 also house_counts, ashtakavarga, facts.houses; D1 and the vargas with dignities.dN', 'house_card'),
      inp('planet', 'dignities.dN, aspects.dN, avasthas.dN; D1 also strength.shadbala, benefic_malefic, facts.bodies; varga.dN placement rows for the other vargas', 'planet_card'),
      inp('yoga', 'yogas, doshas, facts.yogas (D1)', 'yoga_row'),
      inp('point', 'karaka.chara, arudhas(.dN), facts.special_lagnas, sphutas', 'point_row'),
      inp('annual', 'annual.{tithi_pravesha,varsha}@year=Y (D1, D9, D10), annual.{tithi_pravesha_dasha,mudda,patyayini,sahams}@year=Y, every stored year', 'annual_row'),
      inp('star', 'facts.nakshatra_profile', 'star_profile'),
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
      "Verdict from D1 and vargas only: 60 % or more promised, 40-59 % partial, under 40 % not written; withholding planets are the test lines' planets, heaviest first",
    ],
    special: "The antardasha lord's place from the mahadasha lord (6/8/12) is not read: it would be a derivation in Node; filed in docs/TODOS.md for the engine",
    source: 'docs/reading-engine/34 §2, §3; 54 §4',
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
    id: 'life.dashboard',
    title: 'Your life at a glance (Part 1 of the life reading)',
    category: 'general',
    board: 'timeline',
    status: 'built',
    charts: LIFE_CHARTS,
    algorithm: [
      'Needs the digest: when it is not ready the answer is preparing and the kundli is queued (digest_status pending unless building)',
      'Per area run the promise scale (life.promise_scale) and the timing (life.timing_agreement)',
      'Shown only when the area has a pressure now (a test line in the running periods or the sky) or a dated window',
      "Issue: the heaviest current test line as a plain sentence with its end date, then one confirming question worded from the person's stored facts (work.status, love.status, family.children)",
      'Cause: the planets of the current test lines and the withholding planets, the running periods that touch the area, and one plain sentence',
      "Solution: two practical steps per area, the date to hold until, the best window to act in, and traditional support from the chart's strongest functional benefic (a weekday and a gesture)",
      'Rule now: the running Vimshottari sub-period; its lord testing gives hold-and-prepare with what happens if broken, otherwise act on what is ready',
      'Stored per kundli per day in area_builds (area life); template sentences only, no model',
    ],
    source: 'docs/reading-engine/34 §1, §5 Part 1; 54 §4',
    code: 'src/reading/life/compose.ts composeDashboard; service.ts getLifeReading',
    agents: LIFE_AGENTS,
    accuracy: 'none',
    selectors: LIFE_SELECTORS,
    contract: codeContract([...LIFE_PROMISE_INPUTS, ...LIFE_TIMING_INPUTS], 'life_reading.v1'),
  },
];

export const TECHNIQUES: TechniqueDef[] = [...WORK_BUILT, ...WORK_PLANNED, ...LUCKY_SCENARIO_ROWS, ...LUCKY_SHARED, ...LOVE_PLANNED, ...LOVE_SUBAREAS, ...SELF_PLANNED, ...GENERAL, ...DIGEST, ...LIFE];

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
