/**
 * The missing-fact question (docs/reading-engine/66 §2, AGENTS.md "We are making a Vedic astrology personal assistant"
 * rules 3 and 6): questions follow facts. The Personalizer's own hero question wins; when it has none and a fact the
 * Personalizer benefits from is neither stored nor declined, the board asks the wizard's question for the first one.
 */
import { getSelfV2FactKeys } from '../../../config/env.js';
import type { HeroDoc, ProfilePack } from '../v2types.js';
import { FACT_QUESTIONS, type FactQuestion } from './words.js';

/** claim id prefix of a fact question: the web sends its answer to PUT /api/profile/facts, not to confirm */
export const FACT_CLAIM_PREFIX = 'fact.';

function has(pack: Pick<ProfilePack, 'facts'>, key: string): boolean {
  const f = pack.facts;
  switch (key) {
    case 'work.status':
      return !!f.work?.status;
    case 'work.level':
      return !!f.work?.level;
    case 'love.status':
      return !!f.love;
    case 'family.children':
      return !!f.children;
    case 'self.focus':
      return !!f.focus?.length;
    case 'place.current':
      return !!f.place;
    default:
      return false;
  }
}

/** The fact keys the Personalizer would benefit from that are not stored and not declined, in asking order. */
export function missingFacts(pack: Pick<ProfilePack, 'facts' | 'declined'>, keys: readonly string[] = getSelfV2FactKeys()): string[] {
  const declined = new Set(pack.declined);
  return keys.filter((k) => !declined.has(k) && !has(pack, k));
}

/** The wizard question for the first missing key that has words, or null. */
export function factQuestion(missing: readonly string[]): FactQuestion | null {
  for (const k of missing) {
    const q = FACT_QUESTIONS[k];
    if (q) return q;
  }
  return null;
}

/** The hero's question: the Personalizer's when it wrote one, else the first missing fact's (claimId `fact.<key>`). */
export function pickHeroQuestion(hero: HeroDoc | null, missing: readonly string[]): HeroDoc['question'] {
  if (hero?.question) return hero.question;
  const q = factQuestion(missing);
  return q ? { claimId: `${FACT_CLAIM_PREFIX}${q.key}`, text: q.text } : null;
}
