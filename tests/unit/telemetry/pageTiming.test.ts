import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  extractGraphqlOperation,
  normalizePagePath,
  pageTimingMiddleware,
  registerPageTimingRoutes,
  sweepPageExecutionLogs,
} from '../../../src/telemetry/pageTiming.js';
import { assertOwnAccount } from '../../../src/graphql/rbac.js';
import { activeFields, PLAIN_BY_CONSTRUCTION, SEALED_MODELS } from '../../../src/lib/pii/fields.js';

function createFakePrisma() {
  const created: Array<Record<string, unknown>> = [];
  const createdMany: Array<Record<string, unknown>> = [];
  const prisma = {
    pageExecutionLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: 'log-1', ...data };
      }),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        createdMany.push(...data);
        return { count: data.length };
      }),
    },
    auth: {
      findUnique: vi.fn(async () => ({
        id: 'u-1',
        username: 'asha',
        email: 'asha@example.com',
        role: 'user',
        name: 'Asha',
        profile_complete: true,
        email_verified_at: new Date(),
        gender: 'female',
        date_of_birth: '1990-01-15',
        time_of_birth: '08:30',
        country_code: 'IN',
        city: 'Pune',
        language: 'en',
        locked_at: null,
      })),
    },
    kundli: {
      findFirst: vi.fn(async () => ({
        id: 'k-1',
        biodata: { ascendant: 'Leo' },
        queue_status: 'completed',
      })),
    },
    kundliData: {
      findMany: vi.fn(async () => []),
    },
    userGeneratedContent: {
      findFirst: vi.fn(async () => ({
        remedies: [{ title: 'Sun Arghya' }],
        mantras: [{ title: 'Gayatri' }],
        routines: [{ title: 'Morning' }],
        created_at: new Date('2026-11-06T00:00:00Z'),
        kundli_id: 'k-1',
      })),
    },
  } as unknown as PrismaClient;

  return { prisma, created, createdMany };
}

afterEach(() => {
  delete process.env.PAGE_TIMING_ENABLED;
  delete process.env.PAGE_SLOW_THRESHOLD_MS;
  delete process.env.PAGE_TIMING_RETENTION_DAYS;
});

describe('normalizePagePath & extractGraphqlOperation', () => {
  it('normalizes canonical paths and strips query/hash fragments', () => {
    expect(normalizePagePath('/dashboard/charts?tab=d9#top')).toEqual({
      pagePath: '/dashboard/charts',
      routePattern: '/dashboard/charts',
    });
    expect(normalizePagePath('/dashboard')).toEqual({
      pagePath: '/dashboard/chat',
      routePattern: '/dashboard/chat',
    });
    expect(normalizePagePath('/profile/timeline/')).toEqual({
      pagePath: '/profile/timeline',
      routePattern: '/profile/timeline',
    });
  });

  it('infers canonical page from GraphQL operation name when header is absent', () => {
    expect(normalizePagePath(null, '/graphql', 'myCharts')).toEqual({
      pagePath: '/dashboard/charts',
      routePattern: '/dashboard/charts',
    });
    expect(normalizePagePath(null, '/graphql', 'myContent')).toEqual({
      pagePath: '/dashboard/mantras',
      routePattern: '/dashboard/mantras',
    });
    expect(normalizePagePath(null, '/graphql', 'loginWithMagicLink')).toEqual({
      pagePath: '/signin',
      routePattern: '/signin',
    });
    expect(normalizePagePath(null, '/api/chat/ask-stream', 'askStream')).toEqual({
      pagePath: '/dashboard/chat',
      routePattern: '/dashboard/chat',
    });
  });

  it('extracts GraphQL operation name from operationName or top-level selection without leaking args', () => {
    expect(
      extractGraphqlOperation({
        operationName: 'MyBiodataQuery',
        query: 'query MyBiodataQuery { myBiodata { success } }',
      })
    ).toBe('MyBiodataQuery');

    expect(
      extractGraphqlOperation({
        query: 'mutation { loginWithMagicLink(email: "secret@example.com", code: "123456") { token } }',
      })
    ).toBe('loginWithMagicLink');
  });
});

