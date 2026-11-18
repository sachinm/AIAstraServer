/**
 * docs/reading-engine/85 §7 step 2: the card chat's trusted lookup. The stored card is re-read through its board's read
 * path with no side effect (no build, digest or card queued; Love/Work skip "build on open"), and the context carries
 * the data the card was prepared from (its Oracle card, ledger cells, cited rows, the shared prefix it was read on).
 * Fakes only: no database, no model.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const captured: { board: unknown[]; self: unknown[] } = vi.hoisted(() => ({ board: [], self: [] }));
vi.mock('../../../../src/reading/boards/v3Service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/reading/boards/v3Service.js')>();
  return { ...actual, getBoardV3: vi.fn(async (deps: unknown) => (captured.board.push(deps), { body: { status: 'no_kundli', cards: [], layout: { cards: [] } }, queued: [] })) };
});
vi.mock('../../../../src/reading/self/v3/service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/reading/self/v3/service.js')>();
  return { ...actual, getSelfV3: vi.fn(async (deps: unknown) => (captured.self.push(deps), { body: { status: 'no_kundli', cards: [], layout: { cards: [] } }, queued: null })) };
});

import { buildPreamble, pickPeriod, readOnlyBoard, readOnlySelf, resolveCard, resolveCardContext } from '../../../../src/reading/cardChat/resolve.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import { CARD_CHAT_PREAMBLE_MAX_CHARS } from '../../../../src/reading/cardChat/types.js';
import { body, CITED_ROW_KEY, content, KEY_DATES, PERIODS, prefix, resolveSeams, stored, view } from './fixtures.js';

const prisma = {} as never;
const ENV = ['BOARDS_V3'];
const saved: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
});
afterAll(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const selfBody = body([view('body', 'Body & energy'), view('mind', 'How you think')], ['body', 'mind']);
const loveBody = body([view('dating_pulse', 'Where Dating Stands'), view('dating_delays_blocks', 'Delays and blocks')], ['dating_pulse', 'dating_delays_blocks']);
const workBody = body([view('job_pulse', 'Where Your Job Stands')], ['job_pulse']);
const seams = (over = {}) => resolveSeams({ self: selfBody, love: loveBody, work: workBody }, over);

describe('the board reads have no side effect', () => {
  it('You: getSelfV3 with no-op queueBuild and queueDigest and no gate', async () => {
    captured.self.length = 0;
    await readOnlySelf()(prisma, 'u1');
    const deps = captured.self[0] as { queueBuild: () => Promise<string>; queueDigest: () => Promise<void>; gate?: unknown };
    expect(await deps.queueBuild()).toBe('skipped');
    expect(await deps.queueDigest()).toBeUndefined();
    expect(deps.gate).toBeUndefined();
  });
  it('Love/Work: getBoardV3 with readOnly (no "build on open") and every queue seam a no-op', async () => {
    captured.board.length = 0;
    await readOnlyBoard()(prisma, 'u1', 'love');
    const deps = captured.board[0] as { readOnly: boolean; queueBuild: () => Promise<string>; queueDigest: () => Promise<void>; queueCardsBuild: () => Promise<string> };
    expect(deps.readOnly).toBe(true);
    expect(await deps.queueBuild()).toBe('skipped');
    expect(await deps.queueCardsBuild()).toBe('skipped');
    expect(await deps.queueDigest()).toBeUndefined();
  });
});

describe('resolveCard: the stored card on its board, every board', () => {
  it('You: the card, its period and the preamble from the stored text', async () => {
    const r = await resolveCard({ prisma, ...seams() }, 'u1', { board: 'self', id: 'body', from: PERIODS[0]!.from, to: PERIODS[0]!.to });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.card).toMatchObject({ board: 'self', id: 'body', title: 'Body & energy', kundliId: 'k1', clock: 'vimsottari' });
    expect(r.card.period).toEqual({ from: '2026-10-01', to: '2027-01-01', label: PERIODS[0]!.label });
    expect(r.card.preamble).toEqual({ headline: 'Guard your evenings.', lines: PERIODS[0]!.text, keyDates: [{ date: '2027-01-01', label: 'Heavy stretch ends' }], confirm: content.confirm!.text });
    expect(r.card.boardCards).toEqual([{ id: 'mind', title: 'How you think' }]);
  });
  it('Love and Work resolve the same way', async () => {
    const love = await resolveCard({ prisma, ...seams() }, 'u1', { board: 'love', id: 'dating_pulse' });
    expect(love).toMatchObject({ ok: true, card: { board: 'love', id: 'dating_pulse', title: 'Where Dating Stands', period: null } });
    const work = await resolveCard({ prisma, ...seams() }, 'u1', { board: 'work', id: 'job_pulse' });
    expect(work).toMatchObject({ ok: true, card: { board: 'work', id: 'job_pulse', period: null } });
    if (work.ok) expect(work.card.preamble.headline).toBe(content.line);
  });
  it('the errors, before any model call', async () => {
    const d = { prisma, ...seams() };
    expect(await resolveCard(d, 'u1', { board: 'lucky' as never, id: 'x' })).toEqual({ ok: false, error: 'unknown_board' });
    expect(await resolveCard(d, 'u1', { board: 'self', id: 'dating_pulse' })).toEqual({ ok: false, error: 'unknown_card' });
    expect(await resolveCard({ ...d, boards: ['work'] }, 'u1', { board: 'love', id: 'dating_pulse' })).toEqual({ ok: false, error: 'board_off' });
    expect(await resolveCard(d, 'u2', { board: 'self', id: 'body' })).toEqual({ ok: false, error: 'no_kundli' });
    expect(await resolveCard(d, 'u1', { board: 'self', id: 'sleep' })).toEqual({ ok: false, error: 'card_not_on_board' });
    expect(await resolveCard(d, 'u1', { board: 'self', id: 'body', from: '2026-10-01' })).toEqual({ ok: false, error: 'bad_period' });
    expect(await resolveCard(d, 'u1', { board: 'self', id: 'body', from: '2030-01-01', to: '2030-02-01' })).toEqual({ ok: false, error: 'bad_period' });
    const off = { prisma, ...resolveSeams({ self: body([view('body', 'Body', { features: {} })], ['body']) }) };
    expect(await resolveCard(off, 'u1', { board: 'self', id: 'body' })).toEqual({ ok: false, error: 'feature_off' });
    const locked = { prisma, ...resolveSeams({ self: body([view('body', 'Body', { features: { 'feature.card_chat': { locked: true, minPlan: 'plus' } } })], ['body']) }) };
    expect(await resolveCard(locked, 'u1', { board: 'self', id: 'body' })).toEqual({ ok: false, error: 'locked' });
    const cardLocked = { prisma, ...resolveSeams({ self: body([view('body', 'Body', { locked: { minPlan: 'plus' } })], ['body']) }) };
    expect(await resolveCard(cardLocked, 'u1', { board: 'self', id: 'body' })).toEqual({ ok: false, error: 'locked' });
    const notOnBoard = { prisma, ...resolveSeams({ self: body([view('body', 'Body')], ['mind']) }) };
    expect(await resolveCard(notOnBoard, 'u1', { board: 'self', id: 'body' })).toEqual({ ok: false, error: 'card_not_on_board' });
    const unread = { prisma, ...resolveSeams({ self: body([view('body', 'Body', { v3: null })], ['body']) }) };
    expect(await resolveCard(unread, 'u1', { board: 'self', id: 'body' })).toEqual({ ok: false, error: 'card_not_ready' });
  });
});

describe('resolveCardContext: the data the card was prepared from', () => {
  it('reads the stored Oracle card, the ledger cells of the card matters, the rows it cites, the brief, the shared prefix', async () => {
    const r = await resolveCardContext({ prisma, ...seams() }, 'u1', { board: 'self', id: 'body' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.context;
    expect(c.oracle).toEqual(stored('body').oracle);
    expect(c.storeKey).toContain(`|pre=${prefix.hash}|`);
    // body reads self_and_body and work_load_and_health: only those cells (not partnership)
    expect(c.cells.length).toBeGreaterThan(0);
    expect(c.cells.every((x) => ['self_and_body', 'work_load_and_health'].includes(x.matter))).toBe(true);
    expect(c.ledgerMatchesCard).toBe(true);
    expect(c.prefix).toMatchObject({ text: prefix.text, hash: prefix.hash, matchesCard: true });
    if (!prefix.keys.includes(CITED_ROW_KEY)) expect(c.evidenceRows.some((l) => l.includes(`{${CITED_ROW_KEY}}`))).toBe(true);
    expect(c.evidenceRows.some((l) => l.includes('{pressure:other}'))).toBe(false);
    expect(c.brief).toBe(PROMPTS['cards/self/body']);
    expect(c.profile?.ageBand).toBe('36_45');
  });
  it('a prefix or ledger that moved on since the card was read is reported, not refused; missing rows are left out', async () => {
    const moved = await resolveCardContext({ prisma, ...seams({ readStored: async (_p: unknown, _k: string, _c: string, id: string) => ({ ...stored(id, 'other'), ledgerHash: 'old' }) }) }, 'u1', { board: 'love', id: 'dating_pulse' });
    expect(moved.ok && moved.context.prefix?.matchesCard).toBe(false);
    expect(moved.ok && moved.context.ledgerMatchesCard).toBe(false);
    const bare = await resolveCardContext({ prisma, ...seams({ readStored: async () => null, readSlices: async () => ({}) as never, loadProfile: async () => Promise.reject(new Error('x')) }) }, 'u1', { board: 'work', id: 'job_pulse' });
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    expect(bare.context).toMatchObject({ oracle: null, cells: [], prefix: null, evidenceRows: [], ledgerMatchesCard: null, profile: null });
    expect(bare.context.brief).toBe(PROMPTS['cards/work/job_pulse']);
  });
});

describe('period and preamble', () => {
  it('a named period, the period that holds the range, or none', () => {
    expect(pickPeriod(PERIODS, null, null)).toEqual({ ok: true, period: null });
    expect(pickPeriod(PERIODS, '2027-02-01', '2027-03-01')).toEqual({ ok: true, period: { from: '2027-01-01', to: '2028-01-10', label: PERIODS[1]!.label } });
    expect(pickPeriod(PERIODS, '2027-03-01', '2027-02-01')).toEqual({ ok: false });
    expect(pickPeriod(PERIODS, 'soon', '2027-02-01')).toEqual({ ok: false });
  });
  it('the whole card lists the periods; the preamble is capped', () => {
    const p = buildPreamble({ content, v2: null, periods: PERIODS, keyDates: KEY_DATES.map((k) => ({ date: k.date, label: k.label })) }, null);
    expect(p.headline).toBe(content.line);
    expect(p.lines).toEqual(PERIODS.map((x) => `${x.label}: ${x.headline}`));
    const long = buildPreamble({ content, v2: null, periods: PERIODS.map((x) => ({ ...x, text: Array.from({ length: 40 }, () => 'x'.repeat(100)) })), keyDates: [] }, { from: PERIODS[0]!.from, to: PERIODS[0]!.to, label: 'l' });
    expect(long.headline.length + long.lines.join('').length + (long.confirm?.length ?? 0)).toBeLessThanOrEqual(CARD_CHAT_PREAMBLE_MAX_CHARS);
  });
});
