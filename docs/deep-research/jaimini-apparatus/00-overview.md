# Jaimini and Parashari special apparatus (non-dasha): overview

> This folder documents the "special" chart apparatus that Jaimini's Upadesa Sutras and the Parashari texts (BPHS) use for prediction outside the dasha systems: karakas, sign aspects, argala, arudha padas, upapada, karakamsha, special lagnas, Jaimini raja yogas and longevity, life-area yogas, upagrahas and sahams. Rasi dashas (Chara, Narayana, Sthira, Shoola etc.) are covered elsewhere and are only referenced here where a tool feeds them. Each file follows one template: sources, when it applies, inputs, calculation, interpretation (tagged), variants, example, design notes for AI Astra, open questions.

## 1. Sources and citation conventions

Every rule in this folder names the edition whose numbering it uses. Short codes:

| Code | Edition | Where read | Notes |
|---|---|---|---|
| **JUS-R** | B. Suryanarain Rao, *Jaiminisutras* (English translation with notes), 1949 printing | [archive.org: Astrology_Books_by_B_Suryanarayana_Row](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row), file "Jaimini Sutras - B Suryanarain Rao 1949" (OCR) | Covers Adhyaya 1-2 only. Romanised sutra text plus translation and long notes. |
| **JUS-A** | K. V. Abhyankar, *The Upadesa Sutra of Jaimini*, critically edited with Sanskrit commentary and English translation, B. J. Institute, Ahmedabad, 1951 | [archive.org: jaimini-kva-a-4-size](https://archive.org/details/jaimini-kva-a-4-size) (OCR) | Only critical edition seen. English translation section numbered by adhyaya.pada.sutra; the OCR of numbers is patchy, so some citations below are ranges. |
| **BPHS-ELS** | *Brihat Parashara Hora Shastra*, Sanskrit with English gloss, chapter/verse as numbered on [enjoylearningsanskrit.com](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-29) | Read through a page summariser, not line by line | Chapter numbers match the Santhanam (Ranjan, 1984) table of contents for the chapters used (29 padas, 30 upapada, 31 argala, 32 karakas, 33 karakamsha, 39 raja yoga). The site names no critical edition. Several summarised verses were visibly garbled (29.4, 30.2, 32.1-2, 32.20), so BPHS verse numbers here are "that site's numbering, read via summary" and should be re-checked against a print edition before quotation. No IAST is quoted from BPHS for that reason. |
| **PVR** | P. V. R. Narasimha Rao, *Vedic Astrology: An Integrated Approach*, Sagar 2001; author's free PDF | [vedicastrologer.org PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf) | Chapter.section numbers of the PDF. The main modern (SJC-lineage) textbook source here. |
| **UK** | Kalidasa, *Uttara Kalamrita*, tr. P. S. Sastri (Ranjan) | [archive.org text](https://archive.org/stream/uttara-kalamritam./Uttara%20kalamritam._djvu.txt), as summarised in repo note `research_notes/Sanjay Rath open method gaps/indu_lagna.md` | Indu Lagna only. |
| **Rath web** | Sanjay Rath articles on srath.com | URLs per file; summarised in `research_notes/Sanjay Rath method summary/jaimini_methods.md` | His book *Jaimini Maharishi's Upadesa Sutras* (Sagar 1997) was not read. |

Tags: **[TEXT]** classical text; **[COMM]** a traditional or translator commentary on the text (Rao's and Abhyankar's notes are tagged COMM); **[MODERN]** a modern school (SJC / Sanjay Rath, PVR, K. N. Rao / BVB, Iranganti). KP is not used.

## 2. Sutra-numbering concordance (Adhyaya 1, Pada 1)

The two translations number the opening of the Upadesa Sutras differently. Both count the opening line ("we shall now explain the instructions") as sutra 1, but Abhyankar merges Rao's two rasi drishti sutras (2 "signs aspect those in front", 3 "pārśvabhe ca") into one, so he runs one behind Rao from argala until the two re-align at Putra-karaka (Abhyankar has an extra Pitri sutra at 15). Rath's numbering was not checked.

| Topic | JUS-R (Rao 1949) | JUS-A (Abhyankar 1951) |
|---|---|---|
| Opening line | 1.1.1 | 1.1.1 |
| Rasi drishti (signs aspect front and sides; planets in them likewise) | 1.1.2-4 | 1.1.2-3 (numbers not legible in OCR; inferred from argala starting at 4) |
| Argala from 4, 2, 11 | 1.1.5 | 1.1.4 |
| Malefics in 3rd give argala | 1.1.6 | 1.1.5 |
| Obstruction from 10, 12, 3 | 1.1.7 | 1.1.6 |
| Weaker or fewer obstructors fail | 1.1.8 | 1.1.7 |
| Trines (5/9) likewise | 1.1.9 | 1.1.8 |
| Reverse for Ketu | 1.1.10 | 1.1.9 |
| Atmakaraka (7 or 8 planets) | 1.1.11 | 1.1.10 |
| AK rules bondage/liberation | 1.1.12 | 1.1.11 |
| AmK, BK, MK | 1.1.13-15 | 1.1.12-14 |
| Pitri karaka | **absent** | 1.1.15 |
| Putra, Jnati, Dara | 1.1.16-18 | 1.1.16-18 |
| "Some take MK = PK" | 1.1.19 | 1.1.19 |
| Sthira/naisargika relatives (Mars ... Venus) | 1.1.20-23 | 1.1.20-23 (approx.) |
| Saturn weakest | 1.1.24 | 1.1.24 (approx.) |
| Odd/even sign counting | 1.1.25-27 | 1.1.25-27 (approx.) |
| Arudha (pada) of lagna | 1.1.29 | 1.1.29 |
| Arudha special cases | 1.1.30-31 | 1.1.30-31 |
| Katapayadi key for signs | 1.1.32-33 | 1.1.32-33 (approx.) |

The 7-versus-8 karaka question is partly a **textual variant**: Rao's text has no Pitri-karaka sutra (so seven karakas), Abhyankar's has one (eight). See `chara-karakas.md`.

## 3. Files in this folder

| File | Tool | Main life areas | Engine status (from code greps, 2026-11-18) |
|---|---|---|---|
| `chara-karakas.md` | Chara karakas | self, all relatives, raja yoga, spirituality | 8-karaka list in library and `export.py`; no 7-karaka option, no tie handling |
| `sthira-karakas.md` | Sthira karakas | death/longevity of relatives | not found in `natal_export.py`; library use not checked |
| `naisargika-karakas.md` | Natural karakas | general results per matter | static table; not an engine output |
| `rasi-drishti.md` | Sign aspects | all Jaimini work | exported per chart in `natal_export.drishti_tables` (`rasi_drishti`) |
| `argala-virodhargala.md` | Argala | intervention on any house/karaka | exported (`natal_export._build_argala`) without Ketu reversal or 3rd-house malefic argala |
| `arudha-padas.md` | Bhava and graha padas | status, wealth, perception, career | exported (A1-A12, graha padas, Surya/Chandra padas) |
| `upapada-lagna.md` | Upapada (A12) | marriage, spouse, children | exported as A12; no UL-relative tables |
| `karakamsha-swamsha.md` | Karakamsha / Swamsha | vocation, spirituality, ishta devata, spouse | not exported as a frame (gap R6) |
| `special-lagnas.md` | Hora, Ghati, Bhava, Varnada, Sri, Indu lagnas, Pranapada | wealth, power, longevity | HL and SL exported; GL, BL, VL, Indu, Pranapada only in library |
| `jaimini-raja-yogas.md` | Jaimini raja yogas | status, power, career | one AK-PK yoga exported; library `raja_yoga.check_other_raja_yoga_1..3` use AK/PK; others not |
| `jaimini-longevity.md` | Three-pair method, Brahma/Rudra/Maheshvara | longevity | library functions exist (two Rudra functions disagree; Brahma has a likely bug); not exported |
| `jaimini-yogas-career-spouse-children.md` | Karakamsha, UL, AL yogas by area | career, spouse, children | depends on the frames above |
| `upagrahas.md` | Gulika/Mandi, Dhuma group, Kala group | affliction, health, death | GK and MD exported; Dhuma group and Kala group only in library |
| `sahams-natal.md` | Sahams | event points (marriage, career, travel) | library `transit/saham.py`; not in natal export |

## 4. Cross-cutting findings

1. **Jaimini is terse and its translators disagree on basic rules**, not just on interpretation: the arudha exception (three readings), whether Pitri-karaka exists, whether argala reversal is Ketu only or both nodes, whether karakamsha is read in the rasi chart or the navamsa. The engine should expose the variant it used, never hide it.
2. **BPHS repeats most Jaimini tools** (karakas ch. 32, padas ch. 29, upapada ch. 30, argala ch. 31, karakamsha ch. 33, special lagnas ch. 5, raja yoga with AK/PK and HL/GL ch. 39) and often states the rule more fully. Where the two agree, confidence is high.
3. **Modern SJC practice (PVR, Rath) is the de facto spec** for software. The library the engine wraps follows PVR's choices (8 karakas, 10th-from-pada exception, stronger lord for Scorpio/Aquarius), as read in its code. That Jagannatha Hora does the same is likely (PVR wrote it) but was not checked.
4. **Life-area routing** used across the files:
   - Self / You board: AK, karakamsha, lagna vs AL (reality vs perception), graha padas.
   - Love: DK, UL and 2nd/7th/8th from UL, A7 vs AL, 7th from karakamsha, Venus as natural karaka.
   - Work: AmK, 10th from karakamsha, A10 (in D10 per PVR), GL, raja yogas, 11th/12th from AL for income/expense.
   - Money / Lucky: HL, Sri Lagna, Indu Lagna, 2nd/11th from AL, A2, A11.
   - Longevity and health (not a consumer board): three-pair method, Rudra/Maheshvara/Brahma, upagrahas. Treat as internal only.
5. **Gaps are engine additions, not Node work.** Each file's section 8 lists exactly what the engine must output. Node computes nothing astrological.

## 5. Open questions for the whole set

- Rath's book and Iranganti Rangacharya's and P. S. Sastri's translations were not read. Their sutra numbering and readings are recorded as gaps per file.
- BPHS verse numbers need a print-edition check (Santhanam or Sharma) before they are quoted in product copy.
