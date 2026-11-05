# 52 — The personalization wizard and the selfie

Status: **build plan, 2026-11-05 (Fable), executing.** Sachin's brief: after registration the person meets a
multi-step wizard they can skip: a selfie (camera capture, allowed only when a face is detected, with protection against
people spamming the camera; the selfie becomes their profile photo in place of the Ganesh avatar, as Co-Star does),
their current location, interests, married or dating, profession (generic options), children; every step has "I'd
rather not say"; one to three questions per screen, drawn from the twelve houses, so the readings have context for
where the person is in life. The selfie is stored in a `profile_photos` table.

## 1. Start (facts checked 2026-11-05)

| Fact | Where |
|---|---|
| Registration ends at `/signup/details` (birth details) and goes straight to the chat; `auth.profile_complete` gates the dashboard | `AIAstra_WEB/src/routes.tsx`, `Auth/ProfileGate.tsx`, server `auth` table |
| The avatar everywhere is the Ganesh image (`ShriGaneshAvatar`), in the header menu and beside answers | `components/ShriGaneshAvatar.tsx`, `ProfileMenu.tsx`, chat answer rows |
| `person_facts` exists (career Phase 1): one row per `(user_id, key)` with `value`, `source`, `confirmed_at`; `work.status` is written by the Work board | server migration `20261105200000`, `src/reading/area/careerService.ts` |
| The person's current place is stored for chat questions (`user_current_location`); the web asks for the browser location once on the chat page | server `src/services/userLocation.ts`, web `ChatSection` |
| No photo storage, no face detection, no upload route exists; CloudFront fronts the Lambda; uploads over the Lambda are limited by the 6 MB payload | docs/admin/01 §1.5, server `server.ts` |
| Privacy: `person_facts` values are plain until sealed writes go live; a photo is personal data under the same plan | docs/privacy/02; TODOS 2026-11-05 |

## 2. End goal

After birth details, the person sees "Let's make this yours" with **Skip for now** always visible. Seven short steps,
each one screen, each answerable in one tap, each with "I'd rather not say": the selfie; where you are; work; love;
family; what you care about; done. The selfie opens the camera, shows a live preview, and the **Take photo** button is
enabled only while a face is detected in the frame (one face, large enough, centred); the capture is resized to 512 px,
checked again on the server, stored, and becomes the avatar at once. Skipping any step stores nothing for it. The
answers land in `person_facts` and every board and the chat read them (doc 48), so the Work board no longer asks "Do
you have a job right now?" when the wizard already knows. The wizard is shown once; the profile page lets the person
change any answer or retake the photo later.

## 3. The steps and what each stores (the 12-house context)

| Step | Houses | Question(s), one to three | Options | Fact keys |
|---|---|---|---|---|
| 1 Selfie | 1 (the self) | "A photo of you, for your profile" | Take photo · Skip | `profile_photos` row; `wizard.selfie = done \| skipped` |
| 2 Where you are | 4, 12 | "Where do you live now?" | city search or "Use my location"; "I'd rather not say" | `place.current` (city, country, lat/lon rounded to two decimals, tz) → also `user_current_location` |
| 3 Work | 10, 6, 2 | "Do you have a job right now?" · "What best describes your work?" | Yes · Between jobs · Own business · Studying · Retired · Rather not say; Hourly · Employee · Specialist · Manage people · Senior leader · Own business alone · Own business with staff · Several businesses · Rather not say | `work.status`, `work.level` |
| 4 Love | 7, 5 | "Right now are you…" | Single · Dating · Committed · Married · Separated · It's complicated · Rather not say | `love.status` |
| 5 Family | 5, 4 | "Children?" | None · Expecting · Yes, young · Yes, grown · Rather not say | `family.children` |
| 6 What you care about | all | "What matters most to you now?" (pick up to three) | Career · Money · Love · Family · Home · Learning · Travel · Health · Creativity · Spirituality · Rather not say | `self.focus` (comma list) |
| 7 Done | | "Thanks. Your readings will speak to where you are." | Open Today | `wizard.done = <date>` |

Every answer is `source = tapped`, `confirmed_at = now`. "Rather not say" writes `declined` for that key so nothing asks
again for 180 days (doc 48 §4.1). Skip for now writes `wizard.skipped = <date>`; the profile page carries a "Finish
setting up" line until done.

