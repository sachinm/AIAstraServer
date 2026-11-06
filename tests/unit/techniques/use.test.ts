import { describe, expect, it } from 'vitest';
import type { SubjectId } from '../../../src/reading/packs/frames.js';
import { planReaders, readersForTier, type ReaderId } from '../../../src/reading/oracle/readers.js';
import type { Intent } from '../../../src/reading/types.js';
import { TECHNIQUES, techniqueById, type TechniqueDef } from '../../../src/techniques/catalog.js';
import { ALWAYS_ANALYSTS, DETERMINISTIC_TECHNIQUES, READER_TECHNIQUE, slotsOf, techniquesForQuestion, TECHNIQUE_ANALYST } from '../../../src/techniques/use.js';
import { selectedTechniques } from '../../../src/reading/run.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';

const AS_OF = '2026-10-24';
const intentOf = (subjects: SubjectId[], extra: Partial<Intent> = {}): Intent => ({
  subjects: subjects.map((id) => ({ id, weight: 1 })),
  horizon: '1y',
  questionType: 'describe',
  format: 'direct',
  focusPoints: [],
  mentionsPlanets: [],
  confidence: 1,
  clarifyText: 'x',
  followUps: [],
  safety: 'ok',
  ...extra,
});

// no model may be called anywhere in these tests
guardNoModelCalls();

describe('techniquesForQuestion: graph analysts', () => {
  it('the catalogue as built selects what today runs: promise, dasha, transit; nakshatra by the old rule; annual within 13 months', () => {
    const u = techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'graph', digestReady: false, asOf: AS_OF, question: 'q' });
    expect(u.analysts).toEqual(['promise', 'dasha', 'transit', 'annual']);
    expect(u.bySubject.career_work!.analysts).toEqual(u.analysts);
    const nak = techniquesForQuestion(intentOf(['career_work'], { questionType: 'why_meaning' }), {}, { flow: 'graph', digestReady: false, asOf: AS_OF });
    expect(nak.analysts).toContain('nakshatra');
    const life = techniquesForQuestion(intentOf(['career_work'], { horizon: 'life' }), {}, { flow: 'graph', digestReady: false, asOf: AS_OF });
    expect(life.analysts).not.toContain('annual');
  });

  it('prashna only with the prashna slot and an eligible question', () => {
    const intent = intentOf(['career_work'], { prashna: { eligible: true, askedAt: '2026-10-24 10:00:00', source: 'rules' } });
    expect(slotsOf(intent)).toContain('prashna');
    expect(techniquesForQuestion(intent, {}, { flow: 'graph', digestReady: false, question: 'Should I take the offer?' }).analysts).toContain('prashna');
    expect(techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'graph', digestReady: false }).analysts).not.toContain('prashna');
  });

  it('an analyst whose technique is not selected does not run, but promise and dasha always do', () => {
    const narrow: TechniqueDef[] = TECHNIQUES.map((t) => (t.id === 'general.transit' || t.id === 'general.promise' || t.id === 'general.dasha' ? { ...t, selectors: { ...t.selectors, subjects: ['children'] as SubjectId[] } } : t));
    const u = techniquesForQuestion(intentOf(['career_work', 'children']), {}, { flow: 'graph', digestReady: false, asOf: AS_OF }, narrow);
    expect(u.bySubject.career_work!.analysts).toEqual(expect.arrayContaining(ALWAYS_ANALYSTS));
    expect(u.bySubject.career_work!.analysts).not.toContain('transit');
    expect(u.bySubject.children!.analysts).toContain('transit');
    expect(u.bySubject.career_work!.ids).not.toContain('general.transit');
    expect(u.bySubject.career_work!.ids).not.toContain('general.promise');
  });

  it('a companion-memory selector switches a technique on and off per value', () => {
    const gated = TECHNIQUES.map((t) => (t.id === 'general.transit' ? { ...t, selectors: { ...t.selectors, facts: { 'work.status': ['between_jobs'] } } } : t));
    const on = techniquesForQuestion(intentOf(['career_work']), { 'work.status': 'between_jobs' }, { flow: 'graph', digestReady: false }, gated);
    const off = techniquesForQuestion(intentOf(['career_work']), { 'work.status': 'yes' }, { flow: 'graph', digestReady: false }, gated);
    const declined = techniquesForQuestion(intentOf(['career_work']), { 'work.status': 'declined' }, { flow: 'graph', digestReady: false }, gated);
    expect(on.analysts).toContain('transit');
    expect(off.analysts).not.toContain('transit');
    expect(declined.analysts).not.toContain('transit');
  });
});

