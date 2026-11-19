# 12 · Phone card layout v2: header with the brand and the card title, three view bars, an always-there input

Written 2026-11-18 from Sachin's notes on the mock-up. Supersedes the phone parts of doc 09 and the "Chat is a third
face" part of doc 85 (the chat input is now always on the card; the three bars are Read, Analysis, Calendar).

## 1. Start (checked)

- Header (`TopNavigation.tsx`): menu button, logo, a board slot (doc 09), usage ring, notification bell, avatar menu.
  The card chips row and the next-card peek still sit in the board (`BoardV3.tsx`, `CardChips`, Carousel `peek`).
- A card (`CardFrame.tsx`) shows Read / Short as a switch, then its text; card chat (doc 85) is a third face with its
  own input; the old Calendar / Table / Breakdown tool panels were removed in the foundation release (doc 79), their
  feature keys are off.
- The card payload already carries what the new views need: `periods`, `keyDates`, `rail`, `standing`, `v3` spans,
  `agreement`, and the Oracle details (`ChartDetails`).

## 2. End goal (phone, under 768 px)

- **Header, one thin row:** left, the logo and the product name **AdAstraAI** (enough width; never clipped); middle,
  the **card title** with `▾` and `3/11` (tap: "All cards" grid sheet, each tile with its art and a dot for new); right,
  **Messages**, **Bell**, **General Reading chat bubble** (carries the questions-left count the usage ring showed) and
  the **avatar**. The avatar opens a **full-screen menu**: dashboards (the person's chosen ones), profile, personalize,
  plans and usage, settings, sign out. The side menu button goes; the full-screen menu is the navigation.
- **Pull down for the titles (Sachin, 2026-11-18):** pulling down on the card (only when the card's own scroll is at
  the top) reveals a strip of card **titles only** under the header. A title can be tapped, or the strip swiped or
  dragged left and right; the selected title is the card on screen and the card follows live. Swiping the cards left
  and right keeps working and moves the strip's selection too. The strip collapses on selection, on pulling back up,
  or after a few seconds. This replaces the "All cards" grid from the header title; the header title only shows the
  current card name and `n/11`.
- **Under the header:** a thin 4 px progress strip (one tick per card).
- **The card:** full width, **no side peek**, swipe left/right between cards; page never scrolls; the card's text
  scrolls **inside** it (`overscroll-behavior: contain`).
- **Three wide bars across the card top:** **Read** · **Analysis** · **Calendar**. Read = the card's reading (the
  headline, one step, then the rest on scroll; the old Short is the top of Read). Analysis = why we think so: the
  chart details, the agreeing and testing systems, the ladder. Calendar = the card's dated windows and key dates as a
  month calendar plus the list (dates come from the Oracle and Personalizer as stored; none computed in the app).
- **Input:** a thin one-line textarea (mic and send inside it) **always anchored to the card's bottom**, above the
  phone keyboard. Typing starts the card's conversation: the first question goes through Clarify (doc 85, decided
  2026-11-18), answers stream into the card over the current view with a "Back to card" chip; the conversation stays
  on the card. The card's own text is the preamble.
- Tablet and desktop keep the current board; the three bars and the anchored input apply there too where they fit.

## 3. Deliverable (web only; no server change)

`TopNavigation.tsx` (brand left, board slot middle, icons right, usage count onto the chat bubble), new full-screen
`ProfileMenuSheet` (replaces the dropdown on phone, hosts dashboard navigation from `portalDashboards`),
`BoardV3.tsx` + `CardChips` (chips row gone on phone; header title opens `AllCardsSheet`), Carousel (`peek` off on
phone, progress strip), `CardFrame.tsx` (three bars, scroll container with `overscroll-contain`), new `AnalysisView`
and `CalendarView` (read `card.periods`, `keyDates`, `rail`, details), `components/cardChat/*` (input anchored on the
card, conversation overlay with back chip; keep the clarifier path), tests, and doc 85 note.

## 4–9. Architecture, steps, phases, recommendation

Steps: header → progress strip and no peek → three bars with Analysis and Calendar views → anchored input and
conversation overlay → full-screen profile menu → tests → release. One phase; verify with a phone screenshot. Chosen
design: the header carries the brand, the card title and the four actions so the card gets the whole screen; the
three bars replace Read/Short/Chat; the input is always there so asking is one tap.
