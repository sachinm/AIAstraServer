/**
 * docs/privacy/02 B1.3: raw SQL cannot be seen by the PII extension, so every file that runs `$queryRaw`,
 * `$executeRaw` (or their Unsafe forms) is on this reviewed list. A new file fails here until it is reviewed: if it
 * touches a sealed column it binds values through `sealParam` and reads rows through `openRow`/`openRows`
 * (src/lib/pii/rawSql.ts); if it does not, it is listed below with the reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** files that read or write a sealed column: they must import src/lib/pii/rawSql.ts */
const SEALING = [
  'src/reading/area/boardService.ts',
  'src/reading/chartData/prashna.ts',
  'src/reading/chartData/store.ts',
  'src/reading/timeline/ledgerStore.ts',
  'src/reading/timeline/store.ts',
  'src/reading/transits/ephemerisCache.ts',
  'src/services/userLocation.ts',
  'src/techniques/outputStore.ts',
];

/** files reviewed as touching no sealed column, and why */
const REVIEWED_PLAIN: Record<string, string> = {
  'src/agents/registry.ts': 'static agent catalogue metadata seed (agent_registry)',
  'src/auth/requestAuth.ts': 'session id and expiry lookup in app_sessions',
  'scripts/self-v2-replay.ts': 'dry-run guard only: names $executeRaw to block raw writes during the paid replay; runs no raw SQL',
  'src/reading/oracle/prewarm.ts': 'fallback DELETE on reading_findings_cache by plain kundli_id, user_id and timestamp columns only',
  'src/reading/run.ts': 'boolean capability check for techniqueOutput delegate; executes no raw SQL',
  'src/techniques/catalog.ts': 'static technique catalogue metadata seed (technique_registry)',
  'src/services/kundliSyncWorker.ts': 'sweeps select kundli ids by plain status, lock and timestamp columns only',
  'src/assistant/store.ts': 'public-page assistant log: no account, no personal table',
  'src/lib/dbCheck.ts': 'SELECT 1 at boot',
  'src/workers/dashaDeepSlots.ts': 'pg_advisory_xact_lock(constant) only; the marker count and write use the Prisma client',
  'src/reading/digest/diskGuard.ts': 'disk guard: pg_database_size(current_database()), pg_total_relation_size(kundli_activation) and count(*); sizes only, reads no row value',
  'src/reading/prompts/registry.ts': 'system prompt rows: no personal data',
  'scripts/check-assistant-store.ts': 'assistant log check script: no personal table',
  'scripts/self-v3-replay.ts': 'doc 68 replay: finds one test kundli id by prefix and swallows raw writes (storage dry); reads no sealed value',
  'scripts/clock-rows-check.ts': 'doc 70 Phase 1 check: database size and one test kundli id by prefix; reads no sealed value',
  'scripts/oracle-slice-sizes.ts': 'counts byte sizes of chart rows; reads no value (reviewed for B1; B4.2 reviews scripts again)',
};

const RAW = /\$(queryRaw|executeRaw)(Unsafe)?\b/;
const ROOTS = ['server.ts', 'kundli-rag.ts', 'src', 'scripts', 'supa', 'evals'];

function walk(p: string, out: string[]): void {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) if (e !== 'node_modules' && !e.startsWith('.')) walk(path.join(p, e), out);
  } else if (/\.(ts|mts|cts|js|mjs)$/.test(p) && !/\.test\./.test(p)) out.push(p);
}

const root = process.cwd();
const files: string[] = [];
for (const r of ROOTS) walk(path.join(root, r), files);
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');
const usingRaw = files.filter((f) => RAW.test(fs.readFileSync(f, 'utf8'))).map(rel).sort();

describe('raw SQL allow-list', () => {
  it('every file using raw SQL is reviewed', () => {
    const known = new Set([...SEALING, ...Object.keys(REVIEWED_PLAIN)]);
    expect(usingRaw.filter((f) => !known.has(f)), 'add the file to SEALING (and use sealParam/openRow) or REVIEWED_PLAIN').toEqual([]);
  });

  it('the list holds no stale entries', () => {
    const using = new Set(usingRaw);
    expect([...SEALING, ...Object.keys(REVIEWED_PLAIN)].filter((f) => !using.has(f))).toEqual([]);
  });

  it('every sealing file goes through src/lib/pii/rawSql.ts', () => {
    for (const f of SEALING) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src, f).toMatch(/from '(\.\.\/)+lib\/pii\/rawSql\.js'/);
      expect(src, f).toMatch(/\b(sealParam|openRow|openRows)\(/);
    }
  });

  it('src/lib/encrypt.ts has no importer left (B1.4); it is deleted in B5', () => {
    const importers = files.filter((f) => /from ['"][./]+(src\/)?lib\/encrypt(\.js)?['"]/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(importers).toEqual([]);
  });

  it('only src/lib/prisma.ts makes an app Prisma client (so every query passes the extension)', () => {
    const makers = files.filter((f) => f.includes(`${path.sep}src${path.sep}`) && /new PrismaClient\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(makers).toEqual(['src/lib/prisma.ts']);
  });
});
