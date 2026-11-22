# Natal judgement in classical Parashari astrology — overview (janma-kuṇḍalī vicāra)

> The classical texts judge a birth chart in a fixed order:
> 1. **Promise**: does the chart contain the event or quality at all (house, lord, karaka, yogas)?
> 2. **Strength and quality**: how fully and how well will it deliver (dignity, balas, avasthas, vargas)?
> 3. **Timing**: when (dashas, then transits and annual charts).
>
> Nothing is timed that is not promised. This folder documents layers 1 and 2 from the original texts, for the AI Astra engine and boards. Dashas, transits, ashtakavarga and Jaimini are covered by other researchers.

## 1. Sources and conventions
**Texts used and the editions referred to**:

| Short name | Text / edition | Status this session |
|---|---|---|
| BPHS-ET | *Brihat Parashara Hora Shastra*, archive.org e-text "Parashara Hora Sastra" (https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt) | Read (chapters 26-28, 34-45 windows). 97 chapters, numbered as in R. Santhanam's translation. Translator not named on the page |
| BPHS-GCS | BPHS, Girish Chand Sharma translation (wisdomlib) | Table of contents only. Its chapter numbers are offset (e.g. Ishta/Kashta = ch. 30, Santhanam ch. 28) |
| BJ-Neely | *Brihat Jataka*, Sanskrit text by M. D. Neely (wisdomlib) | Sanskrit of ch. 2, 11 and 13 only, read by a fetch model (no English on those pages). Marked V-Sa: treat as provisional |
| BS-Iyer | *Brihat Samhita*, N. Chidambaram Iyer 1884 (wisdomlib) | Read ch. 17 |
| SS | *Surya Siddhanta*, Burgess (swaveda) | Summary only (ch. 9) |
| PD | *Phaladeepika*, V. Subrahmanya Sastri 1950 | **Not reachable** (403). All verse numbers recalled |
| Saravali, Jataka Parijata, Hora Sara, Sarvartha Chintamani | — | Not consulted this session. Recalled only |

**Verse numbering**: all BPHS chapter numbers are Santhanam / BPHS-ET numbering unless stated.

**Verification marks**:
- **(V)**: rule seen in a source this session.
- **(R)**: recalled from the text; the verse number was not checked.
- **(U)**: no verse located.

**Tags**:
- **[TEXT]**: a classical text.
- **[COMM]**: a traditional commentator, or the common traditional reading.
- **[MODERN]**: a modern school (SJC/Sanjay Rath, K.N. Rao/BVB, Raman, PVR, Iranganti). KP is not classical and is excluded.

## 2. When it applies
To every natal question, before any dasha or transit is read. The product rule "the chart leads the question, and the assistant confirms before it predicts" is exactly this order.

## 3. Inputs required
A correct birth time, place and ayanamsa, from which all the engine outputs listed in the files follow.

## 4. The classical order of judgement
**Step 0: Is the chart reliable?**
- Birth-time sensitivity: lagna and varga boundaries.
- [COMM] Arishta and balarishta come first in old texts (BPHS 9-10, BJ 6). For this product they are internal only (file 18).

**Step 1: General strength of the chart**
1. Lagna, lagna lord and Moon: their strength and dignity (files 04, 06).
2. Strongest and weakest planets (Shadbala ratio, file 06; Vimshopaka, file 09).
3. Functional nature of each planet for this lagna (BPHS 34; file 13).
4. Life-long pattern yogas: Nabhasa (file 17), Mahapurusha (file 12), lunar and solar yogas (files 15-16).

**Step 2: The promise of the house in question** (file 01, the core)
1. Select the house(s) (file 02).
2. Read the house: occupants and aspects (file 03).
3. Read the lord: placement from the lagna and from the house, dignity (04), combustion, retrogression and war (05), associations, Bhava bala (07).
4. Read the karaka, including karako bhava nashaya [COMM].
5. Read the derived house (bhavat bhavam) and repeat from the Moon.
6. Check the yogas touching the house: raja (13), dhana (14), viparita (19), neecha bhanga (20), parivartana (21), named yogas (22).

**Step 3: Quality and quantity of delivery**
1. Ishta/Kashta of the lords and karakas: whether results are benign or harsh (08).
2. Avasthas: how much (Baladi), whether it delivers at all (Jagradadi), and in what mood (Deeptadi, Lajjitadi) (10).
3. Confirmation in the relevant varga: dignity, vargottama, varga lagna (11).
4. Nakshatra colouring of the lords (23).

**Step 4: Frame**
- Longevity class (24): internal only, never surfaced.

**Step 5: Timing** (out of scope here)
- Dashas of the lords and yoga-formers that carry the promise, then transits.
- [TEXT] BPHS repeatedly states that yogas give results in the dashas of the forming planets (ch. 39, 41, 75, R).

**Weighting** (synthesis, [COMM/MODERN]; there is no single classical formula):

