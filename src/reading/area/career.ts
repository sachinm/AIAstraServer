/**
 * The career map, Phase 1 (docs/reading-engine/42 §B.4, 43 §2 and §6–§8, 45 §7). Deterministic and model-free.
 *
 * Input is a timeline grid built over 24 months back to 24 months ahead (src/reading/timeline/pipeline.ts
 * `buildTimelineSpan`), whose every activation comes from the engine's stored dashas, house table and transit contacts.
 * This module only reads that grid: it groups the systems into the voting families of doc 43 §8.1, decides the present
 * tone (demanding · easing · steady · closing · open) with a confidence, grades job security per month (doc 43 §6–§7),
 * labels the windows ahead by career sub-area (Tier 1 of doc 43 §2), builds the horizons and picks the Looking-back
 * moments (doc 45 §9). Planet and house facts are read from the foundation (the engine's dossier); nothing is derived.
 *
 * Phase 1 limits, stated in `notes`: the conditional-dasha, annual (Tithi Pravesha) and karaka-dasha families are not
 * built yet, so the confidence thresholds scale to the families available; the D10 check of doc 43 §8.1 waits for the
 * house-state engine (doc 46).
 */
import type { PastBuild } from '../timeline/pipeline.js';
import type { MonthCell, TimelineWindow } from '../timeline/converge.js';
import { BAND_ORDER } from '../timeline/converge.js';
import type { MarkerId } from '../timeline/markers.js';
import { addDaysIso, addMonthsIso, monthEnd, monthOf, monthStart } from '../timeline/months.js';
import type { Band, SystemId } from '../timeline/types.js';
import type { DigestView } from '../digest/types.js';
import type { ActivationRow } from '../digest/activation.js';
import { currentYear, hasClass, isBad, isGood } from './houseLayers.js';

export type Tone = 'demanding' | 'easing' | 'steady' | 'closing' | 'open';
export type Confidence = 'confirmed' | 'likely' | 'split';
export type Side = 'support' | 'test' | 'neutral';
export type SecurityGrade = 'clear_protected' | 'clear' | 'watch' | 'risk' | 'high_risk';

/** The voting families available in Phase 1 (doc 43 §8.1 rows 1, 3, 4/7-modifier, 6, 7). */
export const FAMILIES: Array<{ id: string; label: string; systems: SystemId[]; mode: 'any' | 'agree' }> = [
  { id: 'main', label: 'Main clock', systems: ['S1'], mode: 'any' },
  { id: 'rasi', label: 'Sign clock', systems: ['S4'], mode: 'any' },
  { id: 'short', label: 'Short clocks', systems: ['S2', 'S3'], mode: 'agree' },
  { id: 'transit', label: 'Slow transits', systems: ['S6', 'S6D'], mode: 'any' },
  { id: 'jaimini', label: 'Jaimini points', systems: ['S7'], mode: 'any' },
];
export const FAMILIES_NOT_BUILT = ['conditional clock', "this year's chart", 'karaka clock'];
const FAMILIES_NOT_BUILT_BY_ID: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'conditional', label: 'conditional clock' },
  { id: 'annual', label: "this year's chart" },
  { id: 'karaka', label: 'karaka clock' },
];

export interface FamilyVote {
  family: string;
  label: string;
  vote: Side;
  /** the planet the strongest system named on the winning side */
  planet: string | null;
}

export interface PresentState {
  tone: Tone;
  confidence: Confidence;
  votes: FamilyVote[];
  available: number;
  agree: number;
  /** the first day the pressure lifts (demanding/easing); null when not inside the span */
  ease_date: string | null;
  /** the last day of the current open window (open/closing) */
  window_end: string | null;
  /** the first day of the next open window (steady/demanding) */
  next_window_start: string | null;
  security: SecurityGrade;
}

export interface SubareaWindow {
  subarea: string;
  side: 'support' | 'test';
  from: string;
  to: string;
  peakMonth: string;
  band: Exclude<Band, 'quiet'>;
  score: number;
  /** distinct families with an open gate at the peak */
  families: string[];
  drivers: string[];
  security?: SecurityGrade;
}

