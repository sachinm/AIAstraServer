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
import { yearPanel, runningMudda, runningTp } from './panels/year.js';
import {
  heartPanel,
  partnerPanel,
  bondPanel,
  circlePanel,
  loveChaptersPanel,
  loveStrugglePanel,
  loveYearPanel,
  loveDiagnosisPanel,
} from './panels/love.js';
import {
  vocationPanel,
  standingPanel,
  groundPanel,
  gainPanel,
  workChaptersPanel,
  workStrugglePanel,
  workYearPanel,
  workDiagnosisPanel,
} from './panels/work.js';
import { runningChain } from './slices.js';
import {
  SELF_PANEL_IDS,
  LOVE_PANEL_IDS,
  WORK_PANEL_IDS,
  type BoardPanelId,
  type ConfirmAnswer,
  type LovePanelId,
  type PanelBody,
  type ReadingBoardId,
  type SelfClaim,
  type SelfPanel,
  type SelfPanelId,
  type SelfQuestion,
  type SelfReading,
  type WorkPanelId,
} from './types.js';
import { diagnosisPanel, type PanelBodies } from './panels/diagnosis.js';
import { BODY_NOTE, CONFIRM_BY_HOUSE, longDate } from './words.js';
import { bodyPanel } from './panels/body.js';
import { applyPurview, runPurview } from './purview.js';
import { buildCard } from './card.js';
import { auditCards } from './audit.js';
import { buildDossier, collectData, writeDossier, type DossierInput } from './dossier.js';
import { runSelfOracle, type SelfOracleContext, type SelfOracleResult } from './oracle.js';
import { defaultLoadTransit } from '../area/boardService.js';
import type { TransitRangePayload } from '../chartData/transitRange.js';

export const SELF_PANEL_AGENT = 'self.reading_panel';
export const LOVE_PANEL_AGENT = 'love.reading_panel';
export const WORK_PANEL_AGENT = 'work.reading_panel';
/** Bump when panel code or words change: it is part of every stored output's key, so old wording is never served. */
export const SELF_READING_VERSION = 's2.2026-11-08c';

/** Titles and freshness of every panel (docs/reading-engine/61 §2). */
export const PANEL_META: Record<Exclude<SelfPanelId, 'diagnosis'>, { title: string; window: 'natal' | 'dasha' | 'annual' }> = {
  chapters: { title: 'Your chapters', window: 'dasha' },
  lagna: { title: 'Who you are', window: 'natal' },
  mind: { title: 'Your mind', window: 'natal' },
  body: { title: 'Your body', window: 'dasha' },
  atma: { title: "Your soul's aim", window: 'natal' },
  yogas: { title: 'Gifts and knots', window: 'natal' },
  struggle: { title: 'What you struggle with', window: 'dasha' },
  year: { title: 'This year', window: 'annual' },
};

export const LOVE_PANEL_META: Record<Exclude<LovePanelId, 'diagnosis'>, { title: string; window: 'natal' | 'dasha' | 'annual' }> = {
  chapters: { title: 'Your love chapters', window: 'dasha' },
  heart: { title: 'How you love', window: 'natal' },
  partner: { title: 'Who you draw in', window: 'natal' },
  bond: { title: 'What holds a bond', window: 'natal' },
  circle: { title: 'Family, children and friends', window: 'natal' },
  struggle: { title: 'What tests love', window: 'dasha' },
  year: { title: 'Love this year', window: 'annual' },
};

export const WORK_PANEL_META: Record<Exclude<WorkPanelId, 'diagnosis'>, { title: string; window: 'natal' | 'dasha' | 'annual' }> = {
  chapters: { title: 'Your work chapters', window: 'dasha' },
  vocation: { title: 'What you are built to do', window: 'natal' },
  standing: { title: 'How your work is seen', window: 'natal' },
  ground: { title: 'Daily craft and competition', window: 'natal' },
  gain: { title: 'Income, savings and wealth', window: 'natal' },
  struggle: { title: 'What tests your work', window: 'dasha' },
  year: { title: 'Work this year', window: 'annual' },
};

