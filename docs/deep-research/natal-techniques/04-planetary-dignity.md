# Planetary dignity and relationships (ucca, mūlatrikoṇa, svakṣetra, maitrī)

> Dignity describes how comfortable a planet is in its sign. The grades run from exaltation (ucca), mooltrikona (MT) and own sign (svakshetra) through friend's, neutral and enemy's signs to debilitation (nīca).
>
> Relationships combine:
> - natural friendship (naisargika), fixed per planet;
> - temporary friendship (tatkalika), from mutual house positions in this chart;
> - their compound (panchadha maitri), a five-grade result.
>
> Dignity is the single most-used quality factor in natal judgement. It feeds Shadbala (saptavargaja), Vimshopaka, avasthas and yoga conditions.

## 1. Sources
- **BPHS ch. 3 "Grahas"** (Santhanam numbering), all (R; verse numbers from memory, not checked):
  - exaltation and debilitation, ≈3.49-50;
  - MT, ≈3.51-54;
  - natural relationships, ≈3.55-57;
  - temporary relationships and the compound, ≈3.57-60.
- **Brihat Jataka ch. 1-2**:
  - exaltation signs and degrees, BJ 1.13-14 (R);
  - Satyacharya's friendship rule from MT, BJ 2.15 (V by keyword: "satya", "trikoṇa");
  - temporary friendship, 2.18 (V by keyword).
  - BJ-Neely: https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english/d/doc1501537.html
- **Saravali ch. 3-4**; **Phaladeepika ch. 2** (R).

## 2. When it applies
All charts (D1 and every varga) and all planets. The Rahu/Ketu rules are disputed.

## 3. Inputs required
Planet sign and degree, and the positions of all the other planets (for temporary relations).

## 4. Calculation / rule
**Exaltation and debilitation** (BPHS 3, R; BJ 1.13-14, R). Debilitation is the 7th sign at the same degree.

| Planet | Exaltation (deep) | Debilitation | Mooltrikona | Own |
|---|---|---|---|---|
| Sun | Aries 10° | Libra 10° | Leo 0-20° | Leo (20-30) |
| Moon | Taurus 3° | Scorpio 3° | Taurus 4-30° (some 3-30°) | Cancer |
| Mars | Capricorn 28° | Cancer 28° | Aries 0-12° | Aries (12-30), Scorpio |
| Mercury | Virgo 15° | Pisces 15° | Virgo 16-20° (exaltation zone 0-15, own 21-30) | Gemini, Virgo |
| Jupiter | Cancer 5° | Capricorn 5° | Sagittarius 0-10° | Sagittarius (10-30), Pisces |
| Venus | Pisces 27° | Virgo 27° | Libra 0-15° | Taurus, Libra (15-30) |
| Saturn | Libra 20° | Aries 20° | Aquarius 0-20° | Capricorn, Aquarius (20-30) |
| Rahu | Taurus (some Gemini) | Scorpio (some Sagittarius) | disputed (Gemini / Virgo / Aquarius) | Aquarius (co-lord) [disputed] |
| Ketu | Scorpio (some Sagittarius) | Taurus (some Gemini) | disputed (Sagittarius / Pisces) | Scorpio (co-lord) [disputed] |

**Natural relationships** (BPHS 3, R):

| Planet | Friends | Neutral | Enemies |
|---|---|---|---|
| Sun | Moon, Mars, Jupiter | Mercury | Venus, Saturn |
| Moon | Sun, Mercury | Mars, Jupiter, Venus, Saturn | — |
| Mars | Sun, Moon, Jupiter | Venus, Saturn | Mercury |
| Mercury | Sun, Venus | Mars, Jupiter, Saturn | Moon |
| Jupiter | Sun, Moon, Mars | Saturn | Mercury, Venus |
| Venus | Mercury, Saturn | Mars, Jupiter | Sun, Moon |
| Saturn | Mercury, Venus | Jupiter | Sun, Moon, Mars |

