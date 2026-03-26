import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createYoga } from 'graphql-yoga';
import { config } from 'dotenv';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });
import { fetchLatestKundliForUser, kundliRowToChunks } from './kundli-rag.js';
import { prisma } from './src/lib/prisma.js';
import { runRagQuery } from './src/services/kundliService.js';
import { schema } from './src/graphql/schema.js';
import { buildContext, getJwtSecret } from './src/graphql/context.js';
import { ensureSuperadmin } from './src/ensureSuperadmin.js';
import { checkDatabaseConnection } from './src/lib/dbCheck.js';
import { getNodeEnv, isAstroKundliConfigured, isDevOrLocal } from './src/config/env.js';
import { processKundliSyncQueue } from './src/services/kundliQueueService.js';
import { queueLogError } from './src/lib/queueLogger.js';
import { checkAstroKundliEndpoint, probeAstroKundliWithBogusParams } from './src/lib/astroKundliClient.js';

getJwtSecret(); // Fail fast if JWT_SECRET not set
const app = express();
app.use(express.json());

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  })
);

const yoga = createYoga({
  schema,
  context: buildContext,
  maskedErrors: false,
});

app.use(yoga.graphqlEndpoint, async (req, res, next) => {
  const startedAt = Date.now();
  let body = '';
  try {
    body = JSON.stringify(req.body);
  } catch {
    // ignore
  }
  console.log('[GraphQL] incoming', {
    path: req.path,
    method: req.method,
    startedAt: new Date(startedAt).toISOString(),
    bodySnippet: body.slice(0, 300),
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

/** Parse Authorization Bearer and return userId or null */
function getUserIdFromRequest(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      sub?: string;
      userId?: string;
    };
    return decoded.sub ?? decoded.userId ?? null;
  } catch {
    return null;
  }
}

// REST /query – requires JWT; uses userId from token (same user only)
app.post('/query', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    const { question } = req.body as { question?: string; userID?: string };
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

    const { answer } = await runRagQuery(prisma, userId, question);

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

// Debug endpoint – only available when NODE_ENV !== 'production'; requires JWT and same user
app.get('/debug/kundli/:user_id', async (req, res) => {
  if (getNodeEnv() === 'production') {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  const userId = getUserIdFromRequest(req);
  if (!userId || userId !== req.params.user_id) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  try {
    const row = await fetchLatestKundliForUser(prisma, req.params.user_id);
    const chunks = kundliRowToChunks(row);
    res.json({
      success: true,
      kundli_id: row.id,
      chunkCount: chunks.length,
      chunks,
    });
  } catch (e) {
    res.status(404).json({ success: false, error: (e as Error).message });
  }
});

async function start(): Promise<void> {
  await checkDatabaseConnection();
  const nodeEnv = getNodeEnv();
  console.log(`✅ Database connected | NODE_ENV=${nodeEnv}`);
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running at http://localhost:${PORT} (env: ${nodeEnv})`);
    await ensureSuperadmin();
    console.log('AstroKundli endpoint: ', isAstroKundliConfigured());
    if (isAstroKundliConfigured()) {
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
      probeAstroKundliWithBogusParams().catch((err) => {
        console.warn('⚠️ AstroKundli startup bogus-probe failed:', (err as Error).message);
      });
      // Queue runs on-demand after signup/login; run once on startup to process any pending rows
      processKundliSyncQueue(prisma).catch((err) => {
        queueLogError({
          event: 'kundli_queue_tick_failed',
          error: (err as Error).message,
        });
      });
      console.log('Kundli sync queue: on-demand (triggered after signup/login); ran once on startup.');
    } else {
      console.log('Kundli sync queue not started: ASTROKUNDLI_BASE_URL_* not set for this env. Chart sync will not run.');
    }
  });
}
start().catch((err) => {
  console.error('Startup failed:', (err as Error)?.message || err);
  process.exit(1);
});
