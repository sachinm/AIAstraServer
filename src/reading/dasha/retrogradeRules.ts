/**
 * Classical Vedic Retrograde (*Vakra Graha*), *Ashtagati*, and *Cheshta Bala* Rules Engine (docs/reading-engine/77).
 *
 * Pure deterministic selection & reviewed vocabulary tables over stored engine fields (`PlanetCard`, `AnnualRow`,
 * `AnnualPlanetCard`). Zero astrological derivation in Node: speeds, retrograde states, 8-fold *Ashtagati*,
 * stationary flags, combustion orbs, *Cheshta Bala* virupas, and `vargaReckoning` are read strictly as emitted by
 * the engine.
 *
 * Every plain-English string exported for card Read/Short faces uses 100% digested everyday English with zero
 * Sanskrit, house/sign/chart terms, or internal engine names (`SOUL.md` & `AGENTS.md` §5). Technical citations are
 * kept strictly in `technicalEvidence` / `citations` for `Chart details` and Admin Research audit trails.
 */
import {
  getRetrogradeDignityModel,
  getRetrogradeScoreWeights,
  type RetrogradeDignityModel,
} from '../../config/env.js';
import type { AnnualPlanetCard, AnnualRow, PlanetCard } from '../digest/types.js';

export type VakraPlanetCode = 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa';

export type VakraRegime =
  | 'direct'
  | 'vakra'
  | 'uccha_vakra'
  | 'neecha_vakra'
  | 'swakshetra_vakra'
  | 'anuvakra'
  | 'vikala_stationary';

export type RetrogradeDignityRegime = VakraRegime;

export interface PlanetVakraPlaybook {
  planet: VakraPlanetCode;
  /** Plain-English gift phrase (zero chart jargon) */
  plainGift: string;
  /** Plain-English knot / friction phrase (zero chart jargon) */
  plainKnot: string;
  /** Plain-English counsel / operating posture for active periods (zero chart jargon) */
  plainCounsel: string;
  /** Plain-English annual return shift when ruling or prominent in the running year */
  plainAnnualShift: string;
  /** Technical summary for `Chart details` / Research audit only */
  technicalRule: string;
}

const VAKRA_PLANETS = new Set<string>(['Ma', 'Me', 'Ju', 'Ve', 'Sa']);

export const PLANET_VAKRA_PLAYBOOKS: Record<VakraPlanetCode, PlanetVakraPlaybook> = {
  Ma: {
    planet: 'Ma',
    plainGift: 'sustained second-wind stamina and strategic, calculated follow-through under pressure',
    plainKnot: 'bottled-up impatience or over-engineering a fight when direct action feels blocked',
    plainCounsel:
      'Channel energy into deliberate, second-pass execution and physical grounding rather than forcing an immediate confrontation.',
    plainAnnualShift:
      'Initiative this year rewards pacing, re-scoping effort, and finishing contested projects on the second push rather than rushing the start.',
    technicalRule: 'Vakri Kuja (BPHS Ch. 27 / Phaladeepika Ch. 4): high Cheshta Bala internalized drive; second-pass tactical endurance.',
  },
  Me: {
    planet: 'Me',
    plainGift: 'deep systems-level analysis, editing precision, and catching subtle flaws others overlook',
    plainKnot: 'over-revising decisions or running into mismatched assumptions in rushed verbal agreements',
    plainCounsel:
      'Put key terms in writing, allow space for a second review pass, and treat revisions as an advantage rather than a delay.',
    plainAnnualShift:
      'Plans, contracts, and technical work benefit from auditing, renegotiating terms, and refining drafts before locking commitments.',
    technicalRule: 'Vakri Budha (BPHS Ch. 27 / Saravali): iterative analytical cognition; contract/communication review discipline.',
  },
  Ju: {
    planet: 'Ju',
    plainGift: 'independent first-principles judgment and wisdom tested through lived proof rather than borrowed convention',
    plainKnot: 'questioning standard advice or outgrowing mentors before an alternative path is fully built',
    plainCounsel:
      'Trust frameworks you have verified firsthand and let growth compound after refining the plan rather than expanding prematurely.',
    plainAnnualShift:
      'Growth and advisory credibility consolidate through revisiting core strategy and proving value independently before scaling.',
    technicalRule: 'Vakri Guru (BPHS Ch. 27 / Phaladeepika): internalized dharmic authority; non-linear expansion after self-verification.',
  },
  Ve: {
    planet: 'Ve',
    plainGift: 'selective, deeply personal standards in loyalty, craft, and genuine emotional connection',
    plainKnot: 'slow-warming trust or revisiting unfinished relational expectations before feeling settled',
    plainCounsel:
      'Honor authentic standards over social performance, and favor honest repair or clear terms over impulsive commitments.',
    plainAnnualShift:
      'Relationships, creative work, and shared agreements deepen through clarifying expectations and reconnecting with what truly matters.',
    technicalRule: 'Vakri Shukra (BPHS Ch. 27 / Saravali): selective relational & aesthetic valuation; unconventional fidelity.',
  },
  Sa: {
    planet: 'Sa',
    plainGift: 'unshakeable structural mastery built by questioning hollow rules and rebuilding foundations properly',
    plainKnot: 'carrying extra self-imposed responsibility or having to restructure a commitment twice before it holds',
    plainCounsel:
      'Pace long-term obligations steadily, drop inherited busywork that lacks substance, and let durable authority form on the second build.',
    plainAnnualShift:
      'Long-term duties and structures call for auditing obligations, clearing backlog, and reinforcing foundations before taking on new weight.',
    technicalRule: 'Vakri Shani (BPHS Ch. 27 / Nadi Pending Karma): heightened Cheshta endurance; structural rework and karmic completion.',
  },
};

