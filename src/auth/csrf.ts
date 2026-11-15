import crypto from 'node:crypto';
import type express from 'express';
import {
  CSRF_COOKIE_NAME,
  JWT_COOKIE_NAME,
  parseCookies,
  setCsrfCookie,
} from './cookies.js';
import { bearerToken } from './requestAuth.js';

export const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXCLUDED_PATHS = new Set(['/events', '/api/telemetry/csp-report', '/health']);

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCsrfToken(cookieToken?: string, headerToken?: string): boolean {
  if (!cookieToken || !headerToken) return false;
  const bufA = Buffer.from(cookieToken);
  const bufB = Buffer.from(headerToken);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function csrfProtectionMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const cookieHeader = req.headers.cookie;
  const cookies = (req as express.Request & { cookies?: Record<string, string> }).cookies || parseCookies(cookieHeader);
  let csrfCookie = cookies[CSRF_COOKIE_NAME];

  // Auto-seed aastra_csrf cookie if missing on incoming request
  if (!csrfCookie) {
    csrfCookie = generateCsrfToken();
    setCsrfCookie(res, csrfCookie, req.headers.host || (req.headers.origin as string));
  }

  // 1. Safe methods bypass CSRF checks
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // 2. Excluded paths (webhooks, CSP reports) bypass CSRF checks
  if (CSRF_EXCLUDED_PATHS.has(req.path)) {
    return next();
  }

  // 3. Programmatic Bearer token calls bypass CSRF checks
  if (bearerToken(req.headers)) {
    return next();
  }

  // 4. Mutating request check
  const headerVal = req.headers[CSRF_HEADER_NAME] || req.headers['X-CSRF-Token'];
  const headerToken = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const hasSessionCookie = Boolean(cookies[JWT_COOKIE_NAME]);

  // If request carries a session cookie OR previously held a csrf cookie, validate double-submit
  if (hasSessionCookie || Boolean(cookies[CSRF_COOKIE_NAME])) {
    if (!validateCsrfToken(cookies[CSRF_COOKIE_NAME], headerToken)) {
      res.status(403).json({
        code: 'CSRF_INVALID',
        error: 'Invalid or missing CSRF token.',
      });
      return;
    }
  }

  next();
}
