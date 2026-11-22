# Jaimini longevity (āyurdāya): three-pair method, Rudra, Maheshvara, Brahma

> Jaimini (Adhyaya 2 Pada 1) classifies life span into short (alpa), medium (madhya) and long (purna) from the sign qualities (movable, fixed, dual) of three pairs: lagna lord and 8th lord, Saturn and Moon, lagna and hora lagna. Grades are then raised or lowered (kakshya vriddhi/hrasa) by Saturn, Jupiter, AK and malefic hemming. Rudra (destructive planet) fixes the Shoola (death) signs, Maheshvara (8th lord from AK) the end of the span, and Brahma (a protective planet) the start of Sthira dasha. It is a core Jaimini technique, mostly used by specialists; it is not a consumer feature.

## 1. Sources

- **JUS-A** Adhyaya 2 Pada 1 (Abhyankar 1951; numbers approximate from OCR): 2.1.1-4 lords of lagna and 8th: both movable, or fixed + dual → long; both dual, or movable + fixed → medium; both fixed, or movable + dual → short; 2.1.5 same from Saturn and Moon; 2.1.6 same from lagna and the "Ascendant Hour" (hora lagna); 2.1.7 accept the result if all three or two agree; 2.1.8 if none agree, take lagna + hora lagna; 2.1.9 if the Moon is in lagna or 7th, take Moon + Saturn; 2.1.10-14 Saturn as a pair member lowers a grade (some say raises); no reduction if Saturn in own/exaltation or aspected only by malefics; Jupiter in lagna/7th or benefic association raises; 2.1.15-21 death in afflicted dwara/bahya periods; 2.1.22-23 alternative from the house (kendra/panaphara/apoklima) of AK or the stronger of lagna and 8th lords, reversed if AK in the 9th from the 7th; 2.1.25-32 medium life if lagna lord = 8th lord; grade lowered by malefic hemming of lagna/7th or AK, or malefics in 5/9; raised by benefics; Moon or Venus in 2/6/8/12 raises one division, Saturn the reverse; ~2.1.38-47 **Rudra** = stronger of the two 8th lords (from lagna and from the 7th); weaker also Rudra if malefic-aspected; benefic aspect/association extends life to the end of the Shoola; death in the trine signs (trishula) of Rudra in the Shoola dasha matching the life grade; ~2.1.48-50 **Maheshvara** = lord of the 8th from AK; if AK's exaltation sign is occupied, the stronger of the 8th and 12th lords from it; if a node joins AK or the 8th from AK, the stronger of 8th and 12th lords (Abhyankar) ; ~2.1.51-57 **Brahma** = strongest of the 6th, 8th, 12th lords from the lagna that is placed in the half of the zodiac behind the stronger of lagna and 7th, and in an odd sign; Saturn or a node → the 6th from it; several → the one with most degrees; Rahu reverses degrees; 8th lord from AK in the 8th takes precedence; 2.1.58 span = dashas from Brahma's sign to Maheshvara's sign; 2.1.60-63 maraka = strongest of 3/6/8/12 lords from lagna or AK; usually the 6th lord [archive.org](https://archive.org/details/jaimini-kva-a-4-size).
- **JUS-R** Adhyaya 2 Pada 1 (TOC: three kinds of longevity, kakshya hrasa/vriddhi, dwara/bahya, Rudra, Maheshwara, Brahma) [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row). Sutra text not extracted.
- **PVR** ch. 14 §14.3 (Rudra via a special "8th house" table: odd signs counted forward, even signs backward, Shiva-motion for some; Maheshvara exceptions; trishula signs) [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).
- BPHS-ELS 5.16-20 (Varnada-based longevity and relatives' longevity) — see `special-lagnas.md`.

## 2. When it applies

All charts; life area: longevity of the native (and via Varnada/sthira karakas, relatives). Feeds Shoola, Sthira, Niryana Shoola and Brahma-based dashas (covered elsewhere).

## 3. Inputs required

Signs of lagna, 8th lord, lagna lord, Saturn, Moon, hora lagna; sign quality (chara/sthira/dvisvabhava); AK and its exaltation sign; 7th sign and lords; strength comparisons (Jaimini strength rules); benefic/malefic hemming of lagna, 7th and AK; node positions; degrees for Brahma ties.

## 4. Calculation

1. Pair grade table (both texts agree with the standard rule):

| Pair signs | Grade |
|---|---|
| movable + movable, fixed + dual | long |
| dual + dual, movable + fixed | medium |
| fixed + fixed, movable + dual | short |

2. Apply to pairs (lagna lord, 8th lord), (Saturn, Moon), (lagna, HL) [TEXT JUS-A 2.1.1-6].
3. Majority wins; if all differ use lagna + HL; Moon in lagna/7th → use Saturn + Moon [TEXT JUS-A 2.1.7-9].
4. Kakshya changes (Saturn, Jupiter, hemming, AK dignity, Moon/Venus in 2/6/8/12) [TEXT JUS-A 2.1.10-14, 2.1.25-32].
5. Rudra, trishula signs, Maheshvara, Brahma as in §1; span = sign dashas from Brahma to Maheshvara [TEXT JUS-A 2.1.38-58].

## 5. Interpretation rules

- Grade, not exact years, is the output; years come from the matching dasha (Shoola for death timing) [TEXT JUS-A 2.1.15-21, 2.1.33-37].
- Rudra = suffering and destruction of the body; Maheshvara = channel of the soul's release; trishula = the three trines from Rudra [MODERN PVR §14.3].

## 6. Variants and disputes

- Saturn lowers vs raises a grade ("some say") [TEXT JUS-A 2.1.10-11].
- Rudra's "8th house": normal count (Abhyankar's wording) vs PVR's table (odd/even direction with special signs) [MODERN PVR Table 32].
- Maheshvara node exception: Abhyankar: stronger of 8th and 12th lords; PVR: 6th lord from AK (8th counted backward) [COMM vs MODERN].
- Varnada-based longevity (BPHS) and Parashari pindayu/amsayu are separate systems; JUS-R TOC mentions "reconciliation of different systems".

