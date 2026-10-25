/**
 * Closed bucket taxonomy — the first, deterministic step of every reading (docs/reading-engine/13 §1, brief item 1).
 *
 * The 29 subjects of docs/reading-engine/10-subject-prompt-matrix.md are grouped into 14 top-level buckets the user can
 * recognise (and tap as chips), plus `unknown`, which triggers coaching. Each bucket names:
 *  - the evidence-pack frame(s) it reads (src/reading/packs/frames.ts), so nothing downstream changes shape;
 *  - the slots a reading needs (docs/reading-engine/13 §2) and which of them are required;
 *  - its default template (docs/reading-engine/09 §2) and default horizon;
 *  - its policy flags (file 09 rule 6: no death prediction, no lottery numbers, no amounts, no medical/legal advice).
 * Adding a bucket means adding a row here and cues in classifier.ts; nothing else.
 */
import type { Horizon, SubjectId } from '../packs/frames.js';

export const BUCKET_IDS = [
  'love_relationships',
  'marriage',
  'career_job',
  'money_wealth',
  'business',
  'property_vehicles',
  'education',
  'health_windows',
  'family_children',
  'foreign_legal',
  'spirituality_direction',
  'time_window_outlook',
  'explain_term',
  'compatibility',
  'unknown',
] as const;
export type BucketId = (typeof BUCKET_IDS)[number];

