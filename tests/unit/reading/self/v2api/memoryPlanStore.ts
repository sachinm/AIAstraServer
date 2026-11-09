/** An in-memory PlanStore for the Self v2 tests: each conditional update applied one at a time, as Postgres would. */
import type { BillingAccountRow, PaymentWrite, PlanStore, UsageRow } from '../../../../../src/billing/store.js';

export class MemoryPlanStore implements PlanStore {
  role: string | null = 'novice';
  accounts = new Map<string, BillingAccountRow>();
  usage: UsageRow[] = [];
  private seq = 0;
  constructor(private readonly created: Date) {}

  private row(userId: string, quota: number | null = 20): BillingAccountRow {
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
  async getRole() { return this.role; }
  async getAccount(u: string) { return this.accounts.get(u) ?? null; }
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
    const row: UsageRow = { id: `r${++this.seq}`, user_id: u, key, period_start, status: 'reserved', open_parts: [], created_at: this.created };
    this.usage.push(row);
    return row;
  }
  async findUsage(u: string, key: string) { return this.usage.find((r) => r.user_id === u && r.key === key) ?? null; }
  async deleteUsage(id: string) { this.usage = this.usage.filter((r) => r.id !== id); }
  async settleUsage(id: string, status: 'committed' | 'released') {
    const r = this.usage.find((x) => x.id === id);
    if (!r || r.status !== 'reserved') return false;
    r.status = status;
    return true;
  }
  async staleReservations(u: string, before: Date) {
    return this.usage.filter((r) => r.user_id === u && r.status === 'reserved' && r.created_at < before);
  }
  async countQuestionsSince(u: string, since: Date) {
    return this.usage.filter((r) => r.user_id === u && r.status !== 'released' && r.created_at >= since).length;
  }
  async findOpenPart() { return null; }
  async takeOpenPart() { return false; }
}
