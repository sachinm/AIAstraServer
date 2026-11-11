# 71. The card picker gets art, and every card gets options

Status: **plan written 2026-11-10, built on `feat/card-picker-art` (web) and `feat/card-options` (server).** No paid
model call is made by anything here. No deploy: that goes through the deploy session.

Asked by Sachin (2026-11-10), with a screenshot of the Self board's "Your cards" picker:
"the selection of the cards on each board - add some graphics to fill the space - add some default card design maybe
and maybe a background synonymous with the category topic - for the Dashboards: SELF, LOVE, WORK. And also we talked
about having another configuration within each card, the card content formulation with a few options what users want
to see."

## 1. Start (checked 2026-11-10 on `develop` in both repos)

1. **Self picker.** `src/pages/you/v3/Picker.tsx` (web) renders the catalogue as plain dark text tiles in four groups
   (Body, Mind, Character, Indian lens, and Time when offered). Ten of 26 cards say "Coming soon". Wide screens leave
   most of each tile and most of each row empty. No image, no icon, no category colour.
2. **Per-card configuration today** is the "Edit sections" sheet: seven section switches (In a line, Your year, This
   stretch, Is this right?, Your pattern, The ladder, Chart details), two always on. It is stored in
   `board_layout.sections` and applied on the web by `cardSections()`. It is a list of parts, not a choice of how the
   card reads.
3. **Layout store.** `board_layout` (server, Prisma `BoardLayout`) already has a `board` column (`self | love | work`)
   and the unique key `(kundli_id, board)`. Only `self` rows are written today (`PUT /api/self/v3/layout`).
4. **Love and Work** have no picker. Doc 69 (approved 2026-11-09) gives them a ten- and nine-card catalogue on the
   v3 card machinery, but none of it is built and it is blocked on doc 68 Phases A and B. Today Love is
   `AreaBoardView` over `GET /api/area/love` (findings tagged by sub-area: meet, romance, commitment, delay, health,
   strain, reconcile, family_accept, friends) and Work is `WorkPage` over `GET /api/area/career` (windows tagged by
   sub-area: get_job, job_change, promotion, job_security, abroad, pay, business).
5. **Light mode** is `html.light`; Tailwind colour classes get light values from the generated
   `src/theme-light.css`. Anything drawn with CSS variables needs its own `html.light` block (as `loading-veil.css`).
6. **Art rule** (2026-11-09): image models failed at exact labels; draw anything exact in code. No paid image call.

## 2. End goal

Opening "Your cards" on Self, Love or Work feels like choosing from a designed deck: every card has a picture that
says its topic before you read it, each category has its own colour and backdrop, and the page has no dead space.
Chosen, suggested and coming-soon cards look different at a glance. Each chosen card has a small "How this card
reads" choice (length, view, words, plan) that is saved with the board and changes what the card shows.

What can no longer happen: a picker that looks like a list of empty boxes; a coming-soon card that looks pickable; a
card option that is saved but silently ignored.

## 3. Deliverable

1. A shared web picker (`src/components/boardCards/`) used by all three boards, with drawn category art for nine
   themes (Body, Mind, Character, Indian lens, Time, Love's three groups, Work's three groups) and a glyph per card.
2. Card options stored in `board_layout.options`, validated by the server, applied by the server's response and by
   the web board, with a plain note on each card where an option cannot be honoured yet.
3. Love and Work catalogues on the server (doc 69 card ids), a layout route for them, and the Love and Work boards
   showing only the person's chosen cards with their options.
4. Tests on both sides; screenshots in light and dark, desktop and phone, in `docs/screenshots/71-card-picker/`.

## 4. How it works when done

### 4.1 The picture on each card (web)

- **Drawn in code, no image files, no model.** `CardArt` is an inline SVG: a category gradient, a category backdrop
  pattern, and the card's glyph (a lucide icon, already a dependency) large and soft in the art band.
- **Nine themes**, each a colour pair and a backdrop motif that says the topic:

  | Theme | Colours | Backdrop |
  |---|---|---|
  | Body | coral to amber | a pulse line under a low sun |
  | Mind | indigo to sky | ripples spreading from a point |
  | Character | violet to gold | a small constellation |
  | Indian lens | saffron to maroon | an eight-petal lotus mandala |
  | Time | teal to deep blue | orbit arcs with a moving point |
  | Love: you two / meeting / family | rose to magenta | two overlapping rings and petals |
  | Work: standing / money / growth | emerald to gold | rising steps on a fine grid |

