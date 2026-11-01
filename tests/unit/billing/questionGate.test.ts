import { describe, expect, it, vi } from 'vitest';
import { clearPaid, markPaid } from '../../../src/billing/account.js';
import { pickRegion } from '../../../src/billing/geo.js';
import { normalizeLanguage, validateCompleteProfile } from '../../../src/lib/profileValidators.js';
import { effectivePlan, periodFor, plansEnabled } from '../../../src/billing/plans.js';
import { QuestionGate, partsFromEvent, wasDeclined } from '../../../src/billing/questionGate.js';
import type { BillingAccountRow, PaymentWrite, PlanStore, UsageRow } from '../../../src/billing/store.js';

/** Applies each conditional update as Postgres would: one at a time. */
class MemoryPlanStore implements PlanStore {
  role: string | null = 'novice';
  accounts = new Map<string, BillingAccountRow>();
  usage: UsageRow[] = [];
  failing = false;
  private seq = 0;

  private row(userId: string): BillingAccountRow {
    if (this.failing) throw new Error('db down');
    let a = this.accounts.get(userId);
    if (!a) {
      a = {
        user_id: userId, desired_plan: 'free', desired_interval: null, is_paid: false, paid_plan: null, paid_interval: null,
        paid_since: null, paid_until: null, billing_country: null, free_used: 0, period_start: null, period_used: 0,
      };
      this.accounts.set(userId, a);
    }
    return a;
  }
  async getRole() { if (this.failing) throw new Error('db down'); return this.role; }
  async getAccount(u: string) { if (this.failing) throw new Error('db down'); return this.accounts.get(u) ?? null; }
  async ensureAccount(u: string) { return this.row(u); }
  async setDesired(u: string, plan: string, interval: string | null, country: string | null) {
    return Object.assign(this.row(u), { desired_plan: plan, desired_interval: interval, billing_country: country });
  }
  async setPayment(u: string, p: PaymentWrite) { return Object.assign(this.row(u), p); }
  async takeFree(u: string, limit: number) {
    const a = this.row(u);
    if (a.free_used >= limit) return false;
    a.free_used += 1;
    return true;
  }
  async takePeriod(u: string, start: Date, limit: number) {
    const a = this.row(u);
    if (a.period_start?.getTime() !== start.getTime()) {
      a.period_start = start;
      a.period_used = 1;
      return true;
    }
    if (a.period_used >= limit) return false;
    a.period_used += 1;
    return true;
  }
  async giveBackFree(u: string) { const a = this.row(u); a.free_used = Math.max(a.free_used - 1, 0); }
  async giveBackPeriod(u: string, start: Date) {
    const a = this.row(u);
    if (a.period_start?.getTime() === start.getTime()) a.period_used = Math.max(a.period_used - 1, 0);
  }
  async insertUsage(u: string, key: string, counter: string, period_start: Date | null) {
    if (this.usage.some((r) => r.user_id === u && r.key === key)) return null;
    const row: UsageRow = { id: `r${++this.seq}`, user_id: u, key, counter, period_start, status: 'reserved', open_parts: [], created_at: NOW };
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
  async findOpenPart(u: string, part: string, since: Date) {
    return this.usage.find((r) => r.user_id === u && r.status === 'committed' && r.created_at >= since && r.open_parts.includes(part)) ?? null;
  }
  async takeOpenPart(row: UsageRow, part: string) {
    if (!row.open_parts.includes(part)) return false;
    row.open_parts = row.open_parts.filter((p) => p !== part);
    return true;
  }
}

const NOW = new Date('2026-11-15T12:00:00Z');
const setup = () => {
  const store = new MemoryPlanStore();
  const gate = new QuestionGate(store, { enabled: true, now: () => NOW });
  return { store, gate };
};
const ask = async (gate: QuestionGate, opts: { key?: string; focus?: string } = {}) => {
  const r = await gate.reserve('u1', opts);
  if (r.ok) await gate.commit(r.ticket);
  return r.ok;
};

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
    await store.setDesired('u1', 'unlimited', 'year', 'IN');
    const s = await gate.getStatus('u1');
    expect(s).toMatchObject({ code: 'free', desired_plan: 'unlimited', desired_interval: 'year', is_paid: false, limit: 5 });
  });

  it('a Plus payer choosing Unlimited stays on Plus until that is paid', async () => {
    const { store, gate } = setup();
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: null, now: NOW });
    await store.setDesired('u1', 'unlimited', 'month', 'US');
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'plus', desired_plan: 'unlimited', limit: 20 });
    await markPaid(store, 'u1', { plan: 'unlimited', interval: 'month', paidUntil: null, now: NOW });
    expect(await gate.getStatus('u1')).toMatchObject({ code: 'unlimited' });
  });
});

