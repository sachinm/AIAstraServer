-- M54 (2026-11-18): the deep dasha slot marker (src/workers/dashaDeepSlots.ts, 2026-11-09) writes `dispatched` and
-- `queued`, and src/workers/dashaDeep.ts writes `deferred_disk`. The M7 check allowed only ready | fetching | failed |
-- unsupported, so every slot write failed with 23514 (400+ `dasha_deep_sweep_invoke_failed` since 2026-11-17).
-- Widening only: every row the old check allowed still passes; no data is changed.
ALTER TABLE "kundli_data" DROP CONSTRAINT IF EXISTS "kundli_data_status_check";
ALTER TABLE "kundli_data" ADD CONSTRAINT "kundli_data_status_check"
  CHECK ("status" IN ('ready', 'fetching', 'failed', 'unsupported', 'dispatched', 'queued', 'deferred_disk'));
