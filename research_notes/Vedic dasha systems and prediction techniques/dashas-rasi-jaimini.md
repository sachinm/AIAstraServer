# Rasi (sign) dasas from BPHS and the Jaimini Upadesa Sutras: research notes

Deliverable files: `docs/deep-research/dashas-rasi-jaimini/` (00-overview, 01-which-rasi-dasha-for-what, one file per dasa).
Tags: [TEXT] classical text, [COMM] traditional commentator (as reported), [MODERN] modern school, [ENGINE] what the engine
code does today (read-only inspection of `AIAstra_Radha/src/jhora/horoscope/dhasa/raasi/*.py`).

## Sources consulted and how far they can be trusted

### Takeaway
Two primary texts were read directly: a scanned English BPHS volume 2 (chapter 46 dasa verses) and B. Suryanarain Rao's
English Jaimini Sutras (adhyayas 1-2 only). Modern rules come from P.V.R. Narasimha Rao's textbook (full text), Sanjay
Rath's *Narayana Dasa* (via the repo's earlier research note), K.N. Rao's Saptarishis article and the Sutramritam blog.
No traditional commentary (Nilakantha, Krishnananda Saraswati, Somanatha, Raghava Bhatta) was read in the original.

### Cited Findings
- BPHS vol. 2 (archive.org item "BPHSEnglish", file "BPHS - 2 RSanthanam"), djvu OCR text. Chapter 46 holds the dasa list
  (46.6-11), Chakra dasa (~46.50-51), Chara (46.155-167), Sthira (168-169), Brahma graha (170-173), Yogardha (174),
  Kendradi (175-176), Mandooka (179-180), Shoola (181-182), Trikona (183-184), Drig (185-187), Lagnadi Rasi (188-189),
  balance at birth (190); rasi antardasa rules in ch. 51 vv. 5-12; rasi dasa effects ch. 50 (antardasa effects 50.90-96)
  — [archive.org djvu text](https://archive.org/stream/BPHSEnglish/BPHS%20-%202%20RSanthanam_djvu.txt)
- Caveat on that file: the verse numbers were read by a summarising model from poor OCR; the extracted preface may name the
  volume-2 translator as Gouri Shankar Kapoor rather than R. Santhanam (the archive file name says Santhanam). Treat
  edition attribution as unverified and verse numbers as "approximately ±2". Rath cites the antardasa rule as BPHS
  50.30-31 (a different edition's numbering) — same archive file above; Rath via repo note
  `research_notes/Sanjay Rath open method gaps/chara_dasha.md`.
- Jaimini Sutras, tr. B. Suryanarain Rao (rev. B.V. Raman), "Part 1"-"Part 4" = adhyaya 1 pada 1 to adhyaya 2 pada 4,
  numbering adhyaya.pada.sutra as printed. Contains 1.1.26-28 (odd/even counting, "na kvachit", "nathantah samah
  prayena"), 1.1.34 (antardasa), 2.1.15-57 (ayur dasas: navamsa dasa, Sthira dasa use, Rudra, Shoola, Brahma, Maheswara),
  2.2.4-11 (Shoola dasas for parents, spouse, children), 2.3.1-4 (Navamsa and Sthira dasa), 2.3.5-17 and 27 (strength),
  2.3.18-26 (Shoola dasas for relatives; Brahma-started dasa), 2.3.28 (9th-house direction), 2.4.1-37 (Dwara/Bahya,
  Padakrama, Mandooka, Yogardha, Drig, Trikona, Tara-amsa dasa, odd/even of karaka, Saturn, antardasa, results)
  — [PDF](https://lakshminarayanlenasia.com/articles/JAIMINISUTRAS.pdf)
- Adhyayas 3 and 4 of the Jaimini Sutras (where Varnada dasa and Sudasa-type material are usually placed) were NOT
  available. No Sanskrit original was read; transliterations in the PDF are OCR-damaged and were not reproduced except
  short well-known fragments.
- P.V.R. Narasimha Rao, *Vedic Astrology: An Integrated Approach* (Sagar), ch. 15.5.2 (stronger rasi rules), ch. 18
  Narayana, 19 Lagna Kendradi, 20 Sudasa, 21 Drigdasa, 22 Niryaana Shoola, 23 Shoola, 5.7 Sree Lagna
  — [PDF](https://lakshminarayanlenasia.com/wp-content/uploads/2022/10/docs2/LakshmiNarayanLenasia.com/Astrology%20(Jyotish)%20collection/Vedic%20Astrology%20an%20Integrated%20Approach%20by%20P.V.R.%20Narasimha%20Rao.pdf)
- Sanjay Rath, *Narayana Dasa* (Sagar) — rules summarised in the repo note above, from
  [scienceoflight.net PDF](https://scienceoflight.net/wp-content/uploads/extra/Narayana%20Dasa%20by%20Sanjay%20Rath.pdf)
- K.N. Rao, "Jaimini Chara Dasha - My Approach Part 1" — no ±1 for exalted/debilitated lords; periods 1-12 whole years;
  judges with chara karakas, karakamsa, upapada, D7/D9/D12 — [Saptarishis](https://saptarishisastrology.com/?p=2656)
- "Shanmukha", Sutramritam blog: Raghava Bhatta / Nrisimha Suri / Iranganti Rangacharya reconstruction of Chara dasa
  — [post](https://sutramritam.blogspot.com/2009/08/chara-dasa-raghava-bhatta-nrisimha-suri.html)
- P.V.R. Narasimha Rao 2014, "Parasara's Chara Dasa" (via repo note) — [PDF](https://www.vedicastrologer.org/articles/pp_chara_dasa.pdf)
- Padanathamsa dasa: earliest reference said to be Krishna Mishra's *Jyotisha Phala Ratnamala* ch. 27; Laxmana Suri's
  *Jyotisha Pradipika* gives a "Pada Navamsa dasa" from AL in D1 — publisher listing only
  — [Exotic India](https://www.exoticindiaart.com/book/details/padanadhamsa-dasa-hck614/)

### Inferences
- The two texts agree on most mechanics but name things differently. The biggest naming trap is Shoola: BPHS 46.181-182
  "Shoola" (from stronger of 2nd/8th, 7/8/9 years) is PVR's "Niryaana Shoola" and the engine's `nirayana.py`; Jaimini
  2.3.18 "shooladasa" from the stronger of 1st/7th (PVR's and Rath's "Shoola", engine `shoola.py`) is a different dasa.
- BPHS 46.188-189 "Lagnadi Rasi dasa" adds (bhayat/bhabhog)x12 signs to the lagna, which is the same arithmetic as Sree
  Lagna (lagna + fraction of Moon's nakshatra x 360 deg). So the classical "Rasi dasa" seed is the Sree Lagna sign; PVR
  says Sudasa is "also called Rasi Dasa". This is my inference from the two texts, not a statement in either.
- Jaimini 1.1.27 "na kvachit" as glossed by Suryanarain Rao (Taurus and Scorpio count forward although even; Leo and
  Aquarius count backward although odd) produces exactly the "footed" groups of BPHS 46.156. The two texts agree.

### Gaps
- No direct text of Nilakantha, Krishnananda Saraswati, Somanatha (Kalpalata), Raghava Bhatta, Nrisimha Suri.
  Everything tagged [COMM] is "as reported" by Suryanarain Rao or the Sutramritam blog.
- K.N. Rao's book *Predicting through Jaimini's Chara Dasha* not read; his start/direction/antardasa rules rest on a
  tertiary guide and common software settings.
- Jaimini adhyayas 3-4; Jataka Sara Sangraha; Vriddha Karikas: not found online in readable form.
- Varnada, Paryaya (Chara Paryaya), Karaka Kendradi rasi dasa, BPHS Tara dasa: no classical text read. Files for these
  mark section 4 as unverified and describe only what the engine does and what moderns are reported to say.

## Engine mismatches found (for the caller to file in docs/TODOS.md; this agent may not edit it)

### Takeaway
Twelve code-vs-text differences. Two look like plain bugs: the Narayana antardasa 7th-house index, and the Chara
antardasa list being reused for every dasa. The Chara method labels are crossed.

### Cited Findings (all from reading the engine source; line numbers approximate)
- `narayana.py::_narayana_antardhasa`: takes the "7th from dasa rasi" as `(dhasa_rasi+7)%12`, which is the 8th sign
  (0-indexed 7th is `+6`). It also compares the signs of the two lords, whereas Rath/PVR compare the dasa sign with its
  7th and then start from the sign of the stronger one's lord. Likely bug.
- `chara.py::get_dhasa_antardhasa`: always seeds with the PVR-2014 rule (lagna/Sun/Moon);
  `_dhasa_progression_knrao_method` is never called. Method 1 uses the "knrao" duration (±1, two cycles, 12 minus first)
  and method 2 the "pvnrao" duration (no ±1, single cycle). The labels are crossed: K.N. Rao rejects ±1, and his
  article's example repeats the same years in cycle two. No path gives a lagna-seeded K.N. Rao table.
  `_antardhasa(dhasa_progression)` returns the same rotated list for every mahadasa, so antardasas never start from the
  running dasa sign. Likely bug.
- `chara.py` Raghava Bhatta / Rangacharya durations (unused) set `house_of_lord` to 2 for Scorpio and 6 for Aquarius.
  These look like the planet ids of Mars and Saturn placed where a sign index is expected. Bug.
- `navamsa.py`: the seed table (Ar->Ar, Ta->Le, Ge->Li, Cn->Aq, repeating) and the antardasa table do not match JS-BSR
  2.3.1-2 (odd lagna from lagna; even lagna from the 8th/6th/7th by sign type). The tables' source is not cited.
- `trikona.py`: direction is the odd/even of the seed, while BPHS 46.183-184 says "as Chara" (footedness of the 9th).
  Years are Narayana rather than Chara of a stated variant. The antardasa does not match JHora (the header says so).
- `tara_lagna.py`: antardasas start from the Atmakaraka's sign. No such rule is in JS-BSR 2.4.27.
- `yogardha.py`: reuses the Chara antardasa helper and so inherits the reused-list bug.
- `sthira.py`: always zodiacal from Brahma's sign; BPHS 46.169 says forward from odd, backward from even.
- `drig.py`: uses Narayana (count-to-lord) years; BPHS 46.187 says Sthira years (7/8/9). Engine follows PVR.
- `mandooka.py` (the default method 2): seed is the stronger of 1st/7th, and the order comes from a kendra-group table.
  Years are an inclusive count to the lord (no minus one), with own sign = 12 and lord in 7th = 10. BPHS 46.179-180
  says every third sign with Sthira years. Method 1 ("Rath") uses Sthira years with odd seed constants and is unsourced.
- `brahma.py`: direction keyed to parity of the seed sign, while Jaimini 2.3.26 (BSR) keys it to parity of the lagna.
- `varnada.py`, `paryaaya.py`, `padhanadhamsa.py`, `trikona.py` (antardasa), `yogardha.py` (antardasa): self-declared as
  not matching Jagannatha Hora or not fully implemented.

### Inferences
- Before any rasi dasa reaches a board, each module needs a reference test against a known JHora output per variant,
  run in the engine repo.

### Gaps
- I did not run the engine; findings are from reading code only.
