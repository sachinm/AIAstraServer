import { describe, expect, it } from 'vitest';
import { LIFE_AREAS, lifeArea } from '../../../../src/reading/life/areas.js';
import { composeDashboard, confirmQuestion, longDate, type LifeDashboard } from '../../../../src/reading/life/compose.js';
import { promiseScale } from '../../../../src/reading/life/promise.js';
import { areaTiming } from '../../../../src/reading/life/timing.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import type { DigestView } from '../../../../src/reading/digest/types.js';
import { makeView, row } from './fixture.js';

const today = '2026-11-05';
const horizonEnd = '2041-11-05';

/** doc 45 §3.3: never on screen (chart terms are allowed only in cause.planets / cause.dashas / improves md, ad, systems and evidence). */
const BANNED = [
  'storm', 'hurricane', 'flood', 'blizzard', 'disaster', 'weather', 'season', 'forecast',
  'hospital', 'emergency', 'urgent care', 'doctor', 'surgery', 'triage',
  'resort', 'six-star', 'VIP', 'private jet',
  'guaranteed', 'certain', 'absolutely', '100 ?%', 'safe',
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
  'dasha', 'mahadasha', 'antardasha', 'nakshatra', 'tithi', 'house', 'lord', 'trine', 'square', 'conjunction', 'transit', 'retrograde', 'saham', 'varga', 'D10',
  'fired', 'sacked', 'doomed', 'Radha', 'pyjhora', 'jhora',
];
const BANNED_RE = new RegExp(`\\b(${BANNED.join('|')})s?\\b`, 'i');

function visibleStrings(d: LifeDashboard): string[] {
  const out: string[] = d.rule_now ? [d.rule_now] : [];
  for (const a of d.areas) out.push(a.label, a.issue, a.cause.text, a.basis, ...a.solution, ...a.improves.map((w) => w.basis));
  return out;
}

function build(view: DigestView, running: ActivationRow[], rows: ActivationRow[], facts = {}) {
  const sky = { from: '2026-01-01', to: '2028-11-01', gates: [], slow: [{ planet: 'Sa', from: '2026-03-01', to: '2027-06-03', house: 12 }] };
  const areas = LIFE_AREAS.map((area) => {
    const promise = promiseScale(view, area, { today, running, annual: [], sky });
    return { area, promise, timing: areaTiming(view, area, promise, { today, horizonEnd, rows, annual: () => [], sky }) };
  });
  return composeDashboard(view, areas, running, today, facts);
}

const view = makeView({ tone: 'strong', planets: { D1: { Ra: { functional: 'malefic', dignity: 'debilitated' } } } });
const running = [row('vimshottari', 'vimshottari', '2026-01-14', '2027-02-07', [10, 5], 'Ra', { parentLord: 'Mo' }), row('vimshottari', 'vimshottari', '2019-01-01', '2029-01-01', [9], 'Mo', { level: 1, parentLord: null })];
const ahead = [
  row('vimshottari', 'vimshottari', '2027-02-07', '2027-09-15', [10, 2], 'Sa', { parentLord: 'Mo' }),
  row('yogini', 'yogini', '2027-01-01', '2027-08-01', [10, 2], 'Ju'),
];

describe('compose: the Part 1 dashboard (doc 34 §5)', () => {
  const d = build(view, running, [...running, ...ahead]);

  it('shows only areas with a pressure now or a dated window', () => {
    const ids = d.areas.map((a) => a.id);
    expect(ids).toContain('work'); // tested now by the running period on house 10, dated window ahead
    expect(ids).toContain('travel'); // the slow body on house 12
    expect(ids).toContain('money'); // dated window on house 2
    expect(ids).not.toContain('siblings'); // nothing now, nothing dated
  });

  it('puts the current pressure as a plain sentence with its end date, then one question', () => {
    const w = d.areas.find((a) => a.id === 'work')!;
    expect(w.issue).toBe(`Your current chapter is testing work until ${longDate('2027-02-07')}. Has work, or finding work, felt harder lately?`);
    expect(w.cause.planets).toContain('Rahu');
    expect(w.cause.dashas[0]).toBe('Vimshottari Moon–Rahu (to 7 Feb 2027)');
    expect(w.improves[0]).toMatchObject({ from: '2027-02-07', to: '2027-09-15', md: 'Moon', ad: 'Saturn', systems: ['Vimshottari', 'Yogini'], grade: 'moderate' });
    expect(w.solution.some((s) => s.startsWith('Hold big, hard-to-undo moves on work until 7 Feb 2027'))).toBe(true);
    expect(w.solution.some((s) => s.startsWith('Act between 7 Feb 2027 and 15 Sep 2027'))).toBe(true);
    expect(w.solution.at(-1)).toMatch(/^Traditional support from your chart's own helpful influences: /);
    expect(w.evidence.length).toBeGreaterThan(0);
    const t = d.areas.find((a) => a.id === 'travel')!;
    expect(t.issue.startsWith(`A slow-moving influence is pressing on travel and moving until ${longDate('2027-06-03')}.`)).toBe(true);
  });

  it('gives the rule for the current sub-period, with what happens if it is broken', () => {
    expect(d.rule_now).toContain('Until 7 Feb 2027, hold off on big decisions');
    expect(d.rule_now).toContain('ready from 7 Feb 2027');
    expect(d.rule_now).toContain('cost more to undo later');
  });

  it('keeps every visible string free of the banned words and the engine name', () => {
    for (const s of visibleStrings(d)) expect(s, s).not.toMatch(BANNED_RE);
    for (const a of LIFE_AREAS) expect(a.label).not.toMatch(BANNED_RE);
  });

  it('words the question from the person’s own facts', () => {
    expect(confirmQuestion('work', { 'work.status': 'between_jobs' })).toBe('Has the search for work felt slow?');
    expect(confirmQuestion('marriage', { 'love.status': 'single' })).toBe('Has meeting someone felt slow?');
    expect(confirmQuestion('marriage', {})).toBe('Has something shifted in a relationship?');
    expect(confirmQuestion('children', { 'family.children': 'none' })).toMatch(/^If you are hoping for children/);
    for (const a of LIFE_AREAS) for (const f of [{}, { 'work.status': 'yes', 'love.status': 'married', 'family.children': 'young' }]) expect(confirmQuestion(a.id, f)).not.toMatch(BANNED_RE);
    const between = build(view, running, [...running, ...ahead], { 'work.status': 'between_jobs' });
    expect(between.areas.find((a) => a.id === 'work')!.issue).toMatch(/Has the search for work felt slow\?$/);
  });

  it('a period that supports writes act-on-what-is-ready, and a quiet chart shows nothing', () => {
    const calm = [row('vimshottari', 'vimshottari', '2026-01-14', '2027-02-07', [3], 'Ju', { parentLord: 'Mo' })];
    const q = build(makeView({ tone: 'strong' }), calm, calm);
    expect(q.rule_now).toMatch(/^Until 7 Feb 2027, this is a stretch to act on what you have ready/);
    expect(q.areas.map((a) => a.id)).toEqual(['marriage', 'travel', 'dharma']); // only the areas that read house 12, where the slow body sits
    expect(lifeArea('travel').houses).toContain(12);
  });
});