- **Glyph per card**, e.g. Body & energy a bolt, Sleep a moon, Blood a drop, How you think a brain, Mood a cloud and
  sun, Practice & deity a lotus, Saturn's passage an orbit, Meeting someone a heart with a spark, Money coming in
  coins, The next move a rocket. The registry is `cardArt.ts`; an unknown id falls back to its group's glyph.
- **Light and dark** come from CSS variables in `src/styles/board-cards.css` with an `html.light` block: dark has
  deep saturated bands and soft light lines; light has pastel bands and darker lines. Text is never drawn over art
  except the small state labels, which sit on their own solid chip.

### 4.2 The picker layout (web)

- **Header**: title, lead, "Add the suggested", the count, and a **chosen tray**: the picked cards as small art
  thumbnails in order, so the top of the page is never empty and you see your board forming.
- **Each group** opens with a banner in its theme (art, title, one line on what the group covers), then its tiles.
- **Tiles**: an art band on top (88 px), then title, description, and the person's first line when read.
  Available tiles are full size; coming-soon tiles are a denser row of smaller tiles so they do not take the space.
- **States**, never colour alone:
  - *Chosen*: a teal ring, a check badge on the art, and the words "On your board".
  - *Suggested*: a star mark and "Suggested for you" on the art band.
  - *Coming soon*: greyed, desaturated art, a dashed edge, "Coming soon", and it cannot be ticked.
