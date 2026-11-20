/**
 * The card's own divisional charts and its lens (docs/techniques/09 §4 "Chart routing"). The routing table
 * (`routing.ts`, doc 08) decides; while it has no row for a card (the stub, or a card it does not list yet) the fallback
 * is today's routing words (`renderActiveTimingAndVargaBlock` in `oracle.ts`) and the board's own chart: D10 for Work,
 * D9 for Love (doc 09 §4: D7 only for children). A words table, nothing computed.
 */
import { boardV3CardDef } from '../boards/v3Cards.js';
import { cardDef } from '../self/v3/cards.js';
import { routeFor, type LensId } from './routing.js';

const SELF_FALLBACK: ReadonlyArray<{ cards: readonly string[]; charts: string[] }> = [
  { cards: ['drive', 'diagnosis', 'chapter', 'chapters', 'year'], charts: ['D10'] },
  { cards: ['lagna', 'presence'], charts: ['D9'] },
  { cards: ['mind', 'sharpness', 'learning'], charts: ['D24'] },
  { cards: ['purpose', 'practice', 'aims'], charts: ['D20'] },
  { cards: ['body', 'fitness', 'sleep', 'blood', 'stuck', 'mood'], charts: ['D30'] },
];

/** the card's own divisional charts (`D10`, `D9`, …); `['D9']` when nothing names one */
export function ownChartsOf(cardId: string): string[] {
  const r = routeFor(cardId);
  const routed = (r?.promiseCharts ?? []).map((c) => c.toUpperCase()).filter((c) => /^D\d+$/.test(c) && c !== 'D1');
  if (routed.length) return [...new Set(routed)];
  const b = boardV3CardDef(cardId);
  if (b) return b.board === 'work' ? ['D10'] : ['D9'];
  return SELF_FALLBACK.find((x) => x.cards.includes(cardId))?.charts ?? ['D9'];
}

/** the Self card groups' lens while the routing table has no row (doc 09 §4: 13 lenses, five on Self) */
const SELF_GROUP_LENS: Record<string, LensId> = { body: 'self.body', mind: 'self.mind', character: 'self.temperament', indian: 'self.purpose', time: 'self.chapter' };

/** the lens a card is read under: the routing table's, else its board lens (Love/Work) or its Self group's */
export function lensOf(cardId: string): LensId | null {
  const r = routeFor(cardId);
  if (r) return r.lens;
  const b = boardV3CardDef(cardId);
  if (b) return `${b.board}.${b.lens}` as LensId;
  const s = cardDef(cardId);
  return s ? (SELF_GROUP_LENS[s.group] ?? null) : null;
}
