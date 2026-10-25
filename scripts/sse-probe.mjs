/**
 * Posts one question to an ask-stream endpoint and prints every SSE event with the elapsed milliseconds since the request
 * started, so "first visible progress" and "first answer token" are measured, not guessed.
 *
 *   node scripts/sse-probe.mjs "When am I going to buy a house?" [http://127.0.0.1:3020/api/chat/ask-stream] [out.json]
 */
import { writeFileSync } from 'node:fs';

const question = process.argv[2] ?? 'When will I get married?';
const url = process.argv[3] ?? 'http://127.0.0.1:3020/api/chat/ask-stream';
const out = process.argv[4];
const t0 = performance.now();
const events = [];
const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
let tokens = 0;
let firstToken = null;
let firstEvent = null;
for (;;) {
  const { done, value } = await reader.read();
  if (value) buf += dec.decode(value, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const block = buf.slice(0, i);
    buf = buf.slice(i + 2);
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const ev = JSON.parse(line.slice(5));
      const ms = Math.round(performance.now() - t0);
      if (ev.type === 'token') {
        tokens += 1;
        if (firstToken === null) firstToken = ms;
        continue;
      }
      if (firstEvent === null && (ev.type === 'intent' || ev.type === 'stage')) firstEvent = ms;
      events.push({ at: ms, ...(ev.type === 'done' ? { type: 'done', chatId: ev.chatId, runId: ev.runId, grounding: ev.grounding, answerChars: String(ev.answer ?? '').length } : ev) });
    }
  }
  if (done) break;
}
const total = Math.round(performance.now() - t0);
const summary = { question, firstProgressEventMs: firstEvent, firstTokenMs: firstToken, tokenEvents: tokens, totalMs: total, events };
for (const e of events) {
  const label = e.type === 'stage' ? `stage ${e.name} ${e.status}${e.ms !== undefined ? ` (took ${e.ms} ms)` : ''}${e.subject ? ` [${e.subject}]` : ''}` : e.type === 'intent' ? `intent: ${e.intent?.text}` : e.type;
  console.log(`+${String(e.at).padStart(5)} ms  ${label}`);
}
console.log(`first progress event at ${firstEvent} ms, first answer token at ${firstToken} ms, ${tokens} token events, total ${total} ms`);
if (out) writeFileSync(out, JSON.stringify(summary, null, 2));
