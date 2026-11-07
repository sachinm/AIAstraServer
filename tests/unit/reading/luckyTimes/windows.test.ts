import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { avoidBands, cut, localMinutes, nowState, scenarioDay, toMin, type DayRow } from '../../../../src/reading/luckyTimes/windows.js';
import { SCENARIOS, scenarioById, scenarioCatalog, starGroupOf, tithiGroupOf, STAR_GROUPS, TITHI_GROUPS } from '../../../../src/reading/luckyTimes/scenarios.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('evals/fixtures/day-tables/sanjose/2026-11.json'), 'utf8')) as { days: DayRow[] };
const day = (date: string) => fixture.days.find((d) => d.date === date)!;

describe('scenario catalog', () => {
  it('has 13 v1 scenarios with unique ids, each with a source', () => {
    expect(SCENARIOS).toHaveLength(13);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(13);
    for (const s of SCENARIOS) expect(s.source.length).toBeGreaterThan(10);
  });
  it('groups the catalog by area for the drop-down', () => {
    const cat = scenarioCatalog();
    expect(cat.map((a) => a.area)).toEqual(['work', 'love', 'money', 'travel', 'study', 'home']);
    expect(cat.flatMap((a) => a.scenarios)).toHaveLength(13);
  });
  it('covers every tithi 1-30 and every star 1-27 exactly once', () => {
    const t = Object.values(TITHI_GROUPS).flat().sort((a, b) => a - b);
    expect(t).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    const s = Object.values(STAR_GROUPS).flat().sort((a, b) => a - b);
    expect(s).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(tithiGroupOf(27)).toBe('bhadra');
    expect(starGroupOf(12)).toBe('fixed');
  });
});

describe('time parsing and cutting', () => {
  it('reads engine strings and clocks as minutes', () => {
    expect(toMin('11:30:18')).toBeCloseTo(690.3, 1);
    expect(toMin({ time: '00:45:53', day_offset: 1, hours: 24.7648 })).toBeCloseTo(1485.9, 1);
  });
  it('cuts bands out of a range', () => {
    expect(cut({ from: 600, to: 720 }, [{ from: 630, to: 660 }])).toEqual([{ from: 600, to: 630 }, { from: 660, to: 720 }]);
    expect(cut({ from: 600, to: 720 }, [{ from: 500, to: 800 }])).toEqual([]);
  });
  it('lists the day avoid bands from the engine row', () => {
    const kinds = avoidBands(day('2026-11-05')).map((b) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['rahu_kalam', 'yamagandam', 'gulikai', 'durmuhurtam', 'varjyam']));
  });
});

describe('scenario windows on San Jose, Nov 2026', () => {
  it('never returns a window that overlaps an avoid band', () => {
    for (const d of fixture.days) {
      const bands = avoidBands(d);
      for (const s of SCENARIOS) {
        for (const w of scenarioDay(d, s).windows) {
          for (const b of bands) expect(w.to <= b.from || w.from >= b.to).toBe(true);
          expect(w.to - w.from).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });
  it('a contract on Thu 5 Nov (waning dwadashi, a bhadra day) finds a window and cites the reasons', () => {
    const r = scenarioDay(day('2026-11-05'), scenarioById('work.sign_contract')!);
    expect(r.verdict).toBe('good');
    expect(r.windows.length).toBeGreaterThan(0);
    expect(r.windows.flatMap((w) => w.reasonKeys)).toContain('weekday:Thursday');
  });
  it('the contract layer skips Saturday and Tuesday entirely', () => {
    for (const d of fixture.days.filter((x) => x.weekday === 'Saturday' || x.weekday === 'Tuesday')) {
      const r = scenarioDay(d, scenarioById('work.sign_contract')!);
      expect(r.verdict).toBe('avoid_day');
      expect(r.windows).toEqual([]);
    }
  });
  it('a rikta tithi gives no contract window inside its span', () => {
    const rikta = fixture.days.filter((d) => tithiGroupOf(d.panchanga_at_noon?.tithi?.number ?? 0) === 'rikta' && d.weekday !== 'Saturday' && d.weekday !== 'Tuesday');
    expect(rikta.length).toBeGreaterThan(0);
    for (const d of rikta) {
      const span = d.panchanga_at_noon!.tithi!;
      for (const w of scenarioDay(d, scenarioById('work.sign_contract')!).windows) {
        const inside = Math.min(w.to, span.end_hours! * 60) - Math.max(w.from, (span.start_hours ?? -99) * 60);
        expect(inside).toBeLessThan((w.to - w.from) / 2 + 1);
      }
    }
  });
  it('the star rule applies only before the star ends', () => {
    const d = day('2026-11-05');
    const end = d.panchanga_at_noon!.nakshatra!.end_hours! * 60;
    for (const s of SCENARIOS) {
      for (const w of scenarioDay(d, s).windows) {
        if (w.reasonKeys.some((r) => r.startsWith('star'))) expect(Math.min(w.to, end) - w.from).toBeGreaterThan(0);
      }
    }
  });
  it('a personal good day raises the score', () => {
    const d = day('2026-11-05');
    const s = scenarioById('work.start_project')!;
    const base = scenarioDay(d, s).windows[0]?.score ?? 0;
    const boosted = scenarioDay(d, s, { tara: { name: 'Sampat', good: true }, chandra_bala: { house_from_moon: 11, good: true } }).windows[0]?.score ?? 0;
    expect(boosted).toBeGreaterThanOrEqual(base + 2);
  });
});

describe('now', () => {
  it('reports an avoid band with its end', () => {
    const d = day('2026-11-05');
    const s = nowState(d, toMin(d.rahu_kalam!.start) + 5);
    expect(s).toMatchObject({ kind: 'avoid', band: 'rahu_kalam' });
  });
  it('reports abhijit as good', () => {
    const d = day('2026-11-05');
    expect(nowState(d, toMin(d.abhijit!.start) + 5)).toMatchObject({ kind: 'good', what: 'abhijit' });
  });
  it('reads local minutes in a zone', () => {
    expect(localMinutes(new Date('2026-11-05T19:30:00Z'), 'America/Los_Angeles')).toEqual({ date: '2026-11-05', minutes: 11 * 60 + 30 });
  });
});
