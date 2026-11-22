# Double transit (Jupiter and Saturn) [MODERN]

> An event signified by a house happens when both Jupiter and Saturn influence that house, or its lord, at the same
> time, by transit position or aspect, counted from the Lagna (and the Moon). The theory was popularised by K.N. Rao
> (Bharatiya Vidya Bhavan). It is a modern synthesis. There is no single classical verse for it, though its pieces (the
> two slowest planets as timers, graha drishti) are classical. In modern Indian practice it is widely trusted for
> marriage, career and childbirth timing, always under the dasha.

## 1. Sources
- **[MODERN]** K.N. Rao, *Planets and Children* and *Timing Events through Vimshottari Dasha*, and BVB course material. Not opened in this pass.
- **Classical building blocks:**
  - graha drishti: BPHS ch. 26 (Santhanam), with special aspects for Jupiter (5, 7, 9) and Saturn (3, 7, 10);
  - PD 26 gochara rules for both planets;
  - PD 24, which uses Saturn's transit as the year-timer.
- **No verse** prescribing a joint Jupiter + Saturn activation was located.

## 2. When it applies
Year-level timing of house events in a dasha that promises them:
- marriage: the 7th;
- career: the 10th;
- children: the 5th;
- property: the 4th.

## 3. Inputs required
- Jupiter's and Saturn's signs, and the signs they aspect.
- The natal Lagna, the Moon, and the house lords.

## 4. Calculation / rule
1. For each month, list the signs that Jupiter occupies or aspects: 5th, 7th and 9th from itself.
2. List the signs that Saturn occupies or aspects: 3rd, 7th and 10th from itself.
3. Find the signs in both lists.
4. Map them to natal houses from the Lagna, and optionally from the Moon.
5. A house is activated when its sign, or the sign holding its lord, is in the intersection.

## 5. Interpretation rules
- **[MODERN] K.N. Rao:** the event needs three things together:
  - natal promise;
  - a dasha connected to the house;
  - double-transit activation of the house or its lord.
  
  The double transit alone is insufficient.
- **[COMM]** Jupiter is the giver and Saturn the stabiliser/time-keeper. This is a traditional karaka logic, not a verse.

## 6. Variants and disputes
- **Reference:** from the Lagna only, or from both the Lagna and the Moon.
- **Lords:** whether the activation of the lord counts as well as the house.
- **Rasi drishti:** some use rasi drishti (Jaimini) instead of graha drishti. The engine's double transit, per its docstring, uses both.
- **Critique:** because Jupiter and Saturn aspect many signs, several houses are "double-transited" at once. The technique has low specificity alone.

## 7. Worked micro-example
1. Lagna Aries, so the 7th house is Libra.
2. Jupiter in Aquarius aspects Libra (its 9th aspect).
3. Saturn in Capricorn aspects Pisces, Cancer and Libra (its 3rd, 7th and 10th), so Saturn also aspects Libra.
4. The 7th is double-transited. Marriage is possible if the dasha agrees.

## 8. Design notes for AI Astra
- **Engine:** `double_transit` / `double_transit_month` already exist, by rasi and graha drishti, with natal houses.
- **Engine addition:** activation of house lords (the sign holding the lord).
- **Board:** Love (7th, 5th) and Work (10th, 6th, 11th) as one supporting signal.
- **Weight:** medium, and only together with the dasha.
- **Pitfall:** do not present it as classical, and do not headline it alone.

## 9. Open questions
- Should the product count the lord activation, and from the Moon as well as the Lagna? Each extra rule raises the hit rate and lowers the specificity.
