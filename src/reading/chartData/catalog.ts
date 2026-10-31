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
 * - `changeClass`: `natal` (fixed at birth), `annual` (per year), `moving` (depends on the moment asked for; never stored
 *   in kundli_data, so ensureChartData refuses it: call `fetchTransit` in ./transit.ts instead).
 */

export type ChartFamily = 'panchanga' | 'varga' | 'dasha' | 'karaka' | 'strength' | 'yoga' | 'special' | 'annual' | 'transit' | 'prashna';
export type ChangeClass = 'natal' | 'annual' | 'moving';
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
  /** Request parameters sent to Radha with every fetch of this type (e.g. `{ varga: 9 }` for `argala.d9`). Code-only, not in the table. */
  fixedParams?: Record<string, unknown>;
  sortOrder: number;
  label: string;
}

/** Systems Radha's `annual.tithi_pravesha_dasha` takes in `params.system` (doc 28 R-27a); the first is its default. */
export const TITHI_PRAVESHA_DASHA_SYSTEMS = ['tithi_ashtottari', 'mudda', 'patyayini'] as const;
export const TITHI_PRAVESHA_DASHA_DEFAULT_SYSTEM = TITHI_PRAVESHA_DASHA_SYSTEMS[0];

/**
 * The stored variant of a year item: `year=<y>`, plus `;<k>=<v>` for each fixed request option in the catalog's order
 * (e.g. `year=2027;system=tithi_ashtottari`), so one year is stored once per option.
 */
export function yearVariant(year: number, fixedParams?: Record<string, unknown>): string {
  const extra = Object.entries(fixedParams ?? {}).map(([k, v]) => `;${k}=${String(v)}`);
  return `year=${year}${extra.join('')}`;
}

/** pyjhora `const.division_chart_factors` */
export const VARGA_FACTORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144] as const;

/** Divisional charts Radha's `arudhas` and `argala` types are offered for (R-4c). D1 arudhas stay the plain `arudhas` entry. */
export const ARUDHA_ARGALA_VARGAS = [1, 2, 3, 4, 7, 9, 10, 12, 20, 24, 30, 60] as const;

/** Radha types that also take `varga` (doc 34); offered for the same charts. D1 stays the plain entry of each type. */
export const VARGA_TABLE_TYPES = ['dignities', 'aspects', 'relations'] as const;

/** Divisional charts for which planetary `avasthas` are pre-catalogued in addition to D1 (`avasthas`). */
export const AVASTHA_VARGAS = [9, 10, 16, 24] as const;

/**
 * Natal chart-data catalogue ids required beforehand by the Comprehensive 18-Year Past Life Reading
 * (Parashara + Jaimini + Sanjay Rath + Lunar Astro multi-school retrospective engine).
 */
export const PAST_READING_NATAL_TYPES = [
  'panchanga.birth', 'karaka.chara', 'arudhas', 'house_counts', 'reading_tables', 'avasthas',
  'dignities', 'aspects', 'relations', 'benefic_malefic', 'bhava', 'sphutas', 'yogas', 'doshas',
  'ashtakavarga', 'strength.shadbala', 'strength.vimsopaka', 'strength.bhava', 'strength.harsha',
  'varga.d1', 'varga.d2', 'varga.d3', 'varga.d4', 'varga.d7', 'varga.d9', 'varga.d10', 'varga.d12',
  'varga.d16', 'varga.d20', 'varga.d24', 'varga.d27', 'varga.d30', 'varga.d60',
  'arudhas.d2', 'arudhas.d3', 'arudhas.d4', 'arudhas.d7', 'arudhas.d9', 'arudhas.d10', 'arudhas.d12',
  'arudhas.d20', 'arudhas.d24', 'arudhas.d30', 'arudhas.d60',
  'argala.d1', 'argala.d9', 'argala.d10', 'argala.d24',
  'dignities.d9', 'dignities.d10', 'dignities.d24',
  'avasthas.d9', 'avasthas.d10', 'avasthas.d16', 'avasthas.d24',
  'dasha.applicable',
  'dasha.dwisatpathi.l3', 'dasha.vimsottari.l3', 'dasha.yogini.l3', 'dasha.tithi_ashtottari.l3', 'dasha.kaala.l3', 'dasha.karaka.l3',
  'dasha.dwisatpathi', 'dasha.vimsottari', 'dasha.yogini', 'dasha.tithi_ashtottari', 'dasha.ashtottari',
  'dasha.narayana', 'dasha.chara', 'dasha.sudasa', 'dasha.drig', 'dasha.shoola', 'dasha.kalachakra',
  'dasha.moola', 'dasha.mandooka', 'dasha.sthira', 'dasha.trikona', 'dasha.kendradhi_rasi', 'dasha.lagnamsaka',
] as const;