export function isTrueVakraCapable(planetCode: string | null | undefined): planetCode is VakraPlanetCode {
  return typeof planetCode === 'string' && VAKRA_PLANETS.has(planetCode);
}

export function getPlanetVakraPlaybook(planetCode: string | null | undefined): PlanetVakraPlaybook | null {
  if (!isTrueVakraCapable(planetCode)) return null;
  return PLANET_VAKRA_PLAYBOOKS[planetCode];
}

export interface VakraDignityEvaluation {
  isRetrograde: boolean;
  isStationary: boolean;
  motionState: string | null;
  cheshtaBala: number | null;
  isCheshtaStrong: boolean;
  regime: VakraRegime;
  effectiveRegime: VakraRegime;
  isNeechaVargottama: boolean;
  model: RetrogradeDignityModel;
  /** Additive adjustment applied on top of baseline D1/D9 dignity score */
  scoreDelta: number;
  /** Plain-English behavioral note (zero chart jargon) */
  plainNote: string | null;
  /** Technical audit citation for `Chart details` & Verifier */
  citations: string[];
}

/**
 * Evaluates a planet's retrograde, *Ashtagati* (`vakra`, `anuvakra`, `vikala`), and *Cheshta Bala* posture
 * alongside its `D1` and `D9` dignity without computing any astrological geometry in Node.
 */
