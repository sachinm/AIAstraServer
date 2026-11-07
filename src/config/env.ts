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

/** Radha calls in flight per process when the API key is sent. RADHA_MAX_CONCURRENT (integer 1–16), default 4. */
export function getRadhaMaxConcurrent(): number {
  const n = Number(process.env.RADHA_MAX_CONCURRENT);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : 4;
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

/**
 * Elapsed-time budget for one background chart-pull invocation (docs/reading-engine/31 §4). No new Radha chunk starts
 * after it; the worker re-invokes itself for the rest. Keep it at least ~2.5 minutes below the Lambda timeout (one
 * chunk can take one Radha timeout). KUNDLI_SYNC_MAX_MS (60000–3600000), default 12 minutes.
 */
export function getKundliSyncMaxMs(): number {
  const n = Number(process.env.KUNDLI_SYNC_MAX_MS);
  return Number.isFinite(n) && n >= 60_000 && n <= 3_600_000 ? Math.round(n) : 12 * 60_000;
}

/** How long a worker's lease on `kundlis.queue_started_at` holds: the budget plus one chunk that started just before it. */
export function getKundliSyncLeaseMs(): number {
  return getKundliSyncMaxMs() + 3 * 60_000;
}

/** Kundlis one `kundli-sync-sweep` event processes, oldest first, one after another. KUNDLI_SYNC_SWEEP_BATCH (1–50), default 5. */
export function getKundliSyncSweepBatch(): number {
  const n = Number(process.env.KUNDLI_SYNC_SWEEP_BATCH);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 5;
}

/** Shared secret carried in kundli-sync / kundli-sync-sweep events (KUNDLI_SYNC_EVENT_TOKEN). Required: unset = every event refused. */
export function getKundliSyncEventToken(): string | undefined {
  return process.env.KUNDLI_SYNC_EVENT_TOKEN?.trim() || undefined;
}

/** Shared secret carried in kundli-digest / kundli-digest-sweep events (KUNDLI_DIGEST_EVENT_TOKEN). Required: unset = every digest event refused. */
export function getKundliDigestEventToken(): string | undefined {
  return process.env.KUNDLI_DIGEST_EVENT_TOKEN?.trim() || undefined;
}

/** Elapsed-time budget of one kundli-digest-sweep event (DIGEST_SWEEP_MAX_MS, 10000–600000), default 60 s. */
export function getDigestSweepMaxMs(): number {
  const n = Number(process.env.DIGEST_SWEEP_MAX_MS);
  return Number.isFinite(n) && n >= 10_000 && n <= 600_000 ? Math.round(n) : 60_000;
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



/** Gemini 2.5 thinking budget (tokens). 0 disables thinking so maxOut is for the answer. */
export function getGeminiThinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 24576) return Math.floor(n);
  }
  return 0;
}

/** Whether to include thought parts in the response (usually false for chat). */
export function getGeminiIncludeThoughts(): boolean {
  const raw = process.env.GEMINI_INCLUDE_THOUGHTS?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** DynamoDB table for Gemini cachedContents pointers (userId → cacheName). Empty disables cache. */
export function getGeminiCacheTableName(): string {
  return process.env.GEMINI_CACHE_TABLE?.trim() || '';
}

/** TTL for new Gemini cachedContents (seconds). Default 7 days. */
const DEFAULT_GEMINI_CACHE_TTL_SECONDS = 604_800;

export function getGeminiCacheTtlSeconds(): number {
  const raw = process.env.GEMINI_CACHE_TTL_SECONDS;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 3600 && n <= 7_776_000) return Math.floor(n);
  }
  return DEFAULT_GEMINI_CACHE_TTL_SECONDS;
}

/**
 * Base URL for Gemini CachedContents REST (`…/v1beta`), derived from GEMINI_API_URL
 * which normally ends in `/models`.
 */
