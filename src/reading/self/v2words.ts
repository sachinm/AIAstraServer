/**
 * Words tables of the Self board v2 (docs/reading-engine/66 §4.8; doc 32 §1.1 for the house meanings).
 *
 * reviewed by Sachin before release; vocabulary, not derivation
 *
 * Every key is a value the engine already returned (a house number from a stored row, a planet code, an engine class or
 * functional-nature label); the value is a plain vocabulary key the briefs and the model agents read. Nothing here
 * computes a house, a lord, a relation, a strength or a polarity.
 */
import type { LifeLabel, Matter, PeopleLabel, Polarity, PromiseKind } from './v2types.js';

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

// ---------------------------------------------------------------------------------------------------------------------
// run 2 fixes (doc 66 replay run 2, failure 6: the hero question did not ask about its own claim)
// reviewed by Sachin before release; vocabulary, not derivation
// ---------------------------------------------------------------------------------------------------------------------

/**
 * `SELF.matter_plain`: each life matter in everyday words. `phrase` is what the hero question asks about; `words` are
 * the plain words that show a question names the matter (the validator drops a question that names none of its claim's
 * matters). `childWords` are used only when the person stated children.
 */
export const MATTER_PLAIN: Readonly<Record<Matter, { phrase: string; words: readonly string[]; childWords?: readonly string[] }>> = {
  self_and_body: { phrase: 'your energy', words: ['energy', 'body', 'health', 'stamina', 'yourself', 'vitality', 'pace'] },
  money_in_hand: { phrase: 'money and savings', words: ['money', 'savings', 'income', 'spending', 'finances', 'financial', 'bills', 'earnings'] },
  effort_and_courage: { phrase: 'your own push and effort', words: ['effort', 'push', 'drive', 'courage', 'initiative', 'energy to start', 'siblings'] },
  home_and_peace: { phrase: 'home and peace of mind', words: ['home', 'house', 'household', 'peace', 'calm', 'mother', 'settled'] },
  ideas_and_children: { phrase: 'your creative projects and new ideas', words: ['creative', 'creativity', 'ideas', 'idea', 'projects', 'project', 'making', 'learning', 'hobbies'], childWords: ['children', 'child', 'kids'] },
  work_load_and_health: { phrase: 'your daily load', words: ['work', 'workload', 'load', 'routine', 'duties', 'chores', 'habits', 'health'] },
  partnership: { phrase: 'your closest partnership', words: ['partner', 'partnership', 'marriage', 'spouse', 'relationship', 'agreements', 'contracts'] },
  sudden_and_hidden: { phrase: 'sudden changes', words: ['sudden', 'unexpected', 'upheaval', 'hidden', 'shake'] },
  luck_and_belief: { phrase: 'your faith and sense of meaning', words: ['faith', 'belief', 'beliefs', 'meaning', 'purpose', 'spiritual', 'prayer', 'luck', 'teachers', 'teacher'] },
  career_and_standing: { phrase: 'work and your standing', words: ['work', 'career', 'job', 'business', 'standing', 'reputation', 'role'] },
  gains_and_network: { phrase: 'friends and your wider circle', words: ['friends', 'friend', 'friendships', 'circle', 'network', 'community', 'gains', 'hopes', 'groups'] },
  loss_rest_and_distance: { phrase: 'rest and time alone', words: ['rest', 'sleep', 'retreat', 'solitude', 'distance', 'spending'] },
};

/** `SELF.people_plain`: the people a matter is about, in everyday words; `null` people are left out of a question. */
export const PEOPLE_PLAIN: Readonly<Record<PeopleLabel, string | null>> = {
  partners_and_clients: 'partners',
  authority_and_boss: 'people in charge',
  rivals_and_creditors: 'rivals',
  home_and_mother: 'family at home',
  father_and_teachers: 'teachers and mentors',
  siblings_and_peers: 'siblings and peers',
  friends_and_elder_siblings: 'friends',
  children: 'children',
  family_of_origin: 'your family',
  self: null,
};

const MATTER_IDS = Object.keys(MATTER_PLAIN) as Matter[];

/**
 * The life matters a claim id names (`stuck.heaviest_now:presses:ideas_and_children+luck_and_belief`, `now.risk:partnership:…`,
 * `stuck.work_load` → work_load_and_health). Vocabulary matching on the id's own words; nothing derived.
 */
export function mattersOfClaim(claimId: string): Matter[] {
  const tokens = claimId.replace(/^claim:/, '').split(/[.:+#]/).filter(Boolean);
  const out: Matter[] = [];
  for (const t of tokens) {
    const m = MATTER_IDS.find((x) => x === t) ?? (t.length > 3 ? MATTER_IDS.find((x) => x.startsWith(`${t}_and_`)) : undefined);
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// personalizer portrait: the life labels Sachin named (2026-11-09) on the matters table
// reviewed by Sachin before release; vocabulary, not derivation
// ---------------------------------------------------------------------------------------------------------------------

/**
 * `SELF.life_labels`: each label the portrait states, as the matters (`SELF.matters`) whose windows and ledger rows
 * speak for it. `family` reads the family of origin (money_in_hand: the 2nd's matter) and children; `business` reads
 * partnership and gains; `health` reads the body and the daily load.
 */
export const LIFE_LABEL_MATTERS: Readonly<Record<LifeLabel, readonly Matter[]>> = {
  career: ['career_and_standing'],
  love: ['partnership'],
  self: ['self_and_body'],
  home: ['home_and_peace'],
  family: ['money_in_hand', 'ideas_and_children'],
  business: ['partnership', 'gains_and_network'],
  health: ['self_and_body', 'work_load_and_health'],
  fortune: ['luck_and_belief'],
  work: ['work_load_and_health'],
  gains: ['gains_and_network'],
  sacrifices: ['loss_rest_and_distance'],
};
