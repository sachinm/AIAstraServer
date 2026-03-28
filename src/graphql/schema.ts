import { createSchema } from 'graphql-yoga';
import type { Prisma } from '@prisma/client';
import { login, signup } from '../services/authService.js';
import { runRagQuery, processKundliUpload } from '../services/kundliService.js';
import { chatWithConfiguredProvider } from '../services/chatLlmService.js';
import { validateAskForUser, persistAskTurn } from '../services/askChatTurn.js';
import * as adminService from '../services/adminService.js';
import { enqueueKundliSync } from '../services/kundliQueueService.js';
import { requireRoles } from './rbac.js';
import { ALL_AUTHENTICATED_ROLES } from './rbac.js';
import type { GraphQLContext } from './context.js';

const ADMIN_ROLES = ['admin', 'superadmin'] as const;

const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    username: String
    email: String
    role: String
  }

  type UserDetails {
    user_id: ID!
    is_active: Boolean
    kundli_added: Boolean
    queue_status: String
  }

  type BiodataResult {
    success: Boolean!
    username: String
    biodata: String
    error: String
  }

  type UserContentResult {
    success: Boolean!
    content: String
    error: String
  }

  type KundliDisplayDataResult {
    success: Boolean!
    error: String
    biodata: String
    d1: String
    d7: String
    d9: String
    d10: String
    vimsottari_dasa: String
    narayana_dasa: String
  }

  type LoginResult {
    success: Boolean!
    message: String
    token: String
    user: ID
    role: String
  }

  type AskResult {
    success: Boolean!
    answer: String
    error: String
  }

  type SignUpResult {
    success: Boolean!
    message: String
    token: String
    user: ID
    role: String
  }

  type UploadKundliResult {
    success: Boolean!
    message: String
    kundli_id: ID
  }

  type Chat {
    id: ID!
    user_id: ID!
    name: String
    is_active: Boolean
    created_at: String
  }

  type ChatMessage {
    id: ID!
    chat_id: ID!
    question: String
    ai_answer: String
    created_at: String
  }

  type ChatsResult {
    success: Boolean!
    chats: [Chat!]
    error: String
  }

  type ChatResult {
    success: Boolean!
    chat: Chat
    error: String
  }

  type MessagesResult {
    success: Boolean!
    messages: [ChatMessage!]
    error: String
  }

  type MessageResult {
    success: Boolean!
    message: ChatMessage
    error: String
  }

  type AdminUser {
    id: ID!
    username: String!
    email: String!
    role: String
    is_active: Boolean
    kundli_added: Boolean
    created_at: String
  }

  type AdminUserDetail {
    id: ID!
    username: String!
    email: String!
    role: String
    date_of_birth: String!
    place_of_birth: String
    time_of_birth: String
    gender: String
    is_active: Boolean
    kundli_added: Boolean
    created_at: String
  }

  type UserListResult {
    success: Boolean!
    users: [AdminUser!]
    error: String
  }

  type UserDetailResult {
    success: Boolean!
    user: AdminUserDetail
    error: String
  }

  type UpdateUserResult {
    success: Boolean!
    error: String
  }

  type ResetPasswordResult {
    success: Boolean!
    error: String
  }

  type KundliResult {
    success: Boolean!
    kundli: String
    error: String
    queue_status: String
    queue_started_at: String
    queue_completed_at: String
    last_sync_error: String
  }

  type RefreshKundliResult {
    success: Boolean!
    error: String
  }

  input AdminUpdateUserInput {
    username: String
    email: String
    date_of_birth: String
    place_of_birth: String
    time_of_birth: String
    gender: String
    is_active: Boolean
  }

  type Query {
    me: User
    meDetails: UserDetails
    myBiodata: BiodataResult
    myContent: UserContentResult
    myKundliDisplayData: KundliDisplayDataResult
    ask(question: String!, chatId: ID): AskResult
    chats: ChatsResult
    activeChat: ChatResult
    chatMessages(chatId: ID!): MessagesResult
    adminListUsers(role: String, search: String): UserListResult
    adminGetUser(id: ID!): UserDetailResult
    adminGetUserChats(userId: ID!): ChatsResult
    adminGetUserKundli(userId: ID!): KundliResult
  }

  input SignUpInput {
    username: String!
    password: String!
    email: String!
    date_of_birth: String!
    place_of_birth: String
    time_of_birth: String
    gender: String
  }

  type Mutation {
    login(username: String!, password: String!): LoginResult!
    signup(input: SignUpInput!): SignUpResult!
    uploadKundli(fileBase64: String!): UploadKundliResult!
    createChat: ChatResult!
    setChatInactive(chatId: ID!): ChatResult!
    addMessage(chatId: ID!, question: String!, aiAnswer: String!): MessageResult!
    adminUpdateUser(id: ID!, input: AdminUpdateUserInput!): UpdateUserResult!
    adminResetPassword(id: ID!, newPassword: String!): ResetPasswordResult!
    adminRefreshUserKundli(userId: ID!): RefreshKundliResult!
  }
