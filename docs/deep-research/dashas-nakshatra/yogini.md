# Yogini dasha (yoginī daśā)

> A 36-year cycle of eight yoginis, each ruled by a planet, with periods of 1 to 8 years, started from the Moon's nakshatra. BPHS lists it with a four-verse rule and no condition; North Indian practice (Mansagari tradition, BVB/K.N. Rao school) uses it in every chart as the standard second dasha to confirm Vimshottari. Its short cycle repeats about three times in a life.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Yogini named in the dasha list | ELS 46.10 | [TEXT] |
| Names: Mangala, Pingala, Dhanya, Bhramari, Bhadrika, Ulka, Siddha, Sankata | ELS/AE 46.196 | [TEXT] |
| Lords: Moon, Sun, Jupiter, Mars, Mercury, Saturn, Venus, Rahu | ELS 46.197–198 | [TEXT] |
| Start: `janmarkṣaṃ ca tribhir yuktaṃ vasubhir bhāgam āharet \| ekādiśeṣe … maṅgalādikāḥ` | ELS 46.199 | [TEXT] |
| Years 1 … 8 | ELS 46.200 | [TEXT] |
| Mansagari's Yogini chapter | Mansagari | not consulted (no online text found) |
| Universal second dasha, confirm Vimshottari | BVB / K.N. Rao school practice | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-199 · https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt

## 2. When it applies

No condition in BPHS. Used in all charts by its school [MODERN].

## 3. Inputs required

Moon longitude.

## 4. Calculation

**Start (46.199)**: birth star number (Ashwini = 1) + 3, divide by 8; remainder (0 counts as 8) gives the yogini from Mangala = 1.

| # | Yogini | Lord | Years | Stars (rule (n + 3) mod 8) |
|---|---|---|---|---|
| 1 | Mangala | Moon | 1 | Ardra 6, Chitra 14, Shravana 22 |
| 2 | Pingala | Sun | 2 | Punarvasu 7, Swati 15, Dhanishta 23 |
| 3 | Dhanya | Jupiter | 3 | Pushya 8, Vishakha 16, Shatabhisha 24 |
| 4 | Bhramari | Mars | 4 | Ashwini 1, Ashlesha 9, Anuradha 17, P.Bhadrapada 25 |
| 5 | Bhadrika | Mercury | 5 | Bharani 2, Magha 10, Jyeshtha 18, U.Bhadrapada 26 |
| 6 | Ulka | Saturn | 6 | Krittika 3, P.Phalguni 11, Mula 19, Revati 27 |
| 7 | Siddha | Venus | 7 | Rohini 4, U.Phalguni 12, P.Ashadha 20 |
| 8 | Sankata | Rahu | 8 | Mrigashira 5, Hasta 13, U.Ashadha 21 |

Total 36. Balance = years × untraversed fraction of the birth nakshatra (46.16 rule, by common practice). Sub-periods: AD = MD × AD / 36, starting from the MD yogini (BPHS 51.1 general rule); engine offers options 1–6.

## 5. Interpretation rules

- Mangala, Dhanya, Bhadrika, Siddha are benefic yoginis; Pingala, Bhramari, Ulka, Sankata malefic [MODERN/COMM; the yogini names carry the sense, BPHS gives no results verses here].
- The lord planet's house ownership and placement give the specific results, read through BPHS ch. 47–48 [MODERN].
- Practice: an event is confirmed when the Vimshottari and Yogini lords point to the same houses [MODERN, BVB school].

## 6. Variants and disputes

- **Ketu as co-lord of Sankata** [MODERN]: some schools give Sankata to Rahu and Ketu together; BPHS names Rahu only.
- **Star mapping in the engine (to verify on a live run)**: `yogini.py` builds the table by counting forward from Punarvasu (seed 7 = Pingala) through all 27 stars in one 8-cycle. Because 27 is not a multiple of 8, this matches the (n + 3) mod 8 rule only for stars 7–27. For Moon in Ashwini to Ardra (1–6) a reimplementation of the engine's `_get_dhasa_dict(7)` gives Siddha, Sankata, Mangala, Pingala, Dhanya, Bhramari where 46.199 gives Bhramari, Bhadrika, Ulka, Siddha, Sankata, Mangala. Not yet confirmed by running the engine.
- Tithi-Yogini (engine `tithi_yogini.py`): a tithi-based variant [MODERN]; not documented here.

## 7. Worked micro-example

Moon in Rohini (4) at 60% traversed. 4 + 3 = 7 → Siddha (Venus), 7 years. Balance 7 × 0.4 = 2.8 years of Siddha, then Sankata 8, Mangala 1, Pingala 2 ….

## 8. Design notes for AI Astra

- Engine must output: yogini name, lord, start/end to 3 levels; the starting rule used.
- Engine check first: confirm the Ashwini–Ardra mapping on a live run before Yogini is shown anywhere.
- Weight: the main agreement dasha for Vimshottari windows on Self/Love/Work (it applies to all charts, unlike the conditional dashas).
- Pitfall: never show yogini names (Ulka, Sankata) to users as named threats; translate into plain tone words per the board rules.

## 9. Open questions

- Mansagari's own Yogini verses (start rule, Ketu) not seen.
- Results text for each yogini: no classical source read here.
