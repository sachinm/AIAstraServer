/**
 * Cache headers for responses that carry a person's data (docs/privacy/02 §0 Q3, §4.2): no browser, CloudFront or
 * proxy may keep a copy, and the back button must not show it from the bfcache.
 */
export const NO_STORE = 'no-store';
/** Both SSE routes (`/api/chat/ask-stream`, `/api/chat/confirm-stream`); `no-transform` keeps proxies from buffering. */
export const SSE_CACHE_CONTROL = 'no-store, no-transform';

/**
 * Sets `no-store` on every response before any route runs; a route may still set its own value (the SSE routes do).
 * GraphQL is covered with or without a bearer token, because sign-in answers carry the token itself.
 */
export function noStoreMiddleware(_req: unknown, res: { setHeader(name: string, value: string): unknown }, next: () => void): void {
  res.setHeader('Cache-Control', NO_STORE);
  next();
}
