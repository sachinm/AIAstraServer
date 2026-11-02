/**
 * The visit log and the assistant's questions (migration assistant_m1). See docs/security/assistant-log-controls.md for
 * what is kept, why, for how long and who may read it.
 */
import type { PrismaClient } from '@prisma/client';

export interface VisitFacts {
  visitId: string;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  language: string | null;
  referrer: string | null;
  path: string | null;
}

export interface QuestionFacts {
  visitId: string;
  ip: string | null;
  question: string;
  answer: string;
  verdict: string;
  outcome: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
}

export interface AssistantStore {
  recordVisit(v: VisitFacts, now: Date): Promise<void>;
  recordQuestion(q: QuestionFacts, now: Date): Promise<void>;
  /** model answers given in this window: to this visit, and across the site */
  counts(visitId: string, now: Date): Promise<{ visitLastHour: number; siteToday: number }>;
  /** removes what is past its retention; returns what it did */
  purge(now: Date): Promise<{ questions: number; visits: number; ipsCleared: number }>;
}

/** The address with its last part dropped, kept longer than the full address: /24 for IPv4, /48 for IPv6. */
export function ipPrefix(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}::/48`;
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.0/24` : null;
}

export const RETENTION_DAYS = { fullIp: 30, questions: 90, visits: 400 };

const DAY_MS = 86_400_000;
const trim = (s: string | null, max: number): string | null => (s ? s.slice(0, max) : null);

export class PrismaAssistantStore implements AssistantStore {
  constructor(private readonly db: PrismaClient) {}

  async recordVisit(v: VisitFacts, now: Date): Promise<void> {
    const day = now.toISOString().slice(0, 10);
    await this.db.$executeRaw`
      INSERT INTO assistant_visits (visit_id, day, first_seen_at, last_seen_at, ip_prefix, ip_full, user_agent, country, language, referrer, landing_path)
      VALUES (${v.visitId}, ${day}::date, ${now}, ${now}, ${ipPrefix(v.ip)}, ${v.ip}, ${trim(v.userAgent, 400)}, ${trim(v.country, 8)}, ${trim(v.language, 64)}, ${trim(v.referrer, 400)}, ${trim(v.path, 200)})
      ON CONFLICT (visit_id, day) DO UPDATE SET last_seen_at = ${now}`;
  }

  async recordQuestion(q: QuestionFacts, now: Date): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO assistant_questions (visit_id, asked_at, ip, question, answer, verdict, outcome, model, tokens_in, tokens_out, latency_ms)
      VALUES (${q.visitId}, ${now}, ${q.ip}, ${q.question}, ${q.answer}, ${q.verdict}, ${q.outcome}, ${q.model}, ${q.tokensIn}, ${q.tokensOut}, ${q.latencyMs})`;
  }

  async counts(visitId: string, now: Date): Promise<{ visitLastHour: number; siteToday: number }> {
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const rows = await this.db.$queryRaw<{ visit: bigint; site: bigint }[]>`
      SELECT
        count(*) FILTER (WHERE visit_id = ${visitId} AND asked_at >= ${hourAgo}) AS visit,
        count(*) FILTER (WHERE model IS NOT NULL AND asked_at >= ${dayStart}) AS site
      FROM assistant_questions WHERE asked_at >= ${dayStart} OR asked_at >= ${hourAgo}`;
    return { visitLastHour: Number(rows[0]?.visit ?? 0), siteToday: Number(rows[0]?.site ?? 0) };
  }

  async purge(now: Date): Promise<{ questions: number; visits: number; ipsCleared: number }> {
    const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const ipsCleared = await this.db.$executeRaw`UPDATE assistant_visits SET ip_full = NULL WHERE ip_full IS NOT NULL AND legal_hold = false AND first_seen_at < ${ago(RETENTION_DAYS.fullIp)}`;
    const questions = await this.db.$executeRaw`DELETE FROM assistant_questions WHERE legal_hold = false AND asked_at < ${ago(RETENTION_DAYS.questions)}`;
    const visits = await this.db.$executeRaw`DELETE FROM assistant_visits WHERE legal_hold = false AND first_seen_at < ${ago(RETENTION_DAYS.visits)}`;
    return { questions, visits, ipsCleared };
  }
}
