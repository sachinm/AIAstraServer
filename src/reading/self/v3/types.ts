/**
 * Self board v3 contracts (docs/reading-engine/68 §4). Types first: the card registry, the layout, the year frame, the
 * span-led card and the GET /api/self/v3 body. The web mirrors the API types exactly (AIAstra_WEB src/lib/selfV3Api.ts).
 *
 * Phase A (doc 68 §8): the person chooses cards and a template; the cards are filled from the stored v2 build, the
 * period rail from each v2 card's stored dates. Phase B: the year frame, the v3 Oracle and Personalizer, span-led cards.
 *
 * Nothing here is astrological arithmetic. Every boundary, tone and evidence key is a stored engine value carried by id.
 */
import type { AreaCertainty } from '../areaDoc.js';
import type {
  CardStatus,
  EvidenceKey,
  IsoDate,
  LadderSteps,
  PersonalCard,
  PersonalPattern,
  SelfV2AreaId,
  SelfV2ClockView,
  SelfV2Quality,
  SelfV2RefreshView,
  SelfV2Response,
  Strength,
} from '../v2types.js';
import type { SelfV2BuildView } from '../v2/progress.js';

// ---------------------------------------------------------------------------------------------------------------------
// The card registry (doc 68 §4.3)
// ---------------------------------------------------------------------------------------------------------------------

/** Phase A and B: the eleven v2 areas (the `now` hero is not a card; the top strip is gone) */
export type SelfCardIdV2 = Exclude<SelfV2AreaId, 'now'>;
/** Phase C adds the ten cards that need no engine work; Phase D the Indian-lens cards (ids reserved, not offered yet) */
export type SelfCardIdLater =
  | 'fitness'
  | 'sleep'
  | 'blood'
  | 'sharpness'
  | 'mood'
  | 'restores'
  | 'play'
  | 'purpose'
  | 'learning'
  | 'layers'
  | 'constitution'
  | 'aims'
  | 'practice'
  | 'saturn'
  | 'helps';
export type SelfCardId = SelfCardIdV2 | SelfCardIdLater;

export type SelfCardGroup = 'body' | 'mind' | 'character' | 'indian' | 'time';

export const SELF_CARD_GROUPS: ReadonlyArray<{ id: SelfCardGroup; title: string }> = [
  { id: 'body', title: 'Body' },
  { id: 'mind', title: 'Mind' },
  { id: 'character', title: 'Character' },
  { id: 'indian', title: 'Indian lens' },
  { id: 'time', title: 'Time' },
];

/** the seven sections a card can show (doc 68 §4.4) */
export type SelfSectionId = 'line' | 'year' | 'stretch' | 'confirm' | 'pattern' | 'ladder' | 'details';
export const SELF_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder', 'details'];
/** "In a line" and "Your year" cannot be switched off: a card without dates is not a card on this board */
export const FIXED_SECTIONS: readonly SelfSectionId[] = ['line', 'year'];
export const DEFAULT_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm'];

export interface SelfCardDef {
  id: SelfCardId;
  group: SelfCardGroup;
  title: string;
  /** one line for the picker tile, plain words */
  description: string;
  /** the v2 area whose stored card fills this card in Phase A; null for a card v2 never read */
  v2Area: SelfCardIdV2 | null;
  /** marked "Suggested for you" when nothing in the chart or the profile says otherwise (never ticked for the person) */
  suggested: boolean;
  /** body, sleep, mood, blood: carries "From your chart. Not medical advice." */
  sensitive: boolean;
  /** the engine rows the card stands on; a card whose rows are missing is offered as unavailable with the reason */
  needs: readonly string[];
  /** offered in the catalogue now; false for ids reserved for later phases */
  offered: boolean;
  /**
   * Phase C (doc 68 §8, doc 70 §7 step 6): the card needs only its brief, so it is offered whenever the per-card reading
   * is on (`isCardsReadEnabled`), and stays reserved otherwise
   */
  briefOnly?: boolean;
  /**
   * the engine's matter keys this card reads (its ledger cells and `matter.<key>` slices; doc 70 §4.1 "Which matters a
   * card reads is a list in the card registry"). A words table chosen by the product, never computed.
   */
  matters: readonly CardMatter[];
  defaultSections: readonly SelfSectionId[];
}

