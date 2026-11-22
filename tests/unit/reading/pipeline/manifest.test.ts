/**
 * The manifest and the one status (docs/techniques/11 rev 4 §4.2). The fixture is modelled on the test chart's three real
 * holes: a failed dated clock row the old check never retried (`kaala`), a dasha system stored with level 1 only
 * (Kalachakra), a dasha system with a hole in its level-1 periods that includes today (Aayu).
 */
import { describe, expect, it } from 'vitest';
import type { ChartDataType } from '../../../../src/reading/chartData/catalog.js';
import { buildManifest, dashaHoles, PIPELINE_GIVE_UP_FAILURES, verdictOf, type ActivationSpan, type ManifestInput, type StoredStatusRow } from '../../../../src/reading/pipeline/manifest.js';
import { computePipeline, pipelineView, readPipelineRow, recomputePipeline, writePipelineRow, type PipelineContext } from '../../../../src/reading/pipeline/status.js';
import { PIPELINE_STAGES, STAGE_LINES } from '../../../../src/reading/pipeline/types.js';
import { parseApplicability } from '../../../../src/reading/self/clock.js';

const NOW = new Date('2026-11-22T10:00:00Z');

const t = (id: string, o: Partial<ChartDataType> = {}): ChartDataType => ({
  id,
  family: 'dasha' as ChartDataType['family'],
  radhaType: id,
  changeClass: 'natal',
  tier: 'registration',
  variantKind: 'natal',
  served: true,
  calcVersion: null,
  sortOrder: 500,
  label: id,
  ...o,
});

const GATE = [t('varga.d1', { tier: 'first', legacyColumn: 'd1' }), t('varga.d9', { legacyColumn: 'd9' }), t('dasha.vimsottari', { legacyColumn: 'vimsottari_dasa' }), t('dasha.narayana', { legacyColumn: 'narayana_dasa' })];
const REST = [
  t('dasha.applicable'),
  t('dasha.kalachakra'),
  t('dasha.aayu'),
  t('dasha.ashtottari'),
  t('annual.tithi_pravesha', { changeClass: 'annual', variantKind: 'year' }),
];

const ready = (dataType: string, variant = ''): StoredStatusRow => ({ dataType, variant, status: 'ready', calcVersion: null, error: null, fetchStartedAt: NOW, fetchedAt: NOW, validTo: null });

function rows(): StoredStatusRow[] {
  return [
    ...GATE.map((x) => ready(x.id)),
    ready('dasha.applicable'),
    ready('dasha.kalachakra'),
    ready('dasha.aayu'),
    ready('dasha.ashtottari'),
    ready('annual.tithi_pravesha', 'current'),
    ready('pressure_inventory', 'system=vimsottari'),
    // the kaala clock row: failed on 10 Nov, the engine's refusal, never asked again by the old count-only check
    { dataType: 'pressure_inventory', variant: 'system=kaala', status: 'failed', calcVersion: null, error: 'validation_error: Invalid export type: pressure_inventory', fetchStartedAt: new Date('2026-11-10T00:38:08Z'), fetchedAt: new Date('2026-11-10T00:38:08Z'), validTo: null },
  ];
}

const span = (system: string, level: number, from: string, to: string): ActivationSpan => ({ system, level, from, to });

function spans(): ActivationSpan[] {
  return [
    span('vimsottari', 1, '2016-03-16', '2028-03-16'),
    span('vimsottari', 1, '2028-03-16', '2047-03-16'),
    span('vimsottari', 2, '2025-01-01', '2027-01-01'),
    span('vimsottari', 2, '2028-03-16', '2031-03-16'),
    span('narayana', 1, '2018-10-15', '2027-10-15'),
    span('narayana', 1, '2027-10-15', '2035-10-15'),
    span('narayana', 2, '2026-01-01', '2026-12-31'),
    span('narayana', 2, '2027-10-15', '2028-06-15'),
    // Kalachakra: level 1 only, for life
    span('kalachakra', 1, '2017-02-18', '2026-02-18'),
    span('kalachakra', 1, '2026-02-18', '2031-02-18'),
    span('kalachakra', 1, '2031-02-18', '2052-02-19'),
    // Aayu: no period from 2016-10-22 to 2027-12-13
    span('aayu', 1, '2006-05-08', '2016-10-22'),
    span('aayu', 1, '2027-12-13', '2036-07-20'),
    span('aayu', 2, '2006-05-08', '2010-01-01'),
    span('aayu', 2, '2027-12-13', '2030-01-01'),
  ];
}

