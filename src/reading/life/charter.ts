/**
 * The Remaining Largest Mahadasha (10–18+ Years) & Antardasha Life-Charter technique (`life.mahadasha_charter`,
 * docs/reading-engine/55; doc 34 §3–§5): connects the ~10,000 stored digest and activation rows (`kundli_digest` D1 + D9
 * + owning vargas + yogas + annual TP/VP charts, `kundli_activation` across 43 dasha systems, `avasthas.dasha_charter`
 * 5-vector charter & 9×9 Antardasha fruition matrix, and `SkyView` transits) to chart out the individual's major
 * multi-year Mahadasha chapter sub-period by sub-period and guide the reading per life area at a high-level charter.
 *
 * Node selects rows, intersects date ranges, counts and sums weights over engine-provided fields. It derives nothing
 * astrological (`tests/unit/reading/digest/noAstrologyInNode.test.ts`). Visible text uses plain human words only; chart
 * terms sit exclusively inside `evidence` (doc 45 §3.3).
 */
import {
  getLifeCharterHorizonYears,
  getLifeCharterMaxAreasPerAd,
  getLifeCharterMinRemainingYears,
} from '../../config/env.js';
import type { ActivationFamily, ActivationRow } from '../digest/activation.js';
import type { AnnualRow, AntardashaFruitionCell, DigestView } from '../digest/types.js';
import { LIFE_AREAS, type LifeArea, type LifeAreaId } from './areas.js';
import { addYears, covers, dignitySide, overlaps, planetName, planetSide, type Side } from './labels.js';
import {
  ANNUAL_WEIGHTS,
  FAMILY_WEIGHTS,
  LAYER_WEIGHTS,
  annualSide,
  owningVargaOf,
  periodLord,
  periodSide,
  type AreaPromise,
  type Verdict,
} from './promise.js';
import type { SkyView } from './sky.js';
import { DATING_FAMILIES, basisOf, gradeOf, type Grade } from './timing.js';

export type LifeCharterRole = 'anchor' | 'growth' | 'guarded';
export type LifeAntardashaTone = 'breakthrough' | 'build' | 'steady_work' | 'careful';

export interface LifeAreaCharter {
  id: LifeAreaId;
  label: string;
  role: LifeCharterRole;
  verdict: Verdict;
  theme: string;
  promise_note: string;
  peak_from: string | null;
  peak_to: string | null;
  watch_from: string | null;
  watch_to: string | null;
  guidance: string;
  grade: Grade;
  basis: string;
  evidence: {
    houses: number[];
    vargas: string[];
    planets: string[];
    yogas: string[];
  };
}

export interface LifeAntardashaAreaNote {
  id: LifeAreaId;
  label: string;
  verdict: Verdict;
  summary: string;
  timing: string;
  action: string;
}

export interface LifeAntardashaRow {
  from: string;
  to: string;
  is_current: boolean;
  tone: LifeAntardashaTone;
  headline: string;
  areas: LifeAntardashaAreaNote[];
  grade: Grade;
  basis: string;
  evidence: {
    md: string;
    ad: string;
    house_from_md: number | null;
    fruition_class: string | null;
    links: string[];
    systems: string[];
    annual_years: string[];
    transit_houses: number[];
  };
}

export interface LifeMahadashaBridge {
  from: string;
  to: string;
  remaining_years: number;
  summary: string;
  antardashas: LifeAntardashaRow[];
}

export interface LifeMahadashaCharter {
  from: string;
  to: string;
  remaining_years: number;
  total_years: number;
  is_current: boolean;
  headline: string;
  charter_summary: string;
  area_charters: LifeAreaCharter[];
  antardashas: LifeAntardashaRow[];
  bridge: LifeMahadashaBridge | null;
  evidence: {
    md: string;
    own_houses: number[];
    placed_house: number | null;
    dispositor: string | null;
    star_lord: string | null;
    avastha: string | null;
  };
}

export interface CharterAreaInput {
  area: LifeArea;
  promise: AreaPromise;
}

export interface CharterInputs {
  today: string;
  rows: ActivationRow[];
  annual: (year: number) => AnnualRow[];
  sky: SkyView | null;
}

const OTHER_FAMILIES: ActivationFamily[] = [...DATING_FAMILIES, 'karaka', 'other'];
const YOGA_SUPPORT = /raja|dhana|mahapurusha|cancel|bhanga|lakshmi|gaja/i;
const YOGA_TEST = /dosha|daridra|kemadruma|shakata|grahan/i;

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

function yearsBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round(((b - a) / YEAR_MS) * 10) / 10;
}

