/**
 * S4 `self.sub.promise` (docs/reading-engine/66 §4.8): what the chart promises and threatens, from the stored D1 yoga and
 * dosha rows (their class as the digest labels it: gift, knot or grace via `PROMISE_KIND_BY_CLASS`), the engine's
 * dosha exceptions (a grace that cancels its dosha), and the engine charter's yogi / avayogi flags. The matter and the
 * people come from the stored houses through `SELF.matters` / `SELF.people`. The engine stores no strength grade for a
 * yoga, so every entry is 2 and a gap says so.
 */
import { mattersOf, peopleOf, promiseKindOf, SELF_MATTERS } from '../v2words.js';
import type { PromiseEntry, PromiseLedger, Strength } from '../v2types.js';
import { planetKey, yogaKey, type SubEnv } from './common.js';

const UNGRADED: Strength = 2;
const PLANETS = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
const norm = (n: string) => n.toLowerCase().replace(/dosha|yoga/g, '').replace(/[^a-z]/g, '');
/** a varga yoga row (`yogas.d9` …) is not a D1 promise */
const isVargaRow = (source: string) => /^yogas\.d\d+/.test(source ?? '');

export function subPromise(env: SubEnv): PromiseLedger {
  const entries: PromiseEntry[] = [];
  const seen = new Set<string>();
  let unclassed = 0;
  for (const y of env.view.yogas()) {
    if (isVargaRow(y.source)) continue;
    const kind = promiseKindOf(y.class);
    if (!kind) {
      unclassed += 1;
      continue;
    }
    const k = `${kind}|${norm(y.name)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const matter = mattersOf(y.houses)[0];
    if (!matter) {
      env.g.add(`promise: ${yogaKey(y.id)} has no stored houses`);
      continue;
    }
    entries.push({
      id: `promise:${y.id}`,
      matter,
      kind,
      source: { yogaId: y.id, ...(y.planets[0] ? { planet: y.planets[0] } : {}), house: y.houses[0]! },
      who: peopleOf(y.houses),
      strength: UNGRADED,
      evidence: [yogaKey(y.id), ...y.planets.map((p) => planetKey('D1', p))],
    });
    if (kind === 'knot' && y.details?.hasExceptions) {
      entries.push({
        id: `promise:${y.id}.exceptions`,
        matter,
        kind: 'grace',
        source: { yogaId: y.id },
        who: peopleOf(y.houses),
        strength: UNGRADED,
        cancels: `promise:${y.id}`,
        evidence: [yogaKey(y.id)],
      });
    }
  }
  if (unclassed) env.g.add(`promise: ${unclassed} yoga rows carry no gift/knot/grace class and were left out`);
  for (const p of PLANETS) {
    const card = env.view.planet('D1', p);
    const ch = card?.dashaCharter;
    if (!card || !ch) continue;
    const flags: Array<['yogi' | 'avayogi', boolean]> = [
      ['yogi', ch.isYogi],
      ['avayogi', ch.isAvayogi],
    ];
    for (const [flag, on] of flags) {
      if (!on) continue;
      const matter = card.house != null ? SELF_MATTERS[card.house] : undefined;
      if (!matter || card.house == null) {
        env.g.add(`promise: planet:D1.${p}.house missing for ${flag}`);
        continue;
      }
      entries.push({
        id: `promise:${p}.${flag}`,
        matter,
        kind: flag === 'yogi' ? 'gift' : 'knot',
        source: { planet: p, house: card.house },
        who: peopleOf([card.house, ...card.owns]),
        strength: UNGRADED,
        evidence: [planetKey('D1', p)],
      });
    }
  }
  if (entries.length) env.g.add('promise: the engine stores no strength grade for yogas; every entry is 2');
  return { entries };
}
