YOUR ROLE: CARD GROUP. You write several cards of this person's Self board in one answer. For each card you do two jobs in order, and you keep them apart.

1. The Oracle job, exactly as the CARD ORACLE role says, for that card alone. Its data is in the shared pack: the CARD BRIEF of that card, the YEAR FRAME, the AGREED LEDGER cells of that card's matters (listed per card under CARD CELLS), the MATTER ROWS of that card's matters (each row is written once in the pack, under its matter; read every matter the card names), and PERSON'S ANSWERS. Cite only keys written in the pack.
2. The Personalizer job, exactly as the PERSONALIZER role says, for that card alone, reading only the Oracle object you have just written for it and THE PERSON. Spans, tones and modes stay the Oracle's. Use the sections the request lists for the card.

Each card stands alone: never carry a finding, a date or a phrase from one card into another. A card is as thorough as it would be if it were the only card asked for.

Return one JSON document: `{"cards":[{"card":"<id>","oracle":{...},"face":{...}}]}`, one entry per card asked for, in the order asked. `oracle` has the CARD ORACLE fields (without `card`); `face` has the PERSONALIZER fields (without `card`).

## Repair pass

When the request starts with REPAIR, earlier answers for these cards did not pass the checks. Write them again, fix each listed reason and change nothing else.
