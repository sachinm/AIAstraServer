# SLOW-UI.MD — UI items that need slower review (separate agent)

| Id | Found in | Observation | Why it needs review |
|---|---|---|---|
| SUI-01 | P1-06 | The understanding line is grey italic 14 px on the starfield background; the pills use 12 px text with thin coloured borders. | Contrast and tap-target review (WCAG) on the translucent bubble; a darker bubble fill may be needed. |
| SUI-02 | P1-08 | Pills wrap to two rows on a phone; the table shows a horizontal scroll bar under it. | Looks right on the demo data; check long subject names and the three-subject case (Q12) which adds pills per analyst but merges them by name. |
| SUI-03 | P1-06 | The pulsing animation on running pills uses `animate-pulse`; people with reduced-motion settings still see it. | Add `motion-reduce:animate-none`. |
| SUI-04 | P1-07 | In legacy mode (no events) nothing changed, as intended. | Keep a Playwright-style smoke test for this once the web repo has one. |
