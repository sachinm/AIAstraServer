/**
 * Self board v2 API, pure parts (docs/reading-engine/66 §4.4, §4.5): the clock list (applies + confirming clocks only,
 * non-applicable with a reason), the twelve areas in order with engine names redacted, the missing-fact question, and
 * the clock charge key on the question gate.
 */
import { describe, expect, it } from 'vitest';
import { QuestionGate, clockChargeKey } from '../../../../../src/billing/questionGate.js';
import { parseApplicability, resolveClockV2 } from '../../../../../src/reading/self/clock.js';
import { SELF_V2_AREAS, type ProfilePack } from '../../../../../src/reading/self/v2types.js';
import { missingFacts, pickHeroQuestion } from '../../../../../src/reading/self/v2api/question.js';
import { buildSelfV2Response, clockView } from '../../../../../src/reading/self/v2api/response.js';
import { MemoryPlanStore } from './memoryPlanStore.js';
import { APPLICABLE_RAW, PRESENT, latestFixture } from './fixtures.js';

const PROFILE: Pick<ProfilePack, 'ageBand' | 'gender' | 'facts' | 'declined'> = { ageBand: '36_45', gender: null, facts: { work: { status: 'yes' } }, declined: ['love.status'] };


describe('v2 clock list (S1)', () => {
  const app = parseApplicability(APPLICABLE_RAW);

  it('lists the clocks that apply plus the confirming clocks, never every stored system', () => {
    const c = resolveClockV2(null, PRESENT, app);
    expect(c).toMatchObject({ primary: 'chathuraaseethi_sama', reason: 'conditional_applies' });
    expect(c.applicable).toEqual(['chathuraaseethi_sama', 'vimsottari', 'narayana', 'chara', 'yogini', 'karaka', 'tithi_ashtottari']);
    expect(c.applicable).not.toContain('kalachakra');
    expect(c.confirming).not.toContain('chathuraaseethi_sama');
  });

  it('puts the non-applicable conditional clocks apart, each with a reason', () => {
    const c = resolveClockV2(null, PRESENT, app);
    const not = Object.fromEntries(c.notApplicable.map((n) => [n.system, n.cause]));
    expect(not).toEqual({ ashtottari: 'does_not_apply', dwisatpathi: 'does_not_apply', panchottari: 'does_not_apply', shattrimsa_sama: 'not_checked' });
    for (const n of c.notApplicable) expect(c.applicable).not.toContain(n.system);
    const view = clockView(c);
    expect(view.notApplicable.find((n) => n.system === 'dwisatpathi')?.reason).toBe('Your chart does not meet the condition this clock needs.');
    expect(view.notApplicable.find((n) => n.system === 'shattrimsa_sama')?.reason).toBe('Not checked for your chart.');
    expect(view.applicable.every((a) => a.line.length > 10 && a.label.length > 0)).toBe(true);
    expect(view.reasonLine).toBe('The clock your chart qualifies for.');
  });

  it('keeps a selectable preference and ignores one the engine says does not apply', () => {
    expect(resolveClockV2('narayana', PRESENT, app)).toMatchObject({ primary: 'narayana', reason: 'preferred' });
    expect(resolveClockV2('dwisatpathi', PRESENT, app)).toMatchObject({ primary: 'chathuraaseethi_sama', reason: 'conditional_applies' });
    const none = resolveClockV2(null, PRESENT.filter((p) => p.system !== 'chathuraaseethi_sama'), app);
    expect(none).toMatchObject({ primary: 'vimsottari', reason: 'default' });
  });

  it('without a stored dasha.applicable row, the activation family is the verdict', () => {
    const c = resolveClockV2(null, PRESENT, null);
    expect(c.primary).toBe('chathuraaseethi_sama');
    expect(c.notApplicable.map((n) => n.system).sort()).toEqual(['ashtottari', 'dwisatpathi', 'shattrimsa_sama']);
  });
});

