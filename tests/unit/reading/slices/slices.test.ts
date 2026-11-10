import { describe, expect, it } from 'vitest';
import {
  matterKeys,
  parseRowLines,
  readSlices,
  renderClock,
  renderSliceSet,
  renderSkyWindow,
  writeSlices,
  type RenderedSlice,
} from '../../../../src/reading/slices/index.js';
import { ASOF, frame, inventories, natal, row } from './fixtures.js';

const count = (text: string, needle: string) => text.split(needle).length - 1;
const byId = (list: RenderedSlice[]) => Object.fromEntries(list.map((s) => [s.id, s]));

describe('slice rendering is byte-stable (doc 70 §4.1 Layer 1)', () => {
  it('the same rows give the same text and hash, whatever order the inventories come in', () => {
    const a = renderSliceSet({ frame: frame(), inventories: inventories(), natal: natal() });
    const b = renderSliceSet({ frame: frame(), inventories: [...inventories()].reverse(), natal: natal() });
    expect(b.map((s) => s.id)).toEqual(a.map((s) => s.id));
    expect(b.map((s) => s.text)).toEqual(a.map((s) => s.text));
    expect(b.map((s) => s.hash)).toEqual(a.map((s) => s.hash));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('rows passed in a different order give the same bytes', () => {
    const shuffled = inventories().map((x) => ({ ...x, inventory: { ...x.inventory, rows: [...x.inventory.rows].reverse() } }));
    expect(JSON.stringify(renderSliceSet({ frame: frame(), inventories: shuffled }))).toBe(JSON.stringify(renderSliceSet({ frame: frame(), inventories: inventories() })));
  });

  it('carries no build time and changes its hash when a row changes', () => {
    const a = byId(renderSliceSet({ frame: frame(), inventories: inventories() }));
    expect(Object.values(a).map((s) => s.text).join('\n')).not.toMatch(/T\d{2}:\d{2}/);
    const changed = inventories();
    changed[0]!.inventory.rows[1] = { ...changed[0]!.inventory.rows[1]!, polarity: 'supports' };
    const b = byId(renderSliceSet({ frame: frame(), inventories: changed }));
    expect(b['clock.vimsottari']!.hash).not.toBe(a['clock.vimsottari']!.hash);
    expect(b['sky.window']!.hash).toBe(a['sky.window']!.hash);
    expect(b['frame']!.hash).toBe(a['frame']!.hash);
  });

  it('lists the slice set in a fixed order: shared slices, the clocks, the year, the matters', () => {
    const ids = renderSliceSet({ frame: frame(), inventories: inventories(), natal: natal() }).map((s) => s.id);
    expect(ids).toEqual([
      'natal.core',
      'sky.window',
      'year.tp',
      'frame',
      'clock.narayana',
      'clock.vimsottari',
      'clock.yogini',
      'clock.tithi_pravesha',
      'matter.career_and_standing',
      'matter.gains_and_network',
      'matter.home_and_peace',
      'matter.self_and_body',
    ]);
  });
});

describe('shared rows are stored once', () => {
  const s = byId(renderSliceSet({ frame: frame(), inventories: inventories(), natal: natal() }));

  it('sky.window and year.tp hold each clock-independent row once, though every inventory carries it', () => {
    expect(count(s['sky.window']!.text, '{pressure:transit:Ju/h11@2026-10-01}')).toBe(1);
    expect(count(s['sky.window']!.text, '{pressure:sade_sati:peak@2025-03-29}')).toBe(1);
    expect(count(s['year.tp']!.text, '{pressure:annual:TP2026}')).toBe(1);
    expect(count(s['year.tp']!.text, '{pressure:annual:TP2026/2/Sa}')).toBe(1);
    // one source per inventory it was read from
    expect(s['sky.window']!.sources.map((x) => x.variant)).toEqual(['system=narayana', 'system=vimsottari', 'system=yogini']);
  });

  it('no period row is in a shared slice; each clock slice holds only its own periods', () => {
    for (const id of ['sky.window', 'year.tp', 'frame']) expect(s[id]!.text, id).not.toContain('{pressure:dasha:');
    expect(s['clock.vimsottari']!.text).toContain('{pressure:dasha:vimsottari/2/Sa@2026-06-01}');
    expect(s['clock.vimsottari']!.text).not.toContain('narayana');
    expect(s['clock.vimsottari']!.text).not.toContain('yogini');
    expect(s['clock.narayana']!.keys.every((k) => k.startsWith('pressure:dasha:narayana/'))).toBe(true);
  });

  it('a clock slice keeps a year back to eighteen months ahead, and indexes its rows by span and house', () => {
    const v = s['clock.vimsottari']!.text;
    expect(v).not.toContain('2019-01-01');
    expect(v).toMatch(/^s1 2026-11-09\.\.2027-01-01: .*\{pressure:dasha:vimsottari\/2\/Sa@2026-06-01\}/m);
    expect(v).toMatch(/^h10: /m);
  });

  it('the year is read as its own clock from the year rows', () => {
    const tp = s['clock.tithi_pravesha']!;
    expect(tp.keys).toEqual(['pressure:annual:TP2026', 'pressure:annual:TP2026/2/Sa']);
  });

  it('matter slices take their keys from the rows and join every clock that touches them', () => {
    expect(matterKeys(inventories(), ASOF)).toEqual(['career_and_standing', 'gains_and_network', 'home_and_peace', 'self_and_body']);
    const career = s['matter.career_and_standing']!.text;
    for (const c of ['vimsottari', 'narayana', 'yogini', 'tithi_pravesha']) expect(career).toContain(`## clock ${c}`);
    expect(career).toContain('{promise:career.gift}');
    expect(career).not.toContain('home.knot');
  });

  it('natal.core is the v2 natal packs and promise ledger', () => {
    expect(s['natal.core']!.text).toContain('{house:D1.h10}');
    expect(s['natal.core']!.text).toContain('PROMISE LEDGER');
    expect(s['natal.core']!.sources[0]).toMatchObject({ dataType: 'kundli_digest', variant: 'dv1' });
  });
});

describe('parseRowLines', () => {
  it('reads back what the renderer wrote', () => {
    const sky = renderSkyWindow(inventories(), ASOF);
    const rows = parseRowLines(sky.text);
    expect([...rows.keys()].sort()).toEqual(['pressure:sade_sati:peak@2025-03-29', 'pressure:transit:Ju/h11@2026-10-01']);
    expect(rows.get('pressure:transit:Ju/h11@2026-10-01')).toEqual({ key: 'pressure:transit:Ju/h11@2026-10-01', from: '2026-10-01', to: '2027-04-01', polarity: 'supports', strength: 2, matters: ['gains_and_network'] });
  });

  it('a clock with no stored rows renders an empty clock slice, not an error', () => {
    const empty = renderClock('chara', null, frame());
    expect(empty.text).toContain('(none stored)');
    expect(renderClock('chara', null, frame()).hash).toBe(empty.hash);
    expect(row).toBeTypeOf('function');
  });
});

describe('slice store', () => {
  function fakeDb() {
    const rows = new Map<string, Record<string, unknown>>();
    let upserts = 0;
    const prisma = {
      kundliSlice: {
        findMany: async (q: { where: { kundli_id: string; slice_id?: { in: string[] } } }) =>
          [...rows.values()].filter((r) => r.kundli_id === q.where.kundli_id && (!q.where.slice_id || q.where.slice_id.in.includes(r.slice_id as string))),
        upsert: async (q: { where: { kundli_slice_key: { kundli_id: string; slice_id: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          upserts += 1;
          const k = `${q.where.kundli_slice_key.kundli_id}|${q.where.kundli_slice_key.slice_id}`;
          rows.set(k, rows.has(k) ? { ...rows.get(k)!, ...q.update } : { ...q.create });
          return rows.get(k);
        },
      },
    };
    return { prisma: prisma as never, rows, upserts: () => upserts };
  }

  it('writes every slice once, skips unchanged ones, and reads them back', async () => {
    const db = fakeDb();
    const set = renderSliceSet({ frame: frame(), inventories: inventories() });
    const first = await writeSlices(db.prisma, 'k1', set, new Date('2026-11-10T00:00:00Z'));
    expect(first.written).toEqual(set.map((s) => s.id));
    expect(first.failed).toEqual([]);
    const again = await writeSlices(db.prisma, 'k1', set);
    expect(again.written).toEqual([]);
    expect(again.unchanged).toHaveLength(set.length);
    expect(db.upserts()).toBe(set.length);
    const read = await readSlices(db.prisma, 'k1', ['frame', 'clock.yogini']);
    expect(Object.keys(read).sort()).toEqual(['clock.yogini', 'frame']);
    expect(read['frame']).toMatchObject({ text: set.find((s) => s.id === 'frame')!.text, hash: set.find((s) => s.id === 'frame')!.hash, builtAt: '2026-11-10T00:00:00.000Z' });
  });

  it('never throws without a store', async () => {
    const set = renderSliceSet({ frame: frame(), inventories: inventories() });
    const r = await writeSlices({} as never, 'k1', set);
    expect(r.failed).toHaveLength(set.length);
    expect(await readSlices({} as never, 'k1')).toEqual({});
  });
});
