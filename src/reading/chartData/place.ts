/**
 * A place given as coordinates for a moving chart (transit or prashna at a place other than the birth place, doc 28).
 * Coordinates are rounded to two decimals (about 1 km) before they are sent to Radha or stored, for privacy. `tz` is the
 * place's UTC offset in hours, as Radha takes it. Plain clock arithmetic only; nothing here computes astrology.
 */

export interface AtPlace {
  lat: number;
  lon: number;
  /** UTC offset in hours (e.g. 5.5) */
  tz: number;
}

/** Two decimals, about 1 km: enough for a chart, not enough to find a house. */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundPlace(p: AtPlace): AtPlace {
  return { lat: roundCoord(p.lat), lon: roundCoord(p.lon), tz: p.tz };
}

/** UTC offset (hours) of an IANA timezone at a moment, e.g. ('Asia/Kolkata', now) -> 5.5. Null when unknown. */
export function tzOffsetHours(timeZone: string, at: Date = new Date()): number | null {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
    if (part === 'GMT' || part === 'UTC') return 0;
    const m = /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(part);
    if (!m) return null;
    const h = Number(m[2]) + Number(m[3] ?? 0) / 60;
    return m[1] === '-' ? -h : h;
  } catch {
    return null;
  }
}

function finite(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * The question place a client sent (`lat`, `lon`, `tz` on the ask / confirm routes): `tz` is an offset in hours or an
 * IANA name (the browser's `Intl` zone), read at `at`. Anything missing or out of range -> null (the caller then falls
 * back to the birth place). The result is already rounded.
 */
export function parseClientPlace(input: unknown, at: Date = new Date()): AtPlace | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as { lat?: unknown; lon?: unknown; tz?: unknown };
  const lat = finite(o.lat);
  const lon = finite(o.lon);
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  let tz = finite(o.tz);
  if (tz == null && typeof o.tz === 'string' && /^[A-Za-z0-9_+\-/]{1,64}$/.test(o.tz.trim())) tz = tzOffsetHours(o.tz.trim(), at);
  if (tz == null || tz < -14 || tz > 14) return null;
  return roundPlace({ lat, lon, tz });
}
