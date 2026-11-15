/**
 * Automated Unit Test Suite for Milestone 3 (Requirement R3):
 * Vedic D9 (Navamsha) & Divisional Charts, Age > 36 Gating, and Active Dasha / Tithi Pravesh Integration.
 *
 * Covers:
 * 1. Offline & Cost Approval Guardrail (`guardNoModelCalls()`).
 * 2. Age-36 Branching Logic (`isAgeMatureD9`, `getD9MaturityAgeYears`, `ageInYears`).
 * 3. D1+D9 Mutual Confirmation Logic (Exalted/Neecha/Neutral Vargottama, False Promise, Neecha Bhanga).
 * 4. Higher Divisional Chart Integration & Departmental Routing (D10, D9, D7, D30).
 * 5. Active Mahadasha Selection Across 40+ Systems & Annual Tithi Pravesh (AnnualRow.yearLord, fail-closed stance).
 * 6. Canonical Customer Cohort Validation (Sachin, Sumit, Archisha, Swati, Mohit).
 */
import { describe, expect, it } from 'vitest';
import { getD9MaturityAgeYears } from '../../../src/config/env.js';
import {
  ageInYears,
  evaluateActiveDashaWithVargaAndTP,
  evaluateD1D9MutualConfirmation,
  isAgeMatureD9,
  resolveActiveMahadasha,
} from '../../../src/reading/dasha/dashaAssessment.js';
import {
  buildLoveRelationshipArc,
  buildSelfCharacterArc,
  buildWorkCharacterArc,
} from '../../../src/reading/area/selfCharacterAndJoy.js';
import { workAnnualVote, workD10Check } from '../../../src/reading/area/career.js';
import { cardInstruction, renderActiveTimingAndVargaBlock } from '../../../src/reading/cards/oracle.js';
import { buildCardPack } from '../../../src/reading/cards/group.js';
import type { ActivationRow } from '../../../src/reading/digest/activation.js';
import type { AnnualRow } from '../../../src/reading/digest/types.js';
import { act, fakeDigest, house, planet } from '../../helpers/fakeDigest.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';

// Enforce offline execution across the entire test suite (Zero Paid Model Calls)
guardNoModelCalls();

