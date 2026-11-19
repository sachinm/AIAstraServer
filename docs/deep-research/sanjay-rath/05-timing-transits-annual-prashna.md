# Sanjay Rath: timing layers, transits, annual charts and prashna

Purpose: Record what the Rath sources say about Tithi Pravesha, annual against natal precedence, transits, Sudarshana and prashna, what they do not say about combining methods, and give a clearly labelled inferred reading order.
Sources: research_notes/Sanjay Rath methods and precedence/timing_confirmation.md (main), dasha_selection.md, verification_and_questions.md, existing_techniques_inventory.md section 3; research_notes/Sanjay Rath method summary/parashari_timing.md; reports/Sanjay Rath method summary.md (annual charts); reports/Sanjay Rath life area readings.md (sections 3, 8).
Informs: timing windows on boards (year, month, week); lucky times board; transit reading; whether prashna can be used as a confirm layer.

Tier key: [A] Rath's own text; [B] student; [C] third party; [Inferred]. "Opened" pages were read through a summarising fetch. Each search was run once, so "not found" means not found in those results.

---

## 1. Tithi Pravesha (annual chart)

### 1.1 Casting

| Rule | Tier | Citation | Engine |
|---|---|---|---|
| The annual moment is when the Sun is in its natal sign and the Moon is at the same angle from the Sun as at birth; cast for the birthplace regardless of residence; called the truest astrological birthday; throws light on the coming year | [A, co-credited with P.V.R. Narasimha Rao] | [srath.com, Tithi Pravesha](https://srath.com/jyoti%e1%b9%a3a/tithi-pravesa/tithi-pravesha/) | computed (`annual.tithi_pravesha`, any varga) |
| The page uses "solar return" only for a contrasting Tajika method; whether Tithi Pravesha itself is of Tajika origin is unresolved between two fetches | [A, co-credited] | same | n/a |
| The page gives no reading rules: no year lord, hora lord, houses or dasha within the year | [A, co-credited] | same | n/a |
| Year starts when the Sun is back in its sign and the birth tithi recurs (place not stated) | [B, Poddar, opened] | [Sanskriti Magazine](https://www.sanskritimagazine.com/principles-of-tithi-pravesh-chakra-in-vedic-astrology/) | computed |
| Cast when the Moon is at the birth angle from the Sun within the same soli-lunar month as birth | [B, Rao 2014, snippet only] | [vedicastrologer.org, pp_tp.pdf](https://www.vedicastrologer.org/articles/pp_tp.pdf) (unread PDF) | computed |
| A Jyotish Digest article (May 2002) co-written by Rao and Rath carries the Sun-Moon angle definition | [B, snippet] | [Scribd, Tithi Pravesh-5](https://www.scribd.com/document/347971271/Tithi-Pravesh-5) | n/a |
| The method stayed within a tradition until Rath made it known | [B] | Sanskriti Magazine | n/a |

### 1.2 Year lord dispute

| Position | Tier | Citation |
|---|---|---|
| Weekday lord at the start of the tithi year is the year lord (weekday runs sunrise to sunrise; a pre-sunrise start counts as the previous weekday). A year lord that is a functional benefic for the natal lagna and well placed gives a good year; it activates its natal yogas. The hora lord is a separate factor, called the most important of the three | [B, Poddar, opened] | Sanskriti Magazine |
| The hora lord at the TP moment is the lord of the year | [B, Rao, snippet only] | pp_tp.pdf (unread) |
| The tithi lord at the TP moment is the year lord | [C, search summary, page not pinned] | likely [dekhopanchang](https://dekhopanchang.com/en/learn/tithi-pravesha), unconfirmed |

No tier A text settles it. Engine: the TP row carries the year lord's retrograde, motion and combustion flags but does not name the TP year lord; the hora at the TP moment is derivable from the `muhurta` horas (partial).

### 1.3 Other Poddar reading rules [B, opened]

- TP lagna counted from the natal lagna: a kendra gives happiness, a trikona prosperity, a dusthana or badhaka house obstacles. Engine: inputs computed.
- The TP lagna lord shows success or failure in undertakings.
- The hora lord sets the year's focus by ownership, placement and yogas, refined in the vargas.
- The same principles extend to Masa (month) and Dina (day) pravesha charts. Engine: not listed.
- He names no dasha within the year, and says to read the TP chart like a normal rasi chart (no specific houses).

## 2. Annual against natal

- The natal chart has overriding influence; the TP chart cannot be read on its own. [B, Poddar, opened] Sanskriti Magazine.
- No tier A rule was found for an annual chart confirming, refining or overriding a natal dasha. [A, absence] Tithi Pravesha page; method summary report.
- Dasha within the TP year: the 2008 example (section 3) runs Moon-started Vimshottari inside the annual chart. An unpinned search summary says the TP dasha is Tithi Ashtottari; no page was tied to that. Tithi Ashtottari does appear in Rath's udu book contents (Ch. 7.5-7.6) with its use unread. Unresolved. Engine: `annual.tithi_pravesha_dasha` computes tithi_ashtottari, mudda or patyayini bounded to the TP year; a compressed TP Vimshottari is not computed.
- Tajika Varshaphala (Muntha, Mudda dasha, year lord by Panchadhikari): no Rath text found; his TP page treats Tajika only as a contrast. Whether he uses Tajika at all is unknown. PVR names Tajaka annual and monthly charts as his own tools for one-to-two-week predictions [B] (PVR footnote 69). Engine: `annual.varsha`, `annual.tajaka`, `annual.mudda` computed.

## 3. The India 2008 example

[srath.com, India Tithi Pravesh 2008](https://srath.com/jyoti%e1%b9%a3a/mundane/india-tithi-pravesh-2008/). Byline conflict: one fetch reported Rath as author; another fetch and the earlier report found none. Do not treat as tier A. Posting path suggests December 2010. Mundane chart, not natal.

- Runs Vimshottari started from the Moon inside the annual chart to antardasha and pratyantara: Ketu antardasha in Venus dasha read as maraka; Moon pratyantara read as the chart's 3rd lord.
- Compares the 2008 chart with the 1971 chart for repeating configurations (Saturn in the 7th; the Mars-Saturn Yama yoga).
- Uses digbala, parivartana, marana karaka sthana, the AL and the AK.
- Compares transiting Rahu in Capricorn and Ketu in Cancer with 1971 as a supporting check.
- Names no year lord or hora lord.

It layers a repeating configuration, a sub-period inside the annual chart and the nodes' transit, but states no agreement rule.

## 4. Transits: what was found and the gaps

Found:
- A mundane srath.com article (byline not shown) judges transiting Jupiter as protector by counting malefic hits (conjunction, aspect of unstated type, papa kartari, a Mars-Ketu pair) counted from Jupiter, giving a percentage; no vedha, ashtakavarga, dasha or annual chart. The formula was inferred by the fetch. [A?, byline unconfirmed] [srath.com, Curse of Jupiter in Sagittarius](https://srath.com/jyoti%e1%b9%a3a/mundane/curse-of-jupiter-in-sagittarius/).
- Career transits: Saturn over the A10 brings loss of title; Saturn aspecting the AL damages image; Jupiter over the AL gives a victory. [A] *Crux* Ch. XIII (life area report, section 3).
- Marriage triggers: Jupiter's transit over the 7th, the 7th lord or the 2nd from the UL; also the Sun's transit. [A] *Crux* Ch. X, approx. pp.151-163 (summarised chapter).
- Progressions (not gochara): auspicious events from Jupiter's sign or its 7th at one year per sign; inauspicious from Saturn at two and a half years per sign; a marriage example times Saturn's progression over natal Venus. [A] *Crux* Ch. I.
- Narayana Dasa contents list "effect of transit" and "ashtakavarga" as headings only. [A, headings]
- Student *Varga Chakra* chapters cover transits from the varga Moon and lagna (contents only). [B]

Engine: transits from lagna and Moon, double transit, sade sati, kantaka, transit ashtakavarga with kakshya, exact contacts, all computed. Transits over arudhas: not listed as an overlay (partial: positions available). Vedha: not computed. Divisional ashtakavarga: not computed.

Gaps (no Rath text found): the gochara reference point (Moon, lagna, AL or natal planets); vedha; ashtakavarga transit rules; Sade Sati; Jupiter-Saturn double transit; general transits over arudhas; nodes beyond the 2008 example; Sarvatobhadra (an unpinned summary credited a Scribd paper to Rath, but the opened upload showed no author); Kota chakra (one page mentions working on it, no rules); tara bala; any ranking among transit methods. Saturn or Jupiter over the 10th from lagna and business start dates are also unstated.

## 5. Sudarshana

- Rath uses the Sudarshan chakra in *Crux* examples to fix the year: a marriage timed by Saturn's progression over natal Venus with the Sudarshan chakra cited for the year; a delayed marriage with Venus in the UL linked to a Sudarshan sign (*Crux* Ch. I, pp.183-184; both retrospective). [A] Also: use the Sudarshana chakra with Venus as focus for marriage timing (*Crux* Ch. X). Parent-death timing refined by Sudarshana: [Sensitive] source rule, not for readings without owner decision.
- No Rath rule for the triple reference, the year house, monthly or daily subdivision, or combination with dasha. srath.com search for "sudarshana" returned nothing technical.
- One house per year of life, cycling every 12 years, recommended alongside Vimshottari. [C, calculator site, not tied to Rath] [PanchangBodh](https://panchangbodh.com/sudarshana-chakra-calculator).
- An unpinned summary mentions Sudarshana dasha lessons in a course outline suggesting Rao teaches it. Not a finding.

Engine: in the engine's library but not exported (an export would be needed).

## 6. Prashna

- Visti Larsen's Rama Academy course teaches Prashna-kendra (drawing the chart, problems and remedies, reading it with the natal chart) and Prashna-arudha (nature of the question, when to accept it, outcome, what to tell the querent), "as per" Rath's teachings; curriculum lists arudha, arudha bhava, chhatra, prashna yoga and nashta jataka. No rule text. [B, opened] [Rama Academy](https://rama-academy.teachable.com/p/prashna-kendra-prashna-arudha).
- Prashna used to reconstruct a lost birth chart: checks against birth date, tithi, Jupiter's sign and the navamsa lagna; expects Mandi in a kendra from the navamsa lagna. [A?, byline not confirmed] [srath.com, Rani Rasmani #1](https://srath.com/celebrity/india/rani-rasmani-1/); a further page uses prashna to choose the lagna and navamsa lagna and then tests them against life events [A] [srath.com, Rani Rasmani Jataka](https://srath.com/celebrity/india/rani-rasmani-jataka/).
- Horary Vimshottari starts from the stronger of the name and prashna stars. [A] srath.com/?p=804.
- *Vedic Remedies in Astrology* (retailer excerpt, unverified) separates past from present karma by comparing natal and prashna charts, and treats muhurta as a remedy. [B-level weight; author's text not verified]
- Not found: the prashna arudha computation; Prashna Marga or Kerala methods; any rule that prashna must agree with natal dasha; any Rath muhurta rule.

Engine: `prashna` computed (chart at the question moment with udaya lagna, panchanga, dignities, houses, aspects, argala for D1 and D9). Prashna arudha not listed. Prashna-star Vimshottari not computed.

## 7. Multi-method agreement

- No retrieved Rath text says dasha, transit and annual chart must agree before an event is predicted; none gives a minimum number of agreeing methods or what to do when they disagree; none gives a month, week or day procedure.
- The agreement-type statements that exist:
  - A nakshatra dasha pinpoints an event, but its occurrence needs confirmation from a rasi dasha. [A] *Crux* Introduction, p.3. This is dasha against dasha, not dasha against transit or annual chart.
  - Children: an independent Narayana as a double check on Vimshottari timing. [A] *Crux* sect. 8.6.2.
  - Vimshottari Dasha #2: end dates coinciding across Moon-based lines are the stronger signal. [A] [Sensitive] source rule, not for readings without owner decision.
  - Natal overrides the TP chart; Masa and Dina charts give month and day layers. [B, Poddar]
- "Dasha promises, transit triggers" was not found as a Rath statement.

## 8. INFERRED reading order (not stated by any source)

This order is assembled by the research notes from Poddar [B], the single India 2008 example (byline unresolved), *Crux* p.3 [A] and the children double check [A]. No source states it as a rule. It is a hierarchy, not a vote.

1. Natal promise: house, reference, varga (files 02 and 03).
2. Dasha: the question's rasi dasha (Narayana) and Vimshottari both pointing to the matter (file 04).
3. Annual chart: TP lagna from the natal lagna; year lord or hora lord and its natal yogas.
4. A dasha run inside the year to the pratyantara level to place the event.
5. Finer layers: Masa and Dina pravesha, sub-periods only on a rectified time.
6. Transits and progressions as supporting checks (Jupiter over AL or 7th; Saturn over A10 or AL; Sudarshana year).

## Gaps and conflicts

- Year lord: weekday lord (Poddar, opened) vs hora lord (Rao, snippet) vs tithi lord (third party, unpinned). No tier A answer.
- Dasha inside the TP year: Moon Vimshottari (2008 example) vs Tithi Ashtottari (unpinned claim). Unresolved.
- Whether Tithi Pravesha is Tajika in origin: two fetches disagree.
- Authorship of the TP page (co-credited) and the 2008 page (byline conflict).
- Transit doctrine almost entirely missing from Rath's public text; only career and marriage triggers from *Crux*.
- Sudarshana: used in *Crux* examples, rules absent.
- Prashna as a confirmation layer for natal timing is not shown in any source.
- No stated multi-method agreement rule beyond *Crux* p.3 (dasha against dasha).
- Unread: PVR `pp_tp.pdf`; Scribd Tithi Pravesha uploads; udu book sections 4.7, 4.8, 4.12; Larsen's prashna course content.

## Use in the product

- Year-scale boards may use the Tithi Pravesha chart as a frame under the natal chart, never alone; label year-lord choices by source (Poddar weekday lord with hora lord as focus is the only opened account) and keep the conflict visible.
- Sequence timing as the inferred order in section 8 and say so in technique notes: natal promise, then Narayana with Vimshottari, then the TP year, then finer layers, with transits as support. Do not present it as Rath's rule.
- Treat transits as triggers only for the few tier A cases (Jupiter over AL, 7th or 2nd from UL; Saturn over A10 or aspecting AL). Other transit logic the product already uses (Moon-based gochara, sade sati, ashtakavarga) must not be labelled Rath.
- Do not offer week or day predictions as Rath-school output; nothing in his text supports a week or day procedure. Masa and Dina pravesha are Poddar [B].
- A confirm question can test the annual frame: ask whether the past year matched what the previous TP chart showed before leaning on the current one.
- Prashna can be offered for a question asked in the moment, and as a fallback when no birth time exists, but not as a third vote on a natal prediction.
- Engine work implied: name the TP year lord (weekday and hora lords), Masa and Dina pravesha charts, Sudarshana export, a compressed TP Vimshottari, transits over arudhas, prashna arudha.
