/**
 * The You reading (docs/reading-engine/58 §4.2): the response contract shared with the web
 * (AIAstra_WEB/src/lib/selfReadingApi.ts). Each panel is one technique, `self.reading.<id>`.
 */

export type SelfPanelId = 'diagnosis' | 'chapters' | 'lagna' | 'mind' | 'body' | 'atma' | 'yogas' | 'struggle' | 'year';
/** display order (docs/reading-engine/61 §4): In short, chapters, who you are, mind, body, soul, gifts and knots, struggle, this year */
export const SELF_PANEL_IDS: readonly SelfPanelId[] = ['diagnosis', 'chapters', 'lagna', 'mind', 'body', 'atma', 'yogas', 'struggle', 'year'];

export type LovePanelId = 'diagnosis' | 'chapters' | 'heart' | 'partner' | 'bond' | 'circle' | 'struggle' | 'year';
/** display order (docs/reading-engine/59 §3): In short, chapters, how you love, the partner you draw, the bond itself, who else is in it, what tests it, this year */
export const LOVE_PANEL_IDS: readonly LovePanelId[] = ['diagnosis', 'chapters', 'heart', 'partner', 'bond', 'circle', 'struggle', 'year'];

export type WorkPanelId = 'diagnosis' | 'chapters' | 'vocation' | 'standing' | 'ground' | 'gain' | 'struggle' | 'year';
/** display order (docs/reading-engine/59 §4): In short, chapters, what you are built to do, how you are seen, where the work is now, what it pays, what tests it, this year */
export const WORK_PANEL_IDS: readonly WorkPanelId[] = ['diagnosis', 'chapters', 'vocation', 'standing', 'ground', 'gain', 'struggle', 'year'];

export type BoardPanelId = SelfPanelId | LovePanelId | WorkPanelId;
export type ReadingBoardId = 'self' | 'love' | 'work';

/** docs/reading-engine/62: a card line's validity range and certainty */
export type LineRange = { from: string; to: string } | 'always';
export type LineCertainty = 'fact' | 'strong' | 'moderate' | 'possible';
export interface SelfLine {
  id: string;
  /** at most 22 words, plain */
  text: string;
  range: LineRange;
  claimIds: string[];
  certainty: LineCertainty;
  detail: string;
}
export interface PurviewEntry {
  rule: string;
  source: string;
  action: 'override' | 'veto' | 'annotate';
  affects: string[];
  rows: string[];
  text: string;
}
export interface AuditFailure {
  lineId: string;
  check: string;
  text: string;
}
export interface CodeAudit {
  verdict: 'pass' | 'fail';
  checked: number;
  failures: AuditFailure[];
  /** BG-14: dates outside every stored engine window; the line is kept and the date is surfaced here */
  dateGaps?: AuditFailure[];
}
export type Certainty = 'fact' | 'confirmed' | 'likely' | 'split';
export type ConfirmAnswer = 'yes' | 'partly' | 'no' | 'skip';

export interface SelfClaim {
  /** stable per kundli: '<panel>.<rule>' */
  id: string;
  /** plain words, no chart terms */
  text: string;
  /** chart terms, shown under "Chart details" */
  detail: string;
  certainty: Certainty;
  /** digest keys and activation rows, e.g. 'planet:D1.Ju', 'activation:dwisatpathi/1/Ra' */
  evidence: string[];
  /** set at read time when the person said it did not fit */
  withheld?: string;
  /** a card line of at most 22 words, when `text` is longer (docs/reading-engine/61 §1) */
  line?: string;
  /** the range this claim is true for; 'always' for natal facts (default) */
  range?: LineRange;
}

export interface SelfSubChapter {
  lord: string;
  lordLabel: string;
  from: string;
  to: string;
  text: string;
  detail: string;
  houses: number[];
}

export interface ChapterConfirmation {
  system: string;
  label: string;
  agrees: boolean;
  /** the confirming clock's own nearest main-period start, YYYY-MM-DD */
  boundary: string | null;
}

export interface SelfChapter {
  kind: 'previous' | 'running' | 'next';
  lord: string;
  lordLabel: string;
  from: string;
  to: string;
  /** null when no other clock marks the turn (split) */
  text: string | null;
  detail: string;
  certainty: 'confirmed' | 'likely' | 'split';
  houses: number[];
  sub?: SelfSubChapter;
  nextSub?: { lord: string; lordLabel: string; from: string; to: string; houses: number[] };
  confirmations: ChapterConfirmation[];
  evidence: string[];
}

export interface SelfPanel {
  id: BoardPanelId;
  technique: string;
  title: string;
  lead: string;
  status: 'ok' | 'partial' | 'withheld' | 'failed';
  claims: SelfClaim[];
  chapters?: SelfChapter[];
  cached: boolean;
  ms: number;
  /** docs/reading-engine/62: the card */
  headerRange: LineRange;
  lines: SelfLine[];
  note?: string;
  vetoed?: Array<{ claimId: string; rule: string; text: string }>;
  /** AI/deterministic validity horizon ('YYYY-MM-DD' or 'always') until which this panel reading remains true */
  validUntil?: string;
  /** BUILD-GAPS BG-14: the Oracle's plan for this panel (summary, dated steps, a calendar of prospective dates from stored windows) */
  plan?: PanelPlan;
  /** the Oracle's prose for this panel: the section of its reading whose heading names the panel (doc 64 §4) */
  synthesis?: string;
}

