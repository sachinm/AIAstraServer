/**
 * The served dasha systems, by name and mark (docs/techniques/09 §1 "Systems that pass decision 2", decision 2; SOUL.md
 * §5: only verified systems that apply to this chart are read, shown and counted). A words table chosen by the product
 * from the research and the engine reference test; nothing here is computed. When the engine reference test (doc 07
 * E1/E2) fails a system, its row turns to `never` here and it drops out of every pack, clock set and count.
 *
 *   show `always`     read, shown and counted whenever its rows are stored
 *   show `if_applies` a conditional dasha: shown only when the engine's `dasha.applicable` row says `applies: true`
 *   show `never`      flagged by the research, a longevity dasha, or not checked yet: never read, shown or counted
 *
 * `counted`: the system counts toward the depth floor's "at least two verified systems" and the clock agreement.
 * `levels`: `maha_only` when only the maha dasha level is verified (Narayana: its flag is on the sub-periods).
 * `storedAs`: the spellings the engine stores the system under (activation `system`, pressure variant `system=`).
 * `feed`: where its dated rows come from today: `pressure` (an engine pressure inventory, read by a clock reader),
 * `periods` (stored activation periods only, no engine verdict rows: rendered as plain period rows, never counted as a
 * clock's tone), `year` (the Tithi Pravesha year rows riding in every inventory), `annual` (a per-year table).
 */
import type { ApplicabilityRow } from '../self/clock.js';

export type SystemShow = 'always' | 'if_applies' | 'never';
export type SystemFamily = 'nakshatra' | 'conditional' | 'rasi' | 'year' | 'karaka' | 'other';
export type SystemFeed = 'pressure' | 'periods' | 'year' | 'annual';

export interface SystemDef {
  id: string;
  label: string;
  family: SystemFamily;
  show: SystemShow;
  counted: boolean;
  levels: 'all' | 'maha_only';
  storedAs: readonly string[];
  feed: SystemFeed;
  /** a longevity (ayur) dasha: never read as a timing clock */
  longevity?: boolean;
  /** another spelling of a system listed under this id */
  duplicateOf?: string;
  /** why it is shown or not, in a few words (staff only) */
  why: string;
}

const row = (d: Omit<SystemDef, 'storedAs'> & { storedAs?: readonly string[] }): SystemDef => ({ ...d, storedAs: d.storedAs ?? [d.id] });

