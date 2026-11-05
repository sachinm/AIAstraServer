/** docs/privacy/02 B1.1: key providers, the per-instance cache, the blind index, and boot refusal. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { CachedKeyProvider, KmsKeyProvider, LocalKeyProvider, PiiUnavailableError, readMasterKey, readPiiConfig, type PiiKeyProvider } from '../../../src/lib/pii/keys.js';
import { blindIndex } from '../../../src/lib/pii/blindIndex.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const tmp: string[] = [];

afterEach(() => {
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  for (const f of tmp.splice(0)) fs.rmSync(f, { force: true });
});

function keyFile(contents: Buffer | string): string {
  const f = path.join(os.tmpdir(), `aiastra-pii-key-${process.pid}-${tmp.length}`);
  fs.writeFileSync(f, contents);
  tmp.push(f);
  return f;
}

describe('local provider', () => {
  it('derives a distinct, stable 32-byte key per key_ref', async () => {
    const p = new LocalKeyProvider(randomBytes(32));
    const a1 = await p.dataKey(A);
    expect(a1).toHaveLength(32);
    expect((await p.dataKey(A)).equals(a1)).toBe(true);
    expect((await p.dataKey(B)).equals(a1)).toBe(false);
    expect(await p.createKey()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reads the master key as raw bytes, hex or base64; rejects anything else', () => {
    const k = randomBytes(32);
    expect(readMasterKey(keyFile(k)).equals(k)).toBe(true);
    expect(readMasterKey(keyFile(k.toString('hex'))).equals(k)).toBe(true);
    expect(readMasterKey(keyFile(k.toString('base64'))).equals(k)).toBe(true);
    expect(() => readMasterKey(keyFile('too short'))).toThrow(PiiUnavailableError);
  });

  it('is refused on a Lambda', () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'aiastra-server-api';
    expect(() => new LocalKeyProvider(randomBytes(32))).toThrow(/refused on a Lambda/);
  });

  it('a destroyed key can no longer be produced (erasure)', async () => {
    const p = new CachedKeyProvider(new LocalKeyProvider(randomBytes(32)));
    await p.dataKey(A);
    await p.destroyKey(A);
    await expect(p.dataKey(A)).rejects.toThrow(/destroyed/);
  });
});

describe('KMS provider (interface only in B1)', () => {
  it('throws PII_UNAVAILABLE on every call until B3', async () => {
    const p = new KmsKeyProvider({ wrapKeyArn: 'arn:a', bidxKeyArn: 'arn:b', keysTable: 't' });
    await expect(p.dataKey(A)).rejects.toThrow(/PII_UNAVAILABLE/);
    await expect(p.createKey()).rejects.toThrow(/PII_UNAVAILABLE/);
    await expect(p.mac('x')).rejects.toThrow(/PII_UNAVAILABLE/);
  });
});

describe('key cache', () => {
  it('keeps at most N keys for the TTL, then asks the provider again', async () => {
    let calls = 0;
    let t = 0;
    const inner = new LocalKeyProvider(randomBytes(32));
    const counting: PiiKeyProvider = {
      kind: 'local',
      dataKey: async (r) => {
        calls += 1;
        return inner.dataKey(r);
      },
      createKey: () => inner.createKey(),
      mac: (v) => inner.mac(v),
      destroyKey: (r) => inner.destroyKey(r),
    };
    const c = new CachedKeyProvider(counting, { max: 1, ttlMs: 1000, now: () => t });
    await c.dataKey(A);
    await c.dataKey(A);
    expect(calls).toBe(1);
    await c.dataKey(B); // evicts A
    expect(c.size).toBe(1);
    await c.dataKey(A);
    expect(calls).toBe(3);
    t = 5000;
    await c.dataKey(A);
    expect(calls).toBe(4);
  });
});

describe('blind index', () => {
  it('is deterministic over lower(trim(value)) and depends on the key', async () => {
    const p = new LocalKeyProvider(randomBytes(32));
    const q = new LocalKeyProvider(randomBytes(32));
    const i = await blindIndex('  Asha@Example.com ', p);
    expect(i).toMatch(/^[0-9a-f]{64}$/);
    expect(await blindIndex('asha@example.com', p)).toBe(i);
    expect(await blindIndex('asha@example.com', q)).not.toBe(i);
  });
});

describe('boot configuration', () => {
  it('plain mode with no provider is allowed everywhere (B2 can ship before the AWS resources exist)', () => {
    expect(readPiiConfig({})).toEqual({ provider: 'none', writeMode: 'plain' });
    expect(readPiiConfig({ AWS_LAMBDA_FUNCTION_NAME: 'api' })).toEqual({ provider: 'none', writeMode: 'plain' });
  });

  it('picks the local provider from PII_LOCAL_KEY_FILE off a Lambda', () => {
    expect(readPiiConfig({ PII_LOCAL_KEY_FILE: '/k' }).provider).toBe('local');
  });

  it('refuses: local on a Lambda, sealed without a provider, sealed on a Lambda without KMS, incomplete KMS config, a bad mode', () => {
    expect(() => readPiiConfig({ AWS_LAMBDA_FUNCTION_NAME: 'api', PII_KEY_PROVIDER: 'local', PII_LOCAL_KEY_FILE: '/k' })).toThrow(/refused on a Lambda/);
    expect(() => readPiiConfig({ PII_WRITE_MODE: 'sealed' })).toThrow(/needs a key provider/);
    expect(() => readPiiConfig({ AWS_LAMBDA_FUNCTION_NAME: 'api', PII_WRITE_MODE: 'sealed' })).toThrow(PiiUnavailableError);
    expect(() => readPiiConfig({ PII_KEY_PROVIDER: 'kms', PII_KMS_WRAP_KEY_ARN: 'a' })).toThrow(/needs PII_KMS_WRAP_KEY_ARN/);
    expect(() => readPiiConfig({ PII_WRITE_MODE: 'maybe' })).toThrow(/plain or sealed/);
  });

  it('accepts the full KMS config on a Lambda in sealed mode', () => {
    const c = readPiiConfig({ AWS_LAMBDA_FUNCTION_NAME: 'api', PII_KEY_PROVIDER: 'kms', PII_WRITE_MODE: 'sealed', PII_KMS_WRAP_KEY_ARN: 'a', PII_KMS_BIDX_KEY_ARN: 'b', PII_KEYS_TABLE: 't' });
    expect(c).toMatchObject({ provider: 'kms', writeMode: 'sealed', kms: { keysTable: 't' } });
  });
});
