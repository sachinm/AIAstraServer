# Chara dasa (cara daśā)

> The best-known Jaimini sign dasa: twelve periods, one per sign, each lasting as many years as the sign's lord is
> distant from it. It answers "which house/sign is the stage of life now" and is read with chara karakas. BPHS gives
> its period rule by name (46.155-167); the Jaimini sutras give the counting rule (1.1.26-28) but the dasa *sequence*
> sutras (2.4.7-10) describe Padakrama order, which SJC calls Narayana dasa. The result is at least five incompatible
> "Chara dasas" in use. Widely used in India (K.N. Rao's BVB school, Jagannatha Hora default list); reliability depends
> entirely on which variant, so the engine must label variants.

## 1. Sources
- [TEXT] BPHS 46.155-156 (count to lord; footed groups), 46.157 (Mars+Ketu own Scorpio, Saturn+Rahu own Aquarius),
  46.158-166 (dual-lord ladder; exalted +1 / debilitated -1), 46.167 (9th from lagna sets direction; worked example
  with Libra) — archive.org BPHS vol. 2 djvu text (see 00-overview, code BPHS).
- [TEXT] JS-BSR 1.1.26 (odd forward / even backward), 1.1.27 "na kvachit" (exceptions), 1.1.28 "nathantah samah
  prayena" (years = count to lord, "mostly"), 1.1.34 (antardasa = dasa/12), 2.3.28 (9th from lagna odd -> regular,
  even -> reverse; start from lagna; Ketu benefic); a note in adhyaya 1 pada 2 (sutra number not checked) says Ketu
  is a benefic "in Chara dasa" only.
- [COMM] Suryanarain Rao's notes on 1.1.27-28 reporting "ancient commentators" (Raghava Bhatta, Nilakantha named at
  1.1.32 note).
- [COMM] Raghava Bhatta / Nrisimha Suri as reconstructed by SUT; Iranganti Rangacharya's *Jaimini Sutramritam* as
  summarised by SUT.
- [MODERN] KNR; Rath *Narayana Dasa* (via repo note `research_notes/Sanjay Rath open method gaps/chara_dasha.md`);
  PVR-2014; PVR mailing-list posts (jyotish-blog.blogspot.com 2005, via same repo note).

## 2. When it applies
- [TEXT] BPHS 46.6-11 lists Chara among dasas "not appropriate" for general use versus Vimsottari/Kalachakra; no
  eligibility condition is given.
- [MODERN] K.N. Rao uses it for every chart and all life areas, cross-checked against Vimsottari. Rath treats "Chara"
  as Narayana dasa for a movable seed sign (or any seed holding Saturn). PVR-2014 computes it separately per divisional
  chart.

## 3. Inputs required
Sign of every planet incl. Rahu/Ketu; lagna sign; exaltation/debilitation tables (and which node table: Rath uses
Rahu exalted Gemini / Ketu Sagittarius for phalita dasas); planet longitudes for tie-breaks; for PVR-2014 also Sun and
Moon signs and lord strengths; for Iranganti, gender; for varga variants, the divisional chart.

## 4. Calculation

### 4.1 Start sign
| Variant | Seed | Tag/source |
|---|---|---|
| Parasara | lagna (46.167 "count from the ascendant sign") | [TEXT] BPHS |
| Jaimini sequence sutra | stronger of lagna and 7th; BSR gloss: men prefer lagna, women the 7th if strong | [TEXT] JS-BSR 2.4.7 + gloss |
| K.N. Rao | lagna | [MODERN] (tertiary guide; KNR example starts at lagna) |
| Rath | stronger of lagna and 7th; rejects male/female split | [MODERN] |
| PVR-2014 | strongest of lagna, Moon and Sun signs by lord strength (citing Lomasha for lagna/Sun) | [MODERN] |
| Iranganti / Raghava Bhatta | lagna for men; 4th from lagna for women (forward if lagna odd, backward if even) | [COMM] via SUT |

