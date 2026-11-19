# Prastara ashtakavarga (prastāra-aṣṭakavarga)

> For one planet's BAV, the prastara is the full 8 x 12 grid. The rows are the eight contributors and the columns are
> the twelve signs, and each cell holds 0 or 1. It records who gave each bindu, which kakshya timing needs. Textual:
> Phaladeepika 23:17-18.

## 1. Sources
- **Phaladeepika 23:17-18** (siva.sh): https://www.siva.sh/phaladeepika/23/16-20
  - The grid is drawn with 9 east-west lines crossed by 13 north-south lines, giving 96 cells.
  - From south to north, the row lords are Lagna, Moon, Mercury, Venus, Sun, Mars, Jupiter and Saturn.

## 2. When it applies
- Kakshya timing (`11-kakshya.md`).
- Identifying which contributor supports a transit. For example, a bindu from the 10th lord's planet supports career.

## 3. Inputs required
- The BAV contribution lists (`07-bhinnashtakavarga.md`).
- The natal signs of the planets and the Lagna.

## 4. Calculation / rule
1. Take one subject planet P.
2. For each contributor R, mark 1 in each sign reached by counting R's listed houses from R's natal sign.
3. Row sums give R's contribution to P. Column sums give P's BAV per sign.
4. [TEXT] PD 23:18 orders the rows in kakshya order, reversed (Lagna at the south). The cell (kakshya lord, sign) answers "has_bindu".

## 5. Interpretation rules
- **[TEXT] PD 23:18:** when P transits a sign, the bindu that its current kakshya lord gave there yields its effect.
- **[MODERN] SJC and C.S. Patel:** read the contributors as themes. A transit supported by bindus from the dasha lord, or from the lord of the house in question, is weighted up.

## 6. Variants and disputes
None of substance. The row order is only a drawing convention.

## 7. Worked micro-example
Jupiter's prastara for Pisces may hold bindus from the Sun, Mars, Jupiter, Venus and the Lagna, giving a BAV of 5. Jupiter then transits Pisces:
- in Mars's kakshya (7°30'-11°15'): good;
- in Saturn's kakshya (0°-3°45'): no bindu.

## 8. Design notes for AI Astra
- **Engine:** pyjhora's `get_ashtaka_varga` returns the prastara. The export uses it for `has_bindu`.
- **Engine addition:** export the per-sign contributor list for each transiting planet, e.g. `contributors: ["Sun","Mars",...]`, so readings can name the supporting contributor.
- **Board:** internal evidence. Shown only as "who supports this window".

## 9. Open questions
- None blocking.
