import { describe, expect, it } from 'vitest';
import { sidebarColumns } from '../../src/services/kundliSidebar.js';

const biodata = { date: '1990-04-27', time: '10:30:00', place_name: 'Pune, IN', nakshatra: 'Hast', tithi: 'x', yoga: 'y' };
const d1 = [
  { body: 'Lagna', rasi: 'Vi', nakshatra: 'Hast', pada: '4' },
  { body: 'Sun', rasi: 'Ar', nakshatra: 'Asw', pada: '4' },
];
const data = { biodata, d1, d2: [1], d4: [1], d7: [1], d9: [1], d10: [1], vimsottari_dasa: [1], narayana_dasa: [1] };

describe('sidebarColumns', () => {
  it('sends only the birth details and the Lagna row without the research flag', () => {
    const out = sidebarColumns(false, data);
    expect(out.biodata).toEqual({ date: '1990-04-27', time: '10:30:00', place_name: 'Pune, IN', nakshatra: 'Hast' });
    expect(out.d1).toEqual([d1[0]]);
    for (const k of ['d2', 'd4', 'd7', 'd9', 'd10', 'vimsottari_dasa', 'narayana_dasa'] as const) expect(out[k]).toBeNull();
  });

  it('sends everything with the research flag', () => {
    expect(sidebarColumns(true, data)).toEqual(data);
  });

  it('copes with a chart that has no data yet', () => {
    expect(sidebarColumns(false, {})).toMatchObject({ biodata: null, d1: null, d9: null });
  });
});
