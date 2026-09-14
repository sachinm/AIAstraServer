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
  isAstroKundliLogResponseEnabled,
} from '../config/env.js';
import { decrypt } from './encrypt.js';
import { queueLog } from './queueLogger.js';

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
        sourceIp: '127.0.0.1',
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

/**
 * Serialize export-horoscope POSTs and enforce a minimum **start-to-start** gap so upstream
 * geocoding (OSM Nominatim, ~1 request/s) is not exceeded even when many Kundli slices are
 * requested in parallel: each slice is one POST, so KUNDLI_JSON_FIELDS.length types need ≥ that many × the gap in wall time
 * per user unless the API skips geocode. This throttle is per Node process only.
 */
let horoscopeExportTail: Promise<void> = Promise.resolve();
let lastHoroscopeExportRequestStartAt = 0;

async function withHoroscopeExportThrottle<T>(run: () => Promise<T>): Promise<T> {
  const prev = horoscopeExportTail;
  let release!: () => void;
  horoscopeExportTail = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    const spacingMs = effectiveExportHoroscopeSpacingMs();
    if (spacingMs > 0 && lastHoroscopeExportRequestStartAt > 0) {
      const earliestNextStart = lastHoroscopeExportRequestStartAt + spacingMs;
      const waitMs = Math.max(0, earliestNextStart - Date.now());
      if (waitMs > 0) await sleep(waitMs);
    }
    lastHoroscopeExportRequestStartAt = Date.now();
    return await run();
  } finally {
    release();
  }
}

/** Auth-like record with optional encrypted DOB/TOB/POB */
export interface AuthLikeForKundli {
  date_of_birth: string;
  place_of_birth: string | null;
  time_of_birth: string | null;
}

/**
 * Map Auth user record to AstroKundli request params. Decrypts DOB/TOB/POB if encrypted.
 * Normalizes dob to YYYY-MM-DD and tob to HH:MM:SS.
 */
export function authToAstroKundliParams(auth: AuthLikeForKundli): AstroKundliRequestParams {
  const dobRaw = decrypt(auth.date_of_birth) ?? auth.date_of_birth;
  const placeRaw = auth.place_of_birth ? (decrypt(auth.place_of_birth) ?? auth.place_of_birth) : '';
  const tobRaw = auth.time_of_birth ? (decrypt(auth.time_of_birth) ?? auth.time_of_birth) : '00:00:00';

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
 * Uses the same `withHoroscopeExportThrottle` as real chart fetches so this POST does not
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
    const { status, ok, rawText } = await withHoroscopeExportThrottle(async () => {
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

export async function fetchHoroscopeChart(
  params: AstroKundliRequestParams,
  type: KundliJsonField
): Promise<Prisma.JsonValue> {
  return withHoroscopeExportThrottle(() => fetchHoroscopeChartImpl(params, type));
}

async function fetchHoroscopeChartImpl(
  params: AstroKundliRequestParams,
  type: KundliJsonField
): Promise<Prisma.JsonValue> {
  const transport = getAstroKundliTransport();
  const apiKey = getAstroKundliApiKey();

  const body = {
    dob: params.dob,
    tob: params.tob,
    place: params.place,
    type,
    ayanamsa: params.ayanamsa ?? 'LAHIRI',
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

    const responseStr = JSON.stringify(json);
    const maxLen = 1500;
    const truncated = responseStr.length > maxLen;
    console.log('[AstroKundli] response', {
      transport,
      url: targetLabel,
      type,
      status,
      ok,
      durationMs: Date.now() - startedAt,
      response_preview: truncated ? responseStr.slice(0, maxLen) + '...[truncated]' : responseStr,
      truncated,
    });

    if (isAstroKundliLogResponseEnabled()) {
      const queueMaxLen = 5000;
      const queueTruncated = responseStr.length > queueMaxLen;
      queueLog({
        event: 'astrokundli_api_response',
        transport,
        type,
        http_status: status,
        response_preview: queueTruncated ? responseStr.slice(0, queueMaxLen) + '...[truncated]' : responseStr,
        truncated: queueTruncated,
      });
    }

    if (!ok) {
      const errMsg =
        json?.error ?? (typeof json === 'object' && json && 'message' in json
          ? String((json as { message?: string }).message)
          : `HTTP ${status}`);
      throw new Error(errMsg);
    }

    return parseAstroKundliResponse(json);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AstroKundli] error', {
      transport,
      url: targetLabel,
      type,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    });
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err));
  }
}