describe('v2 response mapping', () => {
  const clock = resolveClockV2(null, PRESENT, parseApplicability(APPLICABLE_RAW));

  it('maps the twelve areas in SELF_V2_AREAS order with a status each', () => {
    const r = buildSelfV2Response({ status: 'ok', latest: latestFixture(), clock, profile: PROFILE });
    expect(r.areas.map((a) => a.id)).toEqual(SELF_V2_AREAS.map((a) => a.id));
    expect(r.areas).toHaveLength(12);
    const by = Object.fromEntries(r.areas.map((a) => [a.id, a]));
    expect(by.now!.status).toBe('ok');
    expect(by.lagna!.status).toBe('ok');
    expect(by.body!.status).toBe('withheld');
    expect(by.stuck!.details.headline).toContain('Saturn');
    expect(by.stuck!.details.evidence).toEqual(['planet:D1.Sa']);
    expect(by.drive!.details).toEqual({ evidence: [] });
    expect(r.areas.every((a) => Array.isArray(a.floor))).toBe(true);
  });

  it('redacts engine names everywhere', () => {
    const r = buildSelfV2Response({ status: 'ok', latest: latestFixture(), clock, profile: PROFILE });
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/radha|pyjhora|jhora/i);
  });

  it('pending and failed builds mark every area without a card', () => {
    const pending = buildSelfV2Response({ status: 'pending', latest: { cards: null, oracle: null, briefs: null, builtAt: null, status: 'pending' }, clock, profile: PROFILE });
    expect(pending.areas.every((a) => a.status === 'pending' && a.card === null)).toBe(true);
    expect(pending.hero).toBeNull();
    const failed = buildSelfV2Response({ status: 'ok', latest: { cards: null, oracle: null, briefs: null, builtAt: null, status: 'failed' }, clock, profile: PROFILE });
    expect(failed.areas.every((a) => a.status === 'failed')).toBe(true);
  });

  it('profile: band, no gender, missing facts not stored and not declined', () => {
    const r = buildSelfV2Response({ status: 'ok', latest: latestFixture(), clock, profile: PROFILE });
    expect(r.profile).toEqual({ ageBand: '36_45', hasGender: false, missing: ['family.children', 'self.focus'], role: 'public' });
    expect(r.nextCheck).toBe('2026-12-01');
    expect(buildSelfV2Response({ status: 'ok', latest: latestFixture(), clock, profile: { ...PROFILE, role: 'practitioner' } }).profile.role).toBe('practitioner');
  });

  it('final integration fields: range lines per area, sub-chapter end, the supporting areas of the hero', () => {
    const latest = latestFixture();
    // no stored frame (a row from before the final integration): standing areas still say Always, the rest say nothing
    let r = buildSelfV2Response({ status: 'ok', latest, clock, profile: PROFILE });
    expect(r.subChapterEnds).toBeNull();
    expect(r.areas.find((a) => a.id === 'lagna')).toMatchObject({ range: 'always', rangeLabel: 'Always' });
    expect(r.areas.find((a) => a.id === 'chapter')).toMatchObject({ range: null, rangeLabel: '' });
    latest.frame = {
      asOf: '2026-11-09',
      stamps: { digestVersion: 'd', clock: 'vimsottari', mainPeriod: null, subPeriod: null, subSubPeriod: null, skyWeek: null, year: null, profileHash: null, confirmHash: null },
      periods: {
        system: 'vimsottari',
        previous: null,
        running: { level: 1, lord: 'Ra', from: '2019-02-16', to: '2037-02-16', evidence: 'a1' },
        next: null,
        runningSub: { level: 2, lord: 'Ve', from: '2025-11-16', to: '2027-01-01', evidence: 'a2' },
        runningSubSub: { level: 3, lord: 'Me', from: '2026-09-20', to: '2026-12-10', evidence: 'a3' },
        subRelation: null,
        boundaries: [],
      },
      year: { from: '2026-09-09', to: '2027-09-09', yearLagna: null, yearLord: null, shortClock: null, noCoverage: false },
    };
    latest.cards!.cards.stuck = { ...latest.cards!.cards.now!, areaId: 'stuck' };
    latest.cards!.hero.question = { claimId: 'claim:chapter.turn', text: 'Did something turn?' };
    r = buildSelfV2Response({ status: 'ok', latest, clock, profile: PROFILE });
    expect(r.subChapterEnds).toBe('2027-01-01');
    const by = Object.fromEntries(r.areas.map((a) => [a.id, a]));
    expect(by.chapter).toMatchObject({ range: { from: '2025-11-16', to: '2027-01-01' }, rangeLabel: 'True until 1 Jan 2027' });
    expect(by.now).toMatchObject({ range: { from: '2026-09-20', to: '2026-12-10' }, rangeLabel: 'True until 10 Dec 2026' });
    expect(by.mind).toMatchObject({ range: { from: '2019-02-16', to: '2037-02-16' }, rangeLabel: 'True until 16 Feb 2037' });
    expect(by.yogas).toMatchObject({ range: 'always', rangeLabel: 'Always' });
    expect(by.year).toMatchObject({ range: { from: '2026-09-09', to: '2027-09-09' }, rangeLabel: 'This year: 9 Sep 2026 – 9 Sep 2027' });
    expect(r.hero!.supporting).toEqual(['stuck', 'chapter']);
    for (const a of r.areas) expect(a.floor).toEqual([]);
  });

  it('the hero question: the Personalizer wins, else the first missing fact', () => {
    const r = buildSelfV2Response({ status: 'ok', latest: latestFixture(), clock, profile: PROFILE });
    expect(r.hero?.question).toEqual({ claimId: 'fact.family.children', text: 'Children?' });
    const own = latestFixture();
    own.cards!.hero.question = { claimId: 'work.change.2026', text: 'Did something change at work this year?' };
    expect(buildSelfV2Response({ status: 'ok', latest: own, clock, profile: PROFILE }).hero?.question?.claimId).toBe('work.change.2026');
    expect(pickHeroQuestion(null, ['work.status'])).toEqual({ claimId: 'fact.work.status', text: 'Do you have a job right now?' });
    expect(missingFacts({ facts: { work: { status: 'yes' }, love: 'single', children: 'none', focus: ['career'] }, declined: [] })).toEqual([]);
  });
});

