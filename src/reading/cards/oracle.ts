/**
 * Layer 4 of doc 70 §4.1: one Oracle call per card. Every card call shares one cached prefix with the clock readers
 * (the common system prompt plus natal.core, sky.window, year.tp and frame); its uncached part is small: the card role,
 * the card brief, the titles of the cards on the board ("you write only this one"), the year frame with its held tones,
 * the agreed ledger cells and the dated rows of the card's matters, and the person's answers.
 *
 * The validator is the v3 Oracle's (`checkOracleCard`: every span once with the frame's tone, heavy never build, keys
 * and dates from the input, a knot and a gift) plus the ledger: a span that has ledger cells for this card cites one of
 * them; `build` needs a confirmed or leaning light or mixed cell of the card in that span, or a held light span. A failed
 * card is re-asked once, alone. Never throws.
 *
 * The story contract (docs/techniques/09 §3.4, §8 step 8; on unless CARDS_STORY_CONTRACT=0): the card also writes its
 * technical story (700–1,400 words, the nine beats in order) and the beat index, over its lens thread, the family
 * findings it cites, the clock sentences of its matters and the verified systems. The call's ceiling is 10,000 tokens and
 * it is continued at the ceiling, never cut (`llm/continue.ts`); the depth floor (`cards/story.ts` checkDepth) is checked
 * before the card is returned as ready: one repair names what is missing; a card still below it comes back `thin` and
 * the runner queues it. A kind the input never carried (no year row stored) is reported as an input gap, not repaired.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { getCardsOracleMaxOutputTokens, getCardsOracleTimeoutMs, isCardsStoryContractEnabled } from '../../config/env.js';
import type { AgreedLedger, LedgerCell } from '../clocks/types.js';
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';
import { callWithContinuation, parseContinuedJson } from '../llm/continue.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { timingOf } from '../self/v2/oracle.js';
import { redactEngineText } from '../self/v2/personalizerValidate.js';
import { normaliseEvidenceKey, promptText } from '../self/v2/slices.js';
import type { SelfBuildContext, SelfV2AgentTiming, ValidationIssue } from '../self/v2types.js';
import { checkOracleCard, oracleV3Schema } from '../self/v3/oracle.js';
import type { CardMatter, OracleCardV3, CardId, YearFrameV3 } from '../self/v3/types.js';
import { cmp } from '../slices/render.js';
import { cardMatterRows, frameRange } from '../slices/trim.js';
import type { RenderedSlice } from '../slices/types.js';
import { CARD_ORACLE_AGENT, CARD_ORACLE_PROMPT, CARD_READING_TECHNIQUE, cardBriefPrompt } from './types.js';
import { isAgeMatureD9 } from '../dasha/dashaAssessment.js';
import { cardBoardLabel } from './registry.js';
import { beatKeys, beatsSchema, checkDepth, depthRepairNote, parseBeats, STORY_BEATS, TECH_STORY_MAX_WORDS, TECH_STORY_MIN_WORDS, type DepthResult } from './story.js';
import { cardTechniqueKeys, techniqueBoardsOf, type BoardTechniqueSection, type TechniqueBoard } from './techniques.js';

/** the default wall time per card, continuations included (env CARDS_ORACLE_TIMEOUT_MS; doc 09 §3.1) */
export const CARD_ORACLE_TIMEOUT_MS = 150_000;
/**
 * One card's document with its technical story (doc 09 decision 7): 10,000 tokens a call, continued at the ceiling.
 * Expected 3,000–6,000 (story 700–1,400 words ≈ 1,000–2,000 tokens, the spans and the beat index, thought tokens).
 * Env CARDS_ORACLE_MAX_OUTPUT_TOKENS. Before doc 09 it was 4,096 for a one-paragraph card.
 */
export const CARD_ORACLE_MAX_OUTPUT_TOKENS = 10_000;

/** the agreed ledger cells of the card's matters, in span then matter order */
export function cardCells(ledger: AgreedLedger | null, matters: readonly CardMatter[]): LedgerCell[] {
  if (!ledger) return [];
  const want = new Set<string>(matters);
  return ledger.cells.filter((c) => want.has(c.matter));
}

/** The ledger block a card reads: one line per cell with its status as counted, the words, and its keys. */
export function renderCardLedger(cells: readonly LedgerCell[]): { text: string; keys: string[] } {
  const keys = new Set<string>();
  const L = ['AGREED LEDGER (this card\'s matters; the status is counted in code and final)'];
  for (const c of cells) {
    keys.add(c.id);
    for (const k of c.evidence) keys.add(k);
    const words = c.sentence ? ` "${c.sentence}"` : c.sides?.length ? ` split: ${c.sides.map((s) => `${s.tone} (${s.clocks.join(', ')}): ${s.restsOn}`).join(' | ')}` : '';
    L.push(`{${c.id}} status=${c.status} tone=${c.tone ?? 'none'} agree=${c.agree}/${c.of}${words} evidence ${c.evidence.map((k) => `{${k}}`).join(' ')}`);
  }
  if (!cells.length) L.push('(no cells for this card\'s matters)');
  return { text: L.join('\n'), keys: [...keys].sort(cmp) };
}

