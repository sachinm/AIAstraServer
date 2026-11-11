/**
 * The board layout (docs/reading-engine/68 §4.1, §4.5 item 8): validate, read and write the person's cards, order,
 * sections and template. No model call and no astrological content; a layout change never queues a build.
 */
import type { PrismaClient } from '@prisma/client';
import { optionsFromRow, sectionsFor, validateCardOptions } from '../../boards/cardOptions.js';
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
  return { template: DEFAULT_TEMPLATE, cards: [], sections: {}, options: {}, chosen: false, updatedAt: null };
}

/** "Reset to suggested" and "Add the suggested eight" both mean this set */
export function suggestedLayout(): SelfBoardLayout {
  return { template: DEFAULT_TEMPLATE, cards: defaultSuggested(), sections: {} };
}

export type LayoutCheck = { ok: true; layout: SelfBoardLayout } | { ok: false; error: LayoutError; detail?: string };

/** Validates a PUT body against the registry. Unknown keys are ignored; missing `sections` means none changed. */
export function validateLayout(body: unknown): LayoutCheck {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_body' };
  const b = body as { template?: unknown; cards?: unknown; sections?: unknown; options?: unknown };

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
  // doc 71 §4.4 item 3: a card whose options are sent takes the sections they mean, unless this request also set them
  const opts = validateCardOptions(b.options, cards);
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
  return { ok: true, layout: out };
}

/** A stored row as the page sees it. A row that no longer validates (a card withdrawn) drops what is unknown. */
export function layoutFromRow(row: { template: string; cards: unknown; sections: unknown; options?: unknown; updated_at: Date } | null): SelfBoardLayoutView {
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
  return { template, cards, sections, options: optionsFromRow(row.options, cards), chosen: cards.length > 0, updatedAt: row.updated_at.toISOString() };
}

export async function readLayout(prisma: PrismaClient, kundliId: string, board: BoardId = 'self'): Promise<SelfBoardLayoutView> {
  const row = await prisma.boardLayout.findUnique({
    where: { kundli_id_board: { kundli_id: kundliId, board } },
    select: { template: true, cards: true, sections: true, options: true, updated_at: true },
  });
  return layoutFromRow(row);
}

export async function writeLayout(prisma: PrismaClient, userId: string, kundliId: string, layout: SelfBoardLayout, board: BoardId = 'self'): Promise<SelfBoardLayoutView> {
  // options are only written when the request carried them, so a PUT without options keeps the stored ones
  const data = { template: layout.template, cards: layout.cards, sections: layout.sections, ...(layout.options ? { options: layout.options } : {}) };
  const row = await prisma.boardLayout.upsert({
    where: { kundli_id_board: { kundli_id: kundliId, board } },
    create: { user_id: userId, kundli_id: kundliId, board, ...data },
    update: data,
    select: { template: true, cards: true, sections: true, options: true, updated_at: true },
  });
  return layoutFromRow(row);
}
