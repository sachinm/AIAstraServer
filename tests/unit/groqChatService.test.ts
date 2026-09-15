/**
 * Unit tests for buildUserMessageWithKundli: lean (default) vs full Kundli context.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildUserMessageWithKundli,
  KUNDLI_FIELD_TITLES,
  CHAT_KUNDLI_LEAN_FIELDS,
  CHAT_KUNDLI_FULL_FIELDS,
  type BuildUserMessageWithKundliResult,
} from '../../src/services/groqChatService.js';

/** Parse content block: returns the title part from "This is the ... of the person:" */
function parseDataPointFromContent(content: string): string | null {
  const match = content.match(/^This is the (.+?) of the person:\n/s);
  return match ? match[1].trim() : null;
}

function findContentForField(
  result: BuildUserMessageWithKundliResult,
  fieldKey: string
): string | undefined {
  const expectedTitle = KUNDLI_FIELD_TITLES[fieldKey];
  if (!expectedTitle) return undefined;
  const prefix = `This is the ${expectedTitle} of the person:`;
  return result.kundliUserContents.find((c) => c.startsWith(prefix));
}

describe('buildUserMessageWithKundli', () => {
  const emptyKundli = {
    biodata: null,
    d1: null,
    d2: null,
    d4: null,
    d7: null,
    d9: null,
    d10: null,
    charakaraka: null,
    vimsottari_dasa: null,
    narayana_dasa: null,
  };

  const savedContext = process.env.CHAT_KUNDLI_CONTEXT;

  afterEach(() => {
    if (savedContext === undefined) delete process.env.CHAT_KUNDLI_CONTEXT;
    else process.env.CHAT_KUNDLI_CONTEXT = savedContext;
  });

  it('lean (default): returns 5 core fields only', () => {
    delete process.env.CHAT_KUNDLI_CONTEXT;
    const result = buildUserMessageWithKundli(emptyKundli, ' My question ');
    expect(result.kundliUserContents).toHaveLength(CHAT_KUNDLI_LEAN_FIELDS.length);
    expect(result.userQuestion).toBe('My question');

    const parsedTitles = result.kundliUserContents
      .map(parseDataPointFromContent)
      .filter((t): t is string => t !== null);
    const expectedTitles = CHAT_KUNDLI_LEAN_FIELDS.map((k) => KUNDLI_FIELD_TITLES[k]);
    expect(parsedTitles).toEqual(expectedTitles);
    expect(findContentForField(result, 'd2')).toBeUndefined();
    expect(findContentForField(result, 'narayana_dasa')).toBeUndefined();
  });

  it('full: returns all 10 Kundli fields when CHAT_KUNDLI_CONTEXT=full', () => {
    process.env.CHAT_KUNDLI_CONTEXT = 'full';
    const result = buildUserMessageWithKundli(emptyKundli, '');
    expect(result.kundliUserContents).toHaveLength(CHAT_KUNDLI_FULL_FIELDS.length);
    const parsedTitles = result.kundliUserContents
      .map(parseDataPointFromContent)
      .filter((t): t is string => t !== null);
    const expectedTitles = CHAT_KUNDLI_FULL_FIELDS.map((k) => KUNDLI_FIELD_TITLES[k]);
    expect(parsedTitles).toEqual(expectedTitles);
  });

  it('each lean content block contains JSON or "(no data available)"', () => {
    delete process.env.CHAT_KUNDLI_CONTEXT;
    const result = buildUserMessageWithKundli(emptyKundli, '');
    for (const content of result.kundliUserContents) {
      const afterFirstLine = content.split('\n').slice(1).join('\n').trim();
      const hasPlaceholder = afterFirstLine === '(no data available)';
      const looksLikeJson =
        (afterFirstLine.startsWith('{') && afterFirstLine.includes('}')) ||
        (afterFirstLine.startsWith('[') && afterFirstLine.includes(']'));
      expect(hasPlaceholder || looksLikeJson).toBe(true);
    }
  });

  describe('per-field presence in lean kundliUserContents', () => {
    for (const fieldKey of CHAT_KUNDLI_LEAN_FIELDS) {
      it(`includes data point for ${fieldKey}`, () => {
        delete process.env.CHAT_KUNDLI_CONTEXT;
        const kundli = { ...emptyKundli, [fieldKey]: { sample: 'data' } };
        const result = buildUserMessageWithKundli(kundli, '');
        const content = findContentForField(result, fieldKey);
        expect(content).toBeDefined();
        expect(content).toContain('This is the ' + KUNDLI_FIELD_TITLES[fieldKey] + ' of the person:');
        expect(content).toContain('"sample": "data"');
      });
    }
  });

  it('full mode includes narayana_dasa when provided', () => {
    process.env.CHAT_KUNDLI_CONTEXT = 'full';
    const kundli = {
      ...emptyKundli,
      narayana_dasa: { periods: [{ lord: 'Sun', start: 0, end: 6 }] },
    };
    const result = buildUserMessageWithKundli(kundli, '');
    const content = findContentForField(result, 'narayana_dasa');
    expect(content).toBeDefined();
    expect(content).toContain('This is the Narayana Dasa of the person:');
    expect(content).toContain('periods');
    expect(content).toContain('Sun');
  });
});
