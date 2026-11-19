# 14 — Love and Work cards read their own boards' techniques

Status: built on `feat/love-work-techniques` (2026-11-19). Not pushed, not merged.

## 1. What was wrong

Sachin (2026-11-19): "are there no techniques? Are you using SELF dashboard techniques for LOVE and WORK --- that
doesn't make any sense ... fix this!"

He was right. The grouped card reader (`src/reading/cards/group.ts`) and the one-card path (`src/reading/cards/oracle.ts`)
gave every card, Love and Work included, the same inputs:

- **Prompts.** The prompts all said "Self": `cards/oracle.md` ("ONE card of this person's Self board"), `cards/group.md`
  ("several cards of this person's Self board") and `personalizer/self-v3.md` ("the Personalizer of the Self board").
- **Data.** The data was the You board's: the year frame, the agreed ledger of generic matters
  (`ledger:s1/gains_and_network` …), the matter rows and the natal core. A live `dating_pulse` on 2026-11-19 cited
  only those keys.

The Love and Work technique layers were already in code: `houseLayers.ts` (8 layers over an `AreaConfig`), `LOVE`
(`love.ts`), and the career checks (`career.ts`). They fed only the old Love and Work boards and never reached a v3
card.

## 2. What changed

1. **Board-neutral prompts.**
   - The three prompts now speak of "this person's boards (Self, Love or Work)".
   - Every request names the card's board and lens. In the group request this reads
     `- dating_pulse: board Love, lens Dating; matters …`, and in the one-card call `BOARD: this card is on the Love,
     lens Dating board`. The Personalizer suffix carries the same label.
   - A Self card is told `board Self`, so it reads as before in substance.
2. **Board techniques in the pack.** `src/reading/cards/techniques.ts` renders a `# BOARD TECHNIQUES: LOVE` and/or
   `WORK` section from the existing layer code. It adds no new astrology: every row is a select of the digest, the
   activation calendar, the stored sky or the stored Work map.
   - A section is written only when a card of that board is in the pack.
   - Each row has a key. Each Love/Work card's `allowed` set holds every key of the sections it maps to.
   - Under `CARD CELLS`, each card gets a `techniques LOVE (read first …)` line naming its rows.
3. **`WORK` area config** (`src/reading/area/work.ts`). This is config only, taken from what `career.ts` already states:
   - houses 10, 6, 1, 2, 11 (`CAREER_HOUSES`), plus 3, 7, 9 and 12 for the sign periods of the sub-area drivers;
   - karakas: the 10th lord, the AmK and the Sun;
   - vargas: D1, D10, D9, D60;
   - sahams: rajya, karma, punya, yasas (`workAnnualVote`);
   - the seven `work.subarea_windows` sub-areas, with the drivers that `careerSubareas` and `careerMap` use.
4. **Oracle prompt.** A Love or Work card reads its technique rows first:
   - promise and protection ground the gift;
   - affliction and the test windows ground the knot;
   - activation and the sub-area windows give the timing;
   - it reads D9 and D7 for Love, or D10 for Work.

   The ledger status rules still decide every dated statement. A row's dates are evidence only: the dates a card states
   stay span edges, the YEARS line or dates in the prefix. The section's dates are not added to the run's allowed dates.

   For Work, the stored Work board map (`work:map/*`, career.ts) is the tone and the windows of record. It is written
   first. The house layers' tone and sub-area windows are marked "evidence only", and the prompt says the map wins.
5. **Plain `why`** (doc 13 phase 5).
   - `why` is an optional field in `personalizerV3Schema` and in the grouped face schema (inherited), and it is on
     `PersonalCardV3`.
   - The prompt line is in `personalizer/self-v3.md` and `cards/group.md`.
   - `checkPersonalCard` keeps it when written and never refuses a card without it (docs 82, 84).
   - `cardContent` passes it to `content.why` (on top of `508c279`, merged from `feat/card-chart-why`).
6. **Store key.** A Love or Work card's key carries `.t<hash>` (`techniqueStamp`). The hash covers the card's own
   technique rows and the board's always-present rows (tone, karakas, points, charts, sahams, D10 check, family votes).
   - Today's date is written as "now" in the hash: a window that runs now starts on today, and that alone must not
     re-read the card every day. A test covers this.
   - A change in the card's own rows reads it again.
   - A Self card's key is unchanged.

## 3. Card → technique mapping

`CARD_TECHNIQUES` in `src/reading/cards/techniques.ts` is typed over every v3 card id, so a card added to the
registry without a mapping does not compile.

