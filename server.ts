import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createYoga, type Plugin } from 'graphql-yoga';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });
import { prisma } from './src/lib/prisma.js';
import { scheduleChartCatalogSyncOnStart } from './src/services/chartCatalogSync.js';
import { runRagQuery } from './src/services/kundliService.js';
import { schema } from './src/graphql/schema.js';
import { buildContext, getJwtSecret, type GraphQLContext } from './src/graphql/context.js';
import { ensureAdmins } from './src/ensureAdmins.js';
import { optionalUser, requireUser } from './src/auth/requestAuth.js';
import { checkRateLimit } from './src/lib/redis/rateLimiter.js';
import { csrfProtectionMiddleware } from './src/auth/csrf.js';
import { registerChatRoutes } from './src/chat/chatRoutes.js';
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
import { registerSelfReadingRoutes } from './src/routes/selfReadingRoutes.js';
import { registerSelfV2Routes } from './src/routes/selfV2Routes.js';
import { registerSelfV3Routes } from './src/routes/selfV3Routes.js';
import { registerNowRoutes } from './src/routes/nowRoutes.js';
import { registerBoardCardsRoutes } from './src/routes/boardCardsRoutes.js';
import { registerBoardV3Routes } from './src/routes/boardV3Routes.js';
import { registerCardChatRoutes } from './src/routes/cardChatRoutes.js';
import { registerAdminLabRoutes } from './src/routes/adminLabRoutes.js';
import { registerAdminNotificationRoutes } from './src/routes/adminNotificationRoutes.js';
import { registerNotificationRoutes } from './src/routes/notificationRoutes.js';
import { registerProfileRoutes } from './src/routes/profileRoutes.js';
import { registerAssetRoutes } from './src/routes/assetRoutes.js';
import { registerResearchRoutes } from './src/routes/researchRoutes.js';
import { pageTimingMiddleware, registerPageTimingRoutes } from './src/telemetry/pageTiming.js';
import { assertOwnAccount } from './src/graphql/rbac.js';
import { factsFromExpress, recordAccountEvent } from './src/audit/accountEvents.js';
import { engineAtPlace, functionalNatureOf, natalForUser, runningDashaLordsOf } from './src/reading/luckyTimes/wiring.js';
import { seedAgentRegistryInBackground } from './src/agents/registry.js';
import { seedTechniqueRegistryInBackground } from './src/techniques/catalog.js';
import { releaseAfter } from './src/lib/registrySeed.js';
import { PrismaAssistantStore } from './src/assistant/store.js';
import { parseClientPlace } from './src/reading/chartData/place.js';
import { intentForFocus } from './src/reading/clarify/service.js';
import { FRAMES, SUBJECT_IDS, type SubjectId } from './src/reading/packs/frames.js';
import { isCacheSweepEvent, runScheduledSweep, startPeriodicSweep } from './src/reading/llm/cacheSweep.js';
import { handleKundliSyncEvent, parseKundliSyncEvent } from './src/services/kundliSyncWorker.js';
import { handleKundliDigestEvent, parseKundliDigestEvent } from './src/reading/digest/event.js';
import { handleDashaDeepEvent, parseDashaDeepEvent } from './src/workers/dashaDeep.js';
import { withDashaDeepFocus } from './src/workers/dashaDeepFocus.js';
import { isDashaDeepWorker, isGraphqlErrorMaskingEnabled } from './src/config/env.js';
import {
  extractRequestIdFromReq,
  extractRequestIp,
  recordAppError,
  registerAppErrorRoutes,
  requestIdMiddleware,
  sweepAppErrorEvents,
} from './src/telemetry/appErrors.js';
import {
  createGraphqlMaskError,
  graphqlArmorAndObservabilityPlugin,
  runWithGraphqlObsContext,
} from './src/graphql/armorAndMasking.js';
import { handleSelfReadingBuildEvent, parseSelfReadingBuildEvent } from './src/reading/self/buildEvent.js';
import {
  logChatProviderError,
  publicMessageFromChatProviderError,
} from './src/services/publicChatError.js';

