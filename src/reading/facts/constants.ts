/**
 * Labels and codes only. Nothing here computes astrology: every placement, lordship, aspect, dasha date and
 * transit comes from the pyjhora Lambda (see docs/reading-engine/03-chart-facts-dossier.md and
 * schema/facts.v1.schema.json). Node selects, formats and cites; it never derives.
 */
export const PLANET_CODES = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'] as const;
export type PlanetCode = (typeof PLANET_CODES)[number];
export const LAGNA_CODE = 'La';
export const PLANET_NAMES: Record<PlanetCode, string> = {
  Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu',
};
export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
/** Divisional charts the Lambda dossier may carry (default set in 03-chart-facts-dossier.md §1). */
export const VARGA_KEYS = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D30', 'D60'] as const;
export type VargaKey = (typeof VARGA_KEYS)[number];
export const VARGA_LABELS: Record<VargaKey, string> = {
  D1: 'Rasi (D-1)', D2: 'Hora (D-2)', D3: 'Drekkana (D-3)', D4: 'Chaturthamsa (D-4)', D7: 'Saptamsa (D-7)',
  D9: 'Navamsa (D-9)', D10: 'Dasamsa (D-10)', D12: 'Dwadasamsa (D-12)', D30: 'Trimsamsa (D-30)', D60: 'Shastiamsa (D-60)',
};
