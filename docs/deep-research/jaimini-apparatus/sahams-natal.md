# Sahams in natal use (sahama, "sensitive points")

> Sahams are Tajika (Indo-Persian annual-chart) sensitive points of the form A − B + C (e.g. Punya = Moon − Sun + Lagna), with day/night reversal and a 30° correction when C is not between B and A. There are about 50, each for one matter (marriage, career/kingdom, foreign travel, children, illness, death). They come from the Tajika texts for annual charts; using them in the natal chart and for natal transit timing is a modern practice (PVR/SJC, Jagannatha Hora). Not part of Jaimini's Upadesa Sutras or of BPHS as read here. Reliability is moderate; they are best as transit trigger points.

## 1. Sources

- **PVR** §28.8 (calculation rule, day/night reversal, 30° rule, Table 74 of sahams) and §25 (natal transits over vivaha saham, kali saham; Example 104) [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).
- Classical origin: Tajika texts (Neelakantha's *Tajika Neelakanthi*, samjna tantra, saham chapter). **Not read** in this pass; no verse numbers given.
- Engine library: `AIAstra_Radha/src/jhora/horoscope/transit/saham.py` (punya, vidya, yasas, mitra, mahatmya and others, with `night_time_birth` flag).

## 2. When it applies

Annual charts (classical use); natal chart and natal transits [MODERN]. Life areas by saham: Vivaha (marriage), Rajya/Karma (career, authority), Putra (children), Paradesa (foreign travel), Artha (money), Vidya (education), Roga/Kali/Mrityu (illness, danger, death), Punya (fortune).

## 3. Inputs required

Longitudes of the planets, lagna and house cusps (some sahams use house signs and lords); day/night birth flag; sunrise/sunset.

## 4. Calculation

1. Saham = A − B + C (longitudes, mod 360°) for a day birth; B − A + C for a night birth unless the saham is marked "same day and night" [MODERN PVR §28.8].
2. If C is not on the zodiacal arc from B to A, add 30° [MODERN PVR §28.8]. (This rule is applied by some Tajika authorities and omitted by others.)
3. Examples legible in the PVR text (day formulas, Table 74 rows 1-9): Punya = Moon − Sun + Lagna; Vidya = Sun − Moon + Lagna; Yasas = Jupiter − Punya + Lagna; Mitra = Jupiter − Punya + Venus; Mahatmya = Punya − Mars + Lagna; Asha = Saturn − Mars + Lagna; Samartha = Mars − Lagna lord + Lagna (Jupiter − Mars + Lagna if Mars owns the lagna); Bhratri = Jupiter − Saturn + Lagna (same day and night); Gaurava = Jupiter − Moon + Sun. Rows 10-33 (including Vivaha, Putra, Rajya, Paradesa) are column-scrambled in the text extraction and are not restated here; read them from the PDF page or the Tajika source before use.

## 5. Interpretation rules

- A saham shows the matter's sensitive point; planets conjoining or aspecting it in the chart colour that matter [MODERN].
- Transit triggers: 7th lord or Venus transiting near vivaha saham → marriage; 6th/8th lord, Mars or Rahu near kali saham → accident [MODERN PVR §25].
- In the example, transit Mercury (natal 7th lord) about 1° from natal vivaha saham at the wedding [MODERN PVR Example 104].

## 6. Variants and disputes

- 30° addition rule: applied (PVR) vs not applied (some Tajika practice).
- Day/night reversal per saham: lists differ.
- Natal use itself is modern; classical Tajika use is for the varshaphala.
- Formula variants across Tajika texts (e.g. Vivaha, Karma).

## 7. Worked micro-example

PVR Example 104 (above).

## 8. Design notes for AI Astra

- **Engine status:** saham functions exist in the library's transit module; not in `natal_export.py`. Tajika work is covered by another researcher (`docs/deep-research/tajika-prashna-muhurta/`).
- **Engine additions:** `natal_sahams: [{id, formula_day, formula_night, night_reversal_applied, thirty_deg_rule_applied, longitude, sign, house, nakshatra}]` for a curated set (vivaha, rajya, karma, putra, paradesa, artha, vidya, punya), plus transit-contact rows (orb in degrees) in the transit contacts export.
- **Boards:** Love (vivaha), Work (rajya, karma), Lucky (punya, artha), travel cards (paradesa) — as timing triggers only.
- **Weight:** low as a natal promise; medium as a transit trigger when the promise exists elsewhere.
- **Pitfall:** saham names are internal and should not appear in copy; formulas must come from one stated authority.

## 9. Open questions

- Neelakanthi verse numbers and the full classical list not read.
- Whether SJC/Rath endorse natal saham use, beyond PVR, not verified.
