/**
 * "How to ask so astrology can answer" (brief item 3). Per bucket: what the chart can answer, a good example, a weak
 * question with its rewrite, and what to include (person, period, decision). Shown:
 *   - in the clarify card when the question has no life area (bucket `unknown`) or is too vague;
 *   - as the `guidance` field of the SSE `intent` event;
 *   - through GraphQL `askingGuide(bucketId)` for the "ask better" helper and the subject chips under the input.
 * English only for now. Topics the app does not discuss (docs/reading-engine/18) are never coached towards.
 */
import { BUCKETS, CHIP_BUCKETS, type BucketId } from '../buckets/taxonomy.js';
import type { UnanswerableReason } from '../buckets/classifier.js';

export interface CoachCard {
  bucket: BucketId;
  title: string;
  canAnswer: string;
  goodExample: string;
  weakExample: string;
  rewrite: string;
  include: string[];
}

const C = (c: CoachCard): CoachCard => c;

export const COACH: Record<BucketId, CoachCard> = {
  career_job: C({ bucket: 'career_job', title: 'Career and job', canAnswer: 'When a change, promotion or new job is supported, and what kind of work suits you.', goodExample: 'Is the next 6 months a good time to change jobs?', weakExample: 'Will my career be good?', rewrite: 'When in the next 12 months is a promotion most likely?', include: ['which part: changing, promotion, finding work, trouble at work', 'the period you care about'] }),
  money_wealth: C({ bucket: 'money_wealth', title: 'Money and wealth', canAnswer: 'When income, savings or debt repayment are supported. Not amounts, and not which investment to pick.', goodExample: 'When will my income start growing in the next year?', weakExample: 'How much money will I make?', rewrite: 'Which months in the next year favour income growth?', include: ['income, savings or debt', 'the period you care about'] }),
  business: C({ bucket: 'business', title: 'Business', canAnswer: 'When starting or growing a business is supported, and how partnerships look.', goodExample: 'Is early next year a good time to launch my business?', weakExample: 'Will my business succeed?', rewrite: 'When in the next 12 months is growth for my business most supported?', include: ['starting, growing or a partner', 'the period you care about'] }),
  love_relationships: C({ bucket: 'love_relationships', title: 'Love and relationships', canAnswer: 'When a relationship is likely to begin or settle, and what helps or strains it.', goodExample: 'When in the next 12 months am I likely to meet someone serious?', weakExample: 'Will I find love?', rewrite: 'Which periods in the next year favour a new relationship?', include: ['meeting someone, or your current relationship', 'the period you care about'] }),
  marriage: C({ bucket: 'marriage', title: 'Marriage', canAnswer: 'When marriage is indicated and how a marriage is going.', goodExample: 'When in the next 2 years is marriage most likely for me?', weakExample: 'Will I get married?', rewrite: 'Which windows in the next 2 years favour marriage?', include: ['timing, or how your marriage is going', 'the period you care about'] }),
  property_vehicles: C({ bucket: 'property_vehicles', title: 'Property and vehicles', canAnswer: 'When buying a home, land or a vehicle is supported.', goodExample: 'Is the next 3 years a good time to buy a house?', weakExample: 'Will I own a house?', rewrite: 'Which windows in the next 3 years favour buying a house?', include: ['home, land or vehicle', 'the period you care about'] }),
  education: C({ bucket: 'education', title: 'Education', canAnswer: 'Exam and admission windows and which field suits you (for adults).', goodExample: 'Is next year good for starting a master’s degree?', weakExample: 'Will I study well?', rewrite: 'Which months next year favour my entrance exams?', include: ['exams, higher studies or field', 'the period you care about'] }),
  health_windows: C({ bucket: 'health_windows', title: 'Health windows (astrologer, researcher and admin roles only)', canAnswer: 'Periods that call for extra care and recovery windows. Never a diagnosis or treatment advice.', goodExample: 'Which periods in the next year call for extra care with health?', weakExample: 'Will I get sick?', rewrite: 'Which months in the next year are vigilance windows for health?', include: ['the period you care about'] }),
  family_children: C({ bucket: 'family_children', title: 'Family', canAnswer: 'Your relationships with parents and siblings, and timing for having a child. Questions about children under 18 are not answered.', goodExample: 'When in the next 3 years is having a child most supported for us?', weakExample: 'How is my family?', rewrite: 'How does my relationship with my father look over the next year?', include: ['whose relationship', 'the period you care about', 'for a child of yours: their age (18 or older only)'] }),
  foreign_legal: C({ bucket: 'foreign_legal', title: 'Foreign and legal', canAnswer: 'When travel, moving abroad or a legal matter is supported. Not legal advice.', goodExample: 'Is the next year a good time to move abroad for work?', weakExample: 'Will I go abroad?', rewrite: 'Which months in the next 2 years favour moving abroad?', include: ['abroad or a legal matter', 'the period you care about'] }),
  spirituality_direction: C({ bucket: 'spirituality_direction', title: 'Spirituality and life direction', canAnswer: 'Your nature, purpose and the themes of your life by stage.', goodExample: 'What do my nakshatras say about my nature?', weakExample: 'Tell me about me.', rewrite: 'What is my life purpose according to my chart?', include: ['purpose, a spiritual phase, or your nakshatras'] }),
  time_window_outlook: C({ bucket: 'time_window_outlook', title: 'Time-window outlook', canAnswer: 'What is active now, when it eases, and what the coming months look like.', goodExample: 'What does the next 3 months look like for me?', weakExample: 'Is my time good?', rewrite: 'When does my current difficult phase end?', include: ['the period you care about'] }),
  explain_term: C({ bucket: 'explain_term', title: 'Explain a term', canAnswer: 'What an astrology term means, with your chart as the example.', goodExample: 'What is Sade Sati and am I in it?', weakExample: 'Explain astrology.', rewrite: 'What does a Saturn mahadasha mean?', include: ['the term'] }),
  compatibility: C({ bucket: 'compatibility', title: 'Compatibility', canAnswer: 'How two charts fit and which periods both charts support. Needs the other person’s birth details.', goodExample: 'How compatible are my partner and I for marriage?', weakExample: 'Is he the one?', rewrite: 'How do my chart and my partner’s chart fit for marriage over the next 2 years?', include: ['who the other person is', 'their birth date, time and place'] }),
  unknown: C({ bucket: 'unknown', title: 'Ask about one area and one period', canAnswer: 'Astrology answers best about one area of life over a period: work, money, relationships, marriage, home, studies or the months ahead.', goodExample: 'When in the next 6 months is a job change supported?', weakExample: 'Will it happen?', rewrite: 'Pick an area below, then say the period you care about.', include: ['one area of life', 'the period (next 3 months, this year …)', 'what you are deciding, if anything'] }),
};

/** Guidance shown for a vague question (no area, or no subject). Never coaches towards a declined topic. */
export function guidanceFor(bucket: BucketId, unanswerable: UnanswerableReason | null): { text: string; card: CoachCard; chips: Array<{ label: string; value: string }> } | null {
  if (bucket !== 'unknown' && unanswerable !== 'no_subject') return null;
  const card = COACH.unknown;
  return {
    text: `${card.canAnswer} For example: "${card.goodExample}"`,
    card,
    chips: CHIP_BUCKETS.filter((b) => b !== 'health_windows').map((b) => ({ label: BUCKETS[b].displayName, value: b })),
  };
}

/** The asking guide: one bucket's card, or all chip buckets (health only for roles allowed to discuss it). */
export function askingGuide(bucket: BucketId | null, opts: { healthAllowed: boolean }): CoachCard[] {
  if (bucket) return bucket === 'health_windows' && !opts.healthAllowed ? [] : [COACH[bucket]];
  return CHIP_BUCKETS.filter((b) => b !== 'health_windows' || opts.healthAllowed).map((b) => COACH[b]);
}
