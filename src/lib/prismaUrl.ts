/** Parallel chart fetches one process runs at most (the worker's cap), when env sets nothing higher. */
const DEFAULT_FETCHERS = 4;
/** The request's own reads and one spare, on top of the fetchers. */
const POOL_MARGIN = 2;
const POOL_TIMEOUT_SECONDS = 20;
const POOLER_PORT = ':6432';
/**
 * A Lambda container's pool when no env var sets one, whatever `connection_limit` the URL carries. The deployed URL said
 * 1, so a request, its chart fetches, the registry seeds and the telemetry writes queued on one connection (53 pool
 * timeouts in 72 h, 2026-11-19). Three holds a request's reads, one chart fetch and one background write; through the
 * Render PgBouncer (:6432) these are client slots, not server connections (max_connections 103).
 * Override: PRISMA_POOLER_CONNECTION_LIMIT (or PRISMA_CONNECTION_LIMIT).
 */
export const LAMBDA_DEFAULT_POOL = 3;

function setParam(url: string, name: string, value: string): string {
  const pattern = new RegExp(`([?&])${name}=[^&]*`);
  if (pattern.test(url)) return url.replace(pattern, `$1${name}=${value}`);
  return `${url}${url.includes('?') ? '&' : '?'}${name}=${value}`;
}

/**
 * The URL Prisma connects with (docs/reading-engine/38 §4.1 flow D). The pool holds every parallel chart fetch plus the
 * request's own reads, so fetchers do not queue on each other. Off Lambda a higher connection_limit in the URL is kept. The
 * pool wait stays under the shortest chart-build deadline, and the Render pooler port gets Prisma's pgbouncer mode.
 *
 * Pool size, first match wins:
 *   1. PRISMA_POOLER_CONNECTION_LIMIT or PRISMA_CONNECTION_LIMIT (a positive integer), anywhere
 *   2. on Lambda: LAMBDA_DEFAULT_POOL (3), even when the URL says less (or more)
 *   3. off Lambda, pooler port: the URL's own limit, else fetchers + margin
 *   4. off Lambda, direct: the URL's limit when higher, else fetchers + margin
 */
export function prismaPoolUrl(rawUrl: string, env: Record<string, string | undefined> = process.env): string {
  const envLimit = Number(env.PRISMA_POOLER_CONNECTION_LIMIT || env.PRISMA_CONNECTION_LIMIT || 0);
  const explicitLimit = Number.isFinite(envLimit) && envLimit >= 1 ? Math.floor(envLimit) : 0;
  const isLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME || env.LAMBDA_TASK_ROOT);

  const authority = rawUrl.split('?')[0]!;
  const isPooler = authority.includes(POOLER_PORT) || /:6432(?:\/|$)/.test(authority);

  const currentMatch = /[?&]connection_limit=(\d+)/.exec(rawUrl);
  const current = currentMatch ? Number(currentMatch[1]) : 0;
  const hasExplicitUrlLimit = Boolean(currentMatch && current > 0);

  const fetchers = Math.max(DEFAULT_FETCHERS, Number(env.CHART_DATA_FETCH_CONCURRENCY) || 0, Number(env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER) || 0);

  let wanted: number;
  if (explicitLimit > 0) {
    wanted = explicitLimit;
  } else if (isPooler) {
    wanted = isLambda ? LAMBDA_DEFAULT_POOL : hasExplicitUrlLimit ? current : fetchers + POOL_MARGIN;
  } else if (isLambda) {
    wanted = LAMBDA_DEFAULT_POOL;
  } else {
    // Direct connection non-Lambda: keep higher connection_limit or raise to fetchers + POOL_MARGIN
    wanted = current >= (fetchers + POOL_MARGIN) ? current : (fetchers + POOL_MARGIN);
  }

  let url = rawUrl;
  if (isPooler && hasExplicitUrlLimit && explicitLimit === 0 && !isLambda) {
    url = rawUrl;
  } else if (!isPooler && !isLambda && explicitLimit === 0 && current >= wanted) {
    url = rawUrl;
  } else {
    url = setParam(rawUrl, 'connection_limit', String(wanted));
  }

  if (!/[?&]pool_timeout=\d+/.test(url)) url = setParam(url, 'pool_timeout', String(POOL_TIMEOUT_SECONDS));
  if (isPooler && !/[?&]pgbouncer=/.test(url)) url = setParam(url, 'pgbouncer', 'true');
  return url;
}
