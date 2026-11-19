-- M55: drop the GIN index on kundli_activation.houses.
-- It had 0 scans since the stats began (checked 2026-11-19); no query filters on houses.
-- Re-add it with the query that needs it (TODOS: chapter theme check).
DROP INDEX IF EXISTS "idx_kundli_activation_houses";
