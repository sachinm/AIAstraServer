# Combustion, retrogression and planetary war (asta, vakra, graha yuddha)

> Three conditions modify a planet's ability to deliver, whatever its dignity.
> - **Combustion (asta / mauḍhya)**: too close to the Sun, invisible. Weakens the planet's significations.
> - **Retrogression (vakra)**: apparent backward motion. Gives maximum motional strength and an altered or delayed style.
> - **Planetary war (graha yuddha)**: two of Mars, Mercury, Jupiter, Venus and Saturn within one degree. One wins, and the loser's results suffer.
>
> The rules come mostly from the siddhantas and samhitas (astronomy and mundane texts). The hora texts use the results. All three are used in every school, but the orbs and winner rules are disputed.

## 1. Sources
- **Surya Siddhanta ch. 9** (Burgess transl.): heliacal setting distances (kalamsa) of Jupiter 11, Saturn 15, Mars 17, Venus 10 or 8 and Mercury 14 or 12 (the two figures depend on direction and motion). The Moon's 12 is in ch. 10 (V via the swaveda summary: https://www.swaveda.com/texts/surya-siddhanta/9/).
- **Brihat Samhita ch. 17 "Graha yuddha"** (N. Chidambaram Iyer 1884, wisdomlib: https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc228918.html), all (V):
  - v. 3: the four kinds of war (Bheda, Ullekha, Amshumardana, Apasavya);
  - vv. 9-11: the loser is southern, dim, rough, small, or turns retrograde after the meeting; a large and bright planet wins even when southern; equal brightness is a samagama (a meeting, not a war);
  - footnote: Venus usually wins (citing the Surya and Paulisa Siddhanta).
- **BPHS ch. 27 v. 20** (BPHS-ET, V): yuddha bala, in which the difference of Shadbalas is added to the victor. The winner rule is not stated in the verses seen.
- **BPHS ch. 43** (BPHS-ET, V): in longevity, a combust planet's share is halved except Venus and Saturn; retrograde planets are exempt from the enemy-sign loss.
- **BPHS ch. 45 vv. 7-10** (V): Kopa avastha = eclipsed by the Sun.
- **Uttara Kalamrita** (Kalidasa): within 1° in the same sign is war, and the northern planet wins (secondary quote: https://jagannathhora.com/?p=20002; R).
- **Saravali ch. 4-5** and **Phaladeepika ch. 2 and 4**: retrograde planets are strong (R).

## 2. When it applies
D1 natal (and transits). Combustion applies to the Moon through Saturn, war to the five tara grahas, and retrogression to the five tara grahas. The Sun and Moon are never retrograde, and Rahu and Ketu always are.

## 3. Inputs required
- Longitude, latitude, speed and apparent diameter or magnitude (for brightness).
- The Sun's longitude.
- Sign boundaries.

## 4. Calculation / rule
**Combustion** (common modern application of the SS kalamsa as longitudinal orbs):

| Planet | Orb (direct) | Orb (retrograde) |
|---|---|---|
| Moon | 12° | — |
| Mars | 17° | 17° |
| Mercury | 14° | 12° |
| Jupiter | 11° | 11° |
| Venus | 10° | 8° |
| Saturn | 15° | 15° |

The SS figures are time-degrees of visibility, not ecliptic arcs. Using them as longitude orbs is a convention [MODERN].

**Retrogression**:
- The planet's speed is below 0.
- Cheshta bala is maximum (60) in vakra (BPHS 27, R).
- Stations (stationary) are treated as very strong [COMM].

**Graha yuddha**:
1. Participants: two of Ma, Me, Ju, Ve and Sa within 1° of longitude [COMM, Uttara Kalamrita; BS 17 speaks of disc contact].
2. Winner:
   - (a) Brihat Samhita: the larger and brighter planet wins; otherwise the northern one; Venus usually wins.
   - (b) Uttara Kalamrita and many moderns: the planet with the greater northern latitude wins.
   - (c) Some moderns: the planet with the lesser longitude wins.
3. Effect: Shadbala yuddha bala transfers the difference to the victor (BPHS 27.20, V). The loser's significations suffer.

## 5. Interpretation rules
- [TEXT] A combust planet loses half its longevity contribution (Venus and Saturn excepted; BPHS 43, V). It is in Kopa (anger) avastha (45.7-10, V).
- [COMM] Combust planets fail to protect their houses and karakatva. Mercury is commonly excepted because it is so often near the Sun [MODERN, widely stated].
- [TEXT/COMM] A retrograde planet is strong (cheshta) (BPHS 27, R). Saravali and Phaladeepika say a vakra planet gives results as if exalted (R).
- [TEXT] The defeated planet in war gives poor results for the things it rules (BS 17, V for mundane matters). Hora texts transfer this to the natal chart [COMM].
- [MODERN] SJC: a retrograde planet "looks back", re-doing matters of the previous sign. K.N. Rao: retrogression gives unusual and delayed results.

## 6. Variants and disputes
- **Combustion orbs**: SS kalamsa vs flat 8-10° vs Tajika's 6° rule. Some use the Sun's disc ± a few degrees for "deep" combustion. Cazimi (heart of the Sun, within 17′) is Perso-Arabic and not Parashari.
- **Combustion in a different sign**: some cancel it if the planet and the Sun are in different signs [MODERN].
- **War winner**: brightness (BS), north latitude (Uttara Kalamrita, SS), or longitude.
- **Sun and Moon in war**: excluded by most (SS); the Sun is handled via combustion.
- **Retrograde + exalted/debilitated reversal**: a disputed commentarial rule.

## 7. Worked micro-example
Mars at 14°20′ Gemini and Mercury at 14°55′ Gemini are 35′ apart, so they are at war.
- If Mercury has the greater northern latitude, Mercury wins (Uttara Kalamrita).
- Under the BS brightness rule, Mars at opposition-brightness could win instead.

The engine should send both participants, the separation, both latitudes, the magnitudes, the winner under each rule, and the rule used by default.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `charts.planets_in_combustion` and `planets_in_retrograde`;
  - the avasthas export `proximity_audit` (Sun distance, combustion and cazimi zones);
  - `strength._yuddha_bala`.
- **Engine additions**:
  - a `graha_yuddha` block: pairs within 1°, separation, latitudes, magnitudes, the winner under the north-latitude rule, the winner under the brightness rule, and the default rule (a function-name search found only `_yuddha_bala`; confirm before building);
  - the combustion orb table and source in the output;
  - a `combust_same_sign` flag;
  - a `stationary` flag (speed near 0).
- **Board use**: planet cards (Self), lord cards (Love and Work). This is a modifier after dignity.
- **Pitfall**: never say "burnt" or "defeated" to users. Phrase it as "overshadowed" or "contested".

## 9. Open questions
- Which war-winner rule should be the product default?
- Does the engine's combustion function use the SS kalamsa table, including the retrograde values for Mercury and Venus?
