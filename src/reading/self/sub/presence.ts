/**
 * S8 `self.sub.presenceFacts` (docs/reading-engine/66 §4.3 How you come across, §4.8). Bearing: the 1st and the lagna
 * lord. Style: the planets the 1st house card lists as occupants and as graha drishti on it. Adornment: Venus D1/D9.
 * Face: the 2nd. Public vs private: AL, the Moon, the 4th. `bestWindow`: the most recent completed level-1 or level-2
 * period of the primary clock whose lord is Venus (env `SELF_V2_PRESENCE_PLANETS`) or the lagna lord. `liveCare`: the
 * running sub period when its lord is one of them. Lords and dates are the stored activation rows.
 */
import { activationKey } from '../slices.js';
import type { ClockResolution, PeriodFrame, PresenceFacts } from '../v2types.js';
import { houseKey, lagnaLord, planetKey, pointKey, type SubEnv } from './common.js';
import { getPresencePlanets } from './config.js';

export function subPresenceFacts(env: SubEnv, clock: ClockResolution, periods: PeriodFrame | null): PresenceFacts {
  const { view, g } = env;
  const has = (key: string, ok: boolean): string[] => {
    if (ok) return [key];
    g.add(`presence: ${key} missing`);
    return [];
  };
  const L = lagnaLord(env);
  const h1 = view.house('D1', 1);
  const stylePlanets = [...new Set([...(h1?.occupants.map((o) => o.planet) ?? []), ...(h1?.aspectedGraha ?? [])])];
  const lords = new Set([...getPresencePlanets(), ...(L ? [L] : [])]);

  const past = env.activation
    .filter((r) => r.system === clock.primary && (r.level === 1 || r.level === 2) && r.lord && lords.has(r.lord) && r.to <= env.asOf)
    .sort((a, b) => b.to.localeCompare(a.to) || a.level - b.level)[0];
  if (!past) g.add(`presence: no completed period of ${[...lords].join('/')} on ${clock.primary}`);

  const sub = periods?.runningSub ?? null;
  const liveCare = sub && lords.has(sub.lord) ? { lord: sub.lord, until: sub.to, evidence: sub.evidence } : null;

  return {
    bearing: [...has(houseKey('D1', 1), Boolean(h1)), ...(L ? has(planetKey('D1', L), Boolean(view.planet('D1', L))) : [])],
    style: stylePlanets.flatMap((p) => has(planetKey('D1', p), Boolean(view.planet('D1', p)))),
    adornment: [...has(planetKey('D1', 'Ve'), Boolean(view.planet('D1', 'Ve'))), ...has(planetKey('D9', 'Ve'), Boolean(view.planet('D9', 'Ve')))],
    face: has(houseKey('D1', 2), Boolean(view.house('D1', 2))),
    publicVsPrivate: [
      ...has(pointKey('D1', 'AL'), view.points('D1').some((p) => p.id === 'AL')),
      ...has(planetKey('D1', 'Mo'), Boolean(view.planet('D1', 'Mo'))),
      ...has(houseKey('D1', 4), Boolean(view.house('D1', 4))),
    ],
    bestWindow: past ? { from: past.from, to: past.to, evidence: activationKey(past) } : null,
    liveCare,
  };
}
