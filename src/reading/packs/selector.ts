/**
 * Evidence-pack selector (no LLM, no astrology): slices the Lambda dossier and transit chart for one reading.
 * Deterministic and byte-stable: the same dossier + transit chart + intent yields the same JSON text, with the
 * per-user stable sections first (header, d1) and the horizon-dependent ones last, so Gemini's implicit prefix
 * cache hits across consecutive questions.
 *
 * Evidence ids are dot paths into the pack itself (e.g. `detail.houses.10.lord`, `varga.D10.d1_lords.10.varga_house`,
 * `transits.rows.Ke_2026-12-06.house_from_lagna`). `resolveEvidence` returns the value, so a claim can be checked.
 */
import { createHash } from 'node:crypto';
import { readingFullBase } from '../config.js';
import { LAGNA_CODE, PLANET_CODES, type PlanetCode, type VargaKey } from '../facts/constants.js';
import type { Body, DashaPeriod, Dossier, House, Varga } from '../facts/types.js';
import type { TransitChart } from '../transits/types.js';
import type { Intent } from '../types.js';
import { FRAMES, horizonRange, type SubjectFrame, type SubjectId } from './frames.js';
import { selectTransits, type TransitSection } from './transitTable.js';

/**
 * `base` is subject-independent (birth, D-1 skeleton, relations, janma/lagna nakshatra): the same bytes for every
 * question a user asks, so it is the cacheable prefix. Everything after it depends on subject and horizon.
 */
export type PackSection = 'base' | 'frame' | 'detail' | 'varga' | 'arudha' | 'dasha' | 'transits';
/** Stable-prefix order (per-user stable first, subject/horizon-dependent last). */
export const SECTION_ORDER: PackSection[] = ['base', 'frame', 'detail', 'varga', 'arudha', 'dasha', 'transits'];

export type Analyst = 'promise' | 'dasha' | 'transit' | 'nakshatra' | 'single';
/** Which sections each analyst receives (03-chart-facts-dossier.md §3). `single` is the Phase 1 one-call path. */
export const ANALYST_SECTIONS: Record<Analyst, PackSection[]> = {
  promise: ['base', 'frame', 'detail', 'varga', 'arudha'],
  dasha: ['base', 'frame', 'detail', 'varga', 'dasha'],
  transit: ['base', 'frame', 'arudha', 'dasha', 'transits'],
  nakshatra: ['base', 'frame', 'detail', 'dasha', 'transits'],
  single: SECTION_ORDER,
};

