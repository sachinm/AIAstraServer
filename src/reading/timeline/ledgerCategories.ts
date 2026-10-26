/**
 * What the ledger accepts (docs/reading-engine/27 §A.7 step 1, §B.2 `life_events`): the full dotted categories the
 * person picks from (each under a marker prefix of markers.ts, so `markerForCategory` places it), the attribute keys,
 * and the checks a row passes before it is stored. Facts only: no judgement words, no amounts, no free-text notes.
 */
import { MARKER_IDS, MARKERS, markerForCategory, type MarkerId } from './markers.js';
import type { DatePrecision, LifeEvent } from './ledger.js';

export interface LedgerCategory {
  code: string;
  label: string;
}

/** Full categories per marker. Every code starts with one of the marker's `categories` prefixes. */
export const LEDGER_CATEGORIES: Record<MarkerId, LedgerCategory[]> = {
  family_parents: [
    { code: 'family.father.illness', label: 'Father: illness' },
    { code: 'family.father.death', label: 'Father: passed away' },
    { code: 'family.father.retirement', label: 'Father: retired' },
    { code: 'family.father.move', label: 'Father: moved' },
    { code: 'family.mother.illness', label: 'Mother: illness' },
    { code: 'family.mother.death', label: 'Mother: passed away' },
    { code: 'family.mother.retirement', label: 'Mother: retired' },
    { code: 'family.mother.move', label: 'Mother: moved' },
  ],
  siblings: [
    { code: 'family.sibling.birth', label: 'Sibling: born' },
    { code: 'family.sibling.marriage', label: 'Sibling: married' },
    { code: 'family.sibling.move', label: 'Sibling: moved' },
    { code: 'family.sibling.illness', label: 'Sibling: illness' },
  ],
  love_marriage: [
    { code: 'relationship.start', label: 'Relationship began' },
    { code: 'relationship.end', label: 'Relationship ended' },
    { code: 'marriage.engagement', label: 'Engagement' },
    { code: 'marriage.wedding', label: 'Wedding' },
    { code: 'marriage.separation', label: 'Separation' },
    { code: 'marriage.divorce', label: 'Divorce' },
  ],
  children: [
    { code: 'child.birth', label: 'Child born' },
    { code: 'child.adoption', label: 'Child adopted' },
    { code: 'child.leaves_home', label: 'Child left home' },
  ],
  career: [
    { code: 'job.start', label: 'Job started' },
    { code: 'job.end', label: 'Job ended' },
    { code: 'job.promotion', label: 'Promotion' },
    { code: 'job.transfer', label: 'Transfer' },
    { code: 'job.role_change', label: 'Role changed' },
  ],
  business: [
    { code: 'business.start', label: 'Business started' },
    { code: 'business.end', label: 'Business ended' },
    { code: 'business.partnership', label: 'Business partnership' },
    { code: 'business.expansion', label: 'Business expanded' },
  ],
  money: [
    { code: 'money.gain', label: 'Money received' },
    { code: 'money.loss', label: 'Money lost' },
    { code: 'money.loan_taken', label: 'Loan taken' },
    { code: 'money.loan_repaid', label: 'Loan repaid' },
    { code: 'money.inheritance', label: 'Inheritance' },
  ],
  residence: [
    { code: 'residence.move', label: 'Moved home' },
    { code: 'residence.abroad', label: 'Moved abroad' },
    { code: 'residence.return', label: 'Returned home country' },
    { code: 'travel.long', label: 'Long journey' },
  ],
  property_vehicles: [
    { code: 'property.purchase', label: 'Property bought' },
    { code: 'property.sale', label: 'Property sold' },
    { code: 'property.construction', label: 'Property built' },
    { code: 'vehicle.purchase', label: 'Vehicle bought' },
    { code: 'vehicle.sale', label: 'Vehicle sold' },
  ],
  education: [
    { code: 'education.start', label: 'Studies started' },
    { code: 'education.graduation', label: 'Graduated' },
    { code: 'education.exam', label: 'Exam taken' },
    { code: 'education.end', label: 'Studies ended' },
  ],
  health: [
    { code: 'health.illness', label: 'Illness' },
    { code: 'health.surgery', label: 'Surgery' },
    { code: 'health.accident', label: 'Accident' },
    { code: 'health.hospital_stay', label: 'Hospital stay' },
  ],
};

