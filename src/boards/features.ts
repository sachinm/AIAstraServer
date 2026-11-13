/**
 * Board feature switches (docs/reading-engine/75 §4.1). Every card and every in-card feature has a key, a default state
 * (off | on | premium) and a minimum plan. Resolution, highest first: the person's newest `user_feature_overrides` row,
 * env (`BOARD_FEATURES_OFF`, `BOARD_FEATURES_PREMIUM`), the default here. The server decides; the web only renders what
 * the payload allows. The admin mirrors this catalogue in `aiadastra_admin/api/src/features.ts`.
 */
import type { PrismaClient } from '@prisma/client';
import type { PlanCode } from '../billing/plans.js';
import { getBoardFeaturesOff, getBoardFeaturesPremium } from '../config/env.js';
import { BOARD_CARDS } from '../reading/boards/catalogue.js';
import { SELF_CARDS } from '../reading/self/v3/cards.js';

export type FeatureState = 'off' | 'on' | 'premium';
export const FEATURE_STATES: readonly FeatureState[] = ['off', 'on', 'premium'];

/** what the payload carries for an allowed feature; an `off` feature is absent */
export type FeatureGrant = { locked: false } | { locked: true; minPlan: PlanCode };

export interface FeatureDef {
  key: string;
  kind: 'card' | 'feature';
  /** `card`: shown inside each card (listed per card); `board`: once per board */
  scope: 'card' | 'board';
  label: string;
  default: FeatureState;
  /** the plan a `premium` state needs (a `free` minimum reads as `plus` once premium) */
  minPlan: PlanCode;
}

const PLAN_RANK: Readonly<Record<PlanCode, number>> = { free: 0, plus: 1, unlimited: 2 };

export const cardFeatureKey = (board: string, cardId: string): string => `card.${board}.${cardId}`;

const feature = (key: string, label: string, def: FeatureState, scope: 'card' | 'board' = 'card'): FeatureDef => ({ key, kind: 'feature', scope, label, default: def, minPlan: 'free' });

/** the in-card and board features; the foundation set is on for free, the drawing-board set is off */
export const FEATURE_FLAGS: readonly FeatureDef[] = [
  feature('feature.face.short', 'Short face', 'on'),
  feature('feature.periods', 'Named periods', 'on'),
  feature('feature.key_dates', 'Key dates', 'on'),
  feature('feature.why_panel', 'Why panel', 'on'),
  feature('feature.card_chat', 'Card chat', 'on'),
  feature('feature.confirm', 'Is this right?', 'on'),
  feature('feature.voice', 'Voice (Gentle / Direct)', 'on', 'board'),
  feature('feature.calendar', 'Calendar', 'off'),
  feature('feature.table', 'Table', 'off'),
  feature('feature.timeframes', 'By timeframe', 'off'),
  feature('feature.plan_tool', 'Plan tool', 'off'),
  feature('feature.info', 'Info', 'off'),
  feature('feature.breakdown_face', 'Breakdown face', 'off'),
  feature('feature.research_face', 'Research face', 'off'),
];

/** every card of every board, on by default (whether it is offered stays the registry's call) */
export const CARD_FLAGS: readonly FeatureDef[] = [
  ...SELF_CARDS.map((c) => ({ key: cardFeatureKey('self', c.id), kind: 'card' as const, scope: 'board' as const, label: c.title, default: 'on' as const, minPlan: 'free' as const })),
  ...BOARD_CARDS.map((c) => ({ key: cardFeatureKey(c.board, c.id), kind: 'card' as const, scope: 'board' as const, label: c.title, default: 'on' as const, minPlan: 'free' as const })),
];

export const FEATURES: readonly FeatureDef[] = [...CARD_FLAGS, ...FEATURE_FLAGS];

const BY_KEY: ReadonlyMap<string, FeatureDef> = new Map(FEATURES.map((f) => [f.key, f]));

