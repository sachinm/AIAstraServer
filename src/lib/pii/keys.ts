/**
 * Keys for sealing personal values (docs/privacy/01 §4.1.1, docs/privacy/02 §4.1.1).
 *
 * One AES-256 data key (DEK) per person, named by an opaque `key_ref`. Two providers share one interface:
 *  - `local` (development and tests): one 32-byte master key read from PII_LOCAL_KEY_FILE (outside the checkout); each
 *    person's DEK is HKDF(master, "dek:" + key_ref) and the blind-index key is HKDF(master, "bidx-v1"). Refused on a Lambda.
 *  - `kms` (B3): DEKs made by KMS GenerateDataKey and stored wrapped in DynamoDB; blind index through KMS GenerateMac. Only
 *    its interface exists in B1; every call throws PII_UNAVAILABLE until the AWS resources exist.
 *
 * Unwrapped DEKs are kept in a 500-entry, 5-minute LRU per instance, so a reading costs one unwrap per person.
 * Key bytes are never logged or returned outside this module's callers in src/lib/pii.
 */
import { createHash, createHmac, createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

export const PII_UNAVAILABLE = 'PII_UNAVAILABLE';

/** A value could not be opened or sealed (no key, wrong key, tampered value). Never answered with ciphertext or plaintext. */
export class PiiUnavailableError extends Error {
  readonly code = PII_UNAVAILABLE;
  constructor(reason: string) {
    super(`${PII_UNAVAILABLE}: ${reason}`);
    this.name = 'PiiUnavailableError';
  }
}

/** key_ref of the system key: shared sky rows (transit_instants, transit_range_skies) that belong to no person. */
export const SYSTEM_KEY_REF = '00000000-0000-0000-0000-000000000000';

export interface DataKeyResult {
  plaintext: Buffer;
  wrapped: Buffer;
  keyId: string;
}

export interface PiiKeyProvider {
  readonly kind: 'local' | 'kms';
  /** the person's 32-byte data key */
  dataKey(keyRef: string): Promise<Buffer>;
  /** makes a data key for a new person and returns its key_ref */
  createKey(): Promise<string>;
  /** HMAC-SHA256 under the blind-index key */
  mac(value: string): Promise<Buffer>;
  /** erasure: the person's key can no longer be produced */
  destroyKey(keyRef: string): Promise<void>;
  /** Optional envelope methods implemented by KMS and Mock providers */
  generateDataKey?(): Promise<DataKeyResult>;
  decryptDataKey?(wrappedDek: Buffer, keyId?: string): Promise<Buffer>;
}

export class DekCache {
  private readonly cache = new Map<string, { dek: Buffer; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number = 500,
    private readonly ttlMs: number = 5 * 60_000
  ) {}

  get(hash: string): Buffer | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(hash);
      return null;
    }
    // Refresh LRU order
    this.cache.delete(hash);
    this.cache.set(hash, entry);
    return entry.dek;
  }

  set(hash: string, dek: Buffer, expiresAt: number = Date.now() + this.ttlMs): void {
    this.cache.delete(hash);
    this.cache.set(hash, { dek, expiresAt });
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
      else break;
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const KEY_LEN = 32;
const HKDF_SALT = Buffer.from('aiastra-pii-v1');

function hkdf(ikm: Buffer, info: string): Buffer {
  return Buffer.from(hkdfSync('sha256', ikm, HKDF_SALT, Buffer.from(info), KEY_LEN));
}

const onLambda = (): boolean => Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME?.trim());

/** Reads a 32-byte key from a file: raw bytes, 64 hex characters, or base64. */
export function readMasterKey(file: string): Buffer {
  const raw = fs.readFileSync(file);
  if (raw.length === KEY_LEN) return raw;
  const s = raw.toString('utf8').trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
  const b = Buffer.from(s, 'base64');
  if (b.length === KEY_LEN) return b;
  throw new PiiUnavailableError('PII_LOCAL_KEY_FILE does not hold a 32-byte key');
}

