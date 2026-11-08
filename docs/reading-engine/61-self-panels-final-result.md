# 61 — The Self dashboard: the final result inside each panel, date-ranged, precise, and including the body

Status: **direction, 2026-11-07,** from Sachin's brief of that night, for the Self-dashboard session (docs 58, 59, 60)
to build to. His words, kept: the dashboard is not a huge reading in prose; the Self dashboard has sections, and the
text in each, the synthesis from the Vedic Astrological Oracle, is very precise and restricted by a date and time range
under which it is true; we are not doing a life reading in the Self dashboard, we are exploring their Self, and for
Western and current purposes that includes their body these days, what is going on with the body as seen from the
celestial sky.

Everything in docs 58 to 60 holds (one technique per panel, the dossier, the purview, the auditor, the bundle). This
doc fixes **what the person sees inside each panel** and adds the **body panel**.

## 0. Answer first

1. **A panel is a card of one to three lines, each line dated.** No paragraph. Every line is a claim with `valid_from`
   and `valid_to`, a plain sentence of at most 22 words, and "Chart details" one tap down. A natal line's range is the
   digest's validity (open-ended, shown as "always"); a timing line's range is the stored period or transit it rests on.
2. **The panel's header carries the range the whole panel is true for**: "True from 16 Nov 2025 to 1 Jan 2027" on the
   chapters and struggle panels (the running sub-period of the reading clock), "This year: 14 Mar 2026 to 3 Mar 2027" on
   the year panel, "Always" on the natal panels. A line outside the header's range is not on the panel.
3. **The Oracle writes lines, not prose.** Its output schema for the Self board is `self_reading.v1`: per panel, the
   lines (text, range, claim ids, certainty), plus one three-sentence diagnosis at the top. The validator rejects any
   line over 22 words, without a range, or without claim ids; the auditor grades each line on its own.
