# Murti nirnaya, the metal of a transit (mūrti-nirṇaya: svarṇa, rajata, tāmra, loha)

> When a planet, usually a slow one, enters a new sign, the transiting Moon's house from the natal Moon at that moment
> grades the whole transit:
> - gold (1, 6, 11): best;
> - silver (2, 5, 9): good;
> - copper (3, 7, 10): middling;
> - iron (4, 8, 12): poor.
>
> It is widely used in North and South Indian panchangas. No primary verse was located in this pass.

## 1. Sources
- **Jataka Sara Deepa** gochara chapter (secondary summary). It gives all four groups, iron as 4, 8 and 12. https://theeyeofvedas.blogspot.com/2025/11/chapter-44-gochara-phala-adhyaya.html
- **Other secondary pages** give gold, silver and copper the same way, and are vaguer on iron. Low weight.
- **Primary:** not located. Suspected sources are Muhurta texts, Jyotisha Nibandha and regional panchanga traditions.

## 2. When it applies
At the ingress of Saturn, Jupiter, Rahu and Ketu, and sometimes of every planet, into a new sign.

## 3. Inputs required
- The exact ingress moment.
- The Moon's sign at that moment.
- The natal Moon sign.

## 4. Calculation / rule
[COMM]
1. Find the ingress instant of planet P into a sign.
2. Compute h = (Moon's sign at the ingress − natal Moon sign) mod 12 + 1.
3. Look up h:

| h | Murti | Grade |
|---|---|---|
| 1, 6, 11 | Svarna (gold) | excellent |
| 2, 5, 9 | Rajata (silver) | good |
| 3, 7, 10 | Tamra (copper) | moderate |
| 4, 8, 12 | Loha (iron) | poor |

## 5. Interpretation rules
- **[COMM]** The murti grades the quality of the entire stay in that sign. It is applied on top of the house from the Moon: a bad-house transit in gold is softened, and a good-house transit in iron is weakened.

## 6. Variants and disputes
- **Reference point:** some versions count the Moon's position from the house that the transiting planet enters, not from the natal Moon. Unverified.
- **Retrograde re-entry:** whether each retrograde re-entry gets its own murti is unspecified.

## 7. Worked micro-example
1. The natal Moon is in Taurus.
2. Saturn enters Pisces while the Moon is in Virgo.
3. Virgo is the 5th from Taurus, so the murti is silver: good.

## 8. Design notes for AI Astra
- **Shared sky:** the Moon's sign at every slow-planet ingress, including retrograde re-entries. This is an engine addition; ingress times already exist.
- **Overlay:** `murti` per ingress. This is an engine addition. `general.transit.md` calls it ready, but no murti function was found in the engine exports.
- **Board:** a one-line tag on the slow-planet tiles. Low weight.

## 9. Open questions
- Locate a primary verse.
- Settle the reference-point variant.
