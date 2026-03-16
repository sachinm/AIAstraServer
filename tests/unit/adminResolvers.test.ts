import { describe, it, expect, vi } from 'vitest';
import { resolvers } from '../../src/graphql/schema.js';
import type { GraphQLContext } from '../../src/graphql/context.js';
import type { PrismaClient } from '@prisma/client';

vi.mock('../../src/lib/hash.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

function createMockPrisma(overrides: {
  findMany?: (args: unknown) => Promise<unknown[]>;
  findUnique?: (args: unknown) => Promise<unknown>;
  findFirst?: (args: unknown) => Promise<unknown>;
  update?: (args: unknown) => Promise<unknown>;
} = {}) {
  return {
    auth: {
      findMany: vi.fn().mockImplementation(overrides.findMany ?? (() => Promise.resolve([]))),
      findUnique: vi.fn().mockImplementation(overrides.findUnique ?? (() => Promise.resolve(null))),
      update: vi.fn().mockImplementation(overrides.update ?? (() => Promise.resolve({}))),
    },
    chat: {
      findMany: vi.fn().mockImplementation(overrides.findFirst ? () => Promise.resolve([]) : () => Promise.resolve([])),
    },
    kundli: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function createContext(overrides: Partial<GraphQLContext>): GraphQLContext {
  const mockRequest = {} as Request;
  return {
    userId: null,
    role: null,
    prisma: createMockPrisma(),
    request: mockRequest,
    ...overrides,
  };
}

describe('admin resolvers', () => {
  describe('adminListUsers', () => {
    it('returns error when role is not admin or superadmin', async () => {
      const context = createContext({ userId: 'u1', role: 'astrology_student', prisma: createMockPrisma() });
      const result = await resolvers.Query!.adminListUsers!(null, { role: null, search: null }, context);
      expect(result).toMatchObject({ success: false, error: 'Forbidden', users: [] });
    });

    it('returns users when role is admin', async () => {
      const users = [
        {
          id: 'u1',
          username: 'u1',
          email: 'u1@x.com',
          role: 'astrology_student',
          is_active: true,
          kundli_added: false,
          created_at: new Date(),
        },
      ];
      const prisma = createMockPrisma({ findMany: async () => users });
      const context = createContext({ userId: 'admin1', role: 'admin', prisma });
      const result = await resolvers.Query!.adminListUsers!(null, { role: null, search: null }, context);
      expect(result).toMatchObject({ success: true, error: null });
      expect((result as { users: unknown[] }).users).toHaveLength(1);
      expect((result as { users: { id: string }[] }).users[0].id).toBe('u1');
    });

    it('returns users when role is superadmin', async () => {
      const prisma = createMockPrisma({ findMany: async () => [] });
      const context = createContext({ userId: 'sa1', role: 'superadmin', prisma });
      const result = await resolvers.Query!.adminListUsers!(null, { role: null, search: null }, context);
      expect(result).toMatchObject({ success: true, users: [], error: null });
    });
  });

  describe('adminGetUser', () => {
    it('returns error when role is not admin or superadmin', async () => {
      const context = createContext({ userId: 'u1', role: 'astrologer', prisma: createMockPrisma() });
      const result = await resolvers.Query!.adminGetUser!(null, { id: 'some-id' }, context);
      expect(result).toMatchObject({ success: false, error: 'Forbidden', user: null });
    });

    it('returns User not found when target user is not managed role', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ id: 'admin1', role: 'admin', username: 'a', email: 'a@x.com', date_of_birth: '', place_of_birth: null, time_of_birth: null, gender: null, is_active: true, kundli_added: false, created_at: new Date() }),
      });
      const context = createContext({ userId: 'admin1', role: 'admin', prisma });
      const result = await resolvers.Query!.adminGetUser!(null, { id: 'admin1' }, context);
      expect(result).toMatchObject({ success: false, user: null, error: 'User not found' });
    });

    it('returns user when role is admin and target is astrology_student', async () => {
      const user = {
        id: 'u1',
        username: 'student1',
        email: 's@x.com',
        role: 'astrology_student',
        date_of_birth: '1990-01-01',
        place_of_birth: null,
        time_of_birth: null,
        gender: null,
        is_active: true,
        kundli_added: false,
        created_at: new Date(),
      };
      const prisma = createMockPrisma({ findUnique: async () => user });
      const context = createContext({ userId: 'admin1', role: 'admin', prisma });
      const result = await resolvers.Query!.adminGetUser!(null, { id: 'u1' }, context);
      expect(result).toMatchObject({ success: true, error: null });
      expect((result as { user: { id: string } }).user.id).toBe('u1');
    });
  });

  describe('adminUpdateUser', () => {
    it('returns error when role is not admin or superadmin', async () => {
      const context = createContext({ userId: 'u1', role: 'astrologer', prisma: createMockPrisma() });
      const result = await resolvers.Mutation!.adminUpdateUser!(null, { id: 'u2', input: { username: 'x' } }, context);
      expect(result).toMatchObject({ success: false, error: 'Forbidden' });
    });

    it('returns success when role is admin and target is managed', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'astrology_student' }),
        update: async () => ({}),
      });
      const context = createContext({ userId: 'admin1', role: 'admin', prisma });
      const result = await resolvers.Mutation!.adminUpdateUser!(null, { id: 'u1', input: { username: 'newname' } }, context);
      expect(result).toMatchObject({ success: true, error: null });
    });
  });

  describe('adminResetPassword', () => {
    it('returns error when role is not admin or superadmin', async () => {
      const context = createContext({ userId: 'u1', role: 'astrology_student', prisma: createMockPrisma() });
      const result = await resolvers.Mutation!.adminResetPassword!(null, { id: 'u2', newPassword: 'newpass123' }, context);
      expect(result).toMatchObject({ success: false, error: 'Forbidden' });
    });

    it('returns success when role is superadmin and target is managed', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'astrologer' }),
        update: async () => ({}),
      });
      const context = createContext({ userId: 'sa1', role: 'superadmin', prisma });
      const result = await resolvers.Mutation!.adminResetPassword!(null, { id: 'u1', newPassword: 'newpass123' }, context);
      expect(result).toMatchObject({ success: true, error: null });
    });
  });
});