4. **A body panel joins the Self board** (§3): what the sky puts on the body these days, read from the 1st, 6th and 8th
   houses, the lagna lord, the Sun and the Moon, the running clock's lords against those houses, Saturn, Mars and the
   nodes on them, Sade Sati and slow transits over the lagna and the Moon from the stored sky, and D30 for the shape of
   pressure. It states facts of the chart and the sky with dates; it never names an illness, an organ or a diagnosis
   (doc 18's rule that health is facts only), and it says so on the panel.
5. **The Self board is "now", not "life".** The chapters panel keeps the previous, running and next mahadasha because
   that is how the person recognises the present; nothing else on the board looks further than the next chapter's
   first year. Lifetime claims ("you will always…") are banned words for this board.

## 1. The card contract every panel follows

```
SelfPanel {
  id, title, header_range: { from, to } | 'always',
  lines: [ { text (≤22 words), range: { from, to } | 'always', claim_ids[], certainty: 'fact' | 'strong' | 'moderate' | 'possible',
             detail: { placements[], periods[], rules[], rows[] } } ]  // 1 to 3 lines
  withheld?: { reason }                      // a panel with no grounded line shows nothing, never filler
  confirm?: { claim_id, question }           // the board's one question, on one panel only
}
```

Words on the card: the title, the header range ("True until 1 Jan 2027" / "Always" / "This year"), the lines, and the
"Chart details" affordance. No tone badge, no vote count, no "most of your chart points this way". Certainty shows only
on timing lines, as the four fixed words.

## 2. The final result inside each Self panel

The order is doc 59's. Each row says what the person reads, with the kind of line, the range, and what it must never
contain. Examples are the shape, not the words; the words come from the tables and, when the model layer is on, from the
Oracle within the schema.

| # | Panel | Header range | Lines (1–3) | Never |
|---|---|---|---|---|
| 1 | **In short** | True until <running sub-period end> | Three sentences: (a) the direction and footing of the self, natal; (b) the one tension now, with its release date if a running lord carries it; (c) where you stand this sub-period, dated. Example shape: "Your drive points at partnership and depends on others' ground. Until 1 Jan 2027 the pull is toward what you want and what it costs. This stretch favours finishing, not starting." | a fourth sentence; a life claim; praise without a row |
| 2 | **Your chapters** | True from <running MD start> to <running MD end> | (a) previous chapter: "From Feb 2010 to Feb 2019 the self was shaped by <faculty>", confirmed-by clocks named in detail; (b) running: "From Feb 2019 to Feb 2028 <faculty>; until 1 Jan 2027 the sub-chapter presses <faculty>"; (c) next: "From Feb 2028 <faculty>", shown only when confirmed or likely | a chapter sentence on split; a date not in the calendar; Vimshottari when the clock is another system |
| 3 | **Who you are** | Always | (a) where the self is pointed (L1's house); (b) how firmly it stands (dignity, avastha, star lord); (c) how the world sees you (AL) or who sits on the self, whichever the purview ranks higher | adjectives without a placement; "confident" from a sun sign |
| 4 | **Your mind** | Always | (a) feeling (Moon: house, dignity, cancellation if any); (b) thinking (Mercury); (c) peace or its lack (4th frame, Saturn's aspect) | a mental-health word; "anxious", "depressed" |
| 5 | **Your body** (§3) | True until <running sub-period end>, plus "Always" lines | (a) the body's natal footing (lagna, L1, Sun); (b) what presses on it now (running lord on 1/6/8, Saturn or Mars on lagna or Moon, Sade Sati) with dates; (c) the shape of pressure from D30, as a tendency, undated | an illness, organ, symptom, diagnosis, treatment, "see a doctor"; any claim without a row |
| 6 | **Your soul's aim** | Always | (a) what the soul is learning (AK faculty and house); (b) what you most want (karakamsa); (c) authority and faith (Sun, 9th, Jupiter) | a vocation as a verdict; renunciation as advice |
| 7 | **Gifts and knots** | Always | up to two gifts and one knot, each a named yoga with its planets and the faculty it touches | a yoga not in the engine's rows |
| 8 | **What you struggle with** | True until <running sub-period end> | (a) the heaviest affliction with its release date when a running lord carries it; (b) a standing affliction, undated, with what holds it (a grace); (c) a transit pressure from the stored sky, dated | doom words; a date not from a stored period or ingress |
| 9 | **This year** | This year: <TP from> to <TP to> | (a) what the year chart puts on the self (year lagna, natal L1's year house); (b) the year lord's relation to the self; (c) the running Mudda lord's sub-range inside the year | a verdict alone; a year chart when no TP row covers today |
| 10 | **One question** | — | one question about the In-short tension; yes / partly / no / rather not | a question about a gift; a second question |

Every panel shows its own validity range; the board shows "Built <date>, next check <running sub-period end>" once at
the bottom, in words, not as a badge.

## 3. The body panel (`self.reading.body`)

What the sky says about the body, as facts with dates. The audience is Western and current: a person wants to know what
the chart and the sky put on their body right now, in the same card shape as the rest. The rule is doc 18's: health is
facts only. The panel carries one line of standing text under its title: "What the chart and the sky put on the body.
Not medical advice; nothing here names a condition."

| Must read | Points | Clocks and layers | May claim |
|---|---|---|---|
| house D1 frames of h1 (the body), h6 (what wears it), h8 (what breaks and renews it); planet D1+D9 chains of L1, Su (vitality), Mo (fluids and rest), L6, L8; planet D1 chains of Sa, Ma, Ra, Ke where they sit on or aspect 1, 6, 8, the lagna lord or the Moon; D30 h1 frame and the D30 placements of L1, Mo, Sa (the shape of pressure); the lagna's cusp star and the Moon's star (gandanta flagged by the purview) | A6 (where strain shows), the lagna's degree band (sandhi) | the reading clock's running L1–L3 lords checked against 1, 6, 8 and L1; the stored sky overlay: Saturn, Jupiter, Rahu and Ketu over the natal lagna, Moon and L1 with dates; Sade Sati phase with dates | **natal, "Always":** the body's footing (lagna sign and its lord's dignity and house, the Sun's dignity), what wears it (h6 frame), the D30 shape as a tendency ("pressure tends to show as tiredness rather than heat", from the table keyed by the D30 sign class: fiery, airy, watery, earthy, and the planet there); **timing, dated:** "a running lord sits in the house of the body's wear, until <date>", "Saturn crosses your Moon from <date> to <date>: rest matters", "Mars on your lagna from <date> to <date>: heat and haste"; **never:** an organ, an illness, a symptom beyond the four classical shapes (heat, dryness, heaviness, fluids), a treatment, a prognosis, a diet, a doctor |

Rules the purview adds for this panel: a Neecha Bhanga on L1 or the Sun removes the "weak footing" line; a Sade Sati
line requires the sky overlay and its stored dates; a D30 line is always a tendency, never dated; two malefics on the
same body house produce one line, not two; the panel is withheld entirely when h1's frame or L1's chain is missing.

Words table (`BODY_WORDS`): one phrase per sign class and per planet on the body, reviewed by Sachin before use; the
model layer may not add body words outside the table.

## 4. What changes in docs 58 to 60

- Doc 58 §4.1 "Panels": add `self.reading.body` with the contract above; rename the Oracle's output to `self_reading.v1`
  as lines, not prose; the validator enforces the card contract (§1).
- Doc 59 §2: the Self display order becomes In short, Your chapters, Who you are, Your mind, **Your body**, Your soul's
  aim, Gifts and knots, What you struggle with, This year, One question.
- Doc 60: the dossier records each line's range and claim ids; the auditor grades per line; scenario S2 gains a body
  expectation (a pressed Moon under Saturn's transit with dates), S5 gains the sensitive-body rule (no body line on a
  loss passage beyond rest).
- Doc 45 §3.3 banned words gain the body list: illness, disease, diagnosis, symptom, organ names, medication, surgery.

## 5. Acceptance

A panel is done when: every line has a range and claim ids; no line is over 22 words; the header range equals the
stored period or chart it rests on; the body panel on S1 states the lagna lord's standing, the running lord against the
body houses with its end date, and nothing medical; and Sachin reads his own board and each line is one he can check
against the details below it.
