import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import {
  dismissNotification,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sanitizeActionUrl,
  sendUserNotifications,
} from '../../../src/notify/notificationService.js';
import { registerAdminNotificationRoutes } from '../../../src/routes/adminNotificationRoutes.js';
import { registerNotificationRoutes } from '../../../src/routes/notificationRoutes.js';

interface StoredRow {
  id: string;
  user_id: string;
  sender_admin_id: string | null;
  sender_label: string | null;
  category: string;
  priority: string;
  title: string;
  body: string;
  action_url: string | null;
  action_label: string | null;
  read_at: Date | null;
  dismissed_at: Date | null;
  expires_at: Date | null;
  metadata: unknown;
  created_at: Date;
}

function makeFakePrisma(userIds: string[]) {
  const rows: StoredRow[] = [];
  const adminActions: unknown[] = [];
  let seq = 1;

  const matchesWhere = (row: StoredRow, where: Record<string, unknown>): boolean => {
    if (where.id && row.id !== where.id) return false;
    if (where.user_id && row.user_id !== where.user_id) return false;
    if ('dismissed_at' in where && where.dismissed_at === null && row.dismissed_at !== null) return false;
    if ('read_at' in where && where.read_at === null && row.read_at !== null) return false;
    if (Array.isArray(where.OR)) {
      const ok = where.OR.some((clause: Record<string, unknown>) => {
        if ('expires_at' in clause && clause.expires_at === null) return row.expires_at === null;
        if (clause.expires_at && typeof clause.expires_at === 'object' && 'gt' in clause.expires_at) {
          return row.expires_at !== null && row.expires_at > (clause.expires_at as { gt: Date }).gt;
        }
        return false;
      });
      if (!ok) return false;
    }
    return true;
  };

  const prisma = {
    auth: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => userIds.includes(id)).map((id) => ({ id }))
      ),
    },
    userNotification: {
      create: vi.fn(async ({ data }: { data: Omit<StoredRow, 'id' | 'read_at' | 'dismissed_at' | 'created_at'> }) => {
        const row: StoredRow = {
          id: `notif-${seq++}`,
          user_id: data.user_id,
          sender_admin_id: data.sender_admin_id ?? null,
          sender_label: data.sender_label ?? null,
          category: data.category,
          priority: data.priority,
          title: data.title,
          body: data.body,
          action_url: data.action_url ?? null,
          action_label: data.action_label ?? null,
          read_at: null,
          dismissed_at: null,
          expires_at: data.expires_at ?? null,
          metadata: data.metadata ?? null,
          created_at: new Date(1_700_000_000_000 + seq * 1000),
        };
        rows.push(row);
        return { id: row.id };
      }),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matchesWhere(r, where)).length
      ),
      findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) => {
        const matched = rows
          .filter((r) => matchesWhere(r, where))
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        return typeof take === 'number' ? matched.slice(0, take) : matched;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((r) => matchesWhere(r, where)) ?? null
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<StoredRow> }) => {
        let count = 0;
        for (const r of rows) {
          if (matchesWhere(r, where)) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      }),
    },
    adminAction: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        adminActions.push(data);
        return data;
      }),
    },
  };

  return { prisma: prisma as unknown as Parameters<typeof sendUserNotifications>[0], rows, adminActions };
}

describe('sanitizeActionUrl', () => {
  it('allows relative paths and rejects external or protocol-relative URLs', () => {
    expect(sanitizeActionUrl('/dashboard/you')).toEqual({ ok: true, value: '/dashboard/you' });
    expect(sanitizeActionUrl('')).toEqual({ ok: true, value: null });
    expect(sanitizeActionUrl('https://evil.example.com')).toEqual({ ok: false });
    expect(sanitizeActionUrl('//evil.example.com')).toEqual({ ok: false });
    expect(sanitizeActionUrl('/foo\nbar')).toEqual({ ok: false });
  });
});

