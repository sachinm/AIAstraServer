/**
 * Research Staging Love & Relationships Dashboard Deep-Dive Builder (`research.love_dashboard_qa`),
 * November/Thanksgiving/December/New Year Relationship Zoom-In, and
 * Independent Technical Verifier Wrapper (docs/admin/09, Priority 2 P1).
 *
 * Uses the production LOVE AreaConfig (`src/reading/area/love.ts`: houses 7, 5, 11, 2, 4, 8, 12;
 * karakas L7, Ve, Mo, DK; protectPoints UL; vargas D1, D9, D7), 3-tier shade resolver,
 * 12-house x 10-varga matrix, and 8-gate technical verifier.
 */
import { buildBoard, isGood, type Tone } from '../area/houseLayers.js';
import { LOVE } from '../area/love.js';
import { buildCalmPlaybook, resolveAreaShades } from '../area/shadeResolver.js';
import type { DigestView } from '../digest/types.js';
import { synthesizeResearchDigestAndActivations } from './presets.js';
import { buildHouseVargaDeepDive, buildTemporalZoomIn } from './selfDashboardQa.js';
import type {
  CharterVocationAnalysis,
  HolidayMilestoneWindow,
  ResearchDashboardRunDetail,
  ResearchPresetSubject,
  SelfBoardSnapshot,
  SelfOracleReadingProse,
  TechnicalVerifierReport,
  TemporalZoomInData,
} from './types.js';
import { buildTenStepTechnicalTrace, verifySelfDashboardRun } from './verifier.js';

export function buildLoveCharterAnalysis(
  subject: ResearchPresetSubject,
  view: DigestView,
  tone: Tone,
): CharterVocationAnalysis {
  const h7 = view.house('D1', 7);
  const h5 = view.house('D1', 5);
  const h4 = view.house('D1', 4);
  const h2 = view.house('D1', 2);
  const d9Lord7 = h7?.lord ? view.planet('D9', h7.lord) : null;
  const d9Ve = view.planet('D9', 'Ve');

  const fitBase =
    87 +
    (isGood(h7?.lordDignity) ? 4 : 2) +
    (isGood(d9Lord7?.dignity) ? 4 : 2) +
    (isGood(d9Ve?.dignity) ? 3 : 1);
  const fitScore = Math.min(99, fitBase);

  return {
    archetypeCode: `love_${subject.scenarioCode}`,
    archetypeTitle: `${subject.label} — Covenant & Partnership Architecture`,
    fitScore,
    primaryDrivers: [
      `7H ${h7?.sign ?? 'Libra'} (lord ${h7?.lord ?? 'Ve'} in H${h7?.lordHouse ?? 7}, ${h7?.lordDignity ?? 'friendly'})`,
      `Darakaraka ${subject.dkPlanet} + Venus & D9 Navamsa 7H/Ve alignment`,
      `5H Romance/Affection (${h5?.lord ?? 'Ju'}) + 4H/2H Domestic Harmony (${h4?.lord ?? 'Mo'}/${h2?.lord ?? 'Me'})`,
      `7H SAV = ${subject.savByHouse[7] ?? 29} bindus; 4H SAV = ${subject.savByHouse[4] ?? 29} bindus`,
    ],
    naturalStrengths: [
      `Steady relational loyalty backed by Darakaraka ${subject.dkPlanet} and D9 Navamsa confirmation.`,
      `Warm emotional anchoring at home when communication stays unhurried and direct.`,
      `Protective Jupiter canopy preserving core trust through busy work or family stretches.`,
    ],
    currentFrictionPoints: [
      tone === 'demanding' || tone === 'easing'
        ? 'Spillover from external work obligations or busy weekly schedules can compress unhurried couple/family time.'
        : 'Assuming unspoken expectations are understood without a plain, warm check-in.',
      'Protect calm boundaries around extended family and travel logistics during Thanksgiving and late December.',
    ],
    whySeekingReadingNow: `Running ${subject.dashaSeed.mdLord} Mahadasha and ${subject.dashaSeed.adLord} Antardasha activates the 7H/5H/4H relationship axis across November, Thanksgiving, December, and New Year.`,
    charterStatement: `Relationship & family harmony charter for ${subject.label}: ${subject.scenarioSummary}`,
  };
}

