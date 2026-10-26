/**
 * Reconcile (no LLM): the grounding gate, window algebra and agreement label, then the brief the synthesizer reads.
 * Deterministic: the same findings produce the same brief byte for byte.
 *
 * - Grounding gate: a claim whose evidence ids do not resolve inside its pack is dropped (and counted).
 * - Windows: must lie inside the horizon (clipped); dasha windows classed deliverer/supporter are intersected with
 *   favourable transit windows; adjacent identical windows are merged.
 * - Agreement per subject: converge | partial | diverge, from the promise verdict and the dasha and transit windows.
 */
import { readingFindingsV2 } from '../config.js';
import { horizonRange } from '../packs/frames.js';
import { resolveEvidence, type EvidencePack } from '../packs/selector.js';
import type { Intent } from '../types.js';
import type { Finding } from './specialists.js';
import type { Dossier } from '../facts/types.js';
import type { TransitChart } from '../transits/types.js';
import { applyDeciders, convergence, DECIDERS, fortuneTier, nowAndNext, renderBrief, type LayerId, type LayerScores, type SynthBrief, type Verdict } from './convergence.js';

export interface Window {
  from: string;
  to: string;
  label: string;
  polarity: 'favourable' | 'testing' | 'mixed';
  source: 'dasha' | 'transit' | 'combined';
  evidence: string[];
  /** v2: kept only when the window's evidence resolves */
  fruit?: string;
}
export interface Agreement {
  subject: string;
  promise: Finding['verdict'] | 'missing';
  dasha: 'deliverer' | 'supporter' | 'neutral' | 'obstructor' | 'missing';
  transit: 'favourable' | 'testing' | 'mixed' | 'missing';
  label: 'converge' | 'partial' | 'diverge';
}
export interface ReconcileResult {
  findings: Finding[];
  windows: Window[];
  agreement: Agreement[];
  droppedClaims: number;
  droppedWindows: number;
  totalClaims: number;
  brief: string;
  /** five-layer convergence for the primary subject (file 11 §1) */
  verdict: Verdict;
  layers: LayerScores;
  synthBrief: SynthBrief;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);

type DashaClass = 'deliverer' | 'supporter' | 'neutral' | 'obstructor';
/** The v2 `cls` field when the reader set one; otherwise the class word in the label (v1). */
function classOf(label: string, cls?: DashaClass): DashaClass {
  if (cls && cls !== 'neutral') return cls;
  const l = label.toLowerCase();
  if (l.includes('deliver')) return 'deliverer';
  if (l.includes('support')) return 'supporter';
  if (l.includes('obstruct')) return 'obstructor';
  return 'neutral';
}

