/**
 * The board layout (docs/reading-engine/68 §4.1, §4.5 item 8): validate, read and write the person's cards, order,
 * sections and template. No model call and no astrological content; a layout change never queues a build.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { boardOptionsFromRow, defaultBoardOptions, optionsFromRow, sectionsFor, validateBoardOptions, validateCardOptions } from '../../boards/cardOptions.js';
import { getCardsReadMinArea } from '../../../config/env.js';
import { boardV3CardOn, V3_LENSES, type AreaV3Board, type BoardV3CardId } from '../../boards/v3Cards.js';
import { cardDef, defaultSuggested, isCardOffered } from './cards.js';
import {
  DEFAULT_TEMPLATE,
  FIXED_SECTIONS,
  MIN_CARDS,
  SELF_SECTIONS,
  SELF_TEMPLATES,
  SELF_TEMPLATES_LIVE,
  type BoardId,
  type LayoutBoardOptions,
  type LayoutError,
  type SelfBoardLayout,
  type SelfBoardLayoutView,
  type SelfCardId,
  type SelfSectionId,
  type SelfTemplateId,
} from './types.js';

/**
 * docs/dashboards/10 §7 S5: what a layout is checked against. Self by default (its registry, MIN_CARDS, no lens);
 * Love and Work pass their v3 registry, a minimum of 1 and their lenses.
 */
export interface LayoutRegistry<Id extends string = SelfCardId> {
  /** the card by id, or null when unknown on this board */
  def(id: string): { id: Id } | null;
  /** the card may be chosen now */
  offered(id: Id): boolean;
  minCards: number;
  /** the lens ids `boardOptions.lens` may take; absent: the board has no lens option */
  lenses?: readonly string[];
}

export const SELF_LAYOUT: LayoutRegistry<SelfCardId> = {
  def: (id) => cardDef(id),
  offered: (id) => isCardOffered(cardDef(id)!),
  minCards: MIN_CARDS,
};

/** A Love or Work board's layout registry (its v3 cards, at least one card, its four lenses). */
export function areaLayoutRegistry(board: AreaV3Board): LayoutRegistry<BoardV3CardId> {
  return {
    def: (id) => boardV3CardOn(board, id),
    offered: (id) => Boolean(boardV3CardOn(board, id)?.offered),
    minCards: 1,
    lenses: V3_LENSES[board].map((l) => l.id),
  };
}

/** the minimum a Love/Work lens deck needs to queue its reading (CARDS_READ_MIN_AREA) */
export const areaReadMin = (): number => getCardsReadMinArea();

/** the layout before the person has chosen: the default template, no cards (the page opens the picker) */
export function emptyLayout<Id extends string = SelfCardId>(): SelfBoardLayoutView<Id> {
  return { template: DEFAULT_TEMPLATE, cards: [], sections: {}, options: {}, boardOptions: {}, boardDefaults: defaultBoardOptions(), chosen: false, updatedAt: null, version: '' };
}

/** "Reset to suggested" and "Add the suggested eight" both mean this set */
export function suggestedLayout(): SelfBoardLayout {
  return { template: DEFAULT_TEMPLATE, cards: defaultSuggested(), sections: {} };
}

export type LayoutCheck<Id extends string = SelfCardId> = { ok: true; layout: SelfBoardLayout<Id> } | { ok: false; error: LayoutError; detail?: string };