export interface CareerMap {
  asOf: string;
  month: string;
  present: PresentState;
  ahead: SubareaWindow[];
  horizons: Array<{ months: 1 | 3 | 6 | 12; best: SubareaWindow | null; hardest: SubareaWindow | null; quiet: boolean }>;
  security: Array<{ month: string; grade: SecurityGrade }>;
  back: Array<{ month: string; side: 'support' | 'test'; band: Exclude<Band, 'quiet'>; label: string }>;
  notes: string[];
}

const PRIMARY: MarkerId = 'career';
const BAND_MIN = (b: Band, min: Band) => BAND_ORDER[b] >= BAND_ORDER[min];

function familyVote(cells: MonthCell[]): FamilyVote[] {
  return FAMILIES.map((f) => {
    const perSystem = f.systems.map((s) => {
      let sup = 0;
      let tst = 0;
      let planet: string | null = null;
      for (const c of cells) {
        const sc = c.systems[s];
        if (!sc) continue;
        sup += sc.support;
        tst += sc.test;
        planet = planet ?? sc.planet;
      }
      const vote: Side = sup - tst >= 0.5 ? 'support' : tst - sup >= 0.5 ? 'test' : 'neutral';
      return { vote, planet, active: sup + tst > 0 };
    });
    const active = perSystem.filter((p) => p.active);
    let vote: Side = 'neutral';
    if (f.mode === 'any') {
      const sides = active.map((p) => p.vote).filter((v) => v !== 'neutral');
      if (sides.length && sides.every((v) => v === sides[0])) vote = sides[0]!;
    } else if (active.length === f.systems.length && active.every((p) => p.vote === active[0]!.vote)) vote = active[0]!.vote;
    return { family: f.id, label: f.label, vote, planet: active.find((p) => p.vote === vote)?.planet ?? null };
  });
}

/** Lords that make a test a job-end signal (doc 43 §6): 12th and 8th from the 10th (9th, 5th), 6th, 8th, 12th from the lagna. */
function endLords(build: PastBuild): Set<string> {
  const f = build.foundation;
  const out = new Set<string>();
  for (const h of [9, 5, 6, 8, 12]) {
    const card = f.houses[h];
    if (card?.lord) out.add(card.lord);
  }
  return out;
}

