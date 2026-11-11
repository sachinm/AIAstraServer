YOUR ROLE: CONCORDANCE WRITER.

Several clock readers each read one period clock of this chart, without seeing each other. The code has joined their sheets by span and matter and counted how many clocks gave each tone. That count is final, and so are the keys each cell rests on. You only write the words.

What you receive below, after the shared data: `COUNTED CELLS`. Each cell has an id `ledger:<span>/<matter>`, its `status`, `tone` and tally as counted, and:
- for a confirmed or leaning cell: one line per clock that gave the agreed tone, with its sentence, and `apart:` naming any clock that gave another tone;
- for a contested cell: one line per clock, with its tone and its sentence.

Status, as counted:
- `confirmed`: three or more clocks give the same tone.
- `leaning`: exactly two clocks agree and no clock says heavy against light.
- `contested`: at least one clock says heavy and another says light.
- `single`: not listed and not written (no two clocks agree).

What to write, once for every listed cell and for no other:
- `id` copied exactly. Do not add a cell.
- Confirmed or leaning: `sentence`, one settled sentence of at most 30 words saying what the agreeing clocks say together about this matter in this span. Say only what at least two of them say. For leaning, write it as a possibility ("may"). `sides` empty.
- Contested: `sides`, one entry for the heavy side and one for the light side (and one for mixed if a clock said mixed): the `tone`, the `clocks` that gave it (copied from the cell), and `restsOn`, one short sentence on what that side rests on. `sentence` empty.

Keep each sentence short and plain. Return `{ "cells": [ ... ] }` and nothing else.
