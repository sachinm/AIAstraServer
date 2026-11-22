/**
 * A chat on every card (docs/reading-engine/85). Types first: the card reference the web sends, the open (GET) body, the
 * errors, and the context the server keeps for a conversation (the card's stored text and the data it was written from).
 *
 * The web sends only `{board, cardId, from, to}` (the period on screen), a client `turnId` and the thread's `chatId`. The
 * server re-reads the stored card itself; nothing the client says about the card reaches the reader.
 */
import type { LedgerCell } from '../clocks/types.js';
import type { BoardId, OracleCardV3, PersonalCardV3, SelfV3CardContent } from '../self/v3/types.js';
import type { ProfilePack } from '../self/v2types.js';
import type { PersonForModel } from '../person/modelContext.js';

export type CardChatBoard = BoardId;
export const CARD_CHAT_BOARDS: readonly CardChatBoard[] = ['self', 'love', 'work'];
export const isCardChatBoard = (x: unknown): x is CardChatBoard => typeof x === 'string' && (CARD_CHAT_BOARDS as readonly string[]).includes(x);

/** the chat category a board's card threads are listed under (docs/reading-engine/51) */
export const CARD_CHAT_CATEGORY: Record<CardChatBoard, 'you' | 'love' | 'work'> = { self: 'you', love: 'love', work: 'work' };
export const CARD_CHAT_BOARD_TITLE: Record<CardChatBoard, string> = { self: 'You', love: 'Love', work: 'Work' };

/** what the web sends: the board, the card, and the period on screen (both dates or neither) */
export interface CardRef {
  board: CardChatBoard;
  id: string;
  from?: string | null;
  to?: string | null;
}

/** the agent and technique of a card-chat answer (registered in src/agents/registry.ts and src/techniques/catalog.ts) */
export const CARD_CHAT_AGENT = 'card.chat';
export const CARD_CHAT_TECHNIQUE = 'self.card.chat';
export const CARD_CHAT_PROMPT = 'cards/chat';
/** the preamble shown at the top of the chat, capped (doc 85 §4 step 1) */
export const CARD_CHAT_PREAMBLE_MAX_CHARS = 1_500;
/** the conversation carried into each answer: the last two exchanges, capped (doc 85 §4 step 3) */
export const CARD_CHAT_HISTORY_TURNS = 2;
export const CARD_CHAT_HISTORY_MAX_CHARS = 1_200;
/** messages the open returns */
export const CARD_CHAT_THREAD_MAX = 20;

export type CardChatError =
  | 'unknown_board'
  | 'unknown_card'
  | 'bad_period'
  | 'feature_off'
  | 'locked'
  | 'no_kundli'
  | 'board_off'
  | 'card_not_on_board'
  | 'card_not_ready';

export const CARD_CHAT_ERROR_STATUS: Record<CardChatError, 400 | 403 | 404 | 409> = {
  unknown_board: 400,
  unknown_card: 400,
  bad_period: 400,
  feature_off: 403,
  locked: 403,
  no_kundli: 404,
  board_off: 404,
  card_not_on_board: 404,
  card_not_ready: 409,
};

export interface CardChatPeriod {
  from: string;
  to: string;
  /** "Heavy stretch · 29 Mar 2025 – 3 Jun 2027" */
  label: string;
}

/** the card's own stored text for the period on screen, exactly as the page shows it (plain words, engine names redacted) */
export interface CardChatPreamble {
  headline: string;
  lines: string[];
  keyDates: Array<{ date: string; label: string }>;
  /** the card's "Is this right?" question, when it has one */
  confirm: string | null;
}

export interface CardChatThreadMessage {
  question: string;
  answer: string;
  at: string;
  periodLabel: string | null;
}

export interface CardChatThread {
  chatId: string | null;
  messages: CardChatThreadMessage[];
}

/** GET /api/cards/:board/:cardId/chat */
export interface CardChatOpenResponse {
  card: { board: CardChatBoard; id: string; title: string; subtitle: string };
  period: CardChatPeriod | null;
  preamble: CardChatPreamble;
  /** shown before every send (AGENTS.md assistant rule 7); `line` is null when nothing is counted */
  cost: { uses: 1; remaining: number | null; limit: number | null; line: string | null };
  thread: CardChatThread;
}

/** a card resolved through its board's read path (no side effects) */
export interface ResolvedCard {
  board: CardChatBoard;
  id: string;
  title: string;
  subtitle: string;
  kundliId: string;
  /** the board's clock: the stored card row is read on it */
  clock: string;
  period: CardChatPeriod | null;
  preamble: CardChatPreamble;
  /** the card as the page shows it (v3), or null for a card still filled from the v2 build */
  content: SelfV3CardContent | null;
  /** a v2-filled card's text (You board, Phase A) */
  v2: { headline: string; body: string[] } | null;
  /** the card's named periods and key dates as shown */
  periods: Array<{ label: string; from: string; to: string; headline: string; text: string[] }>;
  keyDates: Array<{ date: string; label: string }>;
  /** the other cards on the person's board (title and id), for pointers */
  boardCards: Array<{ id: string; title: string }>;
  matters: readonly string[];
}

/** the shared cached prefix the card was read on (natal.core, sky.window, year.tp, frame), rebuilt from the stored slices */
export interface CardChatPrefix {
  text: string;
  keys: readonly string[];
  hash: string;
  /** the dated block (TODAY and the frame), sent uncached before the suffix (docs/techniques/09 §8 step 4); '' when none */
  dated?: string;
  /** true when its hash is the `pre=` of the stored card's key (the same bytes the card's calls cached) */
  matchesCard: boolean;
}

/** what the conversation keeps in the backend: the card's text and the data it was prepared from */
export interface CardChatContext {
  card: ResolvedCard;
  /** the stored row: the Oracle card and the Personalizer card it was written from (null for a v2-filled card) */
  oracle: OracleCardV3 | null;
  personal: PersonalCardV3 | null;
  storeKey: string | null;
  /** the card's agreed ledger cells (its matters), and whether their grounding hash is the stored card's */
  cells: LedgerCell[];
  ledgerMatchesCard: boolean | null;
  /** the stored rows the card cites that are not already in the prefix (one line each) */
  evidenceRows: string[];
  prefix: CardChatPrefix | null;
  /** the brief of the card (prompts/cards/<board>/<id>.md) */
  brief: string;
  profile: ProfilePack | null;
  /**
   * docs/techniques/13 §2.4, READING_PERSON_GATE=1: the person from the gate (role `chat`); THE PERSON is these lines
   * only. Absent (the flag off): THE PERSON is today's block from `profile`.
   */
  person?: PersonForModel;
}

/** one earlier exchange carried into the answer */
export interface CardChatHistoryTurn {
  question: string;
  answer: string;
}
