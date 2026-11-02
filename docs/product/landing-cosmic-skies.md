# Home page cosmic skies (plan, 2026-11-02)

Replaces `landing-constellation-sky.md`. Sachin on the star map: too stretched out, "2D is boring", "those maps is
childish". He wants a professional background: each nakshatra as its animal, the planets in human form, full screen, one
at a time in an endless loop, pinned while the text scrolls, with random fades into various corners and a cosmic effect.

## 1. Start

- `LandingPage.tsx` mounts `ConstellationSky` (SVG, merged to web `develop` `8d722e6`, live on staging) and three
  shooting stars. `PublicFrame` scrolls only its `<main>`, so a `fixed` layer stays pinned already.
- `docs/product/celestial-backgrounds.md` already sets the art direction and accuracy rules. This plan follows them.
- Counts: there are **27 nakshatras** (28 with Abhijit), not 36. The "10 planets" are the seven visible ones plus Uranus,
  Neptune and Pluto. A Vedic product also needs Rahu and Ketu, so this plan draws **12**: 39 scenes in all. Removing a
  scene is one line in the list.
- Image model: `models/gemini-3-pro-image` answers on the existing paid key (listed 2026-11-02). Prompts hold no user
  data. Price was not read; check it on the first bill line.
- No `sharp`, PIL or `cwebp` here. Compression runs through Playwright's Chromium canvas, already installed.

## 2. End goal

The page opens on one full-screen cinematic scene with real depth: volumetric light, nebula dust, a slow camera drift.
About every 9 seconds the next scene blooms in from a random corner through a haze of light while the old one dissolves
toward another corner. The order never ends. Text and cards scroll over it; the background does not move with them. Words
stay readable on every scene. A small caption names the scene, for example "Ashwini, the horse". With reduced motion on,
one scene stays still.

## 3. Deliverable

- `scripts/generate-skies.mjs` and `scripts/skies/scenes.mjs`: the prompts, kept so a scene can be redone in the same style.
- `public/skies/<id>.webp`: 39 images, 1920 wide, about 150 KB each.
- `src/lib/skies.ts`: id, name, caption, order, and the pure random corner picker.
- `src/components/CosmicSky.tsx`, CSS in `index.css`, tests. `ConstellationSky` and its data are deleted.

## 4. How it works when done

- **Backend, API:** none.
- **Frontend:** a `fixed inset-0` layer holds two stacked images. Only the current and the next are ever loaded, so a
  visitor downloads one image every 9 seconds, not 39. The next is decoded before the transition starts, so no flash;
  if it fails, the scene is skipped. The timer stops while the tab is hidden. The first scene is preloaded for a fast
  first paint, and the prerendered page shows it with no script.
- **Transition, 3 s:** the incoming scene is revealed by a radial mask growing from a random corner, with a slight zoom.
  The outgoing scene fades and drifts toward a different random corner. A soft nebula bloom crosses the seam. Each scene
  also drifts slowly (scale 1.0 to 1.08) so nothing is ever flat. Only opacity, transform and mask animate.
- **Readability:** a dark gradient scrim sits between the scene and the page, stronger on phones.
- **UI:** caption at low contrast in a bottom corner, `aria-live` off, the layer `aria-hidden`. No controls.

## 5. Architecture and ingredients

Static files on Amplify's CDN; no third party at run time. Needs the Gemini key (have it) and a cultural review by Sachin
of every deity scene before it ships: correct vehicle, colour and attributes, respectful pose. Ganesh is not used.

## 6. Steps

1. Generate three samples (a nakshatra animal, a classical deity, an outer planet) and judge them.
2. Generate the rest. Reject and redo weak ones. Compress.
3. Build `CosmicSky`, delete the star map, test desktop and phone by eye and by test.
4. Merge to `develop`. **Not deployed:** the deploy freeze holds until Sachin lifts it.

## 7. Recommendation

Ship the three-sample look only if it reads as cinematic, not as stock AI art. If it does not, change the style line
and regenerate the samples before spending on the other 36.
