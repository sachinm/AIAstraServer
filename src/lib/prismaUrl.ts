/** Parallel chart fetches one process runs at most (the worker's cap), when env sets nothing higher. */
const DEFAULT_FETCHERS = 4;
/** The request's own reads and one spare, on top of the fetchers. */
const POOL_MARGIN = 2;
const POOL_TIMEOUT_SECONDS = 20;
const POOLER_PORT = ':6432';

function setParam(url: string, name: string, value: string): string {
  const pattern = new RegExp(`([?&])${name}=[^&]*`);
  if (pattern.test(url)) return url.replace(pattern, `$1${name}=${value}`);
  return `${url}${url.includes('?') ? '&' : '?'}${name}=${value}`;
}

/**
 * The URL Prisma connects with (docs/reading-engine/38 §4.1 flow D). The pool holds every parallel chart fetch plus the
 * request's own reads, so fetchers do not queue on each other. A higher connection_limit already in the URL is kept. The
 * pool wait stays under the shortest chart-build deadline, and the Render pooler port gets Prisma's pgbouncer mode.
 */
export function prismaPoolUrl(rawUrl: string, env: Record<string, string | undefined> = process.env): string {
  const fetchers = Math.max(DEFAULT_FETCHERS, Number(env.CHART_DATA_FETCH_CONCURRENCY) || 0, Number(env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER) || 0);
  const wanted = fetchers + POOL_MARGIN;
  const current = Number(/[?&]connection_limit=(\d+)/.exec(rawUrl)?.[1] ?? 0);
  let url = current >= wanted ? rawUrl : setParam(rawUrl, 'connection_limit', String(wanted));
  if (!/[?&]pool_timeout=\d+/.test(url)) url = setParam(url, 'pool_timeout', String(POOL_TIMEOUT_SECONDS));
  const authority = url.split('?')[0]!;
  if (authority.includes(POOLER_PORT) && !/[?&]pgbouncer=/.test(url)) url = setParam(url, 'pgbouncer', 'true');
  return url;
}
