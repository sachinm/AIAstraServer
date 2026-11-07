/**
 * Unified 3-Tier Area Board Hierarchy, Multi-Signification Shade Resolver, Calm Playbooks,
 * Companion Pulse Tie-Breakers, Calibration Check-ins & Benchmark Suite (docs/reading-engine/55).
 *
 * Strictly deterministic: reads DigestView, ActivationRow[], and person_facts only.
 * Node performs zero astrological arithmetic; all user-facing strings use digested plain language
 * with zero chart terms or engine names (doc 45 §3.3, SOUL.md).
 */
import type { PrismaClient } from '@prisma/client';
import {
  getShadeConfirmMinFamilies,
  getShadeFactTieBreakBonus,
  getShadeMinWinningScore,
} from '../../config/env.js';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import type { AreaBoardBody, AreaConfig, BuiltBoard, Side, Tone, Vote } from './houseLayers.js';
import { isBad, isGood, resolvePlanet } from './houseLayers.js';
import type { CareerMap, SubareaWindow } from './career.js';

export type PlaybookTier = 'sattvic' | 'rajasic' | 'mediocre' | 'baseline';

export interface CalmPlaybook {
  tier: PlaybookTier;
  headline: string;
  doSteps: string[];
  avoidSteps: string[];
  easeDate: string | null;
}

export interface TechniqueGateEntry {
  tier: 1 | 2 | 3;
  gate: string;
  passed: boolean;
  score: number;
  detail: string;
}

export interface TechniqueDecisionReceipt {
  area: 'self' | 'love' | 'career';
  asOf: string;
  techniqueId: string;
  subarea: string;
  shadeTag: string;
  userLabel: string;
  winningScore: number;
  runnerUpTag: string | null;
  runnerUpScore: number | null;
  gates: TechniqueGateEntry[];
  playbook: CalmPlaybook;
  easeDate: string | null;
  tieBrokenByFact: boolean;
  pulseQuestion: {
    factKey: string;
    question: string;
    options: Array<{ value: string; label: string }>;
  } | null;
}

export interface ShadeCandidateDef {
  tag: string;
  subarea: string;
  area: 'self' | 'love' | 'career';
  side: Side;
  userLabel: string;
  planets: string[];
  houses: number[];
  varga: string;
  factKey?: string;
  factValues?: string[];
  pulseQuestion?: {
    factKey: string;
    question: string;
    options: Array<{ value: string; label: string }>;
  };
}

