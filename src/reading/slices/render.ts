/**
 * Pure slice renderers (docs/reading-engine/70 §4.1 Layer 1). Same rows in, same bytes out: every list is sorted by a
 * fixed key with a plain code-point comparison, nothing carries a build time, and the hash is over the text and keys.
 *
 * Node selects (by kind, by the clock a row belongs to, by date overlap with a span, by the engine's own `matters` and
 * `housesTouched` fields), de-duplicates by row id, counts and formats. It computes no date, house, polarity, strength
 * or matter: those are the engine's, carried through by row id (`pressure:<id>`, the key the year frame uses).
 */
import { addMonthsIso } from '../timeline/months.js';
import type { PressureInventoryDetail, PressureRowDetail } from '../self/sub/pressure.js';
import type { SelfFamilyAgentId, SelfFamilyPack } from '../self/oracle.js';
import { estProviderTokens, KeyBook, oraclePrefix, promiseKey, shortHash } from '../self/v2/slices.js';
import type { PromiseEntry, PromiseLedger, YearFrame } from '../self/v2types.js';
import type { YearFrameV3 } from '../self/v3/types.js';
import { rowKey, TP_SYSTEM } from '../self/v3/yearFrame.js';
import { clockSliceId, matterSliceId, type RenderedSlice, type SliceSource } from './types.js';

/** the clock window: a year back to eighteen months ahead of the frame's today (doc 70 §4.1) */
export const SLICE_MONTHS_BACK = 12;
export const SLICE_MONTHS_AHEAD = 18;
/** the kinds that do not depend on a period clock: stored once, whatever inventory they came in */
export const SKY_KINDS: readonly PressureRowDetail['kind'][] = ['transit', 'sade_sati', 'station', 'return'];
export const YEAR_KINDS: readonly PressureRowDetail['kind'][] = ['annual'];
const SHARED_KINDS = new Set<string>([...SKY_KINDS, ...YEAR_KINDS]);

/** plain code-point order (never locale order: the bytes must not depend on the machine) */
export const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface SliceInventory {
  system: string;
  inventory: PressureInventoryDetail;
}

export interface NatalSliceInput {
  packs: Record<SelfFamilyAgentId, SelfFamilyPack>;
  ledger: PromiseLedger | undefined;
  /** the digest version the packs were read from */
  digestVersion: string;
}

export interface SliceSetInput {
  frame: YearFrameV3;
  /** one stored inventory per pulled clock (the year rides inside each) */
  inventories: readonly SliceInventory[];
  natal?: NatalSliceInput | null;
  /** the S9 year (year lagna and year lord keys), when known */
  year?: YearFrame | null;
}

export interface SliceWindow {
  from: string;
  to: string;
}

export const sliceWindow = (asOf: string): SliceWindow => ({ from: addMonthsIso(asOf, -SLICE_MONTHS_BACK), to: addMonthsIso(asOf, SLICE_MONTHS_AHEAD) });
const overlaps = (r: { from: string; to: string }, w: { from: string; to: string }): boolean => r.from < w.to && w.from < r.to;

function finish(id: string, text: string, keys: Iterable<string>, sources: SliceSource[]): RenderedSlice {
  const k = [...new Set(keys)].sort(cmp);
  const s = [...sources].sort((a, b) => cmp(a.dataType, b.dataType) || cmp(a.variant, b.variant) || cmp(a.hash, b.hash));
  return { id, text, keys: k, estTokens: estProviderTokens(text), sources: s, hash: shortHash(`${id}\n${text}\n${k.join(' ')}`) };
}

/** rows sorted by start, then kind, level and id: the one order every slice lists rows in */
export const byDate = (a: PressureRowDetail, b: PressureRowDetail): number =>
  cmp(a.from, b.from) || cmp(a.kind, b.kind) || (a.level ?? 0) - (b.level ?? 0) || cmp(a.id, b.id);

/** One row as every slice writes it. */
export function rowLine(book: KeyBook, r: PressureRowDetail): string {
  return [
    book.k(rowKey(r)),
    `kind=${r.kind}`,
    ...(r.level ? [`L${r.level}`] : []),
    ...(r.system ? [`system=${r.system}`] : []),
    `lord=${r.planet || 'n/a'}`,
    `${r.from}..${r.to}`,
    `polarity=${r.polarity}`,
    `strength=${r.strength}`,
    `houses=[${[...r.housesTouched].sort((a, b) => a - b).join(',')}]`,
    `matters=[${[...r.matters].sort(cmp).join(',')}]`,
    ...(r.houseFromMoon != null ? [`house_from_moon=${r.houseFromMoon}`] : []),
  ].join(' ');
}

