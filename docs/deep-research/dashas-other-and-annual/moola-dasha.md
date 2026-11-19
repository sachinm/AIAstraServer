# Moola Dasha (mūla-daśā, "root period")

> The name covers two different systems, and the engine uses it for the second.
> 1. **Mula dasha, the graha system** that Sanjay Rath attributes to Varahamihira. Planets run in kendra → panaphara →
>    apoklima order from the strongest of Lagna, Sun and Moon. It is paired with Naisargika dasha. Rath's school uses
>    it for karma and remedial timing.
> 2. **Moola dasha as pyjhora implements it.** This is "Lagna Kendradi Rasi dasha": a sign-based dasha that starts
>    from the stronger of Lagna and the 7th and takes Narayana-style sign periods.
>
> Neither name appears in BPHS's list of dashas (46.3–11). The systems are BJ-derived or modern. Reliability as a
> timing tool is not established outside SJC teaching.

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Varahamihira used two dasas: Naisargika and Mula. A result is sure when both agree. | Sanjay Rath, citing Brihat Jataka 8.9 — https://srath.com/jyoti%E1%B9%A3a/dasa/naisargika-dasha/ (BJ verse not verified this pass) | [MODERN] citing [TEXT] |
| Dasha order: strongest of Lagna/Sun/Moon, then kendras, panapharas, apoklimas | Brihat Jataka ch. 8 (Dashantardasha); verse not verified | [TEXT] |
| Not in Parashara's list of dashas | BPHS 46.3–11 (site numbering) — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46. The list has Kendrādyā (46.7), which is the kendradi sign family, but no "Mūla". | [TEXT] |
| Engine: "Also called Lagna Kendradi Rasi Dhasa" | AIAstra_Radha `src/jhora/horoscope/dhasa/raasi/moola.py` | engine |
| PVR Narasimha Rao, *Vedic Astrology: An Integrated Approach*: Lagna Kendradi graha/rasi dasa | Not opened this pass | [MODERN] |

## 2. When it applies (which charts, which life areas)

- **Rath's Mula dasha.** Taught for the "root" karma: curses, blessings, remedial measures and life lessons. No birth
  condition limits it.
- **Engine's rasi variant.** A general sign dasha for the natal chart.

## 3. Inputs required (exact chart data)

- Natal sign positions of the planets.
- The relative strength of Lagna vs 7th (engine), or of Lagna, Sun and Moon (BJ).
- Saturn's and Ketu's placement in the seed sign, for the engine's direction exceptions.
- Narayana-style sign-period inputs (the engine's sign lord rules).

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

**A. BJ / Rath graha Mula dasha** [TEXT]/[MODERN]. Details are not verified.

1. The first dasha goes to the strongest of Lagna, Sun and Moon. Rath's variant starts from the stronger of Lagna and
   the 7th.
2. Then the planets in kendras from it, then panapharas, then apoklimas. The stronger planet goes first.
3. **Period length.**
   - BJ: the planet's ayurdaya years (see `ayurdaya-dashas-pinda-amsa-nisarga.md`).
   - SJC: Vimshottari years with a balance correction. Not verified.
4. **Antardashas.** The BJ placement weights (conjunct 1/2, trine 1/3, 7th 1/7, 4th/8th 1/4).

**B. Engine "moola" (Lagna Kendradi rasi)** [engine; PVR-style]

1. **Seed** = the stronger of the Lagna sign and the 7th sign.
2. **Direction.**
   - Forward if Saturn is in the seed; backward if Ketu is in it.
   - Otherwise forward for an odd sign and backward for an even one.
3. **Order.** The seed's kendras, then panapharas, then apoklimas, in that direction.
4. **Period** of each sign = the Narayana dasha sign period (1–12 years), counted in sidereal years.
5. **Second cycle.** Each sign gets 12 − (first-cycle years). The run stops at the engine's life span.
6. **Antardasha.** The 12 signs from the dasha sign, forward or backward by the same parity and Saturn/Ketu rules.

## 5. Interpretation rules (tagged)

- **Agreement with Naisargika.** When Naisargika and Mula dasha both promise a result in the same window, it is sure.
  [TEXT] BJ 8 via Rath.
- **Remedial reading.** The dasha lord's curses and blessings ripen in its Mula dasha, and the remedial focus follows
  that lord. [MODERN] SJC; not verified at source.

## 6. Variants and disputes (school by school)

- **The name collision is the main dispute.** "Moola dasha" in pyjhora is the rasi system above. Jagannatha Hora was not
  checked. In
  Rath's BJ account it is a graha system. Labels in AI Astra must say which.
- **Seed.** BJ: strongest of Lagna, Sun and Moon. Engine and PVR: stronger of Lagna and 7th.

## 7. Worked micro-example (optional, short)

Take Lagna Aries, stronger than Libra. The seed is Aries, which is odd, so the count runs forward. The order is Aries,
Cancer, Libra, Capricorn, then Taurus, Leo, Scorpio, Aquarius, and so on. Each sign gets its Narayana-style years.

## 8. Design notes for AI Astra

- **This is an engine addition, not a fix.** The engine's `moola.py` duplicates `raasi/kendradhi_rasi.py`
  (`lagna_kendradhi_rasi_dhasa`), which has the same seed and direction logic. Label the existing `moola` export as
  the Lagna Kendradi rasi variant, or retire it in favour of `kendradhi_rasi`. If the graha Mula dasha is wanted, add a
  separate `mula_graha` (BJ 8) with verified rules.
- **Boards.**
  - Possibly the You board, as a "deep pattern" layer.
  - Not for dated predictions until a harness checks it against known events.
- **Weight.** Low. It is secondary to Vimshottari and the Jaimini rasi dashas (covered by other researchers).
- **Pitfall.** Showing "Moola dasha" without saying which system it is.

## 9. Open questions

- Open PVR's book and Rath's "Mula Dasa" material for the exact period rule (Vimshottari years minus what?) and the seed.
- BJ 8 verse text, to confirm the order and the antardasha rule.
