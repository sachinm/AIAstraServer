# 66 replay, run 2: Self board v2 (Oracle + Personalizer) on c584c0a3 as of 2026-11-09, after the run 1 fixes

Wall 72.7 s · 11 model calls · cost $0.087023 (tokens × `priceFor`, 2026-11-09 prices) + explicit-cache storage ≈ $0.063274 (estimate, not in `PRICES`) · cap $0.15 / 16 calls, 0 refusals
Models: family readers gemini-3.1-flash-lite, Oracle gemini-3.8-flash, Personalizer gemini-3.1-flash-lite · Oracle out cap 8000, Personalizer out cap 8000
Prompts: bundle 67e23846108f · oracle/self-areas-v2 d4a10513aa231e477bcda3d4 · personalizer/self 22c214f69e3e387291776b6c
Env: READING_EXPLICIT_CACHE=1 (from .env) · SELF_V2_BUILD=1 · SELF_V2_PRESSURE_PULL=0 · storage dry (blocked writes attempted: $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe, $executeRawUnsafe)
Cache helper: {"created":7,"adopted":0,"hits":11,"misses":0,"extended":0,"errors":0}
Storage: 126548 cached tokens (provider count, largest per region) × $1/Mtok/h × lifetime 1.04 min (regions deleted at the end: 7 deleted, 15 failed)
Calls per stage: {"family":5,"oracle":3,"personalizer":3} · cap waits: none

Script: `scripts/self-v2-replay.ts --run2`. Sachin approved this run in chat on 2026-11-09 ("Yes, rerun it"). The
approval covers one build (kundli `c584c0a3`, as of 2026-11-09), three synthetic profiles, about $0.07, the paid key
in `.env` and the same models. The hard cap was $0.15 total spend (calls plus the storage estimate) and at most
16 model calls: 5 family, 3 Oracle, 3 Personalizer and up to 3 Personalizer retries. Before each call the script
checked four things against the cap: the money spent so far, the worst case of the calls still running, the reserved
storage and the worst case of the next call. Each stage also had its own call limit. If a call would have gone over
the cap, the script waited for the calls in flight to settle. That never happened, and no call was refused. Develop
was at `7875f7b`, which includes `68b07fc` with the fixes for run 1.

