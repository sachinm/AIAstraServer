# Arishta and Balarishta yogas (ariṣṭa, bālāriṣṭa) and their cancellations (ariṣṭa-bhaṅga)

> Arishta yogas are combinations that threaten health or life. Balarishta are those that threaten an infant in the first years (traditionally up to 12). The texts pair them with cancellations (arishta-bhanga), chiefly a strong Jupiter, a strong lagna lord or benefics in kendras.
>
> They are classical and present in all major texts, but modern practice treats them with great caution. **For this product they are internal-only signals; they must never reach users.**

## 1. Sources
- **BPHS ch. 9 "Evils at birth"** and **ch. 10 "Antidotes for evils"** (BPHS-ET contents, V for the titles; rules R): https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Brihat Jataka ch. 6 "Arishta"** (R).
- **Saravali ch. 9-10** (R).
- **Phaladeepika ch. 13-14** (R).
- **Jataka Parijata ch. 3-4** (R).

## 2. When it applies
D1 natal. Health and longevity. Balarishta applies to births of children; in an adult chart it is historical.

## 3. Inputs required
- Moon position, paksha and strength.
- Malefics in kendras, the 6th, 8th and 12th.
- Aspects on the Moon and the lagna.
- Strength and placement of the lagna lord and Jupiter.
- Gandanta and ganda-moola flags.

## 4. Calculation / rule (representative, R)
| Type | Representative condition | Cancellation |
|---|---|---|
| Balarishta | The Moon in the 6th, 8th or 12th, aspected by malefics, without benefic aspect | A strong Jupiter in a kendra; benefics aspecting the Moon; the Moon in own or exaltation sign |
| Balarishta | Malefics in the lagna and the 7th, with a weak Moon | A strong lagna lord in a kendra |
| Balarishta | A waning Moon in the lagna with malefics in kendras and the 8th | Jupiter aspecting the lagna |
| Arishta (general) | The lagna lord weak and in a dusthana, with malefics in the 8th | Benefics in kendras or trikonas |
| Birth evils (BPHS 9) | Births in gandanta, amavasya, eclipse, or specific nakshatra padas | Propitiations (BPHS 10) |

## 5. Interpretation rules
- [TEXT] Arishta from the Moon is cancelled by a strong Jupiter or benefics (BJ 6, BPHS 10, R).
- [COMM] Arishta indications in an adult's chart show past childhood health episodes, not current danger.
- [MODERN] Raman and K.N. Rao: never pronounce arishta without the longevity frame and multiple confirmations.

## 6. Variants and disputes
Lists differ by text; Saravali and Phaladeepika give dozens. The cancellation priority is not standardised.

## 7. Worked micro-example
Omitted on purpose.

## 8. Design notes for AI Astra
- **Engine status**: no function is named arishta or balarishta. `dosha.py` has related doshas (ganda moola, ghata) but none of these combinations.
- **Engine addition (optional, research-only)**: an `arishta_flags` block with rule id, source and cancellation results, marked `internal_only`.
- **Product rule**: exclude it from every reader pack and board. Health-difficulty language, if ever used, comes from 6th-house and lord analysis (file 01) with the doc 45 vocabulary.
- **Pitfall**: any surfacing of these is a harm risk.

## 9. Open questions
- Confirm with Sachin whether this should be built at all. Recommendation: not built.