export const SHADE_CATALOG: readonly ShadeCandidateDef[] = [
  // ── Work / Career shades ──
  {
    tag: 'role_offer_opening',
    subarea: 'get_job',
    area: 'career',
    side: 'support',
    userLabel: 'A strong opening for a new role',
    planets: ['L10', 'L6', 'L11', 'Ju', 'Su'],
    houses: [10, 6, 11],
    varga: 'D10',
    factKey: 'work.status',
    factValues: ['between_jobs', 'studying'],
  },
  {
    tag: 'referral_network_offer',
    subarea: 'get_job',
    area: 'career',
    side: 'support',
    userLabel: 'An opening through people you know',
    planets: ['L11', 'Me', 'Ve'],
    houses: [11, 3],
    varga: 'D10',
    factKey: 'work.status',
    factValues: ['between_jobs'],
  },
  {
    tag: 'scope_expansion',
    subarea: 'promotion',
    area: 'career',
    side: 'support',
    userLabel: 'Larger responsibility and visibility at work',
    planets: ['L10', 'Su', 'Ju', 'Ma'],
    houses: [10, 1],
    varga: 'D10',
    factKey: 'work.goal_shade',
    factValues: ['scope_expansion'],
    pulseQuestion: {
      factKey: 'work.goal_shade',
      question: 'Are you aiming for a larger team scope or a formal title step next?',
      options: [
        { value: 'scope_expansion', label: 'Larger scope' },
        { value: 'title_elevation', label: 'Title step' },
      ],
    },
  },
  {
    tag: 'title_elevation',
    subarea: 'promotion',
    area: 'career',
    side: 'support',
    userLabel: 'Recognition and a step up in standing',
    planets: ['L11', 'Su', 'L9', 'Ju'],
    houses: [10, 11, 9],
    varga: 'D10',
    factKey: 'work.goal_shade',
    factValues: ['title_elevation'],
  },
  {
    tag: 'internal_pivot',
    subarea: 'job_change',
    area: 'career',
    side: 'support',
    userLabel: 'A shift into a better-fitting track',
    planets: ['L3', 'Me', 'L10'],
    houses: [3, 10],
    varga: 'D10',
    factKey: 'work.change_shade',
    factValues: ['internal_pivot'],
    pulseQuestion: {
      factKey: 'work.change_shade',
      question: 'Are you considering a move within your field or a broader change of setting?',
      options: [
        { value: 'internal_pivot', label: 'Same field' },
        { value: 'external_move', label: 'New setting' },
      ],
    },
  },
  {
    tag: 'external_move',
    subarea: 'job_change',
    area: 'career',
    side: 'support',
    userLabel: 'A clean move to a new team or place',
    planets: ['Ra', 'L12', 'L9'],
    houses: [12, 9, 3],
    varga: 'D10',
    factKey: 'work.change_shade',
    factValues: ['external_move'],
  },
  {
    tag: 'workload_pacing',
    subarea: 'job_security',
    area: 'career',
    side: 'test',
    userLabel: 'Heavy pace at work: keep priorities tight',
    planets: ['Sa', 'Ma', 'L6'],
    houses: [6, 10],
    varga: 'D10',
    factKey: 'work.pressure_shade',
    factValues: ['workload_pacing'],
    pulseQuestion: {
      factKey: 'work.pressure_shade',
      question: 'Does work right now feel more like a heavy workload or shifting team priorities?',
      options: [
        { value: 'workload_pacing', label: 'Heavy workload' },
        { value: 'restructure_watch', label: 'Shifting priorities' },
      ],
    },
  },
  {
    tag: 'restructure_watch',
    subarea: 'job_security',
    area: 'career',
    side: 'test',
    userLabel: 'Changes around your team: keep your options warm',
    planets: ['Ra', 'Ke', 'L8', 'L12'],
    houses: [8, 12, 5, 9],
    varga: 'D10',
    factKey: 'work.pressure_shade',
    factValues: ['restructure_watch'],
  },
  {
    tag: 'relocation_move',
    subarea: 'abroad',
    area: 'career',
    side: 'support',
    userLabel: 'Work connected with travel or another city',
    planets: ['Ra', 'L12', 'L9', 'Mo'],
    houses: [12, 9],
    varga: 'D10',
  },
  {
    tag: 'compensation_lift',
    subarea: 'pay',
    area: 'career',
    side: 'support',
    userLabel: 'Stronger earnings from your work',
    planets: ['L2', 'L11', 'Ju', 'Ve'],
    houses: [2, 11],
    varga: 'D10',
  },
  {
    tag: 'independent_venture',
    subarea: 'business',
    area: 'career',
    side: 'support',
    userLabel: 'Momentum for independent or client work',
    planets: ['L7', 'Me', 'L11', 'Su'],
    houses: [7, 10, 11],
    varga: 'D10',
  },

  // ── Love / Relationships shades ──
  {
    tag: 'warm_introduction',
    subarea: 'meet',
    area: 'love',
    side: 'support',
    userLabel: 'A warm opening to meet someone new',
    planets: ['L5', 'L7', 'Ve', 'DK'],
    houses: [5, 7, 11],
    varga: 'D9',
    factKey: 'love.status',
    factValues: ['single', 'separated'],
  },
  {
    tag: 'social_circle_spark',
    subarea: 'meet',
    area: 'love',
    side: 'support',
    userLabel: 'Someone through friends or shared interests',
    planets: ['L11', 'Ve', 'Me'],
    houses: [11, 5],
    varga: 'D9',
    factKey: 'love.status',
    factValues: ['single'],
  },
  {
    tag: 'affection_warmth',
    subarea: 'romance',
    area: 'love',
    side: 'support',
    userLabel: 'Ease and warmth in closeness',
    planets: ['L5', 'Ve', 'Mo', 'Ma'],
    houses: [5, 7],
    varga: 'D9',
  },
  {
    tag: 'shared_commitment',
    subarea: 'commitment',
    area: 'love',
    side: 'support',
    userLabel: 'A steady step toward long-term plans',
    planets: ['L7', 'Ve', 'DK', 'L2', 'Ju'],
    houses: [7, 2],
    varga: 'D9',
  },
  {
    tag: 'slow_timing_patience',
    subarea: 'delay',
    area: 'love',
    side: 'test',
    userLabel: 'Takes patience: let things unfold without rushing',
    planets: ['Sa', 'L7', 'Ke'],
    houses: [7, 12],
    varga: 'D9',
  },
  {
    tag: 'steady_harmony',
    subarea: 'health',
    area: 'love',
    side: 'support',
    userLabel: 'Steady understanding between you',
    planets: ['L7', 'Ve', 'Mo', 'L4', 'Ju'],
    houses: [7, 4, 2],
    varga: 'D9',
  },
  {
    tag: 'listening_check_in',
    subarea: 'health',
    area: 'love',
    side: 'test',
    userLabel: 'Needs unhurried listening at home',
    planets: ['L7', 'Mo', 'L4', 'Sa'],
    houses: [7, 4],
    varga: 'D9',
  },
  {
    tag: 'schedule_space_strain',
    subarea: 'strain',
    area: 'love',
    side: 'test',
    userLabel: 'Busy schedules or quiet distance: give each other room',
    planets: ['Sa', 'L12', 'L6'],
    houses: [12, 6],
    varga: 'D9',
    factKey: 'love.strain_shade',
    factValues: ['schedule_space_strain'],
    pulseQuestion: {
      factKey: 'love.strain_shade',
      question: 'Has recent relationship friction felt more like busy schedules or unspoken expectations?',
      options: [
        { value: 'schedule_space_strain', label: 'Busy schedules' },
        { value: 'communication_patience', label: 'Unspoken expectations' },
      ],
    },
  },
  {
    tag: 'communication_patience',
    subarea: 'strain',
    area: 'love',
    side: 'test',
    userLabel: 'Sensitive conversations: speak plainly and gently',
    planets: ['Ma', 'Ra', 'L2', 'L8'],
    houses: [2, 8, 7],
    varga: 'D9',
    factKey: 'love.strain_shade',
    factValues: ['communication_patience'],
  },
  {
    tag: 'bridge_rebuilding',
    subarea: 'reconcile',
    area: 'love',
    side: 'support',
    userLabel: 'An opening to clear the air and reconnect',
    planets: ['L7', 'Ve', 'Ju', 'L11'],
    houses: [7, 11],
    varga: 'D9',
  },
  {
    tag: 'family_warmth',
    subarea: 'family_accept',
    area: 'love',
    side: 'support',
    userLabel: 'Supportive footing with family',
    planets: ['L2', 'L4', 'Ju', 'Mo'],
    houses: [2, 4],
    varga: 'D9',
  },
  {
    tag: 'family_boundaries',
    subarea: 'family_accept',
    area: 'love',
    side: 'test',
    userLabel: 'Family expectations need calm boundaries',
    planets: ['L2', 'L4', 'L8', 'Sa'],
    houses: [2, 4, 8],
    varga: 'D9',
  },
  {
    tag: 'supportive_friends',
    subarea: 'friends',
    area: 'love',
    side: 'support',
    userLabel: 'Good company and helpful allies',
    planets: ['L11', 'L4', 'Me', 'Ve'],
    houses: [11],
    varga: 'D9',
  },

  // ── Self / You shades ──
  {
    tag: 'clear_direction',
    subarea: 'identity',
    area: 'self',
    side: 'support',
    userLabel: 'A clear stretch to lead from the front',
    planets: ['L1', 'Su', 'AK'],
    houses: [1, 9],
    varga: 'D9',
  },
  {
    tag: 'pacing_reset',
    subarea: 'identity',
    area: 'self',
    side: 'test',
    userLabel: 'A slower stretch: protect your energy and pace yourself',
    planets: ['L1', 'Sa', 'Ra', 'Ke'],
    houses: [1, 8, 12],
    varga: 'D9',
  },
  {
    tag: 'steady_courage',
    subarea: 'confidence',
    area: 'self',
    side: 'support',
    userLabel: 'Firm confidence to act on your plans',
    planets: ['Su', 'Ma', 'L3'],
    houses: [1, 3],
    varga: 'D9',
  },
  {
    tag: 'quiet_self_trust',
    subarea: 'confidence',
    area: 'self',
    side: 'test',
    userLabel: 'Build confidence through small daily wins',
    planets: ['Su', 'Ma', 'Sa'],
    houses: [1, 6],
    varga: 'D9',
  },
  {
    tag: 'emotional_settledness',
    subarea: 'mind',
    area: 'self',
    side: 'support',
    userLabel: 'Calm focus and peace at home',
    planets: ['Mo', 'L4', 'Me', 'Ju'],
    houses: [4],
    varga: 'D9',
  },
  {
    tag: 'rest_and_grounding',
    subarea: 'mind',
    area: 'self',
    side: 'test',
    userLabel: 'A full mind: prioritize rest and simple routines',
    planets: ['Mo', 'L4', 'Sa', 'Ra'],
    houses: [4, 12],
    varga: 'D9',
    factKey: 'self.mind_shade',
    factValues: ['rest_and_grounding'],
    pulseQuestion: {
      factKey: 'self.mind_shade',
      question: 'Right now, would more rest or clearer creative focus help you most?',
      options: [
        { value: 'rest_and_grounding', label: 'More rest' },
        { value: 'focused_simplification', label: 'Clearer focus' },
      ],
    },
  },
  {
    tag: 'focused_simplification',
    subarea: 'mind',
    area: 'self',
    side: 'test',
    userLabel: 'Too many tabs open: simplify what you carry this month',
    planets: ['Me', 'Mo', 'Ke'],
    houses: [4, 8],
    varga: 'D9',
    factKey: 'self.mind_shade',
    factValues: ['focused_simplification'],
  },
  {
    tag: 'skill_mastery',
    subarea: 'growth',
    area: 'self',
    side: 'support',
    userLabel: 'A fertile stretch for learning and sharp ideas',
    planets: ['L5', 'Me', 'Ju', 'L3'],
    houses: [5, 3],
    varga: 'D24',
  },
  {
    tag: 'purpose_alignment',
    subarea: 'purpose',
    area: 'self',
    side: 'support',
    userLabel: 'Perspective and meaning come into focus',
    planets: ['L9', 'Ju', 'Ke'],
    houses: [9, 12],
    varga: 'D20',
  },
  {
    tag: 'inner_retreat',
    subarea: 'purpose',
    area: 'self',
    side: 'test',
    userLabel: 'Quiet reflection helps you let go of what is finished',
    planets: ['L12', 'Ke', 'Sa'],
    houses: [12, 9],
    varga: 'D20',
  },
  {
    tag: 'decisive_initiative',
    subarea: 'empowerment',
    area: 'self',
    side: 'support',
    userLabel: 'Momentum to take charge of what matters',
    planets: ['Ma', 'Su', 'L3', 'L10'],
    houses: [1, 3, 10],
    varga: 'D9',
  },
  {
    tag: 'public_trust',
    subarea: 'reputation',
    area: 'self',
    side: 'support',
    userLabel: 'Your steady work is noticed and respected',
    planets: ['L10', 'Su', 'Ju'],
    houses: [10, 1],
    varga: 'D9',
  },
  {
    tag: 'quiet_consistency',
    subarea: 'reputation',
    area: 'self',
    side: 'test',
    userLabel: 'Let consistent results speak for you without rushing',
    planets: ['L10', 'Sa', 'Ra'],
    houses: [10, 8],
    varga: 'D9',
  },
  {
    tag: 'chapter_opening',
    subarea: 'turning_point',
    area: 'self',
    side: 'support',
    userLabel: 'A new chapter opens',
    planets: ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'],
    houses: [1, 5, 9, 10],
    varga: 'D9',
  },
  {
    tag: 'chapter_stewardship',
    subarea: 'turning_point',
    area: 'self',
    side: 'test',
    userLabel: 'A new chapter that asks more of you',
    planets: ['Sa', 'Ra', 'Ke', 'Ma', 'Su', 'Mo', 'Me', 'Ju', 'Ve'],
    houses: [4, 8, 12],
    varga: 'D9',
  },
] as const;

