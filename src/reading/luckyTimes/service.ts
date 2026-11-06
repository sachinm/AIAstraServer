/**
 * Lucky times v1 service (docs/reading-engine/49): the person's place and picks, and the range of day layers.
 *
 * Range is today −7 … today +14 at the person's place. Missing day rows are pulled on demand by the `lucky.day_tables`
 * agent (engine `muhurta`, one call per month); the person's tara and chandra bala come from the `lucky.day_overlay`
 * agent (engine `muhurta` with natal fields, one call per month); each shown scenario's layer is built by the
 * `lucky.scenario_windows` agent (code). Every agent run is logged (src/agents/registry.ts) and tagged with its technique
 * (src/techniques/catalog.ts): the day's avoid bands are one `lucky.avoid_bands` run, and each shown scenario's layer is
 * its own `lucky.<scenario id>` run, so each scenario counts on its own in the admin panel (docs/admin/03).
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { DAY_TABLE_PLACES, dayTablePlaceKey, standardOffsetHours } from './places.js';
import { scenarioById, scenarioCatalog, SCENARIOS } from './scenarios.js';
import { avoidBands, dayLimbs, localMinutes, nowState, scenarioDay, toMin, type ChartMarks, type DayLimb, type DayRow, type FunctionalNature, type PersonalDay, type Window } from './windows.js';

export const RANGE_BACK_DAYS = 7;
export const RANGE_AHEAD_DAYS = 14;

export type EngineFetch = (type: string, fields: Record<string, unknown>) => Promise<unknown>;

export interface LuckyDeps {
  prisma: PrismaClient;
  /** engine call at a place; absent → no on-demand pulls (stored rows only) */
  engine?: EngineFetch | null;
  /** natal fields for the person's kundli (engine `natal_*`); absent → no personal layer pull */
  natalFor?: (userId: string) => Promise<{ kundliId: string; fields: Record<string, unknown> } | null>;
  /**
   * The functional nature of each planet for this chart (benefic / malefic / neutral), read from the kundli digest
   * (doc 53 §4.6, doc 54 §6). Null or absent → no hora-lord mark. Wired to null until the digest reader lands (S1).
   */
  functionalNatureOf?: ((kundliId: string) => Promise<Record<string, FunctionalNature> | null>) | null;
  now?: () => Date;
}

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const datesBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};

export async function getSetup(deps: LuckyDeps, userId: string) {
  const [pref, picks] = await Promise.all([
    deps.prisma.luckyPref.findUnique({ where: { user_id: userId } }),
    deps.prisma.luckyScenarioPick.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } }),
  ]);
  return {
    place: pref?.place_key && placeKeyToPreset(pref.place_key) ? placeKeyToPreset(pref.place_key) : null,
    places: Object.entries(DAY_TABLE_PLACES).map(([key, p]) => ({ key, name: p.name })),
    scenarios: scenarioCatalog(),
    picks: picks.filter((p) => scenarioById(p.scenario_id)).map((p) => ({ scenario: p.scenario_id, shown: p.shown, answers: p.answers })),
  };
}

function placeKeyToPreset(placeKey: string): string | null {
  for (const [key, p] of Object.entries(DAY_TABLE_PLACES)) if (dayTablePlaceKey(p) === placeKey) return key;
  return null;
}

export async function setPlace(deps: LuckyDeps, userId: string, preset: string): Promise<boolean> {
  const p = DAY_TABLE_PLACES[preset];
  if (!p) return false;
  const place_key = dayTablePlaceKey(p);
  await deps.prisma.luckyPref.upsert({ where: { user_id: userId }, create: { user_id: userId, place_key }, update: { place_key, updated_at: new Date() } });
  return true;
}

export type PickResult = { status: 'ok'; pick: { scenario: string; shown: boolean; answers: unknown } } | { status: 'unknown' | 'exists' | 'not_found' };

export async function addPick(deps: LuckyDeps, userId: string, scenario: string): Promise<PickResult> {
  if (!scenarioById(scenario)) return { status: 'unknown' };
  const existing = await deps.prisma.luckyScenarioPick.findUnique({ where: { user_id_scenario_id: { user_id: userId, scenario_id: scenario } } });
  if (existing) return { status: 'exists' };
  const row = await deps.prisma.luckyScenarioPick.create({ data: { user_id: userId, scenario_id: scenario } });
  return { status: 'ok', pick: { scenario: row.scenario_id, shown: row.shown, answers: row.answers } };
}

const ANSWER_KEYS: Record<string, string[]> = {
  who: ['boss', 'peer', 'client', 'panel'],
  job: ['yes', 'between_jobs', 'own_business'],
  relationship: ['single', 'seeing_someone', 'committed'],
};

