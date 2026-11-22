# 13 · Helpers, disruptors and waiting strength: who is on the person's side, what throws them, and what is waiting for its turn

Written 2026-11-22 from Sachin's instruction of that day. A technique for every card on every dashboard; no code is
changed by this document. It is built in doc 11 phases 3 and 4 and makes no paid call until paid runs are allowed.
Sources: a read-only check of the engine (release-candidate-staging `b902bea`), the server (`develop`) and the research
folders. Tags as in doc 12: **Text** (classical verse) · **Rath** · **Student** · **Modern** · **Ours** · **Gap** (no
rule in the research).

## 1. What Sachin asked for

The Oracle **finds**, and the Personalizer **puts first, in words anyone can follow**, for this person: by birth,
after a certain age, and inside the running maha dasha:

1. **Helpers.** The planet, nakshatra or sign that protects, saves, softens a hard blow or blow-back; the guiding light,
   mentor, teacher or coach; the shining star and the lucky star; what brings fortune; what wins friends; what wins
   over enemies.
2. **Disruptors.** The planet or combination that makes the person lose their calm or focus, gamble and lose, break a
   marriage, an agreement or a promise.
3. **Waiting strength.** Planets that are weak, eclipsed, clouded, combust or overpowered during the running maha
   dasha but would deliver when supported or when their own sub-period comes; which placements and dispositor
   placements are good for the person; which are benefic but overpowered, which malefic; neecha bhanga, viparita raja
   yoga, vargottama and the like.

"Really important" (his words): these three sections are required on every card, not optional colour.

## 2. How each role is found (the rules the Oracle is given)

The Oracle is given the rule, its tag and the engine fields; **the model judges, Node computes nothing.**

