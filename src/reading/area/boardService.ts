/**
 * The shared service behind the Self and Love boards (docs/reading-engine/54 §3), mirroring careerService: built once a
 * day per kundli into `area_builds` (area 'self' / 'love'), from the stored digest only. When the digest is not ready the
 * board says `preparing` and the digest is queued (`kundlis.digest_status = 'pending'` unless it is already building).
 * The person's own fact (`self.focus`, `love.status`, doc 48) picks the lead sub-area at read time and hides the
 * sub-areas that do not fit; the stored build is the same for every reading of the day.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { activationFor as realActivationFor, type ActivationRow } from '../digest/activation.js';
import { loadDigest as realLoadDigest } from '../digest/load.js';
import type { DigestView } from '../digest/types.js';
import { asRangePayload, type TransitRangePayload } from '../chartData/transitRange.js';
import { openRow } from '../../lib/pii/rawSql.js';
import { addMonthsIso } from '../timeline/months.js';
import { buildBoard, type AreaBoardBody, type AreaConfig, type BuiltBoard } from './houseLayers.js';

export interface BoardDeps {
  prisma: PrismaClient;
  loadDigest?: (prisma: PrismaClient, kundliId: string) => Promise<DigestView | null>;
  activationFor?: (prisma: PrismaClient, kundliId: string, q: { from: string; to: string; houses?: number[]; systems?: string[]; maxLevel?: 1 | 2 | 3 }) => Promise<ActivationRow[]>;
  /** the kundli's stored sky overlay covering asOf; null when none is stored (never fetched here) */
  loadTransit?: (prisma: PrismaClient, kundliId: string, asOf: string) => Promise<TransitRangePayload | null>;
  /** ask the digest sweep to build this kundli */
  queueDigest?: (prisma: PrismaClient, kundliId: string) => Promise<void>;
  now?: () => Date;
}

export interface AreaSpec {
  area: 'self' | 'love';
  cfg: AreaConfig;
  agent: 'area.self_board' | 'area.love_board';
  /** the board's lead technique id (src/techniques/catalog.ts) */
  technique: string;
  factKey: 'self.focus' | 'love.status';
  fits: (subarea: string, fact: string | null) => boolean;
  lead: (fact: string | null) => string | null;
}

export type AreaBoardResult =
  | { status: 'no_kundli' }
  | { status: 'preparing' }
  | { status: 'ok'; built_at: string; cached: boolean; focus: string | null; ask: boolean; board: AreaBoardBody };

const DECLINED = 'declined';

/** The years of activation the board reads: 12 months back (Looking back) to 30 years ahead (doc 53 §4.5). */
export function activationSpan(asOf: string): { from: string; to: string } {
  return { from: addMonthsIso(asOf, -13), to: addMonthsIso(asOf, 12 * 30) };
}

export async function defaultLoadTransit(prisma: PrismaClient, kundliId: string, asOf: string): Promise<TransitRangePayload | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ payload: unknown }>>`SELECT "payload" FROM "kundli_transit_overlays"
      WHERE "kundli_id" = ${kundliId} AND "kind" = 'range' AND "from_date" <= ${asOf}::date AND "to_date" >= ${asOf}::date
      ORDER BY "fetched_at" DESC LIMIT 1`;
    if (!rows[0]) return null;
    const opened = await openRow('kundli_transit_overlays', rows[0]);
    return asRangePayload(opened.payload);
  } catch (e) {
    console.warn('[area] sky overlay unreadable:', (e as Error).message);
    return null;
  }
}

export async function defaultQueueDigest(prisma: PrismaClient, kundliId: string): Promise<void> {
  await prisma.kundli.updateMany({ where: { id: kundliId, digest_status: { notIn: ['building', 'pending', 'ready'] } }, data: { digest_status: 'pending' } });
}

/** The digest sections a board build reads, for the run's `charts` (docs/admin/03 §4.1). */
export function boardChartsRead(view: DigestView, transit: boolean): ChartUsed[] {
  const v = view.version;
  return [
    ...(['house', 'planet', 'yoga', 'point', 'annual', 'star'] as const).map((s) => ({ type: `digest.${s}`, variant: v })),
    { type: 'kundli_activation', variant: v },
    ...(transit ? [{ type: 'transit_range', variant: 'overlay' }] : []),
  ];
}

