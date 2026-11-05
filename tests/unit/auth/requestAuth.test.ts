/** Request auth (docs/admin/01 §4.1.2): the token says who, the auth row says what they may do. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { registerClarifyRoutes } from '../../../src/routes/clarifyRoutes.js';
import { authenticateRequest, forgetUser, makeOptionalUser, makeRequireUser, resetRequestAuthForTests, type AuthRow, type RequestAuthDeps } from '../../../src/auth/requestAuth.js';

const SECRET = 'request-auth-test-secret-at-least-32-chars';
const sign = (claims: Record<string, unknown>, opts: jwt.SignOptions = {}) => jwt.sign(claims, SECRET, { expiresIn: '1h', ...opts });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

function rowStore(rows: Record<string, AuthRow | null>) {
  const readRow = vi.fn(async (id: string) => (id in rows ? rows[id]! : null));
  const touchLastSeen = vi.fn(async () => undefined);
  let t = 1_000_000;
  const deps: RequestAuthDeps = { readRow, touchLastSeen, now: () => t, secret: SECRET };
  return { deps, readRow, touchLastSeen, advance: (ms: number) => (t += ms) };
}

const row = (over: Partial<AuthRow> = {}): AuthRow => ({ role: 'novice', locked_at: null, token_version: 1, last_seen_at: null, ...over });
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => resetRequestAuthForTests());
afterEach(() => vi.restoreAllMocks());

describe('authenticateRequest', () => {
  it('no token, a bad token and an expired token are nobody', async () => {
    const s = rowStore({ u1: row() });
    expect(await authenticateRequest({}, s.deps)).toEqual({ userId: null, role: null, locked: false });
    expect((await authenticateRequest(bearer('not-a-jwt'), s.deps)).userId).toBeNull();
    expect((await authenticateRequest(bearer(sign({ sub: 'u1' }, { expiresIn: -10 })), s.deps)).userId).toBeNull();
    expect(s.readRow).not.toHaveBeenCalled();
  });

  it('a token without tv works (tv = 1), and the role comes from the row, not the token', async () => {
    const s = rowStore({ u1: row({ role: 'superadmin' }) });
    const a = await authenticateRequest(bearer(sign({ sub: 'u1', role: 'user' })), s.deps);
    expect(a).toEqual({ userId: 'u1', role: 'aiastra_admin', locked: false });
  });

  it('prefers X-Astra-Authorization over Authorization, and reads fetch Headers too', async () => {
    const s = rowStore({ u1: row(), u2: row() });
    const h = new Headers({ 'X-Astra-Authorization': `Bearer ${sign({ sub: 'u2' })}`, Authorization: `Bearer ${sign({ sub: 'u1' })}` });
    expect((await authenticateRequest(h, s.deps)).userId).toBe('u2');
  });

  it('a bumped token_version revokes older tokens', async () => {
    const s = rowStore({ u1: row({ token_version: 2 }) });
    expect(await authenticateRequest(bearer(sign({ sub: 'u1', tv: 1 })), s.deps)).toMatchObject({ userId: null, reason: 'revoked' });
    expect(await authenticateRequest(bearer(sign({ sub: 'u1' })), s.deps)).toMatchObject({ userId: null, reason: 'revoked' });
    expect(await authenticateRequest(bearer(sign({ sub: 'u1', tv: 2 })), s.deps)).toMatchObject({ userId: 'u1', locked: false });
  });

  it('a locked row is locked, even with an old token', async () => {
    const s = rowStore({ u1: row({ locked_at: new Date(), token_version: 2, role: 'astrologer' }) });
    expect(await authenticateRequest(bearer(sign({ sub: 'u1', tv: 1 })), s.deps)).toEqual({ userId: 'u1', role: 'astrologer', locked: true });
  });

  it('a deleted row is nobody', async () => {
    const s = rowStore({});
    expect(await authenticateRequest(bearer(sign({ sub: 'gone' })), s.deps)).toMatchObject({ userId: null, reason: 'deleted' });
  });

  it('a database error falls back to the token role, not locked, and logs no personal data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deps: RequestAuthDeps = {
      secret: SECRET,
      readRow: async () => {
        throw Object.assign(new Error('pool timeout for u1@example.com'), { code: 'P1001' });
      },
    };
    const a = await authenticateRequest(bearer(sign({ sub: 'u1', role: 'astrologer' })), deps);
    expect(a).toEqual({ userId: 'u1', role: 'astrologer', locked: false });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]![0]);
    expect(line).toContain('P1001');
    expect(line).not.toContain('u1');
  });

  it('caches the row for 30 s: a second request does not read again', async () => {
    const s = rowStore({ u1: row() });
    const token = bearer(sign({ sub: 'u1' }));
    await authenticateRequest(token, s.deps);
    s.advance(29_000);
    await authenticateRequest(token, s.deps);
    expect(s.readRow).toHaveBeenCalledTimes(1);
    s.advance(2_000);
    await authenticateRequest(token, s.deps);
    expect(s.readRow).toHaveBeenCalledTimes(2);
  });

  it('forgetUser forces a re-read, so a lock applies at once on this instance', async () => {
    const rows: Record<string, AuthRow> = { u1: row() };
    const s = rowStore(rows);
    const token = bearer(sign({ sub: 'u1' }));
    expect((await authenticateRequest(token, s.deps)).locked).toBe(false);
    rows.u1 = row({ locked_at: new Date() });
    expect((await authenticateRequest(token, s.deps)).locked).toBe(false); // still cached
    forgetUser('u1');
    expect((await authenticateRequest(token, s.deps)).locked).toBe(true);
    expect(s.readRow).toHaveBeenCalledTimes(2);
  });

  it('writes last_seen_at at most once per 5 minutes', async () => {
    const s = rowStore({ u1: row() });
    const token = bearer(sign({ sub: 'u1' }));
    await authenticateRequest(token, s.deps);
    await authenticateRequest(token, s.deps);
    await tick();
    expect(s.touchLastSeen).toHaveBeenCalledTimes(1);
    s.advance(5 * 60_000);
    await authenticateRequest(token, s.deps);
    await tick();
    expect(s.touchLastSeen).toHaveBeenCalledTimes(2);
  });

  it('a failing last_seen_at write never reaches the request', async () => {
    const s = rowStore({ u1: row() });
    s.deps.touchLastSeen = async () => {
      throw new Error('db down');
    };
    await expect(authenticateRequest(bearer(sign({ sub: 'u1' })), s.deps)).resolves.toMatchObject({ userId: 'u1' });
    await tick();
  });
});

describe('requireUser on REST routes', () => {
  type Res = { code: number; body: unknown; headersSent: boolean; status: (c: number) => Res; json: (b: unknown) => Res };
  const fakeRes = (): Res => {
    const r: Res = {
      code: 200,
      body: null,
      headersSent: false,
      status: (c) => {
        r.code = c;
        return r;
      },
      json: (b) => {
        r.body = b;
        r.headersSent = true;
        return r;
      },
    };
    return r;
  };
  const req = (headers: Record<string, string>) => ({ headers }) as never;

  it('writes 401 unauthorized, session_revoked or account_locked and returns null', async () => {
    const s = rowStore({ ok: row(), locked: row({ locked_at: new Date() }), old: row({ token_version: 3 }) });
    const requireUser = makeRequireUser(s.deps);
    const cases: Array<[Record<string, string>, Record<string, unknown>]> = [
      [{}, { code: 'unauthorized' }],
      [bearer(sign({ sub: 'old' })), { code: 'session_revoked' }],
      [bearer(sign({ sub: 'locked' })), { code: 'account_locked', message: 'This account is locked.' }],
    ];
    for (const [headers, body] of cases) {
      const res = fakeRes();
      expect(await requireUser(req(headers), res as never)).toBeNull();
      expect(res.code).toBe(401);
      expect(res.body).toMatchObject(body);
    }
    const res = fakeRes();
    expect(await requireUser(req(bearer(sign({ sub: 'ok' }))), res as never)).toBe('ok');
    expect(res.headersSent).toBe(false);
  });

  it('optionalUser treats a locked user as nobody and never writes', async () => {
    const s = rowStore({ locked: row({ locked_at: new Date() }), ok: row() });
    const optional = makeOptionalUser(s.deps);
    expect(await optional(req(bearer(sign({ sub: 'locked' }))))).toBeNull();
    expect(await optional(req(bearer(sign({ sub: 'ok' }))))).toBe('ok');
  });
});

describe('a locked user on /api/chat/ask-stream', () => {
  let server: Server | undefined;
  afterEach(
    () =>
      new Promise<void>((resolve) => {
        if (server) server.close(() => resolve());
        else resolve();
      })
  );

  it('gets 401 account_locked before any SSE frame', async () => {
    const s = rowStore({ u1: row({ locked_at: new Date() }) });
    const requireUser = makeRequireUser(s.deps);
    const reached = vi.fn();
    const app = express();
    app.use(express.json());
    // the same shape as server.ts: requireUser first, then the stream
    app.post('/api/chat/ask-stream', async (rq, rs) => {
      const userId = await requireUser(rq, rs);
      if (!userId) return;
      reached();
      rs.setHeader('Content-Type', 'text/event-stream');
      rs.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      rs.end();
    });
    const srv = app.listen(0);
    server = srv;
    await new Promise((r) => srv.once('listening', r));
    const r = await fetch(`http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/chat/ask-stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Astra-Authorization': `Bearer ${sign({ sub: 'u1' })}` },
      body: JSON.stringify({ question: 'q' }),
    });
    const text = await r.text();
    expect(r.status).toBe(401);
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(text)).toMatchObject({ code: 'account_locked', message: 'This account is locked.' });
    expect(text).not.toContain('data:');
    expect(reached).not.toHaveBeenCalled();
  });

  it('the real /api/chat/confirm-stream route refuses a locked user before it opens the stream', async () => {
    const s = rowStore({ u1: row({ locked_at: new Date() }) });
    const app = express();
    app.use(express.json());
    // an empty prisma: the route must stop before it reads anything
    registerClarifyRoutes(app, { prisma: {} as never, requireUser: makeRequireUser(s.deps) });
    const srv = app.listen(0);
    server = srv;
    await new Promise((r) => srv.once('listening', r));
    const r = await fetch(`http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/chat/confirm-stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${sign({ sub: 'u1' })}` },
      body: JSON.stringify({ runId: 'r1' }),
    });
    const text = await r.text();
    expect(r.status).toBe(401);
    expect(JSON.parse(text)).toMatchObject({ code: 'account_locked' });
    expect(text).not.toContain('data:');
  });
});
