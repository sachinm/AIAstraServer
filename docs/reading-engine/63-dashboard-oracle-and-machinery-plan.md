# 63 — The dashboard reading engine: family sub-agents, linemen, the Oracles, the cache, the cost, the Oracle workbench and the staging focus groups

Status: **plan, 2026-11-07 (night),** written on `develop` 46c241c for Sachin's brief of the same night. It covers the Self,
Love and Work dashboards as one machine. It does not change code; docs 58–62 (the Self build), 56–57 (pieces, validity
windows, prompt-cache upload), admin 09–10 (research staging, Techniques Lab) and `docs/product/you-board-synthesis-review.md`
are its inputs and stay as they are. Where this plan changes a decision of those docs it says so (§12).

Rules that bind every line below: the calculation engine is the only source of astrological values and is never named in
anything a person sees (SOUL.md §1); Node selects, joins, counts and formats, it derives nothing; no paid model call runs
before Sachin's yes on key, model, count and cost, and every phase states those numbers (§8); health is facts only, never a
diagnosis (doc 61 §3); a missing field drops a line and records a gap, never a substitute; every agent and technique is
registered and tagged (AGENTS.md, docs/admin/03); every sub-agent slices from the digest, passes `cachePrefix` and
`cacheOwner`, and stores its output (AGENTS.md).

## 0. Answer first

