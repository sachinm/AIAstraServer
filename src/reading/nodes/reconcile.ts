/**
 * Reconcile (no LLM): the grounding gate, window algebra and agreement label, then the brief the synthesizer reads.
 * Deterministic: the same findings produce the same brief byte for byte.
 *
 * - Grounding gate: a claim whose evidence ids do not resolve inside its pack is dropped (and counted).
 * - Windows: must lie inside the horizon (clipped); dasha windows classed deliverer/supporter are intersected with
 *   favourable transit windows; adjacent identical windows are merged.
 * - Agreement per subject: converge | partial | diverge, from the promise verdict and the dasha and transit windows.
 */
import { horizonRange } from '../packs/frames.js';
import { resolveEvidence, type EvidencePack } from '../packs/selector.js';
import type { Intent } from '../types.js';
import type { Finding } from './specialists.js';

export interface Window {
  from: string;
  to: string;
  label: string;
  polarity: 'favourable' | 'testing' | 'mixed';
  source: 'dasha' | 'transit' | 'combined';
  evidence: string[];
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
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);

function classOf(label: string): 'deliverer' | 'supporter' | 'neutral' | 'obstructor' {
  const l = label.toLowerCase();
  if (l.includes('deliver')) return 'deliverer';
  if (l.includes('support')) return 'supporter';
  if (l.includes('obstruct')) return 'obstructor';
  return 'neutral';
}

export function reconcile(args: { findings: Finding[]; packs: Record<string, EvidencePack>; intent: Intent; asOf: string; keyFacts: string }): ReconcileResult {
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
      .map((w) => ({ ...w, from: max(w.from, hz.from), to: min(w.to, hz.to) }));
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
    const dW = (dasha?.windows ?? []).map((w) => ({ ...w, cls: classOf(w.label) }));
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
    for (const w of dW) windows.push({ from: w.from, to: w.to, label: w.label, polarity: w.cls === 'obstructor' ? 'testing' : w.cls === 'neutral' ? 'mixed' : 'favourable', source: 'dasha', evidence: w.evidence });
    for (const w of tW) windows.push({ from: w.from, to: w.to, label: w.label, polarity: w.polarity, source: 'transit', evidence: w.evidence });
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
  const briefObj = {
    key_facts: args.keyFacts,
    agreement,
    windows: merged.slice(0, 14).map((w) => ({ from: w.from, to: w.to, polarity: w.polarity, source: w.source, label: w.label })),
    findings: findings.map((f) => ({
      layer: f.analyst,
      subject: f.subject,
      verdict: f.verdict,
      claims: [...f.claims].sort((a, b) => order(a) - order(b)).map((c) => ({ text: c.text, polarity: c.polarity, weight: c.weight })),
      caveats: f.caveats,
    })),
  };
  return { findings, windows: merged, agreement, droppedClaims: dropped, droppedWindows, totalClaims: total, brief: JSON.stringify(briefObj) };
}
