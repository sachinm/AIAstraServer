/**
 * docs/dashboards/14: measures the grouped card pack with the Love and Work boards' techniques, with NO model call and
 * NO write. It builds the run's inputs from stored rows exactly as `measure-grouped-cards.ts --dry` does (every write
 * swallowed, every model call refused), then builds three packs:
 *   (a) the Self board only            (must equal the pack before doc 14, text byte for byte)
 *   (b) the Self board + the Dating cards this person is shown
 *   (c) the Self board + the Your-job (primary_job) cards this person is shown
 * and checks the data the technique layers need (points, vargas, sahams, activation, sky, the stored Work map).
 *
 *   npx tsx scripts/measure-card-techniques.ts [--kundli <id>] [--dump <dir>] [--baseline-sha <sha256 prefix>]
 *
 * Sizes: characters of system + text, and an estimate of tokens at 2.2 characters a token (the doc 86 estimator).
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : undefined);
const KUNDLI = arg('--kundli') ?? 'c584c0a3-841b-451b-a2ed-f5709c5fb31d';
const DUMP = arg('--dump');
const BASE = arg('--baseline-sha');

process.env.SELF_V2_PRESSURE_PULL = '0';
process.env.SELF_V3_BUILD = '1';
process.env.READING_CLOCK_LAYER = '1';
process.env.CARDS_READ_REST = '0';
process.env.CARDS_GROUP_PACK = '1';
process.env.READING_EXPLICIT_CACHE = '0';

const { prisma: db } = await import('../src/lib/prisma.js');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildAreaBriefs } = await import('../src/reading/self/areas/index.js');
const { buildFamilySlices, buildOracleSlice } = await import('../src/reading/self/v2/slices.js');
const { runSelfV3Cards } = await import('../src/reading/self/v3/build.js');
const { loadStoredInventory, renderYearFrame } = await import('../src/reading/self/v3/yearFrame.js');
const { buildCardPack } = await import('../src/reading/cards/group.js');
const { loadBoardTechniques } = await import('../src/reading/cards/techniques.js');
const { runClockLayer } = await import('../src/reading/clocks/run.js');
const { readLayerCache, LAYER_CACHE_SLICE_ID } = await import('../src/reading/clocks/layerCache.js');
const { clockLabel } = await import('../src/reading/self/words.js');
const { boardFactsOf, LOVE_V3_CARDS, WORK_V3_CARDS, showsFor } = await import('../src/reading/boards/v3Cards.js');
const { loadDigest } = await import('../src/reading/digest/load.js');
const { activationFor } = await import('../src/reading/digest/activation.js');
const { defaultLoadTransit, activationSpan } = await import('../src/reading/area/boardService.js');
const { frameRange } = await import('../src/reading/slices/trim.js');
const { currentYear } = await import('../src/reading/area/houseLayers.js');
type CardsRunInput = import('../src/reading/cards/run.js').CardsRunInput;
type LayerCacheEntry = import('../src/reading/clocks/layerCache.js').LayerCacheEntry;

const AS_OF = new Date().toISOString().slice(0, 10);
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const swallowed: string[] = [];
function guarded<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') return async () => (swallowed.push(String(prop)), 0);
      if (typeof prop === 'string' && !prop.startsWith('$') && v && typeof v === 'object') {
        return new Proxy(v as object, {
          get(dt, op) {
            const f = Reflect.get(dt, op);
            if (typeof op === 'string' && WRITES.has(op) && typeof f === 'function') {
              return async () => {
                swallowed.push(`${prop}.${op}`);
                return op === 'create' || op === 'upsert' || op === 'update' ? {} : { count: 0 };
              };
            }
            return typeof f === 'function' ? f.bind(dt) : f;
          },
        });
      }
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}
const refused: string[] = [];
const noModel = async (o: { node: string }) => {
  refused.push(o.node);
  throw new Error(`measure: no model call (${o.node})`);
};
const est = (s: string) => Math.ceil(s.length / 2.2);
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const prisma = guarded(db);
const raw = db;

try {
  const k = await raw.kundli.findUnique({ where: { id: KUNDLI }, select: { user_id: true } });
  if (!k) throw new Error(`kundli ${KUNDLI} not found`);
  const sub = await runSelfSubTechniques({ prisma }, { userId: k.user_id, kundliId: KUNDLI, asOf: AS_OF });
  if ('status' in sub) throw new Error(`sub-techniques: ${sub.status}`);
  const ctx = sub.ctx;
  const fam = buildFamilySlices(ctx, sub.loaded);
  const oracleSlice = buildOracleSlice(ctx, fam.packs, buildAreaBriefs(ctx)).slice;
  let captured: CardsRunInput | null = null;
  await runSelfV3Cards(
    {
      prisma,
      callGemini: noModel as never,
      maxSpendUsd: 0,
      cardsCapUsd: 0,
      now: new Date(),
      cardsRead: true,
      cardsReadRest: false,
      loadInventory: (p, kid, system) => loadStoredInventory(p, kid, system),
      runClockLayer: (d, i) =>
        runClockLayer(
          {
            ...d,
            readCache: async (p, kid, kk) => {
              const hit = await readLayerCache(p, kid, kk);
              if (hit) return hit;
              const row = await raw.kundliSlice.findFirst({ where: { kundli_id: kid, slice_id: LAYER_CACHE_SLICE_ID } });
              if (!row) return null;
              const e = JSON.parse(String(row.text)) as LayerCacheEntry;
              return e?.ledger ? e : null;
            },
          },
          i,
        ),
      readCards: async (_d, i) => {
        captured = i;
        return { results: [], cards: {}, timings: [], issues: [], spentUsd: 0, capReached: false, order: [] };
      },
    },
    { ctx, pressure: sub.loaded.pressure ?? null, oracleSlice, portrait: null, buildId: `measure-14-${AS_OF}` },
  );
  const ci = captured as CardsRunInput | null;
  if (!ci) throw new Error('the run reached no card read (no ledger?)');
  const profile = ctx.sub.profile!;
  const facts = boardFactsOf(profile as never);
  const age = profile.ageYears ?? null;
  const dating = LOVE_V3_CARDS.filter((c) => c.lens === 'dating' && c.offered && showsFor(c, facts, age)).map((c) => c.id);
  const job = WORK_V3_CARDS.filter((c) => c.lens === 'primary_job' && c.offered && showsFor(c, facts, age)).map((c) => c.id);
  // every offered Your-job card, whatever the person's facts (the person's own set can be smaller)
  const jobAll = WORK_V3_CARDS.filter((c) => c.lens === 'primary_job' && c.offered).map((c) => c.id);
  const range = frameRange(ci.frame);
  const t0 = performance.now();
  const techniques = await loadBoardTechniques({ prisma: raw }, { kundliId: KUNDLI, asOf: AS_OF, boards: ['love', 'work'], ageYears: age, range, systems: ci.frame.clocksRead });
  const loadMs = Math.round(performance.now() - t0);
  const fr = renderYearFrame(ci.frame, clockLabel(ci.frame.clock));
  const pack = (cards: readonly string[]) => buildCardPack({ ctx, cards: cards as never, frame: ci.frame, frameText: fr.text, frameKeys: fr.keys, prefix: ci.prefix, ledger: ci.ledger, slices: ci.slices, portrait: ci.portrait, answers: ci.answers, techniques });
  const board = [...ci.board];
  const runs = { a_self: board, b_self_dating: [...board, ...dating], c_self_job: [...board, ...job], d_self_job_all: [...board, ...jobAll] } as const;
  const sizes: Record<string, unknown> = {};
  for (const [name, cards] of Object.entries(runs)) {
    const p = pack(cards);
    const again = pack([...cards].reverse());
    sizes[name] = { cards: cards.length, systemChars: p.system.length, textChars: p.text.length, chars: p.system.length + p.text.length, estTokens: est(p.system + p.text), textSha: sha(p.text), reorderStable: again.text === p.text };
    if (DUMP) writeFileSync(`${DUMP}/pack.${name}.txt`, `${p.system}\n\n${p.text}`);
  }
  const selfOnly = pack(board);
  const noTech = buildCardPack({ ctx, cards: board as never, frame: ci.frame, frameText: fr.text, frameKeys: fr.keys, prefix: ci.prefix, ledger: ci.ledger, slices: ci.slices, portrait: ci.portrait, answers: ci.answers });

  // the data the layers need, as stored
  const view = await loadDigest(raw, KUNDLI);
  const pts = view?.points() ?? [];
  const want = ['UL', 'A7', 'A5', 'DK', 'AL', 'A10', 'AmK'];
  const year = view ? currentYear(view, AS_OF) : null;
  const span = activationSpan(AS_OF);
  const [actLove, running, transit] = await Promise.all([
    activationFor(raw, KUNDLI, { ...span, houses: [7, 5, 11, 2, 4, 8, 12], maxLevel: 2 }),
    activationFor(raw, KUNDLI, { from: AS_OF, to: AS_OF, maxLevel: 3 }),
    defaultLoadTransit(raw, KUNDLI, AS_OF),
  ]);
  const data = {
    digest: view ? { version: view.version, status: view.status, vargas: view.vargas() } : null,
    points: Object.fromEntries(want.map((id) => [id, pts.filter((p) => p.id === id).map((p) => `${p.varga}:${p.sign ?? '?'}/h${p.house ?? '?'}${p.planet ? `/${p.planet}` : ''}`)])),
    vargaPlanets: Object.fromEntries(['D7', 'D9', 'D10', 'D60'].map((v) => [v, view?.planets(v).length ?? 0])),
    vargaHouses: Object.fromEntries(['D7', 'D9', 'D10', 'D60'].map((v) => [v, view?.houses(v).length ?? 0])),
    year: year ? { kind: year.kind, year: year.year, varga: year.varga, sahams: year.sahams.map((s) => `${s.name}:h${s.house ?? '?'}`) } : null,
    activation: { love: actLove.length, running: running.length, systems: [...new Set(actLove.map((r) => r.system))] },
    transit: transit ? { ingresses: transit.ingresses.length, from: transit.from, to: transit.to } : null,
    careerMapRow: Boolean(techniques.work?.rows.some((r) => r.layer === 'map' && !r.line.startsWith('no stored'))),
  };
  const sections = Object.fromEntries(Object.entries(techniques).map(([b, s]) => [b, { rows: s!.rows.length, chars: s!.text.length, estTokens: est(s!.text), byLayer: Object.fromEntries([...new Set(s!.rows.map((r) => r.layer))].map((l) => [l, s!.rows.filter((r) => r.layer === l).length])) }]));
  const engineWord = /radha|pyjhora/i;
  console.log(
    JSON.stringify(
      {
        kundli: KUNDLI.slice(0, 8),
        asOf: AS_OF,
        board,
        dating,
        job,
        jobAll,
        loadMs,
        sections,
        sizes,
        selfOnlyUnchanged: { textEqualsNoTechniques: selfOnly.text === noTech.text, textSha: sha(selfOnly.text), baselineSha: BASE ?? null, matchesBaseline: BASE ? sha(selfOnly.text) === BASE : null },
        engineNameInSections: Object.values(techniques).some((s) => engineWord.test(s!.text)),
        data,
        refusedModelCalls: refused.length,
        swallowedWrites: swallowed.length,
      },
      null,
      1,
    ),
  );
  if (DUMP) for (const [b, s] of Object.entries(techniques)) writeFileSync(`${DUMP}/techniques.${b}.txt`, s!.text);
} finally {
  await raw.$disconnect();
}