export interface ActiveTimingMotionSignals {
  mdRetro?: boolean;
  adRetro?: boolean;
  mdStationary?: boolean;
  adStationary?: boolean;
  mdMotionState?: string | null;
  adMotionState?: string | null;
  mdCheshtaBala?: number | null;
  tpYearLordRetro?: boolean;
  tpOperatingPosture?: string | null;
  stationCount?: number;
}

export interface ActiveTimingBlockInput {
  clock?: { primary?: string } | null;
  frameClock?: string | null;
  periods?: {
    running?: { lord: string; from: string; to: string } | null;
    runningSub?: { lord: string; from: string; to: string } | null;
  } | null;
  year?: {
    from?: string | null;
    to?: string | null;
    yearLord?: string | null;
    shortClock?: { lord: string; from: string; to: string } | null;
  } | null;
  ageYears?: number | null;
  spans?: Array<{ tone?: string; id?: string }>;
  card?: CardId | null;
  motion?: ActiveTimingMotionSignals | null;
}

/**
 * Shared deterministic helper for card-level timing and divisional chart routing.
 * Called by both grouped-card path (buildCardPack) and single-card path (cardInstruction).
 */
export function renderActiveTimingAndVargaBlock(input: ActiveTimingBlockInput): string[] {
  const isMature = isAgeMatureD9(input.ageYears);
  const activeClock = input.clock?.primary ?? input.frameClock ?? 'vimshottari';
  const runningMd = input.periods?.running;
  const runningAd = input.periods?.runningSub;
  const activeYear = input.year;
  const spans = input.spans ?? [];

  const motion = input.motion;
  const lines: string[] = [
    '# ACTIVE DASHA & TIMING WINDOWS',
    `- Active Reading Clock: ${activeClock}`,
    ...(runningMd
      ? [
          `- Current Mahadasha: ${runningMd.lord} (${runningMd.from} to ${runningMd.to})${motion?.mdStationary ? ' [stationary/vikala — pivotal pause]' : motion?.mdRetro ? ` [retrograde/${motion.mdMotionState ?? 'vakra'}${typeof motion.mdCheshtaBala === 'number' ? `, Cheshta=${motion.mdCheshtaBala.toFixed(1)}` : ''} — iterative second-pass delivery]` : ''}`,
        ]
      : []),
    ...(runningAd
      ? [
          `- Current Antardasha: ${runningAd.lord} (${runningAd.from} to ${runningAd.to})${motion?.adStationary ? ' [stationary/vikala]' : motion?.adRetro ? ` [retrograde/${motion.adMotionState ?? 'vakra'} — review & rework]` : ''}`,
        ]
      : []),
    ...(activeYear
      ? [
          `- Running Tithi Pravesha Year: ${activeYear.from?.slice(0, 4) ?? ''} (${activeYear.from ?? ''} to ${activeYear.to ?? ''})`,
          `- Annual Year Lord: ${activeYear.yearLord ?? 'unresolved'}${motion?.tpYearLordRetro ? ' [retrograde in annual chart — iterative_review posture]' : ''}`,
          ...(motion?.tpOperatingPosture
            ? [`- Annual Operating Posture: ${motion.tpOperatingPosture}`]
            : []),
          ...(activeYear.shortClock
            ? [`- Annual Short Clock: ${activeYear.shortClock.lord} (${activeYear.shortClock.from} to ${activeYear.shortClock.to})`]
            : []),
        ]
      : []),
    ...(typeof motion?.stationCount === 'number' && motion.stationCount > 0
      ? [`- Active Sky Stations in Window: ${motion.stationCount} station event(s) — honor review/turning-point pacing around station dates.`]
      : []),
    ...(isMature
      ? [
          '- Karmic Maturation Status (>36): Active. Mutual D1+D9 confirmation applies. Outer life indications in D1 must be validated by inner dharma in D9 (detecting Vargottama, D9 Neecha Bhanga redemption, or D9 false promise weakening).',
        ]
      : [
          '- Karmic Maturation Status (<=36): Pre-maturation phase. Primary focus on physical foundation (D1) with D9 as future potential.',
        ]),
    `- Stance Over Running Windows: ${spans.some((s) => s.tone === 'heavy') ? 'Steady pacing (get_through)' : 'Constructive building (build)'}`,
    '# DIVISIONAL CHART ROUTING (Active Dasha & Annual TP Context)',
    '- D10 (Dashamsha): drive, diagnosis, chapter, chapters, year (career capability, vocational achievement, professional authority)',
    '- D7 + D9 (Saptamsha & Navamsha): lagna, presence (relationships, marital harmony, enduring emotional truth)',
    '- D24 (Siddhamsha): mind, sharpness, learning (mental clarity, higher learning, intellectual mastery)',
    '- D20 (Vimshamsha): purpose, practice, aims (life orientation, devotion, spiritual grounding)',
    '- D30 (Trimshamsha): body, fitness, sleep, blood, stuck, mood (physical resilience, vitality, pacing and recuperation)',
  ];

  if (input.card) {
    let cardVarga = 'D1+D9';
    if (['drive', 'diagnosis', 'chapter', 'chapters', 'year'].includes(input.card)) {
      cardVarga = 'D10 (Dashamsha)';
    } else if (['lagna', 'presence'].includes(input.card)) {
      cardVarga = 'D7 (Saptamsha) & D9 (Navamsha)';
    } else if (['mind', 'sharpness', 'learning'].includes(input.card)) {
      cardVarga = 'D24 (Siddhamsha)';
    } else if (['purpose', 'practice', 'aims'].includes(input.card)) {
      cardVarga = 'D20 (Vimshamsha)';
    } else if (['body', 'fitness', 'sleep', 'blood', 'stuck', 'mood'].includes(input.card)) {
      cardVarga = 'D30 (Trimshamsha)';
    }
    lines.push(`- Target Card Routing (\`${input.card}\`): Focus on ${cardVarga} alongside natal D1 and D9 for active timing windows.`);
  }

  return lines;
}

