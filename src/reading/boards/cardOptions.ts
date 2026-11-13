/**
 * Card options (docs/reading-engine/71 §4.3, §4.4): how each card on a board reads, chosen by the person. Four choices,
 * each defaulting to today's card. Shared by Self, Love and Work. Nothing here is astrological: the options only pick
 * which stored parts a card shows and which periods it keeps.
 *
 *   length  usual | glance | deep    which parts the card shows
 *   view    year  | now    | arc     every period of the twelve months, only the current one, or the long arc
 *   words   plain | terms            terms adds Chart details (clocks and how many agree; never an engine name)
 *   plan    with  | without          without leaves out "One step" and The ladder
 *
 * The redesign adds how the card is laid out; the allowed values and defaults come from src/config/env.ts:
 *
 *   face      read | light | breakdown | research         which face of the card opens (layout only: no field is
 *                                                         added or removed by a face, role-gated content included)
 *   tools     subset of table|calendar|dates|timeframe|plan|info, unique, kept in the list's order
 *   groupBy   weeks | months | quarters | years | decades  (default quarters)
 *   groupsAs  swipe | accordion
 *   start     short | full                                 (default short)
 *
 * The board-wide settings (`boardOptions`) take the same keys plus `confirm` and `motion` (booleans). A card's options
 * in force are its own, then the board's, then the defaults.
 */
import {
  getBoardConfirmDefault,
  getBoardMotionDefault,
  getCardFaceDefault,
  getCardFaces,
  getCardGroupByDefault,
  getCardGroupByValues,
  getCardGroupsAsDefault,
  getCardGroupsAsValues,
  getCardStartDefault,
  getCardStartValues,
  getCardTools,
  getCardToolsDefault,
  type CardFace,
  type CardGroupBy,
  type CardGroupsAs,
  type CardStart,
  type CardTool,
} from '../../config/env.js';

export type { CardFace, CardGroupBy, CardGroupsAs, CardStart, CardTool };
export type CardLength = 'usual' | 'glance' | 'deep';
export type CardView = 'year' | 'now' | 'arc';
export type CardWords = 'plain' | 'terms';
export type CardPlan = 'with' | 'without';

export interface CardOptions {
  length: CardLength;
  view: CardView;
  words: CardWords;
  plan: CardPlan;
  face: CardFace;
  tools: CardTool[];
  groupBy: CardGroupBy;
  groupsAs: CardGroupsAs;
  start: CardStart;
}

export type CardOptionKey = keyof CardOptions;
type ScalarOptionKey = Exclude<CardOptionKey, 'tools'>;

/** the board-wide settings: every card option, plus two board switches */
export interface BoardOptions extends CardOptions {
  /** ask before an action that costs a question */
  confirm: boolean;
  /** animations on */
  motion: boolean;
}

export type OptionValues = { readonly [K in ScalarOptionKey]: readonly CardOptions[K][] } & { readonly tools: readonly CardTool[] };

/** The values each option may take (env-driven for the redesign keys). */
export function cardOptionValues(): OptionValues {
  return {
    length: ['usual', 'glance', 'deep'],
    view: ['year', 'now', 'arc'],
    words: ['plain', 'terms'],
    plan: ['with', 'without'],
    face: getCardFaces(),
    tools: getCardTools(),
    groupBy: getCardGroupByValues(),
    groupsAs: getCardGroupsAsValues(),
    start: getCardStartValues(),
  };
}

export function defaultCardOptions(): CardOptions {
  return {
    length: 'usual',
    view: 'year',
    words: 'plain',
    plan: 'with',
    face: getCardFaceDefault(),
    tools: getCardToolsDefault(),
    groupBy: getCardGroupByDefault(),
    groupsAs: getCardGroupsAsDefault(),
    start: getCardStartDefault(),
  };
}

export function defaultBoardOptions(): BoardOptions {
  return { ...defaultCardOptions(), confirm: getBoardConfirmDefault(), motion: getBoardMotionDefault() };
}

/** the values and defaults at module load (kept for callers that read them as constants) */
export const CARD_OPTION_VALUES: OptionValues = cardOptionValues();
export const DEFAULT_CARD_OPTIONS: Readonly<CardOptions> = Object.freeze(defaultCardOptions());

/** per card id, only the keys the person changed */
export type BoardCardOptions = Record<string, Partial<CardOptions>>;

