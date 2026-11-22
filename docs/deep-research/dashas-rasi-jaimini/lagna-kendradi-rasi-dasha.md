# Lagna Kendradi rasi dasa (lagna kendrādi rāśi daśā)

> Starting from the stronger of lagna and 7th, the dasas run through the four kendras, then the four panapharas, then
> the four apoklimas, with count-to-lord years. BPHS describes a "Kendradi" dasa; PVR teaches the lagna form as a dasa
> of material success, inferior to Sudasa (its Sree Lagna twin). Used in SJC/JHora.

## 1. Sources
- [TEXT] BPHS 46.175-176 (as summarised from the scan): signs in kendras from the stronger of lagna/7th begin; ordered
  by comparative strength; direction by odd/even; years as Chara. 46.177: a planet owning two signs takes the larger
  count. Translator note: Lagna and Atmakaraka versions exist, in rasi and graha forms.
- [TEXT] BPHS 46.6-11: "Kendra" and "Karaka" listed as separate dasas.
- [MODERN] PVR-VA ch. 19 (19.2 computation, 19.3 interpretation, 19.4 conclusion).

## 2. When it applies
[MODERN] Material prosperity periods (PVR: the kendra-first order is "trine-based" and ruled by Lakshmi).

## 3. Inputs required
Strength of lagna vs 7th; lord positions (Narayana years); Saturn/Ketu in seed; AK, AmK, GL, HL, AL positions for
interpretation.

## 4. Calculation [MODERN PVR-VA 19.2]
1. Seed = stronger of lagna and 7th.
2. Direction: odd seed forward, even backward (plain odd/even). Saturn in seed -> forward; Ketu in seed -> reversed.
   (PVR's text says "lagna" odd/even; his examples apply it to the seed.)
3. Order: kendras 1,4,7,10 from seed; then 2,5,8,11; then 3,6,9,12 (counted in the chosen direction).
4. Years: as Narayana (count to lord by footedness, minus one, own 12, ±1).
5. Antardasa: not stated by PVR; ENGINE uses odd/even from the dasa sign with Saturn/Ketu rules.

BPHS difference [TEXT]: within each group the order may go by comparative strength, not fixed 1-4-7-10.

## 5. Interpretation rules [MODERN PVR-VA 19.3]
Signs with AK tend to bring success; strong argala from AmK brings good advisers and political power; a sign holding
GL is a seat of power; lagna lord linking lagna to GL strengthens. PVR's Reagan example: Sagittarius dasa (AK, GL,
argala from AmK) during the presidency.

## 6. Variants and disputes
- Group-internal order: fixed 1-4-7-10 (PVR) vs strength order (BPHS summary).
- A published "Mandooka dasa" that PVR says is a variant of this dasa (see mandooka-dasha.md).

## 7. Worked micro-example (PVR, paraphrased)
Lagna Taurus stronger, even -> backward: Ta, Aq, Sc, Le, Ar, Cp, Li, Cn, Pi, Sg, Vi, Ge.

## 8. Design notes for AI Astra
- Work board secondary signal for "resources and standing" periods, below Sudasa and Narayana D10.
- ENGINE `kendradhi_rasi.py::kendradhi_rasi_dhasa` matches PVR (Saturn/Ketu, odd/even, Narayana years).

## 9. Open questions
- Cleaner BPHS 46.175-177 text to settle strength-ordered groups.
