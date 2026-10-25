/**
 * Topics the app does not discuss (docs/reading-engine/18-declined-topics.md; table `declined_topics`).
 *
 * Checked at EVERY entry point before any agent or model sees the text: the reading, the clarifier's first question
 * and every free-text clarify answer. Three categories:
 *
 *   deny        never facilitated, never sent to any agent or model, the reply never repeats or engages with the
 *               content, and the stored copy of the message is withheld (violence, harm, crime, abuse, extremism,
 *               sexual content involving minors, self-harm with a crisis line)
 *   decline     a short fixed reply (death and lifespan, gambling numbers, exact amounts, remedies, baby's sex …)
 *   role_gated  declined unless the user's role has the capability (health: illness, disease, diagnosis, accidents)
 *
 * The built-in list below is the floor: the database can change replies, add trigger phrases and words, change the
 * roles of a role-gated topic and disable a decline/role_gated topic, but it cannot disable a deny topic.
 * Detection is narrow on purpose (phrases and short windows) so a passing mention ("my father passed away last year")
 * does not block a normal question. English only for now.
 */
import type { PrismaClient } from '@prisma/client';
import { normalize } from '../buckets/classifier.js';
import { roleCan, canonicalRole } from '../../auth/roles.js';

export type DeclineCategory = 'deny' | 'decline' | 'role_gated';

export interface DeclinedTopic {
  id: string;
  category: DeclineCategory;
  label: string;
  /** Fixed reply shown instead of a reading. For deny topics it never quotes or refers to the content. */
  reply: string;
  /** Extra trigger phrases (matched on word boundaries) and single words, from the database */
  phrases: string[];
  words: string[];
  /** role_gated: roles that may discuss it (default from src/auth/roles.ts) */
  allowedRoles: string[];
  enabled: boolean;
  sortOrder: number;
  /** Example questions (unit-test fixtures and documentation) */
  examples: string[];
}

const DENY_REPLY = 'AI Astra cannot help with that.';
const SELF_HARM_REPLY =
  "I'm really sorry you're going through this. I can't answer this one from a chart. If you might act on these thoughts or are in immediate danger, please contact your local emergency number now. In the US you can call or text 988, and in India you can call Tele-MANAS at 14416 or 1-800-891-4416. If you can, tell someone you trust how you feel right now. When you feel ready, I'm glad to talk through your chart with you.";

const T = (t: Omit<DeclinedTopic, 'phrases' | 'words' | 'allowedRoles' | 'enabled'> & Partial<Pick<DeclinedTopic, 'phrases' | 'words' | 'allowedRoles'>>): DeclinedTopic => ({
  phrases: [],
  words: [],
  allowedRoles: [],
  enabled: true,
  ...t,
});

