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

/**
 * Minutes after which used/idle per-individual caches (LLM prompt caches, reading_findings_cache, technique_outputs,
 * and in-memory memos) are recycled (`READING_CACHE_RECYCLE_MINUTES`, 5–240), default 45 minutes.
 */
export function getReadingCacheRecycleMinutes(): number {
  const n = Number(process.env.READING_CACHE_RECYCLE_MINUTES);
  return Number.isFinite(n) && n >= 5 && n <= 240 ? Math.round(n) : 45;
}

/** Alias for {@link getReadingCacheRecycleMinutes}. */
export const readingCacheRecycleMinutes = getReadingCacheRecycleMinutes;

/** Milliseconds equivalent of {@link getReadingCacheRecycleMinutes}. */
export function getReadingCacheRecycleMs(): number {
  return getReadingCacheRecycleMinutes() * 60_000;
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

// ── Page Response Times & Telemetry (docs/admin/08) ─────────────

/**
 * Whether page response-time telemetry logging (`page_execution_logs`) is enabled.
 * Env: `PAGE_TIMING_ENABLED` (`0` | `false` disables; default `true`).
 */
export function isPageTimingEnabled(): boolean {
  const raw = process.env.PAGE_TIMING_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false') return false;
  return true;
}

/**
 * Threshold in milliseconds above which a page execution or request is flagged as slow.
 * Env: `PAGE_SLOW_THRESHOLD_MS` (default 1000, clamped to 100..60000).
 */
export function getPageSlowThresholdMs(): number {
  return parseClampedIntEnv('PAGE_SLOW_THRESHOLD_MS', 1000, 100, 60_000);
}

// ── Research Staging & Self Dashboard QA Thresholds (docs/admin/09) ─────────

const DEFAULT_RESEARCH_AGE_BRACKETS = [18, 20, 24, 28, 30, 32, 36, 40, 48, 56] as const;

/**
 * Age brackets (years old, >= 18) used to generate and test random birth charts in the Admin Research Lab.
 * Env: `RESEARCH_AGE_BRACKETS` (CSV of integers >= 18, default `18,20,24,28,30,32,36,40,48,56`).
 */
export function getResearchAgeBrackets(): number[] {
  const raw = process.env.RESEARCH_AGE_BRACKETS?.trim();
  if (raw) {
    const parsed = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 18 && n <= 100);
    if (parsed.length > 0) return parsed;
  }
  return [...DEFAULT_RESEARCH_AGE_BRACKETS];
}

/**
 * Total weeks of weekly/daily zoom-in generated around the reference date (default 9 weeks covering Nov–New Year).
 * Env: `RESEARCH_HORIZON_WEEKS` (default 9, clamped to 4..16).
 */
export function getResearchHorizonWeeks(): number {
  return parseClampedIntEnv('RESEARCH_HORIZON_WEEKS', 9, 4, 16);
}

/**
 * Minimum accuracy score (0..100) required for the Independent Technical Verifier Agent (`research.technical_verifier`)
 * to mark a Self Dashboard QA run as `pass`.
 * Env: `RESEARCH_VERIFIER_PASS_SCORE` (default 95, clamped to 70..100).
 */
export function getResearchVerifierPassScore(): number {
  return parseClampedIntEnv('RESEARCH_VERIFIER_PASS_SCORE', 95, 70, 100);
}


/**
 * Retention window in days for `page_execution_logs` before periodic sweep deletes old rows.
 * Env: `PAGE_TIMING_RETENTION_DAYS` (default 30, clamped to 1..365).
 */
export function getPageTimingRetentionDays(): number {
  return parseClampedIntEnv('PAGE_TIMING_RETENTION_DAYS', 30, 1, 365);
}


// ── The You reading (docs/reading-engine/58) ─

const SELF_CONDITIONAL_DEFAULT = ['dwisatpathi', 'ashtottari', 'chathuraaseethi_sama', 'dwadasottari', 'panchottari', 'sataatbika', 'shastihayani', 'shodasottari', 'shattrimsa_sama'];
const SELF_CONFIRM_DEFAULT = ['vimsottari', 'narayana', 'chara', 'yogini', 'karaka', 'tithi_ashtottari'];

function listEnv(key: string, fallback: readonly string[]): string[] {
  const raw = process.env[key]?.trim();
  if (!raw) return [...fallback];
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [...fallback];
}

/** Conditional dasha systems in the order the reading clock prefers them when the engine says one applies. Env: `SELF_CLOCK_CONDITIONAL_ORDER`. */
export function getSelfClockConditionalOrder(): string[] {
  return listEnv('SELF_CLOCK_CONDITIONAL_ORDER', SELF_CONDITIONAL_DEFAULT);
}

/** The clocks that confirm a chapter of the reading clock (catalogue dasha ids). Env: `SELF_CONFIRM_SYSTEMS`. */
export function getSelfConfirmSystems(): string[] {
  return listEnv('SELF_CONFIRM_SYSTEMS', SELF_CONFIRM_DEFAULT);
}

// ── The reading's clock set (docs/reading-engine/70 §4.1) ─

/**
 * The clock set's order (catalogue dasha ids). Two slot words: `tithi_pravesha` is the year (never pulled; its rows ride
 * in every inventory) and `conditional` is the first conditional clock the engine says applies. Until the engine exports
 * a weighted order (doc 70 E2) this list is the weighting. Env: `READING_CLOCK_ORDER`.
 */
export function getReadingClockOrder(): string[] {
  // docs/techniques/09 decision 2: Yogini and Chara are flagged and left out; a flagged system named here is skipped
  // (`not_verified`) whatever the env says. Sudasa and Lagna Kendradi are shown but have no pressure inventory yet: they
  // reach the reading as stored period rows (clocks/systems.ts feed `periods`), so they are not clock-reader slots.
  return listEnv('READING_CLOCK_ORDER', ['vimsottari', 'narayana', 'tithi_pravesha', 'conditional']);
}

/** Clocks in the set, the year counted as one. Env `READING_CLOCKS` (default 5, 3..6). */
export function getReadingClocks(): number {
  return parseClampedIntEnv('READING_CLOCKS', 5, 3, 6);
}

/** Fewer clocks than this with dated rows is a gap; a reading waits for the next pull. Env `READING_CLOCKS_MIN` (default 3, 1..6). */
export function getReadingClocksMin(): number {
  return parseClampedIntEnv('READING_CLOCKS_MIN', 3, 1, 6);
}

// ── The heavy-tone stopgap (docs/reading-engine/70-heavy-clocks-2026-11-10.md) ─

/**
 * The engine's "bad" flags in a dasha or annual row's stored `reasons` list. The engine sets `presses` when any ONE is
 * on; the server's stopgap counts them (selection over a stored list, no astrology). Env `PRESSES_BAD_FLAGS`.
 */
export function getPressesBadFlags(): string[] {
  return listEnv('PRESSES_BAD_FLAGS', [
    'functional_malefic',
    'in_dusthana',
    'kashta_over_ishta',
    'shadbala_ratio_below_0.8',
    '2_12_from_parent',
    '6_8_from_parent',
    'lord_stationary',
    'retrograde_pass',
  ]);
}

/** The engine's "good" flags in `reasons` (shown in provenance only). Env `PRESSES_GOOD_FLAGS`. */
export function getPressesGoodFlags(): string[] {
  return listEnv('PRESSES_GOOD_FLAGS', ['functional_benefic', 'yogakaraka', 'neecha_vakra', 'cheshta_strong']);
}

/**
 * A `presses` dasha or annual row reads `heavy` only with at least this many bad flags in its stored `reasons`; fewer
 * reads `mixed`. Stopgap until the engine grades polarity itself, awaiting Sachin's yes. Env `PRESSES_MIN_BAD_FLAGS`
 * (default 3, 1..6; 1 restores the engine's own verdict).
 */
