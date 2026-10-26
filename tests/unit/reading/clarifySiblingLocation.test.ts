import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { absorbAnswer, parseSibling, startClarify, type ClarifyState } from '../../../src/reading/clarify/machine.js';
import { answerClarify, beginClarify, clearLocationMemo, confirmAndBuildIntent } from '../../../src/reading/clarify/service.js';
import { MemoryClarifyStore } from '../../../src/reading/clarify/store.js';
import { ruleIntake, siblingMention } from '../../../src/reading/nodes/intake.js';
import { clearDeclinedTopicsCache } from '../../../src/reading/policy/declined.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import {
  currentLocationLine,
  MemoryUserLocationStore,
  normalizePlace,
  normalizeTimeZone,
  PrismaUserLocationStore,
  resetUserLocationWarning,
  type UserLocationStore,
} from '../../../src/services/userLocation.js';

const AS_OF = '2026-10-24';
const start = (q: string, extra: Partial<Parameters<typeof startClarify>[3]> = {}) =>
  startClarify(q, AS_OF, classifyRules(q, AS_OF), { mode: 'when_missing', threshold: 0.7, card: null, now: 0, ...extra });
const chip = (s: ClarifyState, v: string, tz?: string) => absorbAnswer(s, v, { viaChip: true, threshold: 0.7, now: 1, tz });
const typed = (s: ClarifyState, v: string, tz?: string) => absorbAnswer(s, v, { viaChip: false, threshold: 0.7, now: 1, tz });

describe('sibling mention (intake rules)', () => {
  it('a brother or sister without elder/younger is ambiguous; "only", in-laws and named ranks are not', () => {
    expect(siblingMention('How is my brother doing?')).toMatchObject({ noun: 'brother', ambiguous: true, ranks: [] });
    expect(siblingMention('Will my sister get a job?')).toMatchObject({ noun: 'sister', ambiguous: true });
    expect(siblingMention('How are my siblings?')).toMatchObject({ noun: 'sibling', ambiguous: true });
    expect(siblingMention('My brother and sister are fighting')).toMatchObject({ noun: 'sibling', ambiguous: true });
    expect(siblingMention('How is my only brother doing?')).toMatchObject({ ambiguous: false });
    expect(siblingMention('Will my elder brother marry?')).toMatchObject({ ambiguous: false, ranks: [{ rank: 'elder', noun: 'brother' }] });
    expect(siblingMention('Will my brother-in-law help?')).toBeNull();
    expect(siblingMention('Should I change jobs?')).toBeNull();
  });
  it('intake sets the focus point directly when the question says elder or younger', () => {
    expect(ruleIntake('Will my elder brother get married?', AS_OF).intent.focusPoints).toContain('elder brother: judge the 11th house and its lord first');
    expect(ruleIntake('How is my younger sister doing?', AS_OF).intent.focusPoints).toContain('younger sister: judge the 3rd house and its lord first');
    expect(ruleIntake('How is my brother doing?', AS_OF).intent.focusPoints.some((p) => /judge the/.test(p))).toBe(false);
  });
});

describe('sibling clarify (machine)', () => {
  it('asks "Which brother do you mean?" with elder/younger chips', () => {
    const s = start('How is my brother doing?');
    expect(s.status).toBe('ASKING');
    expect(s.pending?.criterion).toBe('sibling');
    expect(s.pending?.question).toBe('Which brother do you mean?');
    expect(s.pending?.chips.map((c) => c.label)).toEqual(['Elder brother', 'Younger brother', 'All my brothers']);
  });
  it('a plain "sibling" question gets all four chips', () => {
    const s = start('How are my siblings doing?');
    expect(s.pending?.question).toBe('Which sibling do you mean?');
    expect(s.pending?.chips.map((c) => c.value)).toEqual(['elder_brother', 'younger_brother', 'elder_sister', 'younger_sister', 'all']);
  });
  it('does not ask when the question already says which', () => {
    expect(start('How is my elder brother doing?').pending?.criterion).not.toBe('sibling');
    expect(start('How is my only sister doing?').pending?.criterion).not.toBe('sibling');
  });
  it('a chip answer narrows the exact query; typed text is read too', () => {
    const s = chip(start('How is my brother doing this year?'), 'elder_brother');
    expect(s.sibling).toEqual({ rank: 'elder', noun: 'brother' });
    expect(s.status).toBe('PROPOSED');
    expect(s.exactQuery).toMatch(/about your elder brother/);
    expect(typed(start('How is my sister doing?'), 'the younger one').sibling).toEqual({ rank: 'younger', noun: 'sister' });
    expect(parseSibling('both of them', 'brother')).toEqual({ rank: 'all', noun: 'brother' });
    expect(parseSibling('hmm', 'brother')).toBeNull();
  });
  it('an unclear answer is not asked again: all siblings are assumed and said back', () => {
    const s = typed(start('How is my brother doing this year?'), 'hmm');
    expect(s.status).toBe('PROPOSED');
    expect(s.sibling).toEqual({ rank: 'all', noun: 'brother' });
    expect(s.assumed.sibling).toBe('all your brothers');
  });
});

