import { describe, expect, it } from 'vitest';
import { buildEvidencePack, resolveEvidence, type EvidencePack } from '../../../src/reading/packs/selector.js';
import { jaimini, personReader, runCodeReaders, strengthYoga, toFinding, toReaderOutput, vargaDynamics, CODE_ANALYSTS } from '../../../src/reading/codeReaders/readers.js';
import { CODE_READER_RULES, dignityClass, houseClassOf, MAX_CODE_CLAIMS, scoreOf, verdictOf } from '../../../src/reading/codeReaders/rules.js';
import { digestSection } from '../../../src/reading/packs/digestSource.js';
import { reconcile } from '../../../src/reading/nodes/reconcile.js';
import { buildBrief, groundReader, layerOf } from '../../../src/reading/oracle/brief.js';
import type { Intent } from '../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';
import { digestFromDossier, digestView } from '../../helpers/digestFixture.js';

guardNoModelCalls();

/** A career pack over a hand-made digest: houses 10, 6, 1 with lords Me, Sa, Ma. */
function careerPack(over: Parameters<typeof digestView>[0] = {}): EvidencePack {
  const view = digestView({
    houses: {
      D1: {
        10: { lord: 'Me', lordDignity: 'exalted', occupants: [{ planet: 'Su', dignity: 'friend', nature: null }], sav: 31, class: ['kendra'], argala: { primary: ['Ju', 'Ve'], secondary: [], obstructed: ['Sa'] } },
        6: { lord: 'Sa', lordDignity: 'debilitated', occupants: [], sav: 20, class: ['dusthana', 'upachaya'], argala: { primary: ['Ma'], secondary: [], obstructed: ['Ra'] } },
        1: { lord: 'Ma', lordDignity: 'own', occupants: [], sav: 25, class: ['kendra', 'trikona'] },
        4: { lord: 'Mo', lordDignity: 'friend', class: ['kendra'] },
        8: { lord: 'Ju', class: ['dusthana'] },
      },
      D10: { 10: { lord: 'Ju', occupants: [{ planet: 'Su', dignity: 'neutral', nature: null }] }, 6: { lord: 'Ve' }, 1: { lord: 'Sa' } },
    },
    planets: {
      D1: { Me: { dignity: 'exalted', shadbalaRatio: 1.3, shadbalaRank: 2 }, Sa: { dignity: 'debilitated', shadbalaRatio: 0.8, shadbalaRank: 7 }, Ma: { dignity: 'own', shadbalaRatio: 1.1, shadbalaRank: 3 } },
      D10: { Me: { dignity: 'own' }, Sa: { dignity: 'exalted' }, Ma: { dignity: 'enemy' } },
    },
    yogas: [
      { id: 'bhadra', name: 'Bhadra', planets: ['Me'], houses: [10], class: 'mahapurusha', source: 'r' },
      { id: 'kala.sarpa', name: 'Kala Sarpa', planets: ['Ra', 'Ke'], houses: [6, 12], class: 'dosha', source: 'r' },
      { id: 'far', name: 'Far away', planets: ['Ve'], houses: [3], class: 'raja', source: 'r' },
    ],
    points: [
      { id: 'AmK', varga: 'D1', sign: 'Leo', house: 4, lord: 'Su', lordHouse: 10 },
      { id: 'AK', varga: 'D1', sign: 'Sc', house: 8, lord: 'Ma', lordHouse: 1 },
      { id: 'AL', varga: 'D1', sign: 'Ar', house: 10, lord: 'Ma', lordHouse: 1 },
      { id: 'A7', varga: 'D1', sign: 'Ge', house: 3, lord: 'Me', lordHouse: 10 },
    ],
    vargas: ['D1', 'D10'],
    ...over,
  });
  const digest = digestSection(view, { houses: [10, 6, 1], planets: ['Me', 'Sa', 'Ma'], vargas: ['D10'], points: ['AmK', 'A10', 'AL'], deep: false, person: null });
  return { subject: 'career_work', sections: { digest }, keyFrame: { houses: [10, 6, 1], lords: ['Me', 'Sa', 'Ma'], karakas: [], vargas: ['D10'] }, missing: [], stats: { approxTokens: 0, transitRowsDropped: 0 } };
}

const resolvesAll = (pack: EvidencePack, ids: string[]) => ids.every((id) => resolveEvidence(pack, id) !== undefined);

