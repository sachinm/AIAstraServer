# Rasi dasas from BPHS and the Jaimini Upadesa Sutras: overview (rāśi daśā)

> A rasi dasa gives each period to a sign (rasi), not to a planet. Jaimini's Upadesa Sutras are built on them;
> Parasara's BPHS lists about twenty of them in chapter 46 and gives working rules for a dozen, while saying Vimsottari
> is the right default for most people and Kalachakra is supreme. In practice three schools use them today: SJC (Sanjay
> Rath, P.V.R. Narasimha Rao), K.N. Rao's Bharatiya Vidya Bhavan group (Chara dasa), and the Andhra commentarial line
> (Iranganti Rangacharya). They answer "which area of life / which house becomes the stage now", and several are
> narrow by design (longevity, wealth, spirituality). Reliability is contested: there is no single agreed rule set for
> even the most popular one (Chara).

## 1. Sources (abbreviations used in every file)

| Code | Source | Numbering used |
|---|---|---|
| **BPHS** | *Brihat Parasara Hora Sastra*, English, vol. 2, archive.org item "BPHSEnglish" (file labelled R. Santhanam; extracted preface may name G.S. Kapoor), [djvu text](https://archive.org/stream/BPHSEnglish/BPHS%20-%202%20RSanthanam_djvu.txt) | ch:verse of that file; OCR is poor, verse numbers ±2 |
| **BPHS-R** | BPHS as cited by Sanjay Rath (Sagar/Santhanam numbering) | e.g. 46.155-167, 50.30-31 |
| **JS-BSR** | *Jaimini Sutras*, tr. B. Suryanarain Rao, rev. B.V. Raman, adhyayas 1-2 only, [PDF](https://lakshminarayanlenasia.com/articles/JAIMINISUTRAS.pdf) | adhyaya.pada.sutra as printed |
| **JS-R** | Jaimini sutras as cited by Sanjay Rath, *Narayana Dasa* (Sagar), [PDF](https://scienceoflight.net/wp-content/uploads/extra/Narayana%20Dasa%20by%20Sanjay%20Rath.pdf) | numbering matches JS-BSR where checked (1.1.27, 1.1.28, 1.1.34, 2.4.7-10, 2.4.31-33); readings sometimes differ (e.g. 1.1.27) |
| **PVR-VA** | P.V.R. Narasimha Rao, *Vedic Astrology: An Integrated Approach* (Sagar), [PDF](https://lakshminarayanlenasia.com/wp-content/uploads/2022/10/docs2/LakshmiNarayanLenasia.com/Astrology%20(Jyotish)%20collection/Vedic%20Astrology%20an%20Integrated%20Approach%20by%20P.V.R.%20Narasimha%20Rao.pdf) | chapter.section |
| **PVR-2014** | P.V.R. Narasimha Rao, "Parasara's Chara Dasa", [PDF](https://www.vedicastrologer.org/articles/pp_chara_dasa.pdf) | — |
| **KNR** | K.N. Rao, "Jaimini Chara Dasha - My Approach Part 1", [Saptarishis](https://saptarishisastrology.com/?p=2656) | — |
| **SUT** | "Shanmukha", *Jaimini Sutramritam* blog (Raghava Bhatta / Nrisimha Suri / Iranganti reconstruction), [post](https://sutramritam.blogspot.com/2009/08/chara-dasa-raghava-bhatta-nrisimha-suri.html) | — |
| **ENGINE** | `AIAstra_Radha/src/jhora/horoscope/dhasa/raasi/*.py` (read-only inspection, 2026-11-18) | module::function |

Not read (gaps): Sanskrit originals, Nilakantha's *Subodhini*, Krishnananda Saraswati, Somanatha's *Kalpalata*, Raghava
Bhatta's and Nrisimha Suri's commentaries, Jaimini adhyayas 3-4, *Jataka Sara Sangraha*, *Vriddha Karikas*. Every
[COMM] tag in these files is "as reported" by Suryanarain Rao or the Sutramritam blog. Sanskrit/IAST fragments in
these files are normalised from OCR'd transliterations and have not been checked against Devanagari.

## 2. The rasi dasas covered (one file each)

| File | Dasa | Classical anchor | Type |
|---|---|---|---|
| chara-dasha.md | Chara | BPHS 46.155-167; JS-BSR 1.1.26-28, 2.3.28, 2.4.7-10 | phalita (general) |
| narayana-dasha.md | Narayana (Padakrama), rasi and D-charts | JS-BSR 2.4.7-10, 2.4.31-34; BPHS 46.155-167 | phalita (general) |
| sthira-dasha.md | Sthira | BPHS 46.168-169; JS-BSR 2.3.3-4, 2.1.30 | ayur (longevity) |
| brahma-dasha.md | Brahma (graha-started) | JS-BSR 2.1.47-53, 2.3.25-26; BPHS 46.170-173 | ayur |
| shoola-dasha.md | Shoola (Jaimini, from 1st/7th) | JS-BSR 2.1.37-43, 2.2.4-11, 2.3.18-24 | ayur; relatives |
| niryana-shoola-dasha.md | Niryana Shoola (BPHS "Shoola", from 2nd/8th) | BPHS 46.181-182; JS-BSR 2.4.16 | ayur |
| mandooka-dasha.md | Mandooka | BPHS 46.179-180; JS-BSR 2.4.15 | disputed |
| drig-dasha.md | Drig | BPHS 46.185-187; JS-BSR 2.4.21-23 | phalita (spiritual) |
| trikona-dasha.md | Trikona | BPHS 46.183-184; JS-BSR 2.4.24-25 | phalita |
| navamsha-dasha.md | Navamsa | JS-BSR 2.3.1-2, 2.1.15-18, 2.4.1 | ayur / bhava results |
| yogardha-dasha.md | Yogardha | BPHS 46.174; JS-BSR 2.4.19-20 | mixed |
| lagna-kendradi-rasi-dasha.md | Lagna Kendradi rasi | BPHS 46.175-177 | phalita (material) |
| karaka-kendradi-rasi-dasha.md | Karaka (Atmakaraka) Kendradi rasi | BPHS 46 list "Karaka"; JS-BSR 2.4.11-13 | phalita |
| chara-paryaya-dasha.md | Paryaya / Chara Paryaya | no text read | unverified |
| sudasa.md | Sudasa (Sree Lagna Kendradi) | BPHS 46.188-190 (inferred root); PVR-VA ch 20 | phalita (wealth) |
| lagnadi-rasi-dasha.md | BPHS "Rasi" / Lagnadi rasi dasa | BPHS 46.188-190 | phalita |
| tara-lagna-dasha.md | Tara (Tara-amsa) rasi dasa | JS-BSR 2.4.27-30 | phalita (wealth status) |
| varnada-dasha.md | Varnada | JS-BSR 1.1.32 (Varnada lagna only) | unverified |
| padanathamsha-dasha.md | Padanathamsa | JS-BSR 2.1.18 ("pada-navamsa-dasa") | ayur / phalita |
| chakra-dasha.md | Chakra | BPHS ~46.50-51 | phalita |

Not given files: Kalachakra (nakshatra-pada based, belongs with nakshatra dasas), Moola / Kendradi graha dasa,
Sandhya, Lagnamsaka, Pachaka, Panchaswara, Naisargika, Ashtakavarga, Pinda (planet- or ayu-based, not sign dasas).
The engine has modules for Sandhya, Moola and Lagnamsaka in the same folder; they are out of scope here.

## 3. Common machinery (rules shared by most rasi dasas)

These recur across files; each file refers back here.

**C1. Count direction ("savya / apasavya").** [TEXT] JS-BSR 1.1.26: count forward from odd signs, backward from even
signs. [TEXT] JS-BSR 1.1.27 "na kvachit" ("not in some places"): Suryanarain Rao reports the old commentators read it as
Taurus and Scorpio counted forward, Leo and Aquarius counted backward [COMM]. [TEXT] BPHS 46.156: three signs from
Aries make a "pada"; odd padas (Ar-Ta-Ge, Li-Sc-Sg) count forward, even padas (Cn-Le-Vi, Cp-Aq-Pi) backward. The
commentators' reading of "na kvachit" and Parasara's footed groups give the same list. Several dasas (Sudasa, Lagna
Kendradi, Niryana Shoola, Narayana antardasa) use plain odd/even instead of footedness, and the schools say so
explicitly [MODERN] (PVR-VA 18.3, 19.2, 20.2). Rath reads 1.1.27 differently, as the source of the exalted +1 /
debilitated -1 rule; Suryanarain Rao puts ±1 on "prayena" in 1.1.28 instead.

**C2. Dasa years by count to the lord ("nathantah samah prayena").** [TEXT] JS-BSR 1.1.28: many authorities give a
sign as many years as the count from it to its lord. [TEXT] BPHS 46.155: count from the sign to the sign holding its
lord, forward for odd pada, backward for even pada. Details that are disputed (minus one; own sign = 12; exalted +1 /
debilitated -1, whose scope in BPHS 46.164-166 is open because the scan places it inside the Scorpio/Aquarius
passage; dual lords of Scorpio and Aquarius; second cycle = 12 minus first) are tabulated in chara-dasha.md and
narayana-dasha.md.

**C3. Fixed years.** [TEXT] JS-BSR 2.3.3 and BPHS 46.168: movable 7, fixed 8, dual 9 years ("Sthira years"). Used by
Sthira, Niryana Shoola, Mandooka, Drig (BPHS), Lagnadi Rasi (BPHS). [TEXT] 9 years every sign: Navamsa dasa (JS-BSR
2.3.1 note), Shoola (PVR-VA 23.2; JS-BSR 2.4.17 as a possible text basis is my inference), Tara-amsa dasa (JS-BSR 2.4.27). 10 years: Chakra (BPHS ~46.50).

**C4. Stronger of two signs.** [TEXT] JS-BSR 2.3.5-17 and 2.3.27 list "sources of strength" (pranas): first, a sign
with the Atmakaraka; then more planets; then exalted/own/moolatrikona occupants; then natural strength (dual > fixed >
movable); then the lord's strength; second source, aspect or conjunction of the sign's lord, Jupiter or Mercury
(2.3.14). [MODERN] PVR-VA 15.5.2 orders them for software: (1) more planets, (2) more of Jupiter/Mercury/lord
occupying or aspecting by rasi drishti, (3) exalted occupant, (4) lord placed in a sign of opposite oddity, (5)
natural strength, (6) lord's degree advancement (nodes counted from sign end). PVR warns that ayur dasas weight the
luminaries' aspects instead of Jupiter/Mercury/lord.

**C5. Antardasa (sub-period).** [TEXT] JS-BSR 1.1.34: each dasa divided by 12 among the 12 signs, counted by odd/even.
[TEXT] BPHS ch. 51 vv. 5-12 (this file's numbering; Rath cites 50.30-31): 1/12 each; start from the stronger of the
dasa sign and its 7th; forward from odd, backward from even; movable dasa sign runs all 12 in order, fixed jumps every
6th, dual runs kendras from itself, then from its 5th and 9th. [TEXT] JS-BSR 2.4.34: everything said for dasas applies to
antardasas. Each school picks a different start sign; see narayana-dasha.md and chara-dasha.md.

**C6. Year length.** No text defines it. [MODERN] PVR-VA 18.6: measure periods by the Sun's motion (1 year = Sun
returns to natal longitude; sub-periods are equal arcs of the Sun), not by fixed days. The engine uses a sidereal year
constant in most modules.

**C7. Balance at birth.** [TEXT] BPHS 46.190: subtract (degrees of the first sign already passed x that sign's years
/ 30) from the first dasa. Most Jaimini dasas instead run the first dasa in full from birth [MODERN practice]. Sudasa
(PVR-VA 20.2) applies a balance based on Sree Lagna's degree.

## 4. How results are judged (applies to every phalita rasi dasa)

- [TEXT] JS-BSR 2.4.35-36: a dasa is good if its sign has benefic conjunction/aspect, or its lord has such strength or is
  exalted; otherwise the reverse.
- [TEXT] JS-BSR 2.4.2-6: the sign that opens a dasa is the "dwara" (door); count from it as far as it is from lagna to
  get the "bahya" (outer) sign; these are also called paka and bhoga. Malefics there give confinement and disease
  unless in own sign or with Jupiter.
- [TEXT] JS-BSR 2.4.26: read results through the karakas (chara karakas) and through the 1st/3rd/7th/9th signs.
- [TEXT] BPHS ch. 50: effects of rasi dasas by the strength and placement of the sign lord; 50.90-96: antardasas of
  signs owned/occupied by friends are good, of the 6th/8th/12th or of signs with malefic or debilitated planets bad.
- [MODERN] Rath (*Narayana Dasa*, judgement chapter): read the dasa sign and the paka rasi (sign holding its lord);
  argala (benefics 2nd/12th = shubha-kartari, malefics = papa-kartari) on them; badhaka from the dasa sign (11th for
  movable, 9th fixed, 7th dual); chara karakas in kendras to the dasa sign are strongest.
- [MODERN] PVR-VA 18.4: treat the dasa sign as lagna ("dasa lagna"), apply Parasara's house rules from it; also read
  the dasa sign against natal references (AL, UL, GL, HL, A10).
- [MODERN] KNR: chara karakas and their aspects on houses from the mahadasha/antardasha signs, karakamsa, upapada,
  D7/D9/D12; cross-check with Vimsottari.

## 5. School matrix (summary; details in each file)

| Point | BPHS | JS text (BSR) | Rath / SJC | PVR (2000 book / 2014) | K.N. Rao | Iranganti / Raghava Bhatta (SUT) |
|---|---|---|---|---|---|---|
| Main general dasa | Chara (one of many; Vimsottari preferred) | Padakrama dasas 2.4.8-10 | Narayana (Chara = movable-lagna Narayana) | Narayana (book); "Parasara's Chara" (2014) | Chara | Chara with padakrama |
| Seed | lagna (46.167) | stronger of 1st/7th (2.4.7) | stronger of 1st/7th | stronger 1st/7th (book); strongest of lagna/Sun/Moon signs (2014) | lagna | lagna (male), 4th (female) |
| ±1 exalt/debil | yes (46.164-166; scope open) | "prayena" read as yes by BSR | yes, cap 12 (from 1.1.27) | yes (book), no (2014) | no | no |

## 6. Design notes for AI Astra (overall)

- The engine (Radha) is the only source of every dasa table. Every rasi dasa must come out of the engine with: system
  id, variant id (school), seed sign and the rule that chose it, direction and why (footed / odd-even / Saturn / Ketu),
  each period's sign, start and end (Sun-based year if implemented), years and the rule that produced them
  (count, ±1, dual-lord choice, cap), and antardasa rows with their own start rule. Node only displays.
- Keep variants side by side (e.g. `chara.knrao`, `chara.rath_narayana`, `chara.pvr2014`, `chara.rangacharya`) rather
  than one "Chara". Readings should say which one they used, in plain words, without engine names.
- Weighting (recommendation for planning): Vimsottari stays primary for timing; Narayana (D1 and the relevant varga) is
  the main rasi confirmation; Sudasa for money/status questions (Work board); Drig only for spiritual questions;
  longevity dasas (Shoola, Niryana Shoola, Sthira, Brahma, Navamsa) are NOT to be surfaced to users (death timing) and
  at most feed internal "hard period" flags after a product decision.
- Pitfall: the same name means different calculations in different schools (Shoola; Mandooka; Chara). Never compare
  a reading to a third-party app without matching the variant.

## 7. Open questions

- Which Chara variant to expose first, if any, given Narayana covers the SJC use case.
- Whether to adopt Sun-based year length across all rasi dasas (affects every date by up to days per year).
- Classical text for Varnada, Paryaya, Karaka Kendradi and Sudasa proper (Jaimini adhyayas 3-4) still to be read.