export interface EvidencePack {
  subject: SubjectId;
  sections: Partial<Record<PackSection, unknown>>;
  /** ids of evidence the synthesizer should quote first */
  keyFrame: { houses: number[]; lords: string[]; karakas: string[]; vargas: string[] };
  missing: string[];
  stats: { approxTokens: number; transitRowsDropped: number };
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

function nakLabel(b: Body): string {
  return `${b.nak.name}-${b.nak.pada}`;
}

function compactBody(code: string, b: Body): Record<string, unknown> {
  const o: Record<string, unknown> = { sign: b.sign_name, h: b.house, deg: r1(b.deg_in_sign), nak: nakLabel(b) };
  if (b.dignity) o.dig = b.dignity;
  if (b.retro) o.retro = true;
  if (b.combust) o.combust = true;
  if (b.flags?.length) o.flags = b.flags;
  if (b.owns?.length) o.owns = b.owns;
  return o;
}

function detailBody(b: Body): Record<string, unknown> {
  const o: Record<string, unknown> = { ...compactBody('', b) };
  if (b.nature) o.nature = `${b.nature.natural}/${b.nature.functional}`;
  if (b.conj?.length) o.conj = b.conj;
  if (b.aspects_to) o.aspects_houses = b.aspects_to.graha;
  if (b.aspected_by && (b.aspected_by.graha.length || b.aspected_by.rasi.length)) o.aspected_by = b.aspected_by;
  if (b.star_lord) o.star_lord = `${b.star_lord} (house ${b.star_lord_house})`;
  if (b.sign_lord) o.sign_lord = `${b.sign_lord} (house ${b.sign_lord_house})`;
  if (b.shadbala) o.shadbala = { rupas: b.shadbala.rupas, ratio: b.shadbala.ratio, rank: b.shadbala.rank };
  if (b.ishta != null && b.kashta != null) o.ishta_kashta = [b.ishta, b.kashta];
  if (b.bav_at_sign != null) o.bav_at_sign = b.bav_at_sign;
  if (b.tara_from_janma) o.tara = b.tara_from_janma;
  if (b.navamsa_sign != null) o.navamsa_sign = b.navamsa_sign;
  return o;
}

function compactHouse(h: House): Record<string, unknown> {
  const o: Record<string, unknown> = { sign: h.sign_name, lord: h.lord, lord_h: h.lord_house, occ: h.occupants };
  if (h.class?.length) o.cls = h.class;
  if (h.sav != null) o.sav = h.sav;
  return o;
}

function detailHouse(h: House): Record<string, unknown> {
  const o: Record<string, unknown> = {
    sign: h.sign_name, lord: h.lord, lord_house: h.lord_house, lord_dignity: h.lord_dignity, occ: h.occupants, aspected_by: h.aspected_by,
  };
  if (h.co_lord) o.co_lord = `${h.co_lord} (house ${h.co_lord_house})`;
  if (h.argala) o.argala = h.argala;
  if (h.class?.length) o.cls = h.class;
  if (h.sav != null) o.sav = h.sav;
  if (h.cusp_nak) o.cusp_nak = `${h.cusp_nak.name} (${h.cusp_nak.lord})`;
  return o;
}

function vargaBlock(key: VargaKey, v: Varga, frameHouses: number[]): Record<string, unknown> {
  const planets: Record<string, unknown> = {};
  for (const p of PLANET_CODES) {
    const vp = v.planets[p];
    if (vp) planets[p] = { h: vp.house, dig: vp.dignity, ...(vp.vargottama ? { vargottama: true } : {}) };
  }
  const houses: Record<string, unknown> = {};
  const d1lords: Record<string, unknown> = {};
  for (const h of frameHouses) {
    const vh = v.houses[String(h)];
    if (vh) houses[String(h)] = { sign: vh.sign, lord: vh.lord, occ: vh.occupants };
    const lp = v.d1_lord_positions[String(h)];
    if (lp) d1lords[String(h)] = { lord: lp.lord, varga_house: lp.varga_house, varga_dignity: lp.varga_dignity };
  }
  // varga lagna, its lord, and kendra occupants (1,4,7,10) matter for D-10/D-9 style reads
  const kendraOcc: Record<string, unknown> = {};
  for (const h of [1, 4, 7, 10]) {
    const vh = v.houses[String(h)];
    if (vh) kendraOcc[String(h)] = vh.occupants;
  }
  return { lagna: v.lagna_sign_name ?? v.lagna_sign, lagna_lord: v.lagna_lord, lagna_lord_h: v.lagna_lord_house, planets, houses, d1_lords: d1lords, kendra_occ: kendraOcc };
}

function aggregateToAd(periods: DashaPeriod[]): DashaPeriod[] {
  const map = new Map<string, DashaPeriod>();
  for (const p of periods) {
    const k = `${p.md}-${p.ad}`;
    const cur = map.get(k);
    if (!cur) map.set(k, { level: 'ad', md: p.md, ad: p.ad, start: p.start, end: p.end });
    else {
      if (p.start < cur.start) cur.start = p.start;
      if (p.end > cur.end) cur.end = p.end;
    }
  }
  return [...map.values()].sort((a, b) => (a.start < b.start ? -1 : 1));
}

export interface BuildPackInput {
  dossier: Dossier;
  transits: TransitChart | null;
  intent: Pick<Intent, 'horizon' | 'mentionsPlanets' | 'focusPoints'>;
  subject: SubjectId;
  asOf: string;
}

/**
 * The rest of the user's stable chart data, in compact form. Subject-independent, so it is part of the cacheable `base`
 * (same bytes for every question) and lifts the prefix past Gemini's 4,096-token cache minimum.
 */
export function fullBaseExtras(d: Dossier): Record<string, unknown> {
  const all_vargas: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(d.vargas ?? {}) as Array<[string, Varga | undefined]>) {
    if (!v) continue;
    const planets: Record<string, unknown> = {};
    for (const [code, p] of Object.entries(v.planets ?? {})) planets[code] = { s: p.sign, h: p.house, dig: p.dignity, ...(p.vargottama ? { vg: true } : {}) };
    all_vargas[key] = { lagna: v.lagna_sign_name ?? v.lagna_sign, lagna_lord: v.lagna_lord, planets };
  }
  const vim = d.dasha?.vimshottari;
  const nar = d.dasha?.narayana;
  const dasha_tree = {
    vimshottari: {
      mahadashas: (vim?.mahadashas ?? []).map((m) => `${m.md} ${m.start}..${m.end}`),
      antardashas: (vim?.periods ?? []).filter((p) => p.level === 'ad').map((p) => `${p.md}-${p.ad} ${p.start}..${p.end}`),
    },
    narayana: (nar?.periods ?? []).map((p) => `${p.md_sign_name}(${p.md_lord})-${p.ad_sign_name} ${p.start}..${p.end}`),
  };
  return {
    all_vargas,
    ashtakavarga: d.ashtakavarga,
    dasha_tree,
    arudhas: d.arudhas,
    special_lagnas: d.special_lagnas,
    karakas: d.karakas,
    yogas: (d.yogas ?? []).map((y) => ({ name: y.name, planets: y.planets, houses: y.houses, class: y.class })),
    doshas: (d.doshas ?? []).map((x) => ({ name: x.name, present: x.present, ...(x.planets ? { planets: x.planets } : {}), ...(x.houses ? { houses: x.houses } : {}) })),
  };
}

