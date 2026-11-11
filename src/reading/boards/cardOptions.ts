/**
 * Card options (docs/reading-engine/71 §4.3, §4.4): how each card on a board reads, chosen by the person. Four choices,
 * each defaulting to today's card. Shared by Self, Love and Work. Nothing here is astrological: the options only pick
 * which stored parts a card shows and which periods it keeps.
 *
 *   length  usual | glance | deep    which parts the card shows
 *   view    year  | now    | arc     every period of the twelve months, only the current one, or the long arc
 *   words   plain | terms            terms adds Chart details (clocks and how many agree; never an engine name)
 *   plan    with  | without          without leaves out "One step" and The ladder
 */

export type CardLength = 'usual' | 'glance' | 'deep';
export type CardView = 'year' | 'now' | 'arc';
export type CardWords = 'plain' | 'terms';
export type CardPlan = 'with' | 'without';

export interface CardOptions {
  length: CardLength;
  view: CardView;
  words: CardWords;
  plan: CardPlan;
}

export type CardOptionKey = keyof CardOptions;

export const CARD_OPTION_VALUES: { readonly [K in CardOptionKey]: readonly CardOptions[K][] } = {
  length: ['usual', 'glance', 'deep'],
  view: ['year', 'now', 'arc'],
  words: ['plain', 'terms'],
  plan: ['with', 'without'],
};

export const DEFAULT_CARD_OPTIONS: Readonly<CardOptions> = Object.freeze({ length: 'usual', view: 'year', words: 'plain', plan: 'with' });

/** per card id, only the keys the person changed */
export type BoardCardOptions = Record<string, Partial<CardOptions>>;

export type OptionsCheck = { ok: true; options: BoardCardOptions } | { ok: false; error: 'bad_body' | 'unknown_option'; detail?: string };

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
    const one: Partial<CardOptions> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const allowed = (CARD_OPTION_VALUES as Record<string, readonly string[]>)[k];
      if (!allowed) return { ok: false, error: 'unknown_option', detail: `${id}.${k}` };
      if (typeof v !== 'string' || !allowed.includes(v)) return { ok: false, error: 'unknown_option', detail: `${id}.${k}=${String(v)}` };
      if (v !== DEFAULT_CARD_OPTIONS[k as CardOptionKey]) (one as Record<string, string>)[k] = v;
    }
    if (cards.includes(id) && Object.keys(one).length) out[id] = one;
  }
  return { ok: true, options: out };
}

/** A stored row's options as the page sees them: anything unknown is dropped, never an error on read. */
export function optionsFromRow(raw: unknown, cards: readonly string[]): BoardCardOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: BoardCardOptions = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!cards.includes(id) || !value || typeof value !== 'object') continue;
    const one: Partial<CardOptions> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const allowed = (CARD_OPTION_VALUES as Record<string, readonly string[]>)[k];
      if (allowed && typeof v === 'string' && allowed.includes(v) && v !== DEFAULT_CARD_OPTIONS[k as CardOptionKey]) (one as Record<string, string>)[k] = v;
    }
    if (Object.keys(one).length) out[id] = one;
  }
  return out;
}

export function effectiveOptions(chosen: Partial<CardOptions> | undefined): CardOptions {
  return { ...DEFAULT_CARD_OPTIONS, ...(chosen ?? {}) };
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
 * Plan = Without empties each period's step and drops the ladder. Never adds or invents anything.
 */
export function shapeSelfCard<C extends ShapeableCard>(card: C, chosen: Partial<CardOptions> | undefined): C & { options: CardOptions; optionNotes: string[] } {
  const o = effectiveOptions(chosen);
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
  return { ...card, rail, v3: v3 as C['v3'], options: o, optionNotes: selfOptionNotes(card.id, chosen) };
}