`;

function withAuth<T>(
  context: GraphQLContext,
  fn: () => T
): T | { success: false; error: string } {
  try {
    requireRoles(context, [...ALL_AUTHENTICATED_ROLES]);
    return fn();
  } catch (err) {
    const msg = (err as Error)?.message ?? 'Not authenticated';
    return { success: false, error: msg } as T & { success: false; error: string };
  }
}

function withAdmin<T>(
  context: GraphQLContext,
  fn: () => T
): T | { success: false; error: string } {
  try {
    requireRoles(context, [...ADMIN_ROLES]);
    return fn();
  } catch (err) {
    const msg = (err as Error)?.message ?? 'Forbidden';
    return { success: false, error: msg } as T & { success: false; error: string };
  }
}

const resolvers = {
  Query: {
    async me(_parent: unknown, _args: unknown, context: GraphQLContext) {
      try {
        requireRoles(context, [...ALL_AUTHENTICATED_ROLES]);
      } catch {
        return null;
      }
      const { userId, prisma: db } = context;
      if (!userId) return null;
      const user = await db.auth.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, role: true },
      });
      if (!user) return null;
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role ?? 'user',
      };
    },
    async ask(
      _parent: unknown,
      { question, chatId }: { question: string; chatId?: string | null },
      context: GraphQLContext
    ) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, answer: null, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId) {
        return { success: false, answer: null, error: 'Not authenticated' };
      }
      try {
        const pre = await validateAskForUser(db, userId);
        if (!pre.ok) {
          return { success: false, answer: null, error: pre.error };
        }
        const chatResult = await chatWithConfiguredProvider(db, userId, question);
        await persistAskTurn(db, userId, chatId, question, chatResult, false);
        return { success: true, answer: chatResult.answerText, error: null };
      } catch (err) {
        const msg = (err as Error)?.message || 'Query failed';
        return { success: false, answer: null, error: msg };
      }
    },
    async meDetails(_parent: unknown, _args: unknown, context: GraphQLContext) {
      try {
        requireRoles(context, [...ALL_AUTHENTICATED_ROLES]);
      } catch {
        return null;
      }
      const { userId, prisma: db } = context;
      if (!userId) return null;
      const user = await db.auth.findUnique({
        where: { id: userId },
        select: { id: true, is_active: true, kundli_added: true },
      });
      if (!user) return null;
      const latestKundli = await db.kundli.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        select: { queue_status: true },
      });
      return {
        user_id: user.id,
        is_active: user.is_active ?? false,
        kundli_added: user.kundli_added ?? false,
        queue_status: latestKundli?.queue_status ?? null,
      };
    },
    async myBiodata(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return {
          success: false,
          username: null,
          biodata: null,
          error: result.error,
        };
      }
      const { userId, prisma: db } = context;
      if (!userId) {
        return {
          success: false,
          username: null,
          biodata: null,
          error: 'Not authenticated',
        };
      }
      try {
        const user = await db.auth.findUnique({
          where: { id: userId },
          select: { id: true, is_active: true, kundli_added: true, username: true },
        });
        if (!user || !user.is_active || !user.kundli_added) {
          return {
            success: false,
            username: null,
            biodata: null,
            error: 'Not available',
          };
        }
        const kundli = await db.kundli.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          select: { biodata: true },
        });
        if (!kundli) {
          return {
            success: false,
            username: null,
            biodata: null,
            error: 'No biodata found',
          };
        }
        const biodataStr =
          typeof kundli.biodata === 'string'
            ? kundli.biodata
            : JSON.stringify(kundli.biodata ?? {});
        return {
          success: true,
          username: user.username,
          biodata: biodataStr,
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          username: null,
          biodata: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async myContent(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, content: null, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId) {
        return { success: false, content: null, error: 'Not authenticated' };
      }
      try {
        const row = await db.userGeneratedContent.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
        });
        if (!row) {
          return { success: false, content: null, error: 'No content found' };
        }
        const content = JSON.stringify({
          remedies: row.remedies,
          mantras: row.mantras,
          routines: row.routines,
          created_at: row.created_at,
          kundli_id: row.kundli_id,
        });
        return { success: true, content, error: null };
      } catch (err) {
        return {
          success: false,
          content: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async myKundliDisplayData(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const empty = {
        success: false as const,
        error: null as string | null,
        biodata: null as string | null,
        d1: null as string | null,
        d7: null as string | null,
        d9: null as string | null,
        d10: null as string | null,
        vimsottari_dasa: null as string | null,
        narayana_dasa: null as string | null,
      };
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { ...empty, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId) {
        return { ...empty, error: 'Not authenticated' };
      }
      const jsonToString = (value: Prisma.JsonValue | null | undefined): string | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
      };
      try {
        const user = await db.auth.findUnique({
          where: { id: userId },
          select: { id: true, is_active: true, kundli_added: true },
        });
        if (!user || !user.is_active) {
          return { ...empty, error: 'Not available' };
        }
        if (!user.kundli_added) {
          return { ...empty, error: 'Kundli sync not complete' };
        }
        const kundli = await db.kundli.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          select: {
            biodata: true,
            d1: true,
            d7: true,
            d9: true,
            d10: true,
            vimsottari_dasa: true,
            narayana_dasa: true,
          },
        });
        if (!kundli) {
          return { ...empty, error: 'No kundli found' };
        }
        return {
          success: true,
          error: null,
          biodata: jsonToString(kundli.biodata),
          d1: jsonToString(kundli.d1),
          d7: jsonToString(kundli.d7),
          d9: jsonToString(kundli.d9),
          d10: jsonToString(kundli.d10),
          vimsottari_dasa: jsonToString(kundli.vimsottari_dasa),
          narayana_dasa: jsonToString(kundli.narayana_dasa),
        };
      } catch (err) {
        return {
          ...empty,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async chats(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, chats: [], error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId) return { success: false, chats: [], error: 'Not authenticated' };
      try {
        const list = await db.chat.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
        });
        const chats = list.map((c) => ({
          id: c.id,
          user_id: c.user_id,
          name: c.name,
          is_active: c.is_active,
          created_at: c.created_at?.toISOString?.() ?? null,
        }));
        return { success: true, chats, error: null };
      } catch (err) {
        return {
          success: false,
          chats: [],
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async activeChat(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, chat: null, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId)
        return { success: false, chat: null, error: 'Not authenticated' };
      try {
        const chat = await db.chat.findFirst({
          where: { user_id: userId, is_active: true },
          orderBy: { created_at: 'desc' },
        });
        if (!chat) return { success: true, chat: null, error: null };
        return {
          success: true,
          chat: {
            id: chat.id,
            user_id: chat.user_id,
            name: chat.name,
            is_active: chat.is_active,
            created_at: chat.created_at?.toISOString?.() ?? null,
          },
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          chat: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async chatMessages(
      _parent: unknown,
      { chatId }: { chatId: string },
      context: GraphQLContext
    ) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, messages: [], error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId)
        return { success: false, messages: [], error: 'Not authenticated' };
      try {
        const chat = await db.chat.findFirst({
          where: { id: chatId, user_id: userId },
        });
        if (!chat) return { success: false, messages: [], error: 'Not found' };
        const list = await db.message.findMany({
          where: { chat_id: chatId },
          orderBy: { created_at: 'asc' },
        });
        const messages = list.map((m) => ({
          id: m.id,
          chat_id: m.chat_id,
          question: m.question,
          ai_answer: m.ai_answer,
          created_at: m.created_at?.toISOString?.() ?? null,
        }));
        return { success: true, messages, error: null };
      } catch (err) {
        return {
          success: false,
          messages: [],
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async adminListUsers(
      _parent: unknown,
      { role, search }: { role?: string | null; search?: string | null },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, users: [], error: result.error };
      }
      const { prisma: db } = context;
      try {
        const users = await adminService.listUsers(db, role ?? null, search ?? null);
        return {
          success: true,
          users: users.map((u) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            is_active: u.is_active,
            kundli_added: u.kundli_added,
            created_at: u.created_at?.toISOString?.() ?? null,
          })),
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          users: [],
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async adminGetUser(
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, user: null, error: result.error };
      }
      const { prisma: db } = context;
      try {
        const user = await adminService.getUserById(db, id);
        if (!user) {
          return { success: false, user: null, error: 'User not found' };
        }
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            date_of_birth: user.date_of_birth,
            place_of_birth: user.place_of_birth,
            time_of_birth: user.time_of_birth,
            gender: user.gender,
            is_active: user.is_active,
            kundli_added: user.kundli_added,
            created_at: user.created_at?.toISOString?.() ?? null,
          },
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          user: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async adminGetUserChats(
      _parent: unknown,
      { userId }: { userId: string },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, chats: [], error: result.error };
      }
      const { prisma: db } = context;
      try {
        const target = await adminService.getUserById(db, userId);
        if (!target) {
          return { success: false, chats: [], error: 'User not found' };
        }
        const list = await db.chat.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
        });
        const chats = list.map((c) => ({
          id: c.id,
          user_id: c.user_id,
          name: c.name,
          is_active: c.is_active,
          created_at: c.created_at?.toISOString?.() ?? null,
        }));
        return { success: true, chats, error: null };
      } catch (err) {
        return {
          success: false,
          chats: [],
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async adminGetUserKundli(
      _parent: unknown,
      { userId }: { userId: string },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, kundli: null, error: result.error };
      }
      const { prisma: db } = context;
      try {
        const target = await adminService.getUserById(db, userId);
        if (!target) {
          return { success: false, kundli: null, error: 'User not found' };
        }
        const row = await db.kundli.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
        });
        if (!row) {
          return {
            success: true,
            kundli: null,
            error: null,
            queue_status: null,
            queue_started_at: null,
            queue_completed_at: null,
            last_sync_error: null,
          };
        }
        const kundliJson = {
          id: row.id,
          user_id: row.user_id,
          biodata: row.biodata,
          d1: row.d1,
          d7: (row as { d7?: unknown }).d7,
          d9: row.d9,
          d10: row.d10,
          charakaraka: row.charakaraka,
          vimsottari_dasa: row.vimsottari_dasa,
          narayana_dasa: row.narayana_dasa,
          created_at: row.created_at?.toISOString?.() ?? null,
          queue_status: row.queue_status,
          queue_started_at: row.queue_started_at?.toISOString?.() ?? null,
          queue_completed_at: row.queue_completed_at?.toISOString?.() ?? null,
          last_sync_error: row.last_sync_error,
        };
        return {
          success: true,
          kundli: JSON.stringify(kundliJson, null, 2),
          error: null,
          queue_status: row.queue_status,
          queue_started_at: row.queue_started_at?.toISOString?.() ?? null,
          queue_completed_at: row.queue_completed_at?.toISOString?.() ?? null,
          last_sync_error: row.last_sync_error,
        };
      } catch (err) {
        return {
          success: false,
          kundli: null,
          error: (err as Error)?.message || 'Server error',
          queue_status: null,
          queue_started_at: null,
          queue_completed_at: null,
          last_sync_error: null,
        };
      }
    },
  },
  Mutation: {
    async login(
      _parent: unknown,
      { username, password }: { username: string; password: string },
      _context: GraphQLContext
    ) {
      return login(username, password);
    },
    async signup(
      _parent: unknown,
      { input }: { input: unknown },
      _context: GraphQLContext
    ) {
      return signup(input);
    },
    async uploadKundli(
      _parent: unknown,
      { fileBase64 }: { fileBase64: string },
      context: GraphQLContext
    ) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return {
          success: false,
          message: result.error,
          kundli_id: null,
        };
      }
      const { userId, prisma: db } = context;
      if (!userId) {
        return { success: false, message: 'Not authenticated', kundli_id: null };
      }
      try {
        const buf = Buffer.from(fileBase64, 'base64');
        const kundliJson = JSON.parse(buf.toString()) as Record<string, unknown>;
        const biodata = kundliJson.biodata ?? null;
        const d1 = kundliJson.D1 ?? null;
        const d9 = kundliJson.D9 ?? null;
        const d10 = kundliJson.D10 ?? null;
        const charakaraka = kundliJson.charaKaraka ?? null;
        const vimsottari_dasa = kundliJson.vimsottariDasa ?? null;
        const narayana_dasa = kundliJson.narayanaDasa ?? null;
        const d7 = kundliJson.d7 ?? kundliJson.D7 ?? null;
        const kundli = await db.kundli.create({
          data: {
            user_id: userId,
            biodata: biodata ?? undefined,
            d1: d1 ?? undefined,
            d7: d7 ?? undefined,
            d9: d9 ?? undefined,
            d10: d10 ?? undefined,
            charakaraka: charakaraka ?? undefined,
            vimsottari_dasa: vimsottari_dasa ?? undefined,
            narayana_dasa: narayana_dasa ?? undefined,
            queue_status: 'completed',
            queue_completed_at: new Date(),
          },
        });
        await processKundliUpload(db, userId);
        await db.auth.update({
          where: { id: userId },
          data: { kundli_added: true },
        });
        return { success: true, message: 'OK', kundli_id: kundli.id };
      } catch (err) {
        const msg = (err as Error)?.message || 'Upload failed';
        return { success: false, message: msg, kundli_id: null };
      }
    },
    async createChat(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, chat: null, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId)
        return { success: false, chat: null, error: 'Not authenticated' };
      try {
        await db.chat.updateMany({
          where: { user_id: userId },
          data: { is_active: false },
        });
        const chat = await db.chat.create({
          data: { user_id: userId, is_active: true },
        });
        return {
          success: true,
          chat: {
            id: chat.id,
            user_id: chat.user_id,
            name: chat.name,
            is_active: chat.is_active,
            created_at: chat.created_at?.toISOString?.() ?? null,
          },
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          chat: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async setChatInactive(
      _parent: unknown,
      { chatId }: { chatId: string },
      context: GraphQLContext
    ) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, chat: null, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId)
        return { success: false, chat: null, error: 'Not authenticated' };
      try {
        const chat = await db.chat.findFirst({
          where: { id: chatId, user_id: userId },
        });
        if (!chat) return { success: false, chat: null, error: 'Not found' };
        const updated = await db.chat.update({
          where: { id: chatId },
          data: { is_active: false },
        });
        return {
          success: true,
          chat: {
            id: updated.id,
            user_id: updated.user_id,
            name: updated.name,
            is_active: updated.is_active,
            created_at: updated.created_at?.toISOString?.() ?? null,
          },
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          chat: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async addMessage(
      _parent: unknown,
      {
        chatId,
        question,
        aiAnswer,
      }: { chatId: string; question: string; aiAnswer: string },
      context: GraphQLContext
    ) {
      const result = withAuth(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, message: null, error: result.error };
      }
      const { userId, prisma: db } = context;
      if (!userId)
        return { success: false, message: null, error: 'Not authenticated' };
      try {
        const chat = await db.chat.findFirst({
          where: { id: chatId, user_id: userId },
        });
        if (!chat) return { success: false, message: null, error: 'Not found' };
        const message = await db.message.create({
          data: { chat_id: chatId, question, ai_answer: aiAnswer },
        });
        return {
          success: true,
          message: {
            id: message.id,
            chat_id: message.chat_id,
            question: message.question,
            ai_answer: message.ai_answer,
            created_at: message.created_at?.toISOString?.() ?? null,
          },
          error: null,
        };
      } catch (err) {
        return {
          success: false,
          message: null,
          error: (err as Error)?.message || 'Server error',
        };
      }
    },
    async adminUpdateUser(
      _parent: unknown,
      { id, input }: { id: string; input: adminService.AdminUpdateUserInput },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, error: result.error };
      }
      const { prisma: db } = context;
      try {
        await adminService.updateUser(db, id, input);
        return { success: true, error: null };
      } catch (err) {
        return {
          success: false,
          error: (err as Error)?.message || 'Update failed',
        };
      }
    },
    async adminResetPassword(
      _parent: unknown,
      { id, newPassword }: { id: string; newPassword: string },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, error: result.error };
      }
      const { prisma: db } = context;
      try {
        await adminService.resetPassword(db, id, newPassword);
        return { success: true, error: null };
      } catch (err) {
        return {
          success: false,
          error: (err as Error)?.message || 'Reset failed',
        };
      }
    },
    async adminRefreshUserKundli(
      _parent: unknown,
      { userId }: { userId: string },
      context: GraphQLContext
    ) {
      const result = withAdmin(context, () => null);
      if (result && 'success' in result && !result.success) {
        return { success: false, error: result.error };
      }
      const { prisma: db } = context;
      try {
        await enqueueKundliSync(db, userId);
        return { success: true, error: null };
      } catch (err) {
        return { success: false, error: (err as Error)?.message ?? 'Server error' };
      }
    },
  },
};

export const schema = createSchema({
  typeDefs,
  resolvers,
});

export { resolvers };
