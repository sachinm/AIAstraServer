# Padanathamsa dasa (padanāthāṃśa daśā) and Pada-navamsa dasa

> A Narayana-type sign dasa seeded from the navamsa sign of the lord of the Arudha Lagna (pada-natha = lord of the
> pada; amsha = its navamsa). Jaimini 2.1.18 mentions death "in the pada-navamsa dasa", and the dasa's earliest full
> treatment is attributed to Krishna Mishra's *Jyotisha Phala Ratnamala* ch. 27; Laxmana Suri's *Jyotisha Pradipika*
> describes a related "Pada Navamsa dasa" started from AL in D1. Described by a modern author as primarily a phalita
> (results) dasa. Little used.

## 1. Sources
- [TEXT] JS-BSR 2.1.18 "tatrapi padesha-dasante pada-navamsa-dasayam pitri-dinesha-trikone va": if life is extended,
  death comes at the end of the dasa of the AL lord's sign, in the navamsa dasa of AL, or in trines from lagna/8th lords.
- [COMM reported] Krishna Mishra, *Jyotisha Phala Ratnamala* ch. 27; Laxmana Suri, *Jyotisha Pradipika* — via a
  publisher listing for a modern book on Padanathamsa dasa
  ([Exotic India](https://www.exoticindiaart.com/book/details/padanadhamsa-dasa-hck614/)). Not read.
- [ENGINE] `padhanadhamsa.py` ("TODO logic not fully implemented").

## 2. When it applies
[MODERN, reported] general results (phalita). JS 2.1.18 use is ayur.

## 3. Inputs required
AL (D1), its lord, that lord's navamsa sign, D9 positions; Narayana rules.

## 4. Calculation (ENGINE / modern, unverified)
Seed = stronger of (navamsa sign of AL's lord) and its 7th, compared in D9; then Narayana dasa rules. The engine then
computes periods with D1 planet positions (a choice the source book may not share). Pada-navamsa (Laxmana Suri): start
from AL sign in D1 — rules beyond that not found.

## 5. Interpretation rules
None read.

## 6. Variants and disputes
D9-seeded Padanathamsa vs D1 AL-seeded Pada-navamsa; which chart's positions give the years.

## 7. Worked micro-example
Not given.

## 8. Design notes for AI Astra
Research only. Engine marks it incomplete; keep off boards.

## 9. Open questions
Read *Jyotisha Phala Ratnamala* ch. 27 for the rule set.
