/**
 * Types for the Research Staging Schema, Self Dashboard Deep-Dive Template,
 * November/Thanksgiving/December/New Year Temporal Zoom-In, 10-Step Technical Trace,
 * and Independent Technical Verifier Agent (docs/admin/09, Migration M38).
 */
import type { AreaBoardBody } from '../area/houseLayers.js';
import type { CalmPlaybook, TechniqueDecisionReceipt } from '../area/shadeResolver.js';

export type ResearchGroupKind = 'age_bracket' | 'persona' | 'custom';

export type ResearchTimingGrade = 'steady_growth' | 'high_focus' | 'mixed_watch' | 'quiet_recovery';

export interface ResearchSeedPlanet {
  planet: string;
  sign: string;
  house: number;
  degree: number;
  star: string;
  pada: number;
  starLord: string;
  dignity: 'exalted' | 'own' | 'moolatrikona' | 'friendly' | 'neutral' | 'debilitated';
  retro?: boolean;
  combust?: boolean;
  war?: boolean;
  shadbalaRatio: number;
  shadbalaRank: number;
  functional: 'benefic' | 'malefic' | 'neutral';
  avasthaState: 'deepta_jagrat' | 'swastha_jagrat' | 'mudita_swapna' | 'shanta_swapna' | 'dina_swapna' | 'khala_sushupta';
  d9Sign: string;
  d9Dignity: 'exalted' | 'own' | 'friendly' | 'neutral' | 'debilitated';
  d10Sign: string;
  d10Dignity: 'exalted' | 'own' | 'friendly' | 'neutral' | 'debilitated';
  d24Sign: string;
  d24Dignity: 'exalted' | 'own' | 'friendly' | 'neutral' | 'debilitated';
}

export interface ResearchSeedDasha {
  mdLord: string;
  mdFrom: string;
  mdTo: string;
  adLord: string;
  adFrom: string;
  adTo: string;
  pdWindows: Array<{
    lord: string;
    from: string;
    to: string;
    sookshmaLords: string[];
  }>;
  yoginiLord: string;
  yoginiPlanet: string;
  tithiAshtottariLord: string;
  narayanaSign: string;
  annualLord: string;
  munthaSign: string;
  munthaHouse: number;
  transitSaturnHouse: number;
  transitJupiterHouse: number;
  transitRahuHouse: number;
  transitKetuHouse: number;
  sadeSatiPhase: 'rising' | 'peak' | 'setting' | null;
}

export interface ResearchPresetSubject {
  subjectCode: string;
  groupKind: ResearchGroupKind;
  label: string;
  ageYears: number;
  professionCode: string;
  professionTitle: string;
  scenarioCode: string;
  scenarioSummary: string;
  birthDate: string;
  birthTime: string;
  placeCode: string;
  placeLabel: string;
  coordN: number;
  coordE: number;
  tzOffset: number;
  lagnaSign: string;
  moonSign: string;
  moonStar: string;
  sunSign: string;
  akPlanet: string;
  amkPlanet: string;
  dkPlanet: string;
  savByHouse: Record<number, number>;
  yogas: Array<{
    id: string;
    name: string;
    planets: string[];
    houses: number[];
    class: string;
  }>;
  planets: ResearchSeedPlanet[];
  dashaSeed: ResearchSeedDasha;
}

export interface VargaCheckCell {
  varga: string;
  purpose: string;
  sign: string;
  lord: string;
  dignity: string;
  alignment: 'strong' | 'steady' | 'mixed' | 'strained';
}

export interface HouseVargaDeepDiveRow {
  house: number;
  domainTitle: string;
  d1Sign: string;
  d1Lord: string;
  lordHouse: number;
  lordSign: string;
  lordDignity: string;
  occupants: Array<{ planet: string; dignity: string; nature: string }>;
  aspects: string[];
  savBindus: number;
  shadbalaRatio: number;
  avasthaState: string;
  cuspNakshatra: string;
  vargaChecks: VargaCheckCell[];
  selfImpact: string;
  loveImpact: string;
  workImpact: string;
  evidence: string[];
}

export interface CharterVocationAnalysis {
  archetypeCode: string;
  archetypeTitle: string;
  fitScore: number;
  primaryDrivers: string[];
  naturalStrengths: string[];
  currentFrictionPoints: string[];
  whySeekingReadingNow: string;
  charterStatement: string;
}

