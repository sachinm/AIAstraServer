/**
 * Part 1 of the comprehensive life reading, the Executive Dashboard (docs/reading-engine/34 §5 Part 1; contract doc 54
 * §4): the rule for the current sub-period and one row per active life area with the five columns: the issue (what is
 * wrong right now), the cause (planets, periods, a plain sentence), when it improves (the best three dated windows), and
 * the solution (practical actions first, then dates to act and to hold, then traditional support from the chart's own
 * benefics).
 *
 * Composed by code from template sentences; no model. Words follow doc 45 §3.3: chart terms appear only in
 * cause.planets, cause.dashas, the improves windows' md/ad/systems and the evidence ids. An area with no pressure now
 * and nothing dated is not shown (AGENTS.md: specific to the person or not shown). Every pressure is put to the person
 * as one plain question before anything is predicted from it (AGENTS.md rule 2), worded from their own stored facts
 * (rule 3). Never medical, legal or financial advice.
 */
import type { ActivationRow } from '../digest/activation.js';
import type { AnnualRow, DigestView } from '../digest/types.js';
import { LIFE_AREAS, type LifeArea, type LifeAreaId } from './areas.js';
import {
  buildMahadashaCharter,
  type LifeAntardashaAreaNote,
  type LifeAntardashaRow,
  type LifeAntardashaTone,
  type LifeAreaCharter,
  type LifeCharterRole,
  type LifeMahadashaBridge,
  type LifeMahadashaCharter,
} from './charter.js';
import { functionalSide, planetName, planetSide } from './labels.js';
import type { AreaPromise, ScaleLine, Verdict } from './promise.js';
import { runningOf } from './promise.js';
import type { SkyView } from './sky.js';
import type { AreaTiming, Grade, TimingWindow } from './timing.js';

export type {
  LifeAntardashaAreaNote,
  LifeAntardashaRow,
  LifeAntardashaTone,
  LifeAreaCharter,
  LifeCharterRole,
  LifeMahadashaBridge,
  LifeMahadashaCharter,
};
export { buildMahadashaCharter };

export interface LifeAreaRow {
  id: LifeAreaId;
  label: string;
  verdict: Verdict;
  score: number;
  issue: string;
  cause: { planets: string[]; dashas: string[]; text: string };
  improves: Array<{ from: string; to: string; md: string | null; ad: string | null; systems: string[]; grade: Grade; basis: string }>;
  solution: string[];
  grade: Grade;
  basis: string;
  /** digest keys behind the row (scale lines and windows) */
  evidence: string[];
}

export interface LifeDashboard {
  rule_now: string | null;
  areas: LifeAreaRow[];
  charter: LifeMahadashaCharter | null;
}

export interface ComposeArea {
  area: LifeArea;
  promise: AreaPromise;
  timing: AreaTiming;
}

