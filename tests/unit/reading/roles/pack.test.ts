/**
 * The roles pack (docs/techniques/13 §3, §6 step 1): selection only. The fixture follows the stored shapes printed by
 * scripts/roles-pack-shapes.ts on 2026-11-22 (keys only; values here are invented).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OPTIONAL_ENGINE_FIELDS, rolesPackFrom, type RolesPackSources } from '../../../../src/reading/roles/pack.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import type { PlanetCard } from '../../../../src/reading/digest/types.js';

const P = (id: number, name: string) => ({ id, name });

function card(planet: string, over: Partial<PlanetCard> = {}): PlanetCard {
  return {
    varga: 'D1', planet, sign: 'Virgo', house: 7, degree: 9.2, star: 'Hasta', pada: 2, starLord: 'Mo', dignity: 'neutral', retro: false, combust: false, war: false,
    dispositor: 'Me', dispositorHouse: 8, chain: ['Me', 'Ve'], avasthas: { baladi: 'mrita' }, shadbalaRatio: 1.1, shadbalaRank: 3, natural: 'benefic', functional: 'malefic',
    owns: [1, 10], aspectsTo: [1, 3, 11], aspectedBy: ['Sa'], conjunctions: ['Sa'], sunProximity: { distanceDeg: 4, classicalOrbDeg: 11, zone: 'combust' }, starChain: ['Mo'],
    ...over,
  };
}

const act = (system: string, level: 1 | 2, lord: string, from: string, to: string): ActivationRow => ({ system, family: 'vimshottari', level, lord, sign: null, from, to, houses: [7], parentLord: null });

function fixture(): RolesPackSources {
  return {
    items: {
      dignities: { planets: [{ ...P(4, 'Jupiter'), dignity: 'neutral', moolatrikona_sign: false, relation_to_sign_lord: 'enemy', sign_lord: P(3, 'Mercury'), sign_lord_dignity: 'debilitated', sign_lord_house: 8, combust: false, sun_separation_deg: 4.1, planetary_war_with: [], retrograde: true, motion_state: 'vakra', star: { name: 'Hasta', pada: 2, lord: P(1, 'Moon') } }] },
      relations: { orientation: 'row planet toward column planet', planets: [P(0, 'Sun'), P(4, 'Jupiter')], naisargika: [[null, 'friend'], ['friend', null]], tatkalika: [[null, 'enemy'], ['enemy', null]], panchadha: [[null, 'neutral'], ['neutral', null]] },
      benefic_malefic: { natural: { benefics: [P(4, 'Jupiter')], malefics: [P(6, 'Saturn')] }, functional: { benefics: [], malefics: [P(4, 'Jupiter')], neutrals: [], note: 'per pyjhora' }, maraka: { marakas: [P(4, 'Jupiter')], maraka_houses: [2, 7], maraka_house_lords: [P(4, 'Jupiter')] }, yogakaraka_pyjhora: [P(6, 'Saturn')], planets: [{ ...P(4, 'Jupiter'), maraka: true, functional_roles: ['kendra_lord'], houses_owned: [1, 10], kendra_lord: true, trikona_lord: false }] },
      'strength.vimsopaka': { schemes: { shadvarga: { max_score: 20, planets: [{ ...P(4, 'Jupiter'), score: 9.5, strong_varga_count: 2, strong_vargas: ['D1', 'D9'] }] } } },
      'strength.shadbala': { planets: [{ ...P(4, 'Jupiter'), ratio: 0.8, rank: 6, total_rupas: 5.1, required_rupas: 6.5 }] },
      'karaka.chara': [{ karaka_code: 'AmK', meaning: 'minister', planet: 'Jupiter' }],
      'dasha.applicable': [{ type: 'dasha.dwisatpathi', applies: true, checked: true, rule: 'checked by radha', facts: { lagna: 'Pisces' } }, { type: 'dasha.ashtottari', applies: false, checked: true, rule: 'x' }],
      facts: {
        birth: { date: '1980-01-01', time: '05:00', lat: 12.3, lon: 45.6, place: 'Somewhere' },
        bodies: { Ju: { ishta: 30.5, kashta: 12.25, flags: ['vargottama'], tara_from_janma: 'Pratyari', aspected_by: { graha: ['Sa'], rasi: [] } } },
        vargas: { D9: { planets: { Ju: { vargottama: true } } }, D10: { planets: { Ju: { vargottama: false } } } },
        nakshatra_profile: { janma: { name: 'Hasta', lord: 'Mo', pada: 2 }, taras_from_janma: { Chitra: 'Sampat', Swati: 'Pratyari' }, star_lords: { Ju: { tara: 'Pratyari' } } },
        relations: { marakas: ['Ju'], marakas_extended: ['Ju', 'Sa'], yogakaraka: null, functional: { benefic: [], malefic: ['Ju'], neutral: [] } },
      },
    },
    digest: {
      planets: [card('Ju')],
      houses: [{ varga: 'D1', house: 7, sign: 'Virgo', lord: 'Me', lordHouse: 8, lordSign: 'Libra', lordDignity: 'neutral', coLord: null, occupants: [], aspectedGraha: [], aspectedRasi: [], argala: { primary: ['Sa'], secondary: [], obstructed: ['Ve'] }, sav: 28, class: ['kendra'], cuspStar: null, arudha: 'Aries' }],
      points: [{ id: 'UL', varga: 'D1', sign: 'Aries', house: 2, lord: 'Ma', lordHouse: 9 }, { id: 'A7', varga: 'D1', sign: 'Leo', house: 6, lord: 'Su', lordHouse: 7 }],
      yogas: [{ id: 'neecha_bhanga', name: 'Neecha Bhanga Raja Yoga', planets: ['Ve'], houses: [6], class: 'raja', source: 'facts.yogas' }],
      star: null,
    },
    activation: [
      act('vimsottari', 1, 'Ju', '2020-01-01', '2036-01-01'),
      act('vimsottari', 2, 'Ju', '2020-01-01', '2022-03-01'),
      act('vimsottari', 2, 'Sa', '2022-03-01', '2026-12-01'),
      act('vimsottari', 1, 'Sa', '2036-01-01', '2055-01-01'),
      act('vimsottari', 2, 'Sa', '2036-01-01', '2039-01-01'),
      act('dwisatpathi', 1, 'Ve', '2018-01-01', '2028-01-01'),
      act('ashtottari', 1, 'Ma', '2018-01-01', '2028-01-01'),
      act('yogini', 1, 'Ma', '2018-01-01', '2028-01-01'),
    ],
  };
}

describe('roles pack', () => {
  const r = rolesPackFrom(fixture(), '2026-11-22');
  const ju = r.pack.natal.planets.Ju!;

  it('carries every per-planet field, as stored', () => {
    expect(ju).toMatchObject({ dignity: 'neutral', moolatrikonaSign: false, relationToSignLord: 'enemy', combust: false, sunSeparationDeg: 4.1, planetaryWarWith: [], retrograde: true, motionState: 'vakra', ishta: 30.5, kashta: 12.25, taraFromBirthStar: 'Pratyari', maraka: true, kendraLord: true });
    expect(ju.signLord).toEqual({ planet: 'Mercury', house: 8, dignity: 'debilitated' });
    expect(ju.vargottama).toEqual({ D9: true, D10: false });
    expect(ju.dossierFlags).toEqual(['vargottama']);
    expect(ju.vimshopaka).toEqual({ shadvarga: { score: 9.5, maxScore: 20, strongVargaCount: 2, strongVargas: ['D1', 'D9'] } });
    expect(ju.shadbala).toEqual({ ratio: 0.8, rank: 6, totalRupas: 5.1, requiredRupas: 6.5 });
    expect(ju.charaKaraka).toEqual([{ code: 'AmK', meaning: 'minister' }]);
    expect(ju.solarProximity).toEqual({ distanceDeg: 4, classicalOrbDeg: 11, zone: 'combust' });
    expect(ju.dispositorChain).toEqual(['Me', 'Ve']);
    expect(ju.starLordChain).toEqual(['Mo']);
    expect(ju.avasthas).toEqual({ baladi: 'mrita' });
  });

  it('carries friendships, benefics, yogas, taras, argala and the upapada', () => {
    expect(r.pack.natal.friendships).toMatchObject({ natural: { Sun: { Jupiter: 'friend' } }, temporary: { Jupiter: { Sun: 'enemy' } }, compound: { Sun: { Jupiter: 'neutral' } } });
    expect(r.pack.natal.beneficsAndMalefics).toMatchObject({ yogakaraka: ['Saturn'], maraka: { marakas: ['Jupiter'], houses: [2, 7] } });
    expect(r.pack.natal.yogas.map((y) => y.id)).toEqual(['neecha_bhanga']);
    expect(r.pack.natal.taras).toMatchObject({ fromBirthStar: { Swati: 'Pratyari' }, byPlanet: { Ju: 'Pratyari' } });
    expect(r.pack.natal.argala['7']).toEqual({ primary: ['Sa'], secondary: [], obstructed: ['Ve'] });
    expect(r.pack.natal.upapada?.sign).toBe('Aries');
  });

  it('selects the running and next maha dasha of the systems that apply, by date', () => {
    const ids = r.pack.dated.systems.map((s) => s.system);
    expect(ids).toContain('vimsottari');
    expect(ids).toContain('dwisatpathi');
    expect(ids).not.toContain('ashtottari');
    expect(ids).not.toContain('yogini');
    const v = r.pack.dated.systems.find((s) => s.system === 'vimsottari')!;
    expect(v.running?.period.lord).toBe('Ju');
    expect(v.running?.subPeriods.map((x) => x.lord)).toEqual(['Ju', 'Sa']);
    expect(v.running?.runningSub?.lord).toBe('Sa');
    expect(v.next?.period.lord).toBe('Sa');
    expect(v.next?.subPeriods.map((x) => x.lord)).toEqual(['Sa']);
  });

  it('names missing engine fields and never fills them in', () => {
    for (const f of OPTIONAL_ENGINE_FIELDS) expect(r.pack.missing).toContain(f.name);
    expect(r.pack.missing).toEqual(expect.arrayContaining(['upapada_2nd', 'upapada_7th', 'badhaka']));
    expect(r.pack.natal.optional).toEqual({});
  });

  it('reads an optional field when a stored row has it', () => {
    const src = fixture();
    (src.items as Record<string, unknown>).sphutas = { sphutas: [], yogi_planet: 'Ve' };
    const x = rolesPackFrom(src, '2026-11-22');
    expect(x.pack.natal.optional.yogi).toEqual({ value: 'Ve', from: 'sphutas.yogi_planet' });
    expect(x.pack.missing).not.toContain('yogi');
  });

  it('holds no birth data and no engine name', () => {
    const text = JSON.stringify(r.pack);
    for (const k of ['"lat"', '"lon"', '"birth"', '1980-01-01', 'Somewhere']) expect(text).not.toContain(k);
    expect(text.toLowerCase()).not.toContain('pyjhora');
    expect(text.toLowerCase()).not.toContain('radha');
  });

  it('has a stable hash', () => {
    const again = rolesPackFrom(fixture(), '2026-11-22');
    expect(again.hash).toBe(r.hash);
    expect(rolesPackFrom(fixture(), '2026-11-23').hash).toBe(r.hash);
    expect(r.hash).toHaveLength(24);
  });
});

describe('roles pack source: selection only (doc 13 §3)', () => {
  const file = path.resolve(__dirname, '../../../../src/reading/roles/pack.ts');
  /** source without comments and string contents, so a doc line or a path in a string is not a hit */
  const code = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const bare = code.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");

  it('imports nothing from the Node astrology layers', () => {
    const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2]!);
    const banned = ['area/houseLayers', 'area/career', 'dasha/dashaAssessment', 'self/sub/promise', 'dasha/retrogradeRules'];
    expect(imports.filter((i) => banned.some((b) => i.includes(b)))).toEqual([]);
  });

  it('uses no RegExp', () => {
    expect(bare).not.toMatch(/\bRegExp\b/);
    expect(bare).not.toMatch(/\.(test|match|matchAll|search)\(/);
    expect(bare).not.toMatch(/(^|[=(,:!&|?;{}\[]|return)\s*\/(?![/*\s])[^/\n]+\/[dgimsuy]*/m);
  });
});
