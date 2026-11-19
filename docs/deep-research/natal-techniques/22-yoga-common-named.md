# Common named yogas — Gajakesari, Budhaditya, Amala, Lakshmi, Saraswati and others

> These named combinations are widely quoted in readings. Some are from BPHS ch. 36 "Many other yogas". Some are from Phaladeepika, Jataka Parijata or Saravali, and some (e.g. Budhaditya) are modern labels of classical conjunction results. They are useful as named, explainable features. They are also frequently over-detected, so each needs its conditions checked exactly.

## 1. Sources
- **BPHS ch. 36 "Many other yogas"** (BPHS-ET), all (V):
  - Gajakesari: Jupiter in a kendra from the lagna or the Moon, conjunct or aspected by a benefic, not debilitated, combust or in an enemy's sign;
  - Amala: only a benefic in the 10th from the lagna or the Moon;
  - Parvata: benefics in kendras, with the 7th and 8th empty or holding only benefics;
  - Kahala: the 9th lord (4th lord in some readings) and Jupiter in mutual kendras, with a strong lagna lord;
  - Lakshmi: the 9th lord in a kendra in own, MT or exaltation sign, with a strong lagna lord.
  - E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Phaladeepika ch. 6**: Gajakesari as Jupiter in a kendra from the Moon; Sakata; Budha-Aditya results under "Nipuna" (R).
- **Jataka Parijata**: Saraswati yoga (R).
- [MODERN] Raman, *300 Important Combinations*.

## 2. When it applies
D1. The life area depends on the yoga (see the table).

## 3. Inputs required
Planet signs and houses from the lagna and the Moon, lordships, dignity, combustion, aspects, and lagna lord strength.

## 4. Calculation / rule
| Yoga | Condition | Source | Area |
|---|---|---|---|
| Gajakesari | Jupiter in a kendra from the lagna or Moon, + benefic conjunction or aspect; Jupiter not debilitated, combust or in an enemy sign | BPHS 36 (V) | Fame, respect, wisdom |
| Gajakesari (popular) | Jupiter in a kendra from the Moon only, no further conditions | PD 6 / modern (R) | — |
| Budhaditya (Nipuna) | The Sun and Mercury conjoined. Commonly requires Mercury not combust and the pair well placed | Modern label; Saravali / PD treat Sun-Mercury results (R) | Intellect, skill |
| Amala | Only a benefic in the 10th from the lagna or Moon | BPHS 36 (V) | Reputation, conduct |
| Parvata | Benefics in kendras; the 7th and 8th empty or holding benefics only | BPHS 36 (V) | Prosperity, fame |
| Kahala | The 9th (or 4th) lord and Jupiter in mutual kendras; strong lagna lord | BPHS 36 (V) | Boldness, leadership |
| Lakshmi | The 9th lord in a kendra in own, MT or exaltation sign; strong lagna lord | BPHS 36 (V) | Wealth, fortune |
| Saraswati | Jupiter, Venus and Mercury in kendras, trikonas or the 2nd; Jupiter in own, exaltation or friend's sign | Jataka Parijata (R) | Learning, arts |
| Chandra-Mangala | Moon + Mars | BPHS / PD (R) | Earnings (sometimes by questionable means) |
| Sakata | Jupiter in the 6th, 8th or 12th from the Moon (cancelled if Jupiter is in a kendra from the lagna) | PD 6 (R) | Fluctuating fortune |
| Guru-Mangala | Jupiter + Mars (conjunction or mutual aspect) | Modern (R) | Enterprise |
| Shankha, Bheri, Mridanga, Chamara, Shrinatha, etc. | Lordship placement rules | BPHS 36 (R) | Various |

## 5. Interpretation rules
- [TEXT] Gajakesari gives fame, wealth, intelligence and lasting reputation (BPHS 36, R wording).
- [TEXT] Lakshmi gives wealth and noble conduct (BPHS 36, V for the definition).
- [MODERN] Budhaditya is so common (Mercury is always within 28° of the Sun) that most readers credit it only when Mercury is out of combustion and the pair is in a good house.

## 6. Variants and disputes
- **Gajakesari**: BPHS (V) adds benefic aspect and dignity conditions, whereas the popular form is just Jupiter in a kendra from the Moon. Phaladeepika (R) is the popular form's likely source.
- **Kahala**: 9th lord vs 4th lord (translation variance noted in the BPHS-ET fetch).
- **Budhaditya**: not a BPHS named yoga. The engine calls the Sun-Mercury yoga "Nipuna".

## 7. Worked micro-example
Moon in Cancer, Jupiter in Libra (4th from the Moon):
- The popular Gajakesari forms.
- The BPHS form needs a benefic with or aspecting Jupiter, and Jupiter not in an enemy's sign. Libra is Venus's sign, an enemy of Jupiter, so the BPHS form **fails**.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `yoga.gaja_kesari`, `amala`, `parvata`, `kaahala`, `lakshmi`, `saraswathi`, `chandra_mangala`, `guru_mangala`, `nipuna`;
  - Sankha, Bheri, Mridanga, Chamara, Sreenaatha and more.

  `AIAstra_Radha/src/jhora/facts_export.py` `_rule_yogas` emits `Budha-Aditya` whenever the Sun and Mercury share a sign, with no combustion or house check. pyjhora's `nipuna_yoga` is a separate Sun-Mercury yoga.
- **Engine addition**: give Budha-Aditya a Mercury-combust flag and the house, so the strict reading in §5 can be applied.
- **Must output per yoga**:
  - present (true/false) and the variant (BPHS strict, or popular);
  - each condition with its result;
  - the planets involved and their dignity and combustion;
  - the source tag.
- **Board use**: Self (Gajakesari, Saraswati, Budhaditya), Work (Amala, Lakshmi), Lucky (Lakshmi).
- **Weight**: low-medium. These name a feature; they do not decide it.
- **Pitfall**: always use the strict variant for anything shown to users.

## 9. Open questions
- Verify Saraswati in Jataka Parijata.
- Confirm pyjhora's Nipuna conditions against Budha-Aditya.