describe('rules', () => {
  it('dignity and house classes from engine labels', () => {
    expect(dignityClass('Exalted')).toBe('strong');
    expect(dignityClass('moolatrikona')).toBe('strong');
    expect(dignityClass('own sign')).toBe('strong');
    expect(dignityClass('Debilitated')).toBe('weak');
    expect(dignityClass('friend')).toBe('other');
    expect(dignityClass(null)).toBe('other');
    expect(houseClassOf(['dusthana', 'upachaya'])).toBe('hard');
    expect(houseClassOf(['Kendra'])).toBe('good');
    expect(houseClassOf([])).toBe('other');
  });
  it('every rule has a source, a side and a weight of 1 to 3', () => {
    for (const r of Object.values(CODE_READER_RULES)) {
      expect(r.source).toMatch(/BPHS|PVR|Jaimini|doc 33/);
      expect(['supports', 'obstructs', 'neutral']).toContain(r.polarity);
      expect(r.weight).toBeGreaterThanOrEqual(1);
      expect(r.weight).toBeLessThanOrEqual(3);
    }
    expect(scoreOf([{ polarity: 'supports', weight: 2 }, { polarity: 'supports', weight: 2 }, { polarity: 'obstructs', weight: 1 }])).toBe(1);
    expect(scoreOf(Array.from({ length: 8 }, () => ({ polarity: 'supports' as const, weight: 2 })))).toBe(3);
    expect(verdictOf(0, 0)).toBe('mixed');
    expect(verdictOf(2, 3)).toBe('strong');
    expect(verdictOf(-1, 3)).toBe('weak');
  });
});

describe('deterministic readers on a synthetic digest', () => {
  const pack = careerPack();

  it('varga dynamics: agreement supports w2, disagreement neutral w1, repeated occupants neutral w1', () => {
    const f = vargaDynamics(pack);
    const byRule = (r: string) => f.claims.filter((c) => c.rule === r);
    expect(byRule('varga_agree_strong').map((c) => c.topic)).toEqual(['house 10']);
    expect(byRule('varga_agree_strong')[0]).toMatchObject({ polarity: 'supports', weight: 2, evidence: ['digest.planet.D1.Me.dignity', 'digest.planet.D10.Me.dignity'] });
    expect(byRule('varga_disagree')).toHaveLength(1);
    expect(byRule('varga_disagree')[0]).toMatchObject({ polarity: 'neutral', weight: 1, topic: 'house 6' });
    expect(byRule('varga_occupant_repeats')).toHaveLength(1);
    expect(byRule('varga_occupant_repeats')[0]!.text).toContain('Su occupies house 10');
    expect(resolvesAll(pack, f.claims.flatMap((c) => c.evidence))).toBe(true);
  });

  it('strength and yogas: present yogas w2 (dosha obstructs), SAV by 28/22, shadbala ratio by 1', () => {
    const f = strengthYoga(pack);
    const rules = f.claims.map((c) => c.rule);
    expect(rules).toContain('yoga_present');
    expect(rules).toContain('dosha_present');
    expect(f.claims.find((c) => c.rule === 'dosha_present')).toMatchObject({ polarity: 'obstructs', weight: 2, evidence: ['digest.yoga.D1.kala_sarpa.name'] });
    expect(f.claims.some((c) => c.text.includes('Far away'))).toBe(false);
    expect(f.claims.filter((c) => c.rule === 'sav_high').map((c) => c.topic)).toEqual(['house 10']);
    expect(f.claims.filter((c) => c.rule === 'sav_low').map((c) => c.topic)).toEqual(['house 6']);
    expect(f.claims.filter((c) => c.rule === 'shadbala_short').map((c) => c.topic)).toEqual(['Sa']);
    expect(f.claims.length).toBeLessThanOrEqual(MAX_CODE_CLAIMS);
    // heaviest first
    expect(f.claims.map((c) => c.weight)).toEqual([...f.claims.map((c) => c.weight)].sort((a, b) => b - a));
    expect(resolvesAll(pack, f.claims.flatMap((c) => c.evidence))).toBe(true);
    expect(toReaderOutput(f).graces.map((g) => g.text)[0]).toContain('Bhadra');
  });

  it('jaimini: points by house class, argala holds or is obstructed', () => {
    const f = jaimini(pack);
    expect(f.claims.every((c) => c.tradition === 'jaimini')).toBe(true);
    expect(f.claims.find((c) => c.topic === 'AK')).toMatchObject({ rule: 'house_class_hard', polarity: 'obstructs' });
    expect(f.claims.find((c) => c.topic === 'AmK')).toMatchObject({ rule: 'house_class_good', polarity: 'supports' });
    expect(f.claims.find((c) => c.topic === 'AL')).toMatchObject({ rule: 'house_class_good' });
    expect(f.claims.find((c) => c.topic === 'house 10')).toMatchObject({ rule: 'argala_holds', polarity: 'supports', weight: 1 });
    expect(f.claims.find((c) => c.topic === 'house 6')).toMatchObject({ rule: 'argala_blocked', polarity: 'neutral' });
    expect(resolvesAll(pack, f.claims.flatMap((c) => c.evidence))).toBe(true);
  });

  it('jaimini cites Narayana/Chara rasi periods when rasiPeriods or activation rows are present in digestSection', () => {
    const view = digestView({
      houses: { D1: { 10: { sign: 'Aries', lord: 'Ma', class: ['kendra'] }, 6: { sign: 'Sagittarius', lord: 'Ju', class: ['dusthana'] } } },
      vargas: ['D1'],
    });
    const digest = digestSection(view, {
      houses: [10, 6],
      planets: ['Ma', 'Ju'],
      vargas: [],
      points: [],
      deep: false,
      person: null,
      rasiPeriods: [{ system: 'narayana', sign: 'Aries', lord: 'Ma', from: '2026-01-01', to: '2027-01-01' }],
      activation: [{ system: 'chara', family: 'rasi', level: 2, lord: null, sign: 'Sagittarius', from: '2026-03-01', to: '2026-09-01', houses: [6], parentLord: 'Aries' }],
    });
    const p: EvidencePack = { ...pack, sections: { digest }, keyFrame: { houses: [10, 6], lords: ['Ma', 'Ju'], karakas: [], vargas: [] } };
    const f = jaimini(p);
    expect(f.claims.filter((c) => c.rule === 'rasi_period_active')).toHaveLength(2);
    expect(f.claims.some((c) => c.text.includes('Narayana rasi period Aries'))).toBe(true);
    expect(f.claims.some((c) => c.text.includes('Chara rasi period Sagittarius'))).toBe(true);
    expect(resolvesAll(p, f.claims.flatMap((c) => c.evidence))).toBe(true);
  });

  it('person: only with a person; claims are about the person', () => {
    expect(personReader(pack).claims).toEqual([]);
    const view = digestView({
      houses: { D1: { 4: { lord: 'Mo', lordDignity: 'exalted', sav: 21, occupants: [{ planet: 'Sa', dignity: 'debilitated', nature: null }] } }, D12: { 4: { lord: 'Ve' } } },
      planets: { D1: { Mo: { dignity: 'exalted', house: 2 } }, D12: { Ve: { dignity: 'debilitated' }, Mo: { dignity: 'own' } } },
      vargas: ['D1', 'D12'],
    });
    const digest = digestSection(view, { houses: [10], planets: [], vargas: ['D10'], points: [], deep: false, person: { who: 'mother', houses: [4], varga: 'D12', karaka: 'Mo' } });
    const p: EvidencePack = { ...pack, sections: { digest } };
    const f = personReader(p);
    expect(f.claims.length).toBeGreaterThan(0);
    expect(f.claims.every((c) => c.about === 'mother')).toBe(true);
    expect(f.claims.map((c) => c.rule)).toEqual(expect.arrayContaining(['dignity_strong', 'dignity_weak', 'sav_low']));
    expect(resolvesAll(p, f.claims.flatMap((c) => c.evidence))).toBe(true);
  });

  it('a pack without a digest section gives no findings', () => {
    expect(runCodeReaders({ ...pack, sections: {} }, CODE_ANALYSTS)).toEqual([]);
    expect(runCodeReaders(pack, ['jaimini']).map((f) => f.analyst)).toEqual(['jaimini']);
  });

  it('never names the engine in a claim', () => {
    const text = JSON.stringify(runCodeReaders(pack, CODE_ANALYSTS));
    expect(text).not.toMatch(/radha|pyjhora|jhora/i);
  });
});

