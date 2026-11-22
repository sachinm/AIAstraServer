# 07 — Recommendation: what to fix and add first

One sequence, from `06-gap-matrix.md` (row ids in brackets) and the entries filed in `docs/TODOS.md` under "Filed
2026-11-18 by the classical-techniques deep research". The engine (`AIAstra_Radha`) is the only source of astrological
data: every step below is an engine addition or fix, or a server/spec change that only reads engine fields.

**Start.** Engine `release-candidate-staging` @ `b902bea` serves 43 dasha systems, 23 vargas, Jaimini points, annual
and muhurta types. Eight rows of the matrix are wrong data served today (P0; four of them still to be confirmed
against a reference chart); the boards vote across five clocks (Vimshottari, Narayana, TP year, conditional, Yogini)
and three of those clocks, plus the annual tables, carry one of them. About 25 rules still run in Node.

**End goal.** Every number a board reads matches a named text or a declared school variant, is computed by the engine,
and carries `variant` and `text` tags; Love and Work read their own vargas (D9, D10) through the same clocks.

## The sequence

1. **Reference harness first (engine repo, `tests/research/`).** One fixture set of research kundlis with JHora
   reference output for Vimshottari, Yogini, Narayana, Chara, Mudda, BAV and sahams; this is the doc 46 §D.2
   engine-rule-verifier. *Why first:* three P0 rows (Yogini [A11], Narayana [B01], BAV [E07]) are code-read and must be
   confirmed before they are changed, and every later fix needs a regression test.
2. **Fix the P0 data, smallest first, then re-pull.** Mudda start lord [C02] (verified by a run); annual saham
   day/night from the revolution [H06]; re-pull the Tithi Pravesha year-dasha rows, which the engine already bounds
   to the year at `b902bea` while stored rows still span 108 years [C01]; then Chara and Narayana antardasas
   [B03, B01], the Yogini mapping [A11] and the three BAV cells [E07] as the harness confirms each. In the same
   branch settle the open gochara decision (`TODOS.md:1876`) with one Phaladeepika 26 table for all nine planets used
   by `pressure_inventory` and `reading_tables` [E01]. Re-pull the affected types and rebuild digests for the test
   kundlis only, after the disk check (memory: check DB disk before bulk writes). *Why:* these change what the You,
   Love, Work and Now cards say today; each is a few lines.
3. **Complete the annual layer.** Name the TP weekday year lord as a field on the TP export (already filed,
   `TODOS.md:120`); stop the TP current-year fallback [C01]; make the Tajika year lord follow the texts (aspecting candidates
   only, true return and +30° month instants) [H03]; fix Venus's harsha joy house and serve harsha and pancha-vargiya
   bala on the year chart [H08]. Server: add `annual.tajaka` to the annual pull set [H02]; specs name two fields,
   `tp.vara_lord` and `varsha.year_lord`. *Why:* the TP year is one of the five clocks and the annual layer is otherwise
   hollow.
4. **One options-and-variant contract for every dasha and Jaimini type.** Engine `dasha.*` takes `varga` and per-system
   `options` [X01]; every variant-bearing output carries `variant` and `text` [X05]; `dasha.applicable` gives one
   boolean per BPHS rule (Ashtottari 46.17 and 46.23, Shodashottari, Shattrimsha, both Panchottari readings) with the
   margin to the boundary [A02-A05, A10]. Serve Narayana on D9 and D10 [B02]. Also: errors return 500 [X04], LAHIRI
   enforced [X03], missing bodies are null rows [G13]. *Why:* this unlocks the Love and Work rasi clocks and makes the
   conditional clock trustworthy, without new reading code.
5. **Move the Node rules into engine fields, then widen the guard test.** Engine adds per period row
   `houses_activated[]`, placement at the dasha start, dreshkana third, AD-from-MD house and friendship [D02, D03, D07];
   per planet `vargottama`, `neecha_bhanga[]`, `conjunctions[]` and a `d1_d9_confirmation` verdict [F11, F19]. The
   server deletes the matching Node code (05 §A) and `noAstrologyInNode.test.ts` scans `src/reading/**` [X06]. *Why:*
   the rule is absolute and these sites decide every vote.
6. **Correct the specs and the catalogue in one pass.** Mark vedha, murti, Sudarshana, Karakamsha and synastry as
   planned; seed `verification_status` (`calibrating` until a harness benchmark passes); route romance to the 5th
   house and D9, not D7 (doc 78) [F11]; fix doc 46's polarity table to functional nature only [D01]; correct the
   "2 levels" dasha depth in memory, doc 67 and `dashas-nakshatra/00-overview.md` (fact: default 4, max 6, rasi 5,
   Kalachakra 1, server asks 3).
7. **Then add the missing techniques the boards already promise, in this order:** vedha on the new gochara table
   [E02]; Karakamsha frame and houses from UL, AL and HL [G07, G08]; argala with node reversal and the 3rd-house rule
   [G05]; Sudarshana Chakra with a natal seed [C04]; panchang class tags and a renamed, scheme-tagged Panchaka [H11,
   H16]. Each ships with a harness test.

**Not now:** longevity and maraka tools (Sthira, Shoola, Niryana Shoola, Brahma, Navamsa dasha, ayur-dashas, Jaimini
longevity) stay internal or unserved; the other research-only rasi dashas wait for reference tests; muhurta event rules
wait for a verse-level Muhurta Chintamani pass.

## Recommendation

Do steps 1 and 2 as one engine branch this week: build the reference harness, fix Mudda and the sahams and re-pull
the TP rows immediately, settle the gochara table on Phaladeepika 26, and fix Chara, Narayana, Yogini and the BAV
cells as the harness confirms each. Nothing else on this list
changes as many served readings for as little code.
