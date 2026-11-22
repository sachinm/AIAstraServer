# Ashtottari dasha (aṣṭottarī daśā)

> A 108-year nakshatra dasha of eight lords (Ketu left out), counted from Ardra. BPHS gives two separate conditions for it: Rahu in a kendra or trikona from the lagna lord (not in lagna), or a day birth in the dark fortnight / night birth in the bright fortnight. After Vimshottari it is the most used nakshatra dasha, especially in North India and Bengal; BPHS says its results are read as in Vimshottari.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Condition 1: `lagneśāt kendrakoṇasthe rāhau lagnaṃ vinā sthite … raudrabhāditaḥ` | ELS 46.17 (AE 46.17) | [TEXT] |
| Star allotment 4-3-4-3 from Ardra | ELS/AE 46.18 | [TEXT] |
| Lords | ELS/AE 46.19 | [TEXT] |
| Years | ELS/AE 46.20 | [TEXT] |
| Nakshatra spans; Abhijit handling | AE 46.21–22 | [TEXT] |
| Results as in Vimshottari | ELS 46.22 | [TEXT] |
| Condition 2: `kṛṣṇapakṣe divā janma śuklapakṣe tathā niśi \| tadā hyaṣṭottarī cintyā` | ELS 46.23 | [TEXT] |
| Controlling planet Mars; selection | PVR 2014 | [MODERN] |
| AD start dispute | engine `const.py:577` comment citing PVR's book vs JHora | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-17 · https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-23 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

- **Condition 1 (46.17)**: Rahu in a kendra (1, 4, 7, 10) or trikona (1, 5, 9) counted from the sign of the lagna lord, and Rahu not in the lagna sign. [TEXT]
- **Condition 2 (46.23)**: born by day in krishna paksha, or by night in shukla paksha. [TEXT] One English summary of AE attaches this verse to Shodashottari; the Sanskrit names Ashtottari (`tadā hyaṣṭottarī cintyā`).
- Either condition is enough on a plain reading; the text does not say both are needed.
- Life areas: all (results as Vimshottari).

## 3. Inputs required

Moon longitude; lagna sign; lagna lord's sign; Rahu's sign (mean or true node: state which); for condition 2, sunrise and sunset at the birthplace and the tithi (Sun–Moon elongation).

## 4. Calculation

**Lords and years (46.19–20)** with star allotment (46.18), counted from Ardra (engine `ashtottari_adhipathi_dict_seed`):

| Lord | Years | Nakshatras |
|---|---|---|
| Sun | 6 | Ardra, Punarvasu, Pushya, Ashlesha (4) |
| Moon | 15 | Magha, Purva Phalguni, Uttara Phalguni (3) |
| Mars | 8 | Hasta, Chitra, Swati, Vishakha (4) |
| Mercury | 17 | Anuradha, Jyeshtha, Mula (3) |
| Saturn | 10 | Purva Ashadha, Uttara Ashadha, Abhijit, Shravana (4 with Abhijit) |
| Jupiter | 19 | Dhanishta, Shatabhisha, Purva Bhadrapada (3) |
| Rahu | 12 | Uttara Bhadrapada, Revati, Ashwini, Bharani (4) |
| Venus | 21 | Krittika, Rohini, Mrigashira (3) |

Total 108.

**Balance at birth.** The lord's years are spread over the lord's whole group of 3 or 4 stars, so the balance is figured on the group span, not on one nakshatra: balance = years × (remaining arc of the group ÷ total arc of the group). AE 46.21 gives the same idea as "one quarter / one third of the dasha per star". For Saturn's group, Abhijit is the last quarter of Uttara Ashadha plus the first 1/15 of Shravana (46.22, per AE; standard Abhijit span 276°40′–280°53′20″).

**Sub-periods.** AD = MD years × AD years / 108, starting from the MD lord in the order above (BPHS 51.1 rule applied to 108). PD and lower: same proportion.

## 5. Interpretation rules

- Judge exactly as Vimshottari: dignity, house lordship, AD relations (46.22; AE ch. 47–48). [TEXT]
- Rahu's 12-year MD replaces Rahu's 18 years of Vimshottari; there is no Ketu period at all. [TEXT, by construction]
- PVR: prefer Ashtottari over Vimshottari only if Mars (controlling planet) is strong. [MODERN]

## 6. Variants and disputes

- **Which condition**: many practitioners know only condition 1; Bengal and some North Indian almanacs use condition 2 (paksha with day/night) [COMM/MODERN, not traced to a named commentator here].
- **AD start**: the engine starts ADs from the MD lord (`ashtottari_bhukthi_starts_from_dhasa_lord = True`), noting "PVR Book says this should be False. But JHora has this True". BPHS 51.1's general rule starts with the MD lord.
- **Balance method**: group-span (above) vs single-nakshatra proportion; software differs. The engine builds a star → lord table from Ardra with Saturn holding 3 stars (20–22) in its 27-star scheme. Whether it widens Saturn's span by Abhijit is not checked.
- **Rahu node**: mean vs true node can change condition 1 near a sign boundary.

## 7. Worked micro-example

Lagna Aries, lagna lord Mars in Leo. Kendras from Leo: Leo, Scorpio, Aquarius, Taurus; trikonas: Leo, Sagittarius, Aries. Rahu in Sagittarius → condition 1 met. Rahu in Aries (lagna) → not met despite being a trikona from Leo.

## 8. Design notes for AI Astra

- Engine addition: export both condition flags separately (`ashtottari_rahu`, `ashtottari_paksha`), the node type used, and the margin to sunrise/sunset for condition 2.
- Engine addition: Ashtottari MD/AD to 3 levels for charts that meet either condition.
- Product: agreement evidence for Vimshottari windows on Self/Love/Work. Never the lead clock.
- Pitfall: the Abhijit treatment changes dates for anyone with the Moon in Uttara Ashadha 4th pada or early Shravana; verify the engine on a research kundli with that Moon.

## 9. Open questions

- Does the engine stretch Saturn's group to include Abhijit? Needs a live check.
- AD start (MD lord vs next lord): which does BPHS 51 intend for Ashtottari? The text gives one general rule (MD lord first).
