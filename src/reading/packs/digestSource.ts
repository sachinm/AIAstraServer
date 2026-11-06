/**
 * The digest as a second source of the evidence pack (docs/reading-engine/53 §4.2, step 4; 54 §5). No astrology: every
 * value is a field of a digest row (itself an engine field with its source path), copied under the name the pack and the
 * prompts already use. Where the digest has no such field the dossier's value stays, field by field, so the prompts and
 * every evidence id keep working while kundlis are digested.
 *
 * Two things live here:
 * - `overlayDigest`: rewrites the base, detail, varga and arudha sections of a dossier-built pack from the digest's
 *   house, planet and point rows (same keys, same shapes). The base depends only on D1 rows, so its bytes are the same
 *   for every question about one kundli on one digest version: it stays the cacheable prefix.
 * - `digestSection`: the `digest` pack section the deterministic readers read and cite. It is keyed so that an evidence
 *   id is `digest.<section>.<digest key>[.<field>]` (digest key `D9.h7` → `digest.house.D9.h7.lordDignity`).
 */
import type { AnnualRow, DigestView, HouseCard, PlanetCard, PointRow, YogaRow } from '../digest/types.js';
import type { ActivationRow } from '../digest/activation.js';
import { PERSON_OF_SUBJECT, PERSON_SIGNIFIERS } from '../codeReaders/rules.js';

export interface DigestPerson {
  who: keyof typeof PERSON_SIGNIFIERS;
  houses: number[];
  varga: string;
  karaka: string;
}

export interface DigestRasiPeriod {
  system: string;
  sign: string;
  lord: string;
  from: string;
  to: string;
  houses: number[];
}

export interface DigestPackSection {
  version: string;
  /** varga → `h<n>` → card */
  house: Record<string, Record<string, HouseCard>>;
  /** varga → planet code → card */
  planet: Record<string, Record<string, PlanetCard>>;
  /** `D1` → yoga id (dots made underscores) → row */
  yoga: Record<string, Record<string, YogaRow>>;
  /** varga → point id → row */
  point: Record<string, Record<string, PointRow>>;
  /** the person the question is about, when there is one (general.person) */
  person: DigestPerson | null;
  /** the vargas the frame names that the digest holds, D1 first */
  vargas: string[];
  /** Narayana / Chara periods inside the horizon that activate the frame houses, keyed by period id (general.jaimini) */
  rasi?: Record<string, DigestRasiPeriod>;
  /** TP and VP rows of the current, previous and next year in D1, D9, D10 (general.annual) */
  annual?: Record<string, AnnualRow>;
}

/** The vargas the varga-dynamics reader adds for an explain or a whole-life question (doc 53 §4.4). */
export const DEEP_VARGAS = ['D16', 'D20', 'D27', 'D40', 'D45', 'D81', 'D108', 'D144'];
/** The chara karakas and arudhas every frame reads beside its own (doc 33 R4). */
export const CORE_POINTS = ['AK', 'AmK', 'DK', 'AL', 'UL'];

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
/** A digest value when the digest has one, else the dossier's. */
const or = <T>(digest: T | null | undefined, dossier: unknown): unknown => (digest === null || digest === undefined ? dossier : digest);
const keyOf = (id: string): string => id.replace(/\./g, '_');

export interface DigestSectionInput {
  houses: number[];
  /** frame lords, karakas and the planets the question names */
  planets: string[];
  /** the frame's vargas (D10 …) */
  vargas: string[];
  /** chara karakas and arudhas of the frame (AmK, A10, AL …) */
  points: string[];
  deep: boolean;
  person: DigestPerson | null;
  /** optional Narayana / Chara rasi periods inside the horizon */
  rasiPeriods?: Array<{ system?: string; sign: string; lord: string; from: string; to: string }>;
  /** optional activation calendar rows overlapping the horizon (kundli_activation) */
  activation?: readonly ActivationRow[] | null;
  /** optional years to include from digest.annual (current, previous and next year TP/VP in D1/D9/D10) */
  years?: readonly number[];
}

