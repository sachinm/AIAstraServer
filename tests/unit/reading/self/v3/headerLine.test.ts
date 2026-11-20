/**
 * Plan "retire the v2 Self reading" step 4: GET /api/self/v3 serves `headerLine`, the diagnosis card's plain line (the
 * Personalizer of the diagnosis card writes the Self header, docs/techniques/09 §3.1). Null when that card is absent
 * (off), locked, not read, or its plain reading is pending: the key is always sent (null); it is absent only on a body
 * built before the field. No model call: the stored card's line, as served.
 */
import { describe, expect, it } from 'vitest';
import { getSelfV3, headerLineOf } from '../../../../../src/reading/self/v3/service.js';
import { APPLICABLE_RAW, PRESENT } from '../v2api/fixtures.js';
import type { SelfV3CardView } from '../../../../../src/reading/self/v3/types.js';

const card = (over: Record<string, unknown>) => ({ id: 'diagnosis', locked: null, v3: { line: 'Work asks more of you until 20 Feb 2027.', plain: { story: 'x', pending: false } }, ...over }) as unknown as SelfV3CardView;

describe('headerLineOf', () => {
  it('is the diagnosis card line when it was read', () => {
    expect(headerLineOf([card({ id: 'mind', v3: { line: 'not this one' } }), card({})])).toBe('Work asks more of you until 20 Feb 2027.');
  });
  it('is null when the diagnosis card is off, locked, unread or its plain reading pending', () => {
    expect(headerLineOf([card({ id: 'mind' })])).toBeNull();
    expect(headerLineOf([card({ locked: { minPlan: 'plus' } })])).toBeNull();
    expect(headerLineOf([card({ v3: null })])).toBeNull();
    expect(headerLineOf([card({ v3: { line: 'Oracle headline', plain: { story: null, pending: true } } })])).toBeNull();
    expect(headerLineOf([card({ v3: { line: '   ' } })])).toBeNull();
  });
});

describe('GET /api/self/v3 always sends the headerLine key', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const prisma = (kundli: boolean): any => ({
    kundli: { findFirst: async () => (kundli ? { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' } : null) },
    kundliActivation: { groupBy: async () => PRESENT.map((p) => ({ system: p.system, family: p.family })) },
    kundliData: { findFirst: async ({ where }: any) => (where.data_type === 'dasha.applicable' ? { payload: APPLICABLE_RAW } : null) },
    techniqueOutput: { findFirst: async () => null },
    areaBuild: { findFirst: async () => null, findUnique: async () => null, upsert: async ({ create }: any) => create },
    boardLayout: { findUnique: async () => null },
    auth: { findUnique: async () => ({ date_of_birth: '1985-03-01', gender: null, role: 'novice' }) },
    personFact: { findMany: async () => [], upsert: async ({ create }: any) => create },
  });
  const deps = (kundli: boolean) => ({
    prisma: prisma(kundli),
    now: () => new Date('2026-11-19T12:00:00Z'),
    cardsRead: false,
    readV3Cards: async () => null,
    queueBuild: async () => 'invoked' as const,
    queueDigest: async () => undefined,
    progressMarkers: async () => ({ queue: { state: 'ready' as const, startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
    buildMarker: async () => 'ready' as const,
    planOf: async () => 'free' as const,
    featureOverrides: async () => new Map(),
  });

  it('null (key present) with no chart, and with a chart whose diagnosis card is not read', async () => {
    for (const k of [false, true]) {
      const { body } = await getSelfV3(deps(k) as any, 'u1');
      expect(Object.prototype.hasOwnProperty.call(body, 'headerLine'), `kundli=${k}`).toBe(true);
      expect(body.headerLine).toBeNull();
    }
  });
});
