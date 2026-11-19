# Rahu kalam, Yamaganda and Gulika kalam (rāhu-kāla, yamagaṇḍa, gulika-kāla)

> Daily "avoid" bands. Daylight (sunrise to sunset) is cut into 8 equal parts, and by weekday one part is Rahu's,
> one Yama's (Yamagaṇḍa) and one Gulika's. New undertakings are avoided in Rahu kalam above all. They are near
> universal in South Indian almanacs and apps, and now common across India. They are **regional/later practice**,
> not rules of *Muhūrta-cintāmaṇi*. Gulika comes from the upagraha tradition (Gulika/Māndi), which *Praśna Mārga*
> uses. The computation is trivial and reliable. The significance is folk-ritual.

## 1. Sources

| Text | Status |
|---|---|
| South Indian almanac practice (Tamil, Telugu, Kannada, Malayalam panchāṅgams) | [REGIONAL]. The weekday tables below are the universal almanac form |
| *Kālaprakāśikā* and Kerala texts; *Praśna Mārga* appendix 1 (Gulika kāla rising) | Gulika timing [TEXT] for prashna and natal. Not read verse-level |
| BPHS upagraha chapter (Kāla, Mṛtyu, Ardhaprahara, Yamaghaṇṭaka, Gulika) | Same weekday-part scheme, used for upagrahas [TEXT] (other researcher may cover) |
| *Muhūrta-cintāmaṇi* | Has no Rahu-kāla rule as such (not found in the chapter structure. Verse search not done) |

## 2. When it applies

Every day and place. Day bands (also night versions exist for Gulika and Yamagaṇḍa).

## 3. Inputs required

Local sunrise and sunset for the place and date (with daylight saving), and the weekday.

## 4. Calculation

Part length = (sunset − sunrise) / 8. Part n runs from sunrise + (n−1)·part.

| Weekday | Rahu kalam (part) | Yamaganda (part) | Gulika kalam (part) |
|---|---|---|---|
| Sunday | 8 | 5 | 7 |
| Monday | 2 | 4 | 6 |
| Tuesday | 7 | 3 | 5 |
| Wednesday | 5 | 2 | 4 |
| Thursday | 6 | 1 | 3 |
| Friday | 4 | 7 | 2 |
| Saturday | 3 | 6 | 1 |

(The standard almanac table. With a 06:00–18:00 day, Monday Rahu kalam is 07:30–09:00.) [REGIONAL]

Night: the 8 night parts start from a different lord (Gulika at night: the part ruled by Saturn in the night sequence) [TEXT, BPHS/upagraha].

## 5. Interpretation rules

- [REGIONAL] Rahu kalam: do not begin new ventures, journeys, signings, purchases or ceremonies. Ongoing work may continue. Some traditions use it *for* Rāhu worship.
- [REGIONAL] Yamagaṇḍa: inauspicious, especially for travel and starts.
- [REGIONAL] Gulika kalam: ambivalent. Acts done in it tend to repeat. So it is avoided for funerals and debts, and
  some favour it for buying property or gold (practice varies).
- [MODERN] Many North Indian astrologers give these bands little weight compared with panchang limbs and choghadiya.

## 6. Variants and disputes

- Equal eighths of the actual day (correct) vs. fixed clock tables assuming a 06:00 sunrise (popular shortcut, wrong away from the equator).
- Gulika as a time band vs. Gulika as an upagraha longitude (start vs. middle of Saturn's part).

## 8. Design notes for AI Astra

- Engine (served): `muhurta` returns rahu kaal, yamaganda, gulika, dur muhurta and varjyam per day (doc 47 §1;
  `lucky.avoid_bands`). Sunrise and sunset come from the engine with per-date daylight saving. Good.
- Engine additions: the night versions; and `source_tag: regional_south` on each band so the Why sheet can say
  "a South Indian custom". Do not let these bands outrank panchanga gates.
- Serves: the Lucky Times avoid bands (hatched). Weight: a hard avoid for "start" scenarios only. It is not a judgement on the whole day.

## 9. Open questions

- Product: should Gulika kalam be shown as "avoid", or neutral with the "repeats" note? Recommend avoid-for-starts, neutral otherwise.
