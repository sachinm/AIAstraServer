# Transits under dasha: overview (gocara and daśā)

> Gochara is the movement of the planets through the sky, judged against the natal chart. It is the timing layer of
> Jyotisha. The classical texts score it mainly from the natal Moon sign (Phaladeepika 26:1). They refine it with
> vedha, latta, nakshatra counts and ashtakavarga bindus. Every school reads transits as the trigger for what the dasha
> and the natal chart already promise. The texts read here state that hierarchy only implicitly; it is a strong
> traditional and modern consensus. This folder documents each technique from the texts and says what the engine must
> output.

## Files in this folder
| File | Technique |
|---|---|
| 01-gochara-from-moon.md | Good and bad houses from the Moon (PD 26, Brihat Samhita 104) |
| 02-vedha-and-vama-vedha.md | Obstruction pairs and reverse obstruction |
| 03-latta.md | Planetary kicks on nakshatras |
| 04-tara-bala-and-chandra-bala.md | Daily star and Moon strength |
| 05-transit-over-natal-points.md | Transit over natal planets, Lagna and sensitive points |
| 06-nakshatra-transit-and-sarvatobhadra.md | 9-tara cycle, nakshatra vedha, saptashalaka grid, Sarvatobhadra chakra |
| 07-bhinnashtakavarga.md | BAV tables per planet |
| 08-sarvashtakavarga.md | SAV and the 28 threshold |
| 09-trikona-and-ekadhipatya-shodhana.md | The two reductions |
| 10-shodhya-pinda.md | Rasi, graha and shodhya pinda |
| 11-kakshya.md | 8 divisions of a sign for transit timing |
| 12-prastara-ashtakavarga.md | The prastara grid |
| 13-ashtakavarga-predictions.md | AV predictions for houses, longevity and events |
| 14-saturn-and-jupiter-transit-rules.md | Sade Sati, Kantaka, Ashtama Shani, Jupiter rules |
| 15-murti-nirnaya.md | Gold, silver, copper, iron grading of ingresses |
| 16-rahu-ketu-and-eclipses.md | Node transits and eclipses on natal points |
| 17-double-transit.md | Jupiter and Saturn double transit [MODERN] |
| 18-lagna-vs-moon.md | Reference point for transits |
| 19-retrograde-and-stations.md | Retrograde and stationary planets in transit |

## 1. Sources
- **Phaladeepika** (Mantreswara), ch. 23 (Ashtakavarga), ch. 24 (AV effects after Horasara), ch. 26 (Gocharaphala).
  - Numbering follows the siva.sh online edition, whose gloss derives from V. Subrahmanya Sastri, 2nd ed. 1950: https://www.siva.sh/phaladeepika/26/1-5
  - The 1950 print may number the AV chapters differently. One index lists AV as ch. 24.
- **BPHS** (R. Santhanam, 1984), the numbering used throughout this folder:
  - ch. 66 Ashtakavarga
  - ch. 67 Trikona shodhana
  - ch. 68 Ekadhipatya shodhana
  - ch. 69 Pinda sadhana
  - ch. 70 Effects of AV
  - ch. 71 Longevity by AV
  - ch. 72 AV other uses
  - G.C. Sharma's edition numbers these two chapters higher (ch. 68 onward). Sanskrit with a rough English gloss: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-66
- **Brihat Samhita** (Varahamihira), ch. 104 Graha-gochara (N. Chidambaram Iyer, 1884): https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc229368.html (read from a search snippet only; the page was not opened)
- **Not opened in this pass:** Muhurta Chintamani, Narada Samhita, Jataka Parijata, Saravali, and C.S. Patel's *Ashtakavarga*. Rules attributed to them are marked unverified.

## 2. When it applies
To every timed prediction. In no school do transits stand alone.

## 3. Inputs
- The shared sky, per day.
- The natal chart: Moon sign and star, Lagna, planets, BAV and SAV.
- The running dasha.

## 4. The rule: how transits are subordinated
1. **[COMM][MODERN] The natal promise comes first.** A transit cannot give what the chart denies.
   - The dasha decides which promise is open now.
   - The transit decides when inside that dasha, and how strongly.
   - No primary verse stating this explicitly was located. It is the stated method of K.N. Rao (BVB), Sanjay Rath (SJC) and C.S. Patel.