export function cleanAnswers(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) if (ANSWER_KEYS[k] && typeof v === 'string' && ANSWER_KEYS[k].includes(v)) out[k] = v;
  return out;
}

export async function patchPick(deps: LuckyDeps, userId: string, scenario: string, patch: { shown?: unknown; answers?: unknown }): Promise<PickResult> {
  const existing = await deps.prisma.luckyScenarioPick.findUnique({ where: { user_id_scenario_id: { user_id: userId, scenario_id: scenario } } });
  if (!existing) return { status: 'not_found' };
  const data: { shown?: boolean; answers?: object; updated_at: Date } = { updated_at: new Date() };
  if (typeof patch.shown === 'boolean') data.shown = patch.shown;
  if (patch.answers !== undefined) data.answers = { ...(existing.answers as object), ...cleanAnswers(patch.answers) };
  const row = await deps.prisma.luckyScenarioPick.update({ where: { id: existing.id }, data });
  return { status: 'ok', pick: { scenario: row.scenario_id, shown: row.shown, answers: row.answers } };
}

export async function removePick(deps: LuckyDeps, userId: string, scenario: string): Promise<boolean> {
  const r = await deps.prisma.luckyScenarioPick.deleteMany({ where: { user_id: userId, scenario_id: scenario } });
  return r.count > 0;
}

/** Clamp a requested range to today −7 … today +14 (dates as YYYY-MM-DD in the place's zone). */
export function clampRange(today: string, from?: string, to?: string): { from: string; to: string } {
  const min = addDays(today, -RANGE_BACK_DAYS);
  const max = addDays(today, RANGE_AHEAD_DAYS);
  const ok = (s?: string) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let f = ok(from) ? from! : min;
  let t = ok(to) ? to! : max;
  if (f < min) f = min;
  if (t > max) t = max;
  if (t < f) t = f;
  return { from: f, to: t };
}

/** Pull the missing months for a place (agent `lucky.day_tables`). Returns the dates written. */
async function pullDayTables(deps: LuckyDeps, userId: string, preset: string, missing: string[]): Promise<number> {
  if (!deps.engine || missing.length === 0) return 0;
  const place = DAY_TABLE_PLACES[preset]!;
  const placeKey = dayTablePlaceKey(place);
  const months = [...new Set(missing.map(monthOf))].slice(0, 2);
  return withAgentRun(deps.prisma, 'lucky.day_tables', { userId, task: `pull ${preset} ${months.join(',')}`, input: { preset, months }, technique: 'lucky.day_tables' }, async () => {
    let written = 0;
    const charts: Array<{ type: string; variant: string; calc_version: string | null }> = [];
    for (const m of months) {
      const from = m;
      const to = monthEnd(m);
      const raw = (await deps.engine!('muhurta', { lat: place.lat, lon: place.lon, tz: standardOffsetHours(place.tzName), params: { from, to, tz_name: place.tzName } })) as { days?: DayRow[]; data?: { days?: DayRow[] } };
      const days = raw?.days ?? raw?.data?.days ?? [];
      const version = (await deps.prisma.chartDataType.findUnique({ where: { id: 'muhurta' }, select: { calc_version: true } }).catch(() => null))?.calc_version ?? null;
      charts.push({ type: 'muhurta', variant: m.slice(0, 7), calc_version: version });
      for (const day of days) {
        if (typeof day.date !== 'string') continue;
        const payload = JSON.parse(JSON.stringify(day)) as object;
        const source_hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        const rawOffset = (day as unknown as { utc_offset_hours?: unknown }).utc_offset_hours;
        const offset = typeof rawOffset === 'number' ? rawOffset : standardOffsetHours(place.tzName);
        await deps.prisma.dayTable.upsert({
          where: { place_key_date_ayanamsa: { place_key: placeKey, date: new Date(`${day.date}T00:00:00Z`), ayanamsa: 'LAHIRI' } },
          create: { place_key: placeKey, place_name: place.name, lat: place.lat, lon: place.lon, tz_name: place.tzName, date: new Date(`${day.date}T00:00:00Z`), utc_offset_hours: offset, calc_version: version, source_hash, payload },
          update: { utc_offset_hours: offset, calc_version: version, source_hash, payload, fetched_at: new Date() },
        });
        written += 1;
      }
    }
    return { value: written, output: { written }, charts };
  });
}

/** The person's tara and chandra bala per day for the months in range (agent `lucky.day_overlay`). */
type Natal = { kundliId: string; fields: Record<string, unknown> } | null;

