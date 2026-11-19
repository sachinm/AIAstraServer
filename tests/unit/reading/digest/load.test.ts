import { beforeEach, describe, expect, it } from 'vitest';
import { buildDigestRows } from '../../../../src/reading/digest/build.js';
import { clearDigestMemo, digestView, loadDigest } from '../../../../src/reading/digest/load.js';
import { DIGEST_VERSION } from '../../../../src/reading/digest/types.js';
import { fakeDigestPrisma, loadFixture } from './helpers.js';

const fx = loadFixture();
const rows = buildDigestRows(fx.items, { kundliId: 'k1', calcVersions: fx.calcVersions });
const stored = rows.map((r) => ({ kundli_id: 'k1', section: r.section, key: r.key, row: r.row, source: r.source }));

beforeEach(() => clearDigestMemo());

describe('DigestView getters', () => {
  const v = digestView('k1', stored);

  it('house, houses, planet, planets', () => {
    expect(v.house('D1', 7)?.house).toBe(7);
    expect(v.house('D1', 13)).toBeNull();
    expect(v.houses('D1').map((h) => h.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(v.houses('D9')).toHaveLength(12);
    expect(v.planet('D1', 'Ju')?.planet).toBe('Ju');
    expect(v.planet('D1', 'Xx')).toBeNull();
    expect(v.planets('D1')).toHaveLength(9);
  });

  it('vargas in factor order', () => {
    const vs = v.vargas();
    expect(vs[0]).toBe('D1');
    expect(vs.indexOf('D9')).toBeLessThan(vs.indexOf('D16'));
  });

  it('yogas, points by varga, annual by year, star, sourceOf', () => {
    expect(v.yogas().length).toBeGreaterThan(0);
    expect(v.points('D1').every((p) => p.varga === 'D1')).toBe(true);
    expect(v.points().length).toBeGreaterThan(v.points('D1').length);
    expect(v.annual(2026).every((a) => a.year === 2026)).toBe(true);
    expect(v.annual(2026)[0]).toMatchObject({ kind: 'TP', varga: 'D1' });
    expect(v.annual(1999)).toEqual([]);
    expect(v.star()?.moonStar).toBeTruthy();
    expect(v.sourceOf('house', 'D1.h1')[0]).toMatchObject({ type: 'dignities', path: 'houses[0]' });
    expect(v.sourceOf('house', 'nope')).toEqual([]);
  });
});

describe('loadDigest', () => {
  const builtAt = new Date('2026-11-06T00:00:00Z');

  it('returns null unless the digest is ready and of this version', async () => {
    for (const k of [{ digest_status: 'building' }, { digest_status: 'stale' }, { digest_status: 'ready', digest_version: 'd0.old' }, { digest_status: 'pending' }]) {
      const { prisma } = fakeDigestPrisma({ kundlis: [{ id: 'k1', digest_built_at: builtAt, digest_version: DIGEST_VERSION, ...k }] });
      expect(await loadDigest(prisma as never, 'k1')).toBeNull();
    }
    const { prisma } = fakeDigestPrisma();
    expect(await loadDigest(prisma as never, 'missing')).toBeNull();
  });

  it('reads the rows once and memoises by kundli and built_at for five minutes', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1', digest_status: 'ready', digest_version: DIGEST_VERSION, digest_built_at: builtAt }] });
    f.digest.push(...stored);
    const t = Date.parse('2026-11-06T01:00:00Z');
    const a = await loadDigest(f.prisma as never, 'k1', t);
    const b = await loadDigest(f.prisma as never, 'k1', t + 60_000);
    expect(a?.house('D1', 1)).toEqual(b?.house('D1', 1));
    expect(a?.builtAt).toBe(builtAt.toISOString());
    expect(f.calls.digestFindMany).toBe(1);
    await loadDigest(f.prisma as never, 'k1', t + 6 * 60_000);
    expect(f.calls.digestFindMany).toBe(2);
    // a new build (new built_at) is read at once
    f.kundlis.get('k1')!.digest_built_at = new Date('2026-11-06T02:00:00Z');
    await loadDigest(f.prisma as never, 'k1', t + 6 * 60_000 + 1);
    expect(f.calls.digestFindMany).toBe(3);
  });

  it('does not read the source column unless asked; the two views are memoised apart and give the same rows', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1', digest_status: 'ready', digest_version: DIGEST_VERSION, digest_built_at: builtAt }] });
    f.digest.push(...stored);
    const selects: unknown[] = [];
    const real = f.prisma.kundliDigest.findMany;
    f.prisma.kundliDigest.findMany = (async (q: { where: Record<string, unknown>; select?: unknown }) => (selects.push(q.select), real(q))) as typeof real;
    const t = Date.parse('2026-11-06T01:00:00Z');
    const plain = await loadDigest(f.prisma as never, 'k1', t);
    expect(selects[0]).toEqual({ section: true, key: true, row: true });
    expect(plain?.sourceOf('house', 'D1.h1')).toEqual([]);
    // a caller that asks for sources is never served the view without them
    const full = await loadDigest(f.prisma as never, 'k1', t + 1, { withSource: true });
    expect(selects[1]).toEqual({ section: true, key: true, row: true, source: true });
    expect(full?.sourceOf('house', 'D1.h1')[0]).toMatchObject({ type: 'dignities', path: 'houses[0]' });
    // the rows a reader uses are the same either way (every section, every annual year)
    expect(plain?.annual()).toEqual(full?.annual());
    expect(plain?.houses('D9')).toEqual(full?.houses('D9'));
    expect(plain?.yogas()).toEqual(full?.yogas());
    // both stay memoised for this build
    await loadDigest(f.prisma as never, 'k1', t + 2);
    await loadDigest(f.prisma as never, 'k1', t + 3, { withSource: true });
    expect(selects).toHaveLength(2);
  });
});
