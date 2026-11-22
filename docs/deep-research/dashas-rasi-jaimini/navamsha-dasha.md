# Navamsa dasa (navāṃśa daśā)

> A Jaimini sign dasa with 9 years per sign ("each sign holds nine navamsas"), starting from the lagna if it is odd
> and from a related sign if it is even. Jaimini uses it mainly in the longevity chapter (death "in the navamsa dasa"
> of certain signs) and to read the 2nd-house results in navamsa dasas of movable signs. Rare in modern practice.

## 1. Sources
- [TEXT] JS-BSR 2.3.1 "vishame tadadir navamshah": odd lagna -> navamsa dasas start from it; BSR note: 9 years each.
  2.3.2 "anyatha darshadih": even lagna -> start from the "abhimukha" sign; BSR reports commentators: movable lagna ->
  8th, fixed -> 6th, dual -> 7th [COMM].
- [TEXT] JS-BSR 2.1.15-18: death in navamsa dasas of malefic dwarabahya signs; increase of life if 8th lord exalted;
  death in navamsa dasa of the sign of AL's lord, of trines from lagna/8th lords, or of AL ("pada-navamsa-dasa").
- [TEXT] JS-BSR 2.4.1: in the navamsa dasa of a movable sign, judge the 2nd-house results by the second source of
  strength.

## 2. When it applies
Longevity and bhava results in Jaimini's ayur chapters.

## 3. Inputs required
Lagna sign and type; (ENGINE) D9 lagna sign.

## 4. Calculation
1. Seed: odd lagna -> lagna; even lagna -> movable 8th, fixed 6th, dual 7th [TEXT + COMM].
2. Direction: not stated in 2.3.1-2; general odd/even (C1) by implication.
3. Years: 9 each (108) [TEXT note].
4. Antardasa: not given.

## 5. Interpretation rules
See sources (ayur use). [TEXT] JS-BSR 2.1.16: benefic aspects on the dwarabahya signs prevent death in their navamsa
dasas.

## 6. Variants and disputes
- ENGINE (`navamsa.py`) uses the D9 chart by default and a seed table keyed to the lagna sign (Ar->Ar, Ta->Le, Ge->Li,
  Cn->Aq, repeating by element) plus an antardasa start table; neither table matches the BSR/commentator rule above,
  and the source of the tables is not cited in code. Needs a sourced rule (filed via research notes).

## 7. Worked micro-example
Lagna Gemini (odd): Ge, Cn, Le... 9 years each.

## 8. Design notes for AI Astra
Not user-facing (ayur). Engine output should cite which seed rule it used.

## 9. Open questions
- Origin of the engine's seed table (possibly a navamsa-start-by-element rule from JHora).