const inventorySource = (inv: PressureInventoryDetail, system: string, rows: readonly PressureRowDetail[]): SliceSource => ({
  dataType: 'pressure_inventory',
  variant: `system=${system}`,
  calcVersion: inv.calcVersion || 'unknown',
  hash: shortHash(JSON.stringify(rows.map((r) => [r.id, r.kind, r.level ?? 0, r.planet, r.from, r.to, r.polarity, r.strength, r.housesTouched, r.matters]))),
});

/** inventories in system order, so the first-kept row of a duplicate never depends on the order they were passed in */
const ordered = (invs: readonly SliceInventory[]): SliceInventory[] => [...invs].sort((a, b) => cmp(a.system, b.system));

/**
 * The clock-independent rows of every inventory, stored once: de-duplicated by row id (the first inventory in system
 * order keeps it), inside the window, in date order. Each row is recomputed by every pull today (doc 70 §1 item 2), so
 * the same id appears in every inventory.
 */
export function sharedRows(invs: readonly SliceInventory[], kinds: readonly string[], w: SliceWindow): { rows: PressureRowDetail[]; sources: SliceSource[] } {
  const want = new Set(kinds);
  const seen = new Map<string, PressureRowDetail>();
  const sources: SliceSource[] = [];
  for (const { system, inventory } of ordered(invs)) {
    const mine = inventory.rows.filter((r) => want.has(r.kind) && overlaps(r, w)).sort(byDate);
    if (!mine.length) continue;
    sources.push(inventorySource(inventory, system, mine));
    for (const r of mine) if (!seen.has(r.id)) seen.set(r.id, r);
  }
  return { rows: [...seen.values()].sort(byDate), sources };
}

/** the period rows of one clock in its own inventory (rows without a system are the inventory's own clock) */
export function clockRows(inv: PressureInventoryDetail, system: string, w: SliceWindow): PressureRowDetail[] {
  return inv.rows
    .filter((r) => r.kind === 'dasha' && (r.system ? r.system.replace(/^dasha\./, '') === system : inv.clock === system) && (r.level ?? 1) <= 3 && overlaps(r, w))
    .sort(byDate);
}

// ---------------------------------------------------------------------------------------------------------------------
// The six slice kinds
// ---------------------------------------------------------------------------------------------------------------------

/** `natal.core`: the v2 natal packs (rasi, varga) and the promise ledger, rendered by the v2 code itself. */
export function renderNatalCore(n: NatalSliceInput): RenderedSlice {
  const pre = oraclePrefix(n.packs, n.ledger);
  return finish('natal.core', pre.text, pre.keys, [{ dataType: 'kundli_digest', variant: n.digestVersion, calcVersion: n.digestVersion, hash: shortHash(pre.text) }]);
}

/** `sky.window`: transits, Saturn's passage, stations and returns, once. */
export function renderSkyWindow(invs: readonly SliceInventory[], asOf: string): RenderedSlice {
  const w = sliceWindow(asOf);
  const { rows, sources } = sharedRows(invs, SKY_KINDS, w);
  const book = new KeyBook();
  const L = [`# SKY WINDOW (${rows.length} rows that do not depend on a period clock, ${w.from}..${w.to})`];
  for (const kind of SKY_KINDS) {
    const mine = rows.filter((r) => r.kind === kind);
    L.push(`## ${kind} (${mine.length})`);
    for (const r of mine) L.push(rowLine(book, r));
    if (!mine.length) L.push('(none stored)');
  }
  return finish('sky.window', L.join('\n'), book.keys, sources);
}

/** `year.tp`: the Tithi Pravesha year (year chart keys, the year rows and the year's sub-periods), once. */
export function renderYearTp(invs: readonly SliceInventory[], asOf: string, year: YearFrame | null = null): RenderedSlice {
  const w = sliceWindow(asOf);
  const { rows, sources } = sharedRows(invs, YEAR_KINDS, w);
  const book = new KeyBook();
  const L = [`# YEAR TP (the Tithi Pravesha year and its sub-periods, ${w.from}..${w.to})`];
  if (year && !year.noCoverage) {
    L.push(`year ${year.from}..${year.to} year lagna ${book.k(year.yearLagna) || 'not stored'} year lord ${book.k(year.yearLord) || 'not stored'}`);
  } else if (year?.noCoverage) L.push('no year chart covers today');
  for (const level of [1, 2, 3] as const) {
    const mine = rows.filter((r) => (r.level ?? 1) === level);
    if (!mine.length) continue;
    L.push(level === 1 ? `## the years (${mine.length})` : `## level ${level} year periods (${mine.length})`);
    for (const r of mine) L.push(rowLine(book, r));
  }
  if (!rows.length) L.push('(no year rows stored)');
  const src = year ? [...sources, { dataType: 'year_frame', variant: `${year.from}..${year.to}`, calcVersion: 'S9', hash: shortHash(`${year.yearLagna}|${year.yearLord}|${year.noCoverage}`) }] : sources;
  return finish('year.tp', L.join('\n'), book.keys, src);
}

