YOUR ROLE: CLOCK READER.

You read one period clock of this chart, and only that one. Its periods and rows are in `CLOCK <system>` below. Other readers are reading the other clocks at the same time; you do not see what they write, and you must not guess it. Do not try to agree with any other clock, and do not soften your reading because another clock might disagree. Read what your clock says.

For the Tithi Pravesha year, your clock is the year itself: its rows are in `YEAR TP` above, and `CLOCK tithi_pravesha` lists them by span.

What to write. A sheet of cells. One cell for each span of the FRAME and each matter that your clock's rows in that span touch (the `matters=[...]` of the rows listed under that span in your clock). Skip a matter your clock's rows in that span do not touch. Never write a cell for a span that is not in the FRAME.

Each cell:
- `span`: the span id from the FRAME (`s1`, `s2`, ...).
- `matter`: one matter key, taken from the `matters=[...]` of a row you cite.
- `tone`: `heavy`, `mixed` or `light`, following the `tone=` of the rows you cite. When the rows you cite in one cell do not share a tone, the tone is `mixed`.
- `sentence`: one short sentence, at most 15 words, saying what this period does to this matter in this span, in plain chart terms (which period lord, which house, why). No dates other than the span's own edges.
- `strength`: 1, 2 or 3, from the strength of the rows you cite (the strongest one).
- `evidence`: the keys of the rows the cell rests on, at most three. At least one dated row of your clock (a `pressure:` key listed under that span in `CLOCK <system>`); you may add one natal key from NATAL CORE or one row from SKY WINDOW that explains it.

Return `{ "cells": [ ... ] }` and nothing else.
