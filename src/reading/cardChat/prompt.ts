/**
 * The card-chat call's input (docs/reading-engine/85 §4 step 3). Two parts, the same layout as the card's own Oracle call
 * (`cards/oracle.ts readCardOracle`) so the answer reads the same cached prefix:
 *
 *   system    the common reader system prompt (`common/reader-system`, unchanged)
 *   parts[0]  the shared prefix the card was read on (natal.core, sky.window, year.tp, frame), rebuilt byte for byte
 *             from the stored slices: the cache key is `prefixKey(model, system, parts[0])`, the card call's key
 *   parts[1]  uncached: the card-chat role (`cards/chat`), the card's brief, the card on screen, how it was read (its
 *             Oracle card, ledger cells, cited rows), the person, the last two exchanges, the question
 *
 * Engine names are redacted in place in the uncached part only (doc 82: no word lists on model text; the prefix bytes are
 * never altered, or the cache would miss). Selection and formatting only; nothing astrological is computed here.
 */
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';
import { renderCardLedger } from '../cards/oracle.js';
import { claimKey, profileLines, promptText } from '../self/v2/slices.js';
import { redactEngineTerms } from '../self/words.js';
import {
  CARD_CHAT_BOARD_TITLE,
  CARD_CHAT_HISTORY_MAX_CHARS,
  CARD_CHAT_HISTORY_TURNS,
  CARD_CHAT_PROMPT,
  type CardChatContext,
  type CardChatHistoryTurn,
} from './types.js';

export interface CardChatParts {
  system: string;
  /** parts[0] when the prefix was rebuilt (cached), else absent and the call is sent uncached */
  prefix: string | null;
  suffix: string;
}

/** The last exchanges, newest last, at most CARD_CHAT_HISTORY_TURNS and CARD_CHAT_HISTORY_MAX_CHARS (oldest cut first). */
export function capHistory(history: readonly CardChatHistoryTurn[], maxTurns = CARD_CHAT_HISTORY_TURNS, maxChars = CARD_CHAT_HISTORY_MAX_CHARS): CardChatHistoryTurn[] {
  const last = history.slice(-maxTurns);
  const out: CardChatHistoryTurn[] = [];
  let left = maxChars;
  for (let i = last.length - 1; i >= 0 && left > 0; i--) {
    const t = last[i]!;
    const q = t.question.slice(0, Math.max(0, Math.min(t.question.length, Math.floor(left / 3))));
    left -= q.length;
    const a = t.answer.slice(0, Math.max(0, left));
    left -= a.length;
    out.unshift({ question: q, answer: a });
  }
  return out;
}

/** CARD ON SCREEN: the card exactly as the page shows it (plain words), for the period on screen. */
export function cardOnScreen(ctx: CardChatContext): string {
  const c = ctx.card;
  const L: string[] = [`CARD ON SCREEN (what the person sees; the card's stored text)`, `title: ${c.title}${c.subtitle ? ` (${c.subtitle})` : ''}`];
  L.push(`period on screen: ${c.period ? `${c.period.label} (${c.period.from} to ${c.period.to})` : 'the whole card'}`);
  if (c.content) {
    L.push(`in a line: ${c.content.line}`);
    if (c.content.agreement) L.push(`checked on ${c.content.agreement.agree} of ${c.content.agreement.of} clocks`);
    for (const s of c.content.spans) {
      const agree = s.agreement ? ` agree=${s.agreement.agree}/${s.agreement.of}` : '';
      L.push(`- ${s.span} ${s.from} to ${s.to} tone=${s.held === false ? 'not held' : s.tone} mode=${s.mode}${agree}: asks "${s.asks}" | obstacle "${s.obstacle}" | step "${s.step}"`);
    }
    if (c.content.pattern?.text) L.push(`your pattern: ${c.content.pattern.text}`);
  } else if (c.v2) {
    L.push(`headline: ${c.v2.headline}`, ...c.v2.body.map((p) => `- ${p}`));
  }
  if (c.periods.length) {
    L.push('named periods:');
    for (const p of c.periods) L.push(`- ${p.label}: ${p.headline}${p.text.length ? ` ${p.text.join(' ')}` : ''}`);
  }
  if (c.keyDates.length) L.push(`key dates: ${c.keyDates.map((k) => `${k.date} ${k.label}`).join('; ')}`);
  const confirm = c.content?.confirm ?? null;
  if (confirm) {
    const answered = ctx.profile?.lastConfirms.find((x) => claimKey(x.claimId) === claimKey(confirm.claimId));
    L.push(`is this right? "${confirm.text}" (answer: ${answered ? answered.answer : 'not given yet'})`);
  }
  return L.join('\n');
}