export interface CardOracleInput {
  ctx: SelfBuildContext;
  card: CardId;
  matters: readonly CardMatter[];
  /** titles of the cards on the person's board, in their order */
  board: readonly string[];
  frame: YearFrameV3;
  /** the frame as the Oracle suffix renders it (tones, held, clocks, YEARS) */
  frameText: string;
  frameKeys: readonly string[];
  /** the shared prefix: the cached natal part, the uncached dated block (TODAY, frame) and the keys of both */
  prefix: { text: string; dated?: string; keys: readonly string[] };
  ledger: AgreedLedger | null;
  /** the `matter.<key>` slices of the card's matters */
  matterSlices: readonly RenderedSlice[];
  dates: ReadonlySet<string>;
  answers: string;
  model: string;
  cacheOwner: { userId: string; kundliId: string };
  /** docs/dashboards/14: the Love and Work boards' technique sections (a Love or Work card reads its own) */
  techniques?: Partial<Record<TechniqueBoard, BoardTechniqueSection>>;
  /** docs/techniques/09 §3.4: the story contract's inputs (all optional; absent ones are left out of the request) */
  story?: CardStoryInputs | null;
}

/** what the card Oracle reads for its technical story (doc 09 §3, "Card Oracle" row of §3.1) */
export interface CardStoryInputs {
  /** the lens thread the lens lineman wrote (promise → period → year → star → trigger, keyed); null when none */
  thread: { lens: string; text: string; keys: readonly string[] } | null;
  /** the lens recipe (`routing.ts` recipeText) or the generic line when the routing table has none */
  recipe: string;
  /** the card's own divisional charts (`ownCharts.ts`) */
  ownCharts: readonly string[];
  /** the verified systems shown for this chart (stored names) and the periods-only block (`systems.ts`) */
  verifiedSystems: readonly string[];
  /** the same systems by their plain names, for the request (never the raw ids and aliases) */
  systemsLine?: string;
  systemsText: string;
  systemsKeys: readonly string[];
  /** the family findings, as written, each citing `{key}` (natal ones kept until the chart data changes) */
  findings: ReadonlyArray<{ family: string; text: string }>;
  /** the clock readers' sentences for this card's matters (`clocks/sentences.ts`), keyed */
  clockSentences: string;
}

export interface CardOracleDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  timeoutMs?: number;
  /** overrides CARDS_STORY_CONTRACT (tests) */
  storyContract?: boolean;
  /** the USD this card may spend before its repair is skipped and it is queued (doc 09 §3.5 per-card safety stop) */
  cardCapUsd?: number;
}

export interface CardOracleResult {
  card: OracleCardV3 | null;
  /** `thin`: a card that passed the validator but stayed below the depth floor after its repair; never served */
  status: 'ok' | 'repaired' | 'failed' | 'thin';
  issues: ValidationIssue[];
  calls: SelfV2AgentTiming[];
  /** the depth gate's verdict on the returned (or thin) card; null with the story contract off */
  depth?: DepthResult | null;
}

