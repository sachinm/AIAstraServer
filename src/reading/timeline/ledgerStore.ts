/**
 * The person's ledger rows in `life_events` (migration 20261027100000_timeline_m14_ledger_and_builds; docs/reading-engine/27
 * §B.2): list, create, update and delete by user and kundli. A user only reads and writes their own rows: every query
 * carries `user_id`, and the kundli must belong to the user. Raw SQL with the same "missing table = unavailable" rule as
 * store.ts / src/services/userLocation.ts: errors are logged once per process and never thrown to the caller.
 */
import type { PrismaClient } from '@prisma/client';
import { parseLedger, type LifeEvent } from './ledger.js';
import { MAX_EVENTS_PER_KUNDLI, type LedgerInput } from './ledgerCategories.js';

export type LedgerResult<T> = { status: 'ok'; value: T } | { status: 'not_found' } | { status: 'full' } | { status: 'unavailable' };

let warned = false;
function warnOnce(op: string, err: unknown): void {
  if (warned) return;
  warned = true;
  const e = err as { code?: unknown; message?: unknown };
  console.warn(JSON.stringify({ msg: 'life_events unavailable; ledger capture off (migration timeline_m14 applied?)', op, code: typeof e?.code === 'string' ? e.code : undefined, error: String(e?.message ?? err).slice(0, 200) }));
}

/** For tests: let the next failure log again. */
export function resetLedgerStoreWarning(): void {
  warned = false;
}

type Row = Record<string, unknown>;

function toEvent(row: Row): LifeEvent | null {
  return parseLedger([row]).events[0] ?? null;
}

/** The kundli the request is about: the given one when the user owns it, else (none given) the user's latest. */
export async function resolveKundli(prisma: PrismaClient, userId: string, kundliId?: string | null): Promise<string | null> {
  const k = await prisma.kundli.findFirst({ where: kundliId ? { id: kundliId, user_id: userId } : { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  return k?.id ?? null;
}

export async function listLedger(prisma: PrismaClient, userId: string, kundliId: string): Promise<LedgerResult<LifeEvent[]>> {
  try {
    const rows = await prisma.$queryRaw<Row[]>`SELECT "id", "category", "date", "date_precision", "place", "attributes" FROM "life_events" WHERE "user_id" = ${userId} AND "kundli_id" = ${kundliId} ORDER BY "date", "created_at"`;
    return { status: 'ok', value: parseLedger(rows).events };
  } catch (err) {
    warnOnce('listLedger', err);
    return { status: 'unavailable' };
  }
}

export async function createLedgerEvent(prisma: PrismaClient, userId: string, kundliId: string, e: LedgerInput): Promise<LedgerResult<LifeEvent>> {
  try {
    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint | number }>>`SELECT count(*) AS "n" FROM "life_events" WHERE "user_id" = ${userId} AND "kundli_id" = ${kundliId}`;
    if (Number(n) >= MAX_EVENTS_PER_KUNDLI) return { status: 'full' };
    const rows = await prisma.$queryRaw<Row[]>`INSERT INTO "life_events" ("user_id", "kundli_id", "category", "date", "date_precision", "place", "attributes", "source")
      VALUES (${userId}, ${kundliId}, ${e.category}, ${e.date}::date, ${e.date_precision}, ${e.place}, ${JSON.stringify(e.attributes)}::jsonb, 'user')
      RETURNING "id", "category", "date", "date_precision", "place", "attributes"`;
    const ev = rows[0] ? toEvent(rows[0]) : null;
    return ev ? { status: 'ok', value: ev } : { status: 'unavailable' };
  } catch (err) {
    warnOnce('createLedgerEvent', err);
    return { status: 'unavailable' };
  }
}

/** One of the user's rows (any kundli of theirs) */
export async function getLedgerEvent(prisma: PrismaClient, userId: string, id: string): Promise<LedgerResult<LifeEvent>> {
  try {
    const rows = await prisma.$queryRaw<Row[]>`SELECT "id", "category", "date", "date_precision", "place", "attributes" FROM "life_events" WHERE "id" = ${id} AND "user_id" = ${userId} LIMIT 1`;
    const ev = rows[0] ? toEvent(rows[0]) : null;
    return ev ? { status: 'ok', value: ev } : { status: 'not_found' };
  } catch (err) {
    warnOnce('getLedgerEvent', err);
    return { status: 'unavailable' };
  }
}

export async function updateLedgerEvent(prisma: PrismaClient, userId: string, id: string, e: LedgerInput): Promise<LedgerResult<LifeEvent>> {
  try {
    const rows = await prisma.$queryRaw<Row[]>`UPDATE "life_events" SET "category" = ${e.category}, "date" = ${e.date}::date, "date_precision" = ${e.date_precision}, "place" = ${e.place}, "attributes" = ${JSON.stringify(e.attributes)}::jsonb
      WHERE "id" = ${id} AND "user_id" = ${userId}
      RETURNING "id", "category", "date", "date_precision", "place", "attributes"`;
    const ev = rows[0] ? toEvent(rows[0]) : null;
    return ev ? { status: 'ok', value: ev } : { status: 'not_found' };
  } catch (err) {
    warnOnce('updateLedgerEvent', err);
    return { status: 'unavailable' };
  }
}

export async function deleteLedgerEvent(prisma: PrismaClient, userId: string, id: string): Promise<LedgerResult<true>> {
  try {
    const n = await prisma.$executeRaw`DELETE FROM "life_events" WHERE "id" = ${id} AND "user_id" = ${userId}`;
    return n > 0 ? { status: 'ok', value: true } : { status: 'not_found' };
  } catch (err) {
    warnOnce('deleteLedgerEvent', err);
    return { status: 'unavailable' };
  }
}
