/**
 * Self board v2 contracts (docs/reading-engine/66 §4.1–§4.8). Types first: every sub-technique, area brief and model
 * agent of the v2 build is declared here before any code uses it (AGENTS.md, "Board and technique machinery" rule 3).
 *
 * Layer 0 is the engine's stored rows (never computed here). Layer 1 is ten shared sub-techniques (`self.sub.*`) that run
 * once per build over one `SelfBuildContext`. Layer 2 is eleven area techniques, pure selections into `AreaBrief`.
 * Layer 3 is the model agents (family readers, Oracle, Personalizer), each with a typed input and output.
 *
 * Nothing in this file is astrological arithmetic; every planet, house, window, polarity and strength is an engine value
 * carried through by id.
 */
import type { OracleAreaDoc, AreaCertainty, AreaDate } from './areaDoc.js';

// ---------------------------------------------------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------------------------------------------------

/** the hero (`now`) plus the eleven v2 areas (doc 66 §3 item 1), in display order within their groups */
export type SelfV2AreaId =
  | 'now'
  | 'stuck'
  | 'chapter'
  | 'diagnosis'
  | 'lagna'
  | 'mind'
  | 'body'
  | 'drive'
  | 'presence'
  | 'yogas'
  | 'chapters'
  | 'year';

export type SelfV2Group = 'now' | 'you' | 'time';

export const SELF_V2_AREAS: ReadonlyArray<{ id: SelfV2AreaId; group: SelfV2Group; title: string; technique: string }> = [
  { id: 'now', group: 'now', title: 'Right now', technique: 'self.now' },
  { id: 'stuck', group: 'now', title: 'Where you get stuck', technique: 'self.stuck' },
  { id: 'chapter', group: 'now', title: 'This chapter', technique: 'self.chapter' },
  { id: 'diagnosis', group: 'you', title: 'In short', technique: 'self.diagnosis' },
  { id: 'lagna', group: 'you', title: 'Who you are', technique: 'self.lagna' },
  { id: 'mind', group: 'you', title: 'How you think', technique: 'self.mind' },
  { id: 'body', group: 'you', title: 'Body & energy', technique: 'self.body' },
  { id: 'drive', group: 'you', title: 'Drive & ambition', technique: 'self.drive' },
  { id: 'presence', group: 'you', title: 'How you come across', technique: 'self.presence' },
  { id: 'yogas', group: 'you', title: 'Gifts & knots', technique: 'self.yogas' },
  { id: 'chapters', group: 'time', title: 'Chapters', technique: 'self.chapters' },
  { id: 'year', group: 'time', title: 'This year', technique: 'self.year' },
];

/** what makes an area's output stale (doc 66 mockup §5); the store key carries the stamp of each */
export type RefreshTrigger = 'digest' | 'main_period' | 'sub_period' | 'sub_sub_period' | 'sky_week' | 'year' | 'profile' | 'confirm';

export const SELF_V2_REFRESH: Readonly<Record<SelfV2AreaId, readonly RefreshTrigger[]>> = {
  now: ['sub_sub_period', 'sky_week', 'confirm', 'digest'],
  stuck: ['sub_period', 'digest'],
  chapter: ['sub_period', 'digest'],
  diagnosis: ['sub_period', 'digest'],
  lagna: ['main_period', 'digest'],
  mind: ['main_period', 'digest'],
  body: ['sub_period', 'sky_week', 'digest'],
  drive: ['main_period', 'digest'],
  presence: ['main_period', 'sub_period', 'digest'],
  yogas: ['digest'],
  chapters: ['main_period', 'digest'],
  year: ['year', 'digest'],
};

/** the horizon an area may speak to (doc 66 §0: never day or week on this board) */
export type AreaHorizon = 'always' | 'always_plus_live' | 'live_plus_standing' | 'sub_period' | 'six_months_each_way' | 'chapter' | 'twelve_months';

// ---------------------------------------------------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------------------------------------------------

export type IsoDate = string; // YYYY-MM-DD
export interface DateSpan {
  from: IsoDate;
  to: IsoDate;
}

/** an engine row id, e.g. 'planet:D1.Ju', 'activation:dwisatpathi/2/Ve@2025-11-16', 'pressure:<rowId>' */
export type EvidenceKey = string;

