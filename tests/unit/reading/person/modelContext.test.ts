/**
 * docs/techniques/13 §2.4: the one gate for personal data. Each role gets exactly its fields; the NEVER list (name, email,
 * phone, any place, birth time, coordinates) never reaches a model for a profile that has all of them; `fieldsSent` holds
 * names only; with READING_PERSON_GATE off the Personalizer, card chat and Clarify inputs are byte-identical to today's.
 * Fakes only; no database, no model.
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_PERSON,
  gatedPortrait,
  loadPersonSources,
  PERSON_ROLE_FIELDS,
  personForModel,
  personLinesFor,
  type PersonRole,
  type PersonSources,
} from '../../../../src/reading/person/modelContext.js';
import { portraitLines } from '../../../../src/reading/person/portrait.js';
import { profileLines } from '../../../../src/reading/person/profileLines.js';
import { buildProfilePack } from '../../../../src/reading/person/profile.js';
import { personalizerV3Suffix } from '../../../../src/reading/self/v3/personalizer.js';
import { buildClarifyContextPrefix } from '../../../../src/reading/clarify/planner.js';
import { clarifiedLines } from '../../../../src/reading/cardChat/clarify.js';
import { cardChatParts } from '../../../../src/reading/cardChat/prompt.js';
import { resolveCardContext } from '../../../../src/reading/cardChat/resolve.js';
import type { PersonPortrait } from '../../../../src/reading/self/v2types.js';
import type { OracleCardV3 } from '../../../../src/reading/self/v3/types.js';
import { body, PERIODS, resolveSeams, view } from '../cardChat/fixtures.js';

const ASOF = '2026-11-22';

// values that must never reach a model, whatever the role
const SECRET = {
  name: 'Zebedee Quillfeather',
  email: 'zq@example.invalid',
  phone: '+1-555-0142',
  birthPlace: 'Ballarat, Victoria, Australia',
  birthTime: '04:37:12',
  lat: '-37.5622',
  lon: '143.8503',
  tz: 'Australia/Melbourne',
  currentPlace: 'Reykjavik, Iceland',
  eventPlace: 'Timbuktu',
};

/** a full profile: every allowed field set, and every forbidden one too (as a careless loader would hand them over) */
function fullSources(): PersonSources & Record<string, unknown> {
  return {
    birthDate: '1984-03-09',
    gender: 'female',
    role: 'user',
    facts: {
      'work.status': { value: 'yes', confirmed_at: '2026-10-01T00:00:00.000Z' },
      'work.level': { value: 'declined', confirmed_at: '2026-10-01T00:00:00.000Z' },
      'love.status': { value: 'married', confirmed_at: '2026-10-02T00:00:00.000Z' },
      'family.children': { value: 'young', confirmed_at: '2026-10-02T00:00:00.000Z' },
      'self.focus': { value: 'career, health', confirmed_at: '2026-10-03T00:00:00.000Z' },
      'place.current': { value: SECRET.currentPlace, confirmed_at: '2026-10-03T00:00:00.000Z' },
      'self.confirm.body.load': { value: 'yes', confirmed_at: '2026-11-01T00:00:00.000Z' },
      'self.mood': { value: `heavy:${ASOF}`, confirmed_at: `${ASOF}T08:00:00.000Z` },
      'self.mood.history': { value: `fine:2026-11-01,mixed:2026-11-10,heavy:${ASOF}` },
      'wizard.done': { value: '2026-10-01' },
    },
    lifeEvents: [
      { category: 'job.start', date: '2019-04-01', precision: 'month' },
      { category: 'residence.move', date: '2021-06-15', precision: 'day' },
    ],
    // forbidden columns a loader must never pass on; the gate must ignore them even when present
    name: SECRET.name,
    email: SECRET.email,
    phone: SECRET.phone,
    place_of_birth: SECRET.birthPlace,
    time_of_birth: SECRET.birthTime,
    lat: SECRET.lat,
    lon: SECRET.lon,
    tz: SECRET.tz,
  };
}

const ALL_ROLES: PersonRole[] = ['personalizer', 'chat', 'clarify', 'oracle', 'roles', 'shared'];
const noSecret = (text: string) => {
  for (const v of Object.values(SECRET)) expect(text, v).not.toContain(v);
  expect(text).not.toMatch(/born in|birth place|lives in|place:|current location|coordinates|latitude|longitude/i);
};