/**
 * `frame`: the spans and their edges, and per span the clock-independent rows that overlap it (sky and year, by key).
 *
 * Decision: the frame slice is in every reader's cached prefix, so it carries no clock's tone and no period row. Doc 70
 * §4.1 lists "each clock's rows per span" under the frame; those go in each `clock.<system>` slice instead (its BY SPAN
 * index), so a clock reader never sees another clock's reading (doc 70 §9: "readers cannot copy each other").
 */
export function renderFrame(frame: YearFrameV3, invs: readonly SliceInventory[]): RenderedSlice {
  const w = { from: frame.spans[0]?.from ?? frame.asOf, to: frame.to };
  const shared = sharedRows(invs, [...SHARED_KINDS], w).rows;
  const book = new KeyBook();
  const L = [`# FRAME (today ${frame.asOf}; ${frame.spans.length} spans to ${frame.to}; every date you write is an edge below)`];
  for (const s of frame.spans) {
    const rows = shared.filter((r) => overlaps(r, s));
    L.push(`${s.id} ${s.from}..${s.to} place=${s.place}`);
    L.push(`  sky and year rows: ${rows.length ? rows.map((r) => book.k(rowKey(r))).join(' ') : 'none'}`);
  }
  if (!frame.spans.length) L.push('(no spans: the frame could not be cut)');
  const src: SliceSource = { dataType: 'year_frame', variant: `${frame.asOf}..${frame.to}`, calcVersion: frame.clock, hash: shortHash(JSON.stringify(frame.spans.map((s) => [s.id, s.from, s.to, s.place]))) };
  return finish('frame', L.join('\n'), book.keys, [src]);
}

/**
 * `clock.<system>`: that clock's periods, levels 1 to 3, a year back to eighteen months ahead, listed once; then the
 * keys by span and by house (the engine's `housesTouched`). For the Tithi Pravesha year the rows are the year rows.
 */
export function renderClock(system: string, inv: PressureInventoryDetail | null, frame: YearFrameV3, invs: readonly SliceInventory[] = []): RenderedSlice {
  const w = sliceWindow(frame.asOf);
  const isYear = system === TP_SYSTEM;
  const year = isYear ? sharedRows(invs, YEAR_KINDS, w) : null;
  const rows = isYear ? year!.rows : inv ? clockRows(inv, system, w) : [];
  const book = new KeyBook();
  const L = [`# CLOCK ${system} (${rows.length} ${isYear ? 'year rows; the same rows as YEAR TP' : 'periods, levels 1-3'}, ${w.from}..${w.to})`];
  L.push('## periods');
  for (const r of rows) L.push(rowLine(book, r));
  if (!rows.length) L.push('(none stored)');
  L.push('## by span (the rows of this clock overlapping each FRAME span)');
  for (const s of frame.spans) {
    const mine = rows.filter((r) => overlaps(r, s));
    L.push(`${s.id} ${s.from}..${s.to}: ${mine.length ? mine.map((r) => book.k(rowKey(r))).join(' ') : 'none'}`);
  }
  L.push('## by house (the houses each period touches)');
  for (let h = 1; h <= 12; h++) {
    const mine = rows.filter((r) => r.housesTouched.includes(h));
    if (mine.length) L.push(`h${h}: ${mine.map((r) => book.k(rowKey(r))).join(' ')}`);
  }
  const sources = isYear ? year!.sources : inv && rows.length ? [inventorySource(inv, system, rows)] : [];
  return finish(clockSliceId(system), L.join('\n'), book.keys, sources);
}

/** the matter keys the rows carry (the engine's own labels), sorted */
export function matterKeys(invs: readonly SliceInventory[], asOf: string): string[] {
  const w = sliceWindow(asOf);
  const keys = new Set<string>();
  for (const { inventory } of invs) for (const r of inventory.rows) if (overlaps(r, w)) for (const m of r.matters) keys.add(m);
  return [...keys].sort(cmp);
}

/** every row of every inventory inside the window, de-duplicated by id (first in system order kept) */
function allRows(invs: readonly SliceInventory[], w: SliceWindow): Array<{ system: string; row: PressureRowDetail }> {
  const seen = new Map<string, { system: string; row: PressureRowDetail }>();
  for (const { system, inventory } of ordered(invs)) {
    for (const r of inventory.rows) {
      if (!overlaps(r, w) || seen.has(r.id)) continue;
      if (r.kind === 'dasha' && (r.level ?? 1) > 3) continue;
      // a period row belongs to its own clock; a shared row to no clock
      const owner = r.kind === 'dasha' ? (r.system ? r.system.replace(/^dasha\./, '') : inventory.clock) : SHARED_KINDS.has(r.kind) ? (r.kind === 'annual' ? TP_SYSTEM : 'sky') : system;
      seen.set(r.id, { system: owner, row: r });
    }
  }
  return [...seen.values()].sort((a, b) => cmp(a.system, b.system) || byDate(a.row, b.row));
}

