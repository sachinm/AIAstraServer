# 09 · Phone boards: header holds the board, the main area holds only the cards

Written 2026-11-18 from Sachin's phone screenshots (Chrome, Android, `/dashboard/you`).

## 1. Start (checked in AIAstra_WEB)

- **The page scrolls under the shell.** `Dashboard.tsx` holds its root to `h-dvh overflow-hidden`, but `html` and
  `body` are not locked (only `.public-frame` pages lock them in `index.css`). On a phone the body scrolls and
  rubber-bands: the header leaves the screen and dragging stretches the area under the footer.
- **The You board head takes about a third of a phone screen** (`SelfBoardV3.tsx`, `self-v3-head`): photo and "Self"
  title, the clock line, the fresh-reading button with its "Made … · Good until …" line, Edit and the settings gear,
  and then the dots under the deck.

## 2. End goal

On a phone the screen is: the app header, then the card chips carousel, then the cards carousel filling every
remaining pixel, then the footer sliver. Nothing scrolls or bounces except inside a card. Tapping a chip brings that
card into view (unchanged behaviour).

## 3. Deliverable

- `src/index.css`: `.app-frame` locks `html`/`body` like `.public-frame` (height 100dvh, overflow hidden,
  overscroll-behavior none).
- `src/pages/Dashboard.tsx`: the board shell carries `app-frame`; `main` uses `overscroll-contain`.
- `src/pages/TopNavigation.tsx`: the spacer becomes `data-board-header-slot`, a flex slot a board fills on a phone.
- `src/pages/you/v3/SelfBoardV3.tsx`: on a phone the head row is not drawn; the board title ("You"), a reading button
  and the settings gear are portalled into the header slot. The reading button opens a sheet holding what the head
  showed: the clock line with Change, the reading status, "Made … · Good until …", the fresh-reading control, the build
  status, Edit cards and the template switch. The dots under the deck are dropped on a phone (the chips carry
  "n of 11" and the arrows).
- Tests for the slot portal and the phone head.

## 4. How it works when done

- **UI (phone, under 768 px):** header `[menu][logo][You][reading][gear] … [usage][bell][avatar]`; main: chips row,
  then the deck at full height; footer sliver. Tablet and desktop are unchanged.
- **States:** a building or failed reading shows a dot on the reading button; the sheet shows the same words as today.
- No API change.

## 5–8. Architecture, ingredients, steps, phases

One web change, no server or env change. Steps: CSS lock → header slot → You board phone head → tests → release
(develop → release-candidate-staging → Amplify). Love, Work and Lucky get the same header slot when they move to the
v3 card frame (doc 83 extension).

## 9. Recommendation

Lock the page and move the board's own controls into the header on a phone, keeping one sheet for the reading
details. It returns about 200 px to the card on a 360 × 800 phone, with no feature removed.
