import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseAstroKundliResponse,
  authToAstroKundliParams,
  KUNDLI_JSON_FIELDS,
  checkAstroKundliEndpoint,
} from '../../src/lib/astroKundliClient.js';

vi.mock('../../src/lib/encrypt.js', () => ({
  decrypt: vi.fn((x: string | null) => (x && x.startsWith('enc:') ? 'decrypted' : x)),
}));

vi.mock('../../src/config/env.js', () => ({
  getAstroKundliBaseUrl: vi.fn(() => 'http://localhost:8765'),
}));

describe('astroKundliClient', () => {
  describe('KUNDLI_JSON_FIELDS', () => {
    it('includes all 8 expected fields', () => {
      expect(KUNDLI_JSON_FIELDS).toEqual([
        'biodata',
        'd1',
        'd7',
        'd9',
        'd10',
        'charakaraka',
        'vimsottari_dasa',
        'narayana_dasa',
      ]);
    });
  });

  describe('parseAstroKundliResponse', () => {
    it('returns data when present', () => {
      const res = { data: { foo: 'bar' } };
      expect(parseAstroKundliResponse(res)).toEqual({ foo: 'bar' });
    });

    it('throws when error is present', () => {
      expect(() => parseAstroKundliResponse({ error: 'Bad request' })).toThrow('Bad request');
    });

    it('returns raw object when no data key', () => {
      const res = { chart: 'D1' };
      expect(parseAstroKundliResponse(res as never)).toEqual({ chart: 'D1' });
    });
  });

  describe('authToAstroKundliParams', () => {
    it('normalizes dob to YYYY-MM-DD', () => {
      const params = authToAstroKundliParams({
        date_of_birth: '1996-12-07',
        place_of_birth: 'Chennai, IN',
        time_of_birth: '10:34:00',
      });
      expect(params.dob).toBe('1996-12-07');
      expect(params.tob).toBe('10:34:00');
      expect(params.place).toBe('Chennai, IN');
      expect(params.ayanamsa).toBe('LAHIRI');
    });

    it('normalizes tob with two parts to HH:MM:00', () => {
      const params = authToAstroKundliParams({
        date_of_birth: '1996-12-07',
        place_of_birth: null,
        time_of_birth: '10:34',
      });
      expect(params.tob).toBe('10:34:00');
    });

    it('uses Unknown when place is empty', () => {
      const params = authToAstroKundliParams({
        date_of_birth: '1996-12-07',
        place_of_birth: null,
        time_of_birth: null,
      });
      expect(params.place).toBe('Unknown');
      expect(params.tob).toBe('00:00:00');
    });
  });

  describe('checkAstroKundliEndpoint', () => {
    const originalFetch = globalThis.fetch;
    beforeEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns ok: true when GET base URL returns 200', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200 })
      );
      const result = await checkAstroKundliEndpoint();
      expect(result.ok).toBe(true);
      expect(result.message).toContain('reachable');
      expect(result.message).toContain('200');
    });

    it('returns ok: true when GET base URL returns 404 (server up, no route)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 })
      );
      const result = await checkAstroKundliEndpoint();
      expect(result.ok).toBe(true);
      expect(result.message).toContain('404');
    });

    it('returns ok: false when connection is refused', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'))
      );
      const result = await checkAstroKundliEndpoint();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/unreachable|connection refused/i);
      expect(result.message).toMatch(/8765/);
    });

    it('returns ok: false when request times out', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('The operation was aborted'))
      );
      const result = await checkAstroKundliEndpoint();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/timeout|abort/i);
    });
  });
});
