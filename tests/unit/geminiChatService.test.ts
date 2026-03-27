import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/kundliService.js', () => ({
  loadSystemPrompt: vi.fn().mockResolvedValue('You are a Vedic oracle.'),
}));

import * as kundliRag from '../../kundli-rag.js';
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
  const originalFetch = globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    vi.spyOn(kundliRag, 'fetchLatestKundliForUser').mockResolvedValue(mockKundliRow);
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('calls Gemini generateContent and returns answer text + payloads', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Jupiter in the 5th favors learning.' }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { totalTokenCount: 42 },
        }),
    });

    const prisma = {} as PrismaClient;
    const result = await chatWithGemini(prisma, 'user-1', 'What about education?');

    expect(result.answerText).toContain('Jupiter');
    expect(result.requestPayload.provider).toBe('gemini');
    expect(result.requestPayload.systemInstruction).toBeDefined();
    expect(result.responsePayload.provider).toBe('gemini');
    expect(result.responsePayload.streamed).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toContain('key=test-gemini-key');
    expect((call[1] as { method?: string })?.method).toBe('POST');
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.generationConfig?.maxOutputTokens).toBe(8192);
  });

  it('throws when Gemini returns non-OK HTTP', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: { message: 'Invalid API key', code: 400 },
        }),
    });

    const prisma = {} as PrismaClient;
    await expect(chatWithGemini(prisma, 'u', 'q')).rejects.toThrow(/Invalid API key/);
  });

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const prisma = {} as PrismaClient;
    await expect(chatWithGemini(prisma, 'u', 'q')).rejects.toThrow(/GEMINI_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
