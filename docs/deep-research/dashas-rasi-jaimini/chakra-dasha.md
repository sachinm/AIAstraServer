# Chakra dasa (cakra daśā)

> A Parasari sign dasa of 10 years per sign (120 years), so named because it runs round the 12-sign wheel. Its start
> depends on the time of birth: lagna for a night birth, the lagna lord's sign for a day birth, the 2nd house for a
> twilight birth. BPHS mentions it next to Kalachakra, which Parasara calls supreme; Chakra itself is listed among dasas
> "some sages" use. Rarely used.

## 1. Sources
- [TEXT] BPHS ~46.50-51 (scan numbering ±2): 10 years per sign; start by birth time (night lagna, day lagna lord's
  sign, twilight 2nd); named "Chakra dasa" because it covers the 12 signs. 46.6-11: "Kala" and "Chakra" dasas mentioned
  by some sages; Kalachakra supreme.
- [ENGINE] `chakra.py`.

## 2. When it applies
Not stated.

## 3. Inputs required
Sunrise/sunset at birth place and date, a twilight definition, lagna and its lord's sign.

## 4. Calculation
1. Seed: night -> lagna; day -> sign of lagna lord; twilight (sandhya) -> 2nd sign [TEXT].
2. Order: zodiacal [ENGINE; text summary does not state direction].
3. Years: 10 each [TEXT]. Antardasa: 12 x 10 months; ENGINE starts antardasas from the dasa sign forward (its own note:
   JHora's antardasa method unclear).
4. Twilight length is not defined in the text read. ENGINE: one-sixth of the day/night length around sunrise and
   sunset; note that its dusk branch returns the 2nd sign (`lagna+1`) as the text says.

## 5. Interpretation rules
None read; BPHS ch. 50 general.

## 6. Variants and disputes
Definition of twilight; direction.

## 7. Worked micro-example
Day birth, lagna Cancer, Moon in Pisces -> Pi, Ar, Ta... 10 years each.

## 8. Design notes for AI Astra
Research only. Engine applies it to annual charts too (`years` argument); no source read for that.

## 9. Open questions
Exact verse wording for twilight and direction.
