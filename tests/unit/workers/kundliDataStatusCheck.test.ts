/**
 * Every status the code writes to `kundli_data` must be allowed by `kundli_data_status_check`. On 2026-11-17 the deep
 * dasha slot marker wrote `dispatched` / `queued` (and `deferred_disk`) against a check that allowed only
 * ready | fetching | failed | unsupported, and every write failed with Postgres 23514 (migration M54 widens it).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFERRED_DISK } from '../../../src/workers/dashaDeep.js';
import { SLOT_STATUSES } from '../../../src/workers/dashaDeepSlots.js';

const MIGRATIONS = join(process.cwd(), 'prisma', 'migrations');

/** the status list of the newest migration that (re)defines kundli_data_status_check */
function allowedStatuses(): string[] {
  const dirs = readdirSync(MIGRATIONS).filter((d) => /^\d{14}_/.test(d)).sort();
  for (const d of dirs.reverse()) {
    const sql = readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8');
    const m = /"kundli_data_status_check"[\s\S]*?CHECK\s*\(\s*"status"\s+IN\s*\(([^)]*)\)/i.exec(sql);
    if (m) return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
  }
  throw new Error('no migration defines kundli_data_status_check');
}

describe('kundli_data_status_check covers every status the code writes', () => {
  const allowed = allowedStatuses();

  it('the stored-row statuses', () => {
    for (const s of ['ready', 'fetching', 'failed', 'unsupported']) expect(allowed).toContain(s);
  });

  it('the deep dasha slot marker statuses and deferred_disk (M54)', () => {
    for (const s of SLOT_STATUSES) expect(allowed).toContain(s);
    expect(allowed).toContain(DEFERRED_DISK);
  });
});
