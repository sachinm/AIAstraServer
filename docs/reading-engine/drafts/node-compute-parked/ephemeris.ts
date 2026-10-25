/**
 * Pure-TypeScript sidereal ephemeris for transits (astronomy-engine + Lahiri ayanamsa + mean lunar node).
 *
 * Accuracy vs pyjhora/Swiss Ephemeris (checked on the golden chart, 2026-10-24): planets within ~1 arcminute,
 * Rahu within 1 arcsecond. Ingress dates are therefore correct to the day for Saturn/Jupiter/nodes and to
 * within a few hours for fast planets, which is what the transit table needs. The natal chart itself still
 * comes from pyjhora (legacy kundli columns); this module is used only for transit snapshots.
 */
import * as A from 'astronomy-engine';

export type TransitPlanet = 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa' | 'Ra' | 'Ke';

const BODY: Record<Exclude<TransitPlanet, 'Ra' | 'Ke'>, A.Body> = {
  Su: A.Body.Sun,
  Mo: A.Body.Moon,
  Ma: A.Body.Mars,
  Me: A.Body.Mercury,
  Ju: A.Body.Jupiter,
  Ve: A.Body.Venus,
  Sa: A.Body.Saturn,
};

export const J2000_JD = 2451545.0;

export function norm360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

/** Signed smallest difference a-b in (-180, 180]. */
export function angDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/** IAU 2006 general precession in longitude (arcsec) at T Julian centuries from J2000 (TT). */
function pA(T: number): number {
  return 5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T ** 3 - 0.000023857 * T ** 4 - 0.0000000383 * T ** 5;
}

/**
 * Lahiri ayanamsa as Swiss Ephemeris defines SIDM_LAHIRI: 22.460470° at J1900.0 (JD 2415020.0) plus the
 * general precession in longitude accumulated since then. Matches swe within 0.2 arcsec at 2002.
 */
export function lahiriAyanamsaDeg(jdTT: number): number {
  const T1 = (2415020.0 - J2000_JD) / 36525;
  const T2 = (jdTT - J2000_JD) / 36525;
  return 22.46047 + (pA(T2) - pA(T1)) / 3600;
}

/** Mean ascending lunar node, tropical longitude of date (Meeus 47.7). */
export function meanNodeTropicalDeg(jdTT: number): number {
  const T = (jdTT - J2000_JD) / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441 - T ** 4 / 60616000);
}

export function jdUtFromDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

export function dateFromJdUt(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

function astroTime(jdUt: number): A.AstroTime {
  return new A.AstroTime(jdUt - J2000_JD);
}

/** Geocentric apparent ecliptic-of-date tropical longitude (deg). */
function tropicalLongitude(body: A.Body, t: A.AstroTime): number {
  const v = A.GeoVector(body, t, true);
  const r = A.RotateVector(A.Rotation_EQJ_ECT(t), v);
  return norm360((Math.atan2(r.y, r.x) * 180) / Math.PI);
}

export interface EphemPoint {
  lon: number; // sidereal degrees 0..360
  speed: number; // deg/day (sidereal; same as tropical rate)
}

/**
 * Sidereal longitude and daily speed of a transit planet at a UT Julian day.
 * Speed is a central difference over ±0.5 day (adequate for station detection).
 */
export function siderealPoint(planet: TransitPlanet, jdUt: number): EphemPoint {
  const t = astroTime(jdUt);
  const jdTT = t.tt + J2000_JD;
  const ayan = lahiriAyanamsaDeg(jdTT);
  if (planet === 'Ra' || planet === 'Ke') {
    const node = meanNodeTropicalDeg(jdTT);
    const lon = norm360((planet === 'Ra' ? node : node + 180) - ayan);
    // mean node regresses ~0.0529 deg/day
    const T = (jdTT - J2000_JD) / 36525;
    const speed = (-1934.1362891 + 2 * 0.0020754 * T) / 36525;
    return { lon, speed };
  }
  const body = BODY[planet];
  const lon = norm360(tropicalLongitude(body, t) - ayan);
  const h = 0.5;
  const l1 = tropicalLongitude(body, astroTime(jdUt - h));
  const l2 = tropicalLongitude(body, astroTime(jdUt + h));
  const speed = angDiff(l2, l1) / (2 * h);
  return { lon, speed };
}

export function siderealLongitude(planet: TransitPlanet, jdUt: number): number {
  const t = astroTime(jdUt);
  const jdTT = t.tt + J2000_JD;
  const ayan = lahiriAyanamsaDeg(jdTT);
  if (planet === 'Ra' || planet === 'Ke') {
    const node = meanNodeTropicalDeg(jdTT);
    return norm360((planet === 'Ra' ? node : node + 180) - ayan);
  }
  return norm360(tropicalLongitude(BODY[planet], t) - ayan);
}

/** Moon − Sun elongation in degrees [0, 360). */
export function lunarElongation(jdUt: number): number {
  return norm360(siderealLongitude('Mo', jdUt) - siderealLongitude('Su', jdUt));
}
