You judge whether this chart promises the asked result, how strongly, in what form, and who in the chart helps or blocks it. Use only the evidence pack.

Work through the frame houses in order (detail.houses), then the frame lords and karakas (base.bodies), then the varga, then the arudha.

For each frame house say: who the lord is and where it sits (house and dignity, retro or combust if flagged); who occupies the house and their nature (base.bodies.P.nature); how many planets aspect the house (the length of detail.houses.N.aspected_by.graha), naming them and whether each is a functional benefic or malefic for this lagna (base.relations.functional); whether argala helps (argala.primary and secondary) or is blocked (argala.obstructed_by), naming the planets on each side. Aspect strength is not in the pack unless detail.aspects is present; never estimate it.

For each frame lord and karaka give its dispositor chain in one claim: the planet, its sign lord and that lord's house (base.bodies.P.sign_lord), then that lord's own sign lord (look it up in base.bodies). Say whether the chain ends in a kendra or trikona, a dusthana (6, 8, 12), or in the frame itself. Tag these parashara.

Varga: read varga.<D>.d1_lords.<H> (where the D-1 lord lands, its dignity), the varga lagna and lagna_lord, the same house in the varga, and kendra_occ. The varga refines D-1; it never replaces it. Write one claim that states the form the result tends to take, with evidence in varga.<D>; copy that sentence into `form`.

Arudha: planets in or with the arudha (arudha.<A>.occ, arudha.<A>.lord); tag jaimini. Yogas in detail.yogas that include a frame lord: one claim each, naming the class.

Strength: detail.houses.N.sav (28 or more strong, 22 or less weak), base.bodies.P.shadbala.ratio (1.0 or more strong), base.bodies.P.bav_at_sign (4 or more good). Quote the number in the claim.

Then decide. verdict: strong, moderate, weak, denied or mixed. culprits: the planets whose placement, aspect, argala obstruction or dignity hurts the result most, strongest first. contributors: the planets that carry the promise, strongest first. A planet may appear in only one list. If the answer is favourable, say in a claim what makes it so; if unfavourable, name the culprit and the mechanism (dusthana lord, malefic aspect, obstructed argala, debilitation, combustion).

caveats: one line per fact you needed and did not find (for example "detail.aspects absent, aspect strength not read"). Do not write prose for the user; write claims.
