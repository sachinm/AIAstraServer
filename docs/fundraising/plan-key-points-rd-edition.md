# AdAstra AI Plan Key Points, R&D Edition

November 2026 | Source notes for investor materials | Supersedes the wording of `original-plan-key-points.md`, which stays as the page-reference record

Each point has three parts: the investor point, the November framing, and the R&D basis. Every R&D line carries a status: **Built**, **Measured** (with date), **In development**, or **Untested**. A point with no Built or Measured line is a hypothesis and should be presented as one.

## The thesis in one paragraph

People use computers for work and everyday life without knowing how assembly language works. AdAstra AI applies the same idea to Vedic astrology. The mechanics and geometry of reading the sky (chart calculation, divisional charts, planetary periods, transits) are handled by a calculation engine and a multi-agent reading pipeline. The person never has to learn them. What they receive is a practical, everyday benefit in plain language, in place of an occasional consultation.

## Why this needs to be built

### A. The need for answers is age-old. Access is the constraint.

**Investor point.** People have always looked to the sky for answers about their lives. What limits demand is not curiosity. It is the supply of readings a person can trust. Astrological curiosity can only grow as far as the means of a careful reading allow. A practitioner who can hold a whole chart in mind spends a lifetime learning to do it, and the best are booked or overbooked. Historically that level of counsel sat with courts, rulers and those who could retain a top practitioner. Everyone else guesses from intuition and from nature.

**R&D basis.**
- **Position, not a measurement.** This is AdAstra AI's reading of the market. The plan's market sizing is still to be rebuilt from the bottom up.
- **Untested.** That better supply creates more demand. It is the central hypothesis the launch tests.

### B. One birth moment produces tens of thousands of rows to analyse.

**Investor point.** A person's birth date, time and place unfold into roughly 10,000 to 100,000 or more rows of chart data: divisional charts, strengths, and many period systems, each nested several levels deep and running across a lifetime. A life reading, and a check against past events, means working through that table. Only a small number of people can do it by hand, and none can do it for every person and every question.

**R&D basis.**
- **Measured, 9 November 2026, 33 test charts.** Storing every period system to three levels, from birth to 30 years ahead, produced about 45,000 period rows per chart across 47 period-system types. This is periods alone, before divisional charts, strengths and transits.
- **Built.** Levels 4 to 6 are computed on demand for the charts in focus, and each level multiplies the count. The upper end of the range comes from these deeper levels.
- **Measured, 2 November 2026.** One answer reads about 800 records chosen from that table. The table is what is available; no single answer reads all of it.

### C. General AI cannot read the sky from a prompt. It has to be built and trained for it.

**Investor point.** Frontier language models know the vocabulary of Vedic astrology, but they are not ready to produce a reading from a prompt alone. The reading rests on celestial geometry that must be computed exactly, and a model asked to infer it will state placements that sound right and are wrong. Accurate reading needs AI that is purpose-built for this: calculated inputs, defined techniques, an audit of every claim, and in time a model trained specifically on verified readings.

**R&D basis.**
- **Built.** The first three layers exist: a calculation engine, reading techniques stored as explicit contracts (25 exercised in the 8 November benchmark), and an automated audit that ties each claim to a chart fact.
- **Not measured.** No head-to-head test is on record comparing a frontier model prompted alone with the pipeline on the same charts. Run it before presenting "frontier models are not ready" as a result. Until then it is a design premise from development experience.
- **Not started.** Fine-tuning or training a model on astrological reading. Today the system uses general models inside the pipeline. Training needs a set of practitioner-reviewed readings to learn from, which the seed round would fund.

### D. A spacefaring civilization should also understand the sky it lives under.

**Investor point.** Elon Musk has described the goal as humanity becoming "a spacefaring civilization, a multi-planet species" (April 2021, as reported by CNBC). AdAstra AI's own view, which is not Musk's, is the other half of that thought. People have mastered the physical elements and are now reaching for the Moon and beyond. The knowledge of planets, nakshatras and rasi, their positions and how they combine, should be folded into everyday life in the same way, so that people can plan and build with it. As AI grows more capable, the wish to understand one's own place in that sky will grow with it.

**R&D basis.**
- **Vision, not a measurement.** Use it as framing for the mission. Do not present it as evidence, and do not imply that Musk has said anything about astrology.

## The points to carry forward

