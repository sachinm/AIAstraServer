/**
 * The stored date frame of a build (the dated windows S2, S3 and S9 carry, plus the briefs' dates): the validators' and
 * the card readers' frame. Moved unchanged from `self/v2/oracle.ts` (plan "retire the v2 Self reading", server step 1);
 * the old path re-exports.
 */
import type { AreaBrief, SelfBuildContext, WindowRef } from './v2types.js';

/** The validator's date frame: the days and windows of the input, and the exact spans and edges a date may name. */
export interface StoredFrame {
  boundaries: Set<string>;
  windows: Array<{ from: string; to: string }>;
  /** exact stored spans, `from|to`: every window, consecutive period boundaries of one level, the briefs' dates */
  spans: Set<string>;
  /** every boundary and every window or brief-date edge */
  endpoints: Set<string>;
}

/**
 * The dated windows S2, S3 and S9 carry (and the S7/S8 engine spans the prompt asks about), plus the briefs' dates: the
 * validator's frame. A date must be one of `spans` exactly (doc 66 replay failure 8: made-up 1–7-day spans passed
 * because each day lay inside the year span).
 */
export function storedWindowsOf(ctx: SelfBuildContext, briefs: readonly Pick<AreaBrief, 'dates'>[] = []): StoredFrame {
  const boundaries = new Set<string>();
  const windows: Array<{ from: string; to: string }> = [];
  const span = (x: { from: string; to: string } | null | undefined) => {
    if (x?.from && x.to) windows.push({ from: x.from, to: x.to });
  };
  const day = (d: string | null | undefined) => {
    if (d) boundaries.add(d);
  };
  const s = ctx.sub;
  if (s.periods) {
    for (const p of [s.periods.previous, s.periods.running, s.periods.next, s.periods.runningSub, s.periods.runningSubSub]) span(p);
    for (const b of s.periods.boundaries) day(b.date);
  }
  if (s.windows) {
    const rows: WindowRef[] = [...s.windows.strip, ...s.windows.startedLast12m, ...s.windows.endingNext6m, ...Object.values(s.windows.byMatter).flatMap((x) => x ?? [])];
    if (s.windows.heaviestNow) rows.push(s.windows.heaviestNow);
    for (const r of rows) span(r);
    day(s.windows.easesAt);
    day(s.windows.nextSupportFrom);
  }
  if (s.year && !s.year.noCoverage) {
    span(s.year);
    span(s.year.shortClock);
    span(s.year.confirmClock);
  }
  for (const l of s.body?.liveLords ?? []) day(l.until);
  for (const r of s.body?.liveTransits ?? []) span(r);
  span(s.presence?.bestWindow);
  day(s.presence?.liveCare?.until);
  const spans = new Set(windows.map((w) => `${w.from}|${w.to}`));
  const endpoints = new Set([...boundaries, ...windows.flatMap((w) => [w.from, w.to])]);
  // a sub-period ahead is the span between two consecutive boundaries of its level
  const byLevel = new Map<number, string[]>();
  for (const b of s.periods?.boundaries ?? []) byLevel.set(b.level, [...(byLevel.get(b.level) ?? []), b.date]);
  for (const days of byLevel.values()) {
    const sorted = [...new Set(days)].sort();
    for (let i = 1; i < sorted.length; i++) spans.add(`${sorted[i - 1]}|${sorted[i]}`);
  }
  for (const b of briefs) {
    for (const d of b.dates) {
      if (!d.from || !d.to) continue;
      spans.add(`${d.from}|${d.to}`);
      endpoints.add(d.from);
      endpoints.add(d.to);
      windows.push({ from: d.from, to: d.to });
    }
  }
  return { boundaries, windows, spans, endpoints };
}
