/**
 * The Love and Work v3 card registry (docs/dashboards/10 §4.5; card specs in docs/dashboards/01–08). Words and routing
 * only: each card's id, lens, title, the engine matter keys it reads (its ledger cells and `matter.<key>` slices), and
 * when it is shown. What a card reads from the chart, its question and its goal are in its brief
 * (`src/reading/prompts/cards/<board>/<id>.md`).
 *
 * Nothing here is astrological: `showsFor`, `defaultLens` and `starters` read the person's own stated facts and age
 * (person_facts, the birth date) only. A rule hides a card only when the fact is stated and excluded; an unknown or
 * declined fact shows every card.
 *
 * Card ids are unique across every board (`dating_*`, `marriage_*`, `friends_*`, `allies_*`, `start_*`, `job_*`,
 * `craft_*`, `biz_*`), so the shared state doc, the store key and the claim ids need no board field.
 */
import { DEFAULT_SECTIONS, type CardMatter, type SelfSectionId } from '../self/v3/types.js';

export type AreaV3Board = 'love' | 'work';
export const AREA_V3_BOARDS: readonly AreaV3Board[] = ['love', 'work'];

export type LoveLens = 'dating' | 'marriage' | 'friends' | 'allies';
export type WorkLens = 'career_start' | 'primary_job' | 'hobby' | 'business';
export type BoardLens = LoveLens | WorkLens;

export const V3_LENSES: Record<AreaV3Board, ReadonlyArray<{ id: BoardLens; title: string }>> = {
  love: [
    { id: 'dating', title: 'Dating' },
    { id: 'marriage', title: 'Marriage' },
    { id: 'friends', title: 'Friends' },
    { id: 'allies', title: 'Allies at work' },
  ],
  work: [
    { id: 'career_start', title: 'Starting out' },
    { id: 'primary_job', title: 'Your job' },
    { id: 'hobby', title: 'Craft & hobby' },
    { id: 'business', title: 'Business' },
  ],
};

/** the person's stated facts the routing reads (absent = not stated, or declined) */
export interface BoardFacts {
  /** love.status */
  love?: string;
  /** work.status */
  work?: string;
  /** work.level */
  level?: string;
  /** self.focus */
  focus?: readonly string[];
  /** family.children was declined ("rather not say") */
  childrenDeclined?: boolean;
}

/** The routing facts from the profile pack's facts (declined keys are already absent there). */
export function boardFactsOf(p: { facts: { work?: { status?: string; level?: string }; love?: string; focus?: string[] }; declined?: readonly string[] } | null | undefined): BoardFacts {
  if (!p) return {};
  return {
    ...(p.facts.love ? { love: p.facts.love } : {}),
    ...(p.facts.work?.status ? { work: p.facts.work.status } : {}),
    ...(p.facts.work?.level ? { level: p.facts.work.level } : {}),
    ...(p.facts.focus?.length ? { focus: p.facts.focus } : {}),
    ...(p.declined?.includes('family.children') ? { childrenDeclined: true } : {}),
  };
}

/** one stated-fact rule: `in` (shown only for these values) or `notIn` (hidden for these); unstated always passes */
interface FactRule {
  in?: readonly string[];
  notIn?: readonly string[];
}

/** the status groups of doc 10 §4.5 (EARLY, EMP, SEEK, OWN), or EMP_OR_SEEK */
type StatusGroup = 'EARLY' | 'EMP' | 'SEEK' | 'OWN' | 'EMP_OR_SEEK';

export interface ShowWhen {
  love?: FactRule;
  work?: FactRule;
  level?: FactRule;
  group?: StatusGroup;
  /** hidden when family.children was declined */
  childrenStated?: true;
}

/** ★ starter: always, only above 36, only for an owner (OWN), or only for a non-owner */
export type StarterRule = true | 'age_over_36' | 'own' | 'not_own';

export interface BoardV3CardDef<Id extends string = string> {
  id: Id;
  board: AreaV3Board;
  /** the lens the card sits in (the page's `group`) */
  lens: BoardLens;
  title: string;
  /** the one plain line under the name, and the picker tile line */
  description: string;
  subtitle: string;
  /** ★: starts on the lens deck (see `starters`) */
  starter?: StarterRule;
  /** carries the board's sensitive guard in its brief */
  sensitive: boolean;
  matters: readonly CardMatter[];
  showWhen: ShowWhen;
  /** offered tonight; false for the cards marked "later" (doc 80 data) */
  offered: boolean;
  /** "Coming soon" until doc 80 lands */
  later?: true;
  defaultSections: readonly SelfSectionId[];
}

