/**
 * The Self area (the You board): houses 1, 4, 5, 9 and 12 with the Moon, the lagna lord, the Sun and the Atmakaraka;
 * D1, D9, D20, D24, D12 (docs/reading-engine/45 §8.3, 46 §B.12 Self rows, 53 §4.5). Config only: the layers are
 * houseLayers.ts. The companion memory's `self.focus` (src/profile/facts.ts) picks which sub-area leads.
 */
import type { AreaConfig } from './houseLayers.js';

export const SELF: AreaConfig = {
  area: 'self',
  houses: [1, 4, 5, 9, 12],
  primary: [1, 4, 5, 9, 12],
  karakas: ['L1', 'Mo', 'Su', 'AK'],
  protectPoints: [],
  vargaChecks: [{ varga: 'D9', house: 1 }],
  vargas: ['D1', 'D9', 'D20', 'D24', 'D12'],
  heavy: ['Sa', 'Ra', 'Ke'],
  yogaAfflictions: [/kemadruma/i],
  gandantaMoon: true,
  sadeSati: true,
  sahams: { support: ['punya', 'samartha', 'yasas', 'gaurava', 'asha', 'mahatmaya', 'jeeva'], test: [] },
  // doc 46 §B.12 Self rows; energy and rest are facts only (doc 18) and are not shown as windows
  subareas: [
    { id: 'identity', title: 'Direction', planets: ['L1', 'Su', 'AK'], houses: [1, 9], sides: ['support', 'test'] },
    { id: 'confidence', title: 'Confidence', planets: ['Su', 'Ma', 'L3'], houses: [1], sides: ['support', 'test'] },
    { id: 'mind', title: 'Peace of mind', planets: ['Mo', 'L4', 'Me'], houses: [4], sides: ['support', 'test'] },
    { id: 'growth', title: 'Learning and growth', planets: ['L5', 'Me', 'Ju', 'L3'], houses: [5], sides: ['support'] },
    { id: 'purpose', title: 'Purpose and belief', planets: ['L9', 'L12', 'Ju', 'Ke'], houses: [9, 12], sides: ['support', 'test'] },
    { id: 'empowerment', title: 'Taking charge', planets: ['Ma', 'Su', 'L3', 'L10'], houses: [], sides: ['support'] },
    { id: 'reputation', title: 'How you are seen', planets: ['L10', 'Su'], houses: [], sides: ['support', 'test'] },
    // a change of the main clock's chapter inside 30 years, whoever runs it
    { id: 'turning_point', title: 'A new chapter', planets: ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'], houses: [], sides: ['support', 'test'], level1Only: true },
  ],
  words: {
    themes: {
      h1: 'your sense of self',
      h4: 'your peace of mind',
      h5: 'your ideas and learning',
      h9: 'your sense of purpose',
      h12: 'rest and letting go',
      Mo: 'your feelings',
      Su: 'your confidence',
      L1: 'your own drive',
      AK: 'what you most want from life',
    },
    kinds: { deep_bond: () => 'Your inner nature is steady.' },
    back: { test: 'a heavier stretch for you began', support: 'a lighter, stronger stretch for you began' },
    year: {
      support: "This year's chart backs you: a good year to begin something of your own.",
      test: "This year's chart asks for patience with yourself: build slowly.",
      mixed: "This year's chart is mixed: steady habits carry you.",
    },
    turn: { support: 'A new chapter opens', test: 'A new chapter that asks more of you' },
    ahead: {
      support: { strong: 'A clear stretch for a fresh start', moderate: 'A good stretch to build', weak: 'A small lift' },
      test: { strong: 'A heavy stretch: go gently', moderate: 'A slower stretch: give it room', weak: 'A little more effort than usual' },
    },
  },
};

/** `self.focus` values (src/profile/facts.ts FOCUS) → the sub-area that leads the You board. */
export const SELF_FOCUS_LEAD: Record<string, string> = {
  career: 'empowerment',
  money: 'empowerment',
  love: 'mind',
  family: 'mind',
  home: 'mind',
  health: 'mind',
  learning: 'growth',
  creativity: 'growth',
  travel: 'purpose',
  spirituality: 'purpose',
};

/** The lead sub-area for a stored `self.focus` (comma list, first wins); null when unset or declined. */
export function selfLead(focus: string | null): string | null {
  if (!focus) return null;
  for (const f of focus.split(',').map((s) => s.trim())) if (SELF_FOCUS_LEAD[f]) return SELF_FOCUS_LEAD[f]!;
  return null;
}

/** Every Self sub-area fits everyone; the focus only changes the order (doc 48 §4.3). */
export function selfFits(_subarea: string): boolean {
  return true;
}
