/**
 * The ledger of real dated life events (docs/reading-engine/27 §A.7, §B.2 `life_events`): facts only, no judgement.
 * This file reads and checks rows; capture (form, interview) is phase P0.
 */
import { monthOf } from './months.js';

export type DatePrecision = 'day' | 'month' | 'year';

export interface LifeEvent {
  id: string;
  /** dotted, from the marker table: job.start, residence.move, family.father.illness … */
  category: string;
  /** ISO date; for month/year precision the first day is enough */
  date: string;
  date_precision: DatePrecision;
  place?: string | null;
  attributes?: Record<string, unknown>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY = /^[a-z_]+(\.[a-z_]+)*$/;

/** Rows that look like ledger events; anything malformed is dropped (and counted) rather than failing the build. */
export function parseLedger(raw: unknown): { events: LifeEvent[]; dropped: number } {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { events?: unknown })?.events) ? (raw as { events: unknown[] }).events : [];
  const events: LifeEvent[] = [];
  let dropped = 0;
  for (const r of list) {
    const e = r as Partial<LifeEvent> | null;
    const rawDate: unknown = (r as { date?: unknown } | null)?.date;
    const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
    const precision = e?.date_precision ?? 'day';
    if (!e || typeof e.id !== 'string' || typeof e.category !== 'string' || !CATEGORY.test(e.category) || !DATE.test(date) || !['day', 'month', 'year'].includes(precision)) {
      dropped++;
      continue;
    }
    events.push({ id: e.id, category: e.category, date, date_precision: precision, place: e.place ?? null, attributes: e.attributes ?? {} });
  }
  return { events, dropped };
}

/** The months an event may fall in: its month, or the twelve months of its year */
export function eventMonths(e: LifeEvent): string[] {
  if (e.date_precision !== 'year') return [monthOf(e.date)];
  const y = e.date.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}
