/**
 * Clarifier state machine (docs/reading-engine/13 §2). Pure functions: no I/O, no model.
 *
 *   CLASSIFIED ──(nothing missing, mode when_missing)──► READY (no interaction; read straight away)
 *        │
 *        └─(missing slot or ambiguous bucket)──► ASKING ⇄ answer ──► PROPOSED (exact query) ──► CONFIRMED
 *                                                    │                     └─ edit ──► PROPOSED
 *                                                    └─ cap of 2 questions reached ──► PROPOSED with stated defaults
 *   any non-final state ──(10 minutes without an answer)──► ABANDONED
 *
 * One criterion per turn, horizon first unless the life area itself is unclear, never re-ask a filled slot, at most
 * two questions, then proceed with the bucket's defaults and say what was assumed. Questions are chart-aware when a
 * headline card (running dasha period) is available. English only for now.
 */
import { extractHorizon, extractPerson, extractSubBucket, extractOtherPerson, normalize, questionKindOf, textOf, type ClassifierResult, type PersonRel, type Slots } from '../buckets/classifier.js';
import { BUCKETS, HORIZON_CHIPS, isBucketId, type BucketId, type SlotId } from '../buckets/taxonomy.js';
import { FRAMES, horizonRange, type Horizon } from '../packs/frames.js';
import { humanDate, siblingMention, type SiblingNoun, type SiblingRank } from '../nodes/intake.js';
import { normalizePlace, normalizeTimeZone, type UserLocation } from '../../services/userLocation.js';
import { detectTopic } from '../policy/declined.js';

export type ClarifyMode = 'always' | 'when_missing' | 'never';
export type ClarifyStatus = 'ASKING' | 'PROPOSED' | 'CONFIRMED' | 'READY' | 'ABANDONED';
/**
 * child_age is a safety check (file 18, topic child_age_unconfirmed), asked first and not counted in the cap.
 * sibling: which brother or sister (3rd house = younger, 11th = elder); counted in the cap.
 * location: where the person lives now, asked once per user for timing questions (a profile fact, not counted in the cap).
 */
export type Criterion = SlotId | 'bucket' | 'child_age' | 'sibling' | 'location';

/** Criteria outside the two-question cap. */
const UNCAPPED = new Set<Criterion>(['child_age', 'location']);

export const MAX_QUESTIONS = 2;
export const ABANDON_AFTER_MS = 10 * 60_000;

export interface Chip {
  label: string;
  /** machine value sent back by the client: a horizon id, "range:YYYY-MM-DD:YYYY-MM-DD", a bucket id, a sub-bucket id, a person … */
  value: string;
}

export interface Ask {
  criterion: Criterion;
  question: string;
  chips: Chip[];
  allowFreeText: boolean;
}

export interface ClarifyTurn {
  ask: Ask;
  answer?: { value: string; viaChip: boolean; resolved: boolean };
  at: number;
}

/** Facts the clarifier may quote to make its question chart-aware. */
export interface HeadlineCard {
  md?: string;
  ad?: string;
  pd?: string;
  adEnd?: string;
  nextAd?: string;
}

