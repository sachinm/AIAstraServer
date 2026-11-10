/**
 * The database disk guard (2026-11-09 incident: the dasha levels backfill filled the Render Postgres disk to 100 %,
 * Postgres could not write WAL and the API went down). Before a bulk activation write, read the database size, estimate
 * the bytes the write adds (rows × measured bytes per `kundli_activation` row) and refuse when
 *   size + estimate > DB_DISK_LIMIT_BYTES × DB_DISK_MAX_FILL.
 * DB_DISK_LIMIT_BYTES has no default: the operator states the disk (e.g. 5368709120 for the 5 GB Render disk).
 * DB_DISK_MAX_FILL defaults to 0.7 (WAL, indexes, vacuum and dead tuples need the rest).
 * Deletes do not free disk until a vacuum, so the estimate counts every inserted row as new bytes.
 */
import type { PrismaClient } from '@prisma/client';

export const DEFAULT_DB_DISK_MAX_FILL = 0.7;
/** Bytes per kundli_activation row (heap + indexes) when it cannot be measured (empty table, query error) */
export const FALLBACK_ACTIVATION_BYTES_PER_ROW = 350;
export const DB_DISK_LIMIT_HINT = 'set DB_DISK_LIMIT_BYTES to the database disk size in bytes (e.g. 5368709120 for the 5 GB Render disk)';

export interface DiskLimits {
  /** the database disk in bytes; null when DB_DISK_LIMIT_BYTES is unset or invalid */
  limitBytes: number | null;
  /** fraction of the disk the guard lets the database reach */
  maxFill: number;
  /** why limitBytes is null, when it is */
  problem?: string;
}

export function diskLimitsFromEnv(env: Record<string, string | undefined> = process.env): DiskLimits {
  const rawFill = env.DB_DISK_MAX_FILL?.trim();
  const fill = rawFill ? Number(rawFill) : DEFAULT_DB_DISK_MAX_FILL;
  const maxFill = Number.isFinite(fill) && fill > 0 && fill <= 1 ? fill : DEFAULT_DB_DISK_MAX_FILL;
  const raw = env.DB_DISK_LIMIT_BYTES?.trim();
  if (!raw) return { limitBytes: null, maxFill, problem: `DB_DISK_LIMIT_BYTES is not set: ${DB_DISK_LIMIT_HINT}` };
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) return { limitBytes: null, maxFill, problem: `DB_DISK_LIMIT_BYTES=${raw} is not a positive whole number of bytes: ${DB_DISK_LIMIT_HINT}` };
  return { limitBytes: n, maxFill };
}

/** The two measurements (production: raw SQL on Postgres; tests: numbers). */
export interface DiskProbe {
  /** `pg_database_size(current_database())` */
  databaseSize(): Promise<number>;
  /** `pg_total_relation_size('kundli_activation') / count(*)`, or null when the table is empty */
  activationBytesPerRow(): Promise<number | null>;
}

export function prismaDiskProbe(prisma: PrismaClient): DiskProbe {
  return {
    async databaseSize() {
      const r = await prisma.$queryRaw<Array<{ size: bigint | number }>>`SELECT pg_database_size(current_database())::bigint AS size`;
      return Number(r[0]?.size ?? 0);
    },
    async activationBytesPerRow() {
      const r = await prisma.$queryRaw<Array<{ bytes: bigint | number; n: bigint | number }>>`
        SELECT pg_total_relation_size('kundli_activation')::bigint AS bytes, (SELECT count(*) FROM "kundli_activation")::bigint AS n`;
      const bytes = Number(r[0]?.bytes ?? 0);
      const n = Number(r[0]?.n ?? 0);
      return n > 0 && bytes > 0 ? bytes / n : null;
    },
  };
}

export interface DiskVerdict {
  ok: boolean;
  sizeBytes: number;
  rows: number;
  bytesPerRow: number;
  estimateBytes: number;
  limitBytes: number | null;
  maxFill: number;
  thresholdBytes: number | null;
  message: string;
}

const mb = (b: number) => `${(b / 1_048_576).toFixed(1)} MB`;

/** PURE. Whether `rows` more activation rows fit under limit × max fill. An unset limit never fits. */
export function judgeDisk(sizeBytes: number, rows: number, bytesPerRow: number, limits: DiskLimits): DiskVerdict {
  const estimateBytes = Math.ceil(Math.max(0, rows) * bytesPerRow);
  const base = { sizeBytes, rows, bytesPerRow, estimateBytes, limitBytes: limits.limitBytes, maxFill: limits.maxFill };
  if (limits.limitBytes == null) {
    return { ...base, ok: false, thresholdBytes: null, message: `disk guard: ${limits.problem ?? DB_DISK_LIMIT_HINT}` };
  }
  const thresholdBytes = Math.floor(limits.limitBytes * limits.maxFill);
  const ok = sizeBytes + estimateBytes <= thresholdBytes;
  const message =
    `disk guard: database ${mb(sizeBytes)} (${sizeBytes} B) + estimate ${mb(estimateBytes)} (${rows} rows × ${bytesPerRow.toFixed(0)} B) ` +
    `${ok ? '<=' : '>'} threshold ${mb(thresholdBytes)} (${limits.limitBytes} B × ${limits.maxFill})${ok ? '' : ': refusing to write'}`;
  return { ...base, ok, thresholdBytes, message };
}

export interface DiskGuard {
  limits: DiskLimits;
  /** measured once (memoised); FALLBACK_ACTIVATION_BYTES_PER_ROW when it cannot be measured */
  bytesPerRow(): Promise<number>;
  /** read the database size now and judge `rows` more activation rows */
  check(rows: number): Promise<DiskVerdict>;
}

export function createDiskGuard(probe: DiskProbe, limits: DiskLimits = diskLimitsFromEnv()): DiskGuard {
  let bpr: Promise<number> | null = null;
  const bytesPerRow = () =>
    (bpr ??= probe
      .activationBytesPerRow()
      .then((v) => (v != null && Number.isFinite(v) && v > 0 ? v : FALLBACK_ACTIVATION_BYTES_PER_ROW))
      .catch(() => FALLBACK_ACTIVATION_BYTES_PER_ROW));
  return {
    limits,
    bytesPerRow,
    async check(rows) {
      const [size, perRow] = await Promise.all([probe.databaseSize(), bytesPerRow()]);
      return judgeDisk(size, rows, perRow, limits);
    },
  };
}
