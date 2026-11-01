/** Plans and checkout (docs/billing/README.md). The gateway webhook has its own Lambda, because OAC refuses its POST. */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { paymentGatewayFor } from './gateway.js';
import { pickRegion, viewerCountry } from './geo.js';
import { PLANS, PLAN_CODES, currencyForRegion, effectivePlan, isInterval, isPlanCode } from './plans.js';
import { QuestionGate } from './questionGate.js';
import { PrismaPlanStore, type PlanStore } from './store.js';

export interface BillingRouteDeps {
  prisma: PrismaClient;
  getUserId: (req: express.Request) => string | null;
  /** tests */
  store?: PlanStore;
  enabled?: boolean;
}

export function registerBillingRoutes(app: express.Express, deps: BillingRouteDeps): void {
  const store = (): PlanStore => deps.store ?? new PrismaPlanStore(deps.prisma);
  const gate = (): QuestionGate => new QuestionGate(store(), deps.enabled === undefined ? {} : { enabled: deps.enabled });

  app.get('/api/billing/plans', async (req, res) => {
    const country = viewerCountry(req);
    const userId = deps.getUserId(req);
    const account = userId ? await store().getAccount(userId).catch(() => null) : null;
    const paying = account && effectivePlan(account) !== 'free' ? account.billing_country : null;
    const region = pickRegion({ billingCountry: paying, requested: req.query.region, country });
    const currency = currencyForRegion(region);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
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
          limit: plan.limit,
          window: plan.window,
          prices: prices
            ? { month: { amount_minor: prices.month, currency }, year: { amount_minor: prices.year, currency } }
            : null,
        };
      }),
    });
  });

  app.post('/api/billing/checkout', async (req, res) => {
    const userId = deps.getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { plan, interval, region: requested } = (req.body ?? {}) as { plan?: unknown; interval?: unknown; region?: unknown };
    if (!isPlanCode(plan)) return res.status(400).json({ error: 'invalid_plan' });
    if (plan !== 'free' && !isInterval(interval)) return res.status(400).json({ error: 'invalid_plan' });

    const country = viewerCountry(req);
    const region = pickRegion({ requested, country });
    const currency = currencyForRegion(region);
    try {
      await store().setDesired(userId, plan, plan === 'free' ? null : (interval as string), region, new Date());
      const usage = await gate().getStatus(userId);
      const gateway = plan === 'free' ? null : paymentGatewayFor(currency);
      if (!gateway || plan === 'free' || !isInterval(interval)) return res.json({ status: 'pending_payment', checkout_url: null, plan: usage });
      const user = await deps.prisma.auth.findUnique({ where: { id: userId }, select: { email: true } });
      const { url } = await gateway.createCheckout({
        userId,
        email: user?.email ?? null,
        plan,
        interval,
        currency,
        amountMinor: PLANS[plan].prices?.[currency][interval] ?? 0,
      });
      return res.json({ status: 'redirect', checkout_url: url, plan: usage });
    } catch (err) {
      console.error('[billing] checkout failed:', (err as Error).message);
      return res.status(503).json({ error: 'billing_unavailable' });
    }
  });
}
