/**
 * The `full` explicit-cache layout (READING_EXPLICIT_CACHE=1 + READING_CACHE_LAYOUT=full; packs/fullPrefix.ts).
 * One cached prefix per user, model and day holds system, every role and the whole evidence; each call sends a short
 * suffix. Sizes are the fake's / the pack's character estimates, not Gemini's tokenizer.
 */
import type { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { startClarify } from '../../../src/reading/clarify/machine.js';
import { prewarmNatalLayers } from '../../../src/reading/clarify/prewarm.js';
import { readingCacheLayout } from '../../../src/reading/config.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { memoryCacheRegistry } from '../../../src/reading/llm/cacheRegistry.js';
import { clearPromptCache, settlePromptCache, setCacheRegistry } from '../../../src/reading/llm/promptCache.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { reconcile } from '../../../src/reading/nodes/reconcile.js';
import type { Finding } from '../../../src/reading/nodes/specialists.js';
import { SUBJECT_IDS } from '../../../src/reading/packs/frames.js';
import {
  approxTokens,
  buildFullContext,
  clearFullContexts,
  deltaOf,
  extraEvidence,
  fullCacheLayoutActive,
  readerSuffix,
  READER_ROLES,
  roleLibrary,
  withFullEvidence,
} from '../../../src/reading/packs/fullPrefix.js';
import { buildEvidencePack, listEvidenceIds, resolveEvidence } from '../../../src/reading/packs/selector.js';
import { runReading } from '../../../src/reading/run.js';
import type { Intent } from '../../../src/reading/types.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const SYSTEM = 'PERSONA\n\nMETHOD';
/** Uncached input a call may send in the full layout. */
const SUFFIX_MAX = 1500;

const prisma = { readingPrompt: { findFirst: vi.fn().mockResolvedValue(null) }, systemPrompt: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
const env0 = { ...process.env };
let fake: FakeGemini;

beforeAll(async () => {
  fake = await startFakeGemini({ chunkDelayMs: 0 });
});
afterAll(async () => fake.close());
beforeEach(() => {
  Object.assign(process.env, {
    GEMINI_API_KEY: 'test-key',
    GEMINI_API_URL: fake.url,
    GEMINI_FLASH_MODEL_ID: 'gemini-2.5-flash',
    READING_FACTS_SOURCE: 'fixture',
    READING_INTAKE_MODE: 'rules',
    READING_EXPLICIT_CACHE: '1',
    READING_CACHE_LAYOUT: 'full',
  });
  delete process.env.READING_FLOW;
  fake.reset();
  clearPromptCache();
  clearFullContexts();
  clearReadingCaches();
  findingsCache.clear();
  setCacheRegistry(memoryCacheRegistry());
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
  Object.assign(process.env, env0);
  setCacheRegistry(undefined);
});

const intentFor = (subject: (typeof SUBJECT_IDS)[number], horizon: Intent['horizon']): Intent =>
  ({ subjects: [{ id: subject, weight: 1 }], horizon, mentionsPlanets: [], focusPoints: [], questionType: 'timing', format: 'direct', confidence: 1, clarifyText: '', followUps: [], safety: 'ok' }) as unknown as Intent;
const full = () => buildFullContext({ dossier, transits, asOf: G1_AS_OF, system: SYSTEM });
const uncached = (u: { promptTokens: number; cachedTokens: number }) => u.promptTokens - u.cachedTokens;

describe('switches', () => {
  it('base is the default layout; full needs both READING_EXPLICIT_CACHE=1 and READING_CACHE_LAYOUT=full', () => {
    delete process.env.READING_CACHE_LAYOUT;
    expect(readingCacheLayout()).toBe('base');
    expect(fullCacheLayoutActive()).toBe(false);
    process.env.READING_CACHE_LAYOUT = 'full';
    expect(fullCacheLayoutActive()).toBe(true);
    delete process.env.READING_EXPLICIT_CACHE;
    expect(fullCacheLayoutActive()).toBe(false);
  });
});

describe('the cached prefix', () => {
  it('is byte-stable, carries no question or subject text, and rolls over with the date', () => {
    const a = full();
    clearFullContexts();
    const b = full();
    expect(b.prefix).toBe(a.prefix);
    expect(a.prefix).toContain(`EVIDENCE AS OF: ${G1_AS_OF}`);
    expect(a.prefix).not.toMatch(/QUESTION:|ROLE: \w+\n(TODAY|FRAME)/);
    const next = buildFullContext({ dossier, transits, asOf: '2026-10-25', system: SYSTEM });
    expect(next.prefix).not.toBe(a.prefix);
    expect(next.hash).not.toBe(a.hash);
  });

  it('holds every role block, the writer and every answer template', () => {
    const lib = roleLibrary();
    for (const r of [...READER_ROLES, 'writer', 'single']) expect(lib).toContain(`=== ROLE: ${r} ===`);
    for (let t = 1; t <= 10; t++) expect(lib).toContain(`Template T${t} —`);
    expect(lib).toContain('Format `direct`');
    // each reader is told which sections to read
    expect(lib).toMatch(/=== ROLE: promise ===\n\nReads: base, detail, varga, arudha/);
  });

  it('holds the whole evidence: all 12 houses, every varga, every antardasha, today\'s transits; and clears the 4,096-token minimum', () => {
    const f = full();
    const ev = f.evidence as Record<string, any>;
    expect(Object.keys(ev.detail.houses)).toHaveLength(12);
    expect(Object.keys(ev.varga).sort()).toEqual(Object.keys(dossier.vargas).sort());
    const ads = dossier.dasha.vimshottari.periods.filter((p) => p.level === 'ad').length;
    expect(Object.keys(ev.dasha.periods).length).toBeGreaterThanOrEqual(ads);
    expect(ev.transits.rows).toBeTruthy();
    expect(ev.frame).toBeUndefined();
    expect(f.approxTokens).toBeGreaterThan(4096 + 800);
    // eslint-disable-next-line no-console
    console.log(`full prefix (estimate, chars/3.6): ${f.approxTokens} tokens; role library ${approxTokens(roleLibrary())}; evidence ${JSON.stringify(Object.fromEntries(Object.entries(f.evidence).map(([k, v]) => [k, approxTokens(JSON.stringify(v))])))}`);
  });
});

describe('suffixes and grounding', () => {
  const horizons: Intent['horizon'][] = ['now', '3m', '6m', '1y', '3y', 'life', { from: '2027-03-01', to: '2027-06-01' }];

  it(`every reader's suffix stays under ${SUFFIX_MAX} tokens for every subject and horizon`, () => {
    const f = full();
    const worst: Record<string, number> = {};
    for (const h of horizons) {
      for (const subject of SUBJECT_IDS) {
        const intent = intentFor(subject, h);
        const pack = buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent });
        for (const role of ['promise', 'dasha', 'transit', 'nakshatra'] as const) {
          const t = approxTokens(readerSuffix({ role, subject, pack, intent, question: 'When will I get a better paid job?', asOf: G1_AS_OF, full: f }));
          worst[role] = Math.max(worst[role] ?? 0, t);
          expect(t).toBeLessThan(SUFFIX_MAX);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`largest reader suffix over all subjects and horizons (estimate): ${JSON.stringify(worst)}`);
  });

  it('a subject pack adds nothing for the natal readers at the cached horizon (only the frame is sent)', () => {
    const f = full();
    const pack = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent: intentFor('career_work', '1y') });
    expect(extraEvidence(f, pack, 'promise')).toEqual({});
    expect(extraEvidence(f, pack, 'dasha')).toEqual({});
  });

  it('per-question data (transit at a date, prashna, year chart) is sent as extra evidence', () => {
    const f = full();
    const pack = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent: intentFor('career_work', '1y') });
    const withAt = { ...pack, sections: { ...pack.sections, transit_at: { at: '2027-03-01 12:00:00', d1: { Sa: 1 } } } };
    expect(extraEvidence(f, withAt, 'transit')).toMatchObject({ transit_at: { at: '2027-03-01 12:00:00' } });
    expect(deltaOf({ a: [1, 2, 3], b: { c: 1 } }, { a: [2], b: { c: 1, d: 2 } })).toEqual({ b: { d: 2 } });
  });

  it('every id of a subject pack resolves to the same value in the overlay the grounding gate checks', () => {
    const f = full();
    for (const subject of SUBJECT_IDS) {
      for (const h of horizons) {
        const pack = buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent: intentFor(subject, h) });
        const over = withFullEvidence(pack, f);
        for (const id of listEvidenceIds(pack)) expect(JSON.stringify(resolveEvidence(over, id))).toBe(JSON.stringify(resolveEvidence(pack, id)));
      }
    }
  });

  it('a claim citing cached evidence outside the subject pack survives grounding only in the full layout', () => {
    const f = full();
    const subject = 'career_work';
    const intent = intentFor(subject, '1y');
    const pack = buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent });
    const outside = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((h) => !pack.keyFrame.houses.includes(h))!;
    const id = `detail.houses.${outside}.lord`;
    expect(resolveEvidence(pack, id)).toBeUndefined();
    const finding = { analyst: 'promise', subject, verdict: 'moderate', layerScore: 1, status: 'ok', claims: [{ text: 'A claim about a non-frame house lord.', evidence: [id], polarity: 'neutral', weight: 1, tradition: 'parashara' }], windows: [], caveats: [], keyFacts: [] } as unknown as Finding;
    const base = reconcile({ findings: [finding], packs: { [subject]: pack }, intent, asOf: G1_AS_OF, keyFacts: '', dossier, transits });
    const fullRec = reconcile({ findings: [finding], packs: { [subject]: withFullEvidence(pack, f) }, intent, asOf: G1_AS_OF, keyFacts: '', dossier, transits });
    expect(base.droppedClaims).toBe(1);
    expect(fullRec.droppedClaims).toBe(0);
  });
});

