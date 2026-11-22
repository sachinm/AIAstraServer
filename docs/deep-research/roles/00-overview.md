# Roles research: overview

**Purpose.** Find sourced rules for the eight roles that doc 13 (`docs/techniques/13-helpers-disruptors-and-waiting-strength.md`
§2.1-2.3) maps to houses by our own judgement (tag "Ours").

**Pass.** 2026-11-22. Read-only, no paid calls.

**Tags.** [TEXT] classical verse; [A Rath]; [B student]; [MODERN]; [INFERRED].

**How the sources were read.**
- Primary texts were read through a fetch tool that returns a summary, with word-by-word quotes asked for:
  - BPHS (enjoylearningsanskrit.com, chs. 11, 13, 45);
  - Phaladeepika (wisdomlib, Sastri 1950 OCR: chs. 1, 2, 3, 4, 6, 8, 15, 20);
  - Brihat Jataka (wisdomlib, Sanskrit only: chs. 14, 23; the English gloss is ours);
  - Uttara Kalamrita (archive.org Sastri djvu text, ch. V house and planet lists).
- Rath rules come from our earlier research files and were not re-read.
- Each file marks every row: read (fetch), Sanskrit read and gloss ours, snippet only, or our research.

**Not reachable in this pass.**
- The issuu copy of *Crux* (404). So Rath's years of fortune are still unchecked.
- srath.com: searches found no article on any of the eight roles.
- Visti Larsen and Sarajit Poddar: no material found on any of the eight roles.
- The Rath research notes and reports under `AIAstra_Server/research_notes/` and `reports/` are deleted in that working
  tree (git status). Their content survives in `docs/deep-research/sanjay-rath/`, which was used instead.

| # | Role | Best source found | Tag | Replaces our mapping? | What to change in doc 13 |
|---|---|---|---|---|---|
| 01 | Breaks agreements | Phaladeepika 1.10: documents in the 2nd. BPHS 11.8: trade in the 7th. Brihat Jataka 14.3: Mars with Saturn makes one *asatya-sandha* ("untruthful"); its use for contracts is our gloss. Rath: A7 for business partners; litigation through the AL, A6 and A7 | [TEXT]; [INFERRED] (BJ 14.3 for contracts); [A Rath]; [B student] (6th from the AL) | Partly | Replace the 3rd with the 2nd. Keep the 7th and Mercury. Add the A7, the Mars–Saturn pair, and Rath's litigation reading for the dispute |
| 02 | Breaks promises | BPHS 13.13: the 2nd lord with malefics and malefics in the 2nd make a liar. BJ 14.3 (as above). PD 2.3, 2.4, 2.33: Mars and Rahu falsehood, Mercury truth. UK V: 2nd = truth and falsehood | [TEXT]; [A Rath] (AK conduct, remedy only) | Partly | The 2nd and its lord become Text. Replace Jupiter with Mercury (truth) and name Mars, Rahu and Saturn (falsehood). Demote the 9th to Ours |
| 03 | Gambles and loses | BJ 14.3: Mars with Venus, a gambler. UK V: Rahu = gambling. Rath: D10 8th for speculation, and the 10th lord in the 5th for "research or speculation"; 12th from the AL and 12th links for loss | [TEXT]; [A Rath] | Yes, mostly | The habit: Rahu, Mars–Venus, the D10 8th. The loss: Rath's 12th-from-AL rules and the 12th. Re-tag the 5th: not Text (no verse); Rath only as a career field; Modern for gambling. `sanjay-rath/08` W7's "only" contradicts its rule 1.2 |
| 04 | Loses calm through Mars or Rahu | BPHS 45 (kshobhita, kshudhita); PD 2.10, 2.14 and UK V (Mars and Saturn anger); PD 8.9, 8.22 (Mars or Saturn in the 5th spoil reason); BJ 23.13 (Saturn in the lagna with Mars in a trine or the 7th, or Mars in the 7th with Jupiter in the lagna; extreme form, not for readings) | [TEXT] | Partly | Keep the Moon and the 5th (now Text). Mars, then Saturn, are the disruptors. Rahu stays Ours (no verse). Add Ketu (UK V: instability of mind). The 4th: Text for happiness, Ours for peace of mind |
| 05 | Wins friends (one planet) | Phaladeepika 15.15 and 2.4: Mercury is the karaka of friends. PD 1.11-12: the 4th house = friend | [TEXT] | Yes | Name Mercury. Add the 4th. Re-tag the 11th as Modern: BPHS 11.12 and PD 1.15 list no friends, and doc 13 cites `natal-techniques/02` L26, which is the 6th-house row |
| 06 | Overpowered benefic | PD 3.19-20: Nipeedita (overcome in war), Duhkhita (enemy sign), Vikala (combust), with effects scaled down to nil. PD 20.27, 20.30 for the dasha | [TEXT]; Rath papakartari [A] | New row | Add a §2.2 row with these rules. Recovery in the latter half of the dasha (PD 20.57) is already in §2.3 |
| 07 | After age X | PD 20.33: a good middle life with Jupiter, the Moon's lord and the lagna lord in kendras. Its rising-type clause (start, middle or end) may be about the dasha, not the life; unresolved. Rath: yoga-placement ages (*Crux* II, XIII) | [TEXT]; [A Rath] | Adds above it | Add PD 20.33's kendra clause and Rath's yoga ages above the maturity dates. Hold the rising-type clause. Rath's years of fortune match the folk ages for six planets; Jupiter differs (33-34 against 16). Check *Crux* XII 12.10 in print before use |
| 08 | Jupiter or shubha kartari as protector | PD 6.8, 6.11: shubha kartari on the lagna gives long life and freedom from enemies. Saravali 41.22-24: a dasha lord hemmed by benefics is moderately good. PD 15.1, 15.5 and BJ 23: benefic aspect | [TEXT]; no Rath rule | Refutes "Not a rule" in part | Replace the Gap row with a limited Text rule (benefics as a group, lagna-specific). Keep "no Rath or SJC rule" and never say Jupiter protects in general |

