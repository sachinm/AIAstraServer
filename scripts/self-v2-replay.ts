/**
 * Self board v2 live replay (docs/reading-engine/66 §4.9, §13): one paid run of the v2 build's agents on stored kundlis,
 * with storage DRY. Approved by Sachin on 2026-11-09 ("Yes, run it") for: the paid key in .env; gemini-3.1-flash-lite
 * (family readers, Personalizer) and gemini-3.8-flash (Oracle); about 22 calls; about $0.20. Hard cap: no call that
 * could take total spend over $0.40, never more than 30 model calls.
 *
 *   npx tsx scripts/self-v2-replay.ts [--dry] [--kundli <id>]... [--out <report.md>]
 *
 * Per kundli: sub-techniques (S1–S10) → eleven area briefs → slices → explicit-cache warm-up (family ×5 + Oracle prefix)
 * → family readers ×5 (parallel) → Oracle ×3 (parallel) + validator → Personalizer ×3 over the SAME Oracle document, one
 * per synthetic profile pack (buildProfilePack, never stored) + validator → scans.
 *
 * Storage is dry: nothing goes to `technique_outputs`, `area_builds` or `reading_findings_cache` (the Prisma client is
 * wrapped and throws on any write to them). `llm_cache_entries` rows for created regions are allowed and checked, so
 * the 45-minute sweep can clean them. `agent_runs` rows (summaries: counts and ids) are written by `withAgentRun` as on
 * any build. The per-individual recycler hook is a no-op here: its in-process timer would otherwise delete the
 * person's stored outputs 45 minutes later; the scheduled sweep finds the regions through their ledger rows.
 *
 * `--dry` stops after the slices: no cache region, no model call, $0.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';

// run env, before any module reads it
process.env.SELF_V2_BUILD = '1';
process.env.SELF_V2_PRESSURE_PULL = '0';

const { PrismaClient } = await import('@prisma/client');
const { runSelfSubTechniques } = await import('../src/reading/self/sub/index.js');
const { buildAreaBriefs } = await import('../src/reading/self/areas/index.js');
const slicesMod = await import('../src/reading/self/v2/slices.js');
const { buildFamilySlices, buildOracleSlice, buildPersonalizerSlice, FAMILY_IDS, promptHash, SELF_V2_ORACLE_PROMPT, SELF_V2_PERSONALIZER_PROMPT } = slicesMod;
const { warmPrefixes } = await import('../src/reading/self/v2/cache.js');
const { runOracleV2, ORACLE_V2_CALLS } = await import('../src/reading/self/v2/oracle.js');
const { runPersonalizer } = await import('../src/reading/self/v2/personalizer.js');
const { CHART_TERMS, ENGINE_NAMES, INTERNAL_ID, GENDERED_WORDS, MEDICAL_WORDS, parsePersonalDoc, oracleDates, daysIn } = await import('../src/reading/self/v2/personalizerValidate.js');
const { redactEngineTerms } = await import('../src/reading/self/oracle.js');
const { callGemini: realCallGemini } = await import('../src/reading/llm/gemini.js');
const { usageCostUsd, priceFor } = await import('../src/reading/llm/models.js');
const { explicitCacheEnabled, cacheStats } = await import('../src/reading/llm/promptCache.js');
const { buildProfilePack } = await import('../src/reading/person/profile.js');
const { getSelfOracleMaxOutputTokens, getSelfPersonalizerMaxOutputTokens, getSelfPersonalizerModel } = await import('../src/config/env.js');
const { PROMPT_VERSION } = await import('../src/reading/prompts/generated.js');

type GeminiCallOptions = import('../src/reading/llm/gemini.js').GeminiCallOptions;
type GeminiResult = import('../src/reading/llm/gemini.js').GeminiResult;
type SelfBuildContext = import('../src/reading/self/v2types.js').SelfBuildContext;
type OracleV2Output = import('../src/reading/self/v2types.js').OracleV2Output;
type PersonalCardDoc = import('../src/reading/self/v2types.js').PersonalCardDoc;
type ProfilePack = import('../src/reading/self/v2types.js').ProfilePack;

// ------------------------------------------------------------------------------------------------ arguments and caps
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const kundliArgs: string[] = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--kundli' && argv[i + 1]) kundliArgs.push(argv[++i]!);
const outIdx = argv.indexOf('--out');
const REPORT = outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1]! : 'docs/reading-engine/66-replay-2026-11-09-self-v2.md';
const RAW_DIR = 'docs/reading-engine/replays/66-2026-11-09';
const AS_OF = '2026-11-09';
const KUNDLIS = kundliArgs.length ? kundliArgs : ['c584c0a3-841b-451b-a2ed-f5709c5fb31d'];

const CAP_USD = 0.4;
const MAX_CALLS = 30;
/** explicit cache storage, $ per 1M tokens per hour: not in PRICES; Google's published Flash-class rate, an estimate */
const STORAGE_USD_PER_MTOK_HOUR = 1.0;
const TTL_HOURS = (Number(process.env.READING_EXPLICIT_CACHE_TTL_SECONDS) >= 60 ? Number(process.env.READING_EXPLICIT_CACHE_TTL_SECONDS) : 1800) / 3600;
/** a thinking allowance on top of maxOutputTokens for the worst case (thoughts bill at the output rate) */
const THINK_ALLOW: Record<string, number> = { off: 0, low: 2048, medium: 4096, high: 8192 };

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const est = (s: string) => Math.ceil(s.length / 4);