export function getPressesMinBadFlags(): number {
  return parseClampedIntEnv('PRESSES_MIN_BAD_FLAGS', 3, 1, 6);
}

/** How near (months) a confirming clock's main period must start to the chapter's start to agree on the shift. Env: `SELF_CHAPTER_BOUNDARY_MONTHS` (default 18, 6..36). */
export function getSelfChapterBoundaryMonths(): number {
  return parseClampedIntEnv('SELF_CHAPTER_BOUNDARY_MONTHS', 18, 6, 36);
}

/** Confirming clocks needed for a chapter to be `confirmed` (one gives `likely`). Env: `SELF_CHAPTER_CONFIRM_MIN` (default 2, 1..5). */
export function getSelfChapterConfirmMin(): number {
  return parseClampedIntEnv('SELF_CHAPTER_CONFIRM_MIN', 2, 1, 5);
}

/**
 * The model layer of the You reading (5 family AI sub-agents + Self Lineman + Self Oracle).
 * Enabled when `SELF_READING_MODEL=1` or `BOARD_MODEL_LAYER=1` (or automatically in non-test environments when `GEMINI_API_KEY` is configured and `SELF_READING_MODEL` is not `'0'`).
 */
export function isSelfReadingModelEnabled(): boolean {
  const raw = process.env.SELF_READING_MODEL?.trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  const boardRaw = process.env.BOARD_MODEL_LAYER?.trim().toLowerCase();
  if (boardRaw === '1' || boardRaw === 'true' || boardRaw === 'yes') return true;
  if (boardRaw === '0' || boardRaw === 'false' || boardRaw === 'no') return false;
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false;
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * The Oracle returns the dashboard's area document (docs/reading-engine/65) instead of the essay + PANEL_SYNTHESIS text:
 * On by default since Phase B renders it; `SELF_ORACLE_AREAS=0` returns to the essay path.
 */
export function isSelfOracleAreasEnabled(): boolean {
  const raw = process.env.SELF_ORACLE_AREAS?.trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'no');
}

/**
 * The model spend cap of ONE operation, USD (Sachin, 2026-11-18; docs/billing/README.md "Spend cap per operation"). An
 * operation is one dashboard reading refresh (one build run: v2 build, clock layer and every card it reads), one
 * single card read the page asks for, one general reading response (ask-stream) or one card-chat answer. Nothing is
 * counted per day. Env `READING_SPEND_CAP_USD` (default 0.45, clamped 0.05..5).
 */
export function getReadingSpendCapUsd(): number {
  return parseClampedFloatEnv('READING_SPEND_CAP_USD', 0.45, 0.05, 5);
}

/**
 * BUILD-GAPS BG-14: output cap for the board Oracle (`oracle/self`), which now writes card lines, a plan and a calendar
 * per panel. Override with SELF_ORACLE_MAX_OUTPUT_TOKENS (integer, 1000–32000). Default 8000 (was a fixed 4500).
 */
export function getSelfOracleMaxOutputTokens(): number {
  const n = Number(process.env.SELF_ORACLE_MAX_OUTPUT_TOKENS ?? '');
  return Number.isFinite(n) && n >= 1000 && n <= 32000 ? Math.floor(n) : 8000;
}

/**
 * The AES-256 key the web build encrypts the loading veil's illustrations with (docs/loading-overlay/01 §4.1):
 * OVERLAY_ART_KEY, exactly 64 hex chars. Null when unset or malformed; the route then answers 404 and the veil shows
 * its lines alone. The same value must be in the web build's env (Amplify) for the ciphertext to match.
 */
export function overlayArtKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.OVERLAY_ART_KEY?.trim();
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw, 'hex');
}

/**
 * Self board v2 routes (docs/reading-engine/66 §4.5). Env `SELF_V2_ENABLED`: '1' on, '0' off; unset follows
 * `AREA_ENABLED` like the other board routes.
 */
/** Self board v3 build step (doc 68 Phase B): the v3 Oracle and Personalizer run after a v2 build that served; off unless 1. */
export function isSelfV3BuildEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SELF_V3_BUILD?.trim() === '1';
}

/** The clock layer (doc 70 §4.1 layers 2–3: clock readers and the concordance ledger); off unless READING_CLOCK_LAYER=1. */
export function isReadingClockLayerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.READING_CLOCK_LAYER?.trim() === '1';
}

// ── A reading per card (docs/reading-engine/70 §4.1 layers 4–5, §4.2, §9) ─

/**
 * The per-card reading: on only when the v3 build and the clock layer are both on (SELF_V3_BUILD=1 and
 * READING_CLOCK_LAYER=1), since every card stands on the agreed ledger. When on, the Phase C cards are offered, the
 * layout save queues the reading, and the three-call v3 Oracle is not run.
 */
export function isCardsReadEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSelfV3BuildEnabled(env) && isReadingClockLayerEnabled(env);
}

/** Read the offered cards not on the board in the background after the board (doc 70 §9). Off unless CARDS_READ_REST=1. */
export function isCardsReadRestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CARDS_READ_REST?.trim() === '1';
}

/** The reading starts once the board holds this many cards. Env `CARDS_READ_MIN` (default 5, 1..8). */
export function getCardsReadMin(): number {
  return parseClampedIntEnv('CARDS_READ_MIN', 5, 1, 8);
}

/**
 * docs/dashboards/10 §4.3: the Love and Work boards served on the You v3 card machine. Env `BOARDS_V3`, a comma list of
 * `love`, `work` (unset or empty: none; unknown names ignored). A board not listed answers 404 `board_v3_off`, is never
 * read and never queued.
 */
export function getBoardsV3(env: NodeJS.ProcessEnv = process.env): Array<'love' | 'work'> {
  const raw = env.BOARDS_V3?.trim();
  if (!raw) return [];
  const out: Array<'love' | 'work'> = [];
  for (const x of raw.split(',').map((s) => s.trim().toLowerCase())) if ((x === 'love' || x === 'work') && !out.includes(x)) out.push(x);
  return out;
}

/** A Love or Work lens deck of at least this many cards queues its reading. Env `CARDS_READ_MIN_AREA` (default 1, 1..8). */
export function getCardsReadMinArea(): number {
  return parseClampedIntEnv('CARDS_READ_MIN_AREA', 1, 1, 8);
}

// ── The full-thread reading (docs/techniques/09 §3.1, §3.5): allotments a limit never cuts ─
//
// Every ceiling below is continued at, never cut at (`llm/continue.ts`); lowering one needs the depth replay and
// Sachin's written yes (AGENTS.md "Reading depth is a release gate", rule 5).

/**
 * The story contract (doc 09 §3.4): one card per Oracle call with the technical story and the beat index, the depth gate
 * before a card is ready, one Personalizer per card. Default on; `CARDS_STORY_CONTRACT=0` returns to the doc 70 cards
 * (and lets CARDS_GROUP_PACK=1 group them again).
 */
export function isCardsStoryContractEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CARDS_STORY_CONTRACT?.trim() !== '0';
}

/** The grouped card call is the path in force: CARDS_GROUP_PACK=1 and the story contract off (doc 09 decision 7). */
export function isCardsGroupPathActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return isCardsGroupPackEnabled(env) && !isCardsStoryContractEnabled(env);
}

/** Card Oracle output ceiling per call (doc 09 decision 7). Env `CARDS_ORACLE_MAX_OUTPUT_TOKENS` (default 10,000; 4,096..32,000). */
export function getCardsOracleMaxOutputTokens(): number {
  return parseClampedIntEnv('CARDS_ORACLE_MAX_OUTPUT_TOKENS', 10_000, 4_096, 32_000);
}

/** Card Oracle wall time per card, continuations included. Env `CARDS_ORACLE_TIMEOUT_MS` (default 150 s; 45..300 s). */
export function getCardsOracleTimeoutMs(): number {
  return parseClampedIntEnv('CARDS_ORACLE_TIMEOUT_MS', 150_000, 45_000, 300_000);
}