export function evaluateVakraDignityRegime(params: {
  planet: string;
  d1Card: PlanetCard | null | undefined;
  d9Card?: PlanetCard | null | undefined;
  isMature?: boolean;
  isNeechaVargottama?: boolean;
  model?: RetrogradeDignityModel;
}): VakraDignityEvaluation;
export function evaluateVakraDignityRegime(
  planet: string,
  d1Card?: PlanetCard | null,
  d9Card?: PlanetCard | null,
  isMature?: boolean,
  isNeechaVargottama?: boolean,
  model?: RetrogradeDignityModel,
): VakraDignityEvaluation;
export function evaluateVakraDignityRegime(
  planetOrParams:
    | string
    | {
        planet: string;
        d1Card: PlanetCard | null | undefined;
        d9Card?: PlanetCard | null | undefined;
        isMature?: boolean;
        isNeechaVargottama?: boolean;
        model?: RetrogradeDignityModel;
      },
  d1CardPos?: PlanetCard | null,
  d9CardPos?: PlanetCard | null,
  isMaturePos?: boolean,
  isNeechaVargottamaPos?: boolean,
  modelPos?: RetrogradeDignityModel,
): VakraDignityEvaluation {
  const isObjCall = typeof planetOrParams === 'object' && planetOrParams !== null;
  const planet = isObjCall ? planetOrParams.planet : planetOrParams;
  const d1Card = isObjCall ? planetOrParams.d1Card : d1CardPos;
  const d9Card = isObjCall ? planetOrParams.d9Card : d9CardPos;
  const isMature = isObjCall ? Boolean(planetOrParams.isMature) : Boolean(isMaturePos ?? true);

  const d1Dig = (d1Card?.dignity ?? 'neutral').toLowerCase();
  const d9Dig = (d9Card?.dignity ?? 'neutral').toLowerCase();
  const isD1Debil = /debil|neecha|fall/i.test(d1Dig);
  const isD9Debil = /debil|neecha|fall/i.test(d9Dig);
  const derivedNV = Boolean(d1Card?.sign && d9Card?.sign && d1Card.sign === d9Card.sign && isD1Debil && isD9Debil);

  const isNeechaVargottama = isObjCall
    ? Boolean(planetOrParams.isNeechaVargottama ?? derivedNV)
    : Boolean(isNeechaVargottamaPos ?? derivedNV);

  const model = (isObjCall ? planetOrParams.model : modelPos) ?? getRetrogradeDignityModel();
  const weights = getRetrogradeScoreWeights();

  const isRetrograde = isTrueVakraCapable(planet) && d1Card?.retro === true;
  const isStationary = isTrueVakraCapable(planet) && d1Card?.isStationary === true;
  const motionState = d1Card?.motionState ?? (isStationary ? 'vikala' : isRetrograde ? 'vakra' : null);
  const cheshtaBala =
    d1Card?.cheshtaBala ??
    d1Card?.shadbalaComponents?.cheshta ??
    null;
  const isCheshtaStrong =
    (typeof cheshtaBala === 'number' && cheshtaBala >= weights.cheshtaStrongVirupas) || isRetrograde;

  const citations: string[] = [];
  if (!isRetrograde && !isStationary) {
    if (typeof cheshtaBala === 'number' && cheshtaBala >= weights.cheshtaStrongVirupas) {
      citations.push(`motion:${planet}:direct_high_cheshta:${cheshtaBala.toFixed(1)}`);
    }
    return {
      isRetrograde: false,
      isStationary: false,
      motionState,
      cheshtaBala,
      isCheshtaStrong,
      regime: 'direct',
      effectiveRegime: 'direct',
      isNeechaVargottama: Boolean(isNeechaVargottama),
      model,
      scoreDelta: 0,
      plainNote: null,
      citations,
    };
  }

  const isD1Exalted = /exalt|uchcha/i.test(d1Dig);
  const isD1Own = /own|swa|moola/i.test(d1Dig);
  const isD1Debilitated = /debil|neecha|fall/i.test(d1Dig);
  const isD9Supportive = !/debil|neecha|fall|enemy/i.test(d9Dig);

  let regime: VakraRegime = 'vakra';
  if (isStationary || motionState === 'vikala') {
    regime = 'vikala_stationary';
  } else if (isD1Exalted) {
    regime = 'uccha_vakra';
  } else if (isD1Debilitated) {
    regime = 'neecha_vakra';
  } else if (isD1Own) {
    regime = 'swakshetra_vakra';
  } else if (motionState === 'anuvakra') {
    regime = 'anuvakra';
  }

  citations.push(`motion:${planet}:${regime}${motionState ? `:${motionState}` : ''}`);
  if (typeof cheshtaBala === 'number') {
    citations.push(`bala:cheshta:${planet}:${cheshtaBala.toFixed(1)}`);
  }
  if (d9Card?.vargaReckoning === 'reverse') {
    citations.push(`varga:D9:${planet}:reverse_reckoning`);
  }
  if (d9Card?.vargaSandhi === true) {
    citations.push(`varga:D9:${planet}:varga_sandhi`);
  }

  const pb = getPlanetVakraPlaybook(planet);
  let scoreDelta = 0;
  let plainNote: string | null = null;

  if (regime === 'vikala_stationary') {
    scoreDelta = 0.15;
    plainNote = pb
      ? `Concentrated turning-point intensity shapes this area: ${pb.plainCounsel}`
      : 'Concentrated turning-point intensity calls for deliberate, measured decisions.';
  } else if (isNeechaVargottama) {
    // Never invert Neecha Vargottama into effortless fortune: fierce effort exists, but structural friction stays real.
    scoreDelta = 0;
    citations.push(`vakra:guard:neecha_vargottama_preserved:${planet}`);
    plainNote =
      'Strong inner drive pushes back against recurring resistance here, requiring steady boundaries rather than forcing quick wins.';
  } else if (regime === 'neecha_vakra') {
    if (model === 'uttara_kalamrita_strict') {
      scoreDelta = isMature && !isD9Supportive ? 0.9 : 1.6;
    } else {
      scoreDelta = isMature && !isD9Supportive ? weights.neechaUplift * 0.5 : weights.neechaUplift;
    }
    plainNote = pb
      ? `Initial setbacks here spark resilient second-attempt breakthroughs through ${pb.plainGift}.`
      : 'Initial setbacks spark resilient second-attempt breakthroughs once restructured.';
  } else if (regime === 'uccha_vakra') {
    if (model === 'uttara_kalamrita_strict') {
      scoreDelta = -1.6;
    } else {
      scoreDelta = weights.ucchaModeration;
    }
    plainNote = pb
      ? `High capability delivers best on a refined, non-linear second pass rather than a rushed first push — ${pb.plainCounsel}`
      : 'High capability delivers best through patient second-pass refinement rather than expecting linear ease.';
  } else if (regime === 'swakshetra_vakra') {
    scoreDelta = 0.25;
    plainNote = pb
      ? `Self-directed standards and ${pb.plainGift} anchor durable results on your own terms.`
      : 'Self-directed standards anchor durable results built on your own terms.';
  } else if (regime === 'anuvakra') {
    scoreDelta = 0.1;
    plainNote = pb
      ? `Progress involves circling back to finish an earlier chapter first: ${pb.plainCounsel}`
      : 'Progress involves circling back to complete unfinished business before moving ahead.';
  } else {
    scoreDelta = 0.15;
    plainNote = pb
      ? `Outcomes mature through iterative review and ${pb.plainGift}.`
      : 'Outcomes mature through deliberate review and second-pass persistence.';
  }

  return {
    isRetrograde,
    isStationary,
    motionState,
    cheshtaBala,
    isCheshtaStrong,
    regime,
    effectiveRegime: regime,
    isNeechaVargottama: Boolean(isNeechaVargottama),
    model,
    scoreDelta: Math.round(scoreDelta * 100) / 100,
    plainNote,
    citations,
  };
}