// ------------------------------------------------------------------------------------------------ guarded Prisma
const BLOCKED_MODELS = new Set(['techniqueOutput', 'areaBuild', 'readingFindingsCache', 'readingDossier']);
const WRITE_OPS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const blockedWrites: string[] = [];
function guardPrisma<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (typeof prop === 'string' && BLOCKED_MODELS.has(prop) && v && typeof v === 'object') {
        return new Proxy(v as object, {
          get(dt, op) {
            const f = Reflect.get(dt, op);
            if (typeof op === 'string' && WRITE_OPS.has(op)) {
              return () => {
                blockedWrites.push(`${prop}.${op}`);
                return Promise.reject(new Error(`dry run: ${prop}.${op} blocked`));
              };
            }
            return typeof f === 'function' ? f.bind(dt) : f;
          },
        });
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') {
        return (...a: unknown[]) => {
          blockedWrites.push(String(prop));
          return Promise.reject(new Error(`dry run: ${String(prop)} blocked (${String(a[0]).slice(0, 60)})`));
        };
      }
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

// ------------------------------------------------------------------------------------------------ spend ledger
interface CallRow {
  kundli: string;
  stage: string;
  agent: string;
  callId: string;
  model: string;
  wallMs: number;
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  costUsd: number;
  worstUsd: number;
  status: string;
  finishReason: string | null;
  cacheUsed: boolean;
}
const callRows: CallRow[] = [];
const rawTexts = new Map<string, string>();
let spent = 0;
let reserved = 0;
let storageEst = 0;
let callCount = 0;
const refusals: string[] = [];

function worstCase(o: GeminiCallOptions): number {
  const p = priceFor(o.model);
  if (!p) return Infinity; // an unpriced model is never called
  const inTok = est([o.system ?? '', ...o.parts].join('\n'));
  const outTok = (o.maxOutputTokens ?? 8192) + (THINK_ALLOW[o.thinking ?? 'off'] ?? 0);
  return (inTok * p.in + outTok * p.out) / 1e6;
}

function guardedCall(kundli: string, stage: string, agent: string) {
  return async (o: GeminiCallOptions): Promise<GeminiResult> => {
    const callId = `${stage}:${o.node}`;
    const worst = worstCase(o);
    if (callCount + 1 > MAX_CALLS) {
      refusals.push(`${callId}: refused, call ${callCount + 1} would pass the ${MAX_CALLS}-call cap`);
      throw new Error('replay call cap reached');
    }
    if (spent + reserved + storageEst + worst > CAP_USD) {
      refusals.push(`${callId}: refused, spent ${round6(spent)} + in flight ${round6(reserved)} + storage est ${round6(storageEst)} + worst case ${round6(worst)} > cap ${CAP_USD}`);
      throw new Error('replay spend cap reached');
    }
    callCount += 1;
    reserved += worst;
    const t0 = performance.now();
    try {
      const r = await realCallGemini(o);
      const cost = usageCostUsd(r.usage);
      spent += cost;
      rawTexts.set(callId, r.text);
      callRows.push({
        kundli,
        stage,
        agent,
        callId,
        model: o.model,
        wallMs: Math.round(performance.now() - t0),
        promptTokens: r.usage.promptTokens,
        cachedTokens: r.usage.cachedTokens,
        outputTokens: r.usage.outputTokens,
        thoughtTokens: r.usage.thoughtTokens,
        costUsd: round6(cost),
        worstUsd: round6(worst),
        status: r.text ? 'ok' : 'empty',
        finishReason: r.finishReason,
        cacheUsed: r.usage.cachedTokens > 0,
      });
      return r;
    } catch (e) {
      callRows.push({ kundli, stage, agent, callId, model: o.model, wallMs: Math.round(performance.now() - t0), promptTokens: 0, cachedTokens: 0, outputTokens: 0, thoughtTokens: 0, costUsd: 0, worstUsd: round6(worst), status: `failed: ${String((e as Error).message).slice(0, 120)}`, finishReason: null, cacheUsed: false });
      throw e;
    } finally {
      reserved -= worst;
    }
  };
}