describe('each role gets exactly its fields', () => {
  it('personalizer, chat and clarify: sex, age and birth date, stage, facts, events, answers, mood, declined, register, memory', () => {
    for (const role of ['personalizer', 'chat', 'clarify'] as const) {
      const r = personLinesFor(fullSources(), role, ASOF);
      expect(r.fieldsSent.sort()).toEqual([...PERSON_ROLE_FIELDS[role]].sort());
      const text = r.lines.join('\n');
      expect(text).toContain('gender: woman');
      expect(text).toContain('age in whole years: 42 (to pitch the reading; never write the age)');
      expect(text).toContain('birth date: 1984-03-09');
      expect(text).toMatch(/stage of life: load-bearing years/);
      expect(text).toContain('work status: works (employed)');
      expect(text).toContain('love status: married');
      expect(text).toContain('children: young');
      expect(text).toContain('- job.start on 2019-04-01 (month)');
      expect(text).toContain('last answers: claim:body.load=yes');
      expect(text).toContain('mood today: heavy');
      expect(text).toContain('declined (never mention): work.level');
      expect(text).toContain('- work.status = yes (since 2026-10-01)');
    }
  });

  it('oracle and roles: sex, birth date and age, confirmed life events; nothing else', () => {
    for (const role of ['oracle', 'roles'] as const) {
      const r = personLinesFor(fullSources(), role, ASOF);
      expect(r.fieldsSent).toEqual(['sex', 'birth_date', 'age_years', 'life_events']);
      const text = r.lines.join('\n');
      expect(text).toContain('sex: woman');
      expect(text).toContain('birth date: 1984-03-09');
      expect(text).toContain('age in whole years: 42');
      expect(text).toContain('- residence.move on 2021-06-15 (day)');
      // no mood, register, work, love, children, focus, answers or declined topics
      expect(text).not.toMatch(/mood|register|work status|love status|children|focus|last answers|declined|stage of life/);
    }
  });

  it('shared: nothing, and nothing is read', async () => {
    expect(personLinesFor(fullSources(), 'shared', ASOF)).toEqual({ lines: [], fieldsSent: [] });
    let reads = 0;
    const r = await personForModel({} as never, { userId: 'u1' }, 'shared', { load: async () => ((reads += 1), fullSources()) });
    expect(r).toEqual({ lines: [], fieldsSent: [] });
    expect(reads).toBe(0);
  });

  it('a field with no value is not named as sent', () => {
    const r = personLinesFor({ birthDate: null, gender: null, role: null, facts: {}, lifeEvents: [] }, 'personalizer', ASOF);
    expect(r.fieldsSent).toEqual(['register']);
    expect(personLinesFor({ birthDate: null, gender: null, role: null, facts: {}, lifeEvents: [] }, 'oracle', ASOF).fieldsSent).toEqual([]);
  });

  it('a failed read sends nothing personal', async () => {
    const r = await personForModel({} as never, { userId: 'u1' }, 'personalizer', { load: async () => { throw new Error('db down'); } });
    expect(r).toEqual({ lines: [], fieldsSent: [] });
    expect(EMPTY_PERSON.lines).toEqual([]);
  });
});

