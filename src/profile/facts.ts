/**
 * The person's own facts from the personalization wizard and the boards (docs/reading-engine/48 §4.3, 52 §3).
 * A fixed catalogue: unknown keys and values are refused. `null` means "I'd rather not say" and is stored as `declined`
 * so nothing asks again (doc 48 §4.1). Nothing here is astrological.
 */
import type { PrismaClient } from '@prisma/client';

export const DECLINED = 'declined';

/** key → allowed values ('*' = free short text, e.g. a city) */
export const FACT_CATALOG: Record<string, readonly string[] | '*'> = {
  'work.status': ['yes', 'between_jobs', 'own_business', 'studying', 'retired'],
  'work.level': ['hourly', 'employee', 'specialist', 'manager', 'senior_leader', 'owner_alone', 'owner_staff', 'several_businesses'],
  'love.status': ['single', 'dating', 'committed', 'married', 'separated', 'complicated'],
  'family.children': ['none', 'expecting', 'young', 'grown'],
  'self.focus': '*',
  'place.current': '*',
  /** the Self board's mood tap for one day, `<mood>:<YYYY-MM-DD>` (docs/reading-engine/66 §4.2; read by profile.moodFor) */
  'self.mood': '*',
  'wizard.selfie': ['done', 'skipped'],
  'wizard.done': '*',
  'wizard.skipped': '*',
};

const FOCUS = new Set(['career', 'money', 'love', 'family', 'home', 'learning', 'travel', 'health', 'creativity', 'spirituality']);

/** answers to the You reading's confirm question (docs/reading-engine/58 §4.1): key `self.confirm.<claimId>` */
export const SELF_CONFIRM_PREFIX = 'self.confirm.';
export const SELF_CONFIRM_ANSWERS = ['yes', 'partly', 'no', 'skip'] as const;

/** the mood tap's values and its stored form */
export const SELF_MOODS = ['heavy', 'mixed', 'fine'] as const;
const SELF_MOOD_RE = /^(heavy|mixed|fine):\d{4}-\d{2}-\d{2}$/;

export type FactCheck = { ok: true; value: string } | { ok: false; error: string };

export function checkFact(key: string, value: unknown): FactCheck {
  if (key.startsWith(SELF_CONFIRM_PREFIX)) {
    if (!/^self\.confirm\.[a-z0-9_.]{1,60}$/.test(key)) return { ok: false, error: `unknown_key:${key}` };
    return typeof value === 'string' && (SELF_CONFIRM_ANSWERS as readonly string[]).includes(value) ? { ok: true, value } : { ok: false, error: `bad_value:${key}` };
  }
  const allowed = FACT_CATALOG[key];
  if (!allowed) return { ok: false, error: `unknown_key:${key}` };
  if (value === null) return { ok: true, value: DECLINED };
  if (typeof value !== 'string' || !value.trim() || value.length > 120) return { ok: false, error: `bad_value:${key}` };
  const v = value.trim();
  if (key === 'self.mood') return SELF_MOOD_RE.test(v) ? { ok: true, value: v } : { ok: false, error: 'bad_value:self.mood' };
  if (key === 'self.focus') {
    const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0 || parts.length > 3 || parts.some((p) => !FOCUS.has(p))) return { ok: false, error: 'bad_value:self.focus' };
    return { ok: true, value: parts.join(',') };
  }
  if (allowed === '*') return { ok: true, value: v };
  return allowed.includes(v) ? { ok: true, value: v } : { ok: false, error: `bad_value:${key}` };
}

export async function readFacts(prisma: PrismaClient, userId: string) {
  const rows = await prisma.personFact.findMany({ where: { user_id: userId } });
  const facts: Record<string, { value: string; source: string; confirmed_at: string | null }> = {};
  for (const r of rows) facts[r.key] = { value: r.value, source: r.source, confirmed_at: r.confirmed_at?.toISOString() ?? null };
  return { facts, wizard: { done: facts['wizard.done']?.value ?? null, skipped: facts['wizard.skipped']?.value ?? null } };
}

/**
 * The facts the person has confirmed (a confirmation time, a catalogue key), key → value, for the technique matcher
 * and the reading's FACTS line (docs/reading-engine/53 §4.3–§4.4). `declined` stays, so a caller can tell "rather not say"
 * from "not asked".
 */
export async function confirmedFacts(prisma: PrismaClient, userId: string): Promise<Record<string, string>> {
  const { facts } = await readFacts(prisma, userId);
  const out: Record<string, string> = {};
  for (const [k, f] of Object.entries(facts)) if (f.confirmed_at && FACT_CATALOG[k]) out[k] = f.value;
  return out;
}

/** Writes every fact or none: the whole body is checked first. */
export async function writeFacts(prisma: PrismaClient, userId: string, input: unknown): Promise<{ ok: true; written: number } | { ok: false; error: string }> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'bad_body' };
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 20) return { ok: false, error: 'bad_body' };
  const checked: Array<[string, string]> = [];
  for (const [k, v] of entries) {
    const c = checkFact(k, v);
    if (!c.ok) return { ok: false, error: c.error };
    checked.push([k, c.value]);
  }
  const now = new Date();
  for (const [key, value] of checked) {
    await prisma.personFact.upsert({
      where: { user_id_key: { user_id: userId, key } },
      create: { user_id: userId, key, value, source: 'tapped', confirmed_at: now },
      update: { value, source: 'tapped', confirmed_at: now, updated_at: now },
    });
  }
  return { ok: true, written: checked.length };
}
