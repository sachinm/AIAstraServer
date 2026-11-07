/**
 * Deterministic per-sub-agent digest slicing (docs/reading-engine/53 §4.2, 54 §5).
 *
 * Maps every reading sub-agent (`R01..R14`, `P1..P3`, `specialist:*`, `oracle`, `addendum`, `synthesize`,
 * `clarify`, `validator`, `intake`, and `code:*`) to the exact `DigestView` sections, divisional charts,
 * and `ActivationRow[]` slices it needs, and materialises the table slices that `renderCore` and `READERS[id].slice`
 * read so digested kundlis never re-parse raw `kundli_data` rows for already-digested sections.
 *
 * Pure selection and shaping only: no astrological computation.
 */
import { techniqueById } from '../../techniques/catalog.js';
import type { ContractInput } from '../../techniques/contracts.js';
import type { ActivationRow } from '../digest/activation.js';
import type { AnnualRow, DigestSection, DigestView, HouseCard, PlanetCard } from '../digest/types.js';
import { FRAMES, type SubjectId } from '../packs/frames.js';
import { CORE_TYPES } from './chartBundle.js';
import { READERS, subjectVargas, type PersonFrame, type ReaderId, type SliceContext } from './readers.js';
import { renderCore } from './slices.js';

export type SubAgentId =
  | ReaderId
  | 'specialist:promise'
  | 'specialist:dasha'
  | 'specialist:transit'
  | 'specialist:nakshatra'
  | 'specialist:annual'
  | 'specialist:prashna'
  | 'oracle'
  | 'addendum'
  | 'synthesize'
  | 'clarify'
  | 'validator'
  | 'intake'
  | 'code:varga_dynamics'
  | 'code:strength_yoga'
  | 'code:jaimini'
  | 'code:avastha'
  | 'code:nakshatra'
  | 'code:varga'
  | 'code:annual'
  | 'code:person';

export interface SubAgentDigestSpec {
  id: SubAgentId;
  subAgentId: SubAgentId;
  techniqueId?: string;
  sections: readonly DigestSection[];
  digestSections: readonly DigestSection[];
  vargas: readonly string[];
  tableTypes: readonly string[];
  usesActivation: boolean;
  cachePromptPrefix: boolean;
  cacheOutput: 'reading_findings_cache' | 'technique_outputs' | 'memory' | 'none';
}

type RawSubAgentDigestSpec = Omit<SubAgentDigestSpec, 'subAgentId' | 'digestSections'>;