export function buildEvidencePack(input: BuildPackInput): EvidencePack {
  const { dossier: d, intent, asOf } = input;
  const frame: SubjectFrame = FRAMES[input.subject];
  const hz = horizonRange(intent.horizon, asOf);
  const missing: string[] = [];
  const lagnaSign = d.bodies[LAGNA_CODE]!.sign;
  void lagnaSign;

  // frame houses and their lords / co-lords
  // A planet the user named brings its own houses (where it sits, what it owns) into the frame, e.g. "Ketu over my
  // Jupiter" adds Jupiter's houses. Capped so a long list of planets cannot blow up the pack.
  const mentionHouses: number[] = [];
  for (const m of intent.mentionsPlanets ?? []) {
    const b = d.bodies[m];
    if (!b) continue;
    mentionHouses.push(b.house, ...(b.owns ?? []));
  }
  const frameHouses = [...new Set([...frame.houses, ...mentionHouses])].slice(0, 8);
  const lordCodes = new Set<string>();
  for (const h of frameHouses) {
    const hh = d.houses[String(h)];
    if (!hh) continue;
    lordCodes.add(hh.lord);
    if (hh.co_lord) lordCodes.add(hh.co_lord);
  }
  const charaCodes = frame.charaKarakas.map((k) => d.karakas.chara[k]).filter(Boolean) as string[];
  const karakaCodes = new Set<string>([...frame.karakas, ...charaCodes, ...(intent.mentionsPlanets ?? [])]);

  // ---- frame (subject and horizon dependent)
  const cur = d.dasha.vimshottari.current;
  const frameSection = {
    as_of: asOf,
    subject: frame.label,
    horizon: { from: hz.from, to: hz.to },
    houses: frameHouses,
    lords: [...lordCodes],
    karakas: [...karakaCodes],
    chara: Object.fromEntries(frame.charaKarakas.filter((k) => d.karakas.chara[k]).map((k) => [k, d.karakas.chara[k]])),
    vargas: frame.vargas,
    arudhas: frame.arudhas,
    running: { md: cur.md, ad: cur.ad, pd: cur.pd, md_end: cur.md_end, ad_end: cur.ad_end, pd_end: cur.pd_end },
    ...(frame.caveat ? { caveat: frame.caveat } : {}),
  };
  // ---- d1 skeleton: all 12 houses, all bodies
  const d1: Record<string, unknown> = { houses: {} as Record<string, unknown>, bodies: {} as Record<string, unknown> };
  for (let h = 1; h <= 12; h++) (d1.houses as Record<string, unknown>)[String(h)] = compactHouse(d.houses[String(h)]!);
  for (const code of [LAGNA_CODE, ...PLANET_CODES, 'Md', 'Gk']) {
    const b = d.bodies[code];
    if (b) (d1.bodies as Record<string, unknown>)[code] = code === LAGNA_CODE || code === 'Md' || code === 'Gk' ? compactBody(code, b) : detailBody(b);
  }

  // ---- subject detail: frame houses, their lords, karakas
  const detail: Record<string, unknown> = { houses: {}, yogas: [] as unknown[] };
  for (const h of frameHouses) {
    const hh = d.houses[String(h)];
    if (hh) (detail.houses as Record<string, unknown>)[String(h)] = detailHouse(hh);
  }
  const touched = new Set<string>([...lordCodes, ...karakaCodes]);
  detail.yogas = d.yogas
    .filter((y) => y.source !== 'pyjhora.yoga' && (y.houses.some((h) => frameHouses.includes(h)) || y.planets.some((p) => touched.has(p))))
    .map((y) => ({ name: y.name, planets: y.planets, houses: y.houses, class: y.class, ...(y.note ? { note: y.note } : {}) }))
    .slice(0, 8);
  detail.sav_frame = Object.fromEntries(frameHouses.map((h) => [String(h), d.houses[String(h)]?.sav ?? null]));

  // ---- varga(s)
  const varga: Record<string, unknown> = {};
  for (const key of frame.vargas) {
    const v = d.vargas[key];
    if (v) varga[key] = vargaBlock(key, v, frameHouses);
    else missing.push(`${key} not in dossier`);
  }

  // ---- arudha and special lagnas
  const arudha: Record<string, unknown> = {};
  for (const k of ['AL', ...frame.arudhas]) {
    const a = d.arudhas[k];
    if (a) arudha[k] = { sign: a.sign_name, h: a.house, occ: a.occupants, lord: a.lord };
  }
  for (const k of frame.specialLagnas) {
    const s = d.special_lagnas[k];
    if (s) arudha[k] = { sign: s.sign_name, h: s.house, nak: s.nak.name, occ: s.occupants };
  }

  // ---- relations
  const rel = d.relations;
  const relations = {
    lagna_lord: rel.lagna_lord ?? null,
    exchanges: rel.exchanges,
    yogakaraka: rel.yogakaraka,
    marakas: rel.marakas,
    functional: rel.functional,
    kendra_trikona_lords: rel.kendra_trikona_lords,
    dusthana_lords: rel.dusthana_lords,
  };

  // ---- nakshatra: janma/lagna/taras go in the cacheable base; per-planet star lords are subject-dependent (detail)
  const np = d.nakshatra_profile as Record<string, any>;
  const base = {
    birth: { date: d.birth.date, time: d.birth.time, place: d.birth.place },
    lagna: d.bodies[LAGNA_CODE]!.sign_name,
    moon: `${d.bodies.Mo!.sign_name} ${nakLabel(d.bodies.Mo!)} (house ${d.bodies.Mo!.house})`,
    panchanga: pick(d.panchanga, ['tithi', 'nakshatra', 'yoga', 'karana', 'vara_name', 'lunar_month']),
    houses: d1.houses,
    bodies: d1.bodies,
    relations,
    nakshatra: {
      janma: np.janma,
      lagna: np.lagna,
      taras_from_janma: np.taras_from_janma,
      gandanta: np.gandanta,
      pushkara: np.pushkara,
      tenth_cusp_nak: np.tenth_cusp_nak,
    },
  };
  // ---- dasha (horizon dependent)
  const inH = (p: DashaPeriod) => p.end >= hz.from && p.start <= hz.to;
  let periods = d.dasha.vimshottari.periods.filter(inH);
  if (hz.months > 12) periods = aggregateToAd(periods.length ? periods : []);
  const periodsOut: Record<string, unknown> = {};
  const lordsNeeded = new Set<string>();
  for (const p of periods) {
    const key = p.pd ? `${p.md}-${p.ad}-${p.pd}_${p.start}` : `${p.md}-${p.ad}_${p.start}`;
    periodsOut[key] = { md: p.md, ad: p.ad, ...(p.pd ? { pd: p.pd } : {}), from: p.start, to: p.end };
    lordsNeeded.add(p.md);
    lordsNeeded.add(p.ad);
    if (p.pd) lordsNeeded.add(p.pd);
  }
  for (const c of [cur.md, cur.ad, cur.pd]) if (c) lordsNeeded.add(c);
  const dashaLords: Record<string, unknown> = {};
  for (const c of lordsNeeded) {
    const vpos: Record<string, unknown> = {};
    for (const key of frame.vargas) {
      const vp = d.vargas[key]?.planets[c];
      if (vp) vpos[key] = { h: vp.house, dig: vp.dignity };
    }
    if (Object.keys(vpos).length) dashaLords[c] = { varga: vpos };
  }
  const dasha = {
    current: cur,
    periods: periodsOut,
    lords: dashaLords,
    narayana_current: d.dasha.narayana.current,
  };

  // ---- transits (horizon dependent)
  let transits: TransitSection | null = null;
  if (input.transits) {
    transits = selectTransits({
      chart: input.transits,
      frameHouses,
      interestingNatal: [...lordCodes, ...karakaCodes],
      horizon: hz,
      mentionsPlanets: intent.mentionsPlanets,
      asOf,
    });
  } else {
    missing.push('transits unavailable');
  }

  const baseOut = readingFullBase() ? { ...base, ...fullBaseExtras(d) } : base;
  const sections: EvidencePack['sections'] = { base: baseOut, frame: frameSection, detail, varga, arudha, dasha, ...(transits ? { transits } : {}) };
  const approxTokens = Math.ceil(JSON.stringify(sections).length / 3.6);
  return {
    subject: input.subject,
    sections,
    keyFrame: { houses: frameHouses, lords: [...lordCodes], karakas: [...karakaCodes], vargas: frame.vargas },
    missing,
    stats: { approxTokens, transitRowsDropped: transits?.dropped_rows ?? 0 },
  };
}

