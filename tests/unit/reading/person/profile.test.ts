import { afterEach, describe, expect, it } from 'vitest';
import { ageBandOf, ageInYears, buildProfilePack, getSelfAgeBandBounds, moodFor, readerRole, statedGender } from '../../../../src/reading/person/profile.js';
import { SELF_V2_AREAS, SELF_V2_REFRESH } from '../../../../src/reading/self/v2types.js';

const ASOF = '2026-11-09';

describe('ageInYears', () => {
  it('counts whole years and respects the birthday', () => {
    expect(ageInYears('2000-11-09', ASOF)).toBe(26);
    expect(ageInYears('2000-11-10', ASOF)).toBe(25);
    expect(ageInYears('2000-02-29', '2026-02-28')).toBe(25);
    expect(ageInYears('2000-02-29', '2026-03-01')).toBe(26);
  });
  it('is null for missing, malformed, impossible or future dates', () => {
    expect(ageInYears(null, ASOF)).toBeNull();
    expect(ageInYears('', ASOF)).toBeNull();
    expect(ageInYears('09/11/2000', ASOF)).toBeNull();
    expect(ageInYears('2001-02-29', ASOF)).toBeNull();
    expect(ageInYears('2027-01-01', ASOF)).toBeNull();
  });
});

describe('ageBandOf', () => {
  afterEach(() => {
    delete process.env.SELF_AGE_BANDS;
  });
  it('places each edge in the right band', () => {
    expect(ageBandOf(24)).toBe('under_25');
    expect(ageBandOf(25)).toBe('25_35');
    expect(ageBandOf(35)).toBe('25_35');
    expect(ageBandOf(36)).toBe('36_45');
    expect(ageBandOf(45)).toBe('36_45');
    expect(ageBandOf(46)).toBe('46_60');
    expect(ageBandOf(60)).toBe('46_60');
    expect(ageBandOf(61)).toBe('60_plus');
    expect(ageBandOf(null)).toBeNull();
  });
  it('reads bounds from env and falls back on bad input', () => {
    process.env.SELF_AGE_BANDS = '20,30,40,50';
    expect(getSelfAgeBandBounds()).toEqual([20, 30, 40, 50]);
    expect(ageBandOf(30)).toBe('36_45');
    process.env.SELF_AGE_BANDS = '30,20,40,50';
    expect(getSelfAgeBandBounds()).toEqual([25, 36, 46, 61]);
    process.env.SELF_AGE_BANDS = 'a,b';
    expect(getSelfAgeBandBounds()).toEqual([25, 36, 46, 61]);
  });
});

describe('statedGender, readerRole, moodFor', () => {
  it('maps the stored gender values; prefer_not_to_say and unknowns are not stated', () => {
    expect(statedGender('female')).toBe('woman');
    expect(statedGender('male')).toBe('man');
    expect(statedGender('prefer_not_to_say')).toBeNull();
    expect(statedGender(null)).toBeNull();
    expect(statedGender('x')).toBeNull();
  });
  it('treats student, astrologer and researcher as practitioners; everyone else reads the plain card', () => {
    expect(readerRole('astrologer')).toBe('practitioner');
    expect(readerRole('researcher')).toBe('practitioner');
    expect(readerRole('novice')).toBe('public');
    expect(readerRole('user')).toBe('public');
    expect(readerRole(null)).toBe('public');
  });
  it('counts the mood tap only on its own day', () => {
    expect(moodFor(`heavy:${ASOF}`, ASOF)).toBe('heavy');
    expect(moodFor('heavy:2026-11-08', ASOF)).toBeNull();
    expect(moodFor(`angry:${ASOF}`, ASOF)).toBeNull();
    expect(moodFor(undefined, ASOF)).toBeNull();
  });
});

