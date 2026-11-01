/**
 * The payment side: the only code that writes is_paid. Today scripts/billing-set-paid.ts calls it; a verified gateway
 * webhook calls it later. Nothing else about payment is read when a question is asked.
 */
import type { PlanCode, Interval } from './plans.js';
import type { BillingAccountRow, PlanStore } from './store.js';

export interface PaidDetails {
  plan: Exclude<PlanCode, 'free'>;
  interval: Interval;
  /** when the payment runs out; null means until cleared */
  paidUntil: Date | null;
  /** the gateway's subscription id, or a note for a manual change */
  paymentRef?: string | null;
  now?: Date;
}

/** A renewal of the same plan keeps `paid_since`, so the monthly question window does not move. */
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
  });
}

/** Back to Free. The lifetime free count is kept, so cancelling never gives new free questions. */
export function clearPaid(store: PlanStore, userId: string): Promise<BillingAccountRow> {
  return store.setPayment(userId, { is_paid: false, paid_plan: null, paid_interval: null, paid_since: null, paid_until: null, payment_ref: null });
}
