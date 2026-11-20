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

/**
 * The sign dasha a card's route names, as the pack says it (doc 08 routes may name Narayana on D9 or D10, which the
 * engine does not cast yet, doc 07 E5): the stored system to read, and a note when it falls back to Narayana on D1.
 * A routing words table only; nothing computed.
 */
export function signDashaOf(cardId: string): { system: string; varga: string; note: string | null } | null {
  const raw = routeFor(cardId)?.signDasha?.trim();
  if (!raw) return null;
  const m = /^([a-z_ ]+?)(?:\s*(?:on|@|\/|\()?\s*(D\d+)\)?)?$/i.exec(raw);
  const system = (m?.[1] ?? raw).trim().toLowerCase().replace(/\s+/g, '_');
  const varga = (m?.[2] ?? 'D1').toUpperCase();
  if (system === 'narayana' && varga !== 'D1') {
    return { system, varga: 'D1', note: `The route names Narayana on ${varga}; the engine does not cast Narayana on ${varga} yet, so Narayana on D1 is read instead (say so; never present it as the ${varga} reading).` };
  }
  return { system, varga, note: null };
}