/** HOW THE CARD WAS READ: the stored Oracle card, its ledger cells and the rows it cites (chart terms allowed here only). */
export function howItWasRead(ctx: CardChatContext): string {
  const L: string[] = ['HOW THE CARD WAS READ (the stored reading behind the card; for your reasoning only, never quoted)'];
  const o = ctx.oracle;
  if (o) {
    L.push(`headline: ${o.headline}`, `gift: ${o.gift}`, `knot: ${o.knot}`, `certainty: ${o.certainty}`);
    for (const s of o.spans) L.push(`- ${s.span} tone=${s.tone} mode=${s.mode}: asks ${s.asks} | obstacle ${s.obstacle} | agreement ${s.agreement} | evidence ${s.evidence.map((k) => `{${k}}`).join(' ')}`);
    if (o.pattern) L.push(`pattern: ${o.pattern.text}${o.pattern.since ? ` since ${o.pattern.since}` : ''}${o.pattern.until ? ` until ${o.pattern.until}` : ''}`);
    if (o.confirm) L.push(`confirm claim ${o.confirm.claimId}: ${o.confirm.text} (${o.confirm.from} to ${o.confirm.to})`);
  } else {
    L.push('(no stored Oracle card: this card is filled from the earlier board reading; read it from the card on screen and the shared data)');
  }
  L.push(renderCardLedger(ctx.cells).text);
  L.push(`CITED ROWS (stored rows the card cites that are not in the shared data)\n${ctx.evidenceRows.length ? ctx.evidenceRows.join('\n') : '(none beyond the shared data)'}`);
  return L.join('\n');
}

function personBlock(ctx: CardChatContext): string {
  // doc 13 §2.4, READING_PERSON_GATE=1: the gate's lines only (no place, no birth time; a failed read sends nothing)
  if (ctx.person) return ['THE PERSON', ...(ctx.person.lines.length ? ctx.person.lines : ['(facts not read: assume nothing about work, a partner or children)'])].join('\n');
  const p = ctx.profile;
  if (!p) return "THE PERSON\n(facts not read: assume nothing about work, a partner or children)";
  return [
    'THE PERSON',
    ...profileLines(p),
    `declined (never mention): ${p.declined.length ? p.declined.join(', ') : 'none'}`,
    `last answers: ${p.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`,
  ].join('\n');
}

/**
 * The call's parts. `question` is the person's text, as sent; `history` the thread's earlier exchanges; `clarified` what
 * the person told the clarifier before this first question (cardChat/clarify.ts `clarifiedLines`), in the uncached part.
 */
export function cardChatParts(ctx: CardChatContext, question: string, history: readonly CardChatHistoryTurn[], clarified: readonly string[] = []): CardChatParts {
  const c = ctx.card;
  const others = c.boardCards.map((x) => `${x.title} (\`${x.id}\`)`).join('; ');
  const turns = capHistory(history);
  const suffix = [
    ...(ctx.prefix?.dated ? [ctx.prefix.dated] : []),
    promptText(CARD_CHAT_PROMPT),
    `THE CARD: ${c.title} (\`${c.id}\`, ${CARD_CHAT_BOARD_TITLE[c.board]} board)`,
    `CARD BRIEF\n${ctx.brief || '(no brief stored: keep to the card on screen)'}`,
    `OTHER CARDS ON THIS BOARD (for pointers only): ${others || 'none'}`,
    `THE BOARDS: You (the person themselves: body, mind, character, time), Love (dating, marriage, friends, allies at work), Work (starting out, the job, craft and hobby, business)`,
    cardOnScreen(ctx),
    howItWasRead(ctx),
    personBlock(ctx),
    turns.length ? `THIS CONVERSATION SO FAR (oldest first)\n${turns.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}` : 'THIS CONVERSATION SO FAR: this is the first question',
    ...(clarified.length ? [`WHAT THE PERSON SETTLED BEFORE THIS QUESTION (their own answers; take them as given)\n${clarified.map((l) => `- ${l}`).join('\n')}`] : []),
    `QUESTION: ${question}`,
    'THIS CALL: answer the question about this card in plain prose, as the role says. No JSON.',
  ].join('\n\n');
  return { system: promptText(READER_SYSTEM_PROMPT), prefix: ctx.prefix?.text ?? null, suffix: redactEngineTerms(suffix) };
}
