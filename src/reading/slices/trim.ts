/**
 * Cutting a rendered slice down to what one agent can use (doc 70 Phase 3 replay fixes, 2026-11-10).
 *
 * The stored slices span a year back to eighteen months ahead (`sliceWindow`). A clock reader may only keep a cell whose
 * own row overlaps a frame span, and a card may only date a claim on a frame edge, so rows that end before the frame or
 * start after it cost input tokens and invite keys the validators then reject (the replay's two repairs). These helpers
 * select lines; they never change a value. Every row line kept is the engine's row exactly as the slice wrote it.
 */
import { shortHash } from '../self/v2/slices.js';
import type { RenderedSlice } from './types.js';

export interface DateRange {
  from: string;
  to: string;
}

const ROW = /^\{(pressure:[^}]+)\}\s(.*)$/;
const PROMISE = /^\{(promise:[^}]+)\}\s/;
const DATES = /(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/;
const KEYS = /\{([^}]+)\}/g;

/** the frame's date range: its first span's start to its end */
export const frameRange = (frame: { asOf: string; to: string; spans: ReadonlyArray<{ from: string }> }): DateRange => ({ from: frame.spans[0]?.from ?? frame.asOf, to: frame.to });

const overlaps = (from: string, to: string, r: DateRange): boolean => from < r.to && r.from < to;

/** the dates of a row line, or null when the line is not a dated row */
function rowDates(line: string): { key: string; from: string; to: string } | null {
  const m = ROW.exec(line);
  if (!m) return null;
  const d = DATES.exec(m[2]!);
  return d ? { key: m[1]!, from: d[1]!, to: d[2]! } : null;
}

/**
 * A slice with its dated rows cut to `range`: row lines that do not overlap it are left out, and so are their keys in
 * the slice's index lines (`by span`, `by house`). The header says how many were left out. Unchanged when every row
 * overlaps. The hash is the cut text's, so a store key built on it changes with the cut.
 */
export function trimSliceToRange(s: RenderedSlice, range: DateRange): RenderedSlice {
  const dropped = new Set<string>();
  const kept: string[] = [];
  for (const line of s.text.split('\n')) {
    const r = rowDates(line);
    if (r && !overlaps(r.from, r.to, range)) {
      dropped.add(r.key);
      continue;
    }
    kept.push(line);
  }
  if (!dropped.size) return s;
  const lines = kept.map((line) => {
    if (ROW.test(line) || !line.includes('{')) return line;
    let had = false;
    let left = false;
    const t = line.replace(/\s*\{([^}]+)\}/g, (all, k: string) => {
      had = true;
      if (dropped.has(k)) return '';
      left = true;
      return all;
    });
    return had && !left ? `${t.replace(/\s+$/, '')} none` : t;
  });
  lines.splice(1, 0, `(cut to ${range.from}..${range.to}: ${dropped.size} rows outside it left out)`);
  const text = lines.join('\n');
  const keys = s.keys.filter((k) => !dropped.has(k));
  return { ...s, text, keys, estTokens: Math.ceil(text.length / 2.2), hash: shortHash(`${s.id}\n${text}\n${keys.join(' ')}`) };
}

/**
 * The `MATTER ROWS` block of one card from its `matter.<key>` slices: each dated row once (a row touching two of the
 * card's matters was listed in both slices), only rows overlapping `range`, and rows or promise entries already written
 * in full in the shared prefix (`sky.window`, `year.tp`, `natal.core`) named by key only. Returns the text and every key
 * it carries.
 */
export function cardMatterRows(slices: readonly RenderedSlice[], range: DateRange, prefixKeys: ReadonlySet<string>): { text: string; keys: string[]; rows: number; left: number } {
  const groups = new Map<string, string[]>();
  const seen = new Set<string>();
  const inPrefix = new Set<string>();
  let left = 0;
  const add = (group: string, line: string) => {
    const g = groups.get(group) ?? [];
    g.push(line);
    groups.set(group, g);
  };
  for (const s of slices) {
    let group = '';
    for (const line of s.text.split('\n')) {
      if (line.startsWith('## ')) {
        group = line.slice(3).trim();
        continue;
      }
      const p = PROMISE.exec(line);
      const r = rowDates(line);
      const key = p?.[1] ?? r?.key;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      if (r && !overlaps(r.from, r.to, range)) {
        left += 1;
        continue;
      }
      if (prefixKeys.has(key)) {
        inPrefix.add(key);
        continue;
      }
      add(group || 'rows', line);
    }
  }
  const L: string[] = [];
  let rows = 0;
  for (const [g, lines] of groups) {
    L.push(`## ${g}`);
    L.push(...lines);
    rows += lines.length;
  }
  if (inPrefix.size) L.push(`## in the shared data above (full lines there): ${[...inPrefix].sort().map((k) => `{${k}}`).join(' ')}`);
  if (!L.length) L.push('(none stored)');
  const keys = new Set<string>(inPrefix);
  for (const line of L) for (const m of line.matchAll(KEYS)) keys.add(m[1]!);
  return { text: L.join('\n'), keys: [...keys].sort(), rows, left };
}
