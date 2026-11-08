# Home page scenery, sign-in and sign-up: review and improvement plan (2026-11-07)

Audience: people in the US and in India who already get Vedic astrology readings done regularly. Brief from Sachin: look
honestly at the scene transition, all 39 scenes, `/signin/` and `/signup/`; say what is missing and what would make the
home feel welcoming and like the home of Vedic astrology, without making it religious.

Builds on, and does not replace: [`docs/product/landing-cosmic-skies.md`](../product/landing-cosmic-skies.md) (the scene
loop), [`docs/product/celestial-backgrounds.md`](../product/celestial-backgrounds.md) (art direction and accuracy rules),
[`docs/product/landing-parchment-scrolls.md`](../product/landing-parchment-scrolls.md) (the scroll icons) and
[`docs/product/auth-registration-review.md`](../product/auth-registration-review.md) (sign-in and sign-up forms).
Findings are also filed in [`docs/TODOS.md`](../TODOS.md) under "Filed 2026-11-07 by the home-scenery review session".

## 0. How this was checked, and what was not

| Checked | How |
|---|---|
| Live home page and its loop | Opened `https://vedic-astrology.app/` in the in-app browser, took frames through several transitions. Production builds hold each scene 20 s (`VITE_SKY_HOLD_SECONDS=20` in the web repo's `.env.production`); the code default is 120 s |
| All 39 scenes | Built contact sheets from `AIAstra_WEB/src/assets/skies/*.webp` (1920×1072 each) in the loop's order and looked at every one |
| Scene code and prompts | `src/lib/skies.ts`, `src/components/CosmicSky.tsx`, `scripts/skies/scenes.mjs`, `src/LandingPage.tsx`, CSS in `src/index.css` |
| `/signin/` and `/signup/` | Loaded both live, read their text and controls |
| **Not checked** | Submitting either form: Turnstile blocks automated browsing, and no account was created. Phone-sized rendering: the portrait crop below is read from the CSS (`bg-cover bg-center`), not seen on a phone. Whether the stored panchang rows carry the Moon's nakshatra: see step 4 |

Counts, corrected: 27 nakshatras (no Abhijit) and 12 planets, 39 scenes. Not 28 and 9.

## 1. Start: the system as it is

**Loop.** `CosmicSky` shows one full-screen scene, pinned behind the page. `SKY_SCENES` is the 27 nakshatras with a planet
after every two, in a fresh random order each round. The first scene is `randomScene()`. The next image is fetched and
decoded while the current one holds, and a scene that fails to decode is skipped. A transition lasts 3 s: the new scene is
revealed by a radial mask growing from a random corner, the old one fades and drifts toward another corner, and a violet
and amber bloom crosses the seam. Each scene also drifts slowly for 125 s. The timer stops when the tab is hidden. With
reduced motion on, scenes crossfade without movement. A caption sits bottom right: Devanagari name, English name, the
yoni animal in Hindi and English, and the sign or signs the nakshatra falls in.

**Over the scene.** `LandingPage` shows eight parchment-scroll icons at random positions (a tagline, "Discover Your Cosmic
Blueprint" with the "Generate My Chart" button, "Explore Jyotish", "About 9,500 records", and four FAQs). The first scroll
unrolls by itself and rolls up after 10 s. There is no other visible content on the home page.

**Auth.** `/signin/`: one field (email) and "Send me a code". `/signup/`: name, email, one checkbox ("I am 18 or older and
accept the Terms of Service and Privacy Policy. AdAstra AI is for education and entertainment only and is not advice."),
then "Next". Both sit in a dark glass card over the same scenery with Turnstile ("Please confirm you are a person").

## 2. What is good (keep all of it)

- The concept is distinctive and scholarly: each nakshatra as a star goddess riding her yoni animal, with the real star
  pattern drawn as fine gold lines behind her. Nobody else in this market has it.
- The scenes are one family: dark cinematic matte, translucent starlight animals, volumetric light, low brightness so the
  words stay readable. Devanagari alongside English reads as respectful, not exotic.
- The transition is tasteful. The corner bloom and the drift avoid the slideshow look, and the mask plus decode-before-swap
  logic never flashes.
- The same scenery behind sign-in and sign-up gives the product one continuous world.

## 3. What is wrong, in order of how much it costs us with this audience

1. **Twelve planets is a credibility leak.** The loop includes Prajapati (Uranus), Varuna (Neptune) and Yama (Pluto) with
   invented vahanas (swan, whale, buffalo). A regular reads that as Western astrology in Indian dress. This was a deliberate
   count in `landing-cosmic-skies.md` ("the seven visible ones plus Uranus, Neptune and Pluto", plus Rahu and Ketu), so it
   is Sachin's call. Recommendation in §6.
2. **Five scenes are off their own brief.**
   - `hasta`: the goddess is blue-skinned and reads as Vishnu or Krishna.
   - `shukra`: reads as a woman in white. Shukra is the guru Shukracharya, a bearded man.
   - `budha`: a neon-green winged lion with iridescent wings looks like a game asset, not the family style.
   - `chitra`: a realistic tiger with fur, where every other animal is translucent starlight.
   - `yama`: near-black, grim, a stern figure on a buffalo; the brief says "nothing frightening".
3. **The first scene is random.** A first visit can open on Rahu, Ketu or Yama. The first scene is the whole first
   impression, and nobody sees all 39 at 20 s each.
4. **The home has no chart on it and no words of the audience's own.** "Discover Your Cosmic Blueprint" and "Generate My
   Chart" are Western new-age phrasing. The tagline ("mastered on the ancient text unabridged and astrological celestial
   sky") is hard to parse. The words a regular uses are Kundli, Janam Kundali, Jathakam, Dasha, Panchang, Muhurat. The most
   recognisable image to this audience, the North-Indian diamond or South-Indian square chart, appears nowhere.
5. **The caption names the wrong things.** "रोहिणी · Rohini / बैल · the ox / वृषभ Taurus" makes the ox look like the point.
   A regular knows a nakshatra by its lord, symbol and deity. The yoni animal is a minor attribute.
6. **Devanagari only.** A large share of US Indians, and the most jyotish-active region of India, read Tamil, Telugu,
   Kannada or Malayalam. There is no transliteration or script choice.
7. **Two baked-in "AdAstra AI" marks on every image**, one bottom right and one faint in the centre over the subject.
   It looks like a stock-photo preview.
8. **Eight identical parchment icons sit at random, sometimes over the goddess's face.** The parchment card with pink
   gradient heading is a second visual language beside the cinematic scenes, and the product explanation and the FAQs are
   hidden until an icon is clicked.
9. **Portrait phones likely crop the rider** (from the CSS, not yet seen): a 16:9 image with `bg-cover bg-center` on a 9:16
   screen cuts both sides, and the bottom-right caption lands over the animal. The phone is probably most of the US
   Indian traffic.
10. **Auth is email-code only and says nothing about what comes next.** India users expect phone or WhatsApp OTP, US
    Indians expect "Continue with Google". Neither page says what the person gets, or that birth date, time and place come
    next, so it feels like a gate. Both were deliberate: `auth-registration-review.md` puts Google in Cognito Phase 2 and
    defers phone OTP over SMS cost and India DLT registration. The review reopens them only for the audience this
    brief names.

## 4. End goal

A first-time visitor from Chicago or Chennai opens the page and sees, within one second, today's sky: the scene is the
nakshatra the Moon is in right now, with one line such as "Today: Moon in Rohini · Shukla Panchami · Saturday". They
recognise the vocabulary, see a kundli-shaped motif, can read the caption in the script they prefer, and know in one line
what signing up gives them. Nothing on the page looks like a Western horoscope app, a temple poster or a game. Sign-up
tells them the next step is their birth details. On a phone nothing important is cropped or covered.

## 5. Deliverable

| Area | Ships |
|---|---|
| Loop content | `skies.ts`: navagraha-only loop (decision 1), first scene from today's Moon, caption with lord and symbol, script option |
| Art | Regenerated `hasta`, `shukra`, `budha`, `chitra`, `yama` (if kept); centre watermark removed from all 39; per-scene focal point for portrait; later 12 rashi scenes |
| Home page | Copy rewrite, a kundli motif, scroll icons kept off the centre third, product explanation visible without a click |
| Auth | One "what you get" line and one "next: your birth details" line on both pages; Google and phone decisions recorded |
| API | One public read-only endpoint for today's sky line (step 4) |
| Docs and tests | This doc kept current; unit tests for the first-scene rule and the focal-point crop; screenshots in `docs/screenshots/homepage-scenes/` |

## 6. How it works when done

**Backend and API (only the today line).** `GET /api/public/sky-today` is anonymous and carries no user data. It reads the
stored shared sky and panchang (the Lucky Times day tables in `lucky_day_tables`, keyed by reference place and local date,
see `src/reading/lucky/` and `docs/reading-engine/47`) and returns the Moon's nakshatra id, the tithi and the weekday for
the reference place nearest the visitor's timezone (five reference places exist; default to the first). Node does not
compute the nakshatra: the engine's stored field is returned as is. Responses are cached at CloudFront for one hour, since
the Moon's nakshatra changes about once a day. On any failure, or if the row is missing, the endpoint returns 404 and the
page behaves as today: random first scene, no line. Whether the stored rows already carry the Moon's nakshatra id is the
first thing step 4 verifies; if they do not, the engine must add it, and that is filed, not worked around in Node.

**Frontend experience.** On load the page asks for the today line while the first image preloads. If it answers within
about 800 ms the first scene is that nakshatra and the line fades in with the caption; otherwise the random scene shows
and the line is dropped for this visit, so the page never waits on the network. Later scenes stay random per round. The
caption gains the nakshatra's lord and symbol and a script switch (Devanagari, Latin transliteration, and later Tamil,
Telugu, Kannada, Malayalam) remembered in `localStorage` with a safe fallback. Scroll icons are placed outside the centre
third of the screen. With reduced motion the page behaves as today.

**UI and UX.** Words: the hero line moves from "Discover Your Cosmic Blueprint" toward "Your Kundli, read with care"
(final copy with Sachin), the button from "Generate My Chart" toward "Create my Kundli". Auth pages gain a single line
above the form: sign-up "Free. You'll add your birth date, time and place next." and sign-in "We'll email you a code."
States stay as they are today (pending, sent, failed); no new waits are added.

## 7. Architecture

```
visitor -> CloudFront -> Amplify web (static scenes, hashed, cached a year)
                     \-> /api/public/sky-today -> Lambda -> lucky_day_tables (shared panchang, no user column)
CosmicSky: first scene = today's Moon nakshatra if the call returns in time, else random
           later scenes = shuffled round (unchanged), decode-before-swap (unchanged)
```

Boundaries: scene images remain static assets with no data in them. The endpoint reads shared tables only and returns no
user data. The engine stays the only source of astrological facts; the web only maps a returned nakshatra id to its image.

## 8. Ingredients

| Need | Who |
|---|---|
| Decision on Uranus, Neptune, Pluto (§9) | Sachin |
| Decision on Google sign-in now and phone or WhatsApp OTP later | Sachin |
| Yes to image generation: image model on the paid key, 5 regenerated scenes now and 12 rashi scenes later. The 2026-11-02 run was about 90 images for about $12, so roughly $0.13 each: about $1 for 5, about $2 for 12, before retries. State key, count and cost before the call | Sachin |
| Whether stored panchang rows carry the Moon's nakshatra id | Server agent (read-only query) |
| Lord, symbol and deity per nakshatra for the caption | Agent writes from the classical list; Sachin reviews the wording |
| Regional script names for the 27 + 12 scenes | Agent drafts; a native reader should check before release |
| Browser check on a real phone | Sachin or a device test |

## 9. Action steps in sequence

1. **Decide the outer planets.** Recommendation: drop Prajapati, Varuna and Yama from the home loop (nine navagraha only,
   so 27 + 9 = 36 scenes). One line each in `NAKSHATRAS`/`PLANETS` and the interleave rule in `src/lib/skies.ts` and
   `scripts/skies/scenes.mjs`. Keep the files for an optional "outer planets" note later. Done: tests green, counts shown
   as 27 + 9. Parallel with 2 and 3.
2. **Caption pass.** Add lord and symbol per nakshatra to `skies.ts`, shown on the second line; keep the animal as a
   short third element. Done: caption fits two lines at 360 px wide. Parallel.
3. **Copy pass** for the home, the scrolls and both auth pages, plus the two auth lines. Files: `LandingPage.tsx`,
   `src/lib/landingFaqs.ts`, `src/Auth/`. Done: Sachin approves the words. Parallel.
4. **Today's Moon.** Verify the stored rows (read-only), then build `GET /api/public/sky-today`, the web call with the
   800 ms budget, and the first-scene rule. If the field is missing, file the engine addition in `docs/TODOS.md` and ship
   the rest. Done: a first visit opens on the right nakshatra, and with the endpoint blocked the page is unchanged.
5. **Placement rule for scroll icons**: keep out of the centre third; move the product explanation into view without a
   click. Files: `src/lib/scrollPlacement.ts`, `LandingPage.tsx`. Done: no icon covers the subject in 20 random loads.
6. **Portrait crop**: add a focal point (x, y) per scene and use it as `background-position` on narrow screens; move the
   caption above the footer there. Done: screenshots at 390×844 for 10 scenes, subject and caption both clear.
7. **Art fixes** (needs the Sachin yes in §8): regenerate `hasta`, `shukra`, `budha`, `chitra`, and `yama` if kept, from
   the prompts in `scripts/skies/scenes.mjs` with the corrections above; remove the centre mark on all 39 scenes (an
   inpaint or a regenerate-with-no-mark pass), keeping one corner mark if wanted. Done: contact sheet re-checked.
8. **Script option** (Devanagari, Latin, then regional). Done: toggle works, choice persists, the default is not changed
   for anyone who does not touch it.
9. **Kundli motif**: a quiet North-Indian diamond (and a South-Indian option on the sign-up card) as a slow, low-opacity
   layer, drawn as SVG with no planet data in it. Done: legible on every scene without lowering contrast of text.
10. **Rashi scenes** (12) in the same style and the same cost gate, then add them to the loop. Done: loop is 27 + 9 + 12.
11. **Auth providers.** Per Sachin's decision: Google on the Cognito path in `auth-registration-review.md`; WhatsApp or SMS
    OTP only with a registered sender and India rules in hand.

## 10. Development phases

| Phase | Steps | Leaves the site | Closing check |
|---|---|---|---|
| A: copy and code, no new art, no spend | 1, 2, 3, 5, 6 | Navagraha-only, better captions, Kundli vocabulary, nothing over the face, phones fine | Unit tests; screenshots at 1440×900 and 390×844; Sachin reads the copy |
| B: today's sky | 4 | Opens on today's Moon with a one-line panchang; falls back to random | Endpoint on staging; a screenshot with the line; a run with the endpoint blocked |
| C: art | 7, then 10 | Five off-brand scenes fixed, no centre watermark, rashis added | Contact sheet; cost line on the bill matches the estimate |
| D: audience reach | 8, 9, 11 | Regional scripts, Kundli motif, Google and later phone sign-in | Each behind its own flag; a native reader reviews each script |

## 11. Recommendation

Do phase A first because it costs nothing and fixes what a regular notices fastest: the outer planets, the Western
phrasing, the caption, the icons over the face and the phone crop. Then phase B, since opening on today's Moon is the one
change that gives a returning user a daily reason to open the page and uses only data we already store. Spend on art only
after Sachin's yes. Leave sign-in providers to Sachin's call, with this view: Google earlier than Cognito Phase 2 helps US
Indians most; phone OTP can wait for the mobile app, as already decided, unless India traffic is the lead.

| Choice | Verdict |
|---|---|
| Keep 12 planets | Credibility cost with regulars; revisit only if the outer planets are a product feature |
| Navagraha-only home loop | Chosen. One-line change, art kept |
| Random first scene | Replace with today's Moon, random on failure |
| Add Abhijit as a 28th scene | No: the stored and engine nakshatra system is 27 |
| Make the home more devotional (temples, diyas, mantras) | No: brief is welcoming, not religious |
