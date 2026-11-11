/**
 * Doc 71 Phase 0: measure one cache pack per kundli. Step 1 (free): run the v3 card path with a fake model that records
 * every prompt and answers nothing, assemble the union of all prompts into one pack, count its tokens (countTokens is
 * free). Step 2 (PAID, only with --yes-spend): create one explicit cache of the pack, then four streamed group calls in
 * parallel, each writing five or six cards (Oracle step and Personalizer face in one call), on that cache; record cache
 * creation time, time to first token, time to finish, usage and cost; delete the cache. Storage writes are swallowed.
 *
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/cache-pack-measure.ts [--kundli <id>]                (free)
 *   DOTENV_CONFIG_PATH=<server .env> npx tsx scripts/cache-pack-measure.ts --yes-spend --cap 0.25 [--ttl 600]
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n: string) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
const YES = argv.includes('--yes-spend');
const KUNDLI = arg('--kundli') ?? '75b0d618-90b7-4db6-bff8-cc7bb0ed561f';
const CAP = Number(arg('--cap') ?? 0.25);
const TTL = Number(arg('--ttl') ?? 600);
const OUT = arg('--out') ?? 'docs/reading-engine/replays/71-phase0';
const MODEL = process.env.READING_MODEL_ORACLE?.trim() || 'gemini-3.8-flash';
const KEY = process.env.GEMINI_API_KEY?.trim() ?? '';
const BASE = (process.env.GEMINI_API_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '');
const ROOT = BASE.replace(/\/models$/, '');
if (!KEY) throw new Error('GEMINI_API_KEY unset');
console.log(JSON.stringify({ test: 'doc 71 Phase 0', keyTail: KEY.slice(-4), model: MODEL, kundli: KUNDLI, paid: YES, capUsd: CAP, ttlSeconds: TTL }));

process.env.SELF_V2_PRESSURE_PULL = '0';
process.env.SELF_V3_BUILD = '1';
process.env.READING_CLOCK_LAYER = '1';
process.env.CARDS_READ_REST = '1';
process.env.READING_EXPLICIT_CACHE = '0';

const { PrismaClient } = await import('@prisma/client');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildAreaBriefs } = await import('../src/reading/self/areas/index.js');
const { buildFamilySlices, buildOracleSlice, promptText } = await import('../src/reading/self/v2/slices.js');
const { runSelfV3Cards } = await import('../src/reading/self/v3/build.js');
const { readCards } = await import('../src/reading/cards/run.js');
const { runClockLayer } = await import('../src/reading/clocks/run.js');
const { READABLE_CARDS, cardDef } = await import('../src/reading/self/v3/cards.js');
const { SELF_CARD_GROUPS } = await import('../src/reading/self/v3/types.js');
const { usageCostUsd } = await import('../src/reading/llm/models.js');
type GeminiCallOptions = import('../src/reading/llm/gemini.js').GeminiCallOptions;

// ---------------------------------------------------------------- dry storage (as in cards-replay.ts)
const SWALLOW = new Set(['techniqueOutput', 'areaBuild', 'readingFindingsCache', 'readingValidationFailure', 'readingDossier', 'kundliSlice', 'boardLayout', 'agentRun']);
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
function dry<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (typeof prop === 'string' && SWALLOW.has(prop) && v && typeof v === 'object') {
        return new Proxy(v as object, {
          get(dt, op) {
            const f = Reflect.get(dt, op);
            if (typeof op === 'string' && WRITES.has(op)) return async () => ({ count: 0, id: 'dry' });
            return typeof f === 'function' ? f.bind(dt) : f;
          },
        });
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') return async () => 0;
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

// ---------------------------------------------------------------- step 1: capture every prompt (no model)
const captured: Array<{ node: string; system: string; parts: string[] }> = [];
const fakeCall = async (o: GeminiCallOptions): Promise<never> => {
  captured.push({ node: o.node, system: o.system ?? '', parts: [...o.parts] });
  throw new Error('capture only');
};
const raw = new PrismaClient();
const prisma = dry(new PrismaClient());
const AS_OF = new Date().toISOString().slice(0, 10);
const k = await raw.kundli.findUnique({ where: { id: KUNDLI }, select: { user_id: true } });
if (!k) throw new Error('kundli not found');
const sub = await runSelfSubTechniques({ prisma }, { userId: k.user_id, kundliId: KUNDLI, asOf: AS_OF });
if ('status' in sub) throw new Error(`sub-techniques: ${sub.status}`);
const fam = buildFamilySlices(sub.ctx, sub.loaded);
const oracleSlice = buildOracleSlice(sub.ctx, fam.packs, buildAreaBriefs(sub.ctx)).slice;
const board = READABLE_CARDS.slice(0, 5);
await runSelfV3Cards(
  {
    prisma,
    callGemini: fakeCall,
    maxSpendUsd: 1,
    now: new Date(),
    force: true,
    informUsed: () => undefined,
    cardsRead: true,
    cardsReadRest: true,
    cardsCapUsd: 1,
    loadBoard: async () => ({ cards: board, sections: {} }),
    readCards: (d: any, i: any) => readCards(d, i),
    // the readers are captured (and fail); an empty ledger lets the cards run so their prompts are captured too.
    // The cards' ledger lines are therefore missing from the pack (a few hundred tokens per card).
    runClockLayer: async (d: any, i: any) => {
      const r = await runClockLayer(d, i);
      return { ...r, words: null, ledger: { frameHash: 'measure', sheetHashes: {}, cells: [], pairs: [], byStatus: { confirmed: 0, leaning: 0, contested: 0, single: 0 } } };
    },
  } as any,
  { ctx: sub.ctx, pressure: sub.loaded.pressure ?? null, oracleSlice, portrait: null, buildId: 'measure-71' } as any,
).catch((e: any) => console.log('build ended:', String(e?.message ?? e).slice(0, 160)));
await raw.$disconnect();

const nodeKind = (n: string) => n.replace(/card\.[a-z_]+\./, 'card.*.').replace(/clock\.[a-z_]+/, 'clock.*');
const kinds: Record<string, number> = {};
for (const c of captured) kinds[nodeKind(c.node)] = (kinds[nodeKind(c.node)] ?? 0) + 1;
console.log(JSON.stringify({ captured: captured.length, kinds }));

// the pack: one role library, then every distinct text any sub-agent was given, each once, in a stable order
const systems = [...new Set(captured.map((c) => c.system).filter(Boolean))];
const roles = [
  '# ROLE LIBRARY. Each request names the role to take. Follow only that role.',
  ...systems.map((s, i) => `## SHARED SYSTEM ${i + 1}\n${s}`),
  `## ROLE: CARD ORACLE\n${promptText('cards/oracle')}`,
  `## ROLE: PERSONALIZER\n${promptText('personalizer/self-v3')}`,
  `## ROLE: CONCORDANCE\n${promptText('concordance')}`,
].join('\n\n');
const seen = new Set<string>();
const blocks: string[] = [];
for (const c of captured.filter((x) => !x.node.endsWith(".repair"))) {
  for (const p of c.parts) {
    if (p && !seen.has(p)) {
      seen.add(p);
      blocks.push(`=== ${c.node} ===\n${p}`);
    }
  }
}
const briefs = READABLE_CARDS.map((id) => `## CARD BRIEF ${id}\n${promptText(`cards/self/${id}`)}`).join('\n\n');
// each long line once: the card prompt (21 copies) and the rows shared by several cards and clocks are written in the
// first block that has them; later blocks keep only their own lines (70% of the raw pack was repeats, 2026-11-11)
const fullPack = [briefs, ...blocks].join('\n\n');
const seenLine = new Set<string>();
const pack = fullPack
  .split('\n')
  .filter((l) => {
    if (l.length <= 40 || l.startsWith('===')) return true;
    if (seenLine.has(l)) return false;
    seenLine.add(l);
    return true;
  })
  .join('\n');
mkdirSync(OUT, { recursive: true });
const SCRATCH = process.env.MEASURE_SCRATCH ?? OUT;
mkdirSync(SCRATCH, { recursive: true });
writeFileSync(`${SCRATCH}/pack.txt`, pack);
writeFileSync(`${SCRATCH}/roles.txt`, roles);

async function api(path: string, body?: unknown, method = 'POST'): Promise<any> {
  const r = await fetch(`${ROOT}/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(KEY)}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180_000),
  });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(`${path.split('?')[0]} HTTP ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const sys = { parts: [{ text: roles }] };
const contents = [{ role: 'user', parts: [{ text: pack }] }];
const counted = await api(`models/${MODEL}:countTokens`, { generateContentRequest: { model: `models/${MODEL}`, systemInstruction: sys, contents } });
const packTokens = Number(counted.totalTokens ?? 0);
const summary: Record<string, unknown> = { asOf: AS_OF, kundli: KUNDLI, model: MODEL, captured: captured.length, kinds, distinctBlocks: blocks.length, packChars: pack.length + roles.length, packTokens };
console.log(JSON.stringify(summary));

const p = { in: 0.75, cached: 0.075, out: 3.75 };
const OUT_TOK_PER_GROUP = 9_000;
const est = (packTokens * p.in + 4 * packTokens * p.cached + 4 * OUT_TOK_PER_GROUP * p.out) / 1e6;
summary.estimateUsd = Math.round(est * 1e4) / 1e4;
console.log(JSON.stringify({ estimateUsd: summary.estimateUsd, note: 'creation at the input rate (worst case) + 4 cached reads + 4 x 9k output' }));
if (!YES) {
  writeFileSync(`${OUT}/summary-free.json`, JSON.stringify(summary, null, 2));
  console.log('free step done; the paid step needs --yes-spend');
  process.exit(0);
}
if (est > CAP) {
  console.error(`refused: estimate ${est.toFixed(3)} is over the cap ${CAP}`);
  process.exit(1);
}

// ---------------------------------------------------------------- step 2 (paid): one cache, four groups in parallel
const tc = performance.now();
const cache = await api('cachedContents', { model: `models/${MODEL}`, displayName: 'aiastra:measure-71', systemInstruction: sys, contents, ttl: `${TTL}s` });
const createMs = Math.round(performance.now() - tc);
summary.cache = { name: cache.name, createMs, usage: cache.usageMetadata, expireTime: cache.expireTime };
console.log(JSON.stringify({ cache: summary.cache }));

const groupIdx = (id: string) => SELF_CARD_GROUPS.findIndex((g: any) => g.id === (cardDef(id as any) as any)?.group);
const ordered = [...(READABLE_CARDS as readonly string[])].sort((a, b) => groupIdx(a) - groupIdx(b));
const groups: string[][] = [[], [], [], []];
ordered.forEach((id, i) => groups[Math.floor((i * 4) / ordered.length)]!.push(id));

function instruction(cards: string[]): string {
  return [
    `ROLE: CARD ORACLE, then PERSONALIZER, for each of these cards: ${cards.join(', ')}.`,
    `TODAY: ${AS_OF}. Each card's own data is the "=== self.card.oracle.<id> ===" block in the shared data; the year frame and ledger are there too.`,
    'For each card, first write the Oracle object exactly as the CARD ORACLE role says, then write the face exactly as the PERSONALIZER role says, from that Oracle object and the person.',
    'Return one JSON object: {"cards":[{"card":"<id>","oracle":{...},"face":{...}}]}, one entry per card, in the order given. JSON only.',
  ].join('\n');
}
const calls: any[] = [];
const t0 = performance.now();
async function group(i: number, cards: string[]): Promise<void> {
  const t = performance.now();
  let first: number | null = null;
  let text = '';
  let usage: any = {};
  let finish: string | null = null;
  const r = await fetch(`${BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      cachedContent: cache.name,
      contents: [{ role: 'user', parts: [{ text: instruction(cards) }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 24_000, temperature: 0.7, thinkingConfig: { thinkingLevel: 'low' } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok || !r.body) throw new Error(`group ${i} HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of r.body as any) {
    buf += dec.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
    let at: number;
    while ((at = buf.indexOf('\n\n')) >= 0) {
      const ev = buf.slice(0, at);
      buf = buf.slice(at + 2);
      const line = ev.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const j = JSON.parse(line.slice(5));
      const piece = (j.candidates?.[0]?.content?.parts ?? []).filter((x: any) => !x.thought).map((x: any) => x.text ?? '').join('');
      if (piece && first === null) first = Math.round(performance.now() - t);
      text += piece;
      if (j.usageMetadata) usage = j.usageMetadata;
      if (j.candidates?.[0]?.finishReason) finish = j.candidates[0].finishReason;
    }
  }
  const ms = Math.round(performance.now() - t);
  const u = { model: MODEL, promptTokens: usage.promptTokenCount ?? 0, cachedTokens: usage.cachedContentTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0, thoughtTokens: usage.thoughtsTokenCount ?? 0 };
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const got: string[] = Array.isArray(parsed?.cards) ? parsed.cards.map((c: any) => c.card) : [];
  calls.push({ group: i, cards, firstTokenMs: first, ms, ...u, costUsd: usageCostUsd(u), finish, jsonOk: parsed !== null, cardsReturned: got.length, missing: cards.filter((c) => !got.includes(c)) });
  writeFileSync(`${OUT}/group-${i}.json`, text);
}
try {
  await Promise.all(groups.map((g, i) => group(i, g).catch((e) => void calls.push({ group: i, error: String(e?.message ?? e).slice(0, 300) }))));
} finally {
  summary.wallMs = Math.round(performance.now() - t0);
  try {
    await api(cache.name, undefined, 'DELETE');
    summary.cacheDeleted = true;
  } catch (e) {
    summary.cacheDeleted = String((e as Error).message).slice(0, 200);
  }
}
summary.groups = calls;
const callCost = calls.reduce((n, c) => n + (c.costUsd ?? 0), 0);
summary.costUsd = { calls: Math.round(callCost * 1e4) / 1e4, cacheCreateIfBilledAsInput: Math.round(((packTokens * p.in) / 1e6) * 1e4) / 1e4, storage: 'not counted here' };
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
