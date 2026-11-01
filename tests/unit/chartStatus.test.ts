import { describe, expect, it } from 'vitest';
import { CHART_BUILD_FAILED_MESSAGE, chartStatusFrom, type ChartStatusInput } from '../../src/services/chartStatusService.js';

const base: ChartStatusInput = {
  profileComplete: true,
  hasKundli: true,
  kundliAdded: false,
  factsStatus: 'pending',
  leaseHeld: false,
  hasSyncError: false,
  gateDone: 0,
  gateTotal: 24,
  restDone: 0,
  restTotal: 89,
  readingEngine: true,
};

describe('chartStatusFrom', () => {
  it('is pending with no profile, no kundli, or nothing started', () => {
    expect(chartStatusFrom({ ...base, profileComplete: false }).status).toBe('pending');
    expect(chartStatusFrom({ ...base, hasKundli: false }).status).toBe('pending');
    expect(chartStatusFrom(base).status).toBe('pending');
  });

  it('is building the gate while a worker holds the lease or items have landed', () => {
    expect(chartStatusFrom({ ...base, leaseHeld: true })).toMatchObject({ status: 'building', stage: 'gate' });
    expect(chartStatusFrom({ ...base, gateDone: 7 })).toMatchObject({ status: 'building', stage: 'gate', gate_done: 7, gate_total: 24 });
  });

  it('is building the dossier once the gate is done and chat is not open yet', () => {
    expect(chartStatusFrom({ ...base, gateDone: 24, factsStatus: 'building', leaseHeld: true })).toMatchObject({ status: 'building', stage: 'facts' });
  });

  it('opens chat when the gate flag is set, with the rest still building', () => {
    expect(chartStatusFrom({ ...base, kundliAdded: true, gateDone: 24, restDone: 31 })).toMatchObject({ status: 'chat_ready', stage: 'rest', rest_done: 31 });
  });

  it('is ready when the rest is done', () => {
    expect(chartStatusFrom({ ...base, kundliAdded: true, gateDone: 24, restDone: 89 })).toMatchObject({ status: 'ready', stage: null });
  });

  it('keeps chat open for an older user with no chart rows', () => {
    expect(chartStatusFrom({ ...base, kundliAdded: true }).status).toBe('chat_ready');
  });

  it('reports failed only when nothing is running, in words safe to show', () => {
    expect(chartStatusFrom({ ...base, hasSyncError: true })).toMatchObject({ status: 'failed', last_error: CHART_BUILD_FAILED_MESSAGE });
    expect(chartStatusFrom({ ...base, hasSyncError: true, leaseHeld: true }).status).toBe('building');
    expect(chartStatusFrom({ ...base, hasSyncError: true, kundliAdded: true }).status).toBe('chat_ready');
  });

  it('reading_mode is full only with the dossier and the engine on', () => {
    expect(chartStatusFrom({ ...base, factsStatus: 'ready' }).reading_mode).toBe('full');
    expect(chartStatusFrom({ ...base, factsStatus: 'unsupported' }).reading_mode).toBe('legacy');
    expect(chartStatusFrom({ ...base, factsStatus: 'ready', readingEngine: false }).reading_mode).toBe('legacy');
  });
});
