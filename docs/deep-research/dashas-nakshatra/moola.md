# Moola dasha (mūla daśā / lagna-kendrādi graha daśā)

> A graha dasha taught by SJC (Sanjay Rath) in which planets run in order of their placement in kendras, panapharas and apoklimas from the stronger of lagna and 7th, with Vimshottari years. It is read for karma, curses and remedies rather than for event timing. It is not a nakshatra dasha; it is included here because it uses graha periods and the Vimshottari year table. Relevance to AI Astra is low.

## 1. Sources

| Rule | Source | Tag |
|---|---|---|
| Kendradi and karaka-based graha dashas listed in BPHS | ELS 46.7 (`kendrādyā`, kāraka-based) | [TEXT, name only] |
| Moola dasha method and its use for curses/remedies | Sanjay Rath (SJC teaching) | [MODERN] |
| Engine module | `AIAstra_Radha/src/jhora/horoscope/dhasa/raasi/moola.py` | engine |

URL: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46

I did not find an SJC primary write-up of the exact method in this pass; the repo notes in `research_notes/Sanjay Rath method summary/` may cover it.

## 2. When it applies

All charts, for the karma/remedy question in SJC practice [MODERN].

## 3. Inputs required

Lagna, 7th house strength comparison, all planets' signs, Vimshottari years.

## 4. Calculation (SJC outline, not verified against a primary SJC text)

Start from the stronger of lagna and 7th; planets in kendras from it run first, then panapharas, then apoklimas; within a group, the stronger first; each planet gets its Vimshottari years, reduced by the balance rule SJC uses. Check against the engine module before relying on this outline.

## 8. Design notes for AI Astra

Not for boards. Possibly for a later "remedies" feature. Engine output exists; no work needed now.

## 9. Open questions

Primary SJC source for the reduction rule and start point.
