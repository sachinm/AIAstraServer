import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateRequest, resetRequestAuthForTests } from '../../src/auth/requestAuth.js';
import { registerChatRoutes } from '../../src/chat/chatRoutes.js';
import { chatTurnService } from '../../src/chat/chatTurnService.js';
import {
  resetRateLimiterForTests,
  resetRedisClientForTests,
  resetRedisTelemetryForTests,
  revokeUserSessionInRedis,
  setOtpLockInRedis,
  setRedisFetchForTests,
} from '../../src/lib/redis/index.js';

const ORIGINAL_ENV = { ...process.env };
const TEST_SECRET = 'phase4-e2e-test-secret-0123456789abcdef';

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('Phase 4 end-to-end Redis + Web CWV verification', () => {
  let server: ReturnType<express.Express['listen']> | null = null;

  beforeEach(() => {
    restoreEnv();
    resetRequestAuthForTests();
    resetRedisClientForTests();
    resetRateLimiterForTests();
    resetRedisTelemetryForTests();
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
    resetRequestAuthForTests();
    resetRedisClientForTests();
    resetRateLimiterForTests();
    resetRedisTelemetryForTests();
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('replays SSE turn events by sessionId + afterSeq over HTTP and enforces 403 cross-user isolation', async () => {
    const strings = new Map<string, string>();
    const lists = new Map<string, string[]>();

    function execCmd(cmd: unknown[]): unknown {
      const op = String(cmd[0] || '').toUpperCase();
      if (op === 'GET') return strings.get(String(cmd[1])) ?? null;
      if (op === 'MGET') return cmd.slice(1).map((k) => strings.get(String(k)) ?? null);
      if (op === 'SET') {
        strings.set(
          String(cmd[1]),
          typeof cmd[2] === 'string' ? cmd[2] : JSON.stringify(cmd[2])
        );
        return 'OK';
      }
      if (op === 'DEL') {
        let count = 0;
        for (const k of cmd.slice(1)) if (strings.delete(String(k))) count++;
        return count;
      }
      if (op === 'RPUSH') {
        const k = String(cmd[1]);
        const arr = lists.get(k) ?? [];
        for (const item of cmd.slice(2)) arr.push(typeof item === 'string' ? item : JSON.stringify(item));
        lists.set(k, arr);
        return arr.length;
      }
      if (op === 'LTRIM') {
        const k = String(cmd[1]);
        const arr = lists.get(k) ?? [];
        lists.set(k, arr.slice(Number(cmd[2]), Number(cmd[3]) === -1 ? undefined : Number(cmd[3]) + 1));
        return 'OK';
      }
      if (op === 'LRANGE') {
        const k = String(cmd[1]);
        return (lists.get(k) ?? []).slice(Number(cmd[2]), Number(cmd[3]) === -1 ? undefined : Number(cmd[3]) + 1);
      }
      if (op === 'EXPIRE') return 1;
      return null;
    }

    setRedisFetchForTests(async (url, init) => {
      const body = JSON.parse(String(init?.body ?? '[]'));
      if (String(url).endsWith('/pipeline')) {
        return new Response(JSON.stringify((body as unknown[][]).map((c) => ({ result: execCmd(c) }))));
      }
      return new Response(JSON.stringify({ result: execCmd(body as unknown[]) }));
    });

    // Seed Redis SSE turn as if written by another Lambda instance (activeTurns map stays untouched!)
    const turnId = 'turn-e2e-99';
    const sessionId = 'sess-e2e-99';
    strings.set(
      `sse:turn:${turnId}:meta`,
      JSON.stringify({ id: turnId, userId: 'user-a', sessionId, status: 'completed', createdAtMs: Date.now() })
    );
    strings.set(`sse:session:user-a:${sessionId}`, turnId);
    strings.set(`sse:session_turn:${sessionId}`, turnId);
    lists.set(`sse:turn:${turnId}:events`, [
      JSON.stringify({ seq: 1, type: 'token', content: { delta: 'first ' }, timestamp: '2026-11-15T00:00:00Z' }),
      JSON.stringify({ seq: 2, type: 'token', content: { delta: 'second ' }, timestamp: '2026-11-15T00:00:01Z' }),
      JSON.stringify({ seq: 3, type: 'turn_done', content: { answer: 'first second' }, timestamp: '2026-11-15T00:00:02Z' }),
    ]);

    const app = express();
    app.use(express.json());
    const fakePrisma = {
      chatTurn: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const requireTestUser = async (req: express.Request, res: express.Response) => {
      const a = await authenticateRequest(req.headers, {
        secret: TEST_SECRET,
        readRow: async (_uid) => ({
          role: 'user',
          locked_at: null,
          token_version: 1,
          last_seen_at: new Date(),
        }),
      });
      if (a.userId) return a.userId;
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    };

    registerChatRoutes(app, { prisma: fakePrisma, requireUser: requireTestUser });
    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const tokenA = jwt.sign({ sub: 'user-a', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });
    const tokenB = jwt.sign({ sub: 'user-b', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });

    // 1. Missing params -> 400
    const badReq = await fetch(`${baseUrl}/api/chat/resume-stream`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(badReq.status).toBe(400);

    // 2. Resume by ?sessionId=&afterSeq=1 -> replays seq 2 & 3 only
    const resumeOk = await fetch(
      `${baseUrl}/api/chat/resume-stream?sessionId=${sessionId}&afterSeq=1`,
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    expect(resumeOk.status).toBe(200);
    const sseBody = await resumeOk.text();
    expect(sseBody).not.toContain('id: 1\n');
    expect(sseBody).toContain('id: 2\n');
    expect(sseBody).toContain('id: 3\n');
    expect(sseBody).toContain('second ');

    // 3. Cross-user attempt -> 403 Forbidden
    const forbidden = await fetch(
      `${baseUrl}/api/chat/resume-stream?sessionId=${sessionId}&afterSeq=0`,
      { headers: { Authorization: `Bearer ${tokenB}` } }
    );
    expect(forbidden.status).toBe(403);

    // 4. Logout blacklists tokenA while isolated OTP lock for user-a-otp leaves user-b active
    await setOtpLockInRedis('user-b', new Date(Date.now() + 60_000));
    await revokeUserSessionInRedis({ userId: 'user-a', rawToken: tokenA, minTokenVersion: 2 });
    resetRequestAuthForTests();

    const afterLogout = await fetch(
      `${baseUrl}/api/chat/resume-stream?sessionId=${sessionId}`,
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    expect(afterLogout.status).toBe(401);

    // user-b stays authenticated even while otp:lock is set
    const activeTurnForB = chatTurnService.getActiveTurn('non-existent');
    expect(activeTurnForB).toBeUndefined();
    const bStillAuthed = await fetch(`${baseUrl}/api/chat/resume-stream`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(bStillAuthed.status).toBe(400); // Authenticated past requireTestUser -> reached 400 check
  });

  it('confirms Web CWV tokenFlusher and ChatSection streaming polish exist on disk', () => {
    const webRoot =
      process.env.WEB_REPO_ROOT ?? path.resolve(process.cwd(), '..', 'AIAstra_WEB');
    const flusherPath = path.join(webRoot, 'src', 'pages', 'chat-interface', 'tokenFlusher.ts');
    const chatSectionPath = path.join(webRoot, 'src', 'pages', 'chat-interface', 'ChatSection.tsx');
    expect(fs.existsSync(flusherPath)).toBe(true);
    expect(fs.existsSync(chatSectionPath)).toBe(true);
    const flusherSrc = fs.readFileSync(flusherPath, 'utf8');
    expect(flusherSrc).toContain('createTokenDeltaFlusher');
    expect(flusherSrc).toContain('requestAnimationFrame');
  });
});
