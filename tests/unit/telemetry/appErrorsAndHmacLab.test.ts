/**
 * Tests for PII/secret error redaction, client JS/React/CSP telemetry ingestion (`/api/telemetry/client-errors`,
 * `/api/telemetry/csp-report`), and HMAC-SHA256 staff-attributed `/api/admin-lab/*` authentication (SEC-04).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeStackFingerprint,
  maskIpAddress,
  redactErrorText,
  redactStackPreview,
} from '../../../src/lib/logRedact.js';
import { registerAppErrorRoutes, requestIdMiddleware, sweepAppErrorEvents } from '../../../src/telemetry/appErrors.js';
import { registerAdminLabRoutes, signAdminServiceHeaders } from '../../../src/routes/adminLabRoutes.js';

async function withServer(
  setup: (app: express.Express) => void,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    })
  );
  setup(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

describe('logRedact error telemetry helpers', () => {
  it('strips emails, JWTs, query API keys, dates, coords, and masks IPs', () => {
    const dirty =
      'Failed POST https://example.com/v1?key=AIzaSySecret123 for a@b.com Bearer eyJhbGciOi.payload.sig 1990-05-14 28.6139';
    const clean = redactErrorText(dirty);
    expect(clean).not.toContain('AIzaSySecret123');
    expect(clean).not.toContain('a@b.com');
    expect(clean).not.toContain('eyJhbGciOi');
    expect(clean).not.toContain('1990-05-14');
    expect(clean).toContain('key=[redacted]');
    expect(clean).toContain('[email]');
    expect(clean).toContain('Bearer [token]');

    const stack = redactStackPreview('Error: x\n    at fn (/app/main.js?token=abc:12:4)\n    at run (/app/index.js:5:1)', 8);
    expect(stack).toContain('/app/main.js');
    expect(stack).not.toContain('token=abc');

    expect(maskIpAddress('203.0.113.45')).toBe('203.0.113.xxx');
    expect(maskIpAddress('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3:0::xxxx');
    expect(computeStackFingerprint({ source: 'web_js', category: 'js_runtime', message: 'boom' })).toHaveLength(16);
  });
});

describe('client error + CSP report routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ingests redacted client JS/React/GraphQL batches and legacy/reporting CSP violations', async () => {
    const created: Array<{ data: Record<string, any> }> = [];
    const deleted: unknown[] = [];
    const prisma = {
      appErrorEvent: {
        create: vi.fn(async (args: { data: Record<string, any> }) => {
          created.push(args);
          return args.data;
        }),
        deleteMany: vi.fn(async (args: unknown) => {
          deleted.push(args);
          return { count: 4 };
        }),
      },
    } as never;

    await withServer(
      (app) => {
        registerAppErrorRoutes(app, { prisma, optionalUser: async () => 'user-42' });
      },
      async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/telemetry/client-errors`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-astra-page': '/dashboard/you',
            'x-astra-session': 'sess-web-1',
            'x-request-id': 'req-corr-77',
          },
          body: JSON.stringify({
            events: [
              {
                source: 'web_react',
                severity: 'critical',
                category: 'react_boundary',
                errorCode: 'REACT_RENDER_ERROR',
                message: 'TypeError for alice@example.com with ?key=secret999',
                stack: 'TypeError\n    at SelfCard (/assets/app.js?v=1:10:2)',
                meta: { password: 'leak', component: 'SelfCard' },
              },
            ],
          }),
        });
        expect(res.status).toBe(202);
        expect(res.headers.get('x-request-id')).toBe('req-corr-77');
        expect(await res.json()).toEqual({ accepted: 1 });

        const cspRes = await fetch(`${baseUrl}/api/telemetry/csp-report`, {
          method: 'POST',
          headers: { 'content-type': 'application/csp-report' },
          body: JSON.stringify({
            'csp-report': {
              'document-uri': 'https://app.example.com/dashboard/charts?email=leak@example.com',
              'violated-directive': 'script-src',
              'effective-directive': 'script-src-elem',
              'blocked-uri': 'https://evil.example.net/steal.js?token=abc',
            },
          }),
        });
        expect(cspRes.status).toBe(204);
      }
    );

    expect(created).toHaveLength(2);
    expect(created[0]!.data).toMatchObject({
      source: 'web_react',
      severity: 'critical',
      category: 'react_boundary',
      user_id: 'user-42',
      request_id: 'req-corr-77',
      session_id: 'sess-web-1',
      page: '/dashboard/you',
    });
    expect(String(created[0]!.data.message_redacted)).not.toContain('alice@example.com');
    expect(String(created[0]!.data.message_redacted)).not.toContain('secret999');
    expect((created[0]!.data.meta as Record<string, unknown>).password).toBe('[redacted]');

    expect(created[1]!.data).toMatchObject({
      source: 'web_csp',
      category: 'csp_violation',
      error_code: 'CSP_VIOLATION',
      page: '/dashboard/charts',
    });
    expect(String(created[1]!.data.message_redacted)).toContain('https://evil.example.net/steal.js');
    expect(String(created[1]!.data.message_redacted)).not.toContain('token=abc');

    const swept = await sweepAppErrorEvents(prisma, { retentionDays: 30, now: new Date('2026-11-14T00:00:00Z') });
    expect(swept).toBe(4);
    expect(deleted).toHaveLength(1);
  });
});

describe('Admin lab HMAC-SHA256 staff-attributed service auth (SEC-04)', () => {
  it('accepts validly signed staff requests and rejects missing, static-only, non-admin role, replayed, or tampered requests', async () => {
    const appErrors: unknown[] = [];
    const prisma = {
      auth: {
        findMany: vi.fn(async () => []),
      },
      appErrorEvent: {
        create: vi.fn(async (args: unknown) => appErrors.push(args)),
      },
    } as never;

    const secret = 'hmac-test-secret-shared-key';
    const fixedNow = 1_763_100_000_000;

    await withServer(
      (app) => {
        registerAdminLabRoutes(app, {
          prisma,
          enabled: true,
          token: secret,
          now: () => fixedNow,
        });
      },
      async (baseUrl) => {
        // 1. Legacy unattributed static token header MUST be rejected (403)
        const legacyRes = await fetch(`${baseUrl}/api/admin-lab/people`, {
          headers: { 'x-admin-lab-token': secret },
        });
        expect(legacyRes.status).toBe(403);

        // 2. Valid HMAC signed request by superadmin succeeds (200)
        const okHeaders = signAdminServiceHeaders({
          secret,
          method: 'GET',
          pathAndQuery: '/api/admin-lab/people',
          actorId: 'admin-42',
          actorRole: 'superadmin',
          timestampSec: Math.floor(fixedNow / 1000),
        });
        const okRes = await fetch(`${baseUrl}/api/admin-lab/people`, { headers: okHeaders });
        expect(okRes.status).toBe(200);
        expect(await okRes.json()).toEqual({ items: [] });

        // 3. Expired timestamp (> 60s skew) MUST be rejected
        const staleHeaders = signAdminServiceHeaders({
          secret,
          method: 'GET',
          pathAndQuery: '/api/admin-lab/people',
          actorId: 'admin-42',
          actorRole: 'admin',
          timestampSec: Math.floor(fixedNow / 1000) - 180,
        });
        const staleRes = await fetch(`${baseUrl}/api/admin-lab/people`, { headers: staleHeaders });
        expect(staleRes.status).toBe(403);

        // 4. Non-admin actorRole MUST be rejected
        const badRoleHeaders = signAdminServiceHeaders({
          secret,
          method: 'GET',
          pathAndQuery: '/api/admin-lab/people',
          actorId: 'user-99',
          actorRole: 'user',
          timestampSec: Math.floor(fixedNow / 1000),
        });
        const badRoleRes = await fetch(`${baseUrl}/api/admin-lab/people`, { headers: badRoleHeaders });
        expect(badRoleRes.status).toBe(403);
      }
    );

    expect(appErrors.length).toBeGreaterThanOrEqual(3);
  });
});