describe('pageTimingMiddleware & routes', () => {
  it('records server request execution time, TTFB, body bytes, and Server-Timing header', async () => {
    process.env.PAGE_SLOW_THRESHOLD_MS = '200';
    const { prisma, created } = createFakePrisma();
    const app = express();
    app.use(express.json());
    app.use(pageTimingMiddleware(prisma, async () => 'u-1'));
    app.post('/graphql', (req, res) => {
      res.status(200).json({ data: { myCharts: { success: true } } });
    });

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Astra-Page': '/dashboard/charts',
          'X-Astra-Session': 'sess-abc',
        },
        body: JSON.stringify({ query: 'query { myCharts { success } }' }),
      });
      expect(resp.status).toBe(200);
      expect(resp.headers.get('server-timing')).toMatch(/^app;dur=\d+/);

      // wait briefly for finish handler promise
      await new Promise((r) => setTimeout(r, 30));
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        user_id: 'u-1',
        session_id: 'sess-abc',
        page: '/dashboard/charts',
        source: 'graphql',
        method: 'POST',
        operation: 'myCharts',
        status_code: 200,
      });
      expect(typeof created[0]!.duration_ms).toBe('number');
      expect(typeof created[0]!.body_bytes).toBe('number');
      expect((created[0]!.body_bytes as number) > 10).toBe(true);
    } finally {
      server.close();
    }
  });

  it('ingests client page render & draw timing batches via POST /api/telemetry/page-timings', async () => {
    process.env.PAGE_SLOW_THRESHOLD_MS = '500';
    const { prisma, createdMany } = createFakePrisma();
    const app = express();
    app.use(express.json());
    registerPageTimingRoutes(app, {
      prisma,
      optionalUser: async () => 'u-1',
      requireUser: async () => 'u-1',
    });

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const badResp = await fetch(`http://127.0.0.1:${port}/api/telemetry/page-timings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [] }),
      });
      expect(badResp.status).toBe(400);

      const okResp = await fetch(`http://127.0.0.1:${port}/api/telemetry/page-timings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Astra-Session': 'sess-web-1',
        },
        body: JSON.stringify({
          entries: [
            {
              pagePath: '/dashboard/charts',
              source: 'client_render',
              operation: 'routeTransition',
              durationMs: 640,
              renderMs: 180,
              drawMs: 460,
            },
            {
              pagePath: '/dashboard/mantras',
              source: 'client_render',
              operation: 'routeTransition',
              durationMs: 120,
              renderMs: 45,
              drawMs: 75,
            },
          ],
        }),
      });
      expect(okResp.status).toBe(200);
      const body = (await okResp.json()) as { ok: boolean; recorded: number };
      expect(body).toEqual({ ok: true, recorded: 2 });
      expect(createdMany).toHaveLength(2);
      expect(createdMany[0]).toMatchObject({
        page: '/dashboard/charts',
        source: 'client_render',
        duration_ms: 640,
        render_ms: 180,
        draw_ms: 460,
        session_id: 'sess-web-1',
        user_id: 'u-1',
      });
      expect((createdMany[0]!.meta as { slowCount: number }).slowCount).toBe(1);
      expect((createdMany[1]!.meta as { slowCount: number }).slowCount).toBe(0);

      // Also accepts the documented { sessionId, timings: [{ page, cacheStatus }] } payload contract
      const timingsResp = await fetch(`http://127.0.0.1:${port}/api/telemetry/page-timings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess-body-99',
          timings: [
            {
              page: '/dashboard/chat?thread=1',
              source: 'client_render',
              operation: 'routeTransition',
              durationMs: 140,
              cacheStatus: 'hit',
            },
          ],
        }),
      });
      expect(timingsResp.status).toBe(200);
      expect(createdMany).toHaveLength(3);
      expect(createdMany[2]).toMatchObject({
        page: '/dashboard/chat',
        session_id: 'sess-body-99',
        cache_status: 'hit',
        duration_ms: 140,
      });
    } finally {
      server.close();
    }
  });

  it('streams progressive NDJSON sections via GET /api/dashboard/sections-stream and logs per-section timing', async () => {
    const { prisma, created } = createFakePrisma();
    const app = express();
    app.use(express.json());
    registerPageTimingRoutes(app, {
      prisma,
      optionalUser: async () => 'u-1',
      requireUser: async () => 'u-1',
    });

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const resp = await fetch(
        `http://127.0.0.1:${port}/api/dashboard/sections-stream?sections=profile,biodata,content`,
        {
          headers: {
            'X-Astra-Page': '/dashboard/charts',
            'X-Astra-Session': 'sess-stream-1',
          },
        }
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('content-type')).toContain('application/x-ndjson');
      const text = await resp.text();
      const lines = text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { section: string; ok: boolean; durationMs: number; ms: number; data: unknown });
      expect(lines).toHaveLength(3);
      expect(lines.map((l) => l.section).sort()).toEqual(['biodata', 'content', 'profile']);
      expect(lines.every((l) => l.ok && typeof l.ms === 'number')).toBe(true);
      expect(created).toHaveLength(3);
      expect(created.map((c) => (c.meta as { sectionKey?: string }).sectionKey).sort()).toEqual(['biodata', 'content', 'profile']);
    } finally {
      server.close();
    }
  });

  it('isolates a failing section in GET /api/dashboard/sections-stream without leaking DB details or breaking sibling sections', async () => {
    const { prisma, created } = createFakePrisma();
    (prisma.kundli.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('FATAL: terminating connection due to statement timeout on table kundlis')
    );
    const app = express();
    app.use(express.json());
    registerPageTimingRoutes(app, {
      prisma,
      optionalUser: async () => 'u-1',
      requireUser: async () => 'u-1',
    });

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const resp = await fetch(
        `http://127.0.0.1:${port}/api/dashboard/sections-stream?sections=profile,biodata,content`,
        {
          headers: {
            'X-Astra-Page': '/dashboard/charts',
            'X-Astra-Session': 'sess-stream-err',
          },
        }
      );
      expect(resp.status).toBe(200);
      const text = await resp.text();
      const lines = text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { section: string; ok: boolean; data: { error?: string } });
      expect(lines).toHaveLength(3);

      const bioLine = lines.find((l) => l.section === 'biodata');
      const profileLine = lines.find((l) => l.section === 'profile');
      const contentLine = lines.find((l) => l.section === 'content');
      expect(profileLine?.ok).toBe(true);
      expect(contentLine?.ok).toBe(true);
      expect(bioLine?.ok).toBe(false);
      expect(bioLine?.data).toEqual({ error: 'Section temporarily unavailable' });
      expect(JSON.stringify(bioLine)).not.toContain('statement timeout');

      const bioLog = created.find((c) => (c.meta as { sectionKey?: string }).sectionKey === 'biodata');
      const profileLog = created.find((c) => (c.meta as { sectionKey?: string }).sectionKey === 'profile');
      expect(bioLog).toMatchObject({
        source: 'section_stream',
        operation: 'section:biodata',
        status_code: 500,
        error_code: 'SECTION_ERROR',
      });
      expect(profileLog).toMatchObject({
        source: 'section_stream',
        operation: 'section:profile',
        status_code: 200,
        error_code: null,
      });
    } finally {
      server.close();
    }
  });
});