describe('buildProfilePack', () => {
  const base = {
    birthDate: '1990-05-01',
    gender: 'female',
    role: 'novice',
    facts: {
      'work.status': { value: 'own_business' },
      'work.level': { value: 'owner_staff' },
      'love.status': { value: 'declined' },
      'family.children': { value: 'young' },
      'self.focus': { value: 'career,money' },
      'place.current': { value: 'declined' },
      'self.confirm.diagnosis.tension': { value: 'yes', confirmed_at: '2026-11-08T10:00:00.000Z' },
      'self.confirm.struggle.ideas_Ra': { value: 'no', confirmed_at: '2026-11-09T10:00:00.000Z' },
      'self.mood': { value: `mixed:${ASOF}` },
      'wizard.done': { value: '2026-11-05' },
    },
  };

  it('collects band, gender, role, facts, declined keys, confirms and mood', () => {
    const p = buildProfilePack(base, ASOF);
    expect(p.ageYears).toBe(36);
    expect(p.ageBand).toBe('36_45');
    expect(p.gender).toBe('woman');
    expect(p.role).toBe('public');
    expect(p.facts).toEqual({ work: { status: 'own_business', level: 'owner_staff' }, children: 'young', focus: ['career', 'money'] });
    expect(p.declined).toEqual(['love.status', 'place.current']);
    expect(p.lastConfirms.map((c) => [c.claimId, c.answer])).toEqual([
      ['struggle.ideas_Ra', 'no'],
      ['diagnosis.tension', 'yes'],
    ]);
    expect(p.mood).toBe('mixed');
    expect(p.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is neutral when gender is not stated and has no band without a birth date', () => {
    const p = buildProfilePack({ birthDate: null, gender: 'prefer_not_to_say', role: null, facts: {} }, ASOF);
    expect(p.gender).toBeNull();
    expect(p.ageBand).toBeNull();
    expect(p.facts).toEqual({});
    expect(p.declined).toEqual([]);
    expect(p.lastConfirms).toEqual([]);
  });

  it('keeps the five most recent confirms', () => {
    const facts: Record<string, { value: string; confirmed_at: string }> = {};
    for (let i = 1; i <= 7; i++) facts[`self.confirm.c${i}`] = { value: 'yes', confirmed_at: `2026-11-0${i}T00:00:00.000Z` };
    const p = buildProfilePack({ ...base, facts }, ASOF);
    expect(p.lastConfirms.map((c) => c.claimId)).toEqual(['c7', 'c6', 'c5', 'c4', 'c3']);
  });

  it('changes the hash when a person-facing input changes, and only then', () => {
    const h = buildProfilePack(base, ASOF).hash;
    expect(buildProfilePack(base, ASOF).hash).toBe(h);
    expect(buildProfilePack({ ...base, facts: { ...base.facts, 'wizard.done': { value: '2026-11-06' } } }, ASOF).hash).toBe(h);
    // a new day expires the mood tap, so the hash moves; without a mood the same band keeps the hash
    expect(buildProfilePack(base, '2026-11-10').hash).not.toBe(h);
    const { 'self.mood': _mood, ...noMood } = base.facts;
    const h2 = buildProfilePack({ ...base, facts: noMood }, ASOF).hash;
    expect(buildProfilePack({ ...base, facts: noMood }, '2026-11-10').hash).toBe(h2);
    expect(buildProfilePack({ ...base, gender: 'male' }, ASOF).hash).not.toBe(h);
    expect(buildProfilePack({ ...base, facts: { ...base.facts, 'love.status': { value: 'married' } } }, ASOF).hash).not.toBe(h);
    expect(buildProfilePack({ ...base, birthDate: '1980-05-01' }, ASOF).hash).not.toBe(h);
  });
});

describe('v2 area table', () => {
  it('lists the hero and eleven areas, each with refresh triggers', () => {
    expect(SELF_V2_AREAS).toHaveLength(12);
    expect(new Set(SELF_V2_AREAS.map((a) => a.id)).size).toBe(12);
    for (const a of SELF_V2_AREAS) {
      expect(SELF_V2_REFRESH[a.id].length).toBeGreaterThan(0);
      expect(a.technique).toBe(`self.v2.${a.id}`);
    }
    expect(SELF_V2_AREAS.filter((a) => a.id !== 'now').map((a) => a.title)).toContain('How you come across');
  });
});