export function reconcile(args: { findings: Finding[]; packs: Record<string, EvidencePack>; intent: Intent; asOf: string; keyFacts: string; question?: string; dossier?: Dossier | null; transits?: TransitChart | null; failed?: string[] }): ReconcileResult {
  const hz = horizonRange(args.intent.horizon, args.asOf);
  let dropped = 0;
  let droppedWindows = 0;
  let total = 0;

  const findings: Finding[] = args.findings.map((f) => {
    const pack = args.packs[f.subject];
    const valid = (ids: string[]) => ids.filter((id) => pack && resolveEvidence(pack, id) !== undefined);
    const claims = f.claims
      .map((c) => ({ ...c, evidence: valid(c.evidence) }))
      .filter((c) => {
        total += 1;
        if (c.evidence.length === 0) {
          dropped += 1;
          return false;
        }
        return true;
      });
    const windows = f.windows
      .map((w) => ({ ...w, evidence: valid(w.evidence) }))
      .filter((w) => {
        const ok = ISO.test(w.from) && ISO.test(w.to) && w.from <= w.to && w.to >= hz.from && w.from <= hz.to;
        if (!ok) droppedWindows += 1;
        return ok;
      })
      .map((w) => ({ ...w, from: max(w.from, hz.from), to: min(w.to, hz.to), fruit: w.evidence.length ? w.fruit : '' }));
    return { ...f, claims, windows };
  });

  // window algebra, per subject
  const windows: Window[] = [];
  const agreement: Agreement[] = [];
  const subjects = [...new Set(findings.map((f) => f.subject))];
  for (const subject of subjects) {
    const fs = findings.filter((f) => f.subject === subject);
    const dasha = fs.find((f) => f.analyst === 'dasha');
    const transit = fs.find((f) => f.analyst === 'transit');
    const promise = fs.find((f) => f.analyst === 'promise');
    const dW = (dasha?.windows ?? []).map((w) => ({ ...w, cls: classOf(w.label, w.cls) }));
    const tW = transit?.windows ?? [];
    const good = dW.filter((w) => w.cls === 'deliverer' || w.cls === 'supporter');
    const fav = tW.filter((w) => w.polarity === 'favourable');
    const combined: Window[] = [];
    for (const d of good) {
      for (const t of fav) {
        const from = max(d.from, t.from);
        const to = min(d.to, t.to);
        if (from <= to) combined.push({ from, to, label: `${d.label} + ${t.label}`.slice(0, 160), polarity: 'favourable', source: 'combined', evidence: [...new Set([...d.evidence, ...t.evidence])] });
      }
    }
    const fr = (f?: string) => (f ? { fruit: f } : {});
    for (const w of dW) windows.push({ from: w.from, to: w.to, label: w.label, polarity: w.cls === 'obstructor' ? 'testing' : w.cls === 'neutral' ? 'mixed' : 'favourable', source: 'dasha', evidence: w.evidence, ...fr(w.fruit) });
    for (const w of tW) windows.push({ from: w.from, to: w.to, label: w.label, polarity: w.polarity, source: 'transit', evidence: w.evidence, ...fr(w.fruit) });
    windows.push(...combined);

    const bestDasha: Agreement['dasha'] = !dasha ? 'missing' : good.some((w) => w.cls === 'deliverer') ? 'deliverer' : good.length ? 'supporter' : dW.some((w) => w.cls === 'obstructor') ? 'obstructor' : 'neutral';
    const bestTransit: Agreement['transit'] = !transit ? 'missing' : fav.length ? 'favourable' : tW.some((w) => w.polarity === 'testing') ? 'testing' : 'mixed';
    const p = promise?.verdict ?? 'missing';
    const promiseOk = p === 'strong' || p === 'moderate';
    const dashaOk = bestDasha === 'deliverer' || bestDasha === 'supporter';
    const transitOk = bestTransit === 'favourable';
    const agreeing = [promiseOk, dashaOk, transitOk].filter(Boolean).length;
    agreement.push({
      subject,
      promise: p,
      dasha: bestDasha,
      transit: bestTransit,
      label: p === 'weak' || p === 'denied' ? 'diverge' : agreeing === 3 ? 'converge' : agreeing === 2 ? 'partial' : 'diverge',
    });
  }

  // sort, merge adjacent identical
  windows.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : 1));
  const merged: Window[] = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && last.label === w.label && last.polarity === w.polarity && last.source === w.source && w.from <= last.to) last.to = max(last.to, w.to);
    else merged.push({ ...w });
  }

  // brief for the synthesizer: strongest claims first, ids kept for the run log but shown short
  const order = (c: { weight: number }) => -c.weight;
  const v2 = readingFindingsV2();
  const briefObj = {
    key_facts: args.keyFacts,
    agreement,
    windows: merged.slice(0, 14).map((w) => ({ from: w.from, to: w.to, polarity: w.polarity, source: w.source, label: w.label })),
    findings: findings.map((f) => ({
      layer: f.analyst,
      subject: f.subject,
      verdict: f.verdict,
      claims: [...f.claims].sort((a, b) => order(a) - order(b)).map((c) => (v2 ? { text: c.text, polarity: c.polarity, weight: c.weight, tradition: c.tradition } : { text: c.text, polarity: c.polarity, weight: c.weight })),
      caveats: f.caveats,
    })),
  };
  // five-layer convergence on the primary subject (file 11): deciders settle a split promise, missing required layers cap
  const primary = args.intent.subjects[0]?.id;
  const pf = findings.filter((f) => f.subject === primary);
  const by = (a: Finding['analyst']) => pf.find((f) => f.analyst === a && f.status !== 'failed' && f.status !== 'skipped');
  const dec = primary ? applyDeciders(by('promise'), primary) : { L1: undefined, used: [] as string[] };
  const layers: LayerScores = {};
  if (dec.L1 !== undefined) layers.L1 = dec.L1;
  for (const [a, k] of [['dasha', 'L2'], ['transit', 'L3'], ['nakshatra', 'L4']] as const) {
    const f = by(a);
    if (f && typeof f.layerScore === 'number') layers[k] = f.layerScore;
  }
  const months = (hz.to.slice(0, 4) === hz.from.slice(0, 4) ? 0 : 12 * (Number(hz.to.slice(0, 4)) - Number(hz.from.slice(0, 4)))) + Number(hz.to.slice(5, 7)) - Number(hz.from.slice(5, 7));
  const transitRequired = months <= 36;
  const failed = new Set(args.failed ?? []);
  const missingRequired: LayerId[] = [];
  if (!by('promise') && (failed.has('promise') || pf.length)) missingRequired.push('L1');
  if (!by('dasha') && (failed.has('dasha') || pf.length)) missingRequired.push('L2');
  if (transitRequired && !by('transit') && (failed.has('transit') || pf.length)) missingRequired.push('L3');
  const verdict = convergence(layers, { transitRequired, missingRequired });
  const fortune = args.dossier ? fortuneTier(args.dossier, args.transits ?? null, args.asOf) : null;
  const nn = args.dossier ? nowAndNext(args.dossier, args.asOf) : { now: null, next: null };
  const traditions = [...new Set(findings.flatMap((f) => f.claims.map((c) => (c as { tradition?: string }).tradition ?? 'parashara')))];
  const synthBrief: SynthBrief = {
    template: args.intent.classification?.template ?? args.intent.format,
    subjects: args.intent.subjects.map((x) => x.id),
    horizon: args.intent.horizon,
    question: args.question ?? '',
    verdict,
    layers,
    deciders: primary && DECIDERS[primary] && dec.used.length ? { text: DECIDERS[primary]!.text, evidence: dec.used } : null,
    now: nn.now,
    next: nn.next && nn.next.from <= hz.to ? nn.next : null,
    windows: merged.slice(0, 7).map((w) => ({ from: w.from, to: w.to, label: w.label, polarity: w.polarity, source: w.source, ...(v2 && w.fruit ? { fruit: w.fruit } : {}) })),
    keyFacts: args.keyFacts.split('\n').filter(Boolean).slice(0, 12),
    caveats: [...new Set(findings.flatMap((f) => f.caveats))].slice(0, 6),
    fortune: fortune ? { tier: fortune.tier, until: fortune.until } : null,
    traditions,
    ...(v2 ? v2Extras(pf, args.packs[primary ?? '']) : {}),
  };
  const brief = `${renderBrief(synthBrief)}\n\nFINDINGS (detail):\n${JSON.stringify(briefObj)}`;
  return { findings, windows: merged, agreement, droppedClaims: dropped, droppedWindows, totalClaims: total, brief, verdict, layers, synthBrief };
}

