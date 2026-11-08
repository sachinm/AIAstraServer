/**
 * The You reading service (docs/reading-engine/58 §4.1). One request: kundli → digest (preparing when not ready) →
 * reading clock → one activation read for the reading clock and its confirming clocks → each panel technique through
 * `withTechniqueOutput` (stored for its freshness window; a hit runs nothing) and `withAgentRun` (timed per technique)
 * → shaped by the person's confirm answers → the confirm question. The clock is part of the stored key, so changing the
 * clock never serves a panel read on another clock.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import type { DateSpan } from '../../techniques/pieces.js';
import { SELF_CONFIRM_PREFIX } from '../../profile/facts.js';
import { activationFor as realActivationFor, type ActivationRow } from '../digest/activation.js';
import { loadDigest as realLoadDigest } from '../digest/load.js';
import type { DigestView } from '../digest/types.js';
import { defaultQueueDigest } from '../area/boardService.js';
import { addMonthsIso } from '../timeline/months.js';
import { resolveClock, type SystemPresence } from './clock.js';
import type { PanelInput } from './panels/common.js';
import { lagnaPanel } from './panels/lagna.js';
import { mindPanel } from './panels/mind.js';
import { atmaPanel } from './panels/atma.js';
import { yogasPanel } from './panels/yogas.js';
import { strugglePanel } from './panels/struggle.js';
import { chaptersPanel } from './panels/chapters.js';
import { yearPanel, runningMudda } from './panels/year.js';
import { runningChain } from './slices.js';
import { SELF_PANEL_IDS, type ConfirmAnswer, type PanelBody, type SelfClaim, type SelfPanel, type SelfPanelId, type SelfQuestion, type SelfReading } from './types.js';
import { diagnosisPanel, type PanelBodies } from './panels/diagnosis.js';
import { CONFIRM_BY_HOUSE } from './words.js';

export const SELF_PANEL_AGENT = 'self.reading_panel';
/** Bump when panel code or words change: it is part of every stored output's key, so old wording is never served. */
export const SELF_READING_VERSION = 's1.2026-11-07f';

/** The part, spine, struggle and year panels; the diagnosis is built after them from their claims. */
export const PANELS: Record<Exclude<SelfPanelId, 'diagnosis'>, { title: string; run: (i: PanelInput) => PanelBody; window: 'natal' | 'dasha' | 'annual' }> = {
  lagna: { title: 'Who you are', run: lagnaPanel, window: 'natal' },
  mind: { title: 'Your mind', run: mindPanel, window: 'natal' },
  atma: { title: "Your soul's aim", run: atmaPanel, window: 'natal' },
  yogas: { title: 'Gifts and knots', run: yogasPanel, window: 'natal' },
  struggle: { title: 'What you struggle with', run: strugglePanel, window: 'dasha' },
  chapters: { title: 'Your chapters', run: chaptersPanel, window: 'dasha' },
  year: { title: 'This year', run: yearPanel, window: 'annual' },
};
export const PANEL_ORDER: SelfPanelId[] = [...SELF_PANEL_IDS];
const DIAGNOSIS_TITLE = 'Who you are, in short';
const OPTIONS: SelfQuestion['options'] = [
  { value: 'yes', label: 'Yes' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'No' },
  { value: 'skip', label: 'Skip' },
];

export interface SelfDeps {
  prisma: PrismaClient;
  loadDigest?: (prisma: PrismaClient, kundliId: string) => Promise<DigestView | null>;
  activationFor?: typeof realActivationFor;
  systemsPresent?: (prisma: PrismaClient, kundliId: string) => Promise<SystemPresence[]>;
  queueDigest?: (prisma: PrismaClient, kundliId: string) => Promise<void>;
  now?: () => Date;
}

export type SelfReadingResult =
  | { status: 'no_kundli' }
  | { status: 'preparing' }
  | { status: 'ok'; built_at: string; cached: boolean; reading: SelfReading };

export async function defaultSystemsPresent(prisma: PrismaClient, kundliId: string): Promise<SystemPresence[]> {
  const rows = await prisma.kundliActivation.groupBy({ by: ['system', 'family'], where: { kundli_id: kundliId, level: 1 } });
  return rows.map((r) => ({ system: r.system, family: r.family }));
}

const span = (from: string, to: string): DateSpan => ({ from: new Date(`${from}T00:00:00Z`), to: new Date(`${to}T00:00:00Z`) });

function charts(view: DigestView, id: SelfPanelId, clock: string): ChartUsed[] {
  const v = view.version;
  const natal: ChartUsed[] = ['house', 'planet', 'point', 'yoga', 'star'].map((s) => ({ type: `digest.${s}`, variant: v }));
  if (id === 'year') return [{ type: 'digest.annual', variant: v }, { type: 'digest.house', variant: v }];
  if (id === 'chapters' || id === 'struggle') return [...natal, { type: 'kundli_activation', variant: clock }];
  return natal;
}

