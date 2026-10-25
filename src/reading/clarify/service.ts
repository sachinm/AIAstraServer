/**
 * Clarify service: the glue between the HTTP endpoints, the classifier, the state machine, the store and the reading.
 *
 * Track B of file 13 starts here: the user's dossier and transit chart are loaded (and cached in process) the moment
 * the question arrives, while the clarifier talks to the user. The headline card for chart-aware questions is read
 * from that load with a short budget, so a slow database never delays the first question.
 */
import type { PrismaClient } from '@prisma/client';
import { classifyRules, classifierThreshold } from '../buckets/classifier.js';
import { BUCKETS } from '../buckets/taxonomy.js';
import { startPrefetch } from '../data/store.js';
import { runIntake, clarifyTextFor } from '../nodes/intake.js';
import type { Intent, Usage } from '../types.js';
import { absorbAnswer, assumptionText, clarifyMode, confirmClarify, startClarify, type Ask, type ClarifyMode, type ClarifyState, type HeadlineCard } from './machine.js';
import { phraseAsk, resolveFreeText } from './planner.js';
import type { ClarifyStore } from './store.js';
import { declinedFor, loadDeclinedTopics, type DeclinedTopic } from '../policy/declined.js';

export const CARD_BUDGET_MS = 300;

export type ClarifyEvent =
  | { type: 'clarify'; runId: string; criterion: Ask['criterion']; question: string; chips: Ask['chips']; allowFreeText: boolean; turn: number; understanding: string }
  | { type: 'propose'; runId: string; exactQuery: string; assumed: string | null; slots: ClarifyState['slots'] };

export interface ClarifyStepResult {
  runId: string;
  state: ClarifyState;
  /** null when no interaction is needed (READY): the caller reads straight away */
  event: ClarifyEvent | null;
  usage: Usage[];
  ms: number;
  /** Set when the question or answer is a topic the app does not discuss: show `declined.reply`, nothing else */
  declined?: DeclinedTopic;
}

async function headlineCard(prisma: PrismaClient, userId: string, asOf: string): Promise<HeadlineCard | null> {
  const load = startPrefetch(prisma, userId, { asOf });
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), CARD_BUDGET_MS));
  const data = await Promise.race([load, timeout]);
  const cur = data?.dossier?.dasha?.vimshottari?.current;
  if (!cur) return null;
  return { md: cur.md, ad: cur.ad, pd: cur.pd, adEnd: cur.ad_end };
}

function understandingLine(s: ClarifyState): string {
  return `You are asking about ${BUCKETS[s.bucket].displayName.toLowerCase()}.`;
}

async function eventFor(runId: string, s: ClarifyState, usage: Usage[]): Promise<ClarifyEvent | null> {
  if (s.status === 'ASKING' && s.pending) {
    const { ask, usage: u } = await phraseAsk(s, s.pending);
    if (u) usage.push(u);
    return { type: 'clarify', runId, criterion: ask.criterion, question: ask.question, chips: ask.chips, allowFreeText: ask.allowFreeText, turn: s.turns.length, understanding: understandingLine(s) };
  }
  if (s.status === 'PROPOSED' && s.exactQuery) return { type: 'propose', runId, exactQuery: s.exactQuery, assumed: assumptionText(s), slots: s.slots };
  return null;
}

/** Question arrives: classify (rules), prewarm data, decide whether to ask. */
export async function beginClarify(prisma: PrismaClient, store: ClarifyStore, userId: string, question: string, opts: { asOf?: string; mode?: ClarifyMode } = {}): Promise<ClarifyStepResult> {
  const t0 = Date.now();
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const mode = opts.mode ?? clarifyMode();
  // the gate runs before the classifier, the data load and any model
  const declined = await declinedFor(prisma, userId, question);
  // a question about the person's own child with no stated age: confirm 18+ first (file 18), unless clarifying is off
  const needsChildAge = declined?.id === 'child_age_unconfirmed' && mode !== 'never';
  if (declined && !needsChildAge) return { runId: '', state: startClarify('', asOf, classifyRules('', asOf), { mode: 'never', threshold: 1 }), event: null, usage: [], ms: Date.now() - t0, declined };
  const cls = classifyRules(question, asOf);
  const needsCard = mode !== 'never' && cls.missing.includes('horizon');
  const card = needsCard ? await headlineCard(prisma, userId, asOf) : (startPrefetch(prisma, userId, { asOf }), null);
  const state = startClarify(question, asOf, cls, { mode, threshold: classifierThreshold(), card, needsChildAge });
  const runId = await store.create(userId, state);
  const usage: Usage[] = [];
  const event = await eventFor(runId, state, usage);
  return { runId, state, event, usage, ms: Date.now() - t0 };
}

