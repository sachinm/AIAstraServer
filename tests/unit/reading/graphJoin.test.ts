import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReadingGraph } from '../../../src/reading/graph.js';
import { buildEvidencePack } from '../../../src/reading/packs/selector.js';
import { runIntake } from '../../../src/reading/nodes/intake.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import type { Finding, SpecialistAnalyst } from '../../../src/reading/nodes/specialists.js';
import type { ReadingEvent } from '../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();

async function setup(question: string) {
  const intent = (await runIntake(question, G1_AS_OF, { mode: 'rules' })).intent;
  const packs = Object.fromEntries(intent.subjects.map((s) => [s.id, buildEvidencePack({ dossier, transits, subject: s.id, asOf: G1_AS_OF, intent })]));
  return { intent, packs };
}

const ok = (analyst: SpecialistAnalyst, subject: string, layerScore: number): { finding: Finding; usage: { node: string; model: string; promptTokens: number; cachedTokens: number; outputTokens: number; thoughtTokens: number; ms: number } } => ({
  finding: { analyst, subject: subject as Finding['subject'], verdict: layerScore > 0 ? 'strong' : 'weak', layerScore, status: 'ok', claims: [], windows: [], caveats: [], keyFacts: [] },
  usage: { node: analyst, model: 'fake', promptTokens: 10, cachedTokens: 0, outputTokens: 5, thoughtTokens: 0, ms: 1 },
});

async function run(question: string, impl: (a: { analyst: SpecialistAnalyst; subject: string }) => Promise<ReturnType<typeof ok>>, dossierHash: string | null = null) {
  const { intent, packs } = await setup(question);
  const events: ReadingEvent[] = [];
  const synthesize = vi.fn(async (brief: string) => ({ text: brief, usage: ok('promise', 'x', 0).usage, ttftMs: 1, finishReason: 'STOP', stoppedForLoop: false }));
  const g = buildReadingGraph({
    intent, question, asOf: G1_AS_OF, system: 'sys', packs, keyFacts: 'fact one\nfact two', emit: (e) => events.push(e),
    synthesize, specialistImpl: impl as never, dossier, transits, dossierHash,
  });
  const out = await g.invoke({});
  return { out, events, synthesize };
}

describe('graph join semantics (file 11 §6)', () => {
  beforeEach(() => findingsCache.clear());

  it('a required agent that fails once is retried and the reading is not capped', async () => {
    let promiseCalls = 0;
    const { out } = await run('When will I get married?', async ({ analyst, subject }) => {
      if (analyst === 'promise' && promiseCalls++ === 0) throw new Error('transient');
      return ok(analyst, subject, 2);
    });
    expect(promiseCalls).toBe(2);
    expect(out.failed).toEqual([]);
    expect(out.reconciled!.verdict.level).toBe('strong');
    expect(out.reconciled!.synthBrief.now).toMatchObject({ md: 'Sa', ad: 'Ke' });
    expect(out.reconciled!.brief).toMatch(/^TEMPLATE: T2/);
  });

  it('a required agent that fails twice is recorded and caps the verdict at weak', async () => {
    const { out, events } = await run('When will I get married?', async ({ analyst, subject }) => {
      if (analyst === 'dasha') throw new Error('down');
      return ok(analyst, subject, 3);
    });
    expect(out.failed).toEqual(['dasha']);
    expect(out.reconciled!.verdict.level).toBe('weak');
    expect(out.reconciled!.verdict.caps.join(' ')).toMatch(/missing L2/);
    expect(events.some((e) => e.type === 'stage' && e.name === 'dasha' && e.status === 'failed')).toBe(true);
  });

  it('an optional agent that fails is skipped without a retry and does not cap the verdict', async () => {
    let nakCalls = 0;
    const { out, events } = await run('What do my nakshatras say about me?', async ({ analyst, subject }) => {
      if (analyst === 'nakshatra') {
        nakCalls += 1;
        throw new Error('slow');
      }
      return ok(analyst, subject, 2);
    });
    expect(nakCalls).toBe(1);
    expect(out.failed).toEqual([]);
    expect(events.some((e) => e.type === 'stage' && e.name === 'nakshatra' && e.status === 'skipped')).toBe(true);
  });

  it('cached findings are reused: the second run makes no specialist calls', async () => {
    const impl = vi.fn(async ({ analyst, subject }: { analyst: SpecialistAnalyst; subject: string }) => ok(analyst, subject, 1));
    await run('When will I get married?', impl, 'dossier-hash-1');
    const first = impl.mock.calls.length;
    expect(first).toBeGreaterThanOrEqual(3);
    const { events } = await run('When will I get married?', impl, 'dossier-hash-1');
    expect(impl.mock.calls.length).toBe(first);
    expect(events.filter((e) => e.type === 'stage' && e.status === 'done' && (e as { cached?: boolean }).cached).length).toBe(first);
  });

  it('a different period reuses the natal layers and re-runs only timing', async () => {
    const impl = vi.fn(async ({ analyst, subject }: { analyst: SpecialistAnalyst; subject: string }) => ok(analyst, subject, 1));
    await run('When will I get married in the next 6 months?', impl, 'dossier-hash-2');
    impl.mockClear();
    await run('When will I get married in the next 3 years?', impl, 'dossier-hash-2');
    const analysts = impl.mock.calls.map((c) => c[0].analyst).sort();
    expect(analysts).toEqual(['dasha', 'transit']);
  });
});
