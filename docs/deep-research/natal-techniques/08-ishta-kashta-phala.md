# Ishta and Kashta Phala — auspicious and inauspicious potential (iṣṭaphala / kaṣṭaphala)

> Ishta Phala (0-60) measures how far a planet will give good results; Kashta Phala (60 − Ishta) measures how far it will give painful ones. Both come from the planet's exaltation strength and motional strength. Shadbala (file 06) tells how strongly a planet acts; Ishta/Kashta tells in which direction. BPHS gives it in the chapter after Shadbala. Raman's working is the standard modern form, and the dasha chapters use it to grade the dasha period.

## 1. Sources
- **BPHS ch. 28 "Ishta and Kashta Balas"** (Santhanam numbering = BPHS-ET). In BPHS-GCS (wisdomlib, G.C. Sharma) it is **ch. 30**.
  - 28.6 (V, BPHS-ET): reduce 1 from each of the cheshta rashmi and uccha rashmi, multiply each by 10, add them; half the sum is Ishta Phala; 60 − Ishta = Kashta Phala.
  - Rashmi (ray) counts are given earlier in the chapter (R).
  - Link: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- [MODERN] B.V. Raman, *Graha and Bhava Balas*: Ishta = √(Uchcha bala × Cheshta bala); Kashta = √((60 − Uchcha bala) × (60 − Cheshta bala)) (R).

## 2. When it applies
- All seven planets in D1.
- Used to grade a planet's dasha or bhukti, and the good or bad flavour of houses it rules.

## 3. Inputs required
- Uchcha bala and Cheshta bala (from Shadbala), or uccha rashmi and cheshta rashmi (rays).

## 4. Calculation / rule
- **Form A (BPHS-ET 28.6, rashmi-based)**: Ishta = ½ × [10 × (uccha_rashmi − 1) + 10 × (cheshta_rashmi − 1)]. Kashta = 60 − Ishta.
- **Form B (Raman, bala-based)**:
  - Ishta = √(U × C), with U and C in virupas.
  - Kashta = √((60 − U)(60 − C)).
  - Ishta + Kashta ≠ 60 in general.
- **Reading**: Ishta > Kashta means the net effect is benign. Some workings also add Ishta/Kashta across the planets in a house.

## 5. Interpretation rules
- [TEXT] A planet with a large Ishta gives auspicious effects in its periods and through its houses; a large Kashta gives suffering (BPHS 28, R).
- [TEXT/COMM] The fruits of a dasha are scaled by the lord's Ishta or Kashta (BPHS dasha-effects chapters, R).
- [MODERN] Raman: read it together with Shadbala. Strong and high Ishta means excellent; strong and high Kashta means powerful harm.

## 6. Variants and disputes
- **Form A vs Form B**: they give different numbers. The engine's `_ishta_phala` and `_subha_rashmi` exist in `strength.py`; record which form is output.
- Some modern tools also compute a "bhava ishta/kashta" by summing occupants and aspects. This has no verified text basis (U).

## 7. Worked micro-example
- Saturn: U = 50, C = 20.
- Form B: Ishta = √1000 ≈ 31.6; Kashta = √(10 × 40) = 20.
- Net benign, so Saturn's period is more constructive than its reputation suggests.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `strength._ishta_phala`;
  - the `facts` export, which uses the root formula (Form B) over pyjhora's uchcha and cheshta bala. It returns null for the Sun and Moon because pyjhora gives them no cheshta bala (`facts_export.py` docstring).
- **Must output per planet**:
  - `ishta`, `kashta`, the `form` used (A or B), and `net = ishta − kashta`;
  - a label (benign, mixed or harsh), with the threshold source stated.
- **Board use**:
  - Dasha cards: the tone of a period.
  - Self board: which planets are "helpers" and which are "teachers".

  This is the main polarity input alongside functional benefic or malefic status.
- **Pitfalls**: do not mix forms across planets; never derive in Node.

## 9. Open questions
- Which form does Santhanam's print use? BPHS-ET shows the rashmi form, while Raman shows the root form.
- The rashmi tables (uccha and cheshta rays) are not exported; that is an engine addition if Form A is wanted.
