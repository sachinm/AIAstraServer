/**
 * The one status of a chart from registration to ready (docs/techniques/11 rev 4 §4.2, §4.8). Shared with the web: the
 * names below are fixed (the web builds against them).
 */
export type PipelineStage = 'registered' | 'pulling' | 'checking' | 'chart_ready' | 'preparing' | 'ready' | 'blocked' | 'paused';

export interface PipelineView {
  stage: PipelineStage;
  /** steps or jobs finished */
  done: number;
  total: number;
  /** one plain sentence for the person; no engine name, no raw error */
  line: string;
  /** true = no reading may be started for this chart */
  locked: boolean;
  /** why it is locked */
  reason: 'chart' | 'building' | 'preparing' | null;
}

/** The refusal body of a gated call: HTTP 409. */
export interface PreparingRefusal {
  error: string;
  code: 'preparing';
  pipeline: PipelineView;
}

export const PIPELINE_STAGES: readonly PipelineStage[] = ['registered', 'pulling', 'checking', 'chart_ready', 'preparing', 'ready', 'blocked', 'paused'];

/** The person-facing line of each stage (doc 11 §4.8 web copy). Plain words, no engine name, no error text. */
export const STAGE_LINES: Record<PipelineStage, string> = {
  registered: 'Getting your chart',
  pulling: 'Getting your chart',
  checking: 'Checking everything arrived',
  chart_ready: 'Reading your chart',
  preparing: 'Reading your chart',
  paused: 'Reading your chart',
  ready: 'Your chart is ready. Choose your cards.',
  blocked: 'Some of the calculations did not finish. We are trying again.',
};

export const PREPARING_ERROR = 'Building your chart data';

export function preparingRefusal(pipeline: PipelineView): PreparingRefusal {
  return { error: PREPARING_ERROR, code: 'preparing', pipeline };
}
