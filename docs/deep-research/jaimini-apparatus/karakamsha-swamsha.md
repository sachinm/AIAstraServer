# Karakamsha and Swamsha (kārakāṃśa, svāṃśa)

> Karakamsha is the navamsa sign occupied by the Atmakaraka. Jaimini (Adhyaya 1 Pada 2) and Parashara (BPHS ch. 33) read the sign itself, the planets in it, and the houses counted from it to describe the soul's direction: vocation and skills (planets in it, 10th, 5th), learning (5th, 2nd), spouse (7th), dharma and guru (9th), house and property (4th), and liberation and chosen deity (12th). "Swamsha" is used in the texts for the same navamsa of AK; modern schools distinguish reading it in the navamsa chart from projecting the sign into the rasi chart (karakamsha lagna). Widely used for vocation and spiritual readings; reliability depends on AK, which depends on birth time and the karaka scheme.

## 1. Sources

- **JUS-R** Adhyaya 1 Pada 2 (Rao 1949, sutra numbers as printed): 1.2.1 introduces the navamsa of AK; 1.2.2-13 AK in Aries ... Pisces navamsa (rats/cats, quadrupeds, skin disease, water, dogs, fire, trade, water creatures, ..., charities, liberation); 1.2.14-22 Sun, full Moon + Venus, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu in karakamsha (government work; enjoyment and learning; weapons/fire work; trade, weaving, crafts, law; karma, knowledge, Vedas; government, sensual; famous in family line of work; archers, thieves, metal/machines; elephant trade, thieves); 1.2.23-28 Sun + Rahu (snake) and aspects; 1.2.29-33 Gulika, Moon, Mercury, Ketu, Venus aspects; later sutras 4th, 9th, 10th, 12th from karakamsha [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row).
- **JUS-A** 1.2.1 onward, same content ("division occupied by the chief significatory planet") [archive.org](https://archive.org/details/jaimini-kva-a-4-size).
- **BPHS-ELS** ch. 33 (site numbering, via summary): vv. 1-8 AK navamsa sign results; v. 9 auspicious karakamsha plus benefic in lagna navamsa → king; vv. 13-18 planets in karakamsha (professions); vv. 30-35 2nd, 3rd, 4th; vv. 36-45 5th (learning, weapons, authorship, philosophy schools); v. 47-48 7th (spouse); v. 49 8th (longevity); vv. 50-56 9th (dharma, guru); vv. 57-60 10th (wealth, business, rulership); vv. 61-62 11th; vv. 63-74 12th (liberation; Ketu and deities: Sun Shiva, Moon Gauri, Venus Lakshmi, Mars Skanda, Mercury/Saturn Vishnu, Jupiter Shiva-type, Rahu Durga); v. 92 apply also to 2nd/3rd from svamsha; v. 94 speech from 2nd/8th of svamsha, lagna or pada [chapter 33](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-33). BPHS 29.29: pada-lagna yogas also apply from karakamsha.
- **PVR** §7.3.6 (karakamsa read in navamsa; 12th from it for liberation and deity) [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).
- **Rath web**: karakamsha = the navamsa (and/or other varga) where AK is placed; planets in the 9th and 12th from karakamsha show dharma and ishta devata; 12th = jivanmuktamsha; 7th = bondage; "treat the karakamsha as Aries" natural-zodiac method [srath.com atmakaraka-karakamsa](https://srath.com/jyoti%E1%B9%A3a/scholar/atmakaraka-karakamsa/), [karakamsa-and-natural-zodiac](https://srath.com/jyoti%E1%B9%A3a/scholar/karakamsa-and-natural-zodiac/), [darapada-and-upapada](https://srath.com/jyoti%E1%B9%A3a/scholar/darapada-and-upapada/).
- Repo: `docs/techniques/general/general.jaimini_karakamsha.md` (planned technique R6).

## 2. When it applies

Every chart once AK is fixed. Life areas: vocation and skills (Work), learning and authorship, spouse (7th), home/property (4th), dharma/guru (9th), spirituality, liberation and ishta devata (12th), with health and danger readings in the sign results.

## 3. Inputs required

AK (chara karaka scheme stated); D9 sign of AK; D9 positions of all planets (and Gulika); D1 positions for the karakamsha-lagna variant; rasi aspects in D9 and D1; dignity of planets.

## 4. Calculation

1. Find AK (see `chara-karakas.md`).
2. Karakamsha sign K = AK's navamsa sign.
3. Read the houses 1-12 counted from K:
   - (a) **in the navamsa chart** (planets' D9 signs) [MODERN PVR §7.3.6];
   - (b) **in the rasi chart**, treating K as a lagna over the D1 positions (karakamsha lagna) [MODERN SJC/Rath usage; the repo's technique spec uses this];
   - the texts' own wording ("svāṃśa", "kārakāṃśa") does not settle (a) vs (b).
4. Optional: count from K as if K were Aries (natural zodiac) [MODERN Rath].

## 5. Interpretation rules

- Planet in karakamsha → vocation: Sun government/political work; full Moon (+Venus) comforts, learning; Mars weapons, fire, alchemy; Mercury trade, crafts, law; Jupiter Vedic/knowledge work; Venus government association, sensual; Saturn famous in family line; Rahu archery, thieves, machinery/metal; Ketu elephant trade or poison-healing [TEXT JUS-R 1.2.14-22; BPHS-ELS 33.13-18].
- 10th from karakamsha: benefics → stable wealth; malefics → business loss, little paternal happiness; Mercury + Venus → great business profit; Sun + Moon aspected by Jupiter → ruler [TEXT BPHS-ELS 33.57-60; JUS-R pada 2 later sutras].
- 5th (and karakamsha itself) for learning: Moon + Jupiter author; Jupiter alone scholar of Veda/Vedanta, not an orator; Mars logician; Mercury Mimamsa; Saturn dull in assembly; Ketu/Rahu mathematics; Venus poet [TEXT BPHS-ELS 33.39-44, 33.85-91].
- 7th: Moon + Jupiter very beautiful spouse; Venus passionate; Mercury artistic; Sun spouse kept within family; Saturn older spouse; Rahu widow/divorcee [TEXT BPHS-ELS 33.47-48].
- 9th: benefics → truthful, devoted to guru; Saturn + Rahu → betrays guru [TEXT BPHS-ELS 33.50-53].
- 12th: benefic in own/exaltation → good destiny; Ketu with benefics → liberation; Ketu in Aries/Sagittarius with benefic aspect → final liberation; deity by planet in the 12th (Sun Shiva, Moon Gauri, Venus Lakshmi, Mars Skanda, Mercury/Saturn Vishnu, Rahu Durga, Ketu Ganesha/Skanda) [TEXT BPHS-ELS 33.63-74; MODERN PVR §7.3.6; Rath web].
- AK navamsa sign: Pisces → liberation; Libra → trade; Aquarius → charitable works such as tanks; Aries → fear of rats/cats, etc. [TEXT JUS-R 1.2.2-13; BPHS-ELS 33.2-8].
- Yogas for the pada lagna also apply from karakamsha, excluding relatives [TEXT BPHS-ELS 29.29].

## 6. Variants and disputes

| Question | Readings |
|---|---|
| Swamsha vs karakamsha | Texts use both words for AK's navamsa [TEXT]. Rath lists "distinction between karakamsa and swamsa" as a topic but the fetched pages do not state it [MODERN, gap]. Common SJC usage: karakamsha = K used as lagna in D1; swamsha = K used as lagna in D9. Not confirmed from a primary Rath text. |
| Chart for houses from K | Navamsa (PVR) vs rasi (karakamsha lagna) vs both. |
| Ishta devata | 12th from karakamsha (BPHS, PVR) vs 12th from AK in D9 vs Rath's "9th and 12th" (dharma devata vs ishta devata). |
| Natural-zodiac method | Rath only; he notes no dictum extends it beyond his stated use. |

## 7. Worked micro-example

Not given in sources read beyond Rath's case mentions (Rahu as AK for two named people).

## 8. Design notes for AI Astra

- **Engine status:** AK and D9 positions exist; no karakamsha frame is exported (gap R6 in doc 80).
- **Engine addition:** `karakamsha: {ak, scheme, k_sign, d9_houses_from_k: 1..12 {occupants, lords, rasi_aspects, dignity}, d1_houses_from_k: 1..12 {...}, gulika_in_k, ketu_position_from_k}` and a `variant` tag for which frame each reading uses. Compute for both 7- and 8-karaka schemes when the AK differs.
- **Boards:** You/Self (soul direction, inner talent), Work (planets in K and the 10th from K), Love (7th from K), spiritual readings (12th, 9th).
- **Weight:** high for "calling" and spiritual framing, medium for career type; low for timing.
- **Pitfalls:** AK flips change everything; ishta devata and "thief/adulterer" style sign results are sensitive and should not surface raw; birth-time sensitivity of D9.

## 9. Open questions

- Rath's book distinction between karakamsha and swamsha.
- Iranganti and P. S. Sastri readings of 1.2 not checked.
- Which chart (D1 or D9) SJC uses for the 10th from karakamsha in career work: practice varies.