**Roles with no rule in the research (changed 2026-11-22 on Sachin's question).** Rev 1 said "read from the house
meaning, labelled, never dated". What was wrong with that: a role that is never dated cannot be acted on, so the card
would say "watch your word" with no when; and the reading would treat a role differently from every other matter for
no astrological reason, because classical timing works the same way for any matter (the period of a house's lord, of
its occupants and of its significator gives that house's results; BPHS on dasha results). The fix:

1. Each such role is mapped to its houses, lords and significators (the mapping table in §2.2; the mapping is **Ours**
   and labelled so).
2. It is then judged and dated **exactly like any other matter**: the promise in the birth chart, the pair of doc 12
   confirming, the year chart placing, transit triggering. A dated statement carries the same status words as any
   other (confirmed, leaning, open).
3. A targeted research pass (`docs/deep-research/roles/`) looks for a sourced rule for each mapped role; a sourced rule
   replaces the mapping when found.

### 2.1 Helpers

| Role | Rule | Tag | Research |
|---|---|---|---|
| Protector | The 9th house and its lord protect; their argala on the 8th prevents calamity | Rath | `sanjay-rath/07` L81; `11` L119 |
| Protector | Malefic argala obstructed; benefic argala; the Atmakaraka's placement | Rath; Student (Rao 10.6) | `11` L103-114 |
| Protector | Misfortune cancelled by a strong Jupiter in a kendra, benefics in kendras, a strong lagna lord | Text (Brihat Jataka 6, BPHS 10) | `natal-techniques/18` L27-34 |
| Softens a blow at the start of a period | A benefic-aspected or dignified planet at the dasha's start nullifies its evils ("antidotes") | Text (Saravali 44.1-3) | `dasha-results/dasha-lord-condition-principles.md` L46 |
| Mentor, teacher, coach | The Bhratrikaraka is the teacher; the 9th house and Jupiter are the guru | Rath; Text (house table) | `07` L111, L123; `natal-techniques/02` L29 |
| Lucky star | The yogada planet (linked to the lagna and the wealth and power lagnas) brings luck whatever its nature | Rath; Student | `11` L32 |
| Lucky star | The supportive taras from the birth star: Sampat, Kshema, Sadhaka, Mitra, Parama Mitra | Text (BPHS 46.208, for Tara dasha); Modern for natal use | `dashas-other-and-annual/tara-dasha.md` L57; `natal-techniques/23` L40-42 |
| Fortune | The yogakaraka, and sub-periods of planets related to it, bring prosperity | Text (Laghu Parashari, PD 20.48-49) | `functional-nature-laghu-parashari.md` L68 |
| Wins friends | The 11th house; the 7th arudha in a kendra, trikona or upachaya from the lagna gives friendship, in the 6th, 8th or 12th enmity; the 4th arudha in the 3rd or 11th from the arudha lagna is friendly | Text (house table); Text (Jaimini Upadesa); Rath | `natal-techniques/02` L26; `jaimini-apparatus/arudha-padas.md` L44; `09` L177 |
| Wins over enemies | The 6th house is enemies; Harsha viparita yoga "wins over enemies" | Text (house table; Phaladeepika 6) | `02` L31; `natal-techniques/19` L25 |
| **Not a rule** | Jupiter's aspect, or a benefic squeeze (shubha kartari), as a general shield | **Gap**: "No Rath or SJC rule". Never cited as protection | `11` L126; `14` L116 |

### 2.2 Disruptors

| Role | Rule | Tag | Research |
|---|---|---|---|
| Loses calm | Kemadruma (the Moon alone) gives unhappiness, cancelled by named supports | Text (Brihat Jataka 13.6) | `natal-techniques/15` L47, L55 |
| Loses calm or focus | Hungry and agitated states (kshudhita, kshobhita) damage the houses the planet rules | Text (BPHS 45) | `natal-techniques/10` L72-87 |
| Squeezed | A malefic squeeze (papa kartari) on a house or planet | Rath | `11` L75 |
| Gambles and loses | The 5th is speculation; Rath reads speculation as the 8th from the D10 lagna. For loss: mapped to the 5th, 8th and 12th, their lords, and Rahu | Text (signification); Rath (D10 only); **Ours** (the loss mapping) | `14-yoga-dhana.md` L6; `08` L128-133 |
| Breaks a marriage | The 2nd from the upapada sustains marriage; Rahu or malefics in the 2nd or 7th from the upapada show affairs; Venus in the 6th from the arudha lagna, separation (hedged). **Rath's denial rules are included** (Sachin's yes, 2026-11-22) | Rath | `09` L28, L65, L68, L73 |
| Breaks agreements | Mapped to the 7th (partners, contracts) and the 3rd (signatures, documents), their lords, and Mercury | **Ours** (mapping); Text (signification) | `natal-techniques/02` |
| Breaks promises | Mapped to the 2nd (speech, the word given) and the 9th (dharma), their lords, and Jupiter | **Ours** (mapping); Text (signification) | `natal-techniques/02` |
| Loses focus through Mars or Rahu | Mapped to the Moon, the 4th (peace of mind) and the 5th (judgement), and Mars or Rahu joining or aspecting them | **Ours** (mapping) | `natal-techniques/02`; `natal-techniques/10` |

Every "Ours" row is dated by the steps of §2's note, and the reading names it as a reading of the houses, not a
classical rule.

**Marriage denial (included, Sachin 2026-11-22).** The Oracle reads Rath's denial rules with their tag. The wording
follows SOUL.md and doc 09 decision 3: the Personalizer never tells a person they will not marry; it says what the
chart makes hard, for how long, and what helps, worded to the Oracle's confidence. A "denial" read is always marked
for the person's confirmation before it is stated as settled.

### 2.3 Waiting strength

| Condition | Rule | Tag | Research |
|---|---|---|---|
| Eclipsed or debilitated in a benefic sign | gives benefit in the latter half of its period | Text (Phaladeepika 20.57) | `dasha-lord-condition-principles.md` L33 |
| Vargottama | its lord's period is favourable | Text (PD 20.22) | same, L30 |
| Combust | weighed as debilitation | Text (PD 20.30) | same, L32 |
| Retrograde | good after it turns direct | Text (BPHS 50.86-87) | same, L36 |
| Debilitated in an exalted navamsa | a sudden rise | Rath | `11` L29 |
| Neecha bhanga | results in its own or the cancelling planet's period | Modern | `natal-techniques/20` L44 |
| Viparita raja yoga | its own period: trouble first, then a rise | Modern; commentary | `natal-techniques/19` L33, L37 |
| A yoga's planets | the yoga starts in the sub-periods of its planets or related planets | Text (PD 20.44, 20.54) | `yoga-fructification-in-dasha.md` L40-50 |
| **Against the premise** | a plainly weak planet's period is "futile", its results "as in dreams" | Text (Saravali 41.19, 41.74) | same, L41, L45 |

So "weak now, delivers in its own sub-period" holds for named conditions only (the rows above), and the Oracle must
name which one applies. A planet that is simply weak is read with Saravali's warning, not with a promise.

**"After a certain age" (changed 2026-11-22: dated).** The planet maturity ages (Jupiter 16, Sun 22, Moon 24, Venus
25, Mars 28, Mercury 32, Saturn 36, Rahu 42, Ketu 48) are tradition with no classical source (`planetary-maturity-ages…`
L17, L44-46). Sachin: we have the birth date, so use the dates a personal reading needs. **The engine returns each
planet's maturity date** for the person (engine request E-R7: birth date plus the table's age, the table set by an
environment variable). The Oracle states it as a date ("from March 2014") with the tag "tradition", and weighs it below
the dasha: a maturity date never raises a status by itself. Rath's "years of fortune" are cited only through a summary
and are not used until checked in print.

