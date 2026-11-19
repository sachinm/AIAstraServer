/**
 * Settles the questions held for paid Love/Work lens refreshes (docs/billing/03 "Per-lens refresh"). A lens refresh is
 * held when the person asks for it (POST /api/boards/love|work/refresh) and its cards are read by the one per-kundli
 * Self build in another invocation; that build calls this at its end. For every lens refreshed today and not yet
 * settled: while any of its cards is still `queued` or `reading` it stays held (a stale hold is given back by the gate
 * after ten minutes); once none is, the question is committed when at least one of its cards was read since the
 * refresh, and given back when none was (all failed, or the spend cap stopped the queue first). Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { questionGate, type QuestionGate } from '../../billing/questionGate.js';
import { CARD_STUCK_MS, type CardsStateDoc, type LensRefreshMark } from '../cards/types.js';
import { readCardsState, updateCardsState } from '../cards/state.js';

export type LensSettleGate = Pick<QuestionGate, 'settleLensRefresh'>;

/** Pure: what a refresh's cards say now: still being read, read (at least one card done since), or not read. */
export function lensRefreshOutcome(doc: CardsStateDoc, mark: LensRefreshMark, now: Date): 'pending' | 'committed' | 'given_back' {
  const since = Date.parse(mark.at);
  let read = false;
  for (const id of mark.cards) {
    const e = doc.cards[id];
    if (!e) continue;
    const at = Date.parse(e.at);
    if ((e.state === 'queued' || e.state === 'reading') && now.getTime() - at <= CARD_STUCK_MS) return 'pending';
    if (e.state === 'done' && at >= since) read = true;
  }
  return read ? 'committed' : 'given_back';
}

export async function settleLensRefreshes(prisma: PrismaClient, userId: string, kundliId: string, now: Date, gate?: LensSettleGate): Promise<void> {
  try {
    const doc = await readCardsState(prisma, kundliId, now);
    const open = Object.entries(doc.lensRefresh ?? {}).filter(([, m]) => !m.outcome);
    if (!open.length) return;
    const g = gate ?? questionGate(prisma);
    const settled: Array<[string, LensRefreshMark, 'committed' | 'given_back']> = [];
    for (const [key, mark] of open) {
      const outcome = lensRefreshOutcome(doc, mark, now);
      if (outcome === 'pending') continue;
      const [board, lens] = key.split(':') as ['love' | 'work', string];
      await g.settleLensRefresh(userId, board, lens, mark.at.slice(0, 10), outcome === 'committed');
      settled.push([key, mark, outcome]);
    }
    if (!settled.length) return;
    await updateCardsState(prisma, userId, kundliId, now, (d) => {
      for (const [key, mark, outcome] of settled) {
        if (d.lensRefresh?.[key]) d.lensRefresh[key] = { ...d.lensRefresh[key]!, outcome };
        for (const id of mark.cards) if (d.force) delete d.force[id];
      }
    });
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'lens refresh settle failed', kundli_id: kundliId, error: (e as Error).message?.slice(0, 200) }));
  }
}
