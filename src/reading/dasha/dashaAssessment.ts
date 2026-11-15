/**
 * Core D1+D9 Mutual Confirmation & Active Dasha / Tithi Pravesha Assessment Engine (docs/reading-engine/76).
 *
 * Implements:
 * 1. Classical planetary maturation age gating (Saturn at 36) via `getD9MaturityAgeYears()`.
 * 2. Deterministic D1+D9 mutual confirmation evaluating Vargottama, Neecha Bhanga via D9, False Promise,
 *    and Drudha Karma (Neecha Vargottama).
 * 3. Multi-clock active dasha routing across all 40+ dasha systems (conditional, vimshottari, rasi, yogini).
 * 4. Annual Tithi Pravesha integration with departmental varga analysis (D10, D7, D9, D30) and fail-closed stance.
 *
 * All astrological indicators come from stored engine rows; Node performs zero astrological derivation.
 */
import { getD9MaturityAgeYears } from '../../config/env.js';
import type { ActivationRow } from '../digest/activation.js';
import type { AnnualRow, DigestView, PlanetCard } from '../digest/types.js';
import { runningTithiPravesha, tpRowIn, type RunningTithiPravesha, type TpShortClock } from '../annual/tithiPravesha.js';

export type D1D9ConfirmationVerdict =
  | 'confirmed_strong'
  | 'd9_weakened'
  | 'd9_redeemed'
  | 'confirmed_weak'
  | 'neutral';

export interface D1D9ConfirmationResult {
  planet: string;
  isMature: boolean;
  d1Sign: string;
  d1House: number;
  d1Dignity: string;
  d9Sign: string;
  d9House: number;
  d9Dignity: string;
  isVargottama: boolean;
  isNeechaVargottama: boolean;
  verdict: D1D9ConfirmationVerdict;
  scoreAdjustment: number;
  summary: string;
  citations: string[];
}

export interface ActiveDashaAssessmentResult {
  asOf: string;
  ageYears: number | null;
  isMature: boolean;
  activeMahadasha: {
    system: string;
    family: string;
    lord: string;
    from: string;
    to: string;
    level: number;
  } | null;
  activeAntardasha: {
    system: string;
    family: string;
    lord: string;
    from: string;
    to: string;
    level: number;
  } | null;
  d1d9Confirmation: {
    mahadashaLord: D1D9ConfirmationResult | null;
    antardashaLord: D1D9ConfirmationResult | null;
  };
  vargaPlacement: {
    varga: string;
    mahadashaLordCard: PlanetCard | null;
    antardashaLordCard: PlanetCard | null;
    status: 'support' | 'test' | 'neutral';
    tpAnnualVargaRow?: AnnualRow | null;
  } | null;
  tithiPravesha: {
    year: number;
    start: string;
    end: string;
    yearLord: string;
    shortClock: TpShortClock | null;
    stance: 'build' | 'get_through';
    yearLordConfirm?: D1D9ConfirmationResult | null;
    yearLordConfirmation?: D1D9ConfirmationResult | null;
    tpD9Row?: AnnualRow | null;
    tpVargaRow?: AnnualRow | null;
    yearLordVargaCard?: PlanetCard | null;
  } | null;
  multiClockConcordance: {
    concordance: 'confirmed' | 'leaning' | 'contested';
    agreeingClocks: number;
  };
  narrativeContext: string;
  gaps: string[];
}

/**
 * Calculates fractional age in years between birth date and asOf date.
 * Returns null if birthDate or asOf is missing or invalid.
 */
export function ageInYears(birthDate?: string | null, asOf?: string | null): number | null {
  if (!birthDate || !asOf) return null;
  const b = new Date(birthDate.slice(0, 10)).getTime();
  const a = new Date(asOf.slice(0, 10)).getTime();
  if (isNaN(b) || isNaN(a) || a < b) return null;
  return (a - b) / (365.2425 * 86_400_000);
}

