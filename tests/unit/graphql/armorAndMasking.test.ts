/**
 * Tests for GraphQL depth/alias/selection/introspection armor (SEC-05), domain-safe consumer error masking (SEC-06),
 * RBAC denial capture, and dual-plane `app_error_events` logging.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSchema, createYoga } from 'graphql-yoga';
import { parse } from 'graphql';
import {
  createGraphqlMaskError,
  graphqlArmorAndObservabilityPlugin,
  inspectGraphqlDocument,
} from '../../../src/graphql/armorAndMasking.js';
import { assertOwnAccount } from '../../../src/graphql/rbac.js';

function fakePrismaHarness() {
  const appErrors: Array<{ data: Record<string, any> }> = [];
  const accountEvents: Array<{ data: Record<string, any> }> = [];
  const prisma = {
    appErrorEvent: {
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        appErrors.push(args);
        return args.data;
      }),
    },
    accountEvent: {
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        accountEvents.push(args);
        return args.data;
      }),
    },
  } as never;
  return { prisma, appErrors, accountEvents };
}

describe('inspectGraphqlDocument', () => {
  const defaultLimits = { maxDepth: 6, maxAliases: 15, maxSelections: 250, introspectionEnabled: false };

  it('rejects queries exceeding maxDepth including fragment spreads', () => {
    const doc = parse(`
      query DeepQ {
        a { b { c { d { ...Frag } } } }
      }
      fragment Frag on Node { e { f { g } } }
    `);
    const res = inspectGraphqlDocument(doc, defaultLimits);
    expect(res).toMatchObject({ ok: false, code: 'DEPTH_LIMIT_EXCEEDED' });
  });

  it('rejects queries exceeding maxAliases', () => {
    const aliases = Array.from({ length: 16 }, (_, i) => `a${i}: ping`).join(' ');
    const doc = parse(`query AliasBomb { ${aliases} }`);
    const res = inspectGraphqlDocument(doc, defaultLimits);
    expect(res).toMatchObject({ ok: false, code: 'ALIAS_LIMIT_EXCEEDED' });
  });

  it('blocks introspection when disabled and allows it when enabled', () => {
    const doc = parse('{ __schema { types { name } } }');
    expect(inspectGraphqlDocument(doc, { ...defaultLimits, introspectionEnabled: false })).toMatchObject({
      ok: false,
      code: 'INTROSPECTION_DISABLED',
    });
    expect(inspectGraphqlDocument(doc, { ...defaultLimits, introspectionEnabled: true })).toMatchObject({
      ok: true,
    });
  });
});

describe('graphqlArmorAndObservabilityPlugin + createGraphqlMaskError', () => {
  const prevMask = process.env.GRAPHQL_MASK_ERRORS;
  const prevIntro = process.env.GRAPHQL_INTROSPECTION;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.GRAPHQL_MASK_ERRORS = prevMask;
    process.env.GRAPHQL_INTROSPECTION = prevIntro;
    process.env.NODE_ENV = prevNodeEnv;
  });

  function setupYoga(harness = fakePrismaHarness()) {
    const schema = createSchema({
      typeDefs: /* GraphQL */ `
        type Node { label: String, child: Node }
        type Query {
          ping: String!
          node: Node
          requireLogin: String!
          crossAccount(targetId: ID!): String!
          dbCrash: String!
        }
      `,
      resolvers: {
        Query: {
          ping: () => 'pong',
          node: () => ({ label: 'n1', child: { label: 'n2' } }),
          requireLogin: () => {
            throw new Error('Not authenticated');
          },
          crossAccount: (_: unknown, args: { targetId: string }) => {
            assertOwnAccount('user-a', args.targetId);
            return 'ok';
          },
          dbCrash: () => {
            throw Object.assign(
              new Error('Invalid prisma.auth.findUnique() on table auth for seeker@example.com column secret'),
              { code: 'P2002' }
            );
          },
        },
      },
    });

    const yoga = createYoga({
      schema: schema as never,
      context: ({ request }) => ({
        userId: 'user-a',
        role: 'user',
        requestId: request.headers.get('x-request-id') ?? 'req-test-123',
        request,
      }),
      plugins: [graphqlArmorAndObservabilityPlugin({ prisma: harness.prisma })],
      maskedErrors: {
        maskError: createGraphqlMaskError({ prisma: harness.prisma }),
        isDev: false,
      },
    });

    return { yoga, ...harness };
  }

  it('masks internal Prisma errors on wire with requestId while recording redacted detail + stack to app_error_events', async () => {
    process.env.GRAPHQL_MASK_ERRORS = 'true';
    const { yoga, appErrors } = setupYoga();

    const res = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-prisma-500',
        'x-astra-page': '/dashboard/you',
        'x-astra-session': 'sess-99',
      },
      body: JSON.stringify({ operationName: 'CrashTest', query: 'query CrashTest { dbCrash }' }),
    });
    const json = (await res.json()) as { errors?: Array<{ message: string; extensions?: Record<string, unknown> }> };
    expect(json.errors?.[0]?.message).toBe('Something went wrong while processing your request.');
    expect(json.errors?.[0]?.message).not.toContain('prisma');
    expect(json.errors?.[0]?.extensions).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      requestId: 'req-prisma-500',
    });

    await new Promise((r) => setTimeout(r, 15));
    expect(appErrors).toHaveLength(1);
    expect(appErrors[0]!.data).toMatchObject({
      source: 'graphql',
      category: 'graphql_resolver',
      error_code: 'P2002',
      request_id: 'req-prisma-500',
      session_id: 'sess-99',
      page: '/dashboard/you',
      user_id: 'user-a',
    });
    expect(String(appErrors[0]!.data.message_redacted)).toContain('Invalid prisma.auth.findUnique');
    expect(String(appErrors[0]!.data.message_redacted)).toContain('[email]');
    expect(String(appErrors[0]!.data.message_redacted)).not.toContain('seeker@example.com');
  });

  it('preserves UNAUTHENTICATED and FORBIDDEN domain errors and logs RBAC denial to app_error_events + account_events', async () => {
    process.env.GRAPHQL_MASK_ERRORS = 'true';
    const { yoga, appErrors, accountEvents } = setupYoga();

    const r1 = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-unauth-1' },
      body: JSON.stringify({ query: '{ requireLogin }' }),
    });
    const j1 = (await r1.json()) as { errors?: Array<{ message: string; extensions?: Record<string, unknown> }> };
    expect(j1.errors?.[0]?.message).toBe('Not authenticated');
    expect(j1.errors?.[0]?.extensions).toMatchObject({ code: 'UNAUTHENTICATED', requestId: 'req-unauth-1' });

    const r2 = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-rbac-2', 'x-astra-page': '/dashboard/charts' },
      body: JSON.stringify({ query: '{ crossAccount(targetId: "user-b") }' }),
    });
    const j2 = (await r2.json()) as { errors?: Array<{ message: string; extensions?: Record<string, unknown> }> };
    expect(j2.errors?.[0]?.message).toContain('Forbidden');
    expect(j2.errors?.[0]?.extensions).toMatchObject({ code: 'FORBIDDEN', requestId: 'req-rbac-2' });

    await new Promise((r) => setTimeout(r, 15));
    expect(appErrors.some((e) => e.data.source === 'rbac' && e.data.category === 'rbac_denied' && e.data.request_id === 'req-rbac-2')).toBe(true);
    expect(accountEvents.some((e) => e.data.action === 'rbac_denied' && e.data.outcome === 'refused')).toBe(true);
  });

  it('strips Did-you-mean field suggestions and blocks depth bombs + prod introspection while logging to app_error_events', async () => {
    process.env.GRAPHQL_MASK_ERRORS = 'true';
    process.env.GRAPHQL_INTROSPECTION = 'false';
    const { yoga, appErrors, accountEvents } = setupYoga();

    const resDeep = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-deep-1' },
      body: JSON.stringify({ query: '{ node { child { child { child { child { child { label } } } } } } }' }),
    });
    const jsonDeep = (await resDeep.json()) as { errors?: Array<{ extensions?: Record<string, unknown> }> };
    expect(jsonDeep.errors?.[0]?.extensions?.code).toBe('DEPTH_LIMIT_EXCEEDED');

    const resTypo = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-typo-1' },
      body: JSON.stringify({ query: '{ pin }' }),
    });
    const jsonTypo = (await resTypo.json()) as { errors?: Array<{ message: string }> };
    expect(jsonTypo.errors?.[0]?.message).not.toContain('Did you mean');

    await new Promise((r) => setTimeout(r, 15));
    expect(appErrors.some((e) => e.data.error_code === 'DEPTH_LIMIT_EXCEEDED')).toBe(true);
    expect(appErrors.some((e) => e.data.error_code === 'GRAPHQL_VALIDATION_FAILED')).toBe(true);
    expect(accountEvents.some((e) => e.data.action === 'graphql_query_blocked')).toBe(true);
  });
});