export interface HolidayMilestoneWindow {
  id: 'november_lead' | 'thanksgiving_week' | 'december_core' | 'new_year_transition';
  title: string;
  from: string;
  to: string;
  mdLord: string;
  adLord: string;
  pdLord: string;
  sookshmaLord: string;
  confirmingSystems: string[];
  transitWeather: string;
  grade: ResearchTimingGrade;
  emotionalMentalTone: string;
  practicalGuidance: string;
  doStep: string;
  avoidStep: string;
  evidence: string[];
}

export interface WeeklyZoomWindow {
  weekIndex: number;
  label: string;
  from: string;
  to: string;
  isHolidayHighlight: boolean;
  holidayTag: string | null;
  mdAdPd: string;
  shortClockConfirmers: string[];
  activatedHouses: number[];
  grade: ResearchTimingGrade;
  focusHeadline: string;
  practicalTip: string;
  evidence: string[];
}

export interface DailyZoomEntry {
  date: string;
  dayLabel: string;
  sookshmaLord: string;
  transitMoonStar: string;
  taraBala: string;
  chandraBala: string;
  grade: 'A' | 'B' | 'C';
  mentalEnergy: string;
  actionRule: string;
}

export interface TemporalZoomInData {
  asOf: string;
  annualSummary: {
    year: number;
    kind: 'TP' | 'VP';
    yearLord: string;
    munthaSign: string;
    munthaHouse: number;
    keySahams: Array<{ name: string; house: number; meaning: string }>;
    annualVerdict: string;
  };
  runningClocks: Array<{
    system: string;
    family: string;
    md: string;
    ad: string;
    pd: string;
    sookshma: string;
    houses: number[];
    vote: 'support' | 'test' | 'neutral';
  }>;
  holidayMilestones: HolidayMilestoneWindow[];
  weeklyTimeline: WeeklyZoomWindow[];
  dailyStrip: DailyZoomEntry[];
}

export interface TechnicalTraceStep {
  stepNumber: number;
  stepId: string;
  title: string;
  schoolCitations: string[];
  dataPulled: string[];
  dataExcluded: Array<{ item: string; reason: string }>;
  classicalRulesApplied: string[];
  combinationFormula: string;
  intermediateVerdict: string;
  oracleProseClaim: string;
}

export interface SelfOracleReadingProse {
  verdictPill: string;
  headline: string;
  whoYouAreSummary: string;
  currentMentalEmotionalWeather: string;
  whyReadingNow: string;
  novemberThroughNewYearNarrative: string;
  charterAndVocationNarrative: string;
  playbook: CalmPlaybook;
  calibrationQuestion: {
    factKey: string;
    question: string;
    options: Array<{ value: string; label: string }>;
  };
}

export interface VerifierGateReceipt {
  gateId: string;
  title: string;
  passed: boolean;
  score: number;
  maxScore: number;
  checkedItems: number;
  receipts: string[];
  warnings: string[];
  missedFactors: string[];
}

export interface TechnicalVerifierReport {
  agentId: 'research.technical_verifier';
  techniqueId: 'research.technical_verifier';
  evaluatedAt: string;
  accuracyScore: number;
  passThreshold: number;
  verdict: 'pass' | 'warn' | 'fail';
  gates: VerifierGateReceipt[];
  summaryNote: string;
}

export interface SelfBoardSnapshot {
  productionBoard: AreaBoardBody;
  shades: TechniqueDecisionReceipt[];
  charterAnalysis: CharterVocationAnalysis;
}

export interface ResearchDashboardRunSummary {
  runId: string;
  researchKundliId: string;
  subjectCode: string;
  groupKind: ResearchGroupKind;
  label: string;
  ageYears: number;
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
  asOf: string;
  tone: string;
  verdictPill: string;
  charterSummary: string;
  runningMdAdPd: string;
  verifierVerdict: 'pass' | 'warn' | 'fail';
  accuracyScore: number;
  durationMs: number;
  createdAt: string;
}

export interface ResearchDashboardRunDetail extends ResearchDashboardRunSummary {
  birthDate: string;
  birthTime: string;
  placeCode: string;
  placeLabel: string;
  boardData: SelfBoardSnapshot;
  houseVargaMatrix: HouseVargaDeepDiveRow[];
  temporalData: TemporalZoomInData;
  traceData: TechnicalTraceStep[];
  readingProse: SelfOracleReadingProse;
  verifierData: TechnicalVerifierReport;
}
