import { describe, it, expect } from 'vitest';
import {
  collectRequestAuditMeta,
  getClientIp,
  redactGraphqlBodyForLog,
} from '../../src/lib/requestMeta.js';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://api.example.com/graphql', { headers });
}

describe('requestMeta', () => {
  it('extracts client IP from proxy headers', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.1, 10.0.0.1',
    });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('collects audit metadata from standard headers', () => {
    const req = makeRequest({
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://app.example.com',
      'cf-ipcountry': 'US',
      'cf-connecting-ip': '198.51.100.10',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"iOS"',
      'x-request-id': 'req-abc-123',
    });

    const meta = collectRequestAuditMeta(req);
    expect(meta.clientIp).toBe('198.51.100.10');
    expect(meta.countryCode).toBe('US');
    expect(meta.origin).toBe('https://app.example.com');
    expect(meta.deviceClass).toBe('mobile');
    expect(meta.browser).toBe('Safari');
    expect(meta.os).toBe('iOS');
    expect(meta.requestId).toBe('req-abc-123');
  });

  it('redacts sensitive GraphQL variables before logging', () => {
    const redacted = redactGraphqlBodyForLog({
      operationName: 'Login',
      variables: {
        username: 'user@example.com',
        password: 'secret123',
        turnstileToken: '0.abc.turnstile.token.here',
        input: { password: 'nested-secret' },
      },
    });

    expect(redacted).toContain('user@example.com');
    expect(redacted).not.toContain('secret123');
    expect(redacted).not.toContain('nested-secret');
    expect(redacted).toContain('[REDACTED]');
  });
});
