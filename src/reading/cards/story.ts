/**
 * The card story contract and the depth floor (docs/techniques/09 §3.3, §3.4, §5; AGENTS.md "Reading depth is a release
 * gate", rule 1). Pure: no model call, no database, no word lists.
 *
 * Every card carries two tellings of one story: the Oracle's technical story (700–1,400 words, in the fixed order of
 * `STORY_BEATS`) and the Personalizer's plain story (350–700 words, same order). The floor is checked in code by two
 * things only: the word count of each story, and the KINDS of the evidence keys the Oracle cites (a maha dasha and a
 * sub-period with their system, the year chart, D9, the card's own divisional chart, at least two verified dasha
 * systems). Nothing here reads the words themselves.
 *
 * A key's kind is read from its spelling, the spellings the slices and packs write:
 *   `pressure:dasha:<system>/<level>/<lord>@<date>`  `activation:<system>/<level>/<lord>@<date>`  a dasha period
 *   `pressure:annual:TP2026[/2/Sa…]`  `annual:TP2026.D1`  `annual:VP2026.D9`                       the year chart
 *   `planet:D9.Su`  `house:D10.h7`  `point:D9.AL`                                                    a divisional chart
 */
import { normaliseEvidenceKey } from '../self/v2/slices.js';

/** the nine beats of the story, in the order both tellings follow (doc 09 §2) */
export const STORY_BEATS = ['maha', 'sub', 'year', 'last_year', 'moon', 'd9_own', 'systems', 'trigger', 'verdict'] as const;
export type StoryBeatId = (typeof STORY_BEATS)[number];
export type BeatHeld = 'yes' | 'partly' | 'no' | 'na';
export const BEAT_HELD: readonly BeatHeld[] = ['yes', 'partly', 'no', 'na'];

/** one entry of the Oracle's beat index (not shown; the depth gate reads it) */
export interface StoryBeat {
  beat: StoryBeatId;
  held: BeatHeld;
  /** the dasha systems this beat used, by their stored id (`vimsottari`, `narayana`, …) */
  systems: string[];
  evidence: string[];
}

export const TECH_STORY_MIN_WORDS = 700;
export const TECH_STORY_MAX_WORDS = 1_400;
export const PLAIN_STORY_MIN_WORDS = 350;
export const PLAIN_STORY_MAX_WORDS = 700;
/** the floor's "at least two verified dasha systems" */
export const MIN_VERIFIED_SYSTEMS = 2;

export const wordCount = (s: string | null | undefined): number => (s ?? '').split(/\s+/).filter(Boolean).length;

export type KeyKind = 'dasha' | 'year' | 'varga' | 'other';

export interface KeyFacts {
  kind: KeyKind;
  /** dasha: the system id as stored (`vimsottari`, `narayana`, `dwisatpathi`, …) */
  system?: string;
  /** dasha: 1 maha dasha, 2 sub-period, 3 and deeper */
  level?: number;
  /** varga: `D1`, `D9`, `D10`, … */
  varga?: string;
}

const DASHA = /^(?:pressure:dasha:|activation:)([a-z_]+)\/(\d+)\/[^@\s]+(?:@\S*)?$/;
const YEAR = /^(?:pressure:)?annual:/;
const VARGA = /^(?:planet|house|point|varga):(D\d+)\b/;

/** What one evidence key names, from its spelling only. */
export function classifyKey(raw: string): KeyFacts {
  const key = normaliseEvidenceKey(raw.trim().replace(/^\{|\}$/g, ''));
  const d = DASHA.exec(key);
  if (d) return { kind: 'dasha', system: d[1]!, level: Number(d[2]) };
  if (YEAR.test(key)) return { kind: 'year' };
  const v = VARGA.exec(key);
  if (v) return { kind: 'varga', varga: v[1]!.toUpperCase() };
  return { kind: 'other' };
}

/** The evidence-key kinds a set of keys covers (what the depth floor counts). */
export interface KindCoverage {
  maha: boolean;
  sub: boolean;
  year: boolean;
  d9: boolean;
  /** the card's own divisional charts that are cited */
  ownCharts: string[];
  /** every dasha system cited, sorted */
  systems: string[];
  /** the cited systems that are on the verified list (all of them when no list is given) */
  verifiedSystems: string[];
}

