import { describe, expect, it } from 'vitest';
import { boardRefreshKey, clockChargeKey } from '../../../src/billing/questionGate.js';
import { breakdownOf, usageKind } from '../../../src/billing/usageKinds.js';

describe('what a question was spent on', () => {
  it('reads a chat from a clarify run or a bare reserve key', () => {
    expect(usageKind('clarify:run-1')).toBe('chat');
    expect(usageKind('3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a43')).toBe('chat');
    expect(usageKind('3F2B8C1E-9A4D-4E2F-8B1A-0C9D7E6F5A43')).toBe('chat');
  });

  it('reads a card chat from its prefix', () => {
    expect(usageKind('cardchat:card-7')).toBe('cardchat');
  });

  it('reads a fresh reading and a clock switch as a board refresh', () => {
    expect(usageKind(boardRefreshKey('love', '2026-11-15'))).toBe('board_refresh');
    expect(usageKind(clockChargeKey('2026-11-15', 'kp'))).toBe('board_refresh');
  });

  it('puts anything else in other', () => {
    expect(usageKind('')).toBe('other');
    expect(usageKind('timeline:2026')).toBe('other');
    expect(usageKind('3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a43:x')).toBe('other');
  });

  it('counts each kind', () => {
    expect(breakdownOf([])).toEqual({ chat: 0, cardchat: 0, board_refresh: 0, other: 0 });
    expect(
      breakdownOf(['clarify:a', '3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a43', 'cardchat:x', boardRefreshKey('self', '2026-11-15'), 'odd'])
    ).toEqual({ chat: 2, cardchat: 1, board_refresh: 1, other: 1 });
  });
});