const H: Record<number, CardMatter> = {
  1: 'self_and_body',
  2: 'money_in_hand',
  3: 'effort_and_courage',
  4: 'home_and_peace',
  5: 'ideas_and_children',
  6: 'work_load_and_health',
  7: 'partnership',
  8: 'sudden_and_hidden',
  9: 'luck_and_belief',
  10: 'career_and_standing',
  11: 'gains_and_network',
  12: 'loss_rest_and_distance',
};
const h = (...n: number[]): CardMatter[] => n.map((x) => H[x]!);

type Row = Omit<BoardV3CardDef<string>, 'board' | 'offered' | 'defaultSections' | 'subtitle' | 'sensitive'> & { sensitive?: boolean };

const SINGLEISH: FactRule = { in: ['single', 'dating', 'complicated'] };
const TOGETHER: FactRule = { in: ['married', 'committed'] };
const TOGETHER_OR_APART: FactRule = { in: ['married', 'committed', 'separated'] };

const LOVE_ROWS = [
  // Dating (doc 01)
  { id: 'dating_pulse', lens: 'dating', title: 'Where Dating Stands', description: 'How open your love life is this year, stretch by stretch', starter: true, matters: h(5, 11, 12), showWhen: { love: SINGLEISH } },
  { id: 'dating_meeting_timing', lens: 'dating', title: 'When You Meet Someone', description: 'When meeting someone is likely, and what to do in the quiet months', starter: true, matters: h(5, 7, 11), showWhen: { love: { notIn: ['married', 'committed'] } } },
  { id: 'dating_delays_blocks', lens: 'dating', title: "Why It's Taking Time", description: 'What is slowing love down, since when, and until when', starter: true, matters: h(5, 7, 8), showWhen: {} },
  { id: 'dating_attraction_pattern', lens: 'dating', title: 'The Partner You Draw', description: 'The kind of person you are drawn to, and who suits you', starter: true, matters: h(5, 7), showWhen: {} },
  { id: 'dating_mixed_signals', lens: 'dating', title: 'How They Feel & Mixed Signals', description: 'Reading the signals while things are unclear', matters: h(5, 12, 3, 7), showWhen: { love: { in: ['dating', 'complicated'] } } },
  { id: 'dating_exes_closure', lens: 'dating', title: 'Exes, No-Contact & Reopening Doors', description: 'Old bonds: when they pull, and when they settle', sensitive: true, matters: h(8, 12, 5, 7), showWhen: {} },
  { id: 'dating_karmic_compatibility', lens: 'dating', title: 'Karmic Pull vs. Real Compatibility', description: 'Strong pull or real fit: telling the two apart', matters: h(5, 8, 4, 7), showWhen: {} },
  { id: 'dating_intimacy_safety', lens: 'dating', title: 'Intimacy & Emotional Safety', description: 'Feeling safe and close, and what helps', sensitive: true, matters: h(4, 8, 12), showWhen: {} },
  { id: 'dating_breaking_patterns', lens: 'dating', title: 'Breaking Your Dating Loop', description: 'The pattern that repeats, and when it can change', matters: h(5, 6, 8, 12), showWhen: {} },
  { id: 'dating_transition_commitment', lens: 'dating', title: 'Turning Dating Into Commitment', description: 'When dating can become something firm', starter: true, matters: h(7, 5), showWhen: { love: { in: ['single', 'dating'] } } },

  // Marriage (doc 02)
  { id: 'marriage_pulse', lens: 'marriage', title: 'Where Your Partnership Stands', description: 'The state of your partnership this year, stretch by stretch', starter: true, matters: h(7, 4), showWhen: { love: TOGETHER_OR_APART } },
  { id: 'marriage_timing_readiness', lens: 'marriage', title: 'Marriage Timing & Readiness', description: 'When marriage is likely, and how ready you are', matters: h(7, 9), showWhen: { love: { notIn: ['married'] } } },
  { id: 'marriage_daily_harmony', lens: 'marriage', title: 'Warmth & Day-to-Day Harmony', description: 'Warmth and ease between you, day to day', starter: true, matters: h(4, 7), showWhen: { love: TOGETHER } },
  { id: 'marriage_conflict_cycles', lens: 'marriage', title: 'Distance, Strain & Conflict Cycles', description: 'What strains things, when it eases, and what holds', starter: true, sensitive: true, matters: h(7, 6, 8, 12), showWhen: { love: TOGETHER } },
  { id: 'marriage_communication', lens: 'marriage', title: 'Communication & Unspoken Resentments', description: 'What goes unsaid between you, and when to say it', matters: h(2, 3, 7), showWhen: { love: TOGETHER_OR_APART } },
  { id: 'marriage_trust_transparency', lens: 'marriage', title: 'Trust, Transparency & Hidden Stress', description: 'Trust and openness, and the stress kept out of sight', sensitive: true, matters: h(8, 12, 7), showWhen: { love: TOGETHER_OR_APART } },
  { id: 'marriage_reconciliation', lens: 'marriage', title: 'Repair & Reconciliation', description: 'Whether and when repair is possible', sensitive: true, matters: h(7, 8, 9), showWhen: { love: { in: ['separated', 'married', 'committed'] } } },
  { id: 'marriage_inlaws_family', lens: 'marriage', title: 'Family, In-Laws & Shared Home', description: 'Family, in-laws and the home you share', starter: true, matters: h(4, 2, 8), showWhen: { love: TOGETHER } },
  { id: 'marriage_finances_chores', lens: 'marriage', title: 'Shared Money & Responsibilities', description: 'Money and the load you carry together', starter: true, matters: h(2, 8, 11, 6), showWhen: { love: TOGETHER } },
  { id: 'marriage_children_family', lens: 'marriage', title: 'Children & Family Growth', description: 'Children and a growing family', sensitive: true, later: true, matters: h(5, 9, 11), showWhen: { love: TOGETHER, childrenStated: true } },
  { id: 'marriage_longterm_longevity', lens: 'marriage', title: 'Long-Term Longevity & Second Half of Life', description: 'How the partnership holds over the long run', starter: 'age_over_36', matters: h(7, 8), showWhen: { love: TOGETHER } },
  { id: 'marriage_personal_growth', lens: 'marriage', title: 'Your Role & Growth Inside Marriage', description: 'Who you become inside the partnership', matters: h(1, 7), showWhen: { love: TOGETHER } },

  // Friends (doc 03)
  { id: 'friends_social_energy', lens: 'friends', title: 'Your Social Energy This Year', description: 'When you want people around, and when you need room', starter: true, matters: h(11, 12, 3), showWhen: {} },
  { id: 'friends_core_allies', lens: 'friends', title: 'The Friends Who Truly Carry You', description: 'The friends who carry you, and when to lean on them', starter: true, matters: h(11, 9), showWhen: {} },
  { id: 'friends_outgrowing_circles', lens: 'friends', title: 'Outgrowing Circles & Friendship Friction', description: 'Friction with friends, and circles you are outgrowing', starter: true, matters: h(11, 6, 8), showWhen: {} },
  { id: 'friends_finding_tribe', lens: 'friends', title: 'Finding Your Tribe & New Communities', description: 'When new people and communities come in', starter: true, matters: h(11, 9, 3), showWhen: {} },
  { id: 'friends_boundaries_drains', lens: 'friends', title: 'Boundaries & Energy Drains', description: 'Who drains you, and where to hold a line', starter: true, matters: h(12, 6, 11), showWhen: {} },
  { id: 'friends_mentors_guides', lens: 'friends', title: 'Mentors, Elders & Supportive Guides', description: 'The elders and guides who help you', matters: h(9, 11), showWhen: {} },
  { id: 'friends_reputation_belonging', lens: 'friends', title: 'Social Reputation & Belonging', description: 'How you are seen in your circles, and where you belong', matters: h(11, 10, 1), showWhen: {} },

  // Allies at work (doc 04)
  { id: 'allies_pulse', lens: 'allies', title: 'Workplace Dynamics This Year', description: 'How the people around your work move this year', starter: true, matters: h(10, 6, 7, 11), showWhen: { work: { in: ['yes', 'own_business'] } } },
  { id: 'allies_bosses_authority', lens: 'allies', title: 'Bosses, Authority & Mentors at Work', description: 'The people above you, and how to work with them', starter: true, matters: h(10, 9), showWhen: { work: { in: ['yes'] } } },
  { id: 'allies_team_politics', lens: 'allies', title: 'Colleagues, Teams & Office Politics', description: 'Colleagues, teams and the politics between them', starter: true, matters: h(6, 3, 8), showWhen: { work: { in: ['yes'] } } },
  { id: 'allies_cofounder_fit', lens: 'allies', title: 'Business Partners & Co-Founder Fit', description: 'Who fits as a partner in your business', matters: h(7, 11), showWhen: { work: { in: ['own_business'] } } },
  { id: 'allies_clients_deals', lens: 'allies', title: 'Clients, Deals & Public Trust', description: 'Clients, deals and the trust you earn', starter: true, matters: h(7, 10, 11), showWhen: { work: { in: ['yes', 'own_business'] } } },
  { id: 'allies_managing_people', lens: 'allies', title: 'Managing & Leading People', description: 'Leading the people who work with you', matters: h(10, 6, 5), showWhen: { level: { in: ['manager', 'senior_leader', 'owner_staff', 'several_businesses'] } } },
  { id: 'allies_networking_allies', lens: 'allies', title: 'Networking & Career Allies', description: 'The contacts and allies who open doors', starter: true, matters: h(11, 10, 3), showWhen: { work: { notIn: ['retired'] } } },
  { id: 'allies_contracts_disputes', lens: 'allies', title: 'Contracts, Disputes & Protection', description: 'Agreements, disputes and keeping yourself covered', sensitive: true, matters: h(6, 8, 7), showWhen: { work: { in: ['yes', 'own_business', 'between_jobs'] } } },
] as const satisfies readonly Row[];

