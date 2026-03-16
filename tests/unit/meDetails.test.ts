/**
 * meDetails resolver: returns user_id, is_active, kundli_added, and queue_status
 * so the frontend can dismiss the "Syncing your chart" modal when
 * auth.kundli_added is true and kundlis.queue_status is 'completed'.
 */
import { describe, it, expect, vi } from 'vitest';
import { resolvers } from '../../src/graphql/schema.js';
import type { GraphQLContext } from '../../src/graphql/context.js';
import type { PrismaClient } from '@prisma/client';

function createMockPrisma(overrides: {
  authFindUnique?: () => Promise<{ id: string; is_active: boolean | null; kundli_added: boolean | null } | null>;
  kundliFindFirst?: () => Promise<{ queue_status: string } | null>;
} = {}) {
  return {
    auth: {
      findUnique: vi.fn().mockImplementation(overrides.authFindUnique ?? (() => Promise.resolve(null))),
    },
    kundli: {
      findFirst: vi.fn().mockImplementation(overrides.kundliFindFirst ?? (() => Promise.resolve(null))),
    },
  } as unknown as PrismaClient;
}

function createContext(overrides: Partial<GraphQLContext>): GraphQLContext {
  return {
    userId: null,
    role: null,
    prisma: createMockPrisma(),
    request: {} as Request,
    ...overrides,
  };
}

describe('meDetails', () => {
  it('returns null when not authenticated', async () => {
    const context = createContext({ userId: null, role: 'user' });
    const result = await resolvers.Query!.meDetails!(null, {}, context);
    expect(result).toBeNull();
  });

  it('returns null when user not in DB', async () => {
    const prisma = createMockPrisma({ authFindUnique: async () => null });
    const context = createContext({ userId: 'missing-user', role: 'user', prisma });
    const result = await resolvers.Query!.meDetails!(null, {}, context);
    expect(result).toBeNull();
  });

  it('returns user_id, is_active, kundli_added, and queue_status from auth and latest Kundli', async () => {
    const prisma = createMockPrisma({
      authFindUnique: async () => ({
        id: 'f6213a07-91f4-4611-abec-00af97a4f2f5',
        is_active: true,
        kundli_added: true,
      }),
      kundliFindFirst: async () => ({ queue_status: 'completed' }),
    });
    const context = createContext({
      userId: 'f6213a07-91f4-4611-abec-00af97a4f2f5',
      role: 'user',
      prisma,
    });
    const result = await resolvers.Query!.meDetails!(null, {}, context);
    expect(result).toEqual({
      user_id: 'f6213a07-91f4-4611-abec-00af97a4f2f5',
      is_active: true,
      kundli_added: true,
      queue_status: 'completed',
    });
  });

  it('returns queue_status null when user has no Kundli row', async () => {
    const prisma = createMockPrisma({
      authFindUnique: async () => ({
        id: 'u1',
        is_active: true,
        kundli_added: false,
      }),
      kundliFindFirst: async () => null,
    });
    const context = createContext({ userId: 'u1', role: 'user', prisma });
    const result = await resolvers.Query!.meDetails!(null, {}, context);
    expect(result).toMatchObject({
      user_id: 'u1',
      kundli_added: false,
      queue_status: null,
    });
  });
});
