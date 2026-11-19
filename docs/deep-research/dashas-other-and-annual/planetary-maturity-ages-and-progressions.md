# Planetary Maturity Ages and Progression-like Clocks (no classical Sanskrit name; Bhrigu/Nadi progressions)

> These are two families of "age clocks" outside the standard dasha texts.
> 1. **Maturity ages** ([MODERN]/folk, attributed variously to BPHS, Nadi or Lal Kitab). Each planet "matures", giving
>    its full results, at a fixed age: Jupiter 16, Sun 22 (or 21), Moon 24, Venus 25, Mars 28, Mercury 32, Saturn 36,
>    Rahu 42, Ketu 48.
> 2. **One-house-per-year progressions** in Nadi-derived practice, such as Bhrigu Chakra Paddhati. These are close
>    relatives of the classical Sudarshana year count.
>
> Neither has a verified classical verse. Both answer "at what age does this planet's promise ripen?" and are low
> reliability as timers.

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Ages Jupiter 16, Sun 22, Moon 24, Venus 25, Mars 28, Mercury 32, Saturn 36, Rahu 42, Ketu 48 | Modern sites, e.g. https://panchangbodh.com/planet-maturity-age-calculator. Attributed to BPHS without chapter or verse; not found in the BPHS chapters read (43, 44, 46, 74). | [MODERN] (unsourced) |
| Sun 21 instead of 22 | Other modern pages (search result set, 2026-11-18) | [MODERN], conflict |
| One house per year from the Lagna (also from the Moon and Sun) | BPHS 74 (Sudarshana); see `sudarshana-chakra-dasha.md` | [TEXT] |
| Bhrigu Chakra Paddhati (one house per year, 12-year cycle) | Modern Nadi-derived teaching; no primary text consulted | [MODERN]/Nadi |
| Naisargika life stages (a fixed-age planet clock that is classical) | BPHS 43.16–17; see `naisargika-dasha.md` | [TEXT] |

## 2. When it applies (which charts, which life areas)

- **Maturity ages.**
  - A planet's significations are said to show strongly at or after its maturity age.
  - Used for "late bloomer" readings: Saturn after 36, career stabilises; Venus at 25, relationships.
- **Progressions.** The yearly house of focus, as in Sudarshana.

## 3. Inputs required (exact chart data)

- The birth date (age).
- The natal planet strength and houses, to say what matures.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Maturity.** Planet *P* matures at the fixed age *A(P)* from the table above, the same for everyone. Some modern
   users read the year *A(P)* as an "activation year" for *P*'s houses.
2. **Progression.** At completed age *n*, the active house is (n mod 12) + 1 from the Lagna. This is identical to the
   Sudarshana year count.

## 5. Interpretation rules (tagged)

- **Promises ripen.** A planet's natal promise comes to fruition only after its maturity age, for example marriage
  promised by Venus after 25. [MODERN] folk rule.
- **Afflicted planets.** An afflicted planet's problems ease after maturity. [MODERN] folk rule.

## 6. Variants and disputes (school by school)

- **Sun's age.** 21 vs 22.
- **Attribution.** BPHS (claimed by sites, not found), Lal Kitab, Nadi.
- **Not a dasha.** These are not dashas in any classical sense.

## 7. Worked micro-example (optional, short)

A strong 10th-lord Saturn suggests career recognition consolidating after 36 (folk rule). Without a natal dasha (for
example a Saturn period near that age), this adds little.

## 8. Design notes for AI Astra

- **Engine.** If used at all, an engine constant table `maturity_age` with a `[MODERN]` source tag, returned beside the
  dasha data. Node does not hold the table.
- **Boards.**
  - You: a soft "this planet has come of age" note, only when the natal dasha agrees.
  - Never as a dated prediction.
- **Weight.** Very low.
- **Pitfall.** It is generic by age, and it breaks the product rule "specific to the person or not shown" unless it is
  tied to the person's own planet strength.

## 9. Open questions

- Find a primary source for the maturity ages. Candidates: Lal Kitab (1940s), Bhrigu Samhita traditions, Nadi
  granthas. Nothing verified this pass.
- Does Jataka Parijata or Phaladeepika give age-of-result rules (for example, "results of a bhava at the age of its
  karaka's years")? Not checked.
