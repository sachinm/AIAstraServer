/**
 * The manifest (docs/techniques/11 rev 4 §4.2): everything a chart must have and what needs it, built in code from the
 * engine catalogue (`chart_data_types`, through the registration plan) and the stored rows, and checked against them.
 *
 * Today the code calls a chart complete when every row is *settled*, and a failed, given-up or unsupported row counts as
 * settled, so nothing lists what is missing. Here each row is an item with a state, and what a ready row should contain
 * is checked too, from the activation calendar the digest built from the engine's own dasha rows:
 *
 *   - every natal and annual type of the registration set (the gate types are what chat needs; the rest pass 1)
 *   - `dasha.applicable`, and for every dasha system the engine says applies: periods stored, levels 1 to 3, a running
 *     maha dasha with sub-periods, the next maha dasha with sub-periods
 *   - the clock set's dated rows (`pressure_inventory`)
 *   - this and last year's yearly rows; level-4 rows (asked for, never waited for: "filling")
 *   - the digest
 *
 * PURE: no database. Selection and dating only: applicability is the engine's verdict (`dasha.applicable`), every date is
 * one the engine stored; nothing here grades or derives astrology. No engine name is written into any field.
 */
import { parseFailureMark } from '../chartData/store.js';
import type { ChartDataType } from '../chartData/catalog.js';
import type { ApplicabilityRow } from '../self/clock.js';
import { isEngineRefusal, PIPELINE_GIVE_UP_FAILURES } from './retry.js';

/** A failed row is given up and named after this many failures in a row (doc 11 §4.2 retry; the schedule is retry.ts). */
export { PIPELINE_GIVE_UP_FAILURES };

export type ItemNeed = 'chat' | 'pass1';
export type ItemKind = 'row' | 'applicable' | 'dasha' | 'clock' | 'annual_year' | 'level4' | 'digest';
/**
 * ok: present and as it should be · missing / fetching: not pulled yet · waiting: cannot be checked before the digest ·
 * retrying: failed, will be asked again · gap: given up, unsupported, or a ready row with a hole in it · filling: optional
 * and still arriving (never waited for)
 */
export type ItemState = 'ok' | 'missing' | 'fetching' | 'waiting' | 'retrying' | 'gap' | 'filling';

export type GapCode =
  | 'failed'
  | 'unsupported'
  | 'no_periods'
  | 'level_1_only'
  | 'no_level_3'
  | 'no_running_period'
  | 'no_sub_periods_running'
  | 'no_next_period'
  | 'no_sub_periods_next'
  | 'clock_failed'
  | 'digest_failed';

export interface ManifestItem {
  /** the type id (`varga.d9`), `<type>@<variant>` for a yearly or clock row, `dasha:<system>`, `digest`, `dasha.level4` */
  id: string;
  kind: ItemKind;
  need: ItemNeed;
  required: boolean;
  state: ItemState;
  code?: GapCode;
  /** plain detail for staff (dates, levels, failure count); never an engine message */
  detail?: string;
  failures?: number;
}

export interface Gap {
  id: string;
  kind: ItemKind;
  code: GapCode;
  required: boolean;
  /** false while the row is still being asked again */
  givenUp: boolean;
  detail?: string;
}

/** One stored `kundli_data` row as the manifest reads it (status columns; `error` only for failed rows). */
export interface StoredStatusRow {
  dataType: string;
  variant: string;
  status: string;
  calcVersion: string | null;
  error: string | null;
  fetchStartedAt: Date | null;
  fetchedAt: Date | null;
  validTo: Date | null;
}

/** One activation period (levels 1 and 2 carry the dates the checks need). */
export interface ActivationSpan {
  system: string;
  level: number;
  from: string;
  to: string;
}

