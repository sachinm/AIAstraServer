/**
 * One Love/Work lens's own "Good until" (docs/billing/03 §10, Sachin's decision 2026-11-19): the `refresh` block of a
 * lens comes from that lens's newest stored card readings, not from the You board's dates.
 *
 *   madeAt      the oldest `created_at` among the deck's newest readings (when the deck was last read as a whole), or
 *               today's recorded lens refresh time when that is later
 *   validUntil  the earliest last good day among those readings: the day before the row's `valid_to` (the You rule,
 *               `lastDay` in synthesisValidity.ts), else the first span end on or after the day it was made
 *   due         the You rule `refreshDue`: today is past `validUntil` (on or after the row's `valid_to`)
 *
 * A lens with no stored reading has no dates and is never due (its first reading is made free on open). Read only;
 * never throws (an unreadable store gives no dates, so no button that would 409).
 */
import type { PrismaClient } from '@prisma/client';
import { refreshDue } from '../area/validity.js';
import { newestCardRows } from '../cards/store.js';
import type { LensRefreshMark } from '../cards/types.js';

export interface LensRefreshView {
  madeAt: string | null;
  validUntil: string | null;
  due: boolean;
  building: boolean;
  failed: boolean;
}

export const NO_LENS_REFRESH: Readonly<LensRefreshView> = Object.freeze({ madeAt: null, validUntil: null, due: false, building: false, failed: false });

type Row = { output: unknown; created_at: Date | string; valid_to?: Date | string | null };

const iso = (d: Date | string): string => (d instanceof Date ? d : new Date(d)).toISOString();

/** Pure: a stored card reading's last good day (the day before `valid_to`, else the first span end from the day made). */
export function readingLastDay(row: Row): string | null {
  if (row.valid_to) return new Date(new Date(row.valid_to).getTime() - 1).toISOString().slice(0, 10);
  const made = iso(row.created_at).slice(0, 10);
  const spans = ((row.output as { content?: { spans?: Array<{ to?: unknown }> } } | null)?.content?.spans ?? [])
    .map((s) => s.to)
    .filter((t): t is string => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && t >= made)
    .sort();
  return spans[0] ?? null;
}

/** Pure: the lens's dates from the newest row of each deck card. */
export function lensValidityFrom(rows: readonly Row[], today: string, mark?: LensRefreshMark | null): LensRefreshView {
  if (!rows.length) return { ...NO_LENS_REFRESH };
  let madeAt = rows.map((r) => iso(r.created_at)).sort()[0]!;
  if (mark && mark.outcome !== 'given_back' && mark.at > madeAt) madeAt = mark.at;
  const validUntil = rows.map(readingLastDay).filter((d): d is string => d !== null).sort()[0] ?? null;
  return { madeAt, validUntil, due: refreshDue(validUntil, today), building: false, failed: false };
}

/** The lens's `refresh` block from the store (newest row per deck card on the clock). */
export async function lensValidity(prisma: PrismaClient, kundliId: string, clock: string, deck: readonly string[], today: string, mark?: LensRefreshMark | null): Promise<LensRefreshView> {
  if (!deck.length) return { ...NO_LENS_REFRESH };
  try {
    // the newest rows per deck card, whatever other cards hold (newestCardRows; a fixed window could miss a card)
    const rows: Row[] = await newestCardRows(prisma, kundliId, clock, deck);
    const newest = new Map<string, Row>();
    for (const r of rows) {
      const card = (r.output as { card?: string; content?: unknown } | null)?.card;
      if (card && (r.output as { content?: unknown }).content && !newest.has(card)) newest.set(card, r);
    }
    return lensValidityFrom([...newest.values()], today, mark);
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'lens validity read failed', error: (e as Error).message?.slice(0, 200) }));
    return { ...NO_LENS_REFRESH };
  }
}
