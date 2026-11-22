# 13. The question bank: what the assistant asks, and why

Every question Rath's method needs, reshaped to the product's rules. Rath confirms the past aloud before he forecasts
(see [12](12-chart-verification-and-rectification.md)); the product does the same, one plain question at a time.

Sources: the 19-row verification table in `research_notes/Sanjay Rath methods and precedence/verification_and_questions.md`
(Q2), the "What to confirm with the person" lists in files [07](07-self-mind-spirituality.md),
[08](08-career-and-wealth.md), [09](09-love-marriage-children-family.md) and
[10](10-health-education-property-travel-litigation.md) (see those files for the chart reasoning behind each), the
product rules in `AGENTS.md` ("We are making a Vedic astrology personal assistant"), and the companion-memory design in
`docs/reading-engine/48-companion-memory-on-the-you-board.md`.

## 1. Rules every question here follows

1. **The chart leads the question.** No question is asked as a form. A rectification question (section 3) is asked only
   when the calculation engine reports that the candidate varga lagnas left in the birth-time window predict different
   answers to it; that is what made Rath ask it. A life-area question (section 5) is asked only when that area's house
   state is tested or supported now or in the last six months (doc 48 §4.1). Until the engine can report candidate
   lagnas (file 14, row 72), section 3 questions are asked only when a reading on that subject needs the fact.
2. **Confirm before predict.** An answer confirms or withholds a claim; a "no" is stored as a miss, never argued with.
3. **Questions follow known facts.** Each row names its prerequisite. "How many younger siblings?" is never asked
   before "Do you have brothers or sisters?" is answered yes.
4. **One tap, stored once.** Chips, a count, a year or yes / partly / no / skip. Skip is stored as declined and not
   asked again (doc 48: ask again after 180 days at most). One question per visit; at most two before any answer.
5. **No chart terms.** No house numbers, planet names, "lagna", "navamsa" or dasha words in the question.
6. **No general prediction.** A question never carries a forecast ("you will…").
7. **Dated answers go to the ledger.** A yes with a year writes a `life_events` row with its `date_precision` (day,
   month or year), so it becomes a calibration point (AGENTS.md rule 4). Today no confirm answer writes to the ledger;
   filed in `docs/TODOS.md` (2026-11-18).
8. **A "No" is stored too.** A question backed by a ledger category stores its yes/no half under the confirm key of
   the board that asked (`self.confirm.<claimId>` today; `love.confirm`, `work.confirm`, `family.confirm` proposed), so
   a "No" is kept once and not asked again. The ledger row is written only on a yes.
9. **A year is a follow-up tap, not a second question.** "Yes; then year" rows show one year picker after a yes.
10. **Death and illness of the person or a relative are not asked.** Those rows are listed in section 6 for the owner's
   decision, even where Rath used them.

**Fact-key labels.**
- **existing:** the key is in `FACT_CATALOG` (`src/profile/facts.ts`) or the category is in `LEDGER_CATEGORIES`
  (`src/reading/timeline/ledgerCategories.ts`).
- **doc 48, not built:** in doc 48's catalogue, absent from the code.
- **NEW key proposed:** in neither. `family.children` (none / expecting / young / grown) and `love.status` cannot hold
  counts, order or sex, so new keys are proposed for those. New keys go through the catalogue only (doc 48 §4.3).
- `self.confirm.<claimId>` is the existing yes / partly / no / skip store for the You board. Love and Work have no
  equivalent; `love.confirm.<claimId>` and `work.confirm.<claimId>` are proposed to mirror it.

**Tiers.** [A] the question appears in Rath's own worked cases · [B] from PVR Narasimha Rao or Visti Larsen · [Inferred]
derived from a stated rule (all of section 5 is derived; see files 07-10 for the rule each rests on).

**Sensitivity.** Low · Medium (private, third-party or money matters; the person may decline) · High (owner decision
before use) · Excluded (death or illness; section 6).

