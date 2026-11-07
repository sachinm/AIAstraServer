/**
 * Synthetic Research Presets ("Cut It Both Ways": 10 Age Brackets 18–60 + 10 Life/Profession Personas)
 * and Staging Digest / Activation Hydrator (docs/admin/09 §2, §4.1).
 *
 * Uses pre-tagged engine fixture structures so every house card, planet card, varga card, yoga,
 * point, annual chart, star profile, and multi-system activation row matches the exact schema of
 * `kundli_digest` and `kundli_activation` without touching customer `auth` or `kundlis`.
 */
import { getResearchAgeBrackets } from '../../config/env.js';
import type { TransitRangePayload } from '../chartData/transitRange.js';
import type { ActivationRow } from '../digest/activation.js';
import {
  DIGEST_VERSION,
  type AnnualRow,
  type DigestSection,
  type DigestSource,
  type DigestView,
  type HouseCard,
  type PlanetCard,
  type PointRow,
  type StarProfile,
  type YogaRow,
} from '../digest/types.js';
import type {
  ResearchGroupKind,
  ResearchPresetSubject,
  ResearchSeedDasha,
  ResearchSeedPlanet,
} from './types.js';

const VARGAS = ['D1', 'D9', 'D10', 'D20', 'D24', 'D12', 'D2', 'D4', 'D7', 'D60'] as const;