/** Card Personalizer output ceiling per call (doc 09 §3.1). Env `CARDS_PERSONALIZER_MAX_OUTPUT_TOKENS` (default 6,000; 4,096..16,000). */
export function getCardsPersonalizerMaxOutputTokens(): number {
  return parseClampedIntEnv('CARDS_PERSONALIZER_MAX_OUTPUT_TOKENS', 6_000, 4_096, 16_000);
}

/** Card Personalizer wall time per card. Env `CARDS_PERSONALIZER_TIMEOUT_MS` (default 90 s; 30..180 s). */
export function getCardsPersonalizerTimeoutMs(): number {
  return parseClampedIntEnv('CARDS_PERSONALIZER_TIMEOUT_MS', 90_000, 30_000, 180_000);
}

/** Lens lineman output ceiling (doc 09 §3.1). Env `LENS_LINEMAN_MAX_OUTPUT_TOKENS` (default 10,000; 4,096..32,000). */
export function getLensLinemanMaxOutputTokens(): number {
  return parseClampedIntEnv('LENS_LINEMAN_MAX_OUTPUT_TOKENS', 10_000, 4_096, 32_000);
}

/** Lens lineman wall time. Env `LENS_LINEMAN_TIMEOUT_MS` (default 90 s; 30..180 s). */
export function getLensLinemanTimeoutMs(): number {
  return parseClampedIntEnv('LENS_LINEMAN_TIMEOUT_MS', 90_000, 30_000, 180_000);
}

/** The lens linemen run (doc 09 §8 step 7). Default on; `LENS_LINEMEN=0` reads the cards without a lens thread. */
export function isLensLinemenEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LENS_LINEMEN?.trim() !== '0';
}

/**
 * The spend cap of one board build (doc 09 §3.5): the clock layer, the lens linemen and every card of the build share
 * it; the cards it does not reach are queued for the next round, never written shorter. Chat answers keep
 * READING_SPEND_CAP_USD. Env `READING_BOARD_SPEND_CAP_USD` (default 1.50; 0.10..10).
 */
export function getReadingBoardSpendCapUsd(): number {
  return parseClampedFloatEnv('READING_BOARD_SPEND_CAP_USD', 1.5, 0.1, 10);
}

/** The per-card safety stop (doc 09 §3.5): a card past it is queued and retried, never served thin. Env `READING_CARD_SPEND_CAP_USD` (default 0.12). */
export function getReadingCardSpendCapUsd(): number {
  return parseClampedFloatEnv('READING_CARD_SPEND_CAP_USD', 0.12, 0.02, 1);
}

/** The first board cards read at once (the visible ones). Env `CARDS_BOARD_PARALLEL` (default 12, 1..16; doc 09 §3.1). */
export function getCardsBoardParallel(): number {
  return parseClampedIntEnv('CARDS_BOARD_PARALLEL', 12, 1, 16);
}

/**
 * Cards read in groups on one cached pack (docs/reading-engine/71 §4.3). Off unless CARDS_GROUP_PACK=1; needs
 * READING_EXPLICIT_CACHE=1 for the pack to be cached (without it the groups still run, uncached).
 */
export function isCardsGroupPackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CARDS_GROUP_PACK?.trim() === '1';
}

/**
 * The most cards per call for the board's cards. Env `CARDS_GROUP_SIZE_BOARD` (default 3, 1..6). The actual groups are
 * planned by estimated output (doc 86): a group stays within CARDS_GROUP_OUTPUT_BUDGET at CARDS_CARD_OUTPUT_TOKENS a card,
 * so with the defaults a board group holds two cards.
 */
export function getCardsGroupSizeBoard(): number {
  return parseClampedIntEnv('CARDS_GROUP_SIZE_BOARD', 3, 1, 6);
}

/**
 * Output tokens a board group call may plan for (doc 86). Env `CARDS_GROUP_OUTPUT_BUDGET` (default 2,000, 500..16,000):
 * output runs at about 125 tokens a second, so 2,000 is about 16 s, plus 2 to 4 s to the first token.
 */
export function getCardsGroupOutputBudget(): number {
  return parseClampedIntEnv('CARDS_GROUP_OUTPUT_BUDGET', 2_000, 500, 16_000);
}

/**
 * Estimated output tokens of one card in a group call, Oracle object plus face (doc 86). Env `CARDS_CARD_OUTPUT_TOKENS`
 * (default 1,000, 200..4,000): the 2026-11-18 live build on c584c0a3 wrote 620 to 1,150 Oracle tokens and 230 to 340
 * face tokens a card, about 1,000 together on average. Re-measure and set it when the cards change length.
 */
export function getCardsCardOutputTokens(): number {
  return parseClampedIntEnv('CARDS_CARD_OUTPUT_TOKENS', 1_000, 200, 4_000);
}

/**
 * Delete the explicit caches a dashboard build made as soon as it ends (doc 86, Sachin 2026-11-18), at the last release
 * of the kundli's cache lease. Env `READING_CACHE_DELETE_AFTER_BUILD` (default on; `0` leaves them to the 45-minute
 * recycle).
 */
export function isCacheDeleteAfterBuildEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.READING_CACHE_DELETE_AFTER_BUILD?.trim() !== '0';
}

/** Cards per call for the cards not on the board (fewer reads of the pack). Env `CARDS_GROUP_SIZE_REST` (default 6, 1..8). */
export function getCardsGroupSizeRest(): number {
  return parseClampedIntEnv('CARDS_GROUP_SIZE_REST', 6, 1, 8);
}

/** The rest of the catalogue, read this many at a time. Env `CARDS_REST_PARALLEL` (default 2, 1..4). */
export function getCardsRestParallel(): number {
  return parseClampedIntEnv('CARDS_REST_PARALLEL', 2, 1, 4);
}

/** Self board v3 routes (docs/reading-engine/68): on only when SELF_V3_ENABLED=1 and the v2 board is on. */
/** The Now card on every board (docs/reading-engine/72): GET /api/now. Off unless NOW_CARD_ENABLED=1. */
export function isNowCardEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NOW_CARD_ENABLED?.trim() === '1';
}

export function isSelfV3Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SELF_V3_ENABLED?.trim() === '1' && isSelfV2Enabled(env);
}

export function isSelfV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.SELF_V2_ENABLED?.trim();
  if (v === '1') return true;
  if (v === '0') return false;
  return env.AREA_ENABLED?.trim() === '1';
}

/**
 * The person facts the Self Personalizer benefits from, in the order the board asks for a missing one (doc 66 §2,
 * doc 52 §3). Env `SELF_V2_FACT_KEYS` (comma list of `FACT_CATALOG` keys).
 */
export function getSelfV2FactKeys(): string[] {
  return listEnv('SELF_V2_FACT_KEYS', ['work.status', 'love.status', 'family.children', 'self.focus']);
}

/**
 * Self board v2 (docs/reading-engine/66 §4.8): the self build event also runs `runSelfV2Build` after the existing build.
 * Env: `SELF_V2_BUILD=1` turns it on; default off. The board charge stays the existing one per board per day.
 */
export function isSelfV2BuildEnabled(): boolean {
  const raw = process.env.SELF_V2_BUILD?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Plan "retire the v2 Self reading", server step 2: the Self board's state comes from its card readings
 * (`self.card.reading` rows of the Self cards on the board clock), not from the v2 rows: `builtAt`, `status`,
 * `nothingStored` (so a GET queues a build only when no card was ever read and no build ran today), the Self "Good until"
 * (the lens rule over the Self deck), the first-reading-free rule and the refresh quota gate (a card was read). Env
 * `SELF_BOARD_FROM_CARDS=1`; default off (the v2 rows, as before). Rollback: unset or 0.
 */
export function isSelfBoardFromCardsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SELF_BOARD_FROM_CARDS?.trim() === '1';
}

