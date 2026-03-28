/**
 * Centralized environment configuration for local, staging, and production.
 * Use these helpers instead of reading process.env directly for env-dependent behavior.
 */

export type NodeEnv = 'local' | 'development' | 'staging' | 'production';

const VALID_NODE_ENVS: NodeEnv[] = ['local', 'development', 'staging', 'production'];

/**
 * Returns the current node environment. Defaults to 'development' if unset or invalid.
 */
export function getNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV;
  if (raw && VALID_NODE_ENVS.includes(raw as NodeEnv)) {
    return raw as NodeEnv;
  }
  return 'development';
}

/** True when NODE_ENV is local or development (restricted CORS: localhost + 10.0.0.190 only). */
export function isDevOrLocal(): boolean {
  const env = getNodeEnv();
  return env === 'local' || env === 'development';
}

/**
 * Returns the AstroKundli API base URL for the current environment.
 * - production → ASTROKUNDLI_BASE_URL_PROD (e.g. port 8767)
 * - staging → ASTROKUNDLI_BASE_URL_STAGING (e.g. port 8766)
 * - development → ASTROKUNDLI_BASE_URL_LOCAL (e.g. port 8765)
 * @throws Error if the required env var for the current env is missing
 */
export function getAstroKundliBaseUrl(): string {
  const env = getNodeEnv();
  const key =
    env === 'production'
      ? 'ASTROKUNDLI_BASE_URL_PROD'
      : env === 'staging'
        ? 'ASTROKUNDLI_BASE_URL_STAGING'
      : env === 'development'
        ? 'ASTROKUNDLI_BASE_URL_DEV'
        : 'ASTROKUNDLI_BASE_URL_LOCAL'; // local
  const url = process.env[key];
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      `${key} must be set for NODE_ENV=${env}. Example: http://localhost:${env === 'production' ? 8767 : env === 'staging' ? 8766 : env === 'development' ? 8765 : 8765}`
    );
  }
  return url.trim().replace(/\/$/, '');
}

/**
 * Returns true if AstroKundli is configured (base URL set) for the current env.
 * Use to skip starting the queue worker when the 3rd party is not available.
 */
export function isAstroKundliConfigured(): boolean {
  const env = getNodeEnv();
  const key =
    env === 'production'
      ? 'ASTROKUNDLI_BASE_URL_PROD'
      : env === 'staging'
        ? 'ASTROKUNDLI_BASE_URL_STAGING'
      : env === 'development'
        ? 'ASTROKUNDLI_BASE_URL_DEV'
        : 'ASTROKUNDLI_BASE_URL_LOCAL'; // local | development
  const url = process.env[key];
  return Boolean(url && typeof url === 'string' && url.trim() !== '');
}

/**
 * Returns the optional AstroKundli API key if the 3rd party requires it.
 */
export function getAstroKundliApiKey(): string | undefined {
  return process.env.ASTROKUNDLI_API_KEY?.trim() || undefined;
}

/**
 * Returns true if AstroKundli API response logging is enabled.
 * Set ASTROKUNDLI_LOG_RESPONSE=1 to log raw API responses (for debugging).
 */
export function isAstroKundliLogResponseEnabled(): boolean {
  return process.env.ASTROKUNDLI_LOG_RESPONSE === '1';
}

const DEFAULT_KUNDLI_QUEUE_BATCH_SIZE = 2;
/** Default 2: remote AstroKundli is often single-worker; many parallel POSTs queue behind each other and hit client timeouts. */
const DEFAULT_KUNDLI_QUEUE_MAX_FETCHES_PER_USER = 2;

/**
 * Max number of Kundli users to process in parallel per queue run.
 * Peak concurrent AstroKundli API calls = batch size × max fetches per user.
 * Override with KUNDLI_QUEUE_BATCH_SIZE (integer, default 2).
 */
export function getKundliQueueBatchSize(): number {
  const raw = process.env.KUNDLI_QUEUE_BATCH_SIZE;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= 20) return n;
  }
  return DEFAULT_KUNDLI_QUEUE_BATCH_SIZE;
}

/**
 * Max concurrent AstroKundli API requests per user (data points fetched in chunks).
 * Lower values reduce server load; peak concurrent calls = batch size × this value.
 * Override with KUNDLI_QUEUE_MAX_FETCHES_PER_USER (integer, default 2).
 */
export function getKundliQueueMaxFetchesPerUser(): number {
  const raw = process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= 8) return n;
  }
  return DEFAULT_KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
}

/** Which backend handles GraphQL `ask` chat: Groq or Google Gemini. */
export type ChatLlmProvider = 'groq' | 'gemini';

/**
 * Reads CHAT_LLM_PROVIDER (case-insensitive). Defaults to `groq` for backward compatibility.
 * Use `gemini` to route chat to Gemini (`GEMINI_API_KEY`, `GEMINI_API_URL`, `GEMINI_FLASH_MODEL_ID`).
 */
export function getChatLlmProvider(): ChatLlmProvider {
  const raw = process.env.CHAT_LLM_PROVIDER?.trim().toLowerCase() || 'groq';
  if (raw === 'gemini') return 'gemini';
  return 'groq';
}

/**
 * Base path for Gemini REST `models/{id}:generateContent` (no trailing slash).
 * Default: Google Generative Language API v1beta.
 */
export function getGeminiModelsBaseUrl(): string {
  return (
    process.env.GEMINI_API_URL?.trim() ||
    'https://generativelanguage.googleapis.com/v1beta/models'
  ).replace(/\/$/, '');
}

