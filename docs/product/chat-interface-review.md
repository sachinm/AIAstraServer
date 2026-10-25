# Chat interface — review and targeted changes

Reviewed 2026-10-24 from the live web branch (`ChatSection.tsx`, `ChatMainArea.tsx`, `ChatLeftSidebarLayout.tsx`, `ChatRightSidebar.tsx`, `ChatSidebar.tsx`, `KundliDataCard.tsx`, `TopNavigation.tsx`). The chat page is the product; everything below is scoped to it. Changes are deliberately few and specific.

## 1. What works and must be kept

- Streaming already works end to end: placeholder bubble, token deltas, elapsed-time copy (`chatWaitCopy.ts`), done event with the final text. Keep the SSE channel; the reading engine adds events to it (file 04 §4).
- Three-column layout with a collapsed rail on each side (left 14 px rail / 72 px open; right 10 px rail / 60 vw open), mobile overlays, click-outside to close. Keep the structure.
- Markdown rendering with GFM tables, `@tailwindcss/typography`, horizontal scroll for wide tables on phones, image allow-list to https only.
- Thread list with titles from the first question, history loading, "new conversation" divider, speech input.

## 2. Problems observed (code-level)

| # | Problem | Where | Effect |
|---|---|---|---|
| 1 | **No auto-scroll to the latest message** on the live branch (`ChatMainArea` has no bottom sentinel; the older `main` version had `scrollToBottom`). | `ChatMainArea.tsx` | While an answer streams for 30 s the user has to scroll by hand; on send, the new question can be below the fold. |
| 2 | **Right sidebar opens at 60 vw** and pushes the chat to 40 vw on desktop; it shows raw D-1/D-7/D-9/D-10 tables with longitude strings. | `ChatRightSidebar.tsx` | Covers the reading; the content is for debugging, not for users. |
| 3 | **Ctrl/Cmd+Enter to send**; Enter inserts a newline. | `ChatSection.handleKeyDown` | Opposite of every chat app; users press Enter and nothing happens. |
| 4 | **Wait copy** says "Still consulting the model… 1–3 minutes". | `chatWaitCopy.ts` | Honest today, but it anchors the user on slowness; with stage events it should say what is being read. |
| 5 | **Quick questions** include remedies, mantras and "life purpose". | `ChatSection.quickQuestions` | Remedies and mantras are out of scope for readings; generic prompts produce generic answers. |
| 6 | **Answer bubble** = full prose at 97 % width with no hierarchy; summary and reasoning look the same. | `ChatMainArea` bubble classes | Users scan for "what/when" and cannot find it. |
| 7 | Header "Cosmic AI Astrologer · Online • Ready to guide you" and footer "Powered by Vedic AI • Trained on ancient astrological texts" are filler. | `ChatMainArea` | Space without information; the footer claim is also not something to assert. |
| 8 | Sidebar states reset on every page load; the left list is capped at `MAX_SIDEBAR_CHATS` with no search. | `ChatSection` state | Returning users re-open the same panels every time. |
| 9 | Theme is purple→pink gradient on near-black glass everywhere (buttons, user bubble, title). | Tailwind classes throughout | Reads as generic "AI app"; no Vedic identity; low contrast for long reading. |
| 10 | Placeholder text invites remedies; brand name in nav is "Cosmic Vedic". | `ChatMainArea`, `TopNavigation` | Scope and naming drift. |
| 11 | `prose-invert` on `bg-white/10` with `text-white`: body text is pure white on translucent black; long answers tire the eye. | bubble classes | Readability. |
| 12 | No message actions (copy, share, feedback), no per-reading permalink. | — | Users cannot keep or rate a reading. |

## 3. Targeted changes (in priority order)

### 3.1 Reading card (the main change; depends on templates, file 09)

Render AI messages that carry a `template` as a **Reading card**:

```
┌──────────────────────────────────────────────────────────┐
│ ◉  Work and money · next 12 months            [T3 · 32 s] │  ← understanding line (from `intent`)
├──────────────────────────────────────────────────────────┤
│ ANSWER (larger type, 2–4 sentences)                      │  ← streams first
│                                                          │
│ ▸ Now · until 24 Jul 2026   ▸ Eases · Aug 2026   ▸ Best · Nov 2026–Mar 2027 │  ← "When" strip from `windows`
├──────────────────────────────────────────────────────────┤
│ ## What is active now …                                   │  ← body markdown (template sections)
│ ## When it eases …                                        │
│ ## Next good phase …                                      │
│ ## Signs it is turning  1. … 2. … 3. …                     │
├──────────────────────────────────────────────────────────┤
│ ▸ How I read this  (collapsed; placements and charts)     │
│ 👍 👎  Copy  Save  Share                                   │
└──────────────────────────────────────────────────────────┘
```

- The frame appears on the `intent` event, the When strip on the `windows` event, text streams into the Answer block first (templates guarantee the Answer card is the first markdown block), stage chips ("Reading D-10 ✓", "Dasha ✓", "Transits …") sit where the bouncing dots are today.
- "How I read this" is a `<details>` rendered from the last section of the markdown; closed by default, remembers the user's preference.
- Older messages without a template render as today.

### 3.2 Scrolling and reading

