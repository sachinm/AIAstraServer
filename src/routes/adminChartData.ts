/**
 * Chart Data Review (admin module, aiadastra_admin `web/src/pages/ChartData.tsx`): every row the engine stored for one
 * person's chart, opened by the Prisma PII extension and served behind the admin-lab token. Nothing here computes
 * astrology; the rows are returned as stored.
 *
 *   GET /api/admin-lab/chart-data/:userId?part=natal|dasha|annual|digest|activation|all&years=2025,2026,2027
 *
 * Every answer carries the person (QA, Sachin 2026-11-08: every auth and kundli row is made-up test data, so birth
 * details are shown in full), the latest kundli's status columns, the catalogue (built-in list merged with the
 * `chart_data_types` table, plus which ids the digest expects) and the index of every stored `kundli_data` row without
 * its payload. `part` picks which payloads come with it, so one answer stays well under the Lambda's 6 MB response cap:
 *
 *   natal       (default) natal `kundli_data` rows other than dashas, with payloads, plus the legacy `kundlis` JSON columns
 *   dasha       `dasha.*` rows with payloads (about 3 MB on a full chart, most of a natal answer, so a part of its own)
 *   annual      `annual.*` rows with payloads; `years` (comma list, at most 5) narrows them to those years' variants
 *               plus the `current` variants of the registration pull
 *   digest      `kundli_digest` rows
 *   activation  `kundli_activation` rows
 *   all         everything above (small charts and tests only)
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { BUILTIN_CHART_TYPES } from '../reading/chartData/catalog.js';
import { DIGEST_NATAL_TYPES } from '../reading/digest/build.js';
import { ANNUAL_CHART_TYPES, ANNUAL_YEAR_TYPES } from '../reading/digest/annualSet.js';

export const CHART_DATA_PARTS = ['natal', 'dasha', 'annual', 'digest', 'activation', 'all'] as const;
export type ChartDataPart = (typeof CHART_DATA_PARTS)[number];

/** The legacy `kundlis` JSON columns (sealed; opened by the extension) served with the natal part. */
const LEGACY_COLUMNS = ['biodata', 'd1', 'd2', 'd4', 'd7', 'd9', 'd10', 'charakaraka', 'vimsottari_dasa', 'narayana_dasa', 'other_readings'] as const;

const iso = (d: Date | null | undefined): string | null => (d instanceof Date ? d.toISOString() : null);
const day = (d: Date | null | undefined): string | null => (d instanceof Date ? d.toISOString().slice(0, 10) : null);

export function parsePart(v: unknown): ChartDataPart | null {
  if (v === undefined || v === '') return 'natal';
  return typeof v === 'string' && (CHART_DATA_PARTS as readonly string[]).includes(v) ? (v as ChartDataPart) : null;
}

