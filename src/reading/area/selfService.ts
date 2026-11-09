/**
 * The You board service (docs/reading-engine/54 §3, 45 §8.3): the Self area over the stored digest, built once a day,
 * the companion memory's `self.focus` choosing the lead sub-area (doc 48). The build is boardService.getAreaBoard.
 */
import { getAreaBoard, type AreaBoardResult, type AreaSpec, type BoardBuildOptions, type BoardDeps } from './boardService.js';
import { SELF, selfFits, selfLead } from './self.js';

export const SELF_SPEC: AreaSpec = {
  area: 'self',
  cfg: SELF,
  agent: 'area.self_board',
  technique: 'self.activation',
  factKey: 'self.focus',
  fits: (s) => selfFits(s),
  lead: (f) => selfLead(f),
};

export function getSelfBoard(deps: BoardDeps, userId: string, opts: BoardBuildOptions = {}): Promise<AreaBoardResult> {
  return getAreaBoard(deps, SELF_SPEC, userId, opts);
}
