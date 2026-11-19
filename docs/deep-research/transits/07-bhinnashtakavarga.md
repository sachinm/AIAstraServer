# Bhinnashtakavarga (bhinnāṣṭakavarga)

> Each of the seven planets has its own 12-sign table of benefic points (bindus). Each point is contributed by one of
> eight references: the seven planets and the Lagna. The count runs 0-8 per sign. It scores how well that planet's
> transit through each sign will go for this person. It is the core of all ashtakavarga work, and the most
> text-consistent transit technique.

## 1. Sources
- **Phaladeepika 23:3-9** (siva.sh numbering). The tables below were read from these verses.
  - https://www.siva.sh/phaladeepika/23/1-5
  - https://www.siva.sh/phaladeepika/23/6-10
- **BPHS ch. 66** (Santhanam), 72 verses: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-66
  - It has the same scheme. Verse 69 calls the auspicious mark sthāna/rekhā and the inauspicious mark karaṇa/bindu.
  - This is the reverse of the Phaladeepika and South Indian convention, where bindu = benefic.
  - The site's English was not clean enough to re-derive the tables verse by verse.
- **Brihat Jataka ch. 9** (Varahamihira, Ashtakavarga): the same tables. Not opened in this pass.

## 2. When it applies
- Every natal chart.
- Transits of the seven planets. The nodes have no BAV.

## 3. Inputs required
The natal signs of the Sun, Moon, Mars, Mercury, Jupiter, Venus and Saturn, and of the Lagna.

## 4. Calculation / rule
For planet P's BAV:
1. From each reference R, count the listed houses.
2. Put one point in each sign reached.
3. Sum the points per sign.

[TEXT] PD 23:3-9. Each cell lists the houses counted from that reference.

| P's BAV | from Sun | from Moon | from Mars | from Mercury | from Jupiter | from Venus | from Saturn | from Lagna | Total |
|---|---|---|---|---|---|---|---|---|---|
| **Sun** | 1,2,4,7,8,9,10,11 | 3,6,10,11 | 1,2,4,7,8,9,10,11 | 3,5,6,9,10,11,12 | 5,6,9,11 | 6,7,12 | 1,2,4,7,8,9,10,11 | 3,4,6,10,11,12 | 48 |
| **Moon** | 3,6,7,8,10,11 | 1,3,6,7,10,11 | 2,3,5,6,9,10,11 | 1,3,4,5,7,8,10,11 | 1,2,4,7,8,10,11 (see §6) | 3,4,5,7,9,10,11 | 3,5,6,11 † | 3,6,10,11 † | 49 |
| **Mars** | 3,5,6,10,11 | 3,6,11 | 1,2,4,7,8,10,11 | 3,5,6,11 | 6,10,11,12 | 6,8,11,12 | 1,4,7,8,9,10,11 | 1,3,6,10,11 | 39 |
| **Mercury** | 5,6,9,11,12 | 2,4,6,8,10,11 | 1,2,4,7,8,9,10,11 | 1,3,5,6,9,10,11,12 | 6,8,11,12 | 1,2,3,4,5,8,9,11 | 1,2,4,7,8,9,10,11 | 1,2,4,6,8,10,11 | 54 |
| **Jupiter** | 1,2,3,4,7,8,9,10,11 | 2,5,7,9,11 | 1,2,4,7,8,10,11 | 1,2,4,5,6,9,10,11 | 1,2,3,4,7,8,10,11 | 2,5,6,9,10,11 | 3,5,6,12 | 1,2,4,5,6,7,9,10,11 | 56 |
| **Venus** | 8,11,12 | 1,2,3,4,5,8,9,11,12 | 3,5,6,9,11,12 | 3,5,6,9,11 | 5,8,9,10,11 | 1,2,3,4,5,8,9,10,11 | 3,4,5,8,9,10,11 | 1,2,3,4,5,8,9,11 | 52 |
| **Saturn** | 1,2,4,7,8,10,11 | 3,6,11 | 3,5,6,10,11,12 | 6,8,9,10,11,12 | 5,6,11,12 | 6,11,12 | 3,5,6,11 | 1,3,4,6,10,11 | 39 |

