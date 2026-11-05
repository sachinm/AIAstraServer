/**
 * The question limit (docs/billing/README.md). A question is checked before any model runs, reserved when the answer
 * starts, and committed or given back when it ends. A database error here logs and lets the question through.
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { isQuotaExempt } from '../auth/roles.js';
import { effectivePlan, monthFor, planQuota, plansEnabled, unlimitedDailyGuard, type PlanCode, type PlanWindow } from './plans.js';
import { PrismaPlanStore, type BillingAccountRow, type PlanStore } from './store.js';

/** Twice the Lambda's 300 s limit, so such a reservation belongs to a dead run. */
const STALE_RESERVATION_MS = 10 * 60_000;
const OPEN_PART_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** `me.plan`, and the usage sent to the client. */
export interface PlanStatus {
  code: PlanCode;
  desired_plan: string;
  desired_interval: string | null;
  is_paid: boolean;
  interval: string | null;
  used: number;
  limit: number | null;
  remaining: number | null;
  window: PlanWindow;
  resets_at: string | null;
  exempt: boolean;
}

/** A held question; `id` is null when nothing was counted. */
export interface QuestionTicket {
  id: string | null;
  periodStart: Date | null;
  userId: string;
}

export type CheckResult = { ok: true } | { ok: false; usage: PlanStatus };
export type ReserveResult = { ok: true; ticket: QuestionTicket } | { ok: false; usage: PlanStatus };

const FREE_TICKET = (userId: string): QuestionTicket => ({ id: null, periodStart: null, userId });

export class QuestionGate {
  constructor(
    private readonly store: PlanStore,
    private readonly opts: { enabled?: boolean; now?: () => Date; env?: NodeJS.ProcessEnv } = {}
  ) {}

  private get enabled(): boolean {
    return this.opts.enabled ?? plansEnabled();
  }

  private now(): Date {
    return this.opts.now?.() ?? new Date();
  }

  /** The account's own column governs. A lapsed paid account has not been reset yet, so it gets the free quota. */
  private quota(a: BillingAccountRow | null, code: PlanCode): number | null {
    if (code === 'unlimited') return null;
    if (!a || (code === 'free' && a.is_paid)) return planQuota('free', this.opts.env);
    return a.question_quota;
  }

  private month(a: BillingAccountRow | null, code: PlanCode) {
    return monthFor(code === 'free' ? null : (a?.paid_since ?? null), this.now());
  }

  private status(a: BillingAccountRow | null, exempt: boolean): PlanStatus {
    const code = effectivePlan(a, this.now());
    const base = {
      code,
      desired_plan: a?.desired_plan ?? 'free',
      desired_interval: a?.desired_interval ?? null,
      is_paid: code !== 'free',
      interval: code !== 'free' ? (a?.paid_interval ?? null) : null,
    };
    if (exempt) return { ...base, used: 0, limit: null, remaining: null, window: 'none', resets_at: null, exempt: true };
    const month = this.month(a, code);
    const used = a?.usage_month_start?.getTime() === month.start.getTime() ? (a?.questions_used_this_month ?? 0) : 0;
    const limit = this.quota(a, code);
    return {
      ...base,
      used,
      limit,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      window: 'month',
      resets_at: month.end.toISOString(),
      exempt: false,
    };
  }

  /** The usage to refuse with when an Unlimited account has reached today's guard, else null. */
  private async guardHit(userId: string, a: BillingAccountRow | null): Promise<PlanStatus | null> {
    if (effectivePlan(a, this.now()) !== 'unlimited') return null;
    const limit = unlimitedDailyGuard(this.opts.env);
    if (limit === null) return null;
    const n = this.now();
    const start = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const used = await this.store.countQuestionsSince(userId, start);
    if (used < limit) return null;
    return { ...this.status(a, false), used, limit, remaining: 0, window: 'day', resets_at: new Date(start.getTime() + DAY_MS).toISOString() };
  }

  private async isExempt(userId: string): Promise<boolean> {
    return isQuotaExempt(await this.store.getRole(userId));
  }

/** The plan for `me`; null when limits are off or could not be read. */
  async getStatus(userId: string): Promise<PlanStatus | null> {
    if (!this.enabled) return null;
    try {
      await this.releaseStale(userId);
      const [account, exempt] = await Promise.all([this.store.getAccount(userId), this.isExempt(userId)]);
      return this.status(account, exempt);
    } catch (err) {
      console.error('[plans] status failed:', (err as Error).message);
      return null;
    }
  }

