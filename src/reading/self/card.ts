/**
 * The card of each You reading panel (docs/reading-engine/61 §1, 62): one to three lines, each at most 22 words, with its
 * own range and the claim ids it rests on, under a header range the whole card is true for. Lines are chosen from the
 * panel's claims in a fixed priority per panel; a claim whose line would exceed 22 words is left out and recorded as a
 * gap, never cut mid-sentence. Vetoed and withheld claims never become lines.
 */
import type { ActivationRow } from '../digest/activation.js';
import type { LineCertainty, LineRange, PanelBody, SelfClaim, SelfLine, SelfPanelId } from './types.js';
import { MAX_LINE_WORDS, wordCount } from './words.js';

const PRIORITY: Partial<Record<SelfPanelId, string[]>> = {
  diagnosis: ['diagnosis.direction', 'diagnosis.tension', 'diagnosis.now'],
  chapters: ['chapters.previous', 'chapters.running', 'chapters.next'],
  lagna: ['lagna.lord_house', 'lagna.lord_state', 'lagna.seen', 'lagna.on_self', 'lagna.moon_lagna', 'lagna.inner', 'lagna.star'],
  mind: ['mind.moon_place', 'mind.thinking', 'mind.peace', 'mind.courage', 'mind.intellect', 'mind.moon_star'],
  body: ['body.footing', 'body.now', 'body.shape', 'body.pressed', 'body.wear'],
  atma: ['atma.ak', 'atma.karakamsa', 'atma.judgement', 'atma.purpose', 'atma.sun', 'atma.ak_state', 'atma.letting_go'],
  year: ['year.lord_place', 'year.short_clock', 'year.self_lord', 'year.lord_company'],
};

export interface CardContext {
  /** the reading clock's running main and sub-period */
  running: { l1: ActivationRow | null; l2: ActivationRow | null };
  /** the running Varsha year (Mudda span) */
  year: { from: string; to: string } | null;
}

export function headerRangeOf(id: SelfPanelId, ctx: CardContext): LineRange {
  const sub = ctx.running.l2 ?? ctx.running.l1;
  if (id === 'diagnosis' || id === 'struggle' || id === 'body') return sub ? { from: sub.from, to: sub.to } : 'always';
  if (id === 'chapters') return ctx.running.l1 ? { from: ctx.running.l1.from, to: ctx.running.l1.to } : 'always';
  if (id === 'year') return ctx.year ?? 'always';
  return 'always';
}

const certaintyOf = (c: SelfClaim): LineCertainty => (c.certainty === 'confirmed' ? 'strong' : c.certainty === 'likely' ? 'moderate' : c.certainty === 'split' ? 'possible' : 'fact');

function ordered(id: SelfPanelId, claims: SelfClaim[]): SelfClaim[] {
  if (id === 'yogas') {
    const gifts = claims.filter((c) => c.text.startsWith('A gift')).slice(0, 2);
    const knots = claims.filter((c) => c.text.startsWith('A knot')).slice(0, 1);
    return [...gifts, ...knots];
  }
  if (id === 'chapters') {
    const order = PRIORITY.chapters!;
    return order.map((k) => claims.find((c) => c.id === k)).filter((c): c is SelfClaim => !!c).filter((c) => c.id !== 'chapters.next' || c.certainty !== 'split');
  }
  const order = PRIORITY[id];
  if (!order) return claims;
  return [...order.map((k) => claims.find((c) => c.id === k)).filter((c): c is SelfClaim => !!c), ...claims.filter((c) => !order.includes(c.id))];
}

/** The 1–3 lines of a panel and the gaps of lines left out for length. */
export function buildCard(id: SelfPanelId, b: PanelBody, ctx: CardContext): { headerRange: LineRange; lines: SelfLine[]; gaps: string[] } {
  const headerRange = headerRangeOf(id, ctx);
  const gaps: string[] = [];
  const lines: SelfLine[] = [];
  for (const c of ordered(id, b.claims.filter((x) => !x.withheld))) {
    if (lines.length >= 3) break;
    const text = (c.line ?? c.text).trim();
    if (wordCount(text) > MAX_LINE_WORDS) {
      gaps.push(`${id}: claim ${c.id} has no line of ${MAX_LINE_WORDS} words or fewer`);
      continue;
    }
    lines.push({ id: `${id}.${lines.length + 1}`, text, range: c.range ?? 'always', claimIds: [c.id], certainty: certaintyOf(c), detail: c.detail });
  }
  return { headerRange, lines, gaps };
}
