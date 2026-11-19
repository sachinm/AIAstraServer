# Trikona dasa (trikoṇa daśā)

> A sign dasa starting from the strongest of the three trines (lagna, 5th, 9th). BPHS gives direction and years "as in
> Chara"; Jaimini names it and links its results to the paka/bhoga (dwara/bahya) reading. Separately, "trikona dasas"
> of a sign (its 1st, 5th and 9th) are Jaimini's "shoola dasas" in the longevity chapter — not the same thing. Little
> modern literature; supported in the engine and JHora.

## 1. Sources
- [TEXT] BPHS 46.183-184: start from the strongest of 1st, 5th, 9th; direction and years as Chara dasa.
- [TEXT] JS-BSR 2.4.24 "...trikone": among the trines the dasa starts from the strongest; 2.4.25: results ascribed to
  dwara/bahya signs apply to Trikona dasas too (malefic contacts -> disease, confinement).

## 2. When it applies
No eligibility given. General results by implication.

## 3. Inputs required
Strength of the three trines (C4); lord positions (Chara years); footedness.

## 4. Calculation
1. Seed = strongest of lagna, 5th, 9th [TEXT].
2. Direction "as Chara" [TEXT BPHS]: under the BPHS Chara rule this is the footedness of the 9th from the seed; the
   ENGINE instead uses odd/even of the seed.
3. Years as Chara (count to lord) [TEXT]; ENGINE uses Narayana years.
4. Antardasa: not specified; ENGINE runs from the dasa sign by its odd/even; header says it does not match JHora.

## 5. Interpretation rules
[TEXT] JS-BSR 2.4.25 with 2.4.4-6: malefics in the dasa sign and its bahya sign -> confinement/disease unless own sign
or near Jupiter; general 2.4.35-36.

## 6. Variants and disputes
Direction rule (footedness of 9th vs odd/even of seed) not settled.

## 7. Worked micro-example
Not given.

## 8. Design notes for AI Astra
Low weight; not proposed for boards. Engine output should state direction rule used.

## 9. Open questions
Any modern school that actually uses it in practice and for what.
