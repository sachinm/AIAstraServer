/**
 * The digest technique (`digest.build`, docs/reading-engine/53 §4.1, the contract of 54 §2): the first-time breakdown of a
 * kundli, deterministic and with no model. Input: the kundli's stored `kundli_data` payloads (catalogue id, or
 * `id@variant` for year rows) plus the dossier under `facts`. Output: `kundli_digest` rows in six sections, each with the
 * engine type, variant, calc version and JSON path of what it holds.
 *
 * It SELECTS, COUNTS, JOINS and DATES engine fields; it never derives a sign, a lord, an aspect, a dignity, a yoga or a
 * house (doc 46 §C.3, tests/unit/reading/digest/noAstrologyInNode.test.ts). Where the engine states no house table for a
 * divisional chart (the vargas without `dignities.dN`), only planet cards are written for it: placing a sign in a house
 * would be a count from the lagna, which stays in the engine.
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { SIGN_NAMES } from '../facts/constants.js';
import { lordCode } from '../timeline/dashas.js';
import { VARGA_FACTORS } from '../chartData/catalog.js';
import { buildActivationRows, type ActivationRowInput } from './activation.js';
import { DIGEST_VERSION, FACTS_ITEM, itemKey, type AnnualRow, type DigestRowInput, type DigestSource, type DigestStatus, type HouseCard, type PlanetCard, type PointRow, type StarProfile, type YogaRow } from './types.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null => (Number.isInteger(v) ? (v as number) : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
const byNum = (a: number, b: number) => a - b;

/** A planet as the engine names it in any payload ({ id, name }, { code }, 'Sun', 'Raagu', 'Ju') -> its code; null for anything else. */
export function planetCode(v: unknown): string | null {
  if (isObj(v)) return lordCode(v.code) ?? lordCode(v.name);
  return lordCode(v);
}

/** The engine's two-letter sign labels in `varga.dN` rows -> the sign names the other payloads use (a label table). */
const RASI_LABELS: Record<string, string> = {
  Ar: 'Aries', Ta: 'Taurus', Ge: 'Gemini', Cn: 'Cancer', Le: 'Leo', Vi: 'Virgo', Li: 'Libra', Sc: 'Scorpio', Sg: 'Sagittarius', Cp: 'Capricorn', Aq: 'Aquarius', Pi: 'Pisces',
};

/** A dossier sign index (0 = Aries) -> its name: a label lookup, not a placement. */
function signLabel(index: unknown): string | null {
  const i = int(index);
  return i != null && i >= 0 && i < SIGN_NAMES.length ? SIGN_NAMES[i]! : null;
}

function joinPath(at: string, rel: string): string {
  if (!at) return rel;
  if (!rel) return at;
  return rel.startsWith('[') ? `${at}${rel}` : `${at}.${rel}`;
}

/** The value at a digest source path ('houses[3].lord', 'house_class.7') inside a payload; undefined when it does not resolve. */
export function resolvePath(payload: unknown, path: string): unknown {
  if (!path) return payload;
  let cur: unknown = payload;
  for (const part of path.match(/[^.[\]]+|\[\d+\]/g) ?? []) {
    if (cur == null) return undefined;
    if (part.startsWith('[')) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[Number(part.slice(1, -1))];
    } else {
      if (typeof cur !== 'object') return undefined;
      cur = (cur as Obj)[part];
    }
  }
  return cur;
}

/** One table inside one payload: the item key, the path to the table and the table itself. */
interface Ref {
  key: string;
  at: string;
  value: unknown;
}

class Sources {
  constructor(private readonly calcVersions: Record<string, string | null>) {}
  of(ref: Ref, rel = ''): DigestSource {
    const at = ref.key.indexOf('@');
    return {
      type: at < 0 ? ref.key : ref.key.slice(0, at),
      variant: at < 0 ? '' : ref.key.slice(at + 1),
      calcVersion: this.calcVersions[ref.key] ?? null,
      path: joinPath(ref.at, rel),
    };
  }
}

function ref(items: Record<string, unknown>, key: string, at = ''): Ref | null {
  const payload = items[key];
  if (payload == null) return null;
  const value = at ? resolvePath(payload, at) : payload;
  return value == null ? null : { key, at, value };
}

const vargaName = (f: number) => `D${f}`;
const natalKey = (type: string, f: number) => (f === 1 ? type : `${type}.d${f}`);

/** The tables that make one chart's cards: a natal varga (dignities.dN …) or a year chart (annual.*@year=Y …). */
interface ChartTables {
  varga: string;
  houses: Ref | null;
  planets: Ref | null;
  aspects: Ref | null;
  argala: Ref | null;
  arudhas: Ref | null;
  avasthas: Ref | null;
  houseCounts?: Ref | null;
  /** D1 only */
  d1?: { facts: Ref | null; houseCounts: Ref | null; ashtakavarga: Ref | null; shadbala: Ref | null; benefic: Ref | null };
}

function natalTables(items: Record<string, unknown>, f: number): ChartTables | null {
  const houses = ref(items, natalKey('dignities', f), 'houses');
  const planets = ref(items, natalKey('dignities', f), 'planets');
  if (!houses && !planets) return null;
  return natalTablesWith(items, f, houses, planets);
}

/** D1 with no stored dignities row: the dossier's houses and bodies stand in */
function natalTablesFromFacts(items: Record<string, unknown>): ChartTables | null {
  return isObj(items[FACTS_ITEM]) ? natalTablesWith(items, 1, null, null) : null;
}

function natalTablesWith(items: Record<string, unknown>, f: number, houses: Ref | null, planets: Ref | null): ChartTables {
  const hc = ref(items, natalKey('house_counts', f));
  return {
    varga: vargaName(f),
    houses,
    planets,
    aspects: ref(items, natalKey('aspects', f)),
    argala: ref(items, `argala.d${f}`),
    arudhas: ref(items, natalKey('arudhas', f)),
    avasthas: ref(items, natalKey('avasthas', f)),
    houseCounts: hc,
    ...(f === 1
      ? { d1: { facts: ref(items, FACTS_ITEM), houseCounts: hc, ashtakavarga: ref(items, 'ashtakavarga'), shadbala: ref(items, 'strength.shadbala'), benefic: ref(items, 'benefic_malefic') } }
      : {}),
  };
}

function annualTables(items: Record<string, unknown>, key: string, varga: string): ChartTables | null {
  // an older year row holds the lagna and planets only: the row then has the lagna and no house cards
  const houses = ref(items, key, 'houses');
  const planets = ref(items, key, 'dignities');
  if (!houses && !planets && !ref(items, key, 'lagna')) return null;
  return { varga, houses, planets, aspects: ref(items, key, 'aspects'), argala: ref(items, key, 'argala'), arudhas: null, avasthas: null };
}

interface Built<T> {
  key: string;
  row: T;
  source: DigestSource[];
}

/** `{ papa: [...], subha: [...] }` in the argala table: the engine's benefics and malefics of this chart */
function natureOf(argala: Ref | null, planet: string): { nature: string | null; path: string | null } {
  const n = argala && isObj(argala.value) ? (argala.value as Obj).nature : null;
  if (!isObj(n)) return { nature: null, path: null };
  if (arr(n.subha).some((p) => planetCode(p) === planet)) return { nature: 'benefic', path: 'nature.subha' };
  if (arr(n.papa).some((p) => planetCode(p) === planet)) return { nature: 'malefic', path: 'nature.papa' };
  return { nature: null, path: null };
}

function drishti(aspects: Ref | null, kind: 'graha_drishti' | 'rasi_drishti'): Array<{ i: number; planet: string; houses: number[]; planets: string[] }> {
  if (!aspects || !isObj(aspects.value)) return [];
  return arr((aspects.value as Obj)[kind])
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => isObj(r))
    .map(({ r, i }) => {
      const o = r as Obj;
      return { i, planet: planetCode(o) ?? '', houses: arr(o.aspected_houses).map(int).filter((h): h is number => h != null), planets: arr(o.aspected_planets).map(planetCode).filter((p): p is string => Boolean(p)) };
    })
    .filter((x) => x.planet);
}

