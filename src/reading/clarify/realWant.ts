/**
 * What the person really wants to know (docs/reading-engine/33 §4.2). The table is data; inference is by rules on the words of
 * the question, and when no rule matches the slot stays empty. Asking it as a clarify question with chips is doc 33 §8 decision
 * 1, which is Sachin's, so this only fills it when the words are clear.
 *
 * `sensitive` is the category's sensitive core: for the Oracle, never shown as a chip or to the person.
 */
import type { BucketId } from '../buckets/taxonomy.js';

export interface RealWant {
  id: string;
  line: string;
  sensitive: string | null;
}

type Row = [id: string, line: string, cue: RegExp];

const GENERAL: Row[] = [
  ['why_now', 'why this is happening now', /\bwhy\b/i],
  ['what_can_i_do', 'what they can do about it', /\b(what (?:can|should) i do|how (?:can|do) i|what to do|help me)\b/i],
  ['when_does_it_ease', 'when it eases', /\b(when (?:will|does) (?:it|this|things?) (?:ease|end|get better|improve|change|pass)|how long)\b/i],
  ['is_it_serious', 'whether it is serious', /\b(serious|worried|scared|afraid)\b/i],
  ['is_it_me', 'whether it is their fault', /\b(my fault|is it me|am i the problem|did i)\b/i],
];

const BY_BUCKET: Partial<Record<BucketId, { rows: Row[]; sensitive: string }>> = {
  love_relationships: {
    sensitive: 'a relationship the family does not know of, or a breakup still raw',
    rows: [
      ['will_it_last', 'whether this will last', /\b(will (?:it|this|we) last|last long|stay together)\b/i],
      ['is_this_the_one', 'whether this is the right person', /\b(the one|right person|meant to be|soulmate)\b/i],
      ['why_distance', 'why there is distance between them', /\b(distance|drifting|ignor\w*|cold)\b/i],
    ],
  },
  marriage: {
    sensitive: 'separation, infertility, or family pressure',
    rows: [
      ['when', 'when marriage comes', /\bwhen\b/i],
      ['will_it_happen_at_all', 'whether it will happen at all', /\b(ever|at all|will i (?:ever )?(?:get )?marr\w*)\b/i],
      ['why_delayed', 'why it is delayed', /\b(delay\w*|so late|taking so long)\b/i],
      ['is_it_failing', 'whether the marriage is failing', /\b(divorce|separat\w*|failing|falling apart)\b/i],
    ],
  },
  career_job: {
    sensitive: 'being fired, or humiliation at work',
    rows: [
      ['should_i_move', 'whether to move on', /\b(should i (?:change|leave|quit|move)|switch jobs?|change (?:my )?job)\b/i],
      ['am_i_stuck', 'whether they are stuck', /\b(stuck|stagnant|going nowhere)\b/i],
      ['recognition_coming', 'whether recognition is coming, and when', /\b(promotion|promoted|recogni\w*|raise)\b/i],
      ['what_suits_me', 'what work suits them', /\b(suits? me|right career|what career|which field)\b/i],
    ],
  },
  money_wealth: {
    sensitive: 'debt shame, or a loss hidden from the family',
    rows: [
      ['will_it_ease', 'whether money pressure eases', /\b(debt|loan|tight|struggl\w*|ease)\b/i],
      ['where_is_the_leak', 'where the money is going', /\b(where (?:is|does) (?:my |the )?money|leak\w*|cannot save|can't save)\b/i],
      ['is_a_gain_coming', 'whether a gain is coming', /\b(gain|windfall|wealth|rich|income)\b/i],
    ],
  },
  business: {
    sensitive: 'partner betrayal, or money borrowed from family',
    rows: [
      ['will_it_work', 'whether the business will work', /\b(will (?:it|my business) (?:work|succeed)|success\w*)\b/i],
      ['partner_trust', 'whether the partner can be trusted', /\b(partner|trust)\b/i],
      ['why_stalled', 'why it has stalled', /\b(stall\w*|slow|no growth)\b/i],
    ],
  },
  family_children: {
    sensitive: 'a parent in decline, a rift, infertility, or an adult child in distress',
    rows: [
      ['why_the_distance', 'why there is distance', /\b(distance|fight\w*|not talking|rift)\b/i],
      ['their_wellbeing', 'how the person is doing', /\b(health|wellbeing|okay|ok|how is my)\b/i],
    ],
  },
  health_windows: {
    sensitive: 'the body, the mind, or the relationship with the doctor',
    rows: [['why_now', 'why this came now', /\bwhy\b/i]],
  },
  spirituality_direction: {
    sensitive: 'a fear of something spiritual being wrong, or a withdrawal from faith that frightens the family',
    rows: [
      ['what_am_i_for', 'what their life is for', /\b(purpose|meant to do|calling)\b/i],
      ['why_this_phase', 'why this phase has come', /\b(this phase|this time)\b/i],
    ],
  },
};

/** The clearest real want in the question's words, or null when no rule matches. */
export function inferRealWant(question: string, bucket: BucketId | undefined | null): RealWant | null {
  const b = bucket ? BY_BUCKET[bucket] : undefined;
  const hit = (b?.rows ?? []).find(([, , cue]) => cue.test(question)) ?? GENERAL.find(([, , cue]) => cue.test(question));
  return hit ? { id: hit[0], line: hit[1], sensitive: b?.sensitive ?? null } : null;
}
