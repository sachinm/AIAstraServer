/** The You reading's model layer stays off without SELF_READING_MODEL=1, builds its brief from usable claims only, and the validator drops uncited keys (docs/reading-engine/58 §4.1). */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import { resolveClock } from '../../../../src/reading/self/clock.js';
import {
  buildSelfFamilyPacks,
  parseLinemanClaims,
  parseOracleStructuredBlocks,
  runSelfOracle,
  selfBrief,
  validateSelfText,
} from '../../../../src/reading/self/oracle.js';
import type { SelfReading } from '../../../../src/reading/self/types.js';

vi.mock('../../../../src/reading/llm/gemini.js', () => ({
  callGemini: vi.fn(async () => ({
    text: '- Confirmed Jupiter in 7th {planet:D1.Ju}\n\nPANEL_SYNTHESIS:\n- [lagna] (always) Your identity steers through partnership and agreements. {planet:D1.Ju}\n\nVALID_UNTIL:\noverall: 2027-01-01\nlagna: always',
    usage: { node: 'test', model: 'gemini-3.1-flash-lite', promptTokens: 500, cachedTokens: 400, outputTokens: 120, thoughtTokens: 50, ms: 15 },
  })),
}));

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};

const reading: SelfReading = {
  asOf: '2026-11-07',
  digestVersion: 'd',
  clock: { system: 'dwisatpathi', label: 'Dwisaptati Sama', reason: 'preferred', confirming: [{ system: 'vimsottari', label: 'Vimshottari' }], choices: [] },
  panels: [
    { id: 'lagna', technique: 'self.reading.lagna', title: 'Who you are', lead: '', status: 'ok', cached: false, ms: 1, headerRange: 'always', lines: [], claims: [
      { id: 'lagna.lord_house', text: 'kept', detail: 'd', certainty: 'fact', evidence: ['planet:D1.Ju'] },
      { id: 'lagna.seen', text: 'gone', detail: 'd', certainty: 'fact', evidence: ['point:D1.AL'], withheld: 'You told us this did not fit.' },
    ] },
  ],
  question: null,
  gaps: [],
  purview: [],
  audit: { verdict: 'pass', checked: 0, failures: [] },
  dossierId: null,
  builtLine: '',
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
  it('builds all 5 family packs with all stored dasha systems, parses structured blocks, and runs scoped sub-agents + lineman + oracle', async () => {
    process.env.SELF_READING_MODEL = '1';
    const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
    const clock = resolveClock('dwisatpathi', FIX.systems);
    const packs = buildSelfFamilyPacks(view, FIX.activation, clock, '2026-11-07', null);
    expect(Object.keys(packs)).toEqual(['family.rasi', 'family.varga', 'family.dasha', 'family.year', 'family.sky']);
    expect(packs['family.dasha'].prefix).toContain('vimsottari');
    expect(packs['family.dasha'].prefix).toContain('narayana');
    expect(packs['family.dasha'].expiresAt?.toISOString().slice(0, 10)).toBe('2027-01-01');

    const parsedClaims = parseLinemanClaims('- Confirmed placement {planet:D1.Ju}\n- Invented {planet:D1.Xx}', new Set(['planet:D1.Ju']));
    expect(parsedClaims.claims).toHaveLength(1);
    expect(parsedClaims.dropped).toHaveLength(1);

    const parsedStruct = parseOracleStructuredBlocks(
      'PANEL_SYNTHESIS:\n- [lagna] (always) Rich identity synthesis {planet:D1.Ju}\nVALID_UNTIL:\noverall: 2027-01-01\nlagna: always',
      new Set(['planet:D1.Ju']),
    );
    expect(parsedStruct.validUntil).toEqual({ overall: '2027-01-01', lagna: 'always' });
    expect(parsedStruct.panelLines.lagna?.[0]?.text).toBe('Rich identity synthesis');

    const res = await runSelfOracle(reading, {}, {
      prisma: {
        techniqueOutput: { findUnique: async () => null, upsert: async ({ create }: { create: unknown }) => create, updateMany: async () => ({ count: 0 }) },
        readingFindingsCache: { findUnique: async () => null, upsert: async ({ create }: { create: unknown }) => create, updateMany: async () => ({ count: 0 }) },
        agentRegistry: { upsert: async () => ({}) },
        agentRun: { create: async () => ({}) },
      } as never,
      userId: 'u1',
      kundliId: 'k1',
      view,
      activation: FIX.activation,
      only: 'lagna',
      force: true,
    });
    expect(res.status).toBe('ok');
    expect(res.linemen?.map((l) => l.agent)).toEqual(['family.rasi', 'family.varga', 'lineman.self']);
    expect(res.validUntil).toMatchObject({ overall: '2027-01-01', lagna: 'always' });
    expect(res.panelLines?.lagna?.length).toBeGreaterThan(0);
  });
});

