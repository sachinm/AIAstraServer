/**
 * docs/dashboards/13 §4.1 (Server S1): the chart-language reading served with each card, derived from the stored Oracle
 * card. Two real stored Oracle cards (mind, body) go through the builder; brace keys, colon keys, snake_case ids and
 * engine names never reach the page; the Oracle's agreement sentence is never served. No model call, no database.
 */
import { describe, expect, it } from 'vitest';
import { chartReadingOf, chartText } from '../../../../src/reading/cards/chart.js';
import { readCardReadings } from '../../../../src/reading/cards/store.js';
import { readSelfV3Cards } from '../../../../src/reading/self/v3/store.js';

const MIND = {
  card: 'mind',
  headline: 'h',
  gift: 'Mercury in the eighth house provides penetrative analytical insight and an ability to calmly untangle complex situations.',
  knot: 'The Kala Sarpa yoga spanning the fifth and eleventh houses triggers overactive speculation and restless shifts in judgment when unchecked.',
  certainty: 'likely',
  confirm: null,
  pattern: null,
  evidence: ['planet:D1.Me', 'yoga:kala_sarpa'],
  spans: [
    {
      span: 's1',
      tone: 'mixed',
      mode: 'build',
      asks: "Running Rahu Mahadasha over the fifth house paired with fifth lord Moon's debilitation in the ninth requires disciplined grounding of creative impulses. Confirmation between D1 and D9 Aquarius Moon aligns inner analytical judgment with realistic external plans.",
      obstacle: 'o',
      evidence: ['dasha:vimsottari/1/Ra'],
      agreement: 'Five clocks agree on home_and_peace, ideas_and_children, and self_and_body matters with mixed polarity.',
    },
  ],
};

const BODY = {
  card: 'body',
  headline: 'h',
  gift: 'A well-placed lagna lord Jupiter in the seventh house grants resilient underlying stamina when outward exertion is balanced with proper recuperation.',
  knot: 'Debilitated Venus in the navamsha second house combined with sixth house natal placement invites physical wear whenever daily limits are neglected.',
  certainty: 'likely',
  confirm: null,
  pattern: null,
  evidence: ['planet:D1.Ju'],
  spans: [
    {
      span: 's1',
      tone: 'mixed',
      mode: 'build',
      asks: 'Active sub-period lord Venus occupying the sixth house paired with running Jupiter sub-sub dasha demands establishing sustainable physical routines and measured pacing. Because karmic age exceeds 36, first house indicators confirmed across D1 and D9 require balancing outward physical output with deliberate recuperation.',
      obstacle: 'o',
      evidence: ['planet:D1.Ve'],
      agreement: 'Five clocks agree on self_and_body matters with mixed polarity, while sudden_and_hidden leans heavy across two clocks.',
    },
  ],
};

/** every string anywhere in a value */
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

const assertClean = (out: unknown) => {
  const text = JSON.stringify(out);
  expect(text).not.toMatch(/clocks agree/i);
  expect(text).not.toMatch(/polarity/i);
  for (const s of strings(out)) {
    expect(s).not.toMatch(/[a-z0-9]+_[a-z0-9]+/i);
    expect(s).not.toMatch(/[{}]/);
    expect(s).not.toMatch(/\b(aiastra_radha|pyjhora|jhora|radha)\b/i);
    expect(s).not.toMatch(/\b(planet|house|yoga|dasha|claim):\S/i);
  }
};

describe('chartReadingOf on real stored Oracle cards', () => {
  it('serves the mind card gift, knot, certainty and what the chart shows', () => {
    const out = chartReadingOf(MIND)!;
    expect(out).toEqual({ gift: MIND.gift, knot: MIND.knot, certainty: 'likely', spans: [{ span: 's1', shows: MIND.spans[0]!.asks }] });
    assertClean(out);
  });
  it('serves the body card the same way', () => {
    const out = chartReadingOf(BODY)!;
    expect(out).toEqual({ gift: BODY.gift, knot: BODY.knot, certainty: 'likely', spans: [{ span: 's1', shows: BODY.spans[0]!.asks }] });
    assertClean(out);
  });
});