export class LocalKeyProvider implements PiiKeyProvider {
  readonly kind = 'local' as const;
  private readonly bidxKey: Buffer;
  /** local keys are derived, so erasure is a deny-list kept for this process (tests); B3's KMS provider deletes the item */
  private readonly destroyed = new Set<string>();

  constructor(private readonly master: Buffer) {
    if (onLambda()) throw new PiiUnavailableError('the local key provider is refused on a Lambda');
    if (master.length !== KEY_LEN) throw new PiiUnavailableError('the local master key must be 32 bytes');
    this.bidxKey = hkdf(master, 'bidx-v1');
  }

  static fromFile(file: string): LocalKeyProvider {
    return new LocalKeyProvider(readMasterKey(file));
  }

  async dataKey(keyRef: string): Promise<Buffer> {
    if (!isKeyRef(keyRef)) throw new PiiUnavailableError('bad key_ref');
    if (this.destroyed.has(keyRef)) throw new PiiUnavailableError('key destroyed');
    return hkdf(this.master, `dek:${keyRef}`);
  }

  async createKey(): Promise<string> {
    return randomUUID();
  }

  async mac(value: string): Promise<Buffer> {
    return createHmac('sha256', this.bidxKey).update(value, 'utf8').digest();
  }

  async destroyKey(keyRef: string): Promise<void> {
    this.destroyed.add(keyRef);
  }
}

export interface KmsProviderConfig {
  keyId?: string;
  region?: string;
  wrapKeyArn?: string;
  bidxKeyArn?: string;
  keysTable?: string;
}

export const DEFAULT_KMS_KEY_ID = 'alias/aiastra-pii';
export const DEFAULT_KMS_KEY_ARN = 'arn:aws:kms:us-east-1:442728149528:key/24477c16-92ec-49b4-9895-6e0c29dce441';
export const DEFAULT_KMS_REGION = 'us-east-1';

export class KmsKeyProvider implements PiiKeyProvider {
  readonly kind = 'kms' as const;
  private readonly client: KMSClient;
  readonly keyId: string;
  private readonly dekCache: DekCache;
  private activeDek: { plaintext: Buffer; wrapped: Buffer; keyId: string; expiresAt: number } | null = null;
  private bidxKey: Buffer | null = null;
  private readonly destroyed = new Set<string>();

  constructor(readonly config: KmsProviderConfig = {}) {
    this.keyId = config.keyId || config.wrapKeyArn || process.env.PII_KMS_KEY_ARN || process.env.PII_KMS_WRAP_KEY_ARN || DEFAULT_KMS_KEY_ID;
    const region = config.region || process.env.PII_KMS_REGION || process.env.AWS_REGION || DEFAULT_KMS_REGION;
    this.client = new KMSClient({ region });
    this.dekCache = new DekCache(500, 5 * 60_000);
  }

  async generateDataKey(): Promise<DataKeyResult> {
    const now = Date.now();
    if (this.activeDek && now < this.activeDek.expiresAt) {
      return {
        plaintext: this.activeDek.plaintext,
        wrapped: this.activeDek.wrapped,
        keyId: this.activeDek.keyId,
      };
    }

    try {
      const cmd = new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: 'AES_256',
      });
      const res = await this.client.send(cmd);
      if (!res.Plaintext || !res.CiphertextBlob) {
        throw new PiiUnavailableError('KMS GenerateDataKey returned empty plaintext or ciphertext blob');
      }
      const plaintext = Buffer.from(res.Plaintext);
      const wrapped = Buffer.from(res.CiphertextBlob);
      const expiresAt = now + 5 * 60_000;
      this.activeDek = { plaintext, wrapped, keyId: this.keyId, expiresAt };

      const hash = createHash('sha256').update(wrapped).digest('hex');
      this.dekCache.set(hash, plaintext, expiresAt);

