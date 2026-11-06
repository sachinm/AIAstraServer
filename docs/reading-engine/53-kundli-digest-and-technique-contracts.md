# 53 — Digest once, then read: the kundli digest and the technique contracts

Status: **plan, 2026-11-05, written for Sachin's review; the catalogue rows and selectors ship with it (§8 step 0).**
Sachin's brief, in his words: it is not smart to have millions of agents finding the good, the bad, the yogas, the
aspects, conjunctions, dispositors and house lords on every question. One agent should do that once per kundli, store it,
mark the kundli "digested", and the synthesizer (the Oracle) should read it straight from the database, or from the
cache loaded from the database. The digest covers the dashas, D1 to D144, Tithi Pravesha for ten years back and ten
ahead, and every dasha system thirty years ahead. Transits are the same for everyone and are prepared separately.
After that a **technique** is only a statement of what it wants from which charts, systems and tables to synthesize
its answer. The techniques for General Reading, Self, Love, Work and Lucky times are written to that standard, the
clarify context selects them, and whatever the engine or the API Lambda still lacks is listed with its phase.

Short answers to the questions asked with the brief:

| Question | Answer |
|---|---|
| Did the engine get a yogas export that can be stored? | **Yes.** `yogas` (all 93 yogas with a present flag plus raja-yoga pairs, D1), `doshas`, and the dossier's `yogas` list are served and stored for the 24 digested kundlis. Not served: yogas in divisional charts, Tajaka yogas of the year chart (§7). |
| Is there a stored once-per-kundli breakdown? | **Half.** The dossier (`kundli_facts.dossier`) is a one-time D1 house-by-house digest built by the engine: lord, lord's house and dignity, occupants, aspects received (graha and rasi), argala, SAV, cusp star, yogas, doshas, karakas, arudhas, relations. **Nothing equivalent is stored for D2–D144, for the 30-year activation of each house by each dasha system, or for the annual charts beyond the current year.** Every question rebuilds its evidence pack from the dossier, and the Work board rebuilds its house cards in memory. |
| Do we have a valid technique to break the chart down the first time? | **No.** The dossier is the engine's `facts` export; its contents are fixed by the engine, there is no digest version or status per kundli, and no technique names what the digest must contain. This plan adds that technique (§4.1) and its status. |

## 1. Start (facts checked 2026-11-05 against the engine repo, the server on `develop` 731acc7 and the shared database)

**The engine** (one endpoint, `POST /api/export-horoscope`, 105 types; branch `release-candidate-staging` is live):

| Served today | Not served (function exists) | Not in the engine |
|---|---|---|
| D1–D144 (23 standard vargas), all placement rows; `dignities`, `aspects` (graha and rasi), `relations`, `arudhas`, `argala`, `house_counts`, `avasthas` in any varga; `yogas` and `doshas` (D1); `benefic_malefic` (D1); `ashtakavarga`; `strength.{shadbala,bhava,vimsopaka,harsha}`; `sphutas`; `charakaraka`; `bhava`; `reading_tables`; 43 dasha systems (levels 1–3) plus `dasha.applicable`; `annual.{varsha,tithi_pravesha,tithi_pravesha_dasha,mudda,patyayini,sahams}`; shared `transit`, `transit_range`, `transit_contacts`, `transits`, `transit_ashtakavarga`, `prashna`, `daily_grade`, `muhurta`; `biodata` (birth panchanga) | yogas in divisional charts (`yoga.get_yoga_details(jd, place, divisional_chart_factor)`), raja yogas per varga; Tajaka yogas (`tajaka_yoga.*`), muntha (`tajaka.muntha_house`), year and month lord (`tajaka.lord_of_the_year`); badhaka (`house.baadhakas_of_raasi`); surya and chandra arudhas; Sudarshana chakra dasha; `gauri_choghadiya`, `panchaka_rahitha`; vargas beyond the 23 (`custom_divisional_chart`, any factor to 300) | vedha; dispositor chains (the engine's own code adds them in `avasthas`); sahams for a night birth (always the day formula) |

**The server.** `kundli_data` is the vertical store (doc 20): one row per kundli, type, variant. For the 24 research
kundlis it holds 170 types: every varga to D144, 43 dasha systems (6 at level 3), dignities, aspects, relations, arudhas
and argala in 11 vargas, yogas, doshas, strengths, annual charts. Annual charts: **one kundli has 101 year rows (2026–
2035, D1/D9/D10); the other 23 have only the current year.** `kundlis.facts_status` says whether the dossier exists;
there is no digest status or version. The shared transit sky (`transit_range_skies`) covers 1975–2035 and the per-kundli
overlay (`kundli_transit_overlays`) gives houses from lagna, Moon and AL (doc 35).

**The reading flow.** Intake → (Clarify) → analysts in parallel per subject (promise, dasha, transit, nakshatra, annual,
prashna) → reconcile → synthesizer; or the Oracle flow's readers R01–R14 and P1–P3 → Oracle → validator. Each analyst is
fed an *evidence pack* cut from the dossier on every question (`packs/selector.ts ANALYST_SECTIONS`); each reader is fed
the CHART CORE (nine `kundli_data` types) plus its own tables (`oracle/readers.ts`). Dashas reach at most 36 months in the
packs and 10 years for readers; the annual analyst reads the current Tithi Pravesha only; `person_facts` (the companion
memory of doc 48) is not read by the General Reading at all; Clarify stores its slots in `reading_runs.intent.clarify`
and `intent_confirmed`. The Work board (doc 42–44) builds its house cards in memory from the dossier and five dasha
systems on every build and stores only the result (`area_builds`). Self and Love are planned rows only. Lucky times
scores tithi, nakshatra, vara and hora; **yoga and karana, two of the five limbs, are stored in the day table but never
scored.** The technique catalogue (docs/admin/03, 50 rows) names charts and steps but not the extraction contract
(which rows, in what table shape, into which prompt and output format), and nothing selects a technique from the
clarify context.

Symptoms a reader of the admin's Day review sees: the same chart facts recomputed per analyst per question (six packs
per subject), no agent able to say "house 7 in D9 is afflicted by X until Y" without re-reading the raw table, and no
way to tell whether a kundli's data is complete enough for a Love or Self board.

