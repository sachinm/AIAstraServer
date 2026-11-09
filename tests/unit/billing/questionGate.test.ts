import { describe, expect, it, vi } from 'vitest';
import { clearPaid, markPaid } from '../../../src/billing/account.js';
import { pickRegion } from '../../../src/billing/geo.js';
import { effectivePlan, monthFor, planQuota, plansEnabled } from '../../../src/billing/plans.js';
import { QuestionGate, partsFromEvent, wasDeclined } from '../../../src/billing/questionGate.js';
import type { BillingAccountRow, PaymentWrite, PlanStore, UsageRow } from '../../../src/billing/store.js';
import { normalizeLanguage, validateCompleteProfile } from '../../../src/lib/profileValidators.js';

const NOW = new Date('2026-11-15T12:00:00Z');
const ENV = { PLAN_FREE_QUESTIONS: '20', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv;

/** Applies each conditional update as Postgres would: one at a time. */
class MemoryPlanStore implements PlanStore {
  role: string | null = 'novice';
  accounts = new Map<string, BillingAccountRow>();
  usage: UsageRow[] = [];
  failing = false;
  private seq = 0;

  private row(userId: string, quota: number | null = 20): BillingAccountRow {
    if (this.failing) throw new Error('db down');
    let a = this.accounts.get(userId);
    if (!a) {
      a = {
        user_id: userId, desired_plan: 'free', desired_interval: null, is_paid: false, paid_plan: null, paid_interval: null,
        paid_since: null, paid_until: null, billing_country: null, question_quota: quota, questions_used_this_month: 0, usage_month_start: null,
      };
      this.accounts.set(userId, a);
    }
    return a;
  }
  async getRole() { if (this.failing) throw new Error('db down'); return this.role; }
  async getAccount(u: string) { if (this.failing) throw new Error('db down'); return this.accounts.get(u) ?? null; }
  async ensureAccount(u: string, quota: number | null) { return this.row(u, quota); }
  async setDesired(u: string, plan: string, interval: string | null, country: string | null, _now: Date, quota: number | null) {
    return Object.assign(this.row(u, quota), { desired_plan: plan, desired_interval: interval, billing_country: country });
  }
  async setPayment(u: string, p: PaymentWrite) { return Object.assign(this.row(u), p); }
  async setQuota(u: string, quota: number | null) { return Object.assign(this.row(u), { question_quota: quota }); }
  async takeQuestion(u: string, start: Date, limit: number | null) {
    if (limit !== null && limit <= 0) return false;
    const a = this.row(u);
    if (a.usage_month_start?.getTime() !== start.getTime()) {
      a.usage_month_start = start;
      a.questions_used_this_month = 1;
      return true;
    }
    if (limit !== null && a.questions_used_this_month >= limit) return false;
    a.questions_used_this_month += 1;
    return true;
  }
  async giveBackQuestion(u: string, start: Date) {
    const a = this.row(u);
    if (a.usage_month_start?.getTime() === start.getTime()) a.questions_used_this_month = Math.max(a.questions_used_this_month - 1, 0);
  }
  async insertUsage(u: string, key: string, period_start: Date) {
    if (this.usage.some((r) => r.user_id === u && r.key === key)) return null;
    const row: UsageRow = { id: `r${++this.seq}`, user_id: u, key, period_start, status: 'reserved', open_parts: [], created_at: NOW };
    this.usage.push(row);
    return row;
  }
  async findUsage(u: string, key: string) { return this.usage.find((r) => r.user_id === u && r.key === key) ?? null; }
  async deleteUsage(id: string) { this.usage = this.usage.filter((r) => r.id !== id); }
  async settleUsage(id: string, status: 'committed' | 'released', data: { openParts?: string[] }) {
    const r = this.usage.find((x) => x.id === id);
    if (!r || r.status !== 'reserved') return false;
    r.status = status;
    if (data.openParts) r.open_parts = data.openParts;
    return true;
  }
  async staleReservations(u: string, before: Date) {
    if (this.failing) throw new Error('db down');
    return this.usage.filter((r) => r.user_id === u && r.status === 'reserved' && r.created_at < before);
  }
  async countQuestionsSince(u: string, since: Date) {
    return this.usage.filter((r) => r.user_id === u && r.status !== 'released' && r.created_at >= since).length;
  }
  async findOpenPart(u: string, part: string, since: Date) {
    return this.usage.find((r) => r.user_id === u && r.status === 'committed' && r.created_at >= since && r.open_parts.includes(part)) ?? null;
  }
  async takeOpenPart(row: UsageRow, part: string) {
    if (!row.open_parts.includes(part)) return false;
    row.open_parts = row.open_parts.filter((p) => p !== part);
    return true;
  }
}

const setup = (nowFn: () => Date = () => NOW, env: NodeJS.ProcessEnv = ENV) => {
  const store = new MemoryPlanStore();
  const gate = new QuestionGate(store, { enabled: true, now: nowFn, env });
  return { store, gate };
};
const ask = async (gate: QuestionGate, opts: { key?: string; focus?: string } = {}) => {
  const r = await gate.reserve('u1', opts);
  if (r.ok) await gate.commit(r.ticket);
  return r.ok;
};
const used = (store: MemoryPlanStore) => store.accounts.get('u1')?.questions_used_this_month;

describe('limits come from env, not the code', () => {
  it('reads each plan from its variable, and unlimited has none', () => {
    expect(planQuota('free', ENV)).toBe(20);
    expect(planQuota('plus', ENV)).toBe(100);
    expect(planQuota('unlimited', {} as NodeJS.ProcessEnv)).toBeNull();
    expect(planQuota('free', { PLAN_FREE_QUESTIONS: '7' } as NodeJS.ProcessEnv)).toBe(7);
  });

  it('has no fallback number when a variable is missing or wrong', () => {
    expect(() => planQuota('free', {} as NodeJS.ProcessEnv)).toThrow(/PLAN_FREE_QUESTIONS/);
    expect(() => planQuota('plus', { PLAN_PLUS_QUESTIONS: 'lots' } as NodeJS.ProcessEnv)).toThrow(/PLAN_PLUS_QUESTIONS/);
  });

  it('stamps the env value on a new account, and that column then governs', async () => {
    const { store, gate } = setup(() => NOW, { PLAN_FREE_QUESTIONS: '3', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv);
    for (let i = 0; i < 3; i++) expect(await ask(gate)).toBe(true);
    expect(store.accounts.get('u1')?.question_quota).toBe(3);
    expect(await ask(gate)).toBe(false);
    await store.setQuota('u1', 5);
    expect(await gate.getStatus('u1')).toMatchObject({ limit: 5, remaining: 2, used: 3 });
    expect(await ask(gate)).toBe(true);
  });

  it('allows the question and logs when plans are on but the variable is missing', async () => {
    const { gate } = setup(() => NOW, {} as NodeJS.ProcessEnv);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await gate.reserve('u1')).ok).toBe(true);
    expect(await gate.getStatus('u1')).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('the access rule', () => {
  it('uses the paid flag and what the payment covers, never the desired plan', () => {
    const base = { is_paid: true, paid_plan: 'plus', paid_until: null };
    expect(effectivePlan(null)).toBe('free');
    expect(effectivePlan(base)).toBe('plus');
    expect(effectivePlan({ ...base, is_paid: false })).toBe('free');
    expect(effectivePlan({ ...base, paid_plan: null })).toBe('free');
    expect(effectivePlan({ ...base, paid_until: new Date(NOW.getTime() - 1) }, NOW)).toBe('free');
    expect(effectivePlan({ ...base, paid_until: new Date(NOW.getTime() + 1) }, NOW)).toBe('plus');
  });

  it('choosing a plan without paying leaves the person on Free', async () => {
    const { store, gate } = setup();
    await store.setDesired('u1', 'unlimited', 'year', 'IN', NOW, 20);
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'free', desired_plan: 'unlimited', desired_interval: 'year', is_paid: false, limit: 20 });
  });

  it('a Plus payer choosing Unlimited stays on Plus until that is paid', async () => {
    const { store, gate } = setup();
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    await store.setDesired('u1', 'unlimited', 'month', 'US', NOW, 20);
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'plus', desired_plan: 'unlimited', limit: 100 });
    await markPaid(store, 'u1', { plan: 'unlimited', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'unlimited', limit: null, remaining: null });
  });
});

