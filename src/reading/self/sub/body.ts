/**
 * S7 `self.sub.bodyFacts` (docs/reading-engine/66 §4.8): the evidence keys Body & energy reads. Footing: the 1st, the
 * lagna lord, the Sun. Wear: the 6th, the 8th, Mars, Saturn, A6. Shape: D30 h1 and the Moon. Live lords: the running
 * periods of the primary clock whose STORED activation houses include a body house (env `SELF_V2_BODY_HOUSES`). Live
 * transits: S3's live overlay rows of the body transit planets over the lagna or the Moon (stored `house_from_lagna` /
 * `house_from_moon` = 1) and Sade Sati. `sensitive` is the engine's flag only: none is stored, so it is false and a gap
 * says so.
 */
import { runningChain } from '../slices.js';
import type { BodyFacts, ClockResolution, WindowSetDetail } from '../v2types.js';
import { houseKey, lagnaLord, planetKey, pointKey, type SubEnv } from './common.js';
import { getBodyHouses, getBodyTransitPlanets, isLive } from './config.js';
import { toRef } from './windows.js';
import { activationKey } from '../slices.js';

export function subBodyFacts(env: SubEnv, clock: ClockResolution, windows: WindowSetDetail): BodyFacts {
  const { view, g } = env;
  const has = (key: string, ok: boolean): string[] => {
    if (ok) return [key];
    g.add(`body: ${key} missing`);
    return [];
  };
  const L = lagnaLord(env);
  const footing = [
    ...has(houseKey('D1', 1), Boolean(view.house('D1', 1))),
    ...(L ? has(planetKey('D1', L), Boolean(view.planet('D1', L))) : []),
    ...has(planetKey('D1', 'Su'), Boolean(view.planet('D1', 'Su'))),
  ];
  const wear = [
    ...has(houseKey('D1', 6), Boolean(view.house('D1', 6))),
    ...has(houseKey('D1', 8), Boolean(view.house('D1', 8))),
    ...has(planetKey('D1', 'Ma'), Boolean(view.planet('D1', 'Ma'))),
    ...has(planetKey('D1', 'Sa'), Boolean(view.planet('D1', 'Sa'))),
    ...has(pointKey('D1', 'A6'), view.points('D1').some((p) => p.id === 'A6')),
  ];
  const shape = [
    ...has(houseKey('D30', 1), Boolean(view.house('D30', 1))),
    ...has(planetKey('D1', 'Mo'), Boolean(view.planet('D1', 'Mo'))),
  ];

  const bodyHouses = new Set(getBodyHouses());
  const chain = runningChain(env.activation, clock.primary, env.asOf);
  const liveLords: BodyFacts['liveLords'] = [];
  for (const r of [chain.l1, chain.l2, chain.l3]) {
    if (!r || !r.lord) continue;
    const houses = r.houses.filter((h) => bodyHouses.has(h));
    if (houses.length) liveLords.push({ lord: r.lord, houses, until: r.to, evidence: activationKey(r) });
  }

  const tp = new Set(getBodyTransitPlanets());
  const liveTransits = windows.rows
    .filter((w) => w.kind !== 'dasha' && isLive(w.from, w.to, env.asOf))
    .filter((w) => w.kind === 'sade_sati' || (w.planet != null && tp.has(w.planet) && (w.houses.includes(1) || w.houseFromMoon === 1)))
    .map(toRef);

  g.add('body: the engine stores no sensitive-passage flag; sensitive is false');
  return { footing, wear, shape, liveLords, liveTransits, sensitive: false };
}
