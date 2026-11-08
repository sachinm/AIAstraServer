/**
 * The You reading (docs/reading-engine/58 §4.2): the response contract shared with the web
 * (AIAstra_WEB/src/lib/selfReadingApi.ts). Each panel is one technique, `self.reading.<id>`.
 */

export type SelfPanelId = 'diagnosis' | 'chapters' | 'lagna' | 'mind' | 'atma' | 'yogas' | 'struggle' | 'year';
/** display order (docs/reading-engine/59 §1): diagnosis, the chapters spine, the parts, struggle, this year */
export const SELF_PANEL_IDS: readonly SelfPanelId[] = ['diagnosis', 'chapters', 'lagna', 'mind', 'atma', 'yogas', 'struggle', 'year'];
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
  id: SelfPanelId;
  technique: string;
  title: string;
  lead: string;
  status: 'ok' | 'partial' | 'withheld' | 'failed';
  claims: SelfClaim[];
  chapters?: SelfChapter[];
  cached: boolean;
  ms: number;
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
  panel: SelfPanelId;
  text: string;
  options: Array<{ value: ConfirmAnswer; label: string }>;
}

export interface SelfReading {
  asOf: string;
  digestVersion: string;
  clock: SelfClock;
  panels: SelfPanel[];
  question: SelfQuestion | null;
  /** staff only: fields a panel needed and did not find */
  gaps: string[];
}

/** What a panel function returns before the service adds cache state and timing. */
export interface PanelBody {
  lead: string;
  claims: SelfClaim[];
  chapters?: SelfChapter[];
  gaps: string[];
}
