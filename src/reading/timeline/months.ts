/** Calendar helpers for the monthly grain (doc 27 §A.6). Plain date arithmetic on ISO strings; no astrology. */

/** 'YYYY-MM' of an ISO date */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

export function monthFromIndex(i: number): string {
  const y = Math.floor(i / 12);
  return `${y}-${String((i % 12) + 1).padStart(2, '0')}`;
}

export function addMonthsIso(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** First day of the month */
export function monthStart(month: string): string {
  return `${month}-01`;
}

/** First day of the next month (exclusive end) */
export function monthEnd(month: string): string {
  return `${monthFromIndex(monthIndex(month) + 1)}-01`;
}

/** The 15th: a period runs "in" a month when it covers this day (doc 27 §A.6: edges are snapped to months) */
export function monthMid(month: string): string {
  return `${month}-15`;
}

/** Every month from the month of `from` to the month of `to`, inclusive */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = monthIndex(monthOf(from)); i <= monthIndex(monthOf(to)); i++) out.push(monthFromIndex(i));
  return out;
}

/** The 18-year past grid ending in the month of `asOf` (doc 27 §B.7 P1) */
export function pastMonths(asOf: string, years = 18): string[] {
  return monthsBetween(addMonthsIso(asOf, -12 * years), asOf);
}

export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
