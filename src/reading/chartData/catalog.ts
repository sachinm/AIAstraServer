/**
 * The keyword list of chart data Radha (pyjhora) can serve, one entry per type (docs/reading-engine/20 §3-4, 21 §2).
 * This is the code floor: the `chart_data_types` table (migration M7) is seeded from it and may override `served`,
 * `tier`, `calc_version` and `enabled` per row. Nothing here computes astrology.
 *
 * - `id` is the stable dotted key used everywhere on the server; `radhaType` is the wire `type` sent to Radha.
 * - `served`: Radha answers this type today. Unserved types are never requested (no wasted round trip).
 * - `calcVersion`: the version of the numbers we expect. A stored row with a different `calc_version` is stale.
 *   Today's ten types are `legacy` (their payload shapes predate the facts dossier); R-3/R-4 bump them.
 * - `tier`: fetch priority. `first` (chat can open), `registration` (rest of signup), `on_demand` (first use).
 * - `variantKind`: `natal` (one row), `year` (one row per solar-return year).
 */

export type ChartFamily = 'panchanga' | 'varga' | 'dasha' | 'karaka' | 'strength' | 'yoga' | 'special' | 'annual';
export type ChangeClass = 'natal' | 'annual';
export type FetchTier = 'first' | 'registration' | 'on_demand';
export type VariantKind = 'natal' | 'year';

export interface ChartDataType {
  id: string;
  family: ChartFamily;
  radhaType: string;
  changeClass: ChangeClass;
  tier: FetchTier;
  variantKind: VariantKind;
  served: boolean;
  calcVersion: string | null;
  /** The `kundlis` column holding this item before the vertical table (backfill + fallback read) */
  legacyColumn?: string;
  sortOrder: number;
  label: string;
}

/** pyjhora `const.division_chart_factors` */
export const VARGA_FACTORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144] as const;

const SERVED_VARGAS = new Set([1, 2, 4, 7, 9, 10]);
const FIRST_VARGAS = new Set([1, 9]);
/** doc 21 Q1: the subject vargas plus doc 09's default facts set */
const REGISTRATION_VARGAS = new Set([2, 3, 4, 7, 10, 12, 30, 60]);

/** `horoscope/dhasa/graha/*.py` and `horoscope/dhasa/raasi/*.py` */
const GRAHA_DASHAS = [
  'vimsottari', 'ashtottari', 'yogini', 'dwadasottari', 'shodasottari', 'panchottari', 'sataatbika', 'chathuraaseethi_sama',
  'dwisatpathi', 'shastihayani', 'shattrimsa_sama', 'karana_chathuraaseethi_sama', 'tara', 'karaka', 'naisargika',
  'buddhi_gathi', 'kaala', 'saptharishi_nakshathra', 'tithi_ashtottari', 'tithi_yogini', 'yoga_vimsottari', 'aayu',
] as const;
const RAASI_DASHAS = [
  'narayana', 'chara', 'kalachakra', 'moola', 'sudasa', 'drig', 'shoola', 'sthira', 'trikona', 'kendradhi_rasi', 'lagnamsaka',
  'mandooka', 'navamsa', 'padhanadhamsa', 'paryaaya', 'brahma', 'varnada', 'yogardha', 'tara_lagna', 'chakra', 'sandhya', 'nirayana',
] as const;

const LEGACY_DASHA: Record<string, { radhaType: string; column: string; tier: FetchTier }> = {
  vimsottari: { radhaType: 'vimsottari_dasa', column: 'vimsottari_dasa', tier: 'first' },
  narayana: { radhaType: 'narayana_dasa', column: 'narayana_dasa', tier: 'registration' },
};

