# User-customizable card dashboards and calm, spacious tablet-first design (evidence for Self dashboard v3)

Research date: 2026-11-09. Scope: evidence for and against (1) user-picked card set (~8 from a catalogue, then +/remove/reorder), (2) user add/remove of sections inside a card with defaults, (3) dropping a dense top summary strip for wide, spacious cards on iPad, (4) carousels with chips/dots on tablet.

## Q1. What does research say about customization vs. defaults, choice, autonomy, and pick-your-interests onboarding?

### Takeaway
The evidence favours a strong designer-chosen default that users can then edit, not a blank "build your own" start: most users never change defaults, NN/g repeatedly finds customization tools are under-used and hard to use, and an unconfigured experience must stand on its own. Choice overload is real only under specific conditions (complex sets, unclear preferences), so a catalogue of ~8-15 well-described cards with pre-selected defaults is defensible; autonomy (SDT) and the IKEA effect support offering editing, provided the edit succeeds and is optional.

### Cited Findings
**Customization vs personalization (NN/g)**
- Customization is user-done (user configures layout, content, settings); personalization is system-done. "Customization gives control to the user and personalization gives control to the site." (Amy Schade, 10 Jul 2016) — [NN/g: Customization vs. Personalization](https://www.nngroup.com/articles/customization-personalization/)
- Customization suits users who know their goals well; personalization suits users who "do not know exactly what they need and must filter through a large information space." — [NN/g](https://www.nngroup.com/articles/customization-personalization/)
- Many users don't know what they need and won't bother configuring; customization has a higher interaction cost; both need ongoing maintenance; neither "should ... be used as a fix for a broken site"; designers should not add many options to dodge prioritizing a solid base design. — [NN/g](https://www.nngroup.com/articles/customization-personalization/)
- "7 Tips for Successful Customization" (Schade, 14 Aug 2016): users often don't customize even when tools are clear and simple; tweaking the system is "only a secondary task, at best"; "Generic site experiences, with no customization, should be strong enough to support users"; avoid leaving users with an empty screen because they skipped setup; place customization links near the related content with clear labels; keep setup simple; use progressive disclosure for options (common first, advanced on a secondary screen, omit tertiary); let users change selections later; validate with prototype usability tests, not by asking if users are interested. — [NN/g: 7 Tips for Successful Customization](https://www.nngroup.com/articles/customization/)
- Exception NN/g allows: a brief, focused setup question that significantly streamlines the experience (e.g., Google Play Music asking favourite genres, with a Skip option). — [NN/g](https://www.nngroup.com/articles/customization/)
- NN/g's customization report tested customization on 7 websites with representative users and found difficulty with adding content and tools. — [NN/g report: Customization Features Done Correctly](https://www.nngroup.com/reports/customization-features/) (search snippet only; report is paywalled, not read in full)

**"Most users never change defaults"**
- Jared Spool (UIE, Sept 2011): in an MS Word study where participants emailed their settings file, fewer than 5% had changed any setting; >95% kept install defaults; interviewed users assumed Microsoft shipped those settings for a reason. Caveat: self-selected sample, old desktop software, method details not published in full. — [UIE: Do users change their settings?](https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/)

**Choice overload / Hick's law**
- Scheibehenne, Greifeneder & Todd (2010, J. Consumer Research 37): meta-analysis of 63 conditions from 50 experiments (N = 5,036) found a mean choice-overload effect near zero; identified preconditions but no sufficient conditions. — [Scheibehenne et al. 2010 PDF](https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf)
- Chernev, Böckenholt & Goodman (2015, J. Consumer Psychology): 99 observations (N = 7,202); with four moderators included (choice-set complexity, decision-task difficulty, preference uncertainty, decision goal) the assortment-size effect on overload is significant. — [Chernev et al. 2015, ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1057740814000916); the two camps dispute each other — [Scheibehenne reply](https://scheibehenne.com/ReplyToChernevBoeckenholdtGoodman2010.pdf)
- Hick's law (Hick, 1952): decision time grows with log2(n+1) for n equally likely options; it covers deciding, not doing. — [Jakob Nielsen, Progressive Disclosure (Substack)](https://jakobnielsenphd.substack.com/p/progressive-disclosure)
- Progressive disclosure: show only the few most important options first, defer secondary ones; improves learnability, efficiency and error rate. — [NN/g: Progressive Disclosure](https://nngroup.com/articles/progressive-disclosure/)

**IKEA effect**
- Norton, Mochon & Ariely (2012, J. Consumer Psychology 22(3):453-460): across four studies (IKEA boxes, origami, Lego) people valued things they built more than identical pre-built items (e.g., bids $1.46 for completed vs $0.59 for incomplete builders); the effect vanished when the task was not completed or the creation was destroyed. — [Harvard DASH: The IKEA Effect](https://dash.harvard.edu/handle/1/12136084)

**Autonomy / Self-Determination Theory in UX**
- Peters, Calvo & Ryan (2018, Frontiers in Psychology 9:797) propose METUX, grounding UX in SDT needs of autonomy, competence and relatedness; autonomy = feeling agency and acting in line with one's goals/values; they warn that engagement/enjoyment do not necessarily produce sustainable wellbeing; they provide questionnaires to measure need satisfaction across six spheres. — [Frontiers / PMC5985470](https://pmc.ncbi.nlm.nih.gov/articles/PMC5985470)

**Pick-your-interests onboarding**
- Pinterest requires new users to choose topics (most sources say at least 5) from an image+keyword grid before showing the home feed; ex-growth lead Casey Winters says they switched from "follow people" to "What topics do you care about?" because the product must know interests to show value. Sources are secondary blogs/case studies. — [Omega Point: Pinterest's Interest Picker](https://omegapoint.systems/growth-studies/pinterest-interest-picker); [Intercom podcast](https://www.intercom.com/blog/podcasts/expert-advice-improving-user-onboarding/)
- Google Play Music genre picker with Skip cited by NN/g as an acceptable focused setup step. — [NN/g](https://www.nngroup.com/articles/customization/)

### Inferences
- Move (1) is supported only in a "smart default + edit" form: pre-select ~8 recommended cards (ideally chosen from the person's own chart, i.e., personalization) and let the user deselect/add, with Skip. Forcing a from-scratch pick risks the NN/g empty-state failure and the >95% non-changers.
- The IKEA effect requires completion: the picker must end in a visibly finished dashboard; partial or failed builds would erase the benefit.
- Choice overload moderators (preference uncertainty, set complexity) apply strongly here: users of an astrology assistant likely do not know what "Argala" or "Dasha" cards mean, so each catalogue item needs a plain-language one-line benefit, and grouping the catalogue (e.g., by life area) lowers complexity.
- For move (2) (sections inside a card), progressive disclosure is the better-supported pattern than open-ended section editing: sensible default sections, "more" behind a disclosure, with a light per-card "show/hide sections" option for the minority who want it.
- Pinterest's 5-topic minimum is the best-documented number; ~8 default cards is in a plausible range but no source tests 8 specifically.

### Gaps
- No peer-reviewed study found that tests the optimal number of picks in an interest/card onboarding picker; "8" is unvalidated.
- Could not verify a widely repeated Spotify figure (removing onboarding signals raises new-user recommendation error ~13.8%); excluded.
- NN/g's full customization report (46 guidelines) not read (paywalled).
- No recent (2023-2026) replication of the "<5% change settings" finding located; mobile-app-specific customization uptake rates not found.

## Q2. Which products let users compose their own dashboard, and how exactly?

### Takeaway
Nearly every major health/wellness dashboard ships a designer-chosen default and offers an edit mode (Edit/pencil -> toggle items -> drag handles -> Done); none found force a blank start. Several (Whoop, Samsung Health, Oura) moved from fixed to editable home screens after user complaints, which is evidence that users who care do want control, but the edit is secondary.

### Cited Findings
- **Apple Health (iOS 18+): "Pinned"** (formerly "Favorites" in iOS 13-17). On Summary, tap Edit next to Pinned, tap categories to add/remove, tap Done; or open a data type and tap "Add to Favorites"/pin (star). An older guide says pinned items could not be reordered (may be outdated). — [Apple Support: Use the Health app](https://support.apple.com/en-ca/HT203037); [iGeeksBlog guide](https://www.igeeksblog.com/how-to-use-health-app-on-iphone/); [iPhoneLife iOS 13 guide](https://iphonelife.com/content/tip-day-how-use-dashboard-your-health-app)
- **Apple Fitness (iOS 18+): "Edit Summary"** at the bottom of the Summary tab; tap a card, swipe through card options, "Swap Current Card"; Apple's current guide says metrics can be edited, moved and removed (a 2024 Digital Trends piece said removal was not possible; later sources describe a minus icon on each card). — [Apple Support: See your activity summary in Fitness](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios); [Digital Trends](https://www.digitaltrends.com/phones/how-to-customize-the-apple-fitness-app-in-ios-18/); [iDrop News](https://www.idropnews.com/how-to/how-to-customize-your-iphones-fitness-summary/227225/)
- **WHOOP Home: "My Dashboard"** section; tap the pencil in the section header, choose metrics to show/hide, drag tiles to reorder. Earlier community posts said Home could not be customized (feature added later). — [WHOOP: The All-New Home Screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/); [WHOOP community](https://www.community.whoop.com/t/can-i-customize-my-home-screen/570)
- **Oura**: Today-tab Shortcuts row can be customized (swipe the shortcuts, tap Customize; minimum of three kept); Vitals tab: pencil icon top-right, drag categories, Done. App redesigned Oct 2025. Full Today card list reordering not documented. — [Oura Support: How to Use the Oura App](https://support.ouraring.com/hc/en-us/articles/360058599753-How-to-Use-the-Oura-App); [Oura blog: new app design](https://ouraring.com/blog/new-oura-app-experience/); [9to5Google, 20 Oct 2025](https://9to5google.com/2025/10/20/oura-app-redesign/)
- **Garmin Connect "Edit My Day"**: at the bottom of My Day, tap Edit My Day; reorder via drag handles (three lines), hide cards; a "Restore Dismissed Cards" option exists. Sources are 2019-2021 forums. — [Garmin forums](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/116591/choose-or-rearrange-the-my-day-widgets); [Wareable guide](https://www.wareable.com/garmin/how-to-run-better-with-garmin-connect)
- **Fitbit app**: Edit (top right) -> select/deselect Today items; reorder by long-press until vibration then drag; after the 2022-23 redesign users reported only "X" delete and group-level up/down arrows, not item reorder. — [Android Central](https://androidcentral.com/how-customize-home-screen-your-fitbit-app); [Fitbit community](https://community.fitbit.com/t5/Charge-5/How-do-I-rearrange-the-tiles-on-the-new-Fitbit-app/td-p/5492634)
- **Samsung Health (phone)**: 2024 community threads complain the home is filled with promoted "Interests" content and ask for customization; no official "manage items" documentation found. Galaxy watches let users add up to 15 tiles. — [Samsung community](https://us.community.samsung.com:443/t5/Samsung-Apps-and-Services/Samsung-Health-Home-remove-Interests-and-allow-us-to-customize/m-p/2950901); [Samsung: Manage tiles on watch](https://www.samsung.com/us/support/answer/ANS10002835/)

### Inferences
- The convergent interaction grammar is: default set -> one "Edit"/pencil entry point placed with the content -> toggle list (in/out) -> drag handles to reorder -> Done; plus an "add from detail page" (Apple Health pin star) shortcut. A "+" tab at the end of the carousel matches the "near the content" NN/g tip.
- User backlash where editing was missing (Whoop, Samsung, Fitbit redesign) suggests removing control from a power-user minority costs goodwill, even if most never edit.
- Oura's "keep at least three" floor is a useful guard against empty dashboards.

### Gaps
- iOS widget/Smart Stack edit mode, Notion, Apple Stocks and Apple Home edit flows not verified with sources in this pass (known from general knowledge: jiggle mode, "+" widget gallery, Smart Stack "Smart Rotate"/"Widget Suggestions"), so not cited.
- Samsung Health "Manage items" could not be confirmed in current documentation.
- No published usage stats from any of these vendors on what share of users edit their dashboard.

## Q3. Evidence on density, whitespace, line length, card width, Apple HIG for iPad, calm technology

### Takeaway
Margins/whitespace around text measurably help reading speed, comprehension and satisfaction; line lengths around 50-75 characters (WCAG: <=80) are the common target; Apple's HIG says to order by importance, group with negative space, use progressive disclosure, and use readable-width layout guides on wide screens, which supports wide but text-capped cards rather than a dense strip. Calm-tech principles (smallest possible attention, inform without overwhelming) align with removing the summary strip.

### Cited Findings
- Chaparro et al. (Usability News/SURL vol. 6, Jul 2004), four white-space layouts: margins around text improved both reading speed and comprehension vs no margins, and were preferred; leading (line spacing) did not change performance but affected preference. — [ERAU portfolio: Reading Online Text](https://portfolio.erau.edu/en/publications/reading-online-text-a-comparison-of-four-white-space-layouts/)
- A widely repeated "white space boosts comprehension ~20%" figure has no traceable source. — [Hurleywrite blog](https://www.hurleywrite.com/?p=2053) (flagged unverified)
- Baymard: optimal body line length 50-75 characters (citing Ruder 50-60); WCAG 1.4.8 (AAA): <=80 characters (<=40 CJK). Studies disagree (40 to 100+ chars) and line length interacts with other variables. — [Baymard: line length readability](https://baymard.com/blog/line-length-readability); [HN discussion of studies](https://news.ycombinator.com/item?id=5193835)
- Apple HIG Layout (updated 9 Sep 2026): "Order content by relative importance"; "Group related items ... you might use negative space, container shapes, or separator lines"; "Use progressive disclosure to make layouts cleaner ... An interface with too much content and too many choices makes it harder to find information quickly"; layout by size class, not device; "Keep functionality the same as size classes change" but you can change how much is visible; larger spaces may switch tab bar to sidebar; system layout guides "restrict the width of text for optimal readability." — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- UIKit readableContentGuide: an area "that can easily be read without forcing users to move their head to track the lines," width capped by the readable width for the current Dynamic Type size; use its width to size columns. — [Apple: readableContentGuide](https://developer.apple.com/documentation/uikit/uiview/readablecontentguide)
- Apple HIG tvOS grids (analogous large-screen guidance): consistent spacing; keep partially hidden off-screen content symmetrical to direct attention to the fully visible item. — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- Calm Technology principles (Amber Case): require the smallest possible amount of attention; inform without overwhelming; use the periphery; keep working when it fails; use minimum technology needed; respect social norms. — [calmtech.com](https://calmtech.com/)

### Inferences
- Wide cards on iPad should be wide in container but text-capped (~50-75 chars per line, e.g., two text columns or text + visual inside one card) rather than full-bleed text lines, per readableContentGuide and Baymard.
- A dense top summary strip conflicts with HIG "too much content and too many choices" and calm-tech "inform without overwhelming"; its job (at-a-glance) can be served by a single headline line per card or by the carousel chips.
- Chaparro supports generous margins as a performance (not just aesthetic) gain.

### Gaps
- Weiser & Brown's "Designing Calm Technology" (1995/96) original not fetched; dates from general knowledge only.
- No study found specifically on dashboard card width or density on tablets; no sourced optimal card width.
- Amber Case's book date (Calm Technology, O'Reilly, ~2015) not verified in this pass.

## Q4. Carousel usability: when user-driven carousels work and what controls are needed

### Takeaway
Carousels underperform as auto-rotating hero banners (later frames missed, 46% of e-commerce carousels have issues), but user-driven carousels of related, prioritized items work when they support swipe, show a peek of the next item, show position/count, have large visible arrows as backup, and use labelled controls (chips/thumbnails) rather than bare dots. Keep important content reachable another way.

### Cited Findings
- NN/g (Pernice, 2013; reviewed 7 Aug 2026): users often scroll past carousels and miss non-first frames; keep 5 or fewer frames; show how many frames and which is current; numbers and dots give little hint of what they reveal, so prefer recognizable labels/icons; put controls inside the carousel; large clickable arrows visible over busy backgrounds; avoid auto-forward on mobile; signal more content by showing part of the next frame; swiping through many frames on mobile is tiring; dots are weak cues and easily missed; important content should also appear elsewhere. — [NN/g: Designing Effective Carousels](https://www.nngroup.com/articles/designing-effective-carousels/)
- NN/g mobile carousels (19 Aug 2018): users should reach the last item in 3-4 swipes/taps, otherwise use a list; partial "peek" items are among the strongest cues; dots are small, low-contrast, hard to tap, so poor as primary control; must support swipe; leave a gutter so iOS edge swipes don't trigger Back; put the most-wanted items first and consider personalizing order. (Expert review, no formal study.) — [NN/g: Mobile Carousels](https://www.nngroup.com/articles/mobile-carousels/)
- Baymard (2019, updated 3 Apr 2025): 46% of e-commerce homepage carousels have UX issues; don't auto-rotate on mobile/touch; provide obvious high-contrast prev/next controls and indicators alongside swipe, not instead; in Staples' app many users missed the three-dot indicators; first slide gets most exposure; don't make slides the only route to key features. — [Baymard: Homepage Carousel](https://baymard.com/research-articles/homepage-carousel)

### Inferences
- For a Self carousel on iPad: no auto-rotation; peek the neighbouring card; labelled chips (card names) as the primary navigator with dots at most secondary; arrows as backup for pointer/keyboard; a position indicator ("3 of 8"); and an overview/grid or list route so cards are not only reachable by swiping.
- NN/g's 5-frame / 3-4-swipe guidance argues that ~8 cards is at the upper edge for pure swiping; chips that jump directly to a card mitigate this. Letting users choose and order cards also satisfies NN/g's "put the most wanted first."

### Gaps
- No tablet-specific carousel research found (NN/g says nothing tablet-specific); guidance is extrapolated from mobile and desktop.
- No evidence found on chips vs dots tested head-to-head.

## Q5. Risks of customization and mitigations

### Takeaway
Main risks: most users never customise (so the default is the product), empty or broken states if setup is skipped, hard-to-find/hard-to-use edit tools, and ongoing maintenance cost of a catalogue. Mitigations with support: strong personalized defaults, Skip on setup, minimum card floor, edit entry point next to content, restore/reset option, and testing with prototypes.

### Cited Findings
- Low uptake and effort cost; customization reaches fewer users than personalization. — [NN/g](https://www.nngroup.com/articles/customization-personalization/); [NN/g tips](https://www.nngroup.com/articles/customization/)
- Avoid empty screens for users who skip setup; generic experience must be strong. — [NN/g tips](https://www.nngroup.com/articles/customization/)
- >95% keep defaults (2011 Word study). — [UIE](https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/)
- Both customization and personalization require ongoing maintenance as preferences change. — [NN/g](https://www.nngroup.com/articles/customization-personalization/)
- Guards seen in products: Oura keeps at least three shortcuts ([Oura Support](https://support.ouraring.com/hc/en-us/articles/360058599753-How-to-Use-the-Oura-App)); Garmin offers "Restore Dismissed Cards" ([Garmin forums](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/116591/choose-or-rearrange-the-my-day-widgets)).
- Interest gating can block value: Pinterest shows no feed until topics are chosen (works for them because the feed depends on it). — [Omega Point](https://omegapoint.systems/growth-studies/pinterest-interest-picker)
- Focus-group interest does not predict use; test prototypes. — [NN/g tips](https://www.nngroup.com/articles/customization/)

### Inferences
- Recommended shape: personalized default set of ~8 pre-selected in the picker (user can accept in one tap), Skip leads to the same default, "+" tab and per-card Edit for later changes, a minimum card count, and "Reset to recommended."
- Each catalogue card adds build, QA and copy maintenance; a smaller well-crafted catalogue is cheaper and reduces choice-overload moderators.

### Gaps
- No quantitative data on maintenance cost of card catalogues or on retention impact of customizable vs fixed dashboards in consumer wellness apps.
