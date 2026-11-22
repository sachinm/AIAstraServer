/**
 * The one gate for personal data (docs/techniques/13 §2.4, Sachin 2026-11-22). Every agent asks it for the person, by
 * role; it decides which fields go over the wire to the model and says which were sent (`fieldsSent`: field names,
 * never values) so the caller records them on its run row (`agent_runs.input_summary`).
 *
 *   personalizer, chat, clarify  sex; exact age in years and birth date; stage of life; work, relationship and family
 *                                facts; dated life events; answers to confirm questions; mood; declined topics; the
 *                                register and voice rules the person's facts set; the companion-memory facts (doc 48,
 *                                the sealed `person_facts` table)
 *   oracle, roles                sex; birth date and age; confirmed life events. Nothing else
 *   shared                       nothing (readers shared per chart, doc 11 §4.5)
 *
 * NEVER, for any role: the name, email, phone, any place (birth place, current place, a life event's place), the birth
 * time, coordinates or time zone, ids other than opaque ones. The gate is an allow-list: it reads only the columns it
 * may send (`auth.date_of_birth`, `gender`, `role`; `person_facts` keys from `MEMORY_KEYS` and the confirm and mood keys;
 * `life_events` category and date), so a field it does not name cannot leak.
 *
 * Reads go through the PII-aware client (`src/lib/pii/prismaExtension.ts` unseals `person_facts.value` and the `auth`
 * columns) and the ledger store (`timeline/ledgerStore.ts`, which opens `life_events` rows through `lib/pii/rawSql.ts`).
 * Wording reuses `person/profile.ts` and `person/profileLines.ts`. Nothing astrological is computed here.
 */
import type { PrismaClient } from '@prisma/client';
import { DECLINED, parseMoodHistory } from '../../profile/facts.js';
import { claimKey } from '../slices/natalPrefix.js';
import { listLedger, resolveKundli } from '../timeline/ledgerStore.js';
import type { PersonPortrait } from '../self/v2types.js';
import { moodTrend } from './portrait.js';
import { buildProfilePack, lifeStageOf, type ProfileSource } from './profile.js';
import { profileLines } from './profileLines.js';

export type PersonRole = 'personalizer' | 'chat' | 'clarify' | 'oracle' | 'roles' | 'shared';

/** What the gate hands an agent: its person lines and the names of the fields in them (never values). */
export interface PersonForModel {
  lines: string[];
  fieldsSent: string[];
}

export const EMPTY_PERSON: Readonly<PersonForModel> = Object.freeze({ lines: [], fieldsSent: [] });

/** The field names a role may receive (doc 13 §2.4 table). */
export const PERSON_ROLE_FIELDS: Readonly<Record<PersonRole, readonly string[]>> = {
  personalizer: ['sex', 'birth_date', 'age_years', 'life_stage', 'work', 'love', 'children', 'focus', 'register', 'confirm_answers', 'life_events', 'mood', 'declined_topics', 'memory_facts'],
  chat: ['sex', 'birth_date', 'age_years', 'life_stage', 'work', 'love', 'children', 'focus', 'register', 'confirm_answers', 'life_events', 'mood', 'declined_topics', 'memory_facts'],
  clarify: ['sex', 'birth_date', 'age_years', 'life_stage', 'work', 'love', 'children', 'focus', 'register', 'confirm_answers', 'life_events', 'mood', 'declined_topics', 'memory_facts'],
  oracle: ['sex', 'birth_date', 'age_years', 'life_events'],
  roles: ['sex', 'birth_date', 'age_years', 'life_events'],
  shared: [],
};

/** Never sent to any model, whatever the role (doc 13 §2.4): the engine already used them. */
export const PERSON_NEVER_FIELDS: readonly string[] = ['name', 'email', 'phone', 'birth_place', 'current_place', 'birth_time', 'coordinates', 'time_zone', 'internal_ids'];

/** The companion-memory keys (doc 48 §4.3 catalogue) that are facts about the person's life. Places are never here. */
export const MEMORY_KEYS: readonly string[] = ['work.status', 'work.level', 'love.status', 'family.children', 'self.focus'];