/** the engine's twelve matter keys (the `matters` field of a pressure row) */
export type CardMatter =
  | 'self_and_body'
  | 'money_in_hand'
  | 'effort_and_courage'
  | 'home_and_peace'
  | 'ideas_and_children'
  | 'work_load_and_health'
  | 'partnership'
  | 'sudden_and_hidden'
  | 'luck_and_belief'
  | 'career_and_standing'
  | 'gains_and_network'
  | 'loss_rest_and_distance';

// ---------------------------------------------------------------------------------------------------------------------
// Layout (doc 68 §4.5 item 8; doc 69 §4.1 item 6: one table for self, love and work)
// ---------------------------------------------------------------------------------------------------------------------

/** 1 Compact (today's), 2 Seasons (default), 3 One at a time, 4 Year table (doc 68 §4.2) */
export type SelfTemplateId = 'compact' | 'seasons' | 'single' | 'table';
export const SELF_TEMPLATES: readonly SelfTemplateId[] = ['compact', 'seasons', 'single', 'table'];
/** the templates the page offers today; the others are refused by PUT until they ship */
export const SELF_TEMPLATES_LIVE: readonly SelfTemplateId[] = ['compact', 'seasons'];
export const DEFAULT_TEMPLATE: SelfTemplateId = 'seasons';
/** "Done" needs at least three cards (Oura's floor, doc 68 §4.1 item 4) */
export const MIN_CARDS = 3;
export const SUGGESTED_COUNT = 8;

export type BoardId = 'self' | 'love' | 'work';

export interface SelfBoardLayout {
  template: SelfTemplateId;
  /** the person's cards, in their order */
  cards: SelfCardId[];
  /** per card, the sections switched on, when the person changed them; absent: the card's defaults */
  sections: Partial<Record<SelfCardId, SelfSectionId[]>>;
}

export interface SelfBoardLayoutView extends SelfBoardLayout {
  /** false until the person has pressed Done once: the page opens the picker */
  chosen: boolean;
  updatedAt: string | null;
}

/** PUT /api/self/v3/layout errors */
export type LayoutError = 'unknown_template' | 'template_not_live' | 'unknown_card' | 'card_not_offered' | 'duplicate_card' | 'too_few_cards' | 'unknown_section' | 'fixed_section_off' | 'bad_body';

// ---------------------------------------------------------------------------------------------------------------------
// Phase B: the year frame (doc 68 §4.5 items 2–3). Built in code from stored rows only.
// ---------------------------------------------------------------------------------------------------------------------

/** the engine's word for a span on one clock; Node only copies it */
export type SpanTone = 'heavy' | 'mixed' | 'light';

/** where a span sits in the year, for the rail's grouping ("now", "next", "later this year") */
export type SpanPlace = 'now' | 'next' | 'later';

export interface SpanClockTone {
  system: string;
  /** the tone word after the heavy-tone stopgap (`sub/rowTone.ts`) */
  tone: SpanTone;
  /** the stored row the tone was read from */
  evidence: EvidenceKey;
  /** provenance: the engine's own polarity of that row, and how many bad flags its stored `reasons` carry */
  polarity?: 'presses' | 'mixed' | 'supports';
  flags?: number;
}

export interface YearSpan {
  /** 's1' … 's6', in date order */
  id: string;
  from: IsoDate;
  to: IsoDate;
  place: SpanPlace;
  /**
   * the span's tone: the tone at least READING_CLOCKS_MIN clocks hold for it (`held`); when no tone is held by that
   * many clocks the span is not given a tone of its own: `mixed`, with `held` false (the page shows no tone word)
   */
  tone: SpanTone;
  /** true when READING_CLOCKS_MIN or more clocks hold `tone` for the span */
  held: boolean;
  /** the reading clock's own tone for the span (provenance) */
  spineTone: SpanTone;
  /** per clock that covers the span, its stored tone (reading clock, Vimshottari, Narayana, the TP year, applicable conditionals) */
  clocks: SpanClockTone[];
  /** how many clocks hold the span's tone (unheld: the largest tally), and how many were read */
  agree: number;
  of: number;
  /** what starts the span: the stored boundary row (a period start, the TP year start, a window edge) */
  opensWith: EvidenceKey;
  /** the pressure and support rows overlapping the span, by id, strongest first */
  rows: Array<{ id: EvidenceKey; polarity: 'presses' | 'mixed' | 'supports'; tone?: SpanTone; flags?: number; strength: Strength; matters: string[] }>;
}