/** Validates a PUT body against the registry. Unknown keys are ignored; missing `sections` means none changed. */
export function validateLayout<Id extends string = SelfCardId>(body: unknown, registry: LayoutRegistry<Id> = SELF_LAYOUT as unknown as LayoutRegistry<Id>): LayoutCheck<Id> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_body' };
  const b = body as { template?: unknown; cards?: unknown; sections?: unknown; options?: unknown; boardOptions?: unknown };

  const template = b.template ?? DEFAULT_TEMPLATE;
  if (typeof template !== 'string' || !(SELF_TEMPLATES as readonly string[]).includes(template)) return { ok: false, error: 'unknown_template' };
  if (!(SELF_TEMPLATES_LIVE as readonly string[]).includes(template)) return { ok: false, error: 'template_not_live', detail: template };

  if (!Array.isArray(b.cards)) return { ok: false, error: 'bad_body' };
  const cards: Id[] = [];
  for (const c of b.cards) {
    if (typeof c !== 'string') return { ok: false, error: 'unknown_card' };
    const def = registry.def(c);
    if (!def) return { ok: false, error: 'unknown_card', detail: c };
    if (!registry.offered(def.id)) return { ok: false, error: 'card_not_offered', detail: c };
    if (cards.includes(def.id)) return { ok: false, error: 'duplicate_card', detail: c };
    cards.push(def.id);
  }
  if (cards.length < registry.minCards) return { ok: false, error: 'too_few_cards' };

  const sections: Partial<Record<Id, SelfSectionId[]>> = {};
  if (b.sections !== undefined && b.sections !== null) {
    if (typeof b.sections !== 'object' || Array.isArray(b.sections)) return { ok: false, error: 'bad_body' };
    for (const [id, list] of Object.entries(b.sections as Record<string, unknown>)) {
      const def = registry.def(id);
      if (!def) return { ok: false, error: 'unknown_card', detail: id };
      if (!Array.isArray(list)) return { ok: false, error: 'bad_body' };
      const on: SelfSectionId[] = [];
      for (const s of list) {
        if (typeof s !== 'string' || !(SELF_SECTIONS as readonly string[]).includes(s)) return { ok: false, error: 'unknown_section', detail: String(s) };
        if (!on.includes(s as SelfSectionId)) on.push(s as SelfSectionId);
      }
      for (const f of FIXED_SECTIONS) if (!on.includes(f)) return { ok: false, error: 'fixed_section_off', detail: `${id}.${f}` };
      // kept in the registry's section order so equal sets compare equal
      sections[def.id] = SELF_SECTIONS.filter((s) => on.includes(s));
    }
  }
  // docs/dashboards/10 §4.3: a board with lenses keeps `lens` (one of its lens ids); the rest is checked as before
  let lens: string | undefined;
  let boardRaw: unknown = b.boardOptions;
  if (registry.lenses && b.boardOptions && typeof b.boardOptions === 'object' && !Array.isArray(b.boardOptions) && 'lens' in (b.boardOptions as object)) {
    const { lens: l, ...rest } = b.boardOptions as Record<string, unknown>;
    if (typeof l !== 'string' || !registry.lenses.includes(l)) return { ok: false, error: 'unknown_option', detail: `board.lens=${String(l)}` };
    lens = l;
    boardRaw = rest;
  }
  const board = validateBoardOptions(boardRaw);
  if (!board.ok) return { ok: false, error: board.error, ...(board.detail ? { detail: board.detail } : {}) };
  // doc 71 §4.4 item 3: a card whose options are sent takes the sections they mean, unless this request also set them
  const opts = validateCardOptions(b.options, cards, board.options);
  if (!opts.ok) return { ok: false, error: opts.error, ...(opts.detail ? { detail: opts.detail } : {}) };
  if (b.options !== undefined && b.options !== null) {
    for (const id of Object.keys(b.options as Record<string, unknown>)) {
      const def = registry.def(id);
      if (!def || !cards.includes(def.id)) continue;
      const explicit = b.sections && typeof b.sections === 'object' && Object.prototype.hasOwnProperty.call(b.sections, id);
      if (!explicit) sections[def.id] = sectionsFor(opts.options[id]);
    }
  }
  const out: SelfBoardLayout<Id> = { template: template as SelfTemplateId, cards, sections };
  if (b.options !== undefined && b.options !== null) out.options = opts.options;
  if (b.boardOptions !== undefined && b.boardOptions !== null) out.boardOptions = lens !== undefined ? { ...board.options, lens } : board.options;
  return { ok: true, layout: out };
}

const LAYOUT_SELECT = { template: true, cards: true, sections: true, options: true, board_options: true, updated_at: true } as const;