/**
 * Plan "retire the v2 Self reading", server step 3: the Self build skips the v2 Oracle and the v2 Personalizer and reads
 * the cards over the natal context (family readers → clock layer → lens linemen → card Oracle → card Personalizer). Env
 * `SELF_V2_RETIRED=1`; default off (the v2 path intact). It takes effect only with the per-card reading on
 * (`isCardsReadEnabled`: SELF_V3_BUILD=1 and READING_CLOCK_LAYER=1), so the legacy three-call v3 path never runs
 * without a v2 reading behind it. Rollback: unset or 0.
 */
export function isSelfV2RetiredEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SELF_V2_RETIRED?.trim() === '1';
}

/** SELF_V2_RETIRED=1 and the per-card reading on: the retired build path runs. */
export function isSelfV2Retired(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSelfV2RetiredEnabled(env) && isCardsReadEnabled(env);
}

/**
 * The Self board reads its state from the card rows: SELF_BOARD_FROM_CARDS=1, or the v2 build retired (no v2 row is
 * written then, so the v2-row reads would re-queue a build on every GET). Rollback order: SELF_V2_RETIRED first, then
 * SELF_BOARD_FROM_CARDS.
 */
export function isSelfBoardFromCards(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSelfBoardFromCardsEnabled(env) || isSelfV2Retired(env);
}

/**
 * The engine's `pressure_inventory` pull for the Self v2 windows (docs/reading-engine/66 §4.3). Env
 * `SELF_V2_PRESSURE_PULL`: '0' / 'false' / 'off' turns the pull off (S3 stays degraded); default on. A failed pull never
 * fails the build.
 */
export function isSelfV2PressurePullEnabled(): boolean {
  const raw = process.env.SELF_V2_PRESSURE_PULL?.trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
}

/** A stored pressure inventory older than this is pulled again. Env `SELF_V2_PRESSURE_MAX_AGE_DAYS` (1–60; default 7). */
export function getSelfV2PressureMaxAgeDays(): number {
  return parseClampedIntEnv('SELF_V2_PRESSURE_MAX_AGE_DAYS', 7, 1, 60);
}

/** After a failed pull, the next attempt waits this long. Env `SELF_V2_PRESSURE_RETRY_HOURS` (1–168; default 24). */
export function getSelfV2PressureRetryHours(): number {
  return parseClampedIntEnv('SELF_V2_PRESSURE_RETRY_HOURS', 24, 1, 168);
}

/** The pull's own time limit inside a build. Env `SELF_V2_PRESSURE_TIMEOUT_MS` (1000–60000; default 15000). */
export function getSelfV2PressureTimeoutMs(): number {
  return parseClampedIntEnv('SELF_V2_PRESSURE_TIMEOUT_MS', 15000, 1000, 60000);
}

/**
 * The Self v2 Personalizer's model (docs/reading-engine/66 §4.1, §4.9). Env: `SELF_PERSONALIZER_MODEL`; default the Oracle's
 * model (`READING_MODEL_ORACLE`, today gemini-3.8-flash on the live Lambda), then `READING_MODEL_SYNTH`, then the chat model.
 * gemini-3.6-flash is priced the same as 3.8-flash in src/reading/llm/models.ts, so it saves nothing.
 */
export function getSelfPersonalizerModel(): string {
  // Sachin 2026-11-09: the Personalizer builds the person's portrait and decides emphasis and register, so it runs on
  // the Oracle's model by default (the same chain as modelFor('oracle'): READING_MODEL_ORACLE → READING_MODEL_SYNTH →
  // the chat model); SELF_PERSONALIZER_MODEL overrides
  return (
    process.env.SELF_PERSONALIZER_MODEL?.trim() ||
    process.env.READING_MODEL_ORACLE?.trim() ||
    process.env.READING_MODEL_SYNTH?.trim() ||
    getGeminiChatModelId()
  );
}

/**
 * Output cap of the Self v2 Personalizer. Env: `SELF_PERSONALIZER_MAX_OUTPUT_TOKENS` (integer, 500–16000; default 8000).
 * Measured on the doc 66 replay (2026-11-09): the complete hero plus eleven cards of profile c came to 4,023 output
 * tokens (11.8 k chars of JSON); on Gemini 3.x the thought tokens count against this cap, and profiles a and b thought
 * ≈ 2.2 k at `low` and were cut at 5,000. The Personalizer now asks for `minimal` thinking; 8,000 leaves ≈ 4 k for the
 * cards at their longest (120-word bodies) plus thought.
 */
export function getSelfPersonalizerMaxOutputTokens(): number {
  // 2026-11-09: on the Oracle's model at `low` thinking with the portrait: the 11 cards were 4.1–4.3 k out on run 2;
  // thinking at `low` on Gemini 3.x counts against the cap (run 1 flash-lite at low: ≈ 2.2 k); 12,000 leaves room for
  // ≈ 6 k of thought on top of the longest card document
  return parseClampedIntEnv('SELF_PERSONALIZER_MAX_OUTPUT_TOKENS', 12000, 500, 24000);
}

/**
 * The Personalizer's one retry after a `MAX_TOKENS` finish: `minimal` thinking and this cap. Env
 * `SELF_PERSONALIZER_RETRY_MAX_OUTPUT_TOKENS` (integer, 1000–16000; default 12000). A truncated document is never stored.
 */
export function getSelfPersonalizerRetryMaxOutputTokens(): number {
  return parseClampedIntEnv('SELF_PERSONALIZER_RETRY_MAX_OUTPUT_TOKENS', 16000, 1000, 24000);
}

// ── Self v2 run 2 fixes (docs/reading-engine/66-replay-2026-11-09-self-v2-run2.md) ─

/**
 * Output cap of the Self v2 family readers (and the v1 Self family readers). Env `SELF_FAMILY_MAX_OUTPUT_TOKENS`
 * (integer, 1000–16000; default 4000). Measured on run 2 (2026-11-09): `family.dasha` stopped at `MAX_TOKENS` with
 * 654 out + 1,342 thought = 1,996 of the old fixed 2,000 (thought tokens count against the cap on Gemini 3.x); the
 * longest complete reader was `family.rasi` at 951 + 1,005 = 1,956. 6,000 since docs/techniques/09 §3.1 (continued at the ceiling).
 */
export function getSelfFamilyMaxOutputTokens(): number {
  return parseClampedIntEnv('SELF_FAMILY_MAX_OUTPUT_TOKENS', 6000, 1000, 16000);
}

/*
 * Career-stage words (doc 66 replay run 2, failure 2: a 25–35 founder told she has "the aura of an experienced guide or
 * seasoned professional" and to anchor her ambitions in "mentorship and advisory leadership").
 *
 * reviewed by Sachin before release; vocabulary, not derivation
 *
 * The words name a stage of a long career. They may stand on a card only when the person's age band is one of
 * `SELF_V2_SENIOR_STAGE_BANDS`, or when `work.level` is one of `SELF_V2_SENIOR_STAGE_LEVELS` and the band is not one of
 * `SELF_V2_JUNIOR_BANDS`. Words and the person's own answers only; nothing astrological.
 */

/** Env `SELF_V2_SENIOR_STAGE_WORDS` (comma list; whole-word, case-insensitive). */
export function getSelfV2SeniorStageWords(): string[] {
  return listEnv('SELF_V2_SENIOR_STAGE_WORDS', [
    'seasoned',
    'veteran',
    'experienced guide',
    'experienced professional',
    'established leader',
    'mentor',
    'mentors',
    'mentoring',
    'mentorship',
    'advisory',
    'advisory leadership',
    'elder statesman',
    'succession',
    'decades of experience',
    'senior leader',
    'executive leadership',
    'executive judgment',
    'executive resolve',
    'gravitas',
  ]);
}

