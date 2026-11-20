/**
 * Card routing (docs/techniques/08, plan 09 §4): every readable card has a route and an existing lens recipe; the three
 * corrections hold (no D7 for romance, no D11 or A5 for friends, the D30 only on the Self body cards); every chart a card
 * brief names is in its route or the natal pair D1/D9. No database, no model.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_V3_CARDS } from '../../../../src/reading/boards/v3Cards.js';
import { LENS_IDS, NARAYANA_CONTROLLING_HOUSE, recipeText, routeFor, ROUTED_CARDS, type LensId } from '../../../../src/reading/cards/routing.js';
import { cardBriefPrompt } from '../../../../src/reading/cards/registry.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import { READABLE_CARDS, SELF_CARDS } from '../../../../src/reading/self/v3/cards.js';

const H: Record<string, number> = {
  self_and_body: 1,
  money_in_hand: 2,
  effort_and_courage: 3,
  home_and_peace: 4,
  ideas_and_children: 5,
  work_load_and_health: 6,
  partnership: 7,
  sudden_and_hidden: 8,
  luck_and_belief: 9,
  career_and_standing: 10,
  gains_and_network: 11,
  loss_rest_and_distance: 12,
};

const READABLE_BOARD = BOARD_V3_CARDS.filter((c) => c.offered);
const READABLE_IDS = [...READABLE_CARDS, ...READABLE_BOARD.map((c) => c.id)];

/** Chart names in a brief: "D9", "D-10", and the Sanskrit names of the vargas. */
const WORD_CHARTS: Array<[RegExp, string]> = [
  [/navam[sś]h?a/i, 'D9'],
  [/da[sś]am[sś]h?a/i, 'D10'],
  [/saptam[sś]h?a/i, 'D7'],
  [/trim[sś]am[sś]h?a/i, 'D30'],
  [/siddham[sś]h?a|chaturvim[sś]am[sś]h?a/i, 'D24'],
  [/vim[sś]am[sś]h?a/i, 'D20'],
  [/shodasam[sś]h?a|[sś]o[dḍ]a[sś]am[sś]h?a/i, 'D16'],
  [/chaturtham[sś]h?a/i, 'D4'],
  [/drekkana|drekkāṇa/i, 'D3'],
  [/dwada[sś]am[sś]h?a|dvāda[sś]ām[sś]a/i, 'D12'],
];

function chartsNamed(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\bD-?(\d{1,2})\b/g)) out.add(`D${m[1]}`);
  for (const [re, chart] of WORD_CHARTS) if (re.test(text)) out.add(chart);
  return out;
}

