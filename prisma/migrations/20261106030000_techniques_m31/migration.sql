-- M31 (docs/reading-engine/53 §3, §4.3): a technique is a contract. `selectors` says when the clarify context picks it,
-- `contract` what it reads, in which layout, under which prompt, and what it returns; `techniques` on a trace lists the
-- ids a query selected.
ALTER TABLE technique_registry
  ADD COLUMN IF NOT EXISTS selectors jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract jsonb NOT NULL DEFAULT '{}';
ALTER TABLE reading_traces
  ADD COLUMN IF NOT EXISTS techniques jsonb;
