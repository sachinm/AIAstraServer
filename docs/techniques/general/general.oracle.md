# Technique Specification: Oracle and Synthesizer (`general.oracle`)

**Technique ID:** `general.oracle`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 enriched brief & multi-system grounding ready)  
**Owning Code Path:** `src/reading/oracle/flow.ts`; `src/reading/run.ts` (`synthesize`); `src/reading/prompts/oracle/system.md`  
**Agent ID:** `reading.oracle`, `reading.synth` (subagents: `oracle`, `addendum`, `synthesize`; downstream validator: `general.validator`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.oracle` is the final synthesis engine of the General Reading (Chat) pipeline across both the Oracle flow (`R01..R14`, `P1..P3` readers) and the Graph/Single flow (`general.promise`, `general.dasha`, `general.annual`, `general.transit`, `general.nakshatra`, `general.prashna`, plus deterministic code readers `general.varga_dynamics`, `general.strength_yoga`, `general.jaimini`, `general.person`, and planned `general.jaimini_karakamsha` / `general.sudarshana_chakra`). It reconciles all `findings.v2` claims, cited `DigestView` rows, and confirmed `person_facts` into a streaming, personalized, zero-jargon markdown answer (`answer.markdown`), followed by an optional addendum if `general.validator` detects an unanswered aspect.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` enhance `general.oracle` indirectly through enriched upstream `findings.v2` briefs and directly through cited `DigestView` rows:

- **Unified 23-Varga & Strength Grounding (Gaps R2, R3, H6):**
  - With `SERVED_VARGAS` expanded to all 23 vargas (`D1..D60`) and `strength.bhava`, `strength.vimsopaka`, and `strength.harsha` served, cited `DigestView` rows passed to `general.oracle` carry complete divisional house placements (`house: 1..12`), Vimsopaka scores, Bhava Bala ranks, and Harsha Bala stamina—eliminating vague hedges caused by missing `house: null` fields.
- **Unblocked Tithi Pravesha `yearLord` & Annual Vargas (Gaps R1 & R4):**
  - Eliminates `stance = 'get_through'` fail-closed collapses in `dashaAssessment.ts` and feeds accurate `TP D1/D9/D10` `yearLord` and return panchanga context into near-term answers.
- **Transit Ashtakavarga, Gochara Vedha, Murti Nirnaya & 2027–2036 Contacts (Gaps R5, H1, H2, H5):**
  - Provides `general.oracle` with reconciled transit findings that already account for Kakshya bindus and Vedha obstructions, preventing contradictory prose between Dasha and Transit layers.
- **Sudarshana Chakra, Karakamsha & Compatibility Synastry (Gaps R6, H3, H4):**
  - Adds 3-wheel conviction signals (`general.sudarshana_chakra`), soul-vocation anchors (`general.jaimini_karakamsha`), and couple synastry scores (`compatibility`) into the findings brief when relevant to the user's question.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:1081`):**
  `[]` (consumes upstream reader/analyst findings and cited `DigestView` rows rather than querying raw chart tables directly).
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('findings', 'every finding of the readers or analysts of this query, with the digest rows they cite', 'findings_in')` — columns: `technique`, `claim`, `evidence`, `polarity`, `weight`, `about`.
  - `inp('text', 'the question, the history of the thread, the clarify turns', 'text_in')`
- **Contract Output Schema:** `'answer.markdown'` (`system: 'src/reading/prompts/oracle/system.md'`, `user: ['TODAY', 'SUBJECT', 'FRAME', 'HORIZON', 'REAL_WANT', 'QUESTION', 'FACTS', 'TEMPLATE']`, `synthesizer: 'general.validator'`).
- **Oracle Synthesis Payload (`findings_in` -> `answer.markdown`):**
  - Joins all `findings.v2` rows, resolves cited digest keys (`by key`), merges confirmed `person_facts` (never declined topics), and streams the 4-tier behavioral guidance (`SOUL.md`: Sattvic / Rajasic / Mediocre / Baseline) anchored in verified claims.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Pre-Run Warmup (`general.clarify`):** `prewarmOracleReaders` / `prewarmNatalLayers` warms `FullContext` in `llm_cache_entries` and pre-populates `reading_findings_cache` + `technique_outputs`.
  2. **Join & Brief Assembly (`runOracleFlow` / `synthesize`):** Collects finished `findings.v2` from parallel readers (`R01..R14`, `P1..P3`) or graph analysts + code readers within the join deadline, attaches cited `DigestView` rows, and invokes `general.oracle`.
  3. **Streaming & Validation (`general.validator`):** Streams `answer.markdown` to the client; `general.validator` runs `< 5 ms` rule checks + `<= 2 s` model check and triggers at most one addendum/loop-back if required.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts:43, 69, 94`):**
  - `agentIdOf('oracle' | 'synth' | 'synthesize' | 'addendum')` -> `'reading.oracle'` (and `'reading.synth'` in registry).
  - `techniqueIdOf('oracle')` -> `'general.oracle'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (`oracle` / `synth`) and `'model_call'`.
- **Execution Boundary & Runtime Limits:**
  - Interactive streaming TTFT optimized via cached `parts[0]` prefix and parallel pre-warmed findings (`<= 10 s` total AI budget).
  - Zero Node astrology and zero raw `kundli_data` DB pulls inside `general.oracle`.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Delivers crisp, empathetic, person-specific answers addressing the exact situation (`REAL_WANT`) using `person_facts`, offering actionable next steps across clear date windows without fatalism.
- **Jargon Redaction Rules:**
  - Strictly prohibited in `answer.markdown`: All Sanskrit/astrological terms unless the user explicitly requested technical details, and **absolute zero-tolerance prohibition** on internal engine/library names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) enforced by `SOUL.md` and `general.validator`.
  - Declined topics (`declined_topics` table) are never facilitated or echoed.
- **Evidence Array Encapsulation:**
  - Underlying claim grounding (`grounding: json`) and cited `evidence[]` keys are stored in `ReadingRun` and surfaced cleanly if the user inspects reading details.
- **One-Tap "Chart Details":** Displays the verified key takeaways and grounded chart drivers behind the answer.
- **Single Past-Event Calibration Question:** Handled upstream by `general.clarify` before `general.oracle` synthesizes predictions, or offered as a single natural confirmation check at the end of a retrospective point.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:379–422`):**
  - `usesLlmCache: true`, `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - `parts[0]` carries `FullContext.prefix` (or cited `DigestView` rows + natal reader brief, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`); `parts[1]` carries `TODAY`, `QUESTION`, `REAL_WANT`, `FACTS`, and dynamic horizon findings.
- **Findings & Output Persistence:**
  - Question-scoped streaming response (`primaryTable: 'request_ephemeral'`), persisted to chat thread `Message` (`question`, `ai_answer`) and `ReadingRun` (`answer`, `grounding`, `findings`).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; live invocations call `informIndividualCacheUsed({ userId, kundliId })`; `recycleIndividualCaches` cleans up Gemini `cachedContents` and `llm_cache_entries` after `READING_CACHE_RECYCLE_MINUTES` (`45`) of inactivity.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `Message`, `ChatLog`, `ReadingRun`, `ReadingAgentResponse`, `ReadingFindingsCache`, and `TechniqueOutput` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