function pick(o: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/** Merge multiple subjects' packs: shared sections once (d1/nakshatra/relations), per-subject detail under the subject id. */
export function mergeSubjectPacks(packs: EvidencePack[]): EvidencePack {
  if (packs.length === 1) return packs[0]!;
  const first = packs[0]!;
  const merged: Record<string, unknown> = {};
  for (const sec of SECTION_ORDER) {
    if (sec === 'base') {
      merged[sec] = first.sections[sec];
      continue;
    }
    const bySubject: Record<string, unknown> = {};
    for (const p of packs) bySubject[p.subject] = p.sections[sec];
    merged[sec] = bySubject;
  }
  merged.frame = Object.fromEntries(packs.map((p) => [p.subject, p.sections.frame]));
  return {
    subject: first.subject,
    sections: merged as EvidencePack['sections'],
    keyFrame: {
      houses: [...new Set(packs.flatMap((p) => p.keyFrame.houses))],
      lords: [...new Set(packs.flatMap((p) => p.keyFrame.lords))],
      karakas: [...new Set(packs.flatMap((p) => p.keyFrame.karakas))],
      vargas: [...new Set(packs.flatMap((p) => p.keyFrame.vargas))],
    },
    missing: [...new Set(packs.flatMap((p) => p.missing))],
    stats: { approxTokens: Math.ceil(JSON.stringify(merged).length / 3.6), transitRowsDropped: packs.reduce((n, p) => n + p.stats.transitRowsDropped, 0) },
  };
}

/** Compact, deterministic JSON text of the chosen sections, in the stable-prefix order. */
export function renderPack(pack: EvidencePack, analyst: Analyst = 'single'): string {
  const wanted = new Set(ANALYST_SECTIONS[analyst]);
  const ordered: Record<string, unknown> = {};
  for (const sec of SECTION_ORDER) if (wanted.has(sec) && pack.sections[sec] !== undefined) ordered[sec] = pack.sections[sec];
  return JSON.stringify(ordered);
}

/** The cacheable prefix: identical bytes for every question a user asks until their dossier changes. */
export function renderBase(pack: EvidencePack): string {
  return JSON.stringify({ base: pack.sections.base });
}

/** Everything after the base for one analyst (subject and horizon dependent). */
export function renderSubject(pack: EvidencePack, analyst: Analyst = 'single'): string {
  const wanted = new Set(ANALYST_SECTIONS[analyst]);
  const ordered: Record<string, unknown> = {};
  for (const sec of SECTION_ORDER) if (sec !== 'base' && wanted.has(sec) && pack.sections[sec] !== undefined) ordered[sec] = pack.sections[sec];
  return JSON.stringify(ordered);
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export function hashPack(pack: EvidencePack, analyst: Analyst = 'single'): string {
  return hashText(renderPack(pack, analyst));
}

/** Resolve an evidence id (dot path) against a pack; undefined if it does not exist. */
export function resolveEvidence(pack: EvidencePack, id: string): unknown {
  let cur: unknown = pack.sections;
  for (const part of id.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** All leaf ids of a pack (used by the grounding gate and tests). */
export function listEvidenceIds(pack: EvidencePack, maxDepth = 8): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (v === null || typeof v !== 'object' || depth > maxDepth) {
      out.push(path);
      return;
    }
    if (Array.isArray(v)) {
      out.push(path);
      return;
    }
    for (const [k, c] of Object.entries(v as Record<string, unknown>)) walk(c, path ? `${path}.${k}` : k, depth + 1);
  };
  walk(pack.sections, '', 0);
  return out;
}

export type { PlanetCode };
