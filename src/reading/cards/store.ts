/**
 * The stored card readings (`technique_outputs`, technique `self.card.reading`): one row per card per key (card, clock,
 * frame, ledger, prefix, profile, portrait, sections, prompts). GET /api/self/v3 reads the newest row of each card on the
 * board's clock. Never throws on read.
 */
import type { PrismaClient } from '@prisma/client';
import type { SelfCardId, SelfV3CardContent } from '../self/v3/types.js';
import { CARD_READING_TECHNIQUE, type StoredCardReading } from './types.js';

export const CARD_KEY_PREFIX = 'self.card|';

/** the store key: everything that can change the card's text */
export function cardStoreKey(p: {
  card: SelfCardId;
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

/** The newest stored reading of every card on the clock (cards with none are absent). */
export async function readCardReadings(prisma: PrismaClient, kundliId: string, clock: string): Promise<Partial<Record<SelfCardId, SelfV3CardContent>>> {
  const out: Partial<Record<SelfCardId, SelfV3CardContent>> = {};
  try {
    const p = prisma as unknown as StorePrisma;
    if (!p.techniqueOutput?.findMany) return out;
    const rows = await p.techniqueOutput.findMany({
      where: { kundli_id: kundliId, technique_id: CARD_READING_TECHNIQUE, digest_version: { startsWith: CARD_KEY_PREFIX, contains: `|clock=${clock}|` } },
      orderBy: { created_at: 'desc' },
      take: 300,
    });
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