- Bottom sentinel + `scrollIntoView` on new user message; during streaming, **follow only if the user is already within 120 px of the bottom**; otherwise show a "↓ New text" pill. Never yank the scroll while someone reads.
- Prose: `max-w-[72ch]` for body text inside the card, base 16 px (17 px on ≥ 1280 px), `leading-7`, `text-slate-100` not pure white, headings `text-amber-200/90`, tables `text-[15px]` with zebra rows, sticky table header inside the card scroll area.
- Dates rendered with a subtle monospace or tabular-nums class so windows line up.

### 3.3 Sidebars

- **Left (conversations)**: open width 280 px, rail 56 px; remember open/closed in `localStorage` per device; search box over titles; group by *Today / This week / Earlier*; each row shows subject tag chips (from `chats.subject_tags`) under the title; swipe-to-close on mobile; keyboard `[` toggles.
- **Right (your chart)**: open width 360 px (not 60 vw), rail 56 px; replace raw tables with **"Your chart at a glance"**: Lagna and Moon (sign, nakshatra), current MD–AD–PD with end dates, next period, running transits of Saturn/Jupiter/Rahu–Ketu by house, fortune tier (file 11 §4), and a link "Open full charts" to the Charts page. Data comes from `kundli_facts` once Phase 1 lands; until then from `myKundliDisplayData` reduced to these fields. Remember state; keyboard `]`.
- Both rails show a tooltip on hover and the same icon language (panel-left / panel-right).
- On mobile both sidebars are bottom sheets (drag handle, 85 vh), not side overlays.

### 3.4 Input and sending

- Enter sends, Shift+Enter newline (configurable in Profile for power users).
- Placeholder: "Ask about work, money, relationships, timing…" (no remedies).
- Quick questions become **subject chips** from the subject table (file 02): *Work & career · Money · Relationship · Marriage timing · Property · Health windows · This month · My nakshatras*. Tapping a chip inserts a suggested question and sets the intent hint.
- While a reading runs, the input is disabled with the stage text, not a spinner; "Stop" button cancels the stream (`AbortController` already wired).

### 3.5 Theme (astrology, not generic AI)

- Palette tokens: night indigo `#0E0F2A` background, deep plum surfaces `#1B1738`, saffron accent `#F2A93B` (primary buttons, active states), gold hairlines `#E8C77A/30`, vermilion for alerts `#D9534F`, text `#E9E6F7`. Retire the purple→pink gradient except on the landing page.
- Typography: Inter (or system) for UI; a Devanagari-capable serif (Noto Serif Devanagari) for Sanskrit terms and headings in readings, with transliteration in Inter.
- One subtle, static mandala/yantra watermark behind the message list (SVG, 4 % opacity); no animated starfields behind text.
- Planet glyphs or Sanskrit initials as small inline badges in the When strip (☉ ☽ ♂ ☿ ♃ ♀ ♄ ☊ ☋).
- Keep Shri Ganesh avatar for the assistant; user avatar from initials.

### 3.6 Header and footer

- Header: thread title (editable) + subject chips + "Reading as of 24 Oct 2026" + right-side buttons (chart glance, share). Remove "Online • Ready to guide you".
- Footer line: replace the claim with "Readings are computed from your birth chart with Lahiri ayanamsa. Not medical, legal or financial advice." (small, grey).

### 3.7 Message actions and persistence

- Copy (markdown), Share (creates a read-only link to the reading, Phase 4), Save to "My readings", thumbs up/down with an optional reason → `reading_feedback` table (feeds evals).
- Permalink per message: `/dashboard/chat/<chatId>#<messageId>`.

## 4. Streaming: start sooner and stream the right thing first

Today the first token arrives after the whole model thinks. With the reading engine:

1. `intent` event in ~1 s → card frame and understanding line appear.
2. `stage` events every few seconds → chips tick; the wait copy becomes "Reading your D-10… / Checking Saturn–Mercury period… / Checking transits…".
3. `windows` event after reconcile → When strip renders before prose.
4. Synth streams; because every template starts with the Answer card, the first visible sentence is the verdict.
5. Fast lane for simple questions streams from ~3 s.

No change to the transport (SSE over the Lambda Function URL, pings every 12 s).

## 5. Accessibility and mobile

- Landmarks: `nav`, `aside` ×2, `main`, `form`; focus order rail → list → messages → input.
- `aria-live="polite"` on the stage text, not on every token (screen readers choke on token streams); announce "Answer ready" on done.
- Hit targets ≥ 44 px on mobile; input bar sticky above the keyboard; sidebars as bottom sheets.
- Reduced-motion: no bouncing dots, use a static progress bar.

## 6. Tests to add (TEST.MD)

1. Send a question → card frame visible < 2 s, stage chips update, Answer block streams first, When strip shows dates that match the body.
2. Scroll up during streaming → no yank; pill appears; tap → bottom.
3. Enter sends; Shift+Enter newline.
4. Left/right sidebars remember state across reload; `[` and `]` toggle; mobile bottom sheets open and close by drag.
5. Right sidebar glance shows current MD–AD–PD with the same end date the reading quotes.
6. 390 px wide: tables scroll horizontally inside the card, no page overflow.
7. Screenshots under `docs/screenshots/chat-ui/NN-step.png`.
