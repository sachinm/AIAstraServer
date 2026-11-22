# Which rasi dasa for what (rāśi daśā viniyoga)

> One table: what each sign dasa is for according to the texts or the modern school that uses it. Most purposes are
> NOT stated in the classical texts. BPHS 46.6-11 only lists the dasas and prefers Vimsottari and Kalachakra, and
> Jaimini states a purpose mainly for the longevity dasas. PVR says outright that classics rarely state the uses
> (PVR-VA Part 2 intro). So the "purpose" column is labelled by source.
> Source codes are as in 00-overview.md.

## 1. Sources
BPHS ch. 46 (dasa list and rules), ch. 50-51 (effects, antardasa); JS-BSR 2.1-2.4; PVR-VA Part 2 intro and ch. 18-23;
Rath *Narayana Dasa*; KNR; engine modules (`raasi/*.py`).

## 2. The table

| Dasa | Purpose | Tag and source | Seed | Years | Use in AI Astra |
|---|---|---|---|---|---|
| Narayana (D1) | general events; "progression of lagna"; environment acting on the native | [MODERN] PVR-VA 18.1, 18.4; Rath preface. Sequence [TEXT] JS 2.4.7-10 | stronger of 1st/7th | count to lord | Self board, main rasi confirmation |
| Narayana D9 / D10 / D4 / D7 / D12 / D24 | marriage / career / home and residence / children / parents / learning | [MODERN] PVR-VA 18.5 | lord of nth house, placed in Dn | count to lord | Love (D9), Work (D10) |
| Chara | general life events, read with chara karakas | [MODERN] KNR; [TEXT] BPHS 46.155-167 (no purpose stated) | lagna (variants differ) | count to lord | secondary; one variant only |
| Sudasa | wealth, power, status | [MODERN] PVR-VA 20.1, 20.3 | Sree Lagna | count to lord | Work board (money/standing) |
| Lagna Kendradi rasi | material prosperity | [MODERN] PVR-VA 19.1, 19.4 ("Sudasa superior") | stronger of 1st/7th | count to lord | Work board, low weight |
| Karaka Kendradi rasi | not stated (AK-centred prosperity by analogy) | [ENGINE] only; [TEXT] JS 2.4.11-13 graha form | AK or its 7th | count to lord | none yet |
| Drig | spiritual growth: initiation, sadhana, renunciation | [MODERN] PVR-VA 21.1 | 9th house | Sthira (BPHS) / count to lord (PVR) | Self "inner life" card, only if promised |
| Shoola (Jaimini, 1st/7th) | death; disease and suffering; death of relatives from their houses | [TEXT] JS 2.1.37-43, 2.2.4-11, 2.3.18-24; [MODERN] PVR-VA 23 | stronger of 1st/7th | 9 | not user-facing |
| Niryana Shoola (= BPHS "Shoola", 2nd/8th) | timing of death | [TEXT] BPHS 46.181-182; [MODERN] PVR-VA 22 | stronger of 2nd/8th | 7/8/9 | not user-facing |
| Sthira | longevity: death in the third (khanda) that matches the life span | [TEXT] JS 2.1.30-31; BPHS 46.168-169 | Brahma's sign | 7/8/9 | not user-facing |
| Brahma | longevity: life runs from Brahma's sign to Maheswara's | [TEXT] JS 2.1.47-54, 2.3.25-26 | Brahma's sign (even lagna: its 7th) | count to 6th lord | not user-facing |
| Navamsa | longevity (death in navamsa dasas); 2nd-house results in movable signs | [TEXT] JS 2.1.15-18, 2.3.1-2, 2.4.1 | lagna (odd) / abhimukha sign (even) | 9 | not user-facing |
| Padanathamsa | general results (reported); JS 2.1.18 ayur use | [COMM reported] Jyotisha Phala Ratnamala ch. 27; [TEXT] JS 2.1.18 | navamsa of AL's lord | count to lord | none |
| Trikona | not stated; malefic contacts mean disease or confinement | [TEXT] BPHS 46.183-184; JS 2.4.24-25 | strongest trine | count to lord | none |
| Yogardha | not stated | [TEXT] BPHS 46.174; JS 2.4.19-20 | stronger of 1st/7th | (Chara + Sthira)/2 | none |
| Mandooka | not stated in BPHS; PVR: D11 Mandooka for wars and death | [TEXT] BPHS 46.179-180; [MODERN] PVR-VA 19.4 | stronger of 1st/7th | 7/8/9 | none (variants unsettled) |
| Lagnadi Rasi (BPHS "Rasi") | not stated; seed = Sree Lagna (inference) | [TEXT] BPHS 46.188-190 | lagna + nakshatra fraction | 7/8/9 | variant of Sudasa only |
| Tara-amsa (Tara Lagna) | wealth and standing judged from the starting lord | [TEXT] JS 2.4.27-30 (BSR unsure) | lagna + twelfth of nakshatra | 9 | none |
| Chakra | not stated | [TEXT] BPHS ~46.50-51 | night: lagna; day: lagna lord's sign; twilight: 2nd | 10 | none |
| Varnada | not verified (moderns cite social standing; no source read) | [ENGINE] only; [TEXT] JS 1.1.32 defines Varnada lagna only | stronger of lagna/hora lagna (engine) | engine rule unsourced | none |
| Paryaya / Chara Paryaya | not verified (engine defaults to D6) | [ENGINE] only | nth house of Dn | count to lord | none |

## 3. Reading summary
- **General events:** Narayana (SJC) or Chara (K.N. Rao). Treat them as alternatives and do not run both on a board.
- **Wealth and status:** Sudasa first, then Lagna Kendradi. Check against Narayana D10 and Vimsottari.
- **Marriage:** Narayana D9 with UL references. **Career:** Narayana D10 with A10 and GL references.
- **Spiritual:** Drig.
- **Longevity and death (self and relatives):** Shoola, Niryana Shoola, Sthira, Brahma, Navamsa. Keep these out of the
  product.

## 4. Design notes for AI Astra
- Engine contract per dasa: a `purpose` field taken from this table, with the source tag, so a reading can say why it
  used a given dasa. Node only displays it.
- Board weight (recommendation): Vimsottari leads; for Work questions Sudasa and Narayana D10 confirm; for Love
  questions Narayana D9 confirms; for Self, Narayana D1. A period counts as "confirmed" only when the nakshatra and rasi
  dasas agree.
- The ayur dasas are not shown and not paraphrased in readings (death timing).

## 5. Open questions
- Product decision on whether Drig is used at all.
- Uses of Karaka Kendradi, Varnada and Paryaya need classical text before they can be assigned a purpose.
