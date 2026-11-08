import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  afflictionLayer,
  annualLayer,
  buildBoard,
  buildLoveBondingAndChemistry,
  buildLoveRelationshipArc,
  currentYear,
  familyVotes,
  gradeRow,
  KIND_WORDS,
  promiseLayer,
  protectionLayer,
  releaseOf,
  resolvePlanet,
  runningOn,
  transitLayer,
  type BoardInput,
} from '../../../../src/reading/area/houseLayers.js';
import { SELF } from '../../../../src/reading/area/self.js';
import { LOVE } from '../../../../src/reading/area/love.js';
import type { TransitRangePayload } from '../../../../src/reading/chartData/transitRange.js';
import { act, fakeDigest, house, planet, selfActivation, selfFixture } from '../../../helpers/fakeDigest.js';

const AS_OF = '2026-11-05';
const view = selfFixture();
const activation = selfActivation();
const running = runningOn(activation, AS_OF);
const input = (over: Partial<BoardInput> = {}): BoardInput => ({ view, cfg: SELF, asOf: AS_OF, activation, running, transit: null, ...over });

/** doc 45 §3.3: never on a first screen. */
const BANNED = /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|house|lord|dasha|mahadasha|antardasha|nakshatra|tithi|trine|transit|retrograde|saham|varga|D\d+|kendra|trikona|dusthana|yoga|dosha|lagna|ascendant|storm|weather|hospital|guaranteed|certain|divorce)\b/i;

function sky(over: Partial<TransitRangePayload> = {}): TransitRangePayload {
  return {
    from: '2026-01-01', to: '2027-12-31', planets: ['Ju', 'Sa', 'Ra', 'Ke'],
    natal: { lagna_sign: 'Ar', lagna_sign_index: 0, moon_sign: 'Cn', moon_sign_index: 3 },
    ingresses: [
      { planet: 'Sa', sign: 'Ar', sign_index: 0, from: '2026-06-01', to: '2028-08-01', retro_on_entry: false, house_from_lagna: 1, house_from_moon: 10 },
      { planet: 'Ju', sign: 'Le', sign_index: 4, from: '2026-10-01', to: '2027-10-15', retro_on_entry: false, house_from_lagna: 5, house_from_moon: 2 },
      { planet: 'Ra', sign: 'Aq', sign_index: 10, from: '2025-05-01', to: '2026-12-01', retro_on_entry: true, house_from_lagna: 11, house_from_moon: 8 },
    ],
    stations: [], lunations: [], eclipses: [],
    sade_sati: [{ phase: 'rising', saturn_sign: 'Ge', from: '2026-01-01', to: '2027-02-01' }],
    dhaiya: [],
    ...over,
  };
}

describe('resolvePlanet and releases (selection only)', () => {
  it('reads a house lord from the D1 card and a karaka from its point row', () => {
    expect(resolvePlanet(view, 'L1')).toBe('Ma');
    expect(resolvePlanet(view, 'L5')).toBe('Su');
    expect(resolvePlanet(view, 'Mo')).toBe('Mo');
    expect(resolvePlanet(view, 'AK')).toBeNull();
    const withAk = fakeDigest({ points: [{ id: 'AK', varga: 'D1', sign: null, house: 3, lord: null, lordHouse: null, planet: 'Ve' } as never] });
    expect(resolvePlanet(withAk, 'AK')).toBe('Ve');
    // as the digest writes it: the karaka placed by its planet's card (sign, house, dispositor), joined back to one card
    const placed = fakeDigest({ planets: [planet('Ve', { sign: 'Ta', house: 2, dispositor: 'Ve' }), planet('Me', { sign: 'Ge', house: 3, dispositor: 'Me' })], points: [{ id: 'DK', varga: 'D1', sign: 'Ge', house: 3, lord: 'Me', lordHouse: 3 }] });
    expect(resolvePlanet(placed, 'DK')).toBe('Me');
  });
  it('the release of a pressure is the end of the planet’s running period, main clock first', () => {
    expect(releaseOf(running, 'Sa')).toBe('2031-03-01');
    expect(releaseOf(running, 'Ma')).toBe('2027-03-01'); // only the short clock runs it
    expect(releaseOf(running, 'Ve')).toBeNull();
    expect(releaseOf(running, null)).toBeNull();
  });
});

