/**
 * npm run eval:readings -- --chart G1 --questions all|Q1,Q2 --engine phase1|graph [--fake] [--out evals/reports/<date>] [--as-of 2026-10-24]
 *
 * Runs the golden questions through the reading engine on the golden chart (fixtures), then scores each answer:
 *   grounding (prose assertions vs the dossier: contradicted must be 0), method coverage (pack ids + required mentions),
 *   window sanity, format compliance, scope rules (no remedies / amounts / lottery caveat), latency, tokens, cost.
 *
 * Real runs need GEMINI_API_KEY (free tier: ~20 calls/day, so run a few questions at a time with --questions Q2,Q8,Q9).
 * `--fake` swaps in a local fake Gemini so the harness itself can be exercised offline; a FAKE report is never valid for a gate.
 * `--engine current` (the legacy path) needs a database and is reported as blocked here.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { clearReadingCaches } from '../src/reading/data/store.js';
import { checkAnswer, checkWindows } from '../src/reading/grounding/checker.js';
import { horizonRange } from '../src/reading/packs/frames.js';
import { buildEvidencePack, mergeSubjectPacks, resolveEvidence } from '../src/reading/packs/selector.js';
import { runReading } from '../src/reading/run.js';
import { loadG1Dossier, loadG1Transits } from '../tests/helpers/readingFixtures.js';
import { startFakeGemini } from '../tests/helpers/fakeGemini.js';
import { AMOUNT_RE, GOLDEN, REMEDY_RE, type GoldenQuestion } from './questions.js';
import { legacyTokenEstimate } from './baseline.js';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const WORD_CAP: Record<string, number> = { direct: 250, timeline: 450, factor_table: 450, narrative: 700, watchlist: 300 };

function wordsOutsideTables(text: string): number {
  return text
    .split('\n')
    .filter((l) => !l.trim().startsWith('|'))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function firstParagraphSentences(text: string): number {
  const first = text.trim().split(/\n\s*\n/)[0] ?? '';
  return (first.match(/[.!?](\s|$)/g) ?? []).length;
}

export interface QuestionReport {
  id: string;
  question: string;
  intent: { subjects: string[]; horizon: unknown; format: string; source: string };
  flow: string;
  answerWords: number;
  grounding: { checked: number; verified: number; contradicted: number; unverifiable: number; contradictions: Array<{ claim: string; expected?: string; sentence: string }> };
  coverage: { score: number; missingPackIds: string[]; missingMentions: string[] };
  windows: { found: number; insideHorizon: number; outside: string[] };
  format: { expected: string; chosen: string; ok: boolean; problems: string[] };
  scope: { remedies: boolean; amounts: boolean; forbidden: string[]; caveatOk: boolean | null };
  latency: { totalMs: number; ttftMs: number | null; firstTokenFromStartMs: number | null; synthMs: number | null; intakeMs: number };
  tokens: { prompt: number; cached: number; output: number; thought: number; packApprox: number };
  costUsd: number;
  droppedClaims: number;
  errors: number;
  finishReason: unknown;
  pass: boolean;
}

async function main(): Promise<void> {
  const engine = arg('engine', 'phase1')!;
  const asOf = arg('as-of', '2026-10-24')!;
  const fake = has('fake');
  const date = new Date().toISOString().slice(0, 10);
  const out = arg('out', path.join('evals', 'reports', `${date}${fake ? '-fake' : ''}`))!;
  const wanted = (arg('questions', 'all') ?? 'all').split(',').map((s) => s.trim());
  const chosen = GOLDEN.filter((q) => wanted.includes('all') || wanted.includes(q.id));

  if (engine === 'current') {
    console.error('engine=current runs the legacy path, which needs DATABASE_URL and a stored kundli: blocked on this machine. See evals/baseline/README.md.');
    process.exit(2);
  }

  let fakeServer: Awaited<ReturnType<typeof startFakeGemini>> | null = null;
  if (fake) {
    fakeServer = await startFakeGemini({ chunkDelayMs: 2 });
    process.env.GEMINI_API_URL = fakeServer.url;
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'fake-key';
  } else if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error('GEMINI_API_KEY is not set: the real eval is blocked. Use --fake to exercise the harness offline.');
    process.exit(2);
  }
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_ENGINE = '1';
  const flow = engine === 'graph' ? 'graph' : 'single';

  const dossier = loadG1Dossier();
  const transits = loadG1Transits();
  const prisma = {} as unknown as PrismaClient;
  mkdirSync(path.join(out, 'answers'), { recursive: true });

  const reports: QuestionReport[] = [];
  for (const q of chosen) {
    clearReadingCaches();
    const chunks: string[] = [];
    const tStart = Date.now();
    let firstDeltaAt: number | null = null;
    const res = await runReading(prisma, 'eval-G1', q.question, {
      asOf,
      flow,
      onDelta: (d) => {
        if (firstDeltaAt === null) firstDeltaAt = Date.now();
        chunks.push(d);
      },
    });
    const answer = res.answerText;
    const r = scoreQuestion(q, res, answer, dossier, transits, asOf, firstDeltaAt === null ? null : firstDeltaAt - tStart);
    reports.push(r);
    writeFileSync(path.join(out, 'answers', `${q.id}.md`), `# ${q.id}: ${q.question}\n\n${answer}\n`);
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${q.id} contradicted=${r.grounding.contradicted} coverage=${r.coverage.score.toFixed(2)} total=${r.latency.totalMs}ms firstToken=${r.latency.firstTokenFromStartMs ?? '?'}ms prompt=${r.tokens.prompt}`);
  }

  const baseline = legacyTokenEstimate();
  const summary = summarize(reports, baseline, { engine, flow, fake, asOf, model: process.env.GEMINI_FLASH_MODEL_ID ?? 'default' });
  writeFileSync(path.join(out, 'report.json'), JSON.stringify({ meta: summary.meta, baseline, totals: summary.totals, questions: reports }, null, 2));
  writeFileSync(path.join(out, 'summary.md'), summary.markdown);
  console.log(`report: ${path.join(out, 'summary.md')}`);
  if (fakeServer) await fakeServer.close();
}

function scoreQuestion(q: GoldenQuestion, res: Awaited<ReturnType<typeof runReading>>, answer: string, dossier: ReturnType<typeof loadG1Dossier>, transits: ReturnType<typeof loadG1Transits>, asOf: string, firstTokenFromStartMs: number | null): QuestionReport {
  const rec = res.record;
  const intent = rec.intent;
  const packs = intent.subjects.slice(0, 3).map((s) => buildEvidencePack({ dossier, transits, subject: s.id, asOf, intent }));
  const pack = mergeSubjectPacks(packs);

  const missingPackIds = q.packMustHave.filter((id) => resolveEvidence(pack, id) === undefined);
  const missingMentions = q.proseMustMention.filter((m) => !m.re.test(answer)).map((m) => m.label);
  const coverageTotal = q.packMustHave.length + q.proseMustMention.length;
  const coverageScore = coverageTotal === 0 ? 1 : (coverageTotal - missingPackIds.length - missingMentions.length) / coverageTotal;

  const g = checkAnswer(answer, dossier, transits, asOf);
  const hz = horizonRange(intent.horizon, asOf);
  const w = checkWindows(answer, hz);

  const problems: string[] = [];
  const words = wordsOutsideTables(answer);
  const cap = WORD_CAP[intent.format] ?? 450;
  if (words > cap * 1.25) problems.push(`words ${words} > cap ${cap}`);
  if (firstParagraphSentences(answer) > 5) problems.push('direct answer paragraph longer than 5 sentences');
  if (intent.format === 'timeline' && !/\|\s*Window\s*\|/i.test(answer)) problems.push('missing timeline table header');
  if (intent.format === 'factor_table' && !/\|\s*Factor\s*\|/i.test(answer)) problems.push('missing factor table header');
  if (intent.format === 'watchlist' && !/^\s*1[.)]/m.test(answer)) problems.push('missing numbered list');
  if (/!\[[^\]]*\]\(/.test(answer)) problems.push('contains an image');
  const formatOk = problems.length === 0;

  const remedies = REMEDY_RE.test(answer);
  const amounts = q.id === 'Q4' ? AMOUNT_RE.test(answer) : false;
  const forbidden = (q.forbid ?? []).filter((f) => f.re.test(answer)).map((f) => f.label);
  const caveatOk = q.requireCaveat ? q.requireCaveat.re.test(answer) : null;

  const usage = rec.usage;
  const prompt = usage.reduce((n, u) => n + u.promptTokens, 0);
  const cached = usage.reduce((n, u) => n + u.cachedTokens, 0);
  const output = usage.reduce((n, u) => n + u.outputTokens, 0);
  const thought = usage.reduce((n, u) => n + u.thoughtTokens, 0);
  const synth = rec.timingsMs.synthesize ?? null;
  const ttft = (res.responsePayload.timings_ms as Record<string, number> | undefined)?.firstTokenFromStart ?? null;

  const pass = g.contradicted === 0 && missingPackIds.length === 0 && formatOk && !remedies && !amounts && forbidden.length === 0 && caveatOk !== false && rec.errors.length === 0;
  return {
    id: q.id,
    question: q.question,
    intent: { subjects: intent.subjects.map((s) => s.id), horizon: intent.horizon, format: intent.format, source: rec.intakeSource },
    flow: rec.flow,
    answerWords: words,
    grounding: {
      checked: g.checked, verified: g.verified, contradicted: g.contradicted, unverifiable: g.unverifiable,
      contradictions: g.items.filter((i) => i.verdict === 'contradicted').map((i) => ({ claim: i.claim, expected: i.expected, sentence: i.sentence })),
    },
    coverage: { score: Math.round(coverageScore * 100) / 100, missingPackIds, missingMentions },
    windows: w,
    format: { expected: q.format, chosen: intent.format, ok: formatOk, problems },
    scope: { remedies, amounts, forbidden, caveatOk },
    latency: { totalMs: rec.timingsMs.total ?? 0, ttftMs: ttft, firstTokenFromStartMs: firstTokenFromStartMs, synthMs: synth, intakeMs: rec.timingsMs.intake ?? 0 },
    tokens: { prompt, cached, output, thought, packApprox: Number((res.requestPayload.pack as { approx_tokens?: number } | undefined)?.approx_tokens ?? 0) },
    costUsd: rec.costUsd,
    droppedClaims: rec.droppedClaims,
    errors: rec.errors.length,
    finishReason: res.responsePayload.finish_reason,
    pass,
  };
}

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}%` : 'n/a';
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
}

function summarize(rs: QuestionReport[], baseline: ReturnType<typeof legacyTokenEstimate>, meta: Record<string, unknown>) {
  const checked = rs.reduce((n, r) => n + r.grounding.checked, 0);
  const verified = rs.reduce((n, r) => n + r.grounding.verified, 0);
  const contradicted = rs.reduce((n, r) => n + r.grounding.contradicted, 0);
  const unverifiable = rs.reduce((n, r) => n + r.grounding.unverifiable, 0);
  const totals = {
    questions: rs.length,
    passed: rs.filter((r) => r.pass).length,
    checked, verified, contradicted, unverifiable,
    medianTotalMs: median(rs.map((r) => r.latency.totalMs)),
    medianFirstTokenMs: median(rs.map((r) => r.latency.firstTokenFromStartMs ?? 0)),
    medianPromptTokens: median(rs.map((r) => r.tokens.prompt)),
    medianPackTokens: median(rs.map((r) => r.tokens.packApprox)),
    meanCost: rs.length ? rs.reduce((n, r) => n + r.costUsd, 0) / rs.length : 0,
    cachedShare: (() => {
      const p = rs.reduce((n, r) => n + r.tokens.prompt, 0);
      return p ? rs.reduce((n, r) => n + r.tokens.cached, 0) / p : 0;
    })(),
  };
  const lines: string[] = [];
  lines.push(`# Reading eval report${meta.fake ? ' (FAKE model, harness check only, not valid for any gate)' : ''}`);
  lines.push('');
  lines.push(`Chart G1 (golden, fixtures), as of ${meta.asOf}, engine \`${meta.engine}\` (flow \`${meta.flow}\`), model \`${meta.model}\`.`);
  lines.push('');
  lines.push('## Headline');
  lines.push('');
  lines.push('| Metric | Value | Gate |');
  lines.push('|---|---|---|');
  lines.push(`| Questions passed | ${totals.passed}/${totals.questions} | all |`);
  lines.push(`| Assertions checked / verified / contradicted / unverifiable | ${checked} / ${verified} / ${contradicted} / ${unverifiable} | contradicted = 0, unverifiable <= 10% (${pct(unverifiable, checked)}) |`);
  lines.push(`| Median total latency | ${totals.medianTotalMs} ms | p50 not worse than baseline |`);
  lines.push(`| Median first answer token (from request start) | ${totals.medianFirstTokenMs} ms | < 10 s |`);
  lines.push(`| Median input tokens (model-reported) | ${totals.medianPromptTokens} | down >= 50% vs baseline |`);
  lines.push(`| Median evidence pack (estimated tokens) | ${totals.medianPackTokens} | |`);
  lines.push(`| Implicit cache share of input tokens | ${Math.round(totals.cachedShare * 100)}% | measured only |`);
  lines.push(`| Mean cost per question | $${totals.meanCost.toFixed(4)} | |`);
  lines.push('');
  lines.push('## Input tokens vs the legacy raw-JSON prompt (same chart, same estimator: characters / 3.6)');
  lines.push('');
  lines.push('| Prompt | Estimated input tokens |');
  lines.push('|---|---|');
  lines.push(`| Legacy lean (biodata, D-1, D-9, Vimshottari, chara karakas) | ${baseline.leanTokens} |`);
  lines.push(`| Legacy full (adds D-2, D-4, D-7, D-10, Narayana) | ${baseline.fullTokens} |`);
  lines.push(`| Reading engine evidence pack, median | ${totals.medianPackTokens} (+ ~${baseline.methodTokens} method/persona tokens, cached) |`);
  const lean = baseline.leanTokens;
  lines.push(`| Change vs lean | ${totals.medianPackTokens ? Math.round((1 - (totals.medianPackTokens + baseline.methodTokens) / lean) * 100) : 0}% fewer |`);
  lines.push(`| Change vs full | ${totals.medianPackTokens ? Math.round((1 - (totals.medianPackTokens + baseline.methodTokens) / baseline.fullTokens) * 100) : 0}% fewer |`);
  lines.push('');
  lines.push('## Per question');
  lines.push('');
  lines.push('| Id | Pass | Subjects | Format | Contradicted / checked | Coverage | Windows in horizon | Total ms | First token ms | Prompt tokens | Problems |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rs) {
    const problems = [
      ...r.format.problems,
      ...r.coverage.missingPackIds.map((i) => `pack missing ${i}`),
      ...r.coverage.missingMentions.map((m) => `no mention: ${m}`),
      ...(r.scope.remedies ? ['remedy language'] : []),
      ...(r.scope.amounts ? ['states an amount'] : []),
      ...r.scope.forbidden,
      ...(r.scope.caveatOk === false ? ['missing caveat'] : []),
      ...(r.errors ? [`${r.errors} node errors`] : []),
    ];
    lines.push(`| ${r.id} | ${r.pass ? 'yes' : 'NO'} | ${r.intent.subjects.join('+')} | ${r.format.chosen} | ${r.grounding.contradicted} / ${r.grounding.checked} | ${r.coverage.score} | ${r.windows.insideHorizon}/${r.windows.found} | ${r.latency.totalMs} | ${r.latency.firstTokenFromStartMs ?? '?'} | ${r.tokens.prompt} | ${problems.join('; ') || '-'} |`);
  }
  const contras = rs.flatMap((r) => r.grounding.contradictions.map((c) => ({ id: r.id, ...c })));
  if (contras.length) {
    lines.push('');
    lines.push('## Contradicted assertions (review each)');
    lines.push('');
    for (const c of contras) lines.push(`- ${c.id}: "${c.claim}" (chart says ${c.expected ?? '?'}): ${c.sentence}`);
  }
  lines.push('');
  lines.push('Human rubric (file 07 §4) is not scored here; answers are in `answers/`.');
  return { meta, totals, markdown: lines.join('\n') + '\n' };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
