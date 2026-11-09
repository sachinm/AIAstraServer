import { describe, expect, it } from 'vitest';
import { SUBJECT_IDS, type SubjectId } from '../../../src/reading/packs/frames.js';
import { FACT_CATALOG } from '../../../src/profile/facts.js';
import { TECHNIQUES, TECHNIQUE_SEED_SQL, techniqueById, techniqueRow, type TechniqueBoard } from '../../../src/techniques/catalog.js';
import { contractProblems, horizonCode, promptFileExists, selectTechniques, techniqueIdsFor, type SelectInput } from '../../../src/techniques/contracts.js';
import { LAYOUTS, LAYOUT_IDS, layoutById } from '../../../src/techniques/layouts.js';

const intentFor = (subject: SubjectId, extra: Partial<NonNullable<SelectInput['intent']>> = {}): NonNullable<SelectInput['intent']> => ({
  subjects: [{ id: subject, weight: 1 }],
  horizon: '1y',
  questionType: 'describe',
  ...extra,
});

describe('every technique is a contract (doc 53 §4.3)', () => {
  it('has selectors and a contract with a system prompt and an output schema', () => {
    for (const t of TECHNIQUES) {
      expect(t.selectors, t.id).toBeTypeOf('object');
      expect(t.contract, t.id).toBeTypeOf('object');
      expect(t.contract.system, t.id).toBeTruthy();
      expect(t.contract.output, t.id).toBeTruthy();
      expect(Array.isArray(t.contract.user), t.id).toBe(true);
    }
  });

  it('contractProblems is empty for every row: prompt files exist, layouts and synthesizers are known', () => {
    const problems = TECHNIQUES.flatMap((t) => contractProblems(t));
    expect(problems).toEqual([]);
  });

  it('contractProblems names what is wrong', () => {
    const base = techniqueById('general.promise')!;
    expect(contractProblems({ ...base, contract: { ...base.contract, system: 'src/reading/prompts/nope.md' } })).toEqual([expect.stringContaining('nope.md')]);
    expect(contractProblems({ ...base, contract: { ...base.contract, output: '' } })).toEqual([expect.stringContaining('no output schema')]);
    expect(contractProblems({ ...base, contract: { ...base.contract, synthesizer: 'general.missing' } })).toEqual([expect.stringContaining('general.missing')]);
    expect(contractProblems({ ...base, contract: { ...base.contract, inputs: [] } })).toEqual([expect.stringContaining('at least one input')]);
    expect(contractProblems({ ...base, contract: { ...base.contract, inputs: [{ section: 'house', filter: 'x', layout: 'no_such' }] } })).toEqual([expect.stringContaining('no_such')]);
    expect(contractProblems({ ...base, status: 'planned', contract: { ...base.contract, inputs: [] } })).toEqual([]);
    expect(promptFileExists('src/reading/prompts/../../secret')).toBe(false);
  });

  it('selector values are real subjects, boards, horizons and fact values', () => {
    for (const t of TECHNIQUES) {
      for (const s of t.selectors.subjects ?? []) expect(SUBJECT_IDS, `${t.id} subject ${s}`).toContain(s);
      for (const b of t.selectors.boards ?? []) expect(['chat', 'you', 'love', 'work', 'lucky', 'timeline'], t.id).toContain(b);
      for (const h of t.selectors.horizons ?? []) expect(['now', '3m', '6m', '1y', '3y', 'life', 'custom'], t.id).toContain(h);
      for (const [key, values] of Object.entries(t.selectors.facts ?? {})) {
        const allowed = FACT_CATALOG[key];
        expect(allowed, `${t.id} fact ${key}`).toBeDefined();
        if (allowed !== '*') for (const v of values) expect(allowed, `${t.id} ${key}=${v}`).toContain(v);
      }
    }
  });

  it('built analysts and readers return findings.v2 to the oracle; planned analysts findings.v3; code readers have no user turn', () => {
    for (const t of TECHNIQUES.filter((x) => x.contract.synthesizer === 'general.oracle')) {
      expect(t.contract.output, t.id).toBe(t.status === 'planned' ? 'findings.v3' : 'findings.v2');
      expect(t.contract.user, t.id).toEqual(t.contract.system === 'none' ? [] : ['TODAY', 'SUBJECT', 'FRAME', 'HORIZON', 'REAL_WANT', 'QUESTION', 'FACTS']);
    }
    expect(techniqueById('general.oracle')!.contract.output).toBe('answer.markdown');
    expect(techniqueById('general.validator')!.contract.output).toBe('validator.v1');
    expect(techniqueById('general.intake')!.contract.output).toBe('intent.v1');
    expect(techniqueById('general.clarify')!.contract.output).toBe('intent.v1');
  });

  it('code techniques have system none and an output type', () => {
    // board techniques are code, except the Self/Love/Work reading model layers (docs/reading-engine/58 §4.1, 63)
    // and the You board v2 agents (docs/reading-engine/66 §4.8 Layer 3)
    const MODEL_ON_BOARDS = new Set(['self.reading.oracle', 'love.reading.oracle', 'work.reading.oracle', 'self.v2.oracle', 'self.v2.personalizer', 'self.v2.hero']);
    for (const t of TECHNIQUES.filter((x) => (x.board !== 'chat' || x.id.startsWith('digest.')) && !MODEL_ON_BOARDS.has(x.id))) {
      expect(t.contract.system, t.id).toBe('none');
      expect(t.contract.user, t.id).toEqual([]);
    }
    expect(techniqueById('work.present_tone')!.contract.output).toBe('career_map.v1');
    expect(techniqueById('lucky.work.sign_contract')!.contract.output).toBe('windows.v1');
    expect(techniqueById('digest.build')!.contract.output).toBe('kundli_digest.v1');
  });

  it('no two built techniques with the same output and the same inputs claim the same selector set', () => {
    // the built analysts share "every subject on chat" by design (the graph runs them all): what tells them apart is what they
    // read. Lucky scenario rows are chosen by the act the person taps, not by selectors, so they are left out here.
    const seen = new Map<string, string>();
    for (const t of TECHNIQUES.filter((x) => x.status === 'built' && x.board === 'chat')) {
      const key = `${t.contract.output}|${JSON.stringify(t.selectors)}|${JSON.stringify(t.contract.inputs)}`;
      expect(seen.get(key), `${t.id} and ${seen.get(key)} share output, selectors and inputs`).toBeUndefined();
      seen.set(key, t.id);
    }
  });
});

