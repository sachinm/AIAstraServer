/**
 * Deterministic Post-Reading Clarify Monitor (`reading.clarify_monitor`, docs/admin/06).
 *
 * Evaluates Stage-1 counterfactuals in pure TypeScript (zero LLM tokens / $0.00 cost) after a reading completes:
 *   1. Did Clarify skip criteria that were already known in `person_facts` or stated in the question (`extraAskTriggered`)?
 *   2. Did defaulting an unasked slot (`horizon`, `sub_bucket`, `subject_person`, `sibling`, `location`) coincide with
 *      downstream specialist disagreement (`agreement.level === 'split'`) or dropped validator claims (`wouldAskingHaveHelped`)?
 *   3. Did every clarified slot (`subject_person`, `sibling`, `location`, `horizon`, `sub_bucket`) hand off cleanly into
 *      `record.intent` and the downstream reader slice (`contextHandoffOk`)?
 *   4. Did the question phrasing stay concise (<= 24 words) and free of internal engine/chart jargon (`phrasingScore`)?
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { BUCKETS } from '../buckets/taxonomy.js';
import { currentTrace } from '../metrics/trace.js';
import { siblingFocusPoint } from '../nodes/intake.js';
import type { Intent } from '../types.js';
import type { ClarifyState } from './machine.js';

export interface ClarifyMonitorRecordInput {
  runId: string;
  kundliId?: string | null;
  intent: Intent;
  findings?: unknown;
  agreement?: unknown;
  droppedClaims?: number;
}

export type MissedCriterion = 'horizon' | 'sub_bucket' | 'subject_person' | 'sibling' | 'location' | 'none';

export interface ClarifyMonitorVerdict {
  runId: string;
  clarifyRunId: string | null;
  bucket: string;
  driver: 'ai' | 'machine_fallback' | 'rules';
  turnsCount: number;
  assumedCount: number;
  missedCriterion: MissedCriterion;
  wouldAskingHaveHelped: 0 | 1;
  extraAskTriggered: 0 | 1;
  contextHandoffOk: 0 | 1;
  askRightScore: number;
  phrasingScore: number;
  handoffScore: number;
  overallScore: number;
  targetAgentId: string;
  diagnosisCode: string;
  // Cross-repo Admin contract fields (reading_traces.clarify_monitor, 0..5 rubric + snake_case)
  overall_score: number;
  ask_right_score: number;
  phrasing_score: number;
  handoff_score: number;
  would_asking_have_helped: boolean;
  extra_ask_triggered: boolean;
  context_handoff_ok: boolean;
  turn_count: number;
  planner_source: 'ai' | 'machine_fallback' | 'rules';
  reason_code: string;
  subject_person: string | null;
  flags: string[];
}

const BUCKET_TARGET_AGENT: Record<string, string> = {
  career_job: 'reading.specialist.career_work',
  money_wealth: 'reading.specialist.wealth_property',
  love_relationships: 'reading.specialist.marriage_partnership',
  marriage: 'reading.specialist.marriage_partnership',
  family_children: 'reading.specialist.children_progeny',
  property_home_relocation: 'reading.specialist.wealth_property',
  education_exams: 'reading.specialist.education_knowledge',
  health_windows: 'reading.specialist.health_longevity',
  spiritual_purpose: 'reading.specialist.spiritual_moksha',
  time_window_outlook: 'reading.oracle.R6',
  chart_explanation: 'reading.oracle.R1',
  explain_term: 'reading.oracle.synthesis',
  unknown: 'reading.oracle.synthesis',
};

export function evaluateClarifyMonitor(
  state: ClarifyState | null | undefined,
  record: ClarifyMonitorRecordInput,
  facts: Record<string, string> = {},
): ClarifyMonitorVerdict {
  const bucket = state?.bucket ?? record.intent.classification?.bucket ?? 'unknown';
  const driver: ClarifyMonitorVerdict['driver'] = state?.driver ?? 'rules';
  const turns = state?.turns ?? [];
  const assumed = state?.assumed ?? {};
  const turnsCount = turns.length;
  const assumedKeys = Object.keys(assumed);
  const assumedCount = assumedKeys.length;
  const clarifyRunId = record.intent.clarified?.runId ?? null;

  // 1. Check whether Clarify re-asked something already known in person_facts or profile location
  let extraAskTriggered: 0 | 1 = 0;
  for (const turn of turns) {
    const c = turn.ask.criterion;
    if (c === 'background' && facts['work.status']) extraAskTriggered = 1;
    if (c === 'location' && state?.location && !state?.locationAnswered) extraAskTriggered = 1;
  }

  // 2. Check whether every clarified slot handed off cleanly into `record.intent`
  let handoffFailures = 0;
  let handoffTargetAgent = BUCKET_TARGET_AGENT[bucket] ?? 'reading.oracle.synthesis';

  if (state) {
    const statePerson = state.slots.subject_person?.value;
    const intentPerson = record.intent.classification?.slots?.subject_person?.value;
    if (statePerson && statePerson !== 'me' && intentPerson !== statePerson) {
      handoffFailures += 1;
      handoffTargetAgent = 'reading.oracle.R13';
    }
    if (state.sibling) {
      const expectedFocus = siblingFocusPoint(state.sibling.rank, state.sibling.noun);
      if (!record.intent.focusPoints.includes(expectedFocus)) {
        handoffFailures += 1;
        handoffTargetAgent = 'reading.oracle.R13';
      }
    }
    if (state.location?.place && record.intent.currentLocation?.place !== state.location.place) {
      handoffFailures += 1;
      handoffTargetAgent = 'reading.oracle.R8';
    }
    if (state.slots.horizon?.value && JSON.stringify(record.intent.horizon) !== JSON.stringify(state.slots.horizon.value)) {
      handoffFailures += 1;
      handoffTargetAgent = 'reading.oracle.R6';
    }
  }
  const contextHandoffOk: 0 | 1 = handoffFailures === 0 ? 1 : 0;

  // 3. Counterfactual: did an unasked/defaulted slot coincide with downstream split agreement or dropped claims?
  const agr = record.agreement as { overall?: string; level?: string } | null | undefined;
  const splitAgreement = agr?.overall === 'split' || agr?.level === 'split';
  const hasDroppedClaims = (record.droppedClaims ?? 0) > 0;
  const findingsList = Array.isArray(record.findings) ? record.findings : null;
  const required = BUCKETS[bucket as keyof typeof BUCKETS]?.requiredSlots ?? [];
  let missedCriterion: MissedCriterion = 'none';

  const checkMissed = (c: MissedCriterion): boolean => {
    if (c === 'none') return false;
    if (c in assumed) return true;
    if (!state && required.includes(c as never)) {
      const slotVal = record.intent.classification?.slots?.[c as keyof typeof record.intent.classification.slots];
      return !slotVal;
    }
    return false;
  };

  for (const candidate of ['horizon', 'sub_bucket', 'subject_person', 'sibling', 'location'] as const) {
    if (checkMissed(candidate)) {
      missedCriterion = candidate;
      break;
    }
  }

  const wouldAskingHaveHelped: 0 | 1 =
    missedCriterion !== 'none' && (splitAgreement || hasDroppedClaims || (findingsList !== null && findingsList.length === 0)) ? 1 : 0;

  if (missedCriterion === 'subject_person' || missedCriterion === 'sibling') {
    handoffTargetAgent = 'reading.oracle.R13';
  } else if (missedCriterion === 'horizon') {
    handoffTargetAgent = 'reading.oracle.R6';
  } else if (missedCriterion === 'location') {
    handoffTargetAgent = 'reading.oracle.R8';
  }

  // 4. Phrasing quality score (concise <= 24 words, no engine/chart jargon)
  let phrasingPenalty = 0;
  for (const turn of turns) {
    const words = turn.ask.question.trim().split(/\s+/).filter(Boolean).length;
    if (words > 24) phrasingPenalty += 15;
    if (/\b(pyjhora|radha|jhora|varga|ashtakavarga|shadbala|vimshottari)\b/i.test(turn.ask.question)) {
      phrasingPenalty += 30;
    }
  }
  const phrasingScore = Math.max(0, 100 - phrasingPenalty);

  // 5. Ask-right & Handoff scores
  let askRightScore = 100;
  if (wouldAskingHaveHelped === 1) askRightScore -= 35;
  else if (missedCriterion !== 'none') askRightScore -= 10;
  if (extraAskTriggered === 1) askRightScore -= 25;
  askRightScore = Math.max(0, askRightScore);

  const handoffScore = Math.max(0, 100 - handoffFailures * 40);
  const overallScore = Math.round(askRightScore * 0.45 + handoffScore * 0.35 + phrasingScore * 0.2);

  const diagnosisCode =
    handoffFailures > 0
      ? `handoff_missing_${missedCriterion !== 'none' ? missedCriterion : 'slot'}`
      : wouldAskingHaveHelped === 1
        ? `counterfactual_needed_${missedCriterion}`
        : extraAskTriggered === 1
          ? 'extra_ask_known_fact'
          : 'optimal';

  const flags: string[] = [];
  if (extraAskTriggered === 1) flags.push('re_asked_confirmed_fact');
  if (wouldAskingHaveHelped === 1) flags.push(`unasked_${missedCriterion}`);
  if (handoffFailures > 0) flags.push('context_handoff_mismatch');
  if (phrasingPenalty > 0) flags.push('phrasing_jargon_or_length');

  const toFiveScale = (pct: number) => Math.round((pct / 20) * 10) / 10;
  const rawPerson =
    state?.slots.subject_person?.value ??
    record.intent.classification?.slots?.subject_person?.value ??
    null;
  const subjectPerson = typeof rawPerson === 'string' && rawPerson.trim() ? rawPerson.trim() : null;

  return {
    runId: record.runId,
    clarifyRunId,
    bucket,
    driver,
    turnsCount,
    assumedCount,
    missedCriterion,
    wouldAskingHaveHelped,
    extraAskTriggered,
    contextHandoffOk,
    askRightScore,
    phrasingScore,
    handoffScore,
    overallScore,
    targetAgentId: handoffTargetAgent,
    diagnosisCode,
    overall_score: toFiveScale(overallScore),
    ask_right_score: toFiveScale(askRightScore),
    phrasing_score: toFiveScale(phrasingScore),
    handoff_score: toFiveScale(handoffScore),
    would_asking_have_helped: wouldAskingHaveHelped === 1,
    extra_ask_triggered: extraAskTriggered === 1,
    context_handoff_ok: contextHandoffOk === 1,
    turn_count: turnsCount,
    planner_source: driver,
    reason_code: diagnosisCode,
    subject_person: subjectPerson,
    flags,
  };
}

/**
 * Runs the deterministic Clarify Monitor and records both an `agent_runs` row (`reading.clarify_monitor`,
 * tagged to `general.clarify`) and the `clarify_monitor` JSON column on `reading_traces` when present.
 */
