import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTS } from '../../../src/agents/registry.js';
import { SUBJECT_IDS } from '../../../src/reading/packs/frames.js';
import { SCENARIOS } from '../../../src/reading/luckyTimes/scenarios.js';
import { CHART_SOURCES, resetTechniqueSeedState, seedTechniqueRegistry, techniqueById, TECHNIQUES } from '../../../src/techniques/catalog.js';
import { categoryOfLuckyArea, categoryOfSubject, SUBJECT_CATEGORY, TECHNIQUE_CATEGORIES } from '../../../src/techniques/categories.js';

beforeEach(() => resetTechniqueSeedState());

describe('technique catalogue', () => {
  it('ids are unique and look like <category or board>.<name>', () => {
    expect(new Set(TECHNIQUES.map((t) => t.id)).size).toBe(TECHNIQUES.length);
    for (const t of TECHNIQUES) expect(t.id).toMatch(/^(work|love|self|lucky|general)\.[a-z0-9_.]+$/);
  });

  it('every category, board, status and chart source is valid', () => {
    for (const t of TECHNIQUES) {
      expect(TECHNIQUE_CATEGORIES).toContain(t.category);
      expect(['you', 'love', 'work', 'lucky', 'chat']).toContain(t.board);
      expect(['built', 'partial', 'planned']).toContain(t.status);
      for (const ch of t.charts) expect(CHART_SOURCES).toContain(ch.source);
      expect(t.algorithm.length).toBeGreaterThan(0);
      expect(t.source).toBeTruthy();
      expect(t.code).toBeTruthy();
      expect(t.accuracy).toMatch(/^(area_checks:[a-z]+|staff|none)$/);
    }
  });

  it('lucky board rows that serve every area are not filed under general', () => {
    for (const t of TECHNIQUES.filter((x) => x.board === 'lucky')) expect(t.category).not.toBe('general');
  });

  it('every agent named in TECHNIQUES exists in AGENTS', () => {
    const ids = new Set(AGENTS.map((a) => a.id));
    for (const t of TECHNIQUES) for (const a of t.agents) expect(ids.has(a), `${t.id} names ${a}`).toBe(true);
  });

  it('a built technique names at least one agent; a planned one names none', () => {
    for (const t of TECHNIQUES) {
      if (t.status === 'built') expect(t.agents.length, t.id).toBeGreaterThan(0);
      if (t.status === 'planned') expect(t.agents, t.id).toEqual([]);
    }
  });

  it('every board agent (lucky.*, area.*) is named by at least one built technique', () => {
    const named = new Set(TECHNIQUES.filter((t) => t.status === 'built').flatMap((t) => t.agents));
    for (const a of AGENTS.filter((x) => /^(lucky|area)\./.test(x.id))) expect(named.has(a.id), a.id).toBe(true);
  });

  it('one lucky row per scenario, with the scenario source and its category', () => {
    for (const s of SCENARIOS) {
      const t = techniqueById(`lucky.${s.id}`);
      expect(t, s.id).toBeDefined();
      expect(t!.source).toBe(s.source);
      expect(t!.category).toBe(categoryOfLuckyArea(s.area));
      expect(t!.status).toBe('built');
      expect(t!.algorithm.join(' ')).toContain(`scoring ${s.floor} or more`);
    }
    const scenarioRows = TECHNIQUES.filter((t) => t.board === 'lucky' && !['lucky.avoid_bands', 'lucky.personal_overlay', 'lucky.day_tables'].includes(t.id));
    expect(scenarioRows).toHaveLength(SCENARIOS.length);
  });

  it('the planned work families and the house-state layers are there', () => {
    for (const id of ['work.annual_family', 'work.conditional_family', 'work.karaka_family', 'work.d10_check']) expect(techniqueById(id)?.status).toBe('planned');
    for (const layer of ['promise', 'affliction', 'activation', 'transit', 'annual', 'varga', 'nakshatra']) {
      expect(techniqueById(`love.${layer}`)?.board).toBe('love');
      expect(techniqueById(`self.${layer}`)?.board).toBe('you');
    }
    expect(techniqueById('love.varga')!.charts.map((c) => c.id)).toContain('D9');
  });

  it('never names the engine library in a user-facing string', () => {
    expect(JSON.stringify(TECHNIQUES)).not.toMatch(/radha|pyjhora|jhora/i);
  });
});

describe('categories', () => {
  it('categoryOfSubject covers every SUBJECT_IDS entry', () => {
    for (const s of SUBJECT_IDS) expect(SUBJECT_CATEGORY[s], s).toBeDefined();
    expect(Object.keys(SUBJECT_CATEGORY).sort()).toEqual([...SUBJECT_IDS].sort());
  });
  it('follows the plan table', () => {
    expect(categoryOfSubject('career_work')).toBe('work');
    expect(categoryOfSubject('speculation_lottery')).toBe('work');
    expect(categoryOfSubject('marriage_relationship')).toBe('love');
    expect(categoryOfSubject('children')).toBe('love');
    expect(categoryOfSubject('health_body')).toBe('self');
    expect(categoryOfSubject('travel_journeys')).toBe('self');
    expect(categoryOfSubject('explain_term')).toBe('general');
    expect(categoryOfSubject(null)).toBe('general');
    expect(categoryOfSubject('nope')).toBe('general');
  });
  it('lucky areas', () => {
    expect(categoryOfLuckyArea('work')).toBe('work');
    expect(categoryOfLuckyArea('money')).toBe('work');
    expect(categoryOfLuckyArea('love')).toBe('love');
    for (const a of ['travel', 'study', 'home']) expect(categoryOfLuckyArea(a)).toBe('self');
  });
});

describe('seedTechniqueRegistry', () => {
  const fake = () => {
    const rows = new Map<string, Record<string, unknown>>();
    let calls = 0;
    const prisma = {
      techniqueRegistry: {
        upsert: async ({ where, create, update }: any) => {
          calls += 1;
          rows.set(where.id, rows.has(where.id) ? { ...rows.get(where.id), ...update } : create);
          return rows.get(where.id);
        },
      },
    };
    return { prisma: prisma as any, rows, calls: () => calls };
  };

  it('is idempotent', async () => {
    const db = fake();
    expect(await seedTechniqueRegistry(db.prisma)).toBe(TECHNIQUES.length);
    const first = JSON.stringify([...db.rows.entries()].map(([k, v]) => [k, { ...v, updated_at: null }]));
    expect(await seedTechniqueRegistry(db.prisma)).toBe(TECHNIQUES.length);
    const second = JSON.stringify([...db.rows.entries()].map(([k, v]) => [k, { ...v, updated_at: null }]));
    expect(db.rows.size).toBe(TECHNIQUES.length);
    expect(second).toBe(first);
    expect(db.rows.get('work.present_tone')).toMatchObject({ category: 'work', board: 'work', status: 'built', code_ref: 'src/reading/area/career.ts presentState' });
  });

  it('never throws when the table is missing', async () => {
    const prisma = { techniqueRegistry: { upsert: async () => { throw Object.assign(new Error('relation "technique_registry" does not exist'), { code: 'P2021' }); } } };
    await expect(seedTechniqueRegistry(prisma as any)).resolves.toBe(0);
  });
});
