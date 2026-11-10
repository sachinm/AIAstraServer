/**
 * Layer 0 of the Self v2 build: the engine's `pressure_inventory` export (AIAstra_Radha docs/pressure-inventory.md,
 * docs/reading-engine/66 §4.3), pulled through the shared export client, stored in `kundli_data` (data_type
 * `pressure_inventory`, variant `system=<clock>`: one row per kundli and clock, payload = the engine JSON as given), and
 * mapped from snake_case to `PressureInventory` in one place (`toPressureInventory`).
 *
 * Refresh: a stored row older than SELF_V2_PRESSURE_MAX_AGE_DAYS (7) is pulled again; a clock switch reads another
 * variant, so the new clock pulls its own. A failed or refused pull (the engine is not deployed yet: HTTP 400 unknown type)
 * never fails the build: the loader returns null with a gap, keeps any older stored payload, and waits
 * SELF_V2_PRESSURE_RETRY_HOURS before trying again. Every judgement in the rows (houses, matters, polarity, strength) is
 * the engine's; nothing here computes astrology. Rahu and Ketu always press in the engine's table: kept as given.
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import {
  getSelfV2PressureMaxAgeDays,
  getSelfV2PressureRetryHours,
  getSelfV2PressureTimeoutMs,
  isSelfV2PressurePullEnabled,
} from '../../../config/env.js';
import { fetchEngineExport, RadhaHttpError } from '../../../lib/astroKundliClient.js';
import { CHART_TYPE_BY_ID } from '../../chartData/catalog.js';
import type { KundliRequest, RadhaFetcher } from '../../chartData/store.js';
import type { Matter, Polarity, PressureBoundary, PressureInventory, PressureKind, PressureRow, Strength } from '../v2types.js';
import { parseApplicability, resolveClockV2, resolveReadingClocks, type ReadingClockSet } from '../clock.js';

export const PRESSURE_TYPE = 'pressure_inventory';
export const PRESSURE_AYANAMSA = 'LAHIRI';
/** the request the Self board makes (doc 66 §4.3: −3 y … +3 y around today, three dasha levels) */
export const PRESSURE_YEARS_BACK = 3;
export const PRESSURE_YEARS_AHEAD = 3;
export const PRESSURE_LEVELS = 3;

export const pressureVariant = (system: string): string => `system=${system}`;

// ---------------------------------------------------------------------------------------------------------------------
// The engine's payload (snake_case, as served)
// ---------------------------------------------------------------------------------------------------------------------

export interface EnginePressureRow {
  id: string;
  kind: string;
  level?: number;
  planet: string;
  system?: string;
  houses_touched: number[];
  matters: string[];
  polarity: string;
  strength: number;
  from: string;
  to: string;
  since_days?: number;
  remaining_days?: number;
  evidence: string[];
  /** transit and station rows */
  house_from_moon?: number;
  /** dasha and annual rows: the engine's flags behind the polarity (functional_malefic, in_dusthana, …) */
  reasons?: string[];
  [extra: string]: unknown;
}

export interface EnginePressurePayload {
  calc_version: string;
  system: string;
  as_of: string;
  from: string;
  to: string;
  levels: number;
  lagna_sign_index?: number;
  moon_sign_index?: number;
  applicability?: unknown;
  rows: EnginePressureRow[];
  boundaries: Array<{ date: string; starts: string[]; ends: string[] }>;
  rules?: unknown;
}

/**
 * a mapped row with the transit extra S7 joins on (the Moon's house as the engine stated it) and the engine's stored
 * `reasons` flags (null when the payload carried none); the tone stopgap (`rowTone.ts`) counts them
 */
