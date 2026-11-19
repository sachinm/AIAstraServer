# Transit over natal planets and sensitive points

> This file covers transits read against the natal planets, the Lagna, house cusps and computed points, rather than
> against the house from the Moon. The classical texts do this mainly by sign, nakshatra and ashtakavarga-derived points
> (Phaladeepika 24, 26:26-29). Exact-degree contacts are largely a modern refinement. The technique answers "which
> natal promise is being touched now".

## 1. Sources
- **Phaladeepika 26:26-29** (siva.sh): transits and eclipses on the janma, karma and adhana stars and on the janma triad. https://www.siva.sh/phaladeepika/26/26-30
- **Phaladeepika 24:1-5:** Saturn's transit over an AV-computed nakshatra, or its trines, harms the father. https://www.siva.sh/phaladeepika/24/1-5
- **BPHS ch. 71-72** (Santhanam): AV-derived transit points for longevity and relatives. Not verified at verse level.
- **Modern:** K.N. Rao and Sanjay Rath (SJC) use transits over natal dasha lords and arudhas; B.V. Raman uses transits over the natal lords of houses.

## 2. When it applies
- Event timing: career change, marriage, health, the death of relatives.
- Within the running dasha.

## 3. Inputs required
- The longitude, sign and nakshatra of the natal planets and the Lagna.
- Computed points: the AV-pinda nakshatras, arudhas, and the cusps of key houses.
- The transit longitudes for the day.

## 4. Calculation / rule
1. **[TEXT] Sign level.** The transiting planet enters the sign of a natal planet or of the Lagna.
2. **[TEXT] Nakshatra level** (PD 26:26-29). It transits:
   - the janma star (the 1st);
   - the karma star (the 10th);
   - the adhana star (the 19th);
   - or the stars named in 26:28 (the 3rd, 5th, 7th and 23rd).
3. **[TEXT] AV points.** Saturn transits the nakshatra or sign derived from bindus × shodhya pinda (PD 24:1-5; see `10-shodhya-pinda.md`).
4. **[MODERN] Degree level.** Conjunction within a small orb (1°-3°), or exact aspect, to a natal planet or cusp. Track the entry, the exact hit, a retrograde re-hit and the exit.

## 5. Interpretation rules
- **[TEXT] PD 26:26-27.** The Sun's vedha on the janma star signals death; on the adhana star, fear; on the karma star, loss of wealth. These hold when the Sun is joined by malefics. Benefics remove the threat.
- **[TEXT] PD 26:29.** Danger is greatest when the janma triad is afflicted on a sankranti, a sign change, an eclipse, a planetary war or a meteor.
- **[COMM]** A malefic transiting a natal planet afflicts what that planet signifies. A benefic over it supports.
- **[MODERN]** Saturn or Jupiter over the dasha lord, or over the lord of the house in question, triggers that dasha's results.

## 6. Variants and disputes
- **Orbs:** the classical texts give no degree orbs. Any orb is a product choice.
- **KP sub-lord transit methods** are not classical and are excluded.

## 7. Worked micro-example
- **Natal:** Venus at 10° Libra.
- **Transit:** Saturn enters Libra (sign-level contact), reaches exactly 10° (degree contact), turns retrograde and re-hits it, then leaves.
- **Reading:** a relationship or financial test, read inside the dasha.

## 8. Design notes for AI Astra
- **Engine:** `transit_contacts_export.py` already produces natal-degree contacts with entry, exact and exit. Add:
  - nakshatra-level hits on the janma, karma and adhana stars;
  - the PD 24 pinda points.
- **Boards:** Self, Love and Work, as triggers. Weight: medium, and always gated by the dasha.
- **Pitfall:** do not fire every fast-planet contact. Restrict to Jupiter, Saturn, the nodes and eclipses for life readings. Use Mars and the Sun only for weekly views.

## 9. Open questions
- Read BPHS 71-72 at verse level to list every AV-derived transit point (father, mother, siblings, spouse and so on).
- Agree an orb policy.
