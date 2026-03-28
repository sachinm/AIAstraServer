/**
 * Maps LLM provider failures to safe user-facing strings. Never forward raw upstream
 * bodies (they leak provider names, models, and quota details).
 */

export const CHAT_RATE_LIMIT_PUBLIC_MESSAGE =
  'Our answer service is temporarily at capacity. Please try again in a few minutes.';

export const CHAT_GENERIC_PUBLIC_MESSAGE =
  "We couldn't complete your request. Please try again later.";

function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const o = err as Record<string, unknown>;
  if (typeof o.status === 'number') return o.status;
  if (typeof o.statusCode === 'number') return o.statusCode;
  return undefined;
}

/** Collect message-like text from Error chains and shallow JSON for pattern matching. */
function flattenErrorText(err: unknown, depth = 0): string {
  if (depth > 5) return '';
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const fromCause = err.cause != null ? flattenErrorText(err.cause, depth + 1) : '';
    return [err.message, fromCause].filter(Boolean).join(' ');
  }
  if (typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function isRateLimitOrQuota(httpStatus: number | undefined, text: string): boolean {
  if (httpStatus === 429) return true;
  const lower = text.toLowerCase();
  if (lower.includes('resource_exhausted')) return true;
  if (lower.includes('quota')) return true;
  if (lower.includes('rate limit') || lower.includes('rate_limit')) return true;
  if (lower.includes('too many requests')) return true;
  if (/\b429\b/.test(text)) return true;
  return false;
}

/** User-visible chat error text; logs full `err` for operators. */
export function toPublicChatErrorMessage(err: unknown): string {
  const status = getHttpStatus(err);
  const text = flattenErrorText(err);
  if (isRateLimitOrQuota(status, text)) return CHAT_RATE_LIMIT_PUBLIC_MESSAGE;
  return CHAT_GENERIC_PUBLIC_MESSAGE;
}

export function logChatProviderError(label: string, err: unknown): void {
  console.error(`[chat ${label}]`, err);
}