describe('techniquesForQuestion: deterministic readers', () => {
  it('run only when the digest is ready, never on the single flow', () => {
    const ready = techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'graph', digestReady: true });
    expect(ready.deterministic).toEqual(['varga_dynamics', 'strength_yoga', 'jaimini']);
    expect(ready.ids).toEqual(expect.arrayContaining(['general.varga_dynamics', 'general.strength_yoga', 'general.jaimini']));
    expect(ready.ids).not.toContain('general.person');
    const notReady = techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'graph', digestReady: false });
    expect(notReady.deterministic).toEqual([]);
    for (const id of DETERMINISTIC_TECHNIQUES) expect(notReady.ids).not.toContain(id);
    expect(techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'single', digestReady: true }).deterministic).toEqual([]);
  });

  it('the person reader: a person subject, or the other_person slot on any subject', () => {
    expect(techniquesForQuestion(intentOf(['marriage_relationship']), {}, { flow: 'oracle', digestReady: true }).deterministic).toContain('person');
    expect(techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'oracle', digestReady: true }).deterministic).not.toContain('person');
    const slot = slotsOf(intentOf(['career_work']), { otherPerson: true });
    expect(techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'oracle', digestReady: true, slots: slot }).deterministic).toContain('person');
  });

  it('per subject: two subjects each get their own deterministic set', () => {
    const u = techniquesForQuestion(intentOf(['career_work', 'children']), {}, { flow: 'graph', digestReady: true });
    expect(u.bySubject.career_work!.deterministic).not.toContain('person');
    expect(u.bySubject.children!.deterministic).toContain('person');
    expect(u.deterministic).toContain('person');
  });
});

describe('techniquesForQuestion: oracle readers', () => {
  it('maps every reader to a catalogue technique', () => {
    for (const id of Object.keys(READER_TECHNIQUE) as ReaderId[]) expect(techniqueById(READER_TECHNIQUE[id]), id).toBeDefined();
    for (const id of Object.keys(TECHNIQUE_ANALYST)) expect(techniqueById(id)!.status).toBe('built');
  });

  it("with a tier: the tier's readers intersected with the selection; the full catalogue keeps the tier whole within 24 months", () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      const u = techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'oracle', tier, digestReady: false, asOf: AS_OF });
      expect(u.readers, `tier ${tier}`).toEqual(readersForTier(tier as 1));
    }
  });

  it('a life horizon drops R11 (the annual set is selected within 24 months only)', () => {
    const u = techniquesForQuestion(intentOf(['career_work'], { horizon: 'life' }), {}, { flow: 'oracle', tier: 1, digestReady: false, asOf: AS_OF });
    expect(u.readers).not.toContain('R11');
    expect(u.readers).toContain('R09');
  });

  it('never drops the required readers R02, R08 (and R10 within 36 months)', () => {
    const none = TECHNIQUES.map((t) => (['general.promise', 'general.dasha', 'general.transit'].includes(t.id) ? { ...t, selectors: { ...t.selectors, subjects: ['children'] as SubjectId[] } } : t));
    const u = techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'oracle', tier: 3, digestReady: false, asOf: AS_OF }, none);
    expect(u.readers).toEqual(expect.arrayContaining(['R02', 'R08', 'R10']));
    expect(u.readers).not.toContain('R09');
  });

  it('planReaders intersects the tier with the allowed set and keeps the floor', () => {
    const intent = intentOf(['career_work'], { horizon: 'life' });
    const all = planReaders({ intent, question: 'my whole life', asOf: AS_OF });
    expect(all.tier).toBe(1);
    expect(all.ids).toEqual(readersForTier(1));
    const some = planReaders({ intent, question: 'my whole life', asOf: AS_OF, allowed: ['R01', 'R03'] });
    // a life horizon reads 36 months of timing, so R10 is in the floor too
    expect(some.ids.sort()).toEqual(['R01', 'R02', 'R03', 'R08', 'R10']);
    expect([...some.required].sort()).toEqual(['R02', 'R08', 'R10']);
    const person = planReaders({ intent: intentOf(['career_work']), question: 'how is my mother', asOf: AS_OF, allowed: ['R02'] });
    expect(person.ids).not.toContain('R13');
    expect(planReaders({ intent: intentOf(['career_work']), question: 'how is my mother', asOf: AS_OF }).ids).toContain('R13');
  });

  it('ids follow the readers the plan runs', () => {
    const u = techniquesForQuestion(intentOf(['career_work']), {}, { flow: 'oracle', digestReady: false, readers: ['R02', 'R08'] });
    expect(u.ids).toContain('general.promise');
    expect(u.ids).toContain('general.dasha');
    expect(u.ids).not.toContain('general.transit');
    expect(u.ids).toContain('general.reader');
    expect(u.ids).toContain('general.validator');
  });
});

describe('the trace label (M31)', () => {
  it('lists the techniques the flow runs, in catalogue order', () => {
    const graph = selectedTechniques(intentOf(['career_work']), {}, { flow: 'graph', digestReady: true, asOf: AS_OF, question: 'q' })!;
    expect(graph).toEqual(['general.promise', 'general.varga_dynamics', 'general.dasha', 'general.annual', 'general.transit', 'general.strength_yoga', 'general.jaimini', 'general.oracle', 'general.intake', 'general.clarify']);
    const order = TECHNIQUES.map((t) => t.id);
    expect([...graph].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(graph);
    const single = selectedTechniques(intentOf(['career_work']), {}, { flow: 'single', digestReady: true })!;
    expect(single).toEqual(['general.oracle', 'general.intake', 'general.clarify']);
  });

  it('a selector failure gives no label, never a failed reading', () => {
    expect(selectedTechniques({ subjects: null } as unknown as Intent, {}, { flow: 'graph', digestReady: false })).toBeNull();
  });
});
