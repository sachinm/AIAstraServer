/**
 * The technique catalogue (docs/admin/03 §4.1): one entry per board function or reading technique, with the charts it
 * reads, its algorithm in plain steps (written from the code path it names), its source, the agents that run it and
 * where its accuracy evidence comes from. The catalogue is code; at boot it is upserted into `technique_registry`, which
 * the admin panel reads. Runs are tagged with a technique id when they are written (src/agents/registry.ts withAgentRun,
 * src/reading/metrics/trace.ts).
 *
 * Nothing here computes anything astrological: it labels. Steps describe what the named code does with the engine's
 * stored values.
 */
import type { PrismaClient } from '@prisma/client';
import { FAMILIES, FAMILIES_NOT_BUILT } from '../reading/area/career.js';
import { SCENARIOS, type ScenarioRule } from '../reading/luckyTimes/scenarios.js';
import { SYSTEM_LABELS } from '../reading/timeline/types.js';
import { categoryOfLuckyArea, type TechniqueCategory } from './categories.js';

export type TechniqueBoard = 'you' | 'love' | 'work' | 'lucky' | 'chat';
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
}

const c = (source: ChartSource, id: string): TechniqueChart => ({ source, id });

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
      "The service hides sub-areas that do not fit the person's stated work status (careerService.ts fitsStatus)",
    ],
    source: 'docs/reading-engine/43 §2, §8.3',
    code: 'src/reading/area/career.ts careerMap (ahead), careerSubareas',
    agents: CAREER_AGENTS,
    accuracy: 'staff',
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
    source: 'docs/reading-engine/43 §8.1 (family 5); 46 §B.6',
    code: 'not built (career.ts FAMILIES_NOT_BUILT)',
    agents: [],
    accuracy: 'none',
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
    source: 'docs/reading-engine/43 §8.1 (family 2); 46 §B.4',
    code: 'not built (career.ts FAMILIES_NOT_BUILT)',
    agents: [],
    accuracy: 'none',
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
    source: 'docs/reading-engine/43 §8.1 (family 4); 46 §B.4',
    code: 'not built (career.ts FAMILIES_NOT_BUILT)',
    agents: [],
    accuracy: 'none',
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
    source: 'docs/reading-engine/43 §8.1; 46 §B.7',
    code: 'not built (career.ts header: waits for doc 46)',
    agents: [],
    accuracy: 'none',
  },
];

// ---------------------------------------------------------------- Lucky times (src/reading/luckyTimes)

const LUCKY_CHARTS: TechniqueChart[] = [c('panchang', 'tithi'), c('panchang', 'nakshatra'), c('panchang', 'weekday'), c('panchang', 'hora'), c('panchang', 'muhurta'), c('panchang', 'kalams')];
const list = (xs: readonly string[]): string => (xs.length ? xs.join(', ') : 'none');

