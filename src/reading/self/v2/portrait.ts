/**
 * The Personalizer's portrait of the person (Sachin, 2026-11-09: "send everything and more to the Personalizer … if
 * they get it wrong the dashboard doesn't click with the person"). Built in code from rows that already exist; a block
 * with no source is null and named in `gaps`, never invented. Selection only: nothing astrological is computed here;
 * the life labels' state is read from the S3 windows and S5 rows the sub-techniques already built.
 *
 * Sources (each read is best effort; a failed or missing table is a gap):
 * - personality: the Oracle document's lagna, mind, drive and presence paragraph ids, its patterns; S6 mind keys
 * - biography: `person_facts` (wizard facts with their dates), `life_events` (category and date only), `area_checks`,
 *   confirm answers
 * - past month: confirms and mood taps of the last 30 days (`self.mood.history`), the categories of the person's chats
 *   with a message in the last 30 days (never the text); declined topics are left out
 * - mood: today's tap and the 30-day trend
 * - health: S7 body keys, the live windows on the body and daily-load matters, the stated health focus
 * - lifeNow: `LIFE_LABEL_MATTERS` over S3 `byMatter` and S5 rows. The house-state engine (doc 46) is only planned in
 *   the catalogue (`houseStateLayers`), so `lifeNowSource` is 'windows_and_risk'
 * - register: work status and level, reader role, how many S6 thinking keys
 * - places: birth place as typed (`auth.place_of_birth`, `auth.city`, `auth.country_code`) and the current city and
 *   country (`person_facts` place.current, else `user_current_location.place`)
 *
 * Never: the name, the exact birth date or time, coordinates or time zone (Sachin, 2026-11-09).
 */
import type { PrismaClient } from '@prisma/client';
import { DECLINED, parseMoodHistory, SELF_CONFIRM_PREFIX } from '../../../profile/facts.js';
import { LIFE_LABEL_MATTERS } from '../v2words.js';
import type {
  IsoDate,
  LifeLabel,
  LifeState,
  Matter,
  Mood,
  OracleV2Output,
  PersonPortrait,
  SelfBuildContext,
  Strength,
  WindowRef,
} from '../v2types.js';

export const PORTRAIT_DAYS = 30;
/** facts that are not biography: the mood (its own block), confirms (their own list), wizard bookkeeping, place */
const NOT_BIOGRAPHY = /^(self\.mood(\.history)?|wizard\.|place\.current$)/;
/** a declined fact key → the chat category it closes */
const DECLINED_CATEGORY: Record<string, string> = { 'love.status': 'love', 'work.status': 'work', 'work.level': 'work' };
const SENIOR_LEVELS = new Set(['specialist', 'manager', 'senior_leader', 'several_businesses']);

export interface PortraitSources {
  facts: Array<{ key: string; value: string; at: string | null }> | null;
  lifeEvents: Array<{ category: string; date: string; precision: string }> | null;
  areaChecks: Array<{ area: string; month: string; answer: string }> | null;
  /** chat categories of the messages of the last 30 days */
  chatCategories: string[] | null;
  birth: { placeOfBirth: string | null; city: string | null; countryCode: string | null } | null;
  currentLocation: string | null;
  gaps: string[];
}

const day = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const t = typeof d === 'string' ? d : d.toISOString();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
};
const daysBefore = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

type Db = Record<string, { findMany?: (a: unknown) => Promise<unknown[]>; findUnique?: (a: unknown) => Promise<unknown> } | undefined>;