## 2. Birth-time source (asked once, at registration)

| # | Question | Answer | Tests | Tier | Asked only when | Stores | Sensitivity |
|---|---|---|---|---|---|---|---|
| 1 | Where does your birth time come from? | Birth record · A parent's memory · Estimate · Don't know | How wide a time window to test; whether the D60 and fine sub-periods may be used (`work.d10_check` gates D60 on a time "recorded to the minute") | [A] srath.com intake; [B] PVR: client times "seldom accurate" | Registration, once | NEW key proposed `birth.time_source` | Low |
| 2 | Is the time exact to the minute, or rounded? | To the minute · Rounded to 5-15 min · Rounded to the hour | Width of the candidate window; how many varga lagnas are in play | [B] PVR ch. 32.1-32.2 | #1 is record or memory | NEW key proposed `birth.time_precision` | Low |

## 3. Birth-time checks (rectification), in Rath's order

Order follows Chart 7: rising sign by appearance, then siblings (D3), then spouse (D9), then children (D7). Each is
asked only while two candidates disagree on its answer.

| # | Question | Answer | Tests | Tier | Prerequisite | Stores | Sensitivity |
|---|---|---|---|---|---|---|---|
| 3 | Would you describe your build as slim, medium or solid? | Slim · Medium · Solid | Rasi lagna sign when the window spans two rising signs | [A] *Crux* p.36 | Window spans two signs | NEW key proposed `self.build` | Medium (body image) |
| 4 | Are you taller or shorter than most people around you? | Taller · About average · Shorter | Rasi lagna sign (as #3) | [A] *Crux* p.36 | As #3 | NEW key proposed `self.height_band` | Medium |
| 5 | Has your name changed, or are you known by a name other than your birth name? | Yes · No | Name star as a Kunda target; Rath's name study (a weak tiebreak only, file 12 §2) | [A] srath.com intake; [B] Larsen | Only if a Kunda tiebreak is run | NEW key proposed `self.name_changed` (yes/no only; the name itself is not stored here) | Low |
| 6 | Do you have brothers or sisters? | Yes · No | Gate for #7-#11 | [A] *Crux* p.36 | — | NEW key proposed `family.siblings` | Low |
| 7 | How many older brothers and sisters do you have? | 0 · 1 · 2 · 3 · 4+ | 11th from the AL, its lord and occupants; D3 lagna | [A] *Crux* p.36, pp.119-120 | #6 = yes | NEW key proposed `family.siblings_older` | Low |
| 8 | How many younger brothers and sisters do you have? | 0 · 1 · 2 · 3 · 4+ | 3rd from the AL, its lord and aspects | [A] *Crux* p.36 | #6 = yes | NEW key proposed `family.siblings_younger` | Low |
| 9 | Is the sibling born just after you a brother or a sister? | Brother · Sister | The D3 lagna choice between two candidates | [A] *Crux* p.37 (neutral half) | #8 ≥ 1 | NEW key proposed `family.siblings_order` | Low |
| 10 | Starting with the eldest, tap brother or sister for each. | A short tap sequence, one tap per sibling; used only when #9 alone does not separate the candidates | Successive lords from the 3rd or 11th in the D3; Bhratrukaraka | [A] *Crux* pp.36-37, 119-120 | #7 + #8 ≥ 2 | `family.siblings_order` (as #9) | Low; third-party data |
| 11 | Is your eldest brother or sister more easy-going or more headstrong? | Easy-going · Headstrong · Not sure | That sibling's sign used as their own lagna | [A] *Crux* p.120 (temperament half only) | #7 ≥ 1 | NEW key proposed `family.confirm.<claimId>` | Medium (third party) |
| 12 | Are you married, or have you been? | Uses `love.status` chips | Whether the marriage can fix the D9 lagna (PVR: if married use it; if not, temperament and skills) | [A] *Crux* pp.37-38; [B] PVR ch. 32.3 | — | existing `love.status` | Low |
| 13 | In what year did you marry? | Year | D9 lagna and Upapada, timed by dasha | [A]; [B] PVR | #12 = married, separated or was married | existing ledger `marriage.wedding` | Low |
| 14 | Have you been married more than once? | Yes · No | 8th from the UL; 8th from the 7th | [A] *Crux* p.38 | #13 answered | NEW key proposed `love.marriage_count` | Medium |
| 15 | Has a marriage ended in separation or divorce, and when? | Separated · Divorced · No; then year | Upapada and its 2nd; D9 dusthana test (the non-death half of Rath's spouse step) | [A] *Crux* pp.37-38 | #13 answered | existing `love.status` = separated; existing ledger `marriage.separation` / `marriage.divorce`; a No in NEW key proposed `love.confirm.<claimId>` | Medium |
| 16 | Do you earn mainly through your own skill or trade, or as part of an employer's team? | Own skill · Employer · Both | An occupant of the D9 lagna (Saturn: earns by own skill) | [A] *Crux* p.38 | `work.status` known and not retired | existing `work.status` / `work.level`; NEW key proposed `work.own_skill` only if the skill sense must be kept apart | Low |
| 17 | How many children do you have? | 0 · 1 · 2 · 3 · 4+ | D7 lagna | [A] *Crux* p.38 | `family.children` = young or grown | NEW key proposed `family.children_count` | Medium |
| 18 | Is your first child a son or a daughter? | Son · Daughter · Prefer not to say | D7 5th lord | [A] *Crux* p.38 | #17 ≥ 1 | NEW key proposed `family.children_order` | Medium; stored only, nothing read about a child under 18 |
| 19 | Is your second child a son or a daughter? | Son · Daughter · Prefer not to say | D7 7th lord; the step that decided Chart 7 | [A] *Crux* p.38 | #17 ≥ 2 | `family.children_order` (as #18) | Medium; as #18 |
| 20 | Do you have children from more than one relationship? | Yes · No | 8th from the D7 5th | [A] *Crux* pp.38-39 | #14 = yes and #17 ≥ 1 | NEW key proposed `family.children_second_union` | High (owner decision) |
| 21 | Did you move abroad? In what year? | Yes · No; then year | D4 9th and 12th lords and Rahu, timed by dasha | [B] PVR p.428 | — | existing ledger `residence.abroad`; a No in existing `self.confirm.<claimId>` | Low |
| 22 | How far did you study, and in what year did you finish? | School · College · Degree · Higher degree; then year | D24 4th house and A4, timed by dasha | [B] PVR pp.430-431 | — | NEW key proposed `education.level`; year in existing ledger `education.graduation` / `education.end` | Low |
| 23 | Which best describes your work now? | `work.level` chips | D10 lagna and the D10 AL | [B] PVR p.430 | `work.status` = yes or own business | existing `work.level` | Low |
| 24 | Do you know the month as well as the year? | Month · Year only | Vimshottari start dates move about (n×m)/4 days per minute of birth-time error; confirm with Narayana | [A] *Crux* p.3; [B] PVR p.425 | After any dated yes | existing `life_events.date_precision` | Low |

## 4. Family facts used outside rectification

Questions #6-#19 above also serve the family readings (files 09 and 10); they are asked once and reused. Two more:

| # | Question | Answer | Tests | Tier | Prerequisite | Stores | Sensitivity |
|---|---|---|---|---|---|---|---|
| 25 | Which parent were you closer to growing up? | Mother · Father · Both · Neither | 4th and 9th, their karakas, A4 (see 09) | [Inferred] | — | NEW key proposed `family.closer_parent` | Medium |
| 26 | Did your father's guidance shape your choices, or did you go your own way early? | Shaped · Own way · Both | 9th house and the Sun (see 09) | [Inferred] | — | `self.confirm.<claimId>` | Medium |

## 5. Life-area confirmations (chart-led, after the chart is settled)

Each is asked only when its area's house state is tested or supported (doc 48 §4.1). Detail and the rule behind each in
files 07-10.

| # | Area | Question | Answer | Tests (see file) | Tier | Prerequisite | Stores | Sensitivity |
|---|---|---|---|---|---|---|---|---|
| 27 | Self | Do people who know you well find you more strong-willed than you first seem? | Yes · Partly · No | D9 lagna dominates the blend (07 §1) | [Inferred] from [A] | — | existing `self.confirm.<claimId>` | Low |
| 28 | Self | Does {the person's own lesson, e.g. learning humility} keep coming back in your life? | Yes · Partly · No | The AK's lesson by planet (07 §1); the chart picks the one lesson | [Inferred] from [A] | — | existing `self.confirm.<claimId>` | Low |
| 29 | Self | Are you more at ease with ideas and planning, or with hands-on routine? | Ideas · Routine · Both | Nakshatra lord (mind) against sign lord (body) (07 §1) | [Inferred] from [A] | — | existing `self.confirm.<claimId>` | Low |
| 30 | Fortune | Did things clearly turn in your favour around age {age from the engine}? | Yes · Partly · No | 9th lord, 9th from the AL, years of fortune (07 §2) | [Inferred] from [A] | Age past the named age | existing `self.confirm.<claimId>` | Low |
| 31 | Spirit | Have you felt drawn to a particular practice or teacher since childhood? | Yes · No | 12th and 9th from the karakamsa, D20 (07 §3) | [Inferred] from [A] | `self.focus` includes faith, or the person opened the topic | existing `self.confirm.<claimId>` | Medium (belief) |
| 32 | Spirit | Have there been times you wanted to step back from worldly goals? When? | Yes · No; then year | Renunciation timed by Drig dasa and the AK's dasa (07 §3) | [Inferred] from [A] | As #31 | existing `self.confirm.<claimId>` | Medium |
| 33 | Work | Do you work for an employer or run something of your own? | `work.status` chips | Service against business (08 §1) | [Inferred] from [A] | — | existing `work.status` | Low |
| 34 | Work | When did you last start a new job or role? | Year (month optional) | Dasha timing of the 10th (08 §1) | [Inferred] from [A] | `work.status` = yes | existing ledger `job.start` / `job.role_change` | Low |
| 35 | Work | Did that role come through a colleague or contact rather than a boss? | Yes · No | D10: the 5th for subordinates and authority against the 9th for the boss (08 §1, row 1.20) | [Inferred] from [A] | #34 answered | NEW key proposed `work.confirm.<claimId>` | Low |
| 36 | Work | Is your work mostly in one place, or does it keep you moving? | One place · Moving · Both | 10th lord's navamsa sign: fixed a desk job, movable moving about, dual mixed (08 §1, row 1.8; *Crux* 13.7) | [Inferred] from [A] | `work.status` = yes or own business | NEW key proposed `work.confirm.<claimId>` | Low |
| 37 | Money | Does most of your money come from your own work, family, or a partner or deals? | Own work · Family · Partner or deals | 2nd, 11th and 12th from the AL; HL (08 §2) | [Inferred] from [A] | — | NEW key proposed `money.main_source` | Medium |
| 38 | Money | Was there a year when money clearly turned up or down? | Up · Down · No; then year | Sudasa and the 2nd/11th (08 §2) | [Inferred] from [A] | — | existing ledger `money.gain` / `money.loss`; a No in NEW key proposed `work.confirm.<claimId>` | Medium |
| 39 | Love | When did your current relationship begin? | Year | 7th, UL and Venus timing (09 §2) | [Inferred] from [A] | `love.status` = dating, committed or married | existing ledger `relationship.start` | Low |
| 40 | Love | Did your partner come from the same area as you, or from far away? | Same area · Nearby · Far away | 7th lord counted from Venus: fixed same region, dual nearby, movable distant (09 §2, row 2.8; *Crux* Ch. X) | [Inferred] from [A] | `love.status` = committed or married | NEW key proposed `love.confirm.<claimId>` | Medium |
| 41 | Love | How do you get on with your partner's family? | Well · Mixed · Hard | Planets with the UL show the spouse's family; Sun 12th from it and Moon 7th from it for the in-laws (09 §2, row 2.3) | [Inferred] from [A] | `love.status` = married | NEW key proposed `love.confirm.<claimId>` | Medium |
| 42 | Love | Have your close relationships tended to be few and long, or several and shorter? | Few and long · Several and shorter | 5th, Venus, A7 (09 §1) | [Inferred] from [A] | — | NEW key proposed `love.confirm.<claimId>` | Medium |
| 43 | Children | Does any of your children live far away or abroad? | Yes · No | The child's own lagna (pregnancy lord's sign) in the 12th from the D7 lagna: lives abroad (09 §3, row 3.11) | [Inferred] from [A] | `family.children` = grown | NEW key proposed `family.confirm.<claimId>` | Medium |
| 44 | Family | Do you and your wider family mostly help each other? | Mostly · One side carries the other · Little contact | 3rd and 11th, A2 (09 §5) | [Inferred] from [A] | — | NEW key proposed `family.confirm.<claimId>` | Medium |
| 45 | Learning | Was there a time your studies were interrupted? When? | Yes · No; then year | D24 timing (10 §2) | [Inferred] from [A] | #22 answered | existing ledger `education.end`; a No in existing `self.confirm.<claimId>` | Low |
| 46 | Home | Do you own your home, rent it, or let a property to others? | Own · Rent · Let out | 4th, A4 from the AL, D4 (10 §3) | [Inferred] from [A] | — | NEW key proposed `home.tenure` | Medium |
| 47 | Home | Did you move house around {year the chart names}? | Yes · No | D4 Narayana timing (10 §3); the chart names the year | [Inferred] from [A] | — | existing ledger `residence.move` (with the `direction` attribute if offered) | Low |
| 48 | Travel | Does your work regularly take you to other countries? | Yes · No | 12th with the 7th and 9th (10 §4) | [Inferred] from [A] | `work.status` = yes or own business | NEW key proposed `work.confirm.<claimId>` | Low |
| 49 | Disputes | Have you been through a legal case or a serious dispute? When? | Yes · No; then year | AL against A6, D6 (10 §5) | [Inferred] from [A] | Only if the person opened the topic | NEW ledger category proposed `legal.case`; a No in existing `self.confirm.<claimId>` | High (owner decision) |
| 50 | Money | Do you tend to earn well but find it slips away, or is money slow to come but stays? | Slips away · Slow but stays · Neither | Planets linked to both the 11th and the 12th from the AL turn gain to loss (08 §2, row 2.7) | [Inferred] from [A] | — | NEW key proposed `work.confirm.<claimId>` | Medium |
| 51 | Love | In a partner, do you look first for warmth and affection, or for shared work and plans? | Warmth · Shared plans · Both | Venus and the D9 for love and affection (09 §1, row 1.2) | [Inferred] from [A] | — | NEW key proposed `love.confirm.<claimId>` | Low |
| 52 | Home | Are a comfortable home and a good car important to you? | Very · Somewhat · Not much | 4th-house karakas (Venus for vehicles), D16 for comforts (10 §3) | [Inferred] from [A] | — | existing `self.confirm.<claimId>` | Low |
| 53 | Travel | Was your move abroad driven more by things at home or by work and study chances? | Things at home · Work or study · Both | The 4th and 8th (trines to the 12th) push a move (10 §4) | [Inferred] from [A] | #21 = yes | existing `self.confirm.<claimId>` | Medium |
| 54 | Disputes | Do you do well in head-to-head competition, or tend to step back? | Do well · Step back · Depends | 3rd and 6th from the AL against those from the A6 (10 §5) | [Inferred] from [A] | — | NEW key proposed `work.confirm.<claimId>` | Low |

Health: no question proposed (file 10 §1). The You board's existing "Has your health or your daily routine needed more
attention lately?" (`CONFIRM_BY_HOUSE`, houses 6 and 8) is not a Rath question and is unchanged.

Items from the "What to confirm" lists in 07-10 not carried as separate questions:

| Item | File | Why |
|---|---|---|
| Has a parent's or teacher's backing been a large part of your good breaks? | 07 §2 | Folded into #26 |
| Does someone act as a guide whose advice you keep returning to? | 07 §3 | Folded into #31 |
| Is your relationship with your eldest child close or independent? | 09 §3 | A judgement about a named child, who may be under 18; owner decision |
| Was your mother's family better or less well off than your father's? | 09 §4 | Compares third parties' wealth; low value for the sensitivity |
| Did you ever study abroad or away from home? | 10 §2 | Covered by #21 and #22 (ledger `education.start` with the `country` attribute) |
| Has someone you trusted turned out to be working against you? | 10 §5 | Invites suspicion of a named person; owner decision |

## 6. Excluded: needs the owner's decision

Rath used each of these as evidence; none is asked until the owner decides. Titles only; see
[15](15-sensitive-rules-and-gaps.md).

| Rath's question | Tier | Why excluded |
|---|---|---|
| Are all your older siblings living? Did any younger sibling die young, and when? | [A] *Crux* pp.36-37 | Death of a relative |
| Is your spouse living? Was there a loss, and when? | [A] *Crux* pp.37-38 | Death of a relative |
| Did your first child have a serious health issue? | [A] *Crux* p.38 | Illness of a child |
| Is your father living? If not, when and how did he die? | [A] *Crux* pp.39, 213-214 | Death of a relative; in Rath's case the final proof |
| Is your mother living? If not, when did she die? | [A] *Crux* p.214 | Death of a relative |
| How would you describe your complexion? | [A] *Crux* p.36 | Skin colour; not asked in any form |
| Ledger categories `family.father.death`, `family.mother.death`, `family.*.illness`, `health.*` | existing | The person may log these themselves; the assistant does not ask for them |

## 7. Counts and keys

- **54 questions** (#1-#54): 2 birth-time source, 22 rectification and fact checks, 2 family, 28 life-area. A further
  6 Rath questions are excluded (section 6), and 6 items from files 07-10 are folded in or omitted with a reason
  (section 5).
- **By tier:** [A] only 15, [A] with [B] 5 (#1, #5, #12, #13, #24), [B] only 4 (#2, #21, #22, #23), [Inferred] 30
  (#25-#54).
- **Existing keys used:** `love.status`, `work.status`, `work.level`, `self.confirm.<claimId>`, `family.children` (as a
  prerequisite), and ledger `marriage.wedding`, `marriage.separation`, `marriage.divorce`, `residence.abroad`,
  `residence.move`, `education.graduation`, `education.end`, `job.start`, `job.role_change`, `money.gain`,
  `money.loss`, `relationship.start`.
- **New keys proposed:** `birth.time_source`, `birth.time_precision`, `self.build`, `self.height_band`,
  `self.name_changed`, `family.siblings`, `family.siblings_older`, `family.siblings_younger`, `family.siblings_order`,
  `family.children_count`, `family.children_order`, `family.children_second_union`, `family.closer_parent`,
  `love.marriage_count`, `money.main_source`, `home.tenure`, `education.level`, `work.own_skill` (optional), the prefixes
  `love.confirm.*`, `work.confirm.*`, `family.confirm.*`, and the ledger category `legal.case`.
- **doc 48, not built:** none of the questions above needs `work.how_going`, `work.hardest`, `love.hardest` or the
  other doc 48 keys; they stay as doc 48 designed them.
