# Plan: the November Revision of the AdAstra AI Business Plan

14 November 2026 | For Sachin's approval | No part of the business plan is drafted until this plan is approved

This is the plan for producing the November revision. It follows "How a plan is written" in `AGENTS.md`, adapted from code to a document. Companion files: `june-plan-faults-register.md` (what went wrong in June), `june-plan-verbatim-extract.md` (the June plan's own best lines) and `plan-key-points-rd-edition.md` (the R&D basis).

## 9. One recommendation, first

**Approved by Sachin on 15 November 2026 ("go ahead and build / finish the business plan v2"), as an evidence-based and vision-led plan.** The vision leads each section's story; the evidence tags and the one-value-per-number rule below still hold.

**Write the November revision as an evidence-based, vision-led plan: a short document in which every claim is tagged Built, Measured, Planned or Vision, and every number has one value, a source and a date.** Keep the June plan's strongest lines verbatim where they still hold. Rebuild the numbers from the November notes already in this folder, and stress-test them against outside benchmarks before they are printed.

| Alternative | Verdict |
| --- | --- |
| Edit the June plan in place | No. It has faults in every section (see the faults register), and its structure invites the same over-promising. |
| A vision-led plan built on the big claims | No. With no users and no revenue, claims that cannot be checked are the fastest way to lose a diligent investor. |
| An evidence-first plan with the vision in its own clearly marked section | **Yes.** It is the only version that survives diligence, and the R&D depth is the real strength to show. |

## 1. Start: what was checked

**The June plan.** Read in full, all 36 pages. It has no sources, conflicting numbers and unvalidated accuracy claims. 74 faults are listed by section in `june-plan-faults-register.md`, with ten rules derived from them. Its roadmap ran June to November and none of its dates held.

**How development has actually been done** (git history of the four repositories, all branches, counted 14 November 2026):

| Repository | Commits | By month |
| --- | --- | --- |
| Server | 732 | Mar 31, Apr 4, May 3, Jun–Aug 0, Sep 26, Oct 186, Nov 482 |
| Web | 397 | Mar 32, May 7, Sep 2, Oct 59, Nov 297 |
| Calculation engine | 65 | Mar 6, Apr 2, Sep 2, Oct 33, Nov 22 |
| Admin application | 183 | all in November, from 4 November |

- **These four repositories show no commits in June, July or August.** Most of what exists in them was committed in October and November. Whether work continued elsewhere in those months, and what earlier prototypes existed, is for Sachin to confirm. One checkout was also wiped on 31 October with unpushed commits lost.
- **It was built by one founder directing AI coding agents.** 811 commit trailers name an AI model as co-author. That is a floor, because some agents leave no trailer.
- **It is documented as it is built.** There are 89 numbered design documents for the reading engine, 13 for the admin application and six volumes of technique illustrations, with 318 test files across server and web.

**What was read in `/docs`.** Read: `fundraising` in full, and parts of `admin`, `techniques`, `reading-engine`, `research`, `handoff` and `billing`. Not yet read: `product`, `assistant`, `roadmap`, `security`, `privacy`, `architecture`, `performance`, `auth`, `ops`, `demo` and `improvement-plan.md`. Step 2 below covers them, because the list of what remains to go live depends on them.

**The app today** (routes on the deployed staging branch, 14 November; the signed-in screens are not yet reviewed in a browser):

| Area | What exists |
| --- | --- |
| Public | Landing page, pricing page, terms, privacy and refund pages |
| Registration | Sign-in by emailed code, sign-up, then birth details in steps, then a welcome screen |
| Dashboards | You (Self), Love, Work, and Lucky times (daily Panchang timing) |
| Conversation | Chat, from a dashboard card or free-form |
| Profile | Plan and usage, locale, legal, and a Life timeline |
| Staff | A separate admin application with the techniques catalogue and a lab that runs one technique on one chart |
| In development | Life Reading, user-chosen card topics, card-aware follow-ups, response modes |
| Not built | Payment gateway, mobile apps, social matching, marketplace, partner API |

**The November notes already in `docs/fundraising`.** These hold the current pricing, go-to-market and revenue model and are the base for the revision, not something to rebuild:
- `marketing-and-revenue.md`: the catalog (Free; Plus $50 or ₹2,499; Unlimited $200 or ₹9,999), the US and India offer tests, seven $100K MRR scenarios, and the acquisition sequence.
- `financing-and-milestones.md`: $2.0M target, $1.5M minimum, an 18-month budget and milestones.
- `product-and-release.md`: six further dashboards, Life Projects, and a 24-week mobile path.
- `subscription-features-and-partner-pricing.md` and `professional-workspaces.md`: what earns a renewal, a partner price card, sponsorship rules, and a practitioner product.
- `executive-summary.md` (12 November) and two investor decks dated 12 November in the `VC` folder.

**Outside research gathered so far. This is preliminary.** The figures come from search results, and the source pages have not yet been opened and read. Step 4 does that. Each figure is graded: A is a primary survey or filing, B is press reporting of company results, C is a company's own claim.

| Finding | Grade | Source |
| --- | --- | --- |
| 27% of US adults believe in astrology. 28% consult astrology or a horoscope at least yearly. 20% of adults do these things "just for fun" and 10% because they find the insights meaningful. | A | [Pew Research, May 2025](https://www.pewresearch.org/religion/2025/05/21/3-in-10-americans-consult-astrology-tarot-cards-or-fortune-tellers/) |
| Astrotalk's total income was ₹1,214 crore in FY25, up 85%. Profit figures conflict between reports. | B | [Outlook Business](https://www.outlookbusiness.com/news/astrotalk-reports-85-revenue-growth-in-fy25-as-tier-i-cities-boost-platform-activity) |
| Astrotalk charges by the minute from a prepaid wallet, with the first chat free. A review site quotes rates from ₹10 to ₹250 a minute. | C | [Astrotalk on its free offer](https://astrotalk.com/astrology-blog/is-astrotalk-free-a-complete-guide/), [Techjockey review](https://techjockey.com/reviews/astrotalk1) |
| AstroSage claims 80 million downloads, 1.5 million daily users and 25 crore questions answered by its AI astrologers. | C | [Company release, February 2026](https://www.lokmattimes.com/business/astrosage-ai-ai-at-scale-80-million-downloads-90-percent-margins-growing-20-percent-monthly/amp) |
| InstaAstro reports ₹200 crore annualized revenue and raised a $12M Series A. | B | [Entrepreneur India](https://india.entrepreneur.com/business-news/instaastro-crosses-inr-200-crore-in-annualized-revenue-raises-usd-12-million-series-a) |
| Co-Star claimed more than 20 million downloads when it raised $15M in 2021. | B | [Axios](https://www.axios.com/2021/04/14/astrology-app-co-star-raises-15-million-funding) |
| Nebula was the top-grossing astrology app in the US in July 2024, with about $50M in annualized revenue reported for late 2023. | B, C | [Statista](https://statista.com/statistics/1451664/top-horoscope-apps-us-market-revenue), [Wikipedia](https://en.wikipedia.org/wiki/Nebula_(spiritual_guidance)) |
| AI apps convert trials better (8.5% against 5.6%) but keep fewer annual subscribers (21.1% against 30.7%). | B | [TechCrunch on RevenueCat 2026](https://techcrunch.com/2026/03/10/ai-powered-apps-struggle-with-long-term-retention-new-report-shows) |

**Still open, and not to be written as findings:** nothing usable came back on Jagannatha Hora's user base, on The Pattern or Sanctuary, or on Indian payment habits such as UPI Autopay. A reported sale of Co-Star rests on one weak source. Estimates of India's astrology app market range from $163M to over $2B, so no single figure should be quoted.

**Internal figures that disagree and must be settled before use:** the technique count is 52, 66 or 136 depending on the file and date. Records per chart is about 45,000 period rows (9 November note), while one answer was measured reading about 800 records (2 November), and the landing page says 9,500.

## 2. End goal

A November business plan that an investor can read in two ways: the executive summary alone in three minutes, or the whole document with every claim checkable.

- **It is realistic.** It says plainly that there are no outside users, no revenue, no outside funding and no hires, and that the product was built by one founder with AI agents.
- **It shows the real strength.** The app is AI-run end to end, with a research and verification effort behind every reading that the June plan only promised.
- **It makes the same mistake nowhere.** Each of the ten rules in the faults register is checked before release.
- **It carries a marketing plan that could actually be executed** on the stated budget, with US and India priced and marketed separately.

## 3. Deliverable

| File | What it is |
| --- | --- |
| `docs/fundraising/business-plan-nov-2026.md` and a Word copy | The revision, about 20 pages |
| `docs/fundraising/executive-summary.md` | Updated to match, two pages |
| `docs/fundraising/evidence-log.md` | Every number in the plan with its source, date and grade |
| `docs/fundraising/competitor-research.md` | Sourced profiles of the competitors |
| `docs/fundraising/app-walkthrough-nov-2026.md` | The signed-in review with screenshots |

A PDF needs a PDF library installed by a Haiku sub-agent, or export from Word. The two investor decks are updated only after the plan is approved.

## 4. How the revision reads when done

Sixteen sections. The fourth is new, at Sachin's request of 14 November.

| # | Section | What it says | Standard of proof |
| --- | --- | --- | --- |
| 1 | Executive summary | Need, product, what is built, what is not, business, ask | Only claims proven elsewhere in the plan |
| 2 | The need | People seek answers. Careful readings are scarce and uneven. | Pew for the US; company results for India |
| 3 | The thesis | Nobody learns assembly language to use a computer. AdAstra AI does the chart mechanics so people get the benefit. | Argument, marked as such |
| 4 | How the product works | Registration; a dashboard reading for each person (You, Love, Work); the Life Reading as the purpose reading, marked as in development; conversation with the AI from a dashboard card or free-form; daily timing | Walkthrough with screenshots |
| 5 | How a reading is produced | Birth details, calculation, about 45,000 records per chart, techniques, specialist agents, cross-check, writer, evidence audit | Measured figures with dates |
| 6 | The research and accuracy programme | Techniques as contracts, the admin lab, the benchmark, and milestone one defined | Internal results, stated as internal |
| 7 | Built, and what remains to go live | A dated truth table, then the buildout list | Code and the open-issues file |
| 8 | Market and competitors | AstroSage, Astrotalk, Co-Star, Nebula, InstaAstro, The Pattern, Jagannatha Hora | Graded sources |
| 9 | Pricing | The US and India priced separately, by how each buys | The November notes plus buying-habit research |
| 10 | Marketing and go-to-market | Questions, not users; invited cohorts; a capped test; scale in steps | Budget from the financing note |
| 11 | The path to $100K MRR | Scenarios, with stress tests | Arithmetic shown |
| 12 | Where this goes | Lifestyle planning, compatibility and a social platform | Marked Vision. Not in the base case. |
| 13 | Team, and how it was built | One founder, AI agents, the commit record | Git history |
| 14 | Financing and use of funds | $2.0M target, 18 months | The financing note |
| 15 | Risks and standards | The real risks, and the rules the company holds itself to | The faults register |
| 16 | Appendix | Evidence log, glossary, sources | |

**The hard-hitting lines to carry from June**, quoted exactly from `june-plan-verbatim-extract.md` (section, row, page):
- "People are not looking for horoscopes. They are looking for answers." (1.1, p. 7)
- "The world's best astrologers are scarce. AI makes their level of preparation, research, and analytical rigor infinitely scalable." (1.2, p. 2)
- "applying the same diligence, preparation, and analytical rigor to every user regardless of income or location" (1.4, p. 7)
- The TurboTax line (1.5, p. 7), the fragmented-market paragraph (1.8, p. 6) and the "thousands of interconnected rules" paragraph (1.11, p. 6)
- "People do not purchase astrology for entertainment alone." (1.12, p. 4) and "Technology changes. Human behavior does not." (1.14, p. 5)
- "Most AI products begin with a blank conversation. AdAstra begins with a structured model of a person's life." (2.1, p. 8)
- "Before every answer, AdAstra performs structured chart research similar to the preparation process of an experienced astrologer." (3.2, p. 7)
- "Investors should treat accuracy engineering as co-equal with GTM" (3.4, p. 21)
- "Most astrology companies market astrology. AdAstra markets answers." (6.1, p. 17)
- "Rather than replacing astrologers, AdAstra enhances them." (5.9, p. 27)
- "No accuracy claims in marketing until benchmark is advisor-validated" (10.1, p. 33)

Rows marked Claim in the extract are reused only if evidence is found for them or they are reworded.

## 5. How the document is assembled

One direction only: evidence log first, then sections, then the executive summary, then the decks. Nothing is written into a later stage that is not in an earlier one. That is what stops the June problem of one quantity carrying two values.

## 6. Ingredients

| Ingredient | Owner |
| --- | --- |
| A signed-in session of the app in the built-in browser or in Chrome | Sachin |
| Read-only database counts for records per chart and per answer | Agent, with Sachin's yes |
| Web research on competitors and buying habits | Agent |
| Founder facts: legal entity, founder bio, time commitment, advisor, cap table, opening cash, and what was built before March and between June and August | Sachin |
| The eight decisions in the last section | Sachin |

No paid model calls are needed for the plan itself. Any that become useful are quoted first with key, count and cost.

## 7. Action steps, in sequence

| # | Step | Owner | Done when |
| --- | --- | --- | --- |
| 1 | Walk through the signed-in app: registration, each dashboard, Life Reading, chat from a card, free-form chat, profile and plan. Capture screenshots. | Agent, after Sachin logs in | The walkthrough file lists each screen with its state and any defect |
| 2 | Read the rest of `/docs`: `product`, `assistant`, `roadmap`, `security`, `privacy`, `architecture`, `performance`, `auth`, `ops`, `demo` and `improvement-plan.md`. Can run alongside step 1. | Agent | A one-page note per folder on what it says is built, planned or broken |
| 3 | Settle the internal figures: technique count, records per chart, records per answer, cost per reading. | Agent | Each has one value, a date and a query or command in the evidence log |
| 4 | Finish competitor research by opening and reading each source, including Jagannatha Hora, The Pattern, Sanctuary and the current prices of each. Can run alongside steps 1 to 3. | Agent | Each profile has users, revenue, price and model, with graded sources |
| 5 | Research how US and Indian customers buy, and set the two price ladders. Can run alongside step 4. | Agent | A US ladder and an India ladder, each with its reasoning and source |
| 6 | Stress-test the $100K MRR model against the retention and conversion benchmarks. | Agent | Base, cautious and severe cases, with the arithmetic shown |
| 7 | List what remains to go live, from the open-issues file, the code and step 2, with the order and what each depends on. | Agent | A buildout table with owner and dependency per item |
| 8 | Sachin answers the eight decisions and supplies the founder facts. | Sachin | Recorded in the evidence log |
| 9 | Draft sections 2 to 16 from the evidence log. | Agent | Every claim tagged; every number traceable |
| 10 | Check the draft against the ten rules, one by one. | Agent | A pass or a fix recorded for each rule |
| 11 | Write the executive summary last. | Agent | It contains nothing that is not in the body |
| 12 | Sachin reviews. Then the decks are updated. | Sachin, then agent | Approval recorded |

## 8. Phases

| Phase | Contains | Closes with |
| --- | --- | --- |
| A. Evidence | Steps 1 to 7 | The evidence log and the walkthrough, reviewed by Sachin |
| B. Decisions | Step 8 | Eight answers on record |
| C. Draft | Steps 9 to 11 | A full draft that passes the ten rules |
| D. Release | Step 12 | Approved plan, summary and decks |

Deferred: the PDF, the practitioner review itself, and the head-to-head model test that is already tabled.

## What the research already says about the plan's weak points

- **Retention.** The November model assumes 8% monthly churn. AI apps keep only about a fifth of annual subscribers. The model needs a case at 12% to 15% monthly churn.
- **India price.** Plus at ₹2,499 a month looks far above what the Indian market pays per session today. That comparison rests on an unverified figure of about ₹350 a session, so step 5 has to confirm it. India should lead with question packs and a low entry price, as the November notes already suggest, and be modelled separately from the US.
- **Paying share.** 5% of active users paying is an assumption. India is likely to convert well below the US.
- **The incumbents are large and already use AI.** The plan must say why a person would choose AdAstra AI over AstroSage's AI chat or an Astrotalk session, in terms of what the product does today.

## Eight decisions for Sachin, each with a recommendation

| # | Your brief says | The difficulty | Recommended wording |
| --- | --- | --- | --- |
| 1 | "completely accurate readings" | No practitioner has reviewed a reading. The June plan's own rule forbids the claim. | "Our first milestone is readings that follow the classical rules of Vedic astrology completely and without abridgement, confirmed by blind practitioner review." |
| 2 | "reading about 45k records of data per question" | 45,000 is what is computed per chart. One answer was measured reading about 800. | "Each chart yields about 45,000 records. Every answer draws on the ones that bear on the question." |
| 3 | "the app is fully AI" | True of interpretation. The chart mathematics is ordinary software, and no model has been specially trained. | "No human astrologer is in the loop. Software computes the chart, and AI agents produce every reading. The product itself was built by one founder directing AI agents." |
| 4 | Vedic rules "as mastered already by the AI/LLM" | Untested. The head-to-head test is tabled. | "The models know the classical texts. Our work is making them apply those rules to exactly computed charts, one technique at a time." |
| 5 | Fold this into "everyday decision making" | The published terms say not to rely on the service for any decision. | "to inform everyday reflection and planning" |
| 6 | A "lifestyle planning and social platform" | The November notes keep matching out of the base case. | Keep it as section 12, marked Vision, with no revenue attached. |
| 7 | Not raised: sponsored placements | The November notes propose them. The published privacy page says the service shows no advertising. | Leave sponsorship out of the revision until the policy and the plan agree. |
| 8 | Not raised: professional workspaces | The November notes model them as a second path to $100K MRR. Nothing is built or tested. | Mention them in section 12 as a later option, and keep the financial case consumer-first. |

**The Musk line.** His words are quoted exactly and briefly, with the source: "a spacefaring civilization, a multi-planet species". The extension is stated as AdAstra AI's own view: a civilization reaching for other planets should also carry the best of its Eastern knowledge traditions into everyday life, and a careful reading of the sky should not be the life's work of a few astrologers serving the very rich. It should be available to everyone.