## 7. Worked micro-example

None: deliberately omitted (sensitive topic).

## 8. Design notes for AI Astra

- **Engine status:** library `horoscope/chart/house.py` has `brahma`, `rudra`, `rudra_based_on_planet_positions`, `trishoola_rasis`, `maheshwara`, `maheshwara_from_planet_positions`, `longevity` (Rudra uses `const.rudra_eighth_house`, i.e. PVR's table). None is exported by `natal_export.py`. Unreviewed code findings (for the engine-rule-verifier, not yet filed): (1) the two Rudra functions differ: `rudra_based_on_planet_positions` (around line 912) compares a table-derived 8th lord with the **7th-house lord itself**, while `rudra` (around line 961) uses the table for the 8th from the 7th, which matches the text; (2) `brahma` takes the 6/8/12 lords from the **stronger of lagna and 7th** (Abhyankar reads them from the lagna, with the stronger of lagna/7th only fixing the half of the zodiac), drops Rahu/Ketu instead of moving to the 6th from them, and its three-candidate branch refers to `brahma` before assignment (likely a NameError path).
- **Engine additions (internal only):** `jaimini_longevity: {pairs: [{pair, signs, qualities, grade}], agreement, base_grade, adjustments: [{rule_id, delta}], final_grade, rudra, trishula_signs, maheshvara (with exception applied), brahma (with tie rule), variant_ids}`.
- **Boards:** none. Product rule: no death or longevity prediction to users. Use only as an internal "health pressure" signal and as input to dasha engines.
- **Pitfalls:** many exceptions; record which rule fired.

## 9. Open questions

- Exact sutra numbers in Rao's and Rath's numbering for 2.1.
- Jaimini strength rules (for "stronger of") were not extracted; the engine's `stronger_planet` should be compared with them (engine-rule-verifier agent).