describe('the free plan', () => {
  it('allows its quota, then refuses until the next calendar month', async () => {
    let now = NOW;
    const { gate, store } = setup(() => now);
    for (let i = 0; i < 20; i++) expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(false);
    const c = await gate.check('u1');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.usage).toMatchObject({ used: 20, remaining: 0, window: 'month', resets_at: '2026-12-01T00:00:00.000Z' });
    now = new Date('2026-12-01T00:00:01Z');
    expect((await gate.check('u1')).ok).toBe(true);
    expect((await gate.getStatus('u1'))?.used).toBe(0);
    expect(await ask(gate)).toBe(true);
    expect(used(store)).toBe(1);
  });

  it('two requests at once cannot both take the last question', async () => {
    const { store, gate } = setup();
    await store.setQuota('u1', 1);
    const results = await Promise.all([gate.reserve('u1'), gate.reserve('u1')]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(used(store)).toBe(1);
    expect(store.usage).toHaveLength(1);
  });

  it('a failed answer gives the question back, once', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    expect(used(store)).toBe(1);
    if (!r.ok) throw new Error('expected a ticket');
    await gate.release(r.ticket);
    await gate.release(r.ticket);
    expect(used(store)).toBe(0);
  });

  it('a committed question is not given back', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    if (!r.ok) throw new Error('expected a ticket');
    await gate.commit(r.ticket);
    await gate.release(r.ticket);
    expect(used(store)).toBe(1);
  });

  it('a reservation from a dead run is released on the next request', async () => {
    const { store, gate } = setup();
    await gate.reserve('u1');
    store.usage[0].created_at = new Date(NOW.getTime() - 11 * 60_000);
    expect((await gate.getStatus('u1'))?.used).toBe(0);
    expect(store.usage[0].status).toBe('released');
  });
});