Satyacharya's rule (BJ 2.15, [TEXT], V by keyword): lords of the 2nd, 4th, 5th, 8th, 9th and 12th from a planet's MT sign, plus its exaltation lord, are friends; the others are enemies. Mixed results make a neutral. The table above is the BPHS outcome.

**Temporary relationships** (tatkalika; BPHS 3, R; BJ 2.18, V by keyword):
- Planets in the 2nd, 3rd, 4th, 10th, 11th and 12th from a planet are its temporary friends.
- Planets in the 1st (conjoined), 5th, 6th, 7th, 8th and 9th are temporary enemies.

**Compound relationships** (panchadha):

| Natural ＋ Temporary | Compound |
|---|---|
| Friend + friend | Great friend (adhimitra) |
| Friend + enemy | Neutral (sama) |
| Neutral + friend | Friend |
| Neutral + enemy | Enemy |
| Enemy + friend | Neutral |
| Enemy + enemy | Great enemy (adhishatru) |

**Dignity ladder** (for Shadbala saptavargaja, file 06): exalted > MT > own > great friend > friend > neutral > enemy > great enemy > debilitated.

## 5. Interpretation rules
- [TEXT] Exalted, MT and own-sign planets give full and good results of their houses. Debilitated planets give poor results unless cancelled (file 20) (BPHS 3, Saravali, R).
- [TEXT] Results scale with dignity. Deeptadi (file 10) names the states.
- [COMM] Exaltation degree matters: Uchcha bala is maximum at the deep point and falls linearly (file 06).
- [MODERN] SJC: own-sign and exaltation in D9 decide whether D1 dignity holds (vargottama and D9 dignity, file 11).
- [MODERN] Many readers treat a retrograde exalted planet as acting debilitated, and a retrograde debilitated planet as acting exalted. This is a commentarial claim based on Saravali/Phaladeepika remarks on vakra strength (R, disputed).

## 6. Variants and disputes
- **Moon's MT**: BPHS gives 3-30 or 4-30 of Taurus depending on the translation (R).
- **Rahu and Ketu**: exaltation, MT and own signs all differ by text and school. BPHS mentions Rahu exalted in Taurus and Ketu in Scorpio (R), while many give Gemini and Sagittarius. The engine should emit the convention it uses.
- **Mercury's Virgo split** (exaltation 0-15, MT 16-20, own 21-30) is BPHS. Some (Saravali) give MT as 15-20 (R).
- **Natural vs compound** relationships: Vimshopaka, Shadbala and avasthas can use either. State which per output.

## 7. Worked micro-example
Jupiter in Taurus with Venus in Capricorn:
- Natural: Venus is Jupiter's enemy.
- Temporary: Capricorn is the 9th from Taurus, so an enemy.
- Compound: great enemy. Jupiter in a great enemy's sign is Khala (Deeptadi).

## 8. Design notes for AI Astra
- **Engine note**: the `facts` export docstring says both Rahu and Ketu are treated as exalted in Taurus and debilitated in Scorpio (`natal_export.dignity_label`). That is one of the variants in the table above, and it should carry a `text` tag.
- **Engine already has**:
  - `house.natural_friends/neutral/enemies_of_planets`;
  - `_get_temporary_friends_of_planets` and `_get_compound_relationships_of_planets`;
  - dignity in the facts and avasthas exports.
- **Must output per planet per varga**:
  - sign, degree and dignity grade;
  - distance from the deep exaltation point;
  - the MT flag;
  - the natural, temporary and compound relation with the sign lord;
  - the Rahu/Ketu convention used.
- **Board use**: the root quality signal on every planet card. Weight it highest among planet-quality factors.
- **Pitfall**: never let Node infer dignity from sign names. The engine sends the grade.

## 9. Open questions
- Product decision on the Rahu/Ketu dignity convention.
- Verify the BPHS 3 verse numbers in a print copy.
