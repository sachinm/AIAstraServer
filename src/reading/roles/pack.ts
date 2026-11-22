/**
 * The roles pack (docs/techniques/13 §3 and §4.1; doc 11 §4.10): everything the roles unit (`reading.roles`) is given
 * about the chart, built by SELECTING stored engine output and nothing else. Sources: `kundli_data` rows by type,
 * `kundli_facts.dossier`, `kundli_digest` and `kundli_activation`.
 *
 * Rules (CLAUDE.md, AGENTS.md "Product rules"; doc 13 §3 "Node astrology found on the way"):
 *  - Node computes nothing astrological: no grading, scoring, counting, deriving or text matching. Values are passed on as
 *    the engine stored them; only keys are renamed for readability, and rows are joined to a planet by the engine's own
 *    planet field.
 *  - No text pattern of any kind is used in this file, and nothing is imported from the Node layers doc 13 names
 *    (`area/houseLayers`, `area/career`, `dasha/dashaAssessment`, `self/sub/promise`, `dasha/retrogradeRules`).
 *    `tests/unit/reading/roles/pack.test.ts` checks both on this file's source.
 *  - A field the engine does not store is named under `missing`, never filled in.
 *  - Never selected: the dossier's birth block, panchanga and meta (birth date, time, place, coordinates); the engine's
 *    free-text notes and rules (some name the calculation library, SOUL.md §1). The one stored key that names the
 *    library (`yogakaraka_pyjhora`) is renamed `yogakaraka`.
 *
 * Preparation path only (doc 11 §4.5): nothing on the live reading path imports this file.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { levelShown, shownSystems, systemDef } from '../clocks/systems.js';
import { parseApplicability } from '../self/clock.js';
import type { ActivationFamily, ActivationLevel, ActivationRow } from '../digest/activation.js';
import { lordCode } from '../timeline/dashas.js';
import { DIGEST_VERSION, FACTS_ITEM, type HouseCard, type PlanetCard, type PointRow, type StarProfile, type YogaRow } from '../digest/types.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

/** a planet as a stored row names it (`{ id, name }`, `{ code }`, 'Sun', 'Su') -> its code: a label lookup (as the digest) */
function planetCode(v: unknown): string | null {
  if (isObj(v)) return lordCode(v.code) ?? lordCode(v.name);
  return lordCode(v);
}