export interface ManifestInput {
  now: Date;
  /** the registration plan's types: `requested` in order, `gate` the leading part chat needs */
  requested: readonly ChartDataType[];
  gate: readonly ChartDataType[];
  rows: readonly StoredStatusRow[];
  /** the engine's `dasha.applicable` verdicts; null when the row is not stored */
  applicability: readonly ApplicabilityRow[] | null;
  /** the digest's status (`kundlis.digest_status`); the dasha checks need its activation rows */
  digestStatus: string | null;
  /** levels 1–2 of every system (the dates) */
  spans: readonly ActivationSpan[];
  /** the levels stored per system (any level, 1–6) */
  levels: ReadonlyMap<string, ReadonlySet<number>>;
  /** the clocks of the reading clock set the sync pulls (`ReadingClockSet.pulled`); null when not known */
  clockSet: readonly string[] | null;
  /** the yearly keys of this and last year: `{ dataType, variant }` */
  annualYearKeys: ReadonlyArray<{ dataType: string; variant: string }>;
  /** stored dasha systems whose periods are required everywhere (getPipelineRequiredDashas) */
  requiredDashas: readonly string[];
  /** years after today the activation calendar runs to (ACTIVATION_YEARS_AHEAD) */
  yearsAhead?: number;
}

const FETCH_LEASE_MS = 90_000;
const CURRENT = 'current';
const PRESSURE = 'pressure_inventory';
/** Rows that are required whatever the catalogue tier: the engine's verdict, the year chart (doc 11 §4.2) */
const ALWAYS_REQUIRED = new Set(['dasha.applicable', 'annual.tithi_pravesha', 'varga.d1', 'varga.d9']);

/** The dasha system a stored type id names (`dasha.<name>` or `dasha.<name>.l3`), or null. */
export function dashaSystemOfType(id: string): string | null {
  const m = /^dasha\.([a-z_]+?)(\.l3)?$/.exec(id);
  return m && m[1] !== 'applicable' && m[1] !== 'deep' ? m[1]! : null;
}

/** How many times the row failed in a row (the store's `[failures=n …]` mark; an unmarked failure counts once). */
export function failuresOf(row: Pick<StoredStatusRow, 'status' | 'error'>): number {
  if (row.status !== 'failed') return 0;
  return parseFailureMark(row.error)?.failures ?? 1;
}

/** Given up: the store's give-up mark (`valid_to` in the future on a failed row) or PIPELINE_GIVE_UP_FAILURES failures. */
export function givenUp(row: Pick<StoredStatusRow, 'status' | 'error' | 'validTo'>, now: Date): boolean {
  if (row.status !== 'failed') return false;
  // a give-up mark decides while it is set: a clock row's expires (retry.ts), and it is then being retried again
  if (row.validTo) return row.validTo.getTime() > now.getTime();
  return failuresOf(row) >= PIPELINE_GIVE_UP_FAILURES;
}

/** The state of one stored row (or its absence). */
export function rowState(row: StoredStatusRow | undefined, now: Date): Pick<ManifestItem, 'state' | 'code' | 'failures' | 'detail'> {
  if (!row) return { state: 'missing' };
  switch (row.status) {
    case 'ready':
      return { state: 'ok' };
    case 'fetching':
      return row.fetchStartedAt && now.getTime() - row.fetchStartedAt.getTime() <= FETCH_LEASE_MS ? { state: 'fetching' } : { state: 'missing' };
    case 'failed': {
      // the engine refuses this type for this input (retry.ts): never retried, named as unsupported
      if (isEngineRefusal(parseFailureMark(row.error)?.message ?? row.error)) return { state: 'gap', code: 'unsupported', detail: 'the engine does not serve this for the chart' };
      const failures = failuresOf(row);
      const up = givenUp(row, now);
      return { state: up ? 'gap' : 'retrying', code: 'failed', failures, detail: `${failures} failure${failures === 1 ? '' : 's'}${up ? ', given up' : ''}` };
    }
    case 'unsupported':
      return { state: 'gap', code: 'unsupported' };
    default:
      // dispatched | queued | deferred_disk: a slot marker, not data
      return { state: 'missing' };
  }
}

/** True when the engine's verdict says the system applies: not named (an unconditional system) or named with `applies: true`. */
export function systemApplies(system: string, applicability: readonly ApplicabilityRow[]): boolean {
  const r = applicability.find((a) => a.system === system || a.names.includes(system));
  return !r || r.applies === true;
}

