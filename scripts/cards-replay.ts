/**
 * Doc 70 §8, the Phase 3 test: a reading per card on one test kundli, storage-dry, under a spend cap. PAID: every model
 * call goes to the live key. It refuses to run without `--yes-spend`, and before anything else it prints the key's last
 * four characters, the model, the planned call count and the cost estimate. Run it only after Sachin's yes on key,
 * count and cost (doc 70 §10 item 4).
 *
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/cards-replay.ts                    (prints the estimate, exits 1)
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/cards-replay.ts --yes-spend [--seed 42] [--kundli <id>] [--cap 0.75] [--warm]
 *
 * What it does, once: the v2 sub-techniques and the natal prefix (no model); then `runSelfV3Cards` with the per-card
 * reading on: the slices, five clock readers and the concordance (the ledger), then one Oracle and one Personalizer call
 * per card: the board first (one card drawn at random from each Self group, topped up at random to five, the seed
 * printed), then every other offered card (CARDS_READ_REST on). It records the time to the first card and to the whole
 * board, and checks. With --warm, a second pass then opens the board again on the clock layer cached by the first pass
 * (an in-memory stand-in for the `kundli_slices` row, since this run stores nothing): no reader and no concordance
 * call, the five board cards read again, and the time to its first card and its board is recorded. Checks: every offered card stored, every card has text for every span, every span cites a confirmed or
 * leaning ledger cell or is not a build, no chart term and no engine name on a face. Writes go nowhere
 * (technique_outputs, area_builds, kundli_slices, reading_validation_failures and raw writes are swallowed and counted);
 * `agent_runs` rows are written as on any build, and the agent registry is seeded first (an idempotent upsert of the
 * agent definitions into `agent_registry`, as every server process does). The explicit-cache regions are deleted at the end.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : undefined);
const YES = argv.includes('--yes-spend');
const WARM = argv.includes('--warm');
/** doc 71: the cards in groups on one cached pack (board in threes first, the rest in sixes after) */
const GROUP = argv.includes('--group');
const KUNDLI = arg('--kundli') ?? 'c584c0a3-841b-451b-a2ed-f5709c5fb31d';
const SEED = Number(arg('--seed') ?? Date.now() % 1_000_000);
const CAP_USD = Number(arg('--cap') ?? 0.75);
const MODEL = process.env.READING_MODEL_ORACLE?.trim() || 'gemini-3.8-flash';

// ------------------------------------------------------------------ the estimate, printed before anything runs
const CARDS = 21;
const READERS = 5;
const BOARD_CARDS = 5;
// readers + concordance + (Oracle + Personalizer) per card; with --warm the board again (no reader, no concordance)
const PLANNED_CALLS = GROUP ? READERS + 1 + BOARD_CARDS + Math.ceil((CARDS - BOARD_CARDS) / 6) : READERS + 1 + CARDS * 2 + (WARM ? BOARD_CARDS * 2 : 0);
const MAX_CALLS = PLANNED_CALLS + 8; // room for a repair on a few cards
// 2026-11-10 replay fixes (docs/reading-engine/70-phase3-replay-2026-11-10.md "Fixes made"): readers about $0.10-0.116,
// the trimmed concordance about $0.015, a card about $0.017-0.020 (Oracle + Personalizer), a repair about $0.015
// doc 71 Phase 0: a group call on the cached pack about $0.006 to read plus about $0.0045 a card to write; the pack's
// creation, if Google bills it at the input rate, about $0.06 (not seen by this script's call ledger)
const EST_USD = GROUP ? 0.116 + 0.015 + 5 * 0.006 + CARDS * 0.0045 + 0.06 + 0.02 : 0.116 + 0.015 + CARDS * 0.02 + 0.015 + (WARM ? BOARD_CARDS * 0.02 : 0);
const key = process.env.GEMINI_API_KEY?.trim() ?? '';
console.log(
  JSON.stringify(
    {
      test: 'doc 70 Phase 3 (cards replay)',
      keyTail: key ? key.slice(-4) : '(GEMINI_API_KEY unset)',
      model: MODEL,
      kundli: KUNDLI,
      seed: SEED,
      plannedCalls: PLANNED_CALLS,
      maxCalls: MAX_CALLS,
      estimateUsd: Math.round(EST_USD * 100) / 100,
      warmPass: WARM,
      capUsd: CAP_USD,
    },
    null,
    1,
  ),
);
if (!YES) {
  console.error('cards-replay: refused. This test spends money on the key above. Re-run with --yes-spend only after Sachin said yes to the key, the call count and the cost.');
  process.exit(1);
}
if (!key) {
  console.error('cards-replay: GEMINI_API_KEY is unset');
  process.exit(1);
}
if (!(CAP_USD > 0 && CAP_USD <= 2)) {
  console.error('cards-replay: --cap must be above 0 and at most 2 USD');
  process.exit(1);
}