/** Model id for chat (e.g. gemini-2.5-flash). */
export function getGeminiChatModelId(): string {
  return process.env.GEMINI_FLASH_MODEL_ID?.trim() || 'gemini-2.5-flash';
}

/** Google Generative Language API rejects values above this for `thinkingConfig.thinkingBudget`. */
const MAX_GEMINI_THINKING_BUDGET = 24_576;

/**
 * Optional `thinkingBudget` for Gemini 2.5+ when thoughts are streamed.
 * 0 = dynamic default per Google; unset uses env or 8192.
 * Values above {@link MAX_GEMINI_THINKING_BUDGET} are clamped (API max).
 */
export function getGeminiThinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET?.trim();
  if (raw === undefined || raw === '') return 8192;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 8192;
  return Math.min(Math.floor(n), MAX_GEMINI_THINKING_BUDGET);
}

/** When false, omit thinkingConfig (no thought stream). Default true. */
export function isGeminiIncludeThoughtsEnabled(): boolean {
  const raw = process.env.GEMINI_INCLUDE_THOUGHTS?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

/**
 * Options for `@langchain/google-genai` client when `GEMINI_API_URL` points at the REST models base.
 */
export function getGeminiGoogleGenAiClientOptions(): { baseUrl?: string; apiVersion?: string } {
  const raw = process.env.GEMINI_API_URL?.trim();
  if (!raw) return { apiVersion: 'v1beta' };
  try {
    const u = new URL(raw);
    const apiVersion = u.pathname.includes('v1alpha') ? 'v1alpha' : 'v1beta';
    return { baseUrl: u.origin, apiVersion };
  } catch {
    return { apiVersion: 'v1beta' };
  }
}

/**
 * Full URL for POST generateContent (without `?key=`).
 * Example: .../v1beta/models/gemini-2.0-flash:generateContent
 */
export function getGeminiGenerateContentUrl(): string {
  const base = getGeminiModelsBaseUrl();
  const model = getGeminiChatModelId();
  return `${base}/${model}:generateContent`;
}

/**
 * Same model path as {@link getGeminiGenerateContentUrl} but `:streamGenerateContent`.
 * Call with query `alt=sse` for newline-delimited SSE `data:` JSON chunks.
 */
export function getGeminiStreamGenerateContentUrl(): string {
  const base = getGeminiModelsBaseUrl();
  const model = getGeminiChatModelId();
  return `${base}/${model}:streamGenerateContent`;
}

/** Default when GEMINI_MAX_OUTPUT_TOKENS is unset (matches prior hardcoded chat default). */
const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 8192;
const MIN_GEMINI_MAX_OUTPUT_TOKENS = 256;
/** Hard cap to avoid accidental huge values; model/API may enforce a lower max. */
const MAX_GEMINI_MAX_OUTPUT_TOKENS_CAP = 65_536;

/**
 * `generationConfig.maxOutputTokens` for Gemini chat (`generateContent`).
 * Override with GEMINI_MAX_OUTPUT_TOKENS (integer, 256–65536). Increase if replies truncate mid-answer.
 */
export function getGeminiMaxOutputTokens(): number {
  const raw = process.env.GEMINI_MAX_OUTPUT_TOKENS;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN_GEMINI_MAX_OUTPUT_TOKENS && n <= MAX_GEMINI_MAX_OUTPUT_TOKENS_CAP) {
      return Math.floor(n);
    }
  }
  return DEFAULT_GEMINI_MAX_OUTPUT_TOKENS;
}

/**
 * Node's native `fetch` (undici) defaults headersTimeout/bodyTimeout to **300s**.
 * Gemini can use the full 300s+ for one `generateContent`, which triggers UND_ERR_HEADERS_TIMEOUT
 * / aborted signal — often surfaced to the client as "signal is aborted without reason".
 * Override with GEMINI_HTTP_TIMEOUT_MS (applies to both) or the specific vars. **0** = no timeout (undici).
 */
const DEFAULT_GEMINI_HTTP_TIMEOUT_MS = 600_000;

function parseNonNegativeTimeoutMs(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

export function getGeminiUndiciHeadersTimeoutMs(): number {
  return (
    parseNonNegativeTimeoutMs(process.env.GEMINI_FETCH_HEADERS_TIMEOUT_MS) ??
    parseNonNegativeTimeoutMs(process.env.GEMINI_HTTP_TIMEOUT_MS) ??
    DEFAULT_GEMINI_HTTP_TIMEOUT_MS
  );
}

export function getGeminiUndiciBodyTimeoutMs(): number {
  return (
    parseNonNegativeTimeoutMs(process.env.GEMINI_FETCH_BODY_TIMEOUT_MS) ??
    parseNonNegativeTimeoutMs(process.env.GEMINI_HTTP_TIMEOUT_MS) ??
    DEFAULT_GEMINI_HTTP_TIMEOUT_MS
  );
}

/** When `CHAT_THINKING_LOG=0`, skip `[chat thinking]` console lines. Default: log. */
export function isChatThinkingLogEnabled(): boolean {
  return process.env.CHAT_THINKING_LOG?.trim() !== '0';
}

/** Per-request GraphQL Yoga `incoming` / `completed` lines. Default: off. */
export function isGraphqlRequestLogEnabled(): boolean {
  return process.env.GRAPHQL_REQUEST_LOG?.trim() === '1';
}

/** Verbose AstroKundli `outgoing` / `response` per horoscope fetch. Default: off. */
export function isAstroKundliHttpDebugEnabled(): boolean {
  return process.env.ASTROKUNDLI_HTTP_DEBUG?.trim() === '1';
}
