# 14. Mapping Rath's methods onto the existing techniques

Each row takes one Rath method from files 01-13 and says what the product already does with it. Technique ids are
verbatim from the inventory table (`research_notes/Sanjay Rath methods and precedence/existing_techniques_inventory.md`
§1, generated from `src/techniques/catalog.ts`, 142 rows, all `built`); doubtful ids were spot-checked in `catalog.ts`.
Ids that exist only in docs (`docs/techniques/`) are named in plain text as "planned in docs", never as techniques.
Engine capabilities are taken from inventory §3 (engine `release-candidate-staging` b902bea).

**Verdicts.**
- **Covered:** an existing technique already does it; at most a label changes.
- **Extend existing:** a named technique changes, and every input it needs is already exported by the calculation engine.
- **New technique:** no technique does it, and its inputs are already exported.
- **Needs engine capability:** it cannot run until the calculation engine exports something new. Anything computational
  is an engine addition; Node computes nothing astrological, not even a lookup or a house count (CLAUDE.md).
- **Do not adopt:** not to be built, either because the source is too thin or because it is a sensitive rule waiting on
  the product owner's decision (marked "owner decision pending"; see [15](15-sensitive-rules-and-gaps.md)).

Tiers: [A] Rath's own text · [B] students and SJC teachers · [C] third party · [Inferred].

## 1. Procedure and precedence (file 02)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 1 | Ten house factors per house, the matter's varga checked last | [A] | `general.promise`, `general.reader`, `self.promise`, `love.promise` | Extend existing | State the ten factors as the step order of the promise rows (house, lord, dispositor, arudhas, karakas, yogas, argala, then varga) and label the order as Rath's printed list | Exported: house cards, arudhas, argala, yogas, vargas |
| 2 | Analysis order: varga, house, reference point, house or arudha, influences, standard results | [B] Rao | `general.reader`, `general.promise` | Extend existing | Use as the reader's fixed pipeline, labelled as the Rath school order printed by his student, not Rath's own | Exported |
| 3 | Reference point chosen by the question (lagna true self, Moon mind, Sun vitality, AL perception and status, paka lagna body, karakamsa inner self, GL power, HL wealth, Sree Lagna prosperity) | [B]; pieces [A] | `general.jaimini`, `self.reading.lagna`, `work.reading.standing` | Extend existing | Read each matter from its reference; no ranking of lagnas (none stated) | Exported: house counts per varga (house_from_house, house_from_planet, house_from_arudha_lagna; engine house_counts export); the paka lagna is the stored house of the lagna lord |
| 4 | A house from its karaka weighs more when the karaka is stronger than the lagna (3rd from Mars, 4th from Moon, 9th from Sun, 5th from Jupiter, 7th from Venus) | [B] | `general.reader` | Needs engine capability | Add karaka-reference reading to the reader | A strength comparison of karaka against lagna, and houses counted from a planet |
| 5 | Graha drishti is desire and temporary; rasi drishti is knowledge and lasting; Rao: rasi small, graha concrete, argala decides | [A], [B] | `love.protection`, `self.protection`, `general.reader` | Extend existing | Read rasi drishti for lasting links, graha drishti for active influence; neither overrides the other | Exported: aspects (graha and rasi) |
| 6 | Argala: more planets wins, then dignity or aspect; a tie is bandhana; malefics in the 3rd cannot be obstructed; secondary argala from the 5th and 8th; special 7th | [A] | `love.protection`, `self.protection` | Needs engine capability | The layers use primary argala only | Secondary argala (5th/8th, obstructed by 9th/6th), 3rd-house malefic and 7th special argala, a bandhana flag; absent (inventory §3.3, §4 item 18) |
| 7 | Three karaka classes are not mixed: natural for general results, chara for people and attainment, sthira for relatives' deaths | [B] | `general.jaimini` | Extend existing | State the rule in the Jaimini reader; the sthira use stays out (owner decision pending) | Exported: chara and natural karakas |
| 8 | Strength tie-break orders for signs, for Scorpio and Aquarius co-lords, and for Rudra | [B] Rao; Rath cites Jaimini, says sources differ | `research.technical_verifier` | Needs engine capability | Check that the engine's Narayana and arudha strength order matches; no technique change | An engine report of which rule decided each comparison |
| 9 | Badhaka by sign type, applied from any house, the AL and the paka lagna | [A], [B] | `work.security_grade`, `work.reading.purview` | Needs engine capability | Lagna badhaka is read today; add badhaka from the AL and paka lagna to the career screen | Exported from lagna (reading tables); from AL and paka lagna: absent |
| 10 | Maraka houses and lords | [B] **[Sensitive]** | none | Do not adopt | Owner decision pending | Exported (benefic_malefic gives maraka lords) |
| 11 | Functional nature from the lagna; a yogada (planet linked to lagna and HL or GL) gives luck whatever its functional nature | [B]; yogada [A] | `general.strength_yoga`, `work.reading.gain` | Needs engine capability | Functional nature is read today; add the yogada override | A yogada flag per planet (lagna and HL, lagna and GL) |
| 12 | Planets 6/8/12 from the dasha lord act inimically | [A] | `work.reading.purview`, `love.reading.purview` | Covered | Already reads MD-AD 6/8 and 2/12 | Exported: dasha charter flags |
| 13 | Varga confirms or overrides the D1: D7 has the final say on children; raja yoga confirmed in D5 and D10 | [A] | `general.varga_dynamics`, `work.d10_check`, `love.varga` | Extend existing | Add D5 to the raja-yoga check; let the D7 decide on children over the D1 | Exported: D5, D7, D10 |
| 14 | Yogas in the 2nd or 4th act early; a raja yoga in the lagna acts late | [A] | `general.strength_yoga`, `self.reading.yogas` | Extend existing | Add the house-timing note to each yoga row | Exported: yogas with houses |