/** `matter.<key>`: the promise entries of that matter and every dated row (any clock, sky, year) whose matters include it. */
export function renderMatter(matter: string, invs: readonly SliceInventory[], asOf: string, ledger: PromiseLedger | undefined = undefined): RenderedSlice {
  const w = sliceWindow(asOf);
  const book = new KeyBook();
  const promise = (ledger?.entries ?? []).filter((e: PromiseEntry) => e.matter === matter).sort((a, b) => cmp(a.id, b.id));
  const rows = allRows(invs, w).filter((x) => x.row.matters.includes(matter as PressureRowDetail['matters'][number]));
  const L = [`# MATTER ${matter} (${promise.length} promise entries, ${rows.length} dated rows, ${w.from}..${w.to})`];
  L.push('## promise (natal)');
  for (const e of promise) L.push(`${book.k(promiseKey(e.id))} ${e.kind} strength=${e.strength}${e.source.house != null ? ` house=${e.source.house}` : ''}${e.source.planet ? ` planet=${e.source.planet}` : ''}`);
  if (!promise.length) L.push('(none)');
  let group = '';
  for (const { system, row } of rows) {
    if (system !== group) {
      group = system;
      L.push(`## ${system === 'sky' ? 'sky' : `clock ${system}`}`);
    }
    L.push(rowLine(book, row));
  }
  if (!rows.length) L.push('(no dated rows)');
  const used = new Set(rows.map((x) => x.row.id));
  const sources = ordered(invs)
    .map(({ system, inventory }) => ({ inventory, system, mine: inventory.rows.filter((r) => used.has(r.id)).sort(byDate) }))
    .filter((x) => x.mine.length)
    .map((x) => inventorySource(x.inventory, x.system, x.mine));
  if (promise.length) sources.push({ dataType: 'kundli_digest', variant: 'promise_ledger', calcVersion: 'S4', hash: shortHash(promise.map((e) => e.id).join(',')) });
  return finish(matterSliceId(matter), L.join('\n'), book.keys, sources);
}

/**
 * The whole slice set, in a fixed order: the four shared slices, a `clock.<system>` per inventory plus the year, then a
 * `matter.<key>` per engine matter key in the rows. `natal.core` only when the natal packs are given.
 */
export function renderSliceSet(i: SliceSetInput): RenderedSlice[] {
  const asOf = i.frame.asOf;
  const invs = ordered(i.inventories);
  const out: RenderedSlice[] = [];
  if (i.natal) out.push(renderNatalCore(i.natal));
  out.push(renderSkyWindow(invs, asOf), renderYearTp(invs, asOf, i.year ?? null), renderFrame(i.frame, invs));
  const systems = [...new Set(invs.map((x) => x.system))].filter((s) => s !== TP_SYSTEM);
  for (const s of systems) out.push(renderClock(s, invs.find((x) => x.system === s)!.inventory, i.frame, invs));
  if (invs.length) out.push(renderClock(TP_SYSTEM, null, i.frame, invs));
  for (const m of matterKeys(invs, asOf)) out.push(renderMatter(m, invs, asOf, i.natal?.ledger));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading a slice back: the row lines this module wrote (validators check cited keys against them, never raw rows)
// ---------------------------------------------------------------------------------------------------------------------

export interface SliceRowRef {
  key: string;
  from: string;
  to: string;
  polarity: PressureRowDetail['polarity'];
  strength: number;
  matters: string[];
}

const ROW_LINE = /^\{(pressure:[^}]+)\}\s(.*)$/;

/** The row lines of a rendered slice (the format of `rowLine`), by key, first line kept. */
export function parseRowLines(text: string): Map<string, SliceRowRef> {
  const out = new Map<string, SliceRowRef>();
  for (const line of text.split('\n')) {
    const m = ROW_LINE.exec(line);
    if (!m || out.has(m[1]!)) continue;
    const rest = m[2]!;
    const d = /(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/.exec(rest);
    const pol = /\bpolarity=(presses|mixed|supports)\b/.exec(rest);
    const st = /\bstrength=(\d)\b/.exec(rest);
    const mt = /\bmatters=\[([^\]]*)\]/.exec(rest);
    if (!d || !pol) continue;
    out.set(m[1]!, {
      key: m[1]!,
      from: d[1]!,
      to: d[2]!,
      polarity: pol[1] as SliceRowRef['polarity'],
      strength: st ? Number(st[1]) : 0,
      matters: mt && mt[1] ? mt[1].split(',').filter(Boolean) : [],
    });
  }
  return out;
}