/** the generic recipe line when the routing table has no recipe for the card's lens (doc 09 §8 step 3 is pending) */
export const GENERIC_RECIPE =
  'Read this card in the order of the story: the maha dasha lord judged from the lagna (owner, seat, dignity, navamsa, links) and then its star; the sub-period by its house from the maha dasha lord; the Tithi Pravesha year this year (D1 houses, then D9, then the year chart routed to this card) and one line on last year; the same houses counted from the Moon; D9 and this card\'s own divisional chart; the other verified systems and where they overlap; the trigger in the sky; the verdict and what would change it.';

/** the Oracle schema of one card with the story contract: today's fields, then the beat index, then the story LAST */
export function cardStorySchema(card: CardId, spanIds: readonly string[]): Record<string, unknown> {
  const base = oracleV3Schema([card], spanIds) as { properties: { cards: { items: { properties: Record<string, unknown>; required: string[] } } } };
  const item = base.properties.cards.items;
  item.properties.beats = beatsSchema();
  item.properties.story = { type: 'STRING', description: `${TECH_STORY_MIN_WORDS}-${TECH_STORY_MAX_WORDS} words, continuous prose, no headings, the nine beats in order` };
  item.required = [...item.required, 'beats', 'story'];
  // the story is written last, so a cut at the ceiling lands in prose and is continued as prose (llm/continue.ts)
  (item as Record<string, unknown>).propertyOrdering = ['card', 'headline', 'spans', 'confirm', 'gift', 'knot', 'pattern', 'certainty', 'evidence', 'beats', 'story'];
  return base as unknown as Record<string, unknown>;
}

/** `{key}` mentions in a text (the family findings cite every bullet this way) */
export const keysInText = (text: string): string[] => [...text.matchAll(/\{([a-z_]+:[^{}\s]+)\}/gi)].map((m) => normaliseEvidenceKey(m[1]!));

/** The story part of the request (uncached, after the card's own blocks). Pure. */
export function storyBlock(card: CardId, s: CardStoryInputs): { text: string; keys: string[] } {
  const findingKeys = s.findings.flatMap((f) => keysInText(f.text));
  const text = [
    `STORY CONTRACT (this card: \`${card}\`): write \`story\`, ${TECH_STORY_MIN_WORDS}-${TECH_STORY_MAX_WORDS} words, one continuous text with no headings, in this order: ${STORY_BEATS.join(' → ')}. Name every period with its system, and every placement with its chart, house, sign and star. Fill \`beats\` with one entry per beat: held yes/partly/no/na, the systems it used, and the keys it rests on (cite the maha dasha and the sub-period rows, the year chart, D9 and this card's own chart by key). Where the research has no rule for this lens, say so and do not fill it.`,
    `LENS RECIPE\n${s.recipe}`,
    `THIS CARD'S OWN CHARTS: ${s.ownCharts.join(', ')} (read after D1 and D9)`,
    `VERIFIED SYSTEMS (read, show and count only these): ${s.systemsLine || s.verifiedSystems.join(', ') || 'none stored'}`,
    ...(s.systemsText ? [s.systemsText] : []),
    s.thread ? `LENS THREAD (${s.thread.lens}; the lens lineman's reading of this subject, keyed)\n${s.thread.text}` : 'LENS THREAD: none for this card; read the subject from the data above',
    s.findings.length ? `FAMILY FINDINGS (the chart-family readers; cite their keys)\n${s.findings.map((f) => `## ${f.family}\n${f.text}`).join('\n')}` : 'FAMILY FINDINGS: none stored',
    s.clockSentences ? `CLOCK SENTENCES (each verified clock's reader on this card's matters, by span)\n${s.clockSentences}` : 'CLOCK SENTENCES: none',
  ].join('\n\n');
  return { text, keys: [...new Set([...(s.thread?.keys ?? []), ...s.systemsKeys, ...findingKeys])] };
}

/** The ledger checks on top of `checkOracleCard`. Pure. */
export function checkAgainstLedger(card: OracleCardV3, frame: YearFrameV3, cells: readonly LedgerCell[]): string[] {
  const problems: string[] = [];
  for (const s of card.spans) {
    const mine = cells.filter((c) => c.span === s.span);
    if (mine.length && !s.evidence.some((k) => mine.some((c) => c.id === k))) problems.push(`span ${s.span}: cites none of this card's ledger cells (${mine.map((c) => c.id).slice(0, 4).join(', ')})`);
    if (s.mode === 'build') {
      const fs = frame.spans.find((x) => x.id === s.span);
      const ground = mine.some((c) => (c.status === 'confirmed' || c.status === 'leaning') && (c.tone === 'light' || c.tone === 'mixed'));
      if (!ground && !(fs?.held !== false && fs?.tone === 'light')) problems.push(`span ${s.span}: build needs a confirmed or leaning light or mixed cell of this card`);
    }
  }
  return problems;
}

