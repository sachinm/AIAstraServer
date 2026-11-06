/**
 * Lucky times on all five limbs (docs/reading-engine/53 §4.6, 54 §6): the engine's noon yoga and karana gate or favour a
 * piece inside their spans, every reason carries a scope, and the hora lord's functional nature is a personal mark only
 * when the chart's digest gives it.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dayLimbs, scenarioDay, scopeOf, type DayRow } from '../../../../src/reading/luckyTimes/windows.js';
import { KARANA_NAMES, SCENARIOS, YOGA_NAMES, karanaName, scenarioById, yogaName } from '../../../../src/reading/luckyTimes/scenarios.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('evals/fixtures/day-tables/sanjose/2026-11.json'), 'utf8')) as { days: DayRow[] };
const day = (date: string) => fixture.days.find((d) => d.date === date)!;
/** The same engine row with its noon yoga or karana replaced (a test row; the real ones come from the engine). */
const withLimb = (row: DayRow, limb: 'yoga' | 'karana', name: string, start = -6, end = 30): DayRow => ({
  ...row,
  panchanga_at_noon: { ...row.panchanga_at_noon, [limb]: { name, start_hours: start, end_hours: end } },
});
const contract = scenarioById('work.sign_contract')!;
const thu = day('2026-11-05'); // Thursday: yoga Vaidhrithi until 15.65 h, karana Taitila 9.02–21.0 h

describe('engine names in the classical spelling', () => {
  it('reads every yoga and karana name the engine stores (day_tables, Nov 2026)', () => {
    const engineYogas = ['Vishkambha', 'Priti', 'Ayushman', 'Soubhagya', 'Sobhana', 'Atiganda', 'Sukarma', 'Dhrithi', 'Soola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Vriyana', 'Parigha', 'Siva', 'Siddha', 'Sadhya', 'Subha', 'Sukla', 'Brahma', 'Indra', 'Vaidhrithi'];
    expect(engineYogas.map(yogaName)).toEqual([...YOGA_NAMES]);
    const engineKaranas = ['Bava', 'Baalava', 'kaulava', 'Taitila', 'Gara', 'Vanija', 'VishtiBhadra', 'Sakuna', 'Chatushpada', 'Naga', 'Kimstugna'];
    expect(engineKaranas.map(karanaName)).toEqual([...KARANA_NAMES]);
    expect(yogaName('Amrita')).toBeNull();
    expect(karanaName('')).toBeNull();
  });
  it('dayLimbs gives the name and end hour from the stored row', () => {
    expect(dayLimbs(thu)).toEqual({ yoga: { name: 'Vaidhriti', endHour: 15.6488 }, karana: { name: 'Taitila', endHour: 21.0046 } });
    expect(dayLimbs({ date: '2026-11-05' })).toEqual({ yoga: null, karana: null });
  });
  it('every v1 act avoids the nine yogas and Vishti, each list cited', () => {
    for (const s of SCENARIOS) {
      expect(s.yogaAvoid).toEqual(expect.arrayContaining(['Vyatipata', 'Vaidhriti', 'Vishkambha']));
      expect(s.karanaAvoid).toContain('Vishti');
      expect(s.yogaFavour.some((y) => s.yogaAvoid.includes(y))).toBe(false);
      expect(s.source).toMatch(/Muhurta Chintamani.*yogas and karanas/);
    }
  });
});

describe('the day gate', () => {
  it('a day under Vyatipata yoga is gated out for a contract', () => {
    const r = scenarioDay(withLimb(thu, 'yoga', 'Vyatipata'), contract);
    expect(r).toMatchObject({ verdict: 'avoid_day', windows: [] });
    expect(r.dayReasons).toContain('yoga_avoid:Vyatipata');
  });
  it('a day under Vishti karana is gated out for a contract', () => {
    const r = scenarioDay(withLimb(thu, 'karana', 'VishtiBhadra'), contract);
    expect(r).toMatchObject({ verdict: 'avoid_day', windows: [] });
    expect(r.dayReasons).toContain('karana_avoid:Vishti');
  });
  it('a personal good day never opens a gated day', () => {
    const r = scenarioDay(withLimb(thu, 'yoga', 'Vyatipata'), contract, { tara: { good: true }, chandra_bala: { good: true } }, { functional: { Jupiter: 'benefic', Mercury: 'benefic' } });
    expect(r.windows).toEqual([]);
  });
  it('an avoided yoga gates only its own span: on 5 Nov no window starts before Vaidhriti ends', () => {
    const end = 15.6488 * 60;
    for (const s of SCENARIOS) for (const w of scenarioDay(thu, s).windows) expect(w.from).toBeGreaterThanOrEqual(Math.floor(end));
    expect(scenarioDay(thu, contract).windows.length).toBeGreaterThan(0);
  });
  it('a neutral yoga gates nothing', () => {
    expect(scenarioDay(withLimb(thu, 'yoga', 'Vriddhi'), contract).windows.some((w) => w.from < 15 * 60)).toBe(true);
  });
});

