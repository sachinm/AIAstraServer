/**
 * The code half of the auditor (`board.auditor`, docs/reading-engine/60 §5) over one build of the You reading. Every card
 * line must: be at most 22 words; carry a range; name claim ids that exist in the build and were not vetoed; rest on
 * claims whose evidence keys resolve to rows in the dossier's data. A failing line is removed from the card; the verdict
 * is `fail` when any line failed. BG-14: a date outside every stored engine window is listed in `dateGaps` and the line
 * stays; an engine name is redacted, not failed; there is no phrase ban (tone belongs to the Oracle prompt). Costs nothing and runs on every build.
 */
import type { CodeAudit, AuditFailure, SelfPanel } from './types.js';
import { BANNED_LINE_WORDS, MAX_LINE_WORDS, redactBannedWords, wordCount } from './words.js';

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
  /** BG-14: stored engine windows (activation periods at every level, year-chart dashas, the transit range and its spans); a date inside any of them is grounded */
  windows?: ReadonlyArray<{ from: string; to: string }>;
}

/** True when the date (YYYY-MM-DD) or month (YYYY-MM) is a stored boundary or falls inside a stored window. */
export function inStoredWindow(when: string, boundaries: ReadonlySet<string>, windows: ReadonlyArray<{ from: string; to: string }>): boolean {
  if (when.length === 10) return boundaries.has(when) || windows.some((w) => w.from <= when && when <= w.to);
  return [...boundaries].some((b) => b.startsWith(when)) || windows.some((w) => w.from.slice(0, 7) <= when && when <= w.to.slice(0, 7));
}

export function auditCards(input: AuditInput): { audit: CodeAudit; panels: SelfPanel[] } {
  const failures: AuditFailure[] = [];
  const dateGaps: AuditFailure[] = [];
  const windows = input.windows ?? [];
  let checked = 0;
  const fail = (lineId: string, check: string, text: string) => failures.push({ lineId, check, text });
  const panels = input.panels.map((p) => {
    const lines = p.lines.map((l) => {
      // BG-14: an engine name is redacted, never a reason to drop the line
      return BANNED_LINE_WORDS.some((re) => re.test(l.text)) ? { ...l, text: redactBannedWords(l.text) } : l;
    }).filter((l) => {
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
        if (!inStoredWindow(iso, input.boundaries, windows)) dateGaps.push({ lineId: l.id, check: 'date', text: `${m[0]} is outside every stored window` });
      }
      for (const m of l.text.replace(FULL, '').matchAll(MONTH_ONLY)) {
        const ym = `${m[2]}-${String(MONTHS.indexOf(m[1]!) + 1).padStart(2, '0')}`;
        if (!inStoredWindow(ym, input.boundaries, windows)) dateGaps.push({ lineId: l.id, check: 'date', text: `${m[0]} is outside every stored window` });
      }
      return failures.length === before;
    });
    return { ...p, lines };
  });
  return { audit: { verdict: failures.length ? 'fail' : 'pass', checked, failures, ...(dateGaps.length ? { dateGaps } : {}) }, panels };
}

/** One verdict over several audit passes (BG-12: the build's cards, then the oracle's lines): checks add up, failures join. */
export function mergeAudits(audits: CodeAudit[]): CodeAudit {
  const failures = audits.flatMap((a) => a.failures);
  const dateGaps = audits.flatMap((a) => a.dateGaps ?? []);
  return { verdict: failures.length ? 'fail' : 'pass', checked: audits.reduce((n, a) => n + a.checked, 0), failures, ...(dateGaps.length ? { dateGaps } : {}) };
}