process.env.SELF_V2_PRESSURE_PULL = '0';
process.env.SELF_V3_BUILD = '1';
process.env.READING_CLOCK_LAYER = '1';
process.env.CARDS_READ_REST = '1';
if (GROUP) {
  process.env.CARDS_GROUP_PACK = '1';
  process.env.READING_EXPLICIT_CACHE = '1';
}

const { PrismaClient } = await import('@prisma/client');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildAreaBriefs } = await import('../src/reading/self/areas/index.js');
const { buildFamilySlices, buildOracleSlice } = await import('../src/reading/self/v2/slices.js');
const { runSelfV3Cards } = await import('../src/reading/self/v3/build.js');
const { readCards } = await import('../src/reading/cards/run.js');
const { runClockLayer } = await import('../src/reading/clocks/run.js');
const { SELF_CARD_GROUPS } = await import('../src/reading/self/v3/types.js');
const { READABLE_CARDS, cardDef } = await import('../src/reading/self/v3/cards.js');
const { callGemini: realCallGemini } = await import('../src/reading/llm/gemini.js');
const { usageCostUsd } = await import('../src/reading/llm/models.js');
const { deleteIndividualCaches, explicitCacheEnabled } = await import('../src/reading/llm/promptCache.js');
const { PROMPT_VERSION } = await import('../src/reading/prompts/generated.js');
const { seedAgentRegistry } = await import('../src/agents/registry.js');
type GeminiCallOptions = import('../src/reading/llm/gemini.js').GeminiCallOptions;
type SelfCardId = import('../src/reading/self/v3/types.js').SelfCardId;
type CardsRunResult = import('../src/reading/cards/run.js').CardsRunResult;
type LayerCacheEntry = import('../src/reading/clocks/layerCache.js').LayerCacheEntry;
type ClockLayerDeps = import('../src/reading/clocks/run.js').ClockLayerDeps;
type ClockLayerInput = import('../src/reading/clocks/run.js').ClockLayerInput;

// the clock layer cache in memory (the run stores nothing; kundli_slices writes are swallowed)
const layerMem = new Map<string, LayerCacheEntry>();
const layerWithMemory = (d: ClockLayerDeps, i: ClockLayerInput) =>
  runClockLayer(
    {
      ...d,
      readCache: async (_p, kundliId, key) => (layerMem.get(kundliId)?.key === key ? layerMem.get(kundliId)! : null),
      writeCache: async (_p, kundliId, entry) => (layerMem.set(kundliId, entry), true),
    },
    i,
  );

const AS_OF = new Date().toISOString().slice(0, 10);
const OUT_DIR = GROUP ? `docs/reading-engine/replays/71-groups-${AS_OF}` : `docs/reading-engine/replays/70-phase3-${AS_OF}`;

// ------------------------------------------------------------------ the seeded board
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const board: SelfCardId[] = [];
for (const g of SELF_CARD_GROUPS) {
  const inGroup = READABLE_CARDS.filter((id) => cardDef(id)?.group === g.id);
  if (inGroup.length) board.push(pick(inGroup));
}
while (board.length < 5) {
  const left = READABLE_CARDS.filter((id) => !board.includes(id));
  board.push(pick(left));
}
console.log(JSON.stringify({ board }));

