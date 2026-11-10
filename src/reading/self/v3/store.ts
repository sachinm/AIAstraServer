/**
 * The stored v3 cards (`technique_outputs`, technique `self.v3.cards`): one row per build that served at least one card,
 * keyed by clock, frame, Oracle prefix, profile, sections and prompts. GET /api/self/v3 reads the newest row of the
 * board's clock. Never throws on read.
 */
import type { PrismaClient } from '@prisma/client';
import type { PersonalPattern } from '../v2types.js';
import type { OracleV3Output, PersonalCardV3, SelfCardId, SelfV3CardContent, YearFrameV3 } from './types.js';

export const SELF_V3_TECHNIQUE = 'self.v3.cards';

export interface StoredSelfV3 {
  key: string;
  frame: YearFrameV3;
  oracle: OracleV3Output;
  cards: Partial<Record<SelfCardId, SelfV3CardContent>>;
  cardStatus: Partial<Record<SelfCardId, 'ok' | 'repaired' | 'failed' | 'withheld'>>;
}

/** One card's face from the Oracle card, the Personalizer card and the frame (no new value is made here). */
export function cardContent(oracle: OracleV3Output['cards'][SelfCardId], personal: PersonalCardV3 | undefined, frame: YearFrameV3): SelfV3CardContent | null {
  if (!oracle || !personal) return null;
  const spans = oracle.spans.flatMap((os) => {
    const fs = frame.spans.find((s) => s.id === os.span);
    const ps = personal.spans.find((s) => s.span === os.span);
    return fs && ps ? [{ span: os.span, from: fs.from, to: fs.to, tone: os.tone, mode: os.mode, asks: ps.asks, obstacle: ps.obstacle, step: ps.step }] : [];
  });
  if (!spans.length) return null;
  const now = frame.spans.find((s) => s.place === 'now') ?? frame.spans[0]!;
  const pattern: PersonalPattern | null =
    personal.pattern && oracle.pattern ? { text: personal.pattern, kind: 'watch', since: oracle.pattern.since, until: oracle.pattern.until, source: oracle.pattern.evidence[0] ?? `${oracle.card}.pattern` } : null;
  return {
    line: personal.line,
    spans,
    confirm: personal.confirm && oracle.confirm ? { claimId: oracle.confirm.claimId, text: personal.confirm } : null,
    pattern,
    ladder: personal.ladder,
    agreement: { agree: now.agree, of: now.of },
  };
}

type StorePrisma = {
  techniqueOutput?: {
    findFirst?: (q: unknown) => Promise<{ output: unknown; created_at: Date } | null>;
  };
};

export async function readSelfV3Cards(prisma: PrismaClient, kundliId: string, clock: string): Promise<Partial<Record<SelfCardId, SelfV3CardContent>> | null> {
  try {
    const p = prisma as unknown as StorePrisma;
    if (!p.techniqueOutput?.findFirst) return null;
    const row = await p.techniqueOutput.findFirst({
      where: { kundli_id: kundliId, technique_id: SELF_V3_TECHNIQUE, digest_version: { startsWith: 'self.v3.cards|', contains: `|clock=${clock}|` } },
      orderBy: { created_at: 'desc' },
    });
    const stored = row?.output as StoredSelfV3 | undefined;
    return stored?.cards && Object.keys(stored.cards).length ? stored.cards : null;
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'self v3 store read failed', error: (e as Error).message?.slice(0, 200) }));
    return null;
  }
}
