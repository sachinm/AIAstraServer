import { describe, expect, it } from 'vitest';
import { buildDigest, digestErrorType } from '../../../../src/reading/digest/build.js';
import { digestStatusOf, effectiveStatus, markDigestInputsChanged } from '../../../../src/reading/digest/status.js';
import { DIGEST_VERSION } from '../../../../src/reading/digest/types.js';
import { fakeDigestPrisma, fixtureDataRows, loadFixture } from './helpers.js';

const fx = loadFixture();
const data = fixtureDataRows(fx);

describe('digest status transitions', () => {
  it('pending -> building -> ready, with version, built_at, rows and activation written in one transaction', async () => {
    const seen: string[] = [];
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data, dossier: fx.items.facts, onReadData: () => seen.push(String(f.kundlis.get('k1')!.digest_status)) });
    const r = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(seen).toEqual(['building']);
    expect(r.status).toBe('ready');
    expect(r.rows).toBe(f.digest.length);
    expect(r.activation).toBe(f.activation.length);
    expect(r.activation).toBeGreaterThan(0);
    expect(f.calls.transactions).toBe(1);
    const k = f.kundlis.get('k1')!;
    expect(k).toMatchObject({ digest_status: 'ready', digest_version: DIGEST_VERSION, digest_error: null });
    expect(k.digest_built_at).toBeInstanceOf(Date);
    expect(f.digest.every((d) => d.digest_version === DIGEST_VERSION && d.built_at === k.digest_built_at)).toBe(true);
  });

  it('is idempotent: a second build replaces the rows, it does not add to them', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data, dossier: fx.items.facts });
    const a = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    const b = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(b.rows).toBe(a.rows);
    expect(f.digest).toHaveLength(a.rows);
    expect(f.activation).toHaveLength(a.activation);
  });

  it('a rebuild asked for during the build (status back to pending) is not overwritten by ready', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data, dossier: fx.items.facts, onReadData: () => (f.kundlis.get('k1')!.digest_status = 'pending') });
    const r = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(r.status).toBe('ready');
    expect(f.kundlis.get('k1')!.digest_status).toBe('pending');
  });

  it('no stored D1 tables: failed with the error type only', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data: [] });
    const r = await buildDigest(f.prisma as never, 'k1');
    expect(r).toMatchObject({ status: 'failed', error: 'DigestInputError' });
    expect(f.kundlis.get('k1')).toMatchObject({ digest_status: 'failed', digest_error: 'DigestInputError' });
  });

  it('a database error is stamped with its code, and the old rows stay', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data, dossier: fx.items.facts });
    f.digest.push({ kundli_id: 'k1', section: 'house', key: 'old', row: {}, source: [] });
    f.prisma.$transaction = async () => {
      throw Object.assign(new Error('boom'), { code: 'P2034' });
    };
    const r = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(r).toMatchObject({ status: 'failed', error: 'P2034' });
    expect(f.kundlis.get('k1')!.digest_status).toBe('failed');
    expect(f.digest).toHaveLength(1);
  });

  it('an unknown kundli is reported, nothing written', async () => {
    const f = fakeDigestPrisma();
    expect(await buildDigest(f.prisma as never, 'nope')).toMatchObject({ status: 'failed', error: 'NotFound' });
  });

  it('new inputs: ready -> stale, failed -> pending; pending and building stay', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'a', digest_status: 'ready' }, { id: 'b', digest_status: 'failed', digest_error: 'X' }, { id: 'c', digest_status: 'building' }, { id: 'd', digest_status: 'pending' }] });
    for (const id of ['a', 'b', 'c', 'd']) await markDigestInputsChanged(f.prisma as never, id);
    expect(['a', 'b', 'c', 'd'].map((id) => f.kundlis.get(id)!.digest_status)).toEqual(['stale', 'pending', 'building', 'pending']);
    expect(f.kundlis.get('b')!.digest_error).toBeNull();
  });

  it('a ready digest of another version reads as stale', async () => {
    expect(effectiveStatus('ready', DIGEST_VERSION)).toBe('ready');
    expect(effectiveStatus('ready', 'd0')).toBe('stale');
    expect(effectiveStatus('weird', null)).toBe('pending');
    const f = fakeDigestPrisma({ kundlis: [{ id: 'a', digest_status: 'ready', digest_version: 'd0' }] });
    expect(await digestStatusOf(f.prisma as never, 'a')).toEqual({ status: 'stale', version: 'd0' });
    expect(await digestStatusOf(f.prisma as never, 'zz')).toEqual({ status: 'pending', version: null });
  });

  it('error types carry no message text', () => {
    expect(digestErrorType(Object.assign(new Error('secret detail'), { code: 'P2002' }))).toBe('P2002');
    expect(digestErrorType(new TypeError('secret detail'))).toBe('TypeError');
    expect(digestErrorType(new Error('secret detail'))).toBe('Error');
  });
});