/** The person's own stored facts (src/profile/facts.ts keys) that change the words. */
export type PersonFacts = Partial<Record<'work.status' | 'love.status' | 'family.children', string>>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "7 Feb 2027" */
export const longDate = (iso: string): string => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const SYSTEM_WORDS: Record<string, string> = {
  vimshottari: 'Vimshottari',
  yogini: 'Yogini',
  tithi_ashtottari: 'Tithi Ashtottari',
  narayana: 'Narayana',
  chara: 'Chara',
  sudasa: 'Sudasa',
  dwisaptati: 'Dwisaptati',
  dwisatpathi: 'Dwisaptati',
  ashtottari: 'Ashtottari',
};
export const systemName = (s: string): string => SYSTEM_WORDS[s.toLowerCase()] ?? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The one plain question that confirms a pressure before anything is predicted from it. */
export function confirmQuestion(id: LifeAreaId, facts: PersonFacts): string {
  const work = facts['work.status'];
  const love = facts['love.status'];
  const kids = facts['family.children'];
  switch (id) {
    case 'self':
      return 'Have you felt low on energy or unsure of your direction lately?';
    case 'money':
      return 'Has money felt tighter than usual lately?';
    case 'work':
      if (work === 'between_jobs') return 'Has the search for work felt slow?';
      if (work === 'own_business') return 'Has the business felt harder to move lately?';
      if (work === 'studying') return 'Have your studies felt heavier lately?';
      if (work === 'retired') return 'Has the way you spend your days felt unsettled lately?';
      if (work === 'yes') return 'Has work felt harder to move lately?';
      return 'Has work, or finding work, felt harder lately?';
    case 'home':
      return 'Has something about where you live felt unsettled?';
    case 'marriage':
      if (love === 'single') return 'Has meeting someone felt slow?';
      if (love === 'dating') return 'Has the relationship felt unsettled lately?';
      if (love === 'committed' || love === 'married') return 'Has there been strain between you and your partner?';
      if (love === 'separated' || love === 'complicated') return 'Has the situation with your partner weighed on you lately?';
      return 'Has something shifted in a relationship?';
    case 'children':
      if (kids === 'none') return 'If you are hoping for children, has it felt slow?';
      if (kids === 'young' || kids === 'grown' || kids === 'expecting') return 'Has there been more to carry with the children lately?';
      return 'Is anything about children on your mind?';
    case 'parents':
      return 'Has a parent needed more of your time or care lately?';
    case 'siblings':
      return 'Has something come up with a brother or sister?';
    case 'legal':
      return 'Is a dispute, an official matter or paperwork weighing on you?';
    case 'health':
      return 'Have you felt more tired or run down than usual?';
    case 'travel':
      return 'Have you moved, or are you planning to?';
    case 'learning':
      return 'Has study or a new skill felt slow to sink in?';
    case 'dharma':
      return 'Have you been questioning what matters most to you?';
  }
}

/** Practical first steps per area. Never medical, legal or financial advice: those point to a qualified professional. */
const PRACTICAL: Record<LifeAreaId, string[]> = {
  self: ['Keep one small daily routine you do not skip: the same waking time, a walk, ten quiet minutes.', 'Write down the one direction that matters most this year and say no to two things that pull you off it.'],
  money: ['Keep a simple monthly record of what comes in and what goes out.', 'Clear small dues first and keep a cushion before any large spend; take investment questions to a qualified adviser.'],
  work: ['Keep a running list of what you delivered, with dates and names, so it is ready when you need it.', 'Put agreements in writing: scope, fee and dates, before work starts.'],
  home: ['Fix the small things at home that you have been putting off; keep papers for the home in one place.', 'Read any lease or purchase papers twice and take them to a qualified professional before you sign.'],
  marriage: ['Raise money and plans with your partner when you are both rested, not in the middle of a hard day.', 'Keep promises small and kept; one honest conversation a week does more than one big one.'],
  children: ['Keep regular one-to-one time with each child, even if short.', 'If you are planning a family, plan the practical side together first: time, space, support.'],
  parents: ['Call or visit on a fixed day each week.', 'Keep their important papers and contacts in one place that you can reach.'],
  siblings: ['Keep shared money and favours in writing, kindly and clearly.', 'Reach out first on one small thing; let a big topic wait for a calm moment.'],
  legal: ['Keep a written, dated record of every exchange and keep copies.', 'Take legal or official questions to a qualified professional before you reply or sign.'],
  health: ['Keep steady sleep and meal times, and move a little every day.', 'Take any health concern to a qualified professional; this reading does not replace care.'],
  travel: ['Keep documents and bookings in order early, with copies.', 'Plan moves in steps: visit, decide, then commit.'],
  learning: ['Study in short daily blocks rather than long weekly ones.', 'Pick one course or skill and finish it before starting the next.'],
  dharma: ['Keep a few quiet minutes each day for reflection or prayer, in your own tradition.', 'Give some time each month to a cause you believe in.'],
};