describe('promise', () => {
  const rows = promiseLayer(view, SELF);
  it('the lagna lord in a kendra and in its own sign supports, with the digest key as evidence', () => {
    const placed = rows.find((r) => r.kind === 'placed_well' && r.theme === 'h1')!;
    expect(placed.side).toBe('support');
    expect(placed.evidence[0]).toContain('D1.h1 lord Ma in h10');
    expect(rows.some((r) => r.kind === 'strong' && r.theme === 'h1')).toBe(true);
    expect(rows.some((r) => r.kind === 'reserves' && r.theme === 'h1')).toBe(true); // SAV 30
  });
  it('a yoga touching the lord counts once; a yoga with its cancellation listed is not a promise', () => {
    expect(rows.filter((r) => r.kind === 'yoga').map((r) => r.evidence[0])).toEqual(['yoga:ruchaka (mahapurusha)']);
  });
  it('a lord in a dusthana is not a support', () => {
    expect(rows.some((r) => r.theme === 'h5' && r.side === 'support' && r.kind === 'placed_well')).toBe(false);
  });
  it('a dead avastha halves what the house promises', () => {
    const v = fakeDigest({ houses: [house(1, { lord: 'Ma', lordHouse: 1, lordDignity: 'own' })], planets: [planet('Ma', { avasthas: { jagradadi: 'mrita' } })] });
    const r = promiseLayer(v, SELF).find((x) => x.kind === 'placed_well')!;
    expect(r.weight).toBe(1);
  });
});

describe('afflictions carry their release date', () => {
  const rows = afflictionLayer(view, SELF, running);
  it('Saturn in the 4th presses until its running period ends', () => {
    const r = rows.find((x) => x.theme === 'h4' && x.kind === 'pressed')!;
    expect(r.planet).toBe('Sa');
    expect(r.until).toBe('2031-03-01');
  });
  it('the 5th lord in a dusthana is a standing weight when it is not running', () => {
    const r = rows.find((x) => x.theme === 'h5' && x.kind === 'placed_hard')!;
    expect(r.until).toBeNull();
  });
  it('the Moon joined by Saturn is a pressure; Kemadruma with its cancellation listed is not', () => {
    expect(rows.some((x) => x.theme === 'Mo' && x.kind === 'pressed')).toBe(true);
    expect(rows.some((x) => x.kind === 'alone')).toBe(false);
    const noCancel = fakeDigest({ houses: [house(4, {})], yogas: [{ id: 'kemadruma', name: 'Kemadruma', planets: ['Mo'], houses: [4], class: 'dosha', source: 'yogas' }] });
    expect(afflictionLayer(noCancel, SELF, []).some((x) => x.kind === 'alone')).toBe(true);
  });
  it('a gandanta Moon is read from the star profile for Self only', () => {
    const g = fakeDigest({ gandanta: ['Mo'] });
    expect(afflictionLayer(g, SELF, []).some((x) => x.kind === 'deep_feelings')).toBe(true);
    expect(afflictionLayer(g, LOVE, []).some((x) => x.kind === 'deep_feelings')).toBe(false);
  });
});

describe('protection', () => {
  it('Jupiter on the lagna and on the Moon, the listed cancellation, benefic argala and the D9 check', () => {
    const rows = protectionLayer(view, SELF);
    expect(rows.find((r) => r.theme === 'h1' && r.kind === 'guarded')!.evidence[0]).toBe('D1.h1 aspected_by Ju');
    expect(rows.some((r) => r.theme === 'Mo' && r.kind === 'guarded')).toBe(true);
    expect(rows.some((r) => r.kind === 'cancelled' && r.evidence[0]!.startsWith('yoga:kemadruma_bhanga'))).toBe(true);
    expect(rows.some((r) => r.kind === 'held_up' && r.theme === 'h9')).toBe(true);
    expect(rows.some((r) => r.kind === 'deep_bond' && r.evidence[0] === 'D9.h1 lord Ve dignity own')).toBe(true);
  });
  it('Love: argala on UL; a debilitated D9 7th lord gives no deep-bond row', () => {
    const rows = protectionLayer(view, LOVE);
    expect(rows.some((r) => r.theme === 'UL' && r.kind === 'held_up')).toBe(true);
    expect(rows.some((r) => r.kind === 'deep_bond')).toBe(false);
  });
});