export const SLOT_IDS = ['horizon', 'subject_person', 'sub_bucket', 'background', 'other_person', 'specific_event'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export const TEMPLATE_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type PolicyFlag =
  | 'no_death_prediction'
  | 'no_lottery_numbers'
  | 'no_amounts'
  | 'no_medical_advice'
  | 'no_legal_advice'
  | 'no_remedies'
  | 'vigilance_only'
  | 'needs_second_chart';

export interface SubBucket {
  id: string;
  label: string;
  /** Frame the sub-bucket reads first (falls back to the bucket's frames) */
  frame?: SubjectId;
  /** Template that fits this sub-question better than the bucket default */
  template?: TemplateId;
}

export interface Bucket {
  id: BucketId;
  displayName: string;
  /** One line shown under the chip and used by coaching */
  blurb: string;
  examples: string[];
  /** Rows of docs/reading-engine/10 this bucket covers */
  matrixRows: number[];
  /** Evidence-pack frames, primary first */
  frames: SubjectId[];
  subBuckets: SubBucket[];
  requiredSlots: SlotId[];
  optionalSlots: SlotId[];
  defaultTemplate: TemplateId;
  defaultHorizon: Horizon;
  policy: PolicyFlag[];
}

const B = (b: Bucket): Bucket => b;

/** Applied to every bucket (file 09 rule 6). */
export const GLOBAL_POLICY: PolicyFlag[] = ['no_remedies', 'no_death_prediction'];

export const BUCKETS: Record<BucketId, Bucket> = {
  love_relationships: B({
    id: 'love_relationships',
    displayName: 'Love and relationships',
    blurb: 'Romance, dating, a current relationship, its quality and timing.',
    examples: ['When will I meet someone serious?', 'Is my current relationship going to last?', 'Why do my relationships keep ending?'],
    matrixRows: [1, 2],
    frames: ['marriage_relationship'],
    subBuckets: [
      { id: 'new_relationship', label: 'Meeting someone new' },
      { id: 'current_relationship', label: 'My current relationship' },
      { id: 'breakup_friction', label: 'Friction or a breakup', template: 'T3' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'other_person', 'subject_person'],
    defaultTemplate: 'T2',
    defaultHorizon: '1y',
    policy: [],
  }),
  marriage: B({
    id: 'marriage',
    displayName: 'Marriage',
    blurb: 'When marriage is indicated, its promise, and the health of a marriage.',
    examples: ['When will I get married?', 'Will my marriage improve this year?', 'Is there a separation risk in my chart?'],
    matrixRows: [3, 4],
    frames: ['marriage_relationship'],
    subBuckets: [
      { id: 'marriage_timing', label: 'When I will marry' },
      { id: 'marriage_health', label: 'How my marriage is going', template: 'T3' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'subject_person'],
    defaultTemplate: 'T2',
    defaultHorizon: '1y',
    policy: [],
  }),
  career_job: B({
    id: 'career_job',
    displayName: 'Career and job',
    blurb: 'Changing jobs, promotion, finding work, trouble at work, career direction.',
    examples: ['Should I change jobs this year?', 'When will I get promoted?', 'What kind of work suits me?'],
    matrixRows: [5, 6, 7, 9, 10],
    frames: ['career_work'],
    subBuckets: [
      { id: 'job_change', label: 'Changing jobs', template: 'T5' },
      { id: 'promotion', label: 'Promotion or recognition' },
      { id: 'job_search', label: 'Finding a job' },
      { id: 'workplace_trouble', label: 'Trouble with boss or team', template: 'T3' },
      { id: 'career_direction', label: 'What kind of work suits me', template: 'T6' },
    ],
    requiredSlots: ['horizon', 'sub_bucket'],
    optionalSlots: ['background', 'specific_event'],
    defaultTemplate: 'T2',
    defaultHorizon: '6m',
    policy: [],
  }),
  money_wealth: B({
    id: 'money_wealth',
    displayName: 'Money and wealth',
    blurb: 'Income, savings, growth windows, debts and losses.',
    examples: ['When will my income improve?', 'Will I get out of debt?', 'Is this a good period for savings?'],
    matrixRows: [12, 13, 26],
    frames: ['income_wealth'],
    subBuckets: [
      { id: 'income_growth', label: 'Income and savings' },
      { id: 'debt_loss', label: 'Debts and losses', frame: 'debt_loss_expense', template: 'T3' },
      { id: 'windfall', label: 'Sudden gains', frame: 'speculation_lottery', template: 'T1' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'specific_event'],
    defaultTemplate: 'T2',
    defaultHorizon: '6m',
    policy: ['no_amounts'],
  }),
  business: B({
    id: 'business',
    displayName: 'Business',
    blurb: 'Starting or growing a business, partners, timing of launches.',
    examples: ['Is this a good time to start my business?', 'Will my business partnership work?', 'When will my business grow?'],
    matrixRows: [11],
    frames: ['career_work', 'income_wealth'],
    subBuckets: [
      { id: 'start_business', label: 'Starting a business' },
      { id: 'grow_business', label: 'Growing my business' },
      { id: 'business_partner', label: 'A business partner', template: 'T5' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'specific_event'],
    defaultTemplate: 'T2',
    defaultHorizon: '1y',
    policy: ['no_amounts'],
  }),
  property_vehicles: B({
    id: 'property_vehicles',
    displayName: 'Property and vehicles',
    blurb: 'Buying a home or land, moving house, buying a vehicle.',
    examples: ['When will I buy a house?', 'Is next year good for buying land?', 'When can I buy a car?'],
    matrixRows: [14, 15],
    frames: ['property_home'],
    subBuckets: [
      { id: 'buy_home', label: 'Buying a home or land' },
      { id: 'vehicle', label: 'Buying a vehicle', frame: 'vehicles' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket'],
    defaultTemplate: 'T2',
    defaultHorizon: '3y',
    policy: ['no_amounts'],
  }),
  education: B({
    id: 'education',
    displayName: 'Education',
    blurb: 'Studies, exams, admissions and which field suits you.',
    examples: ['Will I clear my exam this year?', 'When is a good time for higher studies?', 'Which field of study suits me?'],
    matrixRows: [8, 9],
    frames: ['education_learning'],
    subBuckets: [
      { id: 'exams', label: 'Exams and admissions', template: 'T1' },
      { id: 'higher_studies', label: 'Higher studies' },
      { id: 'field_fit', label: 'Which field suits me', template: 'T6' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'subject_person'],
    defaultTemplate: 'T2',
    defaultHorizon: '1y',
    policy: [],
  }),
  health_windows: B({
    id: 'health_windows',
    displayName: 'Health windows',
    blurb: 'Periods that call for extra care and recovery windows. Never a diagnosis.',
    examples: ['Which periods should I be careful about my health?', 'When will my health improve?', 'Is this year good for recovery?'],
    matrixRows: [16, 17, 18],
    frames: ['health_body'],
    subBuckets: [
      { id: 'vigilance', label: 'Periods to take care' },
      { id: 'recovery', label: 'Recovery window', template: 'T3' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'subject_person'],
    defaultTemplate: 'T9',
    defaultHorizon: '1y',
    policy: ['no_medical_advice', 'vigilance_only'],
  }),
  family_children: B({
    id: 'family_children',
    displayName: 'Family and children',
    blurb: 'Children and conception, parents and siblings as seen from your chart.',
    examples: ['When will we have a child?', 'How is my relationship with my father?', 'Will my son do well this year?'],
    matrixRows: [19, 20, 21],
    frames: ['children'],
    subBuckets: [
      { id: 'children', label: 'Children and conception' },
      { id: 'parents_siblings', label: 'Parents and siblings', template: 'T6' },
    ],
    requiredSlots: ['horizon', 'subject_person'],
    optionalSlots: ['sub_bucket'],
    defaultTemplate: 'T2',
    defaultHorizon: '3y',
    policy: ['no_medical_advice'],
  }),
  foreign_legal: B({
    id: 'foreign_legal',
    displayName: 'Foreign and legal',
    blurb: 'Travel or settling abroad, visas, court cases and government matters.',
    examples: ['When will I move abroad?', 'Will my visa come through?', 'How will my court case go?'],
    matrixRows: [23, 24],
    frames: ['foreign_relocation'],
    subBuckets: [
      { id: 'abroad', label: 'Travel or settling abroad' },
      { id: 'legal', label: 'Court case or government matter', frame: 'litigation_government' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket', 'specific_event'],
    defaultTemplate: 'T2',
    defaultHorizon: '1y',
    policy: ['no_legal_advice'],
  }),
  spirituality_direction: B({
    id: 'spirituality_direction',
    displayName: 'Spirituality and life direction',
    blurb: 'Purpose, spiritual phases, and the themes of your life by stage.',
    examples: ['What is my life purpose?', 'When will a spiritual phase begin?', 'What do my nakshatras say about me?'],
    matrixRows: [25, 27],
    frames: ['general_life_direction', 'spirituality_moksha'],
    subBuckets: [
      { id: 'purpose', label: 'Purpose and life themes', template: 'T6' },
      { id: 'spiritual_phase', label: 'Spiritual phase', frame: 'spirituality_moksha' },
      { id: 'nakshatra_portrait', label: 'My nakshatras', template: 'T7' },
    ],
    requiredSlots: [],
    optionalSlots: ['sub_bucket', 'horizon'],
    defaultTemplate: 'T6',
    defaultHorizon: 'life',
    policy: [],
  }),
  time_window_outlook: B({
    id: 'time_window_outlook',
    displayName: 'Time-window outlook',
    blurb: 'What this month, quarter or year looks like, and what is active now.',
    examples: ['How does this month look for me?', 'What is the year ahead like?', 'Why is everything so hard right now?'],
    matrixRows: [28, 29],
    frames: ['general_life_direction'],
    subBuckets: [
      { id: 'month_ahead', label: 'This month', template: 'T9' },
      { id: 'year_ahead', label: 'The year ahead', template: 'T2' },
      { id: 'current_difficulty', label: 'Why things are hard now', template: 'T3' },
      { id: 'transit_meaning', label: 'What a transit means', template: 'T4' },
    ],
    requiredSlots: ['horizon'],
    optionalSlots: ['sub_bucket'],
    defaultTemplate: 'T9',
    defaultHorizon: '3m',
    policy: [],
  }),
  explain_term: B({
    id: 'explain_term',
    displayName: 'Explain a term',
    blurb: 'What a term like Sade Sati, dasha or nakshatra means, with your chart as the example.',
    examples: ['What is Sade Sati?', 'What does Rahu mahadasha mean?', 'Explain navamsa.'],
    matrixRows: [],
    frames: ['explain_term'],
    subBuckets: [],
    requiredSlots: [],
    optionalSlots: [],
    defaultTemplate: 'T10',
    defaultHorizon: 'now',
    policy: [],
  }),
  compatibility: B({
    id: 'compatibility',
    displayName: 'Compatibility',
    blurb: 'How two charts fit: partner, prospective match or family member. Needs the second birth chart.',
    examples: ['Are my partner and I compatible?', 'Kundli milan for my match', 'How do my chart and my wife\'s chart fit?'],
    matrixRows: [21, 22],
    frames: ['marriage_relationship'],
    subBuckets: [
      { id: 'partner_match', label: 'Partner or prospective match' },
      { id: 'family_link', label: 'A family member' },
    ],
    requiredSlots: ['other_person'],
    optionalSlots: ['horizon', 'sub_bucket'],
    defaultTemplate: 'T8',
    defaultHorizon: '3y',
    policy: ['needs_second_chart'],
  }),
  unknown: B({
    id: 'unknown',
    displayName: 'Something else',
    blurb: 'Not sure yet. Tell me the area of life and the period you want read.',
    examples: [],
    matrixRows: [],
    frames: ['general_life_direction'],
    subBuckets: [],
    requiredSlots: [],
    optionalSlots: [],
    defaultTemplate: 'T6',
    defaultHorizon: '1y',
    policy: [],
  }),
};

export function isBucketId(x: unknown): x is BucketId {
  return typeof x === 'string' && (BUCKET_IDS as readonly string[]).includes(x);
}

/** Chips shown under the input box (file chat-interface-review §3.4), in this order. */
export const CHIP_BUCKETS: BucketId[] = [
  'career_job',
  'money_wealth',
  'love_relationships',
  'marriage',
  'property_vehicles',
  'health_windows',
  'time_window_outlook',
  'spirituality_direction',
];

/** Horizon chips for the clarifier (file 13 §2); the default is per bucket. */
export const HORIZON_CHIPS: Array<{ label: string; horizon: Horizon }> = [
  { label: 'Next 3 months', horizon: '3m' },
  { label: 'Next 6 months', horizon: '6m' },
  { label: 'This year', horizon: '1y' },
  { label: 'Next 3 years', horizon: '3y' },
];

export function policyFor(bucket: BucketId): PolicyFlag[] {
  return [...new Set([...GLOBAL_POLICY, ...BUCKETS[bucket].policy])];
}