/** Event-driven Kundli sync only (login/signup/admin); no periodic setInterval tick. */

getJwtSecret(); // Fail fast if JWT_SECRET not set
const app = express();
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(requestIdMiddleware);
// registry seeds start once, after the first response has been sent (a cold-start request never waits on them)
let registrySeedsStarted = false;
app.use((_req, res, next) => {
  if (!registrySeedsStarted) {
    res.once('finish', () => {
      if (registrySeedsStarted) return;
      registrySeedsStarted = true;
      seedRegistriesInBackground();
    });
  }
  next();
});

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

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  })
);
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
  // one person's reading build (docs/reading-engine/64 §4): queued by the reading route, runs to the end here
  const readingBuild = parseSelfReadingBuildEvent(req.body);
  if (readingBuild) return res.json(await handleSelfReadingBuildEvent(readingBuild, { prisma }));
  // the deep dasha levels (docs/reading-engine/67): only on the worker function (DASHA_DEEP_WORKER=1), never on the API
  const dashaDeep = parseDashaDeepEvent(req.body);
  if (dashaDeep) {
    if (!isDashaDeepWorker()) return res.status(202).json({ status: 'ignored', reason: 'not the dasha-deep worker function' });
    return res.json(await handleDashaDeepEvent(dashaDeep, { prisma }));
  }
  const kundliSync = parseKundliSyncEvent(req.body);
  if (kundliSync) return res.json(await handleKundliSyncEvent(kundliSync, { prisma }));
  if (!isCacheSweepEvent(req.body)) return res.status(204).end();
  // the visit log and error telemetry retentions run with the sweep; failures must not stop the sweep's answer
  await new PrismaAssistantStore(prisma).purge(new Date()).catch((err: Error) => console.warn(JSON.stringify({ msg: 'assistant purge failed', error: err.message.slice(0, 200) })));
  await sweepAppErrorEvents(prisma).catch((err: Error) => console.warn(JSON.stringify({ msg: 'app_error_events purge failed', error: err.message.slice(0, 200) })));
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
        : false, // fail closed when CORS_ORIGINS is unset outside local/dev
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Astra-Authorization',
      'X-Astra-Page',
      'X-Astra-Session',
      'X-Request-Id',
      'X-Amz-Content-Sha256',
      'X-Requested-With',
      'X-Face-Box',
      'X-Admin-Lab-Token',
      'X-Admin-Service-Timestamp',
      'X-Admin-Service-Signature',
      'X-Admin-Actor-Id',
      'X-Admin-Actor-Role',
      'If-None-Match',
      'X-CSRF-Token',
      'Last-Event-ID',
    ],
    // GET /api/self/v3 answers with an ETag; clients correlate errors via X-Request-Id
    exposedHeaders: ['ETag', 'X-Request-Id'],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(csrfProtectionMiddleware);
app.use(pageTimingMiddleware(prisma, optionalUser));