function houseCards(t: ChartTables, src: Sources): Built<HouseCard>[] {
  if (!t.houses) return [];
  const planetRows = t.planets ? arr(t.planets.value) : [];
  const dignityOf = (p: string): { dignity: string | null; i: number } => {
    const i = planetRows.findIndex((r) => planetCode(r) === p);
    return { dignity: i >= 0 ? str((planetRows[i] as Obj).dignity) : null, i };
  };
  const graha = drishti(t.aspects, 'graha_drishti');
  const rasi = drishti(t.aspects, 'rasi_drishti');
  const facts = t.d1?.facts && isObj(t.d1.facts.value) ? (t.d1.facts.value as Obj) : null;
  const factHouses = facts && isObj(facts.houses) ? (facts.houses as Obj) : null;
  const out: Built<HouseCard>[] = [];
  arr(t.houses.value).forEach((raw, i) => {
    if (!isObj(raw)) return;
    const h = int(raw.house);
    if (h == null || h < 1 || h > 12) return;
    const source: DigestSource[] = [src.of(t.houses!, `[${i}]`)];
    const fh = factHouses && isObj(factHouses[String(h)]) ? (factHouses[String(h)] as Obj) : null;
    const lord = planetCode(raw.lord);
    const natural = planetCode(raw.natural_lord);
    let coLord = natural && natural !== lord ? natural : null;
    if (fh && planetCode(fh.co_lord)) {
      // the dossier names the sign's two lords; the co-lord is the one the house table did not name
      const pair = [planetCode(fh.lord), planetCode(fh.co_lord)].filter((x): x is string => Boolean(x));
      coLord = pair.find((x) => x !== lord) ?? null;
      source.push(src.of(t.d1!.facts!, `houses.${h}.co_lord`));
    }
    const occupants = arr(raw.occupants)
      .map(planetCode)
      .filter((p): p is string => Boolean(p))
      .map((p) => {
        const d = dignityOf(p);
        if (d.i >= 0 && t.planets) source.push(src.of(t.planets, `[${d.i}].dignity`));
        const n = natureOf(t.argala, p);
        if (n.path && t.argala) source.push(src.of(t.argala, n.path));
        return { planet: p, dignity: d.dignity, nature: n.nature };
      });
    const aspectedGraha = graha.filter((g) => g.houses.includes(h));
    const aspectedRasi = rasi.filter((g) => g.houses.includes(h));
    for (const g of aspectedGraha) source.push(src.of(t.aspects!, `graha_drishti[${g.i}].aspected_houses`));
    for (const g of aspectedRasi) source.push(src.of(t.aspects!, `rasi_drishti[${g.i}].aspected_houses`));

    // argala: the dossier's grouping for D1; elsewhere the engine's table read the same way (planets at the 2nd, 4th
    // and 11th as primary, at the 5th as secondary, the planets of each virodha place as obstructing)
    let argala: HouseCard['argala'] = null;
    if (fh && isObj(fh.argala)) {
      const a = fh.argala as Obj;
      argala = { primary: arr(a.primary).map(planetCode).filter(Boolean) as string[], secondary: arr(a.secondary).map(planetCode).filter(Boolean) as string[], obstructed: arr(a.obstructed_by).map(planetCode).filter(Boolean) as string[] };
      source.push(src.of(t.d1!.facts!, `houses.${h}.argala`));
    } else if (t.argala && isObj(t.argala.value)) {
      const rows = arr((t.argala.value as Obj).houses);
      const j = rows.findIndex((r) => isObj(r) && int(r.house) === h);
      if (j >= 0) {
        const entries = arr((rows[j] as Obj).argalas).filter(isObj);
        const planetsAt = (pick: (e: Obj) => boolean, side: 'argala' | 'virodha') =>
          uniq(entries.filter(pick).flatMap((e) => arr(isObj(e[side]) ? (e[side] as Obj).planets : []).map(planetCode).filter((p): p is string => Boolean(p))));
        const offsetOf = (e: Obj) => (isObj(e.argala) ? int((e.argala as Obj).offset) : null);
        argala = { primary: planetsAt((e) => offsetOf(e) !== 5, 'argala'), secondary: planetsAt((e) => offsetOf(e) === 5, 'argala'), obstructed: planetsAt(() => true, 'virodha') };
        source.push(src.of(t.argala, `houses[${j}].argalas`));
      }
    }

    let sav: number | null = null;
    const ak = t.d1?.ashtakavarga;
    if (ak && isObj(ak.value) && num(arr((ak.value as Obj).sav_by_house)[h - 1]) != null) {
      sav = num(arr((ak.value as Obj).sav_by_house)[h - 1]);
      source.push(src.of(ak, `sav_by_house[${h - 1}]`));
    } else if (fh && num(fh.sav) != null) {
      sav = num(fh.sav);
      source.push(src.of(t.d1!.facts!, `houses.${h}.sav`));
    }

    let cls: string[] = [];
    const hc = t.houseCounts ?? t.d1?.houseCounts;
    const hcClass = hc && isObj(hc.value) && isObj((hc.value as Obj).house_class) ? ((hc.value as Obj).house_class as Obj)[String(h)] : null;
    if (Array.isArray(hcClass)) {
      cls = hcClass.map(str).filter((c): c is string => Boolean(c));
      source.push(src.of(hc!, `house_class.${h}`));
    } else if (fh && Array.isArray(fh.class)) {
      cls = fh.class.map(str).filter((c): c is string => Boolean(c));
      source.push(src.of(t.d1!.facts!, `houses.${h}.class`));
    }
    const bmBadhaka = t.d1?.benefic && isObj(t.d1.benefic.value) && isObj((t.d1.benefic.value as Obj).badhaka) ? ((t.d1.benefic.value as Obj).badhaka as Obj) : null;
    if (bmBadhaka && int(bmBadhaka.badhaka_house) === h && !cls.includes('badhaka')) {
      cls = [...cls, 'badhaka'];
      source.push(src.of(t.d1!.benefic!, 'badhaka.badhaka_house'));
    }

    let cuspStar: HouseCard['cuspStar'] = null;
    if (fh && isObj(fh.cusp_nak) && str((fh.cusp_nak as Obj).name)) {
      const c = fh.cusp_nak as Obj;
      cuspStar = { name: str(c.name)!, lord: planetCode(c.lord) ?? str(c.lord) ?? '', pada: int(c.pada) };
      source.push(src.of(t.d1!.facts!, `houses.${h}.cusp_nak`));
    }

    let arudha: string | null = null;
    if (t.arudhas && isObj(t.arudhas.value)) {
      const rows = arr((t.arudhas.value as Obj).bhava_arudhas);
      const j = rows.findIndex((r) => isObj(r) && int(r.house) === h);
      if (j >= 0) {
        arudha = str((rows[j] as Obj).sign);
        source.push(src.of(t.arudhas, `bhava_arudhas[${j}].sign`));
      }
    }

    const lordSign = isObj(raw.lord_sign) ? str((raw.lord_sign as Obj).sign) : str(raw.lord_sign);
    out.push({
      key: `${t.varga}.h${h}`,
      row: {
        varga: t.varga,
        house: h,
        sign: str(raw.sign),
        lord,
        lordHouse: int(raw.lord_house),
        lordSign,
        lordDignity: str(raw.lord_dignity),
        coLord,
        occupants,
        aspectedGraha: uniq(aspectedGraha.map((g) => g.planet)),
        aspectedRasi: uniq(aspectedRasi.map((g) => g.planet)),
        argala,
        sav,
        class: cls,
        cuspStar,
        arudha,
      },
      source,
    });
  });
  return out.sort((a, b) => a.row.house - b.row.house);
}