/** Annual chart-data catalogue ids fetched for each solar/tithi year of the 18-year past reading window. */
export const PAST_READING_ANNUAL_TYPES = [
  'annual.tithi_pravesha',
  'annual.varsha',
  'annual.sahams',
  'annual.tithi_pravesha_dasha',
  'annual.patyayini',
  'annual.mudda',
] as const;

/** Moving transit types fetched across the 18-year past reading window. */
export const PAST_READING_MOVING_TYPES = [
  'transit_range',
  'transit_contacts',
] as const;

/**
 * Systems with a level-3 (pratyantar) entry (doc 34 §4.1): `dasha.<name>.l3`, Radha's `dasha.<name>` with `levels: 3`.
 * Separate rows, because the default `dasha.<name>` row stays at Radha's default of two levels. The wire type is always
 * `dasha.<name>`: the legacy `vimsottari_dasa` takes no params.
 */
export const LEVEL3_DASHAS = ['vimsottari', 'dwisatpathi', 'yogini', 'tithi_ashtottari', 'kaala', 'karaka'] as const;

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
  // dasha.brahma stays listed but unserved: Radha does not export it (pyjhora bug).
  natal({ id: 'dasha.applicable', family: 'dasha', radhaType: 'dasha.applicable', tier: 'on_demand', sortOrder: 250, label: 'Which conditional dashas apply' });
  LEVEL3_DASHAS.forEach((name, i) =>
    natal({ id: `dasha.${name}.l3`, family: 'dasha', radhaType: `dasha.${name}`, fixedParams: { levels: 3 }, tier: 'on_demand', sortOrder: 260 + i, label: `${name.replace(/_/g, ' ')} dasha to pratyantar (level 3)` })
  );
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
  natal({ id: 'relations', family: 'strength', radhaType: 'relations', tier: 'on_demand', sortOrder: 410, label: 'Planet relations (natural, temporary, compound)' });
  natal({ id: 'benefic_malefic', family: 'strength', radhaType: 'benefic_malefic', tier: 'on_demand', sortOrder: 420, label: 'Benefics and malefics (natural and functional, maraka lords)' });
  natal({ id: 'dignities', family: 'strength', radhaType: 'dignities', tier: 'on_demand', sortOrder: 430, label: 'Planet dignities (combust, retrograde, planetary war)' });
  // Radha param bhava_madhya_method 1-5, default 1; the stored row is the default method.
  natal({ id: 'bhava', family: 'special', radhaType: 'bhava', tier: 'on_demand', sortOrder: 440, label: 'Bhavas (cusps, lords, occupants)' });
  // Radha params varga (default 1) and chart_method (default 1); the stored row is the D1 default (M16).
  natal({ id: 'house_counts', family: 'special', radhaType: 'house_counts', tier: 'on_demand', sortOrder: 445, label: 'House counts (sign to house, house from house, from planet, from Arudha Lagna)' });
  natal({ id: 'reading_tables', family: 'special', radhaType: 'reading_tables', tier: 'on_demand', sortOrder: 446, label: 'Reading tables (arudha meanings, karaka roles, badhaka, maraka, correspondences)' });
  natal({ id: 'avasthas', family: 'strength', radhaType: 'avasthas', tier: 'on_demand', sortOrder: 447, label: 'Planetary avasthas (Baladi, Jagradadi, Deeptadi, Lajjitadi, Shayanadi), Lunar Astro points and dasha charter' });
  // One entry per divisional chart: the same Radha type with a fixed `varga` parameter (stored per entry, so the unique key
  // (kundli, data_type, variant, ayanamsa) never collides). `on_demand`: 23 extra calls per sign-up are not worth it.
  ARUDHA_ARGALA_VARGAS.forEach((f, i) => {
    if (f !== 1) {
      natal({ id: `arudhas.d${f}`, family: 'special', radhaType: 'arudhas', fixedParams: { varga: f }, tier: 'on_demand', sortOrder: 450 + i, label: `Arudha padas and special points (SL, HL, GK, MD) in D${f}` });
    }
    natal({ id: `argala.d${f}`, family: 'special', radhaType: 'argala', fixedParams: { varga: f }, tier: 'on_demand', sortOrder: 470 + i, label: `Argala in D${f}` });
    // Same pattern for the tables doc 34 reads in each area's own chart. Radha serves `aspect_strength` for D1 only (null elsewhere).
    if (f !== 1) {
      natal({ id: `dignities.d${f}`, family: 'strength', radhaType: 'dignities', fixedParams: { varga: f }, tier: 'on_demand', sortOrder: 700 + i, label: `Planet dignities, house lords and occupants in D${f}` });
      natal({ id: `aspects.d${f}`, family: 'strength', radhaType: 'aspects', fixedParams: { varga: f }, tier: 'on_demand', sortOrder: 720 + i, label: `Planet aspect table in D${f}` });
      natal({ id: `relations.d${f}`, family: 'strength', radhaType: 'relations', fixedParams: { varga: f }, tier: 'on_demand', sortOrder: 740 + i, label: `Planet relations (natural, temporary, compound) in D${f}` });
    }
  });
  AVASTHA_VARGAS.forEach((f, i) => {
    natal({ id: `avasthas.d${f}`, family: 'strength', radhaType: 'avasthas', fixedParams: { varga: f }, tier: 'on_demand', sortOrder: 760 + i, label: `Planetary avasthas in D${f}` });
  });

  const annual = (id: string, label: string, sortOrder: number, fixedParams?: Record<string, unknown>): void => {
    out.push({ id, family: 'annual', radhaType: id, changeClass: 'annual', tier: 'on_demand', variantKind: 'year', served: false, calcVersion: null, ...(fixedParams ? { fixedParams } : {}), sortOrder, label });
  };
  annual('annual.varsha', 'Varsha pravesh (Tajaka annual chart)', 500);
  annual('annual.tithi_pravesha', 'Tithi pravesha chart', 510);
  // doc 28 R-27a: Radha's `params.system` (tithi_ashtottari | mudda | patyayini). Stored per year AND system, variant
  // `year=<y>;system=<s>`; the registration pull asks for the default, Tithi Ashtottari, for the year that applies today.
  annual('annual.tithi_pravesha_dasha', 'Tithi pravesha year dasha (per year and system; default Tithi Ashtottari)', 515, { system: TITHI_PRAVESHA_DASHA_DEFAULT_SYSTEM });
  annual('annual.mudda', 'Mudda dasha', 520);
  annual('annual.patyayini', 'Patyayini dasha', 530);
  annual('annual.sahams', 'Sahams', 540);

  // Moving: depends on the moment asked for (`at`), so it is never stored per person (no kundli_data row).
  out.push({ id: 'transit', family: 'transit', radhaType: 'transit', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 600, label: 'Transit chart at a moment (any divisional chart)' });
  // Moving: depends on the date range asked for (`from`/`to`, plus `orb`, `planets`); fetched by fetchTransitContacts
  // (./transitContacts.ts), never stored per person.
  out.push({ id: 'transit_contacts', family: 'transit', radhaType: 'transit_contacts', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 610, label: 'Natal-degree contacts of slow transits (entry, exact, exit, station in orb)' });
  // Moving: the chart at the moment and place a question is asked (doc 28 R-27c); cast by castPrashna (./prashna.ts) and
  // stored per question in `prashna_casts`, never in kundli_data.
  out.push({ id: 'prashna', family: 'prashna', radhaType: 'prashna', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 620, label: 'Prashna chart at the question moment (panchanga, prashna lagna, vargas)' });
  // Moving: the dated sky over a long span (sign stays, stations, lunations, eclipses, Sade Sati phases) for the life
  // timeline; fetched by fetchTransitRange (./transitRange.ts), never stored per person.
  out.push({ id: 'transit_range', family: 'transit', radhaType: 'transit_range', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 630, label: 'Dated sky over up to 40 years (sign stays, stations, lunations, eclipses, Sade Sati)' });
  // Moving: day-level tables over a date range (doc 34, AIAstra_Radha docs/daily-types.md), never stored per person. Each
  // needs `from`/`to`; `daily_grade` and `muhurta` take the natal birth inside `params`. No server fetcher calls them yet.
  out.push({ id: 'daily_grade', family: 'transit', radhaType: 'daily_grade', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 640, label: 'Day grade over a date range (Moon star, tara, chandra bala, panchanga, events)' });
  out.push({ id: 'muhurta', family: 'panchanga', radhaType: 'muhurta', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 650, label: 'Muhurta tables per day at a place (sunrise, horas, muhurtas, kalas, optional natal grade)' });
  out.push({ id: 'transit_ashtakavarga', family: 'transit', radhaType: 'transit_ashtakavarga', changeClass: 'moving', tier: 'on_demand', variantKind: 'natal', served: false, calcVersion: null, sortOrder: 660, label: 'Dated transit positions scored by natal ashtakavarga (BAV, SAV, kakshya)' });
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
      // request parameters live in code only; keep them when a table row overrides the built-in entry
      ...(CHART_TYPE_BY_ID.get(r.id)?.fixedParams ? { fixedParams: CHART_TYPE_BY_ID.get(r.id)!.fixedParams } : {}),
      sortOrder: r.sort_order,
      label: r.label,
    });
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
