/**
 * Doc 70 Phase 1 step 2: check the engine's `pressure_inventory` rows for every clock of the reading clock set on one
 * test kundli. Free: engine calls and database reads only, no model, no cache endpoint.
 *
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/clock-rows-check.ts --size-only      (one read-only size query)
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/clock-rows-check.ts [--kundli <id>]  (the check)
 *
 * Writes: at most one `kundli_data` row per pulled clock (about 21 KB each), exactly as the sync worker would. The
 * sub-techniques run against a storage-dry client (technique_outputs, agent_runs and the like are swallowed), so the year
 * frame is built from the stored rows with no other write. The `kaala` row is read, never pulled.
 *
 * Prints one JSON document on stdout (per clock: status, rows by kind and level, payload bytes, the checks; the clock set;
 * the year frame's spans with each clock's tone and the agreement count).
 */
import 'dotenv/config';

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : undefined);
const PREFIX = arg('--kundli') ?? 'c584c0a3';
const AS_OF = new Date().toISOString().slice(0, 10);

const { PrismaClient } = await import('@prisma/client');
const raw = new PrismaClient();

if (argv.includes('--size-only')) {
  const r = await raw.$queryRaw<Array<Record<string, unknown>>>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS db,
           pg_database_size(current_database())::bigint::text AS db_bytes,
           pg_size_pretty(pg_total_relation_size('kundli_data')) AS kundli_data,
           (SELECT count(*) FROM kundli_data WHERE data_type = 'pressure_inventory')::int AS pressure_rows`;
  console.log(JSON.stringify(r[0]));
  await raw.$disconnect();
  process.exit(0);
}

const { loadPressureInventory, loadReadingClockSet, asPressurePayload, PRESSURE_TYPE, PRESSURE_AYANAMSA, pressureVariant } = await import('../src/reading/self/sub/pressure.js');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildYearFrameV3, loadStoredInventory, otherClocks, FRAME_MAX_OTHER_CLOCKS } = await import('../src/reading/self/v3/yearFrame.js');

// storage-dry client for the sub-techniques: every write except kundli_data is swallowed
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const swallowed: string[] = [];
function dry<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (typeof prop === 'string' && !prop.startsWith('$') && prop !== 'kundliData' && v && typeof v === 'object') {
        return new Proxy(v as object, {
          get(dt, op) {
            const f = Reflect.get(dt, op);
            if (typeof op === 'string' && WRITES.has(op)) return async () => (swallowed.push(`${prop}.${op}`), { count: 0 });
            return typeof f === 'function' ? f.bind(dt) : f;
          },
        });
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe' || prop === '$transaction') return async () => (swallowed.push(String(prop)), 0);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

type EngineRow = { id: string; kind: string; level?: number; system?: string; houses_touched?: number[]; polarity?: string; from: string; to: string };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const out: Record<string, unknown> = { asOf: AS_OF };
try {
  const ks = await raw.$queryRaw<Array<{ id: string; user_id: string }>>`SELECT id, user_id FROM kundlis WHERE id LIKE ${PREFIX + '%'} LIMIT 2`;
  if (ks.length !== 1) throw new Error(`kundli prefix ${PREFIX}: ${ks.length} matches`);
  const { id: kundliId, user_id: userId } = ks[0]!;
  out.kundli = kundliId;

  const set = await loadReadingClockSet(raw, kundliId);
  out.set = set;

  // the pulls, in parallel, as the sync worker makes them
  const t0 = performance.now();
  const loads = await Promise.all(set.pulled.map(async (system) => ({ system, load: await loadPressureInventory(raw, kundliId, system, AS_OF) })));
  out.pullMs = Math.round(performance.now() - t0);

  const clocks: Array<Record<string, unknown>> = [];
  for (const { system, load } of loads) {
    const row = await raw.kundliData.findUnique({
      where: { kundli_data_key: { kundli_id: kundliId, data_type: PRESSURE_TYPE, variant: pressureVariant(system), ayanamsa: PRESSURE_AYANAMSA } },
      select: { status: true, error: true, fetched_at: true, calc_version: true, payload: true },
    });
    const payload = row?.payload ? asPressurePayload(row.payload) : null;
    const rows = (payload?.rows ?? []) as EngineRow[];
    const byKind: Record<string, number> = {};
    for (const r of rows) {
      const k = `${r.kind}${r.level ? `.L${r.level}` : ''}`;
      byKind[k] = (byKind[k] ?? 0) + 1;
    }
    // (i) every annual row inside one Tithi Pravesha year (the level-1 annual rows are the years)
    const annual = rows.filter((r) => r.kind === 'annual');
    const years = annual.filter((r) => (r.level ?? 1) === 1);
    const yearLengths = years.map((y) => ({ id: y.id, from: y.from, to: y.to, days: daysBetween(y.from, y.to) }));
    const outside = annual.filter((r) => !years.some((y) => y.from <= r.from && r.to <= y.to)).map((r) => ({ id: r.id, level: r.level, from: r.from, to: r.to, days: daysBetween(r.from, r.to) }));
    const longYears = yearLengths.filter((y) => y.days > 400 || y.days < 330);
    // (ii) the clock's own dasha rows: houses and polarity
    const own = rows.filter((r) => r.kind === 'dasha' && (r.system ? r.system.replace(/^dasha\./, '') === system : true));
    const dashaChecks = {
      rows: own.length,
      withHouses: own.filter((r) => Array.isArray(r.houses_touched) && r.houses_touched.length > 0).length,
      withPolarity: own.filter((r) => ['presses', 'mixed', 'supports'].includes(String(r.polarity))).length,
      polarity: own.reduce<Record<string, number>>((m, r) => ((m[String(r.polarity)] = (m[String(r.polarity)] ?? 0) + 1), m), {}),
      levels: [...new Set(own.map((r) => r.level ?? 1))].sort(),
    };
    clocks.push({
      system,
      source: load.source,
      status: row?.status ?? 'none',
      error: row?.error ?? null,
      fetchedAt: row?.fetched_at ?? null,
      calcVersion: row?.calc_version ?? null,
      payloadBytes: row?.payload ? Buffer.byteLength(JSON.stringify(row.payload)) : 0,
      window: payload ? `${payload.from}..${payload.to}` : null,
      rows: rows.length,
      byKind,
      gaps: load.gaps,
      annual: { rows: annual.length, years: yearLengths, yearsOutOfRange: longYears, rowsOutsideAYear: outside.slice(0, 10), rowsOutsideCount: outside.length },
      dasha: dashaChecks,
    });
  }
  out.clocks = clocks;

  // (iii) the stored kaala row: read only
  const kaala = await raw.kundliData.findMany({
    where: { kundli_id: kundliId, data_type: PRESSURE_TYPE, variant: pressureVariant('kaala') },
    select: { status: true, error: true, fetch_started_at: true, fetched_at: true, params: true },
  });
  out.kaala = kaala;
  const all = await raw.kundliData.findMany({ where: { kundli_id: kundliId, data_type: PRESSURE_TYPE }, select: { variant: true, status: true, fetched_at: true } });
  out.storedPressureRows = all;

  // the year frame from the stored rows, code only
  const prisma = dry(raw);
  process.env.SELF_V2_PRESSURE_PULL = '0';
  const sub = await runSelfSubTechniques({ prisma }, { userId, kundliId, asOf: AS_OF });
  if ('status' in sub) throw new Error(`sub-techniques: ${sub.status}`);
  const ctx = sub.ctx;
  const clock = ctx.sub.clock!;
  out.spine = { build: clock.primary, set: set.spine };
  const others = otherClocks(clock, set).slice(0, FRAME_MAX_OTHER_CLOCKS);
  const inv = await Promise.all(others.map(async (system) => ({ system, inventory: await loadStoredInventory(raw, kundliId, system) })));
  const primary = sub.loaded.pressure ?? (await loadStoredInventory(raw, kundliId, clock.primary));
  const frame = buildYearFrameV3({ asOf: AS_OF, clock, primary, others: inv, year: ctx.sub.year ?? null });
  out.year = ctx.sub.year ? { from: ctx.sub.year.from, to: ctx.sub.year.to, noCoverage: ctx.sub.year.noCoverage } : null;
  out.frame = {
    clock: frame.clock,
    clocksRead: frame.clocksRead,
    clocksSkipped: frame.clocksSkipped,
    degraded: frame.degraded,
    spans: frame.spans.map((s) => ({ id: s.id, from: s.from, to: s.to, place: s.place, tone: s.tone, agree: s.agree, of: s.of, clocks: s.clocks.map((c) => `${c.system}=${c.tone}`) })),
  };
  out.subGaps = sub.gaps;
  out.swallowedWrites = swallowed.length;
} catch (e) {
  out.error = String((e as Error)?.stack ?? e).slice(0, 2000);
} finally {
  await raw.$disconnect();
}
console.log(JSON.stringify(out, null, 1));