## 2. Jaimini apparatus (file 03)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 15 | Eight chara karakas, AK the most advanced (Rahu from the end of his sign) | [A] scheme; [B] selection | `general.jaimini`, `digest.build` | Covered | — | Exported: charakaraka |
| 16 | Karakamsa read as a lagna (houses from it, 12th for liberation, 10th for vocation); karakamsa as Aries of a natural zodiac | [A] | `self.reading.atma`, `work.reading.vocation`; general.jaimini_karakamsha is planned in docs only | Extend existing | Karakamsa sign is already read; add the houses counted from it | Exported: karakamsa sign; D9 house counts from the AK (house_from_planet, varga 9). Inventory §4 item 15 overstates the gap |
| 17 | AK as the soul's lesson by planet; retrograde and combust AK; AK dasa brings suffering, Narayana dasa of its sign achievement | [A] | `self.reading.atma`, `self.character_arc` | Extend existing | Add the per-planet lesson and AK dasa notes to the atma panel | Exported: charakaraka, dignities (retrograde, combust) |
| 18 | Count from the AK to the navamsa lagna; that house's results predominate | [A] | `self.reading.atma` | Extend existing | Add as a fact line | Exported: D9 house counts (house_from_house from the AK's D9 house) |
| 19 | Arudha padas (AL, UL, A7, A10, A4, A6) and graha arudhas | [A] | `work.reading.standing`, `love.reading.bond`, `love.reading.partner` | Covered | — | Exported: arudhas |
| 20 | Houses from the AL: 3rd and 11th siblings, 2nd/11th/12th wealth, 10th status; AL and A7 not 2/12 or 6/8 | [A], [B] | `work.reading.standing`, `work.reading.gain`, `love.reading.bond` | Extend existing | Read the matter from the AL frame, and the AL-A7 distance | Exported: house counts per varga (house_from_house, house_from_planet, house_from_arudha_lagna; engine house_counts export) |
| 21 | Hora, Ghati, Sree, Indu and Pranapada lagnas | [A], [B] | `work.subarea_windows` (GL lord only), `work.reading.gain` | Extend existing | Read HL for wealth and GL for power in the Work panels | Exported: special lagnas |
| 22 | Varnada lagna for community standing | [A] | `self.reading.lagna`, `work.reading.standing` | Extend existing | Add Varnada as a standing reference | Exported: VNL |
| 23 | Parivritti varga lagnas (D9 rotated to bhagya, jaya and other lagnas) | [A], one article | none | Do not adopt | One article, no worked rules | — |
| 24 | "Functional arudha": an occupied 7th from the AL takes the AL's role | [Inferred], one case | none | Do not adopt | The page states no rule | — |