/** The part, spine, struggle and year panels; the diagnosis is built after them from their claims. */
export const PANELS: Record<Exclude<SelfPanelId, 'diagnosis' | 'body'>, { title: string; run: (i: PanelInput) => PanelBody; window: 'natal' | 'dasha' | 'annual' }> = {
  lagna: { title: 'Who you are', run: lagnaPanel, window: 'natal' },
  mind: { title: 'Your mind', run: mindPanel, window: 'natal' },
  atma: { title: "Your soul's aim", run: atmaPanel, window: 'natal' },
  yogas: { title: 'Gifts and knots', run: yogasPanel, window: 'natal' },
  struggle: { title: 'What you struggle with', run: strugglePanel, window: 'dasha' },
  chapters: { title: 'Your chapters', run: chaptersPanel, window: 'dasha' },
  year: { title: 'This year', run: yearPanel, window: 'annual' },
};

export const LOVE_PANELS: Record<Exclude<LovePanelId, 'diagnosis'>, { title: string; run: (i: PanelInput) => PanelBody; window: 'natal' | 'dasha' | 'annual' }> = {
  heart: { title: 'How you love', run: heartPanel, window: 'natal' },
  partner: { title: 'Who you draw in', run: partnerPanel, window: 'natal' },
  bond: { title: 'What holds a bond', run: bondPanel, window: 'natal' },
  circle: { title: 'Family, children and friends', run: circlePanel, window: 'natal' },
  struggle: { title: 'What tests love', run: loveStrugglePanel, window: 'dasha' },
  chapters: { title: 'Your love chapters', run: loveChaptersPanel, window: 'dasha' },
  year: { title: 'Love this year', run: loveYearPanel, window: 'annual' },
};

export const WORK_PANELS: Record<Exclude<WorkPanelId, 'diagnosis'>, { title: string; run: (i: PanelInput) => PanelBody; window: 'natal' | 'dasha' | 'annual' }> = {
  vocation: { title: 'What you are built to do', run: vocationPanel, window: 'natal' },
  standing: { title: 'How your work is seen', run: standingPanel, window: 'natal' },
  ground: { title: 'Daily craft and competition', run: groundPanel, window: 'natal' },
  gain: { title: 'Income, savings and wealth', run: gainPanel, window: 'natal' },
  struggle: { title: 'What tests your work', run: workStrugglePanel, window: 'dasha' },
  chapters: { title: 'Your work chapters', run: workChaptersPanel, window: 'dasha' },
  year: { title: 'Work this year', run: workYearPanel, window: 'annual' },
};

export const PANEL_ORDER: SelfPanelId[] = [...SELF_PANEL_IDS];
export const LOVE_PANEL_ORDER: LovePanelId[] = [...LOVE_PANEL_IDS];
export const WORK_PANEL_ORDER: WorkPanelId[] = [...WORK_PANEL_IDS];
const DIAGNOSIS_TITLE = 'In short';
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
  /** the stored sky overlay covering today; null when none is stored (never fetched here) */
  loadTransit?: (prisma: PrismaClient, kundliId: string, asOf: string) => Promise<TransitRangePayload | null>;
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