/** The digest rows a question's deterministic readers read: frame houses and planets in D1 and the frame's vargas, the yogas that touch them, the frame's points. */
export function digestSection(view: DigestView, a: DigestSectionInput): DigestPackSection {
  const held = new Set(view.vargas());
  const wanted = ['D1', ...a.vargas, ...(a.person ? [a.person.varga] : []), ...(a.deep ? DEEP_VARGAS : [])];
  const vargas = [...new Set(wanted)].filter((v) => held.has(v) || v === 'D1');
  const houses = [...new Set([...a.houses, ...(a.person?.houses ?? [])])];
  const planets = [...new Set([...a.planets, ...(a.person ? [a.person.karaka] : [])])];
  const house: DigestPackSection['house'] = {};
  const planet: DigestPackSection['planet'] = {};
  for (const v of vargas) {
    for (const h of houses) {
      const card = view.house(v, h);
      if (card) (house[v] ??= {})[`h${h}`] = card;
    }
    for (const p of planets) {
      const card = view.planet(v, p);
      if (card) (planet[v] ??= {})[p] = card;
    }
  }
  const touched = new Set(planets);
  const yoga: DigestPackSection['yoga'] = {};
  for (const y of view.yogas()) {
    if (y.houses.some((h) => houses.includes(h)) || y.planets.some((p) => touched.has(p))) (yoga.D1 ??= {})[keyOf(y.id)] = y;
  }
  const pointIds = new Set([...CORE_POINTS, ...a.points]);
  const point: DigestPackSection['point'] = {};
  for (const p of view.points('D1')) {
    if (!pointIds.has(p.id)) continue;
    (point[p.varga || 'D1'] ??= {})[keyOf(p.id)] = p;
    // the D1 card of the house a point sits in, for its class (the Jaimini reader's house-class rule)
    const card = p.house ? view.house('D1', p.house) : null;
    if (card && !house.D1?.[`h${p.house}`]) (house.D1 ??= {})[`h${p.house}`] = card;
  }
  const rasi: Record<string, DigestRasiPeriod> = {};
  for (const rp of a.rasiPeriods ?? []) {
    const matchedHouses = houses.filter((h) => {
      const c = view.house('D1', h);
      return c && (c.sign === rp.sign || c.lord === rp.lord);
    });
    if (!matchedHouses.length) continue;
    const sys = rp.system ?? 'narayana';
    const k = keyOf(`${sys}_${rp.sign}_${rp.from}`);
    rasi[k] = { system: sys, sign: rp.sign, lord: rp.lord, from: rp.from, to: rp.to, houses: matchedHouses };
  }
  for (const row of a.activation ?? []) {
    if (row.family !== 'rasi' || !row.sign) continue;
    const matchedHouses = houses.filter((h) => row.houses.includes(h) || view.house('D1', h)?.sign === row.sign);
    if (!matchedHouses.length) continue;
    const lord = row.lord ?? view.house('D1', matchedHouses[0]!)?.lord ?? '';
    const k = keyOf(`${row.system}_${row.sign}_${row.from}`);
    rasi[k] = { system: row.system, sign: row.sign, lord, from: row.from, to: row.to, houses: matchedHouses };
  }
  const annual: Record<string, AnnualRow> = {};
  for (const y of a.years ?? []) {
    for (const row of view.annual(y)) {
      annual[keyOf(`${row.kind}${row.year}_${row.varga}`)] = row;
    }
  }
  return {
    version: view.version,
    house,
    planet,
    yoga,
    point,
    person: a.person,
    vargas,
    ...(Object.keys(rasi).length ? { rasi } : {}),
    ...(Object.keys(annual).length ? { annual } : {}),
  };
}

/** The person a question is about: the one it names, else the person subject's (doc 53 §4.4). */
export function personFor(subject: string, named: { person: string } | null | undefined): DigestPerson | null {
  const who = (named?.person as DigestPerson['who'] | undefined) ?? PERSON_OF_SUBJECT[subject];
  if (!who || !PERSON_SIGNIFIERS[who]) return null;
  return { who, ...PERSON_SIGNIFIERS[who] };
}

// ---------------------------------------------------------------- the pack's own sections, from the digest

function overlayCompactHouse(o: Record<string, unknown>, c: HouseCard): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o, sign: or(c.sign, o.sign), lord: or(c.lord, o.lord), lord_h: or(c.lordHouse, o.lord_h), occ: c.occupants ? c.occupants.map((x) => x.planet) : o.occ };
  if (c.class?.length) out.cls = c.class;
  if (c.sav !== null && c.sav !== undefined) out.sav = c.sav;
  return out;
}