/**
 * Classical Vedic planetary maturation check (Saturn at 36 years; docs/reading-engine/76 §2.1).
 * Strictly requires ageYears > getD9MaturityAgeYears() (default 36).
 */
export function isAgeMatureD9(ageYears: number | null | undefined): boolean {
  if (typeof ageYears !== 'number' || isNaN(ageYears)) return false;
  return ageYears > getD9MaturityAgeYears();
}

/**
 * Evaluates mutual confirmation of planetary dignity and placement between D1 (Rasi) and D9 (Navamsha).
 *
 * Rules:
 * 1. Neecha Vargottama: debilitated in both D1 and D9 -> Drudha Karma (-1.5 mature, -1.2 pre-mature).
 * 2. Exalted / Own Vargottama: exalted/own in both D1 and D9 -> confirmed_strong (+1.5).
 * 3. Neutral Vargottama: same sign in D1 and D9 without debilitation -> confirmed_strong (+1.0).
 * 4. True Neecha Bhanga via D9: D1 debilitated, D9 exalted or own sign -> d9_redeemed (+1.2).
 * 5. False Promise (D9 Weakened): D1 strong, D9 debilitated or enemy -> d9_weakened (-1.0).
 * 6. Non-Vargottama Confirmed Weak: both charts debilitated or enemy in different signs -> confirmed_weak (-1.3).
 */