/**
 * Liveness probe. Used by the Lambda Web Adapter readiness check (AWS_LWA_READINESS_CHECK_PATH)
 * and by CloudFront smoke tests. Returns only once the server is listening, which is after the
 * startup DB check in start(). No auth, no DB call, no secrets.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, env: getNodeEnv() });
});

function cookiePlugin(): Plugin {
  return {
    onResponse({ response, serverContext }) {
      const ctx = serverContext as unknown as GraphQLContext | undefined;
      if (ctx?.cookiesToSet?.length) {
        for (const c of ctx.cookiesToSet) {
          response.headers.append('Set-Cookie', c);
        }
      }
    },
  };
}

const yoga = createYoga({
  schema,
  context: buildContext,
  // lockGuardPlugin enforces account locks / fail-closed auth; armor & masking bound depth/aliases and record app_error_events
  plugins: [lockGuardPlugin(), graphqlArmorAndObservabilityPlugin({ prisma }), cookiePlugin()],
  maskedErrors: {
    maskError: createGraphqlMaskError({ prisma }),
    isDev: !isGraphqlErrorMaskingEnabled(),
  },
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
  if (req.method !== 'OPTIONS') {
    const rlUserId = await optionalUser(req).catch(() => null);
    const rlKey = rlUserId ? `user:${rlUserId}` : `ip:${req.ip || 'anon'}`;
    const rl = await checkRateLimit('graphql', rlKey, { prisma });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return res.status(429).json({
        errors: [
          {
            message: 'Too many requests. Please try again later.',
            extensions: { code: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec },
          },
        ],
      });
    }
  }
  const startedAt = Date.now();
  // the operation's name only: bodies carry emails, sign-in codes, birth details and questions
  console.log('[GraphQL] incoming', {
    path: req.path,
    method: req.method,
    startedAt: new Date(startedAt).toISOString(),
    ...graphqlLogFields(req.body),
  });
  try {
    await runWithGraphqlObsContext(req, async () => {
      await (yoga as unknown as express.RequestHandler)(req, res, next);
    });
  } finally {
    console.log('[GraphQL] completed', {
      path: req.path,
      durationMs: Date.now() - startedAt,
      statusCode: res.statusCode,
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Opening chat, Today, Lucky times or a board marks the kundli in focus: the dasha-deep worker is invoked in the
// background (at most once per 6 h per kundli; a no-op without DASHA_DEEP_WORKER_FUNCTION). docs/reading-engine/67
const focusUser = withDashaDeepFocus(requireUser, prisma);

registerChatRoutes(app, { prisma, requireUser: focusUser });

registerClarifyRoutes(app, { prisma, requireUser: focusUser });
registerBillingRoutes(app, { prisma, requireUser, optionalUser });
// life-timeline ledger (docs/reading-engine/27 P0): not mounted unless TIMELINE_ENABLED=1
registerTimelineRoutes(app, { prisma, requireUser });
// the assistant on the public pages and the visit log: no sign-in, no account data
registerAssistantRoutes(app, { prisma });
// Lucky times (docs/reading-engine/49, 53 §4.6): mounted when LUCKY_ENABLED=1; analytics events always
registerLuckyRoutes(app, {
  prisma,
  requireUser: focusUser,
  engine: engineAtPlace,
  natalFor: natalForUser(prisma),
  functionalNatureOf: functionalNatureOf(prisma),
  runningDashaLordsOf: runningDashaLordsOf(prisma),
});
// career map Phase 1 (docs/reading-engine/42): mounted when AREA_ENABLED=1
registerAreaRoutes(app, { prisma, requireUser: focusUser });
registerSelfReadingRoutes(app, { prisma, requireUser: focusUser });
// Self board v2 (docs/reading-engine/66 §4.5): mounted when SELF_V2_ENABLED=1 (unset: follows AREA_ENABLED)
registerSelfV2Routes(app, { prisma, requireUser: focusUser });
registerSelfV3Routes(app, { prisma, requireUser: focusUser });
// the Now card on every board (docs/reading-engine/72): mounted when NOW_CARD_ENABLED=1
registerNowRoutes(app, { prisma, requireUser: focusUser });
// Love and Work card picker and card options (docs/reading-engine/71): no model call, always on
registerBoardCardsRoutes(app, { prisma, requireUser: focusUser });
// Love and Work on the You v3 card machine (docs/dashboards/10): always registered; 404 board_v3_off unless in BOARDS_V3
registerBoardV3Routes(app, { prisma, requireUser: focusUser });
// a chat on every card (docs/reading-engine/85): GET opens it; the answer is ask-stream with `card` (registerChatRoutes)
registerCardChatRoutes(app, { prisma, requireUser: focusUser });
registerAdminLabRoutes(app, { prisma });
// admin-to-user messaging (M53)
registerAdminNotificationRoutes(app, { prisma });
registerNotificationRoutes(app, { prisma, requireUser });
// life reading dashboard, doc 34 Part 1 (docs/reading-engine/54 §4): mounted when LIFE_READING_ENABLED=1
registerLifeReadingRoutes(app, { prisma, requireUser: focusUser });
// personalization wizard and selfie (docs/reading-engine/52)
registerProfileRoutes(app, { prisma, requireUser });
// the loading veil's art key for signed-in sessions (docs/loading-overlay/01 §4.1)
registerAssetRoutes(app, { requireUser });
// page execution timing beacon & progressive dashboard section streaming (docs/admin/08)
registerPageTimingRoutes(app, { prisma, optionalUser, requireUser: focusUser });
// research staging & Self dashboard QA routes (docs/admin/09)
registerResearchRoutes(app, { prisma, requireUser });
// dual-plane client JS, React boundary, and CSP violation ingestion (M52)
registerAppErrorRoutes(app, { prisma, optionalUser });

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
    const requestId = extractRequestIdFromReq(req as express.Request & { requestId?: string });
    console.error('Error processing query:', (err as Error)?.message ?? 'unknown');
    void recordAppError(prisma, {
      source: 'server_rest',
      severity: 'error',
      category: 'server_5xx',
      errorCode: String((err as { code?: unknown })?.code ?? (err as Error)?.name ?? 'QUERY_FAILED'),
      statusCode: 500,
      page: typeof req.headers['x-astra-page'] === 'string' ? req.headers['x-astra-page'] : '/dashboard/chat',
      operation: 'POST /query',
      message: (err as Error)?.message ?? String(err),
      stack: (err as Error)?.stack,
      requestId,
      sessionId: typeof req.headers['x-astra-session'] === 'string' ? req.headers['x-astra-session'] : null,
      ip: extractRequestIp(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Query failed.',
        ...(isGraphqlErrorMaskingEnabled() ? {} : { details: (err as Error)?.message }),
        ...(requestId ? { requestId } : {}),
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Terminal REST error handler: masks internal/Prisma details on wire and records to app_error_events for Admin.
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const requestId = extractRequestIdFromReq(req as express.Request & { requestId?: string });
  const statusCode =
    typeof (err as { status?: unknown })?.status === 'number' &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 600
      ? (err as { status: number }).status
      : 500;
  void recordAppError(prisma, {
    source: 'server_rest',
    severity: statusCode >= 500 ? 'error' : 'warn',
    category: statusCode >= 500 ? 'server_5xx' : 'server_4xx',
    errorCode: String((err as { code?: unknown })?.code ?? (err as Error)?.name ?? `HTTP_${statusCode}`),
    statusCode,
    page: typeof req.headers['x-astra-page'] === 'string' ? req.headers['x-astra-page'] : '/',
    operation: `${req.method} ${req.path}`,
    message: (err as Error)?.message ?? String(err),
    stack: (err as Error)?.stack,
    requestId,
    sessionId: typeof req.headers['x-astra-session'] === 'string' ? req.headers['x-astra-session'] : null,
    ip: extractRequestIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  });
  return res.status(statusCode).json({
    code: statusCode >= 500 ? 'internal_error' : 'request_error',
    error: statusCode >= 500 ? 'Internal server error.' : 'Request could not be completed.',
    ...(requestId ? { requestId } : {}),
  });
});

/** boot fallback: the registry seeds start this long after boot when no request has come (ms) */
const REGISTRY_SEED_FALLBACK_MS = 15_000;

/**
 * The agent registry and technique catalogue seeds, off the request path (src/lib/registrySeed.ts): started once per
 * container after the first response is sent (or REGISTRY_SEED_FALLBACK_MS after boot when no request comes), each after
 * a short delay, with retries; each skips the write when the table already matches. Never throws; logs once each.
 */
function seedRegistriesInBackground(): void {
  // seedAgentRegistry(prisma) and seedTechniqueRegistry(prisma) run inside these jobs
  void seedAgentRegistryInBackground(prisma);
  void seedTechniqueRegistryInBackground(prisma);
}

async function start(): Promise<void> {
  await checkDatabaseConnection();
  const nodeEnv = getNodeEnv();
  console.log(`✅ Database connected | NODE_ENV=${nodeEnv}`);
  // The agent registry and technique catalogue: never on the request path. They start after the first response
  // (the middleware above), or after REGISTRY_SEED_FALLBACK_MS when no request arrives.
  releaseAfter(REGISTRY_SEED_FALLBACK_MS, seedRegistriesInBackground);
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
