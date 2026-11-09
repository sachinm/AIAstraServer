/**
 * The Oracle's area document (docs/reading-engine/65 §3): the dashboard as the Oracle returns it, one area per panel,
 * as JSON forced by a Gemini `responseSchema`. This module holds the contract, the schema, the validator that makes a
 * returned document safe to show (every cited key known, every date inside a stored window, caps, redaction, no
 * paragraph in two areas, an empty area withheld with a gap) and the plain-text form the Lab shows.
 * Nothing here computes astrology: it selects, checks and formats what the Oracle wrote against stored rows.
 */
import { inStoredWindow } from './audit.js';
import type { BoardPanelId, LineCertainty } from './types.js';
import { redactEngineTerms, wordCount } from './words.js';

export const AREA_CERTAINTIES = ['strong', 'likely', 'possible'] as const;
export type AreaCertainty = (typeof AREA_CERTAINTIES)[number];

export interface AreaDate {
  from: string;
  to: string;
  label: string;
}

export interface AreaAction {
  from: string;
  to: string;
  text: string;
}

export interface OracleArea {
  id: BoardPanelId;
  /** one sentence, at most 22 words, the card's lead */
  headline: string;
  /** two to four paragraphs of collated prose about this area only */
  paragraphs: string[];
  dates: AreaDate[];
  actions: AreaAction[];
  certainty: AreaCertainty;
  /** evidence keys the area rests on, each one in the brief or the packs */
  evidence: string[];
  /** YYYY-MM-DD or 'always' */
  validUntil: string;
}

export interface OracleAreaDoc {
  areas: Partial<Record<BoardPanelId, OracleArea>>;
  /** YYYY-MM-DD or 'always' */
  validUntil: string;
}

export const HEADLINE_MAX_WORDS = 22;
export const PARAGRAPHS_MAX = 4;
export const PARAGRAPH_MAX_WORDS = 140;
export const DATES_MAX = 8;
export const ACTIONS_MAX = 5;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The Gemini responseSchema (OpenAPI subset, uppercase types) for one board's areas. */
export function oracleAreaSchema(panelIds: readonly BoardPanelId[]): Record<string, unknown> {
  const day = { type: 'STRING', description: 'YYYY-MM-DD' };
  return {
    type: 'OBJECT',
    properties: {
      areas: {
        type: 'ARRAY',
        description: 'one entry per area of the dashboard, in display order; an area with nothing grounded to say is left out',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING', enum: [...panelIds] },
            headline: { type: 'STRING', description: 'one plain sentence, at most 22 words, no chart term' },
            paragraphs: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 to 4 paragraphs about this area only' },
            dates: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { from: day, to: day, label: { type: 'STRING' } }, required: ['from', 'to', 'label'] },
            },
            actions: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { from: day, to: day, text: { type: 'STRING' } }, required: ['from', 'to', 'text'] },
            },
            certainty: { type: 'STRING', enum: [...AREA_CERTAINTIES] },
            evidence: { type: 'ARRAY', items: { type: 'STRING' }, description: 'evidence keys from the BRIEF or the packs' },
            validUntil: { type: 'STRING', description: 'YYYY-MM-DD or always' },
          },
          required: ['id', 'headline', 'paragraphs', 'dates', 'actions', 'certainty', 'evidence', 'validUntil'],
        },
      },
      validUntil: { type: 'STRING', description: 'YYYY-MM-DD or always: the governing boundary of the whole reading' },
    },
    required: ['areas', 'validUntil'],
  };
}

export interface AreaValidationContext {
  panelIds: readonly BoardPanelId[];
  /** evidence keys the Oracle may cite: the brief's and the packs' */
  allowedKeys: ReadonlySet<string>;
  /** stored period and year-chart boundaries and windows (service.ts storedWindows) */
  boundaries: ReadonlySet<string>;
  windows: ReadonlyArray<{ from: string; to: string }>;
  /** today, YYYY-MM-DD; a validUntil in the past is dropped */
  asOf: string;
}

