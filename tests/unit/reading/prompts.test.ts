import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { PROMPTS, PROMPT_VERSION } from '../../../src/reading/prompts/generated.js';

describe('embedded prompts', () => {
  it('generated.ts is in sync with the markdown sources (run: npm run prompts:embed)', () => {
    expect(() => execFileSync(process.execPath, ['scripts/embed-prompts.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('contains every prompt the engine loads', () => {
    for (const k of ['persona', 'method', 'intake', 'promise', 'dasha', 'transit', 'nakshatra', 'synth', 'formats/direct', 'formats/timeline', 'formats/factor_table', 'formats/narrative', 'formats/watchlist']) {
      expect(PROMPTS[k], k).toBeTruthy();
    }
    expect(PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('the shared system prompt is free of dates and of anything user-specific (cacheable across users)', () => {
    const system = `${PROMPTS['persona']}\n\n${PROMPTS['method']}`;
    expect(system).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
    expect(system).not.toMatch(/\b(Sachin|2002|South Grafton)\b/);
  });

  it('forbids remedies and requires the varga to refine, not replace, D-1', () => {
    expect(PROMPTS['method']).toMatch(/No remedies/i);
    expect(PROMPTS['method']).toMatch(/refines D-1, it never replaces it/i);
  });

  it('each format prompt names its required table header', () => {
    expect(PROMPTS['formats/timeline']).toMatch(/\| Window \|/);
    expect(PROMPTS['formats/factor_table']).toMatch(/\| Factor \|/);
  });
});