/** The person's answers to confirm questions: claim id → answer. */
export async function confirmAnswers(prisma: PrismaClient, userId: string): Promise<Record<string, ConfirmAnswer>> {
  const rows = await prisma.personFact.findMany({ where: { user_id: userId, key: { startsWith: SELF_CONFIRM_PREFIX } } });
  const out: Record<string, ConfirmAnswer> = {};
  for (const r of rows) out[r.key.slice(SELF_CONFIRM_PREFIX.length)] = r.value as ConfirmAnswer;
  return out;
}

/**
 * One question (docs/reading-engine/59 §6.5): about the diagnosis's central tension while it is unanswered; after that,
 * about the running sub-chapter, then the running chapter, by the houses they activate.
 */
export function pickQuestion(panels: SelfPanel[], answers: Record<string, ConfirmAnswer>): SelfQuestion | null {
  const tension = panels.find((p) => p.id === 'diagnosis')?.claims.find((c) => c.id === 'diagnosis.tension');
  if (tension && !answers[tension.id]) {
    const said = tension.text.replace(/^The (tension|knot) in it: /, '');
    return { claimId: tension.id, panel: 'diagnosis', text: `Does this ring true for you right now? ${said[0]!.toUpperCase()}${said.slice(1)}`, options: OPTIONS };
  }
  const ch = panels.find((p) => p.id === 'chapters');
  const running = ch?.chapters?.find((c) => c.kind === 'running');
  const candidates: Array<{ claimId: string; houses: number[] }> = [];
  if (running?.sub) candidates.push({ claimId: 'chapters.sub', houses: running.sub.houses });
  if (running && running.certainty !== 'split') candidates.push({ claimId: 'chapters.running', houses: running.houses });
  for (const c of candidates) {
    if (answers[c.claimId]) continue;
    const q = CONFIRM_BY_HOUSE.find((x) => x.houses.some((h) => c.houses.includes(h)));
    if (q) return { claimId: c.claimId, panel: 'chapters', text: q.text, options: OPTIONS };
  }
  return null;
}

/** Claims the person said did not fit are kept, marked withheld, with their detail. */
export function shapeClaims(claims: SelfClaim[], answers: Record<string, ConfirmAnswer>, alsoWithheld: ReadonlySet<string> = new Set()): SelfClaim[] {
  return claims.map((c) => (answers[c.id] === 'no' || alsoWithheld.has(c.id) ? { ...c, withheld: 'You told us this did not fit.' } : c));
}

/** A "no" to a diagnosis sentence also withholds the claims it was built from (its `claim:<id>` evidence). */
export function withheldSources(panels: SelfPanel[], answers: Record<string, ConfirmAnswer>): Set<string> {
  const out = new Set<string>();
  for (const p of panels) for (const c of p.claims) if (answers[c.id] === 'no') for (const e of c.evidence) if (e.startsWith('claim:')) out.add(e.slice(6));
  return out;
}