describe('current location clarify (machine)', () => {
  it('asks "Where are you living now?" once for a timing question when needed, after the other criteria', () => {
    let s = start('When will I get married?', { needsLocation: true, birthPlace: 'Pune, India' });
    expect(s.pending?.criterion).toBe('horizon');
    s = chip(s, '6m');
    expect(s.pending?.criterion).toBe('location');
    expect(s.pending?.question).toBe('Where are you living now?');
    expect(s.pending?.chips).toEqual([{ label: 'Same as birth place', value: 'same_as_birth' }]);
    expect(s.pending?.allowFreeText).toBe(true);
    s = typed(s, '  London,   UK ', 'Europe/London');
    expect(s.location).toEqual({ place: 'London, UK', tz: 'Europe/London' });
    expect(s.locationAnswered).toBe(true);
    expect(s.status).toBe('PROPOSED');
    expect(s.exactQuery).toMatch(/Dates will be given for London, UK\.$/);
  });
  it('is asked even when the question is otherwise complete, and is outside the two-question cap', () => {
    const s = start('Should I change jobs this year? When exactly?', { needsLocation: true });
    expect(s.pending?.criterion).toBe('location');
    expect(s.pending?.chips).toEqual([]);
  });
  it('"Same as birth place" stores the birth place with the browser timezone', () => {
    let s = start('When will I get married?', { needsLocation: true, birthPlace: 'Pune, India' });
    s = chip(chip(s, '6m'), 'same_as_birth', 'Asia/Kolkata');
    expect(s.location).toEqual({ place: 'Pune, India', tz: 'Asia/Kolkata' });
  });
  it('a non-answer is not stored and not asked again', () => {
    let s = start('When will I get married?', { needsLocation: true });
    s = typed(chip(s, '6m'), "don't know");
    expect(s.location).toBeNull();
    expect(s.status).toBe('PROPOSED');
  });
  it('is not asked when not needed (a location is stored, or the store is unavailable)', () => {
    const s = start('When will I get married?', { needsLocation: false, location: { place: 'Delhi', tz: 'Asia/Kolkata' } });
    expect(chip(s, '6m').status).toBe('PROPOSED');
  });
});

describe('user location helpers', () => {
  it('normalises the place and the timezone; formats the tail line', () => {
    expect(normalizePlace('  Pune,\n India. ')).toBe('Pune, India');
    expect(normalizePlace('   ')).toBeNull();
    expect(normalizeTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(normalizeTimeZone('Not/AZone')).toBeNull();
    expect(normalizeTimeZone('x; DROP TABLE')).toBeNull();
    expect(currentLocationLine({ place: 'Pune, India', tz: 'Asia/Kolkata' })).toBe('CURRENT LOCATION: Pune, India (Asia/Kolkata)');
    expect(currentLocationLine({ place: 'Pune', tz: null })).toBe('CURRENT LOCATION: Pune');
    expect(currentLocationLine(null)).toBeNull();
  });
  it('a missing table degrades to "unavailable", logs once, and never throws', async () => {
    resetUserLocationWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const missing = Object.assign(new Error('relation "user_current_location" does not exist'), { code: 'P2010' });
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(missing), $executeRaw: vi.fn().mockRejectedValue(missing) } as unknown as PrismaClient;
    const store = new PrismaUserLocationStore(prisma);
    expect(await store.get('u1')).toEqual({ status: 'unavailable' });
    expect(await store.save('u1', { place: 'Pune', tz: null })).toBe(false);
    expect(await store.get('u1')).toEqual({ status: 'unavailable' });
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('user_current_location'))).toHaveLength(1);
    warn.mockRestore();
  });
  it('a client without raw queries (mocked) and a slow database are unavailable too', async () => {
    resetUserLocationWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await new PrismaUserLocationStore({} as PrismaClient).get('u1')).toEqual({ status: 'unavailable' });
    const slow = { $queryRaw: vi.fn().mockReturnValue(new Promise(() => undefined)) } as unknown as PrismaClient;
    expect(await new PrismaUserLocationStore(slow, 20).get('u1')).toEqual({ status: 'unavailable' });
    warn.mockRestore();
  });
  it('reads a stored row', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ place: 'Pune', tz: 'Asia/Kolkata' }]) } as unknown as PrismaClient;
    expect(await new PrismaUserLocationStore(prisma).get('u1')).toEqual({ status: 'found', location: { place: 'Pune', tz: 'Asia/Kolkata' } });
    const none = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as PrismaClient;
    expect(await new PrismaUserLocationStore(none).get('u1')).toEqual({ status: 'none' });
  });
});