const WORK_ROWS = [
  // Starting out (doc 05)
  { id: 'start_launch_window', lens: 'career_start', title: 'Your Career Launch Window', description: 'When your working life opens up, and how to meet it', starter: true, matters: h(10, 6, 5, 9), showWhen: { group: 'EARLY' } },
  { id: 'start_degree_to_career', lens: 'career_start', title: 'Turning Your Degree Into a Career', description: 'From what you studied to the work that suits you', later: true, matters: h(5, 9, 10, 2), showWhen: { group: 'EARLY' } },
  { id: 'start_first_role_timing', lens: 'career_start', title: 'Landing Your First Role', description: 'When a first role is likely, and what to do meanwhile', starter: true, matters: h(6, 10, 11), showWhen: { group: 'EARLY' } },
  { id: 'start_offer_decision', lens: 'career_start', title: 'Choosing Between Two Paths or Offers', description: 'Weighing two paths or two offers', starter: true, matters: h(10, 2, 3, 6), showWhen: { group: 'EARLY' } },
  { id: 'start_imposter_syndrome', lens: 'career_start', title: 'Overcoming Imposter Syndrome & Early Doubt', description: 'Early doubt: when it is loud, and when it quiets', sensitive: true, matters: h(1, 4, 5), showWhen: { group: 'EARLY' } },
  { id: 'start_relocation_abroad', lens: 'career_start', title: 'Relocation & Working Abroad', description: 'Moving for work, near or far', matters: h(12, 9, 4, 3), showWhen: { group: 'EARLY' } },
  { id: 'start_three_year_foundation', lens: 'career_start', title: 'Building Your 3-Year Foundation', description: 'What to build over the next three years', starter: true, matters: h(10, 3, 6, 11), showWhen: { group: 'EARLY' } },

  // Your job (doc 06)
  { id: 'job_pulse', lens: 'primary_job', title: 'Where Your Job Stands', description: 'The state of your job this year, stretch by stretch', starter: true, matters: h(10, 6, 11), showWhen: { group: 'EMP' } },
  { id: 'job_security_layoff', lens: 'primary_job', title: 'Job Security & Restructuring Risk', description: 'How steady your position is, and the stretches to watch', starter: true, sensitive: true, matters: h(10, 8, 12, 6), showWhen: { group: 'EMP' } },
  { id: 'job_stay_or_leave', lens: 'primary_job', title: 'Should You Stay or Change Jobs?', description: 'When to stay, when to prepare a move, when to act', starter: true, matters: h(10, 3, 8, 11), showWhen: { group: 'EMP_OR_SEEK' } },
  { id: 'job_promotion_recognition', lens: 'primary_job', title: 'Promotions, Titles & Recognition', description: 'Being seen, credited and promoted', starter: true, matters: h(10, 11, 9), showWhen: { group: 'EMP' } },
  { id: 'job_salary_bonuses', lens: 'primary_job', title: 'Salary, Bonuses & Cashflow', description: 'Pay, bonuses and money coming in', starter: true, matters: h(11, 2, 12), showWhen: { group: 'EMP' } },
  { id: 'job_burnout_load', lens: 'primary_job', title: 'What Wears You (Burnout & Heavy Load)', description: 'What wears you down at work, and until when', sensitive: true, matters: h(6, 8, 12, 1), showWhen: { group: 'EMP' } },
  { id: 'job_boss_politics', lens: 'primary_job', title: 'Bosses, Leadership & Politics', description: 'The people above you and the politics around them', matters: h(10, 9, 6), showWhen: { group: 'EMP' } },
  { id: 'job_leading_teams', lens: 'primary_job', title: 'Leading Teams & Authority', description: 'Leading people and holding authority', matters: h(10, 5, 6), showWhen: { level: { in: ['manager', 'senior_leader'] } } },
  { id: 'job_industry_switch', lens: 'primary_job', title: 'Switching Industries or Roles', description: 'Moving to a new field or a new kind of role', matters: h(10, 8, 9, 12), showWhen: { group: 'EMP' } },
  { id: 'job_remote_abroad', lens: 'primary_job', title: 'Work Abroad & Remote Flexibility', description: 'Working abroad or from wherever you are', matters: h(12, 9, 4, 10), showWhen: { group: 'EMP' } },
  { id: 'job_skill_building', lens: 'primary_job', title: 'What Skill to Build Next', description: 'The skill to build next, and when it sticks', matters: h(3, 5, 9, 10), showWhen: { group: 'EMP_OR_SEEK' } },

  // Craft & hobby (doc 07)
  { id: 'craft_creative_flow', lens: 'hobby', title: 'Your Creative Flow This Year', description: 'When ideas flow this year, and when they slow', starter: true, matters: h(5, 3, 11), showWhen: {} },
  { id: 'craft_energizing_medium', lens: 'hobby', title: 'The Craft That Energizes You', description: 'The kind of making that gives you energy', starter: true, matters: h(3, 5), showWhen: {} },
  { id: 'craft_creative_blocks', lens: 'hobby', title: 'Creative Blocks & Loss of Motivation', description: 'What blocks you, and when it lifts', starter: true, matters: h(5, 12), showWhen: {} },
  { id: 'craft_monetize_hobby', lens: 'hobby', title: 'Turning a Hobby Into a Side Hustle', description: 'Whether and when a hobby can earn', matters: h(5, 11, 2, 7), showWhen: { work: { notIn: ['retired'] } } },
  { id: 'craft_shipping_projects', lens: 'hobby', title: 'Finishing & Shipping Your Project', description: 'Getting a project finished and out', starter: true, matters: h(3, 10, 11), showWhen: {} },
  { id: 'craft_audience_community', lens: 'hobby', title: 'Community & Audience for Your Work', description: 'Finding the people who want your work', matters: h(11, 5), showWhen: {} },

  // Business (doc 08)
  { id: 'biz_readiness', lens: 'business', title: 'Job vs. Business Readiness', description: 'A job or a business of your own: which suits you now', starter: 'not_own', matters: h(7, 3, 11, 6), showWhen: {} },
  { id: 'biz_ideal_industry', lens: 'business', title: 'Your Ideal Field & Industry of Business', description: 'The field of business that suits you', starter: 'not_own', matters: h(10, 7, 2), showWhen: {} },
  { id: 'biz_launch_timing', lens: 'business', title: 'Timing Your Launch or Major Pivot', description: 'When to launch or change direction', starter: true, matters: h(10, 7, 11), showWhen: {} },
  { id: 'biz_cashflow_margins', lens: 'business', title: 'Revenue, Cashflow & Profit Margins', description: 'Money in, money out, and what is left', starter: true, matters: h(2, 11, 12), showWhen: {} },
  { id: 'biz_clients_sales', lens: 'business', title: 'Clients, Sales & Market Pull', description: 'Clients, sales and how the market pulls', starter: true, matters: h(7, 10, 3), showWhen: {} },
  { id: 'biz_partnerships_fit', lens: 'business', title: 'Co-Founders & Business Partnerships', description: 'Who fits as a co-founder or business partner', sensitive: true, matters: h(7, 11, 8), showWhen: { level: { notIn: ['owner_alone'] } } },
  { id: 'biz_hiring_team', lens: 'business', title: 'Hiring, Team & Delegation', description: 'Hiring, building a team and handing work over', matters: h(6, 5, 10), showWhen: { group: 'OWN' } },
  { id: 'biz_capital_assets', lens: 'business', title: 'Capital, Assets & Infrastructure', description: 'Capital, assets and what the business stands on', sensitive: true, matters: h(4, 2, 8, 6), showWhen: { level: { in: ['owner_staff', 'several_businesses'] } } },
  { id: 'biz_scaling_risk', lens: 'business', title: 'Scaling, Risk & Bold Moves', description: 'When to grow, and how much risk to take', starter: 'own', matters: h(3, 11, 10), showWhen: { group: 'OWN' } },
  { id: 'biz_legal_safeguards', lens: 'business', title: 'Legal, Contracts & Financial Safeguards', description: 'Contracts and keeping the business protected', sensitive: true, later: true, matters: h(6, 8, 12), showWhen: { group: 'OWN' } },
  { id: 'biz_founder_burnout', lens: 'business', title: 'Founder Energy & Avoiding Burnout', description: 'Your energy as a founder, and how to keep it', starter: 'own', sensitive: true, matters: h(1, 6, 12, 8), showWhen: { group: 'OWN' } },
] as const satisfies readonly Row[];