export function kindCoverage(keys: Iterable<string>, ownCharts: readonly string[], verified: readonly string[] | null = null): KindCoverage {
  const own = new Set(ownCharts.map((c) => c.toUpperCase()));
  const cov: KindCoverage = { maha: false, sub: false, year: false, d9: false, ownCharts: [], systems: [], verifiedSystems: [] };
  const systems = new Set<string>();
  const ownSeen = new Set<string>();
  for (const k of keys) {
    const f = classifyKey(k);
    if (f.kind === 'dasha') {
      systems.add(f.system!);
      if (f.level === 1) cov.maha = true;
      if (f.level === 2) cov.sub = true;
    } else if (f.kind === 'year') cov.year = true;
    else if (f.kind === 'varga') {
      if (f.varga === 'D9') cov.d9 = true;
      if (own.has(f.varga!)) ownSeen.add(f.varga!);
    }
  }
  cov.systems = [...systems].sort();
  const allow = verified ? new Set(verified) : null;
  cov.verifiedSystems = cov.systems.filter((s) => !allow || allow.has(s));
  cov.ownCharts = [...ownSeen].sort();
  return cov;
}

export type DepthGapKind = 'story_words' | 'maha' | 'sub' | 'year' | 'd9' | 'own_chart' | 'systems' | 'plain_words';

export interface DepthGap {
  kind: DepthGapKind;
  message: string;
  /**
   * true when the INPUT the Oracle was given carried no key of this kind, so no repair can fix it: the gap is filed
   * (an engine or pack gap), never looped on. false: the model did not cite what it was given; repair or continue.
   */
  unavailable: boolean;
}

export interface DepthInput {
  /** the Oracle's technical story */
  story: string | null | undefined;
  /** every key the story rests on (the beat index's keys and the card's own `evidence`) */
  evidence: readonly string[];
  /** the card's own divisional charts (from the routing table; `D1` alone when the card has none of its own) */
  ownCharts: readonly string[];
  /** the verified systems shown for this chart (`clocks/systems.ts`); null: every cited system counts */
  verifiedSystems?: readonly string[] | null;
  /** the Personalizer's plain story; undefined: not checked here (the plain half has its own fallback) */
  plainStory?: string | null;
  /** the keys the Oracle was given; when present, a missing kind absent from it is marked `unavailable` */
  available?: Iterable<string> | null;
}

export interface DepthResult {
  ok: boolean;
  /** the technical half alone passes (the Oracle story may be stored and the plain half queued) */
  technicalOk: boolean;
  plainOk: boolean | null;
  words: { technical: number; plain: number | null };
  coverage: KindCoverage;
  gaps: DepthGap[];
}

/**
 * AGENTS.md "Reading depth is a release gate", rule 1, in code: word counts and evidence-key kinds only. A card that
 * fails is repaired or continued, never served thin. Pure.
 */
export function checkDepth(i: DepthInput): DepthResult {
  const own = i.ownCharts.length ? i.ownCharts : ['D1'];
  const keys = [...i.evidence, ...storyKeys(i.story ?? '')];
  const cov = kindCoverage(keys, own, i.verifiedSystems ?? null);
  const avail = i.available ? kindCoverage(i.available, own, i.verifiedSystems ?? null) : null;
  const gaps: DepthGap[] = [];
  const gap = (kind: DepthGapKind, message: string, given: boolean) => gaps.push({ kind, message, unavailable: avail ? !given : false });
  const tWords = wordCount(i.story);
  if (tWords < TECH_STORY_MIN_WORDS) gaps.push({ kind: 'story_words', message: `technical story ${tWords} words; at least ${TECH_STORY_MIN_WORDS}`, unavailable: false });
  if (!cov.maha) gap('maha', 'no maha dasha period cited by key', avail?.maha ?? true);
  if (!cov.sub) gap('sub', 'no sub-period cited by key', avail?.sub ?? true);
  if (!cov.year) gap('year', 'the year chart is not cited by key', avail?.year ?? true);
  if (!cov.d9) gap('d9', 'D9 is not cited by key', avail?.d9 ?? true);
  const needOwn = own.filter((c) => c !== 'D9' || own.length === 1);
  if (needOwn.length && !needOwn.some((c) => cov.ownCharts.includes(c))) gap('own_chart', `the card's own chart (${needOwn.join(' or ')}) is not cited by key`, avail ? needOwn.some((c) => avail.ownCharts.includes(c)) : true);
  if (cov.verifiedSystems.length < MIN_VERIFIED_SYSTEMS) gap('systems', `${cov.verifiedSystems.length} verified dasha system(s) cited (${cov.verifiedSystems.join(', ') || 'none'}); at least ${MIN_VERIFIED_SYSTEMS}`, avail ? avail.verifiedSystems.length >= MIN_VERIFIED_SYSTEMS : true);
  const technicalOk = gaps.length === 0;
  let plainOk: boolean | null = null;
  let pWords: number | null = null;
  if (i.plainStory !== undefined) {
    pWords = wordCount(i.plainStory);
    plainOk = pWords >= PLAIN_STORY_MIN_WORDS;
    if (!plainOk) gaps.push({ kind: 'plain_words', message: `plain story ${pWords} words; at least ${PLAIN_STORY_MIN_WORDS}`, unavailable: false });
  }
  return { ok: technicalOk && plainOk !== false, technicalOk, plainOk, words: { technical: tWords, plain: pWords }, coverage: cov, gaps };
}

