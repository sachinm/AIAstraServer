# SLOW-UX.MD — UX items that need slower review (separate agent)

| Id | Found in | Observation | Why it needs review |
|---|---|---|---|
| SU-01 | P1-06 | With the single flow the person sees only "Chart facts ✓ Writing …" (two pills); with the graph flow six pills. Pills stay under the answer after it finishes. | Decide whether to collapse the pills into one "Read: promise, dasha, transits" line when the answer completes, and whether the single flow needs pills at all. |
| SU-02 | P1-06 / `chatWaitCopy.ts` | Until the first event arrives (about 200 ms plus network) the old text shows ("Preparing your answer… 0s"), and after 60 s it says "Detailed replies can take 1–3 minutes". With the reading engine the targets are 2 s to progress and 40 s to complete. | The copy and its timing thresholds should follow the engine's real latency, and the bouncing dots can be dropped once an intent line exists. |
| SU-03 | Phase 3 | The understanding line is read-only. The plan's clarify card (chips to change subject or horizon, "Yes, read it") is not built. | Needs a design pass with Sachin: when to interrupt (confidence under 0.8, more than two subjects), and how follow-up chips look. |
| SU-04 | P1-06 | The line says "I will read houses 10, 6, 1, D-10 …". House numbers are technical for some users. | Consider "your 10th house of work, the career chart (D-10)…" and whether to show Sanskrit with a gloss, as the persona does. |
| SU-05 | P1-08 | On a 375 px phone the message box sits below the fold until the page is scrolled (existing layout, not caused by this change). | Check on a real phone; the answer table already scrolls sideways. |
