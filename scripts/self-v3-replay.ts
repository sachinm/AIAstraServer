/**
 * Self board v3 live replay (docs/reading-engine/68 §7 step 6, decision D6). Approved by Sachin in chat on 2026-11-09
 * ("Run the replay") for: the paid key GEMINI_API_KEY in .env; one test kundli; two builds; under $0.50. Hard cap: no
 * call once spend reaches CAP_USD or MAX_CALLS calls; the explicit-cache regions are deleted at the end.
 *
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/self-v3-replay.ts [--dry] [--kundli <id>] [--builds 2]
 *
 * Per build: the v2 sub-techniques and area briefs (no model) → the v2 natal prefix (no model) → `runSelfV3Cards` (year
 * frame, Oracle ×3 + one repair, Personalizer ×3). Storage is dry: writes to technique_outputs, area_builds,
 * reading_findings_cache and reading_validation_failures are swallowed and counted. `agent_runs` rows are written as on
 * any build. `--dry` stops after the year frame: no model call, $0.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';

process.env.SELF_V2_PRESSURE_PULL = '0';

const { PrismaClient } = await import('@prisma/client');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildAreaBriefs } = await import('../src/reading/self/areas/index.js');
const { buildFamilySlices, buildOracleSlice } = await import('../src/reading/self/v2/slices.js');
const { runSelfV3Cards } = await import('../src/reading/self/v3/build.js');
const { buildYearFrameV3, loadStoredInventory, otherClocks, FRAME_MAX_OTHER_CLOCKS, renderYearFrame } = await import('../src/reading/self/v3/yearFrame.js');
const { callGemini: realCallGemini } = await import('../src/reading/llm/gemini.js');
const { usageCostUsd } = await import('../src/reading/llm/models.js');
const { deleteIndividualCaches, explicitCacheEnabled } = await import('../src/reading/llm/promptCache.js');
const { clockLabel } = await import('../src/reading/self/words.js');
const { PROMPT_VERSION } = await import('../src/reading/prompts/generated.js');
type GeminiCallOptions = import('../src/reading/llm/gemini.js').GeminiCallOptions;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const arg = (name: string) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : undefined);
const KUNDLI = arg('--kundli') ?? 'c584c0a3-841b-451b-a2ed-f5709c5fb31d';
const BUILDS = Number(arg('--builds') ?? 2);
const AS_OF = new Date().toISOString().slice(0, 10);
const CAP_USD = 0.5;
const MAX_CALLS = 14;
const OUT_DIR = 'docs/reading-engine/replays/68-2026-11-09';
const REPORT = 'docs/reading-engine/68-replay-2026-11-09-self-v3.md';

// ------------------------------------------------------------------ dry storage
const SWALLOW = new Set(['techniqueOutput', 'areaBuild', 'readingFindingsCache', 'readingValidationFailure', 'readingDossier']);
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
interface CallRow { build: number; node: string; model: string; ms: number; promptTokens: number; cachedTokens: number; outputTokens: number; thoughtTokens: number; costUsd: number; finish: string | null }
const calls: CallRow[] = [];
let build = 0;
const spent = () => Math.round(calls.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6;
async function guardedCall(o: GeminiCallOptions) {
  if (calls.length >= MAX_CALLS) throw new Error(`replay guard: ${MAX_CALLS} calls reached`);
  if (spent() >= CAP_USD) throw new Error(`replay guard: spend ${spent()} reached the cap ${CAP_USD}`);
  const t = performance.now();
  const r = await realCallGemini(o);
  const u = { model: o.model, promptTokens: r.usage?.promptTokens ?? 0, cachedTokens: r.usage?.cachedTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0, thoughtTokens: r.usage?.thoughtTokens ?? 0 };
  calls.push({ build, node: o.node, ms: Math.round(performance.now() - t), ...u, costUsd: usageCostUsd(u), finish: r.finishReason });
  return r;
}

const prisma = dry(new PrismaClient());
const raw = new PrismaClient();
mkdirSync(OUT_DIR, { recursive: true });
const report: string[] = [];
const summary: Record<string, unknown> = { kundli: KUNDLI, asOf: AS_OF, promptVersion: PROMPT_VERSION, explicitCache: explicitCacheEnabled(), builds: [] as unknown[] };
let userId = '';
try {
  const k = await raw.kundli.findUnique({ where: { id: KUNDLI }, select: { user_id: true } });
  if (!k) throw new Error(`kundli ${KUNDLI} not found`);
  userId = k.user_id;
  for (build = 1; build <= (DRY ? 1 : BUILDS); build++) {
    const t0 = performance.now();
    const sub = await runSelfSubTechniques({ prisma }, { userId, kundliId: KUNDLI, asOf: AS_OF });
    if ('status' in sub) throw new Error(`sub-techniques: ${sub.status}`);
    const ctx = sub.ctx;
    const briefs = buildAreaBriefs(ctx);
    const fam = buildFamilySlices(ctx, sub.loaded);
    const oracleSlice = buildOracleSlice(ctx, fam.packs, briefs).slice;
    const prepMs = Math.round(performance.now() - t0);
    if (DRY) {
      const clock = ctx.sub.clock!;
      const inv = await Promise.all(otherClocks(clock).slice(0, FRAME_MAX_OTHER_CLOCKS).map(async (s) => ({ system: s, inventory: await loadStoredInventory(prisma, KUNDLI, s) })));
      const frame = buildYearFrameV3({ asOf: AS_OF, clock, primary: sub.loaded.pressure ?? null, others: inv, year: ctx.sub.year ?? null });
      console.log(renderYearFrame(frame, clockLabel(frame.clock)).text);
      console.log(JSON.stringify({ prepMs, prefixTokens: oracleSlice.estTokens.prefix, spans: frame.spans.length, clocksRead: frame.clocksRead, skipped: frame.clocksSkipped, degraded: frame.degraded }, null, 1));
      break;
    }
    const r = await runSelfV3Cards(
      { prisma, callGemini: guardedCall, maxSpendUsd: CAP_USD, now: new Date(), force: true, informUsed: () => undefined },
      { ctx, pressure: sub.loaded.pressure ?? null, oracleSlice, portrait: null, buildId: `replay-68-${build}` },
    );
    const mine = calls.filter((c) => c.build === build);
    const b = { build, status: r.status, cards: Object.keys(r.cards).length, spans: r.frame?.spans.length ?? 0, prepMs, ms: r.ms, calls: mine.length, costUsd: Math.round(mine.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6, issues: r.issues, gaps: r.gaps };
    (summary.builds as unknown[]).push(b);
    writeFileSync(`${OUT_DIR}/build-${build}.json`, JSON.stringify({ frame: r.frame, cards: r.cards, issues: r.issues, gaps: r.gaps, ms: r.ms }, null, 2));
    console.log(JSON.stringify({ build, status: r.status, cards: b.cards, spans: b.spans, calls: b.calls, costUsd: b.costUsd, ms: r.ms.total, issues: r.issues.length }));
  }
} finally {
  if (!DRY && userId) {
    const d = await deleteIndividualCaches({ userId, kundliId: KUNDLI }).catch(() => ({ deleted: 0, failed: -1, memoryCleared: 0 }));
    summary.cacheCleanup = d;
  }
  summary.calls = calls;
  summary.totalUsd = spent();
  summary.swallowedWrites = swallowed.length;
  if (!DRY) writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ totalUsd: spent(), calls: calls.length, swallowedWrites: swallowed.length }));
  await raw.$disconnect();
  void report;
  void REPORT;
}
