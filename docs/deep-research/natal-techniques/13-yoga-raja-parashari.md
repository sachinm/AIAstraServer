# Parashari Raja yogas (rāja yoga) and yogakarakas

> In Parashari doctrine a raja yoga (combination for power and status) arises when the lord of a kendra (1, 4, 7, 10; Vishnu sthanas) relates to the lord of a trikona (1, 5, 9; Lakshmi sthanas). The relationship can be conjunction, mutual aspect, exchange, or one lord in the other's house. A single planet owning both a kendra and a trikona is a yogakaraka.
>
> These lordship-based rules are BPHS's own. Varahamihira's raja yogas (BJ 11) are built instead on exaltations and placement patterns. They are the backbone of status and career promise in modern Parashari practice (K.N. Rao, Raman, SJC).

## 1. Sources
- **BPHS ch. 34 "Yoga karakas"** (BPHS-ET, V for the chapter; vv. 2-7 kendra and kona lordships; vv. 19-44 yogakarakas per lagna, V as located; rule detail R).
- **BPHS ch. 39 "Raja yoga"** (BPHS-ET), all (V):
  - lagna lord and 5th lord exchange: maha raja yoga;
  - benefics in the 2nd, 4th and 5th from the lagna lord or atmakaraka: kingship;
  - mutual aspect of the 5th and 9th lords: a kingdom;
  - one, two or three exalted planets: rising status.
- **BPHS ch. 40 "Yogas for royal association"**: kendra-kona lord relationship gives raja yoga (v. 28 per the fetch, V). The same fetch also cited ch. 42 vv. 28-34 for related kendra-kona content; the exact verse needs a print check.
- E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Brihat Jataka ch. 11** (BJ-Neely, V-Sa: a model reading of the Sanskrit-only page): raja yogas from exalted planets and named patterns; no lordship-based rules.
- **Phaladeepika ch. 7 "Maharaja yogas"** (R).
- [MODERN] K.N. Rao, *Yogis, Destiny and the Wheel of Time*; Raman, *300 Important Combinations*.

## 2. When it applies
D1, confirmed in D9 and D10. Work and status, and the general fortune of the native.

## 3. Inputs required
- Lords of all houses for the lagna.
- Sambandha between every kendra lord and every trikona lord: conjunction, mutual full aspect, exchange, and one lord in the other's house (with or without aspect back).
- Lord dignity, combustion, strength and dusthana placement.
- Association with the 6th, 8th or 12th lords.
- The yogakaraka per lagna.

## 4. Calculation / rule
**Functional nature by lordship** (BPHS 34, R):
- Trikona lords (5, 9): always benefic. The lagna lord is benefic.
- Kendra lords: natural benefics lose beneficence (kendradhipati dosha); natural malefics lose maleficence.
- 3rd, 6th and 11th lords: malefic.
- 8th lord: malefic, unless it also owns the lagna. The Sun and Moon are free of the 8th-lordship blemish.
- 2nd and 12th lords: neutral; they act by association.
- **Yogakaraka**: one planet owning a kendra and a trikona. Examples: Saturn for Taurus and Libra lagnas, Mars for Cancer and Leo, Venus for Capricorn and Aquarius.

**Raja yoga rule**:
- Any (kendra lord) + (trikona lord) sambandha.
- The strongest is the 9th + 10th lords (dharma-karmadhipati).
- The lagna lord counts as both a kendra and a trikona lord.

| Sambandha | Strength [COMM] |
|---|---|
| Exchange (parivartana) | strongest |
| Conjunction | strong |
| Mutual aspect | strong |
| One in the other's sign, aspected by it | medium |
| One aspecting the other only | weak |

**Spoilers** [TEXT/COMM]:
- A lord also owning a dusthana (6, 8, 12) joins the yoga. Partial spoil (BPHS 34/39, R).
- The yoga falls in the 6th, 8th or 12th.
- Lords debilitated, combust or defeated (without neecha bhanga).
- Joined by the 8th lord.

**Results timing** [TEXT]: in the dashas and antardashas of the yoga-forming planets, especially when they are related (BPHS 39 and the dasha chapters, R).

## 5. Interpretation rules
- [TEXT] Kendra-kona lord sambandha gives raja yoga (BPHS 40.28 per BPHS-ET, V-located).
- [TEXT] Exchange between the lagna lord and the 5th lord gives a great raja yoga. The 5th and 9th lords in mutual aspect give a kingdom (BPHS 39, V).
- [TEXT] A yogakaraka in a kendra or trikona gives raja yoga by itself (BPHS 34, R).
- [MODERN] K.N. Rao: in a modern setting "raja yoga" means rise in one's field. The 10th lord of D10 must confirm.
- [MODERN] SJC also uses raja yoga from the atmakaraka and amatyakaraka (Jaimini; out of scope here).

## 6. Variants and disputes
- **BPHS vs BJ**: lordship-based vs exaltation and pattern-based raja yogas (V).
- **Kendradhipati dosha**: how strongly it applies (to Jupiter and Venus mainly, R) is disputed.
- **A trikona lord that also owns the 8th** (e.g. Saturn for Gemini lagna, owning the 8th and 9th): whether it joins raja yogas fully. This is disputed.
- **Rahu and Ketu** in a kendra or trikona with a trikona or kendra lord form raja yoga (BPHS 34, R; widely used).

## 7. Worked micro-example
Leo lagna:
- Mars owns the 4th (kendra) and the 9th (trikona), so it is the yogakaraka.
- Mars with Venus (10th lord) in the 10th: a 9th + 10th lord conjunction in a kendra, a strong raja yoga for career.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `raja_yoga.dharma_karmadhipati_raja_yoga`, `get_raja_yoga_pairs` and `check_other_raja_yoga_1..3`;
  - `house.is_yoga_kaaraka`.
- **Must output per pair**:
  - the planets, the houses they own, the sambandha type, the houses occupied, and the dignity of each;
  - spoiler flags (dusthana ownership, dusthana placement, combust or debilitated, 8th-lord contact), each with a text tag;
  - the D9 and D10 dignity of both planets;
  - a grade.
- **Also output** the functional benefic, malefic and neutral list for the lagna, with the rule source.
- **Board use**: Work (rise, recognition), Self (life's high points).
- **Weight**: high for status promise. Timing comes from the dasha files.
- **Pitfall**: almost every chart has some kendra-kona contact. Show only graded yogas with dasha activation.

## 9. Open questions
- Verify the BPHS 40 vs 42 verse location for the kendra-kona rule.
- Product decision on the 8th-and-9th-lord dispute.
