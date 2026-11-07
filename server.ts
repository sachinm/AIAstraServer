import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createYoga } from 'graphql-yoga';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });
import { prisma } from './src/lib/prisma.js';
import { scheduleChartCatalogSyncOnStart } from './src/services/chartCatalogSync.js';
import { runRagQuery } from './src/services/kundliService.js';
import { schema } from './src/graphql/schema.js';
import { buildContext, getJwtSecret } from './src/graphql/context.js';
import { ensureAdmins } from './src/ensureAdmins.js';
import { optionalUser, requireUser } from './src/auth/requestAuth.js';
import { lockGuardPlugin } from './src/graphql/lockGuard.js';
import { checkDatabaseConnection } from './src/lib/dbCheck.js';
import { graphqlLogFields } from './src/lib/logRedact.js';
import { noStoreMiddleware, SSE_CACHE_CONTROL } from './src/lib/noStore.js';
import { getAstroKundliTransport, getNodeEnv, isAstroKundliConfigured, isDevOrLocal } from './src/config/env.js';
import { checkAstroKundliEndpoint, probeAstroKundliWithBogusParams } from './src/lib/astroKundliClient.js';
import { chatWithConfiguredProvider } from './src/services/chatLlmService.js';
import { validateAskForUser, persistAskTurn } from './src/services/askChatTurn.js';
import { partsFromEvent, questionGate, quotaBody, wasDeclined, type QuestionTicket } from './src/billing/questionGate.js';
import { registerBillingRoutes } from './src/billing/routes.js';
import { clarifyOnAsk, registerClarifyRoutes } from './src/routes/clarifyRoutes.js';
import { registerTimelineRoutes } from './src/routes/timelineRoutes.js';
import { registerAssistantRoutes } from './src/routes/assistantRoutes.js';
import { registerLuckyRoutes } from './src/routes/luckyRoutes.js';
import { registerAreaRoutes } from './src/routes/areaRoutes.js';
import { registerLifeReadingRoutes } from './src/routes/lifeReadingRoutes.js';
import { registerProfileRoutes } from './src/routes/profileRoutes.js';
import { registerResearchRoutes } from './src/routes/researchRoutes.js';
import { pageTimingMiddleware, registerPageTimingRoutes } from './src/telemetry/pageTiming.js';
import { assertOwnAccount } from './src/graphql/rbac.js';
import { factsFromExpress, recordAccountEvent } from './src/audit/accountEvents.js';
import { engineAtPlace, functionalNatureOf, natalForUser, runningDashaLordsOf } from './src/reading/luckyTimes/wiring.js';
import { seedAgentRegistry } from './src/agents/registry.js';
import { seedTechniqueRegistry } from './src/techniques/catalog.js';
import { PrismaAssistantStore } from './src/assistant/store.js';
import { parseClientPlace } from './src/reading/chartData/place.js';
import { intentForFocus } from './src/reading/clarify/service.js';
import { FRAMES, SUBJECT_IDS, type SubjectId } from './src/reading/packs/frames.js';
import { isCacheSweepEvent, runScheduledSweep, startPeriodicSweep } from './src/reading/llm/cacheSweep.js';
import { handleKundliSyncEvent, parseKundliSyncEvent } from './src/services/kundliSyncWorker.js';
import { handleKundliDigestEvent, parseKundliDigestEvent } from './src/reading/digest/event.js';
import {
  logChatProviderError,
  publicMessageFromChatProviderError,
} from './src/services/publicChatError.js';

/** Event-driven Kundli sync only (login/signup/admin); no periodic setInterval tick. */

getJwtSecret(); // Fail fast if JWT_SECRET not set
const app = express();

// Behind Render (and most PaaS), the proxy sets X-Forwarded-For. express-rate-limit requires
// trust proxy to be enabled or it throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
// When TRUST_PROXY is unset: default to 1 on Render / production / staging; opt out with 0 | false.
// Force on locally: TRUST_PROXY=1 | true.
const nodeEnv = getNodeEnv();
const trustProxyDeployedDefault =
  process.env.RENDER === 'true' || nodeEnv === 'production' || nodeEnv === 'staging';
const trustProxyEnv = process.env.TRUST_PROXY?.trim();
const trustProxyRaw = (
  trustProxyEnv !== undefined && trustProxyEnv !== ''
    ? trustProxyEnv
    : trustProxyDeployedDefault
      ? '1'
      : ''
).toLowerCase();
const trustProxyEnabled =
  trustProxyRaw === '1' || trustProxyRaw === 'true';
if (trustProxyEnabled) {
  app.set('trust proxy', 1);
}

app.use(express.json());
// no response is cached anywhere (GraphQL with or without a bearer token, REST, SSE): docs/privacy/02 §4.2
app.use(noStoreMiddleware);

