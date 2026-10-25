# Celestial backgrounds — art direction and rotation system

Dated 2026-10-24. Sachin likes the current theme (deep indigo night sky, soft starfield, glass cards, saffron-to-be accents) and wants the backgrounds to **cycle through choice celestial scenes from Indian astrological mythology**: the nakshatras, Surya on his chariot, the grahas embodied as deities, charioteers, warriors and generals, Shukra, Rahu and Ketu, the colour of each planet as a sky, and real cosmic photography. Not new-age; cosmic, mythic, restrained.

## 1. What is there today

- `App.tsx` paints one fixed full-screen photo hotlinked from Pexels with a 40 % black scrim; `LandingPage.tsx` layers an Unsplash photo, a "stardust" texture from transparenttextures.com and twinkling dots; everything else is Tailwind indigo/purple/pink gradients. Live look: night-indigo gradient, faint stars, purple→pink gradient headline, pill buttons. That mood is the baseline to keep.
- Problems: three third-party hotlinks (licensing, latency, breakage), one static image for every page, no connection between what is on screen and the user's chart.

## 2. Art direction

**Keep**: night base `#0B0C24 → #1B1738`, low overall brightness (image luminance 20–35 %), cinematic matte-painting finish, glass cards, generous dark areas for text. **Replace** purple→pink with saffron `#F2A93B` and old-gold `#E8C77A` as the accent family; planet colours appear only inside their own scenes.

**Style sheet for every image** (also the master prompt for generation or the brief for an illustrator):

> Cinematic matte painting, Indian classical iconography rendered realistically (not cartoon, not poster, not AI-glossy), deep indigo night sky with subtle Milky Way, the subject lit by its own planetary colour, fine film grain, muted palette except one accent, subject placed in the left or right third leaving a clean dark area for text, no text or lettering, no modern objects, 16:9 at 2560×1440 and 9:16 at 1080×1920.

**Cultural accuracy rules**: vahanas, weapons, hand counts and directions follow the Navagraha and nakshatra traditions below; faces are dignified, never caricatured; no deity is shown in a context that could offend (no humour, no violence beyond the epic scenes listed); Ganesh remains the assistant avatar and is not used as a background. A short review checklist per image: correct vahana, correct colour, correct attributes, respectful pose.

## 3. The sky library (about 48 scenes)

### 3.1 Navagraha as embodied deities (9 + variants)

| Graha | Scene | Colour of the sky | Attributes to get right |
|---|---|---|---|
| Surya (Sun) | Seven-horse chariot driven by Aruna, dawn disc behind | gold, orange, ember | one wheel, seven horses, lotus in hands |
| Chandra (Moon) | Ten white horses or an antelope-drawn chariot over a night sea | silver, pearl, pale blue | crescent on crown, calm |
| Mangala (Mars) | Red warrior-general on a ram, spear and mace, red dust | vermilion, red | four arms, ram, commander's bearing |
| Budha (Mercury) | Young prince on a lion-yali chariot or on a winged lion, green silks, scrolls | emerald, green | sword, shield, book, mace |
| Guru / Brihaspati (Jupiter) | Teacher of the gods on an elephant or golden swan chariot, yellow robes | yellow, saffron, gold | rosary, water pot, scriptures |
| Shukra (Venus) | Teacher of the asuras on a crocodile or white horse, white garments, luminous | white, pastel, moonstone | staff, rosary, gentle radiance |
| Shani (Saturn) | Dark lord on a crow or vulture, iron bow, slow and immense; also a buffalo variant | indigo, black-blue, iron | downcast gaze implied by shadow, not a monster |
| Rahu | Serpent-headed shadow on a chariot drawn by eight black horses, eclipse behind | smoky blue-grey, violet, eclipse corona | no body below the head, smoke, eclipse disc |
| Ketu | Serpent-bodied form on a vulture or eagle, comet-tail, flame-grey | grey, ash, saffron flame | headless body, banner or comet |

Each graha also gets a **colour-field sky**: no figure, only its colour as nebula, dust and stars (used behind readings where legibility matters). That is 9 figurative + 9 fields.

### 3.2 Nakshatra scenes (start with 12, grow to 27)

Deity and symbol together, small figure, large sky: Ashwini (twin horsemen, horse head), Bharani (Yama, yoni-shaped gateway), Krittika (Agni, flame-blade), Rohini (Brahma, ox cart under a red star), Mrigashira (Soma, deer head in the Orion stars), Ardra (Rudra, teardrop and storm), Punarvasu (Aditi, bow and quiver), Pushya (Brihaspati, cow udder and lotus, arrow), Magha (Pitris, royal throne and palanquin), Swati (Vayu, young shoot bending in wind, coral), Jyeshtha (Indra, circular talisman and umbrella), Mula (Nirriti, bundle of roots), Shravana (Vishnu, ear and three footprints), Revati (Pushan, fish drum). Each lists its ruling planet so it can inherit the planet colour.

### 3.3 Cosmic photography (public domain and CC)

