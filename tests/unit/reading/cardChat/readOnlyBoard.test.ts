/**
 * docs/reading-engine/85 §7 step 2: the Love/Work read the card chat makes (`getBoardV3` with `readOnly`) writes nothing
 * and queues nothing, where the page's own first open of the day marks the board opened and queues the lens deck.
 * The real board service over an in-memory fake; no database, no model.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getBoardV3 } from '../../../../src/reading/boards/v3Service.js';
import { NOTHING_STORED, type SelfV2Latest } from '../../../../src/reading/self/v2api/storeContract.js';
import { PRESENT, latestFixture } from '../self/v2api/fixtures.js';
import { content } from './fixtures.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const ENV = ['SELF_V3_BUILD', 'READING_CLOCK_LAYER', 'BOARDS_V3'];
const saved: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  Object.assign(process.env, { SELF_V3_BUILD: '1', READING_CLOCK_LAYER: '1', BOARDS_V3: 'love,work' });
});
afterAll(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function fake() {
  const writes: string[] = [];
  const prisma = {
    kundli: { findFirst: async () => ({ id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' }) },
    kundliData: { findFirst: async () => null },
    auth: { findUnique: async () => ({ date_of_birth: '1990-03-01', gender: null, role: 'novice' }) },
    personFact: { findMany: async () => [], upsert: async () => (writes.push('personFact.upsert'), {}) },
    analyticsEvent: { create: async () => (writes.push('analyticsEvent.create'), {}) },
    areaBuild: { findUnique: async () => null, upsert: async () => (writes.push('areaBuild.upsert'), {}) },
    boardLayout: {
      findUnique: async () => ({ cards: ['dating_pulse', 'dating_delays_blocks'], template: 'seasons', sections: {}, options: {}, board_options: { lens: 'dating' }, updated_at: NOW }),
      create: async () => (writes.push('boardLayout.create'), {}),
      upsert: async () => (writes.push('boardLayout.upsert'), {}),
      updateMany: async () => (writes.push('boardLayout.updateMany'), { count: 0 }),
    },
  } as any;
  return { prisma, writes };
}

const seams = {
  now: () => NOW,
  readLatest: async (): Promise<SelfV2Latest> => latestFixture() ?? { ...NOTHING_STORED },
  systemsPresent: async () => PRESENT,
  progressMarkers: async () => ({ queue: { state: 'none' as const, startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
  buildMarker: async () => 'none' as const,
  refreshDates: async () => null,
  readCardReadings: (async () => ({ dating_pulse: content })) as never,
  planOf: async () => 'free' as const,
  featureOverrides: async () => new Map(),
};

describe('getBoardV3 readOnly', () => {
  it('the page open marks the board and queues the deck; the card-chat read does neither', async () => {
    const page = fake();
    const pageQueued: string[] = [];
    const r1 = await getBoardV3({ prisma: page.prisma, ...seams, queueBuild: async () => 'invoked', queueDigest: async () => undefined, queueCardsBuild: async (_p, _u, k) => (pageQueued.push(k), 'invoked') }, 'u1', 'love');
    expect(r1.queued.length).toBeGreaterThan(0);
    expect(page.writes).toContain('areaBuild.upsert');

    const chat = fake();
    const queued: string[] = [];
    const q = async (_p: unknown, _u: string, k: string) => (queued.push(k), 'skipped' as const);
    const r2 = await getBoardV3({ prisma: chat.prisma, ...seams, queueBuild: q, queueDigest: async () => void queued.push('digest'), queueCardsBuild: q, readOnly: true }, 'u1', 'love');
    expect(r2.queued).toEqual([]);
    expect(chat.writes).toEqual([]);
    expect(queued).toEqual([]);
    // the same stored card is served
    expect(r2.body.cards.find((c) => c.id === 'dating_pulse')?.v3?.line).toBe(content.line);
    expect(r2.body.cards.find((c) => c.id === 'dating_pulse')?.features['feature.card_chat']).toEqual({ locked: false });
  });
});
