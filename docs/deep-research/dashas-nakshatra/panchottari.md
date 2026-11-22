# Panchottari dasha (pañcottarī daśā)

> A 105-year nakshatra dasha of seven planets (no nodes) counted from Anuradha, for Cancer-lagna births with an `arkāṃśa` condition whose meaning is disputed. It is the clearest case where translations of BPHS lead to different engine rules.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| `arkāṃśa karkalagne pañcottarī matā \| mitrarkṣāj janmabhaṃ yāvat saṃkhyā saptavibhājitā` | ELS 46.29 | [TEXT] |
| Lords Sun, Mercury, Saturn, Mars, Venus, Moon, Jupiter | ELS/AE 46.30 | [TEXT] |
| Years 12 … 18 | ELS/AE 46.31 | [TEXT] |
| "Lagna is Cancer and also in Cancer dwadashamsha" | AE 46.29 | [TEXT translation] |
| "Lagna in Cancer dwadashamsha"; both-chart reading called a mistranslation; controlling planet Venus | PVR 2014 | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-29 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

Three readings of `arkāṃśa karkalagne`:
1. **Rasi lagna Cancer and D12 lagna Cancer** (AE). `arka` as the number 12 (twelve Adityas) → "12th part". Cancer lagna's first dwadashamsha (0–2°30′) is Cancer, so this means lagna in Cancer 0°–2°30′: about 1 chart in 144.
2. **D12 lagna in Cancer, any rasi lagna** (PVR; engine today). About 1 chart in 12. PVR reads `karkalagne` as describing the dwadashamsha lagna.
3. **Cancer lagna in the Sun's navamsha (Leo D9)** (ELS English). `arka` as "Sun". Cancer's navamshas run Cancer→Pisces; the Leo navamsha is the 2nd (3°20′–6°40′).

`mitrarkṣa` = the star of Mitra = Anuradha. ELS's "friendly asterism" is a literal mistranslation.

## 3. Inputs required

Lagna longitude (rasi, D12, D9 depending on reading); Moon longitude.

## 4. Calculation

Count from Anuradha (17) to the birth star, ÷ 7, remainder → lord. Engine table (`panchottari.py`, seed 17):

| Lord | Years | Nakshatras |
|---|---|---|
| Sun | 12 | 17, 24, 4, 11 |
| Mercury | 13 | 18, 25, 5, 12 |
| Saturn | 14 | 19, 26, 6, 13 |
| Mars | 15 | 20, 27, 7, 14 |
| Venus | 16 | 21, 1, 8, 15 |
| Moon | 17 | 22, 2, 9, 16 |
| Jupiter | 18 | 23, 3, 10 |

Total 105. Balance by 46.16; AD = MD × AD / 105.

## 5. Interpretation rules

As Vimshottari via BPHS 47–48 [COMM/MODERN]. PVR: use only if Venus is strong [MODERN].

## 6. Variants and disputes

See §2. Readings 1 and 2 share the bhutasankhya sense of `arka` = 12; reading 3 takes `arka` = Sun.

## 8. Design notes for AI Astra

- Engine addition: export `panchottari_d12_only` (current), `panchottari_rasi_and_d12` (strict) and optionally `panchottari_leo_d9`. Default to the current D12-only flag; record the reading in the export.
- D12 lagna changes every ~10 minutes of birth time; always export the margin.
- Research use only.

## 9. Open questions

- Which reading does GC Sharma follow? Not checked.
