import { afterEach, describe, expect, it } from 'vitest';
import { SUBJECT_IDS } from '../../../src/reading/packs/frames.js';
import { buildEvidencePack, fullBaseExtras, renderBase } from '../../../src/reading/packs/selector.js';
import { readingFullBase } from '../../../src/reading/config.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const mk = (subject: (typeof SUBJECT_IDS)[number]) =>
  buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent: { horizon: '1y', mentionsPlanets: [], focusPoints: [] } });

/** Same estimate the pack uses (characters / 3.6). Gemini's real count for JSON is higher, so this is the optimistic side. */
const approxTokens = (s: string): number => Math.ceil(s.length / 3.6);
/** Gemini 3.x explicit caches need at least this many tokens in the cached prefix. */
const CACHE_MIN_TOKENS = 4096;

afterEach(() => {
  delete process.env.READING_FULL_BASE;
});

describe('full base (cacheable prefix)', () => {
  it('is on by default and READING_FULL_BASE=0 / false / off turn it off', () => {
    delete process.env.READING_FULL_BASE;
    expect(readingFullBase()).toBe(true);
    for (const v of ['0', 'false', 'off']) {
      process.env.READING_FULL_BASE = v;
      expect(readingFullBase()).toBe(false);
    }
  });

  it('lifts the cacheable base well past the 4,096-token minimum', () => {
    const full = approxTokens(renderBase(mk('career_work')));
    process.env.READING_FULL_BASE = '0';
    const small = approxTokens(renderBase(mk('career_work')));
    // eslint-disable-next-line no-console
    console.log(`base tokens (estimate): small ${small}, full ${full}`);
    expect(full).toBeGreaterThanOrEqual(CACHE_MIN_TOKENS + 800); // margin: the real tokenizer counts JSON as more tokens
    expect(full).toBeGreaterThan(small);
  });

  it('carries every divisional chart the dossier holds, ashtavarga, the dasha tree, arudhas, special lagnas, yogas and doshas', () => {
    const base = mk('career_work').sections.base as Record<string, any>;
    expect(Object.keys(base.all_vargas).sort()).toEqual(Object.keys(dossier.vargas).sort());
    for (const v of Object.values<any>(base.all_vargas)) {
      expect(Object.keys(v.planets).length).toBeGreaterThanOrEqual(9);
      expect(v.planets.Su).toMatchObject({ s: expect.any(Number), h: expect.any(Number) });
    }
    expect(base.ashtakavarga.sav).toHaveLength(12);
    expect(Object.keys(base.ashtakavarga.bav).length).toBeGreaterThanOrEqual(7);
    expect(base.dasha_tree.vimshottari.mahadashas.length).toBe(dossier.dasha.vimshottari.mahadashas.length);
    expect(base.dasha_tree.vimshottari.antardashas.length).toBeGreaterThan(0);
    expect(base.dasha_tree.narayana.length).toBeGreaterThan(0);
    expect(base.arudhas).toBeTruthy();
    expect(base.special_lagnas).toBeTruthy();
    expect(Array.isArray(base.yogas)).toBe(true);
    expect(Array.isArray(base.doshas)).toBe(true);
  });

  it('keeps the original base keys unchanged', () => {
    const full = mk('career_work').sections.base as Record<string, unknown>;
    process.env.READING_FULL_BASE = '0';
    const small = mk('career_work').sections.base as Record<string, unknown>;
    for (const k of Object.keys(small)) expect(full[k]).toEqual(small[k]);
    expect(Object.keys(small)).not.toContain('all_vargas');
  });

  it('is byte-identical for every subject, so one cache entry serves every question', () => {
    const texts = new Set(SUBJECT_IDS.map((s) => renderBase(mk(s))));
    expect(texts.size).toBe(1);
  });

  it('is deterministic and does not mutate the dossier', () => {
    const before = JSON.stringify(dossier);
    const a = JSON.stringify(fullBaseExtras(dossier));
    const b = JSON.stringify(fullBaseExtras(dossier));
    expect(a).toBe(b);
    expect(JSON.stringify(dossier)).toBe(before);
  });
});