/** Traditional support from the chart's own benefics (doc 34 §1 q6): a day and a small gesture, never a planet name. */
const GESTURE: Record<string, string> = {
  Su: 'a few quiet minutes at sunrise on Sundays, and respect shown to your father and elders',
  Mo: 'on Mondays, give water or food to someone who needs it, and keep in touch with your mother',
  Ma: 'on Tuesdays, do something physical and help a brother or a friend with a task',
  Me: 'on Wednesdays, give books or stationery to a student',
  Ju: 'on Thursdays, give to a teacher or a place of learning',
  Ve: 'on Fridays, give something sweet or beautiful to someone, and keep your space clean and pleasant',
  Sa: 'on Saturdays, help an older person or a worker without being asked',
};

/** The chart's own functional benefics, strongest first (the engine's shadbala rank). */
export function chartBenefics(view: DigestView): string[] {
  return view
    .planets('D1')
    .filter((p) => functionalSide(p.functional) === 'support' && GESTURE[p.planet])
    .sort((a, b) => (a.shadbalaRank ?? 99) - (b.shadbalaRank ?? 99))
    .map((p) => p.planet);
}

const heaviest = (lines: ScaleLine[], pred: (l: ScaleLine) => boolean): ScaleLine | null => lines.filter(pred).sort((a, b) => b.weight - a.weight)[0] ?? null;

function dashaLabel(row: ActivationRow): string {
  const parts = [row.parentLord ? planetName(row.parentLord) : null, row.lord ? planetName(row.lord) : row.sign].filter((p): p is string => !!p);
  return `${systemName(row.system)} ${parts.join('–')} (to ${longDate(row.to)})`;
}

function windowView(w: TimingWindow) {
  return { from: w.from, to: w.to, md: w.md ? planetName(w.md) : null, ad: w.ad ? planetName(w.ad) : null, systems: w.systems.map(systemName), grade: w.grade, basis: w.basis };
}

export function composeArea(view: DigestView, x: ComposeArea, running: ActivationRow[], facts: PersonFacts): LifeAreaRow | null {
  const { area, promise, timing } = x;
  const nowTest = heaviest(promise.lines, (l) => (l.layer === 'dasha' || l.layer === 'transit') && l.side === 'test');
  const natalTest = promise.verdict !== 'promised' && promise.withholding.length > 0;
  if (!nowTest && !timing.improves.length) return null; // nothing now and nothing dated: not shown

  // the issue: the strongest current pressure, put as a question
  let issue: string;
  if (nowTest?.layer === 'transit') issue = `A slow-moving influence is pressing on ${area.words}${nowTest.until ? ` until ${longDate(nowTest.until)}` : ''}. ${confirmQuestion(area.id, facts)}`;
  else if (nowTest) issue = `Your current chapter is testing ${area.words}${nowTest.until ? ` until ${longDate(nowTest.until)}` : ''}. ${confirmQuestion(area.id, facts)}`;
  else if (natalTest) issue = `No sharp pressure on ${area.words} right now, though this part of life has tended to ask more effort than it gives back.`;
  else issue = `No sign of pressure on ${area.words} right now.`;

  // the cause: planets and periods (chart terms), then one plain sentence
  const touching = running.filter((r) => r.level <= 2 && r.houses?.some((h) => area.houses.includes(h)));
  const dashas = [...new Map(touching.map((r) => [`${r.system}/${r.level}`, r])).values()]
    .sort((a, b) => (a.family === 'vimshottari' ? -1 : b.family === 'vimshottari' ? 1 : 0) || b.level - a.level)
    .slice(0, 3)
    .map((r) => dashaLabel(r));
  const nowPlanets = promise.lines.filter((l) => (l.layer === 'dasha' || l.layer === 'transit') && l.side === 'test' && l.planet).map((l) => l.planet as string);
  const planets = [...new Set([...nowPlanets, ...promise.withholding, ...promise.helpers.slice(0, 1)])].slice(0, 4).map(planetName);
  const reasons: string[] = [];
  if (nowTest?.layer === 'dasha') reasons.push('the chapter you are in now leans against this part of life');
  if (nowTest?.layer === 'transit' || heaviest(promise.lines, (l) => l.layer === 'transit' && l.side === 'test')) reasons.push('a slow-moving influence sits on it');
  if (promise.withholding.length && promise.verdict !== 'promised') reasons.push('the influence that rules it has been placed weakly from birth');
  let text = reasons.length ? `Mostly because ${reasons.join(', and ')}.` : 'Your chart shows steady support here.';
  if (reasons.length && promise.helpers.length) text += ' Your chart also holds real support here, which is what the better dates draw on.';

  // the solution: practical first, then dates to act and to hold, then traditional support
  const solution = [...PRACTICAL[area.id]];
  if (nowTest?.until) solution.push(`Hold big, hard-to-undo moves on ${area.words} until ${longDate(nowTest.until)}; use the time to prepare.`);
  const best = [...timing.improves].sort((a, b) => b.score - a.score)[0];
  if (best) solution.push(`Act between ${longDate(best.from)} and ${longDate(best.to)}: what you prepare now is used then.`);
  else if (timing.possibility) solution.push(`A possible opening around ${timing.possibility.year}; not yet backed by enough of your chart to plan on.`);
  const benefic = chartBenefics(view)[0];
  if (benefic) solution.push(`Traditional support from your chart's own helpful influences: ${GESTURE[benefic]}.`);

  const grade: Grade = best?.grade ?? 'weak';
  const basis = best?.basis ?? (timing.possibility ? 'weak: only one system points to it, so it is written as a possibility' : 'weak: nothing in the next fifteen years is backed by two systems');
  const evidence = [
    ...promise.lines.filter((l) => l.side !== 'neutral').sort((a, b) => b.weight - a.weight).slice(0, 8).map((l) => l.fact),
    ...timing.improves.flatMap((w) => w.evidence),
  ];
  return {
    id: area.id,
    label: area.label,
    verdict: promise.verdict,
    score: promise.score,
    issue,
    cause: { planets, dashas, text },
    improves: timing.improves.map(windowView),
    solution,
    grade,
    basis,
    evidence: [...new Set(evidence)],
  };
}

