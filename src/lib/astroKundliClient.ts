import type { Prisma } from '@prisma/client';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  getAstroKundliBaseUrl,
  getAstroKundliApiKey,
  getAstroKundliTransport,
  getAstroKundliLambdaFunctionName,
  getAstroKundliLambdaRegion,
  ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS,
  getAstroKundliRequestSpacingMs,
  getRadhaMaxConcurrent,
} from '../config/env.js';
import { redactForLog } from './logRedact.js';

/** Kundli column names we request from the API (one call per field) */
export const KUNDLI_JSON_FIELDS = [
  'biodata',
  'd1',
  'd2',
  'd4',
  'd7',
  'd9',
  'd10',
  'charakaraka',
  'vimsottari_dasa',
  'narayana_dasa',
] as const;

export type KundliJsonField = (typeof KUNDLI_JSON_FIELDS)[number];

/** Request body sent to POST /api/export-horoscope */
export interface AstroKundliRequestParams {
  dob: string; // "YYYY-MM-DD" or "YYYY,MM,DD"
  tob: string; // "HH:MM:SS"
  /** `CityPart,CC` — city uses underscores instead of spaces; country is ISO alpha-2 (Python-friendly). */
  place: string;
  ayanamsa?: string; // default "LAHIRI"
}

/**
 * API response shape: always { type: "<type>", data: <structured JSON> }.
 * When type is omitted in the request, the API defaults to "biodata".
 */
export interface AstroKundliResponse<T = Record<string, unknown>> {
  type?: string;
  data?: T;
  error?: string;
}

/** Per-field response types (adjust to actual API response) */
export interface AstroKundliBiodata {
  date?: string;
  time?: string;
  place?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  ayanamsa?: string;
  [k: string]: unknown;
}

export interface AstroKundliChart {
  planets?: unknown[];
  houses?: unknown[];
  chart?: string;
  [k: string]: unknown;
}

export interface AstroKundliCharakaraka {
  [k: string]: unknown;
}

export interface AstroKundliVimsottariDasa {
  periods?: unknown[];
  [k: string]: unknown;
}

/** Export endpoint: POST {baseUrl}/api/export-horoscope. Local dev: ASTROKUNDLI_BASE_URL_LOCAL=http://localhost:8765 */
const HOROSCOPE_PATH = '/api/export-horoscope';
/** Per-request timeout (each of the 8 data points is one request). Remote hosts (e.g. Render) often need >45s under load. Override with ASTROKUNDLI_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = 120_000;
const HEALTH_CHECK_TIMEOUT_MS = 45_000;
const STARTUP_PROBE_TIMEOUT_MS = 20_000;
const STARTUP_BOGUS_PROBE_RUN_KEY = Symbol.for('adastra.astroKundli.startup-bogus-probe-ran');

function getHoroscopeTimeoutMs(): number {
  const env = process.env.ASTROKUNDLI_TIMEOUT_MS;
  if (env != null && env !== '') {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return DEFAULT_TIMEOUT_MS;
}

let cachedLambdaClient: LambdaClient | undefined;
let cachedLambdaClientRegion: string | undefined;

function getLambdaClient(): LambdaClient {
  const region = getAstroKundliLambdaRegion();
  if (!cachedLambdaClient || cachedLambdaClientRegion !== region) {
    cachedLambdaClient = new LambdaClient({ region });
    cachedLambdaClientRegion = region;
  }
  return cachedLambdaClient;
}

/**
 * The client id Radha's per-client limiter sees on the Lambda transport: one per Node process, matching the limiter
 * below, which is also per process. Never one per call: that would hide our rate from Radha instead of keeping to it.
 */
const INTERNAL_SOURCE_IP = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