/** the value at a dotted key path ('natural.benefics') inside a payload; undefined when it does not resolve */
function resolvePath(payload: unknown, path: string): unknown {
  let cur: unknown = payload;
  for (const part of path.split('.')) {
    if (!isObj(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** JSON with object keys sorted, so the hash does not depend on key order (the shape of techniques/pieces canonicalJson) */
function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Obj;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}

export const ROLES_PACK_VERSION = 'roles.v1';

/**
 * Optional engine fields a parallel engine change is adding (doc 13 §5: E-R1 yogi/avayogi, E-R2 eclipse, E-R3 yogada and
 * natal sahams, E-R4 kartari and net argala, E-R7 maturity dates). The engine branch had no commits for them on
 * 2026-11-22, so the stored names are PROVISIONAL: each field is read from the first candidate `[type, path]` a stored
 * row has (path '' = the whole payload), else named under `missing`. Update the candidates when the engine release lands.
 */
export const OPTIONAL_ENGINE_FIELDS: ReadonlyArray<{ name: string; request: string; at: ReadonlyArray<readonly [string, string]> }> = [
  { name: 'yogi', request: 'E-R1', at: [['sphutas', 'yogi_planet'], ['yogi', 'yogi_planet'], ['yogi', 'yogi']] },
  { name: 'sahayogi', request: 'E-R1', at: [['sphutas', 'sahayogi_planet'], ['yogi', 'sahayogi_planet'], ['yogi', 'sahayogi']] },
  { name: 'avayogi', request: 'E-R1', at: [['sphutas', 'avayogi_planet'], ['yogi', 'avayogi_planet'], ['yogi', 'avayogi']] },
  { name: 'eclipse', request: 'E-R2', at: [['eclipse', ''], ['avasthas', 'proximity_audit.eclipse']] },
  { name: 'yogada', request: 'E-R3', at: [['yogada', ''], ['benefic_malefic', 'yogada']] },
  { name: 'natal_sahams', request: 'E-R3', at: [['sahams.natal', ''], ['sahams', '']] },
  { name: 'kartari', request: 'E-R4', at: [['kartari', ''], ['argala.d1', 'kartari']] },
  { name: 'net_argala', request: 'E-R4', at: [['argala.net', ''], ['argala.d1', 'net_argala']] },
  { name: 'maturity_dates', request: 'E-R7', at: [['maturity', ''], ['planet_maturity', '']] },
];

/** The natal `kundli_data` types the pack reads (variant ''), the optional ones included. */
export const ROLES_PACK_TYPES: readonly string[] = [
  ...new Set([
    'dignities',
    'relations',
    'benefic_malefic',
    'strength.vimsopaka',
    'strength.shadbala',
    'karaka.chara',
    'argala.d1',
    'avasthas',
    'sphutas',
    'dasha.applicable',
    ...OPTIONAL_ENGINE_FIELDS.flatMap((f) => f.at.map(([type]) => type)),
  ]),
];

/** What the pack is built from (the loader reads it; tests build it). */
export interface RolesPackSources {
  /** natal payloads by catalogue type, and the dossier under `facts` */
  items: Record<string, unknown>;
  /** the stored D1 digest rows; null when the digest is not ready in this rule set */
  digest: { planets: PlanetCard[]; houses: HouseCard[]; points: PointRow[]; yogas: YogaRow[]; star: StarProfile | null } | null;
  /** the stored activation rows, levels 1 and 2 */
  activation: readonly ActivationRow[];
}

export interface RolesPeriod {
  system: string;
  level: number;
  lord: string | null;
  sign: string | null;
  from: string;
  to: string;
  houses: number[];
}

export interface RolesDashaSystem {
  system: string;
  label: string;
  /** `always`: a verified system; `applies`: a conditional system the engine's `dasha.applicable` says applies */
  verdict: 'always' | 'applies';
  /** `maha_only`: only the maha dasha level is verified, so no sub-periods are given */
  levels: 'all' | 'maha_only';
  running: { period: RolesPeriod; subPeriods: RolesPeriod[]; runningSub: RolesPeriod | null } | null;
  next: { period: RolesPeriod; subPeriods: RolesPeriod[] } | null;
}

export interface RolesPack {
  v: typeof ROLES_PACK_VERSION;
  /** facts with no date: the same for the life of the chart */
  natal: {
    planets: Record<string, Record<string, unknown>>;
    friendships: Record<string, unknown> | null;
    beneficsAndMalefics: Record<string, unknown> | null;
    yogas: YogaRow[];
    taras: Record<string, unknown> | null;
    argala: Record<string, HouseCard['argala']>;
    points: Record<string, PointRow>;
    upapada: PointRow | null;
    badhaka: Record<string, unknown> | null;
    charaKarakas: unknown[];
    optional: Record<string, unknown>;
  };
  /** the running and the next maha dasha of every system that applies, selected by date from the stored rows */
  dated: { systems: RolesDashaSystem[]; applicability: Array<{ type: unknown; applies: unknown; checked: unknown }> };
  /** every field the spec asks for that no stored row carries, by name */
  missing: string[];
}

export interface RolesPackResult {
  pack: RolesPack;
  /** sha256 (24 hex) of the whole pack; `natalHash` and `datedHash` of its two parts */
  hash: string;
  natalHash: string;
  datedHash: string;
  asOf: string;
}

const sha = (v: unknown): string => createHash('sha256').update(canonicalJson(v)).digest('hex').slice(0, 24);

/** the row of a stored list whose planet field is this planet (the engine's `{ id, name }`, a name or a code) */
function rowOf(list: unknown[], planet: string, field?: string): Obj | null {
  const r = list.find((x) => isObj(x) && planetCode(field ? x[field] : x) === planet);
  return isObj(r) ? r : null;
}

/** a dossier map keyed by planet (code or name), entry for this planet */
function entryOf(map: unknown, planet: string): Obj | null {
  if (!isObj(map)) return null;
  for (const [k, v] of Object.entries(map)) if (planetCode(k) === planet && isObj(v)) return v;
  return null;
}

const nameOf = (v: unknown): unknown => (isObj(v) && 'name' in v ? v.name : v);
const names = (v: unknown): unknown[] => arr(v).map(nameOf);

function vimshopakaOf(items: Record<string, unknown>, planet: string): Record<string, unknown> | null {
  const schemes = resolvePath(items['strength.vimsopaka'], 'schemes');
  if (!isObj(schemes)) return null;
  const out: Record<string, unknown> = {};
  for (const [scheme, s] of Object.entries(schemes)) {
    if (!isObj(s)) continue;
    const r = rowOf(arr(s.planets), planet);
    if (!r) continue;
    out[scheme] = { score: orNull(r.score), maxScore: orNull(s.max_score), strongVargaCount: orNull(r.strong_varga_count), strongVargas: orNull(r.strong_vargas) };
  }
  return Object.keys(out).length ? out : null;
}

/** vargottama as the dossier states it per varga (`vargas.<Dn>.planets.<p>.vargottama`) */
function vargottamaOf(facts: Obj | null, planet: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const vargas = facts && isObj(facts.vargas) ? facts.vargas : null;
  if (!vargas) return out;
  for (const [varga, v] of Object.entries(vargas)) {
    const p = isObj(v) ? entryOf(v.planets, planet) : null;
    if (p && 'vargottama' in p) out[varga] = p.vargottama;
  }
  return out;
}

function planetsOf(src: RolesPackSources, missing: Set<string>): RolesPack['natal']['planets'] {
  const { items } = src;
  const facts = isObj(items[FACTS_ITEM]) ? (items[FACTS_ITEM] as Obj) : null;
  const dignities = arr(resolvePath(items.dignities, 'planets'));
  const shad = arr(resolvePath(items['strength.shadbala'], 'planets'));
  const bm = arr(resolvePath(items.benefic_malefic, 'planets'));
  const karakas = arr(items['karaka.chara']);
  const starLords = resolvePath(facts, 'nakshatra_profile.star_lords');
  const cards = new Map((src.digest?.planets ?? []).map((c) => [c.planet, c]));
  const codes = [...new Set([...cards.keys(), ...dignities.map((r) => planetCode(r)).filter((p): p is string => Boolean(p))])];
  const out: RolesPack['natal']['planets'] = {};
  for (const p of codes) {
    const c = cards.get(p) ?? null;
    const d = rowOf(dignities, p);
    const body = entryOf(facts?.bodies, p);
    const s = rowOf(shad, p);
    const b = rowOf(bm, p);
    const k = karakas.filter((x) => isObj(x) && planetCode(x.planet) === p).map((x) => ({ code: (x as Obj).karaka_code, meaning: (x as Obj).meaning }));
    const sl = entryOf(starLords, p);
    out[p] = {
      sign: c?.sign ?? orNull(d?.sign),
      house: c?.house ?? orNull(d?.house_from_lagna),
      degree: c?.degree ?? orNull(d?.longitude_in_sign),
      dignity: d ? orNull(d.dignity) : (c?.dignity ?? null),
      moolatrikonaSign: d ? orNull(d.moolatrikona_sign) : null,
      relationToSignLord: d ? orNull(d.relation_to_sign_lord) : null,
      signLord: { planet: d ? nameOf(d.sign_lord) ?? null : (c?.dispositor ?? null), house: d ? orNull(d.sign_lord_house) : (c?.dispositorHouse ?? null), dignity: d ? orNull(d.sign_lord_dignity) : null },
      combust: d ? orNull(d.combust ?? d.is_combust) : (c?.combust ?? null),
      sunSeparationDeg: d ? orNull(d.sun_separation_deg) : null,
      solarProximity: c?.sunProximity ?? null,
      planetaryWarWith: d ? orNull(d.planetary_war_with) : null,
      retrograde: d ? orNull(d.retrograde ?? d.is_retrograde) : (c?.retro ?? null),
      meanRetrograde: d ? orNull(d.is_mean_retrograde) : (c?.isMeanRetrograde ?? null),
      motionKind: d ? orNull(d.motion_kind) : (c?.motionKind ?? null),
      motionState: d ? orNull(d.motion_state) : (c?.motionState ?? null),
      stationary: d ? orNull(d.is_stationary) : (c?.isStationary ?? null),
      vakraDignityRegime: d ? orNull(d.vakra_dignity_regime) : (c?.vakraDignityRegime ?? null),
      cheshtaBala: d ? orNull(d.cheshta_bala) : (c?.cheshtaBala ?? null),
      vargottama: vargottamaOf(facts, p),
      dossierFlags: body ? orNull(body.flags) : null,
      vimshopaka: vimshopakaOf(items, p),
      ishta: body ? orNull(body.ishta) : null,
      kashta: body ? orNull(body.kashta) : null,
      shadbala: s ? { ratio: orNull(s.ratio), rank: orNull(s.rank), totalRupas: orNull(s.total_rupas), requiredRupas: orNull(s.required_rupas) } : null,
      avasthas: c?.avasthas ?? null,
      avasthaMultipliers: c?.avasthaMultipliers ?? null,
      star: c ? { name: c.star, pada: c.pada, lord: c.starLord } : d && isObj(d.star) ? { name: orNull(d.star.name), pada: orNull(d.star.pada), lord: nameOf(d.star.lord) ?? null } : null,
      taraFromBirthStar: body ? orNull(body.tara_from_janma) : sl ? orNull(sl.tara) : null,
      dispositorChain: c?.chain ?? null,
      starLordChain: c?.starChain ?? null,
      aspectsReceived: { graha: body ? orNull(resolvePath(body, 'aspected_by.graha')) : null, rasi: body ? orNull(resolvePath(body, 'aspected_by.rasi')) : null, grahaFromAspectsTable: c?.aspectedBy ?? null },
      natural: c?.natural ?? null,
      functional: c?.functional ?? null,
      functionalRoles: b ? orNull(b.functional_roles) : null,
      maraka: b ? orNull(b.maraka) : null,
      kendraLord: b ? orNull(b.kendra_lord) : null,
      trikonaLord: b ? orNull(b.trikona_lord) : null,
      housesOwned: b ? orNull(b.houses_owned) : (c?.owns ?? null),
      charaKaraka: k.length ? k : null,
    };
  }
  if (!dignities.length) missing.add('type:dignities');
  if (!src.digest) missing.add('digest');
  if (!facts) missing.add('facts_dossier');
  if (!shad.length) missing.add('type:strength.shadbala');
  if (!isObj(resolvePath(items['strength.vimsopaka'], 'schemes'))) missing.add('type:strength.vimsopaka');
  if (!karakas.length) missing.add('type:karaka.chara');
  return out;
}

/** the three friendship tables, reshaped row by column with the engine's planet names; values as stored */
function friendshipsOf(items: Record<string, unknown>, missing: Set<string>): Record<string, unknown> | null {
  const rel = items.relations;
  if (!isObj(rel)) {
    missing.add('type:relations');
    return null;
  }
  const order = arr(rel.planets).map(nameOf).map((x) => String(x));
  const table = (m: unknown): Record<string, Record<string, unknown>> => {
    const out: Record<string, Record<string, unknown>> = {};
    arr(m).forEach((row, i) => {
      const from = order[i];
      if (from === undefined) return;
      out[from] = {};
      arr(row).forEach((v, j) => {
        const to = order[j];
        if (to !== undefined) out[from]![to] = v;
      });
    });
    return out;
  };
  return { orientation: orNull(rel.orientation), planets: order, natural: table(rel.naisargika), temporary: table(rel.tatkalika), compound: table(rel.panchadha) };
}

function beneficsOf(items: Record<string, unknown>, missing: Set<string>): Record<string, unknown> | null {
  const bm = items.benefic_malefic;
  const facts = isObj(items[FACTS_ITEM]) ? (items[FACTS_ITEM] as Obj) : null;
  const rel = facts && isObj(facts.relations) ? facts.relations : null;
  if (!isObj(bm) && !rel) {
    missing.add('type:benefic_malefic');
    return null;
  }
  const out: Record<string, unknown> = {};
  if (isObj(bm)) {
    out.natural = { benefics: names(resolvePath(bm, 'natural.benefics')), malefics: names(resolvePath(bm, 'natural.malefics')) };
    out.functional = {
      benefics: names(resolvePath(bm, 'functional.benefics')),
      malefics: names(resolvePath(bm, 'functional.malefics')),
      neutrals: names(resolvePath(bm, 'functional.neutrals')),
      beneficLordHouses: orNull(resolvePath(bm, 'functional.benefic_lord_houses')),
      maleficLordHouses: orNull(resolvePath(bm, 'functional.malefic_lord_houses')),
      neutralLordHouses: orNull(resolvePath(bm, 'functional.neutral_lord_houses')),
    };
    out.chartSpecific = { method: orNull(resolvePath(bm, 'chart_specific.method')), benefics: names(resolvePath(bm, 'chart_specific.benefics')), malefics: names(resolvePath(bm, 'chart_specific.malefics')) };
    out.maraka = { marakas: names(resolvePath(bm, 'maraka.marakas')), houses: orNull(resolvePath(bm, 'maraka.maraka_houses')), houseLords: names(resolvePath(bm, 'maraka.maraka_house_lords')) };
    // the stored key names the calculation library; renamed, the value as stored
    out.yogakaraka = names(bm.yogakaraka_pyjhora);
    out.kendraLords = names(bm.kendra_lords);
    out.trikonaLords = names(bm.trikona_lords);
    out.kendraAndTrikonaLords = names(bm.kendra_and_trikona_lords);
  }
  if (rel) {
    out.dossier = { marakas: orNull(rel.marakas), marakasExtended: orNull(rel.marakas_extended), yogakaraka: orNull(rel.yogakaraka), functional: orNull(rel.functional), dusthanaLords: orNull(rel.dusthana_lords), kendraTrikonaLords: orNull(rel.kendra_trikona_lords), exchanges: orNull(rel.exchanges) };
  }
  return out;
}

/** the taras from the birth star exactly as the engine names them, and the birth star itself */
function tarasOf(items: Record<string, unknown>, star: StarProfile | null, missing: Set<string>): Record<string, unknown> | null {
  const np = resolvePath(items[FACTS_ITEM], 'nakshatra_profile');
  if (!isObj(np)) {
    // the digest's star profile holds the same engine rows (selected from the dossier when the digest was built)
    if (star) return { birthStar: { name: star.moonStar, lord: star.moonStarLord, pada: null }, fromBirthStar: Object.fromEntries(star.taras.map((t) => [t.star, t.tara])), byPlanet: {} };
    missing.add('taras');
    return null;
  }
  const j = isObj(np.janma) ? np.janma : null;
  const byPlanet: Record<string, unknown> = {};
  if (isObj(np.star_lords)) for (const [k, v] of Object.entries(np.star_lords)) if (isObj(v) && 'tara' in v) byPlanet[planetCode(k) ?? k] = v.tara;
  return {
    birthStar: j ? { name: orNull(j.name), lord: orNull(j.lord), pada: orNull(j.pada) } : null,
    fromBirthStar: isObj(np.taras_from_janma) ? np.taras_from_janma : null,
    byPlanet,
  };
}

function optionalOf(items: Record<string, unknown>, missing: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of OPTIONAL_ENGINE_FIELDS) {
    let found: unknown;
    for (const [type, path] of f.at) {
      const v = path ? resolvePath(items[type], path) : items[type];
      if (v !== undefined && v !== null) {
        found = { value: v, from: path ? `${type}.${path}` : type };
        break;
      }
    }
    if (found === undefined) missing.add(f.name);
    else out[f.name] = found;
  }
  return out;
}

const periodOf = (r: ActivationRow): RolesPeriod => ({ system: r.system, level: r.level, lord: r.lord, sign: r.sign, from: r.from, to: r.to, houses: [...r.houses] });
const byFrom = (a: ActivationRow, b: ActivationRow) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0);

/** the running and next maha dasha (level 1) of each system that applies, with their level-2 rows, selected by date */
function dashasOf(src: RolesPackSources, asOf: string, missing: Set<string>): RolesPack['dated'] {
  const raw = src.items['dasha.applicable'];
  if (raw === undefined) missing.add('type:dasha.applicable');
  const applicability = parseApplicability(raw);
  const present = [...new Set(src.activation.map((r) => r.system))];
  const systems: RolesDashaSystem[] = [];
  for (const s of shownSystems(present, applicability)) {
    const def = systemDef(s.id);
    const names = new Set([s.stored, s.id, ...(def?.storedAs ?? [])]);
    const mine = src.activation.filter((r) => names.has(r.system));
    const l1 = mine.filter((r) => r.level === 1).sort(byFrom);
    if (!l1.length) continue;
    const i = l1.findIndex((r) => r.from <= asOf && asOf < r.to);
    const subsOf = (md: ActivationRow) => (levelShown(s.id, 2) ? mine.filter((r) => r.level === 2 && r.from >= md.from && r.to <= md.to).sort(byFrom).map(periodOf) : []);
    const running = i >= 0 ? l1[i]! : null;
    const next = i >= 0 ? (l1[i + 1] ?? null) : (l1.find((r) => r.from > asOf) ?? null);
    const runningSubs = running ? subsOf(running) : [];
    systems.push({
      system: s.stored,
      label: s.label,
      verdict: def?.show === 'if_applies' ? 'applies' : 'always',
      levels: s.levels,
      running: running ? { period: periodOf(running), subPeriods: runningSubs, runningSub: runningSubs.find((r) => r.from <= asOf && asOf < r.to) ?? null } : null,
      next: next ? { period: periodOf(next), subPeriods: subsOf(next) } : null,
    });
  }
  if (!systems.length) missing.add('dasha_periods');
  return {
    systems,
    // the verdict rows without their free-text rule (it names the calculation library) and their sign facts
    applicability: arr(raw).filter(isObj).map((r) => ({ type: orNull(r.type), applies: orNull(r.applies), checked: orNull(r.checked) })),
  };
}

/** PURE. The pack from its stored sources. Same sources and `asOf` (within one maha dasha), same pack. */
export function rolesPackFrom(src: RolesPackSources, asOf: string): RolesPackResult {
  const missing = new Set<string>();
  const { items } = src;
  const planets = planetsOf(src, missing);
  const points: Record<string, PointRow> = {};
  for (const p of src.digest?.points ?? []) if (p.varga === 'D1') points[p.id] = p;
  const argala: Record<string, HouseCard['argala']> = {};
  for (const h of src.digest?.houses ?? []) if (h.varga === 'D1') argala[String(h.house)] = h.argala;
  const storedBadhaka = resolvePath(items.benefic_malefic, 'badhaka');
  const badhaka = isObj(storedBadhaka) ? { ...storedBadhaka, from: 'benefic_malefic.badhaka' } : points.badhaka ? { ...points.badhaka, from: 'digest point D1.badhaka' } : null;
  if (!badhaka) missing.add('badhaka');
  const upapada = points.UL ?? null;
  if (!upapada) missing.add('upapada');
  // the 2nd and the 7th from the upapada are not stored as engine points; counting them from the upapada is a house count
  missing.add('upapada_2nd');
  missing.add('upapada_7th');
  if (!Object.keys(argala).length) missing.add('argala');

  const pack: RolesPack = {
    v: ROLES_PACK_VERSION,
    natal: {
      planets,
      friendships: friendshipsOf(items, missing),
      beneficsAndMalefics: beneficsOf(items, missing),
      yogas: src.digest?.yogas ?? [],
      taras: tarasOf(items, src.digest?.star ?? null, missing),
      argala,
      points,
      upapada,
      badhaka,
      charaKarakas: arr(items['karaka.chara']).filter(isObj).map((k) => ({ code: orNull(k.karaka_code), meaning: orNull(k.meaning), planet: orNull(k.planet) })),
      optional: optionalOf(items, missing),
    },
    dated: dashasOf(src, asOf, missing),
    missing: [...missing].sort(),
  };
  return { pack, hash: sha(pack), natalHash: sha(pack.natal), datedHash: sha(pack.dated), asOf };
}

/** Reads the stored sources of one chart (four reads, in parallel). Through the caller's client, so sealed rows are opened. */
export async function loadRolesPackSources(prisma: PrismaClient, kundliId: string): Promise<RolesPackSources> {
  const { FACTS_VERSION } = await import('../data/store.js');
  const [rows, facts, kundli, digestRows, act] = await Promise.all([
    prisma.kundliData.findMany({ where: { kundli_id: kundliId, status: 'ready', ayanamsa: 'LAHIRI', variant: '', data_type: { in: [...ROLES_PACK_TYPES] } }, select: { data_type: true, payload: true } }),
    prisma.kundliFacts.findUnique({ where: { kundli_id_facts_version: { kundli_id: kundliId, facts_version: FACTS_VERSION } }, select: { dossier: true } }),
    prisma.kundli.findUnique({ where: { id: kundliId }, select: { digest_status: true, digest_version: true } }),
    prisma.kundliDigest.findMany({ where: { kundli_id: kundliId }, select: { section: true, key: true, row: true } }),
    prisma.kundliActivation.findMany({ where: { kundli_id: kundliId, level: { lte: 2 } }, orderBy: [{ from_date: 'asc' }, { level: 'asc' }, { system: 'asc' }] }),
  ]);
  const items: Record<string, unknown> = {};
  for (const r of rows) if (r.payload != null) items[r.data_type] = r.payload;
  if (facts?.dossier) items[FACTS_ITEM] = facts.dossier;
  // the stored digest rows as written (not the loader's view, which fills legacy chara karaka planets in Node)
  const ready = kundli?.digest_status === 'ready' && kundli.digest_version === DIGEST_VERSION;
  const of = <T>(section: string, d1Only: boolean) => digestRows.filter((r) => r.section === section && (!d1Only || r.key.startsWith('D1.'))).map((r) => r.row as unknown as T);
  const star = digestRows.find((r) => r.section === 'star' && r.key === 'profile');
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    items,
    digest: ready ? { planets: of<PlanetCard>('planet', true), houses: of<HouseCard>('house', true), points: of<PointRow>('point', true), yogas: of<YogaRow>('yoga', false), star: star ? (star.row as unknown as StarProfile) : null } : null,
    activation: act.map((r) => ({ system: r.system, family: r.family as ActivationFamily, level: r.level as ActivationLevel, lord: r.lord, sign: r.sign, from: iso(r.from_date), to: iso(r.to_date), houses: r.houses, parentLord: r.parent_lord })),
  };
}

/** The roles pack of one chart on `asOf` (YYYY-MM-DD) and its hashes. Reads only; writes nothing. */
export async function buildRolesPack(kundliId: string, asOf: string, deps: { prisma: PrismaClient }): Promise<RolesPackResult> {
  return rolesPackFrom(await loadRolesPackSources(deps.prisma, kundliId), asOf);
}