export function getGeminiCachedContentsApiBase(): string {
  const modelsBase = (
    process.env.GEMINI_API_URL?.trim() ||
    'https://generativelanguage.googleapis.com/v1beta/models'
  ).replace(/\/$/, '');
  if (modelsBase.endsWith('/models')) {
    return modelsBase.slice(0, -'/models'.length);
  }
  // Already a v1beta (or similar) root
  return modelsBase.replace(/\/models\/?$/, '') || 'https://generativelanguage.googleapis.com/v1beta';
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

function parseCsvEnv(raw: string | undefined, fallback: readonly string[]): string[] {
  if (raw === undefined) return [...fallback];
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none') return [];
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Number of days ahead of universal Panchang / Muhurta day_tables to pre-pull and store for Lucky Times.
 * Override with LUCKY_HORIZON_DAYS or LUCKY_PREPULL_DAYS (integer 7–60, default 28 = 4 weeks).
 */
export function getLuckyHorizonDays(): number {
  const raw = process.env.LUCKY_HORIZON_DAYS ?? process.env.LUCKY_PREPULL_DAYS;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n >= 7 && n <= 60) return n;
  }
  return 28;
}

/**
 * Default days ahead returned in a single GET /api/lucky/range window when no explicit wider horizon is configured.
 * Override with LUCKY_RANGE_AHEAD_DAYS (integer 7–60, default 14 = 2 weeks).
 */
export function getLuckyRangeAheadDays(): number {
  const raw = process.env.LUCKY_RANGE_AHEAD_DAYS;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n >= 7 && n <= 60) return n;
  }
  return 14;
}

const DEFAULT_LUCKY_YOGA_AVOID = [
  'Vishkambha',
  'Atiganda',
  'Shoola',
  'Ganda',
  'Vyaghata',
  'Vajra',
  'Vyatipata',
  'Parigha',
  'Vaidhriti',
] as const;

const DEFAULT_LUCKY_YOGA_FAVOUR = [
  'Siddhi',
  'Siddha',
  'Shubha',
  'Brahma',
  'Indra',
  'Dhruva',
  'Harshana',
  'Sukarma',
  'Priti',
  'Ayushman',
  'Saubhagya',
  'Shobhana',
] as const;

const DEFAULT_LUCKY_KARANA_AVOID = ['Vishti'] as const;

const DEFAULT_LUCKY_KARANA_FAVOUR = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija'] as const;

const DEFAULT_LUCKY_FIXED_KARANA_AVOID = ['Shakuni', 'Chatushpada', 'Naga'] as const;

const DEFAULT_LUCKY_FIXED_KARANA_FAVOUR = ['Kimstughna'] as const;

/** Avoided Nitya Yogas for Lucky Times (override via comma-separated LUCKY_YOGA_AVOID). */
export function getLuckyYogaAvoid(): string[] {
  return parseCsvEnv(process.env.LUCKY_YOGA_AVOID, DEFAULT_LUCKY_YOGA_AVOID);
}

/** Favoured Nitya Yogas for Lucky Times (override via comma-separated LUCKY_YOGA_FAVOUR; includes Siddha #21). */
export function getLuckyYogaFavour(): string[] {
  return parseCsvEnv(process.env.LUCKY_YOGA_FAVOUR, DEFAULT_LUCKY_YOGA_FAVOUR);
}

/** Avoided movable karanas for Lucky Times (override via comma-separated LUCKY_KARANA_AVOID). */
export function getLuckyKaranaAvoid(): string[] {
  return parseCsvEnv(process.env.LUCKY_KARANA_AVOID, DEFAULT_LUCKY_KARANA_AVOID);
}

/** Favoured movable karanas for Lucky Times (override via comma-separated LUCKY_KARANA_FAVOUR). */
export function getLuckyKaranaFavour(): string[] {
  return parseCsvEnv(process.env.LUCKY_KARANA_FAVOUR, DEFAULT_LUCKY_KARANA_FAVOUR);
}

/** Fixed (sthira) karanas gated as avoid by default for auspicious acts (override via LUCKY_FIXED_KARANA_AVOID). */
export function getLuckyFixedKaranaAvoid(): string[] {
  return parseCsvEnv(process.env.LUCKY_FIXED_KARANA_AVOID, DEFAULT_LUCKY_FIXED_KARANA_AVOID);
}

/** Fixed (sthira) karanas favoured (+1) for auspicious beginnings (override via LUCKY_FIXED_KARANA_FAVOUR). */
export function getLuckyFixedKaranaFavour(): string[] {
  return parseCsvEnv(process.env.LUCKY_FIXED_KARANA_FAVOUR, DEFAULT_LUCKY_FIXED_KARANA_FAVOUR);
}

