/**
 * `board.purview` (Self instance `self.reading.purview`, docs/reading-engine/60 §4): the whole-chart check run over the
 * full digest and the reading clock after the panels and before the diagnosis and the cards. A panel reads a slice; a
 * chart is read whole. Each rule matches engine labels and joins keys only; it returns overrides, vetoes and
 * annotations. A vetoed claim is removed from the panel (kept under Chart details with its rule); an annotation is added
 * to the claim's detail.
 */
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import type { TransitRangePayload } from '../chartData/transitRange.js';
import { getSelfClockConditionalOrder } from '../../config/env.js';
import type { PanelBodies } from './panels/diagnosis.js';
import { struggleLead } from './panels/struggle.js';
import { yogasLead } from './panels/yogas.js';
import { activationKey, runningChain } from './slices.js';
import type { BoardPanelId, PurviewEntry, ReadingBoardId, SelfClock } from './types.js';
import { PLANET_NAME } from './words.js';

const pn = (p: string) => PLANET_NAME[p] ?? p;
const WEAK_RIPENESS = new Set(['dried_seed_externalized', 'unripe_sour']);

export interface PurviewInput {
  board?: ReadingBoardId;
  view: DigestView;
  activation: ActivationRow[];
  asOf: string;
  clock: SelfClock;
  bodies: PanelBodies;
  skyStored: boolean;
  sky?: TransitRangePayload | null;
}

export interface PurviewResult {
  entries: PurviewEntry[];
  /** a loss passage is running: the body panel keeps only the rest line (doc 61 §4) */
  sensitive: boolean;
}

const claimIds = (b: PanelBodies) => Object.values(b).flatMap((x) => x?.claims ?? []).map((c) => c.id);
/** the claims whose evidence names the planet's own card */
const about = (b: PanelBodies, p: string) => Object.values(b).flatMap((x) => x?.claims ?? []).filter((c) => c.evidence.some((e) => e === `planet:D1.${p}` || e === `planet:D9.${p}`)).map((c) => c.id);

