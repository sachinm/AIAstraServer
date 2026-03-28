import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const groqMock = vi.fn();
const geminiMock = vi.fn();

vi.mock('../../src/services/groqChatService.js', () => ({
  chatWithGroq: (...args: unknown[]) => groqMock(...args),
}));

vi.mock('../../src/services/geminiChatService.js', () => ({
  chatWithGemini: (...args: unknown[]) => geminiMock(...args),
}));

import { chatWithConfiguredProvider } from '../../src/services/chatLlmService.js';
import type { PrismaClient } from '@prisma/client';

describe('chatWithConfiguredProvider', () => {
  const originalProvider = process.env.CHAT_LLM_PROVIDER;

  beforeEach(() => {
    groqMock.mockResolvedValue({
      answerText: 'from-groq',
      requestPayload: { model: 'groq' },
      responsePayload: { ok: true },
    });
    geminiMock.mockResolvedValue({
      answerText: 'from-gemini',
      requestPayload: { provider: 'gemini' },
      responsePayload: { ok: true },
    });
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.CHAT_LLM_PROVIDER;
    else process.env.CHAT_LLM_PROVIDER = originalProvider;
    vi.clearAllMocks();
  });

  it('routes to Groq when CHAT_LLM_PROVIDER is unset', async () => {
    delete process.env.CHAT_LLM_PROVIDER;
    const prisma = {} as PrismaClient;
    const out = await chatWithConfiguredProvider(prisma, 'uid', 'hello');
    expect(out.answerText).toBe('from-groq');
    expect(groqMock).toHaveBeenCalledWith(prisma, 'uid', 'hello', undefined);
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it('routes to Groq when CHAT_LLM_PROVIDER is groq', async () => {
    process.env.CHAT_LLM_PROVIDER = 'groq';
    const prisma = {} as PrismaClient;
    await chatWithConfiguredProvider(prisma, 'uid', 'hello');
    expect(groqMock).toHaveBeenCalled();
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it('routes to Gemini when CHAT_LLM_PROVIDER is gemini (case-insensitive)', async () => {
    process.env.CHAT_LLM_PROVIDER = 'GEMINI';
    const prisma = {} as PrismaClient;
    const out = await chatWithConfiguredProvider(prisma, 'uid', 'hello');
    expect(out.answerText).toBe('from-gemini');
    expect(geminiMock).toHaveBeenCalledWith(prisma, 'uid', 'hello', undefined);
    expect(groqMock).not.toHaveBeenCalled();
  });
});