## 3. Dasha selection and ranking (file 04)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 25 | Vimshottari seed: *Crux* stronger of lagna and Moon; srath.com strongest of lagna, Moon and Utpanna stars; Moon when in doubt | [A], two texts disagree | `general.dasha`, `work.reading.clock`, `self.sub.clock` | Needs engine capability | Owner picks the text first; the clock then reads the seeded Vimshottari | A Vimshottari seed option (lagna, Moon, Utpanna) with the strength test; dasha exports take no seed today |
| 26 | Tara dasa replaces Vimshottari when four or more planets are in kendras from the lagna | [A] | `work.reading.clock`, `love.reading.clock`, `self.sub.clock` | Needs engine capability | The clock picks Tara when the condition holds | The Tara condition in dasha.applicable (tara is served; the condition flag is not confirmed) |
| 27 | Conditional dashas only when their condition holds, Vimshottari otherwise; PVR's controlling-planet tiebreak | [A]; tiebreak [B] | `work.conditional_family`, `work.reading.clock` | Extend existing | Label the tiebreak as PVR's; the clock's "first conditional present" has no stated Rath basis | Exported: dasha.applicable |
| 28 | Narayana for environment and events, Vimshottari for mind; complementary, not ranked | [A] | `work.present_tone`, `love.activation`, `self.activation` | Covered | Both already vote as separate families | Exported |
| 29 | An event is firm when the rasi dasha and Vimshottari both point at its significators | [Inferred] from [A] | `life.timing_agreement`, `reading.concordance`, `work.present_tone` | Covered | Label as an inference, not Rath's rule | Exported |
| 30 | Sudasa for prosperity, from the Sree Lagna | [A] role; [B] calculation | `work.reading.gain`, `work.subarea_windows` | Extend existing | Read Sudasa for wealth and salary windows (doc 43 marks it secondary; no function reads it) | Exported: Sudasa (served, unread) |
| 31 | Shoola and other ayur dashas for health and longevity | [A] **[Sensitive]** | none | Do not adopt | Owner decision pending | Exported (shoola, served) |
| 32 | Drig dasa for spirituality, read before the D20 Narayana | [A] | `self.reading.atma` | Extend existing | Add Drig as the timing clock for the spiritual line | Exported: drig (served, unread) |
| 33 | Narayana cast inside a varga: D10 career, D4 residence from the D4 sign of the D1 4th lord, D24 study abroad, D7 children; Paryaya for D6, Manduka for D11 | [A] | `work.present_tone`, `self.activation` | Needs engine capability | Each area's sign clock runs on its own varga | Dasha cast on a varga or from a seed sign; dasha exports take no varga or seed (inventory §4 item 16) |
| 34 | Mula dasa for curses and past karma | [A] **[Sensitive]** | none | Do not adopt | Owner decision pending | Exported (moola, served) |
| 35 | Chara dasa is the movable-lagna form of Narayana | [A] | `love.activation`, `self.activation` | Covered | — | Exported: chara |
| 36 | Yogini, Kalachakra, Tithi Ashtottari: no Rath rule text (Tithi Ashtottari appears in his book's contents only) | none [A] | `work.present_tone` (short clocks), `work.character_arc` | Extend existing | Label the short clocks as not Rath-sourced in any reading that cites Rath | Exported |

## 4. Timing, transits, annual charts, prashna (file 05)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 37 | Transits: no general Rath doctrine found (reference point, vedha, ashtakavarga, sade sati, double transit) | none | `self.transit`, `love.transit`, `general.transit` | Covered | No Rath-specific change; do not cite Rath for transit rules | — |
| 38 | Jupiter progresses one sign a year (auspicious), Saturn one sign per 2.5 years (inauspicious), for marriage timing | [A] | `love.relationship_arc` | Needs engine capability | Add as a year-selector for marriage windows | A progression export |
| 39 | Sudarshana chakra used as a year selector in examples; rules not found | [A] examples only | `general.transit`; general.sudarshana_chakra is planned in docs only | Needs engine capability | Hold until rules are found | Sudarshana is in the engine library but not exported (inventory §3.2) |
| 40 | Tithi Pravesha cast: Sun in its natal sign, Moon at the birth angle, for the birthplace | [A] co-credited | `self.annual`, `love.annual`, `work.annual_family`, `digest.annual_set` | Covered | — | Exported: annual.tithi_pravesha |
| 41 | TP year lord: weekday lord (Poddar) or hora lord (Rao, snippet); product decided weekday lord on 2026-11-09 | [B], conflict | `work.annual_family`, `self.sub.year`, `self.character_arc` | Needs engine capability | Read the year lord once the export names it; the digest must set it on TP rows (filed in TODOS) | TP year lord; doc 80 R1 |
| 42 | Natal chart overrides the TP chart; the TP chart is not read alone | [B] Poddar | `self.annual`, `love.annual` | Covered | Already "confirms or contradicts" only | Exported |
| 43 | Dasha inside the TP year: Tithi Ashtottari (unpinned claim) against a Moon-started Vimshottari in the 2008 example | conflict | `work.reading.year`, `love.reading.year` | Covered | Flag the conflict; no change | Exported: annual.tithi_pravesha_dasha |
| 44 | Narayana dasa pravesh chart cast at the birthday | [A] | none | New technique | Low priority; read the year chart that opens each Narayana period | Exported: annual.varsha |
| 45 | Prashna for a horary question | [A] service; [B] Larsen | `general.prashna` | Covered | — | Exported: prashna |
| 46 | Prashna to rebuild a lost birth chart | [A] | none | Needs engine capability | A reconstruction path for people with no birth time | Candidate lagna and navamsa lagna from a prashna chart; not exported |

## 5. Vargas and life areas (files 06-10)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 47 | One varga per matter (D3 siblings, D4 property, D7 children, D9 spouse, D10 career, D12 parents, D16 vehicles, D20 spirit, D24 learning, D30 evils) | [A], [B] | `general.varga_dynamics`, `self.varga`, `love.varga`, `work.d10_check` | Covered | Check which vargas are actually stored per kundli (inventory §4 item 8) | Exported: 23 vargas |
| 48 | Karya bhava and karyesha in a varga; argala on each karyesha decides which role thrives | [A] | `general.varga_dynamics` | Extend existing | Name the karyesha per varga and read its argala | Exported: argala per varga |
| 49 | Exaltation or debilitation in the D10 shows success, against ordinary dignity logic | [A] | `work.d10_check` | Extend existing | Add the D10 dignity rule | Exported: dignities per varga |
| 50 | A relative read from the varga: the lord's sign as that person's lagna, counted by the varga lagna's parity | [B] | `general.person` | Needs engine capability | Read relatives by Rao's method | Parity-directed house counts from a chosen sign |
| 51 | Self: Rasi and D9 lagna blended, D9 dominant; lagna lord's house; paka lagna; nakshatra lord for mind, sign lord for body | [A] | `self.reading.lagna`, `self.character_arc`, `self.reading.mind` | Extend existing | Give the D9 lagna first-class weight in temperament | Exported: D9, dignities, nakshatras |
| 52 | Career: 10th, then AL and A10, then the D10 decides; service against business | [A] | `work.reading.vocation`, `work.reading.standing`, `work.d10_check` | Extend existing | Add the service-or-business test and D10 as decider | Exported, including the AL frame |
| 53 | Wealth: 2nd, 11th and 12th from the AL; HL; Sudasa | [A] | `work.reading.gain` | Extend existing | Add HL, Sudasa and the 2nd, 11th and 12th from the AL | Exported: HL, Sudasa, AL house counts |
| 54 | Education: 4th schooling, 5th knowledge, 9th higher study, all confirmed in the D24 | [A] | none (Clarify bucket education exists) | New technique | An education reading for the education bucket | Exported: D24 |
| 55 | Spirituality: Ishta devata from the 12th of the karakamsa, D20 confirms | [A] | `self.reading.atma` | Extend existing | A fact line only; no deity or worship advice until the remedy decision (row 69) | Exported: D9 house counts (row 16) |
| 56 | Property and vehicles: 4th and its karakas, A4 from the AL, D4, D16; moves timed by a D4 Narayana | [A] | none (Clarify bucket property_vehicles) | New technique | A property reading; timing waits on row 33 | Exported: D4, D16, A4 |
| 57 | Foreign residence: 12th with 7th and 9th, Venus and the 12th lord strong; Jalapatha and Paradesa sahams in doubt | [A] | none | Needs engine capability | Hold until the saham formulas are found | Natal Jalapatha and Paradesa sahams (formulas not retrieved) |
| 58 | Enemies and litigation: 3rd and 6th from the AL against 3rd and 6th from the A6; D6 | [A] | none (Clarify bucket foreign_legal) | New technique | A disputes reading, only when the person opens the topic | Exported: house counts per varga (house_from_house, house_from_planet, house_from_arudha_lagna; engine house_counts export); arudhas (A6) |
| 59 | Love before marriage: 5th, Venus, D9; partners from the A7; affairs from the 2nd and 7th from the UL | [A] | `love.reading.heart`, `love.reading.partner`, `love.meet` | Extend existing | Add the A7 partner line | Exported: arudhas |
| 60 | Marriage: Venus and UL lead, the 2nd from UL, A7, DK confirms, D9; Narayana called more accurate in Charts 71-79 | [A] | `love.promise`, `love.reading.bond`, `love.relationship_arc` | Covered | Already reads UL, A7, DK and D9 | Exported |
| 61 | Children: 5th and Jupiter; capacity first; D7 has the final say; count and sex from the D7 5th and 7th lords; timing by Vimshottari on the D7 lagna lord with a Narayana double check | [A]; parts **[Sensitive]** | `love.reading.circle` | Extend existing | Non-sensitive count, sex and order only, and only for a confirmed adult reader; loss and denial rules wait on the owner | Exported: D7. The Narayana check needs row 33 |
| 62 | Parents: 4th and 9th, karakas, A4, D12 | [A]; death rules **[Sensitive]** | `general.person` | Extend existing | Non-sensitive parts only | Exported: D12, A4 |
| 63 | Siblings: 3rd and 11th from lagna and AL, D3, frog-jump order | [A] | `general.person` | Needs engine capability | Read count and order | AL frame exported (row 20); the frog-jump (Manduka) sibling sequence in the D3 is not |
| 64 | Health: D6 and D30, A6, longevity houses first | [A] **[Sensitive]** | `self.reading.body`, `self.sub.body_facts` | Do not adopt | Facts-only rows stay; Rath's health method waits on the owner | — |
| 65 | Fortune: the 9th lord, the 9th from the AL | [A] | `self.promise` | Covered | House 9 already in the Self frame | Exported |

## 6. Yogas, afflictions, protections, remedies (file 11)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 66 | A yoga is tested: cancellers, strength, varga confirmation (D5/D10, D9 via AK), AL-A7 relation; yogas given in Rahu dasa do not last | [A] steps 1, 2, 4, 6; [B] 3, 5 | `general.strength_yoga`, `self.reading.yogas` | Extend existing | Add the varga confirmation and the Rahu-dasa note; label the order as assembled | Exported: yogas, vargas |
| 67 | Affliction order (assembled): functional nature, occupants, argala, papakartari, badhaka, dusthana, nodes, dasa | [Inferred] | `love.affliction`, `self.affliction` | Needs engine capability | Add papakartari and argala obstruction | A papakartari flag per house and lord (not in inventory §3) |
| 68 | Protection is obstruction of malefic argala, benefic argala, and the AK's placement; no Rath rule that Jupiter's aspect protects | [A], [B] | `love.protection`, `self.protection` | Extend existing | Stop citing Rath for the Jupiter-aspect step; add obstruction of malefic argala | Exported: argala (primary) |
| 69 | Remedies: gems only for functional benefics, deity of the varga lagna lord, no loose mantras | [B]; cautions [A] | none | Do not adopt | Owner decision pending on any remedy | — |
| 70 | Curses and black-magic placements | [A], [B] **[Sensitive]** | none | Do not adopt | Owner decision pending | — |

## 7. Verification and questions (files 12-13)

| # | Rath method | Tier | Existing technique id(s) | Verdict | What change | Engine inputs needed |
|---|---|---|---|---|---|---|
| 71 | Confirm the past aloud before predicting | [A] | `self.reading.diagnosis`, `self.v2.hero`, `self.v3.cards`, `life.dashboard` | Extend existing | Give Life, Love and Work a confirm route, and write dated answers to the ledger (filed in TODOS) | — |
| 72 | Event-led rectification: rising sign by appearance, then D3 by siblings, D9 by spouse, D7 by children | [A] | `research.technical_verifier` | Needs engine capability | A rectification technique that asks only discriminating questions | Candidate D3, D9, D7 and D10 lagnas across a time window, with the sign-change times |
| 73 | Kunda and the vighati sex check as fine tuning | [A]; PVR rejects Kunda [B] | none | Do not adopt | At most a weak tiebreak; never a decider | — |
| 74 | No fine sub-periods or D60 on an unrectified time | [B] | `work.d10_check`, `self.sub.periods` | Extend existing | Gate D60 and level-3+ periods on a birth-time source fact (filed in TODOS) | — |
| 75 | The client leads the topics; detailed past study first | [A] | `general.clarify`, `general.intake` | Covered | Clarify already lets the person pick the area | — |

## 8. Counts

75 rows: Covered 15 · Extend existing 30 · New technique 4 · Needs engine capability 17 · Do not adopt 9. Of the nine
"Do not adopt", five are sensitive rules with the owner's decision pending (rows 10, 31, 34, 64, 70), one is the remedy
decision (row 69), and three are thin or rejected sources (rows 23, 24, 73).

How the engine verdicts were checked (2026-11-18, read-only, engine deployed branch b902bea): the house-counts export
gives counts from any house, any planet and the AL in each varga, so the reference-frame rows (3, 16, 18, 20, 55, 58)
are not engine gaps. A grep of the export sources found no papakartari (row 67), no Jalapatha or Paradesa saham (row
57), no yogada flag (row 11), and no Tara condition in the conditional-dasha list (row 26). Rows 6, 33, 39 and 41 rest on
the inventory's own checks. Rows 4, 8, 9, 38, 46, 50, 63 and 72 were not checked in code beyond the inventory and are
unverified engine gaps.

## 9. Top 10 recommended changes, in order

1. **Close the confirmation loop** (row 71). One confirm route for Life, Love and Work; every dated answer becomes a
   `life_events` row. Needed before any Rath-style verification and for measuring accuracy (AGENTS.md rule 4).
2. **Record where the birth time came from** (row 74). A fact key asked once (record, family memory, estimate), read by
   `work.d10_check` and any fine-period gate. No engine work.
3. **Ask the owner which Vimshottari seed text to follow, then add the seed option to the engine** (rows 25-26), with
   the Tara condition.
4. **Read the reference frames the engine already exports** (rows 3, 16, 18, 20, 52, 53, 58): house counts per varga
   from any house, any planet and the AL. Unlocks the most Rath rows at once with no engine work.
5. **Dasha cast on a varga or from a seed sign** (row 33). Unlocks varga Narayana for career, residence, study abroad
   and children.
6. **TP year lord in the engine export and on TP digest rows** (row 41; doc 80 R1 and the 2026-11-18 TODOS line).
7. **Full argala** (rows 6, 67, 68): secondary and 3rd-house argala, bandhana and papakartari flags.
8. **Read Sudasa and HL in `work.reading.gain`** (rows 21, 30, 53). Inputs already exported.
9. **Relabel non-Rath sources** (rows 36, 68): short clocks and the Jupiter-aspect protection step must not be cited as
   Rath. Text only.
10. **Rectification technique** (row 72), after items 1, 2 and 4, asking only questions that separate the remaining
    candidate varga lagnas.

## 10. One recommendation: what to do first

Build the confirmation loop first (item 1, with item 2 folded in): one confirm endpoint per board that stores the answer
once in `person_facts`, writes the dated event to `life_events`, and a birth-time source key in `FACT_CATALOG`. It needs
no engine work and no new astrology, it is what Rath does before every forecast (confirm the past aloud), and every
later Rath item (rectification, seeded dashas, varga Narayana) needs confirmed past events to be checked against.
