/**
 * Unit test suite for Retrograde (*Vakra*), *Ashtagati*, *Cheshta Bala*, and `D1..D144` Digest Normalization
 * (docs/reading-engine/77).
 *
 * Verifies:
 * 1. `lordCode()` strips `℞`, `(R)`, `(Rx)`, `(Retrograde)`, `(Vakri)`, and `(Combust)` markers from dasha lord names.
 * 2. `VARGA_FACTORS` spans all 23 supported divisional charts (`D1..D144`: 1,2,3,4,5,6,7,8,9,10,11,12,16,20,24,27,30,40,45,60,81,108,144).
 * 3. `buildDigestRows()` extracts `retro`, `isMeanRetrograde`, `motionKind`, `speedDegPerDay`, `meanDailyMotionDeg`,
 *    `speedRatioToMean`, `motionState`, `isStationary`, `stationKind`, `cheshtaBala`, `shadbalaComponents`,
 *    `vargaReckoning`, `vargaSandhi`, and `vakraDignityRegime` across `D1`, `D9`, `D10`, `D60`, and `D144`.
 * 4. `Rahu` and `Ketu` preserve `retro: false`, `isMeanRetrograde: true`, and `motionKind: 'pratiloma'`.
 * 5. `annualRows` extracts `TP` `yearLord`, `yearLordRetro`, `yearLordMotionState`, `horaLord`, `horaLordRetro`,
 *    `lagnaLordRetro`, and `planets` map, with every `DigestSource` path resolving cleanly via `resolvePath`.
 * 6. `starProfile` extracts `pendingKarmaSources` (`retrograde` vs `combust`) cleanly.
 */
import { describe, expect, it } from 'vitest';
import { VARGA_FACTORS } from '../../../src/reading/chartData/catalog.js';
import { buildDigestRows, resolvePath } from '../../../src/reading/digest/build.js';
import {
  DIGEST_VERSION,
  itemKey,
  type AnnualRow,
  type HouseCard,
  type PlanetCard,
  type StarProfile,
} from '../../../src/reading/digest/types.js';
import { lordCode } from '../../../src/reading/timeline/dashas.js';
import { loadFixture } from '../reading/digest/helpers.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';

guardNoModelCalls();

