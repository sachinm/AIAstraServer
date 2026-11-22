# Neecha Bhanga Raja yoga — cancellation of debilitation (nīcabhaṅga rāja yoga)

> A debilitated planet's weakness is "cancelled" when certain supporting conditions exist. When the cancellation is strong, the result becomes a raja yoga: a rise after an early fall. It is extremely popular in modern practice. The classical lists are short (Phaladeepika has the best-known verses), and later compilations expanded them.

## 1. Sources
- **Phaladeepika ch. 7 "Maharaja yogas"**: the neecha bhanga verses, commonly cited as 7.26-30 (R; verse numbers unverified, PDF returned 403 this session).
- **BPHS**: ch. 39 notes that some debilitated planets give raja yoga under conditions (V gist from the BPHS-ET ch. 39 fetch). The full condition list was not seen.
- **Brihat Jataka ch. 11**: "nīca" appears only in a dasha context; no cancellation rule (V-Sa, BJ-Neely Sanskrit-only page read by a fetch model).
- **Saravali**, **Jataka Parijata**: further conditions (R).
- [MODERN] Raman, *300 Important Combinations*; K.N. Rao.

## 2. When it applies
D1 (and D9 checks). Any area whose lord or karaka is debilitated.

## 3. Inputs required
- For each debilitated planet P: its sign (debilitation sign S);
- the lord of S (the dispositor);
- the planet exalted in S;
- the lord of P's exaltation sign;
- the kendras from the lagna and from the Moon;
- aspects;
- P's D9 sign;
- exchanges.

## 4. Calculation / rule (common list; R for each, source in brackets)
| # | Condition | Source |
|---|---|---|
| 1 | The lord of S (P's dispositor) is in a kendra from the lagna or the Moon | PD 7 (R) |
| 2 | The planet that is exalted in S is in a kendra from the lagna or the Moon | PD 7 (R) |
| 3 | The lord of P's exaltation sign is in a kendra from the lagna or the Moon | Raman / later (R) |
| 4 | The lord of S aspects P | later (R) |
| 5 | P is in exchange with the lord of S | later (R) |
| 6 | P is exalted in D9 (navamsa) | later (R) |
| 7 | P is conjoined with an exalted planet | later (R) |
| 8 | P is retrograde | disputed [MODERN] |

Raja yoga upgrade [COMM/MODERN]:
- two or more conditions;
- P well placed (kendra or trikona) or a functional benefic;
- the lagna lord strong.

## 5. Interpretation rules
- [TEXT] With neecha bhanga, the native becomes a king or is righteous and renowned (PD 7, R).
- [MODERN] The results come after early struggle, in the debilitated planet's dasha or that of the cancelling planet.
- [MODERN] K.N. Rao: cancellation restores the planet; it does not by itself guarantee a raja yoga.

## 6. Variants and disputes
- The lists range from 2 conditions (PD core) to 10 or more (modern compilations).
- Kendra from the lagna only, or from the lagna or the Moon.
- Whether D9 exaltation alone suffices.
- Retrograde debilitated planets: some treat them as exalted. This is disputed.

## 7. Worked micro-example
Jupiter debilitated in Capricorn:
- The lord of Capricorn, Saturn, is in the 10th from the lagna, a kendra: condition 1.
- Mars, which is exalted in Capricorn, is in the 4th from the Moon: condition 2.
- Two conditions: neecha bhanga, a strong candidate for the raja yoga grade.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `raja_yoga.neecha_bhanga_raja_yoga(_from_planet_positions)`;
  - `AIAstra_Radha/src/jhora/facts_export.py` `_rule_yogas`, which emits `Neecha Bhanga` on condition 1 only: the dispositor in a kendra from the lagna or the Moon.
- **Must output per debilitated planet**:
  - each condition tested (true or false), with the source tag;
  - the count of conditions met;
  - the reference frame (lagna or Moon);
  - the D9 sign;
  - the final status (debilitated, cancelled, or raja-yoga grade).
- **Board use**: Self and Work ("hard start, strong finish" themes).
- **Weight**: medium. Show it only with the condition count.
- **Pitfall**: the engine must say which list it implements. Readers must not add conditions themselves.

## 9. Open questions
- Verify the exact Phaladeepika 7 verses and the BPHS ch. 39 debilitation verse.
- The engine-rule-verifier should compare the engine's list with the table above.