const RAW_SUBAGENT_DIGEST_SPECS: Record<SubAgentId, RawSubAgentDigestSpec> = {
  R01: {
    id: 'R01',
    sections: ['house', 'planet', 'yoga', 'point', 'star'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'yogas', 'doshas', 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R02: {
    id: 'R02',
    sections: ['house', 'planet', 'point', 'star'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'aspects', 'argala.d1', 'bhava'],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R03: {
    id: 'R03',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D9', 'D10', 'D30'],
    tableTypes: [...CORE_TYPES, 'varga.d9', 'varga.d30'],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R04: {
    id: 'R04',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D9'],
    tableTypes: [...CORE_TYPES, 'argala.d1', 'dasha.narayana', 'dasha.chara'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R05: {
    id: 'R05',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'strength.bhava', 'strength.vimsopaka', 'strength.harsha'],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R06: {
    id: 'R06',
    sections: ['house', 'planet', 'yoga'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'yogas', 'doshas'],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R07: {
    id: 'R07',
    sections: ['house', 'planet', 'star'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R08: {
    id: 'R08',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [...CORE_TYPES, 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R09: {
    id: 'R09',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [
      ...CORE_TYPES,
      'dasha.applicable',
      'dasha.yogini',
      'dasha.narayana',
      'dasha.tithi_ashtottari',
      'dasha.dwisatpathi',
    ],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R10: {
    id: 'R10',
    sections: ['house', 'planet', 'point', 'star'],
    vargas: ['D1', 'D9'],
    tableTypes: [...CORE_TYPES],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R11: {
    id: 'R11',
    sections: ['house', 'planet', 'annual'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [
      ...CORE_TYPES,
      'annual.tithi_pravesha',
      'annual.varsha',
      'annual.sahams',
      'annual.mudda',
      'annual.patyayini',
    ],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R12: {
    id: 'R12',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R13: {
    id: 'R13',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D3', 'D7', 'D9', 'D12'],
    tableTypes: [...CORE_TYPES, 'aspects', 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  R14: {
    id: 'R14',
    sections: ['house', 'planet', 'yoga', 'point', 'star'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  P1: {
    id: 'P1',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'aspects', 'bhava', 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  P2: {
    id: 'P2',
    sections: ['house', 'planet', 'star'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  P3: {
    id: 'P3',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES, 'sphutas', 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  'specialist:promise': {
    id: 'specialist:promise',
    sections: ['house', 'planet', 'yoga', 'point'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [...CORE_TYPES, 'yogas', 'doshas'],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  'specialist:dasha': {
    id: 'specialist:dasha',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [...CORE_TYPES, 'dasha.vimsottari'],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  'specialist:transit': {
    id: 'specialist:transit',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  'specialist:nakshatra': {
    id: 'specialist:nakshatra',
    sections: ['house', 'planet', 'star'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  'specialist:annual': {
    id: 'specialist:annual',
    sections: ['house', 'planet', 'annual'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [...CORE_TYPES, 'annual.tithi_pravesha', 'annual.varsha'],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  'specialist:prashna': {
    id: 'specialist:prashna',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1'],
    tableTypes: [...CORE_TYPES],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'reading_findings_cache',
  },
  oracle: {
    id: 'oracle',
    sections: ['house', 'planet', 'yoga', 'point', 'annual', 'star'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'none',
  },
  addendum: {
    id: 'addendum',
    sections: ['house', 'planet'],
    vargas: ['D1'],
    tableTypes: [],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'none',
  },
  synthesize: {
    id: 'synthesize',
    sections: ['house', 'planet', 'yoga', 'point', 'annual', 'star'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [...CORE_TYPES],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'none',
  },
  clarify: {
    id: 'clarify',
    sections: ['house', 'planet', 'star'],
    vargas: ['D1'],
    tableTypes: [],
    usesActivation: true,
    cachePromptPrefix: true,
    cacheOutput: 'memory',
  },
  validator: {
    id: 'validator',
    sections: [],
    vargas: [],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: true,
    cacheOutput: 'memory',
  },
  intake: {
    id: 'intake',
    sections: [],
    vargas: [],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'memory',
  },
  'code:varga_dynamics': {
    id: 'code:varga_dynamics',
    techniqueId: 'general.varga_dynamics',
    sections: ['house', 'planet'],
    vargas: ['D1', 'D2', 'D4', 'D7', 'D9', 'D10', 'D12', 'D24', 'D30', 'D60'],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:strength_yoga': {
    id: 'code:strength_yoga',
    techniqueId: 'general.strength_yoga',
    sections: ['house', 'planet', 'yoga'],
    vargas: ['D1'],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:jaimini': {
    id: 'code:jaimini',
    techniqueId: 'general.jaimini',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D9'],
    tableTypes: [],
    usesActivation: true,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:avastha': {
    id: 'code:avastha',
    techniqueId: 'general.strength_yoga',
    sections: ['house', 'planet'],
    vargas: ['D1'],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:nakshatra': {
    id: 'code:nakshatra',
    techniqueId: 'general.nakshatra',
    sections: ['house', 'planet', 'star'],
    vargas: ['D1'],
    tableTypes: [],
    usesActivation: true,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:varga': {
    id: 'code:varga',
    techniqueId: 'general.varga_dynamics',
    sections: ['house', 'planet'],
    vargas: ['D1', 'D9', 'D10', 'D16', 'D20', 'D27', 'D40', 'D45', 'D60'],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:annual': {
    id: 'code:annual',
    techniqueId: 'general.annual',
    sections: ['house', 'planet', 'annual'],
    vargas: ['D1', 'D9', 'D10'],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
  'code:person': {
    id: 'code:person',
    techniqueId: 'general.person',
    sections: ['house', 'planet', 'point'],
    vargas: ['D1', 'D3', 'D7', 'D9', 'D12'],
    tableTypes: [],
    usesActivation: false,
    cachePromptPrefix: false,
    cacheOutput: 'technique_outputs',
  },
};

export const SUBAGENT_DIGEST_SPECS: Record<SubAgentId, SubAgentDigestSpec> = Object.fromEntries(
  Object.entries(RAW_SUBAGENT_DIGEST_SPECS).map(([k, v]) => [
    k,
    {
      ...v,
      subAgentId: v.id,
      digestSections: v.sections,
    },
  ]),
) as Record<SubAgentId, SubAgentDigestSpec>;

export function getSubAgentDigestSpec(id: SubAgentId): SubAgentDigestSpec | undefined {
  return SUBAGENT_DIGEST_SPECS[id];
}

const DEFAULT_TECHNIQUE_BY_SUBAGENT: Partial<Record<SubAgentId, string>> = {
  'specialist:promise': 'general.promise',
  'specialist:dasha': 'general.dasha',
  'specialist:transit': 'general.transit',
  'specialist:nakshatra': 'general.nakshatra',
  'specialist:annual': 'general.annual',
  'specialist:prashna': 'general.prashna',
  oracle: 'general.oracle',
  addendum: 'general.oracle',
  synthesize: 'general.oracle',
  clarify: 'general.clarify',
  validator: 'general.validator',
  intake: 'general.intake',
};

/**
 * Resolves the catalogue `contract.inputs` (`src/techniques/catalog.ts`) for a given `SubAgentId`.
 */
export function contractInputsForSubAgent(id: SubAgentId): readonly ContractInput[] {
  const spec = SUBAGENT_DIGEST_SPECS[id];
  const techId = spec?.techniqueId ?? DEFAULT_TECHNIQUE_BY_SUBAGENT[id] ?? 'general.reader';
  return techniqueById(techId)?.contract.inputs ?? [];
}

/**
 * Slices `DigestView` + `ActivationRow[]` for one specific `SubAgentId` using its catalogue `contract.inputs` and `SUBAGENT_DIGEST_SPECS[id]`.
 */
export function sliceDigestForSubAgent(
  id: SubAgentId,
  digest: DigestView,
  opts: {
    asOf?: string;
    activation?: readonly ActivationRow[] | null;
    person?: PersonFrame | null;
    prashna?: unknown;
    transitRows?: unknown;
  } = {},
): {
  spec: SubAgentDigestSpec;
  contractInputs: readonly ContractInput[];
  tables: Record<string, unknown>;
  coreText: string;
  missing: string[];
} {
  const spec = SUBAGENT_DIGEST_SPECS[id];
  const contractInputs = contractInputsForSubAgent(id);
  const { tables, coreText, missing } = buildTablesFromDigest(digest, spec.tableTypes, opts);
  return { spec, contractInputs, tables, coreText, missing };
}

/**
 * Builds the digested pack (`coreText`, `sections`, `tables`, `missing`) for an Oracle reader (`R01..R14`)
 * directly from `DigestView` + `ActivationRow[]`.
 */
export function buildReaderPackFromDigest(
  id: Exclude<ReaderId, 'P1' | 'P2' | 'P3'>,
  digest: DigestView,
  opts: {
    subject?: SubjectId;
    asOf?: string;
    from?: string;
    to?: string;
    activation?: readonly ActivationRow[] | null;
    person?: PersonFrame | null;
    transits?: unknown;
    transitAt?: unknown;
    prashna?: unknown;
  } = {},
): {
  spec: SubAgentDigestSpec;
  contractInputs: readonly ContractInput[];
  tables: Record<string, unknown>;
  coreText: string;
  sections: Record<string, unknown>;
  missing: string[];
} {
  const subject: SubjectId = opts.subject ?? 'general_life_direction';
  const vargas = subjectVargas(subject);
  const def = READERS[id];
  const wantedTypes = [...new Set([...CORE_TYPES, ...def.types({ vargas, person: opts.person ?? null })])];
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const from = opts.from ?? asOf;
  const to = opts.to ?? `${Number(asOf.slice(0, 4)) + 2}${asOf.slice(4)}`;
  const { tables, coreText, missing } = buildTablesFromDigest(digest, wantedTypes, {
    asOf,
    activation: opts.activation ?? null,
    person: opts.person ?? null,
    prashna: opts.prashna,
    transitRows: opts.transits,
  });
  const sliceCtx: SliceContext = {
    tables,
    houses: [...new Set([...(FRAMES[subject]?.houses ?? []), ...(opts.person?.houses ?? [])])],
    vargas,
    from,
    to,
    transits: opts.transits,
    transitAt: opts.transitAt,
    prashna: opts.prashna,
    person: opts.person ?? null,
  };
  const core = renderCore(tables, CORE_TYPES);
  const readerSlice = def.slice(sliceCtx);
  return {
    spec: SUBAGENT_DIGEST_SPECS[id],
    contractInputs: contractInputsForSubAgent(id),
    tables,
    coreText: core.text,
    sections: { ...core.sections, ...readerSlice },
    missing,
  };
}

/**
 * Builds the digested pack (`coreText`, `sections`, `tables`, `missing`) for a Prashna reader (`P1..P3`)
 * directly from `DigestView` + `ActivationRow[]`.
 */
export function buildPrashnaPackFromDigest(
  id: 'P1' | 'P2' | 'P3',
  digest: DigestView,
  opts: {
    subject?: SubjectId;
    asOf?: string;
    from?: string;
    to?: string;
    activation?: readonly ActivationRow[] | null;
    transits?: unknown;
    transitAt?: unknown;
    prashna?: unknown;
  } = {},
): {
  spec: SubAgentDigestSpec;
  contractInputs: readonly ContractInput[];
  tables: Record<string, unknown>;
  coreText: string;
  sections: Record<string, unknown>;
  missing: string[];
} {
  const subject: SubjectId = opts.subject ?? 'general_life_direction';
  const vargas = subjectVargas(subject);
  const def = READERS[id];
  const wantedTypes = [...new Set([...CORE_TYPES, ...def.types({ vargas, person: null })])];
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const from = opts.from ?? asOf;
  const to = opts.to ?? `${Number(asOf.slice(0, 4)) + 1}${asOf.slice(4)}`;
  const { tables, coreText, missing } = buildTablesFromDigest(digest, wantedTypes, {
    asOf,
    activation: opts.activation ?? null,
    prashna: opts.prashna,
    transitRows: opts.transits,
  });
  const sliceCtx: SliceContext = {
    tables,
    houses: [...new Set(FRAMES[subject]?.houses ?? [])],
    vargas,
    from,
    to,
    transits: opts.transits,
    transitAt: opts.transitAt,
    prashna: opts.prashna,
  };
  const core = renderCore(tables, CORE_TYPES);
  const readerSlice = def.slice(sliceCtx);
  return {
    spec: SUBAGENT_DIGEST_SPECS[id],
    contractInputs: contractInputsForSubAgent(id),
    tables,
    coreText: core.text,
    sections: { ...core.sections, ...readerSlice },
    missing,
  };
}

function vargaPayload(houses: HouseCard[], planets: PlanetCard[]): Record<string, unknown> {
  return {
    houses: houses.map((h) => ({
      house: h.house,
      sign: h.sign,
      lord: h.lord,
      lord_house: h.lordHouse,
      lord_sign: h.lordSign,
      lord_dignity: h.lordDignity,
      co_lord: h.coLord,
      occupants: h.occupants,
      aspected_graha: h.aspectedGraha,
      aspected_rasi: h.aspectedRasi,
      sav: h.sav,
      class: h.class,
      arudha: h.arudha,
    })),
    planets: planets.map((p) => ({
      planet: p.planet,
      sign: p.sign,
      house: p.house,
      degree: p.degree,
      star: p.star,
      pada: p.pada,
      star_lord: p.starLord,
      dignity: p.dignity,
      retro: p.retro,
      combust: p.combust,
      war: p.war,
      dispositor: p.dispositor,
      dispositor_house: p.dispositorHouse,
      owns: p.owns,
      aspects_to: p.aspectsTo,
      aspected_by: p.aspectedBy,
      conjunctions: p.conjunctions,
    })),
  };
}

interface PeriodNode {
  lord: string;
  start: string;
  end: string;
  houses?: number[];
  children?: PeriodNode[];
}

function rowStart(r: ActivationRow & { start_at?: string | Date }): string {
  if (typeof r.from === 'string' && r.from) return r.from;
  if (r.start_at instanceof Date) return r.start_at.toISOString().slice(0, 10);
  if (typeof r.start_at === 'string') return r.start_at.slice(0, 10);
  return '';
}

function rowEnd(r: ActivationRow & { end_at?: string | Date }): string {
  if (typeof r.to === 'string' && r.to) return r.to;
  if (r.end_at instanceof Date) return r.end_at.toISOString().slice(0, 10);
  if (typeof r.end_at === 'string') return r.end_at.slice(0, 10);
  return '';
}

function buildDashaTreeFromActivation(rows: readonly ActivationRow[], system: string): { system: string; periods: PeriodNode[] } | null {
  const norm = system === 'vimshottari' ? 'vimsottari' : system;
  const sysRows = rows.filter(
    (r) =>
      r.system === norm ||
      r.system === system ||
      (norm === 'vimsottari' && (r.family === 'vimshottari' || r.system === 'vimshottari')),
  );
  if (!sysRows.length) return null;

  const l1 = sysRows.filter((r) => r.level === 1);
  const l2 = sysRows.filter((r) => r.level === 2);
  const l3 = sysRows.filter((r) => r.level === 3);

  const labelOf = (r: ActivationRow): string => r.lord ?? r.sign ?? 'period';

  if (l1.length > 0) {
    const periods: PeriodNode[] = l1.map((m) => {
      const mLabel = labelOf(m);
      const mFrom = rowStart(m);
      const mTo = rowEnd(m);
      const ads = l2.filter((a) => (a.parentLord ? a.parentLord === mLabel : rowStart(a) >= mFrom && rowEnd(a) <= mTo));
      const children: PeriodNode[] = ads.map((a) => {
        const aLabel = labelOf(a);
        const aFrom = rowStart(a);
        const aTo = rowEnd(a);
        const pds = l3.filter(
          (p) =>
            rowStart(p) >= aFrom &&
            rowEnd(p) <= aTo &&
            (!p.parentLord || p.parentLord === aLabel || p.parentLord === `${mLabel}-${aLabel}`),
        );
        return {
          lord: aLabel,
          start: aFrom,
          end: aTo,
          ...(a.houses?.length ? { houses: a.houses } : {}),
          ...(pds.length
            ? {
                children: pds.map((p) => ({
                  lord: labelOf(p),
                  start: rowStart(p),
                  end: rowEnd(p),
                  ...(p.houses?.length ? { houses: p.houses } : {}),
                })),
              }
            : {}),
        };
      });
      return {
        lord: mLabel,
        start: mFrom,
        end: mTo,
        ...(m.houses?.length ? { houses: m.houses } : {}),
        ...(children.length ? { children } : {}),
      };
    });
    return { system, periods };
  }

  // Fallback when only level 2/3 rows overlap the queried horizon
  const flat: PeriodNode[] = sysRows.map((r) => ({
    lord: r.parentLord ? `${r.parentLord}-${labelOf(r)}` : labelOf(r),
    start: rowStart(r),
    end: rowEnd(r),
    ...(r.houses?.length ? { houses: r.houses } : {}),
  }));
  return { system, periods: flat };
}

function buildAnnualFromDigest(rows: readonly AnnualRow[], kind: 'TP' | 'VP'): Record<string, unknown> | null {
  const picked = rows.find((r) => r.kind === kind && r.varga === 'D1') ?? rows.find((r) => r.kind === kind);
  if (!picked) return null;
  const periods = picked.dashas.flatMap((d) =>
    d.periods.map((p) => ({
      lord: p.lord,
      start: p.from,
      end: p.to,
      system: d.system,
    })),
  );
  return {
    kind: picked.kind,
    year: picked.year,
    varga: picked.varga,
    lagna: picked.lagna,
    year_lord: picked.yearLord ?? null,
    muntha: picked.muntha ?? null,
    houses: picked.houses,
    sahams: picked.sahams,
    tajaka_yogas: picked.tajakaYogas ?? [],
    ...(periods.length ? { periods } : {}),
  };
}

export interface BuildTablesFromDigestArgs {
  digest: DigestView;
  activation?: readonly ActivationRow[] | null;
  spec?: SubAgentDigestSpec;
  wantedTypes?: readonly string[];
  asOf?: string;
  person?: PersonFrame | null;
  prashna?: unknown;
  transitRows?: unknown;
}

function readHouses(digest: DigestView, varga: string): HouseCard[] {
  const raw = (digest as unknown as { houses?: unknown }).houses;
  if (typeof raw === 'function') return digest.houses(varga);
  if (raw && typeof raw === 'object') return ((raw as Record<string, HouseCard[]>)[varga] ?? []);
  return [];
}

function readPlanets(digest: DigestView, varga: string): PlanetCard[] {
  const raw = (digest as unknown as { planets?: unknown }).planets;
  if (typeof raw === 'function') return digest.planets(varga);
  if (raw && typeof raw === 'object') return ((raw as Record<string, PlanetCard[]>)[varga] ?? []);
  return [];
}

function readPoints(digest: DigestView, varga?: string) {
  const raw = (digest as unknown as { points?: unknown }).points;
  if (typeof raw === 'function') return digest.points(varga);
  if (Array.isArray(raw)) {
    return varga ? raw.filter((pt) => (pt as { varga?: string }).varga === varga) : raw;
  }
  return [];
}

function readStar(digest: DigestView) {
  const raw = (digest as unknown as { star?: unknown }).star;
  if (typeof raw === 'function') return digest.star();
  if (raw && typeof raw === 'object') return raw as ReturnType<DigestView['star']>;
  return null;
}

function readYogas(digest: DigestView) {
  const raw = (digest as unknown as { yogas?: unknown }).yogas;
  if (typeof raw === 'function') return digest.yogas();
  if (Array.isArray(raw)) return raw as ReturnType<DigestView['yogas']>;
  return [];
}

function readAnnual(digest: DigestView, year?: number): AnnualRow[] {
  const raw = (digest as unknown as { annual?: unknown }).annual;
  if (typeof raw === 'function') return year ? [...digest.annual(year), ...digest.annual()] : digest.annual();
  if (Array.isArray(raw)) {
    const arr = raw as AnnualRow[];
    return year ? [...arr.filter((r) => r.year === year), ...arr] : arr;
  }
  return [];
}

/**
 * Deterministically materialises `SliceContext.tables` from a ready `DigestView` and optional `ActivationRow[]`.
 * Returns `tables` (by catalogue type id), `coreText`, and `missing` (any requested type not covered by the digest/activation).
 */
export function buildTablesFromDigest(
  digestOrArgs: DigestView | BuildTablesFromDigestArgs,
  wantedTypesArg?: readonly string[],
  optsArg: {
    asOf?: string;
    activation?: readonly ActivationRow[] | null;
    person?: PersonFrame | null;
    prashna?: unknown;
    transitRows?: unknown;
  } = {},
): { tables: Record<string, unknown>; coreText: string; missing: string[] } {
  const isObjCall =
    digestOrArgs !== null &&
    typeof digestOrArgs === 'object' &&
    'digest' in digestOrArgs &&
    (digestOrArgs as BuildTablesFromDigestArgs).digest !== undefined;
  const digest = isObjCall ? (digestOrArgs as BuildTablesFromDigestArgs).digest : (digestOrArgs as DigestView);
  const spec = isObjCall ? (digestOrArgs as BuildTablesFromDigestArgs).spec : undefined;
  const wantedTypes = isObjCall
    ? ((digestOrArgs as BuildTablesFromDigestArgs).wantedTypes ?? spec?.tableTypes ?? CORE_TYPES)
    : (wantedTypesArg ?? CORE_TYPES);
  const opts = isObjCall
    ? {
        asOf: (digestOrArgs as BuildTablesFromDigestArgs).asOf,
        activation: (digestOrArgs as BuildTablesFromDigestArgs).activation ?? null,
        person: (digestOrArgs as BuildTablesFromDigestArgs).person ?? null,
        prashna: (digestOrArgs as BuildTablesFromDigestArgs).prashna,
        transitRows: (digestOrArgs as BuildTablesFromDigestArgs).transitRows,
      }
    : optsArg;

  const tables: Record<string, unknown> = {};
  const d1Houses = readHouses(digest, 'D1');
  const d1Planets = readPlanets(digest, 'D1');
  const d1Points = readPoints(digest, 'D1');
  const star = readStar(digest);
  const yogas = readYogas(digest);

  if (d1Houses.length || d1Planets.length) {
    tables['varga.d1'] = vargaPayload(d1Houses, d1Planets);
    const dignitiesPayload = {
      planets: d1Planets.map((p) => ({
        planet: p.planet,
        sign: p.sign,
        house: p.house,
        dignity: p.dignity,
        retro: p.retro,
        combust: p.combust,
        war: p.war,
      })),
    };
    tables['dignities'] = dignitiesPayload;
    tables['dignities.d1'] = dignitiesPayload;
    tables['benefic_malefic'] = {
      house_lords: Object.fromEntries(d1Houses.map((h) => [String(h.house), h.lord])),
      planets: d1Planets.map((p) => ({
        planet: p.planet,
        natural: p.natural,
        functional: p.functional,
        owns: p.owns,
      })),
    };
    tables['relations'] = {
      planets: d1Planets.map((p) => ({
        planet: p.planet,
        dispositor: p.dispositor,
        dispositor_house: p.dispositorHouse,
        star_lord: p.starLord,
        conjunctions: p.conjunctions,
        aspected_by: p.aspectedBy,
      })),
    };
    tables['ashtakavarga'] = {
      sav: Object.fromEntries(d1Houses.map((h) => [String(h.house), h.sav])),
      houses: d1Houses.map((h) => ({ house: h.house, sav: h.sav })),
    };
    tables['strength.shadbala'] = {
      planets: d1Planets.map((p) => ({
        planet: p.planet,
        ratio: p.shadbalaRatio,
        rank: p.shadbalaRank,
      })),
    };
    tables['strength.bhava'] = {
      houses: d1Houses.map((h) => ({
        house: h.house,
        sav: h.sav,
        lord: h.lord,
        lord_dignity: h.lordDignity,
        class: h.class,
      })),
    };
    tables['strength.vimsopaka'] = {
      planets: d1Planets.map((p) => ({
        planet: p.planet,
        dignity: p.dignity,
        shadbala_ratio: p.shadbalaRatio,
        avasthas: p.avasthas,
        multipliers: p.avasthaMultipliers ?? null,
      })),
    };
    tables['strength.harsha'] = {
      planets: d1Planets.map((p) => ({
        planet: p.planet,
        house: p.house,
        dignity: p.dignity,
        avasthas: p.avasthas,
      })),
    };
    tables['aspects'] = {
      rasi_drishti: Object.fromEntries(d1Houses.map((h) => [`h${h.house}`, h.aspectedRasi])),
      graha_drishti: Object.fromEntries(d1Houses.map((h) => [`h${h.house}`, h.aspectedGraha])),
    };
    tables['argala.d1'] = {
      houses: d1Houses.map((h) => ({
        house: h.house,
         ...(h.argala ?? { primary: [], secondary: [], obstructed: [] }),
      })),
    };
    tables['bhava'] = {
      houses: d1Houses.map((h) => ({
        house: h.house,
        sign: h.sign,
        lord: h.lord,
        lord_house: h.lordHouse,
        lord_dignity: h.lordDignity,
        occupants: h.occupants,
        class: h.class,
        cusp_star: h.cuspStar,
        arudha: h.arudha,
      })),
    };
  }

  tables['panchanga.birth'] = star
    ? {
        moon_star: star.moonStar,
        moon_star_lord: star.moonStarLord,
        lagna_star: star.lagnaStar,
        gandanta: star.gandanta,
        pending_karma_houses: star.pendingKarmaHouses ?? [],
      }
    : {
        moon_star: d1Planets.find((p) => p.planet === 'Mo')?.star ?? null,
        moon_star_lord: d1Planets.find((p) => p.planet === 'Mo')?.starLord ?? null,
      };

  const charaIds = new Set(['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK', 'PiK']);
  tables['karaka.chara'] = {
    karakas: d1Points
      .filter((pt) => charaIds.has(pt.id))
      .map((pt) => ({ id: pt.id, planet: pt.lord, sign: pt.sign, house: pt.house })),
  };
  tables['arudhas'] = {
    padas: d1Points
      .filter((pt) => pt.id === 'AL' || pt.id === 'UL' || /^A\d+$/.test(pt.id))
      .map((pt) => ({ id: pt.id, sign: pt.sign, house: pt.house, lord: pt.lord, lord_house: pt.lordHouse })),
  };
  tables['sphutas'] = {
    points: d1Points.map((pt) => ({
      id: pt.id,
      varga: pt.varga,
      sign: pt.sign,
      house: pt.house,
      lord: pt.lord,
      lord_house: pt.lordHouse,
    })),
  };

  tables['yogas'] = {
    yogas: yogas
      .filter((y) => y.class !== 'dosha')
      .map((y) => ({ id: y.id, name: y.name, planets: y.planets, houses: y.houses, class: y.class, present: true })),
  };
  tables['doshas'] = {
    doshas: yogas
      .filter((y) => y.class === 'dosha' || /dosha/i.test(y.name))
      .map((y) => ({ id: y.id, name: y.name, planets: y.planets, houses: y.houses, class: y.class, present: true })),
  };

  const extraVargas = new Set<string>();
  for (const t of wantedTypes) {
    if (t.startsWith('varga.d') && t !== 'varga.d1') {
      extraVargas.add(t.replace('varga.', '').toUpperCase());
    }
  }
  if (spec?.vargas) {
    for (const v of spec.vargas) {
      if (v.toUpperCase() !== 'D1') extraVargas.add(v.toUpperCase());
    }
  }
  if (opts.person?.varga) {
    extraVargas.add(opts.person.varga.replace('varga.', '').toUpperCase());
  }
  for (const vKey of extraVargas) {
    const t = `varga.${vKey.toLowerCase()}`;
    const vHouses = readHouses(digest, vKey);
    const vPlanets = readPlanets(digest, vKey);
    if (vHouses.length || vPlanets.length) {
      tables[t] = vargaPayload(vHouses, vPlanets);
    }
  }

  for (const t of wantedTypes) {
    if (t.startsWith('arudhas.d')) {
      const vKey = t.replace('arudhas.', '').toUpperCase();
      const vPoints = readPoints(digest, vKey);
      const vHouses = readHouses(digest, vKey);
      if (vPoints.length || vHouses.some((h) => h.arudha)) {
        tables[t] = {
          padas: vPoints.map((pt) => ({ id: pt.id, sign: pt.sign, house: pt.house, lord: pt.lord, lord_house: pt.lordHouse })),
          houses: Object.fromEntries(vHouses.filter((h) => h.arudha).map((h) => [String(h.house), h.arudha])),
        };
      }
    }
  }

  if (opts.activation && opts.activation.length > 0) {
    const systems = new Set(opts.activation.map((r) => r.system));
    tables['dasha.applicable'] = { systems: [...systems] };
    const dashaTypes = new Set<string>(['dasha.vimsottari', 'dasha.vimshottari']);
    for (const t of wantedTypes) {
      if (t.startsWith('dasha.') && t !== 'dasha.applicable') dashaTypes.add(t);
    }
    for (const t of dashaTypes) {
      const sys = t.replace('dasha.', '');
      const tree = buildDashaTreeFromActivation(opts.activation, sys);
      if (tree) {
        tables[t] = tree;
        if (t === 'dasha.vimsottari') tables['dasha.vimshottari'] = tree;
      }
    }
  }

  const year = opts.asOf ? Number(opts.asOf.slice(0, 4)) : undefined;
  const annualRows = readAnnual(digest, year);
  if (annualRows.length > 0) {
    const tp = buildAnnualFromDigest(annualRows, 'TP');
    const vp = buildAnnualFromDigest(annualRows, 'VP');
    if (tp) tables['annual.tithi_pravesha'] = tp;
    if (vp) tables['annual.varsha'] = vp;
    const sahams = (tp?.sahams as unknown[] | undefined) ?? (vp?.sahams as unknown[] | undefined) ?? [];
    if (sahams.length) tables['annual.sahams'] = { sahams };
    if (vp?.periods) tables['annual.mudda'] = { periods: vp.periods };
    if (tp?.periods) tables['annual.patyayini'] = { periods: tp.periods };
  }

  if (opts.prashna !== undefined) {
    tables['prashna'] = opts.prashna;
  }
  if (opts.transitRows !== undefined) {
    tables['transit'] = opts.transitRows;
  }

  const coreText = renderCore(tables, CORE_TYPES).text;
  const missing = wantedTypes.filter((t) => tables[t] === undefined);
  return { tables, coreText, missing };
}
