/**
 * Doc 46 §C.3 / doc 53 §4.1: the digest selects, counts, joins and dates engine fields; it never derives a sign, a lord,
 * an aspect, a dignity, a yoga or a house. This greps src/reading/digest/ for the shapes such a derivation takes in code
 * and fails on a hit: sign arithmetic on longitudes, house counting modulo twelve, hard-coded aspect tables, nakshatra
 * boundary constants, and sign-lord or exaltation tables.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '../../../../src/reading/digest');

const FORBIDDEN: Array<[string, RegExp]> = [
  ['sign from a longitude (/ 30)', /\/\s*30(?![\d.])/],
  ['house or sign count modulo 12', /%\s*12(?!\d)/],
  ['floor of a longitude', /Math\.(floor|trunc|round|ceil)\(\s*[\w.]*(lon|deg|longitude)/i],
  ['nakshatra span 13°20′ (13.33, 40/3, 800 arc-min)', /13\.33|40\s*\/\s*3\b|\b800\b|360\s*\/\s*27/],
  ['pada span 3°20′ (3.33, 10/3)', /\b3\.33|10\s*\/\s*3\b|360\s*\/\s*108/],
  ['twelve-sign arithmetic from the lagna', /\+\s*12\)\s*%|\(\s*\w+\s*-\s*\w+\s*\+\s*12\s*\)/],
  ['hard-coded graha drishti (7th, Mars 4/8, Jupiter 5/9, Saturn 3/10)', /\[\s*4\s*,\s*7\s*,\s*8\s*\]|\[\s*5\s*,\s*7\s*,\s*9\s*\]|\[\s*3\s*,\s*7\s*,\s*10\s*\]/],
  ['sign-lord or exaltation table', /\b(SIGN_LORDS|EXALTATION|DEBILITATION|MOOLATRIKONA|OWN_SIGNS)\b/],
  ['aspect table literal', /\b(GRAHA_DRISHTI|SPECIAL_ASPECTS|ASPECT_TABLE)\b\s*[:=]/],
];

function files(): string[] {
  return fs.readdirSync(DIR).filter((f) => /\.ts$/.test(f)).map((f) => path.join(DIR, f));
}

/** Source without comments, so a doc line that names a rule is not a hit. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('no astrology in the digest (doc 46 §C.3)', () => {
  it('src/reading/digest/ exists and has its modules', () => {
    const names = files().map((f) => path.basename(f));
    for (const n of ['types.ts', 'build.ts', 'load.ts', 'status.ts', 'annualSet.ts', 'activation.ts', 'event.ts']) expect(names).toContain(n);
  });

  for (const [label, re] of FORBIDDEN) {
    it(`no ${label}`, () => {
      const hits: string[] = [];
      for (const f of files()) {
        code(fs.readFileSync(f, 'utf8'))
          .split('\n')
          .forEach((line, i) => {
            if (re.test(line)) hits.push(`${path.basename(f)}:${i + 1}: ${line.trim()}`);
          });
      }
      expect(hits).toEqual([]);
    });
  }

  it('the checker catches the shapes it looks for', () => {
    const bad = ['const sign = Math.floor(lon / 30);', 'const house = (sign - lagna + 12) % 12 + 1;', 'const nak = Math.floor(longitude / 13.333);', 'const MARS = [4, 7, 8];', 'const SIGN_LORDS = {};'];
    for (const line of bad) expect(FORBIDDEN.some(([, re]) => re.test(line)), line).toBe(true);
    expect(FORBIDDEN.some(([, re]) => re.test('const minutes = Number(m[2]) / 60;'))).toBe(false);
  });
});
