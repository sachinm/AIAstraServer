# 65 — The Self dashboard as areas of the Oracle's reading: one voice per card, structured output, nothing dumped

Status: **plan, 2026-11-08 (late night),** for Sachin's finding on the live You page: the Oracle wrote a solid, thorough
reading of the self, and the dashboard showed a committee of template lines, two near-identical one-liners, a plan box,
and the whole essay in one card. "Presenting it on the dashboard should be easy." It is, once the Oracle is asked for a
dashboard and not for an essay. This plan says what changes in the prompt, the service, the contract and the page. It
changes no code; docs 58–64 are its inputs. Where it changes a decision of theirs it says so (§10).

Rules that bind every line: the calculation engine is the only source of astrological values and is never named in
anything a person sees; Node selects, joins and formats, it derives nothing; a line without grounding is withheld, never
softened; no paid model call runs before Sachin's yes on key, model, count and cost, and every phase states those.

## 0. Answer first

| Sachin's question | The answer |
|---|---|
| Why does the card read disconnected when the Oracle's reading is good? | **Two authors, one card.** The first lines are the code scorer's template sentences ("Your sense of self is lived through partnership"), then the Oracle's one-line summaries, same type, same weight, no hierarchy. The Oracle's actual prose never reached the panel: the prompt asked for an essay plus one-line PANEL_SYNTHESIS summaries, the service wired only the one-liners into panels, and the page dumped the essay whole. |
| Why two near-identical Oracle lines? | The lineman's prompt (`readers/R15-self.md`) also emits PANEL_SYNTHESIS, and `oracle.ts` parses the lineman text and the Oracle text together (`parseOracleStructuredBlocks(\`${linemanFindings}\n\n${oracleRes.text}\`)`), so every panel gets both authors' summaries. |
| Why wasn't the reading at least split into the areas? | It is now, on `develop` e380879 (doc 64 step 4b, waiting on the deploy): the service splits the Oracle text at its own headings into `panel.synthesis`. That is a stopgap: the sections still sit under the template lines, joint headings ("Who you are & Your soul's aim") feed two panels with the same text, and prose written as an essay is not a card. |
| What makes it "just work"? | **Ask the Oracle for the dashboard.** One structured answer (Gemini `responseSchema`, JSON) with, per area: headline, reading (collated prose), dates, actions, evidence keys, confidence, valid-until. The service validates every area against the stored rows, the page renders each area from that structure, the code lines move to Chart details as the audit layer and the fallback. One voice per card, no parsing of headings, no regexes over prose. |

## 1. Start: facts checked 2026-11-08 on the live You page and `develop` e380879

- `src/reading/self/card.ts` turns each panel's code claims into one to three `lines` (the template sentences);
  `service.ts` appends the Oracle's PANEL_SYNTHESIS lines as `<panel>.ai.N` after the code auditor. The page renders all
  `lines` in one list (`SelfReading.tsx LineView`), then `plan`, then (since e380879) `synthesis`.
- `oracle/self.md` asks for a seven-section essay, then PANEL_SYNTHESIS (1–2 lines per panel), PANEL_PLAN, PANEL_CALENDAR,
  VALID_UNTIL. On the 7:36 am build the model followed the essay and the lines and wrote **0 plans** in the asked format.
- `readers/R15-self.md` (the lineman) also asks for PANEL_SYNTHESIS; both texts are parsed; duplicates follow.
- `src/reading/llm/gemini.ts` supports `responseSchema` (forces `application/json`); the Oracle call does not use it.
- The Oracle's input is 45 k tokens (raw packs again) and its output 3.5 k tokens of essay (doc 64 §1); a structured
  per-area answer is about 1.5 k tokens.
- Doc 63 §4.1 decided the code panels are "the floor and the veto"; the page shows the floor as the card. Doc 62 is the
  card contract: one to three dated lines, 22 words each. Doc 64 §2 fixes the scope: the running Mahadasha, its
  Antardasha relationship, nothing beyond the current Mahadasha; one dated card per panel.

## 2. End goal

A person opens You and each area (In short, Your chapters, Who you are, Your mind, Your body, Your soul's aim, Gifts and
knots, What you struggle with, This year) reads as one piece written by one voice: a headline, two to four paragraphs
that collect everything the Oracle has to say about that area and nothing from another area, a dates table of the
windows it names, what to do in each window, and a confidence word on the timing. Chart terms, claim ids and the code
scorer's sentences sit behind "Chart details". No sentence appears twice. No raw markdown, no citation ticks, no
internal scores. While the Oracle writes, the panels show at once under the veil (doc 64 step 4b); when it fails, the
code lines stand in for that area only, and the admin sees why (doc admin/12).