/** Bands where career-stage words may stand whatever the level. Env `SELF_V2_SENIOR_STAGE_BANDS`. */
export function getSelfV2SeniorStageBands(): string[] {
  return listEnv('SELF_V2_SENIOR_STAGE_BANDS', ['46_60', '60_plus']);
}

/** Work levels that allow career-stage words outside the junior bands. Env `SELF_V2_SENIOR_STAGE_LEVELS`. */
export function getSelfV2SeniorStageLevels(): string[] {
  return listEnv('SELF_V2_SENIOR_STAGE_LEVELS', ['manager', 'senior_leader', 'several_businesses']);
}

/** Bands where career-stage words never stand, whatever the level. Env `SELF_V2_JUNIOR_BANDS`. */
export function getSelfV2JuniorBands(): string[] {
  return listEnv('SELF_V2_JUNIOR_BANDS', ['under_25', '25_35']);
}

/**
 * The runtime "Oracle echo" flag (doc 66 replay run 2, failure 1): a card whose body repeats more than this share of the
 * Oracle area's word trigrams is flagged in the build's gaps (never dropped). Env `SELF_V2_ORACLE_ECHO_FLAG` (0–1,
 * default 0.6).
 */
export function getSelfV2OracleEchoFlag(): number {
  const n = Number(process.env.SELF_V2_ORACLE_ECHO_FLAG?.trim());
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.6;
}

// ---------------------------------------------------------------------------------------------------------------------
// Dasha levels 1–6 (docs/reading-engine/67): levels 1–3 lifelong in the normal pull; the deep levels (4..N) in a window,
// pulled only by the dasha-deep worker Lambda for a kundli in focus.
// ---------------------------------------------------------------------------------------------------------------------

/** The worker Lambda the API invokes on focus (DASHA_DEEP_WORKER_FUNCTION). Unset = focus is a no-op (logged once). */
export function getDashaDeepWorkerFunction(): string | undefined {
  return process.env.DASHA_DEEP_WORKER_FUNCTION?.trim() || undefined;
}

/** True only on the worker function (DASHA_DEEP_WORKER=1): `/events` runs a dasha-deep-pull only there, never on the API. */
export function isDashaDeepWorker(): boolean {
  return process.env.DASHA_DEEP_WORKER === '1';
}

/** The deepest level the worker asks for (DASHA_DEEP_MAX_LEVEL, 4–6). Default 4 (Sachin, 2026-11-09: "levels 1-4 for now"). */
export function getDashaDeepMaxLevel(): 4 | 5 | 6 {
  return parseClampedIntEnv('DASHA_DEEP_MAX_LEVEL', 4, 4, 6) as 4 | 5 | 6;
}

/** Days before as_of the deep window starts (DASHA_DEEP_DAYS_BACK, 0–365; default 90). */
export function getDashaDeepDaysBack(): number {
  return parseClampedIntEnv('DASHA_DEEP_DAYS_BACK', 90, 0, 365);
}

/** Days after as_of the deep window ends (DASHA_DEEP_DAYS_AHEAD, 30–730; default 365). */
export function getDashaDeepDaysAhead(): number {
  return parseClampedIntEnv('DASHA_DEEP_DAYS_AHEAD', 365, 30, 730);
}

/** Dasha systems the worker pulls deep (DASHA_DEEP_SYSTEMS, comma list of catalogue names). Unset or `all` = every served system. */
export function getDashaDeepSystems(): string[] | 'all' {
  const raw = process.env.DASHA_DEEP_SYSTEMS?.trim();
  if (!raw || raw.toLowerCase() === 'all') return 'all';
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z_]+$/.test(s));
  return list.length ? list : 'all';
}

/** Engine calls in flight inside one worker run (DASHA_DEEP_CONCURRENCY, 1–2; default 2). The export client still spaces them. */
export function getDashaDeepConcurrency(): number {
  return parseClampedIntEnv('DASHA_DEEP_CONCURRENCY', 2, 1, 2);
}

/** A focus fires the worker at most once per kundli in this many hours (DASHA_DEEP_FOCUS_HOURS, 1–48; default 6). */
export function getDashaDeepFocusHours(): number {
  return parseClampedIntEnv('DASHA_DEEP_FOCUS_HOURS', 6, 1, 48);
}

/** Kundlis one sweep sends to the worker at most (DASHA_DEEP_SWEEP_MAX, 0–100; default 10; 0 = sweep step off). */
export function getDashaDeepSweepMax(): number {
  return parseClampedIntEnv('DASHA_DEEP_SWEEP_MAX', 10, 0, 100);
}

/**
 * Deep pulls in flight account-wide at most (DASHA_DEEP_GLOBAL_MAX, 1–10; default 1). The worker Lambda has no reserved
 * concurrency (the account limit is 10 and Lambda keeps 10 unreserved), so every run takes a slot from the API's pool;
 * the cap is enforced in the database (src/workers/dashaDeepSlots.ts, doc 67 §5.2).
 */
export function getDashaDeepGlobalMax(): number {
  return parseClampedIntEnv('DASHA_DEEP_GLOBAL_MAX', 1, 1, 10);
}

// ---------------------------------------------------------------------------------------------------------------------
// Board card faces and tools (Self v3 redesign): which values a card's options may take, and the defaults. Each list
// env is comma-separated and kept to the known values (unknown entries dropped, empty → the full list); a default that
// is not in its list falls back to the list's first value. Nothing here is astrological.
// ---------------------------------------------------------------------------------------------------------------------

export const CARD_FACE_IDS = ['read', 'light', 'breakdown', 'research'] as const;
export type CardFace = (typeof CARD_FACE_IDS)[number];
export const CARD_TOOL_IDS = ['table', 'calendar', 'dates', 'timeframe', 'plan', 'info'] as const;
export type CardTool = (typeof CARD_TOOL_IDS)[number];
export const CARD_GROUP_BY_IDS = ['weeks', 'months', 'quarters', 'years', 'decades'] as const;
export type CardGroupBy = (typeof CARD_GROUP_BY_IDS)[number];
export const CARD_GROUPS_AS_IDS = ['swipe', 'accordion'] as const;
export type CardGroupsAs = (typeof CARD_GROUPS_AS_IDS)[number];
export const CARD_START_IDS = ['short', 'full'] as const;
export type CardStart = (typeof CARD_START_IDS)[number];

function knownListEnv<T extends string>(key: string, known: readonly T[]): T[] {
  const raw = process.env[key]?.trim();
  if (!raw) return [...known];
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is T => (known as readonly string[]).includes(s));
  const unique = known.filter((k) => list.includes(k));
  return unique.length ? unique : [...known];
}

function knownDefaultEnv<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = process.env[key]?.trim().toLowerCase();
  if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
  return allowed.includes(fallback) ? fallback : allowed[0]!;
}

/** Faces a card may show. Env `CARD_FACES` (default read,light,breakdown,research). */
export function getCardFaces(): CardFace[] {
  return knownListEnv('CARD_FACES', CARD_FACE_IDS);
}
/** Env `CARD_FACE` (default `read`). */
export function getCardFaceDefault(): CardFace {
  return knownDefaultEnv('CARD_FACE', getCardFaces(), 'read');
}

/** Tools a card may switch on. Env `CARD_TOOLS` (default table,calendar,dates,timeframe,plan,info). */
export function getCardTools(): CardTool[] {
  return knownListEnv('CARD_TOOLS', CARD_TOOL_IDS);
}
/** Tools on by default, in `CARD_TOOLS` order. Env `CARD_TOOLS_DEFAULT` (comma-separated; default none; `none` = none). */
export function getCardToolsDefault(): CardTool[] {
  const raw = process.env.CARD_TOOLS_DEFAULT?.trim().toLowerCase();
  if (!raw || raw === 'none') return [];
  const asked = raw.split(',').map((s) => s.trim());
  return getCardTools().filter((t) => asked.includes(t));
}

