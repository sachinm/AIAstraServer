/**
 * Admin-to-user messaging routes (M53). Mounted when ADMIN_LAB=1 (same guard as `adminLabRoutes.ts`).
 *
 *   POST /api/admin-lab/notifications/send
 *   GET  /api/admin-lab/notifications?userId=<id>&limit=20
 */
import { timingSafeEqual } from 'node:crypto';
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { isAdminLabEnabled } from './adminLabRoutes.js';
import { listAdminSentNotifications, sendUserNotifications } from '../notify/notificationService.js';

export interface AdminNotificationRouteDeps {
  prisma: PrismaClient;
  enabled?: boolean;
  token?: string;
}

function tokenOk(given: unknown, want: string | undefined): boolean {
  if (!want || typeof given !== 'string' || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function extractLabToken(req: express.Request): string | undefined {
  const direct = req.header('x-admin-lab-token')?.trim();
  if (direct) return direct;
  const astra = req.header('x-astra-authorization')?.trim();
  if (astra && /^LabToken\s+/i.test(astra)) {
    return astra.replace(/^LabToken\s+/i, '').trim();
  }
  return undefined;
}

export function registerAdminNotificationRoutes(app: express.Express, deps: AdminNotificationRouteDeps): boolean {
  if (!(deps.enabled ?? isAdminLabEnabled())) return false;
  const token = deps.token ?? process.env.ADMIN_LAB_TOKEN?.trim();
  const guard: express.RequestHandler = (req, res, next) => {
    if (!tokenOk(extractLabToken(req), token)) return void res.status(403).json({ error: 'forbidden' });
    next();
  };

  app.post('/api/admin-lab/notifications/send', guard, async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await sendUserNotifications(deps.prisma, body);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (e) {
      console.error('[admin-notifications] send failed:', (e as Error).message);
      return res.status(500).json({ error: 'send_failed' });
    }
  });

  app.get('/api/admin-lab/notifications', guard, async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.status(400).json({ error: 'missing_user_id' });
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;
    try {
      const items = await listAdminSentNotifications(deps.prisma, userId, limit);
      return res.json({ items });
    } catch (e) {
      console.error('[admin-notifications] list failed:', (e as Error).message);
      return res.status(500).json({ error: 'list_failed' });
    }
  });

  return true;
}
