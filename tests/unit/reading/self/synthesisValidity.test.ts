import { describe, expect, it } from 'vitest';
import { latestStoredOutput } from '../../../../src/techniques/outputStore.js';
import { synthesisValidity } from '../../../../src/reading/self/synthesisValidity.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function store(rows: any[]) {
  const asked: any[] = [];
  const prisma: any = {
    techniqueOutput: {
      findFirst: async (q: any) => {
        asked.push(q);
        return rows
          .filter((r) => r.technique_id === q.where.technique_id && r.kundli_id === q.where.kundli_id && (!q.where.digest_version || r.digest_version.includes(q.where.digest_version.contains)))
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null;
      },
    },
  };
  return { prisma, asked };
}
const row = (o: any) => ({ technique_id: 'self.reading.oracle', kundli_id: 'k1', digest_version: 'v|board=self|scope=all|x', valid_from: new Date('2026-10-01T00:00:00Z'), valid_to: new Date('2026-12-01T00:00:00Z'), ...o });

describe('offline first: the newest synthesis and its own dates (docs/billing/03)', () => {
  it('serves the newest synthesis made for the board, whatever its key or window', async () => {
    const { prisma, asked } = store([
      row({ created_at: new Date('2026-10-01T09:00:00Z'), output: { status: 'ok', text: 'old' } }),
      row({ created_at: new Date('2026-10-20T09:00:00Z'), output: { status: 'ok', text: 'newer' }, digest_version: 'v2|board=self|scope=all|y' }),
      row({ created_at: new Date('2026-10-25T09:00:00Z'), output: { status: 'ok', text: 'lab' }, digest_version: 'v2|board=self|scope=diagnosis|y' }),
    ]);
    const last = await latestStoredOutput<any>(prisma, { techniqueId: 'self.reading.oracle', kundliId: 'k1', digestContains: '|board=self|scope=all|' });
    expect(last?.value.text).toBe('newer');
    expect(asked[0].orderBy).toEqual({ created_at: 'desc' });
    expect(await latestStoredOutput(prisma, { techniqueId: 'self.reading.oracle', kundliId: 'k2' })).toBeNull();
  });

  it('the last good day is the one the synthesis said, else its window; due only after it', async () => {
    const said = store([row({ created_at: new Date('2026-10-20T09:00:00Z'), output: { status: 'ok', validUntil: { overall: '2026-11-03' } } })]);
    expect(await synthesisValidity(said.prisma, 'k1', 'self', '2026-11-03')).toEqual({ made_at: '2026-10-20T09:00:00.000Z', valid_until: '2026-11-03', refresh_due: false });
    expect((await synthesisValidity(said.prisma, 'k1', 'self', '2026-11-04'))?.refresh_due).toBe(true);
    const windowOnly = store([row({ created_at: new Date('2026-10-20T09:00:00Z'), output: { status: 'ok' } })]);
    expect((await synthesisValidity(windowOnly.prisma, 'k1', 'self', '2026-11-09'))?.valid_until).toBe('2026-11-30');
    const always = store([row({ created_at: new Date('2026-10-20T09:00:00Z'), output: { status: 'ok', validUntil: { overall: 'always' } } })]);
    expect(await synthesisValidity(always.prisma, 'k1', 'self', '2030-01-01')).toMatchObject({ valid_until: null, refresh_due: false });
    const failed = store([row({ created_at: new Date('2026-10-20T09:00:00Z'), output: { status: 'failed' } })]);
    expect(await synthesisValidity(failed.prisma, 'k1', 'self', '2026-11-09')).toBeNull();
  });
});
