# Upagrahas (upagraha, "sub-planets"): Gulika/Mandi, the Kala group, and the Dhuma group

> Upagrahas are non-luminous mathematical points defined by Parashara. Five (Dhuma, Vyatipata, Parivesha, Indrachapa, Upaketu) are fixed offsets from the Sun's longitude; six (Kala, Mrityu, Ardhaprahara, Yamaghantaka, Gulika, Mandi) are the lagnas rising at the portions of the day or night ruled by Sun, Mars, Mercury, Jupiter and Saturn. All are malefic; they spoil the houses and points they occupy. Gulika/Mandi is the most used (affliction, poison/chronic illness, death); the Dhuma group is used mainly in SJC and in Kerala practice. Jaimini uses Gulika with the karakamsha.

## 1. Sources

- **BPHS-ELS** ch. 3 (site numbering, via summary): v. 61 Dhuma = Sun + 133°20', a great affliction; v. 62 Vyatipata = 360° − Dhuma; Parivesha = Vyatipata + 180°; v. 63 Indrachapa = 360° − Parivesha; v. 64 these are malefic; v. 65 falling on Sun, Moon or lagna they destroy lineage, life span, knowledge; vv. 66-69 divide day (and night) into 8 parts, counting from the weekday lord (night from the 5th planet from it); the 8th part is lordless; Saturn's part is Gulika, Sun's Kala, Mars's Mrityu, Jupiter's Yamaghantaka, Mercury's Ardhaprahara; v. 70 the lagna at Gulika's time is the Gulika lagna. Upaketu was not named in the summarised chapter [chapter 3](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-3).
- **JUS-R** 1.2.29 (Gulika with the karakamsha → poisoner or poisoned), 1.2 TOC "Gulikakala or time of the son of Saturn" with Rao's worked ghati table [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row); **BPHS-ELS** 33.23-24, 33.38, 33.82 (Gulika and karakamsha); 33.11 upagraha in the 12th from karakamsha, well placed → liberation.
- **PVR** ch. 4 (§4.1-4.3, Tables 9-10) [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).

## 2. When it applies

All charts. Life areas: affliction of houses and points (any), health and chronic disease, poison, danger; Gulika in karakamsha or 5th from it (poison, healing); birth-time checks.

## 3. Inputs required

Sun's sidereal longitude (Dhuma group); sunrise, sunset, next sunrise, weekday, day/night birth flag, birth place (Kala group); lagna at a given moment (ascendant function).

## 4. Calculation

**Sun-based** [TEXT BPHS-ELS 3.61-63; MODERN PVR Table 9]:
- Dhuma = Sun + 133°20'
- Vyatipata = 360° − Dhuma
- Parivesha = Vyatipata + 180°
- Indrachapa = 360° − Parivesha
- Upaketu = Indrachapa + 16°40' (= Sun − 30°) [MODERN PVR; not in summarised BPHS]

**Time-based** [TEXT BPHS-ELS 3.66-70; MODERN PVR §4.3]:
1. Split day (sunrise-sunset) or night (sunset-sunrise) into 8 equal parts.
2. Day: the 1st part belongs to the weekday lord, then planets in weekday order; the part after Saturn's is lordless. Night: start from the 5th planet from the weekday lord.
3. Kala, Mrityu, Ardhaprahara, Yamaghantaka, Gulika = the lagna rising at the **middle** of the Sun's, Mars's, Mercury's, Jupiter's, Saturn's part; Mandi = the lagna at the **beginning** of Saturn's part [MODERN PVR §4.3; footnote: some take the beginning for all].

## 5. Interpretation rules

- All upagrahas are malefic; houses they occupy in the rasi or varga charts are spoiled [TEXT BPHS-ELS 3.64; MODERN PVR §4.2].
- On the Sun, Moon or lagna they damage lineage, longevity and knowledge [TEXT BPHS-ELS 3.65].
- Gulika with karakamsha: poisoner or poisoned; Moon's aspect → wealth stolen or a thief; with Mercury aspect → many children (as summarised) [TEXT JUS-R 1.2.29-31; BPHS-ELS 33.23-24].
- Results are judged from the Gulika lagna as a lagna [TEXT BPHS-ELS 3.70].

## 6. Variants and disputes

- **Gulika vs Mandi:** BPHS treats Saturn's portion as Gulika and does not name Mandi separately (summary); PVR distinguishes middle (Gulika) and start (Mandi); Kerala tradition often treats them as one point or uses a ghati table by weekday (Rao gives a ghati-based worked example). The ghati table and Jataka Parijata's version were not extracted.
- **Start vs middle** of the portion for the Kala group [MODERN PVR n.9].
- Sunrise definition affects all time-based upagrahas.

## 7. Worked micro-example

PVR Example 6: Sun 9°36' Sagittarius = 249°36'; Dhuma = 382°56' → 22°56' Aries; Indrachapa 22°56' Libra; Vyatipata 7°04' Pisces; Parivesha 7°04' Virgo.

## 8. Design notes for AI Astra

- **Engine status:** `natal_export.py::_map_special_points` exports Gulika (GK) and Maandi (MD) per varga. The library has `drik.upagraha_longitude`, `drik.solar_upagraha_longitudes`, `charts.solar_upagraha_longitudes` and `special_planet_longitudes`; the Dhuma group and Kala/Mrityu/Ardhaprahara/Yamaghantaka are not in `natal_export.py`.
- **Engine additions:** export all 11 upagrahas with sign, degree, house from lagna, nakshatra, the method flag (`portion_point: start|middle`), and conjunction flags with Sun, Moon, lagna, AK, karakamsha, UL; Gulika's position from karakamsha.
- **Boards:** internal pressure signal for health and difficulty cards; not a headline element. Lucky board may use Gulika kala / Yamaghantaka time windows (these are panchang periods, covered by the muhurta work).
- **Weight:** low-medium; confirming affliction only.
- **Pitfalls:** do not confuse Gulika-the-point with Gulika kala (the daily inauspicious time); upagraha names are internal and must not appear in user copy.

## 9. Open questions

- Mandi ghati table (Kerala, Phaladeepika/Prasna Marga) and Jataka Parijata rules not extracted.
- Upaketu's BPHS verse not located in the summarised chapter.
