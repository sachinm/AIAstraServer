/**
 * Unit tests for buildUserMessageWithKundli: ensure all Kundli data points
 * (biodata, d1, d7, d9, d10, charakaraka, vimsottari_dasa, narayana_dasa) appear
 * in kundliUserContents, with one test per data point and one overall coverage test.
 */
import { describe, it, expect } from 'vitest';
import {
  buildUserMessageWithKundli,
  KUNDLI_FIELD_TITLES,
  type BuildUserMessageWithKundliResult,
} from '../../src/services/groqChatService.js';

/** All Kundli field keys that must appear in kundliUserContents (order matches service) */
const EXPECTED_FIELDS = [
  'biodata',
  'd1',
  'd7',
  'd9',
  'd10',
  'charakaraka',
  'vimsottari_dasa',
  'narayana_dasa',
] as const;

/** Parse content block: returns the title part (e.g. "Narayana Dasa") from "This is the ... of the person:" */
function parseDataPointFromContent(content: string): string | null {
  const match = content.match(/^This is the (.+?) of the person:\n/s);
  return match ? match[1].trim() : null;
}

/** Find the single content block that corresponds to a given field title */
function findContentForField(
  result: BuildUserMessageWithKundliResult,
  fieldKey: (typeof EXPECTED_FIELDS)[number]
): string | undefined {
  const expectedTitle = KUNDLI_FIELD_TITLES[fieldKey];
  if (!expectedTitle) return undefined;
  const prefix = `This is the ${expectedTitle} of the person:`;
  return result.kundliUserContents.find((c) => c.startsWith(prefix));
}

describe('buildUserMessageWithKundli', () => {
  /** Minimal kundli with all fields null/undefined – every block should still appear with "(no data available)" */
  const emptyKundli = {
    biodata: null,
    d1: null,
    d7: null,
    d9: null,
    d10: null,
    charakaraka: null,
    vimsottari_dasa: null,
    narayana_dasa: null,
  };

  it('returns exactly 8 kundliUserContents and each expected data point appears once', () => {
    const result = buildUserMessageWithKundli(emptyKundli, ' My question ');
    expect(result.kundliUserContents).toHaveLength(8);
    expect(result.userQuestion).toBe('My question');

    const parsedTitles = result.kundliUserContents
      .map(parseDataPointFromContent)
      .filter((t): t is string => t !== null);
    const expectedTitles = EXPECTED_FIELDS.map((k) => KUNDLI_FIELD_TITLES[k]);
    expect(parsedTitles.sort()).toEqual([...expectedTitles].sort());
    expect(new Set(parsedTitles).size).toBe(8);
  });

  it('each content block contains either JSON data or "(no data available)"', () => {
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

  describe('per-field presence in kundliUserContents', () => {
    for (const fieldKey of EXPECTED_FIELDS) {
      it(`includes data point for ${fieldKey}`, () => {
        const kundli = { ...emptyKundli, [fieldKey]: { sample: 'data' } };
        const result = buildUserMessageWithKundli(kundli, '');
        const content = findContentForField(result, fieldKey);
        expect(content).toBeDefined();
        expect(content).toContain('This is the ' + KUNDLI_FIELD_TITLES[fieldKey] + ' of the person:');
        expect(content).toContain('"sample": "data"');
      });

      it(`includes ${fieldKey} entry even when value is null (shows "no data available")`, () => {
        const kundli = { ...emptyKundli, [fieldKey]: null };
        const result = buildUserMessageWithKundli(kundli, '');
        const content = findContentForField(result, fieldKey);
        expect(content).toBeDefined();
        expect(content).toContain('(no data available)');
      });
    }
  });

  /** Explicit test for narayana_dasa to guard against regression */
  it('includes narayana_dasa in kundliUserContents with value when provided', () => {
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

  it('includes narayana_dasa in kundliUserContents with "(no data available)" when omitted', () => {
    const kundliNoNarayana = {
      biodata: null,
      d1: null,
      d7: null,
      d9: null,
      d10: null,
      charakaraka: null,
      vimsottari_dasa: null,
      // narayana_dasa intentionally omitted (simulates older payload)
    };
    const result = buildUserMessageWithKundli(kundliNoNarayana as Parameters<typeof buildUserMessageWithKundli>[0], '');
    const content = findContentForField(result, 'narayana_dasa');
    expect(content).toBeDefined();
    expect(content).toContain('Narayana Dasa');
    expect(content).toContain('(no data available)');
  });
});
