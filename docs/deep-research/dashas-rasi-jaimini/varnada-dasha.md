# Varnada dasa (varṇada daśā)

> A sign dasa built on the Varnada lagna, the special lagna Jaimini defines from the lagna and the hora lagna. The
> sutras read here (adhyayas 1-2) define the Varnada lagna but not a dasa; the dasa itself is attributed by moderns to
> later Jaimini material. Its usual stated purpose in SJC circles is social standing / work environment, but no source
> for that was read. Section 4 describes only the engine and is unverified.

## 1. Sources
- [TEXT] JS-BSR 1.1.32 "sarvatra savarna bhava-rasayah" and BSR note: Varnada lagna computation from bhava (rising)
  lagna and hora lagna, counting from Aries for odd and from Pisces backward for even; 1.1.33 "na grahah" (Varnada
  applies to signs, not planets). BSR names Raghava Bhatta, "Pantha" and Nilakantha as the commentators who expanded
  this sutra [COMM reported].
- No text of a Varnada *dasa* read (Jaimini adhyayas 3-4 unavailable).
- [ENGINE] `varnada.py` (header: maha and antardasa OK, periods do not match JHora).

## 2. When it applies
Unverified.

## 3. Inputs required
Lagna, hora lagna (exact), Varnada lagna; the same for vargas if computed per varga.

## 4. Calculation (ENGINE, unverified)
Seed = stronger of lagna and hora lagna; forward if odd, backward if even; years = signs from Varnada lagna to the dasa
sign (`(dasa_sign - varnada_lagna) mod 12`); antardasas 12 equal from the dasa sign forward.

## 5. Interpretation rules
None found.

## 6. Variants and disputes
Varnada lagna itself has competing formulas (BSR's gloss vs others). Engine years rule unsupported by any text read.

## 7. Worked micro-example
Not given.

## 8. Design notes for AI Astra
Exclude from boards. Engine flag "unverified". Needs the classical text first.

## 9. Open questions
Classical source and purpose; correct years rule.
