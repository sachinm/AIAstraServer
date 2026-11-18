/**
 * docs/dashboards/10 §7 S1, S2, S10: the Love and Work v3 card registry, its routing (facts and age only), the one
 * lookup over every board, and a brief for every offered card. No database, no model.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BOARD_V3_CARDS, boardFactsOf, defaultLens, LOVE_V3_CARDS, showsFor, starters, V3_LENSES, WORK_V3_CARDS, boardV3CardDef } from '../../../../src/reading/boards/v3Cards.js';
import { anyCardDef, boardOfCard, cardBriefPrompt, isReadable } from '../../../../src/reading/cards/registry.js';
import { cardOrder } from '../../../../src/reading/cards/run.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import { SELF_CARDS } from '../../../../src/reading/self/v3/cards.js';
import { CARD_FLAGS } from '../../../../src/boards/features.js';
import { getBoardsV3 } from '../../../../src/config/env.js';

const MATTERS = new Set(['self_and_body', 'money_in_hand', 'effort_and_courage', 'home_and_peace', 'ideas_and_children', 'work_load_and_health', 'partnership', 'sudden_and_hidden', 'luck_and_belief', 'career_and_standing', 'gains_and_network', 'loss_rest_and_distance']);
const saved = process.env.BOARDS_V3;
afterEach(() => {
  if (saved === undefined) delete process.env.BOARDS_V3;
  else process.env.BOARDS_V3 = saved;
});

describe('the registry (S1)', () => {
  it('72 rows, ids unique across every board, matters from the twelve keys, 69 offered, 20/39/71 later', () => {
    expect(BOARD_V3_CARDS).toHaveLength(72);
    expect(LOVE_V3_CARDS).toHaveLength(37);
    expect(WORK_V3_CARDS).toHaveLength(35);
    const all = [...SELF_CARDS.map((c) => c.id as string), ...BOARD_V3_CARDS.map((c) => c.id as string)];
    expect(new Set(all).size).toBe(all.length);
    for (const c of BOARD_V3_CARDS) {
      expect(c.id).toMatch(/^(dating|marriage|friends|allies|start|job|craft|biz)_[a-z_]+$/);
      expect(c.id.length).toBeLessThanOrEqual(40);
      expect(c.matters.length).toBeGreaterThan(0);
      for (const m of c.matters) expect(MATTERS.has(m)).toBe(true);
      expect(V3_LENSES[c.board].some((l) => l.id === c.lens)).toBe(true);
    }
    expect(BOARD_V3_CARDS.filter((c) => c.offered)).toHaveLength(69);
    expect(BOARD_V3_CARDS.filter((c) => c.later).map((c) => c.id).sort()).toEqual(['biz_legal_safeguards', 'marriage_children_family', 'start_degree_to_career']);
  });

  it('every offered card has its brief at cards/<board>/<id>, embedded; Self briefs keep cards/self/<id>', () => {
    for (const c of BOARD_V3_CARDS) {
      expect(cardBriefPrompt(c.id)).toBe(`cards/${c.board}/${c.id}`);
      if (c.offered) expect(PROMPTS[`cards/${c.board}/${c.id}`], c.id).toBeTruthy();
    }
    expect(cardBriefPrompt('body')).toBe('cards/self/body');
    for (const k of Object.keys(PROMPTS).filter((x) => /^cards\/(love|work)\//.test(x))) expect(boardV3CardDef(k.split('/')[2]!), k).not.toBeNull();
  });

  it('every card has a feature key card.<board>.<id>; plain titles with no internal id', () => {
    const keys = new Set(CARD_FLAGS.map((f) => f.key));
    for (const c of BOARD_V3_CARDS) {
      expect(keys.has(`card.${c.board}.${c.id}`)).toBe(true);
      expect(c.title).not.toMatch(/_|\b[a-z]+\.[a-z_]+\b/);
      expect(c.description).not.toMatch(/_|\b[a-z]+\.[a-z_]+\b/);
    }
  });
});

describe('the lookup (S2)', () => {
  it('one id names one card; readable only on a board listed in BOARDS_V3 and only when offered', () => {
    expect(anyCardDef('body')?.title).toBeTruthy();
    expect(anyCardDef('dating_pulse')?.title).toBe('Where Dating Stands');
    expect(boardOfCard('job_pulse')).toBe('work');
    expect(boardOfCard('mind')).toBe('self');
    expect(boardOfCard('nope')).toBeNull();
    delete process.env.BOARDS_V3;
    expect(getBoardsV3()).toEqual([]);
    expect(isReadable('dating_pulse')).toBe(false);
    expect(isReadable('body')).toBe(true);
    process.env.BOARDS_V3 = 'love, bogus';
    expect(getBoardsV3()).toEqual(['love']);
    expect(isReadable('dating_pulse')).toBe(true);
    expect(isReadable('job_pulse')).toBe(false);
    expect(isReadable('marriage_children_family')).toBe(false);
  });

  it('a queued Love card joins the read order only while its board is on', () => {
    delete process.env.BOARDS_V3;
    expect(cardOrder(['body'], ['dating_pulse'], false).first).toEqual(['body']);
    process.env.BOARDS_V3 = 'love,work';
    expect(cardOrder(['body'], ['dating_pulse'], false).first).toEqual(['dating_pulse', 'body']);
  });
});

describe('routing: facts and age only', () => {
  const card = (id: string) => boardV3CardDef(id)!;

  it('an unknown or declined fact shows every card; a stated one hides what it excludes', () => {
    for (const c of BOARD_V3_CARDS) expect(showsFor(c, {}, null)).toBe(true);
    expect(showsFor(card('marriage_daily_harmony'), { love: 'single' }, 30)).toBe(false);
    expect(showsFor(card('marriage_daily_harmony'), { love: 'married' }, 30)).toBe(true);
    expect(showsFor(card('dating_meeting_timing'), { love: 'married' }, 30)).toBe(false);
    expect(showsFor(card('marriage_children_family'), { love: 'married', childrenDeclined: true }, 30)).toBe(false);
    expect(showsFor(card('start_launch_window'), { work: 'yes', level: 'employee' }, 24)).toBe(true);
    expect(showsFor(card('start_launch_window'), { work: 'yes', level: 'employee' }, 34)).toBe(false);
    expect(showsFor(card('start_launch_window'), { work: 'studying' }, 34)).toBe(true);
    expect(showsFor(card('job_pulse'), { work: 'own_business' }, 40)).toBe(false);
    expect(showsFor(card('job_pulse'), { work: 'yes', level: 'owner_staff' }, 40)).toBe(false);
    expect(showsFor(card('job_stay_or_leave'), { work: 'between_jobs' }, 40)).toBe(true);
    expect(showsFor(card('biz_hiring_team'), { work: 'yes' }, 40)).toBe(false);
  });

  it('default lens: Love from love.status; Work from work.status, level, focus and age', () => {
    expect(defaultLens('love', {}, null)).toBe('dating');
    expect(defaultLens('love', { love: 'complicated' }, 30)).toBe('dating');
    expect(defaultLens('love', { love: 'married' }, 30)).toBe('marriage');
    expect(defaultLens('love', { love: 'separated' }, 30)).toBe('marriage');
    expect(defaultLens('work', { work: 'own_business' }, 30)).toBe('business');
    expect(defaultLens('work', { work: 'retired' }, 70)).toBe('hobby');
    expect(defaultLens('work', { work: 'between_jobs', focus: ['creativity'] }, 40)).toBe('hobby');
    expect(defaultLens('work', { work: 'yes', focus: ['creativity'] }, 40)).toBe('primary_job');
    expect(defaultLens('work', { work: 'studying' }, 22)).toBe('career_start');
    expect(defaultLens('work', { work: 'yes', level: 'employee' }, 25)).toBe('career_start');
    expect(defaultLens('work', { work: 'yes', level: 'manager' }, 25)).toBe('primary_job');
    expect(defaultLens('work', {}, null)).toBe('primary_job');
    expect(boardFactsOf({ facts: { love: 'married', work: { status: 'yes', level: 'manager' } }, declined: ['family.children'] })).toEqual({ love: 'married', work: 'yes', level: 'manager', childrenDeclined: true });
  });

  it('starters: the ★ cards, the marriage and business overrides', () => {
    expect(starters('love', 'dating', { love: 'single' }, 28)).toEqual(['dating_pulse', 'dating_meeting_timing', 'dating_delays_blocks', 'dating_attraction_pattern', 'dating_transition_commitment']);
    expect(starters('love', 'marriage', { love: 'married' }, 30)).toEqual(['marriage_pulse', 'marriage_daily_harmony', 'marriage_conflict_cycles', 'marriage_inlaws_family', 'marriage_finances_chores']);
    expect(starters('love', 'marriage', { love: 'married' }, 40)).toContain('marriage_longterm_longevity');
    expect(starters('love', 'marriage', { love: 'separated' }, 40).slice(0, 2)).toEqual(['marriage_reconciliation', 'marriage_timing_readiness']);
    expect(starters('love', 'marriage', { love: 'committed' }, 30)[0]).toBe('marriage_timing_readiness');
    expect(starters('work', 'business', { work: 'own_business' }, 40)).toEqual(['biz_launch_timing', 'biz_cashflow_margins', 'biz_clients_sales', 'biz_scaling_risk', 'biz_founder_burnout']);
    expect(starters('work', 'business', { work: 'yes' }, 40)).toEqual(['biz_readiness', 'biz_ideal_industry', 'biz_launch_timing', 'biz_cashflow_margins', 'biz_clients_sales']);
    expect(starters('work', 'career_start', {}, null)).not.toContain('start_degree_to_career');
  });
});
