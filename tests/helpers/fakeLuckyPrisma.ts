/**
 * In-memory stand-in for the Prisma delegates Lucky times, the agent registry and analytics use (docs/reading-engine/49).
 * Only the calls those modules make are implemented.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DAY_TABLE_PLACES, dayTablePlaceKey } from '../../src/reading/luckyTimes/places.js';

type Row = Record<string, any>;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function fakeLuckyPrisma(opts: { seedSanJose?: boolean } = {}) {
  const prefs = new Map<string, Row>();
  const picks: Row[] = [];
  const dayTables: Row[] = [];
  const overlays: Row[] = [];
  const registry = new Map<string, Row>();
  const runs: Row[] = [];
  const events: Row[] = [];
  let seq = 0;

  if (opts.seedSanJose !== false) {
    const fx = JSON.parse(fs.readFileSync(path.resolve('evals/fixtures/day-tables/sanjose/2026-11.json'), 'utf8')) as { days: Row[] };
    const key = dayTablePlaceKey(DAY_TABLE_PLACES.sanjose!);
    for (const d of fx.days) dayTables.push({ place_key: key, ayanamsa: 'LAHIRI', date: new Date(`${d.date}T00:00:00Z`), payload: d, calc_version: '1' });
  }

  const prisma = {
    luckyPref: {
      findUnique: async ({ where }: any) => prefs.get(where.user_id) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const r = prefs.get(where.user_id);
        const next = r ? { ...r, ...update } : { ...create };
        prefs.set(where.user_id, next);
        return next;
      },
    },
    luckyScenarioPick: {
      findMany: async ({ where }: any) => picks.filter((p) => p.user_id === where.user_id && (where.shown === undefined || p.shown === where.shown)),
      findUnique: async ({ where }: any) => picks.find((p) => p.user_id === where.user_id_scenario_id.user_id && p.scenario_id === where.user_id_scenario_id.scenario_id) ?? null,
      create: async ({ data }: any) => {
        const r = { id: `p${++seq}`, shown: true, answers: {}, created_at: new Date(Date.now() + seq), ...data };
        picks.push(r);
        return r;
      },
      update: async ({ where, data }: any) => {
        const r = picks.find((p) => p.id === where.id)!;
        Object.assign(r, data);
        return r;
      },
      deleteMany: async ({ where }: any) => {
        const before = picks.length;
        for (let i = picks.length - 1; i >= 0; i--) if (picks[i]!.user_id === where.user_id && picks[i]!.scenario_id === where.scenario_id) picks.splice(i, 1);
        return { count: before - picks.length };
      },
    },
    dayTable: {
      findMany: async ({ where }: any) =>
        dayTables
          .filter((r) => r.place_key === where.place_key && r.date >= where.date.gte && r.date <= where.date.lte)
          .sort((a, b) => a.date.getTime() - b.date.getTime()),
      upsert: async ({ where, create, update }: any) => {
        const k = where.place_key_date_ayanamsa;
        const r = dayTables.find((x) => x.place_key === k.place_key && iso(x.date) === iso(k.date));
        if (r) Object.assign(r, update);
        else dayTables.push({ ...create, ayanamsa: 'LAHIRI' });
        return r ?? create;
      },
    },
    kundliDayOverlay: {
      findUnique: async ({ where }: any) => {
        const k = where.kundli_id_place_key_month;
        return overlays.find((o) => o.kundli_id === k.kundli_id && o.place_key === k.place_key && iso(o.month) === iso(k.month)) ?? null;
      },
      upsert: async ({ create }: any) => {
        overlays.push(create);
        return create;
      },
    },
    chartDataType: { findUnique: async () => ({ calc_version: '1' }) },
    agentRegistry: {
      upsert: async ({ where, create, update }: any) => {
        registry.set(where.id, { ...(registry.get(where.id) ?? create), ...update });
        return registry.get(where.id);
      },
    },
    agentRun: {
      create: async ({ data }: any) => {
        runs.push(data);
        return data;
      },
    },
    analyticsEvent: {
      createMany: async ({ data }: any) => {
        events.push(...data);
        return { count: data.length };
      },
    },
  };
  return { prisma: prisma as any, prefs, picks, dayTables, overlays, registry, runs, events };
}