const addYears = (iso: string, years: number) => `${String(Number(iso.slice(0, 4)) + years).padStart(4, '0')}${iso.slice(4)}`;

/**
 * The holes in one system's stored periods. Selection by date only: the running period is the level-1 row whose dates
 * hold today; the next is the first level-1 row starting at or after the running one's end.
 */
export function dashaHoles(system: string, spans: readonly ActivationSpan[], levels: ReadonlySet<number> | undefined, today: string, horizon: string): Array<{ code: GapCode; detail: string }> {
  const lv = levels ?? new Set<number>();
  const l1 = spans.filter((s) => s.system === system && s.level === 1).sort((a, b) => a.from.localeCompare(b.from));
  const l2 = spans.filter((s) => s.system === system && s.level === 2);
  if (!l1.length) return [{ code: 'no_periods', detail: 'no periods stored' }];
  const out: Array<{ code: GapCode; detail: string }> = [];
  if (!lv.has(2)) out.push({ code: 'level_1_only', detail: 'level 1 only: no sub-periods stored' });
  else if (!lv.has(3)) out.push({ code: 'no_level_3', detail: 'levels 1 and 2 only' });
  const running = l1.find((p) => p.from <= today && today < p.to);
  if (!running) {
    const before = [...l1].reverse().find((p) => p.to <= today);
    const after = l1.find((p) => p.from > today);
    const detail = before && after ? `no period from ${before.to} to ${after.from}` : after ? `periods start ${after.from}` : `periods end ${l1[l1.length - 1]!.to}`;
    out.push({ code: 'no_running_period', detail });
    return out;
  }
  const overlaps = (s: ActivationSpan, p: ActivationSpan) => s.from < p.to && s.to > p.from;
  if (lv.has(2) && !l2.some((s) => overlaps(s, running))) out.push({ code: 'no_sub_periods_running', detail: `running ${running.from} to ${running.to}` });
  const next = l1.find((p) => p.from >= running.to);
  if (!next) {
    if (running.to < horizon) out.push({ code: 'no_next_period', detail: `nothing stored after ${running.to}` });
  } else if (lv.has(2) && !l2.some((s) => overlaps(s, next))) out.push({ code: 'no_sub_periods_next', detail: `next ${next.from} to ${next.to}` });
  return out;
}

const keyOf = (dataType: string, variant: string) => `${dataType}|${variant}`;

