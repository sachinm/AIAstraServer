/**
 * The account-change log: what the request tells us about who made the change is captured, personal values are not,
 * and a failed write never breaks the request. In-memory fakes only.
 */
import { describe, it, expect, vi } from 'vitest';
import { factsFromFetch, recordAccountEvent, subjectTag } from '../../../src/audit/accountEvents.js';

const fakeDb = (fail = false) => {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    db: {
      accountEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          if (fail) throw new Error('db down');
          rows.push(data);
          return data;
        },
      },
    } as never,
  };
};

const req = (headers: Record<string, string>) => new Request('https://api.example.com/graphql', { method: 'POST', headers });

describe('factsFromFetch', () => {
  it('reads the IP chain, user agent, language, country and request id', () => {
    const f = factsFromFetch(
      req({
        'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130',
        'accept-language': 'en-US,en;q=0.9',
        'cloudfront-viewer-country': 'US',
        'x-amzn-trace-id': 'Root=1-abc',
      })
    );
    expect(f).toMatchObject({
      ip: '203.0.113.7',
      ip_chain: '203.0.113.7, 10.0.0.1',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130',
      accept_language: 'en-US,en;q=0.9',
      country: 'US',
      request_id: 'Root=1-abc',
      path: '/graphql',
      method: 'POST',
    });
  });

  it('is null without a request, and keeps going when headers are missing', () => {
    expect(factsFromFetch(null)).toBeNull();
    expect(factsFromFetch(req({}))).toMatchObject({ ip: null, user_agent: null });
  });
});

describe('recordAccountEvent', () => {
  it('writes the actor, action, outcome, field names and where it came from', async () => {
    const { db, rows } = fakeDb();
    await recordAccountEvent(db, {
      userId: 'u1',
      action: 'plan_choice',
      fields: ['desired_plan'],
      before: { desired_plan: 'free' },
      after: { desired_plan: 'plus' },
      request: factsFromFetch(req({ 'x-forwarded-for': '198.51.100.4', 'user-agent': 'UA' })),
    });
    expect(rows[0]).toMatchObject({
      user_id: 'u1',
      actor: 'self',
      action: 'plan_choice',
      outcome: 'ok',
      fields: ['desired_plan'],
      before: { desired_plan: 'free' },
      after: { desired_plan: 'plus' },
      ip: '198.51.100.4',
      user_agent: 'UA',
    });
  });

  it('stores where the IP came from in after.ip_source', async () => {
    const { db, rows } = fakeDb();
    await recordAccountEvent(db, {
      userId: 'u1',
      action: 'sign_in',
      request: factsFromFetch(req({ 'cloudfront-viewer-address': '198.51.100.4:4431', 'x-forwarded-for': '6.6.6.6' })),
    });
    expect(rows[0]).toMatchObject({ ip: '198.51.100.4', after: { ip_source: 'viewer' } });
  });

  it('a failed write is logged and dropped, never thrown', async () => {
    const { db } = fakeDb(true);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(recordAccountEvent(db, { userId: 'u1', action: 'sign_in' })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('a long user agent is cut, so one request cannot fill the table', async () => {
    const { db, rows } = fakeDb();
    await recordAccountEvent(db, { userId: null, action: 'sign_in', request: factsFromFetch(req({ 'user-agent': 'x'.repeat(2000) })) });
    expect((rows[0]!.user_agent as string).length).toBe(300);
  });
});

describe('subjectTag', () => {
  it('links attempts on one address without storing it', () => {
    expect(subjectTag(' Asha@Example.com ')).toBe(subjectTag('asha@example.com'));
    expect(subjectTag('asha@example.com')).not.toContain('asha');
    expect(subjectTag('asha@example.com')).toHaveLength(16);
  });
});
