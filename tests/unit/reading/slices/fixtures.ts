/** Shared fixtures for the slice and clock-layer tests (doc 70 §4.1). Rows are made up; no engine, no database. */
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../src/reading/self/sub/pressure.js';
import type { YearFrameV3, YearSpan } from '../../../../src/reading/self/v3/types.js';
import type { SliceInventory } from '../../../../src/reading/slices/render.js';

export const ASOF = '2026-11-09';

export const row = (
  id: string,
  kind: PressureRowDetail['kind'],
  level: number | undefined,
  polarity: PressureRowDetail['polarity'],
  from: string,
  to: string,
  matters: string[],
  extra: Partial<PressureRowDetail> = {},
): PressureRowDetail =>
  ({ id, kind, ...(level ? { level } : {}), planet: 'Sa', housesTouched: [10], matters, polarity, strength: 2, from, to, evidence: [id], houseFromMoon: null, ...extra }) as PressureRowDetail;

/** the rows every pull carries whatever the clock (transits, Saturn's passage, the year) */
export const shared = (): PressureRowDetail[] => [
  row('transit:Ju/h11@2026-10-01', 'transit', undefined, 'supports', '2026-10-01', '2027-04-01', ['gains_and_network'], { houseFromMoon: 11 }),
  row('sade_sati:peak@2025-03-29', 'sade_sati', undefined, 'presses', '2025-03-29', '2028-02-23', ['self_and_body'], { houseFromMoon: 1 }),
  row('annual:TP2026', 'annual', 1, 'mixed', '2026-09-20', '2027-09-09', ['home_and_peace']),
  row('annual:TP2026/2/Sa', 'annual', 2, 'presses', '2026-09-20', '2027-02-01', ['career_and_standing']),
];

export const inventory = (clock: string, rows: PressureRowDetail[], calcVersion = '2'): PressureInventoryDetail => ({
  kundliId: 'k1',
  clock,
  asOf: ASOF,
  from: '2023-11-09',
  to: '2029-11-09',
  rows,
  boundaries: [],
  calcVersion,
});

export function inventories(): SliceInventory[] {
  return [
    {
      system: 'vimsottari',
      inventory: inventory('vimsottari', [
        row('dasha:vimsottari/1/Ra@2020-01-01', 'dasha', 1, 'mixed', '2020-01-01', '2030-01-01', ['self_and_body']),
        row('dasha:vimsottari/2/Sa@2026-06-01', 'dasha', 2, 'presses', '2026-06-01', '2027-03-01', ['career_and_standing']),
        row('dasha:vimsottari/2/Me@2027-03-01', 'dasha', 2, 'supports', '2027-03-01', '2028-06-01', ['career_and_standing']),
        // outside the slice window (more than a year back): never listed
        row('dasha:vimsottari/2/Ju@2019-01-01', 'dasha', 2, 'supports', '2019-01-01', '2020-01-01', ['luck_and_belief']),
        ...shared(),
      ]),
    },
    {
      system: 'narayana',
      inventory: inventory('narayana', [
        row('dasha:narayana/1/Le@2025-01-01', 'dasha', 1, 'presses', '2025-01-01', '2027-02-01', ['career_and_standing']),
        row('dasha:narayana/1/Vi@2027-02-01', 'dasha', 1, 'supports', '2027-02-01', '2028-02-01', ['career_and_standing']),
        ...shared(),
      ]),
    },
    {
      system: 'yogini',
      inventory: inventory('yogini', [
        row('dasha:yogini/1/Ma@2026-01-01', 'dasha', 1, 'presses', '2026-01-01', '2027-05-01', ['career_and_standing']),
        row('dasha:yogini/1/Sa@2027-05-01', 'dasha', 1, 'presses', '2027-05-01', '2028-01-01', ['career_and_standing']),
        ...shared(),
      ]),
    },
  ];
}

const span = (id: string, from: string, to: string, place: YearSpan['place']): YearSpan => ({
  id,
  from,
  to,
  place,
  tone: 'heavy',
  clocks: [],
  agree: 1,
  of: 1,
  opensWith: 'pressure:x',
  rows: [],
});

export function frame(): YearFrameV3 {
  return {
    asOf: ASOF,
    to: '2027-11-09',
    clock: 'vimsottari',
    spans: [span('s1', '2026-11-09', '2027-01-01', 'now'), span('s2', '2027-01-01', '2027-06-03', 'next'), span('s3', '2027-06-03', '2027-11-09', 'later')],
    saturn: [],
    clocksRead: [],
    clocksSkipped: [],
    degraded: false,
  };
}

/** a minimal natal pack pair and promise ledger (the v2 renderer is reused as it is) */
export function natal() {
  const pack = (id: string, prefix: string, keys: string[]) => ({ id, natal: true, horizonKey: 'natal', prefix, dynamic: '', keys, packHash: id });
  return {
    packs: {
      'family.rasi': pack('family.rasi', '## D1\n{house:D1.h10} lord Sa in 10', ['house:D1.h10']),
      'family.varga': pack('family.varga', '## D9\n{house:D9.h10} lord Ve', ['house:D9.h10']),
      'family.dasha': pack('family.dasha', '', []),
      'family.year': pack('family.year', '', []),
      'family.sky': pack('family.sky', '', []),
    } as never,
    ledger: {
      entries: [
        { id: 'promise:career.gift', matter: 'career_and_standing', kind: 'gift', source: { house: 10, planet: 'Sa' }, who: [], strength: 3, evidence: ['house:D1.h10'] },
        { id: 'promise:home.knot', matter: 'home_and_peace', kind: 'knot', source: { house: 4 }, who: [], strength: 2, evidence: ['house:D1.h10'] },
      ],
    } as never,
    digestVersion: 'dv1',
  };
}