const noInform = () => undefined;

// ------------------------------------------------------------------------------------------------ synthetic profiles
const PROFILES: Array<{ id: 'a' | 'b' | 'c'; label: string; src: Parameters<typeof buildProfilePack>[0] }> = [
  {
    id: 'a',
    label: 'woman, 25–35, own business with staff, single, focus career and money',
    src: { birthDate: '1996-03-15', gender: 'female', role: null, facts: { 'work.status': { value: 'own_business' }, 'work.level': { value: 'owner_staff' }, 'love.status': { value: 'single' }, 'self.focus': { value: 'career,money' } } },
  },
  {
    id: 'b',
    label: 'man, 46–60, employed senior leader, married, grown children, focus career and family',
    src: { birthDate: '1972-06-01', gender: 'male', role: null, facts: { 'work.status': { value: 'yes' }, 'work.level': { value: 'senior_leader' }, 'love.status': { value: 'married' }, 'family.children': { value: 'grown' }, 'self.focus': { value: 'career,family' } } },
  },
  {
    id: 'c',
    label: 'gender not stated, 60+, retired, focus health and spirituality',
    src: { birthDate: '1958-02-01', gender: 'prefer_not_to_say', role: null, facts: { 'work.status': { value: 'retired' }, 'self.focus': { value: 'health,spirituality' } } },
  },
];

// ------------------------------------------------------------------------------------------------ scans
const TECH_ID = /\b(self|family|lineman|oracle|personalizer)\.[a-z_]+(\.[a-z_]+)*\b/i;
interface ScanHit {
  where: string;
  kind: string;
  match: string;
  text: string;
}
function scanText(where: string, text: string, genderStated: boolean): ScanHit[] {
  const hits: ScanHit[] = [];
  if (!text) return hits;
  const add = (kind: string, m: RegExpMatchArray | null) => {
    if (m) hits.push({ where, kind, match: m[0], text: text.slice(0, 160) });
  };
  for (const re of CHART_TERMS) add('chart term', text.match(re));
  add('engine name', text.match(ENGINE_NAMES));
  add('internal id', text.match(INTERNAL_ID));
  add('technique id', text.match(TECH_ID));
  add('medical word', text.match(MEDICAL_WORDS));
  if (!genderStated) add('gendered word', text.match(GENDERED_WORDS));
  return hits;
}
function scanDoc(doc: PersonalCardDoc | { hero: Record<string, unknown>; cards: unknown[] } | null, genderStated: boolean, prefix: string): ScanHit[] {
  if (!doc) return [];
  const hits: ScanHit[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') hits.push(...scanText(path, v, genderStated));
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['sources', 'source', 'areaId', 'strip', 'claimId', 'questionClaimId', 'tone', 'kind', 'from', 'to', 'since', 'until', 'certainty', 'easesAt', 'nextCheck'].includes(k)) walk(x, `${path}.${k}`);
  };
  walk(doc, prefix);
  return hits;
}

/** card dates and dates in card text that are not in the Oracle document */
function datesOutside(doc: PersonalCardDoc | null, oracle: OracleV2Output): string[] {
  if (!doc) return [];
  const days = oracleDates(oracle).days;
  const out: string[] = [];
  for (const [id, c] of Object.entries(doc.cards)) {
    if (!c) continue;
    for (const d of c.dates) for (const x of [d.from, d.to]) if (days.size && !days.has(x)) out.push(`${id}: date ${x} not in the Oracle document`);
    for (const t of [c.headline, ...c.body]) for (const x of daysIn(t)) if (days.size && !days.has(x)) out.push(`${id}: text names ${x}, not in the Oracle document`);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ privacy strip
const STRIP_KEYS = /^(name|full_?name|first_?name|last_?name|birth.*|date_of_birth|dob|place|birth_?place|lat|lon|lng|latitude|longitude|coords?|coordinates|tz|timezone|email|phone|userId|user_id)$/i;
function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !STRIP_KEYS.test(k)).map(([k, x]) => [k, strip(x)]));
  return v;
}