describe('the NEVER list never appears', () => {
  it('for any role, from a profile with every forbidden field set', () => {
    for (const role of ALL_ROLES) noSecret(personLinesFor(fullSources(), role, ASOF).lines.join('\n'));
  });

  it('the loader reads only allowed columns, even from a client that returns every column', async () => {
    const authRow = { id: 'u1', date_of_birth: '1984-03-09', gender: 'female', role: 'user', name: SECRET.name, email: SECRET.email, phone: SECRET.phone, place_of_birth: SECRET.birthPlace, time_of_birth: SECRET.birthTime, city: 'Ballarat', country_code: 'AU' };
    const factRows = Object.entries(fullSources().facts).map(([key, v]) => ({ key, value: v.value, confirmed_at: v.confirmed_at ? new Date(v.confirmed_at) : null }));
    const ledgerRows = [{ id: 'e1', category: 'job.start', date: '2019-04-01', date_precision: 'month', place: SECRET.eventPlace, attributes: { note: SECRET.name } }];
    const prisma = {
      kundli: { findUnique: async () => ({ user_id: 'u1' }), findFirst: async () => ({ id: 'k1' }) },
      auth: { findUnique: async () => authRow },
      personFact: { findMany: async () => factRows },
      $queryRaw: async () => ledgerRows,
    };
    const src = await loadPersonSources(prisma as never, { kundliId: 'k1' }, ASOF);
    expect(src).not.toBeNull();
    expect(Object.keys(src!).sort()).toEqual(['birthDate', 'facts', 'gender', 'lifeEvents', 'role']);
    expect(src!.facts['place.current']).toBeUndefined();
    noSecret(JSON.stringify(src));
    for (const role of ALL_ROLES) noSecret((await personForModel(prisma as never, { userId: 'u1' }, role, { asOf: ASOF })).lines.join('\n'));
  });

  it('the gated portrait keeps the chart blocks and drops places, biography, past month and mood', () => {
    const p = portrait();
    const lines = portraitLines(gatedPortrait(p)).join('\n');
    noSecret(lines);
    expect(lines).toContain('life now');
    expect(lines).toContain('register:');
    expect(lines).not.toContain('biography');
    // the legacy portrait still has them (its other callers are unchanged)
    expect(portraitLines(p).join('\n')).toContain(`born in: Ballarat`);
  });

  it('a clarified place answer is dropped from the card-chat lines with the gate', () => {
    const s = { turns: [{ ask: { criterion: 'location', question: 'Where do you live now?', chips: [], allowFreeText: true }, answer: { value: SECRET.currentPlace, resolved: true } }, { ask: { criterion: 'sibling', question: 'Which brother?', chips: [{ label: 'Elder brother', value: 'elder' }], allowFreeText: false }, answer: { value: 'elder', resolved: true } }] } as never;
    expect(clarifiedLines(s)).toHaveLength(2);
    expect(clarifiedLines(s, { dropPlaces: true })).toEqual(['Which brother? → Elder brother']);
  });
});

describe('fieldsSent holds names only', () => {
  it('every name is a field name of the role, never a value', () => {
    for (const role of ALL_ROLES) {
      const r = personLinesFor(fullSources(), role, ASOF);
      for (const f of r.fieldsSent) {
        expect(PERSON_ROLE_FIELDS[role]).toContain(f);
        expect(f).toMatch(/^[a-z_]+$/);
      }
      const values = JSON.stringify(r.fieldsSent);
      for (const v of ['1984', 'woman', 'female', 'married', 'manager', 'heavy', 'job.start', ...Object.values(SECRET)]) expect(values).not.toContain(v);
    }
  });
});

function portrait(): PersonPortrait {
  return {
    personality: { mindKeys: { feeling: ['a'], thinking: [], peace: [], judgement: [] } },
    biography: { facts: [{ key: 'place.current', value: SECRET.currentPlace, at: null }], lifeEvents: [{ category: 'job.start', date: '2019-04-01', precision: 'month' }], areaChecks: [], confirms: [] },
    pastMonth: { confirms: [], moods: [], questionTopics: { love: 2 } },
    mood: { today: 'heavy', trend: 'steady', taps30d: 3 },
    health: null,
    lifeNow: [{ label: 'work', matters: [], state: 'quiet', since: null, until: null, strength: null }],
    lifeNowSource: 'windows_and_risk',
    register: { hint: 'plain', why: ['public reader'], workStatus: 'yes', workLevel: 'manager', role: 'public' },
    birthPlace: { city: 'Ballarat', region: 'Victoria', country: 'Australia' },
    currentPlace: { city: 'Reykjavik', country: 'Iceland' },
    gaps: ['birthPlace: not stated', 'mood: no tap stored', 'lifeNow: no S3 windows; every label reads quiet'],
  } as unknown as PersonPortrait;
}