describe('RBAC account isolation & PII field sealing', () => {
  it('assertOwnAccount allows matching or omitted targetUserId and rejects cross-account IDs', () => {
    expect(() => assertOwnAccount('user-123', undefined)).not.toThrow();
    expect(() => assertOwnAccount('user-123', 'user-123')).not.toThrow();
    expect(() => assertOwnAccount('user-123', 'user-999')).toThrow(/Forbidden: cross-account access denied/);
    expect(() => assertOwnAccount(null, 'user-123')).toThrow(/Not authenticated/);
  });

  it('seals ReadingFindingsCache, AreaBuild, PersonFact, and TechniqueOutput, and marks PageExecutionLog plain by construction', () => {
    expect(SEALED_MODELS.ReadingFindingsCache?.fields).toEqual({ payload: { kind: 'json' } });
    expect(SEALED_MODELS.AreaBuild?.fields).toEqual({ result: { kind: 'json' }, error: { kind: 'text' } });
    expect(SEALED_MODELS.PersonFact?.fields).toEqual({ value: { kind: 'text' } });
    expect(SEALED_MODELS.TechniqueOutput?.fields).toEqual({ output: { kind: 'json' } });
    expect(PLAIN_BY_CONSTRUCTION).toContain('PageExecutionLog');
  });

  it('every active field in SEALED_MODELS exists on the Prisma schema model with matching scalar type', () => {
    const dmmfByModel = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
    for (const modelName of Object.keys(SEALED_MODELS)) {
      const dmmfModel = dmmfByModel.get(modelName);
      expect(dmmfModel, `model ${modelName} exists in schema.prisma`).toBeDefined();
      const fieldByName = new Map(dmmfModel!.fields.map((f) => [f.name, f]));
      for (const [fieldName, col] of Object.entries(activeFields(modelName))) {
        const dmmfField = fieldByName.get(fieldName);
        expect(dmmfField, `${modelName}.${fieldName} exists in schema.prisma`).toBeDefined();
        expect(dmmfField!.type, `${modelName}.${fieldName} kind matches schema type`).toBe(
          col.kind === 'json' ? 'Json' : 'String'
        );
      }
    }
  });

  it('sweeps page_execution_logs older than retention window', async () => {
    process.env.PAGE_TIMING_RETENTION_DAYS = '14';
    let capturedWhere: unknown = null;
    const fakePrisma = {
      pageExecutionLog: {
        deleteMany: vi.fn(async ({ where }: { where: unknown }) => {
          capturedWhere = where;
          return { count: 42 };
        }),
      },
    } as unknown as PrismaClient;

    const now = new Date('2026-11-20T00:00:00.000Z');
    const deleted = await sweepPageExecutionLogs(fakePrisma, { now });
    expect(deleted).toBe(42);
    expect(capturedWhere).toEqual({
      created_at: { lt: new Date('2026-11-06T00:00:00.000Z') },
    });
  });
});
