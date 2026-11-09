/**
 * The career map service (docs/reading-engine/42 §B.4, Phase 1): build once a day per kundli, store in `area_builds`,
 * relabel by the person's own facts (doc 45 rule 13, doc 48): a sub-area that does not fit their situation is not
 * shown (no "getting a job" for someone employed who did not say they are looking).
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { latestReadyBuild, refreshDue, storedValidity, validityOf, type ReadingValidity } from './validity.js';
import { runningYearSpan, shortestRunningPeriodSpan, withTechniqueOutput } from '../../techniques/outputStore.js';
import type { DateSpan } from '../../techniques/pieces.js';
import { activationFor as realActivationFor, type ActivationRow } from '../digest/activation.js';
import { loadDigest as realLoadDigest } from '../digest/load.js';
import { DIGEST_VERSION, type DigestView } from '../digest/types.js';
import { kundliInputs, type TimelineInputs } from '../timeline/inputs.js';
import { buildTimelineSpan } from '../timeline/pipeline.js';
import { addDaysIso, addMonthsIso, monthEnd, monthOf } from '../timeline/months.js';
import { careerMap, type CareerMap } from './career.js';
import { loadAreaFacts, loadTechniqueGovernance, recordTechniqueDecisions, resolveCareerShades } from './shadeResolver.js';

export const WORK_STATUS = ['yes', 'between_jobs', 'own_business', 'studying'] as const;
export type WorkStatus = (typeof WORK_STATUS)[number];

export interface CareerDeps {
  prisma: PrismaClient;
  /** tests: inputs without the database or the engine */
  loadInputs?: (kundliId: string, asOf: string, span: { from: string; to: string }) => Promise<TimelineInputs | null>;
  loadDigest?: (prisma: PrismaClient, kundliId: string) => Promise<DigestView | null>;
  activationFor?: (prisma: PrismaClient, kundliId: string, q: { from: string; to: string; maxLevel?: 1 | 2 | 3 }) => Promise<ActivationRow[]>;
  now?: () => Date;
}

export function careerSpan(asOf: string): { from: string; to: string } {
  const m = monthOf(asOf);
  return { from: `${addMonthsIso(`${m}-01`, -24).slice(0, 7)}-01`, to: addDaysIso(monthEnd(addMonthsIso(`${m}-01`, 24).slice(0, 7)), -1) };
}

/** Which sub-areas suit the person's work status (doc 43 §8.3 "what the level changes"). */
export function fitsStatus(subarea: string, status: WorkStatus | null): boolean {
  if (subarea === 'get_job') return status === 'between_jobs' || status === 'studying';
  if (subarea === 'promotion' || subarea === 'job_security') return status !== 'between_jobs' && status !== 'studying' && status !== 'own_business';
  if (subarea === 'business') return status === 'own_business' || status === null;
  return true;
}

export type CareerResult =
  | { status: 'no_kundli' }
  | { status: 'no_data'; notes: string[] }
  | ({ status: 'ok'; map: CareerMap; work: WorkStatus | null; built_at: string; cached: boolean; refresh_due: boolean } & ReadingValidity);

export async function getWorkStatus(prisma: PrismaClient, userId: string): Promise<WorkStatus | null> {
  const f = await prisma.personFact.findUnique({ where: { user_id_key: { user_id: userId, key: 'work.status' } } });
  return f && (WORK_STATUS as readonly string[]).includes(f.value) ? (f.value as WorkStatus) : null;
}

export async function setWorkStatus(prisma: PrismaClient, userId: string, value: string): Promise<boolean> {
  if (!(WORK_STATUS as readonly string[]).includes(value)) return false;
  const now = new Date();
  await prisma.personFact.upsert({
    where: { user_id_key: { user_id: userId, key: 'work.status' } },
    create: { user_id: userId, key: 'work.status', value, source: 'tapped', confirmed_at: now },
    update: { value, source: 'tapped', confirmed_at: now, updated_at: now },
  });
  return true;
}

/** The engine payloads a career build read (docs/admin/03 §4.1): the catalogue items it loaded and each contacts range. */
export function careerChartsRead(inputs: Pick<TimelineInputs, 'items' | 'contacts'>): ChartUsed[] {
  return [
    ...Object.keys(inputs.items).map((type) => ({ type })),
    ...inputs.contacts.filter((c) => typeof c?.from === 'string' && typeof c?.to === 'string').map((c) => ({ type: 'transit_contacts', variant: `${c.from}_${c.to}` })),
  ];
}

