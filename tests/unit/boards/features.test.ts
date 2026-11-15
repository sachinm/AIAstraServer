/**
 * docs/reading-engine/75 §4.1–4.2: board feature switches. Resolution order (override, env, default), premium locks by
 * plan, and the Self payload cut to what the person may see.
 */
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { FEATURES, featureContext, featureDef, readFeatureOverrides, resolveFeature, resolveFeatures } from '../../../src/boards/features.js';
import { applySelfFeatures } from '../../../src/reading/self/v3/response.js';
import type { SelfV3CardView, SelfV3Response } from '../../../src/reading/self/v3/types.js';

afterEach(() => {
  delete process.env.BOARD_FEATURES_OFF;
  delete process.env.BOARD_FEATURES_PREMIUM;
});

describe('catalogue', () => {
  it('has a key for every Self, Love and Work card and every feature, each unique', () => {
    const keys = FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['card.self.body', 'card.self.chapter', 'card.love.love_where', 'card.work.work_move']) expect(featureDef(k)).not.toBeNull();
  });
  it('the foundation set is on for free; the drawing-board set is off', () => {
    for (const k of ['feature.face.short', 'feature.periods', 'feature.key_dates', 'feature.why_panel', 'feature.card_chat', 'feature.confirm', 'feature.voice']) {
      expect(featureDef(k)).toMatchObject({ default: 'on', minPlan: 'free' });
    }
    for (const k of ['feature.calendar', 'feature.table', 'feature.timeframes', 'feature.plan_tool', 'feature.info', 'feature.breakdown_face', 'feature.research_face']) {
      expect(featureDef(k)!.default).toBe('off');
    }
  });
});

describe('resolution', () => {
  const periods = featureDef('feature.periods')!;
  it('env off and env premium (with a plan) apply over the default', () => {
    process.env.BOARD_FEATURES_OFF = 'feature.periods';
    expect(resolveFeature(periods, featureContext('unlimited')).grant).toBeNull();
    delete process.env.BOARD_FEATURES_OFF;
    process.env.BOARD_FEATURES_PREMIUM = 'feature.periods=unlimited, feature.key_dates';
    expect(resolveFeature(periods, featureContext('plus')).grant).toEqual({ locked: true, minPlan: 'unlimited' });
    expect(resolveFeature(periods, featureContext('unlimited')).grant).toEqual({ locked: false });
    expect(resolveFeature(featureDef('feature.key_dates')!, featureContext('free')).grant).toEqual({ locked: true, minPlan: 'plus' });
  });
  it('a person override wins over env', () => {
    process.env.BOARD_FEATURES_OFF = 'feature.periods';
    expect(resolveFeature(periods, featureContext('free', new Map([['feature.periods', 'on']]))).grant).toEqual({ locked: false });
    expect(resolveFeature(featureDef('feature.calendar')!, featureContext('free', new Map([['feature.calendar', 'premium']]))).grant).toEqual({ locked: true, minPlan: 'plus' });
  });
  it('off keys are absent from the resolved map', () => {
    const g = resolveFeatures(featureContext('free'));
    expect(g.has('feature.calendar')).toBe(false);
    expect(g.get('feature.periods')).toEqual({ locked: false });
  });
});

describe('readFeatureOverrides', () => {
  it('newest row per key wins; unknown keys and states are ignored', async () => {
    const rows = [
      { key: 'feature.periods', state: 'off' },
      { key: 'feature.periods', state: 'on' },
      { key: 'feature.nope', state: 'on' },
      { key: 'feature.calendar', state: 'maybe' },
    ];
    const prisma = { userFeatureOverride: { findMany: async () => rows } } as unknown as PrismaClient;
    expect([...(await readFeatureOverrides(prisma, 'u1'))]).toEqual([['feature.periods', 'off']]);
  });
});

describe('applySelfFeatures', () => {
  const card = (id: string): SelfV3CardView =>
    ({
      id,
      title: id,
      periods: [{ id: 'p1' }],
      keyDates: [{ date: '2027-01-01' }],
      rail: [{}],
      standing: ['s'],
      firstLine: 'line',
      stale: false,
      staleDates: [],
      features: {},
      locked: null,
      options: { face: 'research' },
      v3: { confirm: { claimId: 'c', text: 'Did it?' } },
      v2: { card: null, rangeLabel: '', details: { headline: 'h', paragraphs: ['p'], evidence: ['planet:D1.Sa'] } },
    }) as unknown as SelfV3CardView;
  const body = (): SelfV3Response => ({ cards: [card('body'), card('mind'), card('stuck')], layout: { cards: ['body', 'mind', 'stuck'] }, features: {} }) as unknown as SelfV3Response;

  it('defaults: content kept, research face reads as read, board features listed', () => {
    const out = applySelfFeatures(body(), resolveFeatures(featureContext('free')));
    expect(out.cards).toHaveLength(3);
    expect(out.cards[0]!.options!.face).toBe('read');
    expect(out.cards[0]!.features['feature.periods']).toEqual({ locked: false });
    expect(out.features['feature.voice']).toEqual({ locked: false });
    expect(out.features['feature.calendar']).toBeUndefined();
  });
  it('an off card is absent from cards and layout; a locked card is a shell with no content', () => {
    process.env.BOARD_FEATURES_OFF = 'card.self.mind';
    process.env.BOARD_FEATURES_PREMIUM = 'card.self.stuck';
    const out = applySelfFeatures(body(), resolveFeatures(featureContext('free')));
    expect(out.cards.map((c) => c.id)).toEqual(['body', 'stuck']);
    expect(out.layout.cards).toEqual(['body', 'stuck']);
    expect(out.cards[1]).toMatchObject({ locked: { minPlan: 'plus' }, periods: [], keyDates: [], rail: [], standing: [], firstLine: null, v2: null, v3: null, features: {} });
  });
  it('off or locked in-card features empty their fields', () => {
    process.env.BOARD_FEATURES_OFF = 'feature.periods,feature.key_dates,feature.confirm';
    process.env.BOARD_FEATURES_PREMIUM = 'feature.why_panel';
    const out = applySelfFeatures(body(), resolveFeatures(featureContext('free')));
    const c = out.cards[0]!;
    expect(c.periods).toEqual([]);
    expect(c.keyDates).toEqual([]);
    expect(c.v3!.confirm).toBeNull();
    expect(c.v2!.details).toEqual({ evidence: [] });
    expect(c.features['feature.why_panel']).toEqual({ locked: true, minPlan: 'plus' });
    expect(c.features['feature.periods']).toBeUndefined();
  });
});

describe('migration m52', () => {
  it('is additive and creates user_feature_overrides', () => {
    const p = 'prisma/migrations/20261113100000_user_feature_overrides_m52/migration.sql';
    expect(existsSync(p)).toBe(true);
    const sql = readFileSync(p, 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "user_feature_overrides"/);
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i);
    for (const col of ['user_id', 'key', 'state', 'set_by', 'reason', 'created_at']) expect(sql).toContain(`"${col}"`);
  });
});
