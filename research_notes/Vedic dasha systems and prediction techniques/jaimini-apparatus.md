# Jaimini and Parashari special apparatus (non-dasha)

Research date 2026-11-18. Deliverables: 15 files in `docs/deep-research/jaimini-apparatus/` (00-overview plus 14 technique files). These notes record sources, method and uncertainties.

## Which primary texts were read, and how?

### Takeaway
Two full public-domain-era translations of the Jaimini Upadesa Sutras (Rao 1949 and Abhyankar's 1951 critical edition) were downloaded as OCR text and grepped. BPHS was read chapter by chapter through a page summariser on enjoylearningsanskrit.com. PVR's textbook was read in full text from the author's own site.

### Cited Findings
- B. Suryanarain Rao, *Jaiminisutras*, 1949 printing, Adhyaya 1-2 with romanised sutras and notes — [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row)
- K. V. Abhyankar, *The Upadesa Sutra of Jaimini*, critical edition with Sanskrit commentary and English translation, Ahmedabad 1951 — [archive.org](https://archive.org/details/jaimini-kva-a-4-size)
- BPHS chapters 3, 5, 8, 29, 30, 31, 32, 33, 39 as numbered on enjoylearningsanskrit.com — [example ch. 29](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-29)
- P. V. R. Narasimha Rao, *Vedic Astrology: An Integrated Approach* — [vedicastrologer.org PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf)
- Uttara Kalamrita ch. IV (Indu lagna), via the repo's earlier note — [archive.org](https://archive.org/stream/uttara-kalamritam./Uttara%20kalamritam._djvu.txt)
- The archive.org "Jaimini Sutras, 1911" item is the Mimamsa Sutras, not the astrological text — [archive.org item](https://archive.org/details/1_20230902_20230902_1035)

### Inferences
- The Rao and Abhyankar translations are the best freely available primary sources. Rath's book (Sagar 1997) and the Iranganti and P. S. Sastri translations were not available.

### Gaps
- BPHS verse numbers come from a summariser, and several verses were visibly garbled (29.4, 30.2, 32.1-2, 32.20). They need a check against a print edition (Santhanam or Sharma) before quotation.
- The OCR of Abhyankar's sutra numbers is patchy. Numbers for 1.3 and 2.1 are marked approximate in the files.
- Rao's Pada 3-4 and Adhyaya 2 sutra texts were not extracted. Only his table of contents was used for those padas.

## Where do the texts disagree on rules (not just interpretation)?

### Takeaway
There are four basic-rule disputes: the number of karakas, the arudha exception, argala node reversal, and the reading of 1.1.3. The engine should tag which variant it uses.

### Cited Findings
- Sutra numbering in 1.1 differs. Argala is Rao 1.1.5-10 and Abhyankar 1.1.4-9. The Atmakaraka is Rao 1.1.11 and Abhyankar 1.1.10. — [Rao](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row); [Abhyankar](https://archive.org/details/jaimini-kva-a-4-size)
- Abhyankar's text has a Pitri-karaka sutra (1.1.15), giving eight karakas. Rao's text has none, giving seven. Both carry the "some merge mother and son karaka" sutra (1.1.19). — same sources
- Arudha: Rao reads 1.1.30-31 literally (lord in 4th gives the 7th; lord in 7th gives the lagna). Abhyankar reads lord in 4th as giving the 4th and lord in 7th as giving the 10th, which matches BPHS 29.4-5. PVR generalises this to "10th from the pada when it falls in the 1st or 7th". — Rao, Abhyankar, [BPHS ch. 29](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-29), [PVR §9.2](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf)
- Argala reversal: the sutra names Ketu only. Rao says Rahu is not in the original but some commentators include him. BPHS 31.6 names both shadow planets. PVR reverses only argala on a sign containing Ketu. — sources as above
- 1.1.3 "pārśvabhe ca": Rao translates "excepting the adjacent signs", Abhyankar "also the signs at the two sides". The final aspect table is the same. — Rao, Abhyankar
- Children sutra 1.4.25: Abhyankar's translation says the 9th from AK, lagna, pada or UL. The BPHS summary is unclear. — [Abhyankar](https://archive.org/details/jaimini-kva-a-4-size)

### Inferences
- PVR's choices (8 karakas, 10th-from exception, stronger lord for Scorpio and Aquarius) are what Jagannatha Hora and the engine library follow. They are the practical spec, and the variants should be exposed rather than hidden.

### Gaps
- Rath's own readings of these sutras are unknown (book not read). The note that Rath uses 7 karakas for mundane charts is an unlinked search snippet only.

## Which life areas does each tool serve?

### Takeaway
Self: AK, karakamsha, AL vs lagna. Love: UL, DK, A7, 7th from karakamsha. Work: AmK, planets in and 10th from karakamsha, AL 10/11/12, GL, raja yogas. Money: HL, Sri and Indu lagnas, 11th from AL. Longevity and upagrahas: internal only.

### Cited Findings
- HL shows money and GL power; time businessmen from HL and politicians from GL — [PVR §5.6](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf)
- 11th and 12th from AL show gains and expenses by planet — [Abhyankar 1.3.1-12](https://archive.org/details/jaimini-kva-a-4-size); [BPHS ch. 29](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-29)
- UL and its 2nd show marriage and the spouse — [Abhyankar 1.4](https://archive.org/details/jaimini-kva-a-4-size); [BPHS ch. 30](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-30)
- Planets in karakamsha and the 10th from it show vocation; the 12th shows liberation and deity — [BPHS ch. 33](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-33)

### Inferences
- Several sutra outcomes are harsh (loss of spouse, no issue, illegitimacy, poison). They belong in internal pressure flags, not in user copy.

### Gaps
- No source read gives weights between these tools and Parashari house analysis. The weights in the files are design judgement.

## What must the engine add? (No Node computation)

### Takeaway
The engine exports arudhas, argala (partly), SL, HL, Gulika and Maandi, and the AK-PK yoga. Everything else listed below is in the library but not exported, or is missing.

### Cited Findings (engine code read 2026-11-18)
- `house.py::chara_karakas`: 8 karakas, Rahu as 30 − degree, stable sort (ties silent), no 7-karaka option. Exported only in `export.py`. Which export path is live was not established.
- `arudhas.py`: PVR exception and stronger lord. Exported per varga by `natal_export._build_arudhas`.
- `natal_export._build_argala`: houses only, 2/4/5/11 against 12/10/9/3. No Ketu reversal, no 3rd-house malefic argala, no net verdict, no argala on points.
- `_map_special_points`: SL, HL, GK, MD only. GL, BL, Varnada (five methods), Indu lagna, Pranapada, the Dhuma group, the Kala group, sahams and Brahma/Rudra/Maheshvara/longevity exist in the library and are not in `natal_export.py`.
- `natal_export.py` emits an `atmakaraka_putrakaraka_raja_yoga` item; library `raja_yoga.check_other_raja_yoga_1..3` use AK/PK.
- `natal_export.drishti_tables` already exports `rasi_drishti` per chart (not on special points).
- Unreviewed code findings (for the engine-rule-verifier): `house.rudra_based_on_planet_positions` compares a table 8th lord with the 7th-house lord itself, while `house.rudra` uses the 8th from the 7th (text-consistent); `house.brahma` counts 6/8/12 from the stronger of lagna/7th rather than from lagna, drops nodes instead of taking the 6th from them, and its three-candidate branch references `brahma` before assignment.
- Source inconsistency: PVR's Bhava Lagna example adds 1°/minute, against his stated rate and BPHS 5.2-3 (0.25°/minute).

### Inferences
- Engine additions requested in the files' section 8: a karaka scheme flag with tie reporting; a karakamsha frame (D1 and D9); houses from AL and from UL with occupants and aspects; argala variants (node reversal, 3rd-house malefic) and argala on special points; GL/BL/VL/Indu/Pranapada exports; a Jaimini raja-yoga list; an internal longevity block; all 11 upagrahas; a curated set of natal sahams.

### Gaps
- None of these was filed in `docs/TODOS.md` (out of scope by instruction). The coordinator should file them.

## Other uncertainties
- Sri lagna has no classical verse in the sources read. It is a PVR/SJC construct.
- The Mandi ghati table and the Jataka Parijata rules were not extracted.
- Natal sahams are sourced only from PVR (tagged [MODERN]). Tajika Neelakanthi was not read.
- The AK-AmK raja yoga, popular online, was not found in JUS-A 1.3 or in the BPHS ch. 39 summary.
- Mean vs true node can change the AK. No classical rule was found.
