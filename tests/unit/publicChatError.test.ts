import { describe, expect, it } from 'vitest';
import {
  PUBLIC_CHAT_QUOTA_MESSAGE,
  publicMessageFromChatProviderError,
} from '../../src/services/publicChatError.js';

describe('publicMessageFromChatProviderError', () => {
  it('maps Google-style quota JSON snippets to the public quota message', () => {
    const raw = `{'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan'}}`;
    expect(publicMessageFromChatProviderError(new Error(raw))).toBe(PUBLIC_CHAT_QUOTA_MESSAGE);
  });

  it('maps rate limit wording', () => {
    expect(publicMessageFromChatProviderError(new Error('Rate limit exceeded'))).toBe(
      PUBLIC_CHAT_QUOTA_MESSAGE
    );
  });

  it('maps API key errors without echoing the key', () => {
    const out = publicMessageFromChatProviderError(new Error('Invalid API key'));
    expect(out).not.toMatch(/key/i);
    expect(out).toContain('temporarily unavailable');
  });

  it('maps network errors', () => {
    expect(publicMessageFromChatProviderError(new Error('fetch failed'))).toMatch(/connection|try again/i);
  });

  it('uses a generic message for unknown errors', () => {
    expect(publicMessageFromChatProviderError(new Error('Some internal bug'))).toBe(
      "We couldn't complete that request. Please try again later."
    );
  });
});