/** One scenario's algorithm, from its rule row (scenarios.ts) and the scoring in windows.ts scenarioDay. */
export function scenarioAlgorithm(s: ScenarioRule): string[] {
  const from = s.hours[0] === 'sunrise' ? 'sunrise' : `${String(s.hours[0]).padStart(2, '0')}:00`;
  const steps = [
    "Read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)",
    s.dayAvoid.length ? `Whole day avoided on: ${list(s.dayAvoid)}` : 'No weekday is avoided',
    `Candidates: each hora between ${from} and ${String(s.hours[1]).padStart(2, '0')}:00 local, cut to those hours, 20 minutes or more${s.useBrahma ? '; plus brahma muhurta (+2)' : ''}`,
    'Cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes',
    `Weekday favoured (+1): ${list(s.dayFavour)}`,
    `Tithi group, inside its own span: favoured (+1) ${list(s.tithiFavour)}; avoided (piece dropped) ${list(s.tithiAvoid)}`,
    `Star group, inside its own span: favoured (+1) ${list(s.starFavour)}; avoided (−2) ${list(s.starAvoid)}`,
    `Hora lord: favoured (+2) ${list(s.horaFavour)}; avoided (−3) ${list(s.horaAvoid)}`,
    'Abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)',
    "Personal overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)",
    `Keep pieces scoring ${s.floor} or more; show the best two in time order`,
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
      "Read the place's stored day row (engine muhurta)",
      'Avoid bands: rahu kalam, yamagandam, gulikai, every durmuhurtam and varjyam span, in time order; an end before its start is read as past midnight',
      'Good spans: brahma muhurta, abhijit and every amrita gadiya',
      'What is running now: an avoid band first, then a good span, else the next good span',
    ],
    source: 'docs/reading-engine/49 §4.1; 47 §3',
    code: 'src/reading/luckyTimes/windows.ts avoidBands, nowState; service.ts getRange',
    agents: ['lucky.scenario_windows'],
    accuracy: 'staff',
  },
  {
    id: 'lucky.personal_overlay',
    title: 'Personal overlay (tara and chandra bala)',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'muhurta'), c('nakshatra', 'tara'), c('panchang', 'chandra_bala')],
    algorithm: [
      "Once per month and place, call the engine's muhurta with the person's natal fields",
      "Store each day's tara, chandra bala and grade (kundli_day_overlays)",
      "Use the engine's own good/bad verdicts: +1 / −1 each on every window of that day",
    ],
    source: 'docs/reading-engine/49 §4.1',
    code: 'src/reading/luckyTimes/service.ts personalDays; windows.ts personalScore',
    agents: ['lucky.day_overlay'],
    accuracy: 'staff',
  },
  {
    id: 'lucky.day_tables',
    title: 'Shared day tables per place',
    category: 'self',
    board: 'lucky',
    status: 'built',
    charts: [c('panchang', 'muhurta')],
    algorithm: [
      'Find the days in today −7 … today +14 that the place has no stored row for',
      "Call the engine's muhurta for at most two missing months at the place",
      'Store one row per day (day_tables) with its calc version and a hash of the payload; one sky for every user at that place',
    ],
    source: 'docs/reading-engine/47 §3; 49 §4.1',
    code: 'src/reading/luckyTimes/service.ts pullDayTables',
    agents: ['lucky.day_tables'],
    accuracy: 'none',
  },
];

// ---------------------------------------------------------------- Love and Self (planned: house-state engine, doc 46 Part B)

interface LayerTarget {
  prefix: 'love' | 'self';
  board: 'love' | 'you';
  houses: string;
  vargas: string[];
  karakas: string;
}