### 4.2 Direction and order
- [TEXT] BPHS 46.167, JS-BSR 2.3.28: look at the 9th sign from lagna. Odd pada (Ar, Ta, Ge, Li, Sc, Sg) -> zodiacal;
  even pada -> reverse. BSR glosses "odd sign"; Parasara's word is pada (footed group). Order is plain sign-to-sign.
- [TEXT] JS-BSR 2.4.8-10 (Padakrama): movable start sign -> regular order; fixed -> every 6th; dual -> kendra-trine
  jumps. SJC files this under Narayana dasa; Iranganti applies it to Chara itself [COMM via SUT], with direction set by
  oddity of the lagna (not the 9th).
- [TEXT] JS-BSR 2.4.33 ("some acharyas" re Saturn) and JS-R 2.4.33 "sanau cet eke": Saturn in the seed makes the order
  zodiacal [MODERN Rath reading]. JS-R 1.1.8 "viparitam ketau": Ketu in the seed reverses [MODERN Rath reading].
- [MODERN] K.N. Rao: plain order, direction by the 9th (tertiary guide); no Saturn/Ketu exceptions reported.

### 4.3 Years per sign
| Rule | BPHS | BSR gloss | K.N. Rao | Rath | PVR-2014 | "MindSutra" reconstruction (SUT; only the 7th-lord = 10 years rule is tied to Raghava Bhatta himself) | Iranganti (SUT) |
|---|---|---|---|---|---|---|---|
| Count direction | by footedness of dasa sign | odd forward/even back with na-kvachit exceptions (= footed) | footedness | footedness | footedness | by oddity of the sign holding the lord | by oddity of the lord's sign, counted from the lord's sign to dasa sign |
| Minus one | not explicit in BPHS summary | example "Mesha to Simha = 5" (no minus) but "lord in 2nd = 1 year" (minus) — inconsistent | yes | yes (fn. 32: own sign 13-1 = 12) | yes | yes | no (men), yes (women) |
| Own sign | 12 (46.158 for Sc/Aq) | 12; also lord in 12th = 12 | 12 | 12 | 12 | 12 | 12 |
| Exalted / debilitated | +1 / -1 (46.164-166; the scan places it inside the Scorpio/Aquarius passage, so whether it applies to all signs is open) | +1 / -1 ("prayena") | none | +1 / -1, cap 12 | none | none | none |
| Scorpio / Aquarius | both lords in sign 12; one in sign -> count to the other; else to stronger sign (more planets; then dual > fixed > movable; then more years) | same ladder, plus prefer exalted lord | not fully specified (PVR calls it incomplete) | BPHS ladder + Jaimini strength; Ketu own sign Sc | both in sign 12; one in, take other; then more conjunctions, movable>fixed>dual(!), more years | Mars and Saturn only, nodes ignored | Mars and Saturn only |
| 7th-house lord | — | — | — | — | — | 10 years | — |
| Second cycle | not stated | not stated | KNR example repeats the same years in cycle two (Mesha 2 years, Vrisha 12 years again in 1996-2010), not 12 minus first | 12 minus first | not stated | not stated | not stated |

Note the PVR-2014 tie order (movable > fixed > dual) is the reverse of BPHS 46.158-166 (dual > fixed > movable) as
summarised from the BPHS scan; verify before implementing.

### 4.4 Antardasa
- [TEXT] JS-BSR 1.1.34: 12 sub-periods of dasa/12, counted forward if lagna odd, backward if even (BSR's gloss says
  lagna, not dasa sign).
- [TEXT] BPHS ch. 51 vv. 5-12 (this numbering): start from stronger of dasa sign and its 7th; odd forward / even back;
  movable all 12 in order, fixed every 6th, dual kendras from itself, its 5th and 9th.
- [MODERN] K.N. Rao: begin with the sign after the dasa sign, dasa sign last (tertiary guide; also how the engine
  implements "K.N. Rao").
- [MODERN] Rath: as Narayana (start from the sign holding the lord of the stronger of dasa sign / its 7th; odd/even of
  that sign; Saturn forward; Ketu reverses).