// Lambda Web Adapter forwards non-HTTP events (EventBridge schedules) here as POST bodies (AWS_LWA_PASS_THROUGH_PATH).
// Handled: the LLM cache sweep, the kundli digest (kundli-digest, kundli-digest-sweep), and the background chart pull (kundli-sync from this Lambda's own async invoke,
// kundli-sync-sweep from EventBridge; docs/reading-engine/31). The response is sent only when the work is done, so the
// invocation lives as long as the pull. Anything else is acknowledged and ignored.
app.post('/events', async (req, res) => {
  // the kundli digest (docs/reading-engine/53 §4.7): one kundli, or the sweep; token-guarded like kundli-sync
  const digest = parseKundliDigestEvent(req.body);
  if (digest) return res.json(await handleKundliDigestEvent(digest, { prisma }));
  const kundliSync = parseKundliSyncEvent(req.body);
  if (kundliSync) return res.json(await handleKundliSyncEvent(kundliSync, { prisma }));
  if (!isCacheSweepEvent(req.body)) return res.status(204).end();
  // the visit log's retention runs with the sweep; a failure there must not stop the sweep's answer
  await new PrismaAssistantStore(prisma).purge(new Date()).catch((err: Error) => console.warn(JSON.stringify({ msg: 'assistant purge failed', error: err.message.slice(0, 200) })));
  res.json(await runScheduledSweep());
});

// Dev/local: allow any origin so dev:network (Vite --host) works from any LAN IP.
const DEV_ALLOWED_ORIGINS = [
  'https://aiastraweb.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://10.0.0.190:5173',
];

const prodOrigins = process.env.CORS_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: isDevOrLocal()
      ? true // allow any origin in dev so dev:network works from any host (e.g. LAN IP)
      : prodOrigins?.length
        ? prodOrigins
        : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Astra-Authorization',
      'X-Astra-Page',
      'X-Astra-Session',
      'X-Amz-Content-Sha256',
      'X-Requested-With',
      'X-Face-Box',
    ],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(pageTimingMiddleware(prisma, optionalUser));

/**
 * Liveness probe. Used by the Lambda Web Adapter readiness check (AWS_LWA_READINESS_CHECK_PATH)
 * and by CloudFront smoke tests. Returns only once the server is listening, which is after the
 * startup DB check in start(). No auth, no DB call, no secrets.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, env: getNodeEnv() });
});

const yoga = createYoga({
  schema,
  context: buildContext,
  // a locked account may run only `me` and `logout` (docs/admin/01 §4.1.2)
  plugins: [lockGuardPlugin()],
  maskedErrors: false,
});

const graphqlRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevOrLocal() ? 2000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (_req, res) => {
    res.status(429).json({
      errors: [{ message: 'Too many requests. Please try again later.' }],
    });
  },
});

app.use(yoga.graphqlEndpoint, graphqlRateLimit, async (req, res, next) => {
  const startedAt = Date.now();
  // the operation's name only: bodies carry emails, sign-in codes, birth details and questions
  console.log('[GraphQL] incoming', {
    path: req.path,
    method: req.method,
    startedAt: new Date(startedAt).toISOString(),
    ...graphqlLogFields(req.body),
  });
  try {
    await (yoga as unknown as express.RequestHandler)(req, res, next);
  } finally {
    console.log('[GraphQL] completed', {
      path: req.path,
      durationMs: Date.now() - startedAt,
      statusCode: res.statusCode,
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

/**
 * SSE chat: streams `{type:"token",delta}` then `{type:"done",chatId,answer}`.
 * Same persistence as GraphQL `ask`. JWT via X-Astra-Authorization or Authorization.
 */
