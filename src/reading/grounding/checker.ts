/**
 * Prose grounding checker: extracts astrological assertions from a final answer (planet in house, planet in sign, house
 * lord, running dasha, mahadasha end, varga lagna, transit sign with end date) and verifies each against the dossier and
 * the transit chart. Headline metric: `contradicted` (target 0). Deterministic and free, so it can run on every eval and
 * on every stored run. Anything it cannot place in a chart context is reported as `unverifiable`, never as a failure.
 *
 * Conservative by design: a sentence that mixes natal and transit talk, or names a chart this dossier does not carry, is
 * skipped rather than guessed at.
 */
import type { PlanetCode, VargaKey } from '../facts/constants.js';
import { SIGN_NAMES } from '../facts/constants.js';
import type { Dossier } from '../facts/types.js';
import type { TransitChart } from '../transits/types.js';

export type Verdict = 'verified' | 'contradicted' | 'unverifiable';
export interface CheckItem {
  kind: string;
  sentence: string;
  claim: string;
  verdict: Verdict;
  expected?: string;
}
export interface CheckResult {
  checked: number;
  verified: number;
  contradicted: number;
  unverifiable: number;
  items: CheckItem[];
}

const PLANETS: Record<string, PlanetCode> = {
  sun: 'Su', surya: 'Su', moon: 'Mo', chandra: 'Mo', mars: 'Ma', mangal: 'Ma', mercury: 'Me', budha: 'Me', jupiter: 'Ju', guru: 'Ju', venus: 'Ve', shukra: 'Ve', saturn: 'Sa', shani: 'Sa', rahu: 'Ra', ketu: 'Ke',
};
const PLANET_RE = '(?:sun|surya|moon|chandra|mars|mangal|mercury|budha|jupiter|guru|venus|shukra|saturn|shani|rahu|ketu)';
const SIGN_RE = `(?:${SIGN_NAMES.map((s) => s.toLowerCase()).join('|')})`;
const ORD = String.raw`(\d{1,2})(?:st|nd|rd|th)`;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const VARGA_WORDS: Array<[RegExp, VargaKey]> = [
  [/\bD-?10\b|\bdas(?:h)?amsa\b/i, 'D10'],
  [/\bD-?9\b|\bnavamsa\b/i, 'D9'],
  [/\bD-?4\b|\bchaturthamsa\b/i, 'D4'],
  [/\bD-?7\b|\bsaptamsa\b/i, 'D7'],
  [/\bD-?2\b/i, 'D2'],
  [/\bD-?12\b/i, 'D12'],
  [/\bD-?30\b/i, 'D30'],
  [/\bD-?3\b/i, 'D3'],
  [/\bD-?60\b/i, 'D60'],
];

const planetOf = (w: string): PlanetCode => PLANETS[w.toLowerCase()]!;
const signIndex = (w: string): number => SIGN_NAMES.findIndex((s) => s.toLowerCase() === w.toLowerCase());

function monthYear(s: string): { y: number; m: number | null } | null {
  const a = new RegExp(String.raw`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?(\d{4})\b`, 'i').exec(s);
  if (a) return { y: Number(a[2]), m: MONTHS.indexOf(a[1]!.toLowerCase()) + 1 };
  const b = /\b(\d{4})-(\d{2})(?:-\d{2})?\b/.exec(s);
  if (b) return { y: Number(b[1]), m: Number(b[2]) };
  const c = /\b(20\d{2}|19\d{2})\b/.exec(s);
  return c ? { y: Number(c[1]), m: null } : null;
}

const monthDist = (a: { y: number; m: number | null }, iso: string): number => {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return a.m == null ? Math.abs(a.y - y) * 12 : Math.abs((a.y - y) * 12 + (a.m - m));
};

/** In a table whose header names a transit column ("Transit trigger"), mark that column's cells as transit statements. */
function tagTransitColumns(text: string): string {
  const isSeparator = (l: string) => /^\s*\|?\s*:?-{2,}/.test(l);
  const lines = text.split('\n');
  let transitCols: number[] = [];
  return lines
    .map((line, i) => {
      if (!line.trim().startsWith('|')) {
        transitCols = [];
        return line;
      }
      if (isSeparator(line)) return line;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|');
      if (isSeparator(lines[i + 1] ?? '')) {
        transitCols = cells.map((c, idx) => (/\btransit/i.test(c) ? idx : -1)).filter((x) => x >= 0);
        return line;
      }
      if (transitCols.length === 0) return line;
      return '|' + cells.map((c, idx) => (transitCols.includes(idx) && c.trim() ? `${c} (transit)` : c)).join('|') + '|';
    })
    .join('\n');
}