      return { plaintext, wrapped, keyId: this.keyId };
    } catch (err: any) {
      throw new PiiUnavailableError(`KMS GenerateDataKey failed: ${err.message}`);
    }
  }

  async decryptDataKey(wrappedDek: Buffer, keyId?: string): Promise<Buffer> {
    const hash = createHash('sha256').update(wrappedDek).digest('hex');
    const cached = this.dekCache.get(hash);
    if (cached) return cached;

    try {
      const cmd = new DecryptCommand({
        CiphertextBlob: wrappedDek,
        KeyId: keyId || this.keyId,
      });
      const res = await this.client.send(cmd);
      if (!res.Plaintext) {
        throw new PiiUnavailableError('KMS Decrypt returned empty plaintext');
      }
      const dek = Buffer.from(res.Plaintext);
      this.dekCache.set(hash, dek);
      return dek;
    } catch (err: any) {
      throw new PiiUnavailableError(`KMS Decrypt failed: ${err.message}`);
    }
  }

  async dataKey(keyRef: string): Promise<Buffer> {
    if (this.destroyed.has(keyRef)) throw new PiiUnavailableError('key destroyed');
    const { plaintext } = await this.generateDataKey();
    return plaintext;
  }

  async createKey(): Promise<string> {
    if (this.keyId === 'arn:a' || !hasAwsKmsCredentials()) {
      throw new PiiUnavailableError('the KMS key provider is not built yet (docs/privacy/02 B3)');
    }
    return randomUUID();
  }

  async mac(value: string): Promise<Buffer> {
    if (!this.bidxKey) {
      const { plaintext } = await this.generateDataKey();
      this.bidxKey = hkdf(plaintext, 'bidx-v1');
    }
    return createHmac('sha256', this.bidxKey).update(value, 'utf8').digest();
  }

  async destroyKey(keyRef: string): Promise<void> {
    this.destroyed.add(keyRef);
  }
}

export class MockKmsKeyProvider implements PiiKeyProvider {
  readonly kind = 'kms' as const;
  readonly keyId: string = 'mock-kms-key-aiastra-pii';
  private readonly mockMasterKey: Buffer;
  private readonly bidxKey: Buffer;
  private readonly dekCache: DekCache;
  private activeDek: { plaintext: Buffer; wrapped: Buffer; keyId: string; expiresAt: number } | null = null;
  private readonly destroyed = new Set<string>();

  constructor(masterKey?: Buffer) {
    this.mockMasterKey = masterKey || Buffer.alloc(32, 0x4b); // Deterministic test key
    this.bidxKey = hkdf(this.mockMasterKey, 'bidx-v1');
    this.dekCache = new DekCache(500, 5 * 60_000);
  }

  async generateDataKey(): Promise<DataKeyResult> {
    const now = Date.now();
    if (this.activeDek && now < this.activeDek.expiresAt) {
      return {
        plaintext: this.activeDek.plaintext,
        wrapped: this.activeDek.wrapped,
        keyId: this.activeDek.keyId,
      };
    }

    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.mockMasterKey, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const wrapped = Buffer.concat([iv, ct, tag]);

    const expiresAt = now + 5 * 60_000;
    this.activeDek = { plaintext, wrapped, keyId: this.keyId, expiresAt };

    const hash = createHash('sha256').update(wrapped).digest('hex');
    this.dekCache.set(hash, plaintext, expiresAt);

    return { plaintext, wrapped, keyId: this.keyId };
  }

  async decryptDataKey(wrappedDek: Buffer, _keyId?: string): Promise<Buffer> {
    const hash = createHash('sha256').update(wrappedDek).digest('hex');
    const cached = this.dekCache.get(hash);
    if (cached) return cached;

    if (wrappedDek.length < 28) throw new PiiUnavailableError('malformed mock wrapped DEK');
    try {
      const iv = wrappedDek.subarray(0, 12);
      const tag = wrappedDek.subarray(wrappedDek.length - 16);
      const ct = wrappedDek.subarray(12, wrappedDek.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', this.mockMasterKey, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
      this.dekCache.set(hash, plaintext);
      return plaintext;
    } catch {
      throw new PiiUnavailableError('cannot unwrap mock DEK');
    }
  }

  async dataKey(keyRef: string): Promise<Buffer> {
    if (this.destroyed.has(keyRef)) throw new PiiUnavailableError('key destroyed');
    const { plaintext } = await this.generateDataKey();
    return plaintext;
  }

  async createKey(): Promise<string> {
    return randomUUID();
  }

  async mac(value: string): Promise<Buffer> {
    return createHmac('sha256', this.bidxKey).update(value, 'utf8').digest();
  }

  async destroyKey(keyRef: string): Promise<void> {
    this.destroyed.add(keyRef);
  }
}

export function hasAwsKmsCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PII_MOCK_KMS === 'true' || env.PII_KEY_PROVIDER === 'mock') return false;
  if (Boolean(env.AWS_LAMBDA_FUNCTION_NAME?.trim())) return true;
  if (Boolean(env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI?.trim() || env.AWS_CONTAINER_CREDENTIALS_FULL_URI?.trim())) return true;
  if (Boolean(env.AWS_ACCESS_KEY_ID?.trim() && env.AWS_SECRET_ACCESS_KEY?.trim())) return true;
  return false;
}

