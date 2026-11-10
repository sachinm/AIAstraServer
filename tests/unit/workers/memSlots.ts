/** Test helper: the dasha-deep cap (createDeepSlots) over an in-memory marker map. */
import { createDeepSlots, type SlotRow, type SlotTx } from '../../../src/workers/dashaDeepSlots.js';

export interface MemSlotsOpts {
  /** serialise starters like pg_advisory_xact_lock (default true); false shows what the lock prevents */
  lock?: boolean;
  /** yield to the event loop between the count and the write, so concurrent starters interleave */
  interleave?: boolean;
}

export function memSlots(opts: MemSlotsOpts = {}) {
  const markers = new Map<string, SlotRow>();
  const tick = () => (opts.interleave ? new Promise((r) => setTimeout(r, 0)) : Promise.resolve());
  const tx: SlotTx = {
    countLive: async (except, since) => {
      await tick();
      return [...markers].filter(([k, m]) => k !== except && (m.status === 'dispatched' || m.status === 'fetching') && (m.fetchStartedAt?.getTime() ?? 0) > since.getTime()).length;
    },
    readOwn: async (k) => {
      await tick();
      return markers.get(k);
    },
    write: async (k, status, startedAt) => {
      await tick();
      const base = markers.get(k) ?? ({ dataType: 'dasha.deep', variant: 'marker', params: {}, calcVersion: null, payload: null, error: null, fetchStartedAt: null, fetchedAt: null, validTo: null } as SlotRow);
      markers.set(k, { ...base, status, ...(startedAt ? { fetchStartedAt: startedAt } : {}) });
    },
  };
  let chain: Promise<unknown> = Promise.resolve();
  const slots = createDeepSlots({
    withLock: <T>(fn: (t: SlotTx) => Promise<T>): Promise<T> => {
      if (opts.lock === false) return fn(tx);
      const run = chain.then(() => fn(tx));
      chain = run.catch(() => undefined);
      return run;
    },
  });
  return { markers, slots };
}
