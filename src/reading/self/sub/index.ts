/**
 * The Self v2 build's Layer 0 load and Layer 1 run (docs/reading-engine/66 §4.8, AGENTS.md "Board and technique
 * machinery" rule 1). Loads the engine rows once (digest, activation on the primary clock and its confirming clocks with
 * level 3 near asOf, the stored sky overlay, the systems present, the profile), runs S1 → (S2 S3 S4 S6 S8 S9 S10) → S5,
 * S7 over one `SelfBuildContext`, stamps the context with what can make each output stale, and times every step. Each
 * sub-technique is a `withAgentRun` span tagged `self.sub.<name>` and the kundli; summaries hold counts and ids only.
 * A failing sub-technique leaves its slot empty and records a gap; the others still run.
 */
import { createHash } from 'node:crypto';
import { withAgentRun, type ChartUsed } from '../../../agents/registry.js';
import { activationFor as realActivationFor, type ActivationRow } from '../../digest/activation.js';
import { loadDigest as realLoadDigest } from '../../digest/load.js';
import type { DigestView } from '../../digest/types.js';
import type { TransitRangePayload } from '../../chartData/transitRange.js';
import { defaultLoadTransit } from '../../area/boardService.js';
import { addMonthsIso } from '../../timeline/months.js';
import { defaultSystemsPresent, type SelfDeps } from '../service.js';
import { gaps } from '../slices.js';
import type { ClockResolution, PeriodFrame, PromiseLedger, SelfBuildContext, SelfBuildStamps, WindowSetDetail } from '../v2types.js';
import type { SubEnv } from './common.js';
import { subClock } from './clock.js';
import { subPeriods } from './periods.js';
import { subWindows } from './windows.js';
import { subPromise } from './promise.js';
import { subRisk } from './risk.js';
import { subMindFacts } from './mind.js';
import { subBodyFacts } from './body.js';
import { subPresenceFacts } from './presence.js';
import { subYear } from './year.js';
import { subProfile } from './profile.js';
import { isoWeek } from './config.js';
import { loadPressureInventory as realLoadPressure, type PressureInventoryDetail, type PressureLoad } from './pressure.js';

export interface SelfV2Deps extends Pick<SelfDeps, 'prisma' | 'loadDigest' | 'activationFor' | 'systemsPresent' | 'loadTransit' | 'now'> {
  /** the engine's pressure inventory on the primary clock (default: kundli_data, pulled when missing or older than 7 days) */
  loadPressure?: (prisma: SelfDeps['prisma'], kundliId: string, system: string, asOf: string) => Promise<PressureLoad>;
}
export interface SelfV2Loaded { view: DigestView; activation: ActivationRow[]; sky: TransitRangePayload | null; preferred: string | null; pressure?: PressureInventoryDetail | null }
export interface SelfV2SubResult { ctx: SelfBuildContext; loaded: SelfV2Loaded; gaps: string[]; ms: Record<string, number> }

/** the code agent the spans run under (`self.sub`, src/agents/registry.ts) */
const SUB_AGENT = 'self.sub';
/** level 3 is read for the primary clock in asOf −12 m … +12 m (S3's "started in the last year" and the strip) */
const SHORT_MONTHS = 12;

