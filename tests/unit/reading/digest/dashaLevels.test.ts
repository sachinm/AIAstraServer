import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { activationFor, buildActivationRows, buildDeepActivationRows, grahaHouses } from '../../../../src/reading/digest/activation.js';
import { buildDigest, buildDigestRows } from '../../../../src/reading/digest/build.js';
import type { PlanetCard } from '../../../../src/reading/digest/types.js';
import { deepen } from './deepFixture.js';
import { fakeDigestPrisma, fixtureDataRows, loadFixture } from './helpers.js';

const fx = loadFixture();
const rows = buildDigestRows(fx.items, { kundliId: 'k1' });
const l3 = fx.items['dasha.vimsottari.l3'] as { periods: unknown[] };
const deep6 = deepen(l3, 6);
const WINDOW = { from: '2026-08-08', to: '2027-11-06' };

describe('dasha levels 1–6 (doc 67)', () => {
  it('parses a depth-6 tree: levels 4..6 only, each overlapping the window, houses by the lifelong rule', () => {
    const out = buildDeepActivationRows([{ system: 'vimsottari', payload: deep6 }], fx.items, rows, { ...WINDOW, maxLevel: 6 });
    expect(new Set(out.map((r) => r.level))).toEqual(new Set([4, 5, 6]));
    expect(out.every((r) => r.from < WINDOW.to && r.to > WINDOW.from)).toBe(true);
    const sa = out.find((r) => r.level === 4 && r.lord === 'Sa')!;
    const card = rows.find((r) => r.section === 'planet' && r.key === 'D1.Sa')!.row as PlanetCard;
    expect(sa.houses).toEqual(grahaHouses(card));
    expect(sa.family).toBe('vimshottari');
    expect(out.filter((r) => r.level === 5).every((r) => ['Sa', 'Me', 'Ke'].includes(r.parentLord!))).toBe(true);
    // the fixture has deep nodes from 2025-06 to 2028-06; none outside the window is written
    const all = buildDeepActivationRows([{ system: 'vimsottari', payload: deep6 }], fx.items, rows, { from: '2025-06-01', to: '2028-06-01', maxLevel: 6 });
    expect(all.length).toBeGreaterThan(out.length);
  });

  it('stores level 4 only when the worker asks for 4 (DASHA_DEEP_MAX_LEVEL default)', () => {
    const out = buildDeepActivationRows([{ system: 'vimsottari', payload: deep6 }], fx.items, rows, { ...WINDOW, maxLevel: 4 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.level === 4)).toBe(true);
  });

  it('the lifelong calendar never takes a level above 3, even from a deep tree', () => {
    const items = { ...fx.items, 'dasha.vimsottari.l3': deep6 };
    const act = buildActivationRows(items, rows, { today: '2026-11-06' });
    expect(Math.max(...act.map((r) => r.level))).toBe(3);
    expect(act.length).toBe(buildActivationRows(fx.items, rows, { today: '2026-11-06' }).length);
  });

  it('an old engine (three levels) gives no deep rows and breaks nothing', () => {
    expect(buildDeepActivationRows([{ system: 'vimsottari', payload: l3 }], fx.items, rows, { ...WINDOW, maxLevel: 6 })).toEqual([]);
    expect(buildActivationRows(fx.items, rows, { today: '2026-11-06' }).some((r) => r.level === 3)).toBe(true);
  });

  it('activationFor reads levels 1–3 unless asked for more, and levels 4–6 through maxLevel / shortMaxLevel', async () => {
    const f = fakeDigestPrisma();
    const where = () => (f.prisma.kundliActivation.lastFindMany as { where: Record<string, unknown> }).where;
    await activationFor(f.prisma as never, 'k1', { from: '2026-11-09', to: '2026-11-10' });
    expect(where()).toMatchObject({ level: { lte: 3 } });
    await activationFor(f.prisma as never, 'k1', { from: '2026-11-09', to: '2026-11-10', maxLevel: 4 });
    expect(where()).toMatchObject({ level: { lte: 4 } });
    await activationFor(f.prisma as never, 'k1', { from: '2026-01-01', to: '2030-01-01', maxLevel: 2, shortFrom: '2026-11-09', shortTo: '2026-11-10', shortMaxLevel: 6 });
    expect(where().OR).toEqual([{ level: { lte: 2 } }, expect.objectContaining({ level: { lte: 6 } })]);
  });

  it('a digest rebuild replaces levels 1–3 and keeps the deep rows the worker wrote', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data: fixtureDataRows(fx), dossier: fx.items.facts });
    f.activation.push({ kundli_id: 'k1', system: 'vimsottari', level: 4, lord: 'Sa', from_date: new Date('2026-11-01T00:00:00Z'), to_date: new Date('2026-11-20T00:00:00Z') });
    const r = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(r.status).toBe('ready');
    expect(f.activation.filter((a) => a.level === 4)).toHaveLength(1);
    expect(f.activation.filter((a) => (a.level as number) <= 3).length).toBe(r.activation);
  });

  it('the Self board reads levels 1–3 only: every maxLevel / shortMaxLevel literal under src/reading/self is at most 3', () => {
    const root = path.resolve(__dirname, '../../../../src/reading/self');
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (n.endsWith('.ts')) files.push(p);
      }
    };
    walk(root);
    const found: Array<{ file: string; level: number }> = [];
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\b(?:maxLevel|shortMaxLevel)\s*:\s*(\d)/g)) found.push({ file: path.basename(f), level: Number(m[1]) });
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((x) => x.level > 3)).toEqual([]);
  });
});