function tailorLoveTemporalZoomIn(base: TemporalZoomInData, subject: ResearchPresetSubject): TemporalZoomInData {
  const ds = subject.dashaSeed;
  const holidayMilestones: HolidayMilestoneWindow[] = base.holidayMilestones.map((m) => {
    if (m.id === 'november_lead') {
      return {
        ...m,
        emotionalMentalTone: 'Clearing schedule clutter and aligning expectations with your partner or close circle before the holidays.',
        practicalGuidance: 'Have one calm, practical conversation before Nov 21 about holiday travel, family boundaries, and shared downtime.',
        doStep: 'Set aside one unhurried evening a week with phones away.',
        avoidStep: 'Avoid letting weekday work fatigue set the tone for weekend conversations.',
      };
    }
    if (m.id === 'thanksgiving_week') {
      return {
        ...m,
        emotionalMentalTone: 'Warm domestic connection, gratitude, and gentle boundaries with extended family.',
        practicalGuidance: 'Protect quiet emotional space between Nov 25 and Nov 29; prioritize warmth over perfection.',
        doStep: 'Back your partner or closest allies visibly in family settings and keep plans simple.',
        avoidStep: 'Do not reopen unresolved relationship or family debates during holiday gatherings.',
      };
    }
    if (m.id === 'december_core') {
      return {
        ...m,
        emotionalMentalTone: 'Shared year-end warmth, affectionate steadiness, and balancing social invitations.',
        practicalGuidance: 'Choose quality gatherings between Dec 1 and Dec 20 and protect quiet evenings at home.',
        doStep: 'Say plainly what you appreciate in the people closest to you.',
        avoidStep: 'Avoid over-committing your weekends to obligatory social events.',
      };
    }
    return {
      ...m,
      emotionalMentalTone: 'Renewed closeness, shared forward plans, and a warm start to the new year.',
      practicalGuidance: 'Use Dec 28–Jan 5 to align on 1–2 shared home, travel, or relationship priorities for Q1.',
      doStep: 'Plan a simple, meaningful shared experience to welcome January.',
      avoidStep: 'Avoid rushing big relationship ultimatums; let shared plans build naturally.',
    };
  });

  return {
    ...base,
    annualSummary: {
      ...base.annualSummary,
      keySahams: [
        { name: 'Vivaha Saham', house: 7, meaning: 'Covenant bond, marriage harmony, and mutual commitment' },
        { name: 'Preethi Saham', house: 5, meaning: 'Affection, warmth, and emotional reciprocity' },
        { name: 'Mitra Saham', house: 11, meaning: 'Supportive friendships and shared social circle' },
      ],
      annualVerdict: `Annual Tithi Pravesha ${base.annualSummary.year} activates Vivaha and Preethi Sahams under Year Lord ${ds.annualLord}, supporting honest connection and steady domestic warmth.`,
    },
    holidayMilestones,
  };
}

/**
 * Pure deterministic builder for a Research Love Dashboard QA run (`boardArea: 'love'`).
 */
export function buildLoveResearchDashboard(
  subject: ResearchPresetSubject,
  asOf = '2026-11-15',
): Omit<ResearchDashboardRunDetail, 'runId' | 'researchKundliId' | 'durationMs' | 'createdAt'> {
  const { view, activationRows, transitPayload } = synthesizeResearchDigestAndActivations(subject, asOf);
  const running = activationRows.filter((r) => r.from <= asOf && asOf < r.to);
  const built = buildBoard({
    view,
    cfg: LOVE,
    asOf,
    activation: activationRows,
    running,
    transit: transitPayload,
  });
  const shades = resolveAreaShades({
    view,
    cfg: LOVE,
    asOf,
    built,
    activation: activationRows,
    facts: { 'love.status': subject.ageYears <= 25 ? 'single' : 'committed' },
  });

  const tone = built.board.tone.tone;
  const charterAnalysis = buildLoveCharterAnalysis(subject, view, tone);
  const boardSnapshot: SelfBoardSnapshot = {
    productionBoard: built.board,
    shades,
    charterAnalysis,
  };

  const houseVargaMatrix = buildHouseVargaDeepDive(subject, view);
  const baseTemporal = buildTemporalZoomIn(subject, view, activationRows, asOf);
  const temporalData = tailorLoveTemporalZoomIn(baseTemporal, subject);

  const isTestingTone = tone === 'demanding' || tone === 'easing';
  const playbook = buildCalmPlaybook({
    area: 'love',
    side: isTestingTone ? 'test' : 'support',
    tone,
    beneficWeight: isTestingTone ? 1.5 : 4.1,
    maleficWeight: isTestingTone ? 2.1 : 1.0,
    easeDate: built.board.tone.date ?? '2026-12-28',
  });

  const verdictPill =
    tone === 'open'
      ? 'Warm Opening & Connection'
      : tone === 'steady'
        ? 'Steady Harmony & Trust'
        : tone === 'easing'
          ? 'Tension Easing Into Warmth'
          : 'Patience & Gentle Boundaries';

  const readingProse: SelfOracleReadingProse = {
    verdictPill,
    headline: `Love & Bonds (${subject.label}): ${verdictPill} through November, Thanksgiving, December & New Year`,
    whoYouAreSummary: `In close relationships, you value sincerity, follow-through, and a calm home base. When you feel emotionally heard, you bring deep loyalty and steady warmth to your partner, family, and close friends.`,
    currentMentalEmotionalWeather: isTestingTone
      ? `Busy schedules or external responsibilities have asked for extra patience in close bonds lately. Giving conversations unhurried room keeps trust strong as the pace softens into late December.`
      : `Your emotional footing in close relationships is warm and receptive right now. Honest conversations land gently and deepen mutual trust.`,
    whyReadingNow: charterAnalysis.whySeekingReadingNow,
    novemberThroughNewYearNarrative: `Early–mid November favors aligning expectations before the holiday rush so Thanksgiving week (Nov 23–29) stays warm and unhurried with family. December (Dec 1–20) opens an affectionate stretch for quality time and supportive friendships, leading into a connected, forward-looking New Year transition (Dec 28–Jan 5).`,
    charterAndVocationNarrative: `Your relational charter (${charterAnalysis.fitScore}% alignment) centers on steady trust, clear communication, and protecting peace at home alongside ${subject.professionTitle.toLowerCase()}.`,
    playbook,
    calibrationQuestion: {
      factKey: 'love.strain_shade',
      question: 'In your close relationships right now, what matters most for the next few weeks?',
      options: [
        { value: 'schedule_space_strain', label: 'Protecting unhurried quality time' },
        { value: 'communication_patience', label: 'Clear, gentle communication' },
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

  const verifierData = verifyLoveDashboardQaReport({
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
    boardArea: 'love',
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

export function verifyLoveDashboardQaReport(
  params: Parameters<typeof verifySelfDashboardRun>[0],
): TechnicalVerifierReport {
  return verifySelfDashboardRun(params);
}
