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
import { CORE_TYPES } from './chartBundle.js';
import type { PersonFrame, ReaderId } from './readers.js';

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
  techniqueId?: string;
  sections: readonly DigestSection[];
  vargas: readonly string[];
  tableTypes: readonly string[];
  usesActivation: boolean;
  cachePromptPrefix: boolean;
  cacheOutput: 'reading_findings_cache' | 'technique_outputs' | 'memory' | 'none';
}

export const SUBAGENT_DIGEST_SPECS: Record<SubAgentId, SubAgentDigestSpec> = {
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
  } = {},
): {
  spec: SubAgentDigestSpec;
  contractInputs: readonly ContractInput[];
  tables: Record<string, unknown>;
  missing: string[];
} {
  const spec = SUBAGENT_DIGEST_SPECS[id];
  const contractInputs = contractInputsForSubAgent(id);
  const { tables, missing } = buildTablesFromDigest(digest, spec.tableTypes, opts);
  return { spec, contractInputs, tables, missing };
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

function buildDashaTreeFromActivation(rows: readonly ActivationRow[], system: string): { system: string; periods: PeriodNode[] } | null {
  const sysRows = rows.filter((r) => r.system === system || (system === 'vimsottari' && r.family === 'vimshottari'));
  if (!sysRows.length) return null;

  const l1 = sysRows.filter((r) => r.level === 1);
  const l2 = sysRows.filter((r) => r.level === 2);
  const l3 = sysRows.filter((r) => r.level === 3);

  const labelOf = (r: ActivationRow): string => r.lord ?? r.sign ?? 'period';

  if (l1.length > 0) {
    const periods: PeriodNode[] = l1.map((m) => {
      const mLabel = labelOf(m);
      const ads = l2.filter((a) => (a.parentLord ? a.parentLord === mLabel : a.from >= m.from && a.to <= m.to));
      const children: PeriodNode[] = ads.map((a) => {
        const aLabel = labelOf(a);
        const pds = l3.filter(
          (p) => p.from >= a.from && p.to <= a.to && (!p.parentLord || p.parentLord === aLabel || p.parentLord === `${mLabel}-${aLabel}`),
        );
        return {
          lord: aLabel,
          start: a.from,
          end: a.to,
          ...(a.houses.length ? { houses: a.houses } : {}),
          ...(pds.length
            ? {
                children: pds.map((p) => ({
                  lord: labelOf(p),
                  start: p.from,
                  end: p.to,
                  ...(p.houses.length ? { houses: p.houses } : {}),
                })),
              }
            : {}),
        };
      });
      return {
        lord: mLabel,
        start: m.from,
        end: m.to,
        ...(m.houses.length ? { houses: m.houses } : {}),
        ...(children.length ? { children } : {}),
      };
    });
    return { system, periods };
  }

  // Fallback when only level 2/3 rows overlap the queried horizon
  const flat: PeriodNode[] = sysRows.map((r) => ({
    lord: r.parentLord ? `${r.parentLord}-${labelOf(r)}` : labelOf(r),
    start: r.from,
    end: r.to,
    ...(r.houses.length ? { houses: r.houses } : {}),
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

/**
 * Deterministically materialises `SliceContext.tables` from a ready `DigestView` and optional `ActivationRow[]`.
 * Returns `tables` (by catalogue type id) and `missing` (any requested type not covered by the digest/activation).
 */
export function buildTablesFromDigest(
  digest: DigestView,
  wantedTypes: readonly string[],
  opts: {
    asOf?: string;
    activation?: readonly ActivationRow[] | null;
    person?: PersonFrame | null;
  } = {},
): { tables: Record<string, unknown>; missing: string[] } {
  const tables: Record<string, unknown> = {};
  const d1Houses = digest.houses('D1');
  const d1Planets = digest.planets('D1');
  const d1Points = digest.points('D1');
  const star = digest.star();
  const yogas = digest.yogas();

  if (d1Houses.length || d1Planets.length) {
    tables['varga.d1'] = vargaPayload(d1Houses, d1Planets);
    tables['dignities'] = {
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

  for (const t of wantedTypes) {
    if (t.startsWith('varga.d') && t !== 'varga.d1') {
      const vKey = t.replace('varga.', '').toUpperCase();
      const vHouses = digest.houses(vKey);
      const vPlanets = digest.planets(vKey);
      if (vHouses.length || vPlanets.length) {
        tables[t] = vargaPayload(vHouses, vPlanets);
      }
    } else if (t.startsWith('arudhas.d')) {
      const vKey = t.replace('arudhas.', '').toUpperCase();
      const vPoints = digest.points(vKey);
      const vHouses = digest.houses(vKey);
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
    for (const t of wantedTypes) {
      if (!t.startsWith('dasha.') || t === 'dasha.applicable') continue;
      const sys = t.replace('dasha.', '');
      const tree = buildDashaTreeFromActivation(opts.activation, sys);
      if (tree) tables[t] = tree;
    }
  }

  const year = opts.asOf ? Number(opts.asOf.slice(0, 4)) : undefined;
  const annualRows = year ? [...digest.annual(year), ...digest.annual()] : digest.annual();
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

  const missing = wantedTypes.filter((t) => tables[t] === undefined);
  return { tables, missing };
}
