# Saturn and Jupiter transit rules: Sade Sati, Kantaka, Ashtama Shani, Jupiter

> These are named periods of Saturn's transit from the natal Moon, plus the matching Jupiter rules:
> - **Sade Sati:** Saturn in the 12th, 1st and 2nd from the Moon, about 7.5 years.
> - **Ardhashtama or Kantaka:** the 4th, and in some usage the 7th and 10th.
> - **Ashtama Shani:** the 8th.
> - **Jupiter:** good in 2, 5, 7, 9 and 11; difficult in 1, 3, 4, 6, 8, 10 and 12.
>
> The house rules come from the gochara tables (PD 26). The name "Sade Sati" and its three phases are traditional
> usage; no classical verse coining them was located.

## 1. Sources
- **Phaladeepika 26:2-5** (Saturn good in 3, 6 and 11; all other houses bad) and 26:7 (Jupiter):
  - https://www.siva.sh/phaladeepika/26/1-5
  - https://www.siva.sh/phaladeepika/26/6-10
- **Jataka Sara Deepa** gochara chapter (secondary summary): Sade Sati as the 12th, 1st and 2nd from the Moon, plus the 4th (ardhashtama) and the 8th. https://theeyeofvedas.blogspot.com/2025/11/chapter-44-gochara-phala-adhyaya.html
- **Brihat Samhita ch. 104:** Saturn and Jupiter effects by house from the birth Moon. https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc229368.html (read from a search snippet only; the page was not opened)

## 2. When it applies
All charts. These are year-scale themes for Self, Love and Work.

## 3. Inputs required
- The natal Moon sign.
- Saturn's and Jupiter's sign stays, including retrograde re-entries.
- BAV and SAV.

## 4. Calculation / rule
**Saturn's house from the Moon:**

| House | Name |
|---|---|
| 12th | Sade Sati, rising phase |
| 1st | Sade Sati, peak (janma Shani) |
| 2nd | Sade Sati, setting phase |
| 4th | Ardhashtama / Kantaka (North: dhaiya) |
| 8th | Ashtama Shani (dhaiya) |
| 7th, 10th | Kantaka, in South Indian usage (kendras from the Moon) |
| 3rd, 6th, 11th | good ([TEXT] PD 26:5) |

**Jupiter's house from the Moon** ([TEXT] PD 26:7):

| House | Result |
|---|---|
| 2, 5, 7, 9, 11 | good, subject to vedha: 12, 4, 3, 10 and 8 respectively |
| 1 (janma guru), 3, 4, 6, 8, 10, 12 | bad |

## 5. Interpretation rules
- **[TEXT] PD 26:** Saturn is bad outside 3, 6 and 11; its good transits are obstructed by planets in 12, 9 and 5, except the Sun.
- **[TEXT] PD 26:41 and 23:20:** a high BAV or SAV mitigates a bad Saturn transit.
- **[COMM]** Sade Sati themes by phase. These are traditional, and attribution of the phases to particular body parts varies by author:

  | Phase | Theme |
  |---|---|
  | Rising (12th) | expense, travel, sleep, father-like figures |
  | Peak (1st) | body, mind, self |
  | Setting (2nd) | family, speech, money |
- **[MODERN] Raman and K.N. Rao:** Sade Sati is not uniformly bad. Results depend on:
  - Saturn's natal yoga-karakatva;
  - the dasha;
  - the BAV;
  - whether it is the first, second or third cycle of life.
- **[COMM]** Jupiter's transit over the Moon and over the Lagna, and its aspect to the 5th, 7th and 9th, is used for marriage and children, together with Saturn. See `17-double-transit.md`.

## 6. Variants and disputes
- **The name "Kantaka":**
  - South India uses it for Saturn in the kendras from the Moon (4, 7, 10, and sometimes the 1st).
  - North India uses "dhaiya" (2.5 years) for the 4th and 8th.
  - The engine labels 4 as `kantaka_dhaiyya` and 8 as `ashtama_dhaiyya`. Copy should not mix the two schools.
- **Counting from the Lagna:** some count Sade Sati from the Lagna as well. That is [MODERN] and not classical.
- **Retrograde re-entry:** traditional practice extends the phase for the whole time spent in the sign, re-entries included.

## 7. Worked micro-example
1. The Moon is in Pisces.
2. Saturn in Aquarius is the rising phase, in Pisces the peak, and in Aries the setting phase.
3. Saturn in Gemini (the 4th) is Kantaka/dhaiya, and in Libra (the 8th) Ashtama.

## 8. Design notes for AI Astra
- **Engine:** `sade_sati_spans` and the dhaiya spans already exist (`transit_range_export.py`, `transits_export.py`), with phases.
- **Engine additions:**
  - kantaka 7th and 10th spans as a separately labelled variant;
  - the life-cycle count (1st, 2nd or 3rd Sade Sati);
  - per-phase BAV and SAV.
- **Board:** the Self board headline for multi-year themes.
- **Weight:** medium-high, but always gated by dasha and AV.
- **Pitfall:** avoid fear language, and never present Sade Sati as doom.

## 9. Open questions
- Find the earliest text that names "Sade Sati" (sāḍhe-sātī is a Hindi/Marathi term, not Sanskrit). It is probably a late folk-classical term.
