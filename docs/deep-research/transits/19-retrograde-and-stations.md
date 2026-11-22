# Retrograde and stationary planets in transit (vakra, stambha in gocara)

> A transiting planet that turns retrograde (vakra) re-traverses part of a sign, may re-enter the previous sign, and
> stands still at its stations. Within the texts read in this pass, the gochara chapters give no separate retrograde
> rules. Retrograde affects transits mechanically (re-entry, repeated contacts, kakshya re-traversal) and through
> Sarvatobhadra vedha direction. The interpretive rules are traditional or modern.

## 1. Sources
- **Phaladeepika 26:** no retrograde rule found in the verses read (1-10, 26-30, 41-45). Later verses were not read. https://www.siva.sh/phaladeepika/26/41-45
- **Natal vakra strength:** BPHS and Saravali on chesta bala, where a retrograde planet is strong. That is a natal rule.
- **Sarvatobhadra:** a retrograde planet's vedha direction changes. See `06-nakshatra-transit-and-sarvatobhadra.md`. Unverified at verse level.

## 2. When it applies
- To Mars, Mercury, Jupiter, Venus and Saturn. The nodes are always retrograde in mean motion. The Sun and Moon never are.

## 3. Inputs required
- Daily speed and its sign.
- Station instants and longitudes.
- Ingress and backward-ingress events.

## 4. Calculation / rule
1. **Retrograde flag:** speed < 0.
2. **Station:** speed crosses 0. The engine finds and times these.
3. **Backward ingress:** the planet re-enters the previous sign. Re-apply every sign-based rule: house from the Moon, vedha, BAV, Sade Sati phase.
4. **Repeated contacts:** a natal degree hit 1-3 times (direct, retrograde, direct) gives three dated hits.

## 5. Interpretation rules
- **[COMM]** A retrograde planet gives results of the sign it is in. Some say it also gives results of the previous sign when retrograde near the start of a sign. Not verified.
- **[COMM]** A planet's station on a natal point intensifies that contact. The station is the most "fixed" moment.
- **[MODERN] K.N. Rao and SJC:** a retrograde Jupiter or Saturn delays or repeats results. The event often comes at the third pass.
- **[COMM] Sarvatobhadra:** retrograde motion changes which vedha lines are active. Sources disagree on the mapping, and it is unverified; see `06-nakshatra-transit-and-sarvatobhadra.md`.

## 6. Variants and disputes
- **The previous-sign rule:** disputed, and no primary text was found in this pass.
- **Retrograde benefic or malefic:** some hold that a retrograde benefic is more benefic and a retrograde malefic more malefic (traditional). This is a natal idea applied to transits by some authors.

## 7. Worked micro-example
1. The natal Moon is in Aquarius.
2. Saturn stations retrograde at 2° Pisces, the 2nd from the Moon: the setting phase of Sade Sati.
3. It re-enters Aquarius, so the phase reverts to the peak until Saturn goes direct and re-enters Pisces.
4. Kakshya 1 (Saturn's own) is traversed three times.

The boards must take these phases from the engine, never hand-compute them.

## 8. Design notes for AI Astra
- **Engine:** stations, `retro_on_entry`, backward ingresses and per-day retrograde flags already exist (`transit_range_export.py`, `transits_export.py`).
- **Engine addition:** in `transit_contacts`, label each hit as pass 1, 2 or 3, and flag a station within an orb of a natal point.
- **Board:** dated sub-windows on slow-planet tiles ("first pass", "review pass", "final pass").
- **Weight:** a timing refinement only.

## 9. Open questions
- Read PD 26:46 to the end, and Saravali's gochara verses, for any retrograde rule.
