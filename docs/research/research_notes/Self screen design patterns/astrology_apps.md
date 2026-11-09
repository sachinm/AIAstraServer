# Self / Profile / "Your chart" screen design in leading consumer astrology apps

Research date: 2026-11-09. Sources are App Store listings as fetched on this date, plus press, UX critiques and reviews. Older material is dated inline. Short quotes are under 15 words. Any claim that could not be sourced sits under Gaps, not under findings.

## 1. What section names appear on the self screen, per app, in order?

### Takeaway
Western apps split "self" into three blocks:
- a static personality reading (Co-Star natal chart, The Pattern "Your Pattern", CHANI birth chart by planet);
- a timing block (The Pattern "Timing" / "Your Transits", CHANI personalized transits);
- a relationships block (Bonds, Friends).

Vedic apps (Align27, AstroSage) are organized around tools instead of a narrative "You": Kundli, Dasha, Sade Sati, a Hora grid and color-coded days. Public sources did not confirm the exact on-screen order for most apps.

### Cited Findings
**Co-Star**
- Free tier: friend compatibility, personalized daily horoscopes, push notifications, and "learn to read your full birth chart". Premium tier: "Ask the Stars", charts for people not on the app, a Love report, and Eros (couples) — [App Store, Co-Star](https://apps.apple.com/app/id1264782561)
- Named screens:
  - a Dashboard with a daily theme and "Do/Don't" lists;
  - forecast categories worded like "Luck in home & family" and "Trouble with friends";
  - a planetary angle visualization;
  - "The Astronomy Behind Astrology";
  - "Ask the Void";
  - a message to your future self, delivered when "the stars align".
  Source: [ScreensDesign Co-Star teardown](https://screensdesign.com/showcase/costar-personalized-astrology), undated.
- The home screen opens with a personal greeting. The natal chart is in the primary navigation, but new users may struggle to find it. Bottom-nav labels use small type — [Pratt IxD critique, Sep 2024](https://ixd.prattsi.org/2024/09/design-critique-co-star-ios-app/)

**The Pattern**
- A 2024 review names these sections:
  - Your Pattern: the birth-chart analysis, shown as a slideshow covering destiny, growth, instincts, communication and past relationships;
  - Timing;
  - Bonds;
  - Library;
  - Time Travel;
  - World Timing;
  - Romantic Patterns;
  - Connect (dating).
  Source: [Bustle, May 15 2024](https://www.bustle.com/life/pattern-app-review-features-price)
- The current App Store listing names: Your Pattern, Your Transits ("past, present and future"), Time Travel, Bonds, Romantic Patterns, Friendship Patterns, Romantic Timing cycles (Bond Transits), In-Depth conversations, Discover Collections, Cosmic Climate, Custom Friends and Connect — [App Store, The Pattern](https://apps.apple.com/app/the-pattern/id1071085727)
- 2026 release notes, from the same [App Store listing](https://apps.apple.com/app/the-pattern/id1071085727):
  - 5.31.0 (May 20): the You tab was reorganized into swipeable collections.
  - July: a Transit Ring was added to Personal Transits.
  - Sept: Upcoming Transits, covering both Pattern and Bonds.
  - A new "Lens" experience.

**CHANI**
- Feature groups in the App Store listing:
  - Daily: horoscope, a meditation matched to the day, real-time Moon.
  - Weekly: astroweather, week-ahead podcast, personalized weekly reading, rituals, tarot, journal prompts.
  - Birth chart: every planet and point.
  - Transits: planetary horoscopes by sign, retrograde status, personalized transit readings.
  - Listen library.
  - Courses: a 7-part Saturn Return course and a 28-day Breakthrough course.
  - Yearly: month by month, across four life areas.
  - Charts.
  - Archive.
  Source: [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252)
- Tabs named in release notes: a "Charts" tab (2.10.0, Oct 12 2026: multiple charts, table view) and a "Listen" tab (redesigned Nov 2025) — [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252)
- The natal chart is organized by planet, each with "gifts" and "challenges". The reviewer called this organization revolutionary — [sunmoresun Substack, Feb 17 2024](https://sunmoresun.substack.com/p/chani-app-review)

**Align27 (Vedic)**
- Daily insights from transits plus the birth chart.
- A 180-day color-coded astro-planner.
- Green, Amber and Red days, with Golden, Productive and Silence "moments".
- Calendar sync.
- Widgets for Now, Hora, Panchapakshi and Rituals.
- A real-time grid (Hora, Panchapakshi, Panchak, Ascendant).
- Rituals grouped by Relationship, Finance, Health, Career and Special Transits.
- Transit tracking for Saturn, Mars and Venus, and a Chandrashtama tracker.
- Prashna, the "Nila" AI assistant, and Live Puja & Homa.

Source for all of the above: [App Store, Align27](https://apps.apple.com/us/app/id1364184571)

**AstroSage (Vedic)**
- Kundli (Rasi, Navamsa, North and South Indian styles).
- Vimshottari and Udu Dasha to five levels.
- Sade Sati, Mangal Dosh and Kaal Sarp.
- Varshphal (annual chart).
- AI Kundli, AI Horoscope and AI Astrologer.
- Matching, Panchang, Lal Kitab, KP and Shadbala.

Source: [App Store, AstroSage](https://apps.apple.com/app/id824705526)

**AstroTalk**
- Roundups list kundli generation, matching, daily horoscope, Panchang, Vastu, numerology and tarot. No screen layout was found — [The Quint brand roundup 2026](https://www.thequint.com/brandstudio/top-best-astrology-apps-india-2026) (sponsored content, low confidence)

### Inferences
- The Pattern is the closest analog to a "You" screen: a personality reading, personal timing and bonds. In 2026 it moved to swipeable collections and a ring visual, which matches a carousel-not-scroll direction.
- Vedic apps use jargon (Hora, Panchapakshi, Chandrashtama, Dasha levels) as section names. None of the Western leaders do. A premium Vedic app could fill this gap by naming sections in plain life language.

### Gaps
- Public sources in this pass did not confirm the exact tab labels or on-screen order of Co-Star's profile tab.
- No public screen description was found for Cosmic Insights, Guruji, Clickastro, or the Astro-Seek mobile self screen.
- Sanctuary: no evidence was found of a "Big Three" self section, and the current US App Store URL tried returned 404.

## 2. How do they present "where you are right now" and timing/forecast?

### Takeaway
Three patterns dominate:
- a daily hero statement with Do/Don't lists (Co-Star);
- named personal cycles with a timeline and a time-travel scrubber (The Pattern);
- color-coded days and hours on a calendar (Align27).

No verbatim "pressure eases on date X" wording was found. However, both The Pattern's cycles and Align27's 180-day planner show dated windows.

### Cited Findings
- The Co-Star dashboard leads with a daily theme plus Do/Don't lists, and category lines like "Trouble with friends" — [ScreensDesign](https://screensdesign.com/showcase/costar-personalized-astrology)
- A Pratt critique finds the Do/Don't headings visually weak: light, and smaller than the body text — [Pratt IxD](https://ixd.prattsi.org/?p=24182)
- The Pattern's Timing section gives the dates and meanings of planetary cycles affecting you now and later. The reviewer saw a Neptune transit that "will last for several more months" — [Bustle 2024](https://www.bustle.com/life/pattern-app-review-features-price)
- The Pattern's listing describes timing cycles "past, present and future" and Time Travel to any date. Transit Ring and Upcoming Transits were added in 2026 — [App Store, The Pattern](https://apps.apple.com/app/the-pattern/id1071085727)
- One user said their first completed cycle was "scarily accurate", and that they felt like a different person the day after it ended — [Hilltop Views](https://hilltopviewsonline.com/19784/life-and-arts/love-astrology-but-struggle-with-its-vocab-this-app-might-be-for-you) (seen via search summary, undated)
- Align27 shows Green, Amber and Red days, Golden, Productive and Silence moments, a 180-day planner and a calendar overlay — [App Store, Align27](https://apps.apple.com/us/app/id1364184571)
- CHANI layers daily, weekly and yearly readings. Its 2026 annual readings run month by month across four life areas — [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252)
- AstroSage uses Dasha periods (to five levels) and Varshphal as its timing frame — [App Store, AstroSage](https://apps.apple.com/app/id824705526)

### Inferences
- A cycle with a visible end date is what users remember (The Pattern's "first completed cycle"). A hero line saying "this eases on <date>" would combine The Pattern's dated cycles with Align27's color scale.
- Day/week/year layering (CHANI) and a date scrubber (The Pattern's Time Travel) are established patterns. No app publicly ties either one to a problem the user has stated.

### Gaps
- No verified quote of "easing on date X" wording in any app.
- Sources did not describe cycle-intensity or progress-bar visuals in The Pattern, beyond the name "Transit Ring".

## 3. How do they word difficult material, and how do they keep hope?

### Takeaway
- Co-Star is deliberately blunt ("lovingly savage"), which draws both love and complaints.
- CHANI frames each placement as gifts and challenges, in a warm tone.
- The Pattern pairs "when you feel good" with "when you don't". Some users still find it too negative.

### Cited Findings
**Co-Star**
- Banu Guler (CEO) said the notifications are meant to be "conversational, zero bullshit, lovingly savage" — [Yahoo/InStyle profile, Jul 10 2019](https://www.yahoo.com/lifestyle/meet-banu-guler-ceo-co-150000063.html)
- Guler: astrology is "not to predict the future" but to "explain and create the present" — same source, 2019
- A harsh Co-Star line that circulated as a meme: "you talk about other people because you don't have your own life" — [Capital FM](https://www.capitalfm.com/internet/co-star-astrology-app-horoscope-meme/)
- How the tone was received:
  - A critic argues the edgy lines clash with people who use astrology for comfort — [Inquirer SCOUT](https://lifestyle.inquirer.net/?p=66779)
  - Users defend it as "brutally honest" — [Inverse](https://inverse.com/article/54991-costar-astrology-app-how-it-works)
  - Jezebel asked why the notifications are so rude — [Jezebel 2019](https://jezebel.com/why-are-co-stars-daily-notifications-so-rude-1833747335)

**The Pattern**
- It pairs states: you can be "the most fun, entertaining, and playful person in the room" when feeling good, but may "hesitate to commit" when not. Bonds advice: "If you're able to communicate, you can avoid hurt feelings." — [Bustle 2024](https://www.bustle.com/life/pattern-app-review-features-price)
- Some App Store reviewers find the tone too negative and want more advice and encouragement — [App Store, The Pattern](https://apps.apple.com/app/the-pattern/id1071085727)

**CHANI**
- The chart is shown planet by planet, as "gifts" and "challenges", and reviewers cite uplifting readings — [sunmoresun 2024](https://sunmoresun.substack.com/p/chani-app-review)
- App Store reviewers praise the warm delivery and weekly readings that feel personal — [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252)

**Vedic apps**
- Align27 marks caution by color (Red days). One user asked for a warning on physically risky days — [App Store, Align27](https://apps.apple.com/us/app/id1364184571)
- AstroSage names doshas outright (Sade Sati, Mangal Dosh, Kaal Sarp) as prediction categories — [App Store, AstroSage](https://apps.apple.com/app/id824705526)

### Inferences
- For a premium user who may be struggling, the evidence favors CHANI's gift/challenge pairing and The Pattern's conditional framing over Co-Star's bluntness. It also argues against putting dosha labels in headlines.
- The "too negative, want advice" complaint about The Pattern suggests that every hard statement should come with an action.

### Gaps
- Without the apps installed, no verbatim CHANI or The Pattern wording was found for a specific hard transit, such as Saturn.

## 4. Do they segment by age, life stage, gender or pronouns, and how is it collected?

### Takeaway
Public sources show onboarding collects birth date, time and place. Age and life stage appear only indirectly, through content such as CHANI's Saturn Return course. No source in this pass confirmed that any app collects pronouns or gender.

### Cited Findings
- The Pattern's onboarding asks for birthday, birth time and location — [Bustle 2024](https://www.bustle.com/life/pattern-app-review-features-price)
- Co-Star's onboarding, per [ScreensDesign](https://screensdesign.com/showcase/costar-personalized-astrology):
  - it has 9 steps;
  - a "Building your chart" wait screen carries witty copy;
  - an edgy notification warm-up follows ("Replace your creamer with chaos");
  - then an Add Friends flow.
- Each Co-Star step is a single screen with a CONTINUE button. There is no step indicator and no reliable back button — [Pratt 2024](https://ixd.prattsi.org/2024/09/design-critique-co-star-ios-app/)
- CHANI's readings default to the rising sign. The developer says users can set their birth time to sunrise to get sun-sign readings — [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252)
- CHANI shipped a new onboarding in Aug 2026 (2.8.0). Its questions are not public — same source
- CHANI's Saturn Return course is a life-stage hook (roughly ages 27–30) — same source
- CHANI reviewers praise its support for the LGBTQ+ community — [sunmoresun 2024](https://sunmoresun.substack.com/p/chani-app-review)

### Inferences
- Life stage enters through content (Saturn Return) rather than a demographic field. A problem-first app could ask "what brings you here" instead of asking for age or gender.

### Gaps
- Not confirmed whether Co-Star, The Pattern or CHANI ask for pronouns or gender in 2026 onboarding.

## 5. What do reviewers and UX teardowns praise or hate?

### Takeaway
- Praised: feeling personally "seen", accurate timing cycles, compatibility, The Pattern's narration voice, minimalist journal-like design, and CHANI's warmth.
- Hated: paywalls creeping over content that used to be free, confusing navigation, a too-negative tone, and billing tactics (Nebula, Align27).

### Cited Findings
**Co-Star**
- Praised: the monochrome, journal-like design. Criticized: abstract icons, "ambiguous phrases", small menu type and unclear VOID purchases — [Pratt 2024](https://ixd.prattsi.org/2024/09/design-critique-co-star-ios-app/)
- A 2025 App Store review says the app is now "largely locked", calls $9 a month excessive, and says the free widget and daily content were cut back — [App Store, Co-Star](https://apps.apple.com/app/id1264782561)

**The Pattern**
- Praised: users feel seen, use it as a self-reflection tool, like Bonds, and praise the narration voice. Complaints: older reviews say navigating many small pages was hard, and some want monthly billing — [App Store, The Pattern](https://apps.apple.com/app/the-pattern/id1071085727)
- Bustle found the interface busy, and the design "boring and clinical" at first — [Bustle 2024](https://www.bustle.com/life/pattern-app-review-features-price)

**CHANI**
- Rated 4.9 from about 60K ratings. Meditations, delivery and artwork are praised. 2021–22 reviewers called the rising-sign default too general — [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252)
- Criticized for the subscription paywall and for having no family profiles — [sunmoresun 2024](https://sunmoresun.substack.com/p/chani-app-review)

**Nebula**
- Offers live chat with over 1,500 advisors. Complaints cover too many notifications, forced extra payments and hidden cancellation settings, with a Google Play rating of 3.4/5. These come from search summaries of [mindbodygreen, Nov 2025](https://www.mindbodygreen.com/articles/nebula-review) and [Medium](https://medium.com/@emeldawheary61/the-astrology-app-that-quietly-emptied-my-wallet-nebula-review-697ef2defb02)

**Align27**
- Favorites: the Timing Grid, the Planner and the date-finder for important activities. Complaints: generic forecasts, loyal users paying more than new ones, and mantras only in English transliteration — [App Store, Align27](https://apps.apple.com/us/app/id1364184571)

**AstroSage**
- Praised for how much it offers free. Complaints: AI predictions called inaccurate, and human astrologers accused of stalling to extend paid sessions — [App Store, AstroSage](https://apps.apple.com/app/id824705526)

### Inferences
- Premium users punish paywall creep and per-minute payment pressure. One flat premium price with no upsell on the self screen would set an app apart.

### Gaps
- No Growth.Design or Mobbin teardown text was retrieved, and Reddit threads were not fetched.

## 6. Premium features on the self screen vs free

### Takeaway
The free self screen keeps the daily reading and a basic chart. Premium sells three things: depth (full chart reading, personal transits, year ahead), questions (Ask the Stars / Void, Prashna) and relationships.

### Cited Findings
- **Co-Star** in-app purchases — [App Store, Co-Star](https://apps.apple.com/app/id1264782561):
  - Pro-Star: $8.99 a month
  - Advanced Chart: Self: $8.99
  - Advanced Chart: Relationships: $8.99
  - Your Year Ahead: $11.99
  - Eros: $6.99
  - Question packs: $2.99 to $6.99
- **The Pattern**: Go Deeper+ costs $14.99 a month or $83.99 a year. It adds unlimited Bonds, Time Travel, Romantic Timing and conversations. The free tier keeps daily updates and some Cosmic Climate chapters — [App Store, The Pattern](https://apps.apple.com/app/the-pattern/id1071085727). Deeper transit explanations were paywalled in 2024 — [Bustle](https://www.bustle.com/life/pattern-app-review-features-price)
- **CHANI**: $11.99 a month or $107.99 a year — [App Store, CHANI](https://apps.apple.com/us/app/-/id1532791252). Third-party listings say the birth-chart overview is free, while detailed readings and daily personal transits are paid. That split comes from a search summary and is lower confidence.
- **Align27** — [App Store, Align27](https://apps.apple.com/us/app/id1364184571):
  - Subscription: $9.99 a month or $79.99 a year
  - Annual horoscopes sold separately ($7.99 for 2026)
  - 1 Question: $9.99
  - Panchapakshi: $29.99
- **Sanctuary**: Sanctuary+ adds yesterday's and tomorrow's horoscopes plus weekly and annual forecasts, at about $14.99 a month or $49.99 a year. Live readings are bought separately. This comes from a search summary of the App Store listing ([apps.apple.com id1417411962](https://apps.apple.com/do/app/astrology/id1417411962)). Launch pricing in 2019 was $19.99 a month — [Fortune 2019](https://fortune.com/2019/03/23/new-astrology-app-sanctuary/)
- **AstroSage**: astrology tools are free, and human consultations are paid — [App Store, AstroSage](https://apps.apple.com/app/id824705526)

### Inferences
- Premium self content is priced at roughly $9–15 a month. Co-Star sells "Your Year Ahead" and "Advanced Chart: Self" as separate self-screen products.

### Gaps
- The 2026 free/paid split of the CHANI and Co-Star self screens was not checked first-hand.
