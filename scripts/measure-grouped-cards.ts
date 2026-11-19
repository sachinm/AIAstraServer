/**
 * Doc 86 (docs/reading-engine/86-grouped-card-reads.md): ONE grouped read of a person's board cards on one cached pack,
 * measured. PAID with `--yes-spend`: the card group calls go to the live Gemini key. Without it (`--dry`) nothing is
 * called and nothing is written: it prints the pack sizes (the pack before and after doc 86 dedupe) and the group plan.
 *
 *   npx tsx scripts/measure-grouped-cards.ts --dry   [--kundli <id>]        (pack sizes and the group plan only)
 *   npx tsx scripts/measure-grouped-cards.ts --rehearse [--kundli <id>]    (the whole run on a fake model, no writes)
 *   npx tsx scripts/measure-grouped-cards.ts --yes-spend [--kundli <id>]     (Sachin's yes: one run, 2026-11-18)
 *
 * What the live run does, once, from STORED rows only (no engine pull, no reader, no concordance call):
 *   1  the v2 sub-techniques and the natal prefix (code, no model);
 *   2  `runSelfV3Cards` as a board build does: the frame from the stored clock inventories, the slices as stored, the
 *      clock layer from its stored `layer.clock` row (a key miss falls back to the stored row as is), the board as stored;
 *   3  `readCards` once with the group pack on (force: the stored readings are read again), every call timed;
 *   4  after the build returns: checks that every explicit cache the build made (the pack and the clock prefix) was
 *      deleted at Gemini (GET answers 403/404) and marked deleted in `llm_cache_entries`.
 * Guard: only `self.card.group.*` calls are let through; the run stops at READING_SPEND_CAP_USD (set to 0.45 here).
 * Writes: the card readings (`technique_outputs`, technique `self.card.reading`), the cards state doc (`area_builds`),
 * `agent_runs` and `llm_cache_entries`, as a refresh writes them. Every other write is swallowed and counted.
 * Output: docs/reading-engine/replays/86-grouped-<date>/summary.json (no keys, no birth data, no card text).
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : undefined);
const YES = argv.includes('--yes-spend');
/** --rehearse: the whole run with a fake model (empty card documents) and a fake cache; no spend, no write */
const REHEARSE = argv.includes('--rehearse') && !YES;
const DRY = !YES;
const KUNDLI = arg('--kundli') ?? 'c584c0a3-841b-451b-a2ed-f5709c5fb31d';
const CAP_USD = 0.45;

process.env.READING_SPEND_CAP_USD = String(CAP_USD);
process.env.SELF_V2_PRESSURE_PULL = '0';
process.env.SELF_V3_BUILD = '1';
process.env.READING_CLOCK_LAYER = '1';
process.env.CARDS_READ_REST = '0';
process.env.CARDS_GROUP_PACK = '1';
process.env.READING_EXPLICIT_CACHE = DRY ? '0' : '1';

const key = process.env.GEMINI_API_KEY?.trim() ?? '';
if (!DRY && !key) {
  console.error('measure-grouped-cards: GEMINI_API_KEY is unset');
  process.exit(1);
}

const { prisma: db } = await import('../src/lib/prisma.js');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildAreaBriefs } = await import('../src/reading/self/areas/index.js');
const { buildFamilySlices, buildOracleSlice } = await import('../src/reading/self/v2/slices.js');
const { runSelfV3Cards } = await import('../src/reading/self/v3/build.js');
const { loadStoredInventory, renderYearFrame } = await import('../src/reading/self/v3/yearFrame.js');
const { readCards } = await import('../src/reading/cards/run.js');
const { buildCardPack, planGroups } = await import('../src/reading/cards/group.js');
const { runClockLayer } = await import('../src/reading/clocks/run.js');
const { readLayerCache, LAYER_CACHE_SLICE_ID } = await import('../src/reading/clocks/layerCache.js');
const { callGemini: realCallGemini } = await import('../src/reading/llm/gemini.js');
const { usageCostUsd, priceFor } = await import('../src/reading/llm/models.js');
const { ensurePromptCache, setCacheCreatedHook, cachedContentsUrl } = await import('../src/reading/llm/promptCache.js');
const { getCardsGroupOutputBudget, getCardsCardOutputTokens, getCardsGroupSizeBoard } = await import('../src/config/env.js');
const { clockLabel } = await import('../src/reading/self/words.js');
const { seedAgentRegistry } = await import('../src/agents/registry.js');
type GeminiCallOptions = import('../src/reading/llm/gemini.js').GeminiCallOptions;
type CardsRunInput = import('../src/reading/cards/run.js').CardsRunInput;
type CardsRunResult = import('../src/reading/cards/run.js').CardsRunResult;
type LayerCacheEntry = import('../src/reading/clocks/layerCache.js').LayerCacheEntry;