- **Checksum:** the totals 48 + 49 + 39 + 54 + 56 + 52 + 39 = 337 (the SAV).
- The totals are summed from the lists. They match the totals commonly cited for BPHS.
- **† Not read in PD:** the siva.sh page cut off PD 23:4 before the Moon's BAV from Saturn and from the Lagna. Those two
  cells come from the common BPHS-derived table, and the engine has the same values. Verify them against PD 23:4.
- **OCR uncertainty:** in Jupiter's BAV from the Moon, siva.sh shows "Oth" where 9 is expected. The 9 is read from the
  common table, not from PD.
- **How the verses were read:** every verse reading came through a summariser of the siva.sh pages, not from a direct
  reading of the Sanskrit.

## 5. Interpretation rules
- **[TEXT] PD 23:10.** Houses not listed are malefic.
  - A planet gives good results when its sign holds many benefic bindus.
  - It sustains them when natally dignified: own sign, exaltation, a friend's sign, or an upachaya house.
  - It fails to sustain them when debilitated, in an enemy's sign, or in an apachaya house.
- **[TEXT] PD 26:41.** A planet transiting a sign with many bindus in its own BAV gives good results, even in the 6th, 8th or 12th from the Moon.
- **[COMM] Common grading of a planet's BAV in the transited sign:**
  - 0-3: weak or harmful;
  - 4: average;
  - 5-8: increasingly good.
  
  See `13-ashtakavarga-predictions.md` for the BPHS 0-8 result scale.

## 6. Variants and disputes
- **Moon's BAV from Jupiter:**
  - PD 23:4 (siva.sh, asterisked) gives 1, 2, 4, 7, 8, 10, 11.
  - The commonly used BPHS table gives 1, 4, 7, 8, 10, 11, 12.
  - Both have 7 points, but they differ in the 2nd and 12th houses. The engine uses PD's list.
- **The engine's table differs from PD 23 in three cells.** Source: `const.py:229`, `ashtaka_varga_dict`, read 2026-11-18.

  | Cell | PD 23 | Engine |
  |---|---|---|
  | Moon's BAV from the Moon | 1,3,6,7,10,11 | 1,3,6,7,**9**,10,11 |
  | Moon's BAV from Mars | 2,3,5,6,**9**,10,11 | 2,3,5,6,10,11 |
  | Venus's BAV from Mars | 3,**5**,6,9,11,12 | 3,**4**,6,9,11,12 |

  - The Moon's total stays 49 and Venus's stays 52, so a checksum will not catch either difference.
  - The engine's Moon-from-Jupiter row is 1,2,4,7,8,10,11, which matches PD.
  - Either a variant reading or a transcription slip; the source of the engine's version is unknown. This needs a TODO and a third-text check, against BPHS 66 (Santhanam) and Brihat Jataka 9.
- **Bindu or rekha as the benefic mark:** the convention differs between BPHS and PD (see §1). This changes only the display, not the counting.
- **Lagna's own BAV:** some modern schools (SJC, and PVR Narasimha Rao) compute an eighth BAV for the Lagna. It is not used for transits in PD.

## 7. Worked micro-example
1. Jupiter's BAV is 6 in Aquarius.
2. Jupiter transits Aquarius, the 8th from a Cancer Moon. That is a bad house by gochara.
3. PD 26:41 still lets the transit give good results, unless Jupiter is weak natally.

## 8. Design notes for AI Astra
- **Engine:** `run_transit_ashtakavarga` already returns `bav_by_sign` and the per-day `bav`.
- **Engine check:** dump pyjhora's per-reference tables and compare them with the table above. Pay special attention to the Moon-from-Jupiter row and the 337 total.
- **Board:** every slow-planet tile. Weight: high, inside a transit verdict.
- **Pitfall:** the nodes have no BAV. Use the SAV only for them, as the engine already notes.

## 9. Open questions
- The engine uses PD's Moon-from-Jupiter row. The three cells where it differs from PD 23 (see §6) need a TODO and a decision on which text the product follows.
- Read Brihat Jataka ch. 9 to confirm the tables against a third source.
