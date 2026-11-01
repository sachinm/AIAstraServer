/**
 * The payment side: the only code that writes is_paid. Today scripts/billing-set-paid.ts calls it; a verified gateway
 * webhook calls it later. Nothing else about payment is read when a question is asked.
 */
import { planQuota, type Interval, type PlanCode } from './plans.js';
import type { BillingAccountRow, PlanStore } from './store.js';

export interface PaidDetails {
  plan: Exclude<PlanCode, 'free'>;
  interval: Interval;
  /** when the payment runs out; null means until cleared */
  paidUntil: Date | null;
  /** the gateway's subscription id, or a note for a manual change */
  paymentRef?: string | null;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}

/** Stamps the plan's quota on the account. A renewal of the same plan keeps `paid_since`, so its month does not move. */
export async function markPaid(store: PlanStore, userId: string, d: PaidDetails): Promise<BillingAccountRow> {
  const current = await store.getAccount(userId);
  const renewal = current?.is_paid === true && current.paid_plan === d.plan && current.paid_since;
  return store.setPayment(userId, {
    is_paid: true,
    paid_plan: d.plan,
    paid_interval: d.interval,
    paid_since: renewal ? (current.paid_since as Date) : (d.now ?? new Date()),
    paid_until: d.paidUntil,
    payment_ref: d.paymentRef ?? null,
    question_quota: renewal ? current.question_quota : planQuota(d.plan, d.env),
  });
}

/** Back to Free, with the free quota from env. */
export function clearPaid(store: PlanStore, userId: string, env?: NodeJS.ProcessEnv): Promise<BillingAccountRow> {
  return store.setPayment(userId, {
    is_paid: false,
    paid_plan: null,
    paid_interval: null,
    paid_since: null,
    paid_until: null,
    payment_ref: null,
    question_quota: planQuota('free', env),
  });
}