export type PressureRowDetail = PressureRow & { houseFromMoon: number | null; reasons?: string[] | null };
export type PressureInventoryDetail = Omit<PressureInventory, 'rows'> & { asOf: string; rows: PressureRowDetail[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `annual` and `return` arrive with engine calc_version 2 (the TP year window and its year periods; Saturn/Jupiter returns) */
const KINDS: readonly PressureKind[] = ['dasha', 'transit', 'sade_sati', 'return', 'station', 'annual'];
const POLARITIES: readonly Polarity[] = ['presses', 'mixed', 'supports'];
const MATTERS: readonly Matter[] = [
  'self_and_body',
  'money_in_hand',
  'effort_and_courage',
  'home_and_peace',
  'ideas_and_children',
  'work_load_and_health',
  'partnership',
  'sudden_and_hidden',
  'luck_and_belief',
  'career_and_standing',
  'gains_and_network',
  'loss_rest_and_distance',
];

/** Outline check of the engine's answer; null when it is not a pressure_inventory payload. */
export function asPressurePayload(raw: unknown): EnginePressurePayload | null {
  const p = (raw && typeof raw === 'object' && 'data' in (raw as object) && !('rows' in (raw as object)) ? (raw as { data: unknown }).data : raw) as Partial<EnginePressurePayload> | null;
  if (!p || typeof p !== 'object') return null;
  if (typeof p.system !== 'string' || typeof p.from !== 'string' || typeof p.to !== 'string' || !Array.isArray(p.rows) || !Array.isArray(p.boundaries)) return null;
  return p as EnginePressurePayload;
}

/**
 * The one mapper from the engine's snake_case payload to `PressureInventory`. A row with an unknown kind or polarity, a
 * strength outside 1..3 or a bad date is dropped (reported in `dropped`); an unknown matter label is dropped from the
 * row. Values are carried as the engine gave them; nothing is recomputed.
 */
export function toPressureInventory(payload: EnginePressurePayload, kundliId: string): { inventory: PressureInventoryDetail; dropped: string[] } {
  const dropped: string[] = [];
  const rows: PressureRowDetail[] = [];
  for (const r of payload.rows) {
    const kind = r?.kind as PressureKind;
    const polarity = r?.polarity as Polarity;
    const strength = Number(r?.strength) as Strength;
    if (!r || typeof r.id !== 'string' || !KINDS.includes(kind) || !POLARITIES.includes(polarity) || ![1, 2, 3].includes(strength) || !DATE.test(String(r.from)) || !DATE.test(String(r.to))) {
      dropped.push(String(r?.id ?? '?'));
      continue;
    }
    const level = r.level === 1 || r.level === 2 || r.level === 3 ? r.level : undefined;
    rows.push({
      id: r.id,
      kind,
      ...((kind === 'dasha' || kind === 'annual') && level ? { level } : {}),
      planet: String(r.planet ?? ''),
      ...(typeof r.system === 'string' ? { system: r.system } : {}),
      housesTouched: Array.isArray(r.houses_touched) ? r.houses_touched.filter((h) => Number.isInteger(h) && h >= 1 && h <= 12) : [],
      matters: (Array.isArray(r.matters) ? r.matters : []).filter((m): m is Matter => MATTERS.includes(m as Matter)),
      polarity,
      strength,
      from: r.from,
      to: r.to,
      evidence: Array.isArray(r.evidence) ? r.evidence.filter((e) => typeof e === 'string') : [r.id],
      houseFromMoon: Number.isInteger(r.house_from_moon) ? (r.house_from_moon as number) : null,
      reasons: Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === 'string') : null,
    });
  }
  const boundaries: PressureBoundary[] = payload.boundaries
    .filter((b) => b && DATE.test(String(b.date)))
    .map((b) => ({ date: b.date, starts: Array.isArray(b.starts) ? [...b.starts] : [], ends: Array.isArray(b.ends) ? [...b.ends] : [] }));
  return {
    inventory: { kundliId, clock: payload.system.replace(/^dasha\./, ''), asOf: payload.as_of, from: payload.from, to: payload.to, rows, boundaries, calcVersion: String(payload.calc_version ?? '') },
    dropped,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Pull, store, load
// ---------------------------------------------------------------------------------------------------------------------

export interface PressureDeps {
  /** the kundli's birth request (default: the chart-data repo's, which fills stored coordinates) */
  kundliRequest?: (kundliId: string) => Promise<KundliRequest | null>;
  /** the engine call (default: the throttled export client); tests replace it */
  fetcher?: RadhaFetcher;
  now?: () => Date;
}

export interface PressureLoad {
  inventory: PressureInventoryDetail | null;
  source: 'stored' | 'pulled' | 'stale' | 'none';
  /** staff-only reasons (no row, pull failed, dropped rows) */
  gaps: string[];
}

type KundliDataRow = {
  status: string;
  payload: unknown;
  error?: string | null;
  fetched_at?: Date | string | null;
  fetch_started_at?: Date | string | null;
};

type PressurePrisma = {
  kundliData?: {
    findUnique?: (q: { where: { kundli_data_key: { kundli_id: string; data_type: string; variant: string; ayanamsa: string } } }) => Promise<KundliDataRow | null>;
    upsert?: (q: { where: { kundli_data_key: { kundli_id: string; data_type: string; variant: string; ayanamsa: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  };
  chartDataType?: { upsert?: (q: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> };
};

const ms = (d: Date | string | null | undefined): number => (d ? (d instanceof Date ? d : new Date(d)).getTime() : 0);
const DAY = 86_400_000;
const HOUR = 3_600_000;

export function pressureParams(asOf: string, system: string): Record<string, unknown> {
  return { as_of: asOf, years_back: PRESSURE_YEARS_BACK, years_ahead: PRESSURE_YEARS_AHEAD, system, levels: PRESSURE_LEVELS };
}

async function defaultKundliRequest(prisma: PrismaClient, kundliId: string): Promise<KundliRequest | null> {
  const { prismaChartDataRepo } = await import('../../chartData/store.js');
  return prismaChartDataRepo(prisma).kundliRequest(kundliId);
}

const defaultFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, { ...(req.coords ?? {}), ...extra });

/** The `chart_data_types` row the `kundli_data.data_type` foreign key needs; created once when missing (no migration). */
async function ensureTypeRow(p: PressurePrisma): Promise<void> {
  const t = CHART_TYPE_BY_ID.get(PRESSURE_TYPE);
  if (!t || !p.chartDataType?.upsert) return;
  await p.chartDataType.upsert({
    where: { id: t.id },
    create: { id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: false, calc_version: null, legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true },
    update: {},
  });
}

/**
 * True when a failed pull is the engine's own answer (it ran and said no: an HTTP error status other than an auth or
 * throttle status, a validation error, a payload of the wrong shape). Anything else failed on the caller's side
 * (credentials, network, a timeout, a missing birth request): such a failure is not stored, so it never blocks the next
 * pull for SELF_V2_PRESSURE_RETRY_HOURS (docs/TODOS.md, doc 70: a laptop without credentials blocked three clocks 24 h).
 */
export function isEngineAnswer(e: unknown): boolean {
  if (e instanceof RadhaHttpError) return ![401, 403, 407, 408, 429].includes(e.status);
  const msg = String((e as Error)?.message ?? e);
  return /not a pressure_inventory payload|validation_error|(invalid|unknown) (export )?type|(Radha|HTTP) ?[45]\d\d/i.test(msg) && !/(Radha|HTTP) ?(401|403|407|408|429)/i.test(msg);
}

function withTimeout<T>(p: Promise<T>, limitMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`pressure_inventory pull timed out after ${limitMs} ms`)), limitMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * The kundli's pressure inventory on one clock for the build. Reads the stored row; pulls when none is stored, when the
 * stored one is older than the max age, and when the last failed attempt is older than the retry wait. Never throws.
 */
export async function loadPressureInventory(prisma: PrismaClient, kundliId: string, system: string, asOf: string, deps: PressureDeps = {}): Promise<PressureLoad> {
  const p = prisma as unknown as PressurePrisma;
  const gaps: string[] = [];
  const now = (deps.now ?? (() => new Date()))();
  const where = { kundli_data_key: { kundli_id: kundliId, data_type: PRESSURE_TYPE, variant: pressureVariant(system), ayanamsa: PRESSURE_AYANAMSA } };
  if (!p.kundliData?.findUnique) {
    gaps.push('pressure_inventory: no kundli_data store in this context; not pulled');
    return { inventory: null, source: 'none', gaps };
  }
  let row: KundliDataRow | null = null;
  try {
    row = (await p.kundliData?.findUnique?.({ where })) ?? null;
  } catch (e) {
    gaps.push(`pressure_inventory: stored row not read (${(e as Error).message?.slice(0, 120)})`);
  }
  const storedPayload = row?.payload ? asPressurePayload(row.payload) : null;
  const mapStored = (source: PressureLoad['source']): PressureLoad => {
    if (!storedPayload) return { inventory: null, source: 'none', gaps };
    const m = toPressureInventory(storedPayload, kundliId);
    if (m.dropped.length) gaps.push(`pressure_inventory: ${m.dropped.length} engine rows dropped (unreadable): ${m.dropped.slice(0, 5).join(', ')}`);
    return { inventory: m.inventory, source, gaps };
  };

  const fresh = storedPayload && row?.status === 'ready' && now.getTime() - ms(row.fetched_at) < getSelfV2PressureMaxAgeDays() * DAY;
  if (fresh) return mapStored('stored');
  if (!isSelfV2PressurePullEnabled()) {
    gaps.push('pressure_inventory: pull off (SELF_V2_PRESSURE_PULL=0)');
    return storedPayload ? mapStored('stale') : { inventory: null, source: 'none', gaps };
  }
  // a recent failed attempt (the engine refused or was down): wait before asking again
  const lastAttempt = ms(row?.fetch_started_at);
  if (row && row.error && lastAttempt && now.getTime() - lastAttempt < getSelfV2PressureRetryHours() * HOUR) {
    gaps.push(`pressure_inventory: last pull failed (${String(row.error).slice(0, 120)}); next try after ${getSelfV2PressureRetryHours()} h`);
    return storedPayload ? mapStored('stale') : { inventory: null, source: 'none', gaps };
  }

  try {
    const req = await (deps.kundliRequest ?? ((id: string) => defaultKundliRequest(prisma, id)))(kundliId);
    if (!req) throw new Error('kundli or birth details not found');
    const params = pressureParams(asOf, system);
    const raw = await withTimeout(Promise.resolve((deps.fetcher ?? defaultFetcher)(req, PRESSURE_TYPE, { params })), getSelfV2PressureTimeoutMs());
    const payload = asPressurePayload(raw);
    if (!payload) throw new Error('engine response is not a pressure_inventory payload');
    await ensureTypeRow(p).catch(() => undefined);
    const data = {
      status: 'ready',
      params: params as Prisma.InputJsonValue,
      calc_version: String(payload.calc_version ?? ''),
      payload: payload as unknown as Prisma.InputJsonValue,
      error: null,
      fetch_started_at: now,
      fetched_at: now,
    };
    await p.kundliData?.upsert?.({ where, create: { kundli_id: kundliId, data_type: PRESSURE_TYPE, variant: pressureVariant(system), ayanamsa: PRESSURE_AYANAMSA, ...data }, update: data }).catch((e: Error) => {
      gaps.push(`pressure_inventory: pulled but not stored (${e.message?.slice(0, 120)})`);
    });
    const m = toPressureInventory(payload, kundliId);
    if (m.dropped.length) gaps.push(`pressure_inventory: ${m.dropped.length} engine rows dropped (unreadable): ${m.dropped.slice(0, 5).join(', ')}`);
    return { inventory: m.inventory, source: 'pulled', gaps };
  } catch (e) {
    const error = String((e as Error).message ?? e).slice(0, 300);
    if (!isEngineAnswer(e)) {
      // failed on the caller's side: nothing is stored, the next build or sync asks again
      gaps.push(`pressure_inventory: pull failed on the caller's side, not stored (${error.slice(0, 120)})`);
      return storedPayload ? mapStored('stale') : { inventory: null, source: 'none', gaps };
    }
    gaps.push(`pressure_inventory: pull failed (${error.slice(0, 120)})`);
    // the engine's own refusal: remember the attempt; an older payload is kept as it is
    await ensureTypeRow(p)
      .then(() =>
        p.kundliData?.upsert?.({
          where,
          create: { kundli_id: kundliId, data_type: PRESSURE_TYPE, variant: pressureVariant(system), ayanamsa: PRESSURE_AYANAMSA, status: 'failed', error, fetch_started_at: now, fetched_at: now },
          update: storedPayload ? { error, fetch_started_at: now } : { status: 'failed', error, fetch_started_at: now, fetched_at: now },
        }),
      )
      .catch(() => undefined);
    return storedPayload ? mapStored('stale') : { inventory: null, source: 'none', gaps };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The clock set's inventories (docs/reading-engine/70 §4.1 layer 0): pulled away from the build, at sync
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The kundli's reading clock set from what is stored: the systems with periods (`kundli_activation`), the engine's
 * `dasha.applicable` verdicts and the stored clock preference. `spine` given (a build knows its clock) skips the
 * preference read. Selection only. Throws on a failed read (callers catch).
 */
export async function loadReadingClockSet(prisma: PrismaClient, kundliId: string, spine?: string): Promise<ReadingClockSet> {
  const { defaultSystemsPresent } = await import('../service.js');
  const appRead = (prisma as unknown as { kundliData: { findFirst: (q: unknown) => Promise<{ payload: unknown } | null> } }).kundliData.findFirst({
    where: { kundli_id: kundliId, data_type: 'dasha.applicable' },
    select: { payload: true },
  });
  const prefRead = spine
    ? Promise.resolve(null)
    : (prisma as unknown as { kundli: { findUnique: (q: unknown) => Promise<{ preferred_dasha: string | null } | null> } }).kundli.findUnique({
        where: { id: kundliId },
        select: { preferred_dasha: true },
      });
  const [present, appRow, pref] = await Promise.all([defaultSystemsPresent(prisma, kundliId), appRead, prefRead]);
  const applicability = appRow?.payload !== undefined && appRow?.payload !== null ? parseApplicability(appRow.payload) : null;
  const s = spine ?? resolveClockV2(pref?.preferred_dasha ?? null, present, applicability).primary;
  return resolveReadingClocks(s, present, applicability);
}

export interface EnsureInventoriesResult {
  set: ReadingClockSet | null;
  clocks: Array<{ system: string; source: PressureLoad['source']; rows: number; gaps: string[] }>;
  gaps: string[];
}

export interface EnsureInventoriesDeps extends PressureDeps {
  loadSet?: (prisma: PrismaClient, kundliId: string) => Promise<ReadingClockSet>;
  load?: typeof loadPressureInventory;
}

/**
 * Every pulled clock of the kundli's set, in parallel: a stored fresh row is only read; a missing or stale one is pulled
 * (each pull limited to SELF_V2_PRESSURE_TIMEOUT_MS, default 15 s; a failure waits SELF_V2_PRESSURE_RETRY_HOURS).
 * Called by the sync worker so a build normally finds the rows stored. Never throws.
 */
export async function ensurePressureInventories(prisma: PrismaClient, kundliId: string, asOf: string, deps: EnsureInventoriesDeps = {}): Promise<EnsureInventoriesResult> {
  try {
    const set = await (deps.loadSet ?? ((p, k) => loadReadingClockSet(p, k)))(prisma, kundliId);
    const load = deps.load ?? loadPressureInventory;
    const clocks = await Promise.all(
      set.pulled.map(async (system) => {
        const r = await load(prisma, kundliId, system, asOf, deps).catch(
          (e: Error): PressureLoad => ({ inventory: null, source: 'none', gaps: [`pressure_inventory: ${String(e?.message ?? e).slice(0, 120)}`] }),
        );
        return { system, source: r.source, rows: r.inventory?.rows.length ?? 0, gaps: r.gaps };
      }),
    );
    return { set, clocks, gaps: [] };
  } catch (e) {
    return { set: null, clocks: [], gaps: [`clock set not read (${String((e as Error)?.message ?? e).slice(0, 120)})`] };
  }
}
