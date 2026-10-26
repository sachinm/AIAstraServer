/**
 * One reader for both dasha shapes (docs/reading-engine/22 §4, server task S-2). Pure data reshaping, no astrology.
 *
 * Radha changed `vimsottari_dasa` and `narayana_dasa` (calc_version "2") from
 *   legacy: [{ maha_dasha_lord, maha_start_date, bhuktis: [{ lord, start_date }] }]
 * to the node shape
 *   v2:     { system, levels, balance_at_birth: { lord, years } | null,
 *             periods: [{ lord, level, start, end, start_jd, end_jd, duration_years, before_birth, children: [...] }] }
 * (rasi dashas also carry `sign_index` on every node). Rows and `kundlis` columns hold either shape while the legacy
 * rows are replaced, so every reader goes through `normalizeDasha`.
 *
 * Legacy -> v2 rules: `end` is the next sibling's start (the last bhukti of a maha ends where the next maha starts);
 * the last maha and its last bhukti have `end: null` (the legacy tree never said); `before_birth` is false and
 * `balance_at_birth` null (legacy cannot say); Julian days and `duration_years` are null (not derivable without a
 * calculation, which stays in Radha). Legacy start strings are cut to the ISO date; the display time is dropped and a
 * `(+1)` suffix (Vimsottari's midnight roll-over, doc 21 §6 bug 2) moves the date to the next day.
 */

export interface DashaNode {
  lord: string;
  level: number;
  /** ISO date (YYYY-MM-DD); '' when the source had none we could read */
  start: string;
  /** ISO date, or null when unknown (end of the legacy tree) */
  end: string | null;
  start_jd: number | null;
  end_jd: number | null;
  duration_years: number | null;
  before_birth: boolean;
  /** rasi dashas only */
  sign_index?: number;
  children: DashaNode[];
}

export interface DashaBalance {
  lord: string;
  years: number;
}

export interface NormalizedDasha {
  /** 'vimsottari' | 'narayana' | ...; null for a legacy payload read without a hint */
  system: string | null;
  levels: number;
  balance_at_birth: DashaBalance | null;
  periods: DashaNode[];
}

export interface LegacyDashaBhukti {
  lord: string;
  start_date: string;
}

export interface LegacyDashaPeriod {
  maha_dasha_lord: string;
  maha_start_date: string;
  bhuktis: LegacyDashaBhukti[];
}

export type DashaShape = 'v2' | 'legacy' | 'unknown';

export interface NormalizeOptions {
  /** Used as `system` when the payload does not carry one (legacy arrays), e.g. 'vimsottari' for the vimsottari_dasa column */
  system?: string;
}

/** Kundli column -> dasha system, for callers that only know the column name. */
export const DASHA_SYSTEM_BY_COLUMN: Readonly<Record<string, string>> = {
  vimsottari_dasa: 'vimsottari',
  narayana_dasa: 'narayana',
};

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Rows may hold the JSON as a string (the GraphQL layer stringifies); parse it once. */
function parseIfString(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload;
  const s = payload.trim();
  if (!s || (s[0] !== '[' && s[0] !== '{')) return payload;
  try {
    return JSON.parse(s);
  } catch {
    return payload;
  }
}

export function detectDashaShape(payload: unknown): DashaShape {
  const p = parseIfString(payload);
  if (isObj(p) && Array.isArray(p.periods)) return 'v2';
  if (Array.isArray(p) && p.every((m) => isObj(m) && ('maha_dasha_lord' in m || 'maha_start_date' in m || 'bhuktis' in m))) return 'legacy';
  return 'unknown';
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** '1984-03-02 07:15:30 AM' -> '1984-03-02'; with ' (+1)' -> '1984-03-03'; anything else -> null */
export function legacyDateToIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms)) return null;
  const rolled = /\(\+1\)/.test(v) ? ms + 86_400_000 : ms;
  return new Date(rolled).toISOString().slice(0, 10);
}

