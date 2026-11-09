import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { confirmedFacts, FACT_CATALOG } from '../../../src/profile/facts.js';

const at = new Date('2026-11-09T08:00:00Z');
const prisma = (rows: Array<{ key: string; value: string; confirmed_at: Date | null }>) =>
  ({ personFact: { findMany: async () => rows.map((r) => ({ ...r, user_id: 'u1', source: 'tapped' })) } }) as unknown as PrismaClient;

describe('confirmedFacts (doc 66 §4.2): the mood tap is not a reading fact', () => {
  it('drops self.mood although it is a FACT_CATALOG key, keeps the life facts', async () => {
    expect(FACT_CATALOG['self.mood']).toBeTruthy();
    const out = await confirmedFacts(
      prisma([
        { key: 'self.mood', value: 'heavy:2026-11-09', confirmed_at: at },
        { key: 'work.status', value: 'employed', confirmed_at: at },
        { key: 'love.status', value: 'single', confirmed_at: null },
      ]),
      'u1',
    );
    expect(out).toEqual({ 'work.status': 'employed' });
    expect(out).not.toHaveProperty('self.mood');
  });
});
