/**
 * GET /api/self/v3 card views (docs/reading-engine/68 §4.5–§4.6). Pure: maps the v2 body (Phase A) and, when stored, the
 * v3 cards (Phase B) onto the registry. The period rail comes from the v3 spans, else from the v2 card's stored dates.
 * Every string that reaches the person is already redacted by the v2 mapping or passes `redactDeep` here, once.
 */
import { dayLabel, redactDeep } from '../v2api/response.js';
import type { SelfV2AreaView, SelfV2Response } from '../v2types.js';
import { isCardOffered, SELF_CARDS } from './cards.js';
import type { BoardReadingView, CardReadState, RailItem, SelfBoardLayoutView, SelfCardId, SelfV3CardContent, SelfV3CardView, SelfV3Response } from './types.js';

/** most bars the rail shows (doc 68 §4.2: three to six periods across twelve months) */
export const RAIL_MAX = 6;

const short = (iso: string, today: string): string => (iso <= today ? 'now' : dayLabel(iso));

/** Phase A rail: the v2 card's stored dates that have not ended, in date order, at most RAIL_MAX. */
export function railFromDates(dates: ReadonlyArray<{ from: string; to: string; label: string }>, today: string): RailItem[] {
  const seen = new Set<string>();
  return [...dates]
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d.from) && /^\d{4}-\d{2}-\d{2}/.test(d.to) && d.to >= today)
    .sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)))
    .filter((d) => {
      const k = `${d.from}|${d.to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, RAIL_MAX)
    .map((d) => ({
      from: d.from,
      to: d.to,
      label: `${short(d.from, today)} → ${dayLabel(d.to)}`,
      tone: null,
      note: d.label || null,
      current: d.from <= today && today <= d.to,
      span: null,
      text: null,
    }));
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The ways a stored paragraph writes this date: 2027-01-01, 1 Jan 2027 (dayLabel), 1 January 2027. */
function dateMatcher(iso: string): RegExp | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const day = Number(m[3]);
  const long = MONTHS_LONG[Number(m[2]) - 1];
  const forms = [`${m[1]}-${m[2]}-${m[3]}`, dayLabel(iso), ...(long ? [`${day} ${long} ${m[1]}`] : [])];
  return new RegExp(`(?<![\\d-])(?:${forms.map(escapeRe).join('|')})(?![\\d-])`, 'i');
}

/**
 * Phase A per-period text (plain string matching on stored text): each body paragraph that names a period's `from` or
 * `to` date goes to the first such period in rail order, and to no other; the rest are `standing`. A period no
 * paragraph names keeps `text: null`.
 */
export function splitBodyByPeriods(body: readonly string[], rail: readonly RailItem[]): { rail: RailItem[]; standing: string[] } {
  const matchers = rail.map((r) => [dateMatcher(r.from), dateMatcher(r.to)].filter((x): x is RegExp => Boolean(x)));
  const texts: Array<string[] | null> = rail.map(() => null);
  const standing: string[] = [];
  for (const p of body) {
    const i = matchers.findIndex((ms) => ms.some((re) => re.test(p)));
    if (i < 0) standing.push(p);
    else (texts[i] ??= []).push(p);
  }
  return { rail: rail.map((r, i) => ({ ...r, text: texts[i] ?? null })), standing };
}

/** Phase B rail: one bar per span the card reads. */
export function railFromSpans(c: SelfV3CardContent, today: string): RailItem[] {
  return c.spans.slice(0, RAIL_MAX).map((s) => ({
    from: s.from,
    to: s.to,
    label: `${short(s.from, today)} → ${dayLabel(s.to)}`,
    // a span whose tone fewer than READING_CLOCKS_MIN clocks hold shows no tone word
    tone: s.held === false ? null : s.tone,
    note: null,
    current: s.from <= today && today <= s.to,
    span: s.span,
    text: null,
  }));
}

export interface CardViewsInput {
  v2: SelfV2Response;
  v3Cards?: Partial<Record<SelfCardId, SelfV3CardContent>> | null;
  /** the registry ids marked suggested for this person (default: the registry's own) */
  suggested?: readonly SelfCardId[] | null;
  today: string;
  /** doc 70 Phase 3: each card's reading state (absent: `ready` when it has v3 content, else `not_read`) */
  states?: Partial<Record<SelfCardId, CardReadState>> | null;
  /** doc 70 Phase 3: whether the per-card reading is on (Phase C cards offered); default false */
  cardsRead?: boolean;
  reading?: BoardReadingView | null;
}

export function cardViews(i: CardViewsInput): SelfV3CardView[] {
  const areas = new Map<string, SelfV2AreaView>(i.v2.areas.map((a) => [a.id, a]));
  const suggested = i.suggested ? new Set(i.suggested) : null;
  return SELF_CARDS.map((def) => {
    const area = def.v2Area ? areas.get(def.v2Area) ?? null : null;
    const v3 = i.v3Cards?.[def.id] ? redactDeep(i.v3Cards[def.id]!) : null;
    const v2card = area?.card ?? null;
    const available = isCardOffered(def, Boolean(i.cardsRead));
    const status = v3 ? 'ok' : area ? area.status : 'pending';
    const state: CardReadState = i.states?.[def.id] ?? (v3 ? 'ready' : 'not_read');
    const phaseA = v3 ? null : splitBodyByPeriods(v2card?.body ?? [], railFromDates(v2card?.dates ?? [], i.today));
    return {
      id: def.id,
      group: def.group,
      title: def.title,
      description: def.description,
      suggested: available && (suggested ? suggested.has(def.id) : def.suggested),
      sensitive: def.sensitive,
      available,
      unavailableReason: available ? null : 'Coming soon',
      status,
      state,
      firstLine: v3?.line ?? v2card?.headline ?? null,
      defaultSections: [...def.defaultSections],
      rail: v3 ? railFromSpans(v3, i.today) : phaseA!.rail,
      standing: phaseA?.standing ?? [],
      v3,
      v2: area ? { card: v2card, rangeLabel: area.rangeLabel ?? '', details: area.details } : null,
    } satisfies SelfV3CardView;
  });
}

export function buildSelfV3Response(i: CardViewsInput & { layout: SelfBoardLayoutView }): SelfV3Response {
  const anyV3 = Boolean(i.v3Cards && Object.keys(i.v3Cards).length > 0);
  return {
    status: i.v2.status,
    builtAt: i.v2.builtAt,
    readVersion: anyV3 ? 'v3' : i.v2.builtAt ? 'v2' : null,
    clock: i.v2.clock,
    profile: i.v2.profile,
    refresh: i.v2.refresh,
    build: i.v2.build,
    quality: i.v2.quality ?? null,
    layout: i.layout,
    cards: i.v2.status === 'no_kundli' ? [] : cardViews(i),
    reading: i.reading ?? null,
  };
}
