/**
 * Research Staging Work & Career Dashboard Deep-Dive Builder (`research.work_dashboard_qa`),
 * November/Thanksgiving/December/New Year Execution Zoom-In, and
 * Independent Technical Verifier Wrapper (docs/admin/09, Priority 2 P1).
 *
 * Synthesizes 10H/6H/11H/2H/1H/9H with D1, D9, D10 (Dasamsa), D2 (Hora), and D24 (Siddhamsa),
 * AmK/AK/Sun/Saturn/Mercury/Jupiter karakas, 3-tier career shade receipts, 12-house x 10-varga matrix,
 * and 8-gate technical verifier.
 */
import { buildBoard, type AreaConfig } from '../area/houseLayers.js';
import { buildCalmPlaybook, resolveAreaShades } from '../area/shadeResolver.js';
import { synthesizeResearchDigestAndActivations } from './presets.js';
import {
  buildCharterVocationAnalysis,
  buildHouseVargaDeepDive,
  buildTemporalZoomIn,
} from './selfDashboardQa.js';
import type {
  HolidayMilestoneWindow,
  ResearchDashboardRunDetail,
  ResearchPresetSubject,
  SelfBoardSnapshot,
  SelfOracleReadingProse,
  TechnicalVerifierReport,
  TemporalZoomInData,
} from './types.js';
import { buildTenStepTechnicalTrace, verifySelfDashboardRun } from './verifier.js';

export const WORK_RESEARCH_CONFIG: AreaConfig = {
  area: 'career',
  houses: [10, 6, 11, 2, 1, 9, 3],
  primary: [10, 6, 11, 2],
  karakas: ['L10', 'Su', 'Sa', 'Me', 'Ju', 'AmK'],
  protectPoints: ['AL'],
  vargaChecks: [
    { varga: 'D10', house: 10 },
    { varga: 'D9', house: 10 },
  ],
  vargas: ['D1', 'D10', 'D9', 'D2', 'D24'],
  heavy: ['Sa', 'Ra', 'Ke', 'Ma'],
  yogaAfflictions: [/kemadruma/i, /daridra/i],
  gandantaMoon: false,
  sadeSati: true,
  sahams: {
    support: ['karma', 'samartha', 'yasas', 'vyapara', 'artha'],
    test: ['kali'],
  },
  subareas: [
    { id: 'promotion', title: 'Step up & scope', planets: ['L10', 'Su', 'Ju', 'Ma', 'L11'], houses: [10, 1, 11], sides: ['support'] },
    { id: 'get_job', title: 'New role openings', planets: ['L10', 'L6', 'L11', 'Ju', 'Me'], houses: [10, 6, 11], sides: ['support'] },
    { id: 'job_change', title: 'Role or track pivot', planets: ['L3', 'Me', 'L10', 'Ra', 'L9'], houses: [3, 9, 10, 12], sides: ['support'] },
    { id: 'job_security', title: 'Workload & stability', planets: ['Sa', 'Ma', 'L6', 'Ra', 'Ke', 'L8'], houses: [6, 8, 10, 12], sides: ['test'] },
    { id: 'pay', title: 'Compensation & gains', planets: ['L2', 'L11', 'Ju', 'Ve'], houses: [2, 11], sides: ['support'] },
    { id: 'business', title: 'Independent & client work', planets: ['L7', 'Me', 'L11', 'Su'], houses: [7, 10, 11], sides: ['support'] },
    { id: 'abroad', title: 'Travel or remote scope', planets: ['Ra', 'L12', 'L9', 'Mo'], houses: [9, 12], sides: ['support'] },
  ],
  words: {
    themes: {
      h10: 'your career standing and visible work',
      h6: 'your daily craft and problem-solving',
      h11: 'your professional gains and network',
      h2: 'your earnings and fee power',
      h1: 'your leadership presence',
      h9: 'your mentors and long-term direction',
      h3: 'your hands-on initiative',
      Su: 'your authority',
      Sa: 'your persistence and discipline',
      Me: 'your analytical skill',
      Ju: 'trusted counsel and growth',
      L10: 'your main line of work',
      AmK: 'your professional counsel',
      AL: 'how your work is seen',
    },
    back: {
      test: 'a demanding stretch at work began',
      support: 'a strong stretch for your work began',
    },
    year: {
      support: "This year's chart backs your work: step forward on key deliverables and scope.",
      test: "This year's chart asks for steady pacing at work: keep priorities tight and well-documented.",
      mixed: "This year's chart is balanced for work: consistent weekly execution compounds.",
    },
    turn: {
      support: 'A new chapter for your career opens',
      test: 'A new chapter that asks for structured discipline at work',
    },
    ahead: {
      support: {
        strong: 'A clear window to advance your work',
        moderate: 'A productive stretch for deliverables',
        weak: 'A steady step forward at work',
      },
      test: {
        strong: 'A heavy workload stretch: keep priorities tight',
        moderate: 'A busy stretch at work: pace your commitments',
        weak: 'Extra attention needed on routine details',
      },
    },
  },
};

