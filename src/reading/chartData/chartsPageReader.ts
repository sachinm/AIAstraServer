/**
 * Reader for the Charts page and the GraphQL kundli resolvers (docs/reading-engine/20 §4 migration step 3).
 *
 * The page still speaks the old `kundlis` column vocabulary (`biodata`, `d1`, `vimsottari_dasa`, ...). Each column is
 * answered from `kundli_data` first and falls back to the value read from the legacy column while both exist.
 * Nothing here computes astrology and nothing is fetched from Radha: a missing item stays missing.
 *
 * Shape rule: the page parses the legacy payload shapes. A row is used only when it has that shape:
 *   - `calc_version` is `legacy` (backfilled or written through from the columns) or null; or
 *   - the type is a varga, panchanga or karaka item, which Radha keeps backwards compatible on the wire
 *     (doc 22 §1 / §3: the new vargas return the same placement rows as today's d2..d10).
 * Dashas change shape in R-6 (doc 22 §4: `calc_version` "2", node shape with `levels`/`periods`), so a non-legacy dasha
 * row is skipped and the legacy column answers until the page learns the new shape (server task S-2).
 */
import type { ChartDataRepo, StoredRow } from './store.js';
import { isMissingTable } from './store.js';
import { BUILTIN_CHART_TYPES, type ChartDataType } from './catalog.js';

export const CHARTS_PAGE_COLUMNS = ['biodata', 'd1', 'd2', 'd4', 'd7', 'd9', 'd10', 'charakaraka', 'vimsottari_dasa', 'narayana_dasa'] as const;
export type ChartsPageColumn = (typeof CHARTS_PAGE_COLUMNS)[number];

const TYPE_BY_COLUMN = new Map<string, ChartDataType>(BUILTIN_CHART_TYPES.filter((t) => t.legacyColumn).map((t) => [t.legacyColumn!, t]));

const COMPATIBLE_FAMILIES = new Set<string>(['varga', 'panchanga', 'karaka']);

export function hasLegacyShape(row: Pick<StoredRow, 'calcVersion'>, type: Pick<ChartDataType, 'family'>): boolean {
  return row.calcVersion == null || row.calcVersion === 'legacy' || COMPATIBLE_FAMILIES.has(type.family);
}

export interface ReadChartColumnsOptions {
  ayanamsa?: string;
  log?: Pick<Console, 'warn'>;
}

/**
 * Value for each requested column: the `kundli_data` row when it is ready and has the legacy shape, otherwise the value in
 * `legacy` (the column read from `kundlis`), otherwise null. Never throws: a read problem on the vertical table
 * (M7 not applied, or any error) degrades to the legacy values. `KUNDLI_DATA_READ=0` skips the vertical table.
 */
export async function readChartColumns(
  repo: ChartDataRepo,
  kundliId: string,
  columns: readonly ChartsPageColumn[],
  legacy: Partial<Record<ChartsPageColumn, unknown>>,
  opts: ReadChartColumnsOptions = {}
): Promise<Record<ChartsPageColumn, unknown>> {
  const out = Object.fromEntries(columns.map((c) => [c, legacy[c] ?? null])) as Record<ChartsPageColumn, unknown>;
  if (process.env.KUNDLI_DATA_READ === '0') return out;

  const wanted = columns.map((c) => ({ column: c, type: TYPE_BY_COLUMN.get(c) })).filter((w): w is { column: ChartsPageColumn; type: ChartDataType } => Boolean(w.type));
  if (!wanted.length) return out;

  let rows: StoredRow[];
  try {
    rows = await repo.readRows(kundliId, wanted.map((w) => ({ dataType: w.type.id, variant: '' })), opts.ayanamsa ?? 'LAHIRI');
  } catch (err) {
    if (!isMissingTable(err)) (opts.log ?? console).warn(JSON.stringify({ msg: 'kundli_data read failed; using legacy columns', kundli_id: kundliId, error: (err as Error)?.message?.slice(0, 200) }));
    return out;
  }

  for (const { column, type } of wanted) {
    const row = rows.find((r) => r.dataType === type.id && r.variant === '');
    if (row && row.status === 'ready' && row.payload != null && hasLegacyShape(row, type)) out[column] = row.payload;
  }
  return out;
}
