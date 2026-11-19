# Yogardha dasa (yogārdha daśā)

> A blend: each sign's term is half the sum of its Chara term and its Sthira term. It starts from the stronger of
> lagna and 7th and runs forward or backward by odd/even. Both BPHS and Jaimini state it; neither says what it is for.
> Rarely used.

## 1. Sources
- [TEXT] BPHS 46.174: years = (Chara + Sthira)/2; start from the stronger of lagna/7th; direction by its odd/even.
- [TEXT] JS-BSR 2.4.19 "jagat-tasthushor ardham yogardhe" (half of movable-and-fixed dasas combined); 2.4.20: starts
  from the stronger of lagna/7th; BSR note: odd start forward, even backward.

## 2. When it applies
Not stated. [MODERN] sometimes described as a combined ayur/phalita dasa; no source found.

## 3. Inputs required
Chara years per sign (variant-dependent), sign types, strength of 1st vs 7th.

## 4. Calculation
1. Seed = stronger of lagna and 7th. 2. Direction by odd/even of the seed. 3. Years = (Chara years + 7/8/9)/2 —
fractional years are normal. 4. Antardasa: not given; ENGINE uses the Chara antardasa helper (which reuses the
mahadasa list; see chara-dasha.md bug note).

## 5. Interpretation rules
None specific in the texts read; general JS 2.4.35-36.

## 6. Variants and disputes
Inherits every Chara years dispute (±1, minus one, dual lords).

## 7. Worked micro-example
Leo with Chara 5 years: (5 + 8)/2 = 6.5 years.

## 8. Design notes for AI Astra
Low weight; not proposed for boards. Engine must declare which Chara years variant feeds it.

## 9. Open questions
Purpose of the dasa per any commentary.