/** people a matter is about, from the reviewed words table `SELF.people` (house → plain label); vocabulary, not derivation */
export type PeopleLabel =
  | 'partners_and_clients'
  | 'authority_and_boss'
  | 'rivals_and_creditors'
  | 'home_and_mother'
  | 'father_and_teachers'
  | 'siblings_and_peers'
  | 'friends_and_elder_siblings'
  | 'children'
  | 'family_of_origin'
  | 'self';

/** life matters, from the reviewed words table `SELF.matters` */
export type Matter =
  | 'self_and_body'
  | 'money_in_hand'
  | 'effort_and_courage'
  | 'home_and_peace'
  | 'ideas_and_children'
  | 'work_load_and_health'
  | 'partnership'
  | 'sudden_and_hidden'
  | 'luck_and_belief'
  | 'career_and_standing'
  | 'gains_and_network'
  | 'loss_rest_and_distance';

export type Polarity = 'presses' | 'mixed' | 'supports';
/** the engine's grade (avastha, shadbala, functional nature), 1 weak … 3 strong */
export type Strength = 1 | 2 | 3;

// ---------------------------------------------------------------------------------------------------------------------
// Layer 0: the engine's pressure inventory (doc 66 §4.3), stored as `kundli_pressure`
// ---------------------------------------------------------------------------------------------------------------------

export type PressureKind = 'dasha' | 'transit' | 'sade_sati' | 'return' | 'station';

export interface PressureRow {
  id: string;
  kind: PressureKind;
  /** dasha level, when kind = dasha */
  level?: 1 | 2 | 3;
  planet: string;
  system?: string;
  housesTouched: number[];
  matters: Matter[];
  polarity: Polarity;
  strength: Strength;
  from: IsoDate;
  to: IsoDate;
  evidence: EvidenceKey[];
}

export interface PressureBoundary {
  date: IsoDate;
  /** row ids that start or end on this date */
  starts: string[];
  ends: string[];
}

