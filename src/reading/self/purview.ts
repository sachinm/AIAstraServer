/**
 * `board.purview` (Self instance `self.reading.purview`, docs/reading-engine/60 §4): the whole-chart check run over the
 * full digest and the reading clock after the panels and before the diagnosis and the cards. A panel reads a slice; a
 * chart is read whole. Each rule matches engine labels and joins keys only; it returns overrides, vetoes and
 * annotations. A vetoed claim is removed from the panel (kept under Chart details with its rule); an annotation is added
 * to the claim's detail.
 */
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView } from '../digest/types.js';
import { getSelfClockConditionalOrder } from '../../config/env.js';
import type { PanelBodies } from './panels/diagnosis.js';
import { runningChain } from './slices.js';
import type { PurviewEntry, SelfClock, SelfPanelId } from './types.js';
import { PLANET_NAME } from './words.js';

const pn = (p: string) => PLANET_NAME[p] ?? p;
const WEAK_RIPENESS = new Set(['dried_seed_externalized', 'unripe_sour']);

export interface PurviewInput {
  view: DigestView;
  activation: ActivationRow[];
  asOf: string;
  clock: SelfClock;
  bodies: PanelBodies;
  skyStored: boolean;
}

export interface PurviewResult {
  entries: PurviewEntry[];
  /** a loss passage is running: the body panel keeps only the rest line (doc 61 §4) */
  sensitive: boolean;
}

const claimIds = (b: PanelBodies) => Object.values(b).flatMap((x) => x?.claims ?? []).map((c) => c.id);
/** the claims whose evidence names the planet's own card */
const about = (b: PanelBodies, p: string) => Object.values(b).flatMap((x) => x?.claims ?? []).filter((c) => c.evidence.some((e) => e === `planet:D1.${p}` || e === `planet:D9.${p}`)).map((c) => c.id);

export function runPurview({ view, activation, asOf, clock, bodies, skyStored }: PurviewInput): PurviewResult {
  const out: PurviewEntry[] = [];
  const ids = new Set(claimIds(bodies));
  const has = (id: string) => ids.has(id);
  const l1 = view.house('D1', 1)?.lord ?? null;
  const ak = view.points('D1').find((p) => p.id === 'AK')?.planet ?? null;
  const selfPlanets = [...new Set([l1, 'Mo', 'Su', ak].filter((x): x is string => !!x))];

  // 1. the lagna lord's standing governs every footing claim
  const L = l1 ? view.planet('D1', l1) : null;
  if (L) {
    const rip = L.avasthaMultipliers?.ripeness;
    const dus = L.house != null && (view.house('D1', L.house)?.class ?? []).includes('dusthana');
    if ((rip && WEAK_RIPENESS.has(rip)) || dus) {
      out.push({ rule: 'purview.lagna_lord_standing', source: 'BPHS (the lagna lord governs the strength of every house reading)', action: 'annotate', affects: ['lagna.lord_house', 'diagnosis.direction', 'body.footing'].filter(has), rows: [`planet:D1.${l1}`], text: `The lagna lord ${pn(l1!)} is weak in delivery (${rip ?? 'dusthana'}); every footing claim holds only with effort and the diagnosis names it first.` });
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

  // 9. sade sati and nodes need the stored sky
  if (!skyStored) out.push({ rule: 'purview.sky', source: 'gochara (sade sati and nodal transits)', action: 'annotate', affects: [], rows: [], text: 'The sky overlay is not stored for this chart; transit pressure on the lagna and the Moon was not checked.' });

  // 10. sensitive core: a Ketu or 8th/12th passage running
  const l2 = run.l2;
  const sensitive = !!l2 && (l2.lord === 'Ke' || (l2.houses.includes(8) && l2.houses.includes(12) && l2.lord === 'Sa'));
  if (sensitive) out.push({ rule: 'purview.sensitive_core', source: 'doc 39 sensitive passage rule', action: 'annotate', affects: ['body.now', 'diagnosis.tension'].filter(has), rows: [`activation:${clock.system}/2/${l2!.lord}@${l2!.from}`], text: 'A sensitive passage is running: graces first, no body line beyond rest.' });

  return { entries: out, sensitive };
}

/** Applies vetoes (removes the claim, keeps it for Chart details) and annotations (adds to the claim's detail). */
export function applyPurview(bodies: PanelBodies, entries: PurviewEntry[]): Partial<Record<SelfPanelId, Array<{ claimId: string; rule: string; text: string }>>> {
  const vetoed: Partial<Record<SelfPanelId, Array<{ claimId: string; rule: string; text: string }>>> = {};
  for (const [id, b] of Object.entries(bodies) as Array<[SelfPanelId, NonNullable<PanelBodies[SelfPanelId]>]>) {
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
  }
  return vetoed;
}