/** Built-in topics, in the order they are checked (deny first). */
export const BUILTIN_TOPICS: DeclinedTopic[] = [
  // ---- deny ----
  T({ id: 'self_harm', category: 'deny', label: 'Self-harm or suicide', reply: SELF_HARM_REPLY, sortOrder: 10, examples: ['I want to end my life', 'Should I kill myself?'] }),
  T({ id: 'violence_harm', category: 'deny', label: 'Killing, hurting, attacking or harming people or animals', reply: DENY_REPLY, sortOrder: 20, examples: ['How can I kill someone?', 'When is a good time to hurt my neighbour?', 'Will I get away with beating him?', 'How do I poison someone?'] }),
  T({ id: 'curses_black_magic', category: 'deny', label: 'Curses, black magic or spells to control or harm someone', reply: DENY_REPLY, sortOrder: 30, examples: ['How can I curse my ex?', 'Do vashikaran on my boss', 'Has someone done black magic on me?'] }),
  T({ id: 'crime', category: 'deny', label: 'Crime: theft, fraud, drugs, hacking, evading police', reply: DENY_REPLY, sortOrder: 40, examples: ['When is a good time to rob a bank?', 'Will I get caught selling drugs?', 'Can I evade the police?'] }),
  T({ id: 'abuse_stalking', category: 'deny', label: 'Stalking, harassment, abuse or controlling someone', reply: DENY_REPLY, sortOrder: 50, examples: ['How can I track my ex without her knowing?', 'How do I make her obey me?'] }),
  T({ id: 'extremism', category: 'deny', label: 'Terrorism, extremism, weapons or explosives', reply: DENY_REPLY, sortOrder: 60, examples: ['When should we attack?', 'How do I make a bomb?'] }),
  T({ id: 'sexual_minors', category: 'deny', label: 'Sexual content involving minors', reply: DENY_REPLY, sortOrder: 70, examples: [] }),
  // ---- decline ----
  T({ id: 'death_lifespan', category: 'decline', label: 'Death, lifespan or longevity (anyone)', reply: 'AI Astra does not answer questions about death, lifespan or longevity, for you or anyone else.', sortOrder: 100, examples: ['When will I die?', 'How long will my father live?', 'What is my lifespan?', 'Will my mother die this year?', 'Is there a maraka period for me?'] }),
  T({ id: 'minors', category: 'decline', label: 'Children under 18 (anything about a minor)', reply: 'AI Astra does not answer questions about children under 18.', sortOrder: 115, examples: ['Will my 12 year old do well in school?', 'Is my teenager going through a bad phase?', 'Which stream should my daughter take after class 10?', 'How is my baby doing?', 'Will my 13 year old daughter get married soon?'] }),
  T({ id: 'baby_sex', category: 'decline', label: "Predicting or choosing a baby's sex", reply: "AI Astra does not predict or help choose a baby's sex.", sortOrder: 110, examples: ['Will my baby be a boy or a girl?', 'How can I conceive a son?'] }),
  T({ id: 'child_age_unconfirmed', category: 'decline', label: "A question about the person's own child whose age (18+) is not confirmed", reply: 'AI Astra answers questions about your children only when they are 18 or older. If your child is 18 or older, please include their age, for example "my 25-year-old daughter".', sortOrder: 116, examples: ['Will my daughter get married soon?', "Will my son's business grow?", 'How is my son doing?', 'Will my son clear his exams?', 'How will my kids do in the coming years?'] }),
  T({ id: 'third_party_surveillance', category: 'decline', label: "Someone else's private actions (cheating, lying)", reply: "AI Astra does not answer questions about someone else's private actions, such as whether a partner is cheating.", sortOrder: 120, examples: ['Is my wife cheating on me?', 'Is my husband having an affair?'] }),
  T({ id: 'gambling_markets', category: 'decline', label: 'Lottery or betting numbers, stock or crypto picks', reply: 'AI Astra does not give lottery or betting numbers, or say which stock, coin or bet to pick.', sortOrder: 130, examples: ['Give me the lottery numbers for tomorrow', 'Which stock should I buy?', 'Which crypto will go up?'] }),
  T({ id: 'public_events', category: 'decline', label: 'Elections, disasters, wars or market crashes', reply: 'AI Astra reads your own chart. It does not forecast elections, disasters, wars or market moves.', sortOrder: 140, examples: ['Who will win the election?', 'Will there be an earthquake this year?', 'Will the stock market crash?'] }),
  T({ id: 'exact_amount', category: 'decline', label: 'Exact amounts of money', reply: 'AI Astra does not predict amounts of money. You can ask when income or savings are likely to grow instead.', sortOrder: 150, examples: ['How much money will I earn next year?', 'How many lakhs will I make?'] }),
  T({ id: 'remedies', category: 'decline', label: 'Remedies: gemstones, mantras, pujas, rituals', reply: 'AI Astra does not recommend remedies such as gemstones, mantras, pujas or rituals.', sortOrder: 160, examples: ['Which gemstone should I wear?', 'What puja should I do for marriage?'] }),
  T({ id: 'legal_advice', category: 'decline', label: 'Legal advice', reply: 'AI Astra does not give legal advice. Please talk to a lawyer. You can still ask about timing in your chart for a legal matter.', sortOrder: 170, examples: ['Should I sign this contract?', 'Should I sue my employer?'] }),
  // ---- role-gated ----
  T({ id: 'health', category: 'role_gated', label: 'Illness, disease, diagnosis, accidents, injuries, surgery or recovery', reply: 'AI Astra does not answer questions about illness, disease, diagnosis, accidents or injuries.', sortOrder: 200, examples: ['Do I have cancer?', 'Will my surgery go well?', 'When will my health improve?', 'Will I have an accident this year?'] }),
].sort((a, b) => a.sortOrder - b.sortOrder);

