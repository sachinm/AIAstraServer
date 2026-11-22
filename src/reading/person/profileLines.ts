/**
 * The person's stated facts as plain lines and the register rules they set, for every Personalizer (the v2 board's and
 * the card Personalizer). Moved unchanged from `self/v2/slices.ts` and `self/v2/profileFit.ts` (plan "retire the v2
 * Self reading", server step 1); the old paths re-export. Words and the person's own answers only.
 */
import { getSelfV2JuniorBands, getSelfV2SeniorStageBands, getSelfV2SeniorStageLevels, getSelfV2SeniorStageWords } from '../../config/env.js';
import type { PersonalizerInput } from '../self/v2types.js';

const escapeRe = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/**
 * The career-stage words this person may not be given ("seasoned", "mentorship", "advisory leadership"), or null when
 * their band or level allows them: a junior band never allows them; a senior band always does; otherwise a senior
 * `work.level` does. Env tables in src/config/env.ts (`SELF_V2_SENIOR_STAGE_*`, `SELF_V2_JUNIOR_BANDS`).
 */
export function seniorStageWordsFor(profile: Pick<PersonalizerInput['profile'], 'ageBand' | 'facts'> | undefined): RegExp | null {
  const band = profile?.ageBand ?? null;
  const level = profile?.facts?.work?.level?.trim().toLowerCase() ?? null;
  const junior = band !== null && getSelfV2JuniorBands().includes(band);
  const seniorBand = band !== null && getSelfV2SeniorStageBands().includes(band);
  const seniorLevel = level !== null && getSelfV2SeniorStageLevels().map((x) => x.toLowerCase()).includes(level);
  if (!junior && (seniorBand || seniorLevel)) return null;
  const words = getSelfV2SeniorStageWords();
  return words.length ? new RegExp(`\\b(${words.map(escapeRe).join('|')})\\b`, 'i') : null;
}


export const AGE_BAND_WORDS: Record<string, string> = {
  under_25: 'under 25',
  '25_35': '25 to 35',
  '36_45': '36 to 45',
  '46_60': '46 to 60',
  '60_plus': '60 and over',
};
export const WORK_WORDS: Record<string, string> = {
  yes: 'works (employed)',
  between_jobs: 'between jobs (no current job)',
  own_business: 'runs their own business',
  studying: 'studying (no job)',
  retired: 'retired (no current job)',
};
/** work statuses with no current job: the cards may not assume a workplace, a team, a boss or a role */
export const NO_JOB = new Set(['between_jobs', 'studying', 'retired']);

/**
 * Per age band (doc 66 §10, the persona table): what the person usually arrives with and the register. Selection and
 * wording only; the band comes from a typed birth date.
 */
export const BAND_REGISTER: Readonly<Record<string, string>> = {
  under_25:
    'usually arrives asking "is this normal, will it pass, who am I": study and focus, a first job and first money, friends, energy and how they look. Register: short, light, encouraging; no talk of standing, legacy or long careers.',
  '25_35':
    'usually arrives with a decision: a job switch, a partner, a move, first big money, a business being built. Register: practical, about windows to start or hold and the patterns that trip them up; no talk of seniority, mentoring others, advising or legacy.',
  '36_45':
    'usually arrives tired or stalled: load, a plateau, parenting if stated, strain at home. Register: what is heavy and since when, stamina and recovery, what this stretch is teaching; plain and steady.',
  '46_60':
    'usually arrives with timing: a hand-over, health habits, a property or legal matter, parents, what to consolidate rather than start. Register: consequence-led and direct, cost at work first, endurance; standing and what to hand on are fair words here.',
  '60_plus':
    'usually arrives with rest, meaning and the family around them: body and rest, what they are really after, the rhythm of the day. Register: unhurried, warm, short; no job words, no ambition words, no money targets.',
};