function inferMotionSignalsFromPrefix(
  prefixText: string,
  periods: ActiveTimingBlockInput['periods'],
  windows: SelfBuildContext['sub']['windows'],
): ActiveTimingMotionSignals | null {
  const md = periods?.running?.lord;
  const ad = periods?.runningSub?.lord;
  const checkPlanetLine = (p: string | undefined) => {
    if (!p) return { retro: false, stationary: false, motionState: null as string | null, cheshta: null as number | null };
    const re = new RegExp(`\\{planet:D1\\.${p}\\}[^\\n]*`, 'i');
    const line = re.exec(prefixText)?.[0] ?? '';
    const retro = /\bretro(?:grade)?(?:=true)?\b|\bvakra\b|\banuvakra\b/i.test(line) && !/\bretro=false\b/i.test(line);
    const stationary = /\bvikala\b|\bstationary(?:=true)?\b/i.test(line) && !/\bstationary=false\b/i.test(line);
    const motionMatch = /\bmotion(?:State)?=([a-z_]+)/i.exec(line);
    const cheshtaMatch = /\bcheshta(?:Bala)?=([0-9]+(?:\.[0-9]+)?)/i.exec(line);
    return {
      retro,
      stationary,
      motionState: motionMatch?.[1] ?? (stationary ? 'vikala' : retro ? 'vakra' : null),
      cheshta: cheshtaMatch ? Number(cheshtaMatch[1]) : null,
    };
  };
  const mdInfo = checkPlanetLine(md);
  const adInfo = checkPlanetLine(ad);
  const tpYearLordRetro = /\byearLordRetro=true\b|\bposture=iterative_review\b/i.test(prefixText);
  const tpPostureMatch = /\b(?:operatingPosture|posture)=(linear_build|iterative_review|protective_pacing)\b/i.exec(prefixText);
  const stationCount = (windows?.strip ?? []).filter((w) => w.rowId.includes('station')).length;
  if (!mdInfo.retro && !mdInfo.stationary && !adInfo.retro && !adInfo.stationary && !tpYearLordRetro && !tpPostureMatch && stationCount === 0) {
    return null;
  }
  return {
    mdRetro: mdInfo.retro,
    mdStationary: mdInfo.stationary,
    mdMotionState: mdInfo.motionState,
    mdCheshtaBala: mdInfo.cheshta,
    adRetro: adInfo.retro,
    adStationary: adInfo.stationary,
    adMotionState: adInfo.motionState,
    tpYearLordRetro,
    tpOperatingPosture: tpPostureMatch?.[1] ?? (tpYearLordRetro ? 'iterative_review' : null),
    stationCount,
  };
}

/**
 * The card's call, uncached part. The matter rows are cut to the frame and each row is listed once; rows and promise
 * entries already in the shared prefix are named by key only (`cardMatterRows`). The replay's cards read 13.6 k to
 * 24 k uncached tokens each, mostly the three matter slices in full (doc 70 Phase 3 replay fixes).
 */
export function cardInstruction(i: CardOracleInput, cells: readonly LedgerCell[]): { text: string; keys: string[] } {
  const ledger = renderCardLedger(cells);
  const range = frameRange(i.frame);
  const rows = cardMatterRows(i.matterSlices, range, new Set(i.prefix.keys));
  const matter = i.matterSlices.length ? rows.text : '';
  const motion = inferMotionSignalsFromPrefix(i.prefix.text, i.ctx.sub.periods, i.ctx.sub.windows);
  const timingBlock = renderActiveTimingAndVargaBlock({
    clock: i.ctx.sub.clock,
    frameClock: i.frame.clock,
    periods: i.ctx.sub.periods,
    year: i.ctx.sub.year,
    ageYears: i.ctx.sub.profile?.ageYears,
    spans: i.frame.spans,
    card: i.card,
    motion,
  });
  // docs/dashboards/14: a Love or Work card reads its board's technique sections first (none for a Self card)
  const tBoards = techniqueBoardsOf([i.card]).filter((b) => i.techniques?.[b]);
  const tSections = Object.fromEntries(tBoards.map((b) => [b, i.techniques![b]!])) as Partial<Record<TechniqueBoard, BoardTechniqueSection>>;
  const techText = tBoards.length
    ? [
        ...tBoards.map((b) => tSections[b]!.text),
        ...cardTechniqueKeys(i.card, tSections).map((t) => `THIS CARD'S TECHNIQUE ROWS (${t.board.toUpperCase()}, read first): ${t.keys.length ? t.keys.map((k) => `{${k}}`).join(' ') : '(the whole section)'}`),
      ].join('\n\n')
    : '';
  const story = i.story ? storyBlock(i.card, i.story) : null;
  const text = [
    promptText(CARD_ORACLE_PROMPT),
    `CARD BRIEF\n${promptText(cardBriefPrompt(i.card))}`,
    `BOARD: this card is on the ${cardBoardLabel(i.card).replace(/^board /, '')} board`,
    `THE BOARD (the cards this person chose; you write only \`${i.card}\` and leave the others' subjects to them): ${i.board.join('; ') || 'this card only'}`,
    timingBlock.join('\n'),
    i.frameText,
    ledger.text,
    ...(techText ? [techText] : []),
    `MATTER ROWS (${i.matters.join(', ')}; the rows overlapping ${range.from}..${range.to}, each once)\n${matter || '(none stored)'}`,
    ...(story ? [story.text] : []),
    `PERSON'S ANSWERS: ${i.answers || 'none'}`,
    `THIS CALL: write only the card \`${i.card}\`${story ? ', its story last' : ''}. Return the JSON document only.`,
  ].join('\n\n');
  const tech = tBoards.flatMap((b) => tSections[b]!.keys);
  return { text, keys: [...new Set([...ledger.keys, ...(i.matterSlices.length ? rows.keys : []), ...i.frameKeys, ...tech, ...(story?.keys ?? [])])] };
}

