import { describe, expect, it } from 'vitest';
import { buildEvidencePack, listEvidenceIds, renderBase, resolveEvidence, SECTION_ORDER, mergeSubjectPacks } from '../../../src/reading/packs/selector.js';
import { buildFullContext, clearFullContexts } from '../../../src/reading/packs/fullPrefix.js';
import type { DigestPackSection } from '../../../src/reading/packs/digestSource.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';
import { digestFromDossier } from '../../helpers/digestFixture.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const digest = digestFromDossier(dossier);
const intent = { horizon: '1y' as const, mentionsPlanets: [], focusPoints: [] };

guardNoModelCalls();

describe('evidence pack from the digest (doc 53 §4.2): same sections, same field names, same values as the dossier path', () => {
  for (const subject of ['career_work', 'marriage_relationship', 'children', 'income_wealth', 'general_life_direction'] as const) {
    it(`${subject}: every dossier section is equal on the digest path; the digest adds only its own section`, () => {
      const viaDossier = buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent });
      const viaDigest = buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent, digest });
      for (const sec of SECTION_ORDER) {
        if (sec === 'digest') continue;
        expect(viaDigest.sections[sec], `${subject} ${sec}`).toEqual(viaDossier.sections[sec]);
      }
      expect(viaDossier.sections.digest).toBeUndefined();
      expect(viaDigest.sections.digest).toBeDefined();
      expect(viaDigest.keyFrame).toEqual(viaDossier.keyFrame);
      // every id of the dossier pack resolves on the digest pack to the same value
      for (const id of listEvidenceIds(viaDossier)) expect(resolveEvidence(viaDigest, id), id).toEqual(resolveEvidence(viaDossier, id));
    });
  }

  it('the cacheable base is the same bytes for every question about the kundli on the digest path', () => {
    const a = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent, digest });
    const b = buildEvidencePack({ dossier, transits, subject: 'children', asOf: G1_AS_OF, intent: { ...intent, horizon: '3m' }, digest });
    expect(renderBase(a)).toBe(renderBase(b));
  });

  it('where the digest has a value of its own, the pack carries it (field by field)', () => {
    const changed = { ...digest, house: (v: string, h: number) => {
      const c = digest.house(v, h);
      return c && v === 'D1' && h === 10 ? { ...c, sav: 99, lordDignity: 'exalted' } : c;
    } };
    const p = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent, digest: changed });
    expect(resolveEvidence(p, 'base.houses.10.sav')).toBe(99);
    expect(resolveEvidence(p, 'detail.houses.10.lord_dignity')).toBe('exalted');
    expect(resolveEvidence(p, 'detail.sav_frame.10')).toBe(99);
    // a field the digest card lacks keeps the dossier value
    expect(resolveEvidence(p, 'detail.houses.10.co_lord')).toEqual(resolveEvidence(buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent }), 'detail.houses.10.co_lord'));
  });

  it('the digest section holds the frame rows, keyed so an evidence id is the digest key', () => {
    const p = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent, digest });
    const d = p.sections.digest as DigestPackSection;
    expect(d.vargas).toEqual(['D1', 'D10']);
    // the frame houses, plus the houses its points sit in (for their class)
    expect(Object.keys(d.house.D1!)).toEqual(expect.arrayContaining(['h1', 'h10', 'h6']));
    expect(Object.keys(d.house.D10!).sort()).toEqual(['h1', 'h10', 'h6']);
    for (const lord of p.keyFrame.lords) expect(d.planet.D1![lord], lord).toBeDefined();
    expect(resolveEvidence(p, 'digest.house.D1.h10.lord')).toBe(dossier.houses['10']!.lord);
    expect(d.person).toBeNull();
    const love = buildEvidencePack({ dossier, transits, subject: 'marriage_relationship', asOf: G1_AS_OF, intent, digest });
    expect((love.sections.digest as DigestPackSection).person).toMatchObject({ who: 'spouse', houses: [7], varga: 'D9', karaka: 'Ve' });
    const named = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent, digest, person: { person: 'mother' } });
    expect((named.sections.digest as DigestPackSection).person).toMatchObject({ who: 'mother', houses: [4] });
  });

  it('the deeper vargas join for an explain question or a life horizon, when the digest holds them', () => {
    const deep = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent: { ...intent, questionType: 'why_meaning' }, digest });
    const held = digest.vargas();
    for (const v of ['D16', 'D20', 'D60']) if (held.includes(v) && ['D16', 'D20'].includes(v)) expect((deep.sections.digest as DigestPackSection).vargas).toContain(v);
  });

  it('merging subject packs keeps the merged bytes of the dossier path unchanged', () => {
    const a = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent });
    const b = buildEvidencePack({ dossier, transits, subject: 'income_wealth', asOf: G1_AS_OF, intent });
    expect(Object.keys(mergeSubjectPacks([a, b]).sections)).not.toContain('digest');
  });

  it('the full cache prefix renders from the digest with the same bytes as the dossier path for the same values', () => {
    clearFullContexts();
    const a = buildFullContext({ dossier, transits, asOf: G1_AS_OF, system: 'sys' }, 'k1');
    const b = buildFullContext({ dossier, transits, asOf: G1_AS_OF, system: 'sys', digest }, 'k1');
    expect(b.prefix).toBe(a.prefix);
    expect(b).not.toBe(a); // memoised separately: the digest version is in the key
    expect(buildFullContext({ dossier, transits, asOf: G1_AS_OF, system: 'sys', digest }, 'k1')).toBe(b);
  });

  it('populates dasha.activation, digest.rasi (Narayana + Chara) and multi-year annual set when activation and digest.annual rows exist', () => {
    const asOfYear = Number(G1_AS_OF.slice(0, 4));
    const annualDigest = {
      ...digest,
      annual: (year?: number) => {
        const rows = [
          {
            kind: 'TP' as const,
            year: asOfYear - 1,
            varga: 'D1',
            lagna: 'Leo',
            houses: [{ varga: 'D1', house: 10, sign: 'Taurus', lord: 'Ve', lordHouse: 1, lordSign: 'Leo', lordDignity: 'friend', coLord: null, occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: ['kendra'], cuspStar: null, arudha: null }],
            dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ve', from: `${asOfYear - 1}-05-01`, to: `${asOfYear - 1}-08-01` }] }],
            sahams: [{ name: 'karma', sign: 'Taurus', house: 10 }],
          },
          {
            kind: 'TP' as const,
            year: asOfYear,
            varga: 'D1',
            lagna: 'Scorpio',
            houses: [
              { varga: 'D1', house: 1, sign: 'Scorpio', lord: 'Ma', lordHouse: 10, lordSign: 'Leo', lordDignity: 'friend', coLord: 'Ke', occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: ['kendra'], cuspStar: null, arudha: null },
              { varga: 'D1', house: 10, sign: 'Leo', lord: 'Su', lordHouse: 10, lordSign: 'Leo', lordDignity: 'own', coLord: null, occupants: [{ planet: 'Su', dignity: 'own', nature: null }], aspectedGraha: ['Ju'], aspectedRasi: [], argala: null, sav: null, class: ['kendra'], cuspStar: null, arudha: null },
            ],
            dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Su', from: `${asOfYear}-01-01`, to: `${asOfYear}-12-31` }] }],
            sahams: [{ name: 'rajya', sign: 'Leo', house: 10 }],
            muntha: { sign: 'Leo', house: 10 },
            yearLord: 'Su',
            tajakaYogas: [{ id: 'ithasala', present: true }],
          },
          {
            kind: 'TP' as const,
            year: asOfYear,
            varga: 'D10',
            lagna: 'Aries',
            houses: [{ varga: 'D10', house: 10, sign: 'Capricorn', lord: 'Sa', lordHouse: 10, lordSign: 'Capricorn', lordDignity: 'own', coLord: null, occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: ['kendra'], cuspStar: null, arudha: null }],
            dashas: [],
            sahams: [],
          },
          {
            kind: 'VP' as const,
            year: asOfYear + 1,
            varga: 'D1',
            lagna: 'Sagittarius',
            houses: [{ varga: 'D1', house: 10, sign: 'Virgo', lord: 'Me', lordHouse: 10, lordSign: 'Virgo', lordDignity: 'exalted', coLord: null, occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: ['kendra'], cuspStar: null, arudha: null }],
            dashas: [],
            sahams: [],
          },
        ];
        return rows.filter((r) => year == null || r.year === year);
      },
    };
    const h10Sign = digest.house('D1', 10)!.sign!;
    const activation = [
      { system: 'dwisatpathi', family: 'conditional' as const, level: 2 as const, lord: 'Ju', sign: null, from: '2026-01-01', to: '2026-09-01', houses: [10, 1], parentLord: 'Me' },
      { system: 'chara', family: 'rasi' as const, level: 2 as const, lord: null, sign: h10Sign, from: '2026-02-01', to: '2026-11-01', houses: [10], parentLord: 'Aries' },
    ];
    const p = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent, digest: annualDigest, activation });
    expect(resolveEvidence(p, 'dasha.activation.dwisatpathi_Ju_2026-01-01.family')).toBe('conditional');
    expect(resolveEvidence(p, `digest.rasi.chara_${h10Sign}_2026-02-01.system`)).toBe('chara');
    expect(resolveEvidence(p, 'annual.year_used')).toBe(asOfYear);
    expect(resolveEvidence(p, `annual.years.TP${asOfYear}_D1.yearLord`)).toBe('Su');
    expect(resolveEvidence(p, `annual.years.TP${asOfYear}_D10.varga`)).toBe('D10');
    expect(resolveEvidence(p, `annual.years.TP${asOfYear - 1}_D1.year`)).toBe(asOfYear - 1);
    expect(resolveEvidence(p, `annual.years.VP${asOfYear + 1}_D1.kind`)).toBe('VP');
    expect(resolveEvidence(p, `digest.annual.TP${asOfYear}_D1.yearLord`)).toBe('Su');
  });
});