## 2. End goal

- **One digest per kundli, versioned and stamped.** `kundlis.digest_status` = pending → building → ready (or failed,
  stale); `digest_version` names the rule set that built it. The Admin Panel's Users list shows it; a board or a reading
  on an undigested kundli says "your chart is still being prepared" and queues the digest.
- **The digest is readable by anyone without recomputation**: house cards for D1 and every varga a technique names,
  planet cards, the yoga and dosha register, the activation calendar (every house × every dasha family, thirty years
  ahead, at level 3 for the six systems that offer it), the annual set (Tithi Pravesha and Varsha with their year
  dashas and sahams for ten years back and ten ahead), and the nakshatra profile. Every row carries the engine type,
  variant, calc version and JSON path it came from (doc 46 §C.3), so a reviewer can trace it.
- **A technique is a contract**: what it wants (digest tables, filtered by its selectors), the shape it is given in (a
  named tabular layout), the system prompt it runs under, the user-turn fields, and the output schema. The synthesizer
  above it has the same contract over its sub-agents' outputs. The admin's Techniques page shows the contract beside the
  algorithm.
- **The clarify context chooses the techniques.** The confirmed intent (subject, horizon, question type, slots) and the
  companion memory (`person_facts`) are matched against each technique's selectors; the chosen set is written on the
  trace so the Day review shows "this question ran these techniques".
- **General Reading reads every house of D1 through its specialised area, uses D2–D144 for the dynamics, and diagnoses
  with every dasha system, the relevant annual charts and the other systems**; Self, Love and Work boards read the
  digest; Lucky times scores all five limbs of the panchang and marks which rules are general and which are the
  person's.

## 3. Deliverable

| Area | Items |
|---|---|
| Server, data | Migration M31 (now): `technique_registry.selectors`, `contract`; `reading_traces.techniques`. Migration M32 (phase D1): `kundlis.digest_status`, `digest_version`, `digest_built_at`; table `kundli_digest` (kundli_id, section, key, row jsonb, source jsonb, digest_version) with a unique key (kundli, section, key). Migration M33 (phase D2): `kundli_activation` (kundli_id, system, level, lord_or_sign, from, to, houses jsonb) |
| Server, code | `src/reading/digest/`: `build.ts` (the digest technique, deterministic, engine rows in → digest rows out, no astrology), `status.ts`, `load.ts` (digest → cache prefix), `annualSet.ts` (pull ten years back and ahead), `activation.ts`; `src/techniques/contracts.ts` (the contract and selector types, the matcher); `src/techniques/catalog.ts` revised rows; `trace.ts` writes `techniques[]` on the trace; packs read the digest when `digest_status = ready` |
| Engine (own pass, Sachin's) | `yogas` with `varga`; `annual.tajaka` (muntha, year lord, month lord, Tajaka yogas); `badhaka` in `benefic_malefic`; night-birth sahams; `arudhas` surya/chandra; `muhurta` yoga and karana end times (already present) |
| Admin | Techniques page shows selectors and the contract; Users list shows the digest status; Day review lists the techniques a query ran |
| Docs | this plan; docs/admin/05 regenerated; AGENTS.md rule: a technique is a contract (§4.3) |
| Tests | digest builder on the G1 fixture (every row traceable, no astrology); selector matcher on the 17 subjects and the three boards; contract shape validation for every catalogue row; the no-astrology grep of doc 46 §C.3 over `src/reading/digest/` |

## 4. Exactly how it works when done

### 4.1 The digest technique (`digest.build`): the first-time breakdown

Deterministic, no model. Input: the kundli's `kundli_data` rows (fetched on demand by the existing
`ensureChartData`). Output: rows in `kundli_digest`, in six sections. It **selects, counts, joins and dates**; it never
derives a sign, a lord, an aspect, a dignity or a yoga (doc 46 §C.3; the no-astrology test guards it).

