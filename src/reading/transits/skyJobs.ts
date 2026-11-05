/**
 * The two jobs that replace "build transit charts for every user" (docs/reading-engine/35):
 *
 * - `extendSharedSky`: the sky for a place over whole calendar years. Same for every user, fetched once, no person in it.
 * - `pullKundliOverlay`: one kundli's own answer (houses from lagna and Moon) over the same years, fetched once per
 *   kundli and span. Radha computes the houses; nothing here does.
 *
 * Years are whole calendar years so a repeat of the same job hits the same keys. Nothing here computes astrology.
 */
import type { AtPlace } from '../chartData/place.js';
import { fetchTransitRange, type TransitRangeOptions, type TransitRangePayload } from '../chartData/transitRange.js';
import { getKundliOverlay, getSharedRange, overlayParamsKey, prismaEphemerisRepo, rangeKey, type EphemerisDeps, type EphemerisRepo } from './ephemerisCache.js';

export type SkyStep = 'month' | 'day';

export interface YearChunk {
  from: string;
  to: string;
}

/** Whole calendar years covering from..to, as 'YYYY-01-01'..'YYYY-12-31'. Only the years of from and to are used. */
export function yearChunks(from: string, to: string): YearChunk[] {
  const y0 = Number(from.slice(0, 4));
  const y1 = Number(to.slice(0, 4));
  if (!Number.isInteger(y0) || !Number.isInteger(y1) || y1 < y0) throw new Error(`yearChunks: need from <= to as YYYY-MM-DD, got ${from}..${to}`);
  if (y1 - y0 > 60) throw new Error('yearChunks: more than 60 years in one job');
  const out: YearChunk[] = [];
  for (let y = y0; y <= y1; y++) out.push({ from: `${y}-01-01`, to: `${y}-12-31` });
  return out;
}

export interface SkyJobReport {
  chunks: Array<{ from: string; to: string; state: 'cached' | 'fetched' | 'missing' | 'failed'; error?: string }>;
  engineCalls: number;
}

export interface SkyJobOptions {
  from: string;
  to: string;
  step: SkyStep;
  /** Report what would be fetched and call nothing */
  dryRun?: boolean;
}

async function repoOf(deps: EphemerisDeps): Promise<EphemerisRepo> {
  if (deps.repo) return deps.repo;
  const { prisma } = await import('../../lib/prisma.js');
  return prismaEphemerisRepo(prisma);
}

/** Make sure the shared sky exists for the place over whole years. A failed year does not stop the others. */
export async function extendSharedSky(place: AtPlace, job: SkyJobOptions, deps: EphemerisDeps = {}): Promise<SkyJobReport> {
  const report: SkyJobReport = { chunks: [], engineCalls: 0 };
  const repo = await repoOf(deps);
  for (const c of yearChunks(job.from, job.to)) {
    const opts: TransitRangeOptions = { ...c, step: job.step };
    if (job.dryRun) {
      const hit = await repo.getRange(rangeKey(opts, place)).catch(() => null);
      report.chunks.push({ ...c, state: hit ? 'cached' : 'missing' });
      continue;
    }
    try {
      const r = await getSharedRange(opts, place, { ...deps, repo });
      if (r.source === 'radha') report.engineCalls++;
      report.chunks.push({ ...c, state: r.source === 'cache' ? 'cached' : 'fetched' });
    } catch (err) {
      report.chunks.push({ ...c, state: 'failed', error: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  }
  return report;
}

export interface OverlayJobOptions extends SkyJobOptions {
  planets?: TransitRangeOptions['planets'];
}

export interface OverlayDeps extends EphemerisDeps {
  fetchOverlay?: (kundliId: string, opts: TransitRangeOptions) => Promise<TransitRangePayload>;
}

/** One kundli's own houses over whole years, stored once per kundli and span. */
export async function pullKundliOverlay(kundliId: string, job: OverlayJobOptions, deps: OverlayDeps = {}): Promise<SkyJobReport> {
  const report: SkyJobReport = { chunks: [], engineCalls: 0 };
  const repo = await repoOf(deps);
  for (const c of yearChunks(job.from, job.to)) {
    const opts: TransitRangeOptions = { ...c, step: job.step, ...(job.planets ? { planets: job.planets } : {}) };
    const span = { ...c, step: job.step, ...(job.planets ? { planets: job.planets } : {}) };
    if (job.dryRun) {
      const hit = await repo.getOverlay({ kundliId, kind: 'range', paramsKey: overlayParamsKey(span) }).catch(() => null);
      report.chunks.push({ ...c, state: hit ? 'cached' : 'missing' });
      continue;
    }
    try {
      const r = await getKundliOverlay(kundliId, 'range', span, () => (deps.fetchOverlay ?? ((k, o) => fetchTransitRange(k, o)))(kundliId, opts), { ...deps, repo });
      if (r.source === 'radha') report.engineCalls++;
      report.chunks.push({ ...c, state: r.source === 'cache' ? 'cached' : 'fetched' });
    } catch (err) {
      report.chunks.push({ ...c, state: 'failed', error: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  }
  return report;
}

export function formatReport(title: string, r: SkyJobReport): string {
  const tally: Record<string, number> = {};
  for (const c of r.chunks) tally[c.state] = (tally[c.state] ?? 0) + 1;
  const lines = r.chunks.map((c) => `  ${c.from}..${c.to}  ${c.state}${c.error ? '  ' + c.error : ''}`);
  return [`${title}: ${JSON.stringify(tally)}, engine calls ${r.engineCalls}`, ...lines].join('\n');
}