/** APIGW HTTP API v2 event shape expected by Mangum-wrapped FastAPI. */
function buildApigwHttpApiV2Event(
  method: string,
  rawPath: string,
  bodyObj: unknown | undefined,
  headers: Record<string, string>
): Record<string, unknown> {
  const body =
    bodyObj === undefined ? undefined : typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  const hdrs: Record<string, string> = { ...headers };
  if (body !== undefined && !hdrs['content-type'] && !hdrs['Content-Type']) {
    hdrs['content-type'] = 'application/json';
  }
  return {
    version: '2.0',
    routeKey: `${method} ${rawPath}`,
    rawPath,
    rawQueryString: '',
    headers: hdrs,
    requestContext: {
      accountId: '000000000000',
      apiId: 'aiastra-internal',
      domainName: 'lambda.internal',
      domainPrefix: 'lambda',
      http: {
        method,
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: INTERNAL_SOURCE_IP,
        userAgent: 'aiastra-server/astroKundliClient',
      },
      requestId: `aiastra-${Date.now()}`,
      routeKey: `${method} ${rawPath}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    ...(body !== undefined ? { body } : {}),
  };
}

interface LambdaInvokeHttpResult {
  statusCode: number;
  bodyText: string;
  parsed: unknown;
}

/**
 * Invoke private Lambda with an APIGW v2-shaped event. Parses either:
 * - Mangum/APIGW proxy: { statusCode, body }
 * - Direct payload: { type, data } (or other JSON)
 */
async function invokeAstroKundliLambda(
  method: string,
  rawPath: string,
  bodyObj: unknown | undefined,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<LambdaInvokeHttpResult> {
  const functionName = getAstroKundliLambdaFunctionName();
  const region = getAstroKundliLambdaRegion();
  const event = buildApigwHttpApiV2Event(method, rawPath, bodyObj, headers);
  const client = getLambdaClient();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const out = await client.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify(event), 'utf8'),
      }),
      { abortSignal: controller.signal }
    );

    if (out.FunctionError) {
      const errPayload = out.Payload ? Buffer.from(out.Payload).toString('utf8') : '';
      throw new Error(
        `Lambda ${functionName} FunctionError=${out.FunctionError}${errPayload ? `: ${errPayload.slice(0, 500)}` : ''}`
      );
    }

    const raw = out.Payload ? Buffer.from(out.Payload).toString('utf8') : '';
    let parsed: unknown = undefined;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = undefined;
      }
    }

    // Mangum / APIGW proxy integration response
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed !== null &&
      'statusCode' in parsed &&
      typeof (parsed as { statusCode: unknown }).statusCode === 'number'
    ) {
      const statusCode = (parsed as { statusCode: number }).statusCode;
      const bodyField = (parsed as { body?: unknown }).body;
      let bodyText = '';
      if (typeof bodyField === 'string') bodyText = bodyField;
      else if (bodyField !== undefined) bodyText = JSON.stringify(bodyField);
      let inner: unknown = undefined;
      if (bodyText) {
        try {
          inner = JSON.parse(bodyText);
        } catch {
          inner = undefined;
        }
      }
      return { statusCode, bodyText, parsed: inner ?? parsed };
    }

    // Direct { type, data } (or similar) payload
    return {
      statusCode: 200,
      bodyText: raw,
      parsed: parsed ?? raw,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function lambdaTargetLabel(): string {
  return `lambda://${getAstroKundliLambdaFunctionName()}@${getAstroKundliLambdaRegion()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Milliseconds between consecutive export-horoscope POST starts when throttling is on (Nominatim ~1 req/s). */
function effectiveExportHoroscopeSpacingMs(): number {
  const configured = getAstroKundliRequestSpacingMs();
  if (configured <= 0) return 0;
  return Math.max(configured, ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS);
}

/** A non-2xx answer from Radha, with its status so the retry below can tell a throttle from a real failure. */
export class RadhaHttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'RadhaHttpError';
  }
}

/**
 * An engine error as a log line: its status only, because the engine's text can quote the place it could not resolve
 * (docs/privacy/02 B0.1). Transport errors (timeouts, invoke failures) carry no personal values; they are redacted anyway.
 */
export function engineErrorForLog(err: unknown): string {
  if (err instanceof RadhaHttpError) return `HTTP ${err.status}`;
  return redactForLog(err, 160);
}

/** Gap between call starts when the API key is sent: Radha's limiter does not apply, this only eases cold starts. */
const RADHA_KEYED_SPACING_MS = 250;
const RADHA_MAX_ATTEMPTS = 3;

/**
 * With the API key Radha skips its one-per-second limiter, so calls run in parallel up to RADHA_MAX_CONCURRENT. Without
 * it the limiter applies: one call at a time at the configured spacing.
 */
function radhaLimits(): { maxConcurrent: number; spacingMs: number } {
  if (getAstroKundliApiKey()) return { maxConcurrent: getRadhaMaxConcurrent(), spacingMs: RADHA_KEYED_SPACING_MS };
  return { maxConcurrent: 1, spacingMs: effectiveExportHoroscopeSpacingMs() };
}

/** Every Radha call in this process goes through one set of slots and one next-start time. */
let radhaInFlight = 0;
const radhaWaiters: Array<() => void> = [];
let radhaNextStartAt = 0;

async function withRadhaSlot<T>(run: () => Promise<T>): Promise<T> {
  while (radhaInFlight >= radhaLimits().maxConcurrent) {
    await new Promise<void>((resolve) => radhaWaiters.push(resolve));
  }
  radhaInFlight += 1;
  try {
    const now = Date.now();
    const startAt = Math.max(now, radhaNextStartAt);
    radhaNextStartAt = startAt + radhaLimits().spacingMs;
    if (startAt > now) await sleep(startAt - now);
    return await run();
  } finally {
    radhaInFlight -= 1;
    radhaWaiters.shift()?.();
  }
}

/**
 * How long to wait before retrying, or null when the error is not a throttle (a real failure is never retried here). The
 * wait is the one Radha names ("Retry after about 0.5 seconds"), else 1 s, 2 s, ...; jitter only ever lengthens it.
 */
export function radhaRetryDelayMs(err: unknown, attempt: number): number | null {
  const status = err instanceof RadhaHttpError ? err.status : undefined;
  const lambdaThrottle = (err as { name?: string } | null)?.name === 'TooManyRequestsException';
  if (status !== 429 && status !== 503 && !lambdaThrottle) return null;
  const named = /retry after about ([\d.]+) seconds/i.exec((err as Error).message ?? '');
  const baseMs = named ? Number(named[1]) * 1000 : 1000 * 2 ** (attempt - 1);
  return Math.round(baseMs * (1 + Math.random() * 0.2));
}

/** A throttle pushes back every call in this process, not only this one, so a retry does not walk into the same limit. */
async function callRadha<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await withRadhaSlot(run);
    } catch (err) {
      const delayMs = attempt < RADHA_MAX_ATTEMPTS ? radhaRetryDelayMs(err, attempt) : null;
      if (delayMs === null) throw err;
      radhaNextStartAt = Math.max(radhaNextStartAt, Date.now() + delayMs);
      console.warn('[AstroKundli] throttled, retrying', { attempt, delayMs, error: engineErrorForLog(err) });
    }
  }
}

