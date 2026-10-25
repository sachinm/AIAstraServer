/**
 * Global transit snapshot (snapshot_version 1) — see docs/reading-engine/03-chart-facts-dossier.md §2.
 * Not per user: one row per date range in `transit_snapshots`, joined with each user's natal points by
 * `packs/transitTable.ts`. Positions are sampled at local noon (tz decides the civil day); ingress, station
 * and lunation instants are bisected to the minute and reported as local calendar dates.
 */
import { NAKSHATRA_NAMES, SIGN_NAMES } from '../facts/constants.js';
import {
  angDiff,
  dateFromJdUt,
  lunarElongation,
  siderealLongitude,
  siderealPoint,
  type TransitPlanet,
} from './ephemeris.js';

export const SNAPSHOT_VERSION = 1;
export const TRANSIT_PLANETS: TransitPlanet[] = ['Su', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
export const SLOW_PLANETS: TransitPlanet[] = ['Ju', 'Sa', 'Ra', 'Ke'];

export interface PlanetPosition {
  lon: number;
  sign: number;
  nak: string;
  nak_idx: number;
  retro: boolean;
}
export type PositionRow = { date: string } & Partial<Record<TransitPlanet, PlanetPosition>>;
export interface Ingress {
  planet: TransitPlanet;
  kind: 'sign' | 'nak';
  from: number | string;
  into: number | string;
  into_name?: string;
  into_idx?: number;
  date: string;
  retro: boolean;
}
export interface Station {
  planet: TransitPlanet;
  kind: 'retro_start' | 'retro_end';
  date: string;
  lon: number;
  sign: number;
  nak: string;
}
export interface Lunation {
  kind: 'new' | 'full';
  date: string;
  sign: number;
  sign_name: string;
  nak: string;
}
export interface TransitSnapshot {
  v: number;
  ayanamsa: 'LAHIRI';
  from: string;
  to: string;
  step: 'auto' | 'daily' | 'weekly';
  daily_until: string | null;
  planets: TransitPlanet[];
  positions: PositionRow[];
  ingresses: Ingress[];
  stations: Station[];
  lunations: Lunation[];
}

export interface BuildTransitsOptions {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  tz?: number; // hours east of UTC, local day boundary (default 0)
  step?: 'auto' | 'daily' | 'weekly';
  includeMoon?: boolean;
  dailyDays?: number;
}

const ONE_STAR = 360 / 27;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIso(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`Invalid date '${s}' (expected YYYY-MM-DD)`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** UT Julian day of local noon on a civil date with a given tz. */
function jdLocalNoonUt(civil: Date, tz: number): number {
  return civil.getTime() / 86400000 + 2440587.5 + (12 - tz) / 24;
}

function localDate(jdUt: number, tz: number): string {
  return isoDate(dateFromJdUt(jdUt + tz / 24));
}

function signOf(lon: number): number {
  return Math.floor(lon / 30) % 12;
}
function nakOf(lon: number): number {
  return Math.floor(lon / ONE_STAR) % 27;
}

/** Instant where an integer index changes between lo and hi (binary search to ~1 minute). */
function bisectIndexChange(f: (jd: number) => number, lo: number, hi: number): number {
  const ilo = f(lo);
  for (let i = 0; i < 40 && hi - lo > 1 / 1440; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) === ilo) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Root of a sign-changing function between lo and hi (~1 minute). */
function bisectRoot(f: (jd: number) => number, lo: number, hi: number): number {
  let flo = f(lo);
  for (let i = 0; i < 40 && hi - lo > 1 / 1440; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm < 0 === flo < 0) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

export function buildTransitSnapshot(opts: BuildTransitsOptions): TransitSnapshot {
  const tz = opts.tz ?? 0;
  const step = opts.step ?? 'auto';
  const dailyDays = opts.dailyDays ?? 60;
  const d0 = parseIso(opts.from);
  const d1 = parseIso(opts.to);
  if (d1 < d0) throw new Error("'to' must be on or after 'from'");
  const nDays = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
  if (nDays > 366 * 5) throw new Error('transit range must be 5 years or less');
  const planets: TransitPlanet[] = opts.includeMoon ? ['Su', 'Mo', ...TRANSIT_PLANETS.slice(1)] : [...TRANSIT_PLANETS];

  const dates: Date[] = [];
  const jds: number[] = [];
  for (let i = 0; i < nDays; i++) {
    const d = new Date(d0.getTime() + i * 86400000);
    dates.push(d);
    jds.push(jdLocalNoonUt(d, tz));
  }

  const lons: Record<string, number[]> = {};
  const speeds: Record<string, number[]> = {};
  for (const p of planets) {
    lons[p] = [];
    speeds[p] = [];
  }
  for (const jd of jds) {
    for (const p of planets) {
      const pt = siderealPoint(p, jd);
      lons[p]!.push(pt.lon);
      speeds[p]!.push(pt.speed);
    }
  }

  const positions: PositionRow[] = [];
  for (let i = 0; i < nDays; i++) {
    let keep: boolean;
    if (step === 'weekly') keep = i % 7 === 0;
    else if (step === 'daily') keep = true;
    else keep = i < dailyDays || (i - dailyDays) % 7 === 0;
    if (!keep && i !== nDays - 1) continue;
    const row: PositionRow = { date: isoDate(dates[i]!) };
    for (const p of planets) {
      const l = lons[p]![i]!;
      row[p] = {
        lon: Math.round(l * 1000) / 1000,
        sign: signOf(l),
        nak: NAKSHATRA_NAMES[nakOf(l)]!,
        nak_idx: nakOf(l),
        retro: p === 'Ra' || p === 'Ke' ? true : speeds[p]![i]! < 0,
      };
    }
    positions.push(row);
  }

  const ingresses: Ingress[] = [];
  for (const p of planets) {
    const signIdx = (jd: number) => signOf(siderealLongitude(p, jd));
    const nakIdx = (jd: number) => nakOf(siderealLongitude(p, jd));
    for (let i = 1; i < nDays; i++) {
      const lPrev = lons[p]![i - 1]!;
      const lCur = lons[p]![i]!;
      const retro = angDiff(lCur, lPrev) < 0;
      if (signOf(lPrev) !== signOf(lCur)) {
        const jdX = bisectIndexChange(signIdx, jds[i - 1]!, jds[i]!);
        ingresses.push({ planet: p, kind: 'sign', from: signOf(lPrev), into: signOf(lCur), into_name: SIGN_NAMES[signOf(lCur)], date: localDate(jdX, tz), retro });
      }
      if (nakOf(lPrev) !== nakOf(lCur)) {
        const jdX = bisectIndexChange(nakIdx, jds[i - 1]!, jds[i]!);
        ingresses.push({ planet: p, kind: 'nak', from: NAKSHATRA_NAMES[nakOf(lPrev)]!, into: NAKSHATRA_NAMES[nakOf(lCur)]!, into_idx: nakOf(lCur), date: localDate(jdX, tz), retro });
      }
    }
  }
  ingresses.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.planet < b.planet ? -1 : a.planet > b.planet ? 1 : a.kind < b.kind ? -1 : 1));

  const stations: Station[] = [];
  for (const p of planets) {
    if (p === 'Su' || p === 'Mo' || p === 'Ra' || p === 'Ke') continue;
    const speedF = (jd: number) => siderealPoint(p, jd).speed;
    for (let i = 1; i < nDays; i++) {
      if (speeds[p]![i - 1]! < 0 !== speeds[p]![i]! < 0) {
        const jdX = bisectRoot(speedF, jds[i - 1]!, jds[i]!);
        const l = siderealLongitude(p, jdX);
        stations.push({ planet: p, kind: speeds[p]![i]! < 0 ? 'retro_start' : 'retro_end', date: localDate(jdX, tz), lon: Math.round(l * 1000) / 1000, sign: signOf(l), nak: NAKSHATRA_NAMES[nakOf(l)]! });
      }
    }
  }
  stations.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const lunations: Lunation[] = [];
  const elongs = jds.map((jd) => lunarElongation(jd));
  for (let i = 1; i < nDays; i++) {
    for (const [target, kind] of [[0, 'new'], [180, 'full']] as Array<[number, 'new' | 'full']>) {
      const f = (jd: number) => angDiff(lunarElongation(jd), target);
      const fPrev = angDiff(elongs[i - 1]!, target);
      const fCur = angDiff(elongs[i]!, target);
      if (fPrev < 0 !== fCur < 0 && Math.abs(fPrev) < 30 && Math.abs(fCur) < 30) {
        const jdX = bisectRoot(f, jds[i - 1]!, jds[i]!);
        const ml = siderealLongitude('Mo', jdX);
        lunations.push({ kind, date: localDate(jdX, tz), sign: signOf(ml), sign_name: SIGN_NAMES[signOf(ml)]!, nak: NAKSHATRA_NAMES[nakOf(ml)]! });
      }
    }
  }
  lunations.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    v: SNAPSHOT_VERSION,
    ayanamsa: 'LAHIRI',
    from: isoDate(d0),
    to: isoDate(d1),
    step,
    daily_until: step === 'auto' ? isoDate(new Date(d0.getTime() + (Math.min(dailyDays, nDays) - 1) * 86400000)) : null,
    planets,
    positions,
    ingresses,
    stations,
    lunations,
  };
}
