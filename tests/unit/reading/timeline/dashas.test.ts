import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ashtottariApplies, buildDashaStack, lordCode, rowsFromTree, runningOn, signIndexOf } from '../../../../src/reading/timeline/dashas.js';
import { loadG1Dossier, loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RANGE = { from: '2008-10-01', to: '2026-11-01' };

describe('timeline dasha stack (doc 27 §B.4 stage 2)', () => {
  it('reads lord and sign names in Radha and legacy spellings', () => {
    expect(lordCode('Raagu')).toBe('Ra');
    expect(lordCode('Raagu☊')).toBe('Ra');
    expect(lordCode('Jupiter♃')).toBe('Ju');
    expect(lordCode('Sa')).toBe('Sa');
    expect(lordCode('Pisces')).toBeNull();
    expect(signIndexOf('♓︎Pisces')).toBe(11);
    expect(signIndexOf('Aries')).toBe(0);
  });

  const inputs = loadG1TimelineInputs();
  const stack = buildDashaStack(inputs.dossier, inputs.items, RANGE);

  it('takes every system from the G1 catalogue fixtures', () => {
    expect(stack.sources).toEqual({ vimsottari: 'catalogue', yogini: 'catalogue', tithi_ashtottari: 'catalogue', ashtottari: 'catalogue', narayana: 'catalogue' });
    expect(stack.missing).toEqual([]);
    for (const r of stack.rows) {
      expect(r.from < r.to).toBe(true);
      expect(r.evidence).toMatch(/^dasha\.(vimsottari|yogini|tithi_ashtottari|ashtottari|narayana|vimshottari)\.(periods|mahadashas)\[\d+\]/);
    }
  });

  it('matches the dossier on what runs today (Saturn MD, Ketu AD, Venus PD)', () => {
    const today = runningOn(stack.rows, 'vimsottari', '2026-10-24');
    expect(today.map((r) => [r.level, r.lord])).toEqual([
      [1, 'Sa'],
      [2, 'Ke'],
      [3, 'Ve'],
    ]);
    expect(today[1]!.parentLord).toBe('Sa');
    const d = loadG1Dossier().dasha.vimshottari.current;
    expect([d.md, d.ad, d.pd]).toEqual(['Sa', 'Ke', 'Ve']);
  });

  it('keeps Narayana as signs, with the MD sign as parent', () => {
    const nar = runningOn(stack.rows, 'narayana', '2026-10-24');
    expect(nar.every((r) => r.sign != null && r.lord == null)).toBe(true);
    expect(nar.at(-1)!.parentSign).toBe(nar[0]!.sign);
  });

  it('reads the legacy Narayana array the same way', () => {
    const legacy = JSON.parse(readFileSync(path.join(root, 'evals/fixtures/G1/legacy/narayana_dasa.json'), 'utf8'));
    const rows = rowsFromTree('narayana', legacy, RANGE, 'dasha.narayana')!;
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0]!.sign).toBe(11); // Pisces MD from birth
  });

  it('falls back to the dossier when a catalogue item is missing', () => {
    const s = buildDashaStack(inputs.dossier, {}, RANGE);
    expect(s.sources.vimsottari).toBe('dossier');
    expect(s.sources.narayana).toBe('dossier');
    expect(s.missing).toEqual(['yogini', 'tithi_ashtottari', 'ashtottari']);
  });

  it('reads Ashtottari applicability from dasha.applicable', () => {
    expect(ashtottariApplies(inputs.items['dasha.applicable'])).toBe('dasha.applicable[0]');
    expect(ashtottariApplies([{ type: 'dasha.ashtottari', applies: false }])).toBeNull();
    expect(ashtottariApplies(null)).toBeNull();
  });
});