describe('layouts', () => {
  it('every layout has an id equal to its key, columns and a description', () => {
    for (const id of LAYOUT_IDS) {
      const l = LAYOUTS[id];
      expect(l.id).toBe(id);
      expect(l.columns.length).toBeGreaterThan(0);
      expect(l.description).toBeTruthy();
      expect(Object.keys(l).sort()).toEqual(['columns', 'description', 'id']);
    }
    expect(LAYOUTS.house_card.columns).toEqual(['varga', 'house', 'lord', 'lord_house', 'lord_dignity', 'occupants', 'aspected_graha', 'aspected_rasi', 'argala', 'sav', 'class', 'cusp_star']);
    expect(LAYOUTS.findings_in.columns).toEqual(['technique', 'claim', 'evidence', 'polarity', 'weight', 'about']);
    expect(layoutById('nope')).toBeUndefined();
  });
});

describe('selectTechniques (doc 53 §4.3)', () => {
  it('every subject selects at least one built technique on the chat board', () => {
    for (const s of SUBJECT_IDS) {
      const ids = techniqueIdsFor({ intent: intentFor(s), board: 'chat' });
      expect(ids.some((id) => techniqueById(id)!.status === 'built'), s).toBe(true);
      expect(ids).toContain('general.promise');
      expect(ids).toContain('general.oracle');
    }
  });

  it('each board selects at least one technique', () => {
    for (const board of ['you', 'love', 'work', 'lucky'] as TechniqueBoard[]) {
      const ids = techniqueIdsFor({ intent: null, board });
      expect(ids.length, board).toBeGreaterThan(0);
      for (const id of ids) expect(['digest.build', 'digest.annual_set', 'digest.activation'].includes(id) || techniqueById(id)!.board === board, `${id} on ${board}`).toBe(true);
    }
    expect(techniqueIdsFor({ intent: intentFor('career_work'), board: 'work' })).toContain('work.present_tone');
    expect(techniqueIdsFor({ intent: intentFor('marriage_relationship'), board: 'love' })).toContain('love.promise');
    expect(techniqueIdsFor({ intent: intentFor('general_life_direction'), board: 'you' })).toContain('self.promise');
    expect(techniqueIdsFor({ intent: null, board: 'lucky' })).toContain('lucky.work.sign_contract');
  });

  it('a chat question does not select board techniques, and a board does not select chat analysts', () => {
    const chat = techniqueIdsFor({ intent: intentFor('career_work'), board: 'chat' });
    expect(chat).not.toContain('work.present_tone');
    expect(chat).not.toContain('lucky.avoid_bands');
    expect(techniqueIdsFor({ intent: intentFor('career_work'), board: 'work' })).not.toContain('general.promise');
  });

  it('facts: work.status between_jobs selects the work rows; a listed fact with another value excludes the row', () => {
    const work = techniqueIdsFor({ intent: intentFor('career_work'), facts: { 'work.status': 'between_jobs' }, board: 'work' });
    for (const id of ['work.present_tone', 'work.security_grade', 'work.subarea_windows', 'work.horizons', 'work.looking_back']) expect(work).toContain(id);
    const love = (status?: string) => techniqueIdsFor({ intent: intentFor('marriage_relationship'), facts: status ? { 'love.status': status } : {}, board: 'love' });
    expect(love('separated')).toContain('love.reconcile');
    expect(love('separated')).not.toContain('love.meet');
    expect(love('single')).toContain('love.meet');
    expect(love('single')).not.toContain('love.reconcile');
    expect(love()).not.toContain('love.reconcile');
    expect(love()).toContain('love.promise');
  });

  it('slots: prashna only with the prashna slot, and a slot list must be covered', () => {
    const none = techniqueIdsFor({ intent: intentFor('career_work'), board: 'chat' });
    expect(none).not.toContain('general.prashna');
    expect(techniqueIdsFor({ intent: intentFor('career_work'), board: 'chat', slots: ['horizon', 'prashna'] })).toContain('general.prashna');
    const two = [{ ...techniqueById('general.prashna')!, selectors: { slots: ['prashna', 'other_person'] } }];
    expect(selectTechniques({ intent: intentFor('career_work'), board: 'chat', slots: ['prashna'] }, two)).toEqual([]);
    expect(selectTechniques({ intent: intentFor('career_work'), board: 'chat', slots: ['prashna', 'other_person'] }, two)).toHaveLength(1);
  });

  it('horizons: the annual set is selected within 24 months and for a custom range, not for 3y or life', () => {
    const at = (horizon: NonNullable<SelectInput['intent']>['horizon']) => techniqueIdsFor({ intent: intentFor('career_work', { horizon }), board: 'chat' });
    for (const h of ['now', '3m', '6m', '1y'] as const) expect(at(h), h).toContain('general.annual');
    expect(at({ from: '2026-11-01', to: '2027-03-01' })).toContain('general.annual');
    expect(at('3y')).not.toContain('general.annual');
    expect(at('life')).not.toContain('general.annual');
    expect(at('life')).toContain('general.dasha');
    expect(horizonCode({ from: 'a', to: 'b' })).toBe('custom');
    expect(horizonCode('now')).toBe('now');
    expect(horizonCode(null)).toBeNull();
  });

  it('questionTypes and subjects', () => {
    const only = [{ ...techniqueById('general.promise')!, selectors: { questionTypes: ['timing'], subjects: ['children'] as SubjectId[] } }];
    expect(selectTechniques({ intent: intentFor('children', { questionType: 'timing' }), board: 'chat' }, only)).toHaveLength(1);
    expect(selectTechniques({ intent: intentFor('children', { questionType: 'describe' }), board: 'chat' }, only)).toHaveLength(0);
    expect(selectTechniques({ intent: intentFor('career_work', { questionType: 'timing' }), board: 'chat' }, only)).toHaveLength(0);
    expect(selectTechniques({ intent: null, board: 'chat' }, only)).toHaveLength(0);
  });

  it('an empty selector matches everything', () => {
    const open = [{ ...techniqueById('general.promise')!, selectors: {} }];
    expect(selectTechniques({ intent: null, board: 'lucky' }, open)).toHaveLength(1);
  });
});

describe('registry row and seed', () => {
  it('techniqueRow carries selectors and contract, and the one-statement seed writes both columns', () => {
    const row = techniqueRow(techniqueById('general.prashna')!);
    expect(row.selectors).toMatchObject({ slots: ['prashna'] });
    expect(row.contract).toMatchObject({ output: 'findings.v2', system: 'src/reading/prompts/prashna.md' });
    expect(TECHNIQUE_SEED_SQL).toMatch(/INSERT INTO technique_registry \([^)]*\bselectors\b[^)]*\bcontract\b/);
    expect(TECHNIQUE_SEED_SQL).toMatch(/selectors jsonb, contract jsonb\)/);
    expect(TECHNIQUE_SEED_SQL).toMatch(/selectors = EXCLUDED\.selectors/);
    expect(TECHNIQUE_SEED_SQL).toMatch(/contract = EXCLUDED\.contract/);
  });
});
