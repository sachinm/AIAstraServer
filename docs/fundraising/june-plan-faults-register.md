# June Business Plan: Faults Register

14 November 2026 | Companion to `nov-revision-plan.md` | Source: AdAstra Seed Business Plan, version 1.0, June 2026, 36 pages

Every fault below was found by reading the text of the June plan section by section, with page numbers. Images and diagrams in the PDF could not be read. Each one ends in a rule for the November revision, so the same mistake is not made twice. Faults that are only an artefact of reading a PDF as text (scrambled table cells) are left out. Items marked "check" are my reading and need Sachin's confirmation.

## The ten rules, in order of how much damage the fault does

| # | Rule for the November revision | The June fault it comes from |
| --- | --- | --- |
| 1 | No accuracy claim before a practitioner has validated it. State accuracy as a milestone with a test. | The plan sets this rule itself (p. 33) and breaks it on pp. 2, 7, 10, 11, 12, 14, 15 and 32. |
| 2 | One number per quantity, with a source and a date. | Market size, tier limits, India prices, CAC, subscriber counts and runway each appear with two values. |
| 3 | Every status line carries a date and names its evidence. | "Built", "chat strong" and "Shipped" sit beside "fake embeddings" and "not built". |
| 4 | Promise only what the stated team and money can deliver. | Twelve dashboards, a social network, a marketplace, a benchmark and 750 payers, all in six months, with six people not yet hired. |
| 5 | Every outside fact has a source the reader can open. | The plan has no sources at all. |
| 6 | Never sell or infer sensitive personal signals. | Section 8.3 and the exit story sell divorce, fertility, health and legal signals to advertisers. |
| 7 | Arithmetic is checked before it is printed. | The market table, the LTV ratio, the Year 3 ARR and the revenue mix do not add up. |
| 8 | One product name, one tagline, one category. | Five names for the product and three for the category. |
| 9 | Investor text contains no file names, internal code names, placeholders or personal names of third parties. | File paths, the engine's internal name, a named astrologer's initials, and "[Placeholder]" all appear. |
| 10 | Risks name the real ones. | The risk table omits calculation defects, model error, key-person risk, retention and store review. |

## Section by section

### Cover (p. 1)

| Fault | Where | Rule |
| --- | --- | --- |
| The document calls itself a "Pre-Seed Go-to-Market Business Plan" and a "Seed Business Plan", and asks for a seed round. | p. 1, page headers | 8 |
| "~600M Payment-Capable Adults" on the cover, against "approximately 300 million" on the next page. | pp. 1, 2 | 2 |
| The logo is a placeholder. | p. 1 | 9 |

### 1. Executive summary (pp. 2–4)

| Fault | Where | Rule |
| --- | --- | --- |
| "No incumbent product combines all three" is asserted with no comparison shown. AstroSage already sells AI Vedic chat. | p. 2 | 1, 5 |
| "institutional-grade", "calculation moat" and "defensible stack" are claimed before any validation. | p. 2 | 1 |
| The "three structural reasons" sentence runs on, has grammar errors, and says a "3-8degrees" error "can produce the wrong astrological charts" with no source. | p. 2 | 5 |
| Pro is 50 questions a month here and 30 on p. 16. | pp. 2, 16 | 2 |
| India prices are ₹999, ₹2999 and ₹8,999 here, and ₹499, ₹999 and ₹1,499 on p. 16. | pp. 2, 16 | 2 |
| Key metrics are printed as "targets" with nothing behind them: ARPU, COGS, margin, CAC, LTV. | p. 3 | 5 |
| "LTV : CAC > 16×" does not follow from $290 and $20, which give 14.5. | p. 3 | 7 |
| The ask promises all milestones "within six months of close". | p. 3 | 4 |
| The status column mixes "Built", "Built — chat strong" and "chat persistence wired", none dated. | p. 3 | 3 |
| Selling "anonymized life-phase audience data for advertisers" is in the executive summary. | p. 2 | 6 |

### Market opportunity and Why Now (pp. 4–5)

| Fault | Where | Rule |
| --- | --- | --- |
| Six adjacent markets are listed with sizes ($12B+ to $150B+) and no sources. None is the addressable market. | p. 4 | 5 |
| "Why Now" says open-source frameworks "make institutional-grade chart calculations accessible". The moat section then says the calculation is the first moat. | pp. 5, 12 | 2 |
| The "beachhead" is India, the United States, Canada, the United Kingdom, Australia and Asia. That is not a beachhead. | p. 5 | 4 |
| "This audience already spends billions annually" has no source. | p. 5 | 5 |