/** Reads every portrait source in one parallel round; never throws (a missing table or a fake client is a gap). */
export async function loadPortraitSources(prisma: PrismaClient, userId: string, kundliId: string, asOf: string): Promise<PortraitSources> {
  const db = prisma as unknown as Db;
  const gaps: string[] = [];
  const read = async <T>(name: string, fn: (() => Promise<T>) | null): Promise<T | null> => {
    if (!fn) {
      gaps.push(`${name}: not readable here`);
      return null;
    }
    try {
      return await fn();
    } catch (e) {
      gaps.push(`${name}: ${String((e as Error).message ?? e).slice(0, 80)}`);
      return null;
    }
  };
  const since = new Date(`${daysBefore(asOf, PORTRAIT_DAYS)}T00:00:00Z`);
  const fm = (model: string) => (db[model]?.findMany ? db[model]!.findMany!.bind(db[model]) : null);
  const fu = (model: string) => (db[model]?.findUnique ? db[model]!.findUnique!.bind(db[model]) : null);
  const [facts, events, checks, msgs, auth, loc] = await Promise.all([
    read('person_facts', fm('personFact') && (() => fm('personFact')!({ where: { user_id: userId }, select: { key: true, value: true, confirmed_at: true } }) as Promise<Array<{ key: string; value: string; confirmed_at: Date | null }>>)),
    read('life_events', fm('lifeEvent') && (() => fm('lifeEvent')!({ where: { user_id: userId, kundli_id: kundliId }, select: { category: true, date: true, date_precision: true }, orderBy: { date: 'asc' }, take: 60 }) as Promise<Array<{ category: string; date: Date; date_precision: string }>>)),
    read('area_checks', fm('areaCheck') && (() => fm('areaCheck')!({ where: { user_id: userId }, select: { area: true, month: true, answer: true }, orderBy: { created_at: 'desc' }, take: 24 }) as Promise<Array<{ area: string; month: string; answer: string }>>)),
    read('chat categories', fm('message') && (() => fm('message')!({ where: { created_at: { gte: since }, chat: { user_id: userId } }, select: { chat: { select: { category: true } } }, take: 500 }) as Promise<Array<{ chat?: { category?: string } }>>)),
    read('auth places', fu('auth') && (() => fu('auth')!({ where: { id: userId }, select: { place_of_birth: true, city: true, country_code: true } }) as Promise<{ place_of_birth: string | null; city: string | null; country_code: string | null } | null>)),
    read('user_current_location', fu('userCurrentLocation') && (() => fu('userCurrentLocation')!({ where: { user_id: userId }, select: { place: true } }) as Promise<{ place: string } | null>)),
  ]);
  return {
    facts: facts ? facts.map((f) => ({ key: f.key, value: f.value, at: day(f.confirmed_at) })) : null,
    lifeEvents: events ? events.map((e) => ({ category: e.category, date: day(e.date) ?? '', precision: e.date_precision })).filter((e) => e.date) : null,
    areaChecks: checks ? checks.map((c) => ({ area: c.area, month: c.month, answer: c.answer })) : null,
    chatCategories: msgs ? msgs.map((m) => m.chat?.category ?? 'general') : null,
    birth: auth ? { placeOfBirth: auth.place_of_birth ?? null, city: auth.city ?? null, countryCode: auth.country_code ?? null } : null,
    currentLocation: loc?.place ?? null,
    gaps,
  };
}

const parts = (s: string | null | undefined): string[] => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** Birth place as the person typed it: city, region (a middle part), country. Never coordinates. */
export function birthPlaceOf(b: PortraitSources['birth']): PersonPortrait['birthPlace'] {
  if (!b) return null;
  const p = parts(b.placeOfBirth);
  const city = b.city?.trim() || p[0] || null;
  const region = p.length >= 3 ? p.slice(1, -1).join(', ') : null;
  const country = b.countryCode?.trim() || (p.length >= 2 ? p[p.length - 1]! : null);
  return city || country ? { city, region, country } : null;
}

/** The current place: city and country only (first and last part of the stored text). */
export function currentPlaceOf(fact: string | null | undefined, location: string | null | undefined): PersonPortrait['currentPlace'] {
  const p = parts(fact && fact !== DECLINED ? fact : location);
  if (!p.length) return null;
  return { city: p[0] ?? null, country: p.length >= 2 ? p[p.length - 1]! : null };
}

const MOOD_SCORE: Record<Mood, number> = { heavy: 2, mixed: 1, fine: 0 };