/** Everything the gate may read for one person. Only allowed columns: no name, contact, place, birth time or coordinates. */
export interface PersonSources {
  birthDate: string | null;
  gender: string | null;
  /** the account role (`auth.role`): practitioner or public reader, a register rule */
  role: string | null;
  /** `person_facts`, key → { value, confirmed_at } (only MEMORY_KEYS, `self.confirm.*`, `self.mood`, `self.mood.history` are read) */
  facts: Record<string, { value: string; confirmed_at?: string | null }>;
  /** `life_events` entered by the person: category and date only */
  lifeEvents: Array<{ category: string; date: string; precision: string }>;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY = /^[a-z_]+(\.[a-z_]+)*$/;
const FACT_KEY_READ = (k: string): boolean => MEMORY_KEYS.includes(k) || k.startsWith('self.confirm.') || k === 'self.mood' || k === 'self.mood.history';

/** The facts the gate reads, with every other key dropped (a place, a wizard flag, a menu choice). */
function readableFacts(facts: PersonSources['facts']): ProfileSource['facts'] {
  const out: ProfileSource['facts'] = {};
  for (const [k, v] of Object.entries(facts)) if (FACT_KEY_READ(k) && typeof v?.value === 'string') out[k] = { value: v.value, confirmed_at: v.confirmed_at ?? null };
  return out;
}

const day = (s: string | null | undefined): string | null => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

/** Life events as the gate sends them: valid category and date, oldest first, never a place or free text. */
function eventLines(events: PersonSources['lifeEvents']): string[] {
  return events
    .filter((e) => CATEGORY.test(e.category) && ISO_DAY.test(e.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category))
    .map((e) => `- ${e.category} on ${e.date} (${/^(day|month|year)$/.test(e.precision) ? e.precision : 'day'})`);
}

/**
 * PURE. The person lines for one role from its sources, and the names of the fields they carry. The lines have no
 * header: each caller writes its own (`## THE PERSON`, `THE PERSON`, …).
 */
export function personLinesFor(src: PersonSources, role: PersonRole, asOf: string): PersonForModel {
  if (role === 'shared') return { lines: [], fieldsSent: [] };
  const facts = readableFacts(src.facts);
  const pack = buildProfilePack({ birthDate: src.birthDate, gender: src.gender, role: src.role, facts }, asOf);
  const sent = new Set<string>();
  const birthDate = pack.ageYears !== null && src.birthDate ? src.birthDate.trim() : null;
  const events = eventLines(src.lifeEvents ?? []);
  const L: string[] = [];

  if (role === 'oracle' || role === 'roles') {
    // the rules that differ by sex, the age rules (maturity dates) and testing the chart against what happened
    L.push(`sex: ${pack.gender ?? 'not stated'} (for the rules that differ by sex only; never assume roles from it)`);
    if (pack.gender) sent.add('sex');
    if (birthDate) {
      L.push(`birth date: ${birthDate} (for the age rules only; never write it)`, `age in whole years: ${pack.ageYears}`);
      sent.add('birth_date').add('age_years');
    } else L.push('birth date: not known');
    if (events.length) {
      L.push('confirmed life events (entered by the person; test the chart against them):', ...events);
      sent.add('life_events');
    }
    return { lines: L, fieldsSent: PERSON_ROLE_FIELDS[role].filter((f) => sent.has(f)) };
  }

  // personalizer, chat, clarify: today's wording (profileLines), with no place in it
  const { place: _place, ...noPlace } = pack.facts;
  void _place;
  L.push(...profileLines({ ...pack, facts: noPlace }));
  if (pack.gender) sent.add('sex');
  if (pack.facts.work) sent.add('work');
  if (pack.facts.love) sent.add('love');
  if (pack.facts.children) sent.add('children');
  if (pack.facts.focus?.length) sent.add('focus');
  sent.add('register');
  L.push(`age in whole years: ${pack.ageYears ?? 'not known'} (to pitch the reading; never write the age)`);
  if (birthDate) {
    L.push(`birth date: ${birthDate} (for age rules only; never write it)`);
    sent.add('birth_date').add('age_years');
  }
  const stage = lifeStageOf(pack);
  L.push(`stage of life: ${stage ?? 'not known'}`);
  if (stage) sent.add('life_stage');
  L.push(`declined (never mention): ${pack.declined.length ? pack.declined.join(', ') : 'none'}`);
  if (pack.declined.length) sent.add('declined_topics');
  L.push(`last answers: ${pack.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`);
  if (pack.lastConfirms.length) sent.add('confirm_answers');
  L.push(`mood today: ${pack.mood ?? 'not given'}`);
  const history = parseMoodHistory(facts['self.mood.history']?.value).filter((t) => t.on <= asOf);
  if (history.length >= 3) L.push(`mood, last 30 days: ${moodTrend(history.slice(-30), asOf)} (${history.length} taps)`);
  if (pack.mood || history.length >= 3) sent.add('mood');
  if (events.length) {
    L.push('life events (entered by the person, dated):', ...events);
    sent.add('life_events');
  }
  const memory = MEMORY_KEYS.filter((k) => facts[k] && facts[k]!.value !== DECLINED).map((k) => {
    const at = day(facts[k]!.confirmed_at ?? null);
    return `- ${k} = ${facts[k]!.value}${at ? ` (since ${at})` : ''}`;
  });
  if (memory.length) {
    L.push('what they told us (companion memory, with the date each was confirmed):', ...memory);
    sent.add('memory_facts');
  }
  return { lines: L, fieldsSent: PERSON_ROLE_FIELDS[role].filter((f) => sent.has(f)) };
}

export interface PersonWho {
  userId?: string | null;
  kundliId?: string | null;
}

/**
 * Reads the allowed columns for one person: the account (`userId`, or the owner of `kundliId`), its facts and the
 * ledger of the given kundli (the account's latest when none is given). Null when the person is not found.
 */
export async function loadPersonSources(prisma: PrismaClient, who: PersonWho, _asOf: string): Promise<PersonSources | null> {
  void _asOf;
  let userId = who.userId ?? null;
  if (!userId && who.kundliId) userId = (await prisma.kundli.findUnique({ where: { id: who.kundliId }, select: { user_id: true } }))?.user_id ?? null;
  if (!userId) return null;
  const [auth, rows, kundliId] = await Promise.all([
    prisma.auth.findUnique({ where: { id: userId }, select: { date_of_birth: true, gender: true, role: true } }),
    prisma.personFact.findMany({ where: { user_id: userId }, select: { key: true, value: true, confirmed_at: true } }),
    resolveKundli(prisma, userId, who.kundliId ?? null).catch(() => null),
  ]);
  if (!auth) return null;
  const facts: PersonSources['facts'] = {};
  for (const r of rows) if (FACT_KEY_READ(r.key)) facts[r.key] = { value: r.value, confirmed_at: r.confirmed_at?.toISOString() ?? null };
  const ledger = kundliId ? await listLedger(prisma, userId, kundliId) : null;
  const lifeEvents = ledger?.status === 'ok' ? ledger.value.map((e) => ({ category: e.category, date: e.date, precision: e.date_precision })) : [];
  return { birthDate: auth.date_of_birth ?? null, gender: auth.gender ?? null, role: auth.role ?? null, facts, lifeEvents };
}

export interface PersonForModelOptions {
  asOf?: string;
  /** test seam: the sources (default loadPersonSources) */
  load?: (prisma: PrismaClient, who: PersonWho, asOf: string) => Promise<PersonSources | null>;
}

/**
 * The person for one agent, by role. Never throws: a failed read sends nothing personal (`EMPTY_PERSON`), never the
 * legacy block. `shared` reads nothing.
 */
export async function personForModel(prisma: PrismaClient, who: PersonWho, role: PersonRole, opts: PersonForModelOptions = {}): Promise<PersonForModel> {
  if (role === 'shared') return { lines: [], fieldsSent: [] };
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  try {
    const src = await (opts.load ?? loadPersonSources)(prisma, who, asOf);
    return src ? personLinesFor(src, role, asOf) : { lines: [], fieldsSent: [] };
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'person gate read failed; nothing personal sent', role, error: String((e as Error)?.message ?? e).slice(0, 160) }));
    return { lines: [], fieldsSent: [] };
  }
}

/** Gaps of the portrait that speak of a personal block the gate now owns (or of a place); dropped with the block. */
const GATED_GAP = /^(birthPlace|currentPlace|auth places|user_current_location|biography|past month|mood|person_facts|life_events|area_checks|chat categories)\b/;

/**
 * The portrait as the gate lets it through: the chart-derived blocks (character keys, health keys, life now, register)
 * stay; the personal blocks the gate sends itself (biography, past month, mood) and every place are removed. A copy:
 * `portraitLines` and its other callers are unchanged.
 */
export function gatedPortrait(p: PersonPortrait): PersonPortrait {
  return { ...p, biography: null, pastMonth: null, mood: null, birthPlace: null, currentPlace: null, gaps: p.gaps.filter((g) => !GATED_GAP.test(g)) };
}
