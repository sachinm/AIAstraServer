import { describe, expect, it } from 'vitest';
import { LIFE_AREAS, lifeArea } from '../../../../src/reading/life/areas.js';
import { buildMahadashaCharter, selectCharterMahadasha } from '../../../../src/reading/life/charter.js';
import { promiseScale } from '../../../../src/reading/life/promise.js';
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
});