/** A stored row as the page sees it. A row that no longer validates (a card withdrawn) drops what is unknown. */
export function layoutFromRow<Id extends string = SelfCardId>(
  row: { template: string; cards: unknown; sections: unknown; options?: unknown; board_options?: unknown; updated_at: Date } | null,
  registry: LayoutRegistry<Id> = SELF_LAYOUT as unknown as LayoutRegistry<Id>,
): SelfBoardLayoutView<Id> {
  if (!row) return emptyLayout<Id>();
  const template = (SELF_TEMPLATES_LIVE as readonly string[]).includes(row.template) ? (row.template as SelfTemplateId) : DEFAULT_TEMPLATE;
  const cards = (Array.isArray(row.cards) ? row.cards : [])
    .map((c) => (typeof c === 'string' ? registry.def(c) : null))
    .filter((d): d is NonNullable<typeof d> => Boolean(d && registry.offered(d.id)))
    .map((d) => d.id)
    .filter((id, i, all) => all.indexOf(id) === i);
  const sections: Partial<Record<Id, SelfSectionId[]>> = {};
  if (row.sections && typeof row.sections === 'object' && !Array.isArray(row.sections)) {
    for (const [id, list] of Object.entries(row.sections as Record<string, unknown>)) {
      const def = registry.def(id);
      if (!def || !Array.isArray(list)) continue;
      const on = SELF_SECTIONS.filter((s) => (list as unknown[]).includes(s) || FIXED_SECTIONS.includes(s));
      sections[def.id] = on;
    }
  }
  const boardOptions: LayoutBoardOptions = boardOptionsFromRow(row.board_options);
  const storedLens = row.board_options && typeof row.board_options === 'object' ? (row.board_options as { lens?: unknown }).lens : undefined;
  if (registry.lenses && typeof storedLens === 'string' && registry.lenses.includes(storedLens)) boardOptions.lens = storedLens;
  return {
    template,
    cards,
    sections,
    options: optionsFromRow(row.options, cards, boardOptions),
    boardOptions,
    boardDefaults: defaultBoardOptions(),
    chosen: cards.length > 0,
    updatedAt: row.updated_at.toISOString(),
    version: row.updated_at.toISOString(),
  };
}

/** One indexed row (board_layout_kundli_board_key); the board settings come in the same read. */
export async function readLayout(prisma: PrismaClient, kundliId: string, board: BoardId = 'self'): Promise<SelfBoardLayoutView> {
  const row = await prisma.boardLayout.findUnique({ where: { kundli_id_board: { kundli_id: kundliId, board } }, select: LAYOUT_SELECT });
  return layoutFromRow(row);
}

