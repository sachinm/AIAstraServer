/**
 * The brief the Oracle reads (docs/reading-engine/39 §4.1). No model, byte-stable for the same findings. The Oracle never sees
 * the tables: only claims that passed the grounding gate, with their layer counts.
 *
 * Layer counting is bookkeeping over the readers' tags, not astrology: grounded claims are grouped by topic and whom they are
 * about, then distinct data families among their evidence ids are counted (docs/reading-engine/33 §3.5).
 * Three or more layers make a finding; one or two make a pointer.
 */
import { horizonRange, type SubjectId } from '../packs/frames.js';
import type { EvidencePack } from '../packs/selector.js';
import { resolveEvidence } from '../packs/selector.js';
import { reconcile, type ReconcileResult } from '../nodes/reconcile.js';
import type { Finding } from '../nodes/specialists.js';
import type { ClarifiedContext, Intent } from '../types.js';
import { READERS, type ReaderId } from './readers.js';
import { toLayerFinding, type ReaderOutput } from './runReader.js';
import { CODE_ANALYST_LABEL, type CodeAnalyst } from '../codeReaders/readers.js';

/** A deterministic reader over the digest, as it appears beside the model readers (codeReaders/readers.ts). */
export type CodeReaderId = `code:${CodeAnalyst}`;
export type BriefReaderId = ReaderId | CodeReaderId;

/** What the brief calls a reader. */
export function readerLabel(id: BriefReaderId): string {
  if (id.startsWith('code:')) return CODE_ANALYST_LABEL[id.slice(5) as CodeAnalyst] ?? id;
  return READERS[id as ReaderId]?.label ?? id;
}

export interface GroundedReader {
  id: BriefReaderId;
  subject: SubjectId;
  finding: ReaderOutput;
  droppedClaims: number;
  droppedQuotes: number;
}

