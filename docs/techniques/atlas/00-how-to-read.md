# Technique atlas · how to read it

Written 2026-11-19. Documentation only: no product code, prompt, engine or data change comes from this folder.

Sachin's request: draw how each technique looks now beside what changes when the Sanjay Rath and classical research
(`docs/deep-research/`, `reports/`, `research_notes/`) is folded in, with how and why for each change, starting with the
Self, Love and Work dashboards, their sub-dashboards and lenses; and show which clock systems apply to a person, which
to combine, why not all forty, and how to read overlapping confirmations.

## What the drawings show

39 pairs were drawn: 6 for Self, 17 for Love, 10 for Work, 4 for the shared machinery and 2 for the clocks. Read
together they say nine things.

1. **The recipes and the code disagree on `develop`.** The 13 lens recipes tell the Oracle what to read and what never
   to read. The code that builds each Love and Work card's section is byte-for-byte the same as live, so those cards
   still receive D7 rows for romance, the A5, and periods from Yogini, Tithi Ashtottari and the karaka dasha, all of
   which the recipes forbid. See Love · Board pipeline and Work · Board pipeline.
2. **The routing table is mostly unused.** Each recipe says "use this card's route line". No request carries one. Only
   the promise charts and the sign dasha reach a card; the route's houses, year charts and points are never sent.
3. **Several routed charts are not in the pack.** D16, D20 and D24 arrive with the 1st house only; D5 and D11 are
   absent; the year reader keeps a fixed set, so the year D2, D20 and D24 never reach a card.
4. **The old timing block is still printed.** A card on `develop` is told the old Self-only chart routing and the
   over-or-under-36 line beside its new route, and the two disagree (for example D7 for the lagna card).
5. **Three clock rules are written but not enforced.** A conditional dasha that applies still becomes the reading
   clock in place of Vimshottari; Narayana's sub-periods still count toward tone although they are marked unverified;
   the Tithi Ashtottari year rows still set the year's tone although that system is marked "never".
6. **Agreement is counted five ways, and "confirmed" is fragile.** With three tone clocks, "three or more agree" needs
   all three. With a conditional dasha it can be met by Vimshottari, its own alternate and one other: two voices.
7. **One Work rule is scored backwards.** Rath: exaltation or debilitation in the D10 both show success. The code
   scores a debilitated D10 lord as a test (`area/career.ts:207`).
8. **Releasing `develop` switches the card path.** `CARDS_STORY_CONTRACT` and `LENS_LINEMEN` default to on, so a
   release turns the new one-card path on unless the environment sets them to 0.
9. **Five choices are the owner's.** Drig for the purpose cards and Naisargika for chapters (plan 07 kept them, doc 08
   dropped them); the A5 for friends (two readings of one verse); promise first or period first in the reading order;
   Sudasa on every card or only pay and money cards; and the wording per overlap region proposed in the Clocks chapter.

## The two sides of every pair

| Side | What it is | Commit |
|---|---|---|
| **Live today** | what the deployed staging server does | `release-candidate-staging` `0fc6bfa` |
| **With the research** | what `develop` already builds behind flags (plans 07 and 09: routing table, lens recipes, story contract, verified-systems list), plus what is still only planned | `develop` `9fc0cf3` |

A "technique" here is what reaches a card. Catalogue rows and spec documents that no card reads are listed once per
board under "Not wired", never drawn as a pair.

## Colours in the right-hand diagram

| Class | Meaning |
|---|---|
| `built` (green) | changed, and already built on `develop`; not deployed |
| `planned` (blue) | changed, not built yet; the row says what it needs (usually an engine field, plan 07 E1–E9) |
| `dec` (amber, dashed) | rests on a choice with no source, or on a decision not yet taken; the label says which |
| no class | same as live |

Plan 09 (approved) took plan 07's five decisions at their defaults: the age-36 rule kept as the owner's rule, the
year D1 read before the year D9, one gate in place of the counts, nakshatra rules applied to planets and star dashas,
and Vimshottari from the Moon. Nodes that rest on the first two are still drawn `dec`, because no source supports
them either way.

## Source tags

**Rath** his own text · **Student** P.V.R. Narasimha Rao or Poddar · **Text** a classical verse · **Yours** Sachin's
decision, no source found · **Inferred** assembled by the researchers or by us · **gap** the research is silent.

Claims the research files still print as Rath's but that are downgraded or secondary, and are never tagged Rath here:
Sudasa only when the Moon sign is stronger; Narayana "more accurate" for marriage; the Tithi Pravesha year lord and its
in-year dasha as Rath's own; "dasha promises, transit triggers" as Rath's; profession from the Karakamsa; the age-36
D1 with D9 rule; D11 as a gains or friendship chart; Yogini as an SJC clock.

## Layout of each pair (the page generator depends on it)

```
## <Board> · <Lens or group> · <Technique name>
<!-- pair id=<slug> board=<self|love|work|shared|clocks> lens=<lens or -> reaches=<yes|no> live=0fc6bfa dev=9fc0cf3 -->

### Live today
(mermaid flowchart; every node ends with its file and line at the live commit)

### With the research
(mermaid flowchart; changed nodes carry class built, planned or dec)

### Changes
| Change | Why | Source | Research file and heading | State | Needs |

### Stays the same
(one line)

### Open
(one line, or "None")
```

"State" is one of: built on develop · planned · decision. "Needs" is one of: nothing (release only) · prompt ·
server code · data pull · engine E<n> · Sachin.

## Files

- `01-self.md` Self board and its five lens groups
- `02-love.md` Love board, the house layers, and its four lenses
- `03-work.md` Work board, the Work-only votes, and its four lenses
- `04-shared-machinery.md` timing and routing block, clock layer, year frame, status rule
- `05-clocks.md` which clocks apply to a person, why not all forty, the overlap figures, reading order
- `img/*.svg` the overlap figures