describe('activation grading and family votes', () => {
  it('grades the period lord by functional nature, D1 and D9 dignity and what it owns', () => {
    const ju = gradeRow(view, SELF, act({ lord: 'Ju', from: '2026-02-01', to: '2027-06-01' }));
    expect(ju.score).toBe(4);
    expect(ju.side).toBe('support');
    expect(ju.grade).toBe('strong');
    const sa = gradeRow(view, SELF, act({ lord: 'Sa', from: '2026-02-01', to: '2027-06-01' }));
    expect(sa.side).toBe('test');
    expect(sa.grade).toBe('moderate');
  });
  it('a sign period is graded by the lord of that sign’s D1 house card', () => {
    const g = gradeRow(view, SELF, act({ family: 'rasi', system: 'narayana', level: 1, sign: 'Ar', from: '2024-01-01', to: '2030-01-01' }));
    expect(g.planet).toBe('Ma');
    expect(g.side).toBe('support');
  });
  it('the short clocks vote only when both agree', () => {
    const graded = activation.map((r) => gradeRow(view, SELF, r));
    const votes = familyVotes(graded, AS_OF);
    expect(votes.find((v) => v.family === 'main')!.vote).toBe('support');
    expect(votes.find((v) => v.family === 'rasi')!.vote).toBe('support');
    expect(votes.find((v) => v.family === 'short')!.vote).toBe('support');
    expect(familyVotes(graded, '2027-02-01').find((v) => v.family === 'short')!.vote).toBe('neutral');
  });
});

describe('transit and annual layers', () => {
  it('omits the transit layer with a note when no sky is stored', () => {
    expect(transitLayer(null, SELF, AS_OF)).toBeNull();
    expect(buildBoard(input()).board.notes.join(' ')).toMatch(/not stored/);
  });
  it('reads the stored overlay: Saturn over the lagna until it moves, Jupiter over the 5th, sade sati for Self', () => {
    const rows = transitLayer(sky(), SELF, AS_OF)!;
    expect(rows.find((r) => r.planet === 'Sa' && r.kind === 'sky_slows')!.until).toBe('2028-08-01');
    expect(rows.find((r) => r.kind === 'sky_helps')!.theme).toBe('h5');
    expect(rows.find((r) => r.kind === 'long_test')!.until).toBe('2027-02-01');
    expect(rows.some((r) => r.planet === 'Ra')).toBe(false); // the 11th is not a Self house
    expect(transitLayer(sky(), LOVE, AS_OF)!.some((r) => r.kind === 'long_test')).toBe(false);
  });
  it('picks the year chart whose year dashas cover today and reads its lords and sahams', () => {
    expect(currentYear(view, AS_OF)!.year).toBe(2026);
    expect(currentYear(view, '2026-01-01')!.year).toBe(2025);
    const a = annualLayer(view, SELF, AS_OF);
    expect(a.rows.some((r) => r.side === 'support' && r.evidence[0]!.includes('h1 lord Ma in h10'))).toBe(true);
    expect(a.rows.some((r) => r.evidence[0]!.includes('saham punya'))).toBe(true);
    const l = annualLayer(view, LOVE, AS_OF);
    expect(l.rows.some((r) => r.side === 'test' && r.evidence[0]!.includes('h7 lord Ve in h12'))).toBe(true);
    expect(l.rows.some((r) => r.evidence[0]!.includes('saham vivaha'))).toBe(true);
  });
});

