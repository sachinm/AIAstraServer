import { describe, it, expect, vi } from 'vitest';
import {
  isJsonFieldFilled,
  enqueueKundliSync,
} from '../../src/services/kundliQueueService.js';
import type { PrismaClient } from '@prisma/client';

describe('kundliQueueService', () => {
  describe('isJsonFieldFilled', () => {
    it('returns false for null', () => {
      expect(isJsonFieldFilled(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isJsonFieldFilled(undefined)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isJsonFieldFilled({})).toBe(false);
    });

    it('returns true for non-empty object', () => {
      expect(isJsonFieldFilled({ a: 1 })).toBe(true);
    });

    it('returns true for string', () => {
      expect(isJsonFieldFilled('x')).toBe(true);
    });

    it('returns true for number', () => {
      expect(isJsonFieldFilled(0)).toBe(true);
    });

    it('returns true for array', () => {
      expect(isJsonFieldFilled([])).toBe(true);
    });
  });

  describe('enqueueKundliSync', () => {
    it('updates existing Kundli to pending', async () => {
      const update = vi.fn().mockResolvedValue({});
      const prisma = {
        kundli: {
          findFirst: vi.fn().mockResolvedValue({ id: 'k1', user_id: 'u1' }),
          update,
          create: vi.fn(),
        },
      } as unknown as PrismaClient;
      await enqueueKundliSync(prisma, 'u1');
      expect(prisma.kundli.findFirst).toHaveBeenCalledWith({
        where: { user_id: 'u1' },
        orderBy: { created_at: 'desc' },
      });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'k1' },
        data: { queue_status: 'pending' },
      });
      expect(prisma.kundli.create).not.toHaveBeenCalled();
    });

    it('creates new Kundli with pending when none exists', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'k2' });
      const prisma = {
        kundli: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
          create,
        },
      } as unknown as PrismaClient;
      await enqueueKundliSync(prisma, 'u2');
      expect(create).toHaveBeenCalledWith({
        data: {
          user_id: 'u2',
          queue_status: 'pending',
        },
      });
    });
  });
});