const keyOf = (k: string): string => normaliseEvidenceKey(k.trim().replace(/^\{|\}$/g, ''));

/**
 * Fixes in code, before any repair call, the two faults behind the replay's repairs (doc 70 Phase 3 replay fixes):
 * - an evidence key the card was never given (the replay's `chapter` cited a row from before the frame): dropped from a
 *   span when the span keeps at least one key it was given, and from the card's and the pattern's lists;
 * - a span that cites none of this card's ledger cells for it while it cites a row one of those cells rests on (the
 *   replay's `mind`, three spans): that cell is added, preferring confirmed, then leaning. The cell's status and tone
 *   are the count's; the span's tone is still checked against the frame, and `build` still needs its ground.
 * Anything else is left to the validator and the repair call. Pure; returns a copy and what it changed.
 */
export function precheckCard(raw: unknown, c: { allowed: ReadonlySet<string>; aliases?: Readonly<Record<string, string>>; cells: readonly LedgerCell[] }): { raw: unknown; notes: string[] } {
  if (!raw || typeof raw !== 'object') return { raw, notes: [] };
  const o = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const notes: string[] = [];
  const known = (k: string) => {
    const n = keyOf(k);
    return c.allowed.has(c.aliases?.[n] ?? c.aliases?.[k] ?? n);
  };
  const strip = (list: unknown, where: string, keepOne: boolean): unknown => {
    if (!Array.isArray(list)) return list;
    const ks = list.filter((x): x is string => typeof x === 'string');
    const bad = ks.filter((k) => !known(k));
    if (!bad.length) return list;
    const good = ks.filter((k) => known(k));
    if (keepOne && !good.length) return list;
    notes.push(`${where}: dropped key(s) not given to this card: ${bad.slice(0, 3).join(', ')}`);
    return good;
  };
  const rank = (x: LedgerCell) => (x.status === 'confirmed' ? 0 : x.status === 'leaning' ? 1 : 2);
  if (Array.isArray(o.spans)) {
    for (const sp of o.spans as Array<Record<string, unknown>>) {
      if (!sp || typeof sp !== 'object') continue;
      const span = typeof sp.span === 'string' ? sp.span.trim() : '';
      sp.evidence = strip(sp.evidence, `span ${span || '?'}`, true);
      const mine = c.cells.filter((x) => x.span === span);
      if (!Array.isArray(sp.evidence) || !mine.length) continue;
      const cited = new Set((sp.evidence as unknown[]).filter((x): x is string => typeof x === 'string').map(keyOf));
      if (mine.some((x) => cited.has(x.id))) continue;
      // a dated row in common, never a planet or house key alone
      const ground = mine.filter((x) => x.evidence.some((k) => k.startsWith('pressure:') && cited.has(k))).sort((a, b) => rank(a) - rank(b) || cmp(a.id, b.id))[0];
      if (!ground) continue;
      (sp.evidence as unknown[]).push(ground.id);
      notes.push(`span ${span}: cited ${ground.id} (it rests on a row the span cites)`);
    }
  }
  o.evidence = strip(o.evidence, 'card', false);
  if (o.pattern && typeof o.pattern === 'object') {
    const pt = o.pattern as Record<string, unknown>;
    pt.evidence = strip(pt.evidence, 'pattern', true);
  }
  return { raw: o, notes };
}


/** the cost of the calls so far (USD) */
const costOf = (calls: readonly SelfV2AgentTiming[]): number => calls.reduce((n, c) => n + c.costUsd, 0);

/**
 * The story and beat index of a validated raw card (doc 09 §3.4): the story as written (engine names made plain), the
 * beats with their keys mapped through the frame's aliases and cut to the keys the card was given (an unknown key in
 * the index is dropped, never the card). Pure.
 */