/** How a card's periods are grouped. Env `CARD_GROUP_BY_VALUES` (default weeks,months,quarters,years,decades). */
export function getCardGroupByValues(): CardGroupBy[] {
  return knownListEnv('CARD_GROUP_BY_VALUES', CARD_GROUP_BY_IDS);
}
/** Env `CARD_GROUP_BY` (default `quarters`). */
export function getCardGroupByDefault(): CardGroupBy {
  return knownDefaultEnv('CARD_GROUP_BY', getCardGroupByValues(), 'quarters');
}

/** How the groups are laid out. Env `CARD_GROUPS_AS_VALUES` (default swipe,accordion). */
export function getCardGroupsAsValues(): CardGroupsAs[] {
  return knownListEnv('CARD_GROUPS_AS_VALUES', CARD_GROUPS_AS_IDS);
}
/** Env `CARD_GROUPS_AS` (default `swipe`). */
export function getCardGroupsAsDefault(): CardGroupsAs {
  return knownDefaultEnv('CARD_GROUPS_AS', getCardGroupsAsValues(), 'swipe');
}

/** Whether a card opens short or in full. Env `CARD_START_VALUES` (default short,full). */
export function getCardStartValues(): CardStart[] {
  return knownListEnv('CARD_START_VALUES', CARD_START_IDS);
}
/** Env `CARD_START` (default `short`). */
export function getCardStartDefault(): CardStart {
  return knownDefaultEnv('CARD_START', getCardStartValues(), 'short');
}

function boolEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return fallback;
}

/** Board setting: ask before an action that costs a question (AGENTS.md rule 7). Env `BOARD_CONFIRM_DEFAULT` (default on). */
export function getBoardConfirmDefault(): boolean {
  return boolEnv('BOARD_CONFIRM_DEFAULT', true);
}
/** Board setting: animations on. Env `BOARD_MOTION_DEFAULT` (default on). */
export function getBoardMotionDefault(): boolean {
  return boolEnv('BOARD_MOTION_DEFAULT', true);
}

/**
 * Hard cap on the server time of the Self v3 board routes (GET /api/self/v3, PUT /api/self/v3/layout): past it the
 * route answers 503 `{ error: 'timeout' }` instead of hanging. Env `SELF_V3_ROUTE_BUDGET_MS` (200–10000; default 2000).
 */
export function getSelfV3RouteBudgetMs(): number {
  return parseClampedIntEnv('SELF_V3_ROUTE_BUDGET_MS', 2000, 200, 10000);
}

/**
 * The card Personalizer writes in a register that fits the person's stated gender (prompts/personalizer/voice.md: woman,
 * man, neutral). Env `PERSONALIZER_VOICE_BY_GENDER` (default on; 0 / false / off / no turns it off, and every card then
 * uses the neutral voice). The voice changes flow, opening and tone only, never a fact, date, tone or verdict.
 */
export function isPersonalizerVoiceByGenderEnabled(): boolean {
  return boolEnv('PERSONALIZER_VOICE_BY_GENDER', true);
}

/**
 * docs/techniques/13 §2.4: the one gate for personal data (`src/reading/person/modelContext.ts`). `READING_PERSON_GATE=1`:
 * the card Personalizer, card chat and Clarify take their person lines from the gate (by role; never a name, email,
 * phone, place, birth time or coordinates) and record the field names sent on their run row. Off (default): today's
 * prompt bytes, unchanged.
 */
export function isReadingPersonGateEnabled(): boolean {
  return boolEnv('READING_PERSON_GATE', false);
}

/** The voice prompt's version: part of the card cache key and the prefix, so a new voice never serves an old card. */
export const PERSONALIZER_VOICE_VERSION = 'v1';

/** The voice version in force: env `PERSONALIZER_VOICE_VERSION` when set, else the constant above (`v1`). */
export function getPersonalizerVoiceVersion(): string {
  return process.env.PERSONALIZER_VOICE_VERSION?.trim() || PERSONALIZER_VOICE_VERSION;
}

// ---------------------------------------------------------------------------------------------------------------------
// Phase 1 Enterprise Security Hardening & Dual-Plane Error Telemetry (M52 / ASVS 5.0 L2)
// ---------------------------------------------------------------------------------------------------------------------

/** Maximum AST depth accepted by GraphQL operations. Env `GRAPHQL_MAX_DEPTH` (default 6, range 2..20). */
export function getGraphqlMaxDepth(): number {
  return parseClampedIntEnv('GRAPHQL_MAX_DEPTH', 6, 2, 20);
}

/** Maximum aliased fields allowed in one GraphQL document. Env `GRAPHQL_MAX_ALIASES` (default 15, range 1..100). */
export function getGraphqlMaxAliases(): number {
  return parseClampedIntEnv('GRAPHQL_MAX_ALIASES', 15, 1, 100);
}

/** Maximum total selection nodes permitted in a single GraphQL operation. Env `GRAPHQL_MAX_SELECTIONS` (default 250, range 10..2000). */
export function getGraphqlMaxSelections(): number {
  return parseClampedIntEnv('GRAPHQL_MAX_SELECTIONS', 250, 10, 2000);
}

/** Allow `__schema` / `__type` GraphQL introspection queries. Env `GRAPHQL_INTROSPECTION` (default true only in dev/local). */
export function isGraphqlIntrospectionEnabled(): boolean {
  return boolEnv('GRAPHQL_INTROSPECTION', isDevOrLocal());
}

/** Mask unexpected internal/Prisma errors on GraphQL responses. Env `GRAPHQL_MASK_ERRORS` (default true outside local/dev). */
export function isGraphqlErrorMaskingEnabled(): boolean {
  return boolEnv('GRAPHQL_MASK_ERRORS', !isDevOrLocal());
}

/** Failed email OTP verification attempts before locking the account. Env `OTP_MAX_FAILED_ATTEMPTS` (default 5, range 3..20). */
export function getOtpMaxFailedAttempts(): number {
  return parseClampedIntEnv('OTP_MAX_FAILED_ATTEMPTS', 5, 3, 20);
}

/** Lock duration in minutes after hitting OTP failure limit. Env `OTP_LOCKOUT_MINUTES` (default 15, range 1..1440). */
export function getOtpLockoutMinutes(): number {
  return parseClampedIntEnv('OTP_LOCKOUT_MINUTES', 15, 1, 1440);
}

/** Retention window in days for `app_error_events`. Env `ERROR_TELEMETRY_RETENTION_DAYS` (default 30, range 1..365). */
export function getErrorTelemetryRetentionDays(): number {
  return parseClampedIntEnv('ERROR_TELEMETRY_RETENTION_DAYS', 30, 1, 365);
}

/** Max events accepted in a single client error batch. Env `CLIENT_ERROR_BATCH_MAX` (default 20, range 1..100). */
export function getClientErrorBatchMax(): number {
  return parseClampedIntEnv('CLIENT_ERROR_BATCH_MAX', 20, 1, 100);
}

/** Replay tolerance window in seconds for signed Admin service requests. Env `ADMIN_HMAC_SKEW_SECONDS` (default 60, range 5..600). */
export function getAdminHmacSkewSeconds(): number {
  return parseClampedIntEnv('ADMIN_HMAC_SKEW_SECONDS', 60, 5, 600);
}

/**
 * Board feature keys switched off whatever their catalogue default (docs/reading-engine/75 §4.1). Env
 * `BOARD_FEATURES_OFF` (comma list of `card.*` / `feature.*` keys; default none). Unknown keys are ignored by the reader.
 */
export function getBoardFeaturesOff(): string[] {
  return listEnv('BOARD_FEATURES_OFF', []).map((k) => k.toLowerCase());
}

/**
 * Board feature keys made premium, each with an optional minimum plan: `key` or `key=plus|unlimited`. Env
 * `BOARD_FEATURES_PREMIUM` (comma list; default none). A missing or unknown plan reads as null (the catalogue's).
 */
