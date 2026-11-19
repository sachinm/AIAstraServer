# Mandooka dasa (maṇḍūka daśā, "frog" dasa)

> A sign dasa whose sequence "jumps like a frog". BPHS defines it plainly (start from stronger of 1st/7th, every third
> sign, Sthira years). The Jaimini sutra that names "manduka" (2.4.15) is read by Suryanarain Rao as a label for the
> jumping padakrama/kendradi sequences in general, not a separate dasa. Modern authors disagree sharply: one published
> "Mandooka dasa" is a kendradi variant that PVR says is not Mandooka at all. Use is rare; reliability unestablished.

## 1. Sources
- [TEXT] BPHS 46.179-180: start from the stronger of lagna and 7th; each next dasa is the third sign from the previous
  (skipping two); years as Sthira (7/8/9).
- [TEXT] JS-BSR 2.4.15 "...mandukas trikutah": BSR says the kendra-panapara-apoklima and movable-fixed-dual jumps of the
  previous sutras are why they are called "manduka" dasas.
- [TEXT] BPHS Kalachakra section ~46.96-100: Manduka, Markati, Simhavalokana are named movements inside Kalachakra.
- [MODERN] PVR-VA 19.4: mandooki gati is the 3rd/11th jump (from Parasara's Kalachakra); Mandooka dasa of D11
  (Rudramsa) is used for wars and death; a kendradi variant published by another author "is certainly not" Mandooka.
- [ENGINE] `mandooka.py` header: "K.N. Rao method" implemented; "Sanjay Rath method" not implemented.

## 2. When it applies
Not stated in BPHS. [MODERN] PVR: D11 Mandooka for wars/death.

## 3. Inputs required
Strength of 1st vs 7th; sign types; (variant-specific) lord positions.

## 4. Calculation
- BPHS form [TEXT]: seed = stronger of 1st/7th; order seed, +3rd, +3rd... (1, 3, 5, 7, 9, 11, then the even set; the
  text as summarised gives only "third sign each time" — how the 12 are completed, and the direction, are not stated
  in the scan summary); years 7/8/9.
- [MODERN] "K.N. Rao method" as implemented in the engine: seed = stronger of lagna and 7th; order from a fixed table
  (the seed's kendra group, then the other two groups), reversed when the seed is an even sign; years by inclusive count
  to the lord (no minus one), own sign 12, lord in 7th = 10 years (resembles the "MindSutra"/Raghava Bhatta Chara
  rule); antardasas run in the same table order from the dasa sign. Source text for this not found.
- [MODERN] Rath form (reported in engine comment): for even lagna, a different start sign. Unverified.

## 5. Interpretation rules
None given in the texts read.

## 6. Variants and disputes
Three incompatible definitions (BPHS third-sign; kendra-group "K.N. Rao"; PVR's 3rd/11th mandooki gati). The engine's
implemented version is the least textually supported.

## 7. Worked micro-example
Not given; sequence completion rule unclear.

## 8. Design notes for AI Astra
- Do not use on boards until a variant is chosen and sourced. Engine should expose `mandooka.bphs` (third-sign, Sthira
  years) as the textual baseline.
- ENGINE mismatch vs BPHS filed via research notes.

## 9. Open questions
- Exact BPHS wording for completing the 12-sign cycle and direction.
- Who published the kendradi "Mandooka dasa" PVR criticises, and whether it is the K.N. Rao method.
