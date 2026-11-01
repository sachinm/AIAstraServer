/**
 * Turns stored tables into the compact JSON one reader sees. This code SELECTS and never computes: it removes rows and
 * housekeeping fields and gives rows stable names. Every value a reader sees is a value the calculation engine stored.
 *
 * Output is byte-stable for the same input, so the shared CHART CORE can be a cached prefix. Keys of the result are the
 * sections readers cite: dots in a type id become underscores, and evidence ids are dot paths into these objects, for
 * example `dignities.planets.Saturn.dignity` or `dasha_vimsottari.periods.Sa_2019-07-02.children.Ke_2026-08-22.end`.
 */

/** Fields no reader needs: engine internals and day numbers. Cutting them is most of the size saving. */
const DROP = /(_jd$|^sign_index$|^nakshatra_index$|^chart_method$|^notes?$|^rule_basis$|^at_used$|^return_instant$|^before_birth$|^duration_years$|^balance_at_birth$|^rule$|^unit$|^components$|^orientation$|^levels$|^level$|^id$)/;
/** The field that names a row, in order of preference. */
const ROW_NAMES = ['body', 'planet', 'name', 'label', 'key', 'house', 'id'];

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeKey = (k: unknown): string => String(k).replace(/[.\s]+/g, '_');

/** The name field every row of this array has, with no repeats; null when the rows are not nameable. */
function rowNameField(rows: unknown[]): string | null {
  if (rows.length === 0 || !rows.every(isObj)) return null;
  for (const f of ROW_NAMES) {
    const vals = rows.map((r) => (r as Record<string, unknown>)[f]);
    if (vals.every((v) => typeof v === 'string' || typeof v === 'number') && new Set(vals).size === vals.length) return f;
  }
  return null;
}

/** Removes housekeeping fields and turns arrays of named rows into objects, so an evidence id can say which row it means. */
export function tidy(value: unknown): unknown {
  if (Array.isArray(value)) {
    const field = rowNameField(value);
    if (!field) return value.map(tidy);
    const out: Record<string, unknown> = {};
    for (const row of value as Array<Record<string, unknown>>) {
      out[safeKey(row[field])] = tidy(Object.fromEntries(Object.entries(row).filter(([k]) => k !== field)));
    }
    return out;
  }
  if (isObj(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (DROP.test(k) || v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[safeKey(k)] = tidy(v);
    }
    return out;
  }
  return value;
}

export const sectionName = (type: string): string => type.replace(/\./g, '_');

interface Period {
  start?: unknown;
  end?: unknown;
  lord?: unknown;
  children?: unknown;
}

/** Dasha rows that overlap the range, named `<lord>_<start>`. Whole rows only, with the dates exactly as stored. */
export function clipPeriods(payload: unknown, from: string, to: string): unknown {
  const periods = (payload as { periods?: unknown } | null)?.periods;
  if (!Array.isArray(periods)) return tidy(payload);
  const pick = (rows: unknown): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (!Array.isArray(rows)) return out;
    for (const p of rows as Period[]) {
      if (typeof p.start !== 'string' || typeof p.end !== 'string') continue;
      if (p.end.slice(0, 10) < from || p.start.slice(0, 10) > to) continue;
      const children = pick(p.children);
      out[safeKey(`${String(p.lord)}_${p.start.slice(0, 10)}`)] = { lord: p.lord, start: p.start, end: p.end, ...(Object.keys(children).length ? { children } : {}) };
    }
    return out;
  };
  const { periods: _drop, ...rest } = payload as Record<string, unknown>;
  void _drop;
  return { ...(tidy(rest) as object), periods: pick(periods) };
}

/** Only the rows flagged present: the engine's own yes or no, not ours. */
export function presentOnly(payload: unknown, listKey: 'yogas' | 'doshas'): unknown {
  const p = payload as Record<string, unknown> | null;
  const rows = p?.[listKey];
  if (!Array.isArray(rows)) return tidy(payload);
  return tidy({ [listKey]: rows.filter((r) => (r as { present?: unknown }).present === true) });
}

/** Rows of a `houses` table for the frame's houses only. */
export function frameHouses(payload: unknown, houses: readonly number[]): unknown {
  const p = payload as { houses?: unknown } | null;
  if (!Array.isArray(p?.houses)) return tidy(payload);
  const wanted = new Set(houses);
  return tidy({ ...(p as object), houses: (p!.houses as Array<{ house?: unknown }>).filter((h) => wanted.has(Number(h.house))) });
}

/** The two drishti lists without the strength matrix (R05 reads strength from its own tables). */
export function aspectLists(payload: unknown): unknown {
  const p = payload as Record<string, unknown> | null;
  if (!p) return p;
  return tidy({ rasi_drishti: p.rasi_drishti, graha_drishti: p.graha_drishti });
}

/** Annual rows: the year's own fields, dashas clipped to the range. */
export function annualTable(payload: unknown, from: string, to: string): unknown {
  return (payload as { periods?: unknown } | null)?.periods ? clipPeriods(payload, from, to) : tidy(payload);
}

/** CHART CORE: same bytes for every reader and question of one person, until the stored tables change. */
export function renderCore(tables: Record<string, unknown>, coreTypes: readonly string[]): { text: string; sections: Record<string, unknown> } {
  const sections: Record<string, unknown> = {};
  for (const t of coreTypes) if (tables[t] !== undefined) sections[sectionName(t)] = tidy(tables[t]);
  return { text: `CHART CORE: ${JSON.stringify(sections)}`, sections };
}

/** Same estimate the evidence pack uses. */
export const approxTokens = (s: string): number => Math.ceil(s.length / 3.6);