Layer shorthands used in the table:

- TIMING = promise, activation, transit, annual
- NATURE = promise, varga, nakshatra
- STRAIN = affliction, protection, activation, transit

| Lens | Card | Board · sub-areas | Layers read first |
| --- | --- | --- | --- |
| Dating | dating_pulse | Love · meet, romance, delay | TIMING |
| | dating_meeting_timing | Love · meet, romance | activation, transit, annual, varga |
| | dating_delays_blocks | Love · delay, strain | STRAIN |
| | dating_attraction_pattern | Love · meet, romance | NATURE |
| | dating_mixed_signals | Love · romance, strain | promise, affliction, activation, transit |
| | dating_exes_closure | Love · reconcile, strain | affliction, activation, transit |
| | dating_karmic_compatibility | Love · romance, commitment | NATURE |
| | dating_intimacy_safety | Love · health, romance | promise, affliction, protection, nakshatra |
| | dating_breaking_patterns | Love · delay, strain | affliction, protection, activation, nakshatra |
| | dating_transition_commitment | Love · commitment, meet | promise, activation, varga, annual |
| Marriage | marriage_pulse | Love · health, strain, commitment | promise, affliction, activation, transit, annual |
| | marriage_timing_readiness | Love · commitment, meet, delay | promise, activation, varga, annual |
| | marriage_daily_harmony | Love · health | promise, protection, transit, annual |
| | marriage_conflict_cycles | Love · strain, reconcile | STRAIN |
| | marriage_communication | Love · health, strain | promise, affliction, activation |
| | marriage_trust_transparency | Love · health, strain | affliction, protection, nakshatra |
| | marriage_reconciliation | Love · reconcile, strain | STRAIN |
| | marriage_inlaws_family | Love · family_accept | promise, affliction, activation |
| | marriage_finances_chores | Love · family_accept, health | promise, activation, annual |
| | marriage_children_family | Love · health, family_accept | promise, varga, activation |
| | marriage_longterm_longevity | Love · commitment, health | promise, protection, varga, nakshatra |
| | marriage_personal_growth | Love · health, commitment | promise, varga, annual |
| Friends | friends_social_energy | Love · friends | promise, activation, transit, annual |
|  | friends_core_allies | Love · friends | promise, protection, activation |
|  | friends_outgrowing_circles | Love · friends | affliction, activation, transit |
|  | friends_finding_tribe | Love · friends | activation, transit, annual |
|  | friends_boundaries_drains | Love · friends | affliction, protection, transit |
|  | friends_mentors_guides | Love · friends | promise, protection, activation |
|  | friends_reputation_belonging | Love · friends | promise, annual, varga |
| Allies at work | allies_pulse | **Work** · promotion, job_security | TIMING |
| | allies_bosses_authority | Work · promotion | promise, activation, varga |
| | allies_team_politics | Work · job_security | affliction, protection, activation |
| | allies_cofounder_fit | Work · business | promise, activation, varga |
| | allies_clients_deals | Work · business, pay | TIMING |
| | allies_managing_people | Work · promotion | promise, protection, varga |
| | allies_networking_allies | Work · promotion, job_change **+ Love · friends** | activation, transit, annual |
| | allies_contracts_disputes | Work · job_security, business | STRAIN |
| Starting out | start_launch_window | Work · get_job | promise, activation, transit, annual |
|  | start_degree_to_career | Work · get_job, job_change | promise, varga, activation |
|  | start_first_role_timing | Work · get_job | activation, transit, annual |
|  | start_offer_decision | Work · get_job, job_change, pay | activation, annual, varga |
|  | start_imposter_syndrome | Work · get_job | affliction, protection, nakshatra |
|  | start_relocation_abroad | Work · abroad | activation, transit, annual |
|  | start_three_year_foundation | Work · get_job, promotion | promise, activation, varga |
| Your job | job_pulse | Work · promotion, job_security, job_change | promise, affliction, activation, transit, annual |
| | job_security_layoff, job_burnout_load | Work · job_security | STRAIN / affliction, protection, transit, nakshatra |
| | job_stay_or_leave | Work · job_change, job_security | activation, transit, annual, affliction |
| | job_promotion_recognition, job_leading_teams | Work · promotion | promise, activation, annual, varga / promise, protection, varga |
| | job_salary_bonuses | Work · pay | promise, activation, annual |
| | job_boss_politics | Work · promotion, job_security | affliction, protection, activation |
| | job_industry_switch | Work · job_change | activation, transit, varga |
| | job_remote_abroad | Work · abroad, job_change | activation, transit, annual |
| | job_skill_building | Work · promotion, job_change | promise, varga, activation |
| Craft & hobby | craft_creative_flow | Work · (no sub-area) | promise, activation, annual |
|  | craft_energizing_medium | Work · (no sub-area) | promise, varga, nakshatra |
|  | craft_creative_blocks | Work · (no sub-area) | affliction, protection, activation |
|  | craft_monetize_hobby | Work · pay, business | promise, activation, transit, annual |
|  | craft_shipping_projects | Work · (no sub-area) | activation, transit, annual |
|  | craft_audience_community | Work · business | promise, activation, annual |
| Business | biz_readiness | Work · business, job_change | promise, varga, activation |
|  | biz_ideal_industry | Work · business | promise, varga, nakshatra |
|  | biz_launch_timing | Work · business | promise, activation, transit, annual |
|  | biz_cashflow_margins | Work · pay, business | promise, activation, annual |
|  | biz_clients_sales | Work · business, pay | activation, transit, annual |
|  | biz_partnerships_fit | Work · business | promise, affliction, varga |
|  | biz_hiring_team | Work · business, promotion | promise, protection, activation |
|  | biz_capital_assets | Work · pay, business | promise, affliction, annual |
|  | biz_scaling_risk | Work · business | activation, transit, annual, affliction |
|  | biz_legal_safeguards | Work · job_security, business | affliction, protection, activation, transit |
|  | biz_founder_burnout | Work · job_security | affliction, protection, transit, nakshatra |