/** Auth-like record: DOB/TOB/POB as opened by the client's PII extension (src/lib/pii/prismaExtension.ts) */
export interface AuthLikeForKundli {
  date_of_birth: string;
  place_of_birth: string | null;
  time_of_birth: string | null;
}

/**
 * Map Auth user record to AstroKundli request params. The values arrive opened (the PII extension opens sealed and
 * legacy `enc:` values on read). Normalizes dob to YYYY-MM-DD and tob to HH:MM:SS.
 */
export function authToAstroKundliParams(auth: AuthLikeForKundli): AstroKundliRequestParams {
  const dobRaw = auth.date_of_birth;
  const placeRaw = auth.place_of_birth ?? '';
  const tobRaw = auth.time_of_birth || '00:00:00';

  const dob = normalizeDob(dobRaw);
  const tob = normalizeTob(tobRaw);
  const place = normalizePlaceForAstroKundli(placeRaw);

  return { dob, tob, place, ayanamsa: 'LAHIRI' };
}

/** Common country names / aliases → ISO 3166-1 alpha-2 (lowercase keys). */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  india: 'IN',
  in: 'IN',
  bharat: 'IN',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  america: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  gb: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  canada: 'CA',
  ca: 'CA',
  australia: 'AU',
  au: 'AU',
  nepal: 'NP',
  np: 'NP',
  bangladesh: 'BD',
  bd: 'BD',
  pakistan: 'PK',
  pk: 'PK',
  'sri lanka': 'LK',
  'sri-lanka': 'LK',
  lk: 'LK',
  uae: 'AE',
  'united arab emirates': 'AE',
  ae: 'AE',
  singapore: 'SG',
  sg: 'SG',
  germany: 'DE',
  de: 'DE',
  france: 'FR',
  fr: 'FR',
  japan: 'JP',
  jp: 'JP',
  china: 'CN',
  cn: 'CN',
  mexico: 'MX',
  mx: 'MX',
  brazil: 'BR',
  br: 'BR',
};