function tailorWorkTemporalZoomIn(base: TemporalZoomInData, subject: ResearchPresetSubject): TemporalZoomInData {
  const ds = subject.dashaSeed;
  const holidayMilestones: HolidayMilestoneWindow[] = base.holidayMilestones.map((m) => {
    if (m.id === 'november_lead') {
      return {
        ...m,
        emotionalMentalTone: 'High-leverage execution window to ship core deliverables before holiday slowdowns.',
        practicalGuidance: 'Close open technical, client, or operational loops before Nov 21 and put Q4 agreements in writing.',
        doStep: 'Front-load deep analytical and strategic work into uninterrupted morning blocks.',
        avoidStep: 'Avoid taking on un-scoped side requests right before Thanksgiving week.',
      };
    }
    if (m.id === 'thanksgiving_week') {
      return {
        ...m,
        emotionalMentalTone: 'Strategic step-back from operational pressure to recharge executive judgment.',
        practicalGuidance: 'Keep Nov 23–29 light on meetings; handle only essential maintenance and let your mind reset.',
        doStep: 'Leave clean handoff notes before stepping offline for Thanksgiving.',
        avoidStep: 'Do not force major career negotiations or launches during a holiday week.',
      };
    }
    if (m.id === 'december_core') {
      return {
        ...m,
        emotionalMentalTone: 'Decisive year-end consolidation, performance documentation, and Q1 budget/scope alignment.',
        practicalGuidance: 'Use Dec 1–18 to finalize 2026 deliverables, document wins, and align with decision-makers.',
        doStep: 'Summarize your 2026 impact clearly and confirm Q1 priorities with key stakeholders.',
        avoidStep: 'Avoid launching complex new initiatives in the final ten days of December.',
      };
    }
    return {
      ...m,
      emotionalMentalTone: 'High-clarity strategic runway into January and Q1 2027.',
      practicalGuidance: 'Use Dec 28–Jan 5 to map your first 6 weeks of Q1 execution in plain, measurable milestones.',
      doStep: 'Lock in your top two Q1 career/revenue goals and block calendar time for them.',
      avoidStep: 'Avoid scattering focus across too many parallel tracks in early January.',
    };
  });

  return {
    ...base,
    annualSummary: {
      ...base.annualSummary,
      keySahams: [
        { name: 'Karma Saham', house: 10, meaning: 'Primary career execution, authority, and visible achievement' },
        { name: 'Samartha Saham', house: 1, meaning: 'Executive capability to turn plans into tangible output' },
        { name: 'Artha Saham', house: 2, meaning: 'Resource retention, compensation, and commercial value' },
      ],
      annualVerdict: `Annual Tithi Pravesha ${base.annualSummary.year} activates Karma and Samartha Sahams under Year Lord ${ds.annualLord}, backing disciplined career execution and tangible professional gains.`,
    },
    holidayMilestones,
  };
}

/**
 * Pure deterministic builder for a Research Work Dashboard QA run (`boardArea: 'work'`).
 */
