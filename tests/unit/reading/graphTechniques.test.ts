import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReadingGraph } from '../../../src/reading/graph.js';
import { buildEvidencePack } from '../../../src/reading/packs/selector.js';
import { runIntake } from '../../../src/reading/nodes/intake.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import type { Finding, SpecialistAnalyst } from '../../../src/reading/nodes/specialists.js';
import { runCodeReaders, toFinding, CODE_ANALYSTS } from '../../../src/reading/codeReaders/readers.js';
import { factsLine, tailFor } from '../../../src/reading/run.js';
import { techniquesForQuestion } from '../../../src/techniques/use.js';
import { TECHNIQUES } from '../../../src/techniques/catalog.js';
import type { SubjectId } from '../../../src/reading/packs/frames.js';
import type { Intent } from '../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';
import { guardNoModelCalls } from '../../helpers/noModelCalls.js';
import { digestFromDossier } from '../../helpers/digestFixture.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const USAGE = { node: 'x', model: 'fake', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 };

beforeEach(() => findingsCache.clear());
guardNoModelCalls();

async function graphRun(question: string, opts: { narrow?: boolean; digest?: boolean } = {}) {
  const intent = (await runIntake(question, G1_AS_OF, { mode: 'rules' })).intent;
  const digest = opts.digest ? digestFromDossier(dossier) : null;
  const packs = Object.fromEntries(intent.subjects.map((s) => [s.id, buildEvidencePack({ dossier, transits, subject: s.id, asOf: G1_AS_OF, intent, ...(digest ? { digest } : {}) })]));
  // a catalogue where the transit analyst is selected only for children
  const catalogue = opts.narrow ? TECHNIQUES.map((t) => (t.id === 'general.transit' ? { ...t, selectors: { ...t.selectors, subjects: ['children'] as SubjectId[] } } : t)) : TECHNIQUES;
  const uses = techniquesForQuestion(intent, {}, { flow: 'graph', digestReady: !!digest, asOf: G1_AS_OF, question }, catalogue);
  const calls: Array<{ analyst: SpecialistAnalyst; subject: string }> = [];
  const impl = vi.fn(async (a: { analyst: SpecialistAnalyst; subject: string }) => {
    calls.push({ analyst: a.analyst, subject: a.subject });
    const finding: Finding = { analyst: a.analyst, subject: a.subject as Finding['subject'], verdict: 'moderate', layerScore: 1, status: 'ok', claims: [], windows: [], caveats: [], keyFacts: [] };
    return { finding, usage: USAGE };
  });
  const codeFindings = digest ? intent.subjects.flatMap((s) => runCodeReaders(packs[s.id]!, uses.bySubject[s.id]?.deterministic ?? [])).map(toFinding) : [];
  const synthesize = vi.fn(async (brief: string) => ({ text: brief, usage: USAGE, ttftMs: 1, finishReason: 'STOP', stoppedForLoop: false }));
  const g = buildReadingGraph({
    intent, question, asOf: G1_AS_OF, system: 'sys', packs, keyFacts: 'k', emit: () => undefined, synthesize, specialistImpl: impl as never, dossier, transits,
    analystsBySubject: Object.fromEntries(intent.subjects.map((s) => [s.id, uses.bySubject[s.id]?.analysts ?? []])),
    ...(codeFindings.length ? { codeFindings } : {}),
  });
  const out = await g.invoke({});
  return { intent, calls, out, uses };
}

describe('the graph runs only the selected analysts', () => {
  it('with the catalogue as built it runs what it ran before (same analysts per subject)', async () => {
    const { calls, uses } = await graphRun('How will my career go next year?');
    expect(uses.bySubject.career_work!.analysts).toEqual(expect.arrayContaining(['promise', 'dasha', 'transit']));
    expect(calls.map((c) => c.analyst).sort()).toEqual(['dasha', 'promise', 'transit']);
  });

  it('an unselected analyst does not run on that subject; promise and dasha always run', async () => {
    const { calls, intent } = await graphRun('How will my career go next year?', { narrow: true });
    expect(intent.subjects.map((s) => s.id)).toEqual(['career_work']);
    expect(calls.map((c) => c.analyst).sort()).toEqual(['dasha', 'promise']);
  });

  it('the deterministic readers join reconcile beside the analysts, with no model call', async () => {
    const { out, calls } = await graphRun('How will my career go next year?', { digest: true });
    const layers = out.reconciled!.findings.map((f) => f.analyst);
    expect(layers).toEqual(expect.arrayContaining(['promise', 'dasha', 'transit', 'varga_dynamics', 'strength_yoga', 'jaimini']));
    expect(calls.map((c) => c.analyst)).not.toEqual(expect.arrayContaining([...CODE_ANALYSTS]));
    const code = out.reconciled!.findings.filter((f) => (CODE_ANALYSTS as readonly string[]).includes(f.analyst));
    expect(code.reduce((n, f) => n + f.claims.length, 0)).toBeGreaterThan(0);
    expect(out.reconciled!.brief).toContain('varga_dynamics');
  });
});

describe('FACTS in the tail (doc 53 §4.4)', () => {
  const intent: Intent = { subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', questionType: 'describe', format: 'direct', focusPoints: [], mentionsPlanets: [], confidence: 1, clarifyText: 'career next year', followUps: [], safety: 'ok' };

  it('carries the confirmed facts, sorted, without the wizard, the place or a declined value', () => {
    const line = factsLine({ 'work.status': 'between_jobs', 'love.status': 'married', 'wizard.done': '2026-11-01', 'place.current': 'Pune', 'family.children': 'declined' });
    expect(line).toBe('FACTS (what the person has told us; speak to this situation and do not ask it again): love.status: married; work.status: between_jobs');
    expect(factsLine({})).toBeNull();
    expect(factsLine({ 'wizard.done': 'x' })).toBeNull();
  });

  it('sits before the question in the tail, and the tail is unchanged without facts', () => {
    const withFacts = tailFor(intent, 'Will I find a job?', G1_AS_OF, false, { 'work.status': 'between_jobs' });
    const without = tailFor(intent, 'Will I find a job?', G1_AS_OF);
    expect(withFacts).toContain('FACTS (what the person has told us; speak to this situation and do not ask it again): work.status: between_jobs\n\nQUESTION: Will I find a job?');
    expect(without).not.toContain('FACTS');
    expect(withFacts.replace(/\n\nFACTS[^\n]*/, '')).toBe(without);
    expect(tailFor(intent, 'q', G1_AS_OF, true, { 'work.status': 'yes' })).toContain('FACTS');
  });
});