function overlayDetailHouse(o: Record<string, unknown>, c: HouseCard): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...o,
    sign: or(c.sign, o.sign),
    lord: or(c.lord, o.lord),
    lord_house: or(c.lordHouse, o.lord_house),
    lord_dignity: or(c.lordDignity, o.lord_dignity),
    occ: c.occupants ? c.occupants.map((x) => x.planet) : o.occ,
    aspected_by: c.aspectedGraha || c.aspectedRasi ? { graha: c.aspectedGraha ?? [], rasi: c.aspectedRasi ?? [] } : o.aspected_by,
  };
  if (c.argala && isObj(o.argala)) {
    const a = o.argala as Record<string, unknown>;
    out.argala = { ...a, primary: c.argala.primary, ...('secondary' in a || c.argala.secondary.length ? { secondary: c.argala.secondary } : {}), obstructed_by: c.argala.obstructed };
  } else if (c.argala && o.argala === undefined) {
    out.argala = { primary: c.argala.primary, ...(c.argala.secondary.length ? { secondary: c.argala.secondary } : {}), obstructed_by: c.argala.obstructed };
  }
  if (c.class?.length) out.cls = c.class;
  if (c.sav !== null && c.sav !== undefined) out.sav = c.sav;
  if (c.cuspStar) out.cusp_nak = `${c.cuspStar.name} (${c.cuspStar.lord})`;
  return out;
}

/** A body of the base, from its D1 planet card; the fields the card lacks (house of the star lord, rupas, ishta …) stay. */
function overlayBody(o: Record<string, unknown>, p: PlanetCard): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o, sign: or(p.sign, o.sign), h: or(p.house, o.h) };
  if (p.star && p.pada !== null && p.pada !== undefined) out.nak = `${p.star}-${p.pada}`;
  if (p.dignity) out.dig = p.dignity;
  if (p.retro === true) out.retro = true;
  if (p.combust === true) out.combust = true;
  if (p.owns?.length && 'owns' in o) out.owns = p.owns;
  if ('nature' in o && p.natural && p.functional) out.nature = `${p.natural}/${p.functional}`;
  if ('aspects_houses' in o && p.aspectsTo) out.aspects_houses = p.aspectsTo;
  if (isObj(o.aspected_by) && p.aspectedBy) out.aspected_by = { ...(o.aspected_by as Record<string, unknown>), graha: p.aspectedBy };
  if (typeof o.star_lord === 'string' && p.starLord) out.star_lord = (o.star_lord as string).replace(/^\S+/, p.starLord);
  if ('sign_lord' in o && p.dispositor && p.dispositorHouse !== null && p.dispositorHouse !== undefined) out.sign_lord = `${p.dispositor} (house ${p.dispositorHouse})`;
  if (isObj(o.shadbala)) out.shadbala = { ...(o.shadbala as Record<string, unknown>), ratio: or(p.shadbalaRatio, (o.shadbala as Record<string, unknown>).ratio), rank: or(p.shadbalaRank, (o.shadbala as Record<string, unknown>).rank) };
  // `deg` stays the dossier's: the digest card's degree is not stated as degrees within the sign (doc 54 §2)
  return out;
}

