/**
 * Plan B routes (docs/reading-engine/33 §6.2, 32): cues on the question choose a set of readers. The declined-topics gate has
 * already run by the time this is asked. Doc 32 specifies these modules as scores computed in Node; the repo rule is that Node
 * computes nothing astrological, so here the readers judge from the fields and no score, weight or probability is coded.
 * A prediction gives strength words only until calibration exists (doc 32 risk 3).
 */
import type { ReaderId, Tier } from './readers.js';

export type PlanBRouteId = 'pressure' | 'mood' | 'luck' | 'will_it_happen';

export interface PlanBRoute {
  route: PlanBRouteId;
  tier: Tier;
  readers: ReaderId[];
  /** one line for the Oracle: how to shape this kind of answer */
  note: string;
}

const CUES: Array<{ re: RegExp; route: PlanBRoute }> = [
  {
    re: /\b(troubl\w*|weigh\w*|stress\w*|anxious|anxiety|overwhelm\w*|depress\w*|unsettled|restless|why do i feel|what is wrong with me)\b/i,
    route: { route: 'pressure', tier: 2, readers: ['R01', 'P1', 'R08', 'R10'], note: 'Name what is pressing, through which house and planet, and the first date it eases.' },
  },
  {
    re: /\b(mood|how (?:is|will) (?:my |)(?:day|today)|today feel|my day today)\b/i,
    route: { route: 'mood', tier: 5, readers: ['P2', 'R08', 'R10'], note: 'Give the tone of the day in three lines, as a tone and not a verdict. Say once that daily data is limited.' },
  },
  {
    re: /\b(lucky|luck|fortune now|good time to|auspicious|right moment)\b/i,
    route: { route: 'luck', tier: 5, readers: ['P3', 'R01', 'R08', 'R10'], note: 'Say whether the moment supports the person, in strength words only. Promise no result.' },
  },
];

const WILL_IT_HAPPEN = /\b(will|is it going to|am i going to)\b.*\b(by|before|within|until|next (?:week|month|year)|this (?:week|month|year))\b/i;

/** The Plan B route of a question, or null for an ordinary Plan A question. */
export function planBRoute(question: string): PlanBRoute | null {
  const hit = CUES.find((c) => c.re.test(question));
  if (hit) return hit.route;
  if (WILL_IT_HAPPEN.test(question)) {
    return { route: 'will_it_happen', tier: 4, readers: ['R02', 'R08', 'R10'], note: 'Answer in strength words only: strong, moderate, weak or not indicated. Never give a percentage or a probability.' };
  }
  return null;
}
