# Choghadiya (caughaḍiyā) [REGIONAL]

> Choghadiya splits daytime and night-time into 8 equal parts each (about 1½ hours, roughly four ghaṭīs, hence
> "chau-ghaḍiyā"). Each part is labelled Amrit, Shubh, Labh, Char, Rog, Kaal or Udveg after a planet. It is a
> **regional custom** of Gujarat, Rajasthan, Maharashtra and the Hindi belt, popular with traders for quick starts. It
> is not in *Muhūrta-cintāmaṇi*. Drik Panchang and most North Indian apps show it. The Tamil *Gowri pañcāṅgam* is a
> different 8-fold scheme with different names. Do not mix the two.

## 1. Sources

| Source | Status |
|---|---|
| Gujarati and North Indian almanac practice; Drik Panchang | [REGIONAL]/[MODERN]. No classical verse source found in this pass |
| Doc 47 §3.1, §3.3 (choghadiya and vaar/kaal vela, kaal ratri; Prokerala's rule) | Repo background |
| Tamil Gowri (Gauri) pañcāṅgam: 8 parts (Amṛta, Uthi/Udyoga, Rogam, Lābham, Dhanam, Sukham, Sōram, Viṣam) | [REGIONAL] South. Names from general knowledge, **verify** |

## 2. When it applies

Daily, per place. Quick selection for trade, travel and small starts.

## 3. Inputs required

Sunrise, sunset, next sunrise, weekday.

## 4. Calculation [REGIONAL]

Planet → name: Sun = Udveg (bad), Venus = Char (neutral/good for travel), Mercury = Labh (good), Moon = Amrit (best),
Saturn = Kaal (bad), Jupiter = Shubh (good), Mars = Rog (bad).

- **Day:** part 1 = the weekday lord. Then the sequence Sun → Venus → Mercury → Moon → Saturn → Jupiter → Mars → (Sun) … for 8 parts (part 8 = part 1's lord).
  Sunday day: Udveg, Char, Labh, Amrit, Kaal, Shubh, Rog, Udveg. Monday day: Amrit, Kaal, Shubh, Rog, Udveg, Char, Labh, Amrit.
- **Night:** part 1 = the lord fifth from the weekday lord in weekday order (Sunday night starts with Jupiter = Shubh).
  Sequence Jupiter → Moon → Venus → Mars → Saturn → Mercury → Sun … Sunday night: Shubh, Amrit, Char, Rog, Kaal, Labh, Udveg, Shubh.
- Vaar vela, kaal vela and kaal ratri: sub-bands flagged by weekday on certain choghadiyas (Prokerala's rule, per doc 47) [REGIONAL].

## 5. Interpretation rules [REGIONAL]

Amrit (all good), Shubh (ceremonies, marriage talk), Labh (business, study), Char (travel, movable things): go.
Rog (disputes, illness), Kaal (loss. Some use it for wealth-related collection), Udveg (anxiety; government work is sometimes allowed): avoid.

## 6. Variants and disputes

Gowri pañcāṅgam vs. Choghadiya. Sunrise/sunset definitions (disc centre vs. upper limb). Some apps use the 6:00/18:00 shortcut, which is wrong.

## 8. Design notes for AI Astra

- Engine (exists, not served): `drik.gauri_choghadiya(jd, place)`. Its docstring says "practiced in North India", but
  it is named "gauri". **Verify** which scheme and which names it returns (the North Indian Choghadiya or the Tamil
  Gowri) before serving. Ideally serve both, labelled `scheme: choghadiya_north | gowri_tamil`.
- Engine addition (doc 47 §3.3 already lists it): `days[].choghadiya[{name, lord, start, end, quality, vela_flags}]`, day and night.
- Serves: the Lucky Times second strip and the work/money labels ("Labh/Shubh in a clean muhurta"). Tag on the Why sheet: "a Gujarati and North Indian custom".
  Weight: low to middling. Never a gate.

## 9. Open questions

- Should a user's region choose the scheme (choghadiya vs. Gowri)? Recommend: default by the place's country or state, switchable.
