/**
 * The model layer of the You reading (technique `self.reading.oracle`, agent `self.reading_oracle`,
 * docs/reading-engine/58 §4.1). OFF unless SELF_READING_MODEL=1: no call is made before Sachin's yes on key, count and
 * cost (§7). It reads only the panel claims, their evidence keys and certainty, the clock and the person's confirm
 * answers; the reader R15-self and the Self Oracle prompt may rephrase, never add. The validator keeps a paragraph only
 * when every evidence key it cites is in the input.
 */
import { isSelfReadingModelEnabled } from '../../config/env.js';
import { callGemini } from '../llm/gemini.js';
import { modelFor } from '../llm/models.js';
import { PROMPTS } from '../prompts/generated.js';
import type { ConfirmAnswer, SelfReading } from './types.js';

export interface SelfOracleResult {
  status: 'off' | 'ok' | 'failed';
  text?: string;
  dropped?: number;
  calls?: number;
}

/** The BRIEF: one line per usable claim, `[id] (certainty) text — detail {evidence}`. Withheld claims are left out. */
export function selfBrief(reading: SelfReading, answers: Record<string, ConfirmAnswer>): { text: string; keys: Set<string> } {
  const keys = new Set<string>();
  const lines: string[] = [`READING CLOCK: ${reading.clock.label} (${reading.clock.reason}); confirming: ${reading.clock.confirming.map((c) => c.label).join(', ')}`, `TODAY: ${reading.asOf}`];
  for (const p of reading.panels) {
    if (p.status === 'failed' || p.status === 'withheld') continue;
    lines.push(`\n## ${p.title}`);
    for (const c of p.claims) {
      if (c.withheld) continue;
      c.evidence.forEach((e) => keys.add(e));
      lines.push(`[${c.id}] (${c.certainty}) ${c.text} — ${c.detail} {${c.evidence.join(', ')}}`);
    }
  }
  const facts = Object.entries(answers).map(([k, v]) => `${k}: ${v}`);
  if (facts.length) lines.push(`\nFACTS (the person's answers): ${facts.join('; ')}`);
  return { text: lines.join('\n'), keys };
}

/** Drops a paragraph that cites an evidence key not in the BRIEF. Paragraphs without citations are kept. */
export function validateSelfText(text: string, keys: Set<string>): { text: string; dropped: number } {
  let dropped = 0;
  const kept = text.split(/\n{2,}/).filter((para) => {
    const cited = [...para.matchAll(/\{([^}]+)\}/g)].flatMap((m) => m[1]!.split(',').map((s) => s.trim()));
    const ok = cited.every((k) => keys.has(k));
    if (!ok) dropped++;
    return ok;
  });
  return { text: kept.map((p) => p.replace(/\s*\{[^}]+\}/g, '')).join('\n\n'), dropped };
}

export async function runSelfOracle(reading: SelfReading, answers: Record<string, ConfirmAnswer>): Promise<SelfOracleResult> {
  if (!isSelfReadingModelEnabled()) return { status: 'off' };
  const brief = selfBrief(reading, answers);
  try {
    const findings = await callGemini({ model: modelFor('reader'), node: 'self.reader', system: `${PROMPTS['readers/_shared'] ?? ''}\n\n${PROMPTS['readers/R15-self'] ?? ''}`, parts: [brief.text], thinking: 'low', maxOutputTokens: 2000 });
    const out = await callGemini({ model: modelFor('oracle'), node: 'self.oracle', system: PROMPTS['oracle/self'] ?? '', parts: [brief.text, `FINDINGS:\n${findings.text}\n\nCite evidence keys in {braces} at the end of each paragraph.`], thinking: 'low', maxOutputTokens: 2500 });
    const v = validateSelfText(out.text, brief.keys);
    return { status: 'ok', text: v.text, dropped: v.dropped, calls: 2 };
  } catch (e) {
    console.error('[self:oracle]', (e as Error).message);
    return { status: 'failed', calls: 2 };
  }
}
