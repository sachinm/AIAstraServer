/**
 * Words tables of the Self board v2 (docs/reading-engine/66 §4.8; doc 32 §1.1 for the house meanings).
 *
 * reviewed by Sachin before release; vocabulary, not derivation
 *
 * Every key is a value the engine already returned (a house number from a stored row, a planet code, an engine class or
 * functional-nature label); the value is a plain vocabulary key the briefs and the model agents read. Nothing here
 * computes a house, a lord, a relation, a strength or a polarity.
 */
import type { Matter, PeopleLabel, Polarity, PromiseKind } from './v2types.js';

/** `SELF.people`: the people a house's matters are about. The 8th and the 12th name no people. */
export const SELF_PEOPLE: Readonly<Partial<Record<number, PeopleLabel>>> = {
  1: 'self',
  2: 'family_of_origin',
  3: 'siblings_and_peers',
  4: 'home_and_mother',
  5: 'children',
  6: 'rivals_and_creditors',
  7: 'partners_and_clients',
  9: 'father_and_teachers',
  10: 'authority_and_boss',
  11: 'friends_and_elder_siblings',
};

/** `SELF.matters`: the life matter of a house. */
export const SELF_MATTERS: Readonly<Record<number, Matter>> = {
  1: 'self_and_body',
  2: 'money_in_hand',
  3: 'effort_and_courage',
  4: 'home_and_peace',
  5: 'ideas_and_children',
  6: 'work_load_and_health',
  7: 'partnership',
  8: 'sudden_and_hidden',
  9: 'luck_and_belief',
  10: 'career_and_standing',
  11: 'gains_and_network',
  12: 'loss_rest_and_distance',
};

/** `SELF.risk_what`: what a pressing period or transit of a planet can bring, as a words key (not prose). */
export const RISK_WHAT: Readonly<Record<string, string>> = {
  Sa: 'burden_and_delay',
  Ra: 'restless_speculation',
  Ke: 'detachment',
  Ma: 'conflict_and_haste',
  Su: 'authority_clash',
  Me: 'overthinking',
  Ve: 'comfort_and_cost',
  Mo: 'emotional_swings',
  Ju: 'advice_gone_wrong',
};

/** The engine's functional-nature label of a planet (`PlanetCard.functional`) as a window polarity. */
export const FUNCTIONAL_POLARITY: Readonly<Record<string, Polarity>> = {
  malefic: 'presses',
  benefic: 'supports',
  neutral: 'mixed',
};

/** The digest's yoga / dosha class labels as a promise kind; a class not listed here ('named') is not a promise entry. */
export const PROMISE_KIND_BY_CLASS: ReadonlyArray<{ match: string; kind: PromiseKind }> = [
  { match: 'cancel', kind: 'grace' },
  { match: 'dosha', kind: 'knot' },
  { match: 'afflict', kind: 'knot' },
  { match: 'raja', kind: 'gift' },
  { match: 'mahapurusha', kind: 'gift' },
  { match: 'dhana', kind: 'gift' },
  { match: 'viparita', kind: 'gift' },
];

export function promiseKindOf(cls: string | null | undefined): PromiseKind | null {
  const c = (cls ?? '').toLowerCase();
  if (!c) return null;
  return PROMISE_KIND_BY_CLASS.find((x) => c.includes(x.match))?.kind ?? null;
}

export const mattersOf = (houses: readonly number[]): Matter[] => [...new Set(houses.map((h) => SELF_MATTERS[h]).filter((m): m is Matter => Boolean(m)))];
export const peopleOf = (houses: readonly number[]): PeopleLabel[] => [...new Set(houses.map((h) => SELF_PEOPLE[h]).filter((p): p is PeopleLabel => Boolean(p)))];
