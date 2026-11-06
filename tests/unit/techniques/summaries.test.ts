/**
 * Run summaries hold counts, ids, tones and scores only (docs/admin/03 §4.1): no birth data, names, typed places or question
 * text. This reads every withAgentRun call site's `input: {…}` and `output: {…}` literals and checks their keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const CALL_SITES = ['src/reading/area/careerService.ts', 'src/reading/area/boardService.ts', 'src/reading/luckyTimes/service.ts'];
const PERSONAL = /email|name|birth|dob|place|lat|lon|question/i;

/** The keys of every `input: { … }` / `output: { … }` literal (one level; shorthand and `key:` forms). */
function summaryKeys(src: string): Array<{ kind: string; keys: string[] }> {
  const out: Array<{ kind: string; keys: string[] }> = [];
  const re = /\b(input|output)\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{' || src[i] === '(' || src[i] === '[') depth++;
      else if (src[i] === '}' || src[i] === ')' || src[i] === ']') depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    // top-level members only
    const keys: string[] = [];
    let d = 0;
    let member = '';
    for (const ch of `${body},`) {
      if ('{(['.includes(ch)) d++;
      if ('})]'.includes(ch)) d--;
      if (ch === ',' && d === 0) {
        const k = /^\s*(?:\.\.\.)?\s*([A-Za-z_$][\w$]*)/.exec(member)?.[1];
        if (k) keys.push(k);
        member = '';
      } else member += ch;
    }
    out.push({ kind: m[1]!, keys });
  }
  return out;
}

describe('agent run summaries carry no personal keys', () => {
  for (const file of CALL_SITES) {
    it(file, () => {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const found = summaryKeys(src);
      expect(found.length).toBeGreaterThan(0);
      for (const f of found) for (const k of f.keys) expect(k, `${file} ${f.kind}.${k}`).not.toMatch(PERSONAL);
    });
  }

  it('the checker catches a personal key', () => {
    const keys = summaryKeys("withAgentRun(p, 'x', { task: 't', input: { birth_place: b, n: 1 } }, async () => ({ value: 1, output: { name } }))").flatMap((f) => f.keys);
    expect(keys).toEqual(['birth_place', 'n', 'name']);
    expect(keys.filter((k) => PERSONAL.test(k))).toEqual(['birth_place', 'name']);
  });
});