export interface PressureInventory {
  kundliId: string;
  clock: string;
  from: IsoDate;
  to: IsoDate;
  rows: PressureRow[];
  boundaries: PressureBoundary[];
  /** engine version of the export, part of every downstream store key */
  calcVersion: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// Layer 1: the ten shared sub-techniques (doc 66 §4.8), technique ids `self.sub.<name>`
// ---------------------------------------------------------------------------------------------------------------------

export type SubTechniqueId =
  | 'self.sub.clock'
  | 'self.sub.periods'
  | 'self.sub.windows'
  | 'self.sub.promise'
  | 'self.sub.risk'
  | 'self.sub.mindFacts'
  | 'self.sub.bodyFacts'
  | 'self.sub.presenceFacts'
  | 'self.sub.year'
  | 'self.sub.profile';

/** S1 */
export interface ClockResolution {
  primary: string;
  reason: 'preferred' | 'conditional_applies' | 'default';
  confirming: string[];
  applicable: string[];
  notApplicable: Array<{ system: string; reason: string }>;
}

export interface PeriodSpan extends DateSpan {
  level: 1 | 2 | 3;
  lord: string;
  evidence: EvidenceKey;
}

/** S2 */
export interface PeriodFrame {
  system: string;
  previous: PeriodSpan | null;
  running: PeriodSpan;
  next: PeriodSpan | null;
  runningSub: PeriodSpan | null;
  runningSubSub: PeriodSpan | null;
  /** the engine charter's relation of the sub lord to the main lord (e.g. '2/12', '6/8', 'kendra'), when stored */
  subRelation: string | null;
  boundaries: Array<{ date: IsoDate; level: 1 | 2 | 3 }>;
}

export interface WindowRef {
  rowId: string;
  matters: Matter[];
  polarity: Polarity;
  strength: Strength;
  from: IsoDate;
  to: IsoDate;
}

/** S3: selections over `PressureInventory` (or activation + sky overlay until the export lands) */
export interface WindowSet {
  asOf: IsoDate;
  /** six months each way, for the hero strip */
  strip: WindowRef[];
  heaviestNow: WindowRef | null;
  easesAt: IsoDate | null;
  nextSupportFrom: IsoDate | null;
  startedLast12m: WindowRef[];
  endingNext6m: WindowRef[];
  byMatter: Partial<Record<Matter, WindowRef[]>>;
  /** true when built from activation and overlay only: "since" is said only for boundaries it has */
  degraded: boolean;
}

export type PromiseKind = 'gift' | 'knot' | 'grace';

export interface PromiseEntry {
  id: string;
  matter: Matter;
  kind: PromiseKind;
  source: { yogaId?: string; planet?: string; house?: number };
  who: PeopleLabel[];
  strength: Strength;
  /** for a grace: the knot it cancels or softens */
  cancels?: string;
  evidence: EvidenceKey[];
}

/** S4 */
export interface PromiseLedger {
  entries: PromiseEntry[];
}

export interface RiskRow {
  id: string;
  matter: Matter;
  /** what the chart says can go wrong, as a words-table key (not prose) */
  what: string;
  from: { planet?: string; house?: number; yogaId?: string; windowId?: string };
  who: PeopleLabel[];
  since: IsoDate | null;
  until: IsoDate | null;
  polarity: Polarity;
  strength: Strength;
  /** PromiseEntry ids of graces that limit it */
  holds: string[];
  evidence: EvidenceKey[];
}

/** S5: what could go wrong, from where, from who, when, and what holds it */
export interface RiskLedger {
  rows: RiskRow[];
  /** row ids, the three heaviest live rows by the engine's strength, then the soonest `until` */
  top3: string[];
}

/** S6: facts only; the Oracle names the pattern */
export interface MindFacts {
  feeling: EvidenceKey[];
  thinking: EvidenceKey[];
  peace: EvidenceKey[];
  judgement: EvidenceKey[];
  candidatePatterns: Array<{ placement: string; evidence: EvidenceKey[] }>;
}

/** S7 */
export interface BodyFacts {
  footing: EvidenceKey[];
  wear: EvidenceKey[];
  shape: EvidenceKey[];
  liveLords: Array<{ lord: string; houses: number[]; until: IsoDate; evidence: EvidenceKey }>;
  liveTransits: WindowRef[];
  /** the engine's sensitive-passage flag; never computed in Node */
  sensitive: boolean;
}

/** S8: How you come across (doc 66 §4.3) */
export interface PresenceFacts {
  bearing: EvidenceKey[];
  style: EvidenceKey[];
  adornment: EvidenceKey[];
  face: EvidenceKey[];
  publicVsPrivate: EvidenceKey[];
  /** a past period of Venus or the lagna lord the Oracle may name as "when you looked your best" */
  bestWindow: (DateSpan & { evidence: EvidenceKey }) | null;
  liveCare: { lord: string; until: IsoDate; evidence: EvidenceKey } | null;
}

/** S9 */
export interface YearFrame extends DateSpan {
  yearLagna: EvidenceKey | null;
  yearLord: EvidenceKey | null;
  shortClock: PeriodSpan | null;
  /** no annual row covers today: the live year line is withheld */
  noCoverage: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// S10: the person profile pack (doc 66 §4.2). Calendar arithmetic over facts the person typed; nothing astrological.
// ---------------------------------------------------------------------------------------------------------------------

export type AgeBand = 'under_25' | '25_35' | '36_45' | '46_60' | '60_plus';
export type StatedGender = 'woman' | 'man';
/** reading register: the plain card for the public; Chart details open by default for practitioners */
export type ReaderRole = 'public' | 'practitioner';
export type Mood = 'heavy' | 'mixed' | 'fine';

export interface ProfileFacts {
  work?: { status?: string; level?: string };
  love?: string;
  children?: string;
  focus?: string[];
  place?: string;
}

export interface ConfirmRecord {
  claimId: string;
  answer: 'yes' | 'partly' | 'no' | 'skip';
  at: string | null;
}

export interface ProfilePack {
  /** null when the birth date is missing or invalid */
  ageBand: AgeBand | null;
  /** whole years; kept server side, the prompt gets the band only */
  ageYears: number | null;
  /** null = not stated or "prefer not to say": neutral second person, no gendered words */
  gender: StatedGender | null;
  role: ReaderRole;
  facts: ProfileFacts;
  /** fact keys the person declined ("rather not say"): never mentioned, never asked again while fresh */
  declined: string[];
  lastConfirms: ConfirmRecord[];
  mood: Mood | null;
  /** stable hash of everything above that can change the Personalizer's output; part of its store key */
  hash: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// The build context: one per build, every sub-technique writes its slot once
// ---------------------------------------------------------------------------------------------------------------------

export interface SelfBuildStamps {
  digestVersion: string;
  clock: string;
  mainPeriod: string | null;
  subPeriod: string | null;
  subSubPeriod: string | null;
  skyWeek: string | null;
  year: string | null;
  profileHash: string | null;
  confirmHash: string | null;
}

export interface SelfSubOutputs {
  clock: ClockResolution;
  periods: PeriodFrame;
  windows: WindowSet;
  promise: PromiseLedger;
  risk: RiskLedger;
  mind: MindFacts;
  body: BodyFacts;
  presence: PresenceFacts;
  year: YearFrame;
  profile: ProfilePack;
}

export interface SelfBuildContext {
  userId: string;
  kundliId: string;
  asOf: IsoDate;
  stamps: SelfBuildStamps;
  /** filled once each, in the order of doc 66 §4.8 step 1 */
  sub: Partial<SelfSubOutputs>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Layer 2: area briefs
// ---------------------------------------------------------------------------------------------------------------------

export interface BriefClaim {
  id: string;
  /** a words-table key or a short fact tag, never prose for the person */
  fact: string;
  evidence: EvidenceKey[];
  range: DateSpan | 'always';
}

export interface AreaBrief {
  areaId: SelfV2AreaId;
  horizon: AreaHorizon;
  claims: BriefClaim[];
  dates: AreaDate[];
  /** RiskRow ids from S5 */
  ledgerRows: string[];
  /** PromiseEntry ids from S4 */
  promiseEntries: string[];
  /** the stamps this brief was built under; the area's store key */
  refreshStamp: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// Layer 3: model agents
// ---------------------------------------------------------------------------------------------------------------------

export type SelfV2AgentId = 'family.rasi' | 'family.varga' | 'family.dasha' | 'family.year' | 'family.sky' | 'self.oracle' | 'self.personalizer';

/** a slice handed to an agent: the stable prefix (cached) and the variable suffix */
export interface AgentSlice {
  agent: SelfV2AgentId;
  /** stable per digest version (Oracle) or per Oracle key (Personalizer); ≥ 1,024 tokens so the provider caches it */
  prefix: string;
  suffix: string;
  prefixHash: string;
  cacheOwner: { userId: string; kundliId: string };
}

export interface OracleInput {
  clock: ClockResolution;
  periods: PeriodFrame;
  windows: Pick<WindowSet, 'asOf' | 'heaviestNow' | 'easesAt' | 'nextSupportFrom' | 'startedLast12m' | 'endingNext6m'>;
  /** the twelve heaviest rows */
  risk: RiskRow[];
  /** the eight strongest entries */
  promise: PromiseEntry[];
  mind: MindFacts;
  body: BodyFacts;
  presence: PresenceFacts;
  year: YearFrame;
  areaBriefs: AreaBrief[];
  familyFindings: Array<{ family: string; text: string }>;
  confirms: ConfirmRecord[];
}

export interface OraclePattern {
  areaId: 'mind' | 'stuck';
  behaviour: string;
  mechanism: string;
  since: IsoDate | null;
  until: IsoDate | null;
  evidence: EvidenceKey[];
}

export interface OracleV2Output {
  doc: OracleAreaDoc;
  patterns: OraclePattern[];
}

export interface PersonalizerInput {
  oracle: OracleV2Output;
  profile: Omit<ProfilePack, 'ageYears' | 'hash'>;
  windows: Pick<WindowSet, 'asOf' | 'heaviestNow' | 'easesAt' | 'nextSupportFrom'>;
}

export type Tone = 'demanding' | 'heavy' | 'mixed' | 'easing' | 'steady' | 'open';

export interface LadderSteps {
  best: string;
  practical: string;
  drift: string;
  floor: string;
}

export interface PersonalPattern {
  text: string;
  kind: 'risk' | 'watch' | 'strength';
  since: IsoDate | null;
  until: IsoDate | null;
  /** the Oracle paragraph id ('<area>.p<n>') or evidence key the sentence rests on */
  source: string;
}

export interface PersonalCard {
  areaId: SelfV2AreaId;
  /** ≤ 14 words, second person, names a life area and, on live cards, a date */
  headline: string;
  /** two or three short paragraphs, ≤ 120 words in all */
  body: string[];
  patterns: PersonalPattern[];
  ladder: LadderSteps | null;
  /** copied from the Oracle; the validator rejects any date not in the Oracle document */
  dates: AreaDate[];
  certainty: AreaCertainty;
  /** per sentence of headline + body, the Oracle paragraph id or evidence key it rests on */
  sources: string[];
}

export interface HeroDoc {
  tone: Tone;
  /** one sentence: the life area and the date it changes */
  sentence: string;
  sub: string;
  strip: WindowRef[];
  easesAt: IsoDate | null;
  nextCheck: IsoDate | null;
  question: { claimId: string; text: string } | null;
  /** a split verdict is withheld, never shown */
  withheld: boolean;
}

export interface PersonalCardDoc {
  hero: HeroDoc;
  cards: Partial<Record<SelfV2AreaId, PersonalCard>>;
}

export type CardStatus = 'ok' | 'pending' | 'withheld' | 'failed';

// ---------------------------------------------------------------------------------------------------------------------
// 1b additions (step 1b, branch feat/self-v2-subtechniques): the window rows S3 keeps beside its `WindowSet` selections,
// so S5 and S7 can join on the planet and houses the engine stated without reading the database again.
// ---------------------------------------------------------------------------------------------------------------------

/** one dated window as S3 read it: an activation row of the primary clock or a stored sky overlay row */
export interface WindowRow extends WindowRef {
  kind: PressureKind;
  /** the period lord or the transiting planet as the engine wrote it; null for a rasi period */
  planet: string | null;
  /** dasha level, when kind = dasha */
  level?: 1 | 2 | 3;
  /** D1 houses as stored (activation `houses`, overlay `house_from_lagna`) */
  houses: number[];
  /** overlay `house_from_moon`, when stored */
  houseFromMoon: number | null;
  /** false when the stored row starts or ends outside the stored range: "since" / "until" is not said */
  sinceKnown: boolean;
  untilKnown: boolean;
  evidence: EvidenceKey[];
}

/** S3 output with its rows (assignable to `WindowSet`) */
export interface WindowSetDetail extends WindowSet {
  rows: WindowRow[];
}

// ---------------------------------------------------------------------------------------------------------------------
// API additions (step 5): GET /api/self/v2 (docs/reading-engine/66 §4.5). The web mirrors this type exactly.
// ---------------------------------------------------------------------------------------------------------------------

export type SelfV2Status = 'ok' | 'pending' | 'preparing' | 'no_kundli';

export interface SelfV2ClockView {
  /** the clock the board is read on */
  system: string;
  label: string;
  /** ClockResolution['reason'] */
  reason: string;
  /** one plain line saying why this clock */
  reasonLine: string;
  /** the clocks the person may switch to: the ones that apply plus the configured confirming clocks */
  applicable: Array<{ system: string; label: string; line: string }>;
  /** conditional clocks the engine says do not apply (or did not check): greyed, unselectable, with the reason */
  notApplicable: Array<{ system: string; label: string; reason: string }>;
}

export interface SelfV2AreaView {
  id: SelfV2AreaId;
  group: SelfV2Group;
  title: string;
  status: CardStatus;
  card: PersonalCard | null;
  /** the code lines of the matching legacy panel, when available */
  floor: string[];
  /** "Chart details": the Oracle's own text for this area, engine names redacted */
  details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: string };
}

export interface SelfV2Response {
  status: SelfV2Status;
  builtAt: string | null;
  nextCheck: string | null;
  clock: SelfV2ClockView;
  hero: HeroDoc | null;
  areas: SelfV2AreaView[];
  profile: { ageBand: AgeBand | null; hasGender: boolean; missing: string[] };
  usage?: unknown;
}