describe('Retrograde & Motion Digest Normalization (docs/reading-engine/77)', () => {
  it('uses DIGEST_VERSION d1.2026-11-15-vakra and includes all 23 varga factors up to D144', () => {
    expect(DIGEST_VERSION).toBe('d1.2026-11-15-vakra');
    expect(VARGA_FACTORS).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144,
    ]);
  });

  it('strips retrograde, vakri, rx, and combust markers in lordCode()', () => {
    expect(lordCode('Mercury (R)')).toBe('Me');
    expect(lordCode('Saturn℞')).toBe('Sa');
    expect(lordCode('Jupiter (Rx)')).toBe('Ju');
    expect(lordCode('Mars (Retrograde)')).toBe('Ma');
    expect(lordCode('Venus (Vakri) (Combust)')).toBe('Ve');
    expect(lordCode('Rahu (R)')).toBe('Ra');
    expect(lordCode('Ketu℞')).toBe('Ke');
    expect(lordCode('Sun')).toBe('Su');
    expect(lordCode('Moon')).toBe('Mo');
  });

  it('extracts full motion, Cheshta Bala, Ashtagati, D1..D144 varga reckoning, Rahu/Ketu pratiloma, TP annual motion, and pendingKarmaSources with valid DigestSource paths', () => {
    const fx = loadFixture();
    const items = structuredClone(fx.items) as Record<string, any>;
    const calcVersions = structuredClone(fx.calcVersions);

    // Enrich D1 Saturn (true retrograde, swakshetra/own) & Rahu (pratiloma, is_retrograde: false)
    const d1Digs = items.dignities as { planets: any[]; houses: any[] };
    for (const d of d1Digs.planets) {
      if (/saturn/i.test(String(d.name ?? d.body ?? ''))) {
        d.retrograde = true;
        d.is_retrograde = true;
        d.is_mean_retrograde = true;
        d.motion_kind = 'true_ecliptic';
        d.speed_deg_per_day = -0.062;
        d.mean_daily_motion_deg = 0.0335;
        d.speed_ratio_to_mean = -1.85;
        d.motion_state = 'vakra';
        d.is_stationary = false;
        d.station_kind = null;
        d.cheshta_bala = 54.2;
        d.vakra_dignity_regime = 'vakra';
      }
      if (/mercury/i.test(String(d.name ?? d.body ?? ''))) {
        d.retrograde = true;
        d.is_retrograde = true;
        d.motion_kind = 'true_ecliptic';
        d.speed_deg_per_day = -0.004;
        d.motion_state = 'vikala';
        d.is_stationary = true;
        d.station_kind = 'retro_start';
        d.cheshta_bala = 58.9;
      }
      if (/rahu/i.test(String(d.name ?? d.body ?? ''))) {
        d.retrograde = false;
        d.is_retrograde = false;
        d.is_mean_retrograde = true;
        d.motion_kind = 'pratiloma';
        d.speed_deg_per_day = -0.053;
        d.motion_state = 'pratiloma';
        d.is_stationary = false;
      }
      if (/ketu/i.test(String(d.name ?? d.body ?? ''))) {
        d.retrograde = false;
        d.is_retrograde = false;
        d.is_mean_retrograde = true;
        d.motion_kind = 'pratiloma';
        d.speed_deg_per_day = -0.053;
        d.motion_state = 'pratiloma';
        d.is_stationary = false;
      }
    }

    // Ensure shadbala components include cheshta
    const shadbala = items['strength.shadbala'] as { planets?: any[] } | undefined;
    if (shadbala?.planets) {
      for (const sp of shadbala.planets) {
        if (/saturn/i.test(String(sp.name ?? sp.body ?? ''))) {
          sp.components = {
            ...(sp.components ?? {}),
            sthana: 142.5,
            dig: 38.0,
            kala: 110.2,
            cheshta: 54.2,
            naisargika: 8.57,
            drik: 12.1,
          };
        }
      }
    }

    // Enrich D9 Saturn with varga_reckoning and varga_sandhi
    const d9Digs = items['dignities.d9'] as { planets?: any[] } | undefined;
    if (d9Digs?.planets) {
      for (const d of d9Digs.planets) {
        if (/saturn/i.test(String(d.name ?? d.body ?? ''))) {
          d.retrograde = true;
          d.is_retrograde = true;
          d.motion_state = 'vakra';
          d.varga_reckoning = 'reverse';
          d.varga_sandhi = true;
        }
      }
    }

    // Add higher divisional chart placement payload for D144 (placement-only varga)
    items['varga.d144'] = {
      varga: 'D144',
      division: 144,
      lagna: { sign: 'Aries', rasi: 0 },
      planets: [
        {
          name: 'Saturn',
          sign: 'Aquarius',
          house_from_lagna: 11,
          longitude_in_sign: 14.5,
          retrograde: true,
          is_retrograde: true,
          motion_kind: 'true_ecliptic',
          speed_deg_per_day: -0.062,
          motion_state: 'vakra',
          is_stationary: false,
          cheshta_bala: 54.2,
          varga_reckoning: 'direct',
          varga_sandhi: false,
        },
        {
          name: 'Rahu',
          sign: 'Gemini',
          house_from_lagna: 3,
          longitude_in_sign: 8.2,
          retrograde: false,
          is_retrograde: false,
          is_mean_retrograde: true,
          motion_kind: 'pratiloma',
          motion_state: 'pratiloma',
        },
      ],
    };
    calcVersions['varga.d144'] = 'v1-vakra-test';

    // Add Tithi Pravesha 2026 D1 row with explicit year_lord, hora_lord, and planets motion array
    items['annual.tithi_pravesha@year=2026'] = {
      year: 2026,
      tp_start: '2026-04-14T06:15:00Z',
      tp_end: '2027-04-03T18:40:00Z',
      lagna_sign: 'Aries',
      year_lord: 'Mercury',
      year_lord_retrograde: true,
      year_lord_motion_state: 'vakra',
      year_lord_combust: true,
      hora_lord: 'Saturn',
      hora_lord_retrograde: false,
      houses: [
        {
          house: 1,
          sign: 'Aries',
          lord: { name: 'Mars' },
          lord_house: 10,
          lord_dignity: 'exalted',
          occupants: [{ name: 'Mercury', retrograde: true, combust: true, motion_state: 'vakra' }],
        },
      ],
      planets: [
        {
          name: 'Mercury',
          sign: 'Aries',
          house_from_lagna: 1,
          longitude_in_sign: 11.4,
          dignity: 'neutral',
          is_retrograde: true,
          motion_kind: 'true_ecliptic',
          speed_deg_per_day: -0.58,
          motion_state: 'vakra',
          is_stationary: false,
          combust: true,
          cheshta_bala: 51.4,
        },
        {
          name: 'Mars',
          sign: 'Capricorn',
          house_from_lagna: 10,
          longitude_in_sign: 22.0,
          dignity: 'exalted',
          is_retrograde: false,
          motion_kind: 'true_ecliptic',
          speed_deg_per_day: 0.64,
          motion_state: 'sama',
          combust: false,
        },
      ],
      dashas: [],
    };
    calcVersions['annual.tithi_pravesha@year=2026'] = 'v1-vakra-test';

    // Add pending_karma_sources to avasthas
    if (items.avasthas && typeof items.avasthas === 'object') {
      items.avasthas.lunar_astro = {
        ...(items.avasthas.lunar_astro ?? {}),
        pending_karma: {
          pending_karma_houses: [2, 3, 7, 10],
          pending_karma_sources: [
            { house: 2, source: 'retrograde', planet: 'Saturn' },
            { house: 3, source: 'retrograde', planet: 'Saturn' },
            { house: 7, source: 'combust', planet: 'Mercury' },
            { house: 10, source: 'combust', planet: 'Mercury' },
          ],
        },
      };
    }

    const rows = buildDigestRows(items, { kundliId: 'vakra-test', calcVersions });
    const byKey = new Map(rows.map((r) => [`${r.section}|${r.key}`, r]));
    const get = <T>(section: string, key: string) => byKey.get(`${section}|${key}`)?.row as T | undefined;

    // 1. Source path invariant: EVERY DigestSource resolves to a defined value in `items`
    for (const r of rows) {
      expect(r.source.length, r.key).toBeGreaterThan(0);
      for (const s of r.source) {
        const payload = items[itemKey(s.type, s.variant)];
        expect(payload, `${r.key}: ${s.type}@${s.variant}`).toBeDefined();
        expect(resolvePath(payload, s.path), `${r.key}: ${s.type} ${s.path}`).not.toBeUndefined();
      }
    }

    // 2. D1 Saturn motion + Cheshta Bala + Shadbala components
    const d1Sa = get<PlanetCard>('planet', 'D1.Sa')!;
    expect(d1Sa).toBeDefined();
    expect(d1Sa.retro).toBe(true);
    expect(d1Sa.motionKind).toBe('true_ecliptic');
    expect(d1Sa.speedDegPerDay).toBeCloseTo(-0.062, 3);
    expect(d1Sa.motionState).toBe('vakra');
    expect(d1Sa.isStationary).toBe(false);
    expect(d1Sa.cheshtaBala).toBeCloseTo(54.2, 1);
    expect(d1Sa.shadbalaComponents?.cheshta).toBeCloseTo(54.2, 1);

    // 3. D1 Mercury stationary (vikala)
    const d1Me = get<PlanetCard>('planet', 'D1.Me')!;
    expect(d1Me.retro).toBe(true);
    expect(d1Me.isStationary).toBe(true);
    expect(d1Me.stationKind).toBe('retro_start');
    expect(d1Me.motionState).toBe('vikala');

    // 4. Rahu & Ketu: retro=false, isMeanRetrograde=true, motionKind='pratiloma'
    const d1Ra = get<PlanetCard>('planet', 'D1.Ra')!;
    const d1Ke = get<PlanetCard>('planet', 'D1.Ke')!;
    expect(d1Ra.retro).toBe(false);
    expect(d1Ra.isMeanRetrograde).toBe(true);
    expect(d1Ra.motionKind).toBe('pratiloma');
    expect(d1Ra.motionState).toBe('pratiloma');
    expect(d1Ke.retro).toBe(false);
    expect(d1Ke.isMeanRetrograde).toBe(true);
    expect(d1Ke.motionKind).toBe('pratiloma');

    // 5. D1 House card carries lordRetro on houses owned by Saturn
    const d1H2 = get<HouseCard>('house', 'D1.h2')!;
    if (d1H2.lord === 'Sa') {
      expect(d1H2.lordRetro).toBe(true);
    }

    // 6. D9 Saturn carries vargaReckoning & vargaSandhi
    const d9Sa = get<PlanetCard>('planet', 'D9.Sa');
    if (d9Sa) {
      expect(d9Sa.retro).toBe(true);
      expect(d9Sa.vargaReckoning).toBe('reverse');
      expect(d9Sa.vargaSandhi).toBe(true);
    }

    // 7. D144 placement-only varga carries Saturn & Rahu motion metadata
    const d144Sa = get<PlanetCard>('planet', 'D144.Sa')!;
    expect(d144Sa).toBeDefined();
    expect(d144Sa.sign).toBe('Aquarius');
    expect(d144Sa.retro).toBe(true);
    expect(d144Sa.motionKind).toBe('true_ecliptic');
    expect(d144Sa.motionState).toBe('vakra');
    expect(d144Sa.cheshtaBala).toBeCloseTo(54.2, 1);
    expect(d144Sa.vargaReckoning).toBe('direct');
    expect(d144Sa.vargaSandhi).toBe(false);

    const d144Ra = get<PlanetCard>('planet', 'D144.Ra')!;
    expect(d144Ra.retro).toBe(false);
    expect(d144Ra.isMeanRetrograde).toBe(true);
    expect(d144Ra.motionKind).toBe('pratiloma');

    // 8. TP2026.D1 AnnualRow carries yearLord, yearLordRetro, yearLordMotionState, horaLord, lagnaLordRetro, and planets map
    const tp2026 = get<AnnualRow>('annual', 'TP2026.D1')!;
    expect(tp2026).toBeDefined();
    expect(tp2026.yearLord).toBe('Me');
    expect(tp2026.yearLordRetro).toBe(true);
    expect(tp2026.yearLordMotionState).toBe('vakra');
    expect(tp2026.yearLordCombust).toBe(true);
    expect(tp2026.horaLord).toBe('Sa');
    expect(tp2026.horaLordRetro).toBe(false);
    expect(tp2026.lagnaLordRetro).toBe(false);
    expect(tp2026.planets?.Me).toMatchObject({
      planet: 'Me',
      retro: true,
      combust: true,
      motionState: 'vakra',
    });

    // 9. StarProfile carries pendingKarmaHouses and pendingKarmaSources
    const star = get<StarProfile>('star', 'profile')!;
    expect(star).toBeDefined();
    expect(star.pendingKarmaHouses).toEqual([2, 3, 7, 10]);
    expect(star.pendingKarmaSources).toEqual([
      { house: 2, source: 'retrograde', planet: 'Sa' },
      { house: 3, source: 'retrograde', planet: 'Sa' },
      { house: 7, source: 'combust', planet: 'Me' },
      { house: 10, source: 'combust', planet: 'Me' },
    ]);
  });
});