describe('chart text cleaning', () => {
  it('strips brace keys and replaces engine names', () => {
    expect(chartText('Saturn presses the sixth house {planet:D1.Sa, house:D1.h6} as Radha reads it.')).toBe('Saturn presses the sixth house as traditional calculations reads it.');
    expect(chartText('  pyjhora shows Jupiter strong {yoga:gaja} ')).toBe('traditional calculations shows Jupiter strong');
  });
  it('drops a sentence holding a snake_case id or a bare colon key rather than serve it broken', () => {
    expect(chartText('Five clocks agree on home_and_peace matters.')).toBeNull();
    expect(chartText('Saturn in planet:D1.Sa presses work.')).toBeNull();
    const out = chartReadingOf({
      gift: 'Steady stamina when rest is kept {planet:D1.Ju}.',
      knot: 'The work_load_and_health matter is pressed.',
      certainty: 'possible',
      spans: [
        { span: 's1', asks: 'Saturn {dasha:vimsottari/2/Sa} asks for patience.', agreement: 'x' },
        { span: 's2', asks: 'Rahu over yoga:kala_sarpa unsettles plans.' },
        { span: 's3', asks: '{planet:D1.Ra}' },
      ],
    })!;
    expect(out).toEqual({ gift: 'Steady stamina when rest is kept.', knot: null, certainty: 'possible', spans: [{ span: 's1', shows: 'Saturn asks for patience.' }] });
    assertClean(out);
  });
  it('gives null when nothing is left, and for a missing or malformed card', () => {
    expect(chartReadingOf({ gift: '', knot: '{planet:D1.Sa}', certainty: 'likely', spans: [{ span: 's1', asks: '  ' }] })).toBeNull();
    expect(chartReadingOf(null)).toBeNull();
    expect(chartReadingOf(undefined)).toBeNull();
    expect(chartReadingOf('oracle')).toBeNull();
    expect(chartReadingOf({ gift: 7, knot: ['x'], spans: 'no' })).toBeNull();
    expect(chartReadingOf({ gift: 'Plain gift.', spans: [null, { asks: 'no span id' }, { span: 's1', asks: 3 }] })).toEqual({ gift: 'Plain gift.', knot: null, certainty: null, spans: [] });
  });
});

describe('stored rows serve chart with no rebuild', () => {
  const content = { line: 'A steady line.', spans: [], confirm: null, pattern: null, ladder: null, agreement: null };
  it('readCardReadings derives chart from the row oracle, and still serves a row without one', async () => {
    const prisma = {
      techniqueOutput: {
        findMany: async () => [
          { output: { card: 'mind', content, oracle: MIND }, created_at: new Date() },
          { output: { card: 'body', content, oracle: { gift: 42, spans: 'broken' } }, created_at: new Date() },
          { output: { card: 'dating_pulse', content }, created_at: new Date() },
        ],
      },
    } as never;
    const out = await readCardReadings(prisma, 'k1', 'vimsottari');
    expect(out.mind?.chart?.gift).toBe(MIND.gift);
    expect(out.mind?.chart?.spans).toEqual([{ span: 's1', shows: MIND.spans[0]!.asks }]);
    expect(out.mind?.line).toBe('A steady line.');
    expect(out.body).toEqual({ ...content, chart: null });
    expect(out.dating_pulse).toEqual({ ...content, chart: null });
    assertClean(out.mind?.chart);
  });
  it('readSelfV3Cards (the three-call Self store) derives chart per card from the stored Oracle output', async () => {
    const prisma = {
      techniqueOutput: {
        findFirst: async () => ({ output: { key: 'k', frame: {}, oracle: { cards: { body: BODY } }, cards: { body: content, mind: content }, cardStatus: {} }, created_at: new Date() }),
      },
    } as never;
    const out = (await readSelfV3Cards(prisma, 'k1', 'vimsottari'))!;
    expect(out.body?.chart?.knot).toBe(BODY.knot);
    expect(out.mind).toEqual({ ...content, chart: null });
  });
});
