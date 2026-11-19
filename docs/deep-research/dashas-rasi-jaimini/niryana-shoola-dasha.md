# Niryana Shoola dasa (niryāṇa śūla daśā) = BPHS "Shoola dasa" (from the stronger of 2nd and 8th)

> The dasa Parasara simply calls Shoola: it starts from the stronger of the 2nd and 8th (the maraka houses), moves
> forward or backward by the odd/even of that sign, and gives 7/8/9 years. PVR renamed it "Niryaana Shoola" to avoid
> clashing with the Jaimini Shoola dasa (see shoola-dasha.md for the name table) and calls it one of the most reliable
> dasas for timing death. Ayur dasa only.

## 1. Sources
- [TEXT] BPHS 46.181-182: start from the stronger of 2nd and 8th; direction by odd/even; years as Sthira; the
  stronger maraka sign may bring death in its dasa.
- [TEXT] JS-BSR 2.4.16 "niryana... shooladasa phale": in judging, take the 7th from the niryana shoola dasa sign first;
  BSR note: niryana shoola is of several kinds (Rudra, Maheswara, Brahma shoola).
- [MODERN] PVR-VA ch. 22 (22.2.1 computation, 22.2.2 interpretation; footnote naming Rath for the other "Shoola").

## 2. When it applies
Timing of death after longevity class is fixed. Not for general results.

## 3. Inputs required
Strength of 2nd vs 8th (ayur strength rules); sign types; Rudra, Trishoola signs; longevity class; navamsa positions
for antardasa candidates.

## 4. Calculation
1. Seed = stronger of 2nd and 8th [TEXT BPHS 46.181].
2. Direction: odd seed forward, even seed backward over all 12 signs [TEXT; PVR].
3. Years: movable 7, fixed 8, dual 9 [TEXT].
4. Antardasa: "classics are not clear" — PVR suggests Narayana antardasa rules [MODERN]. General BPHS rule C5 also
   possible.

## 5. Interpretation rules
- [TEXT] BPHS 46.182: death in the dasa of the stronger maraka sign.
- [MODERN PVR-VA 22.2.2]: dasas of strong maraka signs or signs holding strong marakas; usually a Trishoola sign
  (trines from Rudra) whose dasa falls in the life-span band; else the sign with Rudra in the 12th. Death antardasa:
  6th/7th/8th/12th from the dasa sign, or a sign aspecting the navamsa-sign of the 8th lord from the dasa sign.

## 6. Variants and disputes
Name only (see table in shoola-dasha.md). Some software labels this "Shoola", others "Niryana Shoola".

## 7. Worked micro-example (PVR Example 84, paraphrased)
2nd Sagittarius stronger than 8th Gemini; Sg odd -> Sg 9, Cp 7, Aq 8, Pi 9, Ar 7, Ta 8, Ge 9 (ages 48-57). Ge is the
only Trishoola sign in the middle-life band; native died at 50.

## 8. Design notes for AI Astra
Not user-facing. ENGINE `nirayana.py` follows BPHS/PVR (odd/even direction, 7/8/9). Keep id `shoola.bphs_niryana`.

## 9. Open questions
None for product; longevity output is out of scope.
