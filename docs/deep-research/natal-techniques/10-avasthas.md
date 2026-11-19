# Avasthas — planetary states (avasthā)

> Avasthas are named states that describe the condition a planet is in, and so how much and in what manner it delivers. There are five families:
> - **Baladi** (age, by degree): how much of the result.
> - **Jagradadi** (wakefulness, by dignity): whether it delivers.
> - **Deeptadi** (mood or condition): what quality.
> - **Lajjitadi** (emotional state, by association): what damage or support to the houses.
> - **Shayanadi** (activity, from an arithmetic formula): fine-grained results per house.
>
> BPHS ch. 45 gives all five. Baladi and Jagradadi are simple and widely used. Shayanadi is complex, and few modern practitioners use it beyond SJC.

## 1. Sources
- **BPHS ch. 45 "Avasthas of Grahas"** (Santhanam numbering = BPHS-ET archive.org e-text), all (V):
  - 45.3-4 Baladi;
  - 45.5-6 Jagradadi;
  - 45.7-10 Deeptadi;
  - 45.11-18 Lajjitadi;
  - 45.30-37 Shayanadi;
  - 45.76-146 Shayanadi results per planet.
  - E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Phaladeepika ch. 3** (V. Subrahmanya Sastri 1950): a Deeptadi-type list of states with results (R; not checked, the PDF returned 403).
- **Saravali ch. 4-5**: Baladi and Deeptadi-type states (R).
- [MODERN] Sanjay Rath / SJC lectures on Shayanadi; P.V.R. Narasimha Rao on Baladi (R).

## 2. When it applies
- All planets in D1. Some apply Baladi and Jagradadi in D9 as well.
- Used for every life area, through the lord and karaka of the house.

## 3. Inputs required
- Sign and degree in sign.
- Dignity (exalted, MT, own, friend, neutral, enemy, great enemy, debilitated), by compound relation.
- Conjunctions and aspects with Sun, Saturn, malefics, benefics and Jupiter.
- Combustion.
- For Shayanadi:
  - the planet's nakshatra number;
  - its navamsa number;
  - the birth nakshatra number;
  - birth ghatis elapsed since sunrise;
  - the lagna sign number;
  - the first syllable of the person's name (for the sub-state).

## 4. Calculation / rule
**Baladi** (45.3-4, V). Six-degree blocks:

| Degrees in odd sign | Degrees in even sign | State | Result |
|---|---|---|---|
| 0-6 | 24-30 | Bala (infant) | ¼ |
| 6-12 | 18-24 | Kumara (youth) | ½ |
| 12-18 | 12-18 | Yuva (prime) | full |
| 18-24 | 6-12 | Vriddha (old) | negligible |
| 24-30 | 0-6 | Mrita (dead) | nil |

**Jagradadi** (45.5-6, V):
- own or exaltation sign: Jagrat (awake), full results;
- friend or neutral sign: Swapna (dreaming), medium;
- enemy or debilitation sign: Sushupti (asleep), nil.

**Deeptadi** (45.7-10, V; BPHS-ET list):
- Dipta: exalted.
- Swastha: own sign.
- Pramudita: great friend's sign.
- Shanta: friend's sign.
- Dina: neutral sign.
- Vikala: joined with a malefic.
- Duhkhita: enemy's sign.
- Khala: great enemy's sign.
- Kopa: eclipsed by (combust with) the Sun.

**Lajjitadi** (45.11-18, V where marked):
- Lajjita: in the 5th house with Rahu, Ketu, Sun, Saturn or Mars (R detail).
- Garvita: exalted or MT (V).
- Kshudhita: in an enemy's sign, or with or aspected by an enemy or Saturn (V).
- Trushita: in a watery sign, aspected by a malefic and not by benefics (R).
- Mudita: in a friend's sign, or with a benefic or Jupiter (V).
- Kshobhita: with the Sun and afflicted by malefics (V).
- Houses holding Kshudhita or Kshobhita planets are damaged (V).