describe('the synthesizer receives them like analyst findings', () => {
  const dossier = loadG1Dossier();
  const digest = digestFromDossier(dossier);
  const intent: Intent = { subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', questionType: 'describe', format: 'direct', focusPoints: [], mentionsPlanets: [], confidence: 1, clarifyText: 'x', followUps: [], safety: 'ok' };
  const pack = buildEvidencePack({ dossier, transits: loadG1Transits(), subject: 'career_work', asOf: G1_AS_OF, intent, digest });
  const found = runCodeReaders(pack, CODE_ANALYSTS);

  it('on the G1 digest every claim cites rows the pack holds, and reconcile keeps them all', () => {
    expect(found.length).toBe(4);
    const findings = found.map(toFinding);
    const total = findings.reduce((n, f) => n + f.claims.length, 0);
    expect(total).toBeGreaterThan(0);
    const rec = reconcile({ findings, packs: { career_work: pack }, intent, asOf: G1_AS_OF, keyFacts: '' });
    expect(rec.droppedClaims).toBe(0);
    expect(rec.brief).toContain('"layer":"strength_yoga"');
  });

  it('the oracle brief grounds them against the digest section and counts their layers', () => {
    const readers = found.map((f) => groundReader(`code:${f.analyst}`, f.subject, toReaderOutput(f), { digest: pack.sections.digest }));
    expect(readers.every((r) => r.droppedClaims === 0)).toBe(true);
    const brief = buildBrief({ readers, failed: [], missingTypes: [], pack, intent, question: 'q', asOf: G1_AS_OF, tier: 3 });
    expect(brief.statements.length).toBeGreaterThan(0);
    expect(brief.text).not.toMatch(/code:/);
    expect(layerOf('digest.house.D10.h10.lord')).toBe('varga_d10');
    expect(layerOf('digest.planet.D1.Me.dignity')).toBe('d1');
    expect(layerOf('digest.point.D1.AL.house')).toBe('jaimini');
    expect(layerOf('digest.house.D1.h10.argala')).toBe('jaimini');
  });
});
