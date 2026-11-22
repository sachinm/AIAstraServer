# Paryaya dasa / Chara Paryaya dasa (paryāya daśā)

> "Paryaya" means rotation/succession. A family of sign dasas (Chara, Sthira, Ubhaya paryaya) whose order is chosen by
> the nature of the seed sign: trines-first, kendras-first or 1/7-pairs-first. Sanjay Rath's preface to his Jaimini
> translation warns that "Chara dasa" differs from "Chara Paryaya dasa". No classical verse for it was read in this
> research; everything below is the engine's implementation and should be treated as unverified.

## 1. Sources
- [MODERN] Rath, *Jaimini Maharishi's Upadesa Sutras* (Sagar 1997) preface, via publisher listing (repo note
  `research_notes/Sanjay Rath open method gaps/chara_dasha.md`).
- [ENGINE] `paryaaya.py` (header: "NOT IMPLEMENTED FULLY YET; dhasas ok, antardasa and periods not matching JHora").
- No BPHS or JS-BSR verse found naming Paryaya dasa.

## 2. When it applies
ENGINE default divisional chart is D6 (6th-house matters) — suggests a school links it to disease/enemies; source not
found.

## 3. Inputs required
The chosen varga; seed house = nth house for Dn (PVR varga seed rule); strengths of trines/kendras.

## 4. Calculation (ENGINE, unverified)
Seed = nth house from lagna of Dn. If the seed is dual: strongest of its trines, order 1,5,9,2,6,10,3,7,11,4,8,12. If
movable: strongest of its kendras, order 1,4,7,10,2,5,8,11,3,6,9,12. If fixed: stronger of seed and 7th, order
1,7,2,8,3,9,4,10,5,11,6,12. Backward if the start sign is even-footed. Years = count to lord (no minus one). Two
cycles; optional "tribhagi" (one-third) variation.

## 5. Interpretation rules
None found.

## 6. Variants and disputes
Entirely unverified; do not attribute to Jaimini or Parasara.

## 7. Worked micro-example
Not given.

## 8. Design notes for AI Astra
Exclude from boards. Engine output only for research view, flagged "unverified".

## 9. Open questions
Classical source (possibly a Jaimini commentary or Jataka Sara Sangraha); purpose; years rule.
