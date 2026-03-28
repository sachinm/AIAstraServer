import { describe, expect, it } from 'vitest';
import {
  CHAT_GENERIC_PUBLIC_MESSAGE,
  CHAT_RATE_LIMIT_PUBLIC_MESSAGE,
  toPublicChatErrorMessage,
} from '../../src/services/chatPublicError.js';

describe('toPublicChatErrorMessage', () => {
  it('returns capacity message for HTTP 429 on error object', () => {
    expect(toPublicChatErrorMessage({ status: 429, message: 'nope' })).toBe(
      CHAT_RATE_LIMIT_PUBLIC_MESSAGE
    );
  });

  it('returns capacity message for statusCode 429', () => {
    expect(toPublicChatErrorMessage({ statusCode: 429 })).toBe(CHAT_RATE_LIMIT_PUBLIC_MESSAGE);
  });

  it('detects quota wording in Error message', () => {
    expect(
      toPublicChatErrorMessage(
        new Error("You exceeded your current quota, please check your plan and billing")
      )
    ).toBe(CHAT_RATE_LIMIT_PUBLIC_MESSAGE);
  });

  it('detects 429 in JSON-like error text', () => {
    expect(
      toPublicChatErrorMessage(
        new Error(`Failed to call the Gemini API: {'error': {'code': 429, 'message': 'x'}}`)
      )
    ).toBe(CHAT_RATE_LIMIT_PUBLIC_MESSAGE);
  });

  it('detects RESOURCE_EXHAUSTED', () => {
    expect(toPublicChatErrorMessage(new Error('RESOURCE_EXHAUSTED'))).toBe(
      CHAT_RATE_LIMIT_PUBLIC_MESSAGE
    );
  });

  it('returns generic message for other errors without leaking message', () => {
    expect(toPublicChatErrorMessage(new Error('Invalid API key for Groq'))).toBe(
      CHAT_GENERIC_PUBLIC_MESSAGE
    );
  });

  it('unwraps Error cause for quota detection', () => {
    const inner = new Error('rate limit exceeded');
    const outer = new Error('wrapper');
    (outer as Error & { cause?: unknown }).cause = inner;
    expect(toPublicChatErrorMessage(outer)).toBe(CHAT_RATE_LIMIT_PUBLIC_MESSAGE);
  });
});
