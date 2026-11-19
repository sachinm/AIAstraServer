# Drig dasa (dṛg daśā, "aspect dasa")

> A sign dasa that starts at the 9th house (dharma) and walks through the signs each of the 9th, 10th and 11th aspects
> by rasi drishti. SJC (PVR) uses it for spiritual growth: initiation, sadhana, renunciation. Both BPHS and Jaimini
> define the sequence; they differ on years (BPHS Sthira years; PVR count-to-lord years). Specialised and used mostly
> within SJC.

## 1. Sources
- [TEXT] BPHS 46.185-187: order 9th, the signs it aspects, 10th, the signs it aspects, 11th, the signs it aspects;
  movable signs counted backward, fixed forward, dual by odd/even (as summarised); years as Sthira.
- [TEXT] JS-BSR 2.4.21 "kujadi s(t)rikuta padakramena drigdasa": Drig dasa from the 9th (katapayadi "kuja" = 9) by
  trikuta padakrama; 2.4.22-23 (even-sign counting; BSR obscure).
- [MODERN] PVR-VA ch. 21 (computation, interpretation, examples).

## 2. When it applies
[MODERN] Spiritual vision and evolution, if the chart promises it (PVR 21.1). Not for material events.

## 3. Inputs required
Lagna; 9th, 10th, 11th signs; rasi drishti table; footedness; lord positions (for PVR years); AL, A5 (mantrapada),
A8, Ketu, Rahu.

## 4. Calculation
1. Groups: 9th + its three aspected signs; 10th + its three; 11th + its three [TEXT; PVR].
2. Within each group order the aspected signs going forward if the group head is odd-footed, backward if even-footed
   [MODERN PVR 21.2]. BPHS states the order by sign type (movable/fixed/dual) instead [TEXT, scan summary].
3. Years: BPHS = Sthira 7/8/9 [TEXT]; PVR = Narayana years [MODERN].
4. Antardasa: not given in texts; engine uses odd/even from the dasa sign with Saturn/Ketu exceptions.

## 5. Interpretation rules [MODERN PVR-VA 21]
Dasa of AL can bring renunciation if parivraja yogas exist; signs aspecting AL bring outer spiritual activity; lagna
and 7th bring inner awakening; lagna also fame for spreading spiritual knowledge; signs containing or aspecting A5
bring mantra initiation; sign with A8 brings yogic practice; Ketu's sign moves toward liberation; Rahu's sign brings
turmoil then progress, or materialism if Rahu is unfavourable.

## 6. Variants and disputes
Years (BPHS Sthira vs PVR Narayana). Within-group order rule (sign type vs footedness).

## 7. Worked micro-example (PVR Example 80, paraphrased)
Lagna Libra: Ge (9th, odd-footed) -> Ge, Vi, Sg, Pi; Cn (10th, even-footed) -> Cn, Ta, Aq, Sc; Le (11th, even-footed)
-> Le, Ar, Cp, Li.

## 8. Design notes for AI Astra
- Engine output: `drig.pvr` and `drig.bphs` (years differ). ENGINE `drig.py` uses Narayana years only (mismatch vs BPHS
  46.187, filed via research notes).
- Serves a possible "inner life" card on the Self board only when the chart promises spirituality; never as a general
  life timeline. Low weight.
- Keep wording free of religious claims; "a reflective period" rather than "spiritual awakening" unless the user asked.

## 9. Open questions
- BPHS within-group order wording (needs a cleaner edition).