function sentences(text: string): string[] {
  const plain = tagTransitColumns(text).replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '');
  return plain
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6 && !/^\|?\s*:?-{2,}/.test(s));
}

interface Ctx {
  d: Dossier;
  t: TransitChart | null;
  asOf: string;
}

function varga(sentence: string): VargaKey | null | undefined | 'unknown' {
  for (const [re, key] of VARGA_WORDS) if (re.test(sentence)) return key;
  if (/\bD-?1\b|\brasi chart\b/i.test(sentence)) return null; // explicit D-1
  const other = /\bD-?(\d{1,3})\b/i.exec(sentence);
  if (other) return 'unknown'; // a divisional chart this dossier does not carry (e.g. D-24)
  return undefined; // no varga named
}

function transitContext(sentence: string): 'transit' | 'natal' | 'mixed' {
  const tr = /\b(transit\w*|gochara|currently|right now|at present|these days|today|this month)\b/i.test(sentence);
  const natal = /\b(natal|birth chart|janma|in your chart|by birth)\b/i.test(sentence);
  if (tr && natal) return 'mixed';
  return tr ? 'transit' : 'natal';
}

function nowRow(c: Ctx, p: PlanetCode) {
  return c.t?.rows.find((r) => r.planet === p && r.from <= c.asOf && c.asOf <= r.to) ?? null;
}

/** A month/year or range written in the sentence (ignoring "until ..." end dates), as ISO bounds; null means "today". */
function referencedPeriod(sentence: string): { from: string; to: string } | null {
  const text = sentence.replace(/\b(?:until|till|through to|up to)\s+[A-Za-z]{3,9}\.?\s+(?:\d{1,2},?\s+)?\d{4}/gi, ' ').replace(/\b(?:until|till)\s+\d{4}/gi, ' ');
  const re = /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4})(?:\s*(?:[-–—]|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4}))?/i.exec(text);
  if (!re) return null;
  const a = monthYear(re[1]!);
  const b = re[2] ? monthYear(re[2]) : a;
  if (!a || !b) return null;
  const from = `${a.y}-${String(a.m ?? 1).padStart(2, '0')}-01`;
  const to = `${b.y}-${String(b.m ?? 12).padStart(2, '0')}-31`;
  return { from, to };
}

function rowsFor(c: Ctx, p: PlanetCode, period: { from: string; to: string } | null) {
  if (!c.t) return [];
  if (!period) {
    const r = nowRow(c, p);
    return r ? [r] : [];
  }
  return c.t.rows.filter((r) => r.planet === p && r.from <= period.to && r.to >= period.from);
}

function add(items: CheckItem[], kind: string, sentence: string, claim: string, verdict: Verdict, expected?: string): void {
  items.push({ kind, sentence: sentence.slice(0, 220), claim, verdict, ...(expected ? { expected } : {}) });
}