## 3. Deliverable

1. **An area document contract** (`src/reading/self/types.ts`): `OracleAreaDoc { areas: Record<BoardPanelId, OracleArea> ;
   validUntil }` with `OracleArea { headline; paragraphs: string[]; dates: Array<{ from; to; label }>; actions:
   Array<{ from; to; text }>; certainty: 'strong' | 'likely' | 'possible'; evidence: string[]; validUntil }`.
2. **The Oracle asked for that document** (`oracle/self.md` rewritten; `callGemini` with `responseSchema` of the
   contract) within doc 64 §2's scope, on findings and claims only (doc 64 Phase 2 and 3), ≤ 1,500 output tokens.
3. **The lineman stops writing cards** (`R15-self.md` loses PANEL_SYNTHESIS; it joins findings into a brief, as doc 63
   §4 meant).
4. **The service validates and places** (`service.ts`): every evidence key resolves against the stored rows; every date
   falls inside a stored window; a failing area is dropped to the code lines with a gap; `panel.area` carries the
   validated document; `panel.lines` stays as the audit layer and the pending/failed fallback.
5. **The page renders areas** (`SelfReading.tsx`): headline, paragraphs, dates table (from `area.dates`), actions, the
   certainty word on the header; the code lines, claims and evidence under Chart details; the veil until the area lands.
6. **Charts from the engine rows, not the text** (Phase 3): Your chapters gets the dasha timeline (previous, running,
   next, with the Antardasha strip) from `kundli_activation`; This year gets the year calendar (Mudda / Tithi Ashtottari
   periods, the Patyayini window) from the digest's annual rows; Gifts and knots gets a table from the yoga rows.
7. **Lab and Dashboard loads show the area document** per panel (admin/12 answers tab: one entry per area).

## 4. How it works when done

**Backend.** The build event (doc 64) runs the code panels, the five family readers in parallel, the lineman on findings
and claims, then one Oracle call whose `responseSchema` is the area document. The Oracle receives the board instruction
(doc 64 §2 scope: running Mahadasha chain, Antardasha relationship, boundary of the current Mahadasha, no prediction
past it), the claims brief (ids, text, detail, dates, evidence), the lineman's brief and the family findings. It
returns JSON only. The service parses it, then for each area: drops any paragraph whose cited evidence key is not in
the brief or packs (today's `validateSelfText`, per paragraph), drops any date outside every stored window (today's
`inStoredWindow`), caps `paragraphs` at four and `headline` at 22 words, redacts engine terms, and runs the code
auditor over the headline and dates. An area that loses its headline or every paragraph is withheld: the panel shows
the code lines and the dossier records a gap. The validated document is stored in `technique_outputs` as today's
Oracle output (same key, same freshness window), so loads read it in under a second.

**API.** `SelfPanel` gains `area?: OracleArea` and `areaStatus: 'ok' | 'pending' | 'withheld' | 'failed'`;
`lines`, `claims`, `plan` (now `area.actions`) and `synthesis` stay for one release, then `plan` and `synthesis` go.
`reading.oracle` keeps `status`, `model`, `ms`, `costUsd`, `tokens`, `stages`, `error` for the admin; its `text`
becomes the serialised document for the Lab.

**Frontend.** Each panel card: the title; the header range and the certainty word; `area.headline` as the lead
sentence; `area.paragraphs` as prose; "Dates in this reading" from `area.dates` (no regex); "What to do" from
`area.actions`; then Chart details with the code lines, claims, evidence, vetoed claims and the Oracle's evidence keys.
Your chapters adds the timeline chart above the prose, This year the calendar, Gifts and knots the table (Phase 3). The
desktop tab list and the phone carousel stay (doc 45 rule 11). Pending: the code lines under the veil with the rotating
lines; failed: the code lines with no veil and no Oracle block; withheld: "Not enough in your chart to say this with
confidence." No two cards share a sentence: the service rejects an area paragraph that equals another area's.

**UI/UX.** One voice above the fold; the engineer's voice (claims, keys, scorer lines) below "Chart details". No
jargon rule enforced by word scans (Sachin, 2026-11-08): the prompt sets the register, the auditor checks facts. Dates
always as "16 Feb 2028"; ranges "16 Nov 2025 – 1 Jan 2027".

## 5. Architecture

```
code panels (claims, lines)          ─┐
family readers ×5 (findings, cached)  ├─► lineman brief (findings + claims, ~8k in, 1.5k out)
                                      │
                                      └─► Oracle, responseSchema = OracleAreaDoc (~10k in, ≤1.5k out, thinking low)
                                              │
                               validate per area: evidence keys ∈ brief ∪ packs, dates ∈ stored windows, caps, redaction,
                               code auditor on headline + dates, duplicate paragraphs rejected, withheld ⇒ code lines + gap
                                              │
                               technique_outputs (self.reading.oracle)  ─►  panel.area  ─►  card: headline · prose · dates · actions
                                                                                            chart details: lines · claims · evidence
```

