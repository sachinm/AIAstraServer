import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockUndiciFetch } = vi.hoisted(() => ({
  mockUndiciFetch: vi.fn(),
}));

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  return { ...actual, fetch: mockUndiciFetch };
});

vi.mock('../../src/services/kundliService.js', () => ({
  loadSystemPrompt: vi.fn().mockResolvedValue('You are a Vedic oracle.'),
}));

import * as kundliRag from '../../kundli-rag.js';
import { chatWithGemini } from '../../src/services/geminiChatService.js';
import type { PrismaClient } from '@prisma/client';

/** Minimal SSE body as returned for `streamGenerateContent?alt=sse`. */
function geminiSseOk(chunks: string[]) {
  const sse = chunks.map((json) => `data: ${json}\n\n`).join('');
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    }),
  };
}

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

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS;
    vi.spyOn(kundliRag, 'fetchLatestKundliForUser').mockResolvedValue(mockKundliRow);
    mockUndiciFetch.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalMaxOut === undefined) delete process.env.GEMINI_MAX_OUTPUT_TOKENS;
    else process.env.GEMINI_MAX_OUTPUT_TOKENS = originalMaxOut;
    vi.restoreAllMocks();
  });

  it('calls Gemini streamGenerateContent (SSE) and concatenates deltas + payloads', async () => {
    mockUndiciFetch.mockResolvedValue(
      geminiSseOk([
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Jupiter in the 5th ' }], role: 'model' } }],
        }),
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'favors learning.' }], role: 'model' },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { totalTokenCount: 42 },
        }),
      ])
    );

    const prisma = {} as PrismaClient;
    const result = await chatWithGemini(prisma, 'user-1', 'What about education?');

    expect(result.answerText).toContain('Jupiter in the 5th favors learning.');
    expect(result.requestPayload.provider).toBe('gemini');
    expect(result.requestPayload.stream).toBe(true);
    expect(result.requestPayload.systemInstruction).toBeDefined();
    expect(result.responsePayload.provider).toBe('gemini');
    expect(result.responsePayload.streamed).toBe(true);
    expect(mockUndiciFetch).toHaveBeenCalledTimes(1);
    const call = mockUndiciFetch.mock.calls[0];
    expect(String(call[0])).toContain('streamGenerateContent');
    expect(String(call[0])).toContain('alt=sse');
    expect(String(call[0])).toContain('key=test-gemini-key');
    expect((call[1] as { method?: string })?.method).toBe('POST');
    expect((call[1] as { dispatcher?: unknown }).dispatcher).toBeDefined();
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.generationConfig?.maxOutputTokens).toBe(8192);
  });

  it('invokes onDelta for each streamed text chunk', async () => {
    mockUndiciFetch.mockResolvedValue(
      geminiSseOk([
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'aa' }] } }] }),
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'bb' }] } }] }),
      ])
    );
    const deltas: string[] = [];
    const prisma = {} as PrismaClient;
    await chatWithGemini(prisma, 'user-1', 'Hi', { onDelta: (d) => deltas.push(d) });
    expect(deltas).toEqual(['aa', 'bb']);
    expect(deltas.join('')).toContain('aabb');
  });

  it('uses GEMINI_MAX_OUTPUT_TOKENS when set', async () => {
    process.env.GEMINI_MAX_OUTPUT_TOKENS = '4096';
    mockUndiciFetch.mockResolvedValue(
      geminiSseOk([
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
        }),
      ])
    );

    const prisma = {} as PrismaClient;
    await chatWithGemini(prisma, 'user-1', 'Hi');
    const body = JSON.parse((mockUndiciFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.generationConfig?.maxOutputTokens).toBe(4096);
  });

  it('throws when Gemini returns non-OK HTTP', async () => {
    mockUndiciFetch.mockResolvedValue({
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
    expect(mockUndiciFetch).not.toHaveBeenCalled();
  });
});