export const SYSTEMS: readonly SystemDef[] = [
  // shown and counted (doc 09 §1)
  row({ id: 'vimsottari', label: 'Vimshottari', family: 'nakshatra', show: 'always', counted: true, levels: 'all', feed: 'pressure', why: 'lead clock; not flagged' }),
  row({ id: 'narayana', label: 'Narayana', family: 'rasi', show: 'always', counted: true, levels: 'maha_only', feed: 'pressure', why: 'its flag is on sub-periods; removed if the reference test fails' }),
  row({ id: 'sudasa', label: 'Sudasa', family: 'rasi', show: 'always', counted: true, levels: 'all', feed: 'periods', why: "not flagged; Rath's clock for pay and standing" }),
  row({ id: 'lagna_kendradi', label: 'Lagna Kendradi', family: 'rasi', show: 'always', counted: true, levels: 'all', feed: 'periods', storedAs: ['lagna_kendradi', 'kendradhi_rasi', 'kendradi_rasi'], why: 'matches the reference by code reading; low weight' }),
  row({ id: 'patyayini', label: 'Patyayini', family: 'year', show: 'always', counted: true, levels: 'all', feed: 'annual', why: 'in-year; verified by a run' }),
  row({ id: 'tithi_pravesha', label: 'Tithi Pravesha year', family: 'year', show: 'always', counted: true, levels: 'all', feed: 'year', why: 'the year chart' }),
  // the conditional dashas: shown only when the engine says the condition holds for this chart
  row({ id: 'dwisatpathi', label: 'Dwisaptati Sama', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', why: 'conditional; the engine checks the condition' }),
  row({ id: 'ashtottari', label: 'Ashtottari', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', why: 'conditional' }),
  row({ id: 'chathuraaseethi_sama', label: 'Chaturaseeti Sama', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', storedAs: ['chathuraaseethi_sama', 'chaturshitisama'], why: 'conditional' }),
  row({ id: 'dwadasottari', label: 'Dwadashottari', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', storedAs: ['dwadasottari', 'dwadashottari'], why: 'conditional' }),
  row({ id: 'panchottari', label: 'Panchottari', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', why: 'conditional' }),
  row({ id: 'sataatbika', label: 'Shatabdika', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', storedAs: ['sataatbika', 'shatabdika'], why: 'conditional' }),
  row({ id: 'shastihayani', label: 'Shashtihayani', family: 'conditional', show: 'if_applies', counted: true, levels: 'all', feed: 'pressure', why: 'conditional' }),
  // never shown: not checked yet (conditional)
  row({ id: 'shodasottari', label: 'Shodashottari', family: 'conditional', show: 'never', counted: false, levels: 'all', feed: 'pressure', storedAs: ['shodasottari', 'shodashottari'], why: 'not checked yet' }),
  row({ id: 'shattrimsa_sama', label: 'Shattrimsha Sama', family: 'conditional', show: 'never', counted: false, levels: 'all', feed: 'pressure', storedAs: ['shattrimsa_sama', 'shattrimsatsama', 'shattrimshatsama'], why: 'not checked yet' }),
  // never shown: flagged by the research
  row({ id: 'yogini', label: 'Yogini', family: 'other', show: 'never', counted: false, levels: 'all', feed: 'pressure', why: 'flagged' }),
  row({ id: 'chara', label: 'Chara', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'pressure', why: 'flagged' }),
  row({ id: 'drig', label: 'Drig', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', why: 'flagged' }),
  row({ id: 'trikona', label: 'Trikona', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', why: 'flagged' }),
  row({ id: 'mandooka', label: 'Mandooka', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', why: 'flagged' }),
  row({ id: 'tara', label: 'Tara', family: 'other', show: 'never', counted: false, levels: 'all', feed: 'periods', why: 'flagged' }),
  row({ id: 'naisargika', label: 'Naisargika', family: 'karaka', show: 'never', counted: false, levels: 'all', feed: 'periods', why: 'flagged' }),
  row({ id: 'mudda', label: 'Varshaphal Mudda', family: 'year', show: 'never', counted: false, levels: 'all', feed: 'annual', why: 'flagged' }),
  // never shown: longevity dashas
  row({ id: 'shoola', label: 'Shoola', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', longevity: true, why: 'longevity' }),
  row({ id: 'sthira', label: 'Sthira', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', longevity: true, why: 'longevity' }),
  row({ id: 'brahma', label: 'Brahma', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', longevity: true, why: 'longevity' }),
  row({ id: 'nirayana', label: 'Niryana Shoola', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', longevity: true, storedAs: ['nirayana', 'niryana_shoola'], why: 'longevity' }),
  row({ id: 'navamsa', label: 'Navamsa Dasha', family: 'rasi', show: 'never', counted: false, levels: 'all', feed: 'periods', longevity: true, why: 'longevity' }),
  row({ id: 'aayu', label: 'Aayu', family: 'other', show: 'never', counted: false, levels: 'all', feed: 'periods', longevity: true, why: 'longevity' }),
  // never shown: stored but not checked against the research or the reference yet
  ...['karaka', 'kaala', 'tithi_ashtottari', 'tithi_yogini', 'kalachakra', 'moola', 'chakra', 'padhanadhamsa', 'varnada', 'lagnamsaka', 'paryaaya', 'sandhya', 'tara_lagna', 'yogardha', 'buddhi_gathi', 'yoga_vimsottari', 'karana_chathuraaseethi_sama', 'karakendradi_graha', 'pindakartari', 'ashtakavarga', 'sudarshana_chakra'].map((id) =>
    row({ id, label: id, family: ['karaka', 'kaala'].includes(id) ? 'karaka' : 'other', show: 'never', counted: false, levels: 'all', feed: 'periods', why: 'not checked yet' }),
  ),
];

const BY_STORED = new Map<string, SystemDef>();
for (const s of SYSTEMS) for (const n of [s.id, ...s.storedAs]) if (!BY_STORED.has(n)) BY_STORED.set(n, s);

/** the table row for a stored system name (any spelling), or null for a system the table does not know */
export function systemDef(stored: string): SystemDef | null {
  return BY_STORED.get(stored.replace(/^dasha\./, '')) ?? null;
}

/** The engine's verdict for a conditional system: true applies, false does not, null not checked or no row. */
function applies(def: SystemDef, applicability: readonly ApplicabilityRow[] | null): boolean | null {
  const r = applicability?.find((x) => x.system === def.id || def.storedAs.includes(x.system) || x.names.some((n) => def.storedAs.includes(n)));
  return r ? r.applies : null;
}

/**
 * Shown for this chart: an `always` system, or an `if_applies` system the engine says applies. An unknown system is
 * never shown (a system enters the reading by a row in this table, never by being stored).
 */
export function isShown(stored: string, applicability: readonly ApplicabilityRow[] | null = null): boolean {
  const d = systemDef(stored);
  if (!d || d.duplicateOf) return false;
  if (d.show === 'always') return true;
  if (d.show === 'if_applies') return applies(d, applicability) === true;
  return false;
}

/** shown AND counted toward the floor's two systems and the clock agreement */
export function isCounted(stored: string, applicability: readonly ApplicabilityRow[] | null = null): boolean {
  return isShown(stored, applicability) && Boolean(systemDef(stored)?.counted);
}

/** a level of a shown system that is verified (Narayana: the maha dasha level only) */
export function levelShown(stored: string, level: number): boolean {
  const d = systemDef(stored);
  return Boolean(d) && (d!.levels === 'all' || level === 1);
}

export interface ShownSystem {
  id: string;
  label: string;
  /** the spelling stored for this chart */
  stored: string;
  feed: SystemFeed;
  levels: SystemDef['levels'];
}

/**
 * The verified systems to read for this chart, in table order: each shown system whose rows are stored (`present`: the
 * stored system names; the year and Patyayini need none). The floor that keeps a board from blanking (Vimshottari, one
 * sign dasha and the year) is reported by `floorMissing`.
 */
export function shownSystems(present: readonly string[], applicability: readonly ApplicabilityRow[] | null): ShownSystem[] {
  const has = new Set(present.map((s) => s.replace(/^dasha\./, '')));
  const out: ShownSystem[] = [];
  for (const d of SYSTEMS) {
    if (d.duplicateOf || d.show === 'never') continue;
    if (d.show === 'if_applies' && applies(d, applicability) !== true) continue;
    const stored = d.feed === 'year' || d.feed === 'annual' ? d.id : d.storedAs.find((n) => has.has(n));
    if (!stored) continue;
    out.push({ id: d.id, label: d.label, stored, feed: d.feed, levels: d.levels });
  }
  return out;
}

/** what the floor (Vimshottari, one sign dasha, the year) lacks in a shown set; [] when it holds */
export function floorMissing(shown: readonly ShownSystem[]): string[] {
  const miss: string[] = [];
  if (!shown.some((s) => s.id === 'vimsottari')) miss.push('vimsottari');
  if (!shown.some((s) => systemDef(s.id)?.family === 'rasi')) miss.push('a sign dasha');
  if (!shown.some((s) => s.id === 'tithi_pravesha')) miss.push('the year');
  return miss;
}

/** the counted systems of a shown set, by stored name (the depth floor's verified list) */
export function countedNames(shown: readonly ShownSystem[]): string[] {
  return [...new Set(shown.filter((s) => systemDef(s.id)?.counted).flatMap((s) => [s.stored, s.id, ...(systemDef(s.id)?.storedAs ?? [])]))];
}

/** one stored period row (`kundli_activation`), the fields the period block reads */
export interface PeriodRowLike {
  system: string;
  level: number;
  lord: string | null;
  sign: string | null;
  from: string;
  to: string;
  houses: readonly number[];
}

/** the key a stored period row is cited by (the spelling `family.dasha` writes) */
export const periodKey = (r: PeriodRowLike): string => `activation:${r.system}/${r.level}/${r.lord ?? r.sign}@${r.from}`;

/**
 * The stored period rows of the shown systems that have no engine pressure rows (`feed: 'periods'`, today Sudasa and
 * Lagna Kendradi; docs/techniques/09 §8 step 5), levels 1–2 (Narayana-style systems at their verified levels only),
 * overlapping `window`, as keyed lines for the lens linemen and the card Oracle. Selection and formatting only: the
 * dates, signs and houses are the engine's.
 */
export function renderShownPeriods(rows: readonly PeriodRowLike[], shown: readonly ShownSystem[], window: { from: string; to: string }): { text: string; keys: string[] } {
  const want = shown.filter((s) => s.feed === 'periods');
  const keys: string[] = [];
  const L: string[] = [];
  for (const s of want) {
    const names = new Set([s.stored, ...(systemDef(s.id)?.storedAs ?? [])]);
    const mine = rows
      .filter((r) => names.has(r.system) && r.level <= 2 && levelShown(s.id, r.level) && r.from < window.to && window.from < r.to)
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.level - b.level));
    if (!mine.length) continue;
    L.push(`## ${s.label} (${s.id}; stored periods, no engine verdict rows: read the sign, its occupants and its lord from the chart)`);
    for (const r of mine) {
      const k = periodKey(r);
      keys.push(k);
      L.push(`{${k}} system=${s.id} L${r.level} ${r.sign ? `sign=${r.sign}` : `lord=${r.lord}`} ${r.from}..${r.to} houses=[${[...r.houses].sort((a, b) => a - b).join(',')}]`);
    }
  }
  if (!L.length) return { text: '', keys: [] };
  return { text: ['# VERIFIED SYSTEMS READ FROM STORED PERIODS', ...L].join('\n'), keys };
}
