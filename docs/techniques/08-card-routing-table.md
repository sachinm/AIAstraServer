# 08 · Card routing table: which charts, dasha, year charts and points each card reads

Written 2026-11-19 for plan 09 §4 ("Chart routing", "Love chart", "Lens recipes", "Briefs") and §8 step 3. It is the
per-card table that doc 07 §4.2 promised, with the corrections of plan 09 applied. The table is code:
`src/reading/cards/routing.ts` holds the same rows (`routeFor(cardId)`), and `tests/unit/reading/cards/routing.test.ts`
checks the registries, the corrections and the briefs against it. Edit the code and regenerate this table, never one
without the other.

Selection only. Nothing here computes astrology: the engine supplies every placement, the model reads them, and Node
only chooses which rows a card is given.

## Conventions

- **Cards:** the 90 readable cards: the 21 Self cards the per-card reading builds (`READABLE_CARDS`,
  `src/reading/self/v3/cards.ts`), and the 36 Love and 33 Work cards offered in `src/reading/boards/v3Cards.ts`. Briefs:
  `src/reading/prompts/cards/{self,love,work}/<id>.md`.
- **Subject houses:** the card's own houses, subject first; every row shares at least one house with the card's
  registry `matters` (tested).
- **Promise charts:** always D1 and D9 first; any chart after them is the card's own divisional chart.
- **Sign dasha:** the Narayana dasha read at maha dasha level only, named by the chart it is cast on; " + Sudasa" on the
  pay and money cards. A divisional-chart Narayana starts from the sign that the D1 lord of the chart's controlling
  house occupies in that chart: the 9th for D9, the 10th for D10 (Rath, *Narayana Dasa* Table 29 and pp.114-115;
  `docs/deep-research/sanjay-rath/04` §2, `06` §4; `NARAYANA_CONTROLLING_HOUSE` in the code). The engine does not cast
  a divisional Narayana yet (doc 07 E5); until it does the reading uses Narayana D1 and says so.
- **Year charts:** the Tithi Pravesha year D1 first, then the year chart of the card's subject (doc 07 decision 2).
- **Points:** the arudhas, karakas and reference points the card is read from. "A5 (D10)" is the A5 counted in the D10
  (following and awards, Rao: `sanjay-rath/08` rule 1.22), never the natal A5.
- **Recipe:** the lens recipe under `src/reading/prompts/cards/threads/`, embedded as `cards/threads/<lens>`
  (`recipeText(lens)`).
- **Source tags:** [Rath] his own text · [Student] Rao or Poddar · [Text] a classical verse · [Inferred] assembled by
  the research · gap. File numbers refer to `docs/deep-research/sanjay-rath/` unless named; "r" is a rule number.

## Dasha systems for every card (amended 2026-11-21, doc 12)

**Every card on every lens reads every dasha system that applies to the person, for the running and the next maha
dasha.** What is counted is the voice, not the system: the star voice (Vimshottari with the conditional dasha that
applies), the sign voice (Narayana), the lens's purpose voice (the "Sign dasha" column below) and the Tithi Pravesha
year. Two voices confirm; at most four are counted; the other systems are reported as support. The rule, the voices
and the statuses are in `docs/techniques/12-confirming-across-dasha-systems.md`. This takes effect with the build of
doc 11 (period readers and the weave); until then the list below is what the cards are given.

## Verified dasha systems (plan 09 §1, decision 2)

Read, named and counted: Vimshottari (all levels); Narayana at maha dasha level only; Sudasa (Work and money cards);
Lagna Kendradi (low weight); the one conditional dasha the engine marks as applying; Patyayini (in-year); the Tithi
Pravesha year chart. Never: Yogini, Chara, Drig, Trikona, Mandooka, Tara, Naisargika, Mudda, the longevity dashas
(Shoola, Sthira, Brahma, Niryana Shoola, Navamsa, Aayu), or a conditional dasha that does not apply. Two cells of
doc 07 §4.2 are overruled by this list: Drig for purpose, and "Naisargika stage" for chapters.

