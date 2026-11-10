/**
 * The v3 year frame (docs/reading-engine/68 §4.5 items 2–3): the next twelve months cut into three to six spans whose
 * every edge is a stored period boundary, each span with the reading clock's tone and the other clocks' tones for
 * agreement. Built from the engine's stored `pressure_inventory` rows only.
 *
 * What Node does here is selection and counting, never astrology: a span's tone is the engine's `polarity` of the stored
 * period row covering the span's first day, copied through a fixed words table (presses → heavy, mixed → mixed, supports
 * → light); agreement counts clocks whose copied tone is the same word. No boundary, tone or strength is computed.
 *
 * Cutting rule: try the reading clock's level-3 edges (plus the Tithi Pravesha year edge), merge neighbours with the same
 * tone, and when more than RAIL spans remain, cut on level-2 edges instead; still too many: keep the first RAIL. The last
 * span ends on a stored edge, so the frame can run a little past twelve months.
 */
import type { PrismaClient } from '@prisma/client';
import { addMonthsIso } from '../../timeline/months.js';
import { asPressurePayload, PRESSURE_AYANAMSA, PRESSURE_TYPE, pressureVariant, toPressureInventory, type PressureInventoryDetail, type PressureRowDetail } from '../sub/pressure.js';
import type { ReadingClockSet } from '../clock.js';
import type { ClockResolution, Polarity, YearFrame } from '../v2types.js';
import type { SpanClockTone, SpanPlace, SpanTone, YearFrameV3, YearSpan } from './types.js';

export const FRAME_MONTHS = 12;
export const FRAME_MAX_SPANS = 6;
/** at most this many other clocks are read for agreement */
export const FRAME_MAX_OTHER_CLOCKS = 4;
/** rows listed per span, strongest first */
export const FRAME_ROWS_PER_SPAN = 6;
export const TP_SYSTEM = 'tithi_pravesha';

/** the words table: the engine's polarity → the tone word the board shows */
export const TONE_OF: Readonly<Record<Polarity, SpanTone>> = { presses: 'heavy', mixed: 'mixed', supports: 'light' };
const POLARITY_ORDER: Readonly<Record<Polarity, number>> = { presses: 0, mixed: 1, supports: 2 };

export const rowKey = (r: Pick<PressureRowDetail, 'id'>): string => `pressure:${r.id}`;

export interface YearFrameInput {
  asOf: string;
  clock: Pick<ClockResolution, 'primary' | 'confirming' | 'applicable' | 'notApplicable'>;
  /** the stored inventory on the reading clock */
  primary: PressureInventoryDetail | null;
  /** stored inventories of the other clocks (null: none stored) */
  others: ReadonlyArray<{ system: string; inventory: PressureInventoryDetail | null }>;
  year: YearFrame | null;
}

const covers = (r: { from: string; to: string }, day: string): boolean => r.from <= day && day < r.to;

/** the stored dasha rows of one clock in an inventory (rows without a system are the inventory's own clock) */
function dashaRows(inv: PressureInventoryDetail, system: string, maxLevel: number): PressureRowDetail[] {
  return inv.rows.filter((r) => r.kind === 'dasha' && (r.system ? r.system.replace(/^dasha\./, '') === system : inv.clock === system) && (r.level ?? 1) <= maxLevel);
}

/** the deepest stored row covering `day` (level 3 before 2 before 1); ties keep the engine's order */
export function deepestAt<T extends { from: string; to: string; level?: number }>(rows: readonly T[], day: string): T | null {
  let best: T | null = null;
  for (const r of rows) if (covers(r, day) && (!best || (r.level ?? 1) > (best.level ?? 1))) best = r;
  return best;
}

interface Atom {
  from: string;
  to: string;
  row: PressureRowDetail;
  opensWith: string;
}

function cut(rows: readonly PressureRowDetail[], asOf: string, end: string, extraEdges: readonly string[], tpKey: string | null, tpFrom: string | null): Atom[] {
  const first = deepestAt(rows, asOf);
  if (!first) return [];
  const edges = [...new Set([...rows.flatMap((r) => [r.from, r.to]), ...extraEdges])].filter((d) => d > first.from).sort();
  const atoms: Atom[] = [];
  let from = first.from;
  for (const to of edges) {
    if (from >= end) break;
    const row = deepestAt(rows, from);
    if (!row) break;
    const starting = rows.find((r) => r.from === from && (r.level ?? 1) === (row.level ?? 1));
    const opensWith = starting ? rowKey(starting) : tpKey && tpFrom === from ? tpKey : rowKey(row);
    atoms.push({ from, to, row, opensWith });
    from = to;
  }
  // merge neighbours whose copied tone is the same word
  const merged: Atom[] = [];
  for (const a of atoms) {
    const last = merged[merged.length - 1];
    if (last && TONE_OF[last.row.polarity] === TONE_OF[a.row.polarity] && last.to === a.from) last.to = a.to;
    else merged.push({ ...a });
  }
  return merged;
}