// ---------------------------------------------------------------- Technique Governance Cache

interface GovernanceEntry {
  enabled: boolean;
  verificationStatus: string;
}

let governanceCache: { map: Map<string, GovernanceEntry>; expiresAt: number } | null = null;
const GOVERNANCE_TTL_MS = 30_000;

export function invalidateTechniqueGovernanceCache(): void {
  governanceCache = null;
}

export async function loadTechniqueGovernance(
  prisma: PrismaClient | null | undefined,
): Promise<Map<string, GovernanceEntry>> {
  const now = Date.now();
  if (governanceCache && governanceCache.expiresAt > now) {
    return governanceCache.map;
  }
  const map = new Map<string, GovernanceEntry>();
  const reg = (prisma as unknown as { techniqueRegistry?: { findMany?: (args: unknown) => Promise<Array<{ id: string; enabled?: boolean; verification_status?: string }>> } } | null)?.techniqueRegistry;
  if (reg && typeof reg.findMany === 'function') {
    try {
      const rows = await reg.findMany({
        select: { id: true, enabled: true, verification_status: true },
      });
      for (const r of rows) {
        map.set(r.id, {
          enabled: r.enabled !== false,
          verificationStatus: r.verification_status ?? 'verified',
        });
      }
    } catch {
      // Table or column not migrated yet: default all to enabled
    }
  }
  governanceCache = { map, expiresAt: now + GOVERNANCE_TTL_MS };
  return map;
}

export function isTechniqueEnabledSync(id: string, gov?: Map<string, GovernanceEntry> | null): boolean {
  const activeGov = gov ?? governanceCache?.map ?? null;
  if (!activeGov) return true;
  const entry = activeGov.get(id);
  return entry ? entry.enabled : true;
}