export const KEY_REF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isKeyRef = (s: string): boolean => KEY_REF_RE.test(s);

export type PiiWriteMode = 'plain' | 'sealed';

export interface PiiConfig {
  provider: 'local' | 'kms' | 'mock' | 'none';
  writeMode: PiiWriteMode;
  localKeyFile?: string;
  kms?: KmsProviderConfig;
}

export function createKeyProvider(config: PiiConfig, env: NodeJS.ProcessEnv = process.env): PiiKeyProvider | null {
  if (config.provider === 'local') {
    return LocalKeyProvider.fromFile(config.localKeyFile!);
  }
  if (config.provider === 'mock') {
    return new MockKmsKeyProvider();
  }
  if (config.provider === 'kms') {
    if (hasAwsKmsCredentials(env)) {
      return new KmsKeyProvider(config.kms);
    }
    return new MockKmsKeyProvider();
  }
  return null;
}

/**
 * Reads and checks the PII env. Throws (the process refuses to start) when:
 *  - PII_KEY_PROVIDER=local on a Lambda;
 *  - PII_WRITE_MODE=sealed without a usable provider (on a Lambda: without the KMS provider or credentials).
 * PII_WRITE_MODE=plain with no provider is allowed everywhere, so the read-both code can ship before the AWS resources
 * exist (docs/privacy/02 B2.1); a sealed value met in that state throws PII_UNAVAILABLE.
 */
export function readPiiConfig(env: NodeJS.ProcessEnv = process.env): PiiConfig {
  const lambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME?.trim());
  const modeRaw = (env.PII_WRITE_MODE ?? 'plain').trim().toLowerCase();
  if (modeRaw !== 'plain' && modeRaw !== 'sealed') throw new PiiUnavailableError(`PII_WRITE_MODE must be plain or sealed`);
  const writeMode = modeRaw as PiiWriteMode;
  const localKeyFile = env.PII_LOCAL_KEY_FILE?.trim() || undefined;
  const providerRaw = (env.PII_KEY_PROVIDER ?? '').trim().toLowerCase() || (localKeyFile && !lambda ? 'local' : 'none');
  if (providerRaw !== 'local' && providerRaw !== 'kms' && providerRaw !== 'mock' && providerRaw !== 'none') {
    throw new PiiUnavailableError('PII_KEY_PROVIDER must be kms, mock or local');
  }
  if (providerRaw === 'local' && lambda) throw new PiiUnavailableError('PII_KEY_PROVIDER=local is refused on a Lambda');
  if (providerRaw === 'local' && !localKeyFile) throw new PiiUnavailableError('PII_KEY_PROVIDER=local needs PII_LOCAL_KEY_FILE');
  const kmsParts = {
    wrapKeyArn: env.PII_KMS_WRAP_KEY_ARN?.trim() || env.PII_KMS_KEY_ARN?.trim() || '',
    bidxKeyArn: env.PII_KMS_BIDX_KEY_ARN?.trim() || '',
    keyId: env.PII_KMS_KEY_ARN?.trim() || env.PII_KMS_WRAP_KEY_ARN?.trim() || DEFAULT_KMS_KEY_ID,
    region: env.PII_KMS_REGION?.trim() || env.AWS_REGION?.trim() || DEFAULT_KMS_REGION,
    keysTable: env.PII_KEYS_TABLE?.trim() || undefined,
  };
  if (providerRaw === 'kms' && (!kmsParts.wrapKeyArn || !kmsParts.bidxKeyArn)) {
    throw new PiiUnavailableError('PII_KEY_PROVIDER=kms needs PII_KMS_WRAP_KEY_ARN and PII_KMS_BIDX_KEY_ARN');
  }
  if (writeMode === 'sealed') {
    if (providerRaw === 'none') throw new PiiUnavailableError('PII_WRITE_MODE=sealed needs a key provider');
    if (lambda && providerRaw !== 'kms' && providerRaw !== 'mock') throw new PiiUnavailableError('PII_WRITE_MODE=sealed on a Lambda needs the KMS provider');
  }
  return {
    provider: providerRaw,
    writeMode,
    ...(localKeyFile ? { localKeyFile } : {}),
    ...(providerRaw === 'kms' || providerRaw === 'mock' ? { kms: kmsParts } : {}),
  };
}

