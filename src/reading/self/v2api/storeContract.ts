/**
 * The contract between the Self v2 API and the build's store (docs/reading-engine/66 §4.5, §13). The reader is
 * `readSelfV2Latest` in `src/reading/self/v2/store.ts` (merged with the agents lane; the guarded dynamic import that
 * stood in for it is gone). The integrator may still pass a reader explicitly (`SelfV2Deps.readLatest`).
 */
import type { PrismaClient } from '@prisma/client';
import { readSelfV2Latest, type SelfV2Latest as StoreLatest } from '../v2/store.js';

export type SelfV2StoreStatus = 'ok' | 'pending' | 'failed';

/** What `readSelfV2Latest(prisma, kundliId, clock)` returns: the latest stored build of the Self board v2. */
export type SelfV2Latest = StoreLatest;

/** `clock`: read only that clock's build (null or absent: the newest build on any clock) */
export type ReadSelfV2Latest = (prisma: PrismaClient, kundliId: string, clock?: string | null) => Promise<SelfV2Latest>;

export const NOTHING_STORED: Readonly<SelfV2Latest> = Object.freeze({ cards: null, oracle: null, briefs: null, builtAt: null, status: 'pending', frame: null, stale: null, quality: null });

/** The default reader: the build's store. */
export const defaultReadSelfV2Latest: ReadSelfV2Latest = (prisma, kundliId, clock) => readSelfV2Latest(prisma, kundliId, clock);
