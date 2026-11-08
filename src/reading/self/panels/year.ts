/**
 * `self.reading.year` — This year (docs/reading-engine/58 §4.1). Reads the digest's annual rows: the Varsha (VP) D1 row
 * whose Mudda periods cover today picks the year; the Tithi Pravesha (TP) D1 row of that year gives the year's 1st house
 * and the house holding the natal lagna lord; the running Mudda lord is the year's short clock. Withheld when no year
 * row covers today.
 */
import type { AnnualRow } from '../../digest/types.js';
import { dignityWords, faculties, HOUSE_SELF, HOUSE_SHORT, longDate, PLANET_FACULTY } from '../words.js';
import { gaps } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, pname, type PanelInput } from './common.js';

export function runningMudda(view: PanelInput['view'], asOf: string): { row: AnnualRow; lord: string; from: string; to: string } | null {
  for (const row of view.annual()) {
    if (row.kind !== 'VP' || row.varga !== 'D1') continue;
    const mudda = row.dashas.find((d) => d.system === 'mudda');
    const p = mudda?.periods.find((x) => x.from <= asOf && asOf < x.to);
    if (p) return { row, lord: p.lord, from: p.from, to: p.to };
  }
  return null;
}

export function yearPanel({ view, asOf }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const m = runningMudda(view, asOf);
  if (!m) { g.add(`annual:VP covering ${asOf} missing`); return body('', [], g); }
  const year = m.row.year;
  const tp = view.annual(year).find((r) => r.kind === 'TP' && r.varga === 'D1');
  const l1 = view.house('D1', 1)?.lord ?? null;
  let lead = '';
  if (!tp) g.add(`annual:TP${year}.D1 missing`);
  else {
    const at = l1 ? tp.houses.find((h) => h.occupants.some((o) => o.planet === l1)) : undefined;
    const occ = at?.occupants.find((o) => o.planet === l1);
    if (at && occ) {
      const dw = dignityWords(occ.dignity);
      claims.push({ id: 'year.lord_place', text: `This year's chart puts the part of you that steers in ${HOUSE_SELF[at.house]}${dw ? `, ${dw}` : ''}.`, detail: `TP${year} lagna ${tp.lagna}; natal lagna lord ${pname(l1)} in year h${at.house} ${at.sign} (${occ.dignity ?? '?'})`, certainty: 'fact', evidence: [`annual:TP${year}.D1`] });
      lead = `This year your chart puts the part of you that steers in ${HOUSE_SHORT[at.house]}.`;
      const others = at.occupants.filter((o) => o.planet !== l1).map((o) => o.planet);
      if (others.length) claims.push({ id: 'year.lord_company', text: `It shares that place with ${faculties(others)}.`, detail: `year h${at.house} occupants ${at.occupants.map((o) => `${pname(o.planet)} (${o.dignity ?? '?'})`).join(', ')}`, certainty: 'fact', evidence: [`annual:TP${year}.D1`] });
    } else if (l1) g.add(`annual:TP${year}.D1 lagna lord ${l1} not among occupants`);
    const y1 = tp.houses.find((h) => h.house === 1);
    if (y1?.lordHouse) claims.push({ id: 'year.self_lord', text: `This year your self is steered from ${HOUSE_SELF[y1.lordHouse]}.`, detail: `TP${year} h1 ${y1.sign}, lord ${pname(y1.lord)} in year h${y1.lordHouse} (${y1.lordDignity ?? '?'})`, certainty: 'fact', evidence: [`annual:TP${year}.D1`] });
  }
  if (PLANET_FACULTY[m.lord]) claims.push({ id: 'year.short_clock', text: `Until ${longDate(m.to)} the year's short clock runs through ${PLANET_FACULTY[m.lord]}.`, detail: `VP${year} Mudda ${pname(m.lord)} ${m.from} → ${m.to}`, certainty: 'fact', evidence: [`annual:VP${year}.D1`] });
  return body(lead || (claims[0]?.text ?? ''), claims, g);
}