const AS_OF = new Date().toISOString().slice(0, 10);
const OUT_DIR = `docs/reading-engine/replays/86-grouped-${AS_OF}`;
const MODEL = process.env.READING_MODEL_ORACLE?.trim() || 'gemini-3.8-flash';

// ------------------------------------------------------------------ storage: only what a refresh writes for the cards
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const CARD_TECHNIQUE = 'self.card.reading';
const swallowed: string[] = [];
const allowedWrites: string[] = [];
const allowWrite = (model: string, args: unknown): boolean => {
  if (DRY) return false;
  if (model === 'agentRun' || model === 'llmCacheEntry' || model === 'areaBuild') return true;
  if (model === 'techniqueOutput') {
    const a = args as { create?: { technique_id?: string }; data?: { technique_id?: string }; where?: { cache_key?: string } } | undefined;
    const t = a?.create?.technique_id ?? a?.data?.technique_id;
    return t === CARD_TECHNIQUE;
  }
  return false;
};
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
              return async (args: unknown) => {
                if (allowWrite(prop, args)) {
                  allowedWrites.push(`${prop}.${op}`);
                  return (f as (a: unknown) => unknown).call(dt, args);
                }
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

// ------------------------------------------------------------------ calls: only the card groups, timed and priced
interface CallRow { node: string; cards: string[]; startMs: number; endMs: number; ms: number; ttftMs: number | null; promptTokens: number; cachedTokens: number; outputTokens: number; thoughtTokens: number; costUsd: number; finish: string | null; maxOutputTokens: number | null; cachedContent: boolean }
const calls: CallRow[] = [];
const refused: string[] = [];
const t0 = performance.now();
const at = () => Math.round(performance.now() - t0);
const spent = () => Math.round(calls.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6;
async function guardedCall(o: GeminiCallOptions) {
  if (REHEARSE && o.node.startsWith('self.card.group')) {
    const s = at();
    await new Promise((r) => setTimeout(r, 50));
    const cards = [...(o.fullCache?.suffix[0] ?? '').matchAll(/^- (\w+): board /gm)].map((m) => m[1]!);
    calls.push({ node: o.node, cards, startMs: s, endMs: at(), ms: at() - s, ttftMs: null, promptTokens: 0, cachedTokens: 0, outputTokens: 0, thoughtTokens: 0, costUsd: 0, finish: 'STOP', maxOutputTokens: o.maxOutputTokens ?? null, cachedContent: false });
    return { text: '{"cards":[]}', usage: { node: o.node, model: o.model, promptTokens: 0, cachedTokens: 0, outputTokens: 0, thoughtTokens: 0, ms: 50 }, finishReason: 'STOP', ttftMs: 50, stoppedForLoop: false } as Awaited<ReturnType<typeof realCallGemini>>;
  }
  // the group calls must read the cached pack: uncached they resend the whole pack per call at ten times the rate
  if (!DRY && o.node.startsWith('self.card.group') && !ensures.some((e) => e.name && e.base === o.fullCache?.prefix.length)) {
    refused.push(`${o.node} (no pack cache)`);
    throw new Error('measure guard: the pack is not cached; refusing an uncached group call');
  }
  if (DRY || !o.node.startsWith('self.card.group')) {
    refused.push(o.node);
    throw new Error(`measure guard: ${o.node} is not part of this test`);
  }
  if (spent() >= CAP_USD) throw new Error(`measure guard: spend ${spent()} reached the cap ${CAP_USD}`);
  const s = at();
  const r = await realCallGemini(o);
  const u = { model: o.model, promptTokens: r.usage?.promptTokens ?? 0, cachedTokens: r.usage?.cachedTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0, thoughtTokens: r.usage?.thoughtTokens ?? 0 };
  const cards = [...(o.fullCache?.suffix[0] ?? '').matchAll(/^- (\w+): board /gm)].map((m) => m[1]!);
  calls.push({ node: o.node, cards, startMs: s, endMs: at(), ms: at() - s, ttftMs: r.ttftMs ?? null, ...u, costUsd: usageCostUsd(u), finish: r.finishReason, maxOutputTokens: o.maxOutputTokens ?? null, cachedContent: (r.usage?.cachedTokens ?? 0) > 0 });
  return r;
}

// ------------------------------------------------------------------ cache creates (time and tokens)
const creates: Array<{ name: string; key: string; ms: number; tokens: number | null; at: number }> = [];
setCacheCreatedHook((c) => creates.push({ ...c, at: at() }));
const ensures: Array<{ base: number; ms: number; name: string | null }> = [];
const timedEnsure: typeof ensurePromptCache = async (model, system, base, owner) => {
  const s = performance.now();
  const name = await ensurePromptCache(model, system, base, owner);
  ensures.push({ base: base.length, ms: Math.round(performance.now() - s), name });
  return name;
};

const est = (s: string) => Math.ceil(s.length / 2.2);
const prisma = guarded(db);
const raw = db;
mkdirSync(OUT_DIR, { recursive: true });
const summary: Record<string, unknown> = { kundli: KUNDLI, asOf: AS_OF, model: MODEL, mode: REHEARSE ? 'rehearse' : DRY ? 'dry' : 'live', capUsd: CAP_USD };
let captured: CardsRunInput | null = null;
let run: CardsRunResult | null = null;
let layerFallback = false;
let readCardsMs: number | null = null;
let readCardsStartMs: number | null = null;
try {
  const k = await raw.kundli.findUnique({ where: { id: KUNDLI }, select: { user_id: true } });
  if (!k) throw new Error(`kundli ${KUNDLI} not found`);
  const userId = k.user_id;
  if (!DRY) summary.agentRegistrySeeded = await seedAgentRegistry(raw);
  const sub = await runSelfSubTechniques({ prisma }, { userId, kundliId: KUNDLI, asOf: AS_OF });
  if ('status' in sub) throw new Error(`sub-techniques: ${sub.status}`);
  const ctx = sub.ctx;
  const fam = buildFamilySlices(ctx, sub.loaded);
  const oracleSlice = buildOracleSlice(ctx, fam.packs, buildAreaBriefs(ctx)).slice;
  const tBuild = at();
  const r = await runSelfV3Cards(
    {
      prisma,
      callGemini: guardedCall,
      ensureCache: timedEnsure,
      maxSpendUsd: CAP_USD,
      cardsCapUsd: CAP_USD,
      now: new Date(),
      cardsRead: true,
      cardsReadRest: false,
      loadInventory: (p, kid, system) => loadStoredInventory(p, kid, system),
      runClockLayer: (d, i) =>
        runClockLayer(
          {
            ...d,
            // the stored layer row: by its key, else as stored (the prefix may have moved since the morning build)
            readCache: async (p, kid, kk) => {
              const hit = await readLayerCache(p, kid, kk);
              if (hit) return hit;
              const row = await raw.kundliSlice.findFirst({ where: { kundli_id: kid, slice_id: LAYER_CACHE_SLICE_ID } });
              if (!row) return null;
              layerFallback = true;
              const e = JSON.parse(String(row.text)) as LayerCacheEntry;
              return e?.ledger ? e : null;
            },
          },
          i,
        ),
      readCards: async (d, i) => {
        captured = i;
        if (DRY && !REHEARSE) return { results: [], cards: {}, timings: [], issues: [], spentUsd: 0, capReached: false, order: [] };
        const s = at();
        run = await readCards({ ...d, force: true, groupPack: true, callGemini: guardedCall, ensureCache: REHEARSE ? async () => 'cachedContents/rehearsal' : timedEnsure }, i);
        readCardsMs = at() - s;
        readCardsStartMs = s;
        return run;
      },
    },
    { ctx, pressure: sub.loaded.pressure ?? null, oracleSlice, portrait: null, buildId: `measure-86-${AS_OF}` },
  );
  const tDone = at();
  summary.build = { status: r.status, gaps: r.gaps, clockLayer: r.clockLayer, layerFallback, ms: r.ms, buildMs: tDone - tBuild };
  const ci = captured as CardsRunInput | null;
  if (ci) {
    const fr = renderYearFrame(ci.frame, clockLabel(ci.frame.clock));
    const cards = [...new Set([...ci.board, ...(ci.packCards ?? [])])];
    const pack = buildCardPack({ ctx, cards, frame: ci.frame, frameText: fr.text, frameKeys: fr.keys, prefix: ci.prefix, ledger: ci.ledger, slices: ci.slices, portrait: ci.portrait, answers: ci.answers });
    const legacy = buildCardPack({ ctx, cards, frame: ci.frame, frameText: fr.text, frameKeys: fr.keys, prefix: ci.prefix, ledger: ci.ledger, slices: ci.slices, portrait: ci.portrait, answers: ci.answers }, { cells: 'per-card' });
    const reordered = buildCardPack({ ctx, cards: [...cards].reverse(), frame: ci.frame, frameText: fr.text, frameKeys: fr.keys, prefix: ci.prefix, ledger: ci.ledger, slices: ci.slices, portrait: ci.portrait, answers: ci.answers });
    const again = buildCardPack({ ctx, cards, frame: ci.frame, frameText: fr.text, frameKeys: fr.keys, prefix: ci.prefix, ledger: ci.ledger, slices: ci.slices, portrait: ci.portrait, answers: ci.answers });
    if (process.env.MEASURE_DUMP_DIR) {
      writeFileSync(`${process.env.MEASURE_DUMP_DIR}/pack.after.txt`, `${pack.system}\n\n${pack.text}`);
      writeFileSync(`${process.env.MEASURE_DUMP_DIR}/pack.before.txt`, `${legacy.system}\n\n${legacy.text}`);
    }
    const lines = (t: string) => t.split('\n').filter((x) => x.trim().length > 20);
    const dupes = (t: string) => {
      const ls = lines(t);
      return ls.length - new Set(ls).size;
    };
    summary.pack = {
      cards: cards.length,
      board: ci.board,
      ledgerCells: ci.ledger?.cells.length ?? 0,
      before: { chars: legacy.system.length + legacy.text.length, estTokens: est(legacy.system + legacy.text), duplicateLines: dupes(legacy.text) },
      after: { chars: pack.system.length + pack.text.length, estTokens: est(pack.system + pack.text), duplicateLines: dupes(pack.text), hash: pack.hash },
      byteStable: again.hash === pack.hash && again.text === pack.text,
      reorderStable: reordered.hash === pack.hash,
      prefixChars: ci.prefix.text.length,
      plan: planGroups(ci.board, { budget: getCardsGroupOutputBudget(), perCard: () => getCardsCardOutputTokens(), maxSize: getCardsGroupSizeBoard() }),
    };
  }
  if (run) {
    const rr = run as CardsRunResult;
    summary.cards = rr.results.map((x) => ({ card: x.card, status: x.status, costUsd: x.costUsd, issues: x.issues.map((v) => ({ stage: v.stage, check: v.check, message: v.message.slice(0, 240) })) }));
    summary.cardsRun = { spentUsd: rr.spentUsd, capReached: rr.capReached, read: Object.keys(rr.cards).length, wanted: rr.results.length };
  }
  // the caches this run made: are they gone, at Gemini and in the registry?
  if (!DRY) {
    const names = [...new Set([...creates.map((c) => c.name), ...ensures.map((e) => e.name).filter((x): x is string => Boolean(x))])];
    const check = [] as Array<{ name: string; httpStatus: number; registryDeletedAt: string | null; deleteError: string | null }>;
    for (const name of names) {
      const res = await fetch(`${cachedContentsUrl().replace(/\/cachedContents$/, '')}/${name}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
      const row = await (raw as unknown as { llmCacheEntry: { findUnique: (q: unknown) => Promise<{ deleted_at: Date | null; delete_error: string | null } | null> } }).llmCacheEntry.findUnique({ where: { name } }).catch(() => null);
      check.push({ name: name.replace(/^cachedContents\//, '…').slice(0, 14), httpStatus: res?.status ?? -1, registryDeletedAt: row?.deleted_at?.toISOString() ?? null, deleteError: row?.delete_error ?? null });
    }
    summary.cacheCheckAtMs = at();
    summary.buildEndMs = tDone;
    summary.caches = check;
    summary.cachesDeleted = check.length > 0 && check.every((c) => c.httpStatus === 403 || c.httpStatus === 404);
  }
} finally {
  const p = priceFor(MODEL);
  const packTokens = creates.map((c) => c.tokens ?? 0);
  const first = calls.length ? Math.min(...calls.map((c) => c.startMs)) : 0;
  const last = calls.length ? Math.max(...calls.map((c) => c.endMs)) : 0;
  Object.assign(summary, {
    creates,
    ensures,
    calls,
    refused,
    callsUsd: spent(),
    // the card phase: readCards start to return (pack build, cache create, every group and repair, the stores)
    readCardsMs,
    readCardsStartMs,
    callsSpanMs: last - first,
    // the create charge is not stated by Google; at worst the input rate on the pack's tokens
    createWorstUsd: p ? Math.round(packTokens.reduce((n, t) => n + t, 0) * p.in) / 1e6 : null,
    // storage priced from the list price ($/1M tokens/hour) over each cache's measured life (create → build end)
    price: p ? { in: p.in, out: p.out, cached: p.cached, storagePerHour: 0.5 } : null,
    packTokens,
    swallowedWrites: swallowed.length,
    swallowedByTable: Object.fromEntries([...new Set(swallowed)].map((s) => [s, swallowed.filter((x) => x === s).length])),
    allowedWrites: Object.fromEntries([...new Set(allowedWrites)].map((s) => [s, allowedWrites.filter((x) => x === s).length])),
  });
  writeFileSync(`${OUT_DIR}/summary${REHEARSE ? '.rehearse' : DRY ? '.dry' : ''}.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ mode: summary.mode, pack: summary.pack ?? null, build: summary.build ?? null, callsUsd: spent(), calls: calls.length, refused: refused.length, cachesDeleted: summary.cachesDeleted ?? null }, null, 1));
  await raw.$disconnect();
}
