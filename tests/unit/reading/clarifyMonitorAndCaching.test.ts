import { afterEach, describe, expect, it, vi } from 'vitest';
import { clarifyModelConfig, DEFAULT_CLARIFY_MODEL } from '../../../src/reading/llm/bedrock.js';
import { startClarify } from '../../../src/reading/clarify/machine.js';
import { evaluateClarifyMonitor, runClarifyMonitor } from '../../../src/reading/clarify/monitor.js';
import { classifyRules, clearClassifierCache } from '../../../src/reading/buckets/classifier.js';
import { clearIntakeCache, ruleIntake } from '../../../src/reading/nodes/intake.js';
import { clearValidatorCache, validateAnswer } from '../../../src/reading/oracle/validator.js';
import { CostGuard } from '../../../src/reading/oracle/costGuard.js';
import { personIn, planReaders } from '../../../src/reading/oracle/readers.js';
import { RunTrace, type SpanRow, type TraceStore } from '../../../src/reading/metrics/trace.js';
import { findingCacheKey } from '../../../src/reading/nodes/findingsCache.js';

describe('AI-first Clarify config, person_facts awareness, and Clarify Monitor', () => {
  const prevClarifyModel = process.env.READING_MODEL_CLARIFY;

  afterEach(() => {
    if (prevClarifyModel === undefined) delete process.env.READING_MODEL_CLARIFY;
    else process.env.READING_MODEL_CLARIFY = prevClarifyModel;
    clearClassifierCache();
    clearIntakeCache();
    clearValidatorCache();
  });

  it('supports gemini cheapest fast model, bedrock, and off in clarifyModelConfig', () => {
    process.env.READING_MODEL_CLARIFY = 'gemini';
    expect(clarifyModelConfig()).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash-lite' });

    process.env.READING_MODEL_CLARIFY = 'gemini:gemini-2.5-flash';
    expect(clarifyModelConfig()).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });

    process.env.READING_MODEL_CLARIFY = 'bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0';
    expect(clarifyModelConfig()).toEqual({
      provider: 'bedrock',
      model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    });

    process.env.READING_MODEL_CLARIFY = 'off';
    expect(clarifyModelConfig()).toEqual({ provider: 'off', model: DEFAULT_CLARIFY_MODEL });
  });

  it('skips asking about facts already present in person_facts and logs decisionLog', () => {
    const cls = classifyRules('How will my career go this year?', '2026-11-06');
    const state = startClarify('How will my career go this year?', '2026-11-06', cls, {
      mode: 'when_missing',
      threshold: 0.72,
      facts: { 'work.status': 'yes' },
    });

    expect(state.decisionLog).toBeDefined();
    expect(state.decisionLog?.some((s) => s.criterion === 'background' && s.action === 'skipped')).toBe(true);
    expect(state.slots.background?.value).toBe('employed');
  });

  it('evaluates Clarify Monitor counterfactuals, extra-ask penalties, and R13 handoff checks', () => {
    const cls = classifyRules('How will the health be this year?', '2026-11-06');
    const state = startClarify('How will the health be this year?', '2026-11-06', cls, {
      mode: 'never',
      threshold: 0.72,
    });
    const familyState = {
      ...state,
      bucket: 'family_children' as const,
      assumed: { subject_person: 'your family' },
    };

    const baseIntent = ruleIntake('How will the health be this year?', '2026-11-06').intent;
    const verdict = evaluateClarifyMonitor(
      familyState,
      {
        runId: 'run-1',
        kundliId: 'kundli-1',
        intent: {
          ...baseIntent,
          horizon: '1y',
          subjects: [{ id: 'children', weight: 1 }],
          questionType: 'describe',
          classification: {
            ...baseIntent.classification!,
            bucket: 'family_children',
            subBucket: null,
            confidence: 0.85,
            questionKind: 'describe',
            slots: {},
            missing: ['subject_person'],
            source: 'rules',
          },
        },
        agreement: { overall: 'split' },
        findings: [],
        droppedClaims: 1,
      },
      {},
    );

    expect(verdict.missedCriterion).toBe('subject_person');
    expect(verdict.wouldAskingHaveHelped).toBe(1);
    expect(verdict.contextHandoffOk).toBe(0);
    expect(verdict.targetAgentId).toBe('reading.oracle.R13');
    expect(verdict.askRightScore).toBeLessThan(100);
    expect(verdict.handoffScore).toBeLessThan(100);
  });

  it('persists Clarify Monitor run summary and trace update via runClarifyMonitor', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createRun = vi.fn().mockResolvedValue({ id: 1n });
    const updateRun = vi.fn().mockResolvedValue({});
    const fakePrisma = {
      agentRun: { create: createRun, update: updateRun },
      readingTrace: { updateMany },
    } as unknown as Parameters<typeof runClarifyMonitor>[0];

    const cls = classifyRules('How is my career in the next 6 months?', '2026-11-06');
    const state = startClarify('How is my career in the next 6 months?', '2026-11-06', cls, {
      mode: 'when_missing',
      threshold: 0.72,
    });
    const baseIntent = ruleIntake('How is my career in the next 6 months?', '2026-11-06').intent;

    const verdict = await runClarifyMonitor(fakePrisma, 'user-1', state, {
      runId: 'run-career-1',
      kundliId: 'k-1',
      intent: {
        ...baseIntent,
        horizon: '6m',
        subjects: [{ id: 'career_work', weight: 1 }],
        questionType: 'describe',
      },
      agreement: { overall: 'high' },
      findings: [{ id: 'f1' }],
      droppedClaims: 0,
    });

    expect(verdict.diagnosisCode).toBe('optimal');
    expect(verdict.overallScore).toBe(100);
    expect(verdict.overall_score).toBe(5);
    expect(verdict.ask_right_score).toBe(5);
    expect(verdict.phrasing_score).toBe(5);
    expect(verdict.handoff_score).toBe(5);
    expect(verdict.would_asking_have_helped).toBe(false);
    expect(verdict.extra_ask_triggered).toBe(false);
    expect(verdict.context_handoff_ok).toBe(true);
    expect(verdict.flags).toEqual([]);
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { run_id: 'run-career-1' },
      data: { clarify_monitor: verdict },
    });
  });
});