function driversOf(c: Pick<MonthCell, 'systems'>): string[] {
  const out: string[] = [];
  for (const s of ['S1', 'S4', 'S6', 'S6D', 'S2', 'S3'] as SystemId[]) {
    const p = c.systems[s]?.planet;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

function familiesOf(c: Pick<MonthCell, 'systems'>): string[] {
  return FAMILIES.filter((f) => f.systems.some((s) => (c.systems[s]?.support ?? 0) + (c.systems[s]?.test ?? 0) > 0)).map((f) => f.id);
}

export function securityGrade(c: MonthCell, ends: Set<string>): SecurityGrade {
  if (!c.testing) return BAND_MIN(c.band, 'moderate') ? 'clear_protected' : 'clear';
  const gate = driversOf(c).some((p) => ends.has(p) || p === 'Ra' || p === 'Ke' || p === 'Sa');
  if (gate && c.band === 'high') return 'high_risk';
  if (gate && BAND_MIN(c.band, 'moderate')) return 'risk';
  return 'watch';
}

const testingAt = (cells: MonthCell[], i: number, min: Band = 'possible') => !!cells[i] && cells[i]!.testing && BAND_MIN(cells[i]!.band, min);
const supportAt = (cells: MonthCell[], i: number, min: Band = 'moderate') => !!cells[i] && !cells[i]!.testing && BAND_MIN(cells[i]!.band, min);

export interface CareerDigestInput {
  view?: DigestView | null;
  activation?: ActivationRow[];
}

export interface D10CheckResult {
  planet: string;
  d1Side: Side;
  d10Side: Side;
  d9Side: Side;
  agrees: boolean;
  split: boolean;
}

const CAREER_HOUSES = [10, 6, 1, 2, 11];
const WORK_DUSTHANA = [6, 8, 12];
const GOOD_CLASS = /kendra|trikona/i;
const BAD_CLASS = /dusthana/i;

function planetSideInVarga(view: DigestView, varga: string, planet: string): Side {
  const p = view.planet(varga, planet);
  if (!p) return 'neutral';
  let score = 0;
  if (isGood(p.dignity)) score += 1;
  else if (isBad(p.dignity)) score -= 1;
  if (p.house != null) {
    const hCard = view.house(varga, p.house);
    if (p.house === 10 || p.house === 1 || p.house === 11 || hasClass(hCard, GOOD_CLASS)) score += 1;
    else if (WORK_DUSTHANA.includes(p.house) || hasClass(hCard, BAD_CLASS)) score -= 1;
  }
  return score >= 1 ? 'support' : score <= -1 ? 'test' : 'neutral';
}

/**
 * work.d10_check (doc 43 §8.1, doc 46 §B.7, doc 53 §4.5):
 * Checks whether D1 and D10 agree on a running period lord's career side, with D9 breaking a tie when one is neutral.
 * When D1 and D10 directly oppose each other (one support, one test), `split` is true and the vote does not count.
 */
export function workD10Check(view: DigestView, planet: string): D10CheckResult {
  const d1Side = planetSideInVarga(view, 'D1', planet);
  const d10Side = planetSideInVarga(view, 'D10', planet);
  const d9Side = planetSideInVarga(view, 'D9', planet);
  const split = (d1Side === 'support' && d10Side === 'test') || (d1Side === 'test' && d10Side === 'support');
  const agrees = !split && (d1Side === d10Side ? d1Side !== 'neutral' : d9Side !== 'neutral');
  return { planet, d1Side, d10Side, d9Side, agrees, split };
}

/**
 * work.annual_family (doc 43 §8.1 family 5, doc 46 §B.6, doc 53 §4.5):
 * Reads the current year's TP/VP chart (D1 and D10), the running Mudda/Patyayini/year dasha lord, and the rajya/karma
 * sahams to cast the annual family's vote.
 */
export function workAnnualVote(view: DigestView, asOf: string): FamilyVote | null {
  const yr = currentYear(view, asOf);
  if (!yr) return null;
  const d10Yr = view.annual(yr.year).find((a) => a.kind === yr.kind && a.varga === 'D10') ?? null;
  let score = 0;
  let leadPlanet: string | null = null;
  for (const h of [10, 1, 6, 2, 11]) {
    const c = yr.houses.find((x) => x.house === h);
    if (!c || c.lordHouse == null) continue;
    if (h === 10 && c.lord) leadPlanet = c.lord;
    const at = yr.houses.find((x) => x.house === c.lordHouse);
    if ((c.lordHouse === h || hasClass(at, GOOD_CLASS)) && !isBad(c.lordDignity)) score += h === 10 ? 1.5 : 0.5;
    else if (c.lordHouse !== h && hasClass(at, BAD_CLASS)) score -= h === 10 ? 1.5 : 0.5;
  }
  if (d10Yr) {
    const h10 = d10Yr.houses.find((x) => x.house === 10);
    if (h10?.lordHouse != null) {
      const at10 = d10Yr.houses.find((x) => x.house === h10.lordHouse);
      if ((h10.lordHouse === 10 || hasClass(at10, GOOD_CLASS)) && !isBad(h10.lordDignity)) score += 1;
      else if (hasClass(at10, BAD_CLASS)) score -= 1;
    }
  }
  for (const d of yr.dashas) {
    for (const p of d.periods) {
      if (p.from <= asOf && asOf < p.to && p.lord) {
        leadPlanet = leadPlanet ?? p.lord;
        const side = planetSideInVarga(view, 'D10', p.lord);
        if (side === 'support') score += 1;
        else if (side === 'test') score -= 1;
      }
    }
  }
  for (const s of yr.sahams) {
    const name = s.name.toLowerCase();
    if (name !== 'rajya' && name !== 'karma' && name !== 'punya' && name !== 'yasas') continue;
    if (s.house == null) continue;
    const at = yr.houses.find((x) => x.house === s.house);
    if (hasClass(at, GOOD_CLASS)) score += 1;
    else if (hasClass(at, BAD_CLASS)) score -= 1;
  }
  const vote: Side = score >= 1 ? 'support' : score <= -1 ? 'test' : 'neutral';
  return { family: 'annual', label: "This year's chart", vote, planet: leadPlanet };
}

/**
 * work.conditional_family (doc 43 §8.1 family 2, doc 46 §B.4, doc 53 §4.5):
 * Reads running conditional dasha rows activating career houses and casts the conditional clock vote.
 */
export function workConditionalVote(view: DigestView, activation: ActivationRow[], asOf: string, seenPlanets?: Set<string>): FamilyVote | null {
  const rows = activation.filter((r) => r.family === 'conditional' && r.from <= asOf && asOf < r.to && r.lord);
  if (!rows.length) return null;
  let score = 0;
  let leadPlanet: string | null = null;
  for (const r of rows) {
    const p = r.lord!;
    if (seenPlanets?.has(p)) continue;
    const check = workD10Check(view, p);
    if (check.split) continue;
    leadPlanet = leadPlanet ?? p;
    const w = r.level === 1 ? 1 : r.level === 2 ? 1.5 : 0.75;
    const touchesCareer = r.houses.some((h) => CAREER_HOUSES.includes(h));
    const touchesDusthana = r.houses.some((h) => r.houses.length === 1 && WORK_DUSTHANA.includes(h));
    if (check.d1Side === 'support' || check.d10Side === 'support' || (touchesCareer && !touchesDusthana)) score += w;
    else if (check.d1Side === 'test' || check.d10Side === 'test' || touchesDusthana) score -= w;
  }
  if (leadPlanet && seenPlanets) seenPlanets.add(leadPlanet);
  const vote: Side = score >= 0.5 ? 'support' : score <= -0.5 ? 'test' : 'neutral';
  return { family: 'conditional', label: 'Conditional clock', vote, planet: leadPlanet };
}

/**
 * work.karaka_family (doc 43 §8.1 family 4, doc 46 §B.4, doc 53 §4.5):
 * Reads running karaka dasha rows; AmK or the 10th lord running gives support unless afflicted in D10.
 */
export function workKarakaVote(view: DigestView, activation: ActivationRow[], asOf: string, seenPlanets?: Set<string>): FamilyVote | null {
  const rows = activation.filter((r) => r.family === 'karaka' && r.from <= asOf && asOf < r.to && r.lord);
  if (!rows.length) return null;
  const h10Lord = view.house('D1', 10)?.lord ?? null;
  const amkRow = view.points('D1').find((p) => p.id === 'AmK');
  const amkPlanet = (amkRow as unknown as { planet?: string } | undefined)?.planet ?? amkRow?.lord ?? null;
  let score = 0;
  let leadPlanet: string | null = null;
  for (const r of rows) {
    const p = r.lord!;
    if (seenPlanets?.has(p)) continue;
    const check = workD10Check(view, p);
    if (check.split) continue;
    leadPlanet = leadPlanet ?? p;
    if ((p === amkPlanet || p === h10Lord) && check.d10Side !== 'test') score += 1.5;
    else if (check.d10Side === 'test' || check.d1Side === 'test') score -= 1;
    else if (r.houses.includes(10)) score += 1;
  }
  if (leadPlanet && seenPlanets) seenPlanets.add(leadPlanet);
  const vote: Side = score >= 0.5 ? 'support' : score <= -0.5 ? 'test' : 'neutral';
  return { family: 'karaka', label: 'Karaka clock', vote, planet: leadPlanet };
}

export function presentState(build: PastBuild, cells: MonthCell[], i: number, digest?: CareerDigestInput): PresentState {
  const ends = endLords(build);
  const now = cells.slice(Math.max(0, i - 1), i + 2);
  const votes = familyVote(now);
  let extraAvailable = 0;
  if (digest?.view) {
    const view = digest.view;
    const seenPlanets = new Set<string>();
    const mainVote = votes.find((v) => v.family === 'main');
    if (mainVote?.planet) {
      const check = workD10Check(view, mainVote.planet);
      if (check.split) mainVote.vote = 'neutral';
      else seenPlanets.add(mainVote.planet);
    }
    const asOf = cells[i] ? `${cells[i]!.month}-15` : '2026-10-15';
    const actRows = digest.activation ?? [];
    const cond = workConditionalVote(view, actRows, asOf, seenPlanets);
    if (cond) {
      votes.push(cond);
      extraAvailable += 1;
    }
    const kar = workKarakaVote(view, actRows, asOf, seenPlanets);
    if (kar) {
      votes.push(kar);
      extraAvailable += 1;
    }
    const ann = workAnnualVote(view, asOf);
    if (ann) {
      votes.push(ann);
      extraAvailable += 1;
    }
  }
  const available = FAMILIES.filter((f) => f.systems.some((s) => build.systems.includes(s) && build.activations.some((a) => a.system === s))).length + extraAvailable;
  const tests = votes.filter((v) => v.vote === 'test').length;
  const supports = votes.filter((v) => v.vote === 'support').length;
  const security = cells[i] ? securityGrade(cells[i]!, ends) : 'clear';

  // the end of the current test run, and the next support window
  let j = i;
  while (testingAt(cells, j)) j++;
  const easeIdx = j > i ? j : null;
  let k = i;
  while (supportAt(cells, k)) k++;
  const supportEndIdx = k > i ? k - 1 : null;
  let n = i + 1;
  while (n < cells.length && !supportAt(cells, n)) n++;
  const nextIdx = n < cells.length ? n : null;

  const demanding = security === 'risk' || security === 'high_risk' || (testingAt(cells, i, 'moderate') && tests >= 2) || (testingAt(cells, i) && tests >= 2 && supports < 2);
  const clearing = demanding && easeIdx !== null && easeIdx - i <= 1 && !testingAt(cells, easeIdx, 'moderate') && !testingAt(cells, easeIdx + 1, 'moderate');
  const open = supportAt(cells, i) && supports >= 2 && !demanding;
  const closing = open && supportEndIdx !== null && supportEndIdx === i && (testingAt(cells, i + 1, 'moderate') || testingAt(cells, i + 2, 'moderate'));

  // tie-break, highest first (doc 43 §8): security storm → clearing → storm → late summer → fair → calm
  const tone: Tone = clearing ? 'easing' : demanding ? 'demanding' : closing ? 'closing' : open ? 'open' : 'steady';
  const side: Side = tone === 'demanding' || tone === 'easing' ? 'test' : tone === 'open' || tone === 'closing' ? 'support' : 'neutral';
  const agree = side === 'neutral' ? votes.filter((v) => v.vote === 'neutral').length : side === 'test' ? tests : supports;
  const mainAgrees = votes.find((v) => v.family === 'main')?.vote === side;
  let confidence: Confidence;
  if (side === 'neutral') confidence = tests >= 2 && supports >= 2 ? 'split' : supports >= 2 || tests >= 2 ? 'likely' : 'confirmed';
  else if (agree >= Math.max(3, Math.ceil(available * 0.6)) && mainAgrees) confidence = 'confirmed';
  else if (agree >= 2 && agree > (side === 'test' ? supports : tests)) confidence = 'likely';
  else confidence = 'split';

  const ms = (idx: number | null) => (idx === null || !cells[idx] ? null : monthStart(cells[idx]!.month));
  const me = (idx: number | null) => (idx === null || !cells[idx] ? null : addDaysIso(monthEnd(cells[idx]!.month), -1));
  return {
    tone,
    confidence,
    votes,
    available,
    agree,
    ease_date: side === 'test' ? ms(easeIdx) : null,
    window_end: side === 'support' ? me(supportEndIdx) : null,
    next_window_start: side !== 'support' ? ms(nextIdx) : null,
    security,
  };
}

/** Tier 1 sub-areas of doc 43 §2 for a career-side window, from the planets that drive its peak. */
function careerSubareas(build: PastBuild, w: TimelineWindow): string[] {
  if (w.testing) return ['job_security'];
  const f = build.foundation;
  const lord = (h: number) => f.houses[h]?.lord ?? null;
  const drivers = driversOf(w);
  const gl = f.specialLagnas['GL'];
  const glLord = gl ? f.houses[gl.house]?.lord ?? null : null;
  const out: string[] = [];
  if (drivers.some((p) => p === lord(10) || p === 'Su' || p === lord(11) || (glLord && p === glLord))) out.push('promotion');
  if (w.systems.S4 || drivers.some((p) => p === 'Ra' || p === lord(12) || p === lord(3) || p === lord(9))) out.push('job_change');
  out.push('get_job');
  return out;
}

function toWindow(subarea: string, w: TimelineWindow, extra: Partial<SubareaWindow> = {}): SubareaWindow {
  return {
    subarea,
    side: w.testing ? 'test' : 'support',
    from: w.from,
    to: addDaysEx(w.to),
    peakMonth: w.peakMonth,
    band: w.band,
    score: Math.round((w.testing ? w.testScore : w.supportScore) * 10) / 10,
    families: familiesOf(w),
    drivers: driversOf(w),
    ...extra,
  };
}

/** The window's `to` is the first day after; the map shows the last day. */
function addDaysEx(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const SUBAREA_ORDER = ['get_job', 'job_change', 'promotion', 'job_security', 'abroad', 'pay', 'business'];

export function careerMap(build: PastBuild, asOf: string, digest?: CareerDigestInput): CareerMap {
  const cells = build.grid.cells[PRIMARY];
  const month = monthOf(asOf);
  const i = cells.findIndex((c) => c.month === month);
  if (i < 0) throw new Error(`careerMap: ${month} is not inside the build span`);
  const present = presentState(build, cells, i, digest);
  const votedIds = new Set(present.votes.map((v) => v.family));
  const missingFamilies = FAMILIES_NOT_BUILT_BY_ID.filter((f) => !votedIds.has(f.id)).map((f) => f.label);
  const notes = [
    ...build.notes,
    ...(missingFamilies.length ? [`Phase 1: the ${missingFamilies.join(', ')} families are not built yet; confidence scales to the families available.`] : []),
  ];
  const ends = endLords(build);

  const ahead: SubareaWindow[] = [];
  const startOfNow = monthStart(month);
  const f = build.foundation;
  const lord = (h: number) => f.houses[h]?.lord ?? null;
  for (const w of build.grid.windows) {
    if (w.to <= startOfNow) continue;
    if (w.marker === 'career') {
      for (const s of careerSubareas(build, w)) {
        const peak = cells.find((c) => c.month === w.peakMonth);
        ahead.push(toWindow(s, w, s === 'job_security' && peak ? { security: securityGrade(peak, ends) } : {}));
      }
    } else if (w.marker === 'business' && !w.testing) ahead.push(toWindow('business', w));
    else if (w.marker === 'money' && !w.testing && build.grid.windows.some((c) => c.marker === 'career' && !c.testing && c.from < w.to && w.from < c.to)) ahead.push(toWindow('pay', w));
    else if (w.marker === 'residence' && !w.testing && driversOf(w).some((p) => p === 'Ra' || p === lord(12) || p === lord(9))) ahead.push(toWindow('abroad', w));
  }
  ahead.sort((a, b) => a.from.localeCompare(b.from) || SUBAREA_ORDER.indexOf(a.subarea) - SUBAREA_ORDER.indexOf(b.subarea));

  const horizons = ([1, 3, 6, 12] as const).map((m) => {
    const end = addMonthsIso(startOfNow, m);
    const inside = ahead.filter((w) => w.from < end);
    const rank = (w: SubareaWindow) => BAND_ORDER[w.band] * 100 + w.score;
    const best = inside.filter((w) => w.side === 'support').sort((a, b) => rank(b) - rank(a))[0] ?? null;
    const hardest = inside.filter((w) => w.side === 'test').sort((a, b) => rank(b) - rank(a))[0] ?? null;
    // doc 45 §10: the far rungs show only what clears a higher bar
    const bar: Band = m >= 6 ? 'moderate' : 'possible';
    return {
      months: m,
      best: best && BAND_MIN(best.band, bar) ? best : null,
      hardest: hardest && BAND_MIN(hardest.band, bar) ? hardest : null,
      quiet: !(best && BAND_MIN(best.band, bar)) && !(hardest && BAND_MIN(hardest.band, bar)),
    };
  });

  const security = cells.slice(i, i + 13).map((c) => ({ month: c.month, grade: securityGrade(c, ends) }));

  // Looking back (doc 45 §9): the sharpest edges of the last 12 months, both directions, at most three
  const edges: CareerMap['back'] = [];
  for (let k = Math.max(1, i - 12); k < i; k++) {
    const c = cells[k]!;
    const prev = cells[k - 1]!;
    if (!BAND_MIN(c.band, 'moderate')) continue;
    if (c.testing === prev.testing && BAND_MIN(prev.band, 'moderate')) continue;
    edges.push({ month: c.month, side: c.testing ? 'test' : 'support', band: c.band as Exclude<Band, 'quiet'>, label: c.testing ? 'a demanding stretch at work began' : 'a good stretch at work began' });
  }
  const pickBack = [...edges.filter((e) => e.side === 'test').slice(-2), ...edges.filter((e) => e.side === 'support').slice(-2)]
    .sort((a, b) => BAND_ORDER[b.band] - BAND_ORDER[a.band] || b.month.localeCompare(a.month))
    .slice(0, 3)
    .sort((a, b) => a.month.localeCompare(b.month));

  return { asOf, month, present, ahead, horizons, security, back: pickBack, notes };
}