function houseStateLayers(t: LayerTarget): TechniqueDef[] {
  const vargaCharts = t.vargas.map((v) => c('divisional', v));
  const row = (name: string, title: string, section: string, charts: TechniqueChart[], algorithm: string[], special?: string): TechniqueDef => ({
    id: `${t.prefix}.${name}`,
    title,
    category: t.prefix,
    board: t.board,
    status: 'planned',
    charts,
    algorithm,
    ...(special ? { special } : {}),
    source: `docs/reading-engine/46 §${section}`,
    code: 'not built (house-state engine, doc 46)',
    agents: [],
    accuracy: 'none',
  });
  return [
    row('promise', `Natal promise of ${t.houses}`, 'B.2', [c('natal', 'facts'), c('natal', 'house_counts'), c('natal', 'dignities'), c('natal', 'aspects'), c('jaimini', 'argala'), c('ashtakavarga', 'sav'), c('natal', 'strength.bhava'), c('natal', 'yogas'), c('natal', 'doshas'), c('jaimini', 'arudhas'), c('natal', 'avasthas')], [
      `For ${t.houses}: lord in a kendra, trikona or the house itself +2; in 6, 8 or 12 −2`,
      "Lord's dignity +2 / −2 (neecha bhanga checked); functional benefic / malefic occupants and graha drishti ±1; rasi drishti ±0.5",
      'Argala net ±1; SAV of the sign ≥ 28 / ≤ 22 ±1; bhava bala rank top 4 / bottom 4 ±1',
      'Yogas that include the house or its lord +1 to +3; doshas touching it −1 to −2',
      `Natural karaka strong / weak ±1 (${t.karakas}); arudha of the house with benefics / malefics ±1; its special lagna +1`,
      "Lord's avastha: x1.25 awake, x0.5 dead; cap the sum to −8..+8; below −3 the house is not promised",
    ]),
    row('affliction', `Afflictions on ${t.houses}`, 'B.3', [c('natal', 'facts'), c('natal', 'dignities'), c('natal', 'aspects'), c('natal', 'doshas'), c('natal', 'avasthas'), c('natal', 'house_counts')], [
      'Lord in a dusthana; combust, in war or debilitated lord; malefic conjunction or drishti on the house or its lord',
      'Papakartari, nodes on the axis, dosha membership, lord in a dead avastha',
      'Each affliction names its release (its own period, a neecha bhanga pair, a benefic period with D1 and the varga agreeing) or none',
      'Afflictions set the baseline and name the blocker; they never flip a verdict alone',
    ]),
    row('activation', `Activation of ${t.houses} by every dasha system`, 'B.4', [c('dasha', 'vimshottari'), c('dasha', 'conditional'), c('dasha', 'narayana'), c('dasha', 'chara'), c('dasha', 'karaka'), c('annual', 'tithi_pravesha_dasha'), c('dasha', 'yogini'), c('dasha', 'tithi_ashtottari'), ...vargaCharts], [
      'Seven families: main graha clock, conditional clock, rasi clock, karaka clock, annual clock, transit clock, short confirmers (Yogini and Tithi Ashtottari voting only when they agree)',
      'Polarity of each running planet to the house: supports when it lords, occupies, signifies, or lords the 5th, 9th or 11th from it; tests when it lords 6, 8 or 12 or sits 6, 8 or 12 from it',
      `A dasha vote counts only when D1 and the owning varga (${t.vargas[0]}) agree; D9 breaks a tie; D60 only with a birth time to the minute`,
      'One planet, one vote across the graha clocks',
    ]),
    row('transit', `Transits over ${t.houses}`, 'B.5', [c('transit', 'transit_contacts'), c('transit', 'double_transit'), c('transit', 'sade_sati'), c('transit', 'eclipses'), c('ashtakavarga', 'transit_ashtakavarga')], [
      'Slow planets in the house: Jupiter supports, Saturn tests unless 3, 6, 10 or 11 from the Moon with a bindu, Rahu amplifies, Ketu detaches',
      'Slow planets on the lord, karaka or arudha (contacts with stations); double transit on the house',
      'Sade sati and dhaiya phases; eclipses on the axis or the lord, with dates',
      'Transit ashtakavarga bindus in the planet’s own BAV support or test',
    ]),
    row('annual', `This year's chart for ${t.houses}`, 'B.6', [c('annual', 'tithi_pravesha'), c('annual', 'sahams'), c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'tithi_pravesha_dasha')], [
      "The year chart's lord of the house and its place: kendra/trikona with dignity confirms, 6/8/12 contradicts",
      'Occupants, aspects and argala in the year chart at half weight; where the natal lord falls this year',
      "The house's sahams in a kendra of the year chart with a strong lord",
      'The running Mudda, Patyayini or year tithi ashtottari lord gives the month',
      'Returns confirms, amplifies, contradicts or silent; changes confidence by one step and never makes a verdict alone',
    ], 'Muntha, the year lord and Tajaka yogas are engine gaps'),
    row('varga', `Owning divisional chart of ${t.houses}`, 'B.7', vargaCharts, [
      `Owning varga first: ${t.vargas.join(', ')}`,
      "The natal lord of the house in the varga (sign, house, dignity); the varga's own house and lord; vargottama",
      "The running period lord's place in the varga; the arudha of the house in the varga",
      'Returns agrees when its net side matches the activation side; a dasha vote counts only then',
    ]),
    row('nakshatra', `Nakshatra charter of ${t.houses}`, 'B.8', [c('nakshatra', 'cusp_nak'), c('nakshatra', 'star_lord'), c('nakshatra', 'occupant_stars')], [
      "Cusp star of the house: its mission; the lord's star: through whom it delivers; occupants' stars: their flavour",
      'One charter line per star and house from the reviewed charter table (config, with its source)',
      "When the running PD lord's star lord is the house's lord or karaka, the vote is delivered through the star: confidence one step up",
    ]),
  ];
}

const LOVE_PLANNED = houseStateLayers({ prefix: 'love', board: 'love', houses: 'house 7', vargas: ['D9', 'D7', 'D30'], karakas: 'Venus for the 7th' });
const SELF_PLANNED = houseStateLayers({ prefix: 'self', board: 'you', houses: 'houses 1, 4 and 5 with the Moon', vargas: ['D1', 'D9', 'D4', 'D7', 'D24', 'D60'], karakas: 'Sun for the 1st, Moon and Mercury for the 4th, Jupiter for the 5th' });

// ---------------------------------------------------------------- General Reading (chat): graph analysts and oracle readers

/** The frame vargas across all 17 subjects (packs/frames.ts): the primary first per subject. */
const FRAME_VARGAS = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10'].map((v) => c('divisional', v));
const ANALYST_STEPS = (sections: string): string[] => [
  'Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others',
  `It is sent the evidence pack sections ${sections}, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)`,
  'The model returns structured findings whose claims cite evidence ids in the pack',
  'Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it',
];