export async function getCareer(deps: CareerDeps, userId: string, opts: { force?: boolean } = {}): Promise<CareerResult> {
  const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { status: 'no_kundli' };
  const nowAt = (deps.now ?? (() => new Date()))();
  const asOf = nowAt.toISOString().slice(0, 10);
  const work = await getWorkStatus(deps.prisma, userId);
  const asOfDate = new Date(`${asOf}T00:00:00Z`);

  // offline first (docs/billing/03): the newest map is served whatever its day; `force` remakes it on request
  const cached = opts.force ? null : await latestReadyBuild(deps.prisma, kundli.id, 'career');
  const builtOn = cached ? cached.as_of.toISOString().slice(0, 10) : asOf;
  let map: CareerMap | null = null;
  let validity: ReadingValidity | null = null;
  if (cached) {
    const { validity: _v, ...rest } = cached.result as unknown as CareerMap & { validity?: unknown };
    map = rest as CareerMap;
    validity = storedValidity(cached.result, cached.created_at, builtOn);
  }
  let fresh = false;
  if (!map) {
    const span = careerSpan(asOf);
    const out = await withTechniqueOutput<CareerMap | null>(
      deps.prisma,
      {
        technique: 'work.present_tone',
        kundliId: kundli.id,
        digestVersion: DIGEST_VERSION,
        forceRefresh: Boolean(opts.force),
        context: { now: nowAt },
        agentId: 'area.career_map',
        userId,
      },
      async () => {
        const inputs = await withAgentRun(
          deps.prisma,
          'area.career_inputs',
          { userId, task: `inputs ${span.from}..${span.to}`, input: { span }, technique: 'work.present_tone', kundliId: kundli.id },
          async () => {
            const v = deps.loadInputs ? await deps.loadInputs(kundli.id, asOf, span) : await kundliInputs(deps.prisma, kundli.id, asOf, { span });
            return { value: v, output: v ? { contacts: v.contacts.length, items: Object.keys(v.items).length, notes: v.notes.length } : { missing: true }, charts: v ? careerChartsRead(v) : [] };
          },
        );
        if (!inputs) return { value: null, skipStore: true };
        let builtContext: { runningPeriod?: DateSpan | null; year?: DateSpan | null } = {};
        const builtMap = await withAgentRun(deps.prisma, 'area.career_map', { userId, task: `career ${asOf}`, technique: 'work.present_tone', kundliId: kundli.id }, async () => {
          const [view, activation, areaFacts] = await Promise.all([
            (deps.loadDigest ?? realLoadDigest)(deps.prisma, kundli.id).catch(() => null),
            (deps.activationFor ?? realActivationFor)(deps.prisma, kundli.id, { from: asOf, to: asOf, maxLevel: 3 }).catch(() => []),
            loadAreaFacts(deps.prisma, userId, 'career', { key: 'work.status', value: work }),
            loadTechniqueGovernance(deps.prisma),
          ]);
          builtContext = {
            runningPeriod: shortestRunningPeriodSpan(activation, nowAt),
            year: runningYearSpan(view, nowAt),
          };
          const build = buildTimelineSpan(inputs, span);
          const m = careerMap(build, asOf, view ? { view, activation } : undefined);
          const receipts = resolveCareerShades({
            map: m,
            view,
            facts: areaFacts,
          });
          const logged = await recordTechniqueDecisions(deps.prisma, { kundliId: kundli.id, userId }, receipts);
          const writes = logged > 0 ? ['area_builds:1', `technique_decision_logs:${logged}`] : ['area_builds:1'];
          return { value: m, output: { tone: m.present.tone, confidence: m.present.confidence, ahead: m.ahead.length, votes: m.present.votes.length, shades: receipts.length, writes } };
        });
        return { value: builtMap, context: builtContext };
      },
    );
    if (!out.value) return { status: 'no_data', notes: ['the chart facts are not ready yet'] };
    map = out.value;
    validity = validityOf(out, asOf);
    const stored = { ...map, validity } as unknown as object;
    await deps.prisma.areaBuild
      .upsert({
        where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: 'career', as_of: asOfDate } },
        create: { user_id: userId, kundli_id: kundli.id, area: 'career', as_of: asOfDate, status: 'ready', result: stored },
        update: { status: 'ready', result: stored, error: null },
      })
      .catch(() => undefined);
    fresh = !out.cached;
  }
  const shown: CareerMap = { ...map, ahead: map.ahead.filter((w) => fitsStatus(w.subarea, work)) };
  const v = validity ?? storedValidity(null, null, builtOn);
  return { status: 'ok', map: shown, work, built_at: builtOn, cached: !fresh, ...v, refresh_due: refreshDue(v.valid_until, asOf) };
}

/** The boards whose Looking-back answers are stored in `area_checks` (doc 45 §9; doc 54 §3 adds self and love). */
export const CHECK_AREAS = ['career', 'self', 'love'] as const;
export type CheckArea = (typeof CHECK_AREAS)[number];

export async function recordCheck(prisma: PrismaClient, userId: string, month: unknown, side: unknown, answer: unknown, area: CheckArea = 'career'): Promise<boolean> {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) return false;
  if (side !== 'support' && side !== 'test') return false;
  if (!['yes', 'partly', 'no', 'skip'].includes(String(answer))) return false;
  await prisma.areaCheck.upsert({
    where: { user_id_area_month: { user_id: userId, area, month } },
    create: { user_id: userId, area, month, side, answer: String(answer) },
    update: { side, answer: String(answer) },
  });
  return true;
}

export async function checksFor(prisma: PrismaClient, userId: string, area: CheckArea = 'career'): Promise<Record<string, string>> {
  const rows = await prisma.areaCheck.findMany({ where: { user_id: userId, area } });
  return Object.fromEntries(rows.map((r) => [r.month, r.answer]));
}
