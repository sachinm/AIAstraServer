/**
 * Unit test suite for Retrograde (*Vakra Graha*) Classical Rules, D1+D9 Mutual Confirmation,
 * Active 40+ Dasha & Tithi Pravesha Operating Posture, and Calendar Station Labels (docs/reading-engine/77).
 *
 * Verifies:
 * 1. All 5 true-retrograde planets (`Ma`, `Me`, `Ju`, `Ve`, `Sa`) have plain-English playbooks free of Sanskrit/chart
 *    jargon and free of internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`).
 * 2. `evaluateVakraDignityRegime()` and `evaluateD1D9MutualConfirmation()` under both `nuanced_parashari` (default)
 *    and `uttara_kalamrita_strict` models:
 *    - Debilitated D1 + redeemed D9 (`neecha_vakra`) uplift
 *    - Exalted D1 (`uccha_vakra`) non-linear second-pass moderation vs `uttara_kalamrita_strict` reversal
 *    - Own-sign retrograde (`swakshetra_vakra`) reinforcement
 *    - Stationary (`isStationary: true` / `vikala`) turning-point intensity
 *    - Direct planets (`retro: false`, `isStationary: false`) retain exact baseline `scoreAdjustment` and `verdict`
 *    - `Rahu` and `Ketu` are never treated as true-vakra planets (`isTrueVakraCapable === false`).
 * 3. CRITICAL INVARIANT: *Neecha Vargottama* (debilitated in both D1 and D9) + `retro: true` NEVER gets inverted into
 *    positive strength under either dignity model (`verdict === 'confirmed_weak'`, `scoreAdjustment <= -1.2`).
 * 4. `evaluateActiveDashaWithVargaAndTP()` resolves `operatingPosture` (`iterative_review` when TP `yearLordRetro` is
 *    true and `stance === 'build'`, `protective_pacing` when `stance === 'get_through'`, `linear_build` when direct)
 *    and exposes `mahadashaLordRetro` / `antardashaLordRetro` in `vargaPlacement`.
 * 5. `buildCalendar()` handles both `'retrograde'` / `'retro_start'` (`turns retrograde`) and `'direct'` / `'retro_end'`
 *    (`turns direct`) station kinds cleanly.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluateVakraDignityRegime,
  getPlanetVakraPlaybook,
  isTrueVakraCapable,
  PLANET_VAKRA_PLAYBOOKS,
  type VakraPlanetCode,
} from '../../../src/reading/dasha/retrogradeRules.js';
import {
  evaluateActiveDashaWithVargaAndTP,
  evaluateD1D9MutualConfirmation,
} from '../../../src/reading/dasha/dashaAssessment.js';
import { buildCalendar } from '../../../src/reading/calendar/calendar.js';
import type { EvidencePack } from '../../../src/reading/packs/selector.js';
import { act, fakeDigest, house, planet } from '../../helpers/fakeDigest.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';

guardNoModelCalls();

const FORBIDDEN_ENGINE_RE = /\b(radha|pyjhora|aiastra_radha|jhora)\b/i;
const FORBIDDEN_PLAIN_JARGON_RE =
  /\b(mahadasha|antardasha|navamsha|dashamsha|vargottama|neecha|uchcha|cheshta|ashtagati|vakra|vakri|bhava|rashi|lagna|kundli|d1|d9|d10)\b/i;

describe('Retrograde (Vakra) Rules, D1+D9 Confirmation & Active Timing (docs/reading-engine/77)', () => {
  const originalModel = process.env.RETROGRADE_DIGNITY_MODEL;

  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.RETROGRADE_DIGNITY_MODEL;
    } else {
      process.env.RETROGRADE_DIGNITY_MODEL = originalModel;
    }
  });

  describe('1. Per-Planet Vakra Playbooks & Consumer Copy Hygiene', () => {
    it('defines all 5 true-retrograde planets (Ma, Me, Ju, Ve, Sa) with zero jargon and zero engine names in plain copy', () => {
      const codes: VakraPlanetCode[] = ['Ma', 'Me', 'Ju', 'Ve', 'Sa'];
      for (const c of codes) {
        expect(isTrueVakraCapable(c)).toBe(true);
        const pb = getPlanetVakraPlaybook(c);
        expect(pb).not.toBeNull();
        expect(PLANET_VAKRA_PLAYBOOKS[c]).toBeDefined();

        for (const plainField of [pb!.plainGift, pb!.plainKnot, pb!.plainCounsel, pb!.plainAnnualShift]) {
          expect(plainField.length).toBeGreaterThan(20);
          expect(plainField).not.toMatch(FORBIDDEN_ENGINE_RE);
          expect(plainField).not.toMatch(FORBIDDEN_PLAIN_JARGON_RE);
        }
        expect(pb!.technicalRule).not.toMatch(FORBIDDEN_ENGINE_RE);
      }

      // Luminaries and lunar nodes are never true-vakra capable
      for (const nonVakra of ['Su', 'Mo', 'Ra', 'Ke', '', null, undefined]) {
        expect(isTrueVakraCapable(nonVakra)).toBe(false);
        expect(getPlanetVakraPlaybook(nonVakra)).toBeNull();
      }
    });
  });

  describe('2. Vakra Dignity Regimes & D1+D9 Mutual Confirmation', () => {
    it('keeps direct planets strictly identical to baseline scoreAdjustment and verdict', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cn', house: 1, dignity: 'exalted', retro: false, cheshtaBala: 22 }, 'D1'),
          planet('Ju', { sign: 'Pi', house: 9, dignity: 'own', retro: false }, 'D9'),
        ],
      });
      const res = evaluateD1D9MutualConfirmation(digest, 'Ju', true);
      expect(res.verdict).toBe('confirmed_strong');
      expect(res.scoreAdjustment).toBe(1.5);
      expect(res.isRetrograde).toBeUndefined();
    });

    it('applies nuanced_parashari uplift on debilitated retrograde (neecha_vakra) when D9 is supportive', () => {
      delete process.env.RETROGRADE_DIGNITY_MODEL;
      const digest = fakeDigest({
        planets: [
          planet(
            'Ma',
            { sign: 'Cn', house: 4, dignity: 'debilitated', retro: true, motionState: 'vakra', cheshtaBala: 55.4 },
            'D1',
          ),
          planet('Ma', { sign: 'Ar', house: 1, dignity: 'own', retro: true, vargaReckoning: 'reverse' }, 'D9'),
        ],
      });
      const res = evaluateD1D9MutualConfirmation(digest, 'Ma', true);
      expect(res.verdict).toBe('d9_redeemed');
      expect(res.isRetrograde).toBe(true);
      expect(res.vakraRegime).toBe('neecha_vakra');
      // Base d9_redeemed (+1.2) + nuanced_parashari neechaUplift (+0.75) = +1.95
      expect(res.scoreAdjustment).toBeCloseTo(1.95, 2);
      expect(res.citations).toContain('motion:Ma:neecha_vakra:vakra');
      expect(res.citations).toContain('bala:cheshta:Ma:55.4');
      expect(res.citations).toContain('varga:D9:Ma:reverse_reckoning');
    });

    it('differentiates nuanced_parashari (-0.35) vs uttara_kalamrita_strict (-1.6) on exalted retrograde (uccha_vakra)', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cn', house: 1, dignity: 'exalted', retro: true, motionState: 'vakra', cheshtaBala: 56 }, 'D1'),
          planet('Ju', { sign: 'Sg', house: 9, dignity: 'own', retro: true }, 'D9'),
        ],
      });

      process.env.RETROGRADE_DIGNITY_MODEL = 'nuanced_parashari';
      const nuanced = evaluateD1D9MutualConfirmation(digest, 'Ju', true);
      expect(nuanced.vakraRegime).toBe('uccha_vakra');
      // Base confirmed_strong (+1.5) - 0.35 = +1.15
      expect(nuanced.scoreAdjustment).toBeCloseTo(1.15, 2);

      process.env.RETROGRADE_DIGNITY_MODEL = 'uttara_kalamrita_strict';
      const strict = evaluateD1D9MutualConfirmation(digest, 'Ju', true);
      expect(strict.vakraRegime).toBe('uccha_vakra');
      // Base confirmed_strong (+1.5) - 1.6 = -0.1
      expect(strict.scoreAdjustment).toBeCloseTo(-0.1, 2);
    });

    it('NEVER inverts Neecha Vargottama (debilitated in both D1 and D9) into strength when retrograde under ANY model', () => {
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Ar', house: 1, dignity: 'debilitated', retro: true, motionState: 'vakra', cheshtaBala: 58 }, 'D1'),
          planet('Sa', { sign: 'Ar', house: 1, dignity: 'debilitated', retro: true }, 'D9'),
        ],
      });

      for (const model of ['nuanced_parashari', 'uttara_kalamrita_strict'] as const) {
        process.env.RETROGRADE_DIGNITY_MODEL = model;
        const matureRes = evaluateD1D9MutualConfirmation(digest, 'Sa', true);
        expect(matureRes.isNeechaVargottama).toBe(true);
        expect(matureRes.verdict).toBe('confirmed_weak');
        expect(matureRes.scoreAdjustment).toBe(-1.5);
        expect(matureRes.citations).toContain('vakra:guard:neecha_vargottama_preserved:Sa');

        const youngRes = evaluateD1D9MutualConfirmation(digest, 'Sa', false);
        expect(youngRes.isNeechaVargottama).toBe(true);
        expect(youngRes.verdict).toBe('confirmed_weak');
        expect(youngRes.scoreAdjustment).toBe(-1.2);
      }
    });

    it('identifies stationary (vikala) turning-point intensity cleanly', () => {
      const d1Card = planet('Me', {
        sign: 'Vi',
        house: 6,
        dignity: 'exalted',
        retro: true,
        isStationary: true,
        motionState: 'vikala',
        cheshtaBala: 59.5,
      });
      const evalRes = evaluateVakraDignityRegime({
        planet: 'Me',
        d1Card,
        d9Card: planet('Me', { sign: 'Ge', house: 3, dignity: 'own' }, 'D9'),
        isMature: true,
        isNeechaVargottama: false,
      });
      expect(evalRes.regime).toBe('vikala_stationary');
      expect(evalRes.isStationary).toBe(true);
      expect(evalRes.plainNote).toContain('turning-point intensity');
      expect(evalRes.plainNote).not.toMatch(FORBIDDEN_PLAIN_JARGON_RE);
    });
  });

  describe('3. Active Dasha + Departmental Varga + Tithi Pravesha Operating Posture', () => {
    it('sets operatingPosture to iterative_review when stance is build and TP yearLord is retrograde', () => {
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Aq', house: 10, dignity: 'own', retro: true, motionState: 'vakra', cheshtaBala: 53 }, 'D1'),
          planet('Sa', { sign: 'Li', house: 7, dignity: 'exalted', retro: true }, 'D9'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own', retro: true }, 'D10'),
          planet('Ju', { sign: 'Sg', house: 9, dignity: 'own', retro: false }, 'D1'),
          planet('Ju', { sign: 'Pi', house: 12, dignity: 'own', retro: false }, 'D9'),
          planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted', retro: true }, 'D10'),
        ],
        annual: [
          {
            kind: 'TP',
            year: 2026,
            varga: 'D1',
            lagna: 'Ta',
            start: '2026-04-01T00:00:00Z',
            end: '2027-04-01T00:00:00Z',
            yearLord: 'Ju',
            yearLordRetro: true,
            yearLordMotionState: 'vakra',
            horaLord: 'Sa',
            horaLordRetro: false,
            houses: [house(1, { lord: 'Ve', lordHouse: 1 })],
            dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Sa', from: '2026-04-01', to: '2026-12-31' }] }],
            sahams: [],
          },
        ],
      });

      const activation = [
        act({ system: 'vimshottari', family: 'vimshottari', level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01' }),
        act({ system: 'vimshottari', family: 'vimshottari', level: 2, lord: 'Ju', from: '2026-01-01', to: '2028-07-01', parentLord: 'Sa' }),
        act({ system: 'yogini', family: 'yogini', level: 1, lord: 'Sa', from: '2025-01-01', to: '2029-01-01' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf: '2026-11-15',
        ageYears: 42,
        varga: 'D10',
      });

      expect(res.isMature).toBe(true);
      expect(res.d1d9Confirmation.mahadashaLord?.isRetrograde).toBe(true);
      expect(res.vargaPlacement?.mahadashaLordRetro).toBe(true);
      expect(res.vargaPlacement?.antardashaLordRetro).toBe(true);
      expect(res.tithiPravesha?.stance).toBe('build');
      expect(res.tithiPravesha?.yearLordRetro).toBe(true);
      expect(res.tithiPravesha?.operatingPosture).toBe('iterative_review');
      expect(res.narrativeContext).toContain('second-pass refinement');
      expect(res.narrativeContext).toContain('iterative review');
      expect(res.narrativeContext).not.toMatch(FORBIDDEN_ENGINE_RE);
    });
  });

  describe('4. Calendar Station Labels (retrograde/retro_start & direct/retro_end)', () => {
    it('renders turns retrograde and turns direct for both engine and legacy station kind strings', () => {
      const pack: EvidencePack = {
        horizon: '1y',
        sections: {
          transits: {
            rows: {},
            stations: [
              { planet: 'Me', date: '2026-11-24', kind: 'retrograde' },
              { planet: 'Me', date: '2026-12-14', kind: 'direct' },
              { planet: 'Sa', date: '2026-11-29', kind: 'retro_end' },
              { planet: 'Ju', date: '2026-12-10', kind: 'retro_start' },
            ],
          },
        },
        sources: [],
      } as unknown as EvidencePack;

      const cal = buildCalendar(pack, { horizon: '1y' }, '2026-11-15');
      const stationLabels = cal.events.filter((e) => e.kind === 'station').map((e) => `${e.date}:${e.label}`);
      expect(stationLabels).toEqual([
        '2026-11-24:Me turns retrograde',
        '2026-11-29:Sa turns direct',
        '2026-12-10:Ju turns retrograde',
        '2026-12-14:Me turns direct',
      ]);
    });
  });
});
