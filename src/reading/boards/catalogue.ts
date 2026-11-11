/**
 * The Love and Work card catalogues (docs/reading-engine/69 §3, 71 §4.4 items 5–6). Words only: each card's title, the
 * question it answers, its group, and the sub-areas of today's board that feed it. A card with no sub-area is
 * "Coming soon" until doc 69's v3 cards are built. Nothing astrological is here: the sub-area keys are the board's own
 * tags (src/reading/area/love.ts, career.ts).
 */
import type { PrismaClient } from '@prisma/client';
import { areaOptionNotes, effectiveOptions, optionsFromRow, validateCardOptions, type BoardCardOptions, type CardOptions } from './cardOptions.js';

export type AreaBoardId = 'love' | 'work';
export const AREA_BOARDS: readonly AreaBoardId[] = ['love', 'work'];

export interface BoardCardDef {
  id: string;
  board: AreaBoardId;
  group: string;
  title: string;
  description: string;
  /** one of the five that start on the board (doc 69 ●) */
  suggested: boolean;
  /** today's sub-area tags this card shows; '*' is every sub-area; empty: coming soon */
  subareas: readonly string[];
}

export const BOARD_GROUPS: Record<AreaBoardId, ReadonlyArray<{ id: string; title: string }>> = {
  love: [
    { id: 'bond', title: 'You two' },
    { id: 'meeting', title: 'Meeting and waiting' },
    { id: 'circle', title: 'Family and friends' },
  ],
  work: [
    { id: 'standing', title: 'Where you stand' },
    { id: 'money', title: 'Money and moves' },
    { id: 'growth', title: 'Growth' },
  ],
};

export const BOARD_CARDS: readonly BoardCardDef[] = [
  // Love (doc 69 §3.1)
  { id: 'love_where', board: 'love', group: 'bond', title: 'Where love stands', description: 'The state of your close bonds this year, period by period', suggested: true, subareas: ['*'] },
  { id: 'love_between', board: 'love', group: 'bond', title: 'How things are between you', description: 'Warmth and strain with your partner through the year', suggested: true, subareas: ['health', 'romance'] },
  { id: 'love_strain', board: 'love', group: 'bond', title: 'Distance or tension', description: 'What strains it, from where, when it eases, what holds it', suggested: true, subareas: ['strain'] },
  { id: 'love_commitment', board: 'love', group: 'bond', title: 'Commitment', description: 'When a bond can be made firm', suggested: false, subareas: ['commitment'] },
  { id: 'love_reconcile', board: 'love', group: 'bond', title: 'Getting back together', description: 'Whether and when a door reopens', suggested: false, subareas: ['reconcile'] },
  { id: 'love_meet', board: 'love', group: 'meeting', title: 'Meeting someone', description: 'When meeting is likely and what to do in the quiet months', suggested: true, subareas: ['meet'] },
  { id: 'love_delay', board: 'love', group: 'meeting', title: 'Why it is taking time', description: 'What is slowing it, since when, until when', suggested: true, subareas: ['delay'] },
  { id: 'love_partner', board: 'love', group: 'meeting', title: 'The partner you draw', description: 'The kind of person you are drawn to and who suits you', suggested: false, subareas: [] },
  { id: 'love_family', board: 'love', group: 'circle', title: 'Family and in-laws', description: 'How family acceptance and the home sit this year', suggested: true, subareas: ['family_accept'] },
  { id: 'love_friends', board: 'love', group: 'circle', title: 'Friendships', description: 'The friends who carry you and when to lean on them', suggested: false, subareas: ['friends'] },

  // Work (doc 69 §3.2)
  { id: 'work_where', board: 'work', group: 'standing', title: 'Where work stands', description: 'The state of your working life this year, period by period', suggested: true, subareas: ['*'] },
  { id: 'work_wears', board: 'work', group: 'standing', title: 'What wears you at work', description: 'Load, conflict, a difficult superior: since when, until when', suggested: true, subareas: ['job_security'] },
  { id: 'work_recognition', board: 'work', group: 'standing', title: 'Recognition', description: 'Being seen, promoted, credited', suggested: false, subareas: ['promotion'] },
  { id: 'work_leading', board: 'work', group: 'standing', title: 'Leading people', description: 'Authority and those who report to you', suggested: false, subareas: [] },
  { id: 'work_money', board: 'work', group: 'money', title: 'Money coming in', description: 'Income and gains through the year: thin stretches and openings', suggested: true, subareas: ['pay'] },
  { id: 'work_move', board: 'work', group: 'money', title: 'The next move', description: 'A change of role, employer or direction: when to prepare, when to act', suggested: true, subareas: ['job_change', 'abroad'] },
  { id: 'work_finding', board: 'work', group: 'money', title: 'Finding work', description: 'The search: when it opens, what to do meanwhile', suggested: false, subareas: ['get_job'] },
  { id: 'work_build', board: 'work', group: 'growth', title: 'What to build', description: 'The skill or standing to build in the easier months', suggested: true, subareas: [] },
  { id: 'work_venture', board: 'work', group: 'growth', title: 'Your own venture', description: 'Starting or steering a business', suggested: false, subareas: ['business'] },
];