// ---- detectors (the code floor; database phrases and words add to these) ----------------------------------

interface Txt {
  p: string;
  tokens: string[];
}
const has = (t: Txt, phrase: string): boolean => t.p.includes(` ${phrase} `);
const anyOf = (t: Txt, phrases: string[]): boolean => phrases.some((x) => has(t, x));
const PEOPLE = ['i', 'he', 'she', 'they', 'my', 'me', 'father', 'mother', 'dad', 'mom', 'husband', 'wife', 'son', 'daughter', 'brother', 'sister', 'parents', 'grandfather', 'grandmother', 'partner', 'friend', 'someone', 'boss'];

const HARM_VERBS = new Set(['kill', 'killing', 'murder', 'murdering', 'stab', 'shoot', 'poison', 'strangle', 'beat', 'beating', 'attack', 'assault', 'hurt', 'harm', 'injure', 'torture', 'kidnap', 'abduct', 'rape', 'maim']);
const HARM_TARGET_WORDS = new Set(['him', 'her', 'them', 'someone', 'somebody', 'anyone', 'people', 'person', 'neighbour', 'neighbor', 'boss', 'ex', 'wife', 'husband', 'father', 'mother', 'brother', 'sister', 'son', 'daughter', 'child', 'kids', 'enemy', 'enemies', 'rival', 'colleague', 'friend', 'family', 'animal', 'animals', 'dog', 'cat', 'man', 'woman', 'girl', 'boy']);
/** "Will Saturn harm my career?" is an astrology question: a planet, period or transit as the subject is not violence */
const ASTRO_SUBJECTS = new Set(['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu', 'shani', 'mangal', 'guru', 'transit', 'dasha', 'mahadasha', 'antardasha', 'period', 'planet', 'planets', 'sade', 'sati', 'this', 'it', 'that', 'chart']);