| Layer | Weight for "is it promised?" | Weight for "how well?" |
|---|---|---|
| House, lord and karaka placement (01) | Primary | High |
| Dignity (04), combustion and war (05) | High | Primary |
| Yogas (12-22) | Medium (named confirmers) | Medium |
| D9 and relevant varga (11) | Confirmer / veto | High |
| Shadbala and Bhava bala (06, 07) | Tie-breaker | Medium (capacity) |
| Ishta/Kashta (08) | — | High (polarity) |
| Vimshopaka (09) | Confirmer | Medium |
| Avasthas (10) | Modifier | Medium |
| Nakshatra (23) | Low | Medium (flavour) |

[MODERN] K.N. Rao's working rule is three independent confirmations before any statement. SJC adds the Jaimini confirmations (other folder).

## 5. Interpretation rules
- [TEXT] A house prospers when its lord and karaka are strong and benefics aspect it; it is destroyed when its lord is in a dusthana, weak, or under malefic aspect (BPHS 11, R; PD 15, R).
- [TEXT] Strength without benefic quality gives strong but painful results (BPHS 27.33 on Saturn, V; Ishta/Kashta, BPHS 28, V).
- [TEXT] Yogas fructify in the dashas of their planets (BPHS, R).

## 6. Variants and disputes
Key disputes are found in the files:
- the Sun's Shadbala minimum (5 vs 6.5) and the Kala/Cheshta component minimums swapped between sources (06);
- Ishta/Kashta formula, rashmi-based vs root-based (08);
- the Deeptadi lists, and the Baladi fractions vs the engine's multipliers (10);
- Kemadruma definition and cancellation, BPHS vs BJ (15; the BJ side is unconfirmed, read from untranslated Sanskrit);
- Gajakesari strict vs popular (22);
- Mahapurusha from the Moon (12);
- the BPHS basis of Viparita (19);
- the neecha bhanga list length (20);
- the graha yuddha winner rule (05);
- the Rahu/Ketu dignity and aspect rules (03, 04).

## 7. Worked micro-example
"Will I have a strong career?":
1. 10th house, lord and karakas (01).
2. Dignity and strength of the 10th lord (04, 05, 06).
3. Raja yogas, especially 9-10 lords (13).
4. 10th of D10 and the D1 10th lord in D10 (11).
5. Ishta of the 10th lord (08).
6. Promise grade.
7. Then the dasha files for when.

## 8. Design notes for AI Astra
- **The engine is the only source.** Every factor above must arrive precomputed in the house card or planet card, with:
  - a value;
  - the rule or variant used;
  - a `text` tag (BPHS, PD, BJ, SJC, Raman …).

  The reader (human or model) then judges without computing.
- **Engine already has** (AIAstra_Radha, pyjhora):
  - shadbala, bhava bala, ishta, vimshopaka and vaiseshikamsa;
  - all vargas with method variants;
  - combustion and retrograde;
  - drishti and relationships;
  - 98 named yogas and the raja, viparita and neecha bhanga yogas;
  - the `facts` export's `radha.rule` yogas: Parivartana with the Maha/Khala/Dainya class, Budha-Aditya, Dhana pairs, Viparita per lord, Neecha Bhanga;
  - doshas;
  - avasthas;
  - nakshatra data;
  - longevity.
- **Engine findings**:
  - `strength.py:806` uses Sun 5 rupas against BPHS-ET's 6.5.
  - The avasthas export's Baladi multipliers are Vriddha 0.35 and Mrita 0.10 against the text's "negligible" and "nil".
  - The avasthas export's Deeptadi list is a non-BPHS-ET variant.
  - Shayanadi falls back silently to 1.0 ghatis if the sunrise lookup fails, and the name-syllable sub-state is not computed.
- **Engine additions** (each listed in its file):
  - a graha yuddha block;
  - Shadbala component-minimum flags;
  - fuller dhana and neecha bhanga rule sets (the `facts` export's `radha.rule` yogas cover only part of each; see files 14, 20);
  - Kemadruma variant and cancellation detail;
  - per-condition outputs for neecha bhanga and Gajakesari;
  - a `text` tag on every rule;
  - birth-time sensitivity per varga;
  - arishta flags only if wanted, marked internal.
- **Boards**:
  - Self: lagna, Moon, strongest planets, Mahapurusha and Nabhasa yogas, avasthas, nakshatra.
  - Love: 7th, Venus, D9.
  - Work: 10th, 6th, 11th and 2nd, raja and dhana yogas, D10.
  - Lucky: 9th and 11th, Lakshmi.
- **Never surface**: longevity, arishta, raw classical harsh words (see the doc 45 vocabulary).

## 9. Open questions
- A print check of Santhanam's BPHS for the items marked (R), especially the Sun's Shadbala minimum, the Kala/Cheshta order, the partial-aspect fractions and BPHS 11 verse numbers.
- Getting the Phaladeepika text (archive.org copy) to verify every PD citation.
- A product decision on default variants (war winner, Rahu/Ketu, Gajakesari, Kemadruma, neecha bhanga list).