export const AREA_MIN_CARDS = 1;
export const COMING_SOON = 'Coming soon';

export function boardCards(board: AreaBoardId): BoardCardDef[] {
  return BOARD_CARDS.filter((c) => c.board === board);
}

export function boardCardDef(board: AreaBoardId, id: string): BoardCardDef | null {
  return BOARD_CARDS.find((c) => c.board === board && c.id === id) ?? null;
}

export function isBoardCardOffered(c: BoardCardDef): boolean {
  return c.subareas.length > 0;
}

export function isAreaBoard(x: string): x is AreaBoardId {
  return (AREA_BOARDS as readonly string[]).includes(x);
}

export interface BoardCatalogueEntry {
  id: string;
  group: string;
  title: string;
  description: string;
  suggested: boolean;
  available: boolean;
  unavailableReason: string | null;
  subareas: string[];
}

export function catalogue(board: AreaBoardId): { groups: ReadonlyArray<{ id: string; title: string }>; cards: BoardCatalogueEntry[] } {
  return {
    groups: BOARD_GROUPS[board],
    cards: boardCards(board).map((c) => ({
      id: c.id,
      group: c.group,
      title: c.title,
      description: c.description,
      suggested: c.suggested && isBoardCardOffered(c),
      available: isBoardCardOffered(c),
      unavailableReason: isBoardCardOffered(c) ? null : COMING_SOON,
      subareas: [...c.subareas],
    })),
  };
}

export interface AreaLayoutView {
  board: AreaBoardId;
  cards: string[];
  options: BoardCardOptions;
  /** per chosen card: the options in force and the plain lines where one cannot be honoured yet */
  effective: Record<string, { options: CardOptions; notes: string[] }>;
  chosen: boolean;
  updatedAt: string | null;
}

export type AreaLayoutError = 'bad_body' | 'unknown_card' | 'card_not_offered' | 'duplicate_card' | 'too_few_cards' | 'unknown_option';

function view(board: AreaBoardId, row: { cards: unknown; options?: unknown; updated_at: Date } | null): AreaLayoutView {
  const cards = (row && Array.isArray(row.cards) ? row.cards : [])
    .map((c) => (typeof c === 'string' ? boardCardDef(board, c) : null))
    .filter((d): d is BoardCardDef => Boolean(d && isBoardCardOffered(d)))
    .map((d) => d.id)
    .filter((id, i, all) => all.indexOf(id) === i);
  const options = optionsFromRow(row?.options, cards);
  const effective: AreaLayoutView['effective'] = {};
  for (const id of cards) effective[id] = { options: effectiveOptions(options[id]), notes: areaOptionNotes(options[id]) };
  return { board, cards, options, effective, chosen: cards.length > 0, updatedAt: row ? row.updated_at.toISOString() : null };
}

export type AreaLayoutCheck = { ok: true; cards: string[]; options: BoardCardOptions | null } | { ok: false; error: AreaLayoutError; detail?: string };

export function validateAreaLayout(board: AreaBoardId, body: unknown): AreaLayoutCheck {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_body' };
  const b = body as { cards?: unknown; options?: unknown };
  if (!Array.isArray(b.cards)) return { ok: false, error: 'bad_body' };
  const cards: string[] = [];
  for (const c of b.cards) {
    if (typeof c !== 'string') return { ok: false, error: 'unknown_card' };
    const def = boardCardDef(board, c);
    if (!def) return { ok: false, error: 'unknown_card', detail: c };
    if (!isBoardCardOffered(def)) return { ok: false, error: 'card_not_offered', detail: c };
    if (cards.includes(c)) return { ok: false, error: 'duplicate_card', detail: c };
    cards.push(c);
  }
  if (cards.length < AREA_MIN_CARDS) return { ok: false, error: 'too_few_cards' };
  const opts = validateCardOptions(b.options, cards);
  if (!opts.ok) return { ok: false, error: opts.error, ...(opts.detail ? { detail: opts.detail } : {}) };
  return { ok: true, cards, options: b.options === undefined || b.options === null ? null : opts.options };
}

const SELECT = { cards: true, options: true, updated_at: true } as const;

export async function readAreaLayout(prisma: PrismaClient, kundliId: string, board: AreaBoardId): Promise<AreaLayoutView> {
  const row = await prisma.boardLayout.findUnique({ where: { kundli_id_board: { kundli_id: kundliId, board } }, select: SELECT });
  return view(board, row);
}

/** the template column is Self's; Love and Work store 'single' (one list) until doc 69 gives them templates */
export async function writeAreaLayout(prisma: PrismaClient, userId: string, kundliId: string, board: AreaBoardId, cards: string[], options: BoardCardOptions | null): Promise<AreaLayoutView> {
  const data = { cards, ...(options ? { options } : {}) };
  const row = await prisma.boardLayout.upsert({
    where: { kundli_id_board: { kundli_id: kundliId, board } },
    create: { user_id: userId, kundli_id: kundliId, board, template: 'single', sections: {}, options: options ?? {}, cards },
    update: data,
    select: SELECT,
  });
  return view(board, row);
}