| Section | Key | Row (all values are engine fields; `source` = type@variant@calc_version + JSON path) | From |
|---|---|---|---|
| `house` | `D<n>.h<1..12>` | lord, lord's house and sign and dignity, co-lord, occupants (with each occupant's dignity and nature), aspected_by graha / rasi, argala (primary, secondary, obstructed), SAV, class (kendra, trikona, dusthana, upachaya, maraka, badhaka when served), cusp star and its lord, arudha of the house, the Tajaka lord when the year chart is loaded | `dignities.dN`, `aspects.dN`, `argala.dN`, `arudhas.dN`, `house_counts`, `ashtakavarga`, `facts.houses` (D1) |
| `planet` | `D<n>.<planet>` | sign, house, degree, star and pada and star lord, dignity, retro, combust, war, dispositor and its house, dispositor chain (D1, from `avasthas`), avasthas, shadbala rank and ratio (D1), natural and functional nature (D1), owns houses, aspects_to, aspected_by, conjunctions (same sign; within 8° from `avasthas.proximity_audit`) | `dignities.dN`, `aspects.dN`, `relations.dN`, `avasthas.dN`, `strength.shadbala`, `benefic_malefic` |
| `yoga` | `D1.<yoga id>` | present, planets, houses, class (raja, dhana, mahapurusha, dosha, cancellation), source rule | `yogas`, `doshas`, `facts.yogas`; per varga once the engine serves it |
| `point` | `AK…DK`, `A1…A12`, `UL`, `AL`, `SL`, `HL`, `GL`, `IL`, `MD`, `GK`, sphutas | the point's sign and house in D1 and in each named varga, its lord and the lord's place | `charakaraka`, `arudhas(.dN)`, `sphutas` |
| `annual` | `TP<year>` and `VP<year>`, ten years back to ten ahead | the year chart's lagna, house lords and occupants, aspects, sahams in houses, year dasha (Tithi Ashtottari, Mudda, Patyayini) periods, muntha and year lord once served | `annual.*@year=Y` (D1, D9, D10) |
| `star` | `profile` | Moon star and its lord, lagna star, the 27-star tara table from the Moon, gandanta flags | `facts.nakshatra_profile`, `panchanga.birth` |

**The activation calendar** (`kundli_activation`, M33, phase D2): every period of every served dasha system (43 graha and
rasi systems; level 3 for the six that offer it) from birth to thirty years ahead, each with the houses it activates as
the engine states them: for graha dashas the lord's house, the houses it owns and the houses it aspects (from the
`planet` cards); for rasi dashas the sign's house and its lord's house. One row per period, so "which periods activate
house 7 between 2027 and 2030 under any system" is one indexed query. The Work board's five families and the planned
Self and Love layers read this table instead of rebuilding a grid.

**Status.** `digest_status` moves pending → building (one job, idempotent, re-entrant) → ready with `digest_version`
and `digest_built_at`; `stale` when the engine commit or calc version of any input row changes, or when a new digest
version ships; `failed` with the error type. The sign-up flow queues the digest right after the registration pull; a
reading or board on a non-ready kundli says the chart is being prepared and queues it. An admin action "Rebuild digest"
exists on the User page (audited).