**"Within this maha dasha."** For each helper, disruptor and waiting planet the Oracle names when it is active inside
the running maha dasha: its own sub-period, the sub-periods of planets tied to it, and the next maha dasha if it
changes the picture. The dates come from the stored dasha rows, selected by date; nothing is computed.

### 2.4 The person: sex, age, stage of life and what we know of them (changed 2026-11-22)

Sachin: sex, age and the other facts in memory go to the Personalizer **for every reading and every question**, so
the answer fits the person's needs, emotional register and stage of life.

- **One gate for personal data: `src/reading/person/modelContext.ts`.** Every agent asks it for the person, by role;
  no prompt reads the profile directly. It decides which fields go over the wire to the model, and records on the run
  row **which fields** were sent (names, never values). Names, email, phone, exact birth place and birth time are never
  sent (the engine already used them). It is the one place to tighten when the privacy work of `docs/privacy/` lands.

  | Agent | Gets |
  |---|---|
  | Card Personalizer, card chat answers, Clarify, every answer to a question | sex; exact age and birth date; stage of life; work, relationship and family facts; dated life events; answers to confirm questions; mood; declined topics; the register they set; the companion memory facts (doc 48) |
  | Card Oracle, roles unit | sex (the rules that differ by sex); birth date and age (maturity dates, age rules); confirmed life events (to test the chart against what happened). No mood, no register |
  | Family readers, period readers, weave, lens linemen | nothing personal: they are shared per chart (doc 11 §4.5) |

- **Today** the Personalizer receives gender for voice and an age band (`person/profileLines.ts:92`); card chat
  receives part of the facts. Both move to the gate.
- **Wording.** The Personalizer writes for this person plainly, for their stage of life and the register they set,
  whether a man or a woman. It never assumes roles from sex and never prints the sex or the age.
- **Where a rule differs by sex.** The spouse significator: Rath reads Jupiter as the husband in a woman's chart (`09`
  L51, L62); PVR reads Venus for both (`naisargika-karakas.md` L32); disputed. The Oracle reads both and says which it
  leaned on. Rath rejects the gender seed for Chara dasha (`chara-dasha.md` L43-47) and so do we.

## 3. The data: what the engine gives today

All facts come from the engine. Most are already pulled for every chart; several never reach the digest the agents
read, and one is broken.