function toneOn(rows: readonly PressureRowDetail[], day: string): { tone: SpanTone; evidence: string } | null {
  const r = deepestAt(rows, day);
  return r ? { tone: TONE_OF[r.polarity], evidence: rowKey(r) } : null;
}

export function buildYearFrameV3(i: YearFrameInput): YearFrameV3 {
  const end = addMonthsIso(i.asOf, FRAME_MONTHS);
  const system = i.clock.primary;
  const empty = (why: string): YearFrameV3 => ({
    asOf: i.asOf,
    to: end,
    clock: system,
    spans: [],
    saturn: [],
    clocksRead: [],
    clocksSkipped: [{ system, reason: why }],
    degraded: true,
  });
  if (!i.primary || i.primary.clock !== system) return empty('no stored tone for the reading clock');

  const tpOn = Boolean(i.year && !i.year.noCoverage);
  // the year edge is a stored boundary: the engine's annual row that starts the next Tithi Pravesha year
  const nextYearRow = tpOn ? i.primary.rows.find((r) => r.kind === 'annual' && (r.level ?? 1) === 1 && r.from === i.year!.to) ?? null : null;
  const tpKey = nextYearRow ? rowKey(nextYearRow) : null;
  const tpEdges = tpOn ? [i.year!.to].filter((d) => d > i.asOf && d < end) : [];

  let atoms: Atom[] = [];
  for (const level of [3, 2]) {
    atoms = cut(dashaRows(i.primary, system, level), i.asOf, end, tpEdges, tpKey, tpOn ? i.year!.to : null);
    if (atoms.length && atoms.length <= FRAME_MAX_SPANS) break;
  }
  const degradedCut = atoms.length > FRAME_MAX_SPANS;
  atoms = atoms.slice(0, FRAME_MAX_SPANS);
  if (!atoms.length) return empty('no stored period of the reading clock covers today');

  // the other clocks: the Tithi Pravesha year rows (stored in the same inventory), then the stored inventories
  const annual = i.primary.rows.filter((r) => r.kind === 'annual');
  const annualAt = (day: string) => {
    const rows = annual.filter((r) => covers(r, day));
    const r = rows.find((x) => (x.level ?? 1) === 2) ?? rows.find((x) => (x.level ?? 1) === 1) ?? null;
    return r ? { tone: TONE_OF[r.polarity], evidence: rowKey(r) } : null;
  };
  const skipped: YearFrameV3['clocksSkipped'] = i.clock.notApplicable.map((n) => ({ system: n.system, reason: 'does not apply to this chart' }));
  const others: Array<{ system: string; rows: PressureRowDetail[] }> = [];
  for (const o of i.others.slice(0, FRAME_MAX_OTHER_CLOCKS)) {
    if (o.system === system) continue;
    if (!o.inventory) {
      skipped.push({ system: o.system, reason: 'no stored tone' });
      continue;
    }
    others.push({ system: o.system, rows: dashaRows(o.inventory, o.system, 3) });
  }
  for (const o of i.others.slice(FRAME_MAX_OTHER_CLOCKS)) skipped.push({ system: o.system, reason: 'not read (limit)' });

  const read = new Set<string>([system]);
  const spans: YearSpan[] = atoms.map((a, idx) => {
    const tone = TONE_OF[a.row.polarity];
    const clocks: SpanClockTone[] = [{ system, tone, evidence: rowKey(a.row) }];
    const tp = annualAt(a.from);
    if (tp) {
      clocks.push({ system: TP_SYSTEM, ...tp });
      read.add(TP_SYSTEM);
    }
    for (const o of others) {
      const t = toneOn(o.rows, a.from);
      if (t) {
        clocks.push({ system: o.system, ...t });
        read.add(o.system);
      }
    }
    const rows = i.primary!.rows
      .filter((r) => r.from < a.to && a.from < r.to)
      .sort((x, y) => y.strength - x.strength || POLARITY_ORDER[x.polarity] - POLARITY_ORDER[y.polarity] || x.from.localeCompare(y.from))
      .slice(0, FRAME_ROWS_PER_SPAN)
      .map((r) => ({ id: rowKey(r), polarity: r.polarity, strength: r.strength, matters: [...r.matters] }));
    const place: SpanPlace = covers(a, i.asOf) || (idx === 0 && a.from <= i.asOf) ? 'now' : idx === 1 ? 'next' : 'later';
    return {
      id: `s${idx + 1}`,
      from: a.from,
      to: a.to,
      place,
      tone,
      clocks,
      agree: clocks.filter((c) => c.tone === tone).length,
      of: clocks.length,
      opensWith: a.opensWith,
      rows,
    };
  });
  // "next" is the span after "now", wherever "now" is
  const nowIdx = spans.findIndex((s) => s.place === 'now');
  spans.forEach((s, idx) => {
    if (idx < nowIdx) s.place = 'now';
    else if (idx === nowIdx + 1) s.place = 'next';
    else if (idx > nowIdx + 1) s.place = 'later';
  });

  const saturn = i.primary.rows
    .filter((r) => r.kind === 'sade_sati' && r.from < end && i.asOf < r.to)
    .map((r) => ({ from: r.from, to: r.to, houseFromMoon: r.houseFromMoon, evidence: rowKey(r) }));

  const listed = new Set([...spans.flatMap((s) => [s.opensWith, ...s.clocks.map((c) => c.evidence), ...s.rows.map((r) => r.id)]), ...saturn.map((x) => x.evidence)]);
  const aliases: Record<string, string> = {};
  for (const r of [...i.primary.rows, ...others.flatMap((o) => o.rows)]) {
    const key = rowKey(r);
    if (!listed.has(key)) continue;
    // the row id, the engine's own evidence keys, and the activation spelling of a period row (same id, v2 prefix)
    const spellings = [r.id, ...r.evidence, ...(r.id.startsWith('dasha:') ? [`activation:${r.id.slice('dasha:'.length)}`] : [])];
    for (const a of spellings) if (a && a !== key && !listed.has(a)) aliases[a] = key;
  }

  return {
    aliases,
    asOf: i.asOf,
    to: spans[spans.length - 1]!.to,
    clock: system,
    spans,
    saturn,
    clocksRead: [...read],
    clocksSkipped: skipped,
    degraded: degradedCut || read.size < 2,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The Oracle's suffix block (the layout the prompt `oracle/self-cards-v3` reads)
// ---------------------------------------------------------------------------------------------------------------------

export function renderYearFrame(f: YearFrameV3, clockLabel: string): { text: string; keys: string[] } {
  const keys = new Set<string>();
  const k = (key: string) => {
    keys.add(key);
    return `{${key}}`;
  };
  const lines: string[] = [`TODAY: ${f.asOf}`, `CLOCK: ${clockLabel}`, 'YEAR FRAME (the spans of the next twelve months; every date you write must be a span edge below)'];
  for (const s of f.spans) {
    lines.push(`${s.id} ${s.from}..${s.to} place=${s.place} tone=${s.tone} agree=${s.agree}/${s.of} opens=${k(s.opensWith)}`);
    lines.push(`  clocks: ${s.clocks.map((c) => `${c.system}=${c.tone} ${k(c.evidence)}`).join('; ')}`);
    lines.push(`  rows: ${s.rows.length ? s.rows.map((r) => `${k(r.id)} ${r.polarity} strength=${r.strength} matters=${r.matters.join(',')}`).join('; ') : 'none'}`);
  }
  lines.push(
    `SATURN PASSAGE: ${f.saturn.length ? f.saturn.map((x) => `${k(x.evidence)} ${x.from}..${x.to} house_from_moon=${x.houseFromMoon ?? 'unknown'}`).join('; ') : 'none stored'}`,
  );
  lines.push(`CLOCKS NOT READ: ${f.clocksSkipped.length ? f.clocksSkipped.map((c) => `${c.system} (${c.reason})`).join('; ') : 'none'}`);
  return { text: lines.join('\n'), keys: [...keys] };
}

/** every date a v3 card may name: the span edges, the Saturn rows' edges and TODAY (a confirm's lived part ends today) */
export function frameDates(f: YearFrameV3): Set<string> {
  return new Set([f.asOf, ...f.spans.flatMap((s) => [s.from, s.to]), ...f.saturn.flatMap((x) => [x.from, x.to])]);
}

// ---------------------------------------------------------------------------------------------------------------------
// Load: a clock's stored inventory (the fallback when a pull at build time fails; doc 70 moves pulls to the sync worker)
// ---------------------------------------------------------------------------------------------------------------------

type InventoryPrisma = {
  kundliData?: { findUnique?: (q: { where: { kundli_data_key: { kundli_id: string; data_type: string; variant: string; ayanamsa: string } } }) => Promise<{ status: string; payload: unknown } | null> };
};

export async function loadStoredInventory(prisma: PrismaClient, kundliId: string, system: string): Promise<PressureInventoryDetail | null> {
  const p = prisma as unknown as InventoryPrisma;
  const row = await p.kundliData
    ?.findUnique?.({ where: { kundli_data_key: { kundli_id: kundliId, data_type: PRESSURE_TYPE, variant: pressureVariant(system), ayanamsa: PRESSURE_AYANAMSA } } })
    .catch(() => null);
  const payload = row?.payload ? asPressurePayload(row.payload) : null;
  return payload ? toPressureInventory(payload, kundliId).inventory : null;
}

/**
 * The clocks read beside the reading clock. With the reading clock set (doc 70 §4.1, `resolveReadingClocks`): its pulled
 * systems in order. Without one (the set could not be read): the confirming clocks, then the conditional ones the engine
 * says apply, as before.
 */
export function otherClocks(clock: Pick<ClockResolution, 'primary' | 'confirming' | 'applicable'>, set?: Pick<ReadingClockSet, 'pulled'> | null): string[] {
  const list = set ? set.pulled : [...clock.confirming, ...clock.applicable];
  return [...new Set(list)].filter((s) => s !== clock.primary);
}
