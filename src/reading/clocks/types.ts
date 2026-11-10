/**
 * Types of the clock layer (docs/reading-engine/70 §4.1 layers 2 and 3): one reader per clock writes a sheet, code counts
 * the sheets, one concordance call writes the agreed ledger.
 */
import type { SpanTone } from '../self/v3/types.js';
import type { RenderedSlice } from '../slices/types.js';

export type ClockTone = SpanTone;
export type CellStrength = 1 | 2 | 3;

export const CLOCK_SHEET_TECHNIQUE = 'reading.clock.sheet';
export const CONCORDANCE_TECHNIQUE = 'reading.concordance';
export const CLOCK_AGENT = 'reading.clock';
export const CONCORDANCE_AGENT = 'reading.concordance';

export const READER_SYSTEM_PROMPT = 'common/reader-system';
export const CLOCK_READER_PROMPT = 'clock/reader';
export const CONCORDANCE_PROMPT = 'concordance';

/** one cell a clock reader wrote: one span, one matter its rows touch */
export interface ClockCell {
  span: string;
  /** an engine matter key, taken from a cited row's `matters` */
  matter: string;
  tone: ClockTone;
  /** at most 25 words */
  sentence: string;
  strength: CellStrength;
  evidence: string[];
}

export type ClockIssueCheck =
  | 'call_failed'
  | 'truncated'
  | 'json_schema'
  | 'budget'
  | 'timeout'
  | 'unknown_span'
  | 'unknown_evidence_key'
  | 'no_clock_row'
  | 'row_outside_span'
  | 'matter_not_in_rows'
  | 'tone_contradicts_polarity'
  | 'bad_strength'
  | 'bad_sentence'
  | 'duplicate_cell'
  | 'unknown_cell'
  | 'status_changed'
  | 'tone_changed'
  | 'missing_cell'
  | 'bad_sides';

/** staff-only: what a validator dropped and why (the v3 ValidationIssue shape, for the clock layer) */
export interface ClockIssue {
  stage: 'clock' | 'concordance';
  /** the clock, or null for the concordance */
  system: string | null;
  /** `<span>/<matter>` or null for the whole call */
  cell: string | null;
  check: ClockIssueCheck;
  message: string;
}

/** per agent call: wall time, tokens and cost (the v3 timing shape) */
export interface ClockAgentTiming {
  agent: typeof CLOCK_AGENT | typeof CONCORDANCE_AGENT;
  /** `clock.<system>` or `concordance` */
  call: string;
  status: 'ok' | 'cached' | 'failed' | 'skipped';
  ms: number;
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  costUsd: number;
}

export interface ClockSheet {
  system: string;
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  cells: ClockCell[];
  /** cells the validator dropped, with reasons */
  issues: ClockIssue[];
  model: string;
  /** hash of the clock slice the reader read */
  sliceHash: string;
  /** hash of the shared prefix (natal.core + sky.window + year.tp + frame) */
  prefixHash: string;
  /** hash of the cells, sorted: the concordance key carries it */
  hash: string;
}

/** the reader's slices, as the build hands them over */
export interface ClockLayerSlices {
  shared: { natal: RenderedSlice | null; sky: RenderedSlice; year: RenderedSlice; frame: RenderedSlice };
  /** one per clock, `clock.<system>`, the Tithi Pravesha year included */
  clocks: RenderedSlice[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Layer 3: count and ledger
// ---------------------------------------------------------------------------------------------------------------------

export type ConcordanceStatus = 'confirmed' | 'leaning' | 'single' | 'contested';

export interface CountedClock {
  system: string;
  tone: ClockTone;
  strength: CellStrength;
  sentence: string;
  evidence: string[];
}

export interface CountCell {
  /** `ledger:<spanId>/<matter>` */
  id: string;
  span: string;
  matter: string;
  status: ConcordanceStatus;
  /** the agreed tone for confirmed and leaning, the one clock's tone for a single read by one clock, else null */
  tone: ClockTone | null;
  tally: Record<ClockTone, number>;
  /** clocks giving the agreed tone (0 when there is none) */
  agree: number;
  /** clocks that read the cell */
  of: number;
  /** clocks that gave the opposite of the agreed tone (heavy against light) */
  opposed: number;
  /** in the order the sheets were given */
  clocks: CountedClock[];
}

export interface PairRow {
  a: string;
  b: string;
  /** cells both clocks read */
  both: number;
  /** cells where both gave the same tone */
  agree: number;
}

export interface ConcordanceCount {
  systems: string[];
  cells: CountCell[];
  pairs: PairRow[];
  byStatus: Record<ConcordanceStatus, number>;
}

export interface ContestSide {
  tone: ClockTone;
  clocks: string[];
  restsOn: string;
}

export interface LedgerCell {
  id: string;
  span: string;
  matter: string;
  /** always the count's; the agent cannot change it */
  status: ConcordanceStatus;
  tone: ClockTone | null;
  agree: number;
  of: number;
  clocks: Array<{ system: string; tone: ClockTone }>;
  /** the settled sentence (confirmed, leaning); null when not written or not valid */
  sentence: string | null;
  /** contested: which clocks stand on each side and what each rests on */
  sides: ContestSide[] | null;
  evidence: string[];
}

export interface AgreedLedger {
  frameHash: string;
  sheetHashes: Record<string, string>;
  cells: LedgerCell[];
  pairs: PairRow[];
  byStatus: Record<ConcordanceStatus, number>;
}
