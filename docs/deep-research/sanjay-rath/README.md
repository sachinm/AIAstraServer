# Sanjay Rath's method: research set

What Sanjay Rath (and, where he is silent, his students) teach about reading a chart, in the order the product needs
it: sources, procedure, the Jaimini tools, dashas, timing, vargas, each life area, yogas and remedies, then how the
assistant verifies a chart, what it asks, how this maps onto the existing techniques, and what stays open. Written
2026-11-18 from the research notes listed at the end. The computation backend is called "the calculation engine"
throughout.

## Files

| File | What it covers |
|---|---|
| [01-sources-and-lineage.md](01-sources-and-lineage.md) | Rath's books and pages, his students, the source tiers, what was read and how |
| [02-reading-procedure-and-precedence.md](02-reading-procedure-and-precedence.md) | Order of reading, which reference point for which question, drishti against argala, strength tie-breaks, functional nature |
| [03-jaimini-apparatus.md](03-jaimini-apparatus.md) | Chara karakas, karakamsa, arudha padas, special lagnas, argala |
| [04-dasha-selection-and-ranking.md](04-dasha-selection-and-ranking.md) | Vimshottari seed and riders, conditional dashas, which rasi dasha answers which question |
| [05-timing-transits-annual-prashna.md](05-timing-transits-annual-prashna.md) | Transits, Tithi Pravesha, Sudarshana, multi-method agreement, prashna and muhurta |
| [06-vargas.md](06-vargas.md) | Divisional charts, karya bhava and karyesha, varga Narayana |
| [07-self-mind-spirituality.md](07-self-mind-spirituality.md) | Temperament, fortune, spirituality and the personal deities |
| [08-career-and-wealth.md](08-career-and-wealth.md) | Tenth house, AL and A10, D10; wealth from the AL, HL and Sudasa |
| [09-love-marriage-children-family.md](09-love-marriage-children-family.md) | Romance, marriage, children, parents, siblings |
| [10-health-education-property-travel-litigation.md](10-health-education-property-travel-litigation.md) | Health (sensitive), education, property and home, travel, enemies and debts |
| [11-yogas-afflictions-protections-remedies.md](11-yogas-afflictions-protections-remedies.md) | How a yoga is tested, the affliction order, protections, remedy selection |
| [12-chart-verification-and-rectification.md](12-chart-verification-and-rectification.md) | Rath's worked rectification order, Rao's dissent, consultation stance, prashna for lost data |
| [13-user-questions.md](13-user-questions.md) | The question bank: 54 one-tap questions with the chart factor each tests, prerequisite, fact key and sensitivity |
| [14-technique-mapping.md](14-technique-mapping.md) | 75 Rath methods mapped onto existing technique ids, with verdicts, engine inputs, a top 10 and one first step |
| [15-sensitive-rules-and-gaps.md](15-sensitive-rules-and-gaps.md) | Sensitive rules (titles only), every open gap and unread source, corrections to earlier reports |

## Source tiers

| Tier | Meaning |
|---|---|
| **[A]** | Rath's own text: a book by him (*Crux of Vedic Astrology: Timing of Events*, *Narayana Dasa*) or an srath.com page with his byline. Most srath.com pages were read through a summarising fetch, so they are paraphrase. |
| **[B]** | His students and SJC teachers, chiefly P.V.R. Narasimha Rao (*Vedic Astrology: An Integrated Approach*, who calls Rath his guru), Visti Larsen, Sarajit Poddar, Sarbani Rath. Where Rao departs from Rath, the file says so. |
| **[C]** | Third party: general sites, forum reposts, Scribd uploads with no verified author. |
| **[Inferred]** | Our reading of the sources; stated by no one. |
| **[Sensitive]** | A rule about death, longevity, serious illness, pregnancy loss, curses or black magic. Named only; not for use until the product owner decides (file 15). |

## Rath in one page

Assembled from files 02-12, not printed by Rath. He prints no ranking of methods; the firm order below is his student
Rao's (tier B), with Rath's ten house factors as the content of each step.

1. **Verify the chart first.** Confirm the rising sign by appearance, then fix the D3, D9 and D7 lagnas against known
   family facts, with formula tools (Kunda) last; confirm the past aloud before any forecast [A]. Rao: events only [B].
2. **Pick the varga and house for the question, then the reference point** (lagna for the true self, Moon for the mind,
   AL for status and perception, karakamsa for the inner self, HL for wealth, GL for power) [B]; no lagna outranks
   another [Inferred].
3. **Judge the house by ten factors** (house, lord, dispositor, arudhas, karakas, yogas, argala, varga last); argala
   decides, rasi drishti is lasting and graha drishti is active [A]; occupancy beats dignity in strength ties [B].
4. **The varga confirms or overrides the D1** (D7 final on children; raja yoga confirmed in D5 and D10) [A].
5. **Pick the dasha by the question:** Narayana for events and environment, Vimshottari for the mind (seeded from the
   stronger star of lagna and Moon; a second Rath text adds Utpanna), Sudasa for prosperity, Drig for spirituality, varga Narayana per life area [A];
   agreement between them is our inference.
6. **Place it in a year** with the Tithi Pravesha chart, which the natal chart overrides [A] cast rule, [B] reading
   rules; transits have no stated Rath doctrine.

## How to use this set

**For technique authors.**
- Start from [14](14-technique-mapping.md): find the method's row, its existing technique id and its verdict.
- Read the topic file (02-11) for the rule and its tier before changing a technique; carry the tier into the
  technique's `source` text, and never label an assembled order as Rath's own.
- Anything that computes (a house count from the AL, a dasha seed, an argala type) is an engine addition. Node
  computes nothing astrological.
- Check [15](15-sensitive-rules-and-gaps.md) before using any rule about death, illness, fertility or curses.

**For question design.**
- Start from [13](13-user-questions.md). Each question names the chart factor it tests, its prerequisite fact and the
  key it is stored under. The rules: the chart leads, one tap, stored once, no chart terms, no prediction in the
  question (AGENTS.md; docs/reading-engine/48).
- Rath's order for verification is in [12](12-chart-verification-and-rectification.md). Ask only questions whose answer
  separates the candidates that remain.

## Earlier work this set builds on

- Reports: `reports/Sanjay Rath method summary.md`, `reports/Sanjay Rath life area readings.md`
- Notes for this set: `research_notes/Sanjay Rath methods and precedence/` (procedure and precedence, dasha selection,
  timing and confirmation, other life areas, yogas and remedies, verification and questions, and the inventory of
  existing techniques, question mechanisms and engine capabilities)
- Earlier notes: `research_notes/Sanjay Rath method summary/`, `research_notes/Sanjay Rath life area readings/`,
  `research_notes/Sanjay Rath open method gaps/`
- Codebase findings from this set are filed in `docs/TODOS.md` under "Sanjay Rath research findings (2026-11-18)".
