/** The Oracle's area document (docs/reading-engine/65 §3): parse, validate against the brief and the stored windows, text form. */
import { describe, expect, it } from 'vitest';
import { areaDocToText, cleanAreaText, oracleAreaSchema, parseAreaDoc, validateAreaDoc } from '../../../../src/reading/self/areaDoc.js';
import { SELF_PANEL_IDS } from '../../../../src/reading/self/types.js';

const ctx = {
  panelIds: SELF_PANEL_IDS,
  allowedKeys: new Set(['planet:D1.Ju', 'house:D1.h7', 'lagna.lord_house', 'chapters.running']),
  boundaries: new Set(['2019-02-16', '2028-02-16', '2025-11-16', '2027-01-01']),
  windows: [
    { from: '2019-02-16', to: '2028-02-16' },
    { from: '2025-11-16', to: '2027-01-01' },
  ],
  asOf: '2026-11-09',
};

const good = {
  id: 'diagnosis',
  headline: 'Your sense of self is lived through partners, and this chapter asks you to pace yourself.',
  paragraphs: ['Jupiter, your lagna lord, sits in the 7th in Virgo with the Sun and Saturn {planet:D1.Ju, house:D1.h7}.', 'The Rahu chapter runs to 16 Feb 2028 {chapters.running}.'],
  dates: [{ from: '2025-11-16', to: '2027-01-01', label: 'Venus sub-chapter' }],
  actions: [{ from: '2026-11-09', to: '2027-01-01', text: 'Finish what the partnership started.' }],
  certainty: 'strong',
  evidence: ['planet:D1.Ju', 'lagna.lord_house', 'planet:D1.Xx'],
  validUntil: '2027-01-01',
};

describe('area document', () => {
  it('the schema names every panel and forces the fields', () => {
    const s = oracleAreaSchema(SELF_PANEL_IDS) as { properties: { areas: { items: { properties: { id: { enum: string[] } }; required: string[] } } }; required: string[] };
    expect(s.properties.areas.items.properties.id.enum).toEqual([...SELF_PANEL_IDS]);
    expect(s.properties.areas.items.required).toContain('paragraphs');
    expect(s.required).toEqual(['areas', 'validUntil']);
  });

  it('parses plain JSON and fenced JSON; refuses anything without areas', () => {
    expect(parseAreaDoc('{"areas":[],"validUntil":"always"}')).toEqual({ areas: [], validUntil: 'always' });
    expect(parseAreaDoc('```json\n{"areas":[{"id":"year"}],"validUntil":"2027-01-01"}\n```')?.areas).toHaveLength(1);
    expect(parseAreaDoc('In short: an essay.')).toBeNull();
    expect(parseAreaDoc('{"text":"x"}')).toBeNull();
  });

  it('keeps a grounded area, strips inline citations, drops the unknown evidence key', () => {
    const v = validateAreaDoc({ areas: [good], validUntil: '2027-01-01' }, ctx);
    const a = v.doc.areas.diagnosis!;
    expect(a.headline).toBe(good.headline);
    expect(a.paragraphs).toEqual(['Jupiter, your lagna lord, sits in the 7th in Virgo with the Sun and Saturn.', 'The Rahu chapter runs to 16 Feb 2028.']);
    expect(a.dates).toEqual([{ from: '2025-11-16', to: '2027-01-01', label: 'Venus sub-chapter' }]);
    expect(a.actions).toHaveLength(1);
    expect(a.evidence).toEqual(['planet:D1.Ju', 'lagna.lord_house']);
    expect(v.gaps).toEqual(['diagnosis: evidence keys not in the brief dropped (planet:D1.Xx)']);
    expect(v.withheld).toEqual([]);
    expect(v.doc.validUntil).toBe('2027-01-01');
  });

  it('drops a paragraph citing an unknown key, a date outside every window, and withholds an area with nothing left', () => {
    const v = validateAreaDoc(
      {
        areas: [
          { ...good, id: 'mind', paragraphs: ['Invented {planet:D1.Ve}.'], dates: [{ from: '2030-01-01', to: '2030-06-01', label: 'far' }] },
          { ...good, id: 'money' },
          { ...good, id: 'body', headline: 'A headline that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on far too long. Second sentence.' },
        ],
        validUntil: '2020-01-01',
      },
      ctx,
    );
    expect(v.doc.areas.mind).toBeUndefined();
    expect(v.withheld).toEqual(['mind', 'body']);
    expect(v.gaps).toContain('mind: a paragraph cited an unknown key (planet:D1.Ve)');
    expect(v.gaps).toContain('mind: date 2030-01-01..2030-06-01 (far) is outside every stored window');
    expect(v.gaps).toContain('money: not a panel of this board');
    // the first sentence is itself over 22 words, so the headline is withheld and the area with it
    expect(v.doc.areas.body).toBeUndefined();
    expect(v.withheld).toContain('body');
    expect(v.gaps).toContain('body: headline over 22 words, withheld');
    expect(v.doc.validUntil).toBe('always');
  });

  it('a paragraph repeated in a second area is dropped there; a second entry for one area is dropped', () => {
    const v = validateAreaDoc({ areas: [good, { ...good, id: 'chapters' }, { ...good, id: 'diagnosis' }], validUntil: 'always' }, ctx);
    expect(v.doc.areas.diagnosis?.paragraphs).toHaveLength(2);
    expect(v.doc.areas.chapters).toBeUndefined();
    expect(v.withheld).toEqual(['chapters']);
    expect(v.gaps).toContain('diagnosis: returned twice; the second dropped');
  });

  it('cleanAreaText removes citations, empty ticks, engine names and spaces before punctuation', () => {
    expect(cleanAreaText('Jupiter `{planet:D1.Ju}` sits here `` , said radha .')).toBe('Jupiter sits here, said traditional calculations.');
  });

  it('areaDocToText writes one section per area in order with its dates and actions', () => {
    const v = validateAreaDoc({ areas: [good], validUntil: '2027-01-01' }, ctx);
    const t = areaDocToText(v.doc, { diagnosis: 'In short' }, SELF_PANEL_IDS);
    expect(t.startsWith('## In short\n\n**Your sense of self')).toBe(true);
    expect(t).toContain('- 2025-11-16..2027-01-01 Venus sub-chapter');
    expect(t).toContain('- Do 2026-11-09..2027-01-01: Finish what the partnership started.');
    expect(t.endsWith('VALID_UNTIL: 2027-01-01')).toBe(true);
  });
});
