/**
 * Storage for plans and usage. Every counter change is one conditional UPDATE, which Postgres re-checks under the row
 * lock, so two requests cannot both take the last question, and it runs on the pooler with no open transaction.
 */
import type { PrismaClient } from '@prisma/client';

export interface BillingAccountRow {
  user_id: string;
  desired_plan: string;
  desired_interval: string | null;
  is_paid: boolean;
  paid_plan: string | null;
  paid_interval: string | null;
  paid_since: Date | null;
  paid_until: Date | null;
  billing_country: string | null;
  free_used: number;
  period_start: Date | null;
  period_used: number;
}

export interface UsageRow {
  id: string;
  user_id: string;
  key: string;
  counter: string;
  period_start: Date | null;
  status: string;
  open_parts: string[];
  created_at: Date;
}

export interface PaymentWrite {
  is_paid: boolean;
  paid_plan: string | null;
  paid_interval: string | null;
  paid_since: Date | null;
  paid_until: Date | null;
  payment_ref: string | null;
}

export interface PlanStore {
  getRole(userId: string): Promise<string | null>;
  getAccount(userId: string): Promise<BillingAccountRow | null>;
  ensureAccount(userId: string): Promise<BillingAccountRow>;
  setDesired(userId: string, plan: string, interval: string | null, country: string | null, now: Date): Promise<BillingAccountRow>;
  setPayment(userId: string, payment: PaymentWrite): Promise<BillingAccountRow>;
  /** true when a free question was taken */
  takeFree(userId: string, limit: number): Promise<boolean>;
  /** true when a question in the window starting at `start` was taken */
  takePeriod(userId: string, start: Date, limit: number): Promise<boolean>;
  giveBackFree(userId: string): Promise<void>;
  giveBackPeriod(userId: string, start: Date): Promise<void>;
  /** null when the key already exists */
  insertUsage(userId: string, key: string, counter: string, periodStart: Date | null): Promise<UsageRow | null>;
  findUsage(userId: string, key: string): Promise<UsageRow | null>;
  deleteUsage(id: string): Promise<void>;
  /** true when this call moved the row out of `reserved` */
  settleUsage(id: string, status: 'committed' | 'released', data: { chatId?: string; messageId?: string; openParts?: string[] }, now: Date): Promise<boolean>;
  staleReservations(userId: string, before: Date): Promise<UsageRow[]>;
  /** the newest committed row after `since` that still has this part open */
  findOpenPart(userId: string, part: string, since: Date): Promise<UsageRow | null>;
  /** true when this call removed the part, so a part is free only once */
  takeOpenPart(row: UsageRow, part: string): Promise<boolean>;
}

const isUniqueViolation = (err: unknown): boolean => (err as { code?: string } | null)?.code === 'P2002';

export class PrismaPlanStore implements PlanStore {
  constructor(private readonly db: PrismaClient) {}

  async getRole(userId: string): Promise<string | null> {
    const u = await this.db.auth.findUnique({ where: { id: userId }, select: { role: true } });
    return u?.role ?? null;
  }

  getAccount(userId: string): Promise<BillingAccountRow | null> {
    return this.db.billingAccount.findUnique({ where: { user_id: userId } });
  }

  ensureAccount(userId: string): Promise<BillingAccountRow> {
    return this.db.billingAccount.upsert({ where: { user_id: userId }, create: { user_id: userId }, update: {} });
  }

  setDesired(userId: string, plan: string, interval: string | null, country: string | null, now: Date): Promise<BillingAccountRow> {
    const data = { desired_plan: plan, desired_interval: interval, desired_at: now, ...(country ? { billing_country: country } : {}) };
    return this.db.billingAccount.upsert({ where: { user_id: userId }, create: { user_id: userId, ...data }, update: data });
  }

  setPayment(userId: string, payment: PaymentWrite): Promise<BillingAccountRow> {
    return this.db.billingAccount.upsert({ where: { user_id: userId }, create: { user_id: userId, ...payment }, update: payment });
  }

  async takeFree(userId: string, limit: number): Promise<boolean> {
    const r = await this.db.billingAccount.updateMany({
      where: { user_id: userId, free_used: { lt: limit } },
      data: { free_used: { increment: 1 } },
    });
    return r.count === 1;
  }

  async takePeriod(userId: string, start: Date, limit: number): Promise<boolean> {
    // a new window: only one request wins the reset, and any other falls through to the increment
    const reset = await this.db.billingAccount.updateMany({
      where: { user_id: userId, OR: [{ period_start: null }, { period_start: { not: start } }] },
      data: { period_start: start, period_used: 1 },
    });
    if (reset.count === 1) return true;
    const r = await this.db.billingAccount.updateMany({
      where: { user_id: userId, period_start: start, period_used: { lt: limit } },
      data: { period_used: { increment: 1 } },
    });
    return r.count === 1;
  }

  async giveBackFree(userId: string): Promise<void> {
    await this.db.billingAccount.updateMany({ where: { user_id: userId, free_used: { gt: 0 } }, data: { free_used: { decrement: 1 } } });
  }

  async giveBackPeriod(userId: string, start: Date): Promise<void> {
    await this.db.billingAccount.updateMany({
      where: { user_id: userId, period_start: start, period_used: { gt: 0 } },
      data: { period_used: { decrement: 1 } },
    });
  }

  async insertUsage(userId: string, key: string, counter: string, periodStart: Date | null): Promise<UsageRow | null> {
    try {
      return await this.db.questionUsage.create({ data: { user_id: userId, key, counter, period_start: periodStart } });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  findUsage(userId: string, key: string): Promise<UsageRow | null> {
    return this.db.questionUsage.findUnique({ where: { user_id_key: { user_id: userId, key } } });
  }

  async deleteUsage(id: string): Promise<void> {
    await this.db.questionUsage.deleteMany({ where: { id } });
  }

  async settleUsage(id: string, status: 'committed' | 'released', data: { chatId?: string; messageId?: string; openParts?: string[] }, now: Date): Promise<boolean> {
    const r = await this.db.questionUsage.updateMany({
      where: { id, status: 'reserved' },
      data: {
        status,
        settled_at: now,
        ...(data.chatId ? { chat_id: data.chatId } : {}),
        ...(data.messageId ? { message_id: data.messageId } : {}),
        ...(data.openParts ? { open_parts: data.openParts } : {}),
      },
    });
    return r.count === 1;
  }

  staleReservations(userId: string, before: Date): Promise<UsageRow[]> {
    return this.db.questionUsage.findMany({ where: { user_id: userId, status: 'reserved', created_at: { lt: before } } });
  }

  findOpenPart(userId: string, part: string, since: Date): Promise<UsageRow | null> {
    return this.db.questionUsage.findFirst({
      where: { user_id: userId, status: 'committed', created_at: { gte: since }, open_parts: { has: part } },
      orderBy: { created_at: 'desc' },
    });
  }

  async takeOpenPart(row: UsageRow, part: string): Promise<boolean> {
    // conditional on the array as read: of two requests for one part, the second matches nothing
    const r = await this.db.questionUsage.updateMany({
      where: { id: row.id, open_parts: { equals: row.open_parts } },
      data: { open_parts: row.open_parts.filter((p) => p !== part) },
    });
    return r.count === 1;
  }
}
