/**
 * Client for the new pyjhora Lambda exports (`facts`, `transits`). The Lambda computes everything; this module only
 * sends the birth data, validates the response against the JSON schema and returns it. Until the Radha service
 * implements these types the engine answers with a validation error, which surfaces as `EngineUnsupportedError` so
 * callers can fall back to the legacy chat path without noise.
 */
import { authToAstroKundliParams, fetchEngineExport, type AuthLikeForKundli } from '../../lib/astroKundliClient.js';
import type { Dossier } from '../facts/types.js';
import { validateFacts, validateTransits } from '../schema/validate.js';
import type { TransitChart } from '../transits/types.js';

export class EngineUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineUnsupportedError';
  }
}
export class EngineContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineContractError';
  }
}

export interface BirthInput {
  auth: AuthLikeForKundli;
  /** Stored once on the kundli after the first successful build; skips geocoding when present */
  coords?: { lat: number | null; lon: number | null; tz: number | null };
}

function body(input: BirthInput): { params: ReturnType<typeof authToAstroKundliParams>; extra: Record<string, unknown> } {
  const params = authToAstroKundliParams(input.auth);
  const extra: Record<string, unknown> = {};
  const c = input.coords;
  if (c && c.lat != null && c.lon != null && c.tz != null) {
    extra.lat = c.lat;
    extra.lon = c.lon;
    extra.tz = c.tz;
  }
  return { params, extra };
}

function unsupported(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /Input should be|literal_error|enum|Invalid export type|not (a )?valid|unsupported/i.test(m);
}

export async function fetchFacts(input: BirthInput, opts: { asOf: string; vargas?: string[] }): Promise<Dossier> {
  const { params, extra } = body(input);
  let raw: unknown;
  try {
    raw = await fetchEngineExport(params, 'facts', { ...extra, as_of: opts.asOf, ...(opts.vargas ? { vargas: opts.vargas } : {}) });
  } catch (err) {
    if (unsupported(err)) throw new EngineUnsupportedError(`engine does not serve type=facts yet: ${(err as Error).message}`);
    throw err;
  }
  const v = validateFacts(raw);
  if (!v.ok) throw new EngineContractError(`facts payload failed schema validation: ${v.error}`);
  return v.value!;
}

export async function fetchTransitChart(input: BirthInput, range: { from: string; to: string; asOf: string }): Promise<TransitChart> {
  const { params, extra } = body(input);
  let raw: unknown;
  try {
    raw = await fetchEngineExport(params, 'transits', { ...extra, scope: 'natal', from: range.from, to: range.to, as_of: range.asOf });
  } catch (err) {
    if (unsupported(err)) throw new EngineUnsupportedError(`engine does not serve type=transits yet: ${(err as Error).message}`);
    throw err;
  }
  const v = validateTransits(raw);
  if (!v.ok) throw new EngineContractError(`transits payload failed schema validation: ${v.error}`);
  return v.value!;
}
