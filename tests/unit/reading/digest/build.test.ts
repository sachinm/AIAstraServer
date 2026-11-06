import { describe, expect, it } from 'vitest';
import { buildDigestRows, planetCode, resolvePath, vargaCoverage } from '../../../../src/reading/digest/build.js';
import { itemKey, type AnnualRow, type HouseCard, type PlanetCard, type PointRow, type YogaRow } from '../../../../src/reading/digest/types.js';
import { loadFixture } from './helpers.js';

const fx = loadFixture();
const rows = buildDigestRows(fx.items, { kundliId: 'fixture-a', calcVersions: fx.calcVersions });
const byKey = new Map(rows.map((r) => [`${r.section}|${r.key}`, r]));
const get = <T>(section: string, key: string) => byKey.get(`${section}|${key}`)?.row as T | undefined;

describe('buildDigestRows on a research kundli', () => {
  it('writes every section', () => {
    const sections = new Set(rows.map((r) => r.section));
    expect([...sections].sort()).toEqual(['annual', 'house', 'planet', 'point', 'star', 'yoga']);
  });

  it('every row has a source, and every source path resolves in the input it names', () => {
    for (const r of rows) {
      expect(r.source.length, r.key).toBeGreaterThan(0);
      for (const s of r.source) {
        const payload = fx.items[itemKey(s.type, s.variant)];
        expect(payload, `${r.key}: ${s.type}@${s.variant}`).toBeDefined();
        expect(resolvePath(payload, s.path), `${r.key}: ${s.type} ${s.path}`).not.toBeUndefined();
        expect(s.calcVersion, `${r.key}: ${s.type}`).toBe(fx.calcVersions[itemKey(s.type, s.variant)] ?? null);
      }
    }
  });

  it('keys are unique per section and the build is pure (same input, same rows)', () => {
    expect(byKey.size).toBe(rows.length);
    expect(buildDigestRows(structuredClone(fx.items), { kundliId: 'fixture-a', calcVersions: fx.calcVersions })).toEqual(rows);
  });

  it('D1 house cards are the engine house table joined with aspects, argala, arudhas, SAV and class', () => {
    const tables = fx.items.dignities as { houses: Array<{ house: number; sign: string; lord: { name: string }; lord_house: number; lord_dignity: string; occupants: Array<{ name: string }> }> };
    for (let h = 1; h <= 12; h++) {
      const card = get<HouseCard>('house', `D1.h${h}`)!;
      const raw = tables.houses.find((x) => x.house === h)!;
      expect(card.sign).toBe(raw.sign);
      expect(card.lord).toBe(planetCode(raw.lord));
      expect(card.lordHouse).toBe(raw.lord_house);
      expect(card.lordDignity).toBe(raw.lord_dignity);
      expect(card.occupants.map((o) => o.planet)).toEqual(raw.occupants.map((o) => planetCode(o)));
      expect(card.sav).toBe((fx.items.ashtakavarga as { sav_by_house: number[] }).sav_by_house[h - 1]);
      expect(card.class).toEqual((fx.items.house_counts as { house_class: Record<string, string[]> }).house_class[String(h)]);
      const graha = (fx.items.aspects as { graha_drishti: Array<{ name: string; aspected_houses: number[] }> }).graha_drishti.filter((g) => g.aspected_houses.includes(h)).map((g) => planetCode(g.name));
      expect(card.aspectedGraha).toEqual(graha);
      expect(card.argala).not.toBeNull();
      expect(card.cuspStar?.name).toBeTruthy();
    }
  });

  it('a varga with dignities.dN gets house and planet cards; a varga with placement rows only gets planet cards and no house', () => {
    const cov = vargaCoverage(fx.items);
    expect(cov.full).toEqual(expect.arrayContaining([1, 9]));
    expect(get<HouseCard>('house', 'D9.h7')?.sign).toBeTruthy();
    expect(get<PlanetCard>('planet', 'D9.Ve')?.dignity).toBeTruthy();
    // D16 is not in the dossier's vargas and has no dignities.d16: placement rows only
    expect(cov.placementOnly).toContain(16);
    expect(rows.filter((r) => r.section === 'house' && r.key.startsWith('D16.'))).toEqual([]);
    const su16 = get<PlanetCard>('planet', 'D16.Su')!;
    expect(su16.sign).toBeTruthy();
    expect(su16.house).toBeNull();
  });

  it('vargas in the dossier only (D3, D12 …) get house cards from the dossier', () => {
    const cov = vargaCoverage(fx.items);
    expect(cov.dossier).toEqual(expect.arrayContaining([3, 12]));
    const h = get<HouseCard>('house', 'D12.h1')!;
    expect(h.lord).toBeTruthy();
    expect(byKey.get('house|D12.h1')!.source[0]!.type).toBe('facts');
  });

  it('D1 planet cards carry the dispositor chain, avasthas, shadbala and nature', () => {
    const mo = get<PlanetCard>('planet', 'D1.Mo')!;
    expect(mo.chain[0]).toBe('Mo');
    expect(Object.keys(mo.avasthas).length).toBeGreaterThan(0);
    expect(mo.shadbalaRank).not.toBeNull();
    expect(mo.natural).toBeTruthy();
    expect(mo.owns.length).toBeGreaterThan(0);
    const ra = get<PlanetCard>('planet', 'D1.Ra')!;
    expect(ra.shadbalaRank).toBeNull(); // shadbala has the seven grahas only
  });

  it('yogas: present ones only, one row per name', () => {
    const ys = rows.filter((r) => r.section === 'yoga').map((r) => r.row as YogaRow);
    const absent = (fx.items.yogas as { yogas: Array<{ name_en: string; present: boolean }> }).yogas.filter((y) => !y.present).map((y) => y.name_en.toLowerCase());
    for (const y of ys) expect(absent).not.toContain(y.name.toLowerCase());
    expect(new Set(ys.map((y) => y.name.toLowerCase())).size).toBe(ys.length);
    expect(ys.some((y) => y.class === 'dosha')).toBe(true);
  });

  it('points: chara karakas, A1..A12 with AL and UL, special points, sphutas', () => {
    for (const id of ['AK', 'DK', 'A1', 'A12', 'AL', 'UL', 'SL', 'HL', 'GL', 'IL']) expect(get<PointRow>('point', `D1.${id}`), id).toBeDefined();
    expect(get<PointRow>('point', 'D1.AL')).toMatchObject({ ...get<PointRow>('point', 'D1.A1'), id: 'AL' });
    expect(get<PointRow>('point', 'D9.AK')).toBeDefined();
    expect(rows.some((r) => r.section === 'point' && r.key.startsWith('D1.sphuta.'))).toBe(true);
  });

  it('annual rows for each stored year chart, with house cards, and sahams on the D1 Varsha row', () => {
    const vp = get<AnnualRow>('annual', 'VP2026.D1')!;
    expect(vp.lagna).toBeTruthy();
    expect(vp.houses).toHaveLength(12);
    expect(vp.sahams.length).toBeGreaterThan(0);
    expect(get<AnnualRow>('annual', 'VP2026.D9')?.houses).toHaveLength(12);
    expect(get<AnnualRow>('annual', 'TP2026.D1')?.kind).toBe('TP');
  });

  it('the year dashas of a D1 year row come from the stored year-dasha rows', () => {
    const items = { ...fx.items, 'annual.tithi_pravesha_dasha@year=2026;system=tithi_ashtottari': { system: 'tithi_ashtottari', periods: [{ lord: 'Sun', start: '2026-01-01', end: '2027-01-01', children: [] }] } };
    const tp = buildDigestRows(items, { kundliId: 'x' }).find((r) => r.key === 'TP2026.D1')!.row as AnnualRow;
    expect(tp.dashas).toEqual([{ system: 'tithi_ashtottari', periods: [{ lord: 'Su', from: '2026-01-01', to: '2027-01-01' }] }]);
  });

  it('the star profile comes from the dossier', () => {
    const s = get<{ moonStar: string; taras: unknown[] }>('star', 'profile')!;
    expect(s.moonStar).toBeTruthy();
    expect(s.taras).toHaveLength(27);
  });

  it('without the house table in dignities, D1 house cards come from the dossier', () => {
    const items = { ...fx.items, dignities: { planets: (fx.items.dignities as { planets: unknown }).planets } };
    const r = buildDigestRows(items, { kundliId: 'x' });
    const h1 = r.find((x) => x.key === 'D1.h1' && x.section === 'house')!;
    expect((h1.row as HouseCard).lord).toBe(get<HouseCard>('house', 'D1.h1')!.lord);
    expect(h1.source[0]).toMatchObject({ type: 'facts', path: 'houses.1' });
  });

  it('an empty input gives no rows', () => {
    expect(buildDigestRows({}, { kundliId: 'x' })).toEqual([]);
  });
});
