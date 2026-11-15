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
  const explicitLimit = Number(env.PRISMA_POOLER_CONNECTION_LIMIT || env.PRISMA_CONNECTION_LIMIT || 0);
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
    // Render :6432 PgBouncer URLs respect explicit connection_limit or cap per-Lambda pool at connection_limit=2
    if (hasExplicitUrlLimit) {
      wanted = current;
    } else if (isLambda) {
      wanted = 2;
    } else {
      wanted = fetchers + POOL_MARGIN;
    }
  } else if (isLambda) {
    wanted = hasExplicitUrlLimit ? current : 2;
  } else {
    // Direct connection non-Lambda: keep higher connection_limit or raise to fetchers + POOL_MARGIN
    wanted = current >= (fetchers + POOL_MARGIN) ? current : (fetchers + POOL_MARGIN);
  }

  let url = rawUrl;
  if (isPooler && hasExplicitUrlLimit && explicitLimit === 0) {
    url = rawUrl;
  } else if (!isPooler && !isLambda && current >= wanted) {
    url = rawUrl;
  } else {
    url = setParam(rawUrl, 'connection_limit', String(wanted));
  }

  if (!/[?&]pool_timeout=\d+/.test(url)) url = setParam(url, 'pool_timeout', String(POOL_TIMEOUT_SECONDS));
  if (isPooler && !/[?&]pgbouncer=/.test(url)) url = setParam(url, 'pgbouncer', 'true');
  return url;
}