/** `2025,2026` → [2025, 2026]; null when absent; undefined when malformed. */
export function parseYears(v: unknown): number[] | null | undefined {
  if (v === undefined || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length || parts.length > 5 || !parts.every((s) => /^\d{4}$/.test(s))) return undefined;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

/** The year a `year=<y>[;...]` variant belongs to, or null. */
export function yearOfVariant(variant: string): number | null {
  const m = /^year=(\d{4})(?:;|$)/.exec(variant);
  return m ? Number(m[1]) : null;
}

type RowMeta = {
  data_type: string;
  variant: string;
  params: unknown;
  ayanamsa: string;
  calc_version: string | null;
  engine_commit: string | null;
  payload_hash: string | null;
  status: string;
  error: string | null;
  fetch_started_at: Date | null;
  fetched_at: Date | null;
  valid_to: Date | null;
};

function rowOut(r: RowMeta & { payload?: unknown }, withPayload: boolean) {
  const out: Record<string, unknown> = {
    dataType: r.data_type,
    variant: r.variant,
    params: r.params ?? {},
    ayanamsa: r.ayanamsa,
    calcVersion: r.calc_version,
    engineCommit: r.engine_commit,
    payloadHash: r.payload_hash,
    status: r.status,
    error: r.error,
    fetchStartedAt: iso(r.fetch_started_at),
    fetchedAt: iso(r.fetched_at),
    validTo: iso(r.valid_to),
  };
  if (withPayload) {
    out.payload = r.payload ?? null;
    out.bytes = r.payload == null ? 0 : Buffer.byteLength(JSON.stringify(r.payload));
  }
  return out;
}

const META_SELECT = {
  data_type: true,
  variant: true,
  params: true,
  ayanamsa: true,
  calc_version: true,
  engine_commit: true,
  payload_hash: true,
  status: true,
  error: true,
  fetch_started_at: true,
  fetched_at: true,
  valid_to: true,
} as const;

export interface ChartDataDeps {
  prisma: PrismaClient;
}

/** The handler (the caller mounts it behind the lab token guard). */
export function chartDataHandler(deps: ChartDataDeps): express.RequestHandler {
  return async (req, res) => {
    const part = parsePart(req.query.part);
    const years = parseYears(req.query.years);
    if (!part || years === undefined) return void res.status(400).json({ error: 'bad_request' });
    const userId = String(req.params.userId);
    try {
      const a = await deps.prisma.auth.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, username: true, date_of_birth: true, time_of_birth: true, place_of_birth: true, city: true, country_code: true, gender: true, locked_at: true },
      });
      if (!a) return void res.status(404).json({ error: 'no_person' });
      const withNatal = part === 'natal' || part === 'all';
      const withAnnual = part === 'annual' || part === 'all';
      const withDasha = part === 'dasha' || part === 'all';
      const k = await deps.prisma.kundli.findFirst({
        where: { user_id: a.id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          created_at: true,
          lat: true,
          lon: true,
          tz: true,
          place_resolved: true,
          queue_status: true,
          queue_completed_at: true,
          last_sync_error: true,
          facts_status: true,
          digest_status: true,
          digest_version: true,
          digest_built_at: true,
          digest_error: true,
          preferred_dasha: true,
          ...(withNatal ? Object.fromEntries(LEGACY_COLUMNS.map((c) => [c, true])) : {}),
        },
      });
      const tableRows = await deps.prisma.chartDataType.findMany({ select: { id: true, served: true, calc_version: true, enabled: true, label: true, family: true } }).catch(() => []);
      const tableById = new Map(tableRows.map((t) => [t.id, t]));
      const expected = new Set<string>(['varga.d1', ...DIGEST_NATAL_TYPES]);
      const annualExpected = new Set<string>([...ANNUAL_CHART_TYPES, ...ANNUAL_YEAR_TYPES]);
      const types = BUILTIN_CHART_TYPES.filter((t) => t.changeClass !== 'moving').map((t) => {
        const row = tableById.get(t.id);
        return {
          id: t.id,
          family: row?.family ?? t.family,
          label: row?.label ?? t.label,
          changeClass: t.changeClass,
          variantKind: t.variantKind,
          served: row?.served ?? t.served,
          calcVersion: row?.calc_version ?? t.calcVersion,
          enabled: row?.enabled ?? true,
          expected: expected.has(t.id) || annualExpected.has(t.id),
        };
      });
      const person = {
        userId: a.id,
        name: a.name?.trim() || a.username?.trim() || null,
        email: a.email ?? null,
        dateOfBirth: a.date_of_birth ?? null,
        timeOfBirth: a.time_of_birth ?? null,
        placeOfBirth: a.place_of_birth?.trim() || null,
        city: a.city ?? null,
        countryCode: a.country_code ?? null,
        gender: a.gender ?? null,
        locked: a.locked_at != null,
      };
      if (!k) {
        return void res.json({ person, kundli: null, types, index: [], part, years, rows: [], legacy: null, digest: null, activation: null, servedAt: new Date().toISOString() });
      }
      const index = await deps.prisma.kundliData.findMany({ where: { kundli_id: k.id }, select: META_SELECT, orderBy: [{ data_type: 'asc' }, { variant: 'asc' }] });

      const rows: Array<Record<string, unknown>> = [];
      if (withNatal) {
        const natal = await deps.prisma.kundliData.findMany({
          where: { kundli_id: k.id, NOT: [{ data_type: { startsWith: 'annual.' } }, { data_type: { startsWith: 'dasha.' } }] },
          select: { ...META_SELECT, payload: true },
          orderBy: [{ data_type: 'asc' }, { variant: 'asc' }],
        });
        rows.push(...natal.map((r) => rowOut(r as RowMeta & { payload: unknown }, true)));
      }
      if (withDasha) {
        const dasha = await deps.prisma.kundliData.findMany({
          where: { kundli_id: k.id, data_type: { startsWith: 'dasha.' } },
          select: { ...META_SELECT, payload: true },
          orderBy: [{ data_type: 'asc' }, { variant: 'asc' }],
        });
        rows.push(...dasha.map((r) => rowOut(r as RowMeta & { payload: unknown }, true)));
      }
      if (withAnnual) {
        const yearFilter = years?.length ? { OR: [{ variant: 'current' }, ...years.flatMap((y) => [{ variant: `year=${y}` }, { variant: { startsWith: `year=${y};` } }])] } : {};
        const annual = await deps.prisma.kundliData.findMany({
          where: { kundli_id: k.id, data_type: { startsWith: 'annual.' }, ...yearFilter },
          select: { ...META_SELECT, payload: true },
          orderBy: [{ data_type: 'asc' }, { variant: 'asc' }],
        });
        rows.push(...annual.map((r) => rowOut(r as RowMeta & { payload: unknown }, true)));
      }
      const digest =
        part === 'digest' || part === 'all'
          ? (await deps.prisma.kundliDigest.findMany({ where: { kundli_id: k.id }, orderBy: [{ section: 'asc' }, { key: 'asc' }] })).map((d) => ({
              section: d.section,
              key: d.key,
              row: d.row,
              source: d.source,
              digestVersion: d.digest_version,
              builtAt: iso(d.built_at),
            }))
          : null;
      const activation =
        part === 'activation' || part === 'all'
          ? (await deps.prisma.kundliActivation.findMany({ where: { kundli_id: k.id }, orderBy: [{ system: 'asc' }, { level: 'asc' }, { from_date: 'asc' }] })).map((x) => ({
              system: x.system,
              family: x.family,
              level: x.level,
              lord: x.lord,
              sign: x.sign,
              from: day(x.from_date),
              to: day(x.to_date),
              houses: x.houses,
              parentLord: x.parent_lord,
              digestVersion: x.digest_version,
            }))
          : null;
      const kr = k as typeof k & Record<string, unknown>;
      const legacy = withNatal ? Object.fromEntries(LEGACY_COLUMNS.map((c) => [c, kr[c] ?? null])) : null;
      return void res.json({
        person,
        kundli: {
          id: k.id,
          createdAt: iso(k.created_at),
          lat: k.lat,
          lon: k.lon,
          tz: k.tz,
          placeResolved: k.place_resolved,
          queueStatus: k.queue_status,
          queueCompletedAt: iso(k.queue_completed_at),
          lastSyncError: k.last_sync_error,
          factsStatus: k.facts_status,
          digestStatus: k.digest_status,
          digestVersion: k.digest_version,
          digestBuiltAt: iso(k.digest_built_at),
          digestError: k.digest_error,
          preferredDasha: k.preferred_dasha,
        },
        types,
        index: index.map((r) => rowOut(r as RowMeta, false)),
        part,
        years,
        rows,
        legacy,
        digest,
        activation,
        servedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[admin-lab] chart-data', (e as Error).message);
      return void res.status(503).json({ error: 'chart_data_unavailable' });
    }
  };
}