const AVASTHA_FIELDS: Array<[string, (v: Obj) => string | null]> = [
  ['baladi', (v) => (isObj(v.baladi) ? str((v.baladi as Obj).state) : null)],
  ['jagradadi', (v) => (isObj(v.jagradadi) ? str((v.jagradadi as Obj).state) : null)],
  ['deeptadi', (v) => (isObj(v.deeptadi) ? str((v.deeptadi as Obj).primary) : null)],
  ['lajjitadi', (v) => (Array.isArray(v.lajjitadi) && v.lajjitadi.length ? v.lajjitadi.map(String).join(',') : null)],
  ['shayanadi', (v) => (isObj(v.shayanadi) ? str((v.shayanadi as Obj).state) : null)],
];

function planetCards(t: ChartTables, src: Sources): Built<PlanetCard>[] {
  if (!t.planets) return [];
  const rows = arr(t.planets.value);
  const houseRows = t.houses ? arr(t.houses.value) : [];
  const graha = drishti(t.aspects, 'graha_drishti');
  const facts = t.d1?.facts && isObj(t.d1.facts.value) ? (t.d1.facts.value as Obj) : null;
  const bodies = facts && isObj(facts.bodies) ? (facts.bodies as Obj) : null;
  const avRows = t.avasthas && isObj(t.avasthas.value) ? arr((t.avasthas.value as Obj).planets) : [];
  const chains = t.d1 && t.avasthas && isObj(t.avasthas.value) ? arr(resolvePath(t.avasthas.value, 'lunar_astro.dispositor_chains.rasi')) : [];
  const shad = t.d1?.shadbala && isObj(t.d1.shadbala.value) ? arr((t.d1.shadbala.value as Obj).planets) : [];
  const bm = t.d1?.benefic && isObj(t.d1.benefic.value) ? (t.d1.benefic.value as Obj) : null;
  const bmPlanets = bm ? arr(bm.planets) : [];
  const out: Built<PlanetCard>[] = [];
  const signOf = new Map<string, string | null>();
  rows.forEach((r) => {
    const p = planetCode(r);
    if (p && isObj(r)) signOf.set(p, str(r.sign));
  });
  rows.forEach((raw, i) => {
    if (!isObj(raw)) return;
    const p = planetCode(raw);
    if (!p) return;
    const source: DigestSource[] = [src.of(t.planets!, `[${i}]`)];
    const star = isObj(raw.star) ? (raw.star as Obj) : null;
    const wars = raw.planetary_war_with;

    const g = graha.find((x) => x.planet === p);
    if (g) source.push(src.of(t.aspects!, `graha_drishti[${g.i}]`));
    const aspectedBy = graha.filter((x) => x.planets.includes(p));
    for (const x of aspectedBy) source.push(src.of(t.aspects!, `graha_drishti[${x.i}].aspected_planets`));

    const avasthas: Record<string, string> = {};
    const ai = avRows.findIndex((a) => planetCode(a) === p);
    if (ai >= 0) {
      for (const [name, read] of AVASTHA_FIELDS) {
        const v = read(avRows[ai] as Obj);
        if (v) avasthas[name] = v;
      }
      source.push(src.of(t.avasthas!, `planets[${ai}]`));
    }
    let chain: string[] = [];
    const ci = chains.findIndex((c) => planetCode(c) === p);
    if (ci >= 0) {
      chain = arr((chains[ci] as Obj).chain).map(planetCode).filter((c): c is string => Boolean(c));
      source.push(src.of(t.avasthas!, `lunar_astro.dispositor_chains.rasi[${ci}].chain`));
    }

    let shadbalaRatio: number | null = null;
    let shadbalaRank: number | null = null;
    const si = shad.findIndex((s) => planetCode(s) === p);
    if (si >= 0) {
      shadbalaRatio = num((shad[si] as Obj).ratio);
      shadbalaRank = int((shad[si] as Obj).rank);
      source.push(src.of(t.d1!.shadbala!, `planets[${si}]`));
    }

    let natural: string | null = null;
    let functional: string | null = null;
    let owns: number[] = [];
    const body = bodies && isObj(bodies[p]) ? (bodies[p] as Obj) : null;
    if (body && isObj(body.nature)) {
      natural = str((body.nature as Obj).natural);
      functional = str((body.nature as Obj).functional);
      source.push(src.of(t.d1!.facts!, `bodies.${p}.nature`));
    }
    const bi = bmPlanets.findIndex((b) => planetCode(b) === p);
    if (bi >= 0) {
      const b = bmPlanets[bi] as Obj;
      if (!functional && Array.isArray(b.functional_roles) && b.functional_roles.length) {
        functional = b.functional_roles.map(String).join(',');
        source.push(src.of(t.d1!.benefic!, `planets[${bi}].functional_roles`));
      }
      if (Array.isArray(b.houses_owned)) {
        owns = b.houses_owned.map(int).filter((h): h is number => h != null);
        source.push(src.of(t.d1!.benefic!, `planets[${bi}].houses_owned`));
      }
    }
    if (!natural && bm && isObj(bm.natural)) {
      const n = bm.natural as Obj;
      if (arr(n.benefics).some((x) => planetCode(x) === p)) natural = 'benefic';
      else if (arr(n.malefics).some((x) => planetCode(x) === p)) natural = 'malefic';
      if (natural) source.push(src.of(t.d1!.benefic!, natural === 'benefic' ? 'natural.benefics' : 'natural.malefics'));
    }
    if (!owns.length && body && Array.isArray(body.owns)) {
      owns = body.owns.map(int).filter((h): h is number => h != null);
      source.push(src.of(t.d1!.facts!, `bodies.${p}.owns`));
    }
    if (!owns.length && houseRows.length) {
      // the houses whose engine-stated lord (or the sign's natural lord) is this planet: a join over the house table
      houseRows.forEach((h, j) => {
        if (isObj(h) && (planetCode(h.lord) === p || planetCode(h.natural_lord) === p) && int(h.house) != null) {
          owns.push(int(h.house)!);
          source.push(src.of(t.houses!, `[${j}].lord`));
        }
      });
    }

    const sign = str(raw.sign);
    out.push({
      key: `${t.varga}.${p}`,
      row: {
        varga: t.varga,
        planet: p,
        sign,
        house: int(raw.house_from_lagna),
        degree: num(raw.longitude_in_sign),
        star: star ? str(star.name) : null,
        pada: star ? int(star.pada) : null,
        starLord: star ? planetCode(star.lord) : null,
        dignity: str(raw.dignity),
        retro: bool(raw.retrograde),
        combust: bool(raw.combust),
        war: Array.isArray(wars) ? wars.length > 0 : null,
        dispositor: planetCode(raw.sign_lord),
        dispositorHouse: int(raw.sign_lord_house),
        chain,
        avasthas,
        shadbalaRatio,
        shadbalaRank,
        natural,
        functional,
        owns: uniq(owns).sort(byNum),
        aspectsTo: g ? uniq(g.houses).sort(byNum) : [],
        aspectedBy: uniq(aspectedBy.map((x) => x.planet)),
        conjunctions: sign ? [...signOf.entries()].filter(([q, s]) => q !== p && s === sign).map(([q]) => q) : [],
      },
      source,
    });
  });
  return out;
}

