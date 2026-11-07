/**
 * Research Staging Hydrator, Self Dashboard Deep-Dive Builder,
 * November/Thanksgiving/December/New Year Temporal Zoom-In, and
 * Independent Technical Verifier Orchestrator (docs/admin/09, Migration M38).
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { getResearchHorizonWeeks } from '../../config/env.js';
import { buildBoard, isGood, type Tone } from '../area/houseLayers.js';
import { SELF } from '../area/self.js';
import { buildCalmPlaybook, resolveAreaShades } from '../area/shadeResolver.js';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import { addDaysIso } from '../timeline/months.js';
import {
  buildCustomResearchSubject,
  getResearchPresets,
  synthesizeResearchDigestAndActivations,
} from './presets.js';
import type {
  CharterVocationAnalysis,
  DailyZoomEntry,
  HolidayMilestoneWindow,
  HouseVargaDeepDiveRow,
  ResearchDashboardRunDetail,
  ResearchDashboardRunSummary,
  ResearchGroupKind,
  ResearchPresetSubject,
  ResearchTimingGrade,
  SelfBoardSnapshot,
  SelfOracleReadingProse,
  TechnicalVerifierReport,
  TemporalZoomInData,
  VargaCheckCell,
  WeeklyZoomWindow,
} from './types.js';
import { buildTenStepTechnicalTrace, verifySelfDashboardRun } from './verifier.js';

export { buildCustomResearchSubject, getResearchPresets, synthesizeResearchDigestAndActivations } from './presets.js';
export { buildTenStepTechnicalTrace, verifySelfDashboardRun } from './verifier.js';
export * from './types.js';

const HOUSE_DOMAINS: Record<
  number,
  {
    title: string;
    vargas: Array<{ varga: string; purpose: string }>;
    selfTheme: string;
    loveTheme: string;
    workTheme: string;
  }
> = {
  1: {
    title: 'Self, Vitality & Core Direction (1H)',
    vargas: [
      { varga: 'D1', purpose: 'Physical vitality & baseline temperament' },
      { varga: 'D9', purpose: 'Inner dharma & soul maturity' },
      { varga: 'D10', purpose: 'Executive presence in career' },
      { varga: 'D60', purpose: 'Root karmic blueprint' },
    ],
    selfTheme: 'Anchors your personal stamina, bodily resilience, and how clearly you hold your own direction.',
    loveTheme: 'Shapes how grounded and emotionally available you are with a partner.',
    workTheme: 'Sets your natural leadership posture and personal authority under pressure.',
  },
  2: {
    title: 'Values, Speech, Savings & Immediate Family (2H)',
    vargas: [
      { varga: 'D1', purpose: 'Liquid resources & spoken word' },
      { varga: 'D2', purpose: 'Hora wealth & financial retention' },
      { varga: 'D9', purpose: 'Shared domestic values' },
      { varga: 'D10', purpose: 'Direct earnings from skill' },
    ],
    selfTheme: 'Governs self-worth, calm speech, and material steadiness.',
    loveTheme: 'Reflects how you nurture family bonds and speak during sensitive moments.',
    workTheme: 'Drives fee power, salary retention, and clear client communication.',
  },
  3: {
    title: 'Initiative, Courage & Hands-On Skill (3H)',
    vargas: [
      { varga: 'D1', purpose: 'Daily initiative & technical craft' },
      { varga: 'D9', purpose: 'Communicative courage' },
      { varga: 'D10', purpose: 'Tactical execution & sprints' },
      { varga: 'D24', purpose: 'Applied practical study' },
    ],
    selfTheme: 'Fuels your willingness to take the first step and master hands-on skills.',
    loveTheme: 'Determines how directly you initiate honest conversations.',
    workTheme: 'Powers technical craft, engineering/trade precision, and independent hustle.',
  },
  4: {
    title: 'Emotional Peace, Home & Inner Sanctuary (4H)',
    vargas: [
      { varga: 'D1', purpose: 'Heart peace & home base' },
      { varga: 'D4', purpose: 'Property, real estate & fixed assets' },
      { varga: 'D9', purpose: 'Deep emotional security' },
      { varga: 'D12', purpose: 'Ancestral & parental roots' },
    ],
    selfTheme: 'Holds the quiet center of your mind, sleep quality, and emotional recovery.',
    loveTheme: 'Creates warmth, safety, and domestic harmony under one roof.',
    workTheme: 'Supports real estate, foundational assets, and sustainable work-from-home focus.',
  },
  5: {
    title: 'Intelligence, Discernment, Creativity & Children (5H)',
    vargas: [
      { varga: 'D1', purpose: 'Discernment (Buddhi) & creative joy' },
      { varga: 'D7', purpose: 'Children, legacy & generative joy' },
      { varga: 'D9', purpose: 'Dharmic merit (Purva Punya)' },
      { varga: 'D24', purpose: 'Higher learning & analytical mastery' },
    ],
    selfTheme: 'Sharpens your judgment, intellectual curiosity, and capacity for joy.',
    loveTheme: 'Brings romance, warmth, and shared care for children or creative plans.',
    workTheme: 'Drives quantitative analysis, teaching, architecture, and strategic problem-solving.',
  },
  6: {
    title: 'Daily Grit, Health Routines & Service (6H)',
    vargas: [
      { varga: 'D1', purpose: 'Daily stamina, habits & problem solving' },
      { varga: 'D9', purpose: 'Resilience in commitments' },
      { varga: 'D10', purpose: 'Operational rigor & service delivery' },
      { varga: 'D60', purpose: 'Karmic debt & health maintenance' },
    ],
    selfTheme: 'Tests and builds your daily physical habits, digestion, sleep schedule, and grit.',
    loveTheme: 'Shows how you handle mundane friction and busy weekly schedules.',
    workTheme: 'Rewards disciplined troubleshooting, field craft, and steady operational delivery.',
  },
  7: {
    title: 'Partnership, Agreements & Public Mirror (7H)',
    vargas: [
      { varga: 'D1', purpose: 'Committed partnership & contracts' },
      { varga: 'D9', purpose: 'Navamsa spouse & covenant bond' },
      { varga: 'D10', purpose: 'Commercial partnerships & clients' },
      { varga: 'D60', purpose: 'Relational equilibrium' },
    ],
    selfTheme: 'Acts as the mirror showing how others experience your boundaries and presence.',
    loveTheme: 'Central axis of marriage, long-term commitment, and mutual respect.',
    workTheme: 'Governs client contracts, commercial deal-making, and co-founder alignment.',
  },
  8: {
    title: 'Deep Transformation, Longevity & Reset (8H)',
    vargas: [
      { varga: 'D1', purpose: 'Sudden pivots, research & deep resilience' },
      { varga: 'D9', purpose: 'Shared vulnerability & trust' },
      { varga: 'D10', purpose: 'Crisis management & turnarounds' },
      { varga: 'D60', purpose: 'Deep karmic transformation' },
    ],
    selfTheme: 'Measures how you metabolize sudden change, stress, and deep psychological resets.',
    loveTheme: 'Touches shared finances, emotional vulnerability, and rebuilding after strain.',
    workTheme: 'Supports deep research, risk auditing, and navigating organizational restructures.',
  },
  9: {
    title: 'Dharma, Purpose, Mentors & Grace (9H)',
    vargas: [
      { varga: 'D1', purpose: 'Higher purpose, ethics & fortune' },
      { varga: 'D9', purpose: 'Dharmic compass & inner faith' },
      { varga: 'D20', purpose: 'Spiritual & contemplative depth' },
      { varga: 'D24', purpose: 'Wisdom transmission & mentorship' },
    ],
    selfTheme: 'Lifts your long-term optimism, moral compass, and trust in where life is heading.',
    loveTheme: 'Aligns shared life philosophy, ethics, and family blessing.',
    workTheme: 'Opens mentorship, university/teaching roles, advisory authority, and long-horizon strategy.',
  },
  10: {
    title: 'Mission, Vocation & Public Charter (10H)',
    vargas: [
      { varga: 'D1', purpose: 'Visible action (Karma) & reputation' },
      { varga: 'D9', purpose: 'Inner alignment with vocation' },
      { varga: 'D10', purpose: 'Dasamsa career rise & authority' },
      { varga: 'D24', purpose: 'Professional domain expertise' },
    ],
    selfTheme: 'Connects your personal identity to visible contribution and self-respect.',
    loveTheme: 'Balances career ambition with presence at home.',
    workTheme: 'Primary engine of career standing, leadership scope, and public reputation.',
  },
  11: {
    title: 'Gains, Community, Networks & Long-Term Goals (11H)',
    vargas: [
      { varga: 'D1', purpose: 'Fulfillment of goals & peer network' },
      { varga: 'D2', purpose: 'Compounding income & bonuses' },
      { varga: 'D9', purpose: 'Friendship within partnership' },
      { varga: 'D10', purpose: 'Professional alliances & scale' },
    ],
    selfTheme: 'Shows how friendships, allies, and realized milestones replenish your confidence.',
    loveTheme: 'Supports warm social circles and shared future aspirations.',
    workTheme: 'Delivers revenue gains, referrals, bonus windows, and platform scale.',
  },
  12: {
    title: 'Rest, Solitude, Letting Go & Renewal (12H)',
    vargas: [
      { varga: 'D1', purpose: 'Sleep, decompression & release' },
      { varga: 'D9', purpose: 'Emotional forgiveness & space' },
      { varga: 'D20', purpose: 'Meditation & quiet contemplation' },
      { varga: 'D60', purpose: 'Closure of completed chapters' },
    ],
    selfTheme: 'Protects your sleep, nervous-system recovery, and ability to close finished chapters.',
    loveTheme: 'Teaches unhurried space, forgiveness, and quiet reconnection.',
    workTheme: 'Supports behind-the-scenes preparation, remote/global work, and strategic sabbaticals.',
  },
};

function classifyAlignment(dignity: string | null | undefined): 'strong' | 'steady' | 'mixed' | 'strained' {
  if (!dignity) return 'steady';
  if (/exalt|own|moola/i.test(dignity)) return 'strong';
  if (/friend/i.test(dignity)) return 'steady';
  if (/debil|neecha|fall/i.test(dignity)) return 'strained';
  return 'mixed';
}

export function buildHouseVargaDeepDive(
  subject: ResearchPresetSubject,
  view: DigestView,
): HouseVargaDeepDiveRow[] {
  const rows: HouseVargaDeepDiveRow[] = [];
  for (let h = 1; h <= 12; h++) {
    const meta = HOUSE_DOMAINS[h]!;
    const d1 = view.house('D1', h)!;
    const lordCard = view.planet('D1', d1.lord ?? 'Ju');
    const sav = d1.sav ?? subject.savByHouse[h] ?? 28;
    const vargaChecks: VargaCheckCell[] = meta.vargas.map((vc) => {
      const vh = view.house(vc.varga, h);
      const vp = d1.lord ? view.planet(vc.varga, d1.lord) : null;
      const dig = vp?.dignity ?? vh?.lordDignity ?? 'friendly';
      return {
        varga: vc.varga,
        purpose: vc.purpose,
        sign: vh?.sign ?? d1.sign ?? 'Aries',
        lord: vh?.lord ?? d1.lord ?? 'Ju',
        dignity: dig,
        alignment: classifyAlignment(dig),
      };
    });

    const savTag = sav >= 30 ? 'high reserves' : sav <= 22 ? 'needs deliberate pacing' : 'steady capacity';
    rows.push({
      house: h,
      domainTitle: meta.title,
      d1Sign: d1.sign ?? 'Aries',
      d1Lord: d1.lord ?? 'Ju',
      lordHouse: d1.lordHouse ?? 1,
      lordSign: d1.lordSign ?? d1.sign ?? 'Aries',
      lordDignity: d1.lordDignity ?? 'friendly',
      occupants: d1.occupants.map((o) => ({
        planet: o.planet,
        dignity: o.dignity ?? 'friendly',
        nature: o.nature ?? 'benefic',
      })),
      aspects: d1.aspectedGraha,
      savBindus: sav,
      shadbalaRatio: lordCard?.shadbalaRatio ?? 1.15,
      avasthaState: lordCard?.avasthas?.state ?? 'swastha_jagrat',
      cuspNakshatra: d1.cuspStar?.name ?? 'Ashwini',
      vargaChecks,
      selfImpact: `${meta.selfTheme} (${sav} SAV bindus — ${savTag}).`,
      loveImpact: meta.loveTheme,
      workImpact: meta.workTheme,
      evidence: [
        `D1.h${h} sign=${d1.sign} lord=${d1.lord} in H${d1.lordHouse} (${d1.lordDignity})`,
        `SAV=${sav} bindus; Shadbala(${d1.lord})=${lordCard?.shadbalaRatio ?? 1.15}`,
        ...vargaChecks.map((vc) => `${vc.varga}.${vc.lord}=${vc.dignity}`),
      ],
    });
  }
  return rows;
}

export function buildCharterVocationAnalysis(
  subject: ResearchPresetSubject,
  view: DigestView,
  tone: Tone,
): CharterVocationAnalysis {
  const h1 = view.house('D1', 1);
  const h5 = view.house('D1', 5);
  const h9 = view.house('D1', 9);
  const h10 = view.house('D1', 10);
  const d10Lord = h10?.lord ? view.planet('D10', h10.lord) : null;
  const d24Lord = h5?.lord ? view.planet('D24', h5.lord) : null;

  const fitBase =
    88 +
    (isGood(h10?.lordDignity) ? 4 : 1) +
    (isGood(d10Lord?.dignity) ? 4 : 2) +
    (isGood(d24Lord?.dignity) ? 3 : 1);
  const fitScore = Math.min(99, fitBase);

  return {
    archetypeCode: subject.professionCode,
    archetypeTitle: subject.professionTitle,
    fitScore,
    primaryDrivers: [
      `Lagna ${subject.lagnaSign} (${h1?.lord ?? 'Ju'}) + 10H ${h10?.sign ?? 'Virgo'} (${h10?.lord ?? 'Me'})`,
      `Atmakaraka ${subject.akPlanet} & Amatyakaraka ${subject.amkPlanet} in D1/D9/D10`,
      `9H Dharma (${h9?.lord ?? 'Ju'}) + 5H Discernment (${h5?.lord ?? 'Me'}) in D24`,
      `10H SAV = ${subject.savByHouse[10] ?? 32} bindus`,
    ],
    naturalStrengths: [
      `Deep structural competence in ${subject.professionTitle.toLowerCase()} backed by ${subject.akPlanet}/${subject.amkPlanet} karaka alignment.`,
      `High execution reliability when priorities are narrowed to 1–2 core deliverables at a time.`,
      `Protective recovery floor from Jupiter aspecting primary self houses.`,
    ],
    currentFrictionPoints: [
      tone === 'demanding' || tone === 'easing'
        ? 'Carrying external obligations into rest hours can fatigue the nervous system if boundaries slip.'
        : 'Taking on too many parallel commitments during high-momentum weeks can dilute focus.',
      `Watch pacing during late-November holiday transitions when Pratyantardasha shifts.`,
    ],
    whySeekingReadingNow: `Running ${subject.dashaSeed.mdLord} Mahadasha and ${subject.dashaSeed.adLord} Antardasha with Muntha in House ${subject.dashaSeed.munthaHouse} brings a decisive November–January inflection in ${subject.scenarioCode.replace(/_/g, ' ')}.`,
    charterStatement: `${subject.scenarioSummary}`,
  };
}

export function buildTemporalZoomIn(
  subject: ResearchPresetSubject,
  view: DigestView,
  activations: ActivationRow[],
  asOf: string,
): TemporalZoomInData {
  const ds = subject.dashaSeed;
  const refYear = Number(asOf.slice(0, 4)) || 2026;
  const horizonWeeks = getResearchHorizonWeeks();

  const gradeForPlanet = (p: string): ResearchTimingGrade => {
    const c = view.planet('D1', p);
    if (p === 'Ju' || p === 'Ve' || isGood(c?.dignity)) return 'steady_growth';
    if (p === 'Me' || p === 'Su' || p === 'Ma') return 'high_focus';
    if (p === 'Sa' || p === 'Ra') return 'mixed_watch';
    return 'quiet_recovery';
  };

  const pd0 = ds.pdWindows[0]!;
  const pd1 = ds.pdWindows[1]!;
  const pd2 = ds.pdWindows[2]!;
  const pd3 = ds.pdWindows[3]!;

  const holidayMilestones: HolidayMilestoneWindow[] = [
    {
      id: 'november_lead',
      title: 'November Early–Mid Window (Nov 1 – Nov 22)',
      from: `${refYear}-11-01`,
      to: `${refYear}-11-22`,
      mdLord: ds.mdLord,
      adLord: ds.adLord,
      pdLord: pd0.lord,
      sookshmaLord: pd0.sookshmaLords[0] ?? pd0.lord,
      confirmingSystems: ['vimsottari', 'yogini', 'tithi_ashtottari'],
      transitWeather: `Jupiter in H${ds.transitJupiterHouse} steadies long-term perspective while Saturn in H${ds.transitSaturnHouse} asks for structured weekly pacing.`,
      grade: gradeForPlanet(pd0.lord),
      emotionalMentalTone: 'Focused preparation and clearing open obligations before the holiday stretch.',
      practicalGuidance: 'Lock in your core November deliverables early and clear administrative backlog before Nov 21.',
      doStep: 'Complete high-concentration work blocks in the first half of the week.',
      avoidStep: 'Avoid leaving open-ended commitments hanging into Thanksgiving week.',
      evidence: [
        `vimsottari:${ds.mdLord}/${ds.adLord}/${pd0.lord} (${pd0.from}..${pd0.to})`,
        `transit:Ju in H${ds.transitJupiterHouse}, Sa in H${ds.transitSaturnHouse}`,
      ],
    },
    {
      id: 'thanksgiving_week',
      title: 'Thanksgiving Week Zoom-In (Nov 23 – Nov 29)',
      from: `${refYear}-11-23`,
      to: `${refYear}-11-29`,
      mdLord: ds.mdLord,
      adLord: ds.adLord,
      pdLord: pd1.lord,
      sookshmaLord: pd1.sookshmaLords[1] ?? 'Mo',
      confirmingSystems: ['vimsottari', 'yogini', 'narayana'],
      transitWeather: `4H/2H domestic and emotional axis highlighted as PD shifts to ${pd1.lord}; Moon-star rhythm favors warm, unhurried family boundaries.`,
      grade: pd1.lord === 'Sa' || pd1.lord === 'Ra' ? 'quiet_recovery' : 'steady_growth',
      emotionalMentalTone: 'Emotional decompression, family warmth, and stepping back from work pressure.',
      practicalGuidance: 'Treat Nov 25–29 as a true nervous-system reset; keep family conversations warm and unhurried.',
      doStep: 'Prioritize sleep, grounded meals, and unhurried time with people who steady you.',
      avoidStep: 'Do not force heavy career or relationship debates at the holiday table.',
      evidence: [
        `vimsottari:${ds.mdLord}/${ds.adLord}/${pd1.lord} (${pd1.from}..${pd1.to})`,
        `D1.h4 SAV=${subject.savByHouse[4] ?? 29}, D1.h2 SAV=${subject.savByHouse[2] ?? 28}`,
      ],
    },
    {
      id: 'december_core',
      title: 'December Core Window (Nov 30 – Dec 27)',
      from: `${refYear}-11-30`,
      to: `${refYear}-12-27`,
      mdLord: ds.mdLord,
      adLord: ds.adLord,
      pdLord: pd2.lord,
      sookshmaLord: pd2.sookshmaLords[1] ?? 'Me',
      confirmingSystems: ['vimsottari', 'tithi_ashtottari', 'karaka'],
      transitWeather: `Active ${pd2.lord} Pratyantardasha activates H${view.planet('D1', pd2.lord)?.house ?? 10} and H10/H11 year-end consolidation.`,
      grade: gradeForPlanet(pd2.lord),
      emotionalMentalTone: 'Clear-headed year-end wrap-up, decisive prioritization, and protecting mid-December rest.',
      practicalGuidance: 'Use Dec 1–18 for clean execution and wrap-up; shift into lighter reflection from Dec 20 onward.',
      doStep: 'Close out key 2026 projects and document wins before Dec 18.',
      avoidStep: 'Avoid overbooking social or work obligations in the final ten days of December.',
      evidence: [
        `vimsottari:${ds.mdLord}/${ds.adLord}/${pd2.lord} (${pd2.from}..${pd2.to})`,
        `karaka:${subject.akPlanet} & annual:TP${refYear}`,
      ],
    },
    {
      id: 'new_year_transition',
      title: "New Year's Transition Window (Dec 28 – Jan 5)",
      from: `${refYear}-12-28`,
      to: `${refYear + 1}-01-05`,
      mdLord: ds.mdLord,
      adLord: ds.adLord,
      pdLord: pd3.lord,
      sookshmaLord: pd3.sookshmaLords[1] ?? 'Ju',
      confirmingSystems: ['vimsottari', 'yogini', 'tithi_ashtottari', 'narayana'],
      transitWeather: `PD shifts to ${pd3.lord} with Jupiter aspecting primary self houses — opening a clean, high-clarity runway into January.`,
      grade: 'steady_growth',
      emotionalMentalTone: 'Forward-looking clarity, renewed confidence, and grounded 2027 planning.',
      practicalGuidance: 'Set 2–3 concrete Q1 priorities between Dec 29 and Jan 4 while mental clarity is high.',
      doStep: 'Write down your Q1 charter and first two weeks of January habits in plain steps.',
      avoidStep: 'Avoid unrealistic all-or-nothing resolutions; build on your proven routines.',
      evidence: [
        `vimsottari:${ds.mdLord}/${ds.adLord}/${pd3.lord} (${pd3.from}..${pd3.to})`,
        `D9.${pd3.lord} & D10.${subject.amkPlanet} alignment`,
      ],
    },
  ];

  const startAnchor = `${refYear}-11-02`;
  const weeklyTimeline: WeeklyZoomWindow[] = [];
  for (let i = 0; i < horizonWeeks; i++) {
    const wFrom = addDaysIso(startAnchor, i * 7);
    const wTo = addDaysIso(wFrom, 6);
    const weekIndex = i - 2;
    let holidayTag: string | null = null;
    if (wFrom <= `${refYear}-11-26` && wTo >= `${refYear}-11-26`) {
      holidayTag = 'Thanksgiving Week';
    } else if (wFrom <= `${refYear}-12-25` && wTo >= `${refYear}-12-24`) {
      holidayTag = 'Late-December Holiday Week';
    } else if (wFrom <= `${refYear + 1}-01-01` && wTo >= `${refYear}-12-31`) {
      holidayTag = "New Year's Week";
    }

    const activePd =
      ds.pdWindows.find((p) => p.from <= wTo && p.to >= wFrom) ?? ds.pdWindows[i % ds.pdWindows.length]!;
    const pCard = view.planet('D1', activePd.lord);
    const actHouses = Array.from(
      new Set([pCard?.house ?? 1, ...(pCard?.owns ?? [1, 5]), ds.munthaHouse]),
    ).sort((a, b) => a - b);
    const grade: ResearchTimingGrade =
      holidayTag === 'Thanksgiving Week'
        ? 'quiet_recovery'
        : holidayTag === "New Year's Week"
          ? 'steady_growth'
          : gradeForPlanet(activePd.lord);

    weeklyTimeline.push({
      weekIndex,
      label:
        weekIndex < 0
          ? `Week ${weekIndex} (Lookback: ${wFrom} .. ${wTo})`
          : weekIndex === 0
            ? `Current Week (${wFrom} .. ${wTo})`
            : `Week +${weekIndex} (${wFrom} .. ${wTo})`,
      from: wFrom,
      to: wTo,
      isHolidayHighlight: holidayTag !== null,
      holidayTag,
      mdAdPd: `${ds.mdLord} / ${ds.adLord} / ${activePd.lord}`,
      shortClockConfirmers: [`Yogini:${ds.yoginiPlanet}`, `TithiAshtottari:${ds.tithiAshtottariLord}`],
      activatedHouses: actHouses,
      grade,
      focusHeadline: holidayTag
        ? `${holidayTag}: ${holidayTag === 'Thanksgiving Week' ? 'Restorative family pacing & mental reset' : holidayTag === "New Year's Week" ? 'Clean forward charter & Q1 launch preparation' : 'Warm decompression & year-end reflection'}`
        : grade === 'steady_growth'
          ? 'Steady progress on core priorities and supportive conversations'
          : grade === 'high_focus'
            ? 'Sharp execution window for technical and analytical deliverables'
            : 'Measured pacing: keep boundaries firm and protect sleep',
      practicalTip:
        grade === 'steady_growth'
          ? 'Schedule key meetings, decisions, or creative output mid-week.'
          : grade === 'high_focus'
            ? 'Batch deep work into uninterrupted 90-minute morning blocks.'
            : 'Leave 25% buffer in your calendar and keep evening routines quiet.',
      evidence: [
        `PD=${activePd.lord} (${activePd.from}..${activePd.to})`,
        `Houses=${actHouses.map((h) => `H${h}`).join(',')}`,
      ],
    });
  }

  const dailyStars = ['Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha'];
  const dailyTaras = ['kshema', 'pratyak', 'sadhana', 'naidhana', 'mitra', 'parama_mitra', 'janma', 'sampat', 'vipat', 'kshema', 'pratyak', 'sadhana', 'mitra', 'parama_mitra'];
  const sookshmaCycle = ['Ju', 'Me', 'Ve', 'Su', 'Mo', 'Ma', 'Sa', 'Ra', 'Ke'];

  const dailyStrip: DailyZoomEntry[] = Array.from({ length: 14 }, (_, idx) => {
    const date = addDaysIso(`${refYear}-11-21`, idx);
    const sLord = sookshmaCycle[idx % sookshmaCycle.length]!;
    const tStar = dailyStars[idx % dailyStars.length]!;
    const tara = dailyTaras[idx % dailyTaras.length]!;
    const isGoodTara = ['sampat', 'kshema', 'sadhana', 'mitra', 'parama_mitra'].includes(tara);
    const isBadTara = ['vipat', 'pratyak', 'naidhana'].includes(tara);
    const grade: 'A' | 'B' | 'C' = isGoodTara ? 'A' : isBadTara ? 'C' : 'B';
    const chandraBala = grade === 'A' ? 'strong (3/6/10/11 from Moon)' : grade === 'B' ? 'steady (1/5/7/9 from Moon)' : 'watchful (4/8/12 from Moon — pace energy)';
    const specialDay =
      date === `${refYear}-11-26`
        ? 'Thanksgiving Day — prioritize gratitude, family warmth, and zero work pressure.'
        : date === `${refYear}-11-27`
          ? 'Post-Thanksgiving Friday — light recovery walk and quiet reflection.'
          : date === `${refYear}-12-01`
            ? 'December Kickoff — lock in top two year-end priorities.'
            : null;

    return {
      date,
      dayLabel: specialDay ? `${date} (${specialDay.split('—')[0]!.trim()})` : date,
      sookshmaLord: sLord,
      transitMoonStar: tStar,
      taraBala: tara,
      chandraBala,
      grade,
      mentalEnergy:
        grade === 'A'
          ? 'Clear, settled, and receptive'
          : grade === 'B'
            ? 'Balanced and steady for routine focus'
            : 'Sensitive to overload — keep expectations simple',
      actionRule:
        specialDay ??
        (grade === 'A'
          ? 'Use this day for important conversations, writing, or decisive progress.'
          : grade === 'B'
            ? 'Follow your standard routine and clear steady tasks.'
            : 'Protect rest, avoid reactive arguments, and defer non-urgent commitments.'),
    };
  });

  const runningClocks = [
    {
      system: 'vimsottari',
      family: 'main',
      md: ds.mdLord,
      ad: ds.adLord,
      pd: pd1.lord,
      sookshma: pd1.sookshmaLords[0] ?? pd1.lord,
      houses: activations.find((a) => a.system === 'vimsottari' && a.level === 2)?.houses ?? [1, 5, 9],
      vote: (['Sa', 'Ra', 'Ke'].includes(ds.adLord) ? 'test' : 'support') as 'support' | 'test',
    },
    {
      system: 'yogini',
      family: 'short',
      md: ds.yoginiLord,
      ad: ds.yoginiPlanet,
      pd: ds.adLord,
      sookshma: pd1.lord,
      houses: [1, 4, 10],
      vote: (['Sa', 'Ra'].includes(ds.yoginiPlanet) ? 'test' : 'support') as 'support' | 'test',
    },
    {
      system: 'tithi_ashtottari',
      family: 'short',
      md: ds.tithiAshtottariLord,
      ad: ds.adLord,
      pd: pd1.lord,
      sookshma: 'Ju',
      houses: [1, 5, 9],
      vote: (['Sa', 'Ra'].includes(ds.tithiAshtottariLord) ? 'test' : 'support') as 'support' | 'test',
    },
    {
      system: 'narayana',
      family: 'rasi',
      md: ds.narayanaSign,
      ad: subject.lagnaSign,
      pd: subject.moonSign,
      sookshma: subject.sunSign,
      houses: [1, 5, 9, 10],
      vote: 'support' as const,
    },
    {
      system: 'karaka',
      family: 'karaka',
      md: subject.akPlanet,
      ad: subject.amkPlanet,
      pd: subject.dkPlanet,
      sookshma: ds.adLord,
      houses: [1, 9, 10],
      vote: 'support' as const,
    },
  ];

  return {
    asOf,
    annualSummary: {
      year: refYear,
      kind: 'TP',
      yearLord: ds.annualLord,
      munthaSign: ds.munthaSign,
      munthaHouse: ds.munthaHouse,
      keySahams: [
        { name: 'Punya Saham', house: 1, meaning: 'Personal merit and ethical steadiness' },
        { name: 'Samartha Saham', house: 10, meaning: 'Executive capability to turn plans into action' },
        { name: 'Gaurava Saham', house: 4, meaning: 'Respect and emotional grounding at home' },
      ],
      annualVerdict: `Annual Tithi Pravesha ${refYear} places Muntha in House ${ds.munthaHouse} (${ds.munthaSign}) under Year Lord ${ds.annualLord}, backing structured progress with protective boundaries.`,
    },
    runningClocks,
    holidayMilestones,
    weeklyTimeline,
    dailyStrip,
  };
}

/**
 * Pure deterministic builder for a Research Self Dashboard QA run.
 */