**Cost.** One pass per kundli, roughly 170 stored rows read and 1,500–3,000 digest rows written, under 10 s on the API
Lambda with the data already in `kundli_data`; the annual set for ±10 years is 21 years × 3 vargas × 6 types ≈ 380
engine calls, batched at registration in the background (about 25 per minute within the engine's rate).

### 4.2 Reading from the digest: packs, cache, Oracle

- `packs/selector.ts` gets a second source: when `digest_status = ready`, every section it renders is read from
  `kundli_digest` rows filtered by the technique's selectors (houses, vargas, planets, points, year span), and rendered in
  the technique's table layout. The dossier path stays as the fallback until every live kundli is digested.
- The cacheable prefix (doc 23 §3.5; `llm/promptCache.ts`) becomes **the digest rendered once per kundli**: the CHART CORE
  layout of the Oracle readers is replaced by the `house` and `planet` sections of D1 plus the subject's vargas, which is
  byte-identical across questions, so the explicit cache hits on the second question of the day as it does today, with
  less to rebuild.
- The Oracle (synthesizer) receives its readers' findings as now, plus the digest rows the findings cite (by key), so it
  can quote `D9.h7.lord_dignity` without a reader having copied it.

### 4.3 A technique is a contract

Every catalogue row gains two fields, stored in `technique_registry` and shown in the admin:

```ts
selectors: {
  subjects?: SubjectId[];            // frames.ts ids: career_work, marriage_relationship …
  boards?: ('chat'|'you'|'love'|'work'|'lucky')[];
  houses?: number[];                 // the D1 houses it is about
  vargas?: string[];                 // D1, D9, D10 …
  questionTypes?: string[];          // intent.questionType: timing, yes_no, explain, …
  horizons?: string[];               // intent.horizon
  facts?: Record<string, string[]>;  // person_facts keys and values that switch it on (work.status = between_jobs)
  slots?: string[];                  // clarify slots that must be present (other_person, specific_event)
}
contract: {
  inputs: Array<{ section: 'house'|'planet'|'yoga'|'point'|'annual'|'star'|'activation'|'transit'|'panchang'|'prashna';
                  filter: string;    // e.g. "D1,D10 houses 10,6,1" or "activation houses [10,6] years ±3"
                  layout: string }>; // a named table layout in src/techniques/layouts.ts
  system: string;                    // prompt file: prompts/v2/dasha.md, readers/R08.md …
  user: string[];                    // user-turn fields: TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS
  output: string;                    // schema name: findings.v2, findings.v3, career_map.v1, windows.v1
  synthesizer?: string;              // the technique that consumes this output
}
```

Code techniques (the boards, the digest, lucky times) have `system: 'none'` and an output type instead of a schema name.
The matcher (`src/techniques/contracts.ts selectTechniques(intent, facts, board)`) returns the techniques whose selectors
all match (an empty selector matches everything); the chosen ids are written to `reading_traces.techniques` (M31) and
to each span, so the Day review shows them. Unit tests assert every subject and board selects at least one built or
planned technique, and that no two built techniques with the same output claim the same selector set.

### 4.4 General Reading: the house-led technique set

The general reading is organised by **the D1 house that owns the subject** (doc 46 §B.11 sub-areas; frames.ts houses),
read in depth through D2–D144, with every system allowed to speak. One analyst per layer, each a contract:

| Technique | Selectors | Inputs (digest) | System prompt | Output |
|---|---|---|---|---|
| `general.house_promise` (replaces `general.promise`) | subject → houses from the frame | `house` D1 + the frame's vargas for those houses; `planet` cards of their lords and karakas; `point` arudhas and special lagnas; `yoga` touching those houses or lords | `prompts/v2/promise.md` + the house curriculum (doc 33 R2) | `findings.v3` |
| `general.varga_dynamics` (new) | subject → vargas (D9 for marriage, D10 for career, D2, D4, D7, D24, D12, D30, D60 by frame; D16, D20, D27, D40, D45, D81, D108, D144 when the question type is `explain` or `life`) | `house` and `planet` of each named varga for the frame's houses; the D1↔Dn agreement flags (lord dignity in both, occupants in both) | doc 33 R3 varga reader | `findings.v3` |
| `general.dasha_all_systems` (replaces `general.dasha`) | horizon | `activation` rows inside the horizon for the frame's houses, every served system, grouped into the seven families of doc 46 §B.4; the running MD/AD/PD of Vimshottari at level 3; `dasha.applicable` | doc 33 R8 + R9 | `findings.v3` with `actors[]` and `windows[]` |
| `general.annual_set` (replaces `general.annual`) | horizon within 24 months, or question type `timing` | `annual` rows for the current, previous and next year (TP and VP, D1, D9, D10), their year dashas, sahams in the frame's houses, muntha and year lord when served | doc 33 R11 | `findings.v3` |
| `general.transit` (revised) | horizon | shared sky + the kundli's overlay for the frame's houses; contacts to the lords and karakas; double transit; sade sati; eclipses; `transit_ashtakavarga` scores | doc 33 R10 | `findings.v3` |
| `general.nakshatra` (revised) | always | `star` profile; cusp stars of the frame's houses; star lords' places from `planet` | doc 33 R7 | `findings.v3` |
| `general.strength_yoga` (new) | always | `yoga` register filtered by the frame's planets and houses; shadbala ranks; SAV of the frame's houses; avasthas | doc 33 R5 + R6 | `findings.v3` with `graces[]` |
| `general.jaimini` (new) | always for tier 1; subjects with chara karakas or arudhas in the frame | `point` cards (AK, AmK, DK, UL, AL, A-houses); argala on the frame's houses; Narayana and Chara periods from `activation` | doc 33 R4 | `findings.v3` |
| `general.prashna` | prashna cast exists | the cast | `prompts/prashna.md` | `findings.v3` |
| `general.person` (new) | slot `other_person` or a person subject (children, siblings, marriage) | the person's house and karaka cards (doc 33 R13) | R13 | `findings.v3` with `about` |
| `general.oracle` (revised) | always | the findings above + the digest rows they cite + `person_facts` (companion memory) + REAL_WANT | `oracle/system.md` + template T11 | streamed answer |
| `general.validator` | always | question, clarify turns, answer | `oracle/validator.md` | `{answered, parts[]}` |

Every analyst's user turn carries FACTS: the confirmed `person_facts` that the selectors matched (work status,
relationship status, self focus), so the rule "specific to this person or not shown" (AGENTS.md) is enforced at the
prompt, not only in the synthesizer.

