/** docs/privacy/02 B1.1: sealing round trips, binds to table/column/person, has no plaintext fallback, gzips over 4 KB. */
import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalKeyProvider, PiiUnavailableError } from '../../../src/lib/pii/keys.js';
import { GZIP_OVER_BYTES, isSealed, isSealedJson, keyRefOf, openLegacy, openValue, PII_GZIP_PREFIX, PII_PREFIX, sealValue } from '../../../src/lib/pii/seal.js';

const keys = new LocalKeyProvider(randomBytes(32));
const other = new LocalKeyProvider(randomBytes(32));
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const dob = { table: 'auth', column: 'date_of_birth', kind: 'text' as const };
const payload = { table: 'kundli_data', column: 'payload', kind: 'json' as const };

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('seal / open', () => {
  it('round-trips text and JSON; JSON keeps its type as { $pii }', async () => {
    const s = (await sealValue('1987-03-14', dob, ALICE, keys)) as string;
    expect(s.startsWith(`${PII_PREFIX}${ALICE}:`)).toBe(true);
    expect(s).not.toContain('1987');
    expect(keyRefOf(s)).toBe(ALICE);
    expect(await openValue(s, dob, keys)).toBe('1987-03-14');

    const chart = { asc: 'Leo', planets: [{ id: 'Su', lon: 123.45 }] };
    const j = await sealValue(chart, payload, ALICE, keys);
    expect(isSealedJson(j)).toBe(true);
    expect(await openValue(j, payload, keys)).toEqual(chart);
  });

  it('uses a fresh IV each time', async () => {
    expect(await sealValue('x', dob, ALICE, keys)).not.toBe(await sealValue('x', dob, ALICE, keys));
  });

  it('fails with the wrong AAD: another column, another table, or another person', async () => {
    const s = (await sealValue('1987-03-14', dob, ALICE, keys)) as string;
    await expect(openValue(s, { ...dob, column: 'time_of_birth' }, keys)).rejects.toBeInstanceOf(PiiUnavailableError);
    await expect(openValue(s, { ...dob, table: 'kundlis' }, keys)).rejects.toBeInstanceOf(PiiUnavailableError);
    // moved to Bob's key_ref: opened with Bob's key and Bob's AAD, still refused
    await expect(openValue(s.replace(ALICE, BOB), dob, keys)).rejects.toBeInstanceOf(PiiUnavailableError);
  });

  it('fails with the wrong key and on a tampered value; never returns ciphertext', async () => {
    const s = (await sealValue('1987-03-14', dob, ALICE, keys)) as string;
    await expect(openValue(s, dob, other)).rejects.toThrow(/PII_UNAVAILABLE/);
    const tampered = s.slice(0, -3) + (s.endsWith('AAA') ? 'BBB' : 'AAA');
    await expect(openValue(tampered, dob, keys)).rejects.toThrow(/PII_UNAVAILABLE/);
    await expect(openValue(`${PII_PREFIX}not-a-ref:x:y`, dob, keys)).rejects.toThrow(/PII_UNAVAILABLE/);
  });

  it('gzips values over 4 KB (pii2z:) and still round-trips', async () => {
    const big = { rows: Array.from({ length: 400 }, (_, i) => ({ i, sign: 'Scorpio', nak: 'Anuradha' })) };
    expect(JSON.stringify(big).length).toBeGreaterThan(GZIP_OVER_BYTES);
    const j = (await sealValue(big, payload, ALICE, keys)) as { $pii: string };
    expect(j.$pii.startsWith(PII_GZIP_PREFIX)).toBe(true);
    expect(j.$pii.length).toBeLessThan(JSON.stringify(big).length);
    expect(await openValue(j, payload, keys)).toEqual(big);
    const small = (await sealValue('short', dob, ALICE, keys)) as string;
    expect(small.startsWith(PII_PREFIX)).toBe(true);
  });

  it('reads plaintext as it is (read-both) and leaves null alone', async () => {
    expect(await openValue('1987-03-14', dob, null)).toBe('1987-03-14');
    expect(await openValue({ asc: 'Leo' }, payload, null)).toEqual({ asc: 'Leo' });
    expect(await sealValue(null, dob, ALICE, keys)).toBeNull();
  });

  it('is idempotent: a sealed value is not sealed again', async () => {
    const s = await sealValue('x', dob, ALICE, keys);
    expect(await sealValue(s, dob, ALICE, keys)).toBe(s);
    expect(isSealed(s)).toBe(true);
  });

  it('a sealed value with no provider configured throws instead of passing through', async () => {
    const s = await sealValue('x', dob, ALICE, keys);
    await expect(openValue(s, dob, null)).rejects.toThrow(/PII_UNAVAILABLE/);
  });
});

describe('legacy enc: values (src/lib/encrypt.ts format)', () => {
  it('open with ENCRYPTION_KEY, and throw (never return ciphertext) without it or on a bad value', async () => {
    const { encrypt } = await import('../../../src/lib/encrypt.js');
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const enc = encrypt('New Delhi,IN')!;
    expect(enc.startsWith('enc:')).toBe(true);
    expect(await openValue(enc, dob, null)).toBe('New Delhi,IN');
    expect(() => openLegacy('enc:AAAA')).toThrow(/PII_UNAVAILABLE/);
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
    expect(() => openLegacy(enc)).toThrow(/PII_UNAVAILABLE/);
    delete process.env.ENCRYPTION_KEY;
    expect(() => openLegacy(enc)).toThrow(/PII_UNAVAILABLE/);
  });
});
