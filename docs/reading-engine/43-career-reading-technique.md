# 43 — The career reading technique: what to look at, in what order, and how to say "it will not happen"

Status: method, 2026-11-05. The astrology that the career module of [doc 42](42-life-area-reading-career.md) codes and
that its agents follow. Written from the hand-made Sumit career charter (Oct 2026 – Dec 2028), docs 10, 27, 29, 33 and
34, the stored rows of a real kundli, and outside evidence on what people ask about work (§2).

Rules that hold everywhere: every value comes from the engine's stored rows; Node never derives a house, lord or sign;
nothing a user reads names the engine or its library; a date with no stored row behind it is never written.

---

## 0. Answer first

1. **An agent needs a focus, and the focus is one question per sub-area, asked in a fixed order:**
   *Is it promised? → What blocks it? → When does a period open it? → What triggers it? → Does this year's chart agree?*
   The answer is one of three verdicts: **promised and open** (time it), **promised but blocked** (name the blocker and
   time its release), or **not promised** (say it will not come in that form, say the form it does take, and never put a
   date on it).
2. **Career splits into seventeen sub-areas, ranked by how often people ask** (§2). Six of them make up most of the
   demand: when will I get a job, should I change job, promotion and growth, job security and layoffs, work abroad, and
   which field suits me.
3. **What to read, by layer** (§3): the D10 first, with D1, D9, D2, D3, D4, D5, D6, D8, D11, D24, D30 and D60 each for
   named sub-areas only; the main clock at three levels, Narayana, the conditional dasha the chart qualifies for, the
   karaka clock, Yogini and Tithi Ashtottari as confirmers; each year's Tithi Pravesha chart with its D10, its own dasha,
   Mudda, Patyayini and the career sahams; and the transit overlay for slow gates, double transit, eclipses and days.
4. **A bad career period is a cluster, not one event** (§5). When the job-end gate fires, the reading also checks income,
   dispute, relocation, visa and health, because they share houses with it.
5. **Layoff, firing and resignation have different signatures** (§6). All three need the job-end gate. A layoff adds an
   impersonal signature (12th and 8th from the 10th, the nodes, an eclipse). A firing adds a dispute signature (the 6th,
   Mars or Saturn on the Sun or the 10th lord, the reputation point hit). A resignation adds the person's own will (the
   lagna lord or the 3rd lord running) and usually a start gate within months.
6. **Proving absence** (§7). The rules can show exactly that *no job-end signal* fires in a period: the code checks every
   gate, and the result can be shown and audited. They cannot prove that life will follow. How often "clear" periods
   really stayed clear is measured from the person's own past events and from all users' marked events. It is shown
   beside the verdict. The product never says "guaranteed" or "absolutely".
7. **Where the person is now comes first** (§8). Seven independent families vote storm or fair for the 30 days around
   today. Each dasha vote counts only when D1 and D10 agree about its lord, with D9 breaking ties and D60 confirming when
   the birth time is exact. Five or more agreeing families make the state *confirmed*, four make it *likely*, and fewer
   make it *split*. A split state is not guessed: the board asks the person. 100 % cannot be promised; the method's
   real accuracy is measured from the person's answers and their past.
8. **Not every storm is the ER** (§8.2). Politics, a bad boss, slipping projects, credit taken, a pay cut or overwork
   each have their own signature and their own care level: ER (the job at risk), urgent care (a named problem now),
   doctor's visit (a nagging problem) or check-up.
9. **The work level** (§8.3) is estimated from the chart (ceiling, style, direction now), confirmed by the person with one
   tap, and scored. The chart cannot read a present job title with certainty; the person's answer always wins.

---

## 1. The focus: five questions per sub-area

Every reader and the Oracle work sub-area by sub-area, never "the 10th house in general". For each sub-area:

| Step | Question | Where the answer comes from | If the answer is no |
|---|---|---|---|
| 1 Promise | Does the natal chart promise this at all, and in what form? | D1 houses and lords of the sub-area, their strength, the D10 (and the sub-area's other vargas), Jaimini points, yogas | Verdict **not promised**: say so plainly, give the form the chart does promise, stop. No timing. |
| 2 Blocker | If promised, what delays, reduces or spoils it? | Afflictions to the sub-area's lord and karaka, dusthana links, debilitation or combustion without cancellation, Saturn or node aspects, argala obstruction, low SAV, a dusthana position in D10, D30 and D60 malefic links | No blocker: **promised and open** |
| 3 Period | Which periods open it? | The clocks of §3.2, at three levels, one planet one vote | Promised but no opening period in the span: "not in this span", with the next opening date if it is in the stored tables |
| 4 Trigger | What sets the date inside the period? | Slow gates in the overlay, then fast planets and days | Period alone: a **soft window** (shown as minor, never major) |
| 5 Confirm | Does this year's chart agree? | Tithi Pravesha chart and its D10, its dasha, Mudda, Patyayini, sahams | Disagreement lowers the grade one step and is written down |

**Blocked versus denied.** A blocker delays or reduces a promise; it does not remove it. The release of a blocker is a
date (the blocking planet's period ends, Saturn leaves the sign, a cancellation planet's period runs). Denial is a natal
fact: the sub-area's house, lord and karaka are all weak and afflicted in D1 and D10, with no yoga or cancellation. Denial
is rare and is stated only when D1, D10 and D9 all agree.

## 2. What people ask about work, ranked

**Evidence.**
- Astrotalk, the largest Indian astrology app, reports that career and money make up about 28 % of questions
  (January 2026) and, with relationships, about 95 % of all questions (2025). Education, career and relocation together
  were about 40 % of consultations in early 2026, up 50 % on a year before. These are the company's own press releases,
  not audited.
- In those reports the named top questions are "When will I get a job?" and, in 2025, "Is AI going to take my job?". The
  2025 report cites a 50 % year-on-year rise in job-loss anxiety.
- Astrologers' question guides list the same set again and again: job change and its timing, promotion and stagnation,
  government jobs, jobs and settling abroad, business versus job, and which career suits.
- Our own classifier (`src/reading/buckets/taxonomy.ts`) has five career sub-buckets: job change, promotion or
  recognition, finding a job, trouble with boss or team, and career direction.
- Our own logs are too thin to rank anything yet: four traced questions, none with a bucket (checked 2026-11-05). Re-rank
  once 500 career questions are logged, from `reading_traces.bucket` and the clarify `subBucket`.

**The ranking** (from the evidence above; tiers set the build order):

| Rank | Sub-area | What people ask | Tier |
|---|---|---|---|
| 1 | **Getting a job** (search, offer, the end of a gap) | When will I get a job? Will this interview work? | 1 |
| 2 | **Job change** | Should I change job? Is this the right time to switch? | 1 |
| 3 | **Promotion and growth** (and stagnation) | When will I be promoted? Why am I stuck? | 1 |
| 4 | **Job security** (layoff, firing, resignation, AI) | Will I lose my job? Is AI going to take my job? | 1 |
| 5 | **Work abroad and relocation for work** | Will I get a job abroad? Will I settle abroad? Will the job move me? | 1 |
| 6 | **Career direction** (vocation) | What kind of work suits me? Which field? | 1 |
| 7 | **Government job** | Will I get a government job? When? | 2 |
| 8 | **Job or own business** | Business or job? When to start on my own? | 2 |
| 9 | **Salary and income from work** | Will I get a raise? Will my pay be cut? | 2 |
| 10 | **Boss, colleagues and politics** | Why is my boss against me? Will this conflict end? | 2 |
| 11 | **Interviews and competitive exams** | Will I clear the exam? Will I be selected? | 2 |
| 12 | **Transfer and work travel** | Will I be transferred? Will work send me abroad? | 2 |
| 13 | **Recognition and reputation** | Will I be recognised? Will my work be credited? | 3 |
| 14 | **Leading a team, building a department** | Will I get a team? Will I lead? | 3 |
| 15 | **Career break, restart, retirement** | When can I return to work? When should I retire? | 3 |
| 16 | **Skills and study for work** | Should I study or certify now? | 3 |
| 17 | **Mentor and sponsor** | Who will back me? When will the top favour me? | 3 |
| — | **Luck at work** | Is this a lucky period for work? | modifier on every window |

Sources: [Astrotalk January 2026 queries](https://www.bwdisrupt.com/article/astrotalk-sees-50-spike-in-january-queries-as-relationship-concerns-dominate-592196),
[Astrotalk 2025 report on AI and jobs](https://cxotoday.com/press-release/astrotalk-report-is-ai-going-to-take-my-job-ranks-among-the-top-questions-indians-asked-astrologers-in-2025/),
[Astrotalk career and relocation queries](https://www.passionateinmarketing.com/astrotalk-sees-50-jump-in-career-and-relocation-queries-amid-geopolitical-tensions/),
[Astroyogi top 10 questions](https://www.astroyogi.com/blog/top-10-questions-people-ask-astrologers.aspx),
[Vedicfeed questions to ask](https://vedicfeed.com/questions-to-ask-astrologer/),
[Duastro career questions](https://duastro.com/blog/career-astrology-what-to-ask-an-astrologer-about-your-job).

## 3. What to read, layer by layer

### 3.1 Divisional charts, D1 to D60

Read the D10 first for every sub-area. The other vargas are read only for the sub-areas named. "Birth time" marks the
charts that change with a few minutes of birth time: use them for a verdict only when the birth time is recorded to the
minute and the ledger supports it.

| Chart | Stored key | What it says about work | Sub-areas | Priority |
|---|---|---|---|---|
| D1 Rasi | `varga.d1`, `bhava`, `house_counts`, `aspects`, `argala.d1`, `dignities` | Everything: 10th house, lord, occupants, aspects; 6th (service), 7th (trade), 2nd and 11th (pay), 9th and 5th (end of a job, counted from the 10th) | all | must |
| D2 Hora | `varga.d2` | Capacity to earn and hold money | salary, business | should |
| D3 Drekkana | `varga.d3` | Effort, initiative, colleagues | resignation (own will), team, politics | should |
| D4 Chaturthamsa | `varga.d4` | Home, fixed place, property | relocation, transfer, abroad | must for those |
| D5 Panchamsa | `varga.d5` | Authority, power, fame | promotion, recognition, government job | should |
| D6 Shashthamsa | `varga.d6` | Disputes, enemies, illness | firing, politics, health-forced leave | should |
| D8 Ashtamsa | `varga.d8` | Sudden events and breaks | layoff, sudden loss | only if D1 shows an 8th link |
| D9 Navamsa | `varga.d9`, `dignities.d9` | True strength of every planet; dharma and luck; the 10th from D9 | all (confirms or cancels) | must |
| **D10 Dasamsa** | `varga.d10`, `dignities.d10`, `aspects.d10`, `argala.d10`, `arudhas.d10`, `relations.d10` | The career chart: its lagna (the work life), 10th (status), 11th (gains from work), 6th (service, rivals), 7th (trade), 2nd (pay), 4th and 12th (place, abroad), 8th (breaks) | all | must, first |
| D11 Rudramsa | `varga.d11` | Gains and sudden losses | salary, layoff | only if D10 is unclear |
| D12 Dwadasamsa | `varga.d12` | Parents, inherited calling | vocation (family profession) | optional |
| D16 Shodasamsa | `varga.d16` | Comforts and perks | salary (benefits) | optional |
| D20 Vimsamsa | `varga.d20` | Spiritual work | vocation (spiritual or teaching work) | optional |
| D24 Chaturvimsamsa | `varga.d24` | Learning, degrees, exams | exams, skills, government job (selection by exam) | must for those |
| D27 Bhamsa | `varga.d27` | Stamina and weak points | career break | optional |
| D30 Trimsamsa | `varga.d30` | Misfortune, scandal, wrongdoing | firing, disputes, blockers | should for job security |
| D40, D45 | `varga.d40`, `varga.d45` | Maternal and paternal legacy, character | vocation | optional |
| D60 Shashtyamsa | `varga.d60` | Karma, the final check on promise and denial | promise and denial of every sub-area | must, birth time |

Strength layers used with the charts: `strength.shadbala` (can the lord act), `strength.vimsopaka` (strength across
vargas), `strength.bhava` (house strength of the 10th, 6th, 11th), `ashtakavarga` (SAV of the 10th sign below 25 is a
blocker; above 28 supports), `avasthas.d10` (the planet's state in the career chart), `yogas` (Raja, Dhana, Pancha
Mahapurusha, Neecha Bhanga, Viparita), `doshas`.

Jaimini points: `karaka.chara` (AmK, the career karaka; AK, the self), `arudhas` (A10, how the work is seen; AL, the
public image; A6, A7, A11, A12), `sphutas` (Hora and Ghati lagnas: HL for wealth, GL for power).

### 3.2 Dasha systems

Clocks are grouped in families so that copies do not count twice. A planet running in two clocks of the same month is
one vote (doc 29 §3.2).

| Clock | Stored key | What it times for work | Family | Weight |
|---|---|---|---|---|
| Vimshottari, three levels | `dasha.vimsottari.l3` | The main clock for every sub-area | graha | primary |
| The conditional dasha the chart qualifies for | `dasha.applicable` lists each with its rule and `applies` | Chathuraaseethi Sama applies when the 10th lord is in the 10th, so it is a career clock by its own condition. Others: Ashtottari (Rahu kendra or trikona from the lagna lord), Dwadasottari (D9 lagna Taurus or Libra), Dwisatpathi (lagna lord in the 7th or 7th lord in the lagna), Panchottari (D12 lagna Cancer), Sataatbika (vargottama lagna), Shastihayani (Sun in the lagna) | graha | primary when it applies |
| Narayana | `dasha.narayana` | Events and status by sign; the strongest rasi clock for career events | rasi | primary |
| Karaka (Jaimini) | `dasha.karaka.l3` | AmK and AK periods: the work and the self | karaka | secondary |
| Chara | `dasha.chara` | Jaimini sign periods; position and environment | rasi | secondary |
| Sudasa | `dasha.sudasa` | Wealth and status, from Sree lagna | rasi | secondary for promotion and salary |
| Yogini, three levels | `dasha.yogini.l3` | Short-cycle confirmer | graha | confirmer only |
| Tithi Ashtottari, three levels | `dasha.tithi_ashtottari.l3` | Confirmer; pairs with the Tithi Pravesha year | graha | confirmer only |
| Drig | `dasha.drig` | Dharma, guidance | rasi | mentor and luck only |
| Kaala, Moola, Kalachakra, Tara and the other stored clocks | `dasha.*` | Not used for career until the ledger shows they add accuracy for a person | — | off by default |

Rules: a clock *opens* a window only if it is primary; confirmers count only in a month a primary clock already opened.
The edge of a period (its first and last month) carries most events (doc 29 §3.4).

### 3.3 The annual chart (Tithi Pravesha) and its clocks

| Layer | Stored key | What to read for work |
|---|---|---|
| Tithi Pravesha chart | `annual.tithi_pravesha` (`year=YYYY`) | Its lagna and lagna lord; its 10th, 6th, 11th, 2nd, 12th; where the natal 10th lord and AmK fall; whether its lagna rises on the natal AL or 10th |
| Its D10 | `annual.tithi_pravesha` with `divisional_chart_factor=10` | The year's work chart: benefic in its 10th supports a rise; 10th lord in 6, 8 or 12 is a testing year |
| Its own dasha | `annual.tithi_pravesha_dasha` (`system=tithi_ashtottari`) | Which months of the year carry the theme |
| Varsha (Tajika) | `annual.varsha` | Year lord, muntha house (muntha in the 10th or 11th supports work) |
| Mudda | `annual.mudda` | The main clock compressed into the year: the month the year's work event lands |
| Patyayini | `annual.patyayini` | Tajika month periods; confirms Mudda |
| Sahams | `annual.sahams` | Career keys: `rajya` (authority), `karma` (work), `yasas` (fame), `gaurava` (respect), `laabha` (gains), `artha` (wealth), `vanika` and `vyaapaara` (trade), `paradesa` (abroad), `karyasiddhi` (success of the undertaking), `samartha` (capacity), `asha` (hopes), `sathru` (enemies), `bandhana` (restraint). A saham in a kendra or trikona of the year chart with its lord strong supports; in 6, 8 or 12 tests |

The annual chart confirms or contradicts a natal window; it never opens one on its own.

### 3.4 Transit charts

Transits are one shared sky for all users (doc 35). The person's houses come from the engine's overlay for that kundli.
Use the sky for the place the person lives now.

| Layer | From | What to read for work |
|---|---|---|
| Slow gates | overlay `house_from_lagna`, `house_from_moon`, contacts | Jupiter, Saturn, Rahu and Ketu by house from the lagna and the Moon, and their contacts on the 10th lord, AmK, A10, the Sun, the Moon, the lagna lord |
| Double transit | overlay `double_transit` | Jupiter and Saturn both on the 10th or its lord: the strongest single trigger for a change of position |
| Saturn on the Moon | overlay sade sati fields | Pressure on the work life; its middle phase is the heaviest |
| Eclipses | shared sky lunations | An eclipse on the 10th to 4th axis, or within a few degrees of the 10th lord, marks a turn |
| Stations | shared sky | A slow planet turning on a career point fixes the date |
| Ashtakavarga | `ashtakavarga` | A slow planet in a sign with high SAV or high own BAV gives; low takes |
| Fast layer | shared sky | Sun and Mercury crossings, Mars contacts, Mercury retrograde (no signing), new and full moons |
| Days | overlay with `--step day` | Moon house, tara from the birth star, tithi, weekday: day grades act, good, routine, hold |

## 4. The focus card for each sub-area

Each card lists what is read for the promise, what counts as a blocker, when it is denied, the clocks and triggers that
time it, and the annual check. Houses are from the lagna unless marked, then checked again from the Moon. "From the 10th"
means houses counted from the 10th: 2nd from it (11th) is the job's pay, 3rd from it (12th) travel for work, 6th from it
(3rd) competition in the job, 8th from it (5th) a break, 12th from it (9th) the end of the job.

**1. Getting a job.** Promise: 10th, 6th (service) and 11th linked to the lagna lord; AmK and the 10th lord with
strength; D10 lagna lord well placed. Blockers: 10th lord or AmK in 6, 8 or 12 of D10; Saturn's aspect on the 10th; low
SAV of the 10th. Denied: almost never; when the 10th is weak, the form is work for others in a junior or irregular role,
or own small trade. Timing: a period of the 10th, 6th or 11th lord, or of AmK; Narayana on the 10th or the A10 sign.
Trigger: Jupiter on the 10th, 6th or 11th, or on the 10th lord; double transit on the 10th. Annual: muntha or year lord
in 10th or 11th; `karma` and `karyasiddhi` sahams well placed.

**2. Job change.** Promise: a movable or dual 10th sign or 10th lord; Rahu or Saturn linked to the 10th; D10 lagna lord
in a movable sign. Blockers: a fixed 10th with its lord strong in a kendra (the chart prefers rising inside one place).
Timing: an edge in a clock whose lord signifies both the end houses (9th, 5th, 12th) and a start house (10th, 6th, 11th);
a Narayana sign change onto the 10th or A10. Trigger: Saturn or a node entering the 10th or crossing the 10th lord or
AmK, with Jupiter on the 6th, 10th or 11th. Annual: year chart lagna or year lord in the 10th or 12th. A change shows as
an end gate and a start gate within six months of each other (§6).

**3. Promotion and growth.** Promise: Raja yoga involving the 10th or 9th lord; Sun strong; the D10 10th lord strong;
the A10 or AL with benefics. Blockers: Sun debilitated or with Saturn; the 10th lord combust; Saturn aspecting the 10th
(promotion late, by seniority). Stagnation is a blocker running: name its planet and its end date. Timing: 10th or 11th
lord sub-periods; Sudasa on the 10th or 11th; AmK periods. Trigger: Jupiter exact on the 10th lord, AmK or Moon;
double transit on the 10th. Annual: a benefic in the D10 10th of the year chart; `rajya` saham strong.

**4. Job security** (layoff, firing, resignation): see §5 and §6.

**5. Work abroad and relocation for work.** Promise: the 12th and 9th linked to the 10th or the lagna; Rahu in the 12th,
9th or 10th; the 4th lord in the 12th or the 12th lord in the 4th (home away from the birthplace); D4 and D10 12th
occupied; D9 supports. Blockers: a strong fixed 4th with its lord in the 4th (the chart keeps the person at home). Denied:
the 12th, 9th and Rahu have no link to the 10th or the lagna in D1 and D10; the form is travel without settling. Timing:
4th and 12th lords together with a 10th signal; Rahu periods; Narayana on the 12th or 9th. Trigger: Saturn or Rahu on the
4th, 12th or the Moon. Annual: year lord in the 4th or 12th; `paradesa` saham strong. Visa questions read the 12th and
the 6th (paperwork, the authority).

**6. Career direction.** Natal only, no timing: the 10th sign and lord, its star, its dispositor; AmK; planets in the
10th; the D10 lagna and 10th; the D9 10th; the strongest planet by shadbala; D24 for the trained field. Employee or own
business: the 6th and 10th stronger than the 7th means service.

**7. Government job.** Promise: Sun and the 10th linked; Sun strong in D1 and D10; Saturn (the system) linked to the 10th;
the 10th or its lord in a fixed sign helps permanence. Timing: Sun, 10th lord or Saturn periods. Trigger: Jupiter on the
Sun or the 10th; exams by the D24 and the 5th and 4th. Annual: `rajya` saham strong.

**8. Job or own business.** Promise: the 7th and its lord, Mercury, the 3rd (own effort), HL; the 7th stronger than the
6th. Timing: 7th lord with a 10th signal. Trigger: Jupiter on the 7th or its lord. Annual: `vanika`, `vyaapaara` sahams.

**9. Salary and income.** Promise: the 2nd and 11th and their lords; Jupiter and Venus; D2; D10 2nd and 11th. Blockers:
the 11th lord in the 12th, Rahu in the 2nd without Jupiter's aspect (big, unsteady numbers). Timing: 2nd and 11th lord
periods. Trigger: Jupiter on the 2nd or 11th or their lords. Annual: `laabha` and `artha` sahams. A cut shows as the 2nd
and 11th tested with no end gate.

**10. Boss, colleagues, politics.** Read the 6th (rivals), the Sun (the boss), Saturn (superiors), Mars (fights), the D10
6th and 8th, D6 and D30. Timing: 6th or 8th lord periods, Mars sub-periods. Trigger: Mars or Saturn on the Sun or the 10th
lord. Annual: `sathru` saham. The conflict ends when the triggering planet's sub-period ends or the transit leaves.

**11. Interviews and competitive exams.** The 4th, 5th and 9th; Mercury and Jupiter; D24. The 6th (competition) with
strength means winning against others. Timing: 5th or 4th lord periods with a 10th or 6th signal. Trigger: Jupiter on the
5th or 9th, Mercury direct. Days: the act days of the week view.

**12. Transfer and work travel.** A transfer is the 10th with the 4th, 3rd or 12th and no end gate. Work travel is the
3rd and 12th (short) or the 9th and 12th (long) with Mercury or Rahu. Trigger: slow planets on the 3rd, 9th, 12th or the
4th; the Moon's sign changes for the week. Annual: year chart 9th and 12th.

**13. Recognition and reputation.** The A10 and AL, the Sun, the 10th and 11th, D5. Trigger: Jupiter aspecting the AL or
A10; the Sun over the 10th. Annual: `yasas` and `gaurava` sahams.

**14. Leading a team.** The 10th with the 6th (people under you) and 11th; Mars (command), Sun (authority), Saturn
(structure); the D10 6th and 11th. Trigger: Mars contacts on the Sun or the 10th lord; Jupiter on the 11th.

**15. Career break, restart, retirement.** A break is the end gate with no start gate (§6). A restart is the next start
gate. Retirement is the 12th and Ketu with Saturn, in an age-appropriate period.

**16. Skills and study.** The 4th, 5th and 9th; Mercury and Jupiter; D24. Timing: 4th, 5th or 9th lord periods.

**17. Mentor and sponsor.** The 9th and its lord, Jupiter, the Sun. Trigger: Jupiter on the natal Sun or the 9th lord.

**Luck at work** is a modifier: the 9th and 5th lords and Jupiter running, Jupiter on the 9th, 5th or the Moon raise the
grade of a supporting window by one step.

## 5. A bad career period: the concerns that travel together

When a career window is a test, these concerns are linked through shared houses. The reader checks each one in the same
window and lists those that fire. It never lists those that do not, so as not to frighten.

| Concern | Shares with job loss | Read |
|---|---|---|
| Layoff, firing, resignation | the job-end gate | §6 |
| Gap and how long it lasts | the job-end gate without a start gate | the distance to the next start gate |
| Pay cut or delayed pay | the 2nd and 11th (the job's pay is the 2nd from the 10th) | sub-area 9 |
| Demotion, loss of standing | the Sun, the A10, the D10 10th | sub-area 13 tested, no end gate |
| Dispute with the employer, legal trouble | the 6th, 8th, D6, D30 | sub-area 10 |
| Forced move, loss of visa | the 4th and 12th; for those working abroad the 12th and 6th | sub-area 5 |
| Health-forced leave | the 6th, 8th and the lagna lord | health is facts only, no prediction of illness (doc 18) |
| Stress and low mood | Saturn on the Moon, the 4th and the Moon | doc 32's mood module; sensitive core of doc 33 §5 |
| Business loss (when self-employed) | the 7th and 11th tested | sub-area 8 |

The good-period cluster mirrors it: an offer, a promotion, a raise, recognition, a team and a posting abroad share the
start gate and Jupiter's triggers.

## 6. Layoff, firing and resignation: telling them apart

**The job-end gate** (needed for all three). In the same window:
- **Period:** a primary clock runs a lord that signifies the end houses from the 10th (the 9th, 12th from the 10th; the
  5th, 8th from the 10th), or the 10th lord or AmK placed in 6, 8 or 12 of D1 or D10, or Narayana enters the 9th, 12th or
  8th from the 10th sign.
- **Trigger:** Saturn, Rahu or Ketu on the 10th lord, the 10th sign, AmK, A10 or the Sun; or an eclipse on the 10th to
  4th axis or the 10th lord; or a slow station on one of those points.
- **Annual:** the year chart's 10th lord in 6, 8 or 12, or a Mudda period of a lord that signifies the end houses.

Two of the three make a **risk**; all three make a **high risk**. One is a **watch**.

| Event | Added signature (on top of the job-end gate) | What separates it |
|---|---|---|
| **Layoff** (the employer cuts, nothing personal) | The 12th and 8th from the 10th dominant; nodes or an eclipse as the trigger; Saturn on the 10th from the Moon; the 11th (the organisation) tested | No dispute signature and no own-will signature |
| **Firing** (personal, for cause or conflict) | The 6th and 8th: Mars or Saturn on the Sun (authority) or the 10th lord; a 6th-lord period with the 10th lord afflicted; the A10 hit by a malefic; D10 6th or 8th lord running; D30 malefic active; `sathru` saham in a dusthana of the year chart | The dispute signature is present |
| **Resignation** (the person leaves) | The lagna lord or the 3rd lord (own initiative) running or strong; Mars or the Sun in the person's favour; usually a start gate within six months (leaving towards something), or the 12th and Ketu (leaving to study, rest, go abroad) | The own-will signature is present |
| **Forced resignation** | The resignation and firing signatures together | Both present |
| **Transfer** (not an end) | The 4th, 3rd or 12th with the 10th, and no job-end gate | No end gate |

A **change of job** is an end gate and a start gate within six months. A **gap** is an end gate whose next start gate is
more than a month later; its length is the distance to that start gate.

## 7. Proving absence: what "no layoff in this period" can mean

**What the method can prove exactly.** The rules are code over stored rows, so for any period the module can show that
*no job-end gate fires*: no primary clock runs an end lord, no slow malefic touches a career point, no eclipse falls on
the career axis, and the year chart is not adverse. That statement is exact and auditable: the drawer lists every gate
that was checked and its source row.

**The clear grades.**

| Grade | Condition |
|---|---|
| **Clear and protected** | No end gate fires, and a protection is running: Jupiter aspects the 10th or its lord, or a 10th-lord or AmK period runs, or Narayana is on the 10th or the A10 |
| **Clear** | No end gate fires |
| **Watch** | One part of the end gate fires |
| **Risk** | Two parts fire |
| **High risk** | All three fire |

**What it cannot prove.** No astrological method can promise that a person will not be laid off: an employer's decision,
the economy and the person's own choices are outside the chart. The certainty is measured instead:
- **For the person:** with their marked past events (the ledger), the module scores the same rules over the past 18
  years, for example: "In your past, periods marked clear had no job end in 31 of 32 cases." (The numbers are
  illustrative; the real ones come from the ledger.)
- **Across users:** the share of clear periods that stayed clear in all marked events, by grade.
- **Birth time:** the D10, D60 and house cusps move with minutes of birth time. When the birth time is not recorded to the
  minute, the clear grade uses D1, the Moon and the clocks only, and says so.

**Words on screen.** "No sign of a job ending in this period" with "In your past, this held 31 times in 32". Never
"guaranteed", "certainly", "absolutely" or "no risk". A risk window is worded as a time to prepare (savings, network,
documents), never as a forecast of loss (doc 33 §5, doc 18).

## 8. Present weather: is the person in a storm or in fair weather now?

A person in a hard stretch and a person in a good stretch need different boards (doc 42 §B.7): one is an emergency
entrance, the other a welcome. So the reading first decides the **present weather** from the chart, before any horizon.

**The now window** is today minus 30 days to today plus 30 days. In it, the code counts clock families (one planet one
vote) on each side:

| Side | Signals that count |
|---|---|
| **Storm** (career tested now) | the job-end gate at risk or high risk (§6); a running main-clock sub-period whose lord signifies the end houses from the 10th or is a 6th, 8th or 12th lord; Saturn, Rahu or Ketu on the 10th lord, AmK, the Sun or the Moon (sade sati's middle phase counts here); an eclipse on the career axis within 15 days; the year chart's 10th lord in 6, 8 or 12 with a Mudda period of a signifier of those houses |
| **Fair** (career supported now) | an active support window of any sub-area; Jupiter on the 10th, its lord, AmK or the Moon; a 10th, 11th or AmK sub-period in a primary clock; the year chart's D10 10th with a benefic and its Mudda period of a career signifier |

**The five weather states** (internal names; the person never sees the word "storm"). The board design for each is
[doc 44](44-career-board-storm-and-fair.md).

| State | Entrance | Rule | Fields the code returns |
|---|---|---|---|
| **Storm** | ER | the security grade today is risk or high risk; or storm signals in two or more families with a major test window of three or more clocks active; or at least half of the next 30 days are hold days | `ease_date`: the first day the grade is back to clear and the major test has ended (null when it is not inside the built span); severity (two families, three, or high risk) |
| **Clearing** | ER, stepping down | a storm whose driving window ends within 30 days, with no major test in the 60 days after | `boundary_date` (the easing day); the first support window after it |
| **Calm** | Lobby | fewer than two families on either side | `next_window_start` and its sub-area |
| **Late summer** | Resort | a support window is active but closes within 30 days and a test follows | `window_end`; the act days left before it; the start of the slower stretch |
| **Fair** | Resort | fair signals in two or more families with a major support window of three or more clocks active, the grade clear or better, and no major test active | `window_end`; the window's peak; the next slower stretch |

**Tie-break, highest first:** Storm (by security grade) → Clearing → Storm (by test window or hold days) → Late summer →
Fair → Calm. When a storm and a support window overlap, the state is Storm and the support window is returned as the way
out, with its date. Severity changes how dense the storm board is, not which board appears.

**Steadiness.** The state changes only at a window boundary or after a new self-report, and holds for at least 7 days.
One exception: a worse security grade moves the board into Storm at once.

### 8.1 Validating the present state across dasha systems and divisional charts

Sachin's aim is that the present state is right every time. No chart method can promise 100 %: the chart describes
pressure and support, not the person's day. What the method can promise is that **it never states the present with
more confidence than its layers give it**: a state is shown as settled only when independent families agree and the
divisional charts confirm each vote; when they split, the board says so and asks the person. Each answer then measures
how often the method was right.

**Seven voting families for the now window** (each casts one vote: storm, fair or neutral):

| # | Family | Layers inside it | How the vote is cast |
|---|---|---|---|
| 1 | Main clock | Vimshottari MD, AD, PD (`dasha.vimsottari.l3`) | The AD and PD lords' career polarity (below); PD decides when AD and PD differ, because it is nearer to the day |
| 2 | Conditional clock | the dasha `dasha.applicable` says applies (for Sumit, Chathuraaseethi Sama) | Same as 1. No vote when none applies |
| 3 | Rasi clock | Narayana, with Chara and Sudasa as confirmers | The running sign's house from the 10th and from the A10: 10th, 11th, 1st, 5th, 9th give fair; 9th or 5th *from the 10th*, 8th, 12th give storm |
| 4 | Karaka clock | `dasha.karaka.l3` | AmK or the 10th lord running gives fair unless it is afflicted in D10 |
| 5 | Annual | Tithi Pravesha chart and its D10, its own dasha, Mudda, Patyayini, career sahams | The running Mudda or Patyayini lord's place in the year chart's D10; the `rajya` and `karma` sahams' houses |
| 6 | Slow transits | Jupiter, Saturn, Rahu, Ketu from the overlay; eclipses | The storm and fair transit signals of §8 |
| 7 | Short clocks | Yogini and Tithi Ashtottari (three levels), counted together | Confirmers: they vote only when they agree with each other |

One planet, one vote: if the same planet is the running lord in families 1, 2 and 4, it is counted in one of them only.

**How the divisional charts validate each dasha vote.** For the running lord of families 1, 2 and 4, the reader looks it
up in four charts:

| Chart | Fair vote | Storm vote |
|---|---|---|
| D1 | rules or sits in the 10th, 11th, 6th (service) or 1st, or is the AmK; in a kendra or trikona | rules the 8th or 12th, or the 9th or 5th counted as 12th and 8th from the 10th; in a dusthana |
| D10 | in the D10 1st, 10th, 11th, 5th or 9th; own, exalted or friendly sign | in the D10 6th, 8th or 12th; debilitated or with a malefic |
| D9 | own, exalted or friendly sign (the lord can deliver) | debilitated without cancellation (it cannot) |
| D60 | a benefic shashtyamsa | a malefic shashtyamsa (used only when the birth time is recorded to the minute) |

A dasha vote counts only when **D1 and D10 agree** on its side; D9 breaks a tie; D60 can confirm but never decide alone.
When D1 and D10 disagree, that family's vote is **split** and not counted. The drawer shows this table for the person's
running lords, so anyone can see why.

**Confidence of the present state:**

| Confidence | Rule | What the board does |
|---|---|---|
| **Confirmed** | 5 or more of the 7 families vote the same side (or 4 of 6 when no conditional clock applies), including the main clock and the transit family, with the main clock's vote validated by D1 and D10 | States the present plainly |
| **Likely** | 4 of 7 on one side, none of the confirmed conditions missing more than one | States it, with "Most of your chart points this way" and the split shown in the drawer |
| **Split** | anything else | Does not choose. Opens on the lobby with the question "How is work for you right now?" first; the answer picks the entrance |

**Back-testing, so the accuracy is a number and not a hope.** The same seven-family vote runs over every month of the
person's past that the ledger covers (doc 29 §5's blind cast). Each month where the person marked what happened scores a
hit or a miss for the state. Across users, the share of Confirmed states the person agreed with is the method's measured
accuracy, reported by confidence level. The thresholds above are pinned for the first build and tuned only against those
measurements, never by hand to make one chart look right.

**The person's own word.** The chart cannot see the person's day. The board asks once, with one optional tap, "How is
work for you right now?" (tough, okay, going well, skip). If the answer is tough, a second optional tap asks what is
hardest (no job yet, fear of losing it, boss or politics, pay, feeling stuck), and that picks the sub-area the board leads
with. The question is asked again after 30 days or when the chart's state changes. The answer chooses the entrance (tough
means the ER, whatever the chart says), and the chart fills the content. A grade is never hidden because of the answer.
A mismatch is stored with the ledger as a calibration point and never argued with on screen. The answer is sealed, can be
deleted, and is never shown back as a fact.

All of this is code over stored rows: `ease_date`, `boundary_date`, `window_end` and `next_window_start` have source rows
like every other date, and a null field means the board uses its dateless headline.

### 8.2 Not every storm is the ER: care levels for trouble at work

Most hard stretches at work are not about losing the job. A person can be fighting office politics, failing on a project
or at odds with the boss while the job itself is safe. Like medicine, the board triages by **care level**, and each level
has its own signature in the chart:

| Care level | What the person is living | Signature (in the now window, two families at least) | Board |
|---|---|---|---|
| **ER** | The job itself is at risk: layoff, firing, forced resignation | The job-end gate at risk or high risk (§6) | ER (doc 44) |
| **Urgent care** | A named problem that hurts now: politics and infighting, a bad relationship with the boss, credit taken, a demotion or pay cut | One of the trouble signatures below fires with a slow trigger, and the job-end gate does not | Urgent care: the problem named, when it ends, what to do, what not to do |
| **Doctor's visit** | A nagging problem: projects slipping, slow approvals, overwork | A trouble signature fires from periods only, or from fast transits only | Lobby with a "what's slowing you" card |
| **Check-up** | Nothing wrong; routine | No trouble signature | Lobby or resort |

**The trouble signatures** (each from engine rows; D1 and D10 must agree for a dasha vote, as in §8.1):

| Trouble | Houses and points | Period signal | Transit trigger | Annual and varga check |
|---|---|---|---|---|
| **Bad relationship with the boss** | the Sun (authority), the 10th lord, the 9th lord (the boss as guide) | a running lord placed 6th or 8th from the Sun or from the 10th lord; a Saturn or Rahu sub-period when either afflicts the Sun | Saturn, Mars or Rahu on the natal Sun or the 10th lord; the Sun transiting the 12th or 8th from the Moon (brief) | the year chart's Sun in 6, 8 or 12; D10 Sun in a dusthana |
| **Politics and infighting** | the 6th (open rivals), the 3rd (peers; 6th from the 10th), the 11th (colleagues and circles), the 12th (hidden opponents) | 6th, 3rd or 12th lord running; Mars or Rahu sub-periods | Mars on the 10th lord, the Sun or the 6th; Rahu over the 3rd, 6th or 11th | `sathru` saham in a kendra of the year chart; D6 and D30 malefic links |
| **Projects not delivering** | the 10th lord (the work), the 3rd (effort), the 11th (results), Mercury (plans, paperwork) | the 8th or 12th lord's sub-period under a 10th-related period; Saturn sub-periods (delay) | Saturn on the 10th lord or the 11th; Mercury retrograde over the 10th lord, the Sun or the 10th cusp sign | `karyasiddhi` saham in 6, 8 or 12; D10 10th lord weak |
| **Credit taken, reputation hit** | the A10 and AL, the Sun | Rahu or Ketu periods tied to the A10 | Rahu or Saturn on the A10 or AL; an eclipse on the A10 | `yasas` and `gaurava` sahams in dusthanas |
| **Demotion or pay cut** | the Sun and the 10th (standing); the 2nd and 11th (pay) | 10th lord in 6, 8 or 12 of D10 running; 2nd or 11th lord tested | Saturn on the 10th lord or the 11th; Rahu in the 2nd without Jupiter | the year chart's 10th lord or 11th lord in dusthana |
| **Overwork and burnout** | the 6th (load), the 8th, the Moon | 6th lord running with the Moon afflicted | Saturn on the Moon; Mars on the 6th | health is facts only (doc 18): name the load, never an illness |

**When it ends.** Each signature returns its `ease_date` the same way as a storm: the day its period ends or its trigger
leaves. Urgent care always names the problem in plain words ("Friction with your manager"), the date it eases, three
things that help and one thing not to do (for example, "do not resign in the middle of it").

**Several at once.** The board shows the highest care level first. Lower-level troubles that also fire are listed under
"Also in this stretch", never above it.

### 8.3 What level does the person work at?

The board reads very differently for an hourly worker, a manager, an executive, a solo owner and someone running several
businesses. "Promotion" for an owner means bigger clients or a second business; for an employee it means a title.

**What the chart can and cannot tell.** The chart shows the **ceiling** (how high the promise goes), the **style**
(service or own enterprise, alone or with people), and the **direction now** (rising, holding or falling). It cannot read
the present title with certainty: two people born in the same minute can be a chief executive and a clerk, because
family, education and choices sit outside the chart. So the level is **estimated from the chart, confirmed by the
person, and scored**.

**The estimate** (each from engine rows; the code returns the evidence for each line):

| Level | Chart pattern |
|---|---|
| **Executive, head of an organisation** | a Raja yoga involving the 10th, 9th or lagna lord, running or already run; the Sun and the 10th lord strong in D1 and D10; GL aspected or joined by the lagna lord or the 10th lord (power); A10 or AL in a kendra with benefics; a Pancha Mahapurusha yoga |
| **Manager of people** | a 10th–6th link (people under you) with the 10th stronger; Mars or the Sun in a kendra of D10; the D10 lagna lord strong; AmK in a kendra |
| **Professional or specialist** (accountant, engineer, doctor, lawyer) | Mercury, Jupiter or Saturn dominating the 10th or its lord with the 2nd, 5th or 6th; a strong D24; no Raja yoga linked to the 10th, or one not yet run |
| **Employee, individual contributor** | the 6th (service) stronger than the 7th (trade); the 10th lord linked to the 6th; no command signature |
| **Hourly or shift work** | the 6th dominant, the 10th weak (lord in 6, 8 or 12, low SAV), Saturn ruling or aspecting the 10th, no Raja yoga linked to the 10th |
| **Solo owner, freelancer** | the 7th stronger than the 6th; the 3rd strong (own effort); Mercury or Venus linked to the 7th and the 10th; no 6th link for staff |
| **Business owner with staff** | the solo-owner pattern plus a 7th–6th or 10th–6th link (people under you) and a strong 11th |
| **Several businesses** | the owner pattern plus planets in dual signs in the 7th, 10th or 11th, or several planets linked to the 11th; HL strong; Jupiter and Mercury linked |

The dasha decides *when* the ceiling is reached: a Raja yoga gives only in the periods of its planets. So the estimate has
two parts, the ceiling (natal) and the level reached so far (the periods already run that activated it).

**Confirm with the person.** The profile asks once: "What best describes your work now?" with *Hourly or shift work /
Employee / Specialist or professional / Manage people / Senior leader or executive / Own business on my own / Own
business with staff / Several businesses / Student or between jobs*. The classifier already reads the same background
from chat text (doc 15: employed, self-employed, between jobs). The person's answer always wins; the chart's estimate is
used only when they skip.

**What the level changes.** The sub-areas are re-labelled per level (for an owner: clients and contracts in place of
getting a job, a second business in place of promotion, partners and staff in place of the boss); the windows and dates
do not change. The chart-versus-person match is stored and scored like the present state, so the estimate's real accuracy
is a measured number, per level.

## 9. How the agents use this document

Each reader of doc 42 §B.6 receives, per sub-area in scope, its focus card (§4) as the task and returns, per sub-area:

```
subarea:   job_security
promise:   promised | blocked | denied        + the rows that say so
blockers:  [ planet, why, release date (from a stored row) ]
periods:   [ clock, period, lord, opens|tests, source key ]
triggers:  [ planet, point, dates, source ]
annual:    confirms | contradicts | silent    + the rows
related:   [ the cluster concerns of §5 that fire in the same window ]
```

The Oracle may not change a date or a grade. It words the verdicts and keeps "not promised" separate from "not now".

## 10. Open points for Sachin

1. Approve the ranking of §2 and the tiers (Tier 1 built first).
2. Approve the job-end gate and the three signatures of §6, or mark changes.
3. Approve the words of §7 for clear and risk periods, including that "guaranteed" is never shown.