/** The user tapped a chip or typed an answer. */
export async function answerClarify(prisma: PrismaClient, store: ClarifyStore, userId: string, runId: string, value: string, viaChip: boolean): Promise<ClarifyStepResult | { error: 'not_found' | 'not_asking' | 'abandoned' }> {
  const t0 = Date.now();
  const s = await store.get(userId, runId);
  if (!s) return { error: 'not_found' };
  if (s.status === 'ABANDONED') return { error: 'abandoned' };
  if (s.status !== 'ASKING' || !s.pending) return { error: 'not_asking' };
  // typed answers pass the same gate as questions; a declined answer ends the conversation and is not stored
  if (!viaChip) {
    const declined = await declinedFor(prisma, userId, value);
    if (declined) {
      const ended: ClarifyState = { ...s, status: 'ABANDONED', pending: null, updatedAt: Date.now() };
      await store.save(userId, runId, ended);
      return { runId, state: ended, event: null, usage: [], ms: Date.now() - t0, declined };
    }
  }
  const usage: Usage[] = [];
  let next = absorbAnswer(s, value, { viaChip, threshold: classifierThreshold() });
  // the rules could not read the free text: let the model map it to a closed value, then apply that as a chip
  const last = next.turns[next.turns.length - 1];
  const lastAnswered = next.turns.find((t) => t.answer && t.ask.criterion === s.pending!.criterion && t.answer.value === value.slice(0, 300));
  if (!viaChip && lastAnswered && lastAnswered.answer && !lastAnswered.answer.resolved) {
    const r = await resolveFreeText(s, s.pending.criterion, value);
    if (r.usage) usage.push(r.usage);
    if (r.value) next = absorbAnswer(s, r.value, { viaChip: true, threshold: classifierThreshold() });
  }
  void last;
  await store.save(userId, runId, next);
  if (next.childAge === 'minor') {
    const topics = await loadDeclinedTopics(null);
    return { runId, state: next, event: null, usage, ms: Date.now() - t0, declined: topics.find((x) => x.id === 'minors') };
  }
  const event = await eventFor(runId, next, usage);
  return { runId, state: next, event, usage, ms: Date.now() - t0 };
}

/** The user confirmed the exact query (or edited it). Returns the intent the reading must use. */
export async function confirmAndBuildIntent(store: ClarifyStore, userId: string, runId: string, edits: { horizon?: string; bucket?: string } = {}): Promise<{ state: ClarifyState; intent: Intent | null; event: ClarifyEvent | null } | { error: 'not_found' | 'abandoned' | 'not_ready' }> {
  const s = await store.get(userId, runId);
  if (!s) return { error: 'not_found' };
  if (s.status === 'ABANDONED') return { error: 'abandoned' };
  if (s.status !== 'PROPOSED' && s.status !== 'READY' && s.status !== 'CONFIRMED') return { error: 'not_ready' };
  const next = s.status === 'CONFIRMED' ? s : confirmClarify(s, edits);
  await store.save(userId, runId, next);
  if (next.status !== 'CONFIRMED') return { state: next, intent: null, event: await eventFor(runId, next, []) };
  return { state: next, intent: await intentFromState(next), event: null };
}

/**
 * The confirmed clarify state as a reading intent: the rules intake of the original question, with the clarified
 * horizon and the bucket's frame, and the exact query as the understanding line.
 */
export async function intentFromState(s: ClarifyState): Promise<Intent> {
  const base = (await runIntake(s.question, s.asOf, { mode: 'rules' })).intent;
  const b = BUCKETS[s.bucket];
  const subFrame = s.subBucket ? b.subBuckets.find((x) => x.id === s.subBucket)?.frame : undefined;
  const frame = subFrame ?? b.frames[0]!;
  const horizon = s.slots.horizon?.value ?? base.horizon;
  const subjects = base.subjects.some((x) => x.id === frame) ? base.subjects : [{ id: frame, weight: 1 }, ...base.subjects.filter((x) => x.id !== 'general_life_direction')].slice(0, 3);
  return {
    ...base,
    subjects,
    horizon,
    confidence: 1,
    clarifyText: s.exactQuery ?? clarifyTextFor(subjects.map((x) => x.id), horizon, s.asOf),
    classification: base.classification ? { ...base.classification, bucket: s.bucket, subBucket: s.subBucket, slots: s.slots, missing: [], source: 'rules' } : undefined,
  };
}