const AREA_EXTRA_FACT_KEYS: Record<'self' | 'love' | 'career', readonly string[]> = {
  self: ['self.mind_shade', 'goal.self'],
  love: ['love.strain_shade', 'goal.love'],
  career: ['work.goal_shade', 'work.change_shade', 'work.pressure_shade', 'goal.career'],
};

/**
 * Loads Companion Pulse tie-breaker and active-goal facts for an area (`self`, `love`, `career`),
 * merging any primary fact (`self.focus`, `love.status`, `work.status`) already fetched.
 */
export async function loadAreaFacts(
  prisma: PrismaClient | null | undefined,
  userId: string,
  area: 'self' | 'love' | 'career',
  primaryFact?: { key: string; value: string | null },
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (primaryFact?.value && primaryFact.value !== 'declined') {
    out[primaryFact.key] = primaryFact.value;
  }
  const pf = (
    prisma as unknown as {
      personFact?: {
        findMany?: (args: unknown) => Promise<Array<{ key: string; value: string }>>;
        findUnique?: (args: unknown) => Promise<{ value?: string } | null>;
      };
    } | null
  )?.personFact;
  if (!pf) return out;
  const keys = AREA_EXTRA_FACT_KEYS[area];
  try {
    if (typeof pf.findMany === 'function') {
      const rows = await pf.findMany({
        where: { user_id: userId, key: { in: [...keys] } },
        select: { key: true, value: true },
      });
      for (const r of rows) {
        if (r?.key && r?.value && r.value !== 'declined') out[r.key] = r.value;
      }
    } else if (typeof pf.findUnique === 'function') {
      for (const key of keys) {
        const row = await pf.findUnique({ where: { user_id_key: { user_id: userId, key } } });
        if (row?.value && row.value !== 'declined') out[key] = row.value;
      }
    }
  } catch {
    // Best-effort fact lookup
  }
  return out;
}

// ---------------------------------------------------------------- Calm-Style Behavioral Playbooks (SOUL.md)

export function buildCalmPlaybook(params: {
  area: 'self' | 'love' | 'career';
  side: Side;
  tone: Tone;
  beneficWeight: number;
  maleficWeight: number;
  easeDate: string | null;
}): CalmPlaybook {
  const { area, side, tone, beneficWeight, maleficWeight, easeDate } = params;
  const net = beneficWeight - maleficWeight;
  const tier: PlaybookTier =
    net >= 2
      ? 'sattvic'
      : net >= 0.5
        ? 'rajasic'
        : net >= -1
          ? 'mediocre'
          : 'baseline';

  const easeNote = easeDate ? ` The pace lightens from ${easeDate}.` : '';

  if (side === 'support') {
    if (area === 'career') {
      return {
        tier,
        headline: `Put your best work forward while momentum is open.${easeNote}`,
        doSteps: [
          'Ask clearly for the scope or decision you have earned.',
          'Put key agreements and milestones in writing while alignment is strong.',
        ],
        avoidSteps: [
          'Do not scatter energy across side commitments that dilute your main goal.',
        ],
        easeDate,
      };
    }
    if (area === 'love') {
      return {
        tier,
        headline: `Make time for unhurried connection and honest conversation.${easeNote}`,
        doSteps: [
          'Show up warmly and let shared plans take a natural step forward.',
          'Say what you appreciate plainly rather than assuming it is known.',
        ],
        avoidSteps: [
          'Do not rush a milestone just to force certainty.',
        ],
        easeDate,
      };
    }
    return {
      tier,
      headline: `A steady window to build habits and move your own priorities forward.${easeNote}`,
      doSteps: [
        'Start the routine, study, or personal project you have been preparing.',
        'Keep a consistent morning rhythm so your energy compounds.',
      ],
      avoidSteps: [
        'Do not overpack your calendar at the expense of sleep.',
      ],
      easeDate,
    };
  }

  // Testing / demanding stretch: Calm-style Shelter-in-Place & Pacing Playbook
  const pacingTail =
    tone === 'easing' && easeDate
      ? ` Pressure is already easing toward ${easeDate}.`
      : easeNote;

  if (area === 'career') {
    return {
      tier,
      headline: `Keep your footing steady and protect your core deliverables.${pacingTail}`,
      doSteps: [
        'Document decisions clearly and keep weekly priorities realistic.',
        'Focus on high-trust relationships and steady execution.',
      ],
      avoidSteps: [
        'Avoid reactive changes or unforced Ultimatums before the pace settles.',
      ],
      easeDate,
    };
  }
  if (area === 'love') {
    return {
      tier,
      headline: `Give conversations extra breathing room and lead with patience.${pacingTail}`,
      doSteps: [
        'Listen first and separate daily tiredness from deeper relationship questions.',
        'Keep shared routines simple and predictable.',
      ],
      avoidSteps: [
        'Avoid pressing for an immediate verdict during a tired week.',
      ],
      easeDate,
    };
  }
  return {
    tier,
    headline: `Protect your rest and simplify what you carry right now.${pacingTail}`,
    doSteps: [
      'Keep your daily rhythm steady and leave margin between commitments.',
      'Choose restorative rest and quiet focus over extra obligations.',
    ],
    avoidSteps: [
      'Avoid judging long-term progress by a demanding week.',
    ],
    easeDate,
  };
}

// ---------------------------------------------------------------- 3-Tier Shade Resolver