### 2. Problem and solution (pp. 5–8)

| Fault | Where | Rule |
| --- | --- | --- |
| "hundreds of dollars per consultation" has no source, and Indian marketplaces charge by the minute at far lower rates. | p. 5 | 5 |
| "No platform currently combines..." repeats the unsupported uniqueness claim. | p. 7 | 1 |
| The engine's internal code name is used as a product term. | pp. 7, 11, 12, 20–22, 24, 30, 32, 33, 35 | 9 |
| "Truth Engine" names the calculation layer as truth. | p. 7 | 1 |
| The paragraph on moving planets has spelling and grammar errors, and the section ends with an exclamation mark. | p. 8 | 9 |
| The competitor table contains code file names ("ChatSection.tsx", "chatAPI.ts") where competitors' limitations should be. | p. 8 | 9 |
| AstroSage appears in three of five competitor categories, which blurs the comparison. | p. 8 | 5 |
| Page 9 has no text that could be read. It may hold a diagram; if it is empty, it should go. | p. 9 | 9 |

### 3. Product: current state against roadmap (pp. 10–11)

| Fault | Where | Rule |
| --- | --- | --- |
| "Architecture Today" is a heading with no text under it. If a diagram sits there, it needs a caption saying what is built. | p. 10 | 9 |
| The plan says chat is "grounded in accurate Vedic chart data" while the same table lists retrieval as "Partial" with "Fake SHA-256 embeddings" and the research pipeline as "Not built". | pp. 10, 11 | 1, 3 |
| "a bar no competitor has cleared" has no evidence. | p. 11 | 1 |
| Source file paths are printed in an investor document. | p. 11 | 9 |
| "a paid subscription product within 90 days" was promised with billing not built. | p. 11 | 4 |

### 4. Technology and moat (p. 12)

| Fault | Where | Rule |
| --- | --- | --- |
| Four of the five moat layers were not built: the research pipeline (listed as "Not built — P0" on p. 11), the dashboards, the social graph and the benchmark. An unbuilt feature is not a moat. | pp. 11, 12 | 3, 4 |
| "PVR/JHora-grade" leans on a named astrologer and on free software. The plan's own risk table warns against using individuals' names. | pp. 12, 33 | 9 |
| The stack table lists the database host, which has since changed. Stack trivia dates quickly and adds nothing for an investor. | p. 12 | 3 |

### 5. Market analysis (pp. 13–14)

| Fault | Where | Rule |
| --- | --- | --- |
| The heading says "300-600 Million". The table's rows add to 300M (230 + 15 + 55) but its total line says "~600M adults". | p. 13 | 2, 7 |
| The shares used (65–70%, 70%, 25–30%) have no source. | p. 13 | 5 |
| Year 1 serviceable market is 25K–50K payers, against 3,500 in the financial projection. | pp. 13, 26 | 2 |
| Year 3 is ~500K payers here, against 55,000 in the financial projection. | pp. 14, 26 | 2 |
| Comparables ("$500M+ valuation", "$5M+ ARR") are unsourced, and Co-Star is dismissed as having "no Vedic accuracy". | p. 14 | 5 |
| The social network is presented as a strategic advantage before the core product is validated. | p. 14 | 4 |

### 6. Competitive analysis (p. 15)

| Fault | Where | Rule |
| --- | --- | --- |
| The positioning map places AdAstra at "High accuracy" with no measurement. | p. 15 | 1 |
| "most all current AI astrology is inaccurate" is unsupported, and has a typo. | p. 15 | 1, 5 |
| "AdAstra is the first intelligence platform to close this gap" is unsupported. | p. 15 | 1 |
| "12 life domains updating continuously" describes something that did not exist. | p. 15 | 3 |
| The incumbents are underweighted. AstroSage and Astrotalk already have scale and AI products. | p. 15 | 5 |

### 7. Business model, pricing and go-to-market (pp. 16–20)

| Fault | Where | Rule |
| --- | --- | --- |
| The free tier is 25 questions a year, which is too few to form a habit. | pp. 2, 16 | 4 |
| LTV assumes about 68% retention over 24 months, while the same plan targets 45% paid retention at day 30. | pp. 17, 20 | 2, 7 |
| Blended CAC is $20 here and $18 on p. 26. | pp. 17, 26 | 2 |
| Channel CAC targets ($0–25) are given with no test behind them. | p. 19 | 5 |
| A sentence is printed twice. | p. 18 | 9 |
| "Major life predictions" is listed as shareable content, against the plan's own disclaimer rule. | pp. 18, 33 | 1 |
| 10,000 registrations and 750 payers imply 7.5% conversion. The assumption on p. 25 is 5%. | pp. 19–20, 25 | 2, 7 |

