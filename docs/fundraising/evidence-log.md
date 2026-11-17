# Evidence Log: AdAstra AI Business Plan, November 2026

15 November 2026 | Companion to `business-plan-nov-2026.md` | Internal

Every number and status in the business plan appears here once, with one value, a source and a date. If a figure is not in this log, it should not be in the plan. Grades for outside facts: A is a primary survey or filing, B is press reporting of company results, C is a company's own claim. Internal figures are graded I (measured) or E (estimate).

## 1. Company facts

| Item | Value | Source | Date |
| --- | --- | --- | --- |
| Customers | None. Every account is a test account. | Founder | 14 Nov 2026 |
| Revenue | None | Founder | 14 Nov 2026 |
| Outside funding | None | Founder | 14 Nov 2026 |
| Hires | None. One founder. | Founder | 14 Nov 2026 |
| Practitioner review of readings | Not yet done | Founder | 14 Nov 2026 |
| Legal entity, cap table, opening cash, founder biography, advisor | To be supplied by the founder | Open | |

## 2. Product figures

| Item | Value | Grade | Source | Date |
| --- | --- | --- | --- | --- |
| Records computed per chart | About 45,000 period rows at three levels, over 33 test charts and 47 period systems. Provisional: one internal note, needs a fresh count. | I | Backfill note | 9 Nov 2026 |
| Records read for one answer | About 800 on one test chart | I | Measurement | 2 Nov 2026 |
| Technique entries in the catalogue | 142, all flagged built: You 55, Love 25, Work 23, timing 17, chat 18, timeline 4 | I | Count of the catalogue in the working copy | 15 Nov 2026 |
| Techniques exercised in the benchmark | 25, across You, Love and Work | I | Benchmark run | 8 Nov 2026 |
| Benchmark | 30 dashboard readings on 10 test charts; evidence audit passed 30 of 30; total model cost $0.35 | I | Benchmark run | 8 Nov 2026 |
| Model cost of a freshly built dashboard | About 3 to 9 cents | I | Benchmark run | 8 Nov 2026 |
| Model cost of one person, every one of 21 cards written by AI | $0.704 for 50 model calls. This fuller design is switched off. | I | Replay note | 10 Nov 2026 |
| Model cost of one question, earlier estimate | $0.02 to $0.03 (billing note, 1 Nov). Superseded by the row below. | E | Billing note | 1 Nov 2026 |
| Model cost of one chat answer | About 6 cents in October; about 12 cents after a model price change due 1 December | E | Cost estimate | Oct 2026 |
| Commits | 1,377 across four codebases: server 732, web 397, calculation engine 65, admin 183 | I | Git history, all branches | 14 Nov 2026 |
| Commits naming an AI model as co-author | 811, a floor | I | Git history | 14 Nov 2026 |
| Months with no commits | June, July and August 2026 | I | Git history | 14 Nov 2026 |
| Design documents and tests | 89 reading-engine documents, 13 admin documents, 318 test files across server and web | I | File count | 14 Nov 2026 |

| Speed of a full You reading | 35.3 seconds when it worked; two failed runs at 164 and 300 seconds | I | Reading-engine note | 8 Nov 2026 |
| Speed of card-by-card build | 275 seconds in total, first card 106 seconds; target 15 seconds | I | Reading-engine note | 10 Nov 2026 |
| Security review | 12 findings: 4 high, 7 medium, 1 low | I | Internal assessment | Nov 2026 |
| Tests passing | Server 2,585 of 2,586 | I | Open-issues file | 10 Nov 2026 |
| Hosting limits | 10 concurrent requests; database holds about 150 to 200 charts | I | Open-issues file | Nov 2026 |
| Model account | Out of credit; live readings fail until topped up | I | Open-issues file | 13 Nov 2026 |

The speed, security, capacity and status rows come from a read of the project documents by a research agent on 15 November. They were not re-measured.

Earlier counts of techniques (52, 66 and 136) came from older files. The plan uses 142 for the catalogue and 25 for what the benchmark exercised, and says which is which.

## 3. Prices and the revenue model

All from `marketing-and-revenue.md` and `financing-and-milestones.md` (November 2026), recomputed on 15 November. None of these prices has been tested with a paying customer.

