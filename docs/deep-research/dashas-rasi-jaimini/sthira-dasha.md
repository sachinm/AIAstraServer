# Sthira dasa (sthira daśā)

> "Fixed" dasa: each sign gets a fixed term by its nature (movable 7, fixed 8, dual 9 years; 96 years for the
> zodiac), starting from the sign of the Brahma planet. Both BPHS and Jaimini give it. Jaimini uses it in the
> longevity chapter: the life span (short/middle/long) is first fixed by other means, then the death-inflicting sign is
> sought in the matching third of the Sthira sequence. An ayur (longevity) dasa; used rarely and mostly by SJC and
> K.N. Rao's group as a cross-check.

## 1. Sources
- [TEXT] BPHS 46.168-169: years 7/8/9; start from the sign of Brahma graha; forward from odd, backward from even.
- [TEXT] BPHS 46.170-173: choosing Brahma graha (lords of 6th/8th/12th, strength and placement; Saturn/Rahu/Ketu
  rules; Rahu's degrees counted as 30 minus longitude).
- [TEXT] JS-BSR 2.3.3 "...kramad abdah sthira-dasayam" (7, 8, 9 years); 2.3.4 "brahmadir esha" (starts from Brahma);
  2.1.47-52 (Brahma defined); 2.1.30 "sthira-dasayam yatha-khandam nidhanam" (death in the khanda that matches the
  life span); 2.1.31 note (three khandas of four signs each).

## 2. When it applies
[TEXT] JS-BSR 2.1.30-31: after longevity is classed (alpa/madhya/purna), death is looked for in the first, second or
third group of four Sthira dasas; a maraka dasa that falls in an earlier khanda brings illness, not death (BSR note).
[MODERN] K.N. Rao cross-checks Chara results with Sthira (KNR article mention).

## 3. Inputs required
Brahma graha (see brahma-dasha.md section 4.1); sign of Brahma; sign types; lagna oddity if the Jaimini 2.3.26
reading is used.

## 4. Calculation
1. Seed = sign occupied by Brahma graha [TEXT BPHS 46.168; JS 2.3.4].
2. Direction: odd seed forward, even seed backward [TEXT BPHS 46.169]. Jaimini 2.3.4 does not state direction here;
   BSR's 2.3.26 (odd lagna -> start from Brahma's sign; even lagna -> from the 7th from Brahma) may be read as
   belonging to Sthira or to Brahma dasa (see brahma-dasha.md) [interpretation dispute].
3. Years: movable 7, fixed 8, dual 9 [TEXT]. Total 96.
4. Antardasa: not specified for Sthira in either text; general rule C5 (00-overview) applies.
5. Balance at birth: BPHS 46.190 general rule if applied; Jaimini practice starts the first dasa at birth.

## 5. Interpretation rules
- [TEXT] JS-BSR 2.1.30-34: the dasa that kills is a "cruel" sign (between malefics, malefics in its trines, malefics in
  its 8th/12th, or the 8th/12th whose lords are aspected by weak Moon and Venus) inside the khanda matching the life
  span; sub-period found via the navamsa aspected by the lord of the 6th from the first dasa sign (BSR, Raman's note
  doubts Rao's reading).
- [TEXT] JS-BSR 2.1.28-29: full Moon and Venus as karakas add one rasi dasa to life; Saturn takes one away.

## 6. Variants and disputes
- Direction: BPHS odd/even; ENGINE always forward.
- Whether Sthira and "Brahma dasa" are the same: BSR treats 2.3.25-26 (years from 6th lord) as a separate
  Brahma-started dasa; Rath/JHora list Brahma dasa separately.

## 7. Worked micro-example
Brahma in Libra (movable, odd): Li 7, Sc 8, Sg 9, Cp 7, Aq 8, Pi 9, Ar 7, Ta 8, Ge 9, Cn 7, Le 8, Vi 9.

## 8. Design notes for AI Astra
- Longevity dasa: not for user-facing readings. If kept, only as an internal "hard period" signal after a product
  decision.
- ENGINE (`sthira.py`): forward only — differs from BPHS 46.169 (filed via research notes for the caller).
- Weight: low. Pitfall: depends on Brahma graha, whose selection itself varies (see brahma-dasha.md).

## 9. Open questions
- Which Brahma rule the engine's `house.brahma` implements (BPHS 46.170-173 vs JS 2.1.47-52).
