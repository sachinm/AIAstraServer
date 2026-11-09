/**
 * Shared helpers of the Self v2 area techniques (docs/reading-engine/66 §4.8 Layer 2). An area is a pure selection over
 * the sub-technique outputs in `ctx.sub` into an `AreaBrief`: fact tags, evidence keys, ranges, ledger and promise ids.
 * No area reads the database or the digest (tests/unit/reading/self/v2 asserts it), and no brief carries prose.
 */
import type { AreaDate } from '../areaDoc.js';
import {
  SELF_V2_REFRESH,
  type AreaBrief,
  type AreaHorizon,
  type BriefClaim,
  type DateSpan,
  type Matter,
  type PeriodSpan,
  type PromiseEntry,
  type RefreshTrigger,
  type RiskRow,
  type SelfBuildContext,
  type SelfBuildStamps,
  type SelfV2AreaId,
  type WindowRef,
} from '../v2types.js';

const STAMP_OF: Record<RefreshTrigger, keyof SelfBuildStamps> = {
  digest: 'digestVersion',
  main_period: 'mainPeriod',
  sub_period: 'subPeriod',
  sub_sub_period: 'subSubPeriod',
  sky_week: 'skyWeek',
  year: 'year',
  profile: 'profileHash',
  confirm: 'confirmHash',
};

/** the area's store key: the clock plus the stamp of every trigger that can make it stale (SELF_V2_REFRESH) */
export function refreshStamp(ctx: SelfBuildContext, area: SelfV2AreaId): string {
  return [`clock=${ctx.stamps.clock}`, ...SELF_V2_REFRESH[area].map((t) => `${t}=${ctx.stamps[STAMP_OF[t]] ?? '-'}`)].join('|');
}

export class BriefBuilder {
  private claims: BriefClaim[] = [];
  private dates: AreaDate[] = [];
  private ledger = new Set<string>();
  private promise = new Set<string>();
  private ids = new Set<string>();

  constructor(private readonly ctx: SelfBuildContext, private readonly area: SelfV2AreaId, private readonly horizon: AreaHorizon) {}

  claim(fact: string, evidence: readonly string[], range: DateSpan | 'always' = 'always'): this {
    if (!evidence.length) return this;
    let id = `${this.area}.${fact}`;
    for (let i = 2; this.ids.has(id); i++) id = `${this.area}.${fact}#${i}`;
    this.ids.add(id);
    this.claims.push({ id, fact, evidence: [...new Set(evidence)], range });
    return this;
  }

  window(fact: string, w: WindowRef | null | undefined): this {
    if (!w) return this;
    return this.claim(`${fact}:${w.polarity}:${w.matters.join('+') || 'none'}`, [w.rowId], { from: w.from, to: w.to });
  }

  period(fact: string, p: PeriodSpan | null | undefined): this {
    if (!p) return this;
    this.claim(`${fact}:${p.lord}`, [p.evidence], { from: p.from, to: p.to });
    return this.date(p.from, p.to, fact);
  }

  risk(r: RiskRow): this {
    this.ledger.add(r.id);
    const range = r.since && r.until ? { from: r.since, to: r.until } : 'always';
    this.claim(`risk:${r.matter}:${r.what}`, r.evidence, range);
    if (r.until) this.date(r.until, r.until, `eases:${r.matter}`);
    for (const h of r.holds) this.promise.add(h);
    return this;
  }

  promiseEntry(e: PromiseEntry): this {
    this.promise.add(e.id);
    return this.claim(`${e.kind}:${e.matter}`, e.evidence);
  }

  keys(fact: string, evidence: readonly string[]): this {
    return this.claim(fact, evidence);
  }

  date(from: string | null | undefined, to: string | null | undefined, label: string): this {
    if (!from) return this;
    const t = to ?? from;
    if (!this.dates.some((d) => d.from === from && d.to === t && d.label === label)) this.dates.push({ from, to: t, label });
    return this;
  }

  build(): AreaBrief {
    return {
      areaId: this.area,
      horizon: this.horizon,
      claims: this.claims,
      dates: [...this.dates].sort((a, b) => a.from.localeCompare(b.from) || a.label.localeCompare(b.label)),
      ledgerRows: [...this.ledger],
      promiseEntries: [...this.promise],
      refreshStamp: refreshStamp(this.ctx, this.area),
    };
  }
}

/** risk rows in the order of the ledger's top3 first, then the rest by `until` */
export function riskRows(ctx: SelfBuildContext, filter: (r: RiskRow) => boolean = () => true): RiskRow[] {
  const led = ctx.sub.risk;
  if (!led) return [];
  const top = new Map(led.top3.map((id, i) => [id, i]));
  return led.rows.filter(filter).sort((a, b) => (top.get(a.id) ?? 99) - (top.get(b.id) ?? 99) || (a.until ?? '9999').localeCompare(b.until ?? '9999'));
}

export function promiseEntries(ctx: SelfBuildContext, filter: (e: PromiseEntry) => boolean = () => true): PromiseEntry[] {
  return (ctx.sub.promise?.entries ?? []).filter(filter);
}

export const inMatters = (ms: readonly Matter[]) => (x: { matter: Matter }) => ms.includes(x.matter);
