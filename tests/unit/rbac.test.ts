import { describe, it, expect } from 'vitest';
import { requireAuth, requireRoles, ALL_AUTHENTICATED_ROLES } from '../../src/graphql/rbac.js';

const mockPrisma = {} as import('@prisma/client').PrismaClient;
const mockRequest = {} as Request;

describe('rbac', () => {
  describe('requireAuth', () => {
    it('throws when userId is null', () => {
      const context = {
        userId: null,
        role: null,
        prisma: mockPrisma,
        request: mockRequest,
      };
      expect(() => requireAuth(context)).toThrow('Not authenticated');
    });

    it('does not throw when userId is set', () => {
      const context = {
        userId: 'user-1',
        role: 'user',
        prisma: mockPrisma,
        request: mockRequest,
      };
      expect(() => requireAuth(context)).not.toThrow();
    });
  });

  describe('requireRoles', () => {
    it('throws when userId is null', () => {
      const context = {
        userId: null,
        role: null,
        prisma: mockPrisma,
        request: mockRequest,
      };
      expect(() => requireRoles(context, [...ALL_AUTHENTICATED_ROLES])).toThrow(
        'Not authenticated'
      );
    });

    it('throws when role is not in allowlist', () => {
      const context = {
        userId: 'user-1',
        role: 'unknown_role',
        prisma: mockPrisma,
        request: mockRequest,
      };
      expect(() => requireRoles(context, ['user', 'admin'])).toThrow(
        'Forbidden'
      );
    });

    it('does not throw when role is in allowlist', () => {
      const context = {
        userId: 'user-1',
        role: 'user',
        prisma: mockPrisma,
        request: mockRequest,
      };
      expect(() =>
        requireRoles(context, ['user', 'admin', 'superadmin'])
      ).not.toThrow();
    });

    it('allows all authenticated roles constant', () => {
      const context = {
        userId: 'user-1',
        role: 'astrologer',
        prisma: mockPrisma,
        request: mockRequest,
      };
      expect(() =>
        requireRoles(context, [...ALL_AUTHENTICATED_ROLES])
      ).not.toThrow();
    });
  });
});
