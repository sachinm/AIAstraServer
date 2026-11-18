/**
 * The stored card readings (`technique_outputs`, technique `self.card.reading`): one row per card per key (card, clock,
 * frame, ledger, prefix, profile, portrait, sections, prompts). GET /api/self/v3 reads the newest row of each card on the
 * board's clock. Never throws on read.
 */
import type { PrismaClient } from '@prisma/client';
import type { CardId, SelfV3CardContent } from '../self/v3/types.js';
import { CARD_READING_TECHNIQUE, type StoredCardReading } from './types.js';

export const CARD_KEY_PREFIX = 'self.card|';

/** the store key: everything that can change the card's text */
export function cardStoreKey(p: {
  card: CardId;
  clock: string;
  frameHash: string;
  ledgerHash: string;
  prefixHash: string;
  profileHash: string;
  portraitHash: string;
  sectionsHash: string;
  confirmHash: string;
  promptHash: string;
}): string {
  return [
    'self.card',
    `card=${p.card}`,
    `clock=${p.clock}`,
    `frame=${p.frameHash}`,
    `ledger=${p.ledgerHash}`,
    `pre=${p.prefixHash}`,
    `profile=${p.profileHash}`,
    `portrait=${p.portraitHash}`,
    `sections=${p.sectionsHash}`,
    `confirm=${p.confirmHash}`,
    `p=${p.promptHash}`,
  ].join('|') + '|';
}

type StorePrisma = {
  techniqueOutput?: {
    findMany?: (q: unknown) => Promise<Array<{ output: unknown; digest_version?: string; created_at: Date }>>;
  };
};

/**
 * The newest stored reading of every card on the clock (cards with none are absent). With `ids` (docs/dashboards/10
 * §7 S3) only those cards' rows are read, at most four per card, so another board's rows never crowd them out of the
 * window; without, the 300 newest rows (the Self board, unchanged).
 */
export async function readCardReadings(prisma: PrismaClient, kundliId: string, clock: string, ids?: readonly string[]): Promise<Partial<Record<CardId, SelfV3CardContent>>> {
  const out: Partial<Record<CardId, SelfV3CardContent>> = {};
  if (ids && !ids.length) return out;
  try {
    const p = prisma as unknown as StorePrisma;
    if (!p.techniqueOutput?.findMany) return out;
    const rows = await p.techniqueOutput.findMany(
      ids
        ? {
            where: {
              kundli_id: kundliId,
              technique_id: CARD_READING_TECHNIQUE,
              digest_version: { contains: `|clock=${clock}|` },
              OR: ids.map((id) => ({ digest_version: { startsWith: `${CARD_KEY_PREFIX}card=${id}|` } })),
            },
            orderBy: { created_at: 'desc' },
            take: ids.length * 4,
          }
        : {
            where: { kundli_id: kundliId, technique_id: CARD_READING_TECHNIQUE, digest_version: { startsWith: CARD_KEY_PREFIX, contains: `|clock=${clock}|` } },
            orderBy: { created_at: 'desc' },
            take: 300,
          },
    );
    for (const r of rows) {
      const s = r.output as StoredCardReading | undefined;
      if (!s?.card || !s.content || out[s.card]) continue;
      out[s.card] = s.content;
    }
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'card readings read failed', error: (e as Error).message?.slice(0, 200) }));
  }
  return out;
}

/**
 * docs/reading-engine/85 §4: the newest stored reading of ONE card on the clock, whole (content, the Oracle card, the
 * Personalizer card, the ledger and frame hashes) with its store key, so the card chat reads the data the card was
 * written from. The same row `readCardReadings` serves for that card (same filter, newest first). Null when none or
 * unreadable. Never throws.
 */
export async function readStoredCardReading(prisma: PrismaClient, kundliId: string, clock: string, id: string): Promise<StoredCardReading | null> {
  try {
    const p = prisma as unknown as StorePrisma;
    if (!p.techniqueOutput?.findMany) return null;
    const rows = await p.techniqueOutput.findMany({
      where: {
        kundli_id: kundliId,
        technique_id: CARD_READING_TECHNIQUE,
        digest_version: { startsWith: `${CARD_KEY_PREFIX}card=${id}|`, contains: `|clock=${clock}|` },
      },
      orderBy: { created_at: 'desc' },
      take: 1,
    });
    const r = rows[0];
    const s = r?.output as StoredCardReading | undefined;
    if (!s?.card || !s.content) return null;
    return { ...s, key: s.key || r?.digest_version || '' };
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'card reading read failed', error: (e as Error).message?.slice(0, 200) }));
    return null;
  }
}