**Storage, corrected.** The generated line above prints $0.063274, which is the full-TTL figure, and that figure is
wrong. The script deletes the person's regions at the end of the run, using the recycler's own
`deleteIndividualCaches`. This run's 7 regions were deleted: their `llm_cache_entries` rows have `deleted_at` set
between 23:07:02 and 23:07:06, about one minute after they were created. 15 older rows of the same person failed with
HTTP 403. Those rows come from earlier runs today, and their regions had already expired (filed below). The script
judged deletion by "all of the person's rows", saw the 15 failures, and fell back to the TTL. It now checks only its
own regions. The real estimate is 126,548 tokens (the provider's count, the largest cached count per region) × $1 per
million tokens per hour × 1.04 min ≈ **$0.0022**. **Total ≈ $0.089** ($0.0870 for calls + $0.0022 for storage),
against the $0.15 cap.

**Same conditions as run 1:** `SELF_V2_PRESSURE_PULL=0` and no stored `pressure_inventory`, so the windows are
degraded (38 sub-technique gaps). Storage was dry: the only writes refused were the 16 agent-registry seed inserts,
whose rows already exist. No `technique_outputs`, `area_builds`, `reading_findings_cache` or build markers were
written. `agent_runs` rows and `llm_cache_entries` rows were written as allowed, and the cache rows were then
soft-deleted. The clock is Kaala again: Jupiter main period, Mars sub-period, Ketu sub-sub-period.

## Run 1 vs run 2

| | Run 1 (2026-11-09, before `68b07fc`) | Run 2 (this run) |
|---|---|---|
| Model calls | 11 (no retry path) | 11 (0 Personalizer retries, 0 refusals, 0 cap waits) |
| Cost of the calls (`priceFor`) | $0.1215 | **$0.0870** (−28 %) |
| Storage of the cache regions | ≈ $0.027 printed (chars/4, 30-min TTL); ≈ $0.054 from the provider's token counts | **≈ $0.0022** (regions deleted after about 1 min) |
| Family readers ×5 | $0.0154, 6.4 s | $0.0154, 6.7 s (`family.dasha` stopped at **MAX_TOKENS**) |
| Oracle ×3: cached share | 38.6 % (13.4 k of 34.6 k per call) | **89.7 %** (31.4 k of 35.0 k per call) |
| Oracle ×3: cost / wall | $0.0842 / 27.4 s | **$0.0520** / 26.2 s |
| Oracle thought tokens | 0 reported | 0 reported (still unverified) |
| Personalizer completion | 1 of 3 (a and b `MAX_TOKENS` at 5,000) | **3 of 3 `STOP`** at the 8,000 cap; 4.1–4.3 k out, **0 thought** (`minimal`) |
| Personalizer cost / wall (3 calls) | $0.0219 / 14.0 s | $0.0196 / 12.7 s |
| Sub-techniques + briefs | 9.1 s | **9.0 s** (no gain from the parallel Layer 0) |
| Wall, whole script | 63.5 s | 72.7 s (the build steps take 58.9 s against 61.9 s; ≈ 14 s more is spent deleting 22 cache rows, 15 of which fail) |
| Cards delivered (`ok`) of 33 | 10 (profile c only) | **27** (a 7, b 11, c 9) |
| Cards withheld (the Oracle headline stands in) | 1 (c: In short) + 22 missing | **6** (a: stuck, chapter, yogas, year; c: lagna, year) |
| Delivered cards that kept a date | 2 of 10 | **24 of 27** (a 5/7, b 10/11, c 9/9) |
| Dates dropped by the validator | 9 (labels with chart terms) | 3 (a 2, b 1: a made-up 2026-11-09..12-12 span) + 3 pattern spans |
| Body sentences dropped | 21 (c) | **7** (a 4, b 2, c 1) |
| Body length per card | 12–42 words | 29–61 words |
| Chart terms on validated cards | 0 by the old list; ≥ 8 by today's list (nodal axis, sub-period ×2, karmic, combinations ×2, annual cycle) | **0 / 0 / 0** (raw output: 6 / 1 / 1, all dropped) |
| Medical or diet words on validated cards | "inflammatory", "digestive", "spicy food" reached the body card | **0** reached (raw output: "meals" in all three, "dietary", "nervous system", all dropped) |
| Role words for the retired profile c | ≥ 6 ("executive responsibility", "public pitches", "workplace friction", …) | 1 listed hit ("executive", which reached the board through the Oracle stand-in headline) + about 4 job phrases outside the list ("meetings", "assertive labor", "personal labor") |
| Hero names the stated focus | no (c: "Work and creative projects") | **3 of 3** |

## What worked

- **Each fix that the run could measure worked.** All three Personalizers finished on the first call: `minimal`
  thinking returned 0 thought tokens, and the 8,000 cap left about 3.7 k spare. The retry path was never needed.
  The Oracle's cached share rose from 38.6 % to 89.7 % because the reading frame moved into the prefix, which
  saved $0.032 per build. Every delivered card kept its dates; the label rewrite to the area title shows up as
  "Your building years" and "A brief period of contraction". The new sentence alignment cut the dropped sentences
  from 21 to 7.
- **The validators caught what they now list.** They dropped every chart term, diet word and listed role word in the
  raw output, and every made-up `2026-11-09..2026-12-12` span. No date outside the Oracle document reached a card.
  The Oracle validator passed clean: 0 gaps, nothing withheld, 11 areas, 3 patterns. The Oracle now writes only
  stored spans: no invented 1–7-day "relief" spans this time.
- **All three profiles got a board.** The hero leads with the stated focus for each one: "Your career and money
  focus…", "Your career and family life…", "Your health and spiritual focus…". Each hero asks one yes/no question
  with a real claim id.

## What still reads wrong

1. **The three boards say much the same thing.** The Personalizer changes the hero and a few nouns. Most cards copy
   the Oracle's sentences almost word for word for all three people:
   - The drive card opens "A fierce determination channels analytical rigor into tangible achievements" each time,
     and goes on to say "instinct for wealth accumulation" and "high-intensity, detail-oriented execution".
   - The chapters card is "A decade of wisdom … bridges your past and future" each time.
   - Profiles a and c get the same body headline.

   The Oracle reads this chart in career terms (Jupiter, the lagna lord, in the 7th; Mars in the 9th), and that
   reading reaches every person unchanged.
2. **The wrong register by age, now for the young founder too.**
   - **Profile a** (woman, 25–35, owns a business) is told that the world "recognizes your executive leadership".
     She is told she projects "the aura of an experienced guide or seasoned professional", and that she should
     "Anchor your primary ambitions around mentorship and advisory leadership". These are words for a person of 50.
   - **Profile c** (retired, 60 and over) still gets "assertive labor to secure your assets", "an instinct for
     wealth accumulation", "Maintain a crisp and formal style in all meetings" and "Review your financial
     balances". The role-words table catches "executive" but not "meetings", "labor", "professional" or "assets".
   - **Profile a is single,** but no card uses that fact.
   - **Health and spirituality get little room for profile c.** The body card has 34 words, and its ladder was
     dropped for a diet word. Spirituality appears only in the hero, in diagnosis ("your spiritual foundation") and
     in stuck ("daily spiritual habits").
3. **A withheld card shows the raw Oracle headline, with what the validator removed.** For profile c, the lagna
   headline was dropped for the role word "executive". The Oracle headline then stood in, and it says "the world
   recognizes you for executive leadership and professional gravitas". Other stand-ins carry redaction gaps that a
   reader would see as broken text: "A disciplined … calls for structural adjustments" (year, a and c) and
   "Fortunate cancellations and wealth … resolve" (yogas, a). The stand-in does not go through the profile checks.
4. **Six cards were withheld for their headlines.** Three were over 14 words (a: stuck and chapter; c: lagna at 18),
   and three had a chart term in the headline (a: "yogas" and "annual cycle"; c: "annual cycle"). Profile a lost
   four of eleven cards this way. The validator drops the headline and withholds the whole card. It could shorten or
   redact the headline instead.
5. **The body card writes diet advice for all three people.** "Meals" appears in each raw output, and also
   "dietary" and "nervous system". The validator drops these, and with them the whole ladder (all three body cards
   lost the ladder). "Nervous depletion" and "Nervous exhaustion is a source of friction until 12 Dec 2026" pass. A
   dated claim of exhaustion reads close to a health forecast.
6. **The hero question does not test its own claim.** All three questions cite
   `claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network`. That claim says the
   pressure falls on creative work, children, belief and the friends network. The questions ask instead whether "your
   business", "your career and family life" or "your focus on health and spiritual practice" has felt heavier since
   5 Nov. A "yes" would confirm something the claim does not say. Profile b's question also asks about two things at
   once.
7. **`family.dasha` stopped at `MAX_TOKENS`** (654 out + 1,342 thought against the readers' 2,000 cap). Its finding
   ends mid-sentence ("The convergence of the Kaala PD (") with no `VALID_UNTIL`. The script records it as `ok`, and
   it went into the Oracle as it was. The readers still think at `medium`, and their cap is a fixed 2,000 in
   `slices`/`build`.
8. **The sub-techniques still take 9.0 s** from this machine. The parallel Layer 0 saved nothing measurable, so the
   time goes to database round trips (Render Postgres from here) and not to sequencing. It is still unmeasured on
   the Lambda.
9. **Old ledger rows cannot be deleted.** Deleting an expired region returns HTTP 403. The row then keeps
   `deleted_at = null` and gets `delete_error = HTTP 403`, so the sweeper retries it for ever. This person has 15 such
   rows from earlier runs today, and every per-individual delete pays about 0.5 s for each of them.
10. **The Oracle still reports 0 thought tokens** at thinking `low` on gemini-3.8-flash (3 of 3 calls). The cost is
    complete only if it really does not think.

## Next fixes (ranked)

1. **Make the withheld stand-in safe** (`personalizerValidate.ts`). Run the Oracle headline through the same profile,
   role and chart-term checks. Never show a redaction "…". Use the area title when the headline fails. *This is the
   only defect here that puts wrong or broken text on the board.*
2. **Personalise the cards, not only the hero.** In the Personalizer prompt, add one worked example per age band and
   work status (25–35 founder, 60+ retired) that rewrites a career-framed Oracle paragraph. Add an
   `SELF_V2_ROLE_WORDS_NOT_WORKING` entry for "meetings", "labor" and "professional". Add an age-band list for
   "seasoned", "experienced guide", "mentor" and "advisory" under 36. Add a validator flag (not a drop) when a card
   repeats more than about 60 % of an Oracle paragraph's word sequence.
3. **Shorten the headline instead of withholding the card.** Give the schema a `maxLength` hint. When a headline is
   over 14 words, or carries a chart term ("yogas", "annual cycle"), the validator should redact it or cut it at a
   clause boundary, and withhold the card only if nothing is left. Add a prompt line that names "yoga" and "annual
   cycle" as forbidden words.
4. **Drop the step, not the ladder, on a diet word** (already filed as P3). Add a prompt line for the body card that
   forbids naming food, meals or diet. Add "nervous depletion" and "nervous exhaustion" to the body-advice list.
5. **The hero question must ask about the claim's own areas.** Pass the claim's plain-word areas into the question
   slot, and flag a question that names none of them.
6. **Treat a family reader's `MAX_TOKENS` as a failure.** Do not pass the cut finding to the Oracle. Raise the
   readers' cap to about 3,000, or set their thinking to `low`.
7. **Treat HTTP 403/404 on an expired region as deleted** in `deleteOne`, so the stuck rows clear.
8. **Count the sub-technique database round trips and time them on the Lambda** before more code changes.
9. **The Oracle thought-token check** (one tiny paid call, needs a yes).

## Stages (every model call)

| kundli | stage | agent | call | model | wall ms | prompt | cached | out | thought | cost $ | worst-case $ | status | finish |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c584c0a3 | family | family.sky | family:family.sky | gemini-3.1-flash-lite | 5142 | 2252 | 2139 | 662 | 948 | 0.002497 | 0.003088 | ok | STOP |
| c584c0a3 | family | family.varga | family:family.varga | gemini-3.1-flash-lite | 5271 | 6104 | 6035 | 639 | 903 | 0.002481 | 0.003176 | ok | STOP |
| c584c0a3 | family | family.year | family:family.year | gemini-3.1-flash-lite | 5455 | 69924 | 69769 | 548 | 1085 | 0.004232 | 0.004433 | ok | STOP |
| c584c0a3 | family | family.dasha | family:family.dasha | gemini-3.1-flash-lite | 6153 | 3633 | 3522 | 654 | 1342 | 0.00311 | 0.003127 | ok | MAX_TOKENS |
| c584c0a3 | family | family.rasi | family:family.rasi | gemini-3.1-flash-lite | 6707 | 5319 | 5162 | 951 | 1005 | 0.003102 | 0.003192 | ok | STOP |
| c584c0a3 | oracle | self.oracle | oracle:self.oracle.v2.oracle.c | gemini-3.8-flash | 24132 | 34953 | 31371 | 3063 | 0 | 0.016526 | 0.037013 | ok | STOP |
| c584c0a3 | oracle | self.oracle | oracle:self.oracle.v2.oracle.a | gemini-3.8-flash | 24566 | 34958 | 31371 | 3362 | 0 | 0.017651 | 0.037019 | ok | STOP |
| c584c0a3 | oracle | self.oracle | oracle:self.oracle.v2.oracle.b | gemini-3.8-flash | 25824 | 34959 | 31371 | 3402 | 0 | 0.017801 | 0.037017 | ok | STOP |
| c584c0a3 | personalizer.c | self.personalizer | personalizer.c:self.personalizer | gemini-3.1-flash-lite | 10384 | 8949 | 8550 | 4075 | 0 | 0.006426 | 0.012515 | ok | STOP |
| c584c0a3 | personalizer.b | self.personalizer | personalizer.b:self.personalizer | gemini-3.1-flash-lite | 11557 | 8807 | 8550 | 4121 | 0 | 0.00646 | 0.012439 | ok | STOP |
| c584c0a3 | personalizer.a | self.personalizer | personalizer.a:self.personalizer | gemini-3.1-flash-lite | 12200 | 8828 | 8550 | 4303 | 0 | 0.006738 | 0.01245 | ok | STOP |

## Cached share of input per agent

| agent | calls | prompt tokens | cached tokens | cached share | output | thought | cost $ | mean wall ms |
|---|---|---|---|---|---|---|---|---|
| family.sky | 1 | 2252 | 2139 | 95.0 % | 662 | 948 | 0.002497 | 5142 |
| family.varga | 1 | 6104 | 6035 | 98.9 % | 639 | 903 | 0.002481 | 5271 |
| family.year | 1 | 69924 | 69769 | 99.8 % | 548 | 1085 | 0.004232 | 5455 |
| family.dasha | 1 | 3633 | 3522 | 96.9 % | 654 | 1342 | 0.00311 | 6153 |
| family.rasi | 1 | 5319 | 5162 | 97.0 % | 951 | 1005 | 0.003102 | 6707 |
| self.oracle | 3 | 104870 | 94113 | 89.7 % | 9827 | 0 | 0.051978 | 24841 |
| self.personalizer | 3 | 26584 | 25650 | 96.5 % | 12499 | 0 | 0.019624 | 11380 |

## Kundli c584c0a3… · ok

Step wall ms: subs 9017 · briefs 2 · slices 12 · warm 2999 · families 6708 · oracle 26216 · warm.personalizer 1319 · personalizers 12670
Pressure inventory: none (pull off, no stored row); windows degraded: true

| slice | model | prefix est tokens | suffix est tokens |
|---|---|---|---|
| family.rasi | gemini-3.1-flash-lite | 4879 | 232 |
| family.varga | gemini-3.1-flash-lite | 5604 | 126 |
| family.dasha | gemini-3.1-flash-lite | 3080 | 175 |
| family.year | gemini-3.1-flash-lite | 55342 | 174 |
| family.sky | gemini-3.1-flash-lite | 1916 | 139 |
| self.oracle | gemini-3.8-flash | 28152 | 75 |
| self.oracle (with findings) | gemini-3.8-flash | 28152 | 6033 |
| self.personalizer | gemini-3.1-flash-lite | 11164 | 405 |

| warmed region | model | name | ms |
|---|---|---|---|
| family.rasi | gemini-3.1-flash-lite | created/adopted | 2294 |
| family.varga | gemini-3.1-flash-lite | created/adopted | 2749 |
| family.dasha | gemini-3.1-flash-lite | created/adopted | 2998 |
| family.year | gemini-3.1-flash-lite | created/adopted | 2917 |
| family.sky | gemini-3.1-flash-lite | created/adopted | 2573 |
| self.oracle | gemini-3.8-flash | created/adopted | 2660 |
| self.personalizer | gemini-3.1-flash-lite | created/adopted | 1319 |

Ledger rows (llm_cache_entries) for the regions: ljix51xrxg… gemini-3.1-flash-lite kundli=true user=true expires 2026-11-09T23:36:05.673Z; j7f9xhi6oq… gemini-3.1-flash-lite kundli=true user=true expires 2026-11-09T23:36:06.183Z; bxk69hn2xo… gemini-3.1-flash-lite kundli=true user=true expires 2026-11-09T23:36:06.412Z; ryldb50igk… gemini-3.1-flash-lite kundli=true user=true expires 2026-11-09T23:36:06.298Z; 5wzg0snawq… gemini-3.1-flash-lite kundli=true user=true expires 2026-11-09T23:36:06.148Z; 9b69lfsdan… gemini-3.8-flash kundli=true user=true expires 2026-11-09T23:36:06.248Z; 8nd2ww0m5v… gemini-3.1-flash-lite kundli=true user=true expires 2026-11-09T23:36:40.887Z

Area briefs: now (32 claims, 4 dates), stuck (9 claims, 2 dates), chapter (19 claims, 2 dates), diagnosis (4 claims, 3 dates), lagna (2 claims, 0 dates), mind (10 claims, 1 dates), body (4 claims, 1 dates), drive (10 claims, 1 dates), presence (6 claims, 1 dates), yogas (5 claims, 0 dates), chapters (4 claims, 25 dates), year (2 claims, 2 dates)

Sub-technique gaps (38):
- pressure_inventory: pull off (SELF_V2_PRESSURE_PULL=0)
- windows: sky:ingress/Ju/Taurus@2025-01-01 house_from_lagna missing
- windows: sky:ingress/Sa/Aquarius@2025-01-01 house_from_lagna missing
- windows: sky:ingress/Ra/Pisces@2025-01-01 house_from_lagna missing
- windows: sky:ingress/Ke/Virgo@2025-01-01 house_from_lagna missing
- windows: sky:ingress/Sa/Pisces@2025-03-29 house_from_lagna missing
- windows: sky:ingress/Ju/Gemini@2025-05-14 house_from_lagna missing
- windows: sky:ingress/Ra/Aquarius@2025-05-18 house_from_lagna missing
- windows: sky:ingress/Ke/Leo@2025-05-18 house_from_lagna missing
- windows: sky:ingress/Ju/Cancer@2025-10-18 house_from_lagna missing
- windows: sky:ingress/Ju/Gemini@2025-12-05 house_from_lagna missing
- windows: sky:ingress/Ju/Cancer@2026-06-02 house_from_lagna missing
- windows: sky:ingress/Ju/Leo@2026-10-31 house_from_lagna missing
- windows: sky:ingress/Ra/Capricorn@2026-12-05 house_from_lagna missing
- windows: sky:ingress/Ke/Cancer@2026-12-05 house_from_lagna missing
- windows: sky:ingress/Ju/Cancer@2027-01-25 house_from_lagna missing
- windows: sky:ingress/Sa/Aries@2027-06-03 house_from_lagna missing
- windows: sky:ingress/Ju/Leo@2027-06-26 house_from_lagna missing
- windows: sky:ingress/Sa/Pisces@2027-10-20 house_from_lagna missing
- windows: sky:ingress/Ju/Virgo@2027-11-26 house_from_lagna missing
- windows: sky:ingress/Sa/Aries@2028-02-23 house_from_lagna missing
- windows: sky:ingress/Ju/Leo@2028-02-28 house_from_lagna missing
- windows: sky:ingress/Ra/Sagittarius@2028-06-24 house_from_lagna missing
- windows: sky:ingress/Ke/Gemini@2028-06-24 house_from_lagna missing
- windows: sky:ingress/Ju/Virgo@2028-07-24 house_from_lagna missing
- windows: sky:ingress/Ju/Libra@2028-12-26 house_from_lagna missing
- windows: sky:ingress/Ju/Virgo@2029-03-29 house_from_lagna missing
- windows: sky:ingress/Sa/Taurus@2029-08-08 house_from_lagna missing
- windows: sky:ingress/Ju/Libra@2029-08-25 house_from_lagna missing
- windows: sky:ingress/Sa/Aries@2029-10-05 house_from_lagna missing
- windows: pressure_inventory not stored; built from kundli_activation and the sky overlay (degraded)
- windows: the engine stores no strength grade; every row is 2
- promise: yoga:D1.chandra_mangala_yoga has no stored houses
- promise: yoga:D1.pitru has no stored houses
- promise: 14 yoga rows carry no gift/knot/grace class and were left out
- promise: the engine stores no strength grade for yogas; every entry is 2
- year: annual:VP2026.D1.yearLord missing
- body: the engine stores no sensitive-passage flag; sensitive is false

Family findings: family.rasi 3589 chars, family.varga 2658 chars, family.dasha 2172 chars, family.year 2138 chars, family.sky 2484 chars

### Oracle validator: ok · withheld none · gaps 0


Areas returned: diagnosis, stuck, chapter, chapters, lagna, mind, drive, presence, body, yogas, year · patterns 3 · valid until 2026-12-12

### Oracle document (Chart details register)

#### diagnosis

**Personal effort yields steady forward momentum despite temporary detachment pressing your creative pursuits and social alliances.**

[diagnosis.p1] Your chart is governed by Pisces lagna, with its ruler Jupiter stationed in the seventh house in Virgo. Jupiter anchors your life in relational intelligence, public conduct, and structured counsel. You are currently navigating your major Kaala period of Jupiter (2023-10-23 to 2034-10-22), an expansive eleven-year phase that stabilizes your vitality, status, and collective responsibilities across the board.

[diagnosis.p2] Inside this larger cycle, you are operating in the sub-period of Mars (2026-05-05 to 2026-12-12). Mars rules your second house of wealth and ninth house of fortune, seated securely in its own sign of Scorpio in the ninth house. Mars sits in the third sign from Jupiter, establishing an upachaya relation of growth through persistent courage, direct initiative, and disciplined enterprise.

[diagnosis.p3] The sharpest friction pressing you right now is the sub-sub-period of Ketu, running from 2026-11-05 until 2026-12-12. Positioned in the eleventh house and opposing Rahu in the fifth, Ketu triggers the chart's natal Kala Sarpa axis, bringing sudden mental aloofness, creative hesitation, and emotional distance with friends or associates. This contraction is brief and clears completely at the sub-period boundary on 2026-12-12.

Dates:
- 2023-10-23 → 2034-10-22: Jupiter main period
- 2026-05-05 → 2026-12-12: Mars sub-period
- 2026-11-05 → 2026-12-12: Ketu sub-sub-period

Do:
- 2026-11-05 → 2026-12-12: Do not force social alignment or creative output while Ketu tests your focus; concentrate instead on practical financial organization.

Certainty strong · valid until 2026-12-12 · evidence activation:kaala/1/Ju@2023-10-23, activation:kaala/2/Ma@2026-05-05, activation:kaala/3/Ke@2026-11-05, house:D1.h1, planet:D1.Ju, planet:D1.Ma, risk:activation:kaala/3/Ke@2026-11-05, claim:diagnosis.running_main:Ju, claim:diagnosis.running_sub:Ma, claim:diagnosis.footing

#### stuck

**A temporary wave of mental withdrawal and social coolness demands quiet patience until mid-December.**

[stuck.p1] The core resistance you feel today stems directly from the activation of Ketu in your eleventh house in Capricorn from 2026-11-05 to 2026-12-12. Ketu activates your natal Kala Sarpa axis across the fifth and eleventh houses, casting its gaze on Rahu in Cancer. This induces a temporary sense of creative fatigue, skepticism toward broader social networks, and emotional detachment from peers and collaborative goals.

[stuck.p2] This knot is further compounded by your natal Moon in Scorpio in the ninth house, which experiences the restrictive tenth aspect of Saturn from the seventh house. Saturn's gaze onto your mind's karaka introduces cautious second-guessing and an instinct to pull inward whenever external demands accelerate. Fortunately, this pressure carries an absolute expiration date: the Ketu sub-sub-period closes on 2026-12-12, handing momentum over to supportive alignments from 2026-12-13 onward.

Dates:
- 2026-11-05 → 2026-12-12: Ketu activation window
- 2026-12-12 → 2026-12-12: Detachment eases
- 2026-12-13 → 2026-12-13: Supportive cycle begins

Do:
- 2026-11-05 → 2026-12-12: Refrain from cutting off long-term alliances or abandoning intellectual projects during this short phase of emotional disinterest.

Certainty strong · valid until 2026-12-12 · evidence risk:activation:kaala/3/Ke@2026-11-05, yoga:D1.kala_sarpa, planet:D1.Ke, planet:D1.Ra, planet:D1.Sa, planet:D1.Mo, claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network, claim:stuck.knot:ideas_and_children

#### chapter

**A focused phase of assertiveness and material strengthening reaches its culmination before a new seven-month cycle begins.**

[chapter.p1] Your running sub-period belongs to Mars, spanning 2026-05-05 to 2026-12-12. Seated in its own sign of Scorpio in the ninth house, Mars forms a beneficial Dhana Yoga with the debilitated Moon, which is strengthened by Neecha Bhanga cancellation. This sub-period has tasked you with building tangible security, defending personal assets, and stepping boldly into independent responsibilities.

[chapter.p2] From the vantage of main lord Jupiter in the seventh house, Mars operates in the third sign, an upachaya relationship. This classical geometry indicates that outcomes require persistent personal labor and decisive execution rather than passive good fortune. The closing stretch under Ketu pratyantardasha (2026-11-05 to 2026-12-12) asks you to tie up loose ends and clear mental clutter before the sub-period concludes on 2026-12-12.

Dates:
- 2026-05-05 → 2026-12-12: Mars sub-period
- 2026-11-05 → 2026-12-12: Ketu sub-sub closing stretch

Do:
- 2026-11-09 → 2026-12-12: Consolidate financial balances and complete individual initiatives initiated since May before the upcoming sub-period change.

Certainty strong · valid until 2026-12-12 · evidence activation:kaala/2/Ma@2026-05-05, activation:kaala/1/Ju@2023-10-23, activation:kaala/3/Ke@2026-11-05, planet:D1.Ma, planet:D1.Mo, yoga:D1.facts_dhana_yoga_lords_of_2_and_5, yoga:D1.facts_neecha_bhanga, claim:chapter.running_sub:Ma, claim:chapter.relation:upachaya_effort

#### chapters

**A decade of wisdom, institutional growth, and public engagement bridges your past intellectual training and future comfort.**

[chapters.p1] Your overarching narrative is charted by three major Kaala epochs. Between 2015-01-05 and 2023-10-23, you navigated the major period of Mercury, lord of your fourth and seventh houses seated in the eighth. That chapter compelled you to resolve underlying obligations, navigate intricate contractual adjustments, and develop deep analytical discernment.

[chapters.p2] On 2023-10-23, you crossed into the eleven-year major period of lagna lord Jupiter, which commands your life until 2034-10-22. Holding lordship over both your first and tenth houses from the seventh, Jupiter brings your wisdom, executive judgment, and reputation into open public visibility. The journey through this mahadasha develops systematically through successive sub-periods, with the present Mars phase yielding to subsequent chapters leading through key boundaries on 2027-10-02, 2028-10-04, 2029-12-20, 2031-05-19, and 2032-12-28.

[chapters.p3] When this foundational Jupiter cycle draws to its close on 2034-10-22, you will enter the thirteen-year major period of Venus, running from 2034-10-22 to 2048-01-02. Venus rules your third and eighth houses and activates Viparita Raja Yoga from the sixth house, shifting your life into an era centered on strategic resource refinement and quiet mastery over long-term responsibilities.

Dates:
- 2015-01-05 → 2023-10-23: Mercury previous main period
- 2023-10-23 → 2034-10-22: Jupiter running main period
- 2026-05-05 → 2026-12-12: Mars running sub-period
- 2034-10-22 → 2048-01-02: Venus next main period

Do:
- 2026-11-09 → 2034-10-22: Anchor your primary ambitions around mentorship, advisory leadership, and legitimate public contracts under Jupiter's umbrella.

Certainty strong · valid until 2026-12-12 · evidence activation:kaala/1/Me@2015-01-05, activation:kaala/1/Ju@2023-10-23, activation:kaala/1/Ve@2034-10-22, activation:kaala/2/Ma@2026-05-05, planet:D1.Ju, planet:D1.Me, planet:D1.Ve, yoga:D1.facts_viparita_raja_yoga_lord_of_8_in_6, claim:chapters.previous_main:Me, claim:chapters.running_main:Ju, claim:chapters.next_main:Ve

#### lagna

**You navigate life through deep philosophical contemplation while the world recognizes you for executive leadership and professional gravitas.**

[lagna.p1] Your ascendant is Pisces, ruled by Jupiter, establishing a reflective, receptive, and ethically grounded personal core. Because Jupiter sits in the 7th house in Virgo alongside the Sun and Saturn, your vitality and identity are profoundly realized through the mirror of key partnerships and negotiated contracts. The 1st house receives aspects from the Sun, Jupiter, and Saturn, imposing a sober, disciplined maturity onto an otherwise fluid nature, requiring you to balance boundless imagination with exact, structured commitments.

[lagna.p2] A striking contrast defines your inner reality versus your outer image. Your Arudha Lagna (AL) and Sree Lagna (SL) fall in the 10th house in Sagittarius, the realm of career and public authority,. While your internal orientation remains contemplative, the world views you as an established, values-driven executive or mentor. The presence of Mandi and Gulika in the 10th house brings heavy karmic accountability to your reputation, demanding uncompromised integrity in public life,.

[lagna.p3] In the Navamsa (D9), the ascendant shifts to Leo, revealing that as life matures, your initial Piscean deference consolidates into decisive, sovereign leadership. You are learning to anchor an adaptable spirit within unshakeable personal dignity.

Do:
- 2026-11-09 → 2026-12-12: Structure your professional responsibilities clearly so your public leadership persona does not encroach upon essential private contemplation.

Certainty strong · valid until always · evidence house:D1.h1, planet:D1.Ju, point:D1.AL, point:D1.SL, point:D1.GULIKA, point:D1.MD, house:D9.h1, claim:lagna.bearing, claim:lagna.seen_vs_private

#### mind

**Intense emotional tides and relentless analytical overthinking are steadied by an underlying capacity to convert crisis into durable wisdom.**

[mind.p1] Your emotional core is formed by the Moon in Scorpio in the 9th house, in Kaettai (Jyeshtha) nakshatra. While the Moon occupies its debilitation sign and carries the volatile imprint of Ganda Moola, its conjunction with its domicile lord Mars grants a potent Neecha Bhanga cancellation,. This configuration subjects you to sudden visceral moods and intense internal demands, yet it ultimately crafts remarkable emotional resilience from psychological friction.

[mind.p2] Your mental processing is governed by Mercury in Libra in the 8th house, directing the intellect toward research, hidden mechanics, and thorough psychological audits,. With the 4th house (Gemini) boasting a high Sarvashtakavarga score of 35, your domestic sanctuary and deeper heart possess strong intrinsic resilience, despite Saturn's aspect onto both the Moon and the 4th house causing bouts of emotional reticence and solitary brooding,.

[mind.p3] Under the running Kaala sub-sub-period of Ketu until 2026-12-12, the Rahu-Ketu axis across the 5th and 11th houses triggers feelings of speculative alienation and mental detachment,. By stepping back from intellectual fixation and grounding yourself in methodical problem-solving, mental turbulence resolves as the sub-sub-period shifts after December 12.

Dates:
- 2026-11-05 → 2026-12-12: Ketu sub-sub period pressing detachment
- 2026-12-12 → 2026-12-12: Mental pressure eases

Do:
- 2026-11-09 → 2026-12-12: Refrain from making long-term emotional or speculative decisions during this transient window of mental detachment.

Certainty strong · valid until 2026-12-12 · evidence planet:D1.Mo, planet:D1.Me, house:D1.h4, house:D1.h5, house:D1.h8, yoga:D1.ganda_moola, yoga:D1.facts_neecha_bhanga, yoga:D1.kala_sarpa, activation:kaala/3/Ke@2026-11-05, risk:activation:kaala/3/Ke@2026-11-05, claim:mind.feeling, claim:mind.thinking, claim:mind.peace, claim:mind.judgement

#### drive

**A fierce determination to build enduring legacy channels analytical rigor into tangible achievements, overcoming institutional friction through strategic focus.**

[drive.p1] Your vocational engine is steered by the Atmakaraka Sun in Virgo in the 7th house and Amatyakaraka Moon in Scorpio in the 9th house,. Mars, lord of the 2nd and 9th houses, is in its own sign Scorpio in the 9th house, forming a powerful Dhana Yoga with the Moon. This endows you with unyielding ambition, courage, and an instinct for wealth accumulation through specialized knowledge and strategic enterprise.

[drive.p2] In the Dasamsa (D10), Mars occupies the 10th house in Virgo, confirming that your professional efforts are characterized by high-intensity, detail-oriented execution,. While the nodal axis creates a Kala Sarpa pattern across the 5th and 11th houses that occasionally disrupts networks and recognition, your drive draws lasting endurance from Jupiter's lordship over the 10th house,.

[drive.p3] The overarching Kaala period of Jupiter (2023-10-23 to 2034-10-22) actively builds career standing and partnership alliances. Inside it, the current Mars sub-period (2026-05-05 to 2026-12-12) sits in an upachaya relationship from the main lord, demanding direct, assertive labor to secure financial assets before shifting to new horizons.

Dates:
- 2023-10-23 → 2034-10-22: Jupiter main period driving standing and alliances
- 2026-05-05 → 2026-12-12: Mars sub-period demanding focused upachaya effort
- 2026-11-05 → 2026-12-12: Ketu sub-sub period testing network gains

Do:
- 2026-11-09 → 2026-12-12: Direct current ambitious energy toward finalizing ongoing operational tasks rather than launching speculative alliances.

Certainty strong · valid until 2026-12-12 · evidence point:D1.AK, point:D1.AmK, planet:D1.Ma, planet:D1.Mo, planet:D1.Ju, house:D1.h10, house:D10.h10, yoga:D1.facts_dhana_yoga_lords_of_2_and_5, yoga:D1.kala_sarpa, activation:kaala/1/Ju@2023-10-23, activation:kaala/2/Ma@2026-05-05, activation:kaala/3/Ke@2026-11-05, claim:drive.live:effort_and_courage:supports:self_and_body+effort_and_courage+partnership+career_and_standing+gains_and_network

#### presence

**You present a calm, dignified, and authoritative countenance that commands natural respect while keeping personal vulnerabilities entirely guarded.**

[presence.p1] Your physical bearing is governed by Pisces Lagna, enriched by the direct 7th-house aspects of Jupiter, Sun, and Saturn onto the 1st house. This imbues your presence with a balanced blend of warmth, formality, and gravitas. While Venus in Leo in the 6th house suggests a sharp, disciplined, and understated style of personal adornment, you eschew frivolous ornamentation in favor of purposeful, respectable presentation,.

[presence.p2] Your voice and facial expression correspond to the 2nd house in Aries, aspected by Mercury from the 8th house, bestowing a direct, measured, and incisive vocal cadence,. Publicly, your Arudha Lagna in Sagittarius projects the aura of an experienced guide or seasoned professional, whereas your private demeanor remains cautious and self-contained.

[presence.p3] Your most radiant aesthetic and social presence operated during the Venus sub-period from 2024-06-14 to 2024-09-16. In the current passage under Jupiter-Mars, your presence conveys strategic grit and unyielding executive resolve, keeping external parties engaged through competence rather than mere charm.

Dates:
- 2024-06-14 → 2024-09-16: Past Venus sub-period marking peak grace and social presence

Do:
- 2026-11-09 → 2026-12-12: Lean into crisp, formal presentation in meetings to let your established authority speak without unnecessary assertion.

Certainty likely · valid until 2026-12-12 · evidence house:D1.h1, house:D1.h2, planet:D1.Ju, planet:D1.Su, planet:D1.Sa, planet:D1.Ve, point:D1.AL, activation:kaala/2/Ve@2024-06-14, claim:presence.bearing, claim:presence.style, claim:presence.adornment, claim:presence.face, claim:presence.public_vs_private, claim:presence.best_window

#### body

**Physical stamina rests on disciplined habits, though digestive rhythms and recovery require deliberate daily pacing.**

[body.p1] Your physical constitution is anchored by a Pisces Ascendant with its ruling planet Jupiter placed in the seventh house in Virgo, casting its protective aspect back onto the first house. This provides a steady baseline of vitality and endurance throughout your running Jupiter main period, which safeguards your physical footing through 2034-10-22. However, because Saturn and the Sun also aspect the first house, your bodily vitality demands consistent structure, as mental stress or overwork directly reflects in physical tension and nervous depletion.

[body.p2] Wear and metabolic strain concentrate primarily in the digestive and recovery systems. Leo in the sixth house holds Venus, while Mercury occupies the eighth house in Libra with a low Sarvashtakavarga score of 18, pointing to delayed recuperation when overworked. Mars in Scorpio in the ninth house strengthens the muscular framework and lower body, yet Saturn's aspect onto both Mars and the Moon signals intermittent drops in emotional energy that can wear on stamina. In the D30 Trimsamsa, a Taurus Ascendant ruled by Venus in the eighth house reinforces the need to guard against systemic fatigue and irregular dietary habits.

[body.p3] Under the active Mars sub-period ending 2026-12-12 and the Ketu sub-sub-period running until 2026-12-12, heat and nervous exhaustion are the primary sources of friction. Transiting Saturn through your first house demands careful pacing and joint care, while the transit of Ketu and Jupiter through your sixth house emphasizes strict hygiene in work rhythms and meals to prevent inflammation and digestive strain.

Dates:
- 2023-10-23 → 2034-10-22: Jupiter main period protecting physical footing
- 2026-05-05 → 2026-12-12: Mars sub-period governing physical drive
- 2026-11-05 → 2026-12-12: Ketu sub-sub-period demanding rest and moderation

Do:
- 2026-11-05 → 2026-12-12: Maintain simple, easily digestible meals and protect sleep hours to counteract nervous heat while Ketu presses your energy.
- 2026-12-13 → 2027-01-05: Introduce steady, low-impact strength work as supportive sub-periods open, avoiding sudden physical exhaustion.

Certainty strong · valid until 2026-12-12 · evidence house:D1.h1, house:D1.h6, house:D1.h8, planet:D1.Ju, planet:D1.Ma, planet:D1.Sa, planet:D1.Ve, house:D30.h1, planet:D30.Ve, claim:body.footing, claim:body.wear, claim:body.shape, claim:body.live_lord:Ju:h1, activation:kaala/1/Ju@2023-10-23, activation:kaala/2/Ma@2026-05-05, activation:kaala/3/Ke@2026-11-05

#### yogas

**Fortunate cancellations and wealth yogas resolve earlier professional knots into enduring material and strategic strength.**

[yogas.p1] Your chart contains powerful structural gifts anchored by strong planetary interactions. The conjunction of the second lord Mars in its own sign of Scorpio with the fifth lord Moon in the ninth house forms a potent Dhana Yoga, generating long-term resources, family support, and financial fortune through disciplined efforts. Furthermore, because the Moon is debilitated in Scorpio alongside its domicile ruler Mars, classical Neecha Bhanga Raja Yoga takes full effect, transforming early emotional vulnerability and crisis into profound resilience and intuitive insight.

[yogas.p2] Protective configurations also shield your career and workload. With Venus as the eighth lord occupying the sixth house in Leo, a classical Viparita Raja Yoga (Harsha Yoga) is established, ensuring that professional setbacks, competitors, or debt turn into unforeseen avenues of progress and protection. A complementary Dhana Yoga generated by eleventh lord Saturn and first lord Jupiter sitting together in the seventh house reinforces sustained income and professional authority gained through social networks and partners.

[yogas.p3] These gifts counterbalance karmic knots that demand maturity. The nodal placement across the fifth house of intellect and eleventh house of social gains forms a Kala Sarpa pattern, frequently testing speculative initiatives and creative focus through cycles of detachment and sudden shifts. In addition, the Moon in the Gandanta degree of Jyeshtha brings a Ganda Moola knot concerning faith and mentorship. Under the running Kaala main period of Jupiter and the current Mars sub-period, the wealth-producing and cancellation yogas are prominently activated, delivering strength through persistent effort.

Dates:
- 2023-10-23 → 2034-10-22: Jupiter main period activating Dhana and cancellation yogas
- 2026-05-05 → 2026-12-12: Mars sub-period engaging Dhana Yoga and Neecha Bhanga

Do:
- 2026-05-05 → 2026-12-12: Direct assertive effort toward property, asset consolidation, and core financial commitments while Mars is active.
- 2026-11-05 → 2026-12-12: Refrain from speculative investments or emotionally reactive negotiations while the nodal axis is emphasized.

Certainty strong · valid until 2034-10-22 · evidence yoga:D1.facts_dhana_yoga_lords_of_2_and_5, yoga:D1.facts_neecha_bhanga, yoga:D1.facts_viparita_raja_yoga_lord_of_8_in_6, yoga:D1.facts_dhana_yoga_lords_of_11_and_1, yoga:D1.kala_sarpa, yoga:D1.ganda_moola, promise:facts_dhana_yoga_lords_of_2_and_5, promise:facts_neecha_bhanga, promise:facts_viparita_raja_yoga_lord_of_8_in_6, promise:kala_sarpa, promise:ganda_moola, claim:yogas.gift:money_in_hand, claim:yogas.gift:work_load_and_health, claim:yogas.knot:ideas_and_children, claim:yogas.knot:luck_and_belief, claim:yogas.grace:luck_and_belief

#### year

**A disciplined annual cycle calls for structural adjustments at home and work before broader professional expansion resumes.**

[year.p1] Your annual chart running from 2026-09-09 to 2027-09-09 is established under a Sagittarius Ascendant, placing a strong emphasis on personal ethics, long-range planning, and restructuring life goals. With the year lagna aligning with your natal Arudha Lagna in the tenth house, the overarching theme of this annual cycle revolves around consolidating professional standing and aligning personal ambitions with external obligations.

[year.p2] The short-clock Mudda Dasha of Saturn governs the immediate landscape from 2026-10-28 until 2026-12-24. Saturn’s rulership within this cycle requires patient labor and domestic discipline, urging you to address overdue administrative matters and eliminate disorganization rather than chasing rapid results. This short-clock window intersects directly with the concluding weeks of your Mars sub-period, concentrating duty and sustained effort.

[year.p3] This annual cycle is further gated by major planetary transits. Transiting Jupiter entered Leo in your sixth house on 2026-10-31 and continues through 2027-01-25, providing valuable protection against workplace disputes and health strains. With the nodal transits across your sixth and twelfth houses completing on 2026-12-05, the pressure of hidden expenses and anxiety begins to dissolve, clearing the path for orderly advancement in the early months of 2027.

Dates:
- 2026-09-09 → 2027-09-09: Annual chart cycle under Sagittarius Lagna
- 2026-10-28 → 2026-12-24: Saturn Mudda short clock requiring domestic discipline
- 2026-10-31 → 2027-01-25: Jupiter transit in Leo resolving daily workload

Do:
- 2026-10-28 → 2026-12-24: Complete structural, home, and organizational cleanups under the Saturn Mudda period to clear pending obligations.
- 2026-12-05 → 2027-01-25: Use the stabilizing transit of Jupiter to formalize new daily routines and resolve outstanding workplace duties.

Certainty strong · valid until 2026-12-24 · evidence annual:VP2026.D1#lagna, annual:VP2026.D1#mudda, claim:year.year_lagna, claim:year.short_clock:Sa, window:sky:ingress/Ju/Leo@2026-10-31, window:sky:ingress/Ra/Aquarius@2025-05-18, window:sky:ingress/Ke/Leo@2025-05-18

Patterns:
- (stuck) Withdrawing abruptly into intellectual detachment when collaborative circles demand sustained emotional warmth. — Ketu in the 11th house activates the natal Kala Sarpa axis against Rahu in the 5th house, triggering reflexive isolation from group dynamics. (2026-11-05 → 2026-12-12)
- (stuck) Holding back spontaneous expression in favor of heavy, self-critical caution. — Saturn in the 7th house casts its 3rd rasi aspect directly onto the debilitated Moon in the 9th house, placing emotional spontaneity under rigorous censorship. (— → —)
- (mind) You withdraw into solitary, brooding over-analysis whenever your emotional expectations meet cold reality. — Saturn in the 7th house casts its 3rd aspect onto the debilitated Moon in Scorpio in the 9th house, imposing strict emotional realism and melancholy under stress. (— → —)


### Profile a: woman, 25–35, own business with staff, single, focus career and money

Pack: band 25_35, gender woman, reader public, facts {"work":{"status":"own_business","level":"owner_staff"},"love":"single","focus":["career","money"]} · status ok · finish STOP
Card status: diagnosis ok, stuck withheld, chapter withheld, chapters ok, lagna ok, mind ok, drive ok, presence ok, body ok, yogas withheld, year withheld
Attempts: personalizer.a:self.personalizer finish STOP, out 4303 + thought 0, $0.006738 · hero names the stated focus: true
Validator gaps (15):
- stuck: headline dropped (over 14 words)
- stuck: withheld (no headline survived); the Oracle headline stands in
- chapter: headline dropped (over 14 words)
- chapter: withheld (no headline survived); the Oracle headline stands in
- chapters: a body sentence dropped (chart term (major period))
- lagna: date 2026-11-09..2026-12-12 is not a window of the Oracle document; dropped
- mind: a body sentence dropped (chart term (sub-sub-period))
- presence: date 2026-11-09..2026-12-12 is not a window of the Oracle document; dropped
- body: a body sentence dropped (diet or medicine advice (meals))
- body: ladder dropped (best: diet or medicine advice (meals))
- yogas: headline dropped (chart term (yogas))
- yogas: withheld (no headline survived); the Oracle headline stands in
- year: headline dropped (chart term (annual cycle))
- year: a body sentence dropped (chart term (transit))
- year: withheld (no headline survived); the Oracle headline stands in
Scan of the validated hero and cards (0 hits):
Scan of the raw model output before the validator (9 hits):
- a.raw.cards[2].ladder.drift: chart term "sub-period"
- a.raw.cards[3].body[0]: chart term "major period"
- a.raw.cards[5].body[1]: chart term "sub-sub-period"
- a.raw.cards[8].body[1]: body advice word "meals"
- a.raw.cards[8].ladder.best: body advice word "meals"
- a.raw.cards[8].ladder.floor: body advice word "nervous system"
- a.raw.cards[9].headline: chart term "yogas"
- a.raw.cards[10].headline: chart term "annual cycle"
- a.raw.cards[10].body[1]: chart term "transit"
Dates outside the Oracle document: none

#### Hero (heavy)

**Your career and money focus faces a demanding stretch of consolidation until 12 Dec 2026.**

Persistent effort now secures your financial foundation before a new cycle begins.

Question: Has your business felt heavier to manage since 5 Nov 2026? (claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network) · eases 2026-12-12 · next check 2026-12-12 · strip 43 rows

#### diagnosis · ok · certainty strong · 14 / 55 words

**Personal effort yields steady forward momentum despite temporary detachment pressing your career and money.**

You are in an expansive eleven-year phase that stabilizes your status and collective responsibilities. This period anchors your life in relational intelligence and structured counsel.

A brief, sharp friction is currently testing your focus, causing temporary creative hesitation and emotional distance with associates. This contraction is transient and will clear completely on 12 Dec 2026.

Patterns:
- risk: You experience sudden mental aloofness and creative hesitation during this brief period of contraction. (2026-11-05 → 2026-12-12)

Ladder:
- best: Focus on structured counsel and public conduct to maintain your professional standing.
- practical: Organize your financial records and operational tasks to navigate this period of contraction.
- drift: You may feel an instinct to pull away from your professional network.
- floor: Protect your core business assets and maintain your daily professional routines.

Dates:
- 2023-10-23 → 2034-10-22: Your building years
- 2026-11-05 → 2026-12-12: A brief period of contraction


#### stuck · withheld · certainty strong · 14 / 0 words

**A temporary wave of mental withdrawal and social coolness demands quiet patience until mid-December.**


#### chapter · withheld · certainty strong · 17 / 0 words

**A focused phase of assertiveness and material strengthening reaches its culmination before a new seven-month cycle begins.**


#### chapters · ok · certainty strong · 14 / 29 words

**A decade of wisdom, institutional growth, and public engagement bridges your past and future.**

This cycle develops systematically through successive phases.

Your journey through this foundational period will continue until 2034. It focuses your ambitions around mentorship, advisory leadership, and legitimate public contracts.

Patterns:
- strength: Your reputation and executive judgment are in a phase of public visibility and growth. (2023-10-23 → 2034-10-22)

Ladder:
- best: Anchor your primary ambitions around mentorship and advisory leadership.
- practical: Focus on developing your public authority and securing long-term contracts.
- drift: You may feel the weight of public accountability as your reputation grows.
- floor: Maintain your integrity in all your public and professional dealings.

Dates:
- 2023-10-23 → 2034-10-22: Your foundational building years


#### lagna · ok · certainty strong · 12 / 48 words

**You navigate life through contemplation while the world recognizes your executive leadership.**

Your core is reflective and ethically grounded, yet you balance this with a disciplined maturity. You are required to balance your fluid imagination with exact, structured commitments.

The world views you as an established, values-driven leader. You are learning to anchor your adaptable spirit within unshakeable personal dignity.

Patterns:
- strength: You project the aura of an experienced guide or seasoned professional. (— → —)

Ladder:
- best: Anchor your leadership in unshakeable personal dignity and ethical clarity.
- practical: Structure your professional responsibilities to protect your private contemplation time.
- drift: Your public persona may occasionally feel like it encroaches on your private self.
- floor: Maintain uncompromised integrity in all your public professional life.


#### mind · ok · certainty strong · 14 / 38 words

**Intense emotional tides are steadied by your capacity to convert crisis into durable wisdom.**

You experience sudden visceral moods and intense internal demands, yet you possess remarkable emotional resilience. You are prone to solitary brooding when external expectations feel cold.

By grounding yourself in methodical problem-solving, you can navigate this transient detachment.

Patterns:
- strength: You experience sudden visceral moods that ultimately craft emotional resilience. (— → —)

Ladder:
- best: Convert psychological friction into durable wisdom through methodical reflection.
- practical: Ground yourself in practical problem-solving to manage emotional intensity.
- drift: You may feel a tendency to brood when your expectations meet cold reality.
- floor: Refrain from making long-term emotional decisions during this transient window.

Dates:
- 2026-11-05 → 2026-12-12: A transient window of detachment


#### drive · ok · certainty strong · 12 / 48 words

**A fierce determination channels analytical rigor into tangible achievements and enduring legacy.**

You possess unyielding ambition and an instinct for wealth accumulation through specialized knowledge. Your professional efforts are characterized by high-intensity, detail-oriented execution.

Your drive draws lasting endurance from your leadership role. The current phase demands direct, assertive labor to secure your financial assets before shifting to new horizons.

Patterns:
- strength: You possess unyielding ambition and an instinct for strategic wealth accumulation. (— → —)

Ladder:
- best: Channel your ambition into finalizing your core operational business tasks.
- practical: Focus on detail-oriented execution to secure your financial standing.
- drift: You may feel institutional friction that disrupts your immediate network.
- floor: Maintain your assertive labor to protect your established assets.

Dates:
- 2026-05-05 → 2026-12-12: Your phase of focused effort


#### presence · ok · certainty likely · 12 / 45 words

**You present a dignified countenance that commands respect while keeping vulnerabilities guarded.**

Your bearing is a balanced blend of warmth, formality, and gravitas. You prefer a purposeful and respectable presentation over frivolous ornamentation.

Your public aura is that of an experienced professional, while your private demeanor remains cautious. Your presence conveys strategic grit and unyielding executive resolve.

Patterns:
- strength: You convey strategic grit and unyielding executive resolve in your professional interactions. (— → —)

Ladder:
- best: Lean into your natural authority and formal presentation in meetings.
- practical: Let your established competence speak for you rather than relying on charm.
- drift: You may feel the need to guard your vulnerabilities more than usual.
- floor: Maintain your dignified and respectable appearance in all public settings.


#### body · ok · certainty strong · 12 / 34 words

**Physical stamina rests on disciplined habits, though recovery requires deliberate daily pacing.**

You have a steady baseline of vitality, but your body demands consistent structure to avoid nervous depletion. Mental stress directly impacts your physical tension.

You must guard against systemic fatigue and irregular daily rhythms.

Patterns:
- watch: You require consistent structure to prevent nervous exhaustion and physical depletion. (— → —)

Dates:
- 2026-11-05 → 2026-12-12: A period requiring moderation


#### yogas · withheld · certainty strong · 15 / 0 words

**Fortunate cancellations and wealth … resolve earlier professional knots into enduring material and strategic strength.**


#### year · withheld · certainty strong · 16 / 0 words

**A disciplined … calls for structural adjustments at home and work before broader professional expansion resumes.**


### Profile b: man, 46–60, employed senior leader, married, grown children, focus career and family

Pack: band 46_60, gender man, reader public, facts {"work":{"status":"yes","level":"senior_leader"},"love":"married","children":"grown","focus":["career","family"]} · status ok · finish STOP
Card status: diagnosis ok, stuck ok, chapter ok, chapters ok, lagna ok, mind ok, drive ok, presence ok, body ok, yogas ok, year ok
Attempts: personalizer.b:self.personalizer finish STOP, out 4121 + thought 0, $0.00646 · hero names the stated focus: true
Validator gaps (5):
- lagna: date 2026-11-09..2026-12-12 is not a window of the Oracle document; dropped
- presence: a pattern dropped (the span 2026-11-09..2026-12-12 is not a window of the Oracle document)
- body: a body sentence dropped (diet or medicine advice (meals))
- body: ladder dropped (practical: diet or medicine advice (meals))
- year: a body sentence dropped (chart term (annual cycle))
Scan of the validated hero and cards (0 hits):
Scan of the raw model output before the validator (3 hits):
- b.raw.cards[8].body[1]: body advice word "meals"
- b.raw.cards[8].ladder.practical: body advice word "meals"
- b.raw.cards[10].body[0]: chart term "annual cycle"
Dates outside the Oracle document: none

#### Hero (heavy)

**Your career and family life face a demanding stretch of adjustment until 12 Dec 2026.**

A brief period of mental withdrawal will give way to more supportive alignments.

Question: Has your career and family life felt heavier since 5 Nov 2026? (claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network) · eases 2026-12-12 · next check 2026-12-12 · strip 43 rows

#### diagnosis · ok · certainty strong · 10 / 56 words

**Personal effort yields steady forward momentum until 12 Dec 2026.**

Your current cycle stabilizes your status and collective responsibilities across your career and family life. You are navigating a phase that anchors your public conduct and structured counsel.

A brief period of mental aloofness and emotional distance with associates is currently pressing your creative pursuits. This contraction is temporary and clears completely on 12 Dec 2026.

Patterns:
- risk: You experience sudden mental aloofness and creative hesitation. (2026-11-05 → 2026-12-12)

Ladder:
- best: Focus on your long-term advisory duties to maintain your public standing.
- practical: Organize your financial records to clear mental clutter.
- drift: You may feel an urge to pull away from your professional network.
- floor: Protect your core commitments and avoid making sudden changes to your team.

Dates:
- 2026-11-05 → 2026-12-12: A brief period of detachment


#### stuck · ok · certainty strong · 12 / 61 words

**A wave of mental withdrawal demands quiet patience until 12 Dec 2026.**

You are feeling a sense of creative fatigue and skepticism toward your broader network. This resistance stems from a temporary cycle that impacts your focus on career and family projects.

Your instinct to pull inward when external demands accelerate is natural right now. This pressure will end on 12 Dec 2026, and you will find more support from 13 Dec 2026.

Patterns:
- risk: You withdraw into detachment when collaborative circles demand warmth. (2026-11-05 → 2026-12-12)

Ladder:
- best: Maintain your routine and wait for the cycle to shift.
- practical: Complete your current tasks without seeking new social validation.
- drift: You might feel disconnected from your usual professional goals.
- floor: Do not abandon your long-term projects during this phase.

Dates:
- 2026-11-05 → 2026-12-12: A temporary wave of withdrawal


#### chapter · ok · certainty strong · 11 / 49 words

**A phase of assertiveness reaches its culmination before 12 Dec 2026.**

You have been tasked with building tangible security and defending your assets. This period requires persistent personal labor and decisive execution in your career.

Use the remaining days to tie up loose ends and clear mental clutter. Your current focus on independent responsibilities will shift after 12 Dec 2026.

Patterns:
- strength: You are building tangible security through persistent personal labor. (2026-05-05 → 2026-12-12)

Ladder:
- best: Consolidate your financial gains and finalize your current initiatives.
- practical: Execute your planned professional tasks with direct focus.
- drift: Passive waiting will not yield the results you need.
- floor: Protect your established assets and avoid speculative risks.

Dates:
- 2026-05-05 → 2026-12-12: Your building phase


#### chapters · ok · certainty strong · 12 / 54 words

**A decade of wisdom and public engagement bridges your past and future.**

You are currently in a long-term cycle that brings your executive judgment into public visibility. This phase supports your growth as a mentor and leader.

Your career and family life will continue to develop through successive chapters until 2034. You are building a foundation that will lead to greater strategic mastery in the future.

Patterns:
- strength: Your reputation and executive judgment are in public view. (2023-10-23 → 2034-10-22)

Ladder:
- best: Anchor your ambitions in mentorship and advisory leadership.
- practical: Focus on legitimate public contracts and professional standing.
- drift: You may feel the weight of your public responsibilities.
- floor: Maintain your integrity in all public dealings.

Dates:
- 2023-10-23 → 2034-10-22: Your building years


#### lagna · ok · certainty strong · 12 / 42 words

**You navigate life through contemplation while the world sees your executive leadership.**

Your internal orientation is reflective and ethically grounded. You balance your fluid nature with the structured commitments required of a senior leader.

The world views you as an established professional. You are learning to anchor your adaptable spirit within unshakeable personal dignity.

Patterns:
- strength: Your public image projects the aura of an experienced guide. (— → —)

Ladder:
- best: Align your private values with your public professional actions.
- practical: Structure your professional duties to protect your private time.
- drift: Your public persona may occasionally feel heavy.
- floor: Maintain your personal dignity regardless of external pressure.


#### mind · ok · certainty strong · 11 / 45 words

**Intense emotional tides are steadied by your capacity to find wisdom.**

You possess a resilient emotional core that crafts strength from psychological friction. You tend to approach problems through thorough audits and research.

During this current cycle, you may feel mental detachment. By grounding yourself in methodical problem-solving, this turbulence will resolve after 12 Dec 2026.

Patterns:
- watch: You withdraw into solitary analysis when expectations meet reality. (— → —)

Ladder:
- best: Use your analytical skills to resolve complex issues.
- practical: Step back from intellectual fixation when you feel overwhelmed.
- drift: You might experience bouts of solitary brooding.
- floor: Refrain from making long-term decisions while feeling detached.

Dates:
- 2026-11-05 → 2026-12-12: A period of mental pressure


#### drive · ok · certainty strong · 8 / 41 words

**Fierce determination channels your rigor into tangible achievements.**

You have an instinct for wealth accumulation and strategic enterprise. Your professional efforts are characterized by high-intensity, detail-oriented execution.

Your current cycle demands assertive labor to secure your assets. Focus on finalizing your operational tasks rather than launching new, speculative alliances.

Patterns:
- strength: You demonstrate unyielding ambition and courage in your work. (2026-05-05 → 2026-12-12)

Ladder:
- best: Channel your energy into your most important long-term goals.
- practical: Focus on the details of your current professional projects.
- drift: You may face friction in your professional network.
- floor: Maintain your focus on your core responsibilities.

Dates:
- 2026-05-05 → 2026-12-12: Your current drive


#### presence · ok · certainty likely · 9 / 41 words

**You present a dignified countenance that commands natural respect.**

Your presence conveys a balanced blend of warmth and gravitas. You prefer a purposeful and respectable presentation in all your professional interactions.

Currently, your presence conveys strategic grit and executive resolve. You keep others engaged through your competence and established authority.

Ladder:
- best: Let your established authority speak for itself.
- practical: Maintain a formal and crisp presentation in meetings.
- drift: You may feel the need to over-assert your position.
- floor: Keep your personal vulnerabilities guarded in public.

Dates:
- 2024-06-14 → 2024-09-16: Your past peak presence


#### body · ok · certainty strong · 9 / 34 words

**Physical stamina rests on disciplined habits and deliberate pacing.**

You have a steady baseline of vitality, but your body requires consistent structure to manage mental stress. Overwork can lead to nervous depletion.

Pacing your recovery is essential while you navigate this high-intensity period.

Patterns:
- watch: You require consistent structure to avoid nervous depletion. (2023-10-23 → 2034-10-22)

Dates:
- 2026-11-05 → 2026-12-12: A period requiring rest


#### yogas · ok · certainty strong · 8 / 45 words

**Fortunate configurations resolve professional knots into enduring strength.**

Your chart contains gifts that transform early crises into profound resilience. You have a natural capacity to turn setbacks into avenues of progress.

Your current efforts are supported by these structural gifts. By maintaining your focus, you will continue to build material and strategic strength.

Patterns:
- strength: You transform professional setbacks into progress. (2023-10-23 → 2034-10-22)

Ladder:
- best: Trust in your ability to overcome professional challenges.
- practical: Direct your efforts toward consolidating your assets.
- drift: You may feel tested by cycles of detachment.
- floor: Avoid speculative investments during this time.

Dates:
- 2026-05-05 → 2026-12-12: Your current active period


#### year · ok · certainty strong · 11 / 30 words

**A disciplined cycle calls for structural adjustments until 24 Dec 2026.**

You are aligning your ambitions with your external obligations.

Focus on patient labor and domestic discipline. Complete your administrative cleanups to clear pending obligations before the end of the year.

Patterns:
- strength: You are consolidating your professional standing and goals. (2026-09-09 → 2027-09-09)

Ladder:
- best: Use this time to organize your home and work life.
- practical: Address your overdue administrative matters.
- drift: You may feel the pressure of pending obligations.
- floor: Focus on maintaining order in your daily routines.

Dates:
- 2026-10-28 → 2026-12-24: Your period of discipline


### Profile c: gender not stated, 60+, retired, focus health and spirituality

Pack: band 60_plus, gender not stated, reader public, facts {"work":{"status":"retired"},"focus":["health","spirituality"]} · status ok · finish STOP
Card status: diagnosis ok, stuck ok, chapter ok, chapters ok, lagna withheld, mind ok, drive ok, presence ok, body ok, yogas ok, year withheld
Attempts: personalizer.c:self.personalizer finish STOP, out 4075 + thought 0, $0.006426 · hero names the stated focus: true
Validator gaps (9):
- lagna: headline dropped (role word against the stated work status (executive))
- lagna: withheld (no headline survived); the Oracle headline stands in
- drive: a pattern dropped (the span 2026-11-09..2026-12-12 is not a window of the Oracle document)
- presence: a pattern dropped (the span 2026-11-09..2026-12-12 is not a window of the Oracle document)
- body: a body sentence dropped (diet or medicine advice (meals))
- body: a pattern dropped (diet or medicine advice (meals))
- body: ladder dropped (practical: diet or medicine advice (dietary))
- year: headline dropped (chart term (annual cycle))
- year: withheld (no headline survived); the Oracle headline stands in
Scan of the validated hero and cards (1 hits):
- c.cards.lagna.headline: role word "executive" in "You navigate life through deep philosophical contemplation while the world recognizes you for executive leadership and professional gravitas."
Scan of the raw model output before the validator (5 hits):
- c.raw.cards[4].headline: role word "executive"
- c.raw.cards[8].body[1]: body advice word "meals"
- c.raw.cards[8].patterns[0].text: body advice word "meals"
- c.raw.cards[8].ladder.practical: body advice word "dietary"
- c.raw.cards[10].headline: chart term "annual cycle"
Dates outside the Oracle document: none

#### Hero (heavy)

**Your health and spiritual focus face a test of detachment until 12 Dec 2026.**

A brief period of withdrawal precedes a more supportive cycle.

Question: Has your focus on health and spiritual practice felt heavier since 5 Nov 2026? (claim:stuck.heaviest_now:presses:ideas_and_children+luck_and_belief+gains_and_network) · eases 2026-12-12 · next check 2026-12-12 · strip 43 rows

#### diagnosis · ok · certainty strong · 14 / 53 words

**Personal effort yields steady momentum despite temporary detachment pressing your spiritual and health pursuits.**

Your life is anchored in relational intelligence and structured counsel. You are currently in an expansive phase that stabilizes your vitality and collective responsibilities.

A brief period of friction is pressing your creative and social pursuits until 12 Dec 2026. This contraction triggers sudden mental aloofness, but it clears completely after that date.

Patterns:
- risk: Mental aloofness and emotional distance arise from a brief cycle of detachment. (2026-11-05 → 2026-12-12)

Ladder:
- best: Focus on your spiritual foundation and personal counsel.
- practical: Organize your financial affairs to maintain stability.
- drift: You may feel an urge to pull away from community projects.
- floor: Protect your daily routine from unnecessary mental fatigue.

Dates:
- 2026-11-05 → 2026-12-12: A temporary stretch of detachment


#### stuck · ok · certainty strong · 13 / 41 words

**A temporary wave of mental withdrawal demands quiet patience until 12 Dec 2026.**

You may feel a sense of creative fatigue and emotional distance from peers. This resistance stems from a brief cycle that tests your focus.

This pressure carries an absolute expiration date. Momentum shifts toward supportive alignments from 13 Dec 2026 onward.

Patterns:
- watch: Refrain from abandoning long-term intellectual or spiritual projects during this phase. (2026-11-05 → 2026-12-12)

Ladder:
- best: Observe your thoughts without acting on temporary detachment.
- practical: Stick to your established daily spiritual habits.
- drift: You might feel inclined to isolate yourself from friends.
- floor: Do not cut off long-term alliances while feeling withdrawn.

Dates:
- 2026-11-05 → 2026-12-12: A period of mental withdrawal


#### chapter · ok · certainty strong · 13 / 41 words

**A focused phase of material strengthening reaches its culmination before 12 Dec 2026.**

You have been tasked with building tangible security and stepping into independent responsibilities. This phase requires persistent personal labor.

The current closing stretch asks you to tie up loose ends and clear mental clutter. New momentum begins after 12 Dec 2026.

Patterns:
- strength: Consolidate your financial and personal assets before the cycle shifts. (2026-05-05 → 2026-12-12)

Ladder:
- best: Complete your individual initiatives with steady focus.
- practical: Review your financial balances and organizational tasks.
- drift: Passive waiting may lead to missed opportunities for growth.
- floor: Maintain your personal independence in all matters.

Dates:
- 2026-05-05 → 2026-12-12: A phase of building security


#### chapters · ok · certainty strong · 13 / 40 words

**A decade of wisdom and engagement bridges your past training and future comfort.**

You are in an eleven-year period that brings your wisdom and reputation into public visibility. This journey develops systematically through successive chapters.

When this foundational cycle concludes, you will enter an era centered on strategic resource refinement and quiet mastery.

Patterns:
- strength: Anchor your ambitions around mentorship and advisory roles. (2023-10-23 → 2034-10-22)

Ladder:
- best: Embrace your role as a mentor and guide.
- practical: Focus on long-term public and community commitments.
- drift: You may feel the weight of your public reputation.
- floor: Protect your integrity in all community engagements.

Dates:
- 2023-10-23 → 2034-10-22: Your major years of wisdom


#### lagna · withheld · certainty strong · 18 / 0 words

**You navigate life through deep philosophical contemplation while the world recognizes you for executive leadership and professional gravitas.**


#### mind · ok · certainty strong · 14 / 41 words

**Intense emotional tides are steadied by your capacity to convert crisis into durable wisdom.**

You possess remarkable emotional resilience built from psychological friction. Your heart and domestic sanctuary have strong intrinsic capacity.

Mental turbulence resolves as the current period of detachment shifts after 12 Dec 2026. Grounding yourself in methodical problem-solving will restore your peace.

Patterns:
- risk: Avoid making long-term emotional decisions during this window of detachment. (2026-11-05 → 2026-12-12)

Ladder:
- best: Convert emotional challenges into lasting wisdom.
- practical: Use methodical problem-solving to clear mental clutter.
- drift: You may experience bouts of solitary brooding.
- floor: Refrain from reactive decisions when moods fluctuate.

Dates:
- 2026-11-05 → 2026-12-12: A window of mental detachment


#### drive · ok · certainty strong · 9 / 42 words

**A fierce determination channels analytical rigor into tangible achievements.**

You possess unyielding ambition and an instinct for wealth accumulation through specialized knowledge. Your efforts are characterized by high-intensity execution.

The current period demands direct, assertive labor to secure your assets. Focus on finalizing your ongoing tasks rather than launching new initiatives.

Ladder:
- best: Channel your ambition into meaningful, lasting projects.
- practical: Finalize your current commitments with detail-oriented care.
- drift: You may face friction in your social networks.
- floor: Maintain your courage and initiative.

Dates:
- 2026-05-05 → 2026-12-12: A period of focused effort


#### presence · ok · certainty likely · 11 / 36 words

**You present a dignified and authoritative countenance that commands natural respect.**

Your presence conveys a balanced blend of warmth, formality, and gravitas. You prefer purposeful, respectable presentation over ornamentation.

In your current passage, you convey strategic grit and unyielding resolve. You keep others engaged through your competence.

Ladder:
- best: Project your natural authority with calm dignity.
- practical: Maintain a crisp and formal style in all meetings.
- drift: You might feel the need to guard your vulnerabilities.
- floor: Keep your presentation purposeful and measured.

Dates:
- 2024-06-14 → 2024-09-16: A past window of peak grace


#### body · ok · certainty strong · 12 / 34 words

**Physical stamina rests on disciplined habits, though recovery requires deliberate daily pacing.**

Your vitality is protected by a steady baseline, but mental stress directly affects your physical tension. Consistent structure is essential for your well-being.

Nervous exhaustion is a source of friction until 12 Dec 2026.

Dates:
- 2026-11-05 → 2026-12-12: A period requiring rest and moderation


#### yogas · ok · certainty strong · 11 / 37 words

**Fortunate cancellations resolve earlier knots into enduring material and strategic strength.**

Your chart contains gifts that transform early emotional vulnerability into profound resilience. These configurations generate long-term resources and financial fortune.

Persistent effort activates these wealth-producing gifts. Refrain from emotionally reactive negotiations while you navigate your current cycle.

Patterns:
- strength: Focus on asset consolidation rather than speculative initiatives. (2026-05-05 → 2026-12-12)

Ladder:
- best: Use your resilience to build lasting security.
- practical: Direct your efforts toward core financial commitments.
- drift: You may face tests of your creative focus.
- floor: Maintain your faith and mentorship connections.

Dates:
- 2026-05-05 → 2026-12-12: A period engaging your wealth potential


#### year · withheld · certainty strong · 16 / 0 words

**A disciplined … calls for structural adjustments at home and work before broader professional expansion resumes.**


Raw JSON: `docs/reading-engine/replays/66-2026-11-09-run2/` (summary.json, <kundli>-oracle.json, <kundli>-personalizer-<a|b|c>.json; no names, birth data, places or coordinates).