const DETECT: Record<string, (t: Txt) => boolean> = {
  self_harm: (t) => anyOf(t, ['suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'hurt myself', 'take my own life', 'better off dead', 'cut myself', 'harm myself']),
  violence_harm: (t) => {
    if (anyOf(t, ['get away with', 'hire a hitman', 'hitman', 'make him suffer', 'make her suffer', 'beat him up', 'beat her up', 'acid attack', 'honour killing', 'honor killing'])) return true;
    // a harm verb with a target nearby ("kill my boss", "hurt someone"), not idioms like "kill time"
    return t.tokens.some((w, i) => HARM_VERBS.has(w) && t.tokens.slice(i + 1, i + 4).some((x) => HARM_TARGET_WORDS.has(x)) && !['time', 'it'].includes(t.tokens[i + 1] ?? '') && !t.tokens.slice(Math.max(0, i - 3), i).some((x) => ASTRO_SUBJECTS.has(x)));
  },
  curses_black_magic: (t) => anyOf(t, ['black magic', 'kala jadu', 'vashikaran', 'curse my', 'curse him', 'curse her', 'curse them', 'put a curse', 'cast a spell on', 'spell on him', 'spell on her', 'hex on', 'jinx', 'tantrik', 'evil eye on', 'control his mind', 'control her mind']),
  crime: (t) => anyOf(t, ['rob a', 'robbery', 'steal from', 'stealing from', 'shoplift', 'sell drugs', 'selling drugs', 'smuggle', 'smuggling', 'launder money', 'money laundering', 'evade the police', 'escape the police', 'get caught', 'not get caught', 'commit fraud', 'scam people', 'hack into', 'hacking into', 'forge documents', 'evade tax', 'tax evasion', 'bribe the', 'blackmail']),
  abuse_stalking: (t) => anyOf(t, ['track my ex', 'track her', 'track him', 'without her knowing', 'without him knowing', 'spy on', 'stalk', 'stalking', 'make her obey', 'make him obey', 'force her to', 'force him to', 'control my wife', 'control my husband', 'harass', 'harassing', 'threaten her', 'threaten him']),
  extremism: (t) => anyOf(t, ['make a bomb', 'build a bomb', 'explosive', 'explosives', 'terror attack', 'terrorist', 'jihad', 'mass shooting', 'when should we attack', 'buy a gun to', 'get a weapon to']),
  sexual_minors: (t) => (t.tokens.some((w) => ['child', 'minor', 'underage', 'kid', 'teen', 'teenager', 'schoolgirl', 'schoolboy'].includes(w)) && t.tokens.some((w) => ['sex', 'sexual', 'nude', 'nudes', 'porn', 'explicit', 'seduce'].includes(w))),
  death_lifespan: (t) => {
    if (anyOf(t, ['lifespan', 'life span', 'longevity', 'life expectancy', 'date of death', 'time of death', 'age of death', 'my death', 'his death', 'her death', 'death of my', 'maraka', 'markesh', 'how long will i live', 'how many years will i live', 'how long do i have', 'early death', 'untimely death', 'will i survive', 'will he survive', 'will she survive', 'death yoga', 'mrityu', 'ayurdaya'])) return true;
    if (has(t, 'how long will') && t.tokens.includes('live')) return true;
    for (let i = 0; i < t.tokens.length; i++) {
      const w = t.tokens[i]!;
      if (w !== 'die' && w !== 'dies' && w !== 'dying' && w !== 'death' && !(w === 'pass' && t.tokens[i + 1] === 'away')) continue;
      const before = t.tokens.slice(Math.max(0, i - 6), i);
      if (['will', 'when', 'going', 'chance', 'risk', 'predict', 'could', 'might'].some((x) => before.includes(x)) && (before.some((x) => PEOPLE.includes(x)) || before.includes('when') || before.includes('will'))) return true;
    }
    return false;
  },
  minors: (t) => isAboutMinor(t),
  child_age_unconfirmed: (t) => childAgeStatus(t.p.trim()) === 'unconfirmed',
  baby_sex: (t) => anyOf(t, ['boy or a girl', 'boy or girl', 'girl or a boy', 'girl or boy', 'conceive a son', 'conceive a boy', 'conceive a girl', 'baby gender', 'gender of my baby', 'gender of the baby', 'sex of my baby', 'sex of the baby', 'pregnancy a boy', 'pregnancy a girl', 'will it be a boy', 'will it be a girl']),
  third_party_surveillance: (t) => anyOf(t, ['is my wife cheating', 'is my husband cheating', 'is my partner cheating', 'is my girlfriend cheating', 'is my boyfriend cheating', 'cheating on me', 'having an affair', 'is my wife loyal', 'is my husband loyal', 'lying to me', 'secret relationship']),
  gambling_markets: (t) => anyOf(t, ['lottery number', 'lottery numbers', 'winning number', 'winning numbers', 'jackpot number', 'which number will win', 'which stock', 'which stocks', 'which share', 'which shares', 'which crypto', 'which coin', 'which team will win', 'who will win the match', 'betting tip', 'betting tips', 'satta', 'matka', 'which horse']),
  public_events: (t) => anyOf(t, ['who will win the election', 'election result', 'election results', 'next prime minister', 'next president', 'earthquake', 'tsunami', 'world war', 'will there be a war', 'stock market crash', 'market crash', 'sensex', 'nifty']),
  exact_amount: (t) => anyOf(t, ['how much money', 'how many lakhs', 'how many crores', 'how many lakh', 'how many crore', 'how many dollars', 'exact amount', 'how much will i earn', 'what salary will i', 'how much salary', 'how much will i inherit', 'how much profit will']),
  remedies: (t) => anyOf(t, ['gemstone', 'gem stone', 'which stone should i wear', 'which ratna', 'rudraksha', 'which mantra', 'mantra to', 'which puja', 'what puja', 'puja for', 'pooja for', 'remedy', 'remedies', 'upay', 'upaya', 'totka', 'yantra', 'donate to fix', 'ritual to']),
  legal_advice: (t) => anyOf(t, ['should i sign this contract', 'should i sue', 'should i file a case', 'should i plead', 'plead guilty', 'should i settle the case', 'legal advice', 'is this legal']),
  health: (t) => isHealthQuestion(t),
};

const MINOR_WORDS = new Set(['teen', 'teens', 'teenager', 'teenagers', 'toddler', 'toddlers', 'infant', 'infants', 'newborn', 'kindergarten', 'preschool', 'nursery', 'underage', 'minor', 'schoolgirl', 'schoolboy']);
const OWN_CHILD = new Set(['son', 'sons', 'daughter', 'daughters', 'child', 'childs', 'children', 'childrens', 'kid', 'kids', 'baby', 'babys']);
/** Ages stated in the question ("my 12 year old", "aged 25", "she is 13"), in years. */
function statedAges(toks: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < toks.length; i++) {
    if (!/^\d{1,3}$/.test(toks[i]!)) continue;
    const n = Number(toks[i]);
    const next = toks[i + 1];
    const prev = toks[i - 1];
    // an age, not a period: "12 years old", "12 yo", "aged 12", "is 12", "turning 12" ("in the next 2 years" is a period)
    const yearsOld = (next === 'year' || next === 'years' || next === 'yr' || next === 'yrs') && toks[i + 2] === 'old';
    if (yearsOld || next === 'yo' || prev === 'aged' || prev === 'age' || ((prev === 'is' || prev === 'turned' || prev === 'turning') && i >= 2)) out.push(n);
  }
  return out;
}

/** "my son", "our daughter", "my kids": the question is about the person's own child. */
function ownChildRef(toks: string[]): boolean {
  return toks.some((w, i) => OWN_CHILD.has(w) && (toks[i - 1] === 'my' || toks[i - 1] === 'our' || (/^\d{1,3}$/.test(toks[i - 1] ?? '') && (toks[i - 2] === 'my' || toks[i - 2] === 'our'))));
}

export type ChildAge = 'minor' | 'adult_stated' | 'unconfirmed' | 'none';

/**
 * Age status of a child the question is about. A stated age under 18 or child-stage words (teen, toddler, school,
 * class 10, board exams) is `minor`. A stated age of 18 or more is `adult_stated`. Any other question about the
 * person's own child is `unconfirmed`: words like "marriage" or "job" do not prove age (Sachin, 2026-10-25), so the
 * age must be confirmed before anything is read. Having a child ("when will we have a child?") is `none`.
 */
export function childAgeStatus(question: string): ChildAge {
  const norm = normalize(question);
  const toks = norm.split(' ').filter(Boolean);
  const t: Txt = { p: ` ${norm} `, tokens: toks };
  const ages = statedAges(toks);
  if (ages.some((n) => n < 18)) return 'minor';
  if (toks.some((w) => MINOR_WORDS.has(w))) return 'minor';
  if (anyOf(t, ['board exam', 'board exams', 'high school', 'middle school', 'primary school', 'class 10', 'class 12', '10th board', '12th board', 'grade school'])) return 'minor';
  const own = ownChildRef(toks);
  if (own && (toks.includes('school') || toks.includes('class') || toks.includes('grade'))) return 'minor';
  // "my baby" / "our baby" is an infant
  if (toks.some((w, i) => (w === 'baby' || w === 'babys') && (toks[i - 1] === 'my' || toks[i - 1] === 'our'))) return 'minor';
  if (ages.some((n) => n >= 18) && (own || toks.some((w) => OWN_CHILD.has(w)))) return 'adult_stated';
  return own ? 'unconfirmed' : 'none';
}

function isAboutMinor(t: Txt): boolean {
  return childAgeStatus(t.p.trim()) === 'minor';
}

const HEALTH_WORDS = new Set(['health', 'healthy', 'unhealthy', 'illness', 'illnesses', 'ill', 'sick', 'sickness', 'disease', 'diseases', 'diagnosis', 'diagnose',
  'diagnosed', 'surgery', 'surgeries', 'hospital', 'hospitalised', 'hospitalized', 'injury', 'injuries', 'injured', 'accident', 'accidents', 'cancer', 'diabetes',
  'tumor', 'tumour', 'covid', 'infection', 'medication', 'medications', 'chemo', 'chemotherapy', 'symptoms', 'symptom', 'chronic', 'fever', 'miscarriage',
  'fracture', 'stroke', 'thyroid', 'asthma', 'arthritis', 'depression', 'disorder']);
const HEALTH_PHRASES = ['heart attack', 'blood pressure', 'mental health', 'medical treatment', 'cancer treatment', 'take medicine', 'my medicine', 'my medicines',
  'recover from my illness', 'recover from illness', 'recover from surgery', 'kidney', 'liver problem', 'my operation', 'the operation', 'an operation', 'operation go'];
/** "financial health", "health of my business" are about money and work, not the body */
const NOT_BODY_BEFORE = new Set(['financial', 'business', 'company', 'relationship', 'economic', 'career']);

function isHealthQuestion(t: Txt): boolean {
  if (anyOf(t, HEALTH_PHRASES)) return true;
  return t.tokens.some((w, i) => {
    if (!HEALTH_WORDS.has(w)) return false;
    if (w === 'health' && (NOT_BODY_BEFORE.has(t.tokens[i - 1] ?? '') || (t.tokens[i + 1] === 'of' && ['business', 'company', 'relationship', 'marriage', 'finances'].includes(t.tokens[i + 3] ?? t.tokens[i + 2] ?? '')))) return false;
    return true;
  });
}

function matchesTopic(topic: DeclinedTopic, t: Txt): boolean {
  const builtin = DETECT[topic.id];
  if (builtin && builtin(t)) return true;
  if (topic.phrases.some((x) => x.trim() && has(t, normalize(x)))) return true;
  return topic.words.some((w) => w.trim() && t.tokens.includes(w.trim().toLowerCase()));
}

// ---- topics from the database (cached) --------------------------------------------------------------------

let cache: { at: number; topics: DeclinedTopic[] } | null = null;
const CACHE_MS = 5 * 60_000;

export function clearDeclinedTopicsCache(): void {
  cache = null;
}

interface DbRow {
  id: string;
  category: string;
  label: string;
  reply: string;
  phrases: unknown;
  words: unknown;
  allowed_roles: string[];
  enabled: boolean;
  sort_order: number;
}

/** Built-ins with the database rows applied on top. Deny topics cannot be disabled or downgraded from the database. */
export function mergeTopics(rows: DbRow[]): DeclinedTopic[] {
  const byId = new Map(BUILTIN_TOPICS.map((t) => [t.id, { ...t }]));
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  for (const r of rows) {
    const base = byId.get(r.id);
    const category = (['deny', 'decline', 'role_gated'] as const).includes(r.category as DeclineCategory) ? (r.category as DeclineCategory) : 'decline';
    const merged: DeclinedTopic = {
      id: r.id,
      category: base?.category === 'deny' ? 'deny' : category,
      label: r.label || base?.label || r.id,
      reply: r.reply || base?.reply || DENY_REPLY,
      phrases: [...new Set([...(base?.phrases ?? []), ...strArr(r.phrases)])],
      words: [...new Set([...(base?.words ?? []), ...strArr(r.words)])],
      allowedRoles: r.allowed_roles?.length ? r.allowed_roles : base?.allowedRoles ?? [],
      enabled: base?.category === 'deny' ? true : r.enabled,
      sortOrder: r.sort_order ?? base?.sortOrder ?? 500,
      examples: base?.examples ?? [],
    };
    byId.set(r.id, merged);
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Topics in check order. Falls back to the built-ins when the table is missing or the database is unreachable. */
export async function loadDeclinedTopics(prisma: PrismaClient | null): Promise<DeclinedTopic[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.topics;
  let topics = BUILTIN_TOPICS;
  if (prisma) {
    try {
      const rows = (await prisma.declinedTopic.findMany()) as unknown as DbRow[];
      topics = mergeTopics(rows);
    } catch (err) {
      console.warn(JSON.stringify({ msg: 'declined_topics unavailable; using built-in list', error: (err as Error).message.slice(0, 200) }));
    }
  }
  cache = { at: Date.now(), topics };
  return topics;
}

export interface DeclineOptions {
  /** Role of the asking user (auth.role); opens role_gated topics the role is allowed */
  role?: string | null;
  /** Topics to check (default: the built-ins); pass the result of loadDeclinedTopics() */
  topics?: DeclinedTopic[];
  /** The clarifier confirmed the child is 18 or older: the age-unconfirmed topic no longer applies */
  childAgeConfirmed?: boolean;
}

function roleAllowed(topic: DeclinedTopic, role: string | null | undefined): boolean {
  if (topic.category !== 'role_gated') return false;
  if (topic.allowedRoles.length) return topic.allowedRoles.map((r) => canonicalRole(r)).includes(canonicalRole(role));
  return roleCan(role, 'discuss_health');
}

/** First matching topic in check order, ignoring roles. */
export function detectTopic(question: string, topics: DeclinedTopic[] = BUILTIN_TOPICS, skip: string[] = []): DeclinedTopic | null {
  const norm = normalize(question);
  const t: Txt = { p: ` ${norm} `, tokens: norm.split(' ').filter(Boolean) };
  for (const topic of topics) if (topic.enabled && !skip.includes(topic.id) && matchesTopic(topic, t)) return topic;
  return null;
}

/** The topic that stops this question for this user, or null when it can be answered. */
export function detectDeclined(question: string, opts: DeclineOptions = {}): DeclinedTopic | null {
  const topic = detectTopic(question, opts.topics, opts.childAgeConfirmed ? ['child_age_unconfirmed'] : []);
  if (topic && roleAllowed(topic, opts.role)) return null;
  return topic;
}

/** What is stored for a declined message: deny topics never keep the text. */
export function storedQuestion(question: string, topic: DeclinedTopic | null): string {
  return topic?.category === 'deny' ? `[withheld: ${topic.id}]` : question;
}

// ---- entry-point helper -------------------------------------------------------------------------------------

const roleCache = new Map<string, { at: number; role: string | null }>();

async function roleOf(prisma: PrismaClient, userId: string): Promise<string | null> {
  const hit = roleCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.role;
  const row = await prisma.auth.findUnique({ where: { id: userId }, select: { role: true } });
  roleCache.set(userId, { at: Date.now(), role: row?.role ?? null });
  return row?.role ?? null;
}

/**
 * The gate every entry point calls first. Uses the cached database list (or the built-in floor while it loads, so
 * the first question never waits), and looks up the user's role only when a role-gated topic matched.
 */
export async function declinedFor(prisma: PrismaClient, userId: string, question: string, opts: { childAgeConfirmed?: boolean } = {}): Promise<DeclinedTopic | null> {
  const topics = cache && Date.now() - cache.at < CACHE_MS ? cache.topics : (void loadDeclinedTopics(prisma).catch(() => undefined), cache?.topics ?? BUILTIN_TOPICS);
  const topic = detectTopic(question, topics, opts.childAgeConfirmed ? ['child_age_unconfirmed'] : []);
  if (!topic) return null;
  if (topic.category !== 'role_gated') return topic;
  const role = await roleOf(prisma, userId).catch(() => null);
  return roleAllowed(topic, role) ? null : topic;
}