function overlayVarga(o: Record<string, unknown>, view: DigestView, key: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o };
  const lagna = view.house(key, 1);
  // the varga lagna's sign keeps the dossier's spelling (a name, where the house rows of a varga carry the sign number);
  // its lord and the lord's house come from the digest's house 1 card
  if (lagna) Object.assign(out, { lagna_lord: or(lagna.lord, o.lagna_lord), lagna_lord_h: or(lagna.lordHouse, o.lagna_lord_h) });
  if (isObj(o.planets)) {
    const planets: Record<string, unknown> = {};
    for (const [code, vp] of Object.entries(o.planets)) {
      const c = view.planet(key, code);
      planets[code] = c && isObj(vp) ? { ...vp, h: or(c.house, vp.h), dig: or(c.dignity, vp.dig) } : vp;
    }
    out.planets = planets;
  }
  if (isObj(o.houses)) {
    const houses: Record<string, unknown> = {};
    for (const [h, vh] of Object.entries(o.houses)) {
      const c = view.house(key, Number(h));
      // `sign` keeps the varga block's own value (a sign number, which the prompts read), lord and occupants come from the card
      houses[h] = c && isObj(vh) ? { ...vh, lord: or(c.lord, vh.lord), occ: c.occupants ? c.occupants.map((x) => x.planet) : vh.occ } : vh;
    }
    out.houses = houses;
  }
  if (isObj(o.d1_lords)) {
    // where the D1 lord of each frame house lands in this varga: a join of two engine fields (D1 house lord → its varga card)
    const lords: Record<string, unknown> = {};
    for (const [h, lp] of Object.entries(o.d1_lords)) {
      const lord = view.house('D1', Number(h))?.lord;
      const c = lord ? view.planet(key, lord) : null;
      lords[h] = c && isObj(lp) ? { ...lp, lord: lord ?? lp.lord, varga_house: or(c.house, lp.varga_house), varga_dignity: or(c.dignity, lp.varga_dignity) } : lp;
    }
    out.d1_lords = lords;
  }
  if (isObj(o.kendra_occ)) {
    const k: Record<string, unknown> = {};
    for (const [h, occ] of Object.entries(o.kendra_occ)) {
      const c = view.house(key, Number(h));
      k[h] = c?.occupants ? c.occupants.map((x) => x.planet) : occ;
    }
    out.kendra_occ = k;
  }
  return out;
}

export interface OverlayDigestExtra {
  activation?: readonly ActivationRow[] | null;
  years?: readonly number[];
  houses?: readonly number[];
  asOf?: string;
  fullScope?: boolean;
}

function annualFromDigest(view: DigestView, extra: OverlayDigestExtra): Record<string, unknown> | undefined {
  const wantedYears = extra.years ?? [];
  if (!wantedYears.length) return undefined;
  const rows = wantedYears.flatMap((y) => view.annual(y));
  if (!rows.length) return undefined;
  const curYear = extra.asOf ? Number(extra.asOf.slice(0, 4)) : wantedYears[Math.floor(wantedYears.length / 2)]!;
  const primary = rows.find((r) => r.year === curYear && r.kind === 'TP' && r.varga === 'D1') ?? rows.find((r) => r.year === curYear && r.varga === 'D1') ?? rows[0]!;
  const lagnaHouse = primary.houses.find((h) => h.house === 1);
  const bodies: Record<string, unknown> = {};
  const occupants: Record<string, string[]> = {};
  for (const h of primary.houses) {
    for (const occ of h.occupants ?? []) {
      bodies[occ.planet] = { ...(h.sign ? { sign: h.sign } : {}), h: h.house, ...(occ.dignity ? { dig: occ.dignity } : {}) };
      (occupants[String(h.house)] ??= []).push(occ.planet);
    }
  }
  const dashaTree = primary.dashas[0];
  const periods: Record<string, unknown> = {};
  let running: Record<string, unknown> | undefined;
  for (const p of dashaTree?.periods ?? []) {
    periods[keyOf(`${p.lord}_${p.from}`)] = { lord: p.lord, from: p.from, to: p.to };
    if (extra.asOf && p.from <= extra.asOf && extra.asOf < p.to && !running) running = { lord: p.lord, from: p.from, to: p.to };
  }
  const frameHouses = extra.houses ?? [];
  const yearsMap: Record<string, unknown> = {};
  for (const r of rows) {
    const houses = Object.fromEntries(
      r.houses
        .filter((h) => !frameHouses.length || h.house === 1 || frameHouses.includes(h.house))
        .map((h) => [`h${h.house}`, h])
    );
    yearsMap[keyOf(`${r.kind}${r.year}_${r.varga}`)] = {
      kind: r.kind,
      year: r.year,
      varga: r.varga,
      lagna: r.lagna,
      houses,
      dashas: r.dashas,
      sahams: r.sahams.filter((s) => !frameHouses.length || s.house == null || frameHouses.includes(s.house)),
      ...(r.muntha ? { muntha: r.muntha } : {}),
      ...(r.yearLord ? { yearLord: r.yearLord } : {}),
      ...(r.tajakaYogas?.length ? { tajakaYogas: r.tajakaYogas } : {}),
    };
  }
  return {
    year_used: primary.year,
    chart: {
      lagna: { sign: primary.lagna, ...(lagnaHouse?.lord ? { lord: lagnaHouse.lord } : {}) },
      bodies,
      occupants,
    },
    ...(dashaTree ? { dasha: { system: dashaTree.system, ...(running ? { running } : {}), periods } } : {}),
    years: yearsMap,
  };
}

