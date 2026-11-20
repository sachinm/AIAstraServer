# 09 · Depth baseline, 2026-11-19 (before the full-thread reading)

The depth replay (`scripts/depth-replay.ts`, AGENTS.md "Reading depth is a release gate" rule 5) run read-only against
the shared database on 2026-11-19, on branch `feat/reading-depth` before any reading change: the newest stored
`self.card.reading` row per kundli and card. No model call, no write. Counts and ids only.

How each column is measured (`src/reading/cards/depthReplay.ts`):

- **schema**: `new` when the stored Oracle card carries a `story`; every row today is `old`.
- **technical words**: the new `story`, or for an old row everything the Oracle wrote (headline, gift, knot, and each
  span's asks, obstacle and agreement).
- **plain words**: the new plain `story`, or for an old row the line, the why and each span's asks, obstacle and step.
- **charts / systems cited**: from the kinds of the evidence keys the Oracle cited (`classifyKey` in
  `src/reading/cards/story.ts`): `planet:/house:/point:D<n>` a divisional chart, `annual:` / `pressure:annual:` the
  year chart, `pressure:dasha:` / `activation:` a dasha system.
- **floor / gaps**: `checkDepth` (rule 1): technical story at least 700 words; a maha dasha (level 1) and a sub-period
  (level 2) cited; the year chart; D9; the card's own chart (`ownChartsOf`); at least two dasha systems; plain story at
  least 350 words. The verified-systems list is not applied here (every cited system counts), so the systems column
  is the upper bound.

## Result

| kundli | card | schema | made | technical words | plain words | charts cited | systems cited | keys | floor | gaps |
|---|---|---|---|---:|---:|---|---|---:|---|---|
| c584c0a3 | allies_contracts_disputes | old | 2026-11-19 | 142 | 52 | D1 | dwisatpathi, narayana, yogini | 11 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | allies_networking_allies | old | 2026-11-19 | 132 | 59 | D1 | dwisatpathi, narayana, yogini | 11 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | body | old | 2026-11-19 | 105 | 67 | D30 | dwisatpathi, narayana, yogini | 8 | fail | story_words, maha, year, d9, plain_words |
| c584c0a3 | chapter | old | 2026-11-18 | 112 | 60 | - | dwisatpathi, yogini | 5 | fail | story_words, maha, sub, year, d9, own_chart, plain_words |
| c584c0a3 | chapters | old | 2026-11-19 | 103 | 58 | D1, year | yogini | 9 | fail | story_words, maha, sub, d9, own_chart, systems, plain_words |
| c584c0a3 | dating_attraction_pattern | old | 2026-11-19 | 127 | 62 | D1, D9 | dwisatpathi, vimsottari, yogini | 8 | fail | story_words, sub, year, plain_words |
| c584c0a3 | dating_breaking_patterns | old | 2026-11-19 | 122 | 66 | D1, D9 | dwisatpathi, narayana, vimsottari | 13 | fail | story_words, year, plain_words |
| c584c0a3 | dating_delays_blocks | old | 2026-11-19 | 114 | 61 | D1, D9 | dwisatpathi, vimsottari, yogini | 10 | fail | story_words, maha, year, plain_words |
| c584c0a3 | dating_exes_closure | old | 2026-11-19 | 119 | 70 | D1, D9 | dwisatpathi, narayana, yogini | 12 | fail | story_words, maha, year, plain_words |
| c584c0a3 | dating_intimacy_safety | old | 2026-11-19 | 133 | 63 | D1, D9 | dwisatpathi, narayana | 11 | fail | story_words, maha, year, plain_words |
| c584c0a3 | dating_karmic_compatibility | old | 2026-11-19 | 127 | 57 | D1, D9 | dwisatpathi, narayana, vimsottari | 9 | fail | story_words, sub, year, plain_words |
| c584c0a3 | dating_meeting_timing | old | 2026-11-19 | 102 | 60 | D9 | dwisatpathi, yogini | 8 | fail | story_words, maha, year, plain_words |
| c584c0a3 | dating_pulse | old | 2026-11-19 | 119 | 71 | D1 | dwisatpathi, vimsottari | 10 | fail | story_words, sub, year, d9, own_chart, plain_words |
| c584c0a3 | dating_transition_commitment | old | 2026-11-19 | 118 | 69 | D1, D9 | dwisatpathi, yogini | 7 | fail | story_words, maha, sub, year, plain_words |
| c584c0a3 | diagnosis | old | 2026-11-19 | 149 | 63 | D1, D9, year | dwisatpathi, narayana, yogini | 11 | fail | story_words, maha, sub, own_chart, plain_words |
| c584c0a3 | drive | old | 2026-11-19 | 101 | 54 | D1 | dwisatpathi, narayana, yogini | 10 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | friends_boundaries_drains | old | 2026-11-19 | 154 | 63 | D1 | dwisatpathi, narayana, vimsottari | 13 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | friends_core_allies | old | 2026-11-19 | 153 | 70 | D1, D9 | yogini | 8 | fail | story_words, maha, sub, year, systems, plain_words |
| c584c0a3 | friends_finding_tribe | old | 2026-11-19 | 148 | 69 | D1, D9 | narayana, yogini | 8 | fail | story_words, maha, sub, year, plain_words |
| c584c0a3 | friends_mentors_guides | old | 2026-11-19 | 104 | 63 | D1, year | dwisatpathi, yogini | 10 | fail | story_words, maha, d9, own_chart, plain_words |
| c584c0a3 | friends_outgrowing_circles | old | 2026-11-19 | 149 | 57 | D1 | dwisatpathi, narayana, vimsottari | 11 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | friends_reputation_belonging | old | 2026-11-19 | 135 | 71 | D1 | dwisatpathi, yogini | 10 | fail | story_words, maha, sub, year, d9, own_chart, plain_words |
| c584c0a3 | friends_social_energy | old | 2026-11-19 | 116 | 61 | D1 | dwisatpathi, narayana | 11 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | lagna | old | 2026-11-19 | 130 | 67 | D1, D9 | dwisatpathi, yogini | 9 | fail | story_words, maha, sub, year, plain_words |
| c584c0a3 | marriage_timing_readiness | old | 2026-11-19 | 161 | 68 | D1, D9, year | dwisatpathi, yogini | 9 | fail | story_words, maha, sub, plain_words |
| c584c0a3 | mind | old | 2026-11-19 | 115 | 72 | D1, D9 | dwisatpathi, vimsottari | 9 | fail | story_words, sub, year, own_chart, plain_words |
| c584c0a3 | presence | old | 2026-11-18 | 126 | 59 | D1 | dwisatpathi, yogini | 7 | fail | story_words, maha, sub, year, d9, own_chart, plain_words |
| c584c0a3 | stuck | old | 2026-11-19 | 114 | 66 | - | dwisatpathi, narayana | 7 | fail | story_words, maha, year, d9, own_chart, plain_words |
| c584c0a3 | year | old | 2026-11-19 | 146 | 65 | D1, year | dwisatpathi, yogini | 9 | fail | story_words, maha, sub, d9, own_chart, plain_words |
| c584c0a3 | yogas | old | 2026-11-18 | 143 | 57 | D1 | vimsottari | 10 | fail | story_words, maha, sub, year, d9, own_chart, systems, plain_words |

**floor: 0 of 30 pass · median technical 127 words (max 161) · median plain 63 · year chart cited on 5 · D9 on 14 · two or more systems on 27**

No stored card passes the floor. The longest technical text is under a quarter of the 700-word floor, the plain text
about a fifth of 350; the year chart is cited on few cards and the card's own chart on almost none. This is the "before"
column for the paid replay of doc 09 §8 step 12/13 (run the script again with `--since <release day>`).