export interface YearFrameV3 {
  asOf: IsoDate;
  to: IsoDate;
  clock: string;
  spans: YearSpan[];
  /** Saturn's passage rows over the Moon as the engine stored them (kind sade_sati), with its house from the Moon */
  saturn: Array<{ from: IsoDate; to: IsoDate; houseFromMoon: number | null; evidence: EvidenceKey }>;
  /** every Tithi Pravesha year (the engine's level-1 annual rows) the spans touch, in date order */
  years?: Array<{ key: EvidenceKey; label: string; from: IsoDate; to: IsoDate }>;
  /** the clocks read for agreement, and the ones skipped with the reason */
  clocksRead: string[];
  clocksSkipped: Array<{ system: string; reason: string }>;
  /** true when the frame had to fall back to the reading clock alone */
  degraded: boolean;
  /**
   * Other spellings of the frame's row keys a model may cite (the row's own id without `pressure:`, the engine's
   * evidence keys of the row), each mapped to the frame key. Replay 2026-11-09: the Oracle cited
   * `activation:dwisatpathi/3/Mo@2027-06-04` for `pressure:dasha:dwisatpathi/3/Mo@2027-06-04`.
   */
  aliases?: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Phase B: the v3 Oracle and Personalizer outputs (doc 68 §4.5 items 4–6, §4.8)
// ---------------------------------------------------------------------------------------------------------------------

export type SpanMode = 'get_through' | 'build';

export interface OracleSpanV3 {
  span: string;
  tone: SpanTone;
  mode: SpanMode;
  /** what this stretch asks of the person, in chart terms (Chart details only) */
  asks: string;
  obstacle: string;
  evidence: EvidenceKey[];
  /** which clocks agree, in words, from the frame's rows */
  agreement: string;
}

export interface OracleCardV3 {
  card: SelfCardId;
  headline: string;
  spans: OracleSpanV3[];
  /** one dated statement about a past span the person can answer No to */
  confirm: { claimId: string; text: string; from: IsoDate; to: IsoDate } | null;
  gift: string;
  knot: string;
  pattern: { text: string; since: IsoDate | null; until: IsoDate | null; evidence: EvidenceKey[] } | null;
  certainty: AreaCertainty;
  evidence: EvidenceKey[];
}

export interface OracleV3Output {
  cards: Partial<Record<SelfCardId, OracleCardV3>>;
}

/** what the v3 Personalizer returns per card (it never sees the chart; spans, tones and modes are the Oracle's) */
export interface PersonalCardV3 {
  card: SelfCardId;
  /** ≤ 20 words, one sentence with a date copied from a span */
  line: string;
  spans: Array<{ span: string; asks: string; obstacle: string; step: string }>;
  /** the Oracle's confirm statement as a plain yes/no question; null when the Oracle gave none */
  confirm: string | null;
  /** only when the person switched the section on, else null */
  pattern: string | null;
  ladder: LadderSteps | null;
}

export interface PersonalizerV3Output {
  cards: Partial<Record<SelfCardId, PersonalCardV3>>;
}

/** what the person reads for one span (doc 68 §4.8 Personalizer table) */
export interface SpanReading {
  span: string;
  from: IsoDate;
  to: IsoDate;
  tone: SpanTone;
  mode: SpanMode;
  /** at most 30 words */
  asks: string;
  /** at most 20 words */
  obstacle: string;
  /** one if-then sentence */
  step: string;
  /** false when fewer than READING_CLOCKS_MIN clocks hold the frame span's tone: the page shows no tone word */
  held?: boolean;
  /** doc 70 §4.2: how many clocks hold the span's tone, of how many read ("4 of 5 clocks agree") */
  agreement?: { agree: number; of: number } | null;
  /** doc 70 §4.3 item 6, Chart details: each clock read for this span, its tone, and whether it holds the span's tone */
  clocks?: SpanClockView[];
}

/** one clock's word for a span, as Chart details lists it (labels are plain names, never an engine's) */
export interface SpanClockView {
  system: string;
  label: string;
  tone: SpanTone;
  agrees: boolean;
}

export interface SelfV3CardContent {
  /** "In a line": one sentence with a date */
  line: string;
  spans: SpanReading[];
  /** "Is this right?" */
  confirm: { claimId: string; text: string } | null;
  /** "Your pattern" (off by default) */
  pattern: PersonalPattern | null;
  /** "The ladder" (off by default) */
  ladder: LadderSteps | null;
  /** "Checked on 3 of 4 clocks" */
  agreement: { agree: number; of: number } | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/self/v3 (doc 68 §4.6). The web mirrors this type exactly.
// ---------------------------------------------------------------------------------------------------------------------

/** one bar of the period rail */
export interface RailItem {
  from: IsoDate;
  to: IsoDate;
  /** "now → 5 Dec 2026" style label in calendar words */
  label: string;
  /** the tone word shown beside the bar; null in Phase A (v2 dates carry no tone) */
  tone: SpanTone | null;
  /** the Oracle's own label for the date, when the rail comes from v2 dates */
  note: string | null;
  current: boolean;
  /** the SpanReading.span this bar opens, when the card is v3 */
  span: string | null;
}

export interface SelfV3CardView {
  id: SelfCardId;
  group: SelfCardGroup;
  title: string;
  description: string;
  suggested: boolean;
  sensitive: boolean;
  /** false: shown greyed in the picker with `unavailableReason` */
  available: boolean;
  unavailableReason: string | null;
  status: CardStatus;
  /** doc 70 §4.2: the card's own reading state (always `ready` or `not_read` while the per-card reading is off) */
  state: CardReadState;
  /** the card's real first line for this person, for the picker tile; null until read */
  firstLine: string | null;
  defaultSections: SelfSectionId[];
  rail: RailItem[];
  /** Phase B content; null while the card is filled from the v2 build */
  v3: SelfV3CardContent | null;
  /** Phase A content: the stored v2 card and its Chart details (engine names redacted) */
  v2: {
    card: PersonalCard | null;
    rangeLabel: string;
    details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: string };
  } | null;
}

export interface SelfV3Response {
  status: SelfV2Response['status'];
  builtAt: string | null;
  /** which build filled the cards */
  readVersion: 'v2' | 'v3' | null;
  clock: SelfV2ClockView;
  profile: SelfV2Response['profile'];
  refresh: SelfV2RefreshView;
  build: SelfV2BuildView;
  quality: SelfV2Quality | null;
  layout: SelfBoardLayoutView;
  /** every catalogue card in registry order, offered or not; the page shows `layout.cards` on the board */
  cards: SelfV3CardView[];
  /** doc 70 §4.2: the board's reading progress; null when nothing is known yet */
  reading: BoardReadingView | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Doc 70 Phase 3: a reading per card (§4.1 layers 4–5, §4.2, §4.4)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One card's reading state. `ready`: a stored reading is served; `reading`: its calls are running; `queued`: waiting
 * for its turn; `failed`: its last attempt did not come through (Try again); `not_read`: not read yet (the person has
 * not chosen it, the rest is off, or the spend cap stopped the queue).
 */
export type CardReadState = 'ready' | 'reading' | 'queued' | 'failed' | 'not_read';
export const CARD_READ_STATES: readonly CardReadState[] = ['ready', 'reading', 'queued', 'failed', 'not_read'];

/** where the board's reading is: reading the clocks, checking agreement, writing cards, done; idle when nothing runs */
export type BoardReadingStage = 'idle' | 'clocks' | 'ledger' | 'cards' | 'done';

export interface BoardReadingView {
  /** false when the per-card reading is off on this server (the board is filled the Phase B way) */
  enabled: boolean;
  stage: BoardReadingStage;
  /** the clocks the ledger stands on, plain labels; `missing`: not stored yet; `failed`: its reader did not come through */
  clocks: Array<{ system: string; label: string; state: 'read' | 'missing' | 'failed' }>;
  /** board cards ready, of board cards */
  done: number;
  total: number;
  /** the day's spend cap stopped the queue: the rest stays "Not read yet" */
  capReached: boolean;
  /** fewer clocks stored than READING_CLOCKS_MIN: "Your chart is still being prepared" */
  preparing: boolean;
}

/** POST /api/self/v3/cards/:id/read */
export type CardReadError = 'unknown_card' | 'card_not_offered' | 'already_reading' | 'spend_cap' | 'off' | 'no_kundli';

/** GET /api/self/v3/catalogue: the picker without card bodies */
export interface SelfV3CatalogueEntry {
  id: SelfCardId;
  group: SelfCardGroup;
  title: string;
  description: string;
  suggested: boolean;
  available: boolean;
  unavailableReason: string | null;
  firstLine: string | null;
  state: CardReadState;
}