| Fact | Engine field | Reaches the agents today? | Action |
|---|---|---|---|
| Dignity, combustion, planetary war (Mars–Saturn only), retrograde, motion | `dignities` | yes (digest) | — |
| Shadbala, avasthas, dispositor chains, aspects, functional and natural benefics, badhaka, arudhas, chara karakas, star lord, argala (no net), yogas | various | yes (digest) | — |
| **Vargottama** | `facts` flags | no (facts dossier only) | pass through to the roles pack (server, selection only) |
| **Vimshopaka**, **ishta / kashta** | `strength.vimsopaka`; `facts` bodies | no | pass through |
| **Planetary friendships** (natural, temporary, compound) | `relations` | no | pass through |
| **Maraka**, **yogakaraka** | `benefic_malefic` | no | pass through |
| **Taras from the birth star** | `facts` nakshatra profile | yes, but the Node regex looks for "pratyak" while the engine says "Pratyari", so the 5th tara is never flagged | stop reading taras through Node regexes; pass the engine's names |
| **Yogi / avayogi** | charter `vector_5_yogi_avayogi` | **broken**: it reads a key the sphuta builder never returns, so it is always false | engine fix (E-R1) |
| Neecha bhanga | yogas (rules 1-3 of 5); facts (dispositor in a kendra only) | partly; no timing | engine (E-R5) |
| Eclipse closeness | node conjunctions within 8° in `proximity_audit`, no eclipse flag | no | engine (E-R2) |
| Yogada, natal sahams (Punya, Mitra, Shatru), named papa / shubha kartari, net argala | — | not computed (sahams are annual only) | engine (E-R3, E-R4) |
| Gender-aware spouse significator | — | dashas take no gender | read both (§2.4); no engine change |
| Maturity ages | — | none | folk table in the prompt, tagged (§2.3); no engine change |

**Node astrology found on the way** (filed): the protection layer still scores Jupiter's aspect +2 although doc 09
removed it as unsourced (`area/houseLayers.ts:389-436`); the dignity, cancellation, avastha and tara regexes
(`houseLayers.ts:139-150, 632-633`); vargottama recomputed in Node (`self/sub/promise.ts:94-97`). The roles unit uses
none of them: it reads the engine fields directly.

## 4. How it runs

### 4.1 The roles unit (preparation, doc 11 §4.10)

- **`reading.roles`**: one call in the chart job, beside the period readers (after the digest; it adds no time to the
  clock of doc 11 §4.4). Model `gemini-3.8-flash`, medium thinking; output ceiling 10,000, continued when cut.
- **Input:** the natal core; a **roles pack** built in code by selecting engine rows (every field of §3 that reaches
  the agents, plus the pass-throughs); the running and next maha dasha with their sub-periods for every system that
  applies (already in pass 1); the rules of §2 with their tags; the person's sex for the spouse rule only.
- **Output (schema, stored in `reading_prepared` as natal, once per chart, with a dated part keyed to the running maha
  dasha):**

  ```
  helpers[]   { role, body (planet | nakshatra | sign | house | point), why, rule_tag, evidence_keys[],
                from: 'birth' | 'age' | 'this_maha_dasha', age_folk?: number, active[]: {system, level, lord, from, to} }
  disruptors[] same shape, plus  matter: 'calm' | 'focus' | 'speculation' | 'marriage' | 'agreements' | 'promises' | other
  waiting[]   { body, condition (combust | debilitated | eclipsed | overpowered | neecha_bhanga | viparita | vargottama | retrograde | other),
                delivers_when[] {system, level, lord, from, to}, rule_tag, evidence_keys[], caution? }
  gaps[]      the roles asked for that have no rule or no data for this chart, said plainly
  ```

- **Checks in code (by key, never by words):** every item cites at least one evidence key the pack carried; every
  date is one the pack carried; every `rule_tag` is one of the tags of §2; a role with tag Gap carries no date.

### 4.2 On every card

- **Card Oracle.** Reads the roles unit and picks the items that touch its card's matter (its houses and
  significators, from the card brief). Three new fields in its object: `helpers`, `disruptors`, `waiting`, each the
  roles items it kept with one technical sentence each. Its story's verdict beat names them. The existing `gift` and
  `knot` stay and are now drawn from these.
