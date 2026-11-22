# Sub-sub-periods and deeper levels (pratyantar, sūkṣma, prāṇa)

> What the classical basis is for judging pratyantar (level 3), sukshma (4) and prana (5) periods. BPHS gives the
> arithmetic for each and a fixed description for every pair, but only one explicit judging rule (at 61.2: judge
> pratyantar by trikona/auspicious-house/benefic-varga placement, "all others in this manner"). Phaladeepika extends
> the bhukti rules to antara and antarantara. Beyond level 3, the texts give lists without judging rules.

## 1. Sources

- BPHS e-text (97-ch.): 61.1 (pratyantar length = AD length x planet years / 120), 61.2 (Sun-Sun pratyantar entry plus
  the rule: inauspicious effects are not produced if the Sun is in a trikona, lord of an auspicious bhava, or in an
  auspicious bhava and benefic varga; judge all other pratyantars the same way), 61.3-82 (fixed per-pair texts, no
  remedies); 62.1 sukshma arithmetic, 62.2-82 fixed texts, no rule; 63.1 prana arithmetic, 63.2-82 fixed texts, no
  rule; 50.97 (rasi-dasha chapter: pratyantar judged by the same method).
- Phaladeepika (1950, wisdomlib OCR) 21.2 (same arithmetic applies to deeper levels), 21.83 (finer subdivisions carry
  finer effects), 21.84 (antara and antarantara follow the bhukti logic; adapt to status and occupation).
- Repo: `docs/reading-engine/67-dasha-levels-1-6.md` (engine levels).

## 2. When it applies

Dating events to weeks (PD) and days (SD, prana) inside a supported AD.

## 3. Inputs required

Same per-lord condition fields as for AD; PD lord's position from AD lord and MD lord.

## 4. Rule procedure

1. Only refine an AD that is already judged (dasha-first).
2. PD lord: trikona / lord of a good house / good house + benefic varga = good (BPHS 61.2) [TEXT].
3. Position from AD lord: apply the 6/8/12 rule as at AD level. This is an inference from PD 21.84 ("antara and
   antarantara follow the same logic"), not a stated rule.
4. SD and prana: use the same, at low weight; texts give no extra rule.

## 5. Interpretation rules

- [TEXT] BPHS 61.2 rule; PD 21.84 extension.
- [MODERN] Practitioners use PD for month-level dating and only rarely SD; prana is mainly for rectification/prashna.

## 6. Variants and disputes

Whether PD judging counts from lagna or from the AD lord (61.2 uses houses/bhavas, i.e. lagna). Precision of birth
time limits SD/prana use, since small birth-time errors shift the shortest periods (not quantified in any text read).

## 8. Design notes for AI Astra

Engine already provides levels up to 6 (doc 67). Use L3 for dated windows; L4+ only with a birth-time confidence
flag. Weight: L3 < L2 < L1.

## 9. Open questions

Verify 61.2 wording on enjoylearningsanskrit chapter-61 verse-2.