export function runPurview({ board = 'self', view, activation, asOf, clock, bodies, skyStored, sky }: PurviewInput): PurviewResult {
  const out: PurviewEntry[] = [];
  const ids = new Set(claimIds(bodies));
  const has = (id: string) => ids.has(id);
  const l1 = view.house('D1', 1)?.lord ?? null;
  const l5 = view.house('D1', 5)?.lord ?? null;
  const l6 = view.house('D1', 6)?.lord ?? null;
  const l7 = view.house('D1', 7)?.lord ?? null;
  const l10 = view.house('D1', 10)?.lord ?? null;
  const l11 = view.house('D1', 11)?.lord ?? null;
  const ak = view.points('D1').find((p) => p.id === 'AK')?.planet ?? null;
  const dk = view.points('D1').find((p) => p.id === 'DK')?.planet ?? null;
  const amk = view.points('D1').find((p) => p.id === 'AmK')?.planet ?? null;
  const selfPlanets =
    board === 'love'
      ? [...new Set([l7, l5, 'Ve', 'Mo', dk, 'Ju'].filter((x): x is string => !!x))]
      : board === 'work'
        ? [...new Set([l10, l6, l11, amk, 'Sa', 'Su', 'Me', 'Ju'].filter((x): x is string => !!x))]
        : [...new Set([l1, 'Mo', 'Su', ak].filter((x): x is string => !!x))];

  // 1. primary board lord's standing governs footing claims
  const primaryLord = board === 'love' ? l7 : board === 'work' ? l10 : l1;
  const L = primaryLord ? view.planet('D1', primaryLord) : null;
  if (L) {
    const rip = L.avasthaMultipliers?.ripeness;
    const dus = L.house != null && (view.house('D1', L.house)?.class ?? []).includes('dusthana');
    if ((rip && WEAK_RIPENESS.has(rip)) || dus) {
      const ruleName = board === 'love' ? 'purview.seventh_lord_standing' : board === 'work' ? 'purview.tenth_lord_standing' : 'purview.lagna_lord_standing';
      const targetClaims =
        board === 'love'
          ? ['partner.seventh_lord', 'heart.romance', 'diagnosis.direction'].filter(has)
          : board === 'work'
            ? ['vocation.tenth_lord', 'standing.arudha', 'diagnosis.direction'].filter(has)
            : ['lagna.lord_house', 'diagnosis.direction', 'body.footing'].filter(has);
      out.push({
        rule: ruleName,
        source: 'BPHS (the primary house lord governs the delivery of the domain)',
        action: 'annotate',
        affects: targetClaims,
        rows: [`planet:D1.${primaryLord}`],
        text: `The primary domain lord ${pn(primaryLord!)} is weak in delivery (${rip ?? 'dusthana'}); domain claims hold with deliberate effort and the diagnosis names it first.`,
      });
    }
  }

  // 2. cancellations override weaknesses
  for (const p of selfPlanets) {
    const c = view.planet('D1', p);
    if (!c || !/debil/i.test(c.dignity ?? '')) continue;
    const cancel = view.yogas().find((y) => /cancel/i.test(y.class) && y.planets.includes(p));
    if (!cancel) continue;
    const weak = `struggle.weak_${p}`;
    if (has(weak)) out.push({ rule: 'purview.cancellation', source: 'BPHS (neecha bhanga: a cancelled debility is not a plain weakness)', action: 'veto', affects: [weak], rows: [`planet:D1.${p}`, `yoga:D1.${cancel.id}`], text: `${pn(p)} is debilitated with a cancellation row (${cancel.name}); the weakness is stated as the gift in Gifts and knots, not as a struggle.` });
  }

  // 3. combustion and retrogression carry into every claim about the planet
  for (const p of selfPlanets) {
    const c = view.planet('D1', p);
    if (!c) continue;
    if (c.combust) out.push({ rule: 'purview.combust', source: 'BPHS (a combust planet cannot be counted a strength)', action: 'annotate', affects: about(bodies, p), rows: [`planet:D1.${p}`], text: `${pn(p)} is combust.` });
    if (c.retro) out.push({ rule: 'purview.retrograde', source: 'BPHS (retrograde results)', action: 'annotate', affects: about(bodies, p), rows: [`planet:D1.${p}`], text: `${pn(p)} is retrograde.` });
  }

  // 4. functional nature by lagna over natural nature for what looks at the self
  const h1 = view.house('D1', 1);
  for (const p of h1?.aspectedGraha ?? []) {
    const c = view.planet('D1', p);
    if (c && /benefic/i.test(c.natural ?? '') && /malefic/i.test(c.functional ?? '')) {
      out.push({ rule: 'purview.functional_nature', source: 'BPHS (functional nature by lagna)', action: 'annotate', affects: ['lagna.on_self'].filter(has), rows: [`planet:D1.${p}`], text: `${pn(p)} is a natural benefic but a functional malefic for this lagna; read its aspect on the self as pressure.` });
    }
  }

  // 5. vargottama: the same sign in D1 and D9 confirms in the inner chart
  for (const p of selfPlanets) {
    const a = view.planet('D1', p);
    const b = view.planet('D9', p);
    if (a?.sign && b?.sign && a.sign === b.sign) out.push({ rule: 'purview.vargottama', source: 'BPHS (vargottama)', action: 'annotate', affects: about(bodies, p), rows: [`planet:D1.${p}`, `planet:D9.${p}`], text: `${pn(p)} is vargottama: confirmed in the inner chart.` });
  }

  // 6. gandanta from the engine's star profile
  const star = view.star();
  if (star?.gandanta?.length) out.push({ rule: 'purview.gandanta', source: 'BPHS (gandanta)', action: 'annotate', affects: [...ids].filter((id) => id.startsWith('mind.') || id.startsWith('lagna.')), rows: ['star:profile'], text: `Gandanta: ${star.gandanta.join(', ')}.` });

  // 7. dasha applicability of the reading clock
  const conditional = getSelfClockConditionalOrder();
  const row = activation.find((r) => r.system === clock.system);
  if (conditional.includes(clock.system)) {
    const applies = row?.family === 'conditional';
    out.push({ rule: 'purview.dasha_applicability', source: 'BPHS (conditional dashas apply only under their rule)', action: applies ? 'annotate' : 'override', affects: ['chapters.previous', 'chapters.running', 'chapters.next'].filter(has), rows: ['dasha.applicable'], text: applies ? `${clock.label} applies to this chart by the engine's rule.` : `${clock.label} does not apply to this chart by the engine's rule; its chapters are read with care.` });
  }

  // 8. MD–AD relation from the engine's dasha charter
  const run = runningChain(activation, clock.system, asOf);
  if (run.l1?.lord && run.l2?.lord) {
    const cell = view.planet('D1', run.l1.lord)?.dashaCharter?.fruition?.[run.l2.lord];
    if (cell?.isShadAshtaka68 || cell?.isDwirdwadasha212) out.push({ rule: 'purview.md_ad_relation', source: 'BPHS (antardasha results from the mahadasha lord: 6/8 and 2/12)', action: 'annotate', affects: ['chapters.sub', 'diagnosis.now'].filter(has), rows: [`planet:D1.${run.l1.lord}`], text: `The sub-period lord ${pn(run.l2.lord)} sits ${cell.isShadAshtaka68 ? '6/8' : '2/12'} from the main lord ${pn(run.l1.lord)}: a cost or a reversal inside the chapter.` });
  }

  // 9. sade sati and nodes via universal shared sky or per-kundli overlay
  if (!skyStored && !sky) {
    out.push({ rule: 'purview.sky', source: 'gochara (sade sati and nodal transits)', action: 'annotate', affects: [], rows: [], text: 'The sky overlay is not stored for this chart; transit pressure on the lagna and the Moon was not checked.' });
  } else {
    const mo = view.planet('D1', 'Mo');
    const signToHouse = new Map<string, number>();
    for (const hc of view.houses('D1')) if (hc.sign) signToHouse.set(hc.sign, hc.house);
    const activeNotes: string[] = [];
    if (sky?.ingresses?.length) {
      for (const pl of ['Sa', 'Ju', 'Ra', 'Ke']) {
        const ing = sky.ingresses.find((r) => r.planet === pl && r.from <= asOf && asOf <= r.to);
        if (!ing) continue;
        const h = ing.house_from_lagna || signToHouse.get(ing.sign) || null;
        activeNotes.push(`${pn(pl)} in ${ing.sign}${h ? ` (H${h})` : ''}${mo?.sign === ing.sign ? ' over natal Moon' : ''}`);
      }
    }
    const h1Sav = view.house('D1', 1)?.sav;
    const h6Sav = view.house('D1', 6)?.sav;
    out.push({
      rule: 'purview.sky',
      source: 'gochara (universal transit sky & Sarvashtakavarga)',
      action: 'annotate',
      affects: ['body.sky_gochara', 'body.footing', 'struggle.sub'].filter(has),
      rows: ['house:D1.h1', ...(mo ? ['planet:D1.Mo'] : [])],
      text: activeNotes.length
        ? `Universal transit sky active (${activeNotes.join(', ')}); natal SAV H1=${h1Sav ?? '?'}, H6=${h6Sav ?? '?'}.`
        : `Universal sky and natal Sarvashtakavarga evaluated (H1 SAV=${h1Sav ?? '?'}, H6 SAV=${h6Sav ?? '?'}).`,
    });
  }

  // 9b. Multi-clock weighting (Vimshottari + Narayana + Tithi Pravesha alongside primary clock) & Special Points (AL, SL, HL, MD, GK, Argala)
  const vimRun = runningChain(activation, 'vimsottari', asOf);
  const narRun = runningChain(activation, 'narayana', asOf);
  const multiRows: string[] = [];
  if (vimRun.l1) multiRows.push(activationKey(vimRun.l1));
  if (vimRun.l2) multiRows.push(activationKey(vimRun.l2));
  if (narRun.l1) multiRows.push(activationKey(narRun.l1));
  if (multiRows.length) {
    out.push({
      rule: 'purview.multi_clock_weight',
      source: 'BPHS & Jaimini Upadesa Sutras (Vimshottari + Narayana + Conditional Dasha synthesis)',
      action: 'annotate',
      affects: ['chapters.running', 'body.now', 'body.clocks_vim_narayana', 'diagnosis.now'].filter(has),
      rows: multiRows,
      text: `Alongside ${clock.label}, Vimshottari (${vimRun.l1 ? `${pn(vimRun.l1.lord ?? '')}/${pn(vimRun.l2?.lord ?? '')}` : 'active'}) and Jaimini Narayana (${narRun.l1 ? `${narRun.l1.sign ?? narRun.l1.lord}` : 'active'}) carry major concurrent weight.`,
    });
  }

  const alPt = view.points('D1').find((p) => p.id === 'AL');
  const ulPt = view.points('D1').find((p) => p.id === 'UL');
  const a7Pt = view.points('D1').find((p) => p.id === 'A7');
  const a10Pt = view.points('D1').find((p) => p.id === 'A10');
  const glPt = view.points('D1').find((p) => p.id === 'GL');
  const slPt = view.points('D1').find((p) => p.id === 'SL');
  const hlPt = view.points('D1').find((p) => p.id === 'HL');
  const mdPt = view.points('D1').find((p) => p.id === 'MD');
  const gkPt = view.points('D1').find((p) => p.id === 'GK');
  const spRows = [
    ...(alPt ? ['point:D1.AL'] : []),
    ...(ulPt && board === 'love' ? ['point:D1.UL'] : []),
    ...(a7Pt && board === 'love' ? ['point:D1.A7'] : []),
    ...(a10Pt && board === 'work' ? ['point:D1.A10'] : []),
    ...(glPt && board === 'work' ? ['point:D1.GL'] : []),
    ...(slPt ? ['point:D1.SL'] : []),
    ...(hlPt ? ['point:D1.HL'] : []),
    ...(mdPt ? ['point:D1.MD'] : []),
    ...(gkPt ? ['point:D1.GK'] : []),
  ];
  if (spRows.length) {
    out.push({
      rule: 'purview.special_lagnas_argala',
      source: 'BPHS & Jaimini (Arudha Lagna AL, Upapada UL, Rajyapada A10, Sree Lagna SL, Hora Lagna HL, Mandi MD, Gulika GK & Argala)',
      action: 'annotate',
      affects: [
        'lagna.seen',
        'body.special_points_argala',
        'body.footing',
        'partner.upapada',
        'partner.darapada',
        'heart.arudha_pull',
        'bond.support_argala',
        'standing.arudha',
        'standing.rajyapada',
        'standing.special_lagnas',
      ].filter(has),
      rows: spRows,
      text: `Special Lagnas and Upagrahas active: AL=${alPt?.sign ?? '?'}(H${alPt?.house ?? '?'}), UL=${ulPt?.sign ?? '?'}(H${ulPt?.house ?? '?'}), A10=${a10Pt?.sign ?? '?'}(H${a10Pt?.house ?? '?'}), SL=${slPt?.sign ?? '?'}(H${slPt?.house ?? '?'}), HL=${hlPt?.sign ?? '?'}(H${hlPt?.house ?? '?'}), MD=${mdPt?.sign ?? '?'}(H${mdPt?.house ?? '?'}), GK=${gkPt?.sign ?? '?'}(H${gkPt?.house ?? '?'}).`,
    });
  }

  // 10. sensitive core: a Ketu or 8th/12th passage running
  const l2 = run.l2;
  const sensitive = !!l2 && (l2.lord === 'Ke' || (l2.houses.includes(8) && l2.houses.includes(12) && l2.lord === 'Sa'));
  if (sensitive) out.push({ rule: 'purview.sensitive_core', source: 'doc 39 sensitive passage rule', action: 'annotate', affects: ['body.now', 'diagnosis.tension'].filter(has), rows: [`activation:${clock.system}/2/${l2!.lord}@${l2!.from}`], text: 'A sensitive passage is running: graces first, no body line beyond rest.' });

  return { entries: out, sensitive };
}