/** catalogue ids are lower snake case (tests/unit/techniques/catalog.test.ts): mindFacts → self.sub.mind_facts */
export const subTechniqueId = (name: string): string => `self.sub.${name.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`)}`;
const round = (ms: number) => Math.round(ms * 100) / 100;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

export async function runSelfSubTechniques(
  deps: SelfV2Deps,
  args: { userId: string; kundliId: string; asOf: string },
): Promise<SelfV2SubResult | { status: 'preparing' }> {
  const { prisma } = deps;
  const { userId, kundliId, asOf } = args;
  const ms: Record<string, number> = {};
  const g = gaps();
  const t0 = performance.now();

  // Layer 0: one read per table
  const view = await (deps.loadDigest ?? realLoadDigest)(prisma, kundliId);
  if (!view) return { status: 'preparing' };
  const [kundli, present, sky] = await Promise.all([
    prisma.kundli.findUnique({ where: { id: kundliId }, select: { preferred_dasha: true } }).catch(() => null),
    (deps.systemsPresent ?? defaultSystemsPresent)(prisma, kundliId),
    (deps.loadTransit ?? defaultLoadTransit)(prisma, kundliId, asOf).catch(() => null),
  ]);
  const preferred = kundli?.preferred_dasha ?? null;
  ms.load = round(performance.now() - t0);

  const span = async <T>(name: string, charts: ChartUsed[], fn: () => T | Promise<T>, summary: (v: T) => Record<string, unknown>): Promise<T | undefined> => {
    const t = performance.now();
    try {
      return await withAgentRun(
        prisma,
        SUB_AGENT,
        { userId, task: `${subTechniqueId(name)} ${asOf}`, technique: subTechniqueId(name), kundliId, input: { version: view.version, step: name }, charts },
        async () => {
          const value = await fn();
          return { value, output: summary(value) };
        },
      );
    } catch (e) {
      g.add(`${subTechniqueId(name)} failed: ${(e as Error).message}`);
      return undefined;
    } finally {
      ms[name] = round(performance.now() - t);
    }
  };
  const digestCharts = (sections: string[]): ChartUsed[] => sections.map((s) => ({ type: `digest.${s}`, variant: view.version }));

  // S1, then the activation read on its clock
  const clock = (await span('clock', [{ type: 'kundli_activation', variant: preferred ?? 'default' }], () => subClock(preferred, present, g), (c: ClockResolution) => ({
    confirming: c.confirming.length,
    applicable: c.applicable.length,
    notApplicable: c.notApplicable.length,
  }))) as ClockResolution | undefined;
  if (!clock) return { status: 'preparing' };

  const t1 = performance.now();
  const systems = [...new Set([clock.primary, ...clock.confirming])];
  // the engine's pressure inventory on the primary clock, beside the activation read; a failed pull is a gap, never a stop
  const pressureP = (deps.loadPressure ?? ((p, k, s, a) => realLoadPressure(p, k, s, a)))(prisma, kundliId, clock.primary, asOf).catch(
    (e: Error): PressureLoad => ({ inventory: null, source: 'none', gaps: [`pressure_inventory: ${e.message?.slice(0, 120)}`] }),
  );
  const activation = await (deps.activationFor ?? realActivationFor)(prisma, kundliId, {
    from: addMonthsIso(asOf, -12 * 90),
    to: addMonthsIso(asOf, 12 * 40),
    systems,
    maxLevel: 2,
    shortFrom: addMonthsIso(asOf, -SHORT_MONTHS),
    shortTo: addMonthsIso(asOf, SHORT_MONTHS),
    shortSystems: [clock.primary],
    shortMaxLevel: 3,
  });
  const pressureLoad = await pressureP;
  for (const x of pressureLoad.gaps) g.add(x);
  const pressure = pressureLoad.inventory && pressureLoad.inventory.clock === clock.primary ? pressureLoad.inventory : null;
  if (pressureLoad.inventory && !pressure) g.add(`pressure_inventory: stored for ${pressureLoad.inventory.clock}, not the primary clock ${clock.primary}; not used`);
  ms.activation = round(performance.now() - t1);

  const env: SubEnv = { view, activation, sky, asOf, g, pressure };
  const actCharts: ChartUsed[] = [{ type: 'kundli_activation', variant: clock.primary }];
  const skyCharts: ChartUsed[] = sky ? [{ type: 'kundli_transit_overlays', variant: `${sky.from}..${sky.to}` }] : [];
  const pressureCharts: ChartUsed[] = pressure ? [{ type: 'pressure_inventory', variant: `system=${pressure.clock}@${pressure.asOf}` }] : [];

  // S2 ∥ S3 ∥ S4 ∥ S6 ∥ S8 ∥ S9 ∥ S10 (S8 reads S2's running sub, so it follows S2 inside its branch)
  const s2Then8 = (async () => {
    const periods = (await span('periods', [...actCharts, ...digestCharts(['planet'])], () => subPeriods(env, clock), (p: PeriodFrame | null) => ({
      found: p ? 1 : 0,
      boundaries: p?.boundaries.length ?? 0,
      rel: p?.subRelation ?? null,
    }))) ?? null;
    const presence = await span('presenceFacts', [...actCharts, ...digestCharts(['house', 'planet', 'point'])], () => subPresenceFacts(env, clock, periods), (p) => ({
      keys: p.bearing.length + p.style.length + p.adornment.length + p.face.length + p.publicVsPrivate.length,
      best: p.bestWindow ? 1 : 0,
      care: p.liveCare ? 1 : 0,
    }));
    return { periods, presence };
  })();
  const [{ periods, presence }, windows, promise, mind, year, profile] = await Promise.all([
    s2Then8,
    span('windows', pressure ? pressureCharts : [...actCharts, ...skyCharts, ...digestCharts(['planet'])], () => subWindows(env, clock), (w: WindowSetDetail) => ({
      rows: w.rows.length,
      strip: w.strip.length,
      heaviest: w.heaviestNow?.rowId ?? null,
      degraded: w.degraded,
    })),
    span('promise', digestCharts(['yoga', 'planet']), () => subPromise(env), (p: PromiseLedger) => ({
      entries: p.entries.length,
      gifts: p.entries.filter((e) => e.kind === 'gift').length,
      knots: p.entries.filter((e) => e.kind === 'knot').length,
      graces: p.entries.filter((e) => e.kind === 'grace').length,
    })),
    span('mindFacts', digestCharts(['house', 'planet', 'yoga', 'star']), () => subMindFacts(env), (m) => ({
      keys: m.feeling.length + m.thinking.length + m.peace.length + m.judgement.length,
      patterns: m.candidatePatterns.length,
    })),
    span('year', digestCharts(['annual']), () => subYear(env), (y) => ({ noCoverage: y.noCoverage, lord: y.shortClock?.lord ?? null })),
    span('profile', [], () => subProfile(prisma, userId, asOf), (p) => ({ band: p.ageBand, role: p.role, declined: p.declined.length, confirms: p.lastConfirms.length, profileHash: p.hash })),
  ]);

  // S5 and S7 need S2, S3 and S4
  const [risk, body] = await Promise.all([
    windows && promise
      ? span('risk', [...actCharts, ...skyCharts], () => subRisk(asOf, periods, windows, promise, g), (r) => ({ rows: r.rows.length, top3: r.top3 }))
      : Promise.resolve(undefined),
    windows
      ? span('bodyFacts', [...actCharts, ...skyCharts, ...digestCharts(['house', 'planet', 'point'])], () => subBodyFacts(env, clock, windows), (b) => ({
          keys: b.footing.length + b.wear.length + b.shape.length,
          liveLords: b.liveLords.length,
          liveTransits: b.liveTransits.length,
          sensitive: b.sensitive,
        }))
      : Promise.resolve(undefined),
  ]);
  if (!windows || !promise) g.add('risk: skipped, windows or promise missing');
  if (!windows) g.add('bodyFacts: skipped, windows missing');

  const stamps: SelfBuildStamps = {
    digestVersion: view.version,
    clock: clock.primary,
    mainPeriod: periods?.running.evidence ?? null,
    subPeriod: periods?.runningSub?.evidence ?? null,
    subSubPeriod: periods?.runningSubSub?.evidence ?? null,
    skyWeek: sky ? isoWeek(sky.from) : null,
    year: year && !year.noCoverage ? `${year.from}..${year.to}` : null,
    profileHash: profile?.hash ?? null,
    confirmHash: profile ? hash(profile.lastConfirms.map((c) => [c.claimId, c.answer])) : null,
  };
  const ctx: SelfBuildContext = {
    userId,
    kundliId,
    asOf,
    stamps,
    sub: {
      clock,
      ...(periods ? { periods } : {}),
      ...(windows ? { windows } : {}),
      ...(promise ? { promise } : {}),
      ...(risk ? { risk } : {}),
      ...(mind ? { mind } : {}),
      ...(body ? { body } : {}),
      ...(presence ? { presence } : {}),
      ...(year ? { year } : {}),
      ...(profile ? { profile } : {}),
    },
  };
  ms.total = round(performance.now() - t0);
  return { ctx, loaded: { view, activation, sky, preferred, pressure }, gaps: g.list, ms };
}
