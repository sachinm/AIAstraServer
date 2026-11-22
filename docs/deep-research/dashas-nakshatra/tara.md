# Tara dasha (tārā daśā)

> A Vimshottari-length dasha in which the periods go to planets in kendras (strongest first) instead of following the nakshatra cycle; each period is labelled with a tara (Janma, Sampat, Vipat …). BPHS lists it among the less-accepted dashas (46.11) and gives three verses. SJC (Sanjay Rath) uses it; most schools do not.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Listed among dashas not universally accepted | ELS 46.11 | [TEXT] |
| Some call Vimshottari Tara dasha; taras replace planets | ELS 46.207; AE 46.207 | [TEXT] |
| Taras (Janma, Sampat, Vipat, Kshema, Pratyak, Sadhana, Naidhana, Mitra, Parama-mitra) counted from a strong kendra planet | ELS 46.208 | [TEXT] |
| The dasha belongs to the planet in a kendra | ELS 46.209; AE 46.207–209 | [TEXT] |
| Order kendra → panaphara → apoklima, strongest first | Sanjay Rath (engine `dhasa_method = 1`) | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt

## 2. When it applies

No chart condition; it presupposes planets in kendras (46.209). [TEXT]

## 3. Inputs required

All planets' signs (kendra/panaphara/apoklima from lagna), a strength ranking, and the Moon's longitude for the first period's balance.

## 4. Calculation

1. Rank planets in kendras from lagna by strength; then (SJC) planets in panapharas, then apoklimas.
2. Each planet runs for its Vimshottari years (Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17, Ketu 7, Venus 20; total 120).
3. Balance of the first period by the Moon's nakshatra fraction (engine `_dhasa_start`).
4. Sub-periods: engine starts each AD from the MD planet and follows the same ranked list.

Engine has two orderings: `dhasa_method = 1` (Rath) and `2` ("Parasara"); the tie-breaks use `stronger_planet_from_planet_positions`.

## 5. Interpretation rules

The tara label colours the period: Janma (body), Sampat (wealth), Vipat (danger), Kshema (well-being), Pratyak (obstacle), Sadhana (achievement), Naidhana (destruction), Mitra and Parama-mitra (friendly) [TEXT 46.208, names only; detailed results not in BPHS].

## 6. Variants and disputes

- The verses are terse; the kendra → panaphara → apoklima extension and the strength rules are SJC's [MODERN].
- Whether the 120-year sum is kept when fewer planets occupy kendras: answered differently by implementations.

## 8. Design notes for AI Astra

Research only. Engine must export the ranked planet list and the strength rule used, so the order can be audited.

## 9. Open questions

Exact BPHS order rule: the three verses do not give it.