## 4. The selfie, in detail

- **Capture:** `getUserMedia({ video: { facingMode: 'user' } })`, a live `<video>`, a canvas capture at 512 × 512
  (centre crop), JPEG quality 0.85 (about 40–70 KB). No upload of raw frames.
- **Face check on the device:** MediaPipe Face Detection (`@mediapipe/tasks-vision`, the short-range model, about
  5 MB wasm and model loaded once from our own static files, not a third-party CDN at runtime). Each frame: exactly one
  face, box at least 25 % of the frame width, centre inside the middle 60 %, confidence ≥ 0.7, held for 10 consecutive
  frames (≈ 0.3 s). Only then is **Take photo** enabled; the UI says what is needed ("Move closer", "Only you in the
  frame", "Look at the camera") from the same checks. Browsers without camera or wasm fall back to "Skip for now".
- **Spam and abuse controls (the enhancement Sachin asked for):**
  1. the server accepts only `image/jpeg` ≤ 150 KB, 256–1024 px square, decoded and re-encoded with `sharp` (strips
     metadata, rejects non-images);
  2. at most 5 captures per user per hour and 20 per day (`profile_photo_attempts`); the sixth gets 429 with a plain
     message;
  3. the server re-runs a face check (Phase 1: the same MediaPipe model in Node via `@mediapipe/tasks-vision` is
     browser-only, so Phase 1 uses `@vladmandic/face-api` tiny detector in Node; Phase 2 option: Amazon Rekognition
     `DetectFaces`, about $0.001 per image, only with Sachin's yes) and rejects captures with no face or more than one;
  4. a perceptual hash of the stored photo; the same image uploaded by many accounts is flagged to the admin module;
  5. no public URL: `GET /api/profile/photo` returns the bytes for the signed-in person only (and the admin module);
  6. the previous photo is kept for 30 days (`replaced_at`) so a bad replacement can be undone, then deleted.
- **Storage:** Phase 1 in Postgres (`profile_photos`: `user_id` PK, `bytes` bytea, `mime`, `width`, `height`,
  `face_box` jsonb, `phash`, `created_at`, `replaced_at`), about 60 KB per person; Phase 2 moves bytes to S3 with the
  same API when the deploy session adds the bucket. Deleting the account deletes the photo (cascade).
- **The avatar:** `Avatar` component shows the photo when present, the Ganesh image when not; used in the header, the
  menu, the chat's answer rows for the person's own messages, and the You board.

## 5. API

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/profile/facts` | | `{ facts: { key: { value, source, confirmed_at } }, wizard: { done, skipped } }` |
| `PUT /api/profile/facts` | `{ facts: { key: value \| null } }` (null = rather not say) | 204; 400 unknown key or value |
| `POST /api/profile/photo` | multipart or raw `image/jpeg` body, header `x-face-box` from the device | 201 `{ width, height }`; 400 not a face / bad image; 413 too big; 429 too many |
| `GET /api/profile/photo` | | the JPEG, `Cache-Control: private, max-age=3600`; 404 none |
| `DELETE /api/profile/photo` | | 204 (restores the previous within 30 days when `?restore=1`) |

## 6. Frontend

Route `/welcome` after `/signup/details` when `wizard.done` and `wizard.skipped` are both unset; a stepper with a
progress line, one question per screen (never more than three), big tap targets, "I'd rather not say" on every step,
"Skip for now" in the header; the selfie step with the live preview, the status line and the disabled-until-face
button; the done screen opens Today (or the chat when the boards flag is off). Profile → "About you" shows every answer
with Change, the photo with Retake and Remove.

## 7. Phases

| Phase | Ships | Check |
|---|---|---|
| 1 | facts API, wizard steps 2–7, `Avatar`, the photo route with size/type/rate checks and the device-side face gate, storage in Postgres | wizard tests (skip, rather not say, answers stored); photo route tests (type, size, rate); e2e: sign up → wizard → Today |
| 2 | server-side face check, perceptual hash, admin view, S3 | a photo with no face is refused server-side |

## 8. Decisions for Sachin

1. Amazon Rekognition for the server-side face check (paid, about $1 per 1,000 photos) or stay on-device plus the Node
   detector.
2. Whether the selfie is required for a paid plan or always optional (default: optional).
3. Whether "Where you are" asks for the browser location by default (default: ask, with a city search beside it).
