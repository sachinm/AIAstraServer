/**
 * The seam for a payment gateway. Hosted checkout only, so no card data reaches this server. Payment confirmation comes
 * from a signed webhook calling markPaid (account.ts), never from the page the person returns to.
 */
import type { Currency, Interval, PlanCode } from './plans.js';

export interface CheckoutRequest {
  userId: string;
  email: string | null;
  plan: Exclude<PlanCode, 'free'>;
  interval: Interval;
  currency: Currency;
  amountMinor: number;
}

export interface PaymentGateway {
  name: string;
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
}

/** Null until a gateway is configured: a chosen plan is saved as desired, and the person stays on Free. */
export function paymentGatewayFor(_currency: Currency): PaymentGateway | null {
  return null;
}
