# 51 — General Reading, conversation categories, and Ask everywhere

Status: **build plan, 2026-11-05 (Fable), executing.** Sachin's brief: the current chat screen (`/dashboard/chat`)
becomes **General Reading** with its own icon in the header; conversations get **categories**, General Reading being one
of them; every screen gets a chat icon in its header that opens a **modal at 98 % of the viewport** for a reading
specialised to where the person is in the app. General Reading keeps no memory between conversations today; the
product does not say so.

## 1. Start (facts checked 2026-11-05)

| Fact | Where |
|---|---|
| The chat is `ChatSection` (741 lines): conversations sidebar, messages, input, Clarify, the kundli sidebar; `createChat` takes no arguments; `chats` returns `id, name, is_active, created_at`; a chat's `name` is its first question trimmed | `AIAstra_WEB/src/pages/chat-interface/ChatSection.tsx`, server `src/graphql/schema.ts:221-230, 420, 774, 1253` |
| The ask stream already takes a `focus` (a subject id from `FRAMES`: work, money, relationship …) that prefixes the stored question with the subject label and builds an intent for it | server `server.ts:249-277`, `src/reading/packs/frames.ts` |
| The header is `TopNavigation` (logo, usage bar, avatar menu); the frame `Dashboard` hides the footer on chat and shows the boards tab bar elsewhere | `AIAstra_WEB/src/pages/TopNavigation.tsx`, `Dashboard.tsx` |
| No conversation category exists; the sidebar is one flat list | `ChatSidebar.tsx`, `chats` table |

## 2. End goal

The person sees **General Reading** in the header (an icon and the words) and it opens the chat they know. Their
conversations are grouped: General Reading, Work, Lucky times, Today, Love, You. On every board a chat icon sits in the
header; tapping it opens a reading modal that fills 98 % of the screen, already set to that board's subject, with a
placeholder that names the board ("Ask about your work map…"). A question asked there is a conversation in that
board's category. Nothing on screen mentions memory.

## 3. Deliverable

| Area | Items |
|---|---|
| Server | migration `chats.category` (text, default `general`, indexed); GraphQL `createChat(category)` and `category` on `Chat`; `chats` ordered by category then date; `CATEGORIES` list in `src/chat/categories.ts` |
| Web | `AskModal` (98 vw × 98 vh dialog embedding `ChatSection` with `category`, `focus`, `placeholder`); `AskButton` in the header on Today, Work, Love, Lucky times; General Reading icon and label in `TopNavigation`; the sidebar groups by category; `menu.generalReading` strings |
| Tests | web: the modal opens at 98 % and passes the category; the sidebar groups; the header shows General Reading. Server: `createChat` stores the category; `chats` returns it. e2e: open Work → Ask → send → the conversation appears under Work |

## 4. How it works

- **Backend:** `createChat(category)` validates against `CATEGORIES` (`general | work | love | you | today | lucky`),
  stores it; `chats` returns it. The ask stream is unchanged: the modal passes `focus` from a board-to-subject map
  (`work → work`, `love → relationship`, `lucky → this_month`, `today → this_month`, `you → self`), so the reading is
  specialised through the existing `FRAMES` path. No memory change (filed: doc 48 is the memory plan).
- **Frontend:** `AskModal` renders `ChatSection` in a `role=dialog` at 98 vw × 98 vh with a close button; `ChatSection`
  gains optional props `category`, `focus`, `placeholder`, `embedded` (hides the kundli sidebar by default and starts a
  new conversation in the category). The sidebar groups rows under category headings, General Reading first.
- **Words:** header "General Reading"; modal title "Ask about {board}"; placeholder per board; nothing about memory.

## 5. Steps

1. Server: migration, GraphQL, categories list, tests. 2. Web: `ChatSection` props, `AskModal`, `AskButton`, header
item, sidebar groups, tests. 3. e2e. Phase 2 (doc 48): the modal reads `person_facts` so the first answer already knows
the situation.