export async function getSelfReading(deps: SelfDeps, userId: string): Promise<SelfReadingResult> {
  const prisma = deps.prisma;
  const kundli = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true, preferred_dasha: true } });
  if (!kundli) return { status: 'no_kundli' };
  const now = (deps.now ?? (() => new Date()))();
  const asOf = now.toISOString().slice(0, 10);
  const view = await (deps.loadDigest ?? realLoadDigest)(prisma, kundli.id);
  if (!view) {
    await (deps.queueDigest ?? defaultQueueDigest)(prisma, kundli.id).catch((e) => console.warn('[self] digest queue failed:', (e as Error).message));
    return { status: 'preparing' };
  }
  const present = await (deps.systemsPresent ?? defaultSystemsPresent)(prisma, kundli.id);
  const clock = resolveClock(kundli.preferred_dasha, present);
  const activationFor = deps.activationFor ?? realActivationFor;
  const systems = [clock.system, ...clock.confirming.map((c) => c.system)];
  const [life, nowRows] = await Promise.all([
    activationFor(prisma, kundli.id, { from: addMonthsIso(asOf, -12 * 90), to: addMonthsIso(asOf, 12 * 40), systems, maxLevel: 2 }),
    activationFor(prisma, kundli.id, { from: asOf, to: new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10), systems: [clock.system], maxLevel: 3 }),
  ]);
  const activation: ActivationRow[] = [...life, ...nowRows.filter((r) => r.level === 3)];
  const input: PanelInput = { view, asOf, clock, activation };
  const run = runningChain(activation, clock.system, asOf);
  const mudda = runningMudda(view, asOf);
  const muddaRow = mudda?.row.dashas.find((d) => d.system === 'mudda');
  const yearSpan = muddaRow ? span(muddaRow.periods.map((p) => p.from).sort()[0]!, muddaRow.periods.map((p) => p.to).sort().at(-1)!) : null;
  const periodSpan = (id: SelfPanelId): DateSpan | null => {
    const r = id === 'struggle' ? run.l3 ?? run.l2 ?? run.l1 : run.l2 ?? run.l1;
    return r ? span(r.from, r.to) : null;
  };
  const answers = await confirmAnswers(prisma, userId);
  const gapsAll: string[] = [];

  const runPanel = async (id: SelfPanelId, title: string, window: 'natal' | 'dasha' | 'annual', make: () => PanelBody): Promise<{ panel: SelfPanel; body: PanelBody | null }> => {
      const def = { title, window, run: make };
      const technique = `self.reading.${id}`;
      try {
        const out = await withTechniqueOutput<PanelBody & { ms: number }>(
          prisma,
          {
            technique,
            kundliId: kundli.id,
            digestVersion: `${view.version}|clock=${clock.system}|${SELF_READING_VERSION}`,
            context: { now, runningPeriod: def.window === 'dasha' ? periodSpan(id) : null, year: def.window === 'annual' ? yearSpan : null },
            agentId: SELF_PANEL_AGENT,
            userId,
            charts: charts(view, id, clock.system),
          },
          async () => {
            const value = await withAgentRun(
              prisma,
              SELF_PANEL_AGENT,
              { userId, task: `${technique} ${asOf}`, technique, kundliId: kundli.id, input: { panel: id, clock: clock.system, version: view.version } },
              async () => {
                const t0 = performance.now();
                const b = def.run();
                const ms = Math.round((performance.now() - t0) * 100) / 100;
                return { value: { ...b, ms }, output: { claims: b.claims.length, gaps: b.gaps.length, chapters: b.chapters?.length ?? 0 }, charts: charts(view, id, clock.system) };
              },
            );
            return { value, summary: { claims: value.claims.length, gaps: value.gaps.length } };
          },
        );
        const b = out.value;
        gapsAll.push(...b.gaps.map((g) => `${id}: ${g}`));
        const status: SelfPanel['status'] = b.claims.length === 0 ? 'withheld' : b.gaps.length ? 'partial' : 'ok';
        return { body: b, panel: { id, technique, title: def.title, lead: b.lead, status, claims: b.claims, ...(b.chapters ? { chapters: b.chapters } : {}), cached: out.cached, ms: out.cached ? 0 : b.ms } };
      } catch (e) {
        console.error(`[self] ${technique} failed:`, (e as Error).message);
        return { body: null, panel: { id, technique, title: def.title, lead: '', status: 'failed', claims: [], cached: false, ms: 0 } };
      }
  };

  const partIds = Object.keys(PANELS) as Array<keyof typeof PANELS>;
  const parts = await Promise.all(partIds.map((id) => runPanel(id, PANELS[id].title, PANELS[id].window, () => PANELS[id].run(input))));
  const bodies: PanelBodies = {};
  for (const r of parts) if (r.body) bodies[r.panel.id] = r.body;
  const diagnosis = await runPanel('diagnosis', DIAGNOSIS_TITLE, 'dasha', () => diagnosisPanel(bodies));
  const byId = new Map([diagnosis, ...parts].map((r) => [r.panel.id, r.panel] as const));
  const ordered = PANEL_ORDER.map((id) => byId.get(id)).filter((p): p is SelfPanel => !!p);
  const also = withheldSources(ordered, answers);
  const panels: SelfPanel[] = ordered.map((p) => ({ ...p, claims: shapeClaims(p.claims, answers, also) }));
  return {
    status: 'ok',
    built_at: asOf,
    cached: panels.every((p) => p.cached),
    reading: { asOf, digestVersion: view.version, clock, panels, question: pickQuestion(panels, answers), gaps: [...new Set(gapsAll)] },
  };
}

/** Sets or clears the kundli's reading clock; refuses a system with no stored periods. */
export async function setPreferredClock(deps: SelfDeps, userId: string, system: string | null): Promise<{ ok: true; clock: ReturnType<typeof resolveClock> } | { ok: false; error: 'no_kundli' | 'unknown_system' }> {
  const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { ok: false, error: 'no_kundli' };
  const present = await (deps.systemsPresent ?? defaultSystemsPresent)(deps.prisma, kundli.id);
  if (system !== null && !present.some((p) => p.system === system)) return { ok: false, error: 'unknown_system' };
  await deps.prisma.kundli.update({ where: { id: kundli.id }, data: { preferred_dasha: system } });
  return { ok: true, clock: resolveClock(system, present) };
}
