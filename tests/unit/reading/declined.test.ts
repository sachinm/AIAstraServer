import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { BUILTIN_TOPICS, clearDeclinedTopicsCache, declinedFor, detectDeclined, detectTopic, loadDeclinedTopics, mergeTopics, storedQuestion } from '../../../src/reading/policy/declined.js';
import { canonicalRole, DEFAULT_SIGNUP_ROLE, roleCan, ROLE_IDS } from '../../../src/auth/roles.js';
import { LABELLED } from '../../fixtures/buckets/labelled.js';

describe('declined topics: every example is caught by its own topic', () => {
  for (const t of BUILTIN_TOPICS) {
    for (const q of t.examples) {
      it(`${t.id}: ${q}`, () => {
        expect(detectTopic(q)?.id).toBe(t.id);
      });
    }
  }
});

describe('declined topics: ordinary questions pass', () => {
  const ok = [
    'When will I get married?',
    'Should I change jobs this year?',
    'My father passed away last year; when will my career settle?',
    'Will Saturn harm my career?',
    'Will Rahu attack my family life this year?',
    'How will this transit hurt my finances?',
    'Will I become a doctor?',
    'Should I study medicine?',
    'When will I recover my money?',
    'I face unfair treatment at work, when will it end?',
    'How is the financial health of my business?',
    'I have anxiety about my job interview, will it go well?',
    'When will my business operations grow?',
    'How do I kill time while waiting for my visa?',
    'Will I win the case in court?',
  ];
  for (const q of ok) it(q, () => expect(detectTopic(q)).toBeNull());

  it('the labelled bucket questions are not caught, except the ones about death, health and policy', () => {
    const caught = LABELLED.filter((l) => detectTopic(l.q)).map((l) => `${l.q} -> ${detectTopic(l.q)!.id}`);
    const allowedToCatch = /die|cancer|health|surgery|recover|illness|lottery|gambling|crypto|stocks|healthy|sick|-> minors|-> child_age_unconfirmed/i;
    expect(caught.filter((c) => !allowedToCatch.test(c))).toEqual([]);
  });
});

describe('children under 18', () => {
  const declined = ['Will my 12 year old do well in school?', 'Is my teenager going through a bad phase?', 'Which stream should my daughter take after class 10?', 'How is my baby doing?', 'Will my son pass his board exams?'];
  const answered = ['When will we have a child?', 'Will I conceive this year?', 'When will my 25 year old son settle down in his career?', 'Will my girl say yes to my proposal?', 'Will my daughter, aged 30, get married soon?'];
  const needsAge = ['Will my daughter get married soon?', "Will my son's business grow?", 'Will my son get a job abroad?', 'Will my daughter get into a good university?', 'How is my son doing?', 'Will my son clear his exams?', 'How will my kids do in the coming years?', 'Will our children be happy?'];
  for (const q of needsAge) {
    it(`age must be confirmed: ${q}`, () => {
      expect(detectTopic(q)?.id).toBe('child_age_unconfirmed');
      expect(detectDeclined(q, { childAgeConfirmed: true })).toBeNull();
    });
  }
  it('an adult cue does not override a stated minor age (bogus queries)', () => {
    expect(detectTopic('Will my 13 year old daughter get married soon?')?.id).toBe('minors');
    expect(detectDeclined('Will my 13 year old daughter get married soon?', { childAgeConfirmed: true })?.id).toBe('minors');
    expect(detectTopic('My daughter is 13, when will she get a job?')?.id).toBe('minors');
  });
  for (const q of declined) it(`declined: ${q}`, () => expect(detectTopic(q)?.id).toBe('minors'));
  for (const q of answered) it(`answered: ${q}`, () => expect(detectTopic(q)).toBeNull());
  it('is declined for every role', () => {
    for (const role of ROLE_IDS) expect(detectDeclined('Is my teenager doing well this year?', { role })?.id).toBe('minors');
  });
});

describe('deny topics', () => {
  it('reply never repeats the content and the stored text is withheld', () => {
    const q = 'How can I kill someone without getting caught?';
    const t = detectTopic(q)!;
    expect(t.category).toBe('deny');
    expect(t.reply).not.toMatch(/kill|caught/i);
    expect(storedQuestion(q, t)).toBe(`[withheld: ${t.id}]`);
  });
  it('a decline topic keeps the question text', () => {
    const q = 'When will I die?';
    expect(storedQuestion(q, detectTopic(q))).toBe(q);
  });
  it('deny is checked before decline (self-harm wins over death)', () => {
    expect(detectTopic('I want to die')?.id).toBe('self_harm');
  });
  it('death is declined for every role, including admins and astrologers', () => {
    for (const role of ROLE_IDS) expect(detectDeclined('When will my father die?', { role })?.id).toBe('death_lifespan');
  });
});

