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
 * Dashas change shape in R-6 (doc 22 §4: `calc_version` "2", node shape with `levels`/`periods`). Since S-2 a dasha row
 * or column in either shape is accepted and handed to the page in the legacy array shape (`toLegacyDasha`), which is all
 * the web Charts card parses today. When the page learns the new shape, this is the one place to change.
 */
import type { ChartDataRepo, StoredRow } from './store.js';
import { isMissingTable } from './store.js';
import { BUILTIN_CHART_TYPES, type ChartDataType } from './catalog.js';
import { DASHA_SYSTEM_BY_COLUMN, toLegacyDasha } from './dashaShape.js';

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
  // a dasha column may hold either shape; the page gets the legacy array
  const forPage = (): Record<ChartsPageColumn, unknown> => {
    for (const c of columns) {
      if (c in DASHA_SYSTEM_BY_COLUMN && out[c] != null) out[c] = toLegacyDasha(out[c], { system: DASHA_SYSTEM_BY_COLUMN[c] });
    }
    return out;
  };
  if (process.env.KUNDLI_DATA_READ === '0') return forPage();

  const wanted = columns.map((c) => ({ column: c, type: TYPE_BY_COLUMN.get(c) })).filter((w): w is { column: ChartsPageColumn; type: ChartDataType } => Boolean(w.type));
  if (!wanted.length) return forPage();

  let rows: StoredRow[];
  try {
    rows = await repo.readRows(kundliId, wanted.map((w) => ({ dataType: w.type.id, variant: '' })), opts.ayanamsa ?? 'LAHIRI');
  } catch (err) {
    if (!isMissingTable(err)) (opts.log ?? console).warn(JSON.stringify({ msg: 'kundli_data read failed; using legacy columns', kundli_id: kundliId, error: (err as Error)?.message?.slice(0, 200) }));
    return forPage();
  }

  for (const { column, type } of wanted) {
    const row = rows.find((r) => r.dataType === type.id && r.variant === '');
    // dasha rows of any calc_version are readable since S-2 (converted below); other families keep the shape rule
    if (row && row.status === 'ready' && row.payload != null && (type.family === 'dasha' || hasLegacyShape(row, type))) out[column] = row.payload;
  }
  return forPage();
}