### 1. The person brings a question. The machine does the chart reading.

**Investor point.** People seek guidance around specific life events and decisions. Human consultations are episodic: a booked session, a handful of questions, then nothing until the next one. AdAstra AI does not sell a "detailed chart reading". Producing that reading is the AI's job, done in the background for every question. The product is the everyday benefit that comes out of it.

**November framing.** Lead with a question a user already has, such as how to plan a career move or what to consider before taking a relationship forward. Never lead with chart terminology.

**R&D basis.**
- **Built.** The calculation engine computes the chart from birth date, time and place before any language model is involved. Its catalog defined 166 chart data types when counted on 2 November 2026, including 23 divisional charts and more than 40 dasha (planetary period) systems.
- **Measured, 2 November 2026, one test chart.** With the full chart base included, a single reading placed about 800 chart records (roughly 14,000 tokens) in front of the model. A person cannot assemble that for every question; the pipeline does it each time.
- **Untested.** That everyday use replaces episodic use. There are no outside users yet, so nothing has been measured.

June plan pp. 5–8

### 2. Calculate first, interpret second, and show the evidence.

**Investor point.** A calculated birth chart, divisional charts, planetary periods and transits give each answer a specific basis. Language models can state plausible but wrong placements when asked to infer celestial geometry from text. AdAstra AI gives the model calculated facts and asks it to interpret, not to compute.

**November framing.** Calculate the chart before AI interpretation. Show the relevant evidence behind an answer. Use reference-chart checks and practitioner review to test the result.

**R&D basis.**
- **Built.** Specialist agents read separate layers (natal promise, periods, transits, nakshatras), a cross-check step reconciles them, and a writer produces the answer. Each claim carries a key back to the chart fact it rests on.
- **Measured, 25 October 2026, earlier configuration.** A subject-only evidence pack was about 4,100 tokens, against 16,100 for the whole chart file and 19,200 for the earlier full prompt. The pipeline has since added a full chart base that is cached across a person's questions, which is the larger 2 November figure in point 1. Quote one configuration at a time.
- **Measured, 8 November 2026, 10 test charts.** 30 whole-board runs across Self, Love and Work, covering 25 techniques. An automated audit passed all 30 runs with no unresolved evidence keys, meaning every claim shown pointed at a chart fact. Some panels were withheld or returned partial where the data did not support them. Total model spend was $0.35, with many runs served from cache; the two fresh sets sampled cost about $0.09 for Self, $0.05 to $0.06 for Love and $0.03 to $0.04 for Work. A 12-chart extension across more age groups is still open.
- **Not yet shown.** Traceability is not accuracy. The audit proves each claim points at a real chart fact. It does not prove the interpretation is right. Known calculation defects are tracked and open. Practitioner review is a future milestone.

June plan pp. 7–8, 21–23

### 3. Context makes follow-ups better. Dashboards give a starting point.

**Investor point.** User goals and earlier conversations can make follow-ups more relevant over time. Topic dashboards give users somewhere to start when they do not yet have a question.

**November framing.** The signed-in app has Self, Love and Work. Lead with Self's newer design, with Love and Work next. User-selected card topics, card-aware follow-ups and response modes are in development.

**R&D basis.**
- **Built.** Self, Love and Work dashboards, a Work question composer, a birth-chart sidebar and a Life timeline in the signed-in web app.
- **In development.** A per-person memory of confirmed facts, user-chosen card topics, and the newer design for Love and Work.
- **Untested.** That remembered context improves answers enough for users to notice.

June plan pp. 8, 22–23

### 4. Timing gives a daily reason to return.

**Investor point.** Distribution can start with high-intent questions, educators and diaspora communities. Daily timing gives people a recurring reason to use the product between bigger decisions. This is where "everyday benefit" is tested first.

**November framing.** Free Panchang timing is the entry point. Test whether a timing visit leads to a second visit and then to a focused chat.

**R&D basis.**
- **Built.** Free Panchang timing in the signed-in app. The transit sky is stored once and shared by every user; only the overlay on a person's own chart is individual. Inference, not yet measured: daily use should add little computing cost per person.
- **Untested.** The return loop itself (timing visit, second visit, focused chat). The channels are also untested.

June plan pp. 17–19, 22–23

### 5. Long-horizon planning keeps the product useful beyond a session.

**Investor point.** A plan that unfolds over months gives the product a role between questions.

