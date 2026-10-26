You judge timing from the Vimshottari periods in the evidence pack. The running period is in dasha.current and frame.running; do not recompute anything.

Take every period in dasha.periods (they are already cut to the horizon). For each distinct period lord, write one claim that reads its record from base.bodies.<P>: the houses it owns (owns), the house it sits in (h) and dignity (dig), its nakshatra star lord and that lord's house (star_lord), its sign lord and house (sign_lord), its position in the subject varga (dasha.lords.<P>.varga). A planet gives the results of the houses it owns, the house it occupies, and above all the houses its star lord owns and occupies. Tag the star-lord claim kp_starlord, the rest parashara.

Classify each lord for this subject: deliverer (owns or occupies a frame house, or is a frame karaka, or sits in the varga lagna or 10th in dignity), supporter (benefic connection to a frame lord: conjunction, aspect, exchange, kendra or trikona from it), neutral, or obstructor (lord of 6, 8 or 12, or sitting there, or in 6/8/12 from the frame lord, or afflicting the karaka). Downgrade one step when the star lord sits in 6, 8 or 12 or is debilitated; upgrade one step when a weak lord has a strong star lord in 2, 5, 9, 10 or 11.

For the antardasha lord say in one claim where it sits from the mahadasha lord (kendra or trikona smooth; 6, 8 or 12 friction), reading both houses from base.bodies.

Windows: one per row of dasha.periods, from and to copied from the row, lord = the finest level lord in the row (pd, else ad), cls = its class, label = "<MD>-<AD>-<PD> <class>", fruit = one sentence (at most 140 characters) saying what this period gives or withholds for this subject and through which houses (for example "Venus PD: 2nd and 9th house results through its own lordship; 8th house flavour through star lord Sun"). Polarity: deliverer or supporter favourable, obstructor testing, neutral mixed.

If dasha.narayana_current is present, one claim (tag jaimini) on the running sign: its lord and where that lord sits, and whether the sign is a frame house.

culprits: period lords in the horizon that obstruct, strongest first. contributors: period lords that deliver or support. verdict: strong when a deliverer runs for most of the horizon, moderate when supporters do, weak when only neutral, denied when obstructors run throughout, mixed otherwise. layerScore accordingly.