const has = (sections: Record<string, unknown>, id: string): boolean => {
  let cur: unknown = sections;
  for (const part of id.split('.')) {
    if (cur === null || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[part];
    if (cur === undefined) return false;
  }
  return true;
};

const read = (sections: Record<string, unknown>, id: string): unknown => resolveEvidence({ sections } as unknown as EvidencePack, id);

/** The gate: a claim with no evidence id that resolves in what this reader saw is dropped, and so is a quote whose value differs. */
export function groundReader(id: BriefReaderId, subject: SubjectId, f: ReaderOutput, sections: Record<string, unknown>): GroundedReader {
  const valid = (ids: string[]) => ids.filter((x) => has(sections, x));
  const claims = f.claims.map((c) => ({ ...c, evidence: valid(c.evidence) })).filter((c) => c.evidence.length > 0);
  const quotes = f.quotes.filter((q) => has(sections, q.id) && String(read(sections, q.id)) === String(q.value));
  return {
    id,
    subject,
    droppedClaims: f.claims.length - claims.length,
    droppedQuotes: f.quotes.length - quotes.length,
    finding: {
      ...f,
      claims,
      quotes,
      windows: f.windows.map((w) => ({ ...w, evidence: valid(w.evidence) })),
      graces: f.graces.map((g) => ({ ...g, evidence: valid(g.evidence) })).filter((g) => g.evidence.length > 0),
      pointers: f.pointers.map((p) => ({ ...p, evidence: valid(p.evidence) })).filter((p) => p.evidence.length > 0),
    },
  };
}

/** The data family an evidence id belongs to: one independent layer. */
export function layerOf(evidenceId: string, tradition?: string): string {
  const head = evidenceId.split('.')[0] ?? '';
  if (tradition === 'nakshatra') return 'nakshatra';
  // digest rows (packs/digestSource.ts): digest.<section>.<varga>.<key>; D1 houses, planets and yogas are the natal
  // layer, a varga is its own layer, the Jaimini points are the Jaimini layer, as the stored tables are counted below
  if (head === 'digest') {
    const [, section, varga] = evidenceId.split('.');
    if (section === 'point') return 'jaimini';
    if (section === 'house' && /\.argala(\.|$)/.test(evidenceId)) return 'jaimini';
    return varga && varga !== 'D1' ? `varga_${varga.toLowerCase()}` : 'd1';
  }
  if (/^varga_d1$|^dignities$|^benefic_malefic$|^relations$|^aspects$|^bhava$|^strength_|^ashtakavarga$|^yogas$|^doshas$|^sphutas$/.test(head)) return 'd1';
  if (/^arudhas|^argala|^karaka_chara$/.test(head)) return 'jaimini';
  if (head.startsWith('varga_')) return head;
  if (head === 'dasha_vimsottari') return 'vimshottari';
  if (head.startsWith('dasha_')) return head;
  if (head === 'transits' || head === 'transit_at') return 'transit';
  if (head.startsWith('annual_')) return 'annual';
  if (head === 'prashna') return 'prashna';
  return head;
}

export interface Statement {
  topic: string;
  about: string;
  kind: string;
  text: string;
  polarity: string;
  layers: string[];
  weight: number;
}

/** Groups grounded claims into statements and counts their layers. */
export function countLayers(readers: GroundedReader[]): Statement[] {
  const groups = new Map<string, Statement>();
  for (const r of readers) {
    for (const c of r.finding.claims) {
      const key = `${c.topic.toLowerCase()}|${c.about}|${c.polarity}`;
      const g = groups.get(key) ?? { topic: c.topic, about: c.about, kind: c.kind, text: c.text, polarity: c.polarity, layers: [], weight: c.weight };
      for (const e of c.evidence) {
        const l = layerOf(e, c.tradition);
        if (!g.layers.includes(l)) g.layers.push(l);
      }
      // the heaviest claim speaks for the group
      if (c.weight > g.weight) Object.assign(g, { text: c.text, kind: c.kind, weight: c.weight });
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => b.layers.length - a.layers.length || b.weight - a.weight || a.topic.localeCompare(b.topic) || a.polarity.localeCompare(b.polarity));
}

export interface OracleBrief {
  text: string;
  statements: Statement[];
  reconciled: ReconcileResult;
  droppedClaims: number;
  droppedQuotes: number;
}

const line = (label: string, rows: string[]): string[] => (rows.length ? [`${label}:`, ...rows.map((r) => `- ${r}`)] : []);
const horizonText = (h: Intent['horizon']): string => (typeof h === 'string' ? h : `${h.from} to ${h.to}`);

/** The clarifier's context as the Oracle reads it. */
export function clarifiedBlock(c: ClarifiedContext | undefined): string[] {
  if (!c) return [];
  const asked = c.turns.filter((t) => t.answer).map((t) => `${t.criterion}: asked "${t.question}", they said "${t.answer}"`);
  const assumed = Object.entries(c.assumed).map(([k, v]) => `${k}: ${v}`);
  return [...line('WHAT THEY TOLD THE CLARIFIER', asked), ...line('ASSUMED, NOT CONFIRMED', assumed)];
}

export function buildBrief(a: {
  readers: GroundedReader[];
  failed: Array<{ id: ReaderId; required: boolean; reason: string }>;
  missingTypes: string[];
  pack: EvidencePack;
  intent: Intent;
  question: string;
  asOf: string;
  tier: number;
  note?: string;
}): OracleBrief {
  const subject = a.intent.subjects[0]?.id;
  const layerFindings = a.readers.map(toLayerFinding).filter((f): f is Finding => f !== null);
  const reconciled = reconcile({
    findings: layerFindings,
    // the caller passes every section any reader saw; reconcile merges windows and scores the layers
    packs: subject ? { [subject]: a.pack } : {},
    intent: a.intent,
    asOf: a.asOf,
    keyFacts: '',
    question: a.question,
    failed: a.failed.filter((f) => f.required).map((f) => READERS[f.id].layer ?? '').filter(Boolean),
  });
  const statements = countLayers(a.readers);
  const findings = statements.filter((s) => s.layers.length >= 3);
  const pointers = statements.filter((s) => s.layers.length < 3);
  const hasVerdictLayers = a.readers.some((r) => r.id === 'R02') && a.readers.some((r) => r.id === 'R08');
  const hz = horizonRange(a.intent.horizon, a.asOf);
  const dated = a.readers.flatMap((r) => r.finding.windows.filter((w) => w.date_source !== 'stored').map((w) => `${w.from} to ${w.to}: ${w.date_source}`));
  const realWant = a.intent.clarified?.realWant;
  const sensitive = [...new Set([...(realWant?.sensitive ? [realWant.sensitive] : []), ...a.readers.map((r) => r.finding.sensitive).filter(Boolean)])];

  const parts = [
    `TIER: ${a.tier}`,
    `HORIZON: ${horizonText(a.intent.horizon)} (${hz.from} to ${hz.to})`,
    ...(a.intent.clarified?.exactQuery ? [`UNDERSTOOD AS: ${a.intent.clarified.exactQuery}`] : []),
    ...(realWant ? [`WHAT THEY REALLY WANT TO KNOW: ${realWant.line}`] : []),
    ...clarifiedBlock(a.intent.clarified),
    ...(a.note ? [`THIS KIND OF QUESTION: ${a.note}`] : []),
    ...(hasVerdictLayers ? [`VERDICT: ${reconciled.verdict.level} (agreement ${reconciled.verdict.agreement})`] : ['VERDICT: not judged at this depth. Do not state an overall verdict.']),
    ...line(
      'FINDINGS (three or more layers)',
      findings.map((s) => `${s.text} [${s.layers.length} layers: ${s.layers.join(', ')}] (${s.polarity}; about ${s.about})`)
    ),
    ...line(
      'POINTERS (one or two layers)',
      pointers.map((s) => `${s.text} [${s.layers.length} layer${s.layers.length === 1 ? '' : 's'}: ${s.layers.join(', ')}] (${s.polarity}; about ${s.about}${s.weight === 3 ? '; weight 3, a moderate indication' : ''})`)
    ),
    ...line(
      'WINDOWS',
      reconciled.windows.slice(0, 10).map((w) => `${w.from} to ${w.to} | ${w.polarity} | ${w.source} | ${w.label}${w.fruit ? ` | ${w.fruit}` : ''}`)
    ),
    ...line('DATE GRADES', [...new Set(dated)]),
    ...line(
      'ACTORS',
      a.readers.flatMap((r) => r.finding.actors.map((x) => `${x.person} (${x.planet}): can ${x.can_do.join('; ') || 'not stated'}; needs ${x.needs.join('; ') || 'not stated'}; when ${x.windows.join(', ') || 'not stated'}`))
    ),
    ...line(
      'GRACES',
      a.readers.flatMap((r) => r.finding.graces.map((g) => g.text))
    ),
    ...line(
      'RANKED POSSIBILITIES',
      a.readers
        .flatMap((r) => r.finding.pointers)
        .sort((x, y) => y.fit - x.fit)
        .slice(0, 3)
        .map((p) => `fit ${p.fit}: ${p.text}${p.alt.length ? ` (the chart cannot tell this from: ${p.alt.join('; ')})` : ''}`)
    ),
    ...line(
      'FACTS YOU MAY QUOTE',
      a.readers.flatMap((r) => r.finding.quotes.slice(0, 6).map((q) => `${q.id} = ${String(q.value)}`))
    ),
    ...line(
      'HOW EACH LAYER WAS READ',
      a.readers.filter((r) => r.finding.digest).map((r) => `${readerLabel(r.id)}: ${r.finding.verdict}, ${r.finding.digest}`)
    ),
    ...line(
      'DISAGREEMENTS',
      a.readers.filter((r) => r.finding.disagree).map((r) => `${readerLabel(r.id)}: ${r.finding.disagree}`)
    ),
    ...line('GAPS', [...new Set([...a.readers.flatMap((r) => r.finding.gaps.map((g) => g.need)), ...a.missingTypes])]),
    ...line(
      'LAYERS NOT READ (say so in one line)',
      a.failed.map((f) => READERS[f.id].label)
    ),
    ...line('SENSITIVE (never print this)', sensitive),
  ];
  return {
    text: parts.join('\n'),
    statements,
    reconciled,
    droppedClaims: a.readers.reduce((n, r) => n + r.droppedClaims, 0),
    droppedQuotes: a.readers.reduce((n, r) => n + r.droppedQuotes, 0),
  };
}