- **Phone**: each group is a horizontal swipe carousel with snap points and dots; the group names are chips at the top
  (Sachin's carousel rule). Tablet and desktop: grids, two to four across.
- **Product name** is untouched; no glow and no pill around words; depth only on the tiles (the house glass style).

### 4.3 Card options (what the person chooses)

Four choices per card, each with a default that equals today's card:

| Option | Choices (default first) | What it changes |
|---|---|---|
| Length | **The usual** · A glance · Deep | Glance: the line and the year rail only. Usual: today's default sections. Deep: adds Your pattern and, with a plan, The ladder. |
| View | **This year** · Now · The long arc | Year: every period of the twelve months. Now: only the period you are in. Long arc: the chapters of your life; only on the Time cards today. |
| Words | **Plain words** · With chart terms | Chart terms adds the Chart details section (the clocks and how many agree). Engine names are never shown either way. |
| Plan | **With a plan** · Without | Without: the "One step" line and The ladder are left out. |

- The options sit at the top of the card's sheet as "How this card reads" (segmented controls). The section switches
  stay below as "Fine-tune", so nothing that works today is taken away. Choosing an option rewrites that card's
  sections; a later section switch wins until the next option change.
- **Where it cannot be honoured yet, the card says so in one plain line**, from the server:
  - "The long arc is only on This chapter and Chapters for now." (any other card with View = The long arc; the card
    shows This year).
  - "Deep shows every part we have. Longer writing comes with a later reading." (Length = Deep on a card whose text
    is the stored length; the words are not rewritten without a new paid reading, which needs Sachin's yes).
  - On Love and Work, Words = With chart terms shows the clock badges already on those boards; Plan has no effect
    where the board has no step line, and the card says "This board has no plan lines yet."

### 4.4 Backend

1. **Store.** One additive column, `board_layout.options jsonb not null default '{}'` (migration
   `20261110_board_layout_options`). Shape: `{ [cardId]: { length, view, words, plan } }`, only for cards the person
   changed. An old row reads as `{}`: every card on its defaults.
2. **Validate** (`src/reading/boards/cardOptions.ts`, shared by all boards): unknown option or value → 400
   `unknown_option`; options for a card not on the board are dropped; missing keys take the default.
3. **Derive sections** (Self): `sectionsFor(options)` gives the section list in §4.3; `PUT /api/self/v3/layout`
   writes it into `sections` for a card whose options changed in that request, unless the same request also sets that
   card's sections.
4. **Honour on read** (Self): `GET /api/self/v3` returns `layout.options` and, per card, `options` (effective) and
   `optionNotes` (the plain lines above). View = Now keeps only the current period in `v3.spans` and the rail;
   Plan = Without empties each span's `step` and drops `ladder`. Nothing astrological is computed: it is a filter
   over stored rows.
5. **Love and Work** (`src/reading/boards/catalogue.ts`): the doc 69 cards as rows `{ id, board, group, title,
   description, suggested, subareas, offered }`. A card is offered when today's board has sub-areas that feed it;
   the rest are "Coming soon" until doc 69 is built. Routes, mounted always (no model call):
   `GET /api/board/:board/v3/catalogue` and `PUT /api/board/:board/v3/layout` for `love | work`, and
   `GET /api/board/:board/v3/layout`. The page reads the layout beside the area answer (two small parallel requests);
   the area routes are left as they are, so nothing changes for a person who has not chosen.
6. **Mapping, Love**: Where love stands → all sub-areas; Meeting someone → meet; Why it is taking time → delay; How
   things are between you → health, romance; Distance or tension → strain; Family and in-laws → family_accept;
   Commitment → commitment; Getting back together → reconcile; Friendships → friends; The partner you draw → none
   (coming soon). **Work**: Where work stands → all; Money coming in → pay; The next move → job_change, abroad; What
   wears you at work → job_security; Recognition → promotion; Finding work → get_job; Your own venture → business;
   What to build and Leading people → none (coming soon).

### 4.5 API

| Route | Body / answer |
|---|---|
| `PUT /api/self/v3/layout` | adds `options?: { [cardId]: Partial<CardOptions> }`; answer layout carries `options` |
| `GET /api/self/v3` | `layout.options`; each card `options`, `optionNotes: string[]` |
| `GET /api/board/:board/v3/catalogue` | `{ cards: BoardCatalogueEntry[] }` (love, work) |
| `GET /api/board/:board/v3/layout` | `BoardLayoutView` with `options` |
| `PUT /api/board/:board/v3/layout` | `{ cards, options? }` → layout or 400 `{ error }` |

### 4.6 Frontend and what the person experiences

- **Self**: the picker opens with the art. A chosen card's sheet opens on "How this card reads"; a change saves and
  the card redraws at once (web applies the derived sections; the server's answer replaces it).
- **Love and Work**: a "Your cards" button in the board header opens the same picker in a sheet (fewer cards, Love
  or Work art), where each chosen tile has its own "Options".
  On first visit the board shows every sub-area as today (no picker forced: the board is not empty without a choice).
  Once chosen, the board lists only the chosen cards' sub-areas, in the chosen order, and each card's View sets that
  card's time filter (Now → active now, This year → next 12 months, The long arc → next three years); Words = Plain
  hides the technique badges and placements; Length = A glance hides the long reading text.

## 5. Architecture

```
cardArt.ts (id → theme, glyph) ─► CardArt (SVG) ─┐
BoardCardPicker (tray, banners, tiles, carousels) ┼─► Self Picker · Love "Your cards" · Work "Your cards"
CardOptionsSheet (length, view, words, plan) ─────┘
          │ PUT layout {cards, options}
          ▼
server: cardOptions.ts (validate, sectionsFor, shape) ─► board_layout.options
        catalogue.ts (love/work rows) ─► /api/board/:board/v3/*   (the page reads it beside /api/area/*)
```

## 6. Ingredients

lucide-react glyphs (installed), inline SVG, one CSS file with theme variables, one Prisma migration (additive), no
new dependency, no model or image call.

## 7. Action steps, in order

1. Server: migration and Prisma field; `cardOptions.ts` with tests.
2. Server: Self layout PUT/GET carry options; GET shapes cards and adds notes; tests.
3. Server: Love/Work catalogue and layout routes; tests.
4. Web: `cardArt.ts`, `CardArt`, `board-cards.css` (dark and light).
5. Web: `BoardCardPicker` (tray, banners, tiles, states, phone carousels); Self `Picker` uses it.
6. Web: `CardOptionsSheet` in the Self sections sheet; options in `selfV3Api`; tests.
7. Web: Love and Work "Your cards" with filtering and options; tests.
8. Screenshots light/dark, desktop/phone, into `docs/screenshots/71-card-picker/`.
9. File what is left in `docs/TODOS.md`; merge both branches into `develop`.

## 8. Development phases

- **Phase 1 (this change):** art, picker, options stored and honoured by filtering stored content; Love/Work pick
  sub-area cards on today's boards.
- **Phase 2 (needs Sachin's yes, paid):** the Personalizer writes to Length (a 15-word glance, a deep 120-word card)
  and Words (chart terms in the text), which changes the card cache key; one replay to price it.
- **Phase 3:** doc 69 Love/Work v3 cards replace the sub-area mapping; the catalogue rows and options carry over.

## 9. Recommendation

Build Phase 1 now as above: drawn SVG art with one shared picker for all three boards, and the four options applied
as filters over what is already stored, with a plain note where they cannot be honoured yet. It needs no paid call,
no image model and no new reading, and it is the same picker and options doc 69 will use, so nothing is thrown away.
