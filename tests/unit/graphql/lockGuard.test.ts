/** GraphQL lock-out (docs/admin/01 §4.1.2): a locked account runs `me` and `logout` only. */
import { describe, expect, it } from 'vitest';
import { createSchema, createYoga } from 'graphql-yoga';
import { parse } from 'graphql';
import { lockGuardPlugin, rootFieldNames } from '../../../src/graphql/lockGuard.js';
import { buildContext } from '../../../src/graphql/context.js';
import { resetRequestAuthForTests } from '../../../src/auth/requestAuth.js';
import jwt from 'jsonwebtoken';

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Me { id: ID!, locked: Boolean }
    type Query { me: Me, chats: [String!]! }
    type Mutation { logout: Boolean!, createChat: String! }
  `,
  resolvers: {
    Query: { me: (_: unknown, __: unknown, ctx: { userId: string; locked: boolean }) => ({ id: ctx.userId, locked: ctx.locked }), chats: () => ['c1'] },
    Mutation: { logout: () => true, createChat: () => 'c2' },
  },
});

function yoga(locked: boolean) {
  return createYoga({ schema, plugins: [lockGuardPlugin()], context: () => ({ userId: 'u1', locked }), maskedErrors: false });
}

async function run(locked: boolean, query: string, operationName?: string) {
  const r = await yoga(locked).fetch('http://x/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, operationName }) });
  return (await r.json()) as { data?: Record<string, unknown> | null; errors?: Array<{ message: string; extensions?: { code?: string } }> };
}

describe('rootFieldNames', () => {
  it('follows inline fragments, fragment spreads and the named operation', () => {
    const doc = parse('query A { me { id } } query B { ...F ... on Query { chats } } fragment F on Query { me { id } }');
    expect(rootFieldNames(doc, 'A')).toEqual(['me']);
    expect(rootFieldNames(doc, 'B')).toEqual(['me', 'chats']);
    expect(rootFieldNames(parse('{ __typename me { id } }'))).toEqual(['__typename', 'me']);
  });
});

describe('lockGuardPlugin', () => {
  it('lets a locked user run me (which reports locked) and logout', async () => {
    expect(await run(true, '{ me { id locked } }')).toEqual({ data: { me: { id: 'u1', locked: true } } });
    expect((await run(true, 'mutation { logout }')).data).toEqual({ logout: true });
  });

  it('refuses everything else with ACCOUNT_LOCKED, also when hidden next to me or in a fragment', async () => {
    for (const q of ['{ chats }', 'mutation { createChat }', '{ me { id } chats }', '{ ...F } fragment F on Query { chats }']) {
      const r = await run(true, q);
      expect(r.data ?? null).toBeNull();
      expect(r.errors?.[0]).toMatchObject({ message: 'Account locked', extensions: { code: 'ACCOUNT_LOCKED' } });
    }
  });

  it('changes nothing for an account that is not locked', async () => {
    expect((await run(false, '{ chats }')).data).toEqual({ chats: ['c1'] });
  });
});

describe('buildContext', () => {
  it('is async and takes userId, role and locked from authenticateRequest', async () => {
    resetRequestAuthForTests();
    const secret = 'context-test-secret-at-least-32-characters';
    const token = jwt.sign({ sub: 'u9', role: 'user' }, secret);
    const request = new Request('http://x/graphql', { headers: { 'X-Astra-Authorization': `Bearer ${token}` } });
    const ctx = await buildContext({ request }, { secret, readRow: async () => ({ role: 'admin', locked_at: new Date(), token_version: 1, last_seen_at: new Date() }) });
    expect(ctx).toMatchObject({ userId: 'u9', role: 'aiastra_admin', locked: true });
    const anon = await buildContext({ request: new Request('http://x/graphql') });
    expect(anon).toMatchObject({ userId: null, role: null, locked: false });
  });
});
