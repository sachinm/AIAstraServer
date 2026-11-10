/** Shared test inputs for the digest: the research fixture and a small in-memory Prisma stand-in. */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface DigestFixture {
  calcVersions: Record<string, string | null>;
  items: Record<string, unknown>;
}

export function loadFixture(): DigestFixture {
  const raw = JSON.parse(readFileSync(path.resolve(__dirname, '../../../fixtures/digest/research-a.json'), 'utf8')) as DigestFixture;
  return structuredClone(raw);
}

type Row = Record<string, unknown>;

/** Like a Prisma promise: runs when awaited (or when a transaction awaits it), not when created. */
function lazy<T>(fn: () => T): PromiseLike<T> & { catch: (rej: (e: unknown) => unknown) => Promise<unknown> } {
  let p: Promise<T> | null = null;
  const run = () => (p ??= Promise.resolve().then(fn));
  return { then: (res, rej) => run().then(res, rej), catch: (rej) => run().catch(rej) };
}

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === 'NOT') return !matches(row, v as Record<string, unknown>);
    if (k === 'OR') return (v as Record<string, unknown>[]).some((w) => matches(row, w));
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      const o = v as { in?: unknown[]; lt?: Date; not?: unknown; lte?: number; gte?: number };
      if (typeof o.lte === 'number' || typeof o.gte === 'number') {
        const n = row[k] as number;
        return (typeof o.lte !== 'number' || n <= o.lte) && (typeof o.gte !== 'number' || n >= o.gte) && (!o.in || o.in.includes(n));
      }
      if (o.in) return o.in.includes(row[k]);
      if (o.lt) return row[k] instanceof Date && (row[k] as Date) < o.lt;
      return true;
    }
    return row[k] === v;
  });
}

/** Enough of PrismaClient for buildDigest, loadDigest, status and the sweep: kundlis, kundli_data, kundli_facts, kundli_digest, kundli_activation. */
export function fakeDigestPrisma(opts: { kundlis?: Row[]; data?: Row[]; dossier?: unknown; onReadData?: () => void } = {}) {
  const kundlis = new Map<string, Row>((opts.kundlis ?? []).map((k) => [k.id as string, { digest_status: 'pending', digest_version: null, digest_built_at: null, digest_error: null, facts_status: 'ready', created_at: new Date(0), ...k }]));
  const digest: Row[] = [];
  const activation: Row[] = [];
  const calls = { digestFindMany: 0, transactions: 0, agentRuns: 0 };
  const prisma = {
    kundli: {
      updateMany({ where, data }: { where: Row; data: Row }) {
        return lazy(() => {
          let count = 0;
          for (const k of kundlis.values()) if (matches(k, where)) (Object.assign(k, data), (count += 1));
          return { count };
        });
      },
      async findUnique({ where }: { where: { id: string } }) {
        return kundlis.get(where.id) ?? null;
      },
      async findMany({ where, take }: { where?: Row; take?: number }) {
        return [...kundlis.values()].filter((k) => matches(k, where)).slice(0, take ?? 1000);
      },
    },
    kundliData: {
      async findMany() {
        opts.onReadData?.();
        return opts.data ?? [];
      },
    },
    kundliFacts: {
      async findUnique() {
        return opts.dossier ? { dossier: opts.dossier, engine_commit: 'test' } : null;
      },
    },
    kundliDigest: {
      deleteMany({ where }: { where: Row }) {
        return lazy(() => {
          const keep = digest.filter((r) => !matches(r, where));
          const n = digest.length - keep.length;
          digest.splice(0, digest.length, ...keep);
          return { count: n };
        });
      },
      createMany({ data }: { data: Row[] }) {
        return lazy(() => (digest.push(...data), { count: data.length }));
      },
      async findMany({ where }: { where: Row }) {
        calls.digestFindMany += 1;
        return digest.filter((r) => matches(r, where));
      },
    },
    kundliActivation: {
      deleteMany({ where }: { where: Row }) {
        return lazy(() => {
          const keep = activation.filter((r) => !matches(r, where));
          const n = activation.length - keep.length;
          activation.splice(0, activation.length, ...keep);
          return { count: n };
        });
      },
      createMany({ data }: { data: Row[] }) {
        return lazy(() => (activation.push(...data), { count: data.length }));
      },
      lastFindMany: null as unknown,
      async findMany(args: unknown) {
        prisma.kundliActivation.lastFindMany = args;
        return [];
      },
    },
    agentRegistry: { async upsert() { return {}; } },
    agentRun: { async create() { calls.agentRuns += 1; return {}; } },
    async $transaction(ops: PromiseLike<unknown>[]) {
      calls.transactions += 1;
      const out: unknown[] = [];
      for (const op of ops) out.push(await op);
      return out;
    },
  };
  return { prisma, kundlis, digest, activation, calls };
}

/** kundli_data rows (as Prisma returns them) for the fixture items */
export function fixtureDataRows(f: DigestFixture): Row[] {
  return Object.entries(f.items)
    .filter(([k]) => k !== 'facts')
    .map(([k, payload]) => {
      const at = k.indexOf('@');
      return { data_type: at < 0 ? k : k.slice(0, at), variant: at < 0 ? '' : k.slice(at + 1), calc_version: f.calcVersions[k] ?? null, payload };
    });
}