function checkSentence(s: string, c: Ctx, items: CheckItem[]): void {
  const ctx = transitContext(s);
  const vk = varga(s);
  const aspectish = /\b(aspect\w*|drishti|conjunct\w*|with|owns?|rules?|ruled)\b/i;

  // 1. planets in the Nth house ("Mercury, Venus and Saturn sit in the 9th house")
  const house = new RegExp(String.raw`\b((?:${PLANET_RE})(?:\s*(?:,|and|&)\s*(?:${PLANET_RE}))*)\b[^.|;]{0,45}?\b(?:placed in|posited in|sits? in|sitting in|occupies|occupying|located in|is in|are in|are all in|all in|resid\w+ in|in)\s+(?:the\s+|your\s+)*${ORD}\s+house`, 'gi');
  for (let m = house.exec(s); m; m = house.exec(s)) {
    const between = m[0].slice(m[1]!.length);
    if (aspectish.test(between.replace(/\bwith\b/i, '')) || /\bhouse of\b/i.test(between)) continue;
    const planets = [...m[1]!.matchAll(new RegExp(PLANET_RE, 'gi'))].map((x) => planetOf(x[0]));
    const n = Number(m[2]);
    for (const p of planets) {
      const claim = `${p} in house ${n}`;
      if (ctx === 'mixed') { add(items, 'planet_house', s, claim, 'unverifiable'); continue; }
      if (vk === 'unknown') { add(items, 'varga_planet_house', s, claim, 'unverifiable'); continue; }
      if (vk === undefined || vk === 'D1' || vk === null) {
        if (ctx === 'transit') {
          const rows = rowsFor(c, p, referencedPeriod(s));
          if (rows.length === 0) add(items, 'transit_house', s, claim, 'unverifiable');
          else add(items, 'transit_house', s, claim, rows.some((r) => r.house_from_lagna === n) ? 'verified' : 'contradicted', rows.map((r) => `house ${r.house_from_lagna}`).join('/'));
        } else {
          const b = c.d.bodies[p];
          add(items, 'planet_house', s, claim, b && b.house === n ? 'verified' : 'contradicted', b ? `house ${b.house}` : undefined);
        }
      } else {
        const v = c.d.vargas[vk]?.planets[p];
        if (!v) add(items, 'varga_planet_house', s, `${claim} in ${vk}`, 'unverifiable');
        else add(items, 'varga_planet_house', s, `${claim} in ${vk}`, v.house === n ? 'verified' : 'contradicted', `${vk} house ${v.house}`);
      }
    }
  }

  // 2. planet in sign ("Mercury is in Taurus", "Saturn in Pisces until June 2027")
  const sign = new RegExp(String.raw`\b(${PLANET_RE})\b[^.|;]{0,30}?\b(?:is in|sits in|placed in|posited in|in|through|transiting|transits)\s+(?:the sign of\s+)?(${SIGN_RE})\b(?:[^.|;]{0,30}?\b(?:until|till|through to|up to)\s+([A-Za-z]{3,9}\.?\s+(?:\d{1,2},?\s+)?\d{4}|\d{4}))?`, 'gi');
  for (let m = sign.exec(s); m; m = sign.exec(s)) {
    if (/\b(aspect\w*|conjunct|lord of|owns?)\b/i.test(m[0])) continue;
    const p = planetOf(m[1]!);
    const si = signIndex(m[2]!);
    const claim = `${p} in ${SIGN_NAMES[si]}`;
    if (ctx === 'mixed' || vk === 'unknown') { add(items, 'planet_sign', s, claim, 'unverifiable'); continue; }
    if (ctx === 'transit') {
      const period = referencedPeriod(s);
      const rows = rowsFor(c, p, period);
      if (rows.length === 0) { add(items, 'transit_sign', s, claim, 'unverifiable'); continue; }
      const r = rows.find((x) => x.sign === si) ?? rows[0]!;
      const okSign = rows.some((x) => x.sign === si);
      add(items, 'transit_sign', s, claim, okSign ? 'verified' : 'contradicted', rows.map((x) => `${x.sign_name} ${x.from}..${x.to}`).join(', '));
      if (okSign && m[3]) {
        const until = monthYear(m[3]);
        if (until) {
          // the row ends the day before the next ingress; accept the end month or the one after (timezone/boundary)
          const dist = monthDist(until, r.to);
          add(items, 'transit_until', s, `${p} in ${SIGN_NAMES[si]} until ${m[3]}`, dist <= 1 ? 'verified' : 'contradicted', `row ends ${r.to}`);
        }
      }
    } else if (vk === undefined || vk === 'D1' || vk === null) {
      const b = c.d.bodies[p];
      const natalOk = !!b && b.sign === si;
      // No natal or transit cue in the sentence: a sign that differs from the birth chart but matches a transit
      // position in the loaded range is more likely a transit statement than a natal error, so do not call it false.
      const explicitNatal = /\b(natal|birth chart|janma|in your chart|by birth)\b/i.test(s);
      const matchesSomeTransit = !natalOk && !explicitNatal && !!c.t?.rows.some((r) => r.planet === p && r.sign === si);
      add(items, 'planet_sign', s, claim, natalOk ? 'verified' : matchesSomeTransit ? 'unverifiable' : 'contradicted', b ? b.sign_name : undefined);
    } else {
      const v = c.d.vargas[vk]?.planets[p];
      add(items, 'varga_planet_sign', s, `${claim} in ${vk}`, !v ? 'unverifiable' : v.sign === si ? 'verified' : 'contradicted', v ? SIGN_NAMES[v.sign] : undefined);
    }
  }

  // 3. house lords
  const lordPatterns: Array<[RegExp, (m: RegExpExecArray) => Array<{ h: number; p: PlanetCode }>]> = [
    [new RegExp(String.raw`\b${ORD}\s+(?:house\s+)?lord\s*(?:is|=|:|being|,)?\s*(?:the\s+)?(${PLANET_RE})\b`, 'gi'), (m) => [{ h: Number(m[1]), p: planetOf(m[2]!) }]],
    [new RegExp(String.raw`\b(${PLANET_RE})\b,?\s+(?:is\s+|as\s+)?(?:the\s+|your\s+)?(?:lord of|ruler of|rules?)\s+(?:the\s+|your\s+)?${ORD}(?:\s+and\s+${ORD})?(?:\s+houses?)?`, 'gi'), (m) => [{ h: Number(m[2]), p: planetOf(m[1]!) }, ...(m[3] ? [{ h: Number(m[3]), p: planetOf(m[1]!) }] : [])]],
    [new RegExp(String.raw`\blord of (?:the\s+|your\s+)?${ORD}(?:\s+house)?\s+(?:is|being)\s+(${PLANET_RE})\b`, 'gi'), (m) => [{ h: Number(m[1]), p: planetOf(m[2]!) }]],
    [new RegExp(String.raw`\b(${PLANET_RE})\b\s+(?:is|as)\s+(?:the\s+|your\s+)?${ORD}\s+lord\b`, 'gi'), (m) => [{ h: Number(m[2]), p: planetOf(m[1]!) }]],
  ];
  for (const [re, fn] of lordPatterns) {
    for (let m = re.exec(s); m; m = re.exec(s)) {
      for (const { h, p } of fn(m)) {
        if (h < 1 || h > 12) continue;
        const claim = `${h}th lord is ${p}`;
        if (vk === 'unknown') { add(items, 'varga_house_lord', s, claim, 'unverifiable'); continue; }
        if (vk && vk !== 'D1') {
          const vh = c.d.vargas[vk]?.houses[String(h)];
          add(items, 'varga_house_lord', s, `${claim} in ${vk}`, !vh ? 'unverifiable' : vh.lord === p ? 'verified' : 'contradicted', vh?.lord);
        } else {
          const hh = c.d.houses[String(h)];
          add(items, 'house_lord', s, claim, hh && (hh.lord === p || hh.co_lord === p) ? 'verified' : 'contradicted', hh ? `${hh.lord}${hh.co_lord ? `/${hh.co_lord}` : ''}` : undefined);
        }
      }
    }
  }

  // 4. running dasha triple or pair ("Saturn–Ketu–Sun", "Saturn-Ketu antardasha")
  const triple = new RegExp(String.raw`\b(${PLANET_RE})\s*[-–—/]\s*(${PLANET_RE})(?:\s*[-–—/]\s*(${PLANET_RE}))?\b`, 'gi');
  for (let m = triple.exec(s); m; m = triple.exec(s)) {
    if (!/\b(dasha|period|antardasha|bhukti|pratyantardasha|running|MD|AD|PD|Mahadasha)\b/i.test(s) && !m[3]) continue;
    const md = planetOf(m[1]!);
    const ad = planetOf(m[2]!);
    const pd = m[3] ? planetOf(m[3]) : null;
    const claim = `${md}-${ad}${pd ? `-${pd}` : ''}`;
    const periods = c.d.dasha.vimshottari.periods;
    const exists = periods.some((p) => p.md === md && p.ad === ad && (!pd || p.pd === pd));
    const mdKnown = c.d.dasha.vimshottari.mahadashas.some((x) => x.md === md);
    if (!mdKnown) { add(items, 'dasha_period', s, claim, 'unverifiable'); continue; }
    const running = /\b(currently|now|running|present|at present)\b/i.test(s) && !/\b(will|next|upcoming|from|begin|starts?)\b/i.test(s);
    if (running) {
      const cur = c.d.dasha.vimshottari.current;
      const ok = cur.md === md && cur.ad === ad && (!pd || cur.pd === pd);
      add(items, 'dasha_running', s, claim, ok ? 'verified' : 'contradicted', `${cur.md}-${cur.ad}-${cur.pd ?? '?'}`);
    } else {
      // the PD rows only cover a window; an AD-level pair is checkable against the mahadasha list
      const adOnly = periods.some((p) => p.md === md && p.ad === ad);
      if (pd && !exists && !adOnly) add(items, 'dasha_period', s, claim, 'contradicted');
      else add(items, 'dasha_period', s, claim, exists || adOnly ? 'verified' : 'unverifiable');
    }
  }

  // 5. mahadasha end ("Saturn Mahadasha until 2039", "Saturn dasha ends November 2039")
  const mdEnd = new RegExp(String.raw`\b(${PLANET_RE})\s+(?:maha\s?dasha|mahadasha|MD|major period)\b[^.|;]{0,40}?\b(?:until|till|ends?(?:\s+in)?|through|to)\s+([A-Za-z]{3,9}\.?\s+(?:\d{1,2},?\s+)?\d{4}|\d{4})`, 'gi');
  for (let m = mdEnd.exec(s); m; m = mdEnd.exec(s)) {
    const p = planetOf(m[1]!);
    const when = monthYear(m[2]!);
    const rows = c.d.dasha.vimshottari.mahadashas.filter((x) => x.md === p);
    if (!when || rows.length === 0) { add(items, 'mahadasha_end', s, `${p} MD until ${m[2]}`, 'unverifiable'); continue; }
    const best = Math.min(...rows.map((r) => monthDist(when, r.end)));
    add(items, 'mahadasha_end', s, `${p} MD until ${m[2]}`, best <= 1 ? 'verified' : 'contradicted', rows.map((r) => `${r.start}..${r.end}`).join(', '));
  }

  // 6. divisional lagna ("D-10 lagna is Scorpio")
  const vl = new RegExp(String.raw`\b(D-?\d{1,2}|navamsa|dasamsa|dashamsa)\s+(?:lagna|ascendant)\s+(?:is|=|in)\s+(${SIGN_RE})\b`, 'gi');
  for (let m = vl.exec(s); m; m = vl.exec(s)) {
    const key = VARGA_WORDS.find(([re]) => re.test(m![1]!))?.[1];
    const si = signIndex(m[2]!);
    const v = key ? c.d.vargas[key] : undefined;
    add(items, 'varga_lagna', s, `${key} lagna ${SIGN_NAMES[si]}`, !v ? 'unverifiable' : v.lagna_sign === si ? 'verified' : 'contradicted', v ? SIGN_NAMES[v.lagna_sign] : undefined);
  }
}

