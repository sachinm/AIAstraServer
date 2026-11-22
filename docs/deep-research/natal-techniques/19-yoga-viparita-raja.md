# Viparita Raja yogas — "reversed" power yogas (viparīta rāja yoga: Harṣa, Saraḷa, Vimala)

> A Viparita raja yoga forms when the lords of the dusthanas (6, 8, 12) occupy dusthanas, or are associated only among themselves. Each lord damages another evil house, and the outcome is a rise through adversity, often after others' losses. Phaladeepika names the three:
> - **Harsha**: 6th lord.
> - **Sarala**: 8th lord.
> - **Vimala**: 12th lord.
>
> It is widely used in modern practice (K.N. Rao and Raman especially). Its classical base is narrower than its popularity suggests.

## 1. Sources
- **BPHS**: not found in the BPHS-ET chapters checked (35-42). The fetch of ch. 39-42 found no viparita rule (V negative, partial window). Some editions place a verse in the yogakaraka chapter (ch. 34), saying that the 6th, 8th and 12th lords in dusthanas give raja yoga (R; not verified).
- **Phaladeepika ch. 6**: Harsha, Sarala and Vimala, each defined by the 6th, 8th or 12th lord in a dusthana. Commonly cited as Phaladeepika 6.63-68 (R; verse numbers unverified; secondary summary at https://aaps.space/docs/raja-yogas/harsa-yog/).
- **Uttara Kalamrita** (Kalidasa): the general viparita principle (R, secondary source above).
- [MODERN] K.N. Rao, Raman: wide usage and dasha timing.

## 2. When it applies
D1. Work (rise after setbacks), finances (gains from others' losses), and resilience on the Self board.

## 3. Inputs required
Lords of the 6th, 8th and 12th and their houses, associations, dignity, and links with other lords (especially the lagna lord and trikona lords).

## 4. Calculation / rule
| Yoga | Condition [TEXT PD 6, R] | Result [TEXT, R] |
|---|---|---|
| Harsha | The 6th lord in the 6th, 8th or 12th (or the 6th house and lord afflicted by dusthana influence) | Happy, healthy, wins over enemies, fame |
| Sarala | The 8th lord in the 6th, 8th or 12th | Long-lived, fearless, learned, prosperous |
| Vimala | The 12th lord in the 6th, 8th or 12th | Frugal, independent, good conduct, happy |
| General viparita | Dusthana lords exchange, conjoin or aspect each other within dusthanas, unassociated with other lords | Rise after adversity |

Spoilers [COMM/MODERN]:
- A dusthana lord that also owns the lagna or a trikona (e.g. Jupiter owning the 9th and 12th) becomes mixed.
- Association with the lagna lord brings the damage to the self.
- The yoga in its own dasha first gives trouble, then rise.

## 5. Interpretation rules
- [TEXT] As in the table (PD 6, R).
- [MODERN] K.N. Rao: viparita results come suddenly and often through the misfortune of others, in the dasha of the forming lords.
- [MODERN] It works best when the lagna lord is strong. A weak lagna lord turns it into plain affliction.

## 6. Variants and disputes
- Placement in dusthanas alone vs requiring mutual association.
- Whether a dusthana lord in its own house (e.g. the 8th lord in the 8th) counts. Phaladeepika (R) includes it, as Sarala.
- The BPHS basis is uncertain (above).

## 7. Worked micro-example
Aries lagna:
- The 6th lord Mercury is in the 8th (Scorpio): Harsha.
- The 12th lord Jupiter is also the 9th lord, so a Jupiter-based Vimala would be mixed.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `raja_yoga.vipareetha_raja_yoga` and `yoga.harsha/sarala/vimala_yoga_from_planet_positions`;
  - `AIAstra_Radha/src/jhora/facts_export.py` `_rule_yogas`, which emits `Viparita Raja Yoga (lord of D in H)`. That rule requires the lord to be in a *different* dusthana (`house != d`), so the 8th lord in the 8th does not count. This differs from the Sarala reading recalled above. State the variant per output.
- **Must output**:
  - which of Harsha, Sarala and Vimala are present;
  - the dusthana lords, their houses and their associations;
  - mixed-lordship flags;
  - lagna lord strength;
  - the variant rule used (placement only, or association required).
- **Board use**: Work and Self, as "comeback" or "resilience" themes.
- **Weight**: medium, time-bound to its dasha.
- **Pitfall**: never say "gains from others' misfortune" directly.

## 9. Open questions
- Verify the Phaladeepika 6 verse numbers.
- Check whether any BPHS edition has a viparita verse, and which.
