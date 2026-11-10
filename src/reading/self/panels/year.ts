/**
 * `self.reading.year` — This year (docs/reading-engine/58 §4.1, 66 §4.10). Tithi Pravesha led: the TP D1 row whose
 * return moment has passed (`runningTithiPravesha`, src/reading/annual/tithiPravesha.ts) is the year; its houses give the
 * year's 1st house and the house holding the natal lagna lord; the TP year dasha (when bounded to the year) is the short
 * clock. Varshaphala and its Mudda period only confirm, in the detail. Withheld when no TP year covers today; the Varsha
 * year is never used in its place.
 */
import { runningTithiPravesha, runningVarsha } from '../../annual/tithiPravesha.js';
import { dignityWords, faculties, HOUSE_SELF, HOUSE_SHORT, longDate, PLANET_FACULTY } from '../words.js';
import { gaps } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, pname, type PanelInput } from './common.js';

/** @deprecated the Varshaphala confirming clock; the year itself is `runningTithiPravesha` */
export const runningMudda = runningVarsha;

export function yearPanel({ view, asOf }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const tp = runningTithiPravesha(view, asOf);
  for (const x of tp.gaps) g.add(x);
  const row = tp.row;
  if (!row || tp.year == null) {
    g.add(`annual:TP covering ${asOf} missing`);
    return body('', [], g);
  }
  const tpYear = tp.year;
  const range = tp.from && tp.to ? { from: tp.from, to: tp.to } : ('always' as const);
  const v = tp.varsha;
  const confirm = v ? `; confirming VP${v.row.year} Mudda ${pname(v.lord)} ${v.from} → ${v.to}` : '';
  const l1 = view.house('D1', 1)?.lord ?? null;
  let lead = '';
  const at = l1 ? row.houses.find((h) => h.occupants.some((o) => o.planet === l1)) : undefined;
  const occ = at?.occupants.find((o) => o.planet === l1);
  if (at && occ) {
    const dw = dignityWords(occ.dignity);
    claims.push({ id: 'year.lord_place', line: `This year's chart puts the part of you that steers in ${HOUSE_SHORT[at.house]}${dw ? `, ${dw}` : ''}.`, text: `This year's chart puts the part of you that steers in ${HOUSE_SELF[at.house]}${dw ? `, ${dw}` : ''}.`, detail: `TP${tpYear} lagna ${row.lagna}; natal lagna lord ${pname(l1)} in year h${at.house} ${at.sign} (${occ.dignity ?? '?'})`, certainty: 'fact', evidence: [`annual:TP${tpYear}.D1`] });
    lead = `This year your chart puts the part of you that steers in ${HOUSE_SHORT[at.house]}.`;
    const others = at.occupants.filter((o) => o.planet !== l1).map((o) => o.planet);
    if (others.length) claims.push({ id: 'year.lord_company', text: `It shares that place with ${faculties(others)}.`, detail: `year h${at.house} occupants ${at.occupants.map((o) => `${pname(o.planet)} (${o.dignity ?? '?'})`).join(', ')}`, certainty: 'fact', evidence: [`annual:TP${tpYear}.D1`] });
  } else if (l1) g.add(`annual:TP${tpYear}.D1 lagna lord ${l1} not among occupants`);
  const y1 = row.houses.find((h) => h.house === 1);
  if (y1?.lordHouse) claims.push({ id: 'year.self_lord', text: `This year your self is steered from ${HOUSE_SELF[y1.lordHouse]}.`, detail: `TP${tpYear} h1 ${y1.sign}, lord ${pname(y1.lord)} in year h${y1.lordHouse} (${y1.lordDignity ?? '?'})`, certainty: 'fact', evidence: [`annual:TP${tpYear}.D1`] });
  for (const c of claims) c.range = range;
  const sc = tp.shortClock;
  if (sc && PLANET_FACULTY[sc.lord]) {
    claims.push({
      id: 'year.short_clock',
      range: { from: sc.from, to: sc.to },
      text: `Until ${longDate(sc.to)} the year's short clock runs through ${PLANET_FACULTY[sc.lord]}.`,
      detail: `TP${tpYear} ${sc.system} ${pname(sc.lord)} ${sc.from} → ${sc.to}${tp.start ? `; year from ${tp.start}${tp.end ? ` to ${tp.end}` : ''}` : ''}${confirm}`,
      certainty: 'fact',
      evidence: [`annual:TP${tpYear}.D1`, ...(v ? [`annual:VP${v.row.year}.D1`] : [])],
    });
  }
  return body(lead || (claims[0]?.text ?? ''), claims, g);
}
