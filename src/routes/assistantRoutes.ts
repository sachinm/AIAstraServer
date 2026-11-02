/**
 * The public assistant and the visit log (docs/assistant/01). No sign-in on these routes: they hold no account data.
 *
 *   POST /api/assistant/visit  { visitId?, path?, referrer? } -> { visitId }
 *   POST /api/assistant/ask    { question, visitId?, path?, referrer? } -> { answer, verdict, cta, visitId }
 *
 * ASSISTANT_ENABLED=0 turns both off (404). ASSISTANT_DAILY_CAP caps model calls across the site.
 */
import { randomUUID } from 'crypto';
import type express from 'express';
import rateLimit from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { answerQuestion, answerWithoutModel, QUESTION_MAX_CHARS, type ModelCall } from '../assistant/answer.js';
import { UNSURE } from '../assistant/guard.js';
import { PrismaAssistantStore, type AssistantStore } from '../assistant/store.js';
import { loadDeclinedTopics } from '../reading/policy/declined.js';

const VISIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIT_QUESTIONS_PER_HOUR = 10;
const IP_QUESTIONS_PER_HOUR = 30;
const DEFAULT_DAILY_CAP = 2000;
const LIMIT_REPLY = "You've asked a lot for one sitting. Sign up and the sages inside can take it from here.";

export interface AssistantRouteDeps {
  prisma: PrismaClient;
  store?: AssistantStore;
  /** tests: replace the model */
  call?: ModelCall;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export function assistantEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.ASSISTANT_ENABLED?.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

function dailyCap(env: NodeJS.ProcessEnv): number {
  const n = Number(env.ASSISTANT_DAILY_CAP?.trim());
  return Number.isInteger(n) && n >= 0 && env.ASSISTANT_DAILY_CAP?.trim() ? n : DEFAULT_DAILY_CAP;
}

const headerOf = (req: express.Request, name: string): string | null => {
  const v = req.headers[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/** CloudFront's own record of the viewer when it is forwarded; a client can write its own X-Forwarded-For. */
export function clientIp(req: express.Request): string | null {
  const viewer = headerOf(req, 'cloudfront-viewer-address');
  if (viewer) {
    const end = viewer.lastIndexOf(':');
    return (end > 0 ? viewer.slice(0, end) : viewer).replace(/^\[|\]$/g, '').slice(0, 45);
  }
  return req.ip ? req.ip.replace(/^::ffff:/, '').slice(0, 45) : null;
}

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function registerAssistantRoutes(app: express.Express, deps: AssistantRouteDeps): boolean {
  const env = deps.env ?? process.env;
  if (!assistantEnabled(env)) return false;
  const store = deps.store ?? new PrismaAssistantStore(deps.prisma);
  const now = () => deps.now?.() ?? new Date();

  const logVisit = async (req: express.Request, visitId: string) => {
    try {
      await store.recordVisit(
        {
          visitId,
          ip: clientIp(req),
          userAgent: headerOf(req, 'user-agent'),
          country: headerOf(req, 'cloudfront-viewer-country'),
          language: headerOf(req, 'accept-language'),
          referrer: text(req.body?.referrer, 400),
          path: text(req.body?.path, 200),
        },
        now()
      );
    } catch (err) {
      console.warn(JSON.stringify({ msg: 'assistant visit log failed', error: (err as Error).message.slice(0, 200) }));
    }
  };

  const visitIdFrom = (req: express.Request): string => {
    const v = req.body?.visitId;
    return typeof v === 'string' && VISIT_ID.test(v) ? v.toLowerCase() : randomUUID();
  };

  const visitLimit = rateLimit({ windowMs: 3_600_000, limit: 120, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => clientIp(req) ?? 'unknown', validate: false, handler: (_req, res) => void res.status(429).json({ error: 'too_many' }) });
  const askLimit = rateLimit({
    windowMs: 3_600_000,
    limit: IP_QUESTIONS_PER_HOUR,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => clientIp(req) ?? 'unknown',
    validate: false,
    handler: (_req, res) => void res.status(429).json({ answer: LIMIT_REPLY, verdict: 'unsure', cta: true, error: 'too_many' }),
  });

  app.post('/api/assistant/visit', visitLimit, async (req, res) => {
    const visitId = visitIdFrom(req);
    await logVisit(req, visitId);
    res.json({ visitId });
  });

  app.post('/api/assistant/ask', askLimit, async (req, res) => {
    const raw = req.body?.question;
    if (typeof raw !== 'string' || !raw.trim()) return res.status(400).json({ error: 'bad_question' });
    const question = raw.trim().slice(0, QUESTION_MAX_CHARS);
    const visitId = visitIdFrom(req);
    const t0 = Date.now();
    await logVisit(req, visitId);

    let topics;
    try {
      topics = await loadDeclinedTopics(deps.prisma);
    } catch {
      topics = undefined; // the built-in topics still apply
    }

    // fixed answers cost nothing, so they are not limited; only a model call counts against the caps
    let result = answerWithoutModel(question, topics);
    if (!result) {
      let allowed = false;
      let over = false;
      try {
        const c = await store.counts(visitId, now());
        over = c.visitLastHour >= VISIT_QUESTIONS_PER_HOUR;
        allowed = !over && c.siteToday < dailyCap(env);
      } catch (err) {
        // cannot count, so no model call: the bill stays bounded and the person still gets a useful line
        console.warn(JSON.stringify({ msg: 'assistant count failed', error: (err as Error).message.slice(0, 200) }));
      }
      result = allowed
        ? await answerQuestion(question, { topics, ...(deps.call ? { call: deps.call } : {}), env })
        : {
            answer: over ? LIMIT_REPLY : UNSURE,
            verdict: 'unsure',
            cta: true,
            outcome: 'limited',
            storedQuestion: question,
            model: null,
            tokensIn: null,
            tokensOut: null,
          };
    }

    try {
      await store.recordQuestion(
        {
          visitId,
          ip: clientIp(req),
          question: result.storedQuestion,
          answer: result.answer,
          verdict: result.verdict,
          outcome: result.outcome,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: Date.now() - t0,
        },
        now()
      );
    } catch (err) {
      console.warn(JSON.stringify({ msg: 'assistant question log failed', error: (err as Error).message.slice(0, 200) }));
    }

    return res.json({ answer: result.answer, verdict: result.verdict, cta: result.cta, visitId });
  });

  return true;
}