/** `7 Vi 02' 20.00"` (a varga.dN row) -> 7.0389: reading the engine's degree string, nothing else */
function degreeOf(text: unknown): number | null {
  const m = typeof text === 'string' ? /^\s*(\d+)\s+[A-Za-z]{2}\s+(\d+)'\s*([\d.]+)"?/.exec(text) : null;
  if (!m) return null;
  return Math.round((Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * 10_000) / 10_000;
}

/** A varga the engine serves only as placement rows (`varga.dN`): planet cards with sign, degree, star and pada; no house. */
function placementCards(items: Record<string, unknown>, f: number, src: Sources): Built<PlanetCard>[] {
  const r = ref(items, `varga.d${f}`);
  if (!r) return [];
  const rows = arr(r.value);
  const signOf = new Map<string, string>();
  const parsed = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => isObj(row))
    .map(({ row, i }) => ({ i, o: row as Obj, p: planetCode((row as Obj).body) }))
    .filter((x): x is { i: number; o: Obj; p: string } => Boolean(x.p));
  for (const x of parsed) {
    const s = RASI_LABELS[String(x.o.rasi ?? '')];
    if (s) signOf.set(x.p, s);
  }
  return parsed.map(({ i, o, p }) => {
    const sign = signOf.get(p) ?? null;
    const pada = Number(o.pada);
    return {
      key: `D${f}.${p}`,
      row: {
        varga: `D${f}`,
        planet: p,
        sign,
        house: null,
        degree: degreeOf(o.longitude),
        star: str(o.nakshatra),
        pada: Number.isInteger(pada) && pada > 0 ? pada : null,
        starLord: null,
        dignity: null,
        retro: null,
        combust: null,
        war: null,
        dispositor: null,
        dispositorHouse: null,
        chain: [],
        avasthas: {},
        shadbalaRatio: null,
        shadbalaRank: null,
        natural: null,
        functional: null,
        owns: [],
        aspectsTo: [],
        aspectedBy: [],
        conjunctions: sign ? [...signOf.entries()].filter(([q, s]) => q !== p && s === sign).map(([q]) => q) : [],
      },
      source: [src.of(r, `[${i}]`)],
    };
  });
}

/** The dossier as a table ref, and its value as an object (null when there is no dossier) */
function factsOf(items: Record<string, unknown>): { ref: Ref; value: Obj } | null {
  const r = ref(items, FACTS_ITEM);
  return r && isObj(r.value) ? { ref: r, value: r.value as Obj } : null;
}

const codes = (v: unknown): string[] => arr(v).map(planetCode).filter((p): p is string => Boolean(p));

/**
 * D1 house cards from the dossier's `houses` (the engine's own house-by-house table), for a kundli whose stored
 * `dignities` row predates the house table. Same fields, other source paths.
 */
function factHouseCards(items: Record<string, unknown>, t: ChartTables, src: Sources): Built<HouseCard>[] {
  const f = factsOf(items);
  const houses = f && isObj(f.value.houses) ? (f.value.houses as Obj) : null;
  if (!f || !houses) return [];
  const bodies = isObj(f.value.bodies) ? (f.value.bodies as Obj) : {};
  const aru = isObj(f.value.arudhas) ? (f.value.arudhas as Obj) : {};
  const out: Built<HouseCard>[] = [];
  for (let h = 1; h <= 12; h++) {
    const fh = houses[String(h)];
    if (!isObj(fh)) continue;
    const source: DigestSource[] = [src.of(f.ref, `houses.${h}`)];
    const lord = planetCode(fh.lord);
    const pair = [lord, planetCode(fh.co_lord)].filter((x): x is string => Boolean(x));
    const occupants = codes(fh.occupants).map((p) => {
      const b = isObj(bodies[p]) ? (bodies[p] as Obj) : null;
      const n = natureOf(t.argala, p);
      if (b) source.push(src.of(f.ref, `bodies.${p}.dignity`));
      if (n.path && t.argala) source.push(src.of(t.argala, n.path));
      return { planet: p, dignity: b ? str(b.dignity) : null, nature: n.nature };
    });
    const by = isObj(fh.aspected_by) ? (fh.aspected_by as Obj) : {};
    const a = isObj(fh.argala) ? (fh.argala as Obj) : null;
    let sav = num(fh.sav);
    const ak = t.d1?.ashtakavarga;
    if (ak && isObj(ak.value) && num(arr((ak.value as Obj).sav_by_house)[h - 1]) != null) {
      sav = num(arr((ak.value as Obj).sav_by_house)[h - 1]);
      source.push(src.of(ak, `sav_by_house[${h - 1}]`));
    }
    let cls: string[] = Array.isArray(fh.class) ? fh.class.map(str).filter((x): x is string => Boolean(x)) : [];
    const hc = t.d1?.houseCounts;
    const hcClass = hc && isObj(hc.value) && isObj((hc.value as Obj).house_class) ? ((hc.value as Obj).house_class as Obj)[String(h)] : null;
    if (Array.isArray(hcClass)) {
      cls = hcClass.map(str).filter((x): x is string => Boolean(x));
      source.push(src.of(hc!, `house_class.${h}`));
    }
    let arudha: string | null = null;
    const rows = t.arudhas && isObj(t.arudhas.value) ? arr((t.arudhas.value as Obj).bhava_arudhas) : [];
    const j = rows.findIndex((r) => isObj(r) && int(r.house) === h);
    if (j >= 0) {
      arudha = str((rows[j] as Obj).sign);
      source.push(src.of(t.arudhas!, `bhava_arudhas[${j}].sign`));
    } else if (isObj(aru[`A${h}`])) {
      const x = aru[`A${h}`] as Obj;
      arudha = str(x.sign_name) ?? signLabel(x.sign);
      source.push(src.of(f.ref, `arudhas.A${h}`));
    }
    const c = isObj(fh.cusp_nak) ? (fh.cusp_nak as Obj) : null;
    out.push({
      key: `D1.h${h}`,
      row: {
        varga: 'D1',
        house: h,
        sign: str(fh.sign_name) ?? signLabel(fh.sign),
        lord,
        lordHouse: int(fh.lord_house),
        lordSign: signLabel(fh.lord_sign),
        lordDignity: str(fh.lord_dignity),
        coLord: pair.find((x) => x !== lord) ?? null,
        occupants,
        aspectedGraha: codes(by.graha),
        aspectedRasi: codes(by.rasi),
        argala: a ? { primary: codes(a.primary), secondary: codes(a.secondary), obstructed: codes(a.obstructed_by) } : null,
        sav,
        class: cls,
        cuspStar: c && str(c.name) ? { name: str(c.name)!, lord: planetCode(c.lord) ?? str(c.lord) ?? '', pada: int(c.pada) } : null,
        arudha,
      },
      source,
    });
  }
  return out;
}

/** D1 planet cards from the dossier's `bodies`, for a kundli with no stored `dignities` row at all. */
function factPlanetCards(items: Record<string, unknown>, t: ChartTables, src: Sources): Built<PlanetCard>[] {
  const f = factsOf(items);
  const bodies = f && isObj(f.value.bodies) ? (f.value.bodies as Obj) : null;
  if (!f || !bodies) return [];
  const out: Built<PlanetCard>[] = [];
  for (const [p0, b] of Object.entries(bodies)) {
    const p = planetCode(p0);
    if (!p || !isObj(b)) continue;
    const at = `bodies.${p0}`;
    const nak = isObj(b.nak) ? (b.nak as Obj) : null;
    const nature = isObj(b.nature) ? (b.nature as Obj) : null;
    const shad = isObj(b.shadbala) ? (b.shadbala as Obj) : null;
    const to = isObj(b.aspects_to) ? (b.aspects_to as Obj) : {};
    const by = isObj(b.aspected_by) ? (b.aspected_by as Obj) : {};
    out.push({
      key: `D1.${p}`,
      row: {
        varga: 'D1',
        planet: p,
        sign: str(b.sign_name) ?? signLabel(b.sign),
        house: int(b.house),
        degree: num(b.deg_in_sign),
        star: nak ? str(nak.name) : null,
        pada: nak ? int(nak.pada) : null,
        starLord: nak ? planetCode(nak.lord) : planetCode(b.star_lord),
        dignity: str(b.dignity),
        retro: bool(b.retro),
        combust: bool(b.combust),
        war: null,
        dispositor: planetCode(b.sign_lord),
        dispositorHouse: int(b.sign_lord_house),
        chain: [],
        avasthas: {},
        shadbalaRatio: shad ? num(shad.ratio) : null,
        shadbalaRank: shad ? int(shad.rank) : null,
        natural: nature ? str(nature.natural) : null,
        functional: nature ? str(nature.functional) : null,
        owns: arr(b.owns).map(int).filter((h): h is number => h != null),
        aspectsTo: arr(to.graha).map(int).filter((h): h is number => h != null),
        aspectedBy: codes(by.graha),
        conjunctions: codes(b.conj),
      },
      source: [src.of(f.ref, at)],
    });
  }
  void t;
  return out;
}