describe('self oracle, cached_only mode (docs/reading-engine/64 §4)', () => {
  it('answers pending without a model call when nothing is stored, and stores nothing', async () => {
    process.env.SELF_READING_MODEL = '1';
    const { callGemini } = await import('../../../../src/reading/llm/gemini.js');
    (callGemini as unknown as { mockClear: () => void }).mockClear();
    const stored: unknown[] = [];
    const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
    const res = await runSelfOracle(reading, {}, {
      prisma: {
        techniqueOutput: { findUnique: async () => null, upsert: async ({ create }: { create: unknown }) => { stored.push(create); return create; }, updateMany: async () => ({ count: 0 }) },
        readingFindingsCache: { findUnique: async () => null, upsert: async ({ create }: { create: unknown }) => create, updateMany: async () => ({ count: 0 }) },
        agentRegistry: { upsert: async () => ({}) },
        agentRun: { create: async () => ({}) },
      } as never,
      userId: 'u1',
      kundliId: 'k1',
      view,
      activation: FIX.activation,
      mode: 'cached_only',
    });
    expect(res.status).toBe('pending');
    expect(callGemini).not.toHaveBeenCalled();
    expect(stored).toHaveLength(0);
  });
});

describe('tidyOracleParagraph', () => {
  it('removes citations with the backticks the model wraps them in, stray spaces before punctuation, and rules', async () => {
    const { tidyOracleParagraph, validateSelfText } = await import('../../../../src/reading/self/oracle.js');
    expect(tidyOracleParagraph('Jupiter sits in the 7th `{planet:D1.Ju}`. Then more `` .')).toBe('Jupiter sits in the 7th. Then more.');
    expect(tidyOracleParagraph('---')).toBe('');
    const v = validateSelfText('A line `{planet:D1.Ju}`\n\n---\n\nB line {planet:D1.Ju} .', new Set(['planet:D1.Ju']));
    expect(v.text).toBe('A line\n\n\n\nB line.');
  });
});

describe('splitOracleSections', () => {
  it('gives each panel the section whose heading names it; a joint heading feeds both panels; text before any heading is In short', async () => {
    const { splitOracleSections } = await import('../../../../src/reading/self/oracle.js');
    const titles = { diagnosis: 'In short', chapters: 'Your chapters', lagna: 'Who you are', atma: "Your soul's aim", mind: 'Your mind', body: 'Your body', yogas: 'Gifts and knots', struggle: 'What you struggle with', year: 'This year' };
    const text = [
      'Opening words.',
      'In short (Diagnosis & Core Architecture)',
      'Your life is steered ``. Second sentence.',
      '---',
      "Who you are & Your soul's aim",
      'Identity paragraph.',
      'Your mind & Brain',
      'Mind paragraph.',
      '### Gifts and knots & What you struggle with',
      '- **Dhana Yoga**: a gift.',
      'This year',
      'Year paragraph.',
    ].join('\n\n');
    const s = splitOracleSections(text, titles, ['diagnosis', 'chapters', 'lagna', 'mind', 'body', 'atma', 'yogas', 'struggle', 'year']);
    expect(s.diagnosis).toBe('Opening words.\n\nYour life is steered. Second sentence.');
    expect(s.lagna).toBe('Identity paragraph.');
    expect(s.atma).toBe('Identity paragraph.');
    expect(s.mind).toBe('Mind paragraph.');
    expect(s.yogas).toBe('- **Dhana Yoga**: a gift.');
    expect(s.struggle).toBe('- **Dhana Yoga**: a gift.');
    expect(s.year).toBe('Year paragraph.');
    expect(s.chapters).toBeUndefined();
    expect(s.body).toBeUndefined();
  });
});
