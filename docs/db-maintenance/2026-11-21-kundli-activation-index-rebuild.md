# 2026-11-21 · Rebuild the three indexes of `kundli_activation`

- **Database:** Render Postgres (staging), PostgreSQL 18.6, 5 GB disk.
- **Approved by:** Sachin, 2026-11-21 ("Yes do it but tell me what you're doing exactly and lay it out in MD file").
  First asked on 2026-11-19.
- **Run by:** the dev session (Claude), from the dev machine, over `DIRECT_URL`.
- **Status:** done on 2026-11-21 (03:12–03:14 UTC on 22 Nov). All three rebuilt with `CONCURRENTLY`; the fallback was not needed.

## Why

`kundli_activation` holds one row per dasha period per chart (281,397 rows for 6 charts). Its rows take 78 MB and its
three indexes take 282 MB. Indexes on this many rows should take about 55 MB (estimate). The extra is left over from
the way the table is written: every digest rebuild deletes a chart's rows and inserts them again
(`src/reading/digest/build.ts:1768-1802`), and on 2026-11-09 a backfill did that for every chart. A deleted row's index
entry is not handed back to the disk, so the index files only grow.

What it costs today:
- About 47 MB of each chart's 88 MB is index. The disk guard counts it, so fewer charts fit.
- The guard's "bytes per dasha row" figure is inflated by the same amount, so it refuses bulk writes earlier than it
  needs to.

A rebuild writes each index again from the rows that exist, then drops the old file.

## What is rebuilt

| Index | Columns | Size before | Used for |
|---|---|---|---|
| `idx_kundli_activation_range` | `kundli_id, from_date, to_date` | 85.4 MB | periods running on a date |
| `idx_kundli_activation_level_range` | `kundli_id, level, from_date, to_date` | 98.5 MB | the same, by dasha level |
| `kundli_activation_pkey` | `id` (primary key) | 98.4 MB | row identity |

A fourth index, `idx_kundli_activation_houses`, was dropped on 2026-11-19 (migration M55) because nothing used it.
No code refers to any of these indexes by name.

## Before (measured 2026-11-21, read only)

| Measure | Value |
|---|---|
| Rows | 281,397 (0 dead) |
| Table rows on disk | 77.8 MB |
| Indexes | 282.4 MB |
| Table total | 360.3 MB |
| Database | 531.8 MB |
| All three indexes valid and ready | yes |
| Leftover half-built indexes (`…_ccnew`, `…_ccold`) | none |
| Other sessions | 1, idle; no lock on the table |
| The connecting role owns the table | yes (`aiastradb_user`) |
| Disk room for the copies | needs about 55 MB at most (one index at a time, about 20 MB each); the 70 % line is 3,758 MB |

## The statements, in order

Run from one session on `DIRECT_URL` (one connection, so session settings hold), each as its own statement outside any
transaction, smallest and least critical index first. Each is checked before the next one starts.

```sql
SET statement_timeout = 0;            -- this session only: a rebuild must not be cut off
SET lock_timeout = '10s';             -- this session only: give up rather than queue behind a long lock

REINDEX INDEX CONCURRENTLY idx_kundli_activation_range;
REINDEX INDEX CONCURRENTLY idx_kundli_activation_level_range;
REINDEX INDEX CONCURRENTLY kundli_activation_pkey;

ANALYZE kundli_activation;            -- refresh the planner's statistics (approved 2026-11-19)
```

**What `CONCURRENTLY` means:** Postgres builds a new copy of the index beside the old one while the table stays open
for reads and writes, then swaps the two and drops the old one. Nothing is locked for more than an instant. The price
is that it takes longer and needs disk for the copy.

**The check after each statement** (read only):

```sql
SELECT c.relname, pg_relation_size(c.oid) AS bytes, i.indisvalid, i.indisready
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid
WHERE t.relname = 'kundli_activation';
SELECT relname FROM pg_class WHERE relname ~ '_cc(new|old)[0-9]*$';   -- must return no rows
```

## What can go wrong, and what is done then

| If | Then |
|---|---|
| A statement fails or is interrupted | The old index is untouched and still in use. Postgres may leave an invalid copy named `<index>_ccnew`. Drop only that copy (`DROP INDEX CONCURRENTLY <index>_ccnew;`), record it, and stop |
| The client refuses `CONCURRENTLY` ("cannot run inside a transaction block") | Stop. Fallback, used only for these three indexes on this staging database: plain `REINDEX INDEX <name>;`, one at a time. It locks writes to the table and reads through that index while it runs, a few seconds at this size. Recorded below if used |
| It waits on a lock longer than 10 seconds | The statement gives up by itself; nothing has changed. Try again when the other session is done |
| The digest sweep rewrites a chart's rows during the rebuild | Safe: a concurrent rebuild takes new and deleted rows into account. It may take a little longer |

There is nothing to undo after a success: the index definitions are unchanged, only their files are new. No migration,
no schema change, no code change, no deploy.

## Not done, on purpose

- No `VACUUM FULL` and no `CLUSTER`: both lock the table and rewrite it; the rows themselves (78 MB, 0 dead) are not
  the problem.
- No change to how the digest rebuild writes rows. That is the cause, and it is filed in `docs/TODOS.md`.
- No other table.

## After (measured right after the run)

| Index | Before | After | Time |
|---|---|---|---|
| `idx_kundli_activation_range` | 85.4 MB | 13.4 MB | 7 s |
| `idx_kundli_activation_level_range` | 98.5 MB | 15.1 MB | 13 s |
| `kundli_activation_pkey` | 98.4 MB | 15.9 MB | 14 s |
| `ANALYZE kundli_activation` | — | statistics refreshed | 5 s |

| Measure | Before | After |
|---|---|---|
| Indexes of the table | 282.4 MB | **44.4 MB** |
| Table total | 360.3 MB | 122.3 MB |
| Database | 531.8 MB | **293.8 MB** |
| Per chart (6 charts) | about 88 MB | **about 49 MB** |
| Charts that still fit under the 70 % line (3,758 MB) | about 35 | **about 70** |

- All three indexes are valid and ready. No `_ccnew` or `_ccold` index was left behind.
- Rows unchanged: 281,397, 0 dead. No schema, migration, code or deploy change.
- How it was run: a Node script with the Prisma client on `DIRECT_URL` with one connection, each statement sent alone
  through `$executeRawUnsafe`. `REINDEX … CONCURRENTLY` is accepted that way because no transaction is open. `psql`
  and the `pg` package are not installed on the dev machine and were not needed.

## Next time

- **The cause is still there, so the indexes will grow again.** Every digest rebuild deletes and re-inserts a chart's
  rows. Check again when the indexes pass **1.5 times the size of the rows** (today 44 MB against 78 MB, a ratio of
  0.6; before the rebuild it was 3.6). The check is one read-only query:
  `SELECT pg_indexes_size('kundli_activation')::float / pg_relation_size('kundli_activation');`
- The real fix is to stop rewriting rows that did not change (filed in `docs/TODOS.md`).
- The same steps work as they are: pre-checks, one index at a time on `DIRECT_URL`, the check after each, `ANALYZE`
  last. At this size the whole run takes under a minute.
- The disk guard measures "bytes per dasha row" from this table's total size, so its estimates dropped with the
  rebuild; nothing needs changing there.