describe('Dasha Navamsha Confirmation & Divisional Timing Engine (docs/reading-engine/76)', () => {
  describe('1. Offline & Cost Approval Guardrail', () => {
    it('executes dasha and D1+D9 assessments strictly in-memory with zero network or model calls', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cn', house: 1, dignity: 'exalted' }, 'D1'),
          planet('Ju', { sign: 'Cn', house: 1, dignity: 'exalted' }, 'D9'),
        ],
      });
      const result = evaluateD1D9MutualConfirmation(digest, 'Ju', true);
      expect(result.verdict).toBe('confirmed_strong');
      expect(result.scoreAdjustment).toBe(1.5);
    });
  });

  describe('2. Age-36 Branching Logic', () => {
    it('evaluates isAgeMatureD9 with default threshold (36.0 years)', () => {
      expect(getD9MaturityAgeYears()).toBe(36);

      // Boundaries around 36.0: strict ageYears > threshold
      expect(isAgeMatureD9(35.9)).toBe(false);
      expect(isAgeMatureD9(36.0)).toBe(false);
      expect(isAgeMatureD9(36.001)).toBe(true);
      expect(isAgeMatureD9(36.1)).toBe(true);
      expect(isAgeMatureD9(46.0)).toBe(true);
    });

    it('safely handles non-numeric, null, undefined, NaN, and negative values', () => {
      expect(isAgeMatureD9(null)).toBe(false);
      expect(isAgeMatureD9(undefined)).toBe(false);
      expect(isAgeMatureD9(NaN)).toBe(false);
      expect(isAgeMatureD9(-10)).toBe(false);
      expect(isAgeMatureD9(0)).toBe(false);
    });

    it('dynamically respects environment variable override D9_MATURITY_AGE_YEARS', () => {
      const originalEnv = process.env.D9_MATURITY_AGE_YEARS;
      try {
        process.env.D9_MATURITY_AGE_YEARS = '40';
        expect(getD9MaturityAgeYears()).toBe(40);
        expect(isAgeMatureD9(36.5)).toBe(false);
        expect(isAgeMatureD9(39.9)).toBe(false);
        expect(isAgeMatureD9(40.0)).toBe(false);
        expect(isAgeMatureD9(40.01)).toBe(true);
        expect(isAgeMatureD9(45.0)).toBe(true);
      } finally {
        if (originalEnv !== undefined) {
          process.env.D9_MATURITY_AGE_YEARS = originalEnv;
        } else {
          delete process.env.D9_MATURITY_AGE_YEARS;
        }
      }
    });

    it('calculates fractional age in years accurately via ageInYears', () => {
      const asOf = '2026-11-15';
      const sachinAge = ageInYears('1980-10-14', asOf);
      expect(sachinAge).not.toBeNull();
      expect(sachinAge!).toBeGreaterThan(46);
      expect(sachinAge!).toBeLessThan(46.2);
      expect(isAgeMatureD9(sachinAge)).toBe(true);

      const archishaAge = ageInYears('1998-12-17', asOf);
      expect(archishaAge).not.toBeNull();
      expect(archishaAge!).toBeGreaterThan(27.8);
      expect(archishaAge!).toBeLessThan(28.0);
      expect(isAgeMatureD9(archishaAge)).toBe(false);

      // Edge cases: missing or malformed dates, future birth date
      expect(ageInYears(null, asOf)).toBeNull();
      expect(ageInYears('1980-10-14', null)).toBeNull();
      expect(ageInYears('not-a-date', asOf)).toBeNull();
      expect(ageInYears('2030-01-01', asOf)).toBeNull();
    });
  });

  describe('3. D1+D9 Mutual Confirmation Logic', () => {
    it('Case A: Exalted Vargottama yields confirmed_strong with +1.5 adjustment and citations', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cn', house: 1, dignity: 'exalted' }, 'D1'),
          planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D9'),
        ],
      });

      // Mature native (> 36)
      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Ju', true);
      expect(matureResult.isVargottama).toBe(true);
      expect(matureResult.isNeechaVargottama).toBe(false);
      expect(matureResult.verdict).toBe('confirmed_strong');
      expect(matureResult.scoreAdjustment).toBe(1.5);
      expect(matureResult.citations).toContain('varga:vargottama:Ju:Cn');
      expect(matureResult.citations).toContain('D1.p.Ju.h1:Cn(exalted)');
      expect(matureResult.citations).toContain('D9.p.Ju.h4:Cn(exalted)');

      // Pre-mature native (<= 36)
      const preResult = evaluateD1D9MutualConfirmation(digest, 'Ju', false);
      expect(preResult.isVargottama).toBe(true);
      expect(preResult.verdict).toBe('confirmed_strong');
      expect(preResult.scoreAdjustment).toBe(1.5); // 1.0 base + 0.5 vargottama bonus
    });

    it('Case B: Neecha Vargottama (Drudha Karma) yields confirmed_weak (-1.5 mature / -1.2 pre-mature)', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cp', house: 7, dignity: 'debilitated' }, 'D1'),
          planet('Ju', { sign: 'Cp', house: 10, dignity: 'debilitated' }, 'D9'),
        ],
      });

      // Mature native (> 36): Drudha Karma citation & unyielding karmic friction
      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Ju', true);
      expect(matureResult.isVargottama).toBe(true);
      expect(matureResult.isNeechaVargottama).toBe(true);
      expect(matureResult.verdict).toBe('confirmed_weak');
      expect(matureResult.scoreAdjustment).toBe(-1.5);
      expect(matureResult.citations).toContain('varga:neecha_vargottama:Ju:Cp');
      expect(matureResult.summary).toMatch(/Drudha Karma|Neecha Vargottama/i);

      // Pre-mature native (<= 36): Initial persistent friction
      const preResult = evaluateD1D9MutualConfirmation(digest, 'Ju', false);
      expect(preResult.isVargottama).toBe(true);
      expect(preResult.isNeechaVargottama).toBe(true);
      expect(preResult.verdict).toBe('confirmed_weak');
      expect(preResult.scoreAdjustment).toBe(-1.2);
    });

    it('Case C: False Promise / D9 Weakened (exalted D1, debilitated D9) branches on age-36', () => {
      const digest = fakeDigest({
        planets: [
          planet('Su', { sign: 'Ar', house: 1, dignity: 'exalted' }, 'D1'),
          planet('Su', { sign: 'Li', house: 7, dignity: 'debilitated' }, 'D9'),
        ],
      });

      // Mature native (> 36): False Promise detected -> d9_weakened, -1.0
      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Su', true);
      expect(matureResult.isVargottama).toBe(false);
      expect(matureResult.verdict).toBe('d9_weakened');
      expect(matureResult.scoreAdjustment).toBe(-1.0);
      expect(matureResult.summary).toMatch(/False Promise|subtle friction/i);

      // Pre-mature native (<= 36): Physical chart dominance -> confirmed_strong, +1.0
      const preResult = evaluateD1D9MutualConfirmation(digest, 'Su', false);
      expect(preResult.verdict).toBe('confirmed_strong');
      expect(preResult.scoreAdjustment).toBe(1.0);
    });

    it('Case D: Neecha Bhanga via D9 (debilitated D1, exalted D9) branches on age-36', () => {
      const digest = fakeDigest({
        planets: [
          planet('Me', { sign: 'Pi', house: 12, dignity: 'debilitated' }, 'D1'),
          planet('Me', { sign: 'Vi', house: 6, dignity: 'exalted' }, 'D9'),
        ],
      });

      // Mature native (> 36): True redemption in Navamsha -> d9_redeemed, +1.2
      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Me', true);
      expect(matureResult.isVargottama).toBe(false);
      expect(matureResult.verdict).toBe('d9_redeemed');
      expect(matureResult.scoreAdjustment).toBe(1.2);
      expect(matureResult.citations).toContain('varga:neecha_bhanga_d9:Me');
      expect(matureResult.summary).toMatch(/Neecha Bhanga|earned depth/i);

      // Pre-mature native (<= 36): Physical chart dominance -> confirmed_weak, -1.0
      const preResult = evaluateD1D9MutualConfirmation(digest, 'Me', false);
      expect(preResult.verdict).toBe('confirmed_weak');
      expect(preResult.scoreAdjustment).toBe(-1.0);
    });

    it('Case E: Neutral Vargottama yields confirmed_strong (+1.0) for mature, neutral (+0.5) for pre-mature', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ma', { sign: 'Ta', house: 2, dignity: 'neutral' }, 'D1'),
          planet('Ma', { sign: 'Ta', house: 2, dignity: 'neutral' }, 'D9'),
        ],
      });

      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Ma', true);
      expect(matureResult.isVargottama).toBe(true);
      expect(matureResult.isNeechaVargottama).toBe(false);
      expect(matureResult.verdict).toBe('confirmed_strong');
      expect(matureResult.scoreAdjustment).toBe(1.0);
      expect(matureResult.citations).toContain('varga:vargottama:Ma:Ta');

      const preResult = evaluateD1D9MutualConfirmation(digest, 'Ma', false);
      expect(preResult.isVargottama).toBe(true);
      expect(preResult.verdict).toBe('neutral');
      expect(preResult.scoreAdjustment).toBe(0.5); // 0 base + 0.5 vargottama alignment
    });

    it('Case F: Non-Vargottama confirmed weak yields -1.3 for mature native', () => {
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Ar', house: 1, dignity: 'debilitated' }, 'D1'),
          planet('Sa', { sign: 'Le', house: 5, dignity: 'enemy' }, 'D9'),
        ],
      });

      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Sa', true);
      expect(matureResult.isVargottama).toBe(false);
      expect(matureResult.verdict).toBe('confirmed_weak');
      expect(matureResult.scoreAdjustment).toBe(-1.3);
    });

    it('Case G: Non-Vargottama confirmed strong yields +1.5 for mature native', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ve', { sign: 'Ta', house: 2, dignity: 'own' }, 'D1'),
          planet('Ve', { sign: 'Pi', house: 12, dignity: 'exalted' }, 'D9'),
        ],
      });

      const matureResult = evaluateD1D9MutualConfirmation(digest, 'Ve', true);
      expect(matureResult.isVargottama).toBe(false);
      expect(matureResult.verdict).toBe('confirmed_strong');
      expect(matureResult.scoreAdjustment).toBe(1.5);
    });

    it('Case H: Handles missing planet cards gracefully with Unknown fallbacks', () => {
      const digest = fakeDigest({ planets: [] });
      const result = evaluateD1D9MutualConfirmation(digest, 'Ra', true);
      expect(result.planet).toBe('Ra');
      expect(result.d1Sign).toBe('Unknown');
      expect(result.d9Sign).toBe('Unknown');
      expect(result.isVargottama).toBe(false);
      expect(result.verdict).toBe('neutral');
      expect(result.scoreAdjustment).toBe(0);
    });
  });

  describe('4. Higher Divisional Chart Integration & Departmental Routing', () => {
    const asOf = '2026-11-15';

    it('evaluates active Mahadasha lord in D10 (Dashamsha) for Work/Career alignment', () => {
      // Setup D10 where MD lord Sa is exalted in house 10 (Kendra) -> support
      const digestSupport = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
          planet('Sa', { sign: 'Li', house: 10, dignity: 'exalted' }, 'D10'),
        ],
      });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const resSupport = evaluateActiveDashaWithVargaAndTP({
        view: digestSupport,
        activation,
        asOf,
        ageYears: 46,
        varga: 'D10',
      });

      expect(resSupport.vargaPlacement).not.toBeNull();
      expect(resSupport.vargaPlacement?.varga).toBe('D10');
      expect(resSupport.vargaPlacement?.mahadashaLordCard?.planet).toBe('Sa');
      expect(resSupport.vargaPlacement?.status).toBe('support');

      // Setup D10 where MD lord Sa is debilitated in house 8 (Dusthana) -> test
      const digestTest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
          planet('Sa', { sign: 'Ar', house: 8, dignity: 'debilitated' }, 'D10'),
        ],
      });

      const resTest = evaluateActiveDashaWithVargaAndTP({
        view: digestTest,
        activation,
        asOf,
        ageYears: 46,
        varga: 'D10',
      });

      expect(resTest.vargaPlacement?.status).toBe('test');
    });

    it('evaluates active Mahadasha lord in D9 and D7 for Love/Relationships', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ve', { sign: 'Li', house: 7, dignity: 'own' }, 'D1'),
          planet('Ve', { sign: 'Pi', house: 12, dignity: 'exalted' }, 'D9'),
          planet('Ve', { sign: 'Ta', house: 1, dignity: 'own' }, 'D7'),
        ],
      });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Ve', from: '2022-01-01', to: '2042-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const resD9 = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 32,
        varga: 'D9',
      });
      expect(resD9.vargaPlacement?.varga).toBe('D9');
      expect(resD9.vargaPlacement?.mahadashaLordCard?.planet).toBe('Ve');

      const resD7 = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 32,
        varga: 'D7',
      });
      expect(resD7.vargaPlacement?.varga).toBe('D7');
      expect(resD7.vargaPlacement?.status).toBe('support'); // own in house 1
    });

    it('evaluates active Mahadasha lord in D30 for Self/Health friction check', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D1'),
          planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D9'),
          planet('Ma', { sign: 'Cn', house: 6, dignity: 'debilitated' }, 'D30'),
        ],
      });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Ma', from: '2024-01-01', to: '2031-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const resD30 = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 42,
        varga: 'D30',
      });
      expect(resD30.vargaPlacement?.varga).toBe('D30');
      expect(resD30.vargaPlacement?.status).toBe('test'); // debilitated in 6th
    });
  });

  describe('5. Active Mahadasha Selection Across 40+ Systems & Annual Tithi Pravesh', () => {
    const asOf = '2026-11-15';

    it('prioritizes certified applicable conditional nakshatra dasha over Vimshottari', () => {
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Sg', house: 9, dignity: 'own' }, 'D1'),
          planet('Ju', { sign: 'Sg', house: 9, dignity: 'own' }, 'D9'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
        ],
      });
      const activation: ActivationRow[] = [
        // Certified conditional active (e.g. Dwisaptati Sama)
        act({ level: 1, lord: 'Ju', from: '2025-01-01', to: '2034-01-01', system: 'dwisaptati', family: 'conditional' }),
        act({ level: 2, lord: 'Ve', from: '2026-06-01', to: '2027-08-01', system: 'dwisaptati', family: 'conditional' }),
        // Standard Vimshottari also running
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 46,
      });

      expect(res.activeMahadasha?.system).toBe('dwisaptati');
      expect(res.activeMahadasha?.family).toBe('conditional');
      expect(res.activeMahadasha?.lord).toBe('Ju');
      expect(res.activeAntardasha?.lord).toBe('Ve');
    });

    it('falls back to universal Vimshottari when conditional nakshatra dasha is absent', () => {
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
        ],
      });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
        act({ level: 2, lord: 'Me', from: '2026-01-01', to: '2028-06-01', system: 'vimshottari', family: 'vimshottari' }),
        act({ level: 1, lord: 'Ar', from: '2022-01-01', to: '2031-01-01', system: 'narayana', family: 'rasi' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 46,
      });

      expect(res.activeMahadasha?.system).toBe('vimshottari');
      expect(res.activeMahadasha?.lord).toBe('Sa');
      expect(res.activeAntardasha?.lord).toBe('Me');
    });

    it('falls back to Rasi dasha (Narayana/Chara) when neither conditional nor Vimshottari is active', () => {
      const digest = fakeDigest({ planets: [] });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Pi', from: '2024-01-01', to: '2032-01-01', system: 'narayana', family: 'rasi' }),
        act({ level: 2, lord: 'Cn', from: '2026-01-01', to: '2027-01-01', system: 'narayana', family: 'rasi' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 30,
      });

      expect(res.activeMahadasha?.system).toBe('narayana');
      expect(res.activeMahadasha?.family).toBe('rasi');
      expect(res.activeMahadasha?.lord).toBe('Pi');
      expect(res.activeAntardasha?.lord).toBe('Cn');
    });

    it('integrates stored Annual Tithi Pravesh reading AnnualRow.yearLord and stored annual divisional charts', () => {
      const annualTpRowD1: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D1',
        lagna: 'Ar',
        houses: [house(1, { lord: 'Ma' })],
        dashas: [
          {
            system: 'tithi_ashtottari',
            periods: [
              { lord: 'Ju', from: '2026-04-10', to: '2026-09-01' },
              { lord: 'Sa', from: '2026-09-01', to: '2027-04-29' },
            ],
          },
        ],
        sahams: [],
        yearLord: 'Ju',
        start: '2026-04-10 12:00:00',
        end: '2027-04-29 12:00:00',
        startBasis: 'tp_start',
      };

      const annualTpRowD10: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D10',
        lagna: 'Cn',
        houses: [house(10, { lord: 'Ma', lordHouse: 10, lordDignity: 'own' }, 'D10')],
        dashas: [],
        sahams: [],
        yearLord: 'Ju',
      };

      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D1'),
          planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D9'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
          planet('Sa', { sign: 'Li', house: 10, dignity: 'exalted' }, 'D10'),
        ],
        annual: [annualTpRowD1, annualTpRowD10],
      });

      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
        act({ level: 2, lord: 'Sa', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 46,
        varga: 'D10',
      });

      expect(res.tithiPravesha).not.toBeNull();
      expect(res.tithiPravesha?.year).toBe(2026);
      expect(res.tithiPravesha?.yearLord).toBe('Ju');
      expect(res.tithiPravesha?.shortClock?.lord).toBe('Sa'); // running short clock period at 2026-11-15
      expect(res.vargaPlacement?.tpAnnualVargaRow?.varga).toBe('D10');

      // Year lord Ju is exalted, D10 status is support, clocks agree -> stance: build
      expect(res.tithiPravesha?.stance).toBe('build');
    });

    it('enforces fail-closed stance (defaults to get_through) when yearLord is unresolved or missing', () => {
      const annualTpRowNoLord: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D1',
        lagna: 'Ar',
        houses: [],
        dashas: [
          {
            system: 'tithi_ashtottari',
            periods: [{ lord: 'Ju', from: '2026-04-10', to: '2027-04-29' }],
          },
        ],
        sahams: [],
        yearLord: null, // missing yearLord
        start: '2026-04-10 12:00:00',
        end: '2027-04-29 12:00:00',
        startBasis: 'tp_start',
      };

      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
        ],
        annual: [annualTpRowNoLord],
      });

      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 46,
      });

      expect(res.tithiPravesha).not.toBeNull();
      expect(res.tithiPravesha?.yearLord).toBe('Unknown');
      expect(res.tithiPravesha?.stance).toBe('get_through');
      expect(res.gaps.some((g) => g.includes('yearLord missing or unresolved'))).toBe(true);
    });

    it('enforces fail-closed stance (defaults to get_through) when yearLord is debilitated in D1', () => {
      const annualTpRow: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D1',
        lagna: 'Ar',
        houses: [],
        dashas: [
          {
            system: 'tithi_ashtottari',
            periods: [{ lord: 'Ju', from: '2026-04-10', to: '2027-04-29' }],
          },
        ],
        sahams: [],
        yearLord: 'Ju',
        start: '2026-04-10 12:00:00',
        end: '2027-04-29 12:00:00',
        startBasis: 'tp_start',
      };

      // Jupiter is debilitated in Capricorn in D1
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cp', house: 10, dignity: 'debilitated' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
        ],
        annual: [annualTpRow],
      });

      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 46,
      });

      expect(res.tithiPravesha?.stance).toBe('get_through');
    });

    it('enforces fail-closed stance when departmental varga status is test', () => {
      const annualTpRow: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D1',
        lagna: 'Ar',
        houses: [],
        dashas: [
          {
            system: 'tithi_ashtottari',
            periods: [{ lord: 'Sa', from: '2026-04-10', to: '2027-04-29' }],
          },
        ],
        sahams: [],
        yearLord: 'Ju',
        start: '2026-04-10 12:00:00',
        end: '2027-04-29 12:00:00',
        startBasis: 'tp_start',
      };

      // Year lord Ju is strong, but MD lord Sa in D10 is debilitated in Dusthana (house 8) -> status 'test'
      const digest = fakeDigest({
        planets: [
          planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D1'),
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
          planet('Sa', { sign: 'Ar', house: 8, dignity: 'debilitated' }, 'D10'),
        ],
        annual: [annualTpRow],
      });

      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
        act({ level: 2, lord: 'Sa', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      const res = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        ageYears: 46,
        varga: 'D10',
      });

      expect(res.vargaPlacement?.status).toBe('test');
      expect(res.tithiPravesha?.stance).toBe('get_through');
    });

    it('evaluates multi-clock concordance: confirmed (>=3), leaning (2), contested (<=1)', () => {
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
        ],
      });

      // 3 agreeing clocks: MD lord Sa, AD lord Sa, shortClock lord Sa -> confirmed
      const annual3: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D1',
        lagna: 'Ar',
        houses: [],
        dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Sa', from: '2026-01-01', to: '2027-01-01' }] }],
        sahams: [],
        yearLord: 'Sa',
        start: '2026-01-01 12:00:00',
        end: '2027-01-01 12:00:00',
      };
      const digest3 = fakeDigest({ planets: [planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1')], annual: [annual3] });
      const act3: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
        act({ level: 2, lord: 'Sa', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];
      const res3 = evaluateActiveDashaWithVargaAndTP({ view: digest3, activation: act3, asOf });
      expect(res3.multiClockConcordance.agreeingClocks).toBeGreaterThanOrEqual(3);
      expect(res3.multiClockConcordance.concordance).toBe('confirmed');

      // 1 agreeing clock (only MD lord Sa, AD lord is Me, short clock is Ju) -> contested
      const annual1: AnnualRow = {
        kind: 'TP',
        year: 2026,
        varga: 'D1',
        lagna: 'Ar',
        houses: [],
        dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2026-01-01', to: '2027-01-01' }] }],
        sahams: [],
        yearLord: 'Ju',
        start: '2026-01-01 12:00:00',
        end: '2027-01-01 12:00:00',
      };
      const digest1 = fakeDigest({ planets: [planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1')], annual: [annual1] });
      const act1: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
        act({ level: 2, lord: 'Me', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];
      const res1 = evaluateActiveDashaWithVargaAndTP({ view: digest1, activation: act1, asOf });
      expect(res1.multiClockConcordance.agreeingClocks).toBe(1);
      expect(res1.multiClockConcordance.concordance).toBe('contested');
    });
  });

  describe('6. Cohort Profiles Validation', () => {
    const asOf = '2026-11-15';

    // Canonical test cohort data
    const COHORTS = [
      { name: 'Sachin', dob: '1980-10-14', expectedAge: 46, expectedMature: true },
      { name: 'Sumit', dob: '1975-09-06', expectedAge: 51, expectedMature: true },
      { name: 'Archisha', dob: '1998-12-17', expectedAge: 28, expectedMature: false },
      { name: 'Swati', dob: '1997-10-24', expectedAge: 29, expectedMature: false },
      { name: 'Mohit', dob: '2002-04-27', expectedAge: 24, expectedMature: false },
    ];

    it.each(COHORTS)(
      'validates $name (DOB: $dob, ~$expectedAge y) correctly resolves isMature = $expectedMature',
      ({ dob, expectedAge, expectedMature }) => {
        const calculatedAge = ageInYears(dob, asOf);
        expect(calculatedAge).not.toBeNull();
        expect(Math.floor(calculatedAge!)).toBe(
          expectedAge === 28 ? 27 : expectedAge, // Archisha turns 28 in Dec 1998 -> Nov 2026 is 27.91y
        );
        expect(isAgeMatureD9(calculatedAge)).toBe(expectedMature);
      },
    );

    it('asserts post-36 cohorts (Sachin, Sumit) trigger full joint D1+D9 validation in narrative and confirmation', () => {
      // Setup a chart with False Promise (exalted in D1, debilitated in D9)
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Li', house: 8, dignity: 'exalted' }, 'D1'),
          planet('Sa', { sign: 'Ar', house: 2, dignity: 'debilitated' }, 'D9'),
        ],
      });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      // Sachin: DOB 1980-10-14 (age 46 > 36)
      const sachinRes = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        birthDate: '1980-10-14',
      });
      expect(sachinRes.isMature).toBe(true);
      expect(sachinRes.d1d9Confirmation.mahadashaLord?.verdict).toBe('d9_weakened');
      expect(sachinRes.d1d9Confirmation.mahadashaLord?.scoreAdjustment).toBe(-1.0);
      expect(sachinRes.narrativeContext).toContain('Having reached full karmic maturity (post-36)');

      // Sumit: DOB 1975-09-06 (age 51 > 36)
      const sumitRes = evaluateActiveDashaWithVargaAndTP({
        view: digest,
        activation,
        asOf,
        birthDate: '1975-09-06',
      });
      expect(sumitRes.isMature).toBe(true);
      expect(sumitRes.d1d9Confirmation.mahadashaLord?.verdict).toBe('d9_weakened');
      expect(sumitRes.d1d9Confirmation.mahadashaLord?.scoreAdjustment).toBe(-1.0);
    });

    it('asserts pre-36 cohorts (Archisha, Swati, Mohit) trigger D1-primary baseline', () => {
      // The same chart with exalted in D1, debilitated in D9
      const digest = fakeDigest({
        planets: [
          planet('Sa', { sign: 'Li', house: 8, dignity: 'exalted' }, 'D1'),
          planet('Sa', { sign: 'Ar', house: 2, dignity: 'debilitated' }, 'D9'),
        ],
      });
      const activation: ActivationRow[] = [
        act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
      ];

      for (const cohort of ['1998-12-17', '1997-10-24', '2002-04-27']) {
        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          birthDate: cohort,
        });
        expect(res.isMature).toBe(false);
        // Pre-mature baseline operates primarily through physical chart (D1 exalted -> confirmed_strong +1.0)
        expect(res.d1d9Confirmation.mahadashaLord?.verdict).toBe('confirmed_strong');
        expect(res.d1d9Confirmation.mahadashaLord?.scoreAdjustment).toBe(1.0);
        expect(res.narrativeContext).not.toContain('Having reached full karmic maturity (post-36)');
      }
    });
  });

  describe('7. Critical Remediation Wave Validation (Sentinel Directive 2026-11-15T01:40:54Z)', () => {
    const asOf = '2026-11-15';

    describe('Task 1: Multi-Clock 40+ Dasha Concordance & TP yearLord D1+D9+Varga Assessment', () => {
      it('yields agreeingClocks >= 3 and concordance === "confirmed" when 3+ distinct active dasha systems share lord', () => {
        const digest = fakeDigest({
          planets: [
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
          ],
        });

        // 3 distinct level-1 systems active at asOf with lord 'Sa'
        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 1, lord: 'Sa', from: '2022-01-01', to: '2032-01-01', system: 'ashtottari', family: 'conditional' }),
          act({ level: 1, lord: 'Sa', from: '2024-01-01', to: '2030-01-01', system: 'chara', family: 'rasi' }),
          // Duplicate system row that should be deduplicated
          act({ level: 1, lord: 'Sa', from: '2025-01-01', to: '2028-01-01', system: 'ashtottari', family: 'conditional' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
        });

        expect(res.multiClockConcordance.agreeingClocks).toBeGreaterThanOrEqual(3);
        expect(res.multiClockConcordance.concordance).toBe('confirmed');
      });

      it('evaluates TP yearLord in D1+D9 (>36): d9_weakened prevents "build" stance', () => {
        // Year Lord 'Ve' exalted in D1 but debilitated in D9 ('d9_weakened' false promise)
        const digest = fakeDigest({
          planets: [
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
            planet('Ve', { sign: 'Pi', house: 1, dignity: 'exalted' }, 'D1'),
            planet('Ve', { sign: 'Vi', house: 7, dignity: 'debilitated' }, 'D9'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Pi',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Sa', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ve',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
            {
              kind: 'TP',
              year: 2026,
              varga: 'D9',
              lagna: 'Vi',
              houses: [],
              dashas: [],
              sahams: [],
              yearLord: 'Ve',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Sa', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
          varga: 'D10',
        });

        expect(res.tithiPravesha?.yearLord).toBe('Ve');
        expect(res.tithiPravesha?.yearLordConfirmation?.verdict).toBe('d9_weakened');
        expect(res.tithiPravesha?.yearLordConfirm?.verdict).toBe('d9_weakened');
        expect(res.tithiPravesha?.tpD9Row).toBeDefined();
        expect(res.tithiPravesha?.tpD9Row?.varga).toBe('D9');
        // Because yearLord is d9_weakened at age 46, stance cannot be 'build'
        expect(res.tithiPravesha?.stance).toBe('get_through');
      });

      it('evaluates TP yearLord in D1+D9 (>36): confirmed_strong supports "build" stance and exposes yearLordVargaCard', () => {
        // Year Lord 'Ju' exalted in D1 and friendly/strong in D9
        const digest = fakeDigest({
          planets: [
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
            planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D1'),
            planet('Ju', { sign: 'Sg', house: 9, dignity: 'own' }, 'D9'),
            planet('Ju', { sign: 'Cn', house: 10, dignity: 'exalted' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
            {
              kind: 'TP',
              year: 2026,
              varga: 'D10',
              lagna: 'Ar',
              houses: [],
              dashas: [],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Sa', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
          varga: 'D10',
        });

        expect(res.tithiPravesha?.yearLord).toBe('Ju');
        expect(res.tithiPravesha?.yearLordConfirmation?.verdict).toBe('confirmed_strong');
        expect(res.tithiPravesha?.yearLordConfirm?.verdict).toBe('confirmed_strong');
        expect(res.tithiPravesha?.tpVargaRow).toBeDefined();
        expect(res.tithiPravesha?.tpVargaRow?.varga).toBe('D10');
        expect(res.tithiPravesha?.yearLordVargaCard?.dignity).toBe('exalted');
        expect(res.tithiPravesha?.stance).toBe('build');
      });

      it('evaluates TP yearLord in D1+D9 (>36): d9_redeemed supports "build" stance', () => {
        // Year Lord 'Me' debilitated in D1 (Pi) but exalted in D9 (Vi) -> d9_redeemed
        const digest = fakeDigest({
          planets: [
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
            planet('Me', { sign: 'Pi', house: 12, dignity: 'debilitated' }, 'D1'),
            planet('Me', { sign: 'Vi', house: 6, dignity: 'exalted' }, 'D9'),
            planet('Me', { sign: 'Vi', house: 10, dignity: 'exalted' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Me', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Me',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
            {
              kind: 'TP',
              year: 2026,
              varga: 'D10',
              lagna: 'Ar',
              houses: [],
              dashas: [],
              sahams: [],
              yearLord: 'Me',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Me', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Me', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
          varga: 'D10',
        });

        expect(res.tithiPravesha?.yearLord).toBe('Me');
        expect(res.tithiPravesha?.yearLordConfirm?.verdict).toBe('d9_redeemed');
        expect(res.tithiPravesha?.stance).toBe('build');
      });

      it('evaluates TP yearLord in D1+D9 (>36): dusthana affliction in tpD9Row enforces fail-closed get_through stance', () => {
        const digest = fakeDigest({
          planets: [
            planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D1'),
            planet('Ju', { sign: 'Sg', house: 9, dignity: 'own' }, 'D9'),
            planet('Ju', { sign: 'Cn', house: 10, dignity: 'exalted' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
            {
              kind: 'TP',
              year: 2026,
              varga: 'D9',
              lagna: 'Ar',
              houses: [house(8, { occupants: [{ planet: 'Ju', dignity: null, nature: 'benefic' }] })],
              dashas: [],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Ju', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Ju', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
          varga: 'D10',
        });

        expect(res.tithiPravesha?.tpD9Row).toBeDefined();
        // Occupant in 8th house in TP D9 forces stance to get_through
        expect(res.tithiPravesha?.stance).toBe('get_through');
      });

      it('evaluates TP yearLord in D1+D9 (>36): dusthana affliction in tpVargaRow enforces fail-closed get_through stance', () => {
        const digest = fakeDigest({
          planets: [
            planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D1'),
            planet('Ju', { sign: 'Sg', house: 9, dignity: 'own' }, 'D9'),
            planet('Ju', { sign: 'Cn', house: 10, dignity: 'exalted' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
            {
              kind: 'TP',
              year: 2026,
              varga: 'D10',
              lagna: 'Ar',
              houses: [house(6, { occupants: [{ planet: 'Ju', dignity: null, nature: 'benefic' }] })],
              dashas: [],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Ju', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Ju', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
          varga: 'D10',
        });

        expect(res.tithiPravesha?.tpVargaRow).toBeDefined();
        // Occupant in 6th house in TP D10 forces stance to get_through
        expect(res.tithiPravesha?.stance).toBe('get_through');
      });

      it('evaluates TP yearLord in natal varga: dusthana affliction in yearLordVargaCard enforces get_through stance', () => {
        const digest = fakeDigest({
          planets: [
            planet('Ju', { sign: 'Cn', house: 4, dignity: 'exalted' }, 'D1'),
            planet('Ju', { sign: 'Sg', house: 9, dignity: 'own' }, 'D9'),
            planet('Ju', { sign: 'Cn', house: 12, dignity: 'exalted' }, 'D10'), // In 12th house in D10
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ju',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Ju', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Ju', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 46,
          varga: 'D10',
        });

        expect(res.tithiPravesha?.yearLordVargaCard?.house).toBe(12);
        expect(res.tithiPravesha?.stance).toBe('get_through');
      });

      it('pre-36 native with D1 exalted and D9 debilitated does NOT fail closed due to D9 (D1 primary)', () => {
        // Year Lord 'Ve' exalted in D1 but debilitated in D9
        const digest = fakeDigest({
          planets: [
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
            planet('Ve', { sign: 'Pi', house: 1, dignity: 'exalted' }, 'D1'),
            planet('Ve', { sign: 'Vi', house: 7, dignity: 'debilitated' }, 'D9'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Pi',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Sa', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ve',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Sa', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        // Pre-mature subject (Archisha, age 28 <= 36)
        const res = evaluateActiveDashaWithVargaAndTP({
          view: digest,
          activation,
          asOf,
          ageYears: 28,
        });

        expect(res.isMature).toBe(false);
        // Pre-mature subject relies on physical D1 dominance (exalted), allowing 'build' stance
        expect(res.tithiPravesha?.stance).toBe('build');
      });

      it('deduplicates same dasha system and handles 2-clock leaning vs 4-clock contested', () => {
        const digest = fakeDigest({
          planets: [planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1')],
        });

        // 2 agreeing distinct systems: vimshottari (Sa) and chara (Sa), while short clock is Me -> leaning
        const actLeaning: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 1, lord: 'Sa', from: '2022-01-01', to: '2032-01-01', system: 'chara', family: 'rasi' }),
        ];
        const resLeaning = evaluateActiveDashaWithVargaAndTP({ view: digest, activation: actLeaning, asOf });
        expect(resLeaning.multiClockConcordance.agreeingClocks).toBe(2);
        expect(resLeaning.multiClockConcordance.concordance).toBe('leaning');

        // 4 distinct systems with 4 distinct lords -> contested (agreeingClocks === 1)
        const actContested: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2030-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 1, lord: 'Ju', from: '2022-01-01', to: '2032-01-01', system: 'ashtottari', family: 'conditional' }),
          act({ level: 1, lord: 'Ma', from: '2024-01-01', to: '2034-01-01', system: 'chara', family: 'rasi' }),
          act({ level: 1, lord: 'Ve', from: '2025-01-01', to: '2035-01-01', system: 'yogini', family: 'conditional' }),
        ];
        const resContested = evaluateActiveDashaWithVargaAndTP({ view: digest, activation: actContested, asOf });
        expect(resContested.multiClockConcordance.agreeingClocks).toBe(1);
        expect(resContested.multiClockConcordance.concordance).toBe('contested');
      });
    });

    describe('Task 2 & 3: Arcs Integration (Self, Love, Work) with resolveActiveMahadasha, Varga & TP', () => {
      it('resolves active dasha across 40+ systems (preferring conditional) in Self, Love, and Work arcs', () => {
        const digest = fakeDigest({
          houses: [
            house(1, { sign: 'Ar', lord: 'Ma' }, 'D1'),
            house(7, { sign: 'Li', lord: 'Ve' }, 'D1'),
            house(10, { sign: 'Cp', lord: 'Sa' }, 'D1'),
          ],
          planets: [
            planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D1'),
            planet('Ve', { sign: 'Li', house: 7, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Me', { sign: 'Vi', house: 6, dignity: 'exalted' }, 'D1'),
            planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D9'),
            planet('Ve', { sign: 'Li', house: 7, dignity: 'own' }, 'D9'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
            planet('Me', { sign: 'Vi', house: 6, dignity: 'exalted' }, 'D9'),
            planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D30'),
            planet('Ve', { sign: 'Li', house: 7, dignity: 'own' }, 'D7'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [],
              dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ma', from: '2026-01-01', to: '2027-01-01' }] }],
              sahams: [],
              yearLord: 'Ma',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
            },
          ],
        });

        // Activation has a conditional active system row active at asOf
        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Me', from: '2020-01-01', to: '2030-01-01', system: 'chara', family: 'conditional' }),
          act({ level: 2, lord: 'Ma', from: '2026-01-01', to: '2027-01-01', system: 'chara', family: 'conditional' }),
          act({ level: 1, lord: 'Sa', from: '2015-01-01', to: '2035-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        // 1. Self Arc
        const selfArc = buildSelfCharacterArc(digest, activation, asOf, { ageYears: 46 });
        expect(selfArc.presentNow.evidence.some((e) => e.startsWith('active_dasha:chara:Me'))).toBe(true);
        expect(selfArc.presentNow.evidence.some((e) => e.startsWith('varga:D30:'))).toBe(true);
        for (const st of selfArc.windows) {
          expect(st.summary).not.toMatch(/radha|pyjhora|jhora/i);
          expect(st.summary).not.toMatch(/vargottama|neecha|drudha|navamsha|mahadasha|\bD1\b|\bD9\b|\bD10\b|\bD7\b|\bD30\b/i);
          expect(st.summary).not.toMatch(/\bguided by (Su|Mo|Ma|Me|Ju|Ve|Sa|Ra|Ke)\b/);
        }

        // 2. Love Arc
        const loveArc = buildLoveRelationshipArc(digest, activation, asOf, { ageYears: 46 });
        expect(loveArc.presentNow.evidence.some((e) => e.startsWith('active_dasha:chara:Me'))).toBe(true);
        expect(loveArc.presentNow.evidence.some((e) => e.startsWith('varga:D7:'))).toBe(true);
        for (const st of loveArc.windows) {
          expect(st.summary).not.toMatch(/radha|pyjhora|jhora/i);
          expect(st.summary).not.toMatch(/vargottama|neecha|drudha|navamsha|mahadasha|\bD1\b|\bD9\b|\bD10\b|\bD7\b|\bD30\b/i);
          expect(st.summary).not.toMatch(/\bguided by (Su|Mo|Ma|Me|Ju|Ve|Sa|Ra|Ke)\b/);
        }

        // 3. Work Arc
        const workArc = buildWorkCharacterArc(digest, activation, asOf, { ageYears: 46 });
        expect(workArc.presentNow.evidence.some((e) => e.startsWith('active_dasha:chara:Me'))).toBe(true);
        expect(workArc.presentNow.evidence.some((e) => e.startsWith('varga:D10:'))).toBe(true);
        for (const st of workArc.windows) {
          expect(st.summary).not.toMatch(/radha|pyjhora|jhora/i);
          expect(st.summary).not.toMatch(/vargottama|neecha|drudha|navamsha|mahadasha|\bD1\b|\bD9\b|\bD10\b|\bD7\b|\bD30\b/i);
          expect(st.summary).not.toMatch(/\bguided by (Su|Mo|Ma|Me|Ju|Ve|Sa|Ra|Ke)\b/);
        }
      });

      it('evaluates pre-36 cohort in Self, Love, and Work arcs without post-36 maturity notes', () => {
        const digest = fakeDigest({
          houses: [
            house(1, { sign: 'Ar', lord: 'Ma' }, 'D1'),
            house(7, { sign: 'Li', lord: 'Ve' }, 'D1'),
            house(10, { sign: 'Cp', lord: 'Sa' }, 'D1'),
          ],
          planets: [
            planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D1'),
            planet('Ve', { sign: 'Li', house: 7, dignity: 'own' }, 'D1'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D1'),
            planet('Ma', { sign: 'Ar', house: 1, dignity: 'own' }, 'D9'),
            planet('Ve', { sign: 'Li', house: 7, dignity: 'own' }, 'D9'),
            planet('Sa', { sign: 'Cp', house: 10, dignity: 'own' }, 'D9'),
          ],
        });

        const activation: ActivationRow[] = [
          act({ level: 1, lord: 'Sa', from: '2020-01-01', to: '2039-01-01', system: 'vimshottari', family: 'vimshottari' }),
          act({ level: 2, lord: 'Ma', from: '2026-01-01', to: '2027-01-01', system: 'vimshottari', family: 'vimshottari' }),
        ];

        // Archisha (age ~28 <= 36)
        const selfArc = buildSelfCharacterArc(digest, activation, asOf, { ageYears: 28 });
        expect(selfArc.presentNow.summary).not.toContain('karmic maturity (post-36)');

        const loveArc = buildLoveRelationshipArc(digest, activation, asOf, { ageYears: 28 });
        expect(loveArc.presentNow.summary).not.toContain('maturing into lasting clarity (post-36)');

        const workArc = buildWorkCharacterArc(digest, activation, asOf, { ageYears: 28 });
        expect(workArc.presentNow.summary).not.toContain('career maturity past 36');
      });

      it('workD10Check in Career splits when age > 36 and D9 is test (false promise), but does not split when age <= 36', () => {
        const digest = fakeDigest({
          planets: [
            planet('Su', { sign: 'Ar', house: 10, dignity: 'exalted' }, 'D1'),     // support in D1
            planet('Su', { sign: 'Li', house: 8, dignity: 'debilitated' }, 'D9'),   // test in D9 (false promise)
            planet('Su', { sign: 'Le', house: 10, dignity: 'own' }, 'D10'),        // support in D10
          ],
        });

        // Mature native (> 36): false promise in D9 splits the vote
        const matureCheck = workD10Check(digest, 'Su', 46);
        expect(matureCheck.d1Side).toBe('support');
        expect(matureCheck.d10Side).toBe('support');
        expect(matureCheck.d9Side).toBe('test');
        expect(matureCheck.split).toBe(true);

        // Pre-mature native (<= 36): physical foundation dominates; D9 does not split the vote
        const preMatureCheck = workD10Check(digest, 'Su', 25);
        expect(preMatureCheck.split).toBe(false);
        expect(preMatureCheck.agrees).toBe(true);
      });

      it('workAnnualVote applies +1 for d9_redeemed and -1 for d9_weakened when age > 36', () => {
        // 1. Redeemed yearLord (Me debilitated D1, exalted D9)
        const digestRedeemed = fakeDigest({
          planets: [
            planet('Me', { sign: 'Pi', house: 12, dignity: 'debilitated' }, 'D1'),
            planet('Me', { sign: 'Vi', house: 6, dignity: 'exalted' }, 'D9'),
            planet('Me', { sign: 'Vi', house: 10, dignity: 'exalted' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [house(10, { lord: 'Me', lordHouse: 10, lordDignity: 'own' })],
              dashas: [],
              sahams: [],
              yearLord: 'Me',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
              startBasis: 'tp_start',
            },
          ],
        });
        const voteRedeemed = workAnnualVote(digestRedeemed, asOf, 46);
        expect(voteRedeemed).not.toBeNull();
        expect(voteRedeemed?.vote).toBe('support');

        // 2. Weakened yearLord (Su exalted D1, debilitated D9)
        const digestWeakened = fakeDigest({
          planets: [
            planet('Su', { sign: 'Ar', house: 1, dignity: 'exalted' }, 'D1'),
            planet('Su', { sign: 'Li', house: 7, dignity: 'debilitated' }, 'D9'),
            planet('Su', { sign: 'Li', house: 8, dignity: 'debilitated' }, 'D10'),
          ],
          annual: [
            {
              kind: 'TP',
              year: 2026,
              varga: 'D1',
              lagna: 'Ar',
              houses: [house(10, { lord: 'Su', lordHouse: 8, lordDignity: 'debilitated' })],
              dashas: [],
              sahams: [],
              yearLord: 'Su',
              start: '2026-04-10 12:00:00',
              end: '2027-04-29 12:00:00',
              startBasis: 'tp_start',
            },
          ],
        });
        const voteWeakened = workAnnualVote(digestWeakened, asOf, 46);
        expect(voteWeakened).not.toBeNull();
        expect(voteWeakened?.vote).toBe('test');
      });
    });

    describe('Task 4: Card-Level Reading Context with Active Timing and Divisional Routing', () => {
      it('renderActiveTimingAndVargaBlock emits timing windows and correct divisional routing', () => {
        const block = renderActiveTimingAndVargaBlock({
          clock: { primary: 'ashtottari' },
          periods: {
            running: { lord: 'Sa', from: '2020-01-01', to: '2030-01-01' },
            runningSub: { lord: 'Ju', from: '2026-01-01', to: '2027-01-01' },
          },
          year: {
            from: '2026-04-10',
            to: '2027-04-29',
            yearLord: 'Ju',
            shortClock: { lord: 'Ve', from: '2026-04-10', to: '2026-07-15' },
          },
          ageYears: 46,
          card: 'drive',
        });

        const text = block.join('\n');
        expect(text).toContain('# ACTIVE DASHA & TIMING WINDOWS');
        expect(text).toContain('- Active Reading Clock: ashtottari');
        expect(text).toContain('- Current Mahadasha: Sa (2020-01-01 to 2030-01-01)');
        expect(text).toContain('- Current Antardasha: Ju (2026-01-01 to 2027-01-01)');
        expect(text).toContain('- Running Tithi Pravesha Year: 2026');
        expect(text).toContain('- Annual Year Lord: Ju');
        expect(text).toContain('- Annual Short Clock: Ve (2026-04-10 to 2026-07-15)');
        expect(text).toContain('Karmic Maturation Status (>36): Active. Mutual D1+D9 confirmation applies');
        expect(text).toContain('# DIVISIONAL CHART ROUTING (Active Dasha & Annual TP Context)');
        expect(text).toContain('Target Card Routing (`drive`): Focus on D10 (Dashamsha)');
        expect(text).not.toMatch(/radha|pyjhora|jhora/i);
      });

      it('routes departmental vargas correctly across card types', () => {
        const checkCardVarga = (card: string, expectedVarga: string) => {
          const block = renderActiveTimingAndVargaBlock({ card: card as never, ageYears: 25 });
          const text = block.join('\n');
          expect(text).toContain(`Target Card Routing (\`${card}\`): Focus on ${expectedVarga}`);
          expect(text).toContain('Karmic Maturation Status (<=36): Pre-maturation phase');
        };

        checkCardVarga('presence', 'D7 (Saptamsha) & D9 (Navamsha)');
        checkCardVarga('mind', 'D24 (Siddhamsha)');
        checkCardVarga('purpose', 'D20 (Vimshamsha)');
        checkCardVarga('stuck', 'D30 (Trimshamsha)');
        checkCardVarga('chapter', 'D10 (Dashamsha)');
      });

      it('cardInstruction on single-card path incorporates renderActiveTimingAndVargaBlock with age-36 branching and card varga routing', () => {
        const mockOracleInput = {
          ctx: {
            userId: 'u1',
            kundliId: 'k1',
            asOf,
            sub: {
              clock: { primary: 'vimshottari' },
              periods: {
                running: { lord: 'Sa', from: '2020-01-01', to: '2039-01-01' },
                runningSub: { lord: 'Ju', from: '2026-01-01', to: '2027-01-01' },
              },
              year: {
                from: '2026-04-10',
                to: '2027-04-29',
                yearLord: 'Ju',
                shortClock: { lord: 'Ve', from: '2026-04-10', to: '2026-07-15' },
              },
              profile: {
                ageYears: 46,
                declined: [],
                lastConfirms: [],
                gender: null,
                role: 'public',
                facts: {},
                mood: null,
              },
            },
          } as unknown as Parameters<typeof cardInstruction>[0],
          card: 'drive' as const,
          matters: ['career_and_standing'] as const,
          board: ['drive'],
          frame: {
            clock: { primary: 'vimshottari' },
            spans: [{ id: 's1', from: '2026-10-01', to: '2027-01-01', tone: 'heavy' }],
          } as unknown as Parameters<typeof cardInstruction>[0]['frame'],
          frameText: 'FRAME_TEXT',
          frameKeys: [],
          prefix: { text: 'PREFIX_TEXT', keys: [] },
          ledger: null,
          matterSlices: [],
          dates: new Set<string>(),
          answers: 'none',
          model: 'gemini-1.5-pro',
          cacheOwner: { userId: 'u1', kundliId: 'k1' },
        };

        const result = cardInstruction(mockOracleInput as never, []);
        expect(result.text).toContain('# ACTIVE DASHA & TIMING WINDOWS');
        expect(result.text).toContain('- Active Reading Clock: vimshottari');
        expect(result.text).toContain('- Current Mahadasha: Sa (2020-01-01 to 2039-01-01)');
        expect(result.text).toContain('- Current Antardasha: Ju (2026-01-01 to 2027-01-01)');
        expect(result.text).toContain('Karmic Maturation Status (>36): Active. Mutual D1+D9 confirmation applies');
        expect(result.text).toContain('Target Card Routing (`drive`): Focus on D10 (Dashamsha)');
      });

      it('buildCardPack on grouped-card path incorporates renderActiveTimingAndVargaBlock with age-36 branching', () => {
        const mockPackInput = {
          ctx: {
            userId: 'u1',
            kundliId: 'k1',
            asOf,
            sub: {
              clock: { primary: 'vimshottari' },
              periods: {
                running: { lord: 'Sa', from: '2020-01-01', to: '2039-01-01' },
                runningSub: { lord: 'Ju', from: '2026-01-01', to: '2027-01-01' },
              },
              year: {
                from: '2026-04-10',
                to: '2027-04-29',
                yearLord: 'Ju',
                shortClock: { lord: 'Ve', from: '2026-04-10', to: '2026-07-15' },
              },
              profile: {
                ageYears: 46,
                declined: [],
                lastConfirms: [],
                gender: null,
                role: 'public',
                facts: {},
                mood: null,
              },
            },
          } as unknown as Parameters<typeof buildCardPack>[0]['ctx'],
          cards: ['drive', 'lagna'] as const,
          frame: {
            clock: { primary: 'vimshottari' },
            spans: [{ id: 's1', from: '2026-10-01', to: '2027-01-01', tone: 'heavy' }],
          } as unknown as Parameters<typeof buildCardPack>[0]['frame'],
          frameText: 'FRAME_TEXT',
          frameKeys: [],
          prefix: { text: 'PREFIX_TEXT', keys: [] },
          portrait: null,
          ledger: null,
          slices: [],
          answers: 'none',
        };

        const pack = buildCardPack(mockPackInput as never);
        expect(pack.text).toContain('# ACTIVE DASHA & TIMING WINDOWS');
        expect(pack.text).toContain('- Active Reading Clock: vimshottari');
        expect(pack.text).toContain('- Current Mahadasha: Sa (2020-01-01 to 2039-01-01)');
        expect(pack.text).toContain('- Current Antardasha: Ju (2026-01-01 to 2027-01-01)');
        expect(pack.text).toContain('Karmic Maturation Status (>36): Active. Mutual D1+D9 confirmation applies');
        expect(pack.text).toContain('# DIVISIONAL CHART ROUTING');
      });
    });
  });
});
