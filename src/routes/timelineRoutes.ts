/**
 * HTTP surface of the life-timeline ledger (docs/reading-engine/27 §B.7 P0). Mounted only when TIMELINE_ENABLED=1;
 * otherwise these paths are plain 404s.
 *
 *   GET    /api/timeline/ledger/meta            categories grouped by marker, attribute keys, precisions
 *   GET    /api/timeline/ledger?kundliId=       the person's events for a kundli (default: their latest)
 *   POST   /api/timeline/ledger                 { kundliId?, category, date, date_precision, place?, attributes? }
 *   PATCH  /api/timeline/ledger/:id             any of those fields
 *   DELETE /api/timeline/ledger/:id
 *   POST   /api/timeline/ledger/interview       { kundliId?, text, year? } → proposals to confirm (nothing stored)
 *
 * A user only reads and writes their own rows (ledgerStore.ts). 503 `ledger_unavailable` while the migration is not
 * applied. The interview passes the declined-topics gate before and after the model call (interview.ts).
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { declinedFor } from '../reading/policy/declined.js';
import { isTimelineEnabled, timelineConfig } from '../reading/timeline/config.js';
import { extractLedgerProposals, type InterviewDeps } from '../reading/timeline/interview.js';
import { checkLedgerInput, ledgerMeta, mergeLedgerUpdate } from '../reading/timeline/ledgerCategories.js';
import { createLedgerEvent, deleteLedgerEvent, getLedgerEvent, listLedger, resolveKundli, updateLedgerEvent, type LedgerResult } from '../reading/timeline/ledgerStore.js';

export interface TimelineRouteDeps {
  prisma: PrismaClient;
  getUserId: (req: express.Request) => string | null;
  /** tests: replace the model call */
  interviewCall?: InterviewDeps['call'];
  /** tests: whether the interview model is configured (default: the Gemini chat provider with a key) */
  interviewAvailable?: () => boolean;
  /** default: TIMELINE_ENABLED */
  enabled?: boolean;
}

function interviewConfigured(): boolean {
  return getChatLlmProvider() === 'gemini' && !!process.env.GEMINI_API_KEY?.trim();
}

const kundliParam = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 64) : null);

function sendStoreError(res: express.Response, r: LedgerResult<unknown>): express.Response {
  if (r.status === 'not_found') return res.status(404).json({ error: 'not_found' });
  if (r.status === 'full') return res.status(409).json({ error: 'ledger_full' });
  return res.status(503).json({ error: 'ledger_unavailable' });
}

/** Mounts the routes when the timeline is enabled; returns whether it did. */
export function registerTimelineRoutes(app: express.Express, deps: TimelineRouteDeps): boolean {
  if (!(deps.enabled ?? isTimelineEnabled())) return false;
  const { prisma } = deps;
  const available = deps.interviewAvailable ?? interviewConfigured;

  /** The user id, or a 401 already sent */
  const auth = (req: express.Request, res: express.Response): string | null => {
    const userId = deps.getUserId(req);
    if (!userId) res.status(401).json({ error: 'Unauthorized' });
    return userId;
  };

  app.get('/api/timeline/ledger/meta', (req, res) => {
    if (!auth(req, res)) return;
    res.json({ ...ledgerMeta(), years: timelineConfig().years, interview: available() });
  });

  app.get('/api/timeline/ledger', async (req, res) => {
    const userId = auth(req, res);
    if (!userId) return;
    const kundliId = await resolveKundli(prisma, userId, kundliParam(req.query.kundliId));
    if (!kundliId) return res.status(404).json({ error: 'kundli_not_found' });
    const r = await listLedger(prisma, userId, kundliId);
    if (r.status !== 'ok') return sendStoreError(res, r);
    return res.json({ kundliId, events: r.value });
  });

  app.post('/api/timeline/ledger', async (req, res) => {
    const userId = auth(req, res);
    if (!userId) return;
    const checked = checkLedgerInput(req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.error, field: checked.field });
    const kundliId = await resolveKundli(prisma, userId, kundliParam(req.body?.kundliId));
    if (!kundliId) return res.status(404).json({ error: 'kundli_not_found' });
    const r = await createLedgerEvent(prisma, userId, kundliId, checked.value);
    if (r.status !== 'ok') return sendStoreError(res, r);
    return res.status(201).json({ event: r.value });
  });

  app.patch('/api/timeline/ledger/:id', async (req, res) => {
    const userId = auth(req, res);
    if (!userId) return;
    const current = await getLedgerEvent(prisma, userId, req.params.id);
    if (current.status !== 'ok') return sendStoreError(res, current);
    const checked = mergeLedgerUpdate(current.value, req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.error, field: checked.field });
    const r = await updateLedgerEvent(prisma, userId, req.params.id, checked.value);
    if (r.status !== 'ok') return sendStoreError(res, r);
    return res.json({ event: r.value });
  });

  app.delete('/api/timeline/ledger/:id', async (req, res) => {
    const userId = auth(req, res);
    if (!userId) return;
    const r = await deleteLedgerEvent(prisma, userId, req.params.id);
    if (r.status !== 'ok') return sendStoreError(res, r);
    return res.json({ ok: true });
  });

  app.post('/api/timeline/ledger/interview', async (req, res) => {
    const userId = auth(req, res);
    if (!userId) return;
    if (!available()) return res.status(503).json({ error: 'interview_unavailable' });
    const kundliId = await resolveKundli(prisma, userId, kundliParam(req.body?.kundliId));
    if (!kundliId) return res.status(404).json({ error: 'kundli_not_found' });
    const r = await extractLedgerProposals(req.body?.text, { year: req.body?.year }, {
      gate: (text) => declinedFor(prisma, userId, text),
      ...(deps.interviewCall ? { call: deps.interviewCall } : {}),
    });
    if (r.status === 'invalid') return res.status(400).json({ error: r.error, field: 'text' });
    if (r.status === 'unavailable') return res.status(503).json({ error: 'interview_unavailable' });
    // a declined topic: the fixed reply only, nothing about the content
    if (r.status === 'declined') return res.json({ proposals: [], declined: { reply: r.reply } });
    return res.json({ kundliId, proposals: r.proposals, dropped: r.dropped });
  });
  return true;
}
