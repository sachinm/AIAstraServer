# Shoola dasa (śūla daśā), Jaimini form from the stronger of lagna and 7th

> Name warning first:
>
> | Name used | Start | Years | Direction | Text | PVR-VA name | Engine |
> |---|---|---|---|---|---|---|
> | Jaimini "shoola dasa" (this file) | stronger of 1st and 7th | 9 each | regular (PVR) | JS-BSR 2.3.18, 2.1.37-43, 2.2.4-11 | "Shoola dasa" (ch. 23) | `shoola.py` |
> | BPHS "Shoola" | stronger of 2nd and 8th | 7/8/9 | odd fwd / even back | BPHS 46.181-182 | "Niryaana Shoola" (ch. 22) | `nirayana.py` |
>
> "Shoola" (Shiva's trident) also names the trines 1/5/9 from a sign: the "shoola dasas" of a sign are the dasas of its
> three trines. Jaimini uses them to time death of the native and of relatives (from the relevant house or karaka).
> An ayur dasa; SJC and PVR use it for death and suffering of self and relatives.

## 1. Sources
- [TEXT] JS-BSR 2.3.18 "...prathama-pranyadi shooladasa niryane": from the stronger of 1st/7th, its shoola (trine)
  dasas time death. 2.3.19-24: from the stronger of the 9th from 1st/7th (father), 4th (mother), 3rd (younger
  siblings), 5th (children), 11th (elder siblings), 9th (paternal relatives).
- [TEXT] JS-BSR 2.1.37-43: Rudra (stronger lord of 8th from 1st/7th); death in Rudra's sign or its trines (2.1.37 note:
  "Trikona dasas are what are technically called Shoola dasas"); two evil Rudras -> first shoola, one -> second, none
  -> third (2.1.40); short/middle/long life -> death in 1st/2nd/3rd shoola (2.1.43).
- [TEXT] JS-BSR 2.2.4-7, 2.2.10-11: parents' death in shoola dasas of Sun/Venus (father) or Moon/Mars (mother);
  wife's in shoola from Jupiter; children/uncles from their karakas.
- [TEXT] JS-BSR 2.4.17 "purushe samah samanyatah" (BSR: odd start -> regular order, 9 years each; even -> count from
  the 7th) — source PVR draws on for 9-year periods (inference).
- [MODERN] PVR-VA ch. 23 (computation, interpretation, relatives' shoola dasas); Rath named by PVR as using "Shoola"
  for this dasa.

## 2. When it applies
Death, disease and suffering of the native; death of relatives using the relative's house as lagna [MODERN PVR 23.5;
TEXT JS 2.3.19-24].

## 3. Inputs required
Strength of 1st vs 7th (ayur strength rules: luminaries' aspects weigh, PVR 15.5.2 warning); AL; Rudra, Trishoola
signs; longevity class; for relatives, the relevant house pair and sthira karakas.

## 4. Calculation [MODERN PVR-VA 23.2]
1. Seed = stronger of lagna and 7th.
2. Order: always regular zodiacal from the seed.
3. Years: 9 per sign (108 total). Antardasas: 12 x 9 months, found by the same rule treating the dasa sign as lagna
   (stronger of dasa sign and its 7th, then zodiacal).
4. Relatives: Pitri shoola from stronger of 9th/3rd; Matri from 4th/10th; Bhratri from 3rd/9th; Putra from 5th/11th;
   Dara = native's own (1st/7th).
5. Mundane use: compress 108 years into the chart's lifespan (PVR).

## 5. Interpretation rules
- [TEXT] JS 2.1.37-43, 2.3.18: death in the strongest/cruellest of the three shoola (trine) signs, in the khanda that
  matches the life span.
- [MODERN PVR-VA 23.3]: death when the dasa reaches AL, trines from AL, or the 3rd/8th from AL if malefics or marakas
  occupy/aspect them; signs occupied or aspected by AK or Jupiter rarely kill unless that planet is Rudra; first 4
  dasas (0-36) for short life, middle 4 (36-72) middle, last 4 (72-108) long.

## 6. Variants and disputes
- Name clash with BPHS Shoola (see table above).
- JS-BSR 2.4.17 gloss gives a 7th-sign start for even signs; PVR always starts at the stronger of 1/7 and runs
  zodiacally. Unresolved.

## 7. Worked micro-example
Lagna Leo, Aquarius stronger -> Aq, Pi, Ar, Ta... 9 years each (PVR example).

## 8. Design notes for AI Astra
- Not user-facing. Death and relatives' death timing must not appear on boards or in readings.
- If retained internally, the engine output should keep `shoola.jaimini` distinct from `shoola.bphs` (Niryana).
- ENGINE (`shoola.py`) matches PVR (forward, 9 years) and adds a second cycle.

## 9. Open questions
- Whether any product use (e.g. "difficult health periods") is acceptable at all; a policy question, not a research one.
