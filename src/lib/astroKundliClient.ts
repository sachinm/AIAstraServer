import type { Prisma } from '@prisma/client';
import { getAstroKundliBaseUrl, getAstroKundliApiKey, isAstroKundliLogResponseEnabled } from '../config/env.js';
import { decrypt } from './encrypt.js';
import { queueLog } from './queueLogger.js';

/** Kundli column names we request from the API (one call per field) */
export const KUNDLI_JSON_FIELDS = [
  'biodata',
  'd1',
  'd7',
  'd9',
  'd10',
  'charakaraka',
  'vimsottari_dasa',
  'narayana_dasa'
] as const;

export type KundliJsonField = (typeof KUNDLI_JSON_FIELDS)[number];

/** Request body sent to POST /api/export-horoscope */
export interface AstroKundliRequestParams {
  dob: string; // "YYYY-MM-DD" or "YYYY,MM,DD"
  tob: string; // "HH:MM:SS"
  place: string; // "City, Country" or lat/lon/tz if API supports
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
/** Per-request timeout (each of the 8 data points is one request). Override with ASTROKUNDLI_TIMEOUT_MS env. */
const DEFAULT_TIMEOUT_MS = 15_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

function getHoroscopeTimeoutMs(): number {
  const env = process.env.ASTROKUNDLI_TIMEOUT_MS;
  if (env != null && env !== '') {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return DEFAULT_TIMEOUT_MS;
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
  const place = placeRaw.trim() || 'Unknown';

  return { dob, tob, place, ayanamsa: 'LAHIRI' };
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
  try {
    const res = await fetch(baseUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
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
 * Fetch a single horoscope chart/slice from the AstroKundli API.
 * One request = one data point for the given `type` (biodata, d1, d7, etc.).
 * Returns the JSON payload to store in the corresponding Kundli column.
 * Designed to be called in parallel for multiple types (e.g. all 8 KUNDLI_JSON_FIELDS)
 * from the queue service for concurrent I/O.
 */
export async function fetchHoroscopeChart(
  params: AstroKundliRequestParams,
  type: KundliJsonField
): Promise<Prisma.JsonValue> {
  const baseUrl = getAstroKundliBaseUrl();
  const url = `${baseUrl}${HOROSCOPE_PATH}`;
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = (await res.json()) as AstroKundliResponse<Record<string, unknown>>;

    if (isAstroKundliLogResponseEnabled()) {
      const responseStr = JSON.stringify(json);
      const maxLen = 5000;
      const truncated = responseStr.length > maxLen;
      queueLog({
        event: 'astrokundli_api_response',
        type,
        http_status: res.status,
        response_preview: truncated ? responseStr.slice(0, maxLen) + '...[truncated]' : responseStr,
        truncated,
      });
    }

    if (!res.ok) {
      const errMsg =
        json?.error ?? (typeof json === 'object' && json && 'message' in json
          ? String((json as { message?: string }).message)
          : `HTTP ${res.status}`);
      throw new Error(errMsg);
    }

    return parseAstroKundliResponse(json);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err));
  }
}
