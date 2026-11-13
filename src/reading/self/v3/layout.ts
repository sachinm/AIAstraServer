/**
 * The board layout (docs/reading-engine/68 §4.1, §4.5 item 8): validate, read and write the person's cards, order,
 * sections and template. No model call and no astrological content; a layout change never queues a build.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { boardOptionsFromRow, defaultBoardOptions, optionsFromRow, sectionsFor, validateBoardOptions, validateCardOptions } from '../../boards/cardOptions.js';
import { cardDef, defaultSuggested, isCardOffered } from './cards.js';
import {
  DEFAULT_TEMPLATE,
  FIXED_SECTIONS,
  MIN_CARDS,
  SELF_SECTIONS,
  SELF_TEMPLATES,
  SELF_TEMPLATES_LIVE,
  type BoardId,
  type LayoutError,
  type SelfBoardLayout,
  type SelfBoardLayoutView,
  type SelfCardId,
  type SelfSectionId,
  type SelfTemplateId,
} from './types.js';

/** the layout before the person has chosen: the default template, no cards (the page opens the picker) */
export function emptyLayout(): SelfBoardLayoutView {
  return { template: DEFAULT_TEMPLATE, cards: [], sections: {}, options: {}, boardOptions: {}, boardDefaults: defaultBoardOptions(), chosen: false, updatedAt: null, version: '' };
}

/** "Reset to suggested" and "Add the suggested eight" both mean this set */
export function suggestedLayout(): SelfBoardLayout {
  return { template: DEFAULT_TEMPLATE, cards: defaultSuggested(), sections: {} };
}

export type LayoutCheck = { ok: true; layout: SelfBoardLayout } | { ok: false; error: LayoutError; detail?: string };