describe('the free plan', () => {
  it('allows 5 questions in total, then refuses, with no reset', async () => {
    const { gate } = setup();
    for (let i = 0; i < 5; i++) expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(false);
    const c = await gate.check('u1');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.usage).toMatchObject({ used: 5, remaining: 0, window: 'lifetime', resets_at: null });
  });

  it('two requests at once cannot both take the last question', async () => {
    const { store, gate } = setup();
    Object.assign(await store.ensureAccount('u1'), { free_used: 4 });
    const results = await Promise.all([gate.reserve('u1'), gate.reserve('u1')]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(store.accounts.get('u1')?.free_used).toBe(5);
    expect(store.usage).toHaveLength(1);
  });

  it('a failed answer gives the question back, once', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    expect(store.accounts.get('u1')?.free_used).toBe(1);
    if (!r.ok) throw new Error('expected a ticket');
    await gate.release(r.ticket);
    await gate.release(r.ticket);
    expect(store.accounts.get('u1')?.free_used).toBe(0);
  });

  it('a committed question is not given back', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    if (!r.ok) throw new Error('expected a ticket');
    await gate.commit(r.ticket);
    await gate.release(r.ticket);
    expect(store.accounts.get('u1')?.free_used).toBe(1);
  });

  it('a reservation from a dead run is released on the next request', async () => {
    const { store, gate } = setup();
    await gate.reserve('u1');
    store.usage[0].created_at = new Date(NOW.getTime() - 11 * 60_000);
    expect((await gate.getStatus('u1'))?.used).toBe(0);
    expect(store.usage[0].status).toBe('released');
  });

  it('keeps the old count after a paid plan ends', async () => {
    const { store, gate } = setup();
    for (let i = 0; i < 5; i++) await ask(gate);
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: null, now: NOW });
    expect(await ask(gate)).toBe(true);
    await clearPaid(store, 'u1');
    expect(await ask(gate)).toBe(false);
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
    expect(store.accounts.get('u1')?.free_used).toBe(1);
    expect(await ask(gate, { focus: 'money' })).toBe(true);
    expect(store.accounts.get('u1')?.free_used).toBe(2);
  });

  it('a made-up focus is charged', async () => {
    const { store, gate } = setup();
    await ask(gate, { focus: 'career' });
    expect(store.accounts.get('u1')?.free_used).toBe(1);
  });

  it('an open part expires after an hour', async () => {
    const { store, gate } = setup();
    const r = await gate.reserve('u1');
    if (!r.ok) throw new Error('expected a ticket');
    await gate.commit(r.ticket, { openParts: ['career'] });
    store.usage[0].created_at = new Date(NOW.getTime() - 61 * 60_000);
    await ask(gate, { focus: 'career' });
    expect(store.accounts.get('u1')?.free_used).toBe(2);
  });

  it('a replayed clarify run is not charged twice, but a retry after a failure is', async () => {
    const { store, gate } = setup();
    expect(await ask(gate, { key: 'clarify:r1' })).toBe(true);
    expect(await ask(gate, { key: 'clarify:r1' })).toBe(true);
    expect(store.accounts.get('u1')?.free_used).toBe(1);

    const failed = await gate.reserve('u1', { key: 'clarify:r2' });
    if (!failed.ok) throw new Error('expected a ticket');
    await gate.release(failed.ticket);
    expect(store.accounts.get('u1')?.free_used).toBe(1);
    expect(await ask(gate, { key: 'clarify:r2' })).toBe(true);
    expect(store.accounts.get('u1')?.free_used).toBe(2);
  });

  it('reads the parts from a next event and spots a declined turn', () => {
    expect(partsFromEvent({ type: 'next', parts: [{ id: 'career', label: 'Career' }] })).toEqual(['career']);
    expect(partsFromEvent({ type: 'stage' })).toBeNull();
    expect(wasDeclined({ requestPayload: { engine: 'policy' } })).toBe(true);
    expect(wasDeclined({ requestPayload: { engine: 'reading' } })).toBe(false);
  });
});