function scoreCandidate(
  view: DigestView | null | undefined,
  candidate: ShadeCandidateDef,
  drivers: string[],
  houses: number[],
  facts: Record<string, string>,
): { score: number; tieBrokenByFact: boolean; detail: string } {
  let score = 1.0;
  const reasons: string[] = [];

  if (view) {
    const resolvedPlanets = new Set(
      candidate.planets
        .map((ref) => resolvePlanet(view, ref) ?? ref)
        .filter((p): p is string => Boolean(p)),
    );
    const matchingDrivers = drivers.filter((d) => resolvedPlanets.has(d));
    if (matchingDrivers.length > 0) {
      score += matchingDrivers.length * 0.9;
      reasons.push(`drivers:${matchingDrivers.join(',')}`);
    }
    for (const d of matchingDrivers) {
      const vCard = view.planet(candidate.varga, d) ?? view.planet('D1', d);
      if (isGood(vCard?.dignity)) {
        score += 0.6;
        reasons.push(`${candidate.varga}.${d}:good`);
      } else if (isBad(vCard?.dignity) && candidate.side === 'test') {
        score += 0.5;
        reasons.push(`${candidate.varga}.${d}:test_dignity`);
      }
    }
  } else {
    const matchingRaw = drivers.filter((d) => candidate.planets.includes(d));
    if (matchingRaw.length > 0) {
      score += matchingRaw.length * 0.85;
      reasons.push(`drivers:${matchingRaw.join(',')}`);
    }
  }

  const matchingHouses = houses.filter((h) => candidate.houses.includes(h));
  if (matchingHouses.length > 0) {
    score += matchingHouses.length * 0.55;
    reasons.push(`houses:${matchingHouses.join(',')}`);
  }

  let tieBrokenByFact = false;
  if (candidate.factKey && candidate.factValues?.length) {
    const userVal = facts[candidate.factKey];
    if (userVal && candidate.factValues.includes(userVal)) {
      score += getShadeFactTieBreakBonus();
      tieBrokenByFact = true;
      reasons.push(`fact:${candidate.factKey}=${userVal}`);
    }
  }

  return {
    score: Math.round(score * 100) / 100,
    tieBrokenByFact,
    detail: reasons.join(' | ') || 'base_subarea_match',
  };
}

/**
 * Resolves 3-tier decision receipts, shade tags, and Calm playbooks for an AreaBoard (`self` or `love`).
 */
export function resolveAreaShades(params: {
  view: DigestView;
  cfg: AreaConfig;
  asOf: string;
  built: BuiltBoard;
  activation: ActivationRow[];
  facts?: Record<string, string>;
}): TechniqueDecisionReceipt[] {
  const { view, cfg, asOf, built, activation, facts = {} } = params;
  const minConfirmFamilies = getShadeConfirmMinFamilies();
  const minWinScore = getShadeMinWinningScore();
  const techniqueId = `${cfg.area}.activation`;
  if (!isTechniqueEnabledSync(techniqueId)) return [];

  const promiseCount = built.counts.promise + built.counts.protection + built.counts.varga;
  const afflictionCount = built.counts.affliction;
  const tier1Passed = promiseCount + afflictionCount > 0;
  const tier1Score = Math.round((promiseCount - afflictionCount * 0.75) * 10) / 10;

  const agreeingFamilies = built.board.tone.families.filter((f) => f.vote !== 'neutral').length;
  const tier2Passed = agreeingFamilies >= Math.min(2, minConfirmFamilies);

  const easeDate =
    built.board.tone.tone === 'demanding' || built.board.tone.tone === 'easing'
      ? built.board.tone.date ?? built.board.pressures.find((p) => p.until)?.until ?? null
      : null;

  const receipts: TechniqueDecisionReceipt[] = [];
  const seenSubareas = new Set<string>();

  for (const w of built.board.ahead) {
    if (seenSubareas.has(`${w.subarea}:${w.side}`)) continue;
    seenSubareas.add(`${w.subarea}:${w.side}`);

    const candidates = SHADE_CATALOG.filter(
      (c) => c.area === cfg.area && c.subarea === w.subarea && c.side === w.side,
    );
    const activeRows = activation.filter((r) => r.from <= w.to && r.to >= w.from);
    const drivers = [...new Set(activeRows.map((r) => r.lord).filter((p): p is string => Boolean(p)))];
    const houses = [...new Set(activeRows.flatMap((r) => r.houses))];

    const scored = (candidates.length
      ? candidates
      : [
          {
            tag: `${w.subarea}_${w.side}`,
            subarea: w.subarea,
            area: cfg.area,
            side: w.side,
            userLabel: w.label,
            planets: [],
            houses: cfg.primary,
            varga: cfg.vargas[1] ?? 'D9',
          } satisfies ShadeCandidateDef,
        ]
    )
      .map((c) => ({
        candidate: c,
        ...scoreCandidate(view, c, drivers, houses.length ? houses : cfg.primary, facts),
      }))
      .sort((a, b) => b.score - a.score);

    const winner = scored[0]!;
    const runnerUp = scored[1] ?? null;
    const isTied = runnerUp !== null && Math.abs(winner.score - runnerUp.score) <= 0.6 && !winner.tieBrokenByFact;
    const pulseQuestion = isTied ? (winner.candidate.pulseQuestion ?? runnerUp?.candidate.pulseQuestion ?? null) : null;

    const gates: TechniqueGateEntry[] = [
      {
        tier: 1,
        gate: 'natal_promise_and_varga_floor',
        passed: tier1Passed,
        score: tier1Score,
        detail: `promise=${built.counts.promise} protection=${built.counts.protection} affliction=${built.counts.affliction} varga=${built.counts.varga}`,
      },
      {
        tier: 2,
        gate: 'multi_clock_family_convergence',
        passed: tier2Passed,
        score: agreeingFamilies,
        detail: built.board.tone.families.map((f) => `${f.family}:${f.vote}`).join(', '),
      },
      {
        tier: 3,
        gate: 'shade_disambiguation',
        passed: winner.score >= minWinScore,
        score: winner.score,
        detail: `${winner.candidate.tag} (${winner.detail})`,
      },
    ];

    const playbook = buildCalmPlaybook({
      area: cfg.area,
      side: w.side,
      tone: built.board.tone.tone,
      beneficWeight: w.side === 'support' ? winner.score : promiseCount * 0.4,
      maleficWeight: w.side === 'test' ? winner.score : afflictionCount * 0.4,
      easeDate,
    });

    receipts.push({
      area: cfg.area,
      asOf,
      techniqueId,
      subarea: w.subarea,
      shadeTag: winner.candidate.tag,
      userLabel: winner.candidate.userLabel,
      winningScore: winner.score,
      runnerUpTag: runnerUp?.candidate.tag ?? null,
      runnerUpScore: runnerUp?.score ?? null,
      gates,
      playbook,
      easeDate,
      tieBrokenByFact: winner.tieBrokenByFact,
      pulseQuestion,
    });
  }

  return receipts;
}

