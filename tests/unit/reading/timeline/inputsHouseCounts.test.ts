import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { loadG1Dossier, loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const ensureChartData = vi.fn();
vi.mock('../../../../src/reading/chartData/store.js', () => ({ ensureChartData, prismaChartDataRepo: () => ({}) }));
vi.mock('../../../../src/reading/data/store.js', () => ({ FACTS_VERSION: 1 }));
vi.mock('../../../../src/reading/chartData/transitContacts.js', async (orig) => ({
  ...(await orig<object>()),
  fetchTransitContacts: vi.fn().mockResolvedValue({ from: '2008-10-01', to: '2018-08-10', orb: 2, planets: [], contacts: [] }),
}));

const { kundliInputs, TIMELINE_ITEM_IDS } = await import('../../../../src/reading/timeline/inputs.js');

const prisma = { kundliFacts: { findUnique: vi.fn().mockResolvedValue({ dossier: loadG1Dossier() }) } } as unknown as PrismaClient;

describe('kundliInputs and the house_counts item', () => {
  beforeEach(() => ensureChartData.mockReset());

  it('asks for it with the dashas and carries the table through', async () => {
    const table = loadG1TimelineInputs().houseCounts;
    ensureChartData.mockResolvedValue({ house_counts: { status: 'ready', payload: table } });
    const got = await kundliInputs(prisma, 'k1', '2026-10-24');
    expect(TIMELINE_ITEM_IDS).toContain('house_counts');
    expect(ensureChartData.mock.calls[0]![2]).toContain('house_counts');
    expect(got!.houseCounts).toEqual(table);
    expect(got!.notes.some((n) => n.includes('house_counts'))).toBe(false);
  });

  it('a table Radha has not served is a note, not an error, and there is no fallback', async () => {
    ensureChartData.mockResolvedValue({ house_counts: { status: 'unsupported', error: 'Radha does not serve this type yet' } });
    const got = await kundliInputs(prisma, 'k1', '2026-10-24');
    expect(got!.houseCounts).toBeNull();
    expect(got!.notes.some((n) => n.startsWith('house_counts: unsupported'))).toBe(true);
    expect(got!.notes.some((n) => n.startsWith('house_counts not available'))).toBe(true);
  });
});
