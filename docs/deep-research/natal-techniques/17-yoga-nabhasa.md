# Nabhasa yogas — the 32 "celestial" pattern yogas (nābhasa yoga)

> Nabhasa yogas classify the whole chart by the *pattern* of the seven planets (Sun to Saturn; Rahu and Ketu excluded). They fall into four groups:
> - **Ashraya** (3, by the sign type occupied);
> - **Dala** (2, benefics or malefics in kendras);
> - **Akriti** (20, by shape);
> - **Sankhya** (7, by the number of signs occupied).
>
> The texts say their results operate throughout life, not only in a dasha. They are general life-pattern descriptors, and both BPHS and Brihat Jataka give them.

## 1. Sources
- **BPHS ch. 35 "Nabhasa yogas"** (BPHS-ET):
  - vv. 16-17: the seven Sankhya yogas do not operate if another Nabhasa yoga can be formed (V);
  - the other definitions (R).
  - E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Brihat Jataka ch. 12 "Nabhasa yogas"** (BJ-Neely, V for the title): Varahamihira says Yavanas count 1,800 varieties, condensed to 32 (R).
- **Saravali ch. 21** (R).
- [MODERN] Raman, *300 Important Combinations* (all 32).

## 2. When it applies
D1, using whole signs; the seven planets only. A life-long general pattern; Self board flavour.

## 3. Inputs required
The signs of the seven planets, the lagna sign, and the benefic or malefic classification (waxing Moon and unafflicted Mercury as benefics).

## 4. Calculation / rule (R for each definition unless noted)
**Ashraya (3)**:
- Rajju: all planets in movable signs.
- Musala: all in fixed signs.
- Nala: all in dual signs.

**Dala (2)**:
- Mala (Srak): benefics in three kendras, with malefics not in kendras.
- Sarpa: malefics in three kendras, with benefics not in kendras.

**Akriti (20)**, all seven planets confined to:

| Yoga | Houses |
|---|---|
| Gada | Two adjacent kendras (1-4, 4-7, 7-10, 10-1) |
| Sakata | 1 and 7 |
| Vihaga | 4 and 10 |
| Sringataka | 1, 5 and 9 |
| Hala | The other trines (2-6-10, 3-7-11 or 4-8-12) |
| Vajra | Benefics in 1 and 7, malefics in 4 and 10 |
| Yava | Malefics in 1 and 7, benefics in 4 and 10 |
| Kamala (Padma) | All four kendras |
| Vapi | Only panaparas, or only apoklimas |
| Yupa | 1-4 (four consecutive houses from the lagna) |
| Ishu (Sara) | 4-7 |
| Shakti | 7-10 |
| Danda | 10-1 |
| Nauka | Seven consecutive houses from the 1st |
| Kuta | Seven consecutive from the 4th |
| Chatra | Seven consecutive from the 7th |
| Chapa (Karmuka) | Seven consecutive from the 10th |
| Ardhachandra | Seven consecutive starting from a non-kendra |
| Chakra | Six alternate houses from the 1st (1, 3, 5, 7, 9, 11) |
| Samudra | Six alternate from the 2nd (2, 4, 6, 8, 10, 12) |

**Sankhya (7)**, by the number of signs occupied:
- Vallaki (Veena) 7;
- Damini (Dama) 6;
- Pasha 5;
- Kedara 4;
- Shula 3;
- Yuga 2;
- Gola 1.

They apply only if no other Nabhasa yoga forms (BPHS 35.16-17, V).

3 + 2 + 20 + 7 = 32.

## 5. Interpretation rules
- [TEXT] Nabhasa yoga results are felt throughout life, independent of dasha (BJ 12 / BPHS 35, R).
- [TEXT] Sankhya yogas yield only when no Ashraya, Dala or Akriti yoga is present (BPHS 35.16-17, V).
- [TEXT] Sample results: Rajju wanderer, Musala steady and proud, Nala uneven fortune. Mala comforts, Sarpa hardship. Kamala famous and virtuous. Shula cruel and poor, Gola poor and dirty (R paraphrase).
- [COMM] Some commentators let the Ashraya yogas be overridden when an Akriti yoga is also present (R).

## 6. Variants and disputes
- **Which planets**: seven only (all classical texts). Some moderns add Rahu and Ketu; this is not classical.
- **Mala/Sarpa**: three kendras vs all kendras; whether the other group must be absent from kendras.
- **Ardhachandra**: the exact starting-house definition varies.
- **Precedence** beyond Sankhya is not uniformly stated.

## 7. Worked micro-example
Planets occupy only Aries, Cancer and Libra (all movable signs, three signs):
- Rajju (Ashraya).
- Shula (Sankhya) is suppressed because an Ashraya yoga exists.

## 8. Design notes for AI Astra
- **Engine already has**: all 32 in `yoga.py` (`rajju`, `musala`, `nala`, `maalaa`, `sarpa`, `gadaa` … `gola_yoga_from_planet_positions`).
- **Must output**:
  - every Nabhasa yoga present, with its group;
  - the precedence applied (a list of suppressed yogas with the reason);
  - the planet-sign map used;
  - the benefic/malefic rule for the Moon and Mercury.
- **Board use**: Self board, as "life pattern" colour.
- **Weight**: low for events.
- **Pitfall**: the classical results are harsh and generic (Shula "cruel"). Do not surface them raw. Use them only as a pattern tag tied to other confirmations.

## 9. Open questions
- Check the BPHS 35 definition verses individually against a clean print. The engine-rule-verifier agent should test them on the research kundlis.