app.post('/api/chat/ask-stream', async (req, res) => {
  // 401 unauthorized / session_revoked / account_locked is written here, before any SSE frame
  const userId = await requireUser(req, res);
  if (!userId) return;
  const { question, chatId, clarify, focus, parts } = req.body as {
    question?: string;
    chatId?: string | null;
    clarify?: boolean;
    /** one part of a multi-part question, answered on its own (the client sends it after a `next` event) */
    focus?: string;
    /** the parts still to come after `focus` */
    parts?: unknown;
  };
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  const isSubject = (v: unknown): v is SubjectId => typeof v === 'string' && (SUBJECT_IDS as readonly string[]).includes(v);
  if (focus !== undefined && !isSubject(focus)) {
    return res.status(400).json({ error: 'focus is not a known subject' });
  }
  const focusParts: SubjectId[] = Array.isArray(parts) ? parts.filter(isSubject).slice(0, 8) : [];

  const pre = await validateAskForUser(prisma, userId);
  if (!pre.ok) {
    return res.status(pre.chart ? 409 : 400).json({ error: pre.error, ...(pre.chart ? { code: 'chart_not_ready', chart: pre.chart } : {}) });
  }

  // the question limit (docs/billing/README.md), before any model runs, the clarifier included
  const gate = questionGate(prisma);
  const allowed = await gate.check(userId, focus ? { focus } : {});
  if (!allowed.ok) return res.status(402).json(quotaBody(allowed.usage));

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', SSE_CACHE_CONTROL);
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  /** Reduce Nagle delays on small SSE frames (token deltas). */
  req.socket?.setNoDelay?.(true);

  type ResWithFlush = express.Response & { flush?: () => void };
  const flush = () => (res as ResWithFlush).flush?.();

  const writeSse = (obj: unknown) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    flush();
  };

  /**
   * SSE comment lines (ignored by our client parser). Many proxies buffer until enough bytes;
   * periodic pings keep the connection “live” during long time-to-first-token (e.g. Gemini).
   */
  const ssePingMs = Math.max(
    5000,
    Math.min(60_000, Number(process.env.CHAT_SSE_PING_MS) || 12_000)
  );
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  const writeSseComment = () => {
    try {
      res.write(': ping\n\n');
      flush();
    } catch {
      /* client gone */
    }
  };
  pingTimer = setInterval(writeSseComment, ssePingMs);
  writeSseComment();

  let ticket: QuestionTicket | null = null;
  try {
    const q = question.trim();
    // A continuation part skips the clarifier: the person already chose the order, and each part gets its own reading.
    const focusIntent = focus ? await intentForFocus(q, new Date().toISOString().slice(0, 10), focus as SubjectId, focusParts) : undefined;
    // clarify agent (docs/reading-engine/17): only for clients that can render the clarify card
    if (!focusIntent && clarify === true && (await clarifyOnAsk({ prisma, requireUser }, userId, q, { write: writeSse }))) return;
    const held = await gate.reserve(userId, focus ? { focus } : {});
    if (!held.ok) {
      writeSse({ type: 'error', code: 'quota_exhausted', usage: held.usage, message: 'Question limit reached' });
      return;
    }
    ticket = held.ticket;
    writeSse({ type: 'start' });
    const usageNow = await gate.getStatus(userId);
    if (usageNow) writeSse({ type: 'usage', usage: usageNow });
    let openParts: string[] = [];
    // where the question is asked (optional browser location `lat/lon/tz`, rounded); absent -> the birth place
    const questionPlace = parseClientPlace(req.body);
    const chatResult = await chatWithConfiguredProvider(prisma, userId, q, {
      ...(questionPlace ? { questionPlace } : {}),
      onDelta: (delta) => {
        if (delta) writeSse({ type: 'token', delta });
      },
      // reading engine: intent / stage / windows / next events let the UI show progress and continue (no `thought`: B0.2)
      onEvent: (event) => {
        openParts = partsFromEvent(event) ?? openParts;
        writeSse(event);
      },
      ...(focusIntent ? { intent: focusIntent } : {}),
    });
    // a continuation is stored with its part, so the chat history reads as the parts in order
    const storedQ = focusIntent ? `[${FRAMES[focus as SubjectId].label}] ${q}` : q;
    const { chatId: finalChatId, messageId } = await persistAskTurn(prisma, userId, chatId ?? null, storedQ, chatResult, true);
    if (wasDeclined(chatResult)) await gate.release(ticket);
    else await gate.commit(ticket, { chatId: finalChatId, messageId, openParts });
    const usage = await gate.getStatus(userId);
    writeSse({
      type: 'done',
      chatId: finalChatId,
      answer: chatResult.answerText,
      ...(usage ? { usage } : {}),
      ...(chatResult.reading ? { runId: chatResult.reading.runId, grounding: { dropped: chatResult.reading.droppedClaims } } : {}),
    });
  } catch (e) {
    logChatProviderError('ask-stream', e);
    if (ticket) await gate.release(ticket);
    const usage = await gate.getStatus(userId);
    writeSse({ type: 'error', message: publicMessageFromChatProviderError(e), ...(usage ? { usage } : {}) });
  } finally {
    if (pingTimer) clearInterval(pingTimer);
    res.end();
  }
});

