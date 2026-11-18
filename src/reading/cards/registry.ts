/**
 * One lookup over every card the per-card reading can read (docs/dashboards/10 §7 S2): the Self cards
 * (`self/v3/cards.ts`) and the Love and Work v3 cards (`boards/v3Cards.ts`). Ids are unique across boards, so one id
 * names one card. The card runner, the pack and the state doc go through here; the Self board's own code keeps its
 * Self-only registry.
 */
import { getBoardsV3 } from '../../config/env.js';
import { boardV3CardDef, type BoardV3CardDef, type BoardV3CardId } from '../boards/v3Cards.js';
import { cardDef, isCardOffered, READABLE_CARDS } from '../self/v3/cards.js';
import type { BoardId, CardId, SelfCardDef, SelfCardId } from '../self/v3/types.js';

export type { CardId };

/** what the runner needs of any card */
export type AnyCardDef = SelfCardDef | BoardV3CardDef<BoardV3CardId>;

export function anyCardDef(id: string): AnyCardDef | null {
  return cardDef(id) ?? boardV3CardDef(id);
}

/** the board a card belongs to; null when unknown */
export function boardOfCard(id: string): BoardId | null {
  if (cardDef(id)) return 'self';
  return boardV3CardDef(id)?.board ?? null;
}

/**
 * The per-card reading may read this card now: a Self card the reading builds (`READABLE_CARDS`, offered with the
 * reading on), or a Love/Work card that is offered on a board listed in BOARDS_V3.
 */
export function isReadable(id: string, boards: readonly string[] = getBoardsV3()): boolean {
  const s = cardDef(id);
  if (s) return READABLE_CARDS.includes(s.id) && isCardOffered(s, true);
  const b = boardV3CardDef(id);
  return Boolean(b && b.offered && boards.includes(b.board));
}

/** The brief's prompt key: `cards/<board>/<id>`. Self keeps `cards/self/<id>`, so no You store key changes. */
export function cardBriefPrompt(id: CardId | SelfCardId): string {
  return `cards/${boardOfCard(id) ?? 'self'}/${id}`;
}
