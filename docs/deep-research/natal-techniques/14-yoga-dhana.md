# Dhana yogas — combinations for wealth (dhana yoga) and penury (daridra yoga)

> Dhana yogas arise when the wealth houses relate to each other or to the lagna lord:
> - 2nd (accumulated wealth);
> - 11th (income);
> - 5th (speculative gains, merit);
> - 9th (fortune).
>
> They also arise from benefics in the 5th or 11th from the lagna with specific planets. BPHS devotes one chapter to wealth and one to poverty. They are used in all schools to judge financial capacity, and they feed the Work board's money sub-area.

## 1. Sources
- **BPHS ch. 41 "Combinations for wealth"** (BPHS-ET), all (V):
  - several combinations linking the 5th with the 11th;
  - the lagna with Sun, Moon or Mars plus benefics;
  - v. 16: the lords of the 9th and 5th bestow wealth, and planets conjunct them share in it.
- **BPHS ch. 42 "Combinations for penury"** (BPHS-ET, V for the title; rules R).
- E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Phaladeepika ch. 6** (dhana yogas) and **ch. 5** (R).
- **Saravali** (wealth chapters, R).
- [MODERN] Raman, *300 Important Combinations*: Dhana yoga entries (R).

## 2. When it applies
D1, confirmed in D2 (hora) and D11 (non-BPHS). Money, assets and income.

## 3. Inputs required
- Lords of the 1st, 2nd, 5th, 9th and 11th, with their sambandha.
- Occupants of the 5th and 11th, and the planets in them.
- Dignity and strength.
- Association with the 6th, 8th or 12th lords.

## 4. Calculation / rule
Core rules [TEXT, BPHS 41 V where marked; others R]:

| Rule | Condition | Tag |
|---|---|---|
| D1 | Sambandha among any two of the lords of the 1st, 2nd, 5th, 9th and 11th | R |
| D2 | 5th-11th pairs: the 5th is a planet's own sign with that planet in it, and the 11th holds specified other planets (e.g. 5th = Leo with the Sun, 11th with Saturn, Moon and Jupiter). There is one rule per 5th-house lord | V that 5th-11th rules exist; the specific planet sets are R |
| D3 | The lords of the 5th and 9th, and planets joined with them, give wealth in their periods | V (41.16) |
| D4 | The lagna in the Sun's or Moon's or Mars's sign occupied by that planet, joined or aspected by benefics | V (gist) |
| D5 | The 2nd lord in the 11th and the 11th lord in the 2nd (exchange), or both in kendras or trikonas | R |
| D6 | Lakshmi yoga: the 9th lord in a kendra in own, MT or exaltation sign, with a strong lagna lord (BPHS 36, V) | V |

Spoilers [TEXT/COMM]:
- The lords are in dusthanas or joined by dusthana lords.
- The 2nd or 11th lord is debilitated or combust.

Penury (Daridra, BPHS 42, R): the lagna lord in the 12th with the 12th lord in the lagna joined by a maraka; the 11th lord in a dusthana, and so on.

## 5. Interpretation rules
- [TEXT] Wealth comes in the dasha or bhukti of the yoga-forming lords (BPHS 41, R).
- [TEXT] Planets joined with the 5th and 9th lords also confer wealth (41.16, V).
- [MODERN] Raman: the 2nd shows accumulation and the 11th shows flow. Read both.

## 6. Variants and disputes
- Lists differ greatly across texts. Raman's compilation mixes BPHS, Phaladeepika and Jataka Parijata.
- Whether 2nd- and 11th-lord sambandha alone suffices, or a trikona link is needed.

## 7. Worked micro-example
Cancer lagna:
- The 2nd lord Sun is in the 11th (Taurus).
- The 11th lord Venus is in the 2nd (Leo).
- Exchange (2-11 parivartana), a dhana yoga activated in the Sun or Venus periods.

## 8. Design notes for AI Astra
- **Engine status**:
  - `yoga.py` has no dhana function, but it has Lakshmi, Vasumati, Kalanidhi and other named yogas.
  - `AIAstra_Radha/src/jhora/facts_export.py` `_rule_yogas` emits `Dhana Yoga (lords of X and Y)` when a 2nd or 11th lord is associated with a 1st, 5th or 9th lord.
  - It does not cover the 2-11 pair, the 5-9 pair, the sambandha type, the spoilers or the BPHS 41 planet-in-house rules.
- **Engine addition**: extend that rule to every pair among the lords of the 1st, 2nd, 5th, 9th and 11th, with the sambandha type and spoiler flags, plus the BPHS 41 rule hits (rule id, text, verse).
- **Board use**: the Work board's money sub-area; Lucky (windows when dhana lords run).
- **Weight**: medium-high for the money promise.
- **Pitfall**: never quote amounts. The scale is relative to the person's circumstances.

## 9. Open questions
- Make a verified rule-by-rule list of BPHS 41 and 42 from a clean print before the engine implements the "BPHS 41 rule hits".
