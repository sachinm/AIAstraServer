/**
 * Plan "retire the v2 Self reading" step 4: GET /api/self/v3 serves `headerLine`, the diagnosis card's plain line (the
 * Personalizer of the diagnosis card writes the Self header, docs/techniques/09 §3.1). Null when that card is absent
 * (off), locked, not read, or its plain reading is pending. No model call: the stored card's line, as served.
 */
import { describe, expect, it } from 'vitest';
import { headerLineOf } from '../../../../../src/reading/self/v3/service.js';
import type { SelfV3CardView } from '../../../../../src/reading/self/v3/types.js';

const card = (over: Record<string, unknown>) => ({ id: 'diagnosis', locked: null, v3: { line: 'Work asks more of you until 20 Feb 2027.', plain: { story: 'x', pending: false } }, ...over }) as unknown as SelfV3CardView;

describe('headerLineOf', () => {
  it('is the diagnosis card line when it was read', () => {
    expect(headerLineOf([card({ id: 'mind', v3: { line: 'not this one' } }), card({})])).toBe('Work asks more of you until 20 Feb 2027.');
  });
  it('is null when the diagnosis card is off, locked, unread or its plain reading pending', () => {
    expect(headerLineOf([card({ id: 'mind' })])).toBeNull();
    expect(headerLineOf([card({ locked: { minPlan: 'plus' } })])).toBeNull();
    expect(headerLineOf([card({ v3: null })])).toBeNull();
    expect(headerLineOf([card({ v3: { line: 'Oracle headline', plain: { story: null, pending: true } } })])).toBeNull();
    expect(headerLineOf([card({ v3: { line: '   ' } })])).toBeNull();
  });
});