export interface ClarifyState {
  v: 1;
  status: ClarifyStatus;
  question: string;
  asOf: string;
  bucket: BucketId;
  subBucket: string | null;
  alsoBuckets: BucketId[];
  slots: Slots;
  turns: ClarifyTurn[];
  pending: Ask | null;
  assumed: Partial<Record<Criterion, string>>;
  exactQuery: string | null;
  card: HeadlineCard | null;
  /** set when the question cannot be answered as posed (policy template T10): no exact query is proposed */
  unanswerable: string | null;
  /** bucket the question started in (differs when the clarifier changed it) */
  originalBucket: BucketId;
  /** age of the person's child the question is about: confirmed adult, minor (declined), or not asked */
  childAge: 'adult' | 'minor' | null;
  /** the question names a brother or sister without saying which: the noun to ask about (optional: older stored states lack it) */
  siblingNoun?: SiblingNoun | null;
  /** the sibling chosen (or assumed) in this conversation */
  sibling?: { rank: SiblingRank; noun: SiblingNoun } | null;
  /** where the person lives now: the stored one, or the one answered in this conversation */
  location?: UserLocation | null;
  /** a timing question, no stored location and a working store: ask "Where are you living now?" once */
  needsLocation?: boolean;
  /** the location was answered in this conversation (the service stores it) */
  locationAnswered?: boolean;
  /** birth place from the profile, for the "Same as birth place" chip */
  birthPlace?: string | null;
  /** set on confirmation (doc 28 §5): may a prashna be cast for this question, and who decided */
  prashna?: PrashnaEligibility | null;
  /** when the person confirmed the question (ms): the prashna is cast for this moment */
  confirmedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export function clarifyMode(): ClarifyMode {
  const v = process.env.READING_CLARIFY_MODE?.trim().toLowerCase();
  return v === 'always' || v === 'never' ? v : 'when_missing';
}

const PLANET_NAMES: Record<string, string> = { Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu' };
const pname = (c?: string): string => (c ? PLANET_NAMES[c] ?? c : '');

/** Criteria the state still lacks, in the order they are asked. */
export function openCriteria(
  s: Pick<ClarifyState, 'bucket' | 'slots' | 'alsoBuckets'> & Partial<Pick<ClarifyState, 'siblingNoun' | 'sibling' | 'needsLocation' | 'location' | 'turns'>>,
  confidence: number,
  threshold: number,
): Criterion[] {
  const out: Criterion[] = [];
  if (s.bucket === 'unknown' || confidence < threshold || s.alsoBuckets.length >= 2) out.push('bucket');
  if (s.siblingNoun && !s.sibling) out.push('sibling');
  const required = BUCKETS[s.bucket].requiredSlots;
  for (const c of ['horizon', 'subject_person', 'sub_bucket', 'other_person'] as const) if (required.includes(c) && !s.slots[c]) out.push(c);
  // asked at most once per conversation, last, and only when the answer can be stored
  if (s.needsLocation && !s.location && !(s.turns ?? []).some((t) => t.ask.criterion === 'location')) out.push('location');
  return out;
}

// ---- questions (rules; ≤ 18 words; options first) -------------------------------------------------------

function horizonAsk(s: ClarifyState): Ask {
  const chips: Chip[] = HORIZON_CHIPS.map((c) => ({ label: c.label, value: String(c.horizon) }));
  const y = s.asOf.slice(0, 4);
  chips.splice(2, 0, { label: 'Rest of this year', value: `range:${s.asOf}:${y}-12-31` });
  let question = 'Which period should I look at?';
  if (s.card?.md && s.card.ad && s.card.adEnd) {
    question = `Your ${pname(s.card.md)}–${pname(s.card.ad)} period runs until ${humanDate(s.card.adEnd)}. Which period should I look at?`;
    chips.unshift({ label: `Until ${humanDate(s.card.adEnd)}`, value: `range:${s.asOf}:${s.card.adEnd}` });
  }
  return { criterion: 'horizon', question, chips: chips.slice(0, 5), allowFreeText: true };
}

function bucketAsk(s: ClarifyState): Ask {
  const candidates: BucketId[] = s.bucket === 'unknown' ? ['career_job', 'money_wealth', 'love_relationships', 'marriage', 'health_windows', 'time_window_outlook'] : [s.bucket, ...s.alsoBuckets];
  const chips = [...new Set(candidates)].slice(0, 5).map((b) => ({ label: BUCKETS[b].displayName, value: b }));
  const question = s.bucket === 'unknown' ? 'Which area of life is this about?' : 'Which should I read first?';
  return { criterion: 'bucket', question, chips, allowFreeText: true };
}

function subBucketAsk(s: ClarifyState): Ask {
  const b = BUCKETS[s.bucket];
  const chips = b.subBuckets.map((x) => ({ label: x.label, value: x.id }));
  const question = s.bucket === 'career_job' ? 'Is this about changing jobs, a promotion, finding work, trouble at work, or direction?' : `Which part of ${b.displayName.toLowerCase()} is this about?`;
  return { criterion: 'sub_bucket', question, chips, allowFreeText: true };
}

function personAsk(): Ask {
  const chips: Chip[] = [
    { label: 'Me', value: 'me' },
    { label: 'My partner', value: 'partner' },
    // children under 18 are not discussed (src/reading/policy/declined.ts, topic minors)
    { label: 'My adult child (18+)', value: 'child' },
    { label: 'My parent', value: 'parent' },
  ];
  return { criterion: 'subject_person', question: "Is this about your own chart or someone else's?", chips, allowFreeText: true };
}

function otherPersonAsk(): Ask {
  const chips: Chip[] = [
    { label: 'My partner', value: 'partner' },
    { label: 'A prospective match', value: 'partner' },
    { label: 'A family member', value: 'other' },
  ];
  return { criterion: 'other_person', question: 'Whose chart should I compare with yours? I will need their birth details.', chips, allowFreeText: true };
}

const REL_LABEL: Record<string, string> = { son: 'son', daughter: 'daughter', child: 'child' };

export function childAgeAsk(s: ClarifyState): Ask {
  const rel = REL_LABEL[s.slots.subject_person?.value ?? ''] ?? 'child';
  return {
    criterion: 'child_age',
    question: `Is your ${rel} 18 or older?`,
    chips: [
      { label: '18 or older', value: 'adult' },
      { label: 'Under 18', value: 'minor' },
    ],
    allowFreeText: true,
  };
}

/** "adult" / "minor" chips, or typed text with an age or yes/no. Anything unclear counts as not confirmed. */
export function parseChildAge(value: string): 'adult' | 'minor' {
  const v = value.trim().toLowerCase();
  if (v === 'adult') return 'adult';
  if (v === 'minor') return 'minor';
  const n = /\b(\d{1,3})\b/.exec(v);
  if (n) return Number(n[1]) >= 18 ? 'adult' : 'minor';
  if (/^(yes|yeah|yep|y|over eighteen|older)\b/.test(v)) return 'adult';
  return 'minor';
}

const plural = (n: SiblingNoun): string => (n === 'sibling' ? 'siblings' : `${n}s`);

/** "Which brother do you mean?" with Elder / Younger chips (both nouns when the question says "sibling"). */
export function siblingAsk(s: Pick<ClarifyState, 'siblingNoun'>): Ask {
  const noun = s.siblingNoun ?? 'sibling';
  const nouns: SiblingNoun[] = noun === 'sibling' ? ['brother', 'sister'] : [noun];
  const chips: Chip[] = nouns.flatMap((n) => [
    { label: `Elder ${n}`, value: `elder_${n}` },
    { label: `Younger ${n}`, value: `younger_${n}` },
  ]);
  chips.push({ label: `All my ${plural(noun)}`, value: 'all' });
  return { criterion: 'sibling', question: `Which ${noun} do you mean?`, chips, allowFreeText: true };
}

/** A chip value ("elder_brother", "all") or typed text ("the older one") -> rank and noun. */
export function parseSibling(value: string, noun: SiblingNoun): { rank: SiblingRank; noun: SiblingNoun } | null {
  const v = value.trim().toLowerCase().replace(/_/g, ' ');
  const n: SiblingNoun = /\bbrothers?\b/.test(v) && !/\bsisters?\b/.test(v) ? 'brother' : /\bsisters?\b/.test(v) && !/\bbrothers?\b/.test(v) ? 'sister' : noun;
  const elder = /\b(elder|older|eldest|oldest|big|bigger|senior)\b/.test(v);
  const younger = /\b(younger|youngest|little|small|baby|junior)\b/.test(v);
  if (/\b(all|both|every|each)\b/.test(v) || (elder && younger)) return { rank: 'all', noun };
  if (elder) return { rank: 'elder', noun: n };
  if (younger) return { rank: 'younger', noun: n };
  return null;
}

export function locationAsk(s: Pick<ClarifyState, 'birthPlace'>): Ask {
  const chips: Chip[] = s.birthPlace ? [{ label: 'Same as birth place', value: 'same_as_birth' }] : [];
  return { criterion: 'location', question: 'Where are you living now?', chips, allowFreeText: true };
}

const NOT_A_PLACE = /^(no|nope|none|skip|pass|not sure|unsure|don'?t know|dunno|n\/?a|prefer not( to say)?|rather not say)$/i;
const SAME_AS_BIRTH = /^(same( as)?( my)?( birth ?place| place of birth| where i was born)?|where i was born|same place|birth ?place)$/i;

export function askFor(c: Criterion, s: ClarifyState): Ask {
  switch (c) {
    case 'sibling':
      return siblingAsk(s);
    case 'location':
      return locationAsk(s);
    case 'child_age':
      return childAgeAsk(s);
    case 'horizon':
      return horizonAsk(s);
    case 'bucket':
      return bucketAsk(s);
    case 'sub_bucket':
      return subBucketAsk(s);
    case 'subject_person':
      return personAsk();
    case 'other_person':
      return otherPersonAsk();
    default:
      return { criterion: c, question: 'Anything specific you want me to look at?', chips: [], allowFreeText: true };
  }
}

// ---- prashna eligibility (doc 28 §5) -----------------------------------------------------------------------

/** `unsure` goes to the optional model planner (planner.ts judgePrashna); without one it counts as not eligible. */
export type PrashnaRule = 'eligible' | 'not_eligible' | 'unsure';

export interface PrashnaEligibility {
  /** the question is marked `prashna_eligible` */
  eligible: boolean;
  rule: PrashnaRule;
  source: 'rules' | 'model';
  /** short machine reason, for the run log */
  why: string;
}

const SPECULATION = / (lottery|lotto|jackpot|bet|bets|betting|gamble|gambling|casino|speculation|speculative|crypto|stocks?|shares) /;

const PRASHNA_PATTERNS: Array<[RegExp, string]> = [
  [/ should (i|we) /, 'should_i'],
  [/ (will|would|can|could|shall) (i|we|my|he|she|they|it|this|that|the|our) /, 'will_x'],
  [/ (is|are) (it|now|this|today) (a |the )?(good |right |bad |wise |auspicious |favourable |favorable |safe )?(time|moment|idea|day) /, 'is_it'],
  [/ (is|are) (now|today) /, 'now'],
  [/ (going|likely) to (happen|work|succeed|come) /, 'will_x'],
  [/ (do|does|did) (i|he|she|they|we) (get|have|stand|win|clear|pass) /, 'yes_no'],
];

/**
 * Rules first: a confirmed question is prashna-eligible when it is a yes/no, "should I", "will X happen" or "now"
 * question about a life area, and it is not a declined, role-gated or policy (unanswerable) question. Timing ("when"),
 * meaning ("why") and definition questions are not. Descriptive questions that only mention "now" are `unsure`.
 * Every declined topic, whatever the person's role, makes the question ineligible: no prashna is cast for it.
 */
export function prashnaRule(s: Pick<ClarifyState, 'question' | 'bucket' | 'unanswerable' | 'childAge'> & Partial<Pick<ClarifyState, 'subBucket'>>): PrashnaEligibility {
  const no = (why: string): PrashnaEligibility => ({ eligible: false, rule: 'not_eligible', source: 'rules', why });
  const q = s.question ?? '';
  const topic = detectTopic(q, undefined, s.childAge === 'adult' ? ['child_age_unconfirmed'] : []);
  if (topic) return no(`declined:${topic.id}`);
  if (s.unanswerable) return no(`policy:${s.unanswerable}`);
  if (s.bucket === 'unknown' || s.bucket === 'explain_term') return no('no_life_area');
  // a horary yes on a win would predict the win (method: gain windows only); health stays with the role-gated rules
  if (s.subBucket === 'windfall' || SPECULATION.test(` ${normalize(q)} `)) return no('speculation');
  if (s.bucket === 'health_windows') return no('health');
  const kind = questionKindOf(textOf(q));
  if (kind === 'timing' || kind === 'why_meaning' || kind === 'explain_term') return no(`kind:${kind}`);
  const p = ` ${normalize(q)} `;
  if (kind === 'yes_no') return { eligible: true, rule: 'eligible', source: 'rules', why: 'kind:yes_no' };
  // "what will my career look like" asks for a description, not a yes or no
  const wh = /^ (what|how|which|where|who|whom|whose) /.test(p);
  if (!wh) for (const [re, why] of PRASHNA_PATTERNS) if (re.test(p)) return { eligible: true, rule: 'eligible', source: 'rules', why };
  if (/ (now|right now|at this moment|this moment|today) /.test(p)) return { eligible: false, rule: 'unsure', source: 'rules', why: 'mentions_now' };
  if (kind === 'compare') return { eligible: false, rule: 'unsure', source: 'rules', why: 'kind:compare' };
  return no(`kind:${kind}`);
}

// ---- transitions -------------------------------------------------------------------------------------------

export interface StartOptions {
  mode: ClarifyMode;
  threshold: number;
  card?: HeadlineCard | null;
  now?: number;
  /** the question is about the person's own child with no stated age: confirm 18+ before anything else */
  needsChildAge?: boolean;
  /** the person's stored current location (carried into the intent) */
  location?: UserLocation | null;
  /** ask "Where are you living now?" (timing question, nothing stored, store working) */
  needsLocation?: boolean;
  birthPlace?: string | null;
}

/** CLASSIFIED -> READY | ASKING | PROPOSED. */
export function startClarify(question: string, asOf: string, c: ClassifierResult, opts: StartOptions): ClarifyState {
  const now = opts.now ?? Date.now();
  const s: ClarifyState = {
    v: 1,
    status: 'READY',
    question: question.trim(),
    asOf,
    bucket: c.bucket,
    subBucket: c.subBucket,
    alsoBuckets: c.alsoBuckets,
    slots: { ...c.slots },
    turns: [],
    pending: null,
    assumed: {},
    exactQuery: null,
    card: opts.card ?? null,
    unanswerable: c.unanswerable,
    originalBucket: c.bucket,
    childAge: null,
    siblingNoun: (() => {
      const m = siblingMention(question);
      return m?.ambiguous ? m.noun : null;
    })(),
    sibling: null,
    location: opts.location ?? null,
    needsLocation: !!opts.needsLocation && !opts.location,
    birthPlace: opts.birthPlace ?? null,
    createdAt: now,
    updatedAt: now,
  };
  // policy questions (death timing, lottery numbers, exact amounts …) are answered by the T10 policy template, not clarified
  if (opts.needsChildAge) {
    const ask = childAgeAsk(s);
    return { ...s, status: 'ASKING', pending: ask, turns: [{ ask, at: now }], updatedAt: now };
  }
  if (opts.mode === 'never' || (c.unanswerable && c.unanswerable !== 'no_subject')) return finalizeReady(s);
  const open = openCriteria(s, c.confidence, opts.threshold);
  if (open.length === 0) return opts.mode === 'always' ? propose(s, now) : finalizeReady(s);
  return askNext(s, open, now);
}

function askNext(s: ClarifyState, open: Criterion[], now: number): ClarifyState {
  const asked = s.turns.filter((t) => !UNCAPPED.has(t.ask.criterion)).length;
  const capped = open.filter((c) => !UNCAPPED.has(c));
  // uncapped criteria (the location) are asked once each, after the question's own criteria
  const uncapped = open.filter((c) => UNCAPPED.has(c) && !s.turns.some((t) => t.ask.criterion === c));
  let base = s;
  let next: Criterion | undefined;
  if (capped.length && asked < MAX_QUESTIONS) next = capped[0];
  else {
    if (capped.length) base = applyDefaults(s, capped);
    next = uncapped[0];
  }
  if (!next) return propose(applyDefaults(base, open), now);
  const ask = askFor(next, base);
  return { ...base, status: 'ASKING', pending: ask, turns: [...base.turns, { ask, at: now }], updatedAt: now };
}

/** Fill what is still open with the bucket's defaults and record each assumption (said back to the user). */
export function applyDefaults(s: ClarifyState, open: Criterion[]): ClarifyState {
  const slots: Slots = { ...s.slots };
  const assumed: ClarifyState['assumed'] = { ...s.assumed };
  for (const c of open) {
    if (c === 'horizon' && !slots.horizon) {
      const h = BUCKETS[s.bucket].defaultHorizon;
      slots.horizon = { value: h, text: 'default' };
      assumed.horizon = horizonLabel(h, s.asOf);
    }
    if (c === 'subject_person' && !slots.subject_person) {
      slots.subject_person = { value: 'me', text: 'default' };
      assumed.subject_person = 'your own chart';
    }
    if (c === 'sub_bucket' && !slots.sub_bucket) assumed.sub_bucket = `all of ${BUCKETS[s.bucket].displayName.toLowerCase()}`;
    if (c === 'bucket') assumed.bucket = BUCKETS[s.bucket].displayName;
  }
  let sibling = s.sibling ?? null;
  if (open.includes('sibling') && !sibling && s.siblingNoun) {
    sibling = { rank: 'all', noun: s.siblingNoun };
    assumed.sibling = `all your ${plural(s.siblingNoun)}`;
  }
  return { ...s, slots, assumed, sibling };
}

/** Resolve a chip value or free text for the pending criterion. Unresolved free text counts as a turn. */
export function absorbAnswer(s: ClarifyState, value: string, opts: { viaChip: boolean; threshold: number; now?: number; tz?: string | null }): ClarifyState {
  const now = opts.now ?? Date.now();
  if (s.status !== 'ASKING' || !s.pending) return s;
  const c = s.pending.criterion;
  if (c === 'child_age') {
    const age = parseChildAge(value);
    const turns = s.turns.map((t, i) => (i === s.turns.length - 1 ? { ...t, answer: { value: age, viaChip: opts.viaChip, resolved: true } } : t));
    // under 18 (or not confirmed): the conversation ends with the minors decline
    if (age === 'minor') return { ...s, turns, pending: null, childAge: 'minor', status: 'ABANDONED', updatedAt: now };
    const confirmed: ClarifyState = { ...s, turns, pending: null, childAge: 'adult' };
    const cls = { confidence: 0.99 };
    const open = openCriteria(confirmed, cls.confidence, opts.threshold);
    if (open.length === 0) return propose(confirmed, now);
    return askNext(confirmed, open, now);
  }
  const next: ClarifyState = { ...s, slots: { ...s.slots }, alsoBuckets: [...s.alsoBuckets] };
  const resolved = resolveValue(next, c, value, opts.viaChip, opts.tz ?? null);
  const turns = next.turns.map((t, i) => (i === next.turns.length - 1 ? { ...t, answer: { value: value.slice(0, 300), viaChip: opts.viaChip, resolved } } : t));
  next.turns = turns;
  next.pending = null;
  // free text may also have filled other slots ("next 6 months, about a promotion"); a place name is only a place
  if (!opts.viaChip && c !== 'location') absorbExtras(next, value);
  const confidence = c === 'bucket' && resolved ? 1 : 0.99;
  const open = openCriteria(next, confidence, opts.threshold).filter((x) => !(x === c && !resolved && x !== 'bucket') || true);
  // an unresolved answer does not get asked again; it is defaulted
  const remaining = resolved ? open.filter((x) => x !== c) : open.filter((x) => x !== c);
  if (!resolved) Object.assign(next, applyDefaults(next, [c]));
  return askNext(next, remaining, now);
}

function resolveValue(s: ClarifyState, c: Criterion, value: string, viaChip: boolean, tz: string | null = null): boolean {
  const v = value.trim();
  if (c === 'sibling') {
    const r = parseSibling(v, s.siblingNoun ?? 'sibling');
    if (!r) return false;
    s.sibling = r;
    return true;
  }
  if (c === 'location') {
    // stored as typed; no geocoding. The timezone is the browser's (Intl), when it sent one.
    if (NOT_A_PLACE.test(v)) return false;
    const same = v === 'same_as_birth' || SAME_AS_BIRTH.test(v);
    const place = same ? s.birthPlace ?? null : normalizePlace(v);
    if (!place) return false;
    s.location = { place, tz: normalizeTimeZone(tz) };
    s.locationAnswered = true;
    return true;
  }
  if (c === 'horizon') {
    const h = parseHorizonValue(v, s.asOf) ?? (viaChip ? null : extractHorizon(textOf(v), s.asOf)?.value ?? null);
    if (!h) return false;
    s.slots.horizon = { value: h, text: v };
    return true;
  }
  if (c === 'bucket') {
    let b: BucketId | null = isBucketId(v) ? v : null;
    if (!b) {
      const want = v.toLowerCase();
      b = (Object.values(BUCKETS).find((x) => x.displayName.toLowerCase() === want || x.displayName.toLowerCase().startsWith(want))?.id as BucketId | undefined) ?? null;
    }
    if (!b || b === 'unknown') return false;
    s.bucket = b;
    s.alsoBuckets = s.alsoBuckets.filter((x) => x !== b);
    s.subBucket = null;
    delete s.slots.sub_bucket;
    return true;
  }
  if (c === 'sub_bucket') {
    const sub = BUCKETS[s.bucket].subBuckets.find((x) => x.id === v || x.label.toLowerCase() === v.toLowerCase());
    const found = sub ? { value: sub.id, text: v } : extractSubBucket(textOf(v), s.bucket);
    if (!found) return false;
    s.slots.sub_bucket = found;
    s.subBucket = found.value;
    return true;
  }
  if (c === 'subject_person') {
    const rel = PERSON_VALUES.has(v as PersonRel) ? (v as PersonRel) : v.toLowerCase() === 'me' || /\b(me|myself|mine|my own)\b/i.test(v) ? 'me' : extractPerson(textOf(`for my ${v}`))?.value ?? null;
    if (!rel) return false;
    s.slots.subject_person = { value: rel, text: v };
    return true;
  }
  if (c === 'other_person') {
    const rel = PERSON_VALUES.has(v as PersonRel) ? (v as PersonRel) : extractOtherPerson(textOf(v))?.value ?? null;
    if (!rel) return false;
    s.slots.other_person = { value: rel, text: v };
    return true;
  }
  return false;
}

const PERSON_VALUES = new Set<PersonRel>(['me', 'partner', 'spouse', 'child', 'son', 'daughter', 'mother', 'father', 'parent', 'brother', 'sister', 'sibling', 'friend', 'other']);

function absorbExtras(s: ClarifyState, text: string): void {
  const t = textOf(text);
  if (!s.slots.horizon) {
    const h = extractHorizon(t, s.asOf);
    if (h) s.slots.horizon = h;
  }
  if (!s.slots.sub_bucket) {
    const sub = extractSubBucket(t, s.bucket);
    if (sub) {
      s.slots.sub_bucket = sub;
      s.subBucket = sub.value;
    }
  }
}

/** "3m" | "1y" | "range:2026-10-24:2027-03-31" -> Horizon */
export function parseHorizonValue(v: string, asOf: string): Horizon | null {
  if (['now', '3m', '6m', '1y', '3y', 'life'].includes(v)) return v as Horizon;
  const m = /^range:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(v);
  if (m && m[1]! <= m[2]! && m[2]! >= asOf) return { from: m[1]! < asOf ? asOf : m[1]!, to: m[2]! };
  return null;
}

export function horizonLabel(h: Horizon, asOf: string): string {
  const r = horizonRange(h, asOf);
  const names: Record<string, string> = { now: 'this month', '3m': 'the next 3 months', '6m': 'the next 6 months', '1y': 'the next 12 months', '3y': 'the next 3 years', life: 'your life as a whole' };
  if (typeof h === 'string') return h === 'life' ? names.life! : `${names[h]} (${humanDate(r.from)} to ${humanDate(r.to)})`;
  return `${humanDate(h.from)} to ${humanDate(h.to)}`;
}

/** The exact query shown for confirmation: question, period, charts and running period read. */
export function exactQueryFor(s: ClarifyState): string {
  const b = BUCKETS[s.bucket];
  const subFrame = s.subBucket ? b.subBuckets.find((x) => x.id === s.subBucket)?.frame : undefined;
  const frame = FRAMES[subFrame ?? b.frames[0]!];
  const q = s.question.replace(/\s*\?+\s*$/, '');
  const h = s.slots.horizon?.value ?? b.defaultHorizon;
  const charts = [...new Set(frame.vargas)].filter((v) => v !== 'D1').map((v) => v.replace('D', 'D-'));
  const houses = frame.houses.slice(0, 3).map((n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`).join(', ');
  const period = s.card?.md && s.card.ad ? `your ${pname(s.card.md)}–${pname(s.card.ad)} period` : 'your running dasha periods';
  const sib = s.sibling && s.sibling.rank !== 'all' ? `${s.sibling.rank} ${s.sibling.noun}` : null;
  const who = sib ? ` (about your ${sib}, read from your chart)` : s.slots.subject_person && s.slots.subject_person.value !== 'me' ? ` (about your ${s.slots.subject_person.value}, read from your chart)` : '';
  // name the sub-question only when the user chose it in this conversation
  const chosenSub = s.turns.some((t) => t.ask.criterion === 'sub_bucket' && t.answer?.resolved) && s.subBucket ? b.subBuckets.find((x) => x.id === s.subBucket)?.label.toLowerCase() : undefined;
  const sub = chosenSub ? `, focusing on ${chosenSub}` : '';
  // a question with no life area of its own ("Hello") is restated as the area chosen; a multi-area one says what comes first
  const what = s.originalBucket === 'unknown' ? `your ${b.displayName.toLowerCase()}` : s.originalBucket !== s.bucket || s.alsoBuckets.length >= 2 ? `${b.displayName.toLowerCase()} first, from "${q}"` : `"${q}"`;
  const local = s.locationAnswered && s.location ? ` Dates will be given for ${s.location.place}.` : '';
  return `I will read: ${what}${sub}${who} over ${horizonLabel(h, s.asOf)}, using ${charts.length ? `the ${charts.join(' and ')} chart${charts.length > 1 ? 's' : ''}, ` : ''}your ${houses} houses, ${period} and the transits.${local}`;
}

export function propose(s: ClarifyState, now: number): ClarifyState {
  const withQuery = { ...s, pending: null };
  return { ...withQuery, status: 'PROPOSED', exactQuery: exactQueryFor(withQuery), updatedAt: now };
}

function finalizeReady(s: ClarifyState): ClarifyState {
  return { ...s, status: 'READY', exactQuery: s.unanswerable && s.unanswerable !== 'no_subject' ? null : exactQueryFor(s) };
}

/** PROPOSED -> CONFIRMED, optionally with an edited horizon or area (an edit re-proposes). */
export function confirmClarify(s: ClarifyState, edits: { horizon?: string; bucket?: string } = {}, now = Date.now()): ClarifyState {
  if (s.status !== 'PROPOSED' && s.status !== 'READY') return s;
  if (edits.horizon || edits.bucket) {
    const next: ClarifyState = { ...s, slots: { ...s.slots }, alsoBuckets: [...s.alsoBuckets] };
    if (edits.bucket) resolveValue(next, 'bucket', edits.bucket, true);
    if (edits.horizon) resolveValue(next, 'horizon', edits.horizon, true);
    return propose(next, now);
  }
  return { ...s, status: 'CONFIRMED', prashna: prashnaRule(s), confirmedAt: now, updatedAt: now };
}

export function expireIfStale(s: ClarifyState, now = Date.now()): ClarifyState {
  if ((s.status === 'ASKING' || s.status === 'PROPOSED') && now - s.updatedAt > ABANDON_AFTER_MS) return { ...s, status: 'ABANDONED', pending: null, updatedAt: now };
  return s;
}

/** The sentence said back when defaults were used ("I assumed the next 12 months"). */
export function assumptionText(s: ClarifyState): string | null {
  const parts = Object.values(s.assumed);
  return parts.length ? `I assumed ${parts.join(' and ')}.` : null;
}
