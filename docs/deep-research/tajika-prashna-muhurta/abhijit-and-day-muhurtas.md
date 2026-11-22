# Abhijit and the 30 muhurtas of the day (abhijit muhūrta, dur-muhūrta)

> A civil day is divided into 30 muhūrtas: 15 from sunrise to sunset and 15 from sunset to sunrise, each about 48
> minutes. They are named and ruled by deities. The 8th day muhūrta, around local noon, is **Abhijit**. It is widely
> held to cancel most faults of a moment, making it the classic "fallback" auspicious window. Some muhūrtas are
> *dur-muhūrta* (bad) by weekday. The scheme is old (the muhūrta names go back to Vedic and Purāṇic lists) and is
> used across India. The computation is exact. Abhijit's "cancels all faults" status is traditional and comes with exceptions.

## 1. Sources

| Text | Status |
|---|---|
| *Muhūrta-cintāmaṇi*, Śubhāśubha-prakaraṇa (muhūrta names, dur-muhūrta by weekday, Abhijit) | Chapter level. **Verse not verified** |
| *Muhūrta-mārtaṇḍa*; *Kālaprakāśikā* | Not read |
| Abhijit *nakṣatra* (the last pāda of U.Āṣāḍhā + the first 1/15 of Śravaṇa, the 28th star) | A different thing. Used in the 28-star muhurta schemes (MC ch. 2) |
| bhaktibharat.org Abhijit guide | Secondary, not used |

## 2. When it applies

Daily, per place. Used when no fully clean muhurta is available on a needed day.

## 3. Inputs required

Sunrise, sunset and next sunrise for the place and date; weekday.

## 4. Calculation

- Day muhūrta length = (sunset − sunrise)/15. Night muhūrta = (next sunrise − sunset)/15.
- **Abhijit** = the 8th day muhūrta: from sunrise + 7/15·day to sunrise + 8/15·day (centred on local apparent noon).
- **Dur-muhūrta by weekday** (15 day parts) [TEXT, MC ch. 1. Common table, verse unverified]: Sunday 14th;
  Monday 9th and 12th; Tuesday 4th (and a night part); Wednesday 8th; Thursday 6th and 12th; Friday 4th and 9th;
  Saturday 1st and 2nd.
- Night: *Nishītha* (the 8th night muhūrta, around midnight). *Brahma muhūrta*: the 2nd-to-last night muhūrta
  (about 96 to 48 minutes before sunrise). *Vijaya*: the 11th day muhūrta (afternoon). *Godhūli*: around sunset.

## 5. Interpretation rules

- [TEXT/COMM] Abhijit removes most doṣas of the panchang and lagna for ordinary undertakings. Exceptions widely cited:
  not on Wednesday (it coincides with the Wednesday dur-muhūrta, the 8th), and not for journeys to the south [COMM]. Some exclude it for marriage and upanayana.
- [TEXT] Dur-muhūrtas are avoided for all auspicious starts.
- [COMM] Godhūli is praised for marriage when other factors fail (Bṛhat Saṃhitā ch. 103, via dekhopanchang summary). Brahma muhūrta is for study, prayer and practice.

## 6. Variants and disputes

Equal 48-minute muhūrtas (a shortcut) vs. 1/15 of the actual day (correct). The deity-name sequences differ slightly between lists.

## 8. Design notes for AI Astra

- Engine (served): abhijit, dur muhurta, brahma muhurta, godhuli, vijaya, nishita, and the 30 muhūrtas with good or bad
  marks (`drik.abhijit_muhurta` = 7/15–8/15 of the day. Matches the definition). Good.
- Engine additions: an `abhijit.cancelled_reason` (e.g. "Wednesday") so Node does not apply the exception itself;
  `source` tags.
- Serves: the Lucky Times go-window (solid) and "best fallback today" copy. Weight: a strong default go-window, but it
  never overrides Viṣṭi or a personal avoid (chandrāṣṭama).

## 9. Open questions

- Verse-level check of the dur-muhūrta and Abhijit exceptions in MC.