/** One dated step of a panel plan. */
export interface PanelPlanStep {
  text: string;
  range: LineRange;
  claimIds: string[];
}
/** One prospective date or window on a panel calendar; `inWindow` is false when no stored engine window holds it (shown as a gap, not dropped). */
export interface PanelCalendarEntry {
  from: string;
  to: string;
  label: string;
  claimIds: string[];
  inWindow?: boolean;
}
/** BG-14: what the Oracle synthesizes per panel beside its card lines, so the person gets a plan they can act on. */
export interface PanelPlan {
  summary: string;
  steps: PanelPlanStep[];
  calendar: PanelCalendarEntry[];
}

export interface SelfClockChoice {
  system: string;
  label: string;
}

export interface SelfClock {
  system: string;
  label: string;
  reason: 'preferred' | 'applicable' | 'default';
  confirming: SelfClockChoice[];
  choices: SelfClockChoice[];
}

export interface SelfQuestion {
  claimId: string;
  panel: BoardPanelId;
  text: string;
  options: Array<{ value: ConfirmAnswer; label: string }>;
}

export interface SelfOracleStageSummary {
  agentId: string;
  status?: 'ok' | 'cached' | 'failed' | 'skipped';
  cached: boolean;
  ms?: number;
  inputTokens?: number;
  promptTokens?: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens?: number;
  costUsd: number;
  summary?: string;
  digest?: string;
}

export interface SelfOracleLinemanRecord {
  agent: string;
  promptName: string;
  promptVersion: string | null;
  sliceKeys: string[];
  claims: Array<{ id: string; text: string; rows: string[]; certainty: LineCertainty }>;
  dropped: Array<{ claim: string; why: string }>;
  tokens: { prompt: number; cached: number; output: number; thought: number };
  ms: number;
  cache: 'hit' | 'run';
  cached?: boolean;
}

export interface SelfOraclePayload {
  /** `pending`: no stored synthesis covers today and the caller asked for the store only (the build runs in the background) */
  status: 'off' | 'ok' | 'failed' | 'budget_exceeded' | 'pending';
  /** `failed`: the stage error (a Gemini time-out, a quota refusal), for the admin; never shown to the person */
  error?: string;
  text?: string;
  output?: string;
  brief?: string;
  promptName?: string;
  promptVersion?: string;
  model?: string;
  validator?: { verdict: 'ok' | 'rejected'; issues: string[] };
  tokens?: { prompt: number; cached: number; output: number; thought: number };
  ms?: number;
  linemen?: SelfOracleLinemanRecord[];
  linemanFindings?: string;
  linemanBrief?: string;
  familyFindings?: Record<string, string>;
  panelLines?: Partial<Record<BoardPanelId, Array<{ text: string; claimIds: string[]; range?: LineRange; certainty?: LineCertainty; detail?: string }>>>;
  /** BG-14: the Oracle's PANEL_PLAN and PANEL_CALENDAR blocks, per panel */
  panelPlans?: Partial<Record<BoardPanelId, PanelPlan>>;
  /** docs/reading-engine/65: the dashboard as the Oracle returned it, one validated area per panel (SELF_ORACLE_AREAS=1) */
  areas?: import('./areaDoc.js').OracleAreaDoc;
  /** staff only: what the area validator dropped or withheld */
  areaGaps?: string[];
  /** whether each stage found its prompt prefix in the Gemini cache: stage agent id → cached tokens */
  cacheWarm?: Record<string, number>;
  /** AI-determined validity horizon ('YYYY-MM-DD' or 'always') per panel and overall ('overall') */
  validUntil?: Partial<Record<BoardPanelId | 'overall', string>>;
  stages?: SelfOracleStageSummary[];
  dropped?: number;
  calls?: number;
  modelCalls?: number;
  spentUsd?: number;
  costUsd?: number;
  maxSpendUsd?: number;
  capUsd?: number;
  spentTodayUsd?: number;
  cached?: boolean;
}

export interface SelfReading {
  asOf: string;
  digestVersion: string;
  clock: SelfClock;
  panels: SelfPanel[];
  question: SelfQuestion | null;
  /** staff only: fields a panel needed and did not find */
  gaps: string[];
  purview: PurviewEntry[];
  audit: CodeAudit;
  dossierId: string | null;
  builtLine: string;
  validUntil?: string | null;
  oracle?: SelfOraclePayload;
}

/** What a panel function returns before the service adds cache state and timing. */
export interface PanelBody {
  lead: string;
  claims: SelfClaim[];
  chapters?: SelfChapter[];
  gaps: string[];
}
