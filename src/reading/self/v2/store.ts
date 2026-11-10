/**
 * Where the Self v2 build keeps its outputs (docs/reading-engine/66 §4.8 steps 6 and 8) and how the API reads them.
 *
 * - `technique_outputs`, technique `self.v2.oracle`: the validated Oracle document and the area briefs it was written
 *   over. Key (`digest_version` column): `self.v2.oracle|<digest>|clock=|main=|sub=|subsub=|sky=|year=|confirm=|in=<input
 *   hash>|p=<prompt hash>`.
 * - `technique_outputs`, technique `self.v2.personalizer`: the hero and cards, with the build frame (stamps, periods,
 *   year) the API's range lines read. Key: `self.v2.cards|clock=<clock>|o=<oracle key hash>|profile=<profile hash>|
 *   p=<personalizer prompt hash>`, so a profile change re-runs the Personalizer only, and a read can ask for one clock.
 *   The Oracle key carries `|clock=<clock>|` too: after a clock switch the API reads only the new clock's build.
 * - `area_builds`, area `self.v2`: today's build marker (building, ready, failed), so the API can tell pending from failed.
 *
 * Written through `withTechniqueOutput` (the helper service.ts uses); read here newest first.
 */
import type { PrismaClient } from '@prisma/client';
import type { AreaBrief, OracleV2Output, PersonalCardDoc, SelfV2CardsResult, SelfV2Frame, SelfV2OracleResult } from '../v2types.js';
import { normaliseEvidenceKey } from './slices.js';

/**
 * A stored Oracle document with one prefix per evidence key (`risk:risk:x` → `risk:x`): builds stored before the slice
 * fix of 2026-11-09 (doc 66 replay failure 10) read the same as new ones.
 */
export function normaliseStoredOracle(out: OracleV2Output | null): OracleV2Output | null {
  if (!out?.doc?.areas) return out;
  const fix = (ks: readonly string[] | undefined) => [...new Set((ks ?? []).map(normaliseEvidenceKey))];
  const areas = Object.fromEntries(Object.entries(out.doc.areas).map(([id, a]) => [id, a ? { ...a, evidence: fix(a.evidence) } : a])) as OracleV2Output['doc']['areas'];
  return { ...out, doc: { ...out.doc, areas }, patterns: (out.patterns ?? []).map((p) => ({ ...p, evidence: fix(p.evidence) })) };
}

/** Stored cards with their sources normalised the same way. */
export function normaliseStoredCards(doc: PersonalCardDoc | null): PersonalCardDoc | null {
  if (!doc?.cards) return doc;
  const cards = Object.fromEntries(
    Object.entries(doc.cards).map(([id, c]) => [id, c ? { ...c, sources: (c.sources ?? []).map(normaliseEvidenceKey), patterns: (c.patterns ?? []).map((p) => ({ ...p, source: normaliseEvidenceKey(p.source) })) } : c]),
  ) as PersonalCardDoc['cards'];
  return { ...doc, cards };
}

export const SELF_V2_ORACLE_TECHNIQUE = 'self.v2.oracle';
export const SELF_V2_PERSONALIZER_TECHNIQUE = 'self.v2.personalizer';
export const SELF_V2_HERO_TECHNIQUE = 'self.v2.hero';
export const SELF_V2_MARKER_AREA = 'self.v2';

/** the stored Oracle step: the result and the briefs it read */
export interface StoredSelfV2Oracle {
  key: string;
  result: SelfV2OracleResult;
  briefs: AreaBrief[];
}

/** the stored Personalizer step */
export interface StoredSelfV2Cards {
  key: string;
  oracleKey: string;
  result: SelfV2CardsResult;
  /** the build frame the API's range lines read (absent on rows stored before the final integration) */
  frame?: SelfV2Frame;
}

export interface SelfV2Latest {
  cards: PersonalCardDoc | null;
  oracle: OracleV2Output | null;
  briefs: AreaBrief[] | null;
  builtAt: string | null;
  status: 'ok' | 'pending' | 'failed';
  frame?: SelfV2Frame | null;
}

