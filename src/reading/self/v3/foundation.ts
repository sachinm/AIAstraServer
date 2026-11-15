/**
 * The foundation card's code layer (docs/reading-engine/75 §4.1). Pure and words-only: it cleans stored text, and turns a
 * card's own stored windows (v2 card dates, v3 spans) into named periods and key dates. Every date and tone is copied
 * from a stored engine window; nothing astrological is computed here.
 */
import { getBoardKeyDatesMax, getBoardKeyDatesPastDays, getBoardPeriodsMax, getBoardPeriodsPastDays } from '../../../config/env.js';
import { daysIn, redactChartTerms } from '../v2/personalizerValidate.js';
import { dayLabel } from '../v2api/response.js';
import type { LadderSteps, PersonalCard } from '../v2types.js';
import type { CardPeriod, KeyDate, SelfV3CardContent, SpanTone } from './types.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------------------------------

/** Drops empty references a model left behind: "()", "(,)", "(, ,)", "(Mars ())" → "(Mars)", "(Amatyakaraka,)" → "(Amatyakaraka)". */
export function cleanEmptyRefs(text: string): string {
  let t = text;
  for (let i = 0; i < 4; i++) {
    const next = t
      .replace(/\(\s*(?:[,;:\-–]\s*)*\)/g, '')
      .replace(/\(\s*[,;]\s*/g, '(')
      .replace(/\s*[,;]\s*\)/g, ')')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
    if (next === t) break;
    t = next;
  }
  return t.replace(/[ \t]+([,.;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
}

/** One date format on the card: ISO days become "11 Nov 2026". */
export function isoDatesToWords(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (iso) => dayLabel(iso));
}

/** Read prose: empty references dropped, then any sentence with a chart term or engine name, then one date format. */
export function plainProse(text: string): string {
  return isoDatesToWords(redactChartTerms(cleanEmptyRefs(text)));
}

const firstSentence = (text: string): { head: string; rest: string } => {
  const m = /^(.+?[.!?])(\s+|$)([\s\S]*)$/.exec(text.trim());
  return m ? { head: m[1]!.trim(), rest: (m[3] ?? '').trim() } : { head: text.trim(), rest: '' };
};

function plainLadder(l: LadderSteps | null): LadderSteps | null {
  if (!l) return null;
  const out = { best: plainProse(l.best), practical: plainProse(l.practical), drift: plainProse(l.drift), floor: plainProse(l.floor) };
  return out.best || out.practical || out.drift || out.floor ? out : null;
}

/** A v2 card's Read text made plain; a headline that loses every sentence takes the body's first one. */
export function plainV2Card(card: PersonalCard): PersonalCard {
  let body = card.body.map(plainProse).filter(Boolean);
  let headline = plainProse(card.headline);
  if (!headline && body.length) {
    const { head, rest } = firstSentence(body[0]!);
    headline = head;
    body = rest ? [rest, ...body.slice(1)] : body.slice(1);
  }
  return {
    ...card,
    headline,
    body,
    patterns: card.patterns.map((p) => ({ ...p, text: plainProse(p.text) })).filter((p) => p.text),
    ladder: plainLadder(card.ladder),
    dates: card.dates.map((d) => ({ ...d, label: plainProse(d.label) })),
  };
}

/** A v3 card's Read text made plain. */
export function plainV3Card(c: SelfV3CardContent): SelfV3CardContent {
  const confirmText = c.confirm ? plainProse(c.confirm.text) : '';
  const patternText = c.pattern ? plainProse(c.pattern.text) : '';
  return {
    ...c,
    line: plainProse(c.line),
    spans: c.spans.map((s) => ({ ...s, asks: plainProse(s.asks), obstacle: plainProse(s.obstacle), step: plainProse(s.step) })),
    confirm: c.confirm && confirmText ? { ...c.confirm, text: confirmText } : null,
    pattern: c.pattern && patternText ? { ...c.pattern, text: patternText } : null,
    ladder: plainLadder(c.ladder),
  };
}

/** Chart details keep their terms (the doc 74 scrub owns that); only the empty references go. */
export function cleanDetails<D extends { headline?: string; paragraphs?: string[] }>(d: D): D {
  return {
    ...d,
    ...(d.headline !== undefined ? { headline: cleanEmptyRefs(d.headline) } : {}),
    ...(d.paragraphs ? { paragraphs: d.paragraphs.map(cleanEmptyRefs).filter(Boolean) } : {}),
  };
}

/** every Read string of a card, for the stale check */
export function readTexts(v2: PersonalCard | null, v3: SelfV3CardContent | null): string[] {
  if (v3) {
    return [v3.line, ...v3.spans.flatMap((s) => [s.asks, s.obstacle, s.step]), v3.confirm?.text ?? '', v3.pattern?.text ?? '', ...Object.values(v3.ladder ?? {})].filter(Boolean);
  }
  if (!v2) return [];
  return [v2.headline, ...v2.body, ...v2.patterns.map((p) => p.text), ...Object.values(v2.ladder ?? {})].filter(Boolean);
}

// ---------------------------------------------------------------------------------------------------------------------
// Stale guard
// ---------------------------------------------------------------------------------------------------------------------

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MONTHS3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\b(?!\\.?,?\\s+\\d{4})`, 'gi');
const MONTH_DAY = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!,?\\s+\\d{4})(?!\\d)`, 'gi');

/** "11 November" / "November 11" with no year: the year of `base`, or the next one when that falls 60+ days before it */
function yearless(day: number, month: string, base: string): string | null {
  const mon = MONTHS3.indexOf(month.slice(0, 3).toLowerCase()) + 1;
  if (mon < 1 || day < 1 || day > 31) return null;
  const y = Number(base.slice(0, 4));
  const iso = (yy: number) => `${yy}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return iso(y) < addDays(base, -60) ? iso(y + 1) : iso(y);
}

/** Every day a text names, with or without a year (no-year days resolved against `base`). */
export function datesNamed(text: string, base: string): string[] {
  const out = daysIn(text);
  for (const m of text.matchAll(DAY_MONTH)) {
    const d = yearless(Number(m[1]), m[2]!, base);
    if (d) out.push(d);
  }
  for (const m of text.matchAll(MONTH_DAY)) {
    const d = yearless(Number(m[2]), m[1]!, base);
    if (d) out.push(d);
  }
  return out;
}

/**
 * The days the text spoke of as still ahead when it was written (on or after the build day) that have now passed. A day
 * already past at the build is history, not stale. Sorted, unique.
 */
export function staleDatesIn(texts: readonly string[], today: string, builtAt: string | null): string[] {
  const built = builtAt && ISO.test(builtAt.slice(0, 10)) ? builtAt.slice(0, 10) : null;
  const base = built ?? today;
  const out = new Set<string>();
  for (const t of texts) for (const d of datesNamed(t, base)) if (d < today && (!built || d >= built)) out.add(d);
  return [...out].sort();
}

// ---------------------------------------------------------------------------------------------------------------------
// Periods and key dates
// ---------------------------------------------------------------------------------------------------------------------

/** one stored window of a card: its dates, the Oracle's own name for it, its held tone, and its own text */
export interface CardWindow {
  from: string;
  to: string;
  /** the Oracle's own label for the window (already plain), or null */
  label: string | null;
  /** the tone at least READING_CLOCKS_MIN clocks hold; null when unheld or unknown */
  tone: SpanTone | null;
  /** the window's own headline (Phase B: what it asks); null: the first sentence of its text */
  headline: string | null;
  text: string[];
  span: string | null;
}

const TONE_NAME: Readonly<Record<SpanTone, string>> = { heavy: 'Heavy stretch', mixed: 'Mixed stretch', light: 'Lighter stretch' };

const shortLabel = (label: string | null): string | null => {
  const l = (label ?? '').replace(/[.!?]+$/, '').trim();
  if (!l || l.split(/\s+/).length > 5) return null;
  return l[0]!.toUpperCase() + l.slice(1);
};

/** Windows sorted by start, those ending the same day merged into one (earliest start, texts joined). */
export function mergeWindows(windows: readonly CardWindow[]): CardWindow[] {
  const valid = windows.filter((w) => ISO.test(w.from) && ISO.test(w.to) && w.from <= w.to);
  const byEnd = new Map<string, CardWindow>();
  for (const w of [...valid].sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)))) {
    const had = byEnd.get(w.to);
    if (!had) {
      byEnd.set(w.to, { ...w, text: [...w.text] });
      continue;
    }
    had.label ??= w.label;
    had.tone ??= w.tone;
    had.headline ??= w.headline;
    had.span ??= w.span;
    for (const t of w.text) if (!had.text.includes(t)) had.text.push(t);
  }
  return [...byEnd.values()].sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)));
}

type Place = 'passed' | 'current' | 'future';
const placeOf = (w: { from: string; to: string }, today: string): Place => (w.to < today ? 'passed' : w.from <= today ? 'current' : 'future');

/** names in date order: held tone, else the Oracle's short label, else by place */
function namesOf(windows: readonly CardWindow[], today: string): string[] {
  let futures = 0;
  return windows.map((w) => {
    const place = placeOf(w, today);
    const byPlace = place === 'passed' ? 'Earlier stretch' : place === 'current' ? 'This stretch' : futures++ === 0 ? 'Next stretch' : 'Later stretch';
    return w.tone ? TONE_NAME[w.tone] : shortLabel(w.label) ?? byPlace;
  });
}

export interface PeriodOptions {
  max?: number;
  pastDays?: number;
}

/**
 * The card's named periods: merged windows, in start order, passed ones older than `pastDays` dropped, each with its own
 * headline (given, else the first sentence of its text) and the rest of its text; a window with no text of its own is
 * not a period. At most `max`: the oldest passed go first, then the latest.
 */
export function periodsFrom(windows: readonly CardWindow[], today: string, o: PeriodOptions = {}): CardPeriod[] {
  const max = o.max ?? getBoardPeriodsMax();
  const horizon = addDays(today, -(o.pastDays ?? getBoardPeriodsPastDays()));
  const merged = mergeWindows(windows);
  const names = namesOf(merged, today);
  const out: Array<Omit<CardPeriod, 'id'>> = [];
  merged.forEach((w, i) => {
    if (w.to < horizon) return;
    let headline = (w.headline ?? '').trim();
    let text = w.text.map((t) => t.trim()).filter(Boolean);
    if (!headline && text.length) {
      const { head, rest } = firstSentence(text[0]!);
      headline = head;
      text = rest ? [rest, ...text.slice(1)] : text.slice(1);
    }
    if (!headline) return;
    const place = placeOf(w, today);
    out.push({
      name: names[i]!,
      label: `${names[i]} · ${dayLabel(w.from)} – ${dayLabel(w.to)}`,
      from: w.from,
      to: w.to,
      headline,
      text,
      tone: w.tone,
      current: place === 'current',
      passed: place === 'passed',
      span: w.span,
    });
  });
  while (out.length > max) {
    const oldestPassed = out.findIndex((p) => p.passed);
    out.splice(oldestPassed >= 0 ? oldestPassed : out.length - 1, 1);
  }
  return out.map((p, i) => ({ id: `p${i + 1}`, ...p }));
}

export interface KeyDateOptions {
  max?: number;
  pastDays?: number;
}

/**
 * The turning points of the card's own windows, in plain words: a window's start ("<name> begins") and end ("<name>
 * ends"); a day that ends one window and starts another is the starting one's. Passed days older than `pastDays` are
 * dropped; at most two passed are kept, then the upcoming ones, `max` in all.
 */
export function keyDatesFrom(windows: readonly CardWindow[], today: string, o: KeyDateOptions = {}): KeyDate[] {
  const max = o.max ?? getBoardKeyDatesMax();
  const horizon = addDays(today, -(o.pastDays ?? getBoardKeyDatesPastDays()));
  const merged = mergeWindows(windows);
  const names = namesOf(merged, today);
  const at = new Map<string, KeyDate>();
  merged.forEach((w, i) => {
    const name = names[i]!;
    if (!at.has(w.to)) at.set(w.to, { date: w.to, label: `${name} ends`, tone: w.tone, passed: w.to < today });
    at.set(w.from, { date: w.from, label: `${name} begins`, tone: w.tone, passed: w.from < today });
  });
  const all = [...at.values()].filter((k) => k.date >= horizon).sort((a, b) => a.date.localeCompare(b.date));
  const passed = all.filter((k) => k.passed).slice(-2);
  const upcoming = all.filter((k) => !k.passed);
  return [...passed, ...upcoming].slice(0, max);
}

// ---------------------------------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------------------------------

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (iso: string): string => `${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${iso.slice(0, 4)}`;

/** "Your year: Oct 2026 to Oct 2027" from the stored annual chart dates; "Your year" when they are not stored. */
export function yearTitle(range: { from: string; to: string } | 'always' | null | undefined): string {
  if (!range || range === 'always' || !ISO.test(range.from.slice(0, 10)) || !ISO.test(range.to.slice(0, 10))) return 'Your year';
  return `Your year: ${monthYear(range.from)} to ${monthYear(range.to)}`;
}
