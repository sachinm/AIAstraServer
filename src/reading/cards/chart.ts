/**
 * The chart-language reading of a card (docs/dashboards/13 §4.1): the stored Oracle card's gift, knot, certainty and
 * per-span `asks`, served as text only. Derived on every read from the stored `oracle`, so existing rows carry it with
 * no rebuild and no model call. Pure; never throws.
 *
 * Never served: the Oracle's span `agreement` sentence (it names internal subject keys such as `home_and_peace`; which
 * clocks agree stays the code-built `span.agreement` counts and `span.clocks`), and every evidence key array.
 */
import { INTERNAL_ID, redactEngineText } from '../self/v2/personalizerValidate.js';
import type { CardChartReading } from '../self/v3/types.js';

/** `{evidence keys}` the Oracle cites inline (the `stripKeys` rule of self/oracle.ts) */
const BRACE_KEYS = /\s*\{[^}]+\}/g;
/** an internal id written as a word: `home_and_peace`, `kala_sarpa` (no plain sentence holds an underscore) */
const SNAKE_ID = /[a-z0-9]+_[a-z0-9]+/i;

/**
 * One chart sentence as served, or null. Brace keys are stripped; a colon key outside braces (`planet:D1.Sa`) or a
 * snake_case id means the sentence would read broken once the key is cut, so it is dropped whole; engine names become
 * plain words.
 */
export function chartText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const unbraced = raw.replace(BRACE_KEYS, '');
  if (INTERNAL_ID.test(unbraced.replace(/[{}]/g, ''))) return null;
  const text = redactEngineText(unbraced.replace(/[{}]/g, '')).trim();
  if (!text || SNAKE_ID.test(text)) return null;
  return text;
}

/** The served chart reading of a stored Oracle card; null when the card is missing, malformed or has nothing left. */
export function chartReadingOf(oracle: unknown): CardChartReading | null {
  if (!oracle || typeof oracle !== 'object') return null;
  const o = oracle as { gift?: unknown; knot?: unknown; certainty?: unknown; spans?: unknown };
  const gift = chartText(o.gift);
  const knot = chartText(o.knot);
  const spans: CardChartReading['spans'] = [];
  if (Array.isArray(o.spans)) {
    for (const s of o.spans as unknown[]) {
      if (!s || typeof s !== 'object') continue;
      const { span, asks } = s as { span?: unknown; asks?: unknown };
      if (typeof span !== 'string' || !span.trim()) continue;
      const shows = chartText(asks);
      if (shows) spans.push({ span, shows });
    }
  }
  if (!gift && !knot && !spans.length) return null;
  const certainty = typeof o.certainty === 'string' && o.certainty.trim() ? o.certainty.trim() : null;
  return { gift, knot, certainty, spans };
}
