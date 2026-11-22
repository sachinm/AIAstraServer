# 12 · Every dasha system that applies, the current and the next maha dasha, and how the systems confirm one another

Written 2026-11-21. A technique rule for every dashboard and sub-dashboard; no code is changed by this document.
Sachin's instruction: every dashboard technique reads **all the dasha systems that apply to the person**, for **the
current maha dasha and the upcoming next one**; and the research (`docs/deep-research/`, `docs/research/`) is used to
work out **how the systems confirm one another and how many are needed**.

Source tags: **Rath** (his own text) · **Student** (Rao, Poddar, PVR) · **Text** (a classical verse) · **Ours** (a
house rule we chose; no source). File numbers refer to `docs/deep-research/sanjay-rath/` unless named.

## 1. What the research says, in short

| Question | Answer | Tag |
|---|---|---|
| How does one system confirm another? | A star (nakshatra) dasha pinpoints an event; its occurrence "will require confirmation from a Rasi dasa". Narayana shows what the surroundings deliver; Vimshottari shows how the person meets it | Rath, *Crux* p. 3; *Narayana Dasa* pp. xiii–xiv (`04` §7) |
| What if the two disagree? | Rath: the disagreement is the astrologer's limited understanding, not a real conflict. No rule for resolving it | Rath, pp. 89–90 |
| **How many systems must agree?** | **No source gives a number.** Rath's "full examination" names five (Narayana, Sudasa, Vimshottari, Shoola, Drig) and he calls ranking them useless | Rath, p. xv |
| Are 40 systems 40 votes? | No. The nine conditional star dashas are alternates of Vimshottari; Chara is Narayana for a movable lagna; Lagnamsaka and Padanadhamsa are Narayana from other starting signs. Systems of one family are one voice | Rath; Text (BPHS 46); `atlas/05-clocks.md` §2 |
| Which sign dasha for which subject? | Narayana for everything, cast on the subject's divisional chart (D10 career, D9 spouse, D7 children); Sudasa for prosperity; Drig for the spiritual path | Rath, Table 29 p. 119 |
| How does the Tithi Pravesha year confirm? | No Rath rule. The birth chart overrides; the year is never read alone | Student (Poddar), `05` §2 |
| The next maha dasha | Judge the lord at birth and at the moment the dasha starts: good in both is good, one bad is mixed. Dashas tend to turn adverse in their closing sub-period | Text (BPHS 47.5–6, 48.8); Rath (Dvisaptati Sama article) |
| The junction between two maha dashas | No classical verse defines "sandhi" or "chidra". Modern usage | `dasha-results/dasha-sandhi-and-chidra.md` |

## 2. Which systems apply to a person

The engine decides, never Node: the stored `dasha.applicable` row states each conditional dasha's rule, the facts it
checked and the verdict. Checked on the test chart (2026-11-21):

