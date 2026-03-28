import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/kundliService.js', () => ({
  loadSystemPrompt: vi.fn().mockResolvedValue('You are a Vedic oracle.'),
}));

import * as kundliRag from '../../kundli-rag.js';
import { googleGenAiTestHarness } from '../mocks/google-generative-ai.js';
import { chatWithGemini } from '../../src/services/geminiChatService.js';
import type { PrismaClient } from '@prisma/client';

const mockKundliRow = {
  id: 'k1',
  user_id: 'user-1',
  biodata: { date: '2000-01-01' },
  d1: { chart: 'd1' },
  d7: null,
  d9: null,
  d10: null,
  charakaraka: null,
  vimsottari_dasa: null,
  narayana_dasa: null,
  created_at: new Date(),
};

describe('chatWithGemini', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalMaxOut = process.env.GEMINI_MAX_OUTPUT_TOKENS;
  const originalIncludeThoughts = process.env.GEMINI_INCLUDE_THOUGHTS;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS;
    delete process.env.GEMINI_INCLUDE_THOUGHTS;
    vi.spyOn(kundliRag, 'fetchLatestKundliForUser').mockResolvedValue(mockKundliRow);
    googleGenAiTestHarness.generateContentStream = async () => ({
      stream: (async function* () {
        yield {
          candidates: [{ content: { parts: [{ text: 'Jupiter in the 5th ' }], role: 'model' } }],
        };
        yield {
          candidates: [
            {
              content: { parts: [{ text: 'favors learning.' }], role: 'model' },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { totalTokenCount: 42 },
        };
      })(),
      response: Promise.resolve({}),
    });
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalMaxOut === undefined) delete process.env.GEMINI_MAX_OUTPUT_TOKENS;
    else process.env.GEMINI_MAX_OUTPUT_TOKENS = originalMaxOut;
    if (originalIncludeThoughts === undefined) delete process.env.GEMINI_INCLUDE_THOUGHTS;
    else process.env.GEMINI_INCLUDE_THOUGHTS = originalIncludeThoughts;
    vi.restoreAllMocks();
  });

  it('streams via LangGraph + Google SDK and concatenates answer + payloads', async () => {
    const prisma = {} as PrismaClient;
    const result = await chatWithGemini(prisma, 'user-1', 'What about education?');

    expect(result.answerText).toContain('Jupiter in the 5th favors learning.');
    expect(result.requestPayload.provider).toBe('gemini');
    expect(result.requestPayload.transport).toBe('langgraph');
    expect(result.responsePayload.provider).toBe('gemini');
    expect(result.responsePayload.streamed).toBe(true);
  });

  it('invokes onDelta for streamed text chunks', async () => {
    const deltas: string[] = [];
    const prisma = {} as PrismaClient;
    await chatWithGemini(prisma, 'user-1', 'Hi', { onDelta: (d) => deltas.push(d) });
    expect(deltas.join('')).toContain('Jupiter in the 5th');
    expect(deltas.join('')).toContain('favors learning.');
  });

  it('completes when the mock returns thought + text parts in one chunk (answer text streams)', async () => {
    googleGenAiTestHarness.generateContentStream = async () => ({
      stream: (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [
                  { text: 'First consider ', thought: true },
                  { text: 'Done.' },
                ],
                role: 'model',
              },
            },
          ],
        };
        yield {
          candidates: [
            {
              content: { parts: [{ text: '' }], role: 'model' },
              finishReason: 'STOP',
            },
          ],
        };
      })(),
      response: Promise.resolve({}),
    });

    const prisma = {} as PrismaClient;
    const result = await chatWithGemini(prisma, 'user-1', 'Hi');
    expect(result.answerText).toContain('Done.');
  });

  it('reflects GEMINI_MAX_OUTPUT_TOKENS in requestPayload metadata', async () => {
    process.env.GEMINI_MAX_OUTPUT_TOKENS = '4096';
    const prisma = {} as PrismaClient;
    const result = await chatWithGemini(prisma, 'user-1', 'Hi');
    expect(result.requestPayload.generation).toMatchObject({ maxOutputTokens: 4096 });
  });

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const prisma = {} as PrismaClient;
    await expect(chatWithGemini(prisma, 'u', 'q')).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
