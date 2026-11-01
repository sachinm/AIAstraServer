import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { registerBillingRoutes } from '../../../src/billing/routes.js';
import type { PlanStore } from '../../../src/billing/store.js';

describe('billing routes', () => {
  let server: ReturnType<express.Express['listen']>;
  let base = '';
  const setDesired = vi.fn().mockResolvedValue({});
  const store = {
    getAccount: vi.fn().mockResolvedValue(null),
    setDesired,
    getRole: vi.fn().mockResolvedValue('novice'),
    staleReservations: vi.fn().mockResolvedValue([]),
  } as unknown as PlanStore;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerBillingRoutes(app, {
      prisma: {} as PrismaClient,
      getUserId: (req) => (req.headers.authorization ? 'u1' : null),
      store,
      enabled: true,
      env: { PLAN_FREE_QUESTIONS: '20', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv,
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
  });

  const post = (body: unknown, auth = true) =>
    fetch(`${base}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer x' } : {}) },
      body: JSON.stringify(body),
    });

  it('serves dollars by default and rupees for an India viewer, uncached', async () => {
    const us = await fetch(`${base}/api/billing/plans`, { headers: { 'CloudFront-Viewer-Country': 'US' } });
    expect(us.headers.get('cache-control')).toBe('no-store');
    const usBody = await us.json();
    expect(usBody).toMatchObject({ country: 'US', region: 'US', currency: 'USD', gateway: null });
    const plus = usBody.plans.find((p: { code: string }) => p.code === 'plus');
    expect(plus.limit).toBe(100);
    expect(usBody.plans.find((p: { code: string }) => p.code === 'unlimited').limit).toBeNull();
    expect(plus.prices.month).toEqual({ amount_minor: 5000, currency: 'USD' });
    expect(plus.prices.year).toEqual({ amount_minor: 50000, currency: 'USD' });
    expect(usBody.plans.find((p: { code: string }) => p.code === 'free').prices).toBeNull();

    const india = await (await fetch(`${base}/api/billing/plans`, { headers: { 'CloudFront-Viewer-Country': 'IN' } })).json();
    expect(india).toMatchObject({ region: 'IN', currency: 'INR' });
  });

  it('keeps every rupee monthly price under the Rs 15,000 mandate limit', async () => {
    const india = await (await fetch(`${base}/api/billing/plans?region=IN`)).json();
    for (const p of india.plans) if (p.prices) expect(p.prices.month.amount_minor).toBeLessThanOrEqual(1_500_000);
  });

  it('lets the homepage switch choose the region', async () => {
    const body = await (await fetch(`${base}/api/billing/plans?region=IN`, { headers: { 'CloudFront-Viewer-Country': 'US' } })).json();
    expect(body).toMatchObject({ country: 'US', region: 'IN', currency: 'INR' });
  });

  it('checkout saves the choice and asks for no payment while no gateway is set', async () => {
    const res = await post({ plan: 'plus', interval: 'year', region: 'IN' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'pending_payment', checkout_url: null, plan: { code: 'free', limit: 20 } });
    expect(setDesired).toHaveBeenCalledWith('u1', 'plus', 'year', 'IN', expect.any(Date), 20);
  });

  it('checkout refuses a bad plan and a signed-out person', async () => {
    expect((await post({ plan: 'gold', interval: 'month' })).status).toBe(400);
    expect((await post({ plan: 'plus', interval: 'week' })).status).toBe(400);
    expect((await post({ plan: 'plus', interval: 'month' }, false)).status).toBe(401);
  });
});