export async function getFact(prisma: PrismaClient, userId: string, key: string): Promise<string | null> {
  const f = await prisma.personFact.findUnique({ where: { user_id_key: { user_id: userId, key } } });
  return f?.value ?? null;
}

/** What the person sees: the sub-areas that fit their fact, the lead first. */
export function shapeBoard(built: BuiltBoard, spec: AreaSpec, fact: string | null): { focus: string | null; board: AreaBoardBody } {
  const usable = fact === DECLINED ? null : fact;
  const ahead = built.board.ahead.filter((w) => spec.fits(w.subarea, usable));
  const present = [...new Set(ahead.map((w) => w.subarea))];
  let focus = spec.lead(usable);
  if (focus && !spec.fits(focus, usable)) focus = null;
  if (!focus) focus = present.sort((a, b) => (built.subareaScores[b] ?? 0) - (built.subareaScores[a] ?? 0))[0] ?? null;
  const order = spec.cfg.subareas.map((s) => s.id);
  const rank = (s: string) => (s === focus ? -1 : order.indexOf(s));
  ahead.sort((a, b) => rank(a.subarea) - rank(b.subarea) || a.from.localeCompare(b.from));
  return { focus, board: { ...built.board, ahead } };
}

export async function getAreaBoard(deps: BoardDeps, spec: AreaSpec, userId: string): Promise<AreaBoardResult> {
  const prisma = deps.prisma;
  const kundli = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { status: 'no_kundli' };
  const asOf = (deps.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  const fact = await getFact(prisma, userId, spec.factKey);

  const cached = await prisma.areaBuild.findUnique({ where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: spec.area, as_of: asOfDate } } });
  let built: BuiltBoard | null = cached?.status === 'ready' ? (cached.result as unknown as BuiltBoard) : null;
  let fresh = false;
  if (!built) {
    const view = await (deps.loadDigest ?? realLoadDigest)(prisma, kundli.id);
    if (!view) {
      await (deps.queueDigest ?? defaultQueueDigest)(prisma, kundli.id).catch((e) => console.warn('[area] digest queue failed:', (e as Error).message));
      return { status: 'preparing' };
    }
    const activationFor = deps.activationFor ?? realActivationFor;
    const span = activationSpan(asOf);
    built = await withAgentRun(
      prisma,
      spec.agent,
      { userId, task: `${spec.area} ${asOf}`, input: { span_from: span.from, span_to: span.to, version: view.version }, technique: spec.technique, kundliId: kundli.id },
      async () => {
        const [activation, running, transit] = await Promise.all([
          activationFor(prisma, kundli.id, { ...span, houses: spec.cfg.houses, maxLevel: 2 }),
          activationFor(prisma, kundli.id, { from: asOf, to: asOf, maxLevel: 3 }),
          (deps.loadTransit ?? defaultLoadTransit)(prisma, kundli.id, asOf),
        ]);
        const b = buildBoard({ view, cfg: spec.cfg, asOf, activation, running, transit });
        return {
          value: b,
          output: { tone: b.board.tone.tone, confidence: b.board.tone.confidence, supports: b.board.supports.length, pressures: b.board.pressures.length, ahead: b.board.ahead.length, ...b.counts },
          charts: boardChartsRead(view, transit !== null),
        };
      },
    );
    await prisma.areaBuild
      .upsert({
        where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: spec.area, as_of: asOfDate } },
        create: { user_id: userId, kundli_id: kundli.id, area: spec.area, as_of: asOfDate, status: 'ready', result: built as unknown as object },
        update: { status: 'ready', result: built as unknown as object, error: null },
      })
      .catch(() => undefined);
    fresh = true;
  }
  const shaped = shapeBoard(built, spec, fact);
  return { status: 'ok', built_at: asOf, cached: !fresh, focus: shaped.focus, ask: fact === null, board: shaped.board };
}