export function featureDef(key: string): FeatureDef | null {
  return BY_KEY.get(key) ?? null;
}

export function isFeatureState(v: unknown): v is FeatureState {
  return typeof v === 'string' && (FEATURE_STATES as readonly string[]).includes(v);
}

export interface FeatureContext {
  plan: PlanCode;
  /** the person's overrides, key → state (newest row per key) */
  overrides?: ReadonlyMap<string, FeatureState>;
  /** default: env `BOARD_FEATURES_OFF` */
  off?: ReadonlySet<string>;
  /** default: env `BOARD_FEATURES_PREMIUM` (key → minimum plan or null) */
  premium?: ReadonlyMap<string, 'plus' | 'unlimited' | null>;
}

/** env read once per request */
export function featureContext(plan: PlanCode, overrides?: ReadonlyMap<string, FeatureState>): Required<FeatureContext> {
  return { plan, overrides: overrides ?? new Map(), off: new Set(getBoardFeaturesOff()), premium: getBoardFeaturesPremium() };
}

/** The state in force and what the payload carries (null: absent). */
export function resolveFeature(def: FeatureDef, ctx: FeatureContext): { state: FeatureState; grant: FeatureGrant | null } {
  const off = ctx.off ?? new Set(getBoardFeaturesOff());
  const premium = ctx.premium ?? getBoardFeaturesPremium();
  const override = ctx.overrides?.get(def.key);
  let state: FeatureState = def.default;
  let minPlan: PlanCode = def.minPlan;
  if (override) state = override;
  else if (off.has(def.key)) state = 'off';
  else if (premium.has(def.key)) {
    state = 'premium';
    minPlan = premium.get(def.key) ?? def.minPlan;
  }
  if (state === 'off') return { state, grant: null };
  if (state === 'on') return { state, grant: { locked: false } };
  const need: PlanCode = minPlan === 'free' ? 'plus' : minPlan;
  return { state, grant: PLAN_RANK[ctx.plan] >= PLAN_RANK[need] ? { locked: false } : { locked: true, minPlan: need } };
}

/** Every allowed key with its grant (off keys absent). */
export function resolveFeatures(ctx: FeatureContext, defs: readonly FeatureDef[] = FEATURES): Map<string, FeatureGrant> {
  const out = new Map<string, FeatureGrant>();
  for (const d of defs) {
    const r = resolveFeature(d, ctx);
    if (r.grant) out.set(d.key, r.grant);
  }
  return out;
}

/** the in-card feature grants, as the payload lists them per card */
export function cardFeatureGrants(grants: ReadonlyMap<string, FeatureGrant>): Record<string, FeatureGrant> {
  const out: Record<string, FeatureGrant> = {};
  for (const d of FEATURE_FLAGS) {
    const g = grants.get(d.key);
    if (g && d.scope === 'card') out[d.key] = g;
  }
  return out;
}

/** the feature (not card) grants for the board-level list */
export function boardFeatureGrants(grants: ReadonlyMap<string, FeatureGrant>): Record<string, FeatureGrant> {
  const out: Record<string, FeatureGrant> = {};
  for (const d of FEATURE_FLAGS) {
    const g = grants.get(d.key);
    if (g) out[d.key] = g;
  }
  return out;
}

/** usable: allowed and not locked */
export const usable = (grants: ReadonlyMap<string, FeatureGrant>, key: string): boolean => grants.get(key)?.locked === false;

/** The person's overrides, newest row per key; rows with an unknown key or state are ignored. */
export async function readFeatureOverrides(prisma: PrismaClient, userId: string): Promise<Map<string, FeatureState>> {
  const rows = await prisma.userFeatureOverride.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    select: { key: true, state: true },
    take: 500,
  });
  const out = new Map<string, FeatureState>();
  for (const r of rows) {
    if (out.has(r.key) || !featureDef(r.key) || !isFeatureState(r.state)) continue;
    out.set(r.key, r.state);
  }
  return out;
}