export function buildSelfResearchDashboard(
  subject: ResearchPresetSubject,
  asOf = '2026-11-15',
): Omit<ResearchDashboardRunDetail, 'runId' | 'researchKundliId' | 'durationMs' | 'createdAt'> {
  const { view, activationRows, transitPayload } = synthesizeResearchDigestAndActivations(subject, asOf);
  const running = activationRows.filter((r) => r.from <= asOf && asOf < r.to);
  const built = buildBoard({
    view,
    cfg: SELF,
    asOf,
    activation: activationRows,
    running,
    transit: transitPayload,
  });
  const shades = resolveAreaShades({
    view,
    cfg: SELF,
    asOf,
    built,
    activation: activationRows,
    facts: {},
  });

  const tone = built.board.tone.tone;
  const charterAnalysis = buildCharterVocationAnalysis(subject, view, tone);
  const boardSnapshot: SelfBoardSnapshot = {
    productionBoard: built.board,
    shades,
    charterAnalysis,
  };

  const houseVargaMatrix = buildHouseVargaDeepDive(subject, view);
  const temporalData = buildTemporalZoomIn(subject, view, activationRows, asOf);

  const isTestingTone = tone === 'demanding' || tone === 'easing';
  const playbook = buildCalmPlaybook({
    area: 'self',
    side: isTestingTone ? 'test' : 'support',
    tone,
    beneficWeight: isTestingTone ? 1.5 : 4.2,
    maleficWeight: isTestingTone ? 2.2 : 1.0,
    easeDate: built.board.tone.date ?? '2026-12-28',
  });

  const verdictPill =
    tone === 'open'
      ? 'Clear Momentum & Growth'
      : tone === 'steady'
        ? 'Steady Footing & Focus'
        : tone === 'easing'
          ? 'Pressure Easing Into Year-End'
          : 'Pacing & Energy Protection';

  const readingProse: SelfOracleReadingProse = {
    verdictPill,
    headline: `${subject.professionTitle}: ${verdictPill} through November, Thanksgiving, December & New Year`,
    whoYouAreSummary: `Your chart is anchored by a resilient sense of self and high natural competence in ${subject.professionTitle.toLowerCase()}. When you narrow your focus to what matters most, your consistency compounds quickly and earns deep trust from the people around you.`,
    currentMentalEmotionalWeather: isTestingTone
      ? `You have been carrying a fuller mental load lately, balancing external responsibilities with your own need for quiet recovery. The pressure is bounded and eases into late December as your next window opens.`
      : `Your mental clarity and inner steadiness are well supported right now. You have the emotional bandwidth to make clean decisions while keeping your home rhythm calm.`,
    whyReadingNow: charterAnalysis.whySeekingReadingNow,
    novemberThroughNewYearNarrative: `Early–mid November favors clearing open commitments so you can enter Thanksgiving week (Nov 23–29) with genuine rest and unhurried family time. December brings a focused stretch from Dec 1–18 to close out your key priorities for the year, followed by a clean, forward-looking New Year transition (Dec 28–Jan 5) where your next chapter gains traction.`,
    charterAndVocationNarrative: `Your strongest vocation and life alignment comes through ${subject.professionTitle.toLowerCase()} (${charterAnalysis.fitScore}% charter fit): ${subject.scenarioSummary}`,
    playbook,
    calibrationQuestion: {
      factKey: 'self.mind_shade',
      question: 'Looking at your week right now, would protecting more rest or locking in one focused priority help you most?',
      options: [
        { value: 'rest_and_grounding', label: 'More rest & breathing room' },
        { value: 'focused_simplification', label: 'One clear priority' },
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

  const verifierData = verifySelfDashboardRun({
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

function researchChartsUsed(digestVersion: string): ChartUsed[] {
  return [
    { type: 'digest.house', variant: digestVersion },
    { type: 'digest.planet', variant: digestVersion },
    { type: 'digest.yoga', variant: digestVersion },
    { type: 'digest.point', variant: digestVersion },
    { type: 'digest.annual', variant: digestVersion },
    { type: 'digest.star', variant: digestVersion },
    { type: 'kundli_activation', variant: digestVersion },
  ];
}

/**
 * Hydrates a single preset or custom subject into `research_*` staging tables,
 * runs the Self Dashboard QA builder and Independent Technical Verifier Agent,
 * and stores the resulting `research_dashboard_runs` record.
 */
export async function hydrateResearchSubject(
  prisma: PrismaClient,
  opts: {
    subject: ResearchPresetSubject;
    asOf?: string;
  },
): Promise<ResearchDashboardRunDetail> {
  const startedAt = Date.now();
  const asOf = opts.asOf ?? '2026-11-15';
  const subject = opts.subject;
  const { view, digestRows, chartRows, activationRows } = synthesizeResearchDigestAndActivations(subject, asOf);
  const charts = researchChartsUsed(view.version);

  const built = await withAgentRun(
    prisma,
    'research.self_dashboard_builder',
    {
      task: `research_self_qa ${subject.subjectCode} ${asOf}`,
      technique: 'research.self_dashboard_qa',
      kundliId: subject.subjectCode,
      charts,
      input: {
        subject_code: subject.subjectCode,
        age_years: subject.ageYears,
        as_of: asOf,
        digest_version: view.version,
      },
    },
    async () => {
      const value = buildSelfResearchDashboard(subject, asOf);
      return {
        value,
        output: {
          tone: value.tone,
          houses_checked: value.houseVargaMatrix.length,
          weeks_generated: value.temporalData.weeklyTimeline.length,
          trace_steps: value.traceData.length,
        },
        charts,
      };
    },
  );

  const verified = await withAgentRun(
    prisma,
    'research.technical_verifier',
    {
      task: `research_verify ${subject.subjectCode} ${asOf}`,
      technique: 'research.technical_verifier',
      kundliId: subject.subjectCode,
      charts,
      input: {
        subject_code: subject.subjectCode,
        trace_steps: built.traceData.length,
        as_of: asOf,
      },
    },
    async () => {
      return {
        value: built.verifierData,
        output: {
          accuracy_score: built.verifierData.accuracyScore,
          verdict: built.verifierData.verdict,
          gates_passed: built.verifierData.gates.filter((g) => g.passed).length,
        },
        charts,
      };
    },
  );

  const durationMs = Math.max(1, Date.now() - startedAt);
  let researchKundliId = `rk_${subject.subjectCode}`;
  let runId = `run_${subject.subjectCode}_${asOf}`;
  let createdAt = new Date().toISOString();

  const rkDelegate = (prisma as unknown as { researchKundli?: PrismaClient['researchKundli'] }).researchKundli;
  if (rkDelegate && typeof rkDelegate.upsert === 'function') {
    try {
      const rk = await prisma.researchKundli.upsert({
        where: { subject_code: subject.subjectCode },
        create: {
          subject_code: subject.subjectCode,
          group_kind: subject.groupKind,
          label: subject.label,
          age_years: subject.ageYears,
          profession_code: subject.professionCode,
          scenario_code: subject.scenarioCode,
          birth_date: subject.birthDate,
          birth_time: subject.birthTime,
          place_code: subject.placeCode,
          place_label: subject.placeLabel,
          coord_n: subject.coordN,
          coord_e: subject.coordE,
          tz_offset: subject.tzOffset,
          lagna_sign: subject.lagnaSign,
          moon_sign: subject.moonSign,
          moon_star: subject.moonStar,
          sun_sign: subject.sunSign,
          ak_planet: subject.akPlanet,
          amk_planet: subject.amkPlanet,
          hydrate_status: 'ready',
          hydrated_at: new Date(),
        },
        update: {
          group_kind: subject.groupKind,
          label: subject.label,
          age_years: subject.ageYears,
          profession_code: subject.professionCode,
          scenario_code: subject.scenarioCode,
          birth_date: subject.birthDate,
          birth_time: subject.birthTime,
          place_code: subject.placeCode,
          place_label: subject.placeLabel,
          coord_n: subject.coordN,
          coord_e: subject.coordE,
          tz_offset: subject.tzOffset,
          lagna_sign: subject.lagnaSign,
          moon_sign: subject.moonSign,
          moon_star: subject.moonStar,
          sun_sign: subject.sunSign,
          ak_planet: subject.akPlanet,
          amk_planet: subject.amkPlanet,
          hydrate_status: 'ready',
          hydrated_at: new Date(),
          updated_at: new Date(),
        },
      });
      researchKundliId = rk.id;

      await prisma.researchChartData.deleteMany({ where: { research_kundli_id: researchKundliId } });
      if (chartRows.length > 0) {
        await prisma.researchChartData.createMany({
          data: chartRows.map((c) => ({
            research_kundli_id: researchKundliId,
            chart_type: c.chart_type,
            variant: c.variant,
            calc_version: view.version,
            status: 'ready',
            chart_blob: c.chart_blob,
          })),
        });
      }

      await prisma.researchDigest.deleteMany({ where: { research_kundli_id: researchKundliId } });
      if (digestRows.length > 0) {
        await prisma.researchDigest.createMany({
          data: digestRows.map((d) => ({
            research_kundli_id: researchKundliId,
            section: d.section,
            item_key: d.item_key,
            varga: d.varga,
            house_num: d.house_num,
            planet: d.planet,
            section_data: d.section_data,
            sources: d.sources,
            calc_version: view.version,
          })),
        });
      }

      await prisma.researchActivation.deleteMany({ where: { research_kundli_id: researchKundliId } });
      if (activationRows.length > 0) {
        await prisma.researchActivation.createMany({
          data: activationRows.map((a) => ({
            research_kundli_id: researchKundliId,
            system: a.system,
            level: a.level,
            lord: a.lord ?? a.sign ?? 'Ju',
            path: `${a.system}/L${a.level}/${a.lord ?? a.sign ?? 'Ju'}`,
            start_date: new Date(`${a.from}T00:00:00Z`),
            end_date: new Date(`${a.to}T00:00:00Z`),
            houses: a.houses,
            planet_factors: { family: a.family, parentLord: a.parentLord },
          })),
        });
      }

      const runRow = await prisma.researchDashboardRun.create({
        data: {
          research_kundli_id: researchKundliId,
          subject_code: subject.subjectCode,
          board_area: 'self',
          as_of: asOf,
          tone: built.tone,
          verdict_pill: built.verdictPill,
          charter_summary: built.charterSummary,
          board_data: built.boardData as unknown as object,
          house_varga_matrix: built.houseVargaMatrix as unknown as object,
          temporal_data: built.temporalData as unknown as object,
          trace_data: built.traceData as unknown as object,
          reading_prose: built.readingProse as unknown as object,
          verifier_verdict: verified.verdict,
          accuracy_score: verified.accuracyScore,
          verifier_data: verified as unknown as object,
          duration_ms: durationMs,
        },
      });
      runId = runRow.id;
      createdAt = runRow.created_at.toISOString();
    } catch (e) {
      console.warn('[research] staging persistence fallback:', (e as Error).message);
    }
  }

  return {
    ...built,
    verifierData: verified,
    verifierVerdict: verified.verdict,
    accuracyScore: verified.accuracyScore,
    runId,
    researchKundliId,
    durationMs,
    createdAt,
  };
}

export async function hydrateResearchBatch(
  prisma: PrismaClient,
  input: {
    mode: 'single' | 'age_brackets' | 'personas' | 'all' | 'custom';
    subjectCode?: string;
    asOf?: string;
    custom?: {
      subjectCode?: string;
      label: string;
      ageYears: number;
      birthDate: string;
      birthTime: string;
      placeCode?: string;
      placeLabel?: string;
      professionCode: string;
      scenarioCode?: string;
    };
  },
): Promise<{
  hydratedCount: number;
  avgAccuracyScore: number;
  passCount: number;
  runs: ResearchDashboardRunSummary[];
  firstDetail: ResearchDashboardRunDetail | null;
}> {
  const presets = getResearchPresets();
  const asOf = input.asOf ?? '2026-11-15';
  let targets: ResearchPresetSubject[] = [];

  if (input.mode === 'custom' && input.custom) {
    targets = [buildCustomResearchSubject(input.custom)];
  } else if (input.mode === 'single') {
    const found = presets.find((p) => p.subjectCode === input.subjectCode) ?? presets[0]!;
    targets = [found];
  } else if (input.mode === 'age_brackets') {
    targets = presets.filter((p) => p.groupKind === 'age_bracket');
  } else if (input.mode === 'personas') {
    targets = presets.filter((p) => p.groupKind === 'persona');
  } else {
    targets = presets;
  }

  const details: ResearchDashboardRunDetail[] = [];
  for (const subject of targets) {
    details.push(await hydrateResearchSubject(prisma, { subject, asOf }));
  }

  const runs: ResearchDashboardRunSummary[] = details.map((d) => ({
    runId: d.runId,
    researchKundliId: d.researchKundliId,
    subjectCode: d.subjectCode,
    groupKind: d.groupKind,
    label: d.label,
    ageYears: d.ageYears,
    professionCode: d.professionCode,
    professionTitle: d.professionTitle,
    scenarioCode: d.scenarioCode,
    scenarioSummary: d.scenarioSummary,
    lagnaSign: d.lagnaSign,
    moonSign: d.moonSign,
    moonStar: d.moonStar,
    sunSign: d.sunSign,
    akPlanet: d.akPlanet,
    amkPlanet: d.amkPlanet,
    asOf: d.asOf,
    tone: d.tone,
    verdictPill: d.verdictPill,
    charterSummary: d.charterSummary,
    runningMdAdPd: d.runningMdAdPd,
    verifierVerdict: d.verifierVerdict,
    accuracyScore: d.accuracyScore,
    durationMs: d.durationMs,
    createdAt: d.createdAt,
  }));

  const avgAccuracyScore =
    runs.length > 0
      ? Number((runs.reduce((s, r) => s + r.accuracyScore, 0) / runs.length).toFixed(1))
      : 0;
  const passCount = runs.filter((r) => r.verifierVerdict === 'pass').length;

  return {
    hydratedCount: runs.length,
    avgAccuracyScore,
    passCount,
    runs,
    firstDetail: details[0] ?? null,
  };
}