/** `{key}` mentions inside a story text (a story may carry them; the beat index always does) */
export function storyKeys(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{([a-z_]+:[^{}\s]+)\}/gi)) out.push(m[1]!);
  return out;
}

/** every key a card's beat index and its evidence list cite, de-duplicated */
export function beatKeys(beats: ReadonlyArray<{ evidence: readonly string[] }> | null | undefined, extra: readonly string[] = []): string[] {
  return [...new Set([...(beats ?? []).flatMap((b) => b.evidence), ...extra].map((k) => normaliseEvidenceKey(k.trim().replace(/^\{|\}$/g, ''))))];
}

/** the repair note for a card below the floor: the gaps the model can fix (an unavailable kind is never asked for) */
export function depthRepairNote(r: DepthResult): string | null {
  const fixable = r.gaps.filter((g) => !g.unavailable && g.kind !== 'plain_words');
  if (!fixable.length) return null;
  return [
    'DEPTH: the story is below the floor. Write the whole card again; keep every field, and fix exactly this:',
    ...fixable.map((g) => `- ${g.message}`),
    `The story runs ${TECH_STORY_MIN_WORDS}–${TECH_STORY_MAX_WORDS} words in the fixed order, and the beat index cites each period, the year chart, D9 and the card's own chart by key.`,
  ].join('\n');
}

/** the Gemini responseSchema fragment of the beat index */
export function beatsSchema(): Record<string, unknown> {
  return {
    type: 'ARRAY',
    description: 'the beat index: one entry per beat, in order; not shown to the person',
    items: {
      type: 'OBJECT',
      properties: {
        beat: { type: 'STRING', enum: [...STORY_BEATS] },
        held: { type: 'STRING', enum: [...BEAT_HELD] },
        systems: { type: 'ARRAY', items: { type: 'STRING' }, description: 'the dasha systems this beat used, by id' },
        evidence: { type: 'ARRAY', items: { type: 'STRING' }, description: 'evidence keys from the input, without braces' },
      },
      required: ['beat', 'held', 'systems', 'evidence'],
    },
  };
}

/** Reads the beat index of a raw model card: unknown beats dropped, keys normalised. Pure. */
export function parseBeats(raw: unknown): StoryBeat[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryBeat[] = [];
  for (const b of raw as Array<Record<string, unknown>>) {
    const beat = typeof b?.beat === 'string' ? (b.beat.trim() as StoryBeatId) : null;
    if (!beat || !STORY_BEATS.includes(beat) || out.some((x) => x.beat === beat)) continue;
    const held = (BEAT_HELD as readonly string[]).includes(String(b.held)) ? (b.held as BeatHeld) : 'na';
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : []);
    out.push({ beat, held, systems: list(b.systems), evidence: list(b.evidence).map((k) => normaliseEvidenceKey(k.replace(/^\{|\}$/g, ''))) });
  }
  return out.sort((a, b) => STORY_BEATS.indexOf(a.beat) - STORY_BEATS.indexOf(b.beat));
}
