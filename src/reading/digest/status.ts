/**
 * Digest status on `kundlis` (docs/reading-engine/53 §4.1 Status, 54 §2): pending -> building -> ready, or failed with
 * the error type; stale when its inputs change (a registration pull stored new rows, the annual set grew) or a new
 * digest version ships. Plain status columns only.
 */
import type { PrismaClient } from '@prisma/client';
import { DIGEST_STATUSES, DIGEST_VERSION, type DigestStatus } from './types.js';

export function asDigestStatus(v: unknown): DigestStatus {
  return (DIGEST_STATUSES as readonly unknown[]).includes(v) ? (v as DigestStatus) : 'pending';
}

/** A ready digest built by another rule set counts as stale (the sweep rebuilds it). */
export function effectiveStatus(status: unknown, version: string | null | undefined): DigestStatus {
  const s = asDigestStatus(status);
  return s === 'ready' && version !== DIGEST_VERSION ? 'stale' : s;
}

export async function digestStatusOf(prisma: PrismaClient, kundliId: string): Promise<{ status: DigestStatus; version: string | null }> {
  const k = await prisma.kundli.findUnique({ where: { id: kundliId }, select: { digest_status: true, digest_version: true } });
  if (!k) return { status: 'pending', version: null };
  return { status: effectiveStatus(k.digest_status, k.digest_version), version: k.digest_version };
}

/**
 * New engine rows landed for this kundli: a ready digest becomes stale, a failed one pending (the sweep picks both up).
 * Pending and stale stay; a build in progress is left alone. Returns the rows changed. Never throws.
 */
export async function markDigestInputsChanged(prisma: PrismaClient, kundliId: string): Promise<number> {
  try {
    const a = await prisma.kundli.updateMany({ where: { id: kundliId, digest_status: 'ready' }, data: { digest_status: 'stale' } });
    const b = await prisma.kundli.updateMany({ where: { id: kundliId, digest_status: 'failed' }, data: { digest_status: 'pending', digest_error: null } });
    return a.count + b.count;
  } catch {
    return 0;
  }
}