describe('card routing (doc 08)', () => {
  it('routes exactly the 90 readable cards: 21 Self, 36 Love, 33 Work', () => {
    expect(READABLE_CARDS).toHaveLength(21);
    expect(READABLE_BOARD.filter((c) => c.board === 'love')).toHaveLength(36);
    expect(READABLE_BOARD.filter((c) => c.board === 'work')).toHaveLength(33);
    expect([...ROUTED_CARDS].sort()).toEqual([...READABLE_IDS].sort());
    expect(new Set(ROUTED_CARDS).size).toBe(90);
  });

  it('every readable card has a route on its own board and lens, and an existing recipe', () => {
    for (const id of READABLE_CARDS) {
      const r = routeFor(id);
      expect(r, id).not.toBeNull();
      expect(r!.board, id).toBe('self');
      expect(r!.lens.startsWith('self.'), id).toBe(true);
      expect(recipeText(r!.lens), id).toBeTruthy();
    }
    for (const c of READABLE_BOARD) {
      const r = routeFor(c.id);
      expect(r, c.id).not.toBeNull();
      expect(r!.board, c.id).toBe(c.board);
      expect(r!.lens, c.id).toBe(`${c.board}.${c.lens}`);
      expect(recipeText(r!.lens), c.id).toBeTruthy();
    }
  });

  it('cards that are not readable yet have no route', () => {
    const notReadable = [
      ...SELF_CARDS.filter((c) => !READABLE_CARDS.includes(c.id)).map((c) => c.id),
      ...BOARD_V3_CARDS.filter((c) => !c.offered).map((c) => c.id),
    ];
    expect(notReadable.length).toBe(8);
    for (const id of notReadable) expect(routeFor(id), id).toBeNull();
    expect(routeFor('no_such_card')).toBeNull();
  });

  it('every route is well formed and shares a house with its card', () => {
    for (const id of READABLE_IDS) {
      const r = routeFor(id)!;
      expect(r.card).toBe(id);
      expect(r.houses.length, id).toBeGreaterThan(0);
      for (const h of r.houses) expect(h >= 1 && h <= 12, `${id} house ${h}`).toBe(true);
      expect(r.promiseCharts.slice(0, 2), id).toEqual(['D1', 'D9']);
      expect(r.yearCharts[0], id).toBe('D1');
      for (const ch of [...r.promiseCharts, ...r.yearCharts]) expect(ch, id).toMatch(/^D\d{1,2}$/);
      expect(r.signDasha, id).toMatch(/^Narayana D(1|9|10)( \+ Sudasa)?$/);
      const def = SELF_CARDS.find((c) => c.id === id) ?? BOARD_V3_CARDS.find((c) => c.id === id)!;
      const matterHouses = def.matters.map((m) => H[m]);
      expect(r.houses.some((h) => matterHouses.includes(h)), id).toBe(true);
    }
  });

  it('a varga Narayana has its controlling house (Table 29: 9th for D9, 10th for D10)', () => {
    expect(NARAYANA_CONTROLLING_HOUSE.D9).toBe(9);
    expect(NARAYANA_CONTROLLING_HOUSE.D10).toBe(10);
    for (const id of READABLE_IDS) {
      const chart = routeFor(id)!.signDasha.match(/^Narayana (D\d+)/)![1]!;
      if (chart !== 'D1') expect(NARAYANA_CONTROLLING_HOUSE[chart], id).toBeTypeOf('number');
    }
  });

  it('romance is never read from the D7: no Dating or Marriage route uses it, nor any Craft route', () => {
    for (const id of READABLE_IDS) {
      const r = routeFor(id)!;
      if (['love.dating', 'love.marriage', 'work.hobby'].includes(r.lens)) {
        expect(r.promiseCharts, id).not.toContain('D7');
        expect(r.yearCharts, id).not.toContain('D7');
      }
    }
  });

  it('friends are never read from the D11 or the A5', () => {
    for (const id of READABLE_IDS) {
      const r = routeFor(id)!;
      if (r.lens !== 'love.friends') continue;
      expect([...r.promiseCharts, ...r.yearCharts], id).not.toContain('D11');
      for (const p of r.points) expect(p, id).not.toMatch(/\bA5\b/);
    }
    for (const id of READABLE_IDS) expect([...routeFor(id)!.promiseCharts, ...routeFor(id)!.yearCharts], id).not.toContain('D11');
  });

  it('the D30 is routed only on the Self body cards (strain words only)', () => {
    for (const id of READABLE_IDS) {
      const r = routeFor(id)!;
      if (r.promiseCharts.includes('D30') || r.yearCharts.includes('D30')) expect(r.lens, id).toBe('self.body');
    }
  });

  it('every chart a brief names is in its route or the natal D1/D9, and every brief names a routed chart', () => {
    for (const id of READABLE_IDS) {
      const brief = PROMPTS[cardBriefPrompt(id)];
      expect(brief, id).toBeTruthy();
      const r = routeFor(id)!;
      const allowed = new Set(['D1', 'D9', ...r.promiseCharts, ...r.yearCharts]);
      const named = chartsNamed(brief!);
      for (const ch of named) expect(allowed.has(ch), `${id} names ${ch}, not in its route`).toBe(true);
      expect(named.size, `${id} names no chart`).toBeGreaterThan(0);
    }
  });

  it('no romance brief names the D7 or reads the A5; no friends brief names the D11 or the A5', () => {
    for (const id of READABLE_IDS) {
      const r = routeFor(id)!;
      const brief = PROMPTS[cardBriefPrompt(id)]!;
      if (r.lens === 'love.dating' || r.lens === 'love.marriage') {
        expect(chartsNamed(brief).has('D7'), id).toBe(false);
        expect(brief, id).not.toMatch(/\bA5\b/);
      }
      if (r.lens === 'love.friends') {
        expect(chartsNamed(brief).has('D11'), id).toBe(false);
        expect(brief, id).not.toMatch(/\bA5\b/);
      }
    }
  });

  it('thirteen lens recipes, each with the purpose, the thread, the keep-out list and no engine name', () => {
    expect(LENS_IDS).toHaveLength(13);
    const threads = Object.keys(PROMPTS).filter((k) => k.startsWith('cards/threads/'));
    expect(threads.sort()).toEqual(LENS_IDS.map((l) => `cards/threads/${l}`).sort());
    for (const lens of LENS_IDS) {
      const t = recipeText(lens as LensId)!;
      expect(t, lens).toContain(`LENS RECIPE: \`${lens}\``);
      for (const part of ['PURPOSE QUESTION', 'THE THREAD', 'KEEP OUT', 'SYSTEMS:']) expect(t, `${lens} ${part}`).toContain(part);
      const steps = [...t.matchAll(/^(\d)\. /gm)].map((m) => Number(m[1]));
      expect(steps, lens).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(t, lens).not.toMatch(/radha|pyjhora|jhora/i);
      expect(t, lens).toMatch(/\[Rath\]/);
      for (const lensCard of ROUTED_CARDS.filter((c) => routeFor(c)!.lens === lens)) expect(t, `${lens} lists ${lensCard}`).toContain(`\`${lensCard}\``);
    }
    for (const lens of ['love.friends', 'work.hobby'] as const) expect(recipeText(lens), lens).toMatch(/THE TEXTS GIVE NO RULE/);
  });
});
