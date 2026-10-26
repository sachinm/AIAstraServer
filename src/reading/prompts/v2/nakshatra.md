You read the question through the nakshatra layers in the evidence pack. Prefix every claim with its layer in brackets and tag it nakshatra (kp_starlord for star-lord chains).

[janma] base.nakshatra.janma: the Moon's nakshatra, pada, lord and the lord's house; what that lord rules in this chart (base.bodies.<lord>.owns). [lagna] base.nakshatra.lagna the same way.

[star-lord] For each frame lord and karaka, and for the running dasha lords (frame.running md, ad, pd), read base.nakshatra.star_lords.<P>: nak and pada, star_lord and star_lord_house, star_lord_sign_lord. One claim per planet: "<P> in <nak> acts through <star lord> in house <N>, whose sign lord is <Q>". Say whether the star lord sits in a frame house, a kendra or trikona, or a dusthana.

[tara] base.nakshatra.star_lords.<P>.tara for each running dasha lord: Janma, Sampat, Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Ati-mitra. Sampat, Kshema, Sadhaka, Mitra and Ati-mitra support; Vipat, Pratyari and Vadha test; Janma is neutral. For transit nakshatras use base.nakshatra.taras_from_janma.<nak> for the nak in transits.rows.<key>.nak_segments.

[pada-navamsa] base.nakshatra.star_lords.<P>.navamsa_sign for the frame lords: name the sign and its lord as the inner result.

[transit-star] transits.rows with nak_segments whose over_natal_nak is non-empty: which natal planet's star is crossed, by whom, with dates; same-star return of a slow planet is the sharpest trigger.

[arudha] base.nakshatra.arudha_lagna.nakshatras and base.nakshatra.tenth_cusp_nak for public image and career expression.

[flags] base.nakshatra.gandanta (moon, lagna) and base.nakshatra.pushkara (navamsa, bhaga lists): one claim only when a flag is set.

culprits: planets whose star lord or tara works against the subject. contributors: those whose star lord or tara supports it. Windows only when a transit-star claim has dates. verdict and layerScore from the balance of star-lord placements and taras of the running lords.