function charts(view: DigestView, id: BoardPanelId, clock: string): ChartUsed[] {
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
    const said = (tension.line ?? tension.text).replace(/^The (tension|knot) in it: /, '');
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

export interface SelfReadingOptions {
  /** why this build runs (docs/reading-engine/60 §6); a lab run is 'manual' and always writes its dossier */
  trigger?: DossierInput['trigger'];
  /** skip the stored outputs and make every panel (lab) */
  force?: boolean;
  /** run one technique only (lab); the diagnosis brings its four inputs */
  only?: BoardPanelId;
  /** build as of this day (lab), YYYY-MM-DD; default today */
  asOf?: string;
}

export async function getSelfReading(deps: SelfDeps, userId: string, opts: SelfReadingOptions = {}): Promise<SelfReadingResult> {
  return getBoardReading(deps, userId, 'self', opts);
}

export async function getLoveReading(deps: SelfDeps, userId: string, opts: SelfReadingOptions = {}): Promise<SelfReadingResult> {
  return getBoardReading(deps, userId, 'love', opts);
}

export async function getWorkReading(deps: SelfDeps, userId: string, opts: SelfReadingOptions = {}): Promise<SelfReadingResult> {
  return getBoardReading(deps, userId, 'work', opts);
}

export async function getBoardReading(
  deps: SelfDeps,
  userId: string,
  board: ReadingBoardId,
  opts: SelfReadingOptions = {},
): Promise<SelfReadingResult> {
  const prisma = deps.prisma;
  const panelAgent = board === 'love' ? LOVE_PANEL_AGENT : board === 'work' ? WORK_PANEL_AGENT : SELF_PANEL_AGENT;
  const prefix = `${board}.reading`;
  const kundli = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true, preferred_dasha: true } });
  if (!kundli) return { status: 'no_kundli' };
  const now = opts.asOf ? new Date(`${opts.asOf}T12:00:00Z`) : (deps.now ?? (() => new Date()))();
  const t0 = performance.now();
  const lap = (() => { let last = t0; return () => { const t = performance.now(); const ms = Math.round((t - last) * 100) / 100; last = t; return ms; }; })();
  const asOf = now.toISOString().slice(0, 10);
  const view = await (deps.loadDigest ?? realLoadDigest)(prisma, kundli.id);
  if (!view) {
    await (deps.queueDigest ?? defaultQueueDigest)(prisma, kundli.id).catch((e) => console.warn(`[${board}] digest queue failed:`, (e as Error).message));
    return { status: 'preparing' };
  }
  const present = await (deps.systemsPresent ?? defaultSystemsPresent)(prisma, kundli.id);
  const clock = await withAgentRun(
    prisma,
    panelAgent,
    { userId, task: `${prefix}.clock ${asOf}`, technique: `${prefix}.clock`, kundliId: kundli.id, input: { systems: present.length, trigger: opts.trigger ?? 'request' } },
    async () => {
      const c = resolveClock(kundli.preferred_dasha, present);
      return { value: c, output: { system: c.system, confirming: c.confirming.length }, charts: [{ type: 'kundli_activation', variant: c.system }] };
    },
  );
  const activationFor = deps.activationFor ?? realActivationFor;
  const allSystems = [...new Set([clock.system, ...clock.confirming.map((c) => c.system), ...present.map((p) => p.system)])];
  const tomorrowIso = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const activation = await activationFor(prisma, kundli.id, {
    from: addMonthsIso(asOf, -12 * 90),
    to: addMonthsIso(asOf, 12 * 40),
    systems: allSystems,
    maxLevel: 2,
    shortFrom: asOf,
    shortTo: tomorrowIso,
    shortSystems: allSystems,
    shortMaxLevel: 3,
  });
  const input: PanelInput = { view, asOf, clock, activation };
  const run = runningChain(activation, clock.system, asOf);
  const mudda = runningMudda(view, asOf);
  const tpRow = runningTp(view, asOf, mudda?.row.year);
  const muddaRow = mudda?.row.dashas.find((d) => d.system === 'mudda');
  const yearSpan = muddaRow ? span(muddaRow.periods.map((p) => p.from).sort()[0]!, muddaRow.periods.map((p) => p.to).sort().at(-1)!) : null;
  const periodSpan = (_id: BoardPanelId): DateSpan | null => {
    const r = run.l2 ?? run.l1;
    return r ? span(r.from, r.to) : null;
  };
  const defaultValidUntil = (id: BoardPanelId, window: 'natal' | 'dasha' | 'annual'): string => {
    if (window === 'natal') return 'always';
    if (window === 'annual') return yearSpan ? iso(yearSpan.to) : 'always';
    const ps = periodSpan(id);
    return ps ? iso(ps.to) : 'always';
  };
  const [answers, sky] = await Promise.all([confirmAnswers(prisma, userId), (deps.loadTransit ?? defaultLoadTransit)(prisma, kundli.id, asOf).catch(() => null)]);
  const skyStored = sky !== null;
  const gapsAll: string[] = [];

  const runPanel = async (id: BoardPanelId, title: string, window: 'natal' | 'dasha' | 'annual', make: () => PanelBody): Promise<{ panel: SelfPanel; body: PanelBody | null }> => {
    const def = { title, window, run: make };
    const technique = `${prefix}.${id}`;
    const extraKey = id === 'year' ? `|tp=${tpRow?.year ?? 'none'}` : id === 'body' ? `|sky=${skyStored ? '1' : '0'}|tp=${tpRow?.year ?? 'none'}` : '';
    try {
      const made = async () => {
        const value = await withAgentRun(
          prisma,
          panelAgent,
          { userId, task: `${technique} ${asOf}`, technique, kundliId: kundli.id, input: { panel: id, clock: clock.system, version: view.version, trigger: opts.trigger ?? 'request' } },
          async () => {
            const t0 = performance.now();
            const b = def.run();
            const ms = Math.round((performance.now() - t0) * 100) / 100;
            return { value: { ...b, ms }, output: { claims: b.claims.length, gaps: b.gaps.length, chapters: b.chapters?.length ?? 0 }, charts: charts(view, id, clock.system) };
          },
        );
        return { value, summary: { claims: value.claims.length, gaps: value.gaps.length } };
      };
      const out = await withTechniqueOutput<PanelBody & { ms: number }>(
        prisma,
        {
          technique,
          kundliId: kundli.id,
          digestVersion: `${view.version}|clock=${clock.system}${extraKey}|${SELF_READING_VERSION}`,
          context: { now, runningPeriod: def.window === 'dasha' ? periodSpan(id) : null, year: def.window === 'annual' ? yearSpan : null },
          agentId: panelAgent,
          userId,
          charts: charts(view, id, clock.system),
          forceRefresh: Boolean(opts.force),
        },
        made,
      );
      const b = out.value;
      gapsAll.push(...b.gaps.map((g) => `${id}: ${g}`));
      const status: SelfPanel['status'] = b.claims.length === 0 ? 'withheld' : b.gaps.length ? 'partial' : 'ok';
      return {
        body: b,
        panel: {
          id,
          technique,
          title: def.title,
          lead: b.lead,
          status,
          claims: b.claims,
          ...(b.chapters ? { chapters: b.chapters } : {}),
          cached: out.cached,
          ms: out.cached ? 0 : b.ms,
          headerRange: 'always',
          lines: [],
          validUntil: defaultValidUntil(id, def.window),
        },
      };
    } catch (e) {
      console.error(`[${board}] ${technique} failed:`, (e as Error).message);
      return { body: null, panel: { id, technique, title: def.title, lead: '', status: 'failed', claims: [], cached: false, ms: 0, headerRange: 'always', lines: [] } };
    }
  };

  // the parts; a lab run of one technique runs only that panel (and the diagnosis's inputs when it is the diagnosis)
  const sensitive = isSensitive(activation, clock.system, asOf);
  let runners: Record<string, () => PanelBody>;
  let metaMap: Record<string, { title: string; window: 'natal' | 'dasha' | 'annual' }>;
  let panelOrder: BoardPanelId[];
  let diagInputs: BoardPanelId[];
  let buildDiagnosis: (b: PanelBodies) => PanelBody;

  if (board === 'love') {
    runners = Object.fromEntries(
      (Object.keys(LOVE_PANELS) as Array<keyof typeof LOVE_PANELS>).map((id) => [id, () => LOVE_PANELS[id].run(input)]),
    );
    metaMap = LOVE_PANEL_META;
    panelOrder = LOVE_PANEL_ORDER;
    diagInputs = ['heart', 'partner', 'struggle', 'chapters'];
    buildDiagnosis = loveDiagnosisPanel;
  } else if (board === 'work') {
    runners = Object.fromEntries(
      (Object.keys(WORK_PANELS) as Array<keyof typeof WORK_PANELS>).map((id) => [id, () => WORK_PANELS[id].run(input)]),
    );
    metaMap = WORK_PANEL_META;
    panelOrder = WORK_PANEL_ORDER;
    diagInputs = ['vocation', 'standing', 'struggle', 'chapters'];
    buildDiagnosis = workDiagnosisPanel;
  } else {
    runners = {
      ...(Object.fromEntries((Object.keys(PANELS) as Array<keyof typeof PANELS>).map((id) => [id, () => PANELS[id].run(input)])) as Record<keyof typeof PANELS, () => PanelBody>),
      body: () => bodyPanel(input, { sensitive, skyStored, sky }),
    };
    metaMap = PANEL_META;
    panelOrder = PANEL_ORDER;
    diagInputs = ['lagna', 'struggle', 'yogas', 'chapters'];
    buildDiagnosis = diagnosisPanel;
  }

  const wanted = (id: BoardPanelId) => !opts.only || opts.only === id || (opts.only === 'diagnosis' && diagInputs.includes(id));
  const partIds = (Object.keys(runners) as BoardPanelId[]).filter(wanted);
  const loadMs = lap();
  const parts = await Promise.all(partIds.map((id) => runPanel(id, metaMap[id]!.title, metaMap[id]!.window, runners[id]!)));
  const bodies: PanelBodies = {};
  for (const r of parts) if (r.body) bodies[r.panel.id] = { ...r.body, claims: [...r.body.claims] };

  // the whole-chart purview over the parts, then the diagnosis from what survives it
  const panelsMs = lap();
  const purview = await withAgentRun(
    prisma,
    panelAgent,
    { userId, task: `${prefix}.purview ${asOf}`, technique: `${prefix}.purview`, kundliId: kundli.id, input: { panels: Object.keys(bodies).length, clock: clock.system } },
    async () => {
      const p = runPurview({ board, view, activation, asOf, clock, bodies, skyStored, sky });
      return { value: p, output: { entries: p.entries.length, sensitive: p.sensitive ? 1 : 0 }, charts: [{ type: 'digest.house', variant: view.version }, { type: 'digest.planet', variant: view.version }, { type: 'kundli_activation', variant: clock.system }] };
    },
  );
  const vetoed = applyPurview(bodies, purview.entries);
  const diagnosis = wanted('diagnosis') ? await runPanel('diagnosis', DIAGNOSIS_TITLE, 'dasha', () => buildDiagnosis(bodies)) : null;
  if (diagnosis?.body) bodies.diagnosis = diagnosis.body;

  // cards, shaped by the person's answers
  const cardCtx = { running: { l1: run.l1, l2: run.l2 }, year: yearSpan ? { from: iso(yearSpan.from), to: iso(yearSpan.to) } : null };
  const byId = new Map([...(diagnosis ? [diagnosis] : []), ...parts].map((r) => [r.panel.id, r.panel] as const));
  const ordered = panelOrder.map((id) => byId.get(id)).filter((p): p is SelfPanel => !!p);
  const withPurview = ordered.map((p) => ({
    ...p,
    lead: bodies[p.id]?.lead ?? p.lead,
    claims: bodies[p.id]?.claims ?? p.claims,
  }));
  const also = withheldSources(withPurview, answers);
  const purviewMs = lap();
  const shaped: SelfPanel[] = withPurview.map((p) => {
    const claims = shapeClaims(p.claims, answers, also);
    const card = buildCard(p.id, { lead: p.lead, claims, gaps: [], chapters: p.chapters }, cardCtx);
    gapsAll.push(...card.gaps);
    const status: SelfPanel['status'] = p.status === 'failed' ? 'failed' : card.lines.length === 0 ? 'withheld' : p.status;
    return {
      ...p,
      lead: card.lead,
      claims,
      status,
      headerRange: card.headerRange,
      lines: card.lines,
      ...(p.id === 'body' ? { note: BODY_NOTE } : {}),
      ...(vetoed[p.id]?.length ? { vetoed: vetoed[p.id] } : {}),
    };
  });

  // the code auditor over the cards, against the rows the dossier resolves
  const allClaims = new Map<string, string[]>();
  for (const p of shaped) for (const c of p.claims) allClaims.set(c.id, c.evidence);
  for (const v of Object.values(vetoed).flat()) if (v) allClaims.set(v.claimId, []);
  const { data } = collectData({ view, activation, panels: shaped, purview: purview.entries });
  const boundaries = new Set<string>([...activation.flatMap((r) => [r.from, r.to]), ...view.annual().flatMap((a) => a.dashas.flatMap((d) => d.periods.flatMap((pp) => [pp.from, pp.to])))]);
  const cardsMs = lap();
  const audited = await withAgentRun(
    prisma,
    panelAgent,
    { userId, task: `${prefix}.audit ${asOf}`, technique: `${prefix}.audit`, kundliId: kundli.id, input: { panels: shaped.length, claims: allClaims.size } },
    async () => {
      const a = auditCards({ panels: shaped, claims: allClaims, vetoed: new Set(Object.values(vetoed).flat().map((v) => v!.claimId)), resolvedKeys: new Set(Object.keys(data)), boundaries });
      return { value: a, output: { verdict: a.audit.verdict, checked: a.audit.checked, failures: a.audit.failures.length }, charts: [{ type: 'digest.house', variant: view.version }] };
    },
  );
  let panels = audited.panels.map((p) => (p.lines.length === 0 && p.status !== 'failed' ? { ...p, status: 'withheld' as const } : p));

  const auditMs = lap();
  const defaultValidTo = (run.l2 ?? run.l1)?.to ?? null;

  const baseReading: SelfReading = {
    asOf,
    digestVersion: view.version,
    clock,
    panels,
    question: pickQuestion(panels, answers),
    gaps: [...new Set(gapsAll)],
    purview: purview.entries,
    audit: audited.audit,
    dossierId: null,
    builtLine: `Built ${longDate(asOf)}${defaultValidTo ? `, next check ${longDate(defaultValidTo)}` : ''}`,
    validUntil: defaultValidTo ?? 'always',
  };

  const oracleCtx: SelfOracleContext = {
    prisma,
    board,
    userId,
    kundliId: kundli.id,
    view,
    activation,
    sky,
    now,
    force: opts.force,
    only: opts.only,
    codeVersion: SELF_READING_VERSION,
    runningSpan: periodSpan('chapters'),
  };
  const oracle: SelfOracleResult = await runSelfOracle(baseReading, answers, oracleCtx);
  const oracleTotalMs = lap();

  // Apply AI-determined validUntil and AI-synthesized panel lines when oracle ran
  if (oracle.status === 'ok') {
    panels = panels.map((p) => {
      const aiValid = oracle.validUntil?.[p.id];
      const aiLines = oracle.panelLines?.[p.id] ?? [];
      const fallbackClaimIds = p.claims.filter((c) => !c.withheld).map((c) => c.id);
      const mergedAiLines = aiLines
        .map((al, i) => ({
          id: `${p.id}.ai.${i + 1}`,
          text: al.text,
          range: al.range && al.range !== 'always' ? al.range : p.headerRange,
          claimIds: fallbackClaimIds.length ? [fallbackClaimIds[0]!] : p.lines[0]?.claimIds ?? [],
          certainty: al.certainty ?? ('strong' as const),
          detail: al.detail ?? 'AI multi-chart synthesis',
        }))
        .filter((al) => al.claimIds.length > 0 && !p.lines.some((existing) => existing.text === al.text));
      const allLines = mergedAiLines.length ? [...p.lines, ...mergedAiLines] : p.lines;
      let headerRange = p.headerRange;
      if (headerRange !== 'always' && p.id !== 'chapters') {
        let from = headerRange.from;
        let to = headerRange.to;
        for (const l of allLines) {
          if (l.range !== 'always') {
            if (l.range.from < from) from = l.range.from;
            if (l.range.to > to) to = l.range.to;
          }
        }
        headerRange = { from, to };
      }
      return {
        ...p,
        headerRange,
        ...(aiValid ? { validUntil: aiValid } : {}),
        lines: allLines,
      };
    });
  }

  const aiOverallValidTo =
    oracle.validUntil?.overall && oracle.validUntil.overall !== 'always'
      ? oracle.validUntil.overall
      : defaultValidTo;
  const validTo = aiOverallValidTo;

  const oracleAgentId = `${board}.reading_oracle`;
  const linemenMs = Math.round(
    (oracle.stages ?? [])
      .filter((s) => s.agentId !== oracleAgentId)
      .reduce((acc, s) => acc + (s.ms ?? 0), 0) * 100,
  ) / 100;
  const oracleStageMs =
    (oracle.stages ?? []).find((s) => s.agentId === oracleAgentId)?.ms ?? oracle.ms ?? oracleTotalMs;

  const targetScope = opts.only ?? 'all';
  const fresh = panels.some((p) => !p.cached) || (oracle.status === 'ok' && !oracle.cached);
  let dossierId: string | null = null;
  if (fresh || opts.trigger === 'manual') {
    const dIn: DossierInput = {
      kundliId: kundli.id,
      board,
      trigger: opts.trigger ?? 'request',
      view,
      activation,
      asOf,
      validTo,
      clock,
      codeVersion: SELF_READING_VERSION,
      panels,
      purview: purview.entries,
      gaps: [...new Set(gapsAll)],
      audit: audited.audit,
      steps: {
        loadMs,
        panelsMs,
        purviewMs,
        cardsMs,
        ...(oracle.status !== 'off'
          ? {
              linemenMs,
              briefMs: 1,
              oracleMs: oracleStageMs,
              validatorMs: 1,
            }
          : {}),
        auditMs,
      },
      scope: targetScope,
      ...(oracle.status !== 'off' ? { oracle } : {}),
    };
    dossierId = await writeDossier(prisma, dIn, buildDossier(dIn));
  } else {
    const asOfDate = new Date(`${asOf}T00:00:00Z`);
    const recent = await prisma.readingDossier
      ?.findMany?.({
        where: { kundli_id: kundli.id, board, as_of: asOfDate },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { id: true, audit: true },
      })
      .catch(() => null);
    const matching = recent?.find((r) => (((r.audit as { scope?: string } | null)?.scope) ?? 'all') === targetScope);
    if (matching) {
      dossierId = matching.id;
    } else {
      dossierId =
        (
          await prisma.readingDossier
            ?.findFirst?.({
              where: { kundli_id: kundli.id, board, as_of: asOfDate },
              orderBy: { created_at: 'desc' },
              select: { id: true },
            })
            .catch(() => null)
        )?.id ?? null;
    }
  }
  return {
    status: 'ok',
    built_at: asOf,
    cached: panels.every((p) => p.cached) && (oracle.status === 'off' || Boolean(oracle.cached)),
    reading: {
      ...baseReading,
      panels,
      dossierId,
      builtLine: `Built ${longDate(asOf)}${validTo ? `, next check ${longDate(validTo)}` : ''}`,
      validUntil: validTo ?? 'always',
      ...(oracle.status !== 'off' ? { oracle } : {}),
    },
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** A sensitive passage is running (docs/reading-engine/60 §4, 61 §4): the sub-period lord is Ketu, or Saturn over 8 and 12. */
export function isSensitive(activation: readonly ActivationRow[], system: string, asOf: string): boolean {
  const l2 = runningChain(activation, system, asOf).l2;
  return !!l2 && (l2.lord === 'Ke' || (l2.lord === 'Sa' && l2.houses.includes(8) && l2.houses.includes(12)));
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