/** heavier / lighter / steady over the taps (last 7 days against the rest of the 30), unknown under 3 taps */
export function moodTrend(taps: ReadonlyArray<{ mood: Mood; on: string }>, asOf: string): 'heavier' | 'lighter' | 'steady' | 'unknown' {
  if (taps.length < 3) return 'unknown';
  const cut = daysBefore(asOf, 7);
  const recent = taps.filter((t) => t.on > cut);
  const earlier = taps.filter((t) => t.on <= cut);
  if (!recent.length || !earlier.length) return 'steady';
  const avg = (xs: ReadonlyArray<{ mood: Mood }>) => xs.reduce((n, x) => n + MOOD_SCORE[x.mood], 0) / xs.length;
  const d = avg(recent) - avg(earlier);
  return d >= 0.5 ? 'heavier' : d <= -0.5 ? 'lighter' : 'steady';
}

const live = (w: Pick<WindowRef, 'from' | 'to'>, asOf: string) => w.from <= asOf && w.to >= asOf;

/** One life label's state now: S3 windows on its matters and S5 rows; quiet when nothing live speaks for it. */
export function lifeStateOf(ctx: SelfBuildContext, matters: readonly Matter[]): { state: LifeState; since: IsoDate | null; until: IsoDate | null; strength: Strength | null } {
  const asOf = ctx.asOf;
  const ws = matters.flatMap((m) => ctx.sub.windows?.byMatter?.[m] ?? []).filter((w) => live(w, asOf));
  const rows = (ctx.sub.risk?.rows ?? []).filter((r) => matters.includes(r.matter) && (!r.since || r.since <= asOf) && (!r.until || r.until >= asOf));
  const pol = new Set([...ws.map((w) => w.polarity), ...rows.map((r) => r.polarity)]);
  const state: LifeState = !pol.size ? 'quiet' : pol.has('presses') && pol.has('supports') ? 'mixed' : pol.has('presses') ? 'presses' : pol.has('supports') ? 'supports' : 'mixed';
  const froms = [...ws.map((w) => w.from), ...rows.map((r) => r.since).filter((d): d is string => Boolean(d))].sort();
  const tos = [...ws.map((w) => w.to), ...rows.map((r) => r.until).filter((d): d is string => Boolean(d))].sort();
  const strengths = [...ws.map((w) => w.strength), ...rows.map((r) => r.strength)];
  return { state, since: froms[0] ?? null, until: tos[0] ?? null, strength: strengths.length ? (Math.max(...strengths) as Strength) : null };
}

const PERSONALITY_AREAS = ['lagna', 'mind', 'drive', 'presence'];

