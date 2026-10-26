import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { intentForFocus } from '../../../src/reading/clarify/service.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { FRAMES } from '../../../src/reading/packs/frames.js';
import { runReading } from '../../../src/reading/run.js';
import type { ReadingEvent } from '../../../src/reading/types.js';
import { G1_AS_OF } from '../../helpers/readingFixtures.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

const MULTI = 'tell me about my love life in OCT-NOV 2026 - finances, bank account balance, paying rent, who will i be at work with';
let fake: FakeGemini;
const prisma = {} as unknown as PrismaClient;

beforeAll(async () => {
  fake = await startFakeGemini({ chunkDelayMs: 1 });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_API_URL = fake.url;
  process.env.GEMINI_FLASH_MODEL_ID = 'gemini-2.5-flash';
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  delete process.env.READING_FLOW;
});
afterAll(async () => {
  await fake.close();
  delete process.env.READING_FACTS_SOURCE;
  delete process.env.READING_INTAKE_MODE;
});
beforeEach(() => {
  fake.reset();
  clearReadingCaches();
  findingsCache.clear();
});

describe('intentForFocus (one part of a multi-part question)', () => {
  it('reads only the focus and keeps the remaining parts in order, without the whole question’s bucket', async () => {
    const intent = await intentForFocus(MULTI, G1_AS_OF, 'income_wealth', ['marriage_relationship', 'income_wealth', 'career_work', 'general_life_direction', 'career_work']);
    expect(intent.subjects).toEqual([{ id: 'income_wealth', weight: 1 }]);
    expect(intent.nextSubjects).toEqual(['marriage_relationship', 'career_work']);
    expect(intent.classification).toBeUndefined();
    expect(intent.confidence).toBe(1);
    expect(intent.clarifyText.toLowerCase()).toContain(FRAMES.income_wealth.label.toLowerCase().split(' ')[0]!);
  });
  it('the last part has nothing next', async () => {
    const intent = await intentForFocus(MULTI, G1_AS_OF, 'career_work', []);
    expect(intent.nextSubjects).toBeUndefined();
  });
});

describe('runReading announces the parts still to come', () => {
  it('emits a next event with ids and labels after the answer', async () => {
    const events: ReadingEvent[] = [];
    const intent = await intentForFocus(MULTI, G1_AS_OF, 'marriage_relationship', ['income_wealth', 'career_work']);
    await runReading(prisma, 'u1', MULTI, { asOf: G1_AS_OF, flow: 'single', intent, onEvent: (e) => events.push(e) });
    const next = events.filter((e) => e.type === 'next');
    expect(next).toHaveLength(1);
    expect(next[0]!.parts).toEqual([
      { id: 'income_wealth', label: FRAMES.income_wealth.label },
      { id: 'career_work', label: FRAMES.career_work.label },
    ]);
    // it comes after the writer finished
    const names = events.map((e) => (e.type === 'stage' ? `${e.name}:${e.status}` : e.type));
    expect(names.indexOf('next')).toBeGreaterThan(names.indexOf('synthesize:done'));
  });
  it('emits nothing when the question had one part', async () => {
    const events: ReadingEvent[] = [];
    await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single', onEvent: (e) => events.push(e) });
    expect(events.some((e) => e.type === 'next')).toBe(false);
  });
});