/** A varga card set from the dossier's `vargas.Dn` (house lords and occupants, planet sign, house and dignity). */
function factVargaCards(items: Record<string, unknown>, f: number, src: Sources): { houses: Built<HouseCard>[]; planets: Built<PlanetCard>[] } {
  const fx = factsOf(items);
  const v = fx ? resolvePath(fx.value, `vargas.D${f}`) : null;
  if (!fx || !isObj(v)) return { houses: [], planets: [] };
  const varga = `D${f}`;
  const planetsObj = isObj(v.planets) ? (v.planets as Obj) : {};
  const housesObj = isObj(v.houses) ? (v.houses as Obj) : {};
  const houses: Built<HouseCard>[] = [];
  for (let h = 1; h <= 12; h++) {
    const x = housesObj[String(h)];
    if (!isObj(x)) continue;
    const source: DigestSource[] = [src.of(fx.ref, `vargas.${varga}.houses.${h}`)];
    const occupants = codes(x.occupants).map((p) => {
      const pv = isObj(planetsObj[p]) ? (planetsObj[p] as Obj) : null;
      if (pv) source.push(src.of(fx.ref, `vargas.${varga}.planets.${p}.dignity`));
      return { planet: p, dignity: pv ? str(pv.dignity) : null, nature: null };
    });
    const lord = planetCode(x.lord);
    const lp = lord && isObj(planetsObj[lord]) ? (planetsObj[lord] as Obj) : null;
    if (lp) source.push(src.of(fx.ref, `vargas.${varga}.planets.${lord}`));
    houses.push({
      key: `${varga}.h${h}`,
      row: { varga, house: h, sign: signLabel(x.sign), lord, lordHouse: lp ? int(lp.house) : null, lordSign: lp ? signLabel(lp.sign) : null, lordDignity: lp ? str(lp.dignity) : null, coLord: null, occupants, aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: [], cuspStar: null, arudha: null },
      source,
    });
  }
  const placement = new Map(placementCards(items, f, src).map((b) => [b.row.planet, b]));
  const planets: Built<PlanetCard>[] = [];
  for (const [p0, pv] of Object.entries(planetsObj)) {
    const p = planetCode(p0);
    if (!p || !isObj(pv)) continue;
    const pl = placement.get(p);
    const owned = houses.filter((h) => h.row.lord === p);
    planets.push({
      key: `${varga}.${p}`,
      row: {
        varga,
        planet: p,
        sign: signLabel(pv.sign),
        house: int(pv.house),
        degree: pl?.row.degree ?? null,
        star: pl?.row.star ?? null,
        pada: pl?.row.pada ?? null,
        starLord: null,
        dignity: str(pv.dignity),
        retro: null,
        combust: null,
        war: null,
        dispositor: null,
        dispositorHouse: null,
        chain: [],
        avasthas: {},
        shadbalaRatio: null,
        shadbalaRank: null,
        natural: null,
        functional: null,
        owns: owned.map((h) => h.row.house).sort(byNum),
        aspectsTo: [],
        aspectedBy: [],
        conjunctions: Object.entries(planetsObj)
          .filter(([q, qv]) => planetCode(q) !== p && isObj(qv) && int(qv.sign) === int(pv.sign))
          .map(([q]) => planetCode(q))
          .filter((q): q is string => Boolean(q)),
      },
      source: [src.of(fx.ref, `vargas.${varga}.planets.${p0}`), ...(pl ? pl.source : []), ...owned.map((h) => h.source[0]!)],
    });
  }
  return { houses, planets };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function yogaRows(items: Record<string, unknown>, src: Sources): Built<YogaRow>[] {
  const out: Built<YogaRow>[] = [];
  const seen = new Map<string, Built<YogaRow>>();
  const facts = ref(items, FACTS_ITEM);
  const factYogas = facts && isObj(facts.value) ? arr((facts.value as Obj).yogas) : [];
  const classByName = new Map<string, { cls: string; i: number }>();
  factYogas.forEach((y, i) => {
    if (isObj(y) && str(y.name) && str(y.class)) classByName.set(str(y.name)!.toLowerCase(), { cls: str(y.class)!, i });
  });
  const add = (b: Built<YogaRow>, varga = 'D1') => {
    const name = `${varga}:${b.row.name.toLowerCase()}`;
    const prev = seen.get(name) ?? seen.get(`${varga}:id:${b.row.id}`);
    if (prev) {
      prev.source.push(...b.source);
      return;
    }
    seen.set(name, b);
    seen.set(`${varga}:id:${b.row.id}`, b);
    out.push(b);
  };
  const codes = (v: unknown) => arr(v).map(planetCode).filter((p): p is string => Boolean(p));
  const houses = (v: unknown) => arr(v).map(int).filter((h): h is number => h != null);

  const yogas = ref(items, 'yogas', 'yogas');
  arr(yogas?.value).forEach((y, i) => {
    if (!isObj(y) || y.present !== true) return;
    const id = str(y.id) ?? slug(String(y.name_en ?? `yoga_${i}`));
    const name = str(y.name_en) ?? id;
    const fc = classByName.get(name.toLowerCase());
    const source = [src.of(yogas!, `[${i}]`)];
    if (fc && facts) source.push(src.of(facts, `yogas[${fc.i}].class`));
    add({ key: `D1.${id}`, row: { id, name, planets: codes(y.planets), houses: houses(y.houses), class: fc?.cls ?? 'named', source: 'yogas' }, source }, 'D1');
  });
  for (const f of VARGA_FACTORS) {
    if (f === 1) continue;
    const vy = ref(items, `yogas.d${f}`, 'yogas') ?? ref(items, `yogas@varga=${f}`, 'yogas');
    if (!vy) continue;
    const varga = `D${f}`;
    arr(vy.value).forEach((y, i) => {
      if (!isObj(y) || y.present !== true) return;
      const id = str(y.id) ?? slug(String(y.name_en ?? `yoga_${i}`));
      const name = str(y.name_en) ?? id;
      add({ key: `${varga}.${id}`, row: { id, name, planets: codes(y.planets), houses: houses(y.houses), class: str(y.class) ?? 'named', source: `yogas.d${f}` }, source: [src.of(vy, `[${i}]`)] }, varga);
    });
  }
  const doshas = ref(items, 'doshas', 'doshas');
  arr(doshas?.value).forEach((d, i) => {
    if (!isObj(d) || d.present !== true) return;
    const id = str(d.id) ?? slug(String(d.name_en ?? `dosha_${i}`));
    add({ key: `D1.${id}`, row: { id, name: str(d.name_en) ?? id, planets: codes(d.planets), houses: houses(d.houses), class: 'dosha', source: 'doshas' }, source: [src.of(doshas!, `[${i}]`)] });
  });
  factYogas.forEach((y, i) => {
    if (!isObj(y) || !str(y.name)) return;
    const name = str(y.name)!;
    const id = `facts_${slug(name)}`;
    add({ key: `D1.${id}`, row: { id, name, planets: codes(y.planets), houses: houses(y.houses), class: str(y.class) ?? 'named', source: 'facts.yogas' }, source: [src.of(facts!, `yogas[${i}]`)] });
  });
  if (!doshas && facts && isObj(facts.value)) {
    arr((facts.value as Obj).doshas).forEach((d, i) => {
      if (!isObj(d) || d.present !== true) return;
      const id = str(d.id) ?? `facts_${slug(String(d.name ?? i))}`;
      add({ key: `D1.${id}`, row: { id, name: str(d.name) ?? id, planets: codes(d.planets), houses: houses(d.houses), class: 'dosha', source: 'facts.doshas' }, source: [src.of(facts, `doshas[${i}]`)] });
    });
  }
  return out;
}

/** The lord and the lord's house of a sign in one chart: a join on the engine's house table of that chart (sign name -> row). */
function lordOfSign(t: ChartTables | undefined, sign: string | null, src: Sources): { lord: string | null; lordHouse: number | null; source: DigestSource[] } {
  if (!t?.houses || !sign) return { lord: null, lordHouse: null, source: [] };
  const rows = arr(t.houses.value);
  const j = rows.findIndex((r) => isObj(r) && str(r.sign) === sign);
  if (j < 0) return { lord: null, lordHouse: null, source: [] };
  const h = rows[j] as Obj;
  return { lord: planetCode(h.lord), lordHouse: int(h.lord_house), source: [src.of(t.houses, `[${j}].lord`)] };
}

function pointRows(items: Record<string, unknown>, tables: Map<string, ChartTables>, planets: Map<string, Built<PlanetCard>>, src: Sources): Built<PointRow>[] {
  const out: Built<PointRow>[] = [];
  const keys = new Set<string>();
  const push = (b: Built<PointRow>) => {
    if (keys.has(b.key)) return;
    keys.add(b.key);
    out.push(b);
  };

  // chara karakas, placed by their planet's card in each chart that has cards
  const karakas: Array<{ id: string; planet: string; source: DigestSource }> = [];
  const kc = ref(items, 'karaka.chara');
  arr(kc?.value).forEach((k, i) => {
    if (isObj(k) && str(k.karaka_code) && planetCode(k.planet)) karakas.push({ id: str(k.karaka_code)!, planet: planetCode(k.planet)!, source: src.of(kc!, `[${i}]`) });
  });
  const facts = ref(items, FACTS_ITEM);
  if (!karakas.length && facts) {
    const chara = resolvePath(facts.value, 'karakas.chara');
    if (isObj(chara)) for (const [id, p] of Object.entries(chara)) if (planetCode(p)) karakas.push({ id, planet: planetCode(p)!, source: src.of(facts, `karakas.chara.${id}`) });
  }
  for (const t of tables.values()) {
    for (const k of karakas) {
      const card = planets.get(`${t.varga}.${k.planet}`);
      if (!card) continue;
      push({ key: `${t.varga}.${k.id}`, row: { id: k.id, varga: t.varga, sign: card.row.sign, house: card.row.house, lord: card.row.dispositor, lordHouse: card.row.dispositorHouse }, source: [k.source, card.source[0]!] });
    }
  }

  // bhava arudhas (A1..A12, AL = A1, UL = A12) and the special points of each chart's arudhas table
  for (const t of tables.values()) {
    if (!t.arudhas || !isObj(t.arudhas.value)) continue;
    const a = t.arudhas.value as Obj;
    arr(a.bhava_arudhas).forEach((r, i) => {
      if (!isObj(r) || !str(r.label)) return;
      const sign = str(r.sign);
      const l = lordOfSign(t, sign, src);
      const row = { varga: t.varga, sign, house: int(r.house_from_lagna), lord: l.lord, lordHouse: l.lordHouse };
      const source = [src.of(t.arudhas!, `bhava_arudhas[${i}]`), ...l.source];
      const label = str(r.label)!;
      push({ key: `${t.varga}.${label}`, row: { id: label, ...row }, source });
      if (label === 'A1') push({ key: `${t.varga}.AL`, row: { id: 'AL', ...row }, source });
      if (label === 'A12') push({ key: `${t.varga}.UL`, row: { id: 'UL', ...row }, source });
    });
    arr(a.special_points).forEach((r, i) => {
      if (!isObj(r) || !str(r.id)) return;
      const sign = str(r.sign);
      const l = lordOfSign(t, sign, src);
      push({ key: `${t.varga}.${str(r.id)}`, row: { id: str(r.id)!, varga: t.varga, sign, house: int(r.house_from_lagna), lord: l.lord, lordHouse: l.lordHouse }, source: [src.of(t.arudhas!, `special_points[${i}]`), ...l.source] });
    });
    for (const field of ['surya_arudhas', 'chandra_arudhas'] as const) {
      arr(a[field]).forEach((r, i) => {
        if (!isObj(r) || !str(r.label)) return;
        const sign = str(r.sign);
        const l = lordOfSign(t, sign, src);
        const label = str(r.label)!;
        push({ key: `${t.varga}.${label}`, row: { id: label, varga: t.varga, sign, house: int(r.house_from_lagna), lord: l.lord, lordHouse: l.lordHouse }, source: [src.of(t.arudhas!, `${field}[${i}]`), ...l.source] });
      });
    }
  }

  const d1 = tables.get('D1');
  const bmBadhaka = d1?.d1?.benefic && isObj(d1.d1.benefic.value) && isObj((d1.d1.benefic.value as Obj).badhaka) ? ((d1.d1.benefic.value as Obj).badhaka as Obj) : null;
  if (bmBadhaka && d1?.d1?.benefic) {
    const sign = str(bmBadhaka.sign);
    const l = lordOfSign(d1, sign, src);
    push({
      key: 'D1.badhaka',
      row: { id: 'badhaka', varga: 'D1', sign, house: int(bmBadhaka.badhaka_house), lord: planetCode(bmBadhaka.badhaka_lord) ?? l.lord, lordHouse: l.lordHouse },
      source: [src.of(d1.d1.benefic, 'badhaka'), ...l.source],
    });
  }
  // the dossier's special lagnas (BB, BL, GL, HL, IL, …) not already placed from the arudhas table
  const sl = facts ? resolvePath(facts.value, 'special_lagnas') : null;
  if (isObj(sl)) {
    for (const [id, v] of Object.entries(sl)) {
      if (!isObj(v)) continue;
      const sign = str(v.sign_name) ?? signLabel(v.sign);
      const l = lordOfSign(d1, sign, src);
      push({ key: `D1.${id}`, row: { id, varga: 'D1', sign, house: int(v.house), lord: l.lord, lordHouse: l.lordHouse }, source: [src.of(facts!, `special_lagnas.${id}`), ...l.source] });
    }
  }
  const sp = ref(items, 'sphutas', 'sphutas');
  arr(sp?.value).forEach((r, i) => {
    if (!isObj(r) || !str(r.id)) return;
    const sign = str(r.sign);
    const l = lordOfSign(d1, sign, src);
    const id = `sphuta.${str(r.id)}`;
    push({ key: `D1.${id}`, row: { id, varga: 'D1', sign, house: int(r.house_from_lagna), lord: l.lord, lordHouse: l.lordHouse }, source: [src.of(sp!, `[${i}]`), ...l.source] });
  });
  return out;
}

const ANNUAL_KEY = /^annual\.(tithi_pravesha|varsha)@year=(\d{4})(?:;divisional_chart_factor=(\d+))?$/;

function periodsOf(r: Ref): Array<{ lord: string; from: string; to: string }> {
  return arr(isObj(r.value) ? (r.value as Obj).periods : null)
    .filter(isObj)
    .map((p) => ({ lord: planetCode(p.lord) ?? str(p.lord) ?? '', from: str(p.start) ?? '', to: str(p.end) ?? '' }))
    .filter((p) => p.lord && p.from && p.to);
}

function annualRows(items: Record<string, unknown>, src: Sources): Built<AnnualRow>[] {
  const out: Built<AnnualRow>[] = [];
  for (const key of Object.keys(items).sort()) {
    const m = ANNUAL_KEY.exec(key);
    if (!m) continue;
    const kind: 'TP' | 'VP' = m[1] === 'tithi_pravesha' ? 'TP' : 'VP';
    const year = Number(m[2]);
    const varga = `D${m[3] ?? 1}`;
    const t = annualTables(items, key, varga);
    const payload = items[key];
    if (!t || !isObj(payload)) continue;
    const source: DigestSource[] = [];
    const cards = houseCards(t, src);
    for (const c of cards) source.push(...c.source);
    const lagnaRef = ref(items, key, 'lagna.sign');
    if (lagnaRef) source.push(src.of(lagnaRef));
    const dashas: AnnualRow['dashas'] = [];
    const sahams: AnnualRow['sahams'] = [];
    if (varga === 'D1') {
      const dashaKeys =
        kind === 'TP'
          ? Object.keys(items).filter((k) => k.startsWith(`annual.tithi_pravesha_dasha@year=${year};`) && !k.includes('divisional_chart_factor'))
          : [`annual.mudda@year=${year}`, `annual.patyayini@year=${year}`];
      for (const dk of dashaKeys.sort()) {
        const r = ref(items, dk);
        if (!r || !isObj(r.value)) continue;
        const periods = periodsOf(r);
        if (!periods.length) continue;
        dashas.push({ system: str((r.value as Obj).system) ?? dk.split('@')[0]!.replace('annual.', ''), periods });
        source.push(src.of(r, 'periods'));
      }
      if (kind === 'VP') {
        const s = ref(items, `annual.sahams@year=${year}`, 'sahams');
        arr(s?.value).forEach((x) => {
          if (isObj(x) && str(x.name)) sahams.push({ name: str(x.name)!, sign: str(x.sign), house: int(x.house_from_lagna) });
        });
        if (s && sahams.length) source.push(src.of(s));
      }
    }
    let muntha: AnnualRow['muntha'];
    let yearLord: AnnualRow['yearLord'];
    let tajakaYogas: AnnualRow['tajakaYogas'];
    if (kind === 'VP' && varga === 'D1') {
      const tj = ref(items, `annual.tajaka@year=${year}`);
      if (tj && isObj(tj.value)) {
        const tjObj = tj.value as Obj;
        if (isObj(tjObj.muntha)) {
          muntha = { sign: str((tjObj.muntha as Obj).sign), house: int((tjObj.muntha as Obj).house_from_lagna) };
          source.push(src.of(tj, 'muntha'));
        }
        if (tjObj.year_lord != null) {
          yearLord = planetCode(tjObj.year_lord);
          source.push(src.of(tj, 'year_lord'));
        }
        if (Array.isArray(tjObj.yoga_list)) {
          tajakaYogas = arr(tjObj.yoga_list)
            .filter((y): y is Obj => isObj(y) && Boolean(str(y.id)))
            .map((y) => ({ id: str(y.id)!, present: y.present === true }));
          source.push(src.of(tj, 'yoga_list'));
        }
      }
    }
    out.push({
      key: `${kind}${year}.${varga}`,
      row: {
        kind,
        year,
        varga,
        lagna: lagnaRef ? str(lagnaRef.value) : null,
        houses: cards.map((c) => c.row),
        dashas,
        sahams,
        ...(muntha !== undefined ? { muntha } : {}),
        ...(yearLord !== undefined ? { yearLord } : {}),
        ...(tajakaYogas !== undefined ? { tajakaYogas } : {}),
      },
      source,
    });
  }
  return out;
}

function starProfile(items: Record<string, unknown>, planets: Map<string, Built<PlanetCard>>, src: Sources): Built<StarProfile> | null {
  const facts = ref(items, FACTS_ITEM);
  const np = facts ? resolvePath(facts.value, 'nakshatra_profile') : null;
  const source: DigestSource[] = [];
  const moon = planets.get('D1.Mo');
  let moonStar: string | null = null;
  let moonStarLord: string | null = null;
  let lagnaStar: string | null = null;
  const taras: StarProfile['taras'] = [];
  const gandanta: string[] = [];
  if (isObj(np)) {
    const janma = isObj(np.janma) ? (np.janma as Obj) : null;
    if (janma) {
      moonStar = str(janma.name);
      moonStarLord = planetCode(janma.lord);
      source.push(src.of(facts!, 'nakshatra_profile.janma'));
    }
    if (isObj(np.lagna)) {
      lagnaStar = str((np.lagna as Obj).name);
      source.push(src.of(facts!, 'nakshatra_profile.lagna'));
    }
    if (isObj(np.taras_from_janma)) {
      for (const [star, tara] of Object.entries(np.taras_from_janma)) if (str(tara)) taras.push({ star, tara: str(tara)! });
      source.push(src.of(facts!, 'nakshatra_profile.taras_from_janma'));
    }
    if (isObj(np.gandanta)) {
      for (const [k, v] of Object.entries(np.gandanta)) if (v === true) gandanta.push(k);
      source.push(src.of(facts!, 'nakshatra_profile.gandanta'));
    }
  }
  if (!moonStar && moon?.row.star) {
    moonStar = moon.row.star;
    moonStarLord = moon.row.starLord;
    source.push(moon.source[0]!);
  }
  if (!moonStar && !lagnaStar && !taras.length) return null;
  return { key: 'profile', row: { moonStar, moonStarLord, lagnaStar, taras, gandanta }, source };
}

/**
 * Which source each varga's cards come from, in order of preference: the engine's tables (`dignities.dN`; for D1 also
 * the dossier's houses), else the dossier's `vargas.Dn`, else the `varga.dN` placement rows (planet cards only).
 */
export function vargaCoverage(items: Record<string, unknown>): { full: number[]; dossier: number[]; placementOnly: number[] } {
  const full: number[] = [];
  const dossier: number[] = [];
  const placementOnly: number[] = [];
  const facts = items[FACTS_ITEM];
  for (const f of VARGA_FACTORS) {
    if (items[natalKey('dignities', f)] != null || (f === 1 && isObj(facts) && isObj(facts.houses))) full.push(f);
    else if (isObj(facts) && isObj(resolvePath(facts, `vargas.D${f}`))) dossier.push(f);
    else if (items[`varga.d${f}`] != null) placementOnly.push(f);
  }
  return { full, dossier, placementOnly };
}

export interface BuildOptions {
  kundliId: string;
  /** item key -> the stored calc_version of that row, for each source */
  calcVersions?: Record<string, string | null>;
}

/**
 * PURE. The digest rows for one kundli from its stored payloads (`items`: catalogue id or `id@variant` -> payload, plus
 * the dossier under `facts`). Same input, same rows, in the same order.
 */
export function buildDigestRows(items: Record<string, unknown>, opts: BuildOptions): DigestRowInput[] {
  const src = new Sources(opts.calcVersions ?? {});
  const rows: DigestRowInput[] = [];
  const tables = new Map<string, ChartTables>();
  const planets = new Map<string, Built<PlanetCard>>();
  const { full, dossier, placementOnly } = vargaCoverage(items);
  for (const f of full) {
    const t = natalTables(items, f) ?? (f === 1 ? natalTablesFromFacts(items) : null);
    if (!t) continue;
    tables.set(t.varga, t);
    const hc = t.houses ? houseCards(t, src) : f === 1 ? factHouseCards(items, t, src) : [];
    for (const b of hc) rows.push({ section: 'house', key: b.key, row: b.row, source: b.source });
    const pc = t.planets ? planetCards(t, src) : f === 1 ? factPlanetCards(items, t, src) : [];
    for (const b of pc) {
      planets.set(b.key, b);
      rows.push({ section: 'planet', key: b.key, row: b.row, source: b.source });
    }
  }
  for (const f of dossier) {
    const { houses: hs, planets: ps } = factVargaCards(items, f, src);
    for (const b of hs) rows.push({ section: 'house', key: b.key, row: b.row, source: b.source });
    for (const b of ps) {
      planets.set(b.key, b);
      rows.push({ section: 'planet', key: b.key, row: b.row, source: b.source });
    }
  }
  for (const f of placementOnly) {
    for (const b of placementCards(items, f, src)) {
      planets.set(b.key, b);
      rows.push({ section: 'planet', key: b.key, row: b.row, source: b.source });
    }
  }
  for (const b of yogaRows(items, src)) rows.push({ section: 'yoga', key: b.key, row: b.row, source: b.source });
  for (const b of pointRows(items, tables, planets, src)) rows.push({ section: 'point', key: b.key, row: b.row, source: b.source });
  for (const b of annualRows(items, src)) rows.push({ section: 'annual', key: b.key, row: b.row, source: b.source });
  const star = starProfile(items, planets, src);
  if (star) rows.push({ section: 'star', key: star.key, row: star.row, source: star.source });
  return rows;
}

// ---------------------------------------------------------------- the database run

/** The natal catalogue ids the digest reads (fetched first when `fetch` is set). Annual rows come from annualSet.ts. */
export const DIGEST_NATAL_TYPES: readonly string[] = [
  'dignities', 'aspects', 'argala.d1', 'arudhas', 'house_counts', 'ashtakavarga', 'avasthas', 'strength.shadbala', 'benefic_malefic',
  'yogas', 'doshas', 'karaka.chara', 'sphutas', 'panchanga.birth', 'relations', 'dasha.applicable',
  ...VARGA_FACTORS.filter((f) => f !== 1).map((f) => `varga.d${f}`),
  ...VARGA_FACTORS.filter((f) => f !== 1).map((f) => `dignities.d${f}`),
  ...VARGA_FACTORS.filter((f) => f !== 1).map((f) => `house_counts.d${f}`),
];

const BATCH = 500;
const inflight = new Map<string, Promise<DigestBuildResult>>();

export interface DigestBuildResult {
  status: DigestStatus;
  rows: number;
  activation: number;
  ms: number;
  error?: string;
}

export interface DigestBuildOptions {
  /** call the engine for natal inputs that are missing (through ensureChartData); default false: build from what is stored */
  fetch?: boolean;
  /** 'YYYY-MM-DD'; the activation calendar runs to thirty years after it */
  today?: string;
}

/** The error type a failed build is stamped with (doc 53 §4.7: the type only, never a message with data in it). */
export function digestErrorType(err: unknown): string {
  const e = err as { code?: unknown; name?: unknown } | null;
  if (e && typeof e.code === 'string' && e.code) return e.code.slice(0, 60);
  if (e && typeof e.name === 'string' && e.name && e.name !== 'Error') return e.name.slice(0, 60);
  return err instanceof DigestInputError ? 'DigestInputError' : 'Error';
}

export class DigestInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DigestInputError';
  }
}

