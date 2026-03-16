import { describe, it, expect, vi } from 'vitest';
import * as adminService from '../../src/services/adminService.js';
import type { PrismaClient } from '@prisma/client';

vi.mock('../../src/lib/hash.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

function createMockPrisma(overrides: {
  findMany?: (args: unknown) => Promise<unknown[]>;
  findUnique?: (args: unknown) => Promise<unknown>;
  update?: (args: unknown) => Promise<unknown>;
} = {}) {
  return {
    auth: {
      findMany: vi.fn().mockImplementation(overrides.findMany ?? (() => Promise.resolve([]))),
      findUnique: vi.fn().mockImplementation(overrides.findUnique ?? (() => Promise.resolve(null))),
      update: vi.fn().mockImplementation(overrides.update ?? (() => Promise.resolve({}))),
    },
    chat: { findMany: vi.fn().mockResolvedValue([]) },
    kundli: { findFirst: vi.fn().mockResolvedValue(null) },
    message: { create: vi.fn() },
  } as unknown as PrismaClient;
}

describe('adminService', () => {
  describe('listUsers', () => {
    it('returns only astrology_student and astrologer users', async () => {
      const users = [
        {
          id: 'u1',
          username: 'student1',
          email: 's@x.com',
          role: 'astrology_student',
          is_active: true,
          kundli_added: false,
          created_at: new Date(),
        },
        {
          id: 'u2',
          username: 'astro1',
          email: 'a@x.com',
          role: 'astrologer',
          is_active: true,
          kundli_added: true,
          created_at: new Date(),
        },
      ];
      const prisma = createMockPrisma({
        findMany: async () => users,
      });
      const result = await adminService.listUsers(prisma, null, null);
      expect(result).toHaveLength(2);
      expect(prisma.auth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { in: ['astrology_student', 'astrologer'] } },
        })
      );
    });

    it('filters by role when role is astrology_student', async () => {
      const prisma = createMockPrisma({ findMany: async () => [] });
      await adminService.listUsers(prisma, 'astrology_student', null);
      expect(prisma.auth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { in: ['astrology_student'] } },
        })
      );
    });

    it('filters by role when role is astrologer', async () => {
      const prisma = createMockPrisma({ findMany: async () => [] });
      await adminService.listUsers(prisma, 'astrologer', null);
      expect(prisma.auth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { in: ['astrologer'] } },
        })
      );
    });

    it('adds OR search on username and email when search is provided', async () => {
      const prisma = createMockPrisma({ findMany: async () => [] });
      await adminService.listUsers(prisma, null, 'john');
      expect(prisma.auth.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { username: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });
  });

  describe('getUserById', () => {
    it('returns user when role is astrology_student', async () => {
      const user = {
        id: 'u1',
        username: 'u',
        email: 'u@x.com',
        role: 'astrology_student',
        date_of_birth: '1990-01-01',
        place_of_birth: null,
        time_of_birth: null,
        gender: null,
        is_active: true,
        kundli_added: false,
        created_at: new Date(),
      };
      const prisma = createMockPrisma({
        findUnique: async () => user,
      });
      const result = await adminService.getUserById(prisma, 'u1');
      expect(result).toEqual(user);
    });

    it('returns user when role is astrologer', async () => {
      const user = {
        id: 'u2',
        username: 'a',
        email: 'a@x.com',
        role: 'astrologer',
        date_of_birth: '',
        place_of_birth: null,
        time_of_birth: null,
        gender: null,
        is_active: true,
        kundli_added: true,
        created_at: new Date(),
      };
      const prisma = createMockPrisma({
        findUnique: async () => user,
      });
      const result = await adminService.getUserById(prisma, 'u2');
      expect(result).toEqual(user);
    });

    it('returns null when user is admin', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({
          id: 'admin1',
          role: 'admin',
          username: 'admin',
          email: 'admin@x.com',
          date_of_birth: '',
          place_of_birth: null,
          time_of_birth: null,
          gender: null,
          is_active: true,
          kundli_added: false,
          created_at: new Date(),
        }),
      });
      const result = await adminService.getUserById(prisma, 'admin1');
      expect(result).toBeNull();
    });

    it('returns null when user is superadmin', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({
          id: 'sa1',
          role: 'superadmin',
          username: 'sa',
          email: 'sa@x.com',
          date_of_birth: '',
          place_of_birth: null,
          time_of_birth: null,
          gender: null,
          is_active: true,
          kundli_added: false,
          created_at: new Date(),
        }),
      });
      const result = await adminService.getUserById(prisma, 'sa1');
      expect(result).toBeNull();
    });

    it('returns null when user not found', async () => {
      const prisma = createMockPrisma({ findUnique: async () => null });
      const result = await adminService.getUserById(prisma, 'none');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates when target is astrology_student', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'astrology_student' }),
        update: async () => ({}),
      });
      const result = await adminService.updateUser(prisma, 'u1', {
        username: 'newuser',
        is_active: false,
      });
      expect(result).toEqual({ success: true });
      expect(prisma.auth.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ username: 'newuser', is_active: false }),
        })
      );
    });

    it('rejects when target is admin', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'admin' }),
      });
      const result = await adminService.updateUser(prisma, 'admin1', { username: 'x' });
      expect(result).toEqual({ success: false, error: 'User not found or cannot be updated' });
      expect(prisma.auth.update).not.toHaveBeenCalled();
    });

    it('rejects when target is superadmin', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'superadmin' }),
      });
      const result = await adminService.updateUser(prisma, 'sa1', { username: 'x' });
      expect(result).toEqual({ success: false, error: 'User not found or cannot be updated' });
      expect(prisma.auth.update).not.toHaveBeenCalled();
    });

    it('rejects when user not found', async () => {
      const prisma = createMockPrisma({ findUnique: async () => null });
      const result = await adminService.updateUser(prisma, 'none', { username: 'x' });
      expect(result).toEqual({ success: false, error: 'User not found or cannot be updated' });
    });
  });

  describe('resetPassword', () => {
    it('resets when target is astrologer', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'astrologer' }),
        update: async () => ({}),
      });
      const result = await adminService.resetPassword(prisma, 'u1', 'newpass123');
      expect(result).toEqual({ success: true });
      expect(prisma.auth.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { password: 'hashed' },
        })
      );
    });

    it('rejects when password too short', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'astrology_student' }),
      });
      const result = await adminService.resetPassword(prisma, 'u1', 'short');
      expect(result).toEqual({ success: false, error: 'Password must be at least 6 characters' });
      expect(prisma.auth.update).not.toHaveBeenCalled();
    });

    it('rejects when target is admin', async () => {
      const prisma = createMockPrisma({
        findUnique: async () => ({ role: 'admin' }),
      });
      const result = await adminService.resetPassword(prisma, 'admin1', 'validpass');
      expect(result).toEqual({ success: false, error: 'User not found or cannot be updated' });
      expect(prisma.auth.update).not.toHaveBeenCalled();
    });

    it('rejects when user not found', async () => {
      const prisma = createMockPrisma({ findUnique: async () => null });
      const result = await adminService.resetPassword(prisma, 'none', 'validpass');
      expect(result).toEqual({ success: false, error: 'User not found or cannot be updated' });
    });
  });
});
