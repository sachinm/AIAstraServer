# Maraka (death-inflicting) periods (māraka-daśā)

> Which dashas and bhuktis classically threaten life or health: lords of the 2nd and 7th (12th from the longevity
> houses 3 and 8), malefics in or joined to them, Saturn when related to a maraka, Rahu/Ketu in certain houses, and
> fall-backs (12th lord, 6th/8th lords). The texts insist that the longevity span (short/medium/long) be fixed first.
> For AI Astra this is a **health-caution** rule set only; it must never be rendered as a death prediction.

## 1. Sources

- BPHS ch. 44 (enjoylearningsanskrit numbering, IAST read): 44.2 *tṛtīyam aṣṭamasthānam āyuḥsthānam dvayam* (3rd and
  8th longevity; 2nd and 7th maraka, being 12th from them); 44.3 2nd stronger than 7th; their lords and malefics in
  them or with their lords kill; 44.4 malefics in general; 44.5 fix span first; 44.6 fall-back via 12th lord, sometimes
  benefic periods or 8th lord; 44.7-8 a maraka does not kill in benefic bhuktis but can in malefic ones; 44.9
  *mārakagrahasambandhān nihantā pāpakṛc chaniḥ* (Saturn related to a maraka overrides); 44.15-17 nakshatra-tara
  periods (vipat, pratyari, vadha) for short/medium/long life; 44.18 2nd/12th from Moon's sign; 44.19 6th lord dasha
  and 6/8/12 lords' bhuktis; 44.20-21 the strongest maraka is chief; 44.22-24 Rahu/Ketu as marakas.
- BPHS ch. 48.19 (benefics in maraka houses or with maraka lord give bad dashas); antardasha chapters 52-60: maraka
  branch (2nd/7th lord bhukti = bodily distress, premature death) with remedies.
- Phaladeepika 20.31-32 (weakest of Saturn, Mandi, Rahu, 22nd decanate lord, 8th lord etc. gives the death dasha;
  Saturn/Jupiter transit as trigger), 20.40 (strong 2nd/7th lords kill in their dasha; very weak 8th/12th lord in
  bhukti), 20.50-51 (Jupiter/Venus as 2nd/7th lords), 20.55 (8th occupant, aspector, owner, 8th decanate lord, Mandi's
  sign lord: weakest kills), 20.58 (a relative's death in the dasha of the 12th from that relative's bhava or its lord).
- BPHS 34.21-44 lagna lists of marakas.

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-44 ;
https://www.wisdomlib.org/hinduism/book/phaladeepika-by-mantreswara-text-and-translation/d/doc1621592.html

## 2. When it applies

Only after a longevity span is fixed (BPHS 44.5). Within a span, the maraka dashas are the candidate windows. Life
areas: health of self (2/7 from lagna); health of relatives via bhavat-bhavam (PD 20.58).

## 3. Inputs required

Longevity span class (engine ayurdaya), lords of 2 and 7 and 12, malefics in 2/7, Saturn's relations, Rahu/Ketu houses,
22nd drekkana lord, 64th navamsa lord (often paired), Mandi/Gulika sign lord, janma nakshatra and taras (vipat 3rd,
pratyak 5th, vadha 7th), current transits of Saturn and Jupiter.

## 4. Rule procedure

1. Fix span (BPHS 44.5).
2. Rank marakas: 2nd lord > 7th lord > malefics in 2nd/7th > malefics joined to their lords (44.3); Saturn related to
   any of these jumps to first (44.9); strongest is chief (44.21).
3. Bhukti filter: a maraka acts in malefic bhuktis, not benefic ones (44.8).
4. Fall-backs if no maraka period falls in span: 12th lord relations, 8th lord, 6th lord dasha, 6/8/12 lord bhuktis
   (44.6, 44.19).
5. Transit trigger: Saturn in an unfavourable house, Jupiter over the 8th lord's sign/navamsa (PD 20.31-32).

## 5. Interpretation rules

- [TEXT] 2nd and 7th lords are marakas, 2nd stronger (BPHS 44.2-3).
- [TEXT] Saturn related to a maraka is the chief killer (BPHS 44.9).
- [TEXT] Rahu/Ketu in 1, 7, 8, 12 or 7th from / with a maraka lord become marakas; Rahu in 6/8/12 troubles in its dasha
  unless a benefic joins or aspects (BPHS 44.22-24).
- [TEXT] Strong 2nd/7th lords kill in their dasha; a very weak 8th/12th lord in its bhukti (PD 20.40). Note PD 20.31
  and 20.55 pick the **weakest** of their candidate lists; BPHS 44.21 the **strongest** maraka. Different lists, not a
  contradiction, but the engine must label which rule fired.
- [TEXT] Jupiter and Venus owning 2nd/7th are dangerous marakas (PD 20.50-51; BPHS 34.21 names Venus for one lagna).

## 6. Variants and disputes

Strongest vs weakest; whether Moon-based 2nd/12th lords (44.18) apply generally; Laghu Parashari's separate "Saturn as
maraka" rule (section title only seen). Saravali 41.66-68 and 43.1-4 (read) add: a planet in the 8th gives a
death-like danger in its dasha; Mars dasha Saturn bhukti is named as dangerous; the lagna lord's bhukti in the dasha of
a planet hostile to the lagna lord is dangerous (attributed to Satya).

## 7. Worked micro-example

Aries lagna: Venus owns 2 and 7 = primary maraka. Venus MD with a malefic bhukti (Saturn related to Venus) is the
textbook health-caution window; Venus MD with Jupiter bhukti is not (44.8).

## 8. Design notes for AI Astra

- Engine: `maraka_rank[]` with rule ids, `span_class`. Use only for a quiet "take care of health" tone flag on Self.
- Never show maraka wording, death, or lifespan. This file exists so the product can **suppress** harsh readings and
  recognise when the model might drift into them.
- Weight: low for UI. Per doc 82 (no word filters on model text), the safeguard is upstream: maraka fields are not
  served to the prompt at all, and the technique contract owns the tone ("take care of health"). No scan of model
  output.

## 9. Open questions

Laghu Parashari maraka verses and the Saturn rule not fetched; 64th navamsa lord not seen in fetched text (only 22nd
drekkana).