/** Every item of the manifest with its state. */
export function buildManifest(i: ManifestInput): ManifestItem[] {
  const now = i.now;
  const today = now.toISOString().slice(0, 10);
  const horizon = addYears(today, i.yearsAhead ?? 30);
  const byKey = new Map(i.rows.map((r) => [keyOf(r.dataType, r.variant), r]));
  const gateIds = new Set(i.gate.map((t) => t.id));
  const requiredDashas = new Set(i.requiredDashas);
  const items: ManifestItem[] = [];

  // 1. the registration set: natal rows ('' variant) and the annual `current` pointers
  for (const t of i.requested) {
    const variant = t.variantKind === 'year' ? CURRENT : '';
    const sys = dashaSystemOfType(t.id);
    const required = gateIds.has(t.id) || ALWAYS_REQUIRED.has(t.id) || (sys != null && requiredDashas.has(sys));
    items.push({ id: t.id, kind: t.id === 'dasha.applicable' ? 'applicable' : 'row', need: gateIds.has(t.id) ? 'chat' : 'pass1', required, ...rowState(byKey.get(keyOf(t.id, variant)), now) });
  }

  // 2. the content of every stored dasha system the engine says applies (needs the digest's activation calendar)
  const digestUsable = i.digestStatus === 'ready' || i.digestStatus === 'stale';
  if (i.applicability) {
    const systems = new Set<string>();
    for (const r of i.rows) {
      const s = r.status === 'ready' && r.variant === '' ? dashaSystemOfType(r.dataType) : null;
      if (s) systems.add(s);
    }
    for (const system of [...systems].sort()) {
      if (!systemApplies(system, i.applicability)) continue;
      const required = requiredDashas.has(system);
      const id = `dasha:${system}`;
      if (!digestUsable) {
        items.push({ id, kind: 'dasha', need: 'pass1', required, state: 'waiting' });
        continue;
      }
      const holes = dashaHoles(system, i.spans, i.levels.get(system), today, horizon);
      if (!holes.length) items.push({ id, kind: 'dasha', need: 'pass1', required, state: 'ok' });
      for (const h of holes) items.push({ id, kind: 'dasha', need: 'pass1', required, state: 'gap', code: h.code, detail: h.detail });
    }
  }

  // 3. the clock set's dated rows: every stored one (a failed clock outside today's set is still named), and every clock
  // of the set not yet pulled (filling)
  const clockRows = i.rows.filter((r) => r.dataType === PRESSURE);
  const seen = new Set<string>();
  for (const r of clockRows) {
    const system = r.variant.replace(/^system=/, '');
    seen.add(system);
    const s = rowState(r, now);
    items.push({ id: `${PRESSURE}@${r.variant}`, kind: 'clock', need: 'pass1', required: false, ...s, ...(s.code === 'failed' ? { code: 'clock_failed' as const } : {}) });
  }
  for (const system of i.clockSet ?? []) {
    if (!seen.has(system)) items.push({ id: `${PRESSURE}@system=${system}`, kind: 'clock', need: 'pass1', required: false, state: 'filling' });
  }

  // 4. this and last year's yearly rows (pulled with the registration run; optional: still arriving is "filling")
  for (const k of i.annualYearKeys) {
    const s = rowState(byKey.get(keyOf(k.dataType, k.variant)), now);
    items.push({ id: `${k.dataType}@${k.variant}`, kind: 'annual_year', need: 'pass1', required: false, ...s, ...(s.state === 'missing' || s.state === 'fetching' ? { state: 'filling' as const } : {}) });
  }

  // 5. level 4: asked for, never waited for (open point G)
  if (digestUsable) {
    const any4 = [...i.levels.values()].some((l) => l.has(4));
    items.push({ id: 'dasha.level4', kind: 'level4', need: 'pass1', required: false, state: any4 ? 'ok' : 'filling' });
  }

  // 6. the digest every reading is cut from
  const d = i.digestStatus;
  items.push({
    id: 'digest',
    kind: 'digest',
    need: 'pass1',
    required: true,
    // stale: a built digest that new engine rows have overtaken; it is still read, and the sweep rebuilds it
    ...(d === 'ready' ? { state: 'ok' as const } : d === 'stale' ? { state: 'ok' as const, detail: 'stale, rebuilding' } : d === 'failed' ? { state: 'retrying' as const, code: 'digest_failed' as const } : { state: 'waiting' as const }),
  });
  return items;
}

export type Verdict = 'complete' | 'complete_with_gaps' | 'incomplete';

const NAMED: ReadonlySet<ItemState> = new Set(['gap', 'retrying']);

/**
 * The verdict of one need: incomplete when a required item is not ok (missing, being retried, a hole); complete with
 * named gaps when an optional item failed, is unsupported or has a hole; complete otherwise. Optional items still
 * arriving ("filling") do not count.
 */
export function verdictOf(items: readonly ManifestItem[], need?: ItemNeed): Verdict {
  const mine = need ? items.filter((x) => x.need === need) : items;
  if (mine.some((x) => x.required && x.state !== 'ok')) return 'incomplete';
  return mine.some((x) => NAMED.has(x.state)) ? 'complete_with_gaps' : 'complete';
}

/** The named gaps: every failed, unsupported or holed item, required ones first. */
export function gapsOf(items: readonly ManifestItem[]): Gap[] {
  return items
    .filter((x) => NAMED.has(x.state) && x.code)
    .map((x) => ({ id: x.id, kind: x.kind, code: x.code!, required: x.required, givenUp: x.state === 'gap', ...(x.detail ? { detail: x.detail } : {}) }))
    .sort((a, b) => Number(b.required) - Number(a.required));
}
