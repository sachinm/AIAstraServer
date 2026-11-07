/**
 * Reading the digest (docs/reading-engine/53 §4.2, the DigestView of 54 §2). `loadDigest` returns null unless the
 * kundli's digest is ready; the rows are held in process for five minutes per (kundli, built_at), so a new build is
 * seen at once and a burst of readers costs one query.
 */
import type { PrismaClient } from '@prisma/client';
import { digestStatusOf } from './status.js';
import { DIGEST_VERSION, type AnnualRow, type DigestSection, type DigestSource, type DigestView, type HouseCard, type PlanetCard, type PointRow, type StarProfile, type YogaRow } from './types.js';

export { digestStatusOf } from './status.js';
export type { DigestView } from './types.js';

const MEMO_MS = 5 * 60_000;
const memo = new Map<string, { at: number; view: DigestView }>();

export function clearDigestMemo(): void {
  memo.clear();
}

export interface StoredDigestRow {
  section: string;
  key: string;
  row: unknown;
  source: unknown;
}

const vargaOrder = (v: string) => Number(v.replace(/^D/, '')) || 0;

/** A DigestView over stored rows (exported for tests and for callers that already hold the rows). */
export function digestView(kundliId: string, rows: readonly StoredDigestRow[], meta: { status?: DigestView['status']; version?: string; builtAt?: string | null } = {}): DigestView {
  const bySection = new Map<string, Map<string, StoredDigestRow>>();
  for (const r of rows) {
    if (!bySection.has(r.section)) bySection.set(r.section, new Map());
    bySection.get(r.section)!.set(r.key, r);
  }
  const all = <T>(section: DigestSection): T[] => [...(bySection.get(section)?.values() ?? [])].map((r) => r.row as T);
  const one = <T>(section: DigestSection, key: string): T | null => (bySection.get(section)?.get(key)?.row as T | undefined) ?? null;
  const houses = all<HouseCard>('house');
  const planets = all<PlanetCard>('planet');
  return {
    kundliId,
    status: meta.status ?? 'ready',
    version: meta.version ?? DIGEST_VERSION,
    builtAt: meta.builtAt ?? null,
    house: (varga, h) => one<HouseCard>('house', `${varga}.h${h}`),
    houses: (varga) => houses.filter((c) => c.varga === varga).sort((a, b) => a.house - b.house),
    planet: (varga, p) => one<PlanetCard>('planet', `${varga}.${p}`),
    planets: (varga) => planets.filter((c) => c.varga === varga),
    vargas: () => [...new Set([...houses.map((c) => c.varga), ...planets.map((c) => c.varga)])].sort((a, b) => vargaOrder(a) - vargaOrder(b)),
    yogas: () => all<YogaRow>('yoga'),
    points: (varga) => all<PointRow>('point').filter((p) => !varga || p.varga === varga),
    annual: (year) => all<AnnualRow>('annual').filter((a) => year == null || a.year === year).sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind) || vargaOrder(a.varga) - vargaOrder(b.varga)),
    star: () => one<StarProfile>('star', 'profile'),
    sourceOf: (section, key) => ((bySection.get(section)?.get(key)?.source as DigestSource[] | undefined) ?? []),
  };
}

/** The ready digest of a kundli, or null (not built, building, stale, failed, or another rule set). */
export async function loadDigest(prisma: PrismaClient, kundliId: string, now: number = Date.now()): Promise<DigestView | null> {
  const k = await prisma.kundli.findUnique({ where: { id: kundliId }, select: { digest_status: true, digest_version: true, digest_built_at: true } });
  if (!k || k.digest_status !== 'ready' || k.digest_version !== DIGEST_VERSION || !k.digest_built_at) return null;
  const builtAt = k.digest_built_at.toISOString();
  const memoKey = `${kundliId}|${builtAt}`;
  const hit = memo.get(memoKey);
  if (hit && now - hit.at < MEMO_MS) return hit.view;
  const rows = await prisma.kundliDigest.findMany({ where: { kundli_id: kundliId }, select: { section: true, key: true, row: true, source: true } });
  const view = digestView(kundliId, rows, { status: 'ready', version: k.digest_version, builtAt });
  for (const key of memo.keys()) if (key.startsWith(`${kundliId}|`) || now - memo.get(key)!.at >= MEMO_MS) memo.delete(key);
  memo.set(memoKey, { at: now, view });
  return view;
}