export function evaluateD1D9MutualConfirmation(
  view: DigestView,
  planetCode: string,
  isMature: boolean,
): D1D9ConfirmationResult {
  const d1 = view.planet('D1', planetCode);
  const d9 = view.planet('D9', planetCode);

  const d1Sign = d1?.sign ?? 'Unknown';
  const d1House = d1?.house ?? 1;
  const d1Dignity = (d1?.dignity ?? 'neutral').toLowerCase();

  const d9Sign = d9?.sign ?? 'Unknown';
  const d9House = d9?.house ?? 1;
  const d9Dignity = (d9?.dignity ?? 'neutral').toLowerCase();

  const isD1Debilitated = /debil|neecha|fall/i.test(d1Dignity);
  const isD9Debilitated = /debil|neecha|fall/i.test(d9Dignity);
  const isD1ExaltedOrOwn = /exalt|uchcha|own|swa|moola/i.test(d1Dignity);
  const isD9ExaltedOrOwn = /exalt|uchcha|own|swa|moola/i.test(d9Dignity);

  const isD1Strong = isD1ExaltedOrOwn || /friend/i.test(d1Dignity);
  const isD1Weak = isD1Debilitated || /enemy/i.test(d1Dignity);
  const isD9Strong = isD9ExaltedOrOwn || /friend/i.test(d9Dignity);
  const isD9Weak = isD9Debilitated || /enemy/i.test(d9Dignity);

  const isVargottama = d1Sign !== 'Unknown' && d1Sign === d9Sign;
  const isNeechaVargottama = isVargottama && (isD1Debilitated || isD9Debilitated);

  let verdict: D1D9ConfirmationVerdict = 'neutral';
  let scoreAdjustment = 0;
  let summary = '';
  const citations: string[] = [
    `D1.p.${planetCode}.h${d1House}:${d1Sign}(${d1Dignity})`,
    `D9.p.${planetCode}.h${d9House}:${d9Sign}(${d9Dignity})`,
  ];

  if (isNeechaVargottama) {
    citations.push(`varga:neecha_vargottama:${planetCode}:${d1Sign}`);
  } else if (isVargottama) {
    citations.push(`varga:vargottama:${planetCode}:${d1Sign}`);
  }

  if (!isMature) {
    // Pre-maturity (age <= threshold): D1 is primary baseline
    if (isNeechaVargottama) {
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.2;
      summary = `Early experience reflects persistent karmic friction and developmental resistance in ${d1Sign}.`;
    } else if (isD1Strong) {
      verdict = 'confirmed_strong';
      scoreAdjustment = 1.0;
      summary = `Operating primarily through solid foundation in the physical chart (${d1Sign}).`;
      if (isVargottama) {
        scoreAdjustment += 0.5;
        summary += ' Reinforced by harmonious alignment across charts.';
      }
    } else if (isD1Weak) {
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.0;
      summary = `Early experience reflects initial friction and developmental learning (${d1Sign}).`;
    } else {
      verdict = 'neutral';
      scoreAdjustment = 0;
      summary = `Balanced developmental placement in ${d1Sign}.`;
      if (isVargottama) {
        scoreAdjustment += 0.5;
        summary += ' Supported by structural alignment across charts.';
      }
    }
  } else {
    // Post-maturity (age > threshold): Full D1+D9 mutual validation
    if (isNeechaVargottama) {
      // Classical Drudha Karma: debilitation mirrored in the subtle inner chart
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.5;
      summary = `Afflicted by Neecha Vargottama (debilitated in both foundation and inner charts), indicating unyielding karmic resistance (Drudha Karma) requiring steady perseverance and protective boundaries.`;
    } else if (isVargottama) {
      if (isD1ExaltedOrOwn || isD9ExaltedOrOwn) {
        verdict = 'confirmed_strong';
        scoreAdjustment = 1.5;
        summary = `Exceptional strength through exalted or own-sign Vargottama placement in ${d1Sign}, providing unwavering stability and fruition.`;
      } else {
        verdict = 'confirmed_strong';
        scoreAdjustment = 1.0;
        summary = `Steady structural reinforcement through Vargottama placement in ${d1Sign}, harmonizing outer expression and inner values.`;
      }
    } else if (isD1Debilitated && isD9ExaltedOrOwn) {
      // True Neecha Bhanga via D9 elevation
      verdict = 'd9_redeemed';
      scoreAdjustment = 1.2;
      summary = `Early life hurdles or humility have transformed into earned depth, resilience, and hard-won mastery (Neecha Bhanga via inner chart).`;
      citations.push(`varga:neecha_bhanga_d9:${planetCode}`);
    } else if (isD1Strong && isD9Strong) {
      verdict = 'confirmed_strong';
      scoreAdjustment = 1.5;
      summary = `Confirmed strong across both life foundation and inner maturity, delivering reliable, lasting fulfillment.`;
    } else if (isD1Strong && isD9Weak) {
      verdict = 'd9_weakened';
      scoreAdjustment = -1.0;
      summary = `Initial promise in outer circumstances encounters subtle friction or testing upon deeper engagement (False Promise).`;
    } else if (isD1Weak && isD9Weak) {
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.3;
      summary = `Persistent friction requires clear boundary protection, conservative pacing, and realistic expectations.`;
    } else {
      verdict = 'neutral';
      scoreAdjustment = 0;
      summary = `Steady, adaptable placement with balanced support across both planes.`;
    }
  }

  return {
    planet: planetCode,
    isMature,
    d1Sign,
    d1House,
    d1Dignity,
    d9Sign,
    d9House,
    d9Dignity,
    isVargottama,
    isNeechaVargottama,
    verdict,
    scoreAdjustment,
    summary,
    citations,
  };
}

/**
 * Resolves active Mahadasha and Antardasha across all 40+ dasha systems.
 * Prioritizes certified applicable conditional nakshatra dashas, then universal Vimshottari, then Rasi dashas.
 */
