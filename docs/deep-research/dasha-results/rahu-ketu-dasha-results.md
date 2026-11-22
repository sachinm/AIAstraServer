# Rahu and Ketu dasha results (tamograha-daśā-phala)

> The nodes own no sign in the Parashari house scheme, so their dashas are judged by the house they occupy, the lords
> they join or are aspected by, and the sign. The fetched texts state this "by house and association" rule directly;
> the popular "a node acts like its dispositor (sign lord)" rule was not found in any fetched verse. Nodes in kendra or
> trikona with a lord act as yogakarakas; in 8/12 or with marakas they harm; the BPHS e-text (not confirmed in the
> Sanskrit) adds that they do well in 3/6/11. Timing inside their dasha is always reversed relative to the dreshkana
> rule.

## 1. Sources

- BPHS e-text (archive.org, 97-ch. numbering = enjoylearningsanskrit):
  - 47.3-4: Rahu/Ketu always reverse the dreshkana timing.
  - 47.34-39 Rahu: exalted (Taurus, as the e-text names it) or with benefics in 1/3/4/5/7/10/11 gives wealth, honour,
    children; in 8 or 12, with malefics or a maraka, or debilitated gives loss; loss at start, relief middle, distress
    end.
  - 47.71-77 Ketu: kendra/trikona/11th, benefic sign, exalted or own sign gives honour, children, wealth; 2nd, 8th, 12th
    or malefic aspect gives loss; raj yoga at start, fear middle, illness/travel end.
  - 48.18: e-text only: Rahu/Ketu favourable in 3/6/11. The Sanskrit page's verse 18 shows only the opening clause
    about planets in 3/6/11 and is cut off before the result.
  - 50.42 (rasi-dasha chapter): Rahu and Ketu occupying their assigned signs, given in the fetch as "four from Aquarius"
    for Rahu and "four from Scorpio" for Ketu, make the dasha beneficial. Wording as fetched; meaning to be checked.
- BPHS ch. 34.16-17 (IAST read): *yad bhāveśa-yutau vāpi*: nodes give the results of the house they occupy and the lord
  they join; in kendra/trikona with a strong lord or yogakaraka aspect, they form yoga.
- BPHS ch. 44.22-24: nodes as marakas (in 1/7/8/12, or 7th from or with a maraka lord); Rahu in 6/8/12 troubles in its
  dasha unless a benefic joins or aspects it.
- Phaladeepika (1950, wisdomlib OCR): 19.14 (Rahu natural: trouble from authority, thieves, poison; loss of office),
  19.15 (Rahu with a benefic, not in 6/8/12: fully auspicious), 19.16 (Rahu in Virgo, Pisces or Scorpio: honour, land,
  vehicles, lost when the dasha ends), 19.17 and 19.25 (Ketu natural), 20.39 (Rahu's results follow the planet it
  associates with; a benefic joined to Rahu harms, especially at the end of the dasha), 20.52-53 (nodes in
  kendra/trikona or benefic signs, related to a lord, act as yogakarakas in their bhuktis).
- Saravali ch. 41 (read): its Moola dasha system has no node dashas; nothing on nodes.

URLs: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt ;
https://enjoylearningsanskrit.com/scriptures/parashara/chapter-34 ;
https://enjoylearningsanskrit.com/scriptures/parashara/chapter-44 ;
https://enjoylearningsanskrit.com/scriptures/parashara/chapter-48/verse-18 ;
https://www.wisdomlib.org/hinduism/book/phaladeepika-by-mantreswara-text-and-translation/d/doc1621591.html

## 2. When it applies

Rahu MD (18 y) and Ketu MD (7 y), and every Rahu/Ketu bhukti.

## 3. Inputs required

House and sign of each node, conjunct planets with their functional status, graha drishti received, sign lord
(dispositor) and its condition, nakshatra lord, the node exaltation scheme the engine uses (record it; the BPHS
e-text names Taurus for Rahu), and whether the node is in kendra/trikona/3/6/11/8/12.

## 4. Rule procedure

1. House: 1/4/5/7/9/10/11 good if with benefics or a lord (BPHS 47.34-39, 34.17); 8/12 bad; 2nd bad for Ketu
   (47.71-77); 3/6/11 good per the e-text of 48.18 (unconfirmed in Sanskrit).
2. Association: results of the joined lord's houses (34.16; PD 20.39). Benefic company: good (PD 19.15), but the
   benefic itself suffers, mostly at the dasha's end (PD 20.39).
3. Yogakaraka status: in kendra/trikona and related to a kendra or trikona lord (34.17; PD 20.52-53).
4. Maraka status: 1/7/8/12 or with a maraka lord (44.22).
5. Sign: Rahu in Virgo, Pisces, Scorpio (PD 19.16); exaltation per the engine's scheme.
6. Timing: reversed dreshkana (47.3-4); BPHS phase notes as above.

## 5. Interpretation rules

| Condition | Rahu | Ketu | Tag / source |
|---|---|---|---|
| 3/6/11 | good | good | [TEXT, e-text only] BPHS 48.18 |
| kendra/trikona with a lord | yogakaraka | yogakaraka | [TEXT] BPHS 34.17; PD 20.52-53 |
| with a benefic, not 6/8/12 | fully good | (not stated) | [TEXT] PD 19.15 |
| 8/12, malefics, maraka | loss, distress | loss, confinement | [TEXT] BPHS 47.34-39, 47.71-77, 44.22-24 |
| acts as its sign lord (dispositor) | commonly taught | commonly taught | [MODERN] no verse found |
| acts as its nakshatra lord | commonly taught | commonly taught | [MODERN] no verse found |

## 6. Variants and disputes

- Dispositor and star-lord rules are taught widely but have no fetched classical locus here; keep them as a secondary
  layer with a [MODERN] tag.
- Node exaltation signs and "own" signs vary between editions and schools; the engine must state the scheme it uses.

## 7. Worked micro-example

Taurus lagna, Rahu in the 10th (Aquarius) with Saturn (9th/10th lord, yogakaraka). Rahu MD: kendra + yogakaraka
association = yogakaraka node (34.17); career rise; reversed timing (47.3-4) and PD 20.39 point to strain near the end.

## 8. Design notes for AI Astra

- Engine output: `node_house`, `node_associates[]` with functional status, `node_aspected_by[]`, `node_dispositor` (with
  condition), `node_star_lord`, `node_is_yogakaraka`, `node_is_maraka`, plus `rule_basis` so the board can show which
  layer (house/association [TEXT] vs dispositor [MODERN]) produced the stance.
- Rahu MD is the longest span users hit; Self and Work boards need a house + association headline.
- Pitfall: dispositor and association can point opposite ways; rank association first ([TEXT]), dispositor second.

## 9. Open questions

- Find a classical verse for the dispositor rule (Uttara Kalamrita khanda 4 and Jataka Parijata to be checked).
- Read BPHS 48.18-19 in Sanskrit to confirm the 3/6/11 rule for nodes.
- Confirm the meaning of BPHS 50.42's "four from Aquarius / Scorpio".