export type LoveV3CardId = (typeof LOVE_ROWS)[number]['id'];
export type WorkV3CardId = (typeof WORK_ROWS)[number]['id'];
export type BoardV3CardId = LoveV3CardId | WorkV3CardId;

function complete<Id extends string>(board: AreaV3Board, rows: readonly Row[]): BoardV3CardDef<Id>[] {
  return rows.map((r) => ({
    ...r,
    id: r.id as Id,
    board,
    subtitle: r.description,
    sensitive: Boolean(r.sensitive),
    matters: [...r.matters],
    offered: !r.later,
    defaultSections: DEFAULT_SECTIONS,
  }));
}

export const LOVE_V3_CARDS: readonly BoardV3CardDef<LoveV3CardId>[] = complete<LoveV3CardId>('love', LOVE_ROWS);
export const WORK_V3_CARDS: readonly BoardV3CardDef<WorkV3CardId>[] = complete<WorkV3CardId>('work', WORK_ROWS);
export const BOARD_V3_CARDS: readonly BoardV3CardDef<BoardV3CardId>[] = [...LOVE_V3_CARDS, ...WORK_V3_CARDS];

const BY_ID: ReadonlyMap<string, BoardV3CardDef<BoardV3CardId>> = new Map(BOARD_V3_CARDS.map((c) => [c.id, c]));