### 8. Platform products (pp. 20–21)

| Fault | Where | Rule |
| --- | --- | --- |
| API prices are quoted for a product that depends on an unbuilt benchmark. | pp. 20–21 | 4 |
| Section 8.3 builds advertiser segments from "divorce, job loss, health concern, legal dispute, fertility window". It calls this "not PII". | p. 21 | 6 |

### 9. Product roadmap (pp. 21–24)

| Fault | Where | Rule |
| --- | --- | --- |
| The roadmap put the research pipeline, a rebrand, billing and legal pages in June, the first dashboards in July and August, and twelve dashboards, social matching and a marketplace by November. None of the dates held. | p. 23 | 4 |
| The twelve dashboards include Health, Accidents, Disease and Legal Cases, which carry liability. | p. 23 | 6 |
| List numbering runs on from earlier lists (items 5–16, then 17–22). | pp. 23–24, 30–31 | 9 |

### 10. Team (pp. 24–25)

| Fault | Where | Rule |
| --- | --- | --- |
| The founder is "[Placeholder — to be named]". | p. 24 | 9 |
| Five hires in two months, plus two advisors, with no names or pipeline. | pp. 24–25 | 4 |
| The codebase is said to have "PII encryption". A November plan treats encryption as work still to do. Check. | p. 24 | 3 |

### 11. Financial projections (pp. 25–29)

| Fault | Where | Rule |
| --- | --- | --- |
| The projections are said to "model only the initial subscription business", yet Year 3 includes "15% B2B revenue mix" and a mix of 75% subscription. | pp. 25, 26, 29 | 2 |
| Year 3 is described as a "15% B2B revenue mix". The mix printed beside it gives the API and Skill 8% and audience data 5%, which is 13%, and all non-subscription revenue 25%. | p. 26 | 7 |
| 55,000 subscribers at $16–18 a month is $10.6M to $11.9M a year, not ~$9.5M. Check the India blend. | p. 26 | 7 |
| Burn of $90K to $115K a month uses about $615K in six months. On $1.0M–$1.5M that is 10 to 15 months, against "12-24 month runway". | pp. 25, 30, 33 | 2, 7 |
| At month 6, $12K of MRR covers about a tenth of the monthly burn. The plan does not say so. | p. 25 | 4 |
| "Co-Star reports ~6–8% historically" has no source. | p. 25 | 5 |
| Six expansion phases repeat the same paragraph twice. | pp. 27–29 | 9 |

### 12 and 13. The ask and the exit (pp. 30–32)

| Fault | Where | Rule |
| --- | --- | --- |
| A Series A is positioned at months 12–18 on the strength of $12K MRR. | p. 31 | 4 |
| The exit story names specific acquirers and rests on advertising signals such as "marriage stress" and "fertility window". | pp. 31–32 | 6 |
| "$30 ARPU diaspora" here, against $18 blended elsewhere. | pp. 3, 32 | 2 |
| The acquirer table groups companies in ways that look wrong, such as Shaadi.com under Match Group. Check. | p. 31 | 5 |

### 14. Risks (pp. 32–33)

| Fault | Where | Rule |
| --- | --- | --- |
| Missing risks: calculation defects, interpretation error by the model, dependence on one model provider, solo-founder dependence, weak retention in AI apps, app-store review, and payment failure in India. | pp. 32–33 | 10 |
| "No accuracy claims in marketing until benchmark is advisor-validated" is the right rule, and the document breaks it. | p. 33 | 1 |

### 15. Appendix and open items (pp. 34–36)

| Fault | Where | Rule |
| --- | --- | --- |
| The open-items page shows the document went out unfinished: no legal entity, no founder name, undecided positioning on advertising. | p. 36 | 9 |
| Page 34 has no text that could be read. It may hold a diagram; if it is empty, it should go. | p. 34 | 9 |

## What the June plan got right, and the revision should keep

- **It said accuracy engineering is co-equal with go-to-market** (p. 21). November work followed that.
- **It published an honest truth table** of what was built and what was not (pp. 10–11).
- **It set the right rule on accuracy claims** (p. 33), even though it did not follow it.
- **"Acquire Questions, Not Users"** (p. 17) is still the go-to-market principle.
- **It kept health and legal content in spiritual, non-advice framing** (p. 33).
