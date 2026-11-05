/**
 * Sealing for the raw-SQL sites, which the Prisma extension cannot see (docs/privacy/02 §4.1.4). Each file that runs
 * a raw query (queryRaw or executeRaw) on a personal table binds personal values through `sealParam` and reads rows through
 * `openRow`; tests/unit/rawSqlAllowList.test.ts fails on a raw-SQL file that is not on the reviewed list.
 *
 * With PII_WRITE_MODE=plain (B1, B2) `sealParam` returns the value unchanged and `openRow` opens only values that are
 * already sealed, so these sites behave exactly as before.
 */
import { SEALED_TABLES, type SealedModel } from './fields.js';
import { piiConfig, piiKeys, PiiUnavailableError, SYSTEM_KEY_REF, type PiiKeyProvider, type PiiWriteMode } from './keys.js';
import { openValue, sealValue } from './seal.js';

/** Whose key seals a value: the person (by user or kundli id, resolved in B2 through auth.key_ref) or the system key. */
export type PiiOwner = { userId: string } | { kundliId: string } | { system: true };

export interface RawSqlDeps {
  keys: () => PiiKeyProvider | null;
  writeMode: () => PiiWriteMode;
  keyRefFor: (owner: PiiOwner) => Promise<string>;
}

const defaultKeyRefFor = async (owner: PiiOwner): Promise<string> => {
  if ('system' in owner) return SYSTEM_KEY_REF;
  throw new PiiUnavailableError('owner key lookup needs auth.key_ref (M26, docs/privacy/02 B2)');
};

let deps: RawSqlDeps = { keys: piiKeys, writeMode: () => piiConfig().writeMode, keyRefFor: defaultKeyRefFor };

/** Tests (and B2's key_ref wiring) replace the dependencies; `null` restores the defaults. */
export function setRawSqlDeps(next: Partial<RawSqlDeps> | null): void {
  deps = next ? { ...deps, ...next } : { keys: piiKeys, writeMode: () => piiConfig().writeMode, keyRefFor: defaultKeyRefFor };
}

function spec(table: string): SealedModel {
  const m = SEALED_TABLES[table];
  if (!m) throw new Error(`rawSql: ${table} is not in src/lib/pii/fields.ts`);
  return m;
}

/**
 * The value to bind for one column. Sealed mode: a text column becomes `pii2:...`, a JSON column `{ $pii }` (the caller
 * still `JSON.stringify`s it for `::jsonb`). A column not in the field map is returned as it is.
 */
export async function sealParam<T>(table: string, column: string, value: T, owner: PiiOwner): Promise<T> {
  const col = spec(table).fields[column];
  if (!col || col.pending || value === null || value === undefined) return value;
  if (deps.writeMode() !== 'sealed') return value;
  const keys = deps.keys();
  if (!keys) throw new PiiUnavailableError('PII_WRITE_MODE=sealed with no key provider');
  return (await sealValue(value, { table, column, kind: col.kind }, await deps.keyRefFor(owner), keys)) as T;
}

/** Opens the sealed columns of one row read by raw SQL (the key_ref comes from each value). */
export async function openRow<R extends Record<string, unknown>>(table: string, row: R): Promise<R> {
  const m = spec(table);
  const out: Record<string, unknown> = { ...row };
  for (const [column, col] of Object.entries(m.fields)) {
    if (col.pending || !(column in out)) continue;
    const v = out[column];
    if (v !== null && v !== undefined) out[column] = await openValue(v, { table, column, kind: col.kind }, deps.keys());
  }
  return out as R;
}

export async function openRows<R extends Record<string, unknown>>(table: string, rows: R[]): Promise<R[]> {
  return Promise.all(rows.map((r) => openRow(table, r)));
}