function build(): ChartDataType[] {
  const out: ChartDataType[] = [];
  const natal = (e: Omit<ChartDataType, 'changeClass' | 'variantKind' | 'served' | 'calcVersion'> & { served?: boolean }): void => {
    const served = e.served ?? false;
    out.push({ ...e, changeClass: 'natal', variantKind: 'natal', served, calcVersion: served ? 'legacy' : null });
  };

  natal({ id: 'panchanga.birth', family: 'panchanga', radhaType: 'biodata', tier: 'first', served: true, legacyColumn: 'biodata', sortOrder: 10, label: 'Birth details and panchanga' });
  VARGA_FACTORS.forEach((f, i) =>
    natal({
      id: `varga.d${f}`,
      family: 'varga',
      radhaType: `d${f}`,
      tier: FIRST_VARGAS.has(f) ? 'first' : REGISTRATION_VARGAS.has(f) ? 'registration' : 'on_demand',
      served: SERVED_VARGAS.has(f),
      ...(SERVED_VARGAS.has(f) ? { legacyColumn: `d${f}` } : {}),
      sortOrder: 100 + i,
      label: `D${f} divisional chart`,
    })
  );
  [...GRAHA_DASHAS, ...RAASI_DASHAS].forEach((name, i) => {
    const legacy = LEGACY_DASHA[name];
    natal({
      id: `dasha.${name}`,
      family: 'dasha',
      radhaType: legacy?.radhaType ?? `dasha.${name}`,
      tier: legacy?.tier ?? 'on_demand',
      served: Boolean(legacy),
      ...(legacy ? { legacyColumn: legacy.column } : {}),
      sortOrder: 200 + i,
      label: `${name.replace(/_/g, ' ')} dasha`,
    });
  });
  natal({ id: 'karaka.chara', family: 'karaka', radhaType: 'charakaraka', tier: 'first', served: true, legacyColumn: 'charakaraka', sortOrder: 300, label: 'Chara karakas' });
  natal({ id: 'arudhas', family: 'special', radhaType: 'arudhas', tier: 'first', sortOrder: 310, label: 'Arudha padas (bhava and graha)' });
  natal({ id: 'ashtakavarga', family: 'strength', radhaType: 'ashtakavarga', tier: 'registration', sortOrder: 320, label: 'Ashtakavarga (BAV and SAV)' });
  natal({ id: 'strength.shadbala', family: 'strength', radhaType: 'strength.shadbala', tier: 'registration', sortOrder: 330, label: 'Shadbala' });
  natal({ id: 'yogas', family: 'yoga', radhaType: 'yogas', tier: 'registration', sortOrder: 340, label: 'Yogas and raja yogas' });
  natal({ id: 'strength.bhava', family: 'strength', radhaType: 'strength.bhava', tier: 'on_demand', sortOrder: 350, label: 'Bhava bala' });
  natal({ id: 'strength.vimsopaka', family: 'strength', radhaType: 'strength.vimsopaka', tier: 'on_demand', sortOrder: 360, label: 'Vimsopaka (vargeeya) bala' });
  natal({ id: 'strength.harsha', family: 'strength', radhaType: 'strength.harsha', tier: 'on_demand', sortOrder: 370, label: 'Harsha bala' });
  natal({ id: 'aspects', family: 'strength', radhaType: 'aspects', tier: 'on_demand', sortOrder: 380, label: 'Planet aspect table' });
  natal({ id: 'doshas', family: 'yoga', radhaType: 'doshas', tier: 'on_demand', sortOrder: 390, label: 'Doshas' });
  natal({ id: 'sphutas', family: 'special', radhaType: 'sphutas', tier: 'on_demand', sortOrder: 400, label: 'Sphutas (special points)' });

  const annual = (id: string, label: string, sortOrder: number): void => {
    out.push({ id, family: 'annual', radhaType: id, changeClass: 'annual', tier: 'on_demand', variantKind: 'year', served: false, calcVersion: null, sortOrder, label });
  };
  annual('annual.varsha', 'Varsha pravesh (Tajaka annual chart)', 500);
  annual('annual.tithi_pravesha', 'Tithi pravesha chart', 510);
  annual('annual.mudda', 'Mudda dasha', 520);
  annual('annual.patyayini', 'Patyayini dasha', 530);
  annual('annual.sahams', 'Sahams', 540);
  return out;
}

export const BUILTIN_CHART_TYPES: readonly ChartDataType[] = build();
export const CHART_TYPE_BY_ID: ReadonlyMap<string, ChartDataType> = new Map(BUILTIN_CHART_TYPES.map((t) => [t.id, t]));

/** Ordered fetch list for a tier and everything before it (`registration` includes `first`). */
export function typesForTier(types: readonly ChartDataType[], tier: Exclude<FetchTier, 'on_demand'>): ChartDataType[] {
  const want: FetchTier[] = tier === 'first' ? ['first'] : ['first', 'registration'];
  return types.filter((t) => want.includes(t.tier)).sort((a, b) => (a.tier === b.tier ? a.sortOrder - b.sortOrder : a.tier === 'first' ? -1 : 1));
}

/** Merge database rows over the built-in list (rows may change served/tier/calc_version/enabled; unknown rows are added). */
export interface ChartTypeRow {
  id: string;
  family: string;
  radha_type: string;
  change_class: string;
  tier: string;
  variant_kind: string;
  served: boolean;
  calc_version: string | null;
  legacy_column: string | null;
  sort_order: number;
  label: string;
  enabled: boolean;
}

export function mergeChartTypes(rows: readonly ChartTypeRow[]): ChartDataType[] {
  const byId = new Map(BUILTIN_CHART_TYPES.map((t) => [t.id, { ...t }]));
  for (const r of rows) {
    if (!r.enabled) {
      byId.delete(r.id);
      continue;
    }
    byId.set(r.id, {
      id: r.id,
      family: r.family as ChartFamily,
      radhaType: r.radha_type,
      changeClass: r.change_class as ChangeClass,
      tier: r.tier as FetchTier,
      variantKind: r.variant_kind as VariantKind,
      served: r.served,
      calcVersion: r.calc_version,
      ...(r.legacy_column ? { legacyColumn: r.legacy_column } : {}),
      sortOrder: r.sort_order,
      label: r.label,
    });
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