### 4.5 Self, Love and Work boards: digest readers

The three boards are the house-state engine of doc 46 run from the digest. Each layer is one technique with one
contract; code paths first (Phases D1–D3), model readers only after the spend yes (doc 46 §D.1).

**Self (You board; houses 1, 4, 5, 9, 12 and the Moon).** Inputs: `house` D1 h1/h4/h5/h9/h12 plus D9, D20, D24, D12 for
the same; `planet` cards of lagna lord, Moon, Sun, 4th and 5th lords, Mercury, Jupiter, Ketu, AK; `yoga` (mahapurusha,
raja, kemadruma and its cancellation, doshas on the Moon); `point` AK, SL, AL. Techniques:
- `self.promise`: what supports the self (dignified lagna lord, Moon's strength and SAV, benefic aspects and argala on 1,
  4, 5), each as a row "D1.h1 aspected_by Ju";
- `self.affliction`: what works against it and *until when* (malefics on the lagna lord or Moon, Sa/Ra/Ke on 1/4/5,
  gandanta Moon, Kemadruma), with the release date from `activation` (the end of the afflicting planet's running period);
- `self.protection`: the aspects and yogas that **protect** the self: Jupiter's drishti on lagna or Moon, Neecha Bhanga
  and other cancellations, benefic argala, the dispositor of the lagna lord being strong (digest `planet` chain);
- `self.activation`: periods thirty years ahead from `activation` that activate 1, 4, 5, 9, 12, graded benefic or
  malefic by the period lord's nature and dignity in D1 and D9;
- `self.transit`: the shared sky over lagna, Moon, 4, 5 (Sa, Ju, Ra/Ke, eclipses), sade sati phases;
- `self.annual`: the TP and VP years in range with lagna lord, Moon and muntha in 1/4/5/9;
- `self.nakshatra`, `self.varga`: as doc 46 §B.7–B.8.
The board shows the person's tone (doc 45 §7) from the votes of these layers, with the companion memory's `self.focus`
choosing which sub-area leads (doc 46 §B.12 Self rows).

**Love (house 7 with 5, 11, 2, 4, 8, 12, Venus, Jupiter, the Moon; D9).** The same eight layers over h7 and D9, with
`love.protection` (Jupiter on 7/Venus/UL, D9 7th lord dignified, benefic argala on UL), `love.strain` and
`love.reconcile` as doc 46 §B.12 rows, and the companion memory's `love.status` (single, dating, married, separated)
selecting `love.meet` vs `love.health` vs `love.reconcile`.

**Work (house 10 with 6, 1, 2, 11, 3, 9, 12; D10).** The five built functions keep their ids and gain contracts and
selectors (`work.status` from the companion memory); `work.annual_family`, `work.conditional_family`, `work.karaka_family`
and `work.d10_check` become built by reading `activation` (the conditional systems from `dasha.applicable`, the karaka
dasha, the annual set) and the D10 house cards, which closes the families doc 43 §8.1 asked for.

### 4.6 Lucky times: the five limbs, general and personal, and 2–4 week universal prepull

The panchang is five limbs: **vara** (weekday, its lord), **tithi** (the lunar day; nanda/bhadra/jaya/rikta/purna),
**nakshatra** (the Moon's star), **yoga** (Sun+Moon longitude sum, 27 yogas), **karana** (half tithi, 11 karanas). The
tool exists to pick a moment whose five limbs favour the act (Muhurta Chintamani; B.V. Raman, *Muhurta*). Everything in
Lucky times is 100% deterministic (`engine_pull` + `code`, zero AI/LLM):
- **Universal 2–4 week prepull across 5 reference timezones (`prepullUniversalDayTables`)**: because the base panchang
  and muhurta day tables are universal for users in a timezone, `src/config/env.ts` configures 5 reference timezone
  places (`LUCKY_REFERENCE_PLACES`, `LUCKY_HORIZON_DAYS=28`): US Eastern (`America/New_York`, `us-east` / `newyork`),
  US Central (`America/Chicago`, `us-central` / `chicago`), US Mountain (`America/Denver`, `us-mountain` / `denver`),
  US Pacific (`America/Los_Angeles`, `us-west` / `sanjose`), and India IST (`Asia/Kolkata`, `in-ist` / `pune`). Missing
  days across the 2–4 week horizon are pulled deterministically in one batch and stored in `day_tables`.
- `lucky.panchang_limbs` (new, code): a day's five limbs with each limb's classical verdict for the act family (general
  for everyone, from the engine's day table, configurable via env vars in `src/config/env.ts`): tithi group, star group,
  vara lord, **Amrita Siddhi** (weekday + nakshatra combination, `amrita_siddhi` +1 general reason, gated by
  `LUCKY_AMRITA_SIDDHI_ENABLED`), **yoga** (`LUCKY_YOGA_AVOID`: Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra,
  Vyatipata, Parigha, Vaidhriti; `LUCKY_YOGA_FAVOUR`: Siddhi, Siddha (#21 of the 27 Nitya Yogas), Shubha, Amrita, Brahma,
  Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana), **karana** (`LUCKY_KARANA_AVOID` +
  `LUCKY_FIXED_KARANA_AVOID`: Vishti/Bhadra and the three fixed karanas Shakuni, Chatushpada, Naga avoided by default;
  `LUCKY_KARANA_FAVOUR` + `LUCKY_FIXED_KARANA_FAVOUR`: Bava, Balava, Kaulava, Taitila, Gara, Vanija and Kimstughna
  favoured, with Kimstughna adding +1 on auspicious beginnings); each marked `general`.
- `lucky.personal_overlay` (revised): the person's **tara** (the day's star counted from the Moon star: janma, sampat,
  vipat, kshema, pratyak, sadhaka, vadha, mitra, parama mitra) and **chandra bala** (the Moon's house from natal Moon),
  plus two personal marks from the digest: the hora lord's nature **for this chart** (`functionalNatureOf`, functional
  benefic or malefic from `planet` D1) and whether the day's tithi lord or star lord is a running dasha lord
  (`runningDashaLordsOf` from `kundli_activation`, `personal:dasha_lord` +1), each marked `personal`.
- Every scenario row's algorithm lists its rules in two groups, general and personal, and the Why sheet shows them that
  way. Scores: general limbs decide the day gate; personal marks move a window by ±1 as now, plus the hora-lord and
  dasha-lord marks.

### 4.7 API and Lambda behaviour

| Endpoint or event | Change |
|---|---|
| `POST /api/chat/ask-stream` | before the flow: `selectTechniques(intent, facts, 'chat')`; the chosen ids ride on the trace and every span; if `digest_status != ready`, reply "your chart is still being prepared" (as the facts gate does today) and queue the digest |
| `GET /api/area/:area`, `GET /api/lucky/range` | read the digest and `activation`; same shapes as today plus `digest_version` in the response meta |
| Internal event `kundli-digest` (EventBridge, like `kundli-sync`) | builds or rebuilds one kundli's digest; idempotent; writes status; 2 min timeout; token-guarded like `KUNDLI_SYNC_EVENT_TOKEN` |
| Sweep `kundli-digest-sweep` (15 min) | queues kundlis with `facts_status = ready` and `digest_status in (pending, stale)`, at most 20 per run |
| Admin `GET /users`, `/users/:id` | `digestStatus`, `digestVersion`, `digestBuiltAt`; `POST /users/:id/digest/rebuild` (audited) |
| Admin `GET /techniques/:id` | `selectors`, `contract` |
| Admin `GET /review/day` | each query's `techniques[]` |
| Engine `POST /api/export-horoscope` | new or extended types (§7); unchanged request shape |

Errors: a digest build failure sets `failed` with the error type only; readings fall back to the dossier path while the
status is not ready. Statement timeout for digest reads is 2 s.

### 4.8 Frontend and UI words

- User app: nothing new on screen except the existing "preparing your chart" state now also covering the digest; the
  Lucky times Why sheet groups its lines under "For everyone" and "For you".
- Admin: Techniques page shows "Reads" (the contract inputs as rows), "Prompt" (system file, user fields, output
  schema), "Selected when" (selectors in words: "subject is marriage or children; relationship status is dating");
  Users list has a Digest column (Ready · Building · Stale · Failed · Pending) with "Rebuild"; Day review's Questions
  table gains a Techniques column.

## 5. Architecture

```
engine (export types) ──► kundli_data (170 types per kundli) ──► digest.build (code, once per kundli, versioned)
                                                                      │
                     kundli_digest (house, planet, yoga, point, annual, star) + kundli_activation (30 years)
                                                                      │
   clarify context + person_facts ─► selectTechniques ─► contracts ─► packs rendered from the digest ─► cache prefix
                                                                      │
          analysts / readers (one per technique) ─► findings.v3 ─► Oracle (synthesizer) ─► validator ─► answer
   boards: Self / Love / Work layers read kundli_digest + kundli_activation; Lucky times reads day_tables + overlay
   shared: transit_range_skies, day_tables (everyone); kundli_transit_overlays, kundli_day_overlays (per person)
```

Boundaries: the engine computes; the digest selects and stores with provenance; techniques declare; models read
tables and return findings; the Oracle writes; nothing in Node derives astrology (doc 46 §C.3 test).

## 6. Ingredients

- Migrations M31, M32 and M33 (additive; applied under the standing OK for testing).
- Env: `DIGEST_VERSION` (defaults to the code's), `KUNDLI_DIGEST_EVENT_TOKEN`; EventBridge rule `kundli-digest-sweep`
  (deploy session, as `kundli-sync-sweep`).
- Engine pass (Sachin, with the surgeon's scalpel): the five items in §7, each a small export addition on top of
  functions that exist.
- Fixtures: the G1 kundli's 170 rows (already in the repo's fixtures for the past-reading tests) and the research kundli
  with 101 annual rows; the Sumit career retrospective and Sachin's 18-year retrospective as golden tests.
- No new libraries. Gemini calls: none added by the digest (it is code); the General Reading's analyst count rises from
  six to ten per subject in tier 1, so the cost guard (`oracle/costGuard.ts`) gets the new ids; no model runs without
  Sachin's spend yes (memory: no paid calls without a yes).

## 7. Engine pass (the Python side, listed for Sachin; nothing here is done by the server session)

| # | Type | What | Function that exists |
|---|---|---|---|
| E1 | `yogas` with `params.varga` | yogas and raja yogas evaluated in a divisional chart (D9, D10 first) | `yoga.get_yoga_details(jd, place, divisional_chart_factor)`, `raja_yoga.get_raja_yoga_details_for_all_charts` |
| E2 | `annual.tajaka@year` | muntha house, year lord, month lords, Tajaka aspects and yogas (ithasala, ishrafa, kamboola, radda, nakta, yamaya, duhphali kutta; the two stubs noted) on the varsha chart | `tajaka.muntha_house`, `lord_of_the_year`, `lord_of_the_month`, `tajaka_yoga.*` |
| E3 | `benefic_malefic` + badhaka | the badhaka house and lord per lagna | `house.baadhakas_of_raasi` |
| E4 | `annual.sahams` night birth | use the night formula when the birth is after sunset | the saham functions take `night_time_birth`; the export passes False |
| E5 | `arudhas` surya and chandra arudhas | two more points | `arudhas.py:52,54` |
| E6 (later) | `muhurta` choghadiya and panchaka | two more day bands for Lucky times | `drik.gauri_choghadiya`, `drik.panchaka_rahitha` |

Not in the engine and not planned: vedha; sahams beyond the 36.

## 8. Action steps in sequence

0. **Catalogue and selectors (this session, ships now).** M31 columns on `technique_registry`; `selectors` and `contract`
   on every row; the new rows of §4.4–§4.6 as `planned`; the matcher and its tests; admin shows both fields; docs/admin/05
   regenerated. Files: `src/techniques/{catalog,contracts,layouts}.ts`, `prisma/migrations/20261106030000_techniques_m31`,
   admin `techniques.ts` and `Technique.tsx`. Done: tests green, the registry reseeded, the admin page shows the contract.
1. **Digest status and table (D1).** M32: the `kundlis` columns and `kundli_digest`; `digest/build.ts` for sections
   `house`, `planet`, `yoga`, `point`, `star` from stored rows; the event, the sweep, the admin column and Rebuild; the
   no-astrology test. Done: the 24 research kundlis are `ready`; every row has a source path.
2. **Annual set (D1, parallel with 1).** `digest/annualSet.ts` pulls TP and VP for ±10 years in D1, D9, D10 with year
   dashas and sahams, batched; `annual` section rows. Done: the 24 kundlis have 21 years each.
3. **Activation calendar (D2).** M33; `digest/activation.ts` over the 43 systems to thirty years; the Work board's
   families read it (this also builds the four planned Work rows). Done: the Work board's output is unchanged on the
   Sumit golden test, and `work.annual_family` votes.
4. **Packs from the digest (D3).** `packs/selector.ts` digest source + layouts; the cache prefix from the digest; traces
   carry `techniques[]`. Done: the same question gives the same findings on dossier and digest paths (fixture test).
5. **General Reading techniques (D3).** The analysts of §4.4 as contracts; `general.varga_dynamics`,
   `general.strength_yoga`, `general.jaimini`, `general.person` as code-path readers first (their prompts exist in doc 33),
   model calls only after the spend yes. Done: tier-1 reading on the G1 fixture cites digest keys.
6. **Self and Love boards (D4).** Doc 46 layers over the digest; `self.protection` and `love.protection` rows; the
   companion memory selects sub-areas. Done: Self and Love boards render on the 24 kundlis with tones.
7. **Lucky times five limbs (D4, parallel with 6).** `lucky.panchang_limbs`; yoga and karana in `DayRow` and the scoring;
   the personal marks; Why sheet groups. Done: a day with Vishti karana or Vyatipata yoga is gated out for a contract.
8. **Engine pass E1–E5 (Sachin, any time).** When each lands, the digest's `yoga` section gains vargas and `annual`
   gains muntha, year lord and Tajaka yogas; `work.d10_check` and `love.*` read them.

Parallel: 1 ∥ 2; 3 after 1; 4 ∥ 5 after 3; 6 ∥ 7 after 4.

## 9. Development phases

| Phase | Steps | Leaves the system | Closing check |
|---|---|---|---|
| D0 | 0 | Techniques are contracts in the admin; nothing changes for users | admin Techniques page shows selectors and contract; matcher tests |
| D1 | 1, 2 | Every kundli has a status and a digest; annual charts for 21 years | 24 kundlis `ready`; Users list shows the column |
| D2 | 3 | Thirty-year activation per house per system; Work board complete (nine rows built) | Sumit golden test unchanged; `work.annual_family` runs |
| D3 | 4, 5 | General Reading reads the digest; ten techniques per subject, all dasha systems, three annual years, every varga | fixture equality test; Day review shows techniques per query |
| D4 | 6, 7 | Self and Love boards live; Lucky times on five limbs | boards render for 24 kundlis; limb test |
| D5 | 8 | Engine additions flow into the digest | `yoga` rows per varga; `annual` rows carry muntha |

## 10. Recommendation

**Build the digest as doc 46's house-state tables materialised once per kundli, with a status, and turn every
technique into a stored contract that the clarify context selects.** Do not build a model "digester": the engine already
computes every fact, so the first-time breakdown is a deterministic join with provenance, which is cheaper, testable and
never wrong in a way a model could be. Keep the dossier path as the fallback until the last live kundli is digested.

| Option | Verdict |
|---|---|
| Deterministic digest from stored engine rows, versioned, with status (chosen) | One pass per kundli, traceable, no model cost, the cache prefix becomes the digest |
| A model agent "digests" the chart once | Interpretation frozen into data; untraceable claims; cost per kundli; still needs the tables |
| Keep rebuilding packs per question (today) | Six packs per subject per question; no history of what was read; no Self/Love boards without a grid rebuild |
| Put the digest in the engine | The engine stays a calculator (Sachin's rule); provenance and status are server concerns |