describe('what counts as one question', () => {
  it('later parts the server recorded are free, each once', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    if (!r.ok) throw new Error('expected a ticket');
    await gate.commit(r.ticket, { openParts: ['career', 'money'] });
    expect(await ask(gate, { focus: 'career' })).toBe(true);
    expect(await ask(gate, { focus: 'money' })).toBe(true);
    expect(used(store)).toBe(1);
    expect(await ask(gate, { focus: 'money' })).toBe(true);
    expect(used(store)).toBe(2);
  });

  it('a made-up focus is charged', async () => {
    const { store, gate } = setup();
    await ask(gate, { focus: 'career' });
    expect(used(store)).toBe(1);
  });

  it('an open part expires after an hour', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    if (!r.ok) throw new Error('expected a ticket');
    await gate.commit(r.ticket, { openParts: ['career'] });
    store.usage[0].created_at = new Date(NOW.getTime() - 61 * 60_000);
    await ask(gate, { focus: 'career' });
    expect(used(store)).toBe(2);
  });

  it('a replayed clarify run is not charged twice, but a retry after a failure is', async () => {
    const { store, gate } = setup();
    expect(await ask(gate, { key: 'clarify:r1' })).toBe(true);
    expect(await ask(gate, { key: 'clarify:r1' })).toBe(true);
    expect(used(store)).toBe(1);

    const failed = await gate.reserve('u1', { key: 'clarify:r2' });
    if (!failed.ok) throw new Error('expected a ticket');
    await gate.release(failed.ticket);
    expect(used(store)).toBe(1);
    expect(await ask(gate, { key: 'clarify:r2' })).toBe(true);
    expect(used(store)).toBe(2);
  });

  it('reads the parts from a next event and spots a declined turn', () => {
    expect(partsFromEvent({ type: 'next', parts: [{ id: 'career', label: 'Career' }] })).toEqual(['career']);
    expect(partsFromEvent({ type: 'stage' })).toBeNull();
    expect(wasDeclined({ requestPayload: { engine: 'policy' } })).toBe(true);
    expect(wasDeclined({ requestPayload: { engine: 'reading' } })).toBe(false);
  });
});