/** The immediate rule for the current sub-period (doc 34 §5 Part 1), with what happens if it is broken (doc 34 §7.5). */
export function ruleNow(view: DigestView, running: ActivationRow[], today: string, rows: LifeAreaRow[]): string | null {
  const sub = runningOf(running, 'vimshottari', today);
  if (!sub) return null;
  const lord = sub.lord;
  const side = lord ? planetSide(view.planet('D1', lord)) : 'neutral';
  const next = rows
    .flatMap((r) => r.improves)
    .map((w) => w.from)
    .filter((d) => d >= sub.to)
    .sort()[0];
  const until = longDate(sub.to);
  if (side === 'test') {
    return `Until ${until}, hold off on big decisions that are hard to undo: signing, quitting, buying, ending. Use this stretch to prepare (records, plans, skills)${next ? ` so they are ready from ${longDate(next)}` : ''}. Rushing now tends to cost more to undo later.`;
  }
  return `Until ${until}, this is a stretch to act on what you have ready: ask, apply and finish what is half-done. Keep anything that is not ready for ${next ? longDate(next) : 'a later stretch'}.`;
}

export function composeDashboard(
  view: DigestView,
  areas: ComposeArea[],
  running: ActivationRow[],
  today: string,
  facts: PersonFacts,
  charterInput?: { rows?: ActivationRow[]; annual?: (year: number) => AnnualRow[]; sky?: SkyView | null },
): LifeDashboard {
  const order = new Map(LIFE_AREAS.map((a, i) => [a.id, i]));
  const rows = areas
    .map((a) => composeArea(view, a, running, facts))
    .filter((r): r is LifeAreaRow => r !== null)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const charter = buildMahadashaCharter(view, areas, {
    today,
    rows: charterInput?.rows ?? running,
    annual: charterInput?.annual ?? ((y) => view.annual(y)),
    sky: charterInput?.sky ?? null,
  });
  return { rule_now: ruleNow(view, running, today, rows), areas: rows, charter };
}
