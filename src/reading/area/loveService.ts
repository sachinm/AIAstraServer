/**
 * The Love board service (docs/reading-engine/54 §3, 45 §8.2): the Love area over the stored digest, built once a day,
 * the companion memory's `love.status` selecting meet, health or reconcile and hiding what does not fit (doc 48).
 * The build is boardService.getAreaBoard.
 */
import { getAreaBoard, type AreaBoardResult, type AreaSpec, type BoardBuildOptions, type BoardDeps } from './boardService.js';
import { asLoveStatus, LOVE, loveFits, loveLead } from './love.js';

export const LOVE_SPEC: AreaSpec = {
  area: 'love',
  cfg: LOVE,
  agent: 'area.love_board',
  technique: 'love.activation',
  factKey: 'love.status',
  fits: (s, f) => loveFits(s, asLoveStatus(f)),
  lead: (f) => loveLead(asLoveStatus(f)),
};

export function getLoveBoard(deps: BoardDeps, userId: string, opts: BoardBuildOptions = {}): Promise<AreaBoardResult> {
  return getAreaBoard(deps, LOVE_SPEC, userId, opts);
}
