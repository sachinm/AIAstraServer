/**
 * Runs the readers while the person reads the clarify card, so the Oracle can start at once on confirm (docs/reading-engine/39
 * §5). Results go into the clarify row's `reading_runs.findings`, which any Lambda instance can read, and into this instance's
 * memo. This is not the journal: journal rows are written only after the Oracle, and these entries are copied into the journal
 * at confirm with source `prewarm`. Spend is saved with them, wasted calls included, and counts against the question's caps.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Usage } from '../types.js';
import type { ReaderResult } from './runReader.js';
import { clearValidatorCache } from './validator.js';

const MEMO_TTL_MS = 6 * 3_600_000;
const MEMO_MAX = 500;

export type HeldReader = { finding: ReaderResult['finding']; usage: Usage };
const memo = new Map<string, { at: number; value: HeldReader }>();

export function getReaderMemo(key: string): HeldReader | undefined {
  const e = memo.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > MEMO_TTL_MS) {
    memo.delete(key);
    return undefined;
  }
  return e.value;
}

export function setReaderMemo(key: string, value: HeldReader): void {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
  memo.set(key, { at: Date.now(), value });
}

/** Test seam. */
export function clearReaderMemo(): void {
  memo.clear();
  clearValidatorCache();
}

export interface PrewarmedSet {
  entries: Map<string, HeldReader>;
  spentUsd: number;
}

interface StoredPrewarm {
  prewarm: { entries: Array<{ key: string; finding: ReaderResult['finding']; usage: Usage }>; spentUsd: number };
}

/** What a clarify conversation already read. Never throws: no prewarm just means the readers run. */
export async function loadPrewarmed(prisma: PrismaClient, userId: string, clarifyRunId: string | undefined): Promise<PrewarmedSet | undefined> {
  if (!clarifyRunId) return undefined;
  try {
    const row = await prisma.readingRun.findFirst({ where: { id: clarifyRunId, user_id: userId }, select: { findings: true } });
    const stored = (row?.findings as unknown as StoredPrewarm | null)?.prewarm;
    if (!stored) return undefined;
    return { entries: new Map(stored.entries.map((e) => [e.key, { finding: e.finding, usage: e.usage }])), spentUsd: stored.spentUsd };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'prewarm read failed', error: (err as Error).message.slice(0, 200) }));
    return undefined;
  }
}

/** Adds to what the clarify row holds. A second prewarm (the horizon was answered) keeps the first one's spend. */
export async function savePrewarmed(prisma: PrismaClient, userId: string, clarifyRunId: string, add: { entries: Array<{ key: string; held: HeldReader }>; spentUsd: number }): Promise<void> {
  const prev = await loadPrewarmed(prisma, userId, clarifyRunId);
  const entries = new Map(prev?.entries ?? []);
  for (const e of add.entries) entries.set(e.key, e.held);
  const value: StoredPrewarm = {
    prewarm: { entries: [...entries.entries()].map(([key, h]) => ({ key, finding: h.finding, usage: h.usage })), spentUsd: (prev?.spentUsd ?? 0) + add.spentUsd },
  };
  await prisma.readingRun.updateMany({ where: { id: clarifyRunId, user_id: userId }, data: { findings: value as unknown as Prisma.InputJsonValue } });
}

/**
 * Cross-Lambda DB reader cache (`reading_findings_cache`, M35, docs/admin/06).
 * Natal readers (`R01..R06`) default to 7 days TTL; horizon-scoped readers (`R07..R13`) default to 6 hours TTL.
 * Tolerates a missing table or mock Prisma client without throwing.
 */
export async function loadDbReaderCache(prisma: PrismaClient | null | undefined, cacheKey: string): Promise<HeldReader | undefined> {
  const mem = getReaderMemo(cacheKey);
  if (mem) return mem;
  const model = (prisma as unknown as { readingFindingsCache?: { findUnique?: (args: unknown) => Promise<{ payload: unknown; expires_at: Date } | null> } })?.readingFindingsCache;
  if (!model?.findUnique) return undefined;
  try {
    const row = await model.findUnique({ where: { cache_key: cacheKey } });
    if (!row || row.expires_at.getTime() <= Date.now()) return undefined;
    const held = row.payload as HeldReader;
    if (held?.finding) {
      setReaderMemo(cacheKey, held);
      return held;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function saveDbReaderCache(
  prisma: PrismaClient | null | undefined,
  entry: {
    cacheKey: string;
    kundliId: string;
    readerId: string;
    packHash: string;
    horizonKey: string;
    promptVersion: string;
    natal: boolean;
    held: HeldReader;
  },
): Promise<void> {
  setReaderMemo(entry.cacheKey, entry.held);
  const model = (prisma as unknown as { readingFindingsCache?: { upsert?: (args: unknown) => Promise<unknown> } })?.readingFindingsCache;
  if (!model?.upsert) return;
  const ttlMs = entry.natal ? 7 * 24 * 3_600_000 : MEMO_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await model.upsert({
      where: { cache_key: entry.cacheKey },
      create: {
        cache_key: entry.cacheKey,
        kundli_id: entry.kundliId,
        reader_id: entry.readerId,
        pack_hash: entry.packHash,
        horizon_key: entry.horizonKey,
        prompt_version: entry.promptVersion,
        payload: entry.held as unknown as Prisma.InputJsonValue,
        expires_at: expiresAt,
      },
      update: {
        payload: entry.held as unknown as Prisma.InputJsonValue,
        expires_at: expiresAt,
      },
    });
  } catch {
    // missing table or read-only replica: in-memory memo already holds the entry
  }
}
