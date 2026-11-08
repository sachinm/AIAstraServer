/** What every panel technique receives (docs/reading-engine/58 §4.1). */
import type { ActivationRow } from '../../digest/activation.js';
import type { DigestView, PlanetCard } from '../../digest/types.js';
import type { PanelBody, SelfClaim, SelfClock } from '../types.js';
import { dignityWords, PLANET_NAME, RIPENESS_WORDS } from '../words.js';
import type { Gaps } from '../slices.js';

export interface PanelInput {
  view: DigestView;
  asOf: string;
  clock: SelfClock;
  /** the reading clock and the confirming clocks, levels 1–2 over the life span, plus the reading clock's level 3 now */
  activation: ActivationRow[];
}

export const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
export const pname = (p: string | null | undefined): string => (p ? PLANET_NAME[p] ?? p : '?');

export function body(lead: string, claims: SelfClaim[], g: Gaps, extra: Partial<PanelBody> = {}): PanelBody {
  return { lead: claims.length ? lead : '', claims, gaps: g.list, ...extra };
}

/** "D1 h7 Virgo 3.81°, friend; star Uthiram (lord Su); dispositor Me h8; delivery dried_seed_externalized ×0.05" */
export function cardDetail(c: PlanetCard): string {
  const parts = [
    `${pname(c.planet)} ${c.varga} h${c.house ?? '?'} ${c.sign ?? '?'}${c.degree != null ? ` ${c.degree.toFixed(2)}°` : ''}`,
    c.dignity ? `dignity ${c.dignity}` : null,
    c.star ? `star ${c.star}${c.starLord ? ` (lord ${pname(c.starLord)})` : ''}` : null,
    c.dispositor ? `dispositor ${pname(c.dispositor)}${c.dispositorHouse != null ? ` h${c.dispositorHouse}` : ''}` : null,
    c.conjunctions?.length ? `with ${c.conjunctions.map(pname).join(', ')}` : null,
    c.aspectedBy?.length ? `aspected by ${c.aspectedBy.map(pname).join(', ')}` : null,
    c.avasthaMultipliers ? `delivery ${c.avasthaMultipliers.ripeness} ×${c.avasthaMultipliers.effective}` : null,
  ];
  return parts.filter(Boolean).join('; ');
}

/** Plain sentence on how a planet is held: its dignity and its avastha ripeness, both engine labels. Null when neither is stored. */
export function stateWords(c: PlanetCard): string | null {
  const dw = dignityWords(c.dignity);
  const rip = c.avasthaMultipliers?.ripeness ? RIPENESS_WORDS[c.avasthaMultipliers.ripeness] : undefined;
  if (!dw && !rip) return null;
  if (dw && rip) return `Where it sits it is ${dw}, and by its state it ${rip}.`;
  return dw ? `Where it sits it is ${dw}.` : `By its state it ${rip}.`;
}

export function hasCancellation(view: DigestView, planet: string): boolean {
  return view.yogas().some((y) => /cancel/i.test(y.class) && y.planets.includes(planet));
}