/** docs/dashboards/10 §7 S5: a Love or Work board's v3 layout (the same `board_layout` row, read with its registry). */
export async function readBoardLayout(prisma: PrismaClient, kundliId: string, board: AreaV3Board): Promise<SelfBoardLayoutView<BoardV3CardId>> {
  const row = await prisma.boardLayout.findUnique({ where: { kundli_id_board: { kundli_id: kundliId, board } }, select: LAYOUT_SELECT });
  return layoutFromRow(row, areaLayoutRegistry(board));
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** merges `{ key: value | null }` into `base`: a null key resets it */
function mergeKeys(base: Json, patch: Json): Json {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

/**
 * doc 75 §4.1: a PUT patch applied to the stored layout, as a whole-layout body for `validateLayout`. `cards` and
 * `template` replace; `sections[id]` replaces (null resets); `options[id]` keys merge (null resets the key, a null card
 * resets the card); `boardOptions` keys merge. A card whose options changed takes the sections they mean unless the
 * patch also set its sections. Options and sections of cards no longer on the board are dropped.
 */
export function mergeLayoutPatch<Id extends string>(current: SelfBoardLayoutView<Id>, patch: unknown): { ok: true; body: Json } | { ok: false; error: LayoutError } {
  if (!isObj(patch)) return { ok: false, error: 'bad_body' };
  const cards = patch.cards !== undefined ? patch.cards : current.cards;
  if (!Array.isArray(cards)) return { ok: false, error: 'bad_body' };
  const onBoard = new Set(cards.filter((c): c is string => typeof c === 'string'));

  const sections: Json = { ...current.sections };
  if (patch.sections !== undefined) {
    if (!isObj(patch.sections)) return { ok: false, error: 'bad_body' };
    for (const [id, list] of Object.entries(patch.sections)) {
      if (list === null) delete sections[id];
      else sections[id] = list;
    }
  }
  const options: Json = { ...current.options };
  if (patch.options !== undefined) {
    if (!isObj(patch.options)) return { ok: false, error: 'bad_body' };
    for (const [id, o] of Object.entries(patch.options)) {
      if (o === null) delete options[id];
      else if (!isObj(o)) return { ok: false, error: 'bad_body' };
      else {
        const merged = mergeKeys(isObj(options[id]) ? (options[id] as Json) : {}, o);
        if (Object.keys(merged).length) options[id] = merged;
        else delete options[id];
      }
      if (!(isObj(patch.sections) && Object.prototype.hasOwnProperty.call(patch.sections, id))) delete sections[id];
    }
  }
  let boardOptions: Json = { ...current.boardOptions };
  if (patch.boardOptions !== undefined) {
    if (!isObj(patch.boardOptions)) return { ok: false, error: 'bad_body' };
    boardOptions = mergeKeys(boardOptions, patch.boardOptions);
  }
  for (const id of Object.keys(sections)) if (!onBoard.has(id)) delete sections[id];
  for (const id of Object.keys(options)) if (!onBoard.has(id)) delete options[id];
  return { ok: true, body: { template: patch.template ?? current.template, cards, sections, options, boardOptions } };
}

export type VersionedWrite<Id extends string = SelfCardId> = { ok: true; layout: SelfBoardLayoutView<Id> } | { ok: false; conflict: true; layout: SelfBoardLayoutView<Id> };

const isUniqueClash = (e: unknown): boolean => (e as { code?: string } | null)?.code === 'P2002';

/**
 * doc 75 §4.1: writes only if the row is still the one read (`expected` = its `updated_at`, ISO; '' = no row yet).
 * The match spans the whole millisecond so a row written with microseconds by SQL still matches its own version.
 * Another write in between: `{ conflict: true }` with the layout now stored.
 */
export async function writeLayoutVersioned<Id extends string = SelfCardId>(
  prisma: PrismaClient,
  userId: string,
  kundliId: string,
  layout: SelfBoardLayout<Id>,
  expected: string,
  board: BoardId = 'self',
  registry: LayoutRegistry<Id> = SELF_LAYOUT as unknown as LayoutRegistry<Id>,
): Promise<VersionedWrite<Id>> {
  const data = layoutData(layout);
  const read = async (): Promise<SelfBoardLayoutView<Id>> =>
    layoutFromRow(await prisma.boardLayout.findUnique({ where: { kundli_id_board: { kundli_id: kundliId, board } }, select: LAYOUT_SELECT }), registry);
  if (!expected) {
    try {
      const row = await prisma.boardLayout.create({ data: { user_id: userId, kundli_id: kundliId, board, ...data }, select: LAYOUT_SELECT });
      return { ok: true, layout: layoutFromRow(row, registry) };
    } catch (e) {
      if (!isUniqueClash(e)) throw e;
      return { ok: false, conflict: true, layout: await read() };
    }
  }
  const t = Date.parse(expected);
  if (!Number.isFinite(t)) return { ok: false, conflict: true, layout: await read() };
  const r = await prisma.boardLayout.updateMany({
    where: { kundli_id: kundliId, board, updated_at: { gte: new Date(t), lt: new Date(t + 1) } },
    data,
  });
  const now = await read();
  return r.count === 0 ? { ok: false, conflict: true, layout: now } : { ok: true, layout: now };
}

function layoutData<Id extends string>(layout: SelfBoardLayout<Id>) {
  return {
    template: layout.template,
    cards: layout.cards,
    sections: layout.sections,
    ...(layout.options ? { options: layout.options } : {}),
    ...(layout.boardOptions ? { board_options: { ...layout.boardOptions } as Prisma.InputJsonObject } : {}),
  };
}

export async function writeLayout(prisma: PrismaClient, userId: string, kundliId: string, layout: SelfBoardLayout, board: BoardId = 'self'): Promise<SelfBoardLayoutView> {
  // options and board options are only written when the request carried them, so a PUT without them keeps the stored ones
  const data = {
    template: layout.template,
    cards: layout.cards,
    sections: layout.sections,
    ...(layout.options ? { options: layout.options } : {}),
    ...(layout.boardOptions ? { board_options: { ...layout.boardOptions } as Prisma.InputJsonObject } : {}),
  };
  const row = await prisma.boardLayout.upsert({
    where: { kundli_id_board: { kundli_id: kundliId, board } },
    create: { user_id: userId, kundli_id: kundliId, board, ...data },
    update: data,
    select: LAYOUT_SELECT,
  });
  return layoutFromRow(row);
}
