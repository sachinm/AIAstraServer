# Natal (promise-layer) techniques of classical Parashari astrology

Deliverables: 25 files in `docs/deep-research/natal-techniques/` (00-overview through 24-longevity-classification).

Source shorthand used everywhere:
- **BPHS-ET**: archive.org e-text "Parashara Hora Sastra" (translator not named on the page; Hindi-style spellings "Guru", "Sukr"; 97 chapters; chapter numbers match the Santhanam numbering: 26 drishti, 27 strengths, 28 Ishta/Kashta, 35 Nabhasa, 36 other yogas, 37 lunar, 38 solar, 39 raja, 40 royal association, 41 wealth, 42 penury, 43 longevity, 44 marakas, 45 avasthas, 75 Mahapurushas) — [archive.org](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- **BPHS-GCS**: wisdomlib Girish Chand Sharma edition; numbering differs (Ishta/Kashta = ch 30, ch 27 = effects of bhava lords, ch 28 = evaluation of aspects) — [wisdomlib](https://de.wisdomlib.org/shop/books/jyotisha/brihat-parashara-hora-shastra)
- **BJ-Neely**: Brihat Jataka Sanskrit, M. D. Neely 2007, wisdomlib (Sanskrit pages only) — [wisdomlib](https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english)
- **BS-Iyer**: Brihat Samhita, N. Chidambaram Iyer 1884 — [wisdomlib ch 17](https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc228918.html)
- **SS-Burgess**: Surya Siddhanta ch 9 — [swaveda](https://www.swaveda.com/texts/surya-siddhanta/9/)
- **PD-Sastri**: Phaladeepika, V. Subrahmanya Sastri 2nd ed. 1950 — [wisdomlib PDF](https://www.wisdomlib.org/uploads/ocr/essays/phaladeepika/phaladeepika-2nd-ed-1950-by-v-subrahmanya-sastri-text.pdf) (the PDF returned HTTP 403. The wisdomlib HTML chapter pages, e.g. https://www.wisdomlib.org/hinduism/book/phaladeepika-by-mantreswara-text-and-translation, and a sanskritdocuments.org copy exist, but the fetch was cut off by a session usage limit. Every Phaladeepika verse cited in the files is recalled, not checked)

Verification legend used in the files: **(V)** = rule seen in the source this session; **(V-Sa)** = Brihat Jataka points taken from a fetch model's reading of Sanskrit-only pages (provisional); **(R)** = recalled from the text, verse number not checked this session; **(U)** = no verse located.

## Q1. Exact rules and numerical thresholds per text

### Takeaway
BPHS gives hard numbers for Shadbala minimums (total and per component), Ishta/Kashta, Vimshopaka weights and grade names, Baladi fractions and longevity spans; these were confirmed in BPHS-ET. Most yoga definitions are qualitative; the engine already computes most of them.

### Cited Findings
- Shadbala minimums, BPHS-ET 27.32-33: 390, 360, 300, 420, 390, 330, 300 virupas "for Surya etc." (planet order inferred as Su, Mo, Ma, Me, Ju, Ve, Sa → 6.5, 6, 5, 7, 6.5, 5.5, 5 rupas); exceeding them makes the planet "very strong" — [BPHS-ET](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Component minimums, BPHS-ET 27.34-36, listed in order Sthana, Dig, Kala, Cheshta, Ayana: Ju/Me/Su 165, 35, 50, 112, 30; Mo/Ve 133, 50, 30, 100, 40; Ma/Sa 96, 30, 40, 67, 20 — [BPHS-ET](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt). Popular modern tables (Raman) put Kala 112 and Cheshta 50 for the Ju/Me/Su group, i.e. the 50/112 pair is swapped against this e-text. Ordering dispute, unresolved.
- Yuddha bala, BPHS-ET 27.20: the difference between the two Shadbalas is added to the victor; the winner rule itself is not given there — [BPHS-ET](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Naisargika order, BPHS-ET 27.14: Sa < Ma < Me < Ju < Ve < Mo < Su (Sun full) — same
- Bhava bala, BPHS-ET 27.26-31: a dig component divided by 3; plus or minus a quarter of drishti for benefic or malefic aspect; plus the lord's strength; +1 rupa for Jupiter or Mercury occupying, -1 rupa for Saturn, Mars or Sun occupying; 15 virupas by birth time (day/night) — same
- Ishta/Kashta, BPHS-ET 28.6: "reduce 1 from each of Chesht Rasmi and Uchch Rasmi", multiply by 10, add, halve = Ishta; 60 - Ishta = Kashta. This is a rasmi-based form; the widely used form (Raman, engine `_ishta_phala`) is sqrt(Uchcha bala × Cheshta bala). Both appear in commentary — [BPHS-ET](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Vimshopaka weights, BPHS-ET 7.17-25: shadvarga 6, 2, 4, 5, 2, 1 (D1, D2, D3, D9, D12, D30); saptavarga 5, 2, 3, 2.5, 4.5, 2, 1 (OCR garbled, the fractions are read so the sum is 20); dasavarga D1 3, D60 5, the other eight 1.5 each (OCR shows "½"; 1.5 is needed for a sum of 20); shodasavarga D1 3.5, D2 1, D3 1, D16 2, D9 3, D30 1, D60 4, the other nine 0.5 each — same
- Vimshopaka threshold, BPHS-ET 7.26-27: total below 5 means the planet cannot give auspicious results — same
- Varga-count grade names, BPHS-ET 6.42-53: shadvarga Kimshuka (2) .. Kundala (6), saptavarga adds Mukuta (7); dasavarga Parijata (2), Uttama (3), Gopura (4), Simhasana (5), Paravata (6), Devaloka (7), Brahmaloka (8), Sakravahana/Airavata (9), Shridhama (10); shodasavarga Bhedaka (2), Kusuma (3), Nagapushpa (4) .. Sri Vallabha (16) — same
- Baladi, BPHS-ET 45.3-4: 6° steps, order reversed in even signs; results 1/4, 1/2, full, negligible, nil — same
- Jagradadi, BPHS-ET 45.5-6: own/exalted = awake, full; friend/neutral = dreaming, medium; enemy/debilitated = asleep, nil — same
- Deeptadi, BPHS-ET 45.7-10: Dipta, Swastha, Pramudita, Shanta, Dina, Vikala, Duhkhita, Khala, Kopa (Kopa = eclipsed by the Sun) — same
- Lajjitadi, BPHS-ET 45.11-18; Shayanadi formula BPHS-ET 45.30-37 (star no. × planet no. × navamsa no. + birth star + ghatis + lagna no., mod 12; sub-state Drishti/Cheshta/Vicheshta from the name's first syllable) — same
- Longevity, BPHS-ET 43: Pindayu exaltation years Su 19, Mo 25, Ma 15, Me 12, Ju 15, Ve 21, Sa 20; Nisargayu Mo 1, Ma 2, Me 9, Ve 20, Ju 18, Su 20, Sa 50; Amsayu by navamsa; choose Amsayu if Lagna is strongest, Pindayu if the Sun is, Nisargayu if the Moon is (43.30-32); spans alpa < 32, madhya 32-64, purna 64-100; a combust planet's share is halved except Venus and Saturn; an enemy sign loses one-third; retrograde planets are exempt — same
- Gajakesari, BPHS-ET 36: Jupiter in a kendra from Lagna or Moon, joined or aspected by benefics, not debilitated, combust or in an enemy sign. Amala, Parvata, Kahala and Lakshmi definitions are in the same chapter — same
- Lunar yogas, BPHS-ET 37: Sunapha/Anapha/Durudhara exclude the Sun; Kemadruma = no planet (Sun excluded) with the Moon, in the 2nd or 12th from it, or in a kendra from Lagna; Adhi = benefics in the 6th, 7th and 8th from the Moon — same
- Solar yogas, BPHS-ET 38: Vesi/Vosi/Ubhayachari exclude the Moon — same
- Nabhasa precedence, BPHS-ET 35.16-17: the seven Sankhya yogas do not operate if another Nabhasa yoga forms — same
- (V-Sa) Brihat Jataka 13.3 (Sanskrit) excludes the Sun ("hitvārkaṃ") and cancels Kemadruma when the Moon is in a kendra or with a planet — [BJ-Neely](https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english/d/doc1501548.html)
- (V-Sa) Brihat Jataka 11 has no lord-based (Parashari) raja yoga: its raja yogas are built from exalted planets and placement patterns — [BJ-Neely ch 11](https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english/d/doc1501546.html)
- Graha yuddha, Brihat Samhita 17.3-11: four kinds (Bheda, Ullekha, Amshumardana, Apasavya). The loser is southern, dim, small or turns retrograde; a large and bright planet wins even when southern; equal brightness is a "samagama" (meeting). A footnote cites Surya and Paulisa Siddhanta for Venus usually winning — [BS-Iyer](https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc228918.html)
- Combustion orbs come from the Surya Siddhanta as kalamsa (time-degrees of heliacal visibility): Ju 11, Sa 15, Ma 17, Ve 10 or 8 (direction/phase dependent), Me 14 or 12 (direct or retrograde); the Moon's 12 is in ch 10 — [SS-Burgess ch 9](https://www.swaveda.com/texts/surya-siddhanta/9/)

### Inferences
- Modern software applies the kalamsa figures as ecliptic-longitude orbs; this is a convention, not a hora-text rule.
- Engine `strength.py:806` sets `sb_req = [5,6,5,7,6.5,5.5,5]`, so the Sun requires 5 rupas. BPHS-ET's first value is 390 virupas (6.5). Raman's table (recalled) uses Sun 5, so the engine follows a modern table rather than this BPHS text. Filed as an engine decision for the Shadbala file, section 8.
- Engine `avasthas_export.py` Baladi multipliers: Vriddha 0.35, Mrita 0.10. The text says "negligible" and "nil". `run_avasthas` computes janma ghatis from sunrise (1.0 only on failure), but the Shayanadi name-syllable sub-state is not computed. Its Deeptadi list (Deepta, Swastha, Mudita, Shanta, Shakta, Peedita, Deena, Vikala, Khala) is a different nine from the BPHS-ET list; it resembles the Phaladeepika-style list (recalled).

### Gaps
- No Phaladeepika, Saravali, Jataka Parijata or Hora Sara text could be checked (Phaladeepika PDF 403; the others were not reached within budget). All their verse numbers in the files are (R).
- BPHS-ET partial-aspect fractions were garbled; the 1/4, 1/2, 3/4 values are (R).
- Whether bhavat bhavam and karako bhava nashaya have a BPHS verse is unlocated; tagged [COMM]/[MODERN].
- Viparita raja yoga was not found in BPHS-ET ch 35-42; Harsha/Sarala/Vimala attributed to Phaladeepika (secondary: aaps.space) — [aaps.space](https://aaps.space/docs/raja-yogas/harsa-yog/)
- The neecha bhanga condition list was not checked in any text.

## Q2. Where BPHS, Phaladeepika, Saravali, Brihat Jataka and Jataka Parijata disagree

### Takeaway
The two candidate disagreements rest on a provisional reading of the BJ Sanskrit (V-Sa): Kemadruma (BPHS puts "no planet in a kendra from Lagna" inside the definition; BJ appears to use a kendra condition as a cancellation; if BJ means a planet in a kendra, the texts agree in substance) and raja-yoga logic (BJ: exaltation/placement; BPHS: kendra-trikona lordship). Other disputes (Mahapurusha from the Moon, Deeptadi lists, Sun shadbala minimum, Shadbala component ordering, Ishta formula) are flagged in the files.

### Cited Findings
- BJ 13.3 vs BPHS-ET 37 Kemadruma — see Q1 sources
- BJ 11 vs BPHS-ET 39 raja yoga basis — see Q1 sources
- BS 17 brightness can beat northernness; Uttara Kalamrita (as quoted by a blog) says north wins — [jagannathhora.com](https://jagannathhora.com/?p=20002)

### Inferences
- The engine should carry a `school` or `text` tag on every yoga and avastha variant rather than pick one silently.

### Gaps
- Saravali and Jataka Parijata comparisons are from memory only.

## Q3. What the engine must output

### Takeaway
The engine (AIAstra_Radha) already has shadbala, bhava bala, ishta/kashta, vimshopaka (4 schemes), vaiseshikamsa counts, all 16+ vargas with method variants, combustion, retrograde, 98 yoga functions plus raja/neecha bhanga/viparita, doshas, and five avastha families. The `facts` export (`facts_export.py` `_rule_yogas`, source `radha.rule`) already adds Parivartana with the Maha/Khala/Dainya class, Budha-Aditya, Dhana pairs (2/11 lords with 1/5/9 lords), Viparita per lord (different dusthana only) and Neecha Bhanga (dispositor in a kendra from Lagna or Moon only). It uses the root Ishta/Kashta formula with the Sun and Moon null, and treats Rahu and Ketu as exalted in Taurus. The gaps are: graha-yuddha participants and winner; per-component Shadbala minimum flags; fuller dhana and neecha bhanga rule sets; a Budha-Aditya combustion check; the Shayanadi name-syllable sub-state; a flag when the Shayanadi ghatis fall back to 1.0; balarishta (recommend not building); and a text tag per rule.

### Cited Findings
- Engine inventory via grep of `src/jhora/horoscope/chart/strength.py`, `charts.py`, `house.py`, `yoga.py`, `raja_yoga.py`, `dosha.py`, `src/jhora/avasthas_export.py` (local repo). Parivartana, Budha-Aditya, Dhana pairs, Viparita and Neecha Bhanga rules were confirmed by reading `facts_export.py` lines 519-552. Balarishta has no implementation (the grep hit was a panchanga yoga name). Yuddha appears only as `_yuddha_bala` (name-based check).

### Inferences
- Every technique file's section 8 lists the fields; the overview gives the order a reader should use them in.

### Gaps
- Not run on a test kundli this session; output shapes are inferred from function names and the avasthas export header.