| Item | Value |
| --- | --- |
| Catalogue | Free; Plus $50 or ₹2,499 a month ($500 or ₹24,999 a year); Unlimited $200 or ₹9,999 a month |
| Allowances in the billing design | 20 free questions and 100 Plus questions a month |
| India packs to test | ₹99 for one question, ₹299 for five, ₹499 for ten, no auto-renewal |
| US tests | $24.99 with 25 questions; 5 questions for $9.99; $5.99 a month per extra dashboard |
| India tests | ₹799 monthly bundle; ₹199 for a 30-day dashboard pass |
| Exchange rate used | ₹94 to the dollar, a planning assumption |
| $100K MRR base case | 1,800 US Plus + 400 India Plus = $100,634 |
| Lower-price case | 3,500 US at $24.99 + 1,500 India at ₹799 = $100,215 |
| Active users needed for 2,200 subscribers | 44,000 at 5% paying; 73,300 at 3%; 110,000 at 2%; 27,500 at 8% |

Stress test of the base case, level monthly additions over 18 months of selling:

| Monthly churn | New subscribers a month | Total added | Cost at $50 each | Cost at $100 each |
| --- | --- | --- | --- | --- |
| 8% (November assumption) | 226 | 4,077 | $204,000 | $408,000 |
| 12% | 293 | 5,281 | $264,000 | $528,000 |
| 15% | 349 | 6,277 | $314,000 | $628,000 |

The launch-test budget is $230,000. At $100 a subscriber it buys 2,300 subscribers, which is less than any row above needs. The cost per subscriber is an assumption with no data behind it.

## 4. Financing

| Item | Value |
| --- | --- |
| Target | $2.0M preferred equity; $1.5M minimum; $2.5M stretch |
| Budget | 18 months; $1.75M operating, about $97,000 a month; $250,000 reserve |
| Uses | $960K founder and engineering; $270K design, quality, localization and practitioner review; $180K cloud and inference; $230K launch tests; $110K legal and operations; $250K reserve |
| Milestones | 0–3 months baseline and scope; 3–6 private mobile beta; 6–9 two-country release; 9–12 repeat use and economics; 12–18 scale proven channels |
| $100K MRR horizon | 24 to 30 months from close |
| Dilution, illustrative | 16.7% at $10M pre-money; 20.0% at $8M; 14.3% at $12M |

## 5. Outside facts

See `competitor-research.md` for the full table with links. The plan uses only rows marked confirmed there.

## 6. Wordings assumed for the eight open decisions

The founder has not yet answered the eight decisions in `nov-revision-plan.md`. The plan uses the recommended wording for each.

| # | Subject | Wording used |
| --- | --- | --- |
| 1 | Accuracy | "readings that follow the classical rules of Vedic astrology completely and without abridgement, confirmed by blind practitioner review" |
| 2 | Records | "Each chart yields about 45,000 records. Every answer draws on the ones that bear on the question." |
| 3 | Fully AI | "No human astrologer is in the loop. Software computes the chart, and AI agents produce every reading." |
| 4 | What the models know | The models know the texts; the work is making them apply the rules to computed charts, one technique at a time |
| 5 | Decisions | "for reflection and planning", checked alongside a person's own judgement |
| 6 | Social platform | In the vision section, with no revenue attached |
| 7 | Sponsorship | Left out |
| 8 | Professional workspaces | Named as a later option only |

## 7. Check against the ten rules (15 November 2026)

| # | Rule | Result |
| --- | --- | --- |
| 1 | No accuracy claim before practitioner validation | Pass. The plan says "we make no claim of accuracy" and sets review as milestone one. |
| 2 | One number per quantity | Pass, with two notes. Cost is given for two designs and says which is which. The a16z application still says 460+ commits against 1,377 here; filed as an open issue. |
| 3 | Every status carries a date | Pass. Section 8 is dated 15 November. |
| 4 | Promise only what the team and money can deliver | Pass, with a warning. The stress test shows the launch budget covers the $100K milestone in one case only, and the plan says so. |
| 5 | Every outside fact has a source | Pass. Listed in the appendix. Two are the founder's own observation and are marked "in our experience". |
| 6 | Never sell or infer sensitive signals | Pass. Sponsorship is left out. |
| 7 | Arithmetic checked | Pass. Scenarios and the stress test were recomputed by script. |
| 8 | One name, one tagline, one category | Pass, with one note. The timing board is called Happy Hour(s) in the app and "the timing board" in the plan. |
| 9 | No file names, code names, placeholders or third-party names | Fail until screenshots are in: seven "[Screenshot to add]" lines remain. No file names, code names or personal names of astrologers. |
| 10 | Risks name the real ones | Pass. Calculation defects, model error, one person, retention, store review, speed and security are listed. |

Not yet done from the approved plan: the signed-in walkthrough and screenshots (step 1), read-only database counts (step 3), the founder's answers to the eight decisions and the founder facts for the Team section (step 8).
