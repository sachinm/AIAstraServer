# Birth details in three small steps, with no page scroll (2026-11-04)

## Start (facts checked)

- Web `src/Auth/BirthDetails.tsx` (`/signup/details`) puts every field on one card: date of birth, time (three selects),
  country, city, gender, language (two radios), referral code, then "Create my chart". With labels, hints and the date
  read-back the card is taller than most laptop windows, so the page scrolls.
- The fields come from `src/Auth/fields/BirthFields.tsx`, which `ProfileSection.tsx` also uses (the profile page keeps
  one form).
- Validation is `validateBirth` per field (`dob`, `time`, `country`, `city`, `gender`); entries autosave to
  `sessionStorage`. The server call (`completeProfile`) and the chart-building overlay are unchanged.

## End goal

Sachin: no vertical scroll bar on `/signup/details`, on any viewport. The fields are split into three short steps, each
small enough to fit.

## Deliverable and how it works when done

1. **When were you born?** Date of birth and time of birth. **Next**.
2. **Where were you born?** Country and city. **Back** / **Next**.
3. **A little about you.** Gender, language, referral code (optional). **Back** / **Create my chart**.

- "Step 1 of 3" and three dots sit under the heading.
- Next checks only that step's fields and names what is missing; Create my chart checks all, and jumps to the first step
  with a gap. The step is autosaved with the entries, so a refresh returns to the same step.
- `BirthFields` gains an `only` list of fields to draw; the profile page passes nothing and keeps every field.
- Backend / API: unchanged. One `completeProfile` call at the end, as now.
- Tighter card spacing, as on sign-up.

## Steps

1. This plan. 2. `only` on `BirthFields`. 3. Steps, Back/Next, step autosave in `BirthDetails`. 4. Tests walk the steps.
5. Measure every step at 1250x520, 1280x720, 1440x900, 1920x1080, phone and iPad; no scroll. 6. Merge to develop.

## Recommendation

Do it as above. If a very short window (a phone on its side) still overflows on step 1 because of the date read-back
line, shrink that step's type there rather than adding a fourth step.
