# Which life area a dasha activates (bhāva activation: from the dasha lord, bhāvāt bhāvam, kāraka)

> A period does not only speak for the houses its lord owns from lagna. The texts also read (a) the bhukti lord's house
> counted from the dasha lord, (b) the relative's house counted as a new lagna (12th from a bhava = loss of that
> relative), (c) the planet's karakatwa, and (d) the Moon's sign as a bhava. These rules answer "this period is about
> what, and about whom". Bhavat bhavam as a named principle was not located in a fetched verse; its use in dasha is
> [MODERN] practice built on these [TEXT] pieces.

## 1. Sources

- Phaladeepika (1950, wisdomlib OCR): 20.21 (karakas, signs, aspects and bhava-occupancy rules from earlier chapters
  apply to the planet's dasha), 20.29 (the bhukti lord's position from the dasha lord determines which bhava's results
  manifest), 20.58 (death of the relative of a bhava occurs in the dasha of the planet in the 12th from that bhava or
  its lord, whichever is weaker), 20.34-35 (transit promotes or destroys the bhava the planet owns), 20.61-62 (Moon's
  sign represents a bhava).
- BPHS 47.2 (general results from the planet's nature = karakatwa; distinctive from placement).
- BPHS 48.2-7 (lord-of-house results).
- [MODERN] Bhavat bhavam (the Xth from the Xth house repeats house X), karaka-from-karaka reading, Chara-karaka use in
  Vimshottari: common teaching; no primary verse fetched here.

## 2. When it applies

All dashas, to name the area and the person concerned (self, spouse, child, father, sibling).

## 3. Inputs required

Houses owned/occupied by MD, AD, PD lords; AD position from MD lord; each lord's natural karakatwa; derived houses
(e.g. 7th from 7th, 9th from 9th, 12th from each bhava); Moon sign.

## 4. Rule procedure

1. Area from owned/occupied houses (lagna).
2. Area from AD position counted from MD lord (PD 20.29).
3. Person concerned: count the relevant house as lagna; 12th from it signals loss for that person (PD 20.58) [TEXT];
   further derived houses [MODERN].
4. Karaka colour (PD 20.21; BPHS 47.2): Venus = spouse/comfort, Jupiter = children/teacher, Sun = father/authority,
   Moon = mother/mind, Mars = siblings/land, Mercury = learning/trade, Saturn = labour/longevity.

## 5. Interpretation rules

- [TEXT] PD 20.29 and 20.58 as above.
- [MODERN] Bhavat bhavam: 3rd from 7th (spouse's siblings), 9th from 9th (5th, father's fortune) etc.
- [MODERN] When a karaka's dasha runs and the lord of that karaka's house is also active, that topic peaks.

## 6. Variants and disputes

How far derived houses should be stacked; whether chara karakas (Jaimini) apply in Vimshottari readings (schools differ;
no school source read in this pass).

## 7. Worked micro-example

Sun MD, Saturn AD; Saturn 12th from the 9th (i.e. in the 8th): PD 20.58 flags care for the father.

## 8. Design notes for AI Astra

- Engine: `ad_from_md_house`, `derived_house_map` per bhava, karaka table. Love board (spouse = 7th and Venus), Self
  (1st, Moon), Work (10th, Sun/Saturn). Relative-loss rules must be rendered as care, never as loss.
- Weight: area selection, not polarity.

## 9. Open questions

Locate a classical bhavat-bhavam verse (BPHS bhava chapters, Uttara Kalamrita) to upgrade the tag.
