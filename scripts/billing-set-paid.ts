/**
 * Sets or clears the paid flag by hand, until a gateway does it. This writes to the database in DATABASE_URL.
 *
 *   npm run billing:set-paid -- --email a@b.com --plan plus --interval month --until 2026-12-01
 *   npm run billing:set-paid -- --email a@b.com --clear
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { clearPaid, markPaid } from '../src/billing/account.js';
import { effectivePlan, isInterval, isPlanCode } from '../src/billing/plans.js';
import { PrismaPlanStore } from '../src/billing/store.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg('email')?.trim().toLowerCase();
  if (!email) throw new Error('--email is required');
  const db = new PrismaClient();
  try {
    const user = await db.auth.findFirst({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`no user with email ${email}`);
    const store = new PrismaPlanStore(db);
    if (process.argv.includes('--clear')) {
      await clearPaid(store, user.id);
    } else {
      const plan = arg('plan');
      const interval = arg('interval') ?? 'month';
      const until = arg('until');
      if (!isPlanCode(plan) || plan === 'free') throw new Error('--plan must be plus or unlimited');
      if (!isInterval(interval)) throw new Error('--interval must be month or year');
      const paidUntil = until ? new Date(`${until}T00:00:00Z`) : null;
      if (paidUntil && Number.isNaN(paidUntil.getTime())) throw new Error('--until must be YYYY-MM-DD');
      await markPaid(store, user.id, { plan, interval, paidUntil, paymentRef: 'manual' });
    }
    console.log(`${email}: now on ${effectivePlan(await store.getAccount(user.id))}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