describe('R13 parent support and planReaders subject_person slot handoff', () => {
  it('supports parent in personIn and selects R13 for parent questions via slotPerson', () => {
    expect(personIn('How will my parents do this year?')).toEqual({
      person: 'parent',
      houses: [4, 9],
      varga: 'varga.d12',
    });
    expect(personIn('How will the year go?', 'mother')).toEqual({
      person: 'mother',
      houses: [4],
      varga: 'varga.d12',
    });

    const baseIntent = ruleIntake('How will the year go?', '2026-11-06').intent;
    const plan = planReaders({
      intent: {
        ...baseIntent,
        classification: {
          ...baseIntent.classification!,
          bucket: 'family_children',
          subBucket: null,
          confidence: 0.9,
          questionKind: 'describe',
          slots: {
            subject_person: { value: 'parent', text: 'parent' },
          },
          missing: [],
          source: 'rules',
        },
      },
      question: 'How will the year go?',
      asOf: '2026-11-06',
    });

    expect(plan.ids).toContain('R13');
    expect(plan.required.has('R13')).toBe(true);
  });
});

describe('Stage span rollup & annual findingsCache & bounded LRU caches', () => {
  it('rolls up child model_call tokens, cost, and model onto matching specialist and reader stage spans without cross-merging R01..R15', async () => {
    const addedSpans: SpanRow[] = [];
    const store: TraceStore = {
      startRun: async () => undefined,
      addSpans: async (rows) => {
        addedSpans.push(...rows);
      },
      finishRun: async () => undefined,
    };

    const trace = new RunTrace({ runId: 'run-trace-1', userId: 'user-1', kind: 'reading' }, store);

    trace.observe({ type: 'stage', name: 'dasha', status: 'start', subject: 'career_work' });
    trace.addModelCall({
      agent: 'specialist:dasha',
      model: 'gemini-3.1-flash-lite',
      startedAt: Date.now() - 400,
      status: 'ok',
      subject: 'career_work',
      ttftMs: 80,
      usage: {
        node: 'specialist:dasha',
        model: 'gemini-3.1-flash-lite',
        promptTokens: 1000,
        cachedTokens: 400,
        outputTokens: 200,
        thoughtTokens: 0,
        ms: 400,
      },
    });
    trace.observe({ type: 'stage', name: 'dasha', status: 'done', subject: 'career_work', ms: 420 });

    trace.observe({ type: 'stage', name: 'R01', status: 'start', subject: 'career_work' });
    trace.observe({ type: 'stage', name: 'R02', status: 'start', subject: 'career_work' });
    trace.addModelCall({
      agent: 'R01',
      model: 'gemini-3.1-flash-lite',
      startedAt: Date.now() - 300,
      status: 'ok',
      subject: 'career_work',
      ttftMs: 50,
      usage: {
        node: 'R01',
        model: 'gemini-3.1-flash-lite',
        promptTokens: 500,
        cachedTokens: 0,
        outputTokens: 120,
        thoughtTokens: 0,
        ms: 300,
      },
    });
    trace.addModelCall({
      agent: 'R02',
      model: 'gemini-3.1-flash-lite',
      startedAt: Date.now() - 280,
      status: 'ok',
      subject: 'career_work',
      ttftMs: 45,
      usage: {
        node: 'R02',
        model: 'gemini-3.1-flash-lite',
        promptTokens: 600,
        cachedTokens: 100,
        outputTokens: 150,
        thoughtTokens: 0,
        ms: 280,
      },
    });
    trace.observe({ type: 'stage', name: 'R01', status: 'done', subject: 'career_work', ms: 310 });
    trace.observe({ type: 'stage', name: 'R02', status: 'done', subject: 'career_work', ms: 290 });

    await trace.finish({ status: 'done' });

    const dashaStage = addedSpans.find((s) => s.level === 'stage' && s.agent === 'dasha');
    expect(dashaStage?.model).toBe('gemini-3.1-flash-lite');
    expect(dashaStage?.prompt_tokens).toBe(1000);
    expect(dashaStage?.cached_tokens).toBe(400);
    expect(dashaStage?.output_tokens).toBe(200);
    expect(Number(dashaStage?.est_cost_usd)).toBeGreaterThan(0);

    const r01Stage = addedSpans.find((s) => s.level === 'stage' && s.agent === 'R01');
    const r02Stage = addedSpans.find((s) => s.level === 'stage' && s.agent === 'R02');
    expect(r01Stage?.prompt_tokens).toBe(500);
    expect(r01Stage?.output_tokens).toBe(120);
    expect(r02Stage?.prompt_tokens).toBe(600);
    expect(r02Stage?.output_tokens).toBe(150);
  });

  it('computes a non-null findingCacheKey for annual specialist', () => {
    const key = findingCacheKey({
      dossierHash: 'hash-123',
      analyst: 'annual',
      subject: 'career_work',
      horizon: '1y',
      asOf: '2026-11-06',
    });
    expect(key).toContain('|annual|');
  });

  it('memoizes classifyRules, ruleIntake, and validateAnswer deterministically', async () => {
    const c1 = classifyRules('When will I get promoted at work?', '2026-11-06');
    const c2 = classifyRules('When will I get promoted at work?', '2026-11-06');
    expect({ ...c1, ms: 0 }).toStrictEqual({ ...c2, ms: 0 });

    const r1 = ruleIntake('When will I get promoted at work?', '2026-11-06');
    const r2 = ruleIntake('When will I get promoted at work?', '2026-11-06');
    expect(r1).toEqual(r2);

    const guard = new CostGuard();
    const v1 = await validateAnswer({
      answer: 'Your tenth house period peaks between March and May 2027.',
      question: 'When will I get promoted at work?',
      intent: r1.intent,
      finishReason: 'STOP',
      stoppedForLoop: false,
      failedRequired: [],
      model: 'gemini-3.1-flash-lite',
      useModel: false,
      guard,
    });
    const v2 = await validateAnswer({
      answer: 'Your tenth house period peaks between March and May 2027.',
      question: 'When will I get promoted at work?',
      intent: r2.intent,
      finishReason: 'STOP',
      stoppedForLoop: false,
      failedRequired: [],
      model: 'gemini-3.1-flash-lite',
      useModel: false,
      guard,
    });
    expect(v1.answered).toBe(v2.answered);
  });
});