describe('the clock charge on the question gate', () => {
  const NOW = new Date('2026-11-09T12:00:00Z');
  const ENV = { PLAN_FREE_QUESTIONS: '20', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv;

  it('one charge per system per day; a repeat is free', async () => {
    const store = new MemoryPlanStore(NOW);
    const gate = new QuestionGate(store, { enabled: true, now: () => NOW, env: ENV });
    expect(clockChargeKey('2026-11-09', 'narayana')).toBe('board:self:2026-11-09:clock:narayana');
    expect(await gate.chargeClock('u1', '2026-11-09', 'narayana')).toBe('charged');
    expect(await gate.chargeClock('u1', '2026-11-09', 'narayana')).toBe('free');
    expect(await gate.chargeClock('u1', '2026-11-09', 'vimsottari')).toBe('charged');
    expect(await gate.chargeClock('u1', '2026-11-10', 'narayana')).toBe('charged');
    expect(store.accounts.get('u1')?.questions_used_this_month).toBe(3);
  });

  it('at the limit nothing is counted; exempt roles and limits off are never charged', async () => {
    const store = new MemoryPlanStore(NOW);
    const gate = new QuestionGate(store, { enabled: true, now: () => NOW, env: { ...ENV, PLAN_FREE_QUESTIONS: '1' } as NodeJS.ProcessEnv });
    expect(await gate.chargeClock('u1', '2026-11-09', 'narayana')).toBe('charged');
    expect(await gate.chargeClock('u1', '2026-11-09', 'chara')).toBe('at_limit');
    expect(store.accounts.get('u1')?.questions_used_this_month).toBe(1);
    const staff = new MemoryPlanStore(NOW);
    staff.role = 'admin';
    expect(await new QuestionGate(staff, { enabled: true, now: () => NOW, env: ENV }).chargeClock('u1', '2026-11-09', 'chara')).toBe('free');
    expect(await new QuestionGate(new MemoryPlanStore(NOW), { enabled: false, now: () => NOW, env: ENV }).chargeClock('u1', '2026-11-09', 'chara')).toBe('off');
  });
});
