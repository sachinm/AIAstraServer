import type { FormatId, Horizon, QuestionType, SubjectId } from './packs/frames.js';
import type { ClassifierResult } from './buckets/classifier.js';

/** The bucket-first classification attached to every intent (src/reading/buckets). */
export type IntentClassification = Pick<ClassifierResult, 'bucket' | 'subBucket' | 'alsoBuckets' | 'confidence' | 'slots' | 'missing' | 'template' | 'policy' | 'unanswerable' | 'questionKind' | 'source' | 'ms'>;

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
  /** Bucket, slots found and missing, template and policy flags (set by intake) */
  classification?: IntentClassification;
  /** Other parts of the question, answered one after another once this one is done (focused readings only) */
  nextSubjects?: SubjectId[];
  /**
   * Where the person lives now (as typed, plus the browser's IANA timezone), from `user_current_location`. Only for
   * stating timing in local terms in the tail (`CURRENT LOCATION: <place> (<tz>)`, see currentLocationLine in
   * src/services/userLocation.ts); no astrological computation reads it.
   */
  currentLocation?: { place: string; tz: string | null };
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
  type: 'intent' | 'stage' | 'token' | 'windows' | 'info' | 'thought' | 'next';
  [k: string]: unknown;
}
export type ReadingEmitter = (event: ReadingEvent) => void;
