/**
 * The GET /api/self/v2 body from what is stored (docs/reading-engine/66 §4.5). Pure: the route reads the store, the clock
 * and the profile, and this maps them. Card and hero words come from the Personalizer as stored; "Chart details" carry
 * the Oracle's own text. Every string that reaches the person passes `redactEngineTerms` (SOUL.md §1).
 */
import type { OracleArea } from '../areaDoc.js';
import type { ClockResolutionV2 } from '../clock.js';
import { clockLabel, redactEngineTerms } from '../words.js';
import {
  SELF_V2_AREAS,
  type CardStatus,
  type HeroDoc,
  type PersonalCard,
  type ProfilePack,
  type SelfV2AreaId,
  type SelfV2AreaView,
  type SelfV2ClockView,
  type SelfV2Response,
  type SelfV2Status,
} from '../v2types.js';
import { missingFacts, pickHeroQuestion } from './question.js';
import type { SelfV2Latest } from './storeContract.js';
import { CLOCK_REASON_LINES, NOT_APPLICABLE_LINES, systemLine } from './words.js';

/** v2 area → the Oracle document keys to look under, the v2 id first, then the legacy panel it replaces */
export const ORACLE_AREA_KEYS: Readonly<Record<SelfV2AreaId, readonly string[]>> = {
  now: ['now'],
  stuck: ['stuck', 'struggle'],
  chapter: ['chapter'],
  diagnosis: ['diagnosis'],
  lagna: ['lagna'],
  mind: ['mind'],
  body: ['body'],
  drive: ['drive', 'atma'],
  presence: ['presence'],
  yogas: ['yogas'],
  chapters: ['chapters'],
  year: ['year'],
};

/** Every string inside a value, engine names redacted; structure kept. */
export function redactDeep<T>(v: T): T {
  if (typeof v === 'string') return redactEngineTerms(v) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => redactDeep(x)) as unknown as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = redactDeep(x);
    return out as T;
  }
  return v;
}

export function clockView(c: ClockResolutionV2): SelfV2ClockView {
  return {
    system: c.primary,
    label: clockLabel(c.primary),
    reason: c.reason,
    reasonLine: CLOCK_REASON_LINES[c.reason],
    applicable: c.applicable.map((s) => ({ system: s, label: clockLabel(s), line: systemLine(s) })),
    notApplicable: c.notApplicable.map((n) => ({ system: n.system, label: clockLabel(n.system), reason: NOT_APPLICABLE_LINES[n.cause] })),
  };
}

function oracleAreaFor(latest: SelfV2Latest, id: SelfV2AreaId): OracleArea | null {
  const areas = (latest.oracle?.doc?.areas ?? {}) as Record<string, OracleArea | undefined>;
  for (const k of ORACLE_AREA_KEYS[id]) if (areas[k]) return areas[k]!;
  return null;
}

function areaStatus(latest: SelfV2Latest, card: PersonalCard | null): CardStatus {
  if (card) return 'ok';
  if (latest.status === 'pending') return 'pending';
  if (latest.status === 'failed') return 'failed';
  // a build landed and the Personalizer wrote no card for this area: withheld, never softened
  return 'withheld';
}

export function areaViews(latest: SelfV2Latest, floors: Partial<Record<SelfV2AreaId, string[]>> = {}): SelfV2AreaView[] {
  return SELF_V2_AREAS.map((a) => {
    const card = latest.cards?.cards?.[a.id] ?? null;
    const o = oracleAreaFor(latest, a.id);
    const details: SelfV2AreaView['details'] = o
      ? { headline: o.headline, paragraphs: [...o.paragraphs], evidence: [...o.evidence], certainty: o.certainty }
      : { evidence: [] };
    return {
      id: a.id,
      group: a.group,
      title: a.title,
      status: areaStatus(latest, card),
      card: card ? redactDeep(card) : null,
      floor: (floors[a.id] ?? []).map(redactEngineTerms),
      details: redactDeep(details),
    };
  });
}

export interface BuildResponseInput {
  status: SelfV2Status;
  latest: SelfV2Latest;
  clock: ClockResolutionV2;
  profile: Pick<ProfilePack, 'ageBand' | 'gender' | 'facts' | 'declined'>;
  floors?: Partial<Record<SelfV2AreaId, string[]>>;
  factKeys?: readonly string[];
}

export function buildSelfV2Response(i: BuildResponseInput): SelfV2Response {
  const missing = missingFacts(i.profile, i.factKeys);
  const stored = i.latest.cards?.hero ?? null;
  const hero: HeroDoc | null = stored ? redactDeep({ ...stored, question: pickHeroQuestion(stored, missing) }) : null;
  return {
    status: i.status,
    builtAt: i.latest.builtAt,
    nextCheck: hero?.nextCheck ?? null,
    clock: clockView(i.clock),
    hero,
    areas: areaViews(i.latest, i.floors),
    profile: { ageBand: i.profile.ageBand, hasGender: i.profile.gender !== null, missing },
  };
}

/** The body for a person with no chart yet. */
export function noKundliResponse(): SelfV2Response {
  return {
    status: 'no_kundli',
    builtAt: null,
    nextCheck: null,
    clock: { system: '', label: '', reason: '', reasonLine: '', applicable: [], notApplicable: [] },
    hero: null,
    areas: [],
    profile: { ageBand: null, hasGender: false, missing: [] },
  };
}