const SIGN_RING: readonly string[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const RULER_BY_SIGN: Record<string, string> = {
  Aries: 'Ma',
  Taurus: 'Ve',
  Gemini: 'Me',
  Cancer: 'Mo',
  Leo: 'Su',
  Virgo: 'Me',
  Libra: 'Ve',
  Scorpio: 'Ma',
  Sagittarius: 'Ju',
  Capricorn: 'Sa',
  Aquarius: 'Sa',
  Pisces: 'Ju',
};

const HOUSE_CLASSES: Record<number, string[]> = {
  1: ['kendra', 'trikona'],
  2: ['maraka'],
  3: ['upachaya'],
  4: ['kendra'],
  5: ['trikona'],
  6: ['dusthana', 'upachaya'],
  7: ['kendra', 'maraka'],
  8: ['dusthana'],
  9: ['trikona'],
  10: ['kendra', 'upachaya'],
  11: ['upachaya'],
  12: ['dusthana'],
};

const CUSP_STARS: Record<number, { name: string; lord: string; pada: number }> = {
  1: { name: 'Ashwini', lord: 'Ke', pada: 1 },
  2: { name: 'Rohini', lord: 'Mo', pada: 2 },
  3: { name: 'Mrigashira', lord: 'Ma', pada: 3 },
  4: { name: 'Pushya', lord: 'Sa', pada: 1 },
  5: { name: 'Magha', lord: 'Ke', pada: 2 },
  6: { name: 'Hasta', lord: 'Mo', pada: 3 },
  7: { name: 'Swati', lord: 'Ra', pada: 4 },
  8: { name: 'Anuradha', lord: 'Sa', pada: 1 },
  9: { name: 'Mula', lord: 'Ke', pada: 2 },
  10: { name: 'Shravana', lord: 'Mo', pada: 1 },
  11: { name: 'Dhanishta', lord: 'Ma', pada: 2 },
  12: { name: 'Revati', lord: 'Me', pada: 4 },
};

const STAR_TARA_LIST: Array<{ star: string; tara: string }> = [
  { star: 'Ashwini', tara: 'janma' },
  { star: 'Bharani', tara: 'sampat' },
  { star: 'Krittika', tara: 'vipat' },
  { star: 'Rohini', tara: 'kshema' },
  { star: 'Mrigashira', tara: 'pratyak' },
  { star: 'Ardra', tara: 'sadhana' },
  { star: 'Punarvasu', tara: 'naidhana' },
  { star: 'Pushya', tara: 'mitra' },
  { star: 'Ashlesha', tara: 'parama_mitra' },
  { star: 'Magha', tara: 'janma' },
  { star: 'Purva Phalguni', tara: 'sampat' },
  { star: 'Uttara Phalguni', tara: 'vipat' },
  { star: 'Hasta', tara: 'kshema' },
  { star: 'Chitra', tara: 'pratyak' },
  { star: 'Swati', tara: 'sadhana' },
  { star: 'Vishakha', tara: 'naidhana' },
  { star: 'Anuradha', tara: 'mitra' },
  { star: 'Jyeshtha', tara: 'parama_mitra' },
  { star: 'Mula', tara: 'janma' },
  { star: 'Purva Ashadha', tara: 'sampat' },
  { star: 'Uttara Ashadha', tara: 'kshema' },
  { star: 'Shravana', tara: 'sadhana' },
  { star: 'Dhanishta', tara: 'mitra' },
  { star: 'Shatabhisha', tara: 'parama_mitra' },
  { star: 'Purva Bhadrapada', tara: 'sampat' },
  { star: 'Uttara Bhadrapada', tara: 'kshema' },
  { star: 'Revati', tara: 'mitra' },
];

interface ScenarioTemplate {
  code: string;
  professionCode: string;
  professionTitle: string;
  scenarioCode: string;
  scenarioSummary: string;
  lagnaSign: string;
  moonSign: string;
  moonStar: string;
  sunSign: string;
  akPlanet: string;
  amkPlanet: string;
  dkPlanet: string;
  placeCode: string;
  placeLabel: string;
  coordN: number;
  coordE: number;
  tzOffset: number;
  savByHouse: Record<number, number>;
  yogas: Array<{ id: string; name: string; planets: string[]; houses: number[]; class: string }>;
  planets: ResearchSeedPlanet[];
  dashaSeed: ResearchSeedDasha;
}

function makePlanets(
  lagnaSign: string,
  overrides: Partial<Record<string, Partial<ResearchSeedPlanet>>>,
): ResearchSeedPlanet[] {
  const lagnaIdx = Math.max(0, SIGN_RING.indexOf(lagnaSign));
  const signAtHouse = (h: number): string => SIGN_RING[(lagnaIdx + h - 1) % SIGN_RING.length] ?? 'Aries';

  const defaults: ResearchSeedPlanet[] = [
    {
      planet: 'Su',
      sign: signAtHouse(10),
      house: 10,
      degree: 14.2,
      star: 'Shravana',
      pada: 2,
      starLord: 'Mo',
      dignity: 'friendly',
      shadbalaRatio: 1.28,
      shadbalaRank: 2,
      functional: 'benefic',
      avasthaState: 'deepta_jagrat',
      d9Sign: signAtHouse(9),
      d9Dignity: 'own',
      d10Sign: signAtHouse(10),
      d10Dignity: 'exalted',
      d24Sign: signAtHouse(5),
      d24Dignity: 'friendly',
    },
    {
      planet: 'Mo',
      sign: signAtHouse(4),
      house: 4,
      degree: 11.8,
      star: 'Rohini',
      pada: 2,
      starLord: 'Mo',
      dignity: 'exalted',
      shadbalaRatio: 1.31,
      shadbalaRank: 1,
      functional: 'benefic',
      avasthaState: 'swastha_jagrat',
      d9Sign: signAtHouse(4),
      d9Dignity: 'own',
      d10Sign: signAtHouse(2),
      d10Dignity: 'friendly',
      d24Sign: signAtHouse(4),
      d24Dignity: 'exalted',
    },
    {
      planet: 'Ma',
      sign: signAtHouse(3),
      house: 3,
      degree: 21.4,
      star: 'Mrigashira',
      pada: 3,
      starLord: 'Ma',
      dignity: 'own',
      shadbalaRatio: 1.18,
      shadbalaRank: 4,
      functional: 'benefic',
      avasthaState: 'mudita_swapna',
      d9Sign: signAtHouse(1),
      d9Dignity: 'own',
      d10Sign: signAtHouse(10),
      d10Dignity: 'exalted',
      d24Sign: signAtHouse(3),
      d24Dignity: 'friendly',
    },
    {
      planet: 'Me',
      sign: signAtHouse(5),
      house: 5,
      degree: 9.6,
      star: 'Ashlesha',
      pada: 1,
      starLord: 'Me',
      dignity: 'exalted',
      shadbalaRatio: 1.24,
      shadbalaRank: 3,
      functional: 'benefic',
      avasthaState: 'deepta_jagrat',
      d9Sign: signAtHouse(5),
      d9Dignity: 'own',
      d10Sign: signAtHouse(11),
      d10Dignity: 'own',
      d24Sign: signAtHouse(5),
      d24Dignity: 'exalted',
    },
    {
      planet: 'Ju',
      sign: signAtHouse(9),
      house: 9,
      degree: 4.5,
      star: 'Pushya',
      pada: 1,
      starLord: 'Sa',
      dignity: 'exalted',
      shadbalaRatio: 1.36,
      shadbalaRank: 1,
      functional: 'benefic',
      avasthaState: 'deepta_jagrat',
      d9Sign: signAtHouse(9),
      d9Dignity: 'exalted',
      d10Sign: signAtHouse(9),
      d10Dignity: 'own',
      d24Sign: signAtHouse(9),
      d24Dignity: 'exalted',
    },
    {
      planet: 'Ve',
      sign: signAtHouse(2),
      house: 2,
      degree: 17.9,
      star: 'Rohini',
      pada: 4,
      starLord: 'Mo',
      dignity: 'own',
      shadbalaRatio: 1.15,
      shadbalaRank: 5,
      functional: 'benefic',
      avasthaState: 'swastha_jagrat',
      d9Sign: signAtHouse(7),
      d9Dignity: 'own',
      d10Sign: signAtHouse(2),
      d10Dignity: 'friendly',
      d24Sign: signAtHouse(5),
      d24Dignity: 'friendly',
    },
    {
      planet: 'Sa',
      sign: signAtHouse(6),
      house: 6,
      degree: 25.1,
      star: 'Anuradha',
      pada: 3,
      starLord: 'Sa',
      dignity: 'own',
      shadbalaRatio: 1.12,
      shadbalaRank: 6,
      functional: 'malefic',
      avasthaState: 'shanta_swapna',
      d9Sign: signAtHouse(11),
      d9Dignity: 'own',
      d10Sign: signAtHouse(6),
      d10Dignity: 'own',
      d24Sign: signAtHouse(6),
      d24Dignity: 'neutral',
    },
    {
      planet: 'Ra',
      sign: signAtHouse(11),
      house: 11,
      degree: 12.3,
      star: 'Swati',
      pada: 2,
      starLord: 'Ra',
      dignity: 'friendly',
      shadbalaRatio: 1.05,
      shadbalaRank: 7,
      functional: 'malefic',
      avasthaState: 'mudita_swapna',
      d9Sign: signAtHouse(11),
      d9Dignity: 'friendly',
      d10Sign: signAtHouse(11),
      d10Dignity: 'own',
      d24Sign: signAtHouse(3),
      d24Dignity: 'friendly',
    },
    {
      planet: 'Ke',
      sign: signAtHouse(5),
      house: 5,
      degree: 12.3,
      star: 'Magha',
      pada: 4,
      starLord: 'Ke',
      dignity: 'friendly',
      shadbalaRatio: 1.02,
      shadbalaRank: 8,
      functional: 'malefic',
      avasthaState: 'shanta_swapna',
      d9Sign: signAtHouse(9),
      d9Dignity: 'own',
      d10Sign: signAtHouse(5),
      d10Dignity: 'friendly',
      d24Sign: signAtHouse(9),
      d24Dignity: 'exalted',
    },
  ];

  return defaults.map((p) => {
    const ov = overrides[p.planet];
    if (!ov) return p;
    const h = ov.house ?? p.house;
    return {
      ...p,
      ...ov,
      house: h,
      sign: ov.sign ?? signAtHouse(h),
    };
  });
}

function makeDashaSeed(
  mdLord: string,
  adLord: string,
  pdLords: [string, string, string, string],
  opts: Partial<ResearchSeedDasha> = {},
): ResearchSeedDasha {
  return {
    mdLord,
    mdFrom: '2021-03-01',
    mdTo: '2037-03-01',
    adLord,
    adFrom: '2026-04-15',
    adTo: '2028-06-15',
    pdWindows: [
      {
        lord: pdLords[0],
        from: '2026-10-15',
        to: '2026-11-22',
        sookshmaLords: [pdLords[0], adLord, mdLord],
      },
      {
        lord: pdLords[1],
        from: '2026-11-22',
        to: '2026-11-30',
        sookshmaLords: [pdLords[1], 'Mo', 'Ju'],
      },
      {
        lord: pdLords[2],
        from: '2026-11-30',
        to: '2026-12-27',
        sookshmaLords: [pdLords[2], 'Me', 'Su'],
      },
      {
        lord: pdLords[3],
        from: '2026-12-27',
        to: '2027-02-10',
        sookshmaLords: [pdLords[3], 'Ju', 'Ve'],
      },
    ],
    yoginiLord: opts.yoginiLord ?? 'Siddha',
    yoginiPlanet: opts.yoginiPlanet ?? 'Ve',
    tithiAshtottariLord: opts.tithiAshtottariLord ?? adLord,
    narayanaSign: opts.narayanaSign ?? 'Sagittarius',
    annualLord: opts.annualLord ?? mdLord,
    munthaSign: opts.munthaSign ?? 'Leo',
    munthaHouse: opts.munthaHouse ?? 9,
    transitSaturnHouse: opts.transitSaturnHouse ?? 11,
    transitJupiterHouse: opts.transitJupiterHouse ?? 9,
    transitRahuHouse: opts.transitRahuHouse ?? 11,
    transitKetuHouse: opts.transitKetuHouse ?? 5,
    sadeSatiPhase: opts.sadeSatiPhase ?? null,
  };
}

const SCENARIO_TEMPLATES: readonly ScenarioTemplate[] = [
  {
    code: 'teacher',
    professionCode: 'teacher',
    professionTitle: 'School / University Teacher & Academic Mentor',
    scenarioCode: 'curriculum_leadership_and_mental_load',
    scenarioSummary: 'Strong Jupiter-Mercury 5H/9H/10H & D24 Siddhamsa charter; balancing autumn teaching load with a year-end curriculum leadership step.',
    lagnaSign: 'Sagittarius',
    moonSign: 'Taurus',
    moonStar: 'Rohini',
    sunSign: 'Virgo',
    akPlanet: 'Ju',
    amkPlanet: 'Me',
    dkPlanet: 'Ve',
    placeCode: 'boston_us',
    placeLabel: 'Boston, MA',
    coordN: 42.36,
    coordE: -71.06,
    tzOffset: -5,
    savByHouse: { 1: 31, 2: 29, 3: 27, 4: 30, 5: 34, 6: 25, 7: 28, 8: 23, 9: 35, 10: 32, 11: 30, 12: 24 },
    yogas: [
      { id: 'hamsa_mahapurusha', name: 'Hamsa Mahapurusha Yoga', planets: ['Ju'], houses: [1, 9], class: 'raja_mahapurusha' },
      { id: 'budhaditya_d1', name: 'Budhaditya Yoga', planets: ['Su', 'Me'], houses: [10, 5], class: 'raja' },
    ],
    planets: makePlanets('Sagittarius', {
      Ju: { house: 1, dignity: 'own', d9Dignity: 'exalted', d24Dignity: 'exalted', shadbalaRatio: 1.42 },
      Me: { house: 10, dignity: 'exalted', d10Dignity: 'exalted', d24Dignity: 'exalted', shadbalaRatio: 1.33 },
      Mo: { house: 6, dignity: 'exalted', d9Dignity: 'own', shadbalaRatio: 1.22 },
      Su: { house: 10, dignity: 'friendly', shadbalaRatio: 1.25 },
    }),
    dashaSeed: makeDashaSeed('Ju', 'Me', ['Me', 'Ve', 'Su', 'Ju'], {
      yoginiPlanet: 'Me',
      tithiAshtottariLord: 'Ju',
      munthaHouse: 10,
      transitJupiterHouse: 5,
      transitSaturnHouse: 3,
    }),
  },
  {
    code: 'business',
    professionCode: 'business_founder',
    professionTitle: 'Business Founder & Commercial Principal',
    scenarioCode: 'q4_revenue_push_and_partner_alignment',
    scenarioSummary: 'Dominant 7H/10H/11H Dhana & Raja yogas with strong Mercury-Sun-Venus in D1/D9/D10; closing year-end contracts while pacing Thanksgiving rest.',
    lagnaSign: 'Leo',
    moonSign: 'Libra',
    moonStar: 'Swati',
    sunSign: 'Aries',
    akPlanet: 'Su',
    amkPlanet: 'Me',
    dkPlanet: 'Sa',
    placeCode: 'new_york_us',
    placeLabel: 'New York, NY',
    coordN: 40.71,
    coordE: -74.01,
    tzOffset: -5,
    savByHouse: { 1: 30, 2: 32, 3: 29, 4: 26, 5: 28, 6: 26, 7: 31, 8: 22, 9: 29, 10: 34, 11: 36, 12: 23 },
    yogas: [
      { id: 'lakshmi_dhana', name: 'Lakshmi Dhana Yoga', planets: ['Me', 'Ve'], houses: [2, 11], class: 'dhana' },
      { id: 'dharma_karmadhipati', name: 'Dharma-Karmadhipati Yoga', planets: ['Ma', 'Ve'], houses: [9, 10], class: 'raja' },
    ],
    planets: makePlanets('Leo', {
      Su: { house: 9, dignity: 'exalted', d9Dignity: 'exalted', d10Dignity: 'exalted', shadbalaRatio: 1.45 },
      Me: { house: 11, dignity: 'own', d10Dignity: 'exalted', shadbalaRatio: 1.34 },
      Ve: { house: 10, dignity: 'own', d10Dignity: 'own', shadbalaRatio: 1.29 },
      Mo: { house: 3, dignity: 'friendly', shadbalaRatio: 1.18 },
    }),
    dashaSeed: makeDashaSeed('Su', 'Ve', ['Me', 'Mo', 'Ma', 'Ju'], {
      yoginiPlanet: 'Ve',
      tithiAshtottariLord: 'Su',
      munthaHouse: 11,
      transitJupiterHouse: 11,
      transitSaturnHouse: 7,
    }),
  },
  {
    code: 'real_estate',
    professionCode: 'real_estate',
    professionTitle: 'Real Estate & Property Development Principal',
    scenarioCode: 'asset_closing_and_home_grounding',
    scenarioSummary: 'Bhumi Karaka Mars + Saturn 4H/10H & D4 Chaturthamsa strength; managing Q4 property closings and family hosting over the holidays.',
    lagnaSign: 'Cancer',
    moonSign: 'Cancer',
    moonStar: 'Pushya',
    sunSign: 'Capricorn',
    akPlanet: 'Ma',
    amkPlanet: 'Sa',
    dkPlanet: 'Me',
    placeCode: 'chicago_us',
    placeLabel: 'Chicago, IL',
    coordN: 41.88,
    coordE: -87.63,
    tzOffset: -6,
    savByHouse: { 1: 29, 2: 28, 3: 27, 4: 35, 5: 27, 6: 25, 7: 28, 8: 24, 9: 28, 10: 33, 11: 31, 12: 22 },
    yogas: [
      { id: 'ruchaka_mahapurusha', name: 'Ruchaka Mahapurusha Yoga', planets: ['Ma'], houses: [4, 10], class: 'raja_mahapurusha' },
      { id: 'gaja_kesari', name: 'Gaja Kesari Yoga', planets: ['Mo', 'Ju'], houses: [1, 4], class: 'dhana' },
    ],
    planets: makePlanets('Cancer', {
      Ma: { house: 10, dignity: 'own', d9Dignity: 'exalted', d10Dignity: 'exalted', shadbalaRatio: 1.44 },
      Mo: { house: 1, dignity: 'own', d9Dignity: 'own', shadbalaRatio: 1.35 },
      Sa: { house: 7, dignity: 'own', d10Dignity: 'own', shadbalaRatio: 1.26 },
      Ju: { house: 4, dignity: 'friendly', shadbalaRatio: 1.29 },
    }),
    dashaSeed: makeDashaSeed('Ma', 'Sa', ['Sa', 'Mo', 'Me', 'Ve'], {
      yoginiPlanet: 'Ma',
      tithiAshtottariLord: 'Sa',
      munthaHouse: 4,
      transitJupiterHouse: 10,
      transitSaturnHouse: 8,
    }),
  },
  {
    code: 'electrician',
    professionCode: 'skilled_trade_electrician',
    professionTitle: 'Master Electrician & Technical Field Contractor',
    scenarioCode: 'hands_on_precision_and_physical_stamina',
    scenarioSummary: 'Precision 3H/6H/10H Mars-Saturn-Ketu technical axis with strong D10 Dasamsa; high year-end field demand requiring physical pacing.',
    lagnaSign: 'Capricorn',
    moonSign: 'Virgo',
    moonStar: 'Hasta',
    sunSign: 'Scorpio',
    akPlanet: 'Sa',
    amkPlanet: 'Ma',
    dkPlanet: 'Mo',
    placeCode: 'houston_us',
    placeLabel: 'Houston, TX',
    coordN: 29.76,
    coordE: -95.37,
    tzOffset: -6,
    savByHouse: { 1: 28, 2: 27, 3: 34, 4: 26, 5: 27, 6: 33, 7: 26, 8: 24, 9: 28, 10: 35, 11: 32, 12: 21 },
    yogas: [
      { id: 'shasha_mahapurusha', name: 'Shasha Mahapurusha Yoga', planets: ['Sa'], houses: [1, 10], class: 'raja_mahapurusha' },
      { id: 'parakrama_siddhi', name: 'Parakrama Siddhi Yoga', planets: ['Ma', 'Ke'], houses: [3, 6], class: 'raja' },
    ],
    planets: makePlanets('Capricorn', {
      Sa: { house: 1, dignity: 'own', d9Dignity: 'exalted', d10Dignity: 'exalted', shadbalaRatio: 1.38 },
      Ma: { house: 3, dignity: 'exalted', d10Dignity: 'own', shadbalaRatio: 1.36 },
      Ke: { house: 6, dignity: 'friendly', d10Dignity: 'exalted', shadbalaRatio: 1.16 },
      Mo: { house: 9, dignity: 'friendly', shadbalaRatio: 1.20 },
    }),
    dashaSeed: makeDashaSeed('Sa', 'Ma', ['Ma', 'Ke', 'Ve', 'Su'], {
      yoginiPlanet: 'Sa',
      tithiAshtottariLord: 'Ma',
      munthaHouse: 6,
      transitJupiterHouse: 3,
      transitSaturnHouse: 2,
    }),
  },
  {
    code: 'finance',
    professionCode: 'finance_quant',
    professionTitle: 'Finance & Quantitative Investment Analyst',
    scenarioCode: 'portfolio_discipline_and_year_end_bonus_window',
    scenarioSummary: 'High-bindu 2H/5H/11H (SAV 33–36) with exalted Mercury-Jupiter in D1/D2/D9; navigating November volatility into a strong December-January window.',
    lagnaSign: 'Taurus',
    moonSign: 'Gemini',
    moonStar: 'Punarvasu',
    sunSign: 'Aquarius',
    akPlanet: 'Me',
    amkPlanet: 'Ju',
    dkPlanet: 'Ma',
    placeCode: 'london_uk',
    placeLabel: 'London, UK',
    coordN: 51.51,
    coordE: -0.13,
    tzOffset: 0,
    savByHouse: { 1: 30, 2: 35, 3: 26, 4: 28, 5: 34, 6: 25, 7: 27, 8: 23, 9: 31, 10: 32, 11: 36, 12: 22 },
    yogas: [
      { id: 'bhadra_mahapurusha', name: 'Bhadra Mahapurusha Yoga', planets: ['Me'], houses: [2, 5], class: 'raja_mahapurusha' },
      { id: 'mahalakshmi_dhana', name: 'Mahalakshmi Dhana Yoga', planets: ['Ju', 'Ve', 'Me'], houses: [2, 5, 11], class: 'dhana' },
    ],
    planets: makePlanets('Taurus', {
      Me: { house: 5, dignity: 'exalted', d9Dignity: 'exalted', d10Dignity: 'own', d24Dignity: 'exalted', shadbalaRatio: 1.46 },
      Ju: { house: 11, dignity: 'own', d9Dignity: 'own', d10Dignity: 'exalted', shadbalaRatio: 1.39 },
      Ve: { house: 1, dignity: 'own', d9Dignity: 'exalted', shadbalaRatio: 1.32 },
      Mo: { house: 2, dignity: 'friendly', shadbalaRatio: 1.24 },
    }),
    dashaSeed: makeDashaSeed('Me', 'Ju', ['Me', 'Ve', 'Ju', 'Su'], {
      yoginiPlanet: 'Me',
      tithiAshtottariLord: 'Ju',
      munthaHouse: 2,
      transitJupiterHouse: 2,
      transitSaturnHouse: 11,
    }),
  },
  {
    code: 'software_engineer',
    professionCode: 'software_engineer',
    professionTitle: 'Principal Software & AI Systems Architect',
    scenarioCode: 'deep_architecture_ship_and_cognitive_rest',
    scenarioSummary: 'Mercury-Rahu-Mars 3H/5H/10H/11H systems-engineering signature in D1/D10/D24; shipping a major November release before a restorative holiday reset.',
    lagnaSign: 'Gemini',
    moonSign: 'Aquarius',
    moonStar: 'Shatabhisha',
    sunSign: 'Libra',
    akPlanet: 'Me',
    amkPlanet: 'Ra',
    dkPlanet: 'Ju',
    placeCode: 'san_francisco_us',
    placeLabel: 'San Francisco, CA',
    coordN: 37.77,
    coordE: -122.42,
    tzOffset: -8,
    savByHouse: { 1: 31, 2: 28, 3: 33, 4: 26, 5: 34, 6: 27, 7: 27, 8: 24, 9: 30, 10: 35, 11: 34, 12: 22 },
    yogas: [
      { id: 'bhadra_d1_gemini', name: 'Bhadra Mahapurusha Yoga', planets: ['Me'], houses: [1, 4], class: 'raja_mahapurusha' },
      { id: 'viparita_harsha', name: 'Viparita Raja Yoga', planets: ['Ma', 'Ra'], houses: [3, 11], class: 'raja' },
    ],
    planets: makePlanets('Gemini', {
      Me: { house: 1, dignity: 'own', d9Dignity: 'exalted', d10Dignity: 'exalted', d24Dignity: 'exalted', shadbalaRatio: 1.41 },
      Ra: { house: 11, dignity: 'exalted', d10Dignity: 'exalted', d24Dignity: 'own', shadbalaRatio: 1.25 },
      Ma: { house: 3, dignity: 'friendly', d10Dignity: 'own', shadbalaRatio: 1.27 },
      Mo: { house: 9, dignity: 'friendly', shadbalaRatio: 1.19 },
    }),
    dashaSeed: makeDashaSeed('Me', 'Ra', ['Ra', 'Ju', 'Me', 'Ve'], {
      yoginiPlanet: 'Me',
      tithiAshtottariLord: 'Ra',
      munthaHouse: 10,
      transitJupiterHouse: 1,
      transitSaturnHouse: 10,
    }),
  },
  {
    code: 'college_student',
    professionCode: 'college_student',
    professionTitle: 'University Student (Finals & Early Career Direction)',
    scenarioCode: 'exam_focus_and_major_specialization_choice',
    scenarioSummary: 'Active 1H/4H/5H/9H & D24 Siddhamsa learning charter; managing November exam pressure, Thanksgiving family reset, and December finals clarity.',
    lagnaSign: 'Virgo',
    moonSign: 'Pisces',
    moonStar: 'Revati',
    sunSign: 'Gemini',
    akPlanet: 'Me',
    amkPlanet: 'Ju',
    dkPlanet: 'Ve',
    placeCode: 'austin_us',
    placeLabel: 'Austin, TX',
    coordN: 30.27,
    coordE: -97.74,
    tzOffset: -6,
    savByHouse: { 1: 30, 2: 27, 3: 28, 4: 29, 5: 33, 6: 24, 7: 27, 8: 22, 9: 34, 10: 30, 11: 29, 12: 24 },
    yogas: [
      { id: 'saraswati_vidya', name: 'Saraswati Vidya Yoga', planets: ['Me', 'Ju', 'Ve'], houses: [1, 4, 5, 9], class: 'raja' },
    ],
    planets: makePlanets('Virgo', {
      Me: { house: 1, dignity: 'exalted', d9Dignity: 'own', d24Dignity: 'exalted', shadbalaRatio: 1.37 },
      Ju: { house: 4, dignity: 'own', d9Dignity: 'exalted', d24Dignity: 'exalted', shadbalaRatio: 1.33 },
      Mo: { house: 7, dignity: 'friendly', d24Dignity: 'own', shadbalaRatio: 1.17 },
      Sa: { house: 5, dignity: 'own', shadbalaRatio: 1.14 },
    }),
    dashaSeed: makeDashaSeed('Me', 'Mo', ['Sa', 'Mo', 'Me', 'Ju'], {
      yoginiPlanet: 'Mo',
      tithiAshtottariLord: 'Me',
      munthaHouse: 5,
      transitJupiterHouse: 9,
      transitSaturnHouse: 7,
    }),
  },
  {
    code: 'new_parent',
    professionCode: 'expectant_new_parent',
    professionTitle: 'Expectant / New Parent (Young Family & Home Transition)',
    scenarioCode: 'nurture_sleep_pacing_and_family_support',
    scenarioSummary: 'Activated 2H/4H/5H + D7 Saptamsa with Jupiter-Moon-Venus; joyful family expansion paired with sleep protection and Thanksgiving/December household boundaries.',
    lagnaSign: 'Pisces',
    moonSign: 'Cancer',
    moonStar: 'Pushya',
    sunSign: 'Taurus',
    akPlanet: 'Ju',
    amkPlanet: 'Mo',
    dkPlanet: 'Me',
    placeCode: 'seattle_us',
    placeLabel: 'Seattle, WA',
    coordN: 47.61,
    coordE: -122.33,
    tzOffset: -8,
    savByHouse: { 1: 31, 2: 33, 3: 26, 4: 34, 5: 35, 6: 24, 7: 30, 8: 23, 9: 32, 10: 28, 11: 30, 12: 25 },
    yogas: [
      { id: 'santana_lakshmi', name: 'Santana Gopala Yoga', planets: ['Ju', 'Mo', 'Ve'], houses: [2, 4, 5], class: 'dhana' },
      { id: 'gaja_kesari_parent', name: 'Gaja Kesari Yoga', planets: ['Ju', 'Mo'], houses: [1, 5], class: 'raja' },
    ],
    planets: makePlanets('Pisces', {
      Ju: { house: 1, dignity: 'own', d9Dignity: 'exalted', shadbalaRatio: 1.41 },
      Mo: { house: 5, dignity: 'own', d9Dignity: 'exalted', shadbalaRatio: 1.38 },
      Ve: { house: 4, dignity: 'exalted', d9Dignity: 'own', shadbalaRatio: 1.30 },
    }),
    dashaSeed: makeDashaSeed('Ju', 'Mo', ['Mo', 'Ve', 'Ju', 'Me'], {
      yoginiPlanet: 'Mo',
      tithiAshtottariLord: 'Ju',
      munthaHouse: 5,
      transitJupiterHouse: 4,
      transitSaturnHouse: 1,
    }),
  },
  {
    code: 'divorce_recovery',
    professionCode: 'relationship_transition',
    professionTitle: 'Professional Navigating Divorce & Emotional Rebuild',
    scenarioCode: 'emotional_stabilization_and_self_sovereignty',
    scenarioSummary: '7H/8H/4H Saturn-Rahu test in D1/D9 balanced by Jupiter aspecting 1H & Neecha Bhanga protection; sheltering emotional energy through the holidays before a January lift.',
    lagnaSign: 'Libra',
    moonSign: 'Scorpio',
    moonStar: 'Anuradha',
    sunSign: 'Cancer',
    akPlanet: 'Ve',
    amkPlanet: 'Sa',
    dkPlanet: 'Ma',
    placeCode: 'denver_us',
    placeLabel: 'Denver, CO',
    coordN: 39.74,
    coordE: -104.99,
    tzOffset: -7,
    savByHouse: { 1: 31, 2: 27, 3: 29, 4: 21, 5: 28, 6: 26, 7: 20, 8: 21, 9: 32, 10: 31, 11: 30, 12: 22 },
    yogas: [
      { id: 'neecha_bhanga_moon', name: 'Neecha Bhanga Raja Yoga', planets: ['Mo', 'Ma'], houses: [1, 2, 7], class: 'bhanga_cancellation' },
      { id: 'guru_mangala', name: 'Guru-Mangala Protection Yoga', planets: ['Ju', 'Ma'], houses: [1, 9], class: 'raja' },
    ],
    planets: makePlanets('Libra', {
      Ve: { house: 1, dignity: 'own', d9Dignity: 'own', shadbalaRatio: 1.29 },
      Mo: { house: 2, dignity: 'debilitated', d9Dignity: 'friendly', shadbalaRatio: 1.04, avasthaState: 'dina_swapna' },
      Sa: { house: 4, dignity: 'own', d9Dignity: 'friendly', shadbalaRatio: 1.22 },
      Ra: { house: 7, dignity: 'neutral', d9Dignity: 'neutral', shadbalaRatio: 1.01 },
      Ju: { house: 9, dignity: 'friendly', d9Dignity: 'exalted', shadbalaRatio: 1.34 },
      Ma: { house: 4, dignity: 'exalted', d9Dignity: 'own', shadbalaRatio: 1.28 },
    }),
    dashaSeed: makeDashaSeed('Sa', 'Ra', ['Ra', 'Sa', 'Ju', 'Me'], {
      yoginiPlanet: 'Sa',
      tithiAshtottariLord: 'Ra',
      munthaHouse: 8,
      transitJupiterHouse: 9,
      transitSaturnHouse: 4,
      sadeSatiPhase: 'setting',
    }),
  },
  {
    code: 'unemployed_health',
    professionCode: 'career_and_health_recovery',
    professionTitle: 'Professional Between Roles & Rebuilding Vitality',
    scenarioCode: 'vitality_restoration_and_january_reentry',
    scenarioSummary: '6H/8H/12H Saturn-Mars dusthana pressure lifting at year-end with strong 1H/9H/10H Jupiter-Sun protection; November-December is for structured health & interview prep ahead of a New Year opening.',
    lagnaSign: 'Aries',
    moonSign: 'Capricorn',
    moonStar: 'Shravana',
    sunSign: 'Leo',
    akPlanet: 'Su',
    amkPlanet: 'Ju',
    dkPlanet: 'Ve',
    placeCode: 'atlanta_us',
    placeLabel: 'Atlanta, GA',
    coordN: 33.75,
    coordE: -84.39,
    tzOffset: -5,
    savByHouse: { 1: 30, 2: 26, 3: 29, 4: 27, 5: 31, 6: 21, 7: 27, 8: 20, 9: 33, 10: 32, 11: 31, 12: 21 },
    yogas: [
      { id: 'viparita_sarala', name: 'Sarala Viparita Raja Yoga', planets: ['Ma', 'Sa'], houses: [6, 8, 10], class: 'raja' },
      { id: 'neecha_bhanga_saturn', name: 'Neecha Bhanga Raja Yoga', planets: ['Sa', 'Ma'], houses: [1, 10], class: 'bhanga_cancellation' },
    ],
    planets: makePlanets('Aries', {
      Ma: { house: 1, dignity: 'own', d9Dignity: 'exalted', d10Dignity: 'exalted', shadbalaRatio: 1.32 },
      Su: { house: 5, dignity: 'own', d9Dignity: 'exalted', d10Dignity: 'own', shadbalaRatio: 1.37 },
      Ju: { house: 9, dignity: 'own', d9Dignity: 'exalted', d10Dignity: 'exalted', shadbalaRatio: 1.40 },
      Sa: { house: 6, dignity: 'neutral', d9Dignity: 'friendly', d10Dignity: 'own', shadbalaRatio: 1.08, avasthaState: 'shanta_swapna' },
      Mo: { house: 10, dignity: 'friendly', d9Dignity: 'own', shadbalaRatio: 1.16 },
    }),
    dashaSeed: makeDashaSeed('Ju', 'Sa', ['Sa', 'Ke', 'Ve', 'Su'], {
      yoginiPlanet: 'Sa',
      tithiAshtottariLord: 'Sa',
      munthaHouse: 6,
      transitJupiterHouse: 9,
      transitSaturnHouse: 12,
    }),
  },
];

function buildBirthDateForAge(ageYears: number, index: number, refYear = 2026): { birthDate: string; birthTime: string } {
  const year = refYear - ageYears;
  const month = ((index * 2) % 9) + 1;
  const day = ((index * 5) % 24) + 3;
  const hour = 6 + ((index * 3) % 14);
  const minute = (index * 15) % 60;
  return {
    birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    birthTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/**
 * Returns the 20 built-in Research Lab subjects:
 * - 10 Age-Bracket subjects (`age_18` .. `age_56`, driven by `getResearchAgeBrackets()`)
 * - 10 Life-Stage & Profession Persona subjects (`persona_teacher` .. `persona_unemployed_health`)
 */
export function getResearchPresets(): ResearchPresetSubject[] {
  const ages = getResearchAgeBrackets();
  const ageSubjects: ResearchPresetSubject[] = ages.map((ageYears, idx) => {
    const tpl = SCENARIO_TEMPLATES[idx % SCENARIO_TEMPLATES.length]!;
    const { birthDate, birthTime } = buildBirthDateForAge(ageYears, idx);
    return {
      subjectCode: `age_${ageYears}`,
      groupKind: 'age_bracket',
      label: `Age ${ageYears} — ${tpl.professionTitle}`,
      ageYears,
      professionCode: tpl.professionCode,
      professionTitle: tpl.professionTitle,
      scenarioCode: tpl.scenarioCode,
      scenarioSummary: `Age-${ageYears} cohort chart (${birthDate}): ${tpl.scenarioSummary}`,
      birthDate,
      birthTime,
      placeCode: tpl.placeCode,
      placeLabel: tpl.placeLabel,
      coordN: tpl.coordN,
      coordE: tpl.coordE,
      tzOffset: tpl.tzOffset,
      lagnaSign: tpl.lagnaSign,
      moonSign: tpl.moonSign,
      moonStar: tpl.moonStar,
      sunSign: tpl.sunSign,
      akPlanet: tpl.akPlanet,
      amkPlanet: tpl.amkPlanet,
      dkPlanet: tpl.dkPlanet,
      savByHouse: tpl.savByHouse,
      yogas: tpl.yogas,
      planets: tpl.planets,
      dashaSeed: tpl.dashaSeed,
    };
  });

  const personaAges = [34, 42, 46, 38, 29, 31, 21, 33, 39, 44];
  const personaSubjects: ResearchPresetSubject[] = SCENARIO_TEMPLATES.map((tpl, idx) => {
    const ageYears = personaAges[idx] ?? 35;
    const { birthDate, birthTime } = buildBirthDateForAge(ageYears, idx + 3);
    return {
      subjectCode: `persona_${tpl.code}`,
      groupKind: 'persona',
      label: `Persona ${idx + 1}: ${tpl.professionTitle} (Age ${ageYears})`,
      ageYears,
      professionCode: tpl.professionCode,
      professionTitle: tpl.professionTitle,
      scenarioCode: tpl.scenarioCode,
      scenarioSummary: tpl.scenarioSummary,
      birthDate,
      birthTime,
      placeCode: tpl.placeCode,
      placeLabel: tpl.placeLabel,
      coordN: tpl.coordN,
      coordE: tpl.coordE,
      tzOffset: tpl.tzOffset,
      lagnaSign: tpl.lagnaSign,
      moonSign: tpl.moonSign,
      moonStar: tpl.moonStar,
      sunSign: tpl.sunSign,
      akPlanet: tpl.akPlanet,
      amkPlanet: tpl.amkPlanet,
      dkPlanet: tpl.dkPlanet,
      savByHouse: tpl.savByHouse,
      yogas: tpl.yogas,
      planets: tpl.planets,
      dashaSeed: tpl.dashaSeed,
    };
  });

  return [...ageSubjects, ...personaSubjects];
}

export function buildCustomResearchSubject(input: {
  subjectCode?: string;
  label: string;
  ageYears: number;
  birthDate: string;
  birthTime: string;
  placeCode?: string;
  placeLabel?: string;
  professionCode: string;
  scenarioCode?: string;
}): ResearchPresetSubject {
  const tpl =
    SCENARIO_TEMPLATES.find(
      (t) => t.professionCode === input.professionCode || t.code === input.professionCode,
    ) ?? SCENARIO_TEMPLATES[0]!;
  const cleanCode =
    input.subjectCode?.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() ||
    `custom_${input.professionCode}_${input.ageYears}`;
  return {
    subjectCode: cleanCode,
    groupKind: 'custom',
    label: input.label.trim() || `Custom (${input.ageYears}y) — ${tpl.professionTitle}`,
    ageYears: Math.max(18, Math.min(100, Math.round(input.ageYears))),
    professionCode: input.professionCode,
    professionTitle: tpl.professionTitle,
    scenarioCode: input.scenarioCode ?? tpl.scenarioCode,
    scenarioSummary: tpl.scenarioSummary,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    placeCode: input.placeCode ?? tpl.placeCode,
    placeLabel: input.placeLabel ?? tpl.placeLabel,
    coordN: tpl.coordN,
    coordE: tpl.coordE,
    tzOffset: tpl.tzOffset,
    lagnaSign: tpl.lagnaSign,
    moonSign: tpl.moonSign,
    moonStar: tpl.moonStar,
    sunSign: tpl.sunSign,
    akPlanet: tpl.akPlanet,
    amkPlanet: tpl.amkPlanet,
    dkPlanet: tpl.dkPlanet,
    savByHouse: tpl.savByHouse,
    yogas: tpl.yogas,
    planets: tpl.planets,
    dashaSeed: tpl.dashaSeed,
  };
}

/**
 * Synthesizes a complete, rule-consistent `DigestView`, `ActivationRow[]`, `TransitRangePayload`,
 * and staging DB row arrays (`digestRows`, `chartRows`) from a `ResearchPresetSubject`.
 */
export function synthesizeResearchDigestAndActivations(
  subject: ResearchPresetSubject,
  asOf: string,
): {
  view: DigestView;
  activationRows: ActivationRow[];
  transitPayload: TransitRangePayload;
  digestRows: Array<{
    section: DigestSection;
    item_key: string;
    varga: string | null;
    house_num: number | null;
    planet: string | null;
    section_data: object;
    sources: object;
  }>;
  chartRows: Array<{
    chart_type: string;
    variant: string;
    chart_blob: object;
  }>;
} {
  const lagnaIdx = Math.max(0, SIGN_RING.indexOf(subject.lagnaSign));
  const signForHouse = (h: number): string => SIGN_RING[(lagnaIdx + h - 1) % SIGN_RING.length] ?? 'Aries';

  const houseMap = new Map<string, HouseCard>();
  const planetMap = new Map<string, PlanetCard>();
  const digestRows: Array<{
    section: DigestSection;
    item_key: string;
    varga: string | null;
    house_num: number | null;
    planet: string | null;
    section_data: object;
    sources: object;
  }> = [];

  for (const varga of VARGAS) {
    for (const pSeed of subject.planets) {
      const sign =
        varga === 'D9'
          ? pSeed.d9Sign
          : varga === 'D10'
            ? pSeed.d10Sign
            : varga === 'D24'
              ? pSeed.d24Sign
              : pSeed.sign;
      const dignity =
        varga === 'D9'
          ? pSeed.d9Dignity
          : varga === 'D10'
            ? pSeed.d10Dignity
            : varga === 'D24'
              ? pSeed.d24Dignity
              : pSeed.dignity;
      const dispositor = RULER_BY_SIGN[sign] ?? 'Ju';
      const dispSeed = subject.planets.find((x) => x.planet === dispositor);
      const ownedHouses: number[] = [];
      for (let h = 1; h <= 12; h++) {
        if (RULER_BY_SIGN[signForHouse(h)] === pSeed.planet) ownedHouses.push(h);
      }
      const wrapH = (n: number): number => (n > 12 ? n - 12 : n);
      const oppHouse = wrapH(pSeed.house + 6);
      const aspectsTo = [oppHouse];
      if (pSeed.planet === 'Ju') {
        aspectsTo.push(wrapH(pSeed.house + 4), wrapH(pSeed.house + 8));
      } else if (pSeed.planet === 'Ma') {
        aspectsTo.push(wrapH(pSeed.house + 3), wrapH(pSeed.house + 7));
      } else if (pSeed.planet === 'Sa') {
        aspectsTo.push(wrapH(pSeed.house + 2), wrapH(pSeed.house + 9));
      }

      const conj = subject.planets
        .filter((x) => x.planet !== pSeed.planet && x.house === pSeed.house)
        .map((x) => x.planet);

      const card: PlanetCard = {
        varga,
        planet: pSeed.planet,
        sign,
        house: pSeed.house,
        degree: pSeed.degree,
        star: pSeed.star,
        pada: pSeed.pada,
        starLord: pSeed.starLord,
        dignity,
        retro: Boolean(pSeed.retro),
        combust: Boolean(pSeed.combust),
        war: Boolean(pSeed.war),
        dispositor,
        dispositorHouse: dispSeed?.house ?? 1,
        chain: [pSeed.planet, dispositor],
        avasthas: { state: pSeed.avasthaState },
        avasthaMultipliers: {
          baladi: 1.0,
          jagradadi: pSeed.avasthaState.includes('jagrat') ? 1.25 : 1.0,
          effective: pSeed.avasthaState.includes('jagrat') ? 1.25 : 1.0,
          ripeness: 'ripe',
        },
        shadbalaRatio: pSeed.shadbalaRatio,
        shadbalaRank: pSeed.shadbalaRank,
        natural: ['Ju', 'Ve', 'Me', 'Mo'].includes(pSeed.planet) ? 'benefic' : 'malefic',
        functional: pSeed.functional,
        owns: ownedHouses,
        aspectsTo,
        aspectedBy: ['Ju'],
        conjunctions: conj,
      };
      const key = `${varga}.${pSeed.planet}`;
      planetMap.set(key, card);
      digestRows.push({
        section: 'planet',
        item_key: key,
        varga,
        house_num: pSeed.house,
        planet: pSeed.planet,
        section_data: card as unknown as object,
        sources: [{ type: 'divisional', variant: varga, calcVersion: 'v1', path: key }],
      });
    }

    for (let h = 1; h <= 12; h++) {
      const sign = signForHouse(h);
      const lord = RULER_BY_SIGN[sign] ?? 'Ju';
      const lordCard = planetMap.get(`${varga}.${lord}`) ?? planetMap.get(`D1.${lord}`);
      const occ = subject.planets
        .filter((x) => x.house === h)
        .map((x) => ({
          planet: x.planet,
          dignity: varga === 'D9' ? x.d9Dignity : varga === 'D10' ? x.d10Dignity : x.dignity,
          nature: x.functional,
        }));
      const aspectedBy = Array.from(planetMap.values())
        .filter((pc) => pc.varga === varga && pc.aspectsTo.includes(h))
        .map((pc) => pc.planet);

      const hCard: HouseCard = {
        varga,
        house: h,
        sign,
        lord,
        lordHouse: lordCard?.house ?? 1,
        lordSign: lordCard?.sign ?? sign,
        lordDignity: lordCard?.dignity ?? 'friendly',
        coLord: sign === 'Scorpio' ? 'Ke' : sign === 'Aquarius' ? 'Ra' : null,
        occupants: occ,
        aspectedGraha: aspectedBy,
        aspectedRasi: [lord],
        argala: { primary: ['Ju', 'Ve'], secondary: ['Me'], obstructed: [] },
        sav: varga === 'D1' ? (subject.savByHouse[h] ?? 28) : null,
        class: HOUSE_CLASSES[h] ?? [],
        cuspStar: CUSP_STARS[h] ?? { name: 'Ashwini', lord: 'Ke', pada: 1 },
        arudha: h === 1 ? signForHouse(10) : h === 10 ? signForHouse(1) : null,
      };
      const key = `${varga}.h${h}`;
      houseMap.set(key, hCard);
      digestRows.push({
        section: 'house',
        item_key: key,
        varga,
        house_num: h,
        planet: lord,
        section_data: hCard as unknown as object,
        sources: [{ type: 'divisional', variant: varga, calcVersion: 'v1', path: key }],
      });
    }
  }

  const yogaRows: YogaRow[] = subject.yogas.map((y) => ({
    ...y,
    source: 'BPHS / Engine Yoga Register',
  }));
  for (const y of yogaRows) {
    digestRows.push({
      section: 'yoga',
      item_key: `D1.${y.id}`,
      varga: 'D1',
      house_num: y.houses[0] ?? 1,
      planet: y.planets[0] ?? null,
      section_data: y as unknown as object,
      sources: [{ type: 'yogas', variant: 'D1', calcVersion: 'v1', path: y.id }],
    });
  }

  const akCard = planetMap.get(`D1.${subject.akPlanet}`);
  const amkCard = planetMap.get(`D1.${subject.amkPlanet}`);
  const dkCard = planetMap.get(`D1.${subject.dkPlanet}`);
  const pointRows: PointRow[] = [
    { id: 'AK', varga: 'D1', sign: akCard?.sign ?? 'Sagittarius', house: akCard?.house ?? 1, lord: akCard?.dispositor ?? 'Ju', lordHouse: akCard?.dispositorHouse ?? 1 },
    { id: 'AmK', varga: 'D1', sign: amkCard?.sign ?? 'Virgo', house: amkCard?.house ?? 10, lord: amkCard?.dispositor ?? 'Me', lordHouse: amkCard?.dispositorHouse ?? 10 },
    { id: 'DK', varga: 'D1', sign: dkCard?.sign ?? 'Libra', house: dkCard?.house ?? 7, lord: dkCard?.dispositor ?? 'Ve', lordHouse: dkCard?.dispositorHouse ?? 7 },
    { id: 'AL', varga: 'D1', sign: signForHouse(10), house: 10, lord: RULER_BY_SIGN[signForHouse(10)] ?? 'Su', lordHouse: 1 },
    { id: 'UL', varga: 'D1', sign: signForHouse(7), house: 7, lord: RULER_BY_SIGN[signForHouse(7)] ?? 'Ve', lordHouse: 2 },
  ];
  for (const pt of pointRows) {
    digestRows.push({
      section: 'point',
      item_key: `D1.${pt.id}`,
      varga: 'D1',
      house_num: pt.house,
      planet: pt.lord,
      section_data: pt as unknown as object,
      sources: [{ type: 'arudha_karaka', variant: 'D1', calcVersion: 'v1', path: pt.id }],
    });
  }

  const refYear = Number(asOf.slice(0, 4)) || 2026;
  const d1Houses = Array.from({ length: 12 }, (_, i) => houseMap.get(`D1.h${i + 1}`)!).filter(Boolean);
  const annualRow: AnnualRow = {
    kind: 'TP',
    year: refYear,
    varga: 'D1',
    lagna: subject.lagnaSign,
    houses: d1Houses,
    dashas: [
      {
        system: 'tithi_pravesha_dasha',
        periods: [
          { lord: subject.dashaSeed.mdLord, from: `${refYear}-01-01`, to: `${refYear}-11-22` },
          { lord: subject.dashaSeed.adLord, from: `${refYear}-11-22`, to: `${refYear + 1}-03-31` },
        ],
      },
    ],
    sahams: [
      { name: 'punya', sign: signForHouse(1), house: 1 },
      { name: 'samartha', sign: signForHouse(10), house: 10 },
      { name: 'yasas', sign: signForHouse(10), house: 10 },
      { name: 'gaurava', sign: signForHouse(4), house: 4 },
    ],
    muntha: { sign: subject.dashaSeed.munthaSign, house: subject.dashaSeed.munthaHouse },
    yearLord: subject.dashaSeed.annualLord,
    tajakaYogas: [{ id: 'ithasala', present: true }],
  };
  digestRows.push({
    section: 'annual',
    item_key: `TP${refYear}.D1`,
    varga: 'D1',
    house_num: subject.dashaSeed.munthaHouse,
    planet: subject.dashaSeed.annualLord,
    section_data: annualRow as unknown as object,
    sources: [{ type: 'annual', variant: `year=${refYear}`, calcVersion: 'v1', path: 'TP' }],
  });

  const starProfile: StarProfile = {
    moonStar: subject.moonStar,
    moonStarLord: planetMap.get('D1.Mo')?.starLord ?? 'Mo',
    lagnaStar: CUSP_STARS[1]?.name ?? 'Ashwini',
    taras: STAR_TARA_LIST,
    gandanta: [],
    pendingKarmaHouses: [6, 10],
  };
  digestRows.push({
    section: 'star',
    item_key: 'profile',
    varga: 'D1',
    house_num: 1,
    planet: 'Mo',
    section_data: starProfile as unknown as object,
    sources: [{ type: 'nakshatra', variant: 'natal', calcVersion: 'v1', path: 'star_profile' }],
  });

  const housesOfPlanet = (p: string): number[] => {
    const c = planetMap.get(`D1.${p}`);
    if (!c) return [1, 5, 9];
    return Array.from(new Set([...(c.house ? [c.house] : []), ...c.owns, ...c.aspectsTo])).sort((a, b) => a - b);
  };

  const ds = subject.dashaSeed;
  const activationRows: ActivationRow[] = [
    {
      system: 'vimsottari',
      family: 'vimshottari',
      level: 1,
      lord: ds.mdLord,
      sign: null,
      from: ds.mdFrom,
      to: ds.mdTo,
      houses: housesOfPlanet(ds.mdLord),
      parentLord: null,
    },
    {
      system: 'vimsottari',
      family: 'vimshottari',
      level: 2,
      lord: ds.adLord,
      sign: null,
      from: ds.adFrom,
      to: ds.adTo,
      houses: housesOfPlanet(ds.adLord),
      parentLord: ds.mdLord,
    },
    ...ds.pdWindows.map((pd) => ({
      system: 'vimsottari',
      family: 'vimshottari' as const,
      level: 3 as const,
      lord: pd.lord,
      sign: null,
      from: pd.from,
      to: pd.to,
      houses: housesOfPlanet(pd.lord),
      parentLord: ds.adLord,
    })),
    {
      system: 'yogini',
      family: 'yogini',
      level: 2,
      lord: ds.yoginiPlanet,
      sign: null,
      from: '2026-08-01',
      to: '2027-04-01',
      houses: housesOfPlanet(ds.yoginiPlanet),
      parentLord: ds.mdLord,
    },
    {
      system: 'tithi_ashtottari',
      family: 'tithi_ashtottari',
      level: 2,
      lord: ds.tithiAshtottariLord,
      sign: null,
      from: '2026-09-01',
      to: '2027-03-15',
      houses: housesOfPlanet(ds.tithiAshtottariLord),
      parentLord: ds.mdLord,
    },
    {
      system: 'narayana',
      family: 'rasi',
      level: 1,
      lord: RULER_BY_SIGN[ds.narayanaSign] ?? ds.mdLord,
      sign: ds.narayanaSign,
      from: '2025-01-01',
      to: '2028-01-01',
      houses: [1, 5, 9, 10],
      parentLord: null,
    },
    {
      system: 'karaka',
      family: 'karaka',
      level: 1,
      lord: subject.akPlanet,
      sign: null,
      from: '2025-06-01',
      to: '2027-06-01',
      houses: housesOfPlanet(subject.akPlanet),
      parentLord: null,
    },
    {
      system: 'ashtottari',
      family: 'conditional',
      level: 2,
      lord: ds.adLord,
      sign: null,
      from: '2026-05-01',
      to: '2027-05-01',
      houses: housesOfPlanet(ds.adLord),
      parentLord: ds.mdLord,
    },
  ];

  const transitPayload: TransitRangePayload = {
    from: '2026-01-01',
    to: '2027-06-01',
    planets: ['Ju', 'Sa', 'Ra', 'Ke'],
    natal: {
      lagna_sign: subject.lagnaSign,
      lagna_sign_index: Math.max(0, SIGN_RING.indexOf(subject.lagnaSign)),
      moon_sign: subject.moonSign,
      moon_sign_index: Math.max(0, SIGN_RING.indexOf(subject.moonSign)),
    },
    ingresses: [
      {
        planet: 'Ju',
        sign: signForHouse(ds.transitJupiterHouse),
        sign_index: Math.max(0, SIGN_RING.indexOf(signForHouse(ds.transitJupiterHouse))),
        retro_on_entry: false,
        house_from_lagna: ds.transitJupiterHouse,
        house_from_moon: 5,
        from: '2026-06-01',
        to: '2027-06-01',
      },
      {
        planet: 'Sa',
        sign: signForHouse(ds.transitSaturnHouse),
        sign_index: Math.max(0, SIGN_RING.indexOf(signForHouse(ds.transitSaturnHouse))),
        retro_on_entry: false,
        house_from_lagna: ds.transitSaturnHouse,
        house_from_moon: ds.sadeSatiPhase ? 2 : 11,
        from: '2025-03-29',
        to: '2027-06-01',
      },
      {
        planet: 'Ra',
        sign: signForHouse(ds.transitRahuHouse),
        sign_index: Math.max(0, SIGN_RING.indexOf(signForHouse(ds.transitRahuHouse))),
        retro_on_entry: true,
        house_from_lagna: ds.transitRahuHouse,
        house_from_moon: 11,
        from: '2025-05-18',
        to: '2026-12-05',
      },
      {
        planet: 'Ke',
        sign: signForHouse(ds.transitKetuHouse),
        sign_index: Math.max(0, SIGN_RING.indexOf(signForHouse(ds.transitKetuHouse))),
        retro_on_entry: true,
        house_from_lagna: ds.transitKetuHouse,
        house_from_moon: 5,
        from: '2025-05-18',
        to: '2026-12-05',
      },
    ],
    stations: [],
    lunations: [],
    eclipses: [],
    sade_sati: ds.sadeSatiPhase
      ? [
          {
            phase: ds.sadeSatiPhase,
            saturn_sign: signForHouse(ds.transitSaturnHouse),
            from: '2025-03-29',
            to: '2027-06-02',
          },
        ]
      : [],
    dhaiya: [],
  };

  const chartRows = [
    {
      chart_type: 'divisional_suite',
      variant: 'D1_D9_D10_D20_D24_D12_D2_D4_D7_D60',
      chart_blob: { lagnaSign: subject.lagnaSign, moonSign: subject.moonSign, vargas: VARGAS },
    },
    {
      chart_type: 'dasha.vimsottari.l3',
      variant: 'natal',
      chart_blob: ds as unknown as object,
    },
    {
      chart_type: 'annual.tithi_pravesha',
      variant: `year=${refYear}`,
      chart_blob: annualRow as unknown as object,
    },
  ];

  const defaultSource = (section: DigestSection, key: string): DigestSource[] => [
    { type: section, variant: 'staging', calcVersion: DIGEST_VERSION, path: key },
  ];

  const view: DigestView = {
    kundliId: subject.subjectCode,
    status: 'ready',
    version: DIGEST_VERSION,
    builtAt: `${asOf}T00:00:00.000Z`,
    house: (varga: string, h: number) => houseMap.get(`${varga}.h${h}`) ?? null,
    houses: (varga: string) =>
      Array.from({ length: 12 }, (_, i) => houseMap.get(`${varga}.h${i + 1}`)!).filter(Boolean),
    planet: (varga: string, p: string) => planetMap.get(`${varga}.${p}`) ?? null,
    planets: (varga: string) =>
      subject.planets.map((x) => planetMap.get(`${varga}.${x.planet}`)!).filter(Boolean),
    vargas: () => [...VARGAS],
    yogas: () => yogaRows,
    points: (varga?: string) => (varga ? pointRows.filter((pt) => pt.varga === varga) : pointRows),
    annual: (year?: number) => (year && year !== refYear ? [] : [annualRow]),
    star: () => starProfile,
    sourceOf: defaultSource,
  };

  return {
    view,
    activationRows,
    transitPayload,
    digestRows,
    chartRows,
  };
}