export interface AreaValidation {
  doc: OracleAreaDoc;
  /** staff-only reasons, `<area>: <what was dropped>` */
  gaps: string[];
  /** areas the Oracle returned that were withheld (no headline or no paragraph survived) */
  withheld: BoardPanelId[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Citations the model may still write inline (`{key}` or `` `{key}` ``), and empty ticks, removed from shown text. */
export function cleanAreaText(s: string): string {
  return redactEngineTerms(
    s
      .replace(/`?\s*\{[^}]+\}\s*`?/g, '')
      .replace(/`\s*`/g, '')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

/** Keys cited inline in a text, for the per-paragraph check. */
function citedKeys(s: string): string[] {
  return [...s.matchAll(/\{([^}]+)\}/g)].flatMap((m) => m[1]!.split(',').map((k) => k.trim()).filter(Boolean));
}

function normalisedSentence(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Parses the JSON the Oracle returned. Returns null when it is not the document's shape at all. */
export function parseAreaDoc(text: string): { areas: unknown[]; validUntil: string } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // a model that wrapped the JSON in a fence
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      raw = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  const o = obj(raw);
  if (!Array.isArray(o.areas)) return null;
  return { areas: o.areas, validUntil: str(o.validUntil) || 'always' };
}

/**
 * Makes a returned document safe to show. Per area: unknown ids dropped; headline cleaned and capped at 22 words (a
 * longer one is cut at its first sentence, else withheld); each paragraph's inline citations must be allowed keys or
 * the paragraph is dropped; a paragraph already used by another area is dropped; dates and actions must have real
 * days inside a stored window or they are dropped; evidence keys not allowed are dropped; validUntil must be a day
 * after asOf or 'always'. An area with no headline or no paragraph left is withheld and recorded as a gap.
 */
export function validateAreaDoc(parsed: { areas: unknown[]; validUntil: string }, ctx: AreaValidationContext): AreaValidation {
  const gaps: string[] = [];
  const withheld: BoardPanelId[] = [];
  const areas: Partial<Record<BoardPanelId, OracleArea>> = {};
  const seenParagraphs = new Set<string>();
  const dayOk = (d: string) => DAY_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
  const windowOk = (d: string) => inStoredWindow(d, ctx.boundaries, ctx.windows);

  for (const rawArea of parsed.areas) {
    const a = obj(rawArea);
    const id = str(a.id) as BoardPanelId;
    if (!ctx.panelIds.includes(id)) {
      if (id) gaps.push(`${id}: not a panel of this board`);
      continue;
    }
    if (areas[id]) {
      gaps.push(`${id}: returned twice; the second dropped`);
      continue;
    }

    let headline = cleanAreaText(str(a.headline));
    if (wordCount(headline) > HEADLINE_MAX_WORDS) {
      const first = headline.split(/(?<=[.!?])\s+/)[0] ?? '';
      if (first && wordCount(first) <= HEADLINE_MAX_WORDS) {
        gaps.push(`${id}: headline cut to its first sentence`);
        headline = first;
      } else {
        gaps.push(`${id}: headline over ${HEADLINE_MAX_WORDS} words, withheld`);
        headline = '';
      }
    }

    const paragraphs: string[] = [];
    for (const rawP of arr(a.paragraphs)) {
      const p = str(rawP);
      if (!p) continue;
      const cited = citedKeys(p);
      if (cited.some((k) => !ctx.allowedKeys.has(k))) {
        gaps.push(`${id}: a paragraph cited an unknown key (${cited.filter((k) => !ctx.allowedKeys.has(k)).join(', ')})`);
        continue;
      }
      const clean = cleanAreaText(p);
      if (!clean) continue;
      if (wordCount(clean) > PARAGRAPH_MAX_WORDS) gaps.push(`${id}: a paragraph runs over ${PARAGRAPH_MAX_WORDS} words`);
      const norm = normalisedSentence(clean);
      if (seenParagraphs.has(norm)) {
        gaps.push(`${id}: a paragraph repeated another area's, dropped`);
        continue;
      }
      seenParagraphs.add(norm);
      paragraphs.push(clean);
      if (paragraphs.length === PARAGRAPHS_MAX) break;
    }

    const dates: AreaDate[] = [];
    for (const rawD of arr(a.dates)) {
      const d = obj(rawD);
      const from = str(d.from);
      const to = str(d.to) || from;
      const label = cleanAreaText(str(d.label));
      if (!dayOk(from) || !dayOk(to) || !label) continue;
      if (to < from) continue;
      if (!windowOk(from) || !windowOk(to)) {
        gaps.push(`${id}: date ${from}..${to} (${label.slice(0, 40)}) is outside every stored window`);
        continue;
      }
      dates.push({ from, to, label });
      if (dates.length === DATES_MAX) break;
    }

    const actions: AreaAction[] = [];
    for (const rawX of arr(a.actions)) {
      const x = obj(rawX);
      const from = str(x.from);
      const to = str(x.to) || from;
      const text = cleanAreaText(str(x.text));
      if (!dayOk(from) || !dayOk(to) || !text || to < from) continue;
      if (!windowOk(from) || !windowOk(to)) {
        gaps.push(`${id}: action ${from}..${to} is outside every stored window`);
        continue;
      }
      actions.push({ from, to, text });
      if (actions.length === ACTIONS_MAX) break;
    }

    const certaintyRaw = str(a.certainty) as AreaCertainty;
    const certainty: AreaCertainty = AREA_CERTAINTIES.includes(certaintyRaw) ? certaintyRaw : 'likely';
    const evidence = [...new Set(arr(a.evidence).map(str).filter((k) => k && ctx.allowedKeys.has(k)))];
    const droppedKeys = arr(a.evidence).map(str).filter((k) => k && !ctx.allowedKeys.has(k));
    if (droppedKeys.length) gaps.push(`${id}: evidence keys not in the brief dropped (${droppedKeys.slice(0, 5).join(', ')})`);

    let validUntil = str(a.validUntil) || 'always';
    if (validUntil !== 'always' && (!dayOk(validUntil) || validUntil <= ctx.asOf)) {
      gaps.push(`${id}: validUntil ${validUntil} is not a day after ${ctx.asOf}; 'always' used`);
      validUntil = 'always';
    }

    if (!headline || paragraphs.length === 0) {
      withheld.push(id);
      gaps.push(`${id}: withheld (${!headline ? 'no headline' : 'no paragraph'} survived)`);
      continue;
    }
    areas[id] = { id, headline, paragraphs, dates, actions, certainty, evidence, validUntil };
  }

  let validUntil = parsed.validUntil || 'always';
  if (validUntil !== 'always' && (!dayOk(validUntil) || validUntil <= ctx.asOf)) {
    gaps.push(`overall validUntil ${validUntil} is not a day after ${ctx.asOf}; 'always' used`);
    validUntil = 'always';
  }
  return { doc: { areas, validUntil }, gaps, withheld };
}

/** The document as text, for the Lab's "Oracle's answer" and the dossier: one section per area. */
export function areaDocToText(doc: OracleAreaDoc, titles: Partial<Record<BoardPanelId, string>>, order: readonly BoardPanelId[]): string {
  const parts: string[] = [];
  for (const id of order) {
    const a = doc.areas[id];
    if (!a) continue;
    const lines = [`## ${titles[id] ?? id}`, `**${a.headline}**`, ...a.paragraphs];
    if (a.dates.length) lines.push(a.dates.map((d) => `- ${d.from}..${d.to} ${d.label}`).join('\n'));
    if (a.actions.length) lines.push(a.actions.map((x) => `- Do ${x.from}..${x.to}: ${x.text}`).join('\n'));
    lines.push(`Certainty: ${a.certainty} · valid until ${a.validUntil}`);
    parts.push(lines.join('\n\n'));
  }
  parts.push(`VALID_UNTIL: ${doc.validUntil}`);
  return parts.join('\n\n');
}

/** The headline as a card line's certainty word (doc 61 §1). */
export function areaCertaintyToLine(c: AreaCertainty): LineCertainty {
  return c === 'strong' ? 'strong' : c === 'likely' ? 'moderate' : 'possible';
}