describe('favour', () => {
  it('a favoured yoga adds +1 inside its span and names itself', () => {
    const s = scenarioById('work.start_project')!;
    const base = scenarioDay(withLimb(thu, 'yoga', 'Vriddhi'), s);
    const good = scenarioDay(withLimb(thu, 'yoga', 'Siddhi'), s);
    expect(good.windows.length).toBeGreaterThan(0);
    let compared = 0;
    for (const w of good.windows) {
      expect(w.reasonKeys).toContain('yoga:Siddhi');
      const same = base.windows.find((b) => b.from === w.from && b.to === w.to);
      if (same) {
        expect(w.score).toBe(same.score + 1);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
  it('a favoured karana is named on the window without moving the score', () => {
    const named = scenarioDay(thu, contract);
    const plain = scenarioDay(withLimb(thu, 'karana', 'Kimstugna', 9.0225, 21.0046), contract);
    const inSpan = named.windows.filter((w) => w.from >= 9.0225 * 60 && w.to <= 21.0046 * 60);
    expect(inSpan.length).toBeGreaterThan(0);
    for (const w of inSpan) {
      expect(w.reasonKeys).toContain('karana:Taitila');
      expect(plain.windows.find((p) => p.from === w.from)?.score).toBe(w.score);
    }
  });
});

describe('scopes and the personal hora mark', () => {
  it('every reason carries a scope; personal: keys are personal, the rest general', () => {
    const r = scenarioDay(thu, contract, { tara: { good: true }, chandra_bala: { good: false } });
    expect(r.windows.length).toBeGreaterThan(0);
    for (const w of r.windows) {
      expect(w.reasons.map((x) => x.key)).toEqual(w.reasonKeys);
      for (const x of w.reasons) expect(x.scope).toBe(x.key.startsWith('personal:') ? 'personal' : 'general');
      expect(w.reasons).toEqual(expect.arrayContaining([{ key: 'personal:tara_good', scope: 'personal' }, { key: 'weekday:Thursday', scope: 'general' }]));
    }
    expect(scopeOf('yoga:Siddhi')).toBe('general');
    expect(scopeOf('personal:hora_benefic')).toBe('personal');
  });
  it("the hora lord's functional nature for this chart moves a window by ±1, marked personal", () => {
    const s = scenarioById('work.start_project')!;
    const row = withLimb(thu, 'yoga', 'Vriddhi');
    const plain = scenarioDay(row, s);
    const benefic = scenarioDay(row, s, undefined, { functional: { Jupiter: 'benefic', Mercury: 'benefic', Moon: 'benefic', Sun: 'neutral', Venus: 'neutral', Mars: 'malefic', Saturn: 'malefic' } });
    expect(benefic.windows.flatMap((w) => w.reasons)).toContainEqual({ key: 'personal:hora_benefic', scope: 'personal' });
    for (const w of benefic.windows) {
      const same = plain.windows.find((p) => p.from === w.from && p.to === w.to);
      if (w.reasonKeys.includes('personal:hora_benefic') && same) expect(w.score).toBe(same.score + 1);
    }
    const malefic = scenarioDay(row, s, undefined, { functional: { Jupiter: 'malefic', Mercury: 'malefic', Moon: 'malefic' } });
    expect(malefic.windows.flatMap((w) => w.reasonKeys)).not.toContain('personal:hora_benefic');
    expect(Math.max(0, ...malefic.windows.map((w) => w.score))).toBeLessThan(Math.max(...plain.windows.map((w) => w.score)));
  });
  it('no digest, no hora mark', () => {
    for (const w of scenarioDay(thu, contract, undefined, { functional: null }).windows) expect(w.reasonKeys.some((k) => k.startsWith('personal:hora'))).toBe(false);
  });
  it('Siddha yoga (#21), Amrita Siddhi weekday+star, fixed karanas (Shakuni/Chatushpada/Naga avoid; Kimstughna +1 on auspicious beginnings) and personal:dasha_lord', () => {
    const s = scenarioById('work.start_project')!;
    const siddhaDay = scenarioDay(withLimb(thu, 'yoga', 'Siddha'), s);
    expect(siddhaDay.windows.some((w) => w.reasonKeys.includes('yoga:Siddha'))).toBe(true);
    // Shakuni, Chatushpada, Naga gate out the span like Vishti
    for (const bad of ['Shakuni', 'Chatushpada', 'Naga']) {
      const gated = scenarioDay(withLimb(thu, 'karana', bad, 0, 24), contract);
      expect(gated.windows).toHaveLength(0);
      expect(gated.dayReasons).toContain(`karana_avoid:${bad}`);
    }
    // Kimstughna adds +1 on auspicious beginnings (work.start_project)
    const kim = scenarioDay(withLimb(withLimb(thu, 'yoga', 'Vriddhi'), 'karana', 'Kimstughna', 0, 24), s);
    const tait = scenarioDay(withLimb(withLimb(thu, 'yoga', 'Vriddhi'), 'karana', 'Taitila', 0, 24), s);
    const same = kim.windows.find((w) => tait.windows.some((t) => t.from === w.from && t.to === w.to));
    if (same) {
      const peer = tait.windows.find((t) => t.from === same.from && t.to === same.to)!;
      expect(same.score).toBe(peer.score + 1);
    }
    // Thursday + Pushya = Amrita Siddhi (+1 general reason); runningLords matching Saturn (Pushya lord) adds personal:dasha_lord (+1 personal reason)
    const pushyaRow = { ...withLimb(thu, 'yoga', 'Vriddhi'), panchanga_at_noon: { ...(thu.panchanga_at_noon as Record<string, unknown>), yoga: { name: 'Vriddhi', start_hours: 0, end_hours: 24 }, nakshatra: { number: 8, name: 'Pushya', lord: 'Saturn', group: 'kshipra', start_hours: 0, end_hours: 24 } } };
    const amrita = scenarioDay(pushyaRow, s, undefined, { runningLords: ['Saturn'] });
    expect(amrita.windows.flatMap((w) => w.reasons)).toContainEqual({ key: 'amrita_siddhi', scope: 'general' });
    expect(amrita.windows.flatMap((w) => w.reasons)).toContainEqual({ key: 'personal:dasha_lord', scope: 'personal' });
    expect(amrita.windows.flatMap((w) => w.reasons)).toContainEqual({ key: 'star:quick', scope: 'general' });
    // Amavasya (tithi 30) is gated out even if an older payload sent group='purna', and Sanskrit tikshna group penalizes windows by star_avoid:sharp
    const amavasyaRow = { ...withLimb(thu, 'yoga', 'Vriddhi'), panchanga_at_noon: { ...(thu.panchanga_at_noon as Record<string, unknown>), yoga: { name: 'Vriddhi', start_hours: 0, end_hours: 24 }, tithi: { number: 30, group: 'purna', start_hours: 0, end_hours: 24 } } };
    expect(scenarioDay(amavasyaRow, contract)).toMatchObject({ verdict: 'avoid_day', windows: [], dayReasons: expect.arrayContaining(['tithi_avoid:amavasya']) });
    const tikshnaRow = { ...withLimb(thu, 'yoga', 'Vriddhi'), panchanga_at_noon: { ...(thu.panchanga_at_noon as Record<string, unknown>), yoga: { name: 'Vriddhi', start_hours: 0, end_hours: 24 }, nakshatra: { number: 6, name: 'Ardra', group: 'tikshna', start_hours: 0, end_hours: 24 } } };
    expect(scenarioDay(tikshnaRow, s).windows.flatMap((w) => w.reasons)).toContainEqual({ key: 'star_avoid:sharp', scope: 'general' });
  });
});
