# 11 · The person chooses which dashboards their portal shows

Written 2026-11-18 at Sachin's request: "Add a screen in the personalization wizard where the user selects which
dashboards they want to see on their portal, and respect their choice. Self, Love and Career are selected by default."

## 1. Start (checked)

- Boards today: You (`/dashboard/you`), Love (`/dashboard/love`), Work (`/dashboard/work`), Lucky times
  (`/dashboard/lucky`). Love and Work run on the v3 board (doc 10) with lenses: Love — dating, marriage, friends,
  allies; Work — career_start, primary_job, hobby, business. Navigation: `SideNav` and `BoardTabBar` (web), header
  "Happy Hour(s)" link to Lucky.
- The personalization wizard is `AIAstra_WEB/src/pages/welcome/WelcomeWizard.tsx` (also opened from the profile menu).
  Facts are stored in `person_facts` through the profile route (`FACT_CATALOG` in `src/profile/facts.ts`).

## 2. End goal

A wizard screen "Which dashboards do you want to see?" lists: **Self, Love, Career** (ticked by default), the eight
focused dashboards (Dating & romance, Marriage & partnership, Friendships, Professional allies, Starting out, Your
job, Craft & hobby, Business) and Lucky times (unticked by default). At least one must stay ticked. The portal shows
only the chosen dashboards: side menu, board tab bar and header link. A chosen focused dashboard has its own menu entry
that opens its board on that lens (`/dashboard/love?lens=dating`). A person who never answered sees the default three
(plus everything they already use is unaffected until they answer). The choice can be changed any time in the wizard.

## 3. Deliverable

- Server: `FACT_CATALOG` key `portal.dashboards` (multi-value list of ids: `self, love, work, lucky, dating, marriage,
  friends, allies, career_start, primary_job, hobby, business`), validated like other list facts; returned with the
  profile facts. No migration (person_facts is key/value).
- Web: a wizard step (first-run and re-open), `lib/portalDashboards.ts` (read the fact, default `self, love, work`),
  `SideNav`, `BoardTabBar` and the header Lucky link filtered by it; focused entries deep-link to the lens; the board
  page honours `?lens=` on open (saves it as the board's lens).
- Tests on both sides.

## 4. How it works when done

GET profile facts → web resolves the portal list (fact or default) → navigation renders only those entries. A direct
URL to a hidden board still works (no lock-out), it is just not in the menu. Saving the wizard step writes the fact
(PUT profile facts) and the menu updates at once.

## 5–8. Architecture, ingredients, steps, phases

One additive fact key, one wizard step, three navigation filters, one `?lens=` reader. No env change. Steps: server
fact → web lib + wizard step → nav filters → lens deep link → tests → release (develop → release-candidate-staging).

## 9. Recommendation

Store the choice as one person fact and filter navigation from it; keep boards reachable by URL so nothing breaks.
