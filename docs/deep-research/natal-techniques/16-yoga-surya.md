# Surya yogas — solar yogas (Veśi, Vāśi/Vosi, Ubhayacarī)

> These yogas are formed by planets on either side of the Sun:
> - Vesi: a planet in the 2nd from the Sun.
> - Vasi (Vosi): a planet in the 12th from the Sun.
> - Ubhayachari: planets in both.
>
> The Moon is excluded. They describe how a person's will, status and visibility are supported, and they mirror the lunar yogas. BPHS gives them in a short chapter. Modern use is moderate.

## 1. Sources
- **BPHS ch. 38 "Solar yogas"** (BPHS-ET, V): Vesi, a planet other than the Moon in the 2nd from the Sun; Vosi, one in the 12th; Ubhayachari, both. E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Saravali ch. 14**; **Phaladeepika ch. 6**; **Brihat Jataka 13** does not cover them (R; BJ 13 is lunar only, V).

## 2. When it applies
D1, counting from the Sun. Character, status and public life.

## 3. Inputs required
The Sun's sign; the planets Ma, Me, Ju, Ve and Sa in the 2nd and 12th from it; benefic or malefic nature (and Mercury's associations).

## 4. Calculation / rule
| Yoga | Condition |
|---|---|
| Vesi | Ma, Me, Ju, Ve or Sa in the 2nd from the Sun |
| Vasi (Vosi) | Any of them in the 12th from the Sun |
| Ubhayachari | Planets in both the 2nd and 12th |

Benefic vs malefic forming planets [TEXT, BPHS 38 / Saravali, R]: benefics give good results; malefics give the reverse.

Rahu and Ketu are excluded [COMM].

## 5. Interpretation rules
- [TEXT] Vesi: truthful, lazy or balanced, with steady fortune. Vasi: skilled, charitable and learned. Ubhayachari: king-like, eloquent, with comforts (BPHS 38, R detail).
- [TEXT] The results are good with benefics and poor with malefics (R).
- [MODERN] Mercury in the 2nd or 12th from the Sun forms Vesi or Vasi very often (Mercury is never more than ~28° from the Sun). Readers discount Mercury-only cases.

## 6. Variants and disputes
- Whether Mercury-only formations count.
- Whether combust planets can form the yoga (planets in the 2nd or 12th within the orb).

## 7. Worked micro-example
Sun in Leo, Venus in Virgo (2nd from the Sun): Vesi formed by a benefic.

## 8. Design notes for AI Astra
- **Engine already has**: `yoga.vesi/vosi/ubhayachara_yoga_from_planet_positions`, plus `nipuna_yoga` (Sun-Mercury; see file 22).
- **Must output**:
  - the presence of each yoga and the planets involved, with their benefic or malefic status;
  - a `mercury_only` flag;
  - a combust flag on the forming planets.
- **Board use**: Self, minor.
- **Weight**: low.

## 9. Open questions
- Verify the BPHS 38 result verses.
