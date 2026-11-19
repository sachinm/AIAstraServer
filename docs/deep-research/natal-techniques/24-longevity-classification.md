# Longevity classification — alpa, madhya, purna (āyurdāya)

> Classical texts classify the expected lifespan as short (alpa), medium (madhya) or long (purna). It acts as the outer frame within which every other promise is judged: a dasha that falls beyond the span is not read for events.
>
> BPHS gives three arithmetical methods (Pindayu, Nisargayu, Amsayu) and a rule for which to use. Jaimini's three-pairs method is covered by the Jaimini researcher.
>
> Modern practitioners treat longevity prediction as unreliable and ethically fraught. This file is an overview for internal framing only.

## 1. Sources
- **BPHS ch. 43 "Longevity"** (Santhanam numbering = BPHS-ET archive.org e-text), all (V):
  - Pindayu, vv. 4-9: exaltation contributions Su 19, Mo 25, Ma 15, Me 12, Ju 15, Ve 21, Sa 20 years; half at debilitation.
  - Nisargayu, vv. 16-17: Mo 1, Ma 2, Me 9, Ve 20, Ju 18, Su 20, Sa 50 years.
  - Amsayu, vv. 18-22: from the navamsa count.
  - Choice of method, vv. 30-32: if Lagna is strongest use Amsayu, if the Sun is strongest use Pindayu, if the Moon is strongest use Nisargayu; average when two or three are equal.
  - Deductions: a combust planet's share is halved (except Venus and Saturn); a planet in an enemy sign loses one-third (retrograde planets exempt); malefics in the visible half lose more.
  - Spans, vv. 10-14 and 41-44: alpa under 32 years, madhya 32-64, purna 64-100, beyond 100 supreme.
  - E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **BPHS ch. 44 "Maraka grahas"** (V for the title): the 2nd and 7th, their lords and the planets with them kill in their dashas (R).
- **Brihat Jataka ch. 7 "Length of life"** (BJ-Neely, V for the title): Varahamihira's Pindayu, Nisargayu and Amsayu, with his own preferences (R detail).
- **Saravali**, **Phaladeepika ch. 13** (R).

## 2. When it applies
- Natal; internal only.
- Balarishta (file 18) covers the first 12 years separately.

## 3. Inputs required
- Longitudes of all planets and the lagna.
- Navamsa positions.
- Combustion, enemy-sign and retrograde status.
- Visible or invisible half placement.
- Shadbala of the Lagna lord, Sun and Moon (to pick the method).

## 4. Calculation / rule
1. Compute each planet's contribution in each method.
   - Pindayu and Nisargayu use the planet's arc from deep debilitation (a proportional share).
   - Amsayu uses the elapsed navamsas.
2. Apply the deductions (haranas):
   - chakrapata harana: the visible-half reduction;
   - shatru kshetra harana: one-third in an enemy sign;
   - astangata harana: half when combust.
3. Add the lagna contribution (Amsayu) and sum.
4. Pick the method by the strongest of Lagna, Sun and Moon (43.30-32).
5. Classify: < 32 alpa; 32-64 madhya; 64-100 purna.

## 5. Interpretation rules
- [TEXT] Use the method indicated by the strongest of Lagna, Sun and Moon (43.30-32, V).
- [TEXT] Death occurs in the dasha of a maraka within the indicated span (BPHS 44, R).
- [COMM] When methods disagree, many commentators prefer Jaimini's three-pairs method to fix the span first [COMM; outside scope].
- [MODERN] K.N. Rao, Raman and SJC all warn against communicating longevity predictions.

## 6. Variants and disputes
- Varahamihira (BJ 7) prefers different methods from Parashara in some cases (R).
- Span boundaries: 32/64/96 or 32/64/100 depending on the text and the treatment of purna.
- Jaimini, Ayurdaya from the Moon, and the various "Kakshya" refinements are not covered here.

## 7. Worked micro-example
Omitted on purpose.

## 8. Design notes for AI Astra
- **Engine already has**: `house.longevity` (pyjhora).
- **Design decision**: do not surface longevity or death timing on any board or in any reading. If the engine outputs it, mark it `internal_only` and exclude it from the reader packs. There is no product use that needs it. Recommend not wiring it at all.
- **Pitfall**: the maraka logic overlaps with "difficult period" detection. Phrase difficulty without the death framing (doc 45 vocabulary rules).

## 9. Open questions
- Confirm that the product never needs longevity. If so, file the export as research-only.
