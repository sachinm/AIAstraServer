/**
 * Foundation pack (docs/reading-engine/27 §A.1, §B.4 stage 1): the kundli read once into the tables every timing system
 * cites. Built from the dossier only (Radha computed every value); this file re-keys fields and follows lordship links,
 * it derives no placement. Deterministic and keyed by the dossier hash, so the blind cast is reproducible.
 *
 * The house-lord chart (§A.1 item 4) goes two hops: house -> its lord -> the house the lord sits in -> that lord's sign
 * lord (dispositor) -> the dispositor's house. Each link carries the dossier path it was read from.
 */
import { createHash } from 'node:crypto';
import type { Dossier } from '../facts/types.js';
import { PLANET_CODES, type PlanetCode } from '../facts/constants.js';
import type { KarakaCode } from '../packs/frames.js';

export const DUSTHANAS = [6, 8, 12] as const;
const KENDRAS = new Set([1, 4, 7, 10]);
const TRIKONAS = new Set([1, 5, 9]);
const STRONG_DIGNITIES = new Set(['exalted', 'own', 'moolatrikona', 'mooltrikona']);

export interface PlanetCard {
  code: PlanetCode;
  sign: number;
  house: number;
  dignity: string | null;
  retro: boolean;
  /** Houses it lords (sign lord or co-lord, from `houses.*.lord` / `co_lord`) */
  owns: number[];
  starLord: PlanetCode | null;
  starLordHouse: number | null;
  signLord: PlanetCode | null;
  signLordHouse: number | null;
  /** Houses it aspects by rasi drishti / graha drishti (`bodies.*.aspects_to`) */
  rasiAspects: number[];
  grahaAspects: number[];
  shadbalaRank: number | null;
  strongDignity: boolean;
  debilitated: boolean;
}

export interface HouseCard {
  house: number;
  sign: number;
  lord: PlanetCode;
  coLord: PlanetCode | null;
  occupants: string[];
  argala: { primary: string[]; secondary: string[]; obstructedBy: string[] };
  sav: number | null;
}

export interface HouseLordLink {
  house: number;
  lord: PlanetCode;
  lordHouse: number;
  lordDignity: string | null;
  /** Where the lord sits counted from the house it rules (1 = in its own house) */
  lordFromOwn: number;
  lordIn6812FromOwn: boolean;
  lordPlacement: 'own' | 'kendra' | 'trikona' | 'dusthana' | 'other';
  dispositor: PlanetCode | null;
  dispositorHouse: number | null;
  evidence: string[];
}

export interface Point {
  sign: number;
  house: number;
}

export interface Foundation {
  hash: string;
  lagnaSign: number;
  houses: Record<number, HouseCard>;
  planets: Partial<Record<PlanetCode, PlanetCard>>;
  houseLordChart: HouseLordLink[];
  exchanges: string[][];
  lagnaLordChain: HouseLordLink | null;
  arudhas: Record<string, Point>;
  specialLagnas: Record<string, Point>;
  chara: Partial<Record<KarakaCode, PlanetCode>>;
  /** Natural karaka planet -> significations, as the dossier lists them */
  naturalKarakas: Record<string, string[]>;
  functional: { benefic: string[]; malefic: string[]; neutral: string[] };
}

/** Count from house `a` to house `b` (1 = same house) */
export function houseFrom(a: number, b: number): number {
  return ((((b - a) % 12) + 12) % 12) + 1;
}

const isPlanet = (c: unknown): c is PlanetCode => typeof c === 'string' && (PLANET_CODES as readonly string[]).includes(c);

export function dossierHash(dossier: Dossier): string {
  return createHash('sha256').update(JSON.stringify(dossier)).digest('hex').slice(0, 16);
}