describe('digest rebuild never strips a system whose tree failed or is mid-pull (2026-11-09 incident)', () => {
  const old = (system: string, level: number) => ({ kundli_id: 'k1', system, level, lord: 'Sa', from_date: new Date('1990-01-01T00:00:00Z'), to_date: new Date('1999-01-01T00:00:00Z') });

  it('a failed dasha tree keeps its activation rows; ready systems are replaced', async () => {
    const data = [...fixtureDataRows(fx), { data_type: 'dasha.narayana.l3', variant: '', status: 'failed', calc_version: null, payload: null }];
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data, dossier: fx.items.facts });
    f.activation.push(old('narayana', 1), old('narayana', 2), old('narayana', 3), old('yogini', 1));
    const r = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(r.status).toBe('ready');
    expect(f.activation.filter((a) => a.system === 'narayana')).toHaveLength(3);
    // the old yogini row is gone, replaced by the rebuilt ones
    expect(f.activation.some((a) => a.system === 'yogini' && (a.from_date as Date).getTime() === Date.parse('1990-01-01T00:00:00Z'))).toBe(false);
    expect(f.activation.filter((a) => a.system === 'yogini').length).toBeGreaterThan(0);
  });

  it('a tree mid-pull (fetching) keeps its old rows and gets no duplicate rows from the stored payload', async () => {
    const data = [...fixtureDataRows(fx), { data_type: 'dasha.yogini', variant: '', status: 'fetching', calc_version: null, payload: null }];
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data, dossier: fx.items.facts });
    f.activation.push(old('yogini', 1), old('yogini', 2));
    const r = await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(r.status).toBe('ready');
    expect(f.activation.filter((a) => a.system === 'yogini')).toHaveLength(2);
    expect(f.activation.filter((a) => a.system === 'kalachakra').length).toBeGreaterThan(0);
  });

  it('a system with no stored tree at all (birth details changed) loses its rows', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }], data: fixtureDataRows(fx), dossier: fx.items.facts });
    f.activation.push(old('narayana', 1));
    await buildDigest(f.prisma as never, 'k1', { today: '2026-11-06' });
    expect(f.activation.filter((a) => a.system === 'narayana')).toHaveLength(0);
  });
});
