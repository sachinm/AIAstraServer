# Parivartana yoga — mutual exchange of signs (parivartana)

> Two planets each occupy the other's sign. Each acts as if in its own sign, and the two houses involved are bound together.
>
> Phaladeepika divides the 66 possible house-pair exchanges into three classes:
> - **Maha** (great): good houses only.
> - **Khala** (involving the 3rd).
> - **Dainya** (involving the 6th, 8th or 12th).
>
> Exchange is also the strongest kind of sambandha for raja and dhana yogas (files 13-14). It is universally used.

## 1. Sources
- **Phaladeepika ch. 6**: Maha, Khala and Dainya parivartana with results. Commonly cited as 6.29-33 (R; verse numbers unverified).
- **BPHS ch. 39**: lagna lord and 5th lord exchange is a maha raja yoga (V, BPHS-ET). BPHS uses exchange as a sambandha in raja yogas (R).
- E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- [MODERN] K.N. Rao, Raman.

## 2. When it applies
D1 primarily. Some apply it in D9 and D10. All areas whose lords are involved.

## 3. Inputs required
Sign lords of all planets' positions (including dual-lordship signs), and the houses owned by each planet for the lagna.

## 4. Calculation / rule
1. Find the pairs (A, B) where A is in a sign owned by B and B is in a sign owned by A.
2. Determine the houses H_A and H_B that are exchanged (the houses of the signs involved).
3. Classify [TEXT, PD 6, R]:
   - **Dainya**: either house is the 6th, 8th or 12th. Results: unsteady, troubled by enemies.
   - **Khala**: either house is the 3rd (and neither is a dusthana). Results: fluctuating fortune, sometimes arrogant.
   - **Maha**: both houses are among 1, 2, 4, 5, 7, 9, 10, 11. Results: wealth, status, comforts.

Count check: of the 66 pairs, Dainya 30, Khala 8, Maha 28 [COMM, R].

Exchanges between Rahu and Ketu and a sign lord are not classical.

## 5. Interpretation rules
- [TEXT] Maha parivartana gives prosperity and honour; Khala mixed results; Dainya hardship (PD 6, R).
- [TEXT] Lagna lord and 5th lord exchange is a great raja yoga (BPHS 39, V).
- [MODERN] Exchange makes both planets "own-sign" in effect. Each delivers the other house's results in its dasha.
- [MODERN] A dusthana lord in exchange with a kendra or trikona lord can also form viparita-type results (file 19).

## 6. Variants and disputes
- Whether planets with two signs exchange through either sign.
- Whether an exchange in D1 needs confirmation in D9.
- Whether the Dainya class still lifts the kendra or trikona house involved (mixed views).

## 7. Worked micro-example
Leo lagna, Sun in Sagittarius (5th) and Jupiter in Leo (1st):
- The lagna lord and the 5th lord exchange: Maha parivartana and a BPHS maha raja yoga.

## 8. Design notes for AI Astra
- **Engine already has**: `AIAstra_Radha/src/jhora/facts_export.py` `_rule_yogas` emits `Parivartana (Maha|Khala|Dainya)` for the seven planets, with the planets and houses. The classification matches the table above. The `facts` export also has an `exchanges` list.
- **Engine addition**: a `text` tag (Phaladeepika 6) on the row, and the signs exchanged.
- **Board use**: every board whose house is involved (e.g. a 7-10 exchange touches Love and Work).
- **Weight**: high for the houses linked.
- **Pitfall**: avoid double counting when the same exchange also triggers raja or dhana yogas. Readers should see one item with all its roles.

## 9. Open questions
- Verify the Phaladeepika 6 verse numbers and the count convention.
