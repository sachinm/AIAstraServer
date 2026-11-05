/**
 * Sets or clears the paid flag by hand, until a gateway does it. This writes to the database in DATABASE_URL.
 *
 *   npm run billing:set-paid -- --email a@b.com --plan plus --interval month --until 2026-12-01
 *   npm run billing:set-paid -- --email a@b.com --clear
 *   npm run billing:set-paid -- --email a@b.com --quota 40     (this account's monthly maximum; "none" is unlimited)
 *   npm run billing:set-paid -- --email a@b.com --research on  (or off: the full charts in the chat's right sidebar)
 */
import 'dotenv/config';
// the shared client, so the lookup and writes pass through the PII extension (docs/privacy/02 B1.4)
import { prisma as db } from '../src/lib/prisma.js';
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
  try {
    const user = await db.auth.findFirst({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`no user with email ${email}`);
    const store = new PrismaPlanStore(db);
    const quota = arg('quota');
    const research = arg('research');
    if (research !== undefined) {
      if (research !== 'on' && research !== 'off') throw new Error('--research must be on or off');
      await db.auth.update({ where: { id: user.id }, data: { research: research === 'on' } });
    } else if (quota !== undefined) {
      if (quota !== 'none' && !/^\d+$/.test(quota)) throw new Error('--quota must be a whole number or none');
      await store.setQuota(user.id, quota === 'none' ? null : Number(quota));
    } else if (process.argv.includes('--clear')) {
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