/** A v3 Love or Work card by id (any board); null when unknown. */
export function boardV3CardDef(id: string): BoardV3CardDef<BoardV3CardId> | null {
  return BY_ID.get(id) ?? null;
}

/** The card on this board, or null (an id of the other board is null here). */
export function boardV3CardOn(board: AreaV3Board, id: string): BoardV3CardDef<BoardV3CardId> | null {
  const d = BY_ID.get(id);
  return d && d.board === board ? d : null;
}

export function boardV3Cards(board: AreaV3Board): readonly BoardV3CardDef<BoardV3CardId>[] {
  return board === 'love' ? LOVE_V3_CARDS : WORK_V3_CARDS;
}

export function isAreaV3Board(x: string): x is AreaV3Board {
  return (AREA_V3_BOARDS as readonly string[]).includes(x);
}

export function isBoardLens(board: AreaV3Board, lens: unknown): lens is BoardLens {
  return typeof lens === 'string' && V3_LENSES[board].some((l) => l.id === lens);
}

// ---------------------------------------------------------------------------------------------------------------------
// Routing (pure; person facts and age only)
// ---------------------------------------------------------------------------------------------------------------------

const OWNER_LEVELS = ['owner_alone', 'owner_staff', 'several_businesses'];

/** a stated fact passes the rule; an unstated one always passes */
function passes(rule: FactRule | undefined, value: string | undefined): boolean {
  if (!rule || value === undefined) return true;
  if (rule.in && !rule.in.includes(value)) return false;
  if (rule.notIn && rule.notIn.includes(value)) return false;
  return true;
}

