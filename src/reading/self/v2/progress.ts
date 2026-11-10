/**
 * Self v2 build progress (docs/loading-overlay/05). The build writes its stage into today's `self.v2` marker after each
 * step; GET /api/self/v2 turns that marker and the board's queue marker (`self.reading`) into `build`, which the page
 * draws as a progress bar and a header line. Pure: no reads here (store.ts reads, the v2 API composes).
 *
 * Who says what:
 *   the queue marker (`self.reading`, buildEvent.ts) says whether a build is running, stuck, failed or done; it stays
 *     `building` until the v2 build has finished, so it is the one source for "running".
 *   the v2 marker (`self.v2`, store.ts) says which stage the v2 build is on, and when it got there.
 */

/** The seven steps a person sees, in build order (build.ts `step()` names; the sub-steps map onto these). */
export const BUILD_STAGES = ['subs', 'briefs', 'slices', 'warm', 'families', 'oracle', 'personalizer'] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];

/**
 * Share of the whole build per stage, from doc 66 replay run 2's `ms` map (the model stages are most of it). Sums to
 * 100. The page eases between a stage's floor and the next one's, so the bar keeps moving inside a long stage.
 */
export const STAGE_WEIGHT: Readonly<Record<BuildStage, number>> = { subs: 5, briefs: 3, slices: 2, warm: 5, families: 35, oracle: 30, personalizer: 20 };

/** How long a stage usually takes (ms), for the page's easing; not a limit. */
export const STAGE_EXPECTED_MS: Readonly<Record<BuildStage, number>> = { subs: 4_000, briefs: 1_000, slices: 1_000, warm: 4_000, families: 25_000, oracle: 40_000, personalizer: 25_000 };

/** No stage change for this long while running: the build is taken as stuck (the Oracle's own time-out is 150 s). */
export const STAGE_STUCK_MS = 5 * 60_000;

/** build.ts step names → the stage a person sees; null for names that are not a new stage. */
export function stageOfStep(step: string): BuildStage | null {
  if ((BUILD_STAGES as readonly string[]).includes(step)) return step as BuildStage;
  if (step === 'warm.personalizer') return 'personalizer';
  return null;
}

/** The bar's floor when a stage starts: the weights of every stage before it. */
export function percentAtStart(stage: BuildStage): number {
  let n = 0;
  for (const s of BUILD_STAGES) {
    if (s === stage) return n;
    n += STAGE_WEIGHT[s];
  }
  return n;
}

export type BuildState = 'none' | 'queued' | 'running' | 'ready' | 'failed' | 'stuck';

/** GET /api/self/v2 `build` (docs/loading-overlay/05 §4). Never carries raw error text. */
export interface SelfV2BuildView {
  state: BuildState;
  stage: BuildStage | null;
  /** 1..7 while running on a stage; 0 otherwise */
  step: number;
  steps: number;
  /** the bar's floor now, 0..100; 100 when ready */
  percent: number;
  /** the next stage's floor (the bar eases toward it, never past it) */
  nextPercent: number;
  /** how long this stage usually takes, ms (null when not running on a stage) */
  stageExpectedMs: number | null;
  startedAt: string | null;
  stageAt: string | null;
}

export const NO_BUILD: Readonly<SelfV2BuildView> = Object.freeze({
  state: 'none',
  stage: null,
  step: 0,
  steps: BUILD_STAGES.length,
  percent: 0,
  nextPercent: 0,
  stageExpectedMs: null,
  startedAt: null,
  stageAt: null,
});

export interface QueueMarkerView {
  state: 'none' | 'building' | 'stuck' | 'ready' | 'failed_recently' | 'failed';
  startedAt: string | null;
}

export interface V2MarkerView {
  status: 'building' | 'ready' | 'failed' | null;
  stage: string | null;
  stageAt: string | null;
}

const ms = (iso: string | null): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * The page's `build` from today's two markers. `queuedNow`: this very request queued a build (the marker may not be
 * readable yet).
 */
export function buildView(queue: QueueMarkerView, v2: V2MarkerView, now: Date, queuedNow = false): SelfV2BuildView {
  const base = { ...NO_BUILD, startedAt: queue.startedAt };
  if (queue.state === 'stuck') return { ...base, state: 'stuck' };
  if (queue.state === 'failed' || queue.state === 'failed_recently') return { ...base, state: 'failed' };
  if (queue.state === 'building' || queuedNow) {
    // the v2 marker's stage counts only when it was written for this build (after the queue marker started)
    const stage = v2.status === 'building' && v2.stage && ms(v2.stageAt) >= ms(queue.startedAt) ? stageOfStep(v2.stage) : null;
    if (!stage) return { ...base, state: 'queued', nextPercent: STAGE_WEIGHT.subs, stageExpectedMs: STAGE_EXPECTED_MS.subs };
    if (now.getTime() - ms(v2.stageAt) > STAGE_STUCK_MS) return { ...base, state: 'stuck', stage, stageAt: v2.stageAt };
    const i = BUILD_STAGES.indexOf(stage);
    const percent = percentAtStart(stage);
    return {
      ...base,
      state: 'running',
      stage,
      step: i + 1,
      percent,
      nextPercent: percent + STAGE_WEIGHT[stage],
      stageExpectedMs: STAGE_EXPECTED_MS[stage],
      stageAt: v2.stageAt,
    };
  }
  if (queue.state === 'ready') return { ...base, state: 'ready', percent: 100, nextPercent: 100 };
  return { ...NO_BUILD };
}