export function getBoardFeaturesPremium(): Map<string, 'plus' | 'unlimited' | null> {
  const out = new Map<string, 'plus' | 'unlimited' | null>();
  for (const item of listEnv('BOARD_FEATURES_PREMIUM', [])) {
    const [key, plan] = item.split('=').map((s) => s.trim().toLowerCase());
    if (!key) continue;
    out.set(key, plan === 'plus' || plan === 'unlimited' ? plan : null);
  }
  return out;
}

/** Most named periods a card sends. Env `BOARD_PERIODS_MAX` (1–12; default 6). */
export function getBoardPeriodsMax(): number {
  return parseClampedIntEnv('BOARD_PERIODS_MAX', 6, 1, 12);
}

/** How far back a passed period is still sent, in days. Env `BOARD_PERIODS_PAST_DAYS` (0–3650; default 180). */
export function getBoardPeriodsPastDays(): number {
  return parseClampedIntEnv('BOARD_PERIODS_PAST_DAYS', 180, 0, 3650);
}

/** Most key dates a card sends. Env `BOARD_KEY_DATES_MAX` (1–20; default 6). */
export function getBoardKeyDatesMax(): number {
  return parseClampedIntEnv('BOARD_KEY_DATES_MAX', 6, 1, 20);
}

/** How far back a passed key date is still sent, in days. Env `BOARD_KEY_DATES_PAST_DAYS` (0–365; default 60). */
export function getBoardKeyDatesPastDays(): number {
  return parseClampedIntEnv('BOARD_KEY_DATES_PAST_DAYS', 60, 0, 365);
}

/**
 * Classical Vedic planetary maturation age threshold for D9 (Navamsha) and divisional charts (docs/reading-engine/76).
 * Native age > D9_MATURITY_AGE_YEARS triggers full D1+D9 mutual confirmation and varga routing.
 * Env: `D9_MATURITY_AGE_YEARS` (default 36, clamped to 18..100).
 */
export function getD9MaturityAgeYears(): number {
  return parseClampedFloatEnv('D9_MATURITY_AGE_YEARS', 36, 18, 100);
}

// ---------------------------------------------------------------------------------------------------------------------
// Phase 4 Upstash Serverless Redis & Distributed Rate Limiting
// ---------------------------------------------------------------------------------------------------------------------

/** Upstash Redis REST base URL (`REDIS_REST_URL`). Unset/blank disables Redis cleanly. */
export function getRedisRestUrl(): string {
  return process.env.REDIS_REST_URL?.trim() || '';
}

/** Upstash Redis REST bearer token (`REDIS_REST_TOKEN`). */
export function getRedisRestToken(): string {
  return process.env.REDIS_REST_TOKEN?.trim() || '';
}

/**
 * True ONLY when `REDIS_ENABLED` is not disabled (`0`/`false`/`off`/`no`) AND both
 * `REDIS_REST_URL` and `REDIS_REST_TOKEN` are non-empty trimmed strings.
 */
export function isRedisEnabled(): boolean {
  if (!boolEnv('REDIS_ENABLED', true)) return false;
  return Boolean(getRedisRestUrl() && getRedisRestToken());
}

/** Per-command HTTP abort timeout in milliseconds. Env `REDIS_COMMAND_TIMEOUT_MS` (default 150, range 25..2000). */
export function getRedisCommandTimeoutMs(): number {
  return parseClampedIntEnv('REDIS_COMMAND_TIMEOUT_MS', 150, 25, 2000);
}

/** Circuit breaker failures within window before opening. Env `REDIS_CB_FAILURE_THRESHOLD` (default 5, range 1..50). */
export function getRedisCircuitFailureThreshold(): number {
  return parseClampedIntEnv('REDIS_CB_FAILURE_THRESHOLD', 5, 1, 50);
}

/** Circuit breaker sliding failure window in ms. Env `REDIS_CB_WINDOW_MS` (default 30000, range 1000..300000). */
export function getRedisCircuitWindowMs(): number {
  return parseClampedIntEnv('REDIS_CB_WINDOW_MS', 30_000, 1_000, 300_000);
}

/** Circuit breaker OPEN cooldown in ms before HALF_OPEN probe. Env `REDIS_CB_COOLDOWN_MS` (default 60000, range 1000..600000). */
export function getRedisCircuitCooldownMs(): number {
  return parseClampedIntEnv('REDIS_CB_COOLDOWN_MS', 60_000, 1_000, 600_000);
}

/** Redis session auth cache TTL in seconds. Env `REDIS_SESSION_TTL_SECONDS` (default 900, range 60..86400). */
export function getRedisSessionTtlSeconds(): number {
  return parseClampedIntEnv('REDIS_SESSION_TTL_SECONDS', 900, 60, 86_400);
}

/** Redis SSE turn buffer sliding TTL in seconds. Env `REDIS_SSE_BUFFER_TTL_SECONDS` (default 600, range 60..3600). */
export function getRedisSseBufferTtlSeconds(): number {
  return parseClampedIntEnv('REDIS_SSE_BUFFER_TTL_SECONDS', 600, 60, 3_600);
}

/** Max SSE events retained per turn in Redis. Env `REDIS_SSE_BUFFER_MAX_EVENTS` (default 500, range 50..5000). */
export function getRedisSseBufferMaxEvents(): number {
  return parseClampedIntEnv('REDIS_SSE_BUFFER_MAX_EVENTS', 500, 50, 5_000);
}

/** OTP send rate limit per 15 minutes per email hash. Env `RATE_LIMIT_OTP_PER_15M` (default 5, range 1..100). */
export function getRateLimitOtpPer15m(): number {
  return parseClampedIntEnv('RATE_LIMIT_OTP_PER_15M', 5, 1, 100);
}

/** GraphQL IP rate limit per minute. Env `RATE_LIMIT_GRAPHQL_PER_MIN` (default 120, range 10..5000). */
export function getRateLimitGraphqlPerMin(): number {
  return parseClampedIntEnv('RATE_LIMIT_GRAPHQL_PER_MIN', 120, 10, 5_000);
}

/** Chart rebuild rate limit per 10 minutes per user. Env `RATE_LIMIT_CHART_CALC_PER_10M` (default 6, range 1..100). */
export function getRateLimitChartCalcPer10m(): number {
  return parseClampedIntEnv('RATE_LIMIT_CHART_CALC_PER_10M', 6, 1, 100);
}

/** Gemini chat LLM rate limit per minute per user (token bucket). Env `RATE_LIMIT_GEMINI_PER_MIN` (default 20, range 1..500). */
export function getRateLimitGeminiPerMin(): number {
  return parseClampedIntEnv('RATE_LIMIT_GEMINI_PER_MIN', 20, 1, 500);
}

// ---------------------------------------------------------------------------------------------------------------------
// Retrograde Planets (Vakra Grahas), Ashtagati, Station Horizon & Lucky Motion Gates (docs/reading-engine/77)
// ---------------------------------------------------------------------------------------------------------------------

export type RetrogradeDignityModel = 'nuanced_parashari' | 'uttara_kalamrita_strict';

/**
 * Classical dignity × retrograde interaction model (docs/reading-engine/77 §2):
 * - `nuanced_parashari` (default): BPHS Cheshta Bala uplift on non-vargottama debilitation + non-linear perfectionism on exaltation.
 * - `uttara_kalamrita_strict`: Uttara Kalamrita Ch. 2 Sloka 6 polarity inversion on non-vargottama placements (for Lab A/B replay).
 * Env: `RETROGRADE_DIGNITY_MODEL`.
 */
export function getRetrogradeDignityModel(): RetrogradeDignityModel {
  const raw = process.env.RETROGRADE_DIGNITY_MODEL?.trim().toLowerCase();
  if (raw === 'uttara_kalamrita_strict') return 'uttara_kalamrita_strict';
  return 'nuanced_parashari';
}

