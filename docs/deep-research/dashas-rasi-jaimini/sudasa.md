# Sudasa (sudaśā; Sree Lagna Kendradi rasi dasa)

> A sign dasa started from the sign of Sree Lagna (the "Lakshmi" point), running kendras, panapharas, apoklimas with
> count-to-lord years, and with a balance at birth based on how far Sree Lagna has advanced in its sign. SJC (PVR)
> uses it for money, power and status: a favourable Sudasa period should coincide with prosperity. PVR says it is also
> called "Rasi dasa". Its classical root appears to be BPHS's "Lagnadi Rasi dasa" (46.188-190), whose seed arithmetic is
> the Sree Lagna formula (my inference). Well used in SJC; outside it, little known.

## 1. Sources
- [MODERN] PVR-VA 5.7 (Sree Lagna), ch. 20 (Sudasa computation and interpretation).
- [TEXT, inferred root] BPHS 46.188-189: seed = lagna longitude + (bhayat x 12 / bhabhog) signs, i.e. lagna + fraction
  of Moon's nakshatra elapsed x 360 deg (= Sree Lagna); 46.190 balance at birth. See lagnadi-rasi-dasha.md.
- Jaimini adhyayas 3-4 (where some place Sree Lagna/Sudasa material) not read.

## 2. When it applies
[MODERN] Material fortune: finances, business profit, positions of power (PVR 20.1). Every chart.

## 3. Inputs required
Exact Moon longitude and nakshatra span, exact lagna longitude (SL moves about twice as fast as the lagna: an error of
m minutes in birth time shifts SL by about m/2 degrees, PVR); lord positions; HL, GL, AL, A5 for interpretation.

## 4. Calculation [MODERN PVR-VA 20.2]
1. Sree Lagna longitude = lagna longitude + (fraction of Moon's nakshatra traversed) x 360 deg.
2. Seed = SL's sign. Direction: odd sign forward, even backward (plain odd/even). ENGINE also applies Saturn-in-SL
   forward and Ketu-in-SL reversal (engine docstring).
3. Order: kendras 1,4,7,10 from SL; panapharas; apoklimas.
4. Years as Narayana.
5. First dasa: only the fraction (30 deg - SL's degree in sign)/30 of its years remains at birth.
6. Antardasa: not stated by PVR; ENGINE uses odd/even from dasa sign with Saturn/Ketu rules.

## 5. Interpretation rules [MODERN PVR-VA 20.3]
- Dasas of HL's sign, the 7th from HL and signs aspecting HL bring financial prosperity; more so if the dasa sign's lord
  occupies/aspects HL or HL's lord occupies/aspects the dasa sign.
- Same with GL for power and authority.
- Upachayas (3/6/10/11) from AL grow status, 11th from AL especially; 8th and 12th from AL bring setbacks.
- Always check Narayana dasa alongside (PVR: "Narayana is important for power, Lakshmi gives prosperity").

## 6. Variants and disputes
- Whether Sudasa's years are count-to-lord (PVR) or Sthira years (as BPHS gives for its Lagnadi Rasi dasa) — unresolved;
  this is a real textual question if the BPHS root is accepted.
- Birth-time sensitivity: SL can change sign with a few minutes' error.

## 7. Worked micro-example (PVR Example 77, paraphrased)
SL 12 deg 21' Capricorn (even) -> backward: Cp, Li, Cn, Ar | Sg, Vi, Ge, Pi | Sc, Le, Ta, Aq. Balance of Cp =
(30 - 12.35)/30 = 0.588 of its 2 years.

## 8. Design notes for AI Astra
- Work board (money/standing) primary rasi dasa; Lucky board may use only its current period's tone, not dates.
- Engine output: SL longitude and sign, balance fraction, sequence, years with breakdown, and per-period flags
  (contains/aspects HL, GL; position from AL) computed in the engine, so Node only displays.
- Birth-time confidence must gate it: if SL is within ~2 deg of a sign edge, the engine should flag "unstable".
- Weight: equal to Narayana D10 for money/status questions; below Vimsottari for dates.

## 9. Open questions
- The classical text of Sudasa proper (Jaimini adhyaya 4?) unread.
- Whether to also expose the BPHS Lagnadi Rasi form (Sthira years) as a variant.
