/**
 * docs/reading-engine/75 §4.1: PUT /api/self/v3/layout takes a patch on a version. A stale version is refused with the
 * layout now stored, so quick changes never write an older copy over a newer one.
 */
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { emptyLayout, layoutFromRow, mergeLayoutPatch } from '../../../../../src/reading/self/v3/layout.js';
import { putSelfLayout } from '../../../../../src/reading/self/v3/service.js';

type Row = { template: string; cards: unknown; sections: unknown; options: unknown; board_options: unknown; updated_at: Date };

/** one board_layout row in memory, with the conditional update Postgres does */
function fakePrisma(start: Row | null = null) {
  let row: Row | null = start;
  let clock = Date.parse('2026-11-13T09:00:00.000Z');
  const tick = () => new Date((clock += 7));
  const prisma = {
    kundli: { findFirst: async () => ({ id: 'k1' }) },
    boardLayout: {
      findUnique: async () => row,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (row) throw Object.assign(new Error('unique'), { code: 'P2002' });
        row = { template: data.template as string, cards: data.cards, sections: data.sections, options: data.options ?? {}, board_options: data.board_options ?? {}, updated_at: tick() };
        return row;
      },
      updateMany: async ({ where, data }: { where: { updated_at: { gte: Date; lt: Date } }; data: Record<string, unknown> }) => {
        if (!row || row.updated_at < where.updated_at.gte || row.updated_at >= where.updated_at.lt) return { count: 0 };
        row = { ...row, ...(data as Partial<Row>), updated_at: tick() };
        return { count: 1 };
      },
      upsert: async () => {
        throw new Error('the versioned path never upserts');
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, row: () => row, bump: () => row && (row = { ...row, updated_at: tick() }) };
}

const deps = { cardsRead: false };

describe('mergeLayoutPatch', () => {
  const current = layoutFromRow({
    template: 'seasons',
    cards: ['body', 'mind', 'stuck'],
    sections: { body: ['line', 'year', 'stretch'] },
    options: { body: { face: 'research', length: 'deep' } },
    board_options: { face: 'research' },
    updated_at: new Date('2026-11-13T09:00:00Z'),
  });
  it('merges one card option key and leaves the rest', () => {
    const r = mergeLayoutPatch(current, { options: { body: { face: 'read' } } });
    expect(r.ok && r.body.options).toEqual({ body: { face: 'read', length: 'deep' } });
    expect(r.ok && r.body.cards).toEqual(['body', 'mind', 'stuck']);
  });
  it('a null key resets it; a null card resets the card; board keys merge', () => {
    const r = mergeLayoutPatch(current, { options: { body: null }, boardOptions: { face: null } });
    expect(r.ok && r.body.options).toEqual({});
    expect(r.ok && r.body.boardOptions).toEqual({});
  });
  it('options of a card taken off the board are dropped', () => {
    const r = mergeLayoutPatch(current, { cards: ['mind', 'stuck', 'lagna'] });
    expect(r.ok && r.body.options).toEqual({});
    expect(r.ok && r.body.sections).toEqual({});
  });
  it('refuses a patch that is not an object', () => {
    expect(mergeLayoutPatch(emptyLayout(), [])).toEqual({ ok: false, error: 'bad_body' });
    expect(mergeLayoutPatch(emptyLayout(), { options: { body: 'x' } })).toEqual({ ok: false, error: 'bad_body' });
  });
});

describe('PUT layout with a version', () => {
  it('first save creates the row and returns its version', async () => {
    const f = fakePrisma();
    const r = await putSelfLayout(f.prisma, 'u1', { version: '', patch: { template: 'seasons', cards: ['body', 'mind', 'stuck'] } }, deps);
    expect(r.ok).toBe(true);
    expect(r.ok && r.layout.version).toBe(f.row()!.updated_at.toISOString());
  });
  it('two patches on the same version: the second is refused with the layout now stored (no overwrite)', async () => {
    const f = fakePrisma();
    // a Research board: a card set to Read must stay Read (audit P0 item 2)
    const first = await putSelfLayout(f.prisma, 'u1', { version: '', patch: { cards: ['body', 'mind', 'stuck'], boardOptions: { face: 'research' } } }, deps);
    const v = first.ok ? first.layout.version : '';
    const a = await putSelfLayout(f.prisma, 'u1', { version: v, patch: { options: { body: { face: 'read' } } } }, deps);
    const b = await putSelfLayout(f.prisma, 'u1', { version: v, patch: { options: { mind: { face: 'light' } } } }, deps);
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: false, status: 409, error: 'stale_layout' });
    expect(!b.ok && 'layout' in b && b.layout.options).toEqual({ body: { face: 'read' } });
    // the page re-applies its change on the version it was given
    const again = await putSelfLayout(f.prisma, 'u1', { version: !b.ok && 'layout' in b ? b.layout.version : '', patch: { options: { mind: { face: 'light' } } } }, deps);
    expect(again.ok && again.layout.options).toEqual({ body: { face: 'read' }, mind: { face: 'light' } });
  });
  it('a write landing between the read and the update is caught by the conditional update', async () => {
    const f = fakePrisma({ template: 'seasons', cards: ['body', 'mind', 'stuck'], sections: {}, options: {}, board_options: {}, updated_at: new Date('2026-11-13T08:00:00.000Z') });
    const realFind = (f.prisma as unknown as { boardLayout: { findUnique: () => Promise<Row | null> } }).boardLayout.findUnique;
    let reads = 0;
    (f.prisma as unknown as { boardLayout: { findUnique: () => Promise<Row | null> } }).boardLayout.findUnique = async () => {
      const r = await realFind();
      if (reads++ === 0) f.bump();
      return r;
    };
    const r = await putSelfLayout(f.prisma, 'u1', { version: '2026-11-13T08:00:00.000Z', patch: { template: 'compact' } }, deps);
    expect(r).toMatchObject({ ok: false, status: 409, error: 'stale_layout' });
    expect(f.row()!.template).toBe('seasons');
  });
  it('a merged layout that does not validate is a 400', async () => {
    const f = fakePrisma({ template: 'seasons', cards: ['body', 'mind', 'stuck'], sections: {}, options: {}, board_options: {}, updated_at: new Date('2026-11-13T08:00:00.000Z') });
    const r = await putSelfLayout(f.prisma, 'u1', { version: '2026-11-13T08:00:00.000Z', patch: { cards: ['body'] } }, deps);
    expect(r).toMatchObject({ ok: false, status: 400, error: 'too_few_cards' });
  });
});
