import { describe, expect, it } from 'vitest';
import { prismaPoolUrl } from '../../src/lib/prismaUrl.js';

const direct = 'postgresql://u:p@db.example.com:5432/app';
const pooler = 'postgresql://u:p@db.example.com:6432/app';

describe('prismaPoolUrl', () => {
  it('sizes the pool for the fetchers plus the request, and caps the pool wait', () => {
    expect(prismaPoolUrl(direct, {})).toBe(`${direct}?connection_limit=6&pool_timeout=20`);
  });

  it('raises a limit that is too low, wherever it sits in the query string', () => {
    expect(prismaPoolUrl(`${direct}?connection_limit=1&sslmode=require`, {})).toBe(`${direct}?connection_limit=6&sslmode=require&pool_timeout=20`);
  });

  it('follows a higher fetch concurrency from env', () => {
    expect(prismaPoolUrl(direct, { CHART_DATA_FETCH_CONCURRENCY: '6' })).toContain('connection_limit=8');
    expect(prismaPoolUrl(direct, { KUNDLI_QUEUE_MAX_FETCHES_PER_USER: '8' })).toContain('connection_limit=10');
  });

  it('keeps a higher limit and a pool_timeout already in the URL', () => {
    expect(prismaPoolUrl(`${direct}?connection_limit=12&pool_timeout=9`, {})).toBe(`${direct}?connection_limit=12&pool_timeout=9`);
  });

  it('turns on pgbouncer mode only on the pooler port', () => {
    expect(prismaPoolUrl(pooler, {})).toContain('pgbouncer=true');
    expect(prismaPoolUrl(direct, {})).not.toContain('pgbouncer');
    expect(prismaPoolUrl(`${pooler}?pgbouncer=false`, {})).not.toContain('pgbouncer=true');
  });

  it('does not take a port-like value in a parameter for the pooler port', () => {
    expect(prismaPoolUrl(`${direct}?application_name=x:6432`, {})).not.toContain('pgbouncer');
  });
});
