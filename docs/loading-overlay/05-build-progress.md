# 05: A real progress bar for a board build, and a header that says what is happening

Written 2026-11-09 after Sachin's screenshot of the Self v2 board: every card veiled with "preparing your board…", the
header showing only "Fresh reading from 13 Dec 2026 · Made 10 Nov 2026 · Good until 12 Dec 2026", and nothing saying
whether a reading was being made, had failed, or had never started.

## 1. Start (facts checked)

- **What the screenshot was.** Kundli `c584c0a3` (the only one with Self v2 rows on the shared Render DB). Its stored
  preference is `kaala`. The v2 build chose its clock with the v1 `resolveClock` (keeps any stored preference with
  periods) and stored cards under `clock=kaala`. GET `/api/self/v2` chooses with `resolveClockV2` (only selectable
  clocks), got `dwisatpathi`, and read `clock=dwisatpathi`: no cards, so every area `pending`. The page polled, queued
  builds, and each build wrote `kaala` again. No build was running and none had failed: it was a stuck mismatch.
  Fixed on branch `fix/self-v2-build-clock` (S1 `subClock` now uses `resolveClockV2` with the engine's
  `dasha.applicable` rows, the same read the page uses).
- **The header never shows build state.** `FreshControl` (web `src/pages/you/v2/FreshReading.tsx`) shows `building`
  only after the person taps "Get a fresh reading". A first build, a clock-switch rebuild or a stuck read shows the
  not-due dates, which read as "all fine".
- **The veil has no progress.** `LoadingVeil` shows a rotating quip and a board. The server knows only
  `building | ready | failed` in `area_builds` (`self.v2` marker); no stage is recorded.
- **Build stages and their run-2 timings** (`src/reading/self/v2/build.ts` `ms` map): subs, briefs, slices, cache warm,
  family readers ×5, Oracle, Personalizer. The model stages are most of the time (tens of seconds in total).

## 2. End goal

Anyone waiting more than about 5 seconds sees a bar that moves when the server finishes a step, a line naming the step
in plain words, and, if the build fails or stalls, a plain line saying so with Try again. The header always says one of:
Ready · Making your reading (step n of 7) · That did not work, try again · Waiting to start.

## 3. Deliverable

- Server: the v2 build writes its stage into the `self.v2` marker after each step; GET `/api/self/v2` returns a
  `build` object.
- Web: the veil shows a determinate bar from `build`; the board header shows a status chip from `build`; the words
  "Add your photo" are gone (done on web branch `fix/self-header-no-add-photo`).

## 4. How it works when done

**Backend.** `writeSelfV2Marker` gains `stage` and `stageAt` in `area_builds.result` (JSON, no migration). `build.ts`
calls a `stage(name)` helper after subs, briefs, slices, warm, families, oracle, personalizer. Stage weights come from
the run-2 `ms` map (fixed table in code, e.g. subs 5, briefs 3, slices 2, warm 5, families 35, oracle 30,
personalizer 20 = 100).

**API.** GET `/api/self/v2` adds:

```ts
build: {
  state: 'none' | 'queued' | 'running' | 'ready' | 'failed' | 'stuck';
  stage: 'subs' | 'briefs' | 'slices' | 'warm' | 'families' | 'oracle' | 'personalizer' | null;
  step: number;       // 1..7, 0 when none
  steps: 7;
  percent: number;    // weighted, 0..100, never goes back
  startedAt: string | null;
  stageAt: string | null;
  error: 'failed' | null; // never the raw error text
}
```

`stuck` = `running` with no stage change for longer than the stage's limit (the existing `BUILD_STUCK_MS` idea, per
stage). A stuck or failed build is re-queued by the page's Try again, never silently.

**Frontend.** `LoadingVeil` gets an optional `progress` prop: a thin bar under the brand line, animating smoothly between
server percents (easing toward the next stage's floor so it never sits still, never passes the next real step), plus
the stage in plain words ("Reading your chart's timing", "Writing your cards"). Poll every 2 s while `running`.
The header chip next to the fresh-reading control reads from `build`.

**UI/UX.** No planet or engine names in stage words. Under 5 s: no bar (the quip only). Failed: the bar stops red with
"That did not work. Try again"; the question is given back as today.

## 5. Architecture

Marker row (`area_builds`) is the one source of truth for build state; the page only reads it. No socket; polling as
today.

## 6. Ingredients

`src/reading/self/v2/store.ts` (marker), `src/reading/self/v2/build.ts` (stage calls), `src/reading/self/v2api/response.ts`
and `service.ts` (the `build` object), web `src/lib/selfV2Api.ts` (type), `src/components/LoadingVeil.tsx` (bar),
`src/pages/you/v2/SelfBoardV2.tsx` and `FreshReading.tsx` (chip, poll rate).

## 7. Action steps

1. Merge `fix/self-v2-build-clock`; deploy; rebuild `c584c0a3` once (free first build after the clock fix).
2. Server: marker stage writes + `build` object + unit tests (stage order, percent never decreases, stuck detection).
3. Web: `selfV2Api` type, veil bar, header chip, 2 s poll while running; tests.
4. QA on staging with a real first build and a clock switch; screenshots per TEST.MD.
5. Same `build` object for Love and Work boards.

## 8. Phases

Phase 1 = steps 1–3 for Self. Phase 2 = step 5.

## 9. Recommendation

Do step 1 now (it is the reason the screenshot looked dead), then steps 2 and 3 together on one server and one web
branch.