describe('READING_PERSON_GATE off: byte-identical input', () => {
  const oracle: OracleCardV3 = {
    card: 'body',
    headline: 'h',
    spans: [{ span: 's1', tone: 'heavy', mode: 'get_through', asks: 'x', obstacle: 'y', evidence: ['k'], agreement: 'z' }],
    confirm: null,
    gift: 'g',
    knot: 'k',
    pattern: null,
    certainty: 'likely',
    evidence: [],
  } as unknown as OracleCardV3;
  const spans = new Map([['s1', { from: '2026-10-01', to: '2027-01-01' }]]);
  const pack = buildProfilePack({ birthDate: '1984-03-09', gender: 'female', role: 'user', facts: { 'place.current': { value: SECRET.currentPlace }, 'work.status': { value: 'yes' } } }, ASOF);

  it('the Personalizer suffix without a person is today\'s, byte for byte (place and portrait included)', () => {
    const input = { profile: pack, portrait: portrait(), sections: {}, story: { ageYears: 42, lifeStage: 'x' } };
    const off = personalizerV3Suffix(ASOF, [oracle], spans, input);
    // today's layout, rebuilt from the same helpers
    expect(off).toContain([...profileLines(pack), `declined (never mention): none`, `last answers: none`, `mood today: not given`, ...portraitLines(portrait())].join('\n'));
    expect(off).toContain(`place: ${SECRET.currentPlace}`);
    expect(off).toContain('born in: Ballarat');
    expect(personalizerV3Suffix(ASOF, [oracle], spans, { ...input })).toBe(off);
    // with the gate: no place, no birth place, the gate's lines
    const on = personalizerV3Suffix(ASOF, [oracle], spans, { ...input, person: personLinesFor(fullSources(), 'personalizer', ASOF) });
    noSecret(on);
    expect(on).toContain('birth date: 1984-03-09');
    expect(on).toContain('## CONFIDENCE');
  });

  it('the Clarify prefix without a person is today\'s (with its place); with one it has no place', () => {
    const s = { asOf: ASOF, card: { md: 'Sa', ad: 'Me', pd: null, adEnd: '2027-01-01' }, facts: { 'work.status': 'yes', 'place.current': SECRET.currentPlace }, birthPlace: SECRET.birthPlace, location: null } as never;
    const off = buildClarifyContextPrefix(s);
    expect(off).toBe(
      [`CLARIFY CONTEXT AS OF: ${ASOF}`, 'RUNNING DASHA: Sa-Me (AD until 2027-01-01)', `CONFIRMED PROFILE FACTS: ${JSON.stringify({ 'place.current': SECRET.currentPlace, 'work.status': 'yes' })}`, `BIRTH PLACE: ${SECRET.birthPlace}`].join('\n'),
    );
    const on = buildClarifyContextPrefix(s, personLinesFor(fullSources(), 'clarify', ASOF));
    noSecret(on);
    expect(on).toContain('THE PERSON:');
    expect(buildClarifyContextPrefix(s, { lines: [], fieldsSent: [] })).toBe(`CLARIFY CONTEXT AS OF: ${ASOF}\nRUNNING DASHA: Sa-Me (AD until 2027-01-01)`);
  });

  it('card chat: with the gate off the context carries no person and the suffix is today\'s; on, the gate\'s lines', async () => {
    const selfBody = body([view('body', 'Body & energy'), view('mind', 'How you think')], ['body', 'mind']);
    const placeProfile = { ...pack, facts: { ...pack.facts, place: SECRET.currentPlace } };
    const ref = { board: 'self' as const, id: 'body', from: PERIODS[0]!.from, to: PERIODS[0]!.to };
    const off = await resolveCardContext({ prisma: {} as never, ...resolveSeams({ self: selfBody }, { loadProfile: async () => placeProfile, personGate: false }) }, 'u1', ref);
    if (!off.ok) throw new Error(off.error);
    expect('person' in off.context).toBe(false);
    const offSuffix = cardChatParts(off.context, 'q', []).suffix;
    expect(offSuffix).toContain(`place: ${SECRET.currentPlace}`);
    const on = await resolveCardContext(
      { prisma: {} as never, ...resolveSeams({ self: selfBody }, { loadProfile: async () => placeProfile, personGate: true, loadPerson: async () => personLinesFor(fullSources(), 'chat', ASOF) }) },
      'u1',
      ref,
    );
    if (!on.ok) throw new Error(on.error);
    const onSuffix = cardChatParts(on.context, 'q', []).suffix;
    noSecret(onSuffix);
    expect(onSuffix).toContain('birth date: 1984-03-09');
    // everything but THE PERSON block is the same bytes
    const strip = (x: string) => x.replace(/THE PERSON\n[\s\S]*?\n\nTHIS CONVERSATION SO FAR/, 'THE PERSON\n…\n\nTHIS CONVERSATION SO FAR');
    expect(strip(onSuffix)).toBe(strip(offSuffix));
  });
});