/** Wraps a provider with the per-instance LRU of unwrapped data keys (500 entries, 5 minutes). */
export class CachedKeyProvider implements PiiKeyProvider {
  readonly kind: 'local' | 'kms';
  private readonly cache = new Map<string, { key: Buffer; at: number }>();
  constructor(
    private readonly inner: PiiKeyProvider,
    private readonly opts: { max?: number; ttlMs?: number; now?: () => number } = {}
  ) {
    this.kind = inner.kind;
  }
  async dataKey(keyRef: string): Promise<Buffer> {
    const now = (this.opts.now ?? Date.now)();
    const hit = this.cache.get(keyRef);
    if (hit && now - hit.at < (this.opts.ttlMs ?? 5 * 60_000)) {
      this.cache.delete(keyRef);
      this.cache.set(keyRef, hit);
      return hit.key;
    }
    const key = await this.inner.dataKey(keyRef);
    this.cache.delete(keyRef);
    this.cache.set(keyRef, { key, at: now });
    while (this.cache.size > (this.opts.max ?? 500)) this.cache.delete(this.cache.keys().next().value as string);
    return key;
  }
  createKey(): Promise<string> {
    return this.inner.createKey();
  }
  mac(value: string): Promise<Buffer> {
    return this.inner.mac(value);
  }
  async destroyKey(keyRef: string): Promise<void> {
    this.cache.delete(keyRef);
    await this.inner.destroyKey(keyRef);
  }
  async generateDataKey(): Promise<DataKeyResult> {
    if (typeof this.inner.generateDataKey === 'function') {
      return this.inner.generateDataKey();
    }
    throw new PiiUnavailableError('inner provider does not support generateDataKey');
  }
  async decryptDataKey(wrappedDek: Buffer, keyId?: string): Promise<Buffer> {
    if (typeof this.inner.decryptDataKey === 'function') {
      return this.inner.decryptDataKey(wrappedDek, keyId);
    }
    throw new PiiUnavailableError('inner provider does not support decryptDataKey');
  }
  get size(): number {
    return this.cache.size;
  }
}

let current: { config: PiiConfig; provider: PiiKeyProvider | null } | null = null;

/** The process's provider, built once from the env; null when none is configured (plain mode only). */
export function piiKeys(): PiiKeyProvider | null {
  if (!current) {
    const config = readPiiConfig();
    const inner = createKeyProvider(config);
    current = { config, provider: inner ? new CachedKeyProvider(inner) : null };
  }
  return current.provider;
}

export function piiConfig(): PiiConfig {
  if (!current) piiKeys();
  return current!.config;
}

/** The provider, or PII_UNAVAILABLE when none is configured. */
export function requirePiiKeys(): PiiKeyProvider {
  const p = piiKeys();
  if (!p) throw new PiiUnavailableError('no key provider configured');
  return p;
}

/** Tests: use this provider and mode instead of the env. `null` resets to the env on next use. */
export function setPiiKeysForTests(provider: PiiKeyProvider | null, writeMode: PiiWriteMode = 'plain'): void {
  current = provider ? { config: { provider: provider.kind, writeMode }, provider } : null;
}