/**
 * AstroKundli Python expects a single comma: `<cityPart>,<countryCode>` with no spaces.
 * Multi-word cities (e.g. "New Delhi, India") become `New_Delhi,IN` so parsing stays stable.
 */
export function normalizePlaceForAstroKundli(raw: string): string {
  const s = raw.trim().replace(/\s*,\s*/g, ',');
  if (!s) return 'Unknown';

  const segments = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (segments.length < 2) {
    const cityOnly = segments[0] ?? s;
    const underscored = cityOnly.replace(/\s+/g, '_');
    return underscored === '' ? 'Unknown' : `${underscored},ZZ`;
  }

  const countryPart = segments[segments.length - 1]!;
  const cityPart = segments.slice(0, -1).join(', ');
  const countryCode = resolveCountryCode(countryPart);
  const cityUnderscored = cityPart.replace(/\s+/g, '_');
  return `${cityUnderscored},${countryCode}`;
}

function resolveCountryCode(raw: string): string {
  const t = raw.trim();
  if (!t) return 'ZZ';
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const key = t.toLowerCase();
  return COUNTRY_NAME_TO_CODE[key] ?? 'ZZ';
}

function normalizeDob(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const comma = s.replace(/-/g, ',').split(',');
  if (comma.length >= 3) {
    const [y, m, d] = comma.map((x) => x.trim().padStart(2, '0'));
    return `${y}-${m}-${d}`;
  }
  return s;
}

function normalizeTob(raw: string): string {
  const s = raw.trim();
  if (!s) return '00:00:00';
  const parts = s.split(/[:\s]/).filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(0, 3).map((p) => p.padStart(2, '0')).join(':');
  }
  if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  return '00:00:00';
}

/**
 * Parse API response into a value we store in a Prisma Json column.
 * Expects API shape { type, data }; we store the inner `data` only.
 * Throws if the response contains an error.
 */
export function parseAstroKundliResponse<T>(
  res: AstroKundliResponse<T>
): Prisma.JsonValue {
  if (res.error) {
    throw new Error(res.error);
  }
  const raw = res.data ?? (res as unknown as Record<string, unknown>);
  return raw as unknown as Prisma.JsonValue;
}

/**
 * Check if the AstroKundli base URL is reachable (e.g. server running at localhost:8765).
 * Does a GET request to the base URL with a short timeout. Use at startup to log if the
 * 3rd party endpoint is down so Kundli sync will fail for new users.
 */
