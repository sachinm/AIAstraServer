import { describe, expect, it } from 'vitest';
import { parseDmsPlace, parseTz, signedTz } from '../../../scripts/backfill-local-facts.js';

describe('backfill-local-facts input parsing', () => {
  it('parses the DMS place string stored in kundli biodata', () => {
    expect(parseDmsPlace(`28 N 55' 00", 77 E 01' 00"`)).toEqual({ lat: 28.9167, lon: 77.0167 });
    expect(parseDmsPlace(`33 N 12' 36", 117 W 22' 48"`)).toEqual({ lat: 33.21, lon: -117.38 });
    expect(parseDmsPlace(`12 S 03' 00", 77 W 02' 00"`)).toEqual({ lat: -12.05, lon: -77.0333 });
    expect(parseDmsPlace('N/A')).toBeNull();
  });
  it('parses the time zone string', () => {
    expect(parseTz('5:30:00')).toBe(5.5);
    expect(parseTz('-7:00:00')).toBe(-7);
    expect(parseTz('5:45')).toBe(5.75);
    expect(parseTz('IST')).toBeNull();
  });
  it('restores the sign of a western offset printed without one', () => {
    expect(signedTz(7, -117.38)).toBe(-7);
    expect(signedTz(5.5, 77.02)).toBe(5.5);
    expect(signedTz(-5, -74)).toBe(-5);
    expect(signedTz(0, -0.1)).toBe(0);
  });
});
