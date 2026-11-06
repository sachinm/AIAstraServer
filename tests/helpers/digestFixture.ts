/**
 * A synthetic DigestView (docs/reading-engine/54 §2) built from the G1 fixture dossier, so a test can compare the digest
 * path of the evidence pack with the dossier path field by field. Test-only: it copies dossier fields into the digest's
 * card shapes; it is not the digest builder.
 */
import type { Dossier } from '../../src/reading/facts/types.js';
import type { AnnualRow, DigestView, HouseCard, PlanetCard, PointRow, YogaRow } from '../../src/reading/digest/types.js';

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export interface SyntheticDigest {
  houses?: Record<string, Record<number, Partial<HouseCard>>>;
  planets?: Record<string, Record<string, Partial<PlanetCard>>>;
  yogas?: YogaRow[];
  points?: PointRow[];
  vargas?: string[];
  annual?: AnnualRow[];
}

/** A DigestView over explicit rows (for the deterministic readers' tests). */
export function digestView(rows: SyntheticDigest, meta: { kundliId?: string; version?: string; builtAt?: string | null } = {}): DigestView {
  const house = (v: string, h: number): HouseCard | null => {
    const c = rows.houses?.[v]?.[h];
    return c ? ({ varga: v, house: h, sign: null, lord: null, lordHouse: null, lordSign: null, lordDignity: null, coLord: null, occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: [], cuspStar: null, arudha: null, ...c } as HouseCard) : null;
  };
  const planet = (v: string, p: string): PlanetCard | null => {
    const c = rows.planets?.[v]?.[p];
    return c
      ? ({ varga: v, planet: p, sign: null, house: null, degree: null, star: null, pada: null, starLord: null, dignity: null, retro: null, combust: null, war: null, dispositor: null, dispositorHouse: null, chain: [], avasthas: {}, shadbalaRatio: null, shadbalaRank: null, natural: null, functional: null, owns: [], aspectsTo: [], aspectedBy: [], conjunctions: [], ...c } as PlanetCard)
      : null;
  };
  const vargas = rows.vargas ?? [...new Set(['D1', ...Object.keys(rows.houses ?? {}), ...Object.keys(rows.planets ?? {})])];
  return {
    kundliId: meta.kundliId ?? 'k-test',
    status: 'ready',
    version: meta.version ?? 'd1.test',
    builtAt: meta.builtAt ?? '2026-11-05T00:00:00.000Z',
    house,
    houses: (v) => Object.keys(rows.houses?.[v] ?? {}).map((h) => house(v, Number(h))!).filter(Boolean),
    planet,
    planets: (v) => Object.keys(rows.planets?.[v] ?? {}).map((p) => planet(v, p)!).filter(Boolean),
    vargas: () => vargas,
    yogas: () => rows.yogas ?? [],
    points: (v) => (rows.points ?? []).filter((p) => !v || p.varga === v),
    annual: (year) => (rows.annual ?? []).filter((a) => year == null || a.year === year),
    star: () => null,
    sourceOf: () => [],
  };
}

/** The G1 dossier as digest rows: D1 houses and planets, every varga's houses and planets, arudhas, karakas, yogas. */
export function digestFromDossier(d: Dossier): DigestView {
  const houses: NonNullable<SyntheticDigest['houses']> = { D1: {} };
  const planets: NonNullable<SyntheticDigest['planets']> = { D1: {} };
  for (const [hk, h] of Object.entries(d.houses)) {
    houses.D1![Number(hk)] = {
      sign: h.sign_name,
      lord: h.lord,
      lordHouse: h.lord_house,
      lordDignity: h.lord_dignity ?? null,
      coLord: h.co_lord ?? null,
      occupants: (h.occupants ?? []).map((p) => ({ planet: p, dignity: d.bodies[p]?.dignity ?? null, nature: null })),
      aspectedGraha: h.aspected_by?.graha ?? [],
      aspectedRasi: h.aspected_by?.rasi ?? [],
      argala: h.argala ? { primary: h.argala.primary, secondary: h.argala.secondary ?? [], obstructed: h.argala.obstructed_by } : null,
      sav: h.sav ?? null,
      class: h.class ?? [],
      cuspStar: h.cusp_nak ? { name: h.cusp_nak.name, lord: h.cusp_nak.lord, pada: h.cusp_nak.pada } : null,
    };
  }
  for (const [code, b] of Object.entries(d.bodies)) {
    if (!['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'].includes(code)) continue;
    planets.D1![code] = {
      sign: b.sign_name,
      house: b.house,
      degree: b.deg_in_sign,
      star: b.nak.name,
      pada: b.nak.pada,
      starLord: b.star_lord ?? b.nak.lord,
      dignity: b.dignity ?? null,
      retro: b.retro ?? false,
      combust: b.combust ?? false,
      dispositor: b.sign_lord ?? null,
      dispositorHouse: b.sign_lord_house ?? null,
      shadbalaRatio: b.shadbala?.ratio ?? null,
      shadbalaRank: b.shadbala?.rank ?? null,
      natural: b.nature?.natural ?? null,
      functional: b.nature?.functional ?? null,
      owns: b.owns ?? [],
      aspectsTo: b.aspects_to?.graha ?? [],
      aspectedBy: b.aspected_by?.graha ?? [],
      conjunctions: b.conj ?? [],
    };
  }
  for (const [key, v] of Object.entries(d.vargas ?? {})) {
    // D1 cards come from the dossier houses and bodies above; the D1 varga block repeats them in its own shape
    if (!v || key === 'D1') continue;
    houses[key] = {};
    planets[key] = {};
    for (const [hk, vh] of Object.entries(v.houses)) houses[key]![Number(hk)] = { sign: vh.sign as unknown as string, lord: vh.lord, occupants: vh.occupants.map((p) => ({ planet: p, dignity: v.planets[p]?.dignity ?? null, nature: null })) };
    // the varga lagna's lord and its house, as the digest's house 1 card carries them
    houses[key]![1] = { ...houses[key]![1], lord: v.lagna_lord, lordHouse: v.lagna_lord_house ?? null };
    for (const [code, vp] of Object.entries(v.planets)) planets[key]![code] = { sign: vp.sign as unknown as string, house: vp.house, dignity: vp.dignity };
  }
  const points: PointRow[] = [];
  for (const [k, a] of Object.entries(d.arudhas ?? {})) points.push({ id: k, varga: 'D1', sign: a.sign_name, house: a.house, lord: a.lord ?? null, lordHouse: null });
  for (const [k, s] of Object.entries(d.special_lagnas ?? {})) points.push({ id: k, varga: 'D1', sign: s.sign_name, house: s.house, lord: null, lordHouse: null });
  for (const [k, p] of Object.entries(d.karakas?.chara ?? {})) if (p && d.bodies[p]) points.push({ id: k, varga: 'D1', sign: d.bodies[p]!.sign_name, house: d.bodies[p]!.house, lord: null, lordHouse: null });
  const yogas: YogaRow[] = (d.yogas ?? []).map((y) => ({ id: slug(y.name), name: y.name, planets: y.planets, houses: y.houses, class: y.class, source: y.source ?? '' }));
  return digestView({ houses, planets, points, yogas, vargas: ['D1', ...Object.keys(d.vargas ?? {})] }, { kundliId: 'g1' });
}