function input(over: Partial<ManifestInput> = {}): ManifestInput {
  return {
    now: NOW,
    requested: [...GATE, ...REST],
    gate: GATE,
    rows: rows(),
    applicability: parseApplicability([{ type: 'dasha.ashtottari', applies: false, checked: true }]),
    digestStatus: 'ready',
    spans: spans(),
    levels: new Map([
      ['vimsottari', new Set([1, 2, 3, 4])],
      ['narayana', new Set([1, 2, 3])],
      ['kalachakra', new Set([1])],
      ['aayu', new Set([1, 2, 3])],
    ]),
    clockSet: ['vimsottari', 'narayana'],
    annualYearKeys: [],
    requiredDashas: ['vimsottari', 'narayana'],
    yearsAhead: 30,
    ...over,
  };
}

const ctx = (o: Partial<PipelineContext> = {}): PipelineContext => ({ digestStatus: 'ready', leaseHeld: false, anyRows: true, syncFailed: false, ...o });

describe('the manifest on the three holes of the test chart', () => {
  it('reports "complete with named gaps" and names kaala, Kalachakra and Aayu', () => {
    const s = computePipeline(input(), ctx());
    expect(s.verdict).toBe('complete_with_gaps');
    expect(s.verdicts.chat).toBe('complete');
    expect(s.verdicts.pass1).toBe('complete_with_gaps');
    expect(s.stage).toBe('ready');
    const named = s.gaps.map((g) => `${g.id}:${g.code}`);
    expect(named).toContain('pressure_inventory@system=kaala:clock_failed');
    expect(named).toContain('dasha:kalachakra:level_1_only');
    expect(named).toContain('dasha:aayu:no_running_period');
    expect(s.gaps.find((g) => g.id === 'dasha:aayu')?.detail).toBe('no period from 2016-10-22 to 2027-12-13');
    // the failed clock is named and still asked again (not given up after one failure)
    expect(s.gaps.find((g) => g.id === 'pressure_inventory@system=kaala')?.givenUp).toBe(false);
    // none of the three is required: the chart is ready with them named
    expect(s.gaps.every((g) => !g.required)).toBe(true);
    // a system the engine says does not apply is not checked at all
    expect(s.items.some((x) => x.id === 'dasha:ashtottari')).toBe(false);
    // a clock of the set not pulled yet is filling, not a gap
    expect(s.items.find((x) => x.id === 'pressure_inventory@system=narayana')?.state).toBe('filling');
  });

  it('a failed required row makes the chart incomplete and blocked', () => {
    const r = rows().map((x) => (x.dataType === 'varga.d9' ? { ...x, status: 'failed', error: '[failures=2 engine=- digest=d1] boom' } : x));
    const s = computePipeline(input({ rows: r }), ctx());
    expect(s.verdict).toBe('incomplete');
    expect(s.verdicts.chat).toBe('incomplete');
    expect(s.stage).toBe('blocked');
    expect(s.gaps[0]).toMatchObject({ id: 'varga.d9', code: 'failed', required: true, givenUp: false });
  });

  it('a hole in a required voice (the star voice) is incomplete, a hole elsewhere is a named gap', () => {
    const sp = spans().filter((x) => !(x.system === 'vimsottari' && x.level === 1 && x.from === '2016-03-16'));
    const s = computePipeline(input({ spans: sp }), ctx());
    expect(s.verdict).toBe('incomplete');
    expect(s.gaps.find((g) => g.id === 'dasha:vimsottari')).toMatchObject({ code: 'no_running_period', required: true });
  });

  it('a row failed PIPELINE_GIVE_UP_FAILURES times is given up and named', () => {
    const r = rows().map((x) => (x.variant === 'system=kaala' ? { ...x, error: `[failures=${PIPELINE_GIVE_UP_FAILURES} engine=- digest=d1] validation_error` } : x));
    const s = computePipeline(input({ rows: r }), ctx());
    expect(s.gaps.find((g) => g.id === 'pressure_inventory@system=kaala')).toMatchObject({ code: 'clock_failed', givenUp: true });
    expect(s.verdict).toBe('complete_with_gaps');
  });

  it('stages before ready: registered, pulling, checking (digest not built), chart_ready (digest building)', () => {
    expect(computePipeline(input({ rows: [] }), ctx({ anyRows: false })).stage).toBe('registered');
    const missing = rows().filter((x) => x.dataType !== 'varga.d9');
    expect(computePipeline(input({ rows: missing }), ctx({ leaseHeld: true })).stage).toBe('pulling');
    const pending = computePipeline(input({ digestStatus: 'pending' }), ctx({ digestStatus: 'pending' }));
    expect(pending.stage).toBe('checking');
    expect(pending.items.filter((x) => x.kind === 'dasha').every((x) => x.state === 'waiting')).toBe(true);
    expect(computePipeline(input({ digestStatus: 'building' }), ctx({ digestStatus: 'building' })).stage).toBe('chart_ready');
    // a failed sync with nothing pulled is blocked, not "registered"
    expect(computePipeline(input({ rows: [] }), ctx({ anyRows: false, syncFailed: true })).stage).toBe('blocked');
  });

  it('dashaHoles: the next period and its sub-periods', () => {
    const sp = [span('x', 1, '2020-01-01', '2030-01-01'), span('x', 1, '2030-01-01', '2040-01-01'), span('x', 2, '2025-01-01', '2027-01-01')];
    expect(dashaHoles('x', sp, new Set([1, 2, 3]), '2026-11-22', '2056-11-22')).toEqual([{ code: 'no_sub_periods_next', detail: 'next 2030-01-01 to 2040-01-01' }]);
    expect(dashaHoles('x', sp.slice(0, 1).concat(sp[2]!), new Set([1, 2, 3]), '2026-11-22', '2056-11-22')).toEqual([{ code: 'no_next_period', detail: 'nothing stored after 2030-01-01' }]);
    // a running period that outlasts the calendar has no next one stored, and that is not a hole
    expect(dashaHoles('x', [span('x', 1, '2020-01-01', '2070-01-01'), span('x', 2, '2025-01-01', '2027-01-01')], new Set([1, 2, 3]), '2026-11-22', '2056-11-22')).toEqual([]);
    expect(verdictOf([])).toBe('complete');
  });
});

