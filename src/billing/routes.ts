/** Plans and checkout (docs/billing/README.md). The gateway webhook has its own Lambda, because OAC refuses its POST. */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { paymentGatewayFor } from './gateway.js';
import { pickRegion, viewerCountry } from './geo.js';
import { PLANS, PLAN_CODES, currencyForRegion, effectivePlan, isInterval, isPlanCode, planQuota } from './plans.js';
import { QuestionGate } from './questionGate.js';
import { PrismaPlanStore, type PlanStore } from './store.js';
import type { OptionalUser, RequireUser } from '../auth/requestAuth.js';
import { factsFromExpress, recordAccountEvent } from '../audit/accountEvents.js';

export interface BillingRouteDeps {
  prisma: PrismaClient;
  /** writes the 401 itself and returns null (src/auth/requestAuth.ts) */
  requireUser: RequireUser;
  /** the caller, if signed in and not locked; never writes a response (the plan list is public) */
  optionalUser: OptionalUser;
  /** tests */
  store?: PlanStore;
  enabled?: boolean;
  env?: NodeJS.ProcessEnv;
}

export function registerBillingRoutes(app: express.Express, deps: BillingRouteDeps): void {
  const store = (): PlanStore => deps.store ?? new PrismaPlanStore(deps.prisma);
  const gate = (): QuestionGate => new QuestionGate(store(), { ...(deps.enabled === undefined ? {} : { enabled: deps.enabled }), ...(deps.env ? { env: deps.env } : {}) });

  app.get('/api/billing/plans', async (req, res) => {
    const country = viewerCountry(req);
    const userId = await deps.optionalUser(req);
    const account = userId ? await store().getAccount(userId).catch(() => null) : null;
    const paying = account && effectivePlan(account) !== 'free' ? account.billing_country : null;
    const region = pickRegion({ billingCountry: paying, requested: req.query.region, country });
    const currency = currencyForRegion(region);
    res.setHeader('Cache-Control', 'no-store');
    let limits: Record<string, number | null>;
    try {
      limits = Object.fromEntries(PLAN_CODES.map((code) => [code, planQuota(code, deps.env)]));
    } catch (err) {
      console.error('[billing] plans not configured:', (err as Error).message);
      return res.status(503).json({ error: 'plans_not_configured' });
    }
    return res.json({
      country,
      region,
      currency,
      gateway: paymentGatewayFor(currency)?.name ?? null,
      plans: PLAN_CODES.map((code) => {
        const plan = PLANS[code];
        const prices = plan.prices?.[currency];
        return {
          code,
          name: plan.name,
          limit: limits[code],
          window: 'month',
          prices: prices
            ? { month: { amount_minor: prices.month, currency }, year: { amount_minor: prices.year, currency } }
            : null,
        };
      }),
    });
  });

  app.post('/api/billing/checkout', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const { plan, interval, region: requested } = (req.body ?? {}) as { plan?: unknown; interval?: unknown; region?: unknown };
    if (!isPlanCode(plan)) return res.status(400).json({ error: 'invalid_plan' });
    if (plan !== 'free' && !isInterval(interval)) return res.status(400).json({ error: 'invalid_plan' });

    const country = viewerCountry(req);
    const region = pickRegion({ requested, country });
    const currency = currencyForRegion(region);
    const before = await store().getAccount(userId).catch(() => null);
    const audit = (outcome: 'ok' | 'failed', note: string | null): void => {
      void recordAccountEvent(deps.prisma, {
        userId,
        action: 'plan_choice',
        outcome,
        fields: ['desired_plan', 'desired_interval', 'billing_country'],
        before: before ? { desired_plan: before.desired_plan, desired_interval: before.desired_interval, is_paid: before.is_paid, paid_plan: before.paid_plan, billing_country: before.billing_country } : null,
        after: { desired_plan: plan, desired_interval: plan === 'free' ? null : interval, region, currency, viewer_country: country },
        note,
        request: factsFromExpress(req),
      });
    };
    try {
      await store().setDesired(userId, plan, plan === 'free' ? null : (interval as string), region, new Date(), planQuota('free', deps.env));
      const usage = await gate().getStatus(userId);
      const gateway = plan === 'free' ? null : paymentGatewayFor(currency);
      if (!gateway || plan === 'free' || !isInterval(interval)) {
        audit('ok', 'pending_payment');
        return res.json({ status: 'pending_payment', checkout_url: null, plan: usage });
      }
      const user = await deps.prisma.auth.findUnique({ where: { id: userId }, select: { email: true } });
      const { url } = await gateway.createCheckout({
        userId,
        email: user?.email ?? null,
        plan,
        interval,
        currency,
        amountMinor: PLANS[plan].prices?.[currency][interval] ?? 0,
      });
      audit('ok', 'redirect_to_checkout');
      return res.json({ status: 'redirect', checkout_url: url, plan: usage });
    } catch (err) {
      console.error('[billing] checkout failed:', (err as Error).message);
      audit('failed', 'billing_unavailable');
      return res.status(503).json({ error: 'billing_unavailable' });
    }
  });
}
