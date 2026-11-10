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
import type { OracleArea, OracleAreaDoc, AreaCertainty, AreaDate } from './areaDoc.js';

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
  { id: 'now', group: 'now', title: 'Right now', technique: 'self.v2.now' },
  { id: 'stuck', group: 'now', title: 'Where you get stuck', technique: 'self.v2.stuck' },
  { id: 'chapter', group: 'now', title: 'This chapter', technique: 'self.v2.chapter' },
  { id: 'diagnosis', group: 'you', title: 'In short', technique: 'self.v2.diagnosis' },
  { id: 'lagna', group: 'you', title: 'Who you are', technique: 'self.v2.lagna' },
  { id: 'mind', group: 'you', title: 'How you think', technique: 'self.v2.mind' },
  { id: 'body', group: 'you', title: 'Body & energy', technique: 'self.v2.body' },
  { id: 'drive', group: 'you', title: 'Drive & ambition', technique: 'self.v2.drive' },
  { id: 'presence', group: 'you', title: 'How you come across', technique: 'self.v2.presence' },
  { id: 'yogas', group: 'you', title: 'Gifts & knots', technique: 'self.v2.yogas' },
  { id: 'chapters', group: 'time', title: 'Chapters', technique: 'self.v2.chapters' },
  { id: 'year', group: 'time', title: 'This year', technique: 'self.v2.year' },
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

/** `annual`: the TP year window and its level-2 year periods (engine calc_version 2); `return`: Saturn and Jupiter returns */
export type PressureKind = 'dasha' | 'transit' | 'sade_sati' | 'return' | 'station' | 'annual';

export interface PressureRow {
  id: string;
  kind: PressureKind;
  /** dasha level, when kind = dasha; 1 (the year) or 2 (a year period) when kind = annual */
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
  /** `chart: 'year'` when the row comes from the engine's annual (Tithi Pravesha year) pressure row */
  from: { planet?: string; house?: number; yogaId?: string; windowId?: string; chart?: 'year' };
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
/**
 * S9: the year read from the Tithi Pravesha chart whose return moment has passed (doc 66 §4.10). `from`/`to` are the TP
 * year (tp_start → tp_end); `shortClock` is the TP year dasha period, only when the engine bounds it to the year;
 * `confirmClock` is the Varshaphala Mudda period, which only confirms. Never a Varsha year in place of the TP year.
 */
export interface YearFrame extends DateSpan {
  yearLagna: EvidenceKey | null;
  yearLord: EvidenceKey | null;
  shortClock: PeriodSpan | null;
  /** no Tithi Pravesha year covers today: the live year line is withheld */
  noCoverage: boolean;
  /** the exact return moments ('YYYY-MM-DD HH:MM:SS', local) when stored */
  tpStart?: string | null;
  tpEnd?: string | null;
  /** the Varshaphala Mudda period covering asOf: a confirming clock, never the year */
  confirmClock?: PeriodSpan | null;
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

/**
 * The Oracle's work order for one area (docs call it an "area work order"; the type keeps its name): per area, the
 * facts (claims), the evidence keys, the dates and the ledger rows (S5 risk rows, S4 promise entries) the Oracle reads
 * for that area, chosen in code from the sub-techniques. It also scopes the Oracle validator: the brief's claim ids
 * (`claim:<id>`) and keys are among the allowed evidence keys, and its dates are among the stored spans a date may name.
 */
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

/** `stale` (2026-11-09, Oracle failures): the Oracle failed this area this build; the last good reading's card stands in */
export type CardStatus = 'ok' | 'pending' | 'withheld' | 'failed' | 'stale';

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
  /**
   * How long this area's reading holds (final integration): the span of the shortest clock period that can make it
   * stale (SELF_V2_REFRESH), the year span for `year`, 'always' for a standing area; null when the build stored no frame.
   */
  range?: { from: string; to: string } | 'always' | null;
  /** the range in words: "True until 1 Jan 2027", "Always", "This year: 9 Sep 2026 – 9 Sep 2027"; '' when unknown */
  rangeLabel?: string;
  /** "Chart details": the Oracle's own text for this area, engine names redacted */
  details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: string };
}

