/**
 * S3 `self.sub.windows` (docs/reading-engine/66 §4.8): dated windows around asOf. When the engine's `pressure_inventory`
 * on the primary clock is stored (`kundli_data`, src/reading/self/sub/pressure.ts), its rows are the windows as the
 * engine graded them (houses touched, matters, polarity, strength 1–3, true dates) and `degraded` is false. Rahu and
 * Ketu periods always press in the engine's table; that is kept as given.
 *
 * The engine's `annual` rows (the Tithi Pravesha year window with its year lord and the houses the year lagna activates,
 * and level-2 year periods) and `return` rows (Saturn and Jupiter returns) arrive with calc_version 2; they are windows
 * like any other (strip, byMatter, startedLast12m, endingNext6m) and S5 reads them as risk rows from the year chart.
 *
 * Degraded mode (§8, no inventory stored or the pull failed): the rows are the primary clock's activation periods
 * (levels 1–3, houses as stored) and the stored sky overlay (ingresses with `house_from_lagna` / `house_from_moon`,
 * Sade Sati and dhaiya spans). Polarity is the engine's functional-nature label of the period lord (`FUNCTIONAL_POLARITY`);
 * a transit or rasi period has no engine polarity, so it is 'mixed'. The engine stores no 1–3 strength grade yet, so
 * every row is 2 and `degraded` is true; a gap says so. "Since" / "until" are kept only where the stored row has them.
 */
import { addMonthsIso } from '../../timeline/months.js';
import { activationKey } from '../slices.js';
import { FUNCTIONAL_POLARITY, mattersOf } from '../v2words.js';
import type { ClockResolution, Matter, Polarity, Strength, WindowRef, WindowRow, WindowSetDetail } from '../v2types.js';
import type { SubEnv } from './common.js';
import { getWindowTransitPlanets, isLive, overlaps } from './config.js';

/** the row range S3 reads around asOf (doc 66 §4.3: −3 y … +3 y) */
export const WINDOW_RANGE_MONTHS = 36;
export const STRIP_MONTHS = 6;
const DEGRADED_STRENGTH: Strength = 2;

export const toRef = (w: WindowRow): WindowRef => ({ rowId: w.rowId, matters: w.matters, polarity: w.polarity, strength: w.strength, from: w.from, to: w.to });

function polarityOf(env: SubEnv, planet: string | null): Polarity {
  if (!planet) return 'mixed';
  const f = env.view.planet('D1', planet)?.functional ?? null;
  if (!f) {
    env.g.add(`windows: planet:D1.${planet}.functional missing; polarity mixed`);
    return 'mixed';
  }
  const p = FUNCTIONAL_POLARITY[f.toLowerCase()];
  if (!p) env.g.add(`windows: functional label ${f} of ${planet} not in FUNCTIONAL_POLARITY; polarity mixed`);
  return p ?? 'mixed';
}

type SkySpan = { phase: string; from: string; to: string; starts_before_range?: boolean; ends_after_range?: boolean };

/** every stored window of the primary clock and the sky overlay that overlaps asOf ± 36 months */
export function windowRows(env: SubEnv, clock: ClockResolution): WindowRow[] {
  const lo = addMonthsIso(env.asOf, -WINDOW_RANGE_MONTHS);
  const hi = addMonthsIso(env.asOf, WINDOW_RANGE_MONTHS);
  const rows: WindowRow[] = [];
  for (const r of env.activation) {
    if (r.system !== clock.primary || !overlaps(r.from, r.to, lo, hi)) continue;
    const id = activationKey(r);
    rows.push({
      rowId: id,
      kind: 'dasha',
      level: r.level,
      planet: r.lord,
      houses: [...r.houses],
      houseFromMoon: null,
      matters: mattersOf(r.houses),
      polarity: polarityOf(env, r.lord),
      strength: DEGRADED_STRENGTH,
      from: r.from,
      to: r.to,
      sinceKnown: true,
      untilKnown: true,
      evidence: [id],
    });
  }
  const sky = env.sky;
  if (!sky) env.g.add('windows: no stored sky overlay covers asOf; transit rows absent');
  else {
    const keep = new Set(getWindowTransitPlanets());
    for (const x of sky.ingresses ?? []) {
      if (!keep.has(x.planet) || !overlaps(x.from, x.to, lo, hi)) continue;
      const id = `sky:ingress/${x.planet}/${x.sign}@${x.from}`;
      const houses = Number.isInteger(x.house_from_lagna) ? [x.house_from_lagna] : [];
      if (!houses.length) env.g.add(`windows: ${id} house_from_lagna missing`);
      rows.push({
        rowId: id,
        kind: 'transit',
        planet: x.planet,
        houses,
        houseFromMoon: Number.isInteger(x.house_from_moon) ? x.house_from_moon : null,
        matters: mattersOf(houses),
        polarity: 'mixed',
        strength: DEGRADED_STRENGTH,
        from: x.from,
        to: x.to,
        sinceKnown: !x.starts_before_range,
        untilKnown: !x.ends_after_range,
        evidence: [id],
      });
    }
    const spans: Array<[string, SkySpan[]]> = [
      ['sade_sati', sky.sade_sati ?? []],
      ['dhaiya', sky.dhaiya ?? []],
    ];
    for (const [label, list] of spans) {
      for (const s of list) {
        if (!overlaps(s.from, s.to, lo, hi)) continue;
        const id = `sky:${label}/${s.phase}@${s.from}`;
        rows.push({
          rowId: id,
          kind: label === 'sade_sati' ? 'sade_sati' : 'transit',
          planet: 'Sa',
          houses: [],
          houseFromMoon: null,
          matters: [],
          polarity: 'mixed',
          strength: DEGRADED_STRENGTH,
          from: s.from,
          to: s.to,
          sinceKnown: !s.starts_before_range,
          untilKnown: !s.ends_after_range,
          evidence: [id],
        });
      }
    }
  }
  return rows.sort((a, b) => a.from.localeCompare(b.from) || (a.level ?? 9) - (b.level ?? 9) || a.rowId.localeCompare(b.rowId));
}