  /** May this person start a question? Costs nothing, and runs before the clarify card. */
  async check(userId: string, opts: { focus?: string } = {}): Promise<CheckResult> {
    if (!this.enabled) return { ok: true };
    try {
      if (await this.isExempt(userId)) return { ok: true };
      await this.releaseStale(userId);
      if (opts.focus && (await this.store.findOpenPart(userId, opts.focus, this.partsSince()))) return { ok: true };
      const account = await this.store.getAccount(userId);
      const hit = await this.guardHit(userId, account);
      if (hit) return { ok: false, usage: hit };
      const usage = this.status(account, false);
      return usage.remaining === 0 ? { ok: false, usage } : { ok: true };
    } catch (err) {
      console.error('[plans] check failed, allowing:', (err as Error).message);
      return { ok: true };
    }
  }

  /**
   * Takes one question. `key` makes a replay free (clarify:<runId>). A `focus` the server recorded as an open part of a
   * question already charged costs nothing; any other `focus` is charged like a new question.
   */
  async reserve(userId: string, opts: { key?: string; focus?: string } = {}): Promise<ReserveResult> {
    if (!this.enabled) return { ok: true, ticket: FREE_TICKET(userId) };
    try {
      if (await this.isExempt(userId)) return { ok: true, ticket: FREE_TICKET(userId) };
      if (opts.focus) {
        const row = await this.store.findOpenPart(userId, opts.focus, this.partsSince());
        if (row && (await this.store.takeOpenPart(row, opts.focus))) return { ok: true, ticket: FREE_TICKET(userId) };
      }
      const key = opts.key ?? randomUUID();
      if (opts.key) {
        const earlier = await this.store.findUsage(userId, key);
        // a retry after a failed answer is charged again, since that failure was given back
        if (earlier && earlier.status !== 'released') return { ok: true, ticket: FREE_TICKET(userId) };
        if (earlier) await this.store.deleteUsage(earlier.id);
      }

      const account = await this.store.ensureAccount(userId, planQuota('free', this.opts.env));
      const code = effectivePlan(account, this.now());
      const periodStart = this.month(account, code).start;
      const hit = await this.guardHit(userId, account);
      if (hit) return { ok: false, usage: hit };

      const row = await this.store.insertUsage(userId, key, periodStart);
      if (!row) return { ok: true, ticket: FREE_TICKET(userId) };
      if (!(await this.store.takeQuestion(userId, periodStart, this.quota(account, code)))) {
        await this.store.deleteUsage(row.id);
        return { ok: false, usage: this.status(await this.store.getAccount(userId), false) };
      }
      return { ok: true, ticket: { id: row.id, periodStart, userId } };
    } catch (err) {
      console.error('[plans] reserve failed, allowing:', (err as Error).message);
      return { ok: true, ticket: FREE_TICKET(userId) };
    }
  }

  /** The answer was delivered. `openParts` are the later parts of this question, which stay free for an hour. */
  async commit(ticket: QuestionTicket, data: { chatId?: string; messageId?: string; openParts?: string[] } = {}): Promise<void> {
    if (!ticket.id) return;
    try {
      await this.store.settleUsage(ticket.id, 'committed', data, this.now());
    } catch (err) {
      console.error('[plans] commit failed:', (err as Error).message);
    }
  }

  /** The answer failed or was declined: the question is given back. */
  async release(ticket: QuestionTicket): Promise<void> {
    if (!ticket.id) return;
    try {
      if (!(await this.store.settleUsage(ticket.id, 'released', {}, this.now()))) return;
      if (ticket.periodStart) await this.store.giveBackQuestion(ticket.userId, ticket.periodStart);
    } catch (err) {
      console.error('[plans] release failed:', (err as Error).message);
    }
  }

  private partsSince(): Date {
    return new Date(this.now().getTime() - OPEN_PART_MS);
  }

  private async releaseStale(userId: string): Promise<void> {
    const stale = await this.store.staleReservations(userId, new Date(this.now().getTime() - STALE_RESERVATION_MS));
    for (const row of stale) {
      if (await this.store.settleUsage(row.id, 'released', {}, this.now())) await this.store.giveBackQuestion(userId, row.period_start);
    }
  }
}

export function questionGate(db: PrismaClient): QuestionGate {
  return new QuestionGate(new PrismaPlanStore(db));
}

/** The later parts a reading announced, from its `next` event. */
export function partsFromEvent(event: unknown): string[] | null {
  const e = event as { type?: unknown; parts?: unknown } | null;
  if (e?.type !== 'next' || !Array.isArray(e.parts)) return null;
  return e.parts.map((p) => (p as { id?: unknown })?.id).filter((id): id is string => typeof id === 'string');
}

/** A declined topic is answered by policy, with no reading, so it is not charged. */
export function wasDeclined(result: { requestPayload?: unknown }): boolean {
  return (result.requestPayload as { engine?: unknown } | null | undefined)?.engine === 'policy';
}

/** 402 body for a question over the limit. */
export function quotaBody(usage: PlanStatus): { error: string; code: 'quota_exhausted'; usage: PlanStatus } {
  return { error: 'Question limit reached', code: 'quota_exhausted', usage };
}