**Shayanadi** (45.30-37, V):
1. A = planet's nakshatra no. × planet no. (Sun 1 … Saturn 7) × navamsa no.
2. Add the birth nakshatra no., the birth ghatis and the lagna no.
3. Take the result mod 12. The remainder gives the state: 1 Shayana, 2 Upaveshana, 3 Netrapani, 4 Prakasha, 5 Gamana, 6 Agamana, 7 Sabha, 8 Agama, 9 Bhojana, 10 Nrityalipsa, 11 Kautuka, 12 (0) Nidra.
4. Sub-state: (state number)² + the value of the name's first syllable, mod 12, + a planet constant; then mod 3. 1 = Drishti, 2 = Cheshta, 0 = Vicheshta.

## 5. Interpretation rules
- [TEXT] The Baladi fractions scale the planet's results (45.3-4, V). A Yuva planet gives in full; a Mrita planet gives nothing of its own.
- [TEXT] An awake planet (Jagrat) gives full results; a sleeping one gives none (45.5-6, V).
- [TEXT] Planets in Kshudhita or Kshobhita states damage the house they occupy (45.11-18, V).
- [TEXT] Shayanadi results are listed per planet and state, many keyed to the house (45.76-146, V). They are specific and often physical.
- [COMM] Results of Cheshta sub-state are full, Drishti medium and Vicheshta small (R).
- [MODERN] SJC: Baladi is the main avastha for timing how ripe a planet's results are. Lajjitadi is used in remedial judgement.

## 6. Variants and disputes
- **Deeptadi lists differ**:
  - BPHS-ET has Dipta, Swastha, Pramudita, Shanta, Dina, Vikala, Duhkhita, Khala, Kopa.
  - The engine (and, recalled, Phaladeepika-style lists) has Deepta, Swastha, Mudita, Shanta, Shakta, Peedita, Deena, Vikala, Khala. Shakta is often "bright or retrograde" and Peedita "defeated in war".
  - Keep both lists with a text tag.
- **Baladi in D9**: some apply it in the navamsa too; BPHS states only signs and degrees.
- **Rahu and Ketu**: not classical participants in most avasthas.
- **Vriddha and Mrita**: the text says "negligible" and "nil". Modern multipliers vary.

## 7. Worked micro-example
- Venus at 20° Taurus (an even sign) falls in the 18-24 block, which is Kumara in an even sign, so half results.
- Venus is in its own sign, so it is Jagrat in Jagradadi and Swastha in Deeptadi.
- Net: willing (own sign) but only half-grown (Kumara).

## 8. Design notes for AI Astra
- **Engine already has**: `AIAstra_Radha/src/jhora/avasthas_export.py` (export type `avasthas`). It covers Baladi, Jagradadi, Deeptadi, Lajjitadi and Shayanadi.
- **Engine findings**:
  1. The `BALADI_META` multipliers include Vriddha 0.35 and Mrita 0.10. BPHS 45.3-4 gives "negligible" and "nil". Label these as modern or product choices, or change them to text values (e.g. Vriddha 0.1, Mrita 0). The Bala 0.25, Kumara 0.5 and Yuva 1.0 values match the text.
  2. The Deeptadi list follows the non-BPHS-ET variant. Add a `text` tag or emit both lists.
  3. Shayanadi: `run_avasthas` computes `janma_ghatis` from sunrise. The 1.0 default is used only when the sunrise lookup fails, and then silently. Flag that case in the output instead. The name-syllable sub-state (Drishti/Cheshta/Vicheshta, BPHS 45.30-37) is **not computed**: `_compute_shayanadi` takes no name input. That is an engine addition if wanted.
- **Must output per planet**:
  - each family's state;
  - the text fraction (with the source);
  - the inputs used;
  - for Shayanadi, the sub-state.
- **Board use**:
  - Self: how "ripe" or "awake" key planets are.
  - Dasha cards: Baladi of the dasha lord as a delivery scaler.

  Weight it below dignity and placement, as a modifier only.
- **Pitfalls**: never show the words "dead" or "infant" to users. Translate them, e.g. "early", "in full flow", "spent".

## 9. Open questions
- Check the Phaladeepika Deeptadi list and its verse numbers when the text is reachable.
- Is Shayanadi worth the name-syllable dependency for the product?