export type OptionsCheck = { ok: true; options: BoardCardOptions } | { ok: false; error: 'bad_body' | 'unknown_option'; detail?: string };
export type BoardOptionsCheck = { ok: true; options: Partial<BoardOptions> } | { ok: false; error: 'bad_body' | 'unknown_option'; detail?: string };

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

type OneParse = { ok: true; value: Partial<BoardOptions> } | { ok: false; detail: string };

/**
 * One options object. Strict (a PUT): an unknown key or value fails with its `detail`. Lenient (a stored row): unknown
 * keys and values are dropped. Either way a value equal to its default is dropped, so equal choices store equal rows.
 */
function parseOne(prefix: string, value: Record<string, unknown>, strict: boolean, board: boolean): OneParse {
  const allowed = cardOptionValues();
  const defaults = defaultBoardOptions();
  const one: Partial<BoardOptions> = {};
  for (const [k, v] of Object.entries(value)) {
    if (board && (k === 'confirm' || k === 'motion')) {
      if (typeof v !== 'boolean') {
        if (strict) return { ok: false, detail: `${prefix}.${k}=${String(v)}` };
        continue;
      }
      if (v !== defaults[k]) one[k] = v;
      continue;
    }
    if (k === 'tools') {
      const list = Array.isArray(v) ? v : null;
      const known = list?.filter((t): t is CardTool => typeof t === 'string' && (allowed.tools as readonly string[]).includes(t)) ?? [];
      if (strict && (!list || known.length !== list.length || new Set(known).size !== known.length)) {
        return { ok: false, detail: `${prefix}.tools=${Array.isArray(v) ? v.map(String).join(',') : String(v)}` };
      }
      if (!list) continue;
      const tools = allowed.tools.filter((t) => known.includes(t));
      if (!sameSet(tools, defaults.tools)) one.tools = tools;
      continue;
    }
    const values = (allowed as unknown as Record<string, readonly string[] | undefined>)[k];
    if (!values) {
      if (strict) return { ok: false, detail: `${prefix}.${k}` };
      continue;
    }
    if (typeof v !== 'string' || !values.includes(v)) {
      if (strict) return { ok: false, detail: `${prefix}.${k}=${String(v)}` };
      continue;
    }
    if (v !== defaults[k as ScalarOptionKey]) (one as Record<string, string>)[k] = v;
  }
  return { ok: true, value: one };
}

/**
 * Validates a PUT body's `options`. Unknown keys or values are refused; options for a card not in `cards` are dropped;
 * a key equal to its default is dropped too, so equal choices store equal rows.
 */
export function validateCardOptions(raw: unknown, cards: readonly string[]): OptionsCheck {
  if (raw === undefined || raw === null) return { ok: true, options: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'bad_body' };
  const out: BoardCardOptions = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'bad_body' };
    const one = parseOne(id, value as Record<string, unknown>, true, false);
    if (!one.ok) return { ok: false, error: 'unknown_option', detail: one.detail };
    if (cards.includes(id) && Object.keys(one.value).length) out[id] = one.value as Partial<CardOptions>;
  }
  return { ok: true, options: out };
}

/** A stored row's options as the page sees them: anything unknown is dropped, never an error on read. */
export function optionsFromRow(raw: unknown, cards: readonly string[]): BoardCardOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: BoardCardOptions = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!cards.includes(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const one = parseOne(id, value as Record<string, unknown>, false, false);
    if (one.ok && Object.keys(one.value).length) out[id] = one.value as Partial<CardOptions>;
  }
  return out;
}

/** Validates a PUT body's `boardOptions` (detail `board.<key>`). Absent or null: nothing changed (`{}`). */
export function validateBoardOptions(raw: unknown): BoardOptionsCheck {
  if (raw === undefined || raw === null) return { ok: true, options: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'bad_body' };
  const one = parseOne('board', raw as Record<string, unknown>, true, true);
  return one.ok ? { ok: true, options: one.value } : { ok: false, error: 'unknown_option', detail: one.detail };
}

/** A stored row's `board_options`: anything unknown dropped; always an object. */
export function boardOptionsFromRow(raw: unknown): Partial<BoardOptions> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const one = parseOne('board', raw as Record<string, unknown>, false, true);
  return one.ok ? one.value : {};
}

