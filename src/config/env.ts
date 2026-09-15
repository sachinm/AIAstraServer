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

/** AstroKundli client transport: HTTP (local/dev) or private Lambda invoke (App Runner). */
export type AstroKundliTransport = 'http' | 'lambda';

/**
 * How the server reaches AstroKundli / pyjhora.
 * ASTROKUNDLI_TRANSPORT=http|lambda (default http).
 */
export function getAstroKundliTransport(): AstroKundliTransport {
  const raw = process.env.ASTROKUNDLI_TRANSPORT?.trim().toLowerCase();
  if (raw === 'lambda') return 'lambda';
  return 'http';
}

/**
 * Lambda function name when transport is lambda.
 * ASTROKUNDLI_LAMBDA_FUNCTION_NAME (default aiastra-pyjhora).
 */
export function getAstroKundliLambdaFunctionName(): string {
  const name = process.env.ASTROKUNDLI_LAMBDA_FUNCTION_NAME?.trim();
  return name && name.length > 0 ? name : 'aiastra-pyjhora';
}

/**
 * AWS region for Lambda invoke.
 * ASTROKUNDLI_LAMBDA_REGION, else AWS_REGION, else us-east-1.
 */
export function getAstroKundliLambdaRegion(): string {
  const region =
    process.env.ASTROKUNDLI_LAMBDA_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'us-east-1';
  return region;
}

/**
 * Returns true if AstroKundli is configured for the current env.
 * - http: base URL env var set
 * - lambda: function name set (default aiastra-pyjhora counts as configured)
 * Use to skip starting the queue worker when the 3rd party is not available.
 */
export function isAstroKundliConfigured(): boolean {
  if (getAstroKundliTransport() === 'lambda') {
    return Boolean(getAstroKundliLambdaFunctionName());
  }
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
/**
 * Safe label for logs (never throws in lambda mode).
 * http → base URL; lambda → function name@region.
 */
export function getAstroKundliEndpointLabel(): string {
  if (getAstroKundliTransport() === 'lambda') {
    return `lambda://${getAstroKundliLambdaFunctionName()}@${getAstroKundliLambdaRegion()}`;
  }
  try {
    return getAstroKundliBaseUrl();
  } catch {
    return '(astrokundli base URL unset)';
  }
}

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

/**
 * Default gap between export-horoscope POST **starts** in this process.
 * OSM Nominatim usage policy is effectively one geocode per second; each slice (biodata, d1, …)
 * is a separate POST and may trigger geocoding upstream, so a full Kundli needs ~(number of slices)× this delay
 * in wall time unless the API skips geocode (lat/lon/tz).
 */
/** Aligns with strict upstream limits (e.g. one export POST per second per client). */
const DEFAULT_ASTROKUNDLI_REQUEST_SPACING_MS = 2_000;

/** When spacing is enabled (>0), never go below this (upstream: ~1 req/s). */
export const ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS = 1_100;

/**
 * Configured minimum milliseconds between consecutive POST /api/export-horoscope **starts**
 * (see `astroKundliClient` — it enforces start-to-start timing plus a floor).
 * Set ASTROKUNDLI_REQUEST_SPACING_MS (integer ms, 0–120000; 0 disables the delay only — serialization remains).
 */
export function getAstroKundliRequestSpacingMs(): number {
  const raw = process.env.ASTROKUNDLI_REQUEST_SPACING_MS;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 120_000) return Math.round(n);
  }
  return DEFAULT_ASTROKUNDLI_REQUEST_SPACING_MS;
}

const DEFAULT_KUNDLI_QUEUE_BATCH_SIZE = 2;
/** Default 1: one slice per chunk avoids stacking two export POSTs before the global throttle gap. */
const DEFAULT_KUNDLI_QUEUE_MAX_FETCHES_PER_USER = 1;

/** Delay before starting each additional Kundli row in the same queue tick (staggers multi-row work). */
const DEFAULT_KUNDLI_QUEUE_ROW_STAGGER_MS = 2_000;

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
 * Override with KUNDLI_QUEUE_MAX_FETCHES_PER_USER (integer 1–16, default 1).
 */
export function getKundliQueueMaxFetchesPerUser(): number {
  const raw = process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= 16) return n;
  }
  return DEFAULT_KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
}

/**
 * Milliseconds to wait before starting each subsequent row in `processKundliSyncQueue` (index 1 waits 1×, index 2 waits 2×, …).
 * Reduces 429 when several pending Kundlis are processed in one tick. Set KUNDLI_QUEUE_ROW_STAGGER_MS (0–120000; 0 disables).
 */
export function getKundliQueueRowStaggerMs(): number {
  const raw = process.env.KUNDLI_QUEUE_ROW_STAGGER_MS;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 120_000) return Math.round(n);
  }
  return DEFAULT_KUNDLI_QUEUE_ROW_STAGGER_MS;
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
  return process.env.GEMINI_FLASH_MODEL_ID?.trim() || 'gemini-2.0-flash';
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

/** Default when GEMINI_MAX_OUTPUT_TOKENS is unset (Phase A latency: shorter replies). */
const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 2048;
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

/** Default Gemini chat temperature (Phase A latency / focused answers). */
const DEFAULT_GEMINI_TEMPERATURE = 0.5;

/**
 * `generationConfig.temperature` for Gemini chat.
 * Override with GEMINI_TEMPERATURE (0–2).
 */
export function getGeminiTemperature(): number {
  const raw = process.env.GEMINI_TEMPERATURE;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 2) return n;
  }
  return DEFAULT_GEMINI_TEMPERATURE;
}

/** Default Gemini chat topP (Phase A). */
const DEFAULT_GEMINI_TOP_P = 0.9;

/**
 * `generationConfig.topP` for Gemini chat.
 * Override with GEMINI_TOP_P (0–1).
 */
export function getGeminiTopP(): number {
  const raw = process.env.GEMINI_TOP_P;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return DEFAULT_GEMINI_TOP_P;
}

/** How much Kundli context to pack into chat prompts. */
export type ChatKundliContextMode = 'lean' | 'full';

/**
 * Lean (default): biodata, d1, d9, vimsottari_dasa, charakaraka.
 * Full: all chart/dasa fields. Set CHAT_KUNDLI_CONTEXT=full to expand.
 */
export function getChatKundliContextMode(): ChatKundliContextMode {
  const raw = process.env.CHAT_KUNDLI_CONTEXT?.trim().toLowerCase();
  if (raw === 'full') return 'full';
  return 'lean';
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

/** Secret for https://www.google.com/recaptcha/api/siteverify. If unset, login/signup skip reCAPTCHA. */
export function getRecaptchaSecret(): string | undefined {
  const s = process.env.RECAPTCHA_SECRET_KEY?.trim();
  return s || undefined;
}

const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

/**
 * Minimum v3 score (0–1). Ignored for v2 responses (no score field). Default 0.5.
 */
export function getRecaptchaMinScore(): number {
  const raw = process.env.RECAPTCHA_MIN_SCORE?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return DEFAULT_RECAPTCHA_MIN_SCORE;
}

/** Secret for https://challenges.cloudflare.com/turnstile/v0/siteverify. If unset, login/signup skip Turnstile. */
export function getTurnstileSecret(): string | undefined {
  const s = process.env.TURNSTILE_SECRET_KEY?.trim();
  return s || undefined;
}