- [COMM via SUT] Iranganti: start from dasa sign with its padakrama. Raghava Bhatta ("MindSutra" reconstruction): as
  many antardasas as dasa years, one year each, starting from the lord's sign; pratyantaras 12 x 1 month.

## 5. Interpretation rules
- [TEXT] JS-BSR 2.4.35-36: benefic aspect/conjunction or strong/exalted lord -> good dasa; otherwise adverse.
- [TEXT] JS-BSR 1.2 note: Ketu acts as a benefic only in Chara dasa; JS-BSR 2.3.28 repeats "Ketu benefic".
- [TEXT] BPHS ch. 50 (rasi dasa effects by lord strength/placement), 50.90-96 (antardasa effects).
- [MODERN] K.N. Rao: aspects of chara karakas (7-karaka scheme) on houses counted from MD/AD/PD signs; karakamsa;
  upapada for marriage; DK for marriage and death; D7/D9/D12 for finer timing.
- [MODERN] Rath: see narayana-dasha.md section 5 (paka rasi, argala, badhaka, karakas in kendras).

## 6. Variants and disputes
- Is "Chara dasa" the same as Narayana dasa? Rath: yes for movable seeds; PVR (2005) calls Narayana a generalisation of
  Chara; K.N. Rao: no, Chara is its own system with plain order. Rath warns Chara dasa differs from "Chara Paryaya".
- Exaltation ±1: BPHS and BSR keep it; K.N. Rao rejects it because periods could reach 13 or 0; PVR dropped it in 2014.
- Which sutra carries ±1: Suryanarain Rao reads JS 1.1.27 "na kvachit" as exceptions to the count *direction*
  (Ta/Sc forward, Le/Aq backward) and hangs ±1 on the word "prayena" in 1.1.28. Rath cites 1.1.27 itself for ±1. Same
  sutra numbers, different readings.
- U.K. Jha (Saptarishis, reported) holds neither ±1 nor own-sign = 12 is in the sutras.
- SUT reports K.N. Rao's Chara dasa derives from Nilakantha's version, which does not use padakrama [COMM, second-hand].

## 7. Worked micro-example (BPHS rule, 46.167 example as summarised)
Lagna Libra example: the BPHS worked chart gives Aquarius 8 years and Aries 1 year; the scan cuts off before the full
cycle, so no full table is reproduced.

## 8. Design notes for AI Astra
- Engine output: one table per variant id (`chara.parasara`, `chara.knrao`, `chara.rath` = Narayana alias,
  `chara.pvr2014`, `chara.rangacharya`, `chara.raghava_bhatta`), each row carrying seed rule, direction rule, years
  breakdown (count, minus-one, ±1, dual-lord choice) and antardasa rule.
- ENGINE today (`chara.py`): `get_dhasa_antardhasa` always seeds with the PVR-2014 rule (lagna/Sun/Moon);
  `_dhasa_progression_knrao_method` (lagna seed) is never called. Method 1 uses the function named "knrao" (±1, two
  cycles, 12 minus first) and method 2 the "pvnrao" one (no ±1, single cycle), so the labels are crossed and no path
  gives a lagna-seeded K.N. Rao table. The antardasa list is the same rotated progression for every mahadasa (likely
  bug). The unused Raghava Bhatta / Rangacharya durations put 2 and 6 where a sign is expected for Scorpio/Aquarius;
  these look like the planet ids of Mars and Saturn, not their signs.
  These need engine fixes (filed via the research notes for the caller), not Node workarounds.
- Board use: Chara is a secondary confirmation for Self/Love/Work; prefer Narayana as the SJC rasi dasa. Weight below
  Vimsottari. Never show two Chara tables to users; pick one variant per product decision.
- Pitfall: Scorpio/Aquarius and exalted lords change dates by years between variants.

## 9. Open questions
- K.N. Rao's book rules (start, antardasa, Scorpio/Aquarius) unverified at source.
- Whether BPHS 46.155 itself includes "minus one" (scan summary silent).
- Whether BSR's "lagna" in 1.1.34 (antardasa direction) is a gloss or the sutra.
