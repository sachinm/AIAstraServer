/**
 * Plan "retire the v2 Self reading", server step 2 (SELF_BOARD_FROM_CARDS=1): the Self board's state comes from the Self
 * card readings. A GET with a card read never queues a build; with no card read it queues the free first build exactly
 * once (not on every poll after a build that read nothing); Love and Work card rows never make Self look built; the
 * refresh dates are the lens rule over the Self deck. Fakes only: no model, no database.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getSelfV2 } from '../../../../src/reading/self/v2api/service.js';
import { selfBoardStateFrom, type SelfBoardState } from '../../../../src/reading/self/boardState.js';
import type { QueueMarkerView, V2MarkerView } from '../../../../src/reading/self/progress.js';
import { APPLICABLE_RAW, PRESENT } from './v2api/fixtures.js';

const NOW = new Date('2026-11-19T12:00:00Z');
const TODAY = '2026-11-19';

const row = (card: string, created: string, validTo: string | null = '2027-01-01T00:00:00Z') => ({ output: { card, content: { line: `${card} line`, spans: [] } }, created_at: new Date(created), valid_to: validTo ? new Date(validTo) : null });

describe('selfBoardStateFrom (pure)', () => {
  it('counts only Self cards: a Love or Work card row never makes the Self board look built', () => {
    const s = selfBoardStateFrom([row('dating_pulse', '2026-11-18T10:00:00Z')], TODAY, []);
    expect(s).toMatchObject({ nothingStored: true, cardsRead: 0, builtAt: null });
  });

  it('builtAt is the newest Self reading; today\'s recorded read time wins when later; Good until is the earliest last day on the deck', () => {
    const rows = [row('mind', '2026-11-18T09:00:00Z', '2027-02-21T00:00:00Z'), row('body', '2026-11-17T09:00:00Z', '2026-12-01T00:00:00Z'), row('mind', '2026-11-10T09:00:00Z'), row('dating_pulse', '2026-11-19T11:00:00Z')];
    const s = selfBoardStateFrom(rows, TODAY, ['mind', 'body']);
    expect(s).toMatchObject({ nothingStored: false, cardsRead: 2, builtAt: '2026-11-18T09:00:00.000Z' });
    expect(s.validity).toEqual({ madeAt: '2026-11-17T09:00:00.000Z', validUntil: '2026-11-30', due: false });
    const later = selfBoardStateFrom(rows, TODAY, ['mind', 'body'], '2026-11-19T11:30:00.000Z');
    expect(later.builtAt).toBe('2026-11-19T11:30:00.000Z');
    expect(later.validity.madeAt).toBe('2026-11-19T11:30:00.000Z');
  });

  it('a deck card past its last good day makes the board due', () => {
    const s = selfBoardStateFrom([row('mind', '2026-10-01T09:00:00Z', '2026-11-01T00:00:00Z')], TODAY, ['mind']);
    expect(s.validity).toMatchObject({ validUntil: '2026-10-31', due: true });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function harness(state: SelfBoardState, marker: QueueMarkerView['state']) {
  const queued: string[] = [];
  const v2Reads: string[] = [];
  let queue: QueueMarkerView = { state: marker, startedAt: marker === 'none' ? null : '2026-11-19T11:00:00.000Z' };
  const v2: V2MarkerView = { status: null, stage: null, stageAt: null };
  const prisma: any = { kundli: { findFirst: async () => ({ id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' }) } };
  const deps = {
    prisma,
    now: () => NOW,
    boardFromCards: true,
    v2Retired: true,
    systemsPresent: async () => PRESENT,
    loadApplicability: async () => {
      const { parseApplicability } = await import('../../../../src/reading/self/clock.js');
      return parseApplicability(APPLICABLE_RAW);
    },
    loadProfile: async () => ({ ageBand: '36_45', ageYears: 41, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'h' }) as any,
    readLatest: async () => {
      v2Reads.push('read');
      throw new Error('the v2 rows are not read with the v2 build retired');
    },
    queueBuild: async () => {
      queued.push('q');
      // the queue helper marks the marker building first
      queue = { state: 'building', startedAt: NOW.toISOString() };
      return 'invoked' as const;
    },
    queueDigest: async () => undefined,
    progressMarkers: async () => ({ queue, v2 }),
    boardState: async () => state,
  };
  return { deps, queued, v2Reads, setMarker: (s: QueueMarkerView['state']) => (queue = { state: s, startedAt: '2026-11-19T11:00:00.000Z' }) };
}

const READ: SelfBoardState = { builtAt: '2026-11-18T09:00:00.000Z', cardsRead: 6, nothingStored: false, validity: { madeAt: '2026-11-17T09:00:00.000Z', validUntil: '2026-11-30', due: false } };
const NONE: SelfBoardState = { builtAt: null, cardsRead: 0, nothingStored: true, validity: { madeAt: null, validUntil: null, due: false } };

describe('GET /api/self/v2 with SELF_BOARD_FROM_CARDS=1', () => {
  afterEach(() => undefined);

  it('card rows present: no GET queues a build, whatever today\'s marker says; builtAt and the refresh dates come from the cards', async () => {
    for (const marker of ['none', 'ready', 'failed', 'stuck', 'failed_recently'] as const) {
      const h = harness(READ, marker);
      const r = await getSelfV2(h.deps as any, 'u1');
      expect(h.queued, marker).toEqual([]);
      expect(r.queued).toBeNull();
      expect(r.body.status).toBe('ok');
      expect(r.body.builtAt).toBe(READ.builtAt);
      expect(r.body.refresh).toMatchObject({ madeAt: READ.validity.madeAt, validUntil: '2026-11-30', due: false });
      expect(r.body.hero).toBeNull();
      expect(r.body.quality).toBeNull();
      expect(h.v2Reads).toEqual([]);
    }
  });

  it('no card read: the free first build is queued exactly once across polls, and not again after a build that read nothing', async () => {
    const h = harness(NONE, 'none');
    const first = await getSelfV2(h.deps as any, 'u1');
    expect(first.queued).toBe('invoked');
    expect(first.body.status).toBe('pending');
    const second = await getSelfV2(h.deps as any, 'u1');
    expect(second.queued).toBeNull();
    expect(second.body.status).toBe('pending');
    // the build ran and read no card (fewer than CARDS_READ_MIN on the board): ready, nothing queued again
    h.setMarker('ready');
    const third = await getSelfV2(h.deps as any, 'u1');
    expect(third.queued).toBeNull();
    expect(third.body.status).toBe('ok');
    expect(h.queued).toEqual(['q']);
  });

  it('no card read and the last build stuck: one build is queued (the page\'s Try again)', async () => {
    const h = harness(NONE, 'stuck');
    const r = await getSelfV2(h.deps as any, 'u1');
    expect(r.queued).toBe('invoked');
    expect(h.queued).toEqual(['q']);
  });
});

describe('selfCardDates and the board clock (POST /api/boards/self/refresh, GET /api/area/self)', () => {
  const db = (rows: unknown[]) =>
    ({
      kundli: { findUnique: async () => ({ preferred_dasha: null }) },
      kundliActivation: { groupBy: async () => PRESENT.map((p) => ({ system: p.system, family: p.family })) },
      kundliData: { findFirst: async ({ where }: any) => (where.data_type === 'dasha.applicable' ? { payload: APPLICABLE_RAW } : null) },
      // no $queryRaw: newestCardRows reads the fallback window
      techniqueOutput: { findMany: async ({ where }: any) => (String(where.digest_version?.contains ?? '').includes('|clock=chathuraaseethi_sama|') ? rows : []) },
      boardLayout: { findUnique: async () => null },
    }) as any;

  it('resolves the board clock the way GET /api/self/v2 does', async () => {
    const { resolveSelfClock } = await import('../../../../src/reading/self/boardState.js');
    expect(await resolveSelfClock(db([]), 'k1')).toBe('chathuraaseethi_sama');
  });

  it('null until a Self card was read on the board clock; then made at, Good until and due', async () => {
    const { selfCardDates } = await import('../../../../src/reading/self/boardState.js');
    const none = async () => ({});
    expect(await selfCardDates(db([row('dating_pulse', '2026-11-18T09:00:00Z')]), 'k1', TODAY, null, { readMarker: none })).toBeNull();
    const d = await selfCardDates(db([row('mind', '2026-11-18T09:00:00Z', '2026-12-01T00:00:00Z')]), 'k1', TODAY, null, { readMarker: none });
    expect(d).toEqual({ made_at: '2026-11-18T09:00:00.000Z', valid_until: '2026-11-30', refresh_due: false });
  });
});

describe('SELF_V2_RETIRED=1 implies the card state (a one-flag rollback never re-queues on every GET)', () => {
  const KEYS = ['SELF_V2_RETIRED', 'SELF_V3_BUILD', 'READING_CLOCK_LAYER', 'SELF_BOARD_FROM_CARDS'] as const;
  const saved: Record<string, string | undefined> = {};
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('with SELF_BOARD_FROM_CARDS unset the GET still keys on the cards and reads no v2 row', async () => {
    for (const k of KEYS) saved[k] = process.env[k];
    Object.assign(process.env, { SELF_V2_RETIRED: '1', SELF_V3_BUILD: '1', READING_CLOCK_LAYER: '1' });
    delete process.env.SELF_BOARD_FROM_CARDS;
    const h = harness(READ, 'ready');
    const deps = { ...h.deps } as any;
    delete deps.boardFromCards;
    delete deps.v2Retired;
    const r = await getSelfV2(deps, 'u1');
    expect(r.queued).toBeNull();
    expect(r.body.builtAt).toBe(READ.builtAt);
    expect(h.v2Reads).toEqual([]);
  });
});

describe('selfDeeperReadingReady (POST /api/boards/self/refresh counts it as due)', () => {
  const db = (contents: Record<string, Record<string, unknown>>) =>
    ({
      kundli: { findUnique: async () => ({ preferred_dasha: null }) },
      kundliActivation: { groupBy: async () => PRESENT.map((p) => ({ system: p.system, family: p.family })) },
      kundliData: { findFirst: async ({ where }: any) => (where.data_type === 'dasha.applicable' ? { payload: APPLICABLE_RAW } : null) },
      techniqueOutput: { findMany: async () => Object.entries(contents).map(([card, content]) => ({ output: { card, content }, created_at: new Date('2026-11-18T09:00:00Z'), valid_to: null })) },
      boardLayout: { findUnique: async () => ({ template: 'seasons', cards: ['mind', 'body'], sections: {}, options: {}, board_options: {}, updated_at: new Date('2026-11-18T09:00:00Z') }) },
    }) as any;
  const saved = process.env.CARDS_STORY_CONTRACT;
  afterEach(() => {
    if (saved === undefined) delete process.env.CARDS_STORY_CONTRACT;
    else process.env.CARDS_STORY_CONTRACT = saved;
  });

  it('true when a board card was read without a technical story; false once every read card carries one, or the contract is off', async () => {
    const { selfDeeperReadingReady } = await import('../../../../src/reading/self/boardState.js');
    delete process.env.CARDS_STORY_CONTRACT;
    const bare = { line: 'x', spans: [] };
    const told = { ...bare, story: 'The technical story.' };
    expect(await selfDeeperReadingReady(db({ mind: bare, body: told }), 'k1')).toBe(true);
    expect(await selfDeeperReadingReady(db({ mind: told, body: told }), 'k1')).toBe(false);
    process.env.CARDS_STORY_CONTRACT = '0';
    expect(await selfDeeperReadingReady(db({ mind: bare }), 'k1')).toBe(false);
  });
});

describe('the Self chip Good until (refresh.validUntil) is the earliest card Good until on the shown deck', () => {
  const card = (id: string, goodUntil: string | null, validTo = '2027-06-01T00:00:00Z') => ({ output: { card: id, content: { line: 'x', spans: [], ...(goodUntil ? { goodUntil } : {}) } }, created_at: new Date('2026-11-18T09:00:00Z'), valid_to: new Date(validTo) });

  it('takes each card goodUntil, the earliest across the deck, never later than any card', () => {
    const rows = [card('mind', '2027-02-20'), card('body', '2026-12-15'), card('year', '2026-12-01')];
    // `year` is not on the shown deck: it does not set the chip
    const s = selfBoardStateFrom(rows, TODAY, ['mind', 'body']);
    expect(s.validity.validUntil).toBe('2026-12-15');
    for (const r of rows.slice(0, 2)) expect(s.validity.validUntil! <= (r.output.content as { goodUntil: string }).goodUntil).toBe(true);
  });

  it('a card with no goodUntil counts by its row last good day', () => {
    const s = selfBoardStateFrom([card('mind', '2027-02-20'), card('body', null, '2026-12-10T00:00:00Z')], TODAY, ['mind', 'body']);
    expect(s.validity.validUntil).toBe('2026-12-09');
  });
});
