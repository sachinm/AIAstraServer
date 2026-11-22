/**
 * A limit never cuts the reading (docs/techniques/09 §3.5, §5; AGENTS.md "Reading depth is a release gate", rule 4;
 * SOUL.md §5): a call that stops at its output ceiling (`finishReason` MAX_TOKENS) is continued from where it stopped,
 * and the parts are joined. Never discarded.
 *
 * How (a wrapper over the injected `callGemini`, so fakes test it):
 *   1  the first call goes out as asked (JSON by `responseSchema` when the caller sets one);
 *   2  on MAX_TOKENS a continuation turn is sent: the same cached prefix (`parts[0]`), the same uncached parts, then a
 *      CONTINUE part holding the text written so far and the instruction to go on from its last character. It is sent
 *      WITHOUT a schema: under a schema the model would start a fresh JSON object, not the tail of this one;
 *   3  the tail is joined to the text (a code fence or a repeated overlap at the seam is trimmed) and, while it still
 *      stops at the ceiling, step 2 repeats, at most `maxRounds` continuations and never past `deadlineMs`;
 *   4  usage is summed over every round, so the spend caps see the real cost.
 *
 * For a JSON answer the caller puts its longest prose field LAST in the schema's `propertyOrdering` (the Oracle's
 * `story`), so a cut lands inside prose and the continuation is prose plus the closing brackets. When the joined text
 * still does not parse (the rounds or the deadline ran out), `closeJson` closes it tolerantly so what was written is
 * kept; the depth gate then decides whether the card is ready, repaired or queued. Never thrown away for length.
 */
import type { GeminiCallOptions, GeminiResult } from './gemini.js';

export interface ContinueOptions {
  /** continuation turns after the first call (default 3) */
  maxRounds?: number;
  /** wall-clock budget for the first call and every continuation, ms (default: the call's own `timeoutMs`) */
  deadlineMs?: number;
  /** test seam */
  now?: () => number;
}

export interface ContinuedResult extends GeminiResult {
  /** continuation turns sent (0 when the first call finished) */
  continued: number;
  /** true when the last round still stopped at the ceiling (rounds or time ran out) */
  stillCut: boolean;
}

export const CONTINUE_MARK = 'CONTINUE:';

/** the continuation part: the text so far and the instruction to go on from its last character */
export function continuationPart(soFar: string, json: boolean): string {
  return [
    `${CONTINUE_MARK} your answer above stopped at the output limit. This is everything you wrote so far, between the markers:`,
    '<<<SO_FAR',
    soFar,
    'SO_FAR>>>',
    json
      ? 'Write ONLY what comes next, starting exactly after the last character above: no repeat of anything already written, no code fence, no new JSON object. Finish the open string and close every open bracket of the same JSON document.'
      : 'Write ONLY what comes next, starting exactly after the last character above, with no repeat of anything already written.',
  ].join('\n');
}

/** Joins a continuation to the text so far: drops a code fence the model opened, and an overlap it repeated (up to 200 chars). */
export function joinContinuation(soFar: string, tail: string): string {
  let t = tail.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const max = Math.min(200, soFar.length, t.length);
  for (let n = max; n >= 12; n--) {
    if (soFar.endsWith(t.slice(0, n))) {
      t = t.slice(n);
      break;
    }
  }
  return soFar + t;
}

/**
 * Closes a JSON text cut anywhere: an open string is closed, a dangling key or comma dropped, open arrays and objects
 * closed in order. Pure. Returns the text unchanged when it already parses.
 */
export function closeJson(text: string): string {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    JSON.parse(t);
    return t;
  } catch {
    /* close it below */
  }
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of t) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = t;
  if (inStr) out += esc ? '\\"' : '"';
  // a key with no value yet, or a trailing comma, cannot stand before a closing bracket
  out = out.replace(/,\s*"[^"]*"\s*:\s*$/, '').replace(/:\s*$/, ': null').replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === '{' ? '}' : ']';
  return out;
}

const addUsage = (a: GeminiResult['usage'], b: GeminiResult['usage']): GeminiResult['usage'] => ({
  ...a,
  promptTokens: (a?.promptTokens ?? 0) + (b?.promptTokens ?? 0),
  cachedTokens: (a?.cachedTokens ?? 0) + (b?.cachedTokens ?? 0),
  outputTokens: (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0),
  thoughtTokens: (a?.thoughtTokens ?? 0) + (b?.thoughtTokens ?? 0),
  ms: (a?.ms ?? 0) + (b?.ms ?? 0),
});

/**
 * One call that is continued at its ceiling. `call` is the caller's `callGemini` (the real one or a fake). A call or a
 * continuation that throws: what was written before it is kept and returned with `stillCut` (the first call's own error
 * is thrown, as without this wrapper).
 */
export async function callWithContinuation(call: (o: GeminiCallOptions) => Promise<GeminiResult>, o: GeminiCallOptions, opts: ContinueOptions = {}): Promise<ContinuedResult> {
  const now = opts.now ?? Date.now;
  const t0 = now();
  const budget = opts.deadlineMs ?? o.timeoutMs ?? 60_000;
  const maxRounds = opts.maxRounds ?? 3;
  const first = await call(o);
  let text = first.text;
  let usage = first.usage;
  let finish = first.finishReason;
  let rounds = 0;
  const json = Boolean(o.responseSchema);
  while (finish === 'MAX_TOKENS' && rounds < maxRounds) {
    const left = budget - (now() - t0);
    if (left < 5_000) break;
    rounds += 1;
    try {
      const { responseSchema: _schema, ...rest } = o;
      void _schema;
      const r = await call({ ...rest, node: `${o.node}.continue${rounds}`, parts: [...o.parts, continuationPart(text, json)], timeoutMs: Math.min(o.timeoutMs ?? left, left) });
      text = joinContinuation(text, r.text);
      usage = addUsage(usage, r.usage);
      finish = r.finishReason;
    } catch {
      break;
    }
  }
  return { ...first, text, usage, finishReason: finish, continued: rounds, stillCut: finish === 'MAX_TOKENS' };
}

/** Parses a (possibly continued, possibly still cut) JSON answer: as written, else closed by `closeJson`; null when neither. */
export function parseContinuedJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    try {
      return JSON.parse(closeJson(t));
    } catch {
      return null;
    }
  }
}