/** a status group: hidden only when what is stated rules it out */
function inGroup(g: StatusGroup, f: BoardFacts, age: number | null): boolean {
  const w = f.work;
  const lvl = f.level;
  const early = () => {
    if (w === undefined || w === 'studying') return true;
    if (w !== 'yes' && w !== 'between_jobs') return false;
    if (lvl !== undefined && !['hourly', 'employee'].includes(lvl)) return false;
    if (age !== null && age >= 30) return false;
    return true;
  };
  const emp = () => (w === undefined || w === 'yes') && (lvl === undefined || !OWNER_LEVELS.includes(lvl));
  const seek = () => (w === undefined || w === 'between_jobs') && (age === null || age >= 30);
  const own = () => w === undefined || w === 'own_business';
  switch (g) {
    case 'EARLY':
      return early();
    case 'EMP':
      return emp();
    case 'SEEK':
      return seek();
    case 'OWN':
      return own();
    case 'EMP_OR_SEEK':
      return emp() || seek();
  }
}

/** The card is listed for this person: no stated fact excludes it. */
export function showsFor(def: Pick<BoardV3CardDef, 'showWhen'>, facts: BoardFacts, age: number | null): boolean {
  const s = def.showWhen;
  if (!passes(s.love, facts.love)) return false;
  if (!passes(s.work, facts.work)) return false;
  if (!passes(s.level, facts.level)) return false;
  if (s.group && !inGroup(s.group, facts, age)) return false;
  if (s.childrenStated && facts.childrenDeclined) return false;
  return true;
}

