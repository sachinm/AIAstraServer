/**
 * The card of each You reading panel (docs/reading-engine/61 §1, 62): one to three lines, each at most 22 words, with its
 * own range and the claim ids it rests on, under a header range the whole card is true for. Lines are chosen from the
 * panel's claims in a fixed priority per panel; a claim whose line would exceed 22 words is left out and recorded as a
 * gap, never cut mid-sentence. Vetoed and withheld claims never become lines.
 */
import type { ActivationRow } from '../digest/activation.js';
import { struggleLead } from './panels/struggle.js';
import { yogasLead } from './panels/yogas.js';
import type { BoardPanelId, LineCertainty, LineRange, PanelBody, SelfClaim, SelfLine } from './types.js';
import { MAX_LINE_WORDS, wordCount } from './words.js';

const PRIORITY: Partial<Record<BoardPanelId, string[]>> = {
  diagnosis: ['diagnosis.direction', 'diagnosis.tension', 'diagnosis.now'],
  chapters: ['chapters.previous', 'chapters.running', 'chapters.next'],
  lagna: ['lagna.lord_house', 'lagna.lord_state', 'lagna.seen', 'lagna.on_self', 'lagna.moon_lagna', 'lagna.inner', 'lagna.star'],
  mind: ['mind.moon_place', 'mind.thinking', 'mind.peace', 'mind.courage', 'mind.intellect', 'mind.moon_star'],
  body: [
    'body.footing',
    'body.head_brain_mind',
    'body.food_neck',
    'body.hands_neck_nerves',
    'body.heart_chest',
    'body.organs_weight',
    'body.wear',
    'body.renewal_pelvic',
    'body.blood_limbs_feet',
    'body.now',
    'body.clocks_vim_narayana',
    'body.tp_review',
    'body.special_points_argala',
    'body.sky_gochara',
    'body.shape',
    'body.pressed',
  ],
  atma: ['atma.ak', 'atma.karakamsa', 'atma.judgement', 'atma.purpose', 'atma.sun', 'atma.ak_state', 'atma.letting_go'],
  heart: ['heart.venus_place', 'heart.romance', 'heart.feelings', 'heart.inner_bond', 'heart.arudha_pull'],
  partner: ['partner.seventh_lord', 'partner.darakaraka', 'partner.upapada', 'partner.darapada', 'partner.seventh_company'],
  bond: ['bond.keeping', 'bond.home_peace', 'bond.depth', 'bond.inner_marriage', 'bond.support_argala'],
  circle: ['circle.family', 'circle.roots', 'circle.friends', 'circle.continuity'],
  vocation: ['vocation.tenth_lord', 'vocation.amatyakaraka', 'vocation.dasamsa', 'vocation.skills_craft', 'vocation.tenth_company'],
  standing: ['standing.rajyapada', 'standing.arudha', 'standing.authority', 'standing.special_lagnas'],
  ground: ['ground.daily_work', 'ground.initiative', 'ground.counterparts', 'ground.stamina'],
  gain: ['gain.income', 'gain.treasury', 'gain.labhapada', 'gain.combinations'],
  year: ['year.lord_place', 'year.short_clock', 'year.self_lord', 'year.lord_company'],
};

export interface CardContext {
  /** the reading clock's running main and sub-period */
  running: { l1: ActivationRow | null; l2: ActivationRow | null };
  /** the running Varsha year (Mudda span) */
  year: { from: string; to: string } | null;
}

export function headerRangeOf(id: BoardPanelId, ctx: CardContext): LineRange {
  const sub = ctx.running.l2 ?? ctx.running.l1;
  if (id === 'diagnosis' || id === 'struggle' || id === 'body') return sub ? { from: sub.from, to: sub.to } : 'always';
  if (id === 'chapters') return ctx.running.l1 ? { from: ctx.running.l1.from, to: ctx.running.l1.to } : 'always';
  if (id === 'year') return ctx.year ?? 'always';
  return 'always';
}

const certaintyOf = (c: SelfClaim): LineCertainty => (c.certainty === 'confirmed' ? 'strong' : c.certainty === 'likely' ? 'moderate' : c.certainty === 'split' ? 'possible' : 'fact');

function ordered(id: BoardPanelId, claims: SelfClaim[]): SelfClaim[] {
  if (id === 'yogas') {
    const gifts = claims.filter((c) => c.text.startsWith('A gift'));
    const knots = claims.filter((c) => c.text.startsWith('A knot'));
    const rest = claims.filter((c) => !c.text.startsWith('A gift') && !c.text.startsWith('A knot'));
    return [...gifts, ...knots, ...rest];
  }
  if (id === 'chapters') {
    const order = PRIORITY.chapters!;
    return order.map((k) => claims.find((c) => c.id === k)).filter((c): c is SelfClaim => !!c).filter((c) => c.id !== 'chapters.next' || c.certainty !== 'split');
  }
  const order = PRIORITY[id];
  if (!order) return claims;
  return [...order.map((k) => claims.find((c) => c.id === k)).filter((c): c is SelfClaim => !!c), ...claims.filter((c) => !order.includes(c.id))];
}

/** Builds the lines of a panel without artificial 3-line truncation, recomputes lead, and records any length gaps. */
export function buildCard(
  id: BoardPanelId,
  b: PanelBody,
  ctx: CardContext,
): { headerRange: LineRange; lines: SelfLine[]; gaps: string[]; lead: string } {
  let headerRange = headerRangeOf(id, ctx);
  const gaps: string[] = [];
  const lines: SelfLine[] = [];
  const activeClaims = b.claims.filter((x) => !x.withheld);
  const pickedClaims: SelfClaim[] = [];
  for (const c of ordered(id, activeClaims)) {
    const text = (c.line ?? c.text).trim();
    if (!text) continue;
    if (wordCount(text) > MAX_LINE_WORDS) {
      gaps.push(`${id}: claim ${c.id} has no line of ${MAX_LINE_WORDS} words or fewer`);
      continue;
    }
    pickedClaims.push(c);
    lines.push({ id: `${id}.${lines.length + 1}`, text, range: c.range ?? 'always', claimIds: [c.id], certainty: certaintyOf(c), detail: c.detail });
  }
  if (headerRange !== 'always' && id !== 'chapters') {
    let from = headerRange.from;
    let to = headerRange.to;
    for (const l of lines) {
      if (l.range !== 'always') {
        if (l.range.from < from) from = l.range.from;
        if (l.range.to > to) to = l.range.to;
      }
    }
    headerRange = { from, to };
  }
  const lead =
    id === 'struggle'
      ? struggleLead(activeClaims)
      : id === 'yogas'
        ? yogasLead(pickedClaims)
        : b.lead;
  return { headerRange, lines, gaps, lead };
}