Two decisions are recorded here:

- **Allies.** The Allies lens sits on the Love board, but a boss, a team, a client or a contract is a work matter. It
  reads the Work board's career rows; networking also reads the Love friends rows.
- **Craft & hobby.** Craft has no career sub-area. Its cards read the Work layers on the career houses, and only the two
  earning cards add pay and business.

## 4. What the section carries

The Love section has these blocks:

- `TONE TODAY` (`love:tone/now`): `buildBoard` tone, confidence, change date and the family votes.
- `KARAKAS` (`love:karaka/L7|Ve|Mo|DK`): D1, D9 and D7 sign, house and dignity. These rows are always present.
- `POINTS` (`love:point/UL|A7|A5|DK`), always present.
- `DIVISIONAL CHARTS` (`love:chart/D9.h7` … `D7.h8`), always present.
- `SAHAMS` (`love:saham/vivaha` …), always present: shows "not in the chart" when the year chart has none.
- The eight layers:
  - `PROMISE`, `AFFLICTION` (with `until`), `PROTECTION`;
  - `ACTIVATION`: graded periods overlapping the frame, levels 1–2, with their dates;
  - `TRANSIT`, `ANNUAL`, `VARGA`, `NAKSHATRA`.
- `SUB-AREAS` (`love:sub/<id>`): the board's `aheadWindows` per sub-area with dates and clocks, and the score for the
  next 12 months.

The Work section has the same blocks, plus:

- `D1/D10 CHECK OF THE RUNNING LORDS` (`work:check/d10.<planet>`, from `workD10Check`);
- `FAMILY VOTES` (`work:family/conditional|karaka|annual`);
- `STORED WORK BOARD MAP` (`work:map/present`, `work:map/<subarea>`): the newest `area_builds` 'career' row, read
  only.

**Which clocks the section lists.** It lists:

- one clock per board family (vimsottari, karaka, yogini, tithi_ashtottari, narayana);
- every conditional clock that applies;
- the clocks the year frame read.

The calendar stores 42 systems for this chart. With all of them, every merged sub-area window ran about ten years,
from 2026 to 2037, and the activation block had 118 rows. With the board families only, it has 18.

**Loading.** `loadBoardTechniques` is read only:

- It reads the digest, `activationFor` (the board's span and houses), the stored sky (the overlay, else the shared
  sky), and for Work the newest stored career map.
- It is called from `self/v3/build.ts` only when a deck in the pack, or a queued card, maps to Love or Work.
- It never throws.
- It runs in series before the first card is read, and only for queued cards that are readable.
- One pack per run, cached once, as before.

## 5. Data check (kundli c584c0a3, read only, 2026-11-19)