export interface SelfV2Response {
  status: SelfV2Status;
  builtAt: string | null;
  nextCheck: string | null;
  clock: SelfV2ClockView;
  /** the stored hero; `supporting` (final integration) names the areas whose cards ground it, for "Why we think so" */
  hero: (HeroDoc & { supporting?: SelfV2AreaId[] }) | null;
  areas: SelfV2AreaView[];
  /** `role` (final integration): practitioners see evidence keys under Chart details */
  profile: { ageBand: AgeBand | null; hasGender: boolean; missing: string[]; role?: ReaderRole };
  /** the running sub period's end date (S2 `runningSub.to`), for "Sub-chapter ends"; null when not known */
  subChapterEnds?: string | null;
  usage?: unknown;
  /**
   * The fresh-reading control (docs/billing/03): when the board's reading was made, its last good day and whether the
   * person may ask for a fresh one. The same rule as GET /api/area/self and POST /api/boards/self/refresh
   * (`selfBoardDates`), so v1 and v2 agree. All null and `due: false` when no reading has been made yet.
   */
  refresh: SelfV2RefreshView;
}

/** GET /api/self/v2 `refresh` (appended 2026-11-09 for the Get a fresh reading button). */
export interface SelfV2RefreshView {
  madeAt: string | null;
  validUntil: string | null;
  due: boolean;
  /**
   * Appended 2026-11-09 (fix/self-v2-single-build), from today's You build marker: a build is running now (`building`),
   * or today's last build failed (`failed`; a fresh reading's question was given back). The page stops polling on
   * `failed` and offers Try again. Both false when no build ran today.
   */
  building: boolean;
  failed: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// 1c additions (doc 66 §4.8 Layer 3: slices, warm-up, Oracle ×3, Personalizer, build order). Appended; nothing above
// changes.
// ---------------------------------------------------------------------------------------------------------------------

/** the five family readers among the v2 agents */
export type SelfV2FamilyAgentId = Extract<SelfV2AgentId, `family.${string}`>;

/** an agent slice with what the warm-up and the call need: the model and the system prompt (part of the cache key) */
export interface PreparedAgentSlice extends AgentSlice {
  model: string;
  system: string;
  /** chars / 4, the estimate the Lab shows before a call */
  estTokens: { prefix: number; suffix: number };
  /** evidence keys the slice carries in `{braces}`; the validator's allowed set */
  keys: string[];
}

/** one warmed region (Gemini explicit cache); `name` null when caching is off or creation failed */
export interface WarmedRegion {
  agent: SelfV2AgentId;
  prefixHash: string;
  model: string;
  name: string | null;
  ms: number;
}

/** per agent call: wall time, tokens and cost (AGENTS.md machinery rule 6) */
export interface SelfV2AgentTiming {
  agent: SelfV2AgentId;
  /** 'oracle.a' | 'oracle.b' | 'oracle.c' for the three Oracle calls, else the agent id */
  call: string;
  status: 'ok' | 'cached' | 'failed' | 'skipped';
  ms: number;
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  costUsd: number;
}

export type SelfV2OracleStatus = 'ok' | 'partial' | 'failed' | 'budget_exceeded';

/** what the v2 Oracle step returns and stores (only `ok` is stored) */
export interface SelfV2OracleResult {
  status: SelfV2OracleStatus;
  output: OracleV2Output | null;
  /** staff-only validator reasons */
  gaps: string[];
  withheld: string[];
  promptName: 'oracle/self-areas-v2';
  promptHash: string;
  model: string;
  calls: SelfV2AgentTiming[];
  familyFindings: Array<{ family: string; text: string }>;
  spentUsd: number;
  cached: boolean;
}

/** the stored Personalizer output (`self.v2.cards`) */
export interface SelfV2CardsResult {
  status: 'ok' | 'failed' | 'budget_exceeded';
  doc: PersonalCardDoc | null;
  /** per area: ok, or withheld (the Oracle headline under redaction stands in) */
  cardStatus: Partial<Record<SelfV2AreaId, CardStatus>>;
  gaps: string[];
  promptHash: string;
  model: string;
  call: SelfV2AgentTiming | null;
  cached: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// Final integration additions (branch feat/self-v2-integrate). Appended; nothing above changes.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * What the API needs from the build context besides the cards: the stamps, the clock periods (S2) and the year frame
 * (S9), stored beside the cards so GET /api/self/v2 can say how long each area holds without re-running anything.
 */
export interface SelfV2Frame {
  asOf: IsoDate;
  stamps: SelfBuildStamps;
  periods: PeriodFrame | null;
  year: YearFrame | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// run 2 fixes (branch fix/self-v2-run2-findings; docs/reading-engine/66-replay-2026-11-09-self-v2-run2.md). Appended;
// nothing above changes. Interfaces below merge with the ones above (optional fields only).
// ---------------------------------------------------------------------------------------------------------------------

/** The hero question's claim as code read it (failure 6): its matters and people from the S5 row, and a plain draft. */
export interface HeroClaimFrame {
  claimId: string;
  matters: Matter[];
  who: PeopleLabel[];
  since: IsoDate | null;
  until: IsoDate | null;
  /** the question in plain words, built from the matter; the Personalizer may only rephrase it */
  draft: string;
}

/** The `now` brief as the Personalizer reads it (run 1 failure 14): the hero rests on these S3/S5 rows and dates. */
export interface NowBriefView {
  claims: Array<{ id: string; fact: string; range: DateSpan | 'always' }>;
  dates: AreaDate[];
  /** the brief's S5 ledger rows, words keys only (no planet, no house) */
  ledger: Array<{ id: string; matter: Matter; what: string; who: PeopleLabel[]; since: IsoDate | null; until: IsoDate | null; polarity: Polarity }>;
}

export interface PersonalizerInput {
  heroClaim?: HeroClaimFrame | null;
  now?: NowBriefView | null;
}

export interface SelfV2AgentTiming {
  /** false when the provider's usage carried no thought count (the 0 is "not reported", not "did not think") */
  thoughtTokensReported?: boolean;
}

/** Per build, never a reject: how much of each card repeats the Oracle's word sequences (failure 1). */
export interface PersonalizerMetrics {
  /** share of the card body's word trigrams found in its Oracle area (0–1) */
  oracleEcho: Partial<Record<SelfV2AreaId, number>>;
  echoMean: number;
  echoMax: number;
  echoMaxArea: SelfV2AreaId | null;
  /** cards over SELF_V2_ORACLE_ECHO_FLAG */
  flagged: SelfV2AreaId[];
}

export interface SelfV2CardsResult {
  metrics?: PersonalizerMetrics;
}

// ---------------------------------------------------------------------------------------------------------------------
// personalizer portrait (Sachin 2026-11-09: "send everything and more to the Personalizer"). Built in code from stored
// rows (src/reading/self/v2/portrait.ts); a block with no source is null and named in `gaps`, never invented. Never the
// name, the exact birth date or time, or coordinates.
// ---------------------------------------------------------------------------------------------------------------------

/** the life labels the portrait states (reviewed words table `LIFE_LABEL_MATTERS` in v2words.ts) */
export type LifeLabel = 'career' | 'love' | 'self' | 'home' | 'family' | 'business' | 'health' | 'fortune' | 'work' | 'gains' | 'sacrifices';

export type LifeState = 'presses' | 'mixed' | 'supports' | 'quiet';

export interface PersonPortrait {
  /** character: the Oracle's natal areas as paragraph ids, its patterns, and S6 mind keys */
  personality: { oracleParagraphs: string[]; patterns: string[]; mindKeys: { feeling: string[]; thinking: string[]; peace: string[]; judgement: string[] } } | null;
  /** what the person has told us, with dates: wizard facts, life events, monthly checks, confirm answers */
  biography: {
    facts: Array<{ key: string; value: string; at: IsoDate | null }>;
    lifeEvents: Array<{ category: string; date: IsoDate; precision: string }>;
    areaChecks: Array<{ area: string; month: string; answer: string }>;
    confirms: Array<{ claimId: string; answer: string; at: IsoDate | null }>;
  } | null;
  /** the last 30 days: confirm answers, mood taps, and the categories (never the text) of their questions */
  pastMonth: { confirms: Array<{ claimId: string; answer: string; at: IsoDate | null }>; moods: Array<{ mood: Mood; on: IsoDate }>; questionTopics: Record<string, number> } | null;
  mood: { today: Mood | null; trend: 'heavier' | 'lighter' | 'steady' | 'unknown'; taps30d: number } | null;
  health: { focus: boolean; footing: string[]; wear: string[]; shape: string[]; liveWindows: Array<{ from: IsoDate; to: IsoDate; polarity: Polarity }> } | null;
  /** each life label's current state from S3 windows (byMatter) and S5 rows; `source` says which */
  lifeNow: Array<{ label: LifeLabel; matters: Matter[]; state: LifeState; since: IsoDate | null; until: IsoDate | null; strength: Strength | null }>;
  lifeNowSource: 'windows_and_risk' | 'house_state';
  register: { hint: 'plain' | 'mixed' | 'technical'; why: string[]; workStatus: string | null; workLevel: string | null; role: ReaderRole };
  birthPlace: { city: string | null; region: string | null; country: string | null } | null;
  currentPlace: { city: string | null; country: string | null } | null;
  /** the blocks with no source, by name */
  gaps: string[];
}

export interface PersonalizerInput {
  portrait?: PersonPortrait | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Oracle validation outcomes (Sachin 2026-11-09: "if there's an error it should store that error and bubble it up").
// Appended; interfaces below merge with the ones above (optional fields only).
// ---------------------------------------------------------------------------------------------------------------------

/** what a validator check found (stored in `reading_validation_failures.check`) */
export type ValidationCheck =
  | 'unknown_evidence_key'
  | 'date_not_stored'
  | 'cap'
  | 'missing_area'
  | 'json_schema'
  | 'truncated'
  | 'budget'
  | 'call_failed'
  | 'withheld'
  | 'duplicate_paragraph'
  | 'duplicate_area'
  | 'not_a_panel'
  | 'valid_until'
  | 'pattern'
  // the Personalizer's checks
  | 'no_source'
  | 'chart_term'
  | 'engine_name'
  | 'internal_id'
  | 'medical'
  | 'diet_advice'
  | 'role_word'
  | 'stage_word'
  | 'gendered'
  | 'date'
  | 'question'
  | 'focus'
  | 'echo_flag'
  | 'headline_replaced'
  | 'tone'
  | 'not_an_area'
  | 'duplicate'
  | 'illustration'
  | 'other';

/** per Oracle area, after the one repair pass */
export type OracleAreaStatus = 'ok' | 'repaired' | 'failed';

/** one validator finding, staff-only (never the person's own words) */
export interface ValidationIssue {
  stage: 'oracle' | 'personalizer';
  /** the area id, 'hero', or null for the document as a whole */
  area: string | null;
  check: ValidationCheck;
  message: string;
  /** 'oracle.a' | 'oracle.b' | 'oracle.c' | 'oracle.repair' | 'self.personalizer' */
  callId: string | null;
  /** the first pass's finding on an area the repair pass then fixed carries 'repaired' */
  areaStatus?: OracleAreaStatus | 'ok';
}

/** the build's quality as the page and the Lab see it: ok and repaired Oracle areas serve; failed ones go stale or withheld */
export interface SelfV2Quality {
  okAreas: SelfV2AreaId[];
  repaired: SelfV2AreaId[];
  failed: SelfV2AreaId[];
}

/** an area the Oracle failed this build, shown from the last good stored reading */
export interface StaleArea {
  card: PersonalCard;
  /** that reading's Oracle area, for Chart details (null when it was not stored) */
  details: OracleArea | null;
  /** when the reading it comes from was stored */
  fromBuiltAt: string | null;
}

export interface SelfV2OracleResult {
  /** per expected area: ok, repaired by the one repair pass, or failed (absent on results stored before 2026-11-09) */
  areaStatus?: Partial<Record<SelfV2AreaId, OracleAreaStatus>>;
  /** every check the validator raised this build, structured (the `gaps` say the same in words) */
  issues?: ValidationIssue[];
  /** true when the repair call ran */
  repairRan?: boolean;
}

export interface SelfV2CardsResult {
  /** the Personalizer validator's drops, structured */
  issues?: ValidationIssue[];
  /** the Oracle's quality for this build */
  quality?: SelfV2Quality;
  /** failed Oracle areas shown from the last good reading */
  stale?: Partial<Record<SelfV2AreaId, StaleArea>>;
}

export interface SelfV2Response {
  /** the build's Oracle quality (null when no build is stored, or one stored before 2026-11-09) */
  quality?: SelfV2Quality | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// storyteller (Sachin 2026-11-09: "the Personalizer needs to be entertainer, the story-teller"). Appended; interfaces
// below merge with the ones above (optional fields only).
// ---------------------------------------------------------------------------------------------------------------------

/** one short real-life example, analogy or modern reference that makes one Oracle point land (≤ 40 words) */
export interface CardIllustration {
  text: string;
  kind: 'example' | 'analogy' | 'modern';
  /** the Oracle paragraph id (`<area>.p<n>`) the illustration makes land */
  illustrates: string;
}

export interface PersonalCard {
  illustration?: CardIllustration;
}

export interface HeroDoc {
  illustration?: CardIllustration;
}
