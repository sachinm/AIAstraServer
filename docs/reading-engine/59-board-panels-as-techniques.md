# 59 — The panels of the Self, Love and Work boards, each as a catalogued technique

Status: **specification, 2026-11-07.** Written for doc 58 (the You reading built as one technique per panel) at
Sachin's request through the Self-dashboard session: the panels of all three boards, in display order, each with its
purpose in the person's words and the contract it can be catalogued under. Doc 58 adapts the Self build to this; Love
and Work become catalogue rows (`status: 'planned'`) for the next build. Rules of docs 45, 46, 48, 53, 56 and 58 hold:
the engine is the only source of values, a missing field drops the line and records a gap, chart terms sit one tap
down, confidence words are used on timing only, natal facts are stated as facts.

## 0. Answer first

1. **Every board has the same spine and the same shape: a diagnosis, then the dated chapters, then the parts.** The first
   panel says in three sentences what the chart says about this area of the person's life; the second panel is the
   mahadasha spine of the kundli's reading clock, filtered to the houses of the board; the rest read the parts of the
   area. The person learns one page shape and reads all three boards with it.
2. **Four techniques are shared by all three boards and filtered by houses:** `board.chapters` (the dasha spine),
   `board.struggle` (afflictions with release dates), `board.year` (this year's chart on the frame) and `board.confirm`
   (the one question). They are written once, catalogued once per board as `<board>.reading.<panel>` rows that point at
   the shared code with a house filter, and doc 56 counts their reuse.
3. **The board-specific panels read the parts that only that area has.** Self: who you are, your mind, your soul's aim,
   gifts and knots. Love: the partner you draw, how you love, the bond itself, what tests it, who else is in it. Work:
   what you are built to do, how you are seen, where the work is now, what it pays, what tests it.
4. **Fact panels and timing panels are kept apart.** A fact panel reads natal rows only and may state facts (a lord's
   house, dignity, star, the yoga it forms); it never gives a date. A timing panel reads the clocks, the year chart and
   the sky and may give dates, graded with the confidence words, and never a natal fact the fact panels did not already
   state. The contract column "may claim" says which each panel is.
5. **Doc 58's seven Self panels stand, with four cuts** (§4): "Who you are" takes the paka lagna out and gains the Moon
   lagna; "Your mind" splits Jupiter out to "Your soul's aim" and gains the 3rd house; "Gifts and knots" becomes two
   panels only in words, one technique (gifts first, knots after); the confirm question moves to the end of every board
   and asks about the diagnosis claim, not the strongest claim by weight.

## 1. The page shape every board follows

| # | Panel kind | What the person reads | Technique | Fact or timing |
|---|---|---|---|---|
| 1 | Diagnosis | Three sentences: what this part of your life is like, the one tension in it, and where it stands now | `<board>.reading.diagnosis` (board-specific code over the board's fact panels and its chapters) | fact + the running chapter's date |
| 2 | Chapters | Previous, running and next chapter of the reading clock with dates, the running sub-chapter, what each chapter asks of this area, which clocks confirm | `board.chapters` filtered to the board's houses | timing |
| 3..n | Parts | The board's own fact panels (§2, §3, §4) | board-specific | fact |
| n+1 | Struggle | What tests this area now and when it lifts | `board.struggle` filtered | timing (release dates) over fact (afflictions) |
| n+2 | This year | What this year's chart puts on this area | `board.year` filtered | fact of the year chart, graded as a confirmation layer |
| n+3 | Confirm | One question about the diagnosis | `board.confirm` | — |

The diagnosis is listed first because it is what a guru says first; it is built last, from the other panels' claims, so
it never states a fact that no panel below it carries. On a phone the panels are a carousel in this order (Sachin's
modular rule); on desktop, tabs in this order with the diagnosis always visible above them.

## 2. Self (the You board), in display order

| # | Panel | Purpose, in the person's words | Technique |
|---|---|---|---|
| 1 | Who you are, in short | "The three things this chart says about me and the one knot in it" | `self.reading.diagnosis` |
| 2 | Your chapters | "What the last stretch of my life was, what this one is, what the next one brings, with dates" | `board.chapters` → houses 1, 4, 5, 9, 12 |
| 3 | Who you are | "Where my life is pointed, how firmly I stand, how the world sees me" | `self.reading.lagna` |
| 4 | Your mind | "How I feel, how I think, how I decide, what gives me peace" | `self.reading.mind` |
| 5 | Your soul's aim | "What I am here to learn and what I most want" | `self.reading.atma` |
| 6 | Gifts and knots | "What the chart gave me, and what it tied up" | `self.reading.yogas` |
| 7 | What you struggle with | "What is heavy right now and when it eases" | `board.struggle` → L1, Mo, Su, AK, houses 1, 4, 5 |
| 8 | This year | "What this year's chart puts on me" | `board.year` → house 1, the lagna lord, the Moon |
| 9 | One question | "Does this fit?" | `board.confirm` |

### 2.1 Contracts

Columns: what it must read (digest section · varga · rows), the points, the clocks and layers, what it may claim.
"Chain" is doc 58's `planetChain` (D1 sign, house, degree, dignity, star and star lord, dispositor and its house,
conjunctions, aspected-by, functional nature, owned houses, avastha; the D9 sign, house, dignity). "Frame" is
`houseFrame` (sign, lord, lord's house and dignity, occupants, graha aspects, SAV, class, cusp star and lord, arudha).

| Technique | Must read | Points | Clocks and layers | May claim |
|---|---|---|---|---|
| `self.reading.lagna` | house D1 h1 frame; planet D1+D9 chain of L1; planet D1 chains of every h1 occupant and of every planet aspecting h1; house D1 frame of the house L1 sits in; house D9 h1 frame; the Moon-lagna h1 (the D1 house the Moon sits in, read as a frame) | AL (sign, house, lord's house), the lagna's cusp star and its lord | none | fact: the direction of the self (L1's house and what that house is), its footing (dignity, avastha, star lord's house), who sits on or looks at the self and whether they help or press (functional nature), how the world sees the person (AL's house from lagna), the inner self (D9 h1 and its lord) |
| `self.reading.mind` | planet D1+D9 chains of Mo and Me; house D1 frames of h3, h4, h5; yoga D1 rows touching Mo (Neecha Bhanga, Kemadruma, Gaja Kesari, Chandra-Mangala, Ganda Moola); star: Moon star, pada, lord, deity | the Moon's dispositor as a point of its own (where feeling rests) | none | fact: how the person feels (Mo house, dignity, star), what presses on feeling (malefic on or aspecting Mo, Saturn's aspect), how the person thinks (Me house, dignity, with whom), courage and effort (h3 lord and occupants), peace (h4 frame), intelligence and creative mind (h5 frame); a yoga on the Moon stated by name with its effect |
| `self.reading.atma` | planet D1+D9 chains of Su and of the AK planet; planet D1+D9 chain of Ju (judgement, dharma, the guru within); house D1 h9 and h12 frames; house D9 frame of the karakamsa sign (the D9 house the AK occupies) and the D9 planets in it; house D1 frame of the house the AK sits in | AK (planet, D1 sign and house, D9 sign = karakamsa), AmK, the D9 lagna, A9 | none | fact: what the soul is learning (AK planet's faculty, its house, its dignity), what the person most wants (karakamsa house and the planets with it, per Jaimini), confidence and authority (Su house and dignity), faith and purpose (h9 frame, Ju), letting go (h12 frame, Ke); withheld with a gap when `point.AK.planet` is missing |
| `self.reading.yogas` | yoga D1 rows whose planets include L1, Mo, Su, the AK planet, or whose houses include 1, 4, 5, 9; dosha rows the same way | — | none | fact: each gift by name (raja, dhana, mahapurusha, viparita, neecha bhanga, gaja kesari, exchange) with the faculty it touches and the planets that form it; each knot (kala sarpa, kemadruma, guru chandala, ganda moola, pitru, manglik only when it touches h1) with the planet that activates it; gifts listed before knots; nothing that is not a present engine row |
| `self.reading.diagnosis` | the claims of the four panels above and of `board.chapters` for this board | — | the running chapter's dates | three sentences: the direction and footing of the self (from lagna), the central tension (the strongest knot, or the heaviest affliction with a release date when one runs), where the person stands now (the running chapter and sub-chapter, dated); each sentence carries the claim ids it was built from |

### 2.2 Shared techniques, filtered for Self

| Technique | Filter for Self | Must read | May claim |
|---|---|---|---|
| `board.chapters` | houses 1, 4, 5, 9, 12; planets L1, Mo, Su, AK | activation: reading clock L1 and L2 (birth to +40 years), every confirming clock L1; planet D1 chain of each chapter lord; the running MD lord's `dashaCharter.fruition[AD]` | timing: three dated chapters; per chapter, the houses the lord activates from lagna and from the Moon, its dignity and star lord, the self-faculty it rules; confirmed / likely / split by doc 58's boundary rule; the running sub-chapter's dates and what it presses (the AD lord's houses from the MD lord) |
| `board.struggle` | planets L1, Mo, Su, AK; houses 1, 4, 5 | the chains and frames the Self fact panels already read; activation: reading clock L1–L3 running | fact: each affliction (lord in 6/8/12; debilitation without a cancellation row; mrita or sushupta avastha; Sa, Ra or Ke on or aspecting the self or the Moon; Kemadruma; sade sati when the sky overlay is stored); timing: the release date only when the afflicting planet is a running lord of the reading clock, from the stored period end |
| `board.year` | house 1, the natal L1, the Moon | annual: the current TP row (lagna, h1 frame, the year house holding the natal L1, the year house holding the natal Moon, the TP year-dasha lord running); the VP Mudda lord running | fact of the year chart, graded confirms / amplifies / contradicts / silent against the running chapter; never a verdict alone; withheld when no TP row covers today |
| `board.confirm` | the diagnosis's central-tension claim | the diagnosis claims and the person's stored `self.confirm.*` facts | one yes / no / rather-not question in plain words about the central tension; the answer is sealed (doc 48) and gates that claim on the next build |

## 3. Love (the Love board), in display order

The Love board reads house 7 with 5, 11, 2, 4, 8 and 12; Venus, Jupiter, the Moon, the 7th lord; DK and UL (doc 45
§8.2, doc 46 §B.12). The person's `love.status` (single, dating, committed, married, separated, complicated) selects
which part panels show, as `LOVE_FIT` does today; the spine, struggle, year and confirm panels show for everyone.

| # | Panel | Purpose, in the person's words | Technique | Shown for |
|---|---|---|---|---|
| 1 | Your love life, in short | "What this chart says about me and partnership, the one tension, where it stands now" | `love.reading.diagnosis` | all |
| 2 | Your chapters | "The last stretch, this one, the next, for love, with dates" | `board.chapters` → houses 7, 5, 11, 2, 8 | all |
| 3 | How you love | "What I give, what I need, how I bond" | `love.reading.heart` | all |
| 4 | The partner you draw | "Who comes into my life and what they are like" | `love.reading.partner` | single, dating, complicated |
| 5 | The bond itself | "What holds us, what the marriage or union is made of" | `love.reading.bond` | dating, committed, married, separated |
| 6 | Who else is in it | "Family, in-laws, children, friends around the bond" | `love.reading.circle` | committed, married, separated, complicated |
| 7 | What tests it | "What strains love now and when it lifts" | `board.struggle` → L7, Ve, DK, UL, Mo; houses 7, 5, 8, 12 | all |
| 8 | This year | "What this year's chart puts on love" | `board.year` → house 7, Venus, the natal L7 | all |
| 9 | One question | "Does this fit?" | `board.confirm` | all |

### 3.1 Contracts

| Technique | Must read | Points | Clocks and layers | May claim |
|---|---|---|---|---|
| `love.reading.heart` | planet D1+D9 chains of Ve, Mo and L5; house D1 frames of h5 and h7; house D9 h7 frame and D9 Ve | — | none | fact: how the person loves (Ve house, dignity, star), what they feel in love (Mo), romance and play (h5 frame, L5), the shape of partnership in the inner chart (D9 h7); a Ve or Mo affliction named here as a trait, not as a verdict |
| `love.reading.partner` | house D1 h7 frame; planet D1+D9 chain of L7; planet chain of the DK; house D9 h7 frame and its lord; planet D1 chains of h7 occupants and of planets aspecting h7 | DK (planet, sign, house), UL (sign, house, lord), A7, D9 lagna | none | fact: the kind of partner the chart draws (h7 sign, L7's house, DK planet's faculty and house, per Jaimini), from where (L7's house: work, abroad, family, study), what the partner brings (D9 h7); never a description in moral words, never a yes or no on marriage |
| `love.reading.bond` | house D1 frames of h7, h2, h4, h8; house D9 frames of h7 and h1; planet chains of L7, L2, L8 and Ju; D7 h1 frame and D7 lagna lord (children in the union, facts only, no prediction) | UL and its 2nd (what sustains the bond), A7, DK | none | fact: what the union is made of (h7 and D9 h7), what sustains it (UL, its 2nd, Ju), family life and money together (h2), peace at home (h4), closeness and trust (h8); separation is never a verdict (doc 45 §8.2), only strain with a date in the struggle panel |
| `love.reading.circle` | house D1 frames of h2, h4, h11, h5; planet chains of L2, L4, L11, Mo, Ju; D7 h5 frame | MK, PK, A11 | none | fact: family and in-laws (h2, h4, Mo, Ju), friendships and the wider circle (h11), children in the picture (h5, D7, PK) stated as facts of the chart only, nothing about a child under 18 |
| `love.reading.diagnosis` | the claims of the Love fact panels that fit the status and of `board.chapters` for this board | — | the running chapter's dates | three sentences: how the person loves and what they draw, the central tension (the strongest knot on 7, Ve, UL or DK, or the heaviest running affliction with its release), where love stands now (the running chapter, dated) |

### 3.2 Shared techniques, filtered for Love

| Technique | Filter for Love | What differs from Self |
|---|---|---|
| `board.chapters` | houses 7, 5, 11, 2, 8, 4, 12; planets L7, Ve, DK, Ju, Mo | per chapter: the love-houses the lord activates and the UL or A7 the chapter sign holds when the clock is a sign clock (Narayana, Chara) |
| `board.struggle` | planets L7, Ve, DK, Mo, UL's lord; houses 7, 5, 8, 12 | afflictions: Sa, Ma, Ra, Ke on or aspecting 7, Ve or UL; Kalathra and Manglik rows; L7 in 6/8/12; Ve debilitated without a cancellation; release from the running clock as for Self |
| `board.year` | house 7, Venus, the natal L7, UL's sign | the TP year house holding the natal L7 and Venus; the Vivaha and Preethi sahams when stored |
| `board.confirm` | the diagnosis's central-tension claim | the answer is sealed as `love.confirm.<claimId>`; the status fact (`love.status`) continues to gate the part panels |

## 4. Work (the Work board), in display order

The Work board reads house 10 with 6, 11, 2, 9, 3, 5 and 7; the 10th lord, Saturn, Mercury, the Sun, Jupiter, the AmK;
A10 and AL; D10 first, then D1, D9, D24, D60 (docs 42, 43, 45 §8.1). The existing career map (seventeen sub-areas and
the work-status fact) stays as the Work board's second page; these panels are its first page, the reading, in the same
shape as the other boards.

| # | Panel | Purpose, in the person's words | Technique |
|---|---|---|---|
| 1 | Your work life, in short | "What this chart says about me and work, the one tension, where it stands now" | `work.reading.diagnosis` |
| 2 | Your chapters | "The last stretch, this one, the next, for work, with dates" | `board.chapters` → houses 10, 6, 11, 2, 9, 3 |
| 3 | What you are built to do | "The kind of work I am made for, and how I do it" | `work.reading.vocation` |
| 4 | How you are seen | "My standing, my name, what people take me for" | `work.reading.standing` |
| 5 | Where the work is now | "The job, the daily grind, the people around it" | `work.reading.ground` |
| 6 | What it pays | "Earnings, gains, what work brings home" | `work.reading.gain` |
| 7 | What tests it | "What strains work now and when it lifts" | `board.struggle` → L10, L6, Sa, AmK, Su; houses 10, 6, 11 |
| 8 | This year | "What this year's chart puts on work" | `board.year` → house 10, the natal L10, Saturn, A10 |
| 9 | One question | "Does this fit?" | `board.confirm` |

### 4.1 Contracts

| Technique | Must read | Points | Clocks and layers | May claim |
|---|---|---|---|---|
| `work.reading.vocation` | house D1 h10 frame; planet D1+D9+D10 chains of L10; house D10 frames of h1 and h10; planet chains of the AmK and of every planet in D1 h10 and D10 h10; planet chains of Sa, Me, Su, Ju (the four karakas of work); house D1 h3 and h5 frames (skill, intelligence); D24 h1 and h4 when the person's `work.status` is studying | AmK (planet, sign, house), A10, karakamsa for the Jaimini vocation rule (the planets in the karakamsa sign and in its 10th) | none | fact: the kind of work (L10's house and sign, the planets in h10 and D10 h10, the AmK's faculty, the karakamsa rule), how the person works (Sa, Me, Su dignities and houses as the working style), the strongest of the four karakas and what it points to; ranked as doc 43 ranks sub-areas, never a single named profession as a verdict |
| `work.reading.standing` | house D1 frames of h10 and h1; planet chains of Su and L10; house D1 frame of the AL's house; house D10 frame of the house the AL falls in | AL, A10, the D10 lagna | none | fact: how the world sees the person at work (AL's house and its lord, A10), authority (Su), rank and name (h10 frame, D10 lagna); recognition is a fact of the chart here and a window in the career map, not both |
| `work.reading.ground` | house D1 frames of h6 (daily work, rivals, service), h3 (effort), h7 (partners and clients), h12 (travel for work, 3rd from the 10th); planet chains of L6 and L3; house D10 frames of h6 and h3 | A6, A3 | none | fact: the daily ground of work (h6 frame and L6), effort and competition (h3, the 6th from the 10th), who the person works with or for (h7), travel for work (h12 and the 3rd from the 10th); never a prediction of a job end here (that is the career map's windows under doc 43 §7) |
| `work.reading.gain` | house D1 frames of h11 (2nd from the 10th), h2; planet chains of L11 and L2; D2 h1 frame and lord when stored; D10 h11 frame | A11, A2, the Dhana yogas touching L10, L11, L2 | none | fact: what work pays and how (h11 frame, L11's house, the 2nd from the 10th), money in hand (h2, D2), the gain yogas formed by work lords; no amounts, no "when will I be rich" (doc 45 words list) |
| `work.reading.diagnosis` | the claims of the four Work fact panels and of `board.chapters` for this board | — | the running chapter's dates | three sentences: what the person is built to do and how they stand, the central tension (the strongest knot on 10, L10, Sa or the AmK, or the heaviest running affliction with its release), where work stands now (the running chapter, dated) |

### 4.2 Shared techniques, filtered for Work

| Technique | Filter for Work | What differs from Self |
|---|---|---|
| `board.chapters` | houses 10, 6, 11, 2, 9, 3, 5, 7; planets L10, Sa, Me, Su, Ju, AmK | per chapter: the work-houses the lord activates from lagna, from the Moon and from the AL (doc 43's three reference points), and A10 when the clock is a sign clock; the chapter sentence names the kind of work the lord rules (its faculty), not a job event |
| `board.struggle` | planets L10, L6, Sa, AmK, Su; houses 10, 6, 11, 2 | afflictions: L10 in 6/8/12; Sa debilitated or mrita; Ra or Ke on 10 or the AL; the bad-period cluster of doc 43 §5 named as a running strain with its release; never the layoff, firing or resignation signatures (doc 43 §6 belongs to the career map, which may state a window) |
| `board.year` | house 10, the natal L10, Saturn, A10 | the TP year house holding the natal L10 and Saturn; the Karma and Labha sahams when stored; the year-dasha lord's relation to h10 |
| `board.confirm` | the diagnosis's central-tension claim | the answer is sealed as `work.confirm.<claimId>`; `work.status` continues to gate the career map's sub-areas on the second page |

## 5. Shared across boards: what is one technique and what is three rows

| Shared technique | Code | Catalogue rows | Freshness | Output |
|---|---|---|---|---|
| `board.chapters` | one function `(view, rows, clock, filter) => ChaptersPanel`; `mdSpine` of the reading clock, the confirming clocks' L1 rows, each chapter lord's chain; the filter is `{ houses, planets, points }` | `self.reading.chapters`, `love.reading.chapters`, `work.reading.chapters` | dasha (the running L2 span) | `board_chapters.v1` |
| `board.struggle` | one function over the chains and frames in the filter and the running chain | `self.reading.struggle`, `love.reading.struggle`, `work.reading.struggle` | dasha | `board_struggle.v1` |
| `board.year` | one function over the current TP and VP rows and the filter's natal planets and houses | `self.reading.year`, `love.reading.year`, `work.reading.year` | annual | `board_year.v1` |
| `board.confirm` | one read-time step over a board's diagnosis claims and the sealed `<board>.confirm.*` facts | not stored (doc 58 §7a) | read | question + claim id |
| `board.diagnosis` | one shape (three sentences with claim ids), three word tables (`DIAGNOSIS_SELF`, `_LOVE`, `_WORK`) and three selectors for "the central tension"; one function | `self.reading.diagnosis`, `love.reading.diagnosis`, `work.reading.diagnosis` | the shortest freshness of its inputs (dasha) | `board_diagnosis.v1` |

The slicers of doc 58 (`planetChain`, `houseFrame`, `pointOf`, `yogasTouching`, `runningChain`, `mdSpine`) serve all
fourteen board-specific panels; no board gets its own copy. Each catalogue row carries the filter in its `contract.inputs`
filter strings (for example `activation · reading clock L1–L2 and confirming clocks L1, houses 7,5,11,2,8 · activation_row`),
so the admin Techniques page shows three rows with one code path, and doc 56's reuse report counts the shared pieces.

The model layer of doc 58 (`R15-self.md`, `oracle/self.md`) is the Self instance of a `board.oracle` step that takes a
board's panel claims; Love and Work get `R16-love.md`, `R17-work.md` and `oracle/love.md`, `oracle/work.md` with the same
order of writing (diagnosis, chapters, the parts, the struggle, this year, one question). Not before Sachin's yes on cost.

## 6. Corrections to doc 58's seven Self panels

1. **"Who you are": drop the paka lagna, add the Moon lagna and the D9 lagna.** The paka lagna (the sign the lagna lord
   sits in) is already the lagna lord's house in the chain; naming it twice adds a term without a claim. The house the
   Moon occupies, read as a frame, is the second reference point of every classical reading and is missing; the D9
   lagna and its lord are the inner self and belong here, not only under atma.
2. **"Your mind": add the 3rd house and take Jupiter to "Your soul's aim".** Courage and effort (h3) are a faculty of
   the mind a person recognises in themselves; Jupiter as judgement and faith reads better beside the Sun, the 9th and
   the 12th. The Moon's star deity and lord should be a claim ("your feeling moves through <lord>"), not only an evidence
   key.
3. **"Gifts and knots": one technique, two word blocks, gifts first.** Keep the single yoga row read; render gifts
   before knots so the person's first sight of the chart's content is what it gave. Manglik belongs here only when it
   touches h1; otherwise it is Love's.
4. **"Your chapters": name the faculty per chapter, confirm per chapter, and show the sub-chapter's own date.** Doc 58
   has this; add that the chapter's sentence names the self-faculty the lord rules (from `PLANET_FACULTY`) and the houses
   from the Moon as well as from lagna, so a Moon-strong chart does not read as if from lagna alone.
5. **The confirm question asks about the diagnosis's central tension, not the heaviest claim by weight.** A weight-3
   claim may be a gift; a question about a gift teaches nothing. The question is always about the tension, and the
   answer gates it.
6. **Add the diagnosis panel and put it first.** Doc 58 has no first panel that says what the chart says about the
   self in three sentences; the guru's opening is what Sachin asked for. Built from the other panels' claims, it adds no
   fact and can be tested by claim ids.

## 7. What is not in a panel, on purpose

- No remedies, gemstones, mantras; no death, longevity or illness; nothing about a child under 18; no amounts.
- No transit windows on the boards' first page: the sky overlay feeds `board.struggle` (sade sati, a slow planet on
  the frame) as a fact with its stored dates, and the career map's second page as windows. Short-term windows stay in
  the existing tabs and in Lucky times.
- No prediction of marriage, separation, a job end or a job offer on the first page. Those are windows, with the
  confidence words, on the second page of Love and Work, under docs 43 and 45's rules.

## 8. Recommendation

Build the shared five first (`board.chapters`, `board.struggle`, `board.year`, `board.confirm`, `board.diagnosis`) on
the Self board, with Self's four part panels as doc 58 has them after the §6 cuts; register the Love and Work rows as
planned with the contracts above, so the catalogue and the admin page show the whole design before the second build.
Worked example and acceptance test are doc 58 §10: Sachin reads his own previous chapter and recognises it.