describe('clarify service: sibling focus and current location', () => {
  const prisma = {
    declinedTopic: { findMany: vi.fn().mockResolvedValue([]) },
    auth: { findUnique: vi.fn().mockResolvedValue({ role: 'novice', place_of_birth: 'Pune, India' }) },
  } as unknown as PrismaClient;
  beforeEach(() => {
    process.env.READING_FACTS_SOURCE = 'fixture';
    clearDeclinedTopicsCache();
    clearReadingCaches();
    clearLocationMemo();
  });
  afterEach(() => delete process.env.READING_FACTS_SOURCE);

  it('the sibling chosen becomes a focus point in the confirmed intent', async () => {
    const store = new MemoryClarifyStore();
    const locationStore = new MemoryUserLocationStore();
    const b = await beginClarify(prisma, store, 'u1', 'How is my brother doing this year?', { asOf: AS_OF, locationStore });
    expect(b.event?.type === 'clarify' && b.event.criterion).toBe('sibling');
    const a = await answerClarify(prisma, store, 'u1', b.runId, 'younger_brother', true, { locationStore });
    expect('error' in a ? a.error : a.event?.type).toBe('propose');
    const c = await confirmAndBuildIntent(store, 'u1', b.runId);
    if ('error' in c) throw new Error(c.error);
    expect(c.intent?.focusPoints).toContain('younger brother: judge the 3rd house and its lord first');
  });

  it('timing question, nothing stored: asks once, stores place + browser tz, the intent carries it, the next question does not ask', async () => {
    const store = new MemoryClarifyStore();
    const locationStore = new MemoryUserLocationStore();
    const b = await beginClarify(prisma, store, 'u1', 'When will I get married?', { asOf: AS_OF, locationStore });
    const a = await answerClarify(prisma, store, 'u1', b.runId, '6m', true, { locationStore });
    if ('error' in a) throw new Error(a.error);
    expect(a.event?.type === 'clarify' && a.event.criterion).toBe('location');
    if (a.event?.type === 'clarify') {
      expect(a.event.question).toBe('Where are you living now?');
      expect(a.event.chips).toEqual([{ label: 'Same as birth place', value: 'same_as_birth' }]);
    }
    const l = await answerClarify(prisma, store, 'u1', b.runId, 'Toronto, Canada', false, { locationStore, tz: 'America/Toronto' });
    if ('error' in l) throw new Error(l.error);
    expect(l.event?.type).toBe('propose');
    expect(locationStore.rows.get('u1')).toEqual({ place: 'Toronto, Canada', tz: 'America/Toronto' });
    const c = await confirmAndBuildIntent(store, 'u1', b.runId);
    if ('error' in c) throw new Error(c.error);
    expect(c.intent?.currentLocation).toEqual({ place: 'Toronto, Canada', tz: 'America/Toronto' });
    expect(currentLocationLine(c.intent?.currentLocation)).toBe('CURRENT LOCATION: Toronto, Canada (America/Toronto)');

    const b2 = await beginClarify(prisma, store, 'u1', 'When will I get married?', { asOf: AS_OF, locationStore });
    const a2 = await answerClarify(prisma, store, 'u1', b2.runId, '6m', true, { locationStore });
    expect('error' in a2 ? a2.error : a2.event?.type).toBe('propose');
    const c2 = await confirmAndBuildIntent(store, 'u1', b2.runId);
    if ('error' in c2) throw new Error(c2.error);
    expect(c2.intent?.currentLocation?.place).toBe('Toronto, Canada');
  });

  it('table missing (migration not applied): never asks, the reading is unaffected', async () => {
    const store = new MemoryClarifyStore();
    const locationStore = new MemoryUserLocationStore(false);
    const b = await beginClarify(prisma, store, 'u1', 'When will I get married?', { asOf: AS_OF, locationStore });
    const a = await answerClarify(prisma, store, 'u1', b.runId, '6m', true, { locationStore });
    expect('error' in a ? a.error : a.event?.type).toBe('propose');
    const c = await confirmAndBuildIntent(store, 'u1', b.runId);
    if ('error' in c) throw new Error(c.error);
    expect(c.intent?.currentLocation).toBeUndefined();
  });

  it('a store that reads but cannot write is not asked again in this process', async () => {
    const store = new MemoryClarifyStore();
    const locationStore: UserLocationStore = { get: async () => ({ status: 'none' }), save: async () => false };
    const b = await beginClarify(prisma, store, 'u9', 'When will I get married?', { asOf: AS_OF, locationStore });
    await answerClarify(prisma, store, 'u9', b.runId, '6m', true, { locationStore });
    const l = await answerClarify(prisma, store, 'u9', b.runId, 'Pune', false, { locationStore });
    expect('error' in l ? l.error : l.event?.type).toBe('propose');
    const b2 = await beginClarify(prisma, store, 'u9', 'When will I get married?', { asOf: AS_OF, locationStore });
    const a2 = await answerClarify(prisma, store, 'u9', b2.runId, '6m', true, { locationStore });
    expect('error' in a2 ? a2.error : a2.event?.type).toBe('propose');
  });

  it('a non-timing question never asks for the location', async () => {
    const b = await beginClarify(prisma, new MemoryClarifyStore(), 'u1', 'Should I change jobs this year?', { asOf: AS_OF, locationStore: new MemoryUserLocationStore() });
    expect(b.event).toBeNull();
    expect(b.state.status).toBe('READY');
  });
});
