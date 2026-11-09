/**
 * When a board's synthesis was made and the last day it holds, as the synthesis itself said (docs/billing/03): its
 * `validUntil.overall`, else the end of its stored window. Read from the newest synthesis stored for the board, so it is
 * the reading the page shows (offline first). Nothing here is computed from the chart.
 */
import type { PrismaClient } from '@prisma/client';
import { isSelfReadingModelEnabled, isSelfV2BuildEnabled } from '../../config/env.js';
import { latestStoredOutput } from '../../techniques/outputStore.js';
import { latestReadyBuild, refreshDue, storedValidity, type ReadingValidity } from '../area/validity.js';
import type { SelfOracleResult } from './oracle.js';
import type { ReadingBoardId } from './types.js';
import type { SelfV2OracleResult } from './v2types.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SELF_V2_BUILD=1 with the model on: the Self v2 build is the You board's reading. The self build event then makes no v1
 * model call (no family readers, lineman or v1 Oracle), and the board's dates come from the v2 Oracle document.
 */
export function selfV2OwnsBoard(): boolean {
  return isSelfV2BuildEnabled() && isSelfReadingModelEnabled();
}

function lastDay(said: string | undefined, validTo: Date | null): string | null {
  if (said && DAY_RE.test(said)) return said;
  if (said === 'always') return null;
  return validTo ? new Date(validTo.getTime() - 1).toISOString().slice(0, 10) : null;
}

export type BoardValidity = ReadingValidity & { refresh_due: boolean };

/** Null when this board has no synthesis made yet. */
export async function synthesisValidity(prisma: PrismaClient, kundliId: string, board: ReadingBoardId, today: string): Promise<BoardValidity | null> {
  const last = await latestStoredOutput<SelfOracleResult>(prisma, { techniqueId: `${board}.reading.oracle`, kundliId, digestContains: `|board=${board}|scope=all|` });
  if (!last || last.value?.status !== 'ok') return null;
  const valid_until = lastDay(last.value.validUntil?.overall, last.validTo);
  return { made_at: last.madeAt.toISOString(), valid_until, refresh_due: refreshDue(valid_until, today) };
}

/**
 * The Self v2 reading's dates (doc 66): the newest stored v2 Oracle document (`self.v2.oracle`, stored only when ok) and
 * its own `doc.validUntil`, else the end of its stored window. Null when no v2 reading has been made.
 */
export async function v2SynthesisValidity(prisma: PrismaClient, kundliId: string, today: string): Promise<BoardValidity | null> {
  const last = await latestStoredOutput<{ result?: SelfV2OracleResult }>(prisma, { techniqueId: 'self.v2.oracle', kundliId });
  const r = last?.value?.result;
  if (!last || r?.status !== 'ok' || !r.output) return null;
  const valid_until = lastDay(r.output.doc?.validUntil, last.validTo);
  return { made_at: last.madeAt.toISOString(), valid_until, refresh_due: refreshDue(valid_until, today) };
}

/**
 * The You board's dates and whether a fresh reading may be asked for (docs/billing/03). One rule for
 * GET /api/area/self, POST /api/boards/self/refresh and GET /api/self/v2, so the v1 and v2 pages agree: the synthesis's
 * own dates once one is made, else the area reading's. With the v2 build owning the board (selfV2OwnsBoard) the v2
 * Oracle's dates come first (no v1 synthesis is made then); a kundli with no v2 reading yet falls back to the v1 rule. `area` is the area reading's dates when the caller already has
 * them; without it the newest ready `self` area build is read (nothing is built). Null when neither exists.
 */
export async function selfBoardDates(prisma: PrismaClient, kundliId: string, today: string, area?: ReadingValidity | null): Promise<BoardValidity | null> {
  const made = (selfV2OwnsBoard() ? await v2SynthesisValidity(prisma, kundliId, today) : null) ?? (await synthesisValidity(prisma, kundliId, 'self', today));
  if (made) return made;
  let v: ReadingValidity | null = area ? { made_at: area.made_at, valid_until: area.valid_until } : null;
  if (!v) {
    const row = await latestReadyBuild(prisma, kundliId, 'self');
    if (!row) return null;
    v = storedValidity(row.result, row.created_at, row.as_of.toISOString().slice(0, 10));
  }
  return { ...v, refresh_due: refreshDue(v.valid_until, today) };
}