2. **[TEXT] PD 26:1.** Of all reference points, the Moon sign is chief for gochara.
3. **[TEXT] PD 26:30.** A bad transit aspected by a benefic becomes fruitless, and so does a good transit aspected by a malefic. Transit results can be modified even inside gochara.
4. **[TEXT] PD 23:10 and 26:41.** The ashtakavarga bindus override the plain house rule.
   - A planet in a sign full of its own bindus gives good results even in the 6th, 8th or 12th from the Moon.
   - A natally debilitated planet does not sustain AV good.
5. **[TEXT] PD 24:1-5.** Saturn's or the Sun's transit activates nakshatras and signs derived from the ashtakavarga.
   - The father's death is timed jointly with the dasha of the 4th lord or of its navamsa dispositor.
   - So the text itself pairs a transit trigger with a dasha.
6. **[COMM] Order of filters used by most traditional practitioners:**
   1. The dasha lord's natal state.
   2. The house from the Moon, and from the Lagna.
   3. Vedha.
   4. The BAV bindus of the transiting planet in that sign.
   5. The kakshya.
   6. The tara of the star transited.

## 5. Interpretation rules
- **[MODERN] Weighting.** This is product guidance, not text:
  - Dasha carries 60-70 % of the verdict.
  - Slow transits (Saturn, Jupiter, the nodes) carry 20-30 %.
  - Fast transits, tara bala and chandra bala are for days and muhurta only.
- **[TEXT] Fast and slow planets.** Fast planets time days and weeks; slow planets time years. This is implicit in:
  - the verse-by-verse effects of PD 26;
  - AV timing that uses Saturn for longer spans and the Sun for months (PD 24).

## 6. Variants and disputes
- Moon or Lagna as the reference: see `18-lagna-vs-moon.md`.
- Double transit is a modern rule (K.N. Rao): see `17-double-transit.md`.

## 7. Worked micro-example
- **Setup:** Rahu dasha, with a 10th-lord promise of a job change. Jupiter transits the 11th from the Moon, has 6 bindus in its BAV for that sign, and no planet occupies the 8th from the Moon (so there is no vedha).
- **Reading:** this is a strong window.
- **Contrast:** the same Jupiter transit inside a period that promises nothing for career is only a mild lift.

## 8. Design notes for AI Astra (what the engine must output)

### Shared sky
One per day or per instant, and it holds no person. For each graha:
- sign, longitude, nakshatra and pada;
- kakshya number and lord;
- speed and retrograde flag;
- the planet's latta star.

For the sky as a whole:
- ingress and station events with exact times;
- the Moon's sign at every slow-planet ingress, for murti;
- eclipses with the eclipsed longitude;
- lunations.

### Per-kundli overlay
Produced by the engine, never by Node. For each transiting planet:
- house from the Moon and from the Lagna;
- gochara good or bad per PD 26;
- vedha and vama-vedha state, with the obstructing planet;
- the BAV of the transiting planet in that sign, and the SAV of that sign;
- kakshya has_bindu;
- the tara (1-9) of its star, counted from the janma star.

For the person as a whole:
- chandra bala of the daily Moon;
- latta strikes on the janma star;
- contacts to natal planets, the Lagna and sensitive points;
- Sade Sati, Kantaka and Ashtama phases;
- the murti of each slow-planet ingress;
- the pinda-derived nakshatras and signs for Saturn and Sun transits (PD 24);
- the double-transit house list.

### What already exists in the engine
AIAstra_Radha, as read on 2026-11-18:
- kakshya, BAV and SAV: `daily_export.py`, `run_transit_ashtakavarga`;
- tara and chandra bala: `daily_export.py`;
- Sade Sati and dhaiya, double transit, stations and eclipses: `transits_export.py`, `transit_range_export.py`;
- sodhya pindas: `natal_export.py`;
- a latta helper in `charts.py`, which is not exported.

### Engine additions needed
- Gochara good/bad, vedha and vama vedha.
- Murti.
- Latta export, with the strike on the natal star.
- Sarvatobhadra vedhas.
- Pinda-to-nakshatra transit points.
- A contact list for eclipses.

### Board use
- Today and Lucky boards use tara bala, chandra bala, latta and the Moon's transit.
- Self, Love and Work use slow transits weighed under the running dasha.
- Never show a transit verdict without its dasha context.

## 9. Open questions
- Is there a classical verse that states "dasha first, transit second" explicitly? Candidates are the BPHS dasha-phala chapters, Uttara Kalamrita and Jataka Parijata. None was located.
- The weighting numbers in §5 are product choices and need Sachin's sign-off.
- Engine discrepancies found while researching are listed in the research notes file. They are not yet in `docs/TODOS.md`.