async function personalDays(deps: LuckyDeps, userId: string, preset: string, dates: string[], natal: Natal): Promise<Map<string, PersonalDay>> {
  const out = new Map<string, PersonalDay>();
  const place = DAY_TABLE_PLACES[preset]!;
  const placeKey = dayTablePlaceKey(place);
  if (!natal) return out;
  const months = [...new Set(dates.map(monthOf))];
  for (const m of months) {
    let row = await deps.prisma.kundliDayOverlay.findUnique({ where: { kundli_id_place_key_month: { kundli_id: natal.kundliId, place_key: placeKey, month: new Date(`${m}T00:00:00Z`) } } }).catch(() => null);
    if (!row && deps.engine) {
      try {
        const ctx = { userId, task: `overlay ${preset} ${m}`, input: { preset, month: m }, technique: 'lucky.personal_overlay', kundliId: natal.kundliId, charts: [{ type: 'muhurta', variant: m.slice(0, 7) }] };
        row = await withAgentRun(deps.prisma, 'lucky.day_overlay', ctx, async () => {
          const raw = (await deps.engine!('muhurta', { lat: place.lat, lon: place.lon, tz: standardOffsetHours(place.tzName), params: { from: m, to: monthEnd(m), tz_name: place.tzName, ...natal.fields } })) as { days?: unknown[]; data?: { days?: unknown[] } };
          const days = (raw?.days ?? raw?.data?.days ?? []) as Array<{ date?: string; tara?: unknown; chandra_bala?: unknown; grade?: unknown }>;
          const payload = { days: days.map((d) => ({ date: d.date, tara: d.tara ?? null, chandra_bala: d.chandra_bala ?? null, grade: d.grade ?? null })) };
          const source_hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
          const saved = await deps.prisma.kundliDayOverlay.upsert({
            where: { kundli_id_place_key_month: { kundli_id: natal.kundliId, place_key: placeKey, month: new Date(`${m}T00:00:00Z`) } },
            create: { kundli_id: natal.kundliId, place_key: placeKey, month: new Date(`${m}T00:00:00Z`), source_hash, payload },
            update: { source_hash, payload, fetched_at: new Date() },
          });
          return { value: saved, output: { days: payload.days.length } };
        });
      } catch {
        row = null;
      }
    }
    const days = ((row?.payload as { days?: Array<{ date?: string; tara?: PersonalDay['tara']; chandra_bala?: PersonalDay['chandra_bala'] }> } | null)?.days ?? []);
    for (const d of days) if (d.date) out.set(d.date, { tara: d.tara ?? null, chandra_bala: d.chandra_bala ?? null });
  }
  return out;
}

export interface RangeDay {
  date: string;
  weekday: string | null;
  sunrise: number | null;
  sunset: number | null;
  personal: { tara_good: boolean | null; moon_good: boolean | null } | null;
  avoid: Array<{ kind: string; from: number; to: number }>;
  good: Array<{ kind: 'abhijit' | 'amrita' | 'brahma'; from: number; to: number }>;
  /** the day's yoga and karana from the stored row (doc 54 §6), named only in the Why sheet */
  yoga: DayLimb | null;
  karana: DayLimb | null;
  layers: Record<string, { verdict: string; windows: Window[]; dayReasons: string[] }>;
}

export type RangeResult =
  | { status: 'no_place' }
  | { status: 'ok'; place: string; today: string; nowMin: number; from: string; to: string; days: RangeDay[]; missing: string[]; now: ReturnType<typeof nowState> | null };

