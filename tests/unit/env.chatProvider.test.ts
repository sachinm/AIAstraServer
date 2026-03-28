import { describe, it, expect, afterEach } from 'vitest';
import {
  getChatLlmProvider,
  getGeminiGenerateContentUrl,
  getGeminiStreamGenerateContentUrl,
  getGeminiChatModelId,
  getGeminiModelsBaseUrl,
  getGeminiMaxOutputTokens,
  getGeminiThinkingBudget,
  getGeminiUndiciBodyTimeoutMs,
  getGeminiUndiciHeadersTimeoutMs,
} from '../../src/config/env.js';

describe('chat LLM env helpers', () => {
  const saved: Record<string, string | undefined> = {};

  function save(key: string) {
    saved[key] = process.env[key];
  }

  function restore() {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  afterEach(() => {
    restore();
  });

  it('getChatLlmProvider defaults to groq', () => {
    save('CHAT_LLM_PROVIDER');
    delete process.env.CHAT_LLM_PROVIDER;
    expect(getChatLlmProvider()).toBe('groq');
  });

  it('getChatLlmProvider returns gemini when set', () => {
    save('CHAT_LLM_PROVIDER');
    process.env.CHAT_LLM_PROVIDER = 'gemini';
    expect(getChatLlmProvider()).toBe('gemini');
  });

  it('getGeminiGenerateContentUrl joins base and model', () => {
    save('GEMINI_API_URL');
    save('GEMINI_FLASH_MODEL_ID');
    process.env.GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
    process.env.GEMINI_FLASH_MODEL_ID = 'gemini-test-model';
    expect(getGeminiGenerateContentUrl()).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent'
    );
    expect(getGeminiStreamGenerateContentUrl()).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:streamGenerateContent'
    );
  });

  it('getGeminiModelsBaseUrl strips trailing slash', () => {
    save('GEMINI_API_URL');
    process.env.GEMINI_API_URL = 'https://example.com/models/';
    expect(getGeminiModelsBaseUrl()).toBe('https://example.com/models');
  });

  it('getGeminiChatModelId uses default when unset', () => {
    save('GEMINI_FLASH_MODEL_ID');
    delete process.env.GEMINI_FLASH_MODEL_ID;
    expect(getGeminiChatModelId()).toBe('gemini-2.5-flash');
  });

  it('getGeminiMaxOutputTokens defaults to 8192 when unset', () => {
    save('GEMINI_MAX_OUTPUT_TOKENS');
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS;
    expect(getGeminiMaxOutputTokens()).toBe(8192);
  });

  it('getGeminiMaxOutputTokens reads GEMINI_MAX_OUTPUT_TOKENS', () => {
    save('GEMINI_MAX_OUTPUT_TOKENS');
    process.env.GEMINI_MAX_OUTPUT_TOKENS = '16384';
    expect(getGeminiMaxOutputTokens()).toBe(16384);
  });

  it('Gemini undici timeouts default to 600000ms when unset', () => {
    save('GEMINI_HTTP_TIMEOUT_MS');
    save('GEMINI_FETCH_HEADERS_TIMEOUT_MS');
    save('GEMINI_FETCH_BODY_TIMEOUT_MS');
    delete process.env.GEMINI_HTTP_TIMEOUT_MS;
    delete process.env.GEMINI_FETCH_HEADERS_TIMEOUT_MS;
    delete process.env.GEMINI_FETCH_BODY_TIMEOUT_MS;
    expect(getGeminiUndiciHeadersTimeoutMs()).toBe(600_000);
    expect(getGeminiUndiciBodyTimeoutMs()).toBe(600_000);
  });

  it('GEMINI_HTTP_TIMEOUT_MS sets both undici timeouts', () => {
    save('GEMINI_HTTP_TIMEOUT_MS');
    save('GEMINI_FETCH_HEADERS_TIMEOUT_MS');
    save('GEMINI_FETCH_BODY_TIMEOUT_MS');
    delete process.env.GEMINI_FETCH_HEADERS_TIMEOUT_MS;
    delete process.env.GEMINI_FETCH_BODY_TIMEOUT_MS;
    process.env.GEMINI_HTTP_TIMEOUT_MS = '450000';
    expect(getGeminiUndiciHeadersTimeoutMs()).toBe(450_000);
    expect(getGeminiUndiciBodyTimeoutMs()).toBe(450_000);
  });

  it('getGeminiThinkingBudget defaults to 8192 when unset', () => {
    save('GEMINI_THINKING_BUDGET');
    delete process.env.GEMINI_THINKING_BUDGET;
    expect(getGeminiThinkingBudget()).toBe(8192);
  });

  it('getGeminiThinkingBudget clamps above API max (24576)', () => {
    save('GEMINI_THINKING_BUDGET');
    process.env.GEMINI_THINKING_BUDGET = '50000';
    expect(getGeminiThinkingBudget()).toBe(24_576);
  });
});