/** The portrait (pure): every block from its source, or null and a gap. */
export function buildPersonPortrait(ctx: SelfBuildContext, oracle: OracleV2Output, src: PortraitSources): PersonPortrait {
  const gaps = [...src.gaps];
  const p = ctx.sub.profile;
  const asOf = ctx.asOf;
  const declined = new Set(p?.declined ?? []);

  // personality
  const areas = oracle.doc.areas as Record<string, { paragraphs: string[] } | undefined>;
  const oracleParagraphs = PERSONALITY_AREAS.flatMap((id) => (areas[id]?.paragraphs ?? []).map((_, i) => `${id}.p${i + 1}`));
  const m = ctx.sub.mind;
  const personality =
    oracleParagraphs.length || m
      ? {
          oracleParagraphs,
          patterns: oracle.patterns.map((x) => x.behaviour),
          mindKeys: { feeling: [...(m?.feeling ?? [])], thinking: [...(m?.thinking ?? [])], peace: [...(m?.peace ?? [])], judgement: [...(m?.judgement ?? [])] },
        }
      : null;
  if (!personality) gaps.push('personality: no natal area in the Oracle document and no S6 mind facts');

  // biography
  const rows = src.facts ?? [];
  const confirms = rows
    .filter((f) => f.key.startsWith(SELF_CONFIRM_PREFIX))
    .map((f) => ({ claimId: f.key.slice(SELF_CONFIRM_PREFIX.length), answer: f.value, at: f.at }))
    .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
  const facts = rows.filter((f) => !f.key.startsWith(SELF_CONFIRM_PREFIX) && !NOT_BIOGRAPHY.test(f.key) && f.value !== DECLINED && !declined.has(f.key));
  const biography =
    src.facts || src.lifeEvents || src.areaChecks
      ? { facts, lifeEvents: src.lifeEvents ?? [], areaChecks: src.areaChecks ?? [], confirms }
      : null;
  if (!biography) gaps.push('biography: no person_facts, life_events or area_checks could be read');
  else {
    if (!facts.length) gaps.push('biography: no wizard facts stated');
    if (src.lifeEvents && !src.lifeEvents.length) gaps.push('biography: no life events stored');
  }

  // past month and mood
  const monthStart = daysBefore(asOf, PORTRAIT_DAYS);
  const history = parseMoodHistory(rows.find((f) => f.key === 'self.mood.history')?.value).filter((t) => t.on > monthStart && t.on <= asOf);
  const todayTap = p?.mood ?? null;
  const moods = history.length ? history : todayTap ? [{ mood: todayTap, on: asOf }] : [];
  const closed = new Set([...declined].map((k) => DECLINED_CATEGORY[k]).filter(Boolean) as string[]);
  const questionTopics: Record<string, number> = {};
  for (const c of src.chatCategories ?? []) if (!closed.has(c)) questionTopics[c] = (questionTopics[c] ?? 0) + 1;
  const monthConfirms = confirms.filter((c) => c.at && c.at > monthStart);
  const pastMonth = src.facts || src.chatCategories ? { confirms: monthConfirms, moods, questionTopics } : null;
  if (!pastMonth) gaps.push('past month: no facts and no chat history could be read');
  if (!src.chatCategories) gaps.push('past month: question topics not readable');
  if (!history.length) gaps.push('mood: no 30-day history stored (self.mood.history); today only');
  const mood = todayTap || moods.length ? { today: todayTap, trend: moodTrend(moods, asOf), taps30d: moods.length } : null;
  if (!mood) gaps.push('mood: no tap stored');

  // health
  const b = ctx.sub.body;
  const bodyWindows = (['self_and_body', 'work_load_and_health'] as Matter[])
    .flatMap((x) => ctx.sub.windows?.byMatter?.[x] ?? [])
    .filter((w) => live(w, asOf))
    .map((w) => ({ from: w.from, to: w.to, polarity: w.polarity }));
  const healthFocus = (p?.facts.focus ?? []).includes('health');
  const health = b || bodyWindows.length || healthFocus ? { focus: healthFocus, footing: [...(b?.footing ?? [])], wear: [...(b?.wear ?? [])], shape: [...(b?.shape ?? [])], liveWindows: bodyWindows } : null;
  if (!health) gaps.push('health: no S7 body facts and no live body window');

  // the life labels now
  const lifeNow = (Object.entries(LIFE_LABEL_MATTERS) as Array<[LifeLabel, readonly Matter[]]>).map(([label, matters]) => ({ label, matters: [...matters], ...lifeStateOf(ctx, matters) }));
  if (!ctx.sub.windows) gaps.push('lifeNow: no S3 windows; every label reads quiet');

  // register
  const status = p?.facts.work?.status ?? null;
  const level = p?.facts.work?.level ?? null;
  const why: string[] = [];
  let hint: PersonPortrait['register']['hint'] = 'plain';
  if (p?.role === 'practitioner') {
    hint = 'technical';
    why.push('reader is a practitioner (chart terms only under Chart details)');
  } else if ((level && SENIOR_LEVELS.has(level)) || status === 'own_business') {
    hint = 'mixed';
    why.push(`work ${status ?? '-'} / ${level ?? '-'}: decision-grade detail`);
  } else why.push('public reader with no stated senior or specialist work');
  if (m?.thinking.length) why.push(`S6 thinking keys: ${m.thinking.length}`);

  // places
  const birthPlace = birthPlaceOf(src.birth);
  if (!birthPlace) gaps.push('birthPlace: not stated');
  const currentPlace = currentPlaceOf(rows.find((f) => f.key === 'place.current')?.value ?? p?.facts.place ?? null, src.currentLocation);
  if (!currentPlace) gaps.push('currentPlace: not stated');

  return {
    personality,
    biography,
    pastMonth,
    mood,
    health,
    lifeNow,
    lifeNowSource: 'windows_and_risk',
    register: { hint, why, workStatus: status, workLevel: level, role: p?.role ?? 'public' },
    birthPlace,
    currentPlace,
    gaps,
  };
}

