import { afterEach, describe, expect, it } from 'vitest';
import { buildCalendar, calendarBlock, CALENDAR_HONESTY_NOTE, renderCalendar, type CalendarEvent } from '../../../src/reading/calendar/calendar.js';
import { readingCalendar } from '../../../src/reading/config.js';
import { horizonRange } from '../../../src/reading/packs/frames.js';
import { buildEvidencePack, mergeSubjectPacks, resolveEvidence, type EvidencePack } from '../../../src/reading/packs/selector.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const mk = (subject: any, horizon: any = '1y') =>
  buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent: { horizon, mentionsPlanets: [], focusPoints: [] } });

describe('buildCalendar on G1', () => {
  const pack = mk('career_work', '1y');
  const cal = buildCalendar(pack, { horizon: '1y' }, G1_AS_OF, { lunations: transits.lunations });
  const hz = horizonRange('1y', G1_AS_OF);

  it('lists only dates inside the horizon, sorted', () => {
    expect(cal.events.length).toBeGreaterThan(0);
    for (const e of cal.events) {
      expect(e.date >= hz.from && e.date <= hz.to).toBe(true);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const dates = cal.events.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('every pack event resolves to a pack field holding that date', () => {
    for (const e of cal.events.filter((x) => !x.evidence.startsWith('snapshot.'))) {
      const v = resolveEvidence(pack, e.evidence);
      expect(v, e.evidence).toBeDefined();
      if (typeof v === 'string') expect(v).toBe(e.date);
      else if (e.kind === 'ingress') expect(e.evidence.endsWith(e.date)).toBe(true);
      else expect(JSON.stringify(v)).toContain(e.date);
    }
  });

  it('has dasha boundaries matching the running dasha and periods', () => {
    const cur = dossier.dasha.vimshottari.current;
    expect(cal.events.some((e) => e.kind.startsWith('dasha') && e.date === cur.pd_end)).toBe(true);
    if (cur.ad_end && cur.ad_end <= hz.to) expect(cal.events.some((e) => e.kind === 'dasha_ad' && e.date === cur.ad_end)).toBe(true);
    // one boundary per date: an end is not repeated where the next period starts
    const dashaDates = cal.events.filter((e) => e.kind.startsWith('dasha')).map((e) => e.date);
    expect(new Set(dashaDates).size).toBe(dashaDates.length);
  });

  it('has ingresses from transit rows (true entry dates, not the horizon clip) and stations from the pack', () => {
    const ingress = cal.events.filter((e) => e.kind === 'ingress');
    expect(ingress.length).toBeGreaterThan(0);
    for (const e of ingress) expect(e.date > hz.from).toBe(true);
    const sec = pack.sections.transits as any;
    expect(cal.events.filter((e) => e.kind === 'station').length).toBe(sec.stations.length);
  });

  it('double-transit edges skip the horizon clip', () => {
    for (const e of cal.events.filter((x) => x.kind.startsWith('double_transit'))) {
      expect(e.date).not.toBe(hz.from);
      expect(e.date).not.toBe(hz.to);
    }
  });

  it('takes lunations from the snapshot only when given, and says where the list ends', () => {
    const lun = cal.events.filter((e) => e.kind === 'lunation');
    expect(lun.length).toBeGreaterThan(0);
    expect(lun.every((e) => e.evidence.startsWith('snapshot.lunations.'))).toBe(true);
    expect(cal.caveats.join(' ')).toMatch(/Lunations are listed only through/);
    const none = buildCalendar(pack, { horizon: '1y' }, G1_AS_OF);
    expect(none.events.some((e) => e.kind === 'lunation')).toBe(false);
    expect(none.caveats.join(' ')).toMatch(/No new or full moon dates/);
  });

  it('is deterministic', () => {
    const again = buildCalendar(mk('career_work', '1y'), { horizon: '1y' }, G1_AS_OF, { lunations: transits.lunations });
    expect(again).toEqual(cal);
  });

  it('works on a merged multi-subject pack without duplicates', () => {
    const merged = mergeSubjectPacks([mk('career_work'), mk('income_wealth')]);
    const m = buildCalendar(merged, { horizon: '1y' }, G1_AS_OF);
    expect(m.events.length).toBeGreaterThan(0);
    const keys = m.events.map((e) => `${e.date}|${e.kind}|${e.label}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of m.events) expect(resolveEvidence(merged, e.evidence), e.evidence).toBeDefined();
  });

  it('is empty with no dasha or transit sections', () => {
    const bare: EvidencePack = { ...pack, sections: { base: pack.sections.base } };
    const c = buildCalendar(bare, { horizon: '1y' }, G1_AS_OF);
    expect(c.events).toEqual([]);
    expect(calendarBlock(c)).toBe('');
  });
});

describe('synthetic pack', () => {
  const pack = {
    subject: 'career_work',
    keyFrame: { houses: [], lords: [], karakas: [], vargas: [] },
    missing: [],
    stats: { approxTokens: 0, transitRowsDropped: 0 },
    sections: {
      dasha: {
        current: { md: 'Sa', ad: 'Ke', pd: 'Ve', md_end: '2039-11-16', ad_end: '2027-09-07', pd_end: '2026-11-10' },
        periods: {
          'Sa-Ke-Ve_2026-09-01': { md: 'Sa', ad: 'Ke', pd: 'Ve', from: '2026-09-01', to: '2026-11-10' },
          'Sa-Ke-Su_2026-11-10': { md: 'Sa', ad: 'Ke', pd: 'Su', from: '2026-11-10', to: '2026-12-01' },
          'Sa-Ve-Ve_2026-12-01': { md: 'Sa', ad: 'Ve', pd: 'Ve', from: '2026-12-01', to: '2027-02-01' },
        },
      },
      transits: {
        rows: {
          'Sa_2025-03-29': { planet: 'Sa', from: '2026-10-01', to: '2026-12-15', sign: 'Pisces', retro_on_entry: false },
          'Sa_2026-12-15': { planet: 'Sa', from: '2026-12-15', to: '2027-01-01', sign: 'Aries', retro_on_entry: false },
        },
        stations: [{ planet: 'Ju', kind: 'retro_start', date: '2026-11-11', sign: 3 }],
        double_transit: [{ from: '2026-10-01', to: '2026-11-20', houses: [7] }],
        sade_sati: { now: null, periods: [{ from: '2026-11-25', to: '2027-01-01', phase: 'rising' }] },
        lunations: [{ kind: 'new', date: '2026-11-09', sign: 6, sign_name: 'Libra', nak: 'Vishakha' }],
      },
    },
  } as unknown as EvidencePack;
  const cal = buildCalendar(pack, { horizon: { from: '2026-10-01', to: '2027-01-01' } }, '2026-10-01');
  const labels = cal.events.map((e) => `${e.date} ${e.kind} ${e.label}`);

  it('labels the level that changes and skips clipped edges', () => {
    expect(labels).toEqual([
      '2026-11-09 lunation new moon in Libra (Vishakha)',
      '2026-11-10 dasha_pd PD Su begins (Sa-Ke-Su)',
      '2026-11-11 station Ju turns retrograde',
      '2026-11-20 double_transit_end double transit on house 7 ends',
      '2026-11-25 sade_sati_start Sade Sati rising phase begins',
      '2026-12-01 dasha_ad AD Ve begins (Sa-Ve-Ve)',
      '2026-12-15 ingress Sa enters Aries',
    ]);
    expect(cal.caveats.join(' ')).toMatch(/eclipse/);
  });

  it('renders lines with evidence paths and caps them', () => {
    const block = calendarBlock(cal);
    expect(block).toMatch(/^CALENDAR \(dated edges inside the horizon 2026-10-01 to 2027-01-01\):/);
    expect(block).toContain('2026-12-15  Sa enters Aries  [transits.rows.Sa_2026-12-15]');
    expect(block).toContain(CALENDAR_HONESTY_NOTE);
    const many: CalendarEvent[] = Array.from({ length: 40 }, (_, i) => ({
      date: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`,
      kind: i === 39 ? 'dasha_md' : 'lunation',
      label: `e${i}`,
      evidence: `x.${i}`,
    }));
    const out = renderCalendar(many, 24).split('\n');
    expect(out).toHaveLength(24);
    expect(out.at(-1)).toBe('(+17 smaller edges omitted)');
    expect(out.some((l) => l.includes('e39'))).toBe(true);
  });
});

describe('readingCalendar()', () => {
  const prev = process.env.READING_CALENDAR;
  afterEach(() => {
    if (prev === undefined) delete process.env.READING_CALENDAR;
    else process.env.READING_CALENDAR = prev;
  });
  it('is on by default and 0 turns it off', () => {
    delete process.env.READING_CALENDAR;
    expect(readingCalendar()).toBe(true);
    process.env.READING_CALENDAR = '0';
    expect(readingCalendar()).toBe(false);
  });
});
