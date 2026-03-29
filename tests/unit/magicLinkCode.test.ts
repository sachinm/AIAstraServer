import { describe, it, expect } from 'vitest';
import {
  generateMagicLinkCode,
  normalizeMagicLinkCode,
} from '../../src/lib/magicLinkCode.js';

describe('magicLinkCode', () => {
  it('generateMagicLinkCode returns 8 uppercase alphanumeric chars', () => {
    const c = generateMagicLinkCode();
    expect(c).toHaveLength(8);
    expect(c).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('normalizeMagicLinkCode strips non-alphanumeric and uppercases', () => {
    expect(normalizeMagicLinkCode('ab-12cd34')).toBe('AB12CD34');
    expect(normalizeMagicLinkCode('  xyz9  ')).toBe('XYZ9');
  });
});
