/**
 * What every Self v2 sub-technique receives (docs/reading-engine/66 §4.8 Layer 1): the Layer 0 rows loaded once per build
 * and a gap list. A sub-technique selects and joins; where a stored row lacks a value it returns null for it and adds a
 * gap, never a default.
 */
import type { ActivationRow } from '../../digest/activation.js';
import type { DigestView } from '../../digest/types.js';
import type { TransitRangePayload } from '../../chartData/transitRange.js';
import type { Gaps } from '../slices.js';
import type { IsoDate } from '../v2types.js';
import type { PressureInventoryDetail } from './pressure.js';

export interface SubEnv {
  view: DigestView;
  /** the primary clock and its confirming clocks, levels 1–2 over the life, level 3 near asOf */
  activation: readonly ActivationRow[];
  sky: TransitRangePayload | null;
  asOf: IsoDate;
  g: Gaps;
  /** the engine's pressure inventory on the primary clock, when stored (S3 prefers it; absent: degraded mode) */
  pressure?: PressureInventoryDetail | null;
}

export const planetKey = (varga: string, p: string): string => `planet:${varga}.${p}`;
export const houseKey = (varga: string, h: number): string => `house:${varga}.h${h}`;
export const pointKey = (varga: string, id: string): string => `point:${varga}.${id}`;
export const yogaKey = (id: string): string => `yoga:D1.${id}`;
export const STAR_KEY = 'star:profile';

/** the lagna lord as the D1 house card states it; null and a gap when not stored */
export function lagnaLord(env: SubEnv): string | null {
  const lord = env.view.house('D1', 1)?.lord ?? null;
  if (!lord) env.g.add('house:D1.h1.lord missing');
  return lord;
}
