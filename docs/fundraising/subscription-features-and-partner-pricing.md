# Subscription features, partner API and sponsorship pricing

November 2026 · Proposed tests in USD and INR. The existing Plus prices remain $50 and ₹2,499 monthly. These new prices are test quotes, with tax and payment fees handled in the commercial model.

## What earns a renewal

AllTrails shows the paid value of completing a task: offline navigation and advanced custom routes. Day One shows how saved history, prompts and reflection can support repeat use, with richer capture and sync behind paid tiers. These examples establish packaging, and public information does not attribute their subscriptions to a particular feature. RevenueCat's 2026 dataset reports weaker long-term retention for AI apps, so measure what users come back to do before scaling paid acquisition. [AllTrails membership](https://support.alltrails.com/hc/en-gb/articles/37200882853140-The-benefits-of-AllTrails-premium-membership) · [Day One plans](https://dayoneapp.com/plans/) · [RevenueCat benchmarks](https://www.revenuecat.com/state-of-subscription-apps)

| Build order | User outcome | Packaging and proof |
|---|---|---|
| 1. First useful answer | Open free Panchang or pick a Self, Love or Work topic, read a card with chart context, then ask a focused follow-up. Show the first useful result early in onboarding. | Basic timing and card previews remain free. Measure first completed timing check or card-to-chat, and 7-day return. |
| 2. Return to a decision | Save and reopen a conversation with its card and chart context, get an optional reminder when a saved date approaches, and see what changed since the last visit. | Include saved context, date watch and deeper follow-ups in Plus. Compare 30-day meaningful use and first paid renewal against the existing experience. Allow read access to saved work after downgrade. |
| 3. Complete a Life Project | Compare two dates, pin notes and relevant chart evidence, and turn decisions into milestones. Start with trips and engagements, then test promotion and business milestones. | Free preview with one project. Test multiple active projects, ongoing AI planning and date comparisons as Plus benefits. Measure projects revisited or updated in a later week and renewals by project cohort. |
| 4. Understand the reading | Show which chart factors mattered, how uncertain birth time affects a reading, and which timing factors changed. Let users choose a light, research-oriented or calmer response. | Offer a sample of Research before purchase. Measure Research use, reading helpfulness, refunds and cost per completed answer. |

Price Plus around the complete workflow. Test the existing $5.99/month US single-dashboard add-on and the ₹199 India 30-day pass with customers who want just one area. Test ₹99/₹299/₹499 one-time question offers in India. Keep pricing, quote history and catalog changes separate from measured willingness to pay. Test one feature or offer at a time using an eligible holdout. Report initial purchase, first renewal, 90-day contribution, India pack repurchase and reactivation. Scale a feature when it improves repeat paid use and contribution without worsening refunds or support materially.

## Partner API price card

Start with public, location-and-date Panchang. Count one successful city-date-language lookup as one request. Sandbox, provider errors and idempotent retries are free. Offer time zones, structured timing windows, documentation and a test widget. The local time and daylight-saving behavior need fixture verification before selling. Prokerala is a commodity benchmark and charges different credit amounts for basic versus advanced Panchang. Price the supported widget and integration as the premium. [Prokerala pricing](https://apiorigin.prokerala.com/pricing) · [Credit usage](https://api.prokerala.com/api-credits)

| Plan | US per month | India per month | Included |
|---|---:|---:|---|
| Sandbox | Free | Free | 100 sample requests per month |
| Developer | $29 | ₹1,499 | 10,000 Panchang lookups and email support |
| Business | $149 | ₹7,999 | 100,000 lookups, branded embed and integration support |
| Enterprise pilot | From $750 | From ₹39,999 | Up to 500,000 lookups, integration review and negotiated SLA |

Sell additional 10,000-lookups blocks at $15 or ₹799 with an opt-in cap. Pilot with two partners before publishing prices. A later separately priced report endpoint can start at $0.50 or ₹29 per successful report if fully loaded marginal delivery cost stays at or below 30% of price. Use synthetic fixtures during partner evaluation. Define distribution rights, included support and any SLA in the order form. Keep consumer charts and chat outside this public API. Track contracted API MRR separately from usage fees and consumer MRR.

## Advertising engine and age group engagement

Start with direct sponsorships on free public-facing calendar and editorial pages. The engine chooses an approved creative using storefront region, language, public placement, campaign dates and remaining budget. Charge only for eligible impressions. Keep ads out of chat, the calmer response mode, chart results, private projects and the paid experience.

For age-group engagement, randomize creative across eligible traffic on the same placement. Separately invite consenting adults to opt into measurement using self-selected 18–24, 25–34, 35–49 and 50+ bands. Keep the band out of delivery and advertiser requests. Use it only to measure aggregate differences in engagement internally. Unknown ages and minors stay out of the age study, and minors receive no ads in the pilot. Use general-audience creative, distinct sponsorship labels, in-app targeting information and an ad reporting control. Keep birth dates, charts, chats, projects, inferred feelings and priorities out of the advertising system. Review region and store requirements before release. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [India DPDP Act](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)

| Direct placement test | US | India |
|---|---:|---:|
| CPM quote after inventory is measured | $8–$15 | ₹150–₹350 |
| Four-week reservation minimum, with agreed inventory | $250 | ₹10,000 |

Use CPM as the billing unit for metered campaigns. Use the minimum as a reservation floor for a separately scoped package with agreed inventory or fixed sponsorship deliverables. Avoid selling guaranteed audience reach until there is measured supply. Cap exposure at one sponsored card per session and three per week during the pilot. At 44,000 MAU, three eligible impressions per user per month and 40% sell-through yield 52,800 sold impressions. At $10 blended CPM that is $528 monthly advertising revenue, an illustration before selling and operating costs. Keep advertising out of the $100K subscription MRR case.

Test creative within a placement such as a public travel calendar or learning guide. Measure qualified landing visits per 1,000 eligible impressions, hides and reports, and effect on return visits and paid conversion against an ad-free holdout. Compare age bands only when each cell has at least 100 consenting participants, and require a sample sized for the expected lift before acting on it. Report campaign totals to sponsors and keep individual age and engagement records out of exports.
