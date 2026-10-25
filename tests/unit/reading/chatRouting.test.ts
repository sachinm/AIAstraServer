import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { legacyMock, groqMock } = vi.hoisted(() => ({ legacyMock: vi.fn(), groqMock: vi.fn() }));
vi.mock('../../../src/services/geminiChatService.js', () => ({ chatWithGemini: legacyMock }));
vi.mock('../../../src/services/groqChatService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/groqChatService.js')>();
  return { ...actual, chatWithGroq: groqMock };
});

import { chatWithConfiguredProvider } from '../../../src/services/chatLlmService.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

const legacyResult = { answerText: 'legacy answer', requestPayload: { provider: 'gemini' }, responsePayload: { content: 'legacy answer' } };
let fake: FakeGemini;
const env0 = { ...process.env };

beforeEach(async () => {
  clearReadingCaches();
  legacyMock.mockReset().mockResolvedValue(legacyResult);
  groqMock.mockReset().mockResolvedValue(legacyResult);
  fake = await startFakeGemini({});
  process.env.CHAT_LLM_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'k';
  process.env.GEMINI_API_URL = fake.url;
  process.env.READING_INTAKE_MODE = 'rules';
  process.env.READING_FLOW = 'single';
});
afterEach(async () => {
  await fake.close();
  for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
  Object.assign(process.env, env0);
});

const emptyDb = { kundli: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;

describe('chat routing', () => {
  it('keeps the legacy path when READING_ENGINE is off (kill switch)', async () => {
    process.env.READING_ENGINE = '0';
    const r = await chatWithConfiguredProvider(emptyDb, 'u1', 'When will I get married?');
    expect(r.answerText).toBe('legacy answer');
    expect(legacyMock).toHaveBeenCalledTimes(1);
    expect(fake.requests).toHaveLength(0);
  });

  it('falls back to the legacy path when the dossier is not available, and says so', async () => {
    process.env.READING_ENGINE = '1';
    const onEvent = vi.fn();
    const r = await chatWithConfiguredProvider(emptyDb, 'u1', 'When will I get married?', { onEvent });
    expect(r.answerText).toBe('legacy answer');
    expect(legacyMock).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls.some(([e]) => e.type === 'info' && e.reason === 'dossier_missing')).toBe(true);
    expect(onEvent.mock.calls.some(([e]) => e.type === 'intent')).toBe(true);
  });

  it('does not fall back when fallback is disabled', async () => {
    process.env.READING_ENGINE = '1';
    process.env.READING_FALLBACK_LEGACY = '0';
    await expect(chatWithConfiguredProvider(emptyDb, 'u1', 'When will I get married?')).rejects.toThrow(/not available/);
    expect(legacyMock).not.toHaveBeenCalled();
  });

  it('answers through the reading engine when the dossier is available', async () => {
    process.env.READING_ENGINE = '1';
    process.env.READING_FACTS_SOURCE = 'fixture';
    const deltas: string[] = [];
    const r = await chatWithConfiguredProvider(emptyDb, 'u1', 'When will I get married?', { onDelta: (d) => deltas.push(d) });
    expect(r.reading?.flow).toBe('single');
    expect(r.requestPayload.engine).toBe('reading');
    expect(deltas.length).toBeGreaterThan(1);
    expect(legacyMock).not.toHaveBeenCalled();
  });

  it('does not use the reading engine for the Groq provider', async () => {
    process.env.READING_ENGINE = '1';
    process.env.CHAT_LLM_PROVIDER = 'groq';
    const r = await chatWithConfiguredProvider(emptyDb, 'u1', 'hello');
    expect(r.answerText).toBe('legacy answer');
    expect(groqMock).toHaveBeenCalledTimes(1);
  });
});
