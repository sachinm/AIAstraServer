import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  buildCustomResearchSubject,
  buildLoveResearchDashboard,
  buildSelfResearchDashboard,
  buildWorkResearchDashboard,
  getResearchPresets,
  hydrateResearchBatch,
  synthesizeResearchDigestAndActivations,
  verifySelfDashboardRun,
} from '../../../src/reading/research/selfDashboardQa.js';

describe('Research Staging & Self Dashboard QA Engine (docs/admin/09)', () => {
  it('defines 10 age brackets (18..56, all >= 18) and 10 life/profession personas', () => {
    const presets = getResearchPresets();
    expect(presets).toHaveLength(20);

    const ageBrackets = presets.filter((p) => p.groupKind === 'age_bracket');
    const personas = presets.filter((p) => p.groupKind === 'persona');
    expect(ageBrackets).toHaveLength(10);
    expect(personas).toHaveLength(10);

    expect(ageBrackets.map((a) => a.ageYears)).toEqual([18, 20, 24, 28, 30, 32, 36, 40, 48, 56]);
    for (const p of presets) {
      expect(p.ageYears).toBeGreaterThanOrEqual(18);
      expect(p.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const personaCodes = personas.map((p) => p.subjectCode);
    expect(personaCodes).toEqual([
      'persona_teacher',
      'persona_business',
      'persona_real_estate',
      'persona_electrician',
      'persona_finance',
      'persona_software_engineer',
      'persona_college_student',
      'persona_new_parent',
      'persona_divorce_recovery',
      'persona_unemployed_health',
    ]);
  });

  it('builds the Self Dashboard, Nov/Thanksgiving/Dec/New Year zoom-in, 10-step trace, and >= 95% verifier pass across all 20 presets', () => {
    const presets = getResearchPresets();
    for (const subject of presets) {
      const run = buildSelfResearchDashboard(subject, '2026-11-15');
      expect(run.subjectCode).toBe(subject.subjectCode);
      expect(run.houseVargaMatrix).toHaveLength(12);
      expect(run.traceData).toHaveLength(10);

      // 4 holiday milestones: November, Thanksgiving, December, New Year
      expect(run.temporalData.holidayMilestones.map((m) => m.id)).toEqual([
        'november_lead',
        'thanksgiving_week',
        'december_core',
        'new_year_transition',
      ]);
      expect(run.temporalData.weeklyTimeline).toHaveLength(9);
      expect(run.temporalData.dailyStrip).toHaveLength(14);

      // Every trace step records pulled vs excluded data and classical rules
      for (const step of run.traceData) {
        expect(step.dataPulled.length).toBeGreaterThan(0);
        expect(step.dataExcluded.length).toBeGreaterThan(0);
        expect(step.classicalRulesApplied.length).toBeGreaterThan(0);
        expect(step.oracleProseClaim.length).toBeGreaterThan(10);
      }

      // Independent Technical Verifier passes at 100% (>= 95% threshold)
      expect(run.verifierData.gates).toHaveLength(8);
      expect(run.accuracyScore).toBeGreaterThanOrEqual(95);
      expect(run.verifierVerdict).toBe('pass');

      // Zero banned internal engine names
      const proseJson = JSON.stringify(run.readingProse);
      expect(proseJson).not.toMatch(/\b(Radha|pyjhora|AIAstra_Radha|jhora)\b/i);

      // 3-decade Character Evolution & Moon/Mercury Personality/Joy on Self board
      const charArc = run.boardData.productionBoard.characterArc;
      const joy = run.boardData.productionBoard.personalityAndJoy;
      expect(charArc).toBeDefined();
      expect(charArc!.pastDecade.stage).toBe('past_10y');
      expect(charArc!.presentNow.stage).toBe('now');
      expect(charArc!.nextDecade.stage).toBe('next_10y');
      expect(joy).toBeDefined();
      expect(joy!.whatFeelsGood.length).toBeGreaterThanOrEqual(4);
      expect(joy!.emotionalMindStyle.length).toBeGreaterThan(10);
      expect(joy!.intellectualWitStyle.length).toBeGreaterThan(10);
    }
  });

  it('builds Love and Work research dashboards with >= 95% verifier pass across preset subjects', () => {
    const presets = getResearchPresets().slice(0, 6);
    for (const subject of presets) {
      const loveRun = buildLoveResearchDashboard(subject, '2026-11-15');
      expect(loveRun.boardArea).toBe('love');
      expect(loveRun.houseVargaMatrix).toHaveLength(12);
      expect(loveRun.traceData).toHaveLength(10);
      expect(loveRun.accuracyScore).toBeGreaterThanOrEqual(95);
      expect(loveRun.verifierVerdict).toBe('pass');

      const workRun = buildWorkResearchDashboard(subject, '2026-11-15');
      expect(workRun.boardArea).toBe('work');
      expect(workRun.houseVargaMatrix).toHaveLength(12);
      expect(workRun.traceData).toHaveLength(10);
      expect(workRun.accuracyScore).toBeGreaterThanOrEqual(95);
      expect(workRun.verifierVerdict).toBe('pass');
    }
  });

  it('clamps custom subject age >= 18 and flags deliberate rule/governance violations in the verifier', () => {
    const custom = buildCustomResearchSubject({
      label: 'Custom Young Adult Test',
      ageYears: 14, // should clamp to 18
      birthDate: '2008-05-12',
      birthTime: '09:30',
      professionCode: 'software_engineer',
    });
    expect(custom.ageYears).toBe(18);
    expect(custom.groupKind).toBe('custom');

    const run = buildSelfResearchDashboard(custom, '2026-11-15');
    const { view, activationRows } = synthesizeResearchDigestAndActivations(custom, '2026-11-15');

    // Tamper with prose to inject a banned engine name and tamper with house matrix
    const tamperedReport = verifySelfDashboardRun({
      subject: custom,
      view,
      activations: activationRows,
      boardSnapshot: run.boardData,
      houseMatrix: run.houseVargaMatrix.map((h, i) => (i === 0 ? { ...h, d1Lord: 'WRONG' } : h)),
      temporal: run.temporalData,
      trace: run.traceData,
      prose: {
        ...run.readingProse,
        headline: 'Computed by pyjhora engine',
      },
    });
    expect(tamperedReport.verdict).not.toBe('pass');
    expect(tamperedReport.accuracyScore).toBeLessThan(95);
    const soulGate = tamperedReport.gates.find((g) => g.gateId === 'soul_governance_and_redaction');
    expect(soulGate?.passed).toBe(false);
  });

  it('hydrates batch into staging tables via Prisma delegates and records agent runs', async () => {
    const upsertedKundlis: unknown[] = [];
    const createdRuns: unknown[] = [];
    const agentRuns: unknown[] = [];

    const fakePrisma = {
      researchKundli: {
        upsert: async (args: { create: Record<string, unknown> }) => {
          upsertedKundlis.push(args.create);
          return { id: `rk_${String(args.create.subject_code)}` };
        },
      },
      researchChartData: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 3 }),
      },
      researchDigest: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 220 }),
      },
      researchActivation: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 11 }),
      },
      researchDashboardRun: {
        create: async (args: { data: Record<string, unknown> }) => {
          createdRuns.push(args.data);
          return {
            id: `run_${String(args.data.subject_code)}`,
            created_at: new Date('2026-11-15T12:00:00Z'),
          };
        },
      },
      agentRun: {
        create: async (args: { data: Record<string, unknown> }) => {
          agentRuns.push(args.data);
          return { id: `ar_${agentRuns.length}` };
        },
      },
    } as unknown as PrismaClient;

    const batch = await hydrateResearchBatch(fakePrisma, {
      mode: 'single',
      subjectCode: 'persona_teacher',
      asOf: '2026-11-15',
    });

    expect(batch.hydratedCount).toBe(1);
    expect(batch.passCount).toBe(1);
    expect(batch.avgAccuracyScore).toBeGreaterThanOrEqual(95);
    expect(upsertedKundlis).toHaveLength(1);
    expect(createdRuns).toHaveLength(1);
    expect(agentRuns).toHaveLength(2); // builder + verifier
  });
});