/** Whether Amrita Siddhi (weekday + nakshatra) scoring is enabled in Lucky Times (LUCKY_AMRITA_SIDDHI_ENABLED, default true). */
export function isLuckyAmritaSiddhiEnabled(): boolean {
  const raw = process.env.LUCKY_AMRITA_SIDDHI_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return true;
}

export interface LuckyReferencePlaceConfig {
  key: 'pune' | 'newyork' | 'chicago' | 'denver' | 'sanjose';
  tzAlias: 'in-ist' | 'us-east' | 'us-central' | 'us-mountain' | 'us-west';
  ianaTz: 'Asia/Kolkata' | 'America/New_York' | 'America/Chicago' | 'America/Denver' | 'America/Los_Angeles';
  label: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  tz: number;
}

const DEFAULT_LUCKY_REFERENCE_PLACES: readonly LuckyReferencePlaceConfig[] = [
  { key: 'pune', tzAlias: 'in-ist', ianaTz: 'Asia/Kolkata', label: 'Pune, IN', country: 'in', region: 'mh', lat: 18.52, lon: 73.857, tz: 5.5 },
  { key: 'newyork', tzAlias: 'us-east', ianaTz: 'America/New_York', label: 'New York, US', country: 'us', region: 'ny', lat: 40.7128, lon: -74.006, tz: -5 },
  { key: 'chicago', tzAlias: 'us-central', ianaTz: 'America/Chicago', label: 'Chicago, US', country: 'us', region: 'il', lat: 41.8781, lon: -87.6298, tz: -6 },
  { key: 'denver', tzAlias: 'us-mountain', ianaTz: 'America/Denver', label: 'Denver, US', country: 'us', region: 'co', lat: 39.7392, lon: -104.9903, tz: -7 },
  { key: 'sanjose', tzAlias: 'us-west', ianaTz: 'America/Los_Angeles', label: 'San Jose, US', country: 'us', region: 'ca', lat: 37.341, lon: -121.894, tz: -8 },
] as const;

/**
 * 5 universal reference timezone places for Lucky Times (4 US timezones + India IST).
 * Override via JSON array in LUCKY_REFERENCE_PLACES if needed.
 */
export function getLuckyReferencePlaces(): readonly LuckyReferencePlaceConfig[] {
  const raw = process.env.LUCKY_REFERENCE_PLACES?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as LuckyReferencePlaceConfig[];
    } catch {
      // fall back to default 5 reference places
    }
  }
  return DEFAULT_LUCKY_REFERENCE_PLACES;
}

// ── Life Reading & Mahadasha Charter Thresholds (docs/reading-engine/34, 54 §4, 55) ─

function parseClampedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n)) return Math.max(min, Math.min(max, n));
  }
  return fallback;
}

/**
 * Forward horizon (in years) for Life Reading timing windows (`life.timing_agreement`).
 * Env: `LIFE_HORIZON_YEARS` (default 15, clamped to 5..30).
 */
export function getLifeHorizonYears(): number {
  return parseClampedIntEnv('LIFE_HORIZON_YEARS', 15, 5, 30);
}

/**
 * Minimum remaining years in the running Vimshottari Mahadasha for it to serve as the
 * primary multi-decade Life Charter on its own (`life.mahadasha_charter`, doc 55 §4.1).
 * When the running Mahadasha has fewer years left than this threshold, the largest
 * Mahadasha within `getLifeCharterHorizonYears()` is chartered and the running
 * Mahadasha's remaining Antardashas are included as a transition bridge.
 * Env: `LIFE_CHARTER_MIN_REMAINING_YEARS` (default 10, clamped to 3..18).
 */
export function getLifeCharterMinRemainingYears(): number {
  return parseClampedIntEnv('LIFE_CHARTER_MIN_REMAINING_YEARS', 10, 3, 18);
}

/**
 * Lookahead horizon (in years) used to select the remaining largest Mahadasha (10–20 yr span)
 * and enumerate its Antardashas (`life.mahadasha_charter`, doc 55 §4.1).
 * Env: `LIFE_CHARTER_HORIZON_YEARS` (default 20, clamped to 10..30).
 */
export function getLifeCharterHorizonYears(): number {
  return parseClampedIntEnv('LIFE_CHARTER_HORIZON_YEARS', 20, 10, 30);
}