/** The lens a board opens on for this person (doc 10 §4.5 "Routing"). */
export function defaultLens(board: AreaV3Board, facts: BoardFacts, age: number | null): BoardLens {
  if (board === 'love') return facts.love && ['married', 'committed', 'separated'].includes(facts.love) ? 'marriage' : 'dating';
  const w = facts.work;
  if (w === 'own_business') return 'business';
  if (w === 'retired' || (facts.focus?.includes('creativity') && w !== 'yes')) return 'hobby';
  if (w === 'studying') return 'career_start';
  const lvl = facts.level;
  if (age !== null && age < 30 && (lvl === undefined || ['hourly', 'employee'].includes(lvl))) return 'career_start';
  return 'primary_job';
}

/** The lens's starter cards for this person, in order (offered and shown only). */
export function starters(board: AreaV3Board, lens: BoardLens, facts: BoardFacts, age: number | null): BoardV3CardId[] {
  const own = facts.work === 'own_business';
  const rows = boardV3Cards(board).filter((c) => c.lens === lens && c.offered && showsFor(c, facts, age));
  if (lens === 'business') {
    const set: string[] = own
      ? ['biz_launch_timing', 'biz_cashflow_margins', 'biz_clients_sales', 'biz_scaling_risk', 'biz_founder_burnout']
      : ['biz_readiness', 'biz_ideal_industry', 'biz_launch_timing', 'biz_cashflow_margins', 'biz_clients_sales'];
    return rows.filter((c) => set.includes(c.id)).map((c) => c.id);
  }
  const star = (c: BoardV3CardDef): boolean => {
    if (c.starter === true) return true;
    if (c.starter === 'age_over_36') return age !== null && age > 36;
    if (c.starter === 'own') return own;
    if (c.starter === 'not_own') return !own;
    return false;
  };
  let out = rows.filter(star).map((c) => c.id);
  if (lens === 'marriage') {
    const first: BoardV3CardId[] = [];
    if (facts.love === 'separated') first.push('marriage_reconciliation');
    if (facts.love !== 'married') first.push('marriage_timing_readiness');
    const shown = new Set(rows.map((c) => c.id));
    out = [...first.filter((id) => shown.has(id)), ...out.filter((id) => !first.includes(id))];
  }
  return out;
}