describe('paid plans', () => {
  it('Plus allows its quota a month, and resets from the day payment began', async () => {
    let now = new Date('2026-11-20T00:00:00Z');
    const { store, gate } = setup(() => now);
    await markPaid(store, 'u1', { plan: 'plus', interval: 'year', paidUntil: null, now: new Date('2026-10-05T00:00:00Z'), env: ENV });
    expect(store.accounts.get('u1')?.question_quota).toBe(100);
    for (let i = 0; i < 100; i++) expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(false);
    expect((await gate.getStatus('u1'))?.resets_at).toBe('2026-12-05T00:00:00.000Z');
    now = new Date('2026-12-05T00:00:00Z');
    expect(await ask(gate)).toBe(true);
    expect((await gate.getStatus('u1'))?.used).toBe(1);
  });

  it('Unlimited has no limit, and still counts the month', async () => {
    const { store, gate } = setup();
    await markPaid(store, 'u1', { plan: 'unlimited', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    for (let i = 0; i < 300; i++) expect(await ask(gate)).toBe(true);
    expect(store.accounts.get('u1')?.question_quota).toBeNull();
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'unlimited', used: 300, limit: null, remaining: null });
    expect((await gate.check('u1')).ok).toBe(true);
  });

  it('the daily guard stops Unlimited only when it is set, and only for that day', async () => {
    let now = NOW;
    const { store, gate } = setup(() => now, { ...ENV, PLAN_UNLIMITED_DAILY_GUARD: '3' });
    await markPaid(store, 'u1', { plan: 'unlimited', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    for (let i = 0; i < 3; i++) expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(false);
    const refused = await gate.check('u1');
    expect(refused).toMatchObject({ ok: false, usage: { code: 'unlimited', used: 3, limit: 3, remaining: 0, window: 'day', resets_at: '2026-11-16T00:00:00.000Z' } });
    now = new Date('2026-11-16T00:00:00Z');
    store.usage.forEach((r) => { r.created_at = NOW; });
    expect((await gate.check('u1')).ok).toBe(true);
  });

  it('the daily guard does not touch other plans', async () => {
    const { store, gate } = setup(() => NOW, { ...ENV, PLAN_UNLIMITED_DAILY_GUARD: '1' });
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(true);
  });

  it('upgrading starts the new plan with a full month', async () => {
    const { store, gate } = setup();
    for (let i = 0; i < 20; i++) await ask(gate);
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    expect(await gate.getStatus('u1')).toMatchObject({ used: 0, limit: 100 });
  });

  it('a renewal keeps the month and any override; a lapsed plan gets the free quota', async () => {
    const { store, gate } = setup();
    const start = new Date('2026-10-05T00:00:00Z');
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: new Date('2026-11-05T00:00:00Z'), now: start, env: ENV });
    await store.setQuota('u1', 150);
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'free', limit: 20 });
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: new Date('2026-12-05T00:00:00Z'), now: NOW, env: ENV });
    expect(store.accounts.get('u1')?.paid_since).toEqual(start);
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'plus', limit: 150 });
  });

  it('clearing payment puts the free quota back on the account', async () => {
    const { store, gate } = setup();
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: null, now: NOW, env: ENV });
    await clearPaid(store, 'u1', ENV);
    expect(store.accounts.get('u1')?.question_quota).toBe(20);
    expect((await gate.getStatus('u1'))?.code).toBe('free');
  });

  it('keeps month windows on short months', () => {
    const p = monthFor(new Date('2026-01-31T00:00:00Z'), new Date('2026-02-28T12:00:00Z'));
    expect(p.start.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});

describe('staff, the flag and failures', () => {
  it('does not count staff', async () => {
    const { store, gate } = setup();
    store.role = 'superadmin';
    for (let i = 0; i < 30; i++) expect(await ask(gate)).toBe(true);
    expect(store.usage).toHaveLength(0);
    expect(await gate.getStatus('u1')).toMatchObject({ exempt: true, limit: null, remaining: null });
  });

  it('exempts by canonical role: legacy staff names, researcher and astrologer; not novice or client_account_admin', async () => {
    for (const [role, exempt] of [['support', true], ['admin', true], ['aiastra_admin', true], ['astrologer', true], ['researcher', true], ['novice', false], ['user', false], ['client_account_admin', false], [null, false]] as const) {
      const { store, gate } = setup();
      store.role = role as never;
      expect((await gate.getStatus('u1'))?.exempt ?? false).toBe(exempt);
    }
  });

  it('touches nothing while PLANS_ENABLED is off', async () => {
    const store = new MemoryPlanStore();
    const spy = vi.spyOn(store, 'getRole');
    const gate = new QuestionGate(store, { enabled: false });
    expect(await gate.getStatus('u1')).toBeNull();
    expect((await gate.check('u1')).ok).toBe(true);
    expect((await gate.reserve('u1')).ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(plansEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(plansEnabled({ PLANS_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('lets the question through when the database fails', async () => {
    const { store, gate } = setup();
    store.failing = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await gate.check('u1')).ok).toBe(true);
    expect((await gate.reserve('u1')).ok).toBe(true);
    expect(await gate.getStatus('u1')).toBeNull();
    err.mockRestore();
  });
});

describe('language', () => {
  it('stores Hindi only when asked for, and accepts it from registration', () => {
    expect(normalizeLanguage('hi')).toBe('hi');
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
    const r = validateCompleteProfile(
      { date_of_birth: '1990-04-27', time_of_birth: '10:30', country_code: 'IN', city: 'Pune', gender: 'male', language: 'hi' },
      NOW
    );
    expect(r.ok).toBe(true);
  });
});

describe('region', () => {
  it('gives rupees only for India, and a paying account keeps its own', () => {
    expect(pickRegion({ country: 'IN' })).toBe('IN');
    expect(pickRegion({ country: 'US' })).toBe('US');
    expect(pickRegion({ country: 'DE' })).toBe('US');
    expect(pickRegion({ country: null })).toBe('US');
    expect(pickRegion({ country: 'US', requested: 'IN' })).toBe('IN');
    expect(pickRegion({ country: 'IN', requested: 'US' })).toBe('US');
    expect(pickRegion({ country: 'US', requested: 'nope' })).toBe('US');
    expect(pickRegion({ billingCountry: 'IN', country: 'US', requested: 'US' })).toBe('IN');
  });
});

describe('fresh board builds (docs/billing/02)', () => {
  it('a fresh board takes one question, once per board per day, shared with questions', async () => {
    const { store, gate } = setup();
    expect(await gate.chargeBoard('u1', 'self', '2026-11-15')).toBe('charged');
    expect(await gate.chargeBoard('u1', 'self', '2026-11-15')).toBe('free');
    expect(await gate.chargeBoard('u1', 'love', '2026-11-15')).toBe('charged');
    expect(await gate.chargeBoard('u1', 'work', '2026-11-15')).toBe('charged');
    expect(await ask(gate)).toBe(true);
    expect(used(store)).toBe(4);
    expect(await gate.chargeBoard('u1', 'self', '2026-11-16')).toBe('charged');
    expect(used(store)).toBe(5);
    expect(await gate.getStatus('u1')).toMatchObject({ used: 5, limit: 20, remaining: 15 });
  });

  it('two invocations of one build at once count it once', async () => {
    const { store, gate } = setup();
    const r = await Promise.all([gate.chargeBoard('u1', 'self', '2026-11-15'), gate.chargeBoard('u1', 'self', '2026-11-15')]);
    expect(r.filter((x) => x === 'charged')).toHaveLength(1);
    expect(used(store)).toBe(1);
  });

  it('at the limit the board is not counted and the counter stays at the limit', async () => {
    const { store, gate } = setup(() => NOW, { PLAN_FREE_QUESTIONS: '2', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv);
    expect(await ask(gate)).toBe(true);
    expect(await gate.chargeBoard('u1', 'love', '2026-11-15')).toBe('charged');
    expect(await gate.chargeBoard('u1', 'work', '2026-11-15')).toBe('at_limit');
    expect(used(store)).toBe(2);
    expect(store.usage.some((r) => r.key === 'board:work:2026-11-15')).toBe(false);
  });

  it('staff, limits off and a database error never count a board', async () => {
    const { store, gate } = setup();
    store.role = 'admin';
    expect(await gate.chargeBoard('u1', 'self', '2026-11-15')).toBe('free');
    expect(used(store)).toBeUndefined();
    const off = new QuestionGate(new MemoryPlanStore(), { enabled: false, now: () => NOW, env: ENV });
    expect(await off.chargeBoard('u1', 'self', '2026-11-15')).toBe('off');
    const down = setup();
    down.store.failing = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await down.gate.chargeBoard('u1', 'self', '2026-11-15')).toBe('free');
  });
});
