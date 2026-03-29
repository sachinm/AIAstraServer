/**
 * Maps LLM / transport failures to safe client-facing strings.
 * Raw provider messages (quota, model hints, billing URLs) must not reach the browser.
 */

const QUOTA_OR_RATE =
  /\b429\b|quota|rate\s*limit|resource_exhausted|resource has been exhausted|too many requests|exceeded your current|usage limit|tokens?\s*per\s*(minute|day)|throttl/i;

const AUTH_OR_KEY =
  /invalid api key|api[_\s]?key|401\b|403\b|unauthoriz|forbidden|permission denied|GEMINI_API_KEY|GROQ_API_KEY is required/i;

const TIMEOUT_OR_NETWORK =
  /timeout|UND_ERR|ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|socket|network/i;

/** User-visible copy when quota or rate limits are hit (no provider or model names). */
export const PUBLIC_CHAT_QUOTA_MESSAGE =
  'The assistant is temporarily unavailable due to usage limits. Please try again later.';

const PUBLIC_CHAT_AUTH_MESSAGE =
  'The assistant is temporarily unavailable. Please try again later.';

const PUBLIC_CHAT_TIMEOUT_MESSAGE =
  'The request took too long or the connection dropped. Please try again.';

const PUBLIC_CHAT_GENERIC_MESSAGE =
  "We couldn't complete that request. Please try again later.";

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message || '';
  return String(err ?? '');
}

/** Log the full error for operators; never send this string to clients. */
export function logChatProviderError(scope: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(`[chat-provider] ${scope}`, e.stack || e.message);
}

export function publicMessageFromChatProviderError(err: unknown): string {
  const msg = rawMessage(err);
  if (QUOTA_OR_RATE.test(msg)) return PUBLIC_CHAT_QUOTA_MESSAGE;
  if (AUTH_OR_KEY.test(msg)) return PUBLIC_CHAT_AUTH_MESSAGE;
  if (TIMEOUT_OR_NETWORK.test(msg)) return PUBLIC_CHAT_TIMEOUT_MESSAGE;
  return PUBLIC_CHAT_GENERIC_MESSAGE;
}
