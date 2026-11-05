import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { MAX_STORED_THINKING_CHARS, runReading } from '../../../src/reading/run.js';
import type { ReadingEvent } from '../../../src/reading/types.js';
import { G1_AS_OF } from '../../helpers/readingFixtures.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

const THOUGHTS = ['**Checking** the 7th lord. ', 'Venus is strong; weighing the running dasha. '];
let fake: FakeGemini;
const prisma = {} as unknown as PrismaClient;

beforeAll(async () => {
  fake = await startFakeGemini({ chunkDelayMs: 1, thoughts: THOUGHTS });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_API_URL = fake.url;
  process.env.GEMINI_FLASH_MODEL_ID = 'gemini-2.5-flash';
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  delete process.env.READING_FLOW;
  delete process.env.READING_INCLUDE_THOUGHTS;
});
afterAll(async () => {
  await fake.close();
  delete process.env.READING_FACTS_SOURCE;
  delete process.env.READING_INTAKE_MODE;
  delete process.env.READING_INCLUDE_THOUGHTS;
});
beforeEach(() => {
  fake.reset();
  clearReadingCaches();
  findingsCache.clear();
  delete process.env.READING_INCLUDE_THOUGHTS;
});

describe('runReading: thinking', () => {
  it('stores thoughts on the run record, keeps them out of the answer, and never streams them (docs/privacy/02 B0.2)', async () => {
    const events: ReadingEvent[] = [];
    const deltas: string[] = [];
    const r = await runReading(prisma, 'u1', 'When will I get married?', {
      asOf: G1_AS_OF,
      flow: 'single',
      onEvent: (e) => events.push(e),
      onDelta: (d) => deltas.push(d),
    });
    // no `thought` frame reaches the client, and no event carries the thinking text
    expect(events.some((e) => (e.type as string) === 'thought')).toBe(false);
    expect(JSON.stringify(events)).not.toMatch(/Checking the 7th lord/);
    expect(r.record.thinking).toBe(THOUGHTS.join(''));
    expect(r.answerText).not.toMatch(/Checking the 7th lord/);
    expect(deltas.join('')).not.toMatch(/Checking|weighing the running dasha/);
    expect(r.record.answer).toBe(r.answerText);
  });

  it('stores the thinking even when nobody is listening for events', async () => {
    const r = await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    expect(r.record.thinking).toBe(THOUGHTS.join(''));
  });

  it('stores null and sends no thought events when READING_INCLUDE_THOUGHTS=0', async () => {
    process.env.READING_INCLUDE_THOUGHTS = '0';
    const events: ReadingEvent[] = [];
    const r = await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single', onEvent: (e) => events.push(e) });
    expect(r.record.thinking).toBeNull();
    expect(events.some((e) => (e.type as string) === 'thought')).toBe(false);
  });

  it('is kept next to the answer in graph flow too', async () => {
    const r = await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'graph' });
    expect(r.record.flow).toBe('graph');
    expect(r.record.thinking).toBe(THOUGHTS.join(''));
  });

  it('caps the stored text', () => {
    expect(MAX_STORED_THINKING_CHARS).toBe(60_000);
  });
});