export function buildFoundation(dossier: Dossier): Foundation {
  const houses: Record<number, HouseCard> = {};
  for (let h = 1; h <= 12; h++) {
    const c = dossier.houses[String(h)];
    if (!c) continue;
    houses[h] = {
      house: h,
      sign: c.sign,
      lord: c.lord,
      coLord: isPlanet(c.co_lord) ? c.co_lord : null,
      occupants: [...(c.occupants ?? [])],
      argala: { primary: [...(c.argala?.primary ?? [])], secondary: [...(c.argala?.secondary ?? [])], obstructedBy: [...(c.argala?.obstructed_by ?? [])] },
      sav: c.sav ?? null,
    };
  }
  const ownsOf = (p: PlanetCode): number[] =>
    Object.values(houses)
      .filter((h) => h.lord === p || h.coLord === p)
      .map((h) => h.house);

  const planets: Partial<Record<PlanetCode, PlanetCard>> = {};
  for (const code of PLANET_CODES) {
    const b = dossier.bodies[code];
    if (!b) continue;
    const dignity = b.dignity ?? null;
    planets[code] = {
      code,
      sign: b.sign,
      house: b.house,
      dignity,
      retro: b.retro === true,
      owns: ownsOf(code),
      starLord: isPlanet(b.star_lord) ? b.star_lord : null,
      starLordHouse: b.star_lord_house ?? null,
      signLord: isPlanet(b.sign_lord) ? b.sign_lord : null,
      signLordHouse: b.sign_lord_house ?? null,
      rasiAspects: [...(b.aspects_to?.rasi ?? [])],
      grahaAspects: [...(b.aspects_to?.graha ?? [])],
      shadbalaRank: b.shadbala?.rank ?? null,
      strongDignity: dignity != null && STRONG_DIGNITIES.has(dignity),
      debilitated: dignity === 'debilitated',
    };
  }

  const houseLordChart: HouseLordLink[] = Object.values(houses).map((h) => {
    const lp = planets[h.lord];
    const lordHouse = lp?.house ?? dossier.houses[String(h.house)]!.lord_house;
    const lordFromOwn = houseFrom(h.house, lordHouse);
    const ownsHere = lp?.owns.includes(lordHouse) ?? false;
    const placement: HouseLordLink['lordPlacement'] = ownsHere
      ? 'own'
      : (DUSTHANAS as readonly number[]).includes(lordHouse)
        ? 'dusthana'
        : KENDRAS.has(lordHouse)
          ? 'kendra'
          : TRIKONAS.has(lordHouse)
            ? 'trikona'
            : 'other';
    return {
      house: h.house,
      lord: h.lord,
      lordHouse,
      lordDignity: lp?.dignity ?? dossier.houses[String(h.house)]!.lord_dignity ?? null,
      lordFromOwn,
      lordIn6812FromOwn: [6, 8, 12].includes(lordFromOwn),
      lordPlacement: placement,
      dispositor: lp?.signLord ?? null,
      dispositorHouse: lp?.signLordHouse ?? null,
      evidence: [`houses.${h.house}.lord`, `houses.${h.house}.lord_house`, `bodies.${h.lord}.sign_lord`, `bodies.${h.lord}.sign_lord_house`],
    };
  });

  const point = (v: { sign: number; house: number } | undefined): Point | null => (v && Number.isInteger(v.sign) && Number.isInteger(v.house) ? { sign: v.sign, house: v.house } : null);
  const arudhas: Record<string, Point> = {};
  for (const [k, v] of Object.entries(dossier.arudhas ?? {})) {
    const p = point(v);
    if (p) arudhas[k] = p;
  }
  const specialLagnas: Record<string, Point> = {};
  for (const [k, v] of Object.entries(dossier.special_lagnas ?? {})) {
    const p = point(v);
    if (p) specialLagnas[k] = p;
  }
  const chara: Partial<Record<KarakaCode, PlanetCode>> = {};
  for (const [k, v] of Object.entries(dossier.karakas?.chara ?? {})) if (isPlanet(v)) chara[k as KarakaCode] = v;

  return {
    hash: dossierHash(dossier),
    lagnaSign: houses[1]?.sign ?? dossier.bodies.La?.sign ?? 0,
    houses,
    planets,
    houseLordChart,
    exchanges: (dossier.relations?.exchanges ?? []).map((e) => [...e]),
    lagnaLordChain: houseLordChart.find((l) => l.house === 1) ?? null,
    arudhas,
    specialLagnas,
    chara,
    naturalKarakas: { ...(dossier.karakas?.natural ?? {}) },
    functional: {
      benefic: [...(dossier.relations?.functional?.benefic ?? [])],
      malefic: [...(dossier.relations?.functional?.malefic ?? [])],
      neutral: [...(dossier.relations?.functional?.neutral ?? [])],
    },
  };
}

/** The house (from the lagna) holding a sign, read from `houses.*.sign` */
export function houseOfSign(f: Foundation, sign: number): number | null {
  for (const h of Object.values(f.houses)) if (h.sign === sign) return h.house;
  return null;
}

/** An arudha (A1..A12, AL, UL) or special lagna (HL, GL …) by key, with the dossier path it came from */
export function pointOf(f: Foundation, key: string): { point: Point; path: string } | null {
  if (f.arudhas[key]) return { point: f.arudhas[key]!, path: `arudhas.${key}` };
  if (f.specialLagnas[key]) return { point: f.specialLagnas[key]!, path: `special_lagnas.${key}` };
  return null;
}
