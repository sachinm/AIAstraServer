import type { PrismaClient } from '@prisma/client';

export const NOTIFICATION_CATEGORIES = ['admin_message', 'system', 'reading', 'billing'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_PRIORITIES = ['normal', 'important'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const MAX_ADMIN_SEND_BATCH = 100;
export const MAX_TITLE_LEN = 160;
export const MAX_BODY_LEN = 4000;
export const MAX_SENDER_LABEL_LEN = 80;
export const MAX_ACTION_LABEL_LEN = 60;
export const MAX_ACTION_URL_LEN = 300;
export const DEFAULT_INBOX_LIMIT = 20;
export const MAX_INBOX_LIMIT = 50;

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  senderLabel: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  actionLabel: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface SendNotificationsInput {
  userId?: unknown;
  userIds?: unknown;
  title?: unknown;
  body?: unknown;
  category?: unknown;
  priority?: unknown;
  senderLabel?: unknown;
  actionUrl?: unknown;
  actionLabel?: unknown;
  expiresAt?: unknown;
  actorAdminId?: unknown;
  reason?: unknown;
  metadata?: unknown;
}

export type SendNotificationsResult =
  | { ok: true; sentCount: number; notificationIds: string[] }
  | { ok: false; status: 400 | 404; error: string };

/** Allow only safe in-app relative paths (starts with `/`, never `//`, no control chars). */
export function sanitizeActionUrl(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw == null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_ACTION_URL_LEN) return { ok: false };
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || /[\r\n\0\\]/.test(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

function normalizeUserIds(input: SendNotificationsInput): string[] | null {
  const rawList: string[] = [];
  if (typeof input.userId === 'string' && input.userId.trim()) {
    rawList.push(input.userId.trim());
  }
  if (Array.isArray(input.userIds)) {
    for (const entry of input.userIds) {
      if (typeof entry !== 'string' || !entry.trim()) return null;
      rawList.push(entry.trim());
    }
  } else if (input.userIds !== undefined) {
    return null;
  }
  const unique = [...new Set(rawList)];
  if (unique.length === 0 || unique.length > MAX_ADMIN_SEND_BATCH) return null;
  return unique;
}

function activeInboxWhere(userId: string, now: Date) {
  return {
    user_id: userId,
    dismissed_at: null,
    OR: [{ expires_at: null }, { expires_at: { gt: now } }],
  };
}

function toNotificationItem(row: {
  id: string;
  category: string;
  priority: string;
  sender_label: string | null;
  title: string;
  body: string;
  action_url: string | null;
  action_label: string | null;
  read_at: Date | null;
  created_at: Date;
}): NotificationItem {
  return {
    id: row.id,
    category: (NOTIFICATION_CATEGORIES as readonly string[]).includes(row.category)
      ? (row.category as NotificationCategory)
      : 'admin_message',
    priority: (NOTIFICATION_PRIORITIES as readonly string[]).includes(row.priority)
      ? (row.priority as NotificationPriority)
      : 'normal',
    senderLabel: row.sender_label,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    actionLabel: row.action_label,
    readAt: row.read_at ? row.read_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Send a notification from the admin module to one or more users, recording an `admin_actions` audit row
 * (counts/ids/category only — never message body or PII).
 */
export async function sendUserNotifications(
  prisma: PrismaClient,
  input: SendNotificationsInput
): Promise<SendNotificationsResult> {
  const userIds = normalizeUserIds(input);
  if (!userIds) {
    return { ok: false, status: 400, error: 'invalid_recipients' };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!title || title.length > MAX_TITLE_LEN) {
    return { ok: false, status: 400, error: 'invalid_title' };
  }
  if (!body || body.length > MAX_BODY_LEN) {
    return { ok: false, status: 400, error: 'invalid_body' };
  }

  const category = (input.category ?? 'admin_message') as string;
  if (!(NOTIFICATION_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, status: 400, error: 'invalid_category' };
  }

  const priority = (input.priority ?? 'normal') as string;
  if (!(NOTIFICATION_PRIORITIES as readonly string[]).includes(priority)) {
    return { ok: false, status: 400, error: 'invalid_priority' };
  }

  const actionUrlCheck = sanitizeActionUrl(input.actionUrl);
  if (!actionUrlCheck.ok) {
    return { ok: false, status: 400, error: 'invalid_action_url' };
  }

  const actionLabel =
    typeof input.actionLabel === 'string' && input.actionLabel.trim()
      ? input.actionLabel.trim().slice(0, MAX_ACTION_LABEL_LEN)
      : null;

  const senderLabel =
    typeof input.senderLabel === 'string' && input.senderLabel.trim()
      ? input.senderLabel.trim().slice(0, MAX_SENDER_LABEL_LEN)
      : 'AI AdAstra Team';

  let expiresAt: Date | null = null;
  if (input.expiresAt != null && input.expiresAt !== '') {
    if (typeof input.expiresAt !== 'string' || Number.isNaN(Date.parse(input.expiresAt))) {
      return { ok: false, status: 400, error: 'invalid_expires_at' };
    }
    expiresAt = new Date(input.expiresAt);
  }

  const existingUsers = await prisma.auth.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });
  if (existingUsers.length !== userIds.length) {
    return { ok: false, status: 404, error: 'recipient_not_found' };
  }

  const actorAdminId =
    typeof input.actorAdminId === 'string' && input.actorAdminId.trim() ? input.actorAdminId.trim() : null;
  const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 200) : null;
  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? (input.metadata as object)
      : undefined;

  const createdIds: string[] = [];
  for (const uid of userIds) {
    const created = await prisma.userNotification.create({
      data: {
        user_id: uid,
        sender_admin_id: actorAdminId,
        sender_label: senderLabel,
        category,
        priority,
        title,
        body,
        action_url: actionUrlCheck.value,
        action_label: actionLabel,
        expires_at: expiresAt,
        ...(metadata !== undefined ? { metadata } : {}),
      },
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  await prisma.adminAction
    ?.create?.({
      data: {
        action: 'notification.send',
        actor_kind: 'admin',
        actor_admin_id: actorAdminId,
        target_user_id: userIds.length === 1 ? userIds[0]! : null,
        reason,
        after: {
          sentCount: createdIds.length,
          category,
          priority,
          hasActionUrl: actionUrlCheck.value !== null,
        } as object,
      },
    })
    .catch(() => undefined);

  return { ok: true, sentCount: createdIds.length, notificationIds: createdIds };
}

export async function getUnreadNotificationCount(prisma: PrismaClient, userId: string, now = new Date()): Promise<number> {
  return prisma.userNotification.count({
    where: {
      ...activeInboxWhere(userId, now),
      read_at: null,
    },
  });
}

export async function listUserNotifications(
  prisma: PrismaClient,
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; now?: Date } = {}
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_INBOX_LIMIT), MAX_INBOX_LIMIT);
  const baseWhere = activeInboxWhere(userId, now);

  const [rows, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where: options.unreadOnly ? { ...baseWhere, read_at: null } : baseWhere,
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        category: true,
        priority: true,
        sender_label: true,
        title: true,
        body: true,
        action_url: true,
        action_label: true,
        read_at: true,
        created_at: true,
      },
    }),
    getUnreadNotificationCount(prisma, userId, now),
  ]);

  return {
    items: rows.map(toNotificationItem),
    unreadCount,
  };
}