/** The portrait as the Personalizer's suffix block (keys and words; no name, birth date or time, or coordinates). */
export function portraitLines(x: PersonPortrait): string[] {
  const L = ['## PORTRAIT (build your picture of this person from this first; it is never shown)'];
  if (x.personality) {
    L.push(`- character: read the Oracle paragraphs ${x.personality.oracleParagraphs.join(', ') || 'none'}`);
    for (const pt of x.personality.patterns) L.push(`  - pattern: ${pt}`);
    const mk = x.personality.mindKeys;
    L.push(`  - mind keys: feeling ${mk.feeling.length}, thinking ${mk.thinking.length}, peace ${mk.peace.length}, judgement ${mk.judgement.length}`);
  }
  if (x.biography) {
    L.push('- biography:');
    for (const f of x.biography.facts) L.push(`  - ${f.key} = ${f.value}${f.at ? ` (since ${f.at})` : ''}`);
    for (const e of x.biography.lifeEvents) L.push(`  - event: ${e.category} on ${e.date} (${e.precision})`);
    for (const c of x.biography.areaChecks) L.push(`  - monthly check: ${c.area} ${c.month} = ${c.answer}`);
    for (const c of x.biography.confirms) L.push(`  - confirmed: ${c.claimId} = ${c.answer}${c.at ? ` on ${c.at}` : ''}`);
  }
  if (x.pastMonth) {
    const topics = Object.entries(x.pastMonth.questionTopics).map(([k, n]) => `${k} ${n}`).join(', ');
    L.push(`- past 30 days: ${x.pastMonth.confirms.length} answers, ${x.pastMonth.moods.length} mood taps, questions asked by topic: ${topics || 'none'}`);
  }
  if (x.mood) L.push(`- mood: today ${x.mood.today ?? 'not given'}, 30-day trend ${x.mood.trend} (${x.mood.taps30d} taps)`);
  if (x.health)
    L.push(
      `- health: stated focus ${x.health.focus ? 'yes' : 'no'}; body keys footing ${x.health.footing.length}, wear ${x.health.wear.length}, shape ${x.health.shape.length}; live body windows ${x.health.liveWindows.map((w) => `${w.from}..${w.to} ${w.polarity}`).join(', ') || 'none'} (never medical)`,
    );
  L.push(`- life now (${x.lifeNowSource === 'house_state' ? 'house-state engine' : 'engine windows and ledger rows'}):`);
  for (const l of x.lifeNow) L.push(`  - ${l.label}: ${l.state}${l.since || l.until ? ` ${l.since ?? 'n/a'}..${l.until ?? 'n/a'}` : ''}${l.strength ? ` strength ${l.strength}` : ''}`);
  L.push(`- register: ${x.register.hint} (${x.register.why.join('; ')})`);
  if (x.birthPlace) L.push(`- born in: ${[x.birthPlace.city, x.birthPlace.region, x.birthPlace.country].filter(Boolean).join(', ')}`);
  if (x.currentPlace) L.push(`- lives in: ${[x.currentPlace.city, x.currentPlace.country].filter(Boolean).join(', ')}`);
  if (x.gaps.length) L.push(`- not known (never assume): ${x.gaps.join('; ')}`);
  return L;
}