/** Per work status and level: what the examples on the cards may be about. */
export const WORK_EXAMPLES: Readonly<Record<string, string>> = {
  'yes:hourly': 'shifts, a manager, pay, a next step up; never a team they lead',
  'yes:employee': 'their own tasks, a manager, colleagues, a next role; never a team they lead or a company they run',
  'yes:specialist': 'their craft, the quality of their work, being relied on, a next role; never managing others',
  'yes:manager': 'their team, workload, the people above and below them, a next role',
  'yes:senior_leader': 'decisions, people they lead, hand-overs, what to consolidate, their standing',
  own_business: 'their business: customers, cash, building it, decisions they make alone; never a boss or a promotion',
  'own_business:owner_alone': 'a business they run alone: customers, cash, their own hours; never staff, a boss or a promotion',
  'own_business:owner_staff':
    'a business they run with staff: customers, cash, the people who work for them, building it; never a boss or a promotion',
  'own_business:several_businesses': 'several businesses: where to put attention and money, the people who run them',
  between_jobs: 'the search for work, skills, the people who can open a door; never a current workplace',
  studying: 'study, learning, exams, first steps and the people around them; never a workplace',
  retired:
    'their days now: rest, meaning, family, community, the projects they choose; never a job, a workplace, meetings, labor, assets to secure or money targets',
};

/**
 * The person's stated facts as plain lines and the register rules they set (doc 66 replay failure 5: a retired person
 * aged 60 and over got "executive responsibility" and "public pitches"; run 2 failure 2: a 25–35 founder got "seasoned
 * professional" and "mentorship"). Selection and wording only.
 */
export function profileLines(p: PersonalizerInput['profile']): string[] {
  const f = p.facts ?? {};
  const status = f.work?.status ?? null;
  const level = f.work?.level ?? null;
  const focus = f.focus ?? [];
  const L = [
    `age band: ${p.ageBand ? (AGE_BAND_WORDS[p.ageBand] ?? p.ageBand) : 'not known'}`,
    `gender: ${p.gender ?? 'not stated (use no gendered words at all)'}`,
    `reader: ${p.role}`,
    `work status: ${status ? (WORK_WORDS[status] ?? status) : 'not stated (assume nothing about work)'}`,
    `work level: ${level ?? 'not stated'}`,
    `love status: ${f.love ?? 'not stated (assume nothing about a partner)'}`,
    `children: ${f.children ?? 'not stated (assume nothing about children)'}`,
    `focus: ${focus.length ? focus.join(', ') : 'not stated'}`,
    ...(f.place ? [`place: ${f.place}`] : []),
    '## WHAT THESE FACTS FORBID AND REQUIRE',
  ];
  if (p.ageBand && BAND_REGISTER[p.ageBand]) L.push(`- Age band ${AGE_BAND_WORDS[p.ageBand]}: this person ${BAND_REGISTER[p.ageBand]}`);
  const examples = status ? (WORK_EXAMPLES[`${status}:${level ?? ''}`] ?? WORK_EXAMPLES[status] ?? null) : null;
  if (examples) L.push(`- Work examples may be about: ${examples}.`);
  if (status && NO_JOB.has(status)) {
    L.push(
      `- This person has no current job (${status.replace('_', ' ')}). Never write of a workplace, colleagues, a team, a boss, clients, pitches, meetings, labor, promotion, executive duties or professional timelines, unless the Oracle paragraph is explicitly about a past role (then say "in your past work"). Carry a career reading over to what this person does now: ${status === 'retired' ? 'meaning, mentoring, family, community, rest and the projects they choose' : status === 'studying' ? 'study, learning, first steps and the people around them' : 'the search for work, skills and the people who can open a door'}.`,
    );
  }
  if (seniorStageWordsFor(p)) {
    const stage = getSelfV2SeniorStageWords();
    L.push(
      `- Career stage: nothing this person told you says they are senior or late in a career. Never invent a stage: no ${stage
        .slice(0, 10)
        .map((x) => `"${x}"`)
        .join(', ')} or the like. Write for where they are now.`,
    );
  }
  if (!f.love) L.push('- No love status was given: never assume a partner, a marriage or a break-up.');
  else L.push(`- Love status is "${f.love}": where an Oracle paragraph speaks of partners or relationships, say it for someone ${f.love}.`);
  if (!f.children || f.children === 'none') L.push('- No children are stated: never mention a child of theirs.');
  if (focus.length) {
    L.push(
      `- Focus first: ${focus.join(' and ')} leads the hero, and is the lens of the Now group cards (Where you get stuck, This chapter) whenever the Oracle document has material for it: say what this stretch means for ${focus.join(' and ')} first, then the rest.`,
    );
  }
  return L;
}
