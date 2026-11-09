/**
 * The contract between the Self v2 API and the agents lane's store (docs/reading-engine/66 §4.5, §13). The agents lane
 * exports `readSelfV2Latest` from `src/reading/self/v2/store.ts`; until that module is merged the default reader answers
 * `pending`, so this branch type-checks and runs on its own. Once the module exists the default picks it up; the
 * integrator may also pass the reader explicitly (`SelfV2Deps.readLatest`).
 */
import type { PrismaClient } from '@prisma/client';
import type { AreaBrief, OracleV2Output, PersonalCardDoc } from '../v2types.js';

export type SelfV2StoreStatus = 'ok' | 'pending' | 'failed';

/** What `readSelfV2Latest(prisma, kundliId)` returns: the latest stored build of the Self board v2. */
export interface SelfV2Latest {
  cards: PersonalCardDoc | null;
  oracle: OracleV2Output | null;
  briefs: AreaBrief[] | null;
  builtAt: string | null;
  status: SelfV2StoreStatus;
}

export type ReadSelfV2Latest = (prisma: PrismaClient, kundliId: string) => Promise<SelfV2Latest>;

export const NOTHING_STORED: Readonly<SelfV2Latest> = Object.freeze({ cards: null, oracle: null, briefs: null, builtAt: null, status: 'pending' });

let loaded: Promise<ReadSelfV2Latest | null> | null = null;

/** The agents lane's reader when its module is present, else null. Loaded once per process. */
export function loadStoreReader(): Promise<ReadSelfV2Latest | null> {
  loaded ??= (async () => {
    try {
      // a computed specifier: tsc does not resolve it, so this branch builds without the agents lane's module
      const spec = new URL('../v2/store.js', import.meta.url).href;
      const mod = (await import(spec)) as { readSelfV2Latest?: unknown };
      return typeof mod.readSelfV2Latest === 'function' ? (mod.readSelfV2Latest as ReadSelfV2Latest) : null;
    } catch {
      return null;
    }
  })();
  return loaded;
}

/** The default reader: the agents lane's when present, else `pending` with nothing stored. */
export const defaultReadSelfV2Latest: ReadSelfV2Latest = async (prisma, kundliId) => {
  const reader = await loadStoreReader();
  return reader ? reader(prisma, kundliId) : { ...NOTHING_STORED };
};
