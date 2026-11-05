/**
 * The one place every Prisma query passes through (docs/privacy/01 §4.1.2, docs/privacy/02 §4.1.4).
 *
 *  - Reads: walks the result by model, `include`/`select` relations too, and opens every sealed value (`pii2:`, `{ $pii }`,
 *    legacy `enc:`). Plain values pass through untouched, so plain and sealed rows coexist (read-both).
 *  - Writes: with PII_WRITE_MODE=sealed, seals the mapped fields on create, createMany, update, updateMany, upsert and nested
 *    writes, under the owner's key. With `plain` (B1, B2) writes are left as they are.
 *  - Guard: a `where`, `orderBy`, `cursor`, `distinct` or `by` naming a sealed field throws in every environment, except a
 *    null check (sealed and plain agree on null) and an equality on `auth.email` / `auth.username`, which is rewritten to
 *    the blind index once rows are sealed.
 *
 * Raw SQL does not pass through here; those files use `rawSql.ts` and are listed in tests/unit/rawSqlAllowList.test.ts.
 */
import { Prisma } from '@prisma/client';
import { SEALED_MODELS, sealedColumn, type SealedModel } from './fields.js';
import { blindIndex } from './blindIndex.js';
import { piiConfig, piiKeys, PiiUnavailableError, type PiiKeyProvider, type PiiWriteMode } from './keys.js';
import { openValue, sealValue } from './seal.js';

export const PII_GUARD = 'PII_GUARD';

/** A query that would filter or sort on a sealed column: it cannot work once the column holds ciphertext. */
export class PiiGuardError extends Error {
  readonly code = PII_GUARD;
  constructor(model: string, field: string, where: string) {
    super(`${PII_GUARD}: ${model}.${field} is sealed and cannot be used in ${where}`);
    this.name = 'PiiGuardError';
  }
}

/** model -> relation field -> related model, from the generated client's datamodel */
export type RelationMap = Record<string, Record<string, string>>;

export function relationMapFromDmmf(): RelationMap {
  const out: RelationMap = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    out[m.name] = Object.fromEntries(m.fields.filter((f) => f.kind === 'object').map((f) => [f.name, f.type]));
  }
  return out;
}

export interface WriteOwner {
  model: string;
  /** the row's data as written (scalar fields), to find user_id / kundli_id / chat_id / ... */
  data: Record<string, unknown>;
  /** the operation's `where`, for an update whose data does not carry the owner column */
  where?: Record<string, unknown>;
  /** the key_ref of the enclosing row, for nested writes */
  parentKeyRef?: string | null;
}

export interface PiiExtensionDeps {
  keys: () => PiiKeyProvider | null;
  writeMode: () => PiiWriteMode;
  /**
   * The owner's key_ref for a sealed write. null = the row belongs to no person (a global transit snapshot). B2 wires
   * the lookup through `auth.key_ref` (M26); until then sealed mode cannot be used and this throws.
   */
  keyRefFor: (owner: WriteOwner) => Promise<string | null>;
  relations: RelationMap;
}

const defaultKeyRefFor = async (): Promise<string | null> => {
  throw new PiiUnavailableError('owner key lookup needs auth.key_ref (M26, docs/privacy/02 B2)');
};

let relationCache: RelationMap | null = null;

export function defaultPiiDeps(): PiiExtensionDeps {
  return {
    keys: piiKeys,
    writeMode: () => piiConfig().writeMode,
    keyRefFor: defaultKeyRefFor,
    relations: (relationCache ??= relationMapFromDmmf()),
  };
}

// ---------------------------------------------------------------------------------------------------------------- guard

const NULL_TYPE_NAMES = new Set(['DbNull', 'JsonNull', 'AnyNull']);

function isNullish(v: unknown): boolean {
  if (v === null) return true;
  if (v && typeof v === 'object') {
    const ctor = (v as { constructor?: { name?: string } }).constructor?.name;
    if (ctor && NULL_TYPE_NAMES.has(ctor)) return true;
    // Prisma's null sentinels serialise as their class name in some versions
    if (NULL_TYPE_NAMES.has(String((v as { _getName?: () => string })._getName?.() ?? ''))) return true;
  }
  return false;
}