type Row = { output: unknown; created_at?: Date | string | null };
type StorePrisma = {
  techniqueOutput?: { findFirst?: (q: { where: Record<string, unknown>; orderBy: Record<string, 'asc' | 'desc'> }) => Promise<Row | null> };
  areaBuild?: {
    findFirst?: (q: { where: Record<string, unknown>; orderBy: Record<string, 'asc' | 'desc'> }) => Promise<{ status: string; error?: string | null } | null>;
    upsert?: (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  };
};

async function latestRow(prisma: PrismaClient, kundliId: string, technique: string, keyPrefix: string, clock?: string | null): Promise<Row | null> {
  const p = prisma as unknown as StorePrisma;
  // the Prisma delegate goes through the PII extension, which opens the sealed `output` column on read; no raw SQL here
  if (!p.techniqueOutput?.findFirst) return null;
  const key = clock ? { startsWith: keyPrefix, contains: `|clock=${clock}|` } : { startsWith: keyPrefix };
  return p.techniqueOutput.findFirst({ where: { kundli_id: kundliId, technique_id: technique, digest_version: key }, orderBy: { created_at: 'desc' } });
}

const iso = (d: Date | string | null | undefined): string | null => (d ? (d instanceof Date ? d : new Date(d)).toISOString() : null);

/**
 * The newest stored Self v2 build for a kundli, as the API serves it. `ok` when cards are stored; otherwise `failed` when
 * today's marker says the last build failed, else `pending`. With `clock`, only that clock's build is read (after a clock
 * switch the old clock's cards are not served as the new one's). Never throws.
 */
export async function readSelfV2Latest(prisma: PrismaClient, kundliId: string, clock?: string | null): Promise<SelfV2Latest> {
  try {
    const [cardsRow, oracleRow, marker] = await Promise.all([
      latestRow(prisma, kundliId, SELF_V2_PERSONALIZER_TECHNIQUE, 'self.v2.cards|', clock),
      latestRow(prisma, kundliId, SELF_V2_ORACLE_TECHNIQUE, 'self.v2.oracle|', clock),
      (prisma as unknown as StorePrisma).areaBuild?.findFirst?.({ where: { kundli_id: kundliId, area: SELF_V2_MARKER_AREA }, orderBy: { as_of: 'desc' } }) ?? Promise.resolve(null),
    ]);
    const storedCards = cardsRow?.output as StoredSelfV2Cards | undefined;
    const cards = normaliseStoredCards(storedCards?.result?.doc ?? null);
    const storedOracle = oracleRow?.output as StoredSelfV2Oracle | undefined;
    const status: SelfV2Latest['status'] = cards ? 'ok' : marker?.status === 'failed' ? 'failed' : 'pending';
    return {
      cards,
      oracle: normaliseStoredOracle(storedOracle?.result?.output ?? null),
      briefs: storedOracle?.briefs ?? null,
      builtAt: iso(cardsRow?.created_at ?? oracleRow?.created_at ?? null),
      status,
      frame: storedCards?.frame ?? null,
    };
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'self v2 store read failed', error: (e as Error).message?.slice(0, 200) }));
    return { cards: null, oracle: null, briefs: null, builtAt: null, status: 'pending', frame: null };
  }
}

const dayOf = (now: Date): Date => new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);

/**
 * Today's v2 build marker in `area_builds`. Never throws. `result`, when given, replaces the marker's result (the stage
 * writes, docs/loading-overlay/05); without it an update keeps the stored result.
 */
export async function writeSelfV2Marker(prisma: PrismaClient, userId: string, kundliId: string, now: Date, status: 'building' | 'ready' | 'failed', error?: string, result?: Record<string, unknown>): Promise<void> {
  try {
    const where = { kundli_id_area_as_of: { kundli_id: kundliId, area: SELF_V2_MARKER_AREA, as_of: dayOf(now) } };
    await (prisma as unknown as StorePrisma).areaBuild?.upsert?.({
      where,
      create: { user_id: userId, kundli_id: kundliId, area: SELF_V2_MARKER_AREA, as_of: dayOf(now), status, result: result ?? { started_at: now.toISOString() }, error: error ?? null },
      update: { status, error: error ?? null, ...(result ? { result } : {}) },
    });
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'self v2 marker write failed', status, error: (e as Error).message?.slice(0, 200) }));
  }
}

/** Today's v2 marker as the progress view reads it (docs/loading-overlay/05). Never throws. */
export async function readSelfV2Marker(prisma: PrismaClient, kundliId: string, now: Date): Promise<{ status: 'building' | 'ready' | 'failed' | null; stage: string | null; stageAt: string | null }> {
  try {
    const row = (await (prisma as unknown as { areaBuild?: { findUnique?: (q: unknown) => Promise<{ status: string; result: unknown } | null> } }).areaBuild?.findUnique?.({
      where: { kundli_id_area_as_of: { kundli_id: kundliId, area: SELF_V2_MARKER_AREA, as_of: dayOf(now) } },
    })) ?? null;
    if (!row) return { status: null, stage: null, stageAt: null };
    const r = (row.result ?? {}) as { stage?: unknown; stage_at?: unknown };
    const status = row.status === 'building' || row.status === 'ready' || row.status === 'failed' ? row.status : null;
    return { status, stage: typeof r.stage === 'string' ? r.stage : null, stageAt: typeof r.stage_at === 'string' ? r.stage_at : null };
  } catch {
    return { status: null, stage: null, stageAt: null };
  }
}