| Needed | Stored |
| --- | --- |
| UL, A5, A7, DK (Love), AL, A10, AmK (Work) | yes, in every varga (D1 … D144) |
| D7, D9, D10, D60 planets and houses | yes (9 planets, 12 houses each) |
| digest | `d1.2026-11-15-vakra`, ready, 23 vargas |
| activation | 1,656 Love-house rows over 42 systems; 122 running today |
| sky | the overlay covers 2026-01-01..2026-12-31 (8 ingresses) |
| stored Work map | yes (`area_builds` career, 2026-11-16) |
| **year-chart sahams** | **missing: the TP2026 D1 row has `sahams: []`** |

**Gap (engine).** The running Tithi Pravesha year has no sahams. The Love sahams (vivaha, preethi, mitra, santapa,
paradara) and the Work sahams (rajya, karma, punya, yasas) therefore always read "not in the TP2026 chart". The
`annual` layer's saham votes and `workAnnualVote`'s saham term never fire for this chart. The engine should export the
sahams on the TP row; Node does not compute them.

**Gap (sky).** The stored sky overlay ends 2026-12-31, but the frame runs to late 2027. The transit layer reads only
asOf, so it is fine today, but the overlay needs extending as the year turns.

## 6. Sizes (no model call; `scripts/measure-card-techniques.ts`)

Characters are system plus text. Tokens are estimated at 2.2 characters a token, the doc 86 estimator. The earlier
figure of 61,866 tokens was measured on a different day's board.

| Pack | Cards | Characters | Est. tokens |
| --- | ---: | ---: | ---: |
| before (Self board, old prompts) | 8 | 140,286 | 63,767 |
| (a) Self only | 8 | 142,480 | 64,764 |
| (b) Self + 9 Dating cards | 17 | 179,835 | 81,744 |
| (c) Self + this person's 2 Your-job cards | 10 | 161,076 | 73,217 |
| (c′) Self + all 11 offered Your-job cards | 19 | 188,857 | 85,845 |

- **Self-only text is unchanged.** Its sha256 is `ec004abdc28c29e5` before and after. The system prompt grew by 2,194
  characters (board-neutral wording, the techniques paragraph and `why`).
- **Section sizes.** Love: 112 rows, 13,004 characters (about 5.9 k tokens). Work: 102 rows, 12,027 characters
  (about 5.5 k tokens).
- **Load time.** 4.6 to 6.7 s warm, about 9 s on a first connection.
- **Card counts.** For this person, `showsFor` shows 9 Dating cards. It shows only 2 Your-job cards
  (`job_stay_or_leave`, `job_skill_building`), because the stated facts put them outside EMP. The brief's "8
  primary_job cards" matches neither set, so both are measured.

## 7. Expected side effect

The prompt hashes changed (`cards/oracle`, `cards/group`, `personalizer/self-v3`), so every board, Self included,
re-reads its cards once on its next open. Love and Work cards also re-read whenever their technique rows change
(`techniqueStamp`).

## 8. Findings

These are not fixed here. Per the brief, they go to the session that owns `docs/TODOS.md`.

1. **TP sahams missing** (§5). This is an engine export gap.
2. **Two Work tones disagree.** The Work layers' tone today is "demanding (likely)"; the stored Work board map
   (career.ts timeline) says "steady (likely)". These are two methods over the same houses. In the pack, the map is now
   of record and the layer tone is marked evidence only. The two methods still disagree, and that belongs to the Work
   board.
3. **Merged windows run for ten years.** `aheadWindows` over all 42 stored systems merges every sub-area window into
   one span of about ten years. The old Love board, which reads every system, shows this to people. The card section
   limits itself to the board families.
4. **Pre-existing test failures**, not touched here:
   - `tests/unit/techniques/piecesDoc.test.ts`: the checked-in doc 07 is stale, and there is no page for
     `self.card.chat`.
   - `tests/unit/reading/self/v2/subTechniques.test.ts`: the order of the TECHNIQUES rows.

   Regenerating doc 07 adds only the `self.card.chat` / `card.chat` technique from develop; no prompt of this change
   appears in it. No file under `src/techniques` or `src/reading/self/sub` changed since 38c4c41.
6. **`why` is not gated.** `src/reading/self/v3/response.ts` nulls `chart` without the `feature.why_panel` grant, but
   `why` passes through with the v3 content. This is for the doc 13 owner to decide; `response.ts` was not edited here.
7. **Load in series.** The technique load (about 4.6 s warm, 9 s cold) runs before the first card is read. It could
   start as soon as the frame exists, in parallel with the clock layer.
5. **Worktree install.** `@aws-sdk/client-kms` and `@upstash/*` are in develop's lockfile but not in the main checkout.
   This worktree therefore has its own `npm ci` (no junction), and a Haiku sub-agent did the install.