const GENERAL: TechniqueDef[] = [
  {
    id: 'general.promise',
    title: 'Promise analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), ...FRAME_VARGAS, c('jaimini', 'arudhas'), c('jaimini', 'special_lagnas')],
    algorithm: ANALYST_STEPS('base, frame, detail, varga, arudha'),
    source: 'docs/reading-engine/03 §3',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.promise',
    agents: ['reading.analyst.promise'],
    accuracy: 'staff',
  },
  {
    id: 'general.dasha',
    title: 'Dasha analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), ...FRAME_VARGAS, c('dasha', 'vimshottari'), c('dasha', 'narayana')],
    algorithm: [...ANALYST_STEPS('base, frame, detail, varga, dasha'), "The dasha section holds the Vimshottari periods inside the horizon, each period lord's place in the frame vargas and the running Narayana sign"],
    source: 'docs/reading-engine/03 §3',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.dasha',
    agents: ['reading.analyst.dasha'],
    accuracy: 'staff',
  },
  {
    id: 'general.transit',
    title: 'Transit analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('jaimini', 'arudhas'), c('dasha', 'vimshottari'), c('dasha', 'narayana'), c('transit', 'transit_overlay'), c('transit', 'transit_contacts'), c('transit', 'transit_at')],
    algorithm: [...ANALYST_STEPS('base, frame, arudha, dasha, transits and transit_at'), "The transits section holds the selected transit rows for the frame's houses and natal points, with the natal-degree contacts clipped to the horizon; transit_at is the sky at an asked date"],
    source: 'docs/reading-engine/03 §3; 28 §5',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.transit',
    agents: ['reading.analyst.transit'],
    accuracy: 'staff',
  },
  {
    id: 'general.nakshatra',
    title: 'Nakshatra analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('nakshatra', 'janma'), c('dasha', 'vimshottari'), c('transit', 'transit_overlay')],
    algorithm: ANALYST_STEPS('base, frame, detail, dasha, transits'),
    source: 'docs/reading-engine/03 §3',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.nakshatra',
    agents: ['reading.analyst.nakshatra'],
    accuracy: 'staff',
  },
  {
    id: 'general.annual',
    title: 'Annual chart analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('annual', 'tithi_pravesha'), c('annual', 'tithi_pravesha_dasha')],
    algorithm: [...ANALYST_STEPS('base, frame, annual'), 'Runs only when the graph has the Tithi Pravesha year chart and its dasha for the question'],
    source: 'docs/reading-engine/28 §5',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.annual',
    agents: ['reading.analyst.annual'],
    accuracy: 'staff',
  },
  {
    id: 'general.prashna',
    title: 'Question chart analyst',
    category: 'general',
    board: 'chat',
    status: 'built',
    charts: [c('natal', 'facts'), c('natal', 'prashna')],
    algorithm: [...ANALYST_STEPS('base, frame, prashna'), 'Runs only when the graph has the chart of the question moment'],
    source: 'docs/reading-engine/28 §5',
    code: 'src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.prashna',
    agents: ['reading.analyst.prashna'],
    accuracy: 'staff',
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
    source: 'docs/reading-engine/33 §2; 39 §4.1',
    code: 'src/reading/oracle/readers.ts READERS; runReader.ts',
    agents: ['reading.reader'],
    accuracy: 'staff',
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
    ],
    source: 'docs/reading-engine/39 §4.1; 41',
    code: 'src/reading/oracle/flow.ts; src/reading/run.ts (synthesize)',
    agents: ['reading.oracle', 'reading.synth'],
    accuracy: 'staff',
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
    ],
    source: 'docs/reading-engine/13; 48',
    code: 'src/reading/clarify/planner.ts; service.ts',
    agents: ['reading.clarify'],
    accuracy: 'staff',
  },
];

export const TECHNIQUES: TechniqueDef[] = [...WORK_BUILT, ...WORK_PLANNED, ...LUCKY_SCENARIO_ROWS, ...LUCKY_SHARED, ...LOVE_PLANNED, ...SELF_PLANNED, ...GENERAL];

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
  };
}

let seedWarned = false;

/** Upserts every technique into `technique_registry`. Idempotent; called at boot. Logs once and never throws. */
export async function seedTechniqueRegistry(prisma: Pick<PrismaClient, 'techniqueRegistry'>): Promise<number> {
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