registerClarifyRoutes(app, { prisma, requireUser });
registerBillingRoutes(app, { prisma, requireUser, optionalUser });
// life-timeline ledger (docs/reading-engine/27 P0): not mounted unless TIMELINE_ENABLED=1
registerTimelineRoutes(app, { prisma, requireUser });
// the assistant on the public pages and the visit log: no sign-in, no account data
registerAssistantRoutes(app, { prisma });
// Lucky times (docs/reading-engine/49, 53 §4.6): mounted when LUCKY_ENABLED=1; analytics events always
registerLuckyRoutes(app, {
  prisma,
  requireUser,
  engine: engineAtPlace,
  natalFor: natalForUser(prisma),
  functionalNatureOf: functionalNatureOf(prisma),
  runningDashaLordsOf: runningDashaLordsOf(prisma),
});
// career map Phase 1 (docs/reading-engine/42): mounted when AREA_ENABLED=1
registerAreaRoutes(app, { prisma, requireUser });
// life reading dashboard, doc 34 Part 1 (docs/reading-engine/54 §4): mounted when LIFE_READING_ENABLED=1
registerLifeReadingRoutes(app, { prisma, requireUser });
// personalization wizard and selfie (docs/reading-engine/52)
registerProfileRoutes(app, { prisma, requireUser });
// page execution timing beacon & progressive dashboard section streaming (docs/admin/08)
registerPageTimingRoutes(app, { prisma, optionalUser, requireUser });
// research staging & Self dashboard QA routes (docs/admin/09)
registerResearchRoutes(app, { prisma, requireUser });

// REST /query – requires JWT; uses userId from token (same user only)
app.post('/query', async (req, res) => {
  try {
    const userId = await requireUser(req, res);
    if (!userId) return;
    const { question, userID: bodyUserId } = req.body as { question?: string; userID?: string };
    try {
      assertOwnAccount(userId, bodyUserId);
    } catch {
      await recordAccountEvent(prisma, {
        userId,
        action: 'idor_blocked',
        outcome: 'refused',
        note: 'cross_account_query_attempt',
        request: factsFromExpress(req),
      });
      return res.status(403).json({ error: 'Forbidden: cross-account access denied' });
    }
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const user = await prisma.auth.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'User not authorized' });
    }

    const gate = questionGate(prisma);
    const held = await gate.reserve(userId);
    if (!held.ok) return res.status(402).json(quotaBody(held.usage));
    let answer: string;
    try {
      ({ answer } = await runRagQuery(prisma, userId, question));
    } catch (err) {
      await gate.release(held.ticket);
      throw err;
    }
    await gate.commit(held.ticket);

    res.status(200).json({
      success: true,
      data: {
        answer,
        userID: userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error processing query:', err);
    res.status(500).json({
      success: false,
      error: {
        message: 'Query failed.',
        details: (err as Error)?.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/** The longest boot waits for the registry seeds (they log and give up on their own on failure). */
const BOOT_SEED_WAIT_MS = 4_000;

async function start(): Promise<void> {
  await checkDatabaseConnection();
  const nodeEnv = getNodeEnv();
  console.log(`✅ Database connected | NODE_ENV=${nodeEnv}`);
  // The agent registry and the technique catalogue (docs/admin/03 §4.1): awaited before listen, because on Lambda the
  // process freezes after each response and an unawaited seed never finishes. One statement each; capped so a slow
  // database never holds the cold start for more than BOOT_SEED_WAIT_MS.
  await Promise.race([
    Promise.allSettled([seedAgentRegistry(prisma), seedTechniqueRegistry(prisma)]),
    new Promise((resolve) => setTimeout(resolve, BOOT_SEED_WAIT_MS)),
  ]);
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running at http://localhost:${PORT} (env: ${nodeEnv})`);
    await ensureAdmins();
    if (startPeriodicSweep()) console.log('LLM cache sweep: hourly');
    scheduleChartCatalogSyncOnStart(prisma);
    console.log('AstroKundli endpoint: ', isAstroKundliConfigured());
    if (isAstroKundliConfigured()) {
      const kundliTransport = getAstroKundliTransport();
      if (kundliTransport === 'lambda') {
        // Prod Lambda: no boot health-check / bogus-probe invokes (quota). Auth/admin sync only; SNS later.
        console.log(
          'Kundli sync: lambda transport — event-driven only (signup/login/magic-link/admin refresh); skipping startup health-check and bogus probe.'
        );
      } else {
        checkAstroKundliEndpoint()
          .then(({ ok, message }) => {
            if (ok) {
              console.log(`✅ AstroKundli endpoint: ${message}`);
            } else {
              console.warn(`⚠️ AstroKundli endpoint down: ${message}`);
              console.warn('   Kundli sync will fail for users until the endpoint is reachable.');
            }
          })
          .catch((err) => {
            console.warn('⚠️ AstroKundli endpoint check failed:', (err as Error).message);
          });

        void (async () => {
          try {
            await probeAstroKundliWithBogusParams();
          } catch (err) {
            console.warn('⚠️ AstroKundli startup bogus-probe failed:', (err as Error).message);
          }
          console.log(
            'Kundli sync queue: event-driven only (signup/login/magic-link/admin refresh); no startup drain or periodic poll (SNS later).'
          );
        })();
      }
    } else {
      console.log('Kundli sync queue not started: AstroKundli not configured for this env (HTTP base URL or lambda transport). Chart sync will not run.');
    }
  });
}
start().catch((err) => {
  console.error('Startup failed:', (err as Error)?.message || err);
  process.exit(1);
});