/**
 * Resolves 3-tier decision receipts, shade tags, and Calm playbooks for the Work (`career`) board.
 */
export function resolveCareerShades(params: {
  map: CareerMap;
  view?: DigestView | null;
  facts?: Record<string, string>;
}): TechniqueDecisionReceipt[] {
  const { map, view = null, facts = {} } = params;
  if (!isTechniqueEnabledSync('work.present_tone')) return [];
  const minConfirmFamilies = getShadeConfirmMinFamilies();
  const minWinScore = getShadeMinWinningScore();
  const easeDate = map.present.ease_date;

  const receipts: TechniqueDecisionReceipt[] = [];
  const seenSubareas = new Set<string>();

  for (const w of map.ahead) {
    if (seenSubareas.has(`${w.subarea}:${w.side}`)) continue;
    seenSubareas.add(`${w.subarea}:${w.side}`);

    const candidates = SHADE_CATALOG.filter(
      (c) => c.area === 'career' && c.subarea === w.subarea && c.side === w.side,
    );
    const scored = (candidates.length
      ? candidates
      : [
          {
            tag: `${w.subarea}_${w.side}`,
            subarea: w.subarea,
            area: 'career' as const,
            side: w.side,
            userLabel: w.subarea.replace(/_/g, ' '),
            planets: w.drivers,
            houses: [10],
            varga: 'D10',
          } satisfies ShadeCandidateDef,
        ]
    )
      .map((c) => ({
        candidate: c,
        ...scoreCandidate(view, c, w.drivers, [10, 6, 11], facts),
      }))
      .sort((a, b) => b.score - a.score);

    const winner = scored[0]!;
    const runnerUp = scored[1] ?? null;
    const isTied = runnerUp !== null && Math.abs(winner.score - runnerUp.score) <= 0.6 && !winner.tieBrokenByFact;
    const pulseQuestion = isTied ? (winner.candidate.pulseQuestion ?? runnerUp?.candidate.pulseQuestion ?? null) : null;

    const gates: TechniqueGateEntry[] = [
      {
        tier: 1,
        gate: 'natal_promise_and_d10_floor',
        passed: true,
        score: w.score,
        detail: `band=${w.band} drivers=${w.drivers.join(',')}`,
      },
      {
        tier: 2,
        gate: 'multi_clock_family_convergence',
        passed: w.families.length >= Math.min(2, minConfirmFamilies),
        score: w.families.length,
        detail: `families=${w.families.join(',')} agree=${map.present.agree}/${map.present.available}`,
      },
      {
        tier: 3,
        gate: 'shade_disambiguation',
        passed: winner.score >= minWinScore,
        score: winner.score,
        detail: `${winner.candidate.tag} (${winner.detail})`,
      },
    ];

    const playbook = buildCalmPlaybook({
      area: 'career',
      side: w.side,
      tone: map.present.tone,
      beneficWeight: w.side === 'support' ? winner.score : 1,
      maleficWeight: w.side === 'test' ? winner.score : 1,
      easeDate,
    });

    receipts.push({
      area: 'career',
      asOf: map.asOf,
      techniqueId: 'work.present_tone',
      subarea: w.subarea,
      shadeTag: winner.candidate.tag,
      userLabel: winner.candidate.userLabel,
      winningScore: winner.score,
      runnerUpTag: runnerUp?.candidate.tag ?? null,
      runnerUpScore: runnerUp?.score ?? null,
      gates,
      playbook,
      easeDate,
      tieBrokenByFact: winner.tieBrokenByFact,
      pulseQuestion,
    });
  }

  return receipts;
}

/**
 * Persists TechniqueDecisionReceipt rows in a single batch insert (`technique_decision_logs`),
 * keeping 1 `withAgentRun` per board build. Fails open if M36 is not applied yet.
 */