/** Validates a PUT body against the registry. Unknown keys are ignored; missing `sections` means none changed. */
export function validateLayout(body: unknown): LayoutCheck {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_body' };
  const b = body as { template?: unknown; cards?: unknown; sections?: unknown; options?: unknown; boardOptions?: unknown };

  const template = b.template ?? DEFAULT_TEMPLATE;
  if (typeof template !== 'string' || !(SELF_TEMPLATES as readonly string[]).includes(template)) return { ok: false, error: 'unknown_template' };
  if (!(SELF_TEMPLATES_LIVE as readonly string[]).includes(template)) return { ok: false, error: 'template_not_live', detail: template };

  if (!Array.isArray(b.cards)) return { ok: false, error: 'bad_body' };
  const cards: SelfCardId[] = [];
  for (const c of b.cards) {
    if (typeof c !== 'string') return { ok: false, error: 'unknown_card' };
    const def = cardDef(c);
    if (!def) return { ok: false, error: 'unknown_card', detail: c };
    if (!isCardOffered(def)) return { ok: false, error: 'card_not_offered', detail: c };
    if (cards.includes(def.id)) return { ok: false, error: 'duplicate_card', detail: c };
    cards.push(def.id);
  }
  if (cards.length < MIN_CARDS) return { ok: false, error: 'too_few_cards' };

  const sections: Partial<Record<SelfCardId, SelfSectionId[]>> = {};
  if (b.sections !== undefined && b.sections !== null) {
    if (typeof b.sections !== 'object' || Array.isArray(b.sections)) return { ok: false, error: 'bad_body' };
    for (const [id, list] of Object.entries(b.sections as Record<string, unknown>)) {
      const def = cardDef(id);
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
  const board = validateBoardOptions(b.boardOptions);
  if (!board.ok) return { ok: false, error: board.error, ...(board.detail ? { detail: board.detail } : {}) };
  // doc 71 §4.4 item 3: a card whose options are sent takes the sections they mean, unless this request also set them
  const opts = validateCardOptions(b.options, cards, board.options);
  if (!opts.ok) return { ok: false, error: opts.error, ...(opts.detail ? { detail: opts.detail } : {}) };
  if (b.options !== undefined && b.options !== null) {
    for (const id of Object.keys(b.options as Record<string, unknown>)) {
      const def = cardDef(id);
      if (!def || !cards.includes(def.id)) continue;
      const explicit = b.sections && typeof b.sections === 'object' && Object.prototype.hasOwnProperty.call(b.sections, id);
      if (!explicit) sections[def.id] = sectionsFor(opts.options[id]);
    }
  }
  const out: SelfBoardLayout = { template: template as SelfTemplateId, cards, sections };
  if (b.options !== undefined && b.options !== null) out.options = opts.options;
  if (b.boardOptions !== undefined && b.boardOptions !== null) out.boardOptions = board.options;
  return { ok: true, layout: out };
}

const LAYOUT_SELECT = { template: true, cards: true, sections: true, options: true, board_options: true, updated_at: true } as const;

/** A stored row as the page sees it. A row that no longer validates (a card withdrawn) drops what is unknown. */
export function layoutFromRow(row: { template: string; cards: unknown; sections: unknown; options?: unknown; board_options?: unknown; updated_at: Date } | null): SelfBoardLayoutView {
  if (!row) return emptyLayout();
  const template = (SELF_TEMPLATES_LIVE as readonly string[]).includes(row.template) ? (row.template as SelfTemplateId) : DEFAULT_TEMPLATE;
  const cards = (Array.isArray(row.cards) ? row.cards : [])
    .map((c) => (typeof c === 'string' ? cardDef(c) : null))
    .filter((d): d is NonNullable<typeof d> => Boolean(d && isCardOffered(d)))
    .map((d) => d.id)
    .filter((id, i, all) => all.indexOf(id) === i);
  const sections: Partial<Record<SelfCardId, SelfSectionId[]>> = {};
  if (row.sections && typeof row.sections === 'object' && !Array.isArray(row.sections)) {
    for (const [id, list] of Object.entries(row.sections as Record<string, unknown>)) {
      const def = cardDef(id);
      if (!def || !Array.isArray(list)) continue;
      const on = SELF_SECTIONS.filter((s) => (list as unknown[]).includes(s) || FIXED_SECTIONS.includes(s));
      sections[def.id] = on;
    }
  }
  const boardOptions = boardOptionsFromRow(row.board_options);
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
export function mergeLayoutPatch(current: SelfBoardLayoutView, patch: unknown): { ok: true; body: Json } | { ok: false; error: LayoutError } {
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

export type VersionedWrite = { ok: true; layout: SelfBoardLayoutView } | { ok: false; conflict: true; layout: SelfBoardLayoutView };

const isUniqueClash = (e: unknown): boolean => (e as { code?: string } | null)?.code === 'P2002';

/**
 * doc 75 §4.1: writes only if the row is still the one read (`expected` = its `updated_at`, ISO; '' = no row yet).
 * The match spans the whole millisecond so a row written with microseconds by SQL still matches its own version.
 * Another write in between: `{ conflict: true }` with the layout now stored.
 */
export async function writeLayoutVersioned(
  prisma: PrismaClient,
  userId: string,
  kundliId: string,
  layout: SelfBoardLayout,
  expected: string,
  board: BoardId = 'self',
): Promise<VersionedWrite> {
  const data = layoutData(layout);
  if (!expected) {
    try {
      const row = await prisma.boardLayout.create({ data: { user_id: userId, kundli_id: kundliId, board, ...data }, select: LAYOUT_SELECT });
      return { ok: true, layout: layoutFromRow(row) };
    } catch (e) {
      if (!isUniqueClash(e)) throw e;
      return { ok: false, conflict: true, layout: await readLayout(prisma, kundliId, board) };
    }
  }
  const t = Date.parse(expected);
  if (!Number.isFinite(t)) return { ok: false, conflict: true, layout: await readLayout(prisma, kundliId, board) };
  const r = await prisma.boardLayout.updateMany({
    where: { kundli_id: kundliId, board, updated_at: { gte: new Date(t), lt: new Date(t + 1) } },
    data,
  });
  const now = await readLayout(prisma, kundliId, board);
  return r.count === 0 ? { ok: false, conflict: true, layout: now } : { ok: true, layout: now };
}

function layoutData(layout: SelfBoardLayout) {
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
