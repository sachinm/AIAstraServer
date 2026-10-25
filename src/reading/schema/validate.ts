/**
 * Runtime validation of what the pyjhora Lambda returns. A payload that fails validation is rejected before it
 * is stored or sent to a model, so a bad engine release cannot silently corrupt readings.
 */
import { Ajv, type ErrorObject } from 'ajv';
import type { Dossier } from '../facts/types.js';
import type { TransitChart } from '../transits/types.js';
import factsSchema from './facts.v1.schema.json' with { type: 'json' };
import transitsSchema from './transits.v1.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: false, strict: false });
// JSON imported with attributes so tsc copies the schema files into dist/ next to this module.
const factsValidator = ajv.compile(factsSchema as object);
const transitsValidator = ajv.compile(transitsSchema as object);

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function describe(errors: ErrorObject[] | null | undefined): string {
  const e = errors?.[0];
  return e ? `${e.instancePath || '/'} ${e.message ?? 'invalid'}` : 'invalid';
}

export function validateFacts(payload: unknown): ValidationResult<Dossier> {
  return factsValidator(payload) ? { ok: true, value: payload as Dossier } : { ok: false, error: describe(factsValidator.errors) };
}

export function validateTransits(payload: unknown): ValidationResult<TransitChart> {
  return transitsValidator(payload) ? { ok: true, value: payload as TransitChart } : { ok: false, error: describe(transitsValidator.errors) };
}