const yearsOf = (from: string, to: string): number[] => {
  const out: number[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push(y);
  return out;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (iso: string): string => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

const SYSTEM_WORDS: Record<string, string> = {
  vimshottari: 'Vimshottari',
  vimsottari: 'Vimshottari',
  yogini: 'Yogini',
  tithi_ashtottari: 'Tithi Ashtottari',
  narayana: 'Narayana',
  chara: 'Chara',
  sudasa: 'Sudasa',
  dwisaptati: 'Dwisaptati',
  dwisatpathi: 'Dwisaptati',
  ashtottari: 'Ashtottari',
};
const systemName = (s: string): string =>
  SYSTEM_WORDS[s.toLowerCase()] ?? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Long-term high-level guidance per area (plain words; no banned terms). */
const AREA_CHARTER_GUIDANCE: Record<LifeAreaId, { anchor: string; growth: string; guarded: string }> = {
  self: {
    anchor: 'Build your schedule and commitments around the personal direction you want to be known for over the next decade.',
    growth: 'Pace your energy and refine your personal goals step by step as each supportive window opens.',
    guarded: 'Protect your daily rhythm and avoid overcommitting your time when outside demands spike.',
  },
  money: {
    anchor: 'Channel surplus into durable savings and long-term assets during the peak windows; consult a qualified financial professional on structure.',
    growth: 'Grow reserves steadily through disciplined saving and clear written budgets before expanding commitments.',
    guarded: 'Keep fixed costs lean, maintain a cash buffer, and review major financial steps with a qualified adviser.',
  },
  work: {
    anchor: 'Step forward for larger responsibility, visible deliverables, and long-term career milestones during the opening stretches.',
    growth: 'Build your track record methodically, put scope and terms in writing, and time role shifts to the confirmed windows.',
    guarded: 'Focus on steady execution and clear documentation at work; hold abrupt career leaps until the testing stretches pass.',
  },
  home: {
    anchor: 'Use the confirmed windows to settle long-term living plans, home improvements, or property decisions after thorough professional review.',
    growth: 'Improve your living space in planned stages and keep all home records and agreements organized.',
    guarded: 'Keep your living arrangements steady and review any lease or property paperwork twice with a qualified professional.',
  },
  marriage: {
    anchor: 'Deepen shared plans and long-term commitments with honesty, warmth, and regular unhurried conversations.',
    growth: 'Let trust build through consistent small kept promises and clear communication around shared responsibilities.',
    guarded: 'Give your relationship extra patience during busy stretches and talk through sensitive topics when both of you are rested.',
  },
  children: {
    anchor: 'Invest steady time, presence, and practical planning into your children’s growth or family plans during the supportive stretches.',
    growth: 'Support children’s routines and milestones one step at a time with clear family rhythms.',
    guarded: 'Keep expectations gentle around children’s matters and build extra time and support into family schedules.',
  },
  parents: {
    anchor: 'Strengthen family ties with parents and elders through regular contact and shared milestones.',
    growth: 'Stay consistent with weekly check-ins and practical planning for your parents’ comfort.',
    guarded: 'Organize important records and support for parents early so care needs never catch you unprepared.',
  },
  siblings: {
    anchor: 'Collaborate with brothers, sisters, or close peers on clear, mutually helpful initiatives.',
    growth: 'Keep communication warm and direct with siblings while respecting each person’s independence.',
    guarded: 'Keep shared money or favors with siblings in writing and address small misunderstandings early.',
  },
  legal: {
    anchor: 'Close out pending contracts, compliance matters, or formal agreements during the best-supported windows with professional counsel.',
    growth: 'Keep dated written records of all formal agreements and resolve administrative items methodically.',
    guarded: 'Avoid unnecessary disputes, document every official exchange, and consult a qualified legal professional before signing.',
  },
  health: {
    anchor: 'Lock in sustainable sleep, movement, and recovery habits that carry your stamina across the decade.',
    growth: 'Build stamina gradually through consistent rest and daily movement; consult a qualified professional for any care needs.',
    guarded: 'Protect your rest and recovery during demanding stretches, and take any physical concern promptly to a qualified professional.',
  },
  travel: {
    anchor: 'Plan meaningful journeys, international connections, or well-prepared relocations during the confirmed opening windows.',
    growth: 'Test relocation or travel plans in smaller steps before making permanent moves.',
    guarded: 'Keep travel plans flexible, verify documents early, and delay major moves until the supportive stretches arrive.',
  },
  learning: {
    anchor: 'Commit to deep mastery, certifications, or structured study that compounds over several years.',
    growth: 'Complete one focused course or skill at a time in steady daily study blocks.',
    guarded: 'Keep learning practical and applied rather than scattering attention across too many subjects at once.',
  },
  dharma: {
    anchor: 'Align your long-term work and giving with the values, mentors, and community causes that matter most to you.',
    growth: 'Set aside regular quiet reflection and monthly service to stay grounded in purpose.',
    guarded: 'Keep your inner practice simple and steady when external duties feel noisy.',
  },
};

const AD_AREA_ACTION: Record<LifeAreaId, { support: string; test: string }> = {
  self: {
    support: 'Step forward on your main personal priority and set the pace for the months ahead.',
    test: 'Keep your daily routine simple and say no to side commitments that drain your focus.',
  },
  money: {
    support: 'Strengthen savings and finalize planned financial terms with a qualified adviser.',
    test: 'Hold off on large discretionary commitments and keep your monthly cash cushion intact.',
  },
  work: {
    support: 'Ask, apply, or launch prepared work initiatives while momentum backs your effort.',
    test: 'Deliver current responsibilities cleanly in writing and hold major role changes until the next opening.',
  },
  home: {
    support: 'Move ahead on planned home improvements or living arrangements after reviewing the paperwork.',
    test: 'Maintain what you have at home and delay major property commitments.',
  },
  marriage: {
    support: 'Make time for shared plans, honest conversations, and relationship milestones.',
    test: 'Listen first, keep promises small and clear, and avoid pressing big relationship decisions in tense moments.',
  },
  children: {
    support: 'Lean into family plans and dedicated one-to-one time with children.',
    test: 'Keep family schedules unhurried and build extra patience around children’s routines.',
  },
  parents: {
    support: 'Share unhurried time with parents and settle helpful family plans together.',
    test: 'Check in regularly with parents and keep their practical support well organized.',
  },
  siblings: {
    support: 'Team up with siblings or close peers on clear, well-defined plans.',
    test: 'Keep boundaries kind and written with siblings and let heated topics cool.',
  },
  legal: {
    support: 'Settle pending paperwork or formal agreements with qualified professional guidance.',
    test: 'Keep dated records of every formal exchange and take legal questions to a qualified professional.',
  },
  health: {
    support: 'Build strength through steady sleep, nourishing meals, and regular daily movement.',
    test: 'Protect your rest and recovery, and bring any health question to a qualified professional.',
  },
  travel: {
    support: 'Execute well-prepared travel or relocation steps with documents in order.',
    test: 'Keep trips light and double-check bookings and paperwork before moving.',
  },
  learning: {
    support: 'Finish a key certification, course, or skill milestone and put it to use.',
    test: 'Stick to short daily study blocks and finish current material before adding more.',
  },
  dharma: {
    support: 'Dedicate time to mentorship, reflection, and causes you care about.',
    test: 'Keep a quiet daily anchor of reflection to stay centered.',
  },
};

interface MdCandidate {
  lord: string;
  from: string;
  to: string;
  houses: number[];
  isCurrent: boolean;
  remainingYears: number;
  totalYears: number;
}

/**
 * Extracts level-1 Vimshottari Mahadasha candidates from `rows` (or synthesizes them from contiguous level-2
 * `parentLord` runs when level-1 rows are omitted in compact test fixtures).
 */
export function extractMahadashas(rows: ActivationRow[], today: string, horizonEnd: string): MdCandidate[] {
  const vim1 = rows
    .filter((r) => r.family === 'vimshottari' && r.level === 1 && r.lord && r.to > today && r.from <= horizonEnd)
    .sort((a, b) => a.from.localeCompare(b.from));

  const rawList: Array<{ lord: string; from: string; to: string; houses: number[] }> = [];
  if (vim1.length) {
    for (const r of vim1) {
      rawList.push({ lord: r.lord!, from: r.from, to: r.to, houses: r.houses ?? [] });
    }
  } else {
    // Fallback for fixtures with only level-2 rows carrying `parentLord`
    const vim2 = rows
      .filter((r) => r.family === 'vimshottari' && r.level === 2 && (r.parentLord || r.lord) && r.to > today)
      .sort((a, b) => a.from.localeCompare(b.from));
    for (const r of vim2) {
      const lord = r.parentLord ?? r.lord!;
      const last = rawList.at(-1);
      if (last && last.lord === lord) {
        if (r.to > last.to) last.to = r.to;
        last.houses = [...new Set([...last.houses, ...(r.houses ?? [])])];
      } else {
        rawList.push({ lord, from: r.from, to: r.to, houses: [...(r.houses ?? [])] });
      }
    }
  }

  return rawList.map((m, idx) => {
    const isCurrent = m.from <= today && m.to > today ? true : idx === 0 && m.from <= today;
    const effFrom = m.from < today ? today : m.from;
    return {
      lord: m.lord,
      from: m.from,
      to: m.to,
      houses: m.houses,
      isCurrent,
      remainingYears: yearsBetween(effFrom, m.to),
      totalYears: yearsBetween(m.from, m.to),
    };
  });
}

/**
 * Selects the primary chartered Mahadasha (if the running MD has >= `LIFE_CHARTER_MIN_REMAINING_YEARS` left, or else
 * the largest Mahadasha in the horizon with the running MD as a bridge).
 */
export function selectCharterMahadasha(
  rows: ActivationRow[],
  today: string,
): { primary: MdCandidate; bridge: MdCandidate | null } | null {
  const minYears = getLifeCharterMinRemainingYears();
  const horizonEnd = addYears(today, getLifeCharterHorizonYears());
  const mds = extractMahadashas(rows, today, horizonEnd);
  if (!mds.length) return null;

  const current = mds.find((m) => m.isCurrent) ?? mds[0]!;
  if (current.remainingYears >= minYears || mds.length === 1) {
    return { primary: current, bridge: null };
  }

  // Find the Mahadasha in the horizon with the largest remaining duration
  const largest = [...mds].sort((a, b) => b.remainingYears - a.remainingYears)[0]!;
  if (largest.lord === current.lord && largest.from === current.from) {
    return { primary: current, bridge: null };
  }
  return {
    primary: largest,
    bridge: current.remainingYears > 0 ? current : null,
  };
}

interface MdTouchMap {
  houseWeights: Map<number, number>;
  ownHouses: number[];
  placedHouse: number | null;
  dispositor: string | null;
  starLord: string | null;
  avastha: string | null;
  yogas: Array<{ name: string; houses: number[]; planets: string[]; side: Side }>;
}

function buildMdTouchMap(view: DigestView, mdLord: string, mdHouses: number[]): MdTouchMap {
  const card = view.planet('D1', mdLord);
  const dc = card?.dashaCharter ?? null;
  const ownHouses = [...new Set([...(dc?.housesOwned ?? []), ...(card?.owns ?? [])])].sort((a, b) => a - b);
  const placedHouse = card?.house ?? null;
  const dispositor = card?.dispositor ?? null;
  const starLord = card?.starLord ?? null;
  const avastha = card?.avasthas ? Object.values(card.avasthas).filter(Boolean).join(', ') || null : null;

  const houseWeights = new Map<number, number>();
  const addW = (h: number | null | undefined, w: number) => {
    if (h && h >= 1 && h <= 12) houseWeights.set(h, (houseWeights.get(h) ?? 0) + w);
  };

  for (const h of ownHouses) addW(h, 3);
  addW(placedHouse, 3);
  for (const h of mdHouses) addW(h, 2);
  addW(dc?.starLordHouse ?? (starLord ? view.planet('D1', starLord)?.house : null), 2);
  addW(dc?.dispositorHouse ?? card?.dispositorHouse, 2);
  for (const h of dc?.housesCoOwned ?? []) addW(h, 1.5);
  for (const h of [...new Set([...(card?.aspectsTo ?? []), ...(dc?.grahaDrishtiHouses ?? [])])]) addW(h, 1);
  for (const h of dc?.rasiDrishtiHouses ?? []) addW(h, 0.75);

  const yogas: Array<{ name: string; houses: number[]; planets: string[]; side: Side }> = [];
  for (const y of view.yogas()) {
    if (!y.planets.includes(mdLord)) continue;
    const label = `${y.class} ${y.name}`;
    const side: Side = YOGA_TEST.test(label) && !/cancel|bhanga/i.test(label) ? 'test' : YOGA_SUPPORT.test(label) ? 'support' : 'neutral';
    yogas.push({ name: y.name, houses: y.houses, planets: y.planets, side });
    for (const h of y.houses) addW(h, 2);
  }

  return { houseWeights, ownHouses, placedHouse, dispositor, starLord, avastha, yogas };
}

function joinPhrases(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) {
    const [a, b] = items as [string, string];
    return a.includes(' and ') || b.includes(' and ') ? `${a}, along with ${b}` : `${a} and ${b}`;
  }
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)!}`;
}

function fruitionBonus(cell: AntardashaFruitionCell | undefined): {
  pts: number;
  links: string[];
  isCrisis: boolean;
  isSupportive: boolean;
} {
  if (!cell) return { pts: 0, links: [], isCrisis: false, isSupportive: false };
  const links: string[] = [];
  let pts = 0;
  if (cell.isStarLordOfMd) {
    links.push('star_lord_of_md');
    pts += 4;
  }
  if (cell.isSignDispositorOfMd) {
    links.push('sign_dispositor_of_md');
    pts += 3;
  }
  if (cell.isCoLordPartnerOfMd) {
    links.push('co_lord_partner_of_md');
    pts += 3;
  }
  const cls = cell.fruitionClass ?? '';
  const isCrisis = cls === 'dusthana_reversal_crisis' || cell.isShadAshtaka68;
  const isSupportive =
    !isCrisis &&
    (cls === 'trikona_manifestation' || cls === 'kendra_structural' || cls === 'dhana_labha_gain');
  if (cls === 'trikona_manifestation') pts += 5;
  else if (cls === 'kendra_structural') pts += 4;
  else if (cls === 'dhana_labha_gain') pts += 3;
  else if (cls === 'upachaya_effort') pts += 1;
  else if (isCrisis) pts -= 6;
  else if (cell.isDwirdwadasha212) pts -= 2;
  if (cell.isShadAshtaka68) links.push('shad_ashtaka_6_8');
  if (cell.isDwirdwadasha212) links.push('dwirdwadasha_2_12');
  return { pts, links, isCrisis, isSupportive };
}

interface ScoredAdArea {
  area: LifeArea;
  promise: AreaPromise;
  score: number;
  rankScore: number;
  touchesAd: boolean;
  side: Side;
  systems: string[];
  contradicts: string[];
  annualConfirms: boolean;
  annualYears: string[];
  transitOpen: boolean;
  transitHouses: number[];
  skyKnown: boolean;
}

function scoreAdForArea(
  view: DigestView,
  area: LifeArea,
  promise: AreaPromise,
  mdLord: string,
  adRow: ActivationRow,
  win: { from: string; to: string },
  mdTouch: MdTouchMap,
  fBonus: { pts: number; isCrisis: boolean; isSupportive: boolean },
  inSpanRows: ActivationRow[],
  annualFn: (year: number) => AnnualRow[],
  sky: SkyView | null,
): ScoredAdArea | null {
  const adLord = adRow.lord ?? mdLord;
  const adCard = view.planet('D1', adLord);
  const cardOwnedOrPlaced = [
    ...(adCard?.owns ?? []),
    ...(adCard?.dashaCharter?.housesOwned ?? []),
    ...(adCard?.house ? [adCard.house] : []),
  ];
  const adCoreHouses = new Set<number>(cardOwnedOrPlaced.length ? cardOwnedOrPlaced : (adRow.houses ?? []));
  const adHouses = new Set<number>([
    ...adCoreHouses,
    ...(adRow.houses ?? []),
    ...(adCard?.aspectsTo ?? []),
    ...(adCard?.dashaCharter?.grahaDrishtiHouses ?? []),
  ]);
  const touchesAd = area.houses.some((h) => adHouses.has(h));
  const touchesMd = area.houses.some((h) => (mdTouch.houseWeights.get(h) ?? 0) >= 2);
  if (!touchesAd && !touchesMd) return null;

  const primary = area.houses[0]!;
  const owning = owningVargaOf(view, area);
  const adD1Side = planetSide(adCard);
  const adD9Side = dignitySide(view.planet('D9', adLord)?.dignity ?? null);
  const adOwnSide = owning ? dignitySide(view.planet(owning, adLord)?.dignity ?? null) : 'neutral';

  let side: Side = adD1Side;
  if (fBonus.isCrisis) {
    side = side === 'support' ? 'neutral' : 'test';
  } else if (side === 'test' && fBonus.isSupportive) {
    side = fBonus.pts >= 4 || adD9Side === 'support' || adOwnSide === 'support' ? 'support' : 'neutral';
  } else if (side === 'neutral' && (fBonus.isSupportive || adD9Side === 'support' || adOwnSide === 'support')) {
    side = 'support';
  }

  // Base promise points (out of 55) + Vimshottari weight + 9×9 fruition bonus
  const promisePts = (LAYER_WEIGHTS.d1 + LAYER_WEIGHTS.varga) * promise.promiseRatio;
  let dashaPts = side === 'test' ? -FAMILY_WEIGHTS.vimshottari : FAMILY_WEIGHTS.vimshottari;
  if (touchesAd && area.houses[0] && adHouses.has(area.houses[0])) dashaPts += 3;
  dashaPts += fBonus.pts;

  const systems = [adRow.system];
  const contradicts: string[] = [];
  for (const fam of OTHER_FAMILIES) {
    const over = inSpanRows.filter((r) => r.family === fam && overlaps(r, win));
    const sides = over.map((r) => ({ r, s: periodSide(view, r, area.houses) })).filter((x) => x.s !== 'silent');
    if (!sides.length) continue;
    const sup = sides.find((x) => x.s === 'support') ?? sides.find((x) => x.s === 'neutral');
    if (sup && side !== 'test') {
      if (!systems.includes(sup.r.system)) systems.push(sup.r.system);
      dashaPts += FAMILY_WEIGHTS[fam] * (sup.s === 'support' ? 1 : 0.5);
    } else if (sides.every((x) => x.s === 'test')) {
      contradicts.push(sides[0]!.r.system);
      dashaPts -= FAMILY_WEIGHTS[fam];
    }
  }
  if (adD1Side === 'test' && !fBonus.isCrisis && contradicts.length > 0 && systems.length === 1) {
    side = fBonus.pts >= 5 ? 'neutral' : 'test';
  }

  // Annual charts (TP / VP) overlapping [win.from, win.to]
  let annualPts = 0;
  const annualYears: string[] = [];
  for (const y of yearsOf(win.from, win.to)) {
    for (const a of annualFn(y)) {
      if (a.varga !== 'D1') continue;
      const s = annualSide(view, a, primary);
      if (s?.side === 'support') {
        annualPts = Math.max(annualPts, ANNUAL_WEIGHTS.TP + ANNUAL_WEIGHTS.VP);
        const tag = `${a.kind}${a.year}`;
        if (!annualYears.includes(tag)) annualYears.push(tag);
      } else if (s?.side === 'test' && side === 'test') {
        const tag = `${a.kind}${a.year}`;
        if (!annualYears.includes(tag)) annualYears.push(tag);
      }
    }
  }

  // Transit gates (SkyView) overlapping [win.from, win.to]
  let transitOpen = false;
  const transitHouses: number[] = [];
  const skyKnown = Boolean(sky && overlaps(win, sky));
  if (skyKnown && sky) {
    for (const g of sky.gates) {
      if (overlaps(g, win)) {
        for (const h of g.houses) {
          if (area.houses.includes(h) && !transitHouses.includes(h)) transitHouses.push(h);
        }
        if (g.houses.includes(primary)) transitOpen = true;
      }
    }
    for (const sl of sky.slow) {
      if (overlaps(sl, win) && area.houses.includes(sl.house) && !transitHouses.includes(sl.house)) {
        transitHouses.push(sl.house);
      }
    }
  }
  const transitPts = transitOpen ? LAYER_WEIGHTS.transit : 0;
  const rawScore = Math.round(Math.max(5, Math.min(100, promisePts + Math.max(0, dashaPts) + annualPts + transitPts)));

  const corePrimaryHit = touchesAd && adCoreHouses.has(primary);
  const adPrimaryHit = touchesAd && adHouses.has(primary);
  const coreHits = area.houses.filter((h) => adCoreHouses.has(h)).length;
  const adHits = area.houses.filter((h) => adHouses.has(h)).length;
  const mdOverlapHits = area.houses.filter((h) => adHouses.has(h) && (mdTouch.houseWeights.get(h) ?? 0) >= 2).length;
  const rankScore =
    (touchesAd ? 100 : 0) +
    (corePrimaryHit ? 45 : adPrimaryHit ? 25 : 0) +
    coreHits * 12 +
    adHits * 5 +
    mdOverlapHits * 6 +
    (systems.length - 1) * 8 -
    contradicts.length * 6 +
    annualPts * 1.5 +
    transitPts * 1.5 +
    promisePts * 0.35;

  return {
    area,
    promise,
    score: rawScore,
    rankScore,
    touchesAd,
    side,
    systems,
    contradicts,
    annualConfirms: annualPts > 0,
    annualYears,
    transitOpen,
    transitHouses,
    skyKnown,
  };
}

function buildAdHeadline(tone: LifeAntardashaTone, topAreas: ScoredAdArea[], from: string, to: string): string {
  const names = topAreas.slice(0, 2).map((x) => x.area.words);
  const focus = names.length ? joinPhrases(names) : 'your main priorities';
  switch (tone) {
    case 'breakthrough':
      return `From ${longDate(from)} to ${longDate(to)}, doors open around ${focus} as your birth promise and multiple timing clocks align.`;
    case 'build':
      return `From ${longDate(from)} to ${longDate(to)}, steady forward movement builds around ${focus} when you act on prepared plans.`;
    case 'careful':
      return `From ${longDate(from)} to ${longDate(to)}, this stretch around ${focus} calls for patience, clear boundaries, and careful preparation before big moves.`;
    case 'steady_work':
      return `From ${longDate(from)} to ${longDate(to)}, consistent effort around ${focus} lays the groundwork for the stronger windows ahead.`;
  }
}

function buildAdAreaNote(s: ScoredAdArea, tone: LifeAntardashaTone, from: string, to: string): LifeAntardashaAreaNote {
  const { area, promise, side, systems, annualConfirms, transitOpen } = s;
  const isSupport = side !== 'test' && tone !== 'careful';

  let summary: string;
  if (isSupport && promise.verdict === 'promised') {
    summary = `Your birth and deeper charts strongly back ${area.words}, and this sub-period activates that promise directly.`;
  } else if (isSupport && promise.verdict === 'partial') {
    summary = `This sub-period opens practical progress in ${area.words}, rewarding steady preparation even where results take extra effort.`;
  } else if (isSupport) {
    summary = `This sub-period brings a modest opening for ${area.words}; keep aims realistic and lock in incremental gains.`;
  } else if (promise.verdict === 'promised') {
    summary = `Although your chart holds strong long-term promise for ${area.words}, this sub-period tests pacing and asks you not to rush.`;
  } else {
    summary = `This sub-period puts extra weight on ${area.words}; protect your baseline and avoid hard-to-undo commitments.`;
  }

  const clockCount = systems.length;
  const confirmParts: string[] = [
    clockCount > 1 ? `confirmed across ${clockCount} timing systems` : 'marked by your primary timing clock',
  ];
  if (annualConfirms) confirmParts.push('backed by the year chart');
  if (transitOpen) confirmParts.push('supported by the sky');
  const timing = `${longDate(from)} to ${longDate(to)} (${confirmParts.join(', ')}).`;

  const action = isSupport ? AD_AREA_ACTION[area.id].support : AD_AREA_ACTION[area.id].test;
  return {
    id: area.id,
    label: area.label,
    verdict: promise.verdict,
    summary,
    timing,
    action,
  };
}

function buildAntardashaTimeline(
  view: DigestView,
  md: MdCandidate,
  mdTouch: MdTouchMap,
  areas: CharterAreaInput[],
  input: CharterInputs,
): { rows: LifeAntardashaRow[]; scoredByArea: Map<LifeAreaId, Array<{ from: string; to: string; tone: LifeAntardashaTone; score: number }>> } {
  const maxAreas = getLifeCharterMaxAreasPerAd();
  const mdCard = view.planet('D1', md.lord);
  const spanFrom = md.from < input.today ? input.today : md.from;
  const span = { from: spanFrom, to: md.to };
  const inSpan = input.rows.filter((r) => overlaps(r, span));

  let vim2 = inSpan
    .filter((r) => r.family === 'vimshottari' && r.level === 2 && (!r.parentLord || r.parentLord === md.lord) && r.to > spanFrom && r.from < md.to)
    .sort((a, b) => a.from.localeCompare(b.from));

  if (!vim2.length) {
    // Fallback when only level-1 row is stored
    vim2 = [
      {
        system: 'vimshottari',
        family: 'vimshottari',
        level: 2,
        lord: md.lord,
        parentLord: md.lord,
        sign: null,
        from: spanFrom,
        to: md.to,
        houses: md.houses,
      },
    ];
  }

  const scoredByArea = new Map<LifeAreaId, Array<{ from: string; to: string; tone: LifeAntardashaTone; score: number }>>();
  const out: LifeAntardashaRow[] = [];

  for (const adRow of vim2) {
    const adLord = adRow.lord ?? md.lord;
    const from = adRow.from < input.today ? input.today : adRow.from;
    const to = adRow.to > md.to ? md.to : adRow.to;
    if (to <= from) continue;
    const win = { from, to };
    const isCurrent = covers(adRow, input.today);

    const cell = mdCard?.dashaCharter?.fruition?.[adLord];
    const fBonus = fruitionBonus(cell);

    const scored: ScoredAdArea[] = [];
    for (const { area, promise } of areas) {
      const s = scoreAdForArea(view, area, promise, md.lord, adRow, win, mdTouch, fBonus, inSpan, input.annual, input.sky);
      if (s) scored.push(s);
    }

    // Fallback if no area met the house filter: score the top promised areas
    if (!scored.length) {
      for (const { area, promise } of areas.slice(0, maxAreas)) {
        const fallbackScore = Math.round(
          (LAYER_WEIGHTS.d1 + LAYER_WEIGHTS.varga) * promise.promiseRatio + FAMILY_WEIGHTS.vimshottari,
        );
        scored.push({
          area,
          promise,
          score: fallbackScore,
          rankScore: fallbackScore,
          touchesAd: false,
          side: planetSide(view.planet('D1', adLord)),
          systems: ['vimshottari'],
          contradicts: [],
          annualConfirms: false,
          annualYears: [],
          transitOpen: false,
          transitHouses: [],
          skyKnown: Boolean(input.sky && overlaps(win, input.sky)),
        });
      }
    }

    scored.sort((a, b) => b.rankScore - a.rankScore || b.score - a.score);
    const top = scored.slice(0, maxAreas);
    const best = [...top].sort((a, b) => b.score - a.score)[0]!;
    const anySupport = top.some((x) => x.side === 'support');
    const allTest = top.every((x) => x.side === 'test');

    let tone: LifeAntardashaTone;
    if (fBonus.isCrisis || (allTest && !fBonus.isSupportive)) {
      tone = 'careful';
    } else if (best.score >= 70 && anySupport && best.promise.verdict === 'promised') {
      tone = 'breakthrough';
    } else if (best.score >= 55 && anySupport) {
      tone = 'build';
    } else if (allTest) {
      tone = 'careful';
    } else {
      tone = 'steady_work';
    }

    for (const s of top) {
      const list = scoredByArea.get(s.area.id) ?? [];
      list.push({ from, to, tone, score: s.score });
      scoredByArea.set(s.area.id, list);
    }

    const grade = gradeOf(best.score);
    const basis = basisOf({
      grade,
      systems: best.systems,
      contradicts: best.contradicts,
      annual: best.annualConfirms ? 'confirms' : 'silent',
      transit: !best.skyKnown ? 'unknown' : best.transitOpen ? 'open' : 'closed',
    });

    const allSystems = [...new Set(top.flatMap((x) => x.systems))].map(systemName);
    const allAnnuals = [...new Set(top.flatMap((x) => x.annualYears))];
    const allTransits = [...new Set(top.flatMap((x) => x.transitHouses))].sort((a, b) => a - b);

    out.push({
      from,
      to,
      is_current: isCurrent,
      tone,
      headline: buildAdHeadline(tone, top, from, to),
      areas: top.map((s) => buildAdAreaNote(s, tone, from, to)),
      grade,
      basis,
      evidence: {
        md: planetName(md.lord),
        ad: planetName(adLord),
        house_from_md: cell?.houseFromMd ?? null,
        fruition_class: cell?.fruitionClass ?? null,
        links: fBonus.links,
        systems: allSystems,
        annual_years: allAnnuals,
        transit_houses: allTransits,
      },
    });
  }

  return { rows: out, scoredByArea };
}

function buildAreaCharters(
  view: DigestView,
  md: MdCandidate,
  mdTouch: MdTouchMap,
  areas: CharterAreaInput[],
  scoredByArea: Map<LifeAreaId, Array<{ from: string; to: string; tone: LifeAntardashaTone; score: number }>>,
): LifeAreaCharter[] {
  const ranked = areas
    .map(({ area, promise }) => {
      const touchW = area.houses.reduce((s, h) => s + (mdTouch.houseWeights.get(h) ?? 0), 0);
      const adEntries = scoredByArea.get(area.id) ?? [];
      const maxAdScore = adEntries.reduce((m, x) => Math.max(m, x.score), promise.score);
      const priority = touchW * 8 + promise.score * 0.6 + (adEntries.length ? 15 : 0);
      return { area, promise, touchW, adEntries, maxAdScore, priority };
    })
    .filter((x) => x.touchW > 0 || x.adEntries.length > 0 || x.promise.verdict === 'promised')
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  return ranked.map(({ area, promise, adEntries, maxAdScore }) => {
    const supportAds = adEntries
      .filter((x) => x.tone === 'breakthrough' || x.tone === 'build')
      .sort((a, b) => b.score - a.score);
    const watchAds = adEntries.filter((x) => x.tone === 'careful').sort((a, b) => a.from.localeCompare(b.from));

    const peak = supportAds[0] ?? null;
    const watch = watchAds[0] ?? null;

    let role: LifeCharterRole;
    if (promise.verdict === 'promised' && (peak || promise.score >= 65)) {
      role = 'anchor';
    } else if (promise.verdict === 'not_written' || (!peak && watch)) {
      role = 'guarded';
    } else {
      role = 'growth';
    }

    let theme: string;
    if (role === 'anchor') {
      theme = `Around ${area.words}, this long chapter forms a defining pillar, with strong backing to build lasting results.`;
    } else if (role === 'growth') {
      theme = peak
        ? `Around ${area.words}, progress builds step by step across this chapter, rewarding patient preparation during the opening windows.`
        : `Around ${area.words}, progress builds step by step across this chapter through steady, consistent effort.`;
    } else {
      theme = `Around ${area.words}, this chapter calls for steady boundaries and realistic pacing so small strains do not compound.`;
    }

    let promiseNote: string;
    if (promise.verdict === 'promised') {
      promiseNote = `Your birth chart and deeper charts both support ${area.words}, giving a solid foundation when timing aligns.`;
    } else if (promise.verdict === 'partial') {
      promiseNote = `Your birth and deeper charts give mixed support for ${area.words}: progress comes through steady effort and picking the right dates.`;
    } else {
      promiseNote = `Your birth and deeper charts ask for modest expectations around ${area.words}; protecting stability matters more than big bets.`;
    }

    const grade = gradeOf(maxAdScore);
    const basis =
      role === 'anchor'
        ? peak
          ? `${grade}: backed by birth and deeper charts with confirmed opening windows across this chapter`
          : `${grade}: backed by birth and deeper charts across this chapter`
        : role === 'growth'
          ? `${grade}: partial chart backing that strengthens during specific sub-periods`
          : `${grade}: tested in the chart, best handled with steady boundaries`;

    const owning = owningVargaOf(view, area);
    const vargas = ['D1', 'D9', ...(owning ? [owning] : [])];
    const planets = [...new Set([md.lord, ...promise.helpers.slice(0, 2), ...promise.withholding.slice(0, 2)])].map(planetName);
    const yogas = mdTouch.yogas
      .filter((y) => y.houses.some((h) => area.houses.includes(h)))
      .map((y) => y.name);

    return {
      id: area.id,
      label: area.label,
      role,
      verdict: promise.verdict,
      theme,
      promise_note: promiseNote,
      peak_from: peak?.from ?? null,
      peak_to: peak?.to ?? null,
      watch_from: watch?.from ?? null,
      watch_to: watch?.to ?? null,
      guidance: AREA_CHARTER_GUIDANCE[area.id][role],
      grade,
      basis,
      evidence: {
        houses: area.houses,
        vargas,
        planets,
        yogas,
      },
    };
  });
}

/**
 * Builds the complete `LifeMahadashaCharter` for the individual's remaining largest Mahadasha (10–18+ yrs) and its
 * chronological Antardashas.
 */
export function buildMahadashaCharter(
  view: DigestView,
  areas: CharterAreaInput[],
  input: CharterInputs,
): LifeMahadashaCharter | null {
  const sel = selectCharterMahadasha(input.rows, input.today);
  if (!sel) return null;

  const { primary, bridge } = sel;
  const mdTouch = buildMdTouchMap(view, primary.lord, primary.houses);
  const { rows: antardashas, scoredByArea } = buildAntardashaTimeline(view, primary, mdTouch, areas, input);
  if (!antardashas.length) return null;

  const areaCharters = buildAreaCharters(view, primary, mdTouch, areas, scoredByArea);
  const anchors = areaCharters.filter((a) => a.role === 'anchor').map((a) => a.label.toLowerCase());
  const growth = areaCharters.filter((a) => a.role === 'growth').map((a) => a.label.toLowerCase());
  const guarded = areaCharters.filter((a) => a.role === 'guarded').map((a) => a.label.toLowerCase());

  const focusList = (anchors.length ? anchors : growth).slice(0, 2);
  const focusText = focusList.length ? joinPhrases(focusList) : 'your core life priorities';
  const effFrom = primary.from < input.today ? input.today : primary.from;

  const headline = primary.isCurrent
    ? `Your current major chapter runs until ${longDate(primary.to)} (${primary.remainingYears} years ahead), centering on ${focusText}.`
    : `Your largest upcoming chapter runs from ${longDate(primary.from)} to ${longDate(primary.to)} (${primary.remainingYears} years), centering on ${focusText}.`;

  const summaryParts: string[] = [];
  if (anchors.length) {
    summaryParts.push(
      `Across these years, your birth and deeper charts carry their strongest promise in ${joinPhrases(anchors.slice(0, 3))}.`,
    );
  }
  if (growth.length) {
    summaryParts.push(
      `Steady, cumulative progress builds in ${joinPhrases(growth.slice(0, 2))} when you pace your moves to the stronger sub-periods.`,
    );
  }
  if (guarded.length) {
    summaryParts.push(
      `Keep extra patience and clear boundaries around ${joinPhrases(guarded.slice(0, 2))}, especially during the careful sub-periods marked below.`,
    );
  }
  const charterSummary =
    summaryParts.join(' ') ||
    `This ${primary.remainingYears}-year chapter unfolds through ${antardashas.length} distinct sub-periods, each shifting which part of your life steps to the front.`;

  let bridgeOut: LifeMahadashaBridge | null = null;
  if (bridge) {
    const bridgeTouch = buildMdTouchMap(view, bridge.lord, bridge.houses);
    const { rows: bridgeAds } = buildAntardashaTimeline(view, bridge, bridgeTouch, areas, input);
    if (bridgeAds.length) {
      const bFrom = bridge.from < input.today ? input.today : bridge.from;
      bridgeOut = {
        from: bFrom,
        to: bridge.to,
        remaining_years: bridge.remainingYears,
        summary: `Before your next major chapter begins on ${longDate(primary.from)}, the next ${bridge.remainingYears} years (${longDate(bFrom)} to ${longDate(bridge.to)}) close out your current chapter and set the stage.`,
        antardashas: bridgeAds,
      };
    }
  }

  return {
    from: effFrom,
    to: primary.to,
    remaining_years: primary.remainingYears,
    total_years: primary.totalYears,
    is_current: primary.isCurrent,
    headline,
    charter_summary: charterSummary,
    area_charters: areaCharters,
    antardashas,
    bridge: bridgeOut,
    evidence: {
      md: planetName(primary.lord),
      own_houses: mdTouch.ownHouses,
      placed_house: mdTouch.placedHouse,
      dispositor: mdTouch.dispositor ? planetName(mdTouch.dispositor) : null,
      star_lord: mdTouch.starLord ? planetName(mdTouch.starLord) : null,
      avastha: mdTouch.avastha,
    },
  };
}
