# Brahma dasa (brahma daśā; Brahma-graha-started rasi dasa)

> A longevity sign dasa that starts from the sign of "Brahma", the planet that "creates" the life span. Jaimini fixes
> the life span as running from Brahma's sign to Maheswara's sign, and (per Suryanarain Rao) gives a dasa started from
> Brahma whose years come from the lord of the 6th from each dasa sign. BPHS lists "Brahmagraha" dasa by name and
> defines Brahma graha for Sthira dasa. An ayur dasa; rarely used outside SJC software.

## 1. Sources
- [TEXT] JS-BSR 2.1.47 (Brahma = strongest of lords of 6th/8th/12th from stronger of lagna/7th, placed in an odd sign
  in the "parshva" half behind the 7th), 2.1.48 (if Saturn/Rahu/Ketu become Brahma, the 6th planet from it in weekday
  order takes over), 2.1.49 (several candidates -> the one next in degrees to AK), 2.1.50 (Rahu reverses), 2.1.51-52
  (lord of 8th from AK and planet in it can also be Brahma; stronger wins), 2.1.53 (life runs from Brahma's sign to
  Maheswara's sign), 2.1.54 (death in antardasa of trines from 8th lord of Maheswara).
- [TEXT] JS-BSR 2.3.25 "brahmadih purushe sama dasantah": odd (masculine) lagna -> dasas start from Brahma's sign;
  years = house number from the dasa sign occupied by the lord of the 6th from it (katapayadi "dasa" = 6).
  2.3.26: odd lagna -> regular from Brahma; even lagna -> from the 7th from Brahma.
- [TEXT] BPHS 46.6-11 (name "Brahmagraha" in list), 46.170-173 (Brahma graha selection, used for Sthira).

## 2. When it applies
Longevity (ayur) analysis only [TEXT JS 2.1.53-54].

## 3. Inputs required
Stronger of lagna/7th (C4), lords of 6/8/12 from it with strengths, signs and degrees; AK and 8th from AK; Rahu's
reversed degrees; lagna oddity.

## 4. Calculation
1. Find Brahma (JS 2.1.47-52 or BPHS 46.170-173; the two lists overlap but are not identical).
2. Seed: Brahma's sign (odd lagna) or the 7th from it (even lagna) [TEXT JS-BSR 2.3.25-26].
3. Direction: regular (BSR "in regular order"); some modern implementations use the seed's odd/even instead [ENGINE].
4. Years: count from the dasa sign to the sign of the lord of the 6th from it [TEXT JS-BSR 2.3.25]; ENGINE subtracts
   one, gives 0 for lord in the dasa sign, applies ±1 for exalted/debilitated.
5. Antardasa: not specified; ENGINE runs 12 equal parts from the dasa sign forward.

## 5. Interpretation rules
[TEXT] JS 2.1.53-55: life ends between Brahma's and Maheswara's dasas; death in the antardasa of a strong sign among
trines from the 8th lord of Maheswara; the strongest of lords of 3/6/8/12 from AK is the maraka; death in the dasa of
the sign it occupies or owns (2.1.56).

## 6. Variants and disputes
- BSR openly calls 2.1.47 obscure; Brahma selection differs among schools.
- Years from 6th lord (BSR 2.3.25) vs Sthira years: some treat 2.3.25-26 as a separate dasa (Brahma dasa), others as
  part of Sthira. Unresolved without the commentaries.

## 7. Worked micro-example
Not given; selection rules too disputed for a short example.

## 8. Design notes for AI Astra
- Not user-facing (death timing). Engine output only if a longevity research view is ever built.
- ENGINE (`brahma.py`): direction keyed to seed parity, while JS-BSR 2.3.26 keys to lagna parity; years
  minus-one/±1 additions are not in the sutra as translated. Filed via research notes.

## 9. Open questions
- Which commentary the engine's Brahma selection follows.
