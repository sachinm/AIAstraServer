# Dasha junction and dasha end (daśā-sandhi, daśā-chidra)

> "Dasha sandhi" is the junction between two mahadashas; "dasha chidra" is the closing stretch of a mahadasha
> (usually its last antardasha, ruled by the planet preceding the MD lord in the Vimshottari order). Both are widely
> taught as unsettled or vulnerable times. **This pass found no classical verse that defines either term as a rule.**
> What the fetched texts do give are end-of-period statements for particular planets. Treat the concept as [MODERN]
> until a verse is located.

## 1. Sources

- Phaladeepika 21.83 (1950, wisdomlib OCR): mentions finer subdivisions including *chidra* carrying finer effects;
  no rule about junctions.
- BPHS e-text: phase statements that the end of some dashas is adverse: Mars (47.27-32 "setbacks near the end"),
  Mercury (47.61-70 "end: distress"), Rahu (47.34-39 "distress at end"), Ketu (47.71-77 "illness, travel at end").
- Phaladeepika 20.39: a benefic joined to Rahu harms especially at the end of the dasha.
- Rath (secondary, via repo notes `research_notes/Sanjay Rath method summary/parashari_timing.md`): dashas tend to give
  adverse results toward their closing sub-period (stated in his Dvisaptati Sama article) [MODERN].
- Blogs (shreekundli.com, tempora.ltd) define chidra as last AD or last PD; they disagree on width. Not authoritative.

## 2. When it applies

The last antardasha of each MD and the months around the MD change.

## 3. Inputs required

MD/AD/PD boundaries (engine), condition of outgoing and incoming lords.

## 4. Rule procedure (proposed, not classical)

1. Flag last AD of each MD as `chidra`.
2. Flag ±N months around the MD boundary as `sandhi` (N is not given by any text found; it must be a product
   decision, labelled as such).
3. Tone: mixed/transitional; strength from the outgoing lord's phase note (BPHS ch. 47) and the incoming lord's
   condition.

## 5. Interpretation rules

- [TEXT] Planet-specific "end of dasha" notes (BPHS ch. 47; PD 20.39).
- [MODERN] Generic sandhi/chidra caution.

## 6. Variants and disputes

Width of the window; whether chidra = last AD or last PD; whether sandhi applies to AD boundaries too.

## 7. Worked micro-example

Jupiter MD ends with Jupiter-Rahu AD (chidra); Saturn MD starts. Read Rahu's condition and Saturn's start transit
(BPHS 47.5-6) together for the transition tone.

## 8. Design notes for AI Astra

Engine can flag `is_last_ad` and `days_to_md_change`; tone choice belongs to the technique contract. Low weight; use
as "transition" wording only.

## 9. Open questions

Check Jataka Parijata's dasha chapter, Kalaprakashika and Uttara Kalamrita for a sandhi verse.
