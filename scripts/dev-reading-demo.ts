/**
 * Offline demo API for the reading-engine UI: a tiny Express server on :3020 that answers the web app's GraphQL calls with
 * stubs and serves `POST /api/chat/ask-stream` through the REAL reading engine (intake, evidence packs, graph or single
 * flow, SSE events) against the golden chart G1 and a local FAKE Gemini. Needs no database, AWS or API key.
 * The answer text is canned by format, so this checks plumbing, progress UI and rendering, not astrology quality.
 *
 *   npx tsx scripts/dev-reading-demo.ts            (READING_FLOW=graph by default; READING_FLOW=single to compare; DEMO_LEGACY=1 sends no progress events)
 *   web: VITE_API_BASE=http://127.0.0.1:3020 npx vite --port 5173
 */
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { startFakeGemini } from '../tests/helpers/fakeGemini.js';

const PORT = Number(process.env.DEMO_PORT ?? 3020);
const specialistDelay = Number(process.env.DEMO_SPECIALIST_MS ?? 900);

async function main(): Promise<void> {
  const fake = await startFakeGemini({ specialistDelayMs: specialistDelay, chunkDelayMs: 18 });
  process.env.GEMINI_API_URL = fake.url;
  process.env.GEMINI_API_KEY = 'demo-key';
  process.env.GEMINI_FLASH_MODEL_ID = process.env.GEMINI_FLASH_MODEL_ID ?? 'gemini-2.5-flash';
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_ENGINE = '1';
  process.env.READING_FLOW = process.env.READING_FLOW ?? 'graph';
  process.env.READING_INTAKE_MODE = process.env.READING_INTAKE_MODE ?? 'rules';
  process.env.READING_FACTS_BUILD = '0';
  const { runReading } = await import('../src/reading/run.js');

  const app = express();
  app.use(cors());
  app.use(express.json());
  const prisma = {} as unknown as PrismaClient;
  const chats: Array<{ id: string; user_id: string; name: string | null; is_active: boolean; created_at: string; messages: unknown[] }> = [];

  app.post('/graphql', (req, res) => {
    const q: string = String(req.body?.query ?? '');
    const ok = (data: unknown) => res.json({ data });
    if (/query MeDetails/.test(q)) return ok({ meDetails: { user_id: 'demo-user', is_active: true, kundli_added: true, queue_status: 'completed' } });
    if (/query Chats\b/.test(q)) return ok({ chats: { success: true, chats: chats.map(({ messages: _m, ...c }) => c), error: null } });
    if (/query ActiveChat/.test(q)) return ok({ activeChat: { success: true, chat: chats.find((c) => c.is_active) ?? null, error: null } });
    if (/mutation CreateChat/.test(q)) {
      const c = { id: `demo-chat-${chats.length + 1}`, user_id: 'demo-user', name: null, is_active: true, created_at: new Date().toISOString(), messages: [] };
      chats.push(c);
      const { messages: _m, ...chat } = c;
      return ok({ createChat: { success: true, chat, error: null } });
    }
    if (/query ChatMessages/.test(q)) return ok({ chatMessages: { success: true, messages: [], error: null } });
    return ok({});
  });

  app.post('/api/chat/ask-stream', async (req, res) => {
    const question = String(req.body?.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    res.flushHeaders();
    const write = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    try {
      write({ type: 'start' });
      const r = await runReading(prisma, 'demo-user', question, {
        asOf: '2026-10-24',
        onDelta: (delta) => write({ type: 'token', delta }),
        // DEMO_LEGACY=1 emulates a server without the reading engine: no progress events are sent
        ...(process.env.DEMO_LEGACY === '1' ? {} : { onEvent: (e: unknown) => write(e) }),
      });
      const chatId = String(req.body?.chatId ?? 'demo-chat-1');
      write({ type: 'done', chatId, answer: r.answerText, runId: r.record.runId, grounding: { dropped: r.record.droppedClaims } });
    } catch (e) {
      write({ type: 'error', message: (e as Error).message });
    } finally {
      res.end();
    }
  });

  app.get('/health', (_req, res) => res.send('ok'));
  const server = app.listen(PORT, '127.0.0.1', () => console.log(`reading demo API on http://127.0.0.1:${PORT} (flow=${process.env.READING_FLOW}, fake Gemini ${fake.url})`));
  const stop = () => {
    server.close();
    void fake.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
