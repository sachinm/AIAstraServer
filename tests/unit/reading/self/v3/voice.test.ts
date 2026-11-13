/**
 * The Self v3 Personalizer's voice by stated gender (prompts/personalizer/voice.md): which block is picked, that it sits
 * in the stable prefix, that the cache key carries it, and that the stereotype phrase list drops a sentence like a chart term.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PROMPTS } from '../../../../../src/reading/prompts/generated.js';
import {
  CHART_TERMS,
  ENGINE_NAMES,
  redactChartTerms,
  STEREOTYPE_PHRASES,
  textProblem,
} from '../../../../../src/reading/self/v2/personalizerValidate.js';
import type { PersonalizerInput, SelfBuildContext } from '../../../../../src/reading/self/v2types.js';
import {
  parseVoiceBlocks,
  personalizerV3Call,
  personalizerVoiceBlock,
  personalizerVoiceOf,
  personalizerVoicePrefix,
  personalizerVoiceToken,
  PERSONALIZER_VOICE_PROMPT,
  v3DateFrame,
} from '../../../../../src/reading/self/v3/personalizer.js';
import type { OracleCardV3 } from '../../../../../src/reading/self/v3/types.js';
import { PERSONALIZER_VOICE_VERSION } from '../../../../../src/config/env.js';

const ENV_KEYS = ['PERSONALIZER_VOICE_BY_GENDER', 'PERSONALIZER_VOICE_VERSION', 'PERSONALIZER_STEREOTYPE_PHRASES'] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) saved[k] = process.env[k];
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const ctx = { userId: 'u1', kundliId: 'k1', asOf: '2026-11-12' } as unknown as SelfBuildContext;

const card = (span: string): OracleCardV3 => ({
  card: 'body',
  headline: 'Rest is thin.',
  spans: [{ span, tone: 'heavy', mode: 'get_through', asks: 'hold the evenings', obstacle: 'late work', evidence: [], agreement: 'all agree' }],
  confirm: null,
  gift: 'stamina',
  knot: 'overwork',
  pattern: null,
  certainty: 'likely',
  evidence: [],
});

const profile = (gender: 'woman' | 'man' | null) =>
  ({ ageBand: '36_45', ageYears: 40, gender, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'h' }) as unknown as PersonalizerInput['profile'];

const callFor = (gender: 'woman' | 'man' | null, span: string) =>
  personalizerV3Call(
    ctx,
    'v3.personalizer.1',
    [card(span)],
    new Map([[span, { from: '2026-12-01', to: '2027-02-01' }]]),
    { profile: profile(gender), portrait: null, sections: {} },
    'SYSTEM',
    'model-x',
  );

const ORACLE_MARK = '\n\n# ORACLE CARDS';
const voicePartOf = (prefix: string) => prefix.split(ORACLE_MARK)[0]!;

describe('the voice file', () => {
  it('is embedded with the three blocks under shared guardrails', () => {
    const { guard, blocks } = parseVoiceBlocks(PROMPTS[PERSONALIZER_VOICE_PROMPT] ?? '');
    expect(Object.keys(blocks).sort()).toEqual(['man', 'neutral', 'woman']);
    expect(guard).toMatch(/flow, opening and tone only/);
    expect(guard).toMatch(/Never "as a woman" or "as a man"/);
    expect(guard).toMatch(/the facts win/);
  });

  it('names no engine, no chart term and no internal id', () => {
    const text = PROMPTS[PERSONALIZER_VOICE_PROMPT] ?? '';
    expect(text).not.toMatch(ENGINE_NAMES);
    for (const re of CHART_TERMS) expect(re.test(text), String(re)).toBe(false);
  });
});

describe('block selection', () => {
  it('woman, man and neutral each get their own block and the guardrails', () => {
    const woman = personalizerVoiceBlock('woman');
    const man = personalizerVoiceBlock('man');
    const neutral = personalizerVoiceBlock('neutral');
    expect(woman).toContain('## woman');
    expect(woman).not.toContain('## man');
    expect(woman).not.toContain('## neutral');
    expect(man).toContain('## man');
    expect(man).not.toContain('## woman');
    expect(neutral).toContain('## neutral');
    expect(neutral).not.toContain('## woman');
    for (const b of [woman, man, neutral]) expect(b).toContain('flow, opening and tone only');
    expect(new Set([woman, man, neutral]).size).toBe(3);
  });

  it('maps the stated gender; anything else is neutral', () => {
    expect(personalizerVoiceOf('woman')).toBe('woman');
    expect(personalizerVoiceOf('man')).toBe('man');
    expect(personalizerVoiceOf(null)).toBe('neutral');
    expect(personalizerVoiceOf(undefined)).toBe('neutral');
    expect(personalizerVoiceOf('non-binary')).toBe('neutral');
    expect(personalizerVoiceOf('prefer_not_to_say')).toBe('neutral');
    expect(personalizerVoiceOf('Woman')).toBe('neutral');
  });

  it('PERSONALIZER_VOICE_BY_GENDER off (0, false, off) gives the neutral voice for a stated gender', () => {
    for (const off of ['0', 'false', 'off']) {
      process.env.PERSONALIZER_VOICE_BY_GENDER = off;
      expect(personalizerVoiceOf('woman')).toBe('neutral');
      expect(personalizerVoiceOf('man')).toBe('neutral');
      expect(personalizerVoicePrefix('woman')).toBe(personalizerVoicePrefix(null));
    }
    delete process.env.PERSONALIZER_VOICE_BY_GENDER;
    expect(personalizerVoiceOf('woman')).toBe('woman');
  });

  it('a voice file without the block gives no voice text', () => {
    expect(personalizerVoiceBlock('man', '# VOICE\n\nrules\n\n## woman\nonly this')).toBe('');
  });
});

describe('the voice in the stable prefix', () => {
  it('leads parts[0] and is identical across two different spans for the same gender', () => {
    const a = callFor('woman', 's1');
    const b = callFor('woman', 's7');
    expect(a.prefix.startsWith(personalizerVoicePrefix('woman'))).toBe(true);
    expect(voicePartOf(a.prefix)).toBe(voicePartOf(b.prefix));
    expect(voicePartOf(a.prefix)).toBe(personalizerVoicePrefix('woman'));
    expect(a.prefix).not.toBe(b.prefix);
    expect(a.prefix).toContain('# ORACLE CARDS');
  });

  it('differs by voice and is never in the suffix', () => {
    const w = callFor('woman', 's1');
    const m = callFor('man', 's1');
    const n = callFor(null, 's1');
    expect(new Set([voicePartOf(w.prefix), voicePartOf(m.prefix), voicePartOf(n.prefix)]).size).toBe(3);
    expect(voicePartOf(n.prefix)).toContain('## neutral');
    for (const c of [w, m, n]) {
      expect(c.suffix).not.toContain('# VOICE');
      expect(c.suffix).not.toContain('flow, opening and tone only');
    }
  });

  it('names the version, and the cache token carries version, voice and the file hash', () => {
    expect(personalizerVoicePrefix('man')).toContain(`# VOICE ${PERSONALIZER_VOICE_VERSION}: man`);
    const t = personalizerVoiceToken('man');
    expect(t.startsWith(`${PERSONALIZER_VOICE_VERSION}.man.`)).toBe(true);
    expect(personalizerVoiceToken('woman')).not.toBe(t);
    expect(personalizerVoiceToken(null)).toContain('.neutral.');
    process.env.PERSONALIZER_VOICE_VERSION = 'v2';
    expect(personalizerVoiceToken('man')).not.toBe(t);
    expect(personalizerVoicePrefix('man')).toContain('# VOICE v2: man');
  });
});

describe('STEREOTYPE_PHRASES', () => {
  const c = { gender: 'woman' as const, dates: v3DateFrame(['2026-12-01', '2027-02-01']) };

  it('is a short lowercase list', () => {
    expect(STEREOTYPE_PHRASES.length).toBeGreaterThan(5);
    expect(STEREOTYPE_PHRASES.length).toBeLessThan(25);
    for (const p of STEREOTYPE_PHRASES) expect(p).toBe(p.toLowerCase());
    expect(STEREOTYPE_PHRASES).toEqual(expect.arrayContaining(['as a woman', 'as a man', 'sweetie', 'honey']));
  });

  it('textProblem flags a stereotype phrase even when a gender is stated, and keeps a normal sentence', () => {
    expect(textProblem('As a woman, you should rest until 1 Dec 2026.', c)).toMatch(/gendered stereotype phrase \(As a woman\)/);
    expect(textProblem('Take it easy, sweetie, until 1 Dec 2026.', { ...c, gender: 'man' })).toMatch(/stereotype/);
    expect(textProblem('Work asks a lot of you until 1 Dec 2026.', c)).toBeNull();
    expect(textProblem('Girlfriends and girlhood friends stay close.', { ...c, gender: 'man' })).toBeNull();
  });

  it('redactChartTerms drops the sentence that carries one, like a chart term', () => {
    const out = redactChartTerms('Work is heavy until 1 Dec. As a man, you should push on. Rest on the weekend.');
    expect(out).toBe('Work is heavy until 1 Dec. Rest on the weekend.');
    expect(redactChartTerms('Saturn tests you. Honey, rest tonight. Keep the evenings quiet.')).toBe('Keep the evenings quiet.');
  });

  it('PERSONALIZER_STEREOTYPE_PHRASES replaces the default list', () => {
    process.env.PERSONALIZER_STEREOTYPE_PHRASES = 'Buddy, Champ';
    expect(textProblem('Keep going, champ, until 1 Dec 2026.', c)).toMatch(/stereotype/);
    expect(textProblem('As a woman, you should rest until 1 Dec 2026.', c)).toBeNull();
  });
});