Milky Way core, Jupiter with moons, Saturn's rings, lunar phases, total solar eclipse corona (Rahu), a long comet (Ketu), Pleiades (Krittika), Orion (Mrigashira), Scorpius with Antares (Jyeshtha), Venus at dawn (Shukra). Sources: NASA and NASA/JPL (public domain), ESA/Hubble and ESO (CC BY 4.0, credit required), Wikimedia Commons CC0. Credits page in the app footer. No stock sites, no hotlinks.

### 3.4 Cosmology and yantra plates

Rashi chakra (zodiac wheel with Sanskrit sign names), Kalachakra wheel, Sudarshana chakra, Mount Meru with the planetary spheres, Navagraha mandala, a Jyotish birth-chart grid (North Indian diamond) as a faint engraved pattern. Used on Charts and Profile pages at 8–12 % opacity over a colour-field sky.

### 3.5 Epic moments (6, sparingly)

Samudra Manthan with Mohini and the splitting of Svarbhanu into Rahu and Ketu; Surya and Sanjna; Shani and Dasharatha; Hanuman reaching for the Sun; Chandra and Rohini; Brihaspati teaching the devas. Landing page only.

## 4. Rotation logic: meaningful first, random second

Random-only cycling feels arbitrary and causes layout flicker. The rule is **meaningful choice within a family, seeded randomness within the day**:

| Page | Family | Selection |
|---|---|---|
| Landing | Epic and cosmic photography | one per day, seeded by date (everyone sees the same sky that day) |
| Sign in / sign up | Nakshatra scene | the nakshatra the Moon occupies today (from the transit snapshot) |
| Chat | Planet **colour field** (never a figure behind text) | the user's running Mahadasha lord; before login or when unknown, the weekday lord (vara) |
| Charts | Cosmology plate over the Lagna lord's colour field | user's Lagna lord |
| Profile and Life Timeline | Kalachakra plate over Saturn or Jupiter field | Saturn field when sade sati is active, else Jupiter |
| Reading card accent (not full background) | planet glyph and colour chip | the decisive planet of that reading (from the synth brief) |
| Eclipse days | Rahu or Ketu scene everywhere except chat | from the transit snapshot `lunations` with eclipse flag |

Within the chosen family the exact image is picked by a seeded hash of `(date, userId)` so it changes daily, not on every navigation. Crossfade 1.2 s on route change only; none under `prefers-reduced-motion`. A small "Why this sky?" caption (hover or tap on an info dot in the corner) names the graha or nakshatra and one line of meaning — education and delight in one. Settings: pin a favourite sky, or turn rotation off (static field).

## 5. Implementation (web)

- `src/theme/skies.ts`: manifest, one entry per image: `{ id, family, graha?, nakshatra?, src: { landscape, portrait }, lqip, focal: {x,y}, textSafe: 'left'|'right'|'center', scrim: { from, to }, accent, credit?, tags[] }`. Validated by a unit test.
- `src/theme/selectSky.ts`: pure function `(page, context: { date, userId?, mdLord?, lagnaLord?, moonNakshatra?, eclipse?, prefs }) → skyId`; deterministic; unit-tested.
- `<SkyBackground />` mounted once in `App.tsx` replacing the Pexels div: renders the low-quality placeholder instantly, swaps to AVIF/WebP via `<picture>`, preloads the next route's sky on hover/intent, applies the per-image scrim gradient and sets CSS variables `--accent`, `--accent-soft` from the manifest.
- Assets in `public/skies/<id>.{avif,webp}` served by Amplify's CDN; ≤ 250 KB landscape, ≤ 180 KB portrait; `width/height` set to avoid layout shift; LCP budget 2.5 s on 4G.
- Tailwind: add the palette tokens (night, plum, saffron, gold, vermilion, graha colours) in `tailwind.config.js` and retire the purple→pink gradient utility classes page by page.
- Tests: manifest schema; `selectSky` determinism and fallbacks; contrast of body text over each scrim (automated check against the manifest colours); reduced-motion; screenshot set per family under `docs/screenshots/skies/`.

## 6. Producing the images

Two routes, both acceptable; the style sheet in §2 keeps them consistent:

1. **Generated, then curated**: an image model with the master prompt plus a per-scene brief; generate 6–8 candidates per scene, pick one, retouch; cost is a few cents per candidate on current Gemini image models (see the pricing table in file 05 for the model list). Keep the prompts and seeds in `docs/skies/prompts/` so a scene can be regenerated in the same style.
2. **Commissioned**: one illustrator for the nine Navagraha figures and the six epic scenes for consistency of faces and attributes; generated images for colour fields and nakshatras.

Either way: a cultural review pass per image, and photographs only from the sources in §3.3 with credits recorded in the manifest.

## 7. Delivery order

1. Nine planet colour fields + chat page wiring (fixes legibility and replaces the hotlinks). 
2. Nine Navagraha figures + Landing/Auth wiring + "Why this sky?".
3. Twelve nakshatra scenes + eclipse rule.
4. Cosmology plates for Charts/Profile; photography set with credits page.
5. Remaining nakshatras and epic scenes.
