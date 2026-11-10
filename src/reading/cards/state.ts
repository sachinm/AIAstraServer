/**
 * The per-card state (docs/reading-engine/70 §4.2): one `area_builds` row per kundli per day (area `self.cards`), whose
 * `result` is a `CardsStateDoc`. Written by the layout save and the POST (queued), by the card runner (reading, done,
 * failed, the spend), read by GET /api/self/v3. Writes in this process run one after another per kundli so parallel
 * cards do not overwrite each other's entries. Nothing here throws.
 */
import type { PrismaClient } from '@prisma/client';
import { clockLabel } from '../self/words.js';
import type { BoardReadingView, CardReadState, SelfCardId, SelfV3CardContent } from '../self/v3/types.js';
import { CARD_STUCK_MS, CARDS_STATE_AREA, emptyCardsState, type CardsStateDoc } from './types.js';

type StatePrisma = {
  areaBuild?: {
    findUnique?: (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } } }) => Promise<{ status: string; result: unknown } | null>;
    upsert?: (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  };
};

const dayOf = (now: Date): Date => new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
const where = (kundliId: string, now: Date) => ({ kundli_id_area_as_of: { kundli_id: kundliId, area: CARDS_STATE_AREA, as_of: dayOf(now) } });

function asDoc(raw: unknown): CardsStateDoc {
  const d = emptyCardsState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<CardsStateDoc>;
  return {
    cards: r.cards && typeof r.cards === 'object' ? { ...r.cards } : {},
    spentUsd: Number.isFinite(Number(r.spentUsd)) ? Number(r.spentUsd) : 0,
    stage: (['idle', 'clocks', 'ledger', 'cards', 'done'] as const).includes(r.stage as never) ? (r.stage as CardsStateDoc['stage']) : 'idle',
    clocks: Array.isArray(r.clocks) ? r.clocks : [],
    capReached: Boolean(r.capReached),
    preparing: Boolean(r.preparing),
  };
}

/** Today's state doc for the kundli (empty when none or unreadable). */
export async function readCardsState(prisma: PrismaClient, kundliId: string, now: Date): Promise<CardsStateDoc> {
  try {
    const row = await (prisma as unknown as StatePrisma).areaBuild?.findUnique?.({ where: where(kundliId, now) });
    return asDoc(row?.result);
  } catch {
    return emptyCardsState();
  }
}

const chains = new Map<string, Promise<unknown>>();

/** Read, change and write today's doc, one change at a time per kundli in this process. Returns the doc written. */
export async function updateCardsState(prisma: PrismaClient, userId: string, kundliId: string, now: Date, change: (d: CardsStateDoc) => void): Promise<CardsStateDoc> {
  const prev = chains.get(kundliId) ?? Promise.resolve();
  const run = prev.then(async () => {
    const doc = await readCardsState(prisma, kundliId, now);
    change(doc);
    try {
      await (prisma as unknown as StatePrisma).areaBuild?.upsert?.({
        where: where(kundliId, now),
        create: { user_id: userId, kundli_id: kundliId, area: CARDS_STATE_AREA, as_of: dayOf(now), status: 'ready', result: doc, error: null },
        update: { result: doc },
      });
    } catch (e) {
      console.warn(JSON.stringify({ msg: 'cards state write failed', kundli_id: kundliId, error: (e as Error).message?.slice(0, 200) }));
    }
    return doc;
  });
  const settled = run.catch(() => undefined);
  chains.set(kundliId, settled);
  void settled.then(() => {
    if (chains.get(kundliId) === settled) chains.delete(kundliId);
  });
  return run;
}

/**
 * One card's state for the page: a live `queued`/`reading` entry (not stuck) wins; else a stored reading is `ready`;
 * else a `failed` entry (or a stuck one) is `failed`; else `not_read`.
 */
export function cardStateOf(doc: CardsStateDoc, id: SelfCardId, hasReading: boolean, now: Date): CardReadState {
  const e = doc.cards[id];
  const age = e ? now.getTime() - Date.parse(e.at) : Infinity;
  if (e && (e.state === 'queued' || e.state === 'reading')) {
    if (age <= CARD_STUCK_MS) return e.state;
    return hasReading ? 'ready' : 'failed';
  }
  if (hasReading) return 'ready';
  if (e?.state === 'failed') return 'failed';
  return 'not_read';
}

/** The board's reading line (doc 70 §4.2 `reading`). */
export function boardReadingView(
  doc: CardsStateDoc,
  board: readonly SelfCardId[],
  readings: Partial<Record<SelfCardId, SelfV3CardContent>>,
  now: Date,
  enabled: boolean,
): BoardReadingView {
  const pending = board.some((id) => {
    const s = cardStateOf(doc, id, Boolean(readings[id]), now);
    return s === 'queued' || s === 'reading';
  });
  return {
    enabled,
    stage: pending ? (doc.stage === 'done' || doc.stage === 'idle' ? 'cards' : doc.stage) : doc.stage === 'done' ? 'done' : 'idle',
    clocks: doc.clocks.map((c) => ({ ...c, label: c.label || clockLabel(c.system) })),
    done: board.filter((id) => Boolean(readings[id])).length,
    total: board.length,
    capReached: doc.capReached,
    preparing: doc.preparing,
  };
}