/**
 * Version identifier stamped onto `kundli_digest` rows (`DIGEST_VERSION`).
 * Override via `DIGEST_VERSION` env var (default `'d1.2026-11-15-vakra'`).
 */
export function getDigestVersion(): string {
  const raw = process.env.DIGEST_VERSION?.trim();
  return raw && raw.length > 0 ? raw : 'd1.2026-11-15-vakra';
}

/**
 * Maximum annual engine fetches per `ensureAnnualSet` sweep run (`DIGEST_ANNUAL_MAX_CALLS`, 0..500, default 40).
 */
export function getDigestAnnualMaxCalls(): number {
  return parseClampedIntEnv('DIGEST_ANNUAL_MAX_CALLS', 40, 0, 500);
}

/**
 * A stored chart row that failed this many times in a row with the same error, on the same engine calc version and
 * digest version, is not fetched again until one of them changes (`CHART_DATA_FAILED_MAX_TRIES`, 1..20, default 3).
 */
export function getChartDataFailedMaxTries(): number {
  return parseClampedIntEnv('CHART_DATA_FAILED_MAX_TRIES', 3, 1, 20);
}

export interface RetrogradeScoreWeights {
  /** Uplift applied to non-vargottama debilitated retrograde planets in `nuanced_parashari` mode (default 0.75). */
  neechaUplift: number;
  /** Moderation applied to exalted retrograde planets in `nuanced_parashari` mode (default -0.35, e.g. +1.5 -> +1.15). */
  ucchaModeration: number;
  /** Cheshta Bala virupa threshold (0..60) above which a planet carries high directional effort potency (default 45). */
  cheshtaStrongVirupas: number;
  /** Score penalty applied when a Tithi Pravesha annual chart's year lord is retrograde (default 1.0). */
  tpYearLordRetroPenalty: number;
}

/**
 * Numeric weights for retrograde dignity & Cheshta Bala scoring (`RETROGRADE_NEECHA_SCORE_UPLIFT`,
 * `RETROGRADE_UCCHA_SCORE_MODERATION`, `RETROGRADE_CHESHTA_STRONG_VIRUPAS`, `RETROGRADE_TP_YEAR_LORD_PENALTY`).
 */
export function getRetrogradeScoreWeights(): RetrogradeScoreWeights {
  return {
    neechaUplift: parseClampedFloatEnv('RETROGRADE_NEECHA_SCORE_UPLIFT', 0.75, 0, 2.5),
    ucchaModeration: parseClampedFloatEnv('RETROGRADE_UCCHA_SCORE_MODERATION', -0.35, -1.5, 0),
    cheshtaStrongVirupas: parseClampedFloatEnv('RETROGRADE_CHESHTA_STRONG_VIRUPAS', 45, 15, 60),
    tpYearLordRetroPenalty: parseClampedFloatEnv('RETROGRADE_TP_YEAR_LORD_PENALTY', 1.0, 0, 5.0),
  };
}

const DEFAULT_TRANSIT_RANGE_BODIES = ['Sa', 'Ju', 'Ma', 'Me', 'Ve', 'Ra', 'Ke'] as const;
const ALLOWED_RANGE_BODIES = new Set(['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']);

/**
 * Default planet codes requested for shared `transit_range` sky caches (`TRANSIT_RANGE_BODIES`),
 * covering all 5 retrograde-capable taragrahas (`Sa, Ju, Ma, Me, Ve`) plus the lunar nodes (`Ra, Ke`).
 */
export function getTransitRangeBodies(): Array<'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa' | 'Ra' | 'Ke'> {
  const raw = listEnv('TRANSIT_RANGE_BODIES', DEFAULT_TRANSIT_RANGE_BODIES);
  const filtered = raw.filter((p): p is 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa' | 'Ra' | 'Ke' => ALLOWED_RANGE_BODIES.has(p));
  return filtered.length ? filtered : [...DEFAULT_TRANSIT_RANGE_BODIES];
}

export interface LuckyRetrogradeAvoidConfig {
  mercuryRetroAvoidScenarios: string[];
  venusRetroAvoidScenarios: string[];
  marsRetroAvoidScenarios: string[];
  combustKarakaPenalty: number;
  retrogradeKarakaPenalty: number;
  stationaryKarakaPenalty: number;
}

/**
 * Configurable Lucky Times planetary motion & combustion gates (`docs/reading-engine/77 §4.4`):
 * - `LUCKY_MERCURY_RETRO_AVOID_SCENARIOS` (default: contract signing, major purchases/investments, product launches)
 * - `LUCKY_VENUS_RETRO_AVOID_SCENARIOS` (default: courtship initiation, luxury/aesthetic purchases)
 * - `LUCKY_MARS_RETRO_AVOID_SCENARIOS` (default: high-conflict confrontations, surgeries/risky launches)
 */
export function getLuckyRetrogradeAvoidMap(): LuckyRetrogradeAvoidConfig {
  return {
    mercuryRetroAvoidScenarios: listEnv('LUCKY_MERCURY_RETRO_AVOID_SCENARIOS', [
      'work.sign_contract',
      'money.invest_buy',
      'work.launch',
      'work.pitch',
    ]),
    venusRetroAvoidScenarios: listEnv('LUCKY_VENUS_RETRO_AVOID_SCENARIOS', [
      'love.ask_out',
      'love.first_date',
      'love.propose_commit',
    ]),
    marsRetroAvoidScenarios: listEnv('LUCKY_MARS_RETRO_AVOID_SCENARIOS', [
      'work.negotiate_raise',
      'health.procedure',
    ]),
    combustKarakaPenalty: parseClampedIntEnv('LUCKY_COMBUST_KARAKA_PENALTY', 2, 0, 5),
    retrogradeKarakaPenalty: parseClampedIntEnv('LUCKY_RETROGRADE_KARAKA_PENALTY', 2, 0, 5),
    stationaryKarakaPenalty: parseClampedIntEnv('LUCKY_STATIONARY_KARAKA_PENALTY', 3, 0, 5),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The reading prepared ahead (docs/techniques/11 rev 4): one status per chart, the gate, the retry and the yearly span
// ---------------------------------------------------------------------------------------------------------------------

/**
 * `READING_PREP=1` turns on the preparation queue (doc 11 §4.3, phase 2). Off (default 0): no queue exists, the stages
 * used are registered → pulling → checking → chart_ready → ready, and the gate locks on the chart status, the digest and
 * a running build only (§4.8, first version).
 */
export function isReadingPrepEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.READING_PREP?.trim() === '1';
}

/**
 * The dasha systems whose stored periods are required everywhere (doc 11 §4.2: "the star voice, the sign voice"; doc 12
 * §3: Vimshottari and Narayana). A hole in one of them makes the chart incomplete; a hole in any other system that applies
 * is a named gap. Env `PIPELINE_REQUIRED_DASHAS` (comma list of stored system ids; default `vimsottari,narayana`).
 */
export function getPipelineRequiredDashas(): string[] {
  return listEnv('PIPELINE_REQUIRED_DASHAS', ['vimsottari', 'narayana']);
}

/**
 * Years back and ahead of the yearly set the digest sweep keeps filling (`ANNUAL_SPAN_YEARS`, 1..15, default 10: today's
 * span). Doc 11 asks for 15; the deploy session raises it.
 */
export function getAnnualSpanYears(): number {
  return parseClampedIntEnv('ANNUAL_SPAN_YEARS', 10, 1, 15);
}

/**
 * `ANNUAL_TP_ALL_VARGAS=1`: the yearly set draws the Tithi Pravesha chart in every divisional chart the engine casts it in
 * (doc 11 §4.2: 20 charts) and adds the Tajaka year row. Off (default): today's set, Tithi Pravesha and Varsha in D1, D9
 * and D10 only.
 */
export function isAnnualTpAllVargas(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ANNUAL_TP_ALL_VARGAS?.trim() === '1';
}
