# Lagnadi Rasi dasa / BPHS "Rasi dasa" (lagnādi rāśi daśā)

> The last rasi dasa in BPHS chapter 46 and the one simply called "Rasi" in the chapter's list. It adds to the lagna a
> number of signs proportional to the part of the Moon's nakshatra already elapsed, starts from the resulting sign, runs
> forward or backward by odd/even, gives Sthira years, and has a stated balance-at-birth rule. Its seed is
> arithmetically the Sree Lagna, so it is best read as the classical ancestor of Sudasa (inference). Rarely used under
> this name.

## 1. Sources
- [TEXT] BPHS 46.188-189: multiply bhayat (nakshatra time elapsed) by 12, divide by bhabhog (full nakshatra duration),
  add to the lagna longitude; the resulting sign starts the dasa; direction by odd/even; years as Sthira.
- [TEXT] BPHS 46.190: balance of a rasi dasa at birth = full years minus (expired degrees of the first sign x its years
  / 30).
- [TEXT] BPHS 46.6-11: "Rasi" in the list of dasas.

## 2. When it applies
Not stated.

## 3. Inputs required
Lagna longitude; Moon's nakshatra start/end (by longitude or time: bhayat/bhabhog); sign types.

## 4. Calculation
1. Seed longitude = lagna + 12 x (bhayat/bhabhog) signs [TEXT]. If the fraction is taken by longitude this equals Sree
   Lagna (PVR-VA 5.7); by time (ghatis) it differs slightly.
2. Direction: odd seed forward, even backward [TEXT].
3. Years: 7/8/9 [TEXT].
4. Balance at birth by the seed's degree [TEXT 46.190].
5. Antardasa: BPHS ch. 51 general rule (C5 in 00-overview).

## 5. Interpretation rules
General BPHS ch. 50 rasi dasa effects.

## 6. Variants and disputes
- Sudasa (PVR) uses the same seed but kendradi order and Narayana years.
- Tara-lagna dasa (JS 2.4.27, see tara-lagna-dasha.md) uses lagna + whole signs from a twelfth of the nakshatra, 9
  years each — a close cousin.

## 7. Worked micro-example
Moon half-way through its nakshatra, lagna 10 deg Aries: seed = 10 deg Aries + 6 signs = 10 deg Libra; Li 7 (balance
2/3 of 7 = 4.67), Sc 8, Sg 9...

## 8. Design notes for AI Astra
Expose as `rasi.bphs_lagnadi` in the engine only if Sudasa variants are compared; not a board item on its own.

## 9. Open questions
Whether bhayat/bhabhog are meant in time or longitude (affects the seed by small amounts).
