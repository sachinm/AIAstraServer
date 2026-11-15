import { describe, expect, it, vi } from 'vitest';
import {
  parseCookies,
  serializeCookie,
  getCookieDomain,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
  clearCsrfCookie,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
} from '../../../src/auth/cookies.js';
import {
  generateCsrfToken,
  validateCsrfToken,
  csrfProtectionMiddleware,
} from '../../../src/auth/csrf.js';

describe('cookies utilities', () => {
  it('parses cookies header correctly', () => {
    const header = `${SESSION_COOKIE_NAME}=jwt123; ${CSRF_COOKIE_NAME}=csrf456; other=abc`;
    const parsed = parseCookies(header);
    expect(parsed[SESSION_COOKIE_NAME]).toBe('jwt123');
    expect(parsed[CSRF_COOKIE_NAME]).toBe('csrf456');
    expect(parsed.other).toBe('abc');
  });

  it('determines cookie domain correctly based on request origin/host', () => {
    expect(getCookieDomain({ headers: { host: 'localhost:4000' } })).toBeUndefined();
    expect(getCookieDomain({ headers: { host: '127.0.0.1:4000' } })).toBeUndefined();
    expect(getCookieDomain({ headers: { host: 'api.vedic-astrology.app' } })).toBe('.vedic-astrology.app');
    expect(getCookieDomain({ headers: { origin: 'https://staging.vedic-astrology.app' } })).toBe('.vedic-astrology.app');
  });

  it('serializes cookies with appropriate security attributes', () => {
    const cookie = serializeCookie('test', 'value', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });
    expect(cookie).toContain('test=value');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=3600');
  });

  it('sets and clears session and CSRF cookies on response objects', () => {
    const headers: Record<string, string[]> = {};
    const res = {
      getHeader: (name: string) => headers[name.toLowerCase()],
      setHeader: (name: string, val: string | string[]) => {
        headers[name.toLowerCase()] = Array.isArray(val) ? val : [val];
      },
    };

    setSessionCookie(res, 'jwt.token.here', { headers: { host: 'api.vedic-astrology.app' } });
    expect(headers['set-cookie']?.some((c) => c.includes(SESSION_COOKIE_NAME) && c.includes('HttpOnly'))).toBe(true);

    setCsrfCookie(res, 'csrf_token_here', { headers: { host: 'api.vedic-astrology.app' } });
    expect(headers['set-cookie']?.some((c) => c.includes(CSRF_COOKIE_NAME) && !c.includes('HttpOnly'))).toBe(true);

    clearSessionCookie(res, { headers: { host: 'localhost:4000' } });
    expect(headers['set-cookie']?.some((c) => c.includes(SESSION_COOKIE_NAME) && c.includes('Max-Age=0'))).toBe(true);

    clearCsrfCookie(res, { headers: { host: 'localhost:4000' } });
    expect(headers['set-cookie']?.some((c) => c.includes(CSRF_COOKIE_NAME) && c.includes('Max-Age=0'))).toBe(true);
  });
});

describe('csrf protection', () => {
  it('generates valid 32-byte hex tokens and validates them with constant-time equality', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(validateCsrfToken(token, token)).toBe(true);
    expect(validateCsrfToken(token, 'invalid_token')).toBe(false);
    expect(validateCsrfToken(token, undefined)).toBe(false);
  });

  it('middleware allows safe methods and sets CSRF cookie if absent', () => {
    const req: any = { method: 'GET', url: '/api/chat/status', headers: {} };
    const res: any = {
      getHeader: () => undefined,
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    csrfProtectionMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.arrayContaining([expect.stringContaining(CSRF_COOKIE_NAME)])
    );
  });

  it('middleware blocks mutating requests missing valid CSRF token when session cookie is present', () => {
    const csrfToken = generateCsrfToken();
    const req: any = {
      method: 'POST',
      url: '/api/chat/ask',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=valid_jwt; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: () => undefined,
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    // Missing header
    csrfProtectionMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_INVALID' }));
    expect(next).not.toHaveBeenCalled();

    // Valid header passes
    res.status.mockClear();
    res.json.mockClear();
    req.headers['x-csrf-token'] = csrfToken;
    csrfProtectionMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('middleware allows programmatic API requests with Bearer token header', () => {
    const req: any = {
      method: 'POST',
      url: '/api/v1/resource',
      headers: {
        authorization: 'Bearer programmatic_token_value',
      },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: () => undefined,
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    csrfProtectionMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
