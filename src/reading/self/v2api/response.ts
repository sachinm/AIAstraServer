/**
 * The GET /api/self/v2 body from what is stored (docs/reading-engine/66 §4.5). Pure: the route reads the store, the clock
 * and the profile, and this maps them. Card and hero words come from the Personalizer as stored; "Chart details" carry
 * the Oracle's own text. Every string that reaches the person passes `redactEngineTerms` (SOUL.md §1).
 */
import type { OracleArea } from '../areaDoc.js';
import type { ClockResolutionV2 } from '../clock.js';
import { clockLabel, redactEngineTerms } from '../words.js';
import { LIVE_AREAS } from '../v2/personalizerValidate.js';
import {
  SELF_V2_AREAS,
  SELF_V2_REFRESH,
  type AreaHorizon,
  type CardStatus,
  type PeriodSpan,
  type SelfV2Frame,
  type HeroDoc,
  type PersonalCard,
  type ProfilePack,
  type SelfV2AreaId,
  type SelfV2AreaView,
  type SelfV2ClockView,
  type SelfV2RefreshView,
  type SelfV2Response,
  type SelfV2Status,
} from '../v2types.js';
import { missingFacts, pickHeroQuestion } from './question.js';
import type { SelfV2Latest } from './storeContract.js';
import { NO_BUILD, type SelfV2BuildView } from '../v2/progress.js';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2027-01-01' → '1 Jan 2027' (calendar words only); the input as given when it is not a date */
export function dayLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : iso;
}

/** the horizon each area speaks to when no brief is stored (the catalogue's self.v2.<area> rows) */
const DEFAULT_HORIZON: Readonly<Record<SelfV2AreaId, AreaHorizon>> = {
  now: 'six_months_each_way',
  stuck: 'live_plus_standing',
  chapter: 'sub_period',
  diagnosis: 'sub_period',
  lagna: 'always',
  mind: 'always_plus_live',
  body: 'live_plus_standing',
  drive: 'always_plus_live',
  presence: 'always_plus_live',
  yogas: 'always',
  chapters: 'chapter',
  year: 'twelve_months',
};

/**
 * How long an area's reading holds, from what the build stored (no derivation): a standing area ('always' horizon)
 * always holds; `year` holds for the stored year span; any other area holds until the end of the shortest clock period
 * among its refresh triggers (SELF_V2_REFRESH: sub-sub, then sub, then main period). Null when the frame lacks it.
 */
export function areaRange(id: SelfV2AreaId, horizon: AreaHorizon, frame: SelfV2Frame | null | undefined): { range: SelfV2AreaView['range']; rangeLabel: string } {
  if (horizon === 'always') return { range: 'always', rangeLabel: 'Always' };
  if (!frame) return { range: null, rangeLabel: '' };
  if (id === 'year') {
    const y = frame.year;
    return y && !y.noCoverage ? { range: { from: y.from, to: y.to }, rangeLabel: `This year: ${dayLabel(y.from)} – ${dayLabel(y.to)}` } : { range: null, rangeLabel: '' };
  }
  const p = frame.periods;
  const triggers = SELF_V2_REFRESH[id];
  const pick: Array<[boolean, PeriodSpan | null | undefined]> = [
    [triggers.includes('sub_sub_period'), p?.runningSubSub],
    [triggers.includes('sub_period'), p?.runningSub],
    [triggers.includes('main_period'), p?.running],
  ];
  const span = pick.find(([on, s]) => on && s)?.[1] ?? null;
  return span ? { range: { from: span.from, to: span.to }, rangeLabel: `True until ${dayLabel(span.to)}` } : { range: null, rangeLabel: '' };
}

export function areaViews(latest: SelfV2Latest, floors: Partial<Record<SelfV2AreaId, string[]>> = {}): SelfV2AreaView[] {
  const horizons = new Map((latest.briefs ?? []).map((b) => [b.areaId, b.horizon]));
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
      // Floor lines stay empty on the v2 board: they are the legacy panels' code lines, and reading them means running
      // the legacy board (getBoardReading) on every GET or storing its panels per build. The v2 build stores neither, so
      // `floors` is wired only when a caller passes it (SelfV2Deps.floors); docs/TODOS.md keeps the item open.
      floor: (floors[a.id] ?? []).map(redactEngineTerms),
      ...areaRange(a.id, horizons.get(a.id) ?? DEFAULT_HORIZON[a.id], latest.frame),
      details: redactDeep(details),
    };
  });
}

/**
 * The areas whose cards ground the hero, for "Why we think so": the area of the hero question's claim (claim ids are
 * `<area>.<tag>`), then the live areas the hero's verdict is drawn from (LIVE_AREAS) that have a card, in board order.
 * The hero stores no per-sentence sources, so this is read from what it does store.
 */
export function heroSupporting(hero: HeroDoc, cards: Partial<Record<SelfV2AreaId, PersonalCard>> | undefined): SelfV2AreaId[] {
  const ids = new Set<SelfV2AreaId>();
  const claimArea = hero.question?.claimId.replace(/^claim:/, '').split('.')[0];
  const known = SELF_V2_AREAS.map((a) => a.id) as string[];
  if (claimArea && known.includes(claimArea) && claimArea !== 'now') ids.add(claimArea as SelfV2AreaId);
  for (const id of LIVE_AREAS) if (cards?.[id]) ids.add(id);
  return SELF_V2_AREAS.map((a) => a.id).filter((id) => ids.has(id));
}

export interface BuildResponseInput {
  status: SelfV2Status;
  latest: SelfV2Latest;
  clock: ClockResolutionV2;
  profile: Pick<ProfilePack, 'ageBand' | 'gender' | 'facts' | 'declined'> & Partial<Pick<ProfilePack, 'role'>>;
  floors?: Partial<Record<SelfV2AreaId, string[]>>;
  factKeys?: readonly string[];
  /** the board's refresh dates (selfBoardDates); absent: nothing made yet */
  refresh?: SelfV2RefreshView | null;
  /** today's build progress (docs/loading-overlay/05); absent: no build */
  build?: SelfV2BuildView | null;
}

export const NO_REFRESH: Readonly<SelfV2RefreshView> = Object.freeze({ madeAt: null, validUntil: null, due: false, building: false, failed: false });

export function buildSelfV2Response(i: BuildResponseInput): SelfV2Response {
  const missing = missingFacts(i.profile, i.factKeys);
  const stored = i.latest.cards?.hero ?? null;
  const hero: SelfV2Response['hero'] = stored
    ? redactDeep({ ...stored, question: pickHeroQuestion(stored, missing), supporting: heroSupporting(stored, i.latest.cards?.cards) })
    : null;
  return {
    status: i.status,
    builtAt: i.latest.builtAt,
    nextCheck: hero?.nextCheck ?? null,
    clock: clockView(i.clock),
    hero,
    areas: areaViews(i.latest, i.floors),
    profile: { ageBand: i.profile.ageBand, hasGender: i.profile.gender !== null, missing, role: i.profile.role ?? 'public' },
    subChapterEnds: i.latest.frame?.periods?.runningSub?.to ?? null,
    refresh: i.refresh ? { ...NO_REFRESH, ...i.refresh } : { ...NO_REFRESH },
    build: i.build ? { ...i.build } : { ...NO_BUILD },
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
    profile: { ageBand: null, hasGender: false, missing: [], role: 'public' },
    subChapterEnds: null,
    refresh: { ...NO_REFRESH },
    build: { ...NO_BUILD },
  };
}
