import type { FormatId, Horizon, QuestionType, SubjectId } from './packs/frames.js';

export type SafetyFlag = 'ok' | 'medical' | 'legal' | 'self_harm' | 'minor';

/** Output of the intake node (docs/reading-engine/04-agent-graph.md §3). */
export interface Intent {
  subjects: Array<{ id: SubjectId; weight: number }>;
  horizon: Horizon;
  questionType: QuestionType;
  format: FormatId;
  focusPoints: string[];
  /** Canonical planet codes (Su Mo Ma Me Ju Ve Sa Ra Ke) the user named */
  mentionsPlanets: string[];
  confidence: number;
  clarifyText: string;
  followUps: string[];
  safety: SafetyFlag;
}

export interface Usage {
  node: string;
  model: string;
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  ms: number;
}

export interface ReadingEvent {
  type: 'intent' | 'stage' | 'token' | 'windows' | 'info';
  [k: string]: unknown;
}
export type ReadingEmitter = (event: ReadingEvent) => void;
