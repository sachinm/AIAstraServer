/**
 * Consumer inbox notification routes (M53). Always mounted; every route is scoped strictly to `requireUser`.
 *
 *   GET    /api/notifications?limit=20&unreadOnly=0  -> { items, unreadCount }
 *   GET    /api/notifications/unread-count           -> { unreadCount }
 *   PATCH  /api/notifications/:id/read               -> { ok: true, unreadCount } | 404
 *   POST   /api/notifications/read-all               -> { ok: true, updatedCount, unreadCount }
 *   DELETE /api/notifications/:id                    -> { ok: true, unreadCount } | 404
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import {
  dismissNotification,
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notify/notificationService.js';

export interface NotificationRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
}

export function registerNotificationRoutes(app: express.Express, deps: NotificationRouteDeps): void {
  app.get('/api/notifications', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : undefined;
    const unreadOnly = req.query.unreadOnly === '1' || req.query.unreadOnly === 'true';
    try {
      const result = await listUserNotifications(deps.prisma, userId, { limit, unreadOnly });
      return res.json(result);
    } catch (e) {
      console.error('[notifications] list failed:', (e as Error).message);
      return res.status(500).json({ error: 'notifications_failed' });
    }
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const unreadCount = await getUnreadNotificationCount(deps.prisma, userId);
      return res.json({ unreadCount });
    } catch (e) {
      console.error('[notifications] unread-count failed:', (e as Error).message);
      return res.status(500).json({ error: 'notifications_failed' });
    }
  });

  app.post('/api/notifications/read-all', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const result = await markAllNotificationsRead(deps.prisma, userId);
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[notifications] read-all failed:', (e as Error).message);
      return res.status(500).json({ error: 'notifications_failed' });
    }
  });

  app.patch('/api/notifications/:id/read', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'bad_request' });
    try {
      const result = await markNotificationRead(deps.prisma, userId, id);
      if (!result.found) return res.status(404).json({ error: 'not_found' });
      return res.json({ ok: true, unreadCount: result.unreadCount });
    } catch (e) {
      console.error('[notifications] mark-read failed:', (e as Error).message);
      return res.status(500).json({ error: 'notifications_failed' });
    }
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'bad_request' });
    try {
      const result = await dismissNotification(deps.prisma, userId, id);
      if (!result.found) return res.status(404).json({ error: 'not_found' });
      return res.json({ ok: true, unreadCount: result.unreadCount });
    } catch (e) {
      console.error('[notifications] dismiss failed:', (e as Error).message);
      return res.status(500).json({ error: 'notifications_failed' });
    }
  });
}