// ------------------------------------------------------------------------------------------------ the run
interface ProfileRun {
  id: string;
  label: string;
  pack: Omit<ProfilePack, 'ageYears' | 'hash'> & { hash: string };
  status: string;
  doc: PersonalCardDoc | null;
  raw: unknown;
  cardStatus: Record<string, string>;
  gaps: string[];
  scan: ScanHit[];
  rawScan: ScanHit[];
  datesOutside: string[];
  finishReason: string | null;
  wordCounts: Record<string, { headline: number; body: number }>;
}
interface KundliRun {
  kundliId: string;
  status: string;
  subGaps: string[];
  ms: Record<string, number>;
  slices: Array<{ agent: string; prefixTokens: number; suffixTokens: number; model: string }>;
  warmed: Array<{ agent: string; name: string | null; ms: number; model: string }>;
  briefs: Array<{ areaId: string; claims: number; dates: number }>;
  windowsDegraded: unknown;
  pressureSource: string;
  familyFindings: Array<{ family: string; chars: number; text: string }>;
  oracle: { status: string; gaps: string[]; withheld: string[]; output: OracleV2Output | null; calls: unknown[]; spentUsd: number } | null;
  profiles: ProfileRun[];
  ledger: Array<{ name: string; model: string; kundli: boolean; user: boolean; expires: string }>;
}

const rawPrisma = new PrismaClient();
const prisma = guardPrisma(rawPrisma);
const tAll = performance.now();
const runs: KundliRun[] = [];

