/** Fake model answers for the clock layer tests: an honest reader and a concordance writer. No model is called. */
import type { GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { TONE_OF } from '../../../../src/reading/self/v3/yearFrame.js';
import { parseRowLines } from '../../../../src/reading/slices/index.js';
import { frame } from '../slices/fixtures.js';

export const result = (text: string): GeminiResult => ({ text, usage: { promptTokens: 1000, cachedTokens: 900, outputTokens: 200, thoughtTokens: 0 } as never, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false });

/** A reader that reads its own clock slice honestly: per span and matter, the tone of its rows (mixed when they differ). */
export function fakeReader(part: string): string {
  const own = /# CLOCK (\S+)/.exec(part)![1]!;
  const rows = parseRowLines(part.slice(part.indexOf(`# CLOCK ${own}`)));
  const cells: unknown[] = [];
  for (const s of frame().spans) {
    const by = new Map<string, Array<{ key: string; polarity: keyof typeof TONE_OF }>>();
    for (const r of rows.values()) {
      if (!(r.from < s.to && s.from < r.to)) continue;
      for (const m of r.matters) by.set(m, [...(by.get(m) ?? []), { key: r.key, polarity: r.polarity }]);
    }
    for (const [matter, rs] of by) {
      const tones = [...new Set(rs.map((x) => TONE_OF[x.polarity]))];
      cells.push({ span: s.id, matter, tone: tones.length === 1 ? tones[0] : 'mixed', sentence: `${own} reads ${matter}.`, strength: 2, evidence: rs.map((x) => x.key) });
    }
  }
  // one cell citing a row of another clock: the validator must drop it
  cells.push({ span: 's1', matter: 'career_and_standing', tone: 'heavy', sentence: 'Borrowed.', strength: 2, evidence: ['pressure:dasha:narayana/1/Le@2025-01-01'] });
  return JSON.stringify({ cells });
}

/** A concordance agent that writes every counted cell (words only, as the schema asks), and tries to raise a single cell to confirmed. */
export function fakeConcordance(part: string): string {
  const cells: unknown[] = [];
  const lines = part.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(ledger:\S+) status=(\w+) tone=(\w+)/.exec(lines[i]!);
    if (!m) continue;
    const clocks: Array<{ system: string; tone: string }> = [];
    for (let j = i + 1; j < lines.length && lines[j]!.startsWith('  '); j++) {
      const c = /^ {2}(\S+): (\w+) "/.exec(lines[j]!);
      if (c) clocks.push({ system: c[1]!, tone: c[2]! });
    }
    if (m[2] === 'contested') {
      const sides = ['heavy', 'mixed', 'light'].map((t) => ({ tone: t, clocks: clocks.filter((c) => c.tone === t).map((c) => c.system), restsOn: `the ${t} periods` })).filter((s) => s.clocks.length);
      cells.push({ id: m[1], sentence: '', sides });
    } else cells.push({ id: m[1], sentence: `The clocks agree: ${m[3]}.`, sides: [] });
  }
  cells.push({ id: 'ledger:s1/self_and_body', status: 'confirmed', tone: 'mixed', sentence: 'Raised.', sides: [] });
  return JSON.stringify({ cells });
}