/** Every stored ready row of a kundli (natal and year rows; not the `current` pointers), keyed for the builder. */
export async function loadDigestInputs(prisma: PrismaClient, kundliId: string): Promise<{ items: Record<string, unknown>; calcVersions: Record<string, string | null> }> {
  const { FACTS_VERSION } = await import('../data/store.js');
  const [rows, facts] = await Promise.all([
    prisma.kundliData.findMany({ where: { kundli_id: kundliId, status: 'ready', ayanamsa: 'LAHIRI', NOT: { variant: 'current' } }, select: { data_type: true, variant: true, calc_version: true, payload: true } }),
    prisma.kundliFacts.findUnique({ where: { kundli_id_facts_version: { kundli_id: kundliId, facts_version: FACTS_VERSION } }, select: { dossier: true, engine_commit: true } }),
  ]);
  const items: Record<string, unknown> = {};
  const calcVersions: Record<string, string | null> = {};
  for (const r of rows) {
    if (r.payload == null) continue;
    const k = itemKey(r.data_type, r.variant);
    items[k] = r.payload;
    calcVersions[k] = r.calc_version;
  }
  if (facts?.dossier) {
    items[FACTS_ITEM] = facts.dossier;
    calcVersions[FACTS_ITEM] = `facts.v${FACTS_VERSION}`;
  }
  return { items, calcVersions };
}