async function runKundli(kundliId: string): Promise<KundliRun> {
  const k = await rawPrisma.kundli.findUnique({ where: { id: kundliId }, select: { user_id: true } });
  if (!k) throw new Error(`kundli ${kundliId.slice(0, 8)} not found`);
  const userId = k.user_id;
  const kshort = kundliId.slice(0, 8);
  const run: KundliRun = { kundliId: kshort, status: 'started', subGaps: [], ms: {}, slices: [], warmed: [], briefs: [], windowsDegraded: null, pressureSource: '', familyFindings: [], oracle: null, profiles: [], ledger: [] };
  const lap = (name: string, t: number) => (run.ms[name] = Math.round(performance.now() - t));

  // 0–1 sub-techniques
  let t = performance.now();
  const sub = await runSelfSubTechniques({ prisma }, { userId, kundliId, asOf: AS_OF });
  lap('subs', t);
  if ('status' in sub) {
    run.status = 'preparing (no digest)';
    return run;
  }
  run.subGaps = sub.gaps;
  const ctx: SelfBuildContext = sub.ctx;
  run.windowsDegraded = (ctx.sub.windows as unknown as { degraded?: unknown } | undefined)?.degraded ?? null;
  run.pressureSource = sub.loaded.pressure ? 'stored' : 'none (pull off, no stored row)';

  // 2 briefs
  t = performance.now();
  const briefs = buildAreaBriefs(ctx);
  lap('briefs', t);
  run.briefs = briefs.map((b) => ({ areaId: b.areaId, claims: b.claims.length, dates: b.dates.length }));

  // 3 slices
  t = performance.now();
  const fam = buildFamilySlices(ctx, sub.loaded);
  const first = buildOracleSlice(ctx, fam.packs, briefs);
  lap('slices', t);
  run.slices = [...FAMILY_IDS.map((id) => fam.slices[id]), first.slice].map((s) => ({ agent: s.agent, prefixTokens: s.estTokens.prefix, suffixTokens: s.estTokens.suffix, model: s.model }));
  if (DRY) {
    run.status = 'dry';
    return run;
  }

  // warm: family ×5 + Oracle prefix (storage reserved against the cap first)
  const toWarm = [...FAMILY_IDS.map((id) => fam.slices[id]), first.slice];
  storageEst += toWarm.reduce((n, s) => n + ((s.estTokens.prefix + est(s.system)) * STORAGE_USD_PER_MTOK_HOUR * TTL_HOURS) / 1e6, 0);
  t = performance.now();
  const warmed = await warmPrefixes(toWarm);
  lap('warm', t);
  run.warmed.push(...warmed.map((w) => ({ agent: w.agent, name: w.name, ms: Math.round(w.ms), model: w.model })));

  // 4 family readers ×5 (no reading_findings_cache: a cold, measured run)
  t = performance.now();
  const fr = await Promise.all(
    FAMILY_IDS.map(async (id) => {
      const slice = fam.slices[id];
      try {
        const g = await guardedCall(kshort, 'family', id)({ model: slice.model, node: id, system: slice.system, parts: [slice.prefix, slice.suffix], thinking: 'medium', maxOutputTokens: 2000, cachePrefix: true, cacheOwner: slice.cacheOwner });
        return { family: id, text: redactEngineTerms(g.text) };
      } catch {
        return { family: id, text: '' };
      }
    }),
  );
  lap('families', t);
  const findings = fr.filter((f) => f.text);
  run.familyFindings = fr.map((f) => ({ family: f.family, chars: f.text.length, text: f.text }));
  const familySpend = round6(callRows.filter((c) => c.kundli === kshort && c.stage === 'family').reduce((n, c) => n + c.costUsd, 0));

  // 5–6 Oracle ×3 + validator
  const built = buildOracleSlice(ctx, fam.packs, briefs, findings);
  run.slices.push({ agent: 'self.oracle (with findings)', prefixTokens: built.slice.estTokens.prefix, suffixTokens: built.slice.estTokens.suffix, model: built.slice.model });
  t = performance.now();
  const oracleCall = guardedCall(kshort, 'oracle', 'self.oracle');
  const o = await runOracleV2({ prisma, callGemini: oracleCall, informUsed: noInform, spentUsd: familySpend, maxSpendUsd: CAP_USD }, ctx, built.slice);
  lap('oracle', t);
  run.oracle = { status: o.status, gaps: o.gaps, withheld: o.withheld, output: o.output, calls: o.calls, spentUsd: o.spentUsd };
  if (!o.output) {
    run.status = `oracle ${o.status}`;
    return run;
  }

  // 7–8 Personalizer ×3 over the same Oracle document; its prefix warmed once
  const ctxFor = (pack: ProfilePack): SelfBuildContext => ({ ...ctx, sub: { ...ctx.sub, profile: pack }, stamps: { ...ctx.stamps, profileHash: pack.hash } });
  const packs = PROFILES.map((p) => ({ p, pack: buildProfilePack(p.src, AS_OF) }));
  const firstP = buildPersonalizerSlice(ctxFor(packs[0]!.pack), o.output);
  run.slices.push({ agent: 'self.personalizer', prefixTokens: firstP.slice.estTokens.prefix, suffixTokens: firstP.slice.estTokens.suffix, model: firstP.slice.model });
  storageEst += ((firstP.slice.estTokens.prefix + est(firstP.slice.system)) * STORAGE_USD_PER_MTOK_HOUR * TTL_HOURS) / 1e6;
  t = performance.now();
  const wp = await warmPrefixes([firstP.slice]);
  lap('warm.personalizer', t);
  run.warmed.push(...wp.map((w) => ({ agent: w.agent, name: w.name, ms: Math.round(w.ms), model: w.model })));
  t = performance.now();
  run.profiles = await Promise.all(
    packs.map(async ({ p, pack }) => {
      const c2 = ctxFor(pack);
      const ps = buildPersonalizerSlice(c2, o.output!);
      if (ps.slice.prefixHash !== firstP.slice.prefixHash) throw new Error('personalizer prefix differs between profiles');
      const spentNow = round6(spent);
      const r = await runPersonalizer({ prisma, callGemini: guardedCall(kshort, `personalizer.${p.id}`, 'self.personalizer'), informUsed: noInform, spentUsd: spentNow, maxSpendUsd: CAP_USD }, c2, ps.slice, ps.input, ctx.sub.windows?.strip ?? []);
      const raw = rawTexts.get(`personalizer.${p.id}:self.personalizer`) ?? '';
      const rawDoc = raw ? parsePersonalDoc(raw) : null;
      const row = callRows.find((c) => c.callId === `personalizer.${p.id}:self.personalizer` && c.kundli === kshort);
      const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
      const wordCounts: ProfileRun['wordCounts'] = {};
      for (const [id, c] of Object.entries(r.doc?.cards ?? {})) if (c) wordCounts[id] = { headline: wc(c.headline), body: wc(c.body.join(' ')) };
      const { ageYears: _a, ...packOut } = pack;
      return {
        id: p.id,
        label: p.label,
        pack: packOut,
        status: r.status,
        doc: r.doc,
        raw: rawDoc,
        cardStatus: r.cardStatus as Record<string, string>,
        gaps: r.gaps,
        scan: scanDoc(r.doc, pack.gender !== null, `${p.id}`),
        rawScan: scanDoc(rawDoc as never, pack.gender !== null, `${p.id}.raw`),
        datesOutside: datesOutside(r.doc, o.output!),
        finishReason: row?.finishReason ?? null,
        wordCounts,
      } satisfies ProfileRun;
    }),
  );
  lap('personalizers', t);

  // the ledger rows of every region created or adopted
  const names = [...new Set(run.warmed.map((w) => w.name).filter((n): n is string => Boolean(n)))];
  const rows = names.length ? await rawPrisma.llmCacheEntry.findMany({ where: { name: { in: names } }, select: { name: true, model: true, kundli_id: true, user_id: true, expires_at: true } }) : [];
  run.ledger = names.map((n) => {
    const r = rows.find((x) => x.name === n);
    return { name: n.replace(/^cachedContents\//, '').slice(0, 10) + '…', model: r?.model ?? '(no ledger row)', kundli: r?.kundli_id === kundliId, user: r?.user_id === userId, expires: r?.expires_at.toISOString() ?? '' };
  });
  run.status = 'ok';
  return run;
}

try {
  for (const kid of KUNDLIS) {
    try {
      runs.push(await runKundli(kid));
    } catch (e) {
      runs.push({ kundliId: kid.slice(0, 8), status: `failed: ${String((e as Error).message).slice(0, 300)}`, subGaps: [], ms: {}, slices: [], warmed: [], briefs: [], windowsDegraded: null, pressureSource: '', familyFindings: [], oracle: null, profiles: [], ledger: [] });
    }
  }
} finally {
  await rawPrisma.$disconnect().catch(() => undefined);
}
const wallMs = Math.round(performance.now() - tAll);

// ------------------------------------------------------------------------------------------------ outputs
const summary = {
  asOf: AS_OF,
  dry: DRY,
  wallMs,
  calls: callCount,
  spentUsd: round6(spent),
  storageEstUsd: round6(storageEst),
  refusals,
  blockedWrites,
  explicitCache: explicitCacheEnabled(),
  cacheStats: { ...cacheStats },
  env: { READING_EXPLICIT_CACHE: process.env.READING_EXPLICIT_CACHE ?? '(unset)', SELF_V2_BUILD: process.env.SELF_V2_BUILD, SELF_V2_PRESSURE_PULL: process.env.SELF_V2_PRESSURE_PULL },
  models: { reader: runs[0]?.slices[0]?.model ?? null, oracle: runs[0]?.slices.find((s) => s.agent === 'self.oracle')?.model ?? null, personalizer: getSelfPersonalizerModel() },
  caps: { oracleMaxOut: getSelfOracleMaxOutputTokens(), personalizerMaxOut: getSelfPersonalizerMaxOutputTokens() },
  prompts: { bundle: PROMPT_VERSION, oracle: `${SELF_V2_ORACLE_PROMPT} ${promptHash(SELF_V2_ORACLE_PROMPT)}`, personalizer: `${SELF_V2_PERSONALIZER_PROMPT} ${promptHash(SELF_V2_PERSONALIZER_PROMPT)}` },
  oracleCalls: ORACLE_V2_CALLS,
};
console.log(JSON.stringify({ ...summary, runs: runs.map((r) => ({ kundli: r.kundliId, status: r.status, ms: r.ms, slices: r.slices, subGaps: r.subGaps.length })) }, null, 1));

if (!DRY) {
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(`${RAW_DIR}/summary.json`, JSON.stringify(strip({ ...summary, calls: callRows }), null, 2), 'utf8');
  for (const r of runs) {
    writeFileSync(`${RAW_DIR}/${r.kundliId}-oracle.json`, JSON.stringify(strip({ kundli: r.kundliId, status: r.status, slices: r.slices, briefs: r.briefs, subGaps: r.subGaps, familyFindings: r.familyFindings, oracle: r.oracle }), null, 2), 'utf8');
    for (const p of r.profiles) writeFileSync(`${RAW_DIR}/${r.kundliId}-personalizer-${p.id}.json`, JSON.stringify(strip(p), null, 2), 'utf8');
  }
  writeFileSync(REPORT, renderReport(), 'utf8');
}
// the recycler hook was a no-op and the cache helper may hold timers: exit now
process.exit(0);

// ------------------------------------------------------------------------------------------------ report
function renderReport(): string {
  const L: string[] = [];
  const fmt = (d: string | null | undefined) => d ?? '—';
  L.push(`# Replay: Self board v2 (Oracle + Personalizer) as of ${AS_OF}`, '');
  L.push(
    `Wall ${(wallMs / 1000).toFixed(1)} s · ${callCount} model calls · cost $${round6(spent)} (tokens × \`priceFor\`, 2026-11-09 prices) + explicit-cache storage ≈ $${round6(storageEst)} (estimate, not in \`PRICES\`) · cap $${CAP_USD} / ${MAX_CALLS} calls, ${refusals.length} refusals`,
  );
  L.push(`Models: family readers ${summary.models.reader}, Oracle ${summary.models.oracle}, Personalizer ${summary.models.personalizer} · Oracle out cap ${summary.caps.oracleMaxOut}, Personalizer out cap ${summary.caps.personalizerMaxOut}`);
  L.push(`Prompts: bundle ${summary.prompts.bundle} · ${summary.prompts.oracle} · ${summary.prompts.personalizer}`);
  L.push(`Env: READING_EXPLICIT_CACHE=${summary.env.READING_EXPLICIT_CACHE} (from .env) · SELF_V2_BUILD=1 · SELF_V2_PRESSURE_PULL=0 · storage dry (blocked writes attempted: ${blockedWrites.length ? blockedWrites.join(', ') : 'none'})`);
  L.push(`Cache helper: ${JSON.stringify(summary.cacheStats)}`, '');
  L.push('<!-- ANALYSIS -->', '');
  L.push('## Stages (every model call)', '', '| kundli | stage | agent | call | model | wall ms | prompt | cached | out | thought | cost $ | worst-case $ | status | finish |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of callRows) L.push(`| ${c.kundli} | ${c.stage} | ${c.agent} | ${c.callId} | ${c.model} | ${c.wallMs} | ${c.promptTokens} | ${c.cachedTokens} | ${c.outputTokens} | ${c.thoughtTokens} | ${c.costUsd} | ${c.worstUsd} | ${c.status} | ${c.finishReason ?? ''} |`);
  if (refusals.length) L.push('', 'Refused by the cap:', ...refusals.map((r) => `- ${r}`));
  L.push('', '## Cached share of input per agent', '', '| agent | calls | prompt tokens | cached tokens | cached share | output | thought | cost $ | mean wall ms |', '|---|---|---|---|---|---|---|---|---|');
  const byAgent = new Map<string, CallRow[]>();
  for (const c of callRows) {
    const key = c.stage.startsWith('personalizer') ? 'self.personalizer' : c.agent;
    byAgent.set(key, [...(byAgent.get(key) ?? []), c]);
  }
  for (const [a, rows] of byAgent) {
    const s = (f: (c: CallRow) => number) => rows.reduce((n, c) => n + f(c), 0);
    const pt = s((c) => c.promptTokens);
    L.push(`| ${a} | ${rows.length} | ${pt} | ${s((c) => c.cachedTokens)} | ${pt ? ((100 * s((c) => c.cachedTokens)) / pt).toFixed(1) : '0'} % | ${s((c) => c.outputTokens)} | ${s((c) => c.thoughtTokens)} | ${round6(s((c) => c.costUsd))} | ${Math.round(s((c) => c.wallMs) / rows.length)} |`);
  }
  for (const r of runs) {
    L.push('', `## Kundli ${r.kundliId}… · ${r.status}`, '');
    L.push(`Step wall ms: ${Object.entries(r.ms).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    L.push(`Pressure inventory: ${r.pressureSource}; windows degraded: ${JSON.stringify(r.windowsDegraded)}`);
    L.push('', '| slice | model | prefix est tokens | suffix est tokens |', '|---|---|---|---|', ...r.slices.map((s) => `| ${s.agent} | ${s.model} | ${s.prefixTokens} | ${s.suffixTokens} |`));
    L.push('', '| warmed region | model | name | ms |', '|---|---|---|---|', ...r.warmed.map((w) => `| ${w.agent} | ${w.model} | ${w.name ? 'created/adopted' : 'none (refused or below minimum)'} | ${w.ms} |`));
    L.push('', `Ledger rows (llm_cache_entries) for the regions: ${r.ledger.length ? r.ledger.map((x) => `${x.name} ${x.model} kundli=${x.kundli} user=${x.user} expires ${x.expires}`).join('; ') : 'none'}`);
    L.push('', `Area briefs: ${r.briefs.map((b) => `${b.areaId} (${b.claims} claims, ${b.dates} dates)`).join(', ')}`);
    L.push('', `Sub-technique gaps (${r.subGaps.length}):`, ...r.subGaps.map((g) => `- ${g}`));
    L.push('', `Family findings: ${r.familyFindings.map((f) => `${f.family} ${f.chars} chars`).join(', ')}`);
    if (r.oracle) {
      L.push('', `### Oracle validator: ${r.oracle.status} · withheld ${r.oracle.withheld.length ? r.oracle.withheld.join(', ') : 'none'} · gaps ${r.oracle.gaps.length}`, '', ...r.oracle.gaps.map((g) => `- ${g}`));
      const out = r.oracle.output;
      if (out) {
        L.push('', `Areas returned: ${Object.keys(out.doc.areas).join(', ')} · patterns ${out.patterns.length} · valid until ${out.doc.validUntil}`);
        L.push('', '### Oracle document (Chart details register)', '');
        for (const [id, a] of Object.entries(out.doc.areas)) {
          if (!a) continue;
          L.push(`#### ${id}`, '', `**${a.headline}**`, '', ...a.paragraphs.flatMap((x, i) => [`[${id}.p${i + 1}] ${x}`, '']));
          if (a.dates.length) L.push('Dates:', ...a.dates.map((d) => `- ${d.from} → ${d.to}: ${d.label}`), '');
          if (a.actions.length) L.push('Do:', ...a.actions.map((x) => `- ${x.from} → ${x.to}: ${x.text}`), '');
          L.push(`Certainty ${a.certainty} · valid until ${a.validUntil} · evidence ${a.evidence.join(', ')}`, '');
        }
        if (out.patterns.length) L.push('Patterns:', ...out.patterns.map((p) => `- (${p.areaId}) ${p.behaviour} — ${p.mechanism} (${fmt(p.since)} → ${fmt(p.until)})`), '');
      }
    }
    for (const p of r.profiles) {
      L.push('', `### Profile ${p.id}: ${p.label}`, '');
      L.push(`Pack: band ${p.pack.ageBand}, gender ${p.pack.gender ?? 'not stated'}, reader ${p.pack.role}, facts ${JSON.stringify(p.pack.facts)} · status ${p.status} · finish ${p.finishReason ?? '—'}`);
      L.push(`Card status: ${Object.entries(p.cardStatus).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
      L.push(`Validator gaps (${p.gaps.length}):`, ...p.gaps.map((g) => `- ${g}`));
      L.push(`Scan of the validated hero and cards (${p.scan.length} hits):`, ...p.scan.map((h) => `- ${h.where}: ${h.kind} "${h.match}" in "${h.text}"`));
      L.push(`Scan of the raw model output before the validator (${p.rawScan.length} hits):`, ...p.rawScan.slice(0, 40).map((h) => `- ${h.where}: ${h.kind} "${h.match}"`));
      if (p.rawScan.length > 40) L.push(`- … ${p.rawScan.length - 40} more`);
      L.push(`Dates outside the Oracle document: ${p.datesOutside.length ? p.datesOutside.join('; ') : 'none'}`);
      const d = p.doc;
      if (!d) continue;
      const h = d.hero;
      L.push('', `#### Hero (${h.tone}${h.withheld ? ', WITHHELD' : ''})`, '', `**${h.sentence}**`, '', h.sub || '(no sub line)', '', `Question: ${h.question ? `${h.question.text} (${h.question.claimId})` : 'none'} · eases ${fmt(h.easesAt)} · next check ${fmt(h.nextCheck)} · strip ${h.strip.length} rows`);
      for (const [id, c] of Object.entries(d.cards)) {
        if (!c) continue;
        const wcs = p.wordCounts[id];
        L.push('', `#### ${id} · ${p.cardStatus[id] ?? '—'} · certainty ${c.certainty} · ${wcs ? `${wcs.headline} / ${wcs.body} words` : ''}`, '', `**${c.headline}**`, '', ...c.body.flatMap((x) => [x, '']));
        if (c.patterns.length) L.push('Patterns:', ...c.patterns.map((x) => `- ${x.kind}: ${x.text} (${fmt(x.since)} → ${fmt(x.until)})`), '');
        if (c.ladder) L.push('Ladder:', `- best: ${c.ladder.best}`, `- practical: ${c.ladder.practical}`, `- drift: ${c.ladder.drift}`, `- floor: ${c.ladder.floor}`, '');
        if (c.dates.length) L.push('Dates:', ...c.dates.map((x) => `- ${x.from} → ${x.to}: ${x.label}`), '');
      }
      const missing = Object.keys(r.oracle?.output?.doc.areas ?? {}).filter((a) => !d.cards[a as keyof typeof d.cards]);
      if (missing.length) L.push('', `Cards missing for Oracle areas: ${missing.join(', ')}`);
    }
  }
  L.push('', `Raw JSON: \`${RAW_DIR}/\` (summary.json, <kundli>-oracle.json, <kundli>-personalizer-<a|b|c>.json; no names, birth data, places or coordinates).`);
  return L.join('\n');
}

