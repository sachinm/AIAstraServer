# GEMINI.md — Gemini & Antigravity Agent Rules for AIAstra_Server

All instructions in [`AGENTS.md`](./AGENTS.md) and [`SOUL.md`](./SOUL.md) apply to every session in this repository.

## Mandatory Design Rules

1. **Environment-Driven Selections & Rule Lists (`src/config/env.ts`)**:
   - Store configurable astrological and operational selections, rule lists, horizons, reference timezone coordinates, and thresholds in environment variables read through `src/config/env.ts` (with sensible defaults) rather than hardcoding them inside feature modules.
   - Examples: `LUCKY_HORIZON_DAYS`, `LUCKY_PREPULL_DAYS`, `LUCKY_REFERENCE_PLACES`, `LUCKY_YOGA_FAVOUR`, `LUCKY_YOGA_AVOID`, `LUCKY_KARANA_AVOID`, `LUCKY_KARANA_FAVOUR`, `LUCKY_FIXED_KARANA_AVOID`, `LUCKY_FIXED_KARANA_FAVOUR`, `LUCKY_AMRITA_SIDDHI_ENABLED`, `DIGEST_VERSION`, `DIGEST_SWEEP_MAX_MS`, `DIGEST_ANNUAL_MAX_CALLS`.
2. **Deterministic Digest & Universal Prepull (Zero AI Where Deterministic)**:
   - Never use an LLM/AI model for work that is deterministic over engine tables (such as `kundli_digest`, `kundli_activation`, or the 2–4 week universal Lucky Times `day_tables` prepull across the 5 reference timezones and personal overlay).
3. **Local Server Teardown**:
   - Any local server process (`node`, `tsx`, `vite`, `npm run dev`) started for verification MUST be terminated immediately after testing completes.
