# 03 · The four illustrations: prompts and the ask

Status: **prompts written 2026-11-09; Sachin said yes the same day; no image yet, every local Gemini key is invalid (see Log).** The yes was given in chat,
stating the key, the count and the cost (rule from 2026-11-02, when 90 images were made unasked). Until then the veil
uses the four SVG placeholders drawn by `AIAstra_WEB/scripts/draw-overlay-placeholders.mjs` into `art/overlay/`.

## The ask (as put to Sachin)

- **Key:** the live paid Gemini key (`GEMINI_API_KEY` in the server's `.env`, the one Sachin said is paid on 2026-11-01).
- **Model:** Gemini image generation ("Nano Banana", `gemini-2.5-flash-image`), one image per call, 1:1 or 4:3.
- **Count:** 4 images (South light, South dark, North light, North dark), plus at most 4 retries, only for an image that
  breaks a content rule below. Hard cap 8 calls.
- **Cost:** about $0.04 per image at the published rate (1290 output tokens per image) → **$0.16 for 4, $0.32 at the cap.**
- Outputs go to `AIAstra_WEB/art/overlay/<style>-<theme>.webp` (converted from PNG, ≤ 400 KB each) and a copy with the
  generation log under `docs/loading-overlay/art/`.

Nothing runs until the yes is typed. The build encrypts whatever sits in `art/overlay/`, so swapping the placeholders
for the generated files is the only code-free step.

## Content rules (Sachin, 2026-11-09)

1. An empty house chart: **no planet placed in any house.**
2. House numbers 1 to 12, starting at the first house, in every house.
3. Around the chart, like chess pieces lined up on both sides of a board: the nine grahas as symbols (Sun, Moon, Mars,
   Mercury, Jupiter, Venus, Saturn, Rahu, Ketu), the twelve rashis as symbols, the 27 nakshatras as symbols or as
   Hindi/English names.
4. Clean, premium, Apple-grade. Works as a background behind a line of text: low contrast, no busy centre, nothing that
   reads as text where the quip sits (the middle third).
5. Light and dark variants need not match; variation is welcome.
6. No words from the engine, no logos, no people.

## Shared prompt body

> A premium, minimal illustration of an **empty Vedic astrology house chart**, drawn as fine, even line work with a
> soft hand-inked feel, centred on a plain background with generous margins. **No planets are placed inside the
> houses.** Each of the twelve houses carries a small, elegant numeral 1 through 12 in a classic serif, starting at the
> first house. To the left of the chart, lined up in a single neat column like chess pieces beside a board, the nine
> graha symbols: Sun ☉, Moon ☽, Mars ♂, Mercury ☿, Jupiter ♃, Venus ♀, Saturn ♄, Rahu ☊, Ketu ☋, in warm gold. To the
> right, in a matching column, the twelve rashi symbols ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓. Along the bottom edge, in two quiet rows
> of small serif type, the 27 nakshatra names: Ashwini, Bharani, Krittika, Rohini, Mrigashira, Ardra, Punarvasu,
> Pushya, Ashlesha, Magha, Purva Phalguni, Uttara Phalguni, Hasta, Chitra, Swati, Vishakha, Anuradha, Jyeshtha, Mula,
> Purva Ashadha, Uttara Ashadha, Shravana, Dhanishta, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati. The
> centre of the chart stays open and calm so a short sentence can be read over it. Apple-grade restraint: thin
> lines, exact spacing, no texture noise, no people, no logos, no extra text, no decorative planets anywhere.

## The four prompts

**2a-light · South Indian, light mode**

> [shared body] The chart is the **South Indian style: a square divided into a 4 × 4 grid whose central 2 × 2 is one
> open square**, the twelve outer cells being the houses, numbered clockwise from the second cell of the top row.
> Background pale ivory (#f7f5ff), lines deep indigo (#3b2a7a), numerals slate, graha symbols warm gold (#b45309),
> rashi symbols indigo, nakshatra names soft grey-violet. Morning light, airy.

**2a-dark · South Indian, dark mode**

> [shared body] The chart is the **South Indian style: a square divided into a 4 × 4 grid whose central 2 × 2 is one
> open square**, the twelve outer cells being the houses, numbered clockwise from the second cell of the top row.
> Background deep midnight (#0b0a1f) with the faintest violet vignette, lines pale lavender (#d8b4fe) with a gentle
> glow, numerals lavender-white, graha symbols pale gold (#fde68a), rashi symbols lavender, nakshatra names muted
> violet. Quiet night, luminous.

**2b-light · North Indian, light mode**

> [shared body] The chart is the **North Indian style: a square with both diagonals and an inner diamond joining the
> midpoints of the sides**, giving four central diamonds and eight corner triangles; the first house is the top
> diamond, and the numbers run anticlockwise 1 to 12. Background pale ivory (#f7f5ff), lines deep indigo (#3b2a7a),
> numerals slate, graha symbols warm gold (#b45309), rashi symbols indigo, nakshatra names soft grey-violet. Morning
> light, airy.

**2b-dark · North Indian, dark mode**

> [shared body] The chart is the **North Indian style: a square with both diagonals and an inner diamond joining the
> midpoints of the sides**, giving four central diamonds and eight corner triangles; the first house is the top
> diamond, and the numbers run anticlockwise 1 to 12. Background deep midnight (#0b0a1f) with the faintest violet
> vignette, lines pale lavender (#d8b4fe) with a gentle glow, numerals lavender-white, graha symbols pale gold
> (#fde68a), rashi symbols lavender, nakshatra names muted violet. Quiet night, luminous.

## Acceptance check per image (before it replaces a placeholder)

- [ ] no glyph or mark inside any house other than its numeral
- [ ] twelve numerals, 1..12, each house exactly one
- [ ] nine graha symbols on one side, twelve rashi symbols on the other, 27 names along the bottom (spelling checked)
- [ ] middle third of the image is calm enough for white (dark) or indigo (light) text at 14 px
- [ ] no words beyond the names and numerals; nothing naming any software
- [ ] exported as WebP ≤ 400 KB at 1600 px on the long side

## Log

- 2026-11-09: Sachin typed yes in chat ("Yes for Image prompts - for Gemini yes"). `generate-art.mjs` ran once with the
  server `.env`'s `GEMINI_API_KEY`: 4 calls, all `400 API_KEY_INVALID`, no image, nothing billed. A free model-list
  probe showed `GEMINI_API_KEY_SACHIN` and `GEMINI_API_KEY_NISHA` are invalid too. Waiting on a valid key (TODOS).
  Per-call rows: `art/log.md`.
- 2026-11-09, later: Sachin pasted a key in chat for the illustrations only (to be revoked after). Run 1, the four full
  prompts: all four images came back with wrong or duplicated house numbers (5, 5, 11, 14, 17, 18), misspelt nakshatra
  names, a stray "f7857", Rahu as a word → rejected, kept as `art/rejected-1/*.webp`. Run 2, the four approved retries
  with text-free prompts (geometry and atmosphere only, exact text to be composited in code): South light is a correct
  board; South dark adds corner diagonals; both North boards have wrong inner geometry → kept as `art/plain/*.webp`.
  **8 calls in all, the approved cap; about $0.32.** Decision: the shipped art is the code-drawn SVG set
  (`AIAstra_WEB/scripts/draw-overlay-placeholders.mjs`), restyled after the generated look (ivory vignette with indigo
  lines by day, midnight violet vignette with glowing lavender lines by night), because every numeral, glyph and name
  must be exact and the image model cannot be relied on for that. Another image run needs a new yes.
