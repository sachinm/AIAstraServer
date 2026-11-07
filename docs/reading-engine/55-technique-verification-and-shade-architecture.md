# 55 — Technique Verification, 3-Tier Unified Board Hierarchy & Shade Resolver Architecture

## 1. Start (System Today)

1. **`boardService.ts:124` & `houseLayers.ts:715` drop `level: 3` (`PD` / Pratyantardasha)**:
   - `boardService.ts:124` calls `activationFor(prisma, kundli.id, { ...span, houses: spec.cfg.houses, maxLevel: 2 })`, and `houseLayers.ts:715` unconditionally skips `if (g.row.level === 3) continue;`.
   - As a result, short timeframes (`7d` to `3m`) have no sub-sub-period (`PD`) timing resolution on the Self (`you`) and Love (`love`) boards.
2. **`career.ts` and `houseLayers.ts` use divergent pipelines**:
   - `career.ts` builds a month-cell timeline grid (`buildTimelineSpan`) with `workD10Check`, `workConditionalVote`, `workKarakaVote`, and `workAnnualVote`, while `houseLayers.ts` uses digest layers (`promise`, `affliction`, `protection`, `varga`, `nakshatra`, `activation`, `transit`, `annual`) without exposing unified 3-tier decision receipts or multi-signification shade disambiguation.
3. **Multi-Signification Houses (8th / 12th / 6th / 10th / 7th)**:
   - A single house activation (e.g., 12th house = foreign move vs quiet retreat vs sleep/expense; 8th house = research/depth vs sudden shock vs shared finances; 6th house = competitive win vs workload strain) needs deterministic multi-signification disambiguation (`ShadeResolver`) + Companion Pulse tie-breaker questions when two shades tie, while strictly keeping the **6 / 4 / 5 user-facing board cards** (`doc 45 §3.1`) and never exposing internal shade tags (`Hospital / ER`, `layoff_risk`, `separation_risk`, `trust_secrets`) or engine names (`Radha`, `pyjhora`, `jhora`).
4. **Technique Governance & Verification**:
   - Staff need a live `enabled` toggle and `verification_status` (`verified | calibrating | experimental | disabled`) on `technique_registry`, per-window `TechniqueDecisionReceipt` audit rows in `technique_decision_logs`, Calibration Ledger active goal pinning + window-end outcome check-ins, and a 10-chart AA-rated Celebrity Benchmark regression suite (`benchmark_charts`, `benchmark_events`).

## 2. End Goal

1. **Short-Horizon `PD` (`maxLevel: 3`) Resolution**:
   - `boardService.ts` fetches `maxLevel: 3` (`PD`) activations for the near `SHADE_SHORT_HORIZON_MONTHS` (`3m` default) window and merges them with the 30-year `maxLevel: 2` span; `houseLayers.ts` includes `level === 3` windows inside the short horizon.
2. **Unified 3-Tier Board & Shade Resolver (`src/reading/area/shadeResolver.ts`)**:
   - **Tier 1 (Natal Promise & Varga/Nakshatra Floor)**: Evaluates `promise`, `affliction`, `protection`, `varga`, and `nakshatra` gates.
   - **Tier 2 (Multi-Clock Convergence & Annual/Transit Gate)**: Evaluates `main`, `conditional`, `rasi`, `karaka`, `short`, `transit`, and `annual` family votes with Varga agreement (`D10` for Work, `D9` for Love/Self).
   - **Tier 3 (Multi-Signification Shade Resolver & Calm Behavioral Playbook)**: Scores candidate shades per sub-area using planet nature, karaka/lordship, varga dignity, saham/point support, and `person_facts` tie-breakers, attaches a Calm-style Behavioral Playbook (`Sattvic / Rajasic / Mediocre / Baseline` per `SOUL.md`) with `ease_date` (`YYYY-MM-DD`), and logs `TechniqueDecisionReceipt` rows into `technique_decision_logs` while keeping **1 `withAgentRun` per board build**.
3. **6 / 4 / 5 User-Facing Card Contract Preserved**:
   - User-facing boards retain the exact 6 / 4 / 5 card layout (`doc 45 §3.1`). Sub-areas and shades act strictly as internal tags and plain-English digested copy — internal risk tags (`layoff_risk`, `separation_risk`, `trust_secrets`, `Hospital / ER`) and engine names (`Radha`, `pyjhora`, `jhora`) never appear in user-facing strings.
4. **Companion Pulse Tie-Breakers, Calibration Ledger & Celebrity Benchmark Suite**:
   - When two shades for an active window are within the tie margin (`0.5`), `resolveShadeTieBreakQuestion` emits a single plain-English Companion Pulse question whose answer is stored in `person_facts` and breaks the tie (`applyPulseFactTieBreaker`).
   - Users can pin an active goal window (`pinActiveGoalWindow`) and record a window-end check-in (`recordWindowOutcomeCheckin`), feeding the Admin Technique Verification accuracy score alongside the 10-chart AA-rated Celebrity Benchmark suite.

## 3. Deliverable

- Migration `prisma/migrations/20261106080000_admin_m36_technique_governance_and_benchmarks/migration.sql` + `prisma/schema.prisma`.
- Env-driven thresholds in `src/config/env.ts` (`getShadeShortHorizonMonths`, `getShadeMinWinningScore`, `getShadeFactTieBreakBonus`, `getShadeConfirmMinFamilies`).
- `src/reading/area/shadeResolver.ts`: 3-tier hierarchy, `resolveAreaShades`, `resolveCareerShades`, `CalmPlaybook`, `TechniqueDecisionReceipt`, Companion Pulse tie-breakers, Calibration Ledger goal pinning & check-ins, and 10-chart Celebrity Benchmark suite.
- `src/reading/area/boardService.ts`, `src/reading/area/houseLayers.ts`, `src/reading/area/career.ts`, and `src/reading/area/careerService.ts` wired to `shadeResolver.ts` and `technique_decision_logs`.
- Unit & E2E tests in `tests/unit/reading/shadeResolverAndGovernance.test.ts`.