function fromLegacy(arr: Obj[], system: string | null): NormalizedDasha {
  const periods: DashaNode[] = arr.map((m, i) => {
    const start = legacyDateToIso(m.maha_start_date);
    const nextMahaStart = i + 1 < arr.length ? legacyDateToIso(arr[i + 1]!.maha_start_date) : null;
    const bhuktis = Array.isArray(m.bhuktis) ? (m.bhuktis as unknown[]).filter(isObj) : [];
    const children: DashaNode[] = bhuktis.map((b, j) => ({
      lord: String(b.lord ?? ''),
      level: 2,
      start: legacyDateToIso(b.start_date) ?? '',
      end: j + 1 < bhuktis.length ? legacyDateToIso(bhuktis[j + 1]!.start_date) : nextMahaStart,
      start_jd: null,
      end_jd: null,
      duration_years: null,
      before_birth: false,
      children: [],
    }));
    return {
      lord: String(m.maha_dasha_lord ?? ''),
      level: 1,
      start: start ?? '',
      end: nextMahaStart,
      start_jd: null,
      end_jd: null,
      duration_years: null,
      before_birth: false,
      children,
    };
  });
  return { system, levels: periods.some((p) => p.children.length) ? 2 : 1, balance_at_birth: null, periods };
}

function nodeFromV2(n: Obj, level: number): DashaNode {
  const children = Array.isArray(n.children) ? (n.children as unknown[]).filter(isObj).map((c) => nodeFromV2(c, level + 1)) : [];
  return {
    ...n, // keeps sign_index and anything Radha adds later
    lord: String(n.lord ?? ''),
    level: num(n.level) ?? level,
    start: typeof n.start === 'string' ? n.start : '',
    end: typeof n.end === 'string' ? n.end : null,
    start_jd: num(n.start_jd),
    end_jd: num(n.end_jd),
    duration_years: num(n.duration_years),
    before_birth: n.before_birth === true,
    children,
  };
}

function depth(nodes: DashaNode[]): number {
  return nodes.length ? 1 + Math.max(...nodes.map((n) => depth(n.children))) : 0;
}

function fromV2(p: Obj, fallbackSystem: string | null): NormalizedDasha {
  const periods = (p.periods as unknown[]).filter(isObj).map((n) => nodeFromV2(n, 1));
  const b = p.balance_at_birth;
  const balance = isObj(b) && num(b.years) != null ? { lord: String(b.lord ?? ''), years: b.years as number } : null;
  return {
    ...p,
    system: typeof p.system === 'string' ? p.system : fallbackSystem,
    levels: num(p.levels) ?? depth(periods),
    balance_at_birth: balance,
    periods,
  };
}

/**
 * The new node shape from either payload shape (object, JSON string or legacy array). Returns null for null, empty or
 * unrecognised input so callers can keep whatever they had.
 */
export function normalizeDasha(payload: unknown, opts: NormalizeOptions = {}): NormalizedDasha | null {
  const p = parseIfString(payload);
  const shape = detectDashaShape(p);
  if (shape === 'v2') return fromV2(p as Obj, opts.system ?? null);
  if (shape === 'legacy') return fromLegacy(p as Obj[], opts.system ?? null);
  return null;
}

/** The legacy array the Charts page still parses, from either shape. Unrecognised input is returned unchanged. */
export function toLegacyDasha(payload: unknown, opts: NormalizeOptions = {}): unknown {
  const p = parseIfString(payload);
  if (detectDashaShape(p) === 'legacy') return p;
  const n = normalizeDasha(p, opts);
  if (!n) return payload;
  return n.periods.map<LegacyDashaPeriod>((m) => ({
    maha_dasha_lord: m.lord,
    maha_start_date: m.start,
    bhuktis: m.children.map((c) => ({ lord: c.lord, start_date: c.start })),
  }));
}

interface PromptNode {
  lord: string;
  start: string;
  end: string | null;
  duration_years?: number;
  before_birth?: true;
  children?: PromptNode[];
}

function promptNode(n: DashaNode): PromptNode {
  return {
    lord: n.lord,
    start: n.start,
    end: n.end,
    ...(n.duration_years != null ? { duration_years: n.duration_years } : {}),
    ...(n.before_birth ? { before_birth: true as const } : {}),
    ...(n.children.length ? { children: n.children.map(promptNode) } : {}),
  };
}

/**
 * Compact, shape-independent form for LLM context: lord/start/end per node (nested), no Julian days, no empty fields.
 * Unrecognised input is returned unchanged so no data is lost.
 */
export function dashaForPrompt(payload: unknown, opts: NormalizeOptions = {}): unknown {
  const n = normalizeDasha(payload, opts);
  if (!n) return payload;
  return {
    system: n.system,
    ...(n.balance_at_birth ? { balance_at_birth: n.balance_at_birth } : {}),
    periods: n.periods.map(promptNode),
  };
}
