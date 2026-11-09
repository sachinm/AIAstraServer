/** Shared fixtures for the Self v2 API tests (synthetic: no real chart). */
import type { SystemPresence } from '../../../../../src/reading/self/clock.js';
import type { PersonalCard } from '../../../../../src/reading/self/v2types.js';
import type { SelfV2Latest } from '../../../../../src/reading/self/v2api/storeContract.js';

export const PRESENT: SystemPresence[] = [
  { system: 'vimsottari', family: 'vimshottari' },
  { system: 'yogini', family: 'yogini' },
  { system: 'narayana', family: 'rasi' },
  { system: 'chara', family: 'rasi' },
  { system: 'kalachakra', family: 'rasi' },
  { system: 'karaka', family: 'karaka' },
  { system: 'tithi_ashtottari', family: 'tithi_ashtottari' },
  { system: 'chathuraaseethi_sama', family: 'conditional' },
  { system: 'ashtottari', family: 'other' },
  { system: 'dwisatpathi', family: 'other' },
  { system: 'shattrimsa_sama', family: 'other' },
];

export const APPLICABLE_RAW = [
  { type: 'dasha.ashtottari', rule: 'r', applies: false, checked: true },
  { type: 'dasha.chathuraaseethi_sama', rule: 'r', applies: true, checked: true },
  { type: 'dasha.dwisatpathi', rule: 'r', applies: false, checked: true },
  { type: 'dasha.panchottari', rule: 'r', applies: false, checked: true },
  { type: 'dasha.shattrimsa_sama', rule: 'engine', applies: null, checked: false },
];

export const card = (areaId: PersonalCard['areaId'], headline: string): PersonalCard => ({
  areaId, headline, body: ['Body line.'], patterns: [], ladder: null, dates: [], certainty: 'likely', sources: ['x.p1'],
});

export function latestFixture(): SelfV2Latest {
  return {
    status: 'ok',
    builtAt: '2026-11-09T10:00:00.000Z',
    briefs: null,
    cards: {
      hero: { tone: 'heavy', sentence: 'Work asks a lot of you until 16 Feb 2028.', sub: 's', strip: [], easesAt: '2028-02-16', nextCheck: '2026-12-01', question: null, withheld: false },
      cards: { now: card('now', 'Work is heavy now'), lagna: card('lagna', 'You steady others, says Radha'), mind: card('mind', 'You think in pictures') },
    },
    oracle: {
      patterns: [],
      doc: {
        validUntil: 'always',
        areas: {
          struggle: { id: 'struggle', headline: 'Saturn in the 10th per pyjhora', paragraphs: ['The AIAstra_Radha engine shows Saturn.'], dates: [], actions: [], certainty: 'likely', evidence: ['planet:D1.Sa'], validUntil: 'always' },
          lagna: { id: 'lagna', headline: 'Lagna in Sagittarius', paragraphs: ['Jupiter rules it.'], dates: [], actions: [], certainty: 'likely', evidence: ['house:D1.1'], validUntil: 'always' },
        },
      },
    },
  };
}