describe('the person-facing line', () => {
  it('is one plain sentence per stage and never names the engine', () => {
    for (const stage of PIPELINE_STAGES) {
      const v = pipelineView(stage, 1, 2, { locked: true, reason: 'chart' });
      expect(v.line).toBe(STAGE_LINES[stage]);
      expect(v.line).not.toMatch(/radha|pyjhora|jhora|engine/i);
    }
    expect(STAGE_LINES.ready).toBe('Your chart is ready. Choose your cards.');
    expect(STAGE_LINES.pulling).toBe('Getting your chart');
    expect(STAGE_LINES.checking).toBe('Checking everything arrived');
    expect(STAGE_LINES.chart_ready).toBe('Reading your chart');
    expect(STAGE_LINES.blocked).toBe('Some of the calculations did not finish. We are trying again.');
    // a gap's detail never carries the engine's own message
    const s = computePipeline(input(), ctx());
    for (const g of s.gaps) expect(JSON.stringify(g)).not.toMatch(/radha|pyjhora|jhora|Invalid export type/i);
  });
});

describe('the stored row (M56 may not be applied)', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  it('a missing table is skipped: read gives null, write gives false, nothing throws', async () => {
    const missing = Object.assign(new Error('relation "kundli_pipeline" does not exist'), { code: 'P2021' });
    const prisma: any = { kundliPipeline: { findUnique: async () => { throw missing; }, upsert: async () => { throw missing; } } };
    expect(await readPipelineRow(prisma, 'k1')).toBeNull();
    expect(await writePipelineRow(prisma, 'k1', computePipeline(input(), ctx()), NOW)).toBe(false);
  });

  it('recompute reads the stored rows, writes one row, and never throws on a broken client', async () => {
    const written: any[] = [];
    const prisma: any = {
      kundli: { findUnique: async () => ({ digest_status: 'ready', queue_started_at: null, last_sync_error: null }) },
      kundliData: {
        findMany: async ({ where }: any) => {
          const all = rows().map((r) => ({ data_type: r.dataType, variant: r.variant, status: r.status, calc_version: null, fetch_started_at: r.fetchStartedAt, fetched_at: r.fetchedAt, valid_to: null, error: r.error }));
          return where.status ? all.filter((r) => r.status === where.status) : all;
        },
        findFirst: async () => ({ payload: [{ type: 'dasha.ashtottari', applies: false }] }),
      },
      kundliActivation: {
        findMany: async () => spans().map((x) => ({ system: x.system, level: x.level, from_date: new Date(`${x.from}T00:00:00Z`), to_date: new Date(`${x.to}T00:00:00Z`) })),
        groupBy: async () => [
          { system: 'vimsottari', level: 1 }, { system: 'vimsottari', level: 2 }, { system: 'vimsottari', level: 3 },
          { system: 'narayana', level: 1 }, { system: 'narayana', level: 2 }, { system: 'narayana', level: 3 },
          { system: 'kalachakra', level: 1 },
          { system: 'aayu', level: 1 }, { system: 'aayu', level: 2 }, { system: 'aayu', level: 3 },
        ],
      },
      kundliPipeline: { upsert: async (q: any) => { written.push(q); } },
    };
    const s = await recomputePipeline(prisma, 'k1', { now: NOW, trigger: 'script', deps: { plan: async () => ({ requested: [...GATE, ...REST], gate: GATE }), clockSet: async () => ['vimsottari'] } });
    expect(s?.verdict).toBe('complete_with_gaps');
    expect(written).toHaveLength(1);
    expect(written[0].create).toMatchObject({ kundli_id: 'k1', stage: 'ready', verdict: 'complete_with_gaps' });
    expect(await recomputePipeline({} as any, 'k1', { now: NOW, trigger: 'script' })).toBeNull();
  });
});