/**
 * The pack sections rewritten from the digest (doc 53 §4.2). Same keys as the dossier path; each value is the digest's
 * when it has the field, else the dossier's. When activation rows or digest annual rows are supplied, `dasha.activation`
 * and `annual` are populated too.
 */
export function overlayDigest(sections: Record<string, unknown>, view: DigestView, extra?: OverlayDigestExtra): Record<string, unknown> {
  const out = { ...sections };
  const base = sections.base as Record<string, unknown> | undefined;
  if (base) {
    const houses: Record<string, unknown> = {};
    for (const [h, o] of Object.entries((base.houses ?? {}) as Record<string, Record<string, unknown>>)) {
      const c = view.house('D1', Number(h));
      houses[h] = c ? overlayCompactHouse(o, c) : o;
    }
    const bodies: Record<string, unknown> = {};
    for (const [code, o] of Object.entries((base.bodies ?? {}) as Record<string, Record<string, unknown>>)) {
      const p = view.planet('D1', code);
      bodies[code] = p ? overlayBody(o, p) : o;
    }
    out.base = { ...base, houses, bodies };
  }
  const detail = sections.detail as Record<string, unknown> | undefined;
  if (detail) {
    const houses: Record<string, unknown> = {};
    for (const [h, o] of Object.entries((detail.houses ?? {}) as Record<string, Record<string, unknown>>)) {
      const c = view.house('D1', Number(h));
      houses[h] = c ? overlayDetailHouse(o, c) : o;
    }
    const sav: Record<string, unknown> = {};
    for (const [h, v] of Object.entries((detail.sav_frame ?? {}) as Record<string, unknown>)) sav[h] = or(view.house('D1', Number(h))?.sav, v);
    // detail.yogas keeps the dossier's list (its filter reads a source label the digest rows do not carry); the
    // digest's yoga rows are in the `digest` section
    out.detail = { ...detail, houses, sav_frame: sav };
  }
  const varga = sections.varga as Record<string, unknown> | undefined;
  if (varga) {
    const v: Record<string, unknown> = {};
    for (const [key, block] of Object.entries(varga)) v[key] = isObj(block) && view.vargas().includes(key) ? overlayVarga(block, view, key) : block;
    out.varga = v;
  }
  const arudha = sections.arudha as Record<string, Record<string, unknown>> | undefined;
  if (arudha) {
    const points = new Map(view.points('D1').map((p) => [p.id, p]));
    const a: Record<string, unknown> = {};
    for (const [k, o] of Object.entries(arudha)) {
      const p = points.get(k);
      a[k] = p ? { ...o, sign: or(p.sign, o.sign), h: or(p.house, o.h), ...('lord' in o ? { lord: or(p.lord, o.lord) } : {}) } : o;
    }
    out.arudha = a;
  }
  if (!extra?.fullScope) {
    if (extra?.activation?.length && isObj(out.dasha)) {
      const frameHouses = extra.houses ?? [];
      const act: Record<string, unknown> = {};
      for (const r of extra.activation) {
        if (frameHouses.length && !r.houses.some((h) => frameHouses.includes(h))) continue;
        const k = keyOf(`${r.system}_${r.lord ?? r.sign ?? `L${r.level}`}_${r.from}`);
        act[k] = {
          system: r.system,
          family: r.family,
          level: r.level,
          ...(r.lord ? { lord: r.lord } : {}),
          ...(r.sign ? { sign: r.sign } : {}),
          from: r.from,
          to: r.to,
          houses: r.houses,
          ...(r.parentLord ? { within: r.parentLord } : {}),
        };
      }
      if (Object.keys(act).length) {
        out.dasha = { ...(out.dasha as Record<string, unknown>), activation: act };
      }
    }
    if (out.annual === undefined && extra?.years?.length) {
      const ann = annualFromDigest(view, extra);
      if (ann) out.annual = ann;
    }
  }
  return out;
}