export const ALL_LEDGER_CATEGORIES: string[] = MARKER_IDS.flatMap((m) => LEDGER_CATEGORIES[m].map((c) => c.code));
const CATEGORY_SET = new Set(ALL_LEDGER_CATEGORIES);
const LABELS = new Map(MARKER_IDS.flatMap((m) => LEDGER_CATEGORIES[m].map((c) => [c.code, c.label] as const)));

export function isLedgerCategory(code: unknown): code is string {
  return typeof code === 'string' && CATEGORY_SET.has(code);
}

export function categoryLabel(code: string): string {
  return LABELS.get(code) ?? code;
}

export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Attribute keys (doc 27 §B.2: colour, make, direction, floor, field, country, outcome, with whom); nothing else */
export const LEDGER_ATTRIBUTES: Array<{ key: string; label: string; values?: readonly string[] }> = [
  { key: 'colour', label: 'Colour' },
  { key: 'make', label: 'Make' },
  { key: 'direction', label: 'Direction', values: DIRECTIONS },
  { key: 'floor', label: 'Floor' },
  { key: 'field', label: 'Field' },
  { key: 'country', label: 'Country' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'with_whom', label: 'With whom' },
];
const ATTRIBUTE_KEYS = new Set(LEDGER_ATTRIBUTES.map((a) => a.key));

export const MAX_ATTRIBUTE_CHARS = 80;
export const MAX_PLACE_CHARS = 120;
export const MAX_EVENTS_PER_KUNDLI = 500;

/** The marker list the form groups the picker by */
export function ledgerMeta(): { markers: Array<{ id: MarkerId; label: string; categories: LedgerCategory[] }>; attributes: typeof LEDGER_ATTRIBUTES; precisions: DatePrecision[] } {
  return {
    markers: MARKER_IDS.map((id) => ({ id, label: MARKERS[id].label, categories: LEDGER_CATEGORIES[id] })),
    attributes: LEDGER_ATTRIBUTES,
    precisions: ['day', 'month', 'year'],
  };
}

// ---- facts-only wording --------------------------------------------------------------------------------------

/** Evaluation words a stored fact never carries ("a business that closed is business.end with outcome: closed") */
const JUDGEMENT = /\b(good|bad|great|terrible|awful|lucky|unlucky|fortunate|unfortunate|auspicious|inauspicious|success(ful)?|fail(ed|ure)?|disaster(ous)?|happy|unhappy|sad|painful|tragic|wonderful|best|worst|positive|negative|blessed|cursed|shameful|wrong|right decision|mistake)\b/i;
/** Amounts of money (decline topic `exact_amount`): digits with a currency word or sign */
const AMOUNT = /([$€£₹]\s*\d)|(\d[\d,.]*\s*(k|m|bn|lakhs?|lacs?|crores?|rs\.?|rupees?|inr|usd|dollars?|euros?|pounds?|gbp|eur)\b)|\b(rs\.?|inr|usd)\s*\d/i;

export function hasJudgement(text: string): boolean {
  return JUDGEMENT.test(text);
}

export function hasAmount(text: string): boolean {
  return AMOUNT.test(text);
}

/** Single-line text, no control characters, trimmed; empty -> null */
export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

// ---- dates ---------------------------------------------------------------------------------------------------

const MIN_YEAR = 1900;

/**
 * `YYYY-MM-DD`, `YYYY-MM` or `YYYY` to the stored ISO date for the precision (month: the 1st; year: 1 January).
 * Null when malformed, impossible (31 February), before 1900 or after `today`.
 */
export function normalizeLedgerDate(raw: unknown, precision: DatePrecision, today: Date = new Date()): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(raw.trim().slice(0, 10));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : null;
  const d = m[3] ? Number(m[3]) : null;
  if (precision === 'day' && (mo === null || d === null)) return null;
  if (precision === 'month' && mo === null) return null;
  const month = precision === 'year' ? 1 : mo!;
  const day = precision === 'day' ? d! : 1;
  if (y < MIN_YEAR || month < 1 || month > 12 || day < 1) return null;
  const dt = new Date(Date.UTC(y, month - 1, day));
  if (dt.getUTCMonth() !== month - 1) return null;
  const iso = dt.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  // a month or year that has begun is allowed; a day must not be in the future
  if (iso > todayIso) return null;
  return iso;
}

