# Pancha Mahapurusha yogas (pañca mahāpuruṣa yoga)

> These are five yogas formed when Mars, Mercury, Jupiter, Venus or Saturn is in its own or exaltation sign in a kendra:
> - Ruchaka (Mars);
> - Bhadra (Mercury);
> - Hamsa (Jupiter);
> - Malavya (Venus);
> - Shasha (Saturn).
>
> Each produces a "great person" with that planet's qualities. They are among the most-cited yogas. Because they are fairly common (no frequency study was checked; the engine can measure it on the research kundlis), modern schools insist on strength and cancellation checks.

## 1. Sources
- **BPHS ch. 75 "Characteristic features of Panchmahapurushas"** (Santhanam numbering = BPHS-ET contents, V for the title; rule and results R).
- **Phaladeepika ch. 6** (Mahapurusha definitions near the chapter opening, R).
- **Saravali ch. 35** (R).
- **Brihat Jataka 11**: no named Mahapurusha yogas; similar placements only (V-Sa, BJ-Neely Sanskrit-only page read by a fetch model: https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english/d/doc1501546.html).
- [MODERN] B.V. Raman, *300 Important Combinations* nos. on Mahapurushas; SJC and K.N. Rao on cancellation.

## 2. When it applies
D1 natal. The yoga is a personality and status promise; it bears on Self and Work.

## 3. Inputs required
Signs of Mars through Saturn, the lagna (and the Moon for the variant), dignity, combustion, Shadbala, conjunction with the Sun or Moon, and D9 dignity.

## 4. Calculation / rule
| Yoga | Planet | Condition |
|---|---|---|
| Ruchaka | Mars | In Aries, Scorpio or Capricorn, in a kendra (1, 4, 7, 10) |
| Bhadra | Mercury | In Gemini or Virgo, in a kendra |
| Hamsa | Jupiter | In Sagittarius, Pisces or Cancer, in a kendra |
| Malavya | Venus | In Taurus, Libra or Pisces, in a kendra |
| Shasha | Saturn | In Capricorn, Aquarius or Libra, in a kendra |

Kendra from the lagna [TEXT, BPHS 75, R]. Some texts and modern practice also count kendra from the Moon [disputed; Phaladeepika (R) / Raman].

Cancellation and dilution [COMM/MODERN]:
- The planet is conjoined with the Sun or Moon (Saravali-type statement, R: the person is then a "mere" Mahapurusha or the yoga yields a small result).
- The planet is combust or defeated in war.
- The planet is weak in Shadbala or debilitated in D9.
- The planet is a functional malefic for the lagna (K.N. Rao).

## 5. Interpretation rules
- [TEXT] Ruchaka: martial, bold, commanding. Bhadra: learned, eloquent, skilled. Hamsa: righteous, respected. Malavya: refined, wealthy, comfortable. Shasha: authority over people, though with a crafty streak (BPHS 75, R).
- [TEXT] Results are given especially in the dasha of the yoga-forming planet (BPHS 75, R).
- [MODERN] A Mahapurusha yoga in the 7th or 10th gives public prominence. In the 1st it marks the personality. In the 4th it brings domestic comfort.

## 6. Variants and disputes
- Kendra from the lagna only (BPHS) vs from the lagna or Moon (Phaladeepika and Raman, R).
- MT is counted as own sign by all.
- Whether conjunction with the Sun or Moon cancels or only dilutes.
- Whether the yoga works when the planet's D9 dignity is poor.

## 7. Worked micro-example
Gemini lagna, Jupiter in Pisces (10th):
- Hamsa from the lagna.
- Jupiter also owns the 7th and 10th, a kendradhipati dosha for a benefic, which a K.N. Rao-type reading would note as diluting.

## 8. Design notes for AI Astra
- **Engine already has**: `yoga.ruchaka/bhadra/sasa/maalavya/hamsa_yoga_from_planet_positions`.
- **Must output per yoga**:
  - present (true/false), the planet, the house from the lagna and from the Moon, and the reference used;
  - dignity (own, MT or exalted) and D9 dignity;
  - combust, war-lost and conjoined-luminary flags;
  - Shadbala ratio and functional nature;
  - `strength_grade` (full, diluted or cancelled) with the reasons and their text tags.
- **Board use**: Self (character), Work (status).
- **Weight**: medium. Never headline it without the strength grade.
- **Pitfall**: frequent yogas look impressive. Show them only when the grade is full.

## 9. Open questions
- Check the BPHS 75 and Phaladeepika 6 verses for the Moon-kendra wording.
