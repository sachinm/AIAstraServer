/**
 * The journal of one question (docs/reading-engine/39 §4.1). It holds every agent's response in memory, gives the readers'
 * responses to the Oracle through the brief, and writes them to `reading_agent_responses` only after the Oracle and validator
 * have finished. It is plain code, not a model: an LLM here would add cost and time and could only lose or change what it holds.
 *
 * The write is awaited inside the request, because a Lambda freezes once the response is sent. It runs once, retries once, and
 * never throws: a failed journal write must not lose an answer.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { usageCostUsd } from '../llm/models.js';
import type { Usage } from '../types.js';

export type AgentKind = 'reader' | 'oracle' | 'validator';
export type AgentStatus = 'ok' | 'failed' | 'skipped' | 'cached';
export type AgentSource = 'live' | 'prewarm' | 'cache';

export interface JournalEntry {
  agent: string;
  agentKind: AgentKind;
  /** 1 first pass, 2 the validator's loop */
  round: number;
  subject?: string | null;
  model?: string | null;
  promptName?: string | null;
  promptSent?: string | null;
  dataKeys?: string[];
  dataHash?: string | null;
  /** how it digested the data: verdict, score, its own account, gaps, disagreement */
  digest?: unknown;
  /** what it highlighted: claims, windows, quotes, actors, graces, pointers */
  highlights?: unknown;
  status: AgentStatus;
  failureReason?: string | null;
  source: AgentSource;
  usage?: Usage | null;
  /** when a guard reservation stood in for a missing usage report */
  costUsd?: number;
  ms?: number;
}

export interface JournalIdentity {
  runId: string;
  userId: string;
  question: string;
  tier: number;
  promptVersion: string;
  asOf: string;
}

export type JournalWriter = (rows: Prisma.ReadingAgentResponseCreateManyInput[]) => Promise<unknown>;

export function prismaJournalWriter(db: Pick<PrismaClient, 'readingAgentResponse'>): JournalWriter {
  return (rows) => db.readingAgentResponse.createMany({ data: rows });
}

export class ReadingJournal {
  private entries: JournalEntry[] = [];
  private flushed = false;

  constructor(readonly id: JournalIdentity) {}

  record(e: JournalEntry): void {
    this.entries.push(e);
  }

  all(): readonly JournalEntry[] {
    return this.entries;
  }

  readers(round?: number): JournalEntry[] {
    return this.entries.filter((e) => e.agentKind === 'reader' && (round === undefined || e.round === round));
  }

  /** The rows as they will be stored. */
  rows(place: { chatId?: string | null; messageId?: string | null } = {}): Prisma.ReadingAgentResponseCreateManyInput[] {
    return this.entries.map((e) => ({
      id: randomUUID(),
      run_id: this.id.runId,
      user_id: this.id.userId,
      chat_id: place.chatId ?? null,
      message_id: place.messageId ?? null,
      question: this.id.question,
      agent: e.agent,
      agent_kind: e.agentKind,
      round: e.round,
      subject: e.subject ?? null,
      tier: this.id.tier,
      model: e.model ?? null,
      prompt_name: e.promptName ?? null,
      prompt_version: this.id.promptVersion,
      prompt_sent: e.promptSent ?? null,
      data_keys: (e.dataKeys ?? []) as Prisma.InputJsonValue,
      data_hash: e.dataHash ?? null,
      digest: (e.digest ?? {}) as Prisma.InputJsonValue,
      highlights: (e.highlights ?? {}) as Prisma.InputJsonValue,
      status: e.status,
      failure_reason: e.failureReason ?? null,
      source: e.source,
      prompt_tokens: e.usage?.promptTokens ?? 0,
      cached_tokens: e.usage?.cachedTokens ?? 0,
      output_tokens: e.usage?.outputTokens ?? 0,
      thought_tokens: e.usage?.thoughtTokens ?? 0,
      cost_usd: e.costUsd ?? (e.usage ? usageCostUsd(e.usage, this.id.asOf) : 0),
      ms: e.ms ?? 0,
    }));
  }

  /** Writes every held response, once. Returns how many rows were written (0 when the write failed or already ran). */
  async flush(write: JournalWriter, place: { chatId?: string | null; messageId?: string | null } = {}): Promise<number> {
    if (this.flushed || this.entries.length === 0) return 0;
    this.flushed = true;
    const rows = this.rows(place);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await write(rows);
        return rows.length;
      } catch (err) {
        // no prompt or model text in the log: the rows can quote the chart
        console.error(JSON.stringify({ msg: 'reading journal write failed', runId: this.id.runId, attempt, rows: rows.length, error: (err as Error).message.slice(0, 200) }));
      }
    }
    return 0;
  }
}