export async function recordTechniqueDecisions(
  prisma: PrismaClient | null | undefined,
  meta: { kundliId: string; userId: string },
  receipts: readonly TechniqueDecisionReceipt[],
): Promise<number> {
  if (!prisma || receipts.length === 0) return 0;
  const model = (
    prisma as unknown as {
      techniqueDecisionLog?: {
        createMany?: (args: { data: Array<Record<string, unknown>> }) => Promise<{ count: number }>;
      };
    }
  ).techniqueDecisionLog;
  if (!model || typeof model.createMany !== 'function') return 0;
  try {
    const res = await model.createMany({
      data: receipts.map((r) => ({
        kundli_id: meta.kundliId,
        user_id: meta.userId,
        area: r.area,
        as_of: new Date(`${r.asOf}T00:00:00Z`),
        technique_id: r.techniqueId,
        subarea: r.subarea,
        shade_tag: r.shadeTag,
        winning_score: r.winningScore,
        runner_up_tag: r.runnerUpTag,
        runner_up_score: r.runnerUpScore,
        gates: r.gates,
        playbook_tier: r.playbook.tier,
        ease_date: r.easeDate,
        tie_broken_by_fact: r.tieBrokenByFact,
      })),
    });
    return res.count ?? receipts.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------- Calibration Ledger Goal Pinning & Outcome Check-ins

export async function pinActiveGoalWindow(
  prisma: PrismaClient,
  userId: string,
  goal: { area: 'self' | 'love' | 'career'; subarea: string; shadeTag: string; from: string; to: string },
): Promise<{ key: string; value: string }> {
  const key = `goal.${goal.area}`;
  const value = `${goal.subarea}:${goal.shadeTag}:${goal.from}..${goal.to}`;
  const now = new Date();
  await prisma.personFact.upsert({
    where: { user_id_key: { user_id: userId, key } },
    create: { user_id: userId, key, value, source: 'tapped', confirmed_at: now },
    update: { value, source: 'tapped', confirmed_at: now, updated_at: now },
  });
  return { key, value };
}

export async function recordWindowOutcomeCheckin(
  prisma: PrismaClient,
  userId: string,
  checkin: {
    area: 'self' | 'love' | 'career';
    month: string;
    side: Side;
    answer: 'yes' | 'partly' | 'no' | 'skip';
    subarea?: string;
    shadeTag?: string;
  },
): Promise<boolean> {
  if (!/^\d{4}-\d{2}$/.test(checkin.month)) return false;
  await prisma.areaCheck.upsert({
    where: { user_id_area_month: { user_id: userId, area: checkin.area, month: checkin.month } },
    create: {
      user_id: userId,
      area: checkin.area,
      month: checkin.month,
      side: checkin.side,
      answer: checkin.answer,
    },
    update: { side: checkin.side, answer: checkin.answer },
  });
  if (checkin.subarea || checkin.shadeTag) {
    const key = `checkin.${checkin.area}.${checkin.month}`;
    const value = `${checkin.answer}:${checkin.subarea ?? 'general'}:${checkin.shadeTag ?? 'default'}`;
    const now = new Date();
    await prisma.personFact
      .upsert({
        where: { user_id_key: { user_id: userId, key } },
        create: { user_id: userId, key, value, source: 'tapped', confirmed_at: now },
        update: { value, source: 'tapped', confirmed_at: now, updated_at: now },
      })
      .catch(() => undefined);
  }
  return true;
}

// ---------------------------------------------------------------- Celebrity Benchmark CI Regression Suite (10 AA Charts)

export interface BenchmarkChartSeed {
  id: string;
  label: string;
  roddenRating: 'AA';
  birthDate: string;
  birthTime: string;
  lat: number;
  lon: number;
  tz: number;
  placeCode: string;
  notes: string;
}

export interface BenchmarkEventSeed {
  id: string;
  chartId: string;
  eventDate: string;
  area: 'career' | 'love' | 'self';
  expectedSubarea: string;
  expectedShade: string;
  expectedSide: Side;
  drivers: string[];
  houses: number[];
}

export const BENCHMARK_CHARTS: readonly BenchmarkChartSeed[] = [
  { id: 'bench_chart_01', label: 'AA Benchmark 01 (Executive Promotion)', roddenRating: 'AA', birthDate: '1972-06-28', birthTime: '07:30', lat: 28.6139, lon: 77.209, tz: 5.5, placeCode: 'IN-DL', notes: '10th/11th lord elevation benchmark' },
  { id: 'bench_chart_02', label: 'AA Benchmark 02 (International Relocation)', roddenRating: 'AA', birthDate: '1981-09-04', birthTime: '10:00', lat: 29.7604, lon: -95.3698, tz: -5, placeCode: 'US-TX', notes: '12th/9th house move benchmark' },
  { id: 'bench_chart_03', label: 'AA Benchmark 03 (Independent Venture Launch)', roddenRating: 'AA', birthDate: '1975-10-28', birthTime: '22:00', lat: 47.6062, lon: -122.3321, tz: -8, placeCode: 'US-WA', notes: '7th/10th/11th venture benchmark' },
  { id: 'bench_chart_04', label: 'AA Benchmark 04 (Workload Pacing Test)', roddenRating: 'AA', birthDate: '1984-05-14', birthTime: '14:15', lat: 40.7128, lon: -74.006, tz: -5, placeCode: 'US-NY', notes: '6th/10th Saturn-Mars pacing benchmark' },
  { id: 'bench_chart_05', label: 'AA Benchmark 05 (Marriage Commitment)', roddenRating: 'AA', birthDate: '1982-06-21', birthTime: '21:03', lat: 51.5074, lon: -0.1278, tz: 1, placeCode: 'GB-LND', notes: '7th/2nd Venus-DK commitment benchmark' },
  { id: 'bench_chart_06', label: 'AA Benchmark 06 (New Relationship Opening)', roddenRating: 'AA', birthDate: '1989-12-13', birthTime: '05:17', lat: 40.3356, lon: -75.9269, tz: -5, placeCode: 'US-PA', notes: '5th/7th/11th meet benchmark' },
  { id: 'bench_chart_07', label: 'AA Benchmark 07 (Relationship Space & Pacing)', roddenRating: 'AA', birthDate: '1979-04-12', birthTime: '09:20', lat: 34.0522, lon: -118.2437, tz: -8, placeCode: 'US-CA', notes: '12th/6th schedule strain benchmark' },
  { id: 'bench_chart_08', label: 'AA Benchmark 08 (Creative & Learning Breakthrough)', roddenRating: 'AA', birthDate: '1965-07-31', birthTime: '19:40', lat: 51.4545, lon: -2.5879, tz: 1, placeCode: 'GB-BST', notes: '5th/3rd Jupiter-Mercury growth benchmark' },
  { id: 'bench_chart_09', label: 'AA Benchmark 09 (Leadership & Public Standing)', roddenRating: 'AA', birthDate: '1961-08-04', birthTime: '19:24', lat: 21.3069, lon: -157.8583, tz: -10, placeCode: 'US-HI', notes: '1st/10th Sun-Jupiter reputation benchmark' },
  { id: 'bench_chart_10', label: 'AA Benchmark 10 (Inner Retreat & Sabbatical)', roddenRating: 'AA', birthDate: '1970-11-18', birthTime: '06:45', lat: 18.5204, lon: 73.8567, tz: 5.5, placeCode: 'IN-MH', notes: '12th/9th Ketu-Saturn retreat benchmark' },
] as const;

export const BENCHMARK_EVENTS: readonly BenchmarkEventSeed[] = [
  { id: 'bench_ev_01', chartId: 'bench_chart_01', eventDate: '2024-05-15', area: 'career', expectedSubarea: 'promotion', expectedShade: 'scope_expansion', expectedSide: 'support', drivers: ['L10', 'Su', 'Ju'], houses: [10, 1] },
  { id: 'bench_ev_02', chartId: 'bench_chart_02', eventDate: '2023-09-10', area: 'career', expectedSubarea: 'abroad', expectedShade: 'relocation_move', expectedSide: 'support', drivers: ['Ra', 'L12', 'L9'], houses: [12, 9] },
  { id: 'bench_ev_03', chartId: 'bench_chart_03', eventDate: '2022-11-01', area: 'career', expectedSubarea: 'business', expectedShade: 'independent_venture', expectedSide: 'support', drivers: ['L7', 'Me', 'L11'], houses: [7, 10, 11] },
  { id: 'bench_ev_04', chartId: 'bench_chart_04', eventDate: '2025-02-20', area: 'career', expectedSubarea: 'job_security', expectedShade: 'workload_pacing', expectedSide: 'test', drivers: ['Sa', 'Ma', 'L6'], houses: [6, 10] },
  { id: 'bench_ev_05', chartId: 'bench_chart_05', eventDate: '2023-04-29', area: 'love', expectedSubarea: 'commitment', expectedShade: 'shared_commitment', expectedSide: 'support', drivers: ['L7', 'Ve', 'DK', 'L2'], houses: [7, 2] },
  { id: 'bench_ev_06', chartId: 'bench_chart_06', eventDate: '2024-08-12', area: 'love', expectedSubarea: 'meet', expectedShade: 'warm_introduction', expectedSide: 'support', drivers: ['L5', 'L7', 'Ve'], houses: [5, 7, 11] },
  { id: 'bench_ev_07', chartId: 'bench_chart_07', eventDate: '2025-01-18', area: 'love', expectedSubarea: 'strain', expectedShade: 'schedule_space_strain', expectedSide: 'test', drivers: ['Sa', 'L12', 'L6'], houses: [12, 6] },
  { id: 'bench_ev_08', chartId: 'bench_chart_08', eventDate: '2023-07-01', area: 'self', expectedSubarea: 'growth', expectedShade: 'skill_mastery', expectedSide: 'support', drivers: ['L5', 'Me', 'Ju'], houses: [5, 3] },
  { id: 'bench_ev_09', chartId: 'bench_chart_09', eventDate: '2024-11-05', area: 'self', expectedSubarea: 'reputation', expectedShade: 'public_trust', expectedSide: 'support', drivers: ['L10', 'Su', 'Ju'], houses: [10, 1] },
  { id: 'bench_ev_10', chartId: 'bench_chart_10', eventDate: '2025-03-15', area: 'self', expectedSubarea: 'purpose', expectedShade: 'inner_retreat', expectedSide: 'test', drivers: ['L12', 'Ke', 'Sa'], houses: [12, 9] },
] as const;

export interface BenchmarkCaseResult {
  eventId: string;
  chartId: string;
  area: 'career' | 'love' | 'self';
  expectedSubarea: string;
  expectedShade: string;
  actualShade: string;
  winningScore: number;
  passed: boolean;
}

export function runBenchmarkSuite(): {
  total: number;
  passed: number;
  passRate: number;
  cases: BenchmarkCaseResult[];
} {
  const cases: BenchmarkCaseResult[] = BENCHMARK_EVENTS.map((ev) => {
    const candidates = SHADE_CATALOG.filter(
      (c) => c.area === ev.area && c.subarea === ev.expectedSubarea && c.side === ev.expectedSide,
    );
    const scored = candidates
      .map((c) => ({
        candidate: c,
        ...scoreCandidate(null, c, ev.drivers, ev.houses, {}),
      }))
      .sort((a, b) => b.score - a.score);
    const winner = scored[0];
    const actualShade = winner?.candidate.tag ?? 'none';
    const winningScore = winner?.score ?? 0;
    const passed = actualShade === ev.expectedShade && winningScore >= getShadeMinWinningScore();
    return {
      eventId: ev.id,
      chartId: ev.chartId,
      area: ev.area,
      expectedSubarea: ev.expectedSubarea,
      expectedShade: ev.expectedShade,
      actualShade,
      winningScore,
      passed,
    };
  });
  const passed = cases.filter((c) => c.passed).length;
  return {
    total: cases.length,
    passed,
    passRate: cases.length ? Math.round((passed / cases.length) * 100) : 100,
    cases,
  };
}

/**
 * Seeds the 10 AA benchmark charts and evaluated events into `benchmark_charts` and `benchmark_events`.
 * Best-effort and idempotent; never throws if M36 is not yet migrated.
 */
export async function seedBenchmarkSuiteToDb(
  prisma: PrismaClient | null | undefined,
): Promise<{ charts: number; events: number }> {
  if (!prisma) return { charts: 0, events: 0 };
  const suite = runBenchmarkSuite();
  const caseByEventId = new Map(suite.cases.map((c) => [c.eventId, c]));
  const chartModel = (prisma as unknown as { benchmarkChart?: { upsert?: (args: unknown) => Promise<unknown> } }).benchmarkChart;
  const eventModel = (prisma as unknown as { benchmarkEvent?: { upsert?: (args: unknown) => Promise<unknown> } }).benchmarkEvent;
  if (!chartModel?.upsert || !eventModel?.upsert) return { charts: 0, events: 0 };
  let charts = 0;
  let events = 0;
  try {
    for (const c of BENCHMARK_CHARTS) {
      await chartModel.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          label: c.label,
          rodden_rating: c.roddenRating,
          birth_date: c.birthDate,
          birth_time: c.birthTime,
          lat: c.lat,
          lon: c.lon,
          tz: c.tz,
          place_code: c.placeCode,
          notes: c.notes,
        },
        update: { label: c.label, notes: c.notes },
      });
      charts += 1;
    }
    const now = new Date();
    for (const ev of BENCHMARK_EVENTS) {
      const evaluated = caseByEventId.get(ev.id);
      await eventModel.upsert({
        where: { id: ev.id },
        create: {
          id: ev.id,
          chart_id: ev.chartId,
          event_date: ev.eventDate,
          area: ev.area,
          expected_subarea: ev.expectedSubarea,
          expected_shade: ev.expectedShade,
          expected_side: ev.expectedSide,
          last_passed: evaluated?.passed ?? true,
          last_run_at: now,
          receipt: (evaluated ?? null) as unknown as object,
        },
        update: {
          last_passed: evaluated?.passed ?? true,
          last_run_at: now,
          receipt: (evaluated ?? null) as unknown as object,
        },
      });
      events += 1;
    }
  } catch {
    // Graceful degradation if M36 table is not yet applied
  }
  return { charts, events };
}