/** `null`, `{ equals: null }`, `{ not: null }`, `{ not: Prisma.DbNull }`: the same answer for sealed and plain rows. */
function isNullCheck(filter: unknown): boolean {
  if (isNullish(filter)) return true;
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return false;
  const entries = Object.entries(filter as Record<string, unknown>);
  return entries.length > 0 && entries.every(([k, v]) => (k === 'equals' || k === 'not') && isNullish(v));
}

/** An equality on a blind-indexed field: `'x'` or `{ equals: 'x', mode?: 'insensitive' }`. Returns the value or null. */
function equalityValue(filter: unknown): string | null {
  if (typeof filter === 'string') return filter;
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return null;
  const f = filter as Record<string, unknown>;
  const keys = Object.keys(f);
  if (typeof f.equals === 'string' && keys.every((k) => k === 'equals' || k === 'mode')) return f.equals;
  return null;
}

const LOGICAL = new Set(['AND', 'OR', 'NOT']);
const RELATION_FILTERS = new Set(['some', 'every', 'none', 'is', 'isNot']);

interface GuardCtx {
  deps: PiiExtensionDeps;
  sealed: boolean;
}

/** Checks (and in sealed mode rewrites) one `where` object for a model. Returns the where to use. */
async function guardWhere(model: string, where: unknown, ctx: GuardCtx): Promise<unknown> {
  if (!where || typeof where !== 'object') return where;
  if (Array.isArray(where)) return Promise.all(where.map((w) => guardWhere(model, w, ctx)));
  const spec: SealedModel | undefined = SEALED_MODELS[model];
  const rels = ctx.deps.relations[model] ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    if (LOGICAL.has(key)) {
      out[key] = await guardWhere(model, value, ctx);
      continue;
    }
    const related = rels[key];
    if (related) {
      if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((k) => RELATION_FILTERS.has(k))) {
        const v = value as Record<string, unknown>;
        const next: Record<string, unknown> = {};
        for (const [rk, rv] of Object.entries(v)) next[rk] = RELATION_FILTERS.has(rk) ? await guardWhere(related, rv, ctx) : rv;
        out[key] = next;
      } else {
        out[key] = await guardWhere(related, value, ctx);
      }
      continue;
    }
    if (spec && spec.fields[key]) {
      if (isNullCheck(value)) {
        out[key] = value;
        continue;
      }
      const bidxColumn = spec.blindIndexed?.[key];
      const eq = bidxColumn ? equalityValue(value) : null;
      if (bidxColumn && eq !== null) {
        if (ctx.sealed) {
          const keys = ctx.deps.keys();
          if (!keys) throw new PiiUnavailableError('no key provider for the blind index');
          out[bidxColumn] = await blindIndex(eq, keys);
        } else {
          out[key] = value;
        }
        continue;
      }
      throw new PiiGuardError(model, key, 'a where filter');
    }
    out[key] = value;
  }
  return out;
}

function guardOrderBy(model: string, orderBy: unknown, deps: PiiExtensionDeps): void {
  if (!orderBy || typeof orderBy !== 'object') return;
  if (Array.isArray(orderBy)) return orderBy.forEach((o) => guardOrderBy(model, o, deps));
  const spec = SEALED_MODELS[model];
  const rels = deps.relations[model] ?? {};
  for (const [key, value] of Object.entries(orderBy as Record<string, unknown>)) {
    if (spec?.fields[key]) throw new PiiGuardError(model, key, 'orderBy');
    if (rels[key]) guardOrderBy(rels[key]!, value, deps);
  }
}

function guardFieldList(model: string, list: unknown, where: string): void {
  const spec = SEALED_MODELS[model];
  if (!spec) return;
  const names = Array.isArray(list) ? list : typeof list === 'string' ? [list] : list && typeof list === 'object' ? Object.keys(list) : [];
  for (const n of names) if (typeof n === 'string' && spec.fields[n]) throw new PiiGuardError(model, n, where);
}