// ------------------------------------------------------------------ dry storage
const SWALLOW = new Set(['techniqueOutput', 'areaBuild', 'readingFindingsCache', 'readingValidationFailure', 'readingDossier', 'kundliSlice', 'boardLayout']);
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const swallowed: string[] = [];
function dry<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (typeof prop === 'string' && SWALLOW.has(prop) && v && typeof v === 'object') {
        return new Proxy(v as object, {
          get(dt, op) {
            const f = Reflect.get(dt, op);
            if (typeof op === 'string' && WRITES.has(op)) return async () => (swallowed.push(`${prop}.${op}`), { count: 0 });
            return typeof f === 'function' ? f.bind(dt) : f;
          },
        });
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') return async () => (swallowed.push(String(prop)), 0);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

// ------------------------------------------------------------------ spend ledger and guard
interface CallRow { cards?: string[]; node: string; model: string; at: number; ms: number; promptTokens: number; cachedTokens: number; outputTokens: number; thoughtTokens: number; costUsd: number; finish: string | null }
const calls: CallRow[] = [];
const t0 = performance.now();
const spent = () => Math.round(calls.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6;
async function guardedCall(o: GeminiCallOptions) {
  if (calls.length >= MAX_CALLS) throw new Error(`replay guard: ${MAX_CALLS} calls reached`);
  if (spent() >= CAP_USD) throw new Error(`replay guard: spend ${spent()} reached the cap ${CAP_USD}`);
  const t = performance.now();
  const r = await realCallGemini(o);
  const u = { model: o.model, promptTokens: r.usage?.promptTokens ?? 0, cachedTokens: r.usage?.cachedTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0, thoughtTokens: r.usage?.thoughtTokens ?? 0 };
  const asked = o.fullCache ? [...(o.fullCache.suffix[0] ?? '').matchAll(/^- (\w+): matters/gm)].map((m) => m[1]!) : undefined;
  calls.push({ cards: asked, node: o.node, at: Math.round(performance.now() - t0), ms: Math.round(performance.now() - t), ...u, costUsd: usageCostUsd(u), finish: r.finishReason });
  return r;
}

// ------------------------------------------------------------------ the face checks
const CHART_WORDS = /\b(radha|pyjhora|jhora|dasha|antardasha|lagna|nakshatra|yoga|yogas|transit|saturn|jupiter|mars|venus|mercury|rahu|ketu|house|houses|ascendant|tithi|pravesha|varshaphala|navamsa)\b/i;

const prisma = dry(new PrismaClient());
const raw = new PrismaClient();
mkdirSync(OUT_DIR, { recursive: true });
let userId = '';
let run: CardsRunResult | null = null;
const summary: Record<string, unknown> = { kundli: KUNDLI, asOf: AS_OF, seed: SEED, board, promptVersion: PROMPT_VERSION, explicitCache: explicitCacheEnabled(), model: MODEL };
try {
  const k = await raw.kundli.findUnique({ where: { id: KUNDLI }, select: { user_id: true } });
  if (!k) throw new Error(`kundli ${KUNDLI} not found`);
  userId = k.user_id;
  // the storage-dry proxy swallows raw SQL, so the agents' registry rows are seeded here with the plain client (the same
  // idempotent upsert every server process runs before its first agent run); without them agent_runs hit
  // agent_runs_agent_fkey (2026-11-10 replay)
  summary.agentRegistrySeeded = await seedAgentRegistry(raw);
  const tp = performance.now();
  const sub = await runSelfSubTechniques({ prisma }, { userId, kundliId: KUNDLI, asOf: AS_OF });
  if ('status' in sub) throw new Error(`sub-techniques: ${sub.status}`);
  const ctx = sub.ctx;
  const fam = buildFamilySlices(ctx, sub.loaded);
  const oracleSlice = buildOracleSlice(ctx, fam.packs, buildAreaBriefs(ctx)).slice;
  summary.prepMs = Math.round(performance.now() - tp);
  const r = await runSelfV3Cards(
    {
      prisma,
      callGemini: guardedCall,
      maxSpendUsd: CAP_USD,
      now: new Date(),
      force: true,
      informUsed: () => undefined,
      cardsRead: true,
      cardsReadRest: true,
      cardsCapUsd: CAP_USD,
      loadBoard: async () => ({ cards: board, sections: {} }),
      readCards: async (d, i) => (run = await readCards(d, i)),
      runClockLayer: layerWithMemory,
    },
    { ctx, pressure: sub.loaded.pressure ?? null, oracleSlice, portrait: null, buildId: `replay-70-${SEED}` },
  );

  // timing: a card is ready when its Personalizer call returns
  const readyAt = (id: SelfCardId) => calls.filter((c) => (GROUP ? (c.cards ?? []).includes(id) : c.node.includes(`card.${id}.personalizer`))).map((c) => c.at).pop() ?? null;
  const boardTimes = board.map(readyAt).filter((x): x is number => x !== null);
  const firstCardMs = boardTimes.length ? Math.min(...boardTimes) : null;
  const boardMs = boardTimes.length === board.length ? Math.max(...boardTimes) : null;

  // checks
  const offered = READABLE_CARDS;
  const results = (run as CardsRunResult | null)?.results ?? [];
  const stored = offered.filter((id) => r.cards[id]);
  const spanIds = (r.frame?.spans ?? []).map((s) => s.id);
  const everySpan = stored.filter((id) => spanIds.every((s) => r.cards[id]!.spans.some((x) => x.span === s && x.asks && x.step)));
  const ledgerStatus = new Map((r.ledger?.cells ?? []).map((c) => [c.id, c.status]));
  let spans = 0;
  let grounded = 0;
  for (const x of results) {
    for (const s of x.oracle?.spans ?? []) {
      spans++;
      const ok = s.evidence.some((k) => ['confirmed', 'leaning'].includes(ledgerStatus.get(k) ?? '')) || s.mode !== 'build';
      if (ok) grounded++;
    }
  }
  const faces = stored.flatMap((id) => {
    const c = r.cards[id]!;
    return [c.line, ...c.spans.flatMap((s) => [s.asks, s.obstacle, s.step]), c.confirm?.text ?? ''].filter((t) => CHART_WORDS.test(t)).map((t) => `${id}: ${t}`);
  });
  Object.assign(summary, {
    status: r.status,
    gaps: r.gaps,
    clockLayer: r.clockLayer,
    ledger: r.ledger?.byStatus ?? null,
    firstCardMs,
    boardMs,
    totalMs: Math.round(performance.now() - t0),
    group: GROUP,
    restMs: GROUP ? Math.max(0, ...READABLE_CARDS.map(readyAt).filter((x): x is number => x !== null)) : null,
    checks: {
      offered: offered.length,
      stored: stored.length,
      everySpan: everySpan.length,
      spansGrounded: `${grounded}/${spans}`,
      chartWordsOnFaces: faces,
      pass: stored.length === offered.length && everySpan.length === stored.length && grounded === spans && faces.length === 0,
    },
    cards: results.map((x) => ({ card: x.card, status: x.status, costUsd: x.costUsd, issues: x.issues.length })),
  });
  writeFileSync(`${OUT_DIR}/cards.json`, JSON.stringify({ frame: r.frame, ledger: r.ledger, cards: r.cards, issues: r.issues }, null, 2));

  // --warm: the same board opened again on the cached clock layer (the cards are read again: their writes were swallowed)
  if (WARM) {
    const ws = Math.round(performance.now() - t0);
    const sub2 = await runSelfSubTechniques({ prisma }, { userId, kundliId: KUNDLI, asOf: AS_OF });
    if ('status' in sub2) throw new Error(`warm sub-techniques: ${sub2.status}`);
    const fam2 = buildFamilySlices(sub2.ctx, sub2.loaded);
    const slice2 = buildOracleSlice(sub2.ctx, fam2.packs, buildAreaBriefs(sub2.ctx)).slice;
    const w = await runSelfV3Cards(
      { prisma, callGemini: guardedCall, maxSpendUsd: CAP_USD, now: new Date(), force: false, informUsed: () => undefined, cardsRead: true, cardsReadRest: false, cardsCapUsd: CAP_USD, loadBoard: async () => ({ cards: board, sections: {} }), runClockLayer: layerWithMemory },
      { ctx: sub2.ctx, pressure: sub2.loaded.pressure ?? null, oracleSlice: slice2, portrait: null, buildId: `replay-70-${SEED}-warm` },
    );
    const mine = calls.filter((c) => c.at > ws);
    const at = (id: SelfCardId) => mine.filter((c) => c.node.includes(`card.${id}.personalizer`)).map((c) => c.at - ws).pop() ?? null;
    const times = board.map(at).filter((x): x is number => x !== null);
    summary.warm = {
      clockLayer: w.clockLayer,
      layerCalls: mine.filter((c) => c.node.startsWith('reading.')).length,
      firstCardMs: times.length ? Math.min(...times) : null,
      boardMs: times.length === board.length ? Math.max(...times) : null,
      cards: Object.keys(w.cards).length,
      usd: Math.round(mine.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6,
    };
  }
} finally {
  if (userId) summary.cacheCleanup = await deleteIndividualCaches({ userId, kundliId: KUNDLI }).catch(() => ({ deleted: 0, failed: -1, memoryCleared: 0 }));
  summary.calls = calls;
  summary.totalUsd = spent();
  summary.swallowedWrites = swallowed.length;
  writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ totalUsd: spent(), calls: calls.length, swallowedWrites: swallowed.length, checks: summary.checks ?? null }));
  await raw.$disconnect();
}