export async function getRange(deps: LuckyDeps, userId: string, q: { from?: string; to?: string }): Promise<RangeResult> {
  const pref = await deps.prisma.luckyPref.findUnique({ where: { user_id: userId } });
  const preset = pref ? placeKeyToPreset(pref.place_key) : null;
  if (!preset) return { status: 'no_place' };
  const place = DAY_TABLE_PLACES[preset]!;
  const placeKey = dayTablePlaceKey(place);
  const at = (deps.now ?? (() => new Date()))();
  const { date: today, minutes: nowMin } = localMinutes(at, place.tzName);
  const range = clampRange(today, q.from, q.to);
  const dates = datesBetween(range.from, range.to);

  const load = () =>
    deps.prisma.dayTable.findMany({
      where: { place_key: placeKey, ayanamsa: 'LAHIRI', date: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) } },
      orderBy: { date: 'asc' },
    });
  let rows = await load();
  let have = new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
  let missing = dates.filter((d) => !have.has(d));
  if (missing.length && deps.engine) {
    try {
      await pullDayTables(deps, userId, preset, missing);
      rows = await load();
      have = new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
      missing = dates.filter((d) => !have.has(d));
    } catch {
      // the board shows what is stored; the agent run is logged as failed
    }
  }

  const picks = (await deps.prisma.luckyScenarioPick.findMany({ where: { user_id: userId, shown: true } })).filter((p) => scenarioById(p.scenario_id));
  const natal: Natal = deps.natalFor ? await deps.natalFor(userId).catch(() => null) : null;
  const personal = await personalDays(deps, userId, preset, [...have], natal);
  // the chart's marks: only when the digest gives the functional natures (doc 53 §4.6); never a Node derivation
  const functional = natal && deps.functionalNatureOf ? await deps.functionalNatureOf(natal.kundliId).catch(() => null) : null;
  const chart: ChartMarks = { functional };

  // the day rows each run read: one muhurta payload per month, with the calc version it was stored with
  const charts = [...new Map(rows.map((r) => [`${r.date.toISOString().slice(0, 7)}|${r.calc_version ?? ''}`, { type: 'muhurta', variant: r.date.toISOString().slice(0, 7), calc_version: r.calc_version ?? null }])).values()];
  const days = await withAgentRun(
    deps.prisma,
    'lucky.scenario_windows',
    { userId, task: `bands ${range.from}..${range.to}`, input: { preset, days: rows.length }, technique: 'lucky.avoid_bands', charts },
    async () => {
      const out: RangeDay[] = rows.map((r) => {
        const row = r.payload as unknown as DayRow;
        const date = r.date.toISOString().slice(0, 10);
        const p = personal.get(date);
        const good: RangeDay['good'] = [];
        const span = (kind: 'abhijit' | 'amrita' | 'brahma', s?: { start: unknown; end: unknown }) => {
          if (!s) return;
          const from = toMin(s.start as string);
          let to = toMin(s.end as string);
          if (to < from) to += 1440;
          if (Number.isFinite(from) && Number.isFinite(to)) good.push({ kind, from: Math.round(from), to: Math.round(to) });
        };
        span('brahma', row.brahma_muhurta);
        span('abhijit', row.abhijit);
        for (const a of row.amrita_gadiya ?? []) span('amrita', a);
        return {
          date,
          weekday: row.weekday ?? null,
          sunrise: Number.isFinite(toMin(row.sunrise)) ? Math.round(toMin(row.sunrise)) : null,
          sunset: Number.isFinite(toMin(row.sunset)) ? Math.round(toMin(row.sunset)) : null,
          personal: p ? { tara_good: p.tara?.good ?? null, moon_good: p.chandra_bala?.good ?? null } : null,
          avoid: avoidBands(row).map((b) => ({ kind: b.kind, from: Math.round(b.from), to: Math.round(b.to) })),
          good: good.sort((a, b) => a.from - b.from),
          ...dayLimbs(row),
          layers: {},
        };
      });
      return { value: out, output: { days: out.length, avoid: out.reduce((n, d) => n + d.avoid.length, 0) } };
    },
  );

  // one run per shown scenario; layers are put in pick order once all are back
  const layerSets = await Promise.all(
    picks.map((pick) => {
      const rule = scenarioById(pick.scenario_id)!;
      return withAgentRun(
        deps.prisma,
        'lucky.scenario_windows',
        { userId, task: `${rule.id} ${range.from}..${range.to}`, input: { preset, scenario: rule.id, days: rows.length }, technique: `lucky.${rule.id}`, charts },
        async () => {
          const layers = rows.map((r) => {
            const sd = scenarioDay(r.payload as unknown as DayRow, rule, personal.get(r.date.toISOString().slice(0, 10)), chart);
            return { verdict: sd.verdict, windows: sd.windows, dayReasons: sd.dayReasons };
          });
          return { value: layers, output: { days: layers.length, good_days: layers.filter((l) => l.verdict === 'good').length, windows: layers.reduce((n, l) => n + l.windows.length, 0) } };
        },
      );
    }),
  );
  picks.forEach((pick, k) => {
    layerSets[k]!.forEach((layer, i) => {
      days[i]!.layers[pick.scenario_id] = layer;
    });
  });

  const todayRow = rows.find((r) => r.date.toISOString().slice(0, 10) === today);
  return {
    status: 'ok',
    place: preset,
    today,
    nowMin,
    from: range.from,
    to: range.to,
    days,
    missing,
    now: todayRow ? nowState(todayRow.payload as unknown as DayRow, nowMin) : null,
  };
}

export const V1_SCENARIO_IDS = SCENARIOS.map((s) => s.id);
