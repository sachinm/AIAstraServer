/**
 * The 12 golden questions (docs/reading-engine/07-evaluation.md §2) with machine-checkable expectations.
 * `packMustHave`: evidence-id prefixes that must resolve in the pack built for the question (method coverage by construction).
 * `proseMustMention`: what the answer text must visibly use (the varga, the named karaka...). `forbid`: patterns that fail it.
 */
import type { FormatId, SubjectId } from '../src/reading/packs/frames.js';

export interface GoldenQuestion {
  id: string;
  question: string;
  subjects: SubjectId[];
  horizon: string;
  format: FormatId;
  packMustHave: string[];
  proseMustMention: Array<{ label: string; re: RegExp }>;
  forbid?: Array<{ label: string; re: RegExp }>;
  requireCaveat?: { label: string; re: RegExp };
  note?: string;
}

export const REMEDY_RE = /\b(mantras?|gemstones?|ruby|yellow sapphire|blue sapphire|emerald|puja|homa|havan|remed(?:y|ies)|chant\w*|donat\w+|fast on|wear a)\b/i;
export const AMOUNT_RE = /\$\s?\d|\b\d[\d,.]*\s*(?:usd|dollars|rupees|inr|lakhs?|crores?)\b|\b\d+\s*million\b/i;

export const GOLDEN: GoldenQuestion[] = [
  {
    id: 'Q1',
    question: 'I am having a lot of problems with my work and with money. I am not happy. When does this improve?',
    subjects: ['career_work', 'income_wealth'],
    horizon: '1y',
    format: 'timeline',
    packMustHave: ['detail.career_work.houses.10', 'detail.income_wealth.houses.2', 'varga.career_work.D10', 'varga.income_wealth.D2', 'dasha.career_work.current', 'transits.career_work.double_transit'],
    proseMustMention: [
      { label: 'D-10', re: /D-?10|dasamsa|dashamsa/i },
      { label: 'D-2 or hora', re: /D-?2\b|hora/i },
      { label: 'Saturn or Jupiter transit', re: /(saturn|jupiter)[^.\n]{0,60}transit|transit[^.\n]{0,60}(saturn|jupiter)/i },
    ],
  },
  {
    id: 'Q2',
    question: 'When am I going to buy a house?',
    subjects: ['property_home'],
    horizon: '3y',
    format: 'timeline',
    packMustHave: ['detail.houses.4', 'varga.D4.d1_lords.4', 'arudha.A4', 'dasha.periods', 'transits.rows'],
    proseMustMention: [
      { label: 'D-4 varga cited', re: /D-?4\b|chaturthamsa/i },
      { label: 'Mars', re: /\bmars\b/i },
      { label: '4th house/lord', re: /\b4th\b|fourth/i },
    ],
  },
  {
    id: 'Q3',
    question: 'When am I going to win the lottery?',
    subjects: ['speculation_lottery'],
    horizon: '1y',
    format: 'direct',
    packMustHave: ['detail.houses.5', 'detail.houses.11', 'varga.D2', 'frame.caveat'],
    proseMustMention: [{ label: '5th/11th/2nd houses', re: /\b(5th|11th|2nd)\b/i }],
    forbid: [{ label: 'predicting a win', re: /\byou will win\b|\bguaranteed\b|\bwill hit the jackpot\b/i }],
    requireCaveat: { label: 'no-win caveat', re: /(no|not)[^.\n]{0,40}(promis|guarantee|predict)|cannot predict|can't predict|no outcome|windows? (of|for) gains?/i },
  },
  {
    id: 'Q4',
    question: 'When will I make a million dollars? In the next 3 or 6 months is a big jump coming?',
    subjects: ['income_wealth'],
    horizon: '6m',
    format: 'timeline',
    packMustHave: ['detail.houses.2', 'detail.houses.11', 'varga.D2', 'dasha.periods', 'transits.rows'],
    proseMustMention: [{ label: '2nd/11th/9th houses', re: /\b(2nd|11th|9th)\b/i }],
    forbid: [{ label: 'states an amount', re: AMOUNT_RE }],
  },
  {
    id: 'Q5',
    question: 'Ketu is transiting over my Jupiter. What does that even mean for me?',
    subjects: ['general_life_direction'],
    horizon: '6m',
    format: 'narrative',
    packMustHave: ['transits.focus_hits', 'transits.rows', 'base.bodies.Ju'],
    proseMustMention: [
      { label: 'Ketu', re: /\bketu\b/i },
      { label: 'Jupiter', re: /\bjupiter\b/i },
      { label: 'June 2028 / 2028 date from the transit table', re: /2028|jun(?:e)? 24/i },
    ],
    note: 'In G1, Ketu is in Leo until Dec 2026 and reaches natal Jupiter (Gemini) only on 2028-06-24: the honest answer is "not yet".',
  },
  {
    id: 'Q6',
    question: 'Tell me about my nakshatras — look at it from all the different ways.',
    subjects: ['general_life_direction'],
    horizon: 'life',
    format: 'narrative',
    packMustHave: ['base.nakshatra.janma', 'base.nakshatra.lagna', 'base.nakshatra.taras_from_janma', 'base.bodies.Mo'],
    proseMustMention: [
      { label: 'Swati', re: /swati/i },
      { label: 'Hasta', re: /hasta/i },
      { label: 'tara', re: /\btara\b/i },
      { label: 'star lord', re: /star[- ]lord|nakshatra lord/i },
    ],
  },
  {
    id: 'Q7',
    question: 'Should I change jobs this year?',
    subjects: ['career_work'],
    horizon: 'to Dec 31',
    format: 'factor_table',
    packMustHave: ['detail.houses.10', 'detail.houses.6', 'varga.D10', 'transits.double_transit'],
    proseMustMention: [
      { label: 'D-10', re: /D-?10|dasamsa|dashamsa/i },
      { label: 'dasha', re: /dasha|saturn[- ]ketu/i },
    ],
  },
  {
    id: 'Q8',
    question: 'What does my D-10 say about the kind of work I am suited for?',
    subjects: ['career_work'],
    horizon: 'life',
    format: 'factor_table',
    packMustHave: ['varga.D10.lagna', 'varga.D10.d1_lords.10', 'varga.D10.planets', 'varga.D10.kendra_occ'],
    proseMustMention: [
      { label: 'D-10 cited', re: /D-?10|dasamsa|dashamsa/i },
      { label: 'D-10 lagna sign', re: /scorpio/i },
      { label: 'Mercury', re: /\bmercury\b/i },
    ],
    note: 'G1 D-10 lagna is Scorpio.',
  },
  {
    id: 'Q9',
    question: 'When will I get married?',
    subjects: ['marriage_relationship'],
    horizon: '3y',
    format: 'timeline',
    packMustHave: ['detail.houses.7', 'varga.D9.d1_lords.7', 'arudha.UL', 'dasha.periods', 'transits.double_transit'],
    proseMustMention: [
      { label: 'D-9 / navamsa cited', re: /D-?9\b|navamsa/i },
      { label: 'Venus', re: /\bvenus\b/i },
      { label: '7th', re: /\b7th\b|seventh/i },
    ],
  },
  {
    id: 'Q10',
    question: 'Is this month a good time to sign a property deal?',
    subjects: ['property_home'],
    horizon: 'now',
    format: 'watchlist',
    packMustHave: ['detail.houses.4', 'dasha.current', 'transits.now'],
    proseMustMention: [{ label: '4th', re: /\b4th\b|fourth/i }],
  },
  {
    id: 'Q11',
    question: 'What is Sade Sati and am I in it?',
    subjects: ['explain_term'],
    horizon: 'now',
    format: 'direct',
    packMustHave: ['transits.sade_sati', 'base.moon'],
    proseMustMention: [
      { label: 'Sade Sati defined (7.5 years / Saturn over Moon)', re: /7\.5|seven and a half|12th|moon/i },
      { label: 'honest no (not in it)', re: /\b(not|aren't|are not|no)\b[^.\n]{0,40}(sade ?sati)|sade ?sati[^.\n]{0,40}\b(not|isn't|is not|no)\b/i },
    ],
    note: 'G1 Moon is in Libra; Saturn is in Pisces (6th from Moon): not in Sade Sati for the next two years.',
  },
  {
    id: 'Q12',
    question: 'My work, my money, my marriage — what is coming in the next year?',
    subjects: ['career_work', 'income_wealth', 'marriage_relationship'],
    horizon: '1y',
    format: 'timeline',
    packMustHave: ['detail.career_work.houses.10', 'detail.income_wealth.houses.2', 'detail.marriage_relationship.houses.7', 'varga.career_work.D10', 'varga.marriage_relationship.D9', 'transits.marriage_relationship.double_transit'],
    proseMustMention: [
      { label: 'work', re: /\b(work|career|job)\b/i },
      { label: 'money', re: /\b(money|income|wealth)\b/i },
      { label: 'marriage', re: /\b(marriage|relationship|spouse)\b/i },
    ],
  },
];
