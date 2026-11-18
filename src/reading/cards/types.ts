/**
 * A reading per card (docs/reading-engine/70 §4.1 layers 4 and 5, §4.2). Types first: the per-card state the page polls,
 * the stored reading, and what one card run returns. Self first; Love and Work reuse these in Phase 4.
 */
import type { SelfV2AgentTiming, ValidationIssue } from '../self/v2types.js';
import type { BoardReadingStage, CardId, CardReadState, OracleCardV3, PersonalCardV3, SelfV3CardContent } from '../self/v3/types.js';

export const CARD_READING_TECHNIQUE = 'self.card.reading';
export const CARD_ORACLE_AGENT = 'self.card.oracle';
export const CARD_PERSONALIZER_AGENT = 'self.card.personalizer';
export const CARD_ORACLE_PROMPT = 'cards/oracle';
/** docs/dashboards/10 §7 S2: `cards/<board>/<id>` (Self unchanged: `cards/self/<id>`) */
export { cardBriefPrompt } from './registry.js';
/** the marker row (`area_builds`, area below, as_of today) holding every card's state and the day's spend */
export const CARDS_STATE_AREA = 'self.cards';
/** a card `queued` or `reading` longer than this is taken as dead (its build died): shown failed, Try again works */
export const CARD_STUCK_MS = 10 * 60_000;

export interface CardStateEntry {
  state: Exclude<CardReadState, 'ready' | 'not_read'> | 'done';
  /** ISO time the state was written */
  at: string;
  /** staff-only reason (never shown to the person) */
  error?: string | null;
}

/** the day's state of a kundli's card readings (one `area_builds` row per day) */
export interface CardsStateDoc {
  cards: Partial<Record<CardId, CardStateEntry>>;
  /** USD spent on card readings and the clock layer today */
  spentUsd: number;
  stage: BoardReadingStage;
  /** the clocks the ledger stands on, as the last build saw them (plain labels) */
  clocks: Array<{ system: string; label: string; state: 'read' | 'missing' | 'failed' }>;
  capReached: boolean;
  preparing: boolean;
  /** docs/dashboards/10 §4.1 step 2: the Love/Work boards opened today (their lens deck was queued once on open) */
  opened?: Partial<Record<'love' | 'work', true>>;
}

export const emptyCardsState = (): CardsStateDoc => ({ cards: {}, spentUsd: 0, stage: 'idle', clocks: [], capReached: false, preparing: false });

/** one stored card reading (`technique_outputs`, technique `self.card.reading`) */
export interface StoredCardReading {
  key: string;
  card: CardId;
  content: SelfV3CardContent;
  oracle: OracleCardV3;
  personal: PersonalCardV3;
  /** the ledger hash and the frame hash it stood on */
  ledgerHash: string;
  frameHash: string;
}

export interface CardRunResult {
  card: CardId;
  status: 'ok' | 'cached' | 'failed' | 'skipped_cap';
  content: SelfV3CardContent | null;
  /** the validated Oracle card the content stands on (for the replay's checks; null when none) */
  oracle?: OracleCardV3 | null;
  timings: SelfV2AgentTiming[];
  issues: ValidationIssue[];
  costUsd: number;
}