describe('the board', () => {
  const b = buildBoard(input());
  it('the tone follows the family votes: open while the main, sign and short clocks and the year agree', () => {
    expect(b.board.tone.tone).toBe('open');
    expect(b.board.tone.confidence).toBe('confirmed');
    expect(b.board.tone.date).toBe('2027-05-31');
    expect(b.board.tone.families.map((f) => f.family)).toEqual(['main', 'rasi', 'short', 'annual']);
  });
  it('a demanding stretch when the clocks test, easing when it lifts next month', () => {
    const hard = [
      act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2040-01-01' }),
      act({ level: 2, lord: 'Me', from: '2026-01-01', to: '2027-04-01' }),
      act({ system: 'narayana', family: 'rasi', level: 1, sign: 'Li', from: '2024-01-01', to: '2028-01-01' }),
    ];
    const v = fakeDigest({
      houses: [house(1, { lord: 'Ma' }), house(7, { lord: 'Ve', sign: 'Li' }), house(6, { lord: 'Me' })],
      planets: [planet('Sa', { functional: 'malefic', dignity: 'debilitated' }), planet('Me', { functional: 'malefic', owns: [3, 6] }), planet('Ve', { functional: 'malefic', owns: [6] })],
    });
    const t = buildBoard({ view: v, cfg: SELF, asOf: AS_OF, activation: hard, running: runningOn(hard, AS_OF), transit: null }).board.tone;
    expect(t.tone).toBe('demanding');
    const easing = buildBoard({ view: v, cfg: SELF, asOf: '2027-12-10', activation: hard, running: [], transit: null }).board.tone;
    expect(easing.tone).toBe('easing');
    expect(easing.date).toBe('2028-01-01');
  });
  it('primary clocks (conditional and main) govern tone when secondary clocks (rasi, karaka, annual) vote support', () => {
    const sachinLike = [
      act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01' }),
      act({ level: 2, lord: 'Me', from: '2026-01-01', to: '2027-06-01' }),
      act({ system: 'dwisatpathi', family: 'conditional', level: 1, lord: 'Sa', from: '2022-01-01', to: '2031-01-01' }),
      act({ system: 'dwisatpathi', family: 'conditional', level: 2, lord: 'Me', from: '2026-01-01', to: '2027-03-01' }),
      act({ system: 'narayana', family: 'rasi', level: 1, sign: 'Ar', from: '2024-01-01', to: '2029-01-01' }),
      act({ system: 'karaka', family: 'karaka', level: 1, lord: 'Ju', from: '2025-01-01', to: '2028-01-01' }),
    ];
    const v = fakeDigest({
      houses: [
        house(1, { lord: 'Ma', sign: 'Ar' }),
        house(7, { lord: 'Ve', sign: 'Li', occupants: [{ planet: 'Ma', dignity: 'neutral', nature: 'benefic' }] }),
        house(6, { lord: 'Me' }),
      ],
      planets: [
        planet('Sa', { functional: 'malefic', dignity: 'debilitated' }),
        planet('Me', { functional: 'malefic', owns: [3, 6] }),
        planet('Ma', { functional: 'benefic', dignity: 'own', owns: [1] }),
        planet('Ju', { functional: 'benefic', dignity: 'exalted', owns: [9] }),
      ],
    });
    const t = buildBoard({ view: v, cfg: SELF, asOf: AS_OF, activation: sachinLike, running: runningOn(sachinLike, AS_OF), transit: null }).board.tone;
    expect(t.tone).not.toBe('open');
    expect(t.tone).toBe('demanding');
  });
  it('supports and pressures are plain words with evidence keys; pressures name their release', () => {
    expect(b.board.supports.length).toBeGreaterThan(2);
    expect(b.board.supports.length).toBeLessThanOrEqual(5);
    for (const s of b.board.supports) expect(s.evidence.length).toBeGreaterThan(0);
    const sat = b.board.pressures.find((p) => p.text === 'A heavy influence presses on your peace of mind.')!;
    expect(sat.until).toBe('2031-03-01');
    expect(sat.evidence).toContain('D1.h4 occupant Sa');
  });
  it('windows ahead land in sub-areas by their distinguishing planets; a chapter change is a turning point', () => {
    const subs = new Set(b.board.ahead.map((w) => w.subarea));
    expect(subs.has('growth')).toBe(true);
    expect(subs.has('purpose')).toBe(true);
    const mind = b.board.ahead.find((w) => w.subarea === 'mind')!;
    expect(mind.side).toBe('test');
    expect(mind.from).toBe('2027-06-01');
    const turn = b.board.ahead.find((w) => w.subarea === 'turning_point')!;
    expect(turn.from).toBe('2031-03-01');
    expect(turn.label).toBe('A new chapter that asks more of you');
    const growth = b.board.ahead.filter((w) => w.subarea === 'growth');
    expect(growth[0]!.systems.sort()).toEqual(['vimshottari', 'yogini']); // overlapping windows merge
    expect(growth[0]!.from).toBe(AS_OF);
  });
  it('this year in one line', () => {
    expect(b.board.year).toEqual({ year: 2026, note: SELF.words.year.support });
  });
  it('no chart terms on any first-screen string (doc 45 §3.3), for Self and Love, with and without the sky', () => {
    for (const cfg of [SELF, LOVE]) for (const transit of [null, sky()]) {
      const x = buildBoard(input({ cfg, transit })).board;
      const arcStrings = x.characterArc
        ? [
            x.characterArc.headline,
            x.characterArc.pastDecade.headline,
            x.characterArc.pastDecade.summary,
            x.characterArc.pastDecade.anchorTrait,
            x.characterArc.presentNow.headline,
            x.characterArc.presentNow.summary,
            x.characterArc.presentNow.anchorTrait,
            x.characterArc.nextDecade.headline,
            x.characterArc.nextDecade.summary,
            x.characterArc.nextDecade.anchorTrait,
          ]
        : [];
      const joyStrings = x.personalityAndJoy
        ? [
            x.personalityAndJoy.headline,
            x.personalityAndJoy.personalitySummary,
            x.personalityAndJoy.emotionalMindStyle,
            x.personalityAndJoy.intellectualWitStyle,
            x.personalityAndJoy.rechargeRule,
            ...x.personalityAndJoy.whatFeelsGood.flatMap((it) => [it.title, it.whyItFits]),
          ]
        : [];
      const strings = [
        ...x.supports.map((s) => s.text),
        ...x.pressures.map((p) => p.text),
        ...x.ahead.map((w) => w.label),
        x.year?.note ?? '',
        ...x.back.map((y) => y.label),
        ...arcStrings,
        ...joyStrings,
      ];
      for (const s of strings) expect(s, s).not.toMatch(BANNED);
    }
    for (const cfg of [SELF, LOVE]) for (const [kind, f] of Object.entries(KIND_WORDS)) for (const theme of Object.values(cfg.words.themes)) expect(f(theme), kind).not.toMatch(BANNED);
  });
  it('builds distinct 3-decade character arc and Moon/Mercury personality & joy across ages and empty activations', () => {
    const age30 = buildBoard(input({ ageYears: 30 })).board;
    expect(age30.characterArc?.pastDecade.windowLabel).toBe('Ages 20–30 (2016–2026)');
    expect(age30.characterArc?.presentNow.windowLabel).toBe('Age 30 (2026)');
    expect(age30.characterArc?.nextDecade.windowLabel).toBe('Ages 30–40 (2026–2036)');

    const age7NoAct = buildBoard(input({ activation: [], running: [], ageYears: 7 })).board;
    expect(age7NoAct.characterArc?.pastDecade.windowLabel).toBe('Ages 0–7 (2019–2026)');
    expect(age7NoAct.characterArc?.presentNow.windowLabel).toBe('Age 7 (2026)');
    expect(age7NoAct.characterArc?.nextDecade.windowLabel).toBe('Ages 7–17 (2026–2036)');
    expect(age7NoAct.characterArc?.pastDecade.headline).not.toBe(age7NoAct.characterArc?.presentNow.headline);
    expect(age7NoAct.characterArc?.presentNow.headline).not.toBe(age7NoAct.characterArc?.nextDecade.headline);

    const scorpioAquarius = fakeDigest({
      planets: [
        planet('Mo', { sign: 'Scorpio', house: 8 }),
        planet('Me', { sign: 'Aquarius', house: 11 }),
      ],
    });
    const joyA = buildBoard(input()).board.personalityAndJoy!;
    const joyB = buildBoard(input({ view: scorpioAquarius })).board.personalityAndJoy!;
    expect(joyB.headline).toContain('Private emotional depth');
    expect(joyB.headline).toContain('original, systems-level thinking');
    expect(joyB.headline).not.toBe(joyA.headline);
    expect(joyB.personalitySummary).not.toBe(joyA.personalitySummary);
    expect(joyB.emotionalMindStyle).not.toContain('fiercely loyal, private');
    expect(joyB.intellectualWitStyle).not.toContain('cuts through appearances');

    // Enriched Master-Detail fields on supports and pressures
    const sup0 = age30.supports[0]!;
    expect(sup0.subCategory).toBeTruthy();
    expect(sup0.dateLabel).toBeTruthy();
    expect(sup0.reading).toContain(sup0.text);
    expect(sup0.natalPromise).toBeTruthy();
    expect(sup0.periodCharter).toBeTruthy();
    expect(sup0.techniqueId).toMatch(/^self\.(promise|protection)$/);

    // Plural grammar in KIND_WORDS
    expect(KIND_WORDS.placed_well('your ideas and learning')).toBe('Your ideas and learning have firm footing.');
    expect(KIND_WORDS.placed_hard('your partnerships')).toBe('Your partnerships take more effort than they look.');
    expect(KIND_WORDS.placed_well('friendships')).toBe('Friendships have firm footing.');

    // Love relationship arc & partner chemistry builders vary dynamically across charts
    const loveArc = buildLoveRelationshipArc(view, activation, AS_OF, { ageYears: 46 });
    expect(loveArc.pastDecade.windowLabel).toBe('Ages 36–46 (2016–2026)');
    expect(loveArc.presentNow.windowLabel).toBe('Age 46 (2026)');
    expect(loveArc.nextDecade.windowLabel).toBe('Ages 46–56 (2026–2036)');
    expect(loveArc.pastDecade.headline).not.toBe(loveArc.presentNow.headline);
    const loveChemA = buildLoveBondingAndChemistry(view);
    const loveChemB = buildLoveBondingAndChemistry(scorpioAquarius);
    expect(loveChemA.whatFeelsGood.length).toBeGreaterThanOrEqual(4);
    expect(loveChemB.headline).not.toBe(loveChemA.headline);
    expect(loveChemB.personalitySummary).not.toBe(loveChemA.personalitySummary);
  });
  it('Looking back picks edges of the last 12 months, both directions, at most three', () => {
    const past = [
      act({ level: 1, lord: 'Sa', from: '2012-01-01', to: '2031-01-01' }),
      act({ level: 2, lord: 'Me', from: '2025-02-01', to: '2025-08-01' }),
      act({ level: 2, lord: 'Ju', from: '2025-08-01', to: '2027-01-01' }),
      act({ system: 'narayana', family: 'rasi', level: 1, sign: 'Ar', from: '2025-01-01', to: '2027-01-01' }),
      act({ system: 'narayana', family: 'rasi', level: 1, sign: 'Ge', from: '2024-01-01', to: '2025-01-01' }),
    ];
    const v = fakeDigest({
      houses: [house(1, { lord: 'Ma', sign: 'Ar' }), house(3, { lord: 'Me', sign: 'Ge' }), house(6, { lord: 'Me' })],
      planets: [planet('Ma', { functional: 'benefic', dignity: 'own', owns: [1] }), planet('Ju', { functional: 'benefic', dignity: 'own', owns: [9] }), planet('Me', { functional: 'malefic', dignity: 'debilitated', owns: [3, 6] }), planet('Sa', { functional: 'malefic', owns: [6] })],
    });
    const back = buildBoard({ view: v, cfg: SELF, asOf: '2026-01-10', activation: past, running: [], transit: null }).board.back;
    expect(back.length).toBeGreaterThan(0);
    expect(back.length).toBeLessThanOrEqual(3);
    expect(back.some((x) => x.side === 'support' && x.month === '2025-08')).toBe(true);
    expect(back.every((x) => x.label === SELF.words.back[x.side])).toBe(true);
  });
});

describe('Node computes nothing astrological (AGENTS.md)', () => {
  it('the board code does no sign or house arithmetic', () => {
    for (const f of ['houseLayers.ts', 'self.ts', 'love.ts', 'boardService.ts', 'selfService.ts', 'loveService.ts', 'selfCharacterAndJoy.ts']) {
      const src = fs.readFileSync(path.resolve(__dirname, '../../../../src/reading/area', f), 'utf8');
      expect(src, f).not.toMatch(/%\s*12|\+\s*6\)|-\s*1\)\s*%|\bsignIndex\b|sign_index\s*[+-]|longitude\s*[+-/]|degree\s*[+-/]/);
    }
  });
  it('never names the engine in a string', () => {
    for (const f of ['houseLayers.ts', 'self.ts', 'love.ts', 'boardService.ts', 'selfCharacterAndJoy.ts']) {
      const src = fs.readFileSync(path.resolve(__dirname, '../../../../src/reading/area', f), 'utf8');
      expect(src, f).not.toMatch(/radha|pyjhora|jhora/i);
    }
  });
});
