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

const MAX_TP_YEAR_DAYS = 400;
const DAY_MS = 86_400_000;

export function runningMudda(view: PanelInput['view'], asOf: string): { row: AnnualRow; lord: string; from: string; to: string } | null {
  for (const row of view.annual()) {
    if (row.kind !== 'VP' || row.varga !== 'D1') continue;
    const mudda = row.dashas.find((d) => d.system === 'mudda');
    const p = mudda?.periods.find((x) => x.from <= asOf && asOf < x.to);
    if (p) return { row, lord: p.lord, from: p.from, to: p.to };
  }
  return null;
}

/**
 * Resolves the active Tithi Pravesha (`TP`) `D1` row covering `asOf`.
 * Prefers a `TP` `D1` row with a year-sized (`<= 400` days) dasha span covering `asOf`,
 * else the latest `TP` `D1` row whose period span covers `asOf` (with `year >= fallbackYear`),
 * else the `TP` `D1` row matching `fallbackYear`.
 */
export function runningTp(view: PanelInput['view'], asOf: string, fallbackYear?: number): AnnualRow | null {
  const tpRows = view.annual().filter((r) => r.kind === 'TP' && r.varga === 'D1');
  if (!tpRows.length) return null;

  for (const row of tpRows) {
    for (const d of row.dashas) {
      if (!d.periods.length) continue;
      const from = d.periods.map((p) => p.from).sort()[0]!;
      const to = d.periods.map((p) => p.to).sort().at(-1)!;
      const days = (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS;
      if (days > 0 && days <= MAX_TP_YEAR_DAYS && from <= asOf && asOf < to) {
        return row;
      }
    }
  }

  const covering = tpRows
    .filter((row) => {
      if (fallbackYear !== undefined && row.year < fallbackYear) return false;
      const periods = row.dashas.flatMap((d) => d.periods);
      if (!periods.length) return false;
      const from = periods.map((p) => p.from).sort()[0]!;
      const to = periods.map((p) => p.to).sort().at(-1)!;
      return from <= asOf && asOf < to;
    })
    .sort((a, b) => b.year - a.year);
  if (covering[0]) return covering[0];

  if (fallbackYear !== undefined) {
    return view.annual(fallbackYear).find((r) => r.kind === 'TP' && r.varga === 'D1') ?? null;
  }
  return null;
}

/**
 * Resolves the active `tithi_ashtottari` period on a Tithi Pravesha (`TP`) `D1` row covering `asOf`.
 * When the stored `tithi_ashtottari` periods span a 108-year uncompressed cycle (`> 400` days) and a 1-year `annualWindow`
 * (e.g. from the Varshaphal `mudda` return year) is available, proportionally compresses the 9 periods into `annualWindow`.
 */
export function activeTpAshtottariPeriod(
  tpRow: AnnualRow | null | undefined,
  asOf: string,
  annualWindow?: { from: string; to: string } | null,
): { lord: string; from: string; to: string; compressed: boolean } | null {
  if (!tpRow) return null;
  const ta = tpRow.dashas.find((d) => d.system.includes('tithi') || d.system.includes('ashtottari')) ?? tpRow.dashas[0];
  if (!ta || !ta.periods.length) return null;
  const sorted = [...ta.periods].sort((a, b) => a.from.localeCompare(b.from));
  const rawFromMs = new Date(`${sorted[0]!.from}T00:00:00Z`).getTime();
  const rawToMs = new Date(`${sorted.at(-1)!.to}T00:00:00Z`).getTime();
  const rawSpanMs = rawToMs - rawFromMs;
  const rawDays = rawSpanMs / DAY_MS;

  if (rawDays > 0 && rawDays <= MAX_TP_YEAR_DAYS) {
    const direct = sorted.find((p) => p.from <= asOf && asOf < p.to) ?? sorted[0]!;
    return { lord: direct.lord, from: direct.from, to: direct.to, compressed: false };
  }

  if (rawSpanMs > 0 && annualWindow) {
    const winFromMs = new Date(`${annualWindow.from}T00:00:00Z`).getTime();
    const winToMs = new Date(`${annualWindow.to}T00:00:00Z`).getTime();
    const winSpanMs = winToMs - winFromMs;
    if (winSpanMs > 0) {
      const scaled = sorted.map((p) => {
        const pFromMs = new Date(`${p.from}T00:00:00Z`).getTime();
        const pToMs = new Date(`${p.to}T00:00:00Z`).getTime();
        const sFrom = new Date(winFromMs + ((pFromMs - rawFromMs) / rawSpanMs) * winSpanMs).toISOString().slice(0, 10);
        const sTo = new Date(winFromMs + ((pToMs - rawFromMs) / rawSpanMs) * winSpanMs).toISOString().slice(0, 10);
        return { lord: p.lord, from: sFrom, to: sTo };
      });
      const hit = scaled.find((p) => p.from <= asOf && asOf < p.to) ?? scaled[0]!;
      return { ...hit, compressed: true };
    }
  }

  const fallback = sorted.find((p) => p.from <= asOf && asOf < p.to) ?? sorted[0]!;
  return { lord: fallback.lord, from: fallback.from, to: fallback.to, compressed: false };
}

export function yearPanel({ view, asOf }: PanelInput): PanelBody {
  const yearRange = (r: { from: string; to: string } | null) => r ?? ('always' as const);
  const g = gaps();
  const claims: SelfClaim[] = [];
  const m = runningMudda(view, asOf);
  if (!m) {
    g.add(`annual:VP covering ${asOf} missing`);
    return body('', [], g);
  }
  const year = m.row.year;
  const tp = runningTp(view, asOf, year);
  const tpYear = tp?.year ?? year;
  const l1 = view.house('D1', 1)?.lord ?? null;
  const mudda = m.row.dashas.find((d) => d.system === 'mudda');
  const span = mudda?.periods.length
    ? { from: mudda.periods.map((p) => p.from).sort()[0]!, to: mudda.periods.map((p) => p.to).sort().at(-1)! }
    : null;
  const ta = activeTpAshtottariPeriod(tp, asOf, span);
  let lead = '';
  if (!tp) g.add(`annual:TP${tpYear}.D1 missing`);
  else {
    const at = l1 ? tp.houses.find((h) => h.occupants.some((o) => o.planet === l1)) : undefined;
    const occ = at?.occupants.find((o) => o.planet === l1);
    if (at && occ) {
      const dw = dignityWords(occ.dignity);
      claims.push({ id: 'year.lord_place', line: `This year's chart puts the part of you that steers in ${HOUSE_SHORT[at.house]}${dw ? `, ${dw}` : ''}.`, text: `This year's chart puts the part of you that steers in ${HOUSE_SELF[at.house]}${dw ? `, ${dw}` : ''}.`, detail: `TP${tpYear} lagna ${tp.lagna}; natal lagna lord ${pname(l1)} in year h${at.house} ${at.sign} (${occ.dignity ?? '?'})`, certainty: 'fact', evidence: [`annual:TP${tpYear}.D1`] });
      lead = `This year your chart puts the part of you that steers in ${HOUSE_SHORT[at.house]}.`;
      const others = at.occupants.filter((o) => o.planet !== l1).map((o) => o.planet);
      if (others.length) claims.push({ id: 'year.lord_company', text: `It shares that place with ${faculties(others)}.`, detail: `year h${at.house} occupants ${at.occupants.map((o) => `${pname(o.planet)} (${o.dignity ?? '?'})`).join(', ')}`, certainty: 'fact', evidence: [`annual:TP${tpYear}.D1`] });
    } else if (l1) g.add(`annual:TP${tpYear}.D1 lagna lord ${l1} not among occupants`);
    const y1 = tp.houses.find((h) => h.house === 1);
    if (y1?.lordHouse) claims.push({ id: 'year.self_lord', text: `This year your self is steered from ${HOUSE_SELF[y1.lordHouse]}.`, detail: `TP${tpYear} h1 ${y1.sign}, lord ${pname(y1.lord)} in year h${y1.lordHouse} (${y1.lordDignity ?? '?'})`, certainty: 'fact', evidence: [`annual:TP${tpYear}.D1`] });
  }
  for (const c of claims) c.range = yearRange(span);
  if (PLANET_FACULTY[m.lord]) {
    claims.push({
      id: 'year.short_clock',
      range: { from: m.from, to: m.to },
      text: `Until ${longDate(m.to)} the year's short clock runs through ${PLANET_FACULTY[m.lord]}.`,
      detail: `VP${year} Mudda ${pname(m.lord)} ${m.from} → ${m.to}${ta ? `; TP${tpYear} tithi_ashtottari ${pname(ta.lord)} ${ta.from} → ${ta.to}` : ''}`,
      certainty: 'fact',
      evidence: [`annual:VP${year}.D1`],
    });
  }
  return body(lead || (claims[0]?.text ?? ''), claims, g);
}
