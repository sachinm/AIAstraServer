/**
 * Where a clarify conversation lives between HTTP requests. On Lambda the next request can land on another instance,
 * so the state is kept in `reading_runs` (status 'clarifying' → 'confirmed' | 'abandoned', state in `intent`, the
 * confirmed intent in `intent_confirmed`). No schema change: these columns exist since migration M4.
 * A memory store backs the tests and local demos.
 */
import type { PrismaClient } from '@prisma/client';
import { PROMPT_VERSION } from '../prompts/generated.js';
import { expireIfStale, type ClarifyState } from './machine.js';

export interface ClarifyStore {
  create(userId: string, state: ClarifyState): Promise<string>;
  get(userId: string, runId: string): Promise<ClarifyState | null>;
  save(userId: string, runId: string, state: ClarifyState): Promise<void>;
}

export class MemoryClarifyStore implements ClarifyStore {
  private rows = new Map<string, { userId: string; state: ClarifyState }>();
  private n = 0;
  async create(userId: string, state: ClarifyState): Promise<string> {
    const id = `clarify-${++this.n}`;
    this.rows.set(id, { userId, state });
    return id;
  }
  async get(userId: string, runId: string): Promise<ClarifyState | null> {
    const r = this.rows.get(runId);
    if (!r || r.userId !== userId) return null;
    const s = expireIfStale(r.state);
    if (s !== r.state) this.rows.set(runId, { userId, state: s });
    return s;
  }
  async save(userId: string, runId: string, state: ClarifyState): Promise<void> {
    const r = this.rows.get(runId);
    if (r && r.userId === userId) this.rows.set(runId, { userId, state });
  }
}

const statusFor = (s: ClarifyState): string => (s.status === 'CONFIRMED' ? 'confirmed' : s.status === 'ABANDONED' ? 'abandoned' : 'clarifying');

export class PrismaClarifyStore implements ClarifyStore {
  constructor(private prisma: PrismaClient) {}
  async create(userId: string, state: ClarifyState): Promise<string> {
    const row = await this.prisma.readingRun.create({
      data: { user_id: userId, status: statusFor(state), question: state.question, intent: { clarify: state } as unknown as object, prompt_version: PROMPT_VERSION },
      select: { id: true },
    });
    return row.id;
  }
  async get(userId: string, runId: string): Promise<ClarifyState | null> {
    const row = await this.prisma.readingRun.findFirst({ where: { id: runId, user_id: userId }, select: { intent: true } });
    const raw = (row?.intent as { clarify?: ClarifyState } | null)?.clarify;
    if (!raw || raw.v !== 1) return null;
    const s = expireIfStale(raw);
    if (s !== raw) await this.save(userId, runId, s);
    return s;
  }
  async save(userId: string, runId: string, state: ClarifyState): Promise<void> {
    await this.prisma.readingRun.updateMany({
      where: { id: runId, user_id: userId },
      data: {
        status: statusFor(state),
        intent: { clarify: state } as unknown as object,
        ...(state.status === 'CONFIRMED' ? { intent_confirmed: { bucket: state.bucket, subBucket: state.subBucket, slots: state.slots, exactQuery: state.exactQuery, assumed: state.assumed } as unknown as object, completed_at: new Date() } : {}),
      },
    });
  }
}
