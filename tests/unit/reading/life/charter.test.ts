import { describe, expect, it } from 'vitest';
import { buildActivationRows } from '../../../../src/reading/digest/activation.js';
import { buildDigestRows } from '../../../../src/reading/digest/build.js';
import { digestView } from '../../../../src/reading/digest/load.js';
import { LIFE_AREAS, lifeArea } from '../../../../src/reading/life/areas.js';
import { buildMahadashaCharter, selectCharterMahadasha } from '../../../../src/reading/life/charter.js';
import { promiseScale } from '../../../../src/reading/life/promise.js';
import { loadFixture } from '../digest/helpers.js';
import { annualRow, makeView, row } from './fixture.js';

const today = '2026-11-05';

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

describe('life.mahadasha_charter (doc 55)', () => {
  it('charts the running Mahadasha directly when it has >= 10 years remaining (14 yrs left), with 9x9 fruition, multi-dasha, annual TP/VP, and sky confirmation', () => {
    const view = makeView({
      tone: 'strong',
      planets: {
        D1: {
          Ju: {
            house: 10,
            owns: [10, 2],
            dispositor: 'Sa',
            starLord: 'Me',
            avasthas: { baladi: 'Yuva', deeptadi: 'Shanta' },
            dashaCharter: {
              housesOwned: [10, 2],
              housesCoOwned: [],
              coLordPartner: null,
              rasiDrishtiHouses: [2, 6],
              grahaDrishtiHouses: [2, 4, 6],
              arudhasInSign: ['AL'],
              dispositorHouse: 10,
              dispositorDignity: 'own',
              starLordHouse: 2,
              starLordDignity: 'exalted',
              starLordArudhas: [],
              isYogi: true,
              isAvayogi: false,
              isSahayogi: false,
              fruition: {
                Ju: {
                  houseFromMd: 1,
                  houseFromLagna: 10,
                  fruitionClass: 'trikona_manifestation',
                  isStarLordOfMd: false,
                  isSignDispositorOfMd: false,
                  isCoLordPartnerOfMd: false,
                  isShadAshtaka68: false,
                  isDwirdwadasha212: false,
                },
                Sa: {
                  houseFromMd: 1,
                  houseFromLagna: 10,
                  fruitionClass: 'kendra_structural',
                  isStarLordOfMd: false,
                  isSignDispositorOfMd: true,
                  isCoLordPartnerOfMd: false,
                  isShadAshtaka68: false,
                  isDwirdwadasha212: false,
                },
                Me: {
                  houseFromMd: 5,
                  houseFromLagna: 2,
                  fruitionClass: 'trikona_manifestation',
                  isStarLordOfMd: true,
                  isSignDispositorOfMd: false,
                  isCoLordPartnerOfMd: false,
                  isShadAshtaka68: false,
                  isDwirdwadasha212: false,
                },
                Ra: {
                  houseFromMd: 8,
                  houseFromLagna: 5,
                  fruitionClass: 'dusthana_reversal_crisis',
                  isStarLordOfMd: false,
                  isSignDispositorOfMd: false,
                  isCoLordPartnerOfMd: false,
                  isShadAshtaka68: true,
                  isDwirdwadasha212: false,
                },
              },
            },
          },
          Ra: {
            functional: 'malefic',
            dignity: 'debilitated',
            house: 8,
            owns: [6],
          },
        },
      },
      annual: {
        2027: [annualRow('TP', 2027, 10, 'strong'), annualRow('VP', 2027, 10, 'strong')],
        2030: [annualRow('TP', 2030, 2, 'strong')],
      },
    });

    const rows = [
      // Level 1: 16-year Jupiter Mahadasha with ~14.2 years left
      row('vimshottari', 'vimshottari', '2025-01-01', '2041-01-01', [10, 2], 'Ju', { level: 1, parentLord: null }),
      // Level 2 Antardashas across the 14 years ahead
      row('vimshottari', 'vimshottari', '2025-01-01', '2027-02-19', [10, 2], 'Ju', { parentLord: 'Ju' }),
      row('vimshottari', 'vimshottari', '2027-02-19', '2029-09-01', [10, 11], 'Sa', { parentLord: 'Ju' }),
      row('vimshottari', 'vimshottari', '2029-09-01', '2031-12-07', [2, 10], 'Me', { parentLord: 'Ju' }),
      row('vimshottari', 'vimshottari', '2031-12-07', '2034-05-01', [6, 8, 10], 'Ra', { parentLord: 'Ju' }),
      // Secondary dasha systems confirming
      row('dwisaptati', 'conditional', '2026-06-01', '2028-06-01', [10, 2], 'Sa'),
      row('narayana', 'rasi', '2027-01-01', '2030-01-01', [10, 2], null, { sign: 'Sign10' }),
      row('yogini', 'yogini', '2029-06-01', '2032-01-01', [2, 10], 'Me'),
    ];

    const sky = {
      from: '2026-01-01',
      to: '2028-12-31',
      gates: [{ from: '2026-10-01', to: '2027-11-01', houses: [10, 2] }],
      slow: [],
    };

    const areaInputs = LIFE_AREAS.map((area) => ({
      area,
      promise: promiseScale(view, area, { today, running: rows.filter((r) => r.from <= today && r.to > today), annual: [], sky }),
    }));

    const charter = buildMahadashaCharter(view, areaInputs, {
      today,
      rows,
      annual: (y) => view.annual(y),
      sky,
    })!;

    expect(charter).not.toBeNull();
    expect(charter.is_current).toBe(true);
    expect(charter.bridge).toBeNull();
    expect(charter.remaining_years).toBeGreaterThanOrEqual(14);
    expect(charter.total_years).toBeCloseTo(16, 0);
    expect(charter.evidence.md).toBe('Jupiter');
    expect(charter.evidence.own_houses).toEqual([2, 10]);

    // Area charters include work and money as anchor areas
    const workCharter = charter.area_charters.find((a) => a.id === 'work')!;
    expect(workCharter).toBeDefined();
    expect(workCharter.role).toBe('anchor');
    expect(workCharter.verdict).toBe('promised');
    expect(workCharter.evidence.vargas).toEqual(['D1', 'D9', 'D10']);
    expect(workCharter.peak_from).toBeTruthy();

    // Antardasha timeline has all 4 sub-periods in chronological order
    expect(charter.antardashas).toHaveLength(4);
    expect(charter.antardashas[0]!.is_current).toBe(true);
    expect(charter.antardashas[0]!.from).toBe(today);
    expect(charter.antardashas[0]!.to).toBe('2027-02-19');
    expect(charter.antardashas[0]!.tone).toBe('breakthrough');
    expect(charter.antardashas[0]!.evidence).toMatchObject({
      md: 'Jupiter',
      ad: 'Jupiter',
      house_from_md: 1,
      fruition_class: 'trikona_manifestation',
    });
    expect(charter.antardashas[0]!.evidence.systems).toEqual(expect.arrayContaining(['Vimshottari', 'Dwisaptati', 'Narayana']));
    expect(charter.antardashas[0]!.evidence.annual_years).toEqual(expect.arrayContaining(['TP2027', 'VP2027']));
    expect(charter.antardashas[0]!.evidence.transit_houses).toContain(10);

    // The 4th Antardasha (Rahu in 8th from MD -> dusthana_reversal_crisis / shad_ashtaka_6_8) is marked careful
    const raAd = charter.antardashas[3]!;
    expect(raAd.tone).toBe('careful');
    expect(raAd.evidence.ad).toBe('Rahu');
    expect(raAd.evidence.fruition_class).toBe('dusthana_reversal_crisis');
    expect(raAd.evidence.links).toContain('shad_ashtaka_6_8');

    // Every visible prose string is free of banned terms
    const visible: string[] = [
      charter.headline,
      charter.charter_summary,
      ...charter.area_charters.flatMap((ac) => [ac.label, ac.theme, ac.promise_note, ac.guidance, ac.basis]),
      ...charter.antardashas.flatMap((ad) => [ad.headline, ad.basis, ...ad.areas.flatMap((n) => [n.label, n.summary, n.timing, n.action])]),
    ];
    for (const s of visible) expect(s, s).not.toMatch(BANNED_RE);
  });

  it('selects the upcoming 18-year Mahadasha when the running Mahadasha has < 10 years left, and keeps the running Mahadasha as a bridge', () => {
    const view = makeView({ tone: 'strong' });
    const rows = [
      // Running Mars MD with only 2.2 years left
      row('vimshottari', 'vimshottari', '2022-01-01', '2029-01-01', [1, 8], 'Ma', { level: 1, parentLord: null }),
      row('vimshottari', 'vimshottari', '2026-01-01', '2027-06-01', [1, 10], 'Ju', { parentLord: 'Ma' }),
      row('vimshottari', 'vimshottari', '2027-06-01', '2029-01-01', [1, 2], 'Sa', { parentLord: 'Ma' }),
      // Upcoming 18-year Rahu MD (2029–2047)
      row('vimshottari', 'vimshottari', '2029-01-01', '2047-01-01', [10, 11], 'Ra', { level: 1, parentLord: null }),
      row('vimshottari', 'vimshottari', '2029-01-01', '2031-09-14', [10, 11], 'Ra', { parentLord: 'Ra' }),
      row('vimshottari', 'vimshottari', '2031-09-14', '2034-02-07', [10, 2, 9], 'Ju', { parentLord: 'Ra' }),
    ];

    const sel = selectCharterMahadasha(rows, today)!;
    expect(sel.primary.lord).toBe('Ra');
    expect(sel.primary.remainingYears).toBeCloseTo(18, 0);
    expect(sel.bridge?.lord).toBe('Ma');

    const areaInputs = LIFE_AREAS.map((area) => ({
      area,
      promise: promiseScale(view, area, { today, running: [], annual: [], sky: null }),
    }));

    const charter = buildMahadashaCharter(view, areaInputs, { today, rows, annual: () => [], sky: null })!;
    expect(charter.is_current).toBe(false);
    expect(charter.from).toBe('2029-01-01');
    expect(charter.to).toBe('2047-01-01');
    expect(charter.remaining_years).toBeCloseTo(18, 0);
    expect(charter.antardashas).toHaveLength(2);
    expect(charter.bridge).not.toBeNull();
    expect(charter.bridge!.from).toBe(today);
    expect(charter.bridge!.to).toBe('2029-01-01');
    expect(charter.bridge!.antardashas).toHaveLength(2);
    expect(charter.bridge!.summary).not.toMatch(BANNED_RE);
  });

  it('steps down periodSide in promiseScale when dashaCharter marks the Antardasha lord in 6/8/12 from the Mahadasha lord', () => {
    const view = makeView({
      tone: 'strong',
      planets: {
        D1: {
          Ju: {
            dashaCharter: {
              housesOwned: [9, 12],
              housesCoOwned: [],
              coLordPartner: null,
              rasiDrishtiHouses: [],
              grahaDrishtiHouses: [],
              arudhasInSign: [],
              dispositorHouse: 1,
              dispositorDignity: 'own',
              starLordHouse: 1,
              starLordDignity: 'own',
              starLordArudhas: [],
              isYogi: false,
              isAvayogi: false,
              isSahayogi: false,
              fruition: {
                Sa: {
                  houseFromMd: 8,
                  houseFromLagna: 4,
                  fruitionClass: 'dusthana_reversal_crisis',
                  isStarLordOfMd: false,
                  isSignDispositorOfMd: false,
                  isCoLordPartnerOfMd: false,
                  isShadAshtaka68: true,
                  isDwirdwadasha212: false,
                },
              },
            },
          },
        },
      },
    });

    const p = promiseScale(view, lifeArea('work'), {
      today,
      running: [row('vimshottari', 'vimshottari', '2026-01-01', '2027-01-01', [10], 'Sa', { parentLord: 'Ju' })],
      annual: [],
      sky: null,
    });
    const dashaLine = p.lines.find((l) => l.fact.startsWith('activation:vimshottari'))!;
    expect(dashaLine.side).toBe('neutral'); // stepped down from support because Sa is 8th from Ju
  });

  it('builds a coherent 19-year Saturn Mahadasha charter + 5.2-year Jupiter bridge on the real research kundli fixture', () => {
    const asOf = '2026-11-06';
    const fx = loadFixture();
    const digestRows = buildDigestRows(fx.items, { kundliId: 'fixture-a', calcVersions: fx.calcVersions });
    const view = digestView('fixture-a', digestRows);
    const act = buildActivationRows(fx.items, digestRows, { today: asOf });
    const running = act.filter((r) => r.from <= asOf && r.to > asOf);
    const areaInputs = LIFE_AREAS.map((area) => ({
      area,
      promise: promiseScale(view, area, { today: asOf, running, annual: view.annual(2026), sky: null }),
    }));

    const charter = buildMahadashaCharter(view, areaInputs, {
      today: asOf,
      rows: act.filter((r) => r.level <= 2),
      annual: (y) => view.annual(y),
      sky: null,
    })!;

    expect(charter).not.toBeNull();
    // Primary charter is the upcoming 19-year Saturn Mahadasha (2032–2051)
    expect(charter.is_current).toBe(false);
    expect(charter.from).toBe('2032-01-18');
    expect(charter.to).toBe('2051-01-18');
    expect(charter.remaining_years).toBe(19);
    expect(charter.evidence.md).toBe('Saturn');
    expect(charter.antardashas).toHaveLength(9);

    // Bridge covers the remaining 5.2 years of the running Jupiter Mahadasha (2026–2032)
    expect(charter.bridge).not.toBeNull();
    expect(charter.bridge!.from).toBe(asOf);
    expect(charter.bridge!.to).toBe('2032-01-18');
    expect(charter.bridge!.remaining_years).toBeCloseTo(5.2, 1);
    expect(charter.bridge!.antardashas).toHaveLength(4);

    // Sa-Sa (house_from_md = 1, trikona_manifestation, star_lord_of_md) is marked 'build' (not forced to 'careful')
    const saSa = charter.antardashas[0]!;
    expect(saSa.evidence.ad).toBe('Saturn');
    expect(saSa.evidence.fruition_class).toBe('trikona_manifestation');
    expect(saSa.tone).toBe('build');
    expect(saSa.evidence.systems).toContain('Vimshottari');

    // Sa-Ve (house_from_md = 2, dwirdwadasha_2_12 without MD link, functional malefic Ve) is marked 'careful'
    const saVe = charter.antardashas.find((ad) => ad.evidence.ad === 'Venus')!;
    expect(saVe).toBeDefined();
    expect(saVe.evidence.links).toContain('dwirdwadasha_2_12');
    expect(saVe.tone).toBe('careful');

    // Different Antardashas highlight distinct activated areas rather than repeating the exact same 3 areas
    const topSets = new Set(charter.antardashas.map((ad) => ad.areas.map((a) => a.id).join(',')));
    expect(topSets.size).toBeGreaterThanOrEqual(6);

    // Promised area charters never claim "partial chart backing" in basis
    for (const ac of charter.area_charters) {
      if (ac.verdict === 'promised') {
        expect(ac.basis).not.toContain('partial chart backing');
      }
    }

    // Every visible prose string across primary charter and bridge passes BANNED_RE and avoids unclosed ", along with" splices
    const visible: string[] = [
      charter.headline,
      charter.charter_summary,
      ...charter.area_charters.flatMap((ac) => [ac.label, ac.theme, ac.promise_note, ac.guidance, ac.basis]),
      ...charter.antardashas.flatMap((ad) => [ad.headline, ad.basis, ...ad.areas.flatMap((n) => [n.label, n.summary, n.timing, n.action])]),
      charter.bridge!.summary,
      ...charter.bridge!.antardashas.flatMap((ad) => [ad.headline, ad.basis, ...ad.areas.flatMap((n) => [n.label, n.summary, n.timing, n.action])]),
    ];
    for (const s of visible) {
      expect(s, s).not.toMatch(BANNED_RE);
      expect(s, s).not.toContain(', along with ');
    }
  });

  it('does not skip an immediately upcoming 16-year Mahadasha in favor of a 19-year Mahadasha starting 18 years later, and bridges intervening short chapters cleanly', () => {
    const rows = [
      // Running Rahu MD with 2 years left (2026–2028)
      row('vimshottari', 'vimshottari', '2010-01-01', '2028-11-05', [10], 'Ra', { level: 1, parentLord: null }),
      // Immediately next: 16-year Jupiter MD (2028–2044)
      row('vimshottari', 'vimshottari', '2028-11-05', '2044-11-05', [1, 4], 'Ju', { level: 1, parentLord: null }),
      // 18 years in the future: 19-year Saturn MD (2044–2063)
      row('vimshottari', 'vimshottari', '2044-11-05', '2063-11-05', [2], 'Sa', { level: 1, parentLord: null }),
    ];

    const sel = selectCharterMahadasha(rows, today)!;
    expect(sel.primary.lord).toBe('Ju');
    expect(sel.primary.from).toBe('2028-11-05');
    expect(sel.bridge?.lord).toBe('Ra');
    expect(sel.bridge?.to).toBe('2028-11-05');

    // When a short 6-year Sun MD sits between 1.5-year Venus MD and 10-year Moon MD, bridge covers both up to Moon MD
    const shortGapRows = [
      row('vimshottari', 'vimshottari', '2008-05-05', '2028-05-05', [2, 7], 'Ve', { level: 1, parentLord: null }),
      row('vimshottari', 'vimshottari', '2026-05-05', '2028-05-05', [2, 7], 'Ke', { parentLord: 'Ve' }),
      row('vimshottari', 'vimshottari', '2028-05-05', '2034-05-05', [9], 'Su', { level: 1, parentLord: null }),
      row('vimshottari', 'vimshottari', '2028-05-05', '2034-05-05', [9], 'Su', { parentLord: 'Su' }),
      row('vimshottari', 'vimshottari', '2034-05-05', '2044-05-05', [4], 'Mo', { level: 1, parentLord: null }),
      row('vimshottari', 'vimshottari', '2034-05-05', '2044-05-05', [4], 'Mo', { parentLord: 'Mo' }),
    ];
    const selGap = selectCharterMahadasha(shortGapRows, today)!;
    expect(selGap.primary.lord).toBe('Mo');
    expect(selGap.primary.from).toBe('2034-05-05');
    expect(selGap.bridge?.to).toBe('2034-05-05');
    expect(selGap.bridgeMds.map((m) => m.lord)).toEqual(['Ve', 'Su']);
  });
});