/** Guards the query arguments of one model, recursing into `include`/`select` relation arguments. */
async function guardArgs(model: string, args: Record<string, unknown>, ctx: GuardCtx): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...args };
  if ('where' in args) out.where = await guardWhere(model, args.where, ctx);
  if ('orderBy' in args) guardOrderBy(model, args.orderBy, ctx.deps);
  if ('cursor' in args) guardFieldList(model, args.cursor, 'a cursor');
  if ('distinct' in args) guardFieldList(model, args.distinct, 'distinct');
  if ('by' in args) guardFieldList(model, args.by, 'groupBy');
  if ('having' in args) out.having = await guardWhere(model, args.having, ctx);
  const rels = ctx.deps.relations[model] ?? {};
  for (const part of ['include', 'select'] as const) {
    const sel = args[part];
    if (!sel || typeof sel !== 'object') continue;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sel as Record<string, unknown>)) {
      next[k] = rels[k] && v && typeof v === 'object' ? await guardArgs(rels[k]!, v as Record<string, unknown>, ctx) : v;
    }
    out[part] = next;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- reads

/** Opens every sealed value in a result, by model, recursing into relations. Mutates and returns the result. */
export async function openResult(model: string, result: unknown, deps: Pick<PiiExtensionDeps, 'keys' | 'relations'>): Promise<unknown> {
  if (!result || typeof result !== 'object') return result;
  if (Array.isArray(result)) {
    for (const r of result) await openResult(model, r, deps);
    return result;
  }
  const spec = SEALED_MODELS[model];
  const rels = deps.relations[model] ?? {};
  const row = result as Record<string, unknown>;
  for (const [key, value] of Object.entries(row)) {
    const col = spec ? sealedColumn(model, key) : null;
    if (col) {
      if (value !== null && value !== undefined) row[key] = await openValue(value, { table: spec!.table, column: key, kind: col.kind }, deps.keys());
    } else if (rels[key] && value && typeof value === 'object') {
      await openResult(rels[key]!, value, deps);
    }
  }
  return result;
}

// --------------------------------------------------------------------------------------------------------------- writes

const NESTED_CREATES = ['create', 'createMany', 'connectOrCreate', 'upsert', 'update', 'updateMany'] as const;

async function sealFieldValue(model: string, field: string, value: unknown, keyRef: string, keys: PiiKeyProvider): Promise<unknown> {
  const spec = SEALED_MODELS[model]!;
  const col = sealedColumn(model, field)!;
  const ctx = { table: spec.table, column: field, kind: col.kind };
  // atomic `{ set: value }` on a text column
  if (col.kind === 'text' && value && typeof value === 'object' && !Array.isArray(value) && 'set' in (value as object)) {
    return { set: await sealValue((value as { set: unknown }).set, ctx, keyRef, keys) };
  }
  if (isNullish(value)) return value;
  return sealValue(value, ctx, keyRef, keys);
}