/** A card's options in force: its own, then the board's, then the defaults. */
export function effectiveOptions(chosen: Partial<CardOptions> | undefined, board?: Partial<BoardOptions>): CardOptions {
  const { confirm: _c, motion: _m, ...boardCard } = board ?? {};
  return { ...defaultCardOptions(), ...boardCard, ...(chosen ?? {}) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Self: the sections a card's options mean (doc 71 §4.3), and the card shaped by them on read (§4.4 item 4)
// ---------------------------------------------------------------------------------------------------------------------

export type OptionSection = 'line' | 'year' | 'stretch' | 'confirm' | 'pattern' | 'ladder' | 'details';

/** the Self cards that have a long arc today (the chapters of a life) */
export const ARC_CARDS: readonly string[] = ['chapter', 'chapters'];

/**
 * Glance: the line and the year rail. Usual: today's default four. Deep: adds Your pattern, and The ladder with a plan.
 * Chart terms adds Chart details. Always in the registry's section order.
 */
export function sectionsFor(chosen: Partial<CardOptions> | undefined): OptionSection[] {
  const o = effectiveOptions(chosen);
  const on = new Set<OptionSection>(['line', 'year']);
  if (o.length !== 'glance') {
    on.add('stretch');
    on.add('confirm');
  }
  if (o.length === 'deep') {
    on.add('pattern');
    if (o.plan === 'with') on.add('ladder');
  }
  if (o.words === 'terms') on.add('details');
  const order: OptionSection[] = ['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder', 'details'];
  return order.filter((s) => on.has(s));
}

export const OPTION_NOTE = {
  arcOnlyTime: 'The long arc is only on This chapter and Chapters for now. This card shows your year.',
  deepSameText: 'Deep shows every part we have. Longer writing comes with a later reading.',
  noPlanLines: 'This board has no plan lines yet.',
  arcAreaBoard: 'The long arc shows the next three years here.',
} as const;

/** The plain lines a Self card shows where an option cannot be honoured yet. */
export function selfOptionNotes(cardId: string, chosen: Partial<CardOptions> | undefined): string[] {
  const o = effectiveOptions(chosen);
  const notes: string[] = [];
  if (o.view === 'arc' && !ARC_CARDS.includes(cardId)) notes.push(OPTION_NOTE.arcOnlyTime);
  if (o.length === 'deep') notes.push(OPTION_NOTE.deepSameText);
  return notes;
}

/** The plain lines a Love or Work card shows where an option cannot be honoured yet. */
export function areaOptionNotes(chosen: Partial<CardOptions> | undefined): string[] {
  const o = effectiveOptions(chosen);
  const notes: string[] = [];
  if (o.view === 'arc') notes.push(OPTION_NOTE.arcAreaBoard);
  if (o.plan === 'without') notes.push(OPTION_NOTE.noPlanLines);
  if (o.length === 'deep') notes.push(OPTION_NOTE.deepSameText);
  return notes;
}

/** the parts of a Self card view the options filter (structural, so this module needs no Self import) */
interface ShapeableSpan {
  span: string;
  step: string;
}
interface ShapeableCard {
  id: string;
  rail: Array<{ current: boolean; span: string | null }>;
  v3: { spans: ShapeableSpan[]; ladder: unknown } | null;
}

/**
 * Applies a Self card's options to its stored content. View = Now keeps only the current period (when one is known);
 * Plan = Without empties each period's step and drops the ladder. Never adds or invents anything; face, tools, groupBy,
 * groupsAs and start are layout for the page and change no content here.
 */
export function shapeSelfCard<C extends ShapeableCard>(card: C, chosen: Partial<CardOptions> | undefined, board?: Partial<BoardOptions>): C & { options: CardOptions; optionNotes: string[] } {
  const o = effectiveOptions(chosen, board);
  let rail = card.rail;
  let v3 = card.v3;
  if (o.view === 'now') {
    const current = card.rail.filter((r) => r.current);
    if (current.length) {
      rail = current as C['rail'];
      const keep = new Set(current.map((r) => r.span).filter((s): s is string => Boolean(s)));
      if (v3 && keep.size) v3 = { ...v3, spans: v3.spans.filter((s) => keep.has(s.span)) };
    }
  }
  if (o.plan === 'without' && v3) v3 = { ...v3, spans: v3.spans.map((s) => ({ ...s, step: '' })), ladder: null };
  return { ...card, rail, v3: v3 as C['v3'], options: o, optionNotes: selfOptionNotes(card.id, o) };
}