export async function runClarifyMonitor(
  prisma: PrismaClient | null | undefined,
  userId: string,
  state: ClarifyState | null | undefined,
  record: ClarifyMonitorRecordInput,
  facts: Record<string, string> = {},
): Promise<ClarifyMonitorVerdict> {
  const verdict = evaluateClarifyMonitor(state, record, facts);
  const activeTrace = currentTrace();
  if (activeTrace) {
    activeTrace.label({ clarify_monitor: verdict });
  }
  if (!prisma || process.env.READING_METRICS?.trim() === '0') return verdict;

  await withAgentRun(
    prisma,
    'reading.clarify_monitor',
    {
      userId,
      kundliId: record.kundliId ?? null,
      technique: 'general.clarify',
      task: 'clarify-monitor',
      input: {
        bucket: verdict.bucket,
        turnsCount: verdict.turnsCount,
        assumedCount: verdict.assumedCount,
        driver: verdict.driver,
      },
    },
    async () => ({
      value: verdict,
      output: {
        askRightScore: verdict.askRightScore,
        phrasingScore: verdict.phrasingScore,
        handoffScore: verdict.handoffScore,
        overallScore: verdict.overallScore,
        missedCriterion: verdict.missedCriterion,
        wouldAskingHaveHelped: verdict.wouldAskingHaveHelped,
        extraAskTriggered: verdict.extraAskTriggered,
        contextHandoffOk: verdict.contextHandoffOk,
        targetAgentId: verdict.targetAgentId,
        diagnosisCode: verdict.diagnosisCode,
      },
    }),
  ).catch(() => {});

  if (!activeTrace) {
    const traceModel = (prisma as unknown as { readingTrace?: { updateMany?: (args: unknown) => Promise<unknown> } }).readingTrace;
    if (traceModel?.updateMany) {
      await traceModel
        .updateMany({
          where: { run_id: record.runId },
          data: { clarify_monitor: verdict as unknown as object },
        })
        .catch(() => {});
    }
  }

  return verdict;
}
