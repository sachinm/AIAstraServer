/**
 * Runs the readers while the person reads the clarify card, so the Oracle can start at once on confirm (docs/reading-engine/39
 * §5). Results go into the clarify row's `reading_runs.findings`, which any Lambda instance can read, and into this instance's
 * memo. This is not the journal: journal rows are written only after the Oracle, and these entries are copied into the journal
 * at confirm with source `prewarm`. Spend is saved with them, wasted calls included, and counts against the question's caps.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Usage } from '../types.js';
import type { ReaderResult } from './runReader.js';

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