/**
 * Build (or rebuild) one kundli's digest and activation calendar: status building, read the stored rows, build in
 * memory, then in ONE transaction delete the kundli's old rows and insert the new ones (batches of 500), and stamp
 * ready with the version and built_at. Idempotent and re-entrant (one build per kundli per process; a second process
 * writes the same rows, duplicates skipped). A failure leaves the old rows, sets `failed` and the error type.
 * The ready stamp is written only while the status is still `building`, so a rebuild asked for during the build
 * (status set back to pending) is not lost: the sweep runs it.
 */
export function buildDigest(prisma: PrismaClient, kundliId: string, opts: DigestBuildOptions = {}): Promise<DigestBuildResult> {
  const existing = inflight.get(kundliId);
  if (existing) return existing;
  const p = doBuild(prisma, kundliId, opts).finally(() => inflight.delete(kundliId));
  inflight.set(kundliId, p);
  return p;
}

async function doBuild(prisma: PrismaClient, kundliId: string, opts: DigestBuildOptions): Promise<DigestBuildResult> {
  const t0 = Date.now();
  const startedAt = new Date();
  const claimed = await prisma.kundli.updateMany({ where: { id: kundliId }, data: { digest_status: 'building', digest_built_at: startedAt, digest_error: null } });
  if (!claimed.count) return { status: 'failed', rows: 0, activation: 0, ms: Date.now() - t0, error: 'NotFound' };
  try {
    if (opts.fetch) {
      const { ensureChartData, prismaChartDataRepo } = await import('../chartData/store.js');
      await ensureChartData({ repo: prismaChartDataRepo(prisma) }, kundliId, [...DIGEST_NATAL_TYPES], { concurrency: 1 });
    }
    const { items, calcVersions } = await loadDigestInputs(prisma, kundliId);
    if (items.dignities == null && items[FACTS_ITEM] == null) throw new DigestInputError('no D1 tables stored for this kundli');
    const rows = buildDigestRows(items, { kundliId, calcVersions });
    const today = opts.today ?? new Date().toISOString().slice(0, 10);
    const activation = buildActivationRows(items, rows, { today });
    const builtAt = new Date();
    await writeDigest(prisma, kundliId, rows, activation, builtAt);
    const ms = Date.now() - t0;
    return { status: 'ready', rows: rows.length, activation: activation.length, ms };
  } catch (err) {
    const type = digestErrorType(err);
    await prisma.kundli.updateMany({ where: { id: kundliId, digest_status: 'building' }, data: { digest_status: 'failed', digest_error: type } }).catch(() => undefined);
    return { status: 'failed', rows: 0, activation: 0, ms: Date.now() - t0, error: type };
  }
}

