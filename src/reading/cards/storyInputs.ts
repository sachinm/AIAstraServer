/**
 * What each card's Oracle reads for its story (docs/techniques/09 §3, "Card Oracle" row of §3.1), built in code from
 * what the build already holds: the family findings, the clock sheets WITH their sentences (nothing dropped upward,
 * AGENTS.md rule 2), the verified systems and their stored periods, the lens thread. Also the card's "Good until" and the
 * systems view it serves. Selection, formatting and date comparison only; nothing astrological is computed.
 */
import { canonicalJson } from '../../techniques/pieces.js';
import { clockLabel } from '../self/words.js';
import { shortHash } from '../self/v2/slices.js';
import type { CardSystemView, OracleCardV3, YearFrameV3 } from '../self/v3/types.js';
import { countedNames, periodKey, renderShownPeriods, shownLabels, systemDef, type PeriodRowLike, type ShownSystem } from '../clocks/systems.js';
import type { ClockSheet } from '../clocks/types.js';
import { GENERIC_RECIPE, type CardStoryInputs } from './oracle.js';
import { lensOf, ownChartsOf, signDashaOf } from './ownCharts.js';
import { recipeText, type LensId } from './routing.js';
import { classifyKey } from './story.js';

/** one lens thread as the lens lineman stored it */
export interface LensThreadRef {
  lens: string;
  text: string;
  keys: string[];
  hash: string;
}

/** what the build hands the card runner for the story contract */
export interface CardsStoryRunInput {
  /** every family finding of this build (stored in reading_findings_cache), as written */
  findings: ReadonlyArray<{ family: string; text: string }>;
  /** the clock sheets of this build, with their sentences */
  sheets: readonly ClockSheet[];
  /** the verified systems shown for this chart (`clocks/systems.ts` shownSystems) */
  shown: readonly ShownSystem[];
  /** the stored period rows (`kundli_activation`) for the periods-only systems and the systems view */
  periodRows: readonly PeriodRowLike[];
  /** the lens threads of this build, by lens id */
  threads: Partial<Record<string, LensThreadRef>>;
}

/** The clock readers' sentences for the card's matters, by span: `s1 career_and_standing · vimsottari heavy (2): "…" {keys}`. */
export function clockSentencesFor(sheets: readonly ClockSheet[], matters: readonly string[], counted: ReadonlySet<string> | null = null): string {
  const want = new Set(matters);
  const L: string[] = [];
  for (const sh of sheets) {
    if (counted && !counted.has(sh.system) && sh.system !== 'tithi_pravesha') continue;
    for (const c of sh.cells) {
      if (!want.has(c.matter)) continue;
      L.push(`${c.span} ${c.matter} · ${sh.system} ${c.tone} (${c.strength}): "${c.sentence}" ${c.evidence.map((k) => `{${k}}`).join(' ')}`);
    }
  }
  return L.sort().join('\n');
}

/** The story inputs of one card. Pure. */
export function cardStoryInputs(card: string, matters: readonly string[], frame: YearFrameV3, run: CardsStoryRunInput): CardStoryInputs {
  const lens = lensOf(card);
  const thread = lens ? (run.threads[lens] ?? null) : null;
  const verified = countedNames(run.shown);
  const periods = renderShownPeriods(run.periodRows, run.shown, { from: frame.spans[0]?.from ?? frame.asOf, to: frame.spans[frame.spans.length - 1]?.to ?? frame.to });
  const sd = signDashaOf(card);
  const systemsText = [periods.text, sd?.note ? `SIGN DASHA FOR THIS CARD: ${sd.note}` : sd ? `SIGN DASHA FOR THIS CARD: ${sd.system} on ${sd.varga}` : ''].filter(Boolean).join('\n\n');
  return {
    thread: thread ? { lens: thread.lens, text: thread.text, keys: thread.keys } : null,
    recipe: (lens ? recipeText(lens as LensId) : null) ?? GENERIC_RECIPE,
    ownCharts: ownChartsOf(card),
    verifiedSystems: verified,
    systemsLine: shownLabels(run.shown),
    systemsText,
    systemsKeys: periods.keys,
    findings: run.findings,
    clockSentences: clockSentencesFor(run.sheets, matters, new Set(verified)),
  };
}

/** the part of the card key the story inputs make (a changed thread, finding or sentence reads the card again) */
export function storyInputsHash(s: CardStoryInputs): string {
  return shortHash(canonicalJson([s.thread?.text ?? null, s.recipe, s.ownCharts, s.verifiedSystems, s.systemsText, s.findings.map((f) => [f.family, f.text]), s.clockSentences]));
}

/**
 * The systems view a card serves (doc 09 §6 `v3.systems`): each verified system read for this chart, by its plain name,
 * and the period running on it today, from the frame's span clocks (period-clock systems) or the stored periods
 * (periods-only systems). Lord, sign and dates are copied from stored keys and rows.
 */
export function systemsViewOf(frame: YearFrameV3, shown: readonly ShownSystem[], periodRows: readonly PeriodRowLike[]): CardSystemView[] {
  const now = frame.spans.find((s) => s.place === 'now') ?? frame.spans[0];
  const out: CardSystemView[] = [];
  for (const s of shown) {
    const def = systemDef(s.id);
    if (!def) continue;
    let running: CardSystemView['running'] = null;
    const clock = now?.clocks.find((c) => c.system === s.stored || c.system === s.id);
    if (clock) {
      const m = /\/(\d+)\/([^@]+)@(\d{4}-\d{2}-\d{2})/.exec(clock.evidence);
      if (m) running = { lord: m[2]!, from: m[3]!, to: null };
    }
    if (!running && def.feed === 'periods') {
      const names = new Set([s.stored, ...def.storedAs]);
      const r = periodRows
        .filter((x) => names.has(x.system) && x.from <= frame.asOf && frame.asOf < x.to && x.level <= (def.levels === 'maha_only' ? 1 : 2))
        .sort((a, b) => b.level - a.level)[0];
      if (r) running = { lord: r.sign ?? r.lord ?? '?', from: r.from, to: r.to };
    }
    out.push({ system: s.id, label: def.label === s.id ? clockLabel(s.id) : def.label, running });
  }
  return out;
}

/**
 * "Good until" (doc 09 §3.2): the earliest of the now span's end, the end of the year chart in force, and the first
 * edge after today of a period the card cites (a dated key's row in `rows`). Date comparison only.
 */
export function goodUntilOf(card: Pick<OracleCardV3, 'evidence' | 'spans' | 'beats'>, frame: YearFrameV3, rows: ReadonlyMap<string, { from: string; to: string }>): string | null {
  const asOf = frame.asOf;
  const edges: string[] = [];
  const now = frame.spans.find((s) => s.place === 'now');
  if (now && now.to > asOf) edges.push(now.to);
  const year = (frame.years ?? []).find((y) => y.from <= asOf && asOf < y.to);
  if (year) edges.push(year.to);
  const keys = new Set([...card.evidence, ...card.spans.flatMap((s) => s.evidence), ...(card.beats ?? []).flatMap((b) => b.evidence)]);
  for (const k of keys) {
    const kind = classifyKey(k).kind;
    if (kind !== 'dasha' && kind !== 'year') continue;
    const r = rows.get(k);
    if (r && r.to > asOf) edges.push(r.to);
  }
  return edges.sort()[0] ?? null;
}

export { periodKey };