/** Seals the mapped fields of one `data` object (and its nested writes) for a model. */
async function sealData(model: string, data: unknown, deps: PiiExtensionDeps, keys: PiiKeyProvider, owner: { where?: Record<string, unknown>; parentKeyRef?: string | null }): Promise<unknown> {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return Promise.all(data.map((d) => sealData(model, d, deps, keys, owner)));
  const spec = SEALED_MODELS[model];
  const rels = deps.relations[model] ?? {};
  const row = { ...(data as Record<string, unknown>) };
  const sealedNames = spec ? Object.keys(row).filter((k) => sealedColumn(model, k)) : [];
  let keyRef: string | null | undefined;
  if (sealedNames.length) {
    keyRef = await deps.keyRefFor({ model, data: row, ...(owner.where ? { where: owner.where } : {}), ...(owner.parentKeyRef !== undefined ? { parentKeyRef: owner.parentKeyRef } : {}) });
    if (!keyRef) {
      if (!spec!.ownerOptional) throw new PiiUnavailableError(`no owner key for ${spec!.table}`);
    } else {
      // the blind index travels with the sealed value, computed from the plain value written
      for (const [field, bidxColumn] of Object.entries(spec!.blindIndexed ?? {})) {
        const v = row[field];
        const plain = typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { set?: unknown }).set === 'string' ? (v as { set: string }).set : null;
        if (plain !== null && !isSealedLike(plain)) row[bidxColumn] = await blindIndex(plain, keys);
      }
      for (const k of sealedNames) row[k] = await sealFieldValue(model, k, row[k], keyRef, keys);
    }
  }
  for (const [rel, related] of Object.entries(rels)) {
    const nested = row[rel];
    if (!nested || typeof nested !== 'object') continue;
    const n = { ...(nested as Record<string, unknown>) };
    const childOwner = { parentKeyRef: keyRef ?? owner.parentKeyRef ?? null };
    for (const kind of NESTED_CREATES) {
      if (!(kind in n)) continue;
      const v = n[kind] as unknown;
      if (kind === 'createMany') n[kind] = { ...(v as object), data: await sealData(related, (v as { data?: unknown }).data, deps, keys, childOwner) };
      else if (kind === 'connectOrCreate') n[kind] = await mapMaybeArray(v, async (x) => ({ ...(x as object), create: await sealData(related, (x as { create?: unknown }).create, deps, keys, childOwner) }));
      else if (kind === 'upsert') n[kind] = await mapMaybeArray(v, async (x) => ({ ...(x as object), create: await sealData(related, (x as { create?: unknown }).create, deps, keys, childOwner), update: await sealData(related, (x as { update?: unknown }).update, deps, keys, childOwner) }));
      else if (kind === 'update' || kind === 'updateMany') n[kind] = await mapMaybeArray(v, async (x) => (x && typeof x === 'object' && 'data' in (x as object) ? { ...(x as object), data: await sealData(related, (x as { data?: unknown }).data, deps, keys, childOwner) } : sealData(related, x, deps, keys, childOwner)));
      else n[kind] = await sealData(related, v, deps, keys, childOwner);
    }
    row[rel] = n;
  }
  return row;
}

const isSealedLike = (v: string): boolean => v.startsWith('pii2:') || v.startsWith('pii2z:') || v.startsWith('enc:');

async function mapMaybeArray(v: unknown, f: (x: unknown) => Promise<unknown>): Promise<unknown> {
  return Array.isArray(v) ? Promise.all(v.map(f)) : f(v);
}

async function sealWriteArgs(model: string, operation: string, args: Record<string, unknown>, deps: PiiExtensionDeps): Promise<Record<string, unknown>> {
  const keys = deps.keys();
  if (!keys) throw new PiiUnavailableError('PII_WRITE_MODE=sealed with no key provider');
  const where = (args.where ?? undefined) as Record<string, unknown> | undefined;
  const out = { ...args };
  if (operation === 'upsert') {
    out.create = await sealData(model, args.create, deps, keys, {});
    out.update = await sealData(model, args.update, deps, keys, where ? { where } : {});
  } else if ('data' in args) {
    out.data = await sealData(model, args.data, deps, keys, where ? { where } : {});
  }
  return out;
}

const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert']);

// ----------------------------------------------------------------------------------------------------------- the handler

export interface QueryParams {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

export async function piiQuery(params: QueryParams, deps: PiiExtensionDeps = defaultPiiDeps()): Promise<unknown> {
  const { model, operation } = params;
  if (!model) return params.query(params.args);
  const sealed = deps.writeMode() === 'sealed';
  let args = (params.args ?? {}) as Record<string, unknown>;
  args = await guardArgs(model, args, { deps, sealed });
  if (sealed && WRITES.has(operation)) args = await sealWriteArgs(model, operation, args, deps);
  const result = await params.query(args);
  return openResult(model, result, deps);
}

/** The client extension: every model, every operation. Query-only, so the client's types are unchanged. */
export const piiExtension = Prisma.defineExtension({
  name: 'pii',
  query: {
    $allModels: {
      $allOperations(params) {
        return piiQuery(params as QueryParams) as never;
      },
    },
  },
});
