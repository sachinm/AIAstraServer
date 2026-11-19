# Tara (Tara-amsa / Tara Lagna) rasi dasa (tārā daśā)

> Two different things share the name. (a) BPHS 46.6-11 lists a "Tara" dasa among non-preferred dasas; this research
> found no BPHS rules for it, and in common usage Tara dasa is a planetary dasa, so it is out of scope as a rasi dasa.
> (b) Jaimini 2.4.27 "tara-arkamse..." describes a sign dasa that starts from the sign reached by dividing the birth
> nakshatra into twelve parts, 9 years per sign, with wealth results judged from the starting lord. The engine's
> `tara_lagna.py` implements (b). Rare; Suryanarain Rao himself says he is unsure of the meaning.

## 1. Sources
- [TEXT] JS-BSR 2.4.27: divide the birth nakshatra into 12 parts; the part in which birth falls gives the starting
  sign (BSR offers two readings: counted from the lagna, or a "Chandra dasa" variant), 9 years each, forward/back by
  odd/even. 2.4.28-30: if the starting dasa's lord is exalted or debilitated the native is wealthy and influential; in a
  friendly sign moderately well off; otherwise poor.
- [TEXT] BPHS 46.6-11: name "Tara" only.
- [ENGINE] `tara_lagna.py`.

## 2. When it applies
[TEXT] JS 2.4.28-30 ties it to wealth/standing.

## 3. Inputs required
Moon's longitude within its nakshatra (or birth time within the nakshatra's duration), lagna sign, AK (engine).

## 4. Calculation
- [TEXT, BSR reading 1]: seed = lagna + (index of the twelfth of the nakshatra elapsed) signs; 9 years each; direction by
  odd/even of the seed.
- [ENGINE]: same seed by longitude (`lagna_sign + floor(fraction_in_nakshatra x 12)`), forward if seed odd, backward if
  even, 9 years each; antardasas start from the AK's sign (reversed if AK is in certain signs) — antardasa rule not in
  the sutra as translated.

## 5. Interpretation rules
[TEXT] JS-BSR 2.4.28-30 (above).

## 6. Variants and disputes
BSR is "very diffident" about the meaning. Close cousin of BPHS Lagnadi Rasi dasa and Sudasa (same "lagna + nakshatra
fraction" idea; whole signs here, exact degrees there).

## 7. Worked micro-example
Moon 40% through its nakshatra -> 5th twelfth -> lagna + 4 signs; lagna Taurus -> Virgo seed, even -> Vi, Le, Cn...

## 8. Design notes for AI Astra
Research only. Not for boards.

## 9. Open questions
Source of the engine's antardasa rule; any commentary on 2.4.27.