export function resolveActiveMahadasha(
  activation: ActivationRow[],
  asOf: string,
): {
  mdRow: ActivationRow | null;
  adRow: ActivationRow | null;
} {
  // 1. Check certified applicable conditional nakshatra dashas first
  const condMd = activation.find(
    (r) => r.family === 'conditional' && r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  if (condMd) {
    const condAd =
      activation.find(
        (r) => r.system === condMd.system && r.level === 2 && r.from <= asOf && asOf < r.to,
      ) ?? null;
    return { mdRow: condMd, adRow: condAd };
  }

  // 2. Check universal Vimshottari clock
  const vimMd = activation.find(
    (r) => r.family === 'vimshottari' && r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  if (vimMd) {
    const vimAd =
      activation.find(
        (r) => r.family === 'vimshottari' && r.level === 2 && r.from <= asOf && asOf < r.to,
      ) ?? null;
    return { mdRow: vimMd, adRow: vimAd };
  }

  // 3. Fallback to rasi-based (Narayana / Chara)
  const rasiMd = activation.find(
    (r) => r.family === 'rasi' && r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  if (rasiMd) {
    const rasiAd =
      activation.find(
        (r) => r.system === rasiMd.system && r.level === 2 && r.from <= asOf && asOf < r.to,
      ) ?? null;
    return { mdRow: rasiMd, adRow: rasiAd };
  }

  // 4. Fallback to any other active level-1 dasha period (yogini, karaka, etc.)
  const anyMd = activation.find(
    (r) => r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  const anyAd = anyMd
    ? activation.find(
        (r) => r.system === anyMd.system && r.level === 2 && r.from <= asOf && asOf < r.to,
      ) ?? null
    : null;

  return { mdRow: anyMd ?? null, adRow: anyAd };
}

/**
 * Evaluates the running active dasha alongside departmental vargas and the running Tithi Pravesh year.
 */
export function evaluateActiveDashaWithVargaAndTP(params: {
  view: DigestView;
  activation: ActivationRow[];
  asOf: string;
  ageYears?: number | null;
  birthDate?: string | null;
  varga?: 'D10' | 'D7' | 'D9' | 'D30';
}): ActiveDashaAssessmentResult {
  const { view, activation, asOf, ageYears, birthDate, varga } = params;
  const gaps: string[] = [];

  // 1. Resolve age with environment-driven maturity helper
  const resolvedAge =
    typeof ageYears === 'number' && !isNaN(ageYears)
      ? ageYears
      : ageInYears(birthDate, asOf);

  if (resolvedAge === null) {
    gaps.push('dasha: native age unresolved; defaulting isMature to false');
  }
  const isMature = isAgeMatureD9(resolvedAge);

  // 2. Resolve active Mahadasha & Antardasha across all 40+ systems
  const { mdRow, adRow } = resolveActiveMahadasha(activation, asOf);
  const mdLord = mdRow?.lord ?? null;
  const adLord = adRow?.lord ?? null;

  // 3. Evaluate D1+D9 confirmation for both lords
  const mdConfirm = mdLord ? evaluateD1D9MutualConfirmation(view, mdLord, isMature) : null;
  const adConfirm = adLord ? evaluateD1D9MutualConfirmation(view, adLord, isMature) : null;

  // 4. Annual Tithi Pravesh Context via runningTithiPravesha
  const tpInfo: RunningTithiPravesha = runningTithiPravesha(view, asOf);
  let tithiPravesha: ActiveDashaAssessmentResult['tithiPravesha'] = null;

  // 5. Departmental Varga Routing (Natal + Stored Annual TP Varga)
  let vargaPlacement: ActiveDashaAssessmentResult['vargaPlacement'] = null;
  let tpAnnualVargaRow: AnnualRow | null = null;

  if (varga) {
    const mdVargaCard = mdLord ? view.planet(varga, mdLord) : null;
    const adVargaCard = adLord ? view.planet(varga, adLord) : null;

    if (tpInfo.year != null) {
      tpAnnualVargaRow = tpRowIn(view, tpInfo, varga);
    }

    let status: 'support' | 'test' | 'neutral' = 'neutral';
    if (mdVargaCard) {
      const isDignified = /exalt|own|moola|uchcha|swa|friend/i.test(mdVargaCard.dignity ?? '');
      const isAfflicted = /debil|neecha|fall|enemy/i.test(mdVargaCard.dignity ?? '');
      const isGoodHouse = [1, 4, 7, 10, 5, 9, 11].includes(mdVargaCard.house ?? 0);
      const isDusthana = [6, 8, 12].includes(mdVargaCard.house ?? 0);

      if (isDignified && isGoodHouse) status = 'support';
      else if (isAfflicted || isDusthana) status = 'test';
    }

    vargaPlacement = {
      varga,
      mahadashaLordCard: mdVargaCard,
      antardashaLordCard: adVargaCard,
      status,
      tpAnnualVargaRow,
    };
  }

  // 6. Multi-Clock Concordance Check (Five Clocks Ledger)
  // Candidate lords across all active clocks in force at asOf
  // Deduplicate by r.system and exclude only r.system === mdRow?.system
  const otherSystemsSeen = new Set<string>();
  const otherSystemLords: string[] = [];
  for (const r of activation) {
    if (r.level === 1 && r.from <= asOf && asOf < r.to && r.lord && r.system !== mdRow?.system) {
      if (!otherSystemsSeen.has(r.system)) {
        otherSystemsSeen.add(r.system);
        otherSystemLords.push(r.lord);
      }
    }
  }

  const candidateActiveLords = [
    mdLord,
    adLord,
    tpInfo.shortClock?.lord,
    ...otherSystemLords,
  ].filter(Boolean) as string[];

  const agreeingCount = mdLord ? candidateActiveLords.filter((l) => l === mdLord).length : 0;
  const concordance: 'confirmed' | 'leaning' | 'contested' =
    agreeingCount >= 3 ? 'confirmed' : agreeingCount === 2 ? 'leaning' : 'contested';

  // 7. Resolve Annual TP Stance (Fail-Closed on Unresolved Data)
  if (tpInfo.row && tpInfo.year) {
    // Exact schema property: yearLord?: string | null (matching AnnualRow.yearLord)
    const yearLord = tpInfo.row.yearLord?.trim() || 'Unknown';
    const isYearLordResolved = yearLord !== 'Unknown';

    if (!isYearLordResolved) {
      gaps.push(`annual: TP${tpInfo.year} yearLord missing or unresolved; failing closed to get_through stance`);
    }

    // Evaluate yearLord in D1+D9
    const yearLordConfirm = isYearLordResolved
      ? evaluateD1D9MutualConfirmation(view, yearLord, isMature)
      : null;

    // Inspect annual divisional TP rows and yearLord in natal varga
    const tpD9Row = tpRowIn(view, tpInfo, 'D9');
    const tpVargaRow = varga ? tpRowIn(view, tpInfo, varga) : null;
    const yearLordVargaCard = varga && isYearLordResolved ? view.planet(varga, yearLord) : null;

    const yearLordPlanet = isYearLordResolved ? view.planet('D1', yearLord) : null;
    const isYearLordDebilitated =
      yearLordPlanet != null && /debil|neecha|fall/i.test(yearLordPlanet.dignity ?? '');
    const isYearLordStrong =
      isYearLordResolved &&
      yearLordPlanet != null &&
      !isYearLordDebilitated &&
      !/enemy/i.test(yearLordPlanet.dignity ?? '');

    let yearLordEffectiveStrong = false;
    if (isYearLordResolved) {
      if (isMature && yearLordConfirm) {
        if (yearLordConfirm.verdict === 'confirmed_strong' || yearLordConfirm.verdict === 'd9_redeemed') {
          yearLordEffectiveStrong = true;
        } else if (yearLordConfirm.verdict === 'd9_weakened' || yearLordConfirm.verdict === 'confirmed_weak') {
          yearLordEffectiveStrong = false;
        } else {
          yearLordEffectiveStrong = isYearLordStrong && !isYearLordDebilitated;
        }
      } else {
        yearLordEffectiveStrong = isYearLordStrong && !isYearLordDebilitated;
      }
    }

    const isYearLordVargaAfflicted =
      yearLordVargaCard != null &&
      (/debil|neecha|fall/i.test(yearLordVargaCard.dignity ?? '') ||
        [6, 8, 12].includes(yearLordVargaCard.house ?? 0));

    let tpVargaAfflicted = false;
    if (tpVargaRow?.houses && isYearLordResolved) {
      for (const h of tpVargaRow.houses) {
        const occ = h.occupants?.find((o) => o.planet === yearLord);
        if (occ) {
          const debil = /debil|neecha|fall/i.test(occ.dignity ?? '');
          const dusthana = [6, 8, 12].includes(h.house);
          if (debil || dusthana) {
            tpVargaAfflicted = true;
            break;
          }
        }
      }
    }

    let tpD9Afflicted = false;
    if (tpD9Row?.houses && isYearLordResolved && isMature) {
      for (const h of tpD9Row.houses) {
        const occ = h.occupants?.find((o) => o.planet === yearLord);
        if (occ) {
          const debil = /debil|neecha|fall/i.test(occ.dignity ?? '');
          const dusthana = [6, 8, 12].includes(h.house);
          if (debil || dusthana) {
            tpD9Afflicted = true;
            break;
          }
        }
      }
    }

    // Fail-closed rule: require yearLord strength, supportive/neutral varga, and non-contested clocks for 'build'
    const stance: 'build' | 'get_through' =
      isYearLordResolved &&
      yearLordEffectiveStrong &&
      vargaPlacement?.status !== 'test' &&
      concordance !== 'contested' &&
      !isYearLordVargaAfflicted &&
      !tpVargaAfflicted &&
      !tpD9Afflicted
        ? 'build'
        : 'get_through';

    const startStr = tpInfo.from ?? (tpInfo.start ? tpInfo.start.slice(0, 10) : '');
    const endStr = tpInfo.to ?? (tpInfo.end ? tpInfo.end.slice(0, 10) : '');

    tithiPravesha = {
      year: tpInfo.year,
      start: startStr,
      end: endStr,
      yearLord,
      shortClock: tpInfo.shortClock,
      stance,
      yearLordConfirm,
      yearLordConfirmation: yearLordConfirm,
      tpD9Row,
      tpVargaRow,
      yearLordVargaCard,
    };
  } else {
    gaps.push('annual: no Tithi Pravesha year in force covering asOf');
  }

  // 8. Synthesize Narrative Context
  let narrativeContext = `Currently navigating a major life chapter governed by ${mdLord ?? 'primary forces'} (${mdRow?.system ?? 'active'} cycle).`;
  if (isMature) {
    narrativeContext += ` Having reached full karmic maturity (post-36), indications are mutually validated by the inner dharmic chart.`;
  }
  if (tithiPravesha) {
    narrativeContext += ` The current annual cycle adopts a ${tithiPravesha.stance === 'build' ? 'constructive building' : 'deliberate, steady pacing'} stance.`;
  }

  return {
    asOf,
    ageYears: resolvedAge,
    isMature,
    activeMahadasha: mdRow
      ? {
          system: mdRow.system,
          family: mdRow.family,
          lord: mdRow.lord ?? '',
          from: mdRow.from,
          to: mdRow.to,
          level: mdRow.level,
        }
      : null,
    activeAntardasha: adRow
      ? {
          system: adRow.system,
          family: adRow.family,
          lord: adRow.lord ?? '',
          from: adRow.from,
          to: adRow.to,
          level: adRow.level,
        }
      : null,
    d1d9Confirmation: {
      mahadashaLord: mdConfirm,
      antardashaLord: adConfirm,
    },
    vargaPlacement,
    tithiPravesha,
    multiClockConcordance: {
      concordance,
      agreeingClocks: agreeingCount,
    },
    narrativeContext,
    gaps,
  };
}