export function checkAnswer(answer: string, d: Dossier, t: TransitChart | null, asOf: string): CheckResult {
  const items: CheckItem[] = [];
  const c: Ctx = { d, t, asOf };
  for (const s of sentences(answer)) checkSentence(s, c, items);
  const count = (v: Verdict) => items.filter((i) => i.verdict === v).length;
  return { checked: items.length, verified: count('verified'), contradicted: count('contradicted'), unverifiable: count('unverifiable'), items };
}

// ---- window sanity -------------------------------------------------------------------------------------

export interface WindowCheck {
  found: number;
  insideHorizon: number;
  outside: string[];
}

/** Date ranges written in the answer ("Nov 2026 – Mar 2027") must lie inside the horizon. */
export function checkWindows(answer: string, horizon: { from: string; to: string }): WindowCheck {
  const re = /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4})\s*(?:[-–—]|to|until)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4})/gi;
  let found = 0;
  let inside = 0;
  const outside: string[] = [];
  for (let m = re.exec(answer); m; m = re.exec(answer)) {
    const a = monthYear(m[1]!);
    const b = monthYear(m[2]!);
    if (!a || !b) continue;
    found += 1;
    const from = `${a.y}-${String(a.m ?? 1).padStart(2, '0')}`;
    const to = `${b.y}-${String(b.m ?? 12).padStart(2, '0')}`;
    // allow the month containing the horizon edges
    if (to >= horizon.from.slice(0, 7) && from <= horizon.to.slice(0, 7)) inside += 1;
    else outside.push(m[0]);
  }
  return { found, insideHorizon: inside, outside };
}
