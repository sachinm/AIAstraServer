import { describe, expect, it } from 'vitest';
import { BUILD_STAGES, STAGE_STUCK_MS, STAGE_WEIGHT, buildView, percentAtStart, stageOfStep } from '../../../../../src/reading/self/v2/progress.js';

const now = new Date('2026-11-09T12:00:00Z');
const at = (sAgo: number) => new Date(now.getTime() - sAgo * 1000).toISOString();
const NONE = { status: null, stage: null, stageAt: null } as const;

describe('Self v2 build progress (docs/loading-overlay/05)', () => {
  it('weights sum to 100 and floors rise in build order', () => {
    expect(BUILD_STAGES.reduce((n, s) => n + STAGE_WEIGHT[s], 0)).toBe(100);
    const floors = BUILD_STAGES.map(percentAtStart);
    expect(floors[0]).toBe(0);
    for (let i = 1; i < floors.length; i++) expect(floors[i]).toBeGreaterThan(floors[i - 1]);
  });

  it('maps build step names onto the seven stages', () => {
    expect(stageOfStep('families')).toBe('families');
    expect(stageOfStep('warm.personalizer')).toBe('personalizer');
    expect(stageOfStep('oracle.validated')).toBeNull();
  });

  it('running: step, floor and next floor from the v2 marker stage', () => {
    const v = buildView({ state: 'building', startedAt: at(60) }, { status: 'building', stage: 'oracle', stageAt: at(10) }, now);
    expect(v).toMatchObject({ state: 'running', stage: 'oracle', step: 6, steps: 7, percent: 50, nextPercent: 80 });
  });

  it('queued while the queue marker runs but no v2 stage was written for this build', () => {
    expect(buildView({ state: 'building', startedAt: at(5) }, NONE, now).state).toBe('queued');
    // an earlier build's stage (before this queue start) does not count
    expect(buildView({ state: 'building', startedAt: at(5) }, { status: 'building', stage: 'oracle', stageAt: at(600) }, now).state).toBe('queued');
    // this request just queued it and no marker is readable yet
    expect(buildView({ state: 'none', startedAt: null }, NONE, now, true).state).toBe('queued');
  });

  it('stuck when the stage has not moved for too long, or the queue marker says so', () => {
    const old = at(STAGE_STUCK_MS / 1000 + 1);
    expect(buildView({ state: 'building', startedAt: at(900) }, { status: 'building', stage: 'families', stageAt: old }, now).state).toBe('stuck');
    expect(buildView({ state: 'stuck', startedAt: at(900) }, NONE, now).state).toBe('stuck');
  });

  it('failed, ready and none', () => {
    expect(buildView({ state: 'failed_recently', startedAt: at(60) }, NONE, now).state).toBe('failed');
    expect(buildView({ state: 'ready', startedAt: at(60) }, { status: 'ready', stage: 'personalizer', stageAt: at(30) }, now)).toMatchObject({ state: 'ready', percent: 100 });
    expect(buildView({ state: 'none', startedAt: null }, NONE, now)).toMatchObject({ state: 'none', percent: 0, step: 0 });
  });
});
