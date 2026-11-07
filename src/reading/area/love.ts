/**
 * The Love area (the Love board): house 7 with 5, 11, 2, 4, 8 and 12; Venus, Jupiter, the Moon, the 7th lord, DK and
 * UL; D1, D9, D7 (docs/reading-engine/45 §8.2, 46 §B.12 Love rows, 53 §4.5). Config only: the layers are
 * houseLayers.ts. The companion memory's `love.status` (src/profile/facts.ts) selects meet vs health vs reconcile, and
 * a sub-area that does not fit the person's situation is not shown (no "meeting someone" for someone married).
 */
import type { AreaConfig } from './houseLayers.js';

export const LOVE: AreaConfig = {
  area: 'love',
  houses: [7, 5, 11, 2, 4, 8, 12],
  primary: [7, 5, 8, 4, 2, 11],
  karakas: ['L7', 'Ve', 'Mo', 'DK'],
  protectPoints: ['UL'],
  vargaChecks: [{ varga: 'D9', house: 7 }],
  vargas: ['D1', 'D9', 'D7'],
  heavy: ['Sa', 'Ra', 'Ke', 'Ma'],
  yogaAfflictions: [/kalathra/i, /manglik|mangal|kuja/i],
  gandantaMoon: false,
  sadeSati: false,
  sahams: { support: ['vivaha', 'preethi', 'mitra'], test: ['santapa', 'paradara'] },
  // doc 46 §B.12 Love rows; separation is never a verdict (doc 45 §8.2) and shows only as strain with a date
  subareas: [
    { id: 'meet', title: 'Meeting someone', planets: ['L5', 'L7', 'Ve', 'DK', 'Ju'], houses: [7, 5, 11], sides: ['support'] },
    { id: 'romance', title: 'Romance', planets: ['L5', 'Ve', 'Ma', 'Mo', 'L7'], houses: [5, 7], sides: ['support'] },
    { id: 'commitment', title: 'Commitment', planets: ['L7', 'Ve', 'DK', 'L2', 'Ju'], houses: [7, 2, 8], sides: ['support'] },
    { id: 'delay', title: 'Why it is taking time', planets: ['Sa', 'L7', 'Ke'], houses: [7], sides: ['test'] },
    { id: 'health', title: 'How things are between you', planets: ['L7', 'Ve', 'Mo', 'L4', 'L2', 'Ju', 'L5', 'DK'], houses: [7, 4, 5, 2], sides: ['support', 'test'] },
    { id: 'strain', title: 'Distance or tension', planets: ['L6', 'L2', 'L12', 'Ma', 'Sa', 'Ra', 'Ke'], houses: [7, 8, 12], sides: ['test'] },
    { id: 'reconcile', title: 'Getting back together', planets: ['L7', 'Ve', 'Ju', 'L11'], houses: [7, 11], sides: ['support'] },
    { id: 'family_accept', title: 'Family and in-laws', planets: ['L2', 'L4', 'L8', 'Ju', 'Mo'], houses: [2, 4, 8], sides: ['support', 'test'] },
    { id: 'friends', title: 'Friendships', planets: ['L11', 'L4', 'Me', 'Ve'], houses: [11], sides: ['support', 'test'] },
  ],
  words: {
    themes: {
      h7: 'your partnerships',
      h5: 'romance',
      h11: 'friendships',
      h2: 'family life',
      h4: 'peace at home',
      h8: 'closeness and trust',
      h12: 'intimacy and rest',
      Ve: 'affection',
      Mo: 'your feelings',
      L7: 'your close bonds',
      DK: 'the partner you draw',
      UL: 'a lasting bond',
    },
    back: { test: 'a strained stretch in love began', support: 'a warm stretch in love began' },
    year: {
      support: "This year's chart is warm for love: say yes to what feels right.",
      test: "This year's chart asks for patience in love: go slowly with big decisions.",
      mixed: "This year's chart is mixed for love: small steps work best.",
    },
    turn: { support: 'A new chapter for love opens', test: 'A new chapter that asks more of your bonds' },
    ahead: {
      support: { strong: 'A warm opening', moderate: 'A good stretch', weak: 'A small opening' },
      test: { strong: 'A strained stretch: say what you need', moderate: 'A tense stretch: go gently', weak: 'A little distance' },
    },
  },
};

export const LOVE_STATUS = ['single', 'dating', 'committed', 'married', 'separated', 'complicated'] as const;
export type LoveStatus = (typeof LOVE_STATUS)[number];

/** Which sub-areas suit the person's situation (doc 45 §3.5, doc 48 §4.3). Unknown or declined: friendships only. */
export const LOVE_FIT: Record<LoveStatus | 'unknown', string[]> = {
  single: ['meet', 'romance', 'delay', 'friends'],
  dating: ['health', 'romance', 'commitment', 'strain', 'family_accept', 'friends'],
  committed: ['health', 'romance', 'commitment', 'strain', 'family_accept', 'friends'],
  married: ['health', 'romance', 'commitment', 'strain', 'family_accept', 'friends'],
  separated: ['reconcile', 'strain', 'meet', 'friends'],
  complicated: ['reconcile', 'health', 'strain', 'friends'],
  unknown: ['friends'],
};

/** doc 53 §4.5: love.status selects love.meet vs love.health vs love.reconcile. */
export const LOVE_LEAD: Record<LoveStatus, string> = {
  single: 'meet',
  dating: 'health',
  committed: 'health',
  married: 'health',
  separated: 'reconcile',
  complicated: 'reconcile',
};

export function asLoveStatus(v: string | null): LoveStatus | null {
  return v && (LOVE_STATUS as readonly string[]).includes(v) ? (v as LoveStatus) : null;
}

export function loveFits(subarea: string, status: LoveStatus | null): boolean {
  return LOVE_FIT[status ?? 'unknown'].includes(subarea);
}

export function loveLead(status: LoveStatus | null): string | null {
  return status ? LOVE_LEAD[status] : null;
}
