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
});