/**
 * Resolves a planet's placement & motion inside a stored `AnnualRow` (`TP` or `VP`),
 * reading `row.planets?.[code]` first and falling back to `row.houses[].occupants`.
 */
export function annualPlanetMotion(
  row: AnnualRow | null | undefined,
  planetCode: string | null | undefined,
): {
  retro: boolean;
  isStationary: boolean;
  combust: boolean;
  motionState: string | null;
  house: number | null;
  dignity: string | null;
  card: AnnualPlanetCard | null;
} {
  if (!row || !planetCode) {
    return { retro: false, isStationary: false, combust: false, motionState: null, house: null, dignity: null, card: null };
  }
  const directCard = row.planets?.[planetCode] ?? null;
  if (directCard) {
    return {
      retro: directCard.retro === true,
      isStationary: directCard.isStationary === true,
      combust: directCard.combust === true,
      motionState: directCard.motionState ?? null,
      house: directCard.house,
      dignity: directCard.dignity,
      card: directCard,
    };
  }
  for (const h of row.houses ?? []) {
    const occ = h.occupants?.find((o) => o.planet === planetCode);
    if (occ) {
      return {
        retro: occ.retro === true,
        isStationary: occ.motionState === 'vikala',
        combust: occ.combust === true,
        motionState: occ.motionState ?? null,
        house: h.house,
        dignity: occ.dignity,
        card: null,
      };
    }
  }
  return { retro: false, isStationary: false, combust: false, motionState: null, house: null, dignity: null, card: null };
}
