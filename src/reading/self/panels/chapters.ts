/**
 * `self.reading.chapters` — Your chapters (docs/reading-engine/58 §4.1). The spine of the reading: the previous, running
 * and next main period of the reading clock with their dates and the houses the engine's activation calendar says each
 * activates, the running sub-period, and each lord's D1 card. A chapter's sentence is shown only when confirming clocks
 * change their own main period near its start (date arithmetic only, `SELF_CHAPTER_BOUNDARY_MONTHS`); the antardasha
 * flavour is the engine's fruition class from the main lord's dasha charter.
 */
import { getSelfChapterBoundaryMonths, getSelfChapterConfirmMin } from '../../../config/env.js';
import type { ActivationRow } from '../../digest/activation.js';
import { clockLabel, FRUITION_WORDS, HOUSE_SHORT, housesShort, longDate, PLANET_FACULTY } from '../words.js';
import { activationKey, gaps, mainStarts, mdSpine } from '../slices.js';
import type { ChapterConfirmation, PanelBody, SelfChapter } from '../types.js';
import { body, cardDetail, pname, type PanelInput } from './common.js';

const ordinal = (n: number | null): string => n == null ? "?" : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

const monthsBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.abs((ay! - by!) * 12 + (am! - bm!) + (ad! - bd!) / 30.44);
};

export function confirmShift(rows: readonly ActivationRow[], start: string, confirming: ReadonlyArray<{ system: string; label: string }>): ChapterConfirmation[] {
  const limit = getSelfChapterBoundaryMonths();
  return confirming.map(({ system, label }) => {
    const starts = mainStarts(rows, system);
    let best: string | null = null;
    for (const s of starts) if (best === null || monthsBetween(s, start) < monthsBetween(best, start)) best = s;
    return { system, label, agrees: best !== null && monthsBetween(best, start) <= limit, boundary: best };
  });
}

export function certaintyOf(c: ChapterConfirmation[]): SelfChapter['certainty'] {
  const n = c.filter((x) => x.agrees).length;
  return n >= getSelfChapterConfirmMin() ? 'confirmed' : n >= 1 ? 'likely' : 'split';
}

export function chaptersPanel({ view, activation, asOf, clock }: PanelInput): PanelBody {
  const g = gaps();
  const spine = mdSpine(activation, clock.system, asOf);
  if (!spine.running) {
    g.add(`activation:${clock.system} level 1 covering ${asOf} missing`);
    return body('', [], g, { chapters: [] });
  }
  const who = (r: ActivationRow) => r.lord ?? r.sign ?? '?';
  const carried = (r: ActivationRow): { text: string; detail: string; evidence: string[] } => {
    if (!r.lord) return { text: '', detail: `sign period ${r.sign}`, evidence: [] };
    const c = view.planet('D1', r.lord);
    if (!c || c.house == null || !PLANET_FACULTY[r.lord]) { g.add(`planet:D1.${r.lord} missing`); return { text: '', detail: '', evidence: [] }; }
    return { text: ` It is carried by ${PLANET_FACULTY[r.lord]}, placed in ${HOUSE_SHORT[c.house]}.`, detail: cardDetail(c), evidence: [`planet:D1.${r.lord}`] };
  };
  const confirmDetail = (cs: ChapterConfirmation[]) => cs.map((c) => `${c.label} main period from ${c.boundary ?? '—'} ${c.agrees ? '✓' : '✗'}`).join('; ');

  const make = (kind: SelfChapter['kind'], r: ActivationRow): SelfChapter => {
    const conf = confirmShift(activation, r.from, clock.confirming);
    const certainty = certaintyOf(conf);
    const ch = carried(r);
    const houses = housesShort(r.houses);
    const base =
      kind === 'previous' ? `From ${longDate(r.from)} to ${longDate(r.to)} you were shaped by ${houses}.`
      : kind === 'running' ? `From ${longDate(r.from)} to ${longDate(r.to)} your life is organised around ${houses}.`
      : `From ${longDate(r.from)} you move into a chapter of ${houses}.`;
    return {
      kind,
      lord: who(r),
      lordLabel: r.lord ? pname(r.lord) : (r.sign ?? '?'),
      from: r.from,
      to: r.to,
      text: certainty === 'split' || !houses ? null : base + ch.text,
      detail: `${clock.label} level 1 ${r.lord ? pname(r.lord) : r.sign} ${r.from} → ${r.to}; activates houses ${r.houses.join(', ') || '—'}${ch.detail ? `; ${ch.detail}` : ''}; confirming: ${confirmDetail(conf) || 'none'}`,
      certainty,
      houses: r.houses,
      confirmations: conf,
      evidence: [activationKey(r), ...ch.evidence],
    };
  };

  const chapters: SelfChapter[] = [];
  if (spine.previous) chapters.push(make('previous', spine.previous));
  else g.add(`activation:${clock.system} previous level 1 missing`);
  const running = make('running', spine.running);
  const sub = spine.runningSub;
  if (sub?.lord) {
    const mdCard = spine.running.lord ? view.planet('D1', spine.running.lord) : null;
    const cell = mdCard?.dashaCharter?.fruition?.[sub.lord];
    const flavour = cell?.fruitionClass && FRUITION_WORDS[cell.fruitionClass] ? ` In this chapter ${FRUITION_WORDS[cell.fruitionClass]}${cell.isDwirdwadasha212 ? ', though what comes in also goes out' : cell.isShadAshtaka68 ? ', with friction between the two' : ''}.` : '';
    if (!cell) g.add(`planet:D1.${spine.running.lord}.dashaCharter.fruition.${sub.lord} missing`);
    running.sub = {
      lord: sub.lord,
      lordLabel: pname(sub.lord),
      from: sub.from,
      to: sub.to,
      text: `Since ${longDate(sub.from)} and until ${longDate(sub.to)}, what presses now is ${housesShort(sub.houses)}.${flavour}`,
      detail: `${clockLabel(clock.system)} level 2 ${pname(sub.lord)} ${sub.from} → ${sub.to}; activates houses ${sub.houses.join(', ')}${cell ? `; fruition from ${pname(spine.running.lord)}: ${ordinal(cell.houseFromMd)} from the main lord, ${cell.fruitionClass}${cell.isDwirdwadasha212 ? ', 2/12' : ''}${cell.isShadAshtaka68 ? ', 6/8' : ''}` : ''}`,
      houses: sub.houses,
    };
    running.evidence.push(activationKey(sub));
  } else g.add(`activation:${clock.system} level 2 covering ${asOf} missing`);
  if (spine.nextSub?.lord) running.nextSub = { lord: spine.nextSub.lord, lordLabel: pname(spine.nextSub.lord), from: spine.nextSub.from, to: spine.nextSub.to, houses: spine.nextSub.houses };
  chapters.push(running);
  if (spine.next) chapters.push(make('next', spine.next));
  else g.add(`activation:${clock.system} next level 1 missing`);

  const claims = chapters.map((c) => ({
    id: `chapters.${c.kind}`,
    text: c.text ?? `${longDate(c.from)} – ${longDate(c.to)}: your other clocks do not mark a turn here.`,
    detail: c.detail,
    certainty: c.certainty,
    evidence: c.evidence,
  }));
  if (running.sub) claims.splice(chapters.indexOf(running) + 1, 0, { id: 'chapters.sub', text: running.sub.text, detail: running.sub.detail, certainty: running.certainty, evidence: running.evidence.slice(-1) });
  const lead = `You are in the chapter of ${housesShort(spine.running.houses)}, until ${longDate(spine.running.to)}.`;
  return body(lead, claims, g, { chapters });
}
