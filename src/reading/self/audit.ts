/**
 * The code half of the auditor (`board.auditor`, docs/reading-engine/60 §5) over one build of the You reading. Every card
 * line must: be at most 22 words; carry a range; name claim ids that exist in the build and were not vetoed; rest on
 * claims whose evidence keys resolve to rows in the dossier's data; carry only dates that equal a stored period boundary
 * of the activation calendar or the year chart; and carry no banned word. A failing line is removed from the card; the
 * verdict is `fail` when any line failed. Costs nothing and runs on every build.
 */
import type { CodeAudit, AuditFailure, SelfPanel } from './types.js';
import { BANNED_LINE_WORDS, MAX_LINE_WORDS, wordCount } from './words.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g;
const MONTH_ONLY = /(?<!\d )\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g;

export interface AuditInput {
  panels: SelfPanel[];
  /** every claim id of the build, with its evidence keys */
  claims: Map<string, string[]>;
  vetoed: Set<string>;
  /** evidence keys the dossier resolved to a stored row */
  resolvedKeys: Set<string>;
  /** stored period boundaries, YYYY-MM-DD */
  boundaries: Set<string>;
}

export function auditCards(input: AuditInput): { audit: CodeAudit; panels: SelfPanel[] } {
  const failures: AuditFailure[] = [];
  const months = new Set([...input.boundaries].map((d) => d.slice(0, 7)));
  let checked = 0;
  const fail = (lineId: string, check: string, text: string) => failures.push({ lineId, check, text });
  const panels = input.panels.map((p) => {
    const lines = p.lines.filter((l) => {
      checked++;
      const before = failures.length;
      if (wordCount(l.text) > MAX_LINE_WORDS) fail(l.id, 'words', `${wordCount(l.text)} words`);
      if (!l.range) fail(l.id, 'range', 'no range');
      if (!l.claimIds.length) fail(l.id, 'claims', 'no claim ids');
      for (const id of l.claimIds) {
        const ev = input.claims.get(id);
        if (!ev) fail(l.id, 'claims', `claim ${id} not in the build`);
        else if (input.vetoed.has(id)) fail(l.id, 'veto', `claim ${id} was vetoed by the purview`);
        else {
          const rows = ev.filter((e) => !e.startsWith('claim:'));
          const unresolved = rows.filter((e) => !input.resolvedKeys.has(e));
          if (unresolved.length) fail(l.id, 'rows', `unresolved: ${unresolved.join(', ')}`);
          for (const ref of ev.filter((e) => e.startsWith('claim:'))) if (!input.claims.has(ref.slice(6))) fail(l.id, 'claims', `source claim ${ref.slice(6)} not in the build`);
        }
      }
      for (const m of l.text.matchAll(FULL)) {
        const iso = `${m[3]}-${String(MONTHS.indexOf(m[2]!) + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
        if (!input.boundaries.has(iso)) fail(l.id, 'date', `${m[0]} is not a stored boundary`);
      }
      for (const m of l.text.replace(FULL, '').matchAll(MONTH_ONLY)) {
        const ym = `${m[2]}-${String(MONTHS.indexOf(m[1]!) + 1).padStart(2, '0')}`;
        if (!months.has(ym)) fail(l.id, 'date', `${m[0]} is not a stored boundary month`);
      }
      for (const re of BANNED_LINE_WORDS) if (re.test(l.text)) fail(l.id, 'words_banned', `matches ${re.source.slice(0, 40)}`);
      return failures.length === before;
    });
    return { ...p, lines };
  });
  return { audit: { verdict: failures.length ? 'fail' : 'pass', checked, failures }, panels };
}

/** One verdict over several audit passes (BG-12: the build's cards, then the oracle's lines): checks add up, failures join. */
export function mergeAudits(audits: CodeAudit[]): CodeAudit {
  const failures = audits.flatMap((a) => a.failures);
  return { verdict: failures.length ? 'fail' : 'pass', checked: audits.reduce((n, a) => n + a.checked, 0), failures };
}
