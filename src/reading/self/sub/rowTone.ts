/**
 * The heavy-tone stopgap (docs/reading-engine/70-heavy-clocks-2026-11-10.md): the ONE place a stored pressure row
 * becomes a tone word. Used by the year frame (spans, the clocks per span, the year rows) and by the slices the clock
 * readers read (`rowLine` writes the tone; the reader validator checks against it).
 *
 * Why: the engine sets a dasha or annual row to `presses` when any ONE of six bad flags in the row's stored `reasons`
 * list is on (fits 884 of 884 dasha rows and 565 of 565 annual rows on staging), so about 80% of period rows press and
 * "three clocks agree on heavy" is true most days. Until the engine grades polarity itself (filed in docs/TODOS.md),
 * the server counts the stored flags:
 *
 *   engine `presses`  and >= PRESSES_MIN_BAD_FLAGS (default 3) bad flags  → heavy
 *   engine `presses`  and fewer bad flags                                  → mixed
 *   engine `mixed`                                                         → mixed
 *   engine `supports`                                                      → light
 *   a row of another kind (transit, sade_sati, station, return), or a row without a stored `reasons` list → the
 *   engine's own verdict through the fixed words table (presses heavy, mixed mixed, supports light)
 *
 * This is a selection over a stored field: it reads the engine's list and counts it, and computes no astrology. It
 * does reshape the engine's verdict, so it waits on Sachin's confirmation (env `PRESSES_MIN_BAD_FLAGS=1` restores the
 * engine's tone exactly). The engine polarity stays visible: `graded.engine` and the slice line's `polarity=` field.
 */
import { getPressesBadFlags, getPressesGoodFlags, getPressesMinBadFlags } from '../../../config/env.js';
import type { Polarity } from '../v2types.js';
import type { SpanTone } from '../v3/types.js';

/** the engine's words table: polarity → tone (kept for rows the stopgap does not grade) */
export const ENGINE_TONE: Readonly<Record<Polarity, SpanTone>> = { presses: 'heavy', mixed: 'mixed', supports: 'light' };

/** the kinds whose polarity is the OR over `reasons` (transits follow the engine's gochara table and are not graded) */
export const GRADED_KINDS: ReadonlySet<string> = new Set(['dasha', 'annual']);

export interface ToneRule {
  minBad: number;
  bad: readonly string[];
  good: readonly string[];
}

export const toneRule = (): ToneRule => ({ minBad: getPressesMinBadFlags(), bad: getPressesBadFlags(), good: getPressesGoodFlags() });

export interface GradedRow {
  tone: SpanTone;
  /** the engine's own polarity, as stored */
  engine: Polarity;
  /** the stored bad flags on the row */
  bad: string[];
  good: string[];
  /** true when the stopgap changed the engine's word (presses with too few flags → mixed) */
  softened: boolean;
}

export interface ToneRowInput {
  kind: string;
  polarity: Polarity;
  /** the engine's stored `reasons`; undefined when the payload carried none */
  reasons?: readonly string[] | null;
}

/** The tone of one stored row. Pure; `rule` defaults to the env. */
export function gradeRow(r: ToneRowInput, rule: ToneRule = toneRule()): GradedRow {
  const reasons = Array.isArray(r.reasons) ? r.reasons : null;
  const bad = reasons ? reasons.filter((x) => rule.bad.includes(x)) : [];
  const good = reasons ? reasons.filter((x) => rule.good.includes(x)) : [];
  const engineTone = ENGINE_TONE[r.polarity];
  if (r.polarity !== 'presses' || !reasons || !GRADED_KINDS.has(r.kind)) return { tone: engineTone, engine: r.polarity, bad, good, softened: false };
  const heavy = bad.length >= rule.minBad;
  return { tone: heavy ? 'heavy' : 'mixed', engine: r.polarity, bad, good, softened: !heavy };
}

/** The tone word of one stored row (see the header). */
export const toneOfRow = (r: ToneRowInput, rule?: ToneRule): SpanTone => gradeRow(r, rule).tone;
