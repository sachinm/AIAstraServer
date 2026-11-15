import type express from 'express';

export const JWT_COOKIE_NAME = 'aastra_jwt';
export const SESSION_COOKIE_NAME = JWT_COOKIE_NAME;
export const CSRF_COOKIE_NAME = 'aastra_csrf';
export const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 seconds (30 days)
export const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE_SECONDS * 1000;

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | 'Lax' | 'Strict' | 'None';
  path?: string;
  maxAge?: number; // in seconds
  expires?: Date;
  domain?: string;
}

/** Parses standard Cookie header string into key-value map without third-party dependencies. */
export function parseCookies(cookieHeader: string | undefined | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].trim();
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

/** Determines cookie domain. Returns '.vedic-astrology.app' if host matches, else undefined (host-only). */
export function getCookieDomain(reqOrHost?: string | { headers?: Record<string, any> } | null): string | undefined {
  if (!reqOrHost) return undefined;
  const hostOrOrigin =
    typeof reqOrHost === 'string'
      ? reqOrHost
      : (reqOrHost.headers?.host as string) || (reqOrHost.headers?.origin as string) || '';
  if (!hostOrOrigin || typeof hostOrOrigin !== 'string') return undefined;
  const cleaned = hostOrOrigin.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
  if (cleaned === 'vedic-astrology.app' || cleaned.endsWith('.vedic-astrology.app')) {
    return '.vedic-astrology.app';
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
    const expires = new Date(Date.now() + options.maxAge * 1000);
    cookie += `; Expires=${expires.toUTCString()}`;
  } else if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  if (options.httpOnly) cookie += '; HttpOnly';
  if (options.secure) cookie += '; Secure';
  if (options.sameSite) {
    const s = options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1).toLowerCase();
    cookie += `; SameSite=${s}`;
  }
  return cookie;
}

function appendSetCookie(
  res: express.Response | { setHeader?: (name: string, val: string | string[]) => void; getHeader?: (name: string) => unknown },
  cookieStr: string
): void {
  if (typeof res.setHeader === 'function') {
    const existing = res.getHeader?.('Set-Cookie') || res.getHeader?.('set-cookie');
    if (!existing) {
      res.setHeader('Set-Cookie', [cookieStr]);
    } else if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, cookieStr]);
    } else {
      res.setHeader('Set-Cookie', [String(existing), cookieStr]);
    }
  }
}

export function setSessionCookie(
  res: express.Response | { setHeader?: (name: string, val: string | string[]) => void; getHeader?: (name: string) => unknown },
  token: string,
  hostOrOrigin?: string | { headers?: Record<string, any> } | null
): string {
  const domain = getCookieDomain(hostOrOrigin);
  const cookieStr = serializeCookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  });

  if ('cookie' in res && typeof (res as express.Response).cookie === 'function') {
    (res as express.Response).cookie(JWT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
      ...(domain ? { domain } : {}),
    });
  } else {
    appendSetCookie(res, cookieStr);
  }
  return cookieStr;
}

export function clearSessionCookie(
  res: express.Response | { setHeader?: (name: string, val: string | string[]) => void; getHeader?: (name: string) => unknown },
  hostOrOrigin?: string | { headers?: Record<string, any> } | null
): string {
  const domain = getCookieDomain(hostOrOrigin);
  const cookieStr = serializeCookie(JWT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    ...(domain ? { domain } : {}),
  });

  if ('clearCookie' in res && typeof (res as express.Response).clearCookie === 'function') {
    (res as express.Response).clearCookie(JWT_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    });
  } else {
    appendSetCookie(res, cookieStr);
  }
  return cookieStr;
}

export function setCsrfCookie(
  res: express.Response | { setHeader?: (name: string, val: string | string[]) => void; getHeader?: (name: string) => unknown },
  token: string,
  hostOrOrigin?: string | { headers?: Record<string, any> } | null
): string {
  const domain = getCookieDomain(hostOrOrigin);
  const cookieStr = serializeCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // MUST be accessible to JavaScript
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  });

  if ('cookie' in res && typeof (res as express.Response).cookie === 'function') {
    (res as express.Response).cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
      ...(domain ? { domain } : {}),
    });
  } else {
    appendSetCookie(res, cookieStr);
  }
  return cookieStr;
}

export function clearCsrfCookie(
  res: express.Response | { setHeader?: (name: string, val: string | string[]) => void; getHeader?: (name: string) => unknown },
  hostOrOrigin?: string | { headers?: Record<string, any> } | null
): string {
  const domain = getCookieDomain(hostOrOrigin);
  const cookieStr = serializeCookie(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    ...(domain ? { domain } : {}),
  });

  if ('clearCookie' in res && typeof (res as express.Response).clearCookie === 'function') {
    (res as express.Response).clearCookie(CSRF_COOKIE_NAME, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    });
  } else {
    appendSetCookie(res, cookieStr);
  }
  return cookieStr;
}
