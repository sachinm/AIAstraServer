# Wellness and performance app "Today / You" screen patterns (for the AI Astra "You" board)

Research date: 2026-11-09. Years of sources are marked. Quotes are kept under 15 words. Some vendor pages (whoop.com year-end roundup and AI guidance post, Headspace help centre) returned HTTP 403, so the details below come from search snippets of those pages. Each such point is marked "(snippet)".

## 1. The top-of-screen "state right now" panel

### Takeaway
The leaders put one to three scores at the very top, each a dial or ring with a 0–100 (or %) number. The colour band carries the meaning, and the "why" sits one tap down. Whoop's own story is that the score is the guidance. The trend in 2024–2026 is to cut clutter, keep one most important score plus a time-of-day insight, and move contributors to a second layer.

### Cited Findings
- **Whoop, three dials.** Sleep, Recovery and Strain sit at the top as three dials, each opening its own deep-dive page. Members can pin the metrics that matter to them. — [WHOOP, all-new home screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/) (snippet, 2023)
- **Whoop, recovery colour bands.** Green is 67%+ and red is below 33%, with the same three colours on every screen. A design teardown sums up the overview tiles as "No graphs, no charts, no noise." It calls each tile "a doorway, not a destination," with three tiers: tile → week-over-week trend → deep biometric graphs. — [925 Studios, WHOOP design breakdown](https://www.925studios.co/blog/whoop-design-breakdown) (2026, third-party)
- **Whoop, the score as the guidance.** The same teardown: "Your Recovery score IS the coaching." Recovery sets the day's strain target, and a Sleep Coach suggests a bedtime window. — [925 Studios](https://www.925studios.co/blog/whoop-design-breakdown) (2026)
- **Whoop, guidance changes through the day.** In the morning the home screen may recommend a target strain or behaviours based on Recovery. Later in the day it shows sleep recommendations. — [WHOOP home screen post](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/) (snippet)
- **Whoop, 2025 redesign.** The redesigned home "brings your entire health story together at a glance." A new Health tab holds long-term Healthspan metrics, and iOS lock-screen widgets show Sleep, Recovery and Strain. — [Everything WHOOP launched in 2025](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/) (snippet, 2025)
- **Oura, scores on top of Today.** Sleep, Readiness and Activity Scores sit at the top of Today as shortcuts, next to Heart rate, Daytime Stress and Cycle Insights (if opted in). Below them is a daily highlight insight chosen by the time of day. Oura likens Today to a news app's "Top Stories." — [Oura, new app experience](https://ouraring.com/blog/new-oura-app-experience/) (blog dated Oct 2024)
- **Oura, the "why" in Vitals.** Contributors live in the Vitals tab, not Today. A down arrow reveals top contributors, a side arrow opens full details, and members swipe between metrics. Each metric shows the member's baseline range. — [Oura blog](https://ouraring.com/blog/new-oura-app-experience/) (2024)
- **Oura, palette tracks the body.** The refreshed colour palette "adjusts in real-time based on each member's biometrics." A reviewer says the redesign shows "your most important score" plus any unusual metrics. — [9to5Google, Oura app redesign](https://9to5google.com/2025/10/20/oura-app-redesign/) (Oct 2025); [Droid Life](https://www.droid-life.com/2025/11/13/oura-ring-app-gets-big-facelift-ai-gets-more-access-to-your-metrics/) (Nov 2025). Dates conflict: the Oura blog fetched reads Oct 2024 while press coverage is Oct–Nov 2025. Possibly two waves; unresolved.
- **Garmin, Body Battery.** The widget shows the current Body Battery level plus a graph of the last several hours. The Morning Report (on the watch, configurable) bundles weather, Body Battery, steps, women's health information, calendar events and sleep. — [Garmin manual, Body Battery widget](https://www8.garmin.com/manuals/webhelp/GUID-BD965919-30AA-4EB5-95D7-A899658C50EB/EN-US/GUID-28BA6B01-9460-4FF3-8499-5D91269FD50B.html); [Garmin manual, Morning Report](https://www8.garmin.com/manuals/webhelp/GUID-FABAD210-C716-48B1-AB1D-A09097F1CED4/EN-US/GUID-60D956CF-594D-4FA1-909F-D181BA7D5B92.html)
- **Garmin, users missed the graph.** When Garmin Connect replaced the full Body Battery graph with a highs-and-lows-only view, forum users asked for the old graph back. — [Garmin forums](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/344436/is-there-a-way-to-go-back-to-the-old-body-battery-graph) (2023)
- **Welltory, Today screen.** Main indicators are Health, Battery and Stress, with Health always on top, and personal Insights sit just below them. An older version drew the state as a fuel tank: liquid level = energy, simmer/boil = stress. — [Welltory help, Insights](https://help.welltory.com/en/articles/15010986-insights); [Welltory, what changed with the update](https://help.welltory.com/en/articles/4488494-what-changed-with-the-update)
- **Welltory, retention claim.** Welltory says users who saw the new Today Screen were twice as likely to return the next week, in a limited beta. This is the company's own claim. — [PR Newswire](https://prnewswire.com/news-releases/welltory-transforms-apple-watch-data-into-scientific-wellness-guidance-302090912.html)
- **Levels, home screen.** Early Levels planned a Home with a top glance card and an explainable Day Score that shows which factors and foods drove it. The Zone Score folds several factors into one meal number. — [Levels, March 2021 update](https://www.levelshealth.com/inside-the-company/march-2021) (2021); [Levels, what Levels does](https://levels.com/blog/what-levels-does-and-why)
- **Apple Health Summary.** Pinned metrics sit on top (renamed from Favorites; under a "Pinned" heading from iOS 18). Highlights describe current status, and Trends show progress over several weeks. Only a few highlights show, with "Show All Highlights" to go deeper. — [Apple support](https://support.apple.com/104997); [MacStories, iOS 13](https://www.macstories.net/?p=60534) (2019); [9to5Mac](https://9to5mac.com/2025/12/31/apple-health-best-features/) (Dec 2025)

### Inferences
- The common pattern is one hero state (a dial or ring plus a band word or colour), then one sentence of guidance, then a row of two or three secondary tiles. The "why" (contributors) is always one tap down and never on the hero.
- For the You board, a likely fit is one "state" dial or band with a named tone (e.g. Demanding / Steady / Opening). Under it goes one sentence, and a tap shows "what is driving this." Engine names never appear; the contributors are life areas, not planets.
- Oura and Whoop both change the top insight with the time of day. The You board could do the same: a morning framing versus an evening reflection.
- Fixed colour meaning across every screen (Whoop) builds trust fast. A tone colour on You should mean the same thing on Today, Love and Work.

### Gaps
- No source found describing Eight Sleep's app home layout or its sleep-fitness score presentation.
- No current (2025–2026) source on the Levels Metabolic Score screen. The material found is from 2021.
- Rise's top-of-screen "sleep debt" panel was not confirmed in the sources found. Only the Energy Schedule is covered (section 2).

## 2. Timing windows during the day and week

### Takeaway
Rise is the cleanest model for timing: a daily curve with named windows (morning peak, afternoon dip, evening peak, a one-hour Melatonin Window), each tied to a type of task. Whoop's Daily Outlook (2025) adds predicted energy and best training times. These map directly onto "a better time to start from 1 Dec."

### Cited Findings
- **Rise, energy curve.** Rise predicts a daily curve of morning peak, afternoon dip, evening peak, then melatonin window, with timing that shifts day to day. — [Rise help, Energy Schedule](https://help.risescience.com/hc/en-us/articles/6654243671191-What-is-my-Daily-Energy-Energy-Schedule)
- **Rise, task matching.** Rise matches each window to a kind of work: peaks for demanding work, the dip for admin such as emails, CRM and expenses. — [Rise blog, circadian energy peak](https://www.risescience.com/blog/circadian-energy-peak-sales-productivity)
- **Rise, Melatonin Window.** A one-hour window, predicted from recent sleep times, in which to go to bed. — [Rise help](https://help.risescience.com/hc/en-us/articles/6654243671191-Getting-to-Know-Your-Daily-Energy)
- **Whoop, Daily Outlook (2025).** Powered by WHOOP Coach, it helps plan the day with predicted energy levels and optimal training times. Day in Review is the evening counterpart, highlighting patterns such as bedtime consistency. — [WHOOP, new AI guidance](https://www.whoop.com/us/en/thelocker/new-ai-guidance-from-whoop/) (snippet, 2025); [Gadgets & Wearables on Daily Outlook](https://gadgetsandwearables.com/?p=16084720)
- **Whoop, strain target.** Recovery sets a strain target for the day, and the Sleep Coach gives a bedtime window. — [925 Studios](https://www.925studios.co/blog/whoop-design-breakdown) (2026)

### Inferences
- Use a named window plus a verb plus a date range, such as "Stronger from 1 Dec: start new work." This is the Rise "window plus task type" shape, at a horizon of weeks rather than hours.
- The morning/evening pair (Outlook / Review) fits a Today board, with You keeping the slow horizon.
- Timing windows feel credible when the curve is shown, not only the label. A simple horizontal band from now to the end of the year, with the window shaded, mirrors Rise's curve.

### Gaps
- No source found quoting Oura's exact "optimal bedtime" wording on screen.
- No primary page was fetched for Whoop Daily Outlook (403). Details rest on snippets.

## 3. Trends and horizons

### Takeaway
Apps separate three layers: today (Today/Home), recent with baseline (Vitals, week-over-week), and long-term (My Health, Healthspan, weekly/quarterly/yearly reports). Clinicians and reviewers urge weekly trends over daily scores for anxious, high-achieving users.

### Cited Findings
- **Oura, long-term layer.** My Health holds slow metrics (Cardiovascular Age, Stress Resilience), long-term graphs, and weekly, quarterly and yearly reports that highlight strengths and areas to improve, shareable with clinicians. — [Oura blog](https://ouraring.com/blog/new-oura-app-experience/) (2024)
- **Oura, baselines.** Vitals shows each metric against the member's baseline range so shifts are easier to spot. — [Oura blog](https://ouraring.com/blog/new-oura-app-experience/)
- **Whoop, trend tier.** Tap a tile for a week-over-week trend view. The Journal correlates habits with Recovery after 30 days. — [925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- **Whoop, Health tab (2025).** It unifies cardiovascular fitness and long-term Healthspan. — [WHOOP 2025 roundup](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/) (snippet)
- **Apple Health.** Trends show progress over several weeks, and Highlights show current state. — [9to5Mac](https://9to5mac.com/2025/12/31/apple-health-best-features/); [Apple support](https://support.apple.com/104997)
- **Weekly over nightly.** Sleep doctor Michael Breus advises reviewing weekly trends rather than judging single nights. — [Harper's Bazaar via AOL](https://www.aol.com/articles/oura-ring-judging-160543237.html) (Mar 2026)

### Inferences
- The You board can use the same three layers: Now (present state) → This season (next 4–8 weeks) → This year (the arc to Dec 2027).
- Oura's "strengths and areas to improve" report wording maps directly onto "strengths and struggles."
- For busy professionals, a weekly or monthly digest may be safer than daily swings.

### Gaps
- No reviewer data was found specifically on busy professionals and trend views.
- Streak patterns were not researched in depth.

## 4. Personalisation by age, sex and goal

### Takeaway
Personalisation is gated by onboarding intent and opt-in. Oura asks for an intention at onboarding and hides cycle phases unless the contraception answer allows it. "Prefer not to say" is offered and quietly removes features rather than blocking the user.

### Cited Findings
- **Oura, intention at onboarding.** New members choose an intention (e.g. cycle tracking, pregnancy). Existing members are assigned one from the features they already use. — [Oura support, Cycle Insights](https://support.ouraring.com/hc/en-us/articles/51359344232211) (updated Aug 2026)
- **Oura, contraception gating.** Cycle phases and the fertile window show only if hormonal contraception = "None." Choosing "Prefer not to say" also hides them, but period predictions remain. — [Oura support](https://support.ouraring.com/hc/en-us/articles/51359344232211)
- **Oura, phase-aware insights.** Opted-in members get insight messages that account for their cycle phase. — [Oura, Cycle Insights blog](https://ouraring.com/blog/oura-cycle-insights)
- **Oura, women's health AI (2026).** Oura launched a proprietary AI model focused on women's health. — [TechCrunch](https://techcrunch.com/2026/02/24/oura-launches-a-proprietary-ai-model-focused-on-womens-health/) (Feb 2026)
- **Oura, shorter calibration.** A November 2025 update reportedly shortened cycle onboarding from 60 nights to the start of the next cycle. — [The Momentum, secondary](https://www.themomentum.ai/blog/oura-womens-health-ai-model). Not confirmed by Oura.
- **Oura Advisor tone.** Users can pick a supportive, encouraging voice or a more direct, accountability style, and set how often it checks in. — [Oura, Advisor blog](https://ouraring.com/blog/oura-advisor)
- **Garmin.** The Morning Report includes women's health information when enabled. — [Garmin manual](https://www8.garmin.com/manuals/webhelp/GUID-FABAD210-C716-48B1-AB1D-A09097F1CED4/EN-US/GUID-60D956CF-594D-4FA1-909F-D181BA7D5B92.html)

### Inferences
- Ask intention at onboarding (career, love, health, calm) and use it to order You board panels.
- When sex or gender is unspecified, default to neutral "you" copy and hide gender-specific panels rather than guessing.
- A tone choice (gentle vs direct) like Oura Advisor's suits executives who prefer bluntness.

### Gaps
- No source found on pronoun questions in Oura, Whoop or other onboarding flows, or on exact copy for unspecified sex.
- Age-based personalisation copy was not found.

## 5. Tone when the user is doing badly

### Takeaway
Score anxiety ("orthosomnia") is a documented backlash. Users describe scores as a "digital moral scorecard," and apps are responding with rest modes, softer messaging and a choice of coach tone. Robotic, jargon-heavy feedback and "wellness" framing that hides restriction both draw criticism.

### Cited Findings
- **Scores as a moral scorecard.** Sleep doctor Michael Breus warns a score can become "a digital moral scorecard." Psychologist Rachel Goldman suggests asking "How do I actually feel today?" first. Oura's Rest Mode and more "compassionate" messaging are cited as responses. — [Harper's Bazaar via AOL](https://www.aol.com/articles/oura-ring-judging-160543237.html) (Mar 2026)
- **Orthosomnia.** The perfectionist pursuit of a perfect sleep score can itself cause anxiety. A study gave participants false "slept poorly" feedback, and they did worse on cognitive tests. — [same article](https://www.aol.com/articles/oura-ring-judging-160543237.html)
- **Score before self.** A psychologist quoted in coverage: a readiness score checked before self check-in "can shift everything." — [AOL](https://www.aol.com/articles/oura-ring-judging-160543237.html)
- **Whoop, robotic copy.** Critics call Whoop's feedback robotic and jargon-heavy, e.g. "Multiple days below strain targets will promote recovery." — [925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- **Advisor gives context.** Reviewers value Advisor for context over raw numbers: "Instead of staring at raw numbers, you get context." — [tooldirectory.ai](https://tooldirectory.ai/tools/oura) (secondary)
- **Noom, praise and doubt.** Noom is praised for "compassionate and empathetic language" and gradual goals. — [HelpGuide](https://helpguide.org/handbook/healthy-living/noom-review). Critics say the softened wellness wording hides calorie restriction. — [InsideHook](https://www.insidehook.com/wellness/course-noom-diet); [Virginia Sole-Smith](https://virginiasolesmith.substack.com/p/the-strange-mythology-of-noom)

### Inferences
- On a hard stretch, name the season, not a verdict ("A demanding stretch; it eases after mid-Dec"). Always pair it with an end date and one small action. This avoids the "moral scorecard" effect.
- Lead with "How do you feel?" or a confirm question before the prediction. This matches the project rule that the assistant confirms before it predicts.
- Avoid both robotic jargon (planet or house words) and euphemism that hides real difficulty.

### Gaps
- No verified short on-screen copy examples from Whoop or Oura for low recovery or readiness. Exact strings need app screenshots.
- No Noom copy examples for weight regain were found.

## 6. Information density

### Takeaway
The direction across apps is fewer tabs and fewer above-the-fold items. Oura went from five tabs to three. Whoop shows three tiles with detail behind a tap. Headspace refreshed its Today tab in June 2026 from member feedback. Users push back when removed detail had real value (Garmin graph).

### Cited Findings
- **Oura, five tabs to three.** Oura condensed Home, Readiness, Sleep, Activity and Resilience into Today, Vitals and My Health. — [9to5Google](https://9to5google.com/2025/10/20/oura-app-redesign/)
- **Whoop, three tiles.** Three metrics on the overview, reorderable tiles, detail on tap. — [925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- **Whoop, 2023 density concern.** The 2023 redesign showed more data, but a reviewer warned new users may find it daunting. — [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/) (2023)
- **Headspace, June 2026 refresh.** Headspace rolled out an updated Today Tab "based on member feedback," with a "Your Essentials" heading. — [Headspace help](https://help.headspace.com/hc/en-us/articles/51443842967195-Refreshed-Today-Tab-Experience-June-2026) (snippet, 2026). An earlier review said the home screen needed significant scrolling. — [screensdesign](https://screensdesign.com/showcase/headspace-meditation-sleep)
- **Calm.** Home offers quick access to content types, daily content and personalised recommendations. — [Calm, new look](https://www.calm.com/blog/new-look-more-calm)
- **Apple Health.** Shows a few highlights, with "Show All" for more. — [MacStories](https://www.macstories.net/?p=60534)

### Inferences
- Above the fold: one hero state plus one sentence plus two or three chips or tiles. Everything else goes in a swipe carousel on phone and tabs on desktop, which matches the project's modular-panels rule.
- Keep a "show the curve" option. Garmin users disliked losing the graph.

### Gaps
- No exact card counts were verified for Calm or Headspace current home screens.
- No list of features formally removed after feedback, beyond the Oura tab merge and the Garmin graph change.

## 7. What executives and high earners value

### Takeaway
Evidence is thin and mostly vendor-sourced. The value signal is a coaching layer that turns data into a plan (Whoop Coach / Daily Outlook, Oura Advisor), premium add-ons such as lab tests, and long-horizon reports.

### Cited Findings
- **Whoop Advanced Labs.** It pairs Quest lab tests (65 biomarkers) with daily wearable data and coaching. — [WHOOP Advanced Labs](https://www.whoop.com/jp/en/thelocker/whoop-advanced-labs/); [WHOOP podcast 344](https://www.whoop.com/gb/fr/thelocker/podcast-344-introducing-the-all-new-whoop-advanced-labs/) (2025, vendor)
- **Whoop Coach.** WHOOP Coach, built on OpenAI, powers the Daily Outlook planning layer. — [WHOOP, introducing Coach](https://www.whoop.com/au/en/thelocker/introducing-whoop-coach-powered-by-openai)
- **Oura Advisor.** Oura reports 83% of members rated Advisor's answers trustworthy (company-reported), and Advisor is English-only. — [Oura Advisor blog](https://ouraring.com/blog/oura-advisor)
- **Weekly reports.** Oura offers weekly, quarterly and yearly reports. — [Oura blog](https://ouraring.com/blog/new-oura-app-experience/)

### Inferences
- For executives, a weekly brief ("your week ahead: best days for decisions") plus an ask-anything coach is the likely premium hook.

### Gaps
- No independent survey or interview found on what executives or high earners specifically value in these apps.
- No Reddit sentiment was gathered (not searched within budget).
- Eight Sleep, Noom coaching and concierge tiers were not covered.