describe('paid plans', () => {
  it('Plus allows 20 a month, and resets from the day payment began', async () => {
    const store = new MemoryPlanStore();
    let now = new Date('2026-11-20T00:00:00Z');
    const gate = new QuestionGate(store, { enabled: true, now: () => now });
    await markPaid(store, 'u1', { plan: 'plus', interval: 'year', paidUntil: null, now: new Date('2026-10-05T00:00:00Z') });
    for (let i = 0; i < 20; i++) expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(false);
    expect((await gate.getStatus('u1'))?.resets_at).toBe('2026-12-05T00:00:00.000Z');
    now = new Date('2026-12-05T00:00:00Z');
    expect(await ask(gate)).toBe(true);
    expect((await gate.getStatus('u1'))?.used).toBe(1);
  });

  it('Unlimited stops at the daily guard and resumes the next UTC day', async () => {
    const store = new MemoryPlanStore();
    let now = new Date('2026-11-20T10:00:00Z');
    const gate = new QuestionGate(store, { enabled: true, now: () => now });
    await markPaid(store, 'u1', { plan: 'unlimited', interval: 'month', paidUntil: null, now });
    for (let i = 0; i < 50; i++) expect(await ask(gate)).toBe(true);
    expect(await ask(gate)).toBe(false);
    now = new Date('2026-11-21T00:00:01Z');
    expect(await ask(gate)).toBe(true);
  });

  it('a renewal of the same plan keeps the window; a lapsed plan falls back to Free', async () => {
    const { store, gate } = setup();
    const start = new Date('2026-10-05T00:00:00Z');
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: new Date('2026-11-05T00:00:00Z'), now: start });
    expect((await gate.getStatus('u1'))?.code).toBe('free');
    await markPaid(store, 'u1', { plan: 'plus', interval: 'month', paidUntil: new Date('2026-12-05T00:00:00Z'), now: NOW });
    expect(store.accounts.get('u1')?.paid_since).toEqual(start);
    expect((await gate.getStatus('u1'))?.code).toBe('plus');
  });

  it('keeps month windows on short months', () => {
    const anchor = new Date('2026-01-31T00:00:00Z');
    const p = periodFor('month', anchor, new Date('2026-02-28T12:00:00Z'));
    expect(p.start.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});

describe('staff, the flag and failures', () => {
  it('does not count staff', async () => {
    const { store, gate } = setup();
    store.role = 'superadmin';
    for (let i = 0; i < 8; i++) expect(await ask(gate)).toBe(true);
    expect(store.usage).toHaveLength(0);
    expect(await gate.getStatus('u1')).toMatchObject({ exempt: true, limit: null, remaining: null });
  });

  it('touches nothing while PLANS_ENABLED is off', async () => {
    const store = new MemoryPlanStore();
    const spy = vi.spyOn(store, 'getRole');
    const gate = new QuestionGate(store, { enabled: false });
    expect(await gate.getStatus('u1')).toBeNull();
    expect((await gate.check('u1')).ok).toBe(true);
    expect((await gate.reserve('u1')).ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(plansEnabled({})).toBe(false);
    expect(plansEnabled({ PLANS_ENABLED: '1' })).toBe(true);
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
