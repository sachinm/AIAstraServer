# Home page constellation sky (design brief, 2026-11-02)

Sachin asked for the home page to be "a mesh of different constellations and solar system planets that coincide with
the 9 planets in astrology", as a new, very pleasing graphic.

## Start

`LandingPage.tsx` sits on the shared `.app-sky` starfield (`AppFrame`) with three shooting stars. Nothing else is drawn
behind the hero. `docs/product/celestial-backgrounds.md` plans photographic and painted skies; this graphic is vector,
so it needs no image licences, adds little weight and scales to any screen.

## End goal

A visitor sees a star map: a gold zodiac belt carrying the twelve constellation figures, seven planets on orbits inside
it in their traditional order out from the Earth (Moon, Mercury, Venus, Sun, Mars, Jupiter, Saturn), and Rahu and Ketu
opposite each other on the belt as the two lunar nodes. Fine lines join each planet to the constellations it rules and
the constellations to each other, so the whole thing reads as one mesh. Stars twinkle, the lines carry a slow glow, and
the planets pulse. Reduced motion gets a still image. The text on top stays readable.

## Deliverable

- `src/lib/constellationSky.ts`: the art data (star figures, planet looks) and a pure `buildSky(layout)` that places
  everything. No astrology is computed: all positions are fixed art, not a chart or a transit.
- `src/components/ConstellationSky.tsx`: the SVG, a wide layout for desktop and a tall one for phones.
- A mount in `LandingPage.tsx`, CSS animation in `index.css`, tests, screenshots under `docs/screenshots/`.

## How it works when done

- **Backend, API:** none.
- **Frontend:** the graphic is `aria-hidden`, takes no pointer events, and fades out below the hero. Both layouts are in
  the prerendered HTML, so there is no layout shift. One is hidden with CSS at each width.
- **UI:** planet and sign names (Surya, Chandra, Mangala, Budha, Guru, Shukra, Shani, Rahu, Ketu, and the twelve rashis)
  are labels at low opacity and hidden on phones. Motion is CSS only, off under `prefers-reduced-motion`.
- **Not claimed:** it does not show where anything is in the sky today. The pairing of planet to constellation is the
  traditional rulership, drawn as art.

## Architecture and ingredients

Pure TypeScript and SVG; no library, image, font or network request. Colours follow the planet colours in
`celestial-backgrounds.md`. Page weight goal: under 20 KB of markup for both layouts.

## Steps

1. Data and builder, with tests (bounds, counts, determinism).
2. Component, then mount behind the hero.
3. Render desktop and phone screenshots, and judge them by eye. Refine.
4. Type check, full tests, build, merge to `develop`. Deploy only through the deploy session, after the demo freeze plan.

## Recommendation

Ship it on the home page only. Do not repeat it on sign-in, sign-up or the app, where legibility matters most.