| Group | Systems | Count |
|---|---|---|
| Stored | all | 42 |
| Conditional, **does not apply** (left out) | Ashtottari, Chaturashiti-sama, Dwadashottari, Panchottari, Shatabdika, Shashtihayani | 6 |
| Conditional, **not checked by the engine** (left out and named as a gap) | Shodashottari, Shat-trimsha-sama | 2 |
| **Apply** | Vimshottari, Dwisaptati-sama (its condition holds), and 32 others with no condition in BPHS (Tara among them: read, and reported as support; it does not replace Vimshottari until the engine checks Rath's condition for it) | 34 |
| …of which have a running maha dasha | all but Aayu (its stored periods have a hole from 2016 to 2027) | 33 |

Rev 2 of doc 11 read 41 systems; that was wrong by the eight above. The rule: **a system the engine marks as not
applying, or has not checked, is not read.** Today the code decides this from which family the stored rows carry, not
from the engine's verdict (`self/oracle.ts:261`); that is corrected in the build.

## 3. Voices: what counts as an independent confirmation

Every system that applies is **read** (decision of 21 Nov). Only an independent **voice** can be **counted**:

| Voice | Systems | Role | Tag |
|---|---|---|---|
| **Star voice** | Vimshottari, with the one conditional star dasha that applies (here Dwisaptati-sama). Tara in its place when the engine says its condition holds (the engine does not check this yet) | pinpoints; the person's experience | Text; Rath |
| **Sign voice** | Narayana. Chara (the same system for a movable lagna), Lagnamsaka and Padanadhamsa are read as its variants, never as extra votes | confirms; what the surroundings deliver | Rath |
| **Purpose voice** | the sign dasha Rath gives for the subject: Sudasa (money, standing, work), Drig (purpose, the spiritual path), Narayana cast on the subject's divisional chart once the engine casts it | strengthens, for its own subject only | Rath (role); Student (Sudasa calculation) |
| **Year voice** | the Tithi Pravesha year chart with its in-year dasha | places it in a year; never read alone | Student; counting it is Ours |
| Read, never counted | Yogini, Tithi Yogini, Kalachakra, Tithi Ashtottari, the karaka dashas, sign dashas with no stated purpose | reported as "also points this way" or "does not"; named as unverified | not Rath |
| Read, never named to the person | the longevity dashas (Shoola, Niryana Shoola, Sthira, Brahma, Navamsa, Aayu) and Moola, Mandooka, Paryaya | context for the Oracle only | Rath; Text |

## 4. The rule (how they confirm, and how many)

| Status | When | Wording to the person | Tag |
|---|---|---|---|
| Not promised | the birth chart does not hold the matter | never timed | Text |
| **Confirmed** | the star voice **and** the sign voice both point to the matter's significators in the periods running | stated, with dates | Rath's pair |
| Confirmed and dated to the year | the above, and the year voice points the same way | "this year" | Ours |
| Leaning | one of the two, with the purpose voice or the year voice | "the signs lean toward" | Ours |
| Open | one voice alone | what would bring it, asked | Ours |
| Contested | the star voice and the sign voice point opposite ways | both sides, no date | Rath (no real conflict: say both) |

- **How many:** two voices make a confirmation, and at most four are ever counted (star, sign, purpose, year). **The
  numbers are our house rule**: the sources give the pair and no count. Sachin can change them.
- **Everything else is support, not a vote.** The reading may say "of the 12 other systems that apply, 9 point the
  same way". That sentence never changes the status. More systems agreeing by number alone raises the chance of a
  false agreement (`reports/Vedic dasha systems…` L37).
- **Who leads the star voice.** The person's reading clock leads: their stored choice, else the conditional dasha that
  applies, else Vimshottari. That is today's code and matches Rath's practice of using a conditional dasha when its
  condition holds; BPHS never says it replaces Vimshottari, so Vimshottari is always read beside it. On the test chart
  Dwisaptati-sama leads.
- **Inside one voice**, when its members disagree (Vimshottari against the conditional dasha), the voice is "divided"
  and counts as half: with the sign voice it gives "leaning", not "confirmed". The half is a house number too (Ours).
- **At what level the rule works today.** Narayana is verified at maha dasha level only. So "confirmed" today means:
  the star voice at maha dasha **and** sub-period level, the sign voice at maha dasha level. Sub-period confirmation by
  a sign dasha waits for the engine check of Narayana's sub-periods (doc 07 E1–E2).

## 5. The current and the next maha dasha

For **each system that applies**, every dashboard technique reads:

| Part | What is read | Source of the rule |
|---|---|---|
| The running maha dasha | its lord or sign judged from the birth chart (a star dasha by its lord: owner, seat, dignity, navamsa, links; a sign dasha by the sign, its occupants and its lord); what it brings for the dashboard's subject; how far through it the person is | doc 09 §4; Text |
| Its sub-periods | all of them, with levels 3 and 4 under the running one | doc 11 §4.4 |
| Its closing stretch | the last sub-period, flagged as "closing": dashas tend to turn adverse there; the planet-by-planet notes of BPHS 47 apply | Rath's dictum; Text. Low weight |
| **The next maha dasha** | its lord or sign judged the same way from the birth chart; its start date; its first sub-period; **what changes** from the running one for the dashboard's subject | Text (BPHS 47.5–6: the lord at birth) |
| The previous maha dasha | one line, as today | — |

- **The chapter turn (Ours).** When the star voice and the sign voice both change maha dasha within 12 months of each
  other, the reading names it as a change of chapter and reads the next maha dasha at full weight. On the test chart
  all four counted voices turn inside ten months: Narayana 2027-10-15, Dwisaptati-sama 2028-02-16, Vimshottari
  2028-03-16, Sudasa 2028-08-03.
- **Not available yet:** the chart for the moment a dasha starts (the second half of BPHS 47.5–6, and the Moon at the
  start, Saravali 41). The engine does not cast it. Until it does, the next maha dasha is judged from the birth chart
  only and the reading says so. Node computes nothing here.
- **The junction** is worded as "a transition" only. No width, no extra weight (no classical basis).
- On the test chart 32 systems have a next maha dasha stored; 10 of them start within two years.

## 6. By dashboard and sub-dashboard

Step 1 of every lens is the same: **every system that applies, running and next maha dasha**, compiled by voice (§3)
and judged by the rule (§4). What differs is which significators the voices are tested against, and the purpose voice:

| Dashboard · lens | The voices are tested against | Purpose voice | Tag / gap |
|---|---|---|---|
| You · temperament, mind, body | lagna and its lord, the Moon, the 6th and 8th for the body | — (Lagnamsaka read as a Narayana variant for ideals) | Rath |
| You · purpose | the 9th and 10th, the Atmakaraka | Drig, named as unverified until the engine check | Rath |
| You · this chapter | every counted voice's maha dasha, its end date and the next lord | all | Rath; the chapter turn is Ours |
| Love · dating | the 5th, Venus, D9, A7 | — | no romance timing rule in the research; says so |
| Love · marriage | the D9 lagna and 7th lord, UL, Darakaraka | Narayana on D9 when the engine casts it; until then Narayana D1, stated | Rath |
| Love · friends, allies | the 11th from the lagna and from the AL; the 7th and 3rd for allies | — | no friendship rule in the research; says so |
| Work · starting out, your job | the 10th, the D10 lagna and lords, AL and A10 | Sudasa; Narayana on D10 when cast | Rath |
| Work · craft and hobby | the 3rd and 5th | — | gap: no timing rule |
| Work · business | the 7th and 11th, AL, the 2nd | Sudasa with Narayana ("power with prosperity") | Student (Rao) |
| Lucky times | day tables only; no dasha layer | — | unchanged |

## 7. Where this is written into the techniques

**Done with this document (2026-11-21):** doc 08 (the routing table's systems section), doc 09 (the story order), the
per-dashboard technique docs under `docs/techniques/self|love|work|general/` that state a dasha layer, and doc 11 rev 3
(the preparation pass reads the running and the next maha dasha of every system that applies).

**Not changed yet, on purpose:** the 13 lens recipes (`src/reading/prompts/cards/threads/*.md`), the card Oracle prompt
and `clocks/systems.ts`. A prompt may not name data the pack does not carry, so they change in the same release as the
period readers of doc 11 (steps 7–9 there):

| File | Change |
|---|---|
| `clocks/systems.ts` | every system gets a voice and a tag (verified, unverified, duplicate of, longevity); `never` becomes "read, never counted" or "read, never named" |
| `self/oracle.ts` (`family.dasha` pack), `prep/scope.ts` | applicability from the engine's verdict; running and next maha dasha for every system that applies |
| the 13 recipes | step 1 becomes "the maha dasha in every system that applies: the running one, its closing stretch, and the next one", and the SYSTEMS block lists the voices |
| `prompts/cards/oracle.md` | the story's first beat covers the running and the next maha dasha; the confirmation status follows §4 |
| `clocks/needle.ts` (the weave) | counts voices by §3–§4, reports support separately |

## 8. Gaps and engine requests

| # | Gap | Needed |
|---|---|---|
| 1 | No chart for the moment a dasha starts | engine: a dasha-entry chart for the next maha dasha of the counted voices |
| 2 | Tara's condition (four or more planets in kendras) is not checked | engine: add it to `dasha.applicable` |
| 3 | Shodashottari and Shat-trimsha-sama have no applicability check | engine: add the hora rules |
| 4 | No Narayana on a divisional chart | engine (doc 07 E5) |
| 5 | Narayana and Chara sub-periods and the Yogini table are unverified | engine reference test (doc 07 E1–E2) |
| 6 | Aayu has no period from 2016-10-22 to 2027-12-13; Kalachakra has only level 1 | engine: check both exports |
| 7 | Six dashas that do not apply to the chart are stored anyway (levels 1–3 for life) | server: skip them at the digest build; saves rows |
| 8 | The research files `07`, `08` and `09` still give two withdrawn claims as Rath's (Sudasa when the Moon is stronger; Narayana more accurate for marriage). The recipes already forbid both | correct the three files |
| 9 | Rath's *Vimsottari and Udu Dasas* is unread (applicability chapters) | read it before changing §2 |

## 9. For Sachin to confirm

1. The house rule of §4: **two voices confirm, at most four are counted**, everything else is support. The sources
   give the pair and no number.
2. A conditional dasha the engine has not checked is left out, not read as "unverified".
3. The chapter turn of §5 (both leading voices changing within 12 months) as a named moment in the reading.
4. Who leads the star voice (§4): the conditional dasha that applies, with Vimshottari beside it; and a divided star
   voice counting as half. On your chart this decides how often a matter can read "confirmed": Dwisaptati-sama and
   Vimshottari must agree.