describe('runReading in the full layout (fake Gemini)', () => {
  const nonIntake = () => fake.requests.filter((r) => !r.body?.generationConfig?.responseSchema?.properties?.subjects);

  it('the first question starts one cache and runs in the base layout; the next one sends every reader and the writer through that cache with a short suffix', async () => {
    const q = 'Should I change jobs this year?';
    const first = await runReading(prisma, 'u1', q, { asOf: G1_AS_OF, flow: 'graph' });
    expect(first.record.cache.layout).toBe('full');
    await settlePromptCache();
    expect(fake.cacheCreates).toHaveLength(1);
    const created = fake.cacheCreates[0] as { model: string; contents: Array<{ parts: Array<{ text: string }> }>; systemInstruction: { parts: Array<{ text: string }> } };
    expect(created.model).toBe('models/gemini-2.5-flash');
    expect(created.contents[0]!.parts[0]!.text).toMatch(/^ROLE LIBRARY/);
    expect(created.contents[0]!.parts[0]!.text).not.toContain(q);

    fake.reset();
    findingsCache.clear();
    const second = await runReading(prisma, 'u1', 'When will I get a promotion?', { asOf: G1_AS_OF, flow: 'graph' });
    await settlePromptCache();
    expect(fake.cacheCreates).toHaveLength(0);
    const calls = nonIntake();
    expect(calls.length).toBeGreaterThanOrEqual(4); // 3+ readers and the writer
    const names = new Set(calls.map((r) => r.body.cachedContent));
    expect(names.size).toBe(1);
    expect([...names][0]).toMatch(/^cachedContents\/fake-/);
    expect(calls.every((r) => r.body.systemInstruction === undefined)).toBe(true);
    expect(calls.some((r) => r.stream && /^ROLE: writer/.test(r.body.contents[0].parts[0].text))).toBe(true);
    const sizes: Record<string, { prompt: number; cached: number; uncached: number }> = {};
    const used = second.record.usage.filter((x) => x.node !== 'intake');
    for (const u of used) sizes[u.node] = { prompt: u.promptTokens, cached: u.cachedTokens, uncached: uncached(u) };
    // the writer's suffix also carries the readers' findings brief, which this run produced and so cannot be cached;
    // the layout's own share (role id, calendar, shape reference, question) is what has to stay small
    const writerText: string = calls.find((r) => r.stream)!.body.contents[0].parts[0].text;
    const findingsBlock = /SPECIALIST FINDINGS[\s\S]*?(?=\n\nCALENDAR|\n\nTODAY)/.exec(writerText)?.[0] ?? '';
    const findingsTokens = Math.ceil(findingsBlock.length / 3.2);
    expect(findingsTokens).toBeGreaterThan(0);
    for (const u of used) {
      const own = u.node === 'synthesize' ? uncached(u) - findingsTokens : uncached(u);
      expect(own).toBeLessThan(SUFFIX_MAX);
      expect(u.cachedTokens).toBeGreaterThan(10_000);
    }
    expect(second.record.cache.cachedShare).toBeGreaterThan(0.9);
    // eslint-disable-next-line no-console
    console.log(`full layout, graph, fake Gemini (chars/3.2): ${JSON.stringify(sizes)}; writer findings brief ${findingsTokens}; cachedShare ${second.record.cache.cachedShare} (first question ${first.record.cache.cachedShare})`);
  });

  it('a writer on another model gets its own cache with the same layout', async () => {
    process.env.READING_MODEL_SYNTH = 'gemini-2.5-pro';
    await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'graph' });
    await settlePromptCache();
    expect(fake.cacheCreates).toHaveLength(2);
    const [a, b] = fake.cacheCreates as Array<{ model: string; contents: unknown }>;
    expect(new Set([a!.model, b!.model])).toEqual(new Set(['models/gemini-2.5-flash', 'models/gemini-2.5-pro']));
    expect(JSON.stringify(a!.contents)).toBe(JSON.stringify(b!.contents));
    fake.reset();
    findingsCache.clear();
    await runReading(prisma, 'u1', 'When will I get a promotion?', { asOf: G1_AS_OF, flow: 'graph' });
    const writer = fake.requests.find((r) => r.stream)!;
    const reader = fake.requests.find((r) => !r.stream && /^ROLE: (promise|dasha|transit)/.test(r.body.contents?.[0]?.parts?.[0]?.text ?? ''))!;
    expect(writer.body.cachedContent).toBeTruthy();
    expect(reader.body.cachedContent).toBeTruthy();
    expect(writer.body.cachedContent).not.toBe(reader.body.cachedContent);
  });

  it('a new day makes a new cache (transits stay correct)', async () => {
    await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'single' });
    await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: '2026-10-25', flow: 'single' });
    await settlePromptCache();
    expect(fake.cacheCreates).toHaveLength(2);
    const texts = (fake.cacheCreates as Array<{ contents: Array<{ parts: Array<{ text: string }> }> }>).map((c) => c.contents[0]!.parts[0]!.text);
    expect(texts[0]).toContain(`EVIDENCE AS OF: ${G1_AS_OF}`);
    expect(texts[1]).toContain('EVIDENCE AS OF: 2026-10-25');
  });

  it('clarify start prewarms the cache, so the first single-flow question already hits it', async () => {
    process.env.READING_FLOW = 'single';
    const q = 'When will I get married?';
    const s = startClarify(q, G1_AS_OF, classifyRules(q, G1_AS_OF), { mode: 'when_missing', threshold: 0.7, card: null });
    await prewarmNatalLayers(prisma, 'u1', s);
    expect(fake.cacheCreates).toHaveLength(1);
    const r = await runReading(prisma, 'u1', q, { asOf: G1_AS_OF, flow: 'single' });
    const call = fake.requests.find((x) => x.stream)!;
    expect(call.body.cachedContent).toBe('cachedContents/fake-1');
    expect(call.body.contents[0].parts[0].text).toMatch(/^ROLE: single/);
    // eslint-disable-next-line no-console
    console.log(`full layout, single flow after prewarm (chars/3.2): uncached ${uncached(r.record.usage.at(-1)!)} of ${r.record.usage.at(-1)!.promptTokens}`);
    expect(uncached(r.record.usage.at(-1)!)).toBeLessThan(SUFFIX_MAX);
  });

  it('with the base layout nothing changes: the base chart is the cached part and no role library is stored', async () => {
    delete process.env.READING_CACHE_LAYOUT;
    await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'graph' });
    await runReading(prisma, 'u1', 'When will I get a promotion?', { asOf: G1_AS_OF, flow: 'graph' });
    await settlePromptCache();
    expect(fake.cacheCreates.length).toBeGreaterThan(0);
    for (const c of fake.cacheCreates as Array<{ contents: Array<{ parts: Array<{ text: string }> }> }>) expect(c.contents[0]!.parts[0]!.text).toMatch(/^\{"base":/);
  });
});
