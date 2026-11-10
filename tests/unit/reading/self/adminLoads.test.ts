/**
 * Engine › Dashboard loads (docs/admin/12): the latest builds of a person's board with every agent run grouped under
 * them by time, the Oracle's status and error even when it failed, each agent's answer, and the build marker.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupRuns, loadsHandler, oracleOf, runOf, validationBuildsOf } from '../../../../src/routes/adminLoads.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const NOW = new Date('2026-11-09T05:30:00Z');
const T = (s: string) => new Date(s);

const dossiers: any[] = [
  {
    id: 'd-ok', created_at: T('2026-11-08T15:36:56Z'), as_of: T('2026-11-08T00:00:00Z'), valid_to: T('2026-11-11T00:00:00Z'), trigger: 'manual', clock: 'dwisatpathi', digest_version: 'd1',
    audit: { scope: 'body', verdict: 'pass', steps: { loadMs: 711.58, panelsMs: 78.53, oracleMs: 35341.65 } }, cost_usd: 0.084192,
    oracle: {
      status: 'ok', model: 'gemini-3.8-flash', ms: 35341.65, costUsd: 0.084192, tokens: { prompt: 119885, cached: 0, output: 8375, thought: 5990 }, dropped: 0,
      validator: { verdict: 'ok', issues: [] }, promptName: 'oracle/self', promptVersion: 'p9',
      stages: [
        { agentId: 'family.rasi', status: 'ok', cached: false, ms: 7250, promptTokens: 5281, cachedTokens: 0, outputTokens: 764, thoughtTokens: 1232, costUsd: 0.0043, summary: 'rasi…' },
        { agentId: 'lineman.self', status: 'ok', cached: false, ms: 7034, promptTokens: 43414, cachedTokens: 0, outputTokens: 1684, thoughtTokens: 0, costUsd: 0.0134, summary: 'brief…' },
        { agentId: 'self.reading_oracle', status: 'ok', cached: false, ms: 35341, promptTokens: 45110, cachedTokens: 0, outputTokens: 3552, thoughtTokens: 944, costUsd: 0.0507, summary: 'In short…' },
      ],
      text: '### In short\n\nYour life architecture…', linemanFindings: '- Jupiter in the 7th {planet:D1.Ju}', familyFindings: { 'family.rasi': 'rasi finding', 'family.varga': 'varga finding' },
      panelLines: { lagna: [{ text: 'a' }], body: [{ text: 'b' }, { text: 'c' }] }, panelPlans: {},
    },
    panels: [{ id: 'body', title: 'Your body', status: 'partial', cached: false, ms: 24, lead: 'lead', lines: [{ id: 'body.1', text: 'one' }, { id: 'body.ai.1', text: 'ai one' }], plan: { summary: 's', steps: [], calendar: [] } }],
    techniques: [{ id: 'self.reading.body', status: 'partial', cached: false, ms: 24 }], gaps: ['body: point:D9.KL missing'],
  },
  {
    id: 'd-failed', created_at: T('2026-11-09T05:20:40Z'), as_of: T('2026-11-09T00:00:00Z'), valid_to: T('2027-01-01T00:00:00Z'), trigger: 'request', clock: 'dwisatpathi', digest_version: 'd1',
    audit: { scope: 'all', verdict: 'pass', steps: { oracleMs: 177927.36 } }, cost_usd: 0,
    oracle: { status: 'failed', calls: 0 },
    panels: [{ id: 'diagnosis', title: 'In short', status: 'ok', cached: false, ms: 0.5, lead: '', lines: [{ id: 'diagnosis.1', text: 'Your sense of self is lived through partnership.' }] }],
    techniques: [], gaps: [],
  },
];

const runs: any[] = [
  { id: 'r1', agent_id: 'family.rasi', technique_id: 'self.reading.oracle', task: 'family.rasi 2026-11-08', status: 'ok', error: null, ms: 7250, model: 'gemini-3.1-flash-lite', prompt_tokens: 0, cached_tokens: 0, output_tokens: 0, thought_tokens: 0, est_cost_usd: null, started_at: T('2026-11-08T15:35:44Z'), ended_at: T('2026-11-08T15:35:51Z'), input_summary: { family: 'family.rasi' }, output_summary: { chars: 2772 }, charts_used: [] },
  { id: 'r2', agent_id: 'self.reading_oracle', technique_id: 'self.reading.oracle', task: 'self.reading.oracle 2026-11-08', status: 'ok', error: null, ms: 35324, model: 'gemini-3.8-flash', prompt_tokens: 0, cached_tokens: 0, output_tokens: 0, thought_tokens: 0, est_cost_usd: null, started_at: T('2026-11-08T15:36:21Z'), ended_at: T('2026-11-08T15:36:56Z'), input_summary: null, output_summary: { chars: 12847 }, charts_used: null },
  { id: 'r3', agent_id: 'lineman.self', technique_id: 'self.reading.oracle', task: 'lineman.self 2026-11-09', status: 'ok', error: null, ms: 7581, model: 'gemini-3.1-flash-lite', prompt_tokens: 0, cached_tokens: 0, output_tokens: 0, thought_tokens: 0, est_cost_usd: '0.013', started_at: T('2026-11-09T05:17:48Z'), ended_at: T('2026-11-09T05:17:56Z'), input_summary: null, output_summary: { chars: 1868 }, charts_used: null },
  { id: 'r4', agent_id: 'self.reading_oracle', technique_id: 'self.reading.oracle', task: 'self.reading.oracle 2026-11-09', status: 'failed', error: 'Gemini call timed out after 60000ms', ms: 163591, model: 'gemini-3.8-flash', prompt_tokens: 0, cached_tokens: 0, output_tokens: 0, thought_tokens: 0, est_cost_usd: null, started_at: T('2026-11-09T05:17:56Z'), ended_at: T('2026-11-09T05:20:40Z'), input_summary: null, output_summary: null, charts_used: null },
  { id: 'r5', agent_id: 'family.year', technique_id: 'self.reading.oracle', task: 'family.year 2026-11-09', status: 'ok', error: null, ms: 6000, model: 'gemini-3.1-flash-lite', prompt_tokens: 0, cached_tokens: 0, output_tokens: 0, thought_tokens: 0, est_cost_usd: null, started_at: T('2026-11-09T05:25:00Z'), ended_at: T('2026-11-09T05:25:06Z'), input_summary: null, output_summary: null, charts_used: null },
];

const prisma: any = {
  kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1' } : null) },
  readingDossier: { findMany: async ({ take }: any) => [...dossiers].sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, take) },
  agentRun: { findMany: async ({ where }: any) => runs.filter((r) => r.started_at >= where.started_at.gte) },
  areaBuild: { findUnique: async () => ({ status: 'failed', result: { started_at: '2026-11-09T05:17:39Z' }, error: 'oracle failed' }) },
  // the Self v2 validator findings (2026-11-09)
  readingValidationFailure: {
    findMany: async ({ where }: any) =>
      where.kundli_id === 'k1' && where.board === 'self'
        ? [
            { build_id: 'b2', created_at: T('2026-11-09T05:40:00Z'), stage: 'personalizer', area: 'stuck', check: 'chart_term', message: 'stuck: a body sentence dropped (chart term (Saturn))', area_status: null, model: 'gemini-3.8-flash', prompt_hash: 'pp', call_id: 'self.personalizer' },
            { build_id: 'b2', created_at: T('2026-11-09T05:39:00Z'), stage: 'oracle', area: 'mind', check: 'withheld', message: 'mind: withheld (no headline survived)', area_status: 'failed', model: 'gemini-3.8-flash', prompt_hash: 'po', call_id: 'oracle.repair' },
            { build_id: 'b2', created_at: T('2026-11-09T05:39:00Z'), stage: 'oracle', area: 'lagna', check: 'call_failed', message: 'lagna: oracle.b: mock timeout', area_status: 'repaired', model: 'gemini-3.8-flash', prompt_hash: 'po', call_id: 'oracle.b' },
            { build_id: 'b1', created_at: T('2026-11-08T15:30:00Z'), stage: 'oracle', area: 'body', check: 'date_not_stored', message: 'body: date x is not a stored span', area_status: 'ok', model: 'gemini-3.8-flash', prompt_hash: 'po', call_id: 'oracle.c' },
          ]
        : [],
  },
};

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  const app = express();
  app.get('/loads/:userId', loadsHandler({ prisma, now: () => NOW }));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe('GET loads/:userId', () => {
  it('404 without a kundli, 400 on an unknown board', async () => {
    expect((await fetch(`${base}/loads/u9`)).status).toBe(404);
    expect((await fetch(`${base}/loads/u1?board=money`)).status).toBe(400);
  });

  it('lists builds newest first with their runs grouped by time, the failed Oracle with its error, and the marker', async () => {
    const r = await fetch(`${base}/loads/u1?board=self&limit=5`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.userId).toBe('u1');
    expect(j.loads.map((l: any) => l.id)).toEqual(['d-failed', 'd-ok']);
    const failed = j.loads[0];
    expect(failed.oracle.status).toBe('failed');
    expect(failed.oracle.error).toBe('Gemini call timed out after 60000ms');
    expect(failed.steps.oracleMs).toBe(177927.36);
    expect(failed.runs.map((x: any) => x.id)).toEqual(['r3', 'r4']);
    expect(failed.runs[1]).toMatchObject({ agentId: 'self.reading_oracle', status: 'failed', ms: 163591, model: 'gemini-3.8-flash' });
    expect(failed.runs[0].costUsd).toBe(0.013);
    expect(failed.panels[0]).toMatchObject({ id: 'diagnosis', lines: 1, aiLines: 0, lineTexts: ['Your sense of self is lived through partnership.'] });
    const ok = j.loads[1];
    expect(ok.runs.map((x: any) => x.id)).toEqual(['r1', 'r2']);
    expect(ok.oracle).toMatchObject({ status: 'ok', model: 'gemini-3.8-flash', costUsd: 0.084192, text: '### In short\n\nYour life architecture…', linemanFindings: '- Jupiter in the 7th {planet:D1.Ju}', plans: 0 });
    expect(ok.oracle.familyFindings['family.varga']).toBe('varga finding');
    expect(ok.oracle.panelLines).toEqual({ lagna: 1, body: 2 });
    expect(ok.oracle.stages.map((s: any) => s.agentId)).toEqual(['family.rasi', 'lineman.self', 'self.reading_oracle']);
    expect(ok.oracle.tokens).toEqual({ prompt: 119885, cached: 0, output: 8375, thought: 5990 });
    expect(ok.panels[0]).toMatchObject({ id: 'body', status: 'partial', lines: 2, aiLines: 1, plan: true });
    expect(ok.gaps).toEqual(['body: point:D9.KL missing']);
    // the run after the newest dossier belongs to no build yet
    expect(j.unassignedRuns.map((x: any) => x.id)).toEqual(['r5']);
    expect(j.marker).toEqual({ state: 'failed_recently', status: 'failed', startedAt: '2026-11-09T05:17:39Z', error: 'oracle failed' });
    // the Self v2 builds' validator findings, newest build first
    expect(j.validation.map((b: any) => b.buildId)).toEqual(['b2', 'b1']);
    expect(j.validation[0]).toMatchObject({ repaired: ['lagna'], failed: ['mind'], counts: { oracle: 2, personalizer: 1 }, oracleAreas: { mind: 'failed', lagna: 'repaired' } });
    expect(j.validation[0].promptHashes.sort()).toEqual(['po', 'pp']);
    expect(j.validation[0].findings[1]).toEqual({ stage: 'oracle', area: 'mind', check: 'withheld', message: 'mind: withheld (no headline survived)', areaStatus: 'failed', callId: 'oracle.repair' });
  });
});

describe('grouping and mapping', () => {
  it('groupRuns puts a run under the first dossier written at or after its end, with slack', () => {
    const ds = [{ id: 'b', createdAt: '2026-11-09T05:20:40.000Z' }, { id: 'a', createdAt: '2026-11-08T15:36:56.000Z' }];
    const rs = [
      runOf({ id: 'x', agent_id: 'a1', started_at: T('2026-11-08T15:36:21Z'), ended_at: T('2026-11-08T15:36:58Z') }),
      runOf({ id: 'y', agent_id: 'a1', started_at: T('2026-11-09T05:17:48Z'), ended_at: T('2026-11-09T05:17:56Z') }),
      runOf({ id: 'z', agent_id: 'a1', started_at: T('2026-11-09T05:30:00Z'), ended_at: T('2026-11-09T05:30:01Z') }),
    ];
    const g = groupRuns(ds, rs);
    expect(g.byDossier.get('a')!.map((r) => r.id)).toEqual(['x']);
    expect(g.byDossier.get('b')!.map((r) => r.id)).toEqual(['y']);
    expect(g.unassigned.map((r) => r.id)).toEqual(['z']);
  });
  it('validationBuildsOf groups findings per build, its earliest time first, and skips rows with no build id', () => {
    const v = validationBuildsOf([
      { build_id: 'x', created_at: T('2026-11-09T05:39:10Z'), stage: 'oracle', area: 'yogas', check: 'missing_area', message: 'm', area_status: 'repaired' },
      { build_id: 'x', created_at: T('2026-11-09T05:39:00Z'), stage: 'oracle', area: 'year', check: 'json_schema', message: 'm', area_status: 'failed' },
      { build_id: '', stage: 'oracle' },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ buildId: 'x', createdAt: '2026-11-09T05:39:00.000Z', repaired: ['yogas'], failed: ['year'] });
  });
  it('oracleOf keeps a stored error over a run error, and returns null without a status', () => {
    expect(oracleOf(null, [])).toBeNull();
    expect(oracleOf({ status: 'failed', error: 'stored' }, [runOf({ agent_id: 'self.reading_oracle', status: 'failed', error: 'run' })])!.error).toBe('stored');
    expect(oracleOf({ status: 'pending' }, [])!.status).toBe('pending');
  });
});