| # | Sachin's question | The answer |
|---|---|---|
| 0 | First | Make the current method work (§14, Phase 1): one-row loads under 300 ms, headers equal to lines, every stage a run, keys that invalidate on what changes, the recycler safe, the tone card retired, Work transits stored. $0. Then the model tier. |
| 1 | Are the techniques run by AI agents? | Today, no: the Self board is nine code panels over the digest, $0, no model. This plan adds three tiers of model agents over the same stored data: **five family sub-agents** (Rasi, Varga, Dasha, Year, Sky), each reading one pre-formatted pack and returning findings on afflictions, malefics, and what helps, delays or delivers the running mahadasha's promise; **one lineman per board** (Self, Love, Work) that joins the family findings into that board's claims; **one Oracle per board** that writes the dated cards. The code panels stay as the floor and the veto (§4.1). |
| 2 | What does a dashboard load cost? | **$0 and zero agents.** A load reads stored outputs. Money is spent only on a **build**, which happens on four triggers (new digest, the reading clock's sub-period boundary, a new year chart, a confirm answer) plus a manual lab run. A first build of all three boards for one person is about **$0.075** without the auditor and about **$0.26** with it on today's prices (§5). For 1,000 active people, about $300 a year without audit. Economical. |
| 3 | Cache everything | Six layers, each keyed by what can change it: engine rows (immutable per birth) → digest and activation calendar (per digest version) → **family packs** (pre-formatted text per family per person; natal packs open-ended, dasha/year/sky packs by their windows) uploaded once to the provider's prompt cache → **family findings** stored per pack hash and prompt version and fanned into every board → lineman briefs and Oracle cards stored per board with the shortest window of their inputs → one `board.bundle` row the page reads. Every common technique runs once per person per window; an advisory lock stops two builds running it twice (§4.1, §6). |
| 4 | How many Oracle types? | **One Oracle per board** (`oracle.self`, `oracle.love`, `oracle.work`) over a shared core prompt, with the per-panel specificity written as card-rule blocks inside the board's prompt. Not one for all boards (too general), not one per panel (thirty prompts, no whole-chart voice, ten times the calls). A fourth, `oracle.now`, comes in the day-grain phase (§7). |
| 5 | Oracle training | An **Oracle Studio** tab in the admin Techniques Lab: every ingredient the Oracle received as a tree, the prompt with its versions (`system_prompts` + `system_prompt_versions`, already versioned by trigger), replay of a stored dossier against a draft or a version, side-by-side compare diffed per card line, grading by the auditor and by hand, promotion of a version. Cards stay dated lines of at most 22 words; the validator enforces it on every replay (§4.3, §9). |
| 6 | Staging focus groups | The Research Lab's synthesized runs are replaced by a **Staging** side of the Techniques Lab: random births or AI-written personas → real engine pull → digest → family packs → the same build as production, writing to `research_*` tables, reviewed in the same tabs (§10). |
| 7 | Day-to-day for the Self | Phase 5 (§7): L3/L4 and the Moon's day over the natal Moon and lagna through the same family packs (Dasha and Sky gain day slices), a `lineman.now` and `oracle.now`, a Right-now strip, a per-day confirm. |
| 8 | Is "many small techniques" wrong? | **Many small code techniques are right; many small model techniques would be wrong.** Keep the deterministic panels (free, testable, the veto). Do not put a model behind each panel: the model tier is five family agents, one lineman and one Oracle per board, so the cost is bounded, the whole chart is read whole, and one family run feeds three boards (§11). |

## 1. Start: the system tonight (facts checked 2026-11-07 on `develop` 46c241c, the shared database and staging)

### 1.1 What produces each dashboard

| Board | Path today | Agents | Model | Cost per load | Measured |
|---|---|---|---|---|---|
| You, "Your reading" | `GET /api/self/reading` → `src/reading/self/service.ts getSelfReading` → nine code panels (`self.reading.{diagnosis,chapters,lagna,mind,body,atma,yogas,struggle,year}`) over `kundli_digest` + `kundli_activation` → `purview.ts` (10 rules) → `card.ts` → `audit.ts` (code half) → `dossier.ts` → `reading_dossiers` | `self.reading_panel` (code) | none | $0 | Sachin's kundli `c584c0a3`: 2.3–4.9 s wall from this machine even when all nine panels are cached; panel code itself under 20 ms. The time is round trips: digest load, two activation reads, nine `technique_outputs` reads, nine `agent_runs` writes, facts, sky, dossier lookup |
| You, model layer | `src/reading/self/oracle.ts runSelfOracle`: reader `R15-self.md` then `oracle/self.md`, validator by evidence keys | `self.reading_oracle` (llm, role `oracle`) | `modelFor('reader')`, `modelFor('oracle')` | not run | `SELF_READING_MODEL` unset; catalogue row `self.reading.oracle` is `planned`; the call passes no `cachePrefix`/`cacheOwner` and sends the brief twice (reader and Oracle) |
| You, older tabs | `boardService.getAreaBoard` → `houseLayers.buildBoard(SELF)`, `selfCharacterAndJoy.ts` | `area.self_board` (code) | none | $0 | phrase tables by integer votes; silent defaults (TODOS P1) |
| Love | `houseLayers.buildBoard(LOVE)`; `love.reading.*` are eight `planned` catalogue rows | `area.love_board` (code) | none | $0 | code board; barely used |
| Work | `careerService` career map (`work.*` nine built rows); `work.reading.*` are eight `planned` rows | `area.career_map` (code) | none | $0 | code board |

### 1.2 What exists to build on

| Piece | Where | State |
|---|---|---|
| Digest, six sections, 702 rows for `c584c0a3` (house 144, planet 207, point 325, yoga 23, annual 2, star 1); 43 dasha systems in `kundli_activation` (12,586 rows) | `src/reading/digest/`, `kundli_digest`, `kundli_activation` | built; rebuilt by the 15-minute sweep; `PointRow.planet` on karaka rows since 2026-11-07 |
| Validity windows and the output store | `src/techniques/pieces.ts`, `outputStore.ts withTechniqueOutput`, `technique_outputs` (M37) | built; key = technique, contract hash, kundli, digest version, window; `SELF_READING_VERSION` added to the Self key so code changes invalidate |
| Per-sub-agent digest slices and the pre-run upload | `src/reading/oracle/digestSlices.ts SUBAGENT_DIGEST_SPECS` (32 chat sub-agents), `src/techniques/subagentCachePlan.ts`, `src/reading/llm/promptCache.ts ensurePromptCache` (provider `cachedContents`, TTL `READING_EXPLICIT_CACHE_TTL_SECONDS` default 1,800 s), `llm_cache_entries`, `reading_findings_cache` | built for the chat flow; nothing for the boards |
| The 45-minute recycler | `src/reading/llm/cacheSweep.ts recycleIndividualCaches` (`READING_CACHE_RECYCLE_MINUTES` 45) | deletes `llm_cache_entries`, `reading_findings_cache`, **`technique_outputs`** and day overlays of idle kundlis |
| Prompt registry | `src/reading/prompts/registry.ts`: `system_prompts` (name, prompt, is_active, version, agent_role, prompt_type), `system_prompt_versions` by trigger, 60-s in-memory sync into `PROMPTS` | built; the Oracle prompts are rows (`oracle/self`, `readers/R15-self`, `readers/_shared`) |
| Model matrix and prices | `src/reading/llm/models.ts`: roles intake, specialist, synth, fast, reader, oracle, validator; `PRICES` for gemini-2.5-flash, 2.5-flash-lite, 2.0-flash, 3.1-flash-lite, 3.5-flash-lite, 3.8-flash, 3.6-flash, 3.1-pro-preview, 4-argon; `PRICE_CHANGES` 2026-12-01 (argon) and 2027-01-01 (3.8/3.6 flash) | built; every role falls back to `GEMINI_FLASH_MODEL_ID` (code default `gemini-2.0-flash`; live per docs `gemini-2.5-flash`) |
| Dossier, purview, code auditor, cards | `src/reading/self/{dossier,purview,audit,card}.ts`, `reading_dossiers` (M40) | built for Self; dossier has `oracle Json?` and `cost_usd` columns, empty |
| Admin Techniques Lab | server `src/routes/adminLabRoutes.ts` (`ADMIN_LAB=1`, `x-admin-lab-token`; people = every unlocked account with a kundli since tonight; run self only, love/work → `board_not_built`), admin `api/src/admin/lab.ts`, `web/src/pages/TechniquesLab.tsx` | deployed on staging; dossier viewer + run |
| Research Lab | admin `api/src/admin/researchLab.ts synthesizeAdminResearchRun` (seed templates); server `src/reading/research/selfDashboardQa.ts buildSelfResearchDashboard` (`synthesizeResearchDigestAndActivations`, deterministic), `src/routes/researchRoutes.ts` | runs are templates, not readings (admin doc 10 §1, TODOS P1); no path calls the engine for a research subject |
| Scenario files S1–S8 | `docs/reading-engine/scenarios/self/` | drafted; not hydrated |
| Chat readers R01–R14, P1–P3, `oracle/system.md`, validator, cost guard (`src/reading/oracle/costGuard.ts`) | `src/reading/prompts/readers/`, `src/reading/oracle/` | built; chat only |

### 1.3 Symptoms

| Symptom | Cause |
|---|---|
| A cached You page takes seconds | 20-odd round trips per request; no single bundle row (doc 60 step 14 not built) |
| Love and Work have no reading page | rows planned, code not written; shared `board.*` functions not yet filtered |
| No model has ever written a board | flag off, by rule; the prompt layer was designed as one reader + one Oracle over code claims, not as family agents |
| The Research Lab shows template text | `synthesizeAdminResearchRun` |
| A paid output, once made, would be deleted after 45 idle minutes | the recycler evicts `technique_outputs` by idleness, not by validity |

## 2. End goal

A person opens You, Love or Work and sees, in under 300 ms server time, dated cards (one to three lines each, at most 22
words a line, "Chart details" one tap down) written by that board's Oracle from findings five family agents made over their
chart, joined by that board's lineman, checked by the whole-chart purview, the card validator and the auditor. Nothing on the
page is older than its validity window and nothing is rebuilt that has not changed. The page costs nothing to open. A build
happens in the background on a trigger, costs cents, and leaves a dossier with every ingredient. Sachin can sit in the admin
Oracle Studio, read exactly what the Self Oracle received, change its prompt, replay the same dossier, compare the two sets of
cards line by line, grade them, and promote the version he prefers, within a daily budget. Staff can create a focus group of
synthetic people, run them through the real engine and the real build, and review their boards in the same tabs. What can no
longer go wrong: a model sentence without a row behind it; a date not in the calendar; the engine's name on a screen; a
diagnosis in the body card; two agents doing the same work in one load; a dashboard that costs money to open.

## 3. Deliverable

| Area | Ships |
|---|---|
| Family packs | `src/reading/families/packs/{rasi,varga,dasha,year,sky}.ts` (pure formatters over `DigestView`, `ActivationRow[]`, `TransitRangePayload`); five layouts in `src/techniques/layouts.ts` (`family_rasi_pack`, `family_varga_pack`, `family_dasha_pack`, `family_year_pack`, `family_sky_pack`); `packs/index.ts` (`buildFamilyPack`, `packHash`) |
| Family agents | `src/reading/families/run.ts` (`runFamily`: cache lookup → prompt-cache upload → call → code gate → store), prompts `src/reading/prompts/families/_family.md` + `{rasi,varga,dasha,year,sky}.md`; schema `family_findings.v1` in `src/reading/families/schema.ts` with the gate |
| Linemen | `src/reading/linemen/{self,love,work}.ts` (frame filter + brief assembly), prompts `src/reading/prompts/linemen/_lineman.md` + `{self,love,work}.md`; schema `lineman_brief.v1` |
| Oracles | `src/reading/oracles/run.ts`, prompts `src/reading/prompts/oracle/_core.md`, `self.md` (rewritten to cards), `love.md`, `work.md`; schema `board_reading.v1` (doc 61's `self_reading.v1` generalised); validator `src/reading/oracles/validate.ts` (card contract + evidence + dates + banned words) |
| Auditor | `src/reading/audit/model.ts` behind `READING_MODEL_AUDITOR`; prompt `oracle/auditor.md`; schema `audit.v1` (doc 60 §5) |
| Board build | `src/reading/board/build.ts` (`buildBoard(kundliId, board, trigger)`: bundle → code panels → packs → families → lineman → purview → Oracle → validator → auditor → writes); `src/reading/board/bundle.ts` (`board.bundle` row); `src/reading/board/triggers.ts` (event + sweep); `src/reading/board/locks.ts` (advisory locks) |
| Love and Work code panels | `src/reading/self/panels/*` generalised to `src/reading/board/panels/*` with a `BoardFrame` (`board.chapters`, `board.struggle`, `board.year`, `board.diagnosis`, `board.confirm` filtered per doc 59 §5); Love part panels `heart, partner, bond, circle`; Work part panels `vocation, standing, ground, gain`; word tables `DIAGNOSIS_LOVE`, `DIAGNOSIS_WORK`, `LOVE_WORDS`, `WORK_WORDS` |
| API | `GET /api/self/reading` gains `oracle`; new `GET /api/love/reading`, `GET /api/work/reading`, `POST /api/<board>/reading/confirm`; `POST /events` names `board-build`, `board-build-sweep`; admin-lab routes in §4.2 |
| Migrations (additive) | M41 `technique_outputs.made_by_kind text` ('code'/'llm') + `prompt_version text`; M42 `oracle_evals` (grades); M43 `research_cohorts` + `research_kundlis.persona jsonb`, `research_kundlis.cohort_id`; M44 `reading_dossiers.families jsonb`, `lineman jsonb`, `prompt_versions jsonb` |
| Env (`src/config/env.ts`, typed helpers, defaults) | `BOARD_MODEL_LAYER` (off), `READING_MODEL_FAMILY`, `READING_MODEL_LINEMAN`, `READING_MODEL_ORACLE`, `READING_MODEL_AUDITOR`, `BOARD_BUILD_DAILY_USD` (5), `BOARD_BUILD_PER_PERSON_PER_DAY` (3), `BOARD_AUDIT_SAMPLE_PCT` (100 → later 20), `BOARD_BUILD_SWEEP_MAX` (50), `BOARD_BUILD_ACTIVE_DAYS` (30), `FAMILY_FINDINGS_MAX` (30), `LAB_DAILY_USD` (2), `ORACLE_TRADITIONS` (`parashara,jaimini,nakshatra,tajaka,gochara`) |
| Registry and catalogue | `AGENTS` rows `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.self`, `lineman.love`, `lineman.work`, `oracle.self`, `oracle.love`, `oracle.work`, `reading.auditor`, `board.validator` (code); `TECHNIQUES` rows for each with contracts; `SUBAGENT_DIGEST_SPECS` and `subagentCachePlan` entries; `self.reading.oracle` retired in favour of `oracle.self` |
| Admin (aiadastra_admin) | Techniques Lab: board tabs Love and Work live; **Oracle Studio** tab (ingredients, prompt versions, replay, compare, grade, promote); **Staging** tab (cohorts, personas, hydrate, run, review); Research Lab page redirects to Staging |
| Web (AIAstra_WEB) | `LovePage`, `WorkPage` gain "Your reading" first tab on `SelfReading`'s components with a board prop; the You tab swaps code cards for Oracle cards when `oracle.status = 'ready'` |
| Scripts | `scripts/board-build.ts --kundli --board --stage --dry` (prints packs, token counts and the cost before any call; `--yes` runs); `scripts/cohort.ts` |
| Tests | packs (golden on `c584c0a3`, no astrology, token budget), gate (drops unknown keys, over-long text, bad dates), lineman frame filter, validator, build (fake model), locks, triggers, Love/Work panels golden, catalogue and registry tests, admin contract tests (no personal keys), web banned-word scan |
| Docs | this plan; `docs/admin/07` regenerated; `docs/admin/11-oracle-studio-and-staging.md` (admin side, written from §4.3/§9/§10 when the admin build starts); TODOS entries of §13 |

## 4. Exactly how it works when done

### 4.1 Backend

#### 4.1.1 The three tiers and the code floor

```
engine rows ─► digest + activation (per digest version) ─► code panels (9 Self, 8 Love, 8 Work; $0; the floor and the veto)
                        │
                        ├─► family packs (5 per person) ─► prompt cache upload ─► family agents (5 calls) ─► family findings (stored, fanned out)
                        │                                                                                   │
                        │                                   lineman.<board> (1 call per board) ◄────────────┘  + code claims + purview + sealed facts
                        │                                            │
                        │                                   oracle.<board> (1 call per board) ─► validator (code) ─► cards
                        │                                            │
                        └─► purview (code) ──────────────────────────┴─► dossier ─► auditor (1 call, sampled) ─► board.bundle row ─► the page
```

The code panels run first and always; their claims are the floor (shown while the model layer is pending or failed) and the
veto (an Oracle line whose claim ids contradict a code claim's polarity on the same rows is dropped by the validator, rule
`veto.code_contradiction`, and recorded).

#### 4.1.2 Family sub-agents: what each reads, does and returns

All five share `prompts/families/_family.md` (the reader rules of `readers/_shared.md` cut to one page: never compute,
evidence keys copied exactly, a gap for anything missing, no remedies, no diagnosis, no engine or software names) and one
line of universal context: `RUNNING: <clock label> L1 <lord> <from>→<to> houses [..]; L2 <lord> <from>→<to> houses [..]`.
Every family's job is the same sentence, specialised by its data: *find the afflictions and the malefics in this layer, and
say what in this layer helps, delays or delivers the promise of the running mahadasha, and when.* Packs are frame-agnostic
(all twelve houses, all nine planets) so one run serves all three boards; the lineman filters.

| Agent | Pack (reads only this) | Pack layout, size | Job | Output cap |
|---|---|---|---|---|
| `family.rasi` (F-Rasi) | D1 house cards 1–12 (sign, lord, lord's house and dignity, occupants with nature, graha and rasi aspects, argala, SAV, class, cusp star, arudha); D1 planet cards (sign, house, degree, star and lord, dignity, retro, combust, war, dispositor and its house, avasthas with ripeness and multipliers, shadbala ratio and rank, natural and functional nature, owns, aspects to and by, conjunctions, Sun proximity); D1 points (AL, UL, A2–A11, AK…DK with `planet`); yoga and dosha rows; star profile (Moon star and lord, lagna star, gandanta, pending-karma houses) | `family_rasi_pack`: 12 house lines + 9 planet lines + points line + yoga lines + star line; about 3,500 tokens | Per house: standing (lord's dignity and house, occupants, aspects, SAV against the chart mean), the afflictions (malefic on or aspecting, lord in 6/8/12, debility without a cancellation row, mrita or sushupta avastha, combustion), the graces (cancellation, exaltation, benefic aspect, argala). Per malefic: what it presses. For the running MD lord and AD lord: their D1 standing and what in D1 helps or holds their promise. | ≤ 30 findings |
| `family.varga` (F-Varga) | For each stored varga (D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D30, D60, D144 where present): lagna sign and lord; each planet's sign, house, dignity; vargottama flags (D1 sign = varga sign, pre-computed by comparing stored sign labels); the D9 AK sign (karakamsa) and the planets in it; the D10 lagna and tenth; the D30 first | `family_varga_pack`: a planet × varga matrix (9 rows × N vargas, `sign/house/dignity` cells) + N lagna lines + three point lines; about 3,500 tokens for 13 vargas | Per planet: where the vargas agree with D1 and where they disagree (debilitated in D9, exalted in D10, vargottama); the inner self (D9 lagna and its lord), the work charter (D10), the body shape (D30), learning (D24), home (D4), children (D7) as facts; for the running MD and AD lords: confirmed or weakened in the vargas that matter for the houses they activate. | ≤ 40 findings |
| `family.dasha` (F-Dasha) | The reading clock: every L1 row of life, every L2 row inside the previous, running and next L1, the running L3; each confirming clock's L1 rows; for the running MD lord: the 9×9 `dashaCharter.fruition` row (house from MD, fruition class, 6/8, 2/12, star-lord flag); compressed D1 lines of every L1 lord (house, dignity, owns, star lord, functional nature); the `dasha.applicable` verdicts | `family_dasha_pack`: clock header + L1 table + L2 table for three L1s + L3 line + confirming tables + charter row + lord lines; about 6,000 tokens | The promise of the running MD (the houses it owns, occupies and activates, read through its lord's D1 standing and star lord); what each AD delivers, costs or reverses (fruition class, 6/8, 2/12); which AD inside the MD is the delivery window for which house; what the previous MD left and what the next asks; where the confirming clocks turn within 18 months of each boundary (dates only, copied). | ≤ 30 findings + one `mdPromise` block |
| `family.year` (F-Year) | The running Tithi Pravesha and Varsha rows (lagna, twelve house cards, muntha, year lord, sahams, Tajaka yogas present, Mudda and year-dasha periods); the natal positions of L1, Mo, Su, L7, Ve, L10, Sa as reference lines (sign only) | `family_year_pack`: two annual blocks + reference line; about 2,500 tokens | What the year chart puts on each natal house (the year house holding each natal lord), the year lord's relation to the frame houses, the muntha house, the sahams that touch self, love and work, the Mudda sub-range running today; graded against the running MD and AD as confirms / amplifies / contradicts / silent. | ≤ 20 findings |
| `family.sky` (F-Sky) | The stored slow-sky overlay for this kundli: Saturn, Jupiter, Rahu, Ketu (and Mars when the overlay carries it) sign and house from the natal lagna and from the natal Moon with ingress dates; Sade Sati phase and dates; double-transit flags the engine stores; the SAV of the transited houses | `family_sky_pack`: one line per slow planet + Sade Sati line + SAV line; about 2,000 tokens | What stands on the lagna, the Moon and each house now and until which date; Sade Sati as a standing pressure with dates; Jupiter's support on which houses until when; whether the slow sky delivers or delays the running AD's houses. When no overlay is stored the agent is not called and a gap is recorded. | ≤ 20 findings |

`family_findings.v1` (returned as JSON; parsed and gated in code):

```ts
interface FamilyFindings {
  family: 'rasi' | 'varga' | 'dasha' | 'year' | 'sky';
  findings: Array<{
    id: string;                                  // '<family>.<nn>'
    kind: 'affliction' | 'malefic' | 'grace' | 'promise' | 'delay' | 'delivery' | 'confirm' | 'contradict' | 'fact';
    planets: string[]; houses: number[];         // engine codes and 1..12
    text: string;                                // ≤ 160 characters, begins with the planet or house it is about
    polarity: 'supports' | 'obstructs' | 'neutral';
    weight: 1 | 2 | 3;
    tradition: 'parashara' | 'jaimini' | 'nakshatra' | 'tajaka' | 'gochara';
    rule: string;                                // 'bphs.lord_in_dusthana', 'jaimini.karakamsa.planets_in', 'tajaka.muntha'…
    evidence: string[];                          // 1–4 keys that exist in this pack: 'planet:D1.Sa', 'house:D9.h7', 'activation:dwisatpathi/2/Ve@2025-11-16', 'annual:TP2026.D1', 'sky:Sa@2025-03-29'
    range: { from: string; to: string } | 'always';  // dates copied from the pack
    affectsMd?: 'helps' | 'delays' | 'delivers' | 'none';
  }>;
  mdPromise?: { lord: string; houses: number[]; text: string; deliveryWindows: Array<{ findingId: string; from: string; to: string }> };  // F-Dasha
  gaps: string[];
  digest: string;                                // ≤ 2 sentences
}
```

The code gate (`families/schema.ts gateFamilyFindings`) drops a finding whose evidence key is not in the pack's key set,
whose text exceeds 160 characters or contains a banned word (doc 45 §3.3 plus the body list of doc 61 §4), whose dates are
not stored boundaries, or whose `rule` is not in the rules catalogue (`src/reading/rules/catalog.ts`, doc 60 §3's `rules[]`
with sources, tradition and the boards it serves). Dropped findings are counted in the dossier (`linemen[].dropped`).
`FAMILY_FINDINGS_MAX` caps the list after gating; the prompt asks for the cap too.

#### 4.1.3 Linemen: one per board

A lineman reads the five family findings filtered to its frame (houses, planets and points per doc 59 §2.2, §3.2, §4.2),
the board's code panel claims (with their ids and evidence), the purview entries, the sealed facts for the board
(`<board>.confirm.*`, `love.status`, `work.status`), and the clock label. It never sees a pack. Its job: for every panel of
the board, choose up to four candidate claims that the families and the code agree on or that a family adds with weight ≥ 2
and the code does not contradict; mark where two families disagree; name the one central tension; propose the one question.

| Agent | Frame | Prompt | Output `lineman_brief.v1` (≤ 3,000 tokens) |
|---|---|---|---|
| `lineman.self` | houses 1, 4, 5, 9, 12 (+6, 8 for the body); L1, Mo, Su, AK, Me, Ju; AL, karakamsa, D9 lagna, D30 first | `linemen/_lineman.md` + `linemen/self.md` (R15's content, rewritten for family findings; the diagnosis order of doc 59 §1) | `{ board, panels: [{ panel, candidates: [{ claimId, text ≤ 200, range, certainty: 'fact'|'strong'|'moderate'|'possible', evidence: [family finding ids + code claim ids], rule }] }], tension: { claimId, text }, conflicts: [{ a, b, text }], question: { claimId, text ≤ 28 words }, gaps }` |
| `lineman.love` | houses 7, 5, 11, 2, 8, 4, 12; L7, Ve, Ju, Mo, DK; UL, A7, D9 h7, D7 h1 | `linemen/love.md` (doc 59 §3 contracts; `love.status` gates the part panels) | same shape |
| `lineman.work` | houses 10, 6, 11, 2, 9, 3, 5, 7; L10, Sa, Me, Su, Ju, AmK; AL, A10, D10 lagna and tenth, karakamsa | `linemen/work.md` (doc 59 §4; docs 42–43 rules; ranked sub-areas, never one profession) | same shape |

Certainty: `fact` only for natal lines both a family and the code state; timing lines carry the F-Dasha confirmation count
(`strong` ≥ 2 confirming clocks, `moderate` 1, `possible` 0 or a family disagreement). The lineman's candidates carry
claim ids; a candidate whose evidence ids are not in the inputs is dropped by the same gate.

#### 4.1.4 The Oracles

| Type | Prompt | Reads | Writes |
|---|---|---|---|
| `oracle.self` ("Oracle: Self") | `oracle/_core.md` (the voice, the never-list, the card contract, the certainty words, the no-computation rule; about 600 words) + `oracle/self.md` (the Self charter: the standing question "who am I and what am I going through now"; a card-rule block per panel: In short, Your chapters, Who you are, Your mind, Your body, Your soul's aim, Gifts and knots, What you struggle with, This year, One question; the body block carries doc 61 §3's rules verbatim; about 700 words) | the lineman brief, the purview entries, the sealed facts, the clock label, `TODAY` | `board_reading.v1`: per panel 1–3 lines `{ id, text ≤ 22 words, range, claimIds, certainty, detail }`, `diagnosis` (3 sentences as three lines), `question`; ≤ 1,500 tokens |
| `oracle.love` ("Oracle: Love") | `_core.md` + `oracle/love.md` (how you love, the partner you draw, the bond, who else is in it, what tests it, this year; separation and marriage never verdicts, doc 45 §8.2) | same | same |
| `oracle.work` ("Oracle: Work") | `_core.md` + `oracle/work.md` (built to do, how you are seen, where the work is now, what it pays, what tests it, this year; ranked sub-areas; no job-end prediction on the first page, doc 43) | same | same |

The Oracle writes lines, not prose (doc 61 §0.3), under `responseSchema: board_reading.v1`. `oracles/validate.ts` (agent
`board.validator`, code) rejects a line over 22 words, without a range, with a range outside its panel's header range,
without claim ids, with a claim id not in the brief, with a date not a stored boundary, with a banned word, or contradicting
a code claim's polarity on the same rows; a rejected line is replaced by the code panel's line
for that slot and counted. A panel with no surviving line shows the code card. The validator's result is in the dossier.

Strictness of tradition: the Oracle applies no rule of its own. Rules come in through the lineman's candidates (`rule` from
the rules catalogue) and the purview; `ORACLE_TRADITIONS` names the traditions whose rules may enter the brief (default all
five; Sachin can run a Parashara-and-Jaimini-only build from the Studio and compare).

#### 4.1.5 The auditor

`reading.auditor` (role `auditor`, `READING_MODEL_AUDITOR`, never the Oracle's model, prompt `oracle/auditor.md`): receives
the dossier (packs' keys and values, family findings, lineman brief, purview, rules, clocks, cards) and grades each line
`correct | overstated | understated | unsupported | contradicted | missed`, returns a 0–100 score, a verdict (pass ≥ 90 with
no `contradicted`; warn 70–89; fail), and receipts (line, rows, rule). A fail keeps the Oracle cards off the board (code cards
show) and writes an `admin_actions` row `reading_audit_failed`. Runs on every build until the pass rate on real kundlis is
above 95 percent for four weeks, then on `BOARD_AUDIT_SAMPLE_PCT`.

#### 4.1.6 The build, end to end

`buildBoard(kundliId, board, trigger)` in `src/reading/board/build.ts`:

| Step | What | Reads | Writes | Limits |
|---|---|---|---|---|
| 0 | Lock `pg_advisory_xact_lock(hashtext('board:'||kundliId))`; a second build of the same kundli waits, then finds everything stored and does nothing | — | — | lock wait 30 s then `busy` |
| 1 | Assemble the input once: the kundli (one read), digest view without `source`, one `activationFor` (reading clock + confirming, levels 1–2 life, level 3 today via `shortTo` / `shortMaxLevel`), annual rows, sky overlay (decrypted only here), sealed facts, preferred clock, prompt versions | 1 transaction, 5 queries | — | 2 s statement timeout |
| 2 | Code panels for the board (`board.panels`), purview, cards, code audit (today's Self path, generalised) | memory | `technique_outputs` per panel (as today) | < 50 ms |
| 3 | Family packs: for each family, `buildFamilyPack` → `packHash`; look up `technique_outputs` (`technique = 'family.<id>.pack'`, window from the pack's freshness) | memory | pack rows (natal: open; dasha: running L2 span; year: TP span; sky: until the next stored ingress) | < 50 ms |
| 4 | Family findings: for each family, look up `reading_findings_cache` by `(kundliId, 'family.<id>', packHash, promptVersion)`; on a miss, `ensurePromptCache(model, _family.md + <family>.md, pack, { userId, kundliId })` then `callGemini` with `cachePrefix: true`, `cacheOwner`, `parts: [pack, 'TODAY … RUNNING …']` (dates only in the suffix, so the prefix is stable), `responseSchema: family_findings.v1`, `maxOutputTokens 2500`, `thinking: 'low'`; gate; store with `expires_at` = window end | provider | `reading_findings_cache`, `agent_runs` (one per family, cached or run) | 5 calls in parallel; 20 s each; one retry on 429/5xx; `costGuard.reserveTokens` against `BOARD_BUILD_DAILY_USD` |
| 5 | Lineman: filter findings to the frame; call `lineman.<board>` with `cachePrefix` on `_lineman.md + <board>.md`; gate | provider | `technique_outputs` (`lineman.<board>`, window = min of the family windows used), `agent_runs` | 1 call; 20 s |
| 6 | Oracle: call `oracle.<board>` with `cachePrefix` on `_core.md + <board>.md`; validate; merge with code cards | provider | `technique_outputs` (`oracle.<board>`), `agent_runs` | 1 call; 20 s |
| 7 | Auditor (when sampled) | provider | dossier `audit` | 1 call; 30 s |
| 8 | Write the dossier (`families`, `lineman`, `oracle`, `prompt_versions`, `cost_usd` from the `agent_runs` of this build) and the `board.bundle` row (everything the page needs: cards, question, clock, builtLine, oracle status) | — | `reading_dossiers`, `technique_outputs` (`board.bundle`) | 1 transaction |

Failure handling: a family call that fails leaves a gap and the build continues with four families (the lineman is told
which family is missing); a lineman or Oracle failure stores `oracle.status = 'failed'` with the code cards; a validator
failure on every line the same; a budget refusal stores `oracle.status = 'budget'`; every path leaves a `board.bundle` row,
so the page never waits on a model. Total build time budget 60 s (Lambda async invocation); typical 8–15 s.

Triggers (`src/reading/board/triggers.ts`): `POST /events { name: 'board-build', kundliId, board | 'all', trigger }` from
the digest event (after `buildDigest`), from the confirm route (trigger `confirm`), from the clock change route, and from the
lab (`manual`); `board-build-sweep` every 15 minutes with the digest sweep: for people seen in the last
`BOARD_BUILD_ACTIVE_DAYS`, queue a build when the stored `oracle.<board>` window has ended (the reading clock's L2 ended, a
new TP row covers today) up to `BOARD_BUILD_SWEEP_MAX` per sweep. A page request never builds; on a missing bundle it returns
the code cards from step 2 immediately (`oracle.status = 'pending'`) and queues the build.

Rebuild cadence per person (what actually changes the Oracle inputs): the reading clock's L2 boundary (Sachin: 2027-01-01,
then 2028-02-16), the TP year, a digest version, a confirm answer. L3 boundaries do not rebuild the Oracle in phases 1–4;
the code struggle panel still refreshes its release dates deterministically (its own key is L3-bound today).

#### 4.1.7 Love and Work panels (code floor)

Doc 59 §5's shared functions gain a `BoardFrame` (`{ board, houses, planets, points, statusFact }`) and the Self panels move
to `src/reading/board/panels/`; Love's part panels (`heart`, `partner`, `bond`, `circle`) and Work's (`vocation`, `standing`,
`ground`, `gain`) are written over the same six slicers with their own word tables. `love.status` and `work.status` gate the
part panels as doc 59 says. Every row in `BOARD_READING_PLANNED` turns `built`. Same card contract, dossier, purview (with
the Love and Work rules of doc 59 §3.2/§4.2 added to `purview.ts`), code audit and lab endpoints.

### 4.2 API

| Endpoint | Request | Response | Errors |
|---|---|---|---|
| `GET /api/self/reading`, `GET /api/love/reading`, `GET /api/work/reading` | — | `200 { status: 'ok', built_at, cached, reading: BoardReading }` where `BoardReading` = doc 62's `SelfReading` + `board` + `oracle: { status: 'off' \| 'pending' \| 'ready' \| 'failed' \| 'budget' \| 'audit_failed', builtAt: string \| null, promptVersion: string \| null, model: string \| null }`; cards are the Oracle's when `ready`, else the code panels' | `202 preparing` (digest), `404 no_kundli`, `401`, `503 reading_slow` (10 s) |
| `POST /api/<board>/reading/confirm` | `{ claimId, answer }` | `204`; queues `board-build` trigger `confirm` | `400 bad_answer`, `401` |
| `PUT /api/self/clock` | as doc 58 | as doc 58; deletes the kundli's `lineman.*`, `oracle.*`, `board.bundle`, `family.dasha.*` rows; queues builds | as doc 58 |
| `POST /events` | `{ name: 'board-build', kundliId, board: 'self' \| 'love' \| 'work' \| 'all', trigger }`; `{ name: 'board-build-sweep' }` | `202` | `400` |
| `POST /api/admin-lab/run` | `{ userId, board, technique \| 'all', stage?: 'code' \| 'families' \| 'lineman' \| 'oracle' \| 'audit' \| 'all', force?, asOf?, dry?: boolean }` | `LabRun` (dossier, stripped) with `cost` and, on `dry`, the token counts and USD estimate per stage with no call made | `400 bad_request \| bad_as_of \| unknown_technique`, `403`, `404`, `409 lab_budget`, `503 lab_slow` (60 s) |
| `POST /api/admin-lab/replay` | `{ dossierId, stage: 'family.<id>' \| 'lineman' \| 'oracle' \| 'audit', prompt: { name, version } \| { name, draft: string }, model?: string, traditions?: string[] }` | `{ replayId, output, validator, cost, ms, promptVersion }`; stored in `oracle_evals` | `404 dossier`, `409 lab_budget`, `400 bad_stage` |
| `GET /api/admin-lab/prompts/:name/versions` | — | `{ items: [{ version, createdAt, notes, length }], active }` from `system_prompt_versions` | `404` |
| `GET /api/admin-lab/prompts/:name/versions/:v` | — | `{ prompt }` | `404` |
| `PUT /api/admin-lab/prompts/:name` | `{ prompt, notes }` (superadmin) | `{ version }` (the trigger archives the old one; `PROMPTS` syncs within 60 s; `admin_actions` row `prompt.promote`) | `403` |
| `POST /api/admin-lab/evals/:replayId/grade` | `{ verdict: 'right' \| 'wrong' \| 'unsure', note?, lineGrades?: [{ lineId, grade }] }` | `204` | `404` |
| `GET /api/admin-lab/evals?promptName&limit` | — | grades per version with auditor scores | — |
| `POST /api/admin-lab/cohorts` | `{ label, size, mode: 'random' \| 'persona', spec?: { ageBrackets?, places?, scenarios?: ['S2'..'S8'] }, personaPrompt? }` | `{ cohortId, status: 'hydrating', members: n, engineCalls: n, estimatedUsd }` | `409 lab_budget` |
| `GET /api/admin-lab/cohorts/:id` | — | members with digest status, persona (synthetic text), matched scenario, latest run and audit | `404` |
| `POST /api/admin-lab/cohorts/:id/run` | `{ board \| 'all', stage, dry? }` | per-member `LabRun` summaries; `dry` returns counts and USD | `409 lab_budget` |

Admin API (`aiadastra_admin/api`) proxies each with the role check (superadmin for run, replay, promote, cohorts; admin may
read), `assertLabRunSafe` on every answer, and an `admin_actions` row per action (ids only).

### 4.3 Frontend experience

**Consumer (AIAstra_WEB).** You, Love and Work each open on "Your reading": the same `SelfReading` components with a board
prop (phone: carousel with chips and dots; desktop: tabs with the In-short card above). States:

| State | Shows |
|---|---|
| Loading | skeleton, "Reading your chart…" |
| `202 preparing` | "Your chart is still being prepared. This page will update by itself." polls 30 s × 10 |
| `oracle.status = 'off' \| 'pending' \| 'failed' \| 'budget' \| 'audit_failed'` | the code cards (today's You reading); when `pending`, the bottom line reads "Built 7 Nov 2026 · a fuller reading is on its way" and the page re-fetches once after 20 s and once after 60 s |
| `oracle.status = 'ready'` | the Oracle cards; bottom line "Built 7 Nov 2026, next check 1 Jan 2027" |
| Chart details | the line's detail, its claim ids, the panel's technique id; staff-only fields (gaps, purview, dossier id) never render |
| Question | one card, Yes / Partly / No / Skip; "Thanks, noted."; the next build honours it |

Nothing on the consumer page names a model, an agent, a reader, a family or the engine; the swap from code cards to Oracle
cards is silent except for the bottom line.

**Admin (aiadastra_admin) Techniques Lab.** Board tabs Self · Love · Work. Sub-tabs per run: Inputs · Flow · Families ·
Lineman · Purview · Brief · Output · Audit · Cost (doc 10's eight plus Families). New tabs:

| Tab | What staff do |
|---|---|
| **Oracle Studio** | Pick a stored dossier (person or staging member); left: the ingredients tree (packs with keys and values, family findings with gate drops, lineman brief, purview, facts, rules fired, clock); centre: the prompt editor over `oracle/<board>` (or `linemen/<board>`, `families/<id>`) with the version list, a diff against any version, notes; right: Replay (dry first: tokens and USD; then run within `LAB_DAILY_USD`), the output as cards with the validator's marks, Compare (two outputs side by side, lines diffed by claim id and range), Grade (auditor run, or right / wrong / unsure per line with a note), Promote (superadmin; writes the version) |
| **Staging** | Cohorts list; New cohort (random births by age bracket and place list, or a persona prompt the model writes people from); per cohort: members with digest status, persona, matched scenario, engine calls made, builds and audits; Run board / Run all with dry cost first; each member opens in the same sub-tabs as a real person; Scenario deck S1–S8 pinned at the top |

Running state: a stepper (bundle → code panels → packs → families ×5 → lineman → Oracle → validator → auditor → write) with
ms per step from the dossier's `steps`, streamed as NDJSON while the run lasts (docs/admin/08 channel). Failures show the
step, the error class (`budget`, `timeout`, `gate_empty`, `validator_empty`, `audit_failed`) and today's spend against the cap.

### 4.4 UI/UX words

Consumer: unchanged from docs 58 §4.4 and 61 §1; bottom line variants "Built <date>, next check <date>" and "Built <date> · a
fuller reading is on its way". Admin: "Oracle Studio", "What the Oracle received", "Replay with this prompt", "Compare",
"Was it right?", "Promote this version", "Staging", "New focus group", "Hydrate through the engine", "Run the board",
"Dry run (cost only)". Never a birth field, a name, or the engine's name; a synthetic member is "Member 3 of Cohort A, age 32".

## 5. Cost model (prices from `src/reading/llm/models.ts`, `PRICE_TABLE_VERSION 2026-11-01`)

### 5.1 Models per role (recommendation; every id env-driven, nothing set until the yes)

| Role | Env | Model | In / out / cached, $ per 1M | Why |
|---|---|---|---|---|
| family | `READING_MODEL_FAMILY` | `gemini-3.1-flash-lite` | 0.25 / 1.50 / 0.025 | structured extraction over a fixed pack; cheap, cacheable |
| lineman | `READING_MODEL_LINEMAN` | `gemini-3.1-flash-lite` (upgrade path `gemini-3.8-flash`) | 0.25 / 1.50 / 0.025 | join and rank; schema-bound |
| oracle | `READING_MODEL_ORACLE` | `gemini-3.8-flash` | 0.75 / 3.75 / 0.075 (1.50 / 7.50 / 0.15 from 2027-01-01) | the voice; the only prose-quality call |
| auditor | `READING_MODEL_AUDITOR` | `gemini-3.1-pro-preview` (alternative `gemini-4-argon`, 2.0 / 10.0 → 4.0 / 20.0 from 2026-12-01) | 2.0 / 12.0 / 0.2 | a stronger, separate model, as doc 60 §5 requires |

The provider's explicit cache needs a prefix above its minimum (1,024 tokens on the 2.5 Flash family per the pricing page read
2026-11-01; confirm per 3.x id before relying on it); every family pack is above it; the lineman and Oracle prefixes are the
prompts alone (about 1,300 and 1,500 tokens) so their caching is marginal and is kept for consistency. Cache storage is billed
per token-hour and is small at a 30-minute TTL (about $0.001 per build at the 2.5 Flash storage price; verify for 3.x).

### 5.2 Token estimates and cost per call

| Call | Input tokens (prompt + data) | Output tokens | USD today | USD from 2027-01-01 |
|---|---|---|---|---|
| F-Rasi | 1,200 + 3,500 | 2,000 | 0.0012 + 0.0030 = **0.0042** | same |
| F-Varga | 1,200 + 3,500 | 2,500 | 0.0012 + 0.0038 = **0.0050** | same |
| F-Dasha | 1,300 + 6,000 | 2,000 | 0.0018 + 0.0030 = **0.0048** | same |
| F-Year | 1,100 + 2,500 | 1,500 | 0.0009 + 0.0023 = **0.0032** | same |
| F-Sky | 1,100 + 2,000 | 1,500 | 0.0008 + 0.0023 = **0.0031** | same |
| Five families | 23,400 | 9,500 | **0.020** | 0.020 |
| Lineman (one board) | 1,300 + 10,000 findings (filtered ≈ 6,000) + 3,000 code claims + 500 purview ≈ 11,000 | 3,000 | 0.0028 + 0.0045 = **0.0073** | same |
| Oracle (one board) | 1,500 + 4,000 brief | 1,500 | 0.0041 + 0.0056 = **0.0097** | 0.019 |
| Validator, purview, code panels | — | — | **0** | 0 |
| Auditor (one board) | 1,500 + 14,000 dossier + 1,500 cards | 2,500 | 0.034 + 0.030 = **0.064** | 0.064 |

### 5.3 Per build and per load

| Event | Agents that run | Calls | USD today | Notes |
|---|---|---|---|---|
| **Dashboard load (any board)** | none | 0 | **0** | reads `board.bundle`; 1 query; target < 300 ms on the Lambda |
| First build, Self only | 5 families + lineman.self + oracle.self | 7 | **0.037** | + auditor 0.064 = 0.101 |
| First build, all three boards | 5 families (once) + 3 linemen + 3 Oracles | 11 | **0.071** | families fanned out; + 3 auditors 0.192 = **0.263** |
| Rebuild on the reading clock's L2 boundary | F-Dasha (+ F-Sky if changed) + 3 linemen + 3 Oracles | 7–8 | **0.056** | natal packs and findings reused |
| Rebuild on a new year chart | F-Year + 3 linemen + 3 Oracles | 7 | **0.054** | |
| Rebuild on a confirm answer | 3 linemen + 3 Oracles (findings unchanged) | 6 | **0.051** | or the one board answered: 0.017 |
| Rebuild on a digest version | everything | 11 | 0.071 | rare |
| Oracle Studio replay | the one stage | 1 | 0.004–0.010 (audit 0.064) | within `LAB_DAILY_USD` |

Per person per year, all three boards, no audit: about 2–4 rebuilds → **$0.10–0.30**. With the auditor on every build in the
first weeks, add $0.19 per rebuild; at a 20 percent sample afterwards, add about $0.04. For 1,000 active people: first builds
$71 (+$192 audit), then about $200–300 a year. Family findings are the only shared cost and are shared across the three boards;
the Oracle is the only call whose price doubles in January.

### 5.4 Per phase: key, count, cost (nothing runs before Sachin's yes on each line)

| Phase | Key | Model ids | Calls | USD |
|---|---|---|---|---|
| 1–2 (code only) | none | none | 0 | 0 |
| 3 first paid run, S1 (`c584c0a3`), Self, dry run first | the live Gemini key (`GEMINI_API_KEY` on the Lambda / `.env` outside the checkout) | lite, lite, 3.8-flash, 3.1-pro | 8 | **0.10** |
| 3 S1 all three boards + S2–S8 Self (dossier per scenario, audited) | same | same | 8 × 11 + 8 × 3 audits ≈ 112 | **≈ 2.10** |
| 4 one focus group of 20 through staging, all boards, audited | same | same | 20 × 14 = 280 | **≈ 5.30** |
| 5 real people behind the flag, first 100 | same | same | 100 × 11 + 20 % audit | **≈ 11** |
| Oracle Studio, a training week | same | same | at `LAB_DAILY_USD` 2 → raise to 5 with the yes | **≤ 35 / week** |
| 6 day grain, per active person per day | same | lite + 3.8-flash | 2 | 0.004 (+ audit sampled) |

## 6. The cache: what is immutable, what is time-sliced, and what is reused

| Layer | Store | Key | Window | Who writes | Who reads |
|---|---|---|---|---|---|
| 0 engine rows | `kundli_data` | kundli, type, variant | immutable per birth data | registration pull, digest fetch | digest build |
| 1 digest and calendar | `kundli_digest`, `kundli_activation` | kundli, digest version | per digest version | `digest.build`, sweep | packs, code panels, purview |
| 2a immutable packs | `technique_outputs` `family.rasi.pack`, `family.varga.pack` | kundli, digest version, layout version | open (natal) | build step 3 | family agents, Studio |
| 2b time-sliced packs | `technique_outputs` `family.dasha.pack` (running L2 span), `family.year.pack` (TP span), `family.sky.pack` (until the next stored ingress) | + window | as named | build step 3 | same |
| 2c provider prompt cache | `cachedContents` + `llm_cache_entries` | model, system, pack (`prefixKey`), owner | TTL 1,800 s, extended while used | `ensurePromptCache` in step 4 | the family call |
| 3 family findings | `reading_findings_cache` (`reader_id = 'family.<id>'`, `pack_hash`, `prompt_version`, `horizon_key` = window) | kundli, family, pack hash, prompt version | the pack's window | step 4 | all three linemen (fan-out), Studio |
| 4 lineman briefs, Oracle cards | `technique_outputs` `lineman.<board>`, `oracle.<board>` (+ `made_by_kind = 'llm'`, `prompt_version`) | kundli, board, contract hash, input hash, windows | min of the inputs' windows | steps 5–6 | bundle, Studio |
| 5 the bundle | `technique_outputs` `board.bundle.<board>` | kundli, board | same as 4 | step 8 | the page (one read) |
| 6 the dossier | `reading_dossiers` | kundli, board, bundle hash | forever (research record) | step 8 | Studio, auditor, lab |

Rules: (a) a technique runs once per person per window: the lookup precedes every call and the advisory lock serialises
builds of one kundli; (b) one family run feeds three boards; (c) a pack carries only its family's rows and the RUNNING line;
a lineman carries findings, claims, purview and facts, never a pack; the Oracle carries the brief, never findings or packs;
(d) `recycleIndividualCaches` must stop deleting rows with `made_by_kind = 'llm'` and `board.bundle` rows before their
`valid_to`; it keeps evicting provider caches, code outputs and memos as today (§13 finding 1); (e) `PUT /api/self/clock`
and a digest rebuild delete the kundli's layers 2b–5; (f) the dossier is never deleted.

## 7. Later phase: what changes day to day for the Self (Sachin's phase 3 or 4; doc 60 §11)

| Piece | Addition |
|---|---|
| Packs | `family.dasha.pack` gains a day slice: the running L3 and L4 of the reading clock (where the engine serves L4) with the confirming clocks' L3; `family.sky.pack` gains the Moon's sign and star today over the natal Moon and lagna, tara from the birth star, chandra bala, the hora lords and lagna-by-hour bands from `day_tables` / `kundli_day_overlays` (doc 47) for the person's place |
| Agents | `lineman.now` (frame: self; job: the fortnight's pressed or carried faculty from L3 through L2 and L1, the day's footing from the Moon, the hours that carry or press it); `oracle.now` ("Oracle: Now", `oracle/now.md`: three lines: this fortnight, today, the next good hours; each dated or houred) |
| Rule | the purview gains `bphs.pratyantar.through_antar_and_maha`: a day line that reverses the fortnight or the chapter is vetoed |
| Windows | fortnight line = L3 span; today line = the local day; hours line = the day's bands; the strip rebuilds on first open of the day for people active in the last 7 days (or a 03:00 local prebuild) |
| Confirm | "Did today feel like that?" sealed per day; the auditor samples the day layer; a two-week diary on S1 is the acceptance test |
| Cost | two lite-class calls per active person per day ≈ $0.004; the Oracle: Now on 3.8-flash would be $0.01; decide after the diary |

## 8. Architecture

```
                 ┌──────────────── request path (consumer) ───────────────┐
 web ─ GET /api/<board>/reading ─► bundle row (technique_outputs) ─► 200 cards   (0 model calls, 1 query)
                                   └ missing → code panels now (202-like 'pending') + POST /events board-build

                 ┌──────────────── async build (Lambda event) ─────────────┐
 POST /events board-build ─► buildBoard: lock → input (1 txn) → code panels → purview → cards → code audit
                                        → packs (5) → prompt cache upload → family agents ×5 (parallel)
                                        → lineman.<board> → oracle.<board> → validator → auditor (sampled)
                                        → dossier + bundle (1 txn)
 EventBridge 15 min ─► board-build-sweep (active people whose windows ended, ≤ BOARD_BUILD_SWEEP_MAX)

                 ┌──────────────── admin ──────────────────────────────────┐
 admin web ─ admin api (/lab/*: role, consent-free QA, admin_actions, assertLabRunSafe)
           ─ server /api/admin-lab/* (ADMIN_LAB=1, token): run (stage, dry) · replay · prompts · evals · cohorts
 staging:  cohorts ─► research_kundlis ─► ensureChartData(researchChartDataRepo) ─► digest(research) ─► the same buildBoard with a ResearchStore
```

Boundaries: the engine computes; the digest stores with provenance; packs format; family agents find; linemen join; Oracles
write; the validator and purview veto; the auditor grades; the page reads. Each boundary is a stored row with a window, so
every stage can be replayed from the dossier alone.

## 9. Oracle Studio: how Sachin trains the Oracle

| Need (Sachin's words) | Mechanism |
|---|---|
| See every ingredient fed to the synthesizer | the dossier's `families`, `lineman`, `rules`, `purview`, `data` (keys with values), `clocks`, `prompt_versions`; the Brief tab shows the Oracle's input byte for byte |
| Edit the system prompt, keep versions | `system_prompts` rows `oracle/_core`, `oracle/self`, `oracle/love`, `oracle/work`, `linemen/*`, `families/*`; the trigger archives every change in `system_prompt_versions`; the Studio lists, diffs and annotates versions; drafts are replayed without writing; Promote writes (superadmin, logged); `PROMPTS` syncs within 60 s; every dossier records the versions it used |
| Tone, level of detail | prompt text, judged by replay; the validator keeps the card contract fixed (22 words, dated, claim ids) whatever the prompt says, so tone work cannot break the shape |
| The full spectrum of problems, moods, minds, health, body and soul | the scenario deck S1–S8 (doc 60 §2) plus staging cohorts; a replay set is "this prompt against these N dossiers" with a dry cost first; the Studio shows must-say / must-not-say hits per scenario |
| Strict Parashara and Jaimini, or not | `traditions` on the replay (subset of `ORACLE_TRADITIONS`); the brief carries only rules of those traditions; compare the two outputs |
| Grade | the auditor's receipts per line; hand grades right / wrong / unsure per line with a note; `oracle_evals` keeps `{ replayId, dossierId, promptName, promptVersion, model, traditions, output, validator, auditScore, auditVerdict, handVerdict, notes, cost, createdAt }`; a per-version table shows average audit score, hand pass rate, validator drops, cost |
| Budget | `LAB_DAILY_USD` (default 2; the Studio shows spend and refuses with `lab_budget`); the dry run always comes first |

The Studio never shows a birth field or a name (`stripBirthFields`, `assertLabRunSafe`); a staging member's persona text is
synthetic and labelled so.

## 10. Staging focus groups

| Step | What | Where |
|---|---|---|
| Create | `POST /api/admin-lab/cohorts`: `random` draws births (date within an age bracket, time uniform, place from `LUCKY_REFERENCE_PLACES` or a given list); `persona` sends one call to the lineman-class model with the persona prompt ("twenty people aged 25–55 in the US and India with one pressing self, love or work situation each") and gets back synthetic personas (age, place, situation, what they would confirm); births are still random (a model cannot pick a chart); the persona is stored for reviewers and may seed sealed facts (`research` confirm answers) to test the gating, never shown to any agent as chart data | `src/reading/research/cohorts.ts`, M43 |
| Hydrate | `ensureChartData` with a `researchChartDataRepo` (writes `research_chart_data`), then `buildDigest` with a research digest store (writes `research_digests`, `research_activations`), then the annual set; engine calls counted per member (the registration set, about 105 export types) and shown; no templates | `src/reading/chartData/store.ts` gains a repo parameter path; `digest/build.ts` a store parameter |
| Match | a code matcher over the research digest tags members that satisfy a scenario spec (S2–S8 facts from the scenario files: e.g. S3 `L1 in 8 or 12 and Saturn L1 running`); unmatched scenarios are reported so the cohort can be enlarged | `src/reading/research/match.ts` |
| Build | the same `buildBoard` with a `ResearchStore` (`research_*` tables for input and `research_dashboard_runs.dossier` for output); family packs, findings, linemen, Oracles, validator, auditor all real; `research` builds count against `LAB_DAILY_USD` | `src/reading/board/store.ts` (`ProductionStore`, `ResearchStore`) |
| Review | the Staging tab opens each member in the lab's sub-tabs; the Scenario deck shows S1 (Sachin's real kundli by id, never copied) and S2–S8 matched members; grades go to `oracle_evals` with `cohortId` | admin web |
| Retire | `synthesizeAdminResearchRun` and the Research Lab page are removed; `/research-lab` redirects to Staging; `research.self_dashboard_qa` and `research.technical_verifier` rows point at the new path (the 8-gate verifier stays as a code audit over research dossiers) | admin api/web, catalogue |

## 11. Is running many small techniques the wrong method?

| Method | Verdict | Why |
|---|---|---|
| Many small **code** techniques (today's nine Self panels, the shared `board.*` functions) | **Right. Keep.** | $0, testable alone, timed alone, cached by window, the dossier reproduces every claim; they are the floor and the veto |
| A **model behind each panel** (ten Oracle calls per board) | Wrong | ten prompts per board, no whole-chart voice, a diagnosis that cannot see the parts, ten times the Oracle cost, ten validator surfaces |
| **One model over the whole digest** (54k tokens in, prose out) | Wrong | untraceable, the chat path's known failure (doc 60 §1), $0.05 of input per call before any output, no reuse across boards |
| **Family agents → lineman → Oracle** (this plan) | **Right, as the model tier.** | each agent reads one family it can hold entirely (3–6k tokens), outputs are schema-bound and gated, findings are shared by three boards, the Oracle sees a brief it can hold, and the code floor catches what the models miss |

The current method is made to work first (Love and Work code panels, the bundle row, the recycler fix, the 300 ms load) and
the model tier is added on top; nothing in the model tier can remove a code claim, only add lines the validator accepts.

## 12. What this plan changes in docs 58–62 and admin 10

| Doc | Change |
|---|---|
| 58 §4.1 model layer, §7 cost | one reader + one Oracle over code claims becomes five families + lineman + Oracle; `self.reading.oracle` retires into `oracle.self`; cost table replaced by §5 |
| 59 §5 | `board.oracle` becomes `oracle.<board>` with `_core.md` + board charter; the shared functions gain `BoardFrame` |
| 60 §6 bundle | the bundle is five family packs plus the code inputs, not one 54k document; the pre-run upload is per pack; the lineman is the agent that receives findings |
| 60 §5 auditor | unchanged; model id and sampling env added |
| 61 | the Oracle output schema becomes `board_reading.v1` for all three boards; unchanged for Self |
| 62 | `SelfReading` gains `oracle` and `board`; Love and Work share it |
| admin 10 | tabs Families, Oracle Studio and Staging; Research Lab retired; consent gate stays off during QA as decided tonight |

## 13. Findings to file in `docs/TODOS.md` (not fixed here; this plan does not edit other files)

The Opus review's findings (§14) are filed by that session. These are additional, found while writing this plan:

1. **P2: the Research Lab hydration never calls the engine**; `buildSelfResearchDashboard` synthesizes digest and activation
   rows (`synthesizeResearchDigestAndActivations`), while admin doc 09 §4.1 says live hydration exists. Superseded by §10.
2. **P2: `oracle.ts runSelfOracle` passes no `cachePrefix` / `cacheOwner`** and sends the brief to both the reader and the
   Oracle, against the AGENTS.md sub-agent rule. Superseded by `oracles/run.ts` (§14.5 has the rest of that layer's faults).
3. **P3: `GEMINI_FLASH_MODEL_ID` defaults to `gemini-2.0-flash` in `env.ts`** while docs say the live value is 2.5-flash;
   2.0-flash's explicit-cache minimum is higher. The dry run prints the resolved model ids so this is seen.
4. **P3: `self.reading.oracle`'s contract names `user: ['FACTS', 'TODAY']`** but the code sends `TODAY` inside the brief
   text; retire the row with `oracle.self`.
5. **P3: the recycler also evicts `kundli_day_overlays`** of idle kundlis (`cacheSweep.ts`), which the day-grain phase (§7)
   will read daily; decide its exemption with §14.4's rule before phase 6.

## 14. Findings from the Opus review (received 2026-11-07 night; file:line on `develop`)

Each finding names the step of §15 that fixes it. Together they are Phase 1: the current method made to work before any
model call.

### 14.1 Why a fully cached You load takes 2.3–4.9 s (→ step 1)

| Finding | Where | Fix in this plan |
|---|---|---|
| About 10 serial round trips plus 9 `agent_runs` inserts and 9 hit-count updates per cached load | `service.ts`, `outputStore.ts:364-390` | the `board.bundle` row: one read on a hit; run rows and hit counts written fire-and-forget in one batched statement |
| The kundli is read twice | `service.ts:161`, `load.ts:60` | one read, passed down |
| `kundliDigest.findMany` decrypts every section and varga including the unused `source`; memoised only 5 min in process | `load.ts:66` | select without `source` on the board path; the bundle row makes the digest read unnecessary on a hit |
| Activation: `groupBy` plus two `findMany` where one `activationFor` with `shortTo` / `shortMaxLevel` would do | `service.ts:91,176-179` | one activation query |
| The whole sky overlay decrypted only to set `skyStored` | `boardService.ts:58-63` | an `exists` query; the overlay is decrypted only when F-Sky or the body panel runs |
| The diagnosis is a second serial round | `service.ts:255` | the diagnosis is built in process from the bodies and stored with the bundle, not through a second store round |
| `readingDossier.findFirst` on every cached load, returning the newest dossier of any scope or date | `service.ts:291` | the bundle row carries its own `dossierId` |
| Shared work repeated per load: `runningChain` ×5, `runningMudda` ×2, `collectData` twice, purview, boundaries and audit recomputed on cached loads | `service.ts` | computed once at build time; a cached load computes nothing |

### 14.2 Runs and dossier completeness (→ steps 1, 8)

| Finding | Where | Fix |
|---|---|---|
| Clock, purview and audit run as plain functions outside `withAgentRun` / `withTechniqueOutput`: 0 runs, absent from the dossier's technique list | `service.ts:173,253-254,280`, `dossier.ts:103` | `self.reading.clock`, `self.reading.purview`, `self.reading.audit` (and the Love/Work instances) run through `withAgentRun` at build time and appear in `techniques[]`; the validator and the linemen the same |
| `self.reading.oracle` is never called | `oracle.ts` | retired into `oracle.self` (§4.1.4), always through `withAgentRun` + `withTechniqueOutput` |

### 14.3 Headers that disagree with lines (→ step 1)

| Finding | Where | Fix |
|---|---|---|
| The struggle header count is taken before the purview veto, and the vetoed claim held one of the `MAX_CLAIMS` 6 slots | `struggle.ts:79`, `purview.ts:56-63` | purview runs before the lead and the count; a vetoed claim frees its slot (the panel re-ranks after `applyPurview`) |
| The yogas header counts all rows while the card shows 2 gifts and 1 knot | `yogas.ts:38-40`, `card.ts:39-42` | the lead is written from the card's lines, not the claim list, for every panel (`card.ts` returns the lead) |
| A line's range can exceed the panel's header range | `card.ts:30`, `struggle.ts:74-77`, `body.ts:32-46` | `card.ts` clips a timing line's range to the header range or moves the line to the chapters card; the validator (§4.1.4) rejects an Oracle line outside its header range (`range_outside_header`) |

### 14.4 Cache keys and the store (→ step 1)

| Finding | Where | Fix |
|---|---|---|
| The body key ignores `skyStored` | `service.ts:241` | `skyStored` and the overlay's hash join the body panel's `digestVersion` suffix; F-Sky's pack hash does the same for the model tier |
| A new TP year does not invalidate the year panel, which reads TP by the VP year | `year.ts:30`, `service.ts:183-185` | the year window is the TP span (TP start to the next TP start) and the VP Mudda span is the sub-range inside it; the key carries the TP year |
| The 45-minute recycler deletes immutable natal outputs | `outputStore.ts:357,488-533`, `cacheSweep.ts:215` | the recycler stops deleting `technique_outputs` whose window is open (natal) or whose `made_by_kind = 'llm'`, and `board.bundle` rows, before `valid_to`; it keeps evicting provider caches, memos and transit-bound code outputs |
| Struggle is keyed on L3 but reads only L1–L2 | `service.ts:187` | keyed on L2; the release date it prints is an L1/L2 end |
| Chapters settings (`SELF_CHAPTER_BOUNDARY_MONTHS`, `SELF_CHAPTER_CONFIRM_MIN`) not in the key | `chapters.ts:24,34` | every env setting a panel reads is hashed into `SELF_READING_VERSION`'s successor, `boardCodeVersion(board)` = code version + settings hash |
| A lab `force` run never writes the store | `service.ts:212-213` | `force` bypasses the read and still writes (`ON CONFLICT DO UPDATE`) so the next load sees the forced build |

### 14.5 The model layer as written (→ steps 5–7; all superseded)

| Finding | Where | What replaces it |
|---|---|---|
| `runSelfOracle` calls `callGemini` directly, no `withAgentRun` or `withTechniqueOutput` | `oracle.ts:51-56` | `families/run.ts`, `linemen/*`, `oracles/run.ts` all wrap both |
| The BRIEF carries all ~55–65 claims (~5–6.5k tokens), not only card lines | `oracle.ts:22-37` | the Oracle receives the lineman brief (≤ 4 candidates per panel, ≈ 4k tokens); families receive packs, not claims |
| No `responseSchema`; the reader's output is never validated; the validator keeps uncited paragraphs | `oracle.ts:40-48` | every model call sets `responseSchema` (`family_findings.v1`, `lineman_brief.v1`, `board_reading.v1`, `audit.v1`); the code gate and the card validator reject, never keep by default |
| `_shared.md` describes JSON dot-path evidence ids while the BRIEF uses `planet:D1.Mo` keys | `readers/_shared.md`, `oracle.ts` | `families/_family.md` and `linemen/_lineman.md` name the digest key vocabulary (`planet:`, `house:`, `point:`, `yoga:`, `star:`, `annual:`, `activation:`, `sky:`); the chat readers keep theirs |
| Prompt caching cannot work: no `cachedContent`, each system prompt under ~1k tokens (below the 1,024 / 2,048 minimums), `TODAY` on line 2 of the BRIEF, reader and Oracle with different system prefixes | `oracle.ts` | the cached prefix is `system + parts[0] = pack` (3–6k tokens, above the minimum); `TODAY` and the `RUNNING` line go in `parts[1]` (the suffix); one prefix per family per person; the lineman and Oracle prefixes are their prompts and are cached only when above the minimum (the dry run reports the token count and says which calls will cache) |
| R15 has 4 patterns, one apparently written for one chart; missing Parashari lordship (kendra/trikona, yogakaraka, 6/8/12, maraka, badhaka, dispositor strength, Chandra lagna) and Jaimini (rasi drishti, houses from karakamsa, AK with AmK, 12th from AL, UL); dashas read only as houses activated plus 2/12 and 6/8 | `readers/R15-self.md` | the rules catalogue (step 4) carries these as rule ids with sources; `families/rasi.md` (lordship, dispositor, Chandra lagna, maraka and badhaka from the digest's `functional`), `families/varga.md` (karakamsa, AK with AmK, rasi drishti where the engine stores it), `families/dasha.md` (star lord, houses from lagna and Moon, age of the period, charter cells) replace R15's pattern list; no pattern may name one chart |
| `oracle/self.md` asks for 450–700 words of prose under 8 headings, contradicting doc 61's dated cards | `oracle/self.md` | rewritten to `board_reading.v1` lines (§4.1.4) |

### 14.6 Cost (→ §5)

Opus's estimate for the two-call layer as written: ~15k input + 3–4.5k output per build; about $0.013–0.016 on
gemini-2.5-flash, $0.05–0.065 on gemini-2.5-pro at list price. This plan's model tier is 7 calls for Self ($0.037) and 11
for three boards ($0.071) on the §5.1 ids; the difference buys five gated family findings and a lineman per board instead of
one ungated reader. **`gemini-2.5-pro` is missing from `PRICES` in `models.ts` and would be recorded at $0**; step 1 adds
it (and any id the dry run resolves that is not in the table fails the dry run instead of printing $0).

### 14.7 Admin lab (→ step 9)

| Finding | Where | Fix |
|---|---|---|
| The bundle hash excludes trigger, step timings, scope and cached flags, so a manual run can return an older row's timings | `dossier.ts:109`, `writeDossier :117-118` | the dossier row is unique on content (`bundle_hash`) and a `dossier_runs` child row (or `runs jsonb` appended) records each build's trigger, scope, timings and cached flags; the lab shows the run, not the row |
| `stripBirthFields` drops any `question` key, so the confirm question never reaches the lab | `dossier.ts:153` | the refused letters list drops `question` (it protected chat question text, which the dossier never holds); `reading_traces.question` stays refused in the admin API by name |
| `/people` swallows DB errors as an empty list | `adminLabRoutes.ts:124` | a failed query returns `503 people_unavailable`; QA mode (every unlocked account with a kundli, admin may run; server 46c241c, admin ceea3b8, awaiting redeploy) stays until Sachin ends it |

### 14.8 Two live findings on Sachin's kundli (filed in TODOS, develop 3948db1; → step 2)

| Finding | Where | What this plan does |
|---|---|---|
| **P1: the old You board headline reads "open / likely"** ("A clear stretch for a fresh start", "Most of your chart points this way") while the main clock and his reading clock (Dwisaptati) both vote test; `presentTone` counts rasi, karaka and annual supports equal to the main clocks | `houseLayers.ts:754-760` | **The tone card is retired from the first screen.** "Your reading" (the In-short card, dated, from the code panels now and the Oracle later) is the first tab of You, Love and Work; the old board tabs stay behind it without the tone headline and the clock count. Until the old tabs are removed, `presentTone` weights the reading clock's vote as decisive (test when it says test), the main clock second, and the other families as confirmation only, and the headline phrase is replaced by the In-short diagnosis line. A test on `c584c0a3` asserts no "clear stretch" while the reading clock votes test |
| **P2: the Work board (`getCareer`) took 8.1 s cold and pulls `transit_contacts` from the engine live at request time (2024-11..2028-11)** | `careerService.ts` | the transit-contacts pull moves into the digest sweep (`digest.transit_contacts`, stored in `kundli_transit_overlays` with the span and refreshed by the sweep when the span's end is within 6 months), and `getCareer` reads the stored rows only; a request with no stored rows returns `preparing` and queues the pull, as the digest does. Love on his kundli is steady/split; the Love and Work reading panels are built in step 2 |

## 15. Action steps in sequence

Each step names its files and its "done"; steps marked ∥ run in parallel as background sub-agents on their own branches
(AGENTS.md "Work in parallel by default").

1. **Make the current method work: load path, store, keys, headers, runs** (§14.1–14.4, 14.6; `service.ts`, `load.ts`,
   `boardService.ts`, `outputStore.ts`, `cacheSweep.ts`, `card.ts`, `struggle.ts`, `yogas.ts`, `year.ts`, `chapters.ts`,
   `models.ts`, M41, `board/bundle.ts`). Done: a second You open on the Lambda reads one `technique_outputs` row and runs
   under 300 ms server time; one kundli read, one activation query, no sky decrypt on a hit; `agent_runs` and hit counts
   batched fire-and-forget; clock, purview and audit have runs and appear in the dossier; every header equals its lines
   and no line range exceeds its header; the body key carries the sky, the year key the TP year, the code key the settings
   hash; `force` writes; natal and `llm` rows survive an idle sweep; `gemini-2.5-pro` priced and an unpriced id fails the
   dry run. ∥ with 2 and 3.
2. **Three boards on the code floor, tone card retired, Work transits stored** (§14.8; `BoardFrame`, shared panels moved to
   `src/reading/board/panels/`, Love and Work code panels, word tables, purview rules, routes `GET /api/love/reading`,
   `GET /api/work/reading`, lab `board_not_built` removed, catalogue rows `built`; `houseLayers.ts presentTone` weights the
   reading clock first and the headline is the In-short line; `digest.transit_contacts` in the sweep and `getCareer` reading
   stored rows only). Done: golden tests on `c584c0a3` for all three boards; code audit passes; web banned-word scan passes;
   no "clear stretch" on `c584c0a3` while the reading clock votes test; `getCareer` cold under 1 s with stored rows and
   `preparing` without them. ∥ with 1, 3.
3. **Family packs and layouts** (`families/packs/*`, `layouts.ts`, `scripts/board-build.ts --dry`). Done: the five packs for
   `c584c0a3` print with token counts within §5.2's estimates (±20 percent) and no astrology computed in Node. ∥ with 1, 2.
4. **Rules catalogue** (`src/reading/rules/catalog.ts`: id, tradition, source line, boards, text) seeded from the purview rules,
   doc 59's contracts, docs 42–43 and R08/R09/R15. Done: every purview rule and every family prompt pattern names a rule id.
5. **Family agents** (`families/run.ts`, `schema.ts`, prompts `families/*`, registry and catalogue rows, `SUBAGENT_DIGEST_SPECS`,
   `subagentCachePlan`). Done with a fake model: cache hit path, gate drops, store rows, `agent_runs` tagged; no live call.
6. **Linemen** (`linemen/*`, prompts). Done with a fake model: frame filter tests (a Love lineman never receives a work-only
   finding), brief assembly golden.
7. **Oracles and validator** (`oracles/*`, prompts `_core.md`, `self.md` rewritten to cards, `love.md`, `work.md`). Done with a
   fake model: validator drops a 23-word line, an unknown claim id, a non-boundary date, a banned word, a code contradiction.
8. **Build, triggers, locks, store abstraction** (`board/build.ts`, `triggers.ts`, `locks.ts`, `store.ts`, events, sweep, env
   helpers, cost guard wiring). Done: a full fake-model build writes dossier (M44 fields), bundle and runs; two concurrent
   builds make one set of calls; the sweep queues only ended windows for active people.
9. **Admin-lab server routes** (`adminLabRoutes.ts`: stage, dry, replay, prompts, evals (M42), cohorts (M43); §14.7: per-build
   run records beside the content-keyed dossier, `question` no longer stripped, `/people` returns 503 on a failed query).
   Done: contract tests; `stripBirthFields` on every response; the confirm question shows in the lab; a manual run shows its
   own timings; dry returns USD per stage with zero calls.
10. **Admin API and web** (lab proxies, Families tab, Oracle Studio, Staging, Research Lab retired). Done: `noPersonalFields`
    and `assertLabRunSafe` pass; a replay of a stored dossier against a draft renders cards with validator marks. ∥ with 8–9
    against the contract types.
11. **Staging hydration through the engine** (`cohorts.ts`, `match.ts`, repo parameters in `chartData/store.ts` and
    `digest/build.ts`). Done: a random cohort of 3 hydrates into `research_*` with engine calls counted and digests ready; S3's
    spec matches or reports unmatched.
12. **Auditor model half** (`audit/model.ts`, `oracle/auditor.md`). Done with a fake model: receipts shape; fail blocks the
    Oracle cards and writes the activity row.
13. **Dry run on S1**: `scripts/board-build.ts --kundli c584c0a3 --board self --stage all --dry` prints packs, token counts,
    resolved model ids and USD. Hand the numbers to Sachin with the key name. **Stop.**
14. **First paid run on S1** after the yes (§5.4 phase 3 line 1); Sachin reads the Self cards against doc 62's code cards in
    the Studio; grades; the auditor's receipts reviewed. Then S1 Love and Work; then S2–S8 (hydrated through §11 or matched).
15. **Focus group of 20** (phase 4 line) after the yes; Studio training week with `LAB_DAILY_USD` raised with the yes.
16. **Real people behind `BOARD_MODEL_LAYER=1`** for the first 100 after the yes; audit on every build; pass rate tracked on the
    Agents page; sample to 20 percent after four weeks above 95 percent.
17. **Day grain** (§7) after 16 and the two-week diary.

## 16. Development phases

| Phase | Steps | Leaves the system | Check | Cost |
|---|---|---|---|---|
| 1 Fast and whole | 1, 2 | three boards with code cards, one-row loads, headers equal to lines, every stage a run, keys that invalidate on what changes, the recycler safe for natal and paid rows, the tone card retired, Work transits stored | second open < 300 ms server time on the Lambda; Love and Work goldens; `c584c0a3` shows no "clear stretch"; `getCareer` cold under 1 s | 0 |
| 2 Machinery without a model | 3–12 | packs, agents, linemen, Oracles, validator, build, triggers, Studio, Staging, engine hydration, all on fake models | every test green; a dry run prints the exact calls and USD; a staging cohort hydrates through the engine | 0 |
| 3 First readings | 13, 14 | S1 and S2–S8 read by the real agents, audited, graded in the Studio | Sachin recognises his own chapters in the Oracle's cards; auditor pass on S1; must-say / must-not-say on S2–S8 | ≈ $2.20 |
| 4 Focus groups and training | 15 | twenty synthetic people on all boards; Sachin's prompt versions graded against them | a promoted `oracle/self` version with hand pass rate above the baseline and audit ≥ 90 on the deck | ≈ $5 + ≤ $35/week |
| 5 Real boards | 16 | the model layer on for real people; code cards as the floor | pass rate above 95 percent for four weeks; `oracle.status = 'ready'` on Sachin's own three boards | ≈ $11 per 100 people |
| 6 Day grain | 17 | the Right-now strip on the Self board | two-week diary on S1; day lines audited | ≈ $0.004 per active person per day |

## 17. Ingredients

| Need | Who |
|---|---|
| Migrations M41–M44 (additive) applied on the shared database | agent (standing OK for additive migrations) |
| The live Gemini key, model ids and the yes per §5.4 line | Sachin |
| `BOARD_MODEL_LAYER`, `READING_MODEL_*`, `BOARD_BUILD_*`, `LAB_DAILY_USD`, `ADMIN_LAB`, `ADMIN_LAB_TOKEN` on the Lambdas | deploy sub-session, after the yes |
| EventBridge rule for `board-build-sweep` (same 15-minute schedule as the digest sweep, or the same event with a second name) | deploy sub-session |
| Engine reachable from the Lambda for staging hydration (as registration already does) | exists |
| Review of the word tables for Love and Work, the family prompts' pattern lists, and `oracle/_core.md` | Sachin (astrology), agent (drafts) |
| Scenario specs S2–S8 as matcher rules | agent, from the scenario files |
| Sachin's own account as the first real person | Sachin |

## 18. One recommendation

**Keep the deterministic panels as the floor of every board, and put the model tier above them as five family sub-agents
whose findings are stored once per person per window and fanned into one lineman and one Oracle per board; cache at every
boundary; let nothing cost money on a page load; and give Sachin an Oracle Studio that replays stored dossiers against prompt
versions under a daily cap.**

| Choice | Verdict |
|---|---|
| Five frame-agnostic family agents, one lineman and one Oracle per board (chosen) | bounded cost (11 calls for three boards), whole-chart reading, three-way reuse of findings, every stage replayable |
| One Oracle for all boards | one prompt cannot carry the Self, Love and Work charters specifically enough |
| One Oracle per panel or tab | thirty prompts, no voice, ten times the calls, a diagnosis that cannot see the parts |
| Per-board family runs (frame-specific packs) | three times the family cost for no gain the lineman's filter does not give |
| A model over the whole digest | the chat path's known failure; untraceable; no reuse |
| Rebuild on page load | money per open; the stored-window design is the whole point |
| Keep the Research Lab's templates | misleads the review it exists for; staging must go through the engine |