/**
 * v2 brief fields (doc 25 §2.5d, §4 grounding): culprits and contributors aggregated per planet with the layers that named
 * them, dropped unless the planet is a body in the pack; the promise `form` only when the promise has a grounded varga claim.
 */
function v2Extras(fs: Finding[], pack: EvidencePack | undefined): Pick<SynthBrief, 'form' | 'culprits' | 'contributors'> {
  const bodies = ((pack?.sections.base as { bodies?: Record<string, unknown> } | undefined)?.bodies ?? {}) as Record<string, unknown>;
  const agg = (key: 'culprits' | 'contributors') => {
    const m = new Map<string, string[]>();
    for (const f of fs) for (const p of f[key] ?? []) if (p in bodies) m.set(p, [...(m.get(p) ?? []), f.analyst]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([planet, layers]) => ({ planet, layers }));
  };
  const culprits = agg('culprits');
  const named = new Set(culprits.map((c) => c.planet));
  const contributors = agg('contributors').filter((c) => !named.has(c.planet));
  const promise = fs.find((f) => f.analyst === 'promise');
  const grounded = !!promise?.claims.some((c) => c.evidence.some((e) => e.startsWith('varga.')));
  return { ...(promise?.form && grounded ? { form: promise.form } : {}), culprits, contributors };
}