export function storyOf(raw: unknown, allowed: ReadonlySet<string>, aliases: Readonly<Record<string, string>> = {}): Pick<OracleCardV3, 'story' | 'beats'> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const story = typeof o.story === 'string' ? redactEngineText(o.story.trim()) : '';
  const beats = parseBeats(o.beats).map((b) => ({ ...b, evidence: b.evidence.map((k) => aliases[k] ?? k).filter((k) => allowed.has(k)) }));
  return { ...(story ? { story } : {}), ...(beats.length ? { beats } : {}) };
}

/** One card: call (continued at its ceiling), validate (v3 checks + ledger), the depth gate, repair once alone. Never throws. */
export async function readCardOracle(deps: CardOracleDeps, i: CardOracleInput): Promise<CardOracleResult> {
  const storyOn = (deps.storyContract ?? isCardsStoryContractEnabled()) && Boolean(i.story);
  const cells = cardCells(i.ledger, i.matters);
  const instr = cardInstruction(storyOn ? i : { ...i, story: null }, cells);
  const allowed = new Set([...i.prefix.keys, ...instr.keys].map(normaliseEvidenceKey));
  const spanIds = i.frame.spans.map((s) => s.id);
  const calls: SelfV2AgentTiming[] = [];
  const issues: ValidationIssue[] = [];
  const limit = deps.timeoutMs ?? getCardsOracleTimeoutMs();
  const ceiling = getCardsOracleMaxOutputTokens();
  /** the last answer still stopped at its ceiling after its continuations (closed as written): never ready as is */
  let lastCut = false;
  const ask = async (call: string, extra = ''): Promise<unknown | null> => {
    const t0 = performance.now();
    try {
      const res = await withAgentRun(
        deps.prisma,
        CARD_ORACLE_AGENT,
        {
          userId: i.ctx.userId,
          kundliId: i.ctx.kundliId,
          technique: CARD_READING_TECHNIQUE,
          task: `self.card.oracle ${i.card} ${i.ctx.asOf}`,
          input: { card: i.card, spans: spanIds.length, cells: cells.length, keys: allowed.size, story: storyOn ? 1 : 0, thread: i.story?.thread ? 1 : 0 },
          charts: [{ type: 'kundli_digest', variant: i.ctx.stamps.digestVersion }, { type: 'pressure_inventory', variant: `system=${i.frame.clock}` }],
        },
        async () => {
          const o: GeminiCallOptions = {
            model: i.model,
            node: `self.card.oracle.${i.card}${call.endsWith('repair') ? '.repair' : ''}`,
            system: promptText(READER_SYSTEM_PROMPT),
            parts: [i.prefix.text, [i.prefix.dated ?? '', instr.text, extra].filter(Boolean).join('\n\n')],
            thinking: 'low',
            maxOutputTokens: ceiling,
            timeoutMs: limit,
            cachePrefix: true,
            cacheOwner: i.cacheOwner,
            responseSchema: storyOn ? cardStorySchema(i.card, spanIds) : oracleV3Schema([i.card], spanIds),
          };
          // a limit never discards (AGENTS.md "Reading depth is a release gate", rule 4): continued at the ceiling
          const g = await callWithContinuation(deps.callGemini, o, { deadlineMs: limit });
          return {
            value: g,
            usage: { model: i.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
            output: { chars: g.text.length, continued: g.continued, stillCut: g.stillCut },
          };
        },
      );
      markAgentUsed({ cacheOwner: i.cacheOwner }, deps.informUsed);
      if (res.continued) issues.push({ stage: 'oracle', area: i.card, check: 'other', message: `${i.card}: ${call}: continued ${res.continued} time(s) at the ${ceiling}-token ceiling${res.stillCut ? '; still cut, closed as written' : ''}`, callId: call });
      lastCut = res.stillCut;
      const parsed = parseContinuedJson(res.text) as { cards?: unknown } | null;
      const list = parsed && Array.isArray(parsed.cards) ? (parsed.cards as unknown[]) : null;
      calls.push(timingOf('self.oracle', call, i.model, res, performance.now() - t0, list ? 'ok' : 'failed'));
      if (!list) issues.push({ stage: 'oracle', area: i.card, check: res.stillCut ? 'truncated' : 'json_schema', message: `${i.card}: ${call}: no card document`, callId: call });
      return list?.find((x) => (x as { card?: unknown } | null)?.card === i.card) ?? null;
    } catch (e) {
      calls.push(timingOf('self.oracle', call, i.model, null, performance.now() - t0, 'failed'));
      issues.push({ stage: 'oracle', area: i.card, check: 'call_failed', message: `${i.card}: ${call}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: call });
      return null;
    }
  };
  const check = (got: unknown | null): { card: OracleCardV3 | null; problems: string[]; depth: DepthResult | null } => {
    if (!got) return { card: null, problems: ['not returned'], depth: null };
    const pre = precheckCard(got, { allowed, aliases: i.frame.aliases ?? {}, cells });
    for (const n of pre.notes) issues.push({ stage: 'oracle', area: i.card, check: 'other', message: `${i.card}: precheck: ${n}`.slice(0, 300), callId: null });
    const raw = pre.raw;
    const r = checkOracleCard(raw, { frame: i.frame, allowedKeys: allowed, dates: i.dates, expected: [i.card], aliases: i.frame.aliases ?? {} });
    for (const n of r.notes) issues.push({ stage: 'oracle', area: i.card, check: 'other', message: `${i.card}: ${n}`.slice(0, 300), callId: null });
    if (!r.card) return { card: null, problems: r.problems, depth: null };
    const lp = checkAgainstLedger(r.card, i.frame, cells);
    if (lp.length) return { card: null, problems: lp, depth: null };
    if (!storyOn) return { card: r.card, problems: [], depth: null };
    const card: OracleCardV3 = { ...r.card, ...storyOf(raw, allowed, i.frame.aliases ?? {}) };
    // the depth floor (AGENTS.md "Reading depth is a release gate", rule 1): word count and evidence-key kinds only
    const depth = checkDepth({
      story: card.story,
      evidence: beatKeys(card.beats, [...card.evidence, ...card.spans.flatMap((s) => s.evidence)]),
      ownCharts: i.story!.ownCharts,
      verifiedSystems: i.story!.verifiedSystems,
      available: allowed,
    });
    card.depth = { technicalWords: depth.words.technical, ok: depth.technicalOk, inputGaps: depth.gaps.filter((g) => g.unavailable).map((g) => g.kind) };
    return { card, problems: [], depth };
  };
  const note = (call: string, problems: string[]) => {
    for (const p of problems) issues.push({ stage: 'oracle', area: i.card, check: p.includes('evidence') || p.includes('ledger') ? 'unknown_evidence_key' : p.includes('date') ? 'date_not_stored' : p === 'not returned' ? 'missing_area' : 'other', message: `${i.card}: ${p}`.slice(0, 300), callId: call });
  };
  const noteDepth = (call: string, d: DepthResult) => {
    for (const g of d.gaps) issues.push({ stage: 'oracle', area: i.card, check: 'other', message: `${i.card}: depth${g.unavailable ? ' (input gap: not in the data given)' : ''}: ${g.message}`.slice(0, 300), callId: call });
  };
  /** the card stands: it passed, or only input gaps remain (the data has no such key; filed, never looped on) */
  const stands = (c: ReturnType<typeof check>) => Boolean(c.card) && !(storyOn && lastCut) && (!c.depth || c.depth.gaps.every((g) => g.unavailable));
  const call = `card.${i.card}`;
  const first = check(await ask(call));
  if (stands(first)) {
    if (first.depth?.gaps.length) noteDepth(call, first.depth);
    return { card: first.card, status: 'ok', issues, calls, depth: first.depth };
  }
  if (first.card) noteDepth(call, first.depth!);
  else note(call, first.problems);
  // the per-card safety stop (doc 09 §3.5): past it, no repair is bought here; the card is queued and retried
  if (deps.cardCapUsd !== undefined && costOf(calls) >= deps.cardCapUsd) {
    issues.push({ stage: 'oracle', area: i.card, check: 'budget', message: `${i.card}: spent ${costOf(calls).toFixed(4)} of the per-card stop ${deps.cardCapUsd}; queued`, callId: null });
    return { card: first.card, status: first.card ? 'thin' : 'failed', issues, calls, depth: first.depth };
  }
  const repairCall = `${call}.repair`;
  const cutNote = storyOn && lastCut ? 'CUT: the answer stopped at the output limit before the story ended. Write the whole card again; finish the story.' : '';
  const reasons = first.card ? [depthRepairNote(first.depth!) ?? '', cutNote].filter(Boolean).join('\n\n') : `REPAIR: this card failed the checks. Write it again and fix exactly this:\n- ${first.problems.slice(0, 6).join('\n- ')}`;
  const second = check(await ask(repairCall, reasons));
  if (stands(second)) {
    if (second.depth?.gaps.length) noteDepth(repairCall, second.depth);
    return { card: second.card, status: 'repaired', issues, calls, depth: second.depth };
  }
  if (second.card) {
    noteDepth(repairCall, second.depth!);
    // below the floor after its repair: returned `thin`, never served; the runner queues it (never written shorter)
    return { card: second.card, status: 'thin', issues, calls, depth: second.depth };
  }
  note(repairCall, second.problems);
  return first.card ? { card: first.card, status: 'thin', issues, calls, depth: first.depth } : { card: null, status: 'failed', issues, calls, depth: null };
}
