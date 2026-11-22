/**
 * The first question on a card goes through Clarify, pre-filled from the card (docs/reading-engine/85 §4 step 2; Sachin,
 * 2026-11-18). The card names the subject and the period on screen, so the clarifier never asks for the life area, the
 * period, the sub-area or whose chart; it asks only for a fact the card cannot know (which sibling, a child's age, where
 * the person lives now), and facts already in person_facts are never asked (the machine reads them). Nothing left to ask
 * means straight to the answer. Follow-ups in the same thread skip it.
 *
 * Selection and wording only: nothing astrological is computed here.
 */
import type { BucketId } from '../buckets/taxonomy.js';
import { BUCKETS } from '../buckets/taxonomy.js';
import type { ClarifyCardRef, ClarifyState } from '../clarify/machine.js';
import type { ClarifySeed } from '../clarify/service.js';
import type { CardChatBoard, ResolvedCard } from './types.js';

/** the life areas a board's cards speak for, the default first (the question's own area wins when it is one of them) */
export const CARD_BOARD_BUCKETS: Record<CardChatBoard, readonly BucketId[]> = {
  self: ['time_window_outlook', 'health_windows', 'spirituality_direction', 'education', 'money_wealth', 'property_vehicles', 'foreign_legal'],
  love: ['love_relationships', 'marriage'],
  work: ['career_job', 'business', 'education', 'money_wealth'],
};

/** The seed of a card's first question: its board's areas, the period on screen (or the card's whole range), the card. */
export function cardClarifySeed(card: ResolvedCard, o: { turnId: string; newThread: boolean }): ClarifySeed {
  const buckets = CARD_BOARD_BUCKETS[card.board];
  const cardChat: ClarifyCardRef = {
    board: card.board,
    id: card.id,
    from: card.period?.from ?? null,
    to: card.period?.to ?? null,
    turnId: o.turnId,
    newThread: o.newThread,
  };
  // the period on screen is known even when it lies in the past (a "looking back" period); no period = the whole card
  const horizon = card.period
    ? { value: { from: card.period.from, to: card.period.to }, text: card.period.label }
    : { value: BUCKETS[buckets[0]!].defaultHorizon, text: `the whole ${card.title} card` };
  return { buckets, horizon, subBucket: { value: `card:${card.id}`, text: card.title }, cardChat };
}

/**
 * What the person settled with the clarifier, one line each, for the answer's prompt ("Which brother? → Elder brother").
 * `dropPlaces` (READING_PERSON_GATE on, doc 13 §2.4): the answer to "where do you live now" is left out (no place goes to
 * the model).
 */
export function clarifiedLines(s: Pick<ClarifyState, 'turns'>, opts: { dropPlaces?: boolean } = {}): string[] {
  const out: string[] = [];
  for (const t of s.turns) {
    if (!t.answer) continue;
    if (opts.dropPlaces && t.ask.criterion === 'location') continue;
    const chip = t.ask.chips.find((c) => c.value === t.answer!.value);
    out.push(`${t.ask.question} → ${chip?.label ?? t.answer.value}`);
  }
  return out;
}
