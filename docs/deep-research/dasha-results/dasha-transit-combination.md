# Dasha and transit together (daśā-gocara samanvaya)

> Classical texts already combine the two: the dasha lord's own transit (to its exaltation, own or friendly sign, or to
> upachaya/trikona houses from lagna or Moon) makes the period auspicious; the bhukti lord transiting debilitation or
> enemy signs makes it miserable; the Sun entering the bhukti lord's exaltation releases the bhukti's good results.
> Modern practice adds K.N. Rao's Jupiter-Saturn "double transit" as a gate on top of dasha. This answers "when, within
> a supportive period, does the event happen".

## 1. Sources

- Phaladeepika (1950, wisdomlib OCR), ch. 20:
  - 20.34-35: during a dasha, a planet transiting its own, exalted or friendly sign promotes its bhava if strong at
    birth; if weak, eclipsed or debilitated at birth it destroys that bhava.
  - 20.36, 20.61-62: Moon's transit favourable in the dasha lord's exaltation or friendly sign, or 3/6/10/11, trine or
    7th from the lord; the Moon's sign stands for a bhava.
  - 20.37: bhukti lord transiting debilitation, enemy sign or eclipsed = misery; own/exalted sign or retrograde = good.
  - 20.38: good bhukti results manifest when the Sun enters the bhukti lord's exaltation sign; bad results when it
    enters its debilitation or enemy sign.
  - 20.59: dasha lord transiting the lagna or 3/6/10/11 from it, or saptavarga lagna positions, makes the dasha good.
  - 20.60: judge by the house from the Moon that the dasha lord occupies in transit.
  - 20.31-32: death triggers via Saturn and Jupiter transits (see maraka file).
- Saravali (English translation PDF, translator not named) ch. 41: 41.9 (the Sun ripens a dasha's results, the Moon
  sustains them, so the Moon's transit at the dasha start must be examined), 41.10-15 (Moon's sign and aspects on it at
  the dasha start colour the whole dasha; Mars or Saturn aspect = loss and illness), 41.16 (dasha lord in the lagna
  rising at the dasha start, or 3/6/10/11 from it = excellent dasha), 41.17-18 (Moon at the dasha start in a friendly
  or exaltation sign, an upachaya, or 5/9/7 from the dasha lord = good; otherwise even an exalted natal lord gives
  poor results). These are the earliest-read statements of the "dasha-start chart" (dasha pravesha) idea and match
  Phaladeepika 20.59-62.
- Phaladeepika ch. 26 (Gochara) for the general transit tables (not read in this pass; link below).
- BPHS 47.5-6, 48.8: lord's placement **at the dasha start** (a transit snapshot) decides the tone.
- BPHS 50.11-17 (rasi dasha): good at birth and in the dasha = full good; bad at both = only evil.
- [MODERN] K.N. Rao double transit: Jupiter and Saturn both influencing (by transit or aspect) the relevant house or
  its lord, within the supporting dasha. Only secondary sources were retrieved; Rao's books (e.g. on marriage timing
  with Chara dasha and transits over darakaraka/upapada) were seen as listings only.

URLs: https://www.wisdomlib.org/hinduism/book/phaladeepika-by-mantreswara-text-and-translation/d/doc1621592.html ;
https://www.wisdomlib.org/hinduism/book/phaladeepika-by-mantreswara-text-and-translation/d/doc1621598.html (ch. 26) ;
https://www.exoticindiaart.com/book/details/timing-of-marriage-with-tested-techniques-nao509/ (listing) ;
https://www.onlinejyotish.com/free-astrology/astrology-lessons/lesson_151.php (secondary)

## 2. When it applies

Always, as the second gate after the dasha/bhukti verdict. Life area = the bhava the transiting dasha/bhukti lord
represents.

## 3. Inputs required

Shared transit sky (one per day, per the project's "transit sky shared for all users" rule) plus the kundli overlay:
transit sign and dignity of the MD and AD lords, transit houses from lagna and Moon, Sun's ingress dates into each
planet's exaltation/debilitation signs, Jupiter and Saturn aspects to natal houses and lords, natal strength of each
lord.

## 4. Rule procedure

1. Natal strength of the lord (condition file).
2. MD lord transit: own/exalt/friend sign or 3/6/10/11 from lagna (PD 20.59) or good house from Moon (20.60) = support.
3. AD lord transit: debilitation/enemy/combust = block; own/exalt/retro = release (20.37).
3b. Dasha-start chart: cast the moment the MD (or AD) begins; check the lord's house from that moment's lagna
   (Saravali 41.16) and the Moon's sign/aspects (41.9-18).
4. Sun-ingress trigger: Sun into AD lord's exaltation sign dates the good event; into debilitation dates the bad
   (20.38). This gives a monthly marker.
5. Moon transit for days (20.36, 20.61-62).
6. [MODERN] Double-transit gate: Jupiter + Saturn both touching the target house or its lord, from lagna or Moon.

## 5. Interpretation rules

- [TEXT] Transit can only promote a bhava if the planet was strong at birth; weak at birth = transit good sign cannot
  save it (PD 20.34-35).
- [TEXT] Sun-ingress rule (PD 20.38).
- [MODERN] Double transit is a necessary-not-sufficient gate; transit without dasha gives nothing (consensus of
  secondary sources; no primary Rao text read).

## 6. Variants and disputes

Lagna vs Moon reference (PD uses both: 20.59 lagna, 20.60 Moon). Double-transit reference point and window length
vary by author. Ashtakavarga bindus of the transit sign are a further classical filter (Phaladeepika ch. 22-23, not
read here).

## 7. Worked micro-example

Venus AD running; Sun enters Pisces (Venus exalted) mid-March: PD 20.38 dates the bhukti's best results to that month.

## 8. Design notes for AI Astra

- Engine must export, per active period lord, the dated transit states (sign, dignity, house from lagna/Moon,
  combustion, retro) and Sun-ingress dates for exaltation/debilitation of each lord, plus Jupiter/Saturn aspects on
  natal houses/lords. Shared sky + per-kundli overlay; no Node computation.
- Lucky board (dates) and dated windows on Love/Work use steps 3-5; long windows use step 6.
- Weight: dasha first, transit second (every school).

## 9. Open questions

- Read Phaladeepika ch. 26 and the ashtakavarga transit chapter for the exact bindu thresholds.
- Locate K.N. Rao's own statement of the double-transit rule (book or Journal of Astrology article).
