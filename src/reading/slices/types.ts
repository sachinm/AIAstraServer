/**
 * Kundli slices (docs/reading-engine/70 §4.1 Layer 1): the stored engine rows rendered once into fixed text blocks.
 *
 * | Slice              | Holds                                                                      | Read by                      |
 * |--------------------|----------------------------------------------------------------------------|------------------------------|
 * | `natal.core`       | the natal and divisional packs and the promise ledger                       | everyone (cached prefix)     |
 * | `sky.window`       | transits, Saturn's passage, stations, returns (clock-independent, once)     | everyone (cached prefix)     |
 * | `year.tp`          | the Tithi Pravesha year: year chart keys, the year rows and sub-periods     | everyone; the year reader    |
 * | `frame`            | the spans, their edges and the clock-independent rows overlapping each      | everyone (cached prefix)     |
 * | `clock.<system>`   | that clock's periods (levels 1–3, a year back to 18 months ahead) by span   | that clock's reader only     |
 * | `matter.<key>`     | per engine matter key: its promise entries and every dated row touching it  | the cards naming that matter |
 *
 * Node selects, joins, counts and formats only. Every value is the engine's, carried through by row id.
 */

export type SliceKind = 'natal.core' | 'sky.window' | 'year.tp' | 'frame' | 'clock' | 'matter';

/** `natal.core`, `sky.window`, `year.tp`, `frame`, `clock.<system>`, `matter.<key>` */
export type SliceId = string;

export const SHARED_SLICE_IDS = ['natal.core', 'sky.window', 'year.tp', 'frame'] as const;
export type SharedSliceId = (typeof SHARED_SLICE_IDS)[number];

export const clockSliceId = (system: string): SliceId => `clock.${system}`;
export const matterSliceId = (matter: string): SliceId => `matter.${matter}`;

/** the stored data a slice was rendered from */
export interface SliceSource {
  /** `pressure_inventory`, `kundli_digest`, `year_frame` */
  dataType: string;
  /** `system=<clock>`, the digest version, the frame's `asOf..to` */
  variant: string;
  calcVersion: string;
  /** short hash of the rows or text read from it (changes only when what was read changes) */
  hash: string;
}

export interface RenderedSlice {
  id: SliceId;
  text: string;
  /** evidence keys the text carries in `{braces}`, sorted */
  keys: string[];
  /** provider-token estimate (chars / 2.2) */
  estTokens: number;
  /** sorted by dataType then variant */
  sources: SliceSource[];
  /** short hash of id, text and keys: the same rows always give the same hash */
  hash: string;
}

export interface StoredSlice extends RenderedSlice {
  builtAt: string;
}