export async function markNotificationRead(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
  now = new Date()
): Promise<{ found: boolean; unreadCount: number }> {
  const existing = await prisma.userNotification.findFirst({
    where: { id: notificationId, user_id: userId, dismissed_at: null },
    select: { id: true, read_at: true },
  });
  if (!existing) {
    return { found: false, unreadCount: await getUnreadNotificationCount(prisma, userId, now) };
  }
  if (!existing.read_at) {
    await prisma.userNotification.updateMany({
      where: { id: notificationId, user_id: userId, read_at: null },
      data: { read_at: now },
    });
  }
  return { found: true, unreadCount: await getUnreadNotificationCount(prisma, userId, now) };
}

export async function markAllNotificationsRead(
  prisma: PrismaClient,
  userId: string,
  now = new Date()
): Promise<{ updatedCount: number; unreadCount: number }> {
  const result = await prisma.userNotification.updateMany({
    where: {
      ...activeInboxWhere(userId, now),
      read_at: null,
    },
    data: { read_at: now },
  });
  return {
    updatedCount: result.count,
    unreadCount: await getUnreadNotificationCount(prisma, userId, now),
  };
}

export async function dismissNotification(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
  now = new Date()
): Promise<{ found: boolean; unreadCount: number }> {
  const result = await prisma.userNotification.updateMany({
    where: { id: notificationId, user_id: userId, dismissed_at: null },
    data: { dismissed_at: now },
  });
  return {
    found: result.count > 0,
    unreadCount: await getUnreadNotificationCount(prisma, userId, now),
  };
}

export async function listAdminSentNotifications(
  prisma: PrismaClient,
  userId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    category: string;
    priority: string;
    senderLabel: string | null;
    title: string;
    body: string;
    actionUrl: string | null;
    actionLabel: string | null;
    readAt: string | null;
    dismissedAt: string | null;
    createdAt: string;
  }>
> {
  const take = Math.min(Math.max(1, limit), 100);
  const rows = await prisma.userNotification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take,
    select: {
      id: true,
      category: true,
      priority: true,
      sender_label: true,
      title: true,
      body: true,
      action_url: true,
      action_label: true,
      read_at: true,
      dismissed_at: true,
      created_at: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    priority: r.priority,
    senderLabel: r.sender_label,
    title: r.title,
    body: r.body,
    actionUrl: r.action_url,
    actionLabel: r.action_label,
    readAt: r.read_at ? r.read_at.toISOString() : null,
    dismissedAt: r.dismissed_at ? r.dismissed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));
}
