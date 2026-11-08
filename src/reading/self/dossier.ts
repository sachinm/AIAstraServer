/**
 * The research dossier of one You reading build (docs/reading-engine/60 §3): every technique with its contract hash and
 * code version, every rule the purview applied with its source, every row the claims rest on with its value as read (so
 * the dossier stands alone after a digest rebuild), all present yogas, the clocks, the cards, the gaps and the code
 * audit. One row per kundli, board and build content (`bundle_hash`): an unchanged rebuild writes nothing new.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { contractHash, canonicalJson } from '../../techniques/pieces.js';
import { techniqueById } from '../../techniques/catalog.js';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import type { CodeAudit, PurviewEntry, SelfClock, SelfPanel } from './types.js';

/** Resolves an evidence key to the stored row it names. Unknown keys return undefined. */
export function resolveKey(key: string, view: DigestView, activation: readonly ActivationRow[]): unknown {
  const [kind, rest = ''] = key.split(/:(.*)/s);
  const dot = rest.indexOf('.');
  const varga = rest.slice(0, dot);
  const id = rest.slice(dot + 1);
  switch (kind) {
    case 'planet':
      return view.planet(varga, id) ?? undefined;
    case 'house':
      return view.house(varga, Number(id.replace(/^h/, ''))) ?? undefined;
    case 'point':
      return view.points(varga).find((p) => p.id === id);
    case 'yoga':
      return view.yogas().find((y) => y.id === id);
    case 'star':
      return view.star() ?? undefined;
    case 'annual': {
      const m = /^(TP|VP)(\d{4})\.(D\d+)$/.exec(rest);
      return m ? view.annual(Number(m[2])).find((r) => r.kind === m[1] && r.varga === m[3]) : undefined;
    }
    case 'activation': {
      const m = /^([^/]+)\/(\d)\/([^@]+)@(.+)$/.exec(rest);
      return m ? activation.find((r) => r.system === m[1] && r.level === Number(m[2]) && (r.lord ?? r.sign) === m[3] && r.from === m[4]) : undefined;
    }
    default:
      return undefined;
  }
}

export interface DossierInput {
  kundliId: string;
  board: 'self';
  trigger: 'request' | 'manual' | 'digest' | 'dasha_boundary' | 'annual' | 'confirm';
  view: DigestView;
  activation: readonly ActivationRow[];
  asOf: string;
  validTo: string | null;
  clock: SelfClock;
  codeVersion: string;
  panels: SelfPanel[];
  purview: PurviewEntry[];
  gaps: string[];
  audit: CodeAudit;
}

export interface DossierRecord {
  techniques: Array<{ id: string; contractHash: string | null; codeVersion: string; cached: boolean; ms: number; status: string }>;
  rules: PurviewEntry[];
  data: Record<string, unknown>;
  yogas: unknown[];
  clocks: Record<string, unknown>;
  panels: unknown[];
  gaps: string[];
  audit: CodeAudit;
  bundleHash: string;
}

/** The evidence keys every claim and purview rule of the build names, resolved; `claim:` keys are internal links. */
export function collectData(input: Pick<DossierInput, 'view' | 'activation' | 'panels' | 'purview'>): { data: Record<string, unknown>; unresolved: string[] } {
  const keys = new Set<string>();
  for (const p of input.panels) for (const c of p.claims) for (const e of c.evidence) if (!e.startsWith('claim:')) keys.add(e);
  for (const r of input.purview) for (const e of r.rows) if (e.includes(':')) keys.add(e);
  const data: Record<string, unknown> = {};
  const unresolved: string[] = [];
  for (const k of [...keys].sort()) {
    const v = resolveKey(k, input.view, input.activation);
    if (v === undefined) unresolved.push(k);
    else data[k] = v;
  }
  return { data, unresolved };
}

export function buildDossier(input: DossierInput): DossierRecord {
  const { data, unresolved } = collectData(input);
  const running = input.activation.filter((r) => r.from <= input.asOf && input.asOf < r.to);
  const clocks = {
    reading: input.clock,
    running: running.map((r) => ({ system: r.system, level: r.level, lord: r.lord ?? r.sign, from: r.from, to: r.to, houses: r.houses })),
    main: [input.clock.system, ...input.clock.confirming.map((c) => c.system)].map((s) => ({ system: s, periods: input.activation.filter((r) => r.system === s && r.level === 1).map((r) => ({ lord: r.lord ?? r.sign, from: r.from, to: r.to })) })),
  };
  const techniques = input.panels.map((p) => {
    const t = techniqueById(p.technique);
    return { id: p.technique, contractHash: t ? contractHash(t) : null, codeVersion: input.codeVersion, cached: p.cached, ms: p.ms, status: p.status };
  });
  const panels = input.panels.map((p) => ({ id: p.id, technique: p.technique, headerRange: p.headerRange, lines: p.lines, claims: p.claims, vetoed: p.vetoed ?? [], chapters: p.chapters ?? [] }));
  const gaps = [...input.gaps, ...unresolved.map((k) => `dossier: ${k} did not resolve`)];
  const bundleHash = createHash('sha256').update(canonicalJson({ v: input.view.version, clock: input.clock.system, code: input.codeVersion, asOf: input.asOf, data, panels })).digest('hex').slice(0, 32);
  return { techniques, rules: input.purview, data, yogas: input.view.yogas(), clocks, panels, gaps, audit: input.audit, bundleHash };
}

/** Writes the dossier once per build content; returns its id. A failed write never fails the reading. */
export async function writeDossier(prisma: PrismaClient, input: DossierInput, rec: DossierRecord): Promise<string | null> {
  try {
    const where = { kundli_id_board_bundle_hash: { kundli_id: input.kundliId, board: input.board, bundle_hash: rec.bundleHash } };
    const found = await prisma.readingDossier.findUnique({ where, select: { id: true } });
    if (found) return found.id;
    const row = await prisma.readingDossier.create({
      data: {
        kundli_id: input.kundliId,
        board: input.board,
        trigger: input.trigger,
        digest_version: input.view.version,
        clock: input.clock.system,
        as_of: new Date(`${input.asOf}T00:00:00Z`),
        valid_to: input.validTo ? new Date(`${input.validTo}T00:00:00Z`) : null,
        bundle_hash: rec.bundleHash,
        techniques: rec.techniques as object,
        rules: rec.rules as unknown as object,
        data: rec.data as object,
        yogas: rec.yogas as object,
        clocks: rec.clocks as object,
        panels: rec.panels as object,
        gaps: rec.gaps as object,
        audit: rec.audit as unknown as object,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    console.warn('[self] dossier write failed:', (e as Error).message);
    return null;
  }
}

/** Fields a staff tool must never see (admin doc 10): birth details anywhere in a payload are dropped. */
const BIRTH_KEYS = new Set(['date_of_birth', 'time_of_birth', 'place_of_birth', 'birth', 'birth_date', 'birth_time', 'lat', 'lon', 'latitude', 'longitude', 'tz', 'place_resolved', 'email', 'name', 'username']);
export function stripBirthFields<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => stripBirthFields(x)) as unknown as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!BIRTH_KEYS.has(k)) out[k] = stripBirthFields(x);
    return out as T;
  }
  return v;
}