/**
 * Maximum number of activated life areas highlighted inside each Antardasha row
 * of the Mahadasha Charter (`life.mahadasha_charter`, doc 55 §4.1).
 * Env: `LIFE_CHARTER_MAX_AREAS_PER_AD` (default 3, clamped to 1..6).
 */
export function getLifeCharterMaxAreasPerAd(): number {
  return parseClampedIntEnv('LIFE_CHARTER_MAX_AREAS_PER_AD', 3, 1, 6);
}

// ── Area Board Shade Resolver & Governance Thresholds (docs/reading-engine/55) ─

function parseClampedFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  }
  return fallback;
}

/**
 * Short-horizon window (in months) where Pratyantardasha (`maxLevel: 3`) activations
 * are included on the You/Love/Work boards (doc 55 §2.1).
 * Env: `SHADE_SHORT_HORIZON_MONTHS` (default 3, clamped to 1..6).
 */
export function getShadeShortHorizonMonths(): number {
  return parseClampedIntEnv('SHADE_SHORT_HORIZON_MONTHS', 3, 1, 6);
}

/**
 * Minimum weighted score for a shade candidate to be selected as the primary shade
 * of an active board window (doc 55 §2.2).
 * Env: `SHADE_MIN_WINNING_SCORE` (default 1.5, clamped to 0.5..5.0).
 */
export function getShadeMinWinningScore(): number {
  return parseClampedFloatEnv('SHADE_MIN_WINNING_SCORE', 1.5, 0.5, 5.0);
}

/**
 * Score bonus added when a confirmed `person_facts` answer matches a candidate shade's
 * tie-break criterion (doc 55 §2.4).
 * Env: `SHADE_FACT_TIE_BREAK_BONUS` (default 1.25, clamped to 0.25..3.0).
 */
export function getShadeFactTieBreakBonus(): number {
  return parseClampedFloatEnv('SHADE_FACT_TIE_BREAK_BONUS', 1.25, 0.25, 3.0);
}

/**
 * Minimum agreeing clock families required for a `confirmed` Tier-2 gate verdict (doc 55 §2.2).
 * Env: `SHADE_CONFIRM_MIN_FAMILIES` (default 3, clamped to 2..5).
 */
export function getShadeConfirmMinFamilies(): number {
  return parseClampedIntEnv('SHADE_CONFIRM_MIN_FAMILIES', 3, 2, 5);
}

// ── Technique pieces and validity windows (docs/reading-engine/56) ─

/**
 * Length (hours) of the window a technique's output stays valid when it reads transit rows: the shared sky and the
 * overlay move, so the output is re-made per window. Windows are aligned to the epoch, so every caller in the same
 * window gets the same cache key. Env: `TECHNIQUE_TRANSIT_WINDOW_HOURS` (default 2, clamped to 1..24).
 */
export function getTechniqueTransitWindowHours(): number {
  return parseClampedIntEnv('TECHNIQUE_TRANSIT_WINDOW_HOURS', 2, 1, 24);
}

/**
 * Fallback window (days) for a technique that reads dasha periods when the caller does not pass the end of the running
 * period. Env: `TECHNIQUE_DASHA_FALLBACK_DAYS` (default 30, clamped to 1..365).
 */
export function getTechniqueDashaFallbackDays(): number {
  return parseClampedIntEnv('TECHNIQUE_DASHA_FALLBACK_DAYS', 30, 1, 365);
}

/**
 * Fallback window (days) for a technique that reads the year charts when the caller does not pass the end of the
 * running year chart. Env: `TECHNIQUE_ANNUAL_FALLBACK_DAYS` (default 90, clamped to 1..366).
 */
export function getTechniqueAnnualFallbackDays(): number {
  return parseClampedIntEnv('TECHNIQUE_ANNUAL_FALLBACK_DAYS', 90, 1, 366);
}

/**
 * A version folded into every technique output cache key; bump it to invalidate every stored output after a code change
 * that the contract does not show. Env: `TECHNIQUE_CACHE_VERSION` (default "1").
 */
export function getTechniqueCacheVersion(): string {
  const raw = process.env.TECHNIQUE_CACHE_VERSION?.trim();
  return raw ? raw : '1';
}