What goes: the essay, PANEL_SYNTHESIS in both prompts, PANEL_PLAN/PANEL_CALENDAR text blocks and their regex parsers,
`splitOracleSections` and `datedStatements` (the stopgaps of doc 64 step 4b), the raw packs in the lineman and Oracle
prefixes. What stays: the code panels as audit and fallback, the purview, the auditor, the dossier, the store, the
background build, the veil.

## 6. Ingredients

Server: `src/reading/prompts/oracle/self.md`, `src/reading/prompts/readers/R15-self.md`, `src/reading/self/oracle.ts`
(schema, call, parse, validate), `src/reading/self/types.ts`, `src/reading/self/service.ts`, `src/reading/self/audit.ts`
(headline and dates), `src/reading/self/dossier.ts` (areas in the dossier), tests under `tests/unit/reading/self/`
with a fixture area document. Web: `src/lib/selfReadingApi.ts`, `src/pages/you/SelfReading.tsx` (AreaCard), `src/pages/
you/readingMarkdown.tsx` (prose only), Phase 3 `src/pages/you/charts/` (timeline, calendar, table). Admin: `labAdapter.ts`
and `admin/loads.ts` read `area` per panel. Config: `SELF_ORACLE_MAX_OUTPUT_TOKENS` to 1,500; model stays
`gemini-3.8-flash` for the Oracle, `gemini-3.1-flash-lite` for readers and lineman.

## 7. Action steps

1. Contract and schema: `OracleAreaDoc` types and the Gemini `responseSchema`; a fixture document; unit tests for the
   validator (unknown key drops the paragraph, date outside windows drops the date, empty area withheld, duplicate
   paragraph rejected).
2. Prompts: `oracle/self.md` rewritten to the area document and doc 64 §2 scope; `R15-self.md` without PANEL_SYNTHESIS;
   bundle regenerated. Lab replay on two stored dossiers against the new prompt (Oracle Studio, doc 63 §9) before any
   live build: 2 calls ≈ $0.10 (needs Sachin's yes).
3. Service: parse, validate, place `panel.area`; keep `lines` as audit and fallback; dossier carries the document;
   `panelLines`, `panelPlans`, `splitOracleSections` removed once the page reads `area`.
4. Web: `AreaCard`; Chart details takes the code lines; `plan`/`synthesis` rendering removed; tests for ok, pending,
   withheld and failed areas; the veil unchanged.
5. Admin: Lab "Oracle's answer" and Dashboard loads answers tab list the areas.
6. Phase 3 visuals from engine rows: chapters timeline, year calendar, gifts/knots table; each a component fed by the
   digest/activation rows already in the reading (no new engine call).
7. Measure on Sachin's and one research kundli: cold build time (target ≤ 15 s, doc 64 §5), tokens, cost, and a read
   of every area by Sachin for the "recognise your own chapter" test (doc 60).

## 8. Development phases

| Phase | Scope | Time | Model cost | Gate |
|---|---|---|---|---|
| A | Contract, validator, prompts, Lab replay on 2 stored dossiers | 1 day | ≈ $0.10 | every area validates; no duplicate; headlines ≤ 22 words; Sachin reads the replay |
| B | Service and web: areas rendered, code lines to Chart details, stopgaps removed | 1 day | $0 | tests green; live You page shows one voice per card |
| C | Visuals from engine rows (timeline, calendar, table) | 1 day | $0 | each chart matches the stored rows in the Lab's Chart data tab |
| D | Love and Work boards on the same contract | 0.5 day | ≈ $0.10 | same gates |

## 9. Recommendation

Do A and B together as one branch and ship them as one release: the contract is small, the prompt rewrite is the
real work, and half-measures (sections under template lines) are what Sachin is looking at now. Keep the code lines as
the audit and the fallback, never as the card. Start A tomorrow with the Lab replay on the two stored dossiers (the
7:36 am and the 21:20 builds), so the first judgment of the new prompt costs ten cents and no live page changes until
the replay reads right.

## 10. Decisions this plan changes

- Doc 62's "one to three lines, 22 words" card becomes the **headline** rule; the body is two to four paragraphs.
- Doc 63 §4.1's "code panels as the floor" stays, but the floor is shown only when the Oracle is pending, withheld or
  failed; otherwise it lives under Chart details.
- Doc 64 step 4b's section split and dates regex are retired by Phase B.