/** the kinds that hold on every clock (the year chart and the planet returns): kept even when the inventory is another clock's */
export const CLOCK_FREE_KINDS: ReadonlySet<string> = new Set(['annual', 'return']);

/**
 * The engine's inventory rows overlapping asOf ± 36 months, as S3 rows (values carried, nothing recomputed). `only`
 * keeps just the clock-free kinds (`annual` Tithi Pravesha year rows, `return` rows) for degraded mode.
 */
export function pressureWindowRows(env: SubEnv, only?: ReadonlySet<string>): WindowRow[] {
  const inv = env.pressure;
  if (!inv) return [];
  const lo = addMonthsIso(env.asOf, -WINDOW_RANGE_MONTHS);
  const hi = addMonthsIso(env.asOf, WINDOW_RANGE_MONTHS);
  return inv.rows
    .filter((r) => (!only || only.has(r.kind)) && overlaps(r.from, r.to, lo, hi))
    .map((r) => ({
      rowId: r.id,
      kind: r.kind,
      ...(r.level ? { level: r.level } : {}),
      planet: r.planet || null,
      houses: [...r.housesTouched],
      houseFromMoon: r.houseFromMoon,
      matters: [...r.matters],
      polarity: r.polarity,
      strength: r.strength,
      from: r.from,
      to: r.to,
      // the engine keeps every row's true dates, so "since" and "until" can always be said
      sinceKnown: true,
      untilKnown: true,
      evidence: r.evidence.length ? [...r.evidence] : [r.id],
    }))
    .sort((a, b) => a.from.localeCompare(b.from) || (a.level ?? 9) - (b.level ?? 9) || a.rowId.localeCompare(b.rowId));
}

const byWeight = (a: WindowRow, b: WindowRow) => b.strength - a.strength || a.to.localeCompare(b.to) || a.rowId.localeCompare(b.rowId);

export function subWindows(env: SubEnv, clock: ClockResolution): WindowSetDetail {
  const fromEngine = Boolean(env.pressure && env.pressure.clock === clock.primary && env.pressure.rows.length);
  // degraded mode still takes the engine's annual (TP year) and return rows when an inventory is stored: they hold on any clock
  const rows = fromEngine
    ? pressureWindowRows(env)
    : [...windowRows(env, clock), ...pressureWindowRows(env, CLOCK_FREE_KINDS)].sort((a, b) => a.from.localeCompare(b.from) || (a.level ?? 9) - (b.level ?? 9) || a.rowId.localeCompare(b.rowId));
  const asOf = env.asOf;
  if (!fromEngine) {
    env.g.add('windows: pressure_inventory not stored; built from kundli_activation and the sky overlay (degraded)');
    env.g.add('windows: the engine stores no strength grade; every row is 2');
  }
  const stripLo = addMonthsIso(asOf, -STRIP_MONTHS);
  const stripHi = addMonthsIso(asOf, STRIP_MONTHS);
  const strip = rows.filter((w) => overlaps(w.from, w.to, stripLo, stripHi));
  const live = rows.filter((w) => isLive(w.from, w.to, asOf));
  const heaviest = live.filter((w) => w.polarity === 'presses').sort(byWeight)[0] ?? null;
  const support = rows.filter((w) => w.polarity === 'supports' && w.sinceKnown && w.from > asOf).sort((a, b) => a.from.localeCompare(b.from))[0] ?? null;
  const yearAgo = addMonthsIso(asOf, -12);
  const startedLast12m = rows.filter((w) => w.sinceKnown && w.from >= yearAgo && w.from <= asOf);
  const endingNext6m = rows.filter((w) => w.untilKnown && w.to > asOf && w.to <= stripHi);
  const byMatter: Partial<Record<Matter, WindowRef[]>> = {};
  for (const w of strip) for (const m of w.matters) (byMatter[m] ??= []).push(toRef(w));
  return {
    asOf,
    strip: strip.map(toRef),
    heaviestNow: heaviest ? toRef(heaviest) : null,
    easesAt: heaviest && heaviest.untilKnown ? heaviest.to : null,
    nextSupportFrom: support?.from ?? null,
    startedLast12m: startedLast12m.map(toRef),
    endingNext6m: endingNext6m.map(toRef),
    byMatter,
    degraded: !fromEngine,
    rows,
  };
}
