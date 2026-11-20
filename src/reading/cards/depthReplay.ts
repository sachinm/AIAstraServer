/**
 * The depth replay's measure of one stored card (`scripts/depth-replay.ts`; AGENTS.md "Reading depth is a release gate",
 * rule 5): words, charts cited, systems cited, old or new schema, and the floor's verdict. Pure: reads a stored row's
 * output, writes nothing, calls nothing. Counts and ids only; no reading text leaves here.
 */
import { checkDepth, classifyKey, wordCount, type DepthResult } from './story.js';
import { ownChartsOf } from './ownCharts.js';

/** the parts of a stored `self.card.reading` row this reads (old rows lack `story` and `plain`) */
export interface StoredCardLike {
  card?: string;
  oracle?: {
    headline?: string;
    gift?: string;
    knot?: string;
    spans?: Array<{ asks?: string; obstacle?: string; agreement?: string; evidence?: string[] }>;
    evidence?: string[];
    story?: string;
    beats?: Array<{ evidence?: string[] }>;
  } | null;
  personal?: {
    line?: string;
    story?: string;
    why?: string | null;
    spans?: Array<{ asks?: string; obstacle?: string; step?: string; growth?: string }>;
  } | null;
}

export interface DepthRow {
  card: string;
  schema: 'old' | 'new';
  technicalWords: number;
  plainWords: number;
  charts: string[];
  systems: string[];
  keys: number;
  floor: 'pass' | 'fail';
  gaps: string[];
}

const join = (xs: Array<string | undefined | null>): string => xs.filter(Boolean).join(' ');

/** The replay's row for one stored card. Old rows are measured on everything the Oracle wrote (headline, gift, knot, spans). */
export function depthRowOf(s: StoredCardLike, verifiedSystems: readonly string[] | null = null): DepthRow {
  const card = s.card ?? '?';
  const o = s.oracle ?? {};
  const p = s.personal ?? {};
  const isNew = typeof o.story === 'string' && o.story.length > 0;
  const technical = isNew ? o.story! : join([o.headline, o.gift, o.knot, ...(o.spans ?? []).flatMap((x) => [x.asks, x.obstacle, x.agreement])]);
  const plain = typeof p.story === 'string' && p.story ? p.story : join([p.line, p.why ?? undefined, ...(p.spans ?? []).flatMap((x) => [x.asks, x.obstacle, x.step, x.growth])]);
  const keys = [...new Set([...(o.evidence ?? []), ...(o.spans ?? []).flatMap((x) => x.evidence ?? []), ...(o.beats ?? []).flatMap((b) => b.evidence ?? [])])];
  const charts = new Set<string>();
  const systems = new Set<string>();
  for (const k of keys) {
    const f = classifyKey(k);
    if (f.kind === 'varga') charts.add(f.varga!);
    if (f.kind === 'year') charts.add('year');
    if (f.kind === 'dasha') systems.add(f.system!);
  }
  const r: DepthResult = checkDepth({ story: technical, evidence: keys, ownCharts: ownChartsOf(card), verifiedSystems, plainStory: plain });
  return {
    card,
    schema: isNew ? 'new' : 'old',
    technicalWords: wordCount(technical),
    plainWords: wordCount(plain),
    charts: [...charts].sort(),
    systems: [...systems].sort(),
    keys: keys.length,
    floor: r.ok ? 'pass' : 'fail',
    gaps: r.gaps.map((g) => g.kind),
  };
}

/** the markdown table the replay prints (and the baseline doc carries) */
export function depthTable(rows: ReadonlyArray<DepthRow & { kundli?: string; madeAt?: string }>): string {
  const L = ['| kundli | card | schema | made | technical words | plain words | charts cited | systems cited | keys | floor | gaps |', '|---|---|---|---|---:|---:|---|---|---:|---|---|'];
  for (const r of rows) {
    L.push(`| ${r.kundli ?? ''} | ${r.card} | ${r.schema} | ${r.madeAt ?? ''} | ${r.technicalWords} | ${r.plainWords} | ${r.charts.join(', ') || '-'} | ${r.systems.join(', ') || '-'} | ${r.keys} | ${r.floor} | ${r.gaps.join(', ') || '-'} |`);
  }
  return L.join('\n');
}

export interface DepthSummary {
  cards: number;
  pass: number;
  medianTechnical: number;
  medianPlain: number;
  maxTechnical: number;
  withYear: number;
  withD9: number;
  twoSystems: number;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export function depthSummary(rows: readonly DepthRow[]): DepthSummary {
  return {
    cards: rows.length,
    pass: rows.filter((r) => r.floor === 'pass').length,
    medianTechnical: median(rows.map((r) => r.technicalWords)),
    medianPlain: median(rows.map((r) => r.plainWords)),
    maxTechnical: Math.max(0, ...rows.map((r) => r.technicalWords)),
    withYear: rows.filter((r) => r.charts.includes('year')).length,
    withD9: rows.filter((r) => r.charts.includes('D9')).length,
    twoSystems: rows.filter((r) => r.systems.length >= 2).length,
  };
}