describe('notificationService', () => {
  it('validates recipients, title/body, and records admin_actions without PII body', async () => {
    const { prisma, rows, adminActions } = makeFakePrisma(['user-1']);

    const badUrl = await sendUserNotifications(prisma, {
      userId: 'user-1',
      title: 'Hello',
      body: 'World',
      actionUrl: 'https://evil.com',
    });
    expect(badUrl).toEqual({ ok: false, status: 400, error: 'invalid_action_url' });

    const missing = await sendUserNotifications(prisma, {
      userId: 'user-missing',
      title: 'Hello',
      body: 'World',
    });
    expect(missing).toEqual({ ok: false, status: 404, error: 'recipient_not_found' });

    const ok = await sendUserNotifications(prisma, {
      userId: 'user-1',
      title: 'Chart Ready',
      body: 'Your updated reading is ready.',
      priority: 'important',
      actionUrl: '/dashboard/you',
      actionLabel: 'View reading',
      actorAdminId: 'admin-1',
      reason: 'qa_followup',
    });
    expect(ok).toEqual({ ok: true, sentCount: 1, notificationIds: ['notif-1'] });
    expect(rows).toHaveLength(1);
    expect(adminActions).toHaveLength(1);
    expect(JSON.stringify(adminActions[0])).not.toContain('Your updated reading is ready.');
  });

  it('enforces user ownership on read and dismiss', async () => {
    const { prisma } = makeFakePrisma(['user-1', 'user-2']);
    await sendUserNotifications(prisma, {
      userId: 'user-1',
      title: 'Private Notice',
      body: 'Only for user 1',
    });

    const crossRead = await markNotificationRead(prisma, 'user-2', 'notif-1');
    expect(crossRead.found).toBe(false);

    const crossDismiss = await dismissNotification(prisma, 'user-2', 'notif-1');
    expect(crossDismiss.found).toBe(false);

    const list1 = await listUserNotifications(prisma, 'user-1');
    expect(list1.unreadCount).toBe(1);
    expect(list1.items).toHaveLength(1);

    const ownRead = await markNotificationRead(prisma, 'user-1', 'notif-1');
    expect(ownRead).toEqual({ found: true, unreadCount: 0 });

    await sendUserNotifications(prisma, {
      userId: 'user-1',
      title: 'Second Notice',
      body: 'Another update',
    });
    const readAll = await markAllNotificationsRead(prisma, 'user-1');
    expect(readAll).toEqual({ updatedCount: 1, unreadCount: 0 });

    const ownDismiss = await dismissNotification(prisma, 'user-1', 'notif-1');
    expect(ownDismiss.found).toBe(true);
    const afterDismiss = await listUserNotifications(prisma, 'user-1');
    expect(afterDismiss.items.map((i) => i.id)).toEqual(['notif-2']);
  });
});

describe('notification HTTP routes', () => {
  it('guards admin send route with token and serves consumer inbox for authenticated user', async () => {
    const { prisma } = makeFakePrisma(['user-1']);
    const app = express();
    app.use(express.json());

    registerAdminNotificationRoutes(app, { prisma, enabled: true, token: 'secret-lab-token' });
    registerNotificationRoutes(app, {
      prisma,
      requireUser: async (req, res) => {
        const uid = req.header('x-test-user');
        if (!uid) {
          res.status(401).json({ error: 'unauthorized' });
          return null;
        }
        return uid;
      },
    });

    const server = app.listen(0);
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    try {
      const forbidden = await fetch(`${baseUrl}/api/admin-lab/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1', title: 'Hi', body: 'There' }),
      });
      expect(forbidden.status).toBe(403);

      const sent = await fetch(`${baseUrl}/api/admin-lab/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-lab-token': 'secret-lab-token' },
        body: JSON.stringify({ userId: 'user-1', title: 'Welcome', body: 'Message from admin' }),
      });
      expect(sent.status).toBe(201);

      const inbox = await fetch(`${baseUrl}/api/notifications`, {
        headers: { 'x-test-user': 'user-1' },
      });
      expect(inbox.status).toBe(200);
      const data = (await inbox.json()) as { unreadCount: number; items: Array<{ id: string; title: string }> };
      expect(data.unreadCount).toBe(1);
      expect(data.items[0]?.title).toBe('Welcome');

      const readRes = await fetch(`${baseUrl}/api/notifications/${data.items[0]!.id}/read`, {
        method: 'PATCH',
        headers: { 'x-test-user': 'user-1' },
      });
      expect(readRes.status).toBe(200);
      const readData = (await readRes.json()) as { unreadCount: number };
      expect(readData.unreadCount).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