describe('roles', () => {
  it('maps legacy values and defaults new users to novice', () => {
    expect(DEFAULT_SIGNUP_ROLE).toBe('novice');
    expect(canonicalRole('user')).toBe('novice');
    expect(canonicalRole('superadmin')).toBe('aiastra_admin');
    expect(canonicalRole('astrology_student')).toBe('student');
    expect(canonicalRole(null)).toBe('novice');
    expect(canonicalRole('Astrologer')).toBe('astrologer');
  });
  it('health questions are role-gated: astrologer, researcher and aiastra_admin by default', () => {
    const q = 'When will my health improve?';
    for (const role of ['novice', 'public', 'student', 'client_account_admin', 'user', null]) expect(detectDeclined(q, { role })?.id, String(role)).toBe('health');
    for (const role of ['astrologer', 'researcher', 'aiastra_admin', 'superadmin']) expect(detectDeclined(q, { role }), role).toBeNull();
    expect(roleCan('novice', 'discuss_health')).toBe(false);
  });
  it('READING_HEALTH_ROLES overrides the default', () => {
    process.env.READING_HEALTH_ROLES = 'student';
    try {
      expect(detectDeclined('Will my surgery go well?', { role: 'student' })).toBeNull();
      expect(detectDeclined('Will my surgery go well?', { role: 'astrologer' })?.id).toBe('health');
    } finally {
      delete process.env.READING_HEALTH_ROLES;
    }
  });
});

describe('database list', () => {
  const row = (r: Partial<{ id: string; category: string; label: string; reply: string; phrases: unknown; words: unknown; allowed_roles: string[]; enabled: boolean; sort_order: number }>) => ({
    id: 'x', category: 'decline', label: '', reply: '', phrases: [], words: [], allowed_roles: [], enabled: true, sort_order: 500, ...r,
  });
  it('a database row adds trigger phrases and changes a reply', () => {
    const topics = mergeTopics([row({ id: 'remedies', category: 'decline', reply: 'No remedies here.', phrases: ['lal kitab'] })]);
    const t = detectTopic('What does lal kitab say for me?', topics);
    expect(t?.id).toBe('remedies');
    expect(t?.reply).toBe('No remedies here.');
  });
  it('a deny topic cannot be disabled or downgraded from the database', () => {
    const topics = mergeTopics([row({ id: 'violence_harm', category: 'decline', enabled: false })]);
    const t = topics.find((x) => x.id === 'violence_harm')!;
    expect(t.category).toBe('deny');
    expect(t.enabled).toBe(true);
    expect(detectTopic('How can I kill someone?', topics)?.id).toBe('violence_harm');
  });
  it('a decline topic can be disabled', () => {
    const topics = mergeTopics([row({ id: 'remedies', enabled: false })]);
    expect(detectTopic('Which gemstone should I wear?', topics)).toBeNull();
  });
  it('a new topic can be added from the database', () => {
    const topics = mergeTopics([row({ id: 'pets', category: 'decline', reply: 'No pet readings.', words: ['hamster'] })]);
    expect(detectTopic('Will my hamster be happy?', topics)?.reply).toBe('No pet readings.');
  });
  it('falls back to the built-in list when the table is unavailable', async () => {
    clearDeclinedTopicsCache();
    const prisma = { declinedTopic: { findMany: vi.fn().mockRejectedValue(new Error('relation "declined_topics" does not exist')) } } as unknown as PrismaClient;
    const topics = await loadDeclinedTopics(prisma);
    expect(topics.map((t) => t.id)).toEqual(BUILTIN_TOPICS.map((t) => t.id));
    clearDeclinedTopicsCache();
  });
  it('declinedFor looks up the role only for a role-gated topic', async () => {
    clearDeclinedTopicsCache();
    const findUnique = vi.fn().mockResolvedValue({ role: 'astrologer' });
    const prisma = { declinedTopic: { findMany: vi.fn().mockResolvedValue([]) }, auth: { findUnique } } as unknown as PrismaClient;
    expect(await declinedFor(prisma, 'u1', 'When will I get married?')).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(await declinedFor(prisma, 'u1', 'Will my surgery go well?')).toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect((await declinedFor(prisma, 'u1', 'How can I hurt someone?'))?.category).toBe('deny');
    clearDeclinedTopicsCache();
  });
});
