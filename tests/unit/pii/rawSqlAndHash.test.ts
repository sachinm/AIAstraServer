/** docs/privacy/02 B1.3: sealParam/openRow for the raw-SQL sites, and the keyed hashes. */
import { createHash, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalKeyProvider, SYSTEM_KEY_REF } from '../../../src/lib/pii/keys.js';
import { openRow, openRows, sealParam, setRawSqlDeps } from '../../../src/lib/pii/rawSql.js';
import { hashKeyFor, piiHash } from '../../../src/lib/pii/hash.js';
import { isSealed } from '../../../src/lib/pii/seal.js';
import { payloadHash } from '../../../src/reading/chartData/store.js';
import { sourceHash } from '../../../src/reading/data/factsBuilder.js';
import { hashText } from '../../../src/reading/packs/selector.js';
import { sourceHash as transitSourceHash } from '../../../src/reading/transits/ephemerisCache.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const keys = new LocalKeyProvider(randomBytes(32));

afterEach(() => setRawSqlDeps(null));

describe('sealParam / openRow', () => {
  it('plain mode: values are bound as they are (B1 behaviour unchanged)', async () => {
    setRawSqlDeps({ keys: () => keys, writeMode: () => 'plain' });
    expect(await sealParam('user_current_location', 'place', 'Pune, India', { userId: 'u' })).toBe('Pune, India');
    expect(await sealParam('kundli_data', 'params', { lat: 1 }, { kundliId: 'k' })).toEqual({ lat: 1 });
  });

  it('sealed mode: personal columns sealed under the owner key, other columns untouched, rows open again', async () => {
    setRawSqlDeps({ keys: () => keys, writeMode: () => 'sealed', keyRefFor: async () => ALICE });
    const place = await sealParam('user_current_location', 'place', 'Pune, India', { userId: 'u' });
    const tz = await sealParam('user_current_location', 'tz', 'Asia/Kolkata', { userId: 'u' });
    expect(isSealed(place) && isSealed(tz)).toBe(true);
    expect(await sealParam('user_current_location', 'updated_at', 'now', { userId: 'u' })).toBe('now');
    const payload = await sealParam('kundli_transit_overlays', 'payload', { sky: [1, 2] }, { kundliId: 'k' });
    expect(isSealed(payload)).toBe(true);
    expect(await openRow('user_current_location', { place, tz, lat: null })).toEqual({ place: 'Pune, India', tz: 'Asia/Kolkata', lat: null });
    expect(await openRows('kundli_transit_overlays', [{ payload, calc_version: 'v1' }])).toEqual([{ payload: { sky: [1, 2] }, calc_version: 'v1' }]);
  });

  it('sealed mode before B2 refuses for a person, and uses the system key for shared rows', async () => {
    setRawSqlDeps({ keys: () => keys, writeMode: () => 'sealed' });
    await expect(sealParam('prashna_casts', 'payload', { a: 1 }, { userId: 'u' })).rejects.toThrow(/M26/);
    // shared sky tables have no sealed column yet; the system key_ref is what they will use
    expect(SYSTEM_KEY_REF).toMatch(/^0{8}-/);
  });

  it('a table that is not in the field map is a programming error', async () => {
    await expect(sealParam('no_such_table', 'x', 'y', { userId: 'u' })).rejects.toThrow(/fields\.ts/);
  });
});

describe('hashes over personal values', () => {
  it('without a key they are exactly the digests each site used before, so no stored hash changes', () => {
    const parts = ['1987-03-14', '05:42:00', 'Pune,IN', 3];
    const old = createHash('sha256').update(parts.map((p) => String(p ?? '')).join('|')).digest('hex').slice(0, 16);
    expect(sourceHash(parts)).toBe(old);
    const payload = { asc: 'Leo' };
    expect(payloadHash(payload)).toBe(createHash('md5').update(JSON.stringify(payload)).digest('hex'));
    expect(hashText('abc')).toBe(createHash('sha256').update('abc').digest('hex').slice(0, 16));
    expect(transitSourceHash(payload)).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16));
  });

  it('with the person hash key they are HMACs: stable for the person, different for another key', async () => {
    const k = await hashKeyFor(ALICE, keys);
    const other = await hashKeyFor('22222222-2222-4222-8222-222222222222', keys);
    const parts = ['1987-03-14', '05:42:00', 'Pune,IN', 3];
    expect(sourceHash(parts, k)).toBe(sourceHash(parts, k));
    expect(sourceHash(parts, k)).not.toBe(sourceHash(parts));
    expect(sourceHash(parts, k)).not.toBe(sourceHash(parts, other));
    expect(piiHash('x', { key: k, len: 16 })).toHaveLength(16);
  });
});
