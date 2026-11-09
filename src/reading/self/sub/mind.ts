/**
 * S6 `self.sub.mindFacts` (docs/reading-engine/66 §4.8): the evidence keys How you think and Where you get stuck read,
 * facts only. Feeling: the Moon's D1/D9 cards, the star profile, the stored D1 yogas naming the Moon. Thinking: Mercury
 * and the 5th. Peace: the 4th and its lord's card. Judgement: the 5th lord's card and Jupiter. Candidate patterns: the
 * stored placement of each pattern planet (env `SELF_V2_MIND_PATTERN_PLANETS`) and every planet the engine lists in the
 * Moon's `aspectedBy`. The Oracle names the pattern; nothing here interprets it.
 */
import type { MindFacts } from '../v2types.js';
import { houseKey, planetKey, STAR_KEY, yogaKey, type SubEnv } from './common.js';
import { getMindPatternPlanets } from './config.js';

export function subMindFacts(env: SubEnv): MindFacts {
  const { view, g } = env;
  const card = (varga: string, p: string | null | undefined): string[] => {
    if (!p) return [];
    if (view.planet(varga, p)) return [planetKey(varga, p)];
    g.add(`mind: planet:${varga}.${p} missing`);
    return [];
  };
  const house = (h: number): string[] => {
    if (view.house('D1', h)) return [houseKey('D1', h)];
    g.add(`mind: house:D1.h${h} missing`);
    return [];
  };
  const lunar = view.yogas().filter((y) => !/^yogas\.d\d+/.test(y.source ?? '') && y.planets.includes('Mo')).map((y) => yogaKey(y.id));
  const star = view.star();
  if (!star) g.add('mind: star profile missing');
  const h4 = view.house('D1', 4);
  const h5 = view.house('D1', 5);
  if (h4 && !h4.lord) g.add('mind: house:D1.h4.lord missing');
  if (h5 && !h5.lord) g.add('mind: house:D1.h5.lord missing');

  const candidatePatterns: MindFacts['candidatePatterns'] = [];
  for (const p of getMindPatternPlanets()) {
    const c = view.planet('D1', p);
    if (!c) { g.add(`mind: planet:D1.${p} missing`); continue; }
    if (c.house == null) { g.add(`mind: planet:D1.${p}.house missing`); continue; }
    candidatePatterns.push({ placement: `${p}.h${c.house}`, evidence: [planetKey('D1', p), houseKey('D1', c.house)] });
  }
  const mo = view.planet('D1', 'Mo');
  for (const p of mo?.aspectedBy ?? []) candidatePatterns.push({ placement: `${p}>Mo`, evidence: [planetKey('D1', p), planetKey('D1', 'Mo')] });

  return {
    feeling: [...card('D1', 'Mo'), ...card('D9', 'Mo'), ...(star ? [STAR_KEY] : []), ...lunar],
    thinking: [...card('D1', 'Me'), ...card('D9', 'Me'), ...house(5)],
    peace: [...house(4), ...card('D1', h4?.lord)],
    judgement: [...card('D1', h5?.lord), ...card('D1', 'Ju')],
    candidatePatterns,
  };
}
