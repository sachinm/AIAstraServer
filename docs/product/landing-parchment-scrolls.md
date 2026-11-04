# Home page as parchment scrolls (plan, 2026-11-03)

Sachin's brief: the home page's text panels stop scrolling down the middle. Each becomes a parchment scroll icon somewhere on the four
edges of the screen, and opens on the side when clicked, so the nakshatra and planet scenes stay in view. "Discover Your Cosmic
Blueprint" shows by itself at first and rolls up into a scroll after 10 seconds. No scrolling on the home page. Sign-up keeps a
scrollbar. Header and footer stay where they are.

## Start: facts checked

- `src/LandingPage.tsx` is one column: a hero (tagline, heading, sentence, button), a 9,500 records block, four questions from
  `src/lib/landingFaqs.ts`, and a second button. The FAQ list also feeds the FAQPage structured data, so its words must stay in the
  page's HTML.
- `PublicFrame` holds the header and footer still and scrolls only `main`. `SkyLayout` puts the home, sign-in and sign-up pages over
  the scenes. The scene caption sits at the bottom right.

## How it works when done

- **Eight scrolls:** the tagline, "Discover Your Cosmic Blueprint" with its button, the Jyotish sentence, the 9,500 records block, and
  one per question.
- **Icons:** two per edge, placed at random on each visit, clear of the scene caption at the bottom right. Each names its scroll on
  hover and to screen readers.
- **Opening:** one scroll at a time. It unrolls on the side its icon is on (top and bottom icons use the nearer side), with its
  middle at 66% of the page's height, in parchment with dark ink at a readable size. Its own content scrolls if a screen is too short;
  the page never does. On a phone it takes the width, since there is no side to use.
- **Closing:** the close mark, Escape, a click elsewhere, or opening another.
- **First visit to the page:** the blueprint is open, and rolls up after 10 seconds, unless the pointer or keyboard is on it.
- **Search:** closed scrolls are hidden from view but stay in the HTML, so the prerendered page and the FAQ data keep every word.
- **Reduced motion:** no unrolling or bobbing; scrolls simply appear.

## Recommendation

Build it in `LandingPage.tsx` with the placement as a pure, tested function. No new dependency.