export async function checkAstroKundliEndpoint(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (getAstroKundliTransport() === 'lambda') {
    const target = lambdaTargetLabel();
    const startedAt = Date.now();
    console.log('[AstroKundli] health-check outgoing', {
      transport: 'lambda',
      target,
      method: 'GET',
      path: '/',
      timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
    });
    try {
      const result = await invokeAstroKundliLambda('GET', '/', undefined, {}, HEALTH_CHECK_TIMEOUT_MS);
      console.log('[AstroKundli] health-check response', {
        transport: 'lambda',
        target,
        status: result.statusCode,
        ok: result.statusCode < 500,
        durationMs: Date.now() - startedAt,
      });
      // Any non-5xx (including 404 from root) means invoke path works.
      if (result.statusCode < 500) {
        return { ok: true, message: `${target} reachable (invoke HTTP ${result.statusCode})` };
      }
      return { ok: false, message: `${target} returned HTTP ${result.statusCode}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AstroKundli] health-check error', {
        transport: 'lambda',
        target,
        durationMs: Date.now() - startedAt,
        error: msg,
      });
      const isTimeout = /abort|timeout/i.test(msg);
      return {
        ok: false,
        message: isTimeout
          ? `${target} timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms`
          : `${target} error: ${msg}`,
      };
    }
  }

  let baseUrl: string;
  try {
    baseUrl = getAstroKundliBaseUrl();
  } catch (err) {
    return {
      ok: false,
      message: (err instanceof Error ? err.message : String(err)) + ' (env var missing)',
    };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  const startedAt = Date.now();
  console.log('[AstroKundli] health-check outgoing', {
    transport: 'http',
    url: baseUrl,
    method: 'GET',
    timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
  });
  try {
    const res = await fetch(baseUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log('[AstroKundli] health-check response', {
      transport: 'http',
      url: baseUrl,
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
    });
    if (res.ok || res.status === 404) {
      return { ok: true, message: `${baseUrl} reachable (HTTP ${res.status})` };
    }
    return {
      ok: false,
      message: `${baseUrl} returned HTTP ${res.status}`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AstroKundli] health-check error', {
      transport: 'http',
      url: baseUrl,
      durationMs: Date.now() - startedAt,
      error: msg,
    });
    const isRefused = /ECONNREFUSED|fetch failed|Failed to fetch/i.test(msg);
    const isTimeout = /abort|timeout/i.test(msg);
    return {
      ok: false,
      message: isRefused
        ? `${baseUrl} unreachable (connection refused – is AstroKundli running?)`
        : isTimeout
          ? `${baseUrl} timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms`
          : `${baseUrl} error: ${msg}`,
    };
  }
}

/**
 * Startup probe: intentionally send bogus params to the export endpoint so we can
 * verify request/response/error logging for the 3rd-party integration.
 * Uses the same `withRadhaSlot` as real chart fetches so this POST does not
 * race the Kundli queue or bypass rate limits on the upstream service.
 * Non-critical: never throws to caller.
 */
export async function probeAstroKundliWithBogusParams(): Promise<void> {
  const globalState = globalThis as Record<symbol, unknown>;
  if (globalState[STARTUP_BOGUS_PROBE_RUN_KEY]) return;
  globalState[STARTUP_BOGUS_PROBE_RUN_KEY] = true;

  const transport = getAstroKundliTransport();
  const apiKey = getAstroKundliApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const bogusBody = {
    dob: '2000-01-01',
    tob: '00:00',
    place: 'Pune,IN',
    type: 'biodata',
    ayanamsa: 'LAHIRI',
  };

  let targetLabel: string;
  if (transport === 'lambda') {
    targetLabel = `${lambdaTargetLabel()}${HOROSCOPE_PATH}`;
  } else {
    try {
      targetLabel = `${getAstroKundliBaseUrl()}${HOROSCOPE_PATH}`;
    } catch (err) {
      console.warn('[AstroKundli] startup bogus-probe skipped (base URL missing)', {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }

  const startedAt = Date.now();
  console.log('[AstroKundli] startup bogus-probe scheduled (serialized with export-horoscope POSTs)', {
    transport,
    url: targetLabel,
    hasApiKey: Boolean(apiKey),
  });

  try {
    const { status, ok, rawText } = await withRadhaSlot(async () => {
      if (transport === 'lambda') {
        console.log('[AstroKundli] startup bogus-probe outgoing', {
          transport: 'lambda',
          url: targetLabel,
          method: 'POST',
          timeoutMs: STARTUP_PROBE_TIMEOUT_MS,
          hasApiKey: Boolean(apiKey),
          body: bogusBody,
        });
        const result = await invokeAstroKundliLambda(
          'POST',
          HOROSCOPE_PATH,
          bogusBody,
          headers,
          STARTUP_PROBE_TIMEOUT_MS
        );
        return {
          status: result.statusCode,
          ok: result.statusCode >= 200 && result.statusCode < 300,
          rawText: result.bodyText || (typeof result.parsed === 'string' ? result.parsed : JSON.stringify(result.parsed ?? {})),
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), STARTUP_PROBE_TIMEOUT_MS);
      try {
        console.log('[AstroKundli] startup bogus-probe outgoing', {
          transport: 'http',
          url: targetLabel,
          method: 'POST',
          timeoutMs: STARTUP_PROBE_TIMEOUT_MS,
          hasApiKey: Boolean(apiKey),
          body: bogusBody,
        });
        const res = await fetch(targetLabel, {
          method: 'POST',
          headers,
          body: JSON.stringify(bogusBody),
          signal: controller.signal,
        });
        const text = await res.text();
        return { status: res.status, ok: res.ok, rawText: text };
      } finally {
        clearTimeout(timeoutId);
      }
    });

    const previewMaxLen = 1500;
    const truncated = rawText.length > previewMaxLen;

    console.log('[AstroKundli] startup bogus-probe response', {
      transport,
      url: targetLabel,
      status,
      ok,
      durationMs: Date.now() - startedAt,
      response_preview: truncated ? rawText.slice(0, previewMaxLen) + '...[truncated]' : rawText,
      truncated,
    });
  } catch (err) {
    console.error('[AstroKundli] startup bogus-probe error', {
      transport,
      url: targetLabel,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Legacy export call (d1, d9, dashas …). When the kundli already has stored coordinates they are sent as lat/lon/tz,
 * so the engine skips geocoding (its geocoder can fail on a city that resolved before). Goes through the one limiter.
 */
export async function fetchHoroscopeChart(
  params: AstroKundliRequestParams,
  type: KundliJsonField,
  coords?: { lat: number | null; lon: number | null; tz: number | null } | null
): Promise<Prisma.JsonValue> {
  const extra = coords && coords.lat != null && coords.lon != null && coords.tz != null ? { lat: coords.lat, lon: coords.lon, tz: coords.tz } : {};
  return callRadha(() => fetchHoroscopeChartImpl(params, type, extra));
}

/** Generic export call for the reading-engine types (`facts`, `transits`). `extra` is merged into the request body. */
export async function fetchEngineExport(
  params: AstroKundliRequestParams,
  type: string,
  extra: Record<string, unknown> = {}
): Promise<Prisma.JsonValue> {
  return callRadha(() => fetchHoroscopeChartImpl(params, type, extra));
}

/**
 * An export that needs no person (transit or prashna at a given place, doc 28): the body carries only `type` and the
 * fields given (place as lat/lon/tz or `place`, `at`, optional `natal_*`), no dob/tob/place. Same limiter as every call.
 */
export async function fetchEngineExportAtPlace(type: string, fields: Record<string, unknown>): Promise<Prisma.JsonValue> {
  return callRadha(() => fetchHoroscopeChartImpl(null, type, { ayanamsa: 'LAHIRI', ...fields }));
}

/**
 * Radha's `catalog` export (S-1): the list of chart data types the engine serves and their calc versions.
 * It takes no birth data, so the request body carries only `type` (no dob/tob/place).
 */
export interface RadhaCatalogType {
  type: string;
  calc_version: string;
  params?: Record<string, unknown>;
}

export interface RadhaCatalog {
  engine_commit: string;
  types: RadhaCatalogType[];
}

export async function fetchRadhaCatalog(): Promise<RadhaCatalog> {
  const raw = await callRadha(() => fetchHoroscopeChartImpl(null, 'catalog'));
  const catalog = raw as unknown as Partial<RadhaCatalog>;
  if (!catalog || !Array.isArray(catalog.types)) {
    throw new Error('Radha catalog response has no types array');
  }
  return { engine_commit: String(catalog.engine_commit ?? ''), types: catalog.types as RadhaCatalogType[] };
}

async function fetchHoroscopeChartImpl(
  params: AstroKundliRequestParams | null,
  type: string,
  extra: Record<string, unknown> = {}
): Promise<Prisma.JsonValue> {
  const transport = getAstroKundliTransport();
  const apiKey = getAstroKundliApiKey();

  // `params` null means a call without birth data (the catalog export)
  const body = {
    ...(params ? { dob: params.dob, tob: params.tob, place: params.place, ayanamsa: params.ayanamsa ?? 'LAHIRI' } : {}),
    type,
    ...extra,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const timeoutMs = getHoroscopeTimeoutMs();
  const startedAt = Date.now();

  const targetLabel =
    transport === 'lambda'
      ? `${lambdaTargetLabel()}${HOROSCOPE_PATH}`
      : `${getAstroKundliBaseUrl()}${HOROSCOPE_PATH}`;

  console.log('[AstroKundli] outgoing', {
    transport,
    url: targetLabel,
    method: 'POST',
    type,
    timeoutMs,
    hasApiKey: Boolean(apiKey),
  });

  try {
    let status: number;
    let ok: boolean;
    let json: AstroKundliResponse<Record<string, unknown>>;

    if (transport === 'lambda') {
      const result = await invokeAstroKundliLambda(
        'POST',
        HOROSCOPE_PATH,
        body,
        headers,
        timeoutMs
      );
      status = result.statusCode;
      ok = status >= 200 && status < 300;
      if (result.parsed && typeof result.parsed === 'object') {
        json = result.parsed as AstroKundliResponse<Record<string, unknown>>;
      } else {
        try {
          json = JSON.parse(result.bodyText) as AstroKundliResponse<Record<string, unknown>>;
        } catch {
          json = { error: result.bodyText || `HTTP ${status}` };
        }
      }
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(targetLabel, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        status = res.status;
        ok = res.ok;
        json = (await res.json()) as AstroKundliResponse<Record<string, unknown>>;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // size and status only: the response is a person's chart, which never goes to a log (docs/privacy/02 B0.1)
    console.log('[AstroKundli] response', {
      transport,
      url: targetLabel,
      type,
      status,
      ok,
      durationMs: Date.now() - startedAt,
      responseBytes: JSON.stringify(json ?? null).length,
    });

    if (!ok) {
      const base =
        json?.error ?? (typeof json === 'object' && json && 'message' in json
          ? String((json as { message?: string }).message)
          : `HTTP ${status}`);
      // keep the engine's detail (e.g. which export types it accepts, or why a place did not resolve)
      const detail = typeof json === 'object' && json && 'detail' in json ? String((json as { detail?: unknown }).detail).slice(0, 300) : '';
      throw new RadhaHttpError(detail ? `${base}: ${detail}` : base, status);
    }

    return parseAstroKundliResponse(json);
  } catch (err) {
    console.error('[AstroKundli] error', {
      transport,
      url: targetLabel,
      type,
      durationMs: Date.now() - startedAt,
      error: engineErrorForLog(err),
    });
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err));
  }
}
