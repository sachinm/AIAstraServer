/** The plan catalog and the access rule (docs/billing/README.md). Question limits come from env, never from this file. */

export const PLAN_CODES = ['free', 'plus', 'unlimited'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const INTERVALS = ['month', 'year'] as const;
export type Interval = (typeof INTERVALS)[number];

export type PlanWindow = 'month' | 'none';
export type Currency = 'USD' | 'INR';
export type Region = 'US' | 'IN';

export interface Plan {
  code: PlanCode;
  name: string;
  /** minor units (cents, paise), by interval; null for free */
  prices: Record<Currency, Record<Interval, number>> | null;
}

export const PLANS: Record<PlanCode, Plan> = {
  free: { code: 'free', name: 'Free', prices: null },
  plus: {
    code: 'plus',
    name: 'Plus',
    prices: {
      USD: { month: 5_000, year: 50_000 },
      INR: { month: 249_900, year: 2_499_900 },
    },
  },
  unlimited: {
    code: 'unlimited',
    name: 'Unlimited',
    prices: {
      USD: { month: 20_000, year: 200_000 },
      INR: { month: 999_900, year: 9_999_900 },
    },
  },
};

/** Staff are never counted. */
export const EXEMPT_ROLES: readonly string[] = ['support', 'admin', 'superadmin', 'aiastra_admin', 'astrologer'];

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === 'string' && (PLAN_CODES as readonly string[]).includes(v);
}

export function isInterval(v: unknown): v is Interval {
  return typeof v === 'string' && (INTERVALS as readonly string[]).includes(v);
}

export function plansEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.PLANS_ENABLED?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

/**
 * A plan's monthly questions, from PLAN_FREE_QUESTIONS and PLAN_PLUS_QUESTIONS (set on the Lambda); null is unlimited.
 * Throws when one is missing: there is no number to fall back on in the code.
 */
export function planQuota(code: PlanCode, env: NodeJS.ProcessEnv = process.env): number | null {
  if (code === 'unlimited') return null;
  const name = code === 'free' ? 'PLAN_FREE_QUESTIONS' : 'PLAN_PLUS_QUESTIONS';
  const raw = env[name]?.trim();
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number`);
  return n;
}

export interface PaymentState {
  is_paid: boolean;
  paid_plan: string | null;
  paid_until: Date | null;
}

/** The access rule, and the only place it is written: the flag and what the payment covers decide the plan. */
export function effectivePlan(a: PaymentState | null, now: Date = new Date()): PlanCode {
  if (!a?.is_paid || !isPlanCode(a.paid_plan)) return 'free';
  if (a.paid_until && a.paid_until.getTime() <= now.getTime()) return 'free';
  return a.paid_plan;
}

/** Adds calendar months, keeping to the last day of a shorter month (Jan 31 + 1 is Feb 28). */
function addMonths(d: Date, n: number): Date {
  const day = d.getUTCDate();
  const out = new Date(d.getTime());
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + n);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/** The month holding `now`: from the day payment began, or the calendar month (UTC) on the free plan. */
export function monthFor(anchor: Date | null, now: Date = new Date()): { start: Date; end: Date } {
  if (!anchor) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start, end: addMonths(start, 1) };
  }
  let n = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth();
  if (addMonths(anchor, n).getTime() > now.getTime()) n -= 1;
  n = Math.max(n, 0);
  return { start: addMonths(anchor, n), end: addMonths(anchor, n + 1) };
}

/** Rupees only for India. */
export function currencyForRegion(region: Region): Currency {
  return region === 'IN' ? 'INR' : 'USD';
}