- **Personalizer.** Opens the plain reading with them, before the rest, in three short parts the person can follow at
  a glance:
  - **On your side**: who or what helps, and when ("from your late twenties", "until March 2028").
  - **What can throw you**: what to watch, and the one thing to do when it shows.
  - **Waiting for its turn**: what is hidden now and when it comes good, with the condition ("if you keep at it",
    "once the period turns in 2028").

  No chart term, no planet name unless the person has asked for the technical view; growth-led and optimistic, never
  hiding a heavy stretch, never beyond the Oracle's confidence (doc 09 decisions 3). Folk ages and Gap roles are worded
  as "often" or not at all.
- **Web.** The Outlook tab shows the three parts at the top of the plain story; the Astrology Reading tab shows the
  technical items with their rule tags. A new served field is rendered (the served-fields test grows by three).

### 4.3 Cost and time (estimates; nothing measured, no paid call now)

- Roles unit: about 45k cached + 8k input, 2k-4k output: about $0.02 a chart, once.
- Each card: about 300-500 more output tokens for the Oracle and 200-300 for the Personalizer: about $0.003 a card
  today, about 4 more seconds of writing. Inside the 60-second wait cap of doc 11 §4.7.

## 5. Engine requests (each its own release in the engine repo)

| # | Request | Why |
|---|---|---|
| E-R1 | Fix yogi / avayogi: `vector_5_yogi_avayogi` reads `sphutas.yogi_planet`, which `_build_sphutas` never returns | the lucky planet is always false today |
| E-R2 | An eclipse flag per planet (within N° of a node, and the Sun or Moon near a node) | "eclipsed" is asked for by name |
| E-R3 | Yogada; natal sahams (Punya, Mitra, Shatru) | lucky star; friends and enemies |
| E-R4 | Named papa and shubha kartari per house and planet; net argala with the 3rd-house malefic rule | squeezed and protected, as Rath reads them |
| E-R5 | Neecha bhanga conditions 4-8 and the cancelling planet named | "delivers in its own or the canceller's period" |
| E-R6 | Planetary war for all pairs, not Mars–Saturn only | "overpowered" |
| E-R7 | Maturity date per planet from the birth date (table by environment variable, tagged tradition) | "after a certain age", as a date |

**Being built from 2026-11-22 (Sachin: "fix E-R1 first", then the engine gaps):** E-R1, then E-R2, E-R3, E-R4 and
E-R7, on the engine branch `feat/engine-roles-gaps` from `develop`, each with pytest and a new catalogue type or field,
released through the engine's release path by the deploy session. E-R5 and E-R6 follow.

Server-side pass-throughs (vargottama, vimshopaka, ishta/kashta, friendships, maraka, yogakaraka, the engine's tara
names) need no engine change: they are stored rows selected into the roles pack. Being built now on the server branch
`feat/roles-pack-person-gate`, on the preparation path only, so the live prefix and every stored reading key stay
unchanged.

## 6. Steps (inside doc 11's phases)

1. Phase 3: the roles pack (selection only) and a test that it carries no field computed in Node; the roles prompt
   with the rules of §2; the schema and its code checks; registry and catalog rows (`reading.roles`).
2. Phase 3: the Oracle and lens-recipe changes (the three fields; the verdict beat); the Personalizer's three opening
   parts; recorded fake answers for tests.
3. Phase 4: the served fields, the Outlook and Astrology Reading sections, the served-fields test.
4. Engine requests E-R1 to E-R6 filed in the engine repo's plan; E-R1 first (a bug).
5. Paid checks, on Sachin's yes only: the roles unit on the test chart and one deck, compared by hand with an
   astrologer's reading of the same chart.

## 7. Sachin's decisions (2026-11-22)

1. Roles with no rule in the research are mapped to houses (labelled Ours) and **dated like any other matter**; a
   research pass looks for sourced rules (§2).
2. Maturity ages are **dates** from the birth date, supplied by the engine (E-R7), tagged tradition (§2.3).
3. Sex, age and every fact in memory go to the Personalizer and every answer, through one gate (§2.4).
4. Rath's marriage-denial rules are **included** (§2.2).
5. E-R1 first, then the other engine gaps (§5).