## Corrections applied (plan 09 §4, 2026-11-19)

1. **Friends** never read "A5 from AL" (no source; the A5 is the mantra pada, `09` rule 1.8; BPHS 29.35 tests padas
   against the AL, not friendship) and never the D11 (no area in Rath, `06` rule 1.2; its D11 use is destruction,
   `15` #23). Friends are read from the 11th counted from the lagna and from the AL, in the D1 and D9. The research has
   no friendship rule at all; the recipe says so.
2. **Divisional Narayana** starts from the sign of the D1 lord of that chart's controlling house (9th for D9, 10th for
   D10; 8th for D20 and 4th for D24 by the same Table 29).
3. **Romance** is read from the 5th, Venus, the D9 and the A7, never the D7. The D7 is for children only; it is also
   removed from the Craft cards. The A5 is removed from the Dating briefs (replaced by the A7).

## The table

| Card | Board | Lens | Houses | Promise charts | Sign dasha | Year charts | Points | Recipe | Source tags |
|---|---|---|---|---|---|---|---|---|---|
| `body` | self | `self.body` | 1, 6, 8 | D1, D9, D30 | Narayana D1 | D1 | Lagna lord, Paka lagna, Sun | `threads/self.body.md` | Sun, paka lagna [Student] 02 §3; D30 strain words only [Inferred] doc 07 §4.2; illness method out (15) |
| `fitness` | self | `self.body` | 3, 1, 6 | D1, D9, D30 | Narayana D1 | D1 | Lagna lord, Paka lagna, Mars | `threads/self.body.md` | Sun, paka lagna [Student] 02 §3; D30 strain words only [Inferred] doc 07 §4.2; illness method out (15) |
| `sleep` | self | `self.body` | 12, 4, 1 | D1, D9, D30 | Narayana D1 | D1 | Lagna lord, Paka lagna, Moon | `threads/self.body.md` | Sun, paka lagna [Student] 02 §3; D30 strain words only [Inferred] doc 07 §4.2; illness method out (15) |
| `blood` | self | `self.body` | 1, 6, 8, 3 | D1, D9, D30 | Narayana D1 | D1 | Lagna lord, Paka lagna, Sun, Mars | `threads/self.body.md` | Sun, paka lagna [Student] 02 §3; D30 strain words only [Inferred] doc 07 §4.2; illness method out (15) |
| `mind` | self | `self.mind` | 4, 5, 1 | D1, D9, D24 | Narayana D1 | D1, D24 | Moon, Lagna lord star lord, Mercury | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2 |
| `sharpness` | self | `self.mind` | 5, 3, 10 | D1, D9, D24 | Narayana D1 | D1, D24 | Mercury, Moon, Lagna lord star lord | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2 |
| `mood` | self | `self.mind` | 4, 12, 1 | D1, D9, D16 | Narayana D1 | D1, D16 | Moon, Lagna lord star lord | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2; D16 mental happiness [Rath] 06 r1.3, use [Inferred] |
| `stuck` | self | `self.mind` | 6, 8, 12 | D1, D9 | Narayana D1 | D1, D9 | Moon, AL | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2; 6/8/12 [Text]; no strain varga routed |
| `restores` | self | `self.mind` | 4, 12, 9 | D1, D9, D16 | Narayana D1 | D1, D16 | Moon, Lagna lord star lord | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2; D16 mental happiness [Rath] 06 r1.3, use [Inferred] |
| `play` | self | `self.mind` | 5, 11, 3, 4 | D1, D9, D16 | Narayana D1 | D1, D16 | Moon, Venus | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2; D16 mental happiness [Rath] 06 r1.3, use [Inferred] |
| `diagnosis` | self | `self.chapter` | 1, 10, 6 | D1, D9 | Narayana D1 | D1, D9 | Lagna lord, AL | `threads/self.chapter.md` | dasha lord condition [Text] dasha-results; TP order [Student] 05 §1.3 |
| `lagna` | self | `self.temperament` | 1, 7, 10 | D1, D9 | Narayana D1 | D1, D9 | AL, Sree Lagna, AK, Sun | `threads/self.temperament.md` | D9 lagna leads [Rath] 07 r1.5; AL [Student]/[Rath] 02 §3; Narayana D1 [Rath] 04 §1; Sree Lagna [Student] 02 §3 |
| `drive` | self | `self.purpose` | 10, 3, 11, 9, 12 | D1, D9, D10 | Narayana D1 | D1, D10 | AK, Karakamsa, AmK | `threads/self.purpose.md` | AK, Karakamsa [Rath] 07 r1.11-1.18; D20 [Rath] 07 r3.12; D20 Narayana (8th, Table 29) pending; D10 [Rath] 08 r1.16; AmK [Rath] cases 08 r1.11 |
| `presence` | self | `self.temperament` | 1, 7, 2, 4 | D1, D9 | Narayana D1 | D1, D9 | AL, Moon | `threads/self.temperament.md` | D9 lagna leads [Rath] 07 r1.5; AL [Student]/[Rath] 02 §3; Narayana D1 [Rath] 04 §1; lagna vs AL [Inferred] 02 §3 |
| `yogas` | self | `self.temperament` | 9, 10, 2 | D1, D9, D5, D10 | Narayana D1 | D1, D9 | AL, A7, AK, HL, GL | `threads/self.temperament.md` | D9 lagna leads [Rath] 07 r1.5; AL [Student]/[Rath] 02 §3; Narayana D1 [Rath] 04 §1; D5, D10 confirm raja yoga [Rath] 02 §8; yogada [Rath] 02 §9 |
| `purpose` | self | `self.purpose` | 9, 5, 12 | D1, D9, D20 | Narayana D1 | D1, D20 | AK, Karakamsa, AL | `threads/self.purpose.md` | AK, Karakamsa [Rath] 07 r1.11-1.18; D20 [Rath] 07 r3.12; D20 Narayana (8th, Table 29) pending |
| `learning` | self | `self.mind` | 4, 5, 9, 3 | D1, D9, D24 | Narayana D1 | D1, D24 | Mercury, Jupiter, Karakamsa | `threads/self.mind.md` | mind via lagna lord's star lord [Rath] 07 r1.8; D24 learning [Rath] 06 r1.3, 10 §2; 4th/5th/9th then D24 [Rath] 10 §2 |
| `layers` | self | `self.body` | 1, 4, 9, 12 | D1, D9 | Narayana D1 | D1, D9 | Lagna lord, Sun, Moon, Mercury, Jupiter | `threads/self.body.md` | Sun, paka lagna [Student] 02 §3; D30 strain words only [Inferred] doc 07 §4.2; illness method out (15); five-layer frame gap; no D30 |
| `chapter` | self | `self.chapter` | 10, 1, 4 | D1, D9 | Narayana D1 | D1, D9 | Lagna lord, AL | `threads/self.chapter.md` | dasha lord condition [Text] dasha-results; TP order [Student] 05 §1.3 |
| `chapters` | self | `self.chapter` | 10, 9, 1 | D1, D9 | Narayana D1 | D1, D9 | Lagna lord, AL | `threads/self.chapter.md` | dasha lord condition [Text] dasha-results; TP order [Student] 05 §1.3 |
| `year` | self | `self.chapter` | 1, 10, 11 | D1, D9 | Narayana D1 | D1, D9 | Lagna lord, AL | `threads/self.chapter.md` | dasha lord condition [Text] dasha-results; TP order [Student] 05 §1.3 |
| `dating_pulse` | love | `love.dating` | 5, 11, 12 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_meeting_timing` | love | `love.dating` | 5, 7, 11 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL, DK | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_delays_blocks` | love | `love.dating` | 5, 7, 8 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_attraction_pattern` | love | `love.dating` | 5, 7 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL, DK | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_mixed_signals` | love | `love.dating` | 5, 12, 3, 7 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, AL | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_exes_closure` | love | `love.dating` | 8, 12, 5, 7 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_karmic_compatibility` | love | `love.dating` | 5, 8, 4, 7 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_intimacy_safety` | love | `love.dating` | 4, 8, 12 | D1, D9 | Narayana D1 | D1, D9 | Venus, Moon, A7 | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_breaking_patterns` | love | `love.dating` | 5, 6, 8, 12 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `dating_transition_commitment` | love | `love.dating` | 7, 5 | D1, D9 | Narayana D1 | D1, D9 | Venus, A7, UL, DK | `threads/love.dating.md` | 5th, Venus, D9 [Rath] 09 r1.1-1.2; A7 [Rath] 09 r1.3; UL [Rath] 09 r1.4; no D7, no A5 |
| `marriage_pulse` | love | `love.marriage` | 7, 4 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_timing_readiness` | love | `love.marriage` | 7, 9 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_daily_harmony` | love | `love.marriage` | 4, 7 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_conflict_cycles` | love | `love.marriage` | 7, 6, 8, 12 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_communication` | love | `love.marriage` | 2, 3, 7 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_trust_transparency` | love | `love.marriage` | 8, 12, 7 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_reconciliation` | love | `love.marriage` | 7, 8, 9 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_inlaws_family` | love | `love.marriage` | 4, 2, 8 | D1, D9, D4 | Narayana D9 | D1, D9, D4 | UL, A4, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student]; D4 home [Rath] 06 r1.2; UL in-laws [Rath] 09 r2.3 |
| `marriage_finances_chores` | love | `love.marriage` | 2, 8, 11, 6 | D1, D9, D2 | Narayana D9 + Sudasa | D1, D9 | UL, A2, A7, HL | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student]; D2 disputed [Rath] 06 r1.9; Sudasa role [Rath], calc [Student] 08 W1-W2 |
| `marriage_longterm_longevity` | love | `love.marriage` | 7, 8 | D1, D9 | Narayana D9 | D1, D9 | UL, A7, DK, Venus | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `marriage_personal_growth` | love | `love.marriage` | 1, 7 | D1, D9 | Narayana D9 | D1, D9 | UL, AL, AK, DK, Karakamsa | `threads/love.marriage.md` | UL, A7, DK [Rath] 09 §2; M1, M3 [Rath]; D9 Narayana seed [Rath] 04 §2, use [Student] |
| `friends_social_energy` | love | `love.friends` | 11, 12, 3 | D1, D9 | Narayana D1 | D1 | AL, Moon | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11 |
| `friends_core_allies` | love | `love.friends` | 11, 9 | D1, D9 | Narayana D1 | D1 | AL, Jupiter | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11 |
| `friends_outgrowing_circles` | love | `love.friends` | 11, 6, 8 | D1, D9 | Narayana D1 | D1 | AL | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11; 6th lord in 5th [Rath] 10 r5.3 |
| `friends_finding_tribe` | love | `love.friends` | 11, 9, 3 | D1, D9 | Narayana D1 | D1 | AL, Jupiter | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11 |
| `friends_boundaries_drains` | love | `love.friends` | 12, 6, 11 | D1, D9 | Narayana D1 | D1 | AL, Moon | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11 |
| `friends_mentors_guides` | love | `love.friends` | 9, 11 | D1, D9 | Narayana D1 | D1 | AL, Jupiter, BK | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11; BK as teacher [Rath] 07 r3.5 |
| `friends_reputation_belonging` | love | `love.friends` | 11, 10, 1 | D1, D9 | Narayana D1 | D1 | AL | `threads/love.friends.md` | gap (no friendship rule); 11th list [Text] natal 02; AL [Student]; no A5, no D11 |
| `allies_pulse` | love | `love.allies` | 10, 6, 7, 11 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, AL, AmK | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath] |
| `allies_bosses_authority` | love | `love.allies` | 10, 9 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, Sun | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath] |
| `allies_team_politics` | love | `love.allies` | 6, 3, 8 | D1, D9, D10 | Narayana D10 | D1, D10 | A6, AL | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath]; 6th, A6, AL [Rath] 10 §5 |
| `allies_cofounder_fit` | love | `love.allies` | 7, 11 | D1, D9, D10 | Narayana D10 | D1, D10 | A7, DK | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath]; DK only to keep the spouse apart [Student] 02 §6 |
| `allies_clients_deals` | love | `love.allies` | 7, 10, 11 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10 | A7, A10 | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath]; D2 disputed [Rath] 06 r1.9; Sudasa |
| `allies_managing_people` | love | `love.allies` | 10, 6, 5 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, A5 (D10) | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath]; A5 in D10 [Student] 08 r1.22 |
| `allies_networking_allies` | love | `love.allies` | 11, 10, 3 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, AL | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath] |
| `allies_contracts_disputes` | love | `love.allies` | 6, 8, 7 | D1, D9, D10 | Narayana D10 | D1, D10 | A6, AL | `threads/love.allies.md` | D10 houses [Rath] 08 r1.20; A10, A7 [Rath] 08 r1.10; T5 triggers [Rath]; 6th, A6, AL [Rath] 10 §5; D6 not routed |
| `start_launch_window` | work | `work.career_start` | 10, 6, 5, 9 | D1, D9, D10, D24 | Narayana D10 | D1, D10 | A10, AL, AmK | `threads/work.career_start.md` | D10 5th lord [Rath] 08 T1; D10 Narayana seed [Rath] 04 §2, D10 use [Inferred] 06 r4.6; D24 [Rath] 10 §2 |
| `start_first_role_timing` | work | `work.career_start` | 6, 10, 11 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, AL, AmK | `threads/work.career_start.md` | D10 5th lord [Rath] 08 T1; D10 Narayana seed [Rath] 04 §2, D10 use [Inferred] 06 r4.6 |
| `start_offer_decision` | work | `work.career_start` | 10, 2, 3, 6 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10 | A10, AL, AmK | `threads/work.career_start.md` | D10 5th lord [Rath] 08 T1; D10 Narayana seed [Rath] 04 §2, D10 use [Inferred] 06 r4.6; D2 disputed [Rath] 06 r1.9; Sudasa |
| `start_imposter_syndrome` | work | `work.career_start` | 1, 4, 5 | D1, D9, D10 | Narayana D10 | D1, D10 | Moon, Sun, Mercury, AL | `threads/work.career_start.md` | D10 5th lord [Rath] 08 T1; D10 Narayana seed [Rath] 04 §2, D10 use [Inferred] 06 r4.6 |
| `start_relocation_abroad` | work | `work.career_start` | 12, 9, 4, 3 | D1, D9, D10, D4 | Narayana D10 | D1, D10 | A10, AL, AmK | `threads/work.career_start.md` | D10 5th lord [Rath] 08 T1; D10 Narayana seed [Rath] 04 §2, D10 use [Inferred] 06 r4.6; 12th order [Rath] 10 §4; D4 abroad [Student] 10 r3.9 |
| `start_three_year_foundation` | work | `work.career_start` | 10, 3, 6, 11 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, AK, AmK | `threads/work.career_start.md` | D10 5th lord [Rath] 08 T1; D10 Narayana seed [Rath] 04 §2, D10 use [Inferred] 06 r4.6 |
| `job_pulse` | work | `work.primary_job` | 10, 6, 11 | D1, D9, D10 | Narayana D10 | D1, D10 | AL, A10, AmK | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath] |
| `job_security_layoff` | work | `work.primary_job` | 10, 8, 12, 6 | D1, D9, D10 | Narayana D10 | D1, D10 | AL, A10, AmK | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; unemployment checks [Rath] 08 r1.9 |
| `job_stay_or_leave` | work | `work.primary_job` | 10, 3, 8, 11 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10 | AL, A10, AmK | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; D2 disputed [Rath] 06 r1.9; Sudasa |
| `job_promotion_recognition` | work | `work.primary_job` | 10, 11, 9 | D1, D9, D10 | Narayana D10 | D1, D10 | AL, A10, Sun, GL | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; T6 [Rath]; GL [Student] |
| `job_salary_bonuses` | work | `work.primary_job` | 11, 2, 12 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10, D2 | AL, A2, HL | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; wealth [Rath] 08 §2; D2 disputed; Sudasa |
| `job_burnout_load` | work | `work.primary_job` | 6, 8, 12, 1 | D1, D9, D10 | Narayana D10 | D1, D10 | Lagna lord, Moon, Sun | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath] |
| `job_boss_politics` | work | `work.primary_job` | 10, 9, 6 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, A6, Sun | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath] |
| `job_leading_teams` | work | `work.primary_job` | 10, 5, 6 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, A5 (D10), Sun | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; A5 in D10 [Student] 08 r1.22 |
| `job_industry_switch` | work | `work.primary_job` | 10, 8, 9, 12 | D1, D9, D10 | Narayana D10 | D1, D10 | AL, A10, AmK | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath] |
| `job_remote_abroad` | work | `work.primary_job` | 12, 9, 4, 10 | D1, D9, D10 | Narayana D10 | D1, D10 | AL, A10, AmK | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; 12th order [Rath] 10 §4 |
| `job_skill_building` | work | `work.primary_job` | 3, 5, 9, 10 | D1, D9, D10, D24 | Narayana D10 | D1, D10, D24 | Mercury, Jupiter, AmK | `threads/work.primary_job.md` | tenth-house order [Rath] 08 §1 (order [Inferred]); T1, T4-T6 [Rath]; D24 [Rath] 10 §2 |
| `craft_creative_flow` | work | `work.hobby` | 5, 3, 11 | D1, D9, D24 | Narayana D1 | D1 | Mercury, Venus, Moon | `threads/work.hobby.md` | adjacent rules only: 3rd [Rath] 09 r5.1, 5th [Rath] 07 r1.16; D24 [Inferred]; timing gap |
| `craft_energizing_medium` | work | `work.hobby` | 3, 5 | D1, D9, D24 | Narayana D1 | D1 | Mercury, Venus | `threads/work.hobby.md` | adjacent rules only: 3rd [Rath] 09 r5.1, 5th [Rath] 07 r1.16; D24 [Inferred]; timing gap |
| `craft_creative_blocks` | work | `work.hobby` | 5, 12 | D1, D9, D24 | Narayana D1 | D1 | Mercury, Venus | `threads/work.hobby.md` | adjacent rules only: 3rd [Rath] 09 r5.1, 5th [Rath] 07 r1.16; D24 [Inferred]; timing gap |
| `craft_monetize_hobby` | work | `work.hobby` | 5, 11, 2, 7 | D1, D9, D24, D10, D2 | Narayana D1 + Sudasa | D1, D10 | Mercury, Venus, A7 | `threads/work.hobby.md` | adjacent rules only: 3rd [Rath] 09 r5.1, 5th [Rath] 07 r1.16; D24 [Inferred]; timing gap; wealth [Rath] 08 §2; D2 disputed; D10 [Inferred]; Sudasa |
| `craft_shipping_projects` | work | `work.hobby` | 3, 10, 11 | D1, D9, D24, D10 | Narayana D1 | D1 | Mars, Mercury, A10 | `threads/work.hobby.md` | adjacent rules only: 3rd [Rath] 09 r5.1, 5th [Rath] 07 r1.16; D24 [Inferred]; timing gap; D10 [Inferred] |
| `craft_audience_community` | work | `work.hobby` | 11, 5 | D1, D9, D24, D10 | Narayana D1 | D1 | Moon, Venus, AL | `threads/work.hobby.md` | adjacent rules only: 3rd [Rath] 09 r5.1, 5th [Rath] 07 r1.16; D24 [Inferred]; timing gap; D10 [Inferred] |
| `biz_readiness` | work | `work.business` | 7, 3, 11, 6 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10 | A7, A10, AL | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; D2 disputed; Sudasa |
| `biz_ideal_industry` | work | `work.business` | 10, 7, 2 | D1, D9, D10 | Narayana D10 | D1, D10 | AmK, A10, A7 | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; dominant D10 planet [Rath] 08 r1.18 |
| `biz_launch_timing` | work | `work.business` | 10, 7, 11 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10, D2 | A7, A10, AL | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; D2 disputed; Sudasa; start dates gap |
| `biz_cashflow_margins` | work | `work.business` | 2, 11, 12 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10, D2 | AL, A2, HL | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; wealth [Rath] 08 §2; D2 disputed; Sudasa |
| `biz_clients_sales` | work | `work.business` | 7, 10, 3 | D1, D9, D10 | Narayana D10 | D1, D10 | A7, A10, AL | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath] |
| `biz_partnerships_fit` | work | `work.business` | 7, 11, 8 | D1, D9, D10 | Narayana D10 | D1, D10 | A7, DK | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; DK only to keep the spouse apart [Student] 02 §6 |
| `biz_hiring_team` | work | `work.business` | 6, 5, 10 | D1, D9, D10, D2 | Narayana D10 + Sudasa | D1, D10 | A10, A6, A5 (D10) | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; D10 5th/6th [Rath] 08 r1.20; D2 disputed; Sudasa |
| `biz_capital_assets` | work | `work.business` | 4, 2, 8, 6 | D1, D9, D10, D2, D4 | Narayana D10 + Sudasa | D1, D10, D4 | A4, A2, HL | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; D4 [Rath] 06 r1.2; D2 disputed; Sudasa |
| `biz_scaling_risk` | work | `work.business` | 3, 11, 10 | D1, D9, D10 | Narayana D10 | D1, D10 | A10, AL | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath]; 8th of D10 [Rath] 08 W7 |
| `biz_founder_burnout` | work | `work.business` | 1, 6, 12, 8 | D1, D9, D10 | Narayana D10 | D1, D10 | Lagna lord, Moon, Sun | `threads/work.business.md` | D10 6th vs 7th [Rath] 08 r1.20; D10 2nd capital [Rath] 08 r1.21; A7 [Rath] |

## Charts removed from briefs (and why)

Every brief now names only charts in its route or the natal D1/D9 (tested). Two kinds of removal:

- **Named by plan 09 §4 (approved 2026-11-19):** the D7 for romance, the "D11 proxy", the A5 for friends and romance.
- **My call, needing Sachin's yes under "Reading depth is a release gate" rule 5:** the D7 in the Craft briefs, the D30
  in ten Love/Work briefs, the D24 in four briefs, the D16 in three Craft briefs, and the D10 11th in
  `friends_core_allies`. Each is unsourced for its subject or sensitive (reasons below), but not every one was absent
  from the pack: the pack's varga family lists D2-D60 (`self/oracle.ts`, `family.varga`), the D7 is in the Love rows
  (`love:chart/D7.h7`), and `friends_core_allies` read the D10 11th unconditionally. Most of the others were written
  "only if present in the shared data". No depth replay was run (no paid call); revert any of them on Sachin's word.

The "Charts:" sentences added to briefs name every chart past the natal D1 and D9 "only where the shared data carries
them", so no brief orders a chart the pack does not hold.

| Chart | Removed from | Reason |
|---|---|---|
| D7 | `dating_attraction_pattern`, `dating_karmic_compatibility`, `dating_pulse` (Venus's place); `craft_creative_flow`, `craft_energizing_medium`, `craft_creative_blocks`, `craft_monetize_hobby`, `craft_audience_community` | The D7 is for children only (plan 09 §4; `06` rule 1.2). Romance reads Venus in the D9; craft reads the D9 and the D24. |
| D11 | all seven Friends briefs; `allies_cofounder_fit`, `allies_networking_allies` (the "D11 proxy" sentence) | No area in Rath; destruction in its own use (`06` rule 1.2; `15` #23). |
| D10 (as a friends proxy) | the Friends briefs (inside the D11 sentence) and `friends_core_allies` ("the D9 and D10 11th") | Only there to stand in for the D11; no friendship source. |
| D30 | `dating_karmic_compatibility`, `marriage_conflict_cycles`, `allies_cofounder_fit`, `allies_contracts_disputes`, `allies_team_politics`, `job_boss_politics`, `job_burnout_load`, `job_security_layoff`, `biz_partnerships_fit`, `biz_founder_burnout` | Rath's D30 is evils, misfortune and disease (`06` rule 1.4; `15` #17, #23). Doc 07 §4.2 allows it only on the Self body cards, for strain words. |
| D24 | `friends_mentors_guides`, `start_imposter_syndrome`, `job_industry_switch`, `biz_ideal_industry` | The D24 is learning (`06` rule 1.3; `10` §2); these cards are not about learning. It stays on `start_launch_window`, `job_skill_building` and the Craft cards. |
| D16 | `craft_creative_flow`, `craft_energizing_medium`, `craft_monetize_hobby` | No source ties the D16 (comforts, mental happiness) to craft. It is routed instead to the Self happiness cards `mood`, `restores`, `play` ([Inferred] from `06` rule 1.3). |
| A5 (a point) | `dating_attraction_pattern`, `dating_karmic_compatibility`, `dating_pulse`, `dating_meeting_timing`, `dating_mixed_signals` | Not a romance point (`09` rule 1.8); replaced by the A7. |

Charts added to briefs: every Self brief (none named a divisional chart) and the briefs left with none after the
removals now carry one "Charts:" sentence naming their routed charts and the year chart. The Self `body` brief already
named the Trimsamsa (D30).

## Cards with no route

Eight registry cards are not readable yet, so `routeFor` returns null for them:

| Card | Why |
|---|---|
| `constitution`, `aims`, `practice`, `helps` (Self) | need an engine export (`needs: engine:*`) |
| `saturn` (Self) | needs the sade sati export |
| `marriage_children_family` (Love) | "later"; when it opens it is the one Love card that reads the D7 (children: the D7 decides, `09` §3), so the "no D7 in Marriage" test must exempt it by id |
| `start_degree_to_career` (Work) | "later" |
| `biz_legal_safeguards` (Work) | "later" |

## Open items (filed in `docs/TODOS.md`, 2026-11-19, reading recipes)

- Divisional Narayana (D9, D10, D20, D24) is not cast by the engine (doc 07 E5); every route names it and the reading
  falls back to Narayana D1.
- The D16 on the Self happiness cards and the D24 on Craft are [Inferred]; the pack must carry D16, D20, D24, D5 and
  D4 for the routes that name them.
- `renderActiveTimingAndVargaBlock` (`src/reading/cards/oracle.ts`) still prints the old Self-only routing (D7 for
  `lagna` and `presence`, D30 for `stuck` and `mood`, D10 for `diagnosis` and the time cards) and must read this table.
- `src/reading/area/love.ts` (vargas D1, D9, D7) and the `love:chart/D7.h7` technique row still route romance to the D7.
- The Craft briefs still name the natal A5 as "the work"; the recipe reads it only as recognition (Rao).

## Sachin's yes on the chart removals (2026-11-19)

Under the depth rule (`AGENTS.md`, "Reading depth is a release gate", rule 5), every chart removed from a brief needs
Sachin's written yes. He approved keeping all of them on 2026-11-19: D30 out of ten Love and Work briefs (the research
reserves it for illness, which stays out of readings), D24 out of four briefs, D16 out of three Craft briefs, D7 out of
the Craft briefs, and the D10 11th house out of `friends_core_allies`. No depth replay was run for these; each card still
reads D1, D9, its own routed chart and the year charts.

