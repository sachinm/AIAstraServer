/**
 * The text checks every Personalizer shares (the v2 board's and the card Personalizer): in-place redaction of the engine's
 * names and internal keys, the days a text names and the date frame. Moved unchanged from self/v2/personalizerValidate.ts
 * (plan "retire the v2 Self reading", server step 1); the old path re-exports.
 */
import type { StatedGender } from './v2types.js';

/**
 * No word filters (docs/reading-engine/82, Sachin 2026-11-18: "There should be no filter in the software. The
 * Personalizer takes care of filters for words."). Chart terms, medical and diet words, role and career-stage words,
 * gendered words and stereotype phrases, word caps and dates in prose are the prompt's job; nothing here drops text.
 * The one step left on text is in-place redaction of the engine's internal names and internal keys (CLAUDE.md: never
 * shown), which changes words and never removes a sentence, a card or a build.
 */

/** the calculation engine's names (SOUL.md §1) */
export const ENGINE_NAMES = /\b(aiastra_radha|pyjhora|jhora|radha)\b/i;

/** internal ids: evidence keys, claim ids, braces */
export const INTERNAL_ID = /\{|\}|\b(claim|planet|house|point|yoga|activation|annual|window|risk|promise|star):[\w.@/-]+/i;

/** The text with engine names replaced by plain words and internal keys and braces removed. Never drops a sentence. */
export function redactEngineText(text: string): string {
  if (!ENGINE_NAMES.test(text) && !INTERNAL_ID.test(text)) return text;
  return text
    .replace(new RegExp(ENGINE_NAMES.source, 'gi'), 'traditional calculations')
    .replace(new RegExp(INTERNAL_ID.source, 'gi'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/**
 * Fields that hold ids, keys and dates, not prose: never redacted (a claim id or an evidence key such as `planet:D1.Sa`
 * matches INTERNAL_ID and must stay whole; the confirm answer is recorded against the claim id).
 */
const STRUCTURED_KEYS = new Set(['sources', 'source', 'claimId', 'areaId', 'evidence', 'key', 'id', 'span', 'card', 'from', 'to', 'since', 'until', 'easesAt', 'nextCheck', 'tone', 'kind', 'certainty', 'paragraphId']);

/** Every prose string in a value redacted with `redactEngineText`; structured fields (STRUCTURED_KEYS) left as they are. */
export function redactEngineDeep<T>(v: T): T {
  if (typeof v === 'string') return redactEngineText(v) as T;
  if (Array.isArray(v)) return v.map((x) => redactEngineDeep(x)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, STRUCTURED_KEYS.has(k) ? x : redactEngineDeep(x)])) as T;
  return v;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** the days named in a text: ISO days and "16 Feb 2028" style */
export function daysIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of text.matchAll(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi)) {
    const mon = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1;
    out.push(`${m[3]}-${String(mon).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`);
  }
  return out;
}

export interface DateFrame {
  days: Set<string>;
  months: Set<string>;
  years: Set<string>;
  pairs: Set<string>;
}

export function frameOf(dates: Iterable<string>, pairs: Iterable<[string, string]> = []): DateFrame {
  const f: DateFrame = { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() };
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    f.days.add(d);
    f.months.add(d.slice(0, 7));
    f.years.add(d.slice(0, 4));
  }
  for (const [a, b] of pairs) f.pairs.add(`${a}|${b}`);
  return f;
}

/** what the card checks know of the person (gender for the voice; the frame's dates); no word lists (doc 82) */
export interface TextCheckContext {
  gender: StatedGender | null;
  dates: DateFrame;
}

/** The text with engine names redacted in place (doc 82: no sentence is dropped). Kept under its old name for callers. */
export function redactChartTerms(text: string): string {
  return redactEngineText(text);
}