export function buildWorkResearchDashboard(
  subject: ResearchPresetSubject,
  asOf = '2026-11-15',
): Omit<ResearchDashboardRunDetail, 'runId' | 'researchKundliId' | 'durationMs' | 'createdAt'> {
  const { view, activationRows, transitPayload } = synthesizeResearchDigestAndActivations(subject, asOf);
  const running = activationRows.filter((r) => r.from <= asOf && asOf < r.to);
  const built = buildBoard({
    view,
    cfg: WORK_RESEARCH_CONFIG,
    asOf,
    activation: activationRows,
    running,
    transit: transitPayload,
  });
  const shades = resolveAreaShades({
    view,
    cfg: WORK_RESEARCH_CONFIG,
    asOf,
    built,
    activation: activationRows,
    facts: { 'work.status': 'yes' },
  });

  const tone = built.board.tone.tone;
  const charterAnalysis = buildCharterVocationAnalysis(subject, view, tone);
  const boardSnapshot: SelfBoardSnapshot = {
    productionBoard: built.board,
    shades,
    charterAnalysis,
  };

  const houseVargaMatrix = buildHouseVargaDeepDive(subject, view);
  const baseTemporal = buildTemporalZoomIn(subject, view, activationRows, asOf);
  const temporalData = tailorWorkTemporalZoomIn(baseTemporal, subject);

  const isTestingTone = tone === 'demanding' || tone === 'easing';
  const playbook = buildCalmPlaybook({
    area: 'career',
    side: isTestingTone ? 'test' : 'support',
    tone,
    beneficWeight: isTestingTone ? 1.5 : 4.3,
    maleficWeight: isTestingTone ? 2.2 : 1.0,
    easeDate: built.board.tone.date ?? '2026-12-28',
  });

  const verdictPill =
    tone === 'open'
      ? 'Strong Career Momentum & Scope'
      : tone === 'steady'
        ? 'Steady Execution & Authority'
        : tone === 'easing'
          ? 'Workload Pressure Easing'
          : 'Structured Pacing & Focus';

  const readingProse: SelfOracleReadingProse = {
    verdictPill,
    headline: `Work & Vocation (${subject.professionTitle}): ${verdictPill} through November, Thanksgiving, December & New Year`,
    whoYouAreSummary: `In your work as a ${subject.professionTitle.toLowerCase()}, your authority comes from deep competence, structured problem-solving, and reliable follow-through (${charterAnalysis.fitScore}% vocation fit). Decision-makers trust you when the stakes are high.`,
    currentMentalEmotionalWeather: isTestingTone
      ? `Your work slate has been demanding lately, asking for tight prioritization and clear boundaries around your bandwidth. The heaviest operational pressure is bounded and eases into late December.`
      : `Your professional judgment and execution stamina are well supported right now. You are in a strong position to lock in key deliverables and advance your standing.`,
    whyReadingNow: charterAnalysis.whySeekingReadingNow,
    novemberThroughNewYearNarrative: `Early–mid November is an execution window to close out key deliverables before Nov 21 so Thanksgiving week (Nov 23–29) provides a real break from operational noise. December (Dec 1–18) favors finalizing 2026 milestones and aligning on Q1 scope, followed by a high-clarity New Year runway (Dec 28–Jan 5) for your next career step.`,
    charterAndVocationNarrative: `Your chart strongly backs ${subject.professionTitle.toLowerCase()} (${charterAnalysis.fitScore}% charter fit): ${subject.scenarioSummary}`,
    playbook,
    calibrationQuestion: {
      factKey: 'work.goal_shade',
      question: 'Looking at your work over the next few months, which priority fits best?',
      options: [
        { value: 'scope_expansion', label: 'Expanding scope & impact' },
        { value: 'workload_pacing', label: 'Tightening focus & pacing' },
      ],
    },
  };

  const traceData = buildTenStepTechnicalTrace({
    subject,
    view,
    activations: activationRows,
    boardSnapshot,
    houseMatrix: houseVargaMatrix,
    temporal: temporalData,
    prose: readingProse,
  });

  const verifierData = verifyWorkDashboardQaReport({
    subject,
    view,
    activations: activationRows,
    boardSnapshot,
    houseMatrix: houseVargaMatrix,
    temporal: temporalData,
    trace: traceData,
    prose: readingProse,
  });

  const activePd = subject.dashaSeed.pdWindows[1]?.lord ?? subject.dashaSeed.pdWindows[0]!.lord;

  return {
    subjectCode: subject.subjectCode,
    boardArea: 'work',
    groupKind: subject.groupKind,
    label: subject.label,
    ageYears: subject.ageYears,
    professionCode: subject.professionCode,
    professionTitle: subject.professionTitle,
    scenarioCode: subject.scenarioCode,
    scenarioSummary: subject.scenarioSummary,
    birthDate: subject.birthDate,
    birthTime: subject.birthTime,
    placeCode: subject.placeCode,
    placeLabel: subject.placeLabel,
    lagnaSign: subject.lagnaSign,
    moonSign: subject.moonSign,
    moonStar: subject.moonStar,
    sunSign: subject.sunSign,
    akPlanet: subject.akPlanet,
    amkPlanet: subject.amkPlanet,
    asOf,
    tone,
    verdictPill,
    charterSummary: charterAnalysis.charterStatement,
    runningMdAdPd: `${subject.dashaSeed.mdLord} / ${subject.dashaSeed.adLord} / ${activePd}`,
    verifierVerdict: verifierData.verdict,
    accuracyScore: verifierData.accuracyScore,
    boardData: boardSnapshot,
    houseVargaMatrix,
    temporalData,
    traceData,
    readingProse,
    verifierData,
  };
}

export function verifyWorkDashboardQaReport(
  params: Parameters<typeof verifySelfDashboardRun>[0],
): TechnicalVerifierReport {
  return verifySelfDashboardRun(params);
}
