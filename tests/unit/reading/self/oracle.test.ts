/** The You reading's model layer stays off without SELF_READING_MODEL=1, builds its brief from usable claims only, and the validator drops uncited keys (docs/reading-engine/58 §4.1). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSelfOracle, selfBrief, validateSelfText } from '../../../../src/reading/self/oracle.js';
import type { SelfReading } from '../../../../src/reading/self/types.js';

vi.mock('../../../../src/reading/llm/gemini.js', () => ({ callGemini: vi.fn(async () => ({ text: 'never' })) }));

const reading: SelfReading = {
  asOf: '2026-11-07',
  digestVersion: 'd',
  clock: { system: 'dwisatpathi', label: 'Dwisaptati Sama', reason: 'preferred', confirming: [{ system: 'vimsottari', label: 'Vimshottari' }], choices: [] },
  panels: [
    { id: 'lagna', technique: 'self.reading.lagna', title: 'Who you are', lead: '', status: 'ok', cached: false, ms: 1, claims: [
      { id: 'lagna.lord_house', text: 'kept', detail: 'd', certainty: 'fact', evidence: ['planet:D1.Ju'] },
      { id: 'lagna.seen', text: 'gone', detail: 'd', certainty: 'fact', evidence: ['point:D1.AL'], withheld: 'You told us this did not fit.' },
    ] },
  ],
  question: null,
  gaps: [],
};

afterEach(() => { delete process.env.SELF_READING_MODEL; });

describe('self oracle', () => {
  it('is off without the flag and calls nothing', async () => {
    const { callGemini } = await import('../../../../src/reading/llm/gemini.js');
    expect(await runSelfOracle(reading, {})).toEqual({ status: 'off' });
    expect(callGemini).not.toHaveBeenCalled();
  });
  it('briefs only usable claims, with the clock and the answers', () => {
    const b = selfBrief(reading, { 'chapters.sub': 'yes' });
    expect(b.text).toContain('READING CLOCK: Dwisaptati Sama');
    expect(b.text).toContain('[lagna.lord_house] (fact) kept');
    expect(b.text).not.toContain('gone');
    expect(b.text).toContain('chapters.sub: yes');
    expect([...b.keys]).toEqual(['planet:D1.Ju']);
  });
  it('drops a paragraph citing a key not in the brief and strips the citations', () => {
    const v = validateSelfText('Good {planet:D1.Ju}\n\nInvented {planet:D1.Ve}\n\nNo cite', new Set(['planet:D1.Ju']));
    expect(v).toEqual({ text: 'Good\n\nNo cite', dropped: 1 });
  });
});