async function writeDigest(prisma: PrismaClient, kundliId: string, rows: DigestRowInput[], activation: ActivationRowInput[], builtAt: Date): Promise<void> {
  const ops: Prisma.PrismaPromise<unknown>[] = [prisma.kundliDigest.deleteMany({ where: { kundli_id: kundliId } })];
  for (let i = 0; i < rows.length; i += BATCH) {
    ops.push(
      prisma.kundliDigest.createMany({
        data: rows.slice(i, i + BATCH).map((r) => ({ kundli_id: kundliId, section: r.section, key: r.key, row: r.row as unknown as Prisma.InputJsonValue, source: r.source as unknown as Prisma.InputJsonValue, digest_version: DIGEST_VERSION, built_at: builtAt })),
        skipDuplicates: true,
      })
    );
  }
  ops.push(prisma.kundliActivation.deleteMany({ where: { kundli_id: kundliId } }));
  for (let i = 0; i < activation.length; i += BATCH) {
    ops.push(
      prisma.kundliActivation.createMany({
        data: activation.slice(i, i + BATCH).map((a) => ({
          kundli_id: kundliId,
          system: a.system,
          family: a.family,
          level: a.level,
          lord: a.lord,
          sign: a.sign,
          from_date: new Date(`${a.from}T00:00:00Z`),
          to_date: new Date(`${a.to}T00:00:00Z`),
          houses: a.houses,
          parent_lord: a.parentLord,
          digest_version: DIGEST_VERSION,
        })),
      })
    );
  }
  ops.push(prisma.kundli.updateMany({ where: { id: kundliId, digest_status: 'building' }, data: { digest_status: 'ready', digest_version: DIGEST_VERSION, digest_built_at: builtAt, digest_error: null } }));
  await prisma.$transaction(ops);
}