// ---- input check ---------------------------------------------------------------------------------------------

export type LedgerInput = Omit<LifeEvent, 'id'> & { place: string | null; attributes: Record<string, string> };

export type LedgerCheck = { ok: true; value: LedgerInput } | { ok: false; error: string; field: string };

const PRECISIONS: DatePrecision[] = ['day', 'month', 'year'];

/** Attributes restricted to the known keys and facts-only wording. Returns the first problem, or the clean map. */
export function checkAttributes(raw: unknown): { ok: true; value: Record<string, string> } | { ok: false; error: string; field: string } {
  const out: Record<string, string> = {};
  if (raw === undefined || raw === null) return { ok: true, value: out };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'attributes_invalid', field: 'attributes' };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ATTRIBUTE_KEYS.has(k)) return { ok: false, error: 'attribute_unknown', field: `attributes.${k}` };
    if (v === null || v === undefined || v === '') continue;
    if (typeof v !== 'string' && typeof v !== 'number') return { ok: false, error: 'attribute_invalid', field: `attributes.${k}` };
    const s = cleanText(String(v), MAX_ATTRIBUTE_CHARS + 1);
    if (!s) continue;
    if (s.length > MAX_ATTRIBUTE_CHARS) return { ok: false, error: 'attribute_too_long', field: `attributes.${k}` };
    if (k === 'direction' && !(DIRECTIONS as readonly string[]).includes(s.toUpperCase())) return { ok: false, error: 'direction_invalid', field: 'attributes.direction' };
    if (hasJudgement(s)) return { ok: false, error: 'judgement_wording', field: `attributes.${k}` };
    if (hasAmount(s)) return { ok: false, error: 'amount_not_recorded', field: `attributes.${k}` };
    out[k] = k === 'direction' ? s.toUpperCase() : s;
  }
  return { ok: true, value: out };
}

/** A full row from the form or a confirmed proposal */
export function checkLedgerInput(body: unknown, today: Date = new Date()): LedgerCheck {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isLedgerCategory(b.category)) return { ok: false, error: 'category_unknown', field: 'category' };
  if (!markerForCategory(b.category)) return { ok: false, error: 'category_unknown', field: 'category' };
  const precision = (b.date_precision ?? 'day') as DatePrecision;
  if (!PRECISIONS.includes(precision)) return { ok: false, error: 'precision_invalid', field: 'date_precision' };
  const date = normalizeLedgerDate(b.date, precision, today);
  if (!date) return { ok: false, error: 'date_invalid', field: 'date' };
  const place = cleanText(b.place, MAX_PLACE_CHARS + 1);
  if (place && place.length > MAX_PLACE_CHARS) return { ok: false, error: 'place_too_long', field: 'place' };
  if (place && (hasJudgement(place) || hasAmount(place))) return { ok: false, error: 'judgement_wording', field: 'place' };
  const attrs = checkAttributes(b.attributes);
  if (!attrs.ok) return attrs;
  return { ok: true, value: { category: b.category, date, date_precision: precision, place, attributes: attrs.value } };
}

/** A partial update merged over the stored row, then checked as a whole */
export function mergeLedgerUpdate(current: LifeEvent, patch: unknown, today: Date = new Date()): LedgerCheck {
  const p = (patch ?? {}) as Record<string, unknown>;
  const merged = {
    category: p.category ?? current.category,
    date: p.date ?? current.date,
    date_precision: p.date_precision ?? current.date_precision,
    place: 'place' in p ? p.place : current.place,
    attributes: 'attributes' in p ? p.attributes : current.attributes,
  };
  // a coarser precision on a stored day date: cut the date to that precision before checking
  if (typeof merged.date === 'string' && merged.date_precision !== 'day' && /^\d{4}-\d{2}-\d{2}$/.test(merged.date)) merged.date = merged.date_precision === 'year' ? merged.date.slice(0, 4) : merged.date.slice(0, 7);
  return checkLedgerInput(merged, today);
}