/** Applies vetoes (removes the claim, keeps it for Chart details) and annotations (adds to the claim's detail). */
export function applyPurview(bodies: PanelBodies, entries: PurviewEntry[]): Partial<Record<BoardPanelId, Array<{ claimId: string; rule: string; text: string }>>> {
  const vetoed: Partial<Record<BoardPanelId, Array<{ claimId: string; rule: string; text: string }>>> = {};
  for (const [id, b] of Object.entries(bodies) as Array<[BoardPanelId, NonNullable<PanelBodies[BoardPanelId]>]>) {
    if (!b) continue;
    const keep = [];
    for (const c of b.claims) {
      const veto = entries.find((e) => e.action === 'veto' && e.affects.includes(c.id));
      if (veto) {
        (vetoed[id] ??= []).push({ claimId: c.id, rule: veto.rule, text: veto.text });
        continue;
      }
      const notes = entries.filter((e) => e.action !== 'veto' && e.affects.includes(c.id)).map((e) => e.text);
      keep.push(notes.length ? { ...c, detail: `${c.detail} | whole-chart check: ${notes.join(' ')}` } : c);
    }
    b.claims = keep;
    if (id === 'struggle') b.lead = struggleLead(keep);
    else if (id === 'yogas') b.lead = yogasLead(keep);
  }
  return vetoed;
}