**November framing.** Life Reading is in development. Expand into private Life Projects for a trip, promotion, business launch, engagement or wedding, with boards, milestones, timing windows and follow-ups.

**R&D basis.**
- **Built.** A Life timeline in the signed-in app.
- **In development.** Life Reading.
- **Not started.** Life Projects. Pilot with trip planning and engagement or wedding planning.

June plan pp. 18, 22–23, 28–29

### 6. Consumer revenue first. Other lines follow evidence.

**Investor point.** Consumer revenue comes first. Compatibility, practitioners and embedded distribution can expand the business later.

**November framing.** Test US subscriptions, and India question purchases and dashboard unlocks. Measure recurring revenue separately from one-time purchases. Partner APIs follow consumer evidence and partner demand.

**R&D basis.**
- **Built.** Plans and question limits in code. The configured Plus price is $50 or INR 2,499 a month.
- **Not built.** A payment gateway and the mobile apps.
- **Untested.** Every price point. No receipt, renewal or repurchase has been observed.

June plan pp. 25–30

## What the R&D has and has not established

| Question | Status | Evidence |
| --- | --- | --- |
| Can the mechanics be hidden from the user? | Built | The user supplies birth details and a question. The engine and agents do the rest. |
| Does every claim rest on a calculated fact? | Measured | 30 of 30 benchmark runs passed the evidence audit, 8 November 2026, 10 test charts. Some panels withheld or partial. |
| Is the cost per reading workable? | Measured, small sample | About $0.03 to $0.09 of model spend per freshly built board in the samples; $0.35 for the whole benchmark with caching. Not measured at production volume. |
| How much data does one birth moment produce? | Measured | About 45,000 period rows per chart at three levels, 9 November 2026, 33 test charts. Deeper levels add more. |
| Can a general model read the sky from a prompt alone? | Not measured | Design premise. No head-to-head test on record. |
| Is a model trained for astrological reading? | Not started | General models run inside the pipeline today. |
| Are the calculations correct? | Not established | No independent reference comparison is recorded. On one chart, stored facts were compared with the engine's own output on 31 October 2026: signs, houses, nakshatras and period dates agreed, and some derived tables had defects that are tracked. |
| Are the interpretations right? | Not established | Needs blind practitioner review. |
| Do people come back daily? | Not established | No outside users yet. Every account in the database is test data (confirmed 14 November 2026). |
| Will people pay? | Not established | No payment gateway yet. |

## Figures and claims to reconcile

- The original financing proposal was $1M–$1.5M in preferred equity (pp. 3, 30–31). The recommended seed target is now $2M. The original six-month targets were 750 payers and about $12K MRR (pp. 19–20). Treat these as historical assumptions. The revised commercial milestone is $100K MRR, or $1.2M annualized recurring revenue.
- The original uses competing market counts (cover, pp. 2 and 13), question allowances and prices (pp. 2 and 16), and Year 3 subscriber counts (pp. 14 and 26). Its 750 payers and 10,000 registrations imply 7.5%, while its assumption says 5% (pp. 19–20, 25).
- The original modeled $290 LTV and $20 blended diaspora CAC (pp. 3, 17). Neither has been observed. Build a new model from regional pricing, cohort retention, discounts, platform fees and service costs.
- The original calls the calculations a moat and describes accuracy "no competitor has cleared" (pp. 10–12). Do not repeat this. State what is built and measured, and name practitioner validation as a milestone (pp. 21–23).
- Record counts need care. Three figures exist. About 800 records per answer is measured (2 November). About 45,000 period rows per chart at three levels is measured (9 November). The earlier figure of about 9,500 was an estimate made at two levels and is superseded. "10,000 to 100,000 or more rows per person" describes what a birth moment produces. Do not present it as the amount read per answer.
- Treat dated competitor valuations, acquisition scenarios and inferred life-event advertising (pp. 14, 21, 31–33) as historical proposals outside the base case.

Sources: *AdAstra Seed Business Plan*, June 2026, 36-page PDF (page numbers refer to it). Internal performance notes for the 25 October token measurements. The 10-person Self, Love and Work benchmark report for 8 November. A record count on one test chart on 2 November 2026. An internal note on the 9 November period backfill for the 45,000-row figure. CNBC, 23 April 2021, for the Musk wording. The November executive summary for current product state, prices and the seed target.
