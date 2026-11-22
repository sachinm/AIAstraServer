# Database maintenance records

One file per maintenance action on the Postgres database (Render, staging), named `YYYY-MM-DD-<what>.md`. Read the
latest record for the same table before doing the next one.

Each record states: why, who approved it and when, the state before, the exact statements in the order they ran, what
could go wrong and how it would be undone, the state after, and what to do differently next time.

## Rules for any maintenance action

1. **Sachin's yes first**, for the named action. A yes for one action does not cover another.
2. **Write the record before running anything**, with the "Before" numbers measured the same day.
3. **Use `DIRECT_URL` (port 5432), never the pooler** (`DATABASE_URL`, port 6432): the pooler shares connections between
   transactions, and maintenance statements need one session of their own.
4. **One statement at a time, checked before the next.** No statement that rewrites a whole table (`VACUUM FULL`,
   `CLUSTER`, `ALTER TABLE … SET`) without its own yes: those lock the table and need as much free disk again.
5. **Check the disk first, by hand.** A rebuild writes a full new copy before the old one is dropped. Measure the
   database size (`pg_database_size`) and the size of what is being copied, and stop if the two together would pass
   70 % of the disk (5 GB on staging). This is a check the person running the action makes: the code's disk guard was
   removed on 2026-11-22 on Sachin's instruction, so nothing in code stops a write when the disk is nearly full.
6. **Never print the database URL or any value from `.env`.**
7. **File what you find** in `docs/TODOS.md`.

## Records

| Date | Action | Record |
|---|---|---|
| 2026-11-21 | Rebuild the three indexes of `kundli_activation` | [2026-11-21-kundli-activation-index-rebuild.md](2026-11-21-kundli-activation-index-rebuild.md) |
