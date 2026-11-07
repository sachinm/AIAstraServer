/**
 * The named tabular layouts a technique contract reads its inputs in (docs/reading-engine/53 §4.3). A layout is only a
 * column list here: what a digest row of that section is rendered as when a technique is given it. Rendering comes with
 * the digest (doc 53 step 4); nothing here reads a chart.
 */

export interface TableLayout {
  id: string;
  columns: string[];
  description: string;
}

export const LAYOUTS = {
  house_card: {
    id: 'house_card',
    columns: ['varga', 'house', 'lord', 'lord_house', 'lord_dignity', 'occupants', 'aspected_graha', 'aspected_rasi', 'argala', 'sav', 'class', 'cusp_star'],
    description: 'One house of one varga from the digest `house` section: its lord and where the lord sits, occupants, aspects received, argala, SAV, class and cusp star',
  },
  planet_card: {
    id: 'planet_card',
    columns: ['varga', 'planet', 'sign', 'house', 'degree', 'star', 'dignity', 'retro', 'combust', 'dispositor', 'owns', 'aspects_to', 'aspected_by', 'conjunctions', 'shadbala_rank', 'nature', 'avasthas', 'avastha_multipliers', 'dasha_charter', 'sun_proximity', 'star_chain'],
    description: 'One planet of one varga from the digest `planet` section: place, dignity, state, dispositor and chains, avasthas and delivery multipliers, ownership, aspects, conjunctions, strength rank, nature, and D1 dashaCharter/sunProximity',
  },
  yoga_row: {
    id: 'yoga_row',
    columns: ['varga', 'yoga', 'present', 'class', 'planets', 'houses', 'rule'],
    description: 'One yoga or dosha from the digest `yoga` section with its class (raja, dhana, mahapurusha, dosha, cancellation) and the planets and houses it joins',
  },
  point_row: {
    id: 'point_row',
    columns: ['point', 'varga', 'sign', 'house', 'lord', 'lord_house'],
    description: 'One point (chara karaka, bhava/surya/chandra arudha, badhaka, special lagna, sphuta, or Lunar Astro K64M/K64L/KD22/BB) from the digest `point` section with its place and its lord',
  },
  star_profile: {
    id: 'star_profile',
    columns: ['point', 'star', 'pada', 'star_lord', 'tara', 'gandanta', 'pending_karma_houses'],
    description: 'The birth stars from the digest `star` section: Moon star and lagna star with their lords, the tara from the Moon star, gandanta flags, and pending karma houses',
  },
  annual_row: {
    id: 'annual_row',
    columns: ['year', 'kind', 'varga', 'lagna', 'house', 'lord', 'occupants', 'aspects', 'sahams', 'year_dasha', 'muntha', 'year_lord', 'tajaka_yogas'],
    description: 'One year chart (Tithi Pravesha or Varsha) from the digest `annual` section, one row per house, with its sahams, year dasha periods, and (when annual.tajaka is stored) muntha, year lord and Tajaka yogas',
  },
  activation_row: {
    id: 'activation_row',
    columns: ['system', 'family', 'level', 'lord_or_sign', 'from', 'to', 'houses', 'polarity'],
    description: 'One dasha period from the activation calendar (kundli_activation): the system, its family, the level, the period lord or sign, its dates and the houses it activates',
  },
  transit_row: {
    id: 'transit_row',
    columns: ['date', 'planet', 'sign', 'house_from_lagna', 'house_from_moon', 'house_from_al', 'contact', 'station', 'bindus'],
    description: 'One transit event from the shared sky with the kundli overlay: the planet, its sign, the houses from lagna, Moon and AL, the natal contact and the ashtakavarga bindus',
  },
  panchang_day: {
    id: 'panchang_day',
    columns: ['date', 'place', 'vara', 'tithi', 'nakshatra', 'yoga', 'karana', 'horas', 'avoid_bands', 'good_spans', 'tara', 'chandra_bala'],
    description: "One day at one place from the shared day table with the person's overlay: the five limbs, horas, the avoid bands and good spans, tara and chandra bala",
  },
  prashna_card: {
    id: 'prashna_card',
    columns: ['asked_at', 'place', 'lagna', 'house', 'lord', 'occupants', 'moon_star', 'arudha'],
    description: 'The chart of the question moment: lagna, one row per house with its lord and occupants, the Moon star and the prashna arudha',
  },
  findings_in: {
    id: 'findings_in',
    columns: ['technique', 'claim', 'evidence', 'polarity', 'weight', 'about'],
    description: "A synthesizer's input: one row per finding from the techniques below it, with the evidence keys it cites, its side, its weight and who it is about",
  },
  text_in: {
    id: 'text_in',
    columns: ['field', 'text'],
    description: 'A text agent\'s input (intake, clarify, the validator): one row per user-turn field, such as the question, the thread history, the clarify turns or the answer',
  },
} as const satisfies Record<string, TableLayout>;

export type LayoutId = keyof typeof LAYOUTS;
export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

export function layoutById(id: string): TableLayout | undefined {
  return (LAYOUTS as Record<string, TableLayout>)[id];
}