## Citation errors found in doc 13 (not fixed here; this pass is read-only outside this folder)

1. §2.1: the line references are swapped. "Wins friends" cites `natal-techniques/02` L26, which is the 6th-house row.
   "Wins over enemies" cites L31, which is the 11th-house row. Beyond the swap, no source read lists friends in the
   11th, so its Text tag is wrong.
2. §2.2 "Gambles and loses": "The 5th is speculation" is tagged Text, but no verse was found. The gloss in
   `natal-techniques/14-yoga-dhana.md` L6 is unsourced. Rath's 10th lord in the 5th (`08` rule 1.2) is the only
   sourced link.
3. `sanjay-rath/08` W7 says speculation appears "only" as the D10 8th. Rule 1.2 of the same file contradicts it.

**Scope correction (not an error):** §2.1 "Not a rule" is accurate at the Rath tier. Shubha kartari does, however,
have a classical definition and result (PD 6.8, 6.11; Saravali 41.22-24). The row should say so.

These were **not** filed in `docs/TODOS.md`: this pass was told to edit nothing outside this folder. The caller
should file them.

## Files

- `01-breaking-agreements.md`
- `02-breaking-promises.md`
- `03-gambling-and-losing.md`
- `04-losing-calm-mars-rahu.md`
- `05-what-wins-friends.md`
- `06-overpowered-benefic.md`
- `07-after-age-x.md`
- `08-jupiter-as-protector.md`

## Caveats

- The wisdomlib Phaladeepika and the archive.org Uttara Kalamrita are unproofread OCR. Verse and item numbers may be
  off by one. Two fetches of Uttara Kalamrita ch. V placed "friends" in different house lists (2nd or 5th, and 3rd).
- The Brihat Jataka glosses (14.3 *dyūtakṛt*, *asatya-sandha*; 23.13 *sonmāda*) are ours, from the Sanskrit. Check
  them against Sastri or Chidambaram Iyer (1885, Wellcome PDF b2488442x).
- BPHS verse numbers follow enjoylearningsanskrit.com and may differ from Santhanam's.
