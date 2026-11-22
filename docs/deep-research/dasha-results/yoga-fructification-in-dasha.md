# When yogas fructify in dashas (yoga-phala-kāla: rāja-yoga and dhana-yoga timing)

> A natal yoga (raja yoga from kendra-trikona lords, dhana yoga from 2/5/9/11 lords, and others) is a promise; the
> texts say it delivers in the dashas and bhuktis of the planets that form it or are related to it. Raja yoga "begins"
> in the bhuktis of the karaka planets and can be carried on by following bhuktis. This answers "when will this yoga
> pay off" and is the bridge between natal promise and timing.

## 1. Sources

- Phaladeepika (1950, wisdomlib OCR): 20.42 (trikona lord in kendra or kendra lord in trikona: such pairs help each
  other in mutual bhuktis), 20.44 (a planet's dasha effects appear most clearly in bhuktis of planets related to it),
  20.45-49 (kendra-trikona relation makes both yogakaraka; planets related to a yogakaraka bring prosperity in their
  bhuktis; trikona lord's dasha with kendra lord's bhukti good and the reverse), 20.54 (raja yoga begins in the bhuktis
  of karaka planets and is extended by the malefic bhuktis that follow), 20.25-26 (Mars/Venus specific kingship
  dashas).
- BPHS ch. 48 (IAST on enjoylearningsanskrit): 48.9-10 (planet joined with 5th lord auspicious, with 9th lord supremely
  so), 48.12-13 (kendra-trikona lords in each other's houses: both dashas auspicious), 48.16-18 (1st-9th exchange very
  good; 1st-10th exchange: *tayor daśāvipāke tu* - gain of kingdom in their dasha).
- BPHS 34.11-15 (yoga formation; dusthana co-lordship cancels).
- BPHS e-text 50.84-85 (rasi-dasha chapter: dashas become auspicious when 9th and 10th lords are linked to yoga).
- Laghu Parashari sections "Dasas of Yogakarakas", "Extinction of Rajayoga", "Auspicious Dasa and Bhukti of Yogakaraka",
  "Yogakaraka and Maraka Dasa-Bhuktis" (Verma contents only; verses not fetched).

## 2. When it applies

Whenever the natal chart has a yoga. Life areas: raja yoga = status, career, authority (Work); dhana yoga = money
(Work/Lucky); 5/9 links = children, fortune (Love/Self).

## 3. Inputs required

Engine list of yogas with **participating planets** and the house lords involved; relation type (conjunction, exchange,
mutual aspect, single planet owning both); whether participants also own 6/8/12; condition of each participant.

## 4. Rule procedure

1. List yogas and their participant planets (engine).
2. Mark the "fructification set": participants + planets conjunct/aspecting participants + planets in their stars
   ([MODERN] for the star extension).
3. Peak windows: MD of one participant with AD of the other (PD 20.42, 20.48-49; BPHS 48.13).
4. Start: AD of the yogakaraka within any MD (PD 20.54); continues through following bhuktis even of malefics.
5. Cancellation: yoga with dusthana co-lords via mere mutual lordship (BPHS 34.15); "extinction of raja yoga" rules in
   LP (not fetched).
6. Condition filter: yoga strength from participants' dignity (condition file).

## 5. Interpretation rules

- [TEXT] Mutual MD/AD of kendra and trikona lords delivers the raja yoga (PD 20.42, 20.48; BPHS 48.12-13).
- [TEXT] 1st-10th lord exchange: kingdom in their dashas (BPHS 48.17-18).
- [TEXT] Related planets carry the yoga in their bhuktis; unrelated ones do not spoil it (PD 20.48-49).
- [TEXT] Raja yoga begins in the karaka's bhuktis and runs on (PD 20.54).
- [MODERN] Dhana yoga uses the same logic with 2/11 lords + 5/9 lords; the fetched verses state it for raja yoga.

## 6. Variants and disputes

- A secondary commentary seen only as a search snippet says that when a raja yoga operates in the sub-period of a
  planet that is both yogakaraka and maraka, the yoga's effect improves. Not verified against Laghu Parashari; LP's
  section "Yogakaraka and Maraka Dasa-Bhuktis" (Verma contents) is the place to check.
- Saravali 41.74 (read): Pancha Mahapurusha yogas deliver in the dashas of the planets forming them; a weak planet's
  good results are felt only "in dreams and thoughts".
- Jaimini rasi-dasha timing of yogas is outside this folder's scope.

## 7. Worked micro-example

Capricorn lagna: Venus owns 5 and 10 = yogakaraka. If Venus sits in the 9th with Mercury (6th/9th lord), Venus MD
Mercury AD and Mercury MD Venus AD are the fructification windows.

## 8. Design notes for AI Astra

- Engine: `yoga[].participants`, `yoga[].fructification_periods[]` (MD/AD/PD rows where participants are active),
  `yoga[].cancelled_by` rule id. **Engine addition** if absent.
- Work board: "your strongest career period" should come from this table, not from the model.
- Weight: high for Work/Lucky long-range; must still pass the transit gate (dasha-transit file).

## 9. Open questions

- LP "extinction of raja yoga" and "yogakaraka + maraka" verses: fetch and add.
- Whether pratyantar of a participant is enough to trigger (texts silent; [MODERN] practice uses PD for dating).
