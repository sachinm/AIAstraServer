# Dasha results: overview and decision flow (daśā-phala-vicāra)

> How classical texts turn "X mahadasha / Y antardasha" into a prediction, and in which order the rule sets in this
> folder apply. Built from BPHS (dasha, antardasha, yogakaraka and maraka chapters), Phaladeepika ch. 19-21 and
> Saravali ch. 41-44, which were read in this pass. Laghu Parashari verses, Uttara Kalamrita, Sarvartha Chintamani and
> a Brihat Jataka translation were **not** read and appear only as gaps or pointers.

## 1. Files

| File | Rule set | Evidence level |
|---|---|---|
| `dasha-lord-condition-principles.md` | owned/occupied house, dignity scale, arohini/avarohini, dasha-start placement, timing thirds | strong (BPHS 47-48, PD 20) |
| `functional-nature-laghu-parashari.md` | functional benefic/malefic, kendradhipati dosha, yogakaraka, relation rules | strong via BPHS 34 + PD 20.41-54; LP verses unverified |
| `mahadasha-results-per-planet.md` | per-planet MD lists, strong vs weak | strong (BPHS 47, PD 19) |
| `antardasha-results-per-pair.md` | 81 AD entries as rules; position from MD lord; friendship | strong (BPHS 52-60, PD 20.22-29, 21) |
| `rahu-ketu-dasha-results.md` | nodes by house and association; dispositor rule [MODERN] | strong for house/association |
| `yoga-fructification-in-dasha.md` | when raja/dhana yogas deliver | medium (PD 20.42-54, BPHS 48) |
| `maraka-dasha-rules.md` | maraka periods (health caution only) | strong (BPHS 44, PD 20) |
| `dasha-transit-combination.md` | dasha lord's transit, Sun-ingress trigger, double transit [MODERN] | medium |
| `house-activation-bhavat-bhavam-karaka.md` | which area / which person | medium; bhavat bhavam [MODERN] |
| `pratyantar-and-deeper-levels.md` | L3-L5 basis | weak (one rule, BPHS 61.2) |
| `dasha-sandhi-and-chidra.md` | junctions / dasha end | weak; no classical verse found |
| `dasha-remedies-bphs.md` | BPHS remedy table | text-complete for what was read |

## 2. Edition key

BPHS: archive.org e-text "ParasharaHoraSastra" (97 chapters; translator not named) = enjoylearningsanskrit.com
numbering. Wisdomlib/Sharma edition is about +2 in the dasha chapters (Results of Dasas 49 vs 47; Sun AD 54 vs 52).
Phaladeepika: V. Subrahmanya Sastri 2nd ed. 1950 via wisdomlib OCR (not fully proofread).
Saravali: English translation PDF (lakshminarayanlenasia.com mirror; translator not named in the file), verse numbers
as printed. Its ch. 41-42 describe Moola dasha (ayurdaya order), but the judging rules are general.

## 3. Decision flow (given MD lord M, AD lord A, optional PD lord P)

1. **Functional status** of M and A for the lagna (functional file): trikona lord / 3-6-11 lord / kendra lord (benefic
   loses, malefic gains) / 2-12-8 by association / yogakaraka / maraka. Nodes: by house and association.
2. **Condition of M** (condition file): dignity weight (PD 20.30), house (kendra/trikona/11 good, 6/8/12 bad),
   vargottama, combust, arohini/avarohini (PD 20.56), associations and aspects. Then **placement at the MD start**
   (BPHS 47.5-6, 48.8; Saravali 41.6, 41.16-18, 44.1-3). Result: MD polarity + MD areas (owned and occupied houses, karakatwa).
3. **Yoga check** (yoga file): is M a participant in a natal yoga or related to a yogakaraka? If so mark the MD as a
   fructification window, provisionally.
4. **Maraka check** (maraka file): if M or A is a ranked maraka, set an internal health-caution flag; the field is not
   served to the prompt.
5. **AD relation** (antardasha file): A's house from M (6/8/12 bad; kendra/trikona/3/11 good; PD 20.29 names the area),
   friendship with M (BPHS 50.89; PD 20.28), mutual dusthana ownership (PD 20.22), kendra-trikona pairing (PD 20.42,
   20.48), A's own condition from lagna (BPHS ch. 52-60 template), nakshatra-tara of A in a malefic MD (PD 20.23).
6. **Area and person** (house activation file): owned/occupied houses of M and A, A from M, derived houses, karakas.
7. **Transit gate** (transit file): M and A transit dignity and house (PD 20.34-37, 20.59-60), Sun-ingress month
   (PD 20.38), Moon for days, [MODERN] Jupiter-Saturn double transit for the event.
8. **Phase inside the period**: dreshkana thirds, reversed for retro and nodes (BPHS 47.3-4); sign rising type
   (Saravali 41.75; BPHS 50.88 in the rasi-dasha chapter); planet phase notes (BPHS ch. 47); [MODERN] chidra/sandhi for the last AD.
9. **PD refinement** (pratyantar file): BPHS 61.2 rule; then position from A.
10. **Remedies** (optional): BPHS table keyed on step 4/5 triggers.

Order of weight: functional status and MD condition > AD relation > yoga window > transit > phase > PD > per-pair
descriptions. Step 4 flags are not served to the prompt (doc 82: no word filters; the contract owns tone); they do not raise prediction weight.

## 4. Key questions answered

- **Explicit rules (not descriptions)**: steps 1-2 and 5 above are explicit in the texts (BPHS 34, 44, 47.5-6, 48,
  57.79-type verses; PD 20.1, 20.14, 20.22, 20.27-30, 20.41-54, 20.56).
- **How later texts refine BPHS**: Phaladeepika quantifies dignity (20.30), names the four dasha kinds (20.56), makes
  position from the dasha lord decisive for the bhukti (20.29), adds dasha-transit timing (20.34-38, 20.59-62) and
  restates Parashara's lordship rules (20.41-54). Laghu Parashari condenses BPHS 34 (verified only via BPHS 34 and the
  Verma contents list). Saravali (ch. 41-44) adds a three-step strength grading (41.22-24), navamsa override (41.19),
  Moon and lord **at the dasha start** (41.9, 41.15-18), position-from-dasha-lord sub-period rules (42.6-11) and
  dasha-start "antidotes" (44.1-3). Uttara Kalamrita and Sarvartha Chintamani: **not retrieved**; no claim made.
- **Basis for pratyantar**: BPHS 61.1-2 (arithmetic + one judging rule), 62-63 lists only; PD 21.2, 21.83-84.

## 5. Design notes for AI Astra

The engine must output per active period lord (all levels): functional status with rule id, condition fields, dasha-
start transit placement, AD-from-MD house, friendship (natural + temporal), maraka rank, yoga participation, node
association/dispositor, dated transit states and Sun-ingress dates. Items not already exported are **engine
additions**; Node computes none. The technique contracts own wording; the model never receives death or maraka words.